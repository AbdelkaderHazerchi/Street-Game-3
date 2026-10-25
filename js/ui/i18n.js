// ======================== I18N ========================
// Provides ar/en translations for Street Game 2
import { SETTINGS } from "../input/settings.js?v=57";

export const translations = {
  ar: {
    // General
    "app.title": "Street Game - 2D Edition",
    "settings.title": "⚙️ الإعدادات",
    "settings.general": "⚙️ عام",
    "settings.controls": "⌨️ التحكم",
    "settings.language": "🌐 اللغة",
    "settings.difficulty": "⚔️ الصعوبة",
    "settings.difficulty.easy": "🟢 سهل",
    "settings.difficulty.medium": "🟡 متوسط",
    "settings.difficulty.hard": "🔴 صعب",
    "settings.keyboard.title": "⌨️ لوحة المفاتيح",
    "settings.keyboard.hint": "اضغط على زر المفتاح ثم اضغط المفتاح الجديد — ESC للإلغاء",
    "settings.done": "✅ تم",
    "settings.reset": "🔄 إعادة تعيين",

    // Main menu
    "menu.newGame": "🎮 لعب جديد",
    "menu.continue": "💾 استمرار",
    "menu.settings": "⚙️ الإعدادات",

    // New game dialog
    "newGame.title": "🎮 لعب جديد",
    "newGame.prompt": "ادخل اسم اللعبة:",
    "newGame.placeholder": "اسم اللعبة...",
    "newGame.start": "✅ ابدأ",
    "newGame.cancel": "❌ إلغاء",

    // Pause
    "pause.title": "⏸ إيقاف مؤقت",
    "pause.resume": "▶ استئناف",
    "pause.save": "💾 حفظ اللعبة",
    "pause.settings": "⚙️ الإعدادات",
    "pause.quit": "🚪 القائمة الرئيسية",
    "pause.tabJournal": "القصة",
    "pause.tabMenu": "القائمة",
    "pause.tabMap": "الخريطة",
    "pause.subtitle": "متوقف مؤقتاً",

    // Save/Load
    "save.title": "💾 حفظ اللعبة",
    "save.cancel": "❌ إلغاء",
    "save.noSaves": "لا توجد حفظات",
    "save.saved": "💾 تم الحفظ: {name}",
    "load.title": "📂 تحميل اللعبة",
    "load.cancel": "❌ إلغاء",
    "load.loaded": "📂 تم التحميل: {name}",

    // HUD
    "hud.health": "✅ الصحة",
    "hud.money": "💰",
    "hud.ammo": "🔫",
    "hud.noMission": "🎯 لا توجد مهمة نشطة",
    "hud.goYellow": "اذهب إلى النقاط الصفراء على الخريطة لبدء مهمة",
    "hud.goYellowMain": "اذهب إلى النقطة الصفراء لبدء المهمة الرئيسية",
    "hud.goPurpleSide": "اذهب إلى النقاط البنفسجية للمهمات الجانبية",
    "hud.questActive": "🎯 مهمة نشطة",
    "hud.questProgress": "التقدم",
    "hud.questDropOff": "🏁 اذهب إلى نقطة التسليم الخضراء لإنهاء المهمة",
    "hud.allMainsDone": "🏆 جميع المهام الرئيسية مكتملة!",
    "hud.mainsDoneDesc": "أحسنت! أكملت جميع المهام الرئيسية",
    "hud.controls": "تحريك | دخول/خروج | إطلاق نار | بوق | إلغاء مهمة | حقيبة | سلاح | إخفاء/إظهار الواجهة | تخطي الفيديو",
    "hud.skipHint": "⏩ اضغط F4 لتخطي الفيديو",
    "hud.notification.health": "استعادة الصحة",

    // Inventory
    "inventory.title": "🎒 الحقيبة",
    "inventory.hint": "1-5 تبديل سلاح • I إغلاق",
    "inventory.empty": "الحقيبة فارغة",
    "inventory.bullets": "طلقة",

    // Overlay
    "overlay.gta": "GTA 6 - 2D",
    "overlay.vice": "مدينة Vice City تنتظرك!",
    "overlay.start": "ابدأ المغامرة",
    "overlay.dead": "💀 أنت ميت",
    "overlay.arrested": "تم القبض عليك! الفلوس المتبقية: ${money}",
    "overlay.retry": "إعادة المحاولة",

    // Shop
    "shop.title": "🏪 متجر",
    "shop.close": "❌ إغلاق",
    "shop.notEnough": "💰 فلوس غير كافية",
    "shop.purchased": "تم الشراء",
    "shop.ammoPistol": "طلقات مسدس",
    "shop.ammoSMG": "رشاش SMG",
    "shop.rifle": "بندقية",
    "shop.shotgun": "شوزن",
    "shop.health": "علاج كامل",
    "shop.armor": "درع واقي",
    "shop.clearWanted": "إزالة المطلوبين",

    // Keybind labels
    "key.up": "↑ للأمام",
    "key.down": "↓ للخلف",
    "key.left": "← لليسار",
    "key.right": "→ لليمين",
    "key.enterExit": "🚪 دخول/خروج",
    "key.shoot": "🔫 إطلاق نار",
    "key.melee": "👊 لكمة",
    "key.horn": "📯 بوق",
    "key.cancelMission": "❌ إلغاء مهمة",
    "key.pause": "⏸ إيقاف",
    "key.inventory": "🎒 حقيبة",
    "key.weaponNext": "⏭ سلاح تالي",
    "key.pressNew": "… اضغط مفتاح",
    "key.used": "⚠️ المفتاح مستخدم لـ {action}",

    // Weapons
    "weapon.fists": "اليدين",
    "weapon.pistol": "مسدس",
    "weapon.smg": "رشاش",
    "weapon.rifle": "بندقية",
    "weapon.shotgun": "شوزن",

    // Notifications / missions
    "notif.enterCar": "🚗 دخلت {name}",
    "notif.exitCar": "🚶 خرجت من السيارة",
    "notif.horn": "📯 بوق!",
    "notif.canceled": "تم الإلغاء",
    "notif.reset": "🔄 تمت إعادة التعيين",
    "notif.diff.easy": "🟢 الصعوبة: سهل",
    "notif.diff.medium": "🟡 الصعوبة: متوسط",
    "notif.diff.hard": "🔴 الصعوبة: صعب",
    "notif.lang.ar": "🌐 اللغة: العربية",
    "notif.lang.en": "🌐 Language: English",

    // Controls help short
    "controls.move": "تحريك",
    "controls.enterExit": "دخول/خروج",
    "controls.shoot": "إطلاق",
    "controls.melee": "لكمة",
    "controls.aim": "تصويب",
    "controls.horn": "بوق",
    "controls.cancel": "إلغاء مهمة",
    "controls.inventory": "حقيبة",
    "controls.weapon": "سلاح",
    "controls.toggleUI": "إخفاء/إظهار الواجهة",
    "controls.skip": "تخkip الفيديو",

    // Difficulty descriptions
    "diff.easy.desc": "صحة أكثر، شرطة أقل، مال ابتدائي أكثر",
    "diff.medium.desc": "تجربة متوازنة",
    "diff.hard.desc": "ضرر أكبر، شرطة عدوانية، مال أقل",

    // Chat
    "chat.next": "➡️ التالي — Next (E)",
    "chat.close": "❌ إغلاق",
    "chat.hint": "اضغط E للمتابعة — Press E to continue — ESC للإغلاق",

    // Shop items (fallback)
    "shop.pistolAmmo.name": "طلقات مسدس (x20)",
    "shop.pistolAmmo.desc": "20 طلقة للمسدس",
    "shop.smg.name": "رشاش SMG",
    "shop.smg.desc": "رشاش سريع +50 طلقة",
  },
  en: {
    "app.title": "Street Game - 2D Edition",
    "settings.title": "⚙️ Settings",
    "settings.general": "⚙️ General",
    "settings.controls": "⌨️ Controls",
    "settings.language": "🌐 Language",
    "settings.difficulty": "⚔️ Difficulty",
    "settings.difficulty.easy": "🟢 Easy",
    "settings.difficulty.medium": "🟡 Medium",
    "settings.difficulty.hard": "🔴 Hard",
    "settings.keyboard.title": "⌨️ Keyboard",
    "settings.keyboard.hint": "Click a key button then press the new key — ESC to cancel",
    "settings.done": "✅ Done",
    "settings.reset": "🔄 Reset",

    "menu.newGame": "🎮 New Game",
    "menu.continue": "💾 Continue",
    "menu.settings": "⚙️ Settings",

    "newGame.title": "🎮 New Game",
    "newGame.prompt": "Enter save name:",
    "newGame.placeholder": "Save name...",
    "newGame.start": "✅ Start",
    "newGame.cancel": "❌ Cancel",

    "pause.title": "⏸ Paused",
    "pause.resume": "▶ Resume",
    "pause.save": "💾 Save Game",
    "pause.settings": "⚙️ Settings",
    "pause.quit": "🚪 Main Menu",
    "pause.tabJournal": "Story",
    "pause.tabMenu": "Menu",
    "pause.tabMap": "Map",
    "pause.subtitle": "Paused",

    "save.title": "💾 Save Game",
    "save.cancel": "❌ Cancel",
    "save.noSaves": "No saves yet",
    "save.saved": "💾 Saved: {name}",
    "load.title": "📂 Load Game",
    "load.cancel": "❌ Cancel",
    "load.loaded": "📂 Loaded: {name}",

    "hud.health": "✅ Health",
    "hud.money": "💰",
    "hud.ammo": "🔫",
    "hud.noMission": "🎯 No active mission",
    "hud.goYellow": "Go to yellow dots on map to start a mission",
    "hud.goYellowMain": "Go to yellow marker to start main mission",
    "hud.goPurpleSide": "Go to purple dots for side quests",
    "hud.questActive": "🎯 Active mission",
    "hud.questProgress": "Progress",
    "hud.questDropOff": "🏁 Go to green drop-off to finish",
    "hud.allMainsDone": "🏆 All main missions complete!",
    "hud.mainsDoneDesc": "Great job! No more main quests",
    "hud.controls": "Move | Enter/Exit | Shoot | Horn | Cancel | Inventory | Weapon | Toggle UI | Skip Video",
    "hud.skipHint": "⏩ Press F4 to skip video",
    "hud.notification.health": "Health restored",

    "inventory.title": "🎒 Inventory",
    "inventory.hint": "1-5 switch weapon • I close",
    "inventory.empty": "Inventory empty",
    "inventory.bullets": "bullets",

    "overlay.gta": "GTA 6 - 2D",
    "overlay.vice": "Vice City awaits!",
    "overlay.start": "Start Adventure",
    "overlay.dead": "💀 Wasted",
    "overlay.arrested": "Busted! Money left: ${money}",
    "overlay.retry": "Retry",

    "shop.title": "🏪 Shop",
    "shop.close": "❌ Close",
    "shop.notEnough": "💰 Not enough money",
    "shop.purchased": "Purchased",
    "shop.ammoPistol": "Pistol ammo",
    "shop.ammoSMG": "SMG",
    "shop.rifle": "Rifle",
    "shop.shotgun": "Shotgun",
    "shop.health": "Full heal",
    "shop.armor": "Armor",
    "shop.clearWanted": "Clear wanted",

    "key.up": "↑ Forward",
    "key.down": "↓ Back",
    "key.left": "← Left",
    "key.right": "→ Right",
    "key.enterExit": "🚪 Enter/Exit",
    "key.shoot": "🔫 Shoot",
    "key.melee": "👊 Punch",
    "key.horn": "📯 Horn",
    "key.cancelMission": "❌ Cancel Mission",
    "key.pause": "⏸ Pause",
    "key.inventory": "🎒 Inventory",
    "key.weaponNext": "⏭ Next Weapon",
    "key.pressNew": "… Press key",
    "key.used": "⚠️ Key already used for {action}",

    "weapon.fists": "Fists",
    "weapon.pistol": "Pistol",
    "weapon.smg": "SMG",
    "weapon.rifle": "Rifle",
    "weapon.shotgun": "Shotgun",

    "chat.next": "➡️ Next (E)",
    "chat.close": "❌ Close",
    "chat.hint": "Press E to continue — ESC to close",

    "notif.enterCar": "🚗 Entered {name}",
    "notif.exitCar": "🚶 Exited vehicle",
    "notif.horn": "📯 Honk!",
    "notif.canceled": "Canceled",
    "notif.reset": "🔄 Reset done",
    "notif.diff.easy": "🟢 Difficulty: Easy",
    "notif.diff.medium": "🟡 Difficulty: Medium",
    "notif.diff.hard": "🔴 Difficulty: Hard",
    "notif.lang.ar": "🌐 Language: Arabic",
    "notif.lang.en": "🌐 Language: English",

    "controls.move": "Move",
    "controls.enterExit": "Enter/Exit",
    "controls.shoot": "Shoot",
    "controls.melee": "Punch",
    "controls.aim": "Aim",
    "controls.horn": "Horn",
    "controls.cancel": "Cancel Mission",
    "controls.inventory": "Inventory",
    "controls.weapon": "Weapon",
    "controls.toggleUI": "Toggle UI",
    "controls.skip": "Skip Video",

    "diff.easy.desc": "More health, fewer police, more starting cash",
    "diff.medium.desc": "Balanced experience",
    "diff.hard.desc": "More damage, aggressive police, less cash",
  }
};

function escapeHtml(s){
  return String(s).replace(/[&<>"']/g, c=> ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
}
export function t(key, params = {}) {
  const lang = SETTINGS.language || "ar";
  const dict = translations[lang] || translations.ar;
  let str = dict[key] ?? translations.ar[key] ?? key;
  for (const [k, v] of Object.entries(params)) {
    const safe = escapeHtml(v);
    str = str.replace(new RegExp(`\\{${k}\\}`, "g"), safe);
    str = str.replace(new RegExp(`\\$\\{${k}\\}`, "g"), safe);
  }
  return str;
}

export function applyI18n() {
  const lang = SETTINGS.language || "ar";
  document.documentElement.lang = lang;
  document.documentElement.dir = lang === "ar" ? "rtl" : "ltr";
  document.body.dir = lang === "ar" ? "rtl" : "ltr";

  // Update title
  try { document.title = t("app.title"); } catch {}

  // Elements with data-i18n attribute
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    if (!key) return;
    const txt = t(key);
    if (el.children.length === 0) el.textContent = txt;
    else {
      el.textContent = txt;
    }
  });
  // Placeholders
  document.querySelectorAll("[data-i18n-placeholder]").forEach(el => {
    const key = el.getAttribute("data-i18n-placeholder");
    if (!key) return;
    el.placeholder = t(key);
  });

  // Specific manual updates that need params or special handling
  try {
    const healthLabel = document.getElementById("healthLabel");
    if (healthLabel) healthLabel.textContent = t("hud.health");
  } catch {}
  // Weapon names are handled via hud.js updateHUD which should call t
  // Mission box is dynamic; ensure default texts
  try {
    const missionTitle = document.getElementById("missionTitle");
    const missionDesc = document.getElementById("missionDesc");
    if (missionTitle && (missionTitle.textContent.includes("لا توجد") || missionTitle.textContent.includes("No active"))) {
      missionTitle.textContent = t("hud.noMission");
    }
    if (missionDesc && (missionDesc.textContent.includes("النقاط الصفراء") || missionDesc.textContent.includes("yellow dots"))) {
      missionDesc.textContent = t("hud.goYellow");
    }
  } catch {}
  // Difficulty desc dynamic
  try {
    const desc = document.getElementById("difficultyDesc");
    if (desc) desc.textContent = t(`diff.${SETTINGS.difficulty}.desc`);
  } catch {}

  // Update controlsHelp if present - rebuild
  try {
    const ch = document.getElementById("controlsHelp");
    if (ch) {
      if (lang === "en") {
        ch.innerHTML = `<span>WASD</span> ${t("controls.move")} | <span>E</span> ${t("controls.enterExit")} | <span>Left Click</span> ${t("controls.shoot")} | <span>F</span> ${t("controls.melee")} | <span>Right Hold</span> ${t("controls.aim")}<br><span>G</span> ${t("controls.horn")} | <span>M</span> ${t("controls.cancel")} | <span>I</span> ${t("controls.inventory")} | <span>1-5</span> ${t("controls.weapon")}<br><span>F2</span> ${t("controls.toggleUI")} | <span>F4</span> ${t("controls.skip")}`;
      } else {
        ch.innerHTML = `<span>WASD</span> ${t("controls.move")} | <span>E</span> ${t("controls.enterExit")} | <span>زر يسار</span> ${t("controls.shoot")} | <span>F</span> ${t("controls.melee")} | <span>زر يمين مطول</span> ${t("controls.aim")}<br><span>G</span> ${t("controls.horn")} | <span>M</span> ${t("controls.cancel")} | <span>I</span> ${t("controls.inventory")} | <span>1-5</span> ${t("controls.weapon")}<br><span>F2</span> ${t("controls.toggleUI")} | <span>F4</span> ${t("controls.skip")}`;
      }
    }
  } catch {}

  try {
    const skip = document.getElementById("skipHint");
    if (skip) {
      if (lang === "en") skip.innerHTML = `⏩ Press <span style="background:rgba(255,215,0,0.2);padding:1px 6px;border-radius:4px;border:1px solid rgba(255,215,0,0.3)">F4</span> ${t("controls.skip")}`;
      else skip.innerHTML = `⏩ اضغط <span style="background:rgba(255,215,0,0.2);padding:1px 6px;border-radius:4px;border:1px solid rgba(255,215,0,0.3)">F4</span> لتخطي الفيديو`;
    }
  } catch {}

  // Update inventory hint
  try {
    const invHint = document.getElementById("invHint");
    if (invHint) invHint.textContent = t("inventory.hint");
    const invHeader = document.getElementById("invHeader");
    if (invHeader) invHeader.textContent = t("inventory.title");
  } catch {}
}

export function getWeaponName(key) {
  const map = { fists: "weapon.fists", pistol: "weapon.pistol", smg: "weapon.smg", rifle: "weapon.rifle", shotgun: "weapon.shotgun" };
  return t(map[key] || key);
}
