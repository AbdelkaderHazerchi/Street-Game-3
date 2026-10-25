// ======================== AUDIO / SOUNDS ========================
// Handles all game sound effects per spec:
// - in_city.mp3   : Loops during gameplay (not in main menu or pause)
// - enter_car.mp3 : Plays when entering a car
// - gun_shot.mp3  : Pistol each shot
// - gun2_shot.mp3 : Machine gun (SMG) loops while trigger held
// - sniper_shot.mp3: Sniper rifle each shot
// - car_explotion.mp3: Car explosion
// - bomb_explotion.mp3: Bomb explosion (plantBomb mission)

// Paths - primary uses actual file case on disk (some MP3 uppercase) to avoid fallback double-play
// Also keep lowercase variants as alt for spec compliance (assets/sounds/gun_shot.mp3 etc)
const SOUND_SRC = {
  city: "assets/sounds/in_city.mp3",
  cityAlt: "assets/sounds/in_city.MP3",
  enterCar: "assets/sounds/enter_car.mp3",
  enterCarAlt: "assets/sounds/enter_car.MP3",
  gunShot: "assets/sounds/gun_shot.MP3",
  gunShotAlt: "assets/sounds/gun_shot.mp3",
  gun2Shot: "assets/sounds/gun2_shot.MP3",
  gun2ShotAlt: "assets/sounds/gun2_shot.mp3",
  sniperShot: "assets/sounds/sniper_shot.MP3",
  sniperShotAlt: "assets/sounds/sniper_shot.mp3",
  carExplosion: "assets/sounds/car_explotion.mp3",
  carExplosionAlt: "assets/sounds/car_explotion.MP3",
  bombExplosion: "assets/sounds/bomb_explotion.MP3",
  bombExplosionAlt: "assets/sounds/bomb_explotion.mp3",
  driving: "assets/sounds/driving_car.mp3",
  drivingAlt: "assets/sounds/driving_car.MP3",
  menu: "assets/sounds/Asphalt_Coliseum.mp3",
  menuAlt: "assets/sounds/Asphalt_Coliseum.MP3",
  punch: "assets/sounds/punch.mp3",
  punchAlt: "assets/sounds/punch.MP3",
};

// Master volume (0..1) - can be wired to settings later
let masterVolume = 1.0;
let sfxVolume = 0.85;
let musicVolume = 0.35;

let cityAudio = null;
let menuAudio = null;
let gun2Audio = null;
let drivingAudio = null;
let _cityShouldPlay = false;
let _cityPlaying = false;
let _menuShouldPlay = false;
let _menuPlaying = false;
let _gun2Playing = false;
let _unlocked = false;
let _initDone = false;

// Driving sound state - volume fades with speed
let _drivingTarget = 0;
let _drivingVol = 0;
let _drivingPlaying = false;

// Debounce map to prevent double-play within same frame/tick
let _lastSfxTime = {};
function _shouldPlayDebounced(key, minIntervalMs) {
  const now = (typeof performance !== "undefined" && performance.now) ? performance.now() : Date.now();
  const last = _lastSfxTime[key] || 0;
  if (now - last < minIntervalMs) return false;
  _lastSfxTime[key] = now;
  return true;
}

function safeVolume(v) {
  return Math.max(0, Math.min(1, v * masterVolume));
}

function createAudio(src, { loop = false, volume = 1.0 } = {}) {
  try {
    const a = new Audio();
    a.src = src;
    a.preload = "auto";
    a.loop = loop;
    a.volume = safeVolume(volume);
    // Hint browser to load
    try { a.load(); } catch {}
    // Fallback on error to alternate case
    a.addEventListener("error", () => {
      const alt = getAltSrc(src);
      if (alt && alt !== src && a.src !== alt && !a._triedAlt) {
        a._triedAlt = true;
        a.src = alt;
        try { a.load(); } catch {}
      }
    });
    return a;
  } catch (e) {
    console.warn("[sounds] createAudio failed", src, e);
    return null;
  }
}

function getAltSrc(src) {
  for (const [k, v] of Object.entries(SOUND_SRC)) {
    if (v === src) {
      const altKey = k.endsWith("Alt") ? null : k + "Alt";
      if (altKey && SOUND_SRC[altKey]) return SOUND_SRC[altKey];
      // reverse lookup
      if (k.endsWith("Alt")) {
        const base = k.slice(0, -3);
        if (SOUND_SRC[base]) return SOUND_SRC[base];
      }
    }
  }
  // Generic fallback toggle case of extension
  if (src.endsWith(".mp3")) return src.slice(0, -4) + ".MP3";
  if (src.endsWith(".MP3")) return src.slice(0, -4) + ".mp3";
  return null;
}

let _audioCache = {};
function getCachedAudio(src, volume) {
  let a = _audioCache[src];
  if (!a) {
    a = createAudio(src, { volume });
    if (a) _audioCache[src] = a;
  } else {
    try { a.volume = safeVolume(volume * sfxVolume); } catch {}
  }
  return a;
}
function playOneShot(src, volume = 0.8) {
  try {
    const vol = safeVolume(volume * sfxVolume);
    // Reuse single Audio to prevent overlapping double-play; restart if still playing
    let a = _audioCache[src];
    if (!a || a._triedAlt) {
      a = getCachedAudio(src, volume);
    } else {
      try { a.volume = vol; } catch {}
    }
    if (!a) {
      // fallback to new Audio if cache failed
      const fallback = new Audio();
      fallback.src = src;
      fallback.volume = vol;
      const pp = fallback.play();
      if (pp && pp.catch) pp.catch(()=>{});
      return;
    }
    // If already playing, restart instead of overlapping (prevents double)
    try {
      if (!a.paused && !a.ended) {
        a.pause();
        a.currentTime = 0;
      } else {
        a.currentTime = 0;
      }
    } catch {}
    const p = a.play();
    if (p && p.catch) {
      p.catch(() => {
        // On play failure (404), try alt once
        if (!a._triedAlt) {
          const alt = getAltSrc(src);
          if (alt && alt !== src) {
            a._triedAlt = true;
            a.src = alt;
            try { a.load(); } catch {}
            a.volume = vol;
            const pp = a.play();
            if (pp && pp.catch) pp.catch(()=>{});
            // also cache alt
            _audioCache[alt] = a;
          }
        }
      });
    }
    // Also handle error event for 404 before play promise
    if (!a._hasErrorHandler) {
      a._hasErrorHandler = true;
      a.addEventListener("error", () => {
        if (a._triedAlt) return;
        const alt = getAltSrc(src);
        if (alt && alt !== src) {
          a._triedAlt = true;
          a.src = alt;
          try { a.load(); } catch {}
          a.volume = vol;
          const pp = a.play();
          if (pp && pp.catch) pp.catch(()=>{});
          _audioCache[alt] = a;
        }
      });
    }
  } catch (e) {
    // silent
  }
}

export function setMasterVolume(v) { masterVolume = Math.max(0, Math.min(1, v)); syncVolumes(); }
export function setSfxVolume(v) { sfxVolume = Math.max(0, Math.min(1, v)); syncVolumes(); }
export function setMusicVolume(v) { musicVolume = Math.max(0, Math.min(1, v)); syncVolumes(); }

function syncVolumes() {
  try {
    if (cityAudio) cityAudio.volume = safeVolume(musicVolume);
    if (menuAudio) menuAudio.volume = safeVolume(musicVolume);
    if (gun2Audio) gun2Audio.volume = safeVolume(0.6 * sfxVolume);
    if (drivingAudio) drivingAudio.volume = safeVolume(_drivingVol);
  } catch {}
}

export function isAudioUnlocked() { return _unlocked; }

function unlockAudio() {
  if (_unlocked) return;
  _unlocked = true;
  // Try to resume city if it should be playing (user gesture now allows autoplay)
  if (_cityShouldPlay && cityAudio) {
    try {
      const p = cityAudio.play();
      if (p && p.then) p.then(() => { _cityPlaying = true; }).catch(() => {});
      else _cityPlaying = true;
    } catch {}
  }
  if (_menuShouldPlay && menuAudio) {
    try {
      const p = menuAudio.play();
      if (p && p.then) p.then(() => { _menuPlaying = true; }).catch(() => {});
      else _menuPlaying = true;
    } catch {}
  }
  if (_gun2Playing && gun2Audio && gun2Audio.paused) {
    try { gun2Audio.play().catch(()=>{}); } catch {}
  }
  if (_drivingPlaying && drivingAudio && drivingAudio.paused && _drivingTarget > 0.01) {
    try { drivingAudio.play().catch(()=>{}); } catch {}
  }
}

function installUnlockHandlers() {
  const handler = () => unlockAudio();
  // Use capture and once
  ["click", "keydown", "touchstart", "mousedown", "pointerdown"].forEach(evt => {
    try { document.addEventListener(evt, handler, { once: true, capture: true }); } catch { document.addEventListener(evt, handler, true); }
    try { window.addEventListener(evt, handler, { once: true, capture: true }); } catch { window.addEventListener(evt, handler, true); }
  });
}

export function initSounds() {
  if (_initDone) return;
  _initDone = true;
  try {
    cityAudio = createAudio(SOUND_SRC.city, { loop: true, volume: musicVolume });
    if (cityAudio) {
      cityAudio.loop = true;
      try { cityAudio.volume = safeVolume(musicVolume); } catch {}
    }
    menuAudio = createAudio(SOUND_SRC.menu, { loop: true, volume: musicVolume });
    if (menuAudio) {
      menuAudio.loop = true;
      try { menuAudio.volume = safeVolume(musicVolume); } catch {}
    }
    gun2Audio = createAudio(SOUND_SRC.gun2Shot, { loop: true, volume: 0.6 * sfxVolume });
    if (gun2Audio) {
      gun2Audio.loop = true;
      try { gun2Audio.volume = safeVolume(0.6 * sfxVolume); } catch {}
    }
    drivingAudio = createAudio(SOUND_SRC.driving, { loop: true, volume: 0 });
    if (drivingAudio) {
      drivingAudio.loop = true;
      try { drivingAudio.volume = 0; } catch {}
      _drivingVol = 0;
      _drivingTarget = 0;
    }
    // Warm cache for other sounds (low volume preload) - include driving & menu alt probe
    [SOUND_SRC.enterCar, SOUND_SRC.gunShot, SOUND_SRC.sniperShot, SOUND_SRC.carExplosion, SOUND_SRC.bombExplosion, SOUND_SRC.driving, SOUND_SRC.menu].forEach(src => {
      try {
        const a = new Audio();
        a.src = src;
        a.preload = "auto";
        a.volume = 0;
        try { a.load(); } catch {}
        a.addEventListener("error", () => {
          const alt = getAltSrc(src);
          if (alt && alt !== src) {
            const b = new Audio();
            b.src = alt;
            b.preload = "auto";
            try { b.load(); } catch {}
          }
        });
      } catch {}
    });

    installUnlockHandlers();

    // Also attempt to unlock via Web Audio if available (for iOS)
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (AC) {
        const ctx = new AC();
        if (ctx.state === "suspended") {
          const resume = () => { ctx.resume().catch(()=>{}); document.removeEventListener("click", resume); window.removeEventListener("touchstart", resume); };
          document.addEventListener("click", resume, { once: true });
          window.addEventListener("touchstart", resume, { once: true });
        }
      }
    } catch {}

    console.log("[sounds] initialized", SOUND_SRC);
  } catch (e) {
    console.warn("[sounds] init failed", e);
  }
}

// ================= City (in_city.mp3) =================
export function playCityMusic() {
  _cityShouldPlay = true;
  if (!cityAudio) initSounds();
  if (!cityAudio) return;
  if (_cityPlaying && !cityAudio.paused) return;
  try {
    cityAudio.volume = safeVolume(musicVolume);
    cityAudio.loop = true;
    const p = cityAudio.play();
    if (p && p.then) {
      p.then(() => { _cityPlaying = true; _unlocked = true; }).catch((err) => {
        // Autoplay blocked - wait for unlock
        _cityPlaying = false;
        // keep shouldPlay true so unlock will retry
        // console.debug("[sounds] city play blocked", err);
      });
    } else {
      _cityPlaying = true;
    }
  } catch (e) {
    _cityPlaying = false;
  }
}

export function pauseCityMusic() {
  _cityShouldPlay = false;
  if (!cityAudio) return;
  try {
    if (!_cityPlaying && cityAudio.paused) return;
    cityAudio.pause();
    _cityPlaying = false;
  } catch {}
}

export function stopCityMusic() {
  _cityShouldPlay = false;
  _cityPlaying = false;
  if (!cityAudio) return;
  try {
    cityAudio.pause();
    cityAudio.currentTime = 0;
  } catch {}
}

export function updateCityMusic(gameState, G) {
  // Call each frame or on state change: only PLAYING plays city
  try {
    if (!G) {
      // fallback: if G not provided, infer numeric constants
      // G.MENU=0, PLAYING=1, PAUSED=2 per config
      G = { MENU: 0, PLAYING: 1, PAUSED: 2 };
    }
    if (gameState === G.PLAYING) {
      if (!_cityPlaying) playCityMusic();
    } else {
      if (_cityPlaying) pauseCityMusic();
    }
  } catch {}
}

// ================= Menu (Asphalt_Coliseum.mp3) =================
// Loops only while in main menu (G.MENU), stops otherwise
export function playMenuMusic() {
  _menuShouldPlay = true;
  if (!menuAudio) initSounds();
  if (!menuAudio) return;
  if (_menuPlaying && !menuAudio.paused) return;
  try {
    menuAudio.volume = safeVolume(musicVolume);
    menuAudio.loop = true;
    const p = menuAudio.play();
    if (p && p.then) {
      p.then(() => { _menuPlaying = true; _unlocked = true; }).catch(() => {
        _menuPlaying = false;
      });
    } else {
      _menuPlaying = true;
    }
  } catch (e) {
    _menuPlaying = false;
  }
}

export function pauseMenuMusic() {
  _menuShouldPlay = false;
  if (!menuAudio) return;
  try {
    if (!_menuPlaying && menuAudio.paused) return;
    menuAudio.pause();
    _menuPlaying = false;
  } catch {}
}

export function stopMenuMusic() {
  _menuShouldPlay = false;
  _menuPlaying = false;
  if (!menuAudio) return;
  try {
    menuAudio.pause();
    menuAudio.currentTime = 0;
  } catch {}
}

export function updateMenuMusic(gameState, G) {
  try {
    if (!G) {
      G = { MENU: 0, PLAYING: 1, PAUSED: 2 };
    }
    if (gameState === G.MENU) {
      if (!_menuPlaying) playMenuMusic();
    } else {
      if (_menuPlaying) pauseMenuMusic();
      // also ensure hard stop when game starts (reset position)
      if (gameState === G.PLAYING && menuAudio && !menuAudio.paused) {
        try { menuAudio.pause(); menuAudio.currentTime = 0; _menuPlaying = false; } catch {}
      }
    }
  } catch {}
}

export function isMenuPlaying() { return _menuPlaying; }

// ================= Driving (driving_car.mp3) =================
// Gradual volume with speed - called every frame from gameLoop/update
export function pauseDrivingSound() {
  _drivingTarget = 0;
}
export function stopDrivingSound() {
  _drivingTarget = 0;
  _drivingVol = 0;
  if (!drivingAudio) return;
  try {
    drivingAudio.pause();
    drivingAudio.currentTime = 0;
    _drivingPlaying = false;
    drivingAudio.volume = 0;
  } catch {}
}
export function updateDrivingSound(opts = {}) {
  // opts: { isInVehicle, speed, maxSpeed, gameState, G }
  try {
    const isInVehicle = !!opts.isInVehicle;
    const speed = typeof opts.speed === "number" ? opts.speed : 0;
    const maxSpeed = typeof opts.maxSpeed === "number" && opts.maxSpeed > 0.1 ? opts.maxSpeed : 5;
    let Gref = opts.G;
    let gameState = opts.gameState;
    if (!Gref) Gref = { MENU: 0, PLAYING: 1, PAUSED: 2 };
    // Only play when actually playing and in vehicle
    const shouldBeActive = isInVehicle && gameState === Gref.PLAYING;
    if (!drivingAudio) {
      // lazy init if not yet
      try { initSounds(); } catch {}
      if (!drivingAudio) return;
    }
    // Ensure unlocked handler will resume if needed
    if (!_unlocked && shouldBeActive && _drivingTarget > 0.01) {
      // will be handled by unlock
    }
    if (!shouldBeActive) {
      _drivingTarget = 0;
    } else {
      const norm = Math.min(1, Math.max(0, speed / maxSpeed));
      // When stopped, target 0; otherwise ramp from 0.12 to 0.82
      if (norm < 0.02) {
        _drivingTarget = 0;
      } else {
        const base = 0.12 + norm * 0.70; // 0.12 at crawl, 0.82 at max
        _drivingTarget = base * sfxVolume;
        // clamp (master applied in safeVolume)
        _drivingTarget = Math.max(0, Math.min(1, _drivingTarget));
      }
      // If we should be audible and not yet playing, start
      if (_drivingTarget > 0.02 && (!_drivingPlaying || drivingAudio.paused)) {
        try {
          drivingAudio.loop = true;
          drivingAudio.volume = safeVolume(_drivingVol);
          const p = drivingAudio.play();
          if (p && p.then) p.then(() => { _drivingPlaying = true; _unlocked = true; }).catch(()=>{ _drivingPlaying = false; });
          else _drivingPlaying = true;
        } catch { _drivingPlaying = false; }
      }
    }
    // Smooth interpolation - faster when decreasing to feel responsive, slower when increasing for gradual
    const isDecreasing = _drivingTarget < _drivingVol;
    const factor = isDecreasing ? 0.14 : 0.06;
    _drivingVol += (_drivingTarget - _drivingVol) * factor;
    if (Math.abs(_drivingTarget - _drivingVol) < 0.006) _drivingVol = _drivingTarget;
    _drivingVol = Math.max(0, Math.min(1, _drivingVol));
    try { drivingAudio.volume = safeVolume(_drivingVol); } catch {}
    // Pause when silent to save resources
    if (_drivingVol < 0.01 && _drivingTarget === 0 && _drivingPlaying) {
      try {
        drivingAudio.pause();
        drivingAudio.currentTime = 0;
        _drivingPlaying = false;
      } catch {}
    }
  } catch {}
}
export function isDrivingPlaying() { return _drivingPlaying; }

// Expose for debugging and for state listeners
export function isCityPlaying() { return _cityPlaying; }

// ================= SFX =================
export function playEnterCar() {
  if (!_shouldPlayDebounced("enterCar_enter", 800)) return;
  playOneShot(SOUND_SRC.enterCar, 0.9);
}
export function playExitCar() {
  if (!_shouldPlayDebounced("enterCar_exit", 800)) return;
  playOneShot(SOUND_SRC.enterCar, 0.9);
}

export function playPistolShot() {
  if (!_shouldPlayDebounced("pistol", 280)) return;
  playOneShot(SOUND_SRC.gunShot, 0.72);
}

export function playShotgunShot() {
  if (!_shouldPlayDebounced("shotgun", 400)) return;
  // Shotgun uses same pistol file but louder
  playOneShot(SOUND_SRC.gunShot, 0.88);
}

export function playSniperShot() {
  if (!_shouldPlayDebounced("sniper", 140)) return;
  playOneShot(SOUND_SRC.sniperShot, 0.95);
}

export function playCarExplosion() {
  if (!_shouldPlayDebounced("carExplosion", 60)) return;
  playOneShot(SOUND_SRC.carExplosion, 1.0);
}

export function playBombExplosion() {
  if (!_shouldPlayDebounced("bombExplosion", 60)) return;
  playOneShot(SOUND_SRC.bombExplosion, 1.0);
}

export function playPunch() {
  if (!_shouldPlayDebounced("punch", 100)) return;
  playOneShot(SOUND_SRC.punch, 0.8);
}

// Machine gun looping
export function startMachineGunLoop() {
  if (!gun2Audio) initSounds();
  if (!gun2Audio) {
    // fallback to one-shot if loop audio not ready
    playOneShot(SOUND_SRC.gun2Shot, 0.65);
    return;
  }
  if (_gun2Playing && !gun2Audio.paused) return;
  _gun2Playing = true;
  try {
    gun2Audio.volume = safeVolume(0.62 * sfxVolume);
    gun2Audio.loop = true;
    // Ensure from start if previously stopped
    if (gun2Audio.currentTime > 0 && gun2Audio.paused) {
      // resume from where left? For loop, restart for consistency
      gun2Audio.currentTime = 0;
    }
    const p = gun2Audio.play();
    if (p && p.catch) p.catch(() => { _gun2Playing = false; });
  } catch { _gun2Playing = false; }
}

export function stopMachineGunLoop() {
  _gun2Playing = false;
  if (!gun2Audio) return;
  try {
    if (!gun2Audio.paused) {
      gun2Audio.pause();
      gun2Audio.currentTime = 0;
    }
  } catch {}
}

export function isMachineGunLooping() { return _gun2Playing && gun2Audio && !gun2Audio.paused; }

// Generic weapon dispatcher
export function playWeaponShot(weaponName) {
  const w = (weaponName || "").toLowerCase();
  if (w === "smg") {
    startMachineGunLoop();
    return "smg_loop";
  } else if (w === "rifle") {
    // rifle is sniper per spec
    playSniperShot();
    return "sniper";
  } else if (w === "shotgun") {
    playShotgunShot();
    return "shotgun";
  } else if (w === "pistol") {
    playPistolShot();
    return "pistol";
  } else {
    // unknown fallback to pistol
    playPistolShot();
    return "pistol";
  }
}

// Handle SMG trigger release helper - to be called from update loop
export function handleMachineGunTrigger(isHeld, currentWeaponName) {
  const isSMG = (currentWeaponName || "").toLowerCase() === "smg";
  if (isSMG && isHeld) {
    startMachineGunLoop();
  } else {
    if (_gun2Playing) stopMachineGunLoop();
  }
}

// Immediate stop of machine gun loop on mouse/touch release (spec: stops when trigger lifted)
if (typeof window !== "undefined") {
  const _stopOnRelease = (e) => {
    // Left mouse button release or touch end
    if (e.type === "mouseup" && e.button !== 0) return;
    try { if (_gun2Playing) stopMachineGunLoop(); } catch {}
  };
  try { window.addEventListener("mouseup", _stopOnRelease, true); } catch {}
  try { document.addEventListener("mouseup", _stopOnRelease, true); } catch {}
  try { window.addEventListener("touchend", _stopOnRelease, true); } catch {}
  try { document.addEventListener("touchend", _stopOnRelease, true); } catch {}
  try { window.addEventListener("blur", () => { try { stopMachineGunLoop(); } catch {}; try { if (drivingAudio && !drivingAudio.paused) drivingAudio.pause(); } catch {} }, true); } catch {}
}

// Ensure city pauses when page hidden - also driving & menu
if (typeof document !== "undefined") {
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (cityAudio && !_cityPlaying) {
        // still handle driving pause even if city not playing
      }
      if (cityAudio && !cityAudio.paused) {
        cityAudio.pause();
        // don't clear _cityShouldPlay so it resumes on visible if still playing state
      }
      if (menuAudio && !menuAudio.paused) {
        menuAudio.pause();
      }
      if (gun2Audio && !gun2Audio.paused) {
        gun2Audio.pause();
      }
      if (drivingAudio && !drivingAudio.paused) {
        drivingAudio.pause();
      }
    } else {
      if (_cityShouldPlay && cityAudio && cityAudio.paused) {
        const p = cityAudio.play();
        if (p && p.catch) p.catch(()=>{});
      }
      if (_menuShouldPlay && menuAudio && menuAudio.paused) {
        const p = menuAudio.play();
        if (p && p.catch) p.catch(()=>{});
      }
      if (_gun2Playing && gun2Audio && gun2Audio.paused) {
        const p = gun2Audio.play();
        if (p && p.catch) p.catch(()=>{});
      }
      if (_drivingPlaying && drivingAudio && drivingAudio.paused && _drivingTarget > 0.01) {
        const p = drivingAudio.play();
        if (p && p.catch) p.catch(()=>{});
      }
    }
  });
}

// Auto-init if DOM ready (non-blocking)
if (typeof window !== "undefined") {
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", () => { try { initSounds(); } catch {} });
  } else {
    try { initSounds(); } catch {}
  }
  // Expose for debugging
  window.SG_Sounds = {
    initSounds, playCityMusic, pauseCityMusic, stopCityMusic, updateCityMusic,
    playMenuMusic, pauseMenuMusic, stopMenuMusic, updateMenuMusic, isMenuPlaying,
    playEnterCar, playExitCar, playPistolShot, playSniperShot, playCarExplosion, playBombExplosion,
    playPunch,
    startMachineGunLoop, stopMachineGunLoop, playWeaponShot,
    updateDrivingSound, pauseDrivingSound, stopDrivingSound
  };
}
