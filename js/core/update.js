// ======================== UPDATE ========================
// Extracted from game.js:52751-52888 - no logic changed
import { CFG, T } from "./config.js?v=57";
import { G } from "./config.js?v=57";
import { gameState, setGameState } from "./state.js?v=57";
import { player } from "../entities/player.js?v=57";
import { vehicles, isWalkable, isOnRoad, updateExplosions } from "../entities/vehicles.js?v=57";
import { npcs, lootItems } from "../entities/npcs.js?v=57";
import { police } from "../entities/police.js?v=57";
import { getTile } from "../map/mapUtils.js?v=57";
import { specialBuildings } from "../map/mapState.js?v=57";
import { act, actJust, isAiming, worldMouseX, worldMouseY, keys, isUiLocked } from "../input/inputState.js?v=57";
import { actionJust, actionHeld } from "../input/keyboard.js?v=57";
import { updateInput } from "../input/keyboard.js?v=57";
import { closeInventory, toggleInventory, switchWeapon, switchWeaponSlot } from "../ui/inventory.js?v=57";
import { handleEnterExit, handleHorn, cancelMission } from "../input/keyboard.js?v=57";
import { fireWeapon, doMeleeAttack, updateMeleeCooldown } from "../combat/shooting.js?v=57";
import { updateNPCs } from "../entities/npcs.js?v=57";
import { updateGangs } from "../ai/gangs.js?v=57";
import { beginSpatialFrame } from "../ai/spatial.js?v=57";
import { updatePolice } from "../entities/police.js?v=57";
import { updateBullets } from "../entities/bullets.js?v=57";
import { updateLoot } from "../entities/npcs.js?v=57";
import { updateTraffic } from "../ai/traffic.js?v=57";
import { updateCamera, updateHUD, updateWantedUI } from "../ui/hud.js?v=57";
import { currentMission } from "../missions/missionState.js?v=57";
import { updateMission, getQuestOfferTarget, setQuestOfferTarget, updateQuestOffer, acceptQuestOffer } from "../missions/missionSystem.js?v=57";
import { showPauseMenu } from "../ui/menu.js?v=57";
import { SHOPS, setNearShopName } from "../ui/shop.js?v=57";
import { updateCityMusic, updateMenuMusic, handleMachineGunTrigger } from "../audio/sounds.js?v=57";
import { getCurrentWeapon } from "../combat/shooting.js?v=57";
import { isMeetingActive, closeMeeting, advanceMeeting } from "../ui/meeting.js?v=57";
import { isChatActive, advanceChat, startRandomChatNearPlayer, closeChat, getNearbyNpc, getCurrentChat } from "../ui/chat.js?v=57";
import { isCutsceneActive } from "../ui/cutscene.js?v=57";
import { isQuestAcceptActive, advanceQuestAccept, closeQuestAccept } from "../ui/questAccept.js?v=57";

// Monotonic counter used as the per-frame cache key for the spatial index.
let aiFrameStamp = 0;

export function update() {
  if (!player || !player.alive) return;

  // Input (keyboard + gamepad)
  updateInput();

  // ── Story cutscene: highest priority. Freeze the world and every action
  //    until the sequence ends. The cutscene module handles its own keys.
  if (isCutsceneActive()) {
    try { updateCamera(); } catch {}
    try { updateHUD(); } catch {}
    return;
  }

  // ── Quest accept screen: the quest artwork + its intro dialogue own the
  //    screen. The world stays frozen; E advances, ESC skips to the hand-over.
  if (isQuestAcceptActive()) {
    if (actJust.pause || (keys && (keys["escape"] || keys["Escape"]))) {
      closeQuestAccept();
      return;
    }
    if (actJust.enterExit) {
      advanceQuestAccept();
      return;
    }
    try { updateCamera(); } catch {}
    try { updateHUD(); } catch {}
    return;
  }

  // ── Quest offer: which marker (if any) the player is standing next to.
  //    Walking up to a marker does nothing on its own - E accepts the quest.
  const questOffer = getQuestOfferTarget();
  setQuestOfferTarget(questOffer);

  // Chat: ESC closes chat before pausing, E advances chat
  if (isChatActive()) {
    if (actJust.pause || (keys && (keys["escape"] || keys["Escape"]))) {
      closeChat();
      return;
    }
    if (actJust.enterExit) {
      advanceChat();
      return;
    }
  }

  // Meeting: ESC closes meeting before pausing, E advances meeting (single advance, prevents skip)
  if (isMeetingActive()) {
    if (actJust.pause || (keys && (keys["escape"] || keys["Escape"]))) {
      closeMeeting();
      return;
    }
    if (actJust.enterExit) {
      advanceMeeting();
      return;
    }
  }

  // Process frame-based actions
  if (actJust.pause && gameState === G.PLAYING) {
    if (player.showInventory) {
      closeInventory();
      return;
    }
    setGameState(G.PAUSED);
    showPauseMenu();
    return;
  }
  if (player.alive) {
    // Meeting dialog: E/ESC handled at top (single advance), here only handle inventory/cancel/horn and block other actions
    if (isMeetingActive()) {
      if (actionJust("inventory") || actionJust("cancelMission")) {
        closeMeeting();
      }
      if (actionJust("horn")) handleHorn();
      // Block all other actions while meeting active (E/ESC already handled at top with return)
    } else if (isChatActive()) {
      // Generic NPC chat: E near any NPC picks random chat (priority: meeting > shop/vehicle > chat)
      if (actionJust("enterExit")) {
        advanceChat();
      } else if (actionJust("pause") || (keys && (keys["escape"] || keys["Escape"]))) {
        closeChat();
      }
      if (actionJust("inventory") || actionJust("cancelMission")) {
        closeChat();
      }
      // While chatting, still allow horn etc but block vehicle/shop enter
      if (actionJust("horn")) handleHorn();
      // Don't process other enterExit actions while chatting
    } else {
      if (actionJust("enterExit")) {
        // A quest marker in range takes priority: E accepts the quest and the
        // accept screen takes over the key from here on.
        let handledAsQuest = false;
        if (questOffer) {
          try { handledAsQuest = acceptQuestOffer(questOffer); } catch(e) { console.warn("[quest] accept failed", e); }
        }
        if (!handledAsQuest) handleContextEnterExit();
      }
      if (actionJust("horn")) handleHorn();
      if (actionJust("cancelMission")) cancelMission();
      if (actionJust("inventory")) toggleInventory();
      if (actionJust("weaponNext")) switchWeapon(1);
      if (actionJust("weaponSlot1")) switchWeaponSlot(0);
      if (actionJust("weaponSlot2")) switchWeaponSlot(1);
      if (actionJust("weaponSlot3")) switchWeaponSlot(2);
      if (actionJust("weaponSlot4")) switchWeaponSlot(3);
      if (actionJust("weaponSlot5")) switchWeaponSlot(4);
      if (act.shoot && !isUiLocked() && player.shootCooldown <= 0) {
        const cw = getCurrentWeapon();
        if (cw && cw.isMelee) {
          doMeleeAttack();
        } else {
          fireWeapon();
        }
      }
      if (act.melee && !isUiLocked()) doMeleeAttack();
    }
  }

  // Machine gun loop: stop when trigger lifted (gun2_shot.mp3) — also suppressed while any UI is open
  try {
    const cw = getCurrentWeapon();
    const curName = cw ? player.weapons[player.currentWeapon] : null;
    handleMachineGunTrigger(act.shoot && !isUiLocked(), curName);
  } catch {}

  // City music: loops during gameplay not in pause/menu; menu music loops only in MENU
  try { updateCityMusic(gameState, G); } catch {}
  try { updateMenuMusic(gameState, G); } catch {}

  // Shoot cooldown
  if (player.shootCooldown > 0) player.shootCooldown -= 16;

  // Melee cooldown
  updateMeleeCooldown(16);

  // Player movement (freeze while chatting)
  if (isChatActive() || isMeetingActive()) {
    // Auto-close if moved far from chat/meeting NPC
    try {
      if (isChatActive()) {
        const cur = getCurrentChat();
        if (cur && cur.npc) {
          const d = Math.hypot(player.x - cur.npc.x, player.y - cur.npc.y);
          if (d > 130) closeChat();
        }
      }
      if (isMeetingActive() && currentMission && currentMission.data && currentMission.data.meetingPos) {
        const d = Math.hypot(player.x - currentMission.data.meetingPos.x, player.y - currentMission.data.meetingPos.y);
        if (d > 130) closeMeeting();
      }
    } catch {}
    // Freeze player during meeting/chat
  } else {
    updatePlayer();
  }
  // Also auto-close check after movement (in case just unfrozen? already handled)
  try {
    if (isChatActive()) {
      const cur2 = getCurrentChat();
      if (cur2 && cur2.npc) {
        const d2 = Math.hypot(player.x - cur2.npc.x, player.y - cur2.npc.y);
        if (d2 > 130) closeChat();
      }
    }
    if (isMeetingActive() && currentMission && currentMission.data && currentMission.data.meetingPos) {
      const d2 = Math.hypot(player.x - currentMission.data.meetingPos.x, player.y - currentMission.data.meetingPos.y);
      if (d2 > 130) closeMeeting();
    }
  } catch {}

  // ── AI dispatcher ──
  // One shared spatial snapshot per frame feeds the pedestrian brain and the
  // traffic brain, so "who is near me" costs a single O(n) rebuild instead of
  // an O(n*m) scan in each system.
  beginSpatialFrame(npcs, vehicles, ++aiFrameStamp, player);

  // NPCs (civilian brain)
  updateNPCs();

  // Gang members
  updateGangs();

  // Police
  updatePolice();

  // Bullets
  updateBullets();

  // Loot items
  updateLoot();

  // Vehicles AI (traffic)
  updateTraffic(player);

  // Explosions (hide -> animate -> remove)
  updateExplosions(16);

  // Camera
  updateCamera();

  // Wanted stars decay is now handled in police.js (6 squares / 20s)

  // Mission
  updateMission();

  // Quest offers: refresh the "marker in range" state so the on-world prompt
  // and the HUD stay in sync. Accepting itself happened on the E press above.
  updateQuestOffer();

  // Check shop proximity
  let _near = null;
  for (const sb of specialBuildings) {
    // Shops have distinct emoji names
    if (!SHOPS[sb.name]) continue;
    const sx = sb.x * CFG.TILE + CFG.TILE / 2;
    const sy = sb.y * CFG.TILE + CFG.TILE / 2;
    if (Math.hypot(player.x - sx, player.y - sy) < 70) {
      _near = sb.name;
      break;
    }
  }
  setNearShopName(_near);

  // Update UI
  updateHUD();
}

/**
 * The non-quest half of the interact key: talk to a nearby NPC, otherwise enter
 * a vehicle / open a shop. Runs only when no quest marker is in range.
 */
function handleContextEnterExit() {
  let handledAsChat = false;
  try {
    let nearShop = false;
    for (const sb of specialBuildings) {
      if (!SHOPS[sb.name]) continue;
      const sx = sb.x * CFG.TILE + CFG.TILE / 2;
      const sy = sb.y * CFG.TILE + CFG.TILE / 2;
      if (Math.hypot(player.x - sx, player.y - sy) < 70) { nearShop = true; break; }
    }
    let nearVehicle = false;
    if (!nearShop) {
      for (const v of vehicles) {
        if (v.occupied || v.hidden || v.exploding) continue;
        if (Math.hypot(player.x - v.x, player.y - v.y) < 80) { nearVehicle = true; break; }
      }
    }
    let inMeetingRadius = false;
    if (currentMission && currentMission.stages && currentMission.stages[currentMission.stage]?.type === "meeting") {
      const st = currentMission.stages[currentMission.stage];
      if (st && typeof st.x === "number" && Math.hypot(player.x - st.x, player.y - st.y) < (st.radius || 55)) {
        inMeetingRadius = true;
      }
    }
    if (!nearShop && !nearVehicle && !inMeetingRadius) {
      const npc = getNearbyNpc(70);
      if (npc) handledAsChat = startRandomChatNearPlayer();
    }
  } catch (e) { try { handledAsChat = startRandomChatNearPlayer(); } catch {} }
  if (!handledAsChat) handleEnterExit();
}

export function updatePlayer() {
  if (!player || !player.alive) return;

  if (player.inVehicle) {
    const v = player.inVehicle;
    const cosA = Math.cos(v.angle);
    const sinA = Math.sin(v.angle);

    let forward = v.vx * cosA + v.vy * sinA;
    let lateral = -v.vx * sinA + v.vy * cosA;
    const absSpeed = Math.hypot(v.vx, v.vy);

    let steer = 0;
    if (actionHeld("left")) steer = -1;
    if (actionHeld("right")) steer = 1;
    if (steer !== 0 && absSpeed > 0.4) {
      const topRef = v.type.speed;
      const lowSpeedBonus = Math.max(0, 1 - absSpeed / (topRef * 0.35));
      const highSpeedDamp = 1 / (1 + absSpeed / (topRef * 0.55));
      const turnRate = (0.05 + lowSpeedBonus * 0.055) * highSpeedDamp;
      v.angle += steer * turnRate * (forward >= 0 ? 1 : -1);
    }

    let throttle = 0;
    if (actionHeld("up")) throttle = 1;
    else if (actionHeld("down")) throttle = -1;

    const topSpeed = v.type.speed;
    const reverseMax = topSpeed * 0.4;
    const accel = v.type.accel;

    if (throttle > 0) {
      const power = Math.max(0.15, 1 - Math.max(0, forward) / topSpeed);
      forward += accel * (0.2 + 0.8 * power) * throttle;
    } else if (throttle < 0) {
      if (forward > 0.8) {
        forward -= accel * 2.2;
        if (forward < 0) forward = 0;
      } else {
        forward -= accel * 0.45;
        if (forward < -reverseMax) forward = -reverseMax;
      }
    } else {
      if (forward > 0) forward -= Math.min(Math.abs(forward), accel * 0.12 + forward * forward * 0.00002);
      else if (forward < 0) forward += Math.min(Math.abs(forward), accel * 0.1);
    }

    const slipFactor = 0.22 + 0.14 * (absSpeed / Math.max(0.001, topSpeed)) + (steer !== 0 ? 0.1 : 0);
    lateral *= Math.max(0, 1 - slipFactor);

    forward *= 1 - (0.006 + 0.00003 * Math.abs(forward) * Math.abs(forward));

    if (forward > topSpeed) forward = topSpeed;
    else if (forward < -reverseMax) forward = -reverseMax;

    v.vx = forward * cosA - lateral * sinA;
    v.vy = forward * sinA + lateral * cosA;

    if (Math.abs(forward) < 0.05 && throttle === 0) {
      v.vx = 0;
      v.vy = 0;
    }

    const stx = Math.floor(v.x / CFG.TILE);
    const sty = Math.floor(v.y / CFG.TILE);
    let speedMul = 1.0;
    if (stx >= 0 && stx < CFG.COLS && sty >= 0 && sty < CFG.ROWS) {
      const stile = getTile(stx, sty);
      if (stile === T.SIDEWALK || stile === T.PAVEMENT) speedMul = 0.9;
      else if (stile === T.PARK) speedMul = 0.75;
    }
    const surfaceSpeed = v.speed * speedMul;

    const currentSpeed = Math.hypot(v.vx, v.vy);
    if (currentSpeed > surfaceSpeed) {
      v.vx = (v.vx / currentSpeed) * surfaceSpeed;
      v.vy = (v.vy / currentSpeed) * surfaceSpeed;
    }

    const nx = v.x + v.vx;
    const ny = v.y + v.vy;
    if (isOnRoad(nx, ny) || isWalkable(nx, ny)) {
      v.x = nx;
      v.y = ny;
    } else if (isOnRoad(nx, v.y)) {
      v.x = nx;
      v.vy *= -0.3;
    } else if (isOnRoad(v.x, ny)) {
      v.y = ny;
      v.vx *= -0.3;
    } else {
      v.vx *= -0.5;
      v.vy *= -0.5;
    }

    player.x = v.x;
    player.y = v.y;
    player.angle = v.angle;
  } else {
    let dx = 0, dy = 0;
    if (actionHeld("up")) dy = -1;
    if (actionHeld("down")) dy = 1;
    if (actionHeld("left")) dx = -1;
    if (actionHeld("right")) dx = 1;

    if (dx !== 0 || dy !== 0) {
      const len = Math.hypot(dx, dy);
      dx /= len;
      dy /= len;
      // When aiming, face mouse; otherwise face movement direction
      if (isAiming && player.onFoot && player.alive) {
        const mdx = worldMouseX - player.x;
        const mdy = worldMouseY - player.y;
        if (Math.hypot(mdx, mdy) > 5) player.angle = Math.atan2(mdy, mdx);
      } else {
        player.angle = Math.atan2(dy, dx);
      }

      // Aiming slows walking speed by 2.5x while right mouse is held (on foot)
      const aiming = isAiming && player.onFoot && player.alive;
      const effectiveSpeed = aiming ? player.speed / 2.5 : player.speed;

      const nx = player.x + dx * effectiveSpeed;
      const ny = player.y + dy * effectiveSpeed;

      if (isWalkable(nx, ny)) {
        player.x = nx;
        player.y = ny;
      } else if (isWalkable(nx, player.y)) {
        player.x = nx;
      } else if (isWalkable(player.x, ny)) {
        player.y = ny;
      }
    } else if (isAiming && player.onFoot && player.alive) {
      // Even when not moving, keep player facing mouse while aiming
      const dxm = worldMouseX - player.x;
      const dym = worldMouseY - player.y;
      if (Math.hypot(dxm, dym) > 5) {
        player.angle = Math.atan2(dym, dxm);
      }
    }
  }
}
