// ======================== CANVAS SETUP ========================
// Extracted from game.js:425-449, 52736-52740 - made resilient
export let canvas = typeof document !== 'undefined' ? document.getElementById("gameCanvas") : null;
export let ctx = canvas ? canvas.getContext("2d") : null;
export let W, H;
export let zoom = 1.0;
export const ZOOM_MIN = 0.5;
export const ZOOM_MAX = 2.5;

export let cam = { x: 0, y: 0 };

export function setZoom(v) { zoom = v; }
export function setW(v) { W = v; }
export function setH(v) { H = v; }

export function resizeCanvas() {
  if(!canvas){ W = typeof window !== 'undefined' ? window.innerWidth : 800; H = typeof window !== 'undefined' ? window.innerHeight : 600; return; }
  W = window.innerWidth;
  H = window.innerHeight;
  canvas.width = W;
  canvas.height = H;
}
try{ resizeCanvas(); }catch{}
if(typeof window !== 'undefined'){
  window.addEventListener('resize', () => {
    const gc = document.getElementById('gameContainer');
    if (gc && canvas) {
        canvas.width = gc.clientWidth;
        canvas.height = gc.clientHeight;
        W = gc.clientWidth;
        H = gc.clientHeight;
    } else {
        try{ resizeCanvas(); }catch{}
    }
  });
}

export let miniCanvas = typeof document !== 'undefined' ? document.getElementById("minimapCanvas") : null;
export let miniCtx = miniCanvas ? miniCanvas.getContext("2d") : null;
if(miniCanvas){ try{ miniCanvas.width = 180; miniCanvas.height = 180; }catch{} }
