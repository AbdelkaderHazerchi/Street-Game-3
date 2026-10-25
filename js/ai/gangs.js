// ======================== GANGS AI ========================
// Gang members keep their own chase-and-shoot brain, but they share the body's
// reaction layer with everybody else: a car knocks them over, a bad wound makes
// them break off, a nearby gunshot makes them flinch. `gangReaction()` decides
// whether the pedestrian brain owns the body this frame (it sets `npc.busy`).
import { isWalkable } from "../entities/vehicles.js?v=57";
import { npcs } from "../entities/npcs.js?v=57";
import { shootBullet } from "../combat/shooting.js?v=57";
import { gangReaction, gangSpeedMul } from "./pedestrians.js?v=57";

export function updateGangs() {
  for (const npc of npcs) {
    if (npc.type !== "gang") continue;

    // The pedestrian brain may already be running this body (panic, injury,
    // being knocked about). If so it has handled the frame.
    if (gangReaction(npc)) {
      npc.busy = true;
      continue;
    }
    npc.busy = false;
    // A gunshot wound slows them down without taking the chase away.
    const spd = npc.speed * gangSpeedMul(npc);

    // Chase timer
    if (npc.chaseTimer > 0) npc.chaseTimer--;

    // If being chased, move toward player
    if (npc.chaseTarget && npc.chaseTimer > 0) {
      const target = npc.chaseTarget.inVehicle || npc.chaseTarget;
      const dx = target.x - npc.x;
      const dy = target.y - npc.y;
      const dist = Math.hypot(dx, dy);

      if (dist > 15) {
        npc.angle = Math.atan2(dy, dx);
        const nx = npc.x + Math.cos(npc.angle) * spd;
        const ny = npc.y + Math.sin(npc.angle) * spd;
        if (isWalkable(nx, ny)) {
          npc.x = nx;
          npc.y = ny;
        }
      }

      // Shoot at player if close
      if (dist < 250 && Math.random() < 0.025) {
        const bAngle = Math.atan2(target.y - npc.y, target.x - npc.x);
        shootBullet(npc.x, npc.y, bAngle, false);
      }
    } else {
      // Idle patrol
      npc.timer--;
      if (npc.timer <= 0) {
        npc.angle = Math.random() * Math.PI * 2;
        npc.targetX = npc.x + Math.cos(npc.angle) * (40 + Math.random() * 80);
        npc.targetY = npc.y + Math.sin(npc.angle) * (40 + Math.random() * 80);
        npc.timer = 60 + Math.random() * 100;
      }
      const dx = npc.targetX - npc.x;
      const dy = npc.targetY - npc.y;
      if (Math.hypot(dx, dy) > 5) {
        npc.angle = Math.atan2(dy, dx);
        const nx = npc.x + Math.cos(npc.angle) * spd;
        const ny = npc.y + Math.sin(npc.angle) * spd;
        if (isWalkable(nx, ny)) {
          npc.x = nx;
          npc.y = ny;
        }
      }
    }
  }
}