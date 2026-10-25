// ======================== NAV GRID ========================
// Static, precomputed navigation layer derived once from the tile map.
//
// The city is authored around 2-3 tile wide carriageways flanked by a 1 tile
// pavement, so "walkable" alone is far too permissive: a naive walker cuts
// diagonally across intersections. This module classifies every tile once and
// then answers the three questions the AI asks constantly:
//
//   1. Is this tile a sidewalk / a road / a park / blocked?   (cheap Uint8 read)
//   2. Is this road tile part of a legal crossing?            (crosswalk span)
//   3. Where is the nearest sidewalk / crossing?              (ring search)
//
// Everything lives in flat typed arrays indexed by `y * cols + x`, so the hot
// paths do zero allocation and no map lookups.
import { CFG, T } from "../core/config.js?v=57";
import { getTile } from "../map/mapUtils.js?v=57";
import { map } from "../map/mapState.js?v=57";

// ── Surface classes ──────────────────────────────────────────
export const S_BLOCKED = 0;
export const S_SIDEWALK = 1; // T.SIDEWALK (sand / footway) or T.PAVEMENT (kerb)
export const S_ROAD = 2;
export const S_PARK = 3;
export const S_PARKING = 4;

// Crossing axis bits (only meaningful where crossAxis !== AXIS_NONE)
export const AXIS_NONE = 0;
export const AXIS_H = 1; // horizontal span -> you walk east/west across it
export const AXIS_V = 2; // vertical span   -> you walk north/south across it

// Widest road run that may be treated as a crosswalk. The authored city uses
// 2-3 tile carriageways; 6 leaves slack for the wider junction throats without
// ever letting a whole boulevard become a "crossing".
const MAX_CROSS_SPAN = 6;

let cols = 0;
let rows = 0;
let total = 0;
let surface = new Uint8Array(0);
let crossAxis = new Uint8Array(0);
let inter = new Uint8Array(0);
// Cached centre line of each tile's road run, per axis. 0 = not measured yet.
let runMidH = null;
let runMidV = null;
let built = false;
let builtFor = null;
let builtCols = 0;
let builtRows = 0;

function classify(t) {
  if (t === T.ROAD) return S_ROAD;
  if (t === T.SIDEWALK || t === T.PAVEMENT) return S_SIDEWALK;
  if (t === T.PARK) return S_PARK;
  if (t === T.PARKING) return S_PARKING;
  return S_BLOCKED; // BUILDING / SPECIAL / WATER
}

/**
 * Build the nav layer from the current tile map. Cheap enough (one pass over
 * 120x120 tiles plus three short scans) to call on every map load.
 */
export function rebuildNavGrid() {
  cols = CFG.COLS;
  rows = CFG.ROWS;
  total = cols * rows;
  if (cols <= 0 || rows <= 0) return;

  if (surface.length !== total) {
    surface = new Uint8Array(total);
    crossAxis = new Uint8Array(total);
    inter = new Uint8Array(total);
  } else {
    surface.fill(0);
    crossAxis.fill(0);
    inter.fill(0);
  }

  for (let y = 0; y < rows; y++) {
    const base = y * cols;
    for (let x = 0; x < cols; x++) {
      surface[base + x] = classify(getTile(x, y));
    }
  }

  // ── Crosswalk spans ─────────────────────────────────────────
  // A run of road tiles bounded on BOTH sides by pavement is a legal crossing.
  // Junctions are excluded because their road run spans the whole block and
  // blows past MAX_CROSS_SPAN.
  for (let y = 0; y < rows; y++) {
    const base = y * cols;
    let x = 0;
    while (x < cols) {
      if (surface[base + x] !== S_ROAD) {
        x++;
        continue;
      }
      let a = x;
      let b = x;
      while (a > 0 && surface[base + a - 1] === S_ROAD) a--;
      while (b < cols - 1 && surface[base + b + 1] === S_ROAD) b++;
      if (a > 0 && b < cols - 1 && b - a + 1 <= MAX_CROSS_SPAN) {
        if (surface[base + a - 1] === S_SIDEWALK && surface[base + b + 1] === S_SIDEWALK) {
          for (let k = a; k <= b; k++) crossAxis[base + k] = AXIS_H;
        }
      }
      x = b + 1;
    }
  }
  for (let x = 0; x < cols; x++) {
    let y = 0;
    while (y < rows) {
      if (surface[y * cols + x] !== S_ROAD) {
        y++;
        continue;
      }
      let a = y;
      let b = y;
      while (a > 0 && surface[(a - 1) * cols + x] === S_ROAD) a--;
      while (b < rows - 1 && surface[(b + 1) * cols + x] === S_ROAD) b++;
      if (a > 0 && b < rows - 1 && b - a + 1 <= MAX_CROSS_SPAN) {
        if (surface[(a - 1) * cols + x] === S_SIDEWALK && surface[(b + 1) * cols + x] === S_SIDEWALK) {
          for (let k = a; k <= b; k++) crossAxis[k * cols + x] = AXIS_V;
        }
      }
      y = b + 1;
    }
  }

  // ── Four-way intersections (used by the traffic lights) ────
  for (let y = 1; y < rows - 1; y++) {
    const base = y * cols;
    for (let x = 1; x < cols - 1; x++) {
      if (surface[base + x] !== S_ROAD) continue;
      if (
        surface[base + x - 1] === S_ROAD &&
        surface[base + x + 1] === S_ROAD &&
        surface[base - cols + x] === S_ROAD &&
        surface[base + cols + x] === S_ROAD
      ) {
        inter[base + x] = 1;
      }
    }
  }

  built = true;
  builtFor = map;
  builtCols = cols;
  builtRows = rows;
  // Road-run centres are a property of this map, so they are computed on demand
  // and thrown away with everything else when the map changes.
  if (!runMidH || runMidH.length !== total) {
    runMidH = new Float32Array(total);
    runMidV = new Float32Array(total);
  } else {
    runMidH.fill(0);
    runMidV.fill(0);
  }
}

/**
 * The centre line of the carriageway at a tile, along the given axis.
 *
 * `horiz` means the road runs east-west, so the answer is a y coordinate; the
 * centre of the road run, not the middle of the tile. A road run is wider than
 * one tile, and which tiles belong to it changes from tile to tile where a side
 * street joins - so this has to be measured, and it is measured only where it is
 * not a junction, or a car entering a cross street is counted as being on the main
 * road.
 *
 * The traffic brain asks for this several times per car per frame, so the answers
 * are cached per tile. A real centre is never zero, so zero means "not measured
 * yet".
 */
export function roadRunMid(tx, ty, horiz) {
  ensure();
  const arr = horiz ? runMidH : runMidV;
  if (!arr || tx < 0 || ty < 0 || tx >= cols || ty >= rows) return 0;
  const i = ty * cols + tx;
  const cached = arr[i];
  if (cached !== 0) return cached;
  const T = CFG.TILE;
  let a;
  let b;
  if (horiz) {
    a = ty;
    b = ty;
    while (a > 0 && surface[(a - 1) * cols + tx] === S_ROAD && !inter[(a - 1) * cols + tx]) a--;
    while (b < rows - 1 && surface[(b + 1) * cols + tx] === S_ROAD && !inter[(b + 1) * cols + tx]) b++;
  } else {
    a = tx;
    b = tx;
    while (a > 0 && surface[ty * cols + a - 1] === S_ROAD && !inter[ty * cols + a - 1]) a--;
    while (b < cols - 1 && surface[ty * cols + b + 1] === S_ROAD && !inter[ty * cols + b + 1]) b++;
  }
  const mid = ((a + b) / 2 + 0.5) * T;
  arr[i] = mid;
  return mid;
}

function ensure() {
  if (built && builtFor === map && builtCols === CFG.COLS && builtRows === CFG.ROWS) return;
  rebuildNavGrid();
}

/** Force a rebuild on the next query (call after swapping the map). */
export function invalidateNavGrid() {
  built = false;
}

export function navIsReady() {
  ensure();
  return built;
}

export function navCols() {
  ensure();
  return cols;
}

export function navRows() {
  ensure();
  return rows;
}

function inBounds(x, y) {
  ensure();
  return x >= 0 && y >= 0 && x < cols && y < rows;
}

export function surfaceAt(x, y) {
  ensure();
  if (x < 0 || y < 0 || x >= cols || y >= rows) return S_BLOCKED;
  return surface[y * cols + x];
}

export function isWalkableTile(x, y) {
  return surfaceAt(x, y) !== S_BLOCKED;
}

export function isRoadTile(x, y) {
  return surfaceAt(x, y) === S_ROAD;
}

export function isSidewalkTile(x, y) {
  return surfaceAt(x, y) === S_SIDEWALK;
}

export function isIntersection(x, y) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
  return inter[y * cols + x] === 1;
}

/** A road tile that belongs to a legal crosswalk span. */
export function isCrossingTile(x, y) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return false;
  return crossAxis[y * cols + x] !== AXIS_NONE;
}

/** AXIS_H / AXIS_V when this is a crossing, otherwise AXIS_NONE. */
export function crossingAxis(x, y) {
  ensure();
  if (x < 0 || y < 0 || x >= cols || y >= rows) return AXIS_NONE;
  return crossAxis[y * cols + x];
}

/**
 * A* step cost. Pavement is the cheapest surface so paths hug the footway; raw
 * carriageway is expensive (pedestrians only cut across when they must) while a
 * crosswalk span stays cheap, so the orderly route is always the cheap one.
 * Park / car park sit in between.
 */
export function navCost(x, y) {
  const s = surfaceAt(x, y);
  if (s === S_BLOCKED) return Infinity;
  if (s === S_ROAD) return crossAxis[y * cols + x] !== AXIS_NONE ? 2.1 : 7.5;
  if (s === S_PARK) return 1.3;
  if (s === S_PARKING) return 1.7;
  return 1;
}

/** Cheapest possible step, used as the A* heuristic scale. */
export const MIN_STEP_COST = 1;

// ── Ring search helpers ──────────────────────────────────────
// Expanding squares, one edge at a time. Closest ring first so callers get the
// tightest match.

function eachInRing(cx, cy, maxR, cb) {
  for (let r = 1; r <= maxR; r++) {
    for (let d = -r; d <= r; d++) {
      // south edge (dy = +r) and north edge (dy = -r), corners included
      if (cb(cx + d, cy + r) === true) return true;
      if (cb(cx + d, cy - r) === true) return true;
    }
    for (let d = -r + 1; d <= r - 1; d++) {
      if (cb(cx + r, cy + d) === true) return true;
      if (cb(cx - r, cy + d) === true) return true;
    }
  }
  return false;
}

/** Nearest walkable tile to (tx,ty) by expanding ring, or null. */
export function nearestWalkableTile(tx, ty, maxR = 6) {
  if (!inBounds(tx, ty)) return null;
  if (surfaceAt(tx, ty) !== S_BLOCKED) return { x: tx, y: ty };
  let found = null;
  eachInRing(tx, ty, maxR, (nx, ny) => {
    if (!inBounds(nx, ny)) return false;
    if (surfaceAt(nx, ny) === S_BLOCKED) return false;
    found = { x: nx, y: ny };
    return true;
  });
  return found;
}

/** Nearest pavement tile to (tx,ty), or null. */
export function nearestSidewalkTile(tx, ty, maxR = 8) {
  if (!inBounds(tx, ty)) return null;
  if (surfaceAt(tx, ty) === S_SIDEWALK) return { x: tx, y: ty };
  let found = null;
  eachInRing(tx, ty, maxR, (nx, ny) => {
    if (!inBounds(nx, ny)) return false;
    if (surfaceAt(nx, ny) !== S_SIDEWALK) return false;
    found = { x: nx, y: ny };
    return true;
  });
  return found;
}

/** Nearest road tile that belongs to a crosswalk span, or null. */
export function nearestCrossingTile(tx, ty, maxR = 10) {
  if (!inBounds(tx, ty)) return null;
  let found = null;
  eachInRing(tx, ty, maxR, (nx, ny) => {
    if (!inBounds(nx, ny)) return false;
    if (crossAxis[ny * cols + nx] === AXIS_NONE) return false;
    found = { x: nx, y: ny };
    return true;
  });
  return found;
}

function randomInRing(tx, ty, maxR, pred) {
  const r = 1 + Math.floor(Math.random() * Math.max(1, maxR));
  const dx = Math.floor(Math.random() * (r * 2 + 1)) - r;
  const dy = Math.floor(Math.random() * (r * 2 + 1)) - r;
  const nx = tx + dx;
  const ny = ty + dy;
  if (!inBounds(nx, ny)) return null;
  if (!pred(nx, ny)) return null;
  return { x: nx, y: ny };
}

/** Random pavement tile within `maxR` of (tx,ty), or null. */
export function randomSidewalkTile(tx, ty, maxR) {
  for (let i = 0; i < 10; i++) {
    const t = randomInRing(tx, ty, maxR, isSidewalkTile);
    if (t) return t;
  }
  return null;
}

/** Random non-road walkable tile (pavement / park / car park), or null. */
export function randomWalkableTile(tx, ty, maxR) {
  for (let i = 0; i < 10; i++) {
    const t = randomInRing(tx, ty, maxR, (nx, ny) => {
      const s = surfaceAt(nx, ny);
      return s === S_SIDEWALK || s === S_PARK || s === S_PARKING;
    });
    if (t) return t;
  }
  return null;
}

/** Random road tile within `maxR` of (tx,ty), or null. */
export function randomRoadTile(tx, ty, maxR) {
  for (let i = 0; i < 10; i++) {
    const t = randomInRing(tx, ty, maxR, isRoadTile);
    if (t) return t;
  }
  return null;
}

/**
 * A pavement tile anywhere in the city. Rejection sampling on the cached
 * surface array, so this is a couple of dozen integer compares - much cheaper
 * (and far more reliable) than picking a coordinate and searching outward.
 */
export function randomSidewalkTileAnywhere() {
  ensure();
  for (let i = 0; i < 400; i++) {
    const x = 1 + ((Math.random() * (cols - 2)) | 0);
    const y = 1 + ((Math.random() * (rows - 2)) | 0);
    if (surface[y * cols + x] === S_SIDEWALK) return { x, y };
  }
  return null;
}

/** A walkable non-road tile anywhere in the city, or null. */
export function randomWalkableTileAnywhere() {
  ensure();
  for (let i = 0; i < 400; i++) {
    const x = 1 + ((Math.random() * (cols - 2)) | 0);
    const y = 1 + ((Math.random() * (rows - 2)) | 0);
    const s = surface[y * cols + x];
    if (s === S_SIDEWALK || s === S_PARK || s === S_PARKING) return { x, y };
  }
  return randomSidewalkTileAnywhere();
}

/** A road tile anywhere in the city, or null. */
export function randomRoadTileAnywhere() {
  ensure();
  for (let i = 0; i < 400; i++) {
    const x = 1 + ((Math.random() * (cols - 2)) | 0);
    const y = 1 + ((Math.random() * (rows - 2)) | 0);
    if (surface[y * cols + x] === S_ROAD) return { x, y };
  }
  return null;
}

/**
 * Step out of a crossing along its walking axis and return the first pavement
 * tile found, i.e. the far kerb. null when the far side is not a footway
 * (blocked junction throat, waterfront, ...).
 */
export function sidewalkBeyondCrossing(cx, cy, dirX, dirY, maxSteps = 7) {
  let x = cx + dirX;
  let y = cy + dirY;
  for (let i = 0; i < maxSteps; i++) {
    if (!inBounds(x, y)) return null;
    const s = surfaceAt(x, y);
    if (s === S_SIDEWALK) return { x, y };
    if (s === S_BLOCKED) return null;
    x += dirX;
    y += dirY;
  }
  return null;
}

/**
 * A pavement tile on the OPPOSITE side of a street, reached through a legal
 * crossing. This is what makes pedestrians cross the road rather than drift
 * around the block forever.
 */
export function randomSidewalkAcrossRoad(tx, ty, maxR = 14) {
  for (let i = 0; i < 12; i++) {
    const c = randomInRing(tx, ty, maxR, (nx, ny) => crossAxis[ny * cols + nx] !== AXIS_NONE);
    if (!c) continue;
    const axis = crossAxis[c.y * cols + c.x];
    let dirX = 0;
    let dirY = 0;
    if (axis === AXIS_H) dirX = Math.random() < 0.5 ? 1 : -1;
    else dirY = Math.random() < 0.5 ? 1 : -1;
    const far = sidewalkBeyondCrossing(c.x, c.y, dirX, dirY);
    if (far) return far;
  }
  return null;
}

/**
 * Closest pavement tile to (tx,ty) - used to aim a parking manoeuvre at the
 * kerb instead of into oncoming traffic.
 */
export function kerbTileNear(tx, ty, maxR = 3) {
  if (!inBounds(tx, ty)) return null;
  let best = null;
  let bestD = Infinity;
  eachInRing(tx, ty, maxR, (nx, ny) => {
    if (!inBounds(nx, ny)) return false;
    if (surfaceAt(nx, ny) !== S_SIDEWALK) return false;
    const d = (nx - tx) * (nx - tx) + (ny - ty) * (ny - ty);
    if (d < bestD) {
      bestD = d;
      best = { x: nx, y: ny };
    }
    return false;
  });
  return best;
}

/** Debug helper: tile counts per class. */
export function navStats() {
  ensure();
  const out = {
    blocked: 0, sidewalk: 0, road: 0, park: 0, parking: 0,
    crossing: 0, intersections: 0,
  };
  for (let i = 0; i < total; i++) {
    switch (surface[i]) {
      case S_BLOCKED: out.blocked++; break;
      case S_SIDEWALK: out.sidewalk++; break;
      case S_ROAD: out.road++; break;
      case S_PARK: out.park++; break;
      case S_PARKING: out.parking++; break;
      default: break;
    }
    if (crossAxis[i] !== AXIS_NONE) out.crossing++;
    if (inter[i]) out.intersections++;
  }
  return out;
}