# Competitive Rumble + Universal Powers Readability

## Delivered

- Bot intents retain their tactical target and advance along a danger-aware path at tile boundaries.
- Fuse forecasts model active blast windows, remote-bomb chain reactions, changing blast lanes, and safe waiting after bomb placement.
- Easy, Normal, and Hard profiles preserve each champion's base health and speed differences.
- Bot priorities are danger, lethal trap, pickup, shrine, pressure bomb, block opening, rival chase, then anti-idle recovery.
- Dragonflame, Frostsnare, Raven Blink, and Beast Call are universal stored Power actions and never auto-fire on pickup.
- Dragon Blast and Beast Call are bounded cardinal attacks; Raven Blink lands on the last valid forward tile.
- Frostsnare leaves an owner-safe timed trail. Frostborn's Ice Feet remains the stronger signature version.
- Mirror Shade creates an opaque targetable decoy that changes bot targeting.
- Remote Hex is more available, arms three bombs, and exposes HEX only while a bomb is armed.
- Champion Surge has an explicit 4.5% roll and remains an automatic nine-second rare event.
- Stored actions use wind-up, release, and recovery phases while collision and movement remain authoritative.
- Compact touch HUD slots no longer overlap; active effects occupy the upper-left exterior rail.
- Bomb telegraphs retain exact affected tiles with lighter directional lanes, corner brackets, and a strong centre motif.
- Frost Crown, Hollowmoon, and Moonfang use material-level value separation while Ashen remains unchanged.

## Automated Tournament

`npm run test:bots -- 120`

- 120 matches across four maps, three difficulties, and rotating eight-champion line-ups.
- 7,652 bombs placed.
- 558 damage events and 122 eliminations.
- 1,457 pickups collected and 3,289 shrine entries.
- 18 self-defeats, or 0.235% per placed bomb. Unsafe bomb placement is rejected before commitment; the remaining cases occur during live multi-bomb/chain pressure.
- Average survivors at the 120-second audit cap: 2.98.
- Full aggregate data: `artifacts/bot-simulation-report.json`.

## Remaining Balance Work

- The audit harness intentionally stops at 120 seconds; only 8.3% of four-health matches reached one survivor before that cap.
- Completed-match wins are too sparse to infer champion balance. Dragon and Frost control tools currently convert pressure most reliably.
- Multi-bot short-term tile reservation and opponent fuse bait prediction remain future work.
- The simulation executes simplified gameplay-equivalent specials; Phaser VFX and action timing are verified in browser rather than headlessly.
