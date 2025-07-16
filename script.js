import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { getShapeHash } from "./utils.js";
import {
  createEmptyGrid,
  drawGrid,
  updateGrid,
  drawSpouts,
  drawSpoutUI,
  isInBounds,
} from "./grid.js";
import {
  clearCanvas,
  canvas,
  ctx,
  addUiEvents,
  generateLevelSelector,
} from "./ui.js";
import { getGridPos, addPlayerEvents } from "./player.js";
import {
  enforceCommunicatingVessels,
  drawWaterShapeDebug,
  updateWaterShapes,
  addSand,
  addSandFromSpout,
} from "./sand.js";
import { loadLevelsFromFile } from "./level_parser.js";
import { RigidBody } from "./rigid_body.js";

// Get a reference to the counter and button elements
const particleCounterElement = document.getElementById("rigidParticleCounter");
const ironCounterElement = document.getElementById("ironCounter");
const brassCounterElement = document.getElementById("brassCounter");
const levelCompleteScreen = document.getElementById("level-complete-screen");
const levelIndicatorElement = document.getElementById("levelIndicator");
const nextLevelButton = document.getElementById("nextLevelButton");
const targetShapeCanvas = document.getElementById("targetShapeCanvas");
const targetShapeCtx = targetShapeCanvas.getContext("2d");
const targetShapeDisplay = document.getElementById("target-shape-display");
const levelDisplay = document.getElementById("level-display");
const metalCounterDisplay = document.getElementById("metal-counter-display");
const hammerButton = document.getElementById("hammerButton");
const hammerCounterElement = document.getElementById("hammerCounter");

// Add new UI element references
const defineTargetButton = document.getElementById("defineTargetButton");
const editMoldButton = document.getElementById("editMoldButton");
const addSpoutButton = document.getElementById("addSpoutButton");
const spoutCreatorModal = document.getElementById("spout-creator-modal");
const closeModalBtn = document.getElementById("close-modal-btn");

/**
 * Spawns and updates the small visual drip particles from spouts.
 */
function updateDrips() {
  // Determine the correct list of spouts to use based on the game mode
  const currentLevel = GameState.gameLevels[GameState.currentLevelIndex];
  const spouts = Config.sandboxMode
    ? GameState.sandboxSpouts
    : currentLevel?.spouts || [];

  // 1. Spawn new particles for each spout that has resources
  spouts.forEach((spout, index) => {
    // Check the main resource tracker for this spout
    const resourcesLeft = GameState.spoutResources[index];
    if (resourcesLeft > 0) {
      // A 5% chance to spawn a drip each frame
      if (Math.random() < 0.05) {
        GameState.dripParticles.push({
          x: (spout.pos.x + 0.5) * Config.cellSize,
          y: (spout.pos.y + 1) * Config.cellSize,
          vy: 2.0,
          life: 100,
          initialLife: 100,
          material: spout.material, // Pass material for correct coloring
        });
      }
    }
  });

  // 2. Update and remove old particles, now with collision
  for (let i = GameState.dripParticles.length - 1; i >= 0; i--) {
    const p = GameState.dripParticles[i];
    p.life--;

    if (p.life <= 0) {
      GameState.dripParticles.splice(i, 1);
      continue;
    }

    p.vy += 0.1;
    p.y += p.vy;

    // --- NEW: Collision Check ---
    const gridX = Math.floor(p.x / Config.cellSize);
    const gridY = Math.floor(p.y / Config.cellSize);

    // If particle goes off-screen or hits a non-empty grid cell, remove it
    if (
      !isInBounds(gridX, gridY) ||
      GameState.grid[gridY][gridX] !== Config.EMPTY
    ) {
      GameState.dripParticles.splice(i, 1);
    }
  }
}

/**
 * Draws the visual drip particles with a shimmering molten effect.
 */
function drawDrips(ctx) {
  for (const p of GameState.dripParticles) {
    // The opacity fades as the particle's life runs out
    const opacity = p.life / p.initialLife;
    const size = 5; // The size of the square particle

    // Determine the color palette based on the particle's material
    const colors =
      p.material === "brass"
        ? Config.brassMoltenColors
        : Config.ironMoltenColors;

    // Pick a random color from the palette for a shimmering effect
    const color = colors[Math.floor(Math.random() * colors.length)];

    // Set fill style and fade out the particle
    ctx.globalAlpha = opacity * 0.9;
    ctx.fillStyle = color;

    // Draw a square centered on the particle's position
    ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);

    // Reset global alpha so it doesn't affect other drawings
    ctx.globalAlpha = 1.0;
  }
}

function finalizeDrawnMolds() {
  const visited = new Array(Config.GRID_HEIGHT)
    .fill(0)
    .map(() => new Array(Config.GRID_WIDTH).fill(false));
  const directions = [
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
  ];

  for (let y = 0; y < Config.GRID_HEIGHT; y++) {
    for (let x = 0; x < Config.GRID_WIDTH; x++) {
      if (GameState.grid[y][x] === Config.PREVIEW_MOLD && !visited[y][x]) {
        // Found a new, unvisited blueprint piece. Find all connected pieces.
        const foundParticles = [];
        const queue = [{ x, y }];
        visited[y][x] = true;
        let minX = x,
          minY = y;

        while (queue.length > 0) {
          const current = queue.shift();
          foundParticles.push(current);
          minX = Math.min(minX, current.x);
          minY = Math.min(minY, current.y);

          for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            if (
              isInBounds(nx, ny) &&
              !visited[ny][nx] &&
              GameState.grid[ny][nx] === Config.PREVIEW_MOLD
            ) {
              visited[ny][nx] = true;
              queue.push({ x: nx, y: ny });
            }
          }
        }

        // Erase the blueprint tiles from the grid
        for (const p of foundParticles) {
          GameState.grid[p.y][p.x] = Config.EMPTY;
        }

        // Create the new static mold from the shape
        const shape = foundParticles.map((p) => ({
          x: p.x - minX,
          y: p.y - minY,
        }));
        const newBlock = new RigidBody(minX, minY, shape, "iron", true); // Create as static iron
        GameState.stoneBlocks.push(newBlock);
        newBlock.placeInGrid();
      }
    }
  }
}

function finalizeTargetShape() {
  const currentLevel = GameState.gameLevels[GameState.currentLevelIndex];
  if (!currentLevel) return;

  const foundPoints = [];
  // 1. Scan the grid for all target preview tiles
  for (let y = 0; y < Config.GRID_HEIGHT; y++) {
    for (let x = 0; x < Config.GRID_WIDTH; x++) {
      if (GameState.grid[y][x] === Config.TARGET_PREVIEW) {
        foundPoints.push({ x, y });
        // 2. Clear the tile from the grid as we find it
        GameState.grid[y][x] = Config.EMPTY;
      }
    }
  }

  if (foundPoints.length === 0) {
    // If nothing was drawn, clear the existing target
    currentLevel.targetShape = [];
    currentLevel.targetShapeHash = "";
  } else {
    // 3. Normalize the points to create the new shape data
    const minX = Math.min(...foundPoints.map((p) => p.x));
    const minY = Math.min(...foundPoints.map((p) => p.y));
    const newShape = foundPoints.map((p) => ({ x: p.x - minX, y: p.y - minY }));

    // 4. Update the current level's target data
    // For now, it defaults to 'iron'. A UI could be added to select this.
    currentLevel.targetShape = newShape;
    currentLevel.targetMaterialType = "iron";
    currentLevel.targetShapeHash = getShapeHash(newShape);
  }

  // 5. Update the target preview display with the new shape
  drawTargetShape(currentLevel.targetShape, currentLevel.targetMaterialType);
}

function drawTargetShape(shape, materialType) {
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
  if (materialType === "brass") {
    targetShapeCtx.fillStyle = Config.colors[Config.BRASS_SOLID];
  } else {
    targetShapeCtx.fillStyle = Config.colors[Config.STONE]; // Default to iron
  }

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
  GameState.ironParticlesUsed = 0;
  GameState.brassParticlesUsed = 0;
  GameState.isLevelComplete = false;
  GameState.highlightedWinShape = null;
  GameState.isGameWon = false;
  GameState.isLevelLost = false;
  GameState.hammerUsesLeft = Infinity;
  GameState.spoutResources = [];
  GameState.spoutFlowStates = [];
  GameState.sandboxSpouts = [];

  drawTargetShape(null);

  stoneButton.classList.remove("hidden");
  editMoldButton.classList.remove("hidden");
  addSpoutButton.classList.remove("hidden");
  defineTargetButton.classList.remove("hidden");
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
  editMoldButton.classList.add("hidden");
  addSpoutButton.classList.add("hidden");
  spoutCreatorModal.classList.add("hidden");
  defineTargetButton.classList.add("hidden");

  GameState.currentLevelIndex = levelIndex;

  // Reset state for the new level
  GameState.grid = createEmptyGrid();
  GameState.stoneBlocks = [];
  GameState.spoutStates = [];
  GameState.ironParticlesUsed = 0;
  GameState.brassParticlesUsed = 0;
  GameState.isLevelComplete = false;
  GameState.highlightedWinShape = null;
  GameState.isGameWon = false;
  GameState.isLevelLost = false;
  GameState.hammerUsesLeft = levelData.maxHammers || 0; // Initialize hammer uses
  if (GameState.activeHammer) GameState.activeHammer.removeFromGrid();
  GameState.activeHammer = null;

  // Initialize the new spout state arrays based on level data
  GameState.spoutResources = levelData.spouts.map((spout) => spout.max);
  GameState.spoutFlowStates = levelData.spouts.map(() => ({
    isFlowing: false,
    toPour: 0,
  }));

  // Create and drop the starting molds for the level
  levelData.startingMolds.forEach((mold) => {
    const newBlock = new RigidBody(
      mold.x,
      mold.y,
      mold.shape,
      mold.materialType,
      mold.isStatic
    );
    GameState.stoneBlocks.push(newBlock);
    newBlock.placeInGrid();
  });

  drawTargetShape(levelData.targetShape, levelData.targetMaterialType);
}

function updateCounters() {
  // Adjust UI based on the current mode
  if (Config.sandboxMode) {
    levelDisplay.style.display = "none";
    hammerCounterElement.textContent = "-"; // Show infinity symbol
    hammerButton.classList.remove("disabled"); // Ensure button is always enabled
    return;
  }

  // Ensure elements are visible when not in sandbox mode
  levelDisplay.style.display = "block";

  const currentLevel = GameState.gameLevels[GameState.currentLevelIndex];
  if (!currentLevel || GameState.isGameWon) return;

  levelIndicatorElement.textContent = `Level: ${currentLevel.level}`;

  // Update Hammer Counter
  const hammersLeft = GameState.hammerUsesLeft;
  hammerCounterElement.textContent = hammersLeft;
  hammerButton.classList.toggle("disabled", hammersLeft <= 0);

  // If hammer is active but runs out, deactivate it
  if (GameState.isHammerActive && hammersLeft <= 0) {
    GameState.isHammerActive = false;
    canvas.classList.remove("hammer-cursor");
    hammerButton.classList.remove("active");
  }
}

function update() {
  // Check for level complete FIRST, to show the screen
  if (GameState.isLevelComplete) {
    levelCompleteScreen.classList.remove("hidden");
    return; // Pause the simulation
  }

  // Check for sand on the grid to set the Solidify button state
  let sandOnGrid = false;
  // Scan the grid to see if any molten metal remains
  for (let y = 0; y < Config.GRID_HEIGHT; y++) {
    for (let x = 0; x < Config.GRID_WIDTH; x++) {
      const cell = GameState.grid[y][x];
      if (cell === Config.IRON_MOLTEN || cell === Config.BRASS_MOLTEN) {
        sandOnGrid = true;
        break; // Found sand, so the game is not lost yet
      }
    }
    if (sandOnGrid) break;
  }

  // Toggle button styles based on whether sand is present
  if (sandOnGrid) {
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
    const allResourcesUsed = GameState.spoutResources.every((res) => res <= 0);
    if (allResourcesUsed) {
      // If all metal is used and none is left on screen, the player loses
      if (!sandOnGrid && GameState.hammerUsesLeft <= 0) {
        GameState.isLevelLost = true;
      }
    }
  }

  GameState.prevGrid = GameState.grid.map((row) => [...row]);

  for (let i = GameState.stoneBlocks.length - 1; i >= 0; i--) {
    const block = GameState.stoneBlocks[i];
    if (block === GameState.draggedStone || block.isStatic || block.isSpout) {
      continue;
    }
    block.moveDown();
  }

  const blocksOnScreen = [];
  for (const block of GameState.stoneBlocks) {
    // A block is considered off-screen if its top edge is past the bottom of the grid.
    if (block.y < Config.GRID_HEIGHT) {
      blocksOnScreen.push(block);
    }
  }
  GameState.stoneBlocks = blocksOnScreen;

  updateGrid();
  updateDrips();

  if (Config.waterMode) {
    updateWaterShapes();
    enforceCommunicatingVessels();
  }

  // --- Handle Spout Flow ---
  if (GameState.spoutFlowStates.length > 0) {
    GameState.spoutFlowStates.forEach((state, index) => {
      if (state.isFlowing && state.toPour > 0) {
        addSand(index);
        state.toPour--;
        if (state.toPour <= 0) state.isFlowing = false;
      }
    });
  }
}

function draw() {
  clearCanvas();
  drawSpouts(ctx);
  drawGrid();

  // Draw stone blocks and highlight the winning one if applicable
  for (const block of GameState.stoneBlocks) {
    block.draw(ctx, GameState.highlightedWinShape === block);
  }

  drawDrips(ctx);

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

  // Draw spout placement preview
  if (GameState.isPlacingSpout && GameState.pendingSpout) {
    const pos = GameState.mouseGridPos;
    if (pos) {
      const previewSpout = {
        ...GameState.pendingSpout,
        pos: { x: pos.gridX, y: pos.gridY },
      };
      drawSpoutUI(ctx, previewSpout, { isFlowing: true }, previewSpout.max, []);
    }
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
  // --- Add Listeners for Spout Creator ---
  const createSpoutButton = document.getElementById("createSpoutButton");
  const spoutMat = document.getElementById("spoutMat");
  const spoutFlow = document.getElementById("spoutFlow");
  const spoutMax = document.getElementById("spoutMax");

  addSpoutButton.addEventListener("click", () => {
    spoutCreatorModal.classList.remove("hidden");
  });

  closeModalBtn.addEventListener("click", () => {
    spoutCreatorModal.classList.add("hidden");
  });

  createSpoutButton.addEventListener("click", () => {
    GameState.pendingSpout = {
      material: spoutMat.value,
      flow: parseInt(spoutFlow.value, 10) || 1,
      max: parseInt(spoutMax.value, 10) || 10,
      pos: { x: 0, y: 0 },
    };
    GameState.isPlacingSpout = true;
    canvas.classList.add("hammer-cursor");
    spoutCreatorModal.classList.add("hidden"); // Hide the modal to allow placement
  });

  canvas.addEventListener("mousemove", (e) => {
    GameState.mouseGridPos = getGridPos(e);
  });

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
    if (Config.sandboxMode) {
      loadSandbox();
    } else {
      loadLevel(GameState.currentLevelIndex);
    }
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

  // Add event listener for the hammer button
  hammerButton.addEventListener("click", () => {
    // In level mode, check if uses are left. In sandbox, always allow.
    if (!Config.sandboxMode && GameState.hammerUsesLeft <= 0) {
      GameState.isHammerActive = false;
      return;
    }
    // Toggle hammer mode
    GameState.isHammerActive = !GameState.isHammerActive;
    canvas.classList.toggle("hammer-cursor", GameState.isHammerActive);
    hammerButton.classList.toggle("active", GameState.isHammerActive);
  });

  // Update the "Define Target" button's event listener
  defineTargetButton.addEventListener("click", () => {
    const wasActive = GameState.isTargetEditorActive;

    // Deactivate other sandbox modes to prevent conflicts
    GameState.isMoldEditorActive = false;
    editMoldButton.classList.remove("active");
    GameState.isPlacingSpout = false;
    canvas.classList.remove("hammer-cursor");

    // Toggle target editor mode
    GameState.isTargetEditorActive = !wasActive;
    defineTargetButton.classList.toggle(
      "active",
      GameState.isTargetEditorActive
    );

    // If we were in edit mode and just turned it OFF, finalize the shape.
    if (wasActive && !GameState.isTargetEditorActive) {
      finalizeTargetShape();
    }
  });

  editMoldButton.addEventListener("click", () => {
    GameState.isMoldEditorActive = !GameState.isMoldEditorActive; // Toggle the mode

    if (GameState.isMoldEditorActive) {
      // Entering edit mode
      editMoldButton.textContent = "Finish";
      editMoldButton.classList.add("active");
    } else {
      // Exiting edit mode
      finalizeDrawnMolds(); // Turn the blueprint into solid molds
      editMoldButton.textContent = "Draw";
      editMoldButton.classList.remove("active");
    }
  });

  loadLevel(0); // Start the first level
  gameLoop();
}

init();
