import Phaser from 'phaser';
import { CHARACTERS, getCharacter } from '../config/Characters';
import { SESSION } from '../config/GameConfig';
import { NetworkSession } from '../network/NetworkSession';
import type { NetworkMatchConfig } from '../network/NetworkProtocol';
import { menuButton } from '../ui/MenuButton';
import { addPanel, addSceneBackdrop, addScreenTitle } from '../ui/ScenePresentation';
import { SocialApi } from '../social/SocialApi';

export class MultiplayerLobbyScene extends Phaser.Scene {
  private readonly network = NetworkSession.get();
  private statusText?: Phaser.GameObjects.Text;
  private roomText?: Phaser.GameObjects.Text;
  private peersText?: Phaser.GameObjects.Text;
  private championText?: Phaser.GameObjects.Text;
  private configureButton?: Phaser.GameObjects.Container;
  private readyButton?: Phaser.GameObjects.Container;
  private shareButton?: Phaser.GameObjects.Container;
  private connectButtons: Phaser.GameObjects.Container[] = [];
  private roomInput?: Phaser.GameObjects.DOMElement;
  private selectedIndex = 0;
  private ready = false;

  constructor() {
    super('MultiplayerLobbyScene');
  }

  create(): void {
    addSceneBackdrop(this, { theme: 'moonfang', alternateTheme: 'frostkeep', imageAlpha: 0.78, veilAlpha: 0.48 });
    addScreenTitle(this, 'Online Rumble', 'FOUR SEATS. PRIVATE INVITES. RIVALRIES THAT REMEMBER.', 0x9dc8ff);
    addPanel(this, 640, 365, 720, 500, 0x9dc8ff, 0.91);

    this.add.text(640, 142, SocialApi.get().available
      ? 'Create a private room or enter a six-character invite code.'
      : 'Online service is not configured in this build. Solo and local play remain available.', {
      fontFamily: 'Arial',
      fontSize: '15px',
      color: '#d6ddeb',
      align: 'center',
      lineSpacing: 6
    }).setOrigin(0.5);

    this.statusText = this.add.text(640, 204, 'Choose Create or enter a six-character Rumble code.', {
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

    this.connectButtons = [
      menuButton(this, 470, 350, 'Create Rumble', () => void this.hostRoom(), false, 280),
      menuButton(this, 810, 350, 'Join Rumble', () => void this.joinRoom(), false, 280)
    ];
    this.roomInput = this.add.dom(640, 417).createFromHTML(
      '<input class="crownfire-room-input" aria-label="Rumble room code" maxlength="6" placeholder="ROOM CODE" autocomplete="off" autocapitalize="characters" spellcheck="false">'
    );
    this.connectButtons.push(
      menuButton(this, 900, 417, 'Spectate', () => void this.joinRoom(true), false, 180)
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

    this.readyButton = menuButton(this, 470, 586, 'Toggle Ready', () => {
      if (!this.network.active || this.network.role === 'spectator') return;
      this.ready = !this.ready;
      this.network.setReady(this.ready);
      this.refreshRoomState();
    }, false, 280).setVisible(false);
    this.shareButton = menuButton(this, 810, 586, 'Share Invite', () => void this.shareInvite(), false, 280)
      .setVisible(false);
    this.configureButton = menuButton(this, 640, 420, 'Choose Rumble Arena', () => {
      if (this.network.role !== 'host' || !this.canConfigure()) return;
      SESSION.localPlayers = 1;
      SESSION.mode = 'grand';
      this.scene.start('CharacterSelectScene');
    }, false, 330).setVisible(false);
    menuButton(this, 1060, 666, 'Profile', () => this.scene.start('SocialHubScene'), false, 220);
    menuButton(this, 220, 666, 'Back', () => {
      this.network.leave();
      this.scene.start('MainMenuScene');
    }, false, 220);

    this.network.addEventListener('peers', this.onPeers);
    this.network.addEventListener('room', this.onRoom);
    this.network.addEventListener('start', this.onStart);
    this.network.addEventListener('status', this.onStatus);
    this.network.addEventListener('networkError', this.onNetworkError);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);

    if (this.network.active) this.refreshRoomState();
    else void this.acceptInviteFromUrl();
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

  private async joinRoom(spectator = false): Promise<void> {
    const input = this.roomInput?.node.querySelector('input') as HTMLInputElement | null;
    const room = (input?.value || '').trim().toUpperCase();
    if (room.length !== 6) {
      this.statusText?.setText('Enter the six-character room code shown by the host.');
      return;
    }
    this.statusText?.setText(`Joining ${room}...`);
    try {
      await this.network.join(room, spectator);
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
    if (this.network.active) {
      this.ready = false;
      this.network.updateLoadout(SESSION.character);
    }
  }

  private refreshChampion(): void {
    const champion = getCharacter(CHARACTERS[this.selectedIndex].id);
    this.championText?.setText(`${champion.displayName}  |  ${champion.specialName}`);
    this.championText?.setColor(`#${champion.accentColor.toString(16).padStart(6, '0')}`);
  }

  private refreshRoomState(): void {
    this.roomText?.setText(this.network.room ? `ROOM  ${this.network.room}` : '');
    const seatLines = this.network.roomState?.seats.map((seat) => {
      const state = !seat.profileId ? 'OPEN / BOT FILL' : !seat.connected ? 'RECONNECTING' : seat.ready ? 'READY' : 'CHOOSING';
      return `${seat.seat + 1}. ${seat.displayName.toUpperCase()}  •  ${state}`;
    }) ?? [];
    this.peersText?.setText(seatLines.join('     '));
    this.peersText?.setFontSize(seatLines.join('').length > 90 ? 9 : 11);
    if (this.network.role === 'host') {
      this.statusText?.setText(this.canConfigure()
        ? 'The roster is ready. Choose an arena; open seats become competitive bots.'
        : 'Share the invite, choose a champion, then every human seat marks Ready.');
      this.configureButton?.setVisible(this.canConfigure());
    } else {
      this.statusText?.setText(this.network.role === 'spectator'
        ? 'Spectating this rivalry. The host will begin the Rumble.'
        : 'Connected. Choose your champion, mark Ready, and wait for the host.');
      this.configureButton?.setVisible(false);
    }
    this.readyButton?.setVisible(this.network.active && this.network.role !== 'spectator');
    this.shareButton?.setVisible(this.network.active);
    this.roomInput?.setVisible(!this.network.active);
    for (const button of this.connectButtons) button.setVisible(!this.network.active);
  }

  private readonly onPeers = (): void => {
    this.refreshRoomState();
  };

  private readonly onRoom = (): void => {
    const self = this.network.roomState?.seats.find((seat) => seat.profileId === this.network.clientId);
    this.ready = Boolean(self?.ready);
    this.refreshRoomState();
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
    if (this.network.role === 'host') return;
    const config = (event as CustomEvent<NetworkMatchConfig>).detail;
    SESSION.map = config.map;
    SESSION.mode = config.mode;
    SESSION.character = config.players?.find((seat) => seat.profileId === this.network.clientId)?.character
      ?? SESSION.character;
    SESSION.localPlayers = 1;
    this.scene.start('GameScene');
  };

  private canConfigure(): boolean {
    const humans = this.network.roomState?.seats.filter((seat) => seat.profileId && seat.connected) ?? [];
    return humans.length > 0 && humans.every((seat) => seat.ready);
  }

  private async shareInvite(): Promise<void> {
    const url = this.network.roomState?.inviteUrl;
    if (!url) return;
    try {
      if (navigator.share) await navigator.share({ title: 'Crowdfire Rumble', text: `Join room ${this.network.room}`, url });
      else await navigator.clipboard.writeText(url);
      this.statusText?.setText('Invite link ready. Send it to your rivals.');
    } catch {
      this.statusText?.setText(`Share room code ${this.network.room}.`);
    }
  }

  private async acceptInviteFromUrl(): Promise<void> {
    const room = new URLSearchParams(window.location.search).get('join')?.trim().toUpperCase();
    if (!room || room.length !== 6) return;
    const cleanUrl = new URL(window.location.href);
    cleanUrl.searchParams.delete('join');
    window.history.replaceState({}, '', cleanUrl);
    const input = this.roomInput?.node.querySelector('input') as HTMLInputElement | null;
    if (input) input.value = room;
    this.statusText?.setText(`Invite ${room} found. Joining...`);
    await this.joinRoom();
  }

  private showError(error: unknown): void {
    this.statusText?.setText(error instanceof Error ? error.message : 'The LAN room could not be opened.');
  }

  private shutdown(): void {
    this.network.removeEventListener('peers', this.onPeers);
    this.network.removeEventListener('room', this.onRoom);
    this.network.removeEventListener('start', this.onStart);
    this.network.removeEventListener('status', this.onStatus);
    this.network.removeEventListener('networkError', this.onNetworkError);
  }
}
