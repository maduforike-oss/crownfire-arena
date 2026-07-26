import Phaser from 'phaser';
import type { Direction } from '../utils/types';
import { ACTIONS, loadInputBindings, saveInputBindings, type GameAction, type InputBindings } from './InputBindings';

export interface InputSample {
  source: 'keyboard' | 'gamepad';
  label: string;
  at: number;
}

export class UnifiedInputController {
  private bindings: InputBindings;
  private readonly heldCodes = new Set<string>();
  private readonly heldActions = new Set<GameAction>();
  private readonly pendingActions = new Set<GameAction>();
  private previousPadButtons = new Set<number>();
  private captureAction?: GameAction;
  private captureCallback?: (sample: InputSample) => void;
  private latest?: InputSample;
  private gamepadName = '';
  private axesLabel = '';

  constructor(private readonly scene: Phaser.Scene) {
    this.bindings = loadInputBindings();
    window.addEventListener('keydown', this.onKeyDown, { passive: false });
    window.addEventListener('keyup', this.onKeyUp, { passive: false });
    window.addEventListener('blur', this.releaseAll);
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, this.destroy, this);
  }

  update(): void {
    const pads = navigator.getGamepads?.() ?? [];
    const pad = [...pads].find((candidate): candidate is Gamepad => Boolean(candidate?.connected));
    this.gamepadName = pad?.id ?? '';
    if (!pad) {
      this.previousPadButtons.clear();
      this.axesLabel = '';
      return;
    }

    const downButtons = new Set<number>();
    pad.buttons.forEach((button, index) => {
      if (!button.pressed && button.value < 0.5) return;
      downButtons.add(index);
      if (!this.previousPadButtons.has(index)) this.recordGamepadButton(index);
    });

    const x = Math.abs(pad.axes[0] ?? 0) > 0.45 ? pad.axes[0] : 0;
    const y = Math.abs(pad.axes[1] ?? 0) > 0.45 ? pad.axes[1] : 0;
    this.axesLabel = `X ${x.toFixed(2)}  Y ${y.toFixed(2)}`;
    this.setGamepadDirection('left', x < 0);
    this.setGamepadDirection('right', x > 0);
    this.setGamepadDirection('up', y < 0);
    this.setGamepadDirection('down', y > 0);

    for (const action of ACTIONS) {
      const active = this.bindings[action].gamepadButtons.some((button) => downButtons.has(button));
      if (active) this.heldActions.add(action);
      else if (!this.axisControls(action, x, y)) this.heldActions.delete(action);
    }
    this.previousPadButtons = downButtons;
  }

  direction(): Direction {
    if (this.heldActions.has('up')) return 'up';
    if (this.heldActions.has('down')) return 'down';
    if (this.heldActions.has('left')) return 'left';
    if (this.heldActions.has('right')) return 'right';
    return 'none';
  }

  consume(action: Exclude<GameAction, 'up' | 'down' | 'left' | 'right'>): boolean {
    if (!this.pendingActions.has(action)) return false;
    this.pendingActions.delete(action);
    return true;
  }

  beginCapture(action: GameAction, callback: (sample: InputSample) => void): void {
    this.captureAction = action;
    this.captureCallback = callback;
  }

  cancelCapture(): void {
    this.captureAction = undefined;
    this.captureCallback = undefined;
  }

  getBindings(): InputBindings {
    return this.bindings;
  }

  getLatestSample(): InputSample | undefined {
    return this.latest;
  }

  getGamepadStatus(): string {
    return this.gamepadName ? `Gamepad: ${this.gamepadName}` : 'Gamepad: not exposed by browser';
  }

  getAxesStatus(): string {
    return this.axesLabel;
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    const code = event.code || event.key;
    this.latest = { source: 'keyboard', label: `${code} (key: ${event.key})`, at: performance.now() };
    if (this.captureAction) {
      event.preventDefault();
      const codes = this.bindings[this.captureAction].keyboardCodes;
      if (!codes.includes(code)) codes.push(code);
      saveInputBindings(this.bindings);
      this.finishCapture(this.latest);
      return;
    }
    this.heldCodes.add(code);
    for (const action of ACTIONS) {
      if (!this.bindings[action].keyboardCodes.includes(code)) continue;
      event.preventDefault();
      if (!this.heldActions.has(action)) this.pendingActions.add(action);
      this.heldActions.add(action);
    }
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    const code = event.code || event.key;
    this.heldCodes.delete(code);
    for (const action of ACTIONS) {
      if (this.bindings[action].keyboardCodes.includes(code)) this.heldActions.delete(action);
    }
  };

  private recordGamepadButton(index: number): void {
    this.latest = { source: 'gamepad', label: `Button ${index}`, at: performance.now() };
    if (this.captureAction) {
      const buttons = this.bindings[this.captureAction].gamepadButtons;
      if (!buttons.includes(index)) buttons.push(index);
      saveInputBindings(this.bindings);
      this.finishCapture(this.latest);
      return;
    }
    for (const action of ACTIONS) {
      if (!this.bindings[action].gamepadButtons.includes(index)) continue;
      if (!this.heldActions.has(action)) this.pendingActions.add(action);
      this.heldActions.add(action);
    }
  }

  private finishCapture(sample: InputSample): void {
    const callback = this.captureCallback;
    this.cancelCapture();
    callback?.(sample);
  }

  private setGamepadDirection(action: 'up' | 'down' | 'left' | 'right', active: boolean): void {
    if (active) this.heldActions.add(action);
    else if (!this.bindings[action].gamepadButtons.some((button) => this.previousPadButtons.has(button))) this.heldActions.delete(action);
  }

  private axisControls(action: GameAction, x: number, y: number): boolean {
    return (action === 'left' && x < 0) || (action === 'right' && x > 0) || (action === 'up' && y < 0) || (action === 'down' && y > 0);
  }

  private readonly releaseAll = (): void => {
    this.heldCodes.clear();
    this.heldActions.clear();
    this.pendingActions.clear();
  };

  private destroy(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.releaseAll);
    this.releaseAll();
  }
}
