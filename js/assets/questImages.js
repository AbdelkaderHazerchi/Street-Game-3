// ============================================================================
// QUEST ARTWORK — Street Game 2
// Resolves the full-screen image shown on the quest accept screen.
//
// Resolution order
//   1. `image` on the quest definition  ->  { id:"s1_first_job", image:"assets/quests/job.jpg" }
//   2. QUEST_ART[id]                    ->  drop a file in assets/quests/ and list its name
//   3. generated placeholder            ->  inline SVG, unique per quest id
//
// The placeholder is procedural on purpose: every quest gets its own look
// (hue derived from the id + the quest icon) so the accept screen already
// reads as artwork while the real illustrations are still being produced.
// Nothing here imports the game, so any module can use it.
// ============================================================================

/** Folder searched by the loader for real quest art. */
export const QUEST_ART_DIR = "assets/quests/";

/**
 * Real art overrides, filled in as illustrations land.
 *   QUEST_ART["s1_first_job"] = "s1_first_job.jpg";
 * Values without a leading slash and without a scheme are resolved inside
 * QUEST_ART_DIR; pass "assets/quests/x.png" or a URL to bypass that.
 */
export const QUEST_ART = Object.create(null);

/** Stable hue per quest id so a quest always looks the same. */
function hashHue(str) {
  let h = 0;
  for (let i = 0; i < str.length; i++) h = (h * 31 + str.charCodeAt(i)) >>> 0;
  return h % 360;
}

function resolvePath(value) {
  const v = String(value || "").trim();
  if (!v) return "";
  if (/^(https?:|data:|blob:|\/)/i.test(v)) return v;
  return QUEST_ART_DIR + v.replace(/^[\.\/\\]+/, "");
}

/**
 * Build the placeholder artwork for a quest as an inline SVG data URI.
 * Deterministic: same quest id always yields the same image.
 */
export function placeholderQuestArt(quest) {
  const id = String((quest && quest.id) || "quest");
  const icon = String((quest && quest.icon) || "⭐");
  const hue = hashHue(id);
  const hue2 = (hue + 42) % 360;

  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900">` +
      `<defs>` +
        `<linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">` +
          `<stop offset="0" stop-color="hsl(${hue},58%,16%)"/>` +
          `<stop offset="0.55" stop-color="hsl(${hue2},52%,11%)"/>` +
          `<stop offset="1" stop-color="hsl(${hue},62%,6%)"/>` +
        `</linearGradient>` +
        `<radialGradient id="glow" cx="0.5" cy="0.42" r="0.62">` +
          `<stop offset="0" stop-color="hsl(${hue2},85%,62%)" stop-opacity="0.34"/>` +
          `<stop offset="1" stop-color="hsl(${hue},80%,50%)" stop-opacity="0"/>` +
        `</radialGradient>` +
        `<pattern id="hatch" width="34" height="34" patternUnits="userSpaceOnUse" patternTransform="rotate(35)">` +
          `<line x1="0" y1="0" x2="0" y2="34" stroke="hsl(${hue2},70%,70%)" stroke-opacity="0.10" stroke-width="8"/>` +
        `</pattern>` +
      `</defs>` +
      `<rect width="1600" height="900" fill="url(#bg)"/>` +
      `<rect width="1600" height="900" fill="url(#hatch)"/>` +
      `<rect width="1600" height="900" fill="url(#glow)"/>` +
      // frame + corner marks so it reads as an illustration plate
      `<rect x="42" y="42" width="1516" height="816" fill="none" stroke="hsl(${hue2},80%,72%)" stroke-opacity="0.30" stroke-width="3"/>` +
      `<g stroke="hsl(${hue2},85%,75%)" stroke-opacity="0.55" stroke-width="6" stroke-linecap="round">` +
        `<path d="M70 150 L70 70 L150 70"/><path d="M1450 70 L1530 70 L1530 150"/>` +
        `<path d="M1530 750 L1530 830 L1450 830"/><path d="M150 830 L70 830 L70 750"/>` +
      `</g>` +
      // the quest icon, large and centred behind the dialogue panel
      `<text x="800" y="560" font-size="300" text-anchor="middle" opacity="0.92">${icon}</text>` +
      `<text x="800" y="640" font-size="26" letter-spacing="12" text-anchor="middle"` +
        ` fill="hsl(${hue2},80%,78%)" fill-opacity="0.45" font-family="Tahoma,Arial,sans-serif">PLACEHOLDER ART</text>` +
      `<rect y="620" width="1600" height="280" fill="#05040a" fill-opacity="0.35"/>` +
    `</svg>`;

  return "data:image/svg+xml;charset=utf-8," + encodeURIComponent(svg);
}

/**
 * Resolve the artwork for a quest.
 * @returns {{src:string, placeholder:boolean}} `placeholder` is true when the
 *          generated SVG is used, so callers can skip the load-error fallback.
 */
export function getQuestImage(quest) {
  const explicit = quest && typeof quest.image === "string" ? quest.image.trim() : "";
  if (explicit) return { src: resolvePath(explicit), placeholder: false };

  const id = quest && quest.id ? String(quest.id) : "";
  const mapped = id ? QUEST_ART[id] : "";
  if (mapped) return { src: resolvePath(mapped), placeholder: false };

  return { src: placeholderQuestArt(quest), placeholder: true };
}

if (typeof window !== "undefined") {
  window.SG_QuestImages = { QUEST_ART, QUEST_ART_DIR, getQuestImage, placeholderQuestArt };
}
