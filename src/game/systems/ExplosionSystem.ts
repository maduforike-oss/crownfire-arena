import Phaser from 'phaser';
import type { GridPosition } from '../utils/types';
import type { GridSystem } from './GridSystem';
import type { BombVisualTheme } from '../config/BombVisualThemes';
import { GAME_CONFIG } from '../config/GameConfig';

export class ExplosionSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: GridSystem,
    private readonly effectLayer: Phaser.GameObjects.Container
  ) {}

  renderExplosion(tiles: GridPosition[], theme: BombVisualTheme): void {
    this.scene.cameras.main.shake(120, theme.screenShakeIntensity);
    const centerKey = this.centerKey(tiles);
    for (const tile of tiles) {
      const w = this.grid.toWorld(tile);
      const isCenter = `${tile.x},${tile.y}` === centerKey;
      const underlay = this.scene.add.rectangle(w.x, w.y, GAME_CONFIG.tileSize + 4, GAME_CONFIG.tileSize + 4, theme.blastColor, isCenter ? 0.4 : 0.26)
        .setStrokeStyle(2, theme.coreColor, 0.75);
      this.effectLayer.add(underlay);
      const sprite = this.scene.add.image(w.x, w.y, theme.explosionTexture).setAlpha(0.98);
      sprite.setDisplaySize(GAME_CONFIG.tileSize + 6, GAME_CONFIG.tileSize + 6);
      this.effectLayer.add(sprite);
      this.renderMotif(w.x, w.y, theme, isCenter);
      this.spawnParticles(w.x, w.y, theme);
      this.scene.tweens.add({
        targets: [sprite, underlay],
        alpha: 0,
        scale: 1.35,
        duration: GAME_CONFIG.explosionMs,
        ease: 'Cubic.easeOut',
        onComplete: () => {
          sprite.destroy();
          underlay.destroy();
        }
      });
    }
  }

  renderTelegraph(tiles: GridPosition[], theme: BombVisualTheme, alpha: number): Phaser.GameObjects.GameObject[] {
    const centerKey = this.centerKey(tiles);
    return tiles.map((tile) => {
      const w = this.grid.toWorld(tile);
      const isCenter = `${tile.x},${tile.y}` === centerKey;
      const group = this.scene.add.container(w.x, w.y);
      const rect = this.scene.add.rectangle(0, 0, GAME_CONFIG.tileSize - 6, GAME_CONFIG.tileSize - 6, theme.blastColor, Math.max(alpha, 0.18))
        .setStrokeStyle(isCenter ? 3 : 2, theme.coreColor, 0.92);
      const crossA = this.scene.add.line(0, 0, -17, 0, 17, 0, theme.coreColor, 0.85).setLineWidth(isCenter ? 4 : 3);
      const crossB = this.scene.add.line(0, 0, 0, -17, 0, 17, theme.coreColor, 0.85).setLineWidth(isCenter ? 4 : 3);
      const ring = this.scene.add.circle(0, 0, isCenter ? 18 : 12, theme.coreColor, 0).setStrokeStyle(2, theme.coreColor, 0.85);
      group.add([rect, crossA, crossB, ring]);
      this.renderTelegraphMotif(group, theme);
      this.effectLayer.add(group);
      this.scene.tweens.add({ targets: group, alpha: 0.48, scale: 1.08, duration: 180, yoyo: true, repeat: -1 });
      return group;
    });
  }

  private spawnParticles(x: number, y: number, theme: BombVisualTheme): void {
    const count = theme.decalEffect === 'stone' ? 4 : 7;
    for (let i = 0; i < count; i += 1) {
      const p = this.scene.add.circle(x, y, Phaser.Math.Between(2, 4), theme.fuseParticles, 0.82);
      this.effectLayer.add(p);
      this.scene.tweens.add({
        targets: p,
        x: x + Phaser.Math.Between(-24, 24),
        y: y + Phaser.Math.Between(-24, 24),
        alpha: 0,
        duration: 360,
        onComplete: () => p.destroy()
      });
    }
  }

  private renderMotif(x: number, y: number, theme: BombVisualTheme, isCenter: boolean): void {
    const lineWidth = isCenter ? 5 : 3;
    if (theme.decalEffect === 'claws') {
      for (const off of [-9, 0, 9]) {
        const slash = this.scene.add.line(0, 0, x - 16 + off, y + 17, x + 7 + off, y - 17, theme.coreColor, 0.82).setLineWidth(lineWidth);
        this.effectLayer.add(slash);
        this.scene.tweens.add({ targets: slash, alpha: 0, duration: GAME_CONFIG.explosionMs, onComplete: () => slash.destroy() });
      }
      return;
    }
    if (theme.decalEffect === 'feathers' || theme.decalEffect === 'mist') {
      const swirl = this.scene.add.circle(x, y, isCenter ? 26 : 20, theme.coreColor, 0).setStrokeStyle(3, theme.coreColor, 0.75);
      this.effectLayer.add(swirl);
      this.scene.tweens.add({ targets: swirl, angle: 160, alpha: 0, scale: 1.35, duration: GAME_CONFIG.explosionMs, onComplete: () => swirl.destroy() });
      return;
    }
    const rayA = this.scene.add.line(0, 0, x - 22, y, x + 22, y, theme.coreColor, 0.78).setLineWidth(lineWidth);
    const rayB = this.scene.add.line(0, 0, x, y - 22, x, y + 22, theme.coreColor, 0.78).setLineWidth(lineWidth);
    this.effectLayer.add(rayA);
    this.effectLayer.add(rayB);
    this.scene.tweens.add({ targets: [rayA, rayB], alpha: 0, duration: GAME_CONFIG.explosionMs, onComplete: () => { rayA.destroy(); rayB.destroy(); } });
  }

  private renderTelegraphMotif(group: Phaser.GameObjects.Container, theme: BombVisualTheme): void {
    if (theme.decalEffect === 'moon') {
      group.add(this.scene.add.arc(0, 0, 13, 70, 290, false, theme.coreColor, 0).setStrokeStyle(3, theme.coreColor, 0.9));
    } else if (theme.decalEffect === 'frost') {
      group.add(this.scene.add.line(0, 0, -15, -15, 15, 15, theme.coreColor, 0.85).setLineWidth(2));
      group.add(this.scene.add.line(0, 0, 15, -15, -15, 15, theme.coreColor, 0.85).setLineWidth(2));
    } else if (theme.decalEffect === 'claws') {
      group.add(this.scene.add.line(0, 0, -12, 14, 9, -14, theme.coreColor, 0.9).setLineWidth(3));
      group.add(this.scene.add.line(0, 0, 0, 15, 16, -12, theme.coreColor, 0.8).setLineWidth(3));
    } else if (theme.decalEffect === 'feathers') {
      group.add(this.scene.add.triangle(0, 0, -4, 13, 14, -12, 8, 15, theme.coreColor, 0.42));
    } else {
      group.add(this.scene.add.circle(0, 0, 9, theme.coreColor, 0).setStrokeStyle(2, theme.coreColor, 0.75));
    }
  }

  private centerKey(tiles: GridPosition[]): string {
    const byNeighbours = tiles
      .map((tile) => ({
        tile,
        links: tiles.filter((other) => Math.abs(other.x - tile.x) + Math.abs(other.y - tile.y) === 1).length
      }))
      .sort((a, b) => b.links - a.links)[0]?.tile ?? tiles[0];
    return byNeighbours ? `${byNeighbours.x},${byNeighbours.y}` : '';
  }
}
