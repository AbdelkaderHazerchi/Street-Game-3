/**
 * Where people are, and how many.
 *
 * The city is not uniformly busy, and a crowd spread evenly over the whole map
 * looks wrong twice over: the suburbs feel packed, and the centre - the one
 * place that should be shoulder to shoulder - feels abandoned. Real footfall
 * follows where the shops and offices are.
 *
 * `js/map/mapData.json` already carves the city into named districts
 * (Vinewood Hills, Downtown, Midtown, the Docks, ...), so nothing new has to be
 * authored: weight each district by its palette and read the answer per tile.
 *
 * Density is expressed directly as **people per CELL x CELL tile square**, which
 * is the unit the simulation can then enforce cheaply:
 *
 *     hills / suburbs / airport   1 per 4x4     sparse, residential
 *     docks / industrial / beach  2 per 4x4     working, some footfall
 *     market / midtown            3 per 4x4     busy
 *     downtown                    4 per 4x4     packed
 *
 * `js/ai/pedestrians.js` counts what is already standing in each cell and refuses
 * to exceed the cap, so the gradient holds at every population size rather than
 * only in aggregate.
 *
 * The district table is cached; `invalidateDensity()` drops it, and is called
 * alongside `invalidateNavGrid()` whenever a map is (re)loaded.
 */

import { CFG } from "../core/config.js?v=57";
import { LS_ZONES } from "../map/mapData.js?v=57";
import { isSidewalkTile } from "./navGrid.js?v=57";

/** Edge length, in tiles, of the square one density figure refers to. */
export const CELL = 4;

export const MIN_WEIGHT = 1;
export const MAX_WEIGHT = 4;

// Palette -> people per CELL x CELL. See the table above.
const PALETTE_WEIGHT = {
  downtown: MAX_WEIGHT,
  midtown: 3,
  market: 3,
  docks: 2,
  industrial: 2,
  beach: 2,
  hills: MIN_WEIGHT,
  suburb: MIN_WEIGHT,
  airport: MIN_WEIGHT,
};

const DEFAULT_WEIGHT = MIN_WEIGHT;

let zoneTable = null;
let centreCache = null;

function ensureTable() {
  if (zoneTable) return zoneTable;
  zoneTable = LS_ZONES.map((z) => ({
    x1: z.x1,
    y1: z.y1,
    x2: z.x2,
    y2: z.y2,
    pal: z.pal,
    name: z.name,
    weight: PALETTE_WEIGHT[z.pal] !== undefined ? PALETTE_WEIGHT[z.pal] : DEFAULT_WEIGHT,
  }));
  return zoneTable;
}

/** District record covering this tile, or null if the tile falls outside them all. */
export function zoneAt(tx, ty) {
  const table = ensureTable();
  for (let i = 0; i < table.length; i++) {
    const z = table[i];
    if (tx >= z.x1 && tx <= z.x2 && ty >= z.y1 && ty <= z.y2) return z;
  }
  return null;
}

/**
 * People per CELL x CELL tile square at this tile: 1 in the suburbs, 4 downtown.
 *
 * Tiles that fall between district rectangles (the harbour edge, the map
 * margin) fall back to a radial reading from the busiest part of the city, so
 * the gradient still holds rather than snapping to a flat default.
 */
export function densityAt(tx, ty) {
  const z = zoneAt(tx, ty);
  if (z) return z.weight;
  const c = cityCentre();
  const span = Math.max(1, Math.hypot(CFG.COLS, CFG.ROWS) * 0.5);
  const t = Math.hypot(tx - c.x, ty - c.y) / span;
  if (t < 0.22) return MAX_WEIGHT;
  if (t < 0.45) return 3;
  if (t < 0.68) return 2;
  return MIN_WEIGHT;
}

/** Footfall-weighted centre of the city, used only by the fallback above. */
function cityCentre() {
  if (centreCache) return centreCache;
  const table = ensureTable();
  let sx = 0;
  let sy = 0;
  let sw = 0;
  for (let i = 0; i < table.length; i++) {
    const z = table[i];
    const w = z.weight * z.weight; // busy districts pull the centre harder
    sx += ((z.x1 + z.x2) / 2) * w;
    sy += ((z.y1 + z.y2) / 2) * w;
    sw += w;
  }
  centreCache = sw > 0
    ? { x: sx / sw, y: sy / sw }
    : { x: CFG.COLS / 2, y: CFG.ROWS / 2 };
  return centreCache;
}

/** Origin tile of the CELL x CELL square containing this tile. */
export function cellOrigin(tx, ty) {
  return {
    cx: Math.floor(tx / CELL) * CELL,
    cy: Math.floor(ty / CELL) * CELL,
  };
}

/**
 * How many people can actually stand in this square.
 *
 * The district's figure is the *wish*; the pavement is the *limit*. This city is
 * a grid of two-tile carriageways with a one-tile footway each side, so a 4x4
 * square holds about three and a half tiles of pavement on average - and a third
 * of the downtown squares hold none at all, being solid blocks. Demanding four
 * people per square downtown is therefore not physically possible here: there
 * would be nowhere for them to stand.
 *
 * So the cap is the smaller of the two. Downtown still ends up at three or four
 * people per square wherever there is a footway to put them, and the suburbs
 * stay at one, which is the gradient that was asked for.
 */
export function cellCap(cx, cy) {
  const want = densityAt(cx, cy);
  if (want <= 0) return 0;
  let room = 0;
  for (let dy = 0; dy < CELL; dy++) {
    for (let dx = 0; dx < CELL; dx++) {
      if (isSidewalkTile(cx + dx, cy + dy)) room++;
    }
  }
  return Math.min(want, room);
}

/** Cheap integer key for a cell origin. */
export function cellKey(cx, cy) {
  return cy * CFG.COLS + cx;
}

/** Drop the cached district table. Call whenever a map is (re)loaded. */
export function invalidateDensity() {
  zoneTable = null;
  centreCache = null;
}

/** Snapshot for the F3 overlay and the test suite. */
export function densityStats() {
  const table = ensureTable();
  const byWeight = {};
  for (let i = 0; i < table.length; i++) {
    const z = table[i];
    const key = "per4x4_" + z.weight;
    byWeight[key] = (byWeight[key] || 0) +
      Math.round(((z.x2 - z.x1 + 1) / CELL) * ((z.y2 - z.y1 + 1) / CELL));
  }
  return { districts: table.length, byWeight, centre: cityCentre() };
}
