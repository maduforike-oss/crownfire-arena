import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { GridSystem } from './GridSystem';
import type { GridPosition } from '../utils/types';
import type { VeilActionKind } from '../config/VeilActionAnimations';

export class VeilActionVfxSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: GridSystem,
    private readonly layer: Phaser.GameObjects.Container
  ) {}

  cast(actor: Player, kind: VeilActionKind, target: GridPosition, windupMs: number): void {
    const origin = this.lanternOrigin(actor);
    const destination = this.grid.toWorld(target);
    const color = kind === 'signature' ? 0xe8d9ff : kind === 'secondary' ? 0xc98cff : 0xb96dff;
    const glow = this.scene.add.circle(origin.x, origin.y, 7, color, 0.18)
      .setStrokeStyle(2, 0xf2e8ff, 0.92)
      .setDepth(36);
    const wisp = this.scene.add.circle(origin.x, origin.y, 4, 0xf4edff, 0.96)
      .setStrokeStyle(2, color, 0.82)
      .setDepth(37);
    const ribbon = this.scene.add.line(
      0,
      0,
      origin.x,
      origin.y,
      destination.x,
      destination.y,
      color,
      0.42
    ).setOrigin(0, 0).setLineWidth(kind === 'primary' ? 3 : 2).setDepth(35);
    const marker = this.scene.add.ellipse(
      destination.x,
      destination.y + this.grid.tileSize * 0.22,
      this.grid.tileSize * 0.58,
      this.grid.tileSize * 0.26,
      color,
      0.08
    ).setStrokeStyle(3, color, 0.86).setDepth(34);
    const sigil = this.scene.add.star(
      destination.x,
      destination.y + this.grid.tileSize * 0.2,
      kind === 'signature' ? 8 : 6,
      3,
      kind === 'signature' ? 10 : 8,
      0xf0e3ff,
      0.62
    ).setDepth(35);
    this.layer.add([ribbon, marker, sigil, glow, wisp]);

    const travelMs = Math.max(90, windupMs);
    this.scene.tweens.add({
      targets: glow,
      scale: 1.65,
      alpha: 0,
      duration: travelMs,
      ease: 'Cubic.easeOut'
    });
    this.scene.tweens.add({
      targets: wisp,
      x: destination.x,
      y: destination.y + this.grid.tileSize * 0.2,
      duration: travelMs,
      ease: 'Sine.easeInOut'
    });
    this.scene.tweens.add({
      targets: [marker, sigil],
      scale: kind === 'signature' ? 1.2 : 1.1,
      alpha: 0.96,
      duration: travelMs,
      ease: 'Sine.easeOut'
    });
    this.scene.time.delayedCall(travelMs, () => {
      ribbon.destroy();
      glow.destroy();
      this.scene.tweens.add({
        targets: [marker, sigil, wisp],
        alpha: 0,
        scale: 1.42,
        duration: kind === 'signature' ? 420 : 260,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          marker.destroy();
          sigil.destroy();
          wisp.destroy();
        }
      });
    });
  }

  private lanternOrigin(actor: Player): Phaser.Types.Math.Vector2Like {
    const horizontal = actor.lastDir.x < 0 ? -1 : 1;
    return {
      x: actor.world.x + horizontal * 23,
      y: actor.world.y - 3
    };
  }
}
