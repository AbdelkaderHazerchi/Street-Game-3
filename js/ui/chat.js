// ======================== CHAT SYSTEM (generic NPC chats) ========================
// Feature: Press E near any NPC to start a random chat. Each chat consists of multiple messages.
// Each message is bilingual: {ar,en,roleAr,roleEn} — message text + speaker role in both languages.
// Chats are defined in map editor (window._mapChats) and stored in MAP_DATA.chats.
// When no chats defined, fallback to default generic chats.
// Editor: maps_editor.html allows creating multiple chats, each with multiple messages.
// Runtime: random selection on interaction, E advances through messages, ESC closes.

import { player } from "../entities/player.js?v=57";
import { npcs } from "../entities/npcs.js?v=57";
import { SETTINGS } from "../input/settings.js?v=57";
import { showNotification } from "./hud.js?v=57";

function lang(){ return (SETTINGS && SETTINGS.language==="en") ? "en":"ar"; }

// All chats loaded from map
let allChats = []; // [{id, messages:[{ar,en,roleAr,roleEn}]}]
let currentChat = null; // {chat, npc, index}
let chatDialogEl = null;
let chatSpeakerEl = null;
let chatMessageEl = null;
let chatProgressEl = null;

// Default fallback chats (bilingual) if editor provides none
const DEFAULT_CHATS = [
  {
    id: "default_0",
    messages: [
      { ar: "مرحباً! كيف حالك اليوم؟", en: "Hello! How are you today?", roleAr: "مواطن", roleEn: "Citizen" },
      { ar: "بخير. الجو جميل اليوم.", en: "Doing well. Nice weather today.", roleAr: "أنت", roleEn: "You" },
      { ar: "صحيح، المدينة هادئة اليوم.", en: "Yeah, the city is calm today.", roleAr: "مواطن", roleEn: "Citizen" }
    ]
  },
  {
    id: "default_1",
    messages: [
      { ar: "هل سمعت الأخبار؟", en: "Did you hear the news?", roleAr: "جار", roleEn: "Neighbor" },
      { ar: "لا، ماذا حدث؟", en: "No, what happened?", roleAr: "أنت", roleEn: "You" },
      { ar: "يقولون إن الشرطة تزيد دورياتها.", en: "They say police are stepping up patrols.", roleAr: "جار", roleEn: "Neighbor" }
    ]
  },
  {
    id: "default_2",
    messages: [
      { ar: "أهلاً! تحتاج مساعدة؟", en: "Hey! Need help?", roleAr: "تاجر", roleEn: "Trader" },
      { ar: "شكراً، أنا بخير.", en: "Thanks, I'm good.", roleAr: "أنت", roleEn: "You" }
    ]
  }
];

export function getAllChats(){ return allChats; }
export function isChatActive(){ return currentChat !== null; }
export function getCurrentChat(){ return currentChat; }

function normalizeChatMessages(arr){
  if(!Array.isArray(arr)) return [];
  return arr.map(m=>{
    if(!m || typeof m!=="object") return null;
    const ar = String(m.ar || m.messageAr || m.textAr || "").trim();
    const en = String(m.en || m.messageEn || m.textEn || "").trim();
    const roleAr = String(m.roleAr || m.speakerAr || "").trim();
    const roleEn = String(m.roleEn || m.speakerEn || "").trim();
    if(!ar && !en) return null;
    return { ar, en, roleAr, roleEn };
  }).filter(Boolean);
}

export function initChats(){
  try{
    let src = null;
    if(typeof window!=="undefined"){
      if(Array.isArray(window._mapChats) && window._mapChats.length) src = window._mapChats;
      else if(window.MAP_DATA && Array.isArray(window.MAP_DATA.chats) && window.MAP_DATA.chats.length) src = window.MAP_DATA.chats;
      else if(Array.isArray(window.chats) && window.chats.length) src = window.chats;
    }
    // Also check imported MAP_DATA via mapState? fallback to window
    if(src && Array.isArray(src) && src.length){
      allChats = src.map((c, idx)=>{
        let msgs = normalizeChatMessages(c.messages || c.dialogue || c.lines);
        // Backwards: if chat stored as {messages: [{ar,en,roleAr,roleEn}]} or legacy
        if(!msgs.length && (c.ar || c.en)){
          // single message fallback
          msgs = [{ ar: String(c.ar||"").trim(), en: String(c.en||"").trim(), roleAr: String(c.roleAr||c.speakerAr||"").trim(), roleEn: String(c.roleEn||c.speakerEn||"").trim() }];
        }
        // If still empty, try params
        if(!msgs.length && c.params && Array.isArray(c.params.messages)){
          msgs = normalizeChatMessages(c.params.messages);
        }
        if(!msgs.length) return null;
        return { id: c.id || `chat_${idx}`, messages: msgs };
      }).filter(Boolean);
    }
    if(!allChats.length){
      // Use defaults
      allChats = JSON.parse(JSON.stringify(DEFAULT_CHATS));
    }
    console.log("[chat] initialized", allChats.length, "chats");
  } catch(e){
    console.warn("[chat] init failed", e);
    allChats = JSON.parse(JSON.stringify(DEFAULT_CHATS));
  }
  // Cache DOM refs
  try{
    chatDialogEl = document.getElementById("chatDialog");
    chatSpeakerEl = document.getElementById("chatSpeaker");
    chatMessageEl = document.getElementById("chatMessage");
    chatProgressEl = document.getElementById("chatProgress");
    // Bind buttons
    const nextBtn = document.getElementById("chatNextBtn");
    const closeBtn = document.getElementById("chatCloseBtn");
    if(nextBtn) nextBtn.onclick = ()=> advanceChat();
    if(closeBtn) closeBtn.onclick = ()=> closeChat();
    // Do not close on overlay click — user must press E to advance / ESC to close
    // Intentionally no click-to-close on #chatDialog, to enforce reading via E
    // (kept for future: if needed, only close when clicking explicit close button)
  } catch{}
}

function pickRandomChat(){
  if(!allChats.length) return null;
  const idx = Math.floor(Math.random()*allChats.length);
  return allChats[idx];
}

export function getNearbyNpc(radius=70){
  if(!player || !npcs || !npcs.length) return null;
  // Exclude quest NPCs that are part of active meeting? All NPCs are valid for chat
  // Find closest within radius
  let closest = null;
  let closestDist = Infinity;
  for(const npc of npcs){
    // Skip if NPC is currently a quest target that is hostile? Still allow chat with civilians only?
    // Allow all but prefer civilian for chat friendliness
    const d = Math.hypot(player.x - npc.x, player.y - npc.y);
    if(d < radius && d < closestDist){
      closest = npc;
      closestDist = d;
    }
  }
  return closest;
}

export function startRandomChat(npc){
  if(isChatActive()) return false;
  // Don't start chat if in vehicle? maybe allow only on foot
  if(player && player.inVehicle) return false;
  const chat = pickRandomChat();
  if(!chat) return false;
  const targetNpc = npc || getNearbyNpc(70);
  if(!targetNpc) return false;
  currentChat = { chat, npc: targetNpc, index: 0 };
  showChatAtIndex(0);
  return true;
}

export function startRandomChatNearPlayer(){
  const npc = getNearbyNpc(70);
  if(!npc) return false;
  return startRandomChat(npc);
}

function showChatAtIndex(idx){
  if(!currentChat) return;
  const msgs = currentChat.chat.messages;
  if(idx <0 || idx >= msgs.length) return;
  const cur = msgs[idx];
  const l = lang();
  const role = l==="en" ? (cur.roleEn || cur.roleAr || "") : (cur.roleAr || cur.roleEn || "");
  const msg = l==="en" ? (cur.en || cur.ar || "") : (cur.ar || cur.en || "");
  try{
    if(!chatDialogEl) chatDialogEl = document.getElementById("chatDialog");
    if(!chatSpeakerEl) chatSpeakerEl = document.getElementById("chatSpeaker");
    if(!chatMessageEl) chatMessageEl = document.getElementById("chatMessage");
    if(!chatProgressEl) chatProgressEl = document.getElementById("chatProgress");
    if(chatSpeakerEl) chatSpeakerEl.textContent = role || (l==="en" ? "Someone" : "شخص");
    if(chatMessageEl) chatMessageEl.textContent = msg;
    if(chatProgressEl){
      if(msgs.length>1) chatProgressEl.textContent = `${idx+1} / ${msgs.length}`;
      else chatProgressEl.textContent = "";
    }
    if(chatDialogEl){
      chatDialogEl.style.display = "flex";
      // Focus for accessibility
      try{ chatDialogEl.focus(); }catch{}
    }
    // Also show notification for minimal feedback
    // showNotification handled via dialog, not needed
  } catch(e){
    // Fallback to notification if dialog missing
    const display = role ? `${role}: ${msg}` : msg;
    try{ showNotification(`💬 ${display}`); }catch{}
  }
}

export function advanceChat(){
  if(!isChatActive()) return false;
  const msgs = currentChat.chat.messages;
  const idx = currentChat.index;
  // If currently shown idx is last, close
  if(idx >= msgs.length -1){
    closeChat();
    try{ showNotification(lang()==="en" ? "💬 Chat ended" : "💬 انتهت المحادثة"); }catch{}
    return true;
  } else {
    currentChat.index = idx + 1;
    showChatAtIndex(currentChat.index);
    return true;
  }
}

export function closeChat(){
  if(!isChatActive()) return;
  currentChat = null;
  try{
    if(!chatDialogEl) chatDialogEl = document.getElementById("chatDialog");
    if(chatDialogEl) chatDialogEl.style.display = "none";
  } catch{}
}

// Auto-init if DOM ready
if(typeof window!=="undefined"){
  if(document.readyState==="loading"){
    document.addEventListener("DOMContentLoaded", ()=>{ try{ initChats(); }catch{} });
  } else {
    try{ initChats(); }catch{}
  }
  window.SG_Chat = { initChats, startRandomChat, startRandomChatNearPlayer, advanceChat, closeChat, isChatActive, getAllChats };
  // Language change refresh
  window.addEventListener("languageChanged", ()=>{
    try{
      if(isChatActive()){
        showChatAtIndex(currentChat.index);
      }
    }catch{}
  });
}
