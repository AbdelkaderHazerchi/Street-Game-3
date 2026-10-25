// ======================== FULL WORLD MAP ========================
// Renders complete world with zone palettes, player marker, pan/zoom, legend
import { CFG, T } from "../core/config.js?v=57";
import { LS_ZONES } from "../map/mapData.js?v=57";
import { getTile } from "../map/mapUtils.js?v=57";
import { specialBuildings } from "../map/mapState.js?v=57";
import { player } from "../entities/player.js?v=57";
import { police } from "../entities/police.js?v=57";
import { missionGivers, currentMission, quests } from "../missions/missionState.js?v=57";
import { getVisibleStartGivers, getActiveEndGiver, getActiveObjectiveTargets } from "../missions/missionSystem.js?v=57";

const zoneColors = {
  hills: "#B8966E",
  downtown: "#808080",
  suburb: "#E8D5B7",
  market: "#C4A882",
  midtown: "#909090",
  airport: "#B0B0B0",
  industrial: "#778899",
  beach: "#EECBAD",
  docks: "#7A8B8B",
};

const zoneLabels = {
  hills: "Vinewood Hills",
  downtown: "Downtown",
  suburb: "Suburb",
  market: "Market",
  midtown: "Midtown",
  airport: "Airport",
  industrial: "Industrial",
  beach: "Beach",
  docks: "Docks",
};

let canvasEl = null;
let ctx = null;
let dpr = 1;

let worldW = 0;
let worldH = 0;

let baseScale = 0.08;
let zoomLevel = 1;
const ZOOM_MIN = 0.4;
const ZOOM_MAX = 5;

let panX = 0;
let panY = 0;

let isDragging = false;
let dragStartX = 0;
let dragStartY = 0;
let dragPanX = 0;
let dragPanY = 0;

let rafId = null;
let active = false;
let needsRedraw = true;
let bound = false;

let resizeObserver = null;

function getEffectiveScale() {
  return baseScale * zoomLevel;
}

function computeBaseScale() {
  if (!canvasEl) return 0.08;
  const w = canvasEl.clientWidth || 600;
  const h = canvasEl.clientHeight || 400;
  worldW = CFG.COLS * CFG.TILE;
  worldH = CFG.ROWS * CFG.TILE;
  const sx = w / worldW;
  const sy = h / worldH;
  return Math.min(sx, sy) * 0.96;
}

function worldToScreen(wx, wy) {
  const s = getEffectiveScale();
  return { x: wx * s + panX, y: wy * s + panY };
}

function screenToWorld(sx, sy) {
  const s = getEffectiveScale();
  return { x: (sx - panX) / s, y: (sy - panY) / s };
}

function clampPan() {
  if (!canvasEl) return;
  const s = getEffectiveScale();
  const cw = canvasEl.clientWidth || 600;
  const ch = canvasEl.clientHeight || 400;
  const vw = worldW * s;
  const vh = worldH * s;
  // Allow panning beyond edges slightly but keep at least 20% visible
  const minPanX = cw - vw - 60;
  const maxPanX = 60;
  const minPanY = ch - vh - 60;
  const maxPanY = 60;
  // If world smaller than canvas, center
  if (vw < cw) {
    panX = (cw - vw) / 2;
  } else {
    panX = Math.max(minPanX, Math.min(maxPanX, panX));
  }
  if (vh < ch) {
    panY = (ch - vh) / 2;
  } else {
    panY = Math.max(minPanY, Math.min(maxPanY, panY));
  }
}

function setupCanvasSize() {
  if (!canvasEl) return;
  dpr = Math.min(window.devicePixelRatio || 1, 2);
  const rect = canvasEl.getBoundingClientRect();
  const w = Math.max(1, Math.round(rect.width * dpr));
  const h = Math.max(1, Math.round(rect.height * dpr));
  if (canvasEl.width !== w || canvasEl.height !== h) {
    canvasEl.width = w;
    canvasEl.height = h;
  }
  if (ctx) ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  // Recompute baseScale if not yet set or on resize
  const newBase = computeBaseScale();
  // Preserve effective scale ratio
  const oldEffective = getEffectiveScale();
  baseScale = newBase;
  // Adjust zoomLevel to keep same effective scale if previously set
  if (oldEffective && oldEffective !== baseScale) {
    // keep zoomLevel such that effective stays similar; but clamp
    const targetEffective = Math.max(baseScale * ZOOM_MIN, Math.min(baseScale * ZOOM_MAX, oldEffective));
    zoomLevel = targetEffective / baseScale;
  }
  needsRedraw = true;
}

function centerOnPlayer(animate = false) {
  if (!canvasEl) return;
  const cw = canvasEl.clientWidth || 600;
  const ch = canvasEl.clientHeight || 400;
  const s = getEffectiveScale();
  let px = worldW / 2;
  let py = worldH / 2;
  try {
    if (player && typeof player.x === "number" && typeof player.y === "number") {
      px = player.x;
      py = player.y;
    } else if (typeof window !== "undefined" && window.player && typeof window.player.x === "number") {
      px = window.player.x;
      py = window.player.y;
    }
  } catch {}
  const targetPanX = cw / 2 - px * s;
  const targetPanY = ch / 2 - py * s;
  if (animate) {
    const startX = panX;
    const startY = panY;
    const startT = performance.now();
    const dur = 260;
    function step(now) {
      const t = Math.min(1, (now - startT) / dur);
      const e = 1 - Math.pow(1 - t, 3);
      panX = startX + (targetPanX - startX) * e;
      panY = startY + (targetPanY - startY) * e;
      clampPan();
      needsRedraw = true;
      if (t < 1) requestAnimationFrame(step);
    }
    requestAnimationFrame(step);
  } else {
    panX = targetPanX;
    panY = targetPanY;
    clampPan();
    needsRedraw = true;
  }
}

function resetView() {
  if (!canvasEl) return;
  zoomLevel = 1;
  baseScale = computeBaseScale();
  centerOnPlayer();
  needsRedraw = true;
}

function onWheel(e) {
  e.preventDefault();
  const delta = e.deltaY > 0 ? 0.92 : 1.08;
  const newZoom = Math.max(ZOOM_MIN, Math.min(ZOOM_MAX, zoomLevel * delta));
  if (newZoom === zoomLevel) return;
  // Zoom toward cursor
  const rect = canvasEl.getBoundingClientRect();
  const cx = e.clientX - rect.left;
  const cy = e.clientY - rect.top;
  const worldBefore = screenToWorld(cx, cy);
  zoomLevel = newZoom;
  const s = getEffectiveScale();
  panX = cx - worldBefore.x * s;
  panY = cy - worldBefore.y * s;
  clampPan();
  needsRedraw = true;
  updateCoordsDisplay();
}

function onMouseDown(e) {
  isDragging = true;
  dragStartX = e.clientX;
  dragStartY = e.clientY;
  dragPanX = panX;
  dragPanY = panY;
  canvasEl.style.cursor = "grabbing";
  e.preventDefault();
}

function onMouseMove(e) {
  const rect = canvasEl.getBoundingClientRect();
  const mx = e.clientX - rect.left;
  const my = e.clientY - rect.top;
  // Update coords display
  const w = screenToWorld(mx, my);
  const coordsEl = document.getElementById("fullMapCoords");
  if (coordsEl) {
    coordsEl.textContent = `X:${Math.round(w.x)} Y:${Math.round(w.y)}  •  Zoom ${(zoomLevel*100).toFixed(0)}%`;
  }
  if (!isDragging) return;
  const dx = e.clientX - dragStartX;
  const dy = e.clientY - dragStartY;
  panX = dragPanX + dx;
  panY = dragPanY + dy;
  clampPan();
  needsRedraw = true;
}

function onMouseUp() {
  if (!isDragging) return;
  isDragging = false;
  if (canvasEl) canvasEl.style.cursor = "grab";
}

function onTouchStart(e) {
  if (e.touches.length === 1) {
    const t = e.touches[0];
    isDragging = true;
    dragStartX = t.clientX;
    dragStartY = t.clientY;
    dragPanX = panX;
    dragPanY = panY;
    e.preventDefault();
  }
}

function onTouchMove(e) {
  if (e.touches.length === 1 && isDragging) {
    const t = e.touches[0];
    const dx = t.clientX - dragStartX;
    const dy = t.clientY - dragStartY;
    panX = dragPanX + dx;
    panY = dragPanY + dy;
    clampPan();
    needsRedraw = true;
    e.preventDefault();
  } else if (e.touches.length === 2) {
    // Pinch zoom
    e.preventDefault();
  }
}

function onTouchEnd() {
  isDragging = false;
}

function updateCoordsDisplay() {
  const el = document.getElementById("fullMapCoords");
  if (el) el.textContent = `Zoom ${(zoomLevel*100).toFixed(0)}% — Drag to pan — Scroll to zoom`;
}

function buildLegend() {
  const legend = document.getElementById("fullMapLegend");
  if (!legend) return;
  legend.innerHTML = "";
  const title = document.createElement("div");
  title.className = "fullmap-legend-title";
  title.textContent = "Legend — Zones";
  legend.appendChild(title);
  // Deduplicate by pal
  const seen = new Set();
  for (const z of LS_ZONES) {
    if (seen.has(z.pal)) continue;
    seen.add(z.pal);
    const item = document.createElement("div");
    item.className = "fullmap-legend-item";
    const sw = document.createElement("span");
    sw.className = "fullmap-legend-swatch";
    sw.style.background = zoneColors[z.pal] || "#888";
    const label = document.createElement("span");
    label.textContent = z.name.split(" / ")[0].split(" — ")[0];
    // Use palette name as fallback
    if (!label.textContent || label.textContent.length < 2) label.textContent = zoneLabels[z.pal] || z.pal;
    item.appendChild(sw);
    item.appendChild(label);
    legend.appendChild(item);
  }
  // Player / markers legend
  const divider = document.createElement("div");
  divider.style.height = "1px";
  divider.style.background = "rgba(255,255,255,0.08)";
  divider.style.margin = "6px 0";
  legend.appendChild(divider);
  const markers = [
    { color: "#00ff88", label: "Player — اللاعب" },
    { color: "#ffd700", label: "Main Mission — رئيسية" },
    { color: "#a855f7", label: "Side Quest — جانبية" },
    { color: "#22c55e", label: "Objective — الهدف" },
    { color: "#ff3344", label: "Police — الشرطة" },
  ];
  for (const m of markers) {
    const item = document.createElement("div");
    item.className = "fullmap-legend-item";
    const sw = document.createElement("span");
    sw.className = "fullmap-legend-swatch";
    sw.style.background = m.color;
    sw.style.borderRadius = "50%";
    const label = document.createElement("span");
    label.textContent = m.label;
    label.style.fontSize = "10px";
    item.appendChild(sw);
    item.appendChild(label);
    legend.appendChild(item);
  }
}

function bindEvents() {
  if (bound || !canvasEl) return;
  canvasEl.addEventListener("wheel", onWheel, { passive: false });
  canvasEl.addEventListener("mousedown", onMouseDown);
  window.addEventListener("mousemove", onMouseMove);
  window.addEventListener("mouseup", onMouseUp);
  canvasEl.addEventListener("mouseleave", onMouseUp);
  canvasEl.addEventListener("touchstart", onTouchStart, { passive: false });
  window.addEventListener("touchmove", onTouchMove, { passive: false });
  window.addEventListener("touchend", onTouchEnd);
  bound = true;
}

function unbindEvents() {
  if (!canvasEl || !bound) return;
  try {
    canvasEl.removeEventListener("wheel", onWheel);
    canvasEl.removeEventListener("mousedown", onMouseDown);
    window.removeEventListener("mousemove", onMouseMove);
    window.removeEventListener("mouseup", onMouseUp);
    canvasEl.removeEventListener("mouseleave", onMouseUp);
    canvasEl.removeEventListener("touchstart", onTouchStart);
    window.removeEventListener("touchmove", onTouchMove);
    window.removeEventListener("touchend", onTouchEnd);
  } catch {}
  bound = false;
}

function drawWorld() {
  if (!ctx || !canvasEl) return;
  const w = canvasEl.clientWidth || 600;
  const h = canvasEl.clientHeight || 400;
  // Clear
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = "#0a0e1a";
  ctx.fillRect(0, 0, w, h);

  const s = getEffectiveScale();

  // Cull test helper
  const isVisible = (rx, ry, rw, rh) => {
    return !(rx + rw < 0 || ry + rh < 0 || rx > w || ry > h);
  };

  // Draw zone backgrounds
  for (const z of LS_ZONES) {
    const wx = z.x1 * CFG.TILE;
    const wy = z.y1 * CFG.TILE;
    const ww = (z.x2 - z.x1 + 1) * CFG.TILE;
    const wh = (z.y2 - z.y1 + 1) * CFG.TILE;
    const sx = wx * s + panX;
    const sy = wy * s + panY;
    const sw = ww * s;
    const sh = wh * s;
    if (!isVisible(sx, sy, sw, sh)) continue;
    ctx.fillStyle = zoneColors[z.pal] || "#888";
    ctx.fillRect(sx, sy, sw, sh);
    // subtle border
    ctx.strokeStyle = "rgba(0,0,0,0.18)";
    ctx.lineWidth = 1;
    ctx.strokeRect(sx, sy, sw, sh);
  }

  // Draw tiles overlay for detail when zoomed enough
  // Show roads/parks etc when effective scale is reasonable
  const showDetails = s > 0.02;
  if (showDetails) {
    const step = s > 0.06 ? 1 : 2;
    // Iterate tiles
    for (let y = 0; y < CFG.ROWS; y += step) {
      for (let x = 0; x < CFG.COLS; x += step) {
        const wx = x * CFG.TILE;
        const wy = y * CFG.TILE;
        const sx = wx * s + panX;
        const sy = wy * s + panY;
        const ss = CFG.TILE * step * s;
        if (!isVisible(sx, sy, ss, ss)) continue;
        // Skip if outside world? getTile handles
        const tile = getTile(x, y);
        if (tile === T.WATER) {
          ctx.fillStyle = "#1a5276";
          ctx.fillRect(sx, sy, ss, ss);
        } else if (tile === T.ROAD) {
          ctx.fillStyle = "rgba(52,52,58,0.95)";
          ctx.fillRect(sx, sy, ss, ss);
          // road center line when zoomed close
          if (s > 0.08 && step === 1) {
            ctx.fillStyle = "rgba(255,215,0,0.45)";
            const cx = sx + ss/2 - 0.5;
            ctx.fillRect(cx, sy, 1, ss);
          }
        } else if (tile === T.PARK) {
          ctx.fillStyle = "#2d6a2e";
          ctx.fillRect(sx+1, sy+1, Math.max(1, ss-2), Math.max(1, ss-2));
        } else if (tile === T.PARKING) {
          ctx.fillStyle = "#4a4a5a";
          ctx.fillRect(sx, sy, ss, ss);
        } else if (tile === T.SIDEWALK) {
          ctx.fillStyle = "#e8d4a0";
          ctx.fillRect(sx, sy, ss, ss);
        } else if (tile === T.PAVEMENT) {
          ctx.fillStyle = "#9a9aa0";
          ctx.fillRect(sx, sy, ss, ss);
        } else if (tile === T.SPECIAL) {
          const sb = specialBuildings.find((b) => b.x === x && b.y === y);
          if (sb) {
            ctx.fillStyle = sb.color || "#ff6b6b";
            ctx.fillRect(sx, sy, ss, ss);
            ctx.strokeStyle = "rgba(0,0,0,0.25)";
            ctx.lineWidth = 1;
            ctx.strokeRect(sx, sy, ss, ss);
          }
        }
      }
    }
  }

  // Grid lines faint when zoomed in
  if (s > 0.1) {
    ctx.strokeStyle = "rgba(255,255,255,0.04)";
    ctx.lineWidth = 1;
    for (const z of LS_ZONES) {
      const sx = z.x1 * CFG.TILE * s + panX;
      const sy = z.y1 * CFG.TILE * s + panY;
      const sw = (z.x2 - z.x1 + 1) * CFG.TILE * s;
      const sh = (z.y2 - z.y1 + 1) * CFG.TILE * s;
      if (!isVisible(sx, sy, sw, sh)) continue;
      ctx.strokeRect(sx, sy, sw, sh);
    }
  }

  // Zone labels
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  for (const z of LS_ZONES) {
    const cx = ((z.x1 + z.x2) / 2) * CFG.TILE * s + panX;
    const cy = ((z.y1 + z.y2) / 2) * CFG.TILE * s + panY;
    const zw = (z.x2 - z.x1 + 1) * CFG.TILE * s;
    const zh = (z.y2 - z.y1 + 1) * CFG.TILE * s;
    if (!isVisible(cx - zw/2, cy - zh/2, zw, zh)) continue;
    // Only label if zone big enough on screen
    if (zw < 40 || zh < 24) continue;
    const fontSize = Math.max(9, Math.min(14, Math.min(zw, zh) * 0.09));
    ctx.font = `800 ${fontSize}px 'Segoe UI', system-ui, sans-serif`;
    // Shadow
    ctx.fillStyle = "rgba(0,0,0,0.45)";
    // wrap? use first word if long
    const name = z.name;
    const short = name.length > 18 ? name.split(" / ")[0] : name;
    ctx.fillText(short, cx + 1, cy + 1);
    ctx.fillStyle = "rgba(255,255,255,0.92)";
    ctx.strokeStyle = "rgba(0,0,0,0.45)";
    ctx.lineWidth = 3;
    ctx.strokeText(short, cx, cy);
    ctx.fillText(short, cx, cy);
  }

  // Mission givers & objectives
  try {
    const givers = (quests && quests.length > 0)
      ? (typeof getVisibleStartGivers === "function" ? getVisibleStartGivers() : [])
      : (missionGivers || []);
    for (const mg of givers) {
      if (!mg || typeof mg.x !== "number") continue;
      const p = worldToScreen(mg.x, mg.y);
      if (p.x < -10 || p.y < -10 || p.x > w + 10 || p.y > h + 10) continue;
      const isSide = mg.category === "side";
      const radius = isSide ? 6 : 7;
      // glow
      ctx.fillStyle = isSide ? "rgba(168,85,247,0.28)" : "rgba(255,215,0,0.28)";
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius + 5, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = isSide ? "#a855f7" : "#ffd700";
      ctx.beginPath();
      ctx.arc(p.x, p.y, radius, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.85)";
      ctx.lineWidth = 1.5;
      ctx.stroke();
      // label icon
      ctx.fillStyle = "#fff";
      ctx.font = "700 7px sans-serif";
      ctx.textAlign = "center";
      ctx.fillText(isSide ? "S" : "M", p.x, p.y + 2.5);
    }
  } catch {}

  try {
    const activeEnd = typeof getActiveEndGiver === "function" ? getActiveEndGiver() : null;
    if (activeEnd && typeof activeEnd.x === "number") {
      const p = worldToScreen(activeEnd.x, activeEnd.y);
      if (!(p.x < -15 || p.y < -15 || p.x > w + 15 || p.y > h + 15)) {
        ctx.fillStyle = "rgba(34,197,94,0.25)";
        ctx.beginPath(); ctx.arc(p.x, p.y, 11, 0, Math.PI*2); ctx.fill();
        ctx.fillStyle = "#22c55e";
        ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI*2); ctx.fill();
        ctx.strokeStyle = "rgba(255,255,255,0.9)"; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = "#fff"; ctx.font="700 8px sans-serif"; ctx.textAlign="center"; ctx.fillText("◎", p.x, p.y + 2.5);
      }
    }
  } catch {}

  if (currentMission && !currentMission.completed && !currentMission.failed) {
    try {
      const stage = currentMission.stages ? currentMission.stages[currentMission.stage] : null;
      const isQuestEndStage = stage && stage.isQuestEnd;
      const targets = (typeof getActiveObjectiveTargets === "function") ? getActiveObjectiveTargets() : [];
      const tlist = targets.length ? targets : (stage && stage.x ? [stage] : []);
      for (const tg of tlist) {
        if (isQuestEndStage) continue;
        const p = worldToScreen(tg.x, tg.y);
        if (!(p.x < -10 || p.y < -10 || p.x > w + 10 || p.y > h + 10)) {
          ctx.fillStyle = "rgba(34,197,94,0.25)";
          ctx.beginPath(); ctx.arc(p.x, p.y, 12, 0, Math.PI*2); ctx.fill();
          ctx.fillStyle = "#00ff88";
          ctx.beginPath(); ctx.arc(p.x, p.y, 7, 0, Math.PI*2); ctx.fill();
          ctx.strokeStyle = "#fff"; ctx.lineWidth = 1.2; ctx.stroke();
        }
      }
    } catch {}
  }

  // Police
  try {
    for (const pp of (police || [])) {
      if (!pp || typeof pp.x !== "number") continue;
      const p = worldToScreen(pp.x, pp.y);
      if (p.x < -10 || p.y < -10 || p.x > w + 10 || p.y > h + 10) continue;
      ctx.fillStyle = "#ff3344";
      ctx.beginPath(); ctx.arc(p.x, p.y, 4, 0, Math.PI*2); ctx.fill();
      ctx.strokeStyle = "rgba(255,255,255,0.7)"; ctx.lineWidth = 1; ctx.stroke();
    }
  } catch {}

  // Player marker — triangle arrow
  try {
    let px = null, py = null, angle = 0;
    if (player && typeof player.x === "number") {
      px = player.x; py = player.y; angle = player.angle || 0;
      if (player.inVehicle && typeof player.inVehicle.x === "number") {
        px = player.inVehicle.x; py = player.inVehicle.y; angle = player.inVehicle.angle || angle;
      }
    } else if (typeof window !== "undefined" && window.player && typeof window.player.x === "number") {
      px = window.player.x; py = window.player.y; angle = window.player.angle || 0;
    }
    if (px !== null) {
      const p = worldToScreen(px, py);
      // Always draw even if slightly off-screen? clamp to edge?
      const drawX = Math.max(14, Math.min(w - 14, p.x));
      const drawY = Math.max(14, Math.min(h - 14, p.y));
      const isClamped = drawX !== p.x || drawY !== p.y;
      const size = 10;
      ctx.save();
      ctx.translate(drawX, drawY);
      ctx.rotate(angle);
      // outer glow
      ctx.fillStyle = isClamped ? "rgba(255,80,80,0.9)" : "rgba(0,255,136,0.95)";
      ctx.shadowColor = isClamped ? "rgba(255,80,80,0.6)" : "rgba(0,255,136,0.6)";
      ctx.shadowBlur = 10;
      ctx.beginPath();
      ctx.moveTo(size, 0);
      ctx.lineTo(-size*0.7, -size*0.6);
      ctx.lineTo(-size*0.4, 0);
      ctx.lineTo(-size*0.7, size*0.6);
      ctx.closePath();
      ctx.fill();
      // inner highlight
      ctx.shadowBlur = 0;
      ctx.fillStyle = "#ffffff";
      ctx.beginPath();
      ctx.arc(1, 0, 2, 0, Math.PI*2);
      ctx.fill();
      // border
      ctx.strokeStyle = "rgba(0,0,0,0.5)";
      ctx.lineWidth = 1;
      ctx.stroke();
      ctx.restore();

      // player label
      if (!isClamped) {
        ctx.fillStyle = "rgba(0,255,136,0.95)";
        ctx.font = "700 10px 'Segoe UI', sans-serif";
        ctx.textAlign = "center";
        ctx.strokeStyle = "rgba(0,0,0,0.7)";
        ctx.lineWidth = 3;
        const label = "YOU";
        ctx.strokeText(label, drawX, drawY - 16);
        ctx.fillText(label, drawX, drawY - 16);
      }
    }
  } catch {}
}

function loop() {
  if (!active) return;
  rafId = requestAnimationFrame(loop);
  if (!needsRedraw) return;
  // Limit to ~60 fps but only when needed
  drawWorld();
  needsRedraw = false;
}

export function initFullMap() {
  canvasEl = document.getElementById("fullMapCanvas");
  if (!canvasEl) return false;
  ctx = canvasEl.getContext("2d");
  if (!ctx) return false;
  worldW = CFG.COLS * CFG.TILE;
  worldH = CFG.ROWS * CFG.TILE;
  setupCanvasSize();
  buildLegend();
  bindEvents();
  // Wire zoom buttons
  const zin = document.getElementById("fullMapZoomIn");
  const zout = document.getElementById("fullMapZoomOut");
  const cbtn = document.getElementById("fullMapCenterBtn");
  const rbtn = document.getElementById("fullMapResetBtn");
  if (zin && !zin._fmBound) {
    zin._fmBound = true;
    zin.addEventListener("click", () => {
      const newZoom = Math.min(ZOOM_MAX, zoomLevel * 1.25);
      const cw = canvasEl.clientWidth/2, ch = canvasEl.clientHeight/2;
      const wb = screenToWorld(cw, ch);
      zoomLevel = newZoom;
      const s = getEffectiveScale();
      panX = cw - wb.x * s;
      panY = ch - wb.y * s;
      clampPan(); needsRedraw = true; updateCoordsDisplay();
    });
  }
  if (zout && !zout._fmBound) {
    zout._fmBound = true;
    zout.addEventListener("click", () => {
      const newZoom = Math.max(ZOOM_MIN, zoomLevel * 0.8);
      const cw = canvasEl.clientWidth/2, ch = canvasEl.clientHeight/2;
      const wb = screenToWorld(cw, ch);
      zoomLevel = newZoom;
      const s = getEffectiveScale();
      panX = cw - wb.x * s;
      panY = ch - wb.y * s;
      clampPan(); needsRedraw = true; updateCoordsDisplay();
    });
  }
  if (cbtn && !cbtn._fmBound) {
    cbtn._fmBound = true;
    cbtn.addEventListener("click", () => centerOnPlayer(true));
  }
  if (rbtn && !rbtn._fmBound) {
    rbtn._fmBound = true;
    rbtn.addEventListener("click", () => resetView());
  }
  // Initialize view to center on player if first time
  if (panX === 0 && panY === 0) {
    centerOnPlayer(false);
  } else {
    clampPan();
  }
  active = true;
  needsRedraw = true;
  updateCoordsDisplay();
  if (rafId) cancelAnimationFrame(rafId);
  loop();
  // Observe resize
  const wrap = canvasEl.parentElement;
  if (wrap && typeof ResizeObserver !== "undefined" && !resizeObserver) {
    resizeObserver = new ResizeObserver(() => {
      setupCanvasSize();
      clampPan();
      needsRedraw = true;
    });
    resizeObserver.observe(wrap);
    resizeObserver.observe(canvasEl);
  } else {
    window.addEventListener("resize", setupCanvasSize);
  }
  // Trigger redraw on next frame continuously while panning? already handled
  return true;
}

export function destroyFullMap() {
  active = false;
  if (rafId) { cancelAnimationFrame(rafId); rafId = null; }
  unbindEvents();
  if (resizeObserver) {
    try { resizeObserver.disconnect(); } catch {}
    resizeObserver = null;
  } else {
    try { window.removeEventListener("resize", setupCanvasSize); } catch {}
  }
  isDragging = false;
  needsRedraw = true;
}

export function refreshFullMap() {
  needsRedraw = true;
}

export function isFullMapActive() {
  return active;
}

export { centerOnPlayer, resetView };
