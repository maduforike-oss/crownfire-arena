import Phaser from 'phaser';
import { PRESENTATION } from '../config/PresentationConfig';
import type { GridSystem } from './GridSystem';

/**
 * Fits the complete logical arena into the presentation window. Gameplay is
 * never cropped or player-tracked: every board edge and actor remains visible.
 */
export class WorldPresentationSystem {
  private readonly maskShape: Phaser.GameObjects.Graphics;
  private readonly scale: number;

  constructor(
    private readonly scene: Phaser.Scene,
    private readonly root: Phaser.GameObjects.Container,
    private readonly grid: GridSystem
  ) {
    const boardWidth = grid.map.width * grid.tileSize;
    const boardHeight = grid.map.height * grid.tileSize;
    this.scale = Math.min(
      1,
      PRESENTATION.arenaWidth / boardWidth,
      PRESENTATION.arenaHeight / boardHeight
    );
    this.maskShape = new Phaser.GameObjects.Graphics(scene);
    this.maskShape.fillStyle(0xffffff, 1).fillRect(
      PRESENTATION.leftRailWidth,
      PRESENTATION.arenaTop,
      PRESENTATION.arenaWidth,
      PRESENTATION.arenaHeight
    );
    this.root.setMask(this.maskShape.createGeometryMask());
    this.root.setScale(this.scale);
    this.fitWholeBoard();
  }

  update(): void {
    // Kept as an explicit invariant in case another presentation system moves
    // the root: matches always snap back to the complete-board overview.
    this.fitWholeBoard();
  }

  private fitWholeBoard(): void {
    const boardCenterX = this.grid.offsetX + this.grid.map.width * this.grid.tileSize / 2;
    const boardCenterY = this.grid.offsetY + this.grid.map.height * this.grid.tileSize / 2;
    this.root.setPosition(
      PRESENTATION.leftRailWidth + PRESENTATION.arenaWidth / 2 - boardCenterX * this.scale,
      PRESENTATION.arenaTop + PRESENTATION.arenaHeight / 2 - boardCenterY * this.scale
    );
  }

  destroy(): void {
    this.root.clearMask(false);
    this.maskShape.destroy();
  }
}
