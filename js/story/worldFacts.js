// Single source of truth for world facts (flags, loyalty, truth, price).
import * as S from "./storyState.js?v=57";

export const hasFlag = (k) => S.hasFlag(k);
export const setFlag = (k, v) => S.setFlag(k, v);
export const getFlags = () => S.getFlags();

export const getMorality = () => S.getMorality();
export const addMorality = (d) => S.addMorality(d);

export const getPrice = () => S.getPrice();
export const addPrice = (d) => S.addPrice(d);

export const getTruth = () => S.getTruth();
export const hasTruth = (x) => S.hasTruth(x);
export const addTruth = (x) => S.addTruth(x);

export const getFaction = (id) => S.getFaction(id);
export const addFaction = (id, d) => S.addFaction(id, d);
export const getFactions = () => S.getFactions();

export const getRelationship = (id) => S.getRelationship(id);
export const addRelationship = (id, d) => S.addRelationship(id, d);

export const getChapter = () => S.getChapter();
export const advanceChapter = () => S.advanceChapter();

if (typeof window !== "undefined") window.SG_WorldFacts = { hasFlag, setFlag, getFlags, getMorality, addMorality, getPrice, addPrice, getTruth, hasTruth, addTruth, getFaction, addFaction, getFactions, getRelationship, addRelationship, getChapter, advanceChapter, validateFlags };

// CI-style validation helper
export function validateFlags(setFlags = [], usedFlags = []) {
  const missing = (setFlags || []).filter(f => !(usedFlags || []).includes(f));
  return { ok: missing.length === 0, missing };
}