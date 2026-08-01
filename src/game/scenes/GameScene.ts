import Phaser from 'phaser';
import { SESSION, GAME_CONFIG } from '../config/GameConfig';
import { MAPS, makeArcadeMap, makeExpandedMap } from '../config/Maps';
import { MODES } from '../config/Modes';
import { CHARACTERS, makeStats } from '../config/Characters';
import { getPowerUp, isStoredPower, POWER_UPS } from '../config/PowerUps';
import { Player } from '../entities/Player';
import { Bot } from '../entities/Bot';
import type { Direction, GridPosition, PowerUpType, StoredPowerType } from '../utils/types';
import { keyOf, sameTile, distance, clamp, dirs } from '../utils/math';
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
import { MatchTelemetrySystem } from '../systems/MatchTelemetrySystem';
import { BombViewSystem } from '../systems/BombViewSystem';
import { TouchController } from '../controllers/TouchController';
import { setMatchPresentation, type DeviceProfile } from '../systems/DeviceProfile';
import { menuButton } from '../ui/MenuButton';
import { DragonBlastVfxSystem } from '../systems/DragonBlastVfxSystem';
import { NetworkSession } from '../network/NetworkSession';
import type {
  NetworkGameplayEnvelope,
  NetworkGameplayPayload,
  NetworkInputState,
  NetworkMatchSnapshot
} from '../network/NetworkProtocol';
import { Bomb } from '../entities/Bomb';
import { PowerUp } from '../entities/PowerUp';
import { applyBotProfile, buildBotRoster } from '../config/BotProfiles';
import { getArcadeWeapon, type ArcadeWeaponDef } from '../config/ArcadeWeapons';
import { WorldPresentationSystem } from '../systems/WorldPresentationSystem';
import { resolveArcadeSpawns } from '../systems/ArcadeSpawnSystem';

interface MirrorDecoy {
  ownerId: string;
  target: Player;
  visual: Phaser.GameObjects.Container;
  remainingMs: number;
}

export class GameScene extends Phaser.Scene {
  private grid!: GridSystem;
  private bombs!: BombSystem;
  private powers!: PowerUpSystem;
  private danger!: DangerMapSystem;
  private mode!: ModeSystem;
  private human!: HumanController;
  private human2?: HumanController;
  private touch?: TouchController;
  private ai!: AIController;
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
  private worldRoot!: Phaser.GameObjects.Container;
  private worldPresentation?: WorldPresentationSystem;
  private blockSprites = new Map<string, Phaser.GameObjects.Container>();
  private powerSprites = new Map<string, Phaser.GameObjects.Container>();
  private frostZones = new Map<string, number>();
  private frostZoneOwners = new Map<string, string>();
  private frostSprites = new Map<string, Phaser.GameObjects.Container>();
  private runeSightSprites = new Map<string, Phaser.GameObjects.Container>();
  private mirrorDecoys = new Map<string, MirrorDecoy>();
  private storedPowerAim?: Phaser.GameObjects.Container;
  private storedPowerAimKey = '';
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
  private readonly network = NetworkSession.get();
  private remoteInputs = new Map<string, NetworkInputState>();
  private networkSnapshotMs = 0;
  private networkInputMs = 0;
  private networkInputSequence = 0;
  private networkSnapshotSequence = 0;
  private lastReceivedSnapshotSequence = 0;
  private lastNetworkDirection: Direction = 'none';
  private networkStatusText?: Phaser.GameObjects.Text;
  private arcadeAttackMs = new Map<string, number>();
  private arcadeSecondaryMs = new Map<string, number>();
  private arcadePowerMs = new Map<string, number>();
  private arcadeBlockHealth = new Map<string, number>();
  private arcadeWispMarks = new Map<string, {
    tile: GridPosition;
    visual: Phaser.GameObjects.Container;
    timer: Phaser.Time.TimerEvent;
  }>();
  private actorSpawns: GridPosition[] = [];

  constructor() {
    super('GameScene');
  }

  create(): void {
    this.resetMatchState();
    this.device = setMatchPresentation(true);
    AudioSystem.get().startMusic('battle', SESSION.map);
    this.input.keyboard?.once('keydown-M', () => this.toggleMute());
    this.input.once('pointerdown', () => AudioSystem.get().startMusic('battle', SESSION.map));
    const selectedMap = MAPS.find((m) => m.id === SESSION.map) ?? MAPS[0];
    const map = SESSION.mode === 'grand'
      ? makeExpandedMap(selectedMap)
      : SESSION.mode === 'arcade'
        ? makeArcadeMap(selectedMap)
        : selectedMap;
    const modeDef = MODES.find((m) => m.id === SESSION.mode) ?? MODES[0];
    this.grid = new GridSystem(map);
    this.actorSpawns = SESSION.mode === 'arcade'
      ? resolveArcadeSpawns(this.grid, 4)
      : map.spawns.map((spawn) => ({ ...spawn }));
    this.shrineTile = { x: Math.floor(map.width / 2), y: Math.floor(map.height / 2) };
    this.bombs = new BombSystem(this.grid);
    this.powers = new PowerUpSystem(this.grid, SESSION.mode === 'grand'
      ? { dropChance: 0.4, maxActive: 16, minDistance: 2.5 }
      : undefined);
    this.danger = new DangerMapSystem();
    this.mode = new ModeSystem(SESSION.mode);
    this.ai = new AIController(this.network.active || SESSION.mode === 'grand' ? 'hard' : SESSION.botDifficulty);
    this.human = new HumanController(this, 'wasd');
    this.touch = new TouchController(this, this.device, SESSION.mode === 'arcade'
      ? { primary: 'STRIKE', secondary: 'SECONDARY', power: 'SIGNATURE' }
      : undefined);
    this.human2 = SESSION.localPlayers === 2 ? new HumanController(this, 'arrows') : undefined;
    this.worldRoot = this.add.container(0, 0).setDepth(0);
    this.tileLayer = this.add.container();
    this.objectLayer = this.add.container();
    this.effectLayer = this.add.container();
    this.worldRoot.add([this.tileLayer, this.objectLayer, this.effectLayer]);
    this.uiLayer = this.add.container();
    this.tileLayer.setDepth(0);
    this.effectLayer.setDepth(30);
    this.objectLayer.setDepth(20);
    this.uiLayer.setDepth(100);
    this.animation = new AnimationSystem(this, this.effectLayer);
    this.explosionFx = new ExplosionSystem(this, this.grid, this.effectLayer);
    this.dragonBlastFx = new DragonBlastVfxSystem(this, this.grid, this.effectLayer);
    this.bombViews = new BombViewSystem(this, this.grid, this.objectLayer, this.explosionFx);
    this.drawArena();
    this.powers.seedInitial(
      SESSION.mode === 'sandbox' || SESSION.mode === 'arcade' ? 0
        : SESSION.mode === 'grand' ? 10
          : SESSION.mode === 'classic' ? 5 : 7
    );
    this.spawnActors();
    this.worldPresentation = new WorldPresentationSystem(this, this.worldRoot, this.grid);
    this.worldPresentation.update();
    if (SESSION.mode === 'arcade') {
      for (const key of this.blockSprites.keys()) this.arcadeBlockHealth.set(key, 2);
    }
    this.hud = new HUD(this);
    this.hud.create(modeDef, this.device.compactHud);
    if (SESSION.mode === 'sandbox') {
      this.createSandboxLauncher();
      this.input.keyboard?.on('keydown-T', this.toggleSandboxLab, this);
    }
    if (this.network.active) this.setupNetworkMatch();
    this.showRoundIntro();
    AudioSystem.get().sfx('matchStart');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, this.shutdown, this);
  }

  update(_: number, delta: number): void {
    if (this.ended) return;
    const pausePressed = this.human.consumePause() || this.touch?.consumePause();
    if (this.network.active && this.network.role !== 'host') {
      if (pausePressed) this.sendGuestInput('none', false, false, false, true);
      if (!this.paused) this.updateNetworkGuest(Math.min(delta, 34));
      this.worldPresentation?.update();
      return;
    }
    if (pausePressed) this.togglePause();
    if (this.paused) return;
    if (this.sandboxOpen) return;
    const dt = Math.min(delta, 34);
    this.spawnGraceMs = Math.max(0, this.spawnGraceMs - dt);
    this.tickStatuses(dt);
    if (SESSION.mode === 'arcade') {
      this.tickArcade(dt);
      this.updateHuman(dt);
      this.updateHuman2(dt);
      this.updateBots(dt);
      this.syncSprites();
      this.worldPresentation?.update();
      const result = this.mode.update(dt, this.player, this.actors);
      this.hud.update(this.player, this.actors.filter((a) => !a.isHuman && a.alive).length, this.mode.elapsedMs);
      if (result?.done) this.finish(result.won, result.reason);
      return;
    }
    this.updateShrine(dt);
    this.updateFrostZones(dt);
    this.resolveChampionSurgeTouches();
    this.bombs.refreshPreviews();
    this.danger.rebuild(this.bombs.bombs, this.bombs.activeBlastTiles());
    this.updateHuman(dt);
    this.updateHuman2(dt);
    if (this.network.active && this.network.role === 'host') this.updateNetworkRemote(dt);
    this.updateBots(dt);
    const explosions = this.bombs.update(dt, this.actors);
    for (const explosion of explosions) this.resolveExplosion(explosion);
    this.danger.rebuild(this.bombs.bombs, this.bombs.activeBlastTiles());
    this.collectPowerUps();
    this.syncSprites();
    this.worldPresentation?.update();
    if (this.network.active && this.network.role === 'host') {
      this.mode.elapsedMs += dt;
      this.hud.update(this.player, this.actors.filter((actor) => actor !== this.player && actor.alive).length, this.mode.elapsedMs);
      this.updateNetworkResult();
      this.broadcastNetworkSnapshot(dt);
    } else {
      const result = this.mode.update(dt, this.player, this.actors);
      this.hud.update(this.player, this.actors.filter((a) => !a.isHuman && a.alive).length, this.mode.elapsedMs);
      if (result?.done) this.finish(result.won, result.reason);
    }
  }

  private setupNetworkMatch(): void {
    this.network.addEventListener('game', this.onNetworkGame);
    this.network.addEventListener('status', this.onNetworkStatus);
    this.network.addEventListener('lost', this.onNetworkLost);
    this.networkStatusText = this.add.text(640, 704, `RUMBLE ${this.network.room}  |  ${this.network.role?.toUpperCase()}`, {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '11px',
      color: '#9dc8ff',
      stroke: '#08080c',
      strokeThickness: 3
    }).setOrigin(0.5, 1).setDepth(190);
    this.uiLayer.add(this.networkStatusText);
  }

  private readonly onNetworkGame = (event: Event): void => {
    const envelope = (event as CustomEvent<NetworkGameplayEnvelope>).detail;
    const payload = envelope.payload;
    if (this.network.role === 'host') {
      if (payload.kind !== 'input') return;
      const sender = envelope.fromProfileId;
      if (!sender) return;
      const previous = this.remoteInputs.get(sender);
      if (previous && payload.input.sequence <= previous.sequence) return;
      this.remoteInputs.set(sender, payload.input);
      if (payload.input.pause) this.togglePause();
      return;
    }
    if (payload.kind === 'snapshot') {
      this.applyNetworkSnapshot(payload.snapshot);
    } else if (payload.kind === 'explosion') {
      this.explosionFx.renderExplosion(payload.tiles, getBombTheme(payload.themeId));
      AudioSystem.get().sfx('explosion');
    } else if (payload.kind === 'dragonBlast') {
      this.dragonBlastFx.fire(payload.origin, payload.tiles, payload.direction);
      AudioSystem.get().sfx('dragonBlast');
    } else if (payload.kind === 'matchEnd') {
      if (!this.ended) this.finish(payload.winnerId === this.player.id, payload.reason);
    } else if (payload.kind === 'restart') {
      this.scene.restart();
    } else if (payload.kind === 'pause') {
      this.setGuestNetworkPaused(payload.paused);
    }
  };

  private readonly onNetworkStatus = (event: Event): void => {
    const status = (event as CustomEvent<string>).detail;
    this.networkStatusText?.setText(
      status === 'reconnecting'
        ? `RUMBLE ${this.network.room}  |  RECONNECTING...`
        : `RUMBLE ${this.network.room}  |  ${status.toUpperCase()}`
    );
    this.networkStatusText?.setColor(status === 'reconnecting' ? '#f7d783' : '#9dc8ff');
  };

  private readonly onNetworkLost = (): void => {
    if (this.ended) return;
    this.ended = true;
    const notice = this.add.text(640, 360, 'Rumble connection lost\nReturning to the online hall...', {
      fontFamily: 'Georgia',
      fontSize: '28px',
      align: 'center',
      color: '#f4ead2',
      stroke: '#08080c',
      strokeThickness: 5
    }).setOrigin(0.5).setDepth(250);
    this.time.delayedCall(1200, () => {
      notice.destroy();
      this.network.leave();
      this.scene.start('MultiplayerLobbyScene');
    });
  };

  private updateNetworkGuest(dt: number): void {
    if (this.network.role === 'spectator') {
      this.syncSprites();
      this.updateFrostZones(0);
      this.updateShrineVisual();
      this.hud.update(this.player, this.actors.filter((actor) => actor !== this.player && actor.alive).length, this.mode.elapsedMs);
      return;
    }
    this.networkInputMs += dt;
    this.touch?.setRemoteAvailable(this.player.stats.remoteArmedBombs);
    const touchDirection = this.touch?.direction() ?? 'none';
    const direction = touchDirection !== 'none' ? touchDirection : this.human.direction();
    const bomb = this.human.consumeBomb() || Boolean(this.touch?.consumeBomb());
    const special = this.human.consumeSpecial() || Boolean(this.touch?.consumeSpecial());
    const remote = this.human.consumeRemote() || Boolean(this.touch?.consumeRemote());
    if (direction !== this.lastNetworkDirection || bomb || special || remote || this.networkInputMs >= 90) {
      this.sendGuestInput(direction, bomb, special, remote, false);
      this.lastNetworkDirection = direction;
      this.networkInputMs = 0;
    }
    this.syncSprites();
    this.updateFrostZones(0);
    this.updateShrineVisual();
    this.hud.update(this.player, this.actors.filter((actor) => actor !== this.player && actor.alive).length, this.mode.elapsedMs);
  }

  private sendGuestInput(
    direction: Direction,
    bomb: boolean,
    special: boolean,
    remote: boolean,
    pause: boolean
  ): void {
    this.network.send({
      kind: 'input',
      input: {
        direction,
        bomb,
        special,
        remote,
        pause,
        sequence: ++this.networkInputSequence
      }
    });
  }

  private updateNetworkRemote(dt: number): void {
    for (const [profileId, input] of this.remoteInputs) {
      if (profileId === this.network.clientId) continue;
      const remote = this.actors.find((actor) => actor.id === `online-${profileId}`);
      if (!remote || !remote.alive) continue;
      this.moveActor(remote, input.direction, dt);
      if (input.bomb) {
        if (SESSION.mode === 'arcade') this.arcadeStrike(remote);
        else this.placeBomb(remote);
        input.bomb = false;
      }
      if (input.special) {
        if (SESSION.mode === 'arcade') this.arcadeSignature(remote);
        else this.usePowerOrSpecial(remote);
        input.special = false;
      }
      if (input.remote) {
        if (SESSION.mode === 'arcade') this.arcadeSecondary(remote);
        else this.triggerRemote(remote);
        input.remote = false;
      }
    }
  }

  private broadcastNetworkSnapshot(dt: number): void {
    this.networkSnapshotMs += dt;
    if (this.networkSnapshotMs < 66) return;
    this.networkSnapshotMs = 0;
    const snapshot: NetworkMatchSnapshot = {
      sequence: ++this.networkSnapshotSequence,
      actors: this.actors.map((actor) => ({
        id: actor.id,
        name: actor.name,
        character: actor.character,
        grid: { ...actor.grid },
        world: { ...actor.world },
        stats: { ...actor.stats },
        alive: actor.alive,
        kills: actor.kills,
        shards: actor.shards,
        slowedMs: actor.slowedMs,
        snaredMs: actor.snaredMs,
        frostTrailMs: actor.frostTrailMs,
        frostTrailZoneMs: actor.frostTrailZoneMs,
        specialCooldownMs: actor.specialCooldownMs,
        storedPower: actor.storedPower,
        actionState: actor.actionState,
        actionMs: actor.actionMs,
        lastDir: { ...actor.lastDir },
        humanSlot: actor.id.startsWith('online-') ? actor.id.slice('online-'.length) : 'bot'
      })),
      bombs: this.bombs.bombs.map((bomb) => ({
        id: bomb.id,
        ownerId: bomb.ownerId,
        grid: { ...bomb.grid },
        remainingMs: bomb.remainingMs,
        radius: bomb.radius,
        themeId: bomb.themeId,
        previewTiles: bomb.previewTiles.map((tile) => ({ ...tile })),
        remote: bomb.remote,
        frost: bomb.frost,
        dragonCore: bomb.dragonCore
      })),
      destructibles: [...this.grid.tiles.entries()]
        .filter(([, tile]) => tile === 'destructible')
        .map(([key]) => key),
      powers: this.powers.powerUps.map((power) => ({
        id: power.id,
        type: power.type,
        grid: { ...power.grid }
      })),
      shards: [...this.powerSprites.keys()].filter((key) => key.startsWith('shard-')),
      frostZones: [...this.frostZones].map(([key, remainingMs]) => ({
        key,
        remainingMs,
        ownerId: this.frostZoneOwners.get(key) ?? ''
      })),
      elapsedMs: this.mode.elapsedMs,
      shrineTimerMs: this.shrineTimerMs
    };
    this.network.send({ kind: 'snapshot', snapshot });
  }

  private applyNetworkSnapshot(snapshot: NetworkMatchSnapshot): void {
    if (snapshot.sequence <= this.lastReceivedSnapshotSequence) return;
    this.lastReceivedSnapshotSequence = snapshot.sequence;
    for (const incoming of snapshot.actors) {
      const actor = this.actors.find((candidate) => candidate.id === incoming.id);
      if (!actor) continue;
      actor.grid = { ...incoming.grid };
      actor.world = { ...incoming.world };
      Object.assign(actor.stats, incoming.stats);
      actor.alive = incoming.alive;
      actor.kills = incoming.kills;
      actor.shards = incoming.shards;
      actor.slowedMs = incoming.slowedMs;
      actor.snaredMs = incoming.snaredMs;
      actor.frostTrailMs = incoming.frostTrailMs;
      actor.frostTrailZoneMs = incoming.frostTrailZoneMs;
      actor.specialCooldownMs = incoming.specialCooldownMs;
      actor.storedPower = incoming.storedPower;
      actor.actionState = incoming.actionState;
      actor.actionMs = incoming.actionMs;
      actor.lastDir = { ...incoming.lastDir };
    }

    const destructibles = new Set(snapshot.destructibles);
    for (const [key, tile] of [...this.grid.tiles]) {
      if (tile !== 'destructible' || destructibles.has(key)) continue;
      this.grid.tiles.set(key, 'empty');
      this.blockSprites.get(key)?.destroy(true);
      this.blockSprites.delete(key);
    }

    this.bombs.bombs.length = 0;
    for (const incoming of snapshot.bombs) {
      const bomb = new Bomb(
        incoming.id,
        incoming.ownerId,
        { ...incoming.grid },
        incoming.remainingMs,
        incoming.radius,
        incoming.themeId
      );
      bomb.remainingMs = incoming.remainingMs;
      bomb.previewTiles = incoming.previewTiles.map((tile) => ({ ...tile }));
      bomb.remote = incoming.remote;
      bomb.frost = incoming.frost;
      bomb.dragonCore = incoming.dragonCore;
      this.bombs.bombs.push(bomb);
    }

    this.powers.powerUps.length = 0;
    for (const incoming of snapshot.powers) {
      this.powers.powerUps.push(new PowerUp(incoming.id, incoming.type, { ...incoming.grid }));
    }
    const visiblePickups = new Set([...snapshot.powers.map((power) => power.id), ...snapshot.shards]);
    for (const [id, sprite] of [...this.powerSprites]) {
      if (!visiblePickups.has(id)) {
        sprite.destroy(true);
        this.powerSprites.delete(id);
      }
    }
    for (const shardId of snapshot.shards) {
      if (this.powerSprites.has(shardId)) continue;
      const coordinates = shardId.replace('shard-', '').split(',').map(Number);
      this.spawnShard({ x: coordinates[0], y: coordinates[1] });
    }

    this.frostZones.clear();
    this.frostZoneOwners.clear();
    for (const zone of snapshot.frostZones) {
      this.frostZones.set(zone.key, zone.remainingMs);
      this.frostZoneOwners.set(zone.key, zone.ownerId);
    }
    for (const [key, sprite] of [...this.frostSprites]) {
      if (!this.frostZones.has(key)) {
        sprite.destroy(true);
        this.frostSprites.delete(key);
      }
    }
    this.mode.elapsedMs = snapshot.elapsedMs;
    this.shrineTimerMs = snapshot.shrineTimerMs;
  }

  private updateNetworkResult(): void {
    if (this.mode.elapsedMs < 1600 || this.ended) return;
    if (SESSION.mode === 'shards') {
      const winner = this.actors.find((actor) => actor.shards >= 10);
      if (winner) {
        this.endNetworkMatch(winner.id, `${winner.name} claimed ten Crown Shards.`);
        return;
      }
      if (this.mode.elapsedMs >= 180000) {
        const ranked = [...this.actors].sort((a, b) => b.shards - a.shards);
        this.endNetworkMatch(ranked[0]?.id, 'The Crown Shard clock expired.');
        return;
      }
    }
    const living = this.actors.filter((actor) => actor.alive);
    if (living.length <= 1) {
      this.endNetworkMatch(living[0]?.id, living[0] ? `${living[0].name} claimed the Rumble.` : 'No champion survived the rune war.');
    }
  }

  private endNetworkMatch(winnerId: string | undefined, reason: string): void {
    this.network.send({ kind: 'matchEnd', winnerId, reason });
    this.reportOnlineMatch(winnerId, reason);
    this.finish(winnerId === this.player.id, reason);
  }

  private reportOnlineMatch(winnerId: string | undefined, reason: string): void {
    const config = this.network.matchConfig;
    if (this.network.role !== 'host' || !config?.matchId) return;
    const ranked = [...this.actors].sort((a, b) => {
      if (a.alive !== b.alive) return a.alive ? -1 : 1;
      return (b.defeatedAtMs ?? Number.MAX_SAFE_INTEGER) - (a.defeatedAtMs ?? Number.MAX_SAFE_INTEGER);
    });
    this.network.reportMatch({
      id: config.matchId,
      roomCode: config.roomCode ?? this.network.room,
      map: SESSION.map,
      mode: SESSION.mode,
      reason,
      winnerProfileId: winnerId?.startsWith('online-') ? winnerId.slice('online-'.length) : undefined,
      startedAt: new Date(Date.now() - this.mode.elapsedMs).toISOString(),
      endedAt: new Date().toISOString(),
      participants: ranked.map((actor, index) => ({
        profileId: actor.id.startsWith('online-') ? actor.id.slice('online-'.length) : undefined,
        seat: this.actorSeat(actor.id),
        displayName: actor.name,
        character: actor.character,
        placement: index + 1,
        kills: actor.kills,
        deaths: actor.deaths,
        bombsPlaced: actor.bombsPlaced,
        runesCollected: actor.runesCollected,
        shards: actor.shards,
        survivalMs: actor.defeatedAtMs ?? this.mode.elapsedMs,
        won: actor.id === winnerId
      }))
    });
  }

  private actorSeat(actorId: string): number {
    const profileId = actorId.startsWith('online-') ? actorId.slice('online-'.length) : undefined;
    const configured = this.network.matchConfig?.players?.find((seat) =>
      profileId ? seat.profileId === profileId : `bot-${seat.seat}` === actorId
    );
    return configured?.seat ?? 0;
  }

  private setGuestNetworkPaused(paused: boolean): void {
    if (paused === this.paused) return;
    if (!paused) {
      this.pausedText?.destroy(true);
      this.pausedText = undefined;
      this.paused = false;
      return;
    }
    const shade = this.add.rectangle(640, 360, 1280, 720, 0x05060a, 0.68).setInteractive();
    const panel = this.add.rectangle(640, 360, 480, 190, 0x111018, 0.98).setStrokeStyle(2, 0x9dc8ff);
    const title = this.add.text(640, 330, 'LAN Trial Paused', {
      fontFamily: 'Georgia',
      fontSize: '34px',
      color: '#f7d783'
    }).setOrigin(0.5);
    const hint = this.add.text(640, 390, 'Either champion can press pause to resume.', {
      fontFamily: 'Arial',
      fontSize: '14px',
      color: '#b5a995'
    }).setOrigin(0.5);
    this.pausedText = this.add.container(0, 0, [shade, panel, title, hint]).setDepth(240);
    this.paused = true;
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
    if (this.network.active && this.network.matchConfig?.players?.length) {
      const ordered = [...this.network.matchConfig.players].sort((a, b) => a.seat - b.seat);
      this.actors = ordered.map((seat) => {
        const definition = CHARACTERS.find((character) => character.id === seat.character) ?? CHARACTERS[0];
        const spawn = this.spawnForSeat(seat.seat);
        const id = seat.bot ? `bot-${seat.seat}` : `online-${seat.profileId}`;
        if (seat.bot) {
          const bot = new Bot(
            id,
            seat.displayName,
            definition.id,
            { ...spawn },
            this.grid.toWorld(spawn),
            makeStats(definition.id),
            false,
            definition.palette,
            definition.accent
          );
          applyBotProfile(bot.stats, this.ai.difficulty);
          return bot;
        }
        return new Player(
          id,
          seat.displayName,
          definition.id,
          { ...spawn },
          this.grid.toWorld(spawn),
          makeStats(definition.id),
          seat.profileId === this.network.clientId,
          definition.palette,
          definition.accent
        );
      });
      this.player = this.actors.find((actor) => actor.id === `online-${this.network.clientId}`)
        ?? this.actors[0];
      for (const actor of this.actors) this.makeActorView(actor);
      return;
    }
    const hostCharacter = this.network.active
      ? this.network.matchConfig?.hostCharacter ?? SESSION.character
      : SESSION.character;
    const mainChar = CHARACTERS.find((c) => c.id === hostCharacter) ?? CHARACTERS[0];
    const spawn = this.spawnForSeat(0);
    const hostPlayer = new Player(
      'player',
      mainChar.name,
      mainChar.id,
      { ...spawn },
      this.grid.toWorld(spawn),
      makeStats(mainChar.id),
      !this.network.active || this.network.role === 'host',
      mainChar.palette,
      mainChar.accent
    );
    this.player = hostPlayer;
    this.actors = [hostPlayer];
    if (SESSION.mode === 'sandbox') {
      const targetDef = CHARACTERS.find((character) => character.id === 'stone') ?? CHARACTERS[0];
      const targetSpawn = this.spawnForSeat(2);
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
    if (this.network.active) {
      const guestCharacter = this.network.matchConfig?.guestCharacter
        ?? (this.network.role === 'host' ? this.network.remoteCharacter : SESSION.character);
      const guestDef = CHARACTERS.find((character) => character.id === guestCharacter) ?? CHARACTERS[1];
      const guestSpawn = this.spawnForSeat(1);
      const guest = new Player(
        'network-guest',
        guestDef.name,
        guestDef.id,
        { ...guestSpawn },
        this.grid.toWorld(guestSpawn),
        makeStats(guestDef.id),
        this.network.role === 'player',
        guestDef.palette,
        guestDef.accent
      );
      this.actors.push(guest);
      if (this.network.role === 'player') this.player = guest;
      const botDefs = buildBotRoster(mainChar.id, this.grid.map.id, 2);
      for (let i = 2; i < 4; i += 1) {
        const botDef = CHARACTERS.find((character) => character.id === botDefs[i - 2]) ?? CHARACTERS[0];
        const botSpawn = this.spawnForSeat(i);
        const bot = new Bot(
          `bot-${i}`,
          botDef.name,
          botDef.id,
          { ...botSpawn },
          this.grid.toWorld(botSpawn),
          makeStats(botDef.id),
          false,
          botDef.palette,
          botDef.accent
        );
        applyBotProfile(bot.stats, this.ai.difficulty);
        this.actors.push(bot);
      }
      for (const actor of this.actors) this.makeActorView(actor);
      return;
    }
    let botStartIndex = 1;
    if (SESSION.localPlayers === 2) {
      const ch = CHARACTERS.find((c) => c.id === 'wolf')!;
      const p = this.spawnForSeat(1);
      const p2 = new Player('player-2', 'Player 2', ch.id, { ...p }, this.grid.toWorld(p), makeStats(ch.id), true, ch.palette, ch.accent);
      this.actors.push(p2);
      botStartIndex = 2;
    }
    const botChars = buildBotRoster(mainChar.id, this.grid.map.id, 4 - botStartIndex);
    for (let i = botStartIndex; i < 4; i += 1) {
      const ch = CHARACTERS.find((c) => c.id === botChars[i - botStartIndex])!;
      const p = this.spawnForSeat(i);
      const bot = new Bot(`bot-${i}`, ch.name, ch.id, { ...p }, this.grid.toWorld(p), makeStats(ch.id), false, ch.palette, ch.accent);
      applyBotProfile(bot.stats, this.ai.difficulty);
      this.actors.push(bot);
    }
    for (const actor of this.actors) this.makeActorView(actor);
  }

  private spawnForSeat(seat: number): GridPosition {
    const spawn = this.actorSpawns[seat] ?? this.actorSpawns[0] ?? this.grid.map.spawns[0];
    return { ...spawn };
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
    this.touch?.setRemoteAvailable(SESSION.mode === 'arcade' ? 0 : this.player.stats.remoteArmedBombs);
    this.touch?.setStoredPowerAvailable(SESSION.mode === 'arcade' ? false : !!this.player.storedPower);
    const touchDirection = this.touch?.direction() ?? 'none';
    this.moveActor(this.player, touchDirection !== 'none' ? touchDirection : this.human.direction(), dt);
    if (this.human.consumeBomb() || this.touch?.consumeBomb()) {
      if (SESSION.mode === 'arcade') this.arcadeStrike(this.player);
      else this.placeBomb(this.player);
    }
    if (this.human.consumeRemote() || this.touch?.consumeRemote()) {
      if (SESSION.mode === 'arcade') this.arcadeSecondary(this.player);
      else this.triggerRemote(this.player);
    }
    if (this.human.consumeSpecial() || this.touch?.consumeSpecial()) {
      if (SESSION.mode === 'arcade') this.arcadeSignature(this.player);
      else this.usePowerOrSpecial(this.player);
    }
  }

  private updateHuman2(dt: number): void {
    if (!this.human2) return;
    const player2 = this.actors.find((actor) => actor.id === 'player-2');
    if (!player2) return;
    this.moveActor(player2, this.human2.direction(), dt);
    if (this.human2.consumeBomb()) {
      if (SESSION.mode === 'arcade') this.arcadeStrike(player2);
      else this.placeBomb(player2);
    }
    if (this.human2.consumeRemote()) {
      if (SESSION.mode === 'arcade') this.arcadeSecondary(player2);
      else this.triggerRemote(player2);
    }
    if (this.human2.consumeSpecial()) {
      if (SESSION.mode === 'arcade') this.arcadeSignature(player2);
      else this.usePowerOrSpecial(player2);
    }
  }

  private updateBots(dt: number): void {
    if (SESSION.mode === 'sandbox') return;
    if (SESSION.mode === 'arcade') {
      this.updateArcadeBots(dt);
      return;
    }
    for (const bot of this.actors.filter((a): a is Bot => a instanceof Bot && a.alive)) {
      if (this.spawnGraceMs > 0) continue;
      if (!bot.lastMovementTile) bot.lastMovementTile = { ...bot.grid };
      const changedTile = !sameTile(bot.lastMovementTile, bot.grid);
      if (changedTile) {
        bot.lastMovementTile = { ...bot.grid };
        bot.stuckMs = 0;
      } else if (
        bot.currentIntent.dir === 'none'
        && this.bombs.bombs.some((bomb) => bomb.ownerId === bot.id)
      ) {
        bot.stuckMs = 0;
      } else {
        bot.stuckMs += dt;
      }
      bot.thinkMs -= dt;
      const hasOwnBomb = this.bombs.bombs.some((bomb) => bomb.ownerId === bot.id);
      const reachedTarget = !hasOwnBomb
        && !!bot.currentIntent.target
        && sameTile(bot.grid, bot.currentIntent.target);
      if (changedTile && bot.currentIntent.target && !reachedTarget) {
        bot.currentIntent = this.ai.continueIntent(bot, bot.currentIntent, this.grid, this.bombs, this.danger);
      }
      const dangerReplan = this.danger.isDanger(bot.grid, 1250) && bot.state !== 'FLEE_DANGER';
      const escapeTargetUnsafe = !!bot.currentIntent.target
        && bot.state === 'FLEE_DANGER'
        && this.danger.isDanger(bot.currentIntent.target, GAME_CONFIG.bombFuseMs);
      const forceReplan = bot.stuckMs >= 1000 || reachedTarget || dangerReplan || escapeTargetUnsafe;
      const periodicReplan = bot.thinkMs <= 0
        && (!bot.currentIntent.target || bot.state === 'CHASE_PLAYER' || bot.state === 'IDLE');
      if (periodicReplan || forceReplan) {
        bot.currentIntent = this.ai.think(
          bot,
          [
            ...this.actors.filter((actor) => actor !== bot && actor.alive),
            ...[...this.mirrorDecoys.values()]
              .filter((decoy) => decoy.ownerId !== bot.id)
              .map((decoy) => decoy.target)
          ],
          this.grid,
          this.bombs,
          this.danger,
          this.powers
        );
        bot.intentTarget = bot.currentIntent.target ? { ...bot.currentIntent.target } : undefined;
        bot.lastDecisionTile = { ...bot.grid };
        bot.thinkMs = this.ai.reactionDelay();
        if (forceReplan) bot.stuckMs = 0;
      }
      const intent = bot.currentIntent;
      if (intent.useSpecial) {
        if (intent.dir === 'up') bot.lastDir = { x: 0, y: -1 };
        else if (intent.dir === 'down') bot.lastDir = { x: 0, y: 1 };
        else if (intent.dir === 'left') bot.lastDir = { x: -1, y: 0 };
        else if (intent.dir === 'right') bot.lastDir = { x: 1, y: 0 };
        this.usePowerOrSpecial(bot);
        intent.useSpecial = false;
      }
      if (intent.placeBomb) {
        this.placeBomb(bot);
        intent.placeBomb = false;
        bot.thinkMs = 0;
      }
      const before = { ...bot.world };
      this.moveActor(bot, intent.dir, dt);
      const moved = Math.abs(before.x - bot.world.x) + Math.abs(before.y - bot.world.y) > 0.05;
      if (!moved && intent.dir !== 'none' && bot.stuckMs > 220) {
        bot.currentIntent.dir = 'none';
        bot.thinkMs = 0;
      }
    }
  }

  private updateArcadeBots(dt: number): void {
    for (const bot of this.actors.filter((actor): actor is Bot => actor instanceof Bot && actor.alive)) {
      if (this.spawnGraceMs > 0) continue;
      bot.thinkMs -= dt;
      const opponents = this.actors.filter((actor) => actor !== bot && actor.alive);
      const target = opponents.sort((a, b) => distance(bot.grid, a.grid) - distance(bot.grid, b.grid))[0];
      const reachedTarget = !!bot.currentIntent.target && sameTile(bot.grid, bot.currentIntent.target);
      if (bot.thinkMs <= 0 || reachedTarget || bot.currentIntent.dir === 'none') {
        bot.currentIntent = this.ai.think(bot, opponents, this.grid, this.bombs, this.danger, this.powers);
        bot.thinkMs = this.ai.reactionDelay();
      } else if (bot.currentIntent.target) {
        bot.currentIntent = this.ai.continueIntent(bot, bot.currentIntent, this.grid, this.bombs, this.danger);
      }

      const weapon = getArcadeWeapon(bot.character);
      const aligned = target && (target.grid.x === bot.grid.x || target.grid.y === bot.grid.y);
      const targetDistance = target ? distance(bot.grid, target.grid) : Infinity;
      if (target && targetDistance <= 1) {
        this.faceActorToward(bot, target.grid);
        this.arcadeStrike(bot);
      } else if (
        target
        && aligned
        && targetDistance <= Math.max(1, weapon.secondaryRange)
        && (this.arcadeSecondaryMs.get(bot.id) ?? 0) <= 0
        && Math.random() < 0.035
      ) {
        this.faceActorToward(bot, target.grid);
        this.arcadeSecondary(bot);
      } else if (bot.currentIntent.placeBomb) {
        this.arcadeStrike(bot);
        bot.currentIntent.placeBomb = false;
      }
      if (bot.currentIntent.useSpecial || (target && targetDistance <= Math.max(3, weapon.signatureRange) && Math.random() < 0.008)) {
        this.faceActorToward(bot, target.grid);
        this.arcadeSignature(bot);
        bot.currentIntent.useSpecial = false;
      }
      this.moveActor(bot, bot.currentIntent.dir, dt);
    }
  }

  private tickArcade(dt: number): void {
    for (const actor of this.actors) {
      const attack = Math.max(0, (this.arcadeAttackMs.get(actor.id) ?? 0) - dt);
      const secondary = Math.max(0, (this.arcadeSecondaryMs.get(actor.id) ?? 0) - dt);
      const active = Math.max(0, (this.arcadePowerMs.get(actor.id) ?? 0) - dt);
      this.arcadeAttackMs.set(actor.id, attack);
      this.arcadeSecondaryMs.set(actor.id, secondary);
      this.arcadePowerMs.set(actor.id, active);
      actor.arcadeSecondaryCooldownMs = secondary;
      actor.arcadePowerMs = active;
    }
  }

  private arcadeStrike(actor: Player): void {
    if (!actor.alive || actor.actionMs > 0 || (this.arcadeAttackMs.get(actor.id) ?? 0) > 0) return;
    const weapon = getArcadeWeapon(actor.character);
    this.arcadeAttackMs.set(actor.id, weapon.attackCooldownMs);
    const { tiles, blocked } = this.arcadeLine(actor, 1);
    this.beginArcadeAction(actor, weapon, 'primary', () => {
      this.renderArcadeTiles(actor, tiles, 'impact', 220, blocked);
      this.resolveArcadeHits(actor, tiles, weapon.attackName, weapon.highlight);
      if (actor.character === 'skin' && tiles.length) {
        this.time.delayedCall(150, () => {
          if (!actor.alive || this.ended) return;
          this.renderArcadeTiles(actor, tiles, 'impact', 160);
          this.resolveArcadeHits(actor, tiles, 'Split Cut II', weapon.highlight);
        });
      }
    });
  }

  private arcadeSecondary(actor: Player): void {
    if (!actor.alive || actor.actionMs > 0) return;
    const weapon = getArcadeWeapon(actor.character);
    if (actor.character === 'veil' && this.arcadeWispMarks.has(actor.id)) {
      this.releaseWispSeal(actor);
      return;
    }
    if ((this.arcadeSecondaryMs.get(actor.id) ?? 0) > 0) return;
    this.arcadeSecondaryMs.set(actor.id, weapon.secondaryCooldownMs);

    if (actor.character === 'dragon') {
      const line = this.arcadeLine(actor, weapon.secondaryRange);
      this.renderArcadeTiles(actor, line.tiles, 'telegraph', weapon.secondaryWindupMs, line.blocked);
      this.beginArcadeAction(actor, weapon, 'secondary', () => {
        this.renderArcadeTiles(actor, line.tiles, 'impact', 280, line.blocked);
        this.resolveArcadeHits(actor, line.tiles, weapon.secondaryName, weapon.highlight);
      });
    } else if (actor.character === 'wolf') {
      const landing = this.findArcadeSidestep(actor);
      this.beginArcadeAction(actor, weapon, 'secondary', () => {
        if (landing) this.moveActorInstant(actor, landing);
        const line = this.arcadeLine(actor, 1);
        this.renderArcadeTiles(actor, line.tiles, 'impact', 220);
        this.resolveArcadeHits(actor, line.tiles, weapon.secondaryName, weapon.highlight);
      });
    } else if (actor.character === 'frost') {
      const line = this.arcadeLine(actor, weapon.secondaryRange);
      this.renderArcadeTiles(actor, line.tiles, 'telegraph', weapon.secondaryWindupMs, line.blocked);
      this.beginArcadeAction(actor, weapon, 'secondary', () => {
        for (const tile of line.tiles) this.addFrostZone(tile, 2600, actor.id);
        const target = this.firstRivalOnTiles(actor, line.tiles);
        if (target) {
          this.damageActor(target, actor.id);
          this.shoveArcadeActor(target, this.facing(actor));
        }
        this.renderArcadeTiles(actor, line.tiles, 'impact', 260);
      });
    } else if (actor.character === 'veil') {
      const line = this.arcadeLine(actor, 1);
      this.beginArcadeAction(actor, weapon, 'secondary', () => this.placeWispSeal(actor, line.tiles[0]));
    } else if (actor.character === 'skin') {
      const landing = this.findArcadeSidestep(actor);
      this.beginArcadeAction(actor, weapon, 'secondary', () => {
        this.spawnDecoy(actor);
        if (landing) this.moveActorInstant(actor, landing);
      });
    } else if (actor.character === 'stone') {
      const line = this.arcadeLine(actor, 1);
      this.beginArcadeAction(actor, weapon, 'secondary', () => {
        actor.stats.shielded = true;
        actor.stats.shieldMs = 1800;
        const target = this.firstRivalOnTiles(actor, line.tiles);
        if (target) {
          this.damageActor(target, actor.id);
          this.shoveArcadeActor(target, this.facing(actor));
        }
        this.renderArcadeTiles(actor, line.tiles, 'impact', 260);
      });
    } else if (actor.character === 'raven') {
      const line = this.arcadeLine(actor, 1);
      this.beginArcadeAction(actor, weapon, 'secondary', () => this.releaseDelayedTileHit(actor, line.tiles[0], weapon, 680));
    } else {
      const line = this.arcadeLine(actor, weapon.secondaryRange, true);
      const targetTile = line.tiles[line.tiles.length - 1];
      this.beginArcadeAction(actor, weapon, 'secondary', () => this.releaseDelayedTileHit(actor, targetTile, weapon, 620));
    }
  }

  private arcadeSignature(actor: Player): void {
    if (!actor.alive || actor.actionMs > 0 || actor.specialCooldownMs > 0) return;
    const weapon = getArcadeWeapon(actor.character);
    actor.specialCooldownMs = weapon.signatureCooldownMs;
    this.arcadePowerMs.set(actor.id, weapon.activeMs);
    actor.arcadePowerMs = weapon.activeMs;

    if (actor.character === 'dragon') {
      const line = this.arcadeLine(actor, weapon.signatureRange);
      this.renderArcadeTiles(actor, line.tiles, 'telegraph', weapon.signatureWindupMs, line.blocked);
      this.beginArcadeAction(actor, weapon, 'signature', () => {
        this.dragonBlastFx.fire(actor.grid, line.tiles, this.facing(actor));
        this.resolveArcadeHits(actor, line.tiles, weapon.signatureName, weapon.highlight, true);
        this.cameras.main.shake(100, 0.003);
        AudioSystem.get().sfx('dragonBlast');
      });
    } else if (actor.character === 'wolf') {
      const line = this.arcadeLine(actor, weapon.signatureRange, true);
      this.renderArcadeTiles(actor, line.tiles, 'telegraph', weapon.signatureWindupMs, line.blocked);
      this.beginArcadeAction(actor, weapon, 'signature', () => {
        const landing = [...line.tiles].reverse().find((tile) => this.isFreeArcadeTile(tile, actor));
        if (landing) this.moveActorInstant(actor, landing);
        actor.stats.temporarySpeedBoost = weapon.activeMs;
        this.renderArcadeTiles(actor, landing ? [landing] : [], 'impact', 280);
      });
    } else if (actor.character === 'frost') {
      this.beginArcadeAction(actor, weapon, 'signature', () => {
        actor.frostTrailMs = weapon.activeMs;
        actor.frostTrailZoneMs = 4700;
        this.addFrostZone(actor.grid, actor.frostTrailZoneMs, actor.id);
        this.frostActivation(actor, true);
      });
    } else if (actor.character === 'veil') {
      this.beginArcadeAction(actor, weapon, 'signature', () => {
        actor.stats.temporaryGhostMode = weapon.activeMs;
        this.specialPulse(actor, weapon.color);
      });
    } else if (actor.character === 'skin') {
      const landing = this.findArcadeSidestep(actor);
      this.beginArcadeAction(actor, weapon, 'signature', () => {
        this.spawnDecoy(actor);
        actor.invulnerableMs = weapon.activeMs;
        if (landing) this.moveActorInstant(actor, landing);
      });
    } else if (actor.character === 'stone') {
      this.beginArcadeAction(actor, weapon, 'signature', () => {
        actor.stats.shielded = true;
        actor.stats.shieldMs = weapon.activeMs;
        this.specialPulse(actor, weapon.color);
      });
    } else if (actor.character === 'raven') {
      const line = this.arcadeLine(actor, weapon.signatureRange, true);
      this.renderArcadeTiles(actor, line.tiles, 'telegraph', weapon.signatureWindupMs, line.blocked);
      this.beginArcadeAction(actor, weapon, 'signature', () => {
        const landing = [...line.tiles].reverse().find((tile) => this.isFreeArcadeTile(tile, actor));
        if (landing) this.blinkActorTo(actor, landing, weapon.color);
      });
    } else {
      const target = this.actors
        .filter((candidate) => candidate !== actor
          && candidate.alive
          && distance(actor.grid, candidate.grid) <= weapon.signatureRange
          && this.isArcadeReachable(actor.grid, candidate.grid, weapon.signatureRange))
        .sort((a, b) => distance(actor.grid, a.grid) - distance(actor.grid, b.grid))[0];
      const fallbackTiles = this.arcadeLine(actor, weapon.signatureRange, true).tiles;
      const tile = target ? { ...target.grid } : fallbackTiles[fallbackTiles.length - 1];
      if (tile) this.renderArcadeTiles(actor, [tile], 'telegraph', weapon.signatureWindupMs);
      this.beginArcadeAction(actor, weapon, 'signature', () => {
        this.renderArcadeTiles(actor, tile ? [tile] : [], 'impact', 300);
        if (target?.alive && tile && sameTile(target.grid, tile)) this.damageActor(target, actor.id);
      });
    }

    this.floatText(actor.world.x, actor.world.y - 58, weapon.signatureName, `#${weapon.highlight.toString(16).padStart(6, '0')}`);
  }

  private beginArcadeAction(
    actor: Player,
    weapon: ArcadeWeaponDef,
    kind: 'primary' | 'secondary' | 'signature',
    release: () => void
  ): void {
    const windup = kind === 'primary' ? weapon.primaryWindupMs : kind === 'secondary' ? weapon.secondaryWindupMs : weapon.signatureWindupMs;
    const recovery = kind === 'primary' ? weapon.primaryRecoveryMs : kind === 'secondary' ? weapon.secondaryRecoveryMs : weapon.signatureRecoveryMs;
    actor.actionState = 'windup';
    actor.actionMs = windup + recovery;
    const aim = this.arcadeLine(actor, 1);
    this.renderArcadeTiles(actor, aim.tiles, 'telegraph', windup, aim.blocked);
    const view = this.views.get(actor.id);
    if (view) this.animation.playArcadeAction(
      actor,
      view,
      this.arcadeFacingDirection(actor),
      weapon.color,
      windup,
      recovery
    );
    this.time.delayedCall(windup, () => {
      if (!actor.alive || this.ended) return;
      actor.actionState = 'release';
      release();
      this.time.delayedCall(90, () => {
        if (actor.actionMs > 0) actor.actionState = 'recovery';
      });
    });
  }

  private arcadeLine(actor: Player, range: number, movementOnly = false): { tiles: GridPosition[]; blocked?: GridPosition } {
    const direction = this.facing(actor);
    const tiles: GridPosition[] = [];
    let blocked: GridPosition | undefined;
    for (let step = 1; step <= range; step += 1) {
      const tile = { x: actor.grid.x + direction.x * step, y: actor.grid.y + direction.y * step };
      if (!this.grid.inBounds(tile) || this.grid.get(tile) === 'solid') {
        blocked = tile;
        break;
      }
      if (movementOnly && !this.grid.isWalkable(tile)) {
        blocked = tile;
        break;
      }
      tiles.push(tile);
      if (this.grid.get(tile) === 'destructible') break;
    }
    return { tiles, blocked };
  }

  private resolveArcadeHits(actor: Player, tiles: GridPosition[], label: string, color: number, piercing = false): void {
    AudioSystem.get().sfx(actor.character === 'frost' ? 'frost' : actor.character === 'raven' ? 'blink' : 'beast');
    for (const tile of tiles) {
      if (this.grid.get(tile) === 'destructible') {
        this.hitArcadeBlock(tile, actor.id);
        if (!piercing) return;
      }
      const rival = this.actors.find((candidate) => candidate !== actor && candidate.alive && sameTile(candidate.grid, tile));
      if (!rival) continue;
      this.damageActor(rival, actor.id);
      this.floatText(rival.world.x, rival.world.y - 48, label, `#${color.toString(16).padStart(6, '0')}`);
      if (!piercing) return;
    }
  }

  private renderArcadeTiles(
    actor: Player,
    tiles: GridPosition[],
    phase: 'telegraph' | 'impact',
    duration: number,
    blocked?: GridPosition
  ): void {
    const weapon = getArcadeWeapon(actor.character);
    const fx = this.add.container(0, 0).setDepth(34);
    const direction = this.facing(actor);
    const angle = direction.x > 0 ? 0 : direction.x < 0 ? Math.PI : direction.y > 0 ? Math.PI / 2 : -Math.PI / 2;
    for (const tile of tiles) {
      const world = this.grid.toWorld(tile);
      if (phase === 'telegraph') {
        const ring = this.add.circle(world.x, world.y, this.grid.tileSize * 0.28, weapon.color, 0.045)
          .setStrokeStyle(2, weapon.highlight, actor.isHuman ? 0.86 : 0.62);
        const lane = this.add.rectangle(
          world.x - direction.x * this.grid.tileSize * 0.08,
          world.y - direction.y * this.grid.tileSize * 0.08,
          this.grid.tileSize * 0.42,
          actor.isHuman ? 3 : 2,
          weapon.highlight,
          actor.isHuman ? 0.72 : 0.52
        ).setRotation(angle);
        const arrow = this.add.triangle(
          world.x + direction.x * this.grid.tileSize * 0.18,
          world.y + direction.y * this.grid.tileSize * 0.18,
          -5,
          -5,
          6,
          0,
          -5,
          5,
          weapon.highlight,
          actor.isHuman ? 0.9 : 0.68
        ).setRotation(angle);
        fx.add([ring, lane, arrow]);
      } else {
        fx.add(this.createArcadeWeaponImpact(actor, world.x, world.y, angle));
      }
    }
    if (blocked && this.grid.inBounds(blocked)) {
      const world = this.grid.toWorld(blocked);
      const stop = this.add.circle(world.x, world.y, 9, 0x130e12, 0.5).setStrokeStyle(2, weapon.highlight, 0.78);
      const slashA = this.add.rectangle(world.x, world.y, 14, 2, weapon.highlight, 0.82).setRotation(Math.PI / 4);
      const slashB = this.add.rectangle(world.x, world.y, 14, 2, weapon.highlight, 0.82).setRotation(-Math.PI / 4);
      fx.add([stop, slashA, slashB]);
    }
    this.effectLayer.add(fx);
    if (phase === 'telegraph') {
      this.tweens.add({ targets: fx, alpha: actor.isHuman ? 0.48 : 0.38, duration: Math.max(70, duration / 3), yoyo: true, repeat: 1 });
      this.time.delayedCall(duration, () => fx.destroy(true));
    } else {
      this.tweens.add({ targets: fx, alpha: 0, scale: 1.06, duration, ease: 'Cubic.easeOut', onComplete: () => fx.destroy(true) });
    }
  }

  private createArcadeWeaponImpact(
    actor: Player,
    x: number,
    y: number,
    angle: number
  ): Phaser.GameObjects.GameObject[] {
    const weapon = getArcadeWeapon(actor.character);
    const size = this.grid.tileSize;
    const direction = this.facing(actor);
    const tipX = x + direction.x * size * 0.2;
    const tipY = y + direction.y * size * 0.2;
    const objects: Phaser.GameObjects.GameObject[] = [];
    const stroke = (length: number, thickness: number, rotation = angle, alpha = 0.92) => this.add.rectangle(
      x,
      y,
      length,
      thickness,
      weapon.highlight,
      alpha
    ).setRotation(rotation);

    if (weapon.style === 'blade') {
      objects.push(stroke(size * 0.72, 5, angle + 0.48));
      objects.push(stroke(size * 0.34, 2, angle - 0.38, 0.72));
      objects.push(this.add.circle(tipX, tipY, 5, weapon.color, 0.92));
    } else if (weapon.style === 'bow') {
      objects.push(stroke(size * 0.66, 3));
      objects.push(this.add.triangle(tipX, tipY, -6, -5, 7, 0, -6, 5, weapon.highlight, 0.96).setRotation(angle));
      objects.push(this.add.arc(x, y, size * 0.24, 70, 290, false, weapon.color, 0.32).setRotation(angle));
    } else if (weapon.style === 'mace') {
      objects.push(stroke(size * 0.48, 4));
      objects.push(this.add.circle(tipX, tipY, 9, weapon.color, 0.76).setStrokeStyle(3, weapon.highlight, 0.92));
      objects.push(this.add.circle(tipX, tipY, 14, weapon.color, 0.06).setStrokeStyle(2, weapon.highlight, 0.58));
    } else if (weapon.style === 'lantern') {
      objects.push(stroke(size * 0.38, 2));
      objects.push(this.add.circle(tipX, tipY, 9, weapon.color, 0.54).setStrokeStyle(2, weapon.highlight, 0.92));
      objects.push(this.add.circle(tipX - direction.y * 8, tipY + direction.x * 8, 4, weapon.highlight, 0.7));
      objects.push(this.add.circle(tipX + direction.y * 8, tipY - direction.x * 8, 3, weapon.color, 0.62));
    } else if (weapon.style === 'daggers') {
      objects.push(stroke(size * 0.52, 4, angle + 0.52));
      objects.push(stroke(size * 0.52, 4, angle - 0.52));
      objects.push(this.add.circle(x, y, 5, weapon.color, 0.72));
    } else if (weapon.style === 'hammer') {
      objects.push(stroke(size * 0.48, 4));
      objects.push(this.add.rectangle(tipX, tipY, 15, 10, weapon.highlight, 0.92).setRotation(angle));
      objects.push(this.add.circle(tipX, tipY, 14, weapon.color, 0.08).setStrokeStyle(2, weapon.color, 0.68));
    } else if (weapon.style === 'staff') {
      objects.push(stroke(size * 0.56, 3));
      objects.push(this.add.star(tipX, tipY, 6, 4, 9, weapon.highlight, 0.9));
      objects.push(this.add.circle(tipX, tipY, 13, weapon.color, 0.08).setStrokeStyle(2, weapon.color, 0.7));
    } else {
      objects.push(stroke(size * 0.76, 4));
      objects.push(this.add.triangle(tipX, tipY, -7, -6, 9, 0, -7, 6, weapon.highlight, 0.98).setRotation(angle));
      objects.push(stroke(size * 0.26, 2, angle + Math.PI / 2, 0.68));
    }
    return objects;
  }

  private firstRivalOnTiles(actor: Player, tiles: GridPosition[]): Player | undefined {
    return this.actors.find((candidate) => candidate !== actor && candidate.alive && tiles.some((tile) => sameTile(tile, candidate.grid)));
  }

  private facing(actor: Player): GridPosition {
    return actor.lastDir.x === 0 && actor.lastDir.y === 0 ? { x: 0, y: 1 } : { ...actor.lastDir };
  }

  private arcadeFacingDirection(actor: Player): Exclude<Direction, 'none'> {
    const direction = this.facing(actor);
    if (direction.x < 0) return 'left';
    if (direction.x > 0) return 'right';
    return direction.y < 0 ? 'up' : 'down';
  }

  private isFreeArcadeTile(tile: GridPosition, actor?: Player): boolean {
    return this.grid.isWalkable(tile)
      && !this.actors.some((candidate) => candidate !== actor && candidate.alive && sameTile(candidate.grid, tile));
  }

  private isArcadeReachable(start: GridPosition, target: GridPosition, maxSteps: number): boolean {
    const queue: Array<{ tile: GridPosition; steps: number }> = [{ tile: { ...start }, steps: 0 }];
    const visited = new Set<string>([keyOf(start)]);
    while (queue.length) {
      const current = queue.shift()!;
      if (sameTile(current.tile, target)) return true;
      if (current.steps >= maxSteps) continue;
      for (const dir of dirs) {
        const next = { x: current.tile.x + dir.x, y: current.tile.y + dir.y };
        const key = keyOf(next);
        if (visited.has(key) || (!sameTile(next, target) && !this.grid.isWalkable(next))) continue;
        if (this.grid.get(next) === 'solid' || this.grid.get(next) === 'destructible') continue;
        visited.add(key);
        queue.push({ tile: next, steps: current.steps + 1 });
      }
    }
    return false;
  }

  private moveActorInstant(actor: Player, tile: GridPosition): void {
    if (!this.isFreeArcadeTile(tile, actor)) return;
    actor.grid = { ...tile };
    actor.world = this.grid.toWorld(tile);
  }

  private findArcadeSidestep(actor: Player): GridPosition | undefined {
    const direction = this.facing(actor);
    const options = [
      { x: actor.grid.x - direction.y, y: actor.grid.y + direction.x },
      { x: actor.grid.x + direction.y, y: actor.grid.y - direction.x }
    ];
    return options.find((tile) => this.isFreeArcadeTile(tile, actor));
  }

  private shoveArcadeActor(target: Player, direction: GridPosition): void {
    const tile = { x: target.grid.x + direction.x, y: target.grid.y + direction.y };
    if (this.isFreeArcadeTile(tile, target)) this.moveActorInstant(target, tile);
  }

  private placeWispSeal(actor: Player, tile?: GridPosition): void {
    if (!tile || !this.grid.isWalkable(tile)) return;
    const world = this.grid.toWorld(tile);
    const visual = this.add.container(world.x, world.y).setDepth(34);
    visual.add(this.add.circle(0, 0, this.grid.tileSize * 0.34, 0xc18aff, 0.14).setStrokeStyle(3, 0xf1e3ff, 0.86));
    visual.add(this.add.star(0, 0, 6, 5, 12, 0xe7d5ff, 0.68));
    this.effectLayer.add(visual);
    const timer = this.time.delayedCall(2100, () => this.releaseWispSeal(actor));
    this.arcadeWispMarks.set(actor.id, { tile: { ...tile }, visual, timer });
    this.floatText(world.x, world.y - 28, 'Wisp Seal', '#e8d4ff');
  }

  private releaseWispSeal(actor: Player): void {
    const mark = this.arcadeWispMarks.get(actor.id);
    if (!mark) return;
    mark.timer.remove(false);
    mark.visual.destroy(true);
    this.arcadeWispMarks.delete(actor.id);
    this.renderArcadeTiles(actor, [mark.tile], 'impact', 280);
    this.resolveArcadeHits(actor, [mark.tile], 'Wisp Seal', 0xf1e3ff);
  }

  private releaseDelayedTileHit(actor: Player, tile: GridPosition | undefined, weapon: ArcadeWeaponDef, delayMs: number): void {
    if (!tile) return;
    this.renderArcadeTiles(actor, [tile], 'telegraph', delayMs);
    this.time.delayedCall(delayMs, () => {
      if (!actor.alive || this.ended) return;
      this.renderArcadeTiles(actor, [tile], 'impact', 260);
      this.resolveArcadeHits(actor, [tile], weapon.secondaryName, weapon.highlight);
    });
  }

  private blinkActorTo(actor: Player, landing: GridPosition, color: number): void {
    const from = { ...actor.world };
    this.moveActorInstant(actor, landing);
    const trail = this.add.line(0, 0, from.x, from.y, actor.world.x, actor.world.y, color, 0.62).setLineWidth(4).setDepth(35);
    this.effectLayer.add(trail);
    this.tweens.add({ targets: trail, alpha: 0, duration: 340, onComplete: () => trail.destroy() });
    this.specialPulse(actor, color);
  }

  private hitArcadeBlock(tile: GridPosition, ownerId: string): void {
    const key = keyOf(tile);
    const remaining = (this.arcadeBlockHealth.get(key) ?? 2) - 1;
    this.arcadeBlockHealth.set(key, remaining);
    const block = this.blockSprites.get(key);
    if (!block) return;
    if (remaining > 0) {
      this.tweens.add({ targets: block, x: block.x + 3, duration: 45, yoyo: true, repeat: 1 });
      return;
    }
    this.animateBlockBreak(block);
    this.blockSprites.delete(key);
    this.arcadeBlockHealth.delete(key);
    this.grid.set(tile, 'empty');
    this.emitDebris(tile);
    const owner = this.actors.find((actor) => actor.id === ownerId);
    if (owner?.isHuman) this.floatText(owner.world.x, owner.world.y - 44, 'Path opened', '#d8c9aa');
  }

  private faceActorToward(actor: Player, target: GridPosition): void {
    if (target.x > actor.grid.x) actor.lastDir = { x: 1, y: 0 };
    else if (target.x < actor.grid.x) actor.lastDir = { x: -1, y: 0 };
    else if (target.y > actor.grid.y) actor.lastDir = { x: 0, y: 1 };
    else if (target.y < actor.grid.y) actor.lastDir = { x: 0, y: -1 };
  }

  private moveActor(actor: Player, dir: Direction, dt: number): void {
    if (!actor.alive) return;
    this.applyFrostZoneToActor(actor);
    if (actor.snaredMs > 0 || dir === 'none') return;
    const d = dir === 'up' ? { x: 0, y: -1 } : dir === 'down' ? { x: 0, y: 1 } : dir === 'left' ? { x: -1, y: 0 } : { x: 1, y: 0 };
    actor.lastDir = d;
    const previousGrid = { ...actor.grid };
    const surgeBoost = actor.stats.championSurgeMs > 0 ? 18 : 0;
    const speedBoost = actor.stats.temporarySpeedBoost > 0 ? actor.stats.moveSpeed * 0.4 : 0;
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
    const halfTile = this.grid.tileSize / 2;
    actor.world.x = clamp(actor.world.x, bounds.x - halfTile, bounds.x + halfTile);
    actor.world.y = clamp(actor.world.y, bounds.y - halfTile, bounds.y + halfTile);
    if (!sameTile(previousGrid, actor.grid) && actor.frostTrailMs > 0) {
      const zoneMs = actor.frostTrailZoneMs || 3500;
      this.addFrostZone(previousGrid, zoneMs, actor.id);
      this.addFrostZone(actor.grid, zoneMs, actor.id);
    }
    this.animation.emitFootstep(actor);
  }

  private placeBomb(actor: Player): void {
    const bomb = this.bombs.place(actor);
    if (!bomb) return;
    actor.bombsPlaced += 1;
    AudioSystem.get().sfx('bomb');
    const theme = getBombTheme(bomb.themeId);
    const w = this.grid.toWorld(bomb.grid);
    this.bombViews.add(bomb);
    const view = this.views.get(actor.id);
    if (view) this.animation.playPlaceBomb(actor, view);
    this.specialPulse(actor, theme.blastColor);
    this.floatText(w.x, w.y - 35, actor.isHuman ? 'Rune set' : 'Hex!', actor.isHuman ? '#ffd36b' : '#ff9d8f');
  }

  private triggerRemote(actor: Player): void {
    const armed = this.bombs.bombs.find((bomb) => bomb.ownerId === actor.id && bomb.remote);
    if (!armed || actor.actionMs > 0) return;
    actor.actionState = 'windup';
    actor.actionMs = 260;
    const view = this.views.get(actor.id);
    if (view) this.animation.playSpecial(actor, view, 0xc050ff);
    this.bombViews.flashRemote(armed.id);
    this.specialPulse(actor, 0xc050ff);
    AudioSystem.get().sfx('tick');
    this.time.delayedCall(150, () => {
      if (!actor.alive || this.ended) return;
      actor.actionState = 'release';
      const explosions = this.bombs.detonateRemote(actor.id, this.actors);
      for (const explosion of explosions) this.resolveExplosion(explosion);
      AudioSystem.get().sfx('blink');
    });
  }

  private resolveExplosion(explosion: import('../entities/Explosion').Explosion): void {
    if (this.network.active && this.network.role === 'host') {
      this.network.send({
        kind: 'explosion',
        tiles: explosion.tiles.map((tile) => ({ ...tile })),
        themeId: explosion.themeId,
        frost: explosion.frost
      });
    }
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
    for (const [id, decoy] of [...this.mirrorDecoys]) {
      if (explosion.tiles.some((tile) => sameTile(tile, decoy.target.grid))) this.removeDecoy(id, true);
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
    if (actor.stats.temporaryGhostMode > 0) {
      this.floatText(actor.world.x, actor.world.y - 44, 'VEILED', '#eee8ff');
      this.specialPulse(actor, 0xded8ff);
      return;
    }
    if (actor.stats.championSurgeMs > 0) {
      this.floatText(actor.world.x, actor.world.y - 44, 'SURGE', '#fff0a0');
      this.specialPulse(actor, 0xfff0a0);
      return;
    }
    if (actor.invulnerableMs > 0) return;
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
      actor.deaths += 1;
      actor.defeatedAtMs = this.mode.elapsedMs;
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
      actor.runesCollected += 1;
      this.applyPowerUpFeedback(actor, pickup.type);
      if (actor.isHuman) {
        this.pulseHudForPower(pickup.type);
        this.floatPickup(actor.world.x, actor.world.y - 50, pickup.type, pickup.label);
      }
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
    this.updateRuneSight();
    this.updateStoredPowerAim();
  }

  private updateRuneSight(): void {
    const revealed = this.player.alive && this.player.character === 'raven'
      ? this.powers.hiddenDropsNear(this.player.grid, 5)
      : [];
    const live = new Set(revealed.map((drop) => keyOf(drop.grid)));
    for (const [key, marker] of [...this.runeSightSprites]) {
      if (!live.has(key)) {
        marker.destroy(true);
        this.runeSightSprites.delete(key);
      }
    }
    for (const drop of revealed) {
      const key = keyOf(drop.grid);
      if (this.runeSightSprites.has(key)) continue;
      const def = getPowerUp(drop.type);
      const world = this.grid.toWorld(drop.grid);
      const marker = this.add.container(world.x, world.y - 23);
      const eye = this.add.ellipse(0, 0, 31, 17, 0x12101a, 0.94).setStrokeStyle(2, 0xb394ff, 0.88);
      const icon = this.add.image(0, 0, this.textures.exists(def.assetKey) ? def.assetKey : 'power-fallback')
        .setDisplaySize(14, 14);
      marker.add([eye, icon]);
      marker.setDepth(39);
      this.effectLayer.add(marker);
      this.tweens.add({ targets: marker, y: marker.y - 4, duration: 620, yoyo: true, repeat: -1, ease: 'Sine.inOut' });
      this.runeSightSprites.set(key, marker);
    }
  }

  private updateStoredPowerAim(): void {
    const power = this.player.storedPower;
    const direction = this.player.lastDir;
    const key = power
      ? `${power}:${this.player.grid.x},${this.player.grid.y}:${direction.x},${direction.y}`
      : '';
    if (key === this.storedPowerAimKey) return;
    this.storedPowerAim?.destroy(true);
    this.storedPowerAim = undefined;
    this.storedPowerAimKey = key;
    if (!power || power === 'frostSnare' || this.player.actionMs > 0) return;

    const def = getPowerUp(power);
    const maxTiles = power === 'ravenBlink' ? 3 : 6;
    const aim = this.add.container(0, 0).setAlpha(0.62);
    let endpoint = { ...this.player.grid };
    for (let step = 1; step <= maxTiles; step += 1) {
      const tile = {
        x: this.player.grid.x + direction.x * step,
        y: this.player.grid.y + direction.y * step
      };
      if (!this.grid.inBounds(tile) || this.grid.get(tile) === 'solid') break;
      if (power !== 'ravenBlink' && this.grid.get(tile) !== 'empty') break;
      if (this.grid.isWalkable(tile) && !this.bombs.isBombBlocking(tile)) endpoint = tile;
      else if (power !== 'ravenBlink') break;
      const world = this.grid.toWorld(tile);
      const horizontal = direction.x !== 0;
      const rail = this.add.rectangle(
        world.x,
        world.y,
        horizontal ? this.grid.tileSize - 18 : 5,
        horizontal ? 5 : this.grid.tileSize - 18,
        def.color,
        0.5
      );
      const arrow = horizontal
        ? this.add.triangle(world.x, world.y, -6 * direction.x, -6, 8 * direction.x, 0, -6 * direction.x, 6, 0xffffff, 0.72)
        : this.add.triangle(world.x, world.y, -6, -6 * direction.y, 0, 8 * direction.y, 6, -6 * direction.y, 0xffffff, 0.72);
      aim.add([rail, arrow]);
    }
    if (!sameTile(endpoint, this.player.grid)) {
      const destination = this.grid.toWorld(endpoint);
      aim.add(this.add.circle(destination.x, destination.y, 13, def.color, 0.08).setStrokeStyle(2, def.color, 0.9));
    }
    this.effectLayer.add(aim);
    this.storedPowerAim = aim;
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

  private usePowerOrSpecial(actor: Player): void {
    if (!actor.alive || actor.actionMs > 0) return;
    if (actor.storedPower) {
      this.activateStoredPower(actor, actor.storedPower);
      return;
    }
    this.useSpecial(actor);
  }

  private activateStoredPower(actor: Player, power: StoredPowerType): void {
    actor.storedPower = undefined;
    const def = getPowerUp(power);
    if (power === 'dragonCore') {
      this.beginAction(actor, def.color, 210, 170, () => this.dragonBlast(actor));
      this.floatText(actor.world.x, actor.world.y - 56, 'Dragonflame released', '#ffb36b');
      return;
    }
    if (power === 'beastCall') {
      this.beginAction(actor, def.color, 190, 150, () => this.beastClaw(actor, true));
      this.floatText(actor.world.x, actor.world.y - 56, 'Beast Call released', '#b8ef9f');
      return;
    }
    if (power === 'ravenBlink') {
      this.beginAction(actor, def.color, 160, 130, () => this.blinkActor(actor, 3, def.color, true));
      this.floatText(actor.world.x, actor.world.y - 56, 'Raven Blink', '#d9b8ff');
      return;
    }
    this.beginAction(actor, def.color, 190, 150, () => {
      actor.frostTrailMs = 4500;
      actor.frostTrailZoneMs = 3500;
      this.addFrostZone(actor.grid, actor.frostTrailZoneMs, actor.id);
      this.frostActivation(actor, false);
    });
    this.floatText(actor.world.x, actor.world.y - 56, 'Frostsnare - 4.5s', '#bcefff');
  }

  private beginAction(
    actor: Player,
    color: number,
    windupMs: number,
    recoveryMs: number,
    release: () => void
  ): void {
    actor.actionState = 'windup';
    actor.actionMs = windupMs + recoveryMs;
    const view = this.views.get(actor.id);
    if (view) this.animation.playSpecial(actor, view, color);
    this.specialPulse(actor, color);
    this.time.delayedCall(windupMs, () => {
      if (!actor.alive || this.ended) return;
      actor.actionState = 'release';
      release();
      this.time.delayedCall(80, () => {
        if (actor.actionMs > 0) actor.actionState = 'recovery';
      });
    });
  }

  private useSpecial(actor: Player): void {
    if (actor.specialCooldownMs > 0 || actor.actionMs > 0) return;
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
      actor.frostTrailZoneMs = 4700;
      this.addFrostZone(actor.grid, actor.frostTrailZoneMs, actor.id);
      this.frostActivation(actor, true);
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
      this.beastClaw(actor, false);
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
      actor.actionMs = Math.max(0, actor.actionMs - dt);
      if (actor.actionMs <= 0) actor.actionState = undefined;
      if (actor.frostTrailMs <= 0) actor.frostTrailZoneMs = 0;
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
    for (const [id, decoy] of [...this.mirrorDecoys]) {
      decoy.remainingMs -= dt;
      if (decoy.remainingMs <= 0) this.removeDecoy(id, false);
    }
  }

  private floatText(x: number, y: number, label: string, color: string): void {
    const text = this.add.text(x, y, label, { fontFamily: 'Georgia', fontSize: '18px', color }).setOrigin(0.5);
    this.effectLayer.add(text);
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
    this.effectLayer.add(group);
    this.tweens.add({ targets: group, y: -28, alpha: 0, duration: 1050, onComplete: () => group.destroy() });
  }

  private applyPowerUpFeedback(actor: Player, type: PowerUpType): void {
    const def = getPowerUp(type);
    const color = def.color;
    const view = this.views.get(actor.id);
    this.animation.emitPickupBurst(actor, color, type === 'crownSurge' ? 22 : 14);
    if (view) this.animation.playSpecial(actor, view, color);
    this.specialPulse(actor, color);
    if (type === 'twin') this.orbitRunes(actor, color);
    if (type === 'remoteHex' && actor.isHuman) {
      this.floatText(actor.world.x, actor.world.y - 70, `Remote x${actor.stats.remoteCharges}`, '#d9b8ff');
    }
    if (!actor.isHuman && type !== 'crownSurge') {
      AudioSystem.get().sfx('pickup');
      return;
    }
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
          const tile = this.add.rectangle(0, 0, this.grid.tileSize - 8, this.grid.tileSize - 8, 0x75d7ff, 0.16)
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
    const resistance = actor.character === 'frost' ? 0.5 : 1;
    actor.snaredMs = Math.round(720 * resistance);
    actor.slowedMs = Math.round(2400 * resistance);
    actor.frostImmunityMs = Math.round(2900 * resistance);
    this.floatText(
      actor.world.x,
      actor.world.y - 50,
      actor.character === 'frost' ? 'Frost resisted' : 'Icebound - break free!',
      '#d8f7ff'
    );
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
    let blockedEndpoint: GridPosition | undefined;
    for (let step = 1; step <= 6; step += 1) {
      const tile = {
        x: actor.grid.x + direction.x * step,
        y: actor.grid.y + direction.y * step
      };
      if (!this.grid.inBounds(tile) || this.grid.get(tile) !== 'empty') {
        if (this.grid.inBounds(tile)) blockedEndpoint = tile;
        break;
      }
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
    if (blockedEndpoint) {
      const blockedWorld = this.grid.toWorld(blockedEndpoint);
      const stop = this.add.container(blockedWorld.x, blockedWorld.y);
      stop.add(this.add.circle(0, 0, 18, 0x1b1110, 0.86).setStrokeStyle(3, 0xffb36b, 0.94));
      stop.add(this.add.line(0, 0, -10, -10, 10, 10, 0xffd6a8, 0.95).setLineWidth(3));
      stop.add(this.add.line(0, 0, 10, -10, -10, 10, 0xffd6a8, 0.95).setLineWidth(3));
      this.effectLayer.add(stop);
      this.tweens.add({ targets: stop, scale: 1.14, duration: 150, yoyo: true, repeat: 1 });
      telegraph.push(stop);
    }
    AudioSystem.get().sfx('tick');

    this.time.delayedCall(380, () => {
      telegraph.forEach((item) => item.destroy());
      if (!actor.alive || this.ended) return;
      this.dragonBlastFx.fire(actor.grid, tiles, direction);
      if (this.network.active && this.network.role === 'host') {
        this.network.send({
          kind: 'dragonBlast',
          origin: { ...actor.grid },
          tiles: tiles.map((tile) => ({ ...tile })),
          direction: { ...direction }
        });
      }

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
    const shade = this.add.circle(from.x, from.y, 20, color, 0.12).setStrokeStyle(3, color, 0.74);
    const departure = this.add.container(from.x, from.y);
    for (let i = 0; i < 6; i += 1) {
      departure.add(this.add.triangle(
        Phaser.Math.Between(-12, 12),
        Phaser.Math.Between(-14, 14),
        -3,
        8,
        2,
        -9,
        5,
        7,
        color,
        0.86
      ).setAngle(Phaser.Math.Between(-55, 55)));
    }
    this.effectLayer.add([shade, departure]);
    actor.grid = landing;
    actor.world = this.grid.toWorld(landing);
    const to = actor.world;
    const trail = this.add.line(0, 0, from.x, from.y, to.x, to.y, color, 0.65).setLineWidth(5).setDepth(40);
    const landingFx = this.add.circle(to.x, to.y, 10, color, 0.16).setStrokeStyle(4, 0xf1e9ff, 0.92);
    this.effectLayer.add(landingFx);
    this.tweens.add({
      targets: [shade, trail, departure],
      alpha: 0,
      scale: 1.45,
      angle: 90,
      duration: 420,
      onComplete: () => {
        shade.destroy();
        trail.destroy();
        departure.destroy(true);
      }
    });
    this.tweens.add({ targets: landingFx, scale: 2.4, alpha: 0, duration: 360, onComplete: () => landingFx.destroy() });
    this.specialPulse(actor, color);
  }

  private spawnDecoy(actor: Player): void {
    if (actor.mirrorDecoyId) this.removeDecoy(actor.mirrorDecoyId, false);
    const id = `mirror-${actor.id}-${Math.floor(this.time.now)}`;
    const visual = this.add.container(actor.world.x, actor.world.y);
    const shadow = this.add.ellipse(0, 18, 44, 14, 0x000000, 0.7);
    const base = this.add.circle(0, 0, 24, 0x2a1b16, 1).setStrokeStyle(3, 0xd0a06a, 0.95);
    const diamond = this.add.polygon(0, -2, [-12, 0, 0, -20, 12, 0, 0, 20], 0x8d5f39, 1)
      .setStrokeStyle(2, 0xf1c08a, 0.95);
    const eye = this.add.circle(0, -2, 6, 0xf1c08a, 1).setStrokeStyle(2, 0x1a1010, 1);
    const label = this.add.text(0, 35, 'MIRROR SHADE', {
      fontFamily: 'Arial',
      fontStyle: 'bold',
      fontSize: '9px',
      color: '#f1c08a',
      stroke: '#08080c',
      strokeThickness: 2
    }).setOrigin(0.5);
    visual.add([shadow, base, diamond, eye, label]);
    this.objectLayer.add(visual);
    this.tweens.add({ targets: [diamond, eye], angle: 180, duration: 900, repeat: -1, ease: 'Sine.inOut' });
    this.tweens.add({ targets: base, scale: 1.12, duration: 520, yoyo: true, repeat: -1 });

    const target = new Player(
      id,
      'Mirror Shade',
      actor.character,
      { ...actor.grid },
      { ...actor.world },
      makeStats(actor.character),
      false,
      0xd0a06a,
      0xf1c08a
    );
    target.stats.health = 1;
    target.stats.maxHealth = 1;
    this.mirrorDecoys.set(id, { ownerId: actor.id, target, visual, remainingMs: 4000 });
    actor.mirrorDecoyId = id;
  }

  private removeDecoy(id: string, struck: boolean): void {
    const decoy = this.mirrorDecoys.get(id);
    if (!decoy) return;
    this.mirrorDecoys.delete(id);
    const owner = this.actors.find((actor) => actor.id === decoy.ownerId);
    if (owner?.mirrorDecoyId === id) owner.mirrorDecoyId = undefined;
    this.tweens.killTweensOf(decoy.visual);
    this.tweens.add({
      targets: decoy.visual,
      scale: struck ? 1.45 : 0.7,
      alpha: 0,
      angle: struck ? 45 : 0,
      duration: struck ? 180 : 280,
      onComplete: () => decoy.visual.destroy(true)
    });
    if (struck) {
      this.floatText(decoy.target.world.x, decoy.target.world.y - 44, 'MISDIRECTED', '#f1c08a');
      this.animation.emitPickupBurst(owner ?? decoy.target, 0xd0a06a, 10);
    }
  }

  private beastClaw(actor: Player, directional: boolean): void {
    const range = 4;
    let target: Player | undefined;
    let endpoint = { ...actor.grid };
    if (directional) {
      for (let step = 1; step <= range; step += 1) {
        const tile = {
          x: actor.grid.x + actor.lastDir.x * step,
          y: actor.grid.y + actor.lastDir.y * step
        };
        if (!this.grid.inBounds(tile) || this.grid.get(tile) !== 'empty') break;
        endpoint = tile;
        target = this.actors.find((candidate) =>
          candidate !== actor && candidate.alive && sameTile(candidate.grid, tile)
        );
        if (target) break;
      }
    } else {
      target = this.actors
        .filter((candidate) => candidate !== actor && candidate.alive && distance(actor.grid, candidate.grid) <= range)
        .sort((a, b) => distance(actor.grid, a.grid) - distance(actor.grid, b.grid))[0];
      if (target) endpoint = { ...target.grid };
      else {
        this.floatText(actor.world.x, actor.world.y - 50, 'No prey in range', '#a8c89a');
        return;
      }
    }

    const destination = this.grid.toWorld(endpoint);
    const claw = this.add.container(actor.world.x, actor.world.y);
    const core = this.add.circle(0, 0, 12, 0x8bd56f, 0.72).setStrokeStyle(3, 0xd9ffd0, 0.9);
    const slashA = this.add.line(0, 0, -12, 12, 8, -12, 0xd9ffd0, 0.9).setLineWidth(4);
    const slashB = this.add.line(0, 0, -2, 14, 16, -9, 0x8bd56f, 0.82).setLineWidth(4);
    claw.add([core, slashA, slashB]);
    this.effectLayer.add(claw);
    this.tweens.add({
      targets: claw,
      x: destination.x,
      y: destination.y,
      scale: 1.35,
      angle: 40,
      duration: 360,
      ease: 'Cubic.easeIn',
      onComplete: () => {
        if (target?.alive && distance(actor.grid, target.grid) <= range) {
          target.slowedMs = 2200;
          this.damageActor(target, actor.id);
          this.animation.emitPickupBurst(target, 0x8bd56f, 12);
          this.floatText(target.world.x, target.world.y - 54, 'BEASTSTRUCK', '#d9ffd0');
        }
        this.tweens.add({ targets: claw, alpha: 0, scale: 2, duration: 140, onComplete: () => claw.destroy(true) });
      }
    });
  }

  private frostActivation(actor: Player, wardenStrength: boolean): void {
    const ring = this.add.circle(actor.world.x, actor.world.y + 8, 18, 0x75d7ff, 0.18)
      .setStrokeStyle(wardenStrength ? 5 : 3, 0xd8f7ff, 0.92);
    const shard = this.add.star(actor.world.x, actor.world.y + 4, 6, 6, wardenStrength ? 24 : 18, 0xd8f7ff, 0.8);
    this.effectLayer.add([ring, shard]);
    this.tweens.add({
      targets: [ring, shard],
      scale: wardenStrength ? 2.7 : 2.2,
      alpha: 0,
      angle: 90,
      duration: 520,
      ease: 'Cubic.easeOut',
      onComplete: () => {
        ring.destroy();
        shard.destroy();
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
    power.apply(this.player.stats);
    if (isStoredPower(type)) this.player.storedPower = type;
    this.player.lastPowerUp = type;
    this.player.lastPowerUpMs = 4200;
    this.applyPowerUpFeedback(this.player, type);
    this.pulseHudForPower(type);
    this.redrawHealth(this.player);
    this.toggleSandboxLab();
  }

  private showRoundIntro(): void {
    const modeDef = MODES.find((m) => m.id === SESSION.mode) ?? MODES[0];
    const bg = this.add.rectangle(640, 285, 700, 142, 0x0d0c12, 0.95).setStrokeStyle(2, this.grid.map.glow, 0.8);
    const accent = this.add.rectangle(640, 219, 660, 4, this.grid.map.glow, 0.8);
    const text = this.add.text(640, 235, `${this.grid.map.name}  |  ${modeDef.name}`, {
      fontFamily: 'Georgia',
      fontSize: '28px',
      color: '#f7d783'
    }).setOrigin(0.5);
    const objective = this.add.text(640, 280, modeDef.objective, {
      fontFamily: 'Arial', fontStyle: 'bold',
      fontSize: '16px',
      color: '#f4ead2'
    }).setOrigin(0.5);
    const controls = SESSION.mode === 'arcade'
      ? this.device.touch
        ? 'JOYSTICK move   STRIKE primary   SECONDARY tactic   SIGNATURE ultimate'
        : 'WASD move   SPACE primary   E secondary   SHIFT signature'
      : this.device.touch
        ? 'JOYSTICK move   BOMB place rune   POWER special/cast   HEX remote'
        : 'WASD move   SPACE bomb   SHIFT power/special   E remote';
    const hintText = SESSION.mode === 'sandbox'
      ? `Open RUNE LAB to apply any power | practice rival has 20 health\n${this.device.touch ? 'Tap RUNE LAB' : 'T opens lab'}   ${controls}`
      : SESSION.mode === 'arcade'
        ? `Fight inside the Armory | standard strikes affect one tile | named skills paint longer reach\n${controls}`
      : `Break blocks | collect runes | control the centre\n${controls}`;
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
    if (this.network.active && this.network.role === 'host') this.network.send({ kind: 'pause', paused: true });
    this.input.keyboard?.once('keydown-R', this.restartTrial, this);
    this.input.keyboard?.once('keydown-Q', this.returnToMainMenu, this);
  }

  private closePauseOverlay(): void {
    this.input.keyboard?.off('keydown-R', this.restartTrial, this);
    this.input.keyboard?.off('keydown-Q', this.returnToMainMenu, this);
    this.pausedText?.destroy(true);
    this.pausedText = undefined;
    this.paused = false;
    if (this.network.active && this.network.role === 'host') this.network.send({ kind: 'pause', paused: false });
  }

  private restartTrial(): void {
    this.closePauseOverlay();
    if (this.network.active && this.network.role === 'host') this.network.send({ kind: 'restart' });
    this.scene.restart();
  }

  private returnToMainMenu(): void {
    this.closePauseOverlay();
    if (this.network.active) this.network.leave();
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
    const notice = this.add.text(640, 98, muted ? 'Audio muted' : 'Audio on', {
      fontFamily: 'Georgia', fontSize: '18px', color: '#f7d783'
    }).setOrigin(0.5).setDepth(190);
    this.tweens.add({ targets: notice, y: 72, alpha: 0, duration: 900, onComplete: () => notice.destroy() });
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
    this.runeSightSprites.clear();
    this.mirrorDecoys.clear();
    this.storedPowerAim = undefined;
    this.storedPowerAimKey = '';
    this.sandboxOpen = false;
    this.sandboxPanel = undefined;
    this.sandboxLauncher = undefined;
    this.networkSnapshotMs = 0;
    this.networkInputMs = 0;
    this.networkInputSequence = 0;
    this.networkSnapshotSequence = 0;
    this.lastReceivedSnapshotSequence = 0;
    this.lastNetworkDirection = 'none';
    this.networkStatusText = undefined;
    this.remoteInputs.clear();
    this.arcadeAttackMs.clear();
    this.arcadeSecondaryMs.clear();
    this.arcadePowerMs.clear();
    this.arcadeBlockHealth.clear();
    for (const mark of this.arcadeWispMarks.values()) {
      mark.timer.remove(false);
      mark.visual.destroy(true);
    }
    this.arcadeWispMarks.clear();
    this.actorSpawns = [];
  }

  private shutdown(): void {
    setMatchPresentation(false);
    this.input.keyboard?.off('keydown-R', this.restartTrial, this);
    this.input.keyboard?.off('keydown-Q', this.returnToMainMenu, this);
    this.bombViews?.cleanup();
    this.worldPresentation?.destroy();
    this.tweens.killAll();
    this.input.keyboard?.removeAllListeners();
    this.network.removeEventListener('game', this.onNetworkGame);
    this.network.removeEventListener('status', this.onNetworkStatus);
    this.network.removeEventListener('lost', this.onNetworkLost);
    this.powerSprites.clear();
    this.blockSprites.clear();
    this.views.clear();
  }
}
