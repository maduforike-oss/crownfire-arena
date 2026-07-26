import Phaser from 'phaser';
import type { Direction } from '../utils/types';
import { UnifiedInputController } from './UnifiedInputController';

export class HumanController {
  readonly keys: Record<string, Phaser.Input.Keyboard.Key>;
  private readonly unified?: UnifiedInputController;

  constructor(scene: Phaser.Scene, private readonly scheme: 'wasd' | 'arrows' = 'wasd') {
    const keyList = scheme === 'wasd' ? 'W,A,S,D,SPACE,SHIFT,E,ESC' : 'UP,DOWN,LEFT,RIGHT,ENTER,SHIFT,P,ESC';
    this.keys = scene.input.keyboard!.addKeys(keyList) as Record<string, Phaser.Input.Keyboard.Key>;
    if (scheme === 'wasd') this.unified = new UnifiedInputController(scene);
  }

  direction(): Direction {
    this.unified?.update();
    if (this.unified) return this.unified.direction();
    if (this.scheme === 'arrows') {
      if (this.keys.UP.isDown) return 'up';
      if (this.keys.DOWN.isDown) return 'down';
      if (this.keys.LEFT.isDown) return 'left';
      if (this.keys.RIGHT.isDown) return 'right';
      return 'none';
    }
    if (this.keys.W.isDown) return 'up';
    if (this.keys.S.isDown) return 'down';
    if (this.keys.A.isDown) return 'left';
    if (this.keys.D.isDown) return 'right';
    return 'none';
  }

  consumeBomb(): boolean {
    if (this.unified) return this.unified.consume('bomb');
    return Phaser.Input.Keyboard.JustDown(this.scheme === 'wasd' ? this.keys.SPACE : this.keys.ENTER);
  }

  consumeSpecial(): boolean {
    if (this.unified) return this.unified.consume('special');
    return Phaser.Input.Keyboard.JustDown(this.keys.SHIFT);
  }

  consumeRemote(): boolean {
    if (this.unified) return this.unified.consume('remote');
    return Phaser.Input.Keyboard.JustDown(this.scheme === 'wasd' ? this.keys.E : this.keys.P);
  }

  consumePause(): boolean {
    if (this.unified) return this.unified.consume('pause');
    return Phaser.Input.Keyboard.JustDown(this.keys.ESC);
  }
}
