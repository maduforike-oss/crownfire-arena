import type { CharacterClass } from '../utils/types';

export type ChampionAnimationState = 'idle' | 'walk' | 'place' | 'special' | 'damaged' | 'defeated';

export interface AnimationRange {
  start: number;
  end: number;
  frameMs: number;
  loop: boolean;
}

export interface ChampionAnimationSet {
  textureKey: string;
  path: string;
  frameWidth: number;
  frameHeight: number;
  states: Record<ChampionAnimationState, AnimationRange>;
}

const STATES: ChampionAnimationSet['states'] = {
  idle: { start: 0, end: 3, frameMs: 210, loop: true },
  walk: { start: 4, end: 9, frameMs: 82, loop: true },
  place: { start: 10, end: 13, frameMs: 76, loop: false },
  special: { start: 14, end: 19, frameMs: 78, loop: false },
  damaged: { start: 20, end: 22, frameMs: 82, loop: false },
  defeated: { start: 23, end: 28, frameMs: 92, loop: false }
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
  return {
    textureKey: `champion-${id}-runtime`,
    path: `assets/champions/runtime/${id}_animation.webp`,
    frameWidth: 160,
    frameHeight: 160,
    states: STATES
  };
}

export function getChampionAnimation(id: CharacterClass): ChampionAnimationSet {
  return CHAMPION_ANIMATIONS[id];
}
