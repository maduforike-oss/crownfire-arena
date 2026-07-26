# Crownfire Arena - Image Integration Report

This pass used the supplied images as product evidence and art direction. Two new project-bound generated atlases were created from those references:

- `public/assets/art/reference-arena-atlas.png`
- `public/assets/art/reference-character-power-atlas.png`

The original generated concept sheet remains in:

- `public/assets/art/crownfire-concept-sheet.png`

## Image 1 - Choose Champion UI Screenshot

Used in:
- `src/game/scenes/CharacterSelectScene.ts`
- `src/game/ui/MenuButton.ts`

Benefit:
- Preserved the strong two-column champion list, high-contrast gold selection frame, and compact stat hierarchy.
- The character select screen now uses the character/power reference atlas behind the cards so the designs read as part of the world instead of isolated UI boxes.

## Image 2 - Classic Trial Gameplay Screenshot

Used in:
- `src/game/scenes/GameScene.ts`

Benefit:
- Identified the key bug: board background objects were drawn above gameplay containers.
- Fixed with explicit render depths so floor tiles, walls, destructible blocks, champions, bombs, power-ups, and blast previews are visible.

## Image 3 - Crown Shard Hunt Gameplay Screenshot

Used in:
- `src/game/scenes/GameScene.ts`
- `src/game/ui/HUD.ts`

Benefit:
- Confirmed the same invisible-board issue across modes.
- Kept the compact top HUD but made the playfield layer stack deterministic so mode objectives and gameplay are visible together.

## Image 4 - Hollowmoon Sanctuary Board

Used in:
- `src/game/config/Maps.ts`
- `src/game/scenes/PreloadScene.ts`
- `src/game/scenes/MapSelectScene.ts`
- `src/game/scenes/GameScene.ts`

Benefit:
- Added a new playable map: `Hollowmoon Sanctuary`.
- Introduced mystic purple arena styling, spirit-lit walls, purple destructible block accents, and haunted map preview art.

## Image 5 - Ember Dominion Faction Sheet

Used in:
- `src/game/scenes/PreloadScene.ts`
- `src/game/scenes/GameScene.ts`

Benefit:
- Informed the Dragon-Blood Heir’s ember silhouette accents, Dragonflame visual pulse, fire-colored bomb/blast feedback, and Ashen Courtyard palette.

## Image 6 - Moonfang Wilds Faction Sheet

Used in:
- `src/game/scenes/PreloadScene.ts`
- `src/game/config/Maps.ts`

Benefit:
- Informed the Wolfbound Ranger token, moon-blue rim effects, Moonfang Ruins palette, and wolf-themed map identity.

## Image 7 - Veilborne Court Faction Sheet

Used in:
- `src/game/scenes/PreloadScene.ts`
- `src/game/scenes/GameScene.ts`
- `src/game/config/Maps.ts`

Benefit:
- Informed the Veil Witch token, Ghost Veil pulse/readability, purple spirit UI language, and Hollowmoon Sanctuary styling.

## Image 8 - Ashen Courtyard Board

Used in:
- `src/game/config/Maps.ts`
- `src/game/scenes/MapSelectScene.ts`
- `src/game/scenes/GameScene.ts`

Benefit:
- Strengthened the Ashen Courtyard board language with ember cracks, copper glow, block ember chips, and side-panel arena mood.

## Image 9 - Moonfang Ruins Board

Used in:
- `src/game/config/Maps.ts`
- `src/game/scenes/MapSelectScene.ts`
- `src/game/scenes/GameScene.ts`

Benefit:
- Strengthened Moonfang Ruins with moonlit blue ambience, cool stone floors, glowing blue wall/pillar accents, and map identity preview.

## Image 10 - Frost Crown Keep Board

Used in:
- `src/game/config/Maps.ts`
- `src/game/scenes/MapSelectScene.ts`
- `src/game/scenes/GameScene.ts`

Benefit:
- Strengthened Frost Crown Keep with ice-blue glow, frosted destructible block markings, cold board preview, and frost blast readability.

## Image 11 - Power-Up Sheet: Core Five

Used in:
- `src/game/scenes/PreloadScene.ts`
- `src/game/config/PowerUps.ts`

Benefit:
- Informed the icon language for Ember Rune, Twin Sigil, Wolf Sprint, Stoneguard Blessing, and Dragonflame Core.
- These are now sharper, more icon-like generated textures rather than plain circles.

## Image 12 - Power-Up Sheet: Advanced Five

Used in:
- `src/game/scenes/PreloadScene.ts`
- `src/game/config/PowerUps.ts`

Benefit:
- Informed Ghost Veil, Frost Snare, Raven Blink, Beast Call, and Remote Hex icon styling.
- The character/power atlas is also visible as character-select ambience so the power-up identity is part of the game’s UI language.

## Mechanical Improvements From The Reference Pass

- Fixed the hidden arena layer bug.
- Added Hollowmoon Sanctuary as a fourth playable map.
- Added map-specific visual accents for ember, moon, frost, and veil themes.
- Added persistent bomb fuse labels and blast danger previews.
- Added readable champion markers, names, health pips, and class-specific special pulses.
- Added stronger bot tactical behavior in `AIController.ts`.
