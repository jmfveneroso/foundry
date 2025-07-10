import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { canvas } from "./ui.js";
import { addSand } from "./sand.js";

// Helper function to convert mouse/touch coordinates to grid coordinates.
function getGridPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const pointer = evt.touches ? evt.touches[0] : evt;
  // If pointer is null (e.g., on touchend), we can't get coordinates
  if (!pointer) return null;

  const x = pointer.clientX - rect.left;
  const y = pointer.clientY - rect.top;

  return {
    gridX: Math.floor(x / Config.cellSize),
    gridY: Math.floor(y / Config.cellSize),
  };
}

function handleDrawStart(evt) {
  evt.preventDefault();
  const { gridX, gridY } = getGridPos(evt);

  // First, check if we are grabbing a stone block.
  for (const stone of GameState.stoneBlocks) {
    if (
      gridX >= stone.x &&
      gridX < stone.x + stone.width &&
      gridY >= stone.y &&
      gridY < stone.y + stone.height
    ) {
      GameState.draggedStone = stone;
      // Calculate and store the initial click offset
      GameState.dragOffsetX = gridX - stone.x;
      GameState.dragOffsetY = gridY - stone.y;
      GameState.isDrawing = false; // Make sure we're not in drawing mode
      return;
    }
  }

  // If not grabbing a stone, we intend to draw.
  // Set the flag, but don't draw yet. This waits for move/end to differentiate a tap from a drag.
  GameState.isDrawing = true;
}

function handleDrawMove(evt) {
  evt.preventDefault();

  if (GameState.draggedStone) {
    const pos = getGridPos(evt);
    if (!pos) return; // Can happen if touch moves off-screen

    // Calculate the new top-left position using the stored offset
    const newX = pos.gridX - GameState.dragOffsetX;
    const newY = pos.gridY - GameState.dragOffsetY;
    GameState.draggedStone.moveTo(newX, newY);
  } else if (GameState.isDrawing) {
    // This is the first movement of a potential drag.
    addSand(evt);
    // If in single particle mode, immediately disable drawing
    // so no more particles are added during this gesture.
    if (Config.singleParticleCreation) {
      GameState.isDrawing = false;
    }
  }
}

function handleDrawEnd(evt) {
  evt.preventDefault();

  // This handles a "tap" where touchstart fires but touchmove does not.
  // If isDrawing is still true, it means we haven't drawn anything yet.
  if (GameState.isDrawing) {
    addSand(evt);
  }

  // Reset all states
  GameState.isDrawing = false;
  GameState.draggedStone = null;
}

export function addPlayerEvents() {
  // Desktop Mouse Events
  canvas.addEventListener("mousedown", handleDrawStart);
  canvas.addEventListener("mousemove", handleDrawMove);
  canvas.addEventListener("mouseup", handleDrawEnd);
  canvas.addEventListener("mouseout", handleDrawEnd);

  // Mobile Touch Events
  canvas.addEventListener("touchstart", handleDrawStart, { passive: false });
  canvas.addEventListener("touchmove", handleDrawMove, { passive: false });
  canvas.addEventListener("touchend", handleDrawEnd);
  canvas.addEventListener("touchcancel", handleDrawEnd);
}
