import type { CharacterClass, GameMode, PowerUpType } from '../utils/types';

export interface MatchRecord {
  version: 1;
  timestamp: number;
  map: string;
  mode: GameMode;
  champion: CharacterClass;
  won: boolean;
  reason: string;
  elapsedMs: number;
  kills: number;
  shards: number;
  healthRemaining: number;
  lastRune?: PowerUpType;
}

const STORAGE_KEY = 'crownfire.match-history.v1';
const MAX_RECORDS = 100;

/**
 * Keeps a compact local audit trail for balance work. It intentionally stores
 * only match outcome data, never controls, account data, or network details.
 */
export class MatchTelemetrySystem {
  static record(entry: Omit<MatchRecord, 'version' | 'timestamp'>): void {
    try {
      const history = this.read();
      history.push({ version: 1, timestamp: Date.now(), ...entry });
      localStorage.setItem(STORAGE_KEY, JSON.stringify(history.slice(-MAX_RECORDS)));
    } catch {
      // Storage can be unavailable in privacy modes; gameplay must not depend
      // on analytics being writable.
    }
  }

  static read(): MatchRecord[] {
    try {
      const parsed: unknown = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? '[]');
      return Array.isArray(parsed) ? parsed.filter(this.isRecord) : [];
    } catch {
      return [];
    }
  }

  static clear(): void {
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      // No-op when storage is unavailable.
    }
  }

  private static isRecord(value: unknown): value is MatchRecord {
    if (!value || typeof value !== 'object') return false;
    const record = value as Partial<MatchRecord>;
    return record.version === 1
      && typeof record.timestamp === 'number'
      && typeof record.map === 'string'
      && typeof record.champion === 'string'
      && typeof record.won === 'boolean'
      && typeof record.elapsedMs === 'number';
  }
}
