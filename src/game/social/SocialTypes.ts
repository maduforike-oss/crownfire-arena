import type { CharacterClass } from '../utils/types';

export interface SocialProfile {
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

export interface SocialMatchParticipant {
  profileId?: string;
  seat: number;
  displayName: string;
  character: CharacterClass;
  placement: number;
  kills: number;
  deaths: number;
  bombsPlaced: number;
  runesCollected: number;
  shards: number;
  survivalMs: number;
  won: boolean;
}

export interface SocialMatchRecord {
  id: string;
  roomCode: string;
  map: string;
  mode: string;
  reason: string;
  winnerProfileId?: string;
  startedAt: string;
  endedAt: string;
  participants: SocialMatchParticipant[];
  opponents: Array<Pick<SocialMatchParticipant, 'profileId' | 'displayName' | 'character' | 'placement'>>;
}

export interface RivalryRecord {
  profile: SocialProfile;
  games: number;
  wins: number;
  losses: number;
  currentStreak: number;
  lastPlayedAt: string;
  favouriteMap: string;
  favouriteCharacter: CharacterClass;
}

export interface FriendRecord {
  profile: SocialProfile;
  status: 'pending-incoming' | 'pending-outgoing' | 'accepted';
}

export interface OnlineRoomSeat {
  seat: number;
  profileId?: string;
  displayName: string;
  character: CharacterClass;
  connected: boolean;
  ready: boolean;
  bot: boolean;
}

export interface OnlineRoomState {
  code: string;
  hostProfileId: string;
  phase: 'lobby' | 'playing' | 'results';
  seats: OnlineRoomSeat[];
  spectators: number;
  map: string;
  mode: 'grand';
  matchId?: string;
  inviteUrl?: string;
  rematchVotes: string[];
}

export interface OnlineRumbleConfig {
  matchId: string;
  map: string;
  mode: 'grand';
  roomCode: string;
  players: OnlineRoomSeat[];
}
