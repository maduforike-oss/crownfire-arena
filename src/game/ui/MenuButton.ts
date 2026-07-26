import Phaser from 'phaser';
import { AudioSystem } from '../systems/AudioSystem';

export function menuButton(scene: Phaser.Scene, x: number, y: number, label: string, onClick: () => void, disabled = false, width = 312): Phaser.GameObjects.Container {
  const bg = scene.add.rectangle(0, 0, width, 52, disabled ? 0x302b31 : 0x14121a, 0.96).setStrokeStyle(2, disabled ? 0x5c5145 : 0xd8a84e);
  const hoverGlow = scene.add.rectangle(0, 0, width + 8, 60, 0xd8a84e, 0).setStrokeStyle(1, 0xffe1a0, 0);
  const glint = scene.add.rectangle(0, -21, width - 24, 3, 0xffe1a0, disabled ? 0.08 : 0.18);
  const text = scene.add.text(0, 0, label, {
    fontFamily: 'Georgia, serif',
    fontSize: '20px',
    color: disabled ? '#82776b' : '#f4ead2'
  }).setOrigin(0.5);
  const leftRune = scene.add.rectangle(-width / 2 + 22, 0, 7, 7, disabled ? 0x5c5145 : 0xd8a84e, 0.9).setAngle(45);
  const rightRune = scene.add.rectangle(width / 2 - 22, 0, 7, 7, disabled ? 0x5c5145 : 0xd8a84e, 0.9).setAngle(45);
  const c = scene.add.container(x, y, [hoverGlow, bg, glint, leftRune, rightRune, text]);
  if (!disabled) {
    c.setSize(width, 52).setInteractive({ useHandCursor: true });
    c.on('pointerover', () => {
      bg.setFillStyle(0x251a25);
      text.setColor('#ffe4a8');
      hoverGlow.setFillStyle(0xd8a84e, 0.06).setStrokeStyle(1, 0xffe1a0, 0.55);
      scene.tweens.add({ targets: c, scaleX: 1.025, scaleY: 1.025, duration: 100 });
    });
    c.on('pointerout', () => {
      bg.setFillStyle(0x14121a);
      text.setColor('#f4ead2');
      hoverGlow.setFillStyle(0xd8a84e, 0).setStrokeStyle(1, 0xffe1a0, 0);
      scene.tweens.add({ targets: c, scaleX: 1, scaleY: 1, duration: 100 });
    });
    c.on('pointerdown', () => {
      AudioSystem.get().sfx('menu');
      onClick();
    });
  }
  return c;
}
