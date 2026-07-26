# Crownfire Arena

Original dark-medieval-fantasy arcade bomber arena game built with TypeScript, Phaser 3, Vite, and HTML5 Canvas/WebGL.

## Run Locally

```bash
npm install
npm run dev
```

Open the local URL Vite prints, usually `http://127.0.0.1:5173`.

On Windows systems that block PowerShell scripts, use `npm.cmd run dev`.

For testing on a phone connected to the same Wi-Fi network, run `npm run dev:mobile` and open the displayed network URL. Production installation should use HTTPS so the service worker and offline cache are available.

## Controls

- `WASD`: move
- `Space`: place rune bomb
- `Shift`: use class special
- `E`: remote detonate when Remote Hex is collected
- `Escape`: pause
- Menus use mouse clicks.
- `M`: toggle audio during a match
- Player 2: arrows to move, `Enter` bomb, right `Shift` special, `P` remote
- Phone: on-screen direction pad, Bomb, Power, Hex, and Pause controls
- Bluetooth remote/gamepad: use **Controller Setup** on the title screen to view incoming iPad browser events and bind every action

## Play on iPad

Open the GitHub Pages URL in Safari, rotate to landscape, and use **Share > Add to Home Screen** for a full-screen app icon. Touch controls appear automatically on touch devices.

For a Bitmore VR EYE or similar one-handed Bluetooth remote:

1. Pair the remote in iPad **Settings > Bluetooth**.
2. Open **Controller Setup** in Crownfire and press each remote button.
3. The live tester shows keyboard codes, gamepad buttons, and stick axes received by Safari.
4. Tap **Bind** next to an action, then press the desired remote button. Mappings persist on that iPad.
5. If no event appears, switch the remote to game mode (generic VR EYE manuals commonly use **Function + B**), reconnect it, and retry.

iPadOS may reserve volume, Home, and media buttons, so they cannot always be used by browser games. The on-screen touch controls remain available as a fallback.

## GitHub Pages

The workflow in `.github/workflows/deploy-pages.yml` builds and publishes every push to `main`. The Vite base path, manifest, service worker, and offline fallback are configured for the `/crownfire-arena/` project URL.

## Current Features

- 1280x720 responsive widescreen presentation with full-bleed kingdom art
- Playable single-player arena combat against AI bots and optional local two-player
- Smooth grid-aware movement
- Rune bombs with fuse pulse, chain reactions, cross-shaped blasts, and destructible blocks
- Power-up drops: Ember Rune, Twin Sigil, Wolf Sprint, Stoneguard Blessing, Dragonflame Core, Ghost Veil, Frost Snare, Raven Blink, Beast Call, Remote Hex, and Champion Surge
- Eight selectable champions with large showcase portraits, stable layered animation, and themed special abilities
- Classic Trial and Crown Shard Hunt modes
- Four original maps: Ashen Courtyard, Moonfang Ruins, Frost Crown Keep, Hollowmoon Sanctuary
- Layered themed environments with eight floor variations, solid walls, destructible blocks, spawn pads, animated shrines, landscape art, ambient props, and border masonry
- Central shrine objective support with periodic shard or rare rune spawns
- Side-rail HUD, active-effect tracking, pause overlay, polished results screen, and rewards saved to localStorage
- Rune Guide screen explaining power-up effects
- Original procedural menu, results, and kingdom-specific battle scores with persistent mute and mix settings
- Installable PWA manifest, landscape mobile metadata, offline runtime cache, and multi-touch controls

## Known Limitations

- Bot AI is intentionally lightweight for the first playable build.
- Champion animation uses stable portrait-layer motion, glows, particles, squash/stretch, and facing flips; authored directional frame sheets remain a future art pass.
- The score is generated with WebAudio rather than recorded orchestral stems.
- Online multiplayer is not implemented.
- Environment art is now PNG-based and textured, but the next jump toward the reference art quality would be hand-painted or AI-assisted tile atlases sliced into larger prop sets.

## Suggested Next Upgrades

- Add bespoke sprite sheets and impact animation frames.
- Expand Survival, Beast Royale, and Rune Dominion modes.
- Add local two-player controls.
- Add difficulty settings and smarter escape route planning.
- Add cosmetic unlock screen and more map hazards.
