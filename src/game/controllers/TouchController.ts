import Phaser from 'phaser';
import type { Direction } from '../utils/types';

type TouchAction = 'bomb' | 'special' | 'remote' | 'pause';

export class TouchController {
  readonly visible: boolean;
  private readonly root: Phaser.GameObjects.Container;
  private readonly heldDirections = new Map<number, Direction>();
  private currentDirection: Direction = 'none';
  private pending = new Set<TouchAction>();

  constructor(private readonly scene: Phaser.Scene) {
    this.visible = scene.sys.game.device.input.touch || new URLSearchParams(window.location.search).has('touch');
    this.root = scene.add.container(0, 0).setDepth(180).setScrollFactor(0).setVisible(this.visible);
    if (!this.visible) return;

    this.createDirectionButton(130, 534, 'up', '▲');
    this.createDirectionButton(130, 654, 'down', '▼');
    this.createDirectionButton(70, 594, 'left', '◀');
    this.createDirectionButton(190, 594, 'right', '▶');
    this.root.add(this.scene.add.circle(130, 594, 24, 0x0d0c12, 0.82).setStrokeStyle(2, 0xd8a84e, 0.4));

    this.createActionButton(1162, 555, 66, 0xf06a31, 'BOMB', 'bomb');
    this.createActionButton(1080, 628, 54, 0xa974ff, 'POWER', 'special');
    this.createActionButton(1210, 652, 48, 0x9e70ff, 'HEX', 'remote');
    this.createActionButton(1238, 42, 34, 0xd8a84e, 'Ⅱ', 'pause');

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

  private createDirectionButton(x: number, y: number, direction: Direction, glyph: string): void {
    const glow = this.scene.add.circle(x, y, 47, 0xd8a84e, 0.06).setStrokeStyle(2, 0xd8a84e, 0.48);
    const face = this.scene.add.circle(x, y, 39, 0x11131b, 0.9).setStrokeStyle(1, 0xffdf91, 0.34);
    const label = this.scene.add.text(x, y, glyph, {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '28px', color: '#ffe7aa'
    }).setOrigin(0.5);
    const zone = this.scene.add.zone(x, y, 100, 100).setInteractive();
    zone.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      this.heldDirections.set(pointer.id, direction);
      this.currentDirection = direction;
      face.setFillStyle(0x352536, 0.98);
      glow.setAlpha(0.18).setScale(1.08);
    });
    const release = (pointer: Phaser.Input.Pointer) => {
      this.heldDirections.delete(pointer.id);
      const held = [...this.heldDirections.values()];
      this.currentDirection = held[held.length - 1] ?? 'none';
      face.setFillStyle(0x11131b, 0.9);
      glow.setAlpha(1).setScale(1);
    };
    zone.on('pointerup', release).on('pointerout', release);
    this.root.add([glow, face, label, zone]);
  }

  private createActionButton(x: number, y: number, radius: number, color: number, labelText: string, action: TouchAction): void {
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
    this.root.add([glow, face, label, zone]);
  }

  private consume(action: TouchAction): boolean {
    if (!this.pending.has(action)) return false;
    this.pending.delete(action);
    return true;
  }

  private releasePointer(pointer: Phaser.Input.Pointer): void {
    this.heldDirections.delete(pointer.id);
    const held = [...this.heldDirections.values()];
    this.currentDirection = held[held.length - 1] ?? 'none';
  }

  private releaseAll(): void {
    this.heldDirections.clear();
    this.currentDirection = 'none';
  }

  private destroy(): void {
    this.scene.input.off('pointerup', this.releasePointer, this);
    this.scene.input.off('gameout', this.releaseAll, this);
    this.root.destroy(true);
    this.heldDirections.clear();
    this.pending.clear();
  }
}
