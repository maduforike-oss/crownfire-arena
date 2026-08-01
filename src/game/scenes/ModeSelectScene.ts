import Phaser from 'phaser';
import { MODES } from '../config/Modes';
import { SESSION } from '../config/GameConfig';
import { menuButton } from '../ui/MenuButton';
import { addPanel, addSceneBackdrop, addScreenTitle } from '../ui/ScenePresentation';
import { NetworkSession } from '../network/NetworkSession';

export class ModeSelectScene extends Phaser.Scene {
  constructor() {
    super('ModeSelectScene');
  }

  create(): void {
    const network = NetworkSession.get();
    addSceneBackdrop(this, { theme: 'moonfang', alternateTheme: 'hollowmoon', imageAlpha: 0.72, veilAlpha: 0.42 });
    addScreenTitle(this, 'Select Trial', 'CHOOSE THE LAW OF THIS CROWDFIRE MATCH', 0x9dc8ff);
    addPanel(this, 640, 350, 760, 470, 0x9dc8ff, 0.88);

    MODES.forEach((mode, index) => {
      const y = 140 + index * 43;
      const selected = mode.id === SESSION.mode;
      this.add.rectangle(640, y, 700, 40, selected ? 0x202432 : 0x15171f, 0.94)
        .setStrokeStyle(2, selected ? 0xf7d783 : 0x4d5566);
      this.add.text(316, y - 14, `${mode.name}${mode.implemented ? '' : '  |  COMING SOON'}`, {
        fontFamily: 'Georgia',
        fontSize: '16px',
        color: mode.implemented ? '#f4ead2' : '#82776b'
      });
      this.add.text(316, y + 4, mode.objective, {
        fontFamily: 'Arial',
        fontSize: '11px',
        color: '#b5bdd0'
      });
      if (selected) {
        this.add.text(944, y - 7, 'SELECTED', {
          fontFamily: 'Arial',
          fontStyle: 'bold',
          fontSize: '11px',
          color: '#f7d783'
        });
      }
      const selectable = mode.implemented && (!network.active || mode.id === 'grand');
      if (selectable) {
        this.add.zone(640, y, 700, 40)
          .setInteractive({ useHandCursor: true })
          .on('pointerdown', () => {
            SESSION.mode = mode.id;
            if (mode.id === 'sandbox') SESSION.localPlayers = 1;
            this.scene.restart();
          });
      }
    });

    const playersY = 516;
    this.add.rectangle(640, playersY, 700, 48, 0x17151d, 0.94).setStrokeStyle(1, 0xd8a84e, 0.6);
    this.add.text(316, playersY - 12, network.active
      ? `ONLINE RUMBLE  ${network.connectedPeers}/4 HUMAN`
      : `PLAYERS  ${SESSION.localPlayers}     AI  ${SESSION.botDifficulty.toUpperCase()}`, {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '15px',
      color: '#f4ead2'
    });
    this.add.text(
      610,
      playersY - 10,
      network.active
        ? `ROOM ${network.room}  |  open seats become arena bots`
        : SESSION.mode === 'sandbox'
        ? 'Sandbox uses one champion and a resilient practice rival.'
        : SESSION.mode === 'arcade'
          ? SESSION.localPlayers === 2
            ? 'P2  Arrows | Enter primary | P secondary | Right Shift signature'
            : 'P1  WASD | Space primary | E secondary | Shift signature'
        : SESSION.localPlayers === 2
          ? 'P2  Arrows | Enter | Right Shift | P'
          : 'P1  WASD | Space | Shift | E',
      {
        fontFamily: 'Georgia',
        fontSize: '13px',
        color: '#b5a995'
      }
    );
    this.add.zone(470, playersY, 350, 48)
      .setInteractive({ useHandCursor: !network.active && SESSION.mode !== 'sandbox' })
      .on('pointerdown', () => {
        if (network.active || SESSION.mode === 'sandbox') return;
        SESSION.localPlayers = SESSION.localPlayers === 1 ? 2 : 1;
        this.scene.restart();
      });
    this.add.zone(810, playersY, 330, 48)
      .setInteractive({ useHandCursor: !network.active && SESSION.mode !== 'sandbox' })
      .on('pointerdown', () => {
        if (network.active || SESSION.mode === 'sandbox') return;
        const difficulties = ['easy', 'normal', 'hard'] as const;
        SESSION.botDifficulty = difficulties[(difficulties.indexOf(SESSION.botDifficulty) + 1) % difficulties.length];
        this.scene.restart();
      });

    menuButton(this, 490, 656, 'Back', () => this.scene.start('CharacterSelectScene'), false, 260);
    menuButton(this, 790, 656, 'Continue', () => this.scene.start('MapSelectScene'), false, 260);
  }
}
