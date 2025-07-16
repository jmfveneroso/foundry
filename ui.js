import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { StoneBlock } from "./stone.js";
import { createEmptyGrid } from "./grid.js";
import { isInBounds } from "./grid.js";
import { RigidBody } from "./rigid_body.js";
import { getShapeHash, checkWinCondition } from "./utils.js";

const controlsPanel = document.querySelector(".controls");
export const canvas = document.getElementById("gameCanvas");
export const ctx = canvas.getContext("2d");
export let canvasWidth = window.innerWidth;
export let canvasHeight = window.innerHeight;

canvas.width = Config.GRID_WIDTH * Config.cellSize;
canvas.height = Config.GRID_HEIGHT * Config.cellSize;

const rangeFactor = 10;

const configurableParams = [
  ["viscosity", 5],
  ["cohesion", 1],
  ["simulationUpdateInterval", 10],
  ["pressureThreshold", 5],
  ["waterMode", "toggle"],
  ["singleParticleCreation", "toggle"],
  ["debugWaterShapes", "toggle"],
  ["sandboxMode", "toggle"],
];

function resizeCanvas() {
  // canvas.width = Config.GRID_WIDTH * Config.cellSize;
  // canvas.height = Config.GRID_HEIGHT * Config.cellSize;
}

/**
 * Generic handler for any slider change.
 * Updates the Config object and the value display span.
 * @param {Event} event
 */
function handleSliderChange(event) {
  const slider = event.target;
  const paramName = slider.id;
  const value = parseFloat(slider.value);
  const decimals = parseInt(slider.dataset.decimals, 10);

  // Update the global Config object
  Config[paramName] = value;

  // Update the corresponding value display
  const valueSpan = document.getElementById(`${paramName}Value`);
  if (valueSpan) {
    valueSpan.textContent = value.toFixed(decimals);
  }
}

function handleCheckboxChange(event) {
  const checkbox = event.target;
  Config[checkbox.id] = checkbox.checked;

  // If the sandbox mode was changed, fire a global event to reset the game state
  if (checkbox.id === "sandboxMode") {
    window.dispatchEvent(new CustomEvent("sandboxModeToggled"));
  }
}

function camelCaseToTitleCase(text) {
  // Insert a space before any uppercase letter
  const withSpaces = text.replace(/([A-Z])/g, " $1");
  // Capitalize the first letter and return
  return withSpaces.charAt(0).toUpperCase() + withSpaces.slice(1);
}

/**
 * Generates all UI slider controls programmatically based on the configurableParams array.
 */
function generateUiControls() {
  controlsPanel.innerHTML = ""; // Clear any existing controls

  configurableParams.forEach(([name, step]) => {
    const initialValue = Config[name];

    // Create the container div
    const group = document.createElement("div");
    group.className = "ctrl-div";

    // Create the label
    const label = document.createElement("label");
    label.setAttribute("for", name);
    label.textContent = camelCaseToTitleCase(name) + ":";
    group.appendChild(label);

    if (step === "toggle") {
      const checkbox = document.createElement("input");
      checkbox.type = "checkbox";
      checkbox.id = name;
      checkbox.checked = Config[name];

      checkbox.addEventListener("change", handleCheckboxChange);
      group.appendChild(checkbox);
    } else {
      // Create the range slider input
      const slider = document.createElement("input");
      slider.type = "range";
      slider.id = name;
      slider.value = initialValue;
      slider.step = step;

      const initialValueString = initialValue.toString();
      let decimals = initialValueString.includes(".")
        ? initialValueString.split(".")[1].length
        : 0;
      const stepValueString = step.toString();
      const stepDecimals = stepValueString.includes(".")
        ? stepValueString.split(".")[1].length
        : 0;
      slider.dataset.decimals = Math.max(decimals, stepDecimals);

      // Calculate min/max range around the initial value
      const range = rangeFactor * step;
      slider.min = Math.max(0, initialValue - range);
      slider.max = initialValue + range;

      slider.addEventListener("input", handleSliderChange);
      group.appendChild(slider);

      // Create the value display span
      const valueSpan = document.createElement("span");
      valueSpan.id = `${name}Value`;
      valueSpan.textContent = initialValue.toFixed(decimals);
      group.appendChild(valueSpan);
    }

    // Add the completed group to the controls panel
    controlsPanel.appendChild(group);
  });

  const resetButton = document.createElement("button");
  resetButton.id = "reset-lump-btn";
  resetButton.textContent = "Reset";
  resetButton.className = "major-action-btn"; // For styling
  controlsPanel.appendChild(resetButton);
}

function createBackgroundPattern(ctx, color) {
  const patternCanvas = document.createElement("canvas");
  const patternCtx = patternCanvas.getContext("2d");

  const size = 20; // The size of the tile. A larger size helps prevent clipping after rotation.
  patternCanvas.width = size;
  patternCanvas.height = size;

  patternCtx.strokeStyle = color;
  patternCtx.lineWidth = 1;

  patternCtx.translate(size / 2, size / 2);
  patternCtx.rotate(Math.PI / 4);
  patternCtx.translate(-size / 2, -size / 2);

  // Draw a series of concentric squares, which will now appear rotated.
  for (let i = 0; i < 2; i++) {
    const squareSize = size - i * 6; // Adjust spacing as needed
    const offset = (size - squareSize) / 2;

    patternCtx.strokeRect(offset, offset, squareSize, squareSize);
  }

  return ctx.createPattern(patternCanvas, "repeat");
}

export function addUiEvents() {
  // Add the button to the bottom of the controls panel
  generateUiControls();
  // resizeCanvas();

  // Get references to the buttons AFTER they have been created
  const expandBtn = document.getElementById("expand-controls-btn");

  // Add events to toggle the panel's visibility
  expandBtn.addEventListener("click", () => {
    controlsPanel.classList.toggle("hidden");
  });

  window.addEventListener("resize", resizeCanvas);

  GameState.backgroundPattern = createBackgroundPattern(
    ctx,
    Config.backgroundColor.patternColor
  );

  document.getElementById("stoneButton").addEventListener("click", () => {
    const margin = 5;
    const x =
      Math.floor(Math.random() * (Config.GRID_WIDTH - 2 * margin)) + margin;
    const y = Math.floor(Math.random() * (Config.GRID_HEIGHT / 4));
    const newStone = new StoneBlock(x, y);
    GameState.stoneBlocks.push(newStone);
    newStone.placeInGrid();
  });

  document.getElementById("solidifyButton").addEventListener("click", () => {
    // Prevent action if the button is disabled
    if (event.currentTarget.classList.contains("btn-disabled")) {
      return;
    }

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
        const cell = GameState.grid[y][x];
        if (
          (cell === Config.IRON_MOLTEN || cell === Config.BRASS_MOLTEN) &&
          !visited[y][x]
        ) {
          // Determine material type from the first particle
          const materialType = cell === Config.BRASS_MOLTEN ? "brass" : "iron";

          const lumpParticles = [];
          const queue = [{ x, y }];
          visited[y][x] = true;
          let minX = x,
            minY = y;

          // 1. Find all connected particles
          const searchQueue = [{ x, y }];
          const foundParticles = [{ x, y }];
          visited[y][x] = true;

          while (searchQueue.length > 0) {
            const current = searchQueue.shift();
            minX = Math.min(minX, current.x);
            minY = Math.min(minY, current.y);

            for (const dir of directions) {
              const nx = current.x + dir.dx;
              const ny = current.y + dir.dy;
              if (
                isInBounds(nx, ny) &&
                !visited[ny][nx] &&
                GameState.grid[ny][nx] === Config.IRON_MOLTEN
              ) {
                visited[ny][nx] = true;
                searchQueue.push({ x: nx, y: ny });
                foundParticles.push({ x: nx, y: ny });
              }
            }
          }

          // 2. Erase the old sand from the grid
          for (const p of foundParticles) {
            GameState.grid[p.y][p.x] = Config.EMPTY;
          }

          // 3. Convert global coordinates to shape-relative coordinates
          const shape = foundParticles.map((p) => ({
            x: p.x - minX,
            y: p.y - minY,
          }));

          // 4. Create a new rigid body with the custom shape
          const newBlock = new RigidBody(minX, minY, shape, materialType);
          GameState.stoneBlocks.push(newBlock);

          // --- NEW SOLDERING/MERGE LOGIC ---
          if (materialType === "brass") {
            const blocksToMerge = findConnectedBrassBlocks(newBlock);

            if (blocksToMerge.size > 1) {
              mergeBlocks(blocksToMerge);
            } else {
              // If no merge happened, just place the new block in the grid
              newBlock.placeInGrid();
            }
          } else {
            // If it's iron, just place it in the grid
            newBlock.placeInGrid();
          }
        }
      }
    }

    checkWinCondition();
  });
}

/**
 * Finds all solid brass blocks connected to a starting block.
 * @param {RigidBody} startBlock - The newly created brass block.
 * @returns {Set<RigidBody>} A set of all connected brass blocks.
 */
function findConnectedBrassBlocks(startBlock) {
  const solidBlockMap = new Map();
  for (const stone of GameState.stoneBlocks) {
    for (const point of stone.shape) {
      const key = `${stone.x + point.x},${stone.y + point.y}`;
      solidBlockMap.set(key, stone);
    }
  }

  const connectedBlocks = new Set();
  const queue = [startBlock];
  const visited = new Set([startBlock]);
  const directions = [
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
  ];

  while (queue.length > 0) {
    const currentBlock = queue.shift();
    connectedBlocks.add(currentBlock);

    for (const point of currentBlock.shape) {
      const globalX = currentBlock.x + point.x;
      const globalY = currentBlock.y + point.y;

      for (const dir of directions) {
        const nx = globalX + dir.dx;
        const ny = globalY + dir.dy;
        const neighborBlock = solidBlockMap.get(`${nx},${ny}`);

        if (
          neighborBlock &&
          !visited.has(neighborBlock) &&
          neighborBlock.materialType === "brass"
        ) {
          visited.add(neighborBlock);
          queue.push(neighborBlock);
        }
      }
    }
  }
  return connectedBlocks;
}

/**
 * Merges a set of RigidBody objects into a single new one.
 * @param {Set<RigidBody>} blocks - The set of blocks to merge.
 */
function mergeBlocks(blocks) {
  let combinedPoints = [];
  let minX = Infinity;
  let minY = Infinity;

  // Collect all points and remove the old blocks from the grid
  for (const block of blocks) {
    block.removeFromGrid();
    for (const point of block.shape) {
      const globalX = block.x + point.x;
      const globalY = block.y + point.y;
      combinedPoints.push({ x: globalX, y: globalY });
      minX = Math.min(minX, globalX);
      minY = Math.min(minY, globalY);
    }
  }

  // Create the new normalized shape
  const newShape = combinedPoints.map((p) => ({
    x: p.x - minX,
    y: p.y - minY,
  }));

  // Create the new merged block
  const mergedBlock = new RigidBody(minX, minY, newShape, "brass");
  mergedBlock.placeInGrid();

  // Update the main game state array
  GameState.stoneBlocks = GameState.stoneBlocks.filter((b) => !blocks.has(b));
  GameState.stoneBlocks.push(mergedBlock);
}

export function clearCanvas() {
  ctx.fillStyle = Config.backgroundColor.normal;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = GameState.backgroundPattern;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

export function generateLevelSelector(levels) {
  const selectorContainer = document.createElement("div");
  selectorContainer.className = "level-selector-container";

  const title = document.createElement("h3");
  title.textContent = "Level Select";
  selectorContainer.appendChild(title);

  const grid = document.createElement("div");
  grid.className = "level-grid";

  // Create a button for each valid level
  levels.forEach((level, index) => {
    if (level.level === "WIN" || level.level === "ERROR") return;

    const button = document.createElement("button");
    button.className = "level-btn";
    button.textContent = level.level;
    button.dataset.levelIndex = index;

    button.addEventListener("click", () => {
      const levelIndex = parseInt(button.dataset.levelIndex, 10);
      // Fire a global event that the main script will listen for
      window.dispatchEvent(
        new CustomEvent("levelSelected", {
          detail: { levelIndex: levelIndex },
        })
      );
      // Hide the controls panel for convenience after selecting a level
      controlsPanel.classList.add("hidden");
    });
    grid.appendChild(button);
  });

  selectorContainer.appendChild(grid);
  controlsPanel.appendChild(selectorContainer);
}
