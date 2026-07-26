import Phaser from 'phaser';
import { PRESENTATION, hexColor } from '../config/PresentationConfig';

export type BackdropTheme = 'ashen' | 'moonfang' | 'frostkeep' | 'hollowmoon';

const ACCENTS: Record<BackdropTheme, number> = {
  ashen: 0xf06a31,
  moonfang: 0x9dc8ff,
  frostkeep: 0x82e8ff,
  hollowmoon: 0xa974ff
};

export interface BackdropOptions {
  theme: BackdropTheme;
  alternateTheme?: BackdropTheme;
  imageAlpha?: number;
  veilAlpha?: number;
  particles?: number;
}

export function addSceneBackdrop(scene: Phaser.Scene, options: BackdropOptions): Phaser.GameObjects.Container {
  scene.cameras.main.fadeIn(260, 0, 0, 0);
  const { theme, alternateTheme = theme, imageAlpha = 0.7, veilAlpha = 0.32, particles = 26 } = options;
  const accent = ACCENTS[theme];
  const root = scene.add.container(0, 0).setDepth(-20);
  root.add(scene.add.rectangle(PRESENTATION.width / 2, PRESENTATION.height / 2, PRESENTATION.width, PRESENTATION.height, 0x07080d));
  root.add(scene.add.image(PRESENTATION.width / 2, PRESENTATION.height / 2, 'concept-sheet')
    .setDisplaySize(PRESENTATION.width, 853)
    .setAlpha(Math.min(0.5, imageAlpha * 0.58)));

  const left = scene.add.image(0, PRESENTATION.height / 2, `landscape-${theme}`)
    .setOrigin(0, 0.5)
    .setDisplaySize(PRESENTATION.width * 0.57, PRESENTATION.height * 1.14)
    .setAlpha(imageAlpha * 0.3);
  const right = scene.add.image(PRESENTATION.width, PRESENTATION.height / 2, `landscape-${alternateTheme}`)
    .setOrigin(1, 0.5)
    .setDisplaySize(PRESENTATION.width * 0.57, PRESENTATION.height * 1.14)
    .setFlipX(true)
    .setAlpha(imageAlpha * 0.24);
  root.add([left, right]);

  const centreShade = scene.add.rectangle(PRESENTATION.width / 2, PRESENTATION.height / 2, PRESENTATION.width, PRESENTATION.height, 0x07070b, veilAlpha);
  const topShade = scene.add.rectangle(PRESENTATION.width / 2, 0, PRESENTATION.width, 170, 0x06070b, 0.56).setOrigin(0.5, 0);
  const bottomShade = scene.add.rectangle(PRESENTATION.width / 2, PRESENTATION.height, PRESENTATION.width, 150, 0x06070b, 0.62).setOrigin(0.5, 1);
  root.add([centreShade, topShade, bottomShade]);

  const vignetteTop = scene.add.rectangle(PRESENTATION.width / 2, 4, PRESENTATION.width - 18, 4, accent, 0.52);
  const vignetteBottom = scene.add.rectangle(PRESENTATION.width / 2, PRESENTATION.height - 4, PRESENTATION.width - 18, 4, 0xd8a84e, 0.3);
  root.add([vignetteTop, vignetteBottom]);

  for (let i = 0; i < particles; i += 1) {
    const x = Phaser.Math.Between(20, PRESENTATION.width - 20);
    const y = Phaser.Math.Between(40, PRESENTATION.height - 30);
    const mote = scene.add.circle(x, y, Phaser.Math.Between(1, 3), i % 5 === 0 ? 0xf7d783 : accent, Phaser.Math.FloatBetween(0.1, 0.34));
    root.add(mote);
    scene.tweens.add({
      targets: mote,
      y: y - Phaser.Math.Between(18, 56),
      alpha: 0.03,
      duration: Phaser.Math.Between(1800, 4200),
      delay: Phaser.Math.Between(0, 1200),
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
  }

  scene.tweens.add({ targets: left, x: -10, scaleX: 1.015, scaleY: 1.015, duration: 7200, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
  scene.tweens.add({ targets: right, x: PRESENTATION.width + 10, scaleX: 1.02, scaleY: 1.02, duration: 8400, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
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
