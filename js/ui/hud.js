// ======================== HUD ========================
// Extracted from game.js:52742-52749, 53772-53800 - i18n integrated
import { CFG, WEAPONS } from "../core/config.js?v=57";
import { healthFill, moneySpan, ammoSpan, wantedEl, notifEl, weaponNameEl, ammoMaxEl } from "../core/domRefs.js?v=57";
import { player } from "../entities/player.js?v=57";
import { cam, W, H, zoom } from "../core/canvas.js?v=57";
import { worldMouseX, worldMouseY, mouseX, mouseY, setWorldMouseX, setWorldMouseY } from "../input/inputState.js?v=57";
import { t, getWeaponName } from "./i18n.js?v=57";

export function updateCamera() {
  if (!player) return;
  const target = player.inVehicle || player;
  if (!target || target.x === undefined) return;
  cam.x = target.x;
  cam.y = target.y;
  setWorldMouseX((mouseX - W / 2) / zoom + cam.x);
  setWorldMouseY((mouseY - H / 2) / zoom + cam.y);
}

export function updateHUD() {
  if (!player) return;
  const pct = Math.max(0, (player.health / player.maxHealth) * 100);
  if (healthFill) {
    healthFill.style.width = pct + "%";
    // low-health neon pulse — keeps pct width logic intact, only adds visual state
    try {
      if (pct <= 28) healthFill.classList.add("low");
      else healthFill.classList.remove("low");
    } catch {}
  }
  if (moneySpan) moneySpan.textContent = player.money;
  if (player.weapons && player.weapons.length) {
    const wName = player.weapons[player.currentWeapon];
    const w = WEAPONS[wName];
    if (w && weaponNameEl) weaponNameEl.textContent = w.icon + " " + getWeaponName(wName);
    const curAmmo = (player.ammo && typeof player.ammo === "object" && !Array.isArray(player.ammo)) ? (player.ammo[wName] ?? 0) : (player.ammo ?? 0);
    if (ammoSpan) ammoSpan.textContent = String(curAmmo);
    if (ammoMaxEl) {
      let total = null;
      if (player.totalAmmo !== undefined) {
        total = (typeof player.totalAmmo === "object" && player.totalAmmo !== null && !Array.isArray(player.totalAmmo)) ? player.totalAmmo[wName] : player.totalAmmo;
      } else if (w && w.maxAmmo !== undefined) {
        total = w.maxAmmo;
      }
      if (total === Infinity || total === null || total === undefined || total === "∞") ammoMaxEl.textContent = "∞";
      else ammoMaxEl.textContent = String(total);
    }
  }
  updateInventory();
}

export function updateInventory() {
  if (!player) return;
  // Find existing HUD inventory panel or create it dynamically (id "inventory-panel")
  let panel = document.getElementById("inventory-panel");
  // If only the centered modal panel exists (inventoryPanel), create a separate HUD panel instead of hijacking it
  const centerPanel = document.getElementById("inventoryPanel");
  if (!panel) {
    // create HUD panel
    panel = document.createElement("div");
    panel.id = "inventory-panel";
    panel.style.position = "fixed";
    panel.style.bottom = "12px";
    panel.style.left = "12px";
    panel.style.background = "rgba(10,10,18,0.75)";
    panel.style.border = "1px solid rgba(255,255,255,0.08)";
    panel.style.borderRadius = "12px";
    panel.style.padding = "8px 10px";
    panel.style.zIndex = "12";
    panel.style.backdropFilter = "blur(8px)";
    panel.style.display = "flex";
    panel.style.gap = "6px";
    panel.style.flexWrap = "wrap";
    panel.style.maxWidth = "320px";
    panel.style.pointerEvents = "none";
    panel.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";
    document.body.appendChild(panel);
  }
  panel.innerHTML = "";
  // Title label
  const title = document.createElement("div");
  title.textContent = "🎒";
  title.style.fontSize = "11px";
  title.style.color = "rgba(255,255,255,0.6)";
  title.style.marginRight = "2px";
  title.style.alignSelf = "center";
  panel.appendChild(title);
  player.weapons.forEach((wId, idx) => {
    const w = WEAPONS[wId];
    const item = document.createElement("div");
    item.textContent = (w ? w.icon + " " : "") + getWeaponName(wId);
    item.style.fontSize = "11px";
    item.style.fontWeight = "700";
    item.style.padding = "4px 8px";
    item.style.borderRadius = "6px";
    item.style.border = "1px solid rgba(255,255,255,0.08)";
    item.style.background = idx === player.currentWeapon ? "rgba(255,215,0,0.15)" : "rgba(255,255,255,0.04)";
    item.style.color = idx === player.currentWeapon ? "#ffd700" : "#fff";
    if (idx === player.currentWeapon) {
      item.style.borderColor = "rgba(255,215,0,0.35)";
      item.style.boxShadow = "0 0 8px rgba(255,215,0,0.15) inset";
    }
    panel.appendChild(item);
  });
}

export function updateWantedUI() {
  if (!player) {
    if (wantedEl) wantedEl.innerHTML = "";
    return;
  }
  let html = "";
  for (let i = 0; i < 5; i++) {
    html += `<span class="wantedStar ${i < player.wanted ? "active" : ""}">★</span>`;
  }
  if (wantedEl) wantedEl.innerHTML = html;
}

let _notifTimer = null;
export function showNotification(msg) {
  if(!notifEl) return;
  notifEl.textContent = msg;
  // modern toast: keep opacity mechanism for backwards compat, also toggle .visible for slide/fade
  try { notifEl.classList.add("visible"); } catch {}
  notifEl.style.opacity = "1";
  if(_notifTimer) clearTimeout(_notifTimer);
  _notifTimer = setTimeout(() => {
    try { if(notifEl) notifEl.classList.remove("visible"); } catch {}
    if(notifEl) notifEl.style.opacity = "0";
    _notifTimer = null;
  }, 2000);
}

export function updateSuspicionUI(suspicion, dist, minD, maxD, theftHold, theftDuration){
  const container = document.getElementById("suspicionContainer");
  const fill = document.getElementById("suspicionFill");
  const val = document.getElementById("suspicionValue");
  const theftEl = document.getElementById("theftProgress");
  if(!container || !fill) return;
  // Show container if suspicion relevant or theft progress
  const showSuspicion = typeof suspicion==="number" && suspicion>0.5;
  const showTheft = typeof theftHold==="number" && typeof theftDuration==="number" && theftDuration>0;
  if(showSuspicion || showTheft){
    container.style.display = "block";
  } else {
    // Hide if no active suspicion and no theft in progress (but keep visible if theftHold>0)
    if((!showTheft || theftHold===0) && suspicion<1){
      container.style.display = "none";
      return;
    }
    if(suspicion<1 && !showTheft) { container.style.display="none"; return; }
    container.style.display="block";
  }
  if(typeof suspicion==="number"){
    const pct = Math.max(0, Math.min(100, suspicion));
    fill.style.width = pct + "%";
    if(val) val.textContent = Math.round(pct) + "%";
    if(pct>80) fill.style.background = "linear-gradient(90deg, #ff3366, #ff0000)";
    else if(pct>50) fill.style.background = "linear-gradient(90deg, #ffaa00, #ff3366)";
    else fill.style.background = "linear-gradient(90deg, #ffcc00, #ff8800)";
  }
  if(theftEl){
    if(showTheft){
      theftEl.style.display = "block";
      const sec = (theftHold/1000).toFixed(1);
      const total = (theftDuration/1000).toFixed(0);
      theftEl.textContent = `Hold Space: ${sec} / ${total}s` + (typeof dist==="number" ? ` | Dist: ${Math.round(dist)}` : "");
      // Also update suspicion label
      const label = document.getElementById("suspicionLabel");
      if(label) label.textContent = "🦹 Theft Progress";
    } else {
      theftEl.style.display = "none";
      const label = document.getElementById("suspicionLabel");
      if(label) label.textContent = "👁️ Suspicion";
    }
  }
}

export function hideSuspicionUI(){
  const c=document.getElementById("suspicionContainer");
  if(c) c.style.display="none";
}
