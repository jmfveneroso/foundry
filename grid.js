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
 * Draws only the loose particles (sand/water). Rigid bodies are drawn separately.
 */
export function drawGrid() {
  for (let y = 0; y < Config.GRID_HEIGHT; y++) {
    for (let x = 0; x < Config.GRID_WIDTH; x++) {
      // We only draw SAND particles here. STONEs are handled by their own draw methods.
      if (GameState.grid[y][x] === Config.SAND) {
        ctx.fillStyle = Config.colors[Config.SAND];
        ctx.fillRect(
          x * Config.cellSize,
          y * Config.cellSize,
          Config.cellSize,
          Config.cellSize
        );
      }
    }
  }
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
