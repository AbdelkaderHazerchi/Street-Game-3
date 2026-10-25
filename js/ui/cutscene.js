// ============================================================================
// CUTSCENE ENGINE — Street Game 2 : "The Ghost Ledger"
// Plays scripted dialogue sequences and chapter title cards over a dark
// overlay. Used for: chapter openings, quest intros, quest outros, endings.
//
// Behaviour
//   * Freezes gameplay input while active (the caller checks isCutsceneActive).
//   * E / Space / click  ->  reveal the current line, then advance.
//   * Hold-to-skip: press and hold S to skip the whole sequence.
//   * ESC closes the sequence (treated as "done") so the player is never stuck.
//   * Fully bilingual and re-renders when the language changes.
// ============================================================================

import { SETTINGS } from "../input/settings.js?v=57";
import { CHARACTERS } from "../story/storyData.js?v=57";

function lang() { return (SETTINGS && SETTINGS.language === "en") ? "en" : "ar"; }

let root = null;          // #cutsceneOverlay
let boxEl = null;         // #cutsceneBox
let titleEl = null;       // #cutsceneTitle
let chapterEl = null;     // #cutsceneChapter
let speakerEl = null;     // #cutsceneSpeaker
let textEl = null;        // #cutsceneText
const hintEl = () => document.getElementById("cutsceneHint");

// active sequence state
let active = false;
let lines = [];
let index = 0;
let onDone = null;
let typing = false;
let typeTimer = null;
let shownChars = 0;
let fullText = "";
let cardMode = false;     // rendering a chapter title card instead of dialogue
let skipHoldTimer = null;
let holdStart = 0;
let bound = false;
let choiceMode = false;
let choiceOptions = [];
let choicePick = null;
let choicePromptText = null;

const TYPE_SPEED_MS = 18;   // ms per character
const CARD_MS = 2600;       // auto-advance for a chapter card

function setVisible(v) {
  if (root) root.style.display = v ? "flex" : "none";
  try {
    document.body.classList.toggle("story-cutscene-active", !!v);
  } catch {}
}

function ensureDom() {
  if (root && root.isConnected) return true;
  root = document.getElementById("cutsceneOverlay");
  if (!root) {
    root = document.createElement("div");
    root.id = "cutsceneOverlay";
    root.className = "cutscene-overlay";
    root.innerHTML =
      '<div class="cutscene-inner">' +
        '<div class="cutscene-card" id="cutsceneCard">' +
          '<div class="cutscene-chapter" id="cutsceneChapter"></div>' +
          '<div class="cutscene-title" id="cutsceneTitle"></div>' +
        '</div>' +
        '<div class="cutscene-box" id="cutsceneBox">' +
          '<div class="cutscene-speaker" id="cutsceneSpeaker"></div>' +
          '<div class="cutscene-text" id="cutsceneText"></div>' +
        '</div>' +
        '<div class="cutscene-hint" id="cutsceneHint"></div>' +
      '</div>';
    document.body.appendChild(root);
  }
  boxEl = document.getElementById("cutsceneBox");
  titleEl = document.getElementById("cutsceneTitle");
  chapterEl = document.getElementById("cutsceneChapter");
  speakerEl = document.getElementById("cutsceneSpeaker");
  textEl = document.getElementById("cutsceneText");
  bindEvents();
  return true;
}

function bindEvents() {
  if (bound) return;
  bound = true;
  // Click anywhere on the overlay to advance.
  root.addEventListener("click", () => { advance(); });
  // Keys are handled on window so they work even without canvas focus.
  window.addEventListener("keydown", onKeyDown, true);
  window.addEventListener("keyup", onKeyUp, true);
}

function onKeyDown(e) {
  if (!active) return;
  const k = (e.key || "").toLowerCase();
  // A visible choice list owns the keyboard while it is up.
  if (choiceMode) {
    if (k === "escape") {
      // Do not commit the first (most violent) option on ESC.
      e.preventDefault(); e.stopPropagation();
      return;
    }
    if (k === "1" || k === "2" || k === "3") {
      e.preventDefault(); e.stopPropagation();
      const idx = Number(k) - 1;
      if (choiceOptions[idx]) pickChoice(choiceOptions[idx].id);
      return;
    }
    return;
  }
  // Hold S to skip the whole sequence.
  if (k === "s") {
    if (!holdStart) holdStart = Date.now();
    const held = Date.now() - holdStart;
    if (held > 900) { e.preventDefault(); e.stopPropagation(); finish(true); return; }
  }
  if (k === "enter" || k === " " || k === "e" || e.code === "Space" || e.code === "Enter") {
    e.preventDefault();
    e.stopPropagation();
    if (typing) { revealAll(); }
    else { advance(); }
    return;
  }
  if (k === "escape") {
    e.preventDefault();
    e.stopPropagation();
    finish(false);
  }
}

function onKeyUp(e) {
  const k = (e.key || "").toLowerCase();
  if (k === "s") holdStart = 0;
  if (skipHoldTimer) { clearTimeout(skipHoldTimer); skipHoldTimer = null; }
}

function setHint(text) {
  const el = hintEl();
  if (el) el.textContent = text || "";
}

function hintText() {
  const l = lang();
  return l === "en"
    ? "E / SPACE — continue     •     hold S — skip"
    : "E / مسافة — متابعة     •     اضغط مطولاً على S — تخطي";
}

/** Render the chapter title card. */
function renderCard() {
  cardMode = true;
  if (boxEl) boxEl.style.display = "none";
  if (chapterEl && titleEl) {
    const c = chapterEl.parentElement;
    if (c) c.style.display = "block";
  }
  const l = lang();
  const cur = lines[index] || {};
  if (chapterEl) chapterEl.textContent = cur.chapterLabel || (l === "en" ? "CHAPTER" : "فصل");
  if (titleEl) titleEl.textContent = l === "en" ? (cur.titleEn || "") : (cur.titleAr || "");
  setHint(hintText());
  // auto advance card
  skipHoldTimer = setTimeout(() => { if (active && cardMode) advance(); }, CARD_MS);
}

/** Render one dialogue line, with a typewriter reveal. */
function renderLine() {
  cardMode = false;
  if (boxEl) boxEl.style.display = "block";
  const c = chapterEl ? chapterEl.parentElement : null;
  if (c) c.style.display = "none";

  const l = lang();
  const cur = lines[index] || {};

  // Resolve speaker name from CHARACTERS when only a key is given.
  let speaker = l === "en" ? (cur.roleEn || "") : (cur.roleAr || "");
  const key = cur.roleKey || cur.role || "";
  if (!speaker && key && CHARACTERS[key]) {
    speaker = l === "en" ? CHARACTERS[key].name.en : CHARACTERS[key].name.ar;
  }
  let color = null;
  if (key && CHARACTERS[key]) color = CHARACTERS[key].color;
  if (cur.color) color = cur.color;

  if (speakerEl) {
    speakerEl.textContent = speaker || "";
    speakerEl.style.color = color || "#ffd700";
    speakerEl.style.display = speaker ? "block" : "none";
  }

  fullText = l === "en" ? String(cur.en || cur.ar || "") : String(cur.ar || cur.en || "");
  shownChars = 0;
  typing = true;
  if (textEl) textEl.textContent = "";

  if (typeTimer) clearInterval(typeTimer);
  typeTimer = setInterval(() => {
    shownChars++;
    if (textEl) textEl.textContent = fullText.slice(0, shownChars);
    if (shownChars >= fullText.length) {
      clearInterval(typeTimer);
      typeTimer = null;
      typing = false;
      setHint(hintText());
    }
  }, TYPE_SPEED_MS);

  // progress dots
  setHint(
    lines.length > 1
      ? `${index + 1} / ${lines.length}   •   ${hintText()}`
      : hintText()
  );
}

function revealAll() {
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
  typing = false;
  shownChars = fullText.length;
  if (textEl) textEl.textContent = fullText;
  setHint(hintText());
}

/** Advance to the next line, or finish the sequence. */
function advance() {
  if (!active) return;
  if (typing) { revealAll(); return; }
  if (cardMode) {
    if (skipHoldTimer) { clearTimeout(skipHoldTimer); skipHoldTimer = null; }
    index++;
    if (index >= lines.length) { finish(false); return; }
    renderCard();
    return;
  }
  index++;
  if (index >= lines.length) { finish(false); return; }
  renderLine();
}

/** Close the sequence and fire the callback. */
function finish(skipped) {
  if (!active) return;
  active = false;
  cardMode = false;
  if (typeTimer) { clearInterval(typeTimer); typeTimer = null; }
  if (skipHoldTimer) { clearTimeout(skipHoldTimer); skipHoldTimer = null; }
  holdStart = 0;
  const lineCount = lines.length;
  setVisible(false);
  const cb = onDone;
  onDone = null;
  lines = [];
  index = 0;
  if (typeof cb === "function") {
    try { cb({ skipped: !!skipped, lines: lineCount }); } catch (e) { console.warn("[cutscene] callback failed", e); }
  }
}

// ───────────────────────────── public API ─────────────────────────────
export function isCutsceneActive() { return active; }

/**
 * Build and show a numbered choice list inside the overlay.
 * Picked with 1/2/3 or by clicking a button.
 */
export function playChoice(prompt, options, onPick) {
  const opts = (Array.isArray(options) ? options : []).filter(Boolean);
  if (!opts.length) { if (onPick) onPick(null); return false; }
  if (!ensureDom()) { if (onPick) onPick(opts[0].id); return false; }
  if (active && !choiceMode) finish(true);

  const l = lang();
  choiceMode = true;
  choiceOptions = opts;
  choicePick = onPick || null;
  choicePromptText = prompt || null;

  if (boxEl) boxEl.style.display = "none";
  const card = chapterEl ? chapterEl.parentElement : null;
  if (card) card.style.display = "none";
  const hint = hintEl();
  if (hint) hint.textContent = "";

  let wrap = document.getElementById("cutsceneChoice");
  if (!wrap) {
    wrap = document.createElement("div");
    wrap.id = "cutsceneChoice";
    wrap.className = "cutscene-choice";
    const inner = root ? root.querySelector(".cutscene-inner") : null;
    (inner || root).appendChild(wrap);
  }
  wrap.innerHTML = "";
  wrap.style.display = "flex";

  const q = document.createElement("div");
  q.className = "cutscene-choice-q";
  q.textContent = l === "en" ? (prompt?.promptEn || "") : (prompt?.promptAr || "");
  wrap.appendChild(q);

  opts.forEach((opt, i) => {
    const b = document.createElement("button");
    b.className = "cutscene-choice-b";
    b.type = "button";
    const num = document.createElement("span");
    num.className = "cutscene-choice-n";
    num.textContent = String(i + 1);
    const txt = document.createElement("span");
    txt.className = "cutscene-choice-t";
    txt.textContent = l === "en" ? (opt.en || opt.ar || "") : (opt.ar || opt.en || "");
    b.appendChild(num);
    b.appendChild(txt);
    if (opt.color) { b.style.borderColor = opt.color; num.style.background = opt.color; }
    b.addEventListener("click", (ev) => { ev.stopPropagation(); pickChoice(opt.id); });
    wrap.appendChild(b);
  });

  setVisible(true);
  active = true;
  return true;
}

function pickChoice(id) {
  const cb = choicePick;
  choicePick = null;
  choiceMode = false;
  choiceOptions = [];
  choicePromptText = null;
  const wrap = document.getElementById("cutsceneChoice");
  if (wrap) { wrap.style.display = "none"; wrap.innerHTML = ""; }
  setVisible(false);
  active = false;
  if (typeof cb === "function") { try { cb(id); } catch (e) { console.warn("[cutscene] choice cb failed", e); } }
}

/** Re-render choice labels when the language changes mid-prompt. */
function refreshChoiceLabels() {
  if (!choiceMode || !choiceOptions.length) return;
  const l = lang();
  const wrap = document.getElementById("cutsceneChoice");
  if (!wrap) return;
  const q = wrap.querySelector(".cutscene-choice-q");
  if (q && choicePromptText) q.textContent = l === "en" ? choicePromptText.promptEn : choicePromptText.promptAr;
  const ts = Array.from(wrap.querySelectorAll(".cutscene-choice-t"));
  choiceOptions.forEach((opt, i) => {
    if (ts[i]) ts[i].textContent = l === "en" ? (opt.en || opt.ar || "") : (opt.ar || opt.en || "");
  });
}

/**
 * Play a chapter title card.
 * @param {{chapterLabel?:string, titleAr?:string, titleEn?:string}} card
 */
export function playChapterCard(card, onComplete) {
  if (!card || !ensureDom()) { if (onComplete) onComplete(); return false; }
  if (active) finish(true);
  lines = [{
    chapterLabel: card.chapterLabel || (lang() === "en" ? "CHAPTER" : "فصل"),
    titleAr: card.titleAr || "", titleEn: card.titleEn || "",
  }];
  index = 0;
  onDone = onComplete || null;
  active = true;
  setVisible(true);
  renderCard();
  return true;
}

/**
 * Play a dialogue sequence.
 * @param {Array<{roleAr?,roleEn?,roleKey?,ar?,en?}>} seq
 */
export function playCutscene(seq, onComplete) {
  const clean = (Array.isArray(seq) ? seq : [])
    .filter((m) => m && typeof m === "object" && (m.ar || m.en));
  if (!clean.length) { if (onComplete) onComplete({ skipped: false, lines: 0 }); return false; }
  if (!ensureDom()) { if (onComplete) onComplete({ skipped: false, lines: 0 }); return false; }
  if (active) finish(true);
  lines = clean;
  index = 0;
  onDone = onComplete || null;
  active = true;
  setVisible(true);
  renderLine();
  return true;
}

/** Play a chapter intro: card, then its dialogue. */
export function playChapterIntro(chapter, onComplete) {
  if (!chapter) { if (onComplete) onComplete(); return false; }
  const card = {
    chapterLabel: (lang() === "en" ? "CHAPTER " : "الفصل ") + chapter.n,
    titleAr: chapter.title ? chapter.title.ar : "",
    titleEn: chapter.title ? chapter.title.en : "",
  };
  const lines = chapter.intro || [];
  if (!ensureDom()) { if (onComplete) onComplete(); return false; }
  // Card first, then the chapter's dialogue.
  return playChapterCard(card, () => {
    playCutscene(lines, () => { if (onComplete) onComplete(); });
  });
}

// Language switch mid-cutscene: re-render the current line.
if (typeof window !== "undefined") {
  window.addEventListener("languageChanged", () => {
    if (choiceMode) { refreshChoiceLabels(); return; }
    if (!active) return;
    if (cardMode) {
      if (skipHoldTimer) { clearTimeout(skipHoldTimer); skipHoldTimer = null; }
      renderCard();
    } else {
      renderLine();
    }
  });
}

if (typeof window !== "undefined") {
  window.SG_Cutscene = { playCutscene, playChapterCard, playChapterIntro, playChoice, isCutsceneActive, finish };
}