import { Config } from "./config.js";
import { canvas, canvasWidth, canvasHeight } from "./ui.js";

export const GameState = {
  grid: null,
  prevGrid: null,
  activeHammer: null,
  stoneBlocks: [],
  draggedStone: null,
  isDrawing: false,
  backgroundPattern: null,
  waterShapes: new Map(),
  deltaTime: 0,
  lastFrameTime: 0,
  timeSinceLastUpdate: 0,
};
