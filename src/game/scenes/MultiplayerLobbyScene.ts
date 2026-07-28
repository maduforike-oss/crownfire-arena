import Phaser from 'phaser';
import { CHARACTERS, getCharacter } from '../config/Characters';
import { SESSION } from '../config/GameConfig';
import { NetworkSession } from '../network/NetworkSession';
import type { NetworkMatchConfig } from '../network/NetworkProtocol';
import { menuButton } from '../ui/MenuButton';
import { addPanel, addSceneBackdrop, addScreenTitle } from '../ui/ScenePresentation';

export class MultiplayerLobbyScene extends Phaser.Scene {
  private readonly network = NetworkSession.get();
  private statusText?: Phaser.GameObjects.Text;
  private roomText?: Phaser.GameObjects.Text;
  private peersText?: Phaser.GameObjects.Text;
  private championText?: Phaser.GameObjects.Text;
  private configureButton?: Phaser.GameObjects.Container;
  private roomInput?: Phaser.GameObjects.DOMElement;
  private selectedIndex = 0;

  constructor() {
    super('MultiplayerLobbyScene');
  }

  create(): void {
    addSceneBackdrop(this, { theme: 'moonfang', alternateTheme: 'frostkeep', imageAlpha: 0.78, veilAlpha: 0.48 });
    addScreenTitle(this, 'Same-WiFi Arena', 'TWO DEVICES. ONE AUTHORITATIVE CROWNFIRE TRIAL.', 0x9dc8ff);
    addPanel(this, 640, 365, 720, 500, 0x9dc8ff, 0.91);

    this.add.text(640, 142, 'On the host PC, run  npm run multiplayer:host\nOpen the printed WiFi address on both devices.', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#d6ddeb',
      align: 'center',
      lineSpacing: 6
    }).setOrigin(0.5);

    this.statusText = this.add.text(640, 204, 'Choose Host or enter a five-character room code.', {
      fontFamily: 'Georgia',
      fontSize: '18px',
      color: '#f4ead2'
    }).setOrigin(0.5);
    this.roomText = this.add.text(640, 250, '', {
      fontFamily: 'Georgia',
      fontStyle: 'bold',
      fontSize: '34px',
      color: '#f7d783',
      stroke: '#08080c',
      strokeThickness: 4
    }).setOrigin(0.5);
    this.peersText = this.add.text(640, 286, '', {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '13px',
      color: '#9dc8ff'
    }).setOrigin(0.5);

    menuButton(this, 470, 350, 'Host Arena', () => void this.hostRoom(), false, 280);
    menuButton(this, 810, 350, 'Join Arena', () => void this.joinRoom(), false, 280);
    this.roomInput = this.add.dom(640, 417).createFromHTML(
      '<input class="crownfire-room-input" aria-label="LAN room code" maxlength="5" placeholder="ROOM CODE" autocomplete="off" autocapitalize="characters" spellcheck="false">'
    );

    this.add.text(458, 478, 'YOUR CHAMPION', {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '12px',
      color: '#b5a995'
    }).setOrigin(0.5);
    const left = this.add.text(390, 520, '<', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '30px', color: '#f7d783'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    const right = this.add.text(890, 520, '>', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '30px', color: '#f7d783'
    }).setOrigin(0.5).setInteractive({ useHandCursor: true });
    left.on('pointerdown', () => this.cycleChampion(-1));
    right.on('pointerdown', () => this.cycleChampion(1));
    this.championText = this.add.text(640, 520, '', {
      fontFamily: 'Georgia',
      fontSize: '22px',
      color: '#f4ead2'
    }).setOrigin(0.5);
    this.selectedIndex = Math.max(0, CHARACTERS.findIndex((character) => character.id === SESSION.character));
    this.refreshChampion();

    this.configureButton = menuButton(this, 640, 586, 'Configure Match', () => {
      if (this.network.role !== 'host' || this.network.connectedPeers < 2) return;
      SESSION.localPlayers = 1;
      if (SESSION.mode !== 'classic' && SESSION.mode !== 'shards') SESSION.mode = 'classic';
      this.scene.start('CharacterSelectScene');
    }, false, 330).setVisible(false);
    menuButton(this, 640, 656, 'Back', () => {
      this.network.leave();
      this.scene.start('MainMenuScene');
    }, false, 280);

    this.network.addEventListener('peers', this.onPeers);
    this.network.addEventListener('start', this.onStart);
    this.network.addEventListener('status', this.onStatus);
    this.network.addEventListener('networkError', this.onNetworkError);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    if (this.network.active) this.refreshRoomState();
  }

  private async hostRoom(): Promise<void> {
    this.statusText?.setText('Opening LAN room...');
    try {
      await this.network.host();
      this.refreshRoomState();
      this.network.send({ kind: 'profile', character: SESSION.character });
    } catch (error) {
      this.showError(error);
    }
  }

  private async joinRoom(): Promise<void> {
    const input = this.roomInput?.node.querySelector('input') as HTMLInputElement | null;
    const room = (input?.value || '').trim().toUpperCase();
    if (room.length !== 5) {
      this.statusText?.setText('Enter the five-character room code shown on the host.');
      return;
    }
    this.statusText?.setText(`Joining ${room}...`);
    try {
      await this.network.join(room);
      this.refreshRoomState();
      this.network.send({ kind: 'profile', character: SESSION.character });
    } catch (error) {
      this.showError(error);
    }
  }

  private cycleChampion(amount: number): void {
    this.selectedIndex = Phaser.Math.Wrap(this.selectedIndex + amount, 0, CHARACTERS.length);
    SESSION.character = CHARACTERS[this.selectedIndex].id;
    this.refreshChampion();
    if (this.network.active) this.network.send({ kind: 'profile', character: SESSION.character });
  }

  private refreshChampion(): void {
    const champion = getCharacter(CHARACTERS[this.selectedIndex].id);
    this.championText?.setText(`${champion.displayName}  |  ${champion.specialName}`);
    this.championText?.setColor(`#${champion.accentColor.toString(16).padStart(6, '0')}`);
  }

  private refreshRoomState(): void {
    this.roomText?.setText(this.network.room ? `ROOM  ${this.network.room}` : '');
    this.peersText?.setText(`${this.network.connectedPeers}/2 CHAMPIONS CONNECTED`);
    if (this.network.role === 'host') {
      this.statusText?.setText(this.network.connectedPeers >= 2
        ? 'Guest connected. Configure the match when ready.'
        : 'Share this room code with the second device.');
      this.configureButton?.setVisible(this.network.connectedPeers >= 2);
    } else {
      this.statusText?.setText('Connected. Waiting for the host to choose the trial.');
      this.configureButton?.setVisible(false);
    }
  }

  private readonly onPeers = (): void => {
    this.refreshRoomState();
    if (this.network.active) this.network.send({ kind: 'profile', character: SESSION.character });
  };

  private readonly onStatus = (event: Event): void => {
    const status = (event as CustomEvent<string>).detail;
    if (status === 'reconnecting') this.statusText?.setText('Connection interrupted. Rejoining the room...');
    else if (status === 'lost') this.statusText?.setText('Connection lost. Start or join a fresh room.');
  };

  private readonly onNetworkError = (event: Event): void => {
    this.statusText?.setText((event as CustomEvent<string>).detail);
  };

  private readonly onStart = (event: Event): void => {
    if (this.network.role !== 'guest') return;
    const config = (event as CustomEvent<NetworkMatchConfig>).detail;
    SESSION.map = config.map;
    SESSION.mode = config.mode;
    SESSION.character = config.guestCharacter;
    SESSION.localPlayers = 1;
    this.scene.start('GameScene');
  };

  private showError(error: unknown): void {
    this.statusText?.setText(error instanceof Error ? error.message : 'The LAN room could not be opened.');
  }

  private shutdown(): void {
    this.network.removeEventListener('peers', this.onPeers);
    this.network.removeEventListener('start', this.onStart);
    this.network.removeEventListener('status', this.onStatus);
    this.network.removeEventListener('networkError', this.onNetworkError);
  }
}
