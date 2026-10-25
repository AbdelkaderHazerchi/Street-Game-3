// Echo Engine: decisions produce consequences consumed later.
import * as S from "./storyState.js?v=57";
import { getQuestDef } from "./storyQuests.js?v=57";

const ECHOES = [];

export function registerEcho(echo) {
  if (echo && echo.id && !ECHOES.some(e => e.id === echo.id)) ECHOES.push(echo);
}

export function getEchoes() { return [...ECHOES]; }

function matchWhen(when, chapter) {
  if (!when) return true;
  if (when.chapter != null && when.chapter !== chapter) return false;
  if (when.flag != null && S.hasFlag(when.flag) !== (when.eq ?? true)) return false;
  if (when.decision != null && !S.hasDecision(when.decision)) return false;
  return true;
}

export function resolveEchoes(chapter) {
  const ch = chapter ?? S.getChapter();
  const resolved = [];
  for (const e of ECHOES) {
    if (S.isEchoResolved(e.id)) continue;
    if (!matchWhen(e.when, ch)) continue;
    try { applyEcho(e); S.markEchoResolved(e.id); resolved.push(e.id); } catch (err) {}
  }
  return resolved;
}

function applyEcho(e) {
  const kind = e.kind;
  const p = e.payload || {};
  switch (kind) {
    case "spawn":
      // Record spawn intent as a flag for consumers
      if (p.flag) S.setFlag(p.flag, true);
      break;
    case "line":
      if (p.flag) S.setFlag(p.flag, true);
      break;
    case "replace":
      if (p.flag) S.setFlag(p.flag, true);
      break;
    case "price":
      if (typeof p.price === "number") S.addPrice(p.price);
      if (p.money && typeof window !== "undefined" && window.player) window.player.money = (window.player.money || 0) + p.money;
      break;
    case "lock":
      if (p.flag) S.setFlag(p.flag, false);
      break;
    case "unlock":
      if (p.flag) S.setFlag(p.flag, true);
      break;
    default:
      break;
  }
}

export function applyEchoesForQuest(questId) {
  return questId;
}

if (typeof window !== "undefined") {
  window.SG_Echoes = { registerEcho, getEchoes, resolveEchoes, applyEchoesForQuest };
}