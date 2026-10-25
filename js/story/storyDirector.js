// ============================================================================
// STORY DIRECTOR — Street Game 2 : "The Ghost Ledger"
// Orchestrates the narrative: opening sequence, per-chapter title cards,
// quest intro/outro cutscenes, relationship + morality updates, and the
// three endings.
//
// Depends only on: story data/state, the cutscene UI, and small HUD helpers.
// ============================================================================

import { CHAPTERS, ENDINGS, CHARACTERS } from "./storyData.js?v=57";
import { MAIN_QUESTS, SIDE_QUESTS } from "./questDefs.js?v=57";
import { getQuestDef } from "./storyQuests.js?v=57";
import { resolveEchoes } from "./echoes.js?v=57";
import {
  getChapter, setChapter, advanceChapter, isLastChapter,
  addMorality, getMorality, addRelationship, setFlag, hasFlag, addPrice, addTruth, addFaction, addDecision,
  setEnding, getEnding, setStoryStarted, isStoryStarted, resetStory,
} from "./storyState.js?v=57";
import { playChapterIntro, playCutscene, playChoice, isCutsceneActive } from "../ui/cutscene.js?v=57";

/** Ids of the optional side contracts - these never trigger cutscenes. */
const SIDE_IDS = new Set(SIDE_QUESTS.map((q) => q.id));

let notify = () => {};

/** Allow the HUD to be injected (avoids a hard dependency cycle). */
export function setNotifier(fn) {
  if (typeof fn === "function") notify = fn;
}

function lang() {
  try {
    return (window.SETTINGS && window.SETTINGS.language === "en") ? "en" : "ar";
  } catch { return "ar"; }
}

function msg(ar, en) { return lang() === "en" ? en : ar; }

/** Queue a sequence, respecting an already-running one. */
function play(lines, onDone) {
  if (!Array.isArray(lines) || !lines.length) { if (onDone) onDone(); return; }
  playCutscene(lines, () => { if (onDone) onDone(); });
}

// ───────────────────────── opening ─────────────────────────
/**
 * Play the opening once. Called after a new game starts.
 */
export function playOpening() {
  if (isStoryStarted()) return false;
  setStoryStarted(true);
  const ch1 = CHAPTERS[0];
  // A short hook before the chapter card sets the scene.
  const hook = [
    { roleAr: "", roleEn: "",
      ar: "هذه المدينة لا تعترف بأحد. إلا بمن مستعد أن ينسى اسمه.",
      en: "This city recognises nobody. Except those ready to forget their own name." },
    { roleAr: "", roleEn: "",
      ar: "والآن تبدأ الحكاية من جديد.",
      en: "And now, the story begins again." },
  ];
  play(hook, () => {
    if (ch1) playChapterIntro(ch1);
  });
  return true;
}

// ───────────────────────── chapters ─────────────────────────
/**
 * Show the chapter card for a given chapter number.
 */
export function playChapter(n) {
  const ch = CHAPTERS.find((c) => c.n === n);
  if (!ch) return false;
  playChapterIntro(ch);
  return true;
}

/** Advance to the next chapter and play its opening. Returns the new number. */
export function goToNextChapter() {
  if (isLastChapter()) return getChapter();
  advanceChapter();
  try { resolveEchoes(getChapter()); } catch {}
  const n = getChapter();
  const ch = CHAPTERS.find((c) => c.n === n);
  if (ch) playChapterIntro(ch);
  return n;
}

// ───────────────────────── quest hooks ─────────────────────────
/**
 * Called when a quest is accepted. Plays the authored intro lines.
 * @param {string} questId
 * @param {{alreadyPlayed?:boolean}} [opts] alreadyPlayed - the accept screen
 *        already showed these lines as the quest's dialogue, so don't repeat.
 */
export function onQuestStarted(questId, opts = {}) {
  if (opts && opts.alreadyPlayed) return false;
  const def = getQuestDef(questId);
  if (!def) return false;
  // Side contracts are filler - no cutscene, keep the main-story pacing tight.
  if (SIDE_IDS.has(questId)) return false;
  const lines = def.intro || [];
  if (!lines.length) return false;
  play(lines);
  return true;
}

/**
 * Called when a quest completes. Applies story effects then plays the outro.
 * @returns {boolean} true if an outro was played.
 */
export function onQuestCompleted(questId, opts = {}) {
  const def = getQuestDef(questId);
  if (!def) return false;

  // 1. Morality
  if (typeof def.morality === "number") addMorality(def.morality);

  // 2. Relationships
  if (def.rel && typeof def.rel === "object") {
    for (const [who, delta] of Object.entries(def.rel)) {
      if (typeof delta === "number") addRelationship(who, delta);
    }
  }

  // 3. Story flag
  if (def.flag) setFlag(def.flag, true);

  // 4. Outro cutscene (main quests only)
  const lines = def.outro || [];
  if (!lines.length) return false;
  play(lines, () => {
    // Chapter transition happens after the final main quest of a chapter.
    maybeAdvanceChapter(def);
  });
  return true;
}

/** After a main quest completes, roll into the next chapter if one starts here. */
function maybeAdvanceChapter(def) {
  if (SIDE_IDS.has(def.id)) return;
  const nextDef = nextMainAfter(def);
  if (!nextDef) return;
  const sameChapter = (nextDef.chapter || 1) === (def.chapter || 1);
  if (!sameChapter) goToNextChapter();
}

/** The main quest that follows `def` in play order, or null if it was last. */
function nextMainAfter(def) {
  const sorted = [...MAIN_QUESTS].sort((a, b) => (a.order ?? 0) - (b.order ?? 0));
  const i = sorted.findIndex((q) => q.id === def.id);
  if (i < 0) return null;
  return sorted[i + 1] || null;
}

// ───────────────────────── endings ─────────────────────────
/**
 * Decide and play an ending.
 * Priority: explicit choice > story flags > morality fallback.
 */
export function playEnding(forced) {
  let id = forced;
  if (!id) {
    if (hasFlag("serpentDead")) id = "revenge";
    else if (hasFlag("serpentExiled")) id = "mercy";
    else if (hasFlag("joinedTG")) id = "deal";
    else id = getMorality() >= 60 ? "mercy" : "revenge";
  }
  const e = ENDINGS[id] || ENDINGS.mercy;
  setEnding(e.id);
  setFlag("endingReached", e.id);
  play(e.lines);
  return e.id;
}

/** The three options offered at the docks. */
const FINALE_OPTIONS = [
  { id: "revenge", color: "#ef4444", ar: "اقتل الأفعى. الآن.", en: "Kill The Serpent. Now." },
  { id: "mercy",  color: "#4ade80", ar: "اطرده من المدينة. حيّاً.", en: "Drive him out of the city. Alive." },
  { id: "deal",   color: "#a855f7", ar: "اتصل بحكيم. اعرض عليه الصفقة.", en: "Call Hakim. Offer him the deal." },
];

const FINALE_PROMPT = {
  promptAr: "الحاوية رقم سبعة. الأفعى أمامك. قاسم خلفك. سلمى تناديك. ماذا تفعل؟",
  promptEn: "Container seven. The Serpent is in front of you. Qasim is behind you. Salma is calling. What do you do?",
};

/** Called when the final main quest finishes. */
export function onFinale() {
  if (hasFlag("storyFinaleShown")) return;
  setFlag("storyFinaleShown", true);
  setTimeout(() => {
    try {
      playChoice(FINALE_PROMPT, FINALE_OPTIONS, (pick) => {
        const chosen = pick || "revenge";
        if (chosen === "revenge") setFlag("serpentDead", true);
        else if (chosen === "mercy") setFlag("serpentExiled", true);
        else setFlag("joinedTG", true);
        setTimeout(() => playEnding(chosen), 250);
      });
    } catch (e) {
      console.warn("[story] finale choice failed", e);
      playEnding();
    }
  }, 700);
}

// ───────────────────────── misc ─────────────────────────
/** Full reset for New Game. */
export function resetDirector() {
  resetStory();
}

/** Expose for debugging */
if (typeof window !== "undefined") {
  window.SG_Story = {
    playOpening, playChapter, goToNextChapter,
    onQuestStarted, onQuestCompleted, playEnding, onFinale,
    resetDirector, setNotifier,
  };
}