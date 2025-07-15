import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { canvas } from "./ui.js";
import { addSand } from "./sand.js";
import { isInBounds } from "./grid.js";

// Add a new helper for toggling target tiles
function toggleTargetTile(pos) {
  if (isInBounds(pos.gridX, pos.gridY)) {
    const currentTile = GameState.grid[pos.gridY][pos.gridX];
    // If it's already a target tile, erase it. Otherwise, draw it.
    GameState.grid[pos.gridY][pos.gridX] =
      currentTile === Config.TARGET_PREVIEW
        ? Config.EMPTY
        : Config.TARGET_PREVIEW;
  }
}

// Helper function to convert mouse/touch coordinates to grid coordinates.
export function getGridPos(evt) {
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

// Helper function for drawing/erasing blueprint tiles in mold editor mode.
function editMoldTile(pos, erase = false) {
  if (isInBounds(pos.gridX, pos.gridY)) {
    GameState.grid[pos.gridY][pos.gridX] = erase
      ? Config.EMPTY
      : Config.PREVIEW_MOLD;
  }
}

// Handles moving a dragged stone or drawing mold tiles.
function handleDragMove(evt) {
  evt.preventDefault();

  // If in mold editor, continue drawing/erasing.
  if (GameState.isMoldEditorActive) {
    const pos = getGridPos(evt);
    if (pos) {
      const isErasing = evt.buttons === 2; // Right mouse button for erasing.
      editMoldTile(pos, isErasing);
    }
  }

  // Add this to handle drawing the target by dragging the mouse
  if (GameState.isTargetEditorActive) {
    const pos = getGridPos(evt);
    if (pos) {
      // Only draw, don't erase, while dragging
      if (GameState.grid[pos.gridY][pos.gridX] === Config.EMPTY) {
        toggleTargetTile(pos);
      }
    }
  }

  // If moving the cursor, it's not a tap, so cancel the long press timer.
  if (GameState.potentialDragTarget) {
    clearTimeout(GameState.longPressTimer);
    GameState.potentialDragTarget = null;
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

// Handles releasing a stone or completing a tap action.
function handleInteractionEnd(evt) {
  evt.preventDefault();
  clearTimeout(GameState.longPressTimer);

  if (GameState.potentialDragTarget) {
    // If a potential target exists when the press ends, it was a tap.
    // In sandbox mode, this is how spouts are activated.
    if (Config.sandboxMode) {
      addSandFromSpout(GameState.potentialDragTarget);
    }
  }

  // Reset all interaction states.
  GameState.draggedStone = null;
  GameState.potentialDragTarget = null;
  // Let the mold editor button handle toggling its own state.
  // isMoldEditorActive should persist until its button is clicked again.

  window.removeEventListener("mousemove", handleDragMove);
  window.removeEventListener("mouseup", handleInteractionEnd);
  window.removeEventListener("touchmove", handleDragMove);
  window.removeEventListener("touchend", handleInteractionEnd);
  window.removeEventListener("touchcancel", handleInteractionEnd);
}

// Helper function to initiate a drag on a block.
function startDrag(block, pos) {
  GameState.draggedStone = block;
  GameState.dragOffsetX = pos.gridX - block.x;
  GameState.dragOffsetY = pos.gridY - block.y;

  // Add move listeners to the window to track the drag globally.
  window.addEventListener("mousemove", handleDragMove, { passive: false });
  window.addEventListener("touchmove", handleDragMove, { passive: false });
}

// Handles the initial mousedown or touchstart event on the canvas.
function handleInteractionStart(evt) {
  evt.preventDefault();
  const pos = getGridPos(evt);
  if (!pos) return;

  if (GameState.isTargetEditorActive) {
    toggleTargetTile(pos); // Toggle the tile on a single click
    // Set up listeners to allow for click-and-drag painting
    window.addEventListener("mousemove", handleDragMove, { passive: false });
    window.addEventListener("mouseup", handleInteractionEnd, {
      passive: false,
    });
    return;
  }

  // --- 1. Handle Placement Mode ---
  if (GameState.isPlacingSpout) {
    const newSpout = GameState.pendingSpout;
    newSpout.pos = { x: pos.gridX, y: pos.gridY };

    GameState.sandboxSpouts.push(newSpout);
    GameState.spoutResources.push(newSpout.max);
    GameState.spoutFlowStates.push({ isFlowing: false, toPour: 0 });

    GameState.isPlacingSpout = false;
    GameState.pendingSpout = null;
    canvas.classList.remove("hammer-cursor"); // Reset cursor
    return;
  }

  // --- 1. Mold Editor takes top priority ---
  if (GameState.isMoldEditorActive) {
    const isErasing = evt.button === 2;
    editMoldTile(pos, isErasing);
    // Add listeners to allow for click-and-drag drawing.
    window.addEventListener("mousemove", handleDragMove, { passive: false });
    window.addEventListener("mouseup", handleInteractionEnd, {
      passive: false,
    });
    return;
  }

  // --- 2. Hammer logic is next ---
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
    // Deactivate hammer after every click, whether it hit or not.
    GameState.isHammerActive = false;
    canvas.classList.remove("hammer-cursor");
    document.getElementById("hammerButton").classList.remove("active");
    return;
  }

  // --- 3. Check for interaction with a physical block ---
  let clickedBlock = null;
  for (const stone of GameState.stoneBlocks) {
    if (stone.containsGlobalPoint(pos.gridX, pos.gridY)) {
      clickedBlock = stone;
      break;
    }
  }

  if (clickedBlock) {
    if (clickedBlock.isSpout && Config.sandboxMode) {
      // Spout Interaction: Tap vs. Long Press
      GameState.potentialDragTarget = clickedBlock;
      GameState.longPressTimer = setTimeout(() => {
        // If the timer completes, it's a long press: start dragging.
        GameState.potentialDragTarget = null;
        startDrag(clickedBlock, pos);
      }, 250);
    } else if (!clickedBlock.isStatic) {
      // It's a normal, draggable block.
      startDrag(clickedBlock, pos);
    }
    // If block is static, do nothing.
  } else {
    // --- 4. If no block was clicked, check for level-mode spout activation ---
    const level = GameState.gameLevels[GameState.currentLevelIndex];
    const spouts = Config.sandboxMode
      ? GameState.sandboxSpouts
      : level?.spouts || [];
    if (!spouts || spouts.length === 0) return;

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
        return;
      }
      state.isFlowing = true;
      state.toPour = spout.flow;
    }
  }

  // Add universal "end" listeners to catch the release of any interaction.
  window.addEventListener("mouseup", handleInteractionEnd, { passive: false });
  window.addEventListener("touchend", handleInteractionEnd, { passive: false });
  window.addEventListener("touchcancel", handleInteractionEnd, {
    passive: false,
  });
}

export function addPlayerEvents() {
  canvas.addEventListener("mousedown", handleInteractionStart);
  canvas.addEventListener("touchstart", handleInteractionStart, {
    passive: false,
  });
}
