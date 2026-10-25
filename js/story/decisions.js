// Ledger of Decisions — records and reads choices.
import { getChapter, addDecision, hasDecision, getDecisions } from "./storyState.js?v=57";

export function recordDecision(id, choice, opts = {}) {
  if (!id) return false;
  if (hasDecision(id)) return false;
  addDecision({ id, chapter: opts.chapter ?? getChapter(), questId: opts.questId || null, choice, text: opts.text || null, who: opts.who || null, knows: opts.knows || null });
  return true;
}

export function hasDecisionRecord(id) { return hasDecision(id); }
export function listDecisions() { return getDecisions(); }
export function getDecision(id) { return getDecisions().find(d => d.id === id) || null; }

if (typeof window !== "undefined") {
  window.SG_Decisions = { recordDecision, hasDecisionRecord, listDecisions, getDecision, decisionCount };
}
export function decisionCount() { return getDecisions().length; }