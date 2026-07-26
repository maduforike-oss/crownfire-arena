import Phaser from 'phaser';
import { MAPS } from '../config/Maps';
import { SESSION } from '../config/GameConfig';
import { menuButton } from '../ui/MenuButton';
import { addSceneBackdrop, addScreenTitle } from '../ui/ScenePresentation';

export class MapSelectScene extends Phaser.Scene {
  constructor() {
    super('MapSelectScene');
  }

  create(): void {
    addSceneBackdrop(this, { theme: 'frostkeep', alternateTheme: 'ashen', imageAlpha: 0.62, veilAlpha: 0.5 });
    this.add.image(640, 360, 'reference-arena-atlas').setDisplaySize(1180, 787).setAlpha(0.11);
    addScreenTitle(this, 'Choose Arena', 'EVERY KINGDOM CHANGES THE BATTLEFIELD, NOT THE RULES', 0x82e8ff);
    MAPS.forEach((map, i) => {
      const x = 190 + (i % 4) * 300;
      const y = 344;
      const selected = map.id === SESSION.map;
      const panel = this.add.rectangle(x, y, 276, 414, selected ? 0x202431 : 0x12141b, 0.95).setStrokeStyle(3, selected ? map.glow : 0x51463c, selected ? 1 : 0.75);
      const landscape = this.add.image(x, y - 112, `landscape-${map.id}`).setDisplaySize(250, 170);
      this.add.rectangle(x, y - 112, 250, 170, 0x000000, 0).setStrokeStyle(1, map.glow, 0.75);
      this.drawMiniBoard(x, y + 25, map.id, map.glow);
      this.add.text(x, y + 113, map.name, { fontFamily: 'Georgia', fontSize: '21px', color: '#f4ead2', align: 'center', wordWrap: { width: 246 } }).setOrigin(0.5);
      this.add.text(x, y + 160, map.theme, { fontFamily: 'Arial', fontSize: '13px', color: '#b5a995', align: 'center', wordWrap: { width: 240 } }).setOrigin(0.5);
      const zone = this.add.zone(x, y, 276, 414).setInteractive({ useHandCursor: true }).on('pointerover', () => {
        panel.setFillStyle(0x242531, 0.98);
        this.tweens.add({ targets: landscape, scaleX: 1.025, scaleY: 1.025, duration: 120 });
      }).on('pointerout', () => {
        panel.setFillStyle(selected ? 0x202431 : 0x12141b, 0.95);
        this.tweens.add({ targets: landscape, scaleX: 1, scaleY: 1, duration: 120 });
      }).on('pointerdown', () => {
        SESSION.map = map.id;
        this.scene.start('GameScene');
      });
      zone.setDepth(20);
    });
    menuButton(this, 640, 656, 'Back', () => this.scene.start('ModeSelectScene'), false, 270);
  }

  private drawMiniBoard(x: number, y: number, mapId: string, glow: number): void {
    const size = 17;
    for (let row = 0; row < 5; row += 1) {
      for (let col = 0; col < 7; col += 1) {
        const px = x - 51 + col * size;
        const py = y - 34 + row * size;
        const solid = row === 0 || col === 0 || row === 4 || col === 6 || (row % 2 === 0 && col % 2 === 0);
        const destructible = !solid && (row * 7 + col) % 3 === 0;
        const texture = solid ? `map-${mapId}-solid` : destructible ? `map-${mapId}-block` : `map-${mapId}-floor-${(row + col) % 3}`;
        this.add.image(px, py, texture).setDisplaySize(size, size);
        if (row === 2 && col === 3) this.add.image(px, py, `map-${mapId}-shrine`).setDisplaySize(size * 2.1, size * 2.1).setAlpha(0.75);
      }
    }
    this.add.rectangle(x, y, 136, 100, 0x000000, 0).setStrokeStyle(1, glow, 0.55);
  }
}
