// ======================== SPATIAL INDEX + PERCEPTION ========================
// Two small services shared by the pedestrian and traffic brains.
//
// 1. Spatial hash - "who is near me?". Both AI systems need neighbour queries
//    every frame (is a car about to hit this pedestrian? is that car blocked
//    by the one in front? do these two panicked people react to each other?).
//    Brute force over 110 pedestrians x 66 vehicles is ~7000 distance tests per
//    question; the hash turns that into a handful of bucket reads. Rebuilt once
//    per frame, so the insert cost is O(n) and queries are allocation-free.
//
// 2. Noise bus - the AI's ears. Gunshots, car impacts and explosions are pushed
//    here as short-lived events and drained by the pedestrian brain, which turns
//    them into fear. Keeping the events in one place means the combat code does
//    not need to know anything about NPC internals.
import { CFG } from "../core/config.js?v=57";

const CELL = 192; // 2 map tiles: big enough that most queries hit 1-9 cells
const INV = 1 / CELL;

export const KIND_VEHICLE = 1;
export const KIND_NPC = 2;
export const KIND_PLAYER = 3; // the player on foot: cars must yield to them

// Flat bucket arrays: cheaper and more predictable than a Map of arrays.
let buckets = [];
let gridW = 0;
let gridH = 0;
// Buckets touched by the current frame. The city grid is 60x60 cells but only
// a couple of hundred entities move through it, so clearing the whole array
// every frame is pure waste - we clear only what we dirtied.
let touched = [];

function ensureGrid() {
  const w = Math.max(1, Math.ceil((CFG.COLS * CFG.TILE) * INV));
  const h = Math.max(1, Math.ceil((CFG.ROWS * CFG.TILE) * INV));
  if (w === gridW && h === gridH) return;
  gridW = w;
  gridH = h;
  buckets = new Array(w * h);
  for (let i = 0; i < buckets.length; i++) buckets[i] = [];
}

export function clearSpatial() {
  for (let i = 0; i < touched.length; i++) buckets[touched[i]].length = 0;
  touched.length = 0;
}

export function insertSpatial(obj, x, y, kind) {
  if (!buckets.length) ensureGrid();
  const cx = Math.floor(x * INV);
  const cy = Math.floor(y * INV);
  if (cx < 0 || cy < 0 || cx >= gridW || cy >= gridH) return;
  const i = cy * gridW + cx;
  const b = buckets[i];
  if (b.length === 0) touched.push(i);
  b.push(obj, kind);
}

function cellRange(x, y, r) {
  return {
    x0: Math.floor((x - r) * INV),
    x1: Math.floor((x + r) * INV),
    y0: Math.floor((y - r) * INV),
    y1: Math.floor((y + r) * INV),
  };
}

/**
 * Collect every indexed entity whose bucket overlaps the circle (x, y, r) into
 * `out` (an array of objects). No allocation: callers pass a reusable array.
 * Results are NOT distance-filtered; do that in the loop so the caller can also
 * apply a cheaper "forward cone" reject first.
 */
export function queryRadius(x, y, r, out) {
  out.length = 0;
  if (!buckets.length) return out;
  const { x0, x1, y0, y1 } = cellRange(x, y, r);
  const r2 = r * r;
  for (let cy = y0; cy <= y1; cy++) {
    if (cy < 0 || cy >= gridH) continue;
    const rowBase = cy * gridW;
    for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0 || cx >= gridW) continue;
      const b = buckets[rowBase + cx];
      if (b.length === 0) continue;
      for (let i = 0; i < b.length; i += 2) {
        const o = b[i];
        const dx = o.x - x;
        const dy = o.y - y;
        if (dx * dx + dy * dy <= r2) out.push(o);
      }
    }
  }
  return out;
}

/**
 * Same as `queryRadius` but returns alternating [obj, kind] pairs so callers can
 * tell cars from people without a second pass. Used by the pedestrian brain.
 */
export function queryRadiusTyped(x, y, r, out) {
  out.length = 0;
  if (!buckets.length) return out;
  const { x0, x1, y0, y1 } = cellRange(x, y, r);
  const r2 = r * r;
  for (let cy = y0; cy <= y1; cy++) {
    if (cy < 0 || cy >= gridH) continue;
    const rowBase = cy * gridW;
    for (let cx = x0; cx <= x1; cx++) {
      if (cx < 0 || cx >= gridW) continue;
      const b = buckets[rowBase + cx];
      if (b.length === 0) continue;
      for (let i = 0; i < b.length; i += 2) {
        const o = b[i];
        const dx = o.x - x;
        const dy = o.y - y;
        if (dx * dx + dy * dy <= r2) out.push(o, b[i + 1]);
      }
    }
  }
  return out;
}

// ── Noise bus ────────────────────────────────────────────────
export const NOISE_GUNSHOT = 1;
export const NOISE_IMPACT = 2;
export const NOISE_EXPLOSION = 3;
export const NOISE_ENGINE = 4;

const MAX_NOISES = 24;
const noises = [];

function dropNoise(i) {
  const last = noises.length - 1;
  noises[i] = noises[last];
  noises.pop();
}

/**
 * Announce a sound at a world position. `radius` is how far it carries in
 * pixels; listeners nearer than `radius * 0.35` hear it at full strength.
 */
export function reportNoise(x, y, radius, kind, intensity = 1) {
  if (!(radius > 0)) return;
  if (noises.length >= MAX_NOISES) dropNoise(0);
  noises.push({
    x, y,
    r: radius,
    r2: radius * radius,
    kind,
    intensity: Math.max(0.05, Math.min(2, intensity)),
    ttl: kind === NOISE_GUNSHOT ? 6 : 10,
  });
}

export function decayNoises() {
  for (let i = noises.length - 1; i >= 0; i--) {
    if (--noises[i].ttl <= 0) dropNoise(i);
  }
}

/** Drop every pending sound (used by tests and when a map is swapped). */
export function clearNoises() {
  noises.length = 0;
}

/**
 * Drain the noise queue. `cb(npc, strength, noise)` is called for every agent
 * that can hear it, where strength is 0..1 falling off with distance.
 * Draining here keeps the list from growing while nobody is listening.
 */
export function drainNoises(list, cb) {
  if (!noises.length || !list.length) return;
  const scratch = [];
  for (let i = noises.length - 1; i >= 0; i--) {
    const nz = noises[i];
    scratch.length = 0;
    queryRadiusTyped(nz.x, nz.y, nz.r, scratch);
    for (let k = 0; k < scratch.length; k += 2) {
      const o = scratch[k];
      if (!o.listen) continue;
      const dx = o.x - nz.x;
      const dy = o.y - nz.y;
      const d2 = dx * dx + dy * dy;
      if (d2 > nz.r2) continue;
      const d = Math.sqrt(d2);
      const t = d / nz.r;
      const strength = (t <= 0.35 ? 1 : 1 - (t - 0.35) / 0.65) * nz.intensity;
      if (strength <= 0.02) continue;
      cb(o, strength, nz);
    }
  }
}

/**
 * Build this frame's index. Called once per frame by the dispatcher so every
 * consumer sees the same snapshot; `stamp` guards against a double rebuild when
 * two systems both ask first. The player goes in as KIND_PLAYER so traffic
 * yields to them on foot without the pedestrians mistaking them for a car.
 */
export function beginSpatialFrame(npcs, vehicles, frameStamp, player) {
  if (frameStamp === beginSpatialFrame._stamp) return;
  beginSpatialFrame._stamp = frameStamp;
  ensureGrid();
  clearSpatial();
  if (vehicles) {
    for (let i = 0; i < vehicles.length; i++) {
      const v = vehicles[i];
      if (v.hidden || v.exploding) continue;
      insertSpatial(v, v.x, v.y, KIND_VEHICLE);
    }
  }
  if (npcs) {
    for (let i = 0; i < npcs.length; i++) {
      const n = npcs[i];
      if (n.dead) continue;
      insertSpatial(n, n.x, n.y, KIND_NPC);
    }
  }
  if (player && !player.inVehicle) {
    insertSpatial(player, player.x, player.y, KIND_PLAYER);
  }
}

beginSpatialFrame._stamp = -1;

export function forceSpatialRebuild() {
  beginSpatialFrame._stamp = -1;
}

export function spatialDebugInfo() {
  let n = 0;
  for (let i = 0; i < touched.length; i++) n += buckets[touched[i]].length >> 1;
  return { gridW, gridH, cells: buckets.length, activeCells: touched.length, entries: n, noises: noises.length };
}