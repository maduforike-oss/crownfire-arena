import Phaser from 'phaser';
import { menuButton } from '../ui/MenuButton';
import { SESSION } from '../config/GameConfig';
import { loadSave } from '../utils/storage';
import { AudioSystem } from '../systems/AudioSystem';
import { PRESENTATION } from '../config/PresentationConfig';
import { addPanel } from '../ui/ScenePresentation';

export class MainMenuScene extends Phaser.Scene {
  constructor() {
    super('MainMenuScene');
  }

  create(): void {
    const inviteRoom = new URLSearchParams(window.location.search).get('join');
    if (inviteRoom) {
      this.scene.start('MultiplayerLobbyScene');
      return;
    }
    AudioSystem.get().startMusic('menu');
    this.input.once('pointerdown', () => AudioSystem.get().startMusic('menu'));
    this.cameras.main.fadeIn(320, 0, 0, 0);
    const hero = this.add.image(PRESENTATION.width / 2, PRESENTATION.height / 2, 'menu-crownfire-hero')
      .setDisplaySize(PRESENTATION.width, PRESENTATION.height)
      .setDepth(-20);
    this.add.rectangle(640, 360, 620, 720, 0x06070b, 0.34).setDepth(-18);
    this.add.rectangle(640, 660, 1280, 120, 0x05060a, 0.36).setDepth(-17);
    this.tweens.add({
      targets: hero,
      scale: 1.018,
      duration: 9000,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });

    this.add.text(640, 70, 'Crowdfire Arena', {
      fontFamily: 'Georgia, serif',
      fontSize: '52px',
      color: '#ffe39b',
      stroke: '#09070a',
      strokeThickness: 8
    }).setOrigin(0.5);
    this.add.text(640, 128, 'CLAIM THE FALLEN CROWN', {
      fontFamily: 'Arial, sans-serif',
      fontStyle: 'bold',
      fontSize: '15px',
      color: '#f7c56f'
    }).setOrigin(0.5).setLetterSpacing(2);
    addPanel(this, 640, 414, 402, 492, 0xd8a84e, 0.91);
    const save = loadSave();
    this.add.text(640, 210, `CROWNS  ${save.crowns}     VICTORIES  ${save.wins}`, {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '14px', color: '#9ec8ff'
    }).setOrigin(0.5);
    menuButton(this, 640, 274, 'Enter the Arena', () => this.scene.start('CharacterSelectScene'), false, 338);
    menuButton(this, 640, 336, 'Online Rumble', () => this.scene.start('MultiplayerLobbyScene'), false, 338);
    menuButton(this, 640, 398, 'Rivalry Chronicle', () => this.scene.start('SocialHubScene'), false, 338);
    menuButton(this, 640, 460, 'Rune Guide', () => this.scene.start('PowerUpGuideScene'), false, 338);
    menuButton(this, 640, 522, 'How to Play', () => this.showHow(), false, 338);
    menuButton(this, 640, 584, AudioSystem.get().isMuted() ? 'Audio Off' : 'Audio On', () => {
      AudioSystem.get().toggleMute();
      this.scene.restart();
    }, false, 338);
    menuButton(this, 1060, 666, 'Controller Setup', () => this.scene.start('ControllerSetupScene'), false, 230);
    this.add.text(640, 635, 'iPad: Share menu  >  Add to Home Screen', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '12px', color: '#c8b889'
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
