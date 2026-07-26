import Phaser from 'phaser';
import type { CharacterDef } from '../config/Characters';

export interface ChampionCardOptions {
  x: number;
  y: number;
  width: number;
  height: number;
  selected: boolean;
  character: CharacterDef;
  onClick: () => void;
}

export class ChampionCard {
  readonly container: Phaser.GameObjects.Container;
  private readonly panel: Phaser.GameObjects.Rectangle;
  private readonly selectedGlow: Phaser.GameObjects.Rectangle;

  constructor(private readonly scene: Phaser.Scene, options: ChampionCardOptions) {
    const { x, y, width, height, selected, character } = options;
    const texture = scene.textures.exists(character.assetKey) ? character.assetKey : 'champion-fallback';
    this.container = scene.add.container(x, y);
    this.panel = scene.add.rectangle(0, 0, width, height, selected ? 0x221924 : 0x14131a, 0.95)
      .setStrokeStyle(selected ? 3 : 2, selected ? character.accentColor : 0x5a5046, selected ? 1 : 0.75);
    this.selectedGlow = scene.add.rectangle(0, 0, width + 10, height + 10, character.accentColor, selected ? 0.08 : 0)
      .setStrokeStyle(2, character.accentColor, selected ? 0.75 : 0);

    const portraitSize = Math.min(82, height - 14);
    const portraitX = -width / 2 + portraitSize / 2 + 10;
    const textX = -width / 2 + portraitSize + 22;
    const portraitFrame = scene.add.rectangle(portraitX, 0, portraitSize, portraitSize, 0x08080d, 0.96)
      .setStrokeStyle(2, character.accentColor, 0.85);
    const portraitGlow = scene.add.circle(portraitX, 0, portraitSize / 2, character.accentColor, selected ? 0.16 : 0.08);
    const portrait = scene.add.image(portraitX, 0, texture);
    portrait.setDisplaySize(portraitSize - 4, portraitSize - 4);

    const title = scene.add.text(textX, -31, character.displayName, {
      fontFamily: 'Georgia',
      fontSize: width < 320 ? '16px' : '19px',
      color: '#f4ead2',
      stroke: '#08080c',
      strokeThickness: 3
    });
    const passive = scene.add.text(textX, -5, character.passiveText, {
      fontFamily: 'Georgia',
      fontSize: '12px',
      color: '#d5c39e',
      wordWrap: { width: width - portraitSize - 34 }
    });
    const desc = scene.add.text(textX, 18, character.specialName, {
      fontFamily: 'Georgia',
      fontSize: '12px',
      color: `#${character.accentColor.toString(16).padStart(6, '0')}`
    });

    this.container.add([this.selectedGlow, this.panel, portraitGlow, portraitFrame, portrait, title, passive, desc]);
    this.container.setSize(width, height).setInteractive({ useHandCursor: true });
    this.container.on('pointerover', () => {
      this.panel.setFillStyle(selected ? 0x2a1d2a : 0x1d1a22, 0.98);
      portraitGlow.setAlpha(selected ? 0.23 : 0.15);
    });
    this.container.on('pointerout', () => {
      this.panel.setFillStyle(selected ? 0x221924 : 0x14131a, 0.95);
      portraitGlow.setAlpha(selected ? 0.16 : 0.08);
    });
    this.container.on('pointerdown', options.onClick);

    if (selected) {
      scene.tweens.add({
        targets: this.selectedGlow,
        alpha: { from: 0.06, to: 0.18 },
        duration: 820,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.inOut'
      });
    }
  }
}
