// ======================== MISSION / QUEST DEFINITIONS ========================
// 11 quest types (5 original + 6 added 2026-08-30)
// Original 5: deliverShipment, killTarget, transportPerson, escapeCar, stealCar
// New 6: silentPursuit, surveillance, plantBomb, meeting, theft, deliverLoot
import { CFG } from "../core/config.js?v=57";
export const MISSION_REWARDS = {
  deliverShipment: 400,
  killTarget: 500,
  transportPerson: 350,
  escapeCar: 800,
  stealCar: 300,
  silentPursuit: 600,
  surveillance: 450,
  plantBomb: 700,
  meeting: 200,
  theft: 650,
  deliverLoot: 350,
};

export const MISSION_DESCS = {
  deliverShipment: "سلّم الشحنة إلى الموقع المحدد",
  killTarget: "اقضِ على الهدف المحدد على الخريطة",
  transportPerson: "انقل الشخص إلى الموقع المحدد",
  escapeCar: "اهرب بالسيارة إلى الموقع المحدد بعد مطاردة الشرطة",
  stealCar: "اسرق سيارة وقُدها إلى الموقع المحدد",
  silentPursuit: "اتبع السيارة بصمت دون اقتراب أو ابتعاد شديد",
  surveillance: "ابقَ داخل الدائرة 30 ثانية دون قتل أو شرطة",
  plantBomb: "اذهب إلى الموقع، وازرع القنبلة، ثم اهرب إلى خط النهاية",
  meeting: "تحدث إلى الشخص في الموقع المحدد",
  theft: "اسرق الغرض (اضغط مطولاً) وتجنب الكشف",
  deliverLoot: "سلّم الغرض المسروق إلى الموقع",
};

export const RANDOM_MISSION_DEFS = [
  { name: "توصيل شحنة", desc: "سلّم الشحنة إلى الموقع المحدد (شحنة واحدة)", icon: "📦", type: "deliverShipment", reward: 400 },
  { name: "قتل هدف", desc: "اقضِ على الهدف المحدد على الخريطة (مرة واحدة)", icon: "💀", type: "killTarget", reward: 500 },
  { name: "نقل شخص", desc: "انقل شخصًا إلى الموقع المحدد (مرة واحدة)", icon: "🚕", type: "transportPerson", reward: 350 },
  { name: "هروب بالسيارة", desc: "استقل سيارة، وستطاردك الشرطة. ثم اهرب إلى الموقع المحدد", icon: "🚨", type: "escapeCar", reward: 800 },
  { name: "سرقة سيارة", desc: "اسرق سيارة ثم قدها إلى الموقع المحدد (مرة واحدة)", icon: "🚗", type: "stealCar", reward: 300 },
  { name: "تتبع صامت", desc: "اتبع السيارة دون اقتراب أو ابتعاد شديد", icon: "🕵️", type: "silentPursuit", reward: 600 },
  { name: "مراقبة", desc: "راقب المنطقة 30 ثانية", icon: "👁️", type: "surveillance", reward: 450 },
  { name: "زرع قنبلة", desc: "ازرع القنبلة واهرب", icon: "💣", type: "plantBomb", reward: 700 },
  { name: "اجتماع", desc: "تحدث إلى جهة الاتصال", icon: "💬", type: "meeting", reward: 200 },
  { name: "سرقة", desc: "اسرق الغرض (20 ثانية)", icon: "🦹", type: "theft", reward: 650 },
  { name: "تسليم مسروقات", desc: "سلّم الغرض للموقع", icon: "🎒", type: "deliverLoot", reward: 350 },
];

// ======================== NEW QUEST SYSTEM (two-point, bilingual, categories) ========================
export const QUEST_CATEGORIES = {
  MAIN: "main",
  SIDE: "side",
};
export const QUEST_CATEGORY_COLOR = {
  main: "#ffd700", // yellow
  side: "#a855f7", // purple
};
export const QUEST_CATEGORY_DOT = {
  main: "#ffd700",
  side: "#a020f0",
};
// Bilingual defaults per type (11 types + spammer)
export const QUEST_TYPE_I18N = {
  deliverShipment: { icon:"📦", title:{ar:"توصيل شحنة", en:"Deliver Shipment"}, desc:{ar:"سلّم الشحنة إلى الموقع المحدد (شحنة واحدة)", en:"Deliver 1 shipment to the marked location"}, objective:{ar:"سلّم الشحنة", en:"Deliver shipment"} },
  killTarget:      { icon:"💀", title:{ar:"قتل هدف", en:"Kill Target"},        desc:{ar:"اقضِ على الهدف المحدد على الخريطة (مرة واحدة)", en:"Eliminate the target marked on the map (1 time)"}, objective:{ar:"اقتل الهدف", en:"Kill target"} },
  transportPerson: { icon:"🚕", title:{ar:"نقل شخص", en:"Transport Person"},   desc:{ar:"انقل شخصًا إلى الموقع المحدد (مرة واحدة)", en:"Transport a person to the marked location (1 time)"}, objective:{ar:"انقل الشخص", en:"Transport person"} },
  escapeCar:       { icon:"🚨", title:{ar:"هروب بالسيارة", en:"Escape by Car"}, desc:{ar:"استقل سيارة، وستطاردك الشرطة. ثم اهرب إلى الموقع المحدد", en:"Police will pursue once you enter a car; escape to the marked location"}, objective:{ar:"اهرب", en:"Escape"} },
  stealCar:        { icon:"🚗", title:{ar:"سرقة سيارة", en:"Steal Car"},        desc:{ar:"اسرق سيارة ثم قدها إلى الموقع المحدد", en:"Steal a car and drive it to the marked location"}, objective:{ar:"اسرق السيارة", en:"Steal car"} },
  silentPursuit:   { icon:"🕵️", title:{ar:"تتبع صامت", en:"Silent Pursuit"}, desc:{ar:"اتبع السيارة دون اقتراب أو ابتعاد شديد", en:"Follow the car without getting too close or too far"}, objective:{ar:"تتبع صامت", en:"Follow silently"} },
  surveillance:    { icon:"👁️", title:{ar:"مراقبة", en:"Surveillance"},        desc:{ar:"ابقَ داخل الدائرة 30 ثانية دون قتل أو شرطة", en:"Stay inside the circle for 30s, no kills, no police"}, objective:{ar:"راقب", en:"Surveil"} },
  plantBomb:       { icon:"💣", title:{ar:"زرع قنبلة", en:"Plant Bomb"},       desc:{ar:"اذهب إلى الموقع، وازرع القنبلة، ثم اهرب إلى خط النهاية", en:"Go to the location, plant the bomb, then escape to the finish line"}, objective:{ar:"ازرع القنبلة", en:"Plant bomb"} },
  meeting:         { icon:"💬", title:{ar:"اجتماع", en:"Meeting"},             desc:{ar:"تحدث إلى الشخص في الموقع المحدد", en:"Talk to the contact at the marked location"}, objective:{ar:"تحدث", en:"Talk"} },
  theft:           { icon:"🦹", title:{ar:"سرقة", en:"Theft"},                 desc:{ar:"اسرق الغرض (اضغط مطولاً 20 ثانية)", en:"Steal the item (hold 20s, release if someone approaches)"}, objective:{ar:"اسرق", en:"Steal"} },
  deliverLoot:     { icon:"🎒", title:{ar:"تسليم مسروقات", en:"Deliver Loot"}, desc:{ar:"سلّم الغرض المسروق إلى الموقع", en:"Deliver the stolen item to the marked location"}, objective:{ar:"سلّم", en:"Deliver"} },
  spammer:         { icon:"💀", title:{ar:"سبامر", en:"Spammer"},               desc:{ar:"نشاط سبامر", en:"Spammer activity"}, objective:{ar:"تعامل", en:"Handle"} },
};
// Union keys for validation
export const QUEST_TYPES = Object.keys(QUEST_TYPE_I18N);
export function getQuestIcon(type){ return (QUEST_TYPE_I18N[type] && QUEST_TYPE_I18N[type].icon) || "⭐"; }
export function getQuestDefaultTitle(type, lang){ const d=QUEST_TYPE_I18N[type]; if(!d) return type; return (lang==="en"?d.title.en:d.title.ar); }
export function getQuestDefaultDesc(type, lang){ const d=QUEST_TYPE_I18N[type]; if(!d) return ""; return (lang==="en"?d.desc.en:d.desc.ar); }
export function getQuestDefaultObjective(type, lang){ const d=QUEST_TYPE_I18N[type]; if(!d) return ""; return (lang==="en"?d.objective.en:d.objective.ar); }
// Helpers for quest objects that may have bilingual title/desc
export function getQuestDisplayTitle(quest, lang){
  if(!quest) return "";
  if(quest.title && typeof quest.title==="object"){ return (lang==="en" ? (quest.title.en||quest.title.ar) : (quest.title.ar||quest.title.en)) || getQuestDefaultTitle(quest.type, lang); }
  if(typeof quest.title==="string" && quest.title.trim()) return quest.title;
  return getQuestDefaultTitle(quest.type, lang);
}
export function getQuestDisplayDesc(quest, lang){
  if(!quest) return "";
  if(quest.desc && typeof quest.desc==="object"){ return (lang==="en" ? (quest.desc.en||quest.desc.ar) : (quest.desc.ar||quest.desc.en)) || getQuestDefaultDesc(quest.type, lang); }
  if(typeof quest.desc==="string" && quest.desc.trim()) return quest.desc;
  return getQuestDefaultDesc(quest.type, lang);
}
export function getQuestDisplayObjective(quest, lang){
  if(!quest) return "";
  if(quest.objective && typeof quest.objective==="object"){ return (lang==="en" ? (quest.objective.en||quest.objective.ar) : (quest.objective.ar||quest.objective.en)) || getQuestDefaultObjective(quest.type, lang); }
  if(typeof quest.objective==="string" && quest.objective.trim()) return quest.objective;
  if(quest.desc && typeof quest.desc==="object"){ return getQuestDisplayDesc(quest, lang); }
  return getQuestDefaultObjective(quest.type, lang);
}
// Migration: legacy -> new 11 types
const LEGACY_TO_NEW = {
  taxi:"transportPerson", race:"silentPursuit", delivery:"deliverShipment", heist:"stealCar", chase:"silentPursuit",
  collection:"surveillance", protect:"surveillance", smuggle:"deliverShipment", stealCar:"stealCar", transport:"transportPerson",
  killPolice:"killTarget", killCivilians:"killTarget", killGang:"killTarget", smuggleProhibited:"theft", smuggleWeapons:"theft",
  deliverShipment:"deliverShipment", killTarget:"killTarget", transportPerson:"transportPerson", escapeCar:"escapeCar",
  silentPursuit:"silentPursuit", surveillance:"surveillance", plantBomb:"plantBomb", meeting:"meeting", theft:"theft", deliverLoot:"deliverLoot"
};
export function migrateLegacyMissionsToQuests(legacyList){
  if(!Array.isArray(legacyList)) return [];
  return legacyList.filter(m=>m.type!=="spammer").map((m, idx)=>{
    const rawType = m.type || "deliverShipment";
    const type = LEGACY_TO_NEW[rawType] || "deliverShipment";
    const icon = m.icon || getQuestIcon(type);
    const title = typeof m.title==="object" ? m.title : (m.name ? {ar:m.name, en:m.name} : {ar:getQuestDefaultTitle(type,"ar"), en:getQuestDefaultTitle(type,"en")});
    const desc = typeof m.desc==="object" ? m.desc : (m.desc ? {ar:m.desc, en:m.desc} : {ar:getQuestDefaultDesc(type,"ar"), en:getQuestDefaultDesc(type,"en")});
    if(m.start && m.end && typeof m.start.x==="number"){
      return {
        id: m.id || `q_legacy_${idx}_${type}_${m.start.x}_${m.start.y}`,
        category: m.category || "main",
        type, icon, reward: m.reward ?? MISSION_REWARDS[type] ?? 300,
        order: m.order ?? idx,
        start: {x: Math.floor(m.start.x), y: Math.floor(m.start.y)},
        end: {x: Math.floor(m.end.x), y: Math.floor(m.end.y)},
        title, desc, objective: m.objective || {ar: desc.ar, en: desc.en}
      };
    }
    const sx = Math.floor(m.x), sy = Math.floor(m.y);
    const ex = sx + 4, ey = sy;
    return {
      id: m.id || `q_legacy_${idx}_${type}_${sx}_${sy}`,
      category: "main",
      type, icon, reward: MISSION_REWARDS[type] ?? 300,
      order: idx,
      start: {x: sx, y: sy},
      end: {x: ex, y: ey},
      title, desc, objective: {ar: desc.ar, en: desc.en}
    };
  });
}
export function normalizeQuest(raw, idx=0){
  const rawType = raw.type || "deliverShipment";
  if(rawType === "spammer") return null;
  const type = LEGACY_TO_NEW[rawType] || rawType;
  const allowed = ["deliverShipment","killTarget","transportPerson","escapeCar","stealCar","silentPursuit","surveillance","plantBomb","meeting","theft","deliverLoot"];
  const finalType = allowed.includes(type) ? type : "deliverShipment";
  const cat = raw.category==="side" ? "side" : "main";
  const icon = raw.icon || getQuestIcon(finalType);
  let start = raw.start ? {x: Math.floor(raw.start.x), y: Math.floor(raw.start.y)} : (typeof raw.x==="number" ? {x: Math.floor(raw.x), y: Math.floor(raw.y)} : {x:0,y:0});
  let end = raw.end ? {x: Math.floor(raw.end.x), y: Math.floor(raw.end.y)} : null;
  if(!end && typeof raw.endX==="number") end = {x: Math.floor(raw.endX), y: Math.floor(raw.endY)};
  if(!end) end = {x: start.x+4, y: start.y};
  // Clamp to map bounds if CFG available
  try{
    const maxX = (CFG.COLS||120)-1, maxY=(CFG.ROWS||120)-1;
    start.x=Math.max(0,Math.min(maxX, start.x)); start.y=Math.max(0,Math.min(maxY, start.y));
    end.x=Math.max(0,Math.min(maxX, end.x)); end.y=Math.max(0,Math.min(maxY, end.y));
    if(start.x===end.x && start.y===end.y) end.x=Math.min(maxX, start.x+1);
  }catch{}
  let title = raw.title;
  if(!title || (typeof title==="object" && !title.ar && !title.en)){
    title = {ar:getQuestDefaultTitle(finalType,"ar"), en:getQuestDefaultTitle(finalType,"en")};
  } else if(typeof title==="string"){
    title = {ar:title, en:title};
  }
  let desc = raw.desc;
  if(!desc || (typeof desc==="object" && !desc.ar && !desc.en)){
    desc = {ar:getQuestDefaultDesc(finalType,"ar"), en:getQuestDefaultDesc(finalType,"en")};
  } else if(typeof desc==="string"){
    desc = {ar:desc, en:desc};
  }
  let objective = raw.objective;
  if(!objective) objective = {ar:desc.ar, en:desc.en};
  else if(typeof objective==="string") objective = {ar:objective, en:objective};
  return {
    id: raw.id || `q_${cat}_${idx}_${finalType}_${start.x}_${start.y}`,
    category: cat,
    type: finalType, icon,
    reward: (typeof raw.reward==="number" ? raw.reward : (MISSION_REWARDS[finalType] ?? 300)),
    order: (typeof raw.order==="number" ? raw.order : idx),
    start, end, title, desc, objective
  };
}
