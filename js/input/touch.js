// ======================== TOUCH CONTROLS ========================
// Extracted from game.js:55169-55389 - no logic changed
import { fireWeapon } from "../combat/shooting.js?v=57";

export const touchHold = {};
export const touchEdge = {};
export let touchJoyX = 0,
  touchJoyY = 0;
export let touchAimAngle = null;
export let isTouchDevice = false;
export let shootTouchId = null;

export function setTouchJoyX(v){ touchJoyX = v; }
export function setTouchJoyY(v){ touchJoyY = v; }
export function setTouchAimAngle(v){ touchAimAngle = v; }
export function setIsTouchDevice(v){ isTouchDevice = v; }
export function setShootTouchId(v){ shootTouchId = v; }

export function findTouch(touchList, id) {
  for (let i = 0; i < touchList.length; i++) {
    if (touchList[i].identifier === id) return touchList[i];
  }
  return null;
}

export function updateJoystick(tx, ty, cx, cy, knob) {
  let dx = tx - cx;
  let dy = ty - cy;
  const dist = Math.hypot(dx, dy);
  const maxR = 50;
  const clamped = dist > maxR;
  if (clamped) {
    dx = (dx / dist) * maxR;
    dy = (dy / dist) * maxR;
  }
  const pctX = dx / maxR,
    pctY = dy / maxR;
  knob.style.transform = `translate(${-50 + pctX * 50}%,${-50 + pctY * 50}%)`;
  const deadzone = 0.15;
  touchJoyX = Math.abs(pctX) > deadzone ? pctX : 0;
  touchJoyY = Math.abs(pctY) > deadzone ? pctY : 0;
}

export function initTouchControls() {
  isTouchDevice = "ontouchstart" in window || navigator.maxTouchPoints > 0;
  if (!isTouchDevice) return;

  const tc = document.getElementById("touchControls");
  if (!tc) return;
  tc.classList.add("active");
  const gc = document.getElementById("gameContainer");
  if (gc) gc.classList.add("touch-active");

  // Left movement joystick
  const jZone = document.getElementById("joystickZone");
  const jKnob = document.getElementById("joystickKnob");
  if(!jZone || !jKnob) return;
  let jTouchId = null;

  jZone.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (jTouchId !== null) return;
      const touch = e.changedTouches[0];
      jTouchId = touch.identifier;
      const rect = jZone.getBoundingClientRect();
      jZone._cx = rect.left + rect.width / 2;
      jZone._cy = rect.top + rect.height / 2;
      jKnob.classList.add("active");
      updateJoystick(touch.clientX, touch.clientY, jZone._cx, jZone._cy, jKnob);
    },
    {
      passive: false,
    },
  );

  jZone.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const touch = findTouch(e.changedTouches, jTouchId);
      if (!touch) return;
      updateJoystick(touch.clientX, touch.clientY, jZone._cx, jZone._cy, jKnob);
    },
    {
      passive: false,
    },
  );

  jZone.addEventListener(
    "touchend",
    (e) => {
      if (!findTouch(e.changedTouches, jTouchId)) return;
      jTouchId = null;
      touchJoyX = 0;
      touchJoyY = 0;
      jKnob.style.transform = "translate(-50%,-50%)";
      jKnob.classList.remove("active");
    },
    {
      passive: false,
    },
  );

  jZone.addEventListener(
    "touchcancel",
    () => {
      jTouchId = null;
      touchJoyX = 0;
      touchJoyY = 0;
      jKnob.style.transform = "translate(-50%,-50%)";
      jKnob.classList.remove("active");
    },
    {
      passive: false,
    },
  );

  // Right shoot-button-as-aim-joystick
  const shootBtn = tc.querySelector('[data-touch-action="shoot"]');
  if(!shootBtn) return;
  shootBtn.addEventListener(
    "touchstart",
    (e) => {
      e.preventDefault();
      if (shootTouchId !== null) return;
      const touch = e.changedTouches[0];
      shootTouchId = touch.identifier;
      const rect = shootBtn.getBoundingClientRect();
      shootBtn._cx = rect.left + rect.width / 2;
      shootBtn._cy = rect.top + rect.height / 2;
      shootBtn.classList.add("pressed");
    },
    {
      passive: false,
    },
  );

  shootBtn.addEventListener(
    "touchmove",
    (e) => {
      e.preventDefault();
      const touch = findTouch(e.changedTouches, shootTouchId);
      if (!touch) return;
      const dx = touch.clientX - shootBtn._cx;
      const dy = touch.clientY - shootBtn._cy;
      const dist = Math.hypot(dx, dy);
      if (dist > 10) {
        touchAimAngle = Math.atan2(dy, dx);
      }
    },
    {
      passive: false,
    },
  );

  shootBtn.addEventListener(
    "touchend",
    (e) => {
      if (!findTouch(e.changedTouches, shootTouchId)) return;
      const wasShooting = shootTouchId !== null;
      shootTouchId = null;
      shootBtn.classList.remove("pressed");
      if(wasShooting) fireWeapon();
    },
    {
      passive: false,
    },
  );

  shootBtn.addEventListener(
    "touchcancel",
    () => {
      shootTouchId = null;
      shootBtn.classList.remove("pressed");
    },
    {
      passive: false,
    },
  );

  // General buttons (all except shoot - handled above)
  tc.addEventListener(
    "touchstart",
    (e) => {
      for (const touch of e.changedTouches) {
        const el = document.elementFromPoint(touch.clientX, touch.clientY);
        if (!el) continue;
        const action =
          el.dataset.touchAction ||
          (el.closest &&
            el.closest("[data-touch-action]")?.dataset.touchAction);
        if (!action || action === "shoot") continue;
        e.preventDefault();
        touchEdge[action] = true;
        el.classList.add("pressed");
      }
    },
    {
      passive: false,
    },
  );

  tc.addEventListener(
    "touchend",
    (e) => {
      tc.querySelectorAll(".pressed").forEach((el) =>
        el.classList.remove("pressed"),
      );
    },
    {
      passive: false,
    },
  );

  tc.addEventListener(
    "touchcancel",
    () => {
      touchJoyX = 0;
      touchJoyY = 0;
      shootTouchId = null;
      tc.querySelectorAll(".pressed").forEach((el) =>
        el.classList.remove("pressed"),
      );
      jKnob.style.transform = "translate(-50%,-50%)";
      jKnob.classList.remove("active");
    },
    {
      passive: false,
    },
  );
}

