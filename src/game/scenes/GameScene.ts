import Phaser from 'phaser';
import { SESSION, GAME_CONFIG } from '../config/GameConfig';
import { MAPS } from '../config/Maps';
import { MODES } from '../config/Modes';
import { CHARACTERS, makeStats } from '../config/Characters';
import { getPowerUp } from '../config/PowerUps';
import { Player } from '../entities/Player';
import { Bot } from '../entities/Bot';
import type { Direction, GridPosition, PowerUpType } from '../utils/types';
import { keyOf, sameTile, distance, clamp } from '../utils/math';
import { GridSystem } from '../systems/GridSystem';
import { BombSystem } from '../systems/BombSystem';
import { PowerUpSystem } from '../systems/PowerUpSystem';
import { DangerMapSystem } from '../systems/DangerMapSystem';
import { ModeSystem } from '../systems/ModeSystem';
import { awardMatch } from '../systems/RewardSystem';
import { HumanController } from '../controllers/HumanController';
import { AIController } from '../controllers/AIController';
import { HUD } from '../ui/HUD';
import { AnimationSystem, type ActorVisual } from '../systems/AnimationSystem';
import { ExplosionSystem } from '../systems/ExplosionSystem';
import { getBombTheme } from '../config/BombVisualThemes';
import { getMapTheme } from '../config/MapThemes';
import { MapRenderer } from '../systems/MapRenderer';
import { AudioSystem } from '../systems/AudioSystem';
import { BombViewSystem } from '../systems/BombViewSystem';
import { TouchController } from '../controllers/TouchController';

export class GameScene extends Phaser.Scene {
  private grid!: GridSystem;
  private bombs!: BombSystem;
  private powers!: PowerUpSystem;
  private danger!: DangerMapSystem;
  private mode!: ModeSystem;
  private human!: HumanController;
  private human2?: HumanController;
  private touch?: TouchController;
  private ai = new AIController();
  private animation!: AnimationSystem;
  private explosionFx!: ExplosionSystem;
  private bombViews!: BombViewSystem;
  private hud!: HUD;
  private player!: Player;
  private actors: Player[] = [];
  private views = new Map<string, ActorVisual>();
  private tileLayer!: Phaser.GameObjects.Container;
  private objectLayer!: Phaser.GameObjects.Container;
  private effectLayer!: Phaser.GameObjects.Container;
  private uiLayer!: Phaser.GameObjects.Container;
  private blockSprites = new Map<string, Phaser.GameObjects.Container>();
  private powerSprites = new Map<string, Phaser.GameObjects.Container>();
  private frostZones = new Map<string, number>();
  private frostSprites = new Map<string, Phaser.GameObjects.Rectangle>();
  private shrineTimerMs = 15000;
  private shrineTile!: GridPosition;
  private shrineCountdown?: Phaser.GameObjects.Arc;
  private shrineText?: Phaser.GameObjects.Text;
  private spawnGraceMs = 2200;
  private readonly debugSpawnSafe = false;
  private pausedText?: Phaser.GameObjects.Container;
  private paused = false;
  private ended = false;

  constructor() {
    super('GameScene');
  }

  create(): void {
    AudioSystem.get().startMusic('battle', SESSION.map);
    this.input.keyboard?.once('keydown-M', () => this.toggleMute());
    this.input.once('pointerdown', () => AudioSystem.get().startMusic('battle', SESSION.map));
    const map = MAPS.find((m) => m.id === SESSION.map) ?? MAPS[0];
    const modeDef = MODES.find((m) => m.id === SESSION.mode) ?? MODES[0];
    this.grid = new GridSystem(map);
    this.shrineTile = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
    this.bombs = new BombSystem(this.grid);
    this.powers = new PowerUpSystem(this.grid);
    this.danger = new DangerMapSystem();
    this.mode = new ModeSystem(SESSION.mode);
    this.human = new HumanController(this, 'wasd');
    this.touch = new TouchController(this);
    this.human2 = SESSION.localPlayers === 2 ? new HumanController(this, 'arrows') : undefined;
    this.tileLayer = this.add.container();
    this.objectLayer = this.add.container();
    this.effectLayer = this.add.container();
    this.uiLayer = this.add.container();
    this.tileLayer.setDepth(0);
    this.effectLayer.setDepth(30);
    this.objectLayer.setDepth(20);
    this.uiLayer.setDepth(100);
    this.animation = new AnimationSystem(this);
    this.explosionFx = new ExplosionSystem(this, this.grid, this.effectLayer);
    this.bombViews = new BombViewSystem(this, this.grid, this.objectLayer, this.explosionFx);
    this.drawArena();
    this.powers.seedInitial(SESSION.mode === 'classic' ? 5 : 7);
    this.spawnActors();
    this.hud = new HUD(this);
    this.hud.create(modeDef);
    this.showRoundIntro();
    AudioSystem.get().sfx('matchStart');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(_: number, delta: number): void {
    if (this.ended) return;
    if (this.human.consumePause() || this.touch?.consumePause()) this.togglePause();
    if (this.paused) return;
    const dt = Math.min(delta, 34);
    this.spawnGraceMs = Math.max(0, this.spawnGraceMs - dt);
    this.tickStatuses(dt);
    this.updateShrine(dt);
    this.updateFrostZones(dt);
    this.resolveChampionSurgeTouches();
    this.updateHuman(dt);
    this.updateHuman2(dt);
    this.updateBots(dt);
    const explosions = this.bombs.update(dt, this.actors);
    for (const explosion of explosions) this.resolveExplosion(explosion);
    this.danger.rebuild(this.bombs.bombs, this.bombs.activeBlastTiles());
    this.collectPowerUps();
    this.syncSprites();
    const result = this.mode.update(dt, this.player, this.actors);
    this.hud.update(this.player, this.actors.filter((a) => !a.isHuman && a.alive).length, this.mode.elapsedMs);
    if (result?.done) this.finish(result.won, result.reason);
  }

  private drawArena(): void {
    const rendered = new MapRenderer(this).render(
      this.grid,
      { tileLayer: this.tileLayer, objectLayer: this.objectLayer, effectLayer: this.effectLayer },
      this.shrineTile,
      this.debugSpawnSafe
    );
    this.blockSprites = rendered.blockSprites;
  }

  private spawnActors(): void {
    const mainChar = CHARACTERS.find((c) => c.id === SESSION.character) ?? CHARACTERS[0];
    const spawn = this.grid.map.spawns[0];
    this.player = new Player('player', mainChar.name, mainChar.id, { ...spawn }, this.grid.toWorld(spawn), makeStats(mainChar.id), true, mainChar.palette, mainChar.accent);
    this.actors = [this.player];
    let botStartIndex = 1;
    if (SESSION.localPlayers === 2) {
      const ch = CHARACTERS.find((c) => c.id === 'wolf')!;
      const p = this.grid.map.spawns[1];
      const p2 = new Player('player-2', 'Player 2', ch.id, { ...p }, this.grid.toWorld(p), makeStats(ch.id), true, ch.palette, ch.accent);
      this.actors.push(p2);
      botStartIndex = 2;
    }
    const botChars = ['wolf', 'frost', 'veil', 'stone'] as const;
    for (let i = botStartIndex; i < 4; i += 1) {
      const ch = CHARACTERS.find((c) => c.id === botChars[i - botStartIndex])!;
      const p = this.grid.map.spawns[i];
      const bot = new Bot(`bot-${i}`, ch.name, ch.id, { ...p }, this.grid.toWorld(p), makeStats(ch.id), false, ch.palette, ch.accent);
      bot.stats.health = 2;
      bot.stats.maxHealth = 2;
      this.actors.push(bot);
    }
    for (const actor of this.actors) this.makeActorView(actor);
  }

  private drawCentralShrine(x: number, y: number, color: number): void {
    const base = this.add.container(x, y);
    base.add(this.add.image(0, 0, `map-${this.grid.map.id}-shrine`).setDisplaySize(92, 92));
    base.add(this.add.circle(0, 0, 25, color, 0.1).setStrokeStyle(2, color, 0.55));
    this.tileLayer.add(base);
    this.tweens.add({ targets: base, alpha: 0.65, duration: 1100, yoyo: true, repeat: -1 });
  }

  private makeActorView(actor: Player): void {
    const visual = this.animation.createActorVisual(actor);
    this.objectLayer.add(visual.body);
    this.views.set(actor.id, visual);
    this.redrawHealth(actor);
  }

  private updateHuman(dt: number): void {
    const touchDirection = this.touch?.direction() ?? 'none';
    this.moveActor(this.player, touchDirection !== 'none' ? touchDirection : this.human.direction(), dt);
    if (this.human.consumeBomb() || this.touch?.consumeBomb()) this.placeBomb(this.player);
    if (this.human.consumeRemote() || this.touch?.consumeRemote()) {
      const remoteExplosions = this.bombs.detonateRemote(this.player.id, this.actors);
      if (remoteExplosions.length > 0) {
        this.specialPulse(this.player, 0xc050ff);
        AudioSystem.get().sfx('blink');
      }
      for (const explosion of remoteExplosions) this.resolveExplosion(explosion);
    }
    if (this.human.consumeSpecial() || this.touch?.consumeSpecial()) this.useSpecial(this.player);
  }

  private updateHuman2(dt: number): void {
    if (!this.human2) return;
    const player2 = this.actors.find((actor) => actor.id === 'player-2');
    if (!player2) return;
    this.moveActor(player2, this.human2.direction(), dt);
    if (this.human2.consumeBomb()) this.placeBomb(player2);
    if (this.human2.consumeRemote()) {
      const remoteExplosions = this.bombs.detonateRemote(player2.id, this.actors);
      if (remoteExplosions.length > 0) {
        this.specialPulse(player2, 0xc050ff);
        AudioSystem.get().sfx('blink');
      }
      for (const explosion of remoteExplosions) this.resolveExplosion(explosion);
    }
    if (this.human2.consumeSpecial()) this.useSpecial(player2);
  }

  private updateBots(dt: number): void {
    for (const bot of this.actors.filter((a): a is Bot => a instanceof Bot && a.alive)) {
      if (this.spawnGraceMs > 0) continue;
      bot.thinkMs -= dt;
      let intent = { dir: 'none' as Direction, placeBomb: false };
      if (bot.thinkMs <= 0 || distance(bot.grid, this.player.grid) < 4) {
        intent = this.ai.think(bot, this.actors.filter((actor) => actor !== bot && actor.alive), this.grid, this.bombs, this.danger, this.powers);
        bot.thinkMs = 120 + Math.random() * 120;
      }
      this.moveActor(bot, intent.dir, dt);
      if (intent.placeBomb) this.placeBomb(bot);
      if (bot.specialCooldownMs <= 0 && Math.random() < 0.006 && (distance(bot.grid, this.player.grid) < 6 || this.danger.isDanger(bot.grid))) {
        this.useSpecial(bot);
      }
    }
  }

  private moveActor(actor: Player, dir: Direction, dt: number): void {
    if (!actor.alive || dir === 'none') return;
    const d = dir === 'up' ? { x: 0, y: -1 } : dir === 'down' ? { x: 0, y: 1 } : dir === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
    actor.lastDir = d;
    if (this.frostZones.has(keyOf(actor.grid))) actor.slowedMs = Math.max(actor.slowedMs, 450);
    const surgeBoost = actor.stats.championSurgeMs > 0 ? 18 : 0;
    const speedBoost = actor.stats.temporarySpeedBoost > 0 ? actor.stats.moveSpeed * 0.35 : 0;
    const speed = (actor.stats.moveSpeed + speedBoost + surgeBoost) * (actor.slowedMs > 0 ? 0.6 : 1);
    const nextWorld = { x: actor.world.x + d.x * speed * dt / 1000, y: actor.world.y + d.y * speed * dt / 1000 };
    const nextGrid = this.grid.toGrid(nextWorld);
    if (!sameTile(nextGrid, actor.grid)) {
      if (!this.grid.isWalkable(nextGrid) || this.bombs.isBombBlocking(nextGrid, actor)) return;
      actor.grid = nextGrid;
    }
    const center = this.grid.toWorld(actor.grid);
    if (d.x !== 0) nextWorld.y = Phaser.Math.Linear(actor.world.y, center.y, 0.22);
    if (d.y !== 0) nextWorld.x = Phaser.Math.Linear(actor.world.x, center.x, 0.22);
    actor.world = nextWorld;
    const bounds = this.grid.toWorld(actor.grid);
    actor.world.x = clamp(actor.world.x, bounds.x - 24, bounds.x + 24);
    actor.world.y = clamp(actor.world.y, bounds.y - 24, bounds.y + 24);
    this.animation.emitFootstep(actor);
  }

  private placeBomb(actor: Player): void {
    const bomb = this.bombs.place(actor);
    if (!bomb) return;
    AudioSystem.get().sfx('bomb');
    const theme = getBombTheme(bomb.themeId);
    const w = this.grid.toWorld(bomb.grid);
    this.bombViews.add(bomb);
    const view = this.views.get(actor.id);
    if (view) this.animation.playPlaceBomb(actor, view);
    this.specialPulse(actor, theme.blastColor);
    this.floatText(w.x, w.y - 35, actor.isHuman ? 'Rune set' : 'Hex!', actor.isHuman ? '#ffd36b' : '#ff9d8f');
  }

  private resolveExplosion(explosion: import('../entities/Explosion').Explosion): void {
    this.explosionFx.renderExplosion(explosion.tiles, getBombTheme(explosion.themeId));
    for (const tile of explosion.tiles) {
      const block = this.blockSprites.get(keyOf(tile));
      if (block) {
        this.animateBlockBreak(block);
        this.blockSprites.delete(keyOf(tile));
        this.grid.set(tile, 'empty');
        if (SESSION.mode === 'shards' && Math.random() < 0.34) this.spawnShard(tile);
        else this.powers.maybeDrop(tile, false);
        this.emitDebris(tile);
      }
      const removedPower = this.powers.powerUps.find((power) => sameTile(power.grid, tile));
      if (removedPower) {
        this.powerSprites.get(removedPower.id)?.destroy();
        this.powerSprites.delete(removedPower.id);
      }
      this.powers.removeAt(tile);
    }
    for (const actor of this.actors) {
      if (!actor.alive) continue;
      if (explosion.tiles.some((t) => sameTile(t, actor.grid))) {
        if (explosion.frost) actor.slowedMs = 2000;
        this.damageActor(actor, explosion.ownerId);
      }
    }
    if (explosion.frost) {
      for (const tile of explosion.tiles) this.frostZones.set(keyOf(tile), 3000);
    }
    AudioSystem.get().sfx('explosion');
  }

  private spawnExplosionViews(explosions: import('../entities/Explosion').Explosion[]): void {
    for (const explosion of explosions) {
      for (const tile of explosion.tiles) {
        const w = this.grid.toWorld(tile);
        const sprite = this.add.image(w.x, w.y, explosion.frost ? 'blast-frost' : 'blast-fire').setAlpha(0.92);
        this.effectLayer.add(sprite);
        this.tweens.add({ targets: sprite, alpha: 0, scale: 1.35, duration: GAME_CONFIG.explosionMs, onComplete: () => sprite.destroy() });
      }
    }
  }

  private damageActor(actor: Player, ownerId: string): void {
    if (actor.invulnerableMs > 0 || actor.stats.temporaryGhostMode > 0 || actor.stats.championSurgeMs > 0) return;
    if (actor.stats.shielded) {
      actor.stats.shielded = false;
      actor.invulnerableMs = 500;
      this.floatText(actor.world.x, actor.world.y - 42, 'Shield', '#f7d783');
      this.animation.shieldBreak(actor);
      AudioSystem.get().sfx('shieldBreak');
      return;
    }
    actor.stats.health -= 1;
    this.redrawHealth(actor);
    actor.invulnerableMs = actor.stats.invulnerabilityMs;
    const view = this.views.get(actor.id);
    if (view) this.animation.playDamaged(actor, view);
    this.floatText(actor.world.x, actor.world.y - 42, '-1', '#ff7b74');
    AudioSystem.get().sfx('damage');
    if (actor.stats.health <= 0) {
      actor.alive = false;
      if (view) this.animation.playDefeated(actor, view);
      const killer = this.actors.find((a) => a.id === ownerId);
      if (killer && killer !== actor) killer.kills += 1;
      AudioSystem.get().sfx('defeat');
    }
  }

  private collectPowerUps(): void {
    for (const actor of this.actors.filter((a) => a.alive)) {
      const pickup = this.powers.collect(actor);
      if (pickup) {
      actor.lastPowerUp = pickup.type;
      actor.lastPowerUpMs = 4200;
      this.applyPowerUpFeedback(actor, pickup.type, pickup.label);
      if (actor.isHuman) this.pulseHudForPower(pickup.type);
        this.floatPickup(actor.world.x, actor.world.y - 50, pickup.type, pickup.label);
        this.redrawHealth(actor);
        this.powerSprites.get(pickup.id)?.destroy();
        this.powerSprites.delete(pickup.id);
      }
      const shard = this.powerSprites.get(`shard-${keyOf(actor.grid)}`);
      if (shard) {
        shard.destroy();
        this.powerSprites.delete(`shard-${keyOf(actor.grid)}`);
        actor.shards += 1;
        this.floatText(actor.world.x, actor.world.y - 46, '+Shard', '#f7d783');
        AudioSystem.get().sfx('pickup');
      }
    }
  }

  private spawnShard(pos: GridPosition): void {
    const w = this.grid.toWorld(pos);
    const id = `shard-${keyOf(pos)}`;
    const view = this.createPickupView(w.x, w.y, 'crown-shard', 0xffe89a, true);
    this.powerSprites.set(id, view);
  }

  private syncSprites(): void {
    this.bombViews.update(this.bombs.bombs);
    for (const actor of this.actors) {
      const view = this.views.get(actor.id);
      if (view) {
        const moving = Math.abs(actor.world.x - view.lastX) > 0.2 || Math.abs(actor.world.y - view.lastY) > 0.2;
        this.animation.updateActor(actor, view, moving, this.directionFromLast(actor));
      }
    }
    for (const power of this.powers.powerUps) {
      if (!this.powerSprites.has(power.id)) {
        const w = this.grid.toWorld(power.grid);
        const def = getPowerUp(power.type);
        const texture = this.textures.exists(def.assetKey) ? def.assetKey : 'power-fallback';
        this.powerSprites.set(power.id, this.createPickupView(w.x, w.y, texture, def.color));
      }
    }
  }

  private createPickupView(
    x: number,
    y: number,
    texture: string,
    color: number,
    isShard = false
  ): Phaser.GameObjects.Container {
    const view = this.add.container(x, y);
    const shadow = this.add.ellipse(0, 18, isShard ? 40 : 48, 15, 0x05050a, 0.66);
    const pedestal = this.add.circle(0, 12, isShard ? 18 : 22, 0x11101a, 0.84)
      .setStrokeStyle(2, color, 0.7);
    const halo = this.add.circle(0, -2, isShard ? 20 : 25, color, 0.16)
      .setStrokeStyle(2, color, 0.62)
      .setBlendMode(Phaser.BlendModes.ADD);
    const icon = this.add.image(0, -4, texture).setDisplaySize(isShard ? 34 : 46, isShard ? 34 : 46);
    const glint = this.add.star(13, -18, 4, 2, 6, 0xffffff, 0.9)
      .setBlendMode(Phaser.BlendModes.ADD);
    view.add([shadow, pedestal, halo, icon, glint]);
    view.setDepth(5);
    this.objectLayer.add(view);
    this.tweens.add({
      targets: icon,
      y: -9,
      angle: isShard ? 8 : 0,
      duration: isShard ? 620 : 820,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
    this.tweens.add({
      targets: halo,
      scale: 1.22,
      alpha: 0.32,
      duration: 760,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.inOut'
    });
    this.tweens.add({
      targets: glint,
      angle: 180,
      alpha: 0.18,
      scale: 0.7,
      duration: 900,
      yoyo: true,
      repeat: -1
    });
    return view;
  }

  private useSpecial(actor: Player): void {
    if (actor.specialCooldownMs > 0) return;
    const view = this.views.get(actor.id);
    actor.specialCooldownMs = 6500;
    if (actor.character === 'dragon') {
      actor.stats.nextBombDragonCore = true;
      actor.specialCooldownMs = 10000;
      this.floatText(actor.world.x, actor.world.y - 50, 'Dragonflame', '#ff9f4b');
      this.specialPulse(actor, 0xff6a2b);
      if (view) this.animation.playSpecial(actor, view, 0xff6a2b);
      AudioSystem.get().sfx('surge');
    } else if (actor.character === 'wolf') {
      actor.specialCooldownMs = 7000;
      this.blinkActor(actor, 3, 0x9ec8ff, false);
      actor.stats.temporarySpeedBoost = 1800;
      this.floatText(actor.world.x, actor.world.y - 50, 'Wolf Sprint', '#bad7ff');
      this.specialPulse(actor, 0x9ec8ff);
      if (view) this.animation.playSpecial(actor, view, 0x9ec8ff);
      AudioSystem.get().sfx('blink');
    } else if (actor.character === 'frost') {
      actor.specialCooldownMs = 10000;
      actor.stats.nextBombFrostSnare = true;
      this.floatText(actor.world.x, actor.world.y - 50, 'Frost Snare', '#82e8ff');
      this.specialPulse(actor, 0x82e8ff);
      if (view) this.animation.playSpecial(actor, view, 0x82e8ff);
      AudioSystem.get().sfx('frost');
    } else if (actor.character === 'veil') {
      actor.specialCooldownMs = 12000;
      actor.stats.temporaryGhostMode = 3000;
      this.floatText(actor.world.x, actor.world.y - 50, 'Ghost Veil', '#d9b8ff');
      this.specialPulse(actor, 0xd9b8ff);
      if (view) this.animation.playSpecial(actor, view, 0xd9b8ff);
      AudioSystem.get().sfx('ghost');
    } else if (actor.character === 'skin') {
      actor.specialCooldownMs = 10000;
      this.spawnDecoy(actor);
      actor.invulnerableMs = 650;
      this.floatText(actor.world.x, actor.world.y - 50, 'Mirror Shade', '#d0a06a');
      if (view) this.animation.playSpecial(actor, view, 0xd0a06a);
      AudioSystem.get().sfx('blink');
    } else if (actor.character === 'stone') {
      actor.specialCooldownMs = 12000;
      actor.stats.shielded = true;
      this.floatText(actor.world.x, actor.world.y - 50, 'Shield', '#f7d783');
      this.specialPulse(actor, 0xf0ca73);
      if (view) this.animation.playSpecial(actor, view, 0xf0ca73);
      AudioSystem.get().sfx('shield');
    } else if (actor.character === 'raven') {
      actor.specialCooldownMs = 8000;
      this.blinkActor(actor, 3, 0xb394ff, true);
      this.floatText(actor.world.x, actor.world.y - 50, 'Raven Blink', '#d9b8ff');
      if (view) this.animation.playSpecial(actor, view, 0xb394ff);
      AudioSystem.get().sfx('blink');
    } else {
      actor.specialCooldownMs = 12000;
      this.beastClaw(actor);
      this.floatText(actor.world.x, actor.world.y - 50, 'Beast Call', '#8bd56f');
      if (view) this.animation.playSpecial(actor, view, 0x8bd56f);
      AudioSystem.get().sfx('beast');
    }
  }

  private tickStatuses(dt: number): void {
    for (const actor of this.actors) {
      actor.invulnerableMs = Math.max(0, actor.invulnerableMs - dt);
      actor.slowedMs = Math.max(0, actor.slowedMs - dt);
      actor.specialCooldownMs = Math.max(0, actor.specialCooldownMs - dt);
      actor.lastPowerUpMs = Math.max(0, actor.lastPowerUpMs - dt);
      if (actor.lastPowerUpMs <= 0) actor.lastPowerUp = undefined;
      actor.stats.temporaryGhostMode = Math.max(0, actor.stats.temporaryGhostMode - dt);
      actor.stats.temporarySpeedBoost = Math.max(0, actor.stats.temporarySpeedBoost - dt);
      actor.stats.championSurgeMs = Math.max(0, actor.stats.championSurgeMs - dt);
    }
  }

  private floatText(x: number, y: number, label: string, color: string): void {
    const text = this.add.text(x, y, label, { fontFamily: 'Georgia', fontSize: '18px', color }).setOrigin(0.5);
    this.tweens.add({ targets: text, y: y - 26, alpha: 0, duration: 900, onComplete: () => text.destroy() });
  }

  private floatPickup(x: number, y: number, type: import('../utils/types').PowerUpType, label: string): void {
    const def = getPowerUp(type);
    const texture = this.textures.exists(def.assetKey) ? def.assetKey : 'power-fallback';
    const icon = this.add.image(x - 30, y, texture).setDisplaySize(30, 30);
    const text = this.add.text(x + 8, y - 10, `${def.name} ${label}`, {
      fontFamily: 'Georgia',
      fontSize: '15px',
      color: '#f4ead2',
      stroke: '#08080c',
      strokeThickness: 3
    });
    const group = this.add.container(0, 0, [icon, text]);
    this.uiLayer.add(group);
    this.tweens.add({ targets: group, y: -28, alpha: 0, duration: 1050, onComplete: () => group.destroy() });
  }

  private applyPowerUpFeedback(actor: Player, type: PowerUpType, label: string): void {
    const def = getPowerUp(type);
    const color = def.color;
    const view = this.views.get(actor.id);
    this.animation.emitPickupBurst(actor, color, type === 'crownSurge' ? 22 : 14);
    if (view) this.animation.playSpecial(actor, view, color);
    this.specialPulse(actor, color);
    if (type === 'ravenBlink') this.blinkActor(actor, 3, color, true);
    if (type === 'beastCall') this.beastClaw(actor);
    if (type === 'twin') this.orbitRunes(actor, color);
    if (type === 'remoteHex') this.floatText(actor.world.x, actor.world.y - 70, `Remote x${actor.stats.remoteCharges}`, '#d9b8ff');
    switch (type as PowerUpType) {
      case 'crownSurge':
        this.crownBurst(actor);
        AudioSystem.get().sfx('surge');
        break;
      case 'stoneguard':
        AudioSystem.get().sfx('shield');
        break;
      case 'ghostVeil':
        AudioSystem.get().sfx('ghost');
        break;
      case 'frostSnare':
        AudioSystem.get().sfx('frost');
        break;
      case 'ravenBlink':
        AudioSystem.get().sfx('blink');
        break;
      case 'beastCall':
        AudioSystem.get().sfx('beast');
        break;
      default:
        AudioSystem.get().sfx('pickup');
    }
    this.floatText(actor.world.x, actor.world.y - 66, label, `#${color.toString(16).padStart(6, '0')}`);
  }

  private orbitRunes(actor: Player, color: number): void {
    const dots = [0, Math.PI].map((phase) => {
      const dot = this.add.circle(actor.world.x, actor.world.y - 8, 5, color, 0.9);
      this.effectLayer.add(dot);
      return { dot, phase };
    });
    const start = this.time.now;
    const event = this.time.addEvent({
      delay: 16,
      repeat: 62,
      callback: () => {
        const t = (this.time.now - start) / 190;
        for (const item of dots) {
          item.dot.setPosition(actor.world.x + Math.cos(t + item.phase) * 24, actor.world.y - 8 + Math.sin(t + item.phase) * 12);
          item.dot.setAlpha(Math.max(0, 1 - (this.time.now - start) / 1000));
        }
      }
    });
    this.time.delayedCall(1050, () => {
      event.remove(false);
      dots.forEach((item) => item.dot.destroy());
    });
  }

  private crownBurst(actor: Player): void {
    const crown = this.add.star(actor.world.x, actor.world.y - 30, 6, 8, 24, 0xfff0a0, 0.92).setStrokeStyle(2, 0xffffff, 0.8);
    this.effectLayer.add(crown);
    this.tweens.add({ targets: crown, scale: 2.6, angle: 160, alpha: 0, duration: 700, ease: 'Cubic.easeOut', onComplete: () => crown.destroy() });
  }

  private redrawHealth(actor: Player): void {
    const view = this.views.get(actor.id);
    if (!view) return;
    view.health.removeAll(true);
    const total = actor.stats.maxHealth;
    for (let i = 0; i < total; i += 1) {
      const x = (i - (total - 1) / 2) * 10;
      view.health.add(this.add.circle(x, 0, 3, i < actor.stats.health ? actor.accent : 0x1b1820, i < actor.stats.health ? 1 : 0.65).setStrokeStyle(1, 0x08080c));
    }
  }

  private specialPulse(actor: Player, color: number): void {
    const ring = this.add.circle(actor.world.x, actor.world.y, 18, color, 0.14).setStrokeStyle(3, color, 0.9);
    this.effectLayer.add(ring);
    this.tweens.add({ targets: ring, scale: 3, alpha: 0, duration: 620, ease: 'Cubic.easeOut', onComplete: () => ring.destroy() });
  }

  private updateShrine(dt: number): void {
    this.shrineTimerMs -= dt;
    this.updateShrineVisual();
    if (this.shrineTimerMs > 0) return;
    this.shrineTimerMs = 15000 + Math.random() * 5000;
    if (this.powerSprites.has(`shard-${keyOf(this.shrineTile)}`)) return;
    if (this.powers.powerUps.some((p) => sameTile(p.grid, this.shrineTile))) return;
    if (!this.grid.isWalkable(this.shrineTile)) return;
    if (SESSION.mode === 'shards' || Math.random() < 0.35) {
      this.spawnShard(this.shrineTile);
      this.announceShrine('Crown Shard spawned');
    } else {
      const rare = Math.random() < 0.25;
      this.powers.spawn(this.shrineTile, rare ? 'crownSurge' : 'dragonCore');
      this.announceShrine(rare ? 'Rare Rune at centre' : 'Shrine awakened');
    }
    const w = this.grid.toWorld(this.shrineTile);
    this.floatText(w.x, w.y - 44, 'Control the centre', '#f7d783');
  }

  private updateShrineVisual(): void {
    const w = this.grid.toWorld(this.shrineTile);
    if (!this.shrineCountdown) {
      this.shrineCountdown = this.add.circle(w.x, w.y, 42, this.grid.map.glow, 0)
        .setStrokeStyle(4, this.grid.map.glow, 0.68);
      this.effectLayer.add(this.shrineCountdown);
      this.shrineText = this.add.text(w.x, w.y - 58, '', {
        fontFamily: 'Georgia',
        fontSize: '12px',
        color: '#f7d783',
        stroke: '#08080c',
        strokeThickness: 2
      }).setOrigin(0.5);
      this.effectLayer.add(this.shrineText);
    }
    const remaining = Math.max(0, Math.ceil(this.shrineTimerMs / 1000));
    const urgency = 1 - Math.min(1, this.shrineTimerMs / 15000);
    this.shrineCountdown.setAlpha(0.22 + urgency * 0.55).setScale(0.9 + urgency * 0.35);
    this.shrineText?.setText(remaining <= 5 ? `Shrine ${remaining}` : '');
  }

  private announceShrine(message: string): void {
    const banner = this.add.text(GAME_CONFIG.width / 2, 92, message, {
      fontFamily: 'Georgia',
      fontSize: '22px',
      color: '#f7d783',
      stroke: '#08080c',
      strokeThickness: 4
    }).setOrigin(0.5).setDepth(60);
    this.tweens.add({ targets: banner, y: 74, alpha: 0, delay: 900, duration: 650, onComplete: () => banner.destroy() });
    AudioSystem.get().sfx('pickup');
  }

  private updateFrostZones(dt: number): void {
    for (const [key, ms] of [...this.frostZones]) {
      const next = ms - dt;
      if (next <= 0) {
        this.frostZones.delete(key);
        this.frostSprites.get(key)?.destroy();
        this.frostSprites.delete(key);
      } else {
        this.frostZones.set(key, next);
        if (!this.frostSprites.has(key)) {
          const [x, y] = key.split(',').map(Number);
          const w = this.grid.toWorld({ x, y });
          const frost = this.add.rectangle(w.x, w.y, GAME_CONFIG.tileSize - 12, GAME_CONFIG.tileSize - 12, 0x75d7ff, 0.18)
            .setStrokeStyle(1, 0xd8f7ff, 0.45);
          this.effectLayer.add(frost);
          this.frostSprites.set(key, frost);
        }
      }
    }
  }

  private resolveChampionSurgeTouches(): void {
    const surging = this.actors.filter((a) => a.alive && a.stats.championSurgeMs > 0);
    for (const attacker of surging) {
      for (const target of this.actors) {
        if (target === attacker || !target.alive) continue;
        if (distance(attacker.grid, target.grid) <= 0) {
          this.crownBurst(target);
          this.damageActor(target, attacker.id);
        }
      }
    }
  }

  private blinkActor(actor: Player, maxTiles: number, color: number, canHopBlocks: boolean): void {
    const start = { ...actor.grid };
    let landing = { ...actor.grid };
    for (let i = 1; i <= maxTiles; i += 1) {
      const candidate = { x: start.x + actor.lastDir.x * i, y: start.y + actor.lastDir.y * i };
      if (!this.grid.inBounds(candidate) || this.grid.get(candidate) === 'solid') break;
      if (this.grid.isWalkable(candidate) && !this.bombs.isBombBlocking(candidate)) landing = candidate;
      else if (!canHopBlocks) break;
    }
    const from = this.grid.toWorld(actor.grid);
    const shade = this.add.circle(from.x, from.y, 20, color, 0.18).setStrokeStyle(2, color, 0.48);
    this.effectLayer.add(shade);
    actor.grid = landing;
    actor.world = this.grid.toWorld(landing);
    const to = actor.world;
    const trail = this.add.line(0, 0, from.x, from.y, to.x, to.y, color, 0.65).setLineWidth(5).setDepth(40);
    this.tweens.add({ targets: [shade, trail], alpha: 0, duration: 420, onComplete: () => { shade.destroy(); trail.destroy(); } });
    this.specialPulse(actor, color);
  }

  private spawnDecoy(actor: Player): void {
    const texture = this.textures.exists(`champion-${actor.character}`) ? `champion-${actor.character}` : 'champion-fallback';
    const decoy = this.add.image(actor.world.x, actor.world.y - 8, texture).setScale(0.22).setAlpha(0.45).setTint(0xd0a06a);
    this.objectLayer.add(decoy);
    this.tweens.add({ targets: decoy, alpha: 0, y: decoy.y - 8, duration: 4000, onComplete: () => decoy.destroy() });
  }

  private beastClaw(actor: Player): void {
    const target = this.actors.filter((a) => a !== actor && a.alive).sort((a, b) => distance(actor.grid, a.grid) - distance(actor.grid, b.grid))[0];
    if (!target) return;
    const claw = this.add.circle(actor.world.x, actor.world.y, 10, 0x8bd56f, 0.9);
    this.effectLayer.add(claw);
    this.tweens.add({
      targets: claw,
      x: target.world.x,
      y: target.world.y,
      duration: 420,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        target.slowedMs = 2200;
        if (distance(actor.grid, target.grid) <= 6) this.damageActor(target, actor.id);
        claw.destroy();
      }
    });
  }

  private emitDebris(tile: GridPosition): void {
    const world = this.grid.toWorld(tile);
    const color = getMapTheme(this.grid.map.id).accentColor;
    for (let i = 0; i < 6; i += 1) {
      const chip = this.add.rectangle(world.x, world.y, 5, 5, color, 0.65);
      this.effectLayer.add(chip);
      this.tweens.add({ targets: chip, x: world.x + Phaser.Math.Between(-18, 18), y: world.y + Phaser.Math.Between(-18, 18), alpha: 0, duration: 450, onComplete: () => chip.destroy() });
    }
  }

  private animateBlockBreak(block: Phaser.GameObjects.Container): void {
    this.tweens.killTweensOf(block);
    this.tweens.add({
      targets: block,
      scale: 1.18,
      angle: Phaser.Math.Between(-5, 5),
      alpha: 0,
      duration: 180,
      ease: 'Cubic.easeOut',
      onComplete: () => block.destroy()
    });
  }

  private directionFromLast(actor: Player): Direction {
    if (actor.lastDir.x < 0) return 'left';
    if (actor.lastDir.x > 0) return 'right';
    if (actor.lastDir.y < 0) return 'up';
    if (actor.lastDir.y > 0) return 'down';
    return 'down';
  }

  private showRoundIntro(): void {
    const modeDef = MODES.find((m) => m.id === SESSION.mode) ?? MODES[0];
    const bg = this.add.rectangle(640, 285, 700, 142, 0x0d0c12, 0.95).setStrokeStyle(2, this.grid.map.glow, 0.8);
    const accent = this.add.rectangle(640, 219, 660, 4, this.grid.map.glow, 0.8);
    const text = this.add.text(640, 235, `${this.grid.map.name}  •  ${modeDef.name}`, {
      fontFamily: 'Georgia',
      fontSize: '28px',
      color: '#f7d783'
    }).setOrigin(0.5);
    const objective = this.add.text(640, 280, modeDef.objective, {
      fontFamily: 'Arial', fontStyle: 'bold',
      fontSize: '16px',
      color: '#f4ead2'
    }).setOrigin(0.5);
    const hint = this.add.text(640, 326, 'Break blocks • collect runes • control the centre\nWASD move   SPACE bomb   SHIFT special   E remote', {
      fontFamily: 'Arial',
      fontSize: '14px', align: 'center', lineSpacing: 7,
      color: '#cbb99a'
    }).setOrigin(0.5);
    const c = this.add.container(0, 0, [bg, accent, text, objective, hint]).setDepth(120);
    this.uiLayer.add(c);
    this.tweens.add({ targets: c, alpha: 0, delay: 3000, duration: 650, onComplete: () => c.destroy() });
  }

  private togglePause(): void {
    if (this.pausedText) {
      this.pausedText.destroy();
      this.pausedText = undefined;
      this.paused = false;
      return;
    }
    const bg = this.add.rectangle(640, 360, 430, 190, 0x111018, 0.97).setStrokeStyle(2, 0xd8a84e);
    const label = this.add.text(640, 330, 'Trial Paused', { fontFamily: 'Georgia', fontSize: '38px', color: '#f7d783' }).setOrigin(0.5);
    const hint = this.add.text(640, 388, 'ESC  Resume     R  Restart     Q  Main Menu', { fontFamily: 'Arial', fontStyle: 'bold', fontSize: '15px', color: '#b5a995' }).setOrigin(0.5);
    this.pausedText = this.add.container(0, 0, [bg, label, hint]).setDepth(50);
    this.paused = true;
    this.input.keyboard!.once('keydown-R', () => this.scene.restart());
    this.input.keyboard!.once('keydown-Q', () => this.scene.start('MainMenuScene'));
  }

  private finish(won: boolean, reason: string): void {
    this.ended = true;
    this.bombViews.cleanup();
    AudioSystem.get().sfx(won ? 'victory' : 'loss');
    const reward = awardMatch(this.player, won, this.mode.elapsedMs);
    this.time.delayedCall(700, () => {
      this.scene.start('ResultsScene', {
        won,
        reason,
        crowns: reward.crowns,
        total: reward.total,
        kills: this.player.kills,
        shards: this.player.shards,
        time: this.mode.elapsedMs
      });
    });
  }

  private pulseHudForPower(type: PowerUpType): void {
    if (type === 'ember' || type === 'twin') this.hud.pulse('stats', type === 'ember' ? '#ff9f4b' : '#d9b8ff');
    else if (type === 'stoneguard') this.hud.pulse('health', '#f7d783');
    else this.hud.pulse('power', `#${getPowerUp(type).color.toString(16).padStart(6, '0')}`);
  }

  private toggleMute(): void {
    const muted = AudioSystem.get().toggleMute();
    this.floatText(640, 98, muted ? 'Audio muted' : 'Audio on', '#f7d783');
  }

  private shutdown(): void {
    this.bombViews?.cleanup();
    this.tweens.killAll();
    this.input.keyboard?.removeAllListeners();
    this.powerSprites.clear();
    this.blockSprites.clear();
    this.views.clear();
  }
}
