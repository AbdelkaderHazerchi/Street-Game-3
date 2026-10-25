// ======================== MINIMAP ========================
// Shows a zoomed-in view centered on the player with mission arrow
import { CFG, T } from "../core/config.js?v=57";
import { miniCtx, miniCanvas } from "../core/canvas.js?v=57";
import { getTile } from "../map/mapUtils.js?v=57";
import { LS_ZONES } from "../map/mapData.js?v=57";
import { specialBuildings } from "../map/mapState.js?v=57";
import { player } from "../entities/player.js?v=57";
import { police } from "../entities/police.js?v=57";
import { missionGivers, currentMission, usingSequentialMissions, quests } from "../missions/missionState.js?v=57";
import { getActiveMissionGiver, getVisibleStartGivers, getActiveEndGiver, getActiveObjectiveTargets } from "../missions/missionSystem.js?v=57";

// Minimap shows this many world pixels around player (radius)
const MINIMAP_WORLD_RADIUS = 600; // ~6 tiles radius in world pixels

export function renderMinimap() {
  if(!miniCtx || !miniCanvas || !player) return;
  const mc = miniCtx;
  const mw = miniCanvas.width;
  const mh = miniCanvas.height;
  if(!mw || !mh) return;
  mc.clearRect(0, 0, mw, mh);

  const p = (player.inVehicle || player);
  if(!p || typeof p.x !== "number") return;

  // Scale: minimap pixel per world pixel
  // We want MINIMAP_WORLD_RADIUS world pixels to fit in half the minimap size
  const scale = Math.min(mw, mh) / (MINIMAP_WORLD_RADIUS * 2);
  
  // Center of minimap in canvas coordinates
  const centerX = mw / 2;
  const centerY = mh / 2;
  
  // Player is always at center
  const playerMapX = centerX;
  const playerMapY = centerY;

  // Calculate visible tile range (centered on player)
  const radiusTiles = Math.ceil(MINIMAP_WORLD_RADIUS / CFG.TILE);
  const playerTileX = Math.floor(p.x / CFG.TILE);
  const playerTileY = Math.floor(p.y / CFG.TILE);
  const minTileX = Math.max(0, playerTileX - radiusTiles);
  const maxTileX = Math.min(CFG.COLS - 1, playerTileX + radiusTiles);
  const minTileY = Math.max(0, playerTileY - radiusTiles);
  const maxTileY = Math.min(CFG.ROWS - 1, playerTileY + radiusTiles);

  // Draw zone-based background first (only zones intersecting radius)
  for (const z of LS_ZONES) {
    const zx1 = (z.x1 * CFG.TILE - p.x) * scale + centerX;
    const zy1 = (z.y1 * CFG.TILE - p.y) * scale + centerY;
    const zx2 = ((z.x2 + 1) * CFG.TILE - p.x) * scale + centerX;
    const zy2 = ((z.y2 + 1) * CFG.TILE - p.y) * scale + centerY;
    const zw = zx2 - zx1;
    const zh = zy2 - zy1;
    
    // Check if zone intersects with minimap view
    const zoneCenterX = (zx1 + zx2) / 2;
    const zoneCenterY = (zy1 + zy2) / 2;
    const zoneRadiusX = Math.abs(zw) / 2;
    const zoneRadiusY = Math.abs(zh) / 2;
    const dx = Math.abs(zoneCenterX - centerX);
    const dy = Math.abs(zoneCenterY - centerY);
    if (dx > zoneRadiusX + MINIMAP_WORLD_RADIUS * scale || dy > zoneRadiusY + MINIMAP_WORLD_RADIUS * scale) {
      continue;
    }
    
    const zoneColors = {
      hills: "#B8966E",
      downtown: "#808080",
      suburb: "#E8D5B7",
      market: "#C4A882",
      midtown: "#909090",
      airport: "#B0B0B0",
      beach: "#EECBAD",
      docks: "#7A8B8B",
    };
    mc.fillStyle = zoneColors[z.pal] || "#888";
    mc.fillRect(zx1, zy1, zw, zh);
  }

  // Draw map details on top (only tiles within radius)
  for (let y = minTileY; y <= maxTileY; y += 2) {
    for (let x = minTileX; x <= maxTileX; x += 2) {
      const tile = getTile(x, y);
      const px = (x * CFG.TILE - p.x) * scale + centerX;
      const py = (y * CFG.TILE - p.y) * scale + centerY;
      const s = CFG.TILE * 2 * scale;

      // Skip if outside minimap bounds
      if (px + s < 0 || px > mw || py + s < 0 || py > mh) continue;

      if (tile === T.WATER) {
        mc.fillStyle = "#1a5276";
        mc.fillRect(px, py, s, s);
      } else if (tile === T.ROAD) {
        mc.fillStyle = "rgba(80,80,80,0.5)";
        mc.fillRect(px, py, s, s);
      } else if (tile === T.PARK) {
        mc.fillStyle = "#3a7a33";
        mc.fillRect(px + 1, py + 1, s - 2, s - 2);
      } else if (tile === T.PARKING) {
        mc.fillStyle = "#555560";
        mc.fillRect(px, py, s, s);
      } else if (tile === T.SIDEWALK) {
        mc.fillStyle = "#e8d4a0";
        mc.fillRect(px, py, s, s);
      } else if (tile === T.PAVEMENT) {
        mc.fillStyle = "#9e9e9e";
        mc.fillRect(px, py, s, s);
      } else if (tile === T.SPECIAL) {
        const sb = specialBuildings.find((b) => b.x === x && b.y === y);
        if (sb) {
          mc.fillStyle = sb.color;
          mc.fillRect(px, py, s, s);
        }
      }
    }
  }

  // Draw circular boundary for minimap
  mc.strokeStyle = "rgba(255,255,255,0.3)";
  mc.lineWidth = 1;
  mc.beginPath();
  mc.arc(centerX, centerY, MINIMAP_WORLD_RADIUS * scale, 0, Math.PI * 2);
  mc.stroke();

  // Zone name labels on minimap (only within radius)
  mc.font = "7px Arial";
  mc.textAlign = "center";
  for (const z of LS_ZONES) {
    const zcx = (((z.x1 + z.x2) / 2) * CFG.TILE - p.x) * scale + centerX;
    const zcy = (((z.y1 + z.y2) / 2) * CFG.TILE - p.y) * scale + centerY;
    const dx = zcx - centerX;
    const dy = zcy - centerY;
    if (Math.hypot(dx, dy) < MINIMAP_WORLD_RADIUS * scale) {
      mc.fillStyle = "rgba(255,255,255,0.25)";
      mc.fillText(z.name.replace(/ .*/, ""), zcx, zcy + 2);
    }
  }

  // Player dot (always at center)
  mc.fillStyle = "#00ff00";
  mc.beginPath();
  mc.arc(centerX, centerY, 4, 0, Math.PI * 2);
  mc.fill();
  // Player direction indicator
  mc.strokeStyle = "#00ff00";
  mc.lineWidth = 1.5;
  mc.beginPath();
  mc.moveTo(centerX, centerY);
  mc.lineTo(
    centerX + Math.cos(p.angle) * 10,
    centerY + Math.sin(p.angle) * 10
  );
  mc.stroke();

  // Mission arrow - point to next mission/quest location
  drawMissionArrow(mc, scale, centerX, centerY, p.x, p.y);

  // Quests: Main (yellow sequential) & Side (purple dots)
  const _minimapMgs = (quests && quests.length>0) ? getVisibleStartGivers() : (usingSequentialMissions ? (getActiveMissionGiver()? [getActiveMissionGiver()] : []) : missionGivers.filter((mg) => !mg.taken));
  for (const mg of _minimapMgs) {
    const mgX = (mg.x - p.x) * scale + centerX;
    const mgY = (mg.y - p.y) * scale + centerY;
    // Only draw if within minimap bounds
    if (mgX < 0 || mgX > mw || mgY < 0 || mgY > mh) continue;
    const isSide = mg.category==="side";
    mc.fillStyle = isSide ? "#a855f7" : "#ffd700";
    mc.beginPath();
    mc.arc(mgX, mgY, isSide ? 3 : 2.5, 0, Math.PI * 2);
    mc.fill();
    if(isSide){
      mc.fillStyle = "rgba(168,85,247,0.35)";
      mc.beginPath(); mc.arc(mgX, mgY, 4.5,0,Math.PI*2); mc.fill();
    }
  }
  // Active quest End marker (green)
  const activeEnd = getActiveEndGiver && getActiveEndGiver();
  if(activeEnd){
    const ex = (activeEnd.x - p.x) * scale + centerX;
    const ey = (activeEnd.y - p.y) * scale + centerY;
    if (ex >= 0 && ex <= mw && ey >= 0 && ey <= mh) {
      mc.fillStyle = "#22c55e";
      mc.beginPath();
      mc.arc(ex, ey, 3, 0, Math.PI*2);
      mc.fill();
      mc.strokeStyle="rgba(34,197,94,0.8)"; mc.lineWidth=1;
      mc.beginPath(); mc.arc(ex, ey, 5,0,Math.PI*2); mc.stroke();
    }
  }
  // Also show regular mission objective if not quest end
  if (currentMission && !currentMission.completed && !currentMission.failed) {
    const targets = (typeof getActiveObjectiveTargets === "function") ? getActiveObjectiveTargets() : [];
    for (const tg of targets) {
      if (!tg || tg.kind === "dropoff" && currentMission.stages && currentMission.stages[currentMission.stage] && currentMission.stages[currentMission.stage].isQuestEnd) continue;
      const sx = (tg.x - p.x) * scale + centerX;
      const sy = (tg.y - p.y) * scale + centerY;
      if (sx >= 0 && sx <= mw && sy >= 0 && sy <= mh) {
        mc.fillStyle = "#00ff64";
        mc.beginPath();
        mc.arc(sx, sy, 3.5, 0, Math.PI * 2);
        mc.fill();
      }
    }
  }

  // Police
  for (const cop of police) {
    const copX = (cop.x - p.x) * scale + centerX;
    const copY = (cop.y - p.y) * scale + centerY;
    if (copX < 0 || copX > mw || copY < 0 || copY > mh) continue;
    mc.fillStyle = "#ff0000";
    mc.beginPath();
    mc.arc(copX, copY, 2, 0, Math.PI * 2);
    mc.fill();
  }
}

function drawMissionArrow(mc, scale, centerX, centerY, playerWorldX, playerWorldY) {
  let targetX = null;
  let targetY = null;

  const activeEnd = getActiveEndGiver && getActiveEndGiver();
  if (activeEnd) {
    targetX = activeEnd.x;
    targetY = activeEnd.y;
  } else if (currentMission && !currentMission.completed && !currentMission.failed) {
    const targets = (typeof getActiveObjectiveTargets === "function") ? getActiveObjectiveTargets() : [];
    if (targets.length) { targetX = targets[0].x; targetY = targets[0].y; }
    else {
      const stage = currentMission.stages[currentMission.stage];
      if (stage && stage.x) { targetX = stage.x; targetY = stage.y; }
    }
  } else if (quests && quests.length > 0) {
    const activeGiver = getVisibleStartGivers().find(mg => mg.category === "main");
    if (activeGiver) {
      targetX = activeGiver.x;
      targetY = activeGiver.y;
    } else {
      const sideGivers = getVisibleStartGivers().filter(mg => mg.category === "side");
      if (sideGivers.length > 0) {
        let nearest = sideGivers[0];
        let nearestDist = Infinity;
        for (const mg of sideGivers) {
          const dx = mg.x - playerWorldX;
          const dy = mg.y - playerWorldY;
          const dist = Math.hypot(dx, dy);
          if (dist < nearestDist) {
            nearestDist = dist;
            nearest = mg;
          }
        }
        targetX = nearest.x;
        targetY = nearest.y;
      }
    }
  } else if (usingSequentialMissions) {
    const activeGiver = getActiveMissionGiver();
    if (activeGiver) {
      targetX = activeGiver.x;
      targetY = activeGiver.y;
    }
  }

  if (targetX === null || targetY === null) return;

  // Calculate angle from player to target
  const dx = targetX - playerWorldX;
  const dy = targetY - playerWorldY;
  const dist = Math.hypot(dx, dy);

  // Only show arrow if target is outside the minimap radius
  if (dist < MINIMAP_WORLD_RADIUS * 0.7) return;

  const angle = Math.atan2(dy, dx);

  // Draw arrow at edge of minimap
  const arrowRadius = MINIMAP_WORLD_RADIUS * scale - 10;
  const arrowX = centerX + Math.cos(angle) * arrowRadius;
  const arrowY = centerY + Math.sin(angle) * arrowRadius;

  // Draw arrow triangle
  const arrowSize = 10;
  mc.save();
  mc.translate(arrowX, arrowY);
  mc.rotate(angle);
  mc.fillStyle = "#ffff00";
  mc.beginPath();
  mc.moveTo(arrowSize, 0);
  mc.lineTo(-arrowSize, -arrowSize * 0.6);
  mc.lineTo(-arrowSize, arrowSize * 0.6);
  mc.closePath();
  mc.fill();
  mc.strokeStyle = "#ff8800";
  mc.lineWidth = 2;
  mc.stroke();
  mc.restore();
}