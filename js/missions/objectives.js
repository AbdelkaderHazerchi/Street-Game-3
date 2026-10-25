// Condition and effect engine.
import * as WF from "../story/worldFacts.js?v=57";

export function evalRequire(list = []) {
  return (list || []).every(c => {
    if (!c) return true;
    if ("flag" in c) return WF.hasFlag(c.flag) === (c.eq ?? true);
    if ("money" in c) return (window.player?.money || 0) >= c.money;
    if ("price" in c) return WF.getPrice() <= c.price;
    if ("rel" in c) return WF.getRelationship(c.rel) >= (c.gte ?? 0);
    if ("truth" in c) return WF.getTruth().length >= c.truth;
    if ("wanted" in c) return (window.player?.wanted || 0) <= (c.lte ?? 99);
    if ("chapter" in c) return WF.getChapter() >= c.chapter;
    return true;
  });
}

export function applyEffects(list = []) {
  for (const e of (list || [])) {
    if (!e) continue;
    if (e.flag) WF.setFlag(e.flag, e.value ?? true);
    if (e.price) WF.addPrice(e.price);
    if (e.money && window.player) window.player.money = (window.player.money || 0) + e.money;
    if (e.rel) for (const [k, v] of Object.entries(e.rel)) WF.addRelationship(k, v);
    if (e.truth) WF.addTruth(e.truth);
    if (e.faction) for (const [k, v] of Object.entries(e.faction)) WF.addFaction(k, v);
    if (e.echo) {
      try { (window.SG_Echoes && window.SG_Echoes.registerEcho) ? window.SG_Echoes.registerEcho(e.echo) : null; } catch {}
    }
    if (e.decision) {
      try { (window.SG_Decisions && window.SG_Decisions.recordDecision) ? window.SG_Decisions.recordDecision(e.decision, e.choice || null, e.opts || {}) : null; } catch {}
    }
  }
}

export function activeNodes(mission) {
  if (!mission) return [];
  if (Array.isArray(mission.active)) return mission.active;
  if (Array.isArray(mission.stages)) return mission.stages.filter(s => !s.done);
  return [];
}
if (typeof window !== 'undefined') window.SG_Objectives = { evalRequire, applyEffects, activeNodes };
