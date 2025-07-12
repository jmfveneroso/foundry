import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { canvas } from "./ui.js";
import { addSand, addSandFromSpout } from "./sand.js";
import { isInBounds } from "./grid.js";

function editMoldTile(pos, erase = false) {
  if (isInBounds(pos.gridX, pos.gridY)) {
    GameState.grid[pos.gridY][pos.gridX] = erase
      ? Config.EMPTY
      : Config.PREVIEW_MOLD;
  }
}

// Helper function to convert mouse/touch coordinates to grid coordinates.
function getGridPos(evt) {
  const rect = canvas.getBoundingClientRect();
  const pointer = evt.changedTouches?.[0] || evt.touches?.[0] || evt;

  if (!pointer || typeof pointer.clientX === "undefined") {
    return null;
  }

  const x = pointer.clientX - rect.left;
  const y = pointer.clientY - rect.top;

  return {
    gridX: Math.floor(x / Config.cellSize),
    gridY: Math.floor(y / Config.cellSize),
  };
}

// Handles moving the dragged stone
function handleDragMove(evt) {
  evt.preventDefault();
  // If we move the cursor, it's not a tap, so cancel the long press timer.
  clearTimeout(GameState.longPressTimer);
  GameState.potentialDragTarget = null; // Also clear the potential target

  // Add this to handle drawing by dragging the mouse
  if (GameState.isMoldEditorActive) {
    const pos = getGridPos(evt);
    if (pos) {
      // Use right-click (button 2) to erase, left-click to draw
      const isErasing = evt.buttons === 2;
      editMoldTile(pos, isErasing);
    }
  }

  if (!GameState.draggedStone) return;

  const pos = getGridPos(evt);
  if (!pos) return;

  let newX = pos.gridX - GameState.dragOffsetX;
  let newY = pos.gridY - GameState.dragOffsetY;

  const stone = GameState.draggedStone;
  newX = Math.max(0, Math.min(newX, Config.GRID_WIDTH - stone.width));
  newY = Math.max(0, Math.min(newY, Config.GRID_HEIGHT - stone.height));

  stone.moveTo(newX, newY);
}

// Handles releasing a stone or completing a tap action
function handleInteractionEnd(evt) {
  evt.preventDefault();

  // Always clear the long press timer when the press ends
  clearTimeout(GameState.longPressTimer);

  // If the timer was cleared before it could fire, it means this was a "tap".
  // The potentialDragTarget will be the spout that was tapped.
  if (GameState.potentialDragTarget) {
    addSandFromSpout(GameState.potentialDragTarget);
  }

  // Reset all states
  GameState.draggedStone = null;
  GameState.potentialDragTarget = null;

  window.removeEventListener("mousemove", handleDragMove);
  window.removeEventListener("mouseup", handleInteractionEnd);
  window.removeEventListener("touchmove", handleDragMove);
  window.removeEventListener("touchend", handleInteractionEnd);
  window.removeEventListener("touchcancel", handleInteractionEnd);
}

// Handles the initial mousedown or touchstart event
function handleInteractionStart(evt) {
  evt.preventDefault();
  const pos = getGridPos(evt);
  if (!pos) return;

  // --- 1. Handle Placement Mode ---
  if (GameState.isPlacingSpout) {
    const newSpout = GameState.pendingSpout;
    newSpout.pos = { x: pos.gridX, y: pos.gridY };

    GameState.sandboxSpouts.push(newSpout);
    GameState.spoutResources.push(newSpout.max);
    GameState.spoutFlowStates.push({ isFlowing: false, toPour: 0 });

    GameState.isPlacingSpout = false;
    GameState.pendingSpout = null;
    canvas.classList.remove("hammer-cursor"); // Use same cursor for placement
    return;
  }

  if (GameState.isMoldEditorActive) {
    // Use right-click (button 2) to erase, left-click to draw
    const isErasing = evt.button === 2;
    editMoldTile(pos, isErasing);
    // Set up global listeners to allow for click-and-drag drawing
    window.addEventListener("mousemove", handleDragMove, { passive: false });
    window.addEventListener("mouseup", handleInteractionEnd, {
      passive: false,
    });
    return;
  }

  // --- Hammer logic takes top priority ---
  if (GameState.isHammerActive) {
    let blockDestroyed = false;
    for (const stone of GameState.stoneBlocks) {
      if (stone.containsGlobalPoint(pos.gridX, pos.gridY) && !stone.isStatic) {
        const localPoint = { x: pos.gridX - stone.x, y: pos.gridY - stone.y };
        stone.destroyTile(localPoint);
        if (!Config.sandboxMode) {
          GameState.hammerUsesLeft--;
        }
        blockDestroyed = true;
        break;
      }
    }
    // Deactivate hammer after every click, whether it hit or not
    GameState.isHammerActive = false;
    canvas.classList.remove("hammer-cursor");
    document.getElementById("hammerButton").classList.remove("active");
    return;
  }

  // Find which block, if any, was clicked
  let clickedBlock = null;
  for (const stone of GameState.stoneBlocks) {
    if (stone.containsGlobalPoint(pos.gridX, pos.gridY)) {
      clickedBlock = stone;
      break;
    }
  }

  // --- 4. Check for interaction with a physical block ---
  for (const stone of GameState.stoneBlocks) {
    if (stone.containsGlobalPoint(pos.gridX, pos.gridY) && !stone.isStatic) {
      startDrag(stone, pos);
      return;
    }
  }

  // --- 5. If no block was clicked, check for spout activation ---
  const spouts = Config.sandboxMode
    ? GameState.sandboxSpouts
    : GameState.gameLevels[GameState.currentLevelIndex]?.spouts || [];
  if (spouts.length === 0) return;

  let closestDist = Infinity;
  let closestSpoutIndex = -1;

  spouts.forEach((spout, index) => {
    const dist = Math.hypot(pos.gridX - spout.pos.x, pos.gridY - spout.pos.y);
    if (dist < closestDist) {
      closestDist = dist;
      closestSpoutIndex = index;
    }
  });

  if (
    closestSpoutIndex !== -1 &&
    closestDist <= Config.MIN_SPOUT_CLICK_DISTANCE
  ) {
    const spout = spouts[closestSpoutIndex];
    const state = GameState.spoutFlowStates[closestSpoutIndex];
    const resourcesLeft = GameState.spoutResources[closestSpoutIndex];

    if (state.isFlowing || resourcesLeft < spout.flow) {
      return; // Spout is busy or not enough resources
    }
    state.isFlowing = true;
    state.toPour = spout.flow;
  }

  // Add universal "end" and "move" listeners to catch the release or cancel the tap
  window.addEventListener("mousemove", handleDragMove, { passive: false });
  window.addEventListener("mouseup", handleInteractionEnd, { passive: false });
  window.addEventListener("touchmove", handleDragMove, { passive: false });
  window.addEventListener("touchend", handleInteractionEnd, { passive: false });
  window.addEventListener("touchcancel", handleInteractionEnd, {
    passive: false,
  });
}

// Helper function to initiate a drag on a block
function startDrag(block, pos) {
  GameState.draggedStone = block;
  GameState.dragOffsetX = pos.gridX - block.x;
  GameState.dragOffsetY = pos.gridY - block.y;

  // These listeners are added here to ensure they are only active during a drag.
  // The 'end' listeners are added universally in handleInteractionStart.
  window.addEventListener("mousemove", handleDragMove, { passive: false });
  window.addEventListener("touchmove", handleDragMove, { passive: false });
}

export function addPlayerEvents() {
  canvas.addEventListener("mousedown", handleInteractionStart);
  canvas.addEventListener("touchstart", handleInteractionStart, {
    passive: false,
  });
}
