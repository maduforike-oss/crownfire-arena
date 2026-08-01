import type { Direction } from '../utils/types';

export type DragonArcadeActionKind = 'primary' | 'signature';
export type DragonArcadeFacing = Exclude<Direction, 'none'>;

export interface DragonArcadeFrame {
  textureKey: string;
  path: string;
  phase: string;
  durationMs: number;
}

interface FramePhase {
  file: string;
  phase: string;
  durationMs: number;
}

const FACINGS: DragonArcadeFacing[] = ['down', 'right', 'up', 'left'];

const CINDER_CUT: FramePhase[] = [
  { file: '00-wind-up.png', phase: 'wind-up', durationMs: 170 },
  { file: '01-contact.png', phase: 'contact', durationMs: 130 },
  { file: '02-follow-through.png', phase: 'follow-through', durationMs: 150 },
  { file: '03-recovery.png', phase: 'recovery', durationMs: 250 }
];

const DRAGON_BLAST: FramePhase[] = [
  { file: '00-aim-wind-up.png', phase: 'aim-wind-up', durationMs: 260 },
  { file: '01-charged-telegraph.png', phase: 'charged-telegraph', durationMs: 260 },
  { file: '02-release.png', phase: 'release', durationMs: 120 },
  { file: '03-travel.png', phase: 'travel', durationMs: 360 },
  { file: '04-recoil-recovery.png', phase: 'recoil-recovery', durationMs: 320 }
];

const ACTIONS: Record<DragonArcadeActionKind, Record<DragonArcadeFacing, DragonArcadeFrame[]>> = {
  primary: buildAction('cinder-cut', CINDER_CUT),
  signature: buildAction('dragon-blast', DRAGON_BLAST)
};

export const DRAGON_ARCADE_FRAME_ASSETS = Object.values(ACTIONS)
  .flatMap((directions) => Object.values(directions))
  .flat();

export function getDragonArcadeFrames(
  kind: DragonArcadeActionKind,
  facing: DragonArcadeFacing
): readonly DragonArcadeFrame[] {
  return ACTIONS[kind][facing];
}

function buildAction(
  action: 'cinder-cut' | 'dragon-blast',
  phases: FramePhase[]
): Record<DragonArcadeFacing, DragonArcadeFrame[]> {
  return Object.fromEntries(FACINGS.map((facing) => [
    facing,
    phases.map((phase, index) => ({
      textureKey: `dragon-arcade-${action}-${facing}-${index}`,
      path: `assets/arcade/actions/dragon/${action}/${facing}/${phase.file}`,
      phase: phase.phase,
      durationMs: phase.durationMs
    }))
  ])) as Record<DragonArcadeFacing, DragonArcadeFrame[]>;
}
