// ======================== CONFIG ========================
// Extracted from game.js:1-65, 355-363, 54577-54585 - no logic changed
export const CFG = {
  TILE: 96,
  COLS: 120,
  ROWS: 120,
  // Carriageway width in tiles. The planned city in js/map/mapData.json is
  // built around 2-wide roads flanked by a 1-tile sidewalk on each side; this
  // only drives the procedural fallback grid, and matches the real city.
  ROAD_W: 2,
  BLOCK: 5,
  CYCLE: 8,
  PLAYER_SPEED: 2.8,
  CAR_SPEED: 4.5,
  NPC_SPEED: 1.2,
  POLICE_SPEED: 4.2,
  BULLET_SPEED: 18,
  MAX_HEALTH: 100,
  START_MONEY: 500,
  NPC_VEHICLE_COUNT: 30,
  POLICE_VEHICLE_COUNT: 5,
  NPC_COUNT: 50,
  NPC_GANG_COUNT: 10,
  MAX_SPAWN_ATTEMPTS: 50,
};

export const WEAPONS = {
  fists: {
    name: "اليدين",
    nameEn: "Fists",
    damage: 25,
    fireRate: 500,
    spread: 0,
    ammoPerShot: 0,
    bullets: 0,
    icon: "👊",
    range: 40,
    ammo: 0,
    maxAmmo: 0,
    isMelee: true,
  },
  pistol: {
    name: "مسدس",
    damage: 12,
    fireRate: 300,
    spread: 0.04,
    ammoPerShot: 1,
    bullets: 1,
    icon: "🔫",
    range: 400,
    ammo: 30,
    maxAmmo: 90,
  },
  smg: {
    name: "رشاش",
    damage: 8,
    fireRate: 80,
    spread: 0.12,
    ammoPerShot: 1,
    bullets: 1,
    icon: "🔫",
    range: 350,
    ammo: 30,
    maxAmmo: 120,
  },
  rifle: {
    name: "بندقية",
    damage: 18,
    fireRate: 150,
    spread: 0.02,
    ammoPerShot: 1,
    bullets: 1,
    icon: "🔫",
    range: 500,
    ammo: 20,
    maxAmmo: 60,
  },
  shotgun: {
    name: "شوزن",
    damage: 9,
    fireRate: 450,
    spread: 0.18,
    ammoPerShot: 1,
    bullets: 5,
    icon: "🔫",
    range: 250,
    ammo: 8,
    maxAmmo: 32,
  },
};

export const T = {
  WATER: 0,
  ROAD: 1,
  SIDEWALK: 2,
  BUILDING: 3,
  PARK: 4,
  PARKING: 5,
  SPECIAL: 6,
  PAVEMENT: 7,
};

export const G = {
  MENU: 0,
  PLAYING: 1,
  PAUSED: 2,
};

export const SAVE_KEY = "gta6_saves";

export const DIFFICULTY_PRESETS = {
  easy: { MAX_HEALTH: 125, START_MONEY: 750, POLICE_SPEED: 3.6, NPC_GANG_COUNT: 5, DAMAGE_MUL: 0.7, label: "Easy" },
  medium: { MAX_HEALTH: 100, START_MONEY: 500, POLICE_SPEED: 4.2, NPC_GANG_COUNT: 10, DAMAGE_MUL: 1.0, label: "Medium" },
  hard: { MAX_HEALTH: 80, START_MONEY: 300, POLICE_SPEED: 5.0, NPC_GANG_COUNT: 18, DAMAGE_MUL: 1.5, label: "Hard" },
};

export function applyDifficulty(diff) {
  const preset = DIFFICULTY_PRESETS[diff] || DIFFICULTY_PRESETS.medium;
  CFG.MAX_HEALTH = preset.MAX_HEALTH;
  CFG.START_MONEY = preset.START_MONEY;
  CFG.POLICE_SPEED = preset.POLICE_SPEED;
  CFG.NPC_GANG_COUNT = preset.NPC_GANG_COUNT;
  CFG.DAMAGE_MUL = preset.DAMAGE_MUL;
  return preset;
}
// Default damage multiplier
CFG.DAMAGE_MUL = DIFFICULTY_PRESETS.medium.DAMAGE_MUL;
