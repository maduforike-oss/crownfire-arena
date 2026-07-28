import Phaser from 'phaser';
import { PRESENTATION, hexColor } from '../config/PresentationConfig';

export type BackdropTheme = 'ashen' | 'moonfang' | 'frostkeep' | 'hollowmoon';

export interface BackdropOptions {
  theme: BackdropTheme;
  alternateTheme?: BackdropTheme;
  imageKey?: string;
  imageAlpha?: number;
  veilAlpha?: number;
  particles?: number;
}

export function addSceneBackdrop(scene: Phaser.Scene, options: BackdropOptions): Phaser.GameObjects.Container {
  scene.cameras.main.fadeIn(260, 0, 0, 0);
  const { theme, imageKey, imageAlpha = 0.7, veilAlpha = 0.32 } = options;
  const root = scene.add.container(0, 0).setDepth(-20);
  root.add(scene.add.rectangle(PRESENTATION.width / 2, PRESENTATION.height / 2, PRESENTATION.width, PRESENTATION.height, 0x07080d));
  const hero = imageKey
    ? scene.add.image(PRESENTATION.width / 2, PRESENTATION.height / 2, imageKey)
    : theme === 'ashen'
    ? scene.add.image(PRESENTATION.width / 2, PRESENTATION.height / 2, 'menu-crownfire-hero')
    : scene.add.image(PRESENTATION.width / 2, PRESENTATION.height / 2, 'reference-arena-atlas', `reference-${theme}-board`);
  hero
    .setDisplaySize(PRESENTATION.width, imageKey || theme === 'ashen' ? PRESENTATION.height : 960)
    .setAlpha(Math.min(0.82, imageAlpha));
  root.add(hero);
  root.add(scene.add.rectangle(
    PRESENTATION.width / 2,
    PRESENTATION.height / 2,
    PRESENTATION.width,
    PRESENTATION.height,
    0x07070b,
    Math.max(0.28, veilAlpha)
  ));
  scene.tweens.add({
    targets: hero,
    scale: 1.018,
    duration: 9000,
    yoyo: true,
    repeat: -1,
    ease: 'Sine.inOut'
  });
  return root;
}

export function addScreenTitle(scene: Phaser.Scene, title: string, subtitle?: string, accent = 0xd8a84e): Phaser.GameObjects.Container {
  const root = scene.add.container(PRESENTATION.width / 2, 48).setDepth(80);
  const rule = scene.add.rectangle(0, 46, Math.min(680, 220 + title.length * 18), 2, accent, 0.72);
  const glow = scene.add.rectangle(0, 46, Math.min(760, 250 + title.length * 20), 10, accent, 0.06);
  const heading = scene.add.text(0, 0, title, {
    fontFamily: 'Georgia, serif',
    fontSize: '46px',
    color: '#ffe39b',
    stroke: '#09070a',
    strokeThickness: 7
  }).setOrigin(0.5);
  root.add([glow, rule, heading]);
  if (subtitle) {
    root.add(scene.add.text(0, 58, subtitle, {
      fontFamily: 'Arial, sans-serif',
      fontSize: '15px',
      color: '#e5d7bb'
    }).setOrigin(0.5));
  }
  return root;
}

export function addPanel(
  scene: Phaser.Scene,
  x: number,
  y: number,
  width: number,
  height: number,
  accent = 0xd8a84e,
  alpha = 0.9
): Phaser.GameObjects.Container {
  const shadow = scene.add.rectangle(6, 8, width, height, 0x000000, 0.42);
  const glow = scene.add.rectangle(0, 0, width + 8, height + 8, accent, 0.045).setStrokeStyle(1, accent, 0.16);
  const panel = scene.add.rectangle(0, 0, width, height, 0x11121a, alpha).setStrokeStyle(2, accent, 0.55);
  const inner = scene.add.rectangle(0, 0, width - 14, height - 14, 0x000000, 0).setStrokeStyle(1, 0xf7dfaa, 0.12);
  const crest = scene.add.rectangle(0, -height / 2, 8, 8, accent, 0.95).setAngle(45).setStrokeStyle(1, 0xffefbd, 0.6);
  return scene.add.container(x, y, [shadow, glow, panel, inner, crest]);
}

export function addSectionLabel(scene: Phaser.Scene, x: number, y: number, text: string, accent: number): Phaser.GameObjects.Text {
  return scene.add.text(x, y, text.toUpperCase(), {
    fontFamily: 'Arial, sans-serif',
    fontStyle: 'bold',
    fontSize: '12px',
    color: hexColor(accent)
  }).setOrigin(0.5).setLetterSpacing(1);
}
