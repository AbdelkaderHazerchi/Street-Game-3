// ======================== BULLETS ========================
// Extracted from game.js:51602, 53532-53656 - shooting fns moved to js/combat/shooting.js - no logic changed
import { CFG, T } from "../core/config.js?v=57";
import { getTile } from "../map/mapUtils.js?v=57";
import { player } from "./player.js?v=57";
import { npcs, killNPC, spawnLoot, reactToShot } from "./npcs.js?v=57";
import { vehicles, explodeVehicle } from "./vehicles.js?v=57";
import { police } from "./police.js?v=57";
import { currentMission } from "../missions/missionState.js?v=57";
import { showNotification, updateWantedUI } from "../ui/hud.js?v=57";
import { playerDie } from "./player.js?v=57";

export let bullets = [];
export function clearBullets(){ bullets.length = 0; }

export function updateBullets() {
  for (let i = bullets.length - 1; i >= 0; i--) {
    const b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    // Check wall collision
    const tx = Math.floor(b.x / CFG.TILE);
    const ty = Math.floor(b.y / CFG.TILE);
    if (tx < 0 || tx >= CFG.COLS || ty < 0 || ty >= CFG.ROWS) {
      bullets.splice(i, 1);
      continue;
    }
    const bt = getTile(tx, ty);
    if (bt === T.BUILDING || bt === T.SPECIAL) {
      bullets.splice(i, 1);
      continue;
    }

    // Check NPC hit (player bullets only)
    let _hit = false;
    if (b.isPlayer) {
      for (let ni = npcs.length - 1; ni >= 0; ni--) {
        const npc = npcs[ni];
        if (Math.hypot(b.x - npc.x, b.y - npc.y) < 12) {
          bullets.splice(i, 1);
          _hit = true;
          const DAMAGE = 15;
          npc.health -= DAMAGE;

          // Gang members chase and shoot back (only if still standing).
          if (npc.type === "gang" && npc.health > 0) {
            npc.chaseTarget = player;
            npc.chaseTimer = 180;
            // chase for ~3 seconds
            npc.state = "chase";
          }

          // Body reaction: the wound slows them for a moment, then they flee.
          // Set after the chase block so it wins - a hit gang member runs.
          try {
            reactToShot(npc, DAMAGE, b.x - b.vx, b.y - b.vy);
          } catch {}

          if (npc.health <= 0) {
            killNPC(ni);
          }

          // Add wanted level for shooting NPCs
          player.wanted = Math.min(5, player.wanted + 1);
          updateWantedUI();
          break;
        }
      }
      if(_hit) continue;
      // Check vehicle hit (player bullets)
      for (let vi = vehicles.length - 1; vi >= 0; vi--) {
          const v = vehicles[vi];
          if (v.isPolice) continue;
          if (v.occupied) continue;
          if (v.isPersonal) continue;
          if (v.hidden || v.exploding) continue;
          if (Math.hypot(b.x - v.x, b.y - v.y) < Math.max(v.w, v.h) * 0.8) {
            bullets.splice(i, 1);
            _hit = true;
            // Vehicle health: 15-23 bullets to detonate (random per vehicle)
            if (typeof v.health !== "number") {
              v.health = 15 + Math.floor(Math.random() * 9);
              v.maxHealth = v.health;
            }
            v.health -= 1;
            if (v.health <= 0) {
              // Destroy civilian vehicle - drop money, hide then explode with car_explotion.svg
              const moneyDrop = 20 + Math.floor(Math.random() * 40);
              spawnLoot(v.x, v.y, "money", moneyDrop);
              showNotification(`💰 حصلت على $${moneyDrop} من السيارة`);
              explodeVehicle(vi);
              player.wanted = Math.min(5, player.wanted + 1);
              updateWantedUI();
            }
            break;
          }
      }
      if(_hit) continue;
    }

    // Check player hit (from police bullets) — scaled by difficulty
    if (!b.isPlayer && player.alive) {
      const target = player.inVehicle || player;
      if (target && Math.hypot(b.x - target.x, b.y - target.y) < 15) {
        player.health -= 8 * (CFG.DAMAGE_MUL || 1);
        bullets.splice(i, 1);
        if (player.health <= 0) {
          playerDie();
        }
        continue;
      }
    }

    // Check police hit (can kill police too)
    if (b.isPlayer) {
      let _pHit=false;
      for (let pi = police.length - 1; pi >= 0; pi--) {
        const p = police[pi];
        if (Math.hypot(b.x - p.x, b.y - p.y) < 12) {
          bullets.splice(i, 1);
          _pHit=true;
          p.health = (p.health || 30) - 20;
          if (p.health <= 0) {
            if (Math.random() < 0.5)
              spawnLoot(p.x, p.y, "money", 15 + Math.floor(Math.random() * 20));
            else
              spawnLoot(
                p.x,
                p.y,
                "ammo_pistol",
                8 + Math.floor(Math.random() * 10),
              );
            showNotification("💀 قتلت شرطياً!");
            if (currentMission && currentMission.type === "surveillance") {
              currentMission.data.surveillanceKilled = true;
            }
            if (currentMission && currentMission.type === "killPolice") {
              currentMission.data.killCount = (currentMission.data.killCount || 0) + 1;
            }
            if (p.inVehicle) {
              p.inVehicle.driver = null;
              p.inVehicle.occupied = false;
            }
            police.splice(pi, 1);
            player.wanted = Math.min(5, player.wanted + 2);
            updateWantedUI();
          }
          break;
        }
      }
      if(_pHit) continue;
    }

    if (b.life <= 0) {
      // Only splice if still present at this index
      if(i < bullets.length && bullets[i] === b) bullets.splice(i, 1);
      else if(bullets.indexOf(b) !== -1) bullets.splice(bullets.indexOf(b), 1);
    }
  }
}
