# Crownfire competitive-play audit

## Scope and evidence

This audit preserves the approved local visual build. It is based on:

- a live manual Dragon-Blood Heir / Ashen Courtyard walkthrough, in which the player demonstrated deliberate route opening, bomb placement, retreat and centre access;
- source inspection of `AIController`, `DangerMapSystem`, `BombSystem`, `PowerUpSystem`, `GameScene`, champion definitions and the touch controller;
- a UI inspection of the current touch build.

The remaining seven live champion/map observations are still required before declaring numerical balance complete. The recommendations below separate verified implementation facts from tuning targets.

## What skilled play proved

1. A bomb is a **route-editing tool**, not an action to spam. The player identifies the blocker, pre-plans the turn and retreats outside the full cardinal blast lane.
2. The centre is the match's strategic hinge: routes that open toward it improve access to runes, opponents and shrine rewards.
3. Champion specials should create a visible tactical decision: escape, chase, force a route, deny an area or punish a clear lane.
4. Bot skill must be judged by whether it can reproduce this loop safely and deliberately, not simply by its movement speed.

## Current technical findings

### Bot AI

- Current thinking is local. A bot places a bomb if any adjacent tile is outside its own preview blast and has an open neighbour. It does **not** prove that a whole route remains traversable during the 2.2-second fuse.
- Danger is only marked for bombs with less than 1.05 seconds remaining. This causes late escapes and gives planning no view of incoming chain reactions.
- Targeting is mostly nearest-opponent distance. Centre interest is random (34%) and shrine control has no persistent ownership model.
- Specials are selected randomly by bots. They have no character-specific tactical policy.

### Runes and match economy

- Initial runes are centre-weighted and block drops use a 34% base chance, but the system has no phase-aware economy or comeback rules.
- Remote Hex has the same base weight as most runes; it is easy to miss because there is no forward-visible ownership/charge language until a bomb is armed.
- Raven Blink and Beast Call pickup definitions currently return labels without their own independent, persistent gameplay state. Their guide presence therefore over-promises compared with the pickup result.
- The shrine awards a random item every 15–20 seconds. Classic Trial says “control the centre”, but the mode does not yet measure or reward control time.

### Champion identities

| Champion | Current reliable identity | Next design target |
| --- | --- | --- |
| Dragon-Blood Heir | Larger standard bomb radius; next-bomb surge | Straight-lane Dragon Blast with a wall-stopped telegraph and deliberate aim window. |
| Wolfbound Ranger | Naturally faster; short dash/speed special | High-mobility route thief; rewards safe pickup steals and flanks, not raw damage. |
| Frostborn Warden | Next bomb has a snare | Ice Feet trail that creates temporary, readable escape denial. |
| Veil Witch | Ghost/invulnerability state | Brief bomb-lane break and ambush setup, with an obvious expiry cue. |
| Skinchanger Rogue | Light speed edge; visual decoy concept | Decoy that attracts bot targeting or mimics a bomb threat, not only visual flavour. |
| Stoneguard Knight | Extra health and shield | Deliberate one-hit shield/anchor role, with clean duration and break feedback. |
| Raven Seer | Blink can cross blocks | Best route-cutter; blink should expose a short landing marker and cooldown. |
| Beast Tamer | Long-range nearest-rival call | Keep as the ranged punish role, but use range/line-of-sight limits and a visible warning. |

## Competitive bot design

Replace one-step choices with a scored, fuse-aware state plan:

1. **Threat map.** Predict every live bomb's blast tiles at detonation time, including chain reactions. Pathfind on `(tile, time)` rather than only current safe tiles.
2. **Bomb permission.** Before placing, find at least one route from the bomb tile to a tile outside the entire predicted blast graph before fuse expiry; reject dead-end routes. Prefer two exits for normal difficulty and one only for hard mode.
3. **Goals.** Score centre/shrine control, high-value rune routes, safe destructible clusters, vulnerable opponents and escape-room preservation. Goals persist for a few seconds so the bot does not jitter.
4. **Trap logic.** Bomb only when an opponent's reachable safe region is reduced, or when block clearing meaningfully opens the centre. Do not bomb merely because a block is adjacent.
5. **Special policies.** Dragon fires through a confirmed lane; Wolf uses speed to steal/escape; Frost paints a retreat chokepoint; Veil crosses danger; Stone absorbs a forced exchange; Raven blinks through a closed route; Beast calls only on a viable target.
6. **Difficulty.** Easy uses one safe exit and delayed reactions; Standard uses full fuse routing; Hard adds opponent reachable-area estimates and combo intent. All difficulties must obey the same rules—never hidden damage or impossible movement.

## Rune and shrine tuning plan

1. Give all runes a category and a clear state: permanent (`Ember`, `Twin`), timed (`Sprint`, `Veil`, `Shield`), armed next-bomb (`Dragon`, `Frost`), charge (`Blink`, `Call`, `Remote`) and crown/star (`Surge`).
2. Put an icon + timer/charge marker beside the champion and a compact, distinct effect on the actor itself.
3. Make Remote Hex appear at a slightly higher effective rate only after the first bomb has been placed; immediately show `REMOTE x3` and show the Hex action only when at least one armed remote bomb exists.
4. Add phase rules: more mobility/escape runes early, combat/area-control in midgame, and shrine-exclusive crown rewards after the centre becomes contested.
5. Change Classic's centre language to “Shrine drops every 15 seconds” until actual holding/ownership exists. When Rune Dominion is built, use a separate visible hold meter and score.

## Mobile and layout findings

- The draggable thumbstick is the right interaction model. Keep bomb, power, hex and pause as independent touches so movement and actions can overlap.
- Desktop uses Phaser FIT at 1280x720. In tall Chrome windows, this produces empty bands above/below the canvas. Preserve gameplay aspect ratio but wrap the canvas in a true viewport-centred shell with a themed background instead of black/white unused space.
- On iPad, keep the game UI inside safe areas and give the joystick enough separation from browser gesture edges.

## Developer Creative Mode specification

Private-only mode, excluded from standard matchmaking:

- choose map, mode and number of local bots;
- choose each bot's difficulty/aggression/goal bias;
- tune lives, bomb count, radius, fuse, speed, drop rate, shrine interval and match length;
- set special cooldowns/durations, number of simultaneous abilities and per-rune weights;
- grant/remove any rune, freeze time, reset trial and inspect the predicted danger map;
- save named presets locally for repeatable balance tests.

## Production order

1. Add deterministic bot test scenarios for bomb escape, chain reactions, centre approach and trap decisions.
2. Implement time-aware danger/path planning and champion-special policies.
3. Make rune state, shrine rules and match feedback explicit; then tune with recorded match telemetry.
4. Build private Creative Mode on top of the same ruleset.
5. Add local-Wi-Fi host/join architecture using an authoritative host state and phone clients as input/render clients.
6. Add rotating high-resolution map/champion key art and per-arena upbeat music, while retaining the current local visual source of truth.

## Implemented audit fix and QA evidence

The first bot-safety correction is now in the local working tree only:

- bots evaluate a complete route from a proposed bomb square to a square outside that bomb's blast;
- the placed bomb is treated as a sealed tile, so an escape cannot rely on walking back through it;
- after placing, a bot continues routing to safety instead of immediately switching back to chase or wandering behaviour.

The random bot special trigger has also been replaced with the first champion policy pass: Dragon/Frost arm a bomb only at a safe bomb setup, Wolf/Raven reserve mobility for an escape or long chase, Veil responds to danger, Stone protects a pressured/low-health bot, Skin uses misdirection near a rival, and Beast uses its call only in range.

`npm.cmd run build` passed after this change. In a local idle-player Ashen trial, bots visibly began placing bombs and moving away from their placement lanes. This is a smoke test, not a claim of full difficulty balance; the eight-player/champion/map observation matrix remains the evidence gate for tuning values.

## Local-Wi-Fi architecture direction

Use a host-authoritative room: one phone/browser runs simulation, peers send compact inputs, and the host broadcasts snapshots/events. A discovery/join screen can use a room code or QR code on the same Wi-Fi. Build game state as deterministic data first so a later WebRTC/relay transport can reuse the exact simulation protocol. Do not use shared-screen mirroring as multiplayer.

## Source-to-design mismatch to resolve before balancing

The running local implementation is the authoritative starting point. Its live special behaviour is not yet the same as the desired design in several places:

- Dragon currently arms a +1 radius next bomb; it has no lane beam.
- Frost currently arms the next frost bomb; it has no movement-generated Ice Feet trail.
- Wolf blinks three tiles without passing through blocks and gets an 1.8-second speed boost.
- Veil grants three seconds of ghost state.
- Skin spawns a decoy and has 650ms invulnerability.
- Stone grants a shield but the core special path does not currently add an expiry timer.
- Raven blinks three tiles and can cross blocks.
- Beast targets the nearest rival under the existing Beast Call implementation.

The character configuration file still labels Skin, Stone, Raven and Beast as `implemented: false`, even though `GameScene` contains a runtime implementation path for all four. Correct that metadata when the gameplay pass begins so selection, guide and runtime agree.

## Map audit

All four arenas currently share the same 15x13 Bomberman-like structural rules: perimeter walls, solid pillars on even/even tiles, spawn clearances and procedurally seeded destructibles. Their themes and premium art differ, but their tactical topology is largely a variation of one generator rather than four authored competitive layouts.

Keep the approved visual kits, but give each future competitive map one authored identity:

- **Ashen Courtyard:** dangerous central choke lanes and destructible outer flanks.
- **Moonfang Ruins:** wider side loops that reward Wolf/Raven mobility.
- **Frost Crown Keep:** narrow hold points around the shrine where ice denial matters.
- **Hollowmoon Sanctuary:** asymmetric blink routes and deceptive dead ends for Veil/Skin.
