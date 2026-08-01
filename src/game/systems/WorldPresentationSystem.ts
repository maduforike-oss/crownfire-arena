import Phaser from 'phaser';
import { PRESENTATION } from '../config/PresentationConfig';
import type { Player } from '../entities/Player';
import type { DeviceProfile } from './DeviceProfile';
import type { GridSystem } from './GridSystem';

/**
 * Enlarges the rendered world without changing grid coordinates or collision.
 * The HUD and touch rails remain in screen space while the arena follows the
 * local champion inside an aspect-safe mask.
 */
export class WorldPresentationSystem {
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly zoom: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly root: Phaser.GameObjects.Container,
    private readonly grid: GridSystem,
    profile: DeviceProfile
  ) {
    const targetTileBudget = profile.touch ? 78 : 64;
    const maxZoom = profile.touch ? 1.82 : 1.62;
    this.zoom = Phaser.Math.Clamp(targetTileBudget / grid.tileSize, 1.2, maxZoom);
    this.maskShape = new Phaser.GameObjects.Graphics(scene);
    this.maskShape.fillStyle(0xffffff, 1).fillRect(
      PRESENTATION.leftRailWidth,
      PRESENTATION.arenaTop,
      PRESENTATION.arenaWidth,
      PRESENTATION.arenaHeight
    );
    this.root.setMask(this.maskShape.createGeometryMask());
    this.root.setScale(this.zoom);
  }

  update(focus: Player, immediate = false): void {
    const boardLeft = this.grid.offsetX;
    const boardTop = this.grid.offsetY;
    const boardRight = boardLeft + this.grid.map.width * this.grid.tileSize;
    const boardBottom = boardTop + this.grid.map.height * this.grid.tileSize;
    const visibleWidth = PRESENTATION.arenaWidth / this.zoom;
    const visibleHeight = PRESENTATION.arenaHeight / this.zoom;
    const centerX = Phaser.Math.Clamp(
      focus.world.x,
      boardLeft + visibleWidth / 2,
      boardRight - visibleWidth / 2
    );
    const centerY = Phaser.Math.Clamp(
      focus.world.y,
      boardTop + visibleHeight / 2,
      boardBottom - visibleHeight / 2
    );
    const targetX = PRESENTATION.leftRailWidth + PRESENTATION.arenaWidth / 2 - centerX * this.zoom;
    const targetY = PRESENTATION.arenaTop + PRESENTATION.arenaHeight / 2 - centerY * this.zoom;
    const smoothing = immediate ? 1 : 0.14;
    this.root.x = Phaser.Math.Linear(this.root.x, targetX, smoothing);
    this.root.y = Phaser.Math.Linear(this.root.y, targetY, smoothing);
  }

  destroy(): void {
    this.root.clearMask(false);
    this.maskShape.destroy();
  }
}
