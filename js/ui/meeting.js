// ======================== MEETING DIALOG SYSTEM ========================
// Used for mission "meeting" type quests - displays multi-message dialogue at bottom frame
// Messages advance when E key is pressed. Message text in white, sender name in gold.

import { SETTINGS } from "../input/settings.js?v=57";

function lang(){ return (SETTINGS && SETTINGS.language==="en") ? "en":"ar"; }

let currentMeeting = null; // { messages: [...], index: number, onComplete: Function }
let meetingDialogEl = null;
let meetingSpeakerEl = null;
let meetingMessageEl = null;
let meetingProgressEl = null;
let meetingFrameEl = null;

export function isMeetingActive(){ return currentMeeting !== null; }
export function getCurrentMeeting(){ return currentMeeting; }

export function initMeetingDialog(){
    try{
        meetingDialogEl = document.getElementById("meetingDialog");
        meetingFrameEl = document.getElementById("meetingFrame");
        meetingSpeakerEl = document.getElementById("meetingSpeaker");
        meetingMessageEl = document.getElementById("meetingMessage");
        meetingProgressEl = document.getElementById("meetingProgress");
        console.log("[meeting] dialog initialized");
    } catch(e){
        console.warn("[meeting] init failed", e);
    }
}

function showMeetingAtIndex(idx){
    if(!currentMeeting) return;
    const msgs = currentMeeting.messages;
    if(idx < 0 || idx >= msgs.length) return;
    const cur = msgs[idx];
    const l = lang();
    const role = l==="en" ? (cur.roleEn || cur.roleAr || "") : (cur.roleAr || cur.roleEn || "");
    const msg = l==="en" ? (cur.en || cur.ar || "") : (cur.ar || cur.en || "");
    try{
        if(!meetingDialogEl) meetingDialogEl = document.getElementById("meetingDialog");
        if(!meetingSpeakerEl) meetingSpeakerEl = document.getElementById("meetingSpeaker");
        if(!meetingMessageEl) meetingMessageEl = document.getElementById("meetingMessage");
        if(!meetingProgressEl) meetingProgressEl = document.getElementById("meetingProgress");
        if(meetingSpeakerEl) meetingSpeakerEl.textContent = role || (l==="en" ? "Contact" : "جهة اتصال");
        if(meetingMessageEl) meetingMessageEl.textContent = msg;
        if(meetingProgressEl){
            if(msgs.length > 1) meetingProgressEl.textContent = `${idx+1} / ${msgs.length}`;
            else meetingProgressEl.textContent = "";
        }
        if(meetingDialogEl){
            meetingDialogEl.style.display = "flex";
            try{ meetingDialogEl.focus(); }catch{}
        }
    } catch(e){
        console.warn("[meeting] show failed", e);
    }
}

export function startMeeting(messages, onComplete){
    if(isMeetingActive()) return false;
    if(!Array.isArray(messages) || !messages.length) return false;
    currentMeeting = { messages, index: 0, onComplete };
    showMeetingAtIndex(0);
    return true;
}

export function advanceMeeting(){
    if(!isMeetingActive()) return false;
    const msgs = currentMeeting.messages;
    const idx = currentMeeting.index;
    if(idx >= msgs.length - 1){
        // Last message - complete meeting
        const cb = currentMeeting.onComplete;
        currentMeeting = null;
        try{
            if(!meetingDialogEl) meetingDialogEl = document.getElementById("meetingDialog");
            if(meetingDialogEl) meetingDialogEl.style.display = "none";
        } catch{}
        if(cb) cb();
        return true;
    } else {
        currentMeeting.index = idx + 1;
        showMeetingAtIndex(currentMeeting.index);
        return true;
    }
}

export function closeMeeting(){
    if(!isMeetingActive()) return;
    currentMeeting = null;
    try{
        if(!meetingDialogEl) meetingDialogEl = document.getElementById("meetingDialog");
        if(meetingDialogEl) meetingDialogEl.style.display = "none";
    } catch{}
}

// Auto-init if DOM ready
if(typeof window!=="undefined"){
    if(document.readyState==="loading"){
        document.addEventListener("DOMContentLoaded", ()=>{ try{ initMeetingDialog(); }catch{} });
    } else {
        try{ initMeetingDialog(); }catch{}
    }
    window.SG_Meeting = { initMeetingDialog, startMeeting, advanceMeeting, closeMeeting, isMeetingActive, getCurrentMeeting };
    // Language change refresh
    window.addEventListener("languageChanged", ()=>{
        try{
            if(isMeetingActive()){
                showMeetingAtIndex(currentMeeting.index);
            }
        }catch{}
    });
}