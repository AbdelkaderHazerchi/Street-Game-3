// ============================================================================
// STORY QUESTS — Street Game 2 : "The Ghost Ledger"
// Converts the authored quest definitions in questDefs.js into the exact quest
// objects that js/missions/missionSystem.js already consumes.
//
// Output schema per quest:
//   { id, category, type, icon, reward, order, start{x,y}, end{x,y},
//     title{ar,en}, desc{ar,en}, params{ meetingMessages[], itemName } }
//
// Nothing here imports the mission engine, so there is no import cycle.
// ============================================================================

import { MAIN_QUESTS, SIDE_QUESTS } from "./questDefs.js?v=57";
import { installLandmarks } from "./landmarks.js?v=57";

/** Quest types the engine knows about. Anything else would be dropped. */
const ENGINE_TYPES = new Set([
  "deliverShipment", "killTarget", "transportPerson", "escapeCar",
  "stealCar", "silentPursuit", "surveillance", "plantBomb",
  "meeting", "theft", "deliverLoot",
]);

function bi(value, fallbackAr, fallbackEn) {
  if (!value) return { ar: fallbackAr, en: fallbackEn };
  return {
    ar: String(value.ar || fallbackAr || "").trim(),
    en: String(value.en || fallbackEn || value.ar || "").trim(),
  };
}

/** Convert an authored quest (main or side) into an engine quest object. */
function toEngineQuest(raw, category, order) {
  const type = ENGINE_TYPES.has(raw.type) ? raw.type : "deliverShipment";
  const title = bi(raw.title, raw.id, raw.id);
  const desc = bi(raw.desc, "", "");
  const quest = {
    id: raw.id,
    category,
    type,
    icon: raw.icon || (category === "main" ? "🎯" : "🟣"),
    reward: typeof raw.reward === "number" && Number.isFinite(raw.reward) ? raw.reward : 400,
    order,
    start: { x: Math.floor(raw.start.x), y: Math.floor(raw.start.y) },
    end: { x: Math.floor(raw.end.x), y: Math.floor(raw.end.y) },
    title,
    desc,
  };

  const params = {};
  // Meeting dialogue: prefer `meeting`, fall back to the intro lines so a
  // "meeting" quest is never silent.
  const msgs = (Array.isArray(raw.meeting) && raw.meeting.length)
    ? raw.meeting
    : (type === "meeting" ? (raw.intro || []) : []);
  if (msgs.length) {
    const norm = msgs
      .filter((m) => m && typeof m === "object")
      .map((m) => ({
        ar: String(m.ar || "").trim(),
        en: String(m.en || "").trim(),
        roleAr: String(m.roleAr || "").trim(),
        roleEn: String(m.roleEn || "").trim(),
      }))
      .filter((m) => m.ar || m.en);
    if (norm.length) {
      params.meetingMessages = norm;
      // Legacy single-message mirrors, kept for older readers.
      params.meetingAr = norm[0].ar;
      params.meetingEn = norm[0].en;
      params.meetingRoleAr = norm[0].roleAr;
      params.meetingRoleEn = norm[0].roleEn;
    }
  }
  if (raw.itemName) params.itemName = bi(raw.itemName, "item", "item").ar;

  if (Object.keys(params).length) quest.params = params;

  // Story-only fields the mission system ignores but the story layer reads.
  if (raw.chapter) quest.chapter = raw.chapter;
  if (Array.isArray(raw.intro) && raw.intro.length) quest.intro = raw.intro;
  if (Array.isArray(raw.outro) && raw.outro.length) quest.outro = raw.outro;
  if (raw.rel && typeof raw.rel === "object") quest.rel = raw.rel;
  if (typeof raw.morality === "number") quest.morality = raw.morality;
  if (raw.flag) quest.flag = raw.flag;
  // Artwork for the accept screen (optional - a placeholder is generated).
  if (raw.image) quest.image = raw.image;

  return quest;
}

/** Build the full quest list: main quests in chapter order, then side quests. */
export function buildStoryQuests() {
  const mains = [...MAIN_QUESTS]
    .sort((a, b) => (a.order ?? 0) - (b.order ?? 0))
    .map((q, i) => toEngineQuest(q, "main", i));

  const sides = SIDE_QUESTS
    .slice()
    .sort((a, b) => a.id.localeCompare(b.id))
    .map((q, i) => toEngineQuest(q, "side", i));

  return { quests: [...mains, ...sides], mains, sides };
}

/**
 * Install the story quests + landmarks into the globals the map loader and
 * mission generator read. Call this before generateMissions().
 *
 * @param {object} [options]
 * @param {boolean} [options.landmarks] stamp the six story landmarks (default true)
 */
export function installStoryContent(options = {}) {
  const { landmarks = true } = options;
  const { quests, mains, sides } = buildStoryQuests();

  if (typeof window !== "undefined") {
    window._mapQuests = quests;
    // Legacy flat view keeps any older code path working.
    window._mapMissionGivers = quests.map((q) => ({
      x: q.start.x,
      y: q.start.y,
      endX: q.end.x,
      endY: q.end.y,
      type: q.type,
      icon: q.icon,
      category: q.category,
      title: q.title,
      desc: q.desc,
      reward: q.reward,
      start: q.start,
      end: q.end,
      id: q.id,
      order: q.order,
    }));
  }

  if (landmarks) {
    try { installLandmarks(); }
    catch (e) { console.warn("[story] landmark install failed", e); }
  }

  console.log(`[story] installed ${mains.length} main + ${sides.length} side quests`);
  return quests;
}

/** Look up an authored quest definition by id (for the story layer). */
export function getQuestDef(id) {
  return MAIN_QUESTS.find((q) => q.id === id) || SIDE_QUESTS.find((q) => q.id === id) || null;
}

/** All main quest ids grouped by chapter, in order. */
export function getMainQuestsByChapter() {
  const out = {};
  for (const q of [...MAIN_QUESTS].sort((a, b) => (a.order ?? 0) - (b.order ?? 0))) {
    const ch = q.chapter || 1;
    (out[ch] = out[ch] || []).push(q.id);
  }
  return out;
}

/** Expose for debugging */
if (typeof window !== "undefined") {
  window.SG_StoryQuests = { buildStoryQuests, installStoryContent, getQuestDef, getMainQuestsByChapter };
}