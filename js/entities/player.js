// NOTE: cross-module globals (police, lootItems, currentMission, closeInventory, updateWantedUI) will be wired in js/main.js - logic unchanged
// ======================== PLAYER ========================
// Extracted from game.js:51598, 51609-51647, 53742-53769 - no logic changed
import { CFG } from "../core/config.js?v=57";
import { overlay, overlayTitle, overlayMsg, overlayBtn } from "../core/domRefs.js?v=57";
import { police, clearPolice } from "./police.js?v=57";
import { lootItems, clearLoot } from "./npcs.js?v=57";
import { currentMission, setCurrentMission } from "../missions/missionState.js?v=57";
import { updateWantedUI } from "../ui/hud.js?v=57";
import { closeInventory } from "../ui/inventory.js?v=57";
import { getSpawnPoint, getSpawnPixel } from "../map/mapState.js?v=57";
import { cam } from "../core/canvas.js?v=57";
import { t } from "../ui/i18n.js?v=57";

export let player;
export function setPlayer(v) { player = v; }
function resolveSpawnPixel() {
  // Try module state first, then window fallback, then hardcoded center
  const sp = getSpawnPixel ? getSpawnPixel() : null;
  if (sp && typeof sp.x === "number") return sp;
  if (typeof window !== "undefined" && window._mapSpawnPoint && typeof window._mapSpawnPoint.x === "number") {
    return window._mapSpawnPoint;
  }
  const spTile = getSpawnPoint ? getSpawnPoint() : null;
  if (spTile && typeof spTile.x === "number") {
    return { x: spTile.x * CFG.TILE + CFG.TILE / 2, y: spTile.y * CFG.TILE + CFG.TILE / 2 };
  }
  // Fallback: center of current map or hardcoded 20,20
  const fallbackCols = (CFG.COLS && CFG.COLS > 0) ? CFG.COLS : 40;
  const fallbackRows = (CFG.ROWS && CFG.ROWS > 0) ? CFG.ROWS : 40;
  // If map dims are large (120 default), center at col/2
  // Otherwise fallback to 20 for backward compat when CFG not yet overwritten
  const cx = Math.floor(fallbackCols / 2);
  const cy = Math.floor(fallbackRows / 2);
  // Preserve original 20,20 fallback only if map is at default 120 and spawn missing - but use map center as more sensible
  // Check if center is valid, else 20
  if (fallbackCols === 120 && fallbackRows === 120 && !sp) {
    // Keep legacy center 20 for tests that expect it, but prefer map center
    return { x: cx * CFG.TILE + CFG.TILE / 2, y: cy * CFG.TILE + CFG.TILE / 2 };
  }
  return { x: cx * CFG.TILE + CFG.TILE / 2, y: cy * CFG.TILE + CFG.TILE / 2 };
}

export function createPlayer() {
  const { x: spawnX, y: spawnY } = resolveSpawnPixel();
  return {
    x: spawnX,
    y: spawnY,
    targetX: spawnX,
    targetY: spawnY,
    vx: 0,
    vy: 0,
    angle: 0,
    health: CFG.MAX_HEALTH,
    maxHealth: CFG.MAX_HEALTH,
    money: CFG.START_MONEY,
    wanted: 0,
    wantedTimer: 0,
    inVehicle: null,
    isShooting: false,
    shootTimer: 0,
    onFoot: true,
    speed: CFG.PLAYER_SPEED,
    alive: true,
    size: 12,
    color: "#3498db",
    skinColor: "#f5cba7",
    personalCar: null,
    ownedCars: [],
    weapons: ["fists", "pistol"],
    currentWeapon: 0,
    ammo: {
      fists: 0,
      pistol: 30,
      smg: 0,
      rifle: 0,
      shotgun: 0,
    },
    totalAmmo: {
      fists: 0,
      pistol: 90,
      smg: 120,
      rifle: 60,
      shotgun: 32,
    },
    maxAmmo: {
      fists: 0,
      pistol: 30,
      smg: 30,
      rifle: 20,
      shotgun: 8,
    },
    inventory: [],
    showInventory: false,
    shootCooldown: 0,
    // Supervised bank system (see js/ui/shop.js BANK_RULES)
    bankSafe: 0, // stored money, withdrawable only from the safe
    bankLoans: [], // [{ amount, dueAt }] — each loan repaid as-is, no increase
    bankShares: 0, // company stock shares bought via investments
    bankInvested: 0, // total $ invested (cost basis for profit/loss display)
  };
}

// Vehicle frame rendering — properly balanced save/restore, closed path, fill before stroke, rotation applied and restored
export function drawVehicle(ctx, vehicle) {
  if (!ctx || !vehicle) return;
  ctx.save();
  try {
    ctx.translate(vehicle.x, vehicle.y);
    if (vehicle.angle) ctx.rotate(vehicle.angle);
    const hw = (vehicle.w || 60) / 2;
    const hh = (vehicle.h || 32) / 2;
    // Vehicle body path — closed properly
    ctx.beginPath();
    ctx.moveTo(-hw, -hh);
    ctx.lineTo(hw, -hh);
    ctx.lineTo(hw, hh);
    ctx.lineTo(-hw, hh);
    ctx.closePath();
    // Fill before stroke for proper rendering
    ctx.fillStyle = vehicle.color || "#3498db";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.18)";
    ctx.lineWidth = 1.5;
    ctx.stroke();
    // Optional window detail — also properly closed and filled before stroke
    ctx.beginPath();
    ctx.rect(-hw * 0.35, -hh * 0.7, hw * 0.7, hh * 1.4);
    ctx.closePath();
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.fill();
    ctx.strokeStyle = "rgba(255,255,255,0.12)";
    ctx.lineWidth = 1;
    ctx.stroke();
  } finally {
    ctx.restore();
  }
}

export function playerDie() {
  const lostMoney = player.money;
  player.money = 0; // Lose all carried money on death
  player.alive = false;
  closeInventory();
  overlay.style.display = "flex";
  overlayTitle.textContent = t("overlay.dead");
  overlayMsg.textContent = t("overlay.arrested", { money: lostMoney });
  overlayBtn.textContent = t("overlay.retry");
}

export function respawnPlayer() {
  const { x: spawnX, y: spawnY } = resolveSpawnPixel();
  player.x = spawnX;
  player.y = spawnY;
  player.targetX = spawnX;
  player.targetY = spawnY;
  player.vx = 0;
  player.vy = 0;
  player.health = CFG.MAX_HEALTH;
  player.wanted = 0;
  player.alive = true;
  if (player.inVehicle) {
    player.inVehicle.driver = null;
    player.inVehicle.occupied = false;
    player.inVehicle = null;
    player.onFoot = true;
    player.speed = CFG.PLAYER_SPEED;
  }
  clearPolice();
  clearLoot();
  setCurrentMission(null);
  updateWantedUI();
  // Sync camera to respawn point (engine displays player at spawn)
  try { if (cam) { cam.x = player.x; cam.y = player.y; } } catch {}
  overlay.style.display = "none";
}
