import Phaser from 'phaser';
import { GAME_CONFIG } from '../config/GameConfig';
import type { MapDef } from '../config/Maps';
import { getMapTheme } from '../config/MapThemes';
import type { GridPosition } from '../utils/types';
import { keyOf, sameTile } from '../utils/math';
import type { GridSystem } from './GridSystem';

export interface RenderedMap {
  blockSprites: Map<string, Phaser.GameObjects.Container>;
  shrine: Phaser.GameObjects.Container;
}

interface Layers {
  tileLayer: Phaser.GameObjects.Container;
  objectLayer: Phaser.GameObjects.Container;
  effectLayer: Phaser.GameObjects.Container;
}

export class MapRenderer {
  constructor(private readonly scene: Phaser.Scene) {}

  render(grid: GridSystem, layers: Layers, shrineTile: GridPosition, debugSpawnSafe = false): RenderedMap {
    const theme = getMapTheme(grid.map.id);
    const boardBounds = this.boardBounds(grid);
    const blockSprites = new Map<string, Phaser.GameObjects.Container>();

    this.renderBackplate(grid.map, boardBounds);
    this.renderPremiumFloor(grid, layers.tileLayer, boardBounds);
    this.renderBorder(grid, layers.tileLayer);

    let shrine!: Phaser.GameObjects.Container;
    for (let y = 0; y < grid.map.height; y += 1) {
      for (let x = 0; x < grid.map.width; x += 1) {
        const pos = { x, y };
        const world = grid.toWorld(pos);
        const floorKey = `map-${grid.map.id}-floor-${this.floorVariant(grid.map.id, x, y)}`;
        const floor = this.scene.add.image(world.x, world.y, floorKey).setDisplaySize(grid.tileSize, grid.tileSize);
        if (this.scene.textures.exists(`map-${grid.map.id}-premium-floor`)) floor.setAlpha(0.025);
        layers.tileLayer.add(floor);

        if (grid.spawnReserved.has(keyOf(pos))) this.renderSpawnPad(grid, layers.tileLayer, pos, debugSpawnSafe);
        this.renderLowDecals(grid, layers.tileLayer, pos);

        if (sameTile(pos, shrineTile)) {
          shrine = this.renderShrine(grid, layers.tileLayer, pos);
        }

        const tile = grid.get(pos);
        if (tile === 'solid') {
          layers.objectLayer.add(this.renderSolid(grid, pos));
        } else if (tile === 'destructible') {
          const block = this.renderDestructible(grid, pos);
          blockSprites.set(keyOf(pos), block);
          layers.objectLayer.add(block);
        }
      }
    }

    this.renderAnimatedThemeDetails(grid, layers.effectLayer);
    this.renderAmbient(theme.accentColor, boardBounds, layers.effectLayer);
    return { blockSprites, shrine };
  }

  private renderBackplate(map: MapDef, bounds: Phaser.Geom.Rectangle): void {
    const theme = getMapTheme(map.id);
    this.scene.add.rectangle(GAME_CONFIG.width / 2, GAME_CONFIG.height / 2, GAME_CONFIG.width, GAME_CONFIG.height, 0x050508).setDepth(-5);
    this.scene.add.image(
      GAME_CONFIG.width / 2,
      GAME_CONFIG.height / 2,
      'reference-arena-atlas',
      `reference-${map.id}-board`
    ).setDisplaySize(1280, 960).setAlpha(0.22).setDepth(-4);
    this.scene.add.image(40, 360, 'reference-arena-atlas', `reference-${map.id}-landscape`)
      .setDisplaySize(475, 720)
      .setAlpha(0.68)
      .setDepth(-3);
    this.scene.add.image(GAME_CONFIG.width - 40, 360, 'reference-arena-atlas', `reference-${map.id}-landscape`)
      .setDisplaySize(475, 720)
      .setAlpha(0.68)
      .setDepth(-3)
      .setFlipX(true);
    this.scene.add.rectangle(130, 360, 260, 720, 0x050508, 0.36).setDepth(-3);
    this.scene.add.rectangle(GAME_CONFIG.width - 130, 360, 260, 720, 0x050508, 0.36).setDepth(-3);

    const glow = this.scene.add.rectangle(bounds.centerX, bounds.centerY, bounds.width + 70, bounds.height + 70, theme.accentColor, 0.08);
    glow.setDepth(-3);
    this.scene.tweens.add({ targets: glow, alpha: 0.14, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.inOut' });

    this.scene.add.rectangle(bounds.centerX, bounds.centerY, bounds.width + 44, bounds.height + 44, 0x09080c, 0.88)
      .setStrokeStyle(3, theme.accentColor, 0.38)
      .setDepth(-2);
    this.scene.add.rectangle(bounds.centerX, bounds.centerY, bounds.width + 16, bounds.height + 16, 0x08070b, 0.72)
      .setStrokeStyle(1, 0xd8a84e, 0.2)
      .setDepth(-1);
  }

  private renderPremiumFloor(grid: GridSystem, tileLayer: Phaser.GameObjects.Container, bounds: Phaser.Geom.Rectangle): void {
    const floorKey = `map-${grid.map.id}-premium-floor`;
    if (!this.scene.textures.exists(floorKey)) return;
    const floor = this.scene.add.image(bounds.centerX, bounds.centerY, floorKey)
      .setDisplaySize(bounds.width, bounds.height);
    tileLayer.add(floor);
    const glowKey = `map-${grid.map.id}-premium-floor-glow`;
    if (this.scene.textures.exists(glowKey)) {
      const glow = this.scene.add.image(bounds.centerX, bounds.centerY, glowKey)
        .setDisplaySize(bounds.width, bounds.height)
        .setBlendMode(Phaser.BlendModes.ADD)
        .setAlpha(0.045);
      tileLayer.add(glow);
      this.scene.tweens.add({
        targets: glow,
        alpha: 0.085,
        duration: 2200,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
    }
  }

  private renderBorder(grid: GridSystem, tileLayer: Phaser.GameObjects.Container): void {
    const key = `map-${grid.map.id}-border`;
    const start = grid.toWorld({ x: 0, y: 0 });
    const end = grid.toWorld({ x: grid.map.width - 1, y: grid.map.height - 1 });
    for (let x = start.x - 24; x <= end.x + 24; x += 96) {
      tileLayer.add(this.scene.add.image(x, start.y - 58, key).setDisplaySize(96, 48));
      tileLayer.add(this.scene.add.image(x, end.y + 62, key).setDisplaySize(96, 48).setFlipY(true));
    }
    for (let y = start.y - 26; y <= end.y + 38; y += 96) {
      tileLayer.add(this.scene.add.image(start.x - 58, y, key).setDisplaySize(96, 48).setAngle(-90));
      tileLayer.add(this.scene.add.image(end.x + 58, y, key).setDisplaySize(96, 48).setAngle(90));
    }
  }

  private renderSpawnPad(grid: GridSystem, tileLayer: Phaser.GameObjects.Container, pos: GridPosition, debug: boolean): void {
    const isCoreSpawn = grid.map.spawns.some((spawn) => sameTile(spawn, pos));
    if (!isCoreSpawn && !debug) return;
    const world = grid.toWorld(pos);
    const pad = this.scene.add.image(world.x, world.y, `map-${grid.map.id}-spawn`).setDisplaySize(50, 50);
    pad.setAlpha(isCoreSpawn ? 0.75 : 0.18);
    tileLayer.add(pad);
    if (debug) {
      tileLayer.add(this.scene.add.rectangle(world.x, world.y, grid.tileSize - 8, grid.tileSize - 8, grid.map.glow, 0.08)
        .setStrokeStyle(1, grid.map.glow, 0.28));
    }
  }

  private renderLowDecals(grid: GridSystem, tileLayer: Phaser.GameObjects.Container, pos: GridPosition): void {
    const world = grid.toWorld(pos);
    const theme = getMapTheme(grid.map.id);
    const hash = (pos.x * 37 + pos.y * 53 + grid.map.id.length * 11) % 29;
    if (hash === 0 || hash === 5) {
      tileLayer.add(this.scene.add.circle(world.x + 13, world.y - 12, 2.5, theme.accentColor, 0.16));
    }
    if (hash === 3) {
      tileLayer.add(this.scene.add.line(0, 0, world.x - 14, world.y + 10, world.x + 15, world.y - 2, theme.accentColor, 0.14).setLineWidth(2));
    }
    if (theme.factionTheme === 'moon' && hash === 9) {
      tileLayer.add(this.scene.add.circle(world.x + 7, world.y + 9, 4, 0x4b6f45, 0.28));
    }
    if (theme.factionTheme === 'frost' && hash === 11) {
      tileLayer.add(this.scene.add.line(0, 0, world.x - 15, world.y - 7, world.x + 14, world.y + 8, 0xd8f7ff, 0.18).setLineWidth(2));
    }
  }

  private renderShrine(grid: GridSystem, tileLayer: Phaser.GameObjects.Container, pos: GridPosition): Phaser.GameObjects.Container {
    const world = grid.toWorld(pos);
    const theme = getMapTheme(grid.map.id);
    const shrine = this.scene.add.container(world.x, world.y);
    const premiumKey = `map-${grid.map.id}-premium-shrine`;
    const premium = this.scene.textures.exists(premiumKey);
    if (premium) {
      shrine.add(this.scene.add.ellipse(0, 22, 138, 52, 0x000000, 0.42));
      const shrineSize = grid.map.id === 'ashen' ? 170 : 150;
      shrine.add(this.scene.add.image(0, -4, premiumKey).setDisplaySize(shrineSize, shrineSize));
    } else {
      shrine.add(this.scene.add.image(0, 0, `map-${grid.map.id}-shrine`).setDisplaySize(118, 118));
    }
    shrine.add(this.scene.add.circle(0, 0, 30, theme.accentColor, 0.08).setStrokeStyle(2, theme.accentColor, 0.42));
    tileLayer.add(shrine);
    this.scene.tweens.add({ targets: shrine, alpha: 0.72, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    return shrine;
  }

  private renderSolid(grid: GridSystem, pos: GridPosition): Phaser.GameObjects.Container {
    const world = grid.toWorld(pos);
    const theme = getMapTheme(grid.map.id);
    const wall = this.scene.add.container(world.x, world.y);
    const premiumKey = `map-${grid.map.id}-premium-solid`;
    const premium = this.scene.textures.exists(premiumKey);
    if (premium) {
      wall.add(this.scene.add.ellipse(0, 17, 53, 20, 0x000000, 0.5));
      const scale = grid.tileSize / GAME_CONFIG.tileSize;
      const wallSize = (grid.map.id === 'ashen' ? 76 : 64) * scale;
      const wallOffset = (grid.map.id === 'ashen' ? -10 : -5) * scale;
      wall.add(this.scene.add.image(0, wallOffset, premiumKey).setDisplaySize(wallSize, wallSize));
    } else {
      wall.add(this.scene.add.image(0, 0, `map-${grid.map.id}-solid`).setDisplaySize(53, 53));
    }
    if ((pos.x + pos.y) % 4 === 0) {
      wall.add(this.scene.add.circle(0, -12, 5, theme.accentColor, 0.24));
    }
    return wall;
  }

  private renderDestructible(grid: GridSystem, pos: GridPosition): Phaser.GameObjects.Container {
    const world = grid.toWorld(pos);
    const block = this.scene.add.container(world.x, world.y);
    const premiumKey = `map-${grid.map.id}-premium-block`;
    const premium = this.scene.textures.exists(premiumKey);
    if (premium) {
      block.add(this.scene.add.ellipse(0, 17, 51, 18, 0x000000, 0.44));
      const scale = grid.tileSize / GAME_CONFIG.tileSize;
      const blockSize = (grid.map.id === 'ashen' ? 70 : 58) * scale;
      const blockOffset = (grid.map.id === 'ashen' ? -7 : 0) * scale;
      block.add(this.scene.add.image(0, blockOffset, premiumKey).setDisplaySize(blockSize, blockSize));
    } else {
      block.add(this.scene.add.image(0, 0, `map-${grid.map.id}-block`).setDisplaySize(52, 52));
    }
    return block;
  }

  private renderAmbient(color: number, bounds: Phaser.Geom.Rectangle, effectLayer: Phaser.GameObjects.Container): void {
    for (let i = 0; i < 18; i += 1) {
      const x = Phaser.Math.Between(bounds.left + 10, bounds.right - 10);
      const y = Phaser.Math.Between(bounds.top + 10, bounds.bottom - 10);
      const mote = this.scene.add.circle(x, y, Phaser.Math.Between(1, 3), color, 0.14);
      effectLayer.add(mote);
      this.scene.tweens.add({
        targets: mote,
        y: y - Phaser.Math.Between(18, 42),
        alpha: 0.02,
        duration: Phaser.Math.Between(1800, 3600),
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
    }
  }

  private renderAnimatedThemeDetails(grid: GridSystem, effectLayer: Phaser.GameObjects.Container): void {
    const theme = getMapTheme(grid.map.id);
    const anchors: GridPosition[] = [
      { x: 1, y: 1 },
      { x: grid.map.width - 2, y: 1 },
      { x: 1, y: grid.map.height - 2 },
      { x: grid.map.width - 2, y: grid.map.height - 2 },
      { x: Math.floor(grid.map.width / 2), y: 1 },
      { x: Math.floor(grid.map.width / 2), y: grid.map.height - 2 }
    ];

    anchors.forEach((pos, index) => {
      const world = grid.toWorld(pos);
      const prop = this.scene.add.container(world.x, world.y);
      if (theme.factionTheme === 'ember') {
        prop.add(this.scene.add.rectangle(0, 8, 10, 18, 0x130c08, 0.9).setStrokeStyle(1, 0xd8a84e, 0.45));
        prop.add(this.scene.add.circle(0, -5, 8, theme.accentColor, 0.58));
        prop.add(this.scene.add.circle(0, -8, 4, 0xfff0a0, 0.72));
      } else if (theme.factionTheme === 'moon') {
        prop.add(this.scene.add.circle(0, 2, 13, 0x0d1420, 0.82).setStrokeStyle(2, theme.accentColor, 0.5));
        prop.add(this.scene.add.arc(1, -1, 8, 70, 290, false, theme.accentColor, 0).setStrokeStyle(3, theme.accentColor, 0.78));
      } else if (theme.factionTheme === 'frost') {
        prop.add(this.scene.add.triangle(0, -6, 0, -20, 12, 13, -12, 13, theme.accentColor, 0.62).setStrokeStyle(1, 0xe9fbff, 0.75));
        prop.add(this.scene.add.circle(0, 1, 14, theme.accentColor, 0.13));
      } else {
        prop.add(this.scene.add.circle(0, 0, 14, theme.accentColor, 0.12).setStrokeStyle(2, theme.accentColor, 0.48));
        prop.add(this.scene.add.arc(0, -2, 10, 60, 300, false, theme.accentColor, 0).setStrokeStyle(3, theme.accentColor, 0.8));
      }
      prop.setAlpha(index % 2 === 0 ? 0.76 : 0.54);
      effectLayer.add(prop);
      this.scene.tweens.add({
        targets: prop,
        alpha: index % 2 === 0 ? 0.38 : 0.82,
        scale: 1.12,
        duration: 900 + index * 130,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
    });
  }

  private boardBounds(grid: GridSystem): Phaser.Geom.Rectangle {
    const width = grid.map.width * grid.tileSize;
    const height = grid.map.height * grid.tileSize;
    return new Phaser.Geom.Rectangle(grid.offsetX, grid.offsetY, width, height);
  }

  private floorVariant(mapId: string, x: number, y: number): number {
    return (x * 3 + y * 5 + mapId.length * 7) % 8;
  }
}
