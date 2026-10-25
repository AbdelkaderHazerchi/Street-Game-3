// ======================== SHOOTING ========================
// Extracted from game.js:52528-52583 - no logic changed
import { CFG, WEAPONS } from "../core/config.js?v=57";
import { bullets } from "../entities/bullets.js?v=57";
import { player } from "../entities/player.js?v=57";
import { npcs, killNPC, reactToShot } from "../entities/npcs.js?v=57";
import { isTouchDevice, touchAimAngle } from "../input/touch.js?v=57";
import { worldMouseX, worldMouseY } from "../input/inputState.js?v=57";
import { showNotification, updateHUD, updateWantedUI } from "../ui/hud.js?v=57";
import { playWeaponShot, playPunch } from "../audio/sounds.js?v=57";
import { reportNoise, NOISE_GUNSHOT } from "../ai/spatial.js?v=57";

export function getCurrentWeapon() {
  if (!player || !player.weapons.length) return null;
  const wName = player.weapons[player.currentWeapon];
  return WEAPONS[wName] || null;
}

/**
 * How far a gunshot carries, in pixels. A rifle is heard three blocks away, a
 * suppressed-ish pistol barely crosses the street. This is what decides how
 * much of the pavement clears out when the player opens fire.
 */
const GUN_NOISE_RADIUS = {
  pistol: 820,
  smg: 1050,
  rifle: 1500,
  shotgun: 980,
};

// Melee config
const MELEE_RANGE = 40; // pixels
const MELEE_ANGLE = Math.PI / 3; // 60 degree cone
const MELEE_DAMAGE = 25;
const MELEE_COOLDOWN = 500; // ms

let meleeCooldown = 0;

export function shootBullet(
  ax,
  ay,
  angle,
  isPlayer = true,
  spread = 0,
  bulletSpeed = 0,
) {
  const a = angle + (Math.random() - 0.5) * spread * 2;
  const spd = bulletSpeed || CFG.BULLET_SPEED;
  bullets.push({
    x: ax,
    y: ay,
    vx: Math.cos(a) * spd,
    vy: Math.sin(a) * spd,
    angle: a,
    life: Math.floor((15 * CFG.TILE) / (bulletSpeed || CFG.BULLET_SPEED)),
    isPlayer: isPlayer,
    size: 3,
  });
}

export function fireWeapon() {
  if (!player.alive || player.shootCooldown > 0) return;
  const w = getCurrentWeapon();
  if (!w) return;
  const wName = player.weapons[player.currentWeapon];
  
  // Fists/melee weapons don't shoot bullets
  if (w.isMelee) return;
  
  if ((player.ammo[wName] || 0) <= 0) {
    showNotification("🔫 لا ذخيرة!");
    return;
  }
  const target = player.inVehicle || player;
  let angle;
  if (isTouchDevice && !player.inVehicle) {
    angle = touchAimAngle !== null ? touchAimAngle : player.angle;
  } else if (isTouchDevice && player.inVehicle) {
    angle = player.angle;
  } else {
    const dx = worldMouseX - target.x;
    const dy = worldMouseY - target.y;
    angle = Math.atan2(dy, dx);
  }
  for (let i = 0; i < w.bullets; i++) {
    shootBullet(target.x, target.y, angle, true, w.spread, CFG.BULLET_SPEED);
  }
  player.ammo[wName] = Math.max(0, (player.ammo[wName] || 0) - w.ammoPerShot);
  player.shootCooldown = w.fireRate;
  updateHUD();
  // Everybody within earshot panics - this is the NPC "ears", not a direct
  // damage call, so the reaction scales with distance and with the calibre.
  try {
    reportNoise(target.x, target.y, GUN_NOISE_RADIUS[wName] || 900, NOISE_GUNSHOT, 1);
  } catch {}
  // --- Sound: per spec ---
  // pistol -> gun_shot.mp3 each shot, smg -> gun2_shot.mp3 loops while held, rifle (sniper) -> sniper_shot.mp3
  try {
    // For SMG we start looping sound here; actual stop handled in update loop when trigger lifted
    playWeaponShot(wName);
  } catch {}
}

// Melee attack (punch)
export function doMeleeAttack() {
  if (!player.alive || player.inVehicle) return;
  if (meleeCooldown > 0) return;

  meleeCooldown = MELEE_COOLDOWN;

  const angle = player.angle;
  const px = player.x;
  const py = player.y;

  // Play punch sound
  try { playPunch(); } catch {}

  // Check NPCs in melee range and cone
  for (let i = npcs.length - 1; i >= 0; i--) {
    const npc = npcs[i];
    const dx = npc.x - px;
    const dy = npc.y - py;
    const dist = Math.hypot(dx, dy);

    if (dist < MELEE_RANGE) {
      // Check if NPC is in front of player (within cone)
      const npcAngle = Math.atan2(dy, dx);
      const angleDiff = Math.abs(npcAngle - angle);
      const normalizedDiff = Math.min(angleDiff, Math.PI * 2 - angleDiff);

      if (normalizedDiff < MELEE_ANGLE / 2) {
        // Hit!
        npc.health -= MELEE_DAMAGE;

        // Gang members chase and shoot back
        if (npc.type === "gang" && npc.health > 0) {
          npc.chaseTarget = player;
          npc.chaseTimer = 180;
          npc.state = "chase";
        }

        // Body reaction
        try {
          reactToShot(npc, MELEE_DAMAGE, px, py);
        } catch {}

        if (npc.health <= 0) {
          killNPC(i);
        }

        // Add wanted level for hitting NPCs
        player.wanted = Math.min(5, player.wanted + 1);
        updateHUD();
        updateWantedUI();
        break; // Only hit one NPC per punch
      }
    }
  }
}

// Update melee cooldown
export function updateMeleeCooldown(delta) {
  if (meleeCooldown > 0) {
    meleeCooldown -= delta;
    if (meleeCooldown < 0) meleeCooldown = 0;
  }
}
