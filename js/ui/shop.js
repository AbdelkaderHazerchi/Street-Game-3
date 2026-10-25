// ======================== SHOP ========================
// Extracted from game.js:54848-55168 - no logic changed
import { CFG } from "../core/config.js?v=57";
import { player, respawnPlayer } from "../entities/player.js?v=57";
import { vehicles, VEHICLE_TYPES, isOnRoad } from "../entities/vehicles.js?v=57";
import { police, clearPolice } from "../entities/police.js?v=57";
import { showNotification, updateHUD, updateWantedUI } from "./hud.js?v=57";
import { overlay, overlayBtn } from "../core/domRefs.js?v=57";

// Car image assets for shop — uses existing project SVG assets with emoji fallback
const CAR_ASSET_BY_TYPE = {
  0: "assets/vehicle_sedan.svg",
  1: "assets/vehicle_sports.svg",
  2: "assets/vehicle_truck.svg",
  3: "assets/vehicle_suv.svg",
  4: "assets/vehicle_police.svg",
  5: "assets/vehicle_bmw.svg",
  6: "assets/vehicle_mrsds.svg",
  7: "assets/vehicle_sport2.svg",
  8: "assets/vehicle_sport3.svg",
  9: "assets/vehicle_sport4.svg",
  10: "assets/vehicle_gang.svg",
  11: "assets/vehicle_gang2.svg",
};
function getCarImgSrc(carType){
  if(carType === undefined || carType === null) return null;
  return CAR_ASSET_BY_TYPE[carType] || null;
}

export const SHOPS = {
  "🔫 Ammu-Nation": {
    title: "🔫 Ammu-Nation",
    items: [
      {
        name: "طلقات مسدس (x20)",
        price: 100,
        desc: "20 طلقة للمسدس",
        icon: "📦",
        action: (p) => {
          p.ammo.pistol = (p.ammo.pistol || 0) + 20;
          showNotification("📦 +20 طلقة مسدس");
        },
      },
      {
        name: "رشاش SMG",
        price: 2000,
        desc: "رشاش سريع +50 طلقة",
        icon: "🔫",
        action: (p) => {
          if (!p.weapons.includes("smg")) p.weapons.push("smg");
          p.ammo.smg = (p.ammo.smg || 0) + 50;
          showNotification("🔫 رشاش +50 طلقة");
        },
      },
      {
        name: "بندقية",
        price: 3000,
        desc: "بندقية قوية +30 طلقة",
        icon: "🔫",
        action: (p) => {
          if (!p.weapons.includes("rifle")) p.weapons.push("rifle");
          p.ammo.rifle = (p.ammo.rifle || 0) + 30;
          showNotification("🔫 بندقية +30 طلقة");
        },
      },
      {
        name: "شوزن",
        price: 2500,
        desc: "شوزن عنقودي +15 طلقة",
        icon: "🔫",
        action: (p) => {
          if (!p.weapons.includes("shotgun")) p.weapons.push("shotgun");
          p.ammo.shotgun = (p.ammo.shotgun || 0) + 15;
          showNotification("🔫 شوزن +15 طلقة");
        },
      },
      {
        name: "ذخيرة متنوعة (50)",
        price: 300,
        desc: "50 طلقة لكل سلاح",
        icon: "📦",
        action: (p) => {
          for (const k in p.ammo) p.ammo[k] = (p.ammo[k] || 0) + 50;
          showNotification("📦 +50 لكل سلاح");
        },
      },
    ],
  },
  "👕 Binco": {
    title: "👕 Binco - الأزياء",
    items: [
      {
        name: "أحمر",
        price: 200,
        desc: "لون أحمر",
        icon: "🔴",
        color: "#e74c3c",
        action: (p) => {
          p.color = "#e74c3c";
        },
      },
      {
        name: "أزرق",
        price: 200,
        desc: "لون أزرق",
        icon: "🔵",
        color: "#3498db",
        action: (p) => {
          p.color = "#3498db";
        },
      },
      {
        name: "أخضر",
        price: 200,
        desc: "لون أخضر",
        icon: "🟢",
        color: "#2ecc71",
        action: (p) => {
          p.color = "#2ecc71";
        },
      },
      {
        name: "أصفر",
        price: 200,
        desc: "لون أصفر",
        icon: "🟡",
        color: "#f1c40f",
        action: (p) => {
          p.color = "#f1c40f";
        },
      },
      {
        name: "بنفسجي",
        price: 200,
        desc: "لون بنفسجي",
        icon: "🟣",
        color: "#9b59b6",
        action: (p) => {
          p.color = "#9b59b6";
        },
      },
      {
        name: "برتقالي",
        price: 200,
        desc: "لون برتقالي",
        icon: "🟠",
        color: "#e67e22",
        action: (p) => {
          p.color = "#e67e22";
        },
      },
      {
        name: "أبيض",
        price: 200,
        desc: "لون أبيض",
        icon: "⬜",
        color: "#ecf0f1",
        action: (p) => {
          p.color = "#ecf0f1";
        },
      },
      {
        name: "أسود",
        price: 200,
        desc: "لون أسود",
        icon: "⬛",
        color: "#2c3e50",
        action: (p) => {
          p.color = "#2c3e50";
        },
      },
    ],
  },
  "🚗 معرض سيارات": {
    title: "🚗 معرض السيارات",
    items: [
      {
        name: "سيدان عائلي",
        price: 5000,
        desc: "سيارة عائلية موثوقة",
        icon: "🚗",
        carType: 0,
        action: (p) => {
          givePersonalCar(0);
        },
      },
      {
        name: "سيارة رياضية",
        price: 12000,
        desc: "سيارة فارهة وسريعة",
        icon: "🏎️",
        carType: 1,
        action: (p) => {
          givePersonalCar(1);
        },
      },
      {
        name: "SUV كبيرة",
        price: 8000,
        desc: "سيارة دفع رباعي",
        icon: "🚙",
        carType: 3,
        action: (p) => {
          givePersonalCar(3);
        },
      },
      {
        name: "BMW-s5",
        price: 15000,
        desc: "سيارة فارهة وسريعة",
        icon: "🚗",
        carType: 5,
        action: (p) => {
          givePersonalCar(5);
        },
      },
      {
        name: "Mercedes-g8",
        price: 17000,
        desc: "سيارة دفع رباعي فاخرة وقوية",
        icon: "🚙",
        carType: 6,
        action: (p) => {
          givePersonalCar(6);
        },
      },
      {
        name: "Porsche-911",
        price: 16000,
        desc: "سيارة رياضية ألمانية خارقة",
        icon: "🏎️",
        carType: 7,
        action: (p) => {
          givePersonalCar(7);
        },
      },
      {
        name: "Ferrari-488",
        price: 16000,
        desc: "سيارة إيطالية فائقة الأداء",
        icon: "🏎️",
        carType: 8,
        action: (p) => {
          givePersonalCar(8);
        },
      },
      {
        name: "Lamborghini-Huracan",
        price: 16000,
        desc: "سيارة خارقة بتصميم عدواني",
        icon: "🏎️",
        carType: 9,
        action: (p) => {
          givePersonalCar(9);
        },
      },
      {
        name: "Cobra-GT",
        price: 20000,
        desc: "سيارة عضلات أمريكية شرسة",
        icon: "🚗",
        carType: 10,
        action: (p) => {
          givePersonalCar(10);
        },
      },
      {
        name: "Dominator-X",
        price: 22000,
        desc: "وحش الشوارع — قوة خارقة",
        icon: "🚙",
        carType: 11,
        action: (p) => {
          givePersonalCar(11);
        },
      },
    ],
  },
  "💊 عيادة": {
    title: "💊 عيادة LS",
    items: [
      {
        name: "علاج كامل",
        price: 100,
        desc: "استعادة الصحة كاملة",
        icon: "❤️",
        action: (p) => {
          p.health = p.maxHealth;
        },
      },
      {
        name: "درع واقي",
        price: 300,
        desc: "درع إضافي +50 صحة",
        icon: "🛡️",
        action: (p) => {
          p.maxHealth = 150;
          p.health = Math.min(p.health + 50, 150);
        },
      },
      {
        name: "إزالة المطلوبين",
        price: 500,
        desc: "إزالة نجوم الشرطة",
        icon: "🌟",
        action: (p) => {
          p.wanted = 0;
          clearPolice();
          updateWantedUI();
        },
      },
    ],
  },
  "🎰 Casino": {
    title: "🎰 Casino - الكازينو",
    items: [
      {
        name: "حزمة مال $500",
        price: 400,
        desc: "اربح $500 مقابل $400",
        icon: "💰",
        action: (p) => {
          p.money += 500;
          showNotification("🎰 ربحت $500!");
        },
      },
      {
        name: "حزمة مال $1200",
        price: 1000,
        desc: "اربح $1200",
        icon: "💰",
        action: (p) => {
          p.money += 1200;
          showNotification("🎰 ربحت $1200!");
        },
      },
      {
        name: "حزمة صحة الحظ",
        price: 250,
        desc: "استعادة الصحة + درع صغير",
        icon: "🍀",
        action: (p) => {
          p.health = p.maxHealth;
          const bonus = 20 + Math.floor(Math.random() * 30);
          p.money += bonus;
          showNotification(`🍀 حظ سعيد! +$${bonus}`);
        },
      },
    ],
  },
  // Alias for English name used in map editor dropdown
  "🎰 كازينو": {
    title: "🎰 Casino - الكازينو",
    items: [
      {
        name: "حزمة مال $500",
        price: 400,
        desc: "اربح $500 مقابل $400",
        icon: "💰",
        action: (p) => {
          p.money += 500;
          showNotification("🎰 ربحت $500!");
        },
      },
      {
        name: "حزمة مال $1200",
        price: 1000,
        desc: "اربح $1200",
        icon: "💰",
        action: (p) => {
          p.money += 1200;
          showNotification("🎰 ربحت $1200!");
        },
      },
    ],
  },
  // English alias for editor dropdown
  "🚗 Car Showroom": {
    title: "🚗 معرض السيارات",
    items: [
      {
        name: "سيدان عائلي",
        price: 5000,
        desc: "سيارة عائلية موثوقة",
        icon: "🚗",
        carType: 0,
        action: (p) => {
          givePersonalCar(0);
        },
      },
      {
        name: "سيارة رياضية",
        price: 12000,
        desc: "سيارة فارهة وسريعة",
        icon: "🏎️",
        carType: 1,
        action: (p) => {
          givePersonalCar(1);
        },
      },
      {
        name: "SUV كبيرة",
        price: 8000,
        desc: "سيارة دفع رباعي",
        icon: "🚙",
        carType: 3,
        action: (p) => {
          givePersonalCar(3);
        },
      },
      {
        name: "BMW-s5",
        price: 15000,
        desc: "سيارة فارهة وسريعة",
        icon: "🚗",
        carType: 5,
        action: (p) => {
          givePersonalCar(5);
        },
      },
      {
        name: "Mercedes-g8",
        price: 17000,
        desc: "سيارة دفع رباعي فاخرة وقوية",
        icon: "🚙",
        carType: 6,
        action: (p) => {
          givePersonalCar(6);
        },
      },
      {
        name: "Porsche-911",
        price: 16000,
        desc: "سيارة رياضية ألمانية خارقة",
        icon: "🏎️",
        carType: 7,
        action: (p) => {
          givePersonalCar(7);
        },
      },
      {
        name: "Ferrari-488",
        price: 16000,
        desc: "سيارة إيطالية فائقة الأداء",
        icon: "🏎️",
        carType: 8,
        action: (p) => {
          givePersonalCar(8);
        },
      },
      {
        name: "Lamborghini-Huracan",
        price: 16000,
        desc: "سيارة خارقة بتصميم عدواني",
        icon: "🏎️",
        carType: 9,
        action: (p) => {
          givePersonalCar(9);
        },
      },
      {
        name: "Cobra-GT",
        price: 20000,
        desc: "سيارة عضلات أمريكية شرسة",
        icon: "🚗",
        carType: 10,
        action: (p) => {
          givePersonalCar(10);
        },
      },
      {
        name: "Dominator-X",
        price: 22000,
        desc: "وحش الشوارع — قوة خارقة",
        icon: "🚙",
        carType: 11,
        action: (p) => {
          givePersonalCar(11);
        },
      },
    ],
  },
  "🏛️ Police Station": {
    title: "🏛️ Police Station - مركز الشرطة",
    items: [
      {
        name: "إزالة النجوم (رشوة)",
        price: 600,
        desc: "إزالة مستوى المطلوبين بالكامل",
        icon: "🌟",
        action: (p) => {
          p.wanted = 0;
          clearPolice();
          updateWantedUI();
          showNotification("🌟 تم إزالة النجوم - الشرطة صرفت النظر");
        },
      },
      {
        name: "درع الشرطة",
        price: 400,
        desc: "درع واقي +50 صحة",
        icon: "🛡️",
        action: (p) => {
          p.maxHealth = 150;
          p.health = Math.min(p.health + 50, 150);
          showNotification("🛡️ درع الشرطة +50");
        },
      },
      {
        name: "ذخيرة مسدس (x30)",
        price: 180,
        desc: "30 طلقة مسدس",
        icon: "📦",
        action: (p) => {
          p.ammo.pistol = (p.ammo.pistol || 0) + 30;
          showNotification("📦 +30 طلقة مسدس");
        },
      },
      {
        name: "علاج كامل",
        price: 150,
        desc: "استعادة الصحة كاملة",
        icon: "❤️",
        action: (p) => {
          p.health = p.maxHealth;
          showNotification("❤️ تم العلاج الكامل");
        },
      },
    ],
  },
  // Aliases for Police Station (editor or map may store without emoji or with different spacing)
  "🏛️Police Station": {
    title: "🏛️ Police Station - مركز الشرطة",
    items: [
      {
        name: "إزالة النجوم (رشوة)",
        price: 600,
        desc: "إزالة مستوى المطلوبين بالكامل",
        icon: "🌟",
        action: (p) => {
          p.wanted = 0;
          clearPolice();
          updateWantedUI();
          showNotification("🌟 تم إزالة النجوم - الشرطة صرفت النظر");
        },
      },
      {
        name: "درع الشرطة",
        price: 400,
        desc: "درع واقي +50 صحة",
        icon: "🛡️",
        action: (p) => {
          p.maxHealth = 150;
          p.health = Math.min(p.health + 50, 150);
          showNotification("🛡️ درع الشرطة +50");
        },
      },
      {
        name: "ذخيرة مسدس (x30)",
        price: 180,
        desc: "30 طلقة مسدس",
        icon: "📦",
        action: (p) => {
          p.ammo.pistol = (p.ammo.pistol || 0) + 30;
          showNotification("📦 +30 طلقة مسدس");
        },
      },
      {
        name: "علاج كامل",
        price: 150,
        desc: "استعادة الصحة كاملة",
        icon: "❤️",
        action: (p) => {
          p.health = p.maxHealth;
          showNotification("❤️ تم العلاج الكامل");
        },
      },
    ],
  },
  "Police Station": {
    title: "🏛️ Police Station - مركز الشرطة",
    items: [
      {
        name: "إزالة النجوم (رشوة)",
        price: 600,
        desc: "إزالة مستوى المطلوبين بالكامل",
        icon: "🌟",
        action: (p) => {
          p.wanted = 0;
          clearPolice();
          updateWantedUI();
          showNotification("🌟 تم إزالة النجوم - الشرطة صرفت النظر");
        },
      },
      {
        name: "درع الشرطة",
        price: 400,
        desc: "درع واقي +50 صحة",
        icon: "🛡️",
        action: (p) => {
          p.maxHealth = 150;
          p.health = Math.min(p.health + 50, 150);
          showNotification("🛡️ درع الشرطة +50");
        },
      },
      {
        name: "ذخيرة مسدس (x30)",
        price: 180,
        desc: "30 طلقة مسدس",
        icon: "📦",
        action: (p) => {
          p.ammo.pistol = (p.ammo.pistol || 0) + 30;
          showNotification("📦 +30 طلقة مسدس");
        },
      },
      {
        name: "علاج كامل",
        price: 150,
        desc: "استعادة الصحة كاملة",
        icon: "❤️",
        action: (p) => {
          p.health = p.maxHealth;
          showNotification("❤️ تم العلاج الكامل");
        },
      },
    ],
  },
  "🏥 Hospital": {
    title: "🏥 Hospital - مستشفى",
    items: [
      {
        name: "علاج كامل",
        price: 100,
        desc: "استعادة الصحة كاملة",
        icon: "❤️",
        action: (p) => {
          p.health = p.maxHealth;
          showNotification("❤️ تم العلاج الكامل");
        },
      },
      {
        name: "درع طبي",
        price: 300,
        desc: "درع واقي +50 صحة",
        icon: "🛡️",
        action: (p) => {
          p.maxHealth = 150;
          p.health = Math.min(p.health + 50, 150);
          showNotification("🛡️ درع طبي +50");
        },
      },
      {
        name: "إزالة النجوم",
        price: 500,
        desc: "إزالة مستوى المطلوبين",
        icon: "🌟",
        action: (p) => {
          p.wanted = 0;
          clearPolice();
          updateWantedUI();
          showNotification("🌟 تم إزالة النجوم");
        },
      },
      {
        name: "إسعاف سريع",
        price: 200,
        desc: "شفاء فوري +50 صحة",
        icon: "🚑",
        action: (p) => {
          p.health = Math.min(p.health + 50, p.maxHealth);
          showNotification("🚑 تم الإسعاف +50 صحة");
        },
      },
    ],
  },
  // Aliases
  "🏥Hospital": {
    title: "🏥 Hospital - مستشفى",
    items: [
      {
        name: "علاج كامل",
        price: 100,
        desc: "استعادة الصحة كاملة",
        icon: "❤️",
        action: (p) => {
          p.health = p.maxHealth;
          showNotification("❤️ تم العلاج الكامل");
        },
      },
      {
        name: "درع طبي",
        price: 300,
        desc: "درع واقي +50 صحة",
        icon: "🛡️",
        action: (p) => {
          p.maxHealth = 150;
          p.health = Math.min(p.health + 50, 150);
          showNotification("🛡️ درع طبي +50");
        },
      },
      {
        name: "إزالة النجوم",
        price: 500,
        desc: "إزالة مستوى المطلوبين",
        icon: "🌟",
        action: (p) => {
          p.wanted = 0;
          clearPolice();
          updateWantedUI();
          showNotification("🌟 تم إزالة النجوم");
        },
      },
      {
        name: "إسعاف سريع",
        price: 200,
        desc: "شفاء فوري +50 صحة",
        icon: "🚑",
        action: (p) => {
          p.health = Math.min(p.health + 50, p.maxHealth);
          showNotification("🚑 تم الإسعاف +50 صحة");
        },
      },
    ],
  },
  "Hospital": {
    title: "🏥 Hospital - مستشفى",
    items: [
      {
        name: "علاج كامل",
        price: 100,
        desc: "استعادة الصحة كاملة",
        icon: "❤️",
        action: (p) => {
          p.health = p.maxHealth;
          showNotification("❤️ تم العلاج الكامل");
        },
      },
      {
        name: "درع طبي",
        price: 300,
        desc: "درع واقي +50 صحة",
        icon: "🛡️",
        action: (p) => {
          p.maxHealth = 150;
          p.health = Math.min(p.health + 50, 150);
          showNotification("🛡️ درع طبي +50");
        },
      },
      {
        name: "إزالة النجوم",
        price: 500,
        desc: "إزالة مستوى المطلوبين",
        icon: "🌟",
        action: (p) => {
          p.wanted = 0;
          clearPolice();
          updateWantedUI();
          showNotification("🌟 تم إزالة النجوم");
        },
      },
      {
        name: "إسعاف سريع",
        price: 200,
        desc: "شفاء فوري +50 صحة",
        icon: "🚑",
        action: (p) => {
          p.health = Math.min(p.health + 50, p.maxHealth);
          showNotification("🚑 تم الإسعاف +50 صحة");
        },
      },
    ],
  },
};
// ======================== BANK (supervised, realistic money system) ========================
// Rules:
// - Loan $500 per operation, total outstanding loans capped at $8,000.
// - Loans are repaid as-is (no increase); each loan gets a repayment deadline of
//   20 minutes per $1,000 (i.e. 10 minutes for a $500 loan). New loans are blocked
//   while any loan is overdue — repay overdue loans first.
// - Stored money lives in the safe only: deposit $100 at a time, withdraw $100 at a
//   time; withdrawal is impossible when the safe holds less than $100.
// - Investing buys company stock ($100 per operation); the share price is simulated
//   every 30 seconds and may rise or fall, so a full withdrawal can profit or lose.
export const BANK_RULES = {
  LOAN_AMOUNT: 500,
  MAX_LOAN_TOTAL: 8000,
  REPAY_MS_PER_1000: 20 * 60 * 1000,
  STORE_AMOUNT: 100,
  INVEST_AMOUNT: 100,
  STOCK_START_PRICE: 10,
  STOCK_MIN_PRICE: 1,
  STOCK_TICK_MS: 30000,
};

export const STOCK = {
  price: BANK_RULES.STOCK_START_PRICE,
  lastTick: Date.now(),
};

export function getStockPrice() {
  return STOCK.price;
}

export function updateStockPrice() {
  const drift = Math.random() * 0.24 - 0.12; // ±12% per tick, may rise or fall
  const next = STOCK.price * (1 + drift);
  STOCK.price = Math.max(
    BANK_RULES.STOCK_MIN_PRICE,
    Math.round(next * 100) / 100,
  );
  STOCK.lastTick = Date.now();
  return STOCK.price;
}

// Simulated market tick every 30 seconds (guarded so tests/HMR never double-start it)
if (
  typeof setInterval !== "undefined" &&
  typeof window !== "undefined" &&
  !window.__sgStockTimer
) {
  window.__sgStockTimer = setInterval(() => {
    try {
      updateStockPrice();
    } catch {}
  }, BANK_RULES.STOCK_TICK_MS);
}

// Backfill for players created before the bank system existed (old saves)
export function ensureBankFields(p) {
  if (!p) return p;
  if (typeof p.bankSafe !== "number" || Number.isNaN(p.bankSafe)) p.bankSafe = 0;
  if (!Array.isArray(p.bankLoans)) p.bankLoans = [];
  if (typeof p.bankShares !== "number" || Number.isNaN(p.bankShares)) p.bankShares = 0;
  if (typeof p.bankInvested !== "number" || Number.isNaN(p.bankInvested)) p.bankInvested = 0;
  return p;
}

export function getLoanTotal(p) {
  ensureBankFields(p);
  return p.bankLoans.reduce((sum, l) => sum + (l && l.amount ? l.amount : 0), 0);
}

export function getOverdueLoans(p, now) {
  ensureBankFields(p);
  const t = now === undefined ? Date.now() : now;
  return p.bankLoans.filter((l) => l && l.dueAt < t);
}

export function bankRepayMs(amount) {
  return Math.round((amount / 1000) * BANK_RULES.REPAY_MS_PER_1000);
}

export function formatRemaining(ms) {
  if (ms <= 0) return "متأخر الآن";
  const totalSec = Math.floor(ms / 1000);
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m} د ${s} ث`;
}

function bankLoanDesc(p) {
  ensureBankFields(p);
  const total = getLoanTotal(p);
  const left = BANK_RULES.MAX_LOAN_TOTAL - total;
  const overdue = getOverdueLoans(p).length;
  if (overdue > 0) return `قرض $500 — متأخر ${overdue}! سدد أولاً | المستحق $${total} | المتاح $${left}`;
  const mins = bankRepayMs(BANK_RULES.LOAN_AMOUNT) / 60000;
  return `قرض $500 — سداد 10 د (${mins} د) بدون زيادة | المستحق $${total} | المتاح $${left}`;
}

function bankRepayDesc(p) {
  ensureBankFields(p);
  if (p.bankLoans.length === 0) return "لا توجد قروض مستحقة";
  const oldest = p.bankLoans[0];
  const left = formatRemaining(oldest.dueAt - Date.now());
  return `سداد أقدم قرض $${oldest.amount} كما هو | المتبقي: ${left} | القروض: ${p.bankLoans.length}`;
}

function makeBankItems() {
  return [
    {
      name: "قرض $500",
      price: 0,
      priceLabel: "+$500",
      desc: "قرض $500",
      icon: "📝",
      btnText: "اقتراض",
      getDesc: (p) => bankLoanDesc(p),
      canBuy: (p) => {
        ensureBankFields(p);
        const overdue = getOverdueLoans(p).length;
        if (overdue > 0)
          return { ok: false, label: "سدد المتأخر أولاً" };
        if (getLoanTotal(p) + BANK_RULES.LOAN_AMOUNT > BANK_RULES.MAX_LOAN_TOTAL)
          return { ok: false, label: "الحد الأقصى $8000" };
        return { ok: true, label: "اقتراض" };
      },
      action: (p) => {
        ensureBankFields(p);
        if (getOverdueLoans(p).length > 0) {
          showNotification("⛔ لديك قرض متأخر — سدد أولاً");
          return;
        }
        if (getLoanTotal(p) + BANK_RULES.LOAN_AMOUNT > BANK_RULES.MAX_LOAN_TOTAL) {
          showNotification("⛔ لا يمكنك الاقتراض أكثر من $8000");
          return;
        }
        p.money += BANK_RULES.LOAN_AMOUNT;
        p.bankLoans.push({
          amount: BANK_RULES.LOAN_AMOUNT,
          dueAt: Date.now() + bankRepayMs(BANK_RULES.LOAN_AMOUNT),
        });
        showNotification(
          `📝 قرض $500 — السداد خلال 10 دقائق كما هو بدون زيادة (المستحق $${getLoanTotal(p)})`,
        );
      },
    },
    {
      name: "سداد قرض $500",
      price: 500,
      priceLabel: "$500",
      desc: "سداد قرض",
      icon: "💸",
      btnText: "سداد",
      getDesc: (p) => bankRepayDesc(p),
      canBuy: (p) => {
        ensureBankFields(p);
        if (p.bankLoans.length === 0) return { ok: false, label: "لا قروض" };
        if (p.money < 500) return { ok: false, label: "💰" };
        return { ok: true, label: "سداد" };
      },
      action: (p) => {
        ensureBankFields(p);
        const loan = p.bankLoans.shift();
        if (!loan) {
          p.money += 500; // refund the generic deduction if nothing to repay
          showNotification("ℹ️ لا توجد قروض مستحقة");
          return;
        }
        showNotification(`💸 سددت $${loan.amount} كما هو (المتبقي $${getLoanTotal(p)})`);
      },
    },
    {
      name: "إيداع $100 في الحساب",
      price: 100,
      priceLabel: "$100",
      desc: "إيداع",
      icon: "🔒",
      btnText: "إيداع",
      getDesc: (p) => {
        ensureBankFields(p);
        return `إيداع $100 في الخزنة | رصيد الخزنة $${p.bankSafe}`;
      },
      action: (p) => {
        ensureBankFields(p);
        p.bankSafe += 100;
        showNotification(`🔒 أودعت $100 (الخزنة $${p.bankSafe})`);
      },
    },
    {
      name: "سحب $100 من الخزنة",
      price: 0,
      priceLabel: "$100",
      desc: "سحب من الخزنة",
      icon: "🏦",
      btnText: "سحب",
      getDesc: (p) => {
        ensureBankFields(p);
        if (p.bankSafe < 100) return "الخزنة فارغة — لا يمكن السحب";
        return `سحب $100 من الخزنة فقط | الرصيد $${p.bankSafe}`;
      },
      canBuy: (p) => {
        ensureBankFields(p);
        if (p.bankSafe < 100) return { ok: false, label: "الخزنة فارغة" };
        return { ok: true, label: "سحب" };
      },
      action: (p) => {
        ensureBankFields(p);
        if (p.bankSafe < 100) {
          showNotification("⛔ الخزنة فارغة — لا يمكن السحب");
          return;
        }
        p.bankSafe -= 100;
        p.money += 100;
        showNotification(`🏦 سحبت $100 (الخزنة $${p.bankSafe})`);
      },
    },
    {
      name: "استثمار $100 في أسهم الشركة",
      price: 100,
      priceLabel: "$100",
      desc: "استثمار",
      icon: "📈",
      btnText: "استثمار",
      getDesc: (p) => {
        ensureBankFields(p);
        const value = Math.round(p.bankShares * STOCK.price);
        return `استثمار $100 = ${(100 / STOCK.price).toFixed(2)} سهم @ $${STOCK.price} | أسهمك ${p.bankShares.toFixed(2)} (≈$${value}) — يتغير كل 30 ث`;
      },
      action: (p) => {
        ensureBankFields(p);
        const shares = 100 / STOCK.price;
        p.bankShares = Math.round((p.bankShares + shares) * 100) / 100;
        p.bankInvested += 100;
        showNotification(`📈 اشتريت ${shares.toFixed(2)} سهم @ $${STOCK.price}`);
      },
    },
    {
      name: "سحب الاستثمار",
      price: 0,
      priceLabel: "الأسهم",
      desc: "سحب الاستثمار",
      icon: "💹",
      btnText: "سحب الاستثمار",
      getDesc: (p) => {
        ensureBankFields(p);
        if (p.bankShares <= 0) return "لا يوجد استثمار — استثمر $100 أولاً";
        const value = Math.round(p.bankShares * STOCK.price);
        const pl = value - p.bankInvested;
        const sign = pl >= 0 ? "+" : "";
        return `سحب ${p.bankShares.toFixed(2)} سهم @ $${STOCK.price} ≈ $${value} (${sign}$${pl}) — قد يرتفع أو ينخفض`;
      },
      canBuy: (p) => {
        ensureBankFields(p);
        if (p.bankShares <= 0) return { ok: false, label: "لا استثمار" };
        return { ok: true, label: "سحب الاستثمار" };
      },
      action: (p) => {
        ensureBankFields(p);
        if (p.bankShares <= 0) {
          showNotification("⛔ لا يوجد استثمار لسحبه");
          return;
        }
        const payout = Math.round(p.bankShares * STOCK.price);
        const pl = payout - p.bankInvested;
        p.money += payout;
        showNotification(
          pl >= 0
            ? `💹 سحبت $${payout} (ربح +$${pl})`
            : `💹 سحبت $${payout} (خسارة $${pl})`,
        );
        p.bankShares = 0;
        p.bankInvested = 0;
      },
    },
  ];
}

const BANK_ITEMS = makeBankItems();

function isBankShop(shopName) {
  return /bank|بنك/i.test(shopName || "");
}

function bankSummary(p) {
  ensureBankFields(p);
  const overdue = getOverdueLoans(p).length;
  const investValue = Math.round(p.bankShares * STOCK.price);
  return `💰 $${p.money} | 🏦 خزنة $${p.bankSafe} | 📝 قروض $${getLoanTotal(p)}${overdue ? ` (${overdue} متأخر!)` : ""} | 📈 استثمار ≈$${investValue} @ $${STOCK.price}`;
}

// Bank catalog (shared by all 3 keys so every alias has identical supervised services)
SHOPS["🏦 Bank"] = { title: "🏦 Bank - بنك", items: BANK_ITEMS };
// Aliases
SHOPS["🏦Bank"] = { title: "🏦 Bank - بنك", items: BANK_ITEMS };
SHOPS["Bank"] = { title: "🏦 Bank - بنك", items: BANK_ITEMS };

let activeShop = null;
let nearShopName = null;
export function getNearShopName(){ return nearShopName; }
export function setNearShopName(v){ nearShopName = v; if (typeof window !== 'undefined') window.nearShopName = v; }

export function givePersonalCar(typeIndex) {
  // Eject player if driving the car they're replacing
  if (player.inVehicle && player.inVehicle.isPersonal) {
    player.inVehicle = null;
    player.onFoot = true;
  }
  // Find a road tile near player
  let px = player.x,
    py = player.y;
  for (let i = 0; i < 30; i++) {
    const nx = player.x + (Math.random() - 0.5) * 200;
    const ny = player.y + (Math.random() - 0.5) * 200;
    if (isOnRoad(nx, ny)) {
      px = nx;
      py = ny;
      break;
    }
  }
  const type = VEHICLE_TYPES[typeIndex];
  if (!type) { showNotification("❌ نوع السيارة غير موجود"); return; }
  const health = 18;
  const car = {
    x: px,
    y: py,
    w: type.w,
    h: type.h,
    speed: type.speed + 0.3,
    cruiseSpeed: 1.6 + Math.random()*0.6,
    type: type,
    typeIdx: typeIndex,
    angle: Math.PI / 2,
    vx: 0,
    vy: 0,
    driver: null,
    isPolice: false,
    siren: false,
    occupied: false,
    isPersonal: true,
    hidden: false,
    exploding: false,
    health, maxHealth: health,
    npcTargetX: px,
    npcTargetY: py,
    npcWaitTimer: 0,
    npcState: "waiting",
    moveAngle: Math.PI / 2,
  };
  vehicles.push(car);
  // Ownership: keep an unlimited garage (array) instead of replacing the single car.
  // personalCar stays the most recently bought car for backward compat.
  if (!Array.isArray(player.ownedCars)) player.ownedCars = [];
  player.ownedCars.push(car);
  player.personalCar = car;
  showNotification(`🚗 تم شراء ${type.name}! ملكيتك الآن ${player.ownedCars.length} سيارة`);
}

export function openShop(shopName) {
  const shop = SHOPS[shopName];
  if (!shop) return;
  activeShop = shopName;
  document.getElementById("shopTitle").textContent = shop.title;
  const container = document.getElementById("shopItems");
  container.innerHTML = "";
  shop.items.forEach((item, idx) => {
    const div = document.createElement("div");
    div.className = "shop-item";
    const price = item.price || 0;
    let canBuy;
    let btnLabel;
    let buyGuard = null;
    if (typeof item.canBuy === "function") {
      buyGuard = item.canBuy(player) || {};
      canBuy = !!buyGuard.ok;
      btnLabel = buyGuard.label || item.btnText || (canBuy ? "شراء" : "💰");
    } else {
      canBuy = player.money >= price;
      btnLabel = item.btnText || (canBuy ? "شراء" : "💰");
    }
    // Media — car image for car shop items, emoji fallback otherwise
    const media = document.createElement("div");
    media.className = "shop-item-media";
    const imgSrc = getCarImgSrc(item.carType);
    if (imgSrc) {
      const img = document.createElement("img");
      img.src = imgSrc;
      img.alt = item.name;
      img.loading = "lazy";
      img.onerror = () => {
        try { img.remove(); } catch {}
        if(!media.querySelector(".shop-item-fallback")){
          const fb = document.createElement("span");
          fb.className = "shop-item-fallback";
          fb.textContent = item.icon || "🚗";
          media.appendChild(fb);
        }
      };
      media.appendChild(img);
    } else {
      const fb = document.createElement("span");
      fb.className = "shop-item-fallback";
      fb.textContent = item.icon || "📦";
      media.appendChild(fb);
    }
    // Info — name/price + desc
    const info = document.createElement("div");
    info.className = "shop-item-info";
    const nameRow = document.createElement("div");
    nameRow.className = "shop-item-name";
    const nameText = document.createElement("span");
    nameText.textContent = `${item.icon || ""} ${item.name} `;
    const priceSpan = document.createElement("span");
    priceSpan.className = "price";
    priceSpan.textContent = item.priceLabel || `— $${price}`;
    nameRow.appendChild(nameText);
    nameRow.appendChild(priceSpan);
    const descRow = document.createElement("div");
    descRow.className = "shop-item-desc";
    descRow.textContent =
      typeof item.getDesc === "function" ? item.getDesc(player) : item.desc;
    info.appendChild(nameRow);
    info.appendChild(descRow);
    const btn = document.createElement("button");
    btn.className = "menu-btn";
    btn.style.background = canBuy ? "#ff6b35" : "#444";
    btn.style.color = canBuy ? "#fff" : "#666";
    btn.disabled = !canBuy;
    btn.textContent = btnLabel;
    if (buyGuard && buyGuard.label && !canBuy) btn.title = buyGuard.label;
    if (canBuy) {
      btn.onclick = () => {
        if (typeof item.canBuy === "function") {
          const guard = item.canBuy(player) || {};
          if (!guard.ok) {
            if (guard.label) showNotification(guard.label);
            return;
          }
        } else if (player.money < price) return;
        if (price > 0) player.money -= price;
        item.action(player);
        updateHUD();
        openShop(shopName);
        // refresh
        if (shopName === "👕 Binco") showNotification("👕 تم تغيير اللباس!");
        else if (shopName === "💊 عيادة") showNotification("❤️ تم العلاج!");
      };
    }
    div.appendChild(media);
    div.appendChild(info);
    div.appendChild(btn);
    container.appendChild(div);
  });
  document.getElementById("shopPlayerInfo").textContent = isBankShop(shopName)
    ? bankSummary(player)
    : isCarShop(shopName)
      ? `💰 $${player.money} | 🚗 ملكيتك ${Array.isArray(player.ownedCars) ? player.ownedCars.length : 0} سيارة`
      : `💰 $${player.money} | ❤️ ${Math.round(player.health)}`;
  document.getElementById("shopDialog").style.display = "flex";
}

function isCarShop(shopName) {
  return /معرض سيارات|car showroom|سيارات/i.test(shopName || "");
}

const _closeShopBtn = document.getElementById("closeShopBtn");
if(_closeShopBtn) _closeShopBtn.onclick = () => {
  const d=document.getElementById("shopDialog");
  if(d) d.style.display = "none";
  activeShop = null;
};

// Overlay button (death/respawn)
if(overlayBtn){
  overlayBtn.addEventListener("click", () => {
    if (!player.alive) {
      respawnPlayer();
    } else {
      if(overlay) overlay.style.display = "none";
    }
  });
}
