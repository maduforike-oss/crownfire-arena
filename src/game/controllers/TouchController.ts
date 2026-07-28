import Phaser from 'phaser';
import type { Direction } from '../utils/types';
import type { DeviceProfile } from '../systems/DeviceProfile';

type TouchAction = 'bomb' | 'special' | 'remote' | 'pause';

const STICK_TRAVEL = 54;
const STICK_DEAD_ZONE = 13;

export class TouchController {
  readonly visible: boolean;
  private readonly root: Phaser.GameObjects.Container;
  private currentDirection: Direction = 'none';
  private pending = new Set<TouchAction>();
  private stickPointerId?: number;
  private stickKnob?: Phaser.GameObjects.Arc;
  private stickGlow?: Phaser.GameObjects.Arc;
  private remoteButton?: Phaser.GameObjects.Container;
  private remoteLabel?: Phaser.GameObjects.Text;
  private readonly stickCenter: { x: number; y: number };

  constructor(private readonly scene: Phaser.Scene, profile: DeviceProfile) {
    this.visible = profile.touch || scene.sys.game.device.input.touch || new URLSearchParams(window.location.search).has('touch');
    this.stickCenter = profile.compactHud ? { x: 170, y: 590 } : { x: 132, y: 590 };
    this.root = scene.add.container(0, 0).setDepth(180).setScrollFactor(0).setVisible(this.visible);
    if (!this.visible) return;

    this.createJoystick();
    const bombX = profile.compactHud ? 1118 : 1162;
    const powerX = profile.compactHud ? 1118 : 1080;
    const remoteX = profile.compactHud ? 1118 : 1210;
    const pauseX = profile.compactHud ? 1132 : 1238;
    this.createActionButton(bombX, profile.compactHud ? 510 : 555, profile.compactHud ? 62 : 66, 0xf06a31, 'BOMB', 'bomb');
    this.createActionButton(powerX, profile.compactHud ? 640 : 628, profile.compactHud ? 50 : 54, 0xa974ff, 'POWER', 'special');
    this.remoteButton = this.createActionButton(remoteX, profile.compactHud ? 382 : 652, profile.compactHud ? 44 : 48, 0x9e70ff, 'HEX', 'remote').setVisible(false);
    this.createActionButton(pauseX, 42, profile.compactHud ? 32 : 34, 0xd8a84e, 'II', 'pause');

    this.scene.input.on('pointermove', this.moveJoystick, this);
    this.scene.input.on('pointerup', this.releasePointer, this);
    this.scene.input.on('gameout', this.releaseAll, this);
    this.scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  direction(): Direction {
    return this.currentDirection;
  }

  consumeBomb(): boolean {
    return this.consume('bomb');
  }

  consumeSpecial(): boolean {
    return this.consume('special');
  }

  consumeRemote(): boolean {
    return this.consume('remote');
  }

  consumePause(): boolean {
    return this.consume('pause');
  }

  setRemoteAvailable(armedBombs: number): void {
    const available = armedBombs > 0;
    this.remoteButton?.setVisible(available);
    this.remoteLabel?.setText(`HEX\n${armedBombs}`);
    if (!available) this.pending.delete('remote');
  }

  private createJoystick(): void {
    const center = this.stickCenter;
    const outerGlow = this.scene.add.circle(
      center.x,
      center.y,
      80,
      0x5e91c9,
      0.08
    ).setStrokeStyle(2, 0x9ec8ff, 0.42);
    const base = this.scene.add.circle(
      center.x,
      center.y,
      68,
      0x090b12,
      0.78
    ).setStrokeStyle(3, 0xd8a84e, 0.56);
    const compass = this.scene.add.circle(
      center.x,
      center.y,
      47,
      0x111722,
      0.72
    ).setStrokeStyle(1, 0x9ec8ff, 0.35);
    const horizontal = this.scene.add.rectangle(center.x, center.y, 88, 2, 0x9ec8ff, 0.18);
    const vertical = this.scene.add.rectangle(center.x, center.y, 2, 88, 0x9ec8ff, 0.18);
    this.stickGlow = this.scene.add.circle(
      center.x,
      center.y,
      42,
      0x5e91c9,
      0.08
    ).setStrokeStyle(2, 0x9ec8ff, 0.38);
    this.stickKnob = this.scene.add.circle(
      center.x,
      center.y,
      31,
      0x202a39,
      0.98
    ).setStrokeStyle(3, 0xffdf91, 0.9);
    const crown = this.scene.add.text(center.x, center.y, '+', {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '24px',
      color: '#f7d783'
    }).setOrigin(0.5);
    const zone = this.scene.add.zone(center.x, center.y, 190, 190).setInteractive();
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      if (this.stickPointerId !== undefined) return;
      this.stickPointerId = pointer.id;
      this.updateJoystick(pointer);
      this.stickGlow?.setAlpha(0.28).setScale(1.08);
    });
    this.root.add([outerGlow, base, compass, horizontal, vertical, this.stickGlow, this.stickKnob, crown, zone]);
  }

  private moveJoystick(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.stickPointerId || !pointer.isDown) return;
    this.updateJoystick(pointer);
  }

  private updateJoystick(pointer: Phaser.Input.Pointer): void {
    const dx = pointer.x - this.stickCenter.x;
    const dy = pointer.y - this.stickCenter.y;
    const distance = Math.hypot(dx, dy);
    const scale = distance > STICK_TRAVEL ? STICK_TRAVEL / distance : 1;
    const knobX = this.stickCenter.x + dx * scale;
    const knobY = this.stickCenter.y + dy * scale;
    this.stickKnob?.setPosition(knobX, knobY);

    if (distance < STICK_DEAD_ZONE) {
      this.currentDirection = 'none';
      return;
    }
    this.currentDirection = Math.abs(dx) > Math.abs(dy)
      ? dx < 0 ? 'left' : 'right'
      : dy < 0 ? 'up' : 'down';
  }

  private createActionButton(x: number, y: number, radius: number, color: number, labelText: string, action: TouchAction): Phaser.GameObjects.Container {
    const glow = this.scene.add.circle(x, y, radius + 7, color, 0.08).setStrokeStyle(2, color, 0.52);
    const face = this.scene.add.circle(x, y, radius, 0x11131b, 0.93).setStrokeStyle(3, color, 0.9);
    const label = this.scene.add.text(x, y, labelText, {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: radius < 40 ? '16px' : '13px', color: '#fff2cf', align: 'center'
    }).setOrigin(0.5);
    const zone = this.scene.add.zone(x, y, radius * 2 + 18, radius * 2 + 18).setInteractive();
    zone.on('pointerdown', () => {
      this.pending.add(action);
      face.setFillStyle(color, 0.38);
      this.scene.tweens.add({ targets: [face, label], scale: 0.9, duration: 65, yoyo: true });
    });
    zone.on('pointerup', () => face.setFillStyle(0x11131b, 0.93));
    const button = this.scene.add.container(0, 0, [glow, face, label, zone]);
    this.root.add(button);
    if (action === 'remote') this.remoteLabel = label;
    return button;
  }

  private consume(action: TouchAction): boolean {
    if (!this.pending.has(action)) return false;
    this.pending.delete(action);
    return true;
  }

  private releasePointer(pointer: Phaser.Input.Pointer): void {
    if (pointer.id !== this.stickPointerId) return;
    this.resetJoystick();
  }

  private releaseAll(): void {
    this.resetJoystick();
  }

  private resetJoystick(): void {
    this.stickPointerId = undefined;
    this.currentDirection = 'none';
    this.stickKnob?.setPosition(this.stickCenter.x, this.stickCenter.y);
    this.stickGlow?.setAlpha(1).setScale(1);
  }

  private destroy(): void {
    this.scene.input.off('pointermove', this.moveJoystick, this);
    this.scene.input.off('pointerup', this.releasePointer, this);
    this.scene.input.off('gameout', this.releaseAll, this);
    this.root.destroy(true);
    this.pending.clear();
    this.stickPointerId = undefined;
  }
}
