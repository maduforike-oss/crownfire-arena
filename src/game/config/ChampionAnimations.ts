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
  sourceType: 'image' | 'spritesheet';
  frameWidth?: number;
  frameHeight?: number;
  artTop: number;
  artBaseline: number;
  anchorX: number;
  widthRatio: number;
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

const ART_LAYOUT: Record<CharacterClass, Pick<ChampionAnimationSet, 'artTop' | 'artBaseline' | 'anchorX' | 'widthRatio'>> = {
  dragon: { artTop: 68 / 1254, artBaseline: 1091 / 1254, anchorX: 0.5, widthRatio: 1 },
  wolf: { artTop: 115 / 1254, artBaseline: 1099 / 1254, anchorX: 0.61, widthRatio: 1 },
  frost: { artTop: 102 / 1254, artBaseline: 1084 / 1254, anchorX: 0.62, widthRatio: 1 },
  veil: { artTop: 87 / 1254, artBaseline: 1110 / 1254, anchorX: 0.54, widthRatio: 1 },
  skin: { artTop: 129 / 1254, artBaseline: 1077 / 1254, anchorX: 0.52, widthRatio: 1 },
  stone: { artTop: 99 / 1254, artBaseline: 1098 / 1254, anchorX: 0.55, widthRatio: 1 },
  raven: { artTop: 80 / 1254, artBaseline: 1088 / 1254, anchorX: 0.56, widthRatio: 1 },
  beast: { artTop: 127 / 1254, artBaseline: 1076 / 1254, anchorX: 0.5, widthRatio: 1 }
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
  const layout = ART_LAYOUT[id];
  return {
    textureKey: `champion-${id}-runtime`,
    path: `assets/champions/runtime/solid/${id}.png`,
    sourceType: 'image',
    ...layout,
    states: STATES
  };
}

export function getChampionAnimation(id: CharacterClass): ChampionAnimationSet {
  return CHAMPION_ANIMATIONS[id];
}
