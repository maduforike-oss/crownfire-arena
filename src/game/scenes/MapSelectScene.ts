import Phaser from 'phaser';
import { MAPS } from '../config/Maps';
import { SESSION } from '../config/GameConfig';
import { menuButton } from '../ui/MenuButton';
import { addSceneBackdrop, addScreenTitle } from '../ui/ScenePresentation';
import { NetworkSession } from '../network/NetworkSession';

export class MapSelectScene extends Phaser.Scene {
  constructor() {
    super('MapSelectScene');
  }

  create(): void {
    addSceneBackdrop(this, {
      theme: 'frostkeep',
      alternateTheme: 'moonfang',
      imageKey: 'menu-arena-select-hero',
      imageAlpha: 0.82,
      veilAlpha: 0.48
    });
    addScreenTitle(this, 'Choose Arena', 'EVERY KINGDOM CHANGES THE BATTLEFIELD, NOT THE RULES', 0x82e8ff);
    MAPS.forEach((map, i) => {
      const x = 190 + (i % 4) * 300;
      const y = 350;
      const selected = map.id === SESSION.map;
      const panel = this.add.rectangle(x, y, 276, 410, 0x0c0f17, 0.96)
        .setStrokeStyle(3, selected ? map.glow : 0x51463c, selected ? 1 : 0.8);
      const board = this.add.image(x, y - 95, 'reference-arena-atlas', `reference-${map.id}-board`)
        .setDisplaySize(268, 208)
        .setAlpha(selected ? 1 : 0.88);
      this.add.rectangle(x, y - 177, 268, 44, 0x05070b, 0.58);
      this.add.text(x, y - 177, map.name.toUpperCase(), {
        fontFamily: 'Arial',
        fontStyle: 'bold',
        fontSize: '11px',
        color: '#f7e3b1'
      }).setOrigin(0.5).setLetterSpacing(1);
      this.add.rectangle(x, y + 114, 268, 178, 0x07090f, 0.92);
      const landscape = this.add.image(x - 88, y + 116, 'reference-arena-atlas', `reference-${map.id}-landscape`)
        .setDisplaySize(76, 112)
        .setAlpha(selected ? 1 : 0.9);
      this.add.rectangle(x - 88, y + 116, 82, 118, 0x000000, 0)
        .setStrokeStyle(2, map.glow, 0.72);
      this.add.text(x + 36, y + 70, map.name, {
        fontFamily: 'Georgia',
        fontSize: '18px',
        color: '#f4ead2',
        align: 'center',
        wordWrap: { width: 168 }
      }).setOrigin(0.5);
      this.add.text(x + 36, y + 124, map.theme, {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: '#c7bda9',
        align: 'center',
        wordWrap: { width: 168 }
      }).setOrigin(0.5);
      this.add.text(x + 36, y + 178, selected ? 'SELECTED' : 'ENTER ARENA', {
        fontFamily: 'Arial',
        fontStyle: 'bold',
        fontSize: '10px',
        color: selected ? '#ffe39b' : '#9ec8ff'
      }).setOrigin(0.5).setLetterSpacing(1);
      const zone = this.add.zone(x, y, 276, 410).setInteractive({ useHandCursor: true }).on('pointerover', () => {
        panel.setStrokeStyle(3, map.glow, 1);
        landscape.setAlpha(1);
        board.setAlpha(1);
        this.tweens.add({ targets: [landscape, board], scaleX: 1.015, scaleY: 1.015, duration: 140 });
      }).on('pointerout', () => {
        panel.setStrokeStyle(3, selected ? map.glow : 0x51463c, selected ? 1 : 0.8);
        landscape.setAlpha(selected ? 1 : 0.9);
        board.setAlpha(selected ? 1 : 0.88);
        this.tweens.add({ targets: [landscape, board], scaleX: 1, scaleY: 1, duration: 140 });
      }).on('pointerdown', () => {
        SESSION.map = map.id;
        const network = NetworkSession.get();
        if (network.active && network.role === 'host') {
          network.startMatch({
            map: map.id,
            mode: SESSION.mode === 'shards' ? 'shards' : 'classic',
            hostCharacter: SESSION.character,
            guestCharacter: network.remoteCharacter
          });
        }
        this.scene.start('GameScene');
      });
      zone.setDepth(20);
    });
    menuButton(this, 640, 656, 'Back', () => this.scene.start('ModeSelectScene'), false, 270);
  }
}
