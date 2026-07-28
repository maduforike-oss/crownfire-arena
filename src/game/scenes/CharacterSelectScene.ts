import Phaser from 'phaser';
import { CHARACTERS } from '../config/Characters';
import { SESSION } from '../config/GameConfig';
import { ChampionCard } from '../ui/ChampionCard';
import { menuButton } from '../ui/MenuButton';
import { NetworkSession } from '../network/NetworkSession';
import { addPanel, addSceneBackdrop, addScreenTitle, addSectionLabel } from '../ui/ScenePresentation';
import { getCharacter } from '../config/Characters';

export class CharacterSelectScene extends Phaser.Scene {
  constructor() {
    super('CharacterSelectScene');
  }

  create(): void {
    addSceneBackdrop(this, { theme: 'hollowmoon', alternateTheme: 'moonfang', imageAlpha: 0.66, veilAlpha: 0.45 });
    this.add.image(640, 360, 'reference-character-power-atlas').setDisplaySize(1280, 853).setAlpha(0.12).setDepth(-11);
    addScreenTitle(this, 'Choose Champion', 'SELECT A BLOODLINE AND MASTER ITS SIGNATURE POWER', 0xa974ff);
    const selected = getCharacter(SESSION.character);
    addPanel(this, 265, 377, 430, 500, selected.accentColor, 0.9);
    addSectionLabel(this, 265, 155, selected.faction, selected.accentColor);
    const glow = this.add.circle(265, 335, 150, selected.accentColor, 0.12).setStrokeStyle(2, selected.accentColor, 0.4);
    const portrait = this.add.image(265, 335, selected.assetKey).setDisplaySize(330, 330);
    this.tweens.add({ targets: portrait, y: 327, duration: 1300, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: glow, scale: 1.08, alpha: 0.2, duration: 1050, yoyo: true, repeat: -1 });
    this.add.text(265, 503, selected.displayName, { fontFamily: 'Georgia', fontSize: '28px', color: '#fff0c4', stroke: '#08080c', strokeThickness: 4 }).setOrigin(0.5);
    this.add.text(265, 540, selected.description, { fontFamily: 'Arial', fontSize: '14px', color: '#c8bda9' }).setOrigin(0.5);
    this.add.text(265, 575, selected.passiveText, { fontFamily: 'Arial', fontStyle: 'bold', fontSize: '15px', color: '#f4ead2' }).setOrigin(0.5);
    this.add.text(265, 608, selected.specialName, { fontFamily: 'Georgia', fontSize: '18px', color: `#${selected.accentColor.toString(16).padStart(6, '0')}` }).setOrigin(0.5);

    CHARACTERS.forEach((character, i) => {
      new ChampionCard(this, {
        character,
        selected: character.id === SESSION.character,
        x: 720 + (i % 2) * 286,
        y: 170 + Math.floor(i / 2) * 112,
        width: 268,
        height: 96,
        onClick: () => {
          SESSION.character = character.id;
          this.scene.restart();
        }
      });
    });

    menuButton(this, 720, 656, 'Back', () => this.scene.start(NetworkSession.get().active ? 'MultiplayerLobbyScene' : 'MainMenuScene'), false, 240);
    menuButton(this, 1006, 656, 'Continue', () => this.scene.start('ModeSelectScene'), false, 240);
  }
}
