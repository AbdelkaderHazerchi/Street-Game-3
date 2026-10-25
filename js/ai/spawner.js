/**
 * Putting things where the player cannot see them appear.
 *
 * Anything that spawns, recycles or is relocated has to land outside the
 * viewport. Otherwise the street ahead of you fills in as you walk towards it:
 * the renderer draws roughly `W/zoom` by `H/zoom` world pixels around the
 * camera, so a spawn ring any closer than that is visible pop-in.
 *
 * The ring is derived from the camera rather than hard-coded, which matters
 * because the view size changes with the window and the zoom level - a radius
 * tuned for one window is wrong for every other one.
 *
 * Anchoring on the camera itself would be wrong too: the camera leads the
 * player slightly, so a spawn can be off-camera and still on-screen. The player
 * position is the thing that must stay clear, and the margin below absorbs the
 * camera's lead and the HUD gutters.
 */

import { W, H, zoom } from "../core/canvas.js?v=57";
import { CFG } from "../core/config.js?v=57";
import { CELL } from "./density.js?v=57";
import {
  navCols,
  navRows,
  isRoadTile,
  isSidewalkTile,
  isWalkableTile,
} from "./navGrid.js?v=57";

/** World pixels of slack kept clear beyond the viewport on every side. */
export const VIEW_MARGIN = 260;

/** Used when no canvas has been sized yet (headless tests, early boot). */
const FALLBACK_VIEW_W = 1600;
const FALLBACK_VIEW_H = 900;

const TILE = CFG.TILE;

function viewSize() {
  const w = typeof W === "number" && isFinite(W) && W > 0 ? W : FALLBACK_VIEW_W;
  const h = typeof H === "number" && isFinite(H) && H > 0 ? H : FALLBACK_VIEW_H;
  const z = typeof zoom === "number" && isFinite(zoom) && zoom > 0 ? zoom : 1;
  return { w: w / z, h: h / z, z };
}

/**
 * The rectangle the player must not see a spawn inside: the viewport widened by
 * `VIEW_MARGIN`.
 *
 * Anchored on the player's own position. `hud.updateCamera()` sets the camera to
 * exactly the player position every frame, so there is no camera lead to account
 * for - and deliberately reading `cam` here would be worse than useless: before
 * the first update (and in the headless harness) `cam` is still {0,0}, which
 * would inflate the box by the distance from the map origin and leave nowhere
 * legal to spawn.
 */
export function keepClearRect(ax, ay, margin = VIEW_MARGIN) {
  const v = viewSize();
  const hw = v.w / 2 + margin;
  const hh = v.h / 2 + margin;
  return { x0: ax - hw, y0: ay - hh, x1: ax + hw, y1: ay + hh, hw, hh };
}

export function isVisible(x, y, ax, ay, margin = VIEW_MARGIN) {
  const r = keepClearRect(ax, ay, margin);
  return x >= r.x0 && x <= r.x1 && y >= r.y0 && y <= r.y1;
}

/**
 * How far out a spawn may be. The inner bound puts candidates just past the
 * keep-clear rectangle; the outer bound stops the ring running so far that
 * traffic is simulated where nobody will ever drive.
 */
export function spawnRing(ax, ay, margin = VIEW_MARGIN) {
  const r = keepClearRect(ax, ay, margin);
  const diag = Math.hypot(r.hw, r.hh);
  return { min: diag * 0.78, max: diag * 1.85, rect: r };
}

/**
 * Beyond this, pedestrians are streamed out of the simulation entirely.
 *
 * The floor matters: the radius has to stay comfortably larger than the spawn
 * ring, or characters are put into the world and swept straight back out again.
 * It is also kept at least as large as the old fixed 3200, so the populated
 * area around the player does not shrink - a smaller radius reads as the city
 * emptying out, which is the opposite of what was asked for.
 */
export function cullRadius(ax, ay, margin = VIEW_MARGIN) {
  const ring = spawnRing(ax, ay, margin);
  const r = ring.max * 1.45;
  return Math.max(3400, Math.min(5400, r));
}

const KIND_SIDEWALK = 1;
const KIND_WALKABLE = 2;
const KIND_ROAD = 3;

function inBounds(tx, ty) {
  return tx >= 0 && ty >= 0 && tx < navCols() && ty < navRows();
}

/**
 * Collect up to `count` tiles of the requested kind that sit outside the
 * keep-clear rectangle.
 *
 * Candidates are drawn from an annulus around the player rather than from a
 * square, so the sample density per screen area stays roughly even. The search
 * widens in three steps before it will consider an on-screen tile:
 *
 *   1. the natural ring just outside the viewport,
 *   2. a wider ring further out, for players boxed in by the map edge,
 *   3. a scan of the whole map, for a player standing in a corner.
 *
 * On-screen placement is the last resort only, because it is visible to the
 * player; returning nothing is usually worse than a rare pop-in at the very edge
 * of the world, so it stays available as a floor.
 */
export function offscreenTiles(ax, ay, kind, count, opts = {}) {
  const out = [];
  const want = count || 1;
  const cols = navCols();
  const rows = navRows();
  if (!cols || !rows) return out;
  const margin = opts.margin === undefined ? VIEW_MARGIN : opts.margin;
  const ring = spawnRing(ax, ay, margin);

  const accept = (tx, ty) => {
    if (!inBounds(tx, ty)) return false;
    if (isVisible(tx * TILE + TILE / 2, ty * TILE + TILE / 2, ax, ay, margin)) return false;
    if (!tileMatches(tx, ty, kind)) return false;
    // Keep the ring from stacking everything into a single screen corner.
    for (let k = 0; k < out.length; k++) {
      if (Math.abs(out[k].x - tx) < 2 && Math.abs(out[k].y - ty) < 2) return false;
    }
    out.push({ x: tx, y: ty });
    return true;
  };

  const sample = (minR, maxR, attempts) => {
    for (let i = 0; i < attempts && out.length < want; i++) {
      const a = Math.random() * Math.PI * 2;
      // sqrt for area-uniform sampling of the annulus
      const r = minR + Math.sqrt(Math.random()) * (maxR - minR);
      accept(Math.floor((ax + Math.cos(a) * r) / TILE), Math.floor((ay + Math.sin(a) * r) / TILE));
    }
  };

  sample(ring.min, opts.maxR || ring.max, opts.attempts || 120);
  if (out.length < want) sample(opts.maxR || ring.max, (opts.maxR || ring.max) * 1.9, 160);
  if (out.length < want) {
    // Whole-map scan. Cheap and it only runs when the player is boxed in.
    for (let i = 0; i < 4000 && out.length < want; i++) {
      accept((Math.random() * cols) | 0, (Math.random() * rows) | 0);
    }
  }
  if (out.length < want) {
    // Nothing off-screen exists (a tiny map, or a huge viewport). A visible
    // spawn beats an empty street, so take one and let the caller know by the
    // fact that it got fewer tiles than it asked for.
    for (let r = 1; r <= 40 && out.length < want; r++) {
      for (let i = 0; i < 400 && out.length < want; i++) {
        const tx = (Math.random() * cols) | 0;
        const ty = (Math.random() * rows) | 0;
        if (!inBounds(tx, ty) || !tileMatches(tx, ty, kind)) continue;
        let dup = false;
        for (let k = 0; k < out.length; k++) {
          if (Math.abs(out[k].x - tx) < 2 && Math.abs(out[k].y - ty) < 2) { dup = true; break; }
        }
        if (dup) continue;
        out.push({ x: tx, y: ty });
      }
    }
  }
  return out;
}

function tileMatches(tx, ty, kind) {
  if (kind === KIND_ROAD) return isRoadTile(tx, ty);
  if (kind === KIND_SIDEWALK) return isSidewalkTile(tx, ty);
  return isWalkableTile(tx, ty);
}

/**
 * Collect candidate CELL origins (4x4 tile squares) around the player.
 *
 * The population is specified per 4x4 square - "one person per 4x4 in the
 * suburbs, four per 4x4 downtown" - so the spawner has to work in those units.
 * Sampling individual tiles instead makes it impossible to fill a single square
 * to its cap: the de-duplication spreads the candidates over a wide area, and
 * the crowd ends up spread one-per-square everywhere instead of packed into the
 * busy ones.
 *
 * The cells returned are only *candidates*: whether a square can actually hold
 * anybody depends on the pavement inside it, which the caller checks.
 */
export function candidateCells(ax, ay, maxR, count) {
  const out = [];
  const want = count || 40;
  const seen = new Set();
  const cols = navCols();
  const rows = navRows();
  const cell = CELL;
  const ring = spawnRing(ax, ay);
  const lo = Math.max(ring.min, 0);
  const hi = maxR || ring.max;

  const consider = (tx, ty) => {
    if (tx < 0 || ty < 0 || tx >= cols || ty >= rows) return;
    const cx = Math.floor(tx / cell) * cell;
    const cy = Math.floor(ty / cell) * cell;
    const k = cy * cols + cx;
    if (seen.has(k)) return;
    seen.add(k);
    out.push({ x: cx, y: cy });
  };

  for (let i = 0; i < 600 && out.length < want; i++) {
    const a = Math.random() * Math.PI * 2;
    const r = lo + Math.sqrt(Math.random()) * (hi - lo);
    consider(
      Math.floor((ax + Math.cos(a) * r) / TILE),
      Math.floor((ay + Math.sin(a) * r) / TILE),
    );
  }
  return out;
}

export const SPAWN_SIDEWALK = KIND_SIDEWALK;
export const SPAWN_WALKABLE = KIND_WALKABLE;
export const SPAWN_ROAD = KIND_ROAD;

/** Diagnostics for the F3 overlay and the test suite. */
export function spawnerStats(ax, ay) {
  const v = viewSize();
  const ring = spawnRing(ax, ay);
  return {
    viewW: Math.round(v.w),
    viewH: Math.round(v.h),
    zoom: v.z,
    keepClear: {
      w: Math.round(ring.rect.hw * 2),
      h: Math.round(ring.rect.hh * 2),
    },
    ringMin: Math.round(ring.min),
    ringMax: Math.round(ring.max),
    cullRadius: Math.round(cullRadius(ax, ay)),
  };
}
