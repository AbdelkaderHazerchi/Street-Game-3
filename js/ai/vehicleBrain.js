// ======================== VEHICLE BRAIN ========================
// The per-car controller for the new traffic system.
//
// Where the old brain steered along an ad-hoc "driving line" rebuilt every
// frame from tile probes, this controller is built from three classical,
// well-understood pieces:
//
//   1. **Pure pursuit steering** - the car aims at a point a fixed distance
//      ahead on its lane path. The look-ahead grows with speed, so a car
//      sweeps through corners on a natural arc instead of snapping between
//      compass headings. A curvature speed limit (v = sqrt(aLat * R)) makes
//      it slow into corners the way a real driver does.
//   2. **Intelligent-driver car following** - acceleration comes from the
//      IDM formula against the nearest obstacle in a forward corridor:
//      free flow, comfortable braking, and a hard stop term that makes
//      queues compress smoothly instead of crashing. Pedestrians in the
//      corridor are treated as stopped traffic, so cars yield early and
//      gently.
//   3. **Junction protocol** - a car asks the network whether its approach
//      has green and whether the box is free *before* committing. Inside a
//      junction it ignores lights and simply clears, which is what stops the
//      gridlock-at-red the naive approach produces.
//
// Movement is written through one function (`writeVelocity`) so takeover
// detection (a mission or the player grabbing the wheel) cannot be missed.
import { CFG } from "../core/config.js?v=57";
import { isOnRoad } from "../entities/vehicles.js?v=57";
import {
  nodeAtWorld, nearestNode, lanePoint, findLanePath, pickDestination,
  lightPermits, junctionFree, claimJunction, releaseJunction,
} from "./roadNetwork.js?v=57";
import { queryRadiusTyped, KIND_VEHICLE, KIND_PLAYER } from "./spatial.js?v=57";

// ── Tuning ───────────────────────────────────────────────────
const ACCEL_MAX = 0.075;      // px/frame^2 free acceleration
const BRAKE_COMFORT = 0.35;   // px/frame^2 comfortable deceleration
const BRAKE_HARD = 0.9;       // px/frame^2 emergency deceleration
const IDM_S0 = 46;            // px minimum bumper gap
const IDM_TIME_GAP = 14;      // frames of headway
const LOOKAHEAD_MIN = 44;     // px pure-pursuit look-ahead at standstill
const LOOKAHEAD_SPEED = 13;   // px of look-ahead per px/frame of speed
const LOOKAHEAD_MAX = 150;
const LAT_ACCEL = 0.09;       // px/frame^2 lateral comfort budget
const STEER_IDLE = 0.10;      // rad/frame at a crawl
const STEER_CRUISE = 0.032;   // rad/frame at cruise
const STEER_FALLOFF = 2.4;    // px/frame where the rate bottoms out
const YIELD_REACH = 150;      // px ahead a pedestrian makes a car slow
const YIELD_PATIENCE = 300;   // frames held up before we ease past them
const YIELD_CREEP = 0.6;      // px/frame while squeezing by a bystander
const BYPASS_LATERAL = 42;    // px of side shift when going around them
const JUNCTION_WAIT = 260;    // frames stopped at a light before re-routing
const STUCK_LIMIT = 320;      // frames motionless while wanting to drive
const PARK_LEAD = 1.4;        // tiles held in lane before swinging into the kerb
const REVERSE_SPEED = 0.35;   // px/frame of the deadlock-breaking back-up
const STUCK_REVERSE_FROM = 60;   // frames wedged before backing up
const STUCK_REVERSE_TO = 105;    // ...and the window in which that is allowed
const JUNCTION_APPROACH_CAP = 2.4; // px/frame entering a box

const scratch = { x: 0, y: 0 };
const scratch2 = { x: 0, y: 0 };
const gapResult = {
  gap: Infinity, blocking: false, pedestrian: false, vehicleBlock: false,
  yieldBlock: null, creep: false, mirror: null,
};

function dist(ax, ay) { return Math.sqrt(ax * ax + ay * ay); }

/**
 * The brain object attached to a vehicle as `v.traffic`.
 *
 * The field names `state`, `speedNow` and `parkAngle` are the contract the
 * renderer and the keyboard already read (brake lights, indicator, enter and
 * exit), so they stay exactly as they were.
 */
export function createBrain(v) {
  return {
    // -- contract fields read by renderer / keyboard --
    state: "drive",       // "drive" | "pullOver" | "parked"
    speedNow: 0,
    parkAngle: 0,

    // -- routing --
    path: [],             // node sequence of the current journey
    pathIdx: 0,
    dest: null,           // destination node
    hasDest: false,

    // -- control --
    node: null,           // node we last occupied
    dir: 0,               // direction of the lane we are driving on
    laneFrom: null,
    laneTo: null,
    junctionHold: 0,      // frames spent inside the current junction tile
    reserved: null,       // junction we have claimed but not yet entered
    exitNode: null,       // box we are still hanging the tail out of
    blockedByOccupant: false, // waiting on a car in the box ahead, not a light
    yieldWait: 0,         // frames held up by someone standing in the lane
    ignored: null,        // that someone, once we have waited long enough
    reversing: 0,         // frames left of a deadlock-breaking back-up
    waitTimer: 0,         // frames waiting at a red / for a junction
    stuck: 0,
    parkedTimer: 0,
    driveTime: 0,

    // -- parking --
    parkX: 0,
    parkY: 0,
    parkApproachX: 0,
    parkApproachY: 0,
    entryAngle: 0,
    plan: null,           // "kerb" once a stop has been chosen

    // -- takeover detection (see writeVelocity) --
    wroteVX: undefined,
    wroteVY: undefined,
    lastTurn: 0,
    lastGap: Infinity,
  };
}

function writeVelocity(v, s, vx, vy) {
  v.vx = vx;
  v.vy = vy;
  s.wroteVX = vx;
  s.wroteVY = vy;
}

/** Has something other than us changed the velocity since we wrote it? */
export function checkTakeover(v, s) {
  if (s.wroteVX === undefined) return false;
  if (Math.abs((v.vx || 0) - s.wroteVX) < 0.01 &&
      Math.abs((v.vy || 0) - s.wroteVY) < 0.01) return false;
  s.state = "parked";
  s.speedNow = 0;
  writeVelocity(v, s, 0, 0);
  return true;
}

// ── Steering ─────────────────────────────────────────────────
function steerRate(speed) {
  const t = Math.min(1, Math.max(0, speed) / STEER_FALLOFF);
  return STEER_IDLE + (STEER_CRUISE - STEER_IDLE) * t;
}

function turnToward(cur, want, rate) {
  let d = want - cur;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  if (d > rate) d = rate;
  else if (d < -rate) d = -rate;
  return cur + d;
}

function angleDiff(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return Math.abs(d);
}

/**
 * The look-ahead point on the lane path, as a pure-pursuit target.
 *
 * `s.path[s.pathIdx]` is the node the car is heading for. The target walks
 * along the path from there until LOOKAHEAD pixels have been covered, so
 * through a corner the car aims past the apex and exits square - the arc a
 * driven line makes, with no per-frame line reconstruction at all.
 */
function pursuitTarget(v, s, look) {
  const T = CFG.TILE;
  let remaining = look;
  let px = v.x;
  let py = v.y;
  let lastX = v.x;
  let lastY = v.y;
  let i = s.pathIdx;
  const n = s.path.length;
  while (i < n) {
    const node = s.path[i];
    const dir = dirBetween(px, py, node.wx, node.wy);
    lanePoint(node, dir, scratch);
    // On the last hop aim at the lane centre; otherwise keep walking.
    const qx = scratch.x;
    const qy = scratch.y;
    const d = dist(qx - px, qy - py);
    if (d >= remaining && d > 0) {
      const f = remaining / d;
      return { x: px + (qx - px) * f, y: py + (qy - py) * f };
    }
    remaining -= d;
    px = qx;
    py = qy;
    lastX = qx;
    lastY = qy;
    i++;
  }
  return { x: lastX, y: lastY };
}

function dirBetween(x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  if (Math.abs(dx) >= Math.abs(dy)) return dx >= 0 ? 0 : 2;
  return dy >= 0 ? 1 : 3;
}

/**
 * Curvature limit for the next stretch of path: v <= sqrt(aLat * R).
 *
 * Measured from the angle between the heading to the current aim point and
 * the heading on towards the one after it. That is a coarse radius estimate,
 * but it is exactly the information a driver uses - "how much lock is
 * coming" - and it produces the slowdown-into-corner look for free.
 */
function curvatureSpeed(v, s, look) {
  const t1 = pursuitTarget(v, s, look);
  const t2 = pursuitTarget(v, s, look * 2);
  const a1 = Math.atan2(t1.y - v.y, t1.x - v.x);
  const a2 = Math.atan2(t2.y - t1.y, t2.x - t1.x);
  const turn = angleDiff(a1, a2);
  if (turn < 0.05) return Infinity;
  const chord = dist(t2.x - t1.x, t2.y - t1.y) || CFG.TILE;
  // Radius of the arc through the two headings over the chord between them.
  const R = chord / (2 * Math.sin(Math.min(turn, 1.4) / 2));
  return Math.sqrt(LAT_ACCEL * Math.max(R, 8));
}

// ── Obstacle scan ────────────────────────────────────────────
/**
 * IDM gap scan down a forward corridor.
 *
 * Vehicles and the player on foot count as stopped traffic if they are
 * slower than us; pedestrians make a car ease off even at walking pace. The
 * corridor widens with distance so a car one lane over in a junction is
 * still seen, but a parked car on the far kerb is not.
 */
const queryBuf = [];
function scanAhead(v) {
  const fx = Math.cos(v.moveAngle);
  const fy = Math.sin(v.moveAngle);
  const reach = 210;
  gapResult.gap = Infinity;
  gapResult.blocking = false;
  gapResult.pedestrian = false;
  gapResult.vehicleBlock = false;
  gapResult.yieldBlock = null;
  gapResult.creep = false;
  gapResult.mirror = null;
  queryBuf.length = 0;
  queryRadiusTyped(v.x, v.y, reach, queryBuf);
  const ourSpeed = Math.hypot(v.vx || 0, v.vy || 0);
  for (let i = 0; i < queryBuf.length; i += 2) {
    const o = queryBuf[i];
    if (o === v) continue;
    if (o.hidden || o.exploding || o.dead) continue;
    const kind = queryBuf[i + 1];
    const dx = o.x - v.x;
    const dy = o.y - v.y;
    const fwd = dx * fx + dy * fy;
    if (fwd > reach) continue;
    const side = Math.abs(-dx * fy + dy * fx);
    const dNear2 = dx * dx + dy * dy;
    // Outside our corridor - but the near field is exempt: at 50px two
    // yawed bodies overlap even when their centres sit outside the corridor
    // cone, and skipping them there is how two cars wedged together for
    // good each decided the other was not in the way.
    if (dNear2 > 58 * 58) {
      if (side > fwd * 0.42 + 20 && fwd > 2) continue; // outside our corridor
      if (fwd <= 2 && side > 80) continue;             // abeam+ but far off
    } else if (fwd <= -30 && side > 40) continue;      // well behind us

    if (kind === KIND_VEHICLE) {
      const their = Math.hypot(o.vx || 0, o.vy || 0);
      // Near field: settle by raw distance, not by corridor position. Two
      // cars spawned on top of each other (or shoved together by a mission)
      // both see the other at fwd ~ 0 and would otherwise sail through one
      // another for good. Same lane only: a car in the oncoming lane sits
      // well outside our half of the road and must not jam us.
      const d2 = dx * dx + dy * dy;
      // A car in the mirror lane is not an obstacle, however slowly it
      // crawls: IDM would treat it as a stopped leader, both drivers would
      // halt side by side, and neither would ever start again - whole
      // streets locked up that way. It only matters when it is actually *in
      // our lane*, so that is the test: a breakdown, or someone facing the
      // wrong way down it.
      const oncoming = Math.abs(Math.cos((o.moveAngle || 0) - (v.moveAngle || 0))) > 0.7;
      // "In our lane" has to be measured in *bodies*, not a fixed width: a
      // car yawed a few degrees off its lane drags half its 60px length
      // sideways, and the flat 30px test then called a rubbing neighbour
      // "the mirror lane" and let it slide through. Two straight cars in
      // adjacent lanes still measure ~32px of combined body and stay
      // independent, so the nose-to-nose deadlock does not come back. Our
      // own side axis is body-aligned, so our contribution is half-width.
      const ux = -fy, uy = fx;
      const ca2 = Math.cos(o.moveAngle || 0), sa2 = Math.sin(o.moveAngle || 0);
      const sideExtentO = (o.w || 60) * 0.5 * Math.abs(ca2 * ux + sa2 * uy) +
                          (o.h || 32) * 0.5 * Math.abs(-sa2 * ux + ca2 * uy);
      const inOurLane = oncoming ? side < sideExtentO + (v.h || 32) * 0.5 + 2
        : side < 44;
      if (d2 < 58 * 58 && inOurLane && fwd > -30) {
        const raw = Math.sqrt(d2) - ((o.w || 60) + (v.w || 60)) * 0.5;
        if (raw < gapResult.gap) gapResult.gap = raw;
        if (raw < 18 && (oncoming || their <= ourSpeed + 0.3)) {
          gapResult.blocking = true;
          gapResult.vehicleBlock = true;
        }
      }
      // Passing side by side, mirror to mirror. Not a leader - we are
      // overtaking nothing and it is going the other way (or the same way,
      // one lane out) - but if the lanes are so narrow that our bodies
      // nearly touch, a small aim wobble clips it. The driver feels that as
      // clearance and steers a touch away instead.
      const relO = Math.cos((o.moveAngle || 0) - (v.moveAngle || 0));
      const bodyGap = (o.w || 60) * 0.5 + (v.w || 60) * 0.5;
      if (side < bodyGap + 10 && fwd > -bodyGap && fwd < 120 &&
          (oncoming || relO > 0.85)) {
        if (!gapResult.mirror || side < gapResult.mirror.side) {
          gapResult.mirror = { o, side, sign: (-dx * fy + dy * fx) >= 0 ? 1 : -1 };
        }
      }
      if (fwd <= 2) continue;
      // Right-angle crossing conflict: a car cutting through our path at a
      // junction reads as "off to one side" in the forward corridor until
      // there is no longer room to brake. Anything close, obliquely aligned
      // and moving is treated as a conflict in its own right - and it is
      // checked *before* the pulling-away skip, because a fast crosser is
      // still a crosser. Parallel cars (rel ~ 1) are ordinary lane
      // neighbours and oncoming cars (rel ~ -1) pass in the mirror lane, so
      // both are excluded.
      const rel = Math.cos((o.moveAngle || 0) - (v.moveAngle || 0));
      if (rel > -0.55 && rel < 0.85 && their > 0.1 && fwd < 85 && side < 85) {
        gapResult.blocking = true;
        gapResult.vehicleBlock = true;
      }
      // Traveling the other way in its own lane: never our leader, or two
      // drivers stopped nose to nose would each wait for the other forever.
      // "Its own lane" is the same body test as above, so a yawed car that
      // is actually intruding still counts.
      if (rel < -0.55 && side >= sideExtentO + (v.h || 32) * 0.5 + 2) continue;
      if (their > ourSpeed + 0.5) continue; // pulling away: not our problem
      const gap = fwd - ((o.w || 60) + (v.w || 60)) * 0.5;
      if (gap < gapResult.gap) gapResult.gap = gap;
      if (gap < 18) { gapResult.blocking = true; gapResult.vehicleBlock = true; }
    } else if (kind === KIND_PLAYER) {
      // Standing in our lane, not crossing: after a long wait we give up on
      // them and ease past, otherwise one person parked mid-road paralyses
      // every car behind them for good. Only ahead counts - someone abeam is
      // not in our path (the abeam window exists for the mirror check above).
      if (fwd <= 2) continue;
      if (yieldGivesUp(v, o)) { gapResult.creep = true; continue; }
      const gap = fwd - 18;
      if (fwd < YIELD_REACH && gap < gapResult.gap) {
        gapResult.gap = gap;
        gapResult.yieldBlock = o;
        if (gap < 10) gapResult.blocking = true;
      }
    } else {
      // A pedestrian in or beside the lane. Slow for them; they may not see
      // us, and unlike the old corridor this never lets one be clipped.
      if (fwd > YIELD_REACH || fwd <= 2) continue;
      if (yieldGivesUp(v, o)) { gapResult.creep = true; continue; }
      const gap = fwd - 20;
      if (gap < gapResult.gap) {
        gapResult.gap = gap;
        gapResult.pedestrian = true;
        gapResult.yieldBlock = o;
        if (gap < 10) gapResult.blocking = true;
      }
    }
  }
  return gapResult.gap;
}

/**
 * Have we already waited out this person?
 *
 * Returns true once `v.traffic.ignored` names them and they are still
 * standing still - the signal to skip yielding this frame. If they start
 * walking again the claim is dropped and we wait properly once more.
 */
function yieldGivesUp(v, o) {
  const s = v.traffic;
  if (!s) return false;
  if (s.ignored !== o) return false;
  if (Math.hypot(o.vx || 0, o.vy || 0) > 0.15) {
    s.ignored = null;
    s.yieldWait = 0;
    return false;
  }
  return true;
}

/** IDM acceleration for the current gap. */
function idmAccel(v, cap, gap) {
  const cruise = Math.min(cap, v.cruiseSpeed || 1.8);
  const speed = Math.hypot(v.vx || 0, v.vy || 0);
  if (!Number.isFinite(gap)) {
    // Free road: just ease towards the cruise cap.
    return cruise > speed ? ACCEL_MAX : (cruise - speed) * 0.3;
  }
  const dv = speed; // the obstacle is treated as stopped-or-slower
  const sStar = IDM_S0 + speed * IDM_TIME_GAP + (speed * speed - dv * dv) / (2 * BRAKE_COMFORT);
  const ratio = sStar / Math.max(gap, 8);
  const a = ACCEL_MAX * (1 - ratio * ratio);
  if (gapResult.blocking) return Math.min(a, -BRAKE_HARD);
  // Hard floor on braking so an anticipated stop never overshoots into a
  // collision the soft model would have allowed.
  return Math.max(a, -BRAKE_HARD);
}

// ── Path upkeep ──────────────────────────────────────────────
/**
 * Keep `s.path` pointed at the node the car is actually driving towards, and
 * drop nodes it has passed. Returns false when the path ran out - the caller
 * then picks a fresh destination.
 */
function advancePath(v, s) {
  const T = CFG.TILE;
  while (s.pathIdx < s.path.length) {
    const n = s.path[s.pathIdx];
    const dx = n.wx - v.x;
    const dy = n.wy - v.y;
    // Lane-centre distance, so a car in the offset lane does not believe it
    // has arrived at a tile it is half a lane away from.
    const arrive = T * 0.62;
    if (dx * dx + dy * dy > arrive * arrive) return true;
    s.pathIdx++;
  }
  return false;
}

/** Build a fresh journey to a new destination. False when none exists. */
function planJourney(v, s, playerX, playerY) {
  const from = nearestNode(v.x, v.y, 6);
  if (!from) return false;
  let to = null;
  // Occasionally aim vaguely towards the player so the city does not feel
  // like it is ignoring them; mostly pick anywhere.
  if (Number.isFinite(playerX) && Math.random() < 0.35) {
    to = nearestNode(playerX, playerY, 10);
    if (to === from) to = null;
  }
  if (!to) to = pickDestination(from, v.moveAngle);
  if (!to) return false;
  if (!findLanePath(from, to, s.path)) return false;
  s.pathIdx = 0;
  s.dest = to;
  s.hasDest = true;
  return true;
}

// ── Parking ──────────────────────────────────────────────────
/**
 * Start a kerbside stop: swing towards the right-hand kerb a couple of tiles
 * ahead and ease in. Called when the journey is over; the car parks and its
 * driver gets out (handled by the orchestrator).
 */
export function startPullOver(v, s) {
  const T = CFG.TILE;
  const fx = Math.cos(v.moveAngle);
  const fy = Math.sin(v.moveAngle);
  // Aim alongside the kerb: right of travel, pulled back a touch so the car
  // turns in from the lane rather than cutting the corner.
  const rx = -fy;
  const ry = fx;
  // Try a full kerb swing first, then progressively tighter ones: on a
  // one-tile street the full offset aims off the carriageway entirely, and
  // a driver just tucks in closer to the centre line instead of giving up.
  for (const lat of [0.5, 0.34, 0.2]) {
    const ax = v.x + fx * T * PARK_LEAD + rx * T * lat;
    const ay = v.y + fy * T * PARK_LEAD + ry * T * lat;
    if (!isOnRoad(ax, ay)) continue; // no road over there: try a tighter swing
    // Never stop across a junction: a car parked over the box blocks every
    // arm of that crossing for the rest of the session, and the reservation
    // system would then have to work around a permanent obstacle. The whole
    // body has to land clear of the box, not just the centre.
    const spot = nodeAtWorld(ax, ay);
    const head = nodeAtWorld(ax + fx * 32, ay + fy * 32);
    const rear = nodeAtWorld(ax - fx * 32, ay - fy * 32);
    if ((spot && spot.junction) || (head && head.junction) ||
        (rear && rear.junction)) continue;
    // The space must be empty. A car already at the kerb here means parking
    // would put us on top of it - find out now, while we can still drive on,
    // rather than during the manoeuvre.
    queryBuf.length = 0;
    queryRadiusTyped(ax, ay, 76, queryBuf);
    let busy = false;
    for (let i = 0; i < queryBuf.length; i += 2) {
      const o = queryBuf[i];
      if (o === v || o.hidden || o.exploding) continue;
      if (queryBuf[i + 1] !== KIND_VEHICLE) continue;
      if (dist(o.x - ax, o.y - ay) < 76) { busy = true; break; }
    }
    if (busy) continue;
    s.state = "pullOver";
    s.plan = "kerb";
    s.parkApproachX = ax - fx * T * 0.5;
    s.parkApproachY = ay - fy * T * 0.5;
    s.parkX = ax;
    s.parkY = ay;
    s.entryAngle = v.moveAngle;
    s.driveTime = 0;
    v.parking = true;
    v.npcState = "pullingOver";
    return true;
  }
  return false;
}

/** Finish the manoeuvre: stand the car square to the kerb and stop it. */
export function finishPark(v, s) {
  const horiz = Math.abs(Math.cos(v.moveAngle)) >= Math.abs(Math.sin(v.moveAngle));
  s.parkAngle = horiz
    ? (Math.cos(v.moveAngle) >= 0 ? 0 : Math.PI)
    : (Math.sin(v.moveAngle) >= 0 ? Math.PI / 2 : -Math.PI / 2);
  s.state = "parked";
  s.speedNow = 0;
  s.plan = null;
  v.parked = true;
  v.parking = false;
  v.npcState = "parked";
  writeVelocity(v, s, 0, 0);
  v.angle = s.parkAngle;
  v.moveAngle = s.parkAngle;
}

// ── The frame update ─────────────────────────────────────────
/**
 * One frame of driving for one car. `px/py` is the player (or their car);
 * `onArrive` is called once when the car decides to stop for good.
 *
 * Returns true when the car is still under AI control.
 */
export function updateVehicle(v, px, py) {
  const T = CFG.TILE;
  if (v.moveAngle === undefined || v.moveAngle === null) v.moveAngle = v.angle || 0;
  if (v.scripted) return true; // mission-controlled: leave position to mission update
  const s = v.traffic;
  // ── parked: sit still, square to the kerb ──
  if (s.state === "parked") {
    s.speedNow = 0;
    writeVelocity(v, s, 0, 0);
    v.angle = s.parkAngle;
    v.moveAngle = s.parkAngle;
    releaseHere(v);
    return true;
  }

  // ── the kerbside manoeuvre ──
  if (s.state === "pullOver") {
    updatePullOver(v, s);
    return true;
  }

  // ── deadlock breaker: creep backwards out of an interlock ──
  // Two cars can end up nose-to-nose (or locked at a junction mouth) where
  // neither can go first: both are stopped, both are waiting. Braking harder
  // never resolves that, so after a short stall against another vehicle the
  // car backs up at walking pace and re-plans from the new spot.
  if (s.reversing > 0) {
    s.reversing--;
    const vx = -Math.cos(v.moveAngle) * REVERSE_SPEED;
    const vy = -Math.sin(v.moveAngle) * REVERSE_SPEED;
    writeVelocity(v, s, vx, vy);
    const nx = v.x + vx;
    const ny = v.y + vy;
    if (isOnRoad(nx, ny)) { v.x = nx; v.y = ny; }
    else s.reversing = 0; // wall behind us: stop backing up
    if (s.reversing === 0) {
      s.stuck = 0;
      s.hasDest = false;   // fresh route from where we ended up
    }
    v.npcState = "moving";
    return true;
  }

  s.driveTime++;
  const node = nodeAtWorld(v.x, v.y);
  if (node) {
    if (node !== s.node) {
      // Stepped onto a new tile: hand back the box we were standing in and
      // take the new one. Keeping `s.node` as the *current* tile (rather
      // than only the last non-junction one) is what makes a box claimed on
      // entry actually get released on exit.
      //
      // releaseJunction refuses while our body still overhangs the crossing,
      // so the rear of the car is covered by the same claim as the nose.
      if (s.node && s.node.junction) {
        if (!releaseJunction(s.node, v)) s.exitNode = s.node;
      }
      s.node = node;
      if (node.junction) {
        claimJunction(node, v);
        // Ownership now rides on s.node, which releases it on exit.
        if (s.reserved === node) s.reserved = null;
      }
    } else if (node.junction) {
      claimJunction(node, v); // re-assert, in case a hold expired mid-crossing
    }
    s.junctionHold = node.junction ? s.junctionHold + 1 : 0;
  }
  // A box we left behind but whose body-overlap kept us holding it: give it
  // back the frame the tail is actually clear.
  if (s.exitNode) {
    if (releaseJunction(s.exitNode, v)) s.exitNode = null;
  }

  // ── keep the path fresh ──
  if (!s.hasDest || !advancePath(v, s)) {
    if (!planJourney(v, s, px, py)) {
      // Wedged off the network (or a road island): re-aim next frame without
      // moving. The orchestrator's stuck watchdog does the rest.
      s.speedNow = 0;
      writeVelocity(v, s, 0, 0);
      return true;
    }
  }

  // ── junction reservation ──
  // Claim the next junction on the path while still on the approach. The
  // first car to claim owns the box; everyone else brakes a full tile early
  // instead of discovering the conflict at the mouth, which is what turns a
  // right-angle meeting into an interlocked pair.
  const nextNode = s.path[Math.min(s.pathIdx, s.path.length - 1)];
  // A box may only be held by a driver who is both *close enough to be
  // committed* and allowed to enter it. Holding from further back - or while
  // waiting at a red - let a car that was merely queued freeze a crossing for
  // the arm that had green, and because every signal in the city runs off the
  // same clock those holds piled up until no car anywhere could move.
  const commitNose = T * 0.5 + (v.w || 60) * 0.5;  // body overlapping the box
  const commitReach = T * 1.15;                    // how near a claim counts
  const stopLine = commitNose + 12;                // where we halt for a box
  const mayEnter = (n) => {
    if (s.junctionHold > 0) return true;               // already crossing
    if (dist(n.wx - v.x, n.wy - v.y) < commitNose) return true; // nose over the line
    return lightPermits(n, dirBetween(v.x, v.y, n.wx, n.wy), s.speedNow);
  };
  if (s.reserved) {
    const dRes = dist(s.reserved.wx - v.x, s.reserved.wy - v.y);
    // The path index runs ahead of the car, so "still the tile we are driving
    // into" is the keeper - not the index - or a claim would be dropped at the
    // mouth while we were still crossing it.
    const stillWanted = s.reserved === nextNode || s.reserved === s.node;
    if (!stillWanted || dRes > commitReach || !mayEnter(s.reserved)) {
      releaseJunction(s.reserved, v);
      s.reserved = null;
    }
  }
  if (nextNode && nextNode.junction && s.reserved !== nextNode &&
      dist(nextNode.wx - v.x, nextNode.wy - v.y) <= commitReach &&
      mayEnter(nextNode) && junctionFree(nextNode, v)) {
    // Claiming ahead is allowed even from inside the box: the tiles of one
    // crossing are all junctions, so a car crossing still has to reserve the
    // tile it is about to take or an arm it is passing will look free.
    claimJunction(nextNode, v);
    s.reserved = nextNode;
  }

  // ── decide the aim point ──
  const look = Math.min(LOOKAHEAD_MAX, LOOKAHEAD_MIN + s.speedNow * LOOKAHEAD_SPEED);
  const aim = pursuitTarget(v, s, look);
  // Swinging wide of someone we have given up waiting for: easing past them
  // is the whole point, so the aim point moves to the far side of the lane.
  if (s.ignored) {
    const bx = s.ignored.x - v.x;
    const by = s.ignored.y - v.y;
    const fwdB = bx * Math.cos(v.moveAngle) + by * Math.sin(v.moveAngle);
    if (fwdB > -24 && fwdB < YIELD_REACH + 140) {
      const sideB = -bx * Math.sin(v.moveAngle) + by * Math.cos(v.moveAngle);
      const away = (sideB > 0 ? -1 : 1) *
        Math.max(0, BYPASS_LATERAL - Math.abs(sideB));
      aim.x += -Math.sin(v.moveAngle) * away;
      aim.y += Math.cos(v.moveAngle) * away;
    }
  }
  // Squeezing past a mirror: two bodies with barely the width of a lane
  // between them - hold the line, but ease away from the tight side rather
  // than let an aim wobble rub paint. The clearance uses each body's true
  // extent along the side axis, not its half-width: a car yawed 5 degrees
  // off its lane drags half its *length* into the gap, and that is exactly
  // the rub the plain-width sum missed.
  if (gapResult.mirror && s.speedNow > 0.2) {
    const ux = -Math.sin(v.moveAngle), uy = Math.cos(v.moveAngle);
    const sideExtent = (o2) => {
      const ca2 = Math.cos(o2.moveAngle || 0), sa2 = Math.sin(o2.moveAngle || 0);
      return (o2.w || 60) * 0.5 * Math.abs(ca2 * ux + sa2 * uy) +
             (o2.h || 32) * 0.5 * Math.abs(-sa2 * ux + ca2 * uy);
    };
    const want = sideExtent(gapResult.mirror.o) + sideExtent(v) + 8;
    const deficit = Math.min(20, Math.max(0, want - gapResult.mirror.side));
    if (deficit > 0) {
      aim.x += ux * (-gapResult.mirror.sign * deficit);
      aim.y += uy * (-gapResult.mirror.sign * deficit);
    }
  }
  const want = Math.atan2(aim.y - v.y, aim.x - v.x);
  const before = v.moveAngle;
  if (s.speedNow > 0.001 || s.waitTimer > 0) {
    v.moveAngle = turnToward(v.moveAngle, want, steerRate(Math.max(s.speedNow, 0.3)));
  }
  s.lastTurn = angleDiff(v.moveAngle, before);

  // ── speed: lights, junction box, car following, curvature ──
  let cap = v.cruiseSpeed || 1.8;
  cap = Math.min(cap, curvatureSpeed(v, s, look));

  // The next tile on the path: ask it for permission to enter. The approach
  // axis is measured towards the junction itself, not towards the pursuit
  // aim point, or a car mid-turn would query the wrong signal.
  //
  // Lights only apply on the way in - a car already inside the box is
  // committed and must clear it. *Occupancy is different*: the box ahead may
  // hold a car crossing our path from the side, and ignoring that just
  // because we are one tile into the same junction is exactly how the
  // right-angle collisions happened. Always ask.
  const next = nextNode;
  let stopForJunction = false;
  if (next && next !== node && next.junction) {
    const entryDir = dirBetween(v.x, v.y, next.wx, next.wy);
    const lit = s.junctionHold === 0 ? lightPermits(next, entryDir, s.speedNow) : true;
    if (!lit || !junctionFree(next, v)) {
      stopForJunction = true;
      s.blockedByOccupant = !lit ? false : true;
    } else {
      s.blockedByOccupant = false;
    }
  }
  const gap = scanAhead(v);
  s.lastGap = gap;
  // ── patience with a stationary person in the lane ──
  // Wait a fair while for someone standing in front of us, then treat them
  // as part of the scenery and ease past - otherwise a player parked in the
  // road deadlocks every car behind them for the rest of the session.
  if (s.ignored) {
    if (dist(s.ignored.x - v.x, s.ignored.y - v.y) > 320) s.ignored = null;
  } else if (s.speedNow < 0.06 && gapResult.yieldBlock) {
    s.yieldWait++;
    if (s.yieldWait > YIELD_PATIENCE) s.ignored = gapResult.yieldBlock;
  }
  if (s.speedNow > 0.3) s.yieldWait = 0;
  // Approach speed: never charge a junction faster than a driver would who
  // may have to stop for whatever is already in the box.
  if (next && next.junction && s.junctionHold === 0 &&
      dist(next.wx - v.x, next.wy - v.y) < T * 2.2) {
    cap = Math.min(cap, JUNCTION_APPROACH_CAP);
  }
  // Passing the person we stopped waiting for: walking pace, so the squeeze
  // reads as care rather than as a swipe at them.
  if (gapResult.creep) cap = Math.min(cap, YIELD_CREEP);
  // Squeezing past a mirror on a curve: both bodies are yawed, so the gap
  // between the lanes is at its thinnest exactly where the aim wobble is at
  // its worst. Crawl while the clearance is under the two side extents.
  if (gapResult.mirror) {
    const mx = gapResult.mirror.o;
    const ux2 = -Math.sin(v.moveAngle), uy2 = Math.cos(v.moveAngle);
    const ext = (o2) => {
      const c2 = Math.cos(o2.moveAngle || 0), s2 = Math.sin(o2.moveAngle || 0);
      return (o2.w || 60) * 0.5 * Math.abs(c2 * ux2 + s2 * uy2) +
             (o2.h || 32) * 0.5 * Math.abs(-s2 * ux2 + c2 * uy2);
    };
    if (gapResult.mirror.side < ext(mx) + ext(v) + 4) cap = Math.min(cap, 0.7);
  }
  let acc = idmAccel(v, cap, gap);
  if (gapResult.pedestrian) acc = Math.min(acc, -0.08);
  if (stopForJunction) {
    // Brake to a standstill clear of the box. The line sits half a tile plus
    // our own half-length short of the box centre, so the *whole car* stays
    // out: a car already inside then has room to turn past without the bodies
    // touching. Measuring from the centre with a flat 0.55T allowance let the
    // nose poke over the line and clip whoever was crossing.
    const dBox = dist(next.wx - v.x, next.wy - v.y) - stopLine;
    const need = -(s.speedNow * s.speedNow) / (2 * Math.max(dBox, 6));
    acc = Math.min(acc, need * 1.3);
  }

  s.speedNow = Math.max(0, Math.min(cap, s.speedNow + acc));
  if (stopForJunction && s.speedNow < 0.05) {
    s.speedNow = 0;
    s.waitTimer++;
  } else {
    s.waitTimer = 0;
  }

  // ── move ──
  const moved = stepCar(v, s);
  if (!moved && s.speedNow > 0.05) {
    // Kerb or wall: kill the speed. The watchdog replans from here.
    s.speedNow = 0;
    writeVelocity(v, s, 0, 0);
  }

  // ── arrival: pull over at the kerb ──
  const dest = s.dest;
  if (dest) {
    const dDest = dist(dest.wx - v.x, dest.wy - v.y);
    // Attempt the stop whenever the destination is reached - the manoeuvre
    // itself governs the speed on the way in. Gating on a slow approach
    // meant a car cruising into its destination overshot it every time and
    // re-planned, so it never parked at all.
    if (dDest < T * 1.2) {
      if (startPullOver(v, s)) return true;
      // No kerb to take: pick a new destination and drive on.
      s.hasDest = false;
    }
  }

  // ── stuck watchdog ──
  // Waiting at a red is normal: the signal cycles on its own, so it never
  // counts as a stall. Waiting on *another car* for the box ahead may be a
  // deadlock of mutual claims - two drivers each holding what the other
  // needs - and only patience breaks that, so it starts counting after a
  // while and runs the usual back-up-and-replan escape.
  const waitingOnCar = stopForJunction && s.blockedByOccupant &&
                       s.waitTimer > JUNCTION_WAIT;
  if (s.speedNow < 0.06 && (!stopForJunction || waitingOnCar)) {
    s.stuck++;
    // Wedged against another *vehicle* (not a red light, not a pedestrian):
    // give it a moment to clear on its own, then back out of the interlock.
    if (s.stuck >= STUCK_REVERSE_FROM && s.stuck <= STUCK_REVERSE_TO &&
        gapResult.vehicleBlock) {
      s.reversing = 42;
      s.stuck = 0;
    } else if (s.stuck > STUCK_LIMIT) {
      // Nothing in front of us and still not moving: re-plan the route.
      s.hasDest = false;
      s.stuck = 0;
    }
  } else {
    s.stuck = 0;
  }
  v.npcState = "moving";
  return true;
}

function releaseHere(v) {
  // Keep the junction flag tidy if the car parks inside one (it should not).
  // Force, since a parked car never moves again - its body position must not
  // hold the crossing for eternity.
  const s = v.traffic;
  if (s.exitNode) { releaseJunction(s.exitNode, v, true); s.exitNode = null; }
  if (s.node && s.node.junction) {
    releaseJunction(s.node, v, true);
  }
}

/** Apply the heading and speed for one frame, with a road-clipped step. */
function stepCar(v, s) {
  const vx = Math.cos(v.moveAngle) * s.speedNow;
  const vy = Math.sin(v.moveAngle) * s.speedNow;
  writeVelocity(v, s, vx, vy);
  const nx = v.x + vx;
  const ny = v.y + vy;
  if (isOnRoad(nx, ny)) {
    v.x = nx;
    v.y = ny;
    if (s.speedNow > 0.001) v.angle = v.moveAngle;
    return true;
  }
  // Clipped the kerb: keep whichever axis is still legal and scrub speed.
  let moved = false;
  if (Math.abs(Math.cos(v.moveAngle)) >= Math.abs(Math.sin(v.moveAngle))) {
    if (isOnRoad(nx, v.y)) { v.x = nx; moved = true; }
  } else if (isOnRoad(v.x, ny)) { v.y = ny; moved = true; }
  if (moved && s.speedNow > 0.001) v.angle = v.moveAngle;
  return moved;
}

/**
 * The kerbside manoeuvre: hold the lane to the approach point, then ease
 * onto the kerb and stop. Gives up cleanly (back to "drive") if the kerb
 * fights the car - a raised pavement on a slope, a car already in the way.
 */
function updatePullOver(v, s) {
  const fx = Math.cos(v.moveAngle);
  const fy = Math.sin(v.moveAngle);
  const past = (v.x - s.parkApproachX) * fx + (v.y - s.parkApproachY) * fy;
  const aimX = past > 0 ? s.parkX : s.parkApproachX;
  const aimY = past > 0 ? s.parkY : s.parkApproachY;
  const dPark = dist(s.parkX - v.x, s.parkY - v.y);
  const want = Math.atan2(aimY - v.y, aimX - v.x);
  const off = angleDiff(want, v.moveAngle);
  if (off > 2.2 || s.driveTime > 620) {
    // Bay is behind us or the manoeuvre has dragged on: abandon it.
    s.state = "drive";
    s.plan = null;
    v.parking = false;
    v.npcState = "moving";
    s.hasDest = false;
    return;
  }
  const before = v.moveAngle;
  v.moveAngle = turnToward(v.moveAngle, want, steerRate(Math.max(s.speedNow, 0.25)));
  s.lastTurn = angleDiff(v.moveAngle, before);

  const gap = scanAhead(v);
  let cap = Math.min(v.cruiseSpeed || 1.8, Math.max(0.3, dPark / 26));
  if (gap < IDM_S0) cap = Math.min(cap, 0.25);
  if (gapResult.blocking) cap = 0;
  // Squeezing into the kerb past a car in the mirror: the swing takes the
  // body across the gap, so ease the speed while the clearance is tighter
  // than the two bodies - the same rub the drive state steers around.
  if (gapResult.mirror) {
    const mx = gapResult.mirror.o;
    const wantGap = ((mx.w || 60) + (v.w || 60)) * 0.5 * 0.5 + (mx.h || 32) * 0.5 + (v.h || 32) * 0.5;
    if (gapResult.mirror.side < wantGap) cap = Math.min(cap, 0.6);
  }
  const acc = cap > s.speedNow ? ACCEL_MAX : (cap - s.speedNow) * 0.5;
  s.speedNow = Math.max(0, Math.min(cap, s.speedNow + acc));

  const moved = stepCar(v, s);
  if (!moved) {
    s.speedNow = 0;
    writeVelocity(v, s, 0, 0);
    // Straighten towards the entry heading and try once more; a nudge on the
    // kerb is not a reason to abort.
    v.moveAngle = turnToward(v.moveAngle, s.entryAngle, STEER_IDLE);
    if (!stepCar(v, s)) {
      s.state = "drive";
      s.plan = null;
      v.parking = false;
      v.npcState = "moving";
      s.hasDest = false;
      return;
    }
  }
  s.driveTime++;
  if (dPark < 22 || (s.speedNow < 0.05 && s.driveTime > 70)) finishPark(v, s);
}
