// ======================== INPUT SETTINGS ========================
// Extracted from game.js:67-121 - gamepad removed per SG2 requirements

export const SETTINGS = {
  keyboard: {
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
  },
  language: "ar",
  difficulty: "medium",
};

const STORAGE_KEY = "sg_keybinds_v1";
const LANG_KEY = "sg_lang_v1";
const DIFF_KEY = "sg_difficulty_v1";
const SETTINGS_KEY = "sg_settings_v1";
try {
  const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
  if (saved && typeof saved === "object") {
    for (const k of Object.keys(SETTINGS.keyboard)) {
      if (typeof saved[k] === "string" && saved[k].length > 0) SETTINGS.keyboard[k] = saved[k].toLowerCase();
    }
    // Migration: old saves used space for shoot, now left mouse
    if (saved.shoot === " " || saved.shoot === "space") SETTINGS.keyboard.shoot = "mouseleft";
  }
} catch {}
// Ensure shoot is mouseleft if still space (first run or corrupted)
if (SETTINGS.keyboard.shoot === " " || SETTINGS.keyboard.shoot === "space") SETTINGS.keyboard.shoot = "mouseleft";
try {
  const lang = localStorage.getItem(LANG_KEY);
  if (lang === "ar" || lang === "en") SETTINGS.language = lang;
  else {
    // migrate from unified store if exists
    const uni = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (uni && (uni.language === "ar" || uni.language === "en")) SETTINGS.language = uni.language;
  }
} catch {}
try {
  const diff = localStorage.getItem(DIFF_KEY);
  if (["easy","medium","hard"].includes(diff)) SETTINGS.difficulty = diff;
  else {
    const uni = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "null");
    if (uni && ["easy","medium","hard"].includes(uni.difficulty)) SETTINGS.difficulty = uni.difficulty;
  }
} catch {}

export function saveKeybinds() {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(SETTINGS.keyboard));
  } catch {}
}

export function resetKeybindsStorage() {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch {}
}

export function saveLanguage() {
  try { localStorage.setItem(LANG_KEY, SETTINGS.language); } catch {}
}
export function saveDifficulty() {
  try { localStorage.setItem(DIFF_KEY, SETTINGS.difficulty); } catch {}
}
export function saveSettings() {
  try {
    saveKeybinds();
    saveLanguage();
    saveDifficulty();
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ language: SETTINGS.language, difficulty: SETTINGS.difficulty }));
  } catch {}
}
export function setLanguage(lang) {
  if (lang !== "ar" && lang !== "en") return;
  SETTINGS.language = lang;
  saveLanguage();
  saveSettings();
  // dispatch event for listeners
  try { window.dispatchEvent(new CustomEvent("languageChanged", { detail: lang })); } catch {}
  try { document.dispatchEvent(new CustomEvent("languageChanged", { detail: lang })); } catch {}
}
export function setDifficulty(diff) {
  if (!["easy","medium","hard"].includes(diff)) return;
  SETTINGS.difficulty = diff;
  saveDifficulty();
  saveSettings();
  try { window.dispatchEvent(new CustomEvent("difficultyChanged", { detail: diff })); } catch {}
  try { document.dispatchEvent(new CustomEvent("difficultyChanged", { detail: diff })); } catch {}
}

export const KEY_NAMES = {
  arrowup: "↑",
  arrowdown: "↓",
  arrowleft: "←",
  arrowright: "→",
  " ": "␣",
  mouseleft: "LMB",
  mouseright: "RMB",
  escape: "ESC",
  enter: "Enter",
  tab: "Tab",
  shift: "Shift",
  control: "Ctrl",
  alt: "Alt",
  backspace: "⌫",
  delete: "Del",
  1: "1",
  2: "2",
  3: "3",
  4: "4",
  5: "5",
};

// Action state (updated each frame from keyboard + gamepad)
