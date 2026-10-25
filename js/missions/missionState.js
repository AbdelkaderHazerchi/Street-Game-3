// ======================== MISSION / QUEST STATE ========================
// Extended for two-point bilingual Main/Side quest overhaul
// Keeps legacy bindings for compat; adds quest-native state

export let checkpoints = [];
export let missionGivers = []; // legacy flat view + runtime enriched (includes x,y, category, questId, endX,endY)
export let particles = [];
export let currentMission = null;
export let missionsCompleted = 0;
export let allMissions = [];
export let sequentialMissionIndex = 0;
export let usingSequentialMissions = false;

// --- New quest-native state ---
export let quests = []; // canonical array of quest objects {id,category,type,start,end,title,desc,reward,icon,order}
export let mainQuests = []; // filtered view category==main (ordered)
export let sideQuests = []; // filtered view category==side
export let activeQuestId = null;
export let questStatus = new Map(); // id -> "available" | "active" | "completed" | "failed"
export let mainQuestIndex = 0; // pointer to next main to become available

export function setCurrentMission(v){ currentMission = v; }
export function setMissionsCompleted(v){ missionsCompleted = v; }
export function setAllMissions(v){ allMissions = v; }
export function setMissionGivers(v){ missionGivers = v; }
export function setSequentialMissionIndex(v){ sequentialMissionIndex = v; }
export function setUsingSequentialMissions(v){ usingSequentialMissions = v; }
export function clearCheckpoints(){ checkpoints.length = 0; }
export function clearMissionGivers(){ missionGivers.length = 0; }

// New setters
export function setQuests(v){ quests = v; }
export function setMainQuests(v){ mainQuests = v; }
export function setSideQuests(v){ sideQuests = v; }
export function setActiveQuestId(v){ activeQuestId = v; }
export function setQuestStatus(map){ questStatus = map; }
export function setMainQuestIndex(v){ mainQuestIndex = v; }
export function clearQuests(){
  quests.length = 0;
  mainQuests.length = 0;
  sideQuests.length = 0;
  missionGivers.length = 0;
  questStatus = new Map();
  activeQuestId = null;
  mainQuestIndex = 0;
}
export function getQuestById(id){ return quests.find(q=>q.id===id) || mainQuests.find(q=>q.id===id) || sideQuests.find(q=>q.id===id) || null; }
