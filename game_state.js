import { Config } from "./config.js";
import { canvas, canvasWidth, canvasHeight } from "./ui.js";

export const GameState = {
  grid: null,
  prevGrid: null,
  dragOffsetX: 0,
  dragOffsetY: 0,
  stoneBlocks: [],
  gameLevels: [],
  draggedStone: null,
  isDrawing: false,
  backgroundPattern: null,
  waterShapes: new Map(),
  deltaTime: 0,
  lastFrameTime: 0,
  timeSinceLastUpdate: 0,
  currentLevelIndex: 0,
  sandParticlesUsed: 0,
  isLevelComplete: false,
  isGameWon: false,
  highlightedWinShape: null,
  isLevelLost: false,
};
