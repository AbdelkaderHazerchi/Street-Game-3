// ======================== GAME LOOP ========================
// Extracted from game.js:55391-55438 - no logic changed
import { G } from "./config.js?v=57";
import { gameState, gameOver, setGameOver } from "./state.js?v=57";
import { preloadAssets } from "../assets/preload.js?v=57";
import { initMap } from "../map/mapGenerator.js?v=57";
import { loadFullMap } from "../map/mapUtils.js?v=57";
import { invalidateNavGrid } from "../ai/navGrid.js?v=57";
import { invalidateDensity } from "../ai/density.js?v=57";
import { player, createPlayer, setPlayer } from "../entities/player.js?v=57";
import { spawnVehicles } from "../entities/vehicles.js?v=57";
import { spawnNPCs } from "../entities/npcs.js?v=57";
import { initTrafficNetwork } from "../ai/traffic.js?v=57";
import { generateMissions } from "../missions/missionSystem.js?v=57";
import { updateWantedUI, updateHUD } from "../ui/hud.js?v=57";
import { updateMissionUI } from "../missions/missionSystem.js?v=57";
import { initTouchControls } from "../input/touch.js?v=57";
import { showMainMenu } from "../ui/menu.js?v=57";
import { invPanel } from "./domRefs.js?v=57";
import { render } from "../render/renderer.js?v=57";
import { update } from "./update.js?v=57";
import { cam } from "./canvas.js?v=57";
import { initSounds, updateCityMusic, updateMenuMusic, pauseCityMusic, updateDrivingSound } from "../audio/sounds.js?v=57";

export function gameLoop() {
  // City music: loops only during gameplay (not menu/pause)
  try { updateCityMusic(gameState, G); } catch {}
  // Menu music: loops only while in main menu
  try { updateMenuMusic(gameState, G); } catch {}
  // Driving sound (pre-update, handles pause/menu fade)
  try {
    const isInVehiclePre = !!(player && player.inVehicle);
    const vPre = isInVehiclePre ? player.inVehicle : null;
    const speedPre = vPre ? Math.hypot(vPre.vx || 0, vPre.vy || 0) : 0;
    const maxSpeedPre = vPre ? (vPre.type ? vPre.type.speed : (vPre.speed || 5)) : 5;
    updateDrivingSound({ isInVehicle: isInVehiclePre, speed: speedPre, maxSpeed: maxSpeedPre, gameState, G });
  } catch {}
  if (gameState === G.PLAYING && !gameOver && player && player.alive) {
    update();
    // Driving sound post-update with fresh speed for responsive volume
    try {
      const isInVehicle = !!(player && player.inVehicle);
      const v = isInVehicle ? player.inVehicle : null;
      const speed = v ? Math.hypot(v.vx || 0, v.vy || 0) : 0;
      const maxSpeed = v ? (v.type ? v.type.speed : (v.speed || 5)) : 5;
      updateDrivingSound({ isInVehicle, speed, maxSpeed, gameState, G });
    } catch {}
  } else {
    // Ensure city pauses immediately when not playing (menu/pause) even if update not called
    // updateCityMusic already handles, but also ensure no machine gun lingers
    try { if (gameState !== G.PLAYING) { /* handled via updateCityMusic */ } } catch {}
  }
  render();
  requestAnimationFrame(gameLoop);
}

// ======================== INIT ========================
export async function initGame() {
  try { initSounds(); } catch {}
  await preloadAssets();
  await initMap();
  loadFullMap();
  // The AI navigation layer is derived from the tile map, so it has to be
  // dropped whenever the map is (re)loaded. It rebuilds lazily on first use.
  invalidateNavGrid();
  // Same for the population density field, which is built from the map's
  // district list.
  try { invalidateDensity(); } catch (e) { /* optional */ }
  // createPlayer now internally resolves spawn via mapState/window._mapSpawnPoint (single source)
  const p = createPlayer();
  setPlayer(p);
  if (typeof window !== "undefined") window.player = p;
  // Sync camera to spawn immediately - ensures engine displays player at correct coordinates
  try { if (cam) { cam.x = p.x; cam.y = p.y; } } catch {}
  // Populate the streets around the player rather than uniformly across a
  // 120x120 city, so the world is alive the moment you arrive.
  spawnVehicles(p.x, p.y);
  spawnNPCs(p.x, p.y);
  // Build the lane graph the NPC vehicle brains drive on. Derived from the
  // tile map, so it happens after initMap, like the nav grid.
  try { initTrafficNetwork(); } catch (e) { console.warn("SG traffic: network init failed", e); }
  generateMissions();
  updateWantedUI();
  updateHUD();
  updateMissionUI();
  if (invPanel) invPanel.style.display = "none";

  showMainMenu();
  setGameOver(false);
}

// Start with intro video -- F4 skips intro (robust, prevents browser default)
export const introVideo = document.getElementById("introVideo");
let introFinished = false;
export async function skipIntro() {
  if (introFinished) return;
  introFinished = true;
  if (introVideo && introVideo.parentNode) {
    try { introVideo.pause(); } catch {}
    introVideo.remove();
  } else if (introVideo) {
    try { introVideo.remove(); } catch {}
  }
  const hint = document.getElementById("skipHint");
  if (hint && hint.parentNode) hint.remove();
  await initGame();
  initTouchControls();
  gameLoop();
}
// Expose globally for main.js fallback
if (typeof window !== "undefined") window.skipIntro = skipIntro;
function isF4(e) {
  return e.key === "F4" || e.code === "F4" || e.keyCode === 115 || e.which === 115;
}
function handleF4Skip(e) {
  if (!isF4(e)) return;
  if (e.target && (e.target.tagName === "INPUT" || e.target.tagName === "TEXTAREA" || e.target.isContentEditable)) return;
  // Prevent browser assigning any other function to F4 (e.g., Alt+F4, address bar, etc.)
  e.preventDefault();
  e.stopPropagation();
  if (e.stopImmediatePropagation) e.stopImmediatePropagation();
  console.log("[F4] skipIntro triggered, introFinished=", introFinished);
  skipIntro();
}
if (introVideo) {
  introVideo.play().catch(()=>{});
  introVideo.addEventListener("ended", () => {
    skipIntro();
  });
  // Robust listeners: capture phase on both window and document, plus keyup to fully block
  window.addEventListener("keydown", handleF4Skip, true);
  document.addEventListener("keydown", handleF4Skip, true);
  window.addEventListener("keyup", (e) => { if (isF4(e)) { e.preventDefault(); e.stopPropagation(); } }, true);
  document.addEventListener("keyup", (e) => { if (isF4(e)) { e.preventDefault(); e.stopPropagation(); } }, true);
  // Also block keypress
  window.addEventListener("keypress", (e) => { if (isF4(e)) { e.preventDefault(); e.stopPropagation(); } }, true);
} else {
  (async () => {
    await skipIntro();
  })();
  // Still register F4 handler even if no video (no-op but prevents default)
  window.addEventListener("keydown", handleF4Skip, true);
  document.addEventListener("keydown", handleF4Skip, true);
}
