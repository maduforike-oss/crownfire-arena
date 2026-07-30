export const CHARACTER_IDS = ['dragon', 'wolf', 'frost', 'veil', 'skin', 'stone', 'raven', 'beast'] as const;
export type CharacterId = typeof CHARACTER_IDS[number];

export interface PublicProfile {
  id: string;
  handle: string;
  displayName: string;
  guest: boolean;
  crowns: number;
  wins: number;
  online: boolean;
  roomCode?: string;
  createdAt: string;
}

export interface MatchParticipantInput {
  profileId?: string;
  seat: number;
  displayName: string;
  character: CharacterId;
  placement: number;
  kills: number;
  deaths: number;
  bombsPlaced: number;
  runesCollected: number;
  shards: number;
  survivalMs: number;
  won: boolean;
}

export interface MatchResultInput {
  id: string;
  roomCode: string;
  map: string;
  mode: string;
  reason: string;
  winnerProfileId?: string;
  startedAt: string;
  endedAt: string;
  participants: MatchParticipantInput[];
}

export interface MatchHistoryEntry extends MatchResultInput {
  opponents: Array<Pick<MatchParticipantInput, 'profileId' | 'displayName' | 'character' | 'placement'>>;
}

export interface RivalrySummary {
  profile: PublicProfile;
  games: number;
  wins: number;
  losses: number;
  currentStreak: number;
  lastPlayedAt: string;
  favouriteMap: string;
  favouriteCharacter: CharacterId;
}

export interface FriendEntry {
  profile: PublicProfile;
  status: 'pending-incoming' | 'pending-outgoing' | 'accepted';
}

export interface RoomSeat {
  seat: number;
  profileId?: string;
  displayName: string;
  character: CharacterId;
  connected: boolean;
  ready: boolean;
  bot: boolean;
}

export interface RoomState {
  code: string;
  hostProfileId: string;
  phase: 'lobby' | 'playing' | 'results';
  seats: RoomSeat[];
  spectators: number;
  map: string;
  mode: 'grand';
  matchId?: string;
  inviteUrl?: string;
  rematchVotes: string[];
}

export interface OnlineMatchConfig {
  matchId: string;
  map: string;
  mode: 'grand';
  roomCode: string;
  players: RoomSeat[];
}

export type ClientSocketMessage =
  | { type: 'hello'; sessionToken: string; reconnectToken?: string }
  | { type: 'create-room'; character: CharacterId }
  | { type: 'join-room'; room: string; character: CharacterId; spectator?: boolean }
  | { type: 'loadout'; character: CharacterId }
  | { type: 'ready'; ready: boolean }
  | { type: 'start'; map: string }
  | { type: 'relay'; payload: unknown }
  | { type: 'match-result'; result: MatchResultInput }
  | { type: 'rematch-vote' }
  | { type: 'leave-room' };

export type ServerSocketMessage =
  | { type: 'welcome'; profile: PublicProfile; reconnectToken: string }
  | { type: 'room'; room: RoomState; yourSeat?: number; spectator: boolean }
  | { type: 'start'; config: OnlineMatchConfig }
  | { type: 'relay'; fromProfileId: string; fromSeat?: number; payload: unknown }
  | { type: 'match-recorded'; matchId: string }
  | { type: 'error'; code: string; message: string };
