# Modding guide: replacing placeholder art and sound

Everything you see and hear in *Isle of Brackwater* comes from a named **slot**. Each slot has a
procedural placeholder built in code. You can override any slot with your own file, and the game swaps
it in immediately, without a rebuild or restart.

## Three ways to add your files

1. **The Asset Workshop** (F10 in game, or *Asset Workshop* on the title screen). Drag files or whole
   folders onto the window, or use *Import files…* / *Import folder…*. Files are matched to slots by
   name and saved in your browser, so they come back every time you open `Play.html` in that browser.
   If you drop a single file whose name doesn't match a slot, it goes into the slot you have selected.
2. **A linked folder** (Chrome and Edge only). *Link folder (live)* watches a folder on your computer
   and re-imports any file you save there within about two seconds. Keep Blender open, export, and look
   at the game. Linked files are not copied into the browser; reconnect the folder next session.
3. **Baking into the build.** Put files in `assets/models`, `assets/textures`, `assets/icons` or
   `assets/audio` and run `npm run build`. They are embedded in `Play.html`, so anyone you send it to
   sees your art. Workshop overrides still win over baked files.

## Naming

Name each file after its slot id. The extension decides how it's read:

| Kind | Example | Formats |
| --- | --- | --- |
| Model | `mob_mudsnapper.glb` | `.glb` (recommended), `.gltf` (+ its `.bin` and textures in the same folder), `.fbx`, `.obj` |
| Extra animation | `char_player@walk.fbx` | `.glb`, `.gltf`, `.fbx`: the first clip in the file is used |
| Texture | `tex_grass.png` | `.png`, `.jpg`, `.webp` |
| Icon | `icon_minor_healing.png`, `icon_ab_firebolt.png` | `.png`, `.jpg`, `.webp` |
| Sound | `sfx_hit.ogg`, `music_explore.mp3`, `amb_waves.ogg` | `.ogg`, `.mp3`, `.wav`, `.m4a` |
| Settings | `mob_mudsnapper.json` | optional sidecar, see below |

The Workshop lists every slot with its id. *Download asset kit* gives you all the placeholders as files
(`models/*.glb`, `textures/*.png`, `icons/*.png`) plus `slots.json`, which lists every slot with its size
in meters and expected animation names.

## Model conventions

- **Units and axes**: meters, Y up, the model faces **+Z**. In Blender that's the default: the model faces
  the *Front* view (-Y), and the glTF exporter converts it to +Z.
- **Origin**: at the feet for characters and creatures, at the base for props, trees and buildings.
- **Size**: by default your model is scaled to match the placeholder's height (characters, creatures,
  props, nature) or footprint (buildings). Switch *Fit* to *Use model units* in the Workshop to keep your
  own scale. You can also nudge *Scale*, *Turn* and *Raise* there.
- **Materials**: anything three.js understands. glTF PBR materials (base color, normal, roughness,
  metalness, emissive) work best.
- **Buildings** keep the placeholder's collision. Match the footprint shown in the Workshop, keep doors
  facing +Z and doorways where the placeholder has them (the tavern, the Hall and Tobin's shop are enterable).
- **Vegetation and rocks** are drawn thousands of times, so keep them light (a few hundred to a few
  thousand triangles).

## Animation

Characters and creatures play these states:

| Name | Used for |
| --- | --- |
| `idle` | Standing still (required; the first clip is used if nothing is named idle) |
| `walk`, `run` | Moving. Playback speed follows movement speed |
| `attack` | Melee swings and ability strikes |
| `cast` | Spells and channeling |
| `hit` | Flinching when struck |
| `death` | Dying (holds the last frame) |
| `jump` | In the air |
| `swim` | Swimming |
| `sit` | Sitting (tavern patrons) |

Clip names are matched loosely: `Armature|Walking`, `mixamo.com|Run` and `Attack_01` all work. If the
automatic match is wrong, pick the clip for each state from the drop-downs in the Workshop.

**Mixamo workflow**: upload your character, download it once *With Skin* as `char_player.fbx`, then
download each animation *Without Skin* and name it `char_player@walk.fbx`, `char_player@attack.fbx` and
so on. Drop them all in together.

Models with no clips still move: the game bobs and tilts them as they walk and attack.

**Held items**: weapons attach to a bone or node whose name contains `RightHand`, `hand_r` or similar;
shields go on the left forearm. Weapon models should have the grip at the origin with the blade or shaft
pointing up (+Y).

## Textures

Terrain textures (`tex_grass`, `tex_sand`, `tex_rock`, `tex_mud`, `tex_ash`, `tex_path`) tile every
6 m and are blended by the terrain shader. Building textures (`tex_planks`, `tex_stone`, `tex_roof`,
`tex_plaster`, `tex_thatch`, `tex_wood_dark`) tile every 1.5 to 3 m. They should all tile seamlessly.
`tex_water_normal` is a tangent-space normal map (purple-blue) that animates the sea.

## Sidecar settings

A `<slot>.json` file next to a model sets its Workshop settings:

```json
{
  "fit": "height",
  "scale": 1.1,
  "rotY": 180,
  "offsetY": 0,
  "anims": { "attack": "Sword_Slash_02", "idle": "Idle_Breathing" }
}
```

`fit` is `height`, `bounds` (footprint) or `none` (use model units).

## Sound

`sfx_*` slots are short effects (mono works best). `music_explore`, `music_town`, `music_night`,
`music_combat` and `music_boss` loop while that mood is active and replace the generated score for that
mood only. `amb_waves` and `amb_wind` loop with volume driven by where you are.

## Changing content

Quests, dialogue, items, creatures, loot, NPCs and books live in plain JavaScript files in `src/data/`.
The island layout (zones, roads, building and spawn positions) is in `src/world/layout.js`. Run
`npm run dev` and refresh the browser after each save to see your changes.
