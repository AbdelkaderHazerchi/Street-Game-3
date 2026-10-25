// ============================================================================
// STORY STATE — Street Game 2 : "The Ghost Ledger"
// Tracks everything the narrative needs between missions: current chapter,
// relationship scores with each character, morality, and story flags.
// Kept dependency-free so any module can import it without cycles.
// ============================================================================

import { STORY, RELATION_KEYS } from "./storyData.js?v=57";

/** Neutral starting value for every relationship. */
export const REL_BASE = 50;

/** Morality anchors. */
export const MORALITY_MIN = 0;
export const MORALITY_MAX = 100;

let chapter = 1;                 // current chapter number (1..6)
let morality = MORALITY_MAX;     // starts clean, degrades with violence
let relationships = {};          // charId -> 0..100
let flags = {};                  // story flags set by quest completion
let price = 0;                   // 0..100 blood/harm axis
let truth = [];                  // evidence pieces
let faction = { alras: 0, serpent: 0, law: 0, tg: 0 }; // -100..100
let decisions = [];              // recorded decisions
let echoesResolved = [];         // consumed echo ids
let ending = null;               // chosen ending id, or null
let storyStarted = false;        // has the opening cutscene played?

function defaultRelations() {
  const r = {};
  for (const k of RELATION_KEYS) r[k] = REL_BASE;
  return r;
}
relationships = defaultRelations();

// ───────────────────────────── accessors ─────────────────────────────
export function getChapter() { return chapter; }
export function setChapter(v) {
  const n = Number(v);
  chapter = Number.isFinite(n) && n >= 1 ? Math.min(STORY.totalChapters, Math.floor(n)) : 1;
}
export function advanceChapter() {
  if (chapter < STORY.totalChapters) { chapter++; return true; }
  return false;
}
export function isLastChapter() { return chapter >= STORY.totalChapters; }

export function getMorality() { return morality; }
export function addMorality(delta) {
  if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) return morality;
  morality = Math.max(MORALITY_MIN, Math.min(MORALITY_MAX, morality + delta));
  return morality;
}

export function getRelationship(id) {
  return Object.prototype.hasOwnProperty.call(relationships, id) ? relationships[id] : REL_BASE;
}
export function addRelationship(id, delta) {
  if (!id || typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) return getRelationship(id);
  const base = getRelationship(id);
  relationships[id] = Math.max(0, Math.min(100, base + delta));
  return relationships[id];
}
export function getRelationships() { return { ...relationships }; }

export function setFlag(key, value = true) {
  if (!key) return;
  flags[key] = value;
}
export function hasFlag(key) { return !!flags[key]; }
export function getFlags() { return { ...flags }; }

// Price axis
export function getPrice() { return price; }
export function addPrice(delta) {
  if (typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) return price;
  price = Math.max(0, Math.min(100, price + delta));
  return price;
}
export function setPrice(v) { if (Number.isFinite(v)) price = Math.max(0, Math.min(100, v)); return price; }

// Truth axis
export function getTruth() { return [...truth]; }
export function hasTruth(item) { return truth.includes(item); }
export function addTruth(item) { if (item && !truth.includes(item)) truth.push(item); return [...truth]; }
export function setTruth(arr) { truth = Array.isArray(arr) ? [...arr] : truth; return [...truth]; }

// Faction/loyalty axis
export function getFaction(id) { return Object.prototype.hasOwnProperty.call(faction, id) ? faction[id] : 0; }
export function addFaction(id, delta) {
  if (!id || typeof delta !== "number" || !Number.isFinite(delta) || delta === 0) return getFaction(id);
  if (!Object.prototype.hasOwnProperty.call(faction, id)) faction[id] = 0;
  faction[id] = Math.max(-100, Math.min(100, faction[id] + delta));
  return faction[id];
}
export function getFactions() { return { ...faction }; }
export function setFactions(obj) { if (obj && typeof obj === "object") for (const k of Object.keys(faction)) if (Number.isFinite(obj[k])) faction[k]=obj[k]; return { ...faction }; }

// Decisions ledger
export function getDecisions() { return decisions.map(d => ({ ...d })); }
export function addDecision(d) {
  if (!d || !d.id) return decisions.length;
  const rec = { id: d.id, chapter: d.chapter ?? chapter, questId: d.questId || null, choice: d.choice || null, at: d.at || Date.now(), text: d.text || null, who: d.who || null, knows: d.knows || null };
  decisions.push(rec);
  return decisions.length;
}
export function hasDecision(id) { return decisions.some(d => d.id === id); }

// Echoes
export function getEchoesResolved() { return [...echoesResolved]; }
export function markEchoResolved(id) { if (id && !echoesResolved.includes(id)) echoesResolved.push(id); }
export function isEchoResolved(id) { return echoesResolved.includes(id); }

export function getEnding() { return ending; }
export function setEnding(id) { ending = id || null; }

export function isStoryStarted() { return storyStarted; }
export function setStoryStarted(v) { storyStarted = !!v; }

// ───────────────────────────── lifecycle ─────────────────────────────
/** Full reset - called on "New Game". */
export function resetStory() {
  chapter = 1;
  morality = MORALITY_MAX;
  relationships = defaultRelations();
  flags = {};
  price = 0;
  truth = [];
  faction = { alras: 0, serpent: 0, law: 0, tg: 0 };
  decisions = [];
  echoesResolved = [];
  ending = null;
  storyStarted = false;
}

// ───────────────────────────── persistence ─────────────────────────────
/** Serialise into a plain object for the save slot. */
export function serializeStory() {
  return {
    chapter,
    morality,
    relationships: { ...relationships },
    flags: { ...flags },
    price,
    truth: [...truth],
    faction: { ...faction },
    decisions: decisions.map(d => ({ ...d })),
    echoesResolved: [...echoesResolved],
    ending,
    storyStarted,
  };
}

/**
 * Restore from a save slot. Missing or malformed fields fall back to the
 * fresh-story defaults so old saves (pre-story) still load cleanly.
 */
export function deserializeStory(raw) {
  if (!raw || typeof raw !== "object") {
    resetStory();
    return false;
  }
  chapter = Number.isFinite(raw.chapter)
    ? Math.min(STORY.totalChapters, Math.max(1, Math.floor(raw.chapter)))
    : 1;
  morality = Number.isFinite(raw.morality)
    ? Math.max(MORALITY_MIN, Math.min(MORALITY_MAX, raw.morality))
    : MORALITY_MAX;

  relationships = defaultRelations();
  if (raw.relationships && typeof raw.relationships === "object") {
    for (const k of Object.keys(relationships)) {
      const v = raw.relationships[k];
      if (Number.isFinite(v)) relationships[k] = Math.max(0, Math.min(100, v));
    }
  }

  flags = {};
  if (raw.flags && typeof raw.flags === "object") {
    for (const [k, v] of Object.entries(raw.flags)) flags[k] = v;
  }

  price = Number.isFinite(raw.price) ? Math.max(0, Math.min(100, raw.price)) : 0;
  truth = Array.isArray(raw.truth) ? [...raw.truth] : [];
  faction = { alras: 0, serpent: 0, law: 0, tg: 0 };
  if (raw.faction && typeof raw.faction === "object") {
    for (const k of Object.keys(faction)) if (Number.isFinite(raw.faction[k])) faction[k] = raw.faction[k];
  }
  decisions = Array.isArray(raw.decisions) ? raw.decisions.map(d => ({ ...d })) : [];
  echoesResolved = Array.isArray(raw.echoesResolved) ? [...raw.echoesResolved] : [];

  ending = typeof raw.ending === "string" && raw.ending ? raw.ending : null;
  storyStarted = !!raw.storyStarted;
  return true;
}

/** Compact human-readable summary used by the journal. */
export function getStorySummary() {
  // read endingReached so the flag is not write-only
  const _endingReached = hasFlag("endingReached");
  return {
    chapter,
    morality,
    ending,
    started: storyStarted,
    flagCount: Object.keys(flags).length,
    endingReached: _endingReached,
  };
}

// Expose for debugging / console access
if (typeof window !== "undefined") {
  window.SG_StoryState = {
    getChapter, setChapter, advanceChapter, isLastChapter,
    getMorality, addMorality,
    getRelationship, addRelationship, getRelationships,
    setFlag, hasFlag, getFlags,
    getPrice, addPrice, setPrice,
    getTruth, hasTruth, addTruth, setTruth,
    getFaction, addFaction, getFactions, setFactions,
    getDecisions, addDecision, hasDecision,
    getEchoesResolved, markEchoResolved, isEchoResolved,
    getEnding, setEnding,
    isStoryStarted, setStoryStarted,
    resetStory, serializeStory, deserializeStory, getStorySummary,
  };
}