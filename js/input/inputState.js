// ======================== INPUT STATE ========================
// Extracted from game.js:122-147, 52586-52592, 52643-52645, 52712-52730 - no logic changed
import { canvas, W, H, zoom, cam, ZOOM_MIN, ZOOM_MAX, setZoom } from "../core/canvas.js?v=57";
import { G } from "../core/config.js?v=57";
import { gameState } from "../core/state.js?v=57";

// Overlays/interfaces that, while visible, must block gameplay mouse actions (firing).
// Clicking their buttons is UI interaction, NOT a gunshot.
const UI_BLOCK_IDS = [
  "shopDialog",
  "chatDialog",
  "meetingDialog",
  "questAcceptOverlay",
  "inventoryPanel",
  "mainMenu",
  "newGameDialog",
  "pauseMenu",
  "saveDialog",
  "loadDialog",
  "settingsDialog",
  "gameOverlay",
];

// True while any blocking interface is open (or game is not actively playing).
// Firing is disabled during these — pressing Close/Resume re-enables it.
export function isUiLocked() {
  if (gameState !== G.PLAYING) return true;
  const d = typeof document !== "undefined" ? document : null;
  if (!d || typeof d.getElementById !== "function") return false;
  for (let i = 0; i < UI_BLOCK_IDS.length; i++) {
    const el = d.getElementById(UI_BLOCK_IDS[i]);
    if (!el) continue;
    let visible = false;
    try {
      const cs = typeof getComputedStyle === "function" ? getComputedStyle(el) : null;
      if (cs) visible = cs.display !== "none";
      else visible = !!(el.style && el.style.display && el.style.display !== "none");
    } catch (e) {
      visible = !!(el.style && el.style.display && el.style.display !== "none");
    }
    if (visible) return true;
  }
  return false;
}

export const act = {
  up: false,
  down: false,
  left: false,
  right: false,
  enterExit: false,
  shoot: false,
  melee: false,
  horn: false,
  cancelMission: false,
  pause: false,
  inventory: false,
  weaponNext: false,
  weaponSlot1: false,
  weaponSlot2: false,
  weaponSlot3: false,
  weaponSlot4: false,
  weaponSlot5: false,
};
export const actJust = {
  ...act,
};
// edge-triggered (true only on press frame)
export const actPrev = {
  ...act,
};

export const keys = {};
document.addEventListener("keydown", (e) => {
  if(e.target && e.target.matches && e.target.matches('input,textarea,select,[contenteditable]')) return;
  keys[e.key.toLowerCase()] = true;
});
document.addEventListener("keyup", (e) => {
  if(e.target && e.target.matches && e.target.matches('input,textarea,select,[contenteditable]')) return;
  keys[e.key.toLowerCase()] = false;
});
export let worldMouseX = 0,
  worldMouseY = 0;

export let mouseX = 0,
  mouseY = 0;

export let mouseLeftDown = false;
export let mouseRightDown = false;
export let isAiming = false;

export function setWorldMouseX(v) { worldMouseX = v; }
export function setWorldMouseY(v) { worldMouseY = v; }
export function setMouseX(v) { mouseX = v; }
export function setMouseY(v) { mouseY = v; }
export function setMouseLeftDown(v) { mouseLeftDown = v; }
export function setMouseRightDown(v) { mouseRightDown = v; isAiming = v; }
export function setIsAiming(v) { isAiming = v; }

if(canvas){
canvas.addEventListener("mousemove", (e) => {
  const rect = canvas.getBoundingClientRect();
  mouseX = e.clientX - rect.left;
  mouseY = e.clientY - rect.top;
  worldMouseX = (mouseX - W / 2) / zoom + cam.x;
  worldMouseY = (mouseY - H / 2) / zoom + cam.y;
});

canvas.addEventListener("wheel", (e) => {
  e.preventDefault();
  const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoom - e.deltaY * 0.001));
  setZoom(newZoom);
}, { passive: false });

canvas.addEventListener("mousedown", (e) => {
  // Clicks never count as gameplay input while an interface is open
  if (isUiLocked()) return;
  if (e.button === 0) {
    mouseLeftDown = true;
    e.preventDefault();
  } else if (e.button === 2) {
    mouseRightDown = true;
    isAiming = true;
    e.preventDefault();
  }
});
canvas.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseLeftDown = false;
  else if (e.button === 2) {
    mouseRightDown = false;
    isAiming = false;
  }
});
canvas.addEventListener("mouseleave", () => {
  mouseRightDown = false;
  isAiming = false;
});
canvas.addEventListener("contextmenu", (e) => e.preventDefault());
}
window.addEventListener("mousedown", (e) => {
  // Clicks inside an open interface (shop/chat/meeting/pause/inventory/menu dialogs)
  // are UI interactions — NEVER a gunshot or an aim. Ignore them entirely.
  if (isUiLocked()) return;
  if(e.target && e.target.closest && e.target.closest('input,textarea,select,[contenteditable]')) return;
  if (e.button === 0) mouseLeftDown = true;
  else if (e.button === 2) {
    mouseRightDown = true;
    isAiming = true;
  }
});
// mouseup is NOT gated: always clear the pressed state so releasing a button
// (even over a dialog) can never leave a stuck "still firing" state behind.
window.addEventListener("mouseup", (e) => {
  if (e.button === 0) mouseLeftDown = false;
  else if (e.button === 2) {
    mouseRightDown = false;
    isAiming = false;
  }
});
window.addEventListener("blur", () => {
  mouseLeftDown = false;
  mouseRightDown = false;
  isAiming = false;
});

window.addEventListener("gamepadconnected", () => {
  // notification handled in hud
});
window.addEventListener("gamepaddisconnected", () => {});
