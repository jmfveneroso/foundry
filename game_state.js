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
  isMoldEditorActive: false,
  backgroundPattern: null,
  waterShapes: new Map(),
  deltaTime: 0,
  lastFrameTime: 0,
  timeSinceLastUpdate: 0,
  currentLevelIndex: 0,
  isLevelComplete: false,
  isGameWon: false,
  highlightedWinShape: null,
  isLevelLost: false,
  hammerUsesLeft: 0,
  spoutResources: [],
  spoutFlowStates: [],
  longPressTimer: null, // Holds the timer for detecting a long press
  potentialDragTarget: null, // Temporarily holds the spout being pressed

  // For the new abstract spout system
  spoutResources: [],
  spoutFlowStates: [],

  // For the new sandbox creator UI
  sandboxSpouts: [],
  isPlacingSpout: false,
  pendingSpout: null,
  mouseGridPos: { x: 0, y: 0 },
};
