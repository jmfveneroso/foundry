import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { createEmptyGrid, drawGrid, updateGrid } from "./grid.js";
import { clearCanvas, canvas, ctx, addUiEvents } from "./ui.js";
import { addPlayerEvents } from "./player.js";
import {
  enforceCommunicatingVessels,
  drawWaterShapeDebug,
  updateWaterShapes,
} from "./sand.js";

// Get a reference to the counter element
const particleCounterElement = document.getElementById("rigidParticleCounter");

function update() {
  GameState.prevGrid = GameState.grid.map((row) => [...row]);

  for (let i = GameState.stoneBlocks.length - 1; i >= 0; i--) {
    const block = GameState.stoneBlocks[i];
    if (block === GameState.draggedStone) {
      continue;
    }
    block.moveDown();
  }

  updateGrid();

  if (Config.waterMode) {
    updateWaterShapes();
    enforceCommunicatingVessels();
  }
}

function draw() {
  clearCanvas();

  // Draw all the loose sand/water particles
  drawGrid();

  // Initialize a counter for this frame
  let rigidParticleCount = 0;

  // Draw stone blocks and add their particle count
  for (const block of GameState.stoneBlocks) {
    rigidParticleCount += block.shape.length;
    block.draw(ctx);
  }

  if (Config.waterMode && Config.debugWaterShapes) {
    drawWaterShapeDebug(ctx);
  }

  // Update the text content of the counter element
  particleCounterElement.textContent = `Rigid Particles: ${rigidParticleCount}`;
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

function init() {
  GameState.grid = createEmptyGrid();
  addPlayerEvents();
  addUiEvents();
  gameLoop();
}

init();
