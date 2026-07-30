import Phaser from 'phaser';
import { SocialApi } from '../social/SocialApi';
import type { FriendRecord, RivalryRecord, SocialMatchRecord } from '../social/SocialTypes';
import { addPanel, addSceneBackdrop, addScreenTitle } from '../ui/ScenePresentation';
import { menuButton } from '../ui/MenuButton';

export class SocialHubScene extends Phaser.Scene {
  private api = SocialApi.get();
  private status?: Phaser.GameObjects.Text;
  private friendInput?: Phaser.GameObjects.DOMElement;

  constructor() {
    super('SocialHubScene');
  }

  create(): void {
    addSceneBackdrop(this, { theme: 'hollowmoon', alternateTheme: 'moonfang', imageAlpha: 0.7, veilAlpha: 0.58 });
    addScreenTitle(this, 'Rivalry Chronicle', 'YOUR RECORD. YOUR ALLIES. THE RIVALS WHO KEEP COMING BACK.', 0xc79cff);
    addPanel(this, 230, 374, 360, 492, 0xc79cff, 0.93);
    addPanel(this, 640, 374, 410, 492, 0x9dc8ff, 0.93);
    addPanel(this, 1050, 374, 360, 492, 0xd8a84e, 0.93);
    this.status = this.add.text(640, 660, 'Opening your Chronicle...', {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '12px',
      color: '#b8c8df'
    }).setOrigin(0.5);
    menuButton(this, 160, 666, 'Back', () => this.scene.start('MainMenuScene'), false, 210);
    menuButton(this, 1120, 666, 'Online Rumble', () => this.scene.start('MultiplayerLobbyScene'), false, 240);
    void this.loadChronicle();
  }

  private async loadChronicle(): Promise<void> {
    if (!this.api.available) {
      const profile = await this.api.ensureIdentity();
      this.drawProfile(profile.displayName, profile.handle, profile.crowns, profile.wins);
      this.status?.setText('Online Chronicle needs the Crowdfire social service. Local progress remains safe.');
      return;
    }
    try {
      const profile = await this.api.ensureIdentity();
      this.drawProfile(profile.displayName, profile.handle, profile.crowns, profile.wins);
      const [matches, rivalries, friends] = await Promise.all([
        this.api.history(8),
        this.api.rivalries(),
        this.api.friends()
      ]);
      this.drawHistory(matches);
      this.drawRivalries(rivalries);
      this.drawFriends(friends);
      this.status?.setText('Chronicle synced. Invite by handle or share a Rumble room link.');
    } catch (error) {
      this.status?.setText(error instanceof Error ? error.message : 'The Chronicle could not be opened.');
    }
  }

  private drawProfile(name: string, handle: string, crowns: number, wins: number): void {
    this.add.text(230, 154, name, {
      fontFamily: 'Georgia',
      fontStyle: 'bold',
      fontSize: '25px',
      color: '#f4ead2'
    }).setOrigin(0.5);
    this.add.text(230, 188, `@${handle}`, {
      fontFamily: 'Arial',
      fontSize: '12px',
      color: '#c79cff'
    }).setOrigin(0.5);
    this.add.text(230, 226, `CROWNS  ${crowns}     WINS  ${wins}`, {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '13px',
      color: '#f7d783'
    }).setOrigin(0.5);
    this.add.text(230, 278, 'FRIENDS & INVITES', {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '11px',
      color: '#b5a995'
    }).setOrigin(0.5);
    this.friendInput = this.add.dom(230, 318).createFromHTML(
      '<input class="crownfire-room-input crowdfire-friend-input" aria-label="Friend handle" maxlength="32" placeholder="@RIVAL-HANDLE" autocomplete="off" spellcheck="false">'
    );
    menuButton(this, 230, 365, 'Send Friend Invite', () => void this.sendFriendInvite(), false, 280);
  }

  private drawFriends(friends: FriendRecord[]): void {
    this.add.text(230, 416, 'YOUR CIRCLE', {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '11px',
      color: '#9dc8ff'
    }).setOrigin(0.5);
    if (!friends.length) {
      this.add.text(230, 462, 'No linked rivals yet.\nInvite someone by their handle.', {
        fontFamily: 'Georgia',
        fontSize: '14px',
        color: '#928a80',
        align: 'center',
        lineSpacing: 7
      }).setOrigin(0.5);
      return;
    }
    friends.slice(0, 5).forEach((friend, index) => {
      const y = 452 + index * 37;
      this.add.text(82, y, `${friend.profile.online ? '●' : '○'}  ${friend.profile.displayName}`, {
        fontFamily: 'Georgia',
        fontSize: '14px',
        color: friend.profile.online ? '#9de6bd' : '#c5bdaf'
      });
      this.add.text(355, y + 2, friend.profile.online && friend.profile.roomCode
        ? 'JOIN RUMBLE'
        : friend.status.replace('-', ' ').toUpperCase(), {
        fontFamily: 'Arial',
        fontSize: '8px',
        color: '#9dc8ff'
      }).setOrigin(1, 0);
      if (friend.profile.online && friend.profile.roomCode) {
        this.add.zone(230, y + 9, 300, 30).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          const url = new URL(window.location.href);
          url.searchParams.set('join', friend.profile.roomCode ?? '');
          window.history.replaceState({}, '', url);
          this.scene.start('MultiplayerLobbyScene');
        });
      } else if (friend.status === 'pending-incoming') {
        this.add.zone(230, y + 9, 300, 30).setInteractive({ useHandCursor: true }).on('pointerdown', () => {
          void this.api.acceptFriend(friend.profile.id).then(() => this.scene.restart());
        });
      }
    });
  }

  private drawHistory(matches: SocialMatchRecord[]): void {
    this.add.text(640, 154, 'RECENT RUMBLES', {
      fontFamily: 'Georgia',
      fontStyle: 'bold',
      fontSize: '20px',
      color: '#9dc8ff'
    }).setOrigin(0.5);
    if (!matches.length) {
      this.add.text(640, 330, 'Your first online Rumble\nwill be recorded here.', {
        fontFamily: 'Georgia',
        fontSize: '17px',
        color: '#928a80',
        align: 'center',
        lineSpacing: 8
      }).setOrigin(0.5);
      return;
    }
    matches.slice(0, 8).forEach((match, index) => {
      const y = 200 + index * 49;
      const self = match.participants.find((participant) => participant.profileId === this.api.profile?.id);
      this.add.rectangle(640, y, 364, 40, 0x10141e, 0.82).setStrokeStyle(1, self?.won ? 0xd8a84e : 0x3f5068, 0.7);
      this.add.text(474, y - 12, self?.won ? 'VICTORY' : `PLACE ${self?.placement ?? '-'}`, {
        fontFamily: 'Arial',
        fontStyle: 'bold',
        fontSize: '10px',
        color: self?.won ? '#f7d783' : '#9dc8ff'
      });
      this.add.text(474, y + 4, `${match.map.toUpperCase()}  •  ${new Date(match.endedAt).toLocaleDateString()}`, {
        fontFamily: 'Arial',
        fontSize: '9px',
        color: '#b5a995'
      });
      this.add.text(806, y - 5, match.opponents.map((opponent) => opponent.displayName).slice(0, 2).join(', ') || 'Arena bots', {
        fontFamily: 'Georgia',
        fontSize: '11px',
        color: '#e4dccb'
      }).setOrigin(1, 0.5);
    });
  }

  private drawRivalries(rivalries: RivalryRecord[]): void {
    this.add.text(1050, 154, 'RIVALRIES', {
      fontFamily: 'Georgia',
      fontStyle: 'bold',
      fontSize: '20px',
      color: '#f7d783'
    }).setOrigin(0.5);
    if (!rivalries.length) {
      this.add.text(1050, 330, 'Face the same champion twice\nto begin a remembered rivalry.', {
        fontFamily: 'Georgia',
        fontSize: '16px',
        color: '#928a80',
        align: 'center',
        lineSpacing: 8
      }).setOrigin(0.5);
      return;
    }
    rivalries.slice(0, 6).forEach((rivalry, index) => {
      const y = 210 + index * 66;
      this.add.rectangle(1050, y, 310, 56, 0x17131b, 0.82).setStrokeStyle(1, 0x8b6f48, 0.7);
      this.add.text(910, y - 18, rivalry.profile.displayName, {
        fontFamily: 'Georgia',
        fontStyle: 'bold',
        fontSize: '14px',
        color: '#f4ead2'
      });
      this.add.text(910, y + 3, `${rivalry.wins}–${rivalry.losses}  •  ${rivalry.games} battles`, {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: '#c7bda9'
      });
      const streak = rivalry.currentStreak === 0
        ? 'EVEN'
        : rivalry.currentStreak > 0 ? `YOU +${rivalry.currentStreak}` : `RIVAL +${Math.abs(rivalry.currentStreak)}`;
      this.add.text(1188, y - 4, streak, {
        fontFamily: 'Arial',
        fontStyle: 'bold',
        fontSize: '9px',
        color: rivalry.currentStreak >= 0 ? '#9de6bd' : '#ff9d8f'
      }).setOrigin(1, 0.5);
    });
  }

  private async sendFriendInvite(): Promise<void> {
    const input = this.friendInput?.node.querySelector('input') as HTMLInputElement | null;
    const value = input?.value.trim().replace(/^@/, '') ?? '';
    if (!value) {
      this.status?.setText('Enter a profile handle first.');
      return;
    }
    try {
      const friend = await this.api.inviteFriend(value);
      this.status?.setText(`Friend invite sent to ${friend.displayName}.`);
      if (input) input.value = '';
      this.time.delayedCall(700, () => this.scene.restart());
    } catch (error) {
      this.status?.setText(error instanceof Error ? error.message : 'Friend invite failed.');
    }
  }
}
