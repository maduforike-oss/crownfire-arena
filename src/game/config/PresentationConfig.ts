import Phaser from 'phaser';

export interface PresentationConfig {
  width: number;
  height: number;
  arenaTop: number;
  arenaWidth: number;
  arenaHeight: number;
  leftRailWidth: number;
  rightRailWidth: number;
  maxDevicePixelRatio: number;
}

export interface ChampionAnimationSet {
  frameWidth: number;
  frameHeight: number;
  idleFrames: number;
  walkFrames: number;
  placeFrames: number;
  specialFrames: number;
  damagedFrames: number;
  defeatedFrames: number;
  mirroredLeft: boolean;
}

export interface ActiveEffectViewModel {
  icon: string;
  label: string;
  color: number;
  remainingMs?: number;
  charges?: number;
}

export interface VFXTheme {
  accent: number;
  highlight: number;
  shadow: number;
  particleShape: 'spark' | 'shard' | 'mist' | 'feather' | 'claw';
}

export interface AudioManifest {
  menuMood: string;
  mapMoods: Record<string, string>;
  resultMood: string;
}

export const PRESENTATION: PresentationConfig = {
  width: 1280,
  height: 720,
  arenaTop: 72,
  arenaWidth: 720,
  arenaHeight: 624,
  leftRailWidth: 260,
  rightRailWidth: 260,
  maxDevicePixelRatio: 2
};

export const CHAMPION_ANIMATION: ChampionAnimationSet = {
  frameWidth: 128,
  frameHeight: 128,
  idleFrames: 4,
  walkFrames: 6,
  placeFrames: 4,
  specialFrames: 6,
  damagedFrames: 3,
  defeatedFrames: 6,
  mirroredLeft: true
};

export const DEPTH = {
  backdrop: -10,
  floor: 0,
  decals: 1,
  pickups: 5,
  bombs: 8,
  blocks: 10,
  characters: 20,
  explosions: 30,
  floatingText: 40,
  hud: 100
} as const;

export function hexColor(value: number): string {
  return `#${value.toString(16).padStart(6, '0')}`;
}

export function safeArea(scene: Phaser.Scene): Phaser.Geom.Rectangle {
  return new Phaser.Geom.Rectangle(24, 20, PRESENTATION.width - 48, PRESENTATION.height - 40);
}
