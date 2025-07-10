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

/**
 * Draws only the loose particles (molten metal), making them shimmer and glow.
 */
export function drawGrid() {
  // Set up a glow effect using canvas shadows
  ctx.shadowColor = "#ff8c00"; // A fiery orange glow
  ctx.shadowBlur = 7;

  const moltenColors = Config.moltenColors;
  const numColors = moltenColors.length;

  for (let y = 0; y < Config.GRID_HEIGHT; y++) {
    for (let x = 0; x < Config.GRID_WIDTH; x++) {
      // We only draw SAND particles here. STONEs are handled by their own draw methods.
      if (GameState.grid[y][x] === Config.SAND) {
        // Pick a random color from the palette on every frame to create a shimmer
        const colorIndex = Math.floor(Math.random() * numColors);
        ctx.fillStyle = moltenColors[colorIndex];

        ctx.fillRect(
          x * Config.cellSize,
          y * Config.cellSize,
          Config.cellSize,
          Config.cellSize
        );
      }
    }
  }

  // Reset the shadow effect so it doesn't affect other drawing operations
  ctx.shadowBlur = 0;
}

export function updateGrid() {
  for (let y = Config.GRID_HEIGHT - 2; y >= 0; y--) {
    const row = GameState.grid[y];
    for (let x = 0; x < Config.GRID_WIDTH; x++) {
      if (row[x] === Config.SAND) {
        updateSand(x, y);
      }
    }
  }
}
