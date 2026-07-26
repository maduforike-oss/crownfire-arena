import Phaser from 'phaser';
import { menuButton } from '../ui/MenuButton';
import { SESSION } from '../config/GameConfig';
import { loadSave } from '../utils/storage';
import { AudioSystem } from '../systems/AudioSystem';
import { PRESENTATION } from '../config/PresentationConfig';
import { addPanel, addSceneBackdrop, addScreenTitle } from '../ui/ScenePresentation';
import { getCharacter } from '../config/Characters';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    AudioSystem.get().startMusic('menu');
    this.input.once('pointerdown', () => AudioSystem.get().startMusic('menu'));
    addSceneBackdrop(this, { theme: 'ashen', alternateTheme: 'frostkeep', imageAlpha: 0.88, veilAlpha: 0.22, particles: 44 });
    this.add.image(PRESENTATION.width / 2, 350, 'reference-arena-atlas').setDisplaySize(1120, 747).setAlpha(0.17).setDepth(-12);
    addScreenTitle(this, 'Crownfire Arena', 'CLAIM THE FALLEN CROWN  |  SURVIVE THE RUNE WAR', 0xf06a31).setY(92);
    addPanel(this, 640, 438, 408, 430, 0xd8a84e, 0.88);
    const save = loadSave();
    this.add.text(640, 248, `CROWNS  ${save.crowns}     VICTORIES  ${save.wins}`, {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '14px', color: '#9ec8ff'
    }).setOrigin(0.5);
    menuButton(this, 640, 322, 'Enter the Arena', () => this.scene.start('CharacterSelectScene'), false, 340);
    menuButton(this, 640, 388, 'Rune Guide', () => this.scene.start('PowerUpGuideScene'), false, 340);
    menuButton(this, 640, 454, 'How to Play', () => this.showHow(), false, 340);
    menuButton(this, 640, 520, AudioSystem.get().isMuted() ? 'Audio Off' : 'Audio On', () => {
      AudioSystem.get().toggleMute();
      this.scene.restart();
    }, false, 340);
    menuButton(this, 640, 584, 'Controller Setup', () => this.scene.start('ControllerSetupScene'), false, 340);
    this.add.text(640, 626, 'iPad: Share menu  >  Add to Home Screen', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '12px', color: '#c8b889'
    }).setOrigin(0.5);

    const selected = getCharacter(SESSION.character);
    const champion = this.add.image(220, 438, selected.assetKey).setDisplaySize(300, 300).setDepth(3);
    const championGlow = this.add.circle(220, 430, 138, selected.accentColor, 0.1).setStrokeStyle(3, selected.accentColor, 0.35);
    this.tweens.add({ targets: champion, y: 428, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: championGlow, scale: 1.08, alpha: 0.18, duration: 1200, yoyo: true, repeat: -1 });
    this.add.text(220, 604, selected.displayName, {
      fontFamily: 'Georgia', fontSize: '22px', color: '#ffe1a0', stroke: '#08080c', strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(1060, 604, 'Four kingdoms await', {
      fontFamily: 'Georgia', fontSize: '22px', color: '#bad7ff', stroke: '#08080c', strokeThickness: 4
    }).setOrigin(0.5);
    this.add.text(640, 682, `${SESSION.localPlayers} PLAYER  |  ${SESSION.mode.toUpperCase()}  |  ${SESSION.map.toUpperCase()}`, {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '13px', color: '#c1b28f'
    }).setOrigin(0.5);
  }

  private showHow(): void {
    this.scene.launch('ResultsScene', {
      title: 'How to Play',
      reason: 'Move with WASD, arrows, touch, or a paired controller.\nPlace rune bombs and escape their straight-line blasts.\nBreak cursed blocks to reveal runes and power-ups.\nControl the centre shrine for Crown Shards and rare runes.\nUse Shift for your champion special; E detonates Remote Hex bombs.',
      won: true,
      crowns: 0,
      total: loadSave().crowns,
      menuOnly: true
    });
  }
}
