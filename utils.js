import { Config } from "./config.js";
import { GameState } from "./game_state.js";

/**
 * Normalizes a shape's points to be relative to a (0,0) origin
 * and creates a consistent, sort-based hash string.
 * This allows for reliable comparison of two shapes, regardless of their
 * position on the main grid or the order of their points.
 * @param {Array<Object>} points - An array of {x, y} points.
 * @returns {string} A unique hash string for the shape.
 */
export function getShapeHash(points) {
  if (!points || points.length === 0) return "";
  const minX = Math.min(...points.map((p) => p.x));
  const minY = Math.min(...points.map((p) => p.y));
  const normalizedPoints = points.map((p) => ({
    x: p.x - minX,
    y: p.y - minY,
  }));
  return normalizedPoints
    .map((p) => `${p.x},${p.y}`)
    .sort() // Sort to ensure order doesn't matter
    .join(";");
}

/**
 * Checks if any block on the grid matches the current level's target shape.
 * If a match is found, it updates the game state to trigger a win.
 */
export function checkWinCondition() {
  // Don't check in sandbox mode or if level is already complete
  if (Config.sandboxMode || GameState.isLevelComplete) {
    return;
  }

  const currentLevel = GameState.gameLevels[GameState.currentLevelIndex];
  if (!currentLevel || !currentLevel.targetShapeHash) {
    return; // No target shape to check against
  }

  for (const block of GameState.stoneBlocks) {
    const blockShapeHash = getShapeHash(block.shape);

    if (
      blockShapeHash === currentLevel.targetShapeHash &&
      block.materialType === currentLevel.targetMaterialType
    ) {
      GameState.isLevelComplete = true;
      GameState.highlightedWinShape = block;
      break; // Level is won
    }
  }
}
