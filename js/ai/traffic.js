// ======================== TRAFFIC ORCHESTRATOR ========================
// The new NPC vehicle system. Entry point for the game loop.
//
// Structure (all new, replacing the old driving-line brain):
//   * js/ai/roadNetwork.js - a lane graph carved from the tile map, with
//     signalised junctions and A* routing.
//   * js/ai/vehicleBrain.js - per-car pure-pursuit steering, IDM car
//     following, junction protocol and the kerbside parking manoeuvre.
//   * this module - spawning brains onto cars, per-frame upkeep, parked-car
//     recycling, and the stats the F3 overlay reads.
//
// The public contract is deliberately the same one the rest of the game
// already speaks:
//   * `updateTraffic(player)` once per frame,
//   * each AI car carries `v.traffic` with `state`, `speedNow`, `parkAngle`
//     (read by the renderer for brake lights and by the keyboard on entry),
//   * a car whose velocity is changed by somebody else (mission script, the
//     player) is handed over permanently.
import { CFG } from "../core/config.js?v=57";
import { vehicles } from "../entities/vehicles.js?v=57";
import { npcs } from "../entities/npcs.js?v=57";
import { isVisible, offscreenTiles, SPAWN_ROAD } from "./spawner.js?v=57";
import { spawnParkedDriver } from "./pedestrians.js?v=57";
import {
  rebuildRoadNetwork, invalidateRoadNetwork, updateSignals, nearestNode,
  nodeAtWorld, randomNode, findLanePath, pickDestination, setSignalFrameForTest,
  signalFrameForTest, roadNetworkReady, nodeCount, releaseJunction,
} from "./roadNetwork.js?v=57";
import {
  createBrain, updateVehicle, checkTakeover, finishPark,
} from "./vehicleBrain.js?v=57";

const PARK_RECYCLE_R = 4200;  // relocate parked cars this far out of sight
const RESPAWN_STUCK = 1400;   // frames motionless before a car is moved on

let frames = 0;

/**
 * Rebuild the lane graph. Called on every map load, next to the nav grid.
 * Also the hook the game loop replaces the old `loadTrafficNetwork` with.
 */
export function initTrafficNetwork() {
  invalidateRoadNetwork();
  return rebuildRoadNetwork();
}

/** Every car gets a brain the first time the loop sees it. */
function brainOf(v) {
  if (!v.traffic) v.traffic = createBrain(v);
  return v.traffic;
}

/**
 * Drop any junction box a car is holding.
 *
 * A car can leave AI control between two frames (the player takes the wheel,
 * a mission flags it, it is marked handed over). If it happened to own a
 * junction reservation at that moment, the box would stay claimed by a car
 * that will never move again - and every other approach would wait on a red
 * that never changes. Called for every car the loop skips.
 */
function releaseReservation(v) {
  const s = v.traffic;
  if (!s) return;
  // Force: the car is leaving AI control, so its body position must not keep
  // a crossing claimed by a driver who will never move again.
  if (s.reserved) { releaseJunction(s.reserved, v, true); s.reserved = null; }
  if (s.exitNode) { releaseJunction(s.exitNode, v, true); s.exitNode = null; }
  if (s.node && s.node.junction) { releaseJunction(s.node, v, true); s.node = null; }
  s.junctionHold = 0;
}

export function updateTraffic(player) {
  if (!roadNetworkReady()) return;
  frames++;
  updateSignals();
  const px = player ? (player.inVehicle || player).x : NaN;
  const py = player ? (player.inVehicle || player).y : NaN;

  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    if (v.hidden || v.exploding) continue;
    if (v.scripted) continue; // mission-controlled vehicle: bypass traffic brain
    if (v.driver || v.occupied || v.isPolice || v.isPersonal) {
      releaseReservation(v);
      continue;                 // player or police at the wheel
    }
    const s = brainOf(v);
    if (s.state === "handedOver") { releaseReservation(v); continue; }
    // A mission (or anything else) writing vx/vy directly wins the wheel.
    if ((s.state === "drive" || s.state === "pullOver") && checkTakeover(v, s)) {
      releaseReservation(v);
      continue;
    }

    const wasParked = s.state === "parked";
    updateVehicle(v, px, py);

    // The car has just decided to stop for good: its driver gets out.
    if (!wasParked && s.state === "parked") {
      try {
        spawnParkedDriver(v, npcs);
        v.driverLeft = true;
      } catch (e) {
        v.driverSpawnError = (e && e.message) || String(e);
        if (typeof console !== "undefined" && console.warn) {
          console.warn("SG traffic: parked driver failed to spawn -", v.driverSpawnError);
        }
      }
    }

    // Stuck far too long: move it somewhere off-screen and let it start a
    // fresh journey. Never respawn into the viewport.
    if (s.state === "drive" && s.stuck > RESPAWN_STUCK) {
      respawnCar(v, s, px, py);
    }
  }

  recycleParkedCars(px, py);
}

/**
 * Hand a wedged car to a fresh road tile outside the player's view.
 * Returns false when there is nothing off-screen to move it to - the car
 * then stays put and re-plans rather than blinking across the map.
 */
function respawnCar(v, s, px, py) {
  if (!Number.isFinite(px) || !Number.isFinite(py)) return false;
  // Try a handful of off-screen road tiles and take the first with room
  // around it: dropping a car on top of one already parked there would
  // leave the pair overlapping for good.
  const spots = offscreenTiles(px, py, SPAWN_ROAD, 5);
  let spot = null;
  for (const cand of spots) {
    const cx = cand.x * CFG.TILE + CFG.TILE / 2;
    const cy = cand.y * CFG.TILE + CFG.TILE / 2;
    if (isVisible(cx, cy, px, py)) continue;
    let clear = true;
    for (const o of vehicles) {
      if (o === v || o.hidden || o.exploding) continue;
      if (Math.hypot(o.x - cx, o.y - cy) < 120) { clear = false; break; }
    }
    if (clear) { spot = cand; break; }
  }
  if (!spot) return false;
  const x = spot.x * CFG.TILE + CFG.TILE / 2;
  const y = spot.y * CFG.TILE + CFG.TILE / 2;
  // The car is teleporting away from wherever it was standing, so any box it
  // held must be handed back - the old occupant will never arrive now.
  releaseReservation(v);
  v.x = x;
  v.y = y;
  v.vx = 0;
  v.vy = 0;
  s.wroteVX = 0;
  s.wroteVY = 0;
  s.speedNow = 0;
  s.stuck = 0;
  s.waitTimer = 0;
  s.hasDest = false;
  s.path.length = 0;
  s.pathIdx = 0;
  s.state = "drive";
  v.parked = false;
  v.parking = false;
  v.npcState = "moving";
  const n = nearestNode(x, y, 6);
  if (n) {
    const d = pickDestination(n, 0);
    v.moveAngle = d ? Math.atan2(d.wy - y, d.wx - x) : 0;
    v.angle = v.moveAngle;
  }
  return true;
}

/**
 * Parked cars out of sight are quietly moved to a fresh kerb near the player,
 * so the streets around you never thin out. Both the distance test and the
 * viewport test must fail before a car moves - relocating something you can
 * see is a visible jump.
 */
function recycleParkedCars(px, py) {
  if (!Number.isFinite(px) || !Number.isFinite(py)) return;
  const r2 = PARK_RECYCLE_R * PARK_RECYCLE_R;
  for (let i = 0; i < vehicles.length; i++) {
    const v = vehicles[i];
    if (v.hidden || v.exploding) continue;
    if (v.isPolice || v.isPersonal || v.occupied || v.driver) continue;
    const s = v.traffic;
    if (!s || s.state !== "parked") continue;
    const dx = v.x - px;
    const dy = v.y - py;
    if (dx * dx + dy * dy < r2) continue;
    if (isVisible(v.x, v.y, px, py)) continue;
    // Their driver is long gone by now.
    v.driverLeft = false;
    v.parked = false;
    s.state = "drive";
    s.speedNow = 0;
    s.stuck = 0;
    s.hasDest = false;
    respawnCar(v, s, px, py);
  }
}

// ── Compatibility surface ────────────────────────────────────
/**
 * Re-point a car at a new destination along the lanes. Kept under the old
 * name because js/main.js imports it.
 */
export function pickRandomDest(v) {
  const s = brainOf(v);
  const from = nearestNode(v.x, v.y, 6);
  if (!from) return;
  const to = pickDestination(from, v.moveAngle);
  if (!to) return;
  if (!findLanePath(from, to, s.path)) return;
  s.pathIdx = 0;
  s.dest = to;
  s.hasDest = true;
}

/**
 * Which way does the road go that best closes on (tx,ty)? Old signature kept
 * for the debug/console surface in js/main.js.
 */
export function chooseBestDir(v, tx, ty) {
  const here = nodeAtWorld(v.x, v.y);
  if (!here) return v.moveAngle || 0;
  let best = null;
  let bestD = Infinity;
  for (let d = 0; d < 4; d++) {
    const lane = here.out[d];
    if (!lane) continue;
    const nd = (lane.to.wx - tx) ** 2 + (lane.to.wy - ty) ** 2;
    if (nd < bestD) { bestD = nd; best = d; }
  }
  if (best === null) return v.moveAngle || 0;
  return [0, Math.PI / 2, Math.PI, -Math.PI / 2][best];
}

export function trafficStats() {
  let driving = 0;
  let pulling = 0;
  let parked = 0;
  let handedOver = 0;
  for (let i = 0; i < vehicles.length; i++) {
    const s = vehicles[i].traffic;
    if (!s) continue;
    if (s.state === "parked") parked++;
    else if (s.state === "pullOver") pulling++;
    else if (s.state === "handedOver") handedOver++;
    else driving++;
  }
  return {
    nodes: nodeCount(),
    driving, pulling, parked, handedOver,
    frame: frames,
  };
}

/** Reset every AI car's brain - used when a save is loaded. */
export function resetTrafficBrains() {
  for (let i = 0; i < vehicles.length; i++) vehicles[i].traffic = null;
  frames = 0;
}

/** Signal hooks for tests: arrange a red on arrival, or read the cycle. */
export const __test = { setSignalFrameForTest, signalFrameForTest };
