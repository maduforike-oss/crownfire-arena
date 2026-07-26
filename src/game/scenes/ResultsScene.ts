import Phaser from 'phaser';
import { menuButton } from '../ui/MenuButton';
import { addPanel, addSceneBackdrop, addScreenTitle } from '../ui/ScenePresentation';
import { SESSION } from '../config/GameConfig';
import { getCharacter } from '../config/Characters';
import { AudioSystem } from '../systems/AudioSystem';

interface ResultsData {
  title?: string;
  won: boolean;
  reason: string;
  crowns: number;
  total: number;
  kills?: number;
  shards?: number;
  time?: number;
  menuOnly?: boolean;
}

export class ResultsScene extends Phaser.Scene {
  private dataIn!: ResultsData;

  constructor() {
    super('ResultsScene');
  }

  init(data: ResultsData): void {
    this.dataIn = data;
  }

  create(): void {
    const d = this.dataIn;
    AudioSystem.get().startMusic(d.menuOnly ? 'menu' : 'results', SESSION.map);
    addSceneBackdrop(this, { theme: d.won ? 'ashen' : 'hollowmoon', alternateTheme: SESSION.map as 'ashen' | 'moonfang' | 'frostkeep' | 'hollowmoon', imageAlpha: 0.52, veilAlpha: d.menuOnly ? 0.7 : 0.54 });
    addPanel(this, 640, 386, 760, 470, d.won ? 0xd8a84e : 0x8f3e46, 0.95);
    addScreenTitle(this, d.title ?? (d.won ? 'Crown Claimed' : 'Champion Fallen'), d.menuOnly ? 'THE LAWS OF THE CROWNFIRE TRIAL' : d.won ? 'THE FALLEN CROWN ANSWERS TO YOU' : 'THE ARENA REMEMBERS EVERY DEFEAT', d.won ? 0xd8a84e : 0x8f3e46);
    if (!d.menuOnly) {
      const character = getCharacter(SESSION.character);
      const portrait = this.add.image(380, 375, character.assetKey).setDisplaySize(260, 260);
      this.add.circle(380, 375, 124, character.accentColor, 0.09).setStrokeStyle(2, character.accentColor, 0.35).setDepth(portrait.depth - 1);
      this.tweens.add({ targets: portrait, y: 366, duration: 1200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    }
    const contentX = d.menuOnly ? 640 : 760;
    this.add.text(contentX, d.menuOnly ? 260 : 245, d.reason, {
      fontFamily: 'Georgia',
      fontSize: d.menuOnly ? '21px' : '20px',
      color: '#f4ead2',
      align: 'center',
      lineSpacing: 9,
      wordWrap: { width: d.menuOnly ? 620 : 390 }
    }).setOrigin(0.5);
    if (!d.menuOnly) {
      this.add.text(contentX, 354, `KILLS  ${d.kills ?? 0}     SHARDS  ${d.shards ?? 0}     TIME  ${Math.floor((d.time ?? 0) / 1000)}s`, {
        fontFamily: 'Arial', fontStyle: 'bold', fontSize: '16px',
        color: '#b5a995'
      }).setOrigin(0.5);
      this.add.text(contentX, 400, `+${d.crowns} CROWNS     VAULT ${d.total}`, {
        fontFamily: 'Georgia',
        fontSize: '23px',
        color: '#9ec8ff'
      }).setOrigin(0.5);
    }
    menuButton(this, contentX, 500, d.menuOnly ? 'Back' : 'Restart Trial', () => this.scene.start(d.menuOnly ? 'MainMenuScene' : 'GameScene'), false, 300);
    if (!d.menuOnly) menuButton(this, contentX, 562, 'Main Menu', () => this.scene.start('MainMenuScene'), false, 300);
  }
}
