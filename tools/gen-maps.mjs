// Generates the towns and their interiors as plain Tiled JSON (.tmj) files in public/maps/.
// (Dungeons come from tools/gen-dungeons.mjs.) After that they're ordinary Tiled maps: open and
// edit them in Tiled. This script will NOT overwrite an existing map unless you pass --force
// (which would throw away your Tiled edits!).
//
//   node tools/gen-maps.mjs [--force]
import { t, makeRng, interior, exitTo, townBase, house, save } from './maplib.mjs';

const rand = makeRng(42);

// ====================================================================================== TOWN 1
{
  const W = 30;
  const H = 20;
  const m = townBase(W, H, t.grass, t.tree);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rand() < 0.07) m.set('ground', x, y, t.flowers);
  // paths + plaza
  m.fill('ground', 1, 10, W - 2, 1, t.dirt);
  m.fill('ground', 14, 4, 1, 15, t.dirt);
  m.fill('ground', 11, 8, 7, 5, t.plaza);
  m.fill('ground', 15, 4, 11, 1, t.dirt);

  // Healer's house (left)
  const healer = house(m, 3, 3, 5, 5);
  m.fill('ground', 5, 7, 1, 3, t.dirt);
  m.area('warp', 'to_healer', healer.x, healer.y, 1, 1, { map: 'town1_healer', spawn: 'entrance' });
  m.point('spawn', 'from_healer', 5, 7.5, { facing: 'down' });

  // Shop (top middle-right)
  m.fill('walls', 17, 1, 5, 2, t.roof);
  m.fill('walls', 17, 3, 5, 1, t.houseWall);
  m.set('walls', 19, 3, null);
  m.set('ground', 19, 3, t.door);
  m.area('warp', 'to_shop', 19, 3, 1, 1, { map: 'town1_shop', spawn: 'entrance' });
  m.point('spawn', 'from_shop', 19, 5, { facing: 'down' });
  m.point('sign', 'Sign', 16, 3.5, { text: 'SHOP\\nWeapons, armor and potions.' });

  // Spell teacher's house (bottom right)
  m.fill('walls', 20, 12, 6, 2, t.roof);
  m.fill('walls', 20, 14, 6, 2, t.houseWall);
  m.set('walls', 23, 15, null);
  m.set('ground', 23, 15, t.door);
  m.fill('ground', 15, 16, 9, 1, t.dirt);
  m.area('warp', 'to_magic', 23, 15, 1, 1, { map: 'town1_magic', spawn: 'entrance' });
  m.point('spawn', 'from_magic', 23, 16.6, { facing: 'down' });
  m.point('sign', 'Sign', 26, 16, { text: 'MAGIC SCHOOL\\nSpells taught here.' });

  // Pond with fence (bottom left)
  m.fill('ground', 3, 13, 6, 4, t.water);
  m.fill('walls', 2, 12, 8, 1, t.fence);
  m.fill('walls', 2, 17, 8, 1, t.fence);

  for (const [x, y] of [[9, 3], [10, 3], [26, 8], [27, 8], [11, 15], [12, 17], [2, 9]]) m.set('walls', x, y, t.bush);
  m.set('walls', 9, 13, t.tree);
  m.set('above', 9, 12, t.treeTop);

  // Dungeon entrance: a stone outcrop with stairs (top right)
  m.fill('walls', 23, 1, 5, 3, t.wall);
  m.fill('walls', 23, 1, 5, 1, t.wallTop);
  m.set('walls', 25, 3, null);
  m.set('ground', 25, 3, t.stairsDown);
  m.fill('ground', 25, 4, 1, 6, t.dirt);

  m.point('spawn', 'start', 14, 13);
  m.point('spawn', 'from_dungeon', 25, 5, { facing: 'down' });
  m.area('warp', 'to_dungeon', 25, 3, 1, 1, { map: 'dungeon1_1', spawn: 'entrance' });

  m.point('npc', 'Elder', 13, 9, { sprite: 'npc_elder', dialogue: 'elder', facing: 'down' });
  m.point('npc', 'Kid', 17, 12, { sprite: 'npc_kid', dialogue: 'kid', wander: true });
  m.point('npc', 'Villager', 7, 8, { sprite: 'npc_villager', dialogue: 'villager1', facing: 'down' });
  m.point('npc', 'Farmer', 20, 9, { sprite: 'npc_farmer', dialogue: 'farmer', facing: 'down' });
  m.point('sign', 'Sign', 24, 5, { text: 'MOSSY CATACOMBS\\nThe first seal. Nobody has ever come out the other side.' });
  m.point('sign', 'Sign', 15, 9, { text: 'BRIGHTWATER\\nNorth-east: Mossy Catacombs\\nWest: Healer   North: Shop' });
  m.point('chest', 'Chest', 28, 18, { gold: 15 });
  m.point('pot', 'Pot', 1, 1, {});
  m.point('pot', 'Pot', 2, 1, {});
  save('town1', m);
}

// ---------------------------------------------------------------------------------- Town 1 interiors
{
  const m = interior(10, 8, 5, { windows: [2, 7] });
  exitTo(m, 5, 'town1', 'from_healer');
  m.set('walls', 1, 2, t.bed);
  m.set('walls', 1, 4, t.bed);
  m.set('walls', 8, 2, t.bed);
  m.set('walls', 8, 4, t.shelf);
  m.fill('ground', 3, 3, 4, 3, t.carpet);
  m.point('healer', 'Healer', 5, 2.6, { sprite: 'npc_healer', dialogue: 'healer', facing: 'down' });
  save('town1_healer', m);
}
{
  const m = interior(10, 8, 5, { floor: t.checker, windows: [7] });
  exitTo(m, 5, 'town1', 'from_shop');
  m.fill('walls', 1, 3, 8, 1, t.counter);
  m.set('walls', 1, 2, t.barrel);
  m.set('walls', 8, 2, t.shelf);
  m.set('walls', 2, 1, t.shelf);
  m.point('shop', 'Merchant', 4.5, 2.4, { sprite: 'npc_merchant', shop: 'town1_shop', facing: 'down' });
  m.point('pot', 'Pot', 1, 6, {});
  save('town1_shop', m);
}
{
  const m = interior(10, 8, 5, { windows: [] });
  exitTo(m, 5, 'town1', 'from_magic');
  m.fill('walls', 1, 1, 8, 1, t.shelf);
  m.fill('ground', 3, 3, 4, 3, t.carpet);
  m.set('walls', 1, 4, t.table);
  m.set('walls', 8, 4, t.table);
  m.point('teacher', 'Mage', 4.5, 2.6, { sprite: 'npc_mage', teacher: 'town1_teacher', facing: 'down' });
  save('town1_magic', m);
}

// ====================================================================================== TOWN 2
{
  const W = 26;
  const H = 18;
  const m = townBase(W, H, t.autumnGrass, t.autumnTree, { bottom: [12, 13] });
  m.fill('ground', 12, 4, 2, 14, t.dirt);
  m.fill('ground', 2, 9, 22, 1, t.dirt);
  m.fill('ground', 9, 7, 8, 5, t.plaza);
  m.set('walls', 16, 7, t.fountain);
  // North: the crypt entrance
  m.fill('walls', 10, 1, 6, 3, t.stoneWall);
  m.fill('walls', 10, 1, 6, 1, t.stoneTop);
  m.set('walls', 13, 3, null);
  m.set('ground', 13, 3, t.stairsDown);
  m.area('warp', 'to_crypt', 13, 3, 1, 1, { map: 'dungeon2_1', spawn: 'entrance' });
  m.point('spawn', 'from_dungeon', 13, 5, { facing: 'down' });
  m.point('sign', 'Sign', 15, 4.5, { text: 'THE SHADOW CRYPT\\nBring fire. The dark devours the unprepared.' });
  // South: road back to Dungeon 1
  m.area('warp', 'to_dungeon1', 12, H - 1, 2, 1, { map: 'dungeon1_boss', spawn: 'north' });
  m.point('spawn', 'south', 12.5, 15.5, { facing: 'up' });
  // Inn (healer)
  const inn = house(m, 2, 2, 6, 4);
  m.area('warp', 'to_inn', inn.x, inn.y, 1, 1, { map: 'town2_inn', spawn: 'entrance' });
  m.point('spawn', 'from_inn', 4, 6.6, { facing: 'down' });
  m.point('sign', 'Sign', 7, 6.5, { text: 'INN\\nRest and save.' });
  // Shop
  const shop = house(m, 18, 2, 6, 20);
  m.area('warp', 'to_shop', shop.x, shop.y, 1, 1, { map: 'town2_shop', spawn: 'entrance' });
  m.point('spawn', 'from_shop', 20, 6.6, { facing: 'down' });
  // Library (spell teacher)
  const lib = house(m, 2, 11, 6, 5);
  m.area('warp', 'to_library', lib.x, lib.y, 1, 1, { map: 'town2_library', spawn: 'entrance' });
  m.point('spawn', 'from_library', 5, 15.6, { facing: 'down' });
  m.point('sign', 'Sign', 8, 15, { text: 'LIBRARY\\nAdvanced spells.' });
  // Blacksmith (outdoors)
  m.fill('ground', 18, 11, 6, 4, t.plaza);
  m.set('walls', 20, 12, t.anvil);
  m.set('walls', 23, 11, t.barrel);
  m.set('walls', 18, 11, t.barrel);
  m.point('smith', 'Smith', 21, 12, { sprite: 'npc_smith', smith: 'town2_smith', facing: 'down' });
  m.point('sign', 'Sign', 19, 14, { text: 'BLACKSMITH\\nWeapon upgrades.' });
  // Decoration
  for (const [x, y] of [[9, 3], [17, 3], [24, 9], [1, 9]]) m.set('walls', x, y, t.cactus);
  m.set('walls', 1, 9, null);
  // People
  m.point('npc', 'Guard', 14, 5.5, { sprite: 'npc_guard', dialogue: 'town2_guard', facing: 'down' });
  m.point('npc', 'Scholar', 10, 8, { sprite: 'npc_scholar', dialogue: 'scholar', facing: 'down' });
  m.point('npc', 'Villager', 15, 11, { sprite: 'npc_villager', dialogue: 'town2_villager', wander: true });
  m.point('npc', 'Kid', 7, 10, { sprite: 'npc_kid', dialogue: 'town2_kid', wander: true });
  m.point('chest', 'Chest', 24, 16, { item: 'antidote', count: 2 });
  m.point('pot', 'Pot', 1, 16, {});
  m.point('pot', 'Pot', 24, 1, {});
  save('town2', m);
}
{
  const m = interior(10, 8, 4, { windows: [2, 7] });
  exitTo(m, 4, 'town2', 'from_inn');
  m.fill('walls', 6, 2, 1, 1, t.bed);
  m.set('walls', 8, 2, t.bed);
  m.set('walls', 8, 4, t.bed);
  m.set('walls', 1, 2, t.table);
  m.point('healer', 'Innkeeper', 3.5, 2.6, { sprite: 'npc_healer', dialogue: 'innkeeper', facing: 'down' });
  m.point('npc', 'Traveler', 7, 5, { sprite: 'npc_villager', dialogue: 'traveler', facing: 'left' });
  save('town2_inn', m);
}
{
  const m = interior(10, 8, 5, { floor: t.checker, windows: [2] });
  exitTo(m, 5, 'town2', 'from_shop');
  m.fill('walls', 1, 3, 8, 1, t.counter);
  m.set('walls', 8, 2, t.barrel);
  m.set('walls', 1, 2, t.shelf);
  m.point('shop', 'Merchant', 4.5, 2.4, { sprite: 'npc_merchant', shop: 'town2_shop', facing: 'down' });
  save('town2_shop', m);
}
{
  const m = interior(10, 8, 5, { windows: [] });
  exitTo(m, 5, 'town2', 'from_library');
  m.fill('walls', 1, 1, 8, 1, t.shelf);
  m.set('walls', 1, 3, t.shelf);
  m.set('walls', 8, 3, t.shelf);
  m.set('walls', 1, 5, t.table);
  m.fill('ground', 3, 3, 4, 3, t.carpet);
  m.point('teacher', 'Librarian', 4.5, 2.6, { sprite: 'npc_scholar', teacher: 'town2_teacher', facing: 'down' });
  save('town2_library', m);
}

// ====================================================================================== TOWN 3 (snow)
{
  const W = 26;
  const H = 18;
  const m = townBase(W, H, t.snow, t.snowTree, { bottom: [12, 13] });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rand() < 0.06) m.set('ground', x, y, t.ice);
  m.fill('ground', 12, 4, 2, 14, t.dirt);
  m.fill('ground', 2, 9, 22, 1, t.dirt);
  m.fill('ground', 9, 7, 8, 5, t.plaza);
  // North: Frost Cavern entrance
  m.fill('walls', 10, 1, 6, 3, t.iceWall);
  m.fill('walls', 10, 1, 6, 1, t.iceTop);
  m.set('walls', 13, 3, null);
  m.set('ground', 13, 3, t.stairsDown);
  m.area('warp', 'to_cavern', 13, 3, 1, 1, { map: 'dungeon3_1', spawn: 'entrance' });
  m.point('spawn', 'from_dungeon', 13, 5, { facing: 'down' });
  m.point('sign', 'Sign', 15, 4.5, { text: 'FROST CAVERN\\nThe ice is slippery. Watch your step!' });
  // South: road back to the Shadow Crypt
  m.area('warp', 'to_crypt', 12, H - 1, 2, 1, { map: 'dungeon2_boss', spawn: 'north' });
  m.point('spawn', 'south', 12.5, 15.5, { facing: 'up' });
  // Inn
  const inn = house(m, 2, 2, 6, 4);
  m.area('warp', 'to_inn', inn.x, inn.y, 1, 1, { map: 'town3_inn', spawn: 'entrance' });
  m.point('spawn', 'from_inn', 4, 6.6, { facing: 'down' });
  m.point('sign', 'Sign', 7, 6.5, { text: 'INN' });
  // Shop
  const shop = house(m, 18, 2, 6, 20);
  m.area('warp', 'to_shop', shop.x, shop.y, 1, 1, { map: 'town3_shop', spawn: 'entrance' });
  m.point('spawn', 'from_shop', 20, 6.6, { facing: 'down' });
  m.point('sign', 'Sign', 23, 6.5, { text: 'GENERAL STORE\\nBomb refills and warm coats.' });
  // Shrine (outdoor spell teacher)
  m.fill('ground', 2, 11, 6, 4, t.plaza);
  m.set('walls', 2, 11, t.pillar);
  m.set('walls', 7, 11, t.pillar);
  m.point('teacher', 'Monk', 4.5, 12, { sprite: 'npc_monk', teacher: 'town3_teacher', facing: 'down' });
  m.point('light', 'Light', 4.5, 12, { radius: 30 });
  // Cracked wall hiding a little secret (needs bombs)
  m.fill('walls', 19, 12, 5, 4, t.iceWall);
  m.fill('walls', 19, 12, 5, 1, t.iceTop);
  m.fill('walls', 20, 13, 3, 2, null);
  m.fill('ground', 20, 13, 3, 2, t.ice);
  m.set('walls', 21, 15, null);
  m.area('crack', 'Crack', 21, 15, 1, 1, { text: 'The ice wall is cracked. A bomb might do it.' });
  m.point('chest', 'Secret', 21, 13.5, { gold: 60, item: 'bomb', count: 3 });
  // People
  m.point('npc', 'Guard', 15, 7.5, { sprite: 'npc_guard', dialogue: 'town3_guard', facing: 'down' });
  m.point('npc', 'Explorer', 10, 8, { sprite: 'npc_explorer', dialogue: 'explorer', facing: 'down' });
  m.point('npc', 'Hunter', 17, 11, { sprite: 'npc_farmer', dialogue: 'hunter', facing: 'left' });
  m.point('npc', 'Kid', 8, 10, { sprite: 'npc_kid', dialogue: 'town3_kid', wander: true });
  m.area('trigger', 'Arrival', 11, 13, 4, 2, { cutscene: 'town3_arrival' });
  m.point('pot', 'Pot', 1, 1, {});
  m.point('pot', 'Pot', 24, 16, {});
  save('town3', m);
}
{
  const m = interior(10, 8, 4, { windows: [2, 7] });
  exitTo(m, 4, 'town3', 'from_inn');
  m.set('walls', 7, 2, t.bed);
  m.set('walls', 8, 2, t.bed);
  m.set('walls', 8, 4, t.bed);
  m.set('walls', 1, 2, t.barrel);
  m.point('healer', 'Innkeeper', 3.5, 2.6, { sprite: 'npc_healer', dialogue: 'innkeeper', facing: 'down' });
  save('town3_inn', m);
}
{
  const m = interior(10, 8, 5, { floor: t.checker, windows: [2] });
  exitTo(m, 5, 'town3', 'from_shop');
  m.fill('walls', 1, 3, 8, 1, t.counter);
  m.set('walls', 8, 2, t.barrel);
  m.set('walls', 1, 2, t.barrel);
  m.point('shop', 'Merchant', 4.5, 2.4, { sprite: 'npc_merchant', shop: 'town3_shop', facing: 'down' });
  save('town3_shop', m);
}

// ====================================================================================== TOWN 4: Sunspire
{
  const W = 28;
  const H = 20;
  const m = townBase(W, H, t.sand, t.stoneWall, { bottom: [13, 14] });
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (rand() < 0.05) m.set('ground', x, y, t.dirt);
  m.fill('ground', 13, 4, 2, 16, t.plaza);
  m.fill('ground', 2, 10, 24, 1, t.plaza);
  m.fill('ground', 9, 8, 10, 5, t.plaza);
  m.set('walls', 11, 9, t.fountain);
  m.set('walls', 16, 9, t.fountain);
  // North: the Hollow Spire
  m.fill('walls', 10, 1, 8, 3, t.stoneWall);
  m.fill('walls', 10, 1, 8, 1, t.stoneTop);
  m.set('walls', 13, 3, null);
  m.set('ground', 13, 3, t.stairsDown);
  m.set('walls', 14, 3, null);
  m.set('ground', 14, 3, t.stairsDown);
  m.area('warp', 'to_spire', 13, 3, 2, 1, { map: 'dungeon4_1', spawn: 'entrance' });
  m.point('spawn', 'from_dungeon', 13.5, 5, { facing: 'down' });
  m.point('sign', 'Sign', 16, 4.5, { text: 'THE HOLLOW SPIRE\\nThe last seal. The King waits at the top.' });
  for (const x of [9, 18]) {
    m.set('walls', x, 4, t.pillar);
    m.point('torch', 'Torch', x, 5, { lit: true });
  }
  // South: the road from Frostholm
  m.area('warp', 'to_cavern', 13, H - 1, 2, 1, { map: 'dungeon3_boss', spawn: 'north' });
  m.point('spawn', 'south', 13.5, H - 3, { facing: 'up' });
  // Inn
  const inn = house(m, 2, 2, 6, 4);
  m.area('warp', 'to_inn', inn.x, inn.y, 1, 1, { map: 'town4_inn', spawn: 'entrance' });
  m.point('spawn', 'from_inn', 4, 6.6, { facing: 'down' });
  m.point('sign', 'Sign', 7, 6.5, { text: 'INN\\nRest and save.' });
  // Bazaar
  const shop = house(m, 20, 2, 6, 22);
  m.area('warp', 'to_shop', shop.x, shop.y, 1, 1, { map: 'town4_shop', spawn: 'entrance' });
  m.point('spawn', 'from_shop', 22, 6.6, { facing: 'down' });
  m.point('sign', 'Sign', 25, 6.5, { text: 'BAZAAR' });
  // Temple of the Sun
  m.fill('walls', 2, 12, 8, 2, t.roof);
  m.fill('walls', 2, 14, 8, 2, t.houseWall);
  m.set('walls', 2, 14, t.pillar);
  m.set('walls', 9, 14, t.pillar);
  m.set('walls', 5, 15, null);
  m.set('ground', 5, 15, t.door);
  m.area('warp', 'to_temple', 5, 15, 1, 1, { map: 'town4_temple', spawn: 'entrance' });
  m.point('spawn', 'from_temple', 5, 16.6, { facing: 'down' });
  m.point('sign', 'Sign', 7, 16.5, { text: 'TEMPLE OF THE SUN\\nThe Sage awaits.' });
  // a little lava garden and market stalls
  m.fill('ground', 19, 13, 5, 3, t.lava);
  m.fill('walls', 18, 12, 7, 1, t.fence);
  m.fill('walls', 18, 16, 7, 1, t.fence);
  m.point('light', 'Glow', 21, 14, { radius: 40 });
  for (const [x, y] of [[1, 8], [26, 8], [8, 18], [20, 18], [3, 9], [24, 11]]) m.set('walls', x, y, t.cactus);
  for (const [x, y] of [[17, 7], [10, 7]]) m.set('walls', x, y, t.barrel);
  // people
  m.point('npc', 'Guard', 15.5, H - 4, { sprite: 'npc_guard', dialogue: 'town4_greeter', facing: 'down' });
  m.point('npc', 'Kid', 15, 11, { sprite: 'npc_kid', dialogue: 'town4_kid', wander: true });
  m.point('npc', 'Weaver', 8, 9, { sprite: 'npc_villager', dialogue: 'town4_lady', facing: 'down' });
  m.point('chest', 'Chest', 25.5, 17, { gold: 40 });
  m.point('pot', 'Pot', 1, 1, {});
  m.point('pot', 'Pot', 26, 1, {});
  m.point('pot', 'Pot', 1, 18, {});
  save('town4', m);
}
{
  const m = interior(10, 8, 4, { floor: t.carpet, windows: [2, 7] });
  exitTo(m, 4, 'town4', 'from_inn');
  m.set('walls', 7, 2, t.bed);
  m.set('walls', 8, 2, t.bed);
  m.set('walls', 8, 4, t.bed);
  m.set('walls', 1, 2, t.table);
  m.point('healer', 'Innkeeper', 3.5, 2.6, { sprite: 'npc_healer', dialogue: 'innkeeper', facing: 'down' });
  save('town4_inn', m);
}
{
  const m = interior(10, 8, 5, { floor: t.checker, windows: [2] });
  exitTo(m, 5, 'town4', 'from_shop');
  m.fill('walls', 1, 3, 8, 1, t.counter);
  m.set('walls', 8, 2, t.barrel);
  m.set('walls', 1, 2, t.shelf);
  m.point('shop', 'Merchant', 4.5, 2.4, { sprite: 'npc_merchant', shop: 'town4_shop', facing: 'down' });
  save('town4_shop', m);
}
{
  const m = interior(12, 9, 6, { floor: t.plaza, windows: [3, 8] });
  exitTo(m, 6, 'town4', 'from_temple');
  m.fill('ground', 5, 2, 3, 6, t.carpet);
  for (const [x, y] of [[2, 3], [9, 3], [2, 6], [9, 6]]) m.set('walls', x, y, t.pillar);
  m.point('npc', 'Sage', 6, 2.6, { sprite: 'npc_sage', dialogue: 'sage', facing: 'down' });
  m.point('light', 'Light', 6, 3, { radius: 40 });
  m.point('chest', 'Gift', 10, 7, { item: 'ether', count: 2 });
  save('town4_temple', m);
}

