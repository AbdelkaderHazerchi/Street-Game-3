// ======================== VEHICLES ========================
// Extracted from game.js:51599, 51650-51796 - no logic changed
import { CFG } from "../core/config.js?v=57";
import { T } from "../core/config.js?v=57";
import { getTile } from "../map/mapUtils.js?v=57";
import { playCarExplosion } from "../audio/sounds.js?v=57";
import { offscreenTiles, SPAWN_ROAD } from "../ai/spawner.js?v=57";

export let vehicles = [];
export let explosions = [];
export const EXPLOSION_DURATION = 900; // ms matching car_explotion.svg timeline (0-900)
export const EXPLOSION_SIZE = 140; // draw size for explosion overlay
export let explosionImg = null;
export function setExplosionImg(img) { explosionImg = img; }

export const VEHICLE_TYPES = [
  {
    name: "سيدان",
    w: 60,
    h: 32,
    speed: 4.5,
    accel: 0.15,
  },
  {
    name: "رياضية",
    w: 56,
    h: 28,
    speed: 5.5,
    accel: 0.2,
  },
  {
    name: "شاحنة",
    w: 76,
    h: 40,
    speed: 3.5,
    accel: 0.08,
  },
  {
    name: "SUV",
    w: 68,
    h: 36,
    speed: 4.0,
    accel: 0.12,
  },
  {
    name: "سيارة شرطة",
    w: 60,
    h: 32,
    speed: 5.0,
    accel: 0.18,
  },
  {
    name: "BMW-s5",
    w: 58,
    h: 30,
    speed: 5.8,
    accel: 0.22,
  },
  {
    name: "Mercedes-g8",
    w: 72,
    h: 38,
    speed: 5.2,
    accel: 0.2,
  },
  {
    name: "Porsche-911",
    w: 56,
    h: 28,
    speed: 6.2,
    accel: 0.24,
  },
  {
    name: "Ferrari-488",
    w: 54,
    h: 26,
    speed: 6.4,
    accel: 0.26,
  },
  {
    name: "Lamborghini-Huracan",
    w: 56,
    h: 27,
    speed: 6.6,
    accel: 0.27,
  },
  {
    name: "Cobra-GT",
    w: 62,
    h: 32,
    speed: 5.9,
    accel: 0.22,
  },
  {
    name: "Dominator-X",
    w: 70,
    h: 36,
    speed: 5.4,
    accel: 0.2,
  },
];

/**
 * @param {number} [nearX] optional world position to populate around. Traffic
 *   that starts 40 blocks away reads as an empty city until it wanders in, so
 *   the caller passes the player's position. Spawns still land outside the
 *   viewport, so the streets ahead are not empty *and* nobody pops into being.
 */
export function spawnVehicles(nearX, nearY) {
  vehicles.length = 0;
  explosions.length = 0;
  const hasNear = typeof nearX === "number" && isFinite(nearX);
  const ax = hasNear ? nearX : (CFG.COLS * CFG.TILE) / 2;
  const ay = hasNear ? nearY : (CFG.ROWS * CFG.TILE) / 2;
  // Build civilian type pool robustly (exclude police and player-only exclusive cars)
  const civilianPool = VEHICLE_TYPES.filter(t =>
    t.name !== "سيارة شرطة" &&
    t.name !== "BMW-s5" &&
    t.name !== "Mercedes-g8" &&
    t.name !== "Porsche-911" &&
    t.name !== "Ferrari-488" &&
    t.name !== "Lamborghini-Huracan" &&
    t.name !== "Cobra-GT" &&
    t.name !== "Dominator-X"
  );
  // Road tiles just beyond the keep-clear rectangle, spread around the player.
  const roadSpots = hasNear
    ? offscreenTiles(ax, ay, SPAWN_ROAD, CFG.NPC_VEHICLE_COUNT * 2)
    : [];

  for (let i = 0; i < CFG.NPC_VEHICLE_COUNT; i++) {
    let x,
      y;
    // Off-screen ring first. Fall back to anywhere on the map only if the ring
    // came up empty - a player in a corner, or a sparse stretch of coast.
    const ring = roadSpots.length ? roadSpots[i % roadSpots.length] : null;
    if (ring) {
      x = ring.x * CFG.TILE + CFG.TILE / 2;
      y = ring.y * CFG.TILE + CFG.TILE / 2;
    } else {
      x = (3 + Math.floor(Math.random() * (CFG.COLS - 6))) * CFG.TILE + CFG.TILE / 2;
      y = (3 + Math.floor(Math.random() * (CFG.ROWS - 6))) * CFG.TILE + CFG.TILE / 2;
    }
    if (!isOnRoad(x, y)) continue;
    // Refuse to drop a car on top of one that is already there: two cars sharing
    // a spot each see the other as an obstacle and both hold still, which
    // gridlocks that street for good.
    if (vehicles.some((o) => !o.hidden && Math.hypot(o.x - x, o.y - y) < 84)) continue;

    const type = civilianPool[Math.floor(Math.random() * civilianPool.length)] || civilianPool[0];
    if(!type) continue;
    // Determine initial direction based on road orientation at spawn
    const spawnTX = Math.floor(x / CFG.TILE);
    const spawnTY = Math.floor(y / CFG.TILE);
    let initAngle = 0;
    if (getTile(spawnTX + 1, spawnTY) === T.ROAD) {
      initAngle = 0;
    } else if (getTile(spawnTX - 1, spawnTY) === T.ROAD) {
      initAngle = Math.PI;
    } else if (getTile(spawnTX, spawnTY + 1) === T.ROAD) {
      initAngle = Math.PI / 2;
    } else if (getTile(spawnTX, spawnTY - 1) === T.ROAD) {
      initAngle = (3 * Math.PI) / 2;
    }
    const health = 15 + Math.floor(Math.random() * 9); // 15-23 bullets to detonate
    const cruiseSpeed = 1.6 + Math.random() * 0.6;
    const v = {
      x,
      y,
      w: type.w,
      h: type.h,
      speed: type.speed + (Math.random() - 0.5) * 0.5,
      cruiseSpeed,
      type: type,
      typeIdx: VEHICLE_TYPES.indexOf(type),
      angle: initAngle,
      vx: 0,
      vy: 0,
      driver: null,
      isPolice: false,
      isPersonal: false,
      siren: false,
      occupied: false,
      hidden: false,
      exploding: false,
      health: health,
      maxHealth: health,
      npcTargetX: x,
      npcTargetY: y,
      npcWaitTimer: 0,
      npcState: "moving",
      moveAngle: initAngle,
    };
    // Place on road facing along road direction
    vehicles.push(v);
  }

  // Police vehicles (capped attempts to avoid infinite loop on water-only maps)
  const policeSpots = hasNear
    ? offscreenTiles(ax, ay, SPAWN_ROAD, CFG.POLICE_VEHICLE_COUNT * 2)
    : [];
  for (let i = 0; i < CFG.POLICE_VEHICLE_COUNT; i++) {
    let x, y;
    const spot = policeSpots.length ? policeSpots[i % policeSpots.length] : null;
    if (spot) {
      x = spot.x * CFG.TILE + CFG.TILE / 2;
      y = spot.y * CFG.TILE + CFG.TILE / 2;
    } else {
      x = (3 + Math.floor(Math.random() * (CFG.COLS - 6))) * CFG.TILE + CFG.TILE / 2;
      y = (3 + Math.floor(Math.random() * (CFG.ROWS - 6))) * CFG.TILE + CFG.TILE / 2;
    }
    if (!isOnRoad(x, y)) continue;
    // Same anti-gridlock rule as the civilian traffic above.
    if (vehicles.some((o) => !o.hidden && Math.hypot(o.x - x, o.y - y) < 84)) continue;

    const pt = VEHICLE_TYPES[4];
    const pvHealth = 15 + Math.floor(Math.random() * 9);
    const pv = {
      x,
      y,
      w: pt.w,
      h: pt.h,
      speed: CFG.POLICE_SPEED,
      type: pt,
      typeIdx: VEHICLE_TYPES.indexOf(pt),
      angle: Math.random() * Math.PI * 2,
      vx: 0,
      vy: 0,
      driver: null,
      isPolice: true,
      isPersonal: false,
      siren: false,
      occupied: false,
      hidden: false,
      exploding: false,
      health: pvHealth,
      maxHealth: pvHealth,
    };
    vehicles.push(pv);
  }
}

export function explodeVehicle(vi) {
  const v = vehicles[vi];
  if (!v || v.hidden || v.exploding) return null;
  // Hide vehicle immediately, keep in array until animation finishes
  v.hidden = true;
  v.exploding = true;
  // Create explosion effect at vehicle position
  const exp = {
    x: v.x,
    y: v.y,
    t: 0,
    duration: EXPLOSION_DURATION,
    vehicle: v,
    // tie to vehicle reference for removal; also store rotation for debris?
  };
  explosions.push(exp);
  try { playCarExplosion(); } catch {}
  return exp;
}

export function updateExplosions(dt = 16) {
  for (let i = explosions.length - 1; i >= 0; i--) {
    const e = explosions[i];
    e.t += dt;
    if (e.t >= e.duration) {
      // Animation finished -> remove vehicle permanently
      const vi = vehicles.indexOf(e.vehicle);
      if (vi >= 0) vehicles.splice(vi, 1);
      explosions.splice(i, 1);
    }
  }
}

export function clearExplosions() { explosions.length = 0; }

export function isOnRoad(px, py) {
  const tx = Math.floor(px / CFG.TILE);
  const ty = Math.floor(py / CFG.TILE);
  if (tx < 0 || tx >= CFG.COLS || ty < 0 || ty >= CFG.ROWS) return false;
  return getTile(tx, ty) === T.ROAD;
}

export function isWalkable(px, py) {
  const tx = Math.floor(px / CFG.TILE);
  const ty = Math.floor(py / CFG.TILE);
  if (tx < 0 || tx >= CFG.COLS || ty < 0 || ty >= CFG.ROWS) return false;
  const tile = getTile(tx, ty);
  return (
    tile === T.ROAD ||
    tile === T.SIDEWALK ||
    tile === T.PAVEMENT ||
    tile === T.PARK ||
    tile === T.PARKING
  );
}
