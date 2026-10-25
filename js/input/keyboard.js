// ======================== KEYBOARD INPUT ========================
// Extracted from game.js:148-354, 52603-52710 - no logic changed
import { SETTINGS, KEY_NAMES, saveKeybinds, resetKeybindsStorage } from "./settings.js?v=57";
import { t } from "../ui/i18n.js?v=57";
import { act, actJust, actPrev, keys, mouseLeftDown, isAiming, isUiLocked } from "./inputState.js?v=57";
import { touchHold, touchEdge, touchJoyX, touchJoyY, touchAimAngle, shootTouchId, setTouchAimAngle } from "./touch.js?v=57";
import { CFG } from "../core/config.js?v=57";
import { G } from "../core/config.js?v=57";
import { gameState } from "../core/state.js?v=57";
import { player } from "../entities/player.js?v=57";
import { vehicles, isWalkable } from "../entities/vehicles.js?v=57";
import { currentMission } from "../missions/missionState.js?v=57";
import { failMission } from "../missions/missionSystem.js?v=57";
import { SHOPS, openShop } from "../ui/shop.js?v=57";
import { showNotification } from "../ui/hud.js?v=57";
import { fireWeapon } from "../combat/shooting.js?v=57";
import { getNearShopName } from "../ui/shop.js?v=57";
import { showPauseMenu } from "../ui/menu.js?v=57";
import { playEnterCar, playExitCar } from "../audio/sounds.js?v=57";
// Inventory moved to js/ui/inventory.js - re-export for compatibility (no logic change)
import { toggleInventory, closeInventory, switchWeapon, switchWeaponSlot, renderInventory } from "../ui/inventory.js?v=57";
export { toggleInventory, closeInventory, switchWeapon, switchWeaponSlot, renderInventory };

export function updateInput() {
  // Copy current to prev
  Object.assign(actPrev, act);

  // Reset frame-based actions (edge needs manual set)
  act.enterExit = false;
  act.shoot = false;
  act.melee = false;
  act.horn = false;
  act.cancelMission = false;
  act.pause = false;
  act.inventory = false;
  act.weaponNext = false;
  act.weaponSlot1 = false;
  act.weaponSlot2 = false;
  act.weaponSlot3 = false;
  act.weaponSlot4 = false;
  act.weaponSlot5 = false;

  // Keyboard
  const k = SETTINGS.keyboard;
  act.up = keys[k.up] || keys["arrowup"];
  act.down = keys[k.down] || keys["arrowdown"];
  act.left = keys[k.left] || keys["arrowleft"];
  act.right = keys[k.right] || keys["arrowright"];
  if (keys[k.enterExit]) act.enterExit = true;
  // Shooting now via left mouse button (space no longer fires)
  // Gated by isUiLocked(): clicking buttons inside an open interface (shop, chat,
  // inventory, pause...) is UI interaction, never a gunshot.
  if (mouseLeftDown && !isUiLocked()) act.shoot = true;
  // Melee: right mouse button when not aiming (or dedicated key)
  if (keys[k.melee] && !isUiLocked()) act.melee = true;
  if (keys[k.horn]) act.horn = true;
  if (keys[k.cancelMission]) act.cancelMission = true;
  if (keys[k.pause]) act.pause = true;
  if (keys[k.inventory]) act.inventory = true;
  if (keys[k.weaponNext]) act.weaponNext = true;
  if (keys[k.weaponSlot1]) act.weaponSlot1 = true;
  if (keys[k.weaponSlot2]) act.weaponSlot2 = true;
  if (keys[k.weaponSlot3]) act.weaponSlot3 = true;
  if (keys[k.weaponSlot4]) act.weaponSlot4 = true;
  if (keys[k.weaponSlot5]) act.weaponSlot5 = true;

  // Touch controls
  if (touchJoyX !== 0 || touchJoyY !== 0) {
    if (shootTouchId === null) {
      setTouchAimAngle(Math.atan2(touchJoyY, touchJoyX));
    }
    if (touchJoyX > 0) act.right = true;
    else if (touchJoyX < 0) act.left = true;
    if (touchJoyY > 0) act.down = true;
    else if (touchJoyY < 0) act.up = true;
  }
  for (const a of [
    "shoot",
    "enterExit",
    "horn",
    "cancelMission",
    "pause",
    "inventory",
    "weaponNext",
  ]) {
    if (touchHold[a]) act[a] = true;
    if (touchEdge[a]) {
      act[a] = true;
      touchEdge[a] = false;
    }
  }

  // Edge detection
  for (const a of [
    "enterExit",
    "shoot",
    "melee",
    "horn",
    "cancelMission",
    "pause",
    "inventory",
    "weaponNext",
    "weaponSlot1",
    "weaponSlot2",
    "weaponSlot3",
    "weaponSlot4",
    "weaponSlot5",
  ]) {
    actJust[a] = act[a] && !actPrev[a];
  }
}

export function actionHeld(name) {
  return act[name] || false;
}
export function actionJust(name) {
  return actJust[name] || false;
}

let activeRebind = null;

export function rebindKey(actionName) {
  const btn = document.querySelector(`[data-action="${actionName}"]`);
  if (!btn) return;
  // Cancel previous rebind if any
  if (activeRebind && activeRebind.handler) {
    const prev = activeRebind;
    document.removeEventListener("keydown", prev.handler, true);
    if (prev.btn) {
      prev.btn.textContent = keyDisplay(SETTINGS.keyboard[prev.action]);
      prev.btn.style.color = "";
      prev.btn.style.borderColor = "";
      prev.btn.classList.remove("rebinding");
    }
    activeRebind = null;
    // If clicking same button again, treat as cancel (toggle off)
    if (prev.btn === btn) return;
  }
  if (btn.classList.contains("rebinding")) {
    btn.textContent = keyDisplay(SETTINGS.keyboard[actionName]);
    btn.style.color = "";
    btn.style.borderColor = "";
    btn.classList.remove("rebinding");
    return;
  }

  btn.textContent = t("key.pressNew");
  btn.style.color = "#ffd700";
  btn.style.borderColor = "#ffd700";
  btn.classList.add("rebinding");

  const handler = (e) => {
    // Allow typing in inputs to not trigger rebinding? but we are in settings dialog, no input focused
    e.preventDefault();
    e.stopPropagation();
    if (e.stopImmediatePropagation) e.stopImmediatePropagation();

    let raw = e.key;
    // Ignore modifier-only presses
    if (raw === "Shift" || raw === "Control" || raw === "Alt" || raw === "Meta") return;
    let key = raw === " " ? " " : raw.toLowerCase();

    // ESC handling: for all actions except 'pause', ESC cancels. For 'pause', ESC is a valid assignment.
    if (key === "escape" && actionName !== "pause") {
      document.removeEventListener("keydown", handler, true);
      btn.textContent = keyDisplay(SETTINGS.keyboard[actionName]);
      btn.style.color = "";
      btn.style.borderColor = "";
      btn.classList.remove("rebinding");
      activeRebind = null;
      return;
    }

    // Normalize key: keep as lowercased
    // Check for duplicates — prevent saving duplicate
    const duplicateAction = Object.entries(SETTINGS.keyboard).find(([act, k]) => k === key && act !== actionName);
    if (duplicateAction) {
      try { showNotification(t("key.used", { action: duplicateAction[0] })); } catch {}
      btn.textContent = keyDisplay(SETTINGS.keyboard[actionName]);
      btn.style.color = "";
      btn.style.borderColor = "";
      btn.classList.remove("rebinding");
      activeRebind = null;
      document.removeEventListener("keydown", handler, true);
      return;
    }

    SETTINGS.keyboard[actionName] = key;
    try { saveKeybinds(); } catch {}
    document.removeEventListener("keydown", handler, true);
    btn.textContent = keyDisplay(key);
    btn.style.color = "";
    btn.style.borderColor = "";
    btn.classList.remove("rebinding");
    activeRebind = null;
  };

  activeRebind = { action: actionName, btn, handler };
  document.addEventListener("keydown", handler, true);
}

export function keyDisplay(key) {
  if (key === " ") return SETTINGS.language === "en" ? "␣ Space" : "␣ مسافة";
  return KEY_NAMES[key] || key.toUpperCase();
}

export function buildKeybindList() {
  const el = document.getElementById("keybindList");
  if (!el) return;
  const labels = {
    up: t("key.up"),
    down: t("key.down"),
    left: t("key.left"),
    right: t("key.right"),
    enterExit: t("key.enterExit"),
    shoot: t("key.shoot"),
    melee: t("key.melee"),
    horn: t("key.horn"),
    cancelMission: t("key.cancelMission"),
    pause: t("key.pause"),
    inventory: t("key.inventory"),
    weaponNext: t("key.weaponNext"),
  };
  el.innerHTML = "";
  for (const [action, label] of Object.entries(labels)) {
    const row = document.createElement("div");
    row.style.cssText =
      "display:flex;justify-content:space-between;align-items:center;padding:7px 0;border-bottom:1px solid rgba(255,255,255,0.06);gap:12px";
    const key = SETTINGS.keyboard[action];
    const labelSpan = document.createElement("span");
    labelSpan.style.cssText = "font-size:12px;color:#ccc;flex:1;text-align:right";
    labelSpan.textContent = label;

    const btn = document.createElement("button");
    btn.className = "menu-btn secondary";
    btn.dataset.action = action;
    btn.style.cssText = "padding:6px 14px;font-size:12px;min-width:88px;margin:0;justify-content:center;flex-shrink:0";
    // Shoot is now fixed to left mouse - not rebindable via keyboard
    if (action === "shoot") {
      btn.textContent = SETTINGS.language === "en" ? "Left Click" : "زر يسار";
      btn.disabled = true;
      btn.style.opacity = "0.7";
      btn.style.cursor = "default";
      btn.title = SETTINGS.language === "en" ? "Fixed to Left Mouse Button" : "ثابت على زر الفأرة الأيسر";
    } else {
      btn.textContent = keyDisplay(key);
      btn.addEventListener("click", () => rebindKey(action));
    }

    row.appendChild(labelSpan);
    row.appendChild(btn);
    el.appendChild(row);
  }
}

export function openSettings() {
  buildKeybindList();
  const dlg = document.getElementById("settingsDialog");
  if (dlg) dlg.style.display = "flex";
  try {
    const langSel = document.getElementById("langSelect");
    if (langSel) langSel.value = SETTINGS.language;
    const desc = document.getElementById("difficultyDesc");
    if (desc) desc.textContent = t(`diff.${SETTINGS.difficulty}.desc`);
    document.querySelectorAll(".diff-btn").forEach(b => b.classList.toggle("active", b.dataset.diff === SETTINGS.difficulty));
    // Reset to General tab on open for reorganized UX
    document.querySelectorAll(".settings-tab").forEach(b => {
      const isGeneral = b.dataset.tab === "general";
      b.classList.toggle("active", isGeneral);
      b.setAttribute("aria-selected", isGeneral ? "true" : "false");
    });
    document.querySelectorAll(".settings-panel").forEach(p => p.classList.remove("active"));
    const general = document.getElementById("settingsGeneral");
    if (general) general.classList.add("active");
    applyI18n();
  } catch {}
}

export function closeSettings() {
  // Cancel any active rebind
  if (activeRebind && activeRebind.handler) {
    document.removeEventListener("keydown", activeRebind.handler, true);
    if (activeRebind.btn) {
      activeRebind.btn.textContent = keyDisplay(SETTINGS.keyboard[activeRebind.action]);
      activeRebind.btn.style.color = "";
      activeRebind.btn.style.borderColor = "";
      activeRebind.btn.classList.remove("rebinding");
    }
    activeRebind = null;
  }
  const dlg = document.getElementById("settingsDialog");
  if (dlg) dlg.style.display = "none";
  if (gameState === G.PAUSED) showPauseMenu();
}

export function resetKeybinds() {
  const defs = {
    up: "w",
    down: "s",
    left: "a",
    right: "d",
    enterExit: "e",
    shoot: "mouseleft",
    melee: "f",
    horn: "g",
    cancelMission: "m",
    pause: "escape",
    inventory: "i",
    weaponNext: "q",
    weaponSlot1: "1",
    weaponSlot2: "2",
    weaponSlot3: "3",
    weaponSlot4: "4",
    weaponSlot5: "5",
  };
  Object.assign(SETTINGS.keyboard, defs);
  try { saveKeybinds(); } catch {}
  buildKeybindList();
  try { showNotification(t("notif.reset")); } catch {}
}

// Expose to window for legacy inline handlers and debugging (fixes Uncaught ReferenceError)
if (typeof window !== "undefined") {
  window.rebindKey = rebindKey;
  window.openSettings = openSettings;
  window.closeSettings = closeSettings;
  window.resetKeybinds = resetKeybinds;
  window.keyDisplay = keyDisplay;
  window.buildKeybindList = buildKeybindList;
}

let _lastEnterExitMs = 0;
export function handleEnterExit() {
  const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  if (now - _lastEnterExitMs < 600) return;
  _lastEnterExitMs = now;
  // Shop interaction takes priority
  const nearShopName = getNearShopName() || (typeof window !== 'undefined' ? window.nearShopName : null);
  if (!player.inVehicle && nearShopName && SHOPS[nearShopName]) {
    openShop(nearShopName);
    return;
  }
  if (player.inVehicle) {
    // Exit vehicle - find walkable offset
    const v = player.inVehicle;
    let nx = v.x + 30, ny = v.y + 30;
    try{
      let found=false;
      for(let i=0;i<8;i++){
        const tx = v.x + (Math.random()-0.5)*60;
        const ty = v.y + (Math.random()-0.5)*60;
        if(isWalkable(tx,ty)){ nx=tx; ny=ty; found=true; break; }
      }
      if(!found && !isWalkable(nx,ny)){ nx=v.x; ny=v.y; }
    }catch{ /* fallback keeps 30 offset */ }
    player.x = nx;
    player.y = ny;
    player.onFoot = true;
    player.speed = CFG.PLAYER_SPEED;
    v.driver = null;
    v.occupied = false;
    // Drop the AI's last velocity, otherwise the car ghosts away on its own.
    v.vx = 0;
    v.vy = 0;
    if (v.traffic) {
      v.traffic.speedNow = 0;
      v.traffic.state = "parked";
      v.traffic.parkAngle = v.angle;
      v.parked = true;
    }
    player.inVehicle = null;
    showNotification(t("notif.exitCar"));
    try { playExitCar(); } catch {}
  } else {
    // Enter nearest vehicle
    let closest = null;
    let closestDist = 80;
    for (const v of vehicles) {
      if (v.occupied) continue;
      if (v.hidden || v.exploding) continue;
      const dist = Math.hypot(player.x - v.x, player.y - v.y);
      if (dist < closestDist) {
        closestDist = dist;
        closest = v;
      }
    }
    if (closest) {
      player.inVehicle = closest;
      player.onFoot = false;
      player.speed = closest.speed;
      closest.driver = player;
      closest.occupied = true;
      // Hand the brain over: any parked/driver state is stale from now on.
      if (closest.traffic) {
        closest.traffic.speedNow = 0;
        closest.traffic.state = "parked";
        closest.traffic.parkAngle = closest.angle;
      }
      closest.parked = false;
      showNotification(t("notif.enterCar", { name: closest.type.name }));
      try { playEnterCar(); } catch {}
    }
  }
}

export function handleShoot() {
  if (!player.alive) return;
  fireWeapon();
}

export function handleHorn() {
  if (player.inVehicle) {
    showNotification(t("notif.horn"));
  }
}

export function cancelMission() {
  if (currentMission && !currentMission.completed) {
    failMission(t("notif.canceled"));
  }
}


