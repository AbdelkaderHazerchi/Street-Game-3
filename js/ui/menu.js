// ======================== MENU & SAVE ========================
// Extracted from game.js:54587-54847 - no logic changed
import { CFG, G, SAVE_KEY } from "../core/config.js?v=57";
import { gameState, setGameState, currentSaveName, setCurrentSaveName } from "../core/state.js?v=57";
import { player, createPlayer, setPlayer } from "../entities/player.js?v=57";
import { police, clearPolice } from "../entities/police.js?v=57";
import { currentMission, missionsCompleted, setMissionsCompleted, quests, questStatus, activeQuestId, mainQuestIndex, setQuestStatus, setActiveQuestId, setMainQuestIndex, setQuests, setMainQuests, setSideQuests } from "../missions/missionState.js?v=57";
import { startMission, generateMissions } from "../missions/missionSystem.js?v=57";
import { updateMissionUI } from "../missions/missionSystem.js?v=57";
import { updateWantedUI, updateHUD, showNotification } from "./hud.js?v=57";
import { overlay } from "../core/domRefs.js?v=57";
import { buildings } from "../map/mapState.js?v=57";
import { initMap } from "../map/mapGenerator.js?v=57";
import { loadFullMap } from "../map/mapUtils.js?v=57";
import { invalidateNavGrid } from "../ai/navGrid.js?v=57";
import { invalidateDensity } from "../ai/density.js?v=57";
import { cam } from "../core/canvas.js?v=57";
import { SETTINGS } from "../input/settings.js?v=57";
import { t } from "./i18n.js?v=57";
import { pauseCityMusic, playCityMusic, playMenuMusic, pauseMenuMusic, stopMenuMusic, stopMachineGunLoop, pauseDrivingSound } from "../audio/sounds.js?v=57";
import { initFullMap, destroyFullMap, refreshFullMap, centerOnPlayer as fullMapCenter } from "./fullMap.js?v=57";

function ensurePlayer() {
  // Check imported binding first, then window fallback, then create
  let p = player;
  if (!p && typeof window !== "undefined" && window.player) p = window.player;
  if (!p) {
    try {
      p = createPlayer();
      setPlayer(p);
      if (typeof window !== "undefined") window.player = p;
      console.warn("[menu] player was undefined, created new player", p);
    } catch (e) {
      console.error("[menu] failed to create player", e);
      return null;
    }
  } else {
    // Ensure live binding is set if we used window fallback
    try { if (player !== p) setPlayer(p); } catch {}
  }
  // Ensure map is initialized (prevents black screen)
  try {
    if (!buildings || buildings.length === 0) {
      console.warn("[menu] buildings empty, initializing map");
      Promise.resolve(initMap()).then(() => loadFullMap()).catch((e) => console.warn("[menu] map init failed", e));
    }
  } catch (e) {
    console.warn("[menu] map init failed", e);
  }
  // Ensure global
  if (typeof window !== "undefined") window.player = p;
  return p;
}
function getPlayerSafe() {
  let p = player;
  if (!p && typeof window !== "undefined" && window.player) p = window.player;
  if (!p) p = ensurePlayer();
  return p;
}

export function getSaves() {
  try {
    return JSON.parse(localStorage.getItem(SAVE_KEY)) || [];
  } catch (e) {
    return [];
  }
}

export function saveSaves(saves) {
  try {
    localStorage.setItem(SAVE_KEY, JSON.stringify(saves));
  } catch (e) {}
}

export function createSaveData(name) {
  const p = ensurePlayer();
  if (!p) {
    console.error("[createSaveData] player still undefined, cannot save");
    return {
      id: Date.now(),
      name: name,
      money: CFG.START_MONEY,
      x: 20 * CFG.TILE + CFG.TILE / 2,
      y: 20 * CFG.TILE + CFG.TILE / 2,
      health: CFG.MAX_HEALTH,
      wanted: 0,
      inVehicle: false,
      missionType: null,
      missionStage: 0,
      missionName: null,
      missionsCompleted: missionsCompleted,
      weapons: ["pistol"],
      currentWeapon: 0,
      ammo: { pistol: 30, smg: 0, rifle: 0, shotgun: 0 },
      color: "#3498db",
      skinColor: "#f5cba7",
      bankSafe: 0,
      bankLoans: [],
      bankShares: 0,
      bankInvested: 0,
      timestamp: Date.now(),
    };
  }
  const v = p.inVehicle;
  // Serialize quest state
  const qStatusObj = {};
  try { if(questStatus instanceof Map) questStatus.forEach((v,k)=> qStatusObj[k]=v); } catch {}
  return {
    id: Date.now(),
    name: name,
    money: p.money,
    x: p.x,
    y: p.y,
    health: p.health,
    wanted: p.wanted,
    inVehicle: !!v,
    missionType: currentMission ? currentMission.type : null,
    missionStage: currentMission ? currentMission.stage : 0,
    missionName: currentMission ? currentMission.name : null,
    // New quest persistence
    questId: currentMission ? (currentMission.questId || (currentMission.quest && currentMission.quest.id) || null) : null,
    activeQuestId: activeQuestId || null,
    mainQuestIndex: (typeof mainQuestIndex==="number" ? mainQuestIndex : 0),
    questStatus: qStatusObj,
    missionsCompleted: missionsCompleted,
    weapons: p.weapons,
    currentWeapon: p.currentWeapon,
    ammo: p.ammo,
    color: p.color,
    skinColor: p.skinColor,
    bankSafe: typeof p.bankSafe === "number" ? p.bankSafe : 0,
    bankLoans: Array.isArray(p.bankLoans) ? p.bankLoans : [],
    bankShares: typeof p.bankShares === "number" ? p.bankShares : 0,
    bankInvested: typeof p.bankInvested === "number" ? p.bankInvested : 0,
    story: serializeStory(),
    timestamp: Date.now(),
  };
}

export function applySaveData(data) {
  if (!data) return;
  const p = ensurePlayer();
  if (!p) {
    console.error("[applySaveData] player still undefined, cannot apply save");
    return;
  }
  p.x = data.x;
  p.y = data.y;
  p.money = data.money || CFG.START_MONEY;
  p.health = data.health || CFG.MAX_HEALTH;
  p.wanted = data.wanted || 0;
  setMissionsCompleted(data.missionsCompleted || 0);
  if (data.weapons) p.weapons = data.weapons;
  if (data.currentWeapon !== undefined) p.currentWeapon = data.currentWeapon;
  if (data.ammo) p.ammo = data.ammo;
  if (data.color) p.color = data.color;
  if (data.skinColor) p.skinColor = data.skinColor;
  if (!p.weapons || !p.weapons.length) p.weapons = ["pistol"];
  if (p.currentWeapon === undefined) p.currentWeapon = 0;
  if (!p.ammo) p.ammo = { pistol: 30, smg: 0, rifle: 0, shotgun: 0 };
  // Supervised bank state (defaults keep old saves playable)
  if (typeof p.bankSafe !== "number") p.bankSafe = typeof data.bankSafe === "number" ? data.bankSafe : 0;
  else if (typeof data.bankSafe === "number") p.bankSafe = data.bankSafe;
  p.bankLoans = Array.isArray(data.bankLoans)
    ? data.bankLoans.filter((l) => l && typeof l.amount === "number" && typeof l.dueAt === "number")
    : (Array.isArray(p.bankLoans) ? p.bankLoans : []);
  if (typeof data.bankShares === "number") p.bankShares = data.bankShares;
  else if (typeof p.bankShares !== "number") p.bankShares = 0;
  if (typeof data.bankInvested === "number") p.bankInvested = data.bankInvested;
  else if (typeof p.bankInvested !== "number") p.bankInvested = 0;
  // Story state (chapter / relationships / morality / flags / ending)
  try {
    if (data.story) deserializeStory(data.story);
    else deserializeStory(null); // old pre-story save -> fresh story defaults
  } catch (e) { console.warn("[load] story restore failed", e); }
  // Restore quest system if present — regenerate then apply status
  try{
    if(data.questStatus || data.activeQuestId || typeof data.mainQuestIndex==="number"){
      // Ensure quests are generated (if not already)
      if(!quests || quests.length===0){
        try { generateMissions(); } catch(e){ console.warn("generateMissions in load failed", e); }
      }
      // Restore status map
      const newMap = new Map();
      if(data.questStatus && typeof data.questStatus==="object"){
        Object.entries(data.questStatus).forEach(([k,v])=> newMap.set(k, v));
      } else if(questStatus instanceof Map){
        questStatus.forEach((v,k)=> newMap.set(k,v));
      }
      setQuestStatus(newMap);
      if(typeof data.mainQuestIndex==="number") setMainQuestIndex(data.mainQuestIndex);
      if(data.activeQuestId) setActiveQuestId(data.activeQuestId);
      // If save had active quest, try to restart it
      if(data.questId){
        // Prefer questId
        startMission(data.questId);
      } else if(data.missionType){
        startMission(data.missionType);
      }
      if (currentMission && typeof data.missionStage==="number") currentMission.stage = data.missionStage || 0;
    } else if (data.missionType) {
      startMission(data.missionType);
      if (currentMission) currentMission.stage = data.missionStage || 0;
    }
  } catch(e){ console.warn("quest restore failed", e);
    if (data.missionType) {
      try{ startMission(data.missionType); if (currentMission) currentMission.stage = data.missionStage || 0; } catch{}
    }
  }
  updateWantedUI();
  updateHUD();
  updateMissionUI();
  p.alive = true;
  clearPolice();
  // Ensure camera follows loaded player
  try {
    cam.x = p.x;
    cam.y = p.y;
  } catch (e) { console.warn("cam update failed", e); }
}

export function saveGame(slotName) {
  const saves = getSaves();
  const existing = saves.findIndex((s) => s.name === slotName);
  const data = createSaveData(slotName);
  if (existing >= 0) saves[existing] = data;
  else saves.push(data);
  saveSaves(saves);
  showNotification(t("save.saved", { name: slotName }));
}

export function loadLatestSave() {
  const saves = getSaves();
  if (saves.length === 0) return false;
  saves.sort((a, b) => b.timestamp - a.timestamp);
  applySaveData(saves[0]);
  return true;
}

export function loadSaveById(id) {
  const saves = getSaves();
  const save = saves.find((s) => s.id === id);
  if (save) {
    applySaveData(save);
    return true;
  }
  return false;
}

export function deleteSave(id) {
  let saves = getSaves();
  saves = saves.filter((s) => s.id !== id);
  saveSaves(saves);
}

export async function startNewGame(name) {
  if (!name) {
    const locale = SETTINGS.language === "en" ? "en" : "ar";
    name = (SETTINGS.language === "en" ? "Save " : "حفظ ") + new Date().toLocaleDateString(locale);
  }
  setCurrentSaveName(name);
  // Stop menu music when game starts
  try { stopMenuMusic(); } catch {}
  // Ensure map is ready before player
  try {
    if (!buildings || buildings.length === 0) {
      await initMap();
      loadFullMap();
      // Drop the derived AI nav layer so it rebuilds against the new map.
      try { invalidateNavGrid(); } catch (e) { /* optional */ }
      // And the population density field, which is built from the same map's
      // district list.
      try { invalidateDensity(); } catch (e) { /* optional */ }
      console.log("[startNewGame] map initialized");
    }
  } catch (e) { console.warn("[startNewGame] map init failed", e); }
  // Ensure player exists and reset to fresh via setPlayer (new object, live binding)
  // createPlayer now internally resolves spawn via mapState (validated)
  let fresh = createPlayer();
  setPlayer(fresh);
  if (typeof window !== "undefined") window.player = fresh;
  let p = fresh;
  clearPolice();
  setMissionsCompleted(0);
  // Reset the whole story (chapter, relationships, morality, flags)
  try { resetDirector(); } catch (e) { console.warn("[startNewGame] story reset failed", e); }
  // Reset quest system to initial (first main available, all sides available)
  try{
    // Regenerate from current map data to ensure fresh questStatus
    generateMissions();
  } catch(e){ console.warn("generateMissions in startNewGame failed", e); }
  // Reset camera to player immediately (avoid cam at 0,0)
  try {
    cam.x = p.x;
    cam.y = p.y;
  } catch (e) { console.warn("cam reset failed", e); }
  updateWantedUI();
  updateHUD();
  updateMissionUI();
  // Save fresh game state
  try {
    if (p && p.alive) {
      saveGame(name);
    }
  } catch (e) {
    console.warn("[startNewGame] save failed", e);
  }
  // Reset UI hidden state when starting new game
  const gc = document.getElementById("gameContainer");
  if (gc) gc.classList.remove("ui-hidden");
  document.body.classList.remove("ui-hidden");
  document.documentElement.classList.remove("ui-hidden");
  if (typeof window !== "undefined" && window.resetUIHidden) window.resetUIHidden();
  setGameState(G.PLAYING);
  // Play the opening sequence for the six-chapter story.
  try {
    if (window.SG_StoryUI && window.SG_StoryUI.playOpening) {
      setTimeout(() => { try { window.SG_StoryUI.playOpening(); } catch (e) { console.warn("[startNewGame] opening failed", e); } }, 350);
    }
  } catch (e) { console.warn("[startNewGame] opening hook failed", e); }
  document.getElementById("mainMenu").style.display = "none";
  document.getElementById("newGameDialog").style.display = "none";
  document.getElementById("pauseMenu").style.display = "none";
  document.getElementById("saveDialog").style.display = "none";
  document.getElementById("loadDialog").style.display = "none";
  overlay.style.display = "none";
  // Ensure render will have valid player; if map not initialized, warn
  try {
    const cam = document.getElementById("gameCanvas");
    if (cam) console.log("[startNewGame] new game started at", p.x, p.y);
  } catch {}
}

let _pauseTabsBound = false;

function updatePauseStats() {
  try {
    const p = getPlayerSafe();
    const moneyEl = document.getElementById("pauseMoneyStat");
    const healthEl = document.getElementById("pauseHealthStat");
    const wantedEl2 = document.getElementById("pauseWantedStat");
    if (moneyEl && p) moneyEl.textContent = `💰 $${p.money ?? 0}`;
    if (healthEl && p) {
      const pct = p.maxHealth ? Math.round((p.health / p.maxHealth) * 100) : 0;
      healthEl.textContent = `❤️ ${pct}%`;
    }
    if (wantedEl2 && p) {
      const stars = Array.from({length:5}, (_,i)=> i < (p.wanted||0) ? "★" : "☆").join("");
      wantedEl2.textContent = `⭐ ${stars}`;
    }
  } catch {}
}

export function switchPauseTab(tab) {
  const menuPanel = document.getElementById("pauseMenuPanel");
  const mapPanel = document.getElementById("pauseMapPanel");
  const tabMenu = document.getElementById("pauseTabMenu");
  const tabMap = document.getElementById("pauseTabMap");
  const tabJournal = document.getElementById("pauseTabJournal");
  const journalPanel = document.getElementById("pauseJournalPanel");
  if (!menuPanel || !mapPanel || !tabMenu || !tabMap) return;
  const isMap = tab === "map";
  const isJournal = tab === "journal";
  tabMenu.classList.toggle("active", !isMap && !isJournal);
  tabMenu.setAttribute("aria-selected", String(!isMap && !isJournal));
  tabMap.classList.toggle("active", isMap);
  tabMap.setAttribute("aria-selected", String(isMap));
  if (tabJournal) {
    tabJournal.classList.toggle("active", isJournal);
    tabJournal.setAttribute("aria-selected", String(isJournal));
  }
  menuPanel.classList.toggle("active", !isMap && !isJournal);
  mapPanel.classList.toggle("active", isMap);
  if (journalPanel) journalPanel.classList.toggle("active", isJournal);
  if (isMap) {
    try {
      const ok = initFullMap();
      // Ensure canvas is sized after panel becomes visible
      requestAnimationFrame(() => {
        try { refreshFullMap(); } catch {}
        try { fullMapCenter(false); } catch {}
        // second frame for layout settle
        requestAnimationFrame(() => { try { refreshFullMap(); } catch {} });
      });
    } catch (e) { console.warn("[pause] initFullMap failed", e); }
  } else {
    try { destroyFullMap(); } catch {}
  }
  if (isJournal) {
    try {
      if (window.SG_Journal && window.SG_Journal.renderJournal) window.SG_Journal.renderJournal();
    } catch (e) { console.warn("[pause] renderJournal failed", e); }
  }
}

function ensurePauseTabs() {
  if (_pauseTabsBound) return;
  const tabMenu = document.getElementById("pauseTabMenu");
  const tabMap = document.getElementById("pauseTabMap");
  if (!tabMenu || !tabMap) return;
  _pauseTabsBound = true;
  tabMenu.addEventListener("click", () => switchPauseTab("menu"));
  tabMap.addEventListener("click", () => switchPauseTab("map"));
  const tabJournal = document.getElementById("pauseTabJournal");
  if (tabJournal) tabJournal.addEventListener("click", () => switchPauseTab("journal"));
  // Keyboard Tab to cycle when pause is open
  document.addEventListener("keydown", (e) => {
    const pm = document.getElementById("pauseMenu");
    if (!pm || pm.style.display !== "flex") return;
    if (e.key === "Tab") {
      e.preventDefault();
      const isMap = document.getElementById("pauseMapPanel")?.classList.contains("active");
      const isJournal = document.getElementById("pauseJournalPanel")?.classList.contains("active");
      const hasJournal = !!document.getElementById("pauseJournalPanel");
      if (!isMap && !isJournal) switchPauseTab("map");
      else if (isMap) switchPauseTab(hasJournal ? "journal" : "menu");
      else switchPauseTab("map");
    }
  });
}

export function showPauseMenu() {
  const pm = document.getElementById("pauseMenu");
  if (pm) pm.style.display = "flex";
  try { pauseCityMusic(); } catch {}
  try { pauseMenuMusic(); } catch {}
  try { pauseDrivingSound(); } catch {}
  try { stopMachineGunLoop(); } catch {}
  try { ensurePauseTabs(); } catch {}
  try { updatePauseStats(); } catch {}
  // Default to menu tab on open, clean map state
  try { switchPauseTab("menu"); } catch {}
}

export function hidePauseMenu() {
  try { destroyFullMap(); } catch {}
  const pm = document.getElementById("pauseMenu");
  if (pm) pm.style.display = "none";
  try { if (gameState === G.PLAYING) playCityMusic(); } catch {}
  try { stopMenuMusic(); } catch {}
}

export function showMainMenu() {
  setGameState(G.MENU);
  try { pauseCityMusic(); } catch {}
  try { pauseDrivingSound(); } catch {}
  try { stopMachineGunLoop(); } catch {}
  try { playMenuMusic(); } catch {}
  const gc = document.getElementById("gameContainer");
  if (gc) gc.classList.remove("ui-hidden");
  document.body.classList.remove("ui-hidden");
  document.documentElement.classList.remove("ui-hidden");
  if (typeof window !== "undefined" && window.resetUIHidden) window.resetUIHidden();
  document.getElementById("mainMenu").style.display = "flex";
  document.getElementById("pauseMenu").style.display = "none";
  document.getElementById("saveDialog").style.display = "none";
  document.getElementById("loadDialog").style.display = "none";
  document.getElementById("newGameDialog").style.display = "none";
  overlay.style.display = "none";
}

export function populateSaveSlots(containerId, mode) {
  const container = document.getElementById(containerId);
  const saves = getSaves();
  container.innerHTML = "";
  if (saves.length === 0) {
    container.innerHTML =
      `<div style="color:#666;padding:20px;text-align:center">${t("save.noSaves")}</div>`;
    return;
  }
  saves.sort((a, b) => b.timestamp - a.timestamp);
  const locale = SETTINGS.language === "en" ? "en" : "ar";
  for (const s of saves) {
    const div = document.createElement("div");
    div.className = "save-slot";
    const date = new Date(s.timestamp);
    const dateStr =
      date.toLocaleDateString(locale) +
      " " +
      date.toLocaleTimeString(locale, {
        hour: "2-digit",
        minute: "2-digit",
      });
    const noMission = t("hud.noMission").replace("🎯 ","");
    // Build DOM safely with textContent to avoid XSS from save names
    const infoWrap = document.createElement("div");
    const nameDiv = document.createElement("div");
    nameDiv.className = "name";
    nameDiv.textContent = s.name;
    const infoDiv = document.createElement("div");
    infoDiv.className = "info";
    infoDiv.textContent = `💰 $${s.money} | ${dateStr} | ${s.missionName || noMission}`;
    infoWrap.appendChild(nameDiv);
    infoWrap.appendChild(infoDiv);
    div.appendChild(infoWrap);
    if(mode === "load"){
      const arrow = document.createElement("span");
      arrow.style.color = "#888";
      arrow.textContent = "▶";
      div.appendChild(arrow);
    }
    if (mode === "load") {
      div.onclick = () => {
        if (loadSaveById(s.id)) {
          try { stopMenuMusic(); } catch {}
          const gc = document.getElementById("gameContainer");
          if (gc) gc.classList.remove("ui-hidden");
          document.body.classList.remove("ui-hidden");
          document.documentElement.classList.remove("ui-hidden");
          if (typeof window !== "undefined" && window.resetUIHidden) window.resetUIHidden();
          setGameState(G.PLAYING);
          document.getElementById("loadDialog").style.display = "none";
          document.getElementById("mainMenu").style.display = "none";
          overlay.style.display = "none";
          showNotification(t("load.loaded", { name: s.name }));
        }
      };
    } else if (mode === "save") {
      div.onclick = () => {
        saveGame(s.name);
        document.getElementById("saveDialog").style.display = "none";
        hidePauseMenu();
        setGameState(G.PLAYING);
      };
    }
    // Delete button
    const delBtn = document.createElement("button");
    delBtn.className = "delete-btn";
    delBtn.textContent = "🗑";
    delBtn.onclick = (e) => {
      e.stopPropagation();
      deleteSave(s.id);
      populateSaveSlots(containerId, mode);
    };
    div.appendChild(delBtn);
    container.appendChild(div);
  }
}


import { serializeStory, deserializeStory } from "../story/storyState.js?v=57";
import { resetDirector } from "../story/storyDirector.js?v=57";

// Menu button wiring moved to js/main.js (barrel) - no logic change
