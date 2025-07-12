import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { ctx } from "./ui.js";
import { updateSand } from "./sand.js";

export function isInBounds(x, y) {
  return x >= 0 && x < Config.GRID_WIDTH && y >= 0 && y < Config.GRID_HEIGHT;
}

export function createEmptyGrid() {
  return new Array(Config.GRID_HEIGHT)
    .fill(0)
    .map(() => new Array(Config.GRID_WIDTH).fill(Config.EMPTY));
}

// This function now reads directly from GameState to render all spouts
export function drawSpouts(ctx) {
  const level = GameState.gameLevels[GameState.currentLevelIndex];
  const spouts = Config.sandboxMode
    ? GameState.sandboxSpouts
    : level?.spouts || [];
  if (!spouts) return;

  spouts.forEach((spout, index) => {
    const state = GameState.spoutFlowStates[index];
    const resourcesLeft = GameState.spoutResources[index];
    const colors =
      spout.material === "brass"
        ? Config.brassMoltenColors
        : Config.ironMoltenColors;

    drawSpoutUI(ctx, spout, state, resourcesLeft, colors);
  });
}

// Helper to draw a single spout and its UI, based on its properties
function drawSpoutUI(ctx, spout, state, resourcesLeft, colors) {
  const x = spout.pos.x * Config.cellSize;
  const y = spout.pos.y * Config.cellSize;
  const halfCell = Config.cellSize / 2;
  const centerX = x + halfCell;
  const centerY = y + halfCell;

  // Draw the flow rate plate above the spout
  ctx.fillStyle = "#333";
  ctx.fillRect(x, y - Config.cellSize, Config.cellSize, Config.cellSize);
  ctx.strokeStyle = "#888";
  ctx.strokeRect(x, y - Config.cellSize, Config.cellSize, Config.cellSize);
  ctx.fillStyle = "white";
  ctx.font = `bold ${halfCell}px sans-serif`;
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(spout.flow, centerX, y - halfCell);

  // Draw the spout hole
  const rimColor = spout.material === "brass" ? "#8c7853" : "#444";
  ctx.fillStyle = rimColor;
  ctx.beginPath();
  ctx.arc(centerX, centerY, halfCell, 0, 2 * Math.PI);
  ctx.fill();

  // Draw the glowing/empty hole
  if (state.isFlowing) {
    const colorIndex = Math.floor(Math.random() * colors.length);
    ctx.fillStyle = colors[colorIndex];
  } else {
    ctx.fillStyle = "#000";
  }
  ctx.beginPath();
  ctx.arc(centerX, centerY, halfCell * 0.7, 0, 2 * Math.PI);
  ctx.fill();

  // Draw the "Metal Left" text below the spout
  const uiY = y + Config.cellSize + halfCell;
  ctx.font = `bold ${Config.cellSize * 0.9}px sans-serif`;

  if (resourcesLeft > 0) {
    const colorIndex = Math.floor(Math.random() * colors.length);
    ctx.fillStyle = colors[colorIndex];
    ctx.shadowColor = colors[2];
    ctx.shadowBlur = 5;
  } else {
    ctx.fillStyle = "#808080";
    ctx.shadowBlur = 0;
  }
  ctx.fillText(resourcesLeft, centerX, uiY);
  ctx.shadowBlur = 0;
}

/**
 * Draws only the loose particles (molten metal), making them shimmer and glow.
 */
export function drawGrid() {
  ctx.shadowBlur = 7; // Set blur once for both types

  for (let y = 0; y < Config.GRID_HEIGHT; y++) {
    for (let x = 0; x < Config.GRID_WIDTH; x++) {
      const cell = GameState.grid[y][x];
      let colors;

      if (cell === Config.IRON_MOLTEN) {
        colors = Config.ironMoltenColors;
        ctx.shadowColor = "#ff8c00"; // Iron glow
      } else if (cell === Config.BRASS_MOLTEN) {
        colors = Config.brassMoltenColors;
        ctx.shadowColor = "#daa520"; // Brass glow
      } else if (cell === Config.PREVIEW_MOLD) {
        // Draw the blueprint tile without a glow
        ctx.fillStyle = Config.colors[Config.PREVIEW_MOLD];
        ctx.shadowBlur = 0;
        ctx.fillRect(
          x * Config.cellSize,
          y * Config.cellSize,
          Config.cellSize,
          Config.cellSize
        );
        continue;
      } else {
        continue; // Skip empty cells
      }

      const colorIndex = Math.floor(Math.random() * colors.length);
      ctx.fillStyle = colors[colorIndex];

      ctx.fillRect(
        x * Config.cellSize,
        y * Config.cellSize,
        Config.cellSize,
        Config.cellSize
      );
    }
  }
  ctx.shadowBlur = 0;
}

export function updateGrid() {
  for (let y = Config.GRID_HEIGHT - 2; y >= 0; y--) {
    const row = GameState.grid[y];
    for (let x = 0; x < Config.GRID_WIDTH; x++) {
      const cell = row[x];
      if (cell === Config.IRON_MOLTEN || cell === Config.BRASS_MOLTEN) {
        updateSand(x, y);
      }
    }
  }
}
