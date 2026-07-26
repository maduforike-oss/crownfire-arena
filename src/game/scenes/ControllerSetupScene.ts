import Phaser from 'phaser';
import { ACTIONS, bindingLabel, resetInputBindings, type GameAction } from '../controllers/InputBindings';
import { UnifiedInputController } from '../controllers/UnifiedInputController';
import { menuButton } from '../ui/MenuButton';
import { addPanel, addSceneBackdrop, addScreenTitle } from '../ui/ScenePresentation';

export class ControllerSetupScene extends Phaser.Scene {
  private inputController!: UnifiedInputController;
  private statusText!: Phaser.GameObjects.Text;
  private latestText!: Phaser.GameObjects.Text;

  constructor() {
    super('ControllerSetupScene');
  }

  create(): void {
    addSceneBackdrop(this, { theme: 'moonfang', alternateTheme: 'hollowmoon', imageAlpha: 0.84, veilAlpha: 0.34, particles: 34 });
    addScreenTitle(this, 'Controller Setup', 'VR EYE, BLUETOOTH REMOTE, KEYBOARD OR GAMEPAD', 0x77bfff).setY(70);
    addPanel(this, 370, 386, 610, 548, 0x77bfff, 0.91);
    addPanel(this, 965, 386, 500, 548, 0xa974ff, 0.91);
    this.inputController = new UnifiedInputController(this);

    this.add.text(100, 154, 'ACTION MAPPINGS', this.headingStyle()).setOrigin(0, 0.5);
    ACTIONS.forEach((action, index) => this.createBindingRow(action, 100, 198 + index * 46));

    this.add.text(750, 154, 'LIVE INPUT TEST', this.headingStyle()).setOrigin(0, 0.5);
    this.statusText = this.add.text(750, 194, '', this.bodyStyle('#dcecff')).setWordWrapWidth(430);
    this.latestText = this.add.text(750, 252, 'Latest event: waiting...', this.bodyStyle('#ffe1a0')).setWordWrapWidth(430);
    this.add.text(750, 316,
      '1. Pair VR EYE in iPad Bluetooth settings.\n2. Open this page and press every remote button.\n3. If nothing appears, switch the remote to game mode (commonly Function + B), reconnect, and retry.\n4. Tap Bind beside an action, then press the remote button.',
      this.bodyStyle('#d8d0c2')
    ).setLineSpacing(8).setWordWrapWidth(430);

    this.add.text(750, 475,
      'The game accepts keyboard-style remotes and standard browser gamepads. iPadOS may reserve volume, Home, and media buttons, so those events cannot always reach a webpage.',
      this.bodyStyle('#aebbd0')
    ).setLineSpacing(5).setWordWrapWidth(430);

    menuButton(this, 855, 608, 'Reset Defaults', () => {
      resetInputBindings();
      this.scene.restart();
    }, false, 210);
    menuButton(this, 1085, 608, 'Back', () => this.scene.start('MainMenuScene'), false, 190);
    this.add.text(640, 686, 'Default: arrows or WASD move | Enter or Space bomb | Shift special | E remote | Escape pause', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '13px', color: '#c6d7ee'
    }).setOrigin(0.5);
  }

  update(): void {
    this.inputController.update();
    this.statusText.setText(`${this.inputController.getGamepadStatus()}\n${this.inputController.getAxesStatus() || 'Axes: idle'}`);
    const latest = this.inputController.getLatestSample();
    if (latest) this.latestText.setText(`Latest ${latest.source}: ${latest.label}`);
  }

  private createBindingRow(action: GameAction, x: number, y: number): void {
    const actionName = action.toUpperCase();
    this.add.rectangle(x + 258, y, 520, 40, 0x11131b, 0.88).setStrokeStyle(1, 0x5d7699, 0.65);
    this.add.text(x + 12, y, actionName, {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '15px', color: '#ffe1a0'
    }).setOrigin(0, 0.5);
    const bindingText = this.add.text(x + 132, y, bindingLabel(this.inputController.getBindings()[action]), {
      fontFamily: 'Arial', fontSize: '13px', color: '#d9e7fb'
    }).setOrigin(0, 0.5).setWordWrapWidth(245);
    const button = this.add.rectangle(x + 466, y, 82, 30, 0x25324a, 0.95).setStrokeStyle(1, 0x77bfff).setInteractive({ useHandCursor: true });
    const label = this.add.text(x + 466, y, 'BIND', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '12px', color: '#ffffff'
    }).setOrigin(0.5);
    button.on('pointerover', () => button.setFillStyle(0x36527c, 1));
    button.on('pointerout', () => button.setFillStyle(0x25324a, 0.95));
    button.on('pointerdown', () => {
      label.setText('PRESS...');
      this.latestText.setText(`Binding ${actionName}: press a remote key or gamepad button now`);
      this.inputController.beginCapture(action, (sample) => {
        label.setText('BIND');
        bindingText.setText(bindingLabel(this.inputController.getBindings()[action]));
        this.latestText.setText(`${actionName} bound to ${sample.label}`);
      });
    });
  }

  private headingStyle(): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'Georgia', fontStyle: 'bold', fontSize: '19px', color: '#ffe1a0' };
  }

  private bodyStyle(color: string): Phaser.Types.GameObjects.Text.TextStyle {
    return { fontFamily: 'Arial', fontSize: '15px', color };
  }
}
