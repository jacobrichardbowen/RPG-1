# Isle of Brackwater

A 3D fantasy RPG vertical slice inspired by *The Elder Scrolls III: Morrowind* and *World of Warcraft*.
You arrive at a muddy fishing village on a remote island, a pardoned prisoner with no idea who wanted you free.

**To play, double-click `Play.html`.** It opens in your web browser and runs entirely offline.
Chrome, Edge or Firefox on a desktop or laptop with a keyboard and mouse is recommended.

## What's in the slice

- **An island to explore**: the village of Brackwater with its docks and prison ship, Snapper Strand,
  the giant mushrooms of Parasol Wood, the pools of Glowcap Fen, Wrecker's Cove, Lantern Point and the
  ruined Drowned Spire atop Vael's Tor. There's a full day/night cycle with two moons, and the windows,
  lanterns and glowcaps light up after dark.
- **Character creation**: four races (Westerling, Ashborn, Tuskari, Skarn), three classes (Warrior,
  Mage, Nightblade), plus your choice of appearance.
- **Nine quests** with a main thread, a murder mystery that ends in a choice (turn in the killer, or take
  his bribe), a rare elite crab, a bogling chieftain and a three-phase boss fight.
- **Morrowind-style conversation**: click underlined topics to ask about them and pick up new ones.
  Your journal is written in the first person, and there are readable books and letters.
- **WoW-style combat and HUD**: tab targeting, auto-attack, an action bar with cooldowns, cast bars,
  interrupts, telegraphed area attacks, loot with item quality colors, quest givers marked `!` and `?`,
  a minimap, a quest tracker and floating combat text.
- **RPG systems**: six levels, attribute points, 18 abilities, around 80 items, equipment that shows on
  your character, vendors, food and potions, saving and loading, and a daily shrine blessing.
- **Procedural audio**: generated sound effects, ambience (waves, wind, birds, frogs and crickets) and a
  generative score that changes between town, wilderness, night, combat and the boss fight.

## Controls

| Key | Action |
| --- | --- |
| W A S D | Move and strafe |
| Drag with the left mouse button | Look around |
| Drag with the right mouse button | Steer your character and the camera |
| Both mouse buttons | Run forward |
| Mouse wheel | Zoom (scroll all the way in for first person) |
| V | Toggle first person |
| T | Mouse-look mode with a crosshair (left-click attacks) |
| Space / Shift / R / Z | Jump / sprint / auto-run / walk |
| E or F | Talk, loot, open, gather |
| Left click / right click | Select target / attack, talk or use |
| Tab | Cycle enemy targets |
| 1 to 0 | Action bar |
| C, B (or I), J, P, M | Character, bags, journal, abilities, map |
| F10 | Asset Workshop |
| F5 / F9 | Quick save / quick load |
| Esc | Close the top window, clear your target, or open the menu |

Progress saves automatically every minute and when you quit. Saves are stored in your browser.

## Swapping in your own art

Every model, texture, icon and sound in the game is a named **slot** with a procedural placeholder.
Open the **Asset Workshop** (F10 in game, or from the title screen) to see them all.

1. Select a slot to preview the placeholder and see its expected size and animation names.
2. Click **Download placeholder .glb** (or **Download asset kit** for everything at once) to get a
   starting point at the right scale, then open it in Blender.
3. Export your model as `<slot id>.glb`, for example `mob_mudsnapper.glb`, and drop it onto the
   Workshop window. It swaps into the running game instantly and is remembered in your browser.

Details and conventions are in [MODDING.md](MODDING.md). The short version:

- **Models**: `.glb`, `.gltf`, `.fbx` or `.obj`. Y up, facing +Z (Blender's default front), with the feet
  or base at the origin. Size is fitted to the placeholder automatically.
- **Animations**: clips named `idle`, `walk`, `run`, `attack`, `cast`, `hit`, `death`, `jump`, `swim`
  or `sit`. You can also add one animation per file as `char_player@walk.fbx`, which suits Mixamo.
- **Textures**: `tex_grass.png`, `tex_planks.jpg` and so on. Tiling images, any size.
- **Icons**: `icon_<item>.png` and `icon_ab_<ability>.png`.
- **Sounds and music**: `sfx_hit.ogg`, `music_town.mp3`, `amb_waves.ogg` and so on.
- **Folders**: drop a whole folder at once, or (in Chrome or Edge) use **Link folder (live)**, which
  re-imports files whenever you save them, so you can keep Blender open and watch changes appear in game.

### Baking your art into Play.html

To share a build with your art inside it, put your files in `assets/models`, `assets/textures`,
`assets/icons` or `assets/audio` and rebuild (requires [Node.js](https://nodejs.org)):

```sh
npm install
npm run build      # writes Play.html (and dist/artifact.html)
```

Baked assets load first; anything added in the Workshop still overrides them.

## Working on the code

The game is plain JavaScript on [three.js](https://threejs.org), bundled with esbuild into one HTML file.

```sh
npm install
npm run dev        # rebuilds Play.html whenever a source file changes; refresh the browser to see it
npm run build      # one-off minified build
```

| Path | What lives there |
| --- | --- |
| `src/data/` | Quests, dialogue, items, loot, creatures, classes and abilities, NPCs and books. Most content edits happen here. |
| `src/world/layout.js` | Where everything on the island is: zones, roads, buildings, spawns, herbs, chests. |
| `src/world/` | Terrain generation, water, sky and day/night, vegetation, collision. |
| `src/assets/` | The asset registry, slot list, procedural placeholders and the Asset Workshop. |
| `src/entities/` | Player, NPCs, creatures (AI), animation, interactable objects. |
| `src/game/` | Combat, abilities, quests, dialogue engine, character sheet, audio, effects and the main game loop. |
| `src/ui/` | HUD, windows, menus, tooltips, map and icons. |
| `src/styles/` | CSS for the interface. |
| `tools/build.mjs` | The build script. |

## Credits

- Built with [three.js](https://threejs.org) (MIT) and [esbuild](https://esbuild.github.io) (MIT).
- Fonts: *IM Fell English* and *IM Fell English SC* by Igino Marini, and *Alegreya Sans* by Huerta Tipográfica,
  all under the SIL Open Font License, embedded in the build.
- All placeholder art, sound and music are generated in code.
