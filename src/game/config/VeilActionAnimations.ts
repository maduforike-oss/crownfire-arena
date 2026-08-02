import type { Direction } from '../utils/types';

export type VeilActionKind = 'primary' | 'secondary' | 'signature';
export type VeilActionFacing = Exclude<Direction, 'none'>;

export interface VeilActionAsset {
  bodyTextureKey: string;
  vfxTextureKey: string;
  bodyPath: string;
  vfxPath: string;
  framesPerDirection: number;
}

export interface VeilActionFrame {
  bodyTextureKey: string;
  bodyFrame: number;
  vfxTextureKey: string;
  vfxFrame: number;
  durationMs: number;
}

interface VeilActionDefinition extends VeilActionAsset {
  sourceTimingsMs: readonly number[];
  releaseFrame: number;
}

const FACINGS: readonly VeilActionFacing[] = ['down', 'right', 'up', 'left'];
const ROOT = 'assets/arcade/actions/veil';

const DEFINITIONS: Record<VeilActionKind, VeilActionDefinition> = {
  primary: action('lantern-lash', 5, [160, 80, 120, 140, 240], 2),
  secondary: action('wisp-seal', 5, [280, 180, 130, 220, 340], 2),
  signature: action('veil-lantern-ghost-veil', 6, [480, 260, 140, 260, 260, 520], 2)
};

export const VEIL_ACTION_ASSETS: readonly VeilActionAsset[] = Object.values(DEFINITIONS);

export function getVeilActionFrames(
  kind: VeilActionKind,
  facing: VeilActionFacing,
  windupMs: number,
  recoveryMs: number
): readonly VeilActionFrame[] {
  const definition = DEFINITIONS[kind];
  const directionIndex = FACINGS.indexOf(facing);
  const durations = fitActionTimings(definition, windupMs, recoveryMs);
  return durations.map((durationMs, phaseIndex) => {
    const frame = directionIndex * definition.framesPerDirection + phaseIndex;
    return {
      bodyTextureKey: definition.bodyTextureKey,
      bodyFrame: frame,
      vfxTextureKey: definition.vfxTextureKey,
      vfxFrame: frame,
      durationMs
    };
  });
}

function action(
  id: string,
  framesPerDirection: number,
  sourceTimingsMs: readonly number[],
  releaseFrame: number
): VeilActionDefinition {
  return {
    bodyTextureKey: `veil-action-${id}-body`,
    vfxTextureKey: `veil-action-${id}-vfx`,
    bodyPath: `${ROOT}/body/${id}.png`,
    vfxPath: `${ROOT}/vfx/${id}.png`,
    framesPerDirection,
    sourceTimingsMs,
    releaseFrame
  };
}

function fitActionTimings(
  definition: VeilActionDefinition,
  windupMs: number,
  recoveryMs: number
): number[] {
  const beforeRelease = definition.sourceTimingsMs.slice(0, definition.releaseFrame);
  const afterRelease = definition.sourceTimingsMs.slice(definition.releaseFrame);
  return [
    ...scaleTimings(beforeRelease, windupMs),
    ...scaleTimings(afterRelease, recoveryMs)
  ];
}

function scaleTimings(source: readonly number[], targetMs: number): number[] {
  if (!source.length) return [];
  const safeTarget = Math.max(source.length, Math.round(targetMs));
  const sourceTotal = source.reduce((sum, duration) => sum + duration, 0);
  let assigned = 0;
  return source.map((duration, index) => {
    if (index === source.length - 1) return safeTarget - assigned;
    const scaled = Math.max(1, Math.round(safeTarget * duration / sourceTotal));
    assigned += scaled;
    return scaled;
  });
}
