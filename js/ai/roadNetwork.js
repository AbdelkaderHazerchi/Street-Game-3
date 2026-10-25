// ======================== ROAD NETWORK ========================
// A lane graph carved out of the tile map, built once per map load.
//
// The old AI steered along ad-hoc "driving lines" measured on the fly. This
// module instead models the city the way a driver reads it: every road tile is
// a node, every legal move between two tiles is a *lane* with a fixed
// direction and a right-hand lane offset, and a journey is just a path through
// that graph. Everything above this module (js/ai/vehicleBrain.js) works on
// lane paths and never touches tiles.
//
// Design rules:
//   * Right-hand traffic: the lane centre sits LANE_OFFSET tiles to the right
//     of the direction of travel, clamped so it always stays on the
//     carriageway.
//   * Junctions are signalised: an approach axis gets green/amber/red phases
//     offset per junction so the whole grid does not blink in unison.
//   * Zero allocation on the hot path: nodes are flat objects built once,
//     paths are reused per car.
import { CFG, T } from "../core/config.js?v=57";
import { getTile } from "../map/mapUtils.js?v=57";

export const DIR_E = 0;
export const DIR_S = 1;
export const DIR_W = 2;
export const DIR_N = 3;
const DIR_DX = [1, 0, -1, 0];
const DIR_DY = [0, 1, 0, -1];
const DIR_ANGLE = [0, Math.PI / 2, Math.PI, -Math.PI / 2];

/** Lanes run a quarter tile right of the road centre line. */
export const LANE_OFFSET = 0.24;

// Signal phases: 0 NS green, 1 NS amber, 2 all red, 3 EW green, 4 EW
// amber, 5 all red. Same rhythm a city engineer would pick.
const LIGHT_CYCLE = 620;
const PHASE_END = [236, 288, 324, 560, 612, LIGHT_CYCLE];

let cols = 0;
let rows = 0;
// One node per road tile, indexed ty * cols + tx. -1 on non-road tiles.
let nodeIdAt = new Int32Array(0);
let nodes = [];
let built = false;
let frame = 0;

function tileType(x, y) {
  if (x < 0 || y < 0 || x >= cols || y >= rows) return T.WATER;
  return getTile(x, y);
}
function isRoad(x, y) { return tileType(x, y) === T.ROAD; }

/**
 * Build the lane graph from the current tile map. Cheap enough to run on every
 * map load: one pass over the road tiles plus a short scan per junction.
 */
export function rebuildRoadNetwork() {
  cols = CFG.COLS;
  rows = CFG.ROWS;
  nodes = [];
  nodeIdAt = new Int32Array(cols * rows);
  nodeIdAt.fill(-1);
  built = false;

  // Pass 1: a node per road tile.
  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!isRoad(x, y)) continue;
      const id = nodes.length;
      nodeIdAt[y * cols + x] = id;
      nodes.push({
        id, x, y,                       // tile coords
        wx: x * CFG.TILE + CFG.TILE / 2,
        wy: y * CFG.TILE + CFG.TILE / 2,
        out: [null, null, null, null],  // lane per direction (null = no road there)
        junction: false,
        // Junction signal: which axis currently has green (0 = EW, 1 = NS),
        // plus the amber and all-red flags.
        lightEW: true,
        lightNS: false,
        amber: false,
        occupiedBy: null,               // car currently inside a junction tile
      });
    }
  }

  // Pass 2: lanes. A lane exists where two road tiles touch. Junction tiles
  // keep their lanes too - entering and leaving a box is still driving.
  for (const n of nodes) {
    for (let d = 0; d < 4; d++) {
      const nx = n.x + DIR_DX[d];
      const ny = n.y + DIR_DY[d];
      if (!isRoad(nx, ny)) continue;
      const to = nodes[nodeIdAt[ny * cols + nx]];
      n.out[d] = { to, dir: d, angle: DIR_ANGLE[d] };
    }
  }

  // Junction test, pass 3 (needs every `out` filled first).
  //
  // A naive "three or more exits" test misreads this map badly: its roads
  // are two and three tiles wide, so an ordinary lane tile has E+W along
  // the road plus a step sideways into the parallel lane - three exits, but
  // no crossing at all. That classified 95% of the network as junctions,
  // put a light and a one-car box on every tile, and made traffic seize up
  // at random.
  //
  // An exit only counts as a real arm when the neighbour *continues
  // straight on through it*: a parallel lane dead-ends sideways (the lane
  // beside it has no matching step), while a genuine cross-road's arm
  // carries on. Three or more real arms = junction.
  for (const n of nodes) {
    let arms = 0;
    for (let d = 0; d < 4; d++) {
      const lane = n.out[d];
      if (lane && lane.to.out[d]) arms++;
    }
    n.junction = arms >= 3;
  }

  // Junction clusters, pass 4. On this map one crossing is a block of two
  // or three tile-wide junction tiles, not a single tile - and a per-tile
  // box lets a car in tile A turn through a car crossing in the diagonally
  // adjacent tile B, because neither ever asks about the other. Connected
  // junction tiles therefore form one cluster and one reservation: the
  // whole crossing is a single box, claimed and released as a unit.
  for (const n of nodes) n.cluster = null;
  let clusterId = 0;
  for (const seed of nodes) {
    if (!seed.junction || seed.cluster) continue;
    const cl = { id: clusterId++, nodes: [], occupiedBy: null, since: 0 };
    const stack = [seed];
    seed.cluster = cl;
    while (stack.length) {
      const n = stack.pop();
      cl.nodes.push(n);
      for (let d = 0; d < 4; d++) {
        const to = n.out[d] && n.out[d].to;
        if (to && to.junction && !to.cluster) { to.cluster = cl; stack.push(to); }
      }
    }
  }

  frame = 0;
  built = true;
  return nodes.length;
}

export function invalidateRoadNetwork() { built = false; nodes = []; nodeIdAt = new Int32Array(0); }
export function roadNetworkReady() { return built; }
export function networkNodes() { return nodes; }
export function nodeCount() { return nodes.length; }

/** Node under a world position, or null. */
export function nodeAtWorld(x, y) {
  if (!built) return null;
  const tx = Math.floor(x / CFG.TILE);
  const ty = Math.floor(y / CFG.TILE);
  return nodeAtTile(tx, ty);
}
export function nodeAtTile(tx, ty) {
  if (!built || tx < 0 || ty < 0 || tx >= cols || ty >= rows) return null;
  const id = nodeIdAt[ty * cols + tx];
  return id >= 0 ? nodes[id] : null;
}

/**
 * Nearest node to a world position, searched outward in rings. Returns null
 * when there is no road within maxR tiles - callers treat that as "wedge
 * somewhere and re-plan", never as a target.
 */
export function nearestNode(x, y, maxR = 8) {
  if (!built) return null;
  const tx = Math.floor(x / CFG.TILE);
  const ty = Math.floor(y / CFG.TILE);
  for (let r = 0; r <= maxR; r++) {
    let best = null;
    let bestD = Infinity;
    for (let dx = -r; dx <= r; dx++) {
      for (let dy = -r; dy <= r; dy++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r) continue;
        const n = nodeAtTile(tx + dx, ty + dy);
        if (!n) continue;
        const d = (n.wx - x) ** 2 + (n.wy - y) ** 2;
        if (d < bestD) { bestD = d; best = n; }
      }
    }
    if (best) return best;
  }
  return null;
}

/** A random road node, picked uniformly. */
export function randomNode() {
  if (!nodes.length) return null;
  return nodes[(Math.random() * nodes.length) | 0];
}

// ── Lane geometry ────────────────────────────────────────────
/**
 * World position of the lane centre on the `d` side of node `n`.
 *
 * The lane sits a quarter tile to the right of the direction of travel; if
 * that would put it off the carriageway (a one-tile street), it falls back to
 * the tile centre. `onRoad` here asks the raw tile map, so it is honest even
 * across a junction mouth where the wider run would otherwise fool a cached
 * measurement.
 */
const lanePtScratch = { x: 0, y: 0 };
export function lanePoint(n, d, out) {
  const o = out || lanePtScratch;
  // Right of direction d in screen coords (y down) is (-dy, dx).
  const rx = -DIR_DY[d];
  const ry = DIR_DX[d];
  const T = CFG.TILE;
  let x = n.wx + rx * T * LANE_OFFSET;
  let y = n.wy + ry * T * LANE_OFFSET;
  if (!isRoad(Math.floor(x / T), Math.floor(y / T))) {
    x = n.wx;
    y = n.wy;
  }
  o.x = x;
  o.y = y;
  return o;
}

// ── Signals ──────────────────────────────────────────────────
/** Phase index (0-5) for the whole junction grid this frame. */
export function signalPhase() {
  return Math.floor(((frame % LIGHT_CYCLE) / LIGHT_CYCLE) * 6);
}

/**
 * Update the per-junction light flags. Called once per frame by the traffic
 * orchestrator before any car asks for permission.
 */
export function updateSignals() {
  frame++;
  for (const n of nodes) {
    if (!n.junction) continue;
    // Stagger junctions so a driver catches a string of greens down an avenue
    // instead of hitting every box as it turns red. The steps have to span the
    // whole cycle: quarter-cycle offsets leave neighbouring avenues in
    // opposite phases while an avenue repeats every four crossings - a green
    // wave down it - instead of the whole city standing red together, which
    // is what the old 39-frame steps (a fifth of the cycle) amounted to.
    const off = ((n.x * 7 + n.y * 11) % 4) * (LIGHT_CYCLE / 4);
    const t = (frame + off) % LIGHT_CYCLE;
    if (t < 236) { n.lightNS = true; n.lightEW = false; n.amber = false; }
    else if (t < 288) { n.lightNS = true; n.lightEW = false; n.amber = true; }
    else if (t < 324) { n.lightNS = false; n.lightEW = false; n.amber = false; }
    else if (t < 560) { n.lightNS = false; n.lightEW = true; n.amber = false; }
    else if (t < 612) { n.lightNS = false; n.lightEW = true; n.amber = true; }
    else { n.lightNS = false; n.lightEW = false; n.amber = false; }
  }
}

/** Put the signal cycle at a known point (tests arrange a red on arrival). */
export function setSignalFrameForTest(f) { frame = f | 0; }
export function signalFrameForTest() { return frame; }

/**
 * May a car enter junction tile `n` coming from direction `d` right now?
 *
 * Green for the approach axis, or amber when stopping comfortably is no
 * longer possible. Cars already inside a junction answer from
 * `junctionFree` instead - they are committed and must clear.
 */
export function lightPermits(n, d, speed) {
  if (!n.junction) return true;
  const vertical = DIR_DY[d] !== 0;
  if (vertical ? n.lightNS : n.lightEW) return true;
  if (n.amber) {
    // Amber: commit if stopping would take longer than the box ahead.
    const stopping = (speed * speed) / (2 * 0.35) + CFG.TILE * 0.5;
    return stopping > CFG.TILE * 1.05;
  }
  return false;
}

/**
 * Is the junction free for a car coming from direction `d`?
 *
 * One car per *crossing*: the reservation covers the whole cluster of
 * junction tiles, because a crossing on this map is a block of tiles and a
 * car turning through tile A can cut across a car crossing in the diagonal
 * neighbour B. The hold expires after a long stall so a car that died
 * inside cannot deadlock the junction forever.
 */
export function junctionFree(n, car) {
  if (!n.junction) return true;
  const cl = n.cluster;
  if (!cl || !cl.occupiedBy || cl.occupiedBy === car) return true;
  const o = cl.occupiedBy;
  if (o.hidden || o.exploding) { cl.occupiedBy = null; return true; }
  // Frame-based expiry. The holder may have been spliced out of the vehicle
  // list entirely (explosion finished, save loaded, test reset), in which
  // case nothing about it will ever change again and only a clock can clear
  // the box - checking fields on `o` would wait forever. Also covers a live
  // car wedged inside the box for good.
  if (frame - (cl.since || 0) > 900) { cl.occupiedBy = null; return true; }
  return false;
}
export function claimJunction(n, car) {
  if (!n.junction) return;
  const cl = n.cluster;
  if (cl && (!cl.occupiedBy || cl.occupiedBy === car)) {
    cl.occupiedBy = car;
    cl.since = frame;
  }
}
/**
 * Give the crossing back - but only when the car's *body* is clear of every
 * tile in it. The centre crossing a tile edge is not the rear clearing the
 * box, and releasing then is exactly how a second driver claimed a "free"
 * crossing and drove in under the first car's tail.
 *
 * Returns true when the crossing is no longer ours (released, or never held).
 */
export function releaseJunction(n, car, force) {
  if (!n) return true;
  const cl = n.cluster;
  if (!cl || cl.occupiedBy !== car) return true;
  if (!force) {
    const reach = CFG.TILE * 0.5 + (car.w || 60) * 0.5 + 6;
    for (let i = 0; i < cl.nodes.length; i++) {
      const t = cl.nodes[i];
      if (Math.abs(t.wx - car.x) < reach && Math.abs(t.wy - car.y) < reach) {
        return false;       // still standing on part of the crossing
      }
    }
  }
  cl.occupiedBy = null;
  return true;
}

// ── Routing ──────────────────────────────────────────────────
/**
 * A* across the lane graph from `from` to `to`.
 *
 * The cost is the geometric distance plus a turn penalty, so routes prefer
 * long straights over dog-legs - which is what makes the result look like
 * someone who knows the city rather than a boustrophedon crawl. The returned
 * array is the node sequence (from and to included) and is owned by the
 * caller; `out` is reused between calls to keep the per-replan allocation at
 * zero.
 *
 * Returns false when there is no route (an unreachable island of road).
 */
const CLOSED = new Uint8Array(0);
const G_SCORE = new Float64Array(0);
let closed = CLOSED;
let gScore = G_SCORE;
let searchStamp = 0;
const stamps = new Int32Array(0);
let stampArr = stamps;

export function findLanePath(from, to, out, maxNodes = 4000) {
  if (!built || !from || !to) return false;
  if (from === to) { out.length = 0; out.push(from); return true; }
  if (closed.length !== nodes.length) {
    closed = new Uint8Array(nodes.length);
    gScore = new Float64Array(nodes.length);
    stampArr = new Int32Array(nodes.length);
  }
  searchStamp++;
  // Binary min-heap of [nodeId, f], stored flat.
  const heapId = [];
  const heapF = [];
  const push = (id, f) => {
    heapId.push(id); heapF.push(f);
    let i = heapId.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (heapF[p] <= heapF[i]) break;
      const ti = heapId[i], tf = heapF[i];
      heapId[i] = heapId[p]; heapF[i] = heapF[p];
      heapId[p] = ti; heapF[p] = tf;
      i = p;
    }
  };
  const pop = () => {
    const id = heapId[0];
    const lastId = heapId.pop(), lastF = heapF.pop();
    if (heapId.length) {
      heapId[0] = lastId; heapF[0] = lastF;
      let i = 0;
      for (;;) {
        const l = 2 * i + 1, r = l + 1;
        let m = i;
        if (l < heapId.length && heapF[l] < heapF[m]) m = l;
        if (r < heapId.length && heapF[r] < heapF[m]) m = r;
        if (m === i) break;
        const ti = heapId[i], tf = heapF[i];
        heapId[i] = heapId[m]; heapF[i] = heapF[m];
        heapId[m] = ti; heapF[m] = tf;
        i = m;
      }
    }
    return id;
  };

  const h = (n) => Math.abs(n.x - to.x) + Math.abs(n.y - to.y); // octile-ish
  closed.fill(0);
  gScore[from.id] = 0;
  stampArr[from.id] = searchStamp;
  let visited = 0;
  push(from.id, h(from));
  const came = new Map(); // child id -> parent id

  while (heapId.length && visited < maxNodes) {
    const curId = pop();
    if (closed[curId]) continue;
    closed[curId] = 1;
    visited++;
    const cur = nodes[curId];
    if (cur === to) {
      // Rebuild into out.
      out.length = 0;
      let id = curId;
      while (id !== undefined) {
        out.push(nodes[id]);
        id = came.get(id);
      }
      out.reverse();
      return true;
    }
    for (let d = 0; d < 4; d++) {
      const lane = cur.out[d];
      if (!lane) continue;
      const nid = lane.to.id;
      if (closed[nid]) continue;
      // Gentle penalty for turning, relative to the direction we arrived in,
      // so routes prefer long straights without forbidding corners.
      let turnPenalty = 0;
      const parentId = came.get(curId);
      if (parentId !== undefined) {
        const p = nodes[parentId];
        const pd = (p.x === cur.x) ? (p.y < cur.y ? 1 : 3) : (p.x < cur.x ? 0 : 2);
        if (pd !== d) turnPenalty = 0.5;
      }
      const step = 1 + turnPenalty;
      const g = gScore[curId] + step;
      if (stampArr[nid] !== searchStamp || g < gScore[nid]) {
        stampArr[nid] = searchStamp;
        gScore[nid] = g;
        came.set(nid, curId);
        push(nid, g + h(lane.to));
      }
    }
  }
  return false;
}

/**
 * Pick a destination node a sensible drive away: prefer straight runs from
 * the current heading so traffic keeps flowing, and never send a car to its
 * own tile.
 */
export function pickDestination(fromNode, headingAngle) {
  if (!fromNode) return null;
  const curDir = nearestDir(headingAngle);
  // Straight on is tried first, then the sides, then the U-turn.
  const order = [curDir, (curDir + 1) % 4, (curDir + 3) % 4, (curDir + 2) % 4];
  for (const d of order) {
    let run = 0;
    let n = fromNode;
    for (let s = 1; s <= 40; s++) {
      const lane = n.out[d];
      if (!lane) break;
      n = lane.to;
      run = s;
    }
    if (run < 5) continue;
    const min = Math.min(8, run - 1);
    const max = Math.min(run - 1, min + 8 + ((Math.random() * 16) | 0));
    const steps = min + ((Math.random() * (max - min + 1)) | 0);
    let target = fromNode;
    for (let s = 0; s < steps; s++) {
      const lane = target.out[d];
      if (!lane) break;
      target = lane.to;
    }
    if (target !== fromNode) return target;
  }
  return null;
}

function nearestDir(a) {
  const i = Math.round(a / (Math.PI / 2)) & 3;
  return i;
}
