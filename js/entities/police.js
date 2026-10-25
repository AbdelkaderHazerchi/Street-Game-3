// ======================== POLICE AI SYSTEM ========================
// Station-based, star-scaled, foot 1-block, vehicle 2-block + interception, LOS 10 blocks -> search 60s -> forget, patrol 4 blocks, speed +0.2

import { CFG } from "../core/config.js?v=57";
import { getTile } from "../map/mapUtils.js?v=57";
import { player } from "./player.js?v=57";
import { vehicles, VEHICLE_TYPES } from "./vehicles.js?v=57";
import { isWalkable, isOnRoad } from "./vehicles.js?v=57";
import { shootBullet } from "../combat/shooting.js?v=57";
import { findPath } from "../ai/pathfinding.js?v=57";
import { kerbSpotNear } from "../ai/parking.js?v=57";
import { updateWantedUI } from "../ui/hud.js?v=57";
import { playerDie } from "./player.js?v=57";
import { specialBuildings } from "../map/mapState.js?v=57";

export let police = [];
export function clearPolice(){ police.length = 0; }
export function setPolice(v){ police = v; }
export let _policeLastWanted = 0;

const TILE = CFG.TILE;
const SEARCH_TIME = 60000;
const PATROL_RADIUS = 4;
const FOOT_FOLLOW = TILE * 1;
const CAR_STOP = TILE * 2;
const LOS_BLOCKS = 10;

const STAR_CONFIG = {
  0: { foot: 0, cars: 0, intercept: false },
  1: { foot: 2, cars: 1, intercept: false },
  2: { foot: 3, cars: 2, intercept: true },
  3: { foot: 4, cars: 2, intercept: true },
  4: { foot: 5, cars: 4, intercept: true },
  5: { foot: 8, cars: 6, intercept: true },
};

/**
 * Send an officer to a car that is blocking the road.
 *
 * A driver who leaves the car across the carriageway is a traffic hazard, not
 * a criminal, so this is not the wanted-level machinery: the officer drives
 * over, parks properly, and waits. When the driver comes back and drives off,
 * the officer follows.
 *
 * The call is deliberately independent of the player - it must still work when
 * nobody is wanted, which is exactly when a badly parked car is most annoying.
 */
export function dispatchTrafficViolation(x, y, vehicle) {
  if (!isFinite(x) || !isFinite(y)) return null;
  // Re-use an officer who is already on the road if there is one, otherwise
  // wake a patrol officer up.
  let officer = null;
  for (const p of police) {
    if (p.violation) continue;
    if (!p.active && p.state !== "patrol") continue;
    if (p.inVehicle) { officer = p; break; }
  }
  if (!officer) {
    for (const p of police) {
      if (p.violation) continue;
      if (p.state === "patrol") { officer = p; break; }
    }
  }
  if (!officer) {
    // No officer to spare: create one on the spot, next to the car.
    const station = getPoliceStations()[0] || null;
    officer = createOfficer(x, y, "chase", station);
    officer.active = true;
    police.push(officer);
  }
  officer.violation = { x, y, veh: vehicle || null };
  officer.active = true;
  officer.state = "chase";
  officer.uncertainTimer = 0;
  officer.path = null;
  return officer;
}

export function updatePolice() {
  if (!player || typeof player.wanted !== "number") return;
  if (player.wanted <= 0) {
    _policeLastWanted = 0;
    for (let i = police.length - 1; i >= 0; i--) {
      const p = police[i];
      if (p.active && p.state !== "patrol" && p.state !== "returning" && p.state !== "uncertain") {
        if (p.inVehicle) { p.inVehicle.driver = null; p.inVehicle.occupied = false; }
        police.splice(i, 1);
      } else if (!p.active && p.state !== "patrol") {
        // remove inactive uncertain/returning to prevent leak
        if (p.inVehicle) { p.inVehicle.driver = null; p.inVehicle.occupied = false; }
        // keep if within timeout, else remove
        if (p.uncertainTimer && p.uncertainTimer > 0) continue;
        if (p.state === "returning" && p.targetReturn) {
          const d = Math.hypot(p.x - p.targetReturn.x, p.y - p.targetReturn.y);
          if (d < TILE*3) {
            p.state = "patrol";
            p.active = false;
            p.targetReturn = null;
            continue;
          }
        }
        // if far and no station, remove
        if (!p.station) {
          police.splice(i,1);
        }
      }
    }
    cleanupVehicles(0);
    const stations = getPoliceStations();
    ensureStationOfficers(stations);
    updatePatrolOfficers();
    return;
  }

  const wanted = Math.min(5, player.wanted);
  const config = STAR_CONFIG[wanted];
  const target = player.inVehicle || player;
  const playerInVehicle = !!player.inVehicle;

  const stations = getPoliceStations();

  // Wanted decay: 6 squares away -> 20s per star, reset if spotted
  {
    let nearestDist = Infinity;
    for (const p of police) {
      if (!p.active) continue;
      const d = Math.hypot(p.x - target.x, p.y - target.y);
      if (d < nearestDist) nearestDist = d;
    }
    const isFar = police.length === 0 || nearestDist >= TILE * 6;
    if (isFar) {
      player.wantedTimer = (player.wantedTimer || 0) + 16;
      if (player.wantedTimer >= 20000) {
        player.wanted--;
        player.wantedTimer = 0;
        if (player.wanted < 0) player.wanted = 0;
        updateWantedUI();
        if (player.wanted <= 0) {
          player.wanted = 0;
          player.wantedTimer = 0;
        }
      }
    } else {
      player.wantedTimer = 0;
    }
    if (player.wanted <= 0) {
      // will be handled next frame, but ensure UI
      updateWantedUI();
    }
  }

  // ensure station patrol
  ensureStationOfficers(stations);
  updatePatrolOfficers();

  // spawn to match stars (one batch per frame, capped)
  spawnForStars(config, stations, target);

  // update each officer
  for (const p of police) {
    if (!p.active && p.state === "patrol") continue;
    updateOfficer(p, target, playerInVehicle, config);
  }

  // cleanup excess
  cleanupPolice(config);
  cleanupVehicles(config.cars);

  // shooting handled inside updateOfficer via timers
}

function getPoliceStations() {
  const raw = [];
  for (const sb of specialBuildings) {
    if (!sb.name || !sb.name.toLowerCase().includes("police")) continue;
    raw.push(sb);
  }
  if (!raw.length) return [{ x: CFG.COLS/2 * TILE, y: CFG.ROWS/2 * TILE, tileX: Math.floor(CFG.COLS/2), tileY: Math.floor(CFG.ROWS/2) }];
  raw.sort((a,b)=> a.y - b.y || a.x - b.x);
  const sbMap = new Map();
  for (const sb of raw) sbMap.set(sb.x+","+sb.y, sb);
  const visited = new Set();
  const blocks = [];
  for (const sb of raw) {
    const key = sb.x+","+sb.y;
    if (visited.has(key)) continue;
    const r = sbMap.get((sb.x+1)+","+sb.y);
    const d = sbMap.get(sb.x+","+(sb.y+1));
    const diag = sbMap.get((sb.x+1)+","+(sb.y+1));
    if (r && d && diag && r.name===sb.name && d.name===sb.name && diag.name===sb.name) {
      if (!visited.has((sb.x+1)+","+sb.y) && !visited.has(sb.x+","+(sb.y+1)) && !visited.has((sb.x+1)+","+(sb.y+1))) {
        blocks.push({ x: sb.x * TILE + TILE, y: sb.y * TILE + TILE, tileX: sb.x, tileY: sb.y });
        visited.add(key); visited.add((sb.x+1)+","+sb.y); visited.add(sb.x+","+(sb.y+1)); visited.add((sb.x+1)+","+(sb.y+1));
        continue;
      }
    }
    if (visited.has(key)) continue;
    visited.add(key);
    blocks.push({ x: sb.x * TILE + TILE/2, y: sb.y * TILE + TILE/2, tileX: sb.x, tileY: sb.y });
  }
  return blocks;
}

function ensureStationOfficers(stations) {
  if (!stations || !stations.length) return;
  for (const st of stations) {
    if (!st || typeof st.x !== "number") continue;
    let nearby = 0;
    for (const p of police) {
      if (p.state === "patrol" && p.station && p.station.tileX === st.tileX && p.station.tileY === st.tileY) {
        if (Math.hypot(p.x - st.x, p.y - st.y) < TILE * (PATROL_RADIUS + 2)) nearby++;
      }
    }
    let needed = 2 - nearby;
    let attempts = 0;
    while (needed > 0 && attempts < 30) {
      attempts++;
      const ang = Math.random() * Math.PI * 2;
      const dist = TILE * (0.5 + Math.random() * PATROL_RADIUS);
      const px = st.x + Math.cos(ang) * dist;
      const py = st.y + Math.sin(ang) * dist;
      if (!isWalkable(px, py)) continue;
      const off = createOfficer(px, py, "patrol", st);
      off.active = false;
      police.push(off);
      needed--;
      attempts = 0;
    }
  }
}

function updatePatrolOfficers() {
  for (const p of police) {
    if (p.state !== "patrol") continue;
    if (!p.station || typeof p.station.x !== "number") continue;
    p.timer = (p.timer || 0) - 16;
    if (p.timer <= 0) {
      if (Math.random() < 0.7) {
        const ang = Math.random() * Math.PI * 2;
        const dist = TILE * (1 + Math.random() * PATROL_RADIUS);
        const tx = p.station.x + Math.cos(ang) * dist;
        const ty = p.station.y + Math.sin(ang) * dist;
        if (isWalkable(tx, ty)) {
          p.path = findPath(p.x, p.y, tx, ty, 30);
          p.pathTimer = 40;
        }
      } else {
        p.path = null;
      }
      p.timer = 2000 + Math.random() * 3000;
    }
    if (p.path && p.path.length) followPath(p);
    else {
      // idle
    }
  }
}

function spawnForStars(config, stations, target) {
  const desiredFoot = config.foot;
  const desiredCars = config.cars;

  let activeFoot = 0;
  let activeCarDrivers = 0;
  for (const p of police) {
    if (!p.active) continue;
    if (p.state === "patrol" || p.state === "returning") continue;
    if (p.inVehicle) activeCarDrivers++;
    else activeFoot++;
  }
  let policeVehicles = 0;
  for (const v of vehicles) if (v.isPolice && !v.hidden && !v.exploding) policeVehicles++;

  // reuse patrol officers first to avoid unlimited spawn
  while (activeFoot < desiredFoot) {
    const patrol = police.find(p => p.state === "patrol" && !p.active);
    if (!patrol) break;
    patrol.active = true;
    patrol.state = "chase";
    patrol.path = null;
    patrol.pathTimer = 0;
    patrol.uncertainTimer = 0;
    activeFoot++;
  }

  // spawn foot one by one, cap attempts
  let spawnAttempts = 0;
  while (activeFoot < desiredFoot && spawnAttempts < 5) {
    spawnAttempts++;
    let px, py;
    let tries = 0;
    let found = false;
    while (tries < 12) {
      tries++;
      const base = Math.random() < 0.7 ? { x: target.x, y: target.y } : stations[Math.floor(Math.random()*stations.length)];
      const ang = Math.random() * Math.PI * 2;
      const dist = TILE * (4 + Math.random() * 6);
      px = base.x + Math.cos(ang) * dist;
      py = base.y + Math.sin(ang) * dist;
      if (isWalkable(px, py)) { found = true; break; }
    }
    if (!found) continue;
    const st = stations[Math.floor(Math.random()*stations.length)];
    police.push(createOfficer(px, py, "chase", st));
    activeFoot++;
    break; // only one per frame to avoid burst
  }

  // spawn cars one by one
  spawnAttempts = 0;
  while (activeCarDrivers < desiredCars && policeVehicles < desiredCars && spawnAttempts < 3) {
    spawnAttempts++;
    let tries = 0, vx, vy, found=false;
    while (tries < 15) {
      tries++;
      const base = stations[Math.floor(Math.random()*stations.length)];
      const ang = Math.random() * Math.PI * 2;
      const dist = TILE * (6 + Math.random() * 8);
      vx = base.x + Math.cos(ang) * dist;
      vy = base.y + Math.sin(ang) * dist;
      if (isOnRoad(vx, vy)) { found = true; break; }
    }
    if (!found) continue;
    const vType = VEHICLE_TYPES.find(v => v.name === "سيارة شرطة") || VEHICLE_TYPES[4];
    const veh = {
      x: vx, y: vy, w: vType.w, h: vType.h,
      speed: vType.speed, type: vType, typeIdx: VEHICLE_TYPES.indexOf(vType),
      angle: Math.random()*Math.PI*2, vx: 0, vy: 0,
      driver: null, isPolice: true, siren: true, occupied: false, isPersonal: false,
      hidden: false, exploding: false, health: 20, maxHealth: 20,
      npcTargetX: vx, npcTargetY: vy,
    };
    vehicles.push(veh);
    const st = stations[Math.floor(Math.random()*stations.length)];
    const driver = createOfficer(vx, vy, "vehicle_patrol", st);
    driver.inVehicle = veh;
    driver.active = true;
    veh.driver = driver;
    veh.occupied = true;
    police.push(driver);
    activeCarDrivers++;
    policeVehicles++;
    break;
  }

  for (const p of police) {
    if (p.active && p.state !== "patrol" && p.state !== "returning") p.interceptMode = config.intercept;
  }
}

function createOfficer(x, y, state, station) {
  return {
    x, y, vx: 0, vy: 0, angle: 0,
    speed: CFG.PLAYER_SPEED + 0.2 + Math.random()*0.1,
    state, color: "#ffffff", size: 10,
    timer: 0, health: 30, inVehicle: null,
    active: state !== "patrol",
    forgetTimer: 0,
    targetVehicle: null, path: null, pathTimer: 0,
    interceptMode: false,
    station,
    lastKnownPlayerPos: null,
    shotsFired: 0,
    uncertainTimer: 0,
    // A traffic call: a car blocking the road somewhere in the city.
    violation: null,
  };
}

function cleanupPolice(config) {
  const maxFoot = config.foot;
  const maxCars = config.cars;
  const maxTotal = maxFoot + maxCars;
  // count all active pursuers including uncertain (patrol and returning excluded)
  let activePursuers = police.filter(p => p.active && p.state !== "patrol" && p.state !== "returning");
  let footPursuers = activePursuers.filter(p => !p.inVehicle).length;
  let carPursuers = activePursuers.filter(p => p.inVehicle).length;

  // remove excess foot (including uncertain)
  while (footPursuers > maxFoot) {
    const idx = police.findIndex(p => p.active && !p.inVehicle && p.state !== "patrol" && p.state !== "returning");
    if (idx === -1) break;
    const p = police[idx];
    if (p.inVehicle) { p.inVehicle.driver = null; p.inVehicle.occupied = false; }
    police.splice(idx,1);
    footPursuers--;
  }
  while (carPursuers > maxCars) {
    const idx = police.findIndex(p => p.active && p.inVehicle && p.state !== "patrol");
    if (idx === -1) break;
    const p = police[idx];
    const v = p.inVehicle;
    if (v) { v.driver = null; v.occupied = false; }
    police.splice(idx,1);
    carPursuers--;
  }
  // remove any active overflow (including uncertain) if still over total
  while (police.filter(p=>p.active && p.state!=="patrol" && p.state!=="returning").length > maxTotal) {
    const idx = police.findIndex(p => p.active && p.state!=="patrol" && p.state!=="returning");
    if (idx===-1) break;
    const p = police[idx];
    if (p.inVehicle) { p.inVehicle.driver=null; p.inVehicle.occupied=false; }
    police.splice(idx,1);
  }
  // also prune stale inactive returning/uncertain beyond 2*maxTotal to prevent leak
  let inactiveCount = police.filter(p => !p.active && p.state !== "patrol").length;
  while (inactiveCount > maxTotal * 2) {
    const idx = police.findIndex(p => !p.active && p.state !== "patrol");
    if (idx === -1) break;
    const p = police[idx];
    if (p.inVehicle) { p.inVehicle.driver=null; p.inVehicle.occupied=false; }
    police.splice(idx,1);
    inactiveCount--;
  }
}

function cleanupVehicles(desiredCars) {
  if (!player || typeof player.x !== "number") return;
  let policeVehs = vehicles.filter(v=>v.isPolice && !v.hidden && !v.exploding);
  const keep = Math.max(2, desiredCars + 2);
  if (policeVehs.length <= keep) return;
  policeVehs.sort((a,b)=> Math.hypot(a.x - player.x, a.y - player.y) - Math.hypot(b.x - player.x, b.y - player.y));
  let removed = 0;
  for (let i = policeVehs.length -1; i >= 0 && policeVehs.length - removed > keep; i--) {
    const v = policeVehs[i];
    if (v.occupied) continue;
    const idx = vehicles.indexOf(v);
    if (idx!==-1) { vehicles.splice(idx,1); removed++; }
  }
}

function updateOfficer(p, target, playerInVehicle, config) {
  if (!p.active || p.state === "patrol" || p.state === "returning") return;

  // A traffic call overrides the player: the officer is there for the car that
  // is blocking the road, not for whoever is wanted.
  if (p.violation) {
    const veh = p.violation.veh;
    if (veh && !veh.dead && !veh.exploding) {
      p.violation.x = veh.x;
      p.violation.y = veh.y;
    }
    target = p.violation;
    playerInVehicle = true;
  }

  const dist = Math.hypot(target.x - p.x, target.y - p.y);
  const distBlocks = dist / TILE;

  // LOS: 10 blocks -> uncertain
  if (distBlocks > LOS_BLOCKS) {
    if (!p.uncertainTimer) {
      p.uncertainTimer = SEARCH_TIME;
      p.state = "uncertain";
      p.lastKnownPlayerPos = { x: target.x, y: target.y };
      p.path = null;
      p.pathTimer = 0;
    }
  } else {
    if (p.state === "uncertain") {
      p.state = playerInVehicle && p.inVehicle ? "vehicle_chase" : "chase";
      p.uncertainTimer = 0;
      p.lastKnownPlayerPos = null;
    }
  }

  if (p.state === "uncertain") {
    p.uncertainTimer = (typeof p.uncertainTimer === "number" ? p.uncertainTimer : SEARCH_TIME) - 16;
    if (p.uncertainTimer <= 0) {
      p.active = false;
      p.state = "returning";
      p.path = null;
      p.uncertainTimer = 0;
      if (p.station) p.targetReturn = { x: p.station.x, y: p.station.y };
      return;
    }
    if (!p.lastKnownPlayerPos || typeof p.lastKnownPlayerPos.x !== "number") {
      p.lastKnownPlayerPos = { x: target.x, y: target.y };
    }
    if (!p.path || p.path.length===0) {
      const rx = p.lastKnownPlayerPos.x + (Math.random()-0.5)*TILE*6;
      const ry = p.lastKnownPlayerPos.y + (Math.random()-0.5)*TILE*6;
      if (isWalkable(rx, ry)) {
        p.path = findPath(p.x, p.y, rx, ry, 40);
        p.pathTimer = 50;
      }
    }
    followPath(p);
    return;
  }

  // state transitions based on player vehicle
  if (playerInVehicle && !p.inVehicle) {
    // need vehicle
    handleVehicleApproach(p, target);
    return;
  } else if (!playerInVehicle && p.inVehicle) {
    // player on foot, officer in car -> car approaches to 2 blocks then exit
    const d = Math.hypot(target.x - p.inVehicle.x, target.y - p.inVehicle.y);
    if (d <= CAR_STOP) {
      // stop car and exit
      exitVehicle(p);
      // after exit will be foot chase next frame
      return;
    } else {
      // drive car towards stop point (2 blocks away from player)
      driveVehicleToStopPoint(p, target);
      return;
    }
  } else if (!playerInVehicle && !p.inVehicle) {
    handleFootPursuit(p, target);
  } else if (playerInVehicle && p.inVehicle) {
    // A traffic call: the officer pulls up and parks properly beside the car
    // that is blocking the road, and waits. If the car drives off they follow
    // it. A pursuit is the wrong shape for this - the officer would sit on
    // the blocker instead of dealing with it.
    if (p.violation) {
    const veh = p.violation.veh;
    const vSpeed = veh ? Math.hypot(veh.vx || 0, veh.vy || 0) : 0;
    if (vSpeed < 0.6 && dist < TILE * 3) {
      driveVehicleToStopPoint(p, target);
    } else {
      handleVehiclePursuit(p, target);
    }
    } else {
      handleVehiclePursuit(p, target);
    }
  }
}

function handleVehicleApproach(p, target) {
  // find nearest empty police car
  let nearest = null, nd = Infinity;
  for (const v of vehicles) {
    if (!v.isPolice || v.occupied || v.hidden || v.exploding) continue;
    const d = Math.hypot(p.x - v.x, p.y - v.y);
    if (d < nd) { nd = d; nearest = v; }
  }
  if (nearest && nd < TILE*3) {
    p.inVehicle = nearest;
    nearest.driver = p;
    nearest.occupied = true;
    nearest.siren = true;
    p.state = "vehicle_chase";
    p.path = null;
    p.targetVehicle = null;
    return;
  }
  if (nearest) {
    p.targetVehicle = nearest;
    if (!p.path || p.path.length===0 || p.pathTimer<=0) {
      p.path = findPath(p.x, p.y, nearest.x, nearest.y, 50);
      p.pathTimer = 40;
    }
    followPath(p);
    // if close enough, enter
    if (Math.hypot(p.x - nearest.x, p.y - nearest.y) < TILE*1.5) {
      p.inVehicle = nearest;
      nearest.driver = p;
      nearest.occupied = true;
      nearest.siren = true;
      p.state = "vehicle_chase";
      p.path = null;
    }
  } else {
    // no car, foot chase
    handleFootPursuit(p, target);
  }
}

function exitVehicle(p) {
  const v = p.inVehicle;
  if (!v) return;
  v.driver = null;
  v.occupied = false;
  v.siren = false;
  v.vx = 0; v.vy = 0;
  let offX = v.x + TILE*0.5, offY = v.y;
  let tries=0;
  while (tries<10 && !isWalkable(offX, offY)) {
    offX = v.x + (Math.random()-0.5)*TILE;
    offY = v.y + (Math.random()-0.5)*TILE;
    tries++;
  }
  p.x = isWalkable(offX, offY) ? offX : v.x;
  p.y = isWalkable(offX, offY) ? offY : v.y;
  p.inVehicle = null;
  p.state = "chase";
  p.path = null;
}

function driveVehicleToStopPoint(p, target) {
  const v = p.inVehicle;
  // Where the car should come to rest.
  //
  // A police car used to stop wherever it happened to reach, at whatever angle
  // it was pointing, which left it straddling a lane and blocking the traffic
  // it was meant to be controlling. It now pulls into a proper kerbside spot -
  // parallel to the pavement, square to the road - using exactly the same rules
  // as the civilian traffic.
  const angToPlayer = Math.atan2(target.y - v.y, target.x - v.x);
  const spot = kerbSpotNear(
    Math.floor(v.x / TILE), Math.floor(v.y / TILE),
    v.angle !== undefined ? v.angle : angToPlayer,
  );
  let stopX;
  let stopY;
  let stopAngle = null;
  if (spot) {
    stopX = spot.x;
    stopY = spot.y;
    stopAngle = spot.angle;
  } else {
    // No kerb within reach: fall back to the old stop point, but square the car
    // to the road rather than leaving it at an angle.
    stopX = target.x - Math.cos(angToPlayer) * CAR_STOP;
    stopY = target.y - Math.sin(angToPlayer) * CAR_STOP;
    let tries = 0;
    while (tries < 8 && !isOnRoad(stopX, stopY)) {
      const a = angToPlayer + (Math.random() - 0.5) * 0.8;
      stopX = target.x - Math.cos(a) * CAR_STOP;
      stopY = target.y - Math.sin(a) * CAR_STOP;
      tries++;
    }
    if (!isOnRoad(stopX, stopY)) { stopX = v.x; stopY = v.y; }
  }

  const dx = stopX - v.x, dy = stopY - v.y;
  const dist = Math.hypot(dx, dy);
  if (dist < TILE*0.5) {
    v.vx *= 0.85; v.vy *= 0.85;
    // Parked: square the car to the road so it is not left at an angle across
    // the lane.
    if (stopAngle !== null) {
      let diff = stopAngle - v.angle;
      while (diff > Math.PI) diff -= Math.PI * 2;
      while (diff < -Math.PI) diff += Math.PI * 2;
      v.angle += Math.sign(diff) * Math.min(Math.abs(diff), 0.05);
    }
    p.x = v.x; p.y = v.y;
    return;
  }
  let desired = Math.atan2(dy, dx);
  let diff = desired - v.angle;
  while (diff > Math.PI) diff -= Math.PI*2;
  while (diff < -Math.PI) diff += Math.PI*2;
  v.angle += Math.sign(diff) * Math.min(Math.abs(diff), 0.08);
  const accel = 0.18;
  v.vx += Math.cos(v.angle)*accel;
  v.vy += Math.sin(v.angle)*accel;
  const max = CFG.PLAYER_SPEED + 0.3;
  const cur = Math.hypot(v.vx, v.vy);
  if (cur > max) { v.vx = v.vx/cur*max; v.vy = v.vy/cur*max; }
  v.vx *= 0.98; v.vy *= 0.98;
  const nx = v.x + v.vx, ny = v.y + v.vy;
  if (isOnRoad(nx, ny)) { v.x = nx; v.y = ny; } else { v.vx*=-0.5; v.vy*=-0.5; }
  p.x = v.x; p.y = v.y;
  p.angle = v.angle;
}

function handleFootPursuit(p, target) {
  const dx = target.x - p.x, dy = target.y - p.y;
  const dist = Math.hypot(dx, dy);
  if (dist < FOOT_FOLLOW) {
    // maintain distance, back off
    p.angle = Math.atan2(-dy, -dx);
    const nx = p.x + Math.cos(p.angle)*p.speed*0.6;
    const ny = p.y + Math.sin(p.angle)*p.speed*0.6;
    if (isWalkable(nx, ny)) { p.x = nx; p.y = ny; }
    tryShoot(p, target);
    return;
  }
  p.pathTimer = (p.pathTimer||0)-1;
  if (!p.path || p.path.length===0 || p.pathTimer<=0) {
    p.path = findPath(p.x, p.y, target.x, target.y, 45);
    p.pathTimer = 25;
  }
  if (p.path && p.path.length) {
    const moved = followPath(p);
    if (!moved) {
      // fallback direct
      p.angle = Math.atan2(dy, dx);
      const nx = p.x + Math.cos(p.angle)*p.speed;
      const ny = p.y + Math.sin(p.angle)*p.speed;
      if (isWalkable(nx, ny)) { p.x = nx; p.y = ny; }
    }
  } else {
    p.angle = Math.atan2(dy, dx);
    const nx = p.x + Math.cos(p.angle)*p.speed;
    const ny = p.y + Math.sin(p.angle)*p.speed;
    if (isWalkable(nx, ny)) { p.x = nx; p.y = ny; }
  }
  tryShoot(p, target);
  tryMelee(p, target);
}

function handleVehiclePursuit(p, target) {
  const v = p.inVehicle;
  const dx = target.x - v.x, dy = target.y - v.y;
  const dist = Math.hypot(dx, dy);
  const playerSpeed = Math.hypot(target.vx||0, target.vy||0);
  const isStopped = playerSpeed < 0.5;

  let desired;
  if (isStopped && dist < TILE*6) {
    // corner: stay 1.5 blocks away, block
    const ang = Math.atan2(dy, dx);
    const cx = target.x - Math.cos(ang)*TILE*1.5;
    const cy = target.y - Math.sin(ang)*TILE*1.5;
    desired = Math.atan2(cy - v.y, cx - v.x);
  } else if (p.interceptMode && dist > TILE*5) {
    const predTime = 1200;
    const px = target.x + (target.vx||0)*predTime/16;
    const py = target.y + (target.vy||0)*predTime/16;
    desired = Math.atan2(py - v.y, px - v.x);
  } else {
    desired = Math.atan2(dy, dx);
  }

  // 2 blocks stop if close? but in car chase we want to corner, not stop 2 blocks
  // only stop if very close and player stopped
  let diff = desired - v.angle;
  while (diff > Math.PI) diff-=Math.PI*2;
  while (diff < -Math.PI) diff+=Math.PI*2;
  v.angle += Math.sign(diff)*Math.min(Math.abs(diff), 0.07);

  let accel = 0;
  if (dist > TILE*3) accel = 0.15;
  else if (dist < TILE*1.5 && isStopped) accel = -0.08;
  else if (dist < TILE*2) accel = 0.02;

  v.vx += Math.cos(v.angle)*accel;
  v.vy += Math.sin(v.angle)*accel;
  const max = CFG.PLAYER_SPEED + 0.3;
  // use car speed cap
  const cur = Math.hypot(v.vx, v.vy);
  const cap = Math.max(max, 5.0);
  if (cur > cap) { v.vx = v.vx/cur*cap; v.vy = v.vy/cur*cap; }
  v.vx*=0.97; v.vy*=0.97;
  const nx = v.x + v.vx, ny = v.y + v.vy;
  if (isOnRoad(nx, ny)) { v.x = nx; v.y = ny; }
  else if (isOnRoad(nx, v.y)) { v.x = nx; v.vx*=-0.3; }
  else if (isOnRoad(v.x, ny)) { v.y = ny; v.vy*=-0.3; }
  else { v.vx*=-0.5; v.vy*=-0.5; }
  p.x = v.x; p.y = v.y; p.angle = v.angle;

  p.shotsFired = (p.shotsFired||0)+1;
  if (p.shotsFired >= 35) {
    p.shotsFired=0;
    const a = Math.atan2(target.y - v.y, target.x - v.x);
    shootBullet(v.x, v.y, a, false);
  }
}

function tryShoot(p, target) {
  p.shotsFired = (p.shotsFired||0)+1;
  const d = Math.hypot(target.x - p.x, target.y - p.y);
  if (d < 350 && p.shotsFired >= 30) {
    p.shotsFired=0;
    const a = Math.atan2(target.y - p.y, target.x - p.x);
    shootBullet(p.x, p.y, a, false);
  }
}

function tryMelee(p, target) {
  if (!player || !player.alive) return;
  const d = Math.hypot(target.x - p.x, target.y - p.y);
  if (d < 28 && !player.inVehicle) {
    player.health -= 4 * (CFG.DAMAGE_MUL||1);
    updateWantedUI();
    if (player.health <= 0) playerDie();
  }
}

function followPath(p) {
  if (!p.path || !p.path.length) return false;
  const wp = p.path[0];
  const wx = wp.x * TILE + TILE/2, wy = wp.y * TILE + TILE/2;
  const d = Math.hypot(wx - p.x, wy - p.y);
  if (d < 10) { p.path.shift(); return true; }
  p.angle = Math.atan2(wy - p.y, wx - p.x);
  const nx = p.x + Math.cos(p.angle)*p.speed;
  const ny = p.y + Math.sin(p.angle)*p.speed;
  if (isWalkable(nx, ny)) { p.x = nx; p.y = ny; return true; }
  else { p.path = null; return false; }
}
