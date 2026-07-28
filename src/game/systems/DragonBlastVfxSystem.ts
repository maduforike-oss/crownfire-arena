import Phaser from 'phaser';
import type { GridPosition } from '../utils/types';
import type { GridSystem } from './GridSystem';

const OUTER_COLOR = 0xff5a20;
const EDGE_COLOR = 0xffad42;
const CORE_COLOR = 0xfff3c4;

export class DragonBlastVfxSystem {
  constructor(
    private readonly scene: Phaser.Scene,
    private readonly grid: GridSystem,
    private readonly effectLayer: Phaser.GameObjects.Container
  ) {}

  telegraph(origin: GridPosition, tiles: GridPosition[], direction: GridPosition): Phaser.GameObjects.Container[] {
    const originWorld = this.grid.toWorld(origin);
    const groups: Phaser.GameObjects.Container[] = [];
    const source = this.scene.add.container(originWorld.x, originWorld.y);
    source.add([
      this.scene.add.circle(0, 0, 25, OUTER_COLOR, 0.08).setStrokeStyle(3, EDGE_COLOR, 0.88),
      this.scene.add.circle(0, 0, 13, CORE_COLOR, 0.08).setStrokeStyle(2, CORE_COLOR, 0.72),
      this.makeArrow(0, 0, direction, EDGE_COLOR, 0.92, 18)
    ]);
    this.effectLayer.add(source);
    this.scene.tweens.add({
      targets: source,
      scale: 1.18,
      alpha: 0.62,
      duration: 150,
      yoyo: true,
      repeat: 1,
      ease: 'Sine.inOut'
    });
    groups.push(source);

    tiles.forEach((tile, index) => {
      const world = this.grid.toWorld(tile);
      const group = this.scene.add.container(world.x, world.y).setAlpha(0.3);
      const horizontal = direction.x !== 0;
      const lane = this.scene.add.rectangle(
        0,
        0,
        horizontal ? this.grid.tileSize - 5 : 13,
        horizontal ? 13 : this.grid.tileSize - 5,
        OUTER_COLOR,
        0.18
      ).setStrokeStyle(2, EDGE_COLOR, 0.82);
      const core = this.scene.add.rectangle(
        0,
        0,
        horizontal ? this.grid.tileSize - 14 : 4,
        horizontal ? 4 : this.grid.tileSize - 14,
        CORE_COLOR,
        0.62
      ).setBlendMode(Phaser.BlendModes.ADD);
      const arrow = this.makeArrow(0, 0, direction, CORE_COLOR, 0.92, 13);
      group.add([lane, core, arrow]);
      this.effectLayer.add(group);
      this.scene.tweens.add({
        targets: group,
        alpha: 0.82,
        scale: 1.04,
        delay: index * 34,
        duration: 120,
        yoyo: true,
        repeat: 1,
        ease: 'Quad.inOut'
      });
      groups.push(group);
    });
    return groups;
  }

  fire(origin: GridPosition, tiles: GridPosition[], direction: GridPosition): void {
    if (!tiles.length) return;
    const source = this.grid.toWorld(origin);
    const end = this.grid.toWorld(tiles[tiles.length - 1]);
    const horizontal = direction.x !== 0;
    const reach = Math.abs(horizontal ? end.x - source.x : end.y - source.y) + this.grid.tileSize * 0.72;
    const mouth = {
      x: source.x + direction.x * 16,
      y: source.y + direction.y * 16
    };

    const flare = this.scene.add.circle(mouth.x, mouth.y, 14, CORE_COLOR, 0.82)
      .setStrokeStyle(6, OUTER_COLOR, 0.78)
      .setBlendMode(Phaser.BlendModes.ADD);
    const glow = this.makeBeam(mouth, reach, direction, 38, OUTER_COLOR, 0.54);
    const edge = this.makeBeam(mouth, reach, direction, 22, EDGE_COLOR, 0.68);
    const core = this.makeBeam(mouth, reach, direction, 8, CORE_COLOR, 0.98);
    glow.setBlendMode(Phaser.BlendModes.ADD);
    edge.setBlendMode(Phaser.BlendModes.ADD);
    core.setBlendMode(Phaser.BlendModes.ADD);
    this.effectLayer.add([glow, edge, core, flare]);

    const scaleAxis = horizontal ? 'scaleX' : 'scaleY';
    glow.setScale(horizontal ? 0.02 : 1, horizontal ? 1 : 0.02);
    edge.setScale(horizontal ? 0.02 : 1, horizontal ? 1 : 0.02);
    core.setScale(horizontal ? 0.02 : 1, horizontal ? 1 : 0.02);
    this.scene.tweens.add({
      targets: [glow, edge, core],
      [scaleAxis]: 1,
      duration: 170,
      ease: 'Cubic.easeOut'
    });
    this.scene.tweens.add({
      targets: flare,
      scale: 2.2,
      alpha: 0,
      duration: 260,
      ease: 'Cubic.easeOut',
      onComplete: () => flare.destroy()
    });

    const head = this.makeArrow(mouth.x, mouth.y, direction, CORE_COLOR, 0.98, 25)
      .setStrokeStyle(3, OUTER_COLOR, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD);
    this.effectLayer.add(head);
    this.scene.tweens.add({
      targets: head,
      x: end.x + direction.x * 17,
      y: end.y + direction.y * 17,
      scale: 1.3,
      duration: 175,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        this.scene.tweens.add({
          targets: head,
          alpha: 0,
          scale: 1.8,
          duration: 150,
          onComplete: () => head.destroy()
        });
      }
    });

    tiles.forEach((tile, index) => this.spawnHeatRibbon(tile, direction, index * 22));
    this.scene.cameras.main.shake(170, 0.007);
    this.scene.tweens.add({
      targets: [glow, edge, core],
      alpha: 0,
      delay: 170,
      duration: 250,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        glow.destroy();
        edge.destroy();
        core.destroy();
      }
    });
  }

  private makeBeam(
    origin: { x: number; y: number },
    length: number,
    direction: GridPosition,
    thickness: number,
    color: number,
    alpha: number
  ): Phaser.GameObjects.Rectangle {
    const horizontal = direction.x !== 0;
    const beam = this.scene.add.rectangle(
      origin.x,
      origin.y,
      horizontal ? length : thickness,
      horizontal ? thickness : length,
      color,
      alpha
    );
    if (horizontal) beam.setOrigin(direction.x > 0 ? 0 : 1, 0.5);
    else beam.setOrigin(0.5, direction.y > 0 ? 0 : 1);
    return beam;
  }

  private makeArrow(
    x: number,
    y: number,
    direction: GridPosition,
    color: number,
    alpha: number,
    size: number
  ): Phaser.GameObjects.Triangle {
    if (direction.x !== 0) {
      return this.scene.add.triangle(
        x,
        y,
        -size * direction.x * 0.48,
        -size * 0.58,
        size * direction.x,
        0,
        -size * direction.x * 0.48,
        size * 0.58,
        color,
        alpha
      );
    }
    return this.scene.add.triangle(
      x,
      y,
      -size * 0.58,
      -size * direction.y * 0.48,
      0,
      size * direction.y,
      size * 0.58,
      -size * direction.y * 0.48,
      color,
      alpha
    );
  }

  private spawnHeatRibbon(tile: GridPosition, direction: GridPosition, delay: number): void {
    const world = this.grid.toWorld(tile);
    const horizontal = direction.x !== 0;
    for (const offset of [-11, 11]) {
      const x = world.x + (horizontal ? 0 : offset);
      const y = world.y + (horizontal ? offset : 0);
      const ribbon = this.scene.add.ellipse(
        x - direction.x * 12,
        y - direction.y * 12,
        horizontal ? 25 : 8,
        horizontal ? 8 : 25,
        offset < 0 ? OUTER_COLOR : EDGE_COLOR,
        0
      ).setBlendMode(Phaser.BlendModes.ADD);
      this.effectLayer.add(ribbon);
      this.scene.tweens.add({
        targets: ribbon,
        x: x + direction.x * 20,
        y: y + direction.y * 20,
        alpha: 0.72,
        scale: 1.45,
        delay,
        duration: 120,
        yoyo: true,
        ease: 'Quad.easeOut',
        onComplete: () => ribbon.destroy()
      });
    }
    const scorch = this.scene.add.rectangle(
      world.x,
      world.y,
      horizontal ? this.grid.tileSize - 12 : 5,
      horizontal ? 5 : this.grid.tileSize - 12,
      0xff7a2d,
      0
    );
    this.effectLayer.add(scorch);
    this.scene.tweens.add({
      targets: scorch,
      alpha: 0.46,
      delay,
      duration: 90,
      yoyo: true,
      hold: 120,
      onComplete: () => scorch.destroy()
    });
  }
}
