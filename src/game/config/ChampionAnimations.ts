import type { CharacterClass } from '../utils/types';

export type ChampionAnimationState = 'idle' | 'walk' | 'place' | 'special' | 'damaged' | 'defeated';
export type AuthoredFacing = 'down' | 'right' | 'up';

export interface AnimationRange {
  start: number;
  end: number;
  frameMs: number;
  loop: boolean;
}

export interface AnimationPose {
  xPercent: number;
  yPercent: number;
  angle: number;
  scaleY: number;
}

export interface DirectionalAnimationAsset {
  textureKey: string;
  path: string;
}

export interface ChampionAnimationSet {
  directional: Record<AuthoredFacing, DirectionalAnimationAsset>;
  frameWidth: number;
  frameHeight: number;
  artTop: number;
  artBaseline: number;
  anchorX: number;
  states: Record<ChampionAnimationState, AnimationRange>;
}

const STATES: ChampionAnimationSet['states'] = {
  idle: { start: 0, end: 3, frameMs: 200, loop: true },
  walk: { start: 0, end: 5, frameMs: 100, loop: true },
  place: { start: 0, end: 3, frameMs: 1000 / 7, loop: false },
  special: { start: 0, end: 5, frameMs: 1000 / 9, loop: false },
  damaged: { start: 0, end: 2, frameMs: 1000 / 11, loop: false },
  defeated: { start: 0, end: 5, frameMs: 1000 / 7, loop: false }
};

// Motion Lab v11 pose beats. Every transform pivots around the shared
// [128, 224] foot anchor; gameplay remains authoritative at the tile center.
export const CHAMPION_POSES: Record<ChampionAnimationState, AnimationPose[]> = {
  idle: [
    { xPercent: 0, yPercent: 0, angle: -0.35, scaleY: 1 },
    { xPercent: 0, yPercent: -1.1, angle: 0.15, scaleY: 1.004 },
    { xPercent: 0, yPercent: -2, angle: 0.35, scaleY: 1.008 },
    { xPercent: 0, yPercent: -0.8, angle: -0.1, scaleY: 1.003 }
  ],
  walk: [
    { xPercent: -1.6, yPercent: 0, angle: -1.2, scaleY: 1 },
    { xPercent: -0.8, yPercent: -2.8, angle: -0.4, scaleY: 1.012 },
    { xPercent: 0.8, yPercent: -1.1, angle: 0.8, scaleY: 1.004 },
    { xPercent: 1.6, yPercent: 0, angle: 1.2, scaleY: 1 },
    { xPercent: 0.8, yPercent: -2.8, angle: 0.4, scaleY: 1.012 },
    { xPercent: -0.8, yPercent: -1.1, angle: -0.8, scaleY: 1.004 }
  ],
  place: [
    { xPercent: 0, yPercent: -1, angle: -1.2, scaleY: 1.01 },
    { xPercent: 0, yPercent: 2.5, angle: 1.7, scaleY: 0.965 },
    { xPercent: 0, yPercent: 5, angle: 0.6, scaleY: 0.935 },
    { xPercent: 0, yPercent: 0, angle: -0.4, scaleY: 1 }
  ],
  special: [
    { xPercent: 0, yPercent: 0, angle: -1.2, scaleY: 1 },
    { xPercent: -2.5, yPercent: -1, angle: -4.5, scaleY: 0.985 },
    { xPercent: -4, yPercent: -2, angle: -7.5, scaleY: 0.975 },
    { xPercent: 4.5, yPercent: -1, angle: 7.5, scaleY: 1.035 },
    { xPercent: 2, yPercent: 1.5, angle: 3.1, scaleY: 0.99 },
    { xPercent: 0, yPercent: 0, angle: -0.3, scaleY: 1 }
  ],
  damaged: [
    { xPercent: 5.5, yPercent: -1, angle: 4.8, scaleY: 0.96 },
    { xPercent: -2.5, yPercent: 2, angle: -2.5, scaleY: 1.035 },
    { xPercent: 0, yPercent: 0, angle: 0, scaleY: 1 }
  ],
  defeated: [
    { xPercent: 0, yPercent: 0, angle: 0, scaleY: 1 },
    { xPercent: -1, yPercent: 1, angle: -4, scaleY: 0.99 },
    { xPercent: -2, yPercent: 4, angle: -9, scaleY: 0.97 },
    { xPercent: -3, yPercent: 9, angle: -15, scaleY: 0.945 },
    { xPercent: -4, yPercent: 15, angle: -20, scaleY: 0.92 },
    { xPercent: -5, yPercent: 19, angle: -23, scaleY: 0.9 }
  ]
};

export const CHAMPION_ANIMATIONS: Record<CharacterClass, ChampionAnimationSet> = {
  dragon: animationSet('dragon'),
  wolf: animationSet('wolf'),
  frost: animationSet('frost'),
  veil: animationSet('veil'),
  skin: animationSet('skin'),
  stone: animationSet('stone'),
  raven: animationSet('raven'),
  beast: animationSet('beast')
};

function animationSet(id: CharacterClass): ChampionAnimationSet {
  const path = `assets/champions/runtime/production/${id}`;
  return {
    directional: {
      down: { textureKey: `champion-${id}`, path: `${path}/down.png` },
      right: { textureKey: `champion-${id}-motion-right`, path: `${path}/right.png` },
      up: { textureKey: `champion-${id}-motion-up`, path: `${path}/up.png` }
    },
    frameWidth: 256,
    frameHeight: 256,
    artTop: 34 / 256,
    artBaseline: 224 / 256,
    anchorX: 0.5,
    states: STATES
  };
}

export function getChampionAnimation(id: CharacterClass): ChampionAnimationSet {
  return CHAMPION_ANIMATIONS[id];
}

export function animationDurationMs(id: CharacterClass, state: ChampionAnimationState): number {
  const range = CHAMPION_ANIMATIONS[id].states[state];
  return (range.end - range.start + 1) * range.frameMs;
}
