import Phaser from 'phaser';
import { SESSION } from '../config/GameConfig';
import { getCharacter } from '../config/Characters';
import { getArcadeWeapon } from '../config/ArcadeWeapons';
import { MAPS } from '../config/Maps';
import { AudioSystem } from '../systems/AudioSystem';

export class ArcadeLoadingScene extends Phaser.Scene {
  private leaving = false;

  constructor() {
    super('ArcadeLoadingScene');
  }

  init(): void {
    // Phaser reuses scene instances. Reset transition state for every rematch.
    this.leaving = false;
  }

  create(): void {
    this.cameras.main.resetFX();
    AudioSystem.get().startMusic('menu');
    const map = MAPS.find((item) => item.id === SESSION.map) ?? MAPS[0];
    const champion = getCharacter(SESSION.character);
    const weapon = getArcadeWeapon(champion.id);
    const first = this.add.image(640, 360, 'arcade-loading-wolves').setDisplaySize(1280, 720);
    const second = this.add.image(640, 360, 'arcade-loading-banquet').setDisplaySize(1280, 720).setAlpha(0);
    this.add.rectangle(640, 360, 1280, 720, 0x07080c, 0.24);
    this.add.rectangle(300, 360, 600, 720, 0x080910, 0.56);
    this.add.text(72, 92, 'ARMS OF THE CROWN', {
      fontFamily: 'Georgia, serif',
      fontStyle: 'bold',
      fontSize: '48px',
      color: '#ffe4a0',
      stroke: '#09070a',
      strokeThickness: 7
    });
    this.add.text(76, 160, 'A FRIENDLIER FIRE BETWEEN TRIALS', {
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      fontSize: '14px',
      color: '#bcdcff'
    }).setLetterSpacing(2);
    this.add.text(76, 238, `${champion.name}\n${weapon.name}`, {
      fontFamily: 'Georgia, serif',
      fontSize: '30px',
      color: '#f7ead0',
      lineSpacing: 9
    });
    this.add.text(76, 338, `${weapon.attackName}  |  ${weapon.signatureName}\n${map.name}`, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '17px',
      color: '#d6c8ad',
      lineSpacing: 10
    });
    this.add.text(76, 500, 'Strike with your champion weapon.\nBuild momentum. Claim the arena together.', {
      fontFamily: 'Georgia, serif',
      fontSize: '19px',
      color: '#f1dfba',
      lineSpacing: 8
    });
    const track = this.add.rectangle(76, 624, 430, 8, 0x11131b, 0.9).setOrigin(0, 0.5).setStrokeStyle(1, 0xd8a84e, 0.45);
    const fill = this.add.rectangle(78, 624, 4, 4, weapon.color, 1).setOrigin(0, 0.5);
    this.tweens.add({ targets: fill, displayWidth: 426, duration: 2600, ease: 'Linear' });
    this.tweens.add({ targets: second, alpha: 1, duration: 700, delay: 1050, ease: 'Sine.inOut' });
    this.tweens.add({ targets: first, alpha: 0, duration: 700, delay: 1050, ease: 'Sine.inOut' });
    this.add.text(76, 650, 'TAP TO ENTER EARLY', {
      fontFamily: 'Arial, sans-serif', fontStyle: 'bold', fontSize: '11px', color: '#a99d8b'
    }).setLetterSpacing(1);
    this.time.delayedCall(2600, () => this.enterArena());
    this.time.delayedCall(700, () => this.input.once('pointerdown', () => this.enterArena()));
    this.input.keyboard?.once('keydown-SPACE', () => this.enterArena());
    track.setDepth(5);
    fill.setDepth(6);
  }

  private enterArena(): void {
    if (this.leaving) return;
    this.leaving = true;
    this.cameras.main.fadeOut(180, 0, 0, 0);
    this.time.delayedCall(190, () => this.scene.start('GameScene'));
  }
}
