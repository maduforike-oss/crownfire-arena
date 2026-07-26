import Phaser from 'phaser';
import type { AnimationState, Direction } from '../utils/types';
import type { Player } from '../entities/Player';
import { getCharacter } from '../config/Characters';
import type { CharacterClass } from '../utils/types';
import {
  getChampionAnimation,
  type ChampionAnimationState
} from '../config/ChampionAnimations';

interface MotionProfile {
  idleBob: number;
  walkBob: number;
  lean: number;
  cadence: number;
  glowAlpha: number;
}

const MOTION: Record<CharacterClass, MotionProfile> = {
  dragon: { idleBob: 3, walkBob: 5, lean: 3, cadence: 128, glowAlpha: 0.22 },
  wolf: { idleBob: 3, walkBob: 6, lean: 6, cadence: 92, glowAlpha: 0.2 },
  frost: { idleBob: 1.5, walkBob: 3, lean: 1, cadence: 185, glowAlpha: 0.2 },
  veil: { idleBob: 6, walkBob: 5, lean: 2, cadence: 150, glowAlpha: 0.26 },
  skin: { idleBob: 3, walkBob: 5, lean: 5, cadence: 108, glowAlpha: 0.18 },
  stone: { idleBob: 1, walkBob: 2.5, lean: 1, cadence: 210, glowAlpha: 0.2 },
  raven: { idleBob: 4, walkBob: 5, lean: 4, cadence: 116, glowAlpha: 0.24 },
  beast: { idleBob: 3, walkBob: 5, lean: 4, cadence: 126, glowAlpha: 0.22 }
};

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
  lastParticleAt: number;
  damageFlashUntil: number;
  animationStartedAt: number;
  actionUntil: number;
}

export class AnimationSystem {
  constructor(private readonly scene: Phaser.Scene) {}

  createActorVisual(actor: Player): ActorVisual {
    const character = getCharacter(actor.character);
    const animation = getChampionAnimation(actor.character);
    const texture = this.scene.textures.exists(animation.textureKey) ? animation.textureKey : character.assetKey;
    const c = this.scene.add.container(actor.world.x, actor.world.y);
    const profile = MOTION[actor.character];
    const shadow = this.scene.add.ellipse(0, 24, actor.isHuman ? 48 : 44, actor.isHuman ? 15 : 14, 0x000000, 0.7);
    const aura = this.scene.add.circle(0, 0, 34, character.accentColor, actor.isHuman ? 0.13 : 0.07).setStrokeStyle(2, character.accentColor, actor.isHuman ? 0.42 : 0.2);
    const buffAura = this.scene.add.circle(0, 0, 39, character.accentColor, 0).setStrokeStyle(3, character.accentColor, 0);
    const shieldAura = this.scene.add.circle(0, 0, 32, 0xf7d783, 0).setStrokeStyle(3, 0xf7d783, 0);
    const ring = this.scene.add.circle(0, 0, 25, actor.accent, 0.13).setStrokeStyle(2, actor.accent, actor.isHuman ? 0.86 : 0.38);
    const marker = actor.isHuman ? this.scene.add.triangle(0, -58, -10, 0, 10, 0, 0, -14, actor.accent, 1) : this.scene.add.circle(0, -51, 5, actor.accent, 0.8);
    const baseScale = 1;
    const spriteSize = actor.isHuman ? 118 : 108;
    const sprite = this.scene.add.image(0, 0, texture, 0).setDisplaySize(spriteSize, spriteSize);
    const motion = this.scene.add.container(0, -13, [sprite]);
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
    return {
      body: c,
      motion,
      ring,
      label,
      health,
      sprite,
      aura,
      buffAura,
      shieldAura,
      shadow,
      baseScale,
      spriteSize,
      state: 'idle_down',
      lastX: actor.world.x,
      lastY: actor.world.y,
      lastParticleAt: 0,
      damageFlashUntil: 0,
      animationStartedAt: this.scene.time.now,
      actionUntil: 0
    };
  }

  updateActor(actor: Player, visual: ActorVisual, moving: boolean, direction: Direction): void {
    const actionActive = this.scene.time.now < visual.actionUntil;
    const state = !actor.alive
      ? 'defeated'
      : actionActive
        ? visual.state
        : this.resolveState(actor, moving, direction);
    if (visual.state !== state) {
      visual.state = state;
      this.enterState(actor, visual, state);
    }
    visual.body.setPosition(actor.world.x, actor.world.y);
    visual.body.setDepth(20 + actor.world.y / 1000);
    visual.body.setAlpha(actor.alive ? 1 : 0.34);
    visual.ring.setAlpha(actor.stats.shielded ? 0.65 : actor.isHuman ? 0.22 : 0.12);
    visual.aura.setScale(actor.stats.temporaryGhostMode > 0 ? 1.28 : 1 + Math.sin(this.scene.time.now / 360) * 0.035);
    visual.aura.setAlpha(actor.stats.temporaryGhostMode > 0 ? 0.28 : actor.isHuman ? 0.12 : 0.07);
    this.updateBuffAuras(actor, visual);
    visual.label.setColor(actor.alive ? (actor.isHuman ? '#ffe2a1' : '#d4cab8') : '#7d7470');
    if (this.scene.time.now < visual.damageFlashUntil) {
      const tint = actor.character === 'frost' ? 0xd8f7ff : actor.character === 'veil' ? 0xf0d8ff : actor.character === 'dragon' ? 0xff6a2b : 0xffffff;
      visual.sprite.setTint(tint);
    } else if (actor.slowedMs > 0) visual.sprite.setTint(0xaeefff);
    else if (actor.stats.championSurgeMs > 0) visual.sprite.setTint(0xfff0a0);
    else if (actor.stats.temporaryGhostMode > 0) visual.sprite.setTint(0xe8ddff);
    else visual.sprite.setTint(0xffffff);
    visual.sprite.setFlipX(direction === 'left');
    visual.sprite.setDisplaySize(visual.spriteSize, visual.spriteSize);
    this.updateAnimationFrame(actor, visual);
    const contact = visual.state.startsWith('walk')
      ? 0.9 + Number(visual.sprite.frame.name) % 2 * 0.08
      : 1;
    visual.shadow.setScale(actor.stats.championSurgeMs > 0 ? 1.18 : contact, contact);
    visual.shadow.setAlpha(actor.invulnerableMs > 0 ? 0.52 : 0.7);
    if (moving && this.scene.time.now - visual.lastParticleAt > MOTION[actor.character].cadence * 1.7) {
      visual.lastParticleAt = this.scene.time.now;
      this.emitMovementAccent(actor, visual.lastX, visual.lastY);
    }
    visual.lastX = actor.world.x;
    visual.lastY = actor.world.y;
  }

  playPlaceBomb(actor: Player, visual: ActorVisual): void {
    visual.state = 'place_bomb';
    visual.animationStartedAt = this.scene.time.now;
    visual.actionUntil = this.scene.time.now + 330;
    visual.motion.setScale(1).setAngle(0).setY(-13);
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
    visual.state = 'special';
    visual.animationStartedAt = this.scene.time.now;
    visual.actionUntil = this.scene.time.now + 480;
  }

  playDamaged(actor: Player, visual: ActorVisual): void {
    visual.state = 'damaged';
    visual.damageFlashUntil = this.scene.time.now + 320;
    visual.animationStartedAt = this.scene.time.now;
    visual.actionUntil = this.scene.time.now + 250;
    const tint = actor.character === 'frost' ? 0xd8f7ff : actor.character === 'veil' ? 0xf0d8ff : actor.character === 'dragon' ? 0xff6a2b : 0xffffff;
    visual.sprite.setTint(tint);
    this.scene.tweens.add({ targets: visual.sprite, alpha: 0.45, duration: 70, yoyo: true, repeat: 2, onComplete: () => visual.sprite.clearTint().setAlpha(1) });
  }

  playDefeated(actor: Player, visual: ActorVisual): void {
    visual.state = 'defeated';
    visual.animationStartedAt = this.scene.time.now;
    visual.actionUntil = Number.POSITIVE_INFINITY;
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
    visual.motion.setScale(1).setAngle(0).setPosition(0, actor.character === 'veil' ? -16 : -13);
    visual.sprite.setDisplaySize(visual.spriteSize, visual.spriteSize);
    visual.animationStartedAt = this.scene.time.now;
  }

  private updateAnimationFrame(actor: Player, visual: ActorVisual): void {
    const animation = getChampionAnimation(actor.character);
    const state = this.frameState(visual.state);
    const range = animation.states[state];
    const elapsed = Math.max(0, this.scene.time.now - visual.animationStartedAt);
    const count = range.end - range.start + 1;
    const raw = Math.floor(elapsed / range.frameMs);
    const offset = range.loop ? raw % count : Math.min(count - 1, raw);
    visual.sprite.setFrame(range.start + offset);
  }

  private frameState(state: AnimationState): ChampionAnimationState {
    if (state.startsWith('walk')) return 'walk';
    if (state.startsWith('idle')) return 'idle';
    if (state === 'place_bomb') return 'place';
    if (state === 'special') return 'special';
    if (state === 'damaged') return 'damaged';
    return 'defeated';
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
    } else if (actor.frostTrailMs > 0 || actor.snaredMs > 0) {
      color = 0x75d7ff;
      alpha = actor.snaredMs > 0 ? 0.42 : 0.3;
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
      const dot = this.makeFactionParticle(actor.character, x + Phaser.Math.Between(-10, 10), y + Phaser.Math.Between(-4, 8), color);
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

  private emitMovementAccent(actor: Player, x: number, y: number): void {
    if (actor.character === 'skin') {
      const texture = getCharacter(actor.character).assetKey;
      const shade = this.scene.add.image(x, y - 16, texture).setDisplaySize(visualSize(actor), visualSize(actor)).setAlpha(0.2).setTint(0x9c704e).setDepth(19);
      this.scene.tweens.add({ targets: shade, alpha: 0, scale: 0.92, duration: 260, onComplete: () => shade.destroy() });
      return;
    }
    this.emitFactionParticles(actor, x, y + 18, actor.character === 'stone' || actor.character === 'frost' ? 2 : 1);
  }

  private makeFactionParticle(character: CharacterClass, x: number, y: number, color: number): Phaser.GameObjects.Shape {
    let particle: Phaser.GameObjects.Shape;
    if (character === 'dragon') {
      particle = this.scene.add.triangle(x, y, 0, 8, 4, 0, 8, 8, color, 0.82);
    } else if (character === 'frost' || character === 'raven') {
      particle = this.scene.add.rectangle(x, y, character === 'frost' ? 5 : 3, character === 'frost' ? 8 : 10, color, 0.76).setAngle(45);
    } else if (character === 'stone') {
      particle = this.scene.add.rectangle(x, y, 6, 5, 0xb9a789, 0.7).setAngle(Phaser.Math.Between(-25, 25));
    } else if (character === 'beast') {
      particle = this.scene.add.ellipse(x, y, 8, 5, color, 0.72);
    } else {
      particle = this.scene.add.circle(x, y, Phaser.Math.Between(2, 4), color, character === 'veil' ? 0.48 : 0.72);
    }
    particle.setDepth(35);
    return particle;
  }

}

function visualSize(actor: Player): number {
  return actor.isHuman ? 106 : 98;
}
