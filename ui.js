import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { HammerBlock } from "./hammer.js";
import { StoneBlock } from "./stone.js";
import { createEmptyGrid } from "./grid.js";
import { isInBounds } from "./grid.js";
import { RigidBody } from "./rigid_body.js";

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
];

function resizeCanvas() {
  // CHANGE these two lines
  canvasWidth = window.innerWidth;
  canvasHeight = window.innerHeight; // The canvas should always fill the window

  // This logic is incorrect for an overlay panel and should be removed:
  // canvasHeight = window.innerHeight - controlsPanel.offsetHeight - 10;

  if (canvasHeight < 50) canvasHeight = 50; // This check can be removed or kept as a safeguard
  canvas.width = canvasWidth;
  canvas.height = canvasHeight;
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

  document.getElementById("resetButton").addEventListener("click", () => {
    GameState.grid = createEmptyGrid();
    GameState.stoneBlocks = [];
    if (GameState.activeHammer) GameState.activeHammer.removeFromGrid();
    GameState.activeHammer = null;
  });

  document.getElementById("stoneButton").addEventListener("click", () => {
    const margin = 5;
    const x =
      Math.floor(Math.random() * (Config.GRID_WIDTH - 2 * margin)) + margin;
    const y = Math.floor(Math.random() * (Config.GRID_HEIGHT / 4));
    const newStone = new StoneBlock(x, y);
    GameState.stoneBlocks.push(newStone);
    newStone.placeInGrid();
  });

  document.getElementById("hammerButton").addEventListener("click", () => {
    if (GameState.activeHammer) return;
    const hammerWidth = 3;
    const hammerHeight = 8;
    const startX =
      Math.floor(Config.GRID_WIDTH / 2) - Math.floor(hammerWidth / 2);
    GameState.activeHammer = new HammerBlock(
      startX,
      0,
      hammerWidth,
      hammerHeight
    );
    GameState.activeHammer.placeInGrid();
  });

  document.getElementById("solidifyButton").addEventListener("click", () => {
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
        if (GameState.grid[y][x] === Config.SAND && !visited[y][x]) {
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
                GameState.grid[ny][nx] === Config.SAND
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
          const newBlock = new RigidBody(minX, minY, shape);
          GameState.stoneBlocks.push(newBlock);
          newBlock.placeInGrid();
        }
      }
    }
  });
}

export function clearCanvas() {
  ctx.fillStyle = Config.backgroundColor.normal;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = GameState.backgroundPattern;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}
