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
import { AIController, type BotIntent } from '../controllers/AIController';
import { HUD } from '../ui/HUD';
import { AnimationSystem, type ActorVisual } from '../systems/AnimationSystem';
import { ExplosionSystem } from '../systems/ExplosionSystem';
import { getBombTheme } from '../config/BombVisualThemes';
import { getMapTheme } from '../config/MapThemes';
import { MapRenderer } from '../systems/MapRenderer';
import { AudioSystem } from '../systems/AudioSystem';
import { MatchTelemetrySystem } from '../systems/MatchTelemetrySystem';
import { BombViewSystem } from '../systems/BombViewSystem';
import { TouchController } from '../controllers/TouchController';
import { POWER_UPS } from '../config/PowerUps';
import { setMatchPresentation, type DeviceProfile } from '../systems/DeviceProfile';
import { menuButton } from '../ui/MenuButton';
import { DragonBlastVfxSystem } from '../systems/DragonBlastVfxSystem';

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
  private dragonBlastFx!: DragonBlastVfxSystem;
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
  private frostZoneOwners = new Map<string, string>();
  private frostSprites = new Map<string, Phaser.GameObjects.Container>();
  private shrineTimerMs = 15000;
  private shrineTile!: GridPosition;
  private shrineCountdown?: Phaser.GameObjects.Arc;
  private shrineText?: Phaser.GameObjects.Text;
  private spawnGraceMs = 2200;
  private readonly debugSpawnSafe = false;
  private pausedText?: Phaser.GameObjects.Container;
  private paused = false;
  private ended = false;
  private device!: DeviceProfile;
  private sandboxOpen = false;
  private sandboxPanel?: Phaser.GameObjects.Container;
  private sandboxLauncher?: Phaser.GameObjects.Container;

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.resetMatchState();
    this.device = setMatchPresentation(true);
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
    this.touch = new TouchController(this, this.device);
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
    this.dragonBlastFx = new DragonBlastVfxSystem(this, this.grid, this.effectLayer);
    this.bombViews = new BombViewSystem(this, this.grid, this.objectLayer, this.explosionFx);
    this.drawArena();
    this.powers.seedInitial(SESSION.mode === 'sandbox' ? 0 : SESSION.mode === 'classic' ? 5 : 7);
    this.spawnActors();
    this.hud = new HUD(this);
    this.hud.create(modeDef, this.device.compactHud);
    if (SESSION.mode === 'sandbox') {
      this.createSandboxLauncher();
      this.input.keyboard?.on('keydown-T', this.toggleSandboxLab, this);
    }
    this.showRoundIntro();
    AudioSystem.get().sfx('matchStart');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(_: number, delta: number): void {
    if (this.ended) return;
    if (this.human.consumePause() || this.touch?.consumePause()) this.togglePause();
    if (this.paused) return;
    if (this.sandboxOpen) return;
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
    if (SESSION.mode === 'sandbox') {
      const targetDef = CHARACTERS.find((character) => character.id === 'stone') ?? CHARACTERS[0];
      const targetSpawn = this.grid.map.spawns[2];
      const target = new Bot(
        'sandbox-target',
        'Practice Rival',
        targetDef.id,
        { ...targetSpawn },
        this.grid.toWorld(targetSpawn),
        makeStats(targetDef.id),
        false,
        targetDef.palette,
        targetDef.accent
      );
      target.stats.health = 20;
      target.stats.maxHealth = 20;
      this.actors.push(target);
      for (const actor of this.actors) this.makeActorView(actor);
      return;
    }
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
    this.touch?.setRemoteAvailable(this.player.stats.remoteArmedBombs);
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
    if (SESSION.mode === 'sandbox') return;
    for (const bot of this.actors.filter((a): a is Bot => a instanceof Bot && a.alive)) {
      if (this.spawnGraceMs > 0) continue;
      bot.thinkMs -= dt;
      let intent: BotIntent = { dir: 'none' as Direction, placeBomb: false };
      if (bot.thinkMs <= 0 || distance(bot.grid, this.player.grid) < 4) {
        intent = this.ai.think(bot, this.actors.filter((actor) => actor !== bot && actor.alive), this.grid, this.bombs, this.danger, this.powers);
        bot.thinkMs = 120 + Math.random() * 120;
      }
      // Resolve the tactical decision first: Dragon/Frost must arm the bomb
      // being placed this tick, then immediately start the planned escape.
      if (intent.useSpecial) this.useSpecial(bot);
      if (intent.placeBomb) this.placeBomb(bot);
      this.moveActor(bot, intent.dir, dt);
    }
  }

  private moveActor(actor: Player, dir: Direction, dt: number): void {
    if (!actor.alive) return;
    this.applyFrostZoneToActor(actor);
    if (actor.snaredMs > 0 || dir === 'none') return;
    const d = dir === 'up' ? { x: 0, y: -1 } : dir === 'down' ? { x: 0, y: 1 } : dir === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
    actor.lastDir = d;
    const previousGrid = { ...actor.grid };
    const surgeBoost = actor.stats.championSurgeMs > 0 ? 18 : 0;
    const speedBoost = actor.stats.temporarySpeedBoost > 0 ? actor.stats.moveSpeed * 0.35 : 0;
    const speed = (actor.stats.moveSpeed + speedBoost + surgeBoost) * (actor.slowedMs > 0 ? 0.52 : 1);
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
    if (!sameTile(previousGrid, actor.grid) && actor.frostTrailMs > 0) {
      this.addFrostZone(previousGrid, 4200, actor.id);
      this.addFrostZone(actor.grid, 4200, actor.id);
    }
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
      for (const tile of explosion.tiles) this.addFrostZone(tile, 3000, explosion.ownerId);
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
      actor.stats.shieldMs = 0;
      actor.invulnerableMs = 500;
      this.floatText(actor.world.x, actor.world.y - 42, 'Shield', '#f7d783');
      this.animation.shieldBreak(actor);
      AudioSystem.get().sfx('shieldBreak');
      return;
    }
    if (SESSION.mode === 'sandbox' && actor.isHuman) {
      actor.invulnerableMs = 500;
      this.floatText(actor.world.x, actor.world.y - 42, 'Sandbox ward', '#9ec8ff');
      this.specialPulse(actor, 0x9ec8ff);
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
      actor.specialCooldownMs = 10000;
      this.dragonBlast(actor);
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
      actor.frostTrailMs = 5000;
      this.addFrostZone(actor.grid, 4200, actor.id);
      this.floatText(actor.world.x, actor.world.y - 50, 'Ice Feet - 5s', '#82e8ff');
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
      actor.stats.shieldMs = 10000;
      this.floatText(actor.world.x, actor.world.y - 50, 'Shield active - 10s', '#f7d783');
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
      const shieldWasActive = actor.stats.shielded;
      actor.invulnerableMs = Math.max(0, actor.invulnerableMs - dt);
      actor.slowedMs = Math.max(0, actor.slowedMs - dt);
      actor.snaredMs = Math.max(0, actor.snaredMs - dt);
      actor.frostImmunityMs = Math.max(0, actor.frostImmunityMs - dt);
      actor.frostTrailMs = Math.max(0, actor.frostTrailMs - dt);
      actor.specialCooldownMs = Math.max(0, actor.specialCooldownMs - dt);
      actor.lastPowerUpMs = Math.max(0, actor.lastPowerUpMs - dt);
      if (actor.lastPowerUpMs <= 0) actor.lastPowerUp = undefined;
      actor.stats.temporaryGhostMode = Math.max(0, actor.stats.temporaryGhostMode - dt);
      actor.stats.temporarySpeedBoost = Math.max(0, actor.stats.temporarySpeedBoost - dt);
      actor.stats.championSurgeMs = Math.max(0, actor.stats.championSurgeMs - dt);
      actor.stats.shieldMs = Math.max(0, actor.stats.shieldMs - dt);
      if (shieldWasActive && actor.stats.shieldMs <= 0) {
        actor.stats.shielded = false;
        this.floatText(actor.world.x, actor.world.y - 46, 'Shield faded', '#d6c8a4');
      }
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
        this.frostZoneOwners.delete(key);
        this.frostSprites.get(key)?.destroy();
        this.frostSprites.delete(key);
      } else {
        this.frostZones.set(key, next);
        if (!this.frostSprites.has(key)) {
          const [x, y] = key.split(',').map(Number);
          const w = this.grid.toWorld({ x, y });
          const frost = this.add.container(w.x, w.y);
          const tile = this.add.rectangle(0, 0, GAME_CONFIG.tileSize - 8, GAME_CONFIG.tileSize - 8, 0x75d7ff, 0.16)
            .setStrokeStyle(2, 0xd8f7ff, 0.58);
          const rune = this.add.image(0, 0, 'blast-frost').setDisplaySize(42, 42).setAlpha(0.48);
          const shardA = this.add.triangle(-12, 9, 0, -12, 5, 8, -5, 8, 0xd8f7ff, 0.72);
          const shardB = this.add.triangle(13, 11, 0, -9, 4, 7, -4, 7, 0x75d7ff, 0.78);
          frost.add([tile, rune, shardA, shardB]);
          this.effectLayer.add(frost);
          this.tweens.add({ targets: rune, alpha: 0.7, scale: 1.08, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
          this.frostSprites.set(key, frost);
        }
        if (next < 650) this.frostSprites.get(key)?.setAlpha(Math.max(0, next / 650));
      }
    }
  }

  private addFrostZone(tile: GridPosition, durationMs: number, ownerId: string): void {
    if (!this.grid.inBounds(tile) || this.grid.get(tile) !== 'empty') return;
    const key = keyOf(tile);
    this.frostZones.set(key, Math.max(durationMs, this.frostZones.get(key) ?? 0));
    this.frostZoneOwners.set(key, ownerId);
  }

  private applyFrostZoneToActor(actor: Player): void {
    const key = keyOf(actor.grid);
    if (!this.frostZones.has(key) || this.frostZoneOwners.get(key) === actor.id || actor.frostImmunityMs > 0) return;
    actor.snaredMs = 720;
    actor.slowedMs = 2400;
    actor.frostImmunityMs = 2900;
    this.floatText(actor.world.x, actor.world.y - 50, 'Icebound - break free!', '#d8f7ff');
    this.specialPulse(actor, 0x75d7ff);
    this.animation.emitPickupBurst(actor, 0x75d7ff, 10);
    AudioSystem.get().sfx('frost');
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

  private dragonBlast(actor: Player): void {
    const direction = actor.lastDir.x === 0 && actor.lastDir.y === 0 ? { x: 0, y: 1 } : actor.lastDir;
    const tiles: GridPosition[] = [];
    for (let step = 1; step <= 6; step += 1) {
      const tile = {
        x: actor.grid.x + direction.x * step,
        y: actor.grid.y + direction.y * step
      };
      if (!this.grid.inBounds(tile) || this.grid.get(tile) !== 'empty') break;
      tiles.push(tile);
    }

    if (!tiles.length) {
      this.floatText(actor.world.x, actor.world.y - 52, 'Dragon Blast blocked', '#ffb36b');
      this.specialPulse(actor, 0xff6a2b);
      return;
    }

    this.floatText(actor.world.x, actor.world.y - 54, `Dragon Blast - range ${tiles.length}`, '#ffb36b');
    this.specialPulse(actor, 0xff6a2b);
    const telegraph = this.dragonBlastFx.telegraph(actor.grid, tiles, direction);
    AudioSystem.get().sfx('tick');

    this.time.delayedCall(380, () => {
      telegraph.forEach((item) => item.destroy());
      if (!actor.alive || this.ended) return;
      this.dragonBlastFx.fire(actor.grid, tiles, direction);

      for (const target of this.actors) {
        if (target === actor || !target.alive || !tiles.some((tile) => sameTile(tile, target.grid))) continue;
        const healthBefore = target.stats.health;
        this.damageActor(target, actor.id);
        if (target.stats.health < healthBefore) this.floatText(target.world.x, target.world.y - 68, 'Dragonfire hit', '#ffb36b');
      }
      AudioSystem.get().sfx('dragonBlast');
    });
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

  private createSandboxLauncher(): void {
    const x = this.device.compactHud ? 1060 : 1150;
    const y = this.device.compactHud ? 112 : 525;
    const glow = this.add.rectangle(x, y, 142, 40, 0x9e70ff, 0.12).setStrokeStyle(2, 0xd9b8ff, 0.8);
    const label = this.add.text(x, y, this.device.compactHud ? 'RUNE LAB' : 'RUNE LAB  [T]', {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '12px',
      color: '#f4ead2'
    }).setOrigin(0.5);
    const zone = this.add.zone(x, y, 156, 52).setInteractive({ useHandCursor: true });
    zone.on('pointerdown', () => this.toggleSandboxLab());
    this.sandboxLauncher = this.add.container(0, 0, [glow, label, zone]).setDepth(175);
  }

  private toggleSandboxLab(): void {
    if (SESSION.mode !== 'sandbox') return;
    if (this.sandboxPanel) {
      this.sandboxPanel.destroy(true);
      this.sandboxPanel = undefined;
      this.sandboxOpen = false;
      this.sandboxLauncher?.setVisible(true);
      return;
    }

    this.sandboxOpen = true;
    this.sandboxLauncher?.setVisible(false);
    const backdrop = this.add.rectangle(640, 360, 1280, 720, 0x05060a, 0.84).setInteractive();
    const panel = this.add.rectangle(640, 360, 920, 580, 0x10121a, 0.98).setStrokeStyle(3, 0xa974ff, 0.78);
    const title = this.add.text(640, 92, 'Rune Lab', {
      fontFamily: 'Georgia',
      fontSize: '36px',
      color: '#f7d783',
      stroke: '#08080c',
      strokeThickness: 4
    }).setOrigin(0.5);
    const instruction = this.add.text(640, 128, 'Tap a rune to apply its real match effect. Restart clears the arena and every stack.', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#cbb99a'
    }).setOrigin(0.5);
    const children: Phaser.GameObjects.GameObject[] = [backdrop, panel, title, instruction];

    POWER_UPS.forEach((power, index) => {
      const column = index % 4;
      const row = Math.floor(index / 4);
      const x = 340 + column * 200;
      const y = 206 + row * 118;
      const card = this.add.rectangle(x, y, 184, 102, 0x171923, 0.98).setStrokeStyle(2, power.color, 0.56);
      const icon = this.add.image(x - 61, y, this.textures.exists(power.assetKey) ? power.assetKey : 'power-fallback').setDisplaySize(54, 54);
      const name = this.add.text(x - 25, y - 32, power.name, {
        fontFamily: 'Georgia',
        fontSize: '14px',
        color: '#f4ead2',
        wordWrap: { width: 108 }
      });
      const effect = this.add.text(x - 25, y + 2, power.description, {
        fontFamily: 'Arial',
        fontSize: '10px',
        color: '#b5a995',
        wordWrap: { width: 110 }
      });
      const cardZone = this.add.zone(x, y, 184, 102).setInteractive({ useHandCursor: true });
      cardZone.on('pointerover', () => card.setFillStyle(0x262838, 1));
      cardZone.on('pointerout', () => card.setFillStyle(0x171923, 0.98));
      cardZone.on('pointerdown', () => this.grantSandboxPower(power.id));
      children.push(card, icon, name, effect, cardZone);
    });

    const resetBg = this.add.rectangle(500, 635, 240, 48, 0x171923, 1).setStrokeStyle(2, 0xf06a31, 0.76);
    const resetText = this.add.text(500, 635, 'RESET SANDBOX', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '14px', color: '#f4ead2'
    }).setOrigin(0.5);
    const resetZone = this.add.zone(500, 635, 250, 58).setInteractive({ useHandCursor: true });
    resetZone.on('pointerdown', () => this.scene.restart());
    const closeBg = this.add.rectangle(780, 635, 240, 48, 0x171923, 1).setStrokeStyle(2, 0xd8a84e, 0.76);
    const closeText = this.add.text(780, 635, 'RETURN TO ARENA', {
      fontFamily: 'Arial', fontStyle: 'bold', fontSize: '14px', color: '#f4ead2'
    }).setOrigin(0.5);
    const closeZone = this.add.zone(780, 635, 250, 58).setInteractive({ useHandCursor: true });
    closeZone.on('pointerdown', () => this.toggleSandboxLab());
    children.push(resetBg, resetText, resetZone, closeBg, closeText, closeZone);
    this.sandboxPanel = this.add.container(0, 0, children).setDepth(220);
  }

  private grantSandboxPower(type: PowerUpType): void {
    const power = getPowerUp(type);
    const label = power.apply(this.player.stats);
    this.player.lastPowerUp = type;
    this.player.lastPowerUpMs = 4200;
    this.applyPowerUpFeedback(this.player, type, label);
    this.pulseHudForPower(type);
    this.redrawHealth(this.player);
    this.toggleSandboxLab();
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
    const hintText = SESSION.mode === 'sandbox'
      ? 'Open RUNE LAB to apply any power | practice rival has 20 health\nT opens lab   WASD move   SPACE bomb   SHIFT special'
      : 'Break blocks | collect runes | control the centre\nWASD move   SPACE bomb   SHIFT special   E remote';
    const hint = this.add.text(640, 326, hintText, {
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
      this.closePauseOverlay();
      return;
    }
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x05060a, 0.76).setInteractive();
    const bg = this.add.rectangle(640, 360, 500, 390, 0x111018, 0.98).setStrokeStyle(2, 0xd8a84e);
    const label = this.add.text(640, 222, 'Trial Paused', {
      fontFamily: 'Georgia',
      fontSize: '38px',
      color: '#f7d783'
    }).setOrigin(0.5);
    const hint = this.add.text(640, 266, 'Resume, reset the arena, or return to the crown hall.', {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '14px',
      color: '#b5a995'
    }).setOrigin(0.5);
    const resume = menuButton(this, 640, 326, 'Resume', () => this.closePauseOverlay(), false, 320);
    const restart = menuButton(this, 640, 394, 'Restart Trial', () => this.restartTrial(), false, 320);
    const menu = menuButton(this, 640, 462, 'Main Menu', () => this.returnToMainMenu(), false, 320);
    this.pausedText = this.add.container(0, 0, [shade, bg, label, hint, resume, restart, menu]).setDepth(240);
    this.paused = true;
    this.input.keyboard?.once('keydown-R', this.restartTrial, this);
    this.input.keyboard?.once('keydown-Q', this.returnToMainMenu, this);
  }

  private closePauseOverlay(): void {
    this.input.keyboard?.off('keydown-R', this.restartTrial, this);
    this.input.keyboard?.off('keydown-Q', this.returnToMainMenu, this);
    this.pausedText?.destroy(true);
    this.pausedText = undefined;
    this.paused = false;
  }

  private restartTrial(): void {
    this.closePauseOverlay();
    this.scene.restart();
  }

  private returnToMainMenu(): void {
    this.closePauseOverlay();
    this.scene.start('MainMenuScene');
  }

  private finish(won: boolean, reason: string): void {
    this.ended = true;
    this.bombViews.cleanup();
    AudioSystem.get().sfx(won ? 'victory' : 'loss');
    const reward = awardMatch(this.player, won, this.mode.elapsedMs);
    MatchTelemetrySystem.record({
      map: SESSION.map,
      mode: SESSION.mode,
      champion: this.player.character,
      won,
      reason,
      elapsedMs: this.mode.elapsedMs,
      kills: this.player.kills,
      shards: this.player.shards,
      healthRemaining: this.player.stats.health,
      lastRune: this.player.lastPowerUp
    });
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

  private resetMatchState(): void {
    this.ended = false;
    this.paused = false;
    this.pausedText = undefined;
    this.shrineTimerMs = 15000;
    this.spawnGraceMs = 2200;
    this.shrineCountdown = undefined;
    this.shrineText = undefined;
    this.actors = [];
    this.views.clear();
    this.blockSprites.clear();
    this.powerSprites.clear();
    this.frostZones.clear();
    this.frostZoneOwners.clear();
    this.frostSprites.clear();
    this.sandboxOpen = false;
    this.sandboxPanel = undefined;
    this.sandboxLauncher = undefined;
  }

  private shutdown(): void {
    setMatchPresentation(false);
    this.input.keyboard?.off('keydown-R', this.restartTrial, this);
    this.input.keyboard?.off('keydown-Q', this.returnToMainMenu, this);
    this.bombViews?.cleanup();
    this.tweens.killAll();
    this.input.keyboard?.removeAllListeners();
    this.powerSprites.clear();
    this.blockSprites.clear();
    this.views.clear();
  }
}
