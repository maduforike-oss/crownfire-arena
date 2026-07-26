import Phaser from 'phaser';
import type { AnimationState, Direction } from '../utils/types';
import type { Player } from '../entities/Player';
import { getCharacter } from '../config/Characters';

export interface ActorVisual {
  body: Phaser.GameObjects.Container;
  motion: Phaser.GameObjects.Container;
  ring: Phaser.GameObjects.Arc;
  label: Phaser.GameObjects.Text;
  health: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  aura: Phaser.GameObjects.Arc;
  buffAura: Phaser.GameObjects.Arc;
  shieldAura: Phaser.GameObjects.Arc;
  shadow: Phaser.GameObjects.Ellipse;
  baseScale: number;
  spriteSize: number;
  state: AnimationState;
  lastX: number;
  lastY: number;
}

export class AnimationSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  createActorVisual(actor: Player): ActorVisual {
    const character = getCharacter(actor.character);
    const texture = this.scene.textures.exists(character.assetKey) ? character.assetKey : 'champion-fallback';
    const c = this.scene.add.container(actor.world.x, actor.world.y);
    const shadow = this.scene.add.ellipse(0, 23, 48, 16, 0x000000, 0.44);
    const aura = this.scene.add.circle(0, 0, 34, character.accentColor, actor.isHuman ? 0.13 : 0.07).setStrokeStyle(2, character.accentColor, actor.isHuman ? 0.42 : 0.2);
    const buffAura = this.scene.add.circle(0, 0, 39, character.accentColor, 0).setStrokeStyle(3, character.accentColor, 0);
    const shieldAura = this.scene.add.circle(0, 0, 32, 0xf7d783, 0).setStrokeStyle(3, 0xf7d783, 0);
    const ring = this.scene.add.circle(0, 0, 25, actor.accent, 0.13).setStrokeStyle(2, actor.accent, actor.isHuman ? 0.86 : 0.38);
    const marker = actor.isHuman ? this.scene.add.triangle(0, -58, -10, 0, 10, 0, 0, -14, actor.accent, 1) : this.scene.add.circle(0, -51, 5, actor.accent, 0.8);
    const baseScale = 1;
    const spriteSize = actor.isHuman ? 94 : 86;
    const sprite = this.scene.add.image(0, 0, texture).setDisplaySize(spriteSize, spriteSize);
    const rim = this.scene.add.image(0, 0, texture).setDisplaySize(spriteSize + 7, spriteSize + 7).setTint(character.accentColor).setAlpha(0.22);
    const motion = this.scene.add.container(0, -15, [rim, sprite]);
    const label = this.scene.add.text(0, 30, actor.isHuman ? 'YOU' : actor.name.split(' ')[0], {
      fontFamily: 'Georgia',
      fontSize: actor.isHuman ? '13px' : '11px',
      color: actor.isHuman ? '#ffe2a1' : '#d4cab8',
      stroke: '#08080c',
      strokeThickness: 3
    }).setOrigin(0.5);
    const health = this.scene.add.container(0, 44);
    c.add([shadow, aura, buffAura, shieldAura, ring, marker, motion, label, health]);
    this.scene.tweens.add({ targets: aura, scale: 1.12, alpha: actor.isHuman ? 0.2 : 0.12, duration: 1100, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
    return { body: c, motion, ring, label, health, sprite, aura, buffAura, shieldAura, shadow, baseScale, spriteSize, state: 'idle_down', lastX: actor.world.x, lastY: actor.world.y };
  }

  updateActor(actor: Player, visual: ActorVisual, moving: boolean, direction: Direction): void {
    const state = this.resolveState(actor, moving, direction);
    if (visual.state !== state) {
      visual.state = state;
      this.enterState(actor, visual, state);
    }
    visual.body.setPosition(actor.world.x, actor.world.y);
    visual.body.setDepth(20 + actor.world.y / 1000);
    visual.body.setAlpha(actor.alive ? (actor.invulnerableMs > 0 ? 0.62 : 1) : 0.32);
    visual.ring.setAlpha(actor.stats.shielded ? 0.65 : actor.isHuman ? 0.22 : 0.12);
    visual.aura.setScale(actor.stats.temporaryGhostMode > 0 ? 1.28 : 1 + Math.sin(this.scene.time.now / 360) * 0.035);
    visual.aura.setAlpha(actor.stats.temporaryGhostMode > 0 ? 0.28 : actor.isHuman ? 0.12 : 0.07);
    this.updateBuffAuras(actor, visual);
    visual.label.setColor(actor.alive ? (actor.isHuman ? '#ffe2a1' : '#d4cab8') : '#7d7470');
    if (actor.slowedMs > 0) visual.sprite.setTint(0xaeefff);
    else if (actor.stats.championSurgeMs > 0) visual.sprite.setTint(0xfff0a0);
    else if (actor.stats.temporaryGhostMode > 0) visual.sprite.setTint(0xe8ddff);
    else visual.sprite.setTint(0xffffff);
    visual.sprite.setFlipX(direction === 'left');
    visual.sprite.setDisplaySize(visual.spriteSize, visual.spriteSize);
    visual.shadow.setScale(actor.stats.championSurgeMs > 0 ? 1.18 : 1);
    visual.lastX = actor.world.x;
    visual.lastY = actor.world.y;
  }

  playPlaceBomb(actor: Player, visual: ActorVisual): void {
    visual.state = 'place_bomb';
    this.scene.tweens.killTweensOf(visual.motion);
    visual.motion.setScale(1).setAngle(0);
    this.scene.tweens.add({ targets: visual.motion, scaleX: 1.08, scaleY: 0.9, y: -10, duration: 80, yoyo: true, onComplete: () => visual.motion.setScale(1).setY(-15) });
    this.emitFactionParticles(actor, actor.world.x, actor.world.y + 8, 5);
  }

  playSpecial(actor: Player, visual: ActorVisual, color: number): void {
    visual.buffAura.setStrokeStyle(4, color, 0.95).setFillStyle(color, 0.12).setScale(0.75).setAlpha(1);
    this.scene.tweens.add({
      targets: visual.buffAura,
      scale: 1.75,
      alpha: 0,
      duration: 520,
      ease: 'Cubic.easeOut'
    });
    this.emitFactionParticles(actor, actor.world.x, actor.world.y + 4, 9);
  }

  playDamaged(actor: Player, visual: ActorVisual): void {
    visual.state = 'damaged';
    const tint = actor.character === 'frost' ? 0xd8f7ff : actor.character === 'veil' ? 0xf0d8ff : actor.character === 'dragon' ? 0xff6a2b : 0xffffff;
    visual.sprite.setTint(tint);
    this.scene.tweens.add({ targets: visual.sprite, alpha: 0.45, duration: 70, yoyo: true, repeat: 2, onComplete: () => visual.sprite.clearTint().setAlpha(1) });
  }

  playDefeated(actor: Player, visual: ActorVisual): void {
    visual.state = 'defeated';
    this.scene.tweens.add({ targets: visual.body, angle: actor.isHuman ? -10 : 10, y: visual.body.y + 10, alpha: 0.25, duration: 360, ease: 'Cubic.easeOut' });
  }

  emitFootstep(actor: Player): void {
    if (Math.random() > 0.28) return;
    this.emitFactionParticles(actor, actor.world.x, actor.world.y + 18, 1);
  }

  emitPickupBurst(actor: Player, color: number, count = 12): void {
    for (let i = 0; i < count; i += 1) {
      const angle = (Math.PI * 2 * i) / count;
      const dot = this.scene.add.circle(actor.world.x, actor.world.y - 8, Phaser.Math.Between(2, 4), color, 0.86);
      dot.setDepth(42);
      this.scene.tweens.add({
        targets: dot,
        x: actor.world.x + Math.cos(angle) * Phaser.Math.Between(22, 42),
        y: actor.world.y - 8 + Math.sin(angle) * Phaser.Math.Between(22, 42),
        alpha: 0,
        duration: 520,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy()
      });
    }
  }

  shieldBreak(actor: Player): void {
    for (let i = 0; i < 14; i += 1) {
      const shard = this.scene.add.rectangle(actor.world.x, actor.world.y - 2, 5, 9, 0xf7d783, 0.9).setAngle(Phaser.Math.Between(0, 180));
      shard.setDepth(42);
      this.scene.tweens.add({
        targets: shard,
        x: actor.world.x + Phaser.Math.Between(-34, 34),
        y: actor.world.y + Phaser.Math.Between(-34, 24),
        alpha: 0,
        duration: 520,
        onComplete: () => shard.destroy()
      });
    }
  }

  private resolveState(actor: Player, moving: boolean, direction: Direction): AnimationState {
    if (!actor.alive) return 'defeated';
    const suffix = direction === 'none' ? 'down' : direction;
    return `${moving ? 'walk' : 'idle'}_${suffix}` as AnimationState;
  }

  private enterState(actor: Player, visual: ActorVisual, state: AnimationState): void {
    this.scene.tweens.killTweensOf(visual.motion);
    visual.motion.setScale(1).setAngle(0).setPosition(0, -15);
    visual.sprite.setDisplaySize(visual.spriteSize, visual.spriteSize);
    const moving = state.startsWith('walk');
    const heavy = actor.character === 'stone' || actor.character === 'frost';
    const hover = actor.character === 'veil';
    const y = hover ? -19 : -15;
    const duration = moving ? (heavy ? 180 : 120) : 900;
    this.scene.tweens.add({
      targets: visual.motion,
      y: moving ? y - 3 : y - 2,
      angle: moving ? (state.endsWith('left') ? -2 : state.endsWith('right') ? 2 : 0) : 0,
      scaleX: moving && actor.character === 'wolf' ? 1.04 : 1,
      scaleY: moving ? 0.97 : 1,
      duration,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
  }

  private updateBuffAuras(actor: Player, visual: ActorVisual): void {
    let color = getCharacter(actor.character).accentColor;
    let alpha = 0;
    if (actor.stats.championSurgeMs > 0) {
      color = 0xfff0a0;
      alpha = 0.48;
    } else if (actor.stats.temporaryGhostMode > 0) {
      color = 0xded8ff;
      alpha = 0.34;
    } else if (actor.stats.temporarySpeedBoost > 0) {
      color = 0x9ec8ff;
      alpha = 0.28;
    } else if (actor.stats.nextBombDragonCore) {
      color = 0xff6b2b;
      alpha = 0.3;
    } else if (actor.stats.nextBombFrostSnare) {
      color = 0x75d7ff;
      alpha = 0.3;
    } else if (actor.stats.remoteCharges > 0) {
      color = 0xc050ff;
      alpha = 0.26;
    }
    visual.buffAura.setStrokeStyle(3, color, alpha).setFillStyle(color, alpha * 0.22).setAlpha(1);
    visual.buffAura.setScale(1 + Math.sin(this.scene.time.now / 180) * 0.06);
    visual.shieldAura.setStrokeStyle(3, 0xf7d783, actor.stats.shielded ? 0.74 : 0).setFillStyle(0xf7d783, actor.stats.shielded ? 0.06 : 0);
    visual.shieldAura.setScale(actor.stats.shielded ? 1 + Math.sin(this.scene.time.now / 140) * 0.04 : 1);
  }

  private emitFactionParticles(actor: Player, x: number, y: number, count: number): void {
    const color = getCharacter(actor.character).accentColor;
    for (let i = 0; i < count; i += 1) {
      const dot = this.scene.add.circle(x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-4, 8), Phaser.Math.Between(2, 4), color, 0.75);
      dot.setDepth(35);
      this.scene.tweens.add({
        targets: dot,
        x: dot.x + Phaser.Math.Between(-10, 10),
        y: dot.y - Phaser.Math.Between(8, 18),
        alpha: 0,
        duration: 420,
        onComplete: () => dot.destroy()
      });
    }
  }
}
