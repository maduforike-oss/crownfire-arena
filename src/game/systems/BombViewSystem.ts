import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { getBombTheme } from '../config/BombVisualThemes';
import type { Bomb } from '../entities/Bomb';
import type { GridSystem } from './GridSystem';
import type { ExplosionSystem } from './ExplosionSystem';
import { AudioSystem } from './AudioSystem';

interface BombView {
  group: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  ring: Phaser.GameObjects.Arc;
  spark: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  warnedStep: number;
}

export class BombViewSystem {
  private readonly views = new Map<string, BombView>();
  private readonly telegraphs: Phaser.GameObjects.GameObject[] = [];

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: GridSystem,
    private readonly objectLayer: Phaser.GameObjects.Container,
    private readonly explosionFx: ExplosionSystem
  ) {}

  add(bomb: Bomb): void {
    const world = this.grid.toWorld(bomb.grid);
    const theme = getBombTheme(bomb.themeId);
    const group = this.scene.add.container(world.x, world.y);
    const shadow = this.scene.add.ellipse(0, 15, 44, 15, 0x030308, 0.72);
    const ring = this.scene.add.circle(0, 3, 23, theme.blastColor, 0.13)
      .setStrokeStyle(2, theme.coreColor, 0.72)
      .setBlendMode(Phaser.BlendModes.ADD);
    const sprite = this.scene.add.image(0, 0, theme.idleTexture).setScale(1.04);
    const spark = this.scene.add.circle(13, -16, 4, theme.coreColor, 0.95)
      .setBlendMode(Phaser.BlendModes.ADD);
    const label = this.scene.add.text(0, -34, `${(bomb.remainingMs / 1000).toFixed(1)}`, {
      fontFamily: 'Georgia',
      fontSize: '13px',
      color: `#${theme.coreColor.toString(16).padStart(6, '0')}`,
      stroke: '#08080c',
      strokeThickness: 3
    }).setOrigin(0.5);
    group.add([shadow, ring, sprite, spark, label]);
    this.objectLayer.add(group);
    this.scene.tweens.add({ targets: sprite, scale: 1.12, duration: 240, yoyo: true, repeat: -1 });
    this.scene.tweens.add({
      targets: ring,
      scale: 1.24,
      alpha: 0.34,
      duration: 360,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
    this.scene.tweens.add({
      targets: spark,
      x: -13,
      y: -19,
      alpha: 0.3,
      duration: 320,
      yoyo: true,
      repeat: -1
    });
    this.views.set(bomb.id, { group, sprite, ring, spark, label, warnedStep: -1 });
  }

  update(bombs: Bomb[]): void {
    this.clearTelegraphs();
    const live = new Set(bombs.map((bomb) => bomb.id));
    for (const [id, view] of [...this.views]) {
      if (!live.has(id)) {
        this.destroyView(id, view);
      }
    }

    for (const bomb of bombs) {
      const view = this.views.get(bomb.id);
      if (!view) {
        this.add(bomb);
        continue;
      }
      const theme = getBombTheme(bomb.themeId);
      const urgency = bomb.remote ? 0 : 1 - bomb.remainingMs / GAME_CONFIG.bombFuseMs;
      view.sprite.setTint(bomb.remote ? 0xc050ff : urgency > 0.7 ? theme.tickTint : 0xffffff);
      view.ring.setStrokeStyle(urgency > 0.7 ? 3 : 2, bomb.remote ? 0xd28cff : theme.coreColor, 0.72 + urgency * 0.25);
      view.spark.setFillStyle(bomb.remote ? 0xd28cff : theme.coreColor, 0.95);
      view.label.setText(bomb.remote ? 'HEX' : `${Math.max(0, bomb.remainingMs / 1000).toFixed(1)}`);
      if (!bomb.remote && urgency >= 0.68) {
        const alpha = 0.22 + urgency * 0.3;
        this.telegraphs.push(...this.explosionFx.renderTelegraph(bomb.previewTiles, theme, alpha));
        if (view.warnedStep < 0 && bomb.remainingMs < 620) {
          view.warnedStep = 0;
          AudioSystem.get().sfx('tick');
        }
      }
    }
  }

  cleanup(): void {
    this.clearTelegraphs();
    for (const [id, view] of [...this.views]) this.destroyView(id, view);
  }

  private clearTelegraphs(): void {
    for (const item of this.telegraphs) item.destroy();
    this.telegraphs.length = 0;
  }

  private destroyView(id: string, view: BombView): void {
    for (const child of view.group.getAll()) this.scene.tweens.killTweensOf(child);
    view.group.destroy(true);
    this.views.delete(id);
  }
}
