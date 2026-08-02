import Phaser from 'phaser';
import { POWER_UPS } from '../config/PowerUps';
import { CHAMPION_ANIMATIONS } from '../config/ChampionAnimations';
import { CHARACTERS } from '../config/Characters';
import { MAPS } from '../config/Maps';
import { BOMB_VISUAL_THEMES } from '../config/BombVisualThemes';
import { getMapTheme } from '../config/MapThemes';
import { DRAGON_ARCADE_FRAME_ASSETS } from '../config/DragonArcadeAnimations';
import { VEIL_ACTION_ASSETS } from '../config/VeilActionAnimations';

export class PreloadScene extends Phaser.Scene {
  constructor() {
    super('PreloadScene');
  }

  preload(): void {
    this.cameras.main.setBackgroundColor('#09080d');
    const title = this.add.text(640, 296, 'CROWDFIRE ARENA', {
      fontFamily: 'Georgia, serif',
      fontSize: '34px',
      color: '#f4d88a',
      stroke: '#08070b',
      strokeThickness: 5
    }).setOrigin(0.5);
    const status = this.add.text(640, 348, 'Opening the arena...', {
      fontFamily: 'Arial, sans-serif',
      fontSize: '16px',
      color: '#d9c9a4'
    }).setOrigin(0.5);
    const track = this.add.rectangle(640, 386, 420, 12, 0x211b26, 1).setStrokeStyle(1, 0xd8a84e, 0.8);
    const fill = this.add.rectangle(432, 386, 4, 8, 0xe56a32, 1).setOrigin(0, 0.5);

    this.load.on('progress', (progress: number) => {
      fill.width = Math.max(4, 416 * progress);
      status.setText(`Loading kingdom art ${Math.round(progress * 100)}%`);
    });
    this.load.once('complete', () => {
      title.destroy();
      status.destroy();
      track.destroy();
      fill.destroy();
    });

    this.load.image('reference-arena-atlas', 'assets/art/reference-arena-atlas.png');
    this.load.image('reference-character-power-atlas', 'assets/art/reference-character-power-atlas.png');
    this.load.image('champion-card-frame', 'assets/ui/champion_card_frame.png');
    this.load.image('champion-card-selected-frame', 'assets/ui/champion_card_selected_frame.png');
    this.load.image('menu-crownfire-hero', 'assets/menu/crownfire_hero.webp');
    this.load.image('menu-arena-select-hero', 'assets/menu/arena_select_hero.png');
    this.load.image('arcade-loading-wolves', 'assets/arcade/wolves-rest.webp');
    this.load.image('arcade-loading-banquet', 'assets/arcade/banquet.webp');
    this.load.image('map-ashen-premium-floor-glow', 'assets/maps/ashen/premium_floor_glow.webp');
    for (const character of CHARACTERS) this.load.image(character.assetKey, character.portraitPath);
    for (const animation of Object.values(CHAMPION_ANIMATIONS)) {
      this.load.image(animation.directional.right.textureKey, animation.directional.right.path);
      this.load.image(animation.directional.up.textureKey, animation.directional.up.path);
    }
    for (const frame of DRAGON_ARCADE_FRAME_ASSETS) this.load.image(frame.textureKey, frame.path);
    for (const action of VEIL_ACTION_ASSETS) {
      this.load.spritesheet(action.bodyTextureKey, action.bodyPath, { frameWidth: 256, frameHeight: 256 });
      this.load.spritesheet(action.vfxTextureKey, action.vfxPath, { frameWidth: 256, frameHeight: 256 });
    }
    for (const power of POWER_UPS) {
      if (power.iconPath) this.load.image(power.assetKey, power.iconPath);
    }
    for (const map of MAPS) {
      for (let i = 0; i < 3; i += 1) this.load.image(`map-${map.id}-floor-${i}`, `assets/maps/${map.id}/floor_${i}.png`);
      this.load.image(`map-${map.id}-solid`, `assets/maps/${map.id}/solid.png`);
      this.load.image(`map-${map.id}-block`, `assets/maps/${map.id}/destructible.png`);
      this.load.image(`map-${map.id}-spawn`, `assets/maps/${map.id}/spawn_pad.png`);
      this.load.image(`map-${map.id}-shrine`, `assets/maps/${map.id}/shrine.png`);
      this.load.image(`map-${map.id}-border`, `assets/maps/${map.id}/border.png`);
      this.load.image(`landscape-${map.id}`, `assets/maps/${map.id}/landscape.png`);
      this.load.image(`map-${map.id}-premium-floor`, `assets/maps/${map.id}/premium_floor_plate.webp`);
      this.load.image(`map-${map.id}-premium-solid`, `assets/maps/${map.id}/premium_solid.png`);
      this.load.image(`map-${map.id}-premium-block`, `assets/maps/${map.id}/premium_destructible.png`);
      this.load.image(`map-${map.id}-premium-shrine`, `assets/maps/${map.id}/premium_shrine.png`);
    }
  }

  create(): void {
    this.applyChampionTextureFiltering();
    this.makeReferenceArenaFrames();
    this.makeChampionFallback();
    this.makePowerFallback();
    this.makeBomb();
    this.makeBlast('blast-fire', 0xff6a2b, 0xffd56a);
    this.makeBlast('blast-frost', 0x6edfff, 0xe9fbff);
    for (const theme of Object.values(BOMB_VISUAL_THEMES)) {
      this.makeThemedBomb(theme.idleTexture, theme.tickTint, theme.coreColor, theme.decalEffect);
      this.makeThemedBlast(theme.explosionTexture, theme.blastColor, theme.coreColor, theme.decalEffect);
    }
    this.makeCircle('crown-shard', 0xd8a84e, 0xfff0a0, 13);
    this.makeCrownSurge();
    for (const map of MAPS) {
      if (!this.textures.exists(`landscape-${map.id}`)) this.makeLandscape(map.id, map.floor, map.wall, map.block, map.glow);
      if (!this.textures.exists(`map-${map.id}-floor-0`)) this.makeMapTextures(map.id, map.wall, map.block, map.glow);
      const theme = getMapTheme(map.id);
      for (let i = 3; i < theme.floorVariantCount; i += 1) {
        this.makeFloorTexture(`map-${map.id}-floor-${i}`, theme.floorTileVariants[i % theme.floorTileVariants.length], map.glow, theme.factionTheme, i);
      }
    }
    this.scene.start('MainMenuScene');
  }

  private applyChampionTextureFiltering(): void {
    for (const animation of Object.values(CHAMPION_ANIMATIONS)) {
      for (const asset of Object.values(animation.directional)) {
        if (this.textures.exists(asset.textureKey)) {
          this.textures.get(asset.textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      }
    }
    for (const frame of DRAGON_ARCADE_FRAME_ASSETS) {
      if (this.textures.exists(frame.textureKey)) {
        this.textures.get(frame.textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
      }
    }
    for (const action of VEIL_ACTION_ASSETS) {
      for (const textureKey of [action.bodyTextureKey, action.vfxTextureKey]) {
        if (this.textures.exists(textureKey)) {
          this.textures.get(textureKey).setFilter(Phaser.Textures.FilterMode.NEAREST);
        }
      }
    }
  }

  private makeReferenceArenaFrames(): void {
    const texture = this.textures.get('reference-arena-atlas');
    const frames = {
      ashen: {
        board: { x: 8, y: 8, width: 472, height: 366 },
        landscape: { x: 497, y: 17, width: 254, height: 357 }
      },
      moonfang: {
        board: { x: 775, y: 8, width: 491, height: 366 },
        landscape: { x: 1292, y: 17, width: 237, height: 357 }
      },
      frostkeep: {
        board: { x: 8, y: 393, width: 472, height: 390 },
        landscape: { x: 496, y: 394, width: 256, height: 388 }
      },
      hollowmoon: {
        board: { x: 775, y: 394, width: 488, height: 390 },
        landscape: { x: 1273, y: 394, width: 256, height: 388 }
      }
    } as const;

    Object.entries(frames).forEach(([mapId, pair]) => {
      Object.entries(pair).forEach(([kind, frame]) => {
        const name = `reference-${mapId}-${kind}`;
        if (!texture.has(name)) texture.add(name, 0, frame.x, frame.y, frame.width, frame.height);
      });
    });
  }

  private makeCircle(key: string, fill: number, stroke: number, radius: number): void {
    const g = this.add.graphics();
    g.fillStyle(fill, 1).fillCircle(radius, radius, radius - 2);
    g.lineStyle(3, stroke, 1).strokeCircle(radius, radius, radius - 4);
    g.generateTexture(key, radius * 2, radius * 2);
    g.destroy();
  }

  private makeBomb(): void {
    const g = this.add.graphics();
    g.fillStyle(0x110d14, 1).fillCircle(24, 24, 21);
    g.lineStyle(4, 0xe56a32, 1).strokeCircle(24, 24, 17);
    g.lineStyle(2, 0xffd56a, 0.8);
    g.beginPath();
    g.moveTo(24, 8);
    g.lineTo(31, 24);
    g.lineTo(24, 40);
    g.lineTo(17, 24);
    g.closePath();
    g.strokePath();
    g.fillStyle(0xff8a3d, 0.9).fillCircle(24, 24, 4);
    g.generateTexture('rune-bomb', 48, 48);
    g.destroy();
  }

  private makeThemedBomb(key: string, edge: number, core: number, motif: string): void {
    const g = this.add.graphics();
    g.fillStyle(0x0f0d13, 1).fillCircle(24, 24, 21);
    g.fillStyle(edge, 0.18).fillCircle(24, 24, 22);
    g.lineStyle(4, edge, 1).strokeCircle(24, 24, 17);
    g.fillStyle(core, 0.95).fillCircle(24, 24, 5);
    g.lineStyle(2, core, 0.85);
    if (motif === 'claws') {
      g.lineBetween(14, 31, 20, 14).lineBetween(24, 33, 24, 13).lineBetween(34, 31, 28, 14);
    } else if (motif === 'feathers') {
      g.lineBetween(15, 30, 34, 13).lineBetween(25, 34, 32, 14);
    } else if (motif === 'frost') {
      g.lineBetween(24, 8, 24, 40).lineBetween(10, 24, 38, 24).lineBetween(14, 14, 34, 34).lineBetween(34, 14, 14, 34);
    } else if (motif === 'moon') {
      g.strokeCircle(21, 23, 10); g.fillStyle(0x0f0d13, 1).fillCircle(26, 20, 10);
    } else if (motif === 'stone') {
      g.strokeRect(14, 14, 20, 20); g.lineBetween(24, 12, 34, 24).lineBetween(34, 24, 24, 36).lineBetween(24, 36, 14, 24).lineBetween(14, 24, 24, 12);
    } else {
      g.moveTo(24, 8).lineTo(33, 24).lineTo(24, 40).lineTo(15, 24).lineTo(24, 8).strokePath();
    }
    g.generateTexture(key, 48, 48);
    g.destroy();
  }

  private makeBlast(key: string, fill: number, core: number): void {
    const g = this.add.graphics();
    g.fillStyle(fill, 0.9).fillCircle(28, 28, 24);
    g.fillStyle(core, 0.95).fillCircle(28, 28, 12);
    g.lineStyle(3, core, 0.65).strokeCircle(28, 28, 22);
    for (let i = 0; i < 8; i += 1) {
      const angle = (Math.PI * 2 * i) / 8;
      g.lineStyle(3, core, 0.7).lineBetween(28, 28, 28 + Math.cos(angle) * 26, 28 + Math.sin(angle) * 26);
    }
    g.generateTexture(key, 56, 56);
    g.destroy();
  }

  private makeThemedBlast(key: string, fill: number, core: number, motif: string): void {
    const g = this.add.graphics();
    g.fillStyle(fill, 0.86).fillCircle(28, 28, 24);
    g.fillStyle(core, 0.96).fillCircle(28, 28, 10);
    g.lineStyle(3, core, 0.65).strokeCircle(28, 28, 22);
    const rays = motif === 'stone' ? 4 : motif === 'claws' ? 3 : 8;
    for (let i = 0; i < rays; i += 1) {
      const angle = (Math.PI * 2 * i) / rays;
      g.lineStyle(motif === 'claws' ? 5 : 3, core, 0.72).lineBetween(28, 28, 28 + Math.cos(angle) * 27, 28 + Math.sin(angle) * 27);
    }
    if (motif === 'feathers') {
      g.fillStyle(core, 0.8).fillTriangle(16, 36, 37, 12, 31, 40);
    }
    g.generateTexture(key, 56, 56);
    g.destroy();
  }

  private makePowerFallback(): void {
    const g = this.add.graphics();
    g.fillStyle(0x101018, 1).fillRoundedRect(0, 0, 42, 42, 7);
    g.lineStyle(2, 0xd8a84e, 1).strokeRoundedRect(3, 3, 36, 36, 7);
    g.fillStyle(0xd8a84e, 1).fillCircle(21, 21, 9);
    g.generateTexture('power-fallback', 42, 42);
    g.destroy();
  }

  private makeChampionFallback(): void {
    const g = this.add.graphics();
    g.fillStyle(0x000000, 0.25).fillEllipse(32, 62, 38, 13);
    g.fillStyle(0x30273a, 1).fillRoundedRect(18, 24, 28, 38, 6);
    g.lineStyle(3, 0xd8a84e, 1).strokeRoundedRect(18, 24, 28, 38, 6);
    g.fillStyle(0x30273a, 1).fillCircle(32, 19, 13);
    g.lineStyle(2, 0xd8a84e, 1).strokeCircle(32, 19, 11);
    g.generateTexture('champion-fallback', 64, 76);
    g.destroy();
  }

  private makeCrownSurge(): void {
    const g = this.add.graphics();
    g.fillStyle(0x08070b, 0).fillRect(0, 0, 64, 64);
    g.fillStyle(0xfff0a0, 0.28).fillCircle(32, 32, 30);
    g.lineStyle(3, 0xffffff, 0.82).strokeCircle(32, 32, 23);
    g.fillStyle(0xffd55f, 0.96);
    g.fillPoints([
      new Phaser.Geom.Point(32, 6),
      new Phaser.Geom.Point(39, 24),
      new Phaser.Geom.Point(58, 24),
      new Phaser.Geom.Point(43, 36),
      new Phaser.Geom.Point(49, 57),
      new Phaser.Geom.Point(32, 44),
      new Phaser.Geom.Point(15, 57),
      new Phaser.Geom.Point(21, 36),
      new Phaser.Geom.Point(6, 24),
      new Phaser.Geom.Point(25, 24)
    ], true);
    g.lineStyle(2, 0xffffff, 0.85).strokeTriangle(20, 42, 32, 20, 44, 42);
    g.fillStyle(0xffffff, 0.9).fillCircle(32, 32, 4);
    g.generateTexture('power-crownSurge', 64, 64);
    g.destroy();
  }

  private makeLandscape(key: string, floor: number, wall: number, block: number, glow: number): void {
    const g = this.add.graphics();
    g.fillStyle(floor, 1).fillRoundedRect(0, 0, 220, 132, 8);
    g.fillStyle(wall, 1).fillRect(0, 84, 220, 48);
    g.fillStyle(block, 0.9).fillRect(24, 54, 30, 30).fillRect(145, 44, 38, 40);
    g.lineStyle(2, glow, 0.8).strokeRoundedRect(8, 8, 204, 116, 8);
    g.fillStyle(glow, 0.16).fillCircle(68, 52, 42).fillCircle(170, 38, 26);
    g.lineStyle(3, glow, 0.45).lineBetween(0, 95, 220, 80).lineBetween(35, 132, 84, 86).lineBetween(150, 132, 120, 78);
    if (key === 'hollowmoon') {
      g.fillStyle(0xa974ff, 0.28).fillCircle(110, 44, 30);
      g.lineStyle(3, 0xd9b8ff, 0.5).strokeCircle(110, 44, 20);
    }
    g.generateTexture(`landscape-${key}`, 220, 132);
    g.destroy();
  }

  private makeMapTextures(mapId: string, wall: number, block: number, glow: number): void {
    const theme = getMapTheme(mapId);
    theme.floorTileVariants.forEach((color, index) => this.makeFloorTexture(`map-${mapId}-floor-${index}`, color, glow, theme.factionTheme, index));
    this.makeSolidTexture(`map-${mapId}-solid`, wall, glow, theme.factionTheme);
    this.makeBlockTexture(`map-${mapId}-block`, block, glow, theme.factionTheme);
    this.makeShrineTexture(`map-${mapId}-shrine`, glow, theme.factionTheme);
  }

  private makeFloorTexture(key: string, color: number, glow: number, faction: string, variant: number): void {
    const g = this.add.graphics();
    g.fillStyle(color, 1).fillRect(0, 0, 48, 48);
    g.fillStyle(0xffffff, 0.025).fillRect(3, 3, 42, 20);
    g.lineStyle(2, 0x07070b, 0.82).strokeRect(1, 1, 46, 46);
    g.lineStyle(1, 0xffffff, 0.075).lineBetween(4, 5, 44, 4).lineBetween(5, 6, 4, 44);
    g.lineStyle(1, 0x000000, 0.34).lineBetween(4, 25, 44, 24).lineBetween(24, 4, 23, 44);
    g.lineStyle(1, 0x000000, 0.2).lineBetween(7, 40, 14, 35).lineBetween(36, 11, 43, 15);
    if (variant % 2 === 0) g.lineStyle(2, glow, faction === 'ember' ? 0.28 : 0.16).lineBetween(8, 37, 20, 23).lineBetween(20, 23, 39, 17);
    if (variant % 3 === 0) g.fillStyle(0x000000, 0.2).fillCircle(12, 13, 4).fillCircle(37, 35, 3);
    if (faction === 'moon') {
      g.lineStyle(2, glow, 0.18).strokeCircle(36, 14, 6);
      g.fillStyle(color, 1).fillCircle(39, 12, 6);
    }
    if (faction === 'frost') g.lineStyle(1, 0xd8f7ff, 0.18).lineBetween(8, 12, 22, 18).lineBetween(22, 18, 38, 14);
    if (faction === 'veil') g.fillStyle(glow, 0.1).fillCircle(35, 34, 7);
    for (let i = 0; i < 8; i += 1) {
      const px = (i * 17 + variant * 11) % 42 + 3;
      const py = (i * 29 + variant * 7) % 42 + 3;
      g.fillStyle(i % 3 === 0 ? glow : 0xffffff, i % 3 === 0 ? 0.09 : 0.04).fillCircle(px, py, i % 2 === 0 ? 1 : 2);
    }
    g.generateTexture(key, 48, 48);
    g.destroy();
  }

  private makeSolidTexture(key: string, color: number, glow: number, faction: string): void {
    const g = this.add.graphics();
    g.fillStyle(0x07070b, 0.95).fillRect(2, 5, 44, 40);
    g.fillStyle(color, 1).fillRect(4, 2, 40, 39);
    g.lineStyle(2, 0x111017, 1).strokeRect(4, 2, 40, 39);
    g.lineStyle(1, 0xffffff, 0.08).lineBetween(8, 7, 40, 6);
    g.lineStyle(2, 0x000000, 0.24).lineBetween(8, 18, 40, 18).lineBetween(22, 5, 22, 40);
    if (faction === 'frost') g.fillStyle(glow, 0.35).fillTriangle(34, 4, 43, 18, 28, 16);
    else if (faction === 'moon') g.fillStyle(glow, 0.22).fillCircle(24, 20, 5);
    else if (faction === 'veil') g.fillStyle(glow, 0.18).fillCircle(24, 19, 9);
    else g.fillStyle(glow, 0.3).fillCircle(14, 13, 4);
    g.generateTexture(key, 48, 48);
    g.destroy();
  }

  private makeBlockTexture(key: string, color: number, glow: number, faction: string): void {
    const g = this.add.graphics();
    g.fillStyle(0x08080c, 0.35).fillRect(5, 8, 38, 36);
    g.fillStyle(color, 1).fillRect(6, 5, 36, 35);
    g.lineStyle(2, 0x09080c, 0.9).strokeRect(6, 5, 36, 35);
    g.lineStyle(2, glow, 0.34).lineBetween(13, 12, 25, 24).lineBetween(25, 24, 35, 18);
    g.lineStyle(1, 0xffffff, 0.09).lineBetween(10, 10, 38, 9);
    if (faction === 'ember') g.fillStyle(0xff5b2b, 0.42).fillCircle(30, 27, 4);
    if (faction === 'moon') g.fillStyle(0x4f6d47, 0.42).fillCircle(15, 30, 5);
    if (faction === 'frost') g.lineStyle(2, 0xd8f7ff, 0.3).lineBetween(12, 32, 36, 14);
    if (faction === 'veil') g.fillStyle(glow, 0.16).fillCircle(24, 22, 10);
    g.generateTexture(key, 48, 48);
    g.destroy();
  }

  private makeShrineTexture(key: string, glow: number, faction: string): void {
    const g = this.add.graphics();
    g.fillStyle(0x09080c, 0.72).fillCircle(48, 48, 44);
    g.lineStyle(4, glow, 0.8).strokeCircle(48, 48, 34);
    g.lineStyle(2, glow, 0.65).strokeCircle(48, 48, 22);
    if (faction === 'moon') {
      g.strokeCircle(48, 48, 13);
      g.fillStyle(0x09080c, 1).fillCircle(54, 43, 13);
    } else if (faction === 'frost') {
      g.lineBetween(48, 20, 48, 76).lineBetween(22, 48, 74, 48).lineBetween(30, 30, 66, 66).lineBetween(66, 30, 30, 66);
    } else if (faction === 'veil') {
      g.lineBetween(48, 20, 62, 48).lineBetween(62, 48, 48, 76).lineBetween(48, 76, 34, 48).lineBetween(34, 48, 48, 20);
    } else {
      g.lineBetween(48, 20, 66, 48).lineBetween(66, 48, 48, 76).lineBetween(48, 76, 30, 48).lineBetween(30, 48, 48, 20);
    }
    g.generateTexture(key, 96, 96);
    g.destroy();
  }
}
