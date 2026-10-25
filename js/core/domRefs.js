// ======================== DOM REFS ========================
// Extracted from game.js:451-468 - made resilient to early import
export let healthFill = typeof document !== 'undefined' ? document.getElementById("healthFill") : null;
export let moneySpan = typeof document !== 'undefined' ? document.getElementById("moneyAmount") : null;
export let ammoSpan = typeof document !== 'undefined' ? document.getElementById("ammoAmount") : null;
export let wantedEl = typeof document !== 'undefined' ? document.getElementById("wantedDisplay") : null;
export let missionTitle = typeof document !== 'undefined' ? document.getElementById("missionTitle") : null;
export let missionDesc = typeof document !== 'undefined' ? document.getElementById("missionDesc") : null;
export let missionProg = typeof document !== 'undefined' ? document.getElementById("missionProgress") : null;
export let overlay = typeof document !== 'undefined' ? document.getElementById("gameOverlay") : null;
export let overlayTitle = typeof document !== 'undefined' ? document.getElementById("overlayTitle") : null;
export let overlayMsg = typeof document !== 'undefined' ? document.getElementById("overlayMsg") : null;
export let overlayBtn = typeof document !== 'undefined' ? document.getElementById("overlayBtn") : null;
export let notifEl = typeof document !== 'undefined' ? document.getElementById("notification") : null;
export let weaponNameEl = typeof document !== 'undefined' ? document.getElementById("weaponName") : null;
export let ammoMaxEl = typeof document !== 'undefined' ? document.getElementById("ammoMax") : null;
export let invPanel = typeof document !== 'undefined' ? document.getElementById("inventoryPanel") : null;
export let invWeaponsEl = typeof document !== 'undefined' ? document.getElementById("invWeapons") : null;
export let invItemsEl = typeof document !== 'undefined' ? document.getElementById("invItems") : null;
export function refreshDomRefs(){
  try{
    healthFill = document.getElementById("healthFill");
    moneySpan = document.getElementById("moneyAmount");
    ammoSpan = document.getElementById("ammoAmount");
    wantedEl = document.getElementById("wantedDisplay");
    missionTitle = document.getElementById("missionTitle");
    missionDesc = document.getElementById("missionDesc");
    missionProg = document.getElementById("missionProgress");
    overlay = document.getElementById("gameOverlay");
    overlayTitle = document.getElementById("overlayTitle");
    overlayMsg = document.getElementById("overlayMsg");
    overlayBtn = document.getElementById("overlayBtn");
    notifEl = document.getElementById("notification");
    weaponNameEl = document.getElementById("weaponName");
    ammoMaxEl = document.getElementById("ammoMax");
    invPanel = document.getElementById("inventoryPanel");
    invWeaponsEl = document.getElementById("invWeapons");
    invItemsEl = document.getElementById("invItems");
  }catch{}
}
if(typeof document !== 'undefined'){
  if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', refreshDomRefs);
  else refreshDomRefs();
}
