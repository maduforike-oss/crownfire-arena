import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import { getBombTheme } from '../config/BombVisualThemes';
import type { Bomb } from '../entities/Bomb';
import type { GridSystem } from './GridSystem';
import type { ExplosionSystem } from './ExplosionSystem';
import { AudioSystem } from './AudioSystem';

interface BombView {
  sprite: Phaser.GameObjects.Image;
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
    const sprite = this.scene.add.image(world.x, world.y, theme.idleTexture).setScale(0.95);
    const label = this.scene.add.text(world.x, world.y - 32, `${(bomb.remainingMs / 1000).toFixed(1)}`, {
      fontFamily: 'Georgia',
      fontSize: '13px',
      color: `#${theme.coreColor.toString(16).padStart(6, '0')}`,
      stroke: '#08080c',
      strokeThickness: 3
    }).setOrigin(0.5);
    this.objectLayer.add(sprite);
    this.objectLayer.add(label);
    this.scene.tweens.add({ targets: sprite, scale: 1.12, duration: 240, yoyo: true, repeat: -1 });
    this.views.set(bomb.id, { sprite, label, warnedStep: -1 });
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
      const urgency = 1 - bomb.remainingMs / GAME_CONFIG.bombFuseMs;
      view.sprite.setTint(bomb.remote ? 0xc050ff : urgency > 0.7 ? theme.tickTint : 0xffffff);
      view.label.setText(bomb.remote ? 'HEX' : `${Math.max(0, bomb.remainingMs / 1000).toFixed(1)}`);
      if (urgency >= 0.68) {
        const alpha = 0.22 + urgency * 0.3;
        this.telegraphs.push(...this.explosionFx.renderTelegraph(bomb.previewTiles, theme, alpha));
        const step = Math.floor(bomb.remainingMs / 150);
        if (step !== view.warnedStep && bomb.remainingMs < 720) {
          view.warnedStep = step;
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
    this.scene.tweens.killTweensOf(view.sprite);
    view.sprite.destroy();
    view.label.destroy();
    this.views.delete(id);
  }
}
