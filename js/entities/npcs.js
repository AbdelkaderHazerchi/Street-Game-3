// ======================== NPCS ========================
// Spawning, bookkeeping and the loot drops. All of the actual behaviour lives
// in js/ai/pedestrians.js (civilians) and js/ai/gangs.js (gang members), both
// of which this module wires up and re-exports for backwards compatibility.
import { CFG, T, WEAPONS } from "../core/config.js?v=57";
import { getTile } from "../map/mapUtils.js?v=57";
import { isWalkable } from "./vehicles.js?v=57";
import { player } from "./player.js?v=57";
import { currentMission } from "../missions/missionState.js?v=57";
import { showNotification } from "../ui/hud.js?v=57";
import { updateHUD } from "../ui/hud.js?v=57";
// AI helpers moved to js/ai/ - re-export for compatibility (no logic change)
import { updateGangs } from "../ai/gangs.js?v=57";
import { findPath } from "../ai/pathfinding.js?v=57";
// Pedestrian brain: every character gets a state machine, reactions to the
// player, and a route to walk.
import {
  initPedestrian, enableReactions, updatePedestrians, onPedestrianShot,
  makeCivilian, pickCivilianSpawnTiles, targetPopulation, initialAmbientCount,
  targetGangCount, ST,
} from "../ai/pedestrians.js?v=57";
import { randomSidewalkTile, randomWalkableTile, randomSidewalkTileAnywhere, randomWalkableTileAnywhere, navIsReady, rebuildNavGrid } from "../ai/navGrid.js?v=57";
import { offscreenTiles, SPAWN_WALKABLE } from "../ai/spawner.js?v=57";

export { updateGangs, findPath, ST };

export let npcs = [];
export let lootItems = [];
export function clearNPCs(){ npcs.length = 0; }
export function clearLoot(){ lootItems.length = 0; }
export function setNpcs(v){ npcs = v; }
export function setLootItems(v){ lootItems = v; }

/**
 * Find a good spawn tile: pavement first (that is where pedestrians belong),
 * then any walkable surface, then the bare walkability check as a last resort.
 *
 * Spawns are biased toward the player so the streets they can actually see are
 * populated immediately; without that the crowd all starts 40 blocks away and
 * the world reads as empty for the first minute. Falls back to anywhere if
 * there is nothing near.
 */
function findSpawnTile(nearX, nearY) {
  if (navIsReady() && typeof nearX === "number") {
    for (let i = 0; i < 8; i++) {
      const t = randomSidewalkTile(
        Math.floor(nearX / CFG.TILE), Math.floor(nearY / CFG.TILE), 16);
      if (t) return t;
    }
    for (let i = 0; i < 4; i++) {
      const t = randomWalkableTile(
        Math.floor(nearX / CFG.TILE), Math.floor(nearY / CFG.TILE), 16);
      if (t) return t;
    }
  }
  if (navIsReady()) {
    const pave = randomSidewalkTileAnywhere();
    if (pave) return pave;
    const any = randomWalkableTileAnywhere();
    if (any) return any;
  }
  for (let i = 0; i < CFG.MAX_SPAWN_ATTEMPTS; i++) {
    const tx = 3 + Math.floor(Math.random() * (CFG.COLS - 6));
    const ty = 3 + Math.floor(Math.random() * (CFG.ROWS - 6));
    if (isWalkable(tx * CFG.TILE + CFG.TILE / 2, ty * CFG.TILE + CFG.TILE / 2)) {
      return { x: tx, y: ty };
    }
  }
  const tx = Math.floor(CFG.COLS / 2);
  const ty = Math.floor(CFG.ROWS / 2);
  return { x: tx, y: ty };
}

export function spawnNPCs(nearX, nearY) {
  npcs = [];
  // The nav layer is derived from the tile map; make sure it exists before we
  // ask it where the pavements are.
  try { rebuildNavGrid(); } catch (e) { /* fall through to raw walkability */ }
  if (typeof nearX !== "number" && player && typeof player.x === "number") {
    nearX = player.x;
    nearY = player.y;
  }
  // With no anchor at all (headless caller, or before the player exists) centre
  // on the map so the keep-clear rectangle still means something.
  if (typeof nearX !== "number") {
    nearX = (CFG.COLS * CFG.TILE) / 2;
    nearY = (CFG.ROWS * CFG.TILE) / 2;
  }

  // The street crowd is deliberately far smaller than the count the game was
  // tuned around - see js/ai/pedestrians.js. Density, not head count, is what
  // decides where people are now.
  const gangCount = Math.min(targetGangCount(), CFG.NPC_COUNT);
  const civCount = Math.min(initialAmbientCount(), CFG.NPC_COUNT - gangCount);

  // Civilians go where the density field says people are, just outside the view.
  // Dropping them in a blob around the player is what produced both the crush and
  // the "somebody appears out of nowhere" effect.
  const spots = pickCivilianSpawnTiles(nearX, nearY, civCount);
  // Gang members want to be near enough to matter, but they still must not
  // materialise in front of the camera. The ring starts only a few tiles out,
  // and their own brain closes the distance on foot, so the full margin keeps
  // them out of sight without making them distant.
  const gangSpots = offscreenTiles(nearX, nearY, SPAWN_WALKABLE, gangCount);

  for (let i = 0; i < civCount + gangCount; i++) {
    const isGang = i >= civCount;
    const tile = (isGang ? gangSpots[i - civCount] : spots[i]) || findSpawnTile(nearX, nearY);
    if (!tile) continue;
    const x = tile.x * CFG.TILE + CFG.TILE / 2 + (Math.random() - 0.5) * (CFG.TILE * 0.5);
    const y = tile.y * CFG.TILE + CFG.TILE / 2 + (Math.random() - 0.5) * (CFG.TILE * 0.5);
    if (!isWalkable(x, y)) continue;

    const npc = {
      x,
      y,
      vx: 0,
      vy: 0,
      angle: Math.random() * Math.PI * 2,
      speed: isGang ? 1.0 + Math.random() * 0.8 : 0.5 + Math.random() * 1.0,
      color: isGang
        ? "#8e44ad"
        : [
            "#e74c3c",
            "#3498db",
            "#2ecc71",
            "#f39c12",
            "#9b59b6",
            "#1abc9c",
            "#e67e22",
            "#34495e",
          ][Math.floor(Math.random() * 8)],
      health: isGang ? 40 : 20,
      maxHealth: isGang ? 40 : 20,
      type: isGang ? "gang" : "civilian",
      weapon: isGang,
      state: isGang ? "idle" : ST.WALK,
      targetX: x,
      targetY: y,
      timer: Math.random() * 200,
      size: 12,
      shootTimer: 0,
      chaseTarget: null,
      chaseTimer: 0,
    };
    // Gang members keep their own chase/patrol brain but share the body's
    // reactions (knocked over by a car, spooked by a gunshot).
    if (isGang) enableReactions(npc);
    else initPedestrian(npc);
    npcs.push(npc);
  }
}

/**
 * Per-frame NPC update. Delegates to the pedestrian brain (civilians) and to
 * the gang brain, which is called from the game loop separately.
 */
export function updateNPCs() {
  updatePedestrians(npcs, killNPC, player);
}

/**
 * Hook used by js/entities/bullets.js. The wound slows the character for a
 * while; once it settles they run for it.
 */
export function reactToShot(npc, damage, shooterX, shooterY) {
  onPedestrianShot(npc, damage, shooterX, shooterY);
}

export function killNPC(index) {
  const npc = npcs[index];
  if (!npc) return;
  // Surveillance: any kill fails the mission
  if (currentMission && currentMission.type === "surveillance") {
    currentMission.data.surveillanceKilled = true;
  }
  if (npc.type === "civilian") {
    const moneyDrop = 10 + Math.floor(Math.random() * 30);
    spawnLoot(npc.x, npc.y, "money", moneyDrop);
    showNotification(`💰 قتلت مدنياً! حصلت على $${moneyDrop}`);
    if (currentMission && currentMission.type === "killCivilians") {
      currentMission.data.killCount = (currentMission.data.killCount || 0) + 1;
    }
  } else if (npc.type === "gang") {
    const roll = Math.random();
    const moneyDrop = 20 + Math.floor(Math.random() * 60);
    if (roll < 0.3) {
      spawnLoot(npc.x, npc.y, "money", moneyDrop);
      showNotification(`💰 قتلت أحد أفراد العصابة! حصلت على $${moneyDrop}`);
    } else if (roll < 0.6) {
      spawnLoot(
        npc.x,
        npc.y,
        "ammo_pistol",
        10 + Math.floor(Math.random() * 15),
      );
      showNotification("📦 قتلت أحد أفراد العصابة! حصلت على ذخيرة مسدس");
    } else if (roll < 0.8) {
      spawnLoot(npc.x, npc.y, "ammo_smg", 8 + Math.floor(Math.random() * 10));
      showNotification("📦 قتلت أحد أفراد العصابة! حصلت على ذخيرة رشاش");
    } else {
      spawnLoot(npc.x, npc.y, "ammo_rifle", 5 + Math.floor(Math.random() * 10));
      showNotification("📦 قتلت أحد أفراد العصابة! حصلت على ذخيرة بندقية");
    }
    player.wanted = Math.min(5, player.wanted + 1);
    if (currentMission && currentMission.type === "killTarget" && npc.isQuestTarget && npc.questId === currentMission.questId) {
      currentMission.data.killCount = (currentMission.data.killCount || 0) + 1;
    } else if (currentMission && currentMission.type === "killGang") {
      currentMission.data.killCount = (currentMission.data.killCount || 0) + 1;
    }
  }
  npc.dead = true;
  npcs.splice(index, 1);
}
export const AMMO_TYPES = {
  ammo_pistol: "pistol",
  ammo_smg: "smg",
  ammo_rifle: "rifle",
  ammo_shotgun: "shotgun",
};
export function spawnLoot(x, y, type, amount) {
  lootItems.push({
    x: x + (Math.random() - 0.5) * 10,
    y: y + (Math.random() - 0.5) * 10,
    type: type,
    amount: amount,
    timer: 300, // 5 seconds at 60fps
  });
}

export function updateLoot() {
  for (let i = lootItems.length - 1; i >= 0; i--) {
    const l = lootItems[i];
    l.timer--;
    l.y += Math.sin(Date.now() / 200 + i) * 0.1;
    // floating effect

    // Check if player picks it up
    const dist = Math.hypot(player.x - l.x, player.y - l.y);
    if (dist < 20) {
      if (l.type === "money") {
        player.money += l.amount;
        showNotification(`💰 +$${l.amount}`);
      } else if (AMMO_TYPES[l.type]) {
        const wName = AMMO_TYPES[l.type];
        player.ammo[wName] = (player.ammo[wName] || 0) + l.amount;
        showNotification(`📦 +${l.amount} طلقة ${WEAPONS[wName].name}`);
      }
      lootItems.splice(i, 1);
      updateHUD();
      continue;
    }

    if (l.timer <= 0) {
      lootItems.splice(i, 1);
    }
  }
}