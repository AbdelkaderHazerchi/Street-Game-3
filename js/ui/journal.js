// ============================================================================
// STORY JOURNAL — Street Game 2 : "The Ghost Ledger"
// Renders the pause-menu "Story" tab: current chapter, main quest progress,
// side quest tally, character relationships, morality and the landmarks map.
// ============================================================================

import { SETTINGS } from "../input/settings.js?v=57";
import { STORY, CHAPTERS, CHARACTERS, RELATION_KEYS, ENDINGS } from "../story/storyData.js?v=57";
import { MAIN_QUESTS, SIDE_QUESTS } from "../story/questDefs.js?v=57";
import { LANDMARKS } from "../story/landmarks.js?v=57";
import {
  getChapter, getMorality, getRelationship, getEnding, getFlags, isStoryStarted,
} from "../story/storyState.js?v=57";
import { quests, questStatus, mainQuestIndex } from "../missions/missionState.js?v=57";

function lang() { return (SETTINGS && SETTINGS.language === "en") ? "en" : "ar"; }
function pick(o, fallback = "") {
  if (!o) return fallback;
  return lang() === "en" ? (o.en || o.ar || fallback) : (o.ar || o.en || fallback);
}

function el(tag, className, text) {
  const n = document.createElement(tag);
  if (className) n.className = className;
  if (text !== undefined && text !== null) n.textContent = String(text);
  return n;
}

/** Status of a quest id from the live mission state. */
function statusOf(id) {
  try { return questStatus instanceof Map ? (questStatus.get(id) || "locked") : "locked"; }
  catch { return "locked"; }
}

const STATUS_LABEL = {
  ar: { completed: "مكتملة", active: "جارية", available: "متاحة", failed: "فاشلة", locked: "مقفلة" },
  en: { completed: "Done", active: "Active", available: "Open", failed: "Failed", locked: "Locked" },
};

/** Relationship descriptor + colour for the current score. */
function relDescriptor(score) {
  if (score >= 80) return { ar: "قريب جداً", en: "Very close", color: "#4ade80" };
  if (score >= 62) return { ar: "موجود", en: "On your side", color: "#a3e635" };
  if (score >= 45) return { ar: "محايد", en: "Neutral", color: "#e5e7eb" };
  if (score >= 25) return { ar: "متوجس", en: "Wary", color: "#fbbf24" };
  return { ar: "عدائي", en: "Hostile", color: "#ef4444" };
}

/** Render the whole journal into #journalBody. */
export function renderJournal() {
  const body = document.getElementById("journalBody");
  if (!body) return false;
  body.innerHTML = "";
  const l = lang();

  // ── header: chapter + progress ────────────────────────────────
  const chNo = getChapter();
  const ch = CHAPTERS.find((c) => c.n === chNo) || CHAPTERS[0];
  const head = el("div", "jr-head");
  head.appendChild(el("div", "jr-head-title", pick(ch.title, `Chapter ${chNo}`)));
  head.appendChild(el("div", "jr-head-sub", pick(ch.subtitle, "")));
  head.appendChild(el("div", "jr-head-theme", pick(ch.theme, "")));
  body.appendChild(head);

  const stats = el("div", "jr-stats");
  const doneMains = MAIN_QUESTS.filter((q) => statusOf(q.id) === "completed").length;
  const doneSides = SIDE_QUESTS.filter((q) => statusOf(q.id) === "completed").length;

  function stat(label, value, color) {
    const b = el("div", "jr-stat");
    b.appendChild(el("div", "jr-stat-v", value));
    const v = b.lastChild;
    if (color) v.style.color = color;
    b.appendChild(el("div", "jr-stat-l", label));
    return b;
  }
  stats.appendChild(stat(l === "en" ? "Main story" : "القصة الرئيسية", `${doneMains}/${MAIN_QUESTS.length}`, "#ffd700"));
  stats.appendChild(stat(l === "en" ? "Side quests" : "المهام الجانبية", `${doneSides}/${SIDE_QUESTS.length}`, "#a855f7"));

  const mor = getMorality();
  const morColor = mor >= 70 ? "#4ade80" : (mor >= 40 ? "#fbbf24" : "#ef4444");
  stats.appendChild(stat(l === "en" ? "Conscience" : "الضمير", `${mor}/100`, morColor));

  const endingId = getEnding();
  const endLabel = endingId && ENDINGS[endingId] ? pick(ENDINGS[endingId].name) : (l === "en" ? "Undecided" : "لم يُحسم");
  stats.appendChild(stat(l === "en" ? "Ending" : "النهاية", endLabel, endingId ? "#22d3ee" : "#94a3b8"));
  body.appendChild(stats);

  if (!isStoryStarted()) {
    const w = el("div", "jr-note", l === "en"
      ? "The story has not begun yet. Walk to the yellow marker."
      : "لم تبدأ القصة بعد. اتجه إلى النقطة الصفراء.");
    body.appendChild(w);
  }

  // ── chapter list ──────────────────────────────────────────────
  const chWrap = el("section", "jr-sec");
  chWrap.appendChild(el("h3", "jr-h", l === "en" ? "Chapters" : "الفصول"));
  const chList = el("ol", "jr-chapters");
  for (const c of CHAPTERS) {
    const li = el("li", "jr-ch");
    const n = c.n;
    const unlocked = n <= chNo;
    li.classList.add(unlocked ? "is-open" : "is-locked");
    const headRow = el("div", "jr-ch-head");
    const dot = el("span", "jr-ch-n", String(n));
    dot.style.background = unlocked ? c.color : "#3f3f46";
    headRow.appendChild(dot);
    headRow.appendChild(el("span", "jr-ch-title", unlocked ? pick(c.title) : (l === "en" ? "Locked" : "مقفل")));
    li.appendChild(headRow);
    if (unlocked) {
      li.appendChild(el("div", "jr-ch-sub", pick(c.subtitle)));
      const ids = MAIN_QUESTS.filter((q) => q.chapter === n).map((q) => q.id);
      const d = ids.filter((id) => statusOf(id) === "completed").length;
      li.appendChild(el("div", "jr-ch-prog", `${d}/${ids.length}`));
    }
    chList.appendChild(li);
  }
  chWrap.appendChild(chList);
  body.appendChild(chWrap);

  // ── main quests ───────────────────────────────────────────────
  const mWrap = el("section", "jr-sec");
  mWrap.appendChild(el("h3", "jr-h", l === "en" ? "Main missions" : "المهام الرئيسية"));
  const mList = el("ul", "jr-quests");
  MAIN_QUESTS.forEach((q, i) => {
    const st = statusOf(q.id);
    const li = el("li", `jr-quest is-${st}`);
    li.appendChild(el("span", "jr-quest-i", q.icon || "🎯"));
    const mid = el("span", "jr-quest-t", pick(q.title));
    li.appendChild(mid);
    const tag = el("span", "jr-quest-s", (STATUS_LABEL[l] || STATUS_LABEL.en)[st] || st);
    li.appendChild(tag);
    if (st === "completed") li.classList.add("is-done");
    mList.appendChild(li);
  });
  mWrap.appendChild(mList);
  body.appendChild(mWrap);

  // ── side quests ───────────────────────────────────────────────
  const sWrap = el("section", "jr-sec");
  sWrap.appendChild(el("h3", "jr-h", l === "en" ? "Side contracts" : "العقود الجانبية"));
  const sList = el("ul", "jr-quests jr-side");
  SIDE_QUESTS.forEach((q) => {
    const st = statusOf(q.id);
    const li = el("li", `jr-quest is-${st}`);
    li.appendChild(el("span", "jr-quest-i", q.icon || "🟣"));
    li.appendChild(el("span", "jr-quest-t", pick(q.title)));
    li.appendChild(el("span", "jr-quest-s", (STATUS_LABEL[l] || STATUS_LABEL.en)[st] || st));
    if (st === "completed") li.classList.add("is-done");
    sList.appendChild(li);
  });
  sWrap.appendChild(sList);
  body.appendChild(sWrap);

  // ── characters ────────────────────────────────────────────────
  const cWrap = el("section", "jr-sec");
  cWrap.appendChild(el("h3", "jr-h", l === "en" ? "People" : "الأشخاص"));
  const cList = el("ul", "jr-people");
  for (const key of RELATION_KEYS) {
    const c = CHARACTERS[key];
    if (!c) continue;
    const score = getRelationship(key);
    const li = el("li", "jr-person");

    const av = el("span", "jr-avatar", (pick(c.name, key)).charAt(0));
    av.style.background = c.color || "#444";
    li.appendChild(av);

    const info = el("span", "jr-person-info");
    info.appendChild(el("span", "jr-person-n", pick(c.name)));
    info.appendChild(el("span", "jr-person-r", pick(c.role)));
    li.appendChild(info);

    const right = el("span", "jr-person-rel");
    const d = relDescriptor(score);
    const lab = el("span", "jr-person-d", pick(d));
    lab.style.color = d.color;
    right.appendChild(lab);

    const bar = el("span", "jr-relbar");
    const fill = el("span", "jr-relfill");
    fill.style.width = `${Math.max(2, score)}%`;
    fill.style.background = d.color;
    bar.appendChild(fill);
    right.appendChild(bar);
    li.appendChild(right);

    cList.appendChild(li);
  }
  cWrap.appendChild(cList);
  body.appendChild(cWrap);

  // ── landmarks ─────────────────────────────────────────────────
  const lWrap = el("section", "jr-sec");
  lWrap.appendChild(el("h3", "jr-h", l === "en" ? "Places" : "الأماكن"));
  const lList = el("ul", "jr-places");
  for (const lm of LANDMARKS) {
    const li = el("li", "jr-place");
    const dot = el("span", "jr-place-dot");
    dot.style.background = lm.color;
    li.appendChild(dot);
    const t = el("span", "jr-place-t");
    t.appendChild(el("span", "jr-place-n", pick(lm.name)));
    t.appendChild(el("span", "jr-place-d", pick(lm.district)));
    li.appendChild(t);
    li.appendChild(el("span", "jr-place-b", pick(lm.blurb)));
    lList.appendChild(li);
  }
  lWrap.appendChild(lList);
  body.appendChild(lWrap);

  // ── endings preview ───────────────────────────────────────────
  const eWrap = el("section", "jr-sec");
  eWrap.appendChild(el("h3", "jr-h", l === "en" ? "Possible endings" : "النهايات الممكنة"));
  const eList = el("ul", "jr-endings");
  for (const key of Object.keys(ENDINGS)) {
    const e = ENDINGS[key];
    const achieved = endingId === key;
    const li = el("li", `jr-ending ${achieved ? "is-got" : ""}`);
    const dot = el("span", "jr-place-dot");
    dot.style.background = e.color;
    li.appendChild(dot);
    li.appendChild(el("span", "jr-ending-n", pick(e.name)));
    li.appendChild(el("span", "jr-ending-s", achieved ? (l === "en" ? "Reached" : "تحققت") : (l === "en" ? "Locked" : "مقفلة")));
    eList.appendChild(li);
  }
  eWrap.appendChild(eList);
  body.appendChild(eWrap);

  return true;
}

/** Wire the Story tab button + keyboard shortcut inside the pause menu. */
export function initJournal() {
  const btn = document.getElementById("pauseTabJournal");
  if (btn && !btn._jrBound) {
    btn._jrBound = true;
    btn.addEventListener("click", () => {
      try {
        window.SG_Menu && window.SG_Menu.switchPauseTab("journal");
      } catch (e) {
        // fall back to direct toggling if the menu module is not exposed
        const panel = document.getElementById("pauseJournalPanel");
        if (panel) panel.classList.add("active");
      }
      renderJournal();
    });
  }
  // Keep the tab list in sync if the pause menu is re-opened on this tab.
  window.addEventListener("languageChanged", () => {
    const panel = document.getElementById("pauseJournalPanel");
    if (panel && panel.classList.contains("active")) renderJournal();
  });
}

if (typeof window !== "undefined") {
  window.SG_Journal = { renderJournal, initJournal };
}