import type { BotDifficulty, CharacterClass, Stats } from '../utils/types';

export interface BotProfile {
  difficulty: BotDifficulty;
  healthOffset: number;
  speedMultiplier: number;
  aggression: number;
  pickupInterest: number;
  shrineInterest: number;
  specialUse: number;
  dangerMarginMs: number;
}

export const BOT_PROFILES: Record<BotDifficulty, BotProfile> = {
  easy: {
    difficulty: 'easy',
    healthOffset: -1,
    speedMultiplier: 0.94,
    aggression: 0.55,
    pickupInterest: 0.7,
    shrineInterest: 0.45,
    specialUse: 0.55,
    dangerMarginMs: 420
  },
  normal: {
    difficulty: 'normal',
    healthOffset: 0,
    speedMultiplier: 1,
    aggression: 0.78,
    pickupInterest: 0.88,
    shrineInterest: 0.68,
    specialUse: 0.78,
    dangerMarginMs: 330
  },
  hard: {
    difficulty: 'hard',
    healthOffset: 0,
    speedMultiplier: 1.04,
    aggression: 1,
    pickupInterest: 1,
    shrineInterest: 0.86,
    specialUse: 1,
    dangerMarginMs: 270
  }
};

export function applyBotProfile(stats: Stats, difficulty: BotDifficulty): void {
  const profile = BOT_PROFILES[difficulty];
  stats.maxHealth = Math.max(1, stats.maxHealth + profile.healthOffset);
  stats.health = stats.maxHealth;
  stats.moveSpeed = Math.round(stats.moveSpeed * profile.speedMultiplier);
}

export function buildBotRoster(
  playerCharacter: CharacterClass,
  mapId: string,
  count: number
): CharacterClass[] {
  const all: CharacterClass[] = ['dragon', 'wolf', 'frost', 'veil', 'skin', 'stone', 'raven', 'beast'];
  const candidates = all.filter((character) => character !== playerCharacter);
  const seed = [...`${mapId}:${playerCharacter}`].reduce((sum, char) => sum + char.charCodeAt(0), 0);
  return Array.from({ length: count }, (_, index) => candidates[(seed + index * 3) % candidates.length]);
}
