/**
 * Where cars are allowed to leave themselves, and what counts as a place.
 *
 * Two kinds of orderly space, and the difference matters because it is what the
 * player sees:
 *
 *   * A **bay** is a marked space off the carriageway - a parking tile with
 *     direct road access. The car reverses in, nose towards the far kerb, and
 *     the road stays clear. This is the designated kind.
 *   * A **kerbside spot** is the outer half of the carriageway itself, tight
 *     against the pavement. The car lies parallel to the kerb, square to the
 *     road. Also orderly, and the only kind available on a street with no car
 *     park near it.
 *
 * The map has parking tiles in several places, but most of them are inside
 * blocks with no road access at all - a car cannot reach them. So a usable bay
 * is a parking tile that touches a road tile, and each one keeps its own door
 * onto the road. A car turns in from the side the door is on, which means it
 * has to approach along the road the right way round: `approach` records the
 * direction of travel that puts the car in the correct lane.
 *
 * The module only describes the spaces and the rules. Which one a given car
 * uses, and how often, is the traffic brain's business (js/ai/traffic.js).
 */

import { CFG, T } from "../core/config.js?v=57";
import { getTile } from "../map/mapUtils.js?v=57";
import {
  isRoadTile, isIntersection, crossingAxis, AXIS_NONE, AXIS_V, AXIS_H,
  kerbTileNear, navCols, navRows,
} from "./navGrid.js?v=57";

const TILE = CFG.TILE;

/**
 * Tiles from the kerb line to the centre of a parked car: half a car plus a
 * little clearance, so it sits in the parking lane rather than out in the
 * traffic.
 */
export const KERB_PARK_OFFSET = 0.46;

/**
 * Narrowest carriageway where parking takes a lane out of use and a crossing on
 * it stops being negotiable.
 */
export const PARK_MIN_LANE_WIDTH = 3;

/**
 * A single marked space.
 *
 *   tx, ty       the parking tile the car stands on
 *   roadX, roadY the road tile in front of it - the way in and out
 *   dirX, dirY   the direction from the road into the space
 *   approach     the direction of travel that puts the car in the right lane
 *   lot          index of the car park it belongs to
 */
let bays = [];
let lots = [];
let built = false;

function isParkingTile(x, y) {
  return getTile(x, y) === T.PARKING;
}

/** Pixel distance. See the note on the same helper in js/ai/traffic.js. */
function dist2(ax, ay) {
  return Math.sqrt(ax * ax + ay * ay);
}

/**
 * Rebuild the bay list from the current map.
 *
 * Cheap: one pass over the parking tiles, and each contiguous area is flooded
 * once. Called when a map loads, alongside the nav grid.
 */
export function rebuildParking() {
  bays = [];
  lots = [];
  built = true;
  const cols = CFG.COLS;
  const rows = CFG.ROWS;
  const seen = new Set();

  for (let y = 0; y < rows; y++) {
    for (let x = 0; x < cols; x++) {
      if (!isParkingTile(x, y)) continue;
      const key = y * cols + x;
      if (seen.has(key)) continue;

      // Flood the contiguous car park so the area can be identified and its
      // bays numbered.
      const area = [];
      const stack = [[x, y]];
      while (stack.length) {
        const [cx, cy] = stack.pop();
        const k = cy * cols + cx;
        if (seen.has(k)) continue;
        if (cx < 0 || cy < 0 || cx >= cols || cy >= rows) continue;
        if (!isParkingTile(cx, cy)) continue;
        seen.add(k);
        area.push([cx, cy]);
        stack.push([cx + 1, cy], [cx - 1, cy], [cx, cy + 1], [cx, cy - 1]);
      }

      // A car park with no road around it is a courtyard, not a car park.
      const lotIndex = lots.length;
      let withRoad = false;
      for (const [cx, cy] of area) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          if (isRoadTile(nx, ny)) { withRoad = true; break; }
        }
        if (withRoad) break;
      }
      if (!withRoad) continue;

      const lot = {
        index: lotIndex,
        x0: Math.min(...area.map((c) => c[0])),
        y0: Math.min(...area.map((c) => c[1])),
        x1: Math.max(...area.map((c) => c[0])),
        y1: Math.max(...area.map((c) => c[1])),
        tiles: area.length,
        bays: [],
      };

      // Every parking tile that touches a road is a bay. The direction of the
      // road tells the car which way to turn in.
      for (const [cx, cy] of area) {
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const nx = cx + dx;
          const ny = cy + dy;
          if (nx < 0 || ny < 0 || nx >= cols || ny >= rows) continue;
          if (!isRoadTile(nx, ny)) continue;
          const dirX = -dx;
          const dirY = -dy;
          // Right-hand traffic: the car must arrive with the space on its
          // right, so the space is to the right of the direction of travel.
          // The right-hand side of a heading a is (-sin a, cos a), so the
          // direction of travel that puts the space on the right is
          // (cos a, sin a) = (dirY, -dirX).
          const appX = dirY;
          const appY = -dirX;
          const bay = {
            tx: cx,
            ty: cy,
            roadX: nx,
            roadY: ny,
            dirX,
            dirY,
            appX,
            appY,
            lot: lotIndex,
          };
          bays.push(bay);
          lot.bays.push(bay);
          break; // one bay per tile: the first road it touches is its door
        }
      }
      lots.push(lot);
    }
  }
}

/** Drop the cached model - call whenever a map is (re)loaded. */
export function invalidateParking() {
  bays = [];
  lots = [];
  built = false;
}

/** All the marked spaces, with their door onto the road. */
export function getBays() {
  if (!built) rebuildParking();
  return bays;
}

/** The car parks, and the size of each one. */
export function getLots() {
  if (!built) rebuildParking();
  return lots;
}

/**
 * A bay to aim for.
 *
 * `biasX/biasY` pulls the choice towards somewhere - the car is being sent to
 * a particular car park. When no bias is given the choice is uniform, so the
 * spaces fill up evenly instead of every car crowding into the same one.
 */
export function pickBay(biasX, biasY) {
  const list = getBays();
  if (!list.length) return null;
  if (typeof biasX !== "number") {
    return list[(Math.random() * list.length) | 0];
  }
  // Nearest bay to the bias point, with a little scatter so cars do not all
  // aim for the exact same space.
  let best = null;
  let bestD = Infinity;
  const scatter = TILE * 3;
  for (let i = 0; i < list.length; i++) {
    const b = list[i];
    const dx = b.tx * TILE + TILE / 2 - biasX + (Math.random() - 0.5) * scatter;
    const dy = b.ty * TILE + TILE / 2 - biasY + (Math.random() - 0.5) * scatter;
    const d = dx * dx + dy * dy;
    if (d < bestD) { bestD = d; best = b; }
  }
  return best;
}

/** The bay a given car is standing in, if it is in one. */
export function bayAt(tx, ty) {
  const list = getBays();
  for (let i = 0; i < list.length; i++) {
    if (list[i].tx === tx && list[i].ty === ty) return list[i];
  }
  return null;
}

/** Is this tile a marked space? */
export function isBayTile(tx, ty) {
  return isParkingTile(tx, ty);
}

// ── Kerbside spots ───────────────────────────────────────────

/**
 * Road width in tiles, measured across the direction of travel.
 */
export function roadWidthAt(tx, ty, horiz) {
  const dx = horiz ? 0 : 1;
  const dy = horiz ? 1 : 0;
  let n = 1;
  for (let d = 1; d < 16; d++) {
    if (!isRoadTile(tx + dx * d, ty + dy * d)) break;
    n++;
  }
  for (let d = 1; d < 16; d++) {
    if (!isRoadTile(tx - dx * d, ty - dy * d)) break;
    n++;
  }
  return n;
}

/**
 * Does a pedestrian crossing run over the exact spot this car would occupy?
 *
 * `navGrid` treats any short road run between pavements as a crossing, and on
 * this city that means a narrow side street is crossable along its whole length,
 * so refusing every crossing tile would leave nowhere to park at all.
 *
 * Two conditions have to hold before parking is refused:
 *
 *   1. The crossing runs over the car's *own* carriageway. A pedestrian
 *      crossing a side street is not in a car's way.
 *   2. The road is wide enough that parking would take a lane out of use.
 *      A two-tile side street still has room for both traffic and pedestrians to
 *      cross once a car is tight against the kerb - which is exactly what happens
 *      in a real city. A three-tile avenue or wider does not, so stopping on its
 *      zebra is what blocks people.
 */
export function crossingBlocksLane(tx, ty, horiz) {
  const ax = crossingAxis(tx, ty);
  if (ax === AXIS_NONE) return false;
  if (!(horiz ? ax === AXIS_V : ax === AXIS_H)) return false;
  return roadWidthAt(tx, ty, horiz) >= PARK_MIN_LANE_WIDTH;
}

/**
 * A kerbside spot on the given road tile, if one is legal here.
 *
 * The car lies parallel to the kerb, in the outer lane, square to the road -
 * which is what makes it read as parked rather than abandoned.
 */
export function kerbSpotAt(tx, ty, horiz) {
  if (!isRoadTile(tx, ty)) return null;
  if (isIntersection(tx, ty)) return null;            // never stop in a junction
  if (crossingBlocksLane(tx, ty, horiz)) return null; // never sit on a zebra
  const kerb = kerbTileNear(tx, ty, 3);
  if (!kerb) return null;                             // must be able to hug a kerb
  const dx = kerb.x - tx;
  const dy = kerb.y - ty;
  const l = dist2(dx, dy) || 1;
  return {
    tx,
    ty,
    x: (kerb.x + 0.5) * TILE - (dx / l) * TILE * KERB_PARK_OFFSET,
    y: (kerb.y + 0.5) * TILE - (dy / l) * TILE * KERB_PARK_OFFSET,
    // Square to the road: the car lies along the carriageway, not at an angle.
    angle: horiz ? 0 : Math.PI / 2,
  };
}

/**
 * The nearest legal kerbside spot to a car that is heading `angle`.
 *
 * Looks ahead first - that is when a driver pulls in - and behind second, so a
 * car that has just passed a space can still take it.
 */
export function kerbSpotNear(tx, ty, angle, ahead = 3, behind = 2) {
  const horiz = Math.abs(Math.cos(angle)) >= Math.abs(Math.sin(angle));
  const hx = Math.cos(angle) >= 0 ? 1 : -1;
  const hy = Math.sin(angle) >= 0 ? 1 : -1;
  for (let d = 1; d <= ahead; d++) {
    const nx = horiz ? tx + hx * d : tx;
    const ny = horiz ? ty : ty + hy * d;
    if (!isRoadTile(nx, ny)) break; // the road ends here
    const spot = kerbSpotAt(nx, ny, horiz);
    if (spot) return spot;
  }
  for (let d = 1; d <= behind; d++) {
    const nx = horiz ? tx - hx * d : tx;
    const ny = horiz ? ty : ty - hy * d;
    const spot = kerbSpotAt(nx, ny, horiz);
    if (spot) return spot;
  }
  return null;
}

/** Snapshot for the F3 overlay and the test suite. */
export function parkingStats() {
  const list = getBays();
  const l = getLots();
  return {
    bays: list.length,
    lots: l.length,
    biggestLot: l.reduce((m, x) => Math.max(m, x.tiles), 0),
    withDoors: l.filter((x) => x.bays.length).length,
  };
}
