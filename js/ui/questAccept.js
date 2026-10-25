// ============================================================================
// QUEST ACCEPT SCREEN — Street Game 2
// Shown the moment the player accepts a quest (press E next to its marker):
//
//   1. the quest image fills the whole screen,
//   2. the quest intro dialogue types out in the dialogue section at the bottom,
//   3. once the last line is dismissed the image fades away and the quest is
//      officially received (onDone fires and the mission actually starts).
//
// Like the cutscene engine it freezes the world while it is up - the caller
// checks isQuestAcceptActive() and routes the continue key here.
// E / Space / click -> reveal the current line, then advance.
// ESC -> skip the rest of the dialogue (the quest is still received).
// ============================================================================

import { SETTINGS } from "../input/settings.js?v=57";
import { placeholderQuestArt } from "../assets/questImages.js?v=57";

function lang() { return (SETTINGS && SETTINGS.language === "en") ? "en" : "ar"; }

const TYPE_SPEED_MS = 18;   // ms per character
const EXIT_MS = 340;        // fade-out before the quest is handed over

// cached DOM
let root = null;
let imageEl = null;
let categoryEl = null;
let titleEl = null;
let rewardEl = null;
let frameEl = null;
let speakerEl = null;
let messageEl = null;
let progressEl = null;
let hintEl = null;

// sequence state
let active = false;
let data = null;
let lines = [];
let index = 0;
let typing = false;
let typeTimer = null;
let shownChars = 0;
let fullText = "";
let leaving = false;
let leaveTimer = null;
let onDone = null;
let bound = false;

function hintText() {
  const l = lang();
  if (!lines.length) return l === "en" ? "E / SPACE — receive the quest" : "E / مسافة — استلم المهمة";
  return l === "en"
    ? "E / SPACE — continue     •     ESC — skip"
    : "E / مسافة — متابعة     •     ESC — تخطي";
}

function cacheDom() {
  if (root && root.isConnected) return true;
  root = document.getElementById("questAcceptOverlay");
  if (!root) return false;
  imageEl = document.getElementById("questAcceptImage");
  categoryEl = document.getElementById("questAcceptCategory");
  titleEl = document.getElementById("questAcceptTitle");
  rewardEl = document.getElementById("questAcceptReward");
  frameEl = document.getElementById("questAcceptFrame");
  speakerEl = document.getElementById("questAcceptSpeaker");
  messageEl = document.getElementById("questAcceptMessage");
  progressEl = document.getElementById("questAcceptProgress");
  hintEl = document.getElementById("questAcceptHint");
  bindEvents();
  return true;
}

function bindEvents() {
  if (bound || !root) return;
  bound = true;
  // Clicking anywhere advances, same as the cutscene overlay.
  root.addEventListener("click", () => { if (active) advanceQuestAccept(); });
}

function setVisible(v) {
  if (root) root.style.display = v ? "flex" : "none";
  try { document.body.classList.toggle("story-cutscene-active", !!v); } catch {}
}

/** Normalise one dialogue entry to the {ar,en,roleAr,roleEn} shape. */
function normLine(m) {
  if (!m) return null;
  if (typeof m === "string") return { ar: m, en: m, roleAr: "", roleEn: "" };
  if (typeof m !== "object") return null;
  return {
    ar: String(m.ar || m.text || "").trim(),
    en: String(m.en || m.text || "").trim(),
    roleAr: String(m.roleAr || m.speakerAr || m.role || "").trim(),
    roleEn: String(m.roleEn || m.speakerEn || m.role || "").trim(),
  };
}

function renderHeader() {
  const d = data || {};
  const l = lang();
  if (titleEl) titleEl.textContent = d.title || "";
  if (categoryEl) {
    const isSide = d.category === "side";
    categoryEl.textContent = l === "en"
      ? (isSide ? "Side Quest" : "Main Quest")
      : (isSide ? "مهمة جانبية" : "مهمة رئيسية");
    categoryEl.classList.toggle("is-side", isSide);
    categoryEl.classList.toggle("is-main", !isSide);
  }
  if (rewardEl) {
    const r = typeof d.reward === "number" ? d.reward : 0;
    rewardEl.textContent = r > 0 ? (l === "en" ? `Reward $${r}` : `المكافأة $${r}`) : "";
    rewardEl.style.display = r > 0 ? "" : "none";
  }
}

function setImage(src, isPlaceholder) {
  if (!imageEl) return;
  imageEl.onerror = isPlaceholder ? null : function () {
    // Real art missing -> fall back to the generated plate, once.
    imageEl.onerror = null;
    imageEl.src = placeholderQuestArt({ id: data ? data.id : "quest", icon: data ? data.icon : "⭐" });
  };
  imageEl.src = src || placeholderQuestArt({ id: data ? data.id : "quest", icon: data ? data.icon : "⭐" });
}

/** Render one dialogue line with a typewriter reveal. */
function renderLine() {
  const l = lang();
  const cur = lines[index] || {};
  const role = l === "en" ? (cur.roleEn || cur.roleAr || "") : (cur.roleAr || cur.roleEn || "");
  if (speakerEl) speakerEl.textContent = role;
  if (progressEl) progressEl.textContent = lines.length > 1 ? `${index + 1} / ${lines.length}` : "";
  if (hintEl) {
    hintEl.textContent = lines.length > 1
      ? (l === "en"
          ? `${index + 1} / ${lines.length}   •   ${hintText()}`
          : `${index + 1} / ${lines.length}   •   ${hintText()}`)
      : hintText();
  }

  fullText = l === "en" ? String(cur.en || cur.ar || "") : String(cur.ar || cur.en || "");
  shownChars = 0;
  typing = true;
  if (messageEl) messageEl.textContent = "";

  if (typeTimer) clearInterval(typeTimer);
  typeTimer = setInterval(() => {
    shownChars++;
    if (messageEl) messageEl.textContent = fullText.slice(0, shownChars);
    if (shownChars >= fullText.length) {
      clearInterval(typeTimer);
      typeTimer = null;
      typing = false;
      if (hintEl) hintEl.textContent = hintText();
    }
  }, TYPE_SPEED_MS);
}

function revealAll() {
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
  typing = false;
  shownChars = fullText.length;
  if (messageEl) messageEl.textContent = fullText;
  if (hintEl) hintEl.textContent = hintText();
}

/** Fade the image out, then hand the quest over. */
function beginExit() {
  if (leaving) return;
  leaving = true;
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
  typing = false;
  if (messageEl) messageEl.textContent = "";
  if (root) root.classList.add("is-leaving");
  leaveTimer = setTimeout(() => { leaveTimer = null; finish(); }, EXIT_MS);
}

function finish() {
  if (!active) return;
  active = false;
  leaving = false;
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
  if (leaveTimer) { clearTimeout(leaveTimer); leaveTimer = null; }
  if (root) root.classList.remove("is-leaving");
  setVisible(false);
  const cb = onDone;
  onDone = null;
  data = null;
  lines = [];
  index = 0;
  if (typeof cb === "function") {
    try { cb(); } catch (e) { console.warn("[questAccept] callback failed", e); }
  }
}

// ───────────────────────────── public API ─────────────────────────────

/** True while the accept screen is on screen (the world is frozen). */
export function isQuestAcceptActive() { return active; }

/** The payload currently on screen (null when closed). */
export function getQuestAcceptData() { return data; }

/**
 * Show the accept screen.
 * @param {{id?:string,icon?:string,title?:string,category?:string,reward?:number,
 *          art?:{src:string,placeholder:boolean},lines?:Array}} payload
 * @param {Function} done fired once the image is gone (quest officially received)
 */
export function showQuestAccept(payload, done) {
  if (!cacheDom()) { if (done) done(); return false; }
  if (active) finish();               // never stack two screens
  data = payload || {};
  lines = (Array.isArray(data.lines) ? data.lines : []).map(normLine).filter((m) => m && (m.ar || m.en));
  index = 0;
  leaving = false;
  onDone = done || null;

  renderHeader();
  const art = data.art || {};
  setImage(art.src, art.placeholder);
  if (speakerEl) speakerEl.textContent = "";
  if (progressEl) progressEl.textContent = "";
  if (messageEl) messageEl.textContent = "";
  if (frameEl) frameEl.style.display = "flex";
  if (root) root.classList.remove("is-leaving");

  setVisible(true);
  active = true;
  if (lines.length) renderLine();
  else if (hintEl) hintEl.textContent = hintText();
  return true;
}

/** Reveal / advance the dialogue. Called on E, Space or click. */
export function advanceQuestAccept() {
  if (!active || leaving) return false;
  if (typing) { revealAll(); return true; }
  if (!lines.length) { beginExit(); return true; }
  index++;
  if (index >= lines.length) { beginExit(); return true; }
  renderLine();
  return true;
}

/** Skip the remaining dialogue: the image still fades, the quest is received. */
export function closeQuestAccept() {
  if (!active) return false;
  beginExit();
  return true;
}

if (typeof window !== "undefined") {
  // Re-render the header / current line when the language is switched mid-screen.
  window.addEventListener("languageChanged", () => {
    if (!active) return;
    renderHeader();
    if (lines.length && !typing && !leaving) {
      const cur = lines[index] || {};
      const l = lang();
      const role = l === "en" ? (cur.roleEn || cur.roleAr || "") : (cur.roleAr || cur.roleEn || "");
      if (speakerEl) speakerEl.textContent = role;
      fullText = l === "en" ? String(cur.en || cur.ar || "") : String(cur.ar || cur.en || "");
      revealAll();
    } else if (!lines.length && hintEl) {
      hintEl.textContent = hintText();
    }
  });
  window.SG_QuestAccept = {
    showQuestAccept, advanceQuestAccept, closeQuestAccept,
    isQuestAcceptActive, getQuestAcceptData,
  };
}
