import { createHash, randomBytes, randomUUID } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import pg from 'pg';
import type {
  FriendEntry,
  MatchHistoryEntry,
  MatchResultInput,
  PublicProfile,
  RivalrySummary
} from './types.js';

const { Pool } = pg;

interface StoredProfile extends PublicProfile {
  linkedEmail?: string;
}

export interface Store {
  initialize(): Promise<void>;
  createGuest(displayName?: string, importedCrowns?: number): Promise<PublicProfile>;
  createSession(profileId: string, rawToken: string, expiresAt: Date): Promise<void>;
  profileForSession(rawToken: string): Promise<PublicProfile | undefined>;
  getProfile(profileId: string): Promise<PublicProfile | undefined>;
  findProfile(query: string): Promise<PublicProfile | undefined>;
  updateProfile(profileId: string, displayName: string): Promise<PublicProfile>;
  recordMatch(result: MatchResultInput): Promise<void>;
  history(profileId: string, limit: number): Promise<MatchHistoryEntry[]>;
  rivalries(profileId: string): Promise<RivalrySummary[]>;
  friends(profileId: string): Promise<FriendEntry[]>;
  requestFriend(requesterId: string, addresseeId: string): Promise<void>;
  acceptFriend(profileId: string, requesterId: string): Promise<void>;
  setOnline(profileId: string, online: boolean): void;
  setRoomPresence(profileId: string, roomCode?: string): void;
  close(): Promise<void>;
}

export function hashToken(rawToken: string): string {
  return createHash('sha256').update(rawToken).digest('hex');
}

export function newSessionToken(): string {
  return randomBytes(32).toString('base64url');
}

function sanitizeName(value?: string): string {
  const trimmed = value?.replace(/[^\p{L}\p{N} _-]/gu, '').trim().slice(0, 32);
  return trimmed || `Wanderer ${Math.floor(1000 + Math.random() * 9000)}`;
}

function makeHandle(name: string): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 15) || 'wanderer';
  return `${base}-${randomBytes(3).toString('hex')}`;
}

function publicProfile(profile: StoredProfile, online = false, roomCode?: string): PublicProfile {
  return {
    id: profile.id,
    handle: profile.handle,
    displayName: profile.displayName,
    guest: profile.guest,
    crowns: profile.crowns,
    wins: profile.wins,
    online,
    roomCode,
    createdAt: profile.createdAt
  };
}

export class MemoryStore implements Store {
  private readonly profiles = new Map<string, StoredProfile>();
  private readonly sessions = new Map<string, { profileId: string; expiresAt: number }>();
  private readonly matches: MatchResultInput[] = [];
  private readonly friendshipRows = new Map<string, 'pending' | 'accepted'>();
  private readonly online = new Set<string>();
  private readonly presenceRooms = new Map<string, string>();

  async initialize(): Promise<void> {}

  async createGuest(displayName?: string, importedCrowns = 0): Promise<PublicProfile> {
    const name = sanitizeName(displayName);
    const stored: StoredProfile = {
      id: randomUUID(),
      handle: makeHandle(name),
      displayName: name,
      guest: true,
      crowns: Math.max(0, Math.floor(importedCrowns)),
      wins: 0,
      online: false,
      createdAt: new Date().toISOString()
    };
    this.profiles.set(stored.id, stored);
    return publicProfile(stored);
  }

  async createSession(profileId: string, rawToken: string, expiresAt: Date): Promise<void> {
    this.sessions.set(hashToken(rawToken), { profileId, expiresAt: expiresAt.getTime() });
  }

  async profileForSession(rawToken: string): Promise<PublicProfile | undefined> {
    const session = this.sessions.get(hashToken(rawToken));
    if (!session || session.expiresAt <= Date.now()) return undefined;
    return this.getProfile(session.profileId);
  }

  async getProfile(profileId: string): Promise<PublicProfile | undefined> {
    const profile = this.profiles.get(profileId);
    return profile ? publicProfile(profile, this.online.has(profileId), this.presenceRooms.get(profileId)) : undefined;
  }

  async findProfile(query: string): Promise<PublicProfile | undefined> {
    const normalized = query.trim().toLowerCase();
    const profile = [...this.profiles.values()].find((candidate) =>
      candidate.id === query
      || candidate.handle.toLowerCase() === normalized
      || candidate.displayName.toLowerCase() === normalized
    );
    return profile ? publicProfile(profile, this.online.has(profile.id), this.presenceRooms.get(profile.id)) : undefined;
  }

  async updateProfile(profileId: string, displayName: string): Promise<PublicProfile> {
    const profile = this.profiles.get(profileId);
    if (!profile) throw new Error('Profile not found.');
    profile.displayName = sanitizeName(displayName);
    return publicProfile(profile, this.online.has(profileId), this.presenceRooms.get(profileId));
  }

  async recordMatch(result: MatchResultInput): Promise<void> {
    if (this.matches.some((match) => match.id === result.id)) return;
    this.matches.push(structuredClone(result));
    for (const participant of result.participants) {
      if (!participant.profileId) continue;
      const profile = this.profiles.get(participant.profileId);
      if (!profile) continue;
      profile.crowns += 5 + participant.kills * 2 + (participant.won ? 20 : 0);
      if (participant.won) profile.wins += 1;
    }
  }

  async history(profileId: string, limit: number): Promise<MatchHistoryEntry[]> {
    return this.matches
      .filter((match) => match.participants.some((participant) => participant.profileId === profileId))
      .slice(-limit)
      .reverse()
      .map((match) => ({
        ...structuredClone(match),
        opponents: match.participants
          .filter((participant) => participant.profileId !== profileId)
          .map(({ profileId: opponentId, displayName, character, placement }) => ({
            profileId: opponentId,
            displayName,
            character,
            placement
          }))
      }));
  }

  async rivalries(profileId: string): Promise<RivalrySummary[]> {
    return calculateRivalries(profileId, this.matches, (id) => this.profiles.get(id));
  }

  async friends(profileId: string): Promise<FriendEntry[]> {
    const result: FriendEntry[] = [];
    for (const [key, status] of this.friendshipRows) {
      const [requester, addressee] = key.split(':');
      if (requester !== profileId && addressee !== profileId) continue;
      const otherId = requester === profileId ? addressee : requester;
      const profile = await this.getProfile(otherId);
      if (!profile) continue;
      result.push({
        profile,
        status: status === 'accepted'
          ? 'accepted'
          : requester === profileId ? 'pending-outgoing' : 'pending-incoming'
      });
    }
    return result;
  }

  async requestFriend(requesterId: string, addresseeId: string): Promise<void> {
    if (requesterId === addresseeId) throw new Error('You cannot challenge yourself.');
    const reverse = `${addresseeId}:${requesterId}`;
    if (this.friendshipRows.get(reverse) === 'pending') {
      this.friendshipRows.set(reverse, 'accepted');
      return;
    }
    this.friendshipRows.set(`${requesterId}:${addresseeId}`, 'pending');
  }

  async acceptFriend(profileId: string, requesterId: string): Promise<void> {
    const key = `${requesterId}:${profileId}`;
    if (this.friendshipRows.get(key) !== 'pending') throw new Error('Friend invitation not found.');
    this.friendshipRows.set(key, 'accepted');
  }

  setOnline(profileId: string, online: boolean): void {
    if (online) this.online.add(profileId);
    else this.online.delete(profileId);
  }

  setRoomPresence(profileId: string, roomCode?: string): void {
    if (roomCode) this.presenceRooms.set(profileId, roomCode);
    else this.presenceRooms.delete(profileId);
  }

  async close(): Promise<void> {}
}

export class PostgresStore implements Store {
  private readonly pool: pg.Pool;
  private readonly online = new Set<string>();
  private readonly presenceRooms = new Map<string, string>();

  constructor(connectionString: string) {
    this.pool = new Pool({
      connectionString,
      ssl: process.env.NODE_ENV === 'production' ? { rejectUnauthorized: false } : undefined
    });
  }

  async initialize(): Promise<void> {
    const schemaPath = resolve(process.cwd(), 'server', 'schema.sql');
    await this.pool.query(await readFile(schemaPath, 'utf8'));
  }

  async createGuest(displayName?: string, importedCrowns = 0): Promise<PublicProfile> {
    const name = sanitizeName(displayName);
    const result = await this.pool.query(
      `INSERT INTO profiles (id, handle, display_name, crowns)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [randomUUID(), makeHandle(name), name, Math.max(0, Math.floor(importedCrowns))]
    );
    return this.fromRow(result.rows[0]);
  }

  async createSession(profileId: string, rawToken: string, expiresAt: Date): Promise<void> {
    await this.pool.query(
      `INSERT INTO sessions (token_hash, profile_id, expires_at)
       VALUES ($1, $2, $3)
       ON CONFLICT (token_hash) DO UPDATE SET expires_at = EXCLUDED.expires_at`,
      [hashToken(rawToken), profileId, expiresAt]
    );
  }

  async profileForSession(rawToken: string): Promise<PublicProfile | undefined> {
    const result = await this.pool.query(
      `SELECT p.* FROM sessions s
       JOIN profiles p ON p.id = s.profile_id
       WHERE s.token_hash = $1 AND s.expires_at > NOW()`,
      [hashToken(rawToken)]
    );
    return result.rowCount ? this.fromRow(result.rows[0]) : undefined;
  }

  async getProfile(profileId: string): Promise<PublicProfile | undefined> {
    const result = await this.pool.query('SELECT * FROM profiles WHERE id = $1', [profileId]);
    return result.rowCount ? this.fromRow(result.rows[0]) : undefined;
  }

  async findProfile(query: string): Promise<PublicProfile | undefined> {
    const result = await this.pool.query(
      `SELECT * FROM profiles
       WHERE id::text = $1 OR LOWER(handle) = LOWER($1) OR LOWER(display_name) = LOWER($1)
       ORDER BY last_seen_at DESC LIMIT 1`,
      [query.trim()]
    );
    return result.rowCount ? this.fromRow(result.rows[0]) : undefined;
  }

  async updateProfile(profileId: string, displayName: string): Promise<PublicProfile> {
    const result = await this.pool.query(
      `UPDATE profiles SET display_name = $2, last_seen_at = NOW()
       WHERE id = $1 RETURNING *`,
      [profileId, sanitizeName(displayName)]
    );
    if (!result.rowCount) throw new Error('Profile not found.');
    return this.fromRow(result.rows[0]);
  }

  async recordMatch(result: MatchResultInput): Promise<void> {
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const inserted = await client.query(
        `INSERT INTO matches
          (id, room_code, map_id, mode_id, reason, winner_profile_id, started_at, ended_at)
         VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
         ON CONFLICT (id) DO NOTHING RETURNING id`,
        [
          result.id,
          result.roomCode,
          result.map,
          result.mode,
          result.reason,
          result.winnerProfileId ?? null,
          result.startedAt,
          result.endedAt
        ]
      );
      if (!inserted.rowCount) {
        await client.query('ROLLBACK');
        return;
      }
      for (const participant of result.participants) {
        await client.query(
          `INSERT INTO match_participants
            (match_id, profile_id, seat, display_name, character_id, placement, kills, deaths,
             bombs_placed, runes_collected, shards, survival_ms, won)
           VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13)`,
          [
            result.id,
            participant.profileId ?? null,
            participant.seat,
            participant.displayName,
            participant.character,
            participant.placement,
            participant.kills,
            participant.deaths,
            participant.bombsPlaced,
            participant.runesCollected,
            participant.shards,
            participant.survivalMs,
            participant.won
          ]
        );
        if (participant.profileId) {
          const crowns = 5 + participant.kills * 2 + (participant.won ? 20 : 0);
          await client.query(
            `UPDATE profiles
             SET crowns = crowns + $2,
                 wins = wins + $3,
                 last_seen_at = NOW()
             WHERE id = $1`,
            [participant.profileId, crowns, participant.won ? 1 : 0]
          );
        }
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async history(profileId: string, limit: number): Promise<MatchHistoryEntry[]> {
    const result = await this.pool.query(
      `SELECT m.*,
        json_agg(json_build_object(
          'profileId', mp.profile_id,
          'seat', mp.seat,
          'displayName', mp.display_name,
          'character', mp.character_id,
          'placement', mp.placement,
          'kills', mp.kills,
          'deaths', mp.deaths,
          'bombsPlaced', mp.bombs_placed,
          'runesCollected', mp.runes_collected,
          'shards', mp.shards,
          'survivalMs', mp.survival_ms,
          'won', mp.won
        ) ORDER BY mp.seat) AS participants
       FROM matches m
       JOIN match_participants self ON self.match_id = m.id AND self.profile_id = $1
       JOIN match_participants mp ON mp.match_id = m.id
       GROUP BY m.id
       ORDER BY m.ended_at DESC LIMIT $2`,
      [profileId, limit]
    );
    return result.rows.map((row) => ({
      id: row.id,
      roomCode: row.room_code,
      map: row.map_id,
      mode: row.mode_id,
      reason: row.reason,
      winnerProfileId: row.winner_profile_id ?? undefined,
      startedAt: new Date(row.started_at).toISOString(),
      endedAt: new Date(row.ended_at).toISOString(),
      participants: row.participants,
      opponents: row.participants
        .filter((participant: { profileId?: string }) => participant.profileId !== profileId)
        .map((participant: {
          profileId?: string;
          displayName: string;
          character: MatchHistoryEntry['participants'][number]['character'];
          placement: number;
        }) => ({
          profileId: participant.profileId,
          displayName: participant.displayName,
          character: participant.character,
          placement: participant.placement
        }))
    }));
  }

  async rivalries(profileId: string): Promise<RivalrySummary[]> {
    const result = await this.pool.query(
      `SELECT opponent.profile_id AS opponent_id,
        self.won AS self_won,
        self.character_id AS self_character,
        m.map_id,
        m.ended_at
       FROM match_participants self
       JOIN match_participants opponent
         ON opponent.match_id = self.match_id
        AND opponent.profile_id IS NOT NULL
        AND opponent.profile_id <> self.profile_id
       JOIN matches m ON m.id = self.match_id
       WHERE self.profile_id = $1
       ORDER BY m.ended_at ASC`,
      [profileId]
    );
    const grouped = new Map<string, typeof result.rows>();
    for (const row of result.rows) {
      const rows = grouped.get(row.opponent_id) ?? [];
      rows.push(row);
      grouped.set(row.opponent_id, rows);
    }
    const rivalries: RivalrySummary[] = [];
    for (const [opponentId, rows] of grouped) {
      const profile = await this.getProfile(opponentId);
      if (!profile) continue;
      let streak = 0;
      for (const row of [...rows].reverse()) {
        const direction = row.self_won ? 1 : -1;
        if (streak && Math.sign(streak) !== direction) break;
        streak += direction;
      }
      rivalries.push({
        profile,
        games: rows.length,
        wins: rows.filter((row) => row.self_won).length,
        losses: rows.filter((row) => !row.self_won).length,
        currentStreak: streak,
        lastPlayedAt: new Date(rows.at(-1).ended_at).toISOString(),
        favouriteMap: highest(countBy(rows.map((row) => String(row.map_id)))),
        favouriteCharacter: highest(countBy(rows.map((row) => String(row.self_character)))) as RivalrySummary['favouriteCharacter']
      });
    }
    return rivalries.sort((a, b) => b.games - a.games || b.lastPlayedAt.localeCompare(a.lastPlayedAt));
  }

  async friends(profileId: string): Promise<FriendEntry[]> {
    const result = await this.pool.query(
      `SELECT f.*, p.*
       FROM friendships f
       JOIN profiles p ON p.id = CASE
         WHEN f.requester_id = $1 THEN f.addressee_id
         ELSE f.requester_id
       END
       WHERE f.requester_id = $1 OR f.addressee_id = $1
       ORDER BY f.created_at DESC`,
      [profileId]
    );
    return result.rows.map((row) => ({
      profile: this.fromRow(row),
      status: row.status === 'accepted'
        ? 'accepted'
        : row.requester_id === profileId ? 'pending-outgoing' : 'pending-incoming'
    }));
  }

  async requestFriend(requesterId: string, addresseeId: string): Promise<void> {
    if (requesterId === addresseeId) throw new Error('You cannot challenge yourself.');
    const client = await this.pool.connect();
    try {
      await client.query('BEGIN');
      const reverse = await client.query(
        `UPDATE friendships SET status = 'accepted'
         WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'
         RETURNING requester_id`,
        [addresseeId, requesterId]
      );
      if (!reverse.rowCount) {
        await client.query(
          `INSERT INTO friendships (requester_id, addressee_id, status)
           VALUES ($1, $2, 'pending')
           ON CONFLICT (requester_id, addressee_id) DO NOTHING`,
          [requesterId, addresseeId]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async acceptFriend(profileId: string, requesterId: string): Promise<void> {
    const result = await this.pool.query(
      `UPDATE friendships SET status = 'accepted'
       WHERE requester_id = $1 AND addressee_id = $2 AND status = 'pending'`,
      [requesterId, profileId]
    );
    if (!result.rowCount) throw new Error('Friend invitation not found.');
  }

  setOnline(profileId: string, online: boolean): void {
    if (online) this.online.add(profileId);
    else this.online.delete(profileId);
  }

  setRoomPresence(profileId: string, roomCode?: string): void {
    if (roomCode) this.presenceRooms.set(profileId, roomCode);
    else this.presenceRooms.delete(profileId);
  }

  async close(): Promise<void> {
    await this.pool.end();
  }

  private fromRow(row: Record<string, unknown>): PublicProfile {
    const id = String(row.id);
    return {
      id,
      handle: String(row.handle),
      displayName: String(row.display_name),
      guest: Boolean(row.guest),
      crowns: Number(row.crowns),
      wins: Number(row.wins),
      online: this.online.has(id),
      roomCode: this.presenceRooms.get(id),
      createdAt: new Date(String(row.created_at)).toISOString()
    };
  }
}

function calculateRivalries(
  profileId: string,
  matches: MatchResultInput[],
  getStoredProfile: (id: string) => StoredProfile | undefined
): RivalrySummary[] {
  const groups = new Map<string, MatchResultInput[]>();
  for (const match of matches) {
    if (!match.participants.some((participant) => participant.profileId === profileId)) continue;
    for (const opponent of match.participants) {
      if (!opponent.profileId || opponent.profileId === profileId) continue;
      const list = groups.get(opponent.profileId) ?? [];
      list.push(match);
      groups.set(opponent.profileId, list);
    }
  }
  return [...groups.entries()].map(([opponentId, shared]) => {
    const opponent = getStoredProfile(opponentId);
    const chronological = [...shared].sort((a, b) => a.endedAt.localeCompare(b.endedAt));
    let streak = 0;
    for (const match of chronological.reverse()) {
      const self = match.participants.find((participant) => participant.profileId === profileId);
      const direction = self?.won ? 1 : -1;
      if (streak !== 0 && Math.sign(streak) !== direction) break;
      streak += direction;
    }
    const mapCounts = countBy(shared.map((match) => match.map));
    const characters = shared.map((match) =>
      match.participants.find((participant) => participant.profileId === profileId)?.character ?? 'dragon'
    );
    return {
      profile: opponent ? publicProfile(opponent) : {
        id: opponentId,
        handle: 'unknown',
        displayName: 'Unknown Rival',
        guest: true,
        crowns: 0,
        wins: 0,
        online: false,
        createdAt: new Date(0).toISOString()
      },
      games: shared.length,
      wins: shared.filter((match) => match.participants.find((p) => p.profileId === profileId)?.won).length,
      losses: shared.filter((match) => !match.participants.find((p) => p.profileId === profileId)?.won).length,
      currentStreak: streak,
      lastPlayedAt: shared.map((match) => match.endedAt).sort().at(-1) ?? new Date(0).toISOString(),
      favouriteMap: highest(mapCounts),
      favouriteCharacter: highest(countBy(characters)) as RivalrySummary['favouriteCharacter']
    };
  }).sort((a, b) => b.games - a.games);
}

function countBy(values: string[]): Map<string, number> {
  const result = new Map<string, number>();
  for (const value of values) result.set(value, (result.get(value) ?? 0) + 1);
  return result;
}

function highest(values: Map<string, number>): string {
  return [...values].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'ashen';
}

export function createStore(): Store {
  return process.env.DATABASE_URL
    ? new PostgresStore(process.env.DATABASE_URL)
    : new MemoryStore();
}
