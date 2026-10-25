// ======================== MAP DATA (loader) ========================
// Map data lives in the separate JSON file next to this module:
//   js/map/mapData.json  (120x120 city, buildings, shops, quests, zones)
// This module is the single access point: it fetches the JSON once and
// re-exports it as MAP_DATA (live binding). LS_ZONES stays static here as
// the default zone table (renderers import it synchronously at startup).

export let MAP_DATA = null;

// Bump this when tools/generate_city.py rewrites mapData.json, otherwise the
// browser keeps serving the previous city from its HTTP cache.
export const MAP_DATA_VERSION = 38;

export async function ensureMapData() {
  if (MAP_DATA) return MAP_DATA;
  if (!ensureMapData._p) {
    ensureMapData._p = fetch(new URL(`./mapData.json?v=${MAP_DATA_VERSION}`, import.meta.url))
      .then((res) => {
        if (!res.ok) throw new Error("mapData.json HTTP " + res.status);
        return res.json();
      })
      .then((data) => {
        MAP_DATA = data;
        if (typeof window !== "undefined") window.MAP_DATA = data;
        return MAP_DATA;
      })
      .catch((err) => {
        ensureMapData._p = null;
        throw err;
      });
  }
  return ensureMapData._p;
}

// Default zone table. These rectangles come from the 6 x 6 block grid in
// tools/generate_city.py and must stay in step with the `zones` array inside
// mapData.json, which replaces them at load time. Every district is a clean
// rectangle on the block grid; the three waterfront districts also own the
// boulevard along their northern edge, so they have a street of their own.
export const LS_ZONES = [
  {
    name: "Vinewood Hills",
    x1: 0,
    y1: 0,
    x2: 36,
    y2: 37,
    pal: "hills",
  },
  {
    name: "Downtown",
    x1: 41,
    y1: 0,
    x2: 77,
    y2: 37,
    pal: "downtown",
  },
  {
    name: "East LS",
    x1: 82,
    y1: 0,
    x2: 119,
    y2: 37,
    pal: "suburb",
  },
  {
    name: "Market / Rodeo",
    x1: 0,
    y1: 42,
    x2: 36,
    y2: 77,
    pal: "market",
  },
  {
    name: "Midtown",
    x1: 41,
    y1: 42,
    x2: 77,
    y2: 77,
    pal: "midtown",
  },
  {
    name: "LS Airport",
    x1: 82,
    y1: 42,
    x2: 119,
    y2: 77,
    pal: "airport",
  },
  {
    name: "Industrial",
    x1: 0,
    y1: 82,
    x2: 36,
    y2: 98,
    pal: "industrial",
  },
  {
    name: "South Central",
    x1: 41,
    y1: 82,
    x2: 77,
    y2: 98,
    pal: "suburb",
  },
  {
    name: "Vespucci Beach",
    x1: 82,
    y1: 82,
    x2: 119,
    y2: 98,
    pal: "beach",
  },
  {
    name: "Port / Docks",
    x1: 0,
    y1: 99,
    x2: 36,
    y2: 119,
    pal: "docks",
  },
  {
    name: "South LS",
    x1: 41,
    y1: 99,
    x2: 77,
    y2: 119,
    pal: "suburb",
  },
  {
    name: "Santa Maria Beach",
    x1: 82,
    y1: 99,
    x2: 119,
    y2: 119,
    pal: "beach",
  },
];