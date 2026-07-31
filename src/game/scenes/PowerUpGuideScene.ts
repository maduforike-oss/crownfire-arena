import Phaser from 'phaser';
import { POWER_UPS } from '../config/PowerUps';
import { menuButton } from '../ui/MenuButton';
import { addSceneBackdrop, addScreenTitle } from '../ui/ScenePresentation';

const EFFECTS: Record<string, string> = {
  ember: 'Permanent +1 blast radius.',
  twin: 'Permanent +1 max rune bomb.',
  wolfSprint: 'Auto-activates: 40% speed boost for 7 seconds.',
  stoneguard: 'Absorb one hit for 12 seconds. If wounded, restore 1 health instead.',
  dragonCore: 'Stored in Power: release a six-tile cardinal Dragon Blast.',
  ghostVeil: 'Immune to bomb damage for 5.5 seconds.',
  frostSnare: 'Stored in Power: leave owner-safe trapping frost for 4.5 seconds.',
  ravenBlink: 'Stored in Power: blink to the last safe tile in your facing direction.',
  beastCall: 'Stored in Power: release a six-tile claw wave in your facing lane.',
  remoteHex: 'Arm 3 bombs. E or HEX detonates the oldest armed bomb after a command flash.',
  crownSurge: 'Rare and automatic: 9 seconds of blast immunity and contact damage.'
};

const TAGS: Record<string, string> = {
  ember: 'Permanent',
  twin: 'Permanent',
  wolfSprint: 'Temporary',
  stoneguard: 'Charge',
  dragonCore: 'Stored',
  ghostVeil: 'Temporary',
  frostSnare: 'Stored',
  ravenBlink: 'Stored',
  beastCall: 'Stored',
  remoteHex: 'Charge',
  crownSurge: 'Rare'
};

export class PowerUpGuideScene extends Phaser.Scene {
  constructor() {
    super('PowerUpGuideScene');
  }

  create(): void {
    addSceneBackdrop(this, { theme: 'hollowmoon', alternateTheme: 'ashen', imageAlpha: 0.46, veilAlpha: 0.64, particles: 18 });
    this.add.image(640, 360, 'reference-character-power-atlas').setDisplaySize(1080, 720).setAlpha(0.08);
    addScreenTitle(this, 'Rune & Power-Up Guide', 'BREAK CURSED BLOCKS TO REVEAL THESE ARENA-CHANGING RELICS', 0xa974ff);

    POWER_UPS.forEach((power, index) => {
      const x = 330 + (index % 2) * 620;
      const y = 136 + Math.floor(index / 2) * 86;
      const texture = this.textures.exists(power.assetKey) ? power.assetKey : 'power-fallback';
      const panel = this.add.rectangle(x, y, 570, 68, 0x11131b, 0.95).setStrokeStyle(1, power.color, 0.68);
      const icon = this.add.image(x - 248, y, texture).setDisplaySize(56, 56);
      this.add.circle(x - 248, y, 30, power.color, 0.08).setStrokeStyle(1, power.color, 0.36);
      icon.setDepth(2);
      this.add.text(x - 208, y - 25, power.name, {
        fontFamily: 'Georgia',
        fontSize: '20px',
        color: '#f4ead2'
      });
      this.add.rectangle(x + 222, y - 21, 106, 21, 0x0d0c12, 0.9).setStrokeStyle(1, power.color, 0.7);
      this.add.text(x + 222, y - 28, TAGS[power.id], {
        fontFamily: 'Georgia',
        fontSize: '12px',
        color: `#${power.color.toString(16).padStart(6, '0')}`
      }).setOrigin(0.5, 0);
      this.add.text(x - 208, y + 2, EFFECTS[power.id], {
        fontFamily: 'Arial',
        fontSize: '14px',
        color: '#cbb99a',
        wordWrap: { width: 430 }
      });
      this.add.zone(x, y, 570, 68).setInteractive({ useHandCursor: true }).on('pointerover', () => {
        panel.setFillStyle(0x20212b, 0.98);
        this.tweens.add({ targets: icon, scale: 1.1, duration: 90 });
      }).on('pointerout', () => {
        panel.setFillStyle(0x11131b, 0.95);
        this.tweens.add({ targets: icon, scale: 1, duration: 90 });
      });
    });

    menuButton(this, 640, 666, 'Back', () => this.scene.start('MainMenuScene'), false, 280);
  }
}
