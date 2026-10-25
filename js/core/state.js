// ======================== CORE STATE ========================
// Extracted from game.js:54582-54585 - no logic changed
// Mutable global game state - centralized to avoid circular imports
import { G } from "./config.js?v=57";

export let gameState = G.MENU;
export let gameOver = false;
export let currentSaveName = "";

// Helper setters to preserve live binding semantics when reassigned from other modules
export function setGameState(v) { gameState = v; }
export function setGameOver(v) { gameOver = v; }
export function setCurrentSaveName(v) { currentSaveName = v; }

// Re-export G for convenience
export { G };
