// Loads every JSON data file, the asset manifest and all Tiled maps (resolving external .tsj tilesets).
// Everything the game knows about content comes from here; nothing is hard-coded in game code.

const DATA_FILES = [
  'world', 'weapons', 'spells', 'items', 'armor', 'enemies', 'bosses', 'shops', 'teachers', 'smiths', 'dialogue', 'sounds', 'music',
];

export const DB = {
  world: null,
  assets: null,
  weapons: {},
  spells: {},
  items: {},
  enemies: {},
  bosses: {},
  shops: {},
  teachers: {},
  dialogue: {},
  armor: {},
  smiths: {},
  sounds: {},
  music: {},
  /** mapId -> Tiled JSON (with tilesets embedded) */
  maps: {},
  /** tileset name -> image URL, to be loaded as texture `tileset:<name>` */
  tilesetImages: {},
};

const base = () => new URL('./', document.baseURI);

async function fetchJSON(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Could not load ${url} (${res.status})`);
  try {
    return await res.json();
  } catch (e) {
    throw new Error(`${url} is not valid JSON: ${e.message}`);
  }
}

async function loadMap(id, file) {
  const mapUrl = new URL(file, base());
  const map = await fetchJSON(mapUrl);
  map.tilesets = await Promise.all(
    map.tilesets.map(async (ts) => {
      let full = ts;
      let imageBase = mapUrl;
      if (ts.source) {
        const tsUrl = new URL(ts.source, mapUrl);
        full = { ...(await fetchJSON(tsUrl)), firstgid: ts.firstgid };
        imageBase = tsUrl;
      }
      if (!full.image) throw new Error(`Map ${id}: tileset "${full.name}" must be a single-image tileset.`);
      const imgUrl = new URL(full.image, imageBase).href;
      const existing = DB.tilesetImages[full.name];
      if (existing && existing !== imgUrl) {
        console.warn(`Two different tilesets are both named "${full.name}" - give them unique names in Tiled.`);
      }
      DB.tilesetImages[full.name] = imgUrl;
      return full;
    }),
  );
  DB.maps[id] = map;
}

export async function loadDatabase(onProgress = () => {}) {
  DB.assets = await fetchJSON(new URL('assets.json', base()));
  let done = 0;
  await Promise.all(
    DATA_FILES.map(async (name) => {
      DB[name] = await fetchJSON(new URL(`data/${name}.json`, base()));
      onProgress(++done / DATA_FILES.length / 2);
    }),
  );
  const entries = Object.entries(DB.world.maps);
  done = 0;
  await Promise.all(
    entries.map(async ([id, def]) => {
      await loadMap(id, def.file);
      onProgress(0.5 + ++done / entries.length / 2);
    }),
  );
  return DB;
}

/** Look up a content entry or throw a helpful error naming the file. */
export function get(table, id) {
  const entry = DB[table][id];
  if (!entry) throw new Error(`Unknown ${table} id "${id}" (check public/data/${table}.json)`);
  return entry;
}
