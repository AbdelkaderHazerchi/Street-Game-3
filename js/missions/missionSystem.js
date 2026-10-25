// ======================== MISSION / QUEST SYSTEM (comprehensive overhaul) ========================
// Two-point (Start→End), Main (yellow sequential) / Side (purple all-visible), bilingual AR/EN
// Backward compatible with legacy missionGivers random generation

import { CFG, T } from "../core/config.js?v=57";
import { getTile } from "../map/mapUtils.js?v=57";
import { vehicles, isWalkable, explosions, EXPLOSION_DURATION } from "../entities/vehicles.js?v=57";
import { npcs } from "../entities/npcs.js?v=57";
import { player } from "../entities/player.js?v=57";
import { keys } from "../input/inputState.js?v=57";
import { actionHeld, actionJust } from "../input/keyboard.js?v=57";
import { police } from "../entities/police.js?v=57";
import { specialBuildings } from "../map/mapState.js?v=57";
import { showNotification, updateSuspicionUI, hideSuspicionUI } from "../ui/hud.js?v=57";
import { missionTitle, missionDesc, missionProg } from "../core/domRefs.js?v=57";
import {
  currentMission, allMissions, sequentialMissionIndex, usingSequentialMissions, missionGivers, checkpoints, particles, missionsCompleted,
  setCurrentMission, setMissionsCompleted, setAllMissions, setMissionGivers, setSequentialMissionIndex, setUsingSequentialMissions,
  quests, mainQuests, sideQuests, activeQuestId, questStatus, mainQuestIndex,
  setQuests, setMainQuests, setSideQuests, setActiveQuestId, setQuestStatus, setMainQuestIndex, getQuestById
} from "./missionState.js?v=57";
import { SETTINGS } from "../input/settings.js?v=57";
import { MISSION_REWARDS, MISSION_DESCS, getQuestDisplayTitle, getQuestDisplayDesc, QUEST_TYPE_I18N, getQuestIcon } from "./missionDefs.js?v=57";
import { t } from "../ui/i18n.js?v=57";
import { playBombExplosion } from "../audio/sounds.js?v=57";
import { startMeeting, isMeetingActive, closeMeeting, getCurrentMeeting } from "../ui/meeting.js?v=57";
import { onQuestStarted as storyOnQuestStarted, onQuestCompleted as storyOnQuestCompleted, onFinale as storyOnFinale } from "../story/storyDirector.js?v=57";
import { getQuestDef } from "../story/storyQuests.js?v=57";
import { getQuestImage } from "../assets/questImages.js?v=57";
import { showQuestAccept, isQuestAcceptActive } from "../ui/questAccept.js?v=57";

// Helper: language
function lang(){ return (SETTINGS && SETTINGS.language==="en") ? "en":"ar"; }
// Helper: title/desc from quest object (bilingual)
function qTitle(q){ return getQuestDisplayTitle(q, lang()); }
function qDesc(q){ return getQuestDisplayDesc(q, lang()); }

// Helper to extract bilingual meeting messages (array of {ar,en,roleAr,roleEn}) with backward compat for single meetingAr/En
function getMeetingMessagesFromQuest(q){
  if(!q) return null;
  let arr = null;
  try {
    if (q.params && Array.isArray(q.params.meetingMessages) && q.params.meetingMessages.length) arr = q.params.meetingMessages;
    else if (Array.isArray(q.meetingMessages) && q.meetingMessages.length) arr = q.meetingMessages;
    else if (q.params && Array.isArray(q.params.meetingDialogue) && q.params.meetingDialogue.length) arr = q.params.meetingDialogue;
    else if (Array.isArray(q.meetingDialogue) && q.meetingDialogue.length) arr = q.meetingDialogue;
  } catch {}
  if (Array.isArray(arr) && arr.length) {
    const norm = arr.map(entry=>{
      if(!entry || typeof entry!=="object") return null;
      const ar = String(entry.ar || entry.messageAr || entry.textAr || entry.msgAr || entry.message || "").trim();
      const en = String(entry.en || entry.messageEn || entry.textEn || entry.msgEn || entry.message || "").trim();
      const roleAr = String(entry.roleAr || entry.speakerAr || entry.role || "").trim();
      const roleEn = String(entry.roleEn || entry.speakerEn || entry.role || "").trim();
      return { ar, en, roleAr, roleEn };
    }).filter(m=> m && (m.ar || m.en));
    if (norm.length) return norm;
  }
  // Legacy single message fallback
  let singleAr = "";
  let singleEn = "";
  let singleRoleAr = "";
  let singleRoleEn = "";
  try {
    singleAr = (q.params && q.params.meetingAr) || q.meetingAr || "";
    singleEn = (q.params && q.params.meetingEn) || q.meetingEn || "";
    singleRoleAr = (q.params && (q.params.meetingRoleAr || q.params.speakerAr || q.params.roleAr)) || q.meetingRoleAr || q.speakerAr || q.roleAr || "";
    singleRoleEn = (q.params && (q.params.meetingRoleEn || q.params.speakerEn || q.params.roleEn)) || q.meetingRoleEn || q.speakerEn || q.roleEn || "";
  } catch {}
  if (singleAr || singleEn) {
    return [{ ar: String(singleAr).trim(), en: String(singleEn).trim(), roleAr: String(singleRoleAr).trim(), roleEn: String(singleRoleEn).trim() }];
  }
  return null;
}

function normalizeQuestForRuntime(raw, idx){
  const type = raw.type || "deliverShipment";
  const category = raw.category==="side" ? "side":"main";
  const icon = raw.icon || getQuestIcon(type) || "⭐";
  const reward = typeof raw.reward==="number" ? raw.reward : (MISSION_REWARDS[type] ?? 300);
  let title = raw.title;
  if(!title) title = {ar: (QUEST_TYPE_I18N[type]&&QUEST_TYPE_I18N[type].title.ar)||type, en: (QUEST_TYPE_I18N[type]&&QUEST_TYPE_I18N[type].title.en)||type};
  else if(typeof title==="string") title={ar:title,en:title};
  let desc = raw.desc;
  if(!desc) desc = {ar: (QUEST_TYPE_I18N[type]&&QUEST_TYPE_I18N[type].desc.ar)||"", en: (QUEST_TYPE_I18N[type]&&QUEST_TYPE_I18N[type].desc.en)||""};
  else if(typeof desc==="string") desc={ar:desc,en:desc};
  const start = raw.start ? {x:Math.floor(raw.start.x), y:Math.floor(raw.start.y)} : (typeof raw.x==="number" ? {x:Math.floor(raw.x), y:Math.floor(raw.y)} : {x:0,y:0});
  const end = raw.end ? {x:Math.floor(raw.end.x), y:Math.floor(raw.end.y)} : (typeof raw.endX==="number"? {x:Math.floor(raw.endX), y:Math.floor(raw.endY)} : {x: Math.min(CFG.COLS-1, start.x+4), y: start.y});
  // Preserve meeting messages and item params for runtime
  let meetingMessages = null;
  let legacyAr = "", legacyEn = "";
  let legacyRoleAr = "", legacyRoleEn = "";
  try {
    meetingMessages = getMeetingMessagesFromQuest(raw);
    // Keep legacy fields for backward compat exposure
    if (meetingMessages && meetingMessages.length) {
      legacyAr = meetingMessages[0].ar;
      legacyEn = meetingMessages[0].en;
      legacyRoleAr = meetingMessages[0].roleAr;
      legacyRoleEn = meetingMessages[0].roleEn;
    } else {
      // No messages, keep single if exists (already handled inside helper but ensure raw has nothing)
    }
  } catch {}
  // Build params preservation
  let params = null;
  try {
    if (raw.params && typeof raw.params==="object") params = { ...raw.params };
  } catch {}
  // If raw has meetingMessages but params didn't, ensure params includes it
  if (meetingMessages && meetingMessages.length) {
    if (!params) params = {};
    // Store canonical meetingMessages
    params.meetingMessages = meetingMessages;
    // Keep legacy single for old readers
    if (legacyAr) params.meetingAr = legacyAr;
    if (legacyEn) params.meetingEn = legacyEn;
    if (legacyRoleAr) params.meetingRoleAr = legacyRoleAr;
    if (legacyRoleEn) params.meetingRoleEn = legacyRoleEn;
  } else if (raw.meetingMessages) {
    if (!params) params = {};
    params.meetingMessages = raw.meetingMessages;
  }
  // Also handle itemName legacy
  const itemName = (raw.params && raw.params.itemName) || raw.itemName || undefined;
  if (itemName && (!params || !params.itemName)) {
    if (!params) params = {};
    params.itemName = itemName;
  }
  const out = { id: raw.id||`q_${category}_${idx}_${type}_${start.x}_${start.y}`, category, type, icon, reward, order: (typeof raw.order==="number"? raw.order: idx), start, end, title, desc };
  if (params) out.params = params;
  // Passthrough new agency fields
  for (const k of ["requiresFlag","minMorality","requiresRel","choices","nodes","failWhen","flagsOnComplete","echoes","beats","entry"]) if (raw[k] !== undefined) out[k] = raw[k];
  // Artwork for the quest accept screen (optional).
  if (raw.image) out.image = raw.image;
  if (itemName) out.itemName = itemName;
  if (meetingMessages && meetingMessages.length) {
    out.meetingMessages = meetingMessages;
    out.meetingAr = legacyAr || undefined;
    out.meetingEn = legacyEn || undefined;
    out.meetingRoleAr = legacyRoleAr || undefined;
    out.meetingRoleEn = legacyRoleEn || undefined;
  } else if (raw.meetingAr || raw.meetingEn) {
    out.meetingAr = raw.meetingAr;
    out.meetingEn = raw.meetingEn;
  }
  return out;
}

export function generateMissions() {
  allMissions.length = 0;
  missionGivers.length = 0;
  quests.length = 0;
  mainQuests.length = 0;
  sideQuests.length = 0;
  // reset quest status
  if(questStatus instanceof Map) questStatus.clear();
  else { setQuestStatus(new Map()); }
  setActiveQuestId(null);
  setMainQuestIndex(0);
  setSequentialMissionIndex(0);

  const hasQuests = window._mapQuests && window._mapQuests.length>0;
  const hasLegacyMG = window._mapMissionGivers && window._mapMissionGivers.length>0;

  if (hasQuests) {
    // New two-point system
    setUsingSequentialMissions(true);
    const normalized = window._mapQuests.map((raw, idx)=> normalizeQuestForRuntime(raw, idx));
    // sort mains by order
    normalized.sort((a,b)=>{
      if(a.category!==b.category) return a.category==="main" ? -1:1;
      if(a.category==="main") return (a.order||0)-(b.order||0);
      return 0;
    });
    // reassign main orders sequentially
    let mo=0;
    normalized.forEach(q=>{ if(q.category==="main") q.order=mo++; });
    // push to state
    normalized.forEach(q=>{
      quests.push(q);
      if(q.category==="main") mainQuests.push(q); else sideQuests.push(q);
      // build legacy-compatible missionGivers entry + allMissions
      const mDef = {
        name: getQuestDisplayTitle(q,"ar"), // legacy ar fallback
        desc: getQuestDisplayDesc(q,"ar"),
        icon: q.icon,
        type: q.type,
        reward: q.reward,
        // keep bilingual for new UI
        title: q.title,
        questId: q.id,
        category: q.category,
        start: q.start,
        end: q.end
      };
      allMissions.push(mDef);
      const sx = q.start.x * CFG.TILE + CFG.TILE/2;
      const sy = q.start.y * CFG.TILE + CFG.TILE/2;
      const ex = q.end.x * CFG.TILE + CFG.TILE/2;
      const ey = q.end.y * CFG.TILE + CFG.TILE/2;
      missionGivers.push({
        x: sx, y: sy,
        endX: ex, endY: ey,
        type: q.type,
        mission: mDef,
        questId: q.id,
        category: q.category,
        taken: false,
        completed: false,
        order: q.order,
        title: q.title,
        desc: q.desc,
        icon: q.icon
      });
    });
    // Initialize questStatus: first main available, rest locked; sides available
    mainQuests.forEach((q, idx)=>{
      questStatus.set(q.id, idx===0 ? "available" : "locked");
    });
    sideQuests.forEach(q=> questStatus.set(q.id, "available"));
    return;
  }

  if (hasLegacyMG) {
    // Legacy migration: _mapMissionGivers flat start points -> treat as main sequential with auto end offset
    setUsingSequentialMissions(true);
    const MISSION_REWARDS_LEG = { taxi:200, race:500, delivery:300, heist:1000, chase:400, collection:600, protect:350, smuggle:750, stealCar:300, transport:400, killPolice:500, killCivilians:400, killGang:450, smuggleProhibited:800, smuggleWeapons:900 };
    const MISSION_DESCS_LEG = { taxi:"أوصل الركاب إلى وجهاتهم", race:"اجتز نقاط التفتيش في الوقت المحدد", delivery:"خذ الطرد إلى وجهته", heist:"اقتحم البنك واهرب من الشرطة", chase:"طارد السيارة المستهدفة", collection:"اجمع 5 نقاط في جميع أنحاء المدينة", protect:"احمِ المنطقة من المجرمين", smuggle:"سلم البضاعة عبر المدينة", stealCar:"اسرق السيارة المستهدفة", transport:"انقل البضاعة عبر المدينة", killPolice:"تخلص من عناصر الشرطة", killCivilians:"اقتل 5 من المدنيين", killGang:"قضِ على أفراد العصابة", smuggleProhibited:"هرّب الشحنة بأمان", smuggleWeapons:"سلّم الأسلحة إلى الوجهة" };
    window._mapMissionGivers.forEach((mg, index)=>{
      const type = mg.type||"taxi";
      const reward = MISSION_REWARDS_LEG[type]??300;
      const descAr = MISSION_DESCS_LEG[type]??"أكمل المهمة";
      const descEn = type;
      const titleAr = mg.title&&mg.title.ar ? mg.title.ar : (QUEST_TYPE_I18N[type] ? QUEST_TYPE_I18N[type].title.ar : type);
      const titleEn = mg.title&&mg.title.en ? mg.title.en : (QUEST_TYPE_I18N[type] ? QUEST_TYPE_I18N[type].title.en : type);
      const sx = Math.floor(mg.x), sy=Math.floor(mg.y);
      const ex = mg.end ? Math.floor(mg.end.x) : Math.min(CFG.COLS-1, sx+4);
      const ey = mg.end ? Math.floor(mg.end.y) : sy;
      const quest = {
        id: mg.id||`q_main_${index}_${type}_${sx}_${sy}`,
        category:"main", type, icon: mg.icon||"⭐", reward, order:index,
        start:{x:sx,y:sy}, end:{x:ex,y:ey},
        title:{ar:titleAr,en:titleEn}, desc:{ar:descAr,en:descEn}
      };
      quests.push(quest); mainQuests.push(quest);
      const mDef={ name:titleAr, desc:descAr, icon:quest.icon, type, reward, title:quest.title, questId:quest.id, category:"main", start:quest.start, end:quest.end };
      allMissions.push(mDef);
      missionGivers.push({ x:sx*CFG.TILE+CFG.TILE/2, y:sy*CFG.TILE+CFG.TILE/2, endX:ex*CFG.TILE+CFG.TILE/2, endY:ey*CFG.TILE+CFG.TILE/2, type, mission:mDef, questId:quest.id, category:"main", taken:false, order:index, title:quest.title, desc:quest.desc, icon:quest.icon });
      questStatus.set(quest.id, index===0?"available":"locked");
    });
    return;
  }

  // ── MODE B: No map data — random placement for 11 quest types ──
  setUsingSequentialMissions(false);
  // Yellow mains sequential, purple sides all visible
  const mainDefs = [
    { name:"توصيل شحنة", desc:"سلّم الشحنة إلى الموقع المحدد (شحنة واحدة)", icon:"📦", type:"deliverShipment", reward:400 },
    { name:"قتل هدف", desc:"اقضِ على الهدف المحدد على الخريطة (مرة واحدة)", icon:"💀", type:"killTarget", reward:500 },
    { name:"زرع قنبلة", desc:"ازرع القنبلة واهرب", icon:"💣", type:"plantBomb", reward:700 },
    { name:"تتبع صامت", desc:"اتبع السيارة دون اقتراب أو ابتعاد شديد", icon:"🕵️", type:"silentPursuit", reward:600 },
  ];
  const sideDefs = [
    { name:"نقل شخص", desc:"انقل شخصًا إلى الموقع المحدد (مرة واحدة)", icon:"🚕", type:"transportPerson", reward:350 },
    { name:"هروب بالسيارة", desc:"استقل سيارة فتطاردك الشرطة ثم اهرب إلى الموقع المحدد", icon:"🚨", type:"escapeCar", reward:800 },
    { name:"سرقة سيارة", desc:"اسرق سيارة ثم قدها إلى الموقع المحدد (مرة واحدة)", icon:"🚗", type:"stealCar", reward:300 },
    { name:"مراقبة", desc:"ابقَ داخل الدائرة 30 ثانية", icon:"👁️", type:"surveillance", reward:450 },
    { name:"اجتماع", desc:"تحدث إلى جهة الاتصال", icon:"💬", type:"meeting", reward:200 },
    { name:"سرقة", desc:"اسرق الغرض (20 ثانية)", icon:"🦹", type:"theft", reward:650 },
    { name:"تسليم مسروقات", desc:"سلّم الغرض إلى الموقع", icon:"🎒", type:"deliverLoot", reward:350 },
  ];
  let questCounter=0;
  function randomWalkablePixel(){
    let gx,gy,attempts=0;
    do{
      const tileX=2+Math.floor(Math.random()*(CFG.COLS-6));
      const tileY=2+Math.floor(Math.random()*(CFG.ROWS-6));
      gx=tileX*CFG.TILE+CFG.TILE/2; gy=tileY*CFG.TILE+CFG.TILE/2;
      attempts++;
    }while( (!isWalkable(gx,gy) || vehicles.some(v=>Math.hypot(v.x-gx,v.y-gy)<60)) && attempts<100);
    return {x:gx,y:gy};
  }
  function pixelToTile(p){ return {x: Math.floor(p.x/CFG.TILE), y: Math.floor(p.y/CFG.TILE)}; }
  // Mains sequential
  mainDefs.forEach((mDef, idx)=>{
    const startPx=randomWalkablePixel();
    const endPx=getWalkableTile();
    const st=pixelToTile(startPx), en=pixelToTile(endPx);
    let params = mDef.params ? {...mDef.params} : undefined;
    if(mDef.type==="meeting"){
      params = params || {};
      // New multi-message format: array with message+role bilingual
      params.meetingMessages = [
        { ar: "وصلت في الوقت المناسب.", en: "You came at the right time.", roleAr: "المخبر", roleEn: "Informant" }
      ];
      // Keep legacy single for backward compat
      params.meetingAr = params.meetingMessages[0].ar;
      params.meetingEn = params.meetingMessages[0].en;
      params.meetingRoleAr = params.meetingMessages[0].roleAr;
      params.meetingRoleEn = params.meetingMessages[0].roleEn;
    }
    const q={ id:`q_main_rand_${questCounter++}`, category:"main", type:mDef.type, icon:mDef.icon, reward:mDef.reward, order:idx, start:st, end:en, title:{ar:mDef.name,en:mDef.type}, desc:{ar:mDef.desc,en:mDef.desc}, params, itemName: params?.itemName, meetingAr: params?.meetingAr, meetingEn: params?.meetingEn, meetingMessages: params?.meetingMessages, meetingRoleAr: params?.meetingRoleAr, meetingRoleEn: params?.meetingRoleEn };
    quests.push(q); mainQuests.push(q);
    const legacyDef={ name:mDef.name, desc:mDef.desc, icon:mDef.icon, type:mDef.type, reward:mDef.reward, title:q.title, questId:q.id, category:"main", start:st, end:en };
    allMissions.push(legacyDef);
    missionGivers.push({ x:startPx.x, y:startPx.y, endX:endPx.x, endY:endPx.y, type:mDef.type, mission:legacyDef, questId:q.id, category:"main", taken:false, order:idx, title:q.title, desc:q.desc, icon:mDef.icon });
    questStatus.set(q.id, idx===0?"available":"locked");
  });
  // Sides all available
  sideDefs.forEach((mDef, idx)=>{
    const startPx=randomWalkablePixel();
    const endPx=getWalkableTile();
    const st=pixelToTile(startPx), en=pixelToTile(endPx);
    let params = mDef.params ? {...mDef.params} : undefined;
    // For meeting, add random bilingual message with role
    if(mDef.type==="meeting"){
      params = params || {};
      params.meetingMessages = [
        { ar: "عندي عمل لك.", en: "I have a job for you.", roleAr: "العميل", roleEn: "Client" }
      ];
      params.meetingAr = params.meetingMessages[0].ar;
      params.meetingEn = params.meetingMessages[0].en;
      params.meetingRoleAr = params.meetingMessages[0].roleAr;
      params.meetingRoleEn = params.meetingMessages[0].roleEn;
    }
    const q={ id:`q_side_rand_${questCounter++}`, category:"side", type:mDef.type, icon:mDef.icon, reward:mDef.reward, order:idx, start:st, end:en, title:{ar:mDef.name,en:mDef.type}, desc:{ar:mDef.desc,en:mDef.desc}, params, itemName: params?.itemName, meetingAr: params?.meetingAr, meetingEn: params?.meetingEn, meetingMessages: params?.meetingMessages, meetingRoleAr: params?.meetingRoleAr, meetingRoleEn: params?.meetingRoleEn };
    quests.push(q); sideQuests.push(q);
    const legacyDef={ name:mDef.name, desc:mDef.desc, icon:mDef.icon, type:mDef.type, reward:mDef.reward, title:q.title, questId:q.id, category:"side", start:st, end:en };
    allMissions.push(legacyDef);
    missionGivers.push({ x:startPx.x, y:startPx.y, endX:endPx.x, endY:endPx.y, type:mDef.type, mission:legacyDef, questId:q.id, category:"side", taken:false, order:idx, title:q.title, desc:q.desc, icon:mDef.icon });
    questStatus.set(q.id, "available");
  });
  // Keep sequential index for mains
  setMainQuestIndex(0);
}

export function getActiveMissionGiver() {
  // For backward compat: return the currently available main quest's giver (yellow)
  if (mainQuests.length===0 && sideQuests.length===0) {
    if (!usingSequentialMissions) return null;
    if (sequentialMissionIndex >= missionGivers.length) return null;
    const mg = missionGivers[sequentialMissionIndex];
    return mg && !mg.taken ? mg : null;
  }
  if (mainQuests.length>0){
    const idx = mainQuestIndex;
    if(idx>=mainQuests.length) return null;
    const q=mainQuests[idx];
    const status = questStatus.get(q.id);
    if(status!=="available") return null;
    // also if there's an active mission, don't show giver (already captured)
    if(activeQuestId) return null;
    // find giver
    const mg=missionGivers.find(g=>g.questId===q.id);
    return mg && !mg.taken ? mg : null;
  }
  return null;
}

// New helpers for renderer/minimap/HUD
export function getVisibleStartGivers(){
  const list=[];
  // Main: only one yellow at a time (next available)
  if(mainQuests.length>0){
    const q=mainQuests[mainQuestIndex];
    if(q && questStatus.get(q.id)==="available" && !activeQuestId){
      const mg=missionGivers.find(g=>g.questId===q.id && !g.completed);
      if(mg) list.push(mg);
    }
  } else if(usingSequentialMissions){
    const ag=getActiveMissionGiver();
    if(ag) list.push(ag);
  }
  // Sides: all purple dots available (and not active/completed)
  sideQuests.forEach(q=>{
    if(questStatus.get(q.id)==="available" && q.id!==activeQuestId){
      const mg=missionGivers.find(g=>g.questId===q.id && !g.completed);
      if(mg) list.push(mg);
    }
  });
  // Fallback if no quest system but legacy random (usingSequentialMissions false)
  if(list.length===0 && !hasQuestSystem()){
    missionGivers.filter(mg=>!mg.taken && !mg.completed).forEach(mg=>list.push(mg));
  }
  return list;
}
function hasQuestSystem(){ return quests.length>0; }
export function getActiveEndGiver(){
  if(!activeQuestId || !currentMission) return null;
  const q = getQuestById(activeQuestId);
  if(!q) return null;
  // Quests have no turn-in trip: the end marker only exists while a stage the
  // player still has to travel to is pending. Quests finished on the spot
  // (kill, steal, talk...) resolve automatically and show no marker.
  const end = currentMission.data && currentMission.data.questEnd;
  if(!end || typeof end.x !== "number") return null;
  return { x: end.x, y: end.y, questId:q.id, category:q.category };
}
export function getQuestByIdForSystem(id){
  return quests.find(q=>q.id===id) || getQuestById(id) || null;
}

// ============================================================================
// QUEST ACCEPTANCE
// The player accepts a quest by pressing the enter/exit key (E) while standing
// next to its marker. That opens the accept screen: the quest artwork fills the
// screen with the intro dialogue at the bottom, and only when the artwork fades
// away is the quest officially received (the mission actually starts).
// ============================================================================

/** How close the player must stand to a marker to be offered its quest. */
export const QUEST_ACCEPT_RADIUS = 80;

/** The marker the player is currently standing next to (drives the prompt). */
let nearbyOffer = null;
/** True while the accept screen is up - blocks re-entry and mission start. */
let acceptInProgress = false;

export function setQuestOfferTarget(mg){ nearbyOffer = mg || null; }
export function getNearbyQuestOffer(){ return nearbyOffer; }
export function isAcceptingQuest(){ return acceptInProgress; }

/** Every marker the player could accept right now. */
function availableGiverList(){
  if(quests.length>0) return getVisibleStartGivers();
  if(usingSequentialMissions){
    const ag=getActiveMissionGiver();
    return ag ? [ag] : [];
  }
  return missionGivers.filter(mg=>!mg.taken && !mg.completed);
}

/** Nearest available marker inside interaction range, or null. */
export function getQuestOfferTarget(){
  // On foot only: E next to a vehicle is enter/exit, never "accept".
  if(currentMission || acceptInProgress || !player || player.inVehicle) return null;
  let best=null, bestDist=Infinity;
  for(const mg of availableGiverList()){
    if(!mg || mg.taken || mg.completed) continue;
    const d=Math.hypot(player.x-mg.x, player.y-mg.y);
    if(d<=QUEST_ACCEPT_RADIUS && d<bestDist){ best=mg; bestDist=d; }
  }
  return best;
}

/**
 * Refresh the cached "marker in range" state. Call once per frame; when it
 * changes the HUD prompt is rebuilt so it can say "press E to accept".
 */
export function updateQuestOffer(){
  const mg = getQuestOfferTarget();
  const changed = (mg||null) !== (nearbyOffer||null);
  nearbyOffer = mg || null;
  if(changed){ try { updateMissionUI(); } catch(e){} }
}

/** Authored intro lines for a quest, normalised for the accept screen. */
function questIntroLines(quest){
  if(!quest) return [];
  const def = getQuestDef(quest.id);
  let src = (def && Array.isArray(def.intro) && def.intro.length) ? def.intro : null;
  if(!src){
    // No authored intro: fall back to the quest description so the dialogue
    // section is never empty.
    const d = qDesc(quest);
    if(d) src = [{ ar:d, en:d, roleAr:"", roleEn:"" }];
  }
  if(!Array.isArray(src)) return [];
  return src
    .filter(m => m && typeof m === "object")
    .map(m => ({
      ar: String(m.ar || "").trim(),
      en: String(m.en || "").trim(),
      roleAr: String(m.roleAr || m.speakerAr || "").trim(),
      roleEn: String(m.roleEn || m.speakerEn || "").trim(),
    }))
    .filter(m => m.ar || m.en);
}

/**
 * Open the accept screen for a marker the player is standing next to.
 * The quest only becomes active once the artwork has faded out.
 * @returns {boolean} true when the sequence was started (the key press is consumed).
 */
export function acceptQuestOffer(mg){
  if(!mg || currentMission || acceptInProgress) return false;
  if(!player || player.inVehicle) return false;
  const quest = mg.questId ? (quests.find(q=>q.id===mg.questId) || getQuestById(mg.questId)) : null;
  if(quest){
    const status = questStatus.get(quest.id);
    if(status && status!=="available") return false;
  }
  const id = quest ? quest.id : (mg.questId || mg.type);
  const title = quest ? qTitle(quest) : ((mg.mission && mg.mission.name) || "");
  const reward = (mg.mission && typeof mg.mission.reward === "number")
    ? mg.mission.reward
    : (typeof mg.reward === "number" ? mg.reward : 0);
  const icon = mg.icon || (quest && quest.icon) || "⭐";

  acceptInProgress = true;
  setQuestOfferTarget(null);

  showQuestAccept({
    id,
    icon,
    title,
    reward,
    category: (quest ? quest.category : mg.category) || "main",
    art: getQuestImage({ id, icon, type: quest ? quest.type : mg.type, image: quest ? quest.image : undefined }),
    lines: questIntroLines(quest),
  }, () => {
    // The image is gone: the quest is now officially the player's.
    acceptInProgress = false;
    setQuestOfferTarget(null);
    if(mg.questId) startMission(mg.questId, { introPlayed: true });
    else startMission(mg.type, { introPlayed: true });
  });
  return true;
}

/**
 * Put a quest into play. Normally reached through acceptQuestOffer(), which
 * waits for the accept screen first and then calls this with introPlayed:true.
 */
export function startMission(typeOrId, opts = {}) {
  if (currentMission) return;
  // First try to find quest by id
  let quest = null;
  let mDef = null;
  // Search by questId
  if (quests.length>0){
    quest = quests.find(q=>q.id===typeOrId) || null;
    if(quest){
      mDef = allMissions.find(m=>m.questId===quest.id) || { name:qTitle(quest), desc:qDesc(quest), icon:quest.icon, type:quest.type, reward:quest.reward, title:quest.title, questId:quest.id, category:quest.category, start:quest.start, end:quest.end };
    }
  }
  // Fallback search by type (legacy)
  if(!mDef){
    mDef = allMissions.find((m) => m.type === typeOrId);
    if(mDef && mDef.questId){
      quest = quests.find(q=>q.id===mDef.questId) || null;
    }
  }
  if (!mDef) return;
  // If quest found, check availability
  if(quest){
    const status = questStatus.get(quest.id);
    if(status!=="available") return;
  }

  const cm = {
    type: mDef.type,
    name: mDef.name || qTitle(quest || {type:mDef.type, icon:mDef.icon}),
    desc: mDef.desc || qDesc(quest || {type:mDef.type}),
    reward: mDef.reward,
    stage: 0,
    stages: [],
    completed: false,
    failed: false,
    timer: 0,
    data: {},
    questId: mDef.questId || null,
    category: mDef.category || (quest?quest.category:"main"),
    title: mDef.title || (quest?quest.title:{ar:mDef.name,en:mDef.name}),
    icon: mDef.icon || (quest?quest.icon:"⭐"),
    quest: quest || null
  };
  setCurrentMission(cm);
  if(quest){
    setActiveQuestId(quest.id);
    questStatus.set(quest.id, "active");
    // mark giver taken
    const mg=missionGivers.find(g=>g.questId===quest.id);
    if(mg) mg.taken=true;
  } else {
    // legacy giver taken handling (find by type first not taken)
    const mg=missionGivers.find(g=>g.type===mDef.type && !g.taken);
    if(mg) mg.taken=true;
  }

  setupMissionStages(cm);
  if (cm.failed) {
    const reason = cm.failReason || (lang()==="en" ? "Failed to setup mission" : "فشل في إعداد المهمة");
    failMission(reason);
    return;
  }
  updateMissionUI();
  const displayName = quest ? qTitle(quest) : cm.name;
  showNotification(lang()==="en" ? `🚀 Started: ${displayName}` : `🚀 بدء مهمة: ${displayName}`);
  // Story layer: play the authored intro cutscene for main quests.
  // The accept screen already showed those lines, so they are skipped there.
  if (mDef.questId) {
    try { storyOnQuestStarted(mDef.questId, { alreadyPlayed: !!opts.introPlayed }); } catch (e) { console.warn("[story] intro failed", e); }
  }
}

export function getWalkableTile() {
  for (let attempt = 0; attempt < 50; attempt++) {
    const tx = 2 + Math.floor(Math.random() * (CFG.COLS - 6));
    const ty = 2 + Math.floor(Math.random() * (CFG.ROWS - 6));
    const px = tx * CFG.TILE + CFG.TILE / 2;
    const py = ty * CFG.TILE + CFG.TILE / 2;
    if (isWalkable(px, py))
      return {
        x: px,
        y: py,
      };
  }
  return {
    x: 20 * CFG.TILE + CFG.TILE / 2,
    y: 20 * CFG.TILE + CFG.TILE / 2,
  };
}

export function setupMissionStages(mission) {
  // New 5 quest types only
  // All quests use two-point (start→end) where end is editor-defined drop-off.
  // Quest content after capturing first point is displayed in HUD via updateMissionUI.
  const questEnd = (()=> {
    if(mission.quest && mission.quest.end) return {x: mission.quest.end.x*CFG.TILE+CFG.TILE/2, y: mission.quest.end.y*CFG.TILE+CFG.TILE/2};
    if(mission.questId){
      const mg=missionGivers.find(g=>g.questId===mission.questId);
      if(mg && mg.endX) return {x: mg.endX, y: mg.endY};
    }
    return null;
  })();
  const questStartPixel = (()=> {
    if(mission.quest && mission.quest.start) return {x: mission.quest.start.x*CFG.TILE+CFG.TILE/2, y: mission.quest.start.y*CFG.TILE+CFG.TILE/2};
    return null;
  })();
  // Helper to get editor-defined end with walkable correction
  function getQuestDropOff(){
    if(!questEnd) return getWalkableTile();
    let fx=questEnd.x, fy=questEnd.y;
    if(!isWalkable(fx,fy)){
      const near=findNearestWalkableForQuest(mission.quest ? mission.quest.end.x : Math.floor(fx/CFG.TILE), mission.quest ? mission.quest.end.y : Math.floor(fy/CFG.TILE));
      if(near){ fx=near.x; fy=near.y; }
    }
    return {x:fx,y:fy};
  }
  switch (mission.type) {
    case "deliverShipment": {
      const drop = getQuestDropOff();
      mission.stages.push({
        type: "dropoff",
        x: drop.x, y: drop.y,
        label: "سلّم الشحنة إلى الموقع المحدد",
        labelEn: "Deliver shipment to marked location",
        done: false,
        radius: 50
      });
      break;
    }
    case "silentPursuit": {
      // Follow a car maintaining ideal distance (3 squares), suspicion depends on distance, 5s grace, slower fill
      let targetVehicle = null;
      for(const v of vehicles){ if(!v.isPolice && !v.occupied){ targetVehicle=v; break; } }
      if(!targetVehicle){
        // spawn a temp target car near quest start
        const sx = mission.quest ? mission.quest.start.x*CFG.TILE+CFG.TILE/2 : player.x+120;
        const sy = mission.quest ? mission.quest.start.y*CFG.TILE+CFG.TILE/2 : player.y;
        // create a dummy target vehicle object
        targetVehicle = { x:sx, y:sy, vx:0, vy:0, angle:0, w:32, h:16, type:{name:"Target Car", accel:0.2, speed:2.5}, isPolice:false, occupied:false, isSilentTarget:true };
        vehicles.push(targetVehicle);
      }
      targetVehicle.scripted = true;
      const tid = vehicles.indexOf(targetVehicle);
      mission.data.silentTargetId = tid;
      mission.data.silentTarget = targetVehicle;
      mission.data.suspicion = 0;
      mission.data.followDuration = 30000;
      mission.data.followTimer = 0;
      // Ideal distance 3 squares (288px), with small tolerance band
      mission.data.idealDist = 3 * CFG.TILE;
      mission.data.tolerance = CFG.TILE * 0.4; // ~38px safe band around ideal
      mission.data.minDist = mission.data.idealDist - mission.data.tolerance;
      mission.data.maxDist = mission.data.idealDist + mission.data.tolerance;
      mission.data.graceDuration = 5000; // 5s to find target
      mission.data.suspicionRateDivisor = 1.5; // slow down fill rate
      // Make target move slowly in a loop
      targetVehicle.vx = Math.cos(Math.random()*Math.PI*2)*1.2;
      targetVehicle.vy = Math.sin(Math.random()*Math.PI*2)*1.2;
      mission.stages.push({
        type: "follow",
        label: "تتبع السيارة بصمت",
        labelEn: "Follow car silently",
        done:false,
        targetVehicleId: tid,
        duration: 30000
      });
      break;
    }
    case "surveillance": {
      const center = questStartPixel || getWalkableTile();
      const cx = center.x, cy = center.y;
      mission.data.surveillanceCenter = {x:cx, y:cy};
      mission.data.surveillanceRadius = 110;
      mission.data.surveillanceTime = 0;
      mission.data.surveillanceDuration = 30000;
      mission.data.surveillanceStartWanted = player.wanted;
      mission.stages.push({
        type: "surveillance",
        x: cx, y: cy,
        label: "ابق داخل الدائرة 30 ثانية دون قتل أو شرطة",
        labelEn: "Stay inside circle 30s, no kills, no police",
        done:false,
        radius: 110,
        duration: 30000
      });
      break;
    }
    case "plantBomb": {
      const plantPos = questStartPixel || getWalkableTile();
      const drop = getQuestDropOff();
      mission.data.plantPos = {x: plantPos.x, y: plantPos.y};
      mission.data.plantPlanted = false;
      mission.data.plantHold = 0;
      mission.stages.push({
        type: "plantBomb",
        x: plantPos.x, y: plantPos.y,
        label: "ازرع القنبلة (ثبت E)",
        labelEn: "Plant bomb (hold E)",
        done:false,
        radius: 50
      });
      // Hand-off step: dropped below, the quest closes once the bomb is planted.
      mission.stages.push({
        type: "dropoff",
        x: drop.x, y: drop.y,
        label: "اهرب إلى خط النهاية",
        labelEn: "Escape to finish line",
        done:false,
        radius: 55,
        isTurnIn: true
      });
      break;
    }
    case "meeting": {
      const meetPos = questStartPixel || getWalkableTile();
      const drop = getQuestDropOff();
      const q = mission.quest;
      // Resolve bilingual messages array (supports legacy single)
      let meetingMessages = getMeetingMessagesFromQuest(q);
      if (!meetingMessages || !meetingMessages.length) {
        meetingMessages = [{ ar: "أهلاً. لديّ معلومات تهمك.", en: "Hello. I have information you will want.", roleAr: "", roleEn: "" }];
      }
      meetingMessages = meetingMessages.map(m=> ({
        ar: String(m.ar || "").trim() || "مرحباً",
        en: String(m.en || "").trim() || "Hello",
        roleAr: String(m.roleAr || "").trim(),
        roleEn: String(m.roleEn || "").trim()
      }));
      mission.data.meetingPos = {x: meetPos.x, y: meetPos.y};
      mission.data.meetingMessages = meetingMessages;
      mission.data.meetingIndex = 0;
      mission.data.meetingDone = false;
      // Keep legacy first-message fields for backward compat
      mission.data.meetingMsgAr = meetingMessages[0].ar;
      mission.data.meetingMsgEn = meetingMessages[0].en;
      mission.data.meetingRoleAr = meetingMessages[0].roleAr;
      mission.data.meetingRoleEn = meetingMessages[0].roleEn;
      // Spawn NPC for meeting (show first speaker role if available)
      const first = meetingMessages[0];
      const npcMeet = {
        x: meetPos.x + (Math.random()-0.5)*10,
        y: meetPos.y + (Math.random()-0.5)*10,
        angle: 0,
        speed: 0.2,
        type: "civilian",
        color: "#ffd700",
        size: 12,
        health: 999,
        maxHealth: 999,
        isMeetingNpc: true,
        questId: q ? q.id : mission.questId,
        meetingAr: first.ar,
        meetingEn: first.en,
        meetingRoleAr: first.roleAr,
        meetingRoleEn: first.roleEn,
        meetingMessages
      };
      npcs.push(npcMeet);
      mission.data.meetingNpc = npcMeet;
      mission.stages.push({
        type: "meeting",
        x: meetPos.x, y: meetPos.y,
        label: meetingMessages.length > 1 ? `تحدث إلى الشخص (${meetingMessages.length} رسائل)` : "تحدث إلى الشخص (اضغط E)",
        labelEn: meetingMessages.length > 1 ? `Talk to contact (${meetingMessages.length} messages)` : "Talk to contact (press E)",
        done:false,
        radius: 55
      });
      // Hand-off step: dropped below, the quest closes once the talk is done.
      mission.stages.push({
        type: "dropoff",
        x: drop.x, y: drop.y,
        label: "اذهب إلى خط النهاية",
        labelEn: "Go to finish line",
        done:false,
        radius: 50,
        isTurnIn: true
      });
      break;
    }
    case "theft": {
      const theftPos = questStartPixel || getWalkableTile();
      const drop = getQuestDropOff();
      const q = mission.quest;
      let _rawItem = (q && q.params && q.params.itemName) || q.itemName || "غرض مسروق";
      const itemName = (typeof _rawItem === "object" && _rawItem) ? (_rawItem.en || _rawItem.ar || "غرض مسروق") : String(_rawItem);
      mission.data.theftPos = {x: theftPos.x, y: theftPos.y};
      mission.data.theftItem = itemName;
      mission.data.theftHold = 0;
      mission.data.theftDuration = 20000;
      mission.data.suspicion = 0;
      mission.data.theftDelivered = false;
      mission.stages.push({
        type: "theft",
        x: theftPos.x, y: theftPos.y,
        label: `اسرق "${itemName}" (ثبّت المسافة)`,
        labelEn: `Steal "${itemName}" (hold Space)`,
        done:false,
        radius: 60,
        itemName: itemName
      });
      // Hand-off step: dropped below, the quest closes once the item is taken.
      mission.stages.push({
        type: "dropoff",
        x: drop.x, y: drop.y,
        label: `سلّم "${itemName}"`,
        labelEn: `Deliver "${itemName}"`,
        done:false,
        radius: 50,
        requiresItem: itemName,
        isTurnIn: true
      });
      break;
    }
    case "deliverLoot": {
      const checkPos = questStartPixel || getWalkableTile();
      const drop = getQuestDropOff();
      const q2 = mission.quest;
       let _rawItem2 = (q2 && q2.params && q2.params.itemName) || q2.itemName || "غرض";
       const reqItem = (typeof _rawItem2 === "object" && _rawItem2) ? (_rawItem2.en || _rawItem2.ar || "غرض") : String(_rawItem2);
      mission.data.deliverCheckPos = {x: checkPos.x, y: checkPos.y};
       mission.data.requiredItem = reqItem;
       // Grant the required item on accept so the quest is solvable
       try { if (!player.inventory) player.inventory = []; if (!player.inventory.includes(reqItem)) player.inventory.push(reqItem); } catch {}
      mission.stages.push({
        type: "deliverCheck",
        x: checkPos.x, y: checkPos.y,
        label: `تحقق من حمل "${reqItem}"`,
        labelEn: `Check carrying "${reqItem}"`,
        done:false,
        radius: 55,
        requiredItem: reqItem
      });
      // Hand-off step: dropped below, the quest closes once the item is carried.
      if(Math.hypot(drop.x - checkPos.x, drop.y - checkPos.y) > 30){
        mission.stages.push({
          type: "dropoff",
          x: drop.x, y: drop.y,
          label: "اذهب للتسليم النهائي",
          labelEn: "Go to final delivery",
          done:false,
          radius: 50,
          isTurnIn: true
        });
      }
      break;
    }
    case "killTarget": {
      // Spawn 1 gangster target at start area
      const spawnAt = questStartPixel || getWalkableTile();
      mission.data.targetSpawn = {x: spawnAt.x, y: spawnAt.y};
      mission.data.killTarget = 1;
      mission.data.killCount = 0;
      mission.data.targetType = "gang";
      mission.stages.push({
        type: "eliminate",
        label: "اقتل الهدف المحدد (عصابة)",
        labelEn: "Kill the marked gang target",
        done: false,
        killTarget: 1,
        targetKind: "gang"
      });
      // Also create a visual target NPC at spawn location (handled via ensureTargetSpawned below)
      // No extra pickup stage; after kill, generic final dropoff will handle second point if distinct
      break;
    }
    case "transportPerson": {
      // Transport 1 person: spawn civilian at start, pickup then dropoff at editor end
      const pickupPos = questStartPixel || getWalkableTile();
      const drop = getQuestDropOff();
      // Store pickup person location
      mission.data.personPickup = {x: pickupPos.x, y: pickupPos.y};
      mission.data.personPicked = false;
      mission.data.personEntity = null;
      mission.stages.push({
        type: "goto",
        x: pickupPos.x, y: pickupPos.y,
        label: "اذهب إلى الشخص لاصطحابه",
        labelEn: "Go to the person to pick up",
        done: false,
        radius: 45,
        isPickup: true
      });
      mission.stages.push({
        type: "dropoff",
        x: drop.x, y: drop.y,
        label: "انقل الشخص إلى الموقع المحدد",
        labelEn: "Transport person to marked location",
        done: false,
        radius: 50,
        isDropoff: true
      });
      break;
    }
    case "escapeCar": {
      // Police chase immediately until reaching drop-off, no car theft required
      const drop = getQuestDropOff();
      // Trigger police chase immediately (2 stars)
      player.wanted = Math.max(player.wanted, 2);
      player.wantedTimer = 0;
      try { if (typeof updateWantedUI === "function") updateWantedUI(); } catch {}
      showNotification(lang()==="en" ? "🚨 Police chase! Escape to the marked location!" : "🚨 الشرطة تطاردك! اهرب إلى الموقع المحدد!");
      mission.data.escapePos = {x: drop.x, y: drop.y};
      mission.data.escapeStarted = true;
      // Single stage: reach drop-off while being chased (no vehicle theft required)
      mission.stages.push({
        type: "escapeToDropoff",
        x: drop.x, y: drop.y,
        label: "اهرب من الشرطة إلى نقطة التسليم",
        labelEn: "Escape police to drop-off point",
        done: false,
        radius: 55
      });
      break;
    }
    case "stealCar": {
      // Steal any single car (not specific, not 3) and deliver to drop-off
      const drop = getQuestDropOff();
      mission.data.anyVehicle = true;
      mission.data.stealRequired = 1;
      // Remember vehicle at mission start to require stealing a NEW one (not counting already-occupied)
      mission.data.stealStartVehicle = player.inVehicle || null;
      mission.data.stealCount = 0;
      mission.stages.push({
        type: "stealVehicle",
        label: "اسرق أي سيارة (واحدة فقط)",
        labelEn: "Steal any car (just one)",
        done: false,
        anyVehicle: true
      });
      // Hand-off step: dropped below, the quest closes once the car is stolen.
      mission.stages.push({
        type: "dropoff",
        x: drop.x, y: drop.y,
        label: "قد السيارة إلى الموقع المحدد",
        labelEn: "Drive car to marked location",
        done: false,
        radius: 50,
        requiresVehicle: true,
        isTurnIn: true
      });
      break;
    }
    default: {
      // Unknown type -> fallback to single dropoff at end
      const drop = getQuestDropOff();
      mission.stages.push({
        type: "dropoff",
        x: drop.x, y: drop.y,
        label: "اذهب إلى الموقع المحدد",
        labelEn: "Go to marked location",
        done: false
      });
      break;
    }
  }
  // Helper to spawn quest NPCs immediately after stages are defined
  // For killTarget: spawn a gang target at start; for transportPerson: spawn civilian at pickup
  try { ensureQuestNpcSpawn(mission); } catch(e){ console.warn("ensureQuestNpcSpawn failed", e); }
  // ── No turn-in trip ──────────────────────────────────────────────────────
  // Stages flagged isTurnIn are pure hand-off steps ("carry it over there to
  // finish"). They are removed here, so the quest closes by itself the moment
  // its requirements are met instead of sending the player to a finish spot.
  // If a quest were nothing but hand-off steps it keeps them - it always needs
  // at least one requirement to satisfy.
  // Keep hand-off (isTurnIn) stages so delivery/escape legs remain playable.
  // (Previously these were stripped, deleting the payoff leg of theft/stealCar/plantBomb/meeting.)
  // The green end marker follows the kept stage the player still has to travel
  // to (delivery / escape targets). Quests fulfilled on the spot show none.
  const keptLast = mission.stages[mission.stages.length-1];
  if(keptLast && (keptLast.type==="dropoff" || keptLast.type==="escapeToDropoff")){
    if(keptLast.type==="dropoff") keptLast.isQuestEnd = true;
    mission.data.questEnd = {x:keptLast.x, y:keptLast.y};
  }
}

function ensureQuestNpcSpawn(mission){
  if(!mission || !mission.quest) return;
  const q=mission.quest;
  if(mission.type==="killTarget"){
    // Avoid duplicate spawn if already exists for this quest
    const exists = npcs.some(n=> n.isQuestTarget && n.questId===q.id);
    if(exists) return;
    const sx = q.start.x*CFG.TILE+CFG.TILE/2;
    const sy = q.start.y*CFG.TILE+CFG.TILE/2;
    // Spawn 2-3 tiles away so the target is not at the player's elbow
    const ang = Math.random()*Math.PI*2;
    const distTiles = 2 + Math.random();
    let px = sx + Math.cos(ang)*distTiles*CFG.TILE;
    let py = sy + Math.sin(ang)*distTiles*CFG.TILE;
    // Find walkable near target spot
    const tx = Math.floor(px/CFG.TILE), ty = Math.floor(py/CFG.TILE);
    const near = findNearestWalkableForQuest(tx, ty);
    if(near){ px = near.x; py = near.y; }
    else if(!isWalkable(px,py)){
      const near2 = findNearestWalkableForQuest(q.start.x, q.start.y);
      if(near2){ px = near2.x + 2*CFG.TILE; py = near2.y; }
    }
    // Create gang target (killable, 1 hit = 40 health)
    const npc = {
      x: px, y: py,
      angle: Math.random()*Math.PI*2,
      speed: 0.6,
      type: "gang",
      color: "#ff3366",
      size: 13,
      health: 40,
      maxHealth: 40,
      isQuestTarget: true,
      questId: q.id,
      targetFor: "killTarget",
      timer: 0,
      targetX: px,
      targetY: py,
      chaseTimer: 0
    };
    npcs.push(npc);
    mission.data.targetNpc = npc;
    showNotification(lang()==="en" ? "💀 Target gangster appeared on the map!" : "💀 ظهر هدف العصابة على الخريطة!");
  } else if(mission.type==="transportPerson"){
    const exists = npcs.some(n=> n.isQuestPerson && n.questId===q.id);
    if(exists) return;
    const px = mission.data.personPickup ? mission.data.personPickup.x : (q.start.x*CFG.TILE+CFG.TILE/2);
    const py = mission.data.personPickup ? mission.data.personPickup.y : (q.start.y*CFG.TILE+CFG.TILE/2);
    const npc = {
      x: px, y: py,
      angle: 0,
      speed: 0.2, // stays put
      type: "civilian",
      color: "#44ffaa",
      size: 11,
      health: 999,
      maxHealth: 999,
      isQuestPerson: true,
      questId: q.id,
      isPickupTarget: true
    };
    npcs.push(npc);
    mission.data.personEntity = npc;
    showNotification(lang()==="en" ? "👤 Person waiting at marked location" : "👤 الشخص بانتظارك في الموقع المحدد");
  }
}

function findNearestWalkableForQuest(tx,ty){
  const walkable = new Set([T.ROAD, T.SIDEWALK, T.PAVEMENT, T.PARK, T.PARKING]);
  for(let r=1;r<=8;r++){
    for(let dx=-r;dx<=r;dx++) for(let dy of [-r, r]){
      const nx=tx+dx, ny=ty+dy;
      if(nx<0||nx>=CFG.COLS||ny<0||ny>=CFG.ROWS) continue;
      const px=nx*CFG.TILE+CFG.TILE/2, py=ny*CFG.TILE+CFG.TILE/2;
      if(isWalkable(px,py)) return {x:px,y:py};
    }
    for(let dy=-r+1; dy<=r-1; dy++) for(let dx of [-r, r]){
      const nx=tx+dx, ny=ty+dy;
      if(nx<0||nx>=CFG.COLS||ny<0||ny>=CFG.ROWS) continue;
      const px=nx*CFG.TILE+CFG.TILE/2, py=ny*CFG.TILE+CFG.TILE/2;
      if(isWalkable(px,py)) return {x:px,y:py};
    }
  }
  return null;
}

export function updateMission() {
  if (!currentMission || currentMission.completed || currentMission.failed)
    return;

  const m = currentMission;

  // Bomb countdown for plantBomb after planting (bomb_explotion.mp3)
  if (m.type === "plantBomb" && m.data.plantPlanted && !m.data.bombExploded) {
    if (typeof m.data.bombTimer !== "number") m.data.bombTimer = 3500;
    m.data.bombTimer -= 16;
    if (m.data.bombTimer <= 0) {
      m.data.bombExploded = true;
      try { playBombExplosion(); } catch {}
      showNotification(lang()==="en" ? "💥 BOOM! Bomb exploded!" : "💥 انفجرت القنبلة!");
      // Visual explosion at plant position if available
      try {
        const bx = m.data.plantPos ? m.data.plantPos.x : (m.stages[0] ? m.stages[0].x : player.x);
        const by = m.data.plantPos ? m.data.plantPos.y : (m.stages[0] ? m.stages[0].y : player.y);
        explosions.push({ x: bx, y: by, t: 0, duration: EXPLOSION_DURATION || 900, vehicle: { x: bx, y: by } });
      } catch {}
    }
  }

  // Timer for timed missions
  if (m.timer > 0) {
    m.timer -= 16;
    if (m.timer <= 0) {
      failMission(lang()==="en" ? "Time's up!" : "انتهى الوقت!");
      return;
    }
  }

  // Check current stage
  const stage = m.stages[m.stage];
  if (!stage) {
    completeMission();
    return;
  }

  const px = player.x;
  const py = player.y;

  switch (stage.type) {
    case "goto":
    case "checkpoint":
    case "collect": {
      const dist = Math.hypot(px - stage.x, py - stage.y);
      const radius = stage.radius || 50;
      if (dist < radius) {
        if(stage.isPickup && m.type==="transportPerson"){
          const idx = npcs.findIndex(n=> n.isQuestPerson && n.questId===m.questId);
          if(idx>=0){ npcs.splice(idx,1); }
          m.data.personPicked = true;
          showNotification(lang()==="en" ? "👤 Person picked up! Now transport them." : "👤 تم اصطحاب الشخص! انقله الآن.");
        }
        stage.done = true;
        if (stage.type === "collect") stage.collected = true;
        advanceStage();
      }
      break;
    }
    case "escape": {
      if (player.wanted > 0) {
        stage.timer = (stage.timer || 0) + 16;
        if (stage.timer >= stage.duration) {
          stage.done = true;
          advanceStage();
        }
      }
      break;
    }
    case "escapeToDropoff": {
      // Police chase until reaching drop-off, no car theft required
      // Keep wanted level active (re-trigger if lost)
      if (player.wanted <= 0) {
        player.wanted = Math.max(player.wanted, 1);
        try { if (typeof updateWantedUI === "function") updateWantedUI(); } catch {}
      }
      const dist = Math.hypot(px - stage.x, py - stage.y);
      const needRadius = stage.radius || 55;
      if (dist < needRadius) {
        stage.done = true;
        advanceStage();
      }
      break;
    }
    case "chase": {
      const t = m.data.chaseTarget;
      if (t) {
        const dist = Math.hypot(px - t.x, py - t.y);
        if (dist < stage.radius) {
          stage.done = true;
          advanceStage();
        }
        // Move chase target away
        t.angle = Math.atan2(py - t.y, px - t.x);
        t.x -= Math.cos(t.angle) * t.speed;
        t.y -= Math.sin(t.angle) * t.speed;
      }
      break;
    }
    case "protect": {
      stage.timer = (stage.timer || 0) + 16;
      if (stage.timer >= stage.duration) {
        stage.done = true;
        advanceStage();
      }
      break;
    }
    case "dropoff": {
      if(stage.requiresVehicle && !player.inVehicle){
        break;
      }
      if(m.type==="transportPerson" && !m.data.personPicked){
        break;
      }
      const dist = Math.hypot(px - stage.x, py - stage.y);
      const needRadius = stage.radius || 50;
      if (dist < needRadius) {
        stage.done = true;
        advanceStage();
      }
      break;
    }
    case "approachVehicle": {
      const vehicleId = stage.targetVehicleId;
      const vehicle = vehicles[vehicleId];
      if (!vehicle) {
        failMission(lang()==="en" ? "Target car gone" : "السيارة المستهدفة لم تعد موجودة");
        return;
      }
      if (vehicle.occupied && vehicle.driver !== player) {
        failMission(lang()==="en" ? "Someone else got to the car first!" : "سبقك أحدهم إلى السيارة!");
        return;
      }
      const dist = Math.hypot(player.x - vehicle.x, player.y - vehicle.y);
      const radius = stage.radius || 50;
      if (dist < radius) {
        stage.done = true;
        advanceStage();
      }
      break;
    }
    case "stealVehicle": {
      if(stage.anyVehicle){
        // Require any non-police vehicle different from start (single, not 3)
        const startVeh = m.data.stealStartVehicle;
        if(player.inVehicle && !player.inVehicle.isPolice && player.inVehicle !== startVeh){
          stage.done = true;
          m.data.stealCount = (m.data.stealCount || 0) + 1;
          advanceStage();
        }
        break;
      }
      const vehicleId = stage.targetVehicleId;
      const vehicle = vehicles[vehicleId];
      if (!vehicle) {
        failMission(lang()==="en" ? "Target car gone" : "السيارة المستهدفة لم تعد موجودة");
        return;
      }
      if (player.inVehicle === vehicle) {
        stage.done = true;
        advanceStage();
      }
      break;
    }
    case "eliminate": {
      const kills = m.data.killCount || 0;
      const target = stage.killTarget || 1;
      if (kills >= target) {
        stage.done = true;
        // Clean up any remaining quest target NPCs
        if(m.type==="killTarget"){
          // remove any leftover target NPC for this quest
          for(let i=npcs.length-1;i>=0;i--){
            if(npcs[i].isQuestTarget && npcs[i].questId===m.questId) npcs.splice(i,1);
          }
        }
        advanceStage();
      }
      break;
    }
    case "follow": {
      const veh = m.data.silentTarget;
      if(!veh || !vehicles.includes(veh)){
        failMission(lang()==="en" ? "Target car lost" : "ضاعت السيارة الهدف");
        break;
      }
      veh.scripted = true;
      // Move target car along a simple road-aware patrol
      if(!veh.vx && !veh.vy){
        veh.vx = Math.cos(Date.now()/2000)*1.2;
        veh.vy = Math.sin(Date.now()/2000)*1.2;
      } else {
        veh.vx += (Math.random()-0.5)*0.05;
        veh.vy += (Math.random()-0.5)*0.05;
        const sp = Math.hypot(veh.vx, veh.vy);
        const maxSp = 1.8;
        if(sp > maxSp){ veh.vx = veh.vx/sp*maxSp; veh.vy = veh.vy/sp*maxSp; }
      }
      if(isWalkable(veh.x + veh.vx*2, veh.y + veh.vy*2)){
        veh.x += veh.vx; veh.y += veh.vy;
        veh.angle = Math.atan2(veh.vy, veh.vx);
        veh.moveAngle = veh.angle;
      } else {
        veh.vx *= -1; veh.vy *= -1;
      }
      const dist = Math.hypot(player.x - veh.x, player.y - veh.y);
      const idealDist = m.data.idealDist || (3 * CFG.TILE);
      const grace = m.data.graceDuration || 5000;
      const divisor = m.data.suspicionRateDivisor || 1.5;
      const elapsed = m.data.followTimer || 0;
      let suspicionDelta = 0;
      if(elapsed < grace){
        // Grace period: 5s to find target, bar stays empty / recovers quickly
        suspicionDelta = -0.6;
      } else {
        // Center is ideal (288px = 3 tiles): closer → bar increases, farther → bar decreases (distance-proportional, slowed 1.5x)
        if(dist < idealDist){
          const closeness = (idealDist - dist) / idealDist; // 0..1
          suspicionDelta = closeness * 0.9 / divisor * 2.2;
          if(suspicionDelta < 0.02) suspicionDelta = 0.02;
        } else if(dist > idealDist){
          const farness = (dist - idealDist) / idealDist; // 0..1+
          suspicionDelta = -farness * 0.7 / divisor * 2.2;
          // Cap recovery speed
          if(suspicionDelta < -0.5) suspicionDelta = -0.5;
        } else {
          suspicionDelta = 0;
        }
      }
      m.data.suspicion = Math.max(0, Math.min(100, (m.data.suspicion||0) + suspicionDelta));
      // Update HUD - pass ideal as center
      try { if(typeof updateSuspicionUI==="function") updateSuspicionUI(m.data.suspicion, dist, idealDist, idealDist); } catch{}
      // Fail if suspicion max (ignore during grace)
      if(m.data.suspicion >= 100 && elapsed >= grace){
        failMission(lang()==="en" ? "You were detected! Too close!" : "تم كشفك! اقتربت كثيراً!");
        break;
      }
      m.data.followTimer = elapsed + 16;
      if(m.data.followTimer >= (stage.duration||30000)){
        stage.done = true;
        // cleanup suspicion
        m.data.suspicion = 0;
        try{ updateSuspicionUI(0); }catch{}
        advanceStage();
      }
      break;
    }
    case "surveillance": {
      const center = m.data.surveillanceCenter;
      if(!center) break;
      const dist = Math.hypot(player.x - center.x, player.y - center.y);
      const radius = stage.radius || 110;
      if(dist > radius){
        failMission(lang()==="en" ? "Left surveillance area" : "غادرت منطقة المراقبة");
        break;
      }
      if(player.wanted > 0){
        failMission(lang()==="en" ? "Police alerted! No stars allowed." : "تم تنبيه الشرطة! لا يسمح بالنجوم.");
        break;
      }
      // Check if any kill happened during surveillance (use flag set by killNPC)
      if(m.data.surveillanceKilled){
        failMission(lang()==="en" ? "Killing not allowed during surveillance" : "القتل ممنوع أثناء المراقبة");
        break;
      }
      m.data.surveillanceTime = (m.data.surveillanceTime||0) + 16;
      // Update progress text via missionProg
      if(m.data.surveillanceTime >= (stage.duration||30000)){
        stage.done = true;
        advanceStage();
      }
      break;
    }
    case "plantBomb": {
      const dist = Math.hypot(player.x - stage.x, player.y - stage.y);
      if(dist > (stage.radius||50)) break;
      // Require holding E (enterExit) to plant
      const holding = (typeof actionHeld==="function" ? actionHeld("enterExit") : false) || (typeof keys!=="undefined" && (keys["e"]||keys["E"]));
      // Also support Space as alternative
      const spaceHeld = (typeof keys!=="undefined" && (keys[" "]||keys["Space"]||keys["space"]));
      const isHolding = holding || spaceHeld;
      if(isHolding){
        m.data.plantHold = (m.data.plantHold||0) + 16;
        if(m.data.plantHold >= 3000){
          stage.done = true;
          m.data.plantPlanted = true;
          m.data.bombTimer = 3500;
          m.data.bombExploded = false;
          showNotification(lang()==="en" ? "💣 Bomb planted! Escape!" : "💣 تم زرع القنبلة! اهرب!");
          // Optional explosion timer visual? Not needed
          advanceStage();
        }
      } else {
        // Reset if released? For plant, we can keep progress but slowly decay
        if(m.data.plantHold>0) m.data.plantHold = Math.max(0, m.data.plantHold - 32);
      }
      break;
    }
    case "meeting": {
      const dist = Math.hypot(player.x - stage.x, player.y - stage.y);
      if(dist > (stage.radius||55)) break;
      // If meeting dialog is active, wait for it to complete via update.js handling (prevents double advance)
      if(isMeetingActive()){
        break;
      }
      // Require pressing E to start meeting - multi-message dialogue
      // Don't start if in vehicle (similar to chat)
      if(player.inVehicle) break;
      const justPressed = (typeof actionJust==="function" ? actionJust("enterExit") : false);
      if(justPressed){
        // Resolve messages (prefer runtime data, fallback to quest/NPC)
        let msgs = m.data.meetingMessages;
        if (!Array.isArray(msgs) || !msgs.length) {
          const q = m.quest;
          // Try quest first, then NPC's stored messages
          let fallback = getMeetingMessagesFromQuest(q);
          if (!fallback && m.data.meetingNpc && Array.isArray(m.data.meetingNpc.meetingMessages)) {
            fallback = m.data.meetingNpc.meetingMessages;
          }
          if (!fallback) {
            fallback = getMeetingMessagesFromQuest({ params: m.data, meetingAr: m.data.meetingMsgAr, meetingEn: m.data.meetingMsgEn });
          }
          msgs = fallback || [{ ar: m.data.meetingMsgAr || "مرحباً", en: m.data.meetingMsgEn || "Hello", roleAr: m.data.meetingRoleAr || "", roleEn: m.data.meetingRoleEn || "" }];
          m.data.meetingMessages = msgs;
        }
        // Normalize messages format for meeting dialog
        const normalizedMsgs = msgs.map(entry => ({
          ar: String(entry.ar || "").trim() || "مرحباً",
          en: String(entry.en || "").trim() || "Hello",
          roleAr: String(entry.roleAr || "").trim(),
          roleEn: String(entry.roleEn || "").trim()
        })).filter(m => m.ar || m.en);
        // Start meeting dialog
        const completed = () => {
          stage.done = true;
          m.data.meetingDone = true;
          // Remove meeting NPC
          for(let i=npcs.length-1;i>=0;i--){
            if(npcs[i].isMeetingNpc && npcs[i].questId===m.questId) npcs.splice(i,1);
          }
          advanceStage();
        };
        startMeeting(normalizedMsgs, completed);
      }
      break;
    }
    case "theft": {
      const dist = Math.hypot(player.x - stage.x, player.y - stage.y);
      if(dist > (stage.radius||60)){
        // If player leaves theft area, reset hold
        if(m.data.theftHold>0) m.data.theftHold = 0;
        break;
      }
      // Detect if someone approaches (NPC or police within 90px)
      let someoneNear = false;
      for(const n of npcs){
        if(Math.hypot(n.x - player.x, n.y - player.y) < 90){ someoneNear = true; break; }
      }
      if(!someoneNear){
        for(const p of police){
          if(Math.hypot(p.x - player.x, p.y - player.y) < 110){ someoneNear = true; break; }
        }
      }
      const space = (typeof keys!=="undefined" && (keys[" "]||keys["space"]||keys["Space"]||keys["Spacebar"]));
      // Support both Space and E (enterExit) for accessibility
      const enterHeld = (typeof actionHeld==="function" && actionHeld("enterExit"));
      const isHolding = space || enterHeld;
      if(someoneNear){
        if(isHolding){
          // Holding while someone near increases suspicion fast
          m.data.suspicion = Math.min(100, (m.data.suspicion||0) + 1.2);
          if(m.data.suspicion >= 100){
            failMission(lang()==="en" ? "Detected while stealing!" : "تم كشفك أثناء السرقة!");
            break;
          }
        }
        // Must release space if someone approaches - if holding, we already increased suspicion, but spec says must release
        // If player is holding while someone near, we penalize; if they release, suspicion decays
        if(!isHolding){
          m.data.suspicion = Math.max(0, (m.data.suspicion||0) - 1.5);
        }
        // Don't progress while someone near
        break;
      } else {
        // No one near, holding progresses theft
        if(isHolding){
          m.data.theftHold = (m.data.theftHold||0) + 16;
          m.data.suspicion = Math.max(0, (m.data.suspicion||0) - 0.5);
          if(m.data.theftHold >= (m.data.theftDuration||20000)){
            stage.done = true;
            const itemName = stage.itemName || m.data.theftItem || "غرض";
            // Grant item to inventory
            if(!player.inventory) player.inventory=[];
            player.inventory.push(itemName);
            // Also add to loot? Use inventory
            showNotification(lang()==="en" ? `🦹 Stole "${itemName}"! Now deliver.` : `🦹 سرقت "${itemName}"! الآن سلّمها.`);
            m.data.theftHold = 0;
            m.data.suspicion = 0;
            advanceStage();
          }
        } else {
          // Released space resets progress per spec
          if(m.data.theftHold>0){
            m.data.theftHold = 0;
            // per spec, suspicion resets on release
            m.data.suspicion = 0;
          }
        }
      }
      // Update suspicion UI
      try{ if(typeof updateSuspicionUI==="function") updateSuspicionUI(m.data.suspicion||0, null, null, null, m.data.theftHold||0, 20000); }catch{}
      break;
    }
    case "deliverCheck": {
      const dist = Math.hypot(player.x - stage.x, player.y - stage.y);
      if(dist > (stage.radius||55)) break;
      const req = stage.requiredItem || m.data.requiredItem || "";
      const hasItem = player.inventory && player.inventory.includes(req);
      if(hasItem){
        stage.done = true;
        // Consume item? Keep for deliver
        // Remove one instance
        const idx = player.inventory.indexOf(req);
        if(idx>=0) player.inventory.splice(idx,1);
        showNotification(lang()==="en" ? `🎒 Delivered "${req}"` : `🎒 تم تسليم "${req}"`);
        advanceStage();
      } else {
        // Show hint that missing item
        // Use missionProg to show missing
        // Don't fail, just wait
      }
      break;
    }
  }

  updateMissionUI();
}

export function advanceStage() {
  if (!currentMission) return;
  const lab = lang()==="en" ? (currentMission.stages[currentMission.stage].labelEn || currentMission.stages[currentMission.stage].label) : currentMission.stages[currentMission.stage].label;
  showNotification(
    `✅ ${lab} - ${lang()==="en"?"done":"تم!"}`,
  );
  currentMission.stage++;
  if (currentMission.stage >= currentMission.stages.length) {
    completeMission();
  } else {
    // Trigger wanted for heist escape stage
    if (currentMission.stages[currentMission.stage].type === "escape") {
      player.wanted = Math.min(4, player.wanted + 2);
      showNotification(lang()==="en" ? "🚨 Police chase!" : "🚨 الشرطة في المطاردة!");
    }
  }
  updateMissionUI();
}

export function completeMission() {
  if (!currentMission) return;
  currentMission.completed = true;
  setMissionsCompleted(missionsCompleted + 1);
  player.money += currentMission.reward;

  // Cleanup dummy silent-pursuit vehicle if any
  try{
    const tid = currentMission.data && currentMission.data.silentTarget;
    if(tid && tid.isSilentTarget){
      const idx = vehicles.indexOf(tid);
      if(idx>=0) vehicles.splice(idx,1);
    }
  }catch{}
  showNotification(lang()==="en" ? `💰 Mission complete! +$${currentMission.reward}` : `💰 مهمة مكتملة! +$${currentMission.reward}`);
  // Close any active meeting dialog
  try{ closeMeeting(); }catch{}

  const completedQuestId = currentMission.questId || (currentMission.quest && currentMission.quest.id);
  const completedCategory = currentMission.category || "main";

  setTimeout(() => {
    setCurrentMission(null);
    player.wanted = Math.max(0, player.wanted - 2);

    // Quest system completion
    if(completedQuestId){
      const q = quests.find(x=>x.id===completedQuestId);
      if(q) questStatus.set(q.id, "completed");
      const mg = missionGivers.find(g=>g.questId===completedQuestId);
      if(mg){ mg.taken=true; mg.completed=true; }
      setActiveQuestId(null);
      try{ hideSuspicionUI(); }catch{}
      // Cleanup quest NPCs (kill target, transport person) on complete
      for(let i=npcs.length-1;i>=0;i--){
        if(npcs[i].questId===completedQuestId) npcs.splice(i,1);
      }
      // Also cleanup dummy vehicles by flag in case stored differently
      for(let i=vehicles.length-1;i>=0;i--){ if(vehicles[i].isSilentTarget) vehicles.splice(i,1); }
      if(q && q.category==="main"){
        // advance main index to next available
        let idx = mainQuests.findIndex(x=>x.id===completedQuestId);
        if(idx===mainQuestIndex){
          setMainQuestIndex(mainQuestIndex+1);
          // unlock next main
          const next = mainQuests[mainQuestIndex];
          if(next) questStatus.set(next.id, "available");
        }
        if (mainQuestIndex >= mainQuests.length) {
          showNotification(lang()==="en" ? "🏆 All main missions complete! Congrats!" : "🏆 أكملت جميع المهام الرئيسية! مبروك!");
        } else {
          const nxt = mainQuests[mainQuestIndex];
          if(nxt) showNotification(lang()==="en" ? `🔓 New main available: ${nxt.icon} ${qTitle(nxt)}` : `🔓 مهمة رئيسية جديدة متاحة: ${nxt.icon} ${qTitle(nxt)}`);
        }
      } else if(q && q.category==="side"){
        showNotification(lang()==="en" ? `✅ Side quest complete: ${qTitle(q)}` : `✅ مهمة جانبية مكتملة: ${qTitle(q)}`);
      }
    // Story layer: apply morality / relationships / flags and play the outro.
      try {
        const isFinalMain = !!q && q.category === "main" && mainQuestIndex >= mainQuests.length;
        const playedOutro = storyOnQuestCompleted(completedQuestId);
        if (isFinalMain) {
          if (playedOutro) setTimeout(() => { try { storyOnFinale(); } catch {} }, 1700);
          else storyOnFinale();
        }
      } catch (e) { console.warn("[story] completion hook failed", e); }
    } else if (usingSequentialMissions) {
      // legacy fallback
      setSequentialMissionIndex(sequentialMissionIndex + 1);
      if (sequentialMissionIndex >= missionGivers.length) {
        showNotification(lang()==="en" ? "🏆 All missions complete! Congrats!" : "🏆 أكملت جميع المهام! مبروك!");
      } else {
        const next = missionGivers[sequentialMissionIndex];
        showNotification(
          lang()==="en" ? `🔓 New mission available: ${next.mission.icon} ${next.mission.name}` : `🔓 مهمة جديدة متاحة: ${next.mission.icon} ${next.mission.name}`,
        );
      }
    }

    updateMissionUI();
  }, 2000);
}

export function failMission(reason) {
  if (!currentMission) return;
  currentMission.failed = true;
  // Cleanup dummy silent vehicle immediately on fail
  try{
    const tid = currentMission.data && currentMission.data.silentTarget;
    if(tid && tid.isSilentTarget){
      const idx = vehicles.indexOf(tid);
      if(idx>=0) vehicles.splice(idx,1);
    }
    for(let i=vehicles.length-1;i>=0;i--){ if(vehicles[i].isSilentTarget) vehicles.splice(i,1); }
  }catch{}
  showNotification(`❌ ${lang()==="en" ? "Failed:" : "فشلت المهمة:"} ${reason}`);
  // Close any active meeting dialog
  try{ closeMeeting(); }catch{}

  const failedQuestId = currentMission.questId;
  setTimeout(() => {
    setCurrentMission(null);
    // Allow retry: reset quest to available and cleanup spawned NPCs
    if(failedQuestId){
      questStatus.set(failedQuestId, "available");
      const mg=missionGivers.find(g=>g.questId===failedQuestId);
      if(mg) mg.taken=false;
      setActiveQuestId(null);
      try{ hideSuspicionUI(); }catch{}
      for(let i=npcs.length-1;i>=0;i--){
        if(npcs[i].questId===failedQuestId) npcs.splice(i,1);
      }
      for(let i=vehicles.length-1;i>=0;i--){ if(vehicles[i].isSilentTarget) vehicles.splice(i,1); }
    } else if (usingSequentialMissions) {
      const mg = missionGivers[sequentialMissionIndex];
      if (mg) mg.taken = false;
    }
    updateMissionUI();
  }, 2000);
}

// Shared marker contract (Phase 1)
export function getActiveObjectiveTargets() {
  const m = currentMission;
  if (!m || m.completed || m.failed) return [];
  const out = [];
  try {
    const stages = Array.isArray(m.stages) ? m.stages : [];
    for (let i = 0; i < stages.length; i++) {
      const st = stages[i];
      if (!st || st.done) continue;
      if (m.stage !== undefined && i !== m.stage && stages.length > 1 && !st.isQuestEnd) {
        if (st.type !== "dropoff" && st.type !== "escapeToDropoff") continue;
      }
      let x, y;
      if (st.type === "follow") {
        const veh = m.data && m.data.silentTarget;
        if (veh) { x = veh.x; y = veh.y; }
        else if (typeof st.x === "number") { x = st.x; y = st.y; }
      } else if (typeof st.x === "number" && typeof st.y === "number") {
        x = st.x; y = st.y;
      }
      if (typeof x !== "number" || typeof y !== "number") {
        if (m.data && m.data.targetNpc) { x = m.data.targetNpc.x; y = m.data.targetNpc.y; }
      }
      if (typeof x !== "number" || typeof y !== "number") continue;
      out.push({ x, y, radius: st.radius || 40, kind: st.type, nodeId: st.id || ("stage_" + i) });
    }
    if (out.length === 0 && m.data && m.data.questEnd) {
      out.push({ x: m.data.questEnd.x, y: m.data.questEnd.y, radius: 50, kind: "dropoff", nodeId: "questEnd" });
    }
  } catch (e) {}
  const uniq = [];
  for (const t of out) {
    if (!uniq.some(u => Math.hypot(u.x - t.x, u.y - t.y) < 4)) uniq.push(t);
  }
  return uniq;
}
export function getActiveMissionMarkers() { return getActiveObjectiveTargets(); }

export function updateMissionUI() {
  const cancelBtn = document.getElementById("touchCancelMiss");
  const missionBox = document.getElementById("missionBox");
  // Category styling
  if(missionBox){
    missionBox.classList.remove("mission-main","mission-side");
    if(currentMission && currentMission.category==="side") missionBox.classList.add("mission-side");
    else if(currentMission) missionBox.classList.add("mission-main");
  }
  if (!currentMission) {
    // No active mission: show next available hint
    if (quests.length>0) {
      // Prefer main next, else side available hint
      const nextMain = mainQuests[mainQuestIndex];
      if(nextMain && questStatus.get(nextMain.id)==="available"){
        missionTitle.textContent = lang()==="en" ? `🎯 Main ${mainQuestIndex+1}/${mainQuests.length}: ${nextMain.icon} ${qTitle(nextMain)}` : `🎯 المهمة الرئيسية ${mainQuestIndex+1}/${mainQuests.length}: ${nextMain.icon} ${qTitle(nextMain)}`;
        missionDesc.textContent = lang()==="en" ? "Walk to the yellow marker, then press E to accept" : "اذهب إلى النقطة الصفراء واضغط E للقبول";
      } else if(sideQuests.some(q=>questStatus.get(q.id)==="available")){
        const availSide = sideQuests.find(q=>questStatus.get(q.id)==="available");
        missionTitle.textContent = lang()==="en" ? `🟣 Side: ${availSide.icon} ${qTitle(availSide)}` : `🟣 جانبية: ${availSide.icon} ${qTitle(availSide)}`;
        missionDesc.textContent = lang()==="en" ? "Walk to a purple marker, then press E to accept" : "اذهب إلى نقطة بنفسجية واضغط E للقبول";
      } else if(mainQuestIndex >= mainQuests.length && mainQuests.length>0){
        missionTitle.textContent = lang()==="en" ? "🏆 All mains complete!" : "🏆 جميع المهام الرئيسية مكتملة!";
        missionDesc.textContent = lang()==="en" ? "Great job! No more main quests" : "أحسنت! أكملت جميع المهام الرئيسية";
      } else {
        missionTitle.textContent = lang()==="en" ? "🎯 No active mission" : "🎯 لا توجد مهمة نشطة";
        missionDesc.textContent = lang()==="en" ? "Walk to a quest marker, then press E to accept" : "اذهب إلى نقطة مهمة واضغط E للقبول";
      }
    } else if (usingSequentialMissions && missionGivers.length > 0) {
      if (sequentialMissionIndex >= missionGivers.length) {
        missionTitle.textContent = lang()==="en" ? "🏆 All missions complete!" : "🏆 جميع المهام مكتملة!";
        missionDesc.textContent = lang()==="en" ? "Great! You finished all missions" : "أحسنت! أكملت جميع مهام الخريطة";
      } else {
        const next = missionGivers[sequentialMissionIndex];
        missionTitle.textContent = `🎯 ${lang()==="en" ? `Mission ${sequentialMissionIndex + 1}/${missionGivers.length}` : `المهمة ${sequentialMissionIndex + 1}/${missionGivers.length}`}: ${next.mission.icon} ${next.mission.name}`;
        missionDesc.textContent =
          lang()==="en" ? "Walk to the yellow dot, then press E to start" : "اذهب إلى النقطة الصفراء واضغط E للبدء";
      }
    } else {
      missionTitle.textContent = lang()==="en" ? "🎯 No active mission" : "🎯 لا توجد مهمة نشطة";
      missionDesc.textContent = lang()==="en" ? "Walk to a yellow dot, then press E to start" : "اذهب إلى نقطة صفراء واضغط E للبدء";
    }
    // Standing next to a marker: E accepts that quest right now.
    const offer = getNearbyQuestOffer();
    if(offer){
      const oq = offer.questId ? quests.find(q=>q.id===offer.questId) : null;
      const on = oq ? qTitle(oq) : ((offer.mission && offer.mission.name) || "");
      missionDesc.textContent = (lang()==="en" ? "Press E to accept" : "اضغط E للقبول") + (on ? ` — ${on}` : "");
    }
    missionProg.textContent = "";
    if (cancelBtn) cancelBtn.classList.remove("visible");
    return;
  }
  if (cancelBtn) cancelBtn.classList.add("visible");

  const m = currentMission;
  const quest = m.quest || (m.questId ? quests.find(q=>q.id===m.questId) : null);
  const displayTitle = quest ? qTitle(quest) : m.name;
  missionTitle.textContent = `${m.category==="side"?"🟣":"🎯"} ${displayTitle}`;
  // Status line: bilingual quest objective + stage label
  const stage = m.stages[m.stage];
  if (stage) {
    const lab = lang()==="en" ? (stage.labelEn || stage.label) : stage.label;
    const obj = quest ? qDesc(quest) : "";
    // Show quest content + current status per spec (top right)
    if(quest && stage.isQuestEnd){
      missionDesc.textContent = `${obj} — ${lab} (${m.stage + 1}/${m.stages.length})`;
    } else {
      missionDesc.textContent = `${lab} (${m.stage + 1}/${m.stages.length})`;
    }
    // If stage has isQuestEnd, indicate drop-off
    if(stage.isQuestEnd){
      missionDesc.textContent = (lang()==="en" ? "🏁 Go to green drop-off to finish" : "🏁 اذهب إلى نقطة التسليم الخضراء لإنهاء المهمة") + ` (${m.stage+1}/${m.stages.length})`;
    }
  } else {
    missionDesc.textContent = lang()==="en" ? "Finishing..." : "جاري إكمال المهمة...";
  }

  if(!stage){
    missionProg.textContent = "";
  } else if(m.type==="silentPursuit"){
    const sus = Math.round(m.data.suspicion||0);
    const elapsed = Math.round((m.data.followTimer||0)/1000);
    const total = Math.round(((stage && stage.duration)||30000)/1000);
    missionProg.textContent = `${lang()==="en"?"Suspicion":"الشك"} ${sus}% | ${elapsed}/${total}s`;
  } else if(m.type==="surveillance"){
    const elapsed = Math.round((m.data.surveillanceTime||0)/1000);
    const total = Math.round(((stage && stage.duration)||30000)/1000);
    const remain = Math.max(0, total - elapsed);
    missionProg.textContent = `${lang()==="en"?"Stay":"ابقَ"} ${remain}s | ${lang()==="en"?"No kill/police":"لا قتل/شرطة"}`;
  } else if(m.type==="plantBomb"){
    if(stage?.type==="plantBomb"){
      const hold = Math.round((m.data.plantHold||0)/1000*10)/10;
      missionProg.textContent = `${lang()==="en"?"Planting":"زرع"} ${hold}/3.0s (hold E)`;
    } else {
      missionProg.textContent = `${lang()==="en"?"Escape":"اهرب"} ${quest ? `${lang()==="en"?"Progress":"التقدم"} ${m.stage}/${m.stages.length}` : ""}`;
    }
  } else if(m.type==="theft"){
    if(stage?.type==="theft"){
      const hold = Math.round((m.data.theftHold||0)/1000*10)/10;
      const sus = Math.round(m.data.suspicion||0);
      missionProg.textContent = `${lang()==="en"?"Stealing":"سرقة"} ${hold}/20s | ${lang()==="en"?"Suspicion":"شك"} ${sus}%`;
    } else {
      missionProg.textContent = `${lang()==="en"?"Deliver":"سلّم"} ${quest ? qTitle(quest) : ""}`;
    }
    } else if(m.type==="meeting"){
    if(stage?.type==="meeting"){
      const msgs = (m.data && Array.isArray(m.data.meetingMessages) && m.data.meetingMessages.length) ? m.data.meetingMessages : (getMeetingMessagesFromQuest(quest) || [{ar:"",en:""}]);
      const total = msgs.length;
      // Use meeting dialog's current index when active (prevents HUD showing 0 when dialog advances)
      let idx = 0;
      try {
        if (isMeetingActive()) {
          const curMeet = getCurrentMeeting();
          if (curMeet && typeof curMeet.index === "number") idx = curMeet.index;
          else if (m.data && typeof m.data.meetingIndex==="number") idx = m.data.meetingIndex;
        } else if (m.data && typeof m.data.meetingIndex==="number") {
          idx = m.data.meetingIndex;
        }
      } catch { idx = (m.data && typeof m.data.meetingIndex==="number") ? m.data.meetingIndex : 0; }
      if(total>1){
        const cur = msgs[Math.min(idx, total-1)] || msgs[0];
        const role = lang()==="en" ? (cur.roleEn || cur.roleAr) : (cur.roleAr || cur.roleEn);
        const rolePart = role ? ` - ${role}` : "";
        missionProg.textContent = lang()==="en" ? `Press E [${idx+1}/${total}]${rolePart}` : `اضغط E [${idx+1}/${total}]${rolePart}`;
      } else {
        missionProg.textContent = lang()==="en" ? "Press E to talk" : "اضغط E للتحدث";
      }
    } else {
      missionProg.textContent = `${lang()==="en"?"Go":"اذهب"} ${m.stage+1}/${m.stages.length}`;
    }
  } else if(m.type==="stealCar"){
    if(stage?.type==="stealVehicle"){
      missionProg.textContent = lang()==="en" ? "Steal any car (1/1) - Enter vehicle" : "اسرق أي سيارة (1/1) - استقل السيارة";
    } else {
      missionProg.textContent = lang()==="en" ? "Drive car to drop-off" : "قد السيارة إلى نقطة التسليم";
    }
  } else if(m.type==="escapeCar"){
    if(stage?.type==="escapeToDropoff"){
      missionProg.textContent = lang()==="en" ? "🚨 Escape police to drop-off!" : "🚨 اهرب من الشرطة إلى نقطة التسليم!";
    } else if(stage?.type==="escape"){
      const elapsed = Math.round((stage.timer||0)/1000);
      const total = Math.round((stage.duration||20000)/1000);
      missionProg.textContent = `${lang()==="en"?"Escape":"اهرب"} ${elapsed}/${total}s`;
    } else {
      missionProg.textContent = lang()==="en" ? "Escape!" : "اهرب!";
    }
  } else if(m.type==="deliverLoot"){
    const req = stage?.requiredItem || m.data.requiredItem || "";
    missionProg.textContent = `${lang()==="en"?"Need":"تحتاج"} "${req}" | ${hasItemCheck(req) ? (lang()==="en"?"Have it":"لديك") : (lang()==="en"?"Missing":"مفقود")}`;
  } else if (m.timer > 0) {
    const secs = Math.ceil(m.timer / 1000);
    if (stage && stage.type === "eliminate") {
      const kills = m.data.killCount || 0;
      const target = stage.killTarget || 1;
      missionProg.textContent = `☠ ${kills}/${target}  ⏱ ${secs}s`;
    } else {
      missionProg.textContent = `⏱ ${secs}s`;
    }
  } else if (stage && stage.type === "eliminate") {
    const kills = m.data.killCount || 0;
    const target = stage.killTarget || 1;
    missionProg.textContent = `☠ ${kills}/${target}`;
  } else {
    if(m.quest && m.stages.length){
      missionProg.textContent = quest ? `${lang()==="en"?"Progress":"التقدم"} ${m.stage}/${m.stages.length}` : "";
    } else {
      missionProg.textContent = "";
    }
  }

  if (m.completed) {
    missionTitle.textContent = lang()==="en" ? "✅ Complete!" : "✅ مكتمل!";
    missionDesc.textContent = lang()==="en" ? `Got $${m.reward}` : `حصلت على $${m.reward}`;
  } else if (m.failed) {
    missionTitle.textContent = lang()==="en" ? "❌ Failed" : "❌ فشلت المهمة";
    missionDesc.textContent = lang()==="en" ? "Try again" : "حاول مرة أخرى";
  }
}
function hasItemCheck(name){
  try{ return player && player.inventory && player.inventory.includes(name); }catch{ return false; }
}
// Auto-update HUD when language changes (bilingual quest titles)
if(typeof window!=="undefined"){
  window.addEventListener("languageChanged", ()=>{ try{ updateMissionUI(); } catch{} });
}
