# Crowdfire Arena

Original dark-medieval-fantasy arcade bomber arena game built with TypeScript, Phaser 3, Vite, and HTML5 Canvas/WebGL.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints, usually `http://127.0.0.1:5173`.

On Windows systems that block PowerShell scripts, use `npm.cmd run dev`.

For testing on a phone connected to the same Wi-Fi network, run `npm run dev:mobile` and open the displayed network URL. Production installation should use HTTPS so the service worker and offline cache are available.

## Online Rumble And Social Core

The new TypeScript service supplies persistent guest identity, four-seat private
Rumble rooms, spectators, ready states, reconnection, friends, match history,
rivalries and unanimous **Run It Back** rematches.

```bash
docker compose up --build
```

Start the client in another terminal:

```bash
copy .env.example .env
npm run dev
```

Choose **Online Rumble**, create a room, share its link or six-character code, select
a champion and mark Ready. Every open seat becomes a competitive arena bot when the
host begins. Disconnected human seats are retained for two minutes while the browser
retries for sixty seconds.

GitHub Pages still hosts the PWA client. It cannot run WebSockets or PostgreSQL, so
the social service is deployed separately using `render.yaml`. See
`ONLINE_SOCIAL_ARCHITECTURE.md` for the authority boundary and deployment checklist.

The older `npm run multiplayer:host` LAN relay remains available as a development
fallback but is no longer the primary menu flow.

## Controls

- `WASD`: move
- `Space`: place rune bomb
- `Shift`: release a stored Power rune; otherwise use the champion special
- `E`: detonate the oldest armed Remote Hex bomb; armed bombs wait indefinitely
- `Escape`: pause
- Menus use mouse clicks.
- `M`: toggle audio during a match
- Player 2: arrows to move, `Enter` bomb, right `Shift` special, `P` remote
- Phone/iPad: draggable virtual joystick plus Bomb, Power, Hex, and Pause controls. `HEX` only appears while a Remote Hex bomb is armed.
- Bluetooth remote/gamepad: use **Controller Setup** on the title screen to view incoming iPad browser events and bind every action

## Play on iPad

Open the GitHub Pages URL in Safari, rotate to landscape, and use **Share > Add to Home Screen** for a full-screen app icon. Touch controls appear automatically on touch devices.

For a Bitmore VR EYE or similar one-handed Bluetooth remote:

1. Pair the remote in iPad **Settings > Bluetooth**.
2. Open **Controller Setup** in Crowdfire and press each remote button.
3. The live tester shows keyboard codes, gamepad buttons, and stick axes received by Safari.
4. Tap **Bind** next to an action, then press the desired remote button. Mappings persist on that iPad.
5. If no event appears, switch the remote to game mode (generic VR EYE manuals commonly use **Function + B**), reconnect it, and retry.

iPadOS may reserve volume, Home, and media buttons, so they cannot always be used by browser games. The on-screen touch controls remain available as a fallback.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds and publishes every push to `main`. The Vite base path, manifest, service worker, and offline fallback are configured for the `/crownfire-arena/` project URL.

## Current Features

- 1280x720 responsive widescreen presentation with full-bleed kingdom art
- Device-aware phone and tablet formatting with a compact HUD and aspect-safe full-arena iPad view
- Touch joystick and action controls stay in illustrated exterior gutters so all four spawn corners remain visible
- Touch pause menu includes Resume, Restart Trial, and Main Menu without requiring a page refresh
- Playable single-player arena combat against AI bots and optional local two-player
- Smooth grid-aware movement
- Rune bombs with fuse pulse, chain reactions, cross-shaped blasts, and destructible blocks
- Passive/automatic runes: Ember Rune, Twin Sigil, Wolf Sprint, Stoneguard Blessing, Ghost Veil, Remote Hex, and rare Champion Surge
- Stored Power runes: Dragonflame, Frostsnare, Raven Blink, and Beast Call; collect one, aim with movement/facing, then press Power
- Champion Surge has an explicit 4.5% rune roll, activates on pickup, and grants nine seconds of blast immunity plus contact pressure
- Eight selectable champions with large showcase portraits, stable layered animation, and themed special abilities
- Classic Trial, Crown Shard Hunt, four-seat Rumble, and pressure-free Rune Sandbox modes
- Legacy two-player same-WiFi relay retained for local development
- Four original maps: Ashen Courtyard, Moonfang Ruins, Frost Crown Keep, Hollowmoon Sanctuary
- Image-led Arena Select cards using the original kingdom vistas and arena concept paintings
- Layered themed environments with eight floor variations, solid walls, destructible blocks, spawn pads, animated shrines, landscape art, ambient props, and border masonry
- Central shrine objective support with periodic shard or rare rune spawns
- Desktop side-rail HUD, compact touch HUD, active-effect tracking, pause overlay, polished results screen, and rewards saved to localStorage
- Rune Guide screen explaining power-up effects
- Four-seat Online Rumble with bot fill, private invites, ready states, spectators, reconnect and rematches
- Persistent guest profile, friends, presence, match history and remembered head-to-head rivalries
- Rivalry Chronicle with one-tap room joining for online friends
- Rune Lab for granting every real pickup, testing charges and timers, and sparring with a durable practice rival
- Original procedural menu, results, and kingdom-specific battle scores with persistent mute and mix settings
- Installable PWA manifest, landscape mobile metadata, offline runtime cache, and multi-touch controls
- Easy, Normal, and Hard bot profiles preserve champion-specific health/speed traits while varying reaction, aggression, pickup, shrine, and special-use priorities
- Fuse-aware bot routing models chain reactions, retains route targets between decisions, rejects unreachable pickups, and requires an escape route before bomb placement

## Bot Simulation

Run the deterministic-format headless tournament after AI or balance changes:

```bash
npm run test:bots -- 120
```

The harness rotates all eight champions through all four maps and all three difficulty profiles. It writes aggregate survival, bomb, self-hit, pickup, shrine, elimination, and win observations to `artifacts/bot-simulation-report.json`.

## Known Limitations

- Bot AI now has explicit Easy, Normal, and Hard profiles and can fight every champion line-up. It does not yet coordinate teams or perform long-horizon opponent modelling.
- Champion animation uses stable portrait-layer motion, glows, particles, squash/stretch, and facing flips; authored directional frame sheets remain a future art pass.
- The score is generated with WebAudio rather than recorded orchestral stems.
- Online room/session/persistence authority is server owned, while the existing Phaser host still runs the live combat simulation. Ranked integrity requires a headless server simulation.
- Apple, Google and email account linking require deployment credentials and redirect/email-provider configuration; guest identity is complete now.
- Environment art is now PNG-based and textured, but the next jump toward the reference art quality would be hand-painted or AI-assisted tile atlases sliced into larger prop sets.

## Suggested Next Upgrades

- Add bespoke sprite sheets and impact animation frames.
- Expand Survival, Beast Royale, and Rune Dominion modes.
- Add short-term multi-bot tile reservations and deeper opponent prediction.
- Add cosmetic unlock screen and more map hazards.

## Multiplayer Next Steps

- Move LAN host authority into a dedicated always-on internet room server.
- Add ready states, latency display, server-side input sequencing, host migration, and larger rooms.
- Add public/private room discovery only after authentication and abuse controls are designed.
