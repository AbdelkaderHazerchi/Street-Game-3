// ======================== PRELOAD ASSETS ========================
// Extracted from game.js:390-423 - no logic changed
import { TILE_ASSETS, SAND_IMG, PAVEMENT_IMG, SHOP_BUILDING_1_IMG, POLICE_STATION_IMG, HOSPITAL_IMG, BANK_IMG, CAR_DEALERSHIP_IMG, CLINIC_IMG, GUN_SHOP_IMG, CASINO_IMG } from "./tileAssets.js?v=57";
import { VEHICLE_ASSETS, EXPLOSION_ASSET } from "./vehicleAssets.js?v=57";

import { allBuildingAssets } from "./buildingAssets.js?v=57";

function loadImgWithTimeout(asset, timeoutMs=3000){
  return new Promise((resolve)=>{
    let done=false;
    const finish=()=>{ if(done) return; done=true; resolve(); };
    const timer=setTimeout(finish, timeoutMs);
    asset.img = new Image();
    asset.img.onload = ()=>{ clearTimeout(timer); finish(); };
    asset.img.onerror = ()=>{ clearTimeout(timer); console.warn('[preload] failed', asset.src); finish(); };
    asset.img.src = asset.src;
  });
}
export function preloadAssets() {
  return Promise.all([
    ...Object.values(TILE_ASSETS).map(a=> loadImgWithTimeout(a)),
    loadImgWithTimeout(SAND_IMG),
    loadImgWithTimeout(PAVEMENT_IMG),
    loadImgWithTimeout(SHOP_BUILDING_1_IMG),
    loadImgWithTimeout(POLICE_STATION_IMG),
    loadImgWithTimeout(HOSPITAL_IMG),
    loadImgWithTimeout(BANK_IMG),
    loadImgWithTimeout(CAR_DEALERSHIP_IMG),
    loadImgWithTimeout(CLINIC_IMG),
    loadImgWithTimeout(GUN_SHOP_IMG),
    loadImgWithTimeout(CASINO_IMG),
    ...VEHICLE_ASSETS.map(a=> loadImgWithTimeout(a)),
    ...allBuildingAssets().map(a=> loadImgWithTimeout(a)),
    loadImgWithTimeout(EXPLOSION_ASSET),
  ]);
}
