// ======================== INVENTORY ========================
// Extracted from game.js:52663-52711 - i18n integrated
import { WEAPONS } from "../core/config.js?v=57";
import { player } from "../entities/player.js?v=57";
import { invPanel, invWeaponsEl, invItemsEl } from "../core/domRefs.js?v=57";
import { updateHUD } from "./hud.js?v=57";
import { showNotification } from "./hud.js?v=57";
import { t, getWeaponName } from "./i18n.js?v=57";

export function toggleInventory() {
  if (!player || !invPanel) return;
  player.showInventory = !player.showInventory;
  invPanel.style.display = player.showInventory ? "block" : "none";
  if (player.showInventory) renderInventory();
}

export function closeInventory() {
  if (!player || !invPanel) return;
  player.showInventory = false;
  invPanel.style.display = "none";
}

export function switchWeapon(dir) {
  if (!player || !player.weapons.length) return;
  const len = player.weapons.length;
  player.currentWeapon = (((player.currentWeapon + dir) % len) + len) % len;
  updateHUD();
  showNotification(`🔫 ${getWeaponName(player.weapons[player.currentWeapon])}`);
}

export function switchWeaponSlot(idx) {
  if (!player || idx >= player.weapons.length) return;
  player.currentWeapon = idx;
  updateHUD();
  showNotification(`🔫 ${getWeaponName(player.weapons[idx])}`);
}

export function renderInventory() {
  if (!invWeaponsEl || !player) return;
  invWeaponsEl.innerHTML = "";
  player.weapons.forEach((wName, i) => {
    const w = WEAPONS[wName];
    const ammo = player.ammo[wName] || 0;
    const active = i === player.currentWeapon ? "active" : "";
    const div = document.createElement("div");
    div.className = `inv-slot ${active}`;
    const keySpan = document.createElement("span");
    keySpan.className = "key";
    keySpan.textContent = String(i+1);
    const nameSpan = document.createElement("span");
    nameSpan.className = "name";
    nameSpan.textContent = `${w.icon} ${getWeaponName(wName)}`;
    const ammoSpan = document.createElement("span");
    ammoSpan.className = "ammo";
    ammoSpan.textContent = `${ammo} ${t("inventory.bullets")}`;
    div.append(keySpan, nameSpan, ammoSpan);
    div.onclick = () => {
      switchWeaponSlot(i);
      renderInventory();
    };
    invWeaponsEl.appendChild(div);
  });
  invItemsEl.textContent = player.inventory.length
    ? player.inventory.map((it) => it.name || it).join(" • ")
    : t("inventory.empty");
}

