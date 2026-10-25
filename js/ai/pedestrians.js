// ======================== PEDESTRIAN BRAIN ========================
// Behaviour tree for every walking character in the city.
//
// The previous version was a thirty line "pick a random angle every couple of
// seconds and hope" wanderer, which is why NPCs drifted into buildings, stood
// in the middle of junctions and ignored the player entirely. This module
// replaces it with an explicit state machine layered on the shared services:
//
//   js/ai/navGrid.js      - what kind of tile am I on, where are the kerbs
//   js/ai/pathfinding.js  - budgeted A* routes
//   js/ai/spatial.js      - neighbour queries + the noise bus
//
// States
//   WALK     follow a pavement route to a destination
//   IDLE     reached the destination, stand around for a moment
//   CURB     standing at a kerb, waiting for a gap in the traffic
//   CROSS    committed to a crosswalk, walking straight to the far kerb
//   FLEE     running from a perceived threat
//   INJURED  wounded: moving at a fraction of normal speed for a while
//   STAGGER  knocked over by the player or a car, temporarily helpless
//   COWER    cornered by panic
//
// Reactions - the part the player actually notices
//   * a gunshot nearby   -> fear, then FLEE, plus contagion to bystanders
//   * the player brushing past -> STAGGER + knockback + fear
//   * being run over by any car -> knockback scaled by impact speed, fear,
//     possible injury, death when the impact is hard enough
//   * being shot         -> INJURED (slow, limping) for a short while, then FLEE
//
// Performance rules for this file
//   * no per-frame allocation - every query reuses a scratch array
//   * "thinking" (picking a destination) is staggered across frames
//   * routing goes through the budgeted pathfinder so A* cannot spike a frame
//   * the expensive neighbour passes run on alternating frames
import { CFG } from "../core/config.js?v=57";
import { isWalkable } from "../entities/vehicles.js?v=57";
import {
  S_BLOCKED, S_SIDEWALK,
  surfaceAt, isCrossingTile, crossingAxis, AXIS_H, isSidewalkTile,
  randomSidewalkTile, randomWalkableTile, randomSidewalkAcrossRoad,
  nearestSidewalkTile,
} from "./navGrid.js?v=57";
import { requestPath, pumpPathfinder, pendingPathCount } from "./pathfinding.js?v=57";
import {
  queryRadiusTyped, drainNoises, decayNoises,
  KIND_VEHICLE, KIND_NPC,
} from "./spatial.js?v=57";
import { densityAt, cellOrigin, cellKey, cellCap, CELL } from "./density.js?v=57";
import { cullRadius, candidateCells, isVisible } from "./spawner.js?v=57";

// ── Tuning ───────────────────────────────────────────────────
const FEAR_DECAY = 0.55;           // fear units per frame (100 == full panic)
const FEAR_PANIC = 55;             // above this the character runs
const FEAR_FLEE_SPEED = 1.35;      // speed multiplier while fleeing
const INJURY_MIN_SLOW = 0.30;      // worst limp speed, fraction of base
const INJURY_MAX_SLOW = 0.58;      // freshest-wound limp speed
const INJURY_MIN_FRAMES = 110;     // ~1.8s of "slowed by the wound"
const INJURY_MAX_FRAMES = 330;     // ~5.5s
const STAGGER_PLAYER = 26;         // frames of helplessness after a barge
const STAGGER_CAR = 46;
const BUMP_COOLDOWN = 45;          // one shove per this many frames, per victim
const FATAL_SPEED = 5.2;           // px/frame above which a car strike is fatal
const CROSS_CLEAR_FRAMES = 7;      // clear for this long before stepping off
// Gap acceptance: at this map scale a crossing takes a few seconds, so a
// pedestrian only steps out when nothing will reach the crossing box within
// roughly two seconds. Long enough to be orderly, short enough that the kerb
// does not silt up with people waiting.
const CROSS_COMMIT_FRAMES = 115;
const CROSS_DANGER_FRAMES = 26;    // on the crossing itself, stop much later
const CROSS_SPEED = 1.7;           // purposeful stride once committed
const SEPARATION_R = 20;
const THINK_MIN = 110;             // frames between re-planning
const THINK_MAX = 260;
const CULL_PER_FRAME = 6;
// How many of the furthest ambient pedestrians may be taken away in one pass,
// so the street never visibly empties.
const TRIM_PER_CALL = 4;

/**
 * How much of the tuned crowd to keep.
 *
 * The old head count assumed every character was packed into a small blob around
 * the player, which is what produced the crush. Density now carries the load
 * (js/ai/density.js - 1 per 4x4 in the suburbs, 4 per 4x4 downtown), so the
 * number itself can come down by roughly two thirds without the centre thinning
 * out.
 */
export const POPULATION_SCALE = 0.35;

/**
 * The walking crowd the streets should hold, in total.
 *
 * "Total" matters: a car that parks puts its driver on the pavement, and those
 * drivers are part of what the player sees. Counting them means the budget has
 * to cover them, so the starting crowd is deliberately smaller than the target
 * and the top-up makes up the difference as drivers appear and wander off.
 */
export function targetPopulation() {
  const base = CFG.NPC_COUNT - (CFG.NPC_GANG_COUNT || 0);
  return Math.max(8, Math.round(base * POPULATION_SCALE));
}

/**
 * How many civilians to place when the game starts.
 *
 * Lower than the target on purpose: parked cars keep handing their drivers to
 * the pavement, and spawning the full budget up front meant the street ended up
 * over its target by however many drivers were out.
 */
export function initialAmbientCount() {
  return Math.max(6, Math.round(targetPopulation() * 0.55));
}

/** Gang members to place. Scaled with the crowd, since they stand on the street too. */
export function targetGangCount() {
  return Math.max(2, Math.round((CFG.NPC_GANG_COUNT || 0) * POPULATION_SCALE));
}

export const ST = {
  WALK: "walk",
  RETURN: "return",   // walking back to their own car
  IDLE: "idle",
  CURB: "curb",
  CROSS: "cross",
  FLEE: "flee",
  INJURED: "injured",
  STAGGER: "stagger",
  COWER: "cower",
};

export const AI_COLORS = [
  "#e74c3c", "#3498db", "#2ecc71", "#f39c12",
  "#9b59b6", "#1abc9c", "#e67e22", "#34495e",
];

// Reusable scratch buffers - never reallocated inside the frame loop.
const scratch = [];
const scratch2 = [];
const kills = [];

let frame = 0;
let playerRef = null;
// The live NPC list, kept so that a driver can be found - and got into their
// car - from outside this module.
let npcList = [];
let stats = {
  updates: 0, crossings: 0, fled: 0, injured: 0, struck: 0, culled: 0, respawned: 0, trimmed: 0,
};

// ── Small maths helpers ──────────────────────────────────────
function turnToward(cur, want, rate) {
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (d > rate) d = rate;
  else if (d < -rate) d = -rate;
  return cur + d;
}

function tileOf(x, y) {
  return {
    x: Math.floor(x / CFG.TILE),
    y: Math.floor(y / CFG.TILE),
  };
}

/**
 * Move `dist` pixels along `angle`, sliding along obstacles instead of sticking.
 * Returns the distance actually covered (0 means fully wedged).
 */
function step(n, angle, dist) {
  if (!(dist > 0)) return 0;
  const nx = n.x + Math.cos(angle) * dist;
  const ny = n.y + Math.sin(angle) * dist;
  if (isWalkable(nx, ny)) {
    n.x = nx;
    n.y = ny;
    return dist;
  }
  if (isWalkable(nx, n.y)) {
    n.x = nx;
    return dist * 0.55;
  }
  if (isWalkable(n.x, ny)) {
    n.y = ny;
    return dist * 0.55;
  }
  return 0;
}

function setState(n, s) {
  if (n.state === s) return;
  n.state = s;
  n.stateTimer = 0;
  if (s === ST.FLEE) stats.fled++;
  if (s === ST.INJURED) stats.injured++;
}

// ── Setup ────────────────────────────────────────────────────
/**
 * Attach the AI brain to a character. Kept separate from the spawner so quest
 * NPCs and other scripted characters never get one - a brain would walk them
 * off the marker the mission is waiting for.
 */
export function initPedestrian(n, opts = {}) {
  n.ai = true;
  n.listen = true;
  n.state = opts.state || ST.WALK;
  n.path = null;
  n.pathIndex = 0;
  n.pathPending = false;
  n.pathTag = 0;
  n.goalX = tileOf(n.x, n.y).x;
  n.goalY = tileOf(n.x, n.y).y;
  n.thinkTimer = (Math.random() * THINK_MAX) | 0;
  n.avoidCrossing = 0;
  n.fear = 0;
  n.fearW = 0;
  n.fearX = n.x;
  n.fearY = n.y;
  n.injury = 0;
  n.injuryTimer = 0;
  n.limp = 0;
  n.staggerTimer = 0;
  n.blockedFrames = 0;
  n.kx = 0;
  n.ky = 0;
  n.crossing = false;
  n.crossClear = 0;
  n.crossMid = null;
  n.crossDirX = 0;
  n.crossDirY = 0;
  n.crossGoal = null;
  n.crossFromX = 0;
  n.crossFromY = 0;
  n.idleTimer = 0;
  n.stateTimer = 0;
  n.speedMul = 1;
  n.homeVehicle = opts.homeVehicle || null;
  n.ignoreBump = !!opts.ignoreBump; // mission characters keep their footing
  n.aiKind = KIND_NPC;
  return n;
}

/**
 * Give a non-AI character (a gang member) the shared body reactions so a car
 * can still knock it over and a gunshot can still spook it.
 */
export function enableReactions(n) {
  n.listen = true;
  n.reacts = true;
  n.fear = 0;
  n.fearW = 0;
  n.fearX = n.x;
  n.fearY = n.y;
  n.injury = 0;
  n.injuryTimer = 0;
  n.staggerTimer = 0;
  n.limp = 0;
  n.kx = 0;
  n.ky = 0;
  n.busy = false;
  n.speedMul = 1;
  return n;
}

/** Build a brand new civilian (used by traffic drivers and population refill). */
export function makeCivilian(x, y, opts = {}) {
  return initPedestrian(
    {
      x,
      y,
      angle: Math.random() * Math.PI * 2,
      speed: 0.62 + Math.random() * 0.85,
      color: opts.color || AI_COLORS[(Math.random() * AI_COLORS.length) | 0],
      health: 20,
      maxHealth: 20,
      size: 12,
      type: "civilian",
      weapon: false,
      targetX: x,
      targetY: y,
      timer: 0,
      shootTimer: 0,
      chaseTarget: null,
      chaseTimer: 0,
    },
    opts
  );
}

// ── Perception: turn events into fear ────────────────────────
function scare(n, sx, sy, strength) {
  if (n.dead) return;
  if (!n.ai && !n.reacts) return;
  const loud = strength * 100;
  // The loudest recent event owns the flee direction; stale sources lose out.
  if (loud >= n.fearW * 0.92) {
    n.fearX = sx;
    n.fearY = sy;
    n.fearW = loud;
  }
  n.fear = Math.min(150, n.fear + loud * 0.9);
  if (n.fear >= FEAR_PANIC && !n.injuryTimer && !n.staggerTimer) {
    if (!n.ai) return; // gangs decide in gangReaction()
    if (n.state !== ST.FLEE && n.state !== ST.INJURED && n.state !== ST.COWER) {
      setState(n, ST.FLEE);
    }
  }
}

/**
 * Called by js/entities/npcs.js when a bullet connects. The wound slows the
 * character for a while; once it settles they bolt.
 *
 * Gang members keep chasing - that is existing behaviour - but the wound slows
 * them down too, and the badly-hurt rule in gangReaction() still makes them
 * break off and run.
 */
export function onPedestrianShot(n, damage, shooterX, shooterY) {
  if (!n || n.dead) return;
  if (!n.ai && !n.reacts) return;
  const mx = typeof shooterX === "number" ? shooterX : n.x - Math.cos(n.angle) * 100;
  const my = typeof shooterY === "number" ? shooterY : n.y - Math.sin(n.angle) * 100;
  const maxHp = n.maxHealth || 20;
  n.injury = Math.min(1, (n.injury || 0) + (damage || 15) / (maxHp * 1.35));
  n.injuryTimer = Math.max(
    n.injuryTimer || 0,
    INJURY_MIN_FRAMES + Math.round(n.injury * (INJURY_MAX_FRAMES - INJURY_MIN_FRAMES))
  );
  n.fear = Math.min(150, (n.fear || 0) + 90);
  n.fearX = mx;
  n.fearY = my;
  n.fearW = 90;
  n.staggerTimer = Math.max(n.staggerTimer || 0, 12);
  if (!n.ai) {
    n.limp = 1;
    return; // a hit gang member keeps coming, just badly slowed
  }
  n.path = null;
  n.pathPending = false;
  n.thinkTimer = 0;
  setState(n, ST.INJURED);
}

/** External "something scared them" hook (explosions, sirens, ...). */
export function panicAt(n, sx, sy, strength) {
  scare(n, sx, sy, strength);
}

function applyNoise(n, strength, nz) {
  // Injured characters flinch instead of bolting.
  if (n.injuryTimer > 0) {
    n.fear = Math.min(150, n.fear + strength * 40);
    return;
  }
  scare(n, nz.x, nz.y, strength * (nz.kind === 1 ? 1 : 0.75));
}

// ── Damage / knockback ───────────────────────────────────────
function knock(n, fromX, fromY, power) {
  const ang = Math.atan2(n.y - fromY, n.x - fromX);
  n.kx = Math.cos(ang) * power;
  n.ky = Math.sin(ang) * power;
  n.angle = ang;
  n.blockedFrames = 0;
}

/**
 * Ease a pedestrian out of a stationary car's footprint. The nav grid only
 * knows about tiles, not cars, so without this people end up standing inside
 * parked vehicles. Uses the car's oriented box (not a circle) so someone ends
 * up beside the bodywork rather than half-inside it. No fear, no injury - just
 * "you cannot stand there".
 */
function pushOutOfVehicle(n, v) {
  const hw = (v.w || 60) * 0.5;
  const hh = (v.h || 32) * 0.5;
  const ang = v.angle || 0;
  const cos = Math.cos(-ang);
  const sin = Math.sin(-ang);
  const dx = n.x - v.x;
  const dy = n.y - v.y;
  // Into the car's own frame.
  const lx = dx * cos - dy * sin;
  const ly = dx * sin + dy * cos;
  const pad = 6;
  if (Math.abs(lx) <= hw + pad && Math.abs(ly) <= hh + pad) {
    // Escape along the axis of least penetration, out through the nearest face.
    const outX = hw + pad - Math.abs(lx);
    const outY = hh + pad - Math.abs(ly);
    const cands = outX < outY
      ? [[lx >= 0 ? hw + pad : -(hw + pad), ly], [lx, ly >= 0 ? hh + pad : -(hh + pad)]]
      : [[lx, ly >= 0 ? hh + pad : -(hh + pad)], [lx >= 0 ? hw + pad : -(hw + pad), ly]];
    for (const [tx, ty] of cands) {
      // Back into world space.
      const wx = tx * Math.cos(ang) - ty * Math.sin(ang);
      const wy = tx * Math.sin(ang) + ty * Math.cos(ang);
      // Never shove someone into a wall to escape a door.
      if (!isWalkable(v.x + wx, v.y + wy)) continue;
      n.x = v.x + wx;
      n.y = v.y + wy;
      return true;
    }
    // Nowhere walkable to step: just walk straight out as far as we can.
    const d = Math.hypot(lx, ly);
    const push = d > 0.01 ? Math.atan2(ly, lx) + ang : 0;
    step(n, push, (Math.min(outX, outY) + 0.6));
  }
  return false;
}

/**
 * A pedestrian has been hit by a car. `speed` is the car's ground speed, which
 * decides whether this is a shoulder-bump, a knockdown or a fatality.
 * Returns true when the character died.
 */
function strikeByVehicle(n, v, speed) {
  const impact = speed;
  if (impact < 0.6) {
    // A stationary car is scenery, not a threat: people walk past parked cars
    // all day without panicking. Just shunt them clear of the bodywork.
    pushOutOfVehicle(n, v);
    return false;
  }
  // A car that overlaps for several frames is one impact, not one per frame.
  // Without this, sitting on someone grinds them to death in under a second.
  if (n.staggerTimer > 0) return false;
  stats.struck++;
  n.fear = 150;
  n.fearX = v.x;
  n.fearY = v.y;
  n.fearW = 110;
  // Damage scales with the closing speed but stays non-lethal for an ordinary
  // shunt: a car nudging someone at walking pace knocks them down and wounds
  // them, only a genuinely fast impact is fatal.
  const severity = Math.min(1, impact / 5);
  let dmg = Math.round(4 + severity * 10);
  if (impact >= FATAL_SPEED) dmg += 40; // hit hard enough to be fatal
  n.health -= dmg;
  n.injury = Math.min(1, (n.injury || 0) + severity * 0.75);
  n.injuryTimer = Math.max(n.injuryTimer || 0, INJURY_MIN_FRAMES + Math.round(severity * 180));
  n.staggerTimer = Math.max(n.staggerTimer || 0, Math.round(STAGGER_CAR * (0.5 + severity)));
  knock(n, v.x, v.y, 2.5 + severity * 6);
  if (n.ai) {
    n.path = null;
    n.pathPending = false;
    n.thinkTimer = 0;
    setState(n, ST.INJURED);
  } else {
    // A gang member who gets hit by a car drops the fight entirely.
    n.chaseTimer = 0;
    n.limp = 1;
    setState(n, ST.INJURED);
  }
  // The driver reacts: lift off for a moment instead of ploughing on.
  if (!v.driver || v.driver === playerRef) v.brakeTimer = Math.max(v.brakeTimer || 0, 40);
  return n.health !== undefined && n.health <= 0;
}

/** The player walked shoulder to shoulder into the character. */
function bumpByPlayer(n, p, relSpeed) {
  if (n.ignoreBump) return;
  // A player standing inside someone would otherwise re-trigger this every
  // frame and pin them in STAGGER forever. One shove per cooldown is enough.
  if (n.bumpCooldown > 0) return;
  n.bumpCooldown = BUMP_COOLDOWN;
  n.fear = Math.min(150, n.fear + 34);
  n.fearX = p.x;
  n.fearY = p.y;
  n.fearW = 70;
  n.staggerTimer = Math.max(n.staggerTimer || 0, STAGGER_PLAYER + Math.round(relSpeed * 3));
  knock(n, p.x, p.y, 1.6 + relSpeed * 0.9);
  if (n.ai && n.injuryTimer <= 0) setState(n, ST.FLEE);
}

function handlePlayerBumps(list, p) {
  if (!p || p.inVehicle) return; // cars are handled by handleVehicleStrikes
  const rad = 13;
  const rad2 = rad * rad;
  const rel = Math.hypot(p.vx || 0, p.vy || 0) + (p.speed || 2.8) * 0.35;
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (!n.ai || n.dead) continue;
    const dx = n.x - p.x;
    const dy = n.y - p.y;
    if (dx * dx + dy * dy > rad2) continue;
    bumpByPlayer(n, p, rel);
  }
}

function handleVehicleStrikes(list, parity) {
  const probe = CFG.TILE * 0.62;
  for (let i = parity; i < list.length; i += 2) {
    const n = list[i];
    if (n.dead || (!n.ai && !n.reacts)) continue;
    scratch.length = 0;
    queryRadiusTyped(n.x, n.y, probe, scratch);
    for (let k = 0; k < scratch.length; k += 2) {
      if (scratch[k + 1] !== KIND_VEHICLE) continue;
      const v = scratch[k];
      const rad = Math.hypot((v.w || 60) * 0.5, (v.h || 32) * 0.5) + 10;
      const dx = n.x - v.x;
      const dy = n.y - v.y;
      if (dx * dx + dy * dy > rad * rad) continue;
      const spd = Math.hypot(v.vx || 0, v.vy || 0);
      if (strikeByVehicle(n, v, spd)) kills.push(n);
      break;
    }
  }
}

// ── Crossing the road, in order ──────────────────────────────
/**
 * Is it safe to step off the kerb? Checks both approaches for anything moving at
 * us (including the player's car and police cars), plus anyone already on the
 * crossing box, so people queue instead of dancing into oncoming traffic.
 */
function crossingSafe(n) {
  const T = CFG.TILE;
  const mx = (n.crossMid.x + 0.5) * T;
  const my = (n.crossMid.y + 0.5) * T;
  const dx = n.crossDirX;
  const dy = n.crossDirY;
  const look = T * 6.5;
  const band = T * 1.2;
  scratch2.length = 0;
  queryRadiusTyped(mx, my, look, scratch2);
  for (let i = 0; i < scratch2.length; i += 2) {
    const o = scratch2[i];
    const kind = scratch2[i + 1];
    if (kind === KIND_NPC) {
      if (o.dead || o === n) continue;
      if (o.crossing || o.state === ST.CROSS) {
        // Give way to whoever is already in the box - but only if they are
        // actually on it, otherwise a popular crossing deadlocks the kerb.
        const rx = o.x - mx;
        const ry = o.y - my;
        if (Math.abs(rx * -dy + ry * dx) < T * 1.0 &&
            Math.abs(rx * dx + ry * dy) < T * 1.4) return false;
      }
      continue;
    }
    if (kind !== KIND_VEHICLE) continue;
    if (o.hidden || o.exploding) continue;
    const rx = o.x - mx;
    const ry = o.y - my;
    if (Math.abs(rx * -dy + ry * dx) > band) continue; // a different carriageway
    const along = rx * dx + ry * dy;
    const pv = (o.vx || 0) * dx + (o.vy || 0) * dy;
    if (Math.abs(pv) < 0.25) {
      // Stationary or crawling: still an obstacle if it sits on the box.
      if (Math.abs(along) < T * 0.85) return false;
      continue;
    }
    const toward = along < 0 ? pv > 0 : pv < 0;
    if (!toward) continue; // moving away from us
    // px / (px per frame) is already a frame count - do not rescale.
    const tti = Math.abs(along) / Math.abs(pv);
    if (tti < CROSS_COMMIT_FRAMES) return false;
  }
  return true;
}

function farKerb(n) {
  let fx = n.crossMid.x + n.crossDirX;
  let fy = n.crossMid.y + n.crossDirY;
  for (let i = 0; i < 8; i++) {
    const s = surfaceAt(fx, fy);
    if (s === S_SIDEWALK) return { x: fx, y: fy };
    if (s === S_BLOCKED) return null;
    fx += n.crossDirX;
    fy += n.crossDirY;
  }
  return null;
}

/** Arrive at the kerb beside a crossing tile and start waiting our turn. */
function enterCurb(n, wp) {
  const axis = crossingAxis(wp.x, wp.y);
  const cur = tileOf(n.x, n.y);
  if (axis === 0) {
    // Not a legal crossing after all - refuse and re-plan.
    abandonRoute(n);
    return;
  }
  n.crossMid = { x: wp.x, y: wp.y };
  if (axis === AXIS_H) {
    n.crossDirX = wp.x >= cur.x ? 1 : -1;
    n.crossDirY = 0;
  } else {
    n.crossDirX = 0;
    n.crossDirY = wp.y >= cur.y ? 1 : -1;
  }
  n.crossClear = 0;
  setState(n, ST.CURB);
}

function abandonRoute(n) {
  n.path = null;
  n.pathIndex = 0;
  n.pathPending = false;
  n.thinkTimer = 0;
  if (n.state === ST.CURB || n.state === ST.CROSS) setState(n, ST.WALK);
}

function updateCurb(n) {
  const T = CFG.TILE;
  // Hug the kerb edge so we are not standing in someone's doorway.
  const edgeX = (n.crossMid.x + 0.5) * T - n.crossDirX * T * 0.55;
  const edgeY = (n.crossMid.y + 0.5) * T - n.crossDirY * T * 0.55;
  const d = Math.hypot(edgeX - n.x, edgeY - n.y);
  if (d > 4) {
    const ang = Math.atan2(edgeY - n.y, edgeX - n.x);
    n.angle = turnToward(n.angle, ang, 0.16);
    step(n, ang, Math.min(d, n.speed * 0.5));
  } else {
    // Face the direction of travel while waiting: reads as looking both ways.
    n.angle = turnToward(n.angle, Math.atan2(n.crossDirY, n.crossDirX), 0.08);
  }

  if (crossingSafe(n)) n.crossClear++;
  else n.crossClear = 0;

  if (n.crossClear >= CROSS_CLEAR_FRAMES) {
    const far = farKerb(n);
    if (!far) {
      // No footway on the other side: do not walk into the road.
      abandonRoute(n);
      return;
    }
    n.crossGoal = far;
    n.crossing = true;
    // Remember which side we set off from, so "arrived" is a real test of
    // having got across rather than a distance the character can circle.
    const from = tileOf(n.x, n.y);
    n.crossFromX = from.x;
    n.crossFromY = from.y;
    n.path = null;
    n.pathPending = false;
    setState(n, ST.CROSS);
    stats.crossings++;
    return;
  }
  if (n.stateTimer > 300) {
    // Traffic never let up: blacklist this crossing for a while and re-plan.
    n.avoidCrossing = 420;
    abandonRoute(n);
  }
}

function updateCross(n) {
  const T = CFG.TILE;
  const gx = (n.crossGoal.x + 0.5) * T;
  const gy = (n.crossGoal.y + 0.5) * T;
  const d = Math.hypot(gx - n.x, gy - n.y);
  const cur = tileOf(n.x, n.y);

  // "Arrived" means we reached pavement on the FAR side of the road. Testing
  // only the goal distance lets a character that overshot the bay circle it
  // forever, and testing "am I on pavement" alone would fire instantly
  // because we step off from the near kerb, which is pavement too.
  const pastStart =
    (cur.x - n.crossFromX) * n.crossDirX + (cur.y - n.crossFromY) * n.crossDirY;
  const reachedFarSide = pastStart > 0 && surfaceAt(cur.x, cur.y) === S_SIDEWALK;
  if (reachedFarSide || d < T * 0.45) {
    n.crossing = false;
    n.crossGoal = null;
    n.crossMid = null;
    abandonRoute(n);
    return;
  }

  // Something bearing down mid-crossing: hold still rather than sprint into it.
  const mx = (n.crossMid.x + 0.5) * T;
  const my = (n.crossMid.y + 0.5) * T;
  scratch2.length = 0;
  queryRadiusTyped(mx, my, T * 3.2, scratch2);
  let danger = false;
  for (let i = 0; i < scratch2.length; i += 2) {
    if (scratch2[i + 1] !== KIND_VEHICLE) continue;
    const v = scratch2[i];
    if (v.hidden || v.exploding) continue;
    const spd = Math.hypot(v.vx || 0, v.vy || 0);
    if (spd < 0.5) continue;
    const pv = v.vx * n.crossDirX + v.vy * n.crossDirY;
    if (pv <= 0) continue;
    const dx = v.x - n.x;
    const dy = v.y - n.y;
    if (Math.abs(dx * -n.crossDirY + dy * n.crossDirX) > T * 1.3) continue;
    // px / (px per frame) is already a frame count.
    if (Math.hypot(dx, dy) / spd < CROSS_DANGER_FRAMES) {
      danger = true;
      break;
    }
  }
  if (danger) {
    n.angle = turnToward(n.angle, Math.atan2(n.crossDirY, n.crossDirX), 0.1);
    if (n.stateTimer > 120) danger = false; // do not stand in the road forever
  }
  if (!danger) {
    const ang = Math.atan2(gy - n.y, gx - n.x);
    n.angle = turnToward(n.angle, ang, 0.3);
    step(n, ang, n.speed * CROSS_SPEED);
  }
  if (n.stateTimer > 480) {
    // Wedged: bail out and let the planner find a better route.
    n.crossing = false;
    n.crossGoal = null;
    n.crossMid = null;
    abandonRoute(n);
  }
}

// ── Walking the pavement ─────────────────────────────────────
function think(n) {
  const t = tileOf(n.x, n.y);
  const reach = 7 + ((Math.random() * 13) | 0);
  const roll = Math.random();
  let goal = null;

  if (roll < 0.56) {
    goal = randomSidewalkTile(t.x, t.y, reach);
  } else if (roll < 0.8 && n.avoidCrossing <= 0) {
    // Deliberately pick a spot across a street so the crowd actually uses the
    // crossings instead of orbiting a single block forever.
    goal = randomSidewalkAcrossRoad(t.x, t.y, Math.min(16, reach + 4));
  } else {
    goal = randomWalkableTile(t.x, t.y, reach);
  }
  if (!goal) goal = randomSidewalkTile(t.x, t.y, reach + 6);
  if (!goal) {
    n.path = null;
    n.pathPending = false;
    n.thinkTimer = THINK_MIN + ((Math.random() * (THINK_MAX - THINK_MIN)) | 0);
    setState(n, ST.IDLE);
    n.idleTimer = 30 + ((Math.random() * 60) | 0);
    return;
  }
  n.goalX = goal.x;
  n.goalY = goal.y;
  n.pathTag = (n.pathTag | 0) + 1;
  n.pathPending = true;
  n.path = null;
  n.pathIndex = 0;
  requestPath(n, goal.x, goal.y, reach + 8, n.pathTag);
  n.thinkTimer = THINK_MIN + ((Math.random() * (THINK_MAX - THINK_MIN)) | 0);
  setState(n, ST.WALK);
}

function onPathReady(n, path, tag) {
  if (tag !== n.pathTag) return; // the agent moved on; drop the stale route
  n.pathPending = false;
  if (path && path.length) {
    n.path = path;
    n.pathIndex = 0;
  } else {
    n.path = null;
    n.pathIndex = 0;
  }
}

function updateWalk(n) {
  if (!n.path || n.pathIndex >= n.path.length) {
    if (n.pathPending) return;
    if (n.thinkTimer <= 0) think(n);
    return;
  }
  const T = CFG.TILE;
  const wp = n.path[n.pathIndex];
  const wx = wp.x * T + T / 2;
  const wy = wp.y * T + T / 2;
  const d = Math.hypot(wx - n.x, wy - n.y);
  if (d < T * 0.42) {
    n.pathIndex++;
    return;
  }
  // About to step onto a carriageway: stop at the kerb and wait our turn.
  if (isCrossingTile(wp.x, wp.y)) {
    const cur = tileOf(n.x, n.y);
    if (!isCrossingTile(cur.x, cur.y)) {
      enterCurb(n, wp);
      return;
    }
  }
  const ang = Math.atan2(wy - n.y, wx - n.x);
  n.angle = turnToward(n.angle, ang, 0.24);
  if (step(n, ang, n.speed * n.speedMul) <= 0) {
    if (++n.blockedFrames > 30) {
      n.blockedFrames = 0;
      abandonRoute(n);
    }
  } else {
    n.blockedFrames = 0;
  }
}

function updateIdle(n) {
  if (n.idleTimer > 0) return;
  n.thinkTimer = 0;
  think(n);
}

// ── Panic states ─────────────────────────────────────────────
function updateFlee(n) {
  const ang = Math.atan2(n.y - n.fearY, n.x - n.fearX);
  const spd = n.speed * (FEAR_FLEE_SPEED + Math.min(0.55, n.fear / 240)) * n.speedMul;
  n.angle = turnToward(n.angle, ang, 0.32);
  const moved = step(n, ang, spd);
  if (moved <= 0 && ++n.blockedFrames > 4) {
    // Cornered: try the flanks before cowering in place.
    if (n.blockedFrames === 5) {
      if (step(n, ang + 0.8, spd) > 0) { n.blockedFrames = 0; return; }
      if (step(n, ang - 0.8, spd) > 0) { n.blockedFrames = 0; return; }
    }
    if (n.blockedFrames > 18) {
      n.blockedFrames = 0;
      setState(n, ST.COWER);
      n.stateTimer = 45 + ((Math.random() * 60) | 0);
    }
  } else if (moved > 0) {
    n.blockedFrames = 0;
  }
  // Adrenaline gone: back to a normal day.
  if (n.fear <= 6 && n.injuryTimer <= 0 && n.stateTimer > 30) {
    setState(n, ST.WALK);
    abandonRoute(n);
  }
}

function updateInjured(n) {
  // Limp away from whatever hit them, at a fraction of normal speed. Once the
  // wound "settles" they drop the limp and run.
  n.limp = 1;
  const dx = n.x - n.fearX;
  const dy = n.y - n.fearY;
  const ang = Math.hypot(dx, dy) > 1 ? Math.atan2(dy, dx) : n.angle;
  const slow = INJURY_MIN_SLOW + (1 - n.injury) * (INJURY_MAX_SLOW - INJURY_MIN_SLOW);
  n.angle = turnToward(n.angle, ang, 0.1);
  step(n, ang, n.speed * slow * n.speedMul);
  if (n.injuryTimer <= 0) {
    n.injury = 0;
    n.limp = 0;
    n.fear = Math.max(n.fear, 95);
    if (n.ai) {
      abandonRoute(n);
      setState(n, ST.FLEE);
    } else {
      setState(n, ST.FLEE);
    }
  }
}

function updateStagger(n) {
  n.limp = 1;
  if (n.staggerTimer > 0) return;
  n.limp = 0;
  // Back on their feet: still wounded, keep limping, otherwise run.
  if (n.injuryTimer > 0) setState(n, ST.INJURED);
  else if (n.ai) {
    abandonRoute(n);
    setState(n, ST.FLEE);
  } else {
    setState(n, ST.FLEE);
  }
}

// ── Social spacing ───────────────────────────────────────────
function separate(n) {
  scratch.length = 0;
  queryRadiusTyped(n.x, n.y, SEPARATION_R, scratch);
  for (let i = 0; i < scratch.length; i += 2) {
    if (scratch[i + 1] !== KIND_NPC) continue;
    const o = scratch[i];
    if (o === n || o.dead) continue;
    const dx = n.x - o.x;
    const dy = n.y - o.y;
    const d2 = dx * dx + dy * dy;
    if (d2 > SEPARATION_R * SEPARATION_R || d2 < 0.001) continue;
    step(n, Math.atan2(dy, dx), (SEPARATION_R - Math.sqrt(d2)) * 0.16);
  }
}

// ── Gang reactions ───────────────────────────────────────────
/**
 * Gangs keep their own brain (js/ai/gangs.js) but share the body's reactions:
 * a car knocks them down, a wound makes them break off the chase. Returns true
 * when the pedestrian brain owns the body this frame.
 */
export function gangReaction(n) {
  // Mission code spawns its own gang targets (js/missions/missionSystem.js)
  // as bare objects, without going through enableReactions(). Backfill the
  // fields this function needs, or `Math.max(undefined, 80)` poisons the whole
  // character with NaN and they flee for the rest of the session.
  if (typeof n.fear !== "number" || typeof n.injuryTimer !== "number") {
    enableReactions(n);
  }
  const inPanic =
    n.state === ST.FLEE || n.state === ST.COWER ||
    n.state === ST.INJURED || n.state === ST.STAGGER;

  // A wound that has settled clears the limp flag the renderer uses.
  if (n.injuryTimer <= 0 && n.limp && !inPanic) n.limp = 0;

  if (inPanic) {
    n.busy = true;
    if (n.staggerTimer > 0) {
      updateStagger(n);
      return true;
    }
    if (n.injuryTimer > 0) {
      updateInjured(n);
      return true;
    }
    updateFlee(n);
    // Panic over and the player is no longer worth chasing: hand back.
    if (n.fear <= 6 && n.state !== ST.COWER) {
      n.busy = false;
      return false;
    }
    return true;
  }

  // Badly hurt gangs break off and run, even mid-chase.
  if (n.maxHealth && n.health !== undefined && n.health / n.maxHealth < 0.34) {
    n.fear = Math.max(n.fear, 80);
    if (playerRef) {
      n.fearX = playerRef.x;
      n.fearY = playerRef.y;
    }
    n.fearW = 80;
    n.chaseTimer = 0;
    setState(n, ST.FLEE);
    n.busy = true;
    return true;
  }
  return false;
}

/**
 * Speed multiplier for a gang member's own movement code, so a gunshot wound
 * visibly slows them down while they are still chasing.
 */
export function gangSpeedMul(n) {
  if (!n.injuryTimer) return 1;
  return INJURY_MIN_SLOW + (1 - n.injury) * (INJURY_MAX_SLOW - INJURY_MIN_SLOW);
}

// ── Traffic hand-off ─────────────────────────────────────────
/**
 * The driver steps out of a freshly parked car and walks away from it. The
 * returned character is an ordinary pedestrian, so it can be scared, bumped or
 * injured like anyone else.
 */
export function spawnParkedDriver(vehicle, list) {
  const T = CFG.TILE;
  const heading = vehicle.moveAngle !== undefined && vehicle.moveAngle !== null
    ? vehicle.moveAngle
    : vehicle.angle || 0;
  let px = vehicle.x + Math.cos(heading + Math.PI / 2) * (T * 0.45);
  let py = vehicle.y + Math.sin(heading + Math.PI / 2) * (T * 0.45);
  if (!isWalkable(px, py)) {
    px = vehicle.x + Math.cos(heading - Math.PI / 2) * (T * 0.45);
    py = vehicle.y + Math.sin(heading - Math.PI / 2) * (T * 0.45);
  }
  if (!isWalkable(px, py)) {
    px = vehicle.x;
    py = vehicle.y;
  }
  const npc = makeCivilian(px, py, { homeVehicle: vehicle, state: ST.WALK });
  npc.angle = Math.atan2(py - vehicle.y, px - vehicle.x);
  npc.thinkTimer = 0;
  // Send them off down the footway instead of standing next to their own car.
  const t = tileOf(px, py);
  const goal = randomSidewalkTile(t.x, t.y, 9) || randomWalkableTile(t.x, t.y, 9);
  if (goal) {
    npc.pathTag = 1;
    npc.pathPending = true;
    requestPath(npc, goal.x, goal.y, 20, 1);
  }
  list.push(npc);
  return npc;
}

/** Stream out characters the player can no longer see. */
function streamFarEntities(list, kill, budget) {
  if (!playerRef) return;
  // Derived from the viewport, so a wide window streams further out and a
  // narrow one does not carry characters nobody could have seen.
  const R = cullRadius(playerRef.x, playerRef.y);
  const r2 = R * R;
  let spent = 0;
  for (let i = list.length - 1; i >= 0 && spent < budget; i--) {
    const n = list[i];
    if (!n.ai || n.dead) continue;
    if (n.isQuestTarget || n.isQuestPerson || n.isMeetingNpc || n.isPickupTarget) continue;
    const dx = n.x - playerRef.x;
    const dy = n.y - playerRef.y;
    if (dx * dx + dy * dy < r2) continue;
    if (n.state === ST.CROSS) continue; // never delete somebody in the road
    n.dead = true;
    list.splice(i, 1);
    spent++;
    stats.culled++;
  }
}

/**
 * Walk back to the car and get in.
 *
 * A driver who has left the car badly parked is told, half a minute later, that
 * the police are on their way. This is them going back for it: they turn around,
 * walk to the car, and get in - and the car drives off with the police behind.
 *
 * The car is told when its driver is back by a flag on the vehicle, so the two
 * halves do not have to know about each other.
 */
function updateReturn(n) {
  const car = n.homeVehicle;
  if (!car || car.dead || car.exploding) {
    // Nothing to go back to: carry on as an ordinary pedestrian.
    n.homeVehicle = null;
    setState(n, ST.WALK);
    return;
  }
  const dx = car.x - n.x;
  const dy = car.y - n.y;
  const dist = Math.hypot(dx, dy);
  if (dist < CFG.TILE * 0.75) {
    // At the car. Get in: the vehicle knows it has a driver again.
    car.driverBack = true;
    n.dead = true;
    const idx = npcList.indexOf(n);
    if (idx >= 0) npcList.splice(idx, 1);
    return;
  }
  // Head for the car. The pavement is walked, so the goal is the nearest spot
  // beside it rather than the middle of the road.
  if (n.thinkTimer <= 0) {
    n.thinkTimer = 90;
    const tx = Math.floor(car.x / CFG.TILE);
    const ty = Math.floor(car.y / CFG.TILE);
    const spot = nearestSidewalkTile(tx, ty, 4) || { x: tx, y: ty };
    n.goalX = spot.x;
    n.goalY = spot.y;
    n.pathTag = 1;
    n.pathPending = true;
    requestPath(n, spot.x, spot.y, 16, 1);
  }
  // Walk towards it, hugging the pavement.
  const want = Math.atan2(dy, dx);
  const spd = n.speed * (n.limp || 1);
  if (step(n, want, spd) <= 0) {
    // Blocked: try to slip around, or give up and walk normally again.
    if (step(n, want + 0.9, spd) <= 0) {
      if (++n.returnStuck > 90) {
        n.homeVehicle = null;
        setState(n, ST.WALK);
      }
    } else {
      n.returnStuck = 0;
    }
  } else {
    n.returnStuck = 0;
  }
  n.angle = want;
}

/**
 * Tell a driver to go back to their car.
 *
 * Called when a badly parked car has been blocking the road long enough for
 * the police to be called. The driver turns round and walks back to it.
 */
export function callDriverHome(vehicle) {
  for (let i = 0; i < npcList.length; i++) {
    const n = npcList[i];
    if (n.homeVehicle !== vehicle) continue;
    n.returnStuck = 0;
    n.thinkTimer = 0;
    n.path = null;
    n.pathPending = false;
    setState(n, ST.RETURN);
    return n;
  }
  return null;
}

// ── Population upkeep ────────────────────────────────────────
let refillTimer = 0;

/**
 * Where the next batch of civilians should stand.
 *
 * Two rules, both of which the old code ignored:
 *
 *   1. Outside the viewport. Spawning where the player can see it is the
 *      "NPCs appear from nowhere" effect; this is the whole reason spawner.js
 *      exists.
 *   2. In the busiest districts first, and never more than the district's
 *      per-cell cap. `densityAt()` returns people per 4x4 tile square - 4
 *      downtown, 1 in the suburbs - so filling the densest cells first is what
 *      actually concentrates the crowd downtown, and rejecting full cells is what
 *      keeps it inside the cap. Limiting without preferring would spread the
 *      same people thinly over the suburbs instead.
 *
 * The candidate pool reaches as far as the cull radius rather than just the
 * first ring, so a player standing on the edge of downtown gets the busy
 * districts filled before the quiet ones.
 *
 * `isFree` lets a caller reject tiles that already have somebody standing on
 * them, so a fresh batch never stacks on top of the last one. `occupancy` is a
 * map of cell key to how many people are *already* in that square - without it
 * every top-up batch would start its cap from zero and the squares would keep
 * filling past their limit.
 */
export function pickCivilianSpawnTiles(ax, ay, want, isFree, occupancy) {
  const reach = cullRadius(ax, ay) * 0.85;
  const squares = candidateCells(ax, ay, reach, 120);
  // Nearest first.
  //
  // The crowd forms a ring just outside the view, and each square is filled to
  // its *own* district's cap - so a player in the suburbs gets one person per
  // 4x4 around them, and a player downtown gets four, without anybody deciding
  // which of the two to favour. Sorting by density instead would send the whole
  // budget downtown and leave the player standing on an empty street.
  squares.sort((a, b) => {
    const da = (a.x * CFG.TILE - ax) ** 2 + (a.y * CFG.TILE - ay) ** 2;
    const db = (b.x * CFG.TILE - ax) ** 2 + (b.y * CFG.TILE - ay) ** 2;
    if (da !== db) return da - db;
    return densityAt(b.x, b.y) - densityAt(a.x, a.y);
  });
  const out = [];
  const placed = new Map();
  for (let i = 0; i < squares.length && out.length < want; i++) {
    const sq = squares[i];
    const cap = cellCap(sq.x, sq.y);
    if (cap <= 0) continue;
    const key = cellKey(sq.x, sq.y);
    let here = placed.get(key) || 0;
    if (occupancy && occupancy.has(key)) here += occupancy.get(key);
    for (let dy = 0; dy < CELL && out.length < want; dy++) {
      for (let dx = 0; dx < CELL && out.length < want; dx++) {
        const tx = sq.x + dx;
        const ty = sq.y + dy;
        if (!isSidewalkTile(tx, ty)) continue;
        const x = tx * CFG.TILE + CFG.TILE / 2;
        const y = ty * CFG.TILE + CFG.TILE / 2;
        // Off-screen, or the player watches somebody appear.
        if (isVisible(x, y, ax, ay)) continue;
        if (!isWalkable(x, y)) continue;
        if (isFree && !isFree(tx, ty)) continue;
        // The cap belongs to the square, and is read from its origin tile so
        // that it is the same figure everywhere.
        if (here >= cap) { dy = CELL; break; }
        out.push({ x: tx, y: ty });
        here++;
        placed.set(key, here);
      }
    }
  }
  return out;
}

/**
 * Take the crowd back down to its budget.
 *
 * A car that parks puts its driver on the pavement, and those drivers are part
 * of what the player sees - but they arrive outside the top-up's control. Left
 * alone the street drifts well past its target: a driver appears, nobody is
 * removed to make room, and the next car that parks does it again. So the budget
 * is enforced in both directions - people are added when the crowd is thin and
 * the furthest ambient ones are taken away when it is fat.
 *
 * Only pedestrians are removed - never a gang member, never a mission
 * character, and never somebody in the road. A driver who has left a parked car
 * is an ordinary pedestrian from that moment on, so they can be recycled like
 * anyone else; the furthest are chosen first so the removal happens out of
 * sight, and only a few at a time so the street never visibly empties.
 */
function trimPopulation(list, target) {
  let civilians = 0;
  const crowd = [];
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (!n.ai || n.type !== "civilian") continue;
    civilians++;
    crowd.push(n);
  }
  let excess = civilians - target;
  if (excess <= 0 || !crowd.length) return;
  crowd.sort((a, b) => {
    const da = (a.x - playerRef.x) ** 2 + (a.y - playerRef.y) ** 2;
    const db = (b.x - playerRef.x) ** 2 + (b.y - playerRef.y) ** 2;
    return db - da; // furthest first
  });
  for (let i = 0, removed = 0; i < crowd.length && excess > 0 && removed < TRIM_PER_CALL; i++) {
    const n = crowd[i];
    if (n.state === ST.CROSS) continue;
    const idx = list.indexOf(n);
    if (idx < 0) continue;
    n.dead = true;
    list.splice(idx, 1);
    excess--;
    removed++;
    stats.trimmed++;
    stats.culled++;
  }
}

/**
 * Drivers who walk off into the distance, plus casualties, thin the crowd. Top
 * it back up just outside the view every couple of seconds.
 */
function refillPopulation(list, target) {
  if (!playerRef) return;
  // Count the crowd we are actually responsible for. The list also holds gang
  // members and mission characters, and comparing *those* against the civilian
  // target used to switch the refill off entirely - so a street full of quest
  // NPCs meant no pedestrians were ever put back, and the city quietly emptied.
  let civilians = 0;
  // How many are already in each 4x4 square, so the per-square cap is measured
  // against the crowd as it stands and not just against this batch.
  const occupancy = new Map();
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (!n.ai || n.type !== "civilian") continue;
    civilians++;
    const c = cellOrigin(tileOf(n.x, n.y).x, tileOf(n.x, n.y).y);
    const k = cellKey(c.cx, c.cy);
    occupancy.set(k, (occupancy.get(k) || 0) + 1);
  }
  if (civilians > target) {
    trimPopulation(list, target);
    return;
  }
  let missing = target - civilians;
  if (missing <= 0) return;
  // Characters stream out as they wander off, so keep a healthy top-up rate:
  // standing still should not thin the crowd out over time.
  if (missing > 6) missing = 6;
  const spots = pickCivilianSpawnTiles(playerRef.x, playerRef.y, missing, (tx, ty) => {
    const cx = tx * CFG.TILE + CFG.TILE / 2;
    const cy = ty * CFG.TILE + CFG.TILE / 2;
    if (!isWalkable(cx, cy)) return false;
    // One pedestrian per tile is plenty; two on the same square reads as a bug.
    for (let i = 0; i < list.length; i++) {
      const o = list[i];
      if (o.dead || !o.ai || o.type !== "civilian") continue;
      if (Math.abs(o.x - cx) < CFG.TILE * 0.5 && Math.abs(o.y - cy) < CFG.TILE * 0.5) return false;
    }
    return true;
  }, occupancy);
  for (let k = 0; k < spots.length; k++) {
    const x = spots[k].x * CFG.TILE + CFG.TILE / 2 + (Math.random() - 0.5) * 40;
    const y = spots[k].y * CFG.TILE + CFG.TILE / 2 + (Math.random() - 0.5) * 40;
    if (!isWalkable(x, y)) continue;
    list.push(makeCivilian(x, y));
    stats.respawned++;
  }
}

// ── Main entry point ─────────────────────────────────────────
/**
 * @param {Array}    list  the live `npcs` array (mutated in place)
 * @param {Function} kill  killNPC(npcIndex), supplied by the caller
 * @param {Object}   p     the player entity
 */
export function updatePedestrians(list, kill, p) {
  frame++;
  stats.updates++;
  playerRef = p || null;
  npcList = list || npcList;
  decayNoises();

  if (!list || !list.length) return;

  // ── 1. hearing ──
  drainNoises(list, (n, strength, nz) => {
    if (n.dead) return;
    if (!n.listen) return;
    applyNoise(n, strength, nz);
    // Contagion: neighbours catch a fraction of the panic, so one shot sends a
    // whole pavement scattering.
    if (nz.kind === 1 && strength > 0.45) {
      const near = Math.min(150, nz.r * 0.35);
      scratch.length = 0;
      queryRadiusTyped(n.x, n.y, near, scratch);
      for (let i = 0; i < scratch.length; i += 2) {
        if (scratch[i + 1] !== KIND_NPC) continue;
        const o = scratch[i];
        if (o === n || !o.ai || o.dead) continue;
        scare(o, nz.x, nz.y, strength * 0.42);
      }
    }
  });

  // ── 2. impacts ──
  handlePlayerBumps(list, playerRef);
  handleVehicleStrikes(list, frame & 1);

  // ── 3. apply accumulated kills ──
  if (kills.length) {
    for (let i = 0; i < kills.length; i++) {
      const idx = list.indexOf(kills[i]);
      if (idx >= 0 && kill) kill(idx);
    }
    kills.length = 0;
  }

  // ── 4. per-character brains ──
  for (let i = 0; i < list.length; i++) {
    const n = list[i];
    if (n.dead) continue;
    if (n.ai) {
      n.busy = false;
      if (n.thinkTimer > 0) n.thinkTimer--;
      if (n.avoidCrossing > 0) n.avoidCrossing--;
    }
    if (n.fear > 0) {
      n.fear -= FEAR_DECAY;
      if (n.fear < 0) n.fear = 0;
      n.fearW *= 0.97;
    }
    if (n.injuryTimer > 0) n.injuryTimer--;
    if (n.staggerTimer > 0) n.staggerTimer--;
    if (n.bumpCooldown > 0) n.bumpCooldown--;
    // n.crossClear is owned by updateCurb() - it counts *consecutive* clear
    // frames and must not be decayed by the global timer pass.
    if (n.stateTimer < 100000) n.stateTimer++;
    if (n.idleTimer > 0) n.idleTimer--;

    // Knockback bleeds off regardless of what the character intends.
    if (n.kx || n.ky) {
      const kd = Math.hypot(n.kx, n.ky);
      step(n, Math.atan2(n.ky, n.kx), Math.min(kd, 3.2));
      n.kx *= 0.85;
      n.ky *= 0.85;
      if (kd < 0.06) {
        n.kx = 0;
        n.ky = 0;
      }
    }

    if (!n.ai) continue; // gang bodies react in gangReaction()

    if (n.staggerTimer > 0) {
      updateStagger(n);
      continue;
    }
    if (n.injuryTimer > 0) {
      updateInjured(n);
      continue;
    }

    switch (n.state) {
      case ST.FLEE:
      case ST.COWER:
        if (n.state === ST.COWER && n.stateTimer > 60 && n.fear < 40) setState(n, ST.FLEE);
        updateFlee(n);
        break;
      case ST.INJURED:
        updateInjured(n);
        break;
      case ST.STAGGER:
        updateStagger(n);
        break;
      case ST.CURB:
        updateCurb(n);
        break;
      case ST.CROSS:
        updateCross(n);
        break;
      case ST.IDLE:
        updateIdle(n);
        break;
      case ST.RETURN:
        updateReturn(n);
        break;
      default:
        updateWalk(n);
        break;
    }
  }

  // ── 5. cheap social spacing, half the crowd per frame ──
  for (let i = (frame & 1); i < list.length; i += 2) {
    const n = list[i];
    if (!n.ai || n.dead) continue;
    if (n.state === ST.COWER || n.state === ST.STAGGER) continue;
    separate(n);
  }

  // ── 6. collect routes that finished computing ──
  // Capped work: a few searches per frame, each with a hard node ceiling, so
  // routing can never dominate a frame no matter how many agents re-plan.
  pumpPathfinder(3, onPathReady);

  // ── 7. housekeeping ──
  streamFarEntities(list, kill, CULL_PER_FRAME);
  if (--refillTimer <= 0) {
    refillTimer = 60;
    refillPopulation(list, targetPopulation());
  }
}

// ── Debug helpers (used by tools/test_npc_ai.js) ─────────────
export function describeNPC(n) {
  return {
    state: n.state,
    fear: Math.round(n.fear || 0),
    injury: Math.round((n.injury || 0) * 100) / 100,
    injuryTimer: n.injuryTimer || 0,
    stagger: n.staggerTimer || 0,
    crossing: !!n.crossing,
    pathLen: n.path ? n.path.length : -1,
    tile: tileOf(n.x, n.y),
  };
}

export function pedestrianStats() {
  return { ...stats, pendingPaths: pendingPathCount(), frame };
}

export function resetPedestrianStats() {
  stats = {
    updates: 0, crossings: 0, fled: 0, injured: 0, struck: 0, culled: 0, respawned: 0, trimmed: 0,
  };
}