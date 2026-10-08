# Pocket Quest

A GBA-style, top-down action-adventure dungeon crawler for the browser, built with **Phaser 3** and **Vite**.
It runs at the GBA's native **240×160** resolution, scaled up with crisp pixels. You can play it on a phone with
on-screen retro controls, or on a desktop with a keyboard or gamepad. It installs as a **PWA** and works offline.

Nearly everything is **data-driven**:
- Weapons, spells, tools, items, armour, enemies, bosses, shops, teachers, blacksmiths, dialogue, quests, cutscenes, credits, sound effects, music and the world layout are JSON files.
- Maps are **Tiled** maps.
- Art is listed in a single asset manifest.

You can add content without touching game code.

---

## Contents

1. [Quick start](#quick-start)
2. [Controls](#controls)
3. [Testing on your phone](#testing-on-your-phone)
4. [Installing as an app (PWA) and offline play](#installing-as-an-app-pwa-and-offline-play)
5. [Project layout](#project-layout)
6. [Adding your sprites](#adding-your-sprites)
7. [Sound and music](#sound-and-music)
8. [Building maps in Tiled](#building-maps-in-tiled) (objects, puzzles, dark rooms)
9. [Adding content](#adding-content) (weapons, spells, tools, armour, enemies, bosses, shops, smiths, dialogue, quests, cutscenes)
10. [Adding a new town or dungeon](#adding-a-new-town-or-dungeon)
11. [Checking your data: `npm run validate`](#checking-your-data)
12. [Settings, options menu and control mapping](#settings-options-menu-and-control-mapping)
13. [What's in the game so far](#whats-in-the-game-so-far)

---

## Quick start

You need [Node.js](https://nodejs.org) 18 or newer.

```bash
npm install
npm run dev        # dev server with hot reload, also reachable from your LAN
```

Open the `Local:` URL it prints (usually http://localhost:5173).

| Command | What it does |
|---|---|
| `npm run dev` | Development server (LAN-visible) |
| `npm run build` | Production build into `dist/` (includes the service worker for offline play) |
| `npm run preview` | Serve the production build (also LAN-visible, port 4173) |
| `npm run validate` | Check all data files and maps for typos and broken references |
| `npm run placeholders` | Re-create the placeholder tileset and icons if you deleted them |

> **Note:** After editing a JSON data file or a map, reload the page. Code changes hot-reload by themselves.

---

## Controls

All input methods drive the same virtual buttons. You can remap keyboard and gamepad in **Options**; the defaults live in `src/config/input.config.js`.

| Button | Action | Keyboard | Gamepad (standard layout) |
|---|---|---|---|
| D-pad | Move (8 directions) / menus | Arrows or WASD | D-pad or left stick |
| **A** | Attack / talk / open / confirm. **Hold after a swing to charge** a spin attack (or piercing shot) | J, Z or Space | A (bottom) |
| **B** | Use equipped spell or tool (bombs, hookshot) / back | K or X | X (left) or B (right) |
| **LB** | Cycle weapon / previous tab | Q or U | LB or LT |
| **RB** | Cycle spell or tool / next tab | E or I | RB or RT |
| **Start** | Pause menu (items, weapons, spells, armour, quests, save, options) | Enter, Esc or P | Start / Menu |
| **Select** | Map screen | Tab, Right Shift or M | Back / View |

To push a block, walk into it for a moment.

**Touch controls** appear automatically on phones and tablets:
- **Landscape:** D-pad on the left, A/B on the right, L/R in the top corners, Select/Start bottom center.
- **Portrait:** the screen sits on top with the controls below, like a Game Boy.
- **Multi-touch:** you can hold a direction and press A at the same time.
- **Sliding:** your thumb can slide across the D-pad, including diagonals, and slide from B onto A.
- **No accidental gestures:** pinch-zoom, scrolling, text selection and long-press menus are blocked. Notches and safe areas are respected.
- **Auto-hide:** the controls hide when you use a keyboard or gamepad, and come back on the next touch.
- **Customising:** Options lets you resize the buttons, drag them anywhere (saved separately for portrait and landscape) and turn vibration on or off.

---

## Testing on your phone

1. Connect your computer and phone to the **same Wi-Fi network**.
2. Run `npm run dev`. Vite prints something like:
   ```
   ➜  Local:   http://localhost:5173/
   ➜  Network: http://192.168.1.23:5173/
   ```
3. On your phone, open the **Network** URL in Chrome (Android) or Safari (iOS).
4. Tap the **⛶** button between Select and Start for fullscreen (Android). On iOS, use *Add to Home Screen* (below).
5. Sound starts after your first tap (a browser rule).

**If the phone can't connect:**
- Allow Node through your computer's firewall. On Windows, allow it on **Private networks** when prompted.
- Some guest or office networks block devices from talking to each other ("client isolation"). Try a home network or your phone's hotspot.
- Make sure you're using the `Network` address, not `localhost`.

---

## Installing as an app (PWA) and offline play

The game ships a web-app manifest (fullscreen, with icons) and a service worker that precaches **everything**: code, art, maps and data. Once it's installed, it runs with no connection.

- **Desktop:** `npm run build && npm run preview`, open http://localhost:4173, then use the install icon in the address bar.
- **Phone:** browsers only enable service workers (offline mode and a true "install") on **HTTPS** or `localhost`. A plain `http://192.168.x.x` LAN address is fine for *playing and testing*, but not for installing. To install on your phone, use either of these:
  - **Deploy** the `dist/` folder to any static host with HTTPS, such as GitHub Pages, Netlify, Cloudflare Pages or itch.io. It uses relative paths, so it works from a sub-folder.
  - **Tunnel** your local preview over HTTPS, e.g. `npx cloudflared tunnel --url http://localhost:4173`.

  Then **Android Chrome:** ⋮ → *Install app*. **iOS Safari:** Share → *Add to Home Screen*.

The service worker only exists in production builds (`build`/`preview`), so it never caches stale files while you're developing.

---

## Project layout

```
├── index.html                 Page shell + on-screen controls markup
├── vite.config.js             LAN dev server, PWA manifest + offline caching
├── pocketquest.tiled-project  Open this in Tiled (object types with their properties)
├── public/                    Served as-is (edit without rebuilding)
│   ├── assets.json            THE asset manifest (sprites, images, fonts, audio)
│   ├── assets/                Your art: sprites/, tilesets/, backgrounds/, audio/ ...
│   ├── maps/                  Tiled maps (.tmj)
│   └── data/                  Game content (JSON)
│       ├── world.json         Maps, regions, starting position, new-game stats, levelling curve
│       ├── weapons.json  spells.json  tools.json  items.json  armor.json
│       ├── quests.json  cutscenes.json  credits.json
│       ├── enemies.json  bosses.json
│       ├── shops.json  teachers.json  smiths.json  dialogue.json
│       └── sounds.json  music.json   (synthesized sound effects + chiptune music)
├── src/
│   ├── main.js                Boots Phaser, input, touch controls, audio, settings
│   ├── config/
│   │   ├── game.config.js     Resolution, scaling, player speed, i-frames, text speed, save slots
│   │   └── input.config.js    Default control mapping (keyboard, gamepad, touch, actions)
│   ├── input/                 InputManager (single input layer + rebinding), TouchControls (+ layout editor)
│   ├── scenes/                Boot, Title, World, HUD, UI (dialogue/cards), Pause, Shop, Map, Options
│   ├── entities/              Actor, Player, Enemy, Boss, Props (NPC, chest, gate, door, switch, block, pot, torch...)
│   ├── systems/               db, assets, Combat, GameState (saves/levels/quests), Audio, Lighting,
│   │                          Tools (bombs/hookshot), Cutscenes, Particles
│   └── ui/                    Pixel font, panels, list menus
├── tools/                     validate-data, placeholder art generator, starter-map generator
└── docs/sprite-templates/     Placeholder sheets exported as PNG templates
```

---

## Adding your sprites

Every texture the game uses is listed in **`public/assets.json`**. Each entry has `"file": null` and a
`placeholder` description. To use your art:

1. Put the PNG somewhere under `public/assets/`, e.g. `public/assets/sprites/player.png`.
2. Set `"file": "assets/sprites/player.png"` on that entry (paths are relative to `public/`).
3. Reload. That's it: no code changes.

If a file is missing or fails to load, the game logs a warning and falls back to the placeholder, so it never crashes over art.

### Character sheets (player, NPCs, enemies)

**Frames are 16×16.** The sheet is a grid with **one row per facing direction** and **one column per frame**:

![Character layout](docs/sprite-templates/character-layout-guide.png)

| | Columns |
|---|---|
| **Rows (top → bottom)** | **0 = down** (facing the camera), **1 = left**, **2 = right**, **3 = up** (back) |
| **Column 0** | `idle`: 1 frame |
| **Columns 1-4** | `walk`: 4 frames, 8 fps, loops |
| **Columns 5-6** | `attack`: 2 frames, 12 fps, plays once (also used when casting and winding up) |
| **Column 7** | `hurt`: 1 frame (shown during knockback and stun) |

So a standard character sheet is **128×64 px** (8 columns × 4 rows of 16×16).
The file `docs/sprite-templates/player.png` is a ready-made template at the exact size: paint over it.

You can export any sprite's current sheet (placeholder or yours) from the running game. Open the browser console and run `__exportSprite('knight')`.

**Bosses** (`boss_warden`, `boss_sorcerer`) use the `boss` layout: the same columns and rows, but with **32×32** frames (a **256×128** sheet).

Character sprite keys:
- **Player:** `player`
- **NPCs:** `npc_elder`, `npc_merchant`, `npc_mage`, `npc_healer`, `npc_kid`, `npc_guard`, `npc_smith`, `npc_villager`, `npc_scholar`
- **More NPCs:** `npc_farmer`, `npc_explorer`, `npc_monk`
- **Enemies:** `slime`, `skeleton`, `bat`, `knight`, `wisp`, `spider`, `ice_slime`, `yeti`, `frost_wisp`
- **Bosses:** `boss_warden`, `boss_sorcerer`, `boss_wyrm`

**Changing the layout:** the layouts live at the top of `assets.json` under `"layouts"`. You can change them, add your own, or override anything for a single sprite:

```jsonc
"bat": {
  "layout": "character",
  "file": "assets/sprites/bat.png",
  "frameWidth": 16, "frameHeight": 16,           // override the layout's frame size
  "directions": ["down", "right", "up"],          // no "left" row → right is mirrored automatically
  "animations": { "walk": { "column": 1, "frames": 2, "fps": 10 } },  // override one animation
  "body": { "width": 10, "height": 8 }            // collision box at the feet (optional)
}
```

- `directions` lists the rows in order. Leave out `"left"` to save drawing: the game flips the `right` row.
- Each animation is `{ "column": firstColumn, "frames": count, "fps": speed, "repeat": -1 }`. Use `repeat: 0` to play once.
- `body` is the physics box, sitting bottom-centred in the frame. Add `offsetX`/`offsetY` to position it manually.

### Single images

The entries under `"images"` are single PNGs. Suggested sizes match the placeholders:

| Key(s) | Size | Used for |
|---|---|---|
| `arrow`, `bone`, `spark`, `venom` | 6×2 / 6×6 | Projectiles (draw them pointing **right**; they get rotated) |
| `fireball`, `rock`, `shadowball` | 8×8 / 10×10 | Spell and boss projectiles |
| `coin`, `heart`, `mana` | 7×7 | Drops |
| `chest_closed`, `chest_open`, `sign`, `pot`, `block` | 16×16 | Props |
| `gate`, `door_locked`, `door_boss` | 16×16 | Barriers (tiled to fill their rectangle) |
| `switch_up`, `switch_down`, `crystal_off`, `crystal_on` | 16×16 | Floor switch / pressure plate, crystal switch |
| `torch_off`, `torch_on` | 16×16 | Torches |
| `bomb`, `snowball`, `icicle` | 10×10 / 8×8 / 6×6 | Bombs and ice projectiles |
| `cracked_wall`, `hook_post` | 16×16 | Bombable wall, hookshot post |
| `shadow` | 12×4 | Soft shadow under characters |
| `icon_*` | 12×12 (`icon_key` 8×8) | HUD and menu icons for weapons, spells, items and armour |

Any new key you add here can be referenced from data files (e.g. a new weapon's `icon` or projectile `sprite`).

### Tilesets

Tilesets aren't in `assets.json`. They come straight from your Tiled maps: any tileset image a map uses is loaded automatically.
Use **16×16 tiles**, with no margin or spacing.

### Font (optional)

A crisp, hand-drawn pixel font is built in. To use your own, export a BMFont (`.fnt`/`.xml` plus `.png`) and add it to `assets.json`:

```json
"fonts": { "pixel": { "image": "assets/fonts/myfont.png", "data": "assets/fonts/myfont.xml" } }
```

---

## Sound and music

The game has full sound **without any audio files**: effects and music are synthesized live by `src/systems/Audio.js` from two data files.

- **`public/data/sounds.json`** holds the sound effects (`swing`, `hit`, `hurt`, `chest`, `levelUp`, `bossRoar`, …):
  - **Tones:** `{ "wave": "square", "freq": [start, end], "dur": 0.1, "vol": 0.2 }`. `wave` can be `square`, `triangle`, `sawtooth` or `sine`.
  - **Noise:** set `"wave": "noise"`; `freq` is then a filter sweep.
  - **Jingles:** `{ "notes": ["C5", "E5", "G5"], "step": 0.08, "wave": "square" }`.
- **`public/data/music.json`** holds the chiptune tracks (`title`, `town`, `town2`, `interior`, `dungeon`, `dark`, `boss`). Each channel is a string of 8th-note steps:
  - a note like `C4`, `F#5` or `Bb3`
  - `-` holds the previous note
  - `.` is silence
  - on a `noise` channel, `x` is a hi-hat and `o` is a kick

**Using real audio files:** add them to `assets.json`, and they replace the synthesized versions automatically:

```json
"audio": {
  "music_town": { "file": "assets/audio/town.ogg" },
  "sfx_swing":  { "file": "assets/audio/swing.wav" }
}
```

**Which music plays where:**
- `music` on a map in `world.json`
- `music` on a boss (it starts when the fight starts)
- `titleMusic` in `world.json`

Volume is set in Options.

---

## Building maps in Tiled

Install [Tiled](https://www.mapeditor.org) (1.10 or newer) and open **`pocketquest.tiled-project`**
(*File → Open File or Project*). This registers every object type below, so each one shows the right properties.

`public/maps/` holds 18 starter maps:
- **Town 1** and its 3 interiors
- **Dungeon 1:** 4 rooms
- **Town 2** and its 3 interiors
- **The Shadow Crypt (Dungeon 2):** 5 rooms
- **Town 3** (a stub)

### Map rules

- **Orientation:** orthogonal. **Tile size:** 16×16. **Not infinite.**
- **Save format:** JSON (`.tmj`). Tilesets can be external (`.tsj`) or embedded; both work.
- **Tile layers:** the layer order decides what's drawn on top.

| Layer name | Purpose |
|---|---|
| `ground` | Floor. Drawn below everything. |
| `walls` | **Every tile on this layer is solid.** (Any layer whose name contains `wall`, `collision` or `block` works the same.) |
| `above` | Drawn **over** the player: tree canopies, roof edges, arch tops. (Or give any layer the bool property `above = true`.) |

You can also make individual tiles solid **on any layer**. Give them the bool property `collides = true` in the tileset editor. The placeholder tileset already does this for water, trees, walls, pits, lava and furniture.

Two more tile properties:
- **`low = true`:** solid to walk on, but arrows, spells and the **hookshot** fly over it. Pits, water, lava and frozen water use this.
- **`ice = true`:** slippery floor. The player slides with momentum.

A map smaller than the screen (240×160 px) is centred automatically, which is how the 10×8-tile interiors are drawn.

### Objects

Add an **Object Layer** and set each object's **Class** (called *Type* in older Tiled). Use **point** objects (or 16×16 rectangles) for things, and real rectangles for areas.

**People and places**

| Class | Shape | Properties | What it does |
|---|---|---|---|
| `spawn` | point | **Name**, `facing` | Where the player appears when arriving by warp. |
| `warp` | rectangle | `map`, `spawn`, `facing` | Walking into it moves the player to another map. Doors into houses are warps. |
| `npc` | point | `sprite`, `dialogue`, `facing`, `wander`, `ifFlag`, `ifNotFlag`, `cutscene` | A person you can talk to. `ifFlag` / `ifNotFlag` make them appear or disappear with story flags. With `cutscene`, talking to them plays that cutscene (once). |
| `shop` | point | `sprite`, `shop` | Shopkeeper (weapons, armour, items, spells). You can talk across a counter. |
| `teacher` | point | `sprite`, `teacher` | Spell teacher. |
| `smith` | point | `sprite`, `smith` | Blacksmith; upgrades the player's weapons. |
| `healer` | point | `sprite`, `dialogue`, `price` | Restores HP/MP, cures poison, sets the respawn point and **saves**. |
| `sign` | point | `text` (`\n` for a line break) | Readable sign. |

**Treasure and enemies**

| Class | Shape | Properties | What it does |
|---|---|---|---|
| `chest` | point | `weapon`, `spell`, `tool`, `item` + `count`, `armor`, `gold`, `maxHp`, `maxMp`, `flag`, `ifFlag` | Treasure chest. `flag` is set when it's opened. With `ifFlag`, the chest only appears once that flag is set (e.g. a puzzle reward). |
| `item` | point | `item`, `count` | An item lying on the floor (e.g. a key); picked up by walking over it. |
| `pot` | point | `drop` (`random` / `gold` / `heart` / `mana` / `none`), `item` | Breaks when hit; drops something. |
| `crack` | rectangle | `text` | Cracked wall: solid until a **bomb** blasts it (stays open, saved). |
| `hook` | point | | Hook post: the **hookshot** latches on and pulls you to it, even across pits and water. |
| `trigger` | rectangle | `cutscene` | Plays a cutscene when the player walks in. |
| `enemy` | point | `enemy` | Spawns an enemy each time the room loads. |
| `boss` | point | `boss` | Spawns the boss until it is beaten. |

**Barriers and puzzles**

| Class | Shape | Properties | What it does |
|---|---|---|---|
| `gate` | rectangle | `flag`, `invert`, `mode`, `text` | Solid bars. <br>• With `flag`: opens when the flag is set. <br>• `"a,b"` needs every listed flag. <br>• `invert = true`: open until the flag is set. <br>• `mode = boss`: shuts during the room's boss fight. |
| `door` | rectangle | `lock` (item, default `small_key`), `consume`, `text` | Locked door. Press A with the key item to open it, and it stays open. Use `lock = boss_key` for the boss door. |
| `switch` | point | `flag`, `mode` | `floor`: step on it once and it stays down. <br>`plate`: only down while the player or a block stands on it. <br>`crystal`: hit it with a weapon or spell to toggle its flag. |
| `block` | point | `once` | Pushable block. Walk into it to slide it one tile. It resets when you leave the room. |
| `torch` | point | `flag`, `lit`, `radius` | Light it with fire (any spell with `"element": "fire"`) to set its flag. It lights up dark rooms. |
| `light` | point | `radius`, `flicker` | A light source for dark rooms (braziers, lava glow…). |

**Story flags** are the glue between all of these:
- Chests, switches, torches and boss rewards **set** flags.
- Gates, `ifFlag` objects and dialogue variants **read** them.
- Flags are saved with the game. Pressure-plate flags are the exception: they only count while something stands on the plate.

### Dark rooms

Add `"darkness": 0.85` (0 to 1) to a map's entry in `world.json`, or add it as a Tiled map property. The room goes dark, and light shows only around:
- the player
- lit torches and `light` objects
- glowing projectiles (`"light": 24` on a projectile)
- enemies or bosses with a `"light"` value

### Connecting maps

1. Put a `spawn` named e.g. `south` just inside an entrance in map **B**.
2. In map **A**, draw a `warp` rectangle over the exit with `map = B`, `spawn = south`.
3. Do the same in reverse to come back. Keep spawn points **outside** warp rectangles.
4. Run `npm run validate`. It checks that every warp points to a real map and spawn.

`tools/gen-maps.mjs` is the script that generated the starter maps. You don't need it. It won't overwrite existing maps unless you pass `--force`, which would erase your Tiled edits.

---

## Adding content

All content lives in `public/data/`. Ids (the JSON keys) are what maps and other files refer to.
After editing, run `npm run validate`, then reload the game.

### Weapons — `weapons.json`

```jsonc
"sword": {
  "name": "Sword", "description": "Quick, short swing.", "icon": "icon_sword",
  "shape": "arc",          // arc (wide swing) | thrust (narrow poke) | projectile
  "damage": 3,
  "cooldownMs": 280,       // time between attacks (speed)
  "range": 14,             // reach in px
  "width": 20,             // hitbox width across the swing
  "activeMs": 110,         // how long the hitbox stays active
  "lockMs": 160,           // how long the player can't move after attacking
  "knockback": 150,
  "color": "#f8f8f8",      // swing effect colour
  "sfx": "swing",          // sound from sounds.json
  "charge": { "timeMs": 650, "damageMul": 2, "radius": 24 },   // hold A: spin attack
  "upgrades": [ { "price": 40, "damage": 1 }, { "price": 90, "damage": 1, "cooldownMs": -30 } ],
  "price": 30
}
```

- **Projectile weapons:** set `"shape": "projectile"` and add `"projectile": { "sprite", "speed", "range", "size", "pierce", "light" }`. For these, `charge` fires a stronger, piercing shot (`"pierce": true`).
- **Upgrades:** each entry is one blacksmith level. Its numbers are *added* to the weapon (damage, range, cooldownMs…), and `price` is the cost. The weapon then shows as "Sword +1".
- **Status effects:** any weapon can carry an `"effect"` (see [Status effects](#status-effects)).

### Spells — `spells.json`

| `type` | Extra fields |
|---|---|
| `projectile` | `damage`, `knockback`, `projectile: { sprite, speed, range, size, pierce, light }` |
| `area` | `damage`, `radius`, `knockback`, `color` |
| `heal` | `amount` |

Every spell has `name`, `description`, `icon`, `mpCost`, `cooldownMs` and `sfx`. It can also have:
- `effect`: a status effect on hit
- `element`: `"fire"` lights torches

Ways to get spells:
- `newGame.spells`
- a spell teacher
- a chest with `spell` (works as a scroll)
- a boss `reward.spell`

### Tools — `tools.json`

Tools share the **B** button with spells (cycle with RB) and are found or bought like weapons.

```json
"bombs":    { "name": "Bombs", "icon": "icon_bomb", "type": "bomb", "ammo": "bomb", "startAmmo": 5,
              "cooldownMs": 500, "fuseMs": 1500, "radius": 30, "damage": 8, "selfDamage": 2 },
"hookshot": { "name": "Hookshot", "icon": "icon_hookshot", "type": "hookshot",
              "cooldownMs": 400, "range": 128, "speed": 280, "damage": 1, "effect": { "stun": { "durationMs": 1400 } } }
```

**Bombs:**
- Each use costs one `ammo` item (buy more in shops: `{ "item": "bomb", "count": 5, "price": 20 }`).
- `startAmmo` is given once, with the tool.
- The blast hurts enemies, and **you** if you stand too close. It breaks pots, lights torches and opens `crack` walls.

**Hookshot:**
- Latches onto `hook` posts and pulls you to them, flying over pits and water.
- Stuns enemies, breaks pots and grabs items.

Where tools come from:
- a chest with `tool`
- a shop entry `{ "tool": "bombs", "price": 80 }`
- a boss `reward.tool`
- `newGame.spells`

### Quests — `quests.json`

```json
"slime_trouble": {
  "name": "Slime Trouble", "giver": "Farmer, Town 1",
  "description": "Slimes keep eating the farmer's crops. Defeat 6 slimes.",
  "goals": [ { "text": "Defeat slimes", "kills": { "slime": 6 } } ],
  "reward": { "gold": 40, "item": "potion", "count": 2 }
}
```

**Goals:** a goal can be one of these:
- `{ "kills": { "enemyId": n } }`: only kills after the quest starts count.
- `{ "item": "id", "count": n }`: goal items are taken away on turn-in unless `"takeItems": false`.
- `{ "flag": "name" }`.

**Starting and finishing:** quests start and finish through dialogue. Put `"startQuest": "id"` on the entry or variant that offers the quest, and `"completeQuest": "id"` on a variant that checks `{"questReady": "id"}`. The farmer in `dialogue.json` is a full example:

```json
"farmer": { "pages": ["Could you defeat 6 slimes?"], "startQuest": "slime_trouble",
  "variants": [
    { "if": { "questDone": "slime_trouble" },   "pages": ["Thank you, hero!"] },
    { "if": { "questReady": "slime_trouble" },  "pages": ["You did it!"], "completeQuest": "slime_trouble" },
    { "if": { "questActive": "slime_trouble" }, "pages": ["Still slimes out there..."] } ] }
```

**Quest log:**
- Pause → **Quests** lists active and finished quests with their progress.
- A message pops up when a quest is ready to turn in.
- Dialogue conditions can also use `questActive`, `questReady`, `questDone` and `questNotStarted`.

### Cutscenes — `cutscenes.json`

Little scripted scenes where characters walk, talk and the camera pans, all written in data:

```json
"town3_arrival": { "if": {}, "once": true, "steps": [
  { "emote": "Guard", "icon": "!" },
  { "move": "Guard", "to": [13, 11], "speed": 70 },
  { "face": "Guard", "toward": "player" },
  { "say": ["Welcome to Town 3, friend."], "speaker": "Guard" },
  { "camera": [13, 3], "ms": 800 },
  { "say": ["Up north is the Frost Cavern..."], "speaker": "Guard" },
  { "camera": "player", "ms": 600 },
  { "move": "Guard", "to": [15, 7] }
] }
```

- **Actors:** `"player"` or an NPC's **Name** from Tiled.
- **Positions:** given in **tiles**.

| Step | Effect |
|---|---|
| `say` (+ `speaker`) | Dialogue box |
| `ask`, `options`, `flags` | Yes/no style choice. Sets the flag at the chosen index. |
| `move`, `to`, `speed`, `wait: false` | Walk an actor to a tile |
| `face` + `dir` or `toward` | Turn an actor |
| `emote` + `icon` | Speech bubble ("!", "?") |
| `camera: [x, y]` / `camera: "player"` (+ `ms`) | Pan the camera, then follow the player again |
| `wait`, `shake`, `flash`, `fade` | Timing and screen effects |
| `sfx`, `music` | Sound |
| `flag`, `give`, `startQuest` | Story |
| `hide`, `show` | Make an NPC disappear or reappear |
| `warp: { map, spawn }` | Change map |
| `credits: true` | Roll the credits (`credits.json`) |

**Triggers:**
- a `trigger` rectangle in Tiled
- `cutscene` on an NPC
- `"onEnter": "id"` on a map in `world.json` (used for the intro)
- `"cutscene": "id"` on a boss (plays after its defeat; the Frost Wyrm uses this for the ending)

**Rules:**
- A cutscene only plays when its `if` conditions match.
- It plays once unless `"once": false`.

### Status effects

Use these in any `effect` (weapons, spells, enemy projectiles, boss attacks) or an enemy's `contactEffect`:

```json
{ "slow": 0.4, "durationMs": 3000 }            // 40% slower (icy blue tint)
{ "poison": { "dps": 1, "durationMs": 4000 } } // damage over time (green)
{ "burn":   { "dps": 2, "durationMs": 2000 } } // damage over time (orange)
{ "stun":   { "durationMs": 1500 } }           // can't move or act (bosses ignore it unless "stunnable": true)
```

Immunities:
- **Enemies and bosses:** `"resist": ["poison", "stun", ...]`.
- **The player:** armour with a `resist` list, e.g. Warden Plate.

Curing:
- an item with `"use": { "cure": ["poison"] }` (Antidote)
- resting at a healer

### Items — `items.json`

```json
"potion":   { "name": "Potion", "description": "Restores 10 HP.", "icon": "icon_potion", "use": { "hp": 10 }, "price": 10 },
"antidote": { "name": "Antidote", "use": { "cure": ["poison", "burn"] } },
"small_key":{ "name": "Small Key", "key": true }
```

`use` can restore `hp` and/or `mp` and `cure` effects. Items with `"key": true` (keys, maps) can't be used from the menu.

### Armour — `armor.json`

```json
"chain": { "name": "Chain Mail", "description": "...", "icon": "icon_chain", "defense": 2, "speedMul": 0.92, "resist": ["poison"], "price": 220 }
```

- `defense` is subtracted from every hit the player takes (minimum 1 damage).
- `speedMul` changes walking speed.
- Equip armour in Pause → Armor.

Ways to get armour:
- shop stock `{ "armor": "chain", "price": 220 }`
- a chest with `armor`
- a boss `reward.armor`
- `newGame.armor`

### Levels and XP — `world.json` → `leveling`

```json
"leveling": { "xpBase": 12, "xpGrowth": 1.45, "maxLevel": 30, "perLevel": { "maxHp": 2, "maxMp": 1, "attack": 0.34 } }
```

**How XP works:**
- Enemies and bosses give `"xp"` when defeated.
- Levelling up raises max HP and MP, adds `attack` per level (rounded down, added to every weapon), and fully heals.
- A "LEVEL UP!" screen celebrates each level.

### Enemies — `enemies.json`

```jsonc
"knight": {
  "name": "Shield Knight", "sprite": "knight", "hp": 14, "contactDamage": 3, "speed": 18, "xp": 8,
  "shield": { "arcDeg": 110 },          // blocks melee + projectiles from the front; area magic gets through
  "contactEffect": null,                // e.g. spiders: { "poison": { "dps": 1, "durationMs": 4000 } }
  "resist": [],
  "light": 0,                           // glow in dark rooms
  "ai": {
    "idle": "wander",                   // wander | flutter | stand
    "sightRange": 80, "loseRange": 130,
    "onSight": "chase",                 // chase | keepDistance | charge | teleport | none
    "chaseSpeed": 24,
    "preferredDistance": 56,            // keepDistance
    "charge":   { "windupMs": 450, "speed": 140, "durationMs": 380, "restMs": 650 },
    "teleport": { "cooldownMs": 2800, "minDist": 44, "maxDist": 76 },
    "dash":     { "range": 38, "windupMs": 420, "speed": 150, "durationMs": 240, "cooldownMs": 2200 },  // lunge when close
    "attack": { "type": "projectile", "cooldownMs": 1600, "windupMs": 350, "count": 1, "spreadDeg": 15, "sfx": "bow",
                "projectile": { "sprite": "bone", "speed": 95, "range": 160, "damage": 2, "size": [6, 6], "effect": null, "light": 0 } }
  },
  "drops": [ { "type": "gold", "amount": [2, 5], "chance": 0.8 }, { "type": "item", "item": "antidote", "chance": 0.1 } ]
}
```

Drop types are `gold`, `heart` (+4 HP), `mana` (+3 MP) and `item`. Enemies blink before they attack.

### Bosses — `bosses.json`

A boss has these fields:
- `name` and `title` (shown on the intro card)
- `sprite`, `hp`, `contactDamage`, `speed`
- `restMs` (pause between attacks)
- `xp`, `light`, `music`, `resist`
- `phases`, `patterns` and `reward`

```json
"phases": [
  { "hpBelow": 1.0, "patterns": ["teleport", "aimed", "walk", "radial"] },
  { "hpBelow": 0.5, "message": "The Sorcerer's shadow splits!", "tint": "#c078f8", "speedMul": 1.3,
    "patterns": ["teleport", "aimed_fast", "radial_poison", "summon_spiders", "nova"] }
]
```

**How a fight runs:**
- Entering the room starts a letterboxed intro card with the boss name and title.
- The boss loops through the current phase's patterns.
- When its HP falls to a phase's `hpBelow`, it switches phase: it shows the message, takes on the tint, roars, shakes the screen and gets faster.

| Pattern `type` | Fields |
|---|---|
| `chase` | `durationMs` |
| `charge` | `windupMs`, `speed`, `durationMs` (stops on walls) |
| `area` | `windupMs` (warning circle), `radius`, `damage`, `knockback`, `color`, `effect`, `sfx` |
| `radial` | `windupMs`, `count`, `waves`, `waveDelayMs`, `projectile` (a ring; alternate waves are offset) |
| `aimed` | `windupMs`, `count`, `spreadDeg`, `waves`, `waveDelayMs`, `projectile` (a fan aimed at the player) |
| `summon` | `windupMs`, `enemy`, `count`, `max` |
| `teleport` | `fadeMs`, `hideMs`, `minDist`, `maxDist` (vanishes and reappears near the player) |
| `rain` | `windupMs`, `count`, `radius`, `spread`, `damage`, `effect` (warning circles around the player, then strikes) |

`reward` accepts `weapon`, `spell`, `tool`, `item` + `count`, `armor`, `gold`, `maxHp`, `maxMp`, `flag` and `message`. Add `"cutscene": "id"` to a boss to play a scene after it falls.
Beating a boss also sets the flag `boss:<id>`. Use the reward `flag` on `gate`s to open the road to the next town.

### Shops, teachers and blacksmiths

```json
// shops.json: stock entries can be weapon, armor, tool, item (+ count) or spell
"town2_shop": { "name": "Crypt Outfitters", "greeting": "...", "stock": [ { "armor": "chain", "price": 220 }, { "item": "antidote", "price": 8 } ] }
// teachers.json
"town2_teacher": { "name": "Librarian", "greeting": "...", "spells": [ { "spell": "shock", "price": 140 } ] }
// smiths.json: upgrades come from each weapon's "upgrades" list
"town2_smith": { "name": "Blacksmith", "greeting": "Bring me your weapons and some gold..." }
```

### Dialogue — `dialogue.json`

```json
"town2_kid": {
  "speaker": "Kid",
  "pages": ["Keys open locked doors.", "The BIG key opens the boss door!"],
  "setFlag": "talked_to_kid",
  "give": { "item": "potion", "count": 1 }, "giveFlag": "gift_town2_kid",
  "variants": [ { "if": { "flag": "dungeon2_cleared" }, "pages": ["You did it!"] } ]
}
```

- The first variant whose `if` matches is used.
- Conditions: `flag`, `notFlag`, `hasWeapon`, `hasSpell`, `hasItem`, `minGold`, `minLevel`, `visited`, `questActive`, `questReady`, `questDone`, `questNotStarted`.
- `startQuest` / `completeQuest`: see Quests above.
- `give` hands over a one-time reward.

---

## Adding a new town or dungeon

The world is a chain: **town → dungeon → boss → gate opens → next town**. The world map (Select → World) shows it from `world.json` → `regions`.

1. **Build the maps in Tiled** and save them to `public/maps/`.
2. **Register them** in `public/data/world.json` → `maps`:
   ```json
   "dungeon3_1":    { "file": "maps/dungeon3_1.tmj", "name": "Ice Cave", "kind": "dungeon", "region": "dungeon3", "music": "dungeon", "grid": [1, 2] },
   "dungeon3_boss": { "file": "maps/dungeon3_boss.tmj", "name": "Frozen Throne", "kind": "dungeon", "region": "dungeon3", "music": "dark", "grid": [1, 0], "boss": true, "darkness": 0.5 }
   ```
   - `name` appears in a banner when you enter an area with a different name.
   - `region` groups maps for the map screen.
   - `grid` is the room's `[column, row]` on the dungeon map.
   - `boss: true` marks the boss room on the map.
3. **Add the region** to `world.json` → `regions`, in story order: `{ "id": "dungeon3", "name": "Ice Cave", "kind": "dungeon", "boss": "frost" }`.
4. **Connect the maps** with `warp` + `spawn` objects. The dungeon map draws lines between rooms from these warps.
5. **Add puzzles:**
   - a chest with `item: dungeon_map` and `flag: map:dungeon3` (reveals the whole map)
   - keys in chests, with `door`s to match
   - switches and blocks that open `gate`s
6. **Add the boss** to `bosses.json`, with a reward `flag` such as `"dungeon3_cleared"`.
7. **Lock the way forward** with a `gate` whose `flag` is `dungeon3_cleared`. Add a `gate` with `mode: boss` at the boss room entrance.
8. **Fill the next town** with NPCs, a shop, a teacher, a smith and a healer.
9. Run `npm run validate`.

---

## Checking your data

```bash
npm run validate
```

This checks every JSON file, `assets.json` and every map for:
- invalid JSON
- unknown ids (weapons, armour, enemies, dialogue, shops, smiths…)
- missing files
- warps pointing to maps or spawns that don't exist
- unknown boss patterns
- bad music notes
- switches without flags, locked doors with unknown keys
- infinite maps

If something fails to load in the game itself, the error is also shown on screen.

---

## Settings, options menu and control mapping

**Options** (title screen, or Pause → System → Options) is saved on the device:
- **Sound:** music volume and sound-effect volume.
- **Text:** dialogue text speed (slow, normal, fast).
- **Touch:** vibration on/off, touch button size (70–150%), and **Move touch buttons**: drag each group anywhere, tap Done. Positions are saved separately for portrait and landscape.
- **Keyboard and gamepad controls:** pick a button, then press the new key or gamepad button. *Reset to defaults* is always there.

**Defaults for developers:**
- **`src/config/input.config.js`:** the default key and gamepad mapping, touch dead zone and diagonal angle, and the **action → button** mapping (`attack: 'A'`, `cast: 'B'`, …).
- **`src/config/game.config.js`:**
  - resolution and integer scaling
  - player speed, invincibility time, knockback, MP regeneration, interaction reach
  - text speed and save slots
  - `debugPhysics: true` shows hitboxes

**Saves** go to `localStorage` on the device. There are 3 slots, picked on the title screen.
- **Where to save:** at a healer or inn, or anywhere from Pause → System → Save.
- **What's saved:** level, XP, gear, upgrades, keys, flags and visited rooms.
- **Old saves:** they load fine; missing fields get defaults (`migrate()` in `src/systems/GameState.js`).

**Debugging in the browser console:**
- `__game` is the Phaser game instance.
- `__game.scene.getScene('World').goTo('dungeon2_2', 'south')` teleports you.
- `__exportSprite('player')` downloads a sheet template.
- `__audio.sfx('levelUp')` plays a sound effect.
- `__state` is the save data and helpers, e.g. `__state.s.gold = 999` or `__state.addSpell('hookshot')`.

---

## What's in the game so far

**Milestone 3**
- **Tools on the B button:**
  - **Bombs:** blast enemies and cracked walls; buy more ammo in shops.
  - **Hookshot:** latch onto posts across pits and water; stuns enemies and grabs items.
- **Ice floors** you slide on, and **"low" tiles** (pits, water, lava) that projectiles and the hookshot fly over.
- **Quests** with a quest log (Pause → Quests), kill and collect goals, and "ready to turn in" alerts:
  - *Slime Trouble* (Town 1)
  - *The Lost Ring* (Town 2)
  - *Frozen Supplies* and *Yeti Hunt* (Town 3)
- **Data-driven cutscenes:** characters walk, emote and talk; the camera pans. They're used for:
  - the opening scene in Town 1
  - the arrival in Town 3
  - the ending after the third boss, which rolls the **credits**
- **Town 3:** a snowy town with an inn, a bomb shop, a snow monk teaching **Blizzard**, a hidden cracked-wall cache, and quest givers.
- **Frost Cavern (Dungeon 3):** 5 icy rooms with slippery floors, cracked walls, the **Hookshot**, a frozen river and a chasm crossed by hook posts, a Big Key and Frost Herbs.
- **The Frost Wyrm:** a third boss with icicle breath, ice-spike **rain**, charges, summons and a frost nova. Town 4 is stubbed beyond it.
- **New enemies:** Ice Slimes (slow you on touch), Yetis (snowballs and charges) and Frost Wisps (teleport and fire icicle fans).
- **New gear:** Fur Coat (immune to slow).
- **Particles:** dust when walking, hit sparks, fire from bombs, ice when sliding, healing and coins.

**Milestone 1**
- Touch, keyboard and gamepad controls through one input layer.
- Town 1 and Dungeon 1 (4 rooms, slimes, skeleton archers, cave bats).
- The **Stone Warden** boss.
- 4 weapons, 3 spells, shops, a spell teacher, a healer and 3 save slots.
- Installable PWA with offline play.

**Milestone 2**
- **Sound:** synthesized chiptune music for every area and the boss fights, with sound effects for everything. Any of it can be replaced with your own audio files.
- **Map screen (Select):**
  - a room-by-room dungeon map (visited rooms, plus every room once you find the dungeon map)
  - a key counter
  - a world overview of the town and dungeon chain
- **Dungeon puzzles:** small keys and locked doors, a Big Key boss door, floor switches, pressure plates, pushable blocks, crystal switches that flip gates, torches you light with fire, breakable pots and hidden chests.
- **Building interiors:** a healer's house, a shop and a magic school in Town 1; an inn, a shop and a library in Town 2.
- **Town 2:** an autumn town with an inn, an armour shop, a library (Venom Dart, Thunder), an outdoor **blacksmith**, and NPCs with hints.
- **The Shadow Crypt (Dungeon 2):** 5 dark rooms with a torch gate, a block-and-plate puzzle, a locked door, a crystal-switch room with the Big Key, and a secret chest.
- **The Shade Sorcerer:** a second boss with teleports, aimed fans, poison rings, summons and a phase-2 nova. It drops the **Storm Wand**. Town 3 is stubbed beyond it.
- **New enemies:**
  - **Shield Knights:** block from the front and lunge when you're close.
  - **Shadow Wisps:** teleport near you, then fire glowing orbs.
  - **Crypt Spiders:** poison on touch, dash attacks and venom spit.
- **Status effects:** poison, burn, stun and slow, with immunities, antidotes, and a status line in the HUD.
- **Progression:**
  - XP and levels with a LEVEL UP screen
  - armour (defence, speed, poison immunity) and an Armor tab in the pause menu
  - blacksmith weapon upgrades (+1 to +3)
  - **charge attacks**: hold A for a spin attack, or a piercing shot with the bow and wand
- **Screen effects:**
  - darkness with dynamic light around the player, torches, braziers and glowing projectiles
  - a cinematic boss intro card
  - victory flash, screen shake, and the level-up celebration
- **Options menu:** volumes, text speed, vibration, touch button size and position, and keyboard and gamepad rebinding.
