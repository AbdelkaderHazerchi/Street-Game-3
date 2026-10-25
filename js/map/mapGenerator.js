// ======================== MAP GENERATOR ========================
// Extracted from game.js:50933-50974 + 50976-51015 + 51215-51595 - no logic changed
import { CFG, T } from "../core/config.js?v=57";
import { map, buildings, specialBuildings, buildingColor, buildingHeight, buildingShape, buildingRotation, buildingAsset, buildingLots, PALETTES, setMap, setBuildings, setSpecialBuildings, setBuildingColor, setBuildingHeight, setBuildingShape, setBuildingRotation, setBuildingAsset, setBuildingLots, setCrossings, setSpawnPoint, getSpawnPoint, getSpawnPixel } from "./mapState.js?v=57";
import { MAP_DATA, LS_ZONES, ensureMapData } from "./mapData.js?v=57";
import { getTile } from "./mapUtils.js?v=57";
import { installStoryContent } from "../story/storyQuests.js?v=57";

export async function initMap() {
  // Map data lives in mapData.json, accessed through mapData.js (async fetch).
  // Falls back to the procedural city if the JSON cannot be loaded.
  try {
    const data = await ensureMapData();
    if (data) {
      loadMapFromData(data);
      return;
    }
  } catch (e) {
    console.warn("[initMap] mapData.json failed, using procedural map", e);
  }
  if (MAP_DATA) {
    loadMapFromData(MAP_DATA);
    return;
  }
  generateMap();
  // Procedural map fallback spawn - center validated
  const cx = Math.floor(CFG.COLS / 2), cy = Math.floor(CFG.ROWS / 2);
  const validated = findNearestWalkableSpawn(cx, cy) || { x: cx, y: cy };
  setSpawnPoint(validated);
  if (typeof window !== "undefined") {
    window._mapSpawnPoint = { x: validated.x * CFG.TILE + CFG.TILE / 2, y: validated.y * CFG.TILE + CFG.TILE / 2 };
    window._mapMissionGivers = null;
    window._mapQuests = null;
    window._mapChats = null;
    try{ if(window.SG_Chat && window.SG_Chat.initChats) window.SG_Chat.initChats(); }catch{}
    // Procedural fallback: still install the story quests so the campaign exists.
    try { installStoryContent(); } catch(e){ console.warn("[initMap] story install failed", e); }
  }
}

export function loadMapFromData(data) {
  if(typeof data.cols === "number" && data.cols>=8 && data.cols<=200) CFG.COLS = data.cols;
  if(typeof data.rows === "number" && data.rows>=8 && data.rows<=200) CFG.ROWS = data.rows;
  // Clone tiles to avoid mutating original data, handle ragged rows
  const tilesCopy = data.tiles ? data.tiles.map(row => Array.isArray(row) ? [...row] : []) : [];
  // Migration: make sand constant sandy yellow, pavement distinct
  // Old maps have SIDEWALK (2) for both road sidewalks (pavement) and beach sand.
  // Detect old maps (no PAVEMENT yet) and convert non-beach SIDEWALK to PAVEMENT
  const hasPavement = tilesCopy.some(row => Array.isArray(row) && row.includes(T.PAVEMENT));
  if (!hasPavement) {
    for (let y = 0; y < tilesCopy.length; y++) {
      for (let x = 0; x < (tilesCopy[y]||[]).length; x++) {
        if (tilesCopy[y][x] === T.SIDEWALK) {
          const isBeach = [
            [x-1,y],[x+1,y],[x,y-1],[x,y+1]
          ].some(([nx,ny]) => nx>=0 && ny>=0 && nx<CFG.COLS && ny<CFG.ROWS && tilesCopy[ny]?.[nx] === T.WATER);
          if (!isBeach) {
            // Road sidewalk / inland pavement - convert to PAVEMENT (gray) to keep sand only at beach
            // Sand remains SIDEWALK (2) which now renders as constant sandy yellow
            tilesCopy[y][x] = T.PAVEMENT;
          }
        }
      }
    }
  }
  setMap(tilesCopy);
  if (data.buildingColors) {
    setBuildingColor(data.buildingColors.map((r) =>
      r.map((c) => (c === null ? undefined : c)),
    ));
    setBuildingHeight(data.buildingHeights.map((r) =>
      r.map((h) => (h === null ? undefined : h)),
    ));
    // Load shape/rotation if present, else init
    if (data.buildingShapes) {
      setBuildingShape(data.buildingShapes.map((r) => r.map((c) => (c === null ? null : c) )));
    } else {
      const ns=[]; for(let y=0;y<CFG.ROWS;y++){ ns[y]=[]; for(let x=0;x<CFG.COLS;x++) ns[y][x]=null; } setBuildingShape(ns);
    }
    if (data.buildingRotations) {
      setBuildingRotation(data.buildingRotations.map((r) => r.map((c) => (c === null ? 0 : c) )));
    } else if (data.buildingRotations === undefined) {
      const nr=[]; for(let y=0;y<CFG.ROWS;y++){ nr[y]=[]; for(let x=0;x<CFG.COLS;x++) nr[y][x]=0; } setBuildingRotation(nr);
      // fill random shape/rotation for existing building tiles where missing
      for(let y=0;y<CFG.ROWS;y++) for(let x=0;x<CFG.COLS;x++) if(getTile(x,y)===T.BUILDING){
        if(buildingShape[y][x]==null) buildingShape[y][x]= Math.floor(Math.random()*3);
        if(buildingRotation[y][x]==null) buildingRotation[y][x]= Math.floor(Math.random()*4);
      }
    }
  } else {
    generateBuildingColors();
  }
  // Load the drawn-building asset layer (optional; absent = all procedural)
  if (Array.isArray(data.buildingAssets)) {
    setBuildingAsset(data.buildingAssets.map((r) => (Array.isArray(r) ? r.slice() : [])));
  } else {
    setBuildingAsset([]);
  }
  // Rectangular lots. When the map supplies them they are authoritative, so
  // normalizeBuildingsTo2x2() must NOT run: it would re-group every plot into
  // 2x2 squares and destroy the footprint the city was planned with.
  if (Array.isArray(data.buildingLots) && data.buildingLots.length) {
    const lots = data.buildingLots
      .filter((l) => l && typeof l.x === "number" && typeof l.y === "number")
      .map((l) => ({
        x: l.x | 0, y: l.y | 0,
        w: Math.max(1, l.w | 0 || 2), h: Math.max(1, l.h | 0 || 2),
        color: l.color, height: l.height | 0 || 1,
        shape: l.shape | 0, rot: l.rot | 0, asset: l.asset || null,
      }));
    setBuildingLots(lots);
    setBuildings(lots.map((l) => ({
      x: l.x, y: l.y, w: l.w, h: l.h, color: l.color,
      height: l.height, shape: l.shape, rotation: l.rot, type: "normal",
    })));
  } else {
    setBuildingLots([]);
    // Legacy path: no lots supplied, so enforce 4 sqm (2x2) buildings.
    normalizeBuildingsTo2x2();
  }
  setSpecialBuildings(data.specialBuildings || []);
  // Pedestrian crossings. Optional: a map without them simply draws no bars.
  if (Array.isArray(data.crossings)) {
    setCrossings(data.crossings
      .filter((c) => c && typeof c.x === "number" && typeof c.y === "number")
      .map((c) => ({
        x: c.x | 0, y: c.y | 0,
        w: Math.max(1, c.w | 0 || 3), h: Math.max(1, c.h | 0 || 3),
        road: c.road === "h" ? "h" : "v",
      })));
  } else {
    setCrossings([]);
  }
  LS_ZONES.length = 0;
  LS_ZONES.push(...(data.zones || LS_ZONES));

  // Load player spawn point from map editor - validated + walkable fallback
  let validatedSpawn = null;
  if (data.spawnPoint && typeof data.spawnPoint.x === "number" && typeof data.spawnPoint.y === "number") {
    const tx = Math.floor(data.spawnPoint.x);
    const ty = Math.floor(data.spawnPoint.y);
    const clamped = { x: Math.max(0, Math.min(tx, CFG.COLS - 1)), y: Math.max(0, Math.min(ty, CFG.ROWS - 1)) };
    validatedSpawn = findNearestWalkableSpawn(clamped.x, clamped.y) || clamped;
    setSpawnPoint(validatedSpawn);
    const spawnPixelX = validatedSpawn.x * CFG.TILE + CFG.TILE / 2;
    const spawnPixelY = validatedSpawn.y * CFG.TILE + CFG.TILE / 2;
    if (typeof window !== "undefined") window._mapSpawnPoint = { x: spawnPixelX, y: spawnPixelY };
  } else {
    // No spawn in map -> fallback to map center (validated)
    const cx = Math.floor(CFG.COLS / 2), cy = Math.floor(CFG.ROWS / 2);
    validatedSpawn = findNearestWalkableSpawn(cx, cy) || { x: cx, y: cy };
    setSpawnPoint(validatedSpawn);
    const spawnPixelX = validatedSpawn.x * CFG.TILE + CFG.TILE / 2;
    const spawnPixelY = validatedSpawn.y * CFG.TILE + CFG.TILE / 2;
    if (typeof window !== "undefined") window._mapSpawnPoint = { x: spawnPixelX, y: spawnPixelY };
  }

  // Store chats (generic NPC chats) if present
  if (typeof window !== "undefined") {
    if (Array.isArray(data.chats) && data.chats.length > 0) {
      window._mapChats = data.chats;
    } else if (Array.isArray(data.dialogues) && data.dialogues.length > 0) {
      window._mapChats = data.dialogues;
    } else {
      window._mapChats = null;
    }
    // Ensure chat module picks up new chats
    try { if(window.SG_Chat && window.SG_Chat.initChats) window.SG_Chat.initChats(); } catch{}
  }
  // Store map-defined quests (new two-point system) + legacy fallback
  if (typeof window !== "undefined") {
    // New quests array (two-point, bilingual)
    if (Array.isArray(data.quests) && data.quests.length > 0) {
      window._mapQuests = data.quests;
      // Also expose legacy for backward compat derived from quests start points (use ?? to preserve 0)
      window._mapMissionGivers = data.quests.map(q=>({ x: (q.start?.x ?? q.x), y: (q.start?.y ?? q.y), type:q.type, icon:q.icon, category:q.category, title:q.title, desc:q.desc, reward: (q.reward ?? 300), start:q.start, end:q.end, id:q.id, order: (q.order ?? 0) }));
      // Also expose spammers if present
      if(Array.isArray(data.spammers) && data.spammers.length) window._mapSpammers = data.spammers;
      else if(Array.isArray(data.missionGivers)) window._mapSpammers = data.missionGivers.filter(m=>m.type==="spammer");
    } else if (Array.isArray(data.missionGivers) && data.missionGivers.length > 0) {
      // Migrate legacy flat missionGivers to quests (main, auto end offset)
      const legacyQuests = data.missionGivers.filter(m=>m.type!=="spammer").map((m, idx)=>{
        const sx=Math.floor(m.x), sy=Math.floor(m.y);
        const type=m.type||"taxi";
        // if legacy already had start/end (from newer editor but stored as missionGivers), preserve
        const start = m.start ? {x:Math.floor(m.start.x), y:Math.floor(m.start.y)} : {x:sx,y:sy};
        const end = m.end ? {x:Math.floor(m.end.x), y:Math.floor(m.end.y)} : {x: Math.min(CFG.COLS-1, sx+4), y: sy};
        return {
          id: m.id||`q_main_${idx}_${type}_${sx}_${sy}`,
          category: m.category||"main",
          type, icon: m.icon||"⭐",
          reward: (m.reward ?? 300),
          order: (m.order ?? idx),
          start, end,
          title: m.title||{ar:type,en:type},
          desc: m.desc||{ar:"",en:""}
        };
      });
      window._mapQuests = legacyQuests;
      window._mapMissionGivers = data.missionGivers;
      window._mapSpammers = data.missionGivers.filter(m=>m.type==="spammer");
    } else {
      window._mapQuests = null;
      window._mapMissionGivers = null;
      window._mapSpammers = null;
    }
    // Ensure spammers window global also set from data.spammers if exists
    if(Array.isArray(data.spammers)) window._mapSpammers = data.spammers;
  }

  // ── Story layer ────────────────────────────────────────────────
  // Installs the six-chapter story quests and the six story landmarks.
  // Runs last so the landmarks can prune the generic building entries that
  // normalizeBuildingsTo2x2() just created for the same tiles.
  try {
    installStoryContent();
  } catch (e) {
    console.warn("[loadMapFromData] story content install failed", e);
  }
}

export function generateBuildingColors() {
  const newColor = [];
  const newHeight = [];
  const newShape = [];
  const newRotation = [];
  buildings.length = 0;
  for (let y = 0; y < CFG.ROWS; y++) {
    newColor[y] = [];
    newHeight[y] = [];
    newShape[y] = [];
    newRotation[y] = [];
    for (let x = 0; x < CFG.COLS; x++) {
      newColor[y][x] = null;
      newHeight[y][x] = 0;
      newShape[y][x] = null;
      newRotation[y][x] = 0;
    }
  }
  const visited = new Set();
  for (let y = 0; y < CFG.ROWS; y++) {
    for (let x = 0; x < CFG.COLS; x++) {
      if (getTile(x, y) !== T.BUILDING) continue;
      const key = x + "," + y;
      if (visited.has(key)) continue;
      // Try to form 2x2 block at (x,y) - expand to 4 sqm
      let can2x2 = x + 1 < CFG.COLS && y + 1 < CFG.ROWS;
      if (can2x2) {
        // Ensure 2x2 window not already visited
        if (visited.has((x + 1) + "," + y) || visited.has(x + "," + (y + 1)) || visited.has((x + 1) + "," + (y + 1))) can2x2 = false;
      }
        if (can2x2) {
          // Convert missing tiles to building to ensure 4 sqm, but never overwrite ROAD/WATER/SPECIAL
          for (let dy = 0; dy < 2; dy++) {
            for (let dx = 0; dx < 2; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= CFG.COLS || ny >= CFG.ROWS) continue;
              const t = map[ny][nx];
              if (t !== T.BUILDING && t !== T.ROAD && t !== T.WATER && t !== T.SPECIAL) map[ny][nx] = T.BUILDING;
              else if(t !== T.BUILDING) can2x2 = false;
              visited.add(nx + "," + ny);
            }
          }
          if(!can2x2) continue;
        const zone = getZone(x, y);
        const palette = zone >= 0 ? PALETTES[LS_ZONES[zone].pal] : PALETTES.suburb;
        const color = palette[Math.floor(Math.random() * palette.length)];
        const h = 1 + Math.floor(Math.random() * 5);
        const shape = Math.floor(Math.random() * 3); // 0,1,2  - selectable by number in editor
        const rot = Math.floor(Math.random() * 4); // 0-3 => 0°,90°,180°,270°
        for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
          const nx = x + dx, ny = y + dy;
          if (nx >= CFG.COLS || ny >= CFG.ROWS) continue;
          newColor[ny][nx] = color;
          newHeight[ny][nx] = h;
          newShape[ny][nx] = shape;
          newRotation[ny][nx] = rot;
        }
        buildings.push({ x, y, w: 2, h: 2, color, height: h, shape, rotation: rot, type: "normal" });
      } else {
        // Single tile fallback (should not happen after expansion, but keep)
        const zone = getZone(x, y);
        const palette = zone >= 0 ? PALETTES[LS_ZONES[zone].pal] : PALETTES.suburb;
        const color = palette[Math.floor(Math.random() * palette.length)];
        const h = 1 + Math.floor(Math.random() * 5);
        const shape = Math.floor(Math.random() * 3);
        const rot = Math.floor(Math.random() * 4);
        newColor[y][x] = color;
        newHeight[y][x] = h;
        newShape[y][x] = shape;
        newRotation[y][x] = rot;
        visited.add(key);
        buildings.push({ x, y, w: 1, h: 1, color, height: h, shape, rotation: rot, type: "normal" });
      }
    }
  }
  setBuildingColor(newColor);
  setBuildingHeight(newHeight);
  setBuildingShape(newShape);
  setBuildingRotation(newRotation);
}

export function normalizeBuildingsTo2x2() {
  // Unify and rebuild as 2x2 via greedy covering (ensures 4 sqm)
  {
    const visited = new Set();
    // First, ensure every building tile belongs to a 2x2 block - expand singles if needed
    for (let y = 0; y < CFG.ROWS; y++) {
      for (let x = 0; x < CFG.COLS; x++) {
        if (map[y][x] !== T.BUILDING) continue;
        const key = x + "," + y;
        if (visited.has(key)) continue;
        let can2x2 = x + 1 < CFG.COLS && y + 1 < CFG.ROWS &&
          !visited.has((x + 1) + "," + y) && !visited.has(x + "," + (y + 1)) && !visited.has((x + 1) + "," + (y + 1));
        // Check if 2x2 window is fully building (or can be made fully building by converting)
        if (can2x2) {
          let allBuilding = map[y][x] === T.BUILDING && map[y][x + 1] === T.BUILDING && map[y + 1][x] === T.BUILDING && map[y + 1][x + 1] === T.BUILDING;
          if (!allBuilding) {
            // Expand: convert missing tiles to building to enforce 4 sqm (never overwrite ROAD/WATER/SPECIAL)
            let canExpand = true;
            for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
              const nx = x + dx, ny = y + dy;
              if (nx >= CFG.COLS || ny >= CFG.ROWS) continue;
              const t = map[ny][nx];
              if (t === T.ROAD || t === T.WATER || t === T.SPECIAL) canExpand = false;
            }
            if(!canExpand) can2x2 = false;
            else {
              for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
                const nx = x + dx, ny = y + dy;
                if (nx >= CFG.COLS || ny >= CFG.ROWS) continue;
                if (map[ny][nx] !== T.BUILDING) map[ny][nx] = T.BUILDING;
              }
            }
          }
        }
        if (can2x2) {
          const col = buildingColor[y]?.[x] || buildingColor[y]?.[x + 1] || buildingColor[y + 1]?.[x] || "#808080";
          const h = buildingHeight[y]?.[x] || buildingHeight[y]?.[x + 1] || buildingHeight[y + 1]?.[x] || 2;
          const shape = buildingShape[y]?.[x] ?? buildingShape[y]?.[x + 1] ?? buildingShape[y + 1]?.[x] ?? Math.floor(Math.random()*3);
          const rot = buildingRotation[y]?.[x] ?? buildingRotation[y]?.[x + 1] ?? buildingRotation[y + 1]?.[x] ?? Math.floor(Math.random()*4);
          for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= CFG.COLS || ny >= CFG.ROWS) continue;
            buildingColor[ny][nx] = col;
            buildingHeight[ny][nx] = h;
            buildingShape[ny][nx] = shape;
            buildingRotation[ny][nx] = rot;
            visited.add(nx + "," + ny);
          }
        } else {
          visited.add(key);
        }
      }
    }
  }
  buildings.length = 0;
  {
    const visited2 = new Set();
    for (let y = 0; y < CFG.ROWS; y++) {
      for (let x = 0; x < CFG.COLS; x++) {
        if (map[y][x] !== T.BUILDING) continue;
        const key = x + "," + y;
        if (visited2.has(key)) continue;
        if (x + 1 < CFG.COLS && y + 1 < CFG.ROWS &&
          map[y][x + 1] === T.BUILDING && map[y + 1][x] === T.BUILDING && map[y + 1][x + 1] === T.BUILDING &&
          !visited2.has((x + 1) + "," + y) && !visited2.has(x + "," + (y + 1)) && !visited2.has((x + 1) + "," + (y + 1))) {
          const col = buildingColor[y][x];
          const h = buildingHeight[y][x];
          const shape = buildingShape[y]?.[x] ?? Math.floor(Math.random()*3);
          const rot = buildingRotation[y]?.[x] ?? 0;
          if (col) buildings.push({ x, y, w: 2, h: 2, color: col, height: h, shape, rotation: rot, type: "normal" });
          visited2.add(key); visited2.add((x + 1) + "," + y); visited2.add(x + "," + (y + 1)); visited2.add((x + 1) + "," + (y + 1));
        } else {
          const col = buildingColor[y][x];
          const h = buildingHeight[y][x];
          const shape = buildingShape[y]?.[x] ?? Math.floor(Math.random()*3);
          const rot = buildingRotation[y]?.[x] ?? 0;
          if (col) buildings.push({ x, y, w: 1, h: 1, color: col, height: h, shape, rotation: rot, type: "normal" });
          visited2.add(key);
        }
      }
    }
  }
}

/**
 * Find nearest walkable tile for spawn validation.
 * Walkable = ROAD, SIDEWALK, PARK, PARKING (same as isWalkable)
 * Searches in expanding squares up to radius 12.
 */
export function findNearestWalkableSpawn(tx, ty) {
  const walkable = new Set([T.ROAD, T.SIDEWALK, T.PAVEMENT, T.PARK, T.PARKING]);
  // Quick check origin
  const originTile = getTile(tx, ty);
  if (walkable.has(originTile)) return { x: tx, y: ty };
  for (let r = 1; r <= 12; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (let dy of [-r, r]) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || nx >= CFG.COLS || ny < 0 || ny >= CFG.ROWS) continue;
        if (walkable.has(getTile(nx, ny))) return { x: nx, y: ny };
      }
    }
    for (let dy = -r + 1; dy <= r - 1; dy++) {
      for (let dx of [-r, r]) {
        const nx = tx + dx, ny = ty + dy;
        if (nx < 0 || nx >= CFG.COLS || ny < 0 || ny >= CFG.ROWS) continue;
        if (walkable.has(getTile(nx, ny))) return { x: nx, y: ny };
      }
    }
  }
  return null;
}

// Re-export spawn helpers for player module
export { getSpawnPoint, getSpawnPixel };

export function exportMapJSON() {
  const sp = getSpawnPoint();
  const mg = (typeof window !== "undefined" && window._mapMissionGivers) ? window._mapMissionGivers : [];
  const qs = (typeof window !== "undefined" && window._mapQuests) ? window._mapQuests : [];
  const chats = (typeof window !== "undefined" && window._mapChats) ? window._mapChats : (typeof window !== "undefined" && window._mapChats === null ? [] : []);
  return JSON.stringify({
    cols: CFG.COLS,
    rows: CFG.ROWS,
    tiles: map,
    buildingColors: buildingColor.map((r) => r.map((c) => c || null)),
    buildingHeights: buildingHeight.map((r) => r.map((h) => h || null)),
    buildingShapes: buildingShape.map((r) => r.map((c) => c ?? null)),
    buildingRotations: buildingRotation.map((r) => r.map((c) => c ?? 0)),
    specialBuildings: specialBuildings,
    spawnPoint: sp ? { x: sp.x, y: sp.y } : { x: Math.floor(CFG.COLS / 2), y: Math.floor(CFG.ROWS / 2) },
    missionGivers: mg,
    quests: qs,
    chats: chats || [],
    zones: LS_ZONES,
  });
}

export function getZone(x, y) {
  for (let i = 0; i < LS_ZONES.length; i++) {
    const z = LS_ZONES[i];
    if (x >= z.x1 && x <= z.x2 && y >= z.y1 && y <= z.y2) return i;
  }
  return -1;
}

// ======================== LOS SANTOS SHAPE MASK ========================
// Polygon approximating the LS city boundary (tile coords on 120x120 grid)
export const LS_CITY_POLYGON = [
  // Upper-left coast (Vinewood Hills area)
  [8, 12],
  [14, 6],
  [28, 2],
  [50, 2], // Top coastline going right
  [72, 2],
  [90, 3],
  [105, 8], // Right coast going down
  [113, 18],
  [116, 38],
  [117, 58], // Lower-right
  [115, 75],
  [112, 88], // Airport bottom-right
  [106, 100],
  [96, 110], // South coastline
  [80, 115],
  [65, 117],
  [50, 115], // Harbor indentation (docks jut into water)
  [38, 110], // Bottom-left coast
  [22, 100],
  [10, 86], // Left coast going up
  [4, 70],
  [3, 52],
  [4, 32],
  [6, 18], // Close back to start
  [8, 12],
];

// Inner harbor bay - water cuts into the southern city
export const LS_HARBOR_BAY = [
  [42, 108],
  [55, 112],
  [68, 108],
  [70, 100],
  [65, 95],
  [55, 93],
  [45, 95],
  [42, 100],
  [42, 108],
];

export function pointInPolygon(px, py, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i][0],
      yi = polygon[i][1];
    const xj = polygon[j][0],
      yj = polygon[j][1];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) {
      inside = !inside;
    }
  }
  return inside;
}

export function isInLosSantos(x, y) {
  return pointInPolygon(x, y, LS_CITY_POLYGON);
}

export function isInHarborBay(x, y) {
  return pointInPolygon(x, y, LS_HARBOR_BAY);
}

// Vinewood Hills large park zone (upper-left of city)
export function isVinewoodHills(x, y) {
  return x >= 3 && x <= 32 && y >= 3 && y <= 28;
}

export function generateMap() {
  map.length = 0;
  buildings.length = 0;
  specialBuildings.length = 0;

  const roadW = CFG.ROAD_W;
  const block = CFG.BLOCK;
  const cycle = CFG.CYCLE;

  for (let y = 0; y < CFG.ROWS; y++) {
    map[y] = [];
    for (let x = 0; x < CFG.COLS; x++) {
      // Border or outside Los Santos polygon → water
      if (
        x < 2 ||
        x >= CFG.COLS - 2 ||
        y < 2 ||
        y >= CFG.ROWS - 2 ||
        !isInLosSantos(x, y) ||
        isInHarborBay(x, y)
      ) {
        map[y][x] = T.WATER;
        continue;
      }
      // Vinewood Hills upper-left → park/hills terrain
      if (isVinewoodHills(x, y)) {
        const mx = (x - 2) % cycle;
        const my = (y - 2) % cycle;
        if (mx < roadW || my < roadW) {
          map[y][x] =
            mx < roadW && my < roadW
              ? T.ROAD
              : mx < roadW
                ? mx === 0 || mx === roadW - 1
                  ? T.PAVEMENT
                  : T.ROAD
                : my === 0 || my === roadW - 1
                  ? T.PAVEMENT
                  : T.ROAD;
        } else {
          map[y][x] = T.PARK;
          // hills are mostly green
        }
        continue;
      }
      const mx = (x - 2) % cycle;
      const my = (y - 2) % cycle;
      if (mx < roadW || my < roadW) {
        if (mx < roadW && my < roadW) {
          map[y][x] = T.ROAD;
        } else if (mx < roadW) {
          map[y][x] = mx === 0 || mx === roadW - 1 ? T.PAVEMENT : T.ROAD;
        } else {
          map[y][x] = my === 0 || my === roadW - 1 ? T.PAVEMENT : T.ROAD;
        }
        continue;
      }
      map[y][x] = T.BUILDING;
    }
  }

  // Place parks (more parks like Griffith Park, etc.)
  const parkPositions = [
    [3, 1],
    [5, 3],
    [1, 5],
    [8, 2],
    [10, 5],
    [2, 8],
    [6, 10],
    [11, 8],
    [4, 12],
    [9, 11],
    [7, 4],
    [3, 10],
  ];
  for (const [bix, biy] of parkPositions) {
    const bx = 2 + bix * cycle + roadW + 1;
    const by = 2 + biy * cycle + roadW + 1;
    for (let dy = 0; dy < block - 1; dy++) {
      for (let dx = 0; dx < block - 1; dx++) {
        const px = bx + dx;
        const py = by + dy;
        if (
          px < CFG.COLS - 2 &&
          py < CFG.ROWS - 2 &&
          isInLosSantos(px, py) &&
          !isInHarborBay(px, py)
        )
          map[py][px] = T.PARK;
      }
    }
  }

  // LS Airport runways – flat area in lower-center of city
  for (let ay = 80; ay < 105; ay++) {
    for (let ax = 55; ax < 85; ax++) {
      if (!isInLosSantos(ax, ay) || isInHarborBay(ax, ay)) continue;
      const mx2 = (ax - 2) % cycle;
      const my2 = (ay - 2) % cycle;
      if (mx2 < roadW || my2 < roadW) continue;
      // keep road tiles
      map[ay][ax] = T.PARKING;
      // flat tarmac
    }
  }
  // Runway stripes
  for (let ry = 82; ry < 104; ry++) {
    const rx1 = 60,
      rx2 = 78;
    if (isInLosSantos(rx1, ry) && !isInHarborBay(rx1, ry))
      map[ry][rx1] = T.ROAD;
    if (isInLosSantos(rx2, ry) && !isInHarborBay(rx2, ry))
      map[ry][rx2] = T.ROAD;
  }

  // Beach strips along southern and western coasts
  for (let y = 0; y < CFG.ROWS; y++) {
    for (let x = 0; x < CFG.COLS; x++) {
      if (map[y][x] === T.WATER) continue;
      // Check if adjacent to water → add sandy beach sidewalk
      const neighbors = [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ];
      for (const [nx, ny] of neighbors) {
        if (
          nx >= 0 &&
          ny >= 0 &&
          nx < CFG.COLS &&
          ny < CFG.ROWS &&
          map[ny][nx] === T.WATER
        ) {
          if (map[y][x] === T.BUILDING || map[y][x] === T.PARK) {
            map[y][x] = T.SIDEWALK;
            // sandy shore
          }
          break;
        }
      }
    }
  }

  // Place Los Santos landmarks
  placeSpecial(
    2 + cycle * 1 + roadW,
    2 + cycle * 1 + roadW,
    "#cc4444",
    "مستشفى Vinewood",
    3,
  );
  placeSpecial(
    2 + cycle * 5 + roadW,
    2 + cycle * 1 + roadW,
    "#4455cc",
    "مركز شرطة LS",
    3,
  );
  placeSpecial(
    2 + cycle * 2 + roadW,
    2 + cycle * 0 + roadW,
    "#d4a017",
    "كازينو Caligula",
    4,
  );
  placeSpecial(
    2 + cycle * 3 + roadW,
    2 + cycle * 4 + roadW,
    "#bb66aa",
    "نادي Rodeo",
    2,
  );
  placeSpecial(
    2 + cycle * 10 + roadW,
    2 + cycle * 4 + roadW,
    "#88aacc",
    "مطار LS",
    5,
  );
  placeSpecial(
    2 + cycle * 9 + roadW,
    2 + cycle * 1 + roadW,
    "#cc8844",
    "ملعب LS",
    3,
  );
  placeSpecial(
    2 + cycle * 5 + roadW,
    2 + cycle * 2 + roadW,
    "#ccaa44",
    "بنك LS المركزي",
    4,
  );
  placeSpecial(
    2 + cycle * 1 + roadW,
    2 + cycle * 10 + roadW,
    "#aa8844",
    "ميناء LS",
    4,
  );
  placeSpecial(
    2 + cycle * 10 + roadW,
    2 + cycle * 7 + roadW,
    "#66bbaa",
    "منتزه Vespucci",
    3,
  );
  placeSpecial(
    2 + cycle * 8 + roadW,
    2 + cycle * 10 + roadW,
    "#ddaa66",
    "شاطئ Santa Maria",
    3,
  );

  // === SHOPS === 4 sqm (2x2) each
  placeSpecial(
    2 + cycle * 4 + roadW,
    2 + cycle * 3 + roadW,
    "#cc4444",
    "🔫 Ammu-Nation",
    2,
  );
  placeSpecial(
    2 + cycle * 2 + roadW,
    2 + cycle * 5 + roadW,
    "#e8a0c8",
    "👕 Binco",
    2,
  );
  placeSpecial(
    2 + cycle * 10 + roadW,
    2 + cycle * 2 + roadW,
    "#44aaff",
    "🚗 معرض سيارات",
    2,
  );
  placeSpecial(
    2 + cycle * 6 + roadW,
    2 + cycle * 8 + roadW,
    "#44cc88",
    "💊 عيادة",
    2,
  );
  // Casino - 4 sqm
  placeSpecial(
    2 + cycle * 8 + roadW,
    2 + cycle * 4 + roadW,
    "#d4a017",
    "🎰 Casino",
    2,
  );

  // Generate building metadata with zone-based colors - 2x2 buildings (4 sqm) greedy
  buildingColor.length = 0;
  buildingHeight.length = 0;
  buildingShape.length = 0;
  buildingRotation.length = 0;
  for (let y = 0; y < CFG.ROWS; y++) {
    buildingColor[y] = [];
    buildingHeight[y] = [];
    buildingShape[y] = [];
    buildingRotation[y] = [];
    for (let x = 0; x < CFG.COLS; x++) {
      buildingColor[y][x] = null;
      buildingHeight[y][x] = 0;
      buildingShape[y][x] = null;
      buildingRotation[y][x] = 0;
    }
  }
  {
    const visited = new Set();
    for (let y = 0; y < CFG.ROWS; y++) {
      for (let x = 0; x < CFG.COLS; x++) {
        if (map[y][x] !== T.BUILDING) continue;
        const key = x + "," + y;
        if (visited.has(key)) continue;
        let can2x2 = x + 1 < CFG.COLS && y + 1 < CFG.ROWS;
        if (can2x2) {
          if (visited.has((x + 1) + "," + y) || visited.has(x + "," + (y + 1)) || visited.has((x + 1) + "," + (y + 1))) can2x2 = false;
        }
        if (can2x2) {
          for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= CFG.COLS || ny >= CFG.ROWS) continue;
            if (map[ny][nx] !== T.BUILDING) map[ny][nx] = T.BUILDING;
            visited.add(nx + "," + ny);
          }
          const zone = getZone(x, y);
          const palette = zone >= 0 ? PALETTES[LS_ZONES[zone].pal] : PALETTES.suburb;
          const color = palette[Math.floor(Math.random() * palette.length)];
          let height = 1 + Math.floor(Math.random() * 5);
          if (zone === 1) height = 3 + Math.floor(Math.random() * 3);
          else if (zone === 4) height = 1 + Math.floor(Math.random() * 4);
          else if (zone === 5 || zone === 6) height = 1 + Math.floor(Math.random() * 3);
          const shape = Math.floor(Math.random()*3);
          const rot = Math.floor(Math.random()*4);
          for (let dy = 0; dy < 2; dy++) for (let dx = 0; dx < 2; dx++) {
            const nx = x + dx, ny = y + dy;
            if (nx >= CFG.COLS || ny >= CFG.ROWS) continue;
            buildingColor[ny][nx] = color;
            buildingHeight[ny][nx] = height;
            buildingShape[ny][nx] = shape;
            buildingRotation[ny][nx] = rot;
          }
          buildings.push({ x, y, w: 2, h: 2, color, height, shape, rotation: rot, type: "normal" });
        } else {
          const zone = getZone(x, y);
          const palette = zone >= 0 ? PALETTES[LS_ZONES[zone].pal] : PALETTES.suburb;
          const color = palette[Math.floor(Math.random() * palette.length)];
          let height = 1 + Math.floor(Math.random() * 5);
          if (zone === 1) height = 3 + Math.floor(Math.random() * 3);
          else if (zone === 4) height = 1 + Math.floor(Math.random() * 4);
          else if (zone === 5 || zone === 6) height = 1 + Math.floor(Math.random() * 3);
          const shape = Math.floor(Math.random()*3);
          const rot = Math.floor(Math.random()*4);
          buildingColor[y][x] = color;
          buildingHeight[y][x] = height;
          buildingShape[y][x] = shape;
          buildingRotation[y][x] = rot;
          visited.add(key);
          buildings.push({ x, y, w: 1, h: 1, color, height, shape, rotation: rot, type: "normal" });
        }
      }
    }
  }
  // Assign random 90° rotation to each shop (special building) block - store in buildingRotation for persistence
  {
    const visitedShop = new Set();
    const shopMap = new Map();
    for (const sb of specialBuildings) shopMap.set(sb.x+","+sb.y, sb);
    for (const sb of specialBuildings) {
      const key = sb.x+","+sb.y;
      if (visitedShop.has(key)) continue;
      const group=[];
      const stack=[sb];
      visitedShop.add(key);
      while(stack.length){
        const cur=stack.pop();
        group.push(cur);
        for(const [dx,dy] of [[0,-1],[0,1],[-1,0],[1,0]]){
          const nk=cur.x+dx+","+(cur.y+dy);
          if(!visitedShop.has(nk)){
            const n=shopMap.get(nk);
            if(n && n.name===cur.name){ visitedShop.add(nk); stack.push(n); }
          }
        }
      }
      const rot=Math.floor(Math.random()*4);
      for(const g of group){
        if(buildingRotation[g.y] && buildingRotation[g.y][g.x]!==undefined) buildingRotation[g.y][g.x]=rot;
      }
    }
  }
}

export function placeSpecial(bx, by, color, name, size, design=null) {
  // design: "old" (classic) or "new" (striped as in images) - only for car, binco, casino, general store
  let effectiveDesign = design;
  if(effectiveDesign===null){
    const n = (name||"").toLowerCase();
    const eligible = n.includes("car") || n.includes("سيارات") || n.includes("showroom") || n.includes("binco") || n.includes("clothing") || n.includes("casino") || n.includes("كازينو") || n.includes("caligula") || n.includes("general");
    if(eligible){
      // randomly pick old/new for variety, but keep old as default for backward compat 50/50
      effectiveDesign = Math.random() < 0.5 ? "new" : "old";
    } else {
      effectiveDesign = "old";
    }
  }
  for (let dy = 0; dy < size; dy++) {
    for (let dx = 0; dx < size; dx++) {
      const px = bx + dx;
      const py = by + dy;
      if (px < CFG.COLS - 2 && py < CFG.ROWS - 2) {
        map[py][px] = T.SPECIAL;
        const entry = {
          x: px,
          y: py,
          color,
          name,
        };
        if(effectiveDesign && effectiveDesign !== "old") entry.design = effectiveDesign;
        // also store as shopDesign for editor compat
        if(effectiveDesign && effectiveDesign !== "old") entry.shopDesign = effectiveDesign;
        specialBuildings.push(entry);
      }
    }
  }
}
