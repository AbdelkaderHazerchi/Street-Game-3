// ============================================================================
// STORY LANDMARKS — Street Game 2 : "The Ghost Ledger"
// Six narrative locations stamped into the world map at load time.
// Each landmark occupies a square footprint and is placed on building tiles
// so it never blocks a road. Positions were validated against mapData.json.
// ============================================================================

import { CFG, T } from "../core/config.js?v=57";
import { map, specialBuildings, buildings, buildingRotation } from "../map/mapState.js?v=57";

/**
 * size: footprint in tiles (square). x,y = top-left tile.
 * find: zone hint used only for the journal / minimap label.
 */
export const LANDMARKS = [
  {
    id: "hq_alras", size: 2, x: 6, y: 15, color: "#e8a33d",
    name: { ar: "مقر الأعلى", en: "Al-Ras's HQ" },
    district: { ar: "فينيوود هيلز", en: "Vinewood Hills" },
    blurb: { ar: "البوابة الذهبية. هنا بدأ كل شيء.", en: "The golden gate. Where it all started." }
  },
  {
    id: "house_salma", size: 2, x: 108, y: 7, color: "#f472b6",
    name: { ar: "بيت سلمى", en: "Salma's House" },
    district: { ar: "إيست لوس", en: "East LS" },
    blurb: { ar: "ستارة خضراء وبوابة حديقة مفتوحة.", en: "A green curtain and an open garden gate." }
  },
  {
    id: "tower_tg", size: 2, x: 8, y: 88, color: "#a78bfa",
    name: { ar: "مقر الحارس", en: "The Warden's Tower" },
    district: { ar: "المنطقة الصناعية", en: "Industrial" },
    blurb: { ar: "برج بهوائي. لا أحد يشرح ما هو.", en: "A tower with an antenna. Nobody explains what it is." }
  },
  {
    id: "cafe_hakim", size: 2, x: 41, y: 27, color: "#9ca3af",
    name: { ar: "مقهى حكيم", en: "Hakim's Café" },
    district: { ar: "داون تاون", en: "Downtown" },
    blurb: { ar: "الطاولة في الزاوية. لا تنظر إلى الباب.", en: "The corner table. Do not look at the door." }
  },
  {
    id: "hideout_serpent", size: 2, x: 8, y: 107, color: "#ef4444",
    name: { ar: "مخبأ الأفعى", en: "The Serpent's Hideout" },
    district: { ar: "الميناء", en: "Port and Docks" },
    blurb: { ar: "الحاوية رقم سبعة. الوحيدة المفتوحة.", en: "Container seven. The only one left open." }
  },
  {
    id: "precinct_qasim", size: 2, x: 41, y: 50, color: "#60a5fa",
    name: { ar: "مركز قاسم", en: "Qasim's Precinct" },
    district: { ar: "ميدتاون", en: "Midtown" },
    blurb: { ar: "مركز شرطة فاسد. ليس فاسداً تماماً.", en: "A corrupt precinct. Not entirely corrupt." }
  },
];

/** Human-readable landmark list for the journal. */
export function getLandmarks() { return LANDMARKS; }

/**
 * Stamp the landmarks into the live map: convert their footprint to SPECIAL
 * tiles and register them in specialBuildings so every renderer picks them up
 * (world renderer, minimap, full map).
 *
 * Safe to call more than once - already-stamped landmarks are skipped.
 * Landmarks that fall on a road or out of bounds are skipped, never blocked.
 */
export function installLandmarks() {
  let placed = 0;
  for (const lm of LANDMARKS) {
    if (lm._placed) continue;
    const { x, y, size } = lm;
    // Bounds check
    if (x < 0 || y < 0 || x + size > CFG.COLS || y + size > CFG.ROWS) continue;

    // Validate every tile of the footprint is a plain building tile.
    // Never overwrite road / water / park / an existing special tile.
    let ok = true;
    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        const t = map[y + dy] ? map[y + dy][x + dx] : undefined;
        if (t !== T.BUILDING) { ok = false; break; }
      }
      if (!ok) break;
    }
    if (!ok) {
      console.warn(`[landmarks] skipped ${lm.id}: footprint is not free building tiles`);
      continue;
    }
    // Already registered?
    const dup = specialBuildings.some((sb) => sb.storyId === lm.id);
    if (dup) { lm._placed = true; continue; }

    for (let dy = 0; dy < size; dy++) {
      for (let dx = 0; dx < size; dx++) {
        map[y + dy][x + dx] = T.SPECIAL;
        specialBuildings.push({
          x: x + dx,
          y: y + dy,
          color: lm.color,
          name: `${lm.name.en}`,
          storyId: lm.id,
          landmark: true,
        });
      }
    }

    // Drop any plain-building entry that overlapped this footprint, otherwise
    // the generic building pass would still draw a house underneath the landmark.
    try {
      for (let i = buildings.length - 1; i >= 0; i--) {
        const b = buildings[i];
        const spanX = b.w || 1, spanY = b.h || 1;
        const overlaps = b.x < x + size && b.x + spanX > x && b.y < y + size && b.y + spanY > y;
        if (overlaps) buildings.splice(i, 1);
      }
    } catch (e) { console.warn("[landmarks] could not prune buildings list", e); }

    // Deterministic rotation so the landmark does not jitter between reloads.
    try {
      if (buildingRotation && buildingRotation[y] && buildingRotation[y][x] !== undefined) {
        for (let dy = 0; dy < size; dy++) {
          for (let dx = 0; dx < size; dx++) {
            if (buildingRotation[y + dy]) buildingRotation[y + dy][x + dx] = lm.rot || 0;
          }
        }
      }
    } catch {}

    lm._placed = true;
    placed++;
  }
  if (placed) console.log(`[landmarks] placed ${placed} story landmarks`);
  return placed;
}