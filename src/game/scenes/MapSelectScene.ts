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
    addSceneBackdrop(this, { theme: 'frostkeep', alternateTheme: 'moonfang', imageAlpha: 0.68, veilAlpha: 0.62 });
    addScreenTitle(this, 'Choose Arena', 'EVERY KINGDOM CHANGES THE BATTLEFIELD, NOT THE RULES', 0x82e8ff);
    MAPS.forEach((map, i) => {
      const x = 190 + (i % 4) * 300;
      const y = 344;
      const selected = map.id === SESSION.map;
      const panel = this.add.rectangle(x, y, 276, 414, 0x10121a, 0.98)
        .setStrokeStyle(3, selected ? map.glow : 0x51463c, selected ? 1 : 0.8);
      const landscape = this.add.image(x, y, 'reference-arena-atlas', `reference-${map.id}-landscape`)
        .setDisplaySize(270, 408)
        .setAlpha(selected ? 0.92 : 0.78);
      this.add.rectangle(x, y - 176, 270, 54, 0x07080d, 0.52);
      this.add.text(x, y - 176, map.name.toUpperCase(), {
        fontFamily: 'Arial',
        fontStyle: 'bold',
        fontSize: '11px',
        color: '#f7e3b1'
      }).setOrigin(0.5).setLetterSpacing(1);
      this.add.rectangle(x, y + 119, 270, 164, 0x07080d, 0.86);
      const board = this.add.image(x, y + 52, 'reference-arena-atlas', `reference-${map.id}-board`)
        .setDisplaySize(126, 96);
      this.add.rectangle(x, y + 52, 130, 100, 0x000000, 0).setStrokeStyle(2, map.glow, 0.72);
      this.add.text(x, y + 119, map.name, {
        fontFamily: 'Georgia',
        fontSize: '20px',
        color: '#f4ead2',
        align: 'center',
        wordWrap: { width: 246 }
      }).setOrigin(0.5);
      this.add.text(x, y + 162, map.theme, {
        fontFamily: 'Arial',
        fontSize: '12px',
        color: '#c7bda9',
        align: 'center',
        wordWrap: { width: 238 }
      }).setOrigin(0.5);
      const zone = this.add.zone(x, y, 276, 414).setInteractive({ useHandCursor: true }).on('pointerover', () => {
        panel.setStrokeStyle(3, map.glow, 1);
        landscape.setAlpha(0.96);
        this.tweens.add({ targets: [landscape, board], scaleX: 1.018, scaleY: 1.018, duration: 140 });
      }).on('pointerout', () => {
        panel.setStrokeStyle(3, selected ? map.glow : 0x51463c, selected ? 1 : 0.8);
        landscape.setAlpha(selected ? 0.92 : 0.78);
        this.tweens.add({ targets: [landscape, board], scaleX: 1, scaleY: 1, duration: 140 });
      }).on('pointerdown', () => {
        SESSION.map = map.id;
        this.scene.start('GameScene');
      });
      zone.setDepth(20);
    });
    menuButton(this, 640, 656, 'Back', () => this.scene.start('ModeSelectScene'), false, 270);
  }
}
