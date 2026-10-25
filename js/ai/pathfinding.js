// ======================== PATHFINDING ========================
// Tile A* for pedestrians, police and AI drivers.
//
// Three things make this fast enough to run for ~170 agents every frame:
//
//   1. A binary heap instead of a linear scan for the open list. The original
//      implementation did `for (i=1..open.length)` per expansion, which is
//      O(n^2) on a frontier that routinely reaches a few hundred nodes.
//   2. Stamped scratch buffers. Instead of re-filling 4 typed arrays per search
//      (120*120 = 14400 writes), a generation counter invalidates them for
//      free, so a search allocates nothing at all.
//   3. A request queue with a per-frame budget. Pedestrians ask for a route and
//      pick it up a frame or two later; the number of A* expansions per frame
//      is capped so pathfinding can never spike the frame time.
//
// `findPath()` stays synchronous for existing callers (police, tests); new
// code should prefer `requestPath()` + `pumpPathfinder()`.
import { CFG } from "../core/config.js?v=57";
import { navCost, MIN_STEP_COST } from "./navGrid.js?v=57";

// ── Scratch state, reused across searches ───────────────────
let CAP = 0;
let gScore = new Float32Array(0);
let parent = new Int32Array(0);
let stamp = new Uint32Array(0);
let generation = 0;

let heapNode = new Int32Array(0);
let heapKey = new Float32Array(0);
let heapSize = 0;

function ensureCapacity(n) {
  if (CAP === n && gScore.length === n) return;
  CAP = n;
  gScore = new Float32Array(n);
  parent = new Int32Array(n);
  stamp = new Uint32Array(n);
  const h = 1 << 14;
  heapNode = new Int32Array(h);
  heapKey = new Float32Array(h);
}

function nextGeneration() {
  generation = (generation + 1) >>> 0;
  if (generation === 0) {
    // Wrapped: invalidate every stamp in one go.
    stamp.fill(0);
    generation = 1;
  }
  return generation;
}

// ── Binary min-heap over (fScore, nodeIndex) ─────────────────
function heapPush(node, key) {
  if (heapSize >= heapNode.length) return; // frontier saturated: drop
  let i = heapSize++;
  heapNode[i] = node;
  heapKey[i] = key;
  while (i > 0) {
    const parentI = (i - 1) >> 1;
    if (heapKey[parentI] <= heapKey[i]) break;
    const tn = heapNode[parentI];
    const tk = heapKey[parentI];
    heapNode[parentI] = heapNode[i];
    heapKey[parentI] = heapKey[i];
    heapNode[i] = tn;
    heapKey[i] = tk;
    i = parentI;
  }
}

function heapPop() {
  const top = heapNode[0];
  heapSize--;
  if (heapSize > 0) {
    heapNode[0] = heapNode[heapSize];
    heapKey[0] = heapKey[heapSize];
    let i = 0;
    for (;;) {
      const l = i * 2 + 1;
      const r = l + 1;
      let m = i;
      if (l < heapSize && heapKey[l] < heapKey[m]) m = l;
      if (r < heapSize && heapKey[r] < heapKey[m]) m = r;
      if (m === i) break;
      const tn = heapNode[m];
      const tk = heapKey[m];
      heapNode[m] = heapNode[i];
      heapKey[m] = heapKey[i];
      heapNode[i] = tn;
      heapKey[i] = tk;
      i = m;
    }
  }
  return top;
}

// 4-connected: the city grid is orthogonal and diagonal cuts look wrong on a
// footway this narrow.
const DX = [0, 0, -1, 1];
const DY = [-1, 1, 0, 0];

function heur(ax, ay, bx, by) {
  return (Math.abs(bx - ax) + Math.abs(by - ay)) * MIN_STEP_COST;
}

/**
 * Synchronous A*. Returns an array of `{x, y}` tile steps (excluding the start
 * tile) or null when no route exists within `maxSteps` manhattan distance.
 */
export function findPath(sx, sy, ex, ey, maxSteps = 60, opts) {
  const cols = CFG.COLS;
  const rows = CFG.ROWS;
  if (cols <= 0 || rows <= 0) return null;

  const startX = Math.floor(sx / CFG.TILE);
  const startY = Math.floor(sy / CFG.TILE);
  let endX = Math.floor(ex / CFG.TILE);
  let endY = Math.floor(ey / CFG.TILE);

  if (startX < 0 || startY < 0 || startX >= cols || startY >= rows) return null;
  if (endX < 0 || endY < 0 || endX >= cols || endY >= rows) return null;
  if (startX === endX && startY === endY) return [];

  ensureCapacity(cols * rows);
  const gen = nextGeneration();
  heapSize = 0;

  const maxNodes = opts && opts.maxNodes ? opts.maxNodes : 2600;

  const si = startY * cols + startX;
  gScore[si] = 0;
  parent[si] = -1;
  stamp[si] = gen;
  heapPush(si, heur(startX, startY, endX, endY));

  let expanded = 0;
  let bestNode = -1;
  let bestH = Infinity;
  const hMax = Math.max(1, maxSteps);

  while (heapSize > 0 && expanded < maxNodes) {
    const ci = heapPop();
    if (stamp[ci] !== gen) continue;
    const cxp = ci % cols;
    const cyp = (ci / cols) | 0;
    if (cxp === endX && cyp === endY) return reconstruct(ci, cols);

    expanded++;
    const gc = gScore[ci];
    const hc = heur(cxp, cyp, endX, endY);
    if (hc < bestH) {
      bestH = hc;
      bestNode = ci;
    }
    // Give up once we are hopelessly far from the goal; keeps a bad request
    // (e.g. an unreachable building lot) from burning the whole budget.
    if (hc > hMax * 1.8 && bestNode >= 0) break;

    for (let k = 0; k < 4; k++) {
      const nx = cxp + DX[k];
      const ny = cyp + DY[k];
      if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
      const ni = ny * cols + nx;
      const step = navCost(nx, ny);
      if (!(step < Infinity)) continue;
      const ng = gc + step;
      if (stamp[ni] === gen && gScore[ni] <= ng) continue;
      gScore[ni] = ng;
      parent[ni] = ci;
      stamp[ni] = gen;
      heapPush(ni, ng + heur(nx, ny, endX, endY));
    }
  }

  // No exact route: take the closest node we reached so the agent still makes
  // useful progress instead of freezing.
  if (bestNode >= 0 && bestNode !== si) return reconstruct(bestNode, cols);
  return null;
}

function reconstruct(node, cols) {
  const out = [];
  let cur = node;
  let guard = 0;
  while (cur !== -1 && guard++ < 4096) {
    out.push({ x: cur % cols, y: (cur / cols) | 0 });
    cur = parent[cur];
  }
  out.pop(); // drop the start tile
  out.reverse();
  return out;
}

// ── Small route cache ────────────────────────────────────────
// Pedestrians on the same pavement chain keep asking for very similar routes,
// so a cache removes a large slice of the A* workload. Eviction is gradual:
// dropping the whole cache in one go frees thousands of objects at once and
// shows up as a GC hitch, so we trim the oldest quarter instead. Map iteration
// order is insertion order, so this is a FIFO.
const CACHE_LIMIT = 512;
const CACHE_TRIM = 128;
const cache = new Map();
let cacheHits = 0;
let cacheMisses = 0;

function cacheKey(sx, sy, ex, ey) {
  return ((sx * 131 + sy) * 131 + ex) * 131 + ey;
}

export function pathCacheStats() {
  return { size: cache.size, hits: cacheHits, misses: cacheMisses };
}

export function clearPathCache() {
  cache.clear();
  cacheHits = 0;
  cacheMisses = 0;
}

function trimCache() {
  if (cache.size < CACHE_LIMIT) return;
  let n = CACHE_TRIM;
  for (const k of cache.keys()) {
    cache.delete(k);
    if (--n <= 0) break;
  }
}

/**
 * Cache lookup wrapper. The stored route is handed out *shared*: every
 * consumer only ever reads it (`path[i]`, `path.length`) and keeps its own
 * `pathIndex`, so no defensive copy is needed and we avoid allocating a fresh
 * array per query. `findPath()` itself still returns a fresh array, because it
 * is the public synchronous entry point.
 */
function computeWithCache(sx, sy, ex, ey, maxSteps, opts) {
  const key = cacheKey(sx, sy, ex, ey);
  const hit = cache.get(key);
  if (hit !== undefined) {
    cacheHits++;
    return hit;
  }
  cacheMisses++;
  const path = findPath(sx * CFG.TILE + CFG.TILE / 2, sy * CFG.TILE + CFG.TILE / 2,
    ex * CFG.TILE + CFG.TILE / 2, ey * CFG.TILE + CFG.TILE / 2, maxSteps, opts);
  trimCache();
  cache.set(key, path);
  return path;
}

// ── Budgeted request queue ───────────────────────────────────
export const DEFAULT_PATH_BUDGET = 3;
const MAX_PENDING = 96;
// Upper bound on nodes expanded for a *queued* search. Typical pavement routes
// expand a few dozen; this only bites on pathological requests, and it is the
// hard ceiling that stops one frame from ever being dominated by pathfinding.
const QUEUED_MAX_NODES = 1200;

let pending = [];

function capQueue() {
  // Requests carry a sequence number; oldest first when we overflow.
  if (pending.length <= MAX_PENDING) return;
  pending.sort((a, b) => a.seq - b.seq);
  pending = pending.slice(pending.length - MAX_PENDING);
}

/**
 * Queue a route for an agent. The agent keeps its current path until the new
 * one is ready, so agents never stand still waiting for the pathfinder.
 *
 * `tag` lets the agent discard a stale result that arrives after the agent
 * already changed its mind.
 */
export function requestPath(agent, endTileX, endTileY, maxSteps = 70, tag = 0) {
  if (!agent) return;
  if (!pending.some((r) => r.agent === agent)) {
    pending.push({
      agent,
      sx: Math.floor(agent.x / CFG.TILE),
      sy: Math.floor(agent.y / CFG.TILE),
      ex: endTileX,
      ey: endTileY,
      maxSteps,
      tag,
      seq: requestPath._seq = (requestPath._seq || 0) + 1,
    });
  } else {
    for (const r of pending) {
      if (r.agent !== agent) continue;
      r.sx = Math.floor(agent.x / CFG.TILE);
      r.sy = Math.floor(agent.y / CFG.TILE);
      r.ex = endTileX;
      r.ey = endTileY;
      r.maxSteps = maxSteps;
      r.tag = tag;
    }
  }
  capQueue();
}

export function pendingPathCount() {
  return pending.length;
}

/**
 * Run up to `budget` queued searches and hand the results to their agents.
 * `onDone(agent, path)` decides what "done" means for the caller.
 */
export function pumpPathfinder(budget = DEFAULT_PATH_BUDGET, onDone) {
  let done = 0;
  while (pending.length > 0 && done < budget) {
    const req = pending.shift();
    const a = req.agent;
    // The agent may have been despawned between request and execution.
    if (!a || a.dead) continue;
    const path = computeWithCache(req.sx, req.sy, req.ex, req.ey, req.maxSteps, {
      maxNodes: QUEUED_MAX_NODES,
    });
    done++;
    if (onDone) onDone(a, path, req.tag);
  }
  return done;
}

export function clearPathRequests() {
  pending.length = 0;
}

/** Resolve the tile a world position sits on, clamped to the grid. */
export function tileOf(x, y) {
  const tx = Math.floor(x / CFG.TILE);
  const ty = Math.floor(y / CFG.TILE);
  return {
    x: tx < 0 ? 0 : tx >= CFG.COLS ? CFG.COLS - 1 : tx,
    y: ty < 0 ? 0 : ty >= CFG.ROWS ? CFG.ROWS - 1 : ty,
  };
}

/** Pixel centre of a tile. */
export function tileCenter(tx, ty) {
  return { x: tx * CFG.TILE + CFG.TILE / 2, y: ty * CFG.TILE + CFG.TILE / 2 };
}