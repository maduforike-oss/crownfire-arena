import Phaser from 'phaser';
import type { Player } from '../entities/Player';
import type { ModeDef } from '../config/Modes';
import { getPowerUp } from '../config/PowerUps';
import { getCharacter } from '../config/Characters';
import type { ActiveEffectViewModel } from '../config/PresentationConfig';

export class HUD {
  private health!: Phaser.GameObjects.Text;
  private stats!: Phaser.GameObjects.Text;
  private shards!: Phaser.GameObjects.Text;
  private objective!: Phaser.GameObjects.Text;
  private bots!: Phaser.GameObjects.Text;
  private timer!: Phaser.GameObjects.Text;
  private special!: Phaser.GameObjects.Text;
  private specialHint!: Phaser.GameObjects.Text;
  private specialBar!: Phaser.GameObjects.Rectangle;
  private powerIcon!: Phaser.GameObjects.Image;
  private powerText!: Phaser.GameObjects.Text;
  private activePanel!: Phaser.GameObjects.Container;
  private lastPulseKey = '';
  private compact = false;

  constructor(private readonly scene: Phaser.Scene) {}

  create(mode: ModeDef, compact = false): void {
    this.compact = compact;
    if (compact) {
      this.createCompact(mode);
      return;
    }
    const top = this.scene.add.rectangle(640, 34, 720, 58, 0x0b0c12, 0.96).setStrokeStyle(2, 0xd8a84e, 0.64).setDepth(100);
    this.scene.add.text(640, 13, 'CURRENT OBJECTIVE', { fontFamily: 'Arial', fontStyle: 'bold', fontSize: '10px', color: '#d8a84e' }).setOrigin(0.5).setDepth(101);
    this.objective = this.scene.add.text(640, 36, mode.objective, {
      fontFamily: 'Georgia', fontSize: '17px', color: '#f4ead2', align: 'center', wordWrap: { width: 650 }
    }).setOrigin(0.5).setDepth(101);
    top.setScrollFactor(0);

    this.makeRail(130, 360, 236, 674, 0xf06a31);
    this.makeRail(1150, 360, 236, 674, 0xa974ff);

    this.scene.add.text(130, 61, 'CHAMPION', { fontFamily: 'Arial', fontStyle: 'bold', fontSize: '11px', color: '#d8a84e' }).setOrigin(0.5);
    this.scene.add.rectangle(130, 111, 190, 72, 0x17151d, 0.9).setStrokeStyle(1, 0x7d5a2e, 0.75);
    this.health = this.scene.add.text(130, 92, '', { fontFamily: 'Georgia', fontSize: '22px', color: '#f7d783', align: 'center' }).setOrigin(0.5);
    this.scene.add.text(130, 143, 'ARENA LOADOUT', { fontFamily: 'Arial', fontStyle: 'bold', fontSize: '11px', color: '#d8a84e' }).setOrigin(0.5);
    this.stats = this.scene.add.text(130, 190, '', { fontFamily: 'Arial', fontStyle: 'bold', fontSize: '15px', color: '#f4ead2', align: 'center', lineSpacing: 10 }).setOrigin(0.5);
    this.shards = this.scene.add.text(130, 258, '', { fontFamily: 'Georgia', fontSize: '19px', color: '#9ec8ff' }).setOrigin(0.5);

    this.scene.add.text(130, 314, 'SIGNATURE POWER', { fontFamily: 'Arial', fontStyle: 'bold', fontSize: '11px', color: '#d9b8ff' }).setOrigin(0.5);
    this.scene.add.rectangle(130, 354, 190, 58, 0x17151d, 0.9).setStrokeStyle(1, 0xa974ff, 0.55);
    this.special = this.scene.add.text(130, 341, '', { fontFamily: 'Georgia', fontSize: '15px', color: '#eadcff', align: 'center', wordWrap: { width: 174 } }).setOrigin(0.5);
    this.scene.add.rectangle(130, 373, 164, 5, 0x09080c, 1);
    this.specialBar = this.scene.add.rectangle(48, 373, 164, 5, 0xa974ff, 0.95).setOrigin(0, 0.5);
    this.specialHint = this.scene.add.text(130, 393, '', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '10px', color: '#a99eb4', align: 'center'
    }).setOrigin(0.5);

    this.scene.add.text(130, 421, 'LAST RUNE', { fontFamily: 'Arial', fontStyle: 'bold', fontSize: '11px', color: '#d8a84e' }).setOrigin(0.5);
    this.scene.add.circle(130, 486, 46, 0xd8a84e, 0.05).setStrokeStyle(1, 0xd8a84e, 0.35);
    this.powerIcon = this.scene.add.image(130, 486, 'power-fallback').setDisplaySize(76, 76).setAlpha(0.45);
    this.powerText = this.scene.add.text(130, 544, 'No rune held', { fontFamily: 'Georgia', fontSize: '15px', color: '#958a78', align: 'center', wordWrap: { width: 180 } }).setOrigin(0.5);

    this.scene.add.text(1150, 61, 'MATCH STATUS', { fontFamily: 'Arial', fontStyle: 'bold', fontSize: '11px', color: '#9ec8ff' }).setOrigin(0.5);
    this.bots = this.scene.add.text(1150, 100, '', { fontFamily: 'Georgia', fontSize: '21px', color: '#bad7ff' }).setOrigin(0.5);
    this.timer = this.scene.add.text(1150, 145, '', { fontFamily: 'Georgia', fontSize: '36px', color: '#f4ead2' }).setOrigin(0.5);
    this.scene.add.text(1150, 192, 'ACTIVE EFFECTS', { fontFamily: 'Arial', fontStyle: 'bold', fontSize: '11px', color: '#d9b8ff' }).setOrigin(0.5);
    this.activePanel = this.scene.add.container(1150, 220);
    this.scene.add.text(1150, 580, 'CONTROLS', { fontFamily: 'Arial', fontStyle: 'bold', fontSize: '11px', color: '#d8a84e' }).setOrigin(0.5);
    this.scene.add.text(1150, 625, 'WASD  Move\nSPACE  Rune bomb\nSHIFT  Special\nE  Remote hex (armed)', {
      fontFamily: 'Arial', fontSize: '13px', color: '#bdb4a5', align: 'left', lineSpacing: 7
    }).setOrigin(0.5);
  }

  private createCompact(mode: ModeDef): void {
    this.scene.add.rectangle(640, 32, 980, 58, 0x090a10, 0.94)
      .setStrokeStyle(2, 0xd8a84e, 0.52)
      .setDepth(100);
    this.health = this.scene.add.text(210, 21, '', {
      fontFamily: 'Georgia', fontSize: '20px', color: '#f7d783'
    }).setOrigin(0.5).setDepth(101);
    this.stats = this.scene.add.text(325, 20, '', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '13px', color: '#f4ead2', align: 'center'
    }).setOrigin(0.5).setDepth(101);
    this.shards = this.scene.add.text(430, 20, '', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '13px', color: '#9ec8ff'
    }).setOrigin(0.5).setDepth(101);
    const compactObjective = mode.id === 'sandbox'
      ? 'Test every rune in the lab'
      : mode.id === 'classic'
        ? 'Eliminate all rivals'
        : mode.id === 'shards'
          ? 'Collect 10 Crown Shards'
          : mode.id === 'grand'
            ? 'Rumble: last champion standing'
          : mode.objective;
    this.objective = this.scene.add.text(585, 20, compactObjective, {
      fontFamily: 'Georgia', fontSize: '13px', color: '#f4ead2', align: 'center', wordWrap: { width: 220 }
    }).setOrigin(0.5).setDepth(101);
    this.special = this.scene.add.text(760, 17, '', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '12px', color: '#eadcff', align: 'center'
    }).setOrigin(0.5).setDepth(101);
    this.specialBar = this.scene.add.rectangle(705, 45, 110, 4, 0xa974ff, 0.95)
      .setOrigin(0, 0.5)
      .setDepth(101);
    this.specialHint = this.scene.add.text(760, 53, '', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '10px', color: '#a99eb4', align: 'center'
    }).setOrigin(0.5).setDepth(101);
    this.bots = this.scene.add.text(905, 18, '', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '12px', color: '#bad7ff'
    }).setOrigin(0.5).setDepth(101);
    this.timer = this.scene.add.text(1010, 39, '', {
      fontFamily: 'Georgia', fontSize: '20px', color: '#f4ead2'
    }).setOrigin(0.5).setDepth(101);
    this.powerIcon = this.scene.add.image(520, 46, 'power-fallback')
      .setDisplaySize(22, 22)
      .setAlpha(0.45)
      .setDepth(101);
    this.powerText = this.scene.add.text(535, 46, 'NO RUNE', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '9px', color: '#958a78'
    }).setOrigin(0, 0.5).setDepth(101);
    this.activePanel = this.scene.add.container(112, 170).setDepth(104);
  }

  update(player: Player, livingBots: number, elapsedMs: number): void {
    const character = getCharacter(player.character);
    this.health.setText(`${'♥'.repeat(Math.max(0, player.stats.health))}${'♡'.repeat(Math.max(0, player.stats.maxHealth - player.stats.health))}`);
    this.stats.setText(this.compact
      ? `BOMB ${player.stats.activeBombs}/${player.stats.maxBombs}  R${player.stats.blastRadius}`
      : `BOMBS  ${player.stats.activeBombs}/${player.stats.maxBombs}\nBLAST RADIUS  ${player.stats.blastRadius}`);
    this.shards.setText(this.compact ? `SHARDS ${player.shards}` : `CROWN SHARDS  ${player.shards}`);
    this.bots.setText(this.compact ? `${livingBots} RIVALS` : `${livingBots} RIVALS REMAIN`);
    const seconds = Math.floor(elapsedMs / 1000);
    this.timer.setText(`${String(Math.floor(seconds / 60)).padStart(2, '0')}:${String(seconds % 60).padStart(2, '0')}`);
    const cooldown = Math.max(0, player.specialCooldownMs);
    const storedPower = player.storedPower ? getPowerUp(player.storedPower) : undefined;
    this.special.setText(storedPower
      ? `${storedPower.name}${this.compact ? ' ' : '\n'}STORED`
      : cooldown > 0
        ? `${character.specialName}${this.compact ? ' ' : '\n'}${Math.ceil(cooldown / 1000)}s`
        : `${character.specialName}${this.compact ? ' ' : '\n'}READY`);
    const cooldownMax = player.character === 'wolf' ? 7000 : player.character === 'raven' ? 8000 : player.character === 'dragon' || player.character === 'frost' ? 10000 : 12000;
    const specialWidth = this.compact ? 110 : 164;
    this.specialBar.displayWidth = storedPower ? specialWidth : specialWidth * (cooldown > 0 ? 1 - Math.min(1, cooldown / cooldownMax) : 1);
    this.specialBar.setFillStyle(storedPower?.color ?? (cooldown > 0 ? 0x6d4b88 : character.accentColor));
    this.specialHint.setText(
      storedPower
        ? this.compact ? 'POWER TO RELEASE' : 'POWER / SHIFT TO RELEASE'
        : player.character === 'dragon'
        ? this.compact ? 'LINE R6' : 'FACING LINE  •  RANGE 6'
        : player.character === 'frost'
          ? this.compact ? 'ICE TRAIL 5s' : 'MOVE TO LAY ICE  •  5s'
          : player.character === 'stone'
            ? this.compact ? 'SHIELD 10s' : 'ABSORBS NEXT HIT  •  10s'
            : ''
    );

    if (player.lastPowerUp) {
      const power = getPowerUp(player.lastPowerUp);
      this.powerIcon.setTexture(this.scene.textures.exists(power.assetKey) ? power.assetKey : 'power-fallback').setAlpha(1);
      this.powerText.setText(this.compact ? power.name.toUpperCase() : power.name).setColor('#f4ead2');
    } else {
      this.powerIcon.setTexture('power-fallback').setAlpha(0.45);
      this.powerText.setText(this.compact ? 'NO RUNE' : 'No rune held').setColor('#958a78');
    }
    this.objective.setColor(player.stats.temporaryGhostMode > 0 ? '#cdd8ff' : '#f4ead2');
    this.renderActiveEffects(player);
  }

  pulse(key: 'health' | 'stats' | 'special' | 'power', color = '#f7d783'): void {
    const target = key === 'health' ? this.health : key === 'stats' ? this.stats : key === 'special' ? this.special : this.powerText;
    const original = target.style.color as string;
    target.setColor(color);
    this.scene.tweens.add({ targets: target, scale: 1.12, duration: 90, yoyo: true, onComplete: () => target.setScale(1).setColor(original) });
  }

  private makeRail(x: number, y: number, width: number, height: number, accent: number): void {
    this.scene.add.rectangle(x + 5, y + 7, width, height, 0x000000, 0.45);
    this.scene.add.rectangle(x, y, width, height, 0x0b0c12, 0.93).setStrokeStyle(2, accent, 0.42);
    this.scene.add.rectangle(x, y, width - 14, height - 14, 0x000000, 0).setStrokeStyle(1, 0xf7dfaa, 0.1);
  }

  private renderActiveEffects(player: Player): void {
    this.activePanel.removeAll(true);
    const effects: ActiveEffectViewModel[] = [];
    if (player.storedPower) {
      const stored = getPowerUp(player.storedPower);
      effects.push({
        icon: stored.assetKey,
        label: stored.name,
        color: stored.color,
        description: this.compact ? 'POWER' : 'Stored - press Power'
      });
    }
    if (player.stats.shielded) effects.push({ icon: 'power-stoneguard', label: 'Shield', color: 0xf7d783, remainingMs: player.stats.shieldMs, description: 'Absorbs the next hit' });
    if (player.stats.remoteCharges > 0 || player.stats.remoteArmedBombs > 0) effects.push({
        icon: 'power-remoteHex',
        label: 'Remote Hex',
        color: 0xc050ff,
        charges: player.stats.remoteCharges > 0 ? player.stats.remoteCharges : undefined,
        description: `E / HEX | ${player.stats.remoteArmedBombs} armed`
      });
    if (player.stats.temporaryGhostMode > 0) effects.push({ icon: 'power-ghostVeil', label: 'Ghost Veil', color: 0xded8ff, remainingMs: player.stats.temporaryGhostMode });
    if (player.stats.temporarySpeedBoost > 0) effects.push({ icon: 'power-wolfSprint', label: 'Wolf Sprint', color: 0x9ec8ff, remainingMs: player.stats.temporarySpeedBoost });
    if (player.stats.championSurgeMs > 0) effects.push({ icon: 'power-crownSurge', label: 'Champion Surge', color: 0xfff0a0, remainingMs: player.stats.championSurgeMs });
    if (player.frostTrailMs > 0) effects.push({ icon: 'power-frostSnare', label: 'Ice Feet', color: 0x75d7ff, remainingMs: player.frostTrailMs, description: 'Movement leaves trapping ice' });
    if (player.snaredMs > 0) effects.push({ icon: 'power-frostSnare', label: 'Icebound', color: 0xd8f7ff, remainingMs: player.snaredMs, description: 'Movement briefly trapped' });
    if (player.stats.nextBombDragonCore) effects.push({ icon: 'power-dragonCore', label: 'Dragon Next', color: 0xff6b2b });
    if (player.stats.nextBombFrostSnare) effects.push({ icon: 'power-frostSnare', label: 'Frost Next', color: 0x75d7ff });

    if (!effects.length) {
      if (!this.compact) {
        this.activePanel.add(this.scene.add.text(0, 18, 'No active enchantments', { fontFamily: 'Arial', fontSize: '13px', color: '#716b65' }).setOrigin(0.5));
      }
      return;
    }

    effects.slice(0, 5).forEach((effect, index) => {
      if (this.compact) {
        const y = index * 40;
        const panel = this.scene.add.rectangle(0, y, 132, 36, 0x10121a, 0.96).setStrokeStyle(1, effect.color, 0.62);
        const icon = this.scene.add.image(-46, y, this.scene.textures.exists(effect.icon) ? effect.icon : 'power-fallback').setDisplaySize(28, 28);
        const suffix = effect.remainingMs !== undefined
          ? `${Math.ceil(effect.remainingMs / 1000)}s`
          : effect.charges !== undefined
            ? `x${effect.charges}`
            : effect.description === 'POWER'
              ? 'POWER'
              : 'NEXT';
        const text = this.scene.add.text(-27, y - 7, effect.label, {
          fontFamily: 'Arial', fontStyle: 'bold', fontSize: '10px', color: `#${effect.color.toString(16).padStart(6, '0')}`
        });
        const detail = this.scene.add.text(-27, y + 7, suffix, {
          fontFamily: 'Arial', fontStyle: 'bold', fontSize: '10px', color: '#f4ead2'
        });
        this.activePanel.add([panel, icon, text, detail]);
        return;
      }
      const y = index * 66 + 34;
      const panel = this.scene.add.rectangle(0, y, 194, 56, 0x17151d, 0.94).setStrokeStyle(1, effect.color, 0.5);
      const icon = this.scene.add.image(-66, y, this.scene.textures.exists(effect.icon) ? effect.icon : 'power-fallback').setDisplaySize(42, 42);
      const suffix = effect.remainingMs !== undefined ? `  ${Math.ceil(effect.remainingMs / 1000)}s` : effect.charges !== undefined ? `  x${effect.charges}` : '';
      const text = this.scene.add.text(-36, y - 9, `${effect.label}${suffix}`, {
        fontFamily: 'Arial', fontStyle: 'bold', fontSize: '12px', color: `#${effect.color.toString(16).padStart(6, '0')}`
      });
      const description = this.scene.add.text(-36, y + 10, effect.description ?? (effect.remainingMs !== undefined ? 'Temporary enchantment' : effect.charges !== undefined ? 'Charge available' : 'Empowers next bomb'), {
        fontFamily: 'Arial', fontSize: '10px', color: '#9f978b'
      });
      this.activePanel.add([panel, icon, text, description]);
    });
    const key = effects.map((effect) => `${effect.label}-${effect.charges ?? ''}`).join('|');
    if (key !== this.lastPulseKey) {
      this.lastPulseKey = key;
      this.scene.tweens.add({ targets: this.activePanel, scale: 1.035, duration: 100, yoyo: true, onComplete: () => this.activePanel.setScale(1) });
    }
  }
}
