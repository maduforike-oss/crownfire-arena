import Phaser from 'phaser';
import type { Direction } from '../utils/types';

type TouchAction = 'bomb' | 'special' | 'remote' | 'pause';

const STICK_CENTER = { x: 132, y: 590 };
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

  constructor(private readonly scene: Phaser.Scene) {
    this.visible = scene.sys.game.device.input.touch || new URLSearchParams(window.location.search).has('touch');
    this.root = scene.add.container(0, 0).setDepth(180).setScrollFactor(0).setVisible(this.visible);
    if (!this.visible) return;

    this.createJoystick();
    this.createActionButton(1162, 555, 66, 0xf06a31, 'BOMB', 'bomb');
    this.createActionButton(1080, 628, 54, 0xa974ff, 'POWER', 'special');
    this.remoteButton = this.createActionButton(1210, 652, 48, 0x9e70ff, 'HEX', 'remote').setVisible(false);
    this.createActionButton(1238, 42, 34, 0xd8a84e, 'II', 'pause');

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
    const outerGlow = this.scene.add.circle(
      STICK_CENTER.x,
      STICK_CENTER.y,
      80,
      0x5e91c9,
      0.08
    ).setStrokeStyle(2, 0x9ec8ff, 0.42);
    const base = this.scene.add.circle(
      STICK_CENTER.x,
      STICK_CENTER.y,
      68,
      0x090b12,
      0.78
    ).setStrokeStyle(3, 0xd8a84e, 0.56);
    const compass = this.scene.add.circle(
      STICK_CENTER.x,
      STICK_CENTER.y,
      47,
      0x111722,
      0.72
    ).setStrokeStyle(1, 0x9ec8ff, 0.35);
    const horizontal = this.scene.add.rectangle(STICK_CENTER.x, STICK_CENTER.y, 88, 2, 0x9ec8ff, 0.18);
    const vertical = this.scene.add.rectangle(STICK_CENTER.x, STICK_CENTER.y, 2, 88, 0x9ec8ff, 0.18);
    this.stickGlow = this.scene.add.circle(
      STICK_CENTER.x,
      STICK_CENTER.y,
      42,
      0x5e91c9,
      0.08
    ).setStrokeStyle(2, 0x9ec8ff, 0.38);
    this.stickKnob = this.scene.add.circle(
      STICK_CENTER.x,
      STICK_CENTER.y,
      31,
      0x202a39,
      0.98
    ).setStrokeStyle(3, 0xffdf91, 0.9);
    const crown = this.scene.add.text(STICK_CENTER.x, STICK_CENTER.y, '+', {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '24px',
      color: '#f7d783'
    }).setOrigin(0.5);
    const zone = this.scene.add.zone(STICK_CENTER.x, STICK_CENTER.y, 190, 190).setInteractive();
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
    const dx = pointer.x - STICK_CENTER.x;
    const dy = pointer.y - STICK_CENTER.y;
    const distance = Math.hypot(dx, dy);
    const scale = distance > STICK_TRAVEL ? STICK_TRAVEL / distance : 1;
    const knobX = STICK_CENTER.x + dx * scale;
    const knobY = STICK_CENTER.y + dy * scale;
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
    this.stickKnob?.setPosition(STICK_CENTER.x, STICK_CENTER.y);
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
