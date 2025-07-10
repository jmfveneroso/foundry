import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { createEmptyGrid, drawGrid, updateGrid } from "./grid.js";
import {
  clearCanvas,
  canvas,
  ctx,
  addUiEvents,
  generateLevelSelector,
} from "./ui.js";
import { addPlayerEvents } from "./player.js";
import {
  enforceCommunicatingVessels,
  drawWaterShapeDebug,
  updateWaterShapes,
} from "./sand.js";
import { loadLevelsFromFile } from "./level_parser.js";
import { RigidBody } from "./rigid_body.js";

// Get a reference to the counter and button elements
const particleCounterElement = document.getElementById("rigidParticleCounter");
const sandCounterElement = document.getElementById("sandCounter");
const levelCompleteScreen = document.getElementById("level-complete-screen");
const levelIndicatorElement = document.getElementById("levelIndicator");
const nextLevelButton = document.getElementById("nextLevelButton");
const targetShapeCanvas = document.getElementById("targetShapeCanvas");
const targetShapeCtx = targetShapeCanvas.getContext("2d");
const targetShapeDisplay = document.getElementById("target-shape-display");
const levelDisplay = document.getElementById("level-display");
const metalCounterDisplay = document.getElementById("metal-counter-display");

function drawTargetShape(shape) {
  if (!shape || shape.length === 0) {
    targetShapeDisplay.classList.add("hidden");
    return;
  }
  targetShapeDisplay.classList.remove("hidden");

  const cellSize = 8; // Use a small, fixed cell size for the preview
  const xs = shape.map((p) => p.x);
  const ys = shape.map((p) => p.y);
  const width = xs.length > 0 ? Math.max(...xs) + 1 : 0;
  const height = ys.length > 0 ? Math.max(...ys) + 1 : 0;

  targetShapeCanvas.width = width * cellSize;
  targetShapeCanvas.height = height * cellSize;

  // Use the sand color for the preview to indicate what to create
  targetShapeCtx.fillStyle = Config.colors[Config.SAND];

  for (const point of shape) {
    targetShapeCtx.fillRect(
      point.x * cellSize,
      point.y * cellSize,
      cellSize,
      cellSize
    );
  }

  // Draw a grid over the shape
  targetShapeCtx.strokeStyle = "rgba(0, 0, 0, 0.4)";
  targetShapeCtx.lineWidth = 1;

  // Draw vertical grid lines
  for (let x = 0; x <= width; x++) {
    targetShapeCtx.beginPath();
    targetShapeCtx.moveTo(x * cellSize, 0);
    targetShapeCtx.lineTo(x * cellSize, height * cellSize);
    targetShapeCtx.stroke();
  }

  // Draw horizontal grid lines
  for (let y = 0; y <= height; y++) {
    targetShapeCtx.beginPath();
    targetShapeCtx.moveTo(0, y * cellSize);
    targetShapeCtx.lineTo(width * cellSize, y * cellSize);
    targetShapeCtx.stroke();
  }
}

function loadSandbox() {
  levelCompleteScreen.classList.add("hidden");

  // Reset the game state for a clean sandbox environment
  GameState.grid = createEmptyGrid();
  GameState.stoneBlocks = [];
  GameState.sandParticlesUsed = 0;
  GameState.isLevelComplete = false;
  GameState.highlightedWinShape = null;
  GameState.isGameWon = false;
  GameState.isLevelLost = false;
  if (GameState.activeHammer) GameState.activeHammer.removeFromGrid();
  GameState.activeHammer = null;

  drawTargetShape(null);

  stoneButton.classList.remove("hidden");
}

function loadLevel(levelIndex) {
  levelCompleteScreen.classList.add("hidden");

  // Check for win condition
  const levelData = GameState.gameLevels[levelIndex];
  if (!levelData || levelData.level === "WIN") {
    GameState.isGameWon = true;
    GameState.isLevelComplete = false;
    return;
  }

  if (levelData.level === "ERROR") {
    // Handle the case where levels failed to load
    // (You can add a message on the canvas here)
    return;
  }

  stoneButton.classList.add("hidden");

  GameState.currentLevelIndex = levelIndex;

  // Reset state for the new level
  GameState.grid = createEmptyGrid();
  GameState.stoneBlocks = [];
  GameState.sandParticlesUsed = 0;
  GameState.isLevelComplete = false;
  GameState.highlightedWinShape = null;
  GameState.isGameWon = false;
  GameState.isLevelLost = false;
  if (GameState.activeHammer) GameState.activeHammer.removeFromGrid();
  GameState.activeHammer = null;

  // Create and drop the starting molds for the level
  levelData.startingMolds.forEach((mold) => {
    const newBlock = new RigidBody(mold.x, mold.y, mold.shape);
    GameState.stoneBlocks.push(newBlock);
    newBlock.placeInGrid();
  });

  drawTargetShape(levelData.targetShape);
}

function updateCounters() {
  // Adjust UI based on the current mode
  if (Config.sandboxMode) {
    levelDisplay.style.display = "none"; // Hide level info in sandbox mode
    metalCounterDisplay.classList.remove("counter-empty");
    sandCounterElement.textContent = `Metal Used: ${GameState.sandParticlesUsed}`;
    return;
  }

  // Ensure elements are visible when not in sandbox mode
  levelDisplay.style.display = "block";

  const currentLevel = GameState.gameLevels[GameState.currentLevelIndex];
  if (!currentLevel || GameState.isGameWon) return;

  levelIndicatorElement.textContent = `Level: ${currentLevel.level}`;
  sandCounterElement.textContent = `Metal: ${GameState.sandParticlesUsed} / ${currentLevel.maxSand}`;

  // Add or remove the 'counter-empty' class from the container
  if (GameState.sandParticlesUsed >= currentLevel.maxSand) {
    metalCounterDisplay.classList.add("counter-empty");
  } else {
    metalCounterDisplay.classList.remove("counter-empty");
  }

  let rigidParticleCount = 0;
  for (const block of GameState.stoneBlocks) {
    rigidParticleCount += block.shape.length;
  }
  // particleCounterElement.textContent = `Solid Particles: ${rigidParticleCount}`;
}

function update() {
  // Check for level complete FIRST, to show the screen
  if (GameState.isLevelComplete) {
    levelCompleteScreen.classList.remove("hidden");
    return; // Pause the simulation
  }

  // Check for sand on the grid to set the Solidify button state
  let isSandOnGrid = false;
  for (let y = 0; y < Config.GRID_HEIGHT; y++) {
    for (let x = 0; x < Config.GRID_WIDTH; x++) {
      if (GameState.grid[y][x] === Config.SAND) {
        isSandOnGrid = true;
        break;
      }
    }
    if (isSandOnGrid) break;
  }

  // Toggle button styles based on whether sand is present
  if (isSandOnGrid) {
    solidifyButton.classList.add("highlight-btn");
    solidifyButton.classList.remove("btn-disabled");
  } else {
    solidifyButton.classList.remove("highlight-btn");
    solidifyButton.classList.add("btn-disabled");
  }

  if (!Config.sandboxMode) {
    if (
      GameState.isLevelComplete ||
      GameState.isGameWon ||
      GameState.isLevelLost
    ) {
      // Pause simulation when level is won or game is over
      return;
    }

    // Check for loss condition
    const currentLevel = GameState.gameLevels[GameState.currentLevelIndex];
    if (GameState.sandParticlesUsed >= currentLevel.maxSand) {
      let sandOnGrid = false;
      // Scan the grid to see if any molten metal remains
      for (let y = 0; y < Config.GRID_HEIGHT; y++) {
        for (let x = 0; x < Config.GRID_WIDTH; x++) {
          if (GameState.grid[y][x] === Config.SAND) {
            sandOnGrid = true;
            break; // Found sand, so the game is not lost yet
          }
        }
        if (sandOnGrid) break;
      }

      // If all metal is used and none is left on screen, the player loses
      if (!sandOnGrid) {
        GameState.isLevelLost = true;
      }
    }
  }

  GameState.prevGrid = GameState.grid.map((row) => [...row]);

  for (let i = GameState.stoneBlocks.length - 1; i >= 0; i--) {
    const block = GameState.stoneBlocks[i];
    if (block === GameState.draggedStone) {
      continue;
    }
    block.moveDown();
  }

  updateGrid();

  if (Config.waterMode) {
    updateWaterShapes();
    enforceCommunicatingVessels();
  }
}

function draw() {
  clearCanvas();
  drawGrid();

  // Draw stone blocks and highlight the winning one if applicable
  for (const block of GameState.stoneBlocks) {
    block.draw(ctx, GameState.highlightedWinShape === block);
  }

  if (Config.waterMode && Config.debugWaterShapes) {
    drawWaterShapeDebug(ctx);
  }

  // Update UI text counters
  updateCounters();

  // Display the "You Win!" message when the game is won
  if (GameState.isGameWon) {
    ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("YOU WIN!", canvas.width / 2, canvas.height / 2);
  }

  // Display the "You Lose" message
  if (GameState.isLevelLost) {
    ctx.fillStyle = "rgba(120, 0, 0, 0.7)"; // Dark red overlay
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = "white";
    ctx.font = "48px sans-serif";
    ctx.textAlign = "center";
    ctx.fillText("YOU LOSE", canvas.width / 2, canvas.height / 2);
  }
}

function gameLoop(currentTime = 0) {
  GameState.deltaTime = currentTime - GameState.lastFrameTime;
  GameState.lastFrameTime = currentTime;
  GameState.timeSinceLastUpdate += GameState.deltaTime;

  if (GameState.timeSinceLastUpdate > 1000 / Config.simulationUpdateInterval) {
    update();
    GameState.timeSinceLastUpdate = 0;
  }

  draw();
  requestAnimationFrame(gameLoop);
}

async function init() {
  // Make init async to await the level loading
  GameState.gameLevels = await loadLevelsFromFile();

  if (!GameState.gameLevels || GameState.gameLevels[0].level === "ERROR") {
    console.error("Game cannot start: No levels were loaded.");
    return;
  }

  addPlayerEvents();
  addUiEvents();
  generateLevelSelector(GameState.gameLevels);

  // Listen for the custom event fired by the level selector buttons
  window.addEventListener("levelSelected", (event) => {
    const { levelIndex } = event.detail;
    if (levelIndex !== undefined) {
      loadLevel(levelIndex);
    }
  });

  // Wire up level progression buttons
  document.getElementById("resetButton").addEventListener("click", () => {
    loadLevel(GameState.currentLevelIndex);
  });
  nextLevelButton.addEventListener("click", () => {
    loadLevel(GameState.currentLevelIndex + 1);
  });

  // Listen for the sandbox toggle event to switch modes
  window.addEventListener("sandboxModeToggled", () => {
    if (Config.sandboxMode) {
      loadSandbox();
    } else {
      // When turning sandbox off, return to the first level
      loadLevel(0);
    }
  });

  loadLevel(0); // Start the first level
  gameLoop();
}

init();
