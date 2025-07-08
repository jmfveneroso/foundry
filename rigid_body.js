import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { isInBounds } from "./grid.js";
import { displaceSand } from "./sand.js";

export class RigidBody {
  constructor(x, y, shape) {
    this.x = x;
    this.y = y;
    this.shape = shape;

    if (shape.length > 0) {
      const xs = shape.map((p) => p.x);
      const ys = shape.map((p) => p.y);
      this.width = Math.max(...xs) + 1;
      this.height = Math.max(...ys) + 1;
    } else {
      this.width = 0;
      this.height = 0;
    }
  }

  draw(ctx) {
    ctx.fillStyle = Config.colors[Config.STONE];
    for (const point of this.shape) {
      ctx.fillRect(
        (this.x + point.x) * Config.cellSize,
        (this.y + point.y) * Config.cellSize,
        Config.cellSize,
        Config.cellSize
      );
    }
    const edgeSet = new Set();
    const contourColor = "rgba(0, 0, 0, 0.8)";
    ctx.strokeStyle = contourColor;
    ctx.lineWidth = 1;
    const toggleEdge = (x1, y1, x2, y2) => {
      const key =
        x1 < x2
          ? `${x1},${y1},${x2},${y2}`
          : x2 < x1
            ? `${x2},${y2},${x1},${y1}`
            : y1 < y2
              ? `${x1},${y1},${x2},${y2}`
              : `${x2},${y2},${x1},${y1}`;
      if (edgeSet.has(key)) {
        edgeSet.delete(key);
      } else {
        edgeSet.add(key);
      }
    };
    for (const point of this.shape) {
      const x = this.x + point.x;
      const y = this.y + point.y;
      toggleEdge(x, y, x + 1, y);
      toggleEdge(x, y + 1, x + 1, y + 1);
      toggleEdge(x, y, x, y + 1);
      toggleEdge(x + 1, y, x + 1, y + 1);
    }
    ctx.beginPath();
    for (const edge of edgeSet) {
      const [x1, y1, x2, y2] = edge.split(",").map(Number);
      ctx.moveTo(x1 * Config.cellSize, y1 * Config.cellSize);
      ctx.lineTo(x2 * Config.cellSize, y2 * Config.cellSize);
    }
    ctx.stroke();
  }

  placeInGrid() {
    for (const point of this.shape) {
      const gridX = this.x + point.x;
      const gridY = this.y + point.y;
      if (isInBounds(gridX, gridY)) {
        GameState.grid[gridY][gridX] = Config.STONE;
      }
    }
  }

  removeFromGrid() {
    for (const point of this.shape) {
      const gridX = this.x + point.x;
      const gridY = this.y + point.y;
      if (
        isInBounds(gridX, gridY) &&
        GameState.grid[gridY][gridX] === Config.STONE
      ) {
        GameState.grid[gridY][gridX] = Config.EMPTY;
      }
    }
  }

  containsGlobalPoint(globalX, globalY) {
    // This check is relative to the body's CURRENT position.
    for (const point of this.shape) {
      if (this.x + point.x === globalX && this.y + point.y === globalY) {
        return true;
      }
    }
    return false;
  }

  moveTo(newGridX, newGridY) {
    if (this.x === newGridX && this.y === newGridY) return;

    // --- ADDED: Grid Boundary Collision Check ---
    if (
      newGridX < 0 ||
      newGridX + this.width > Config.GRID_WIDTH ||
      newGridY < 0 ||
      newGridY + this.height > Config.GRID_HEIGHT
    ) {
      return; // Abort move if any part of the body's bounding box is outside the grid.
    }

    // --- VALIDATION STEP ---
    // Before moving, check if the destination is blocked by another stone.
    for (const point of this.shape) {
      const checkX = newGridX + point.x;
      const checkY = newGridY + point.y;

      if (isInBounds(checkX, checkY)) {
        const cell = GameState.grid[checkY][checkX];
        // The cell must not be a stone OR if it is, it must be part of our own body
        // (in case of a small, 1-cell move where footprints overlap).
        if (
          cell === Config.STONE &&
          !this.containsGlobalPoint(checkX, checkY)
        ) {
          return; // Path is blocked, abort the move.
        }
      }
    }
    // --- END VALIDATION ---

    const originalX = this.x;
    const originalY = this.y;
    this.removeFromGrid();

    this.x = newGridX;
    this.y = newGridY;

    const particlesToDisplace = [];
    for (const point of this.shape) {
      const checkX = newGridX + point.x;
      const checkY = newGridY + point.y;
      if (
        isInBounds(checkX, checkY) &&
        GameState.grid[checkY][checkX] === Config.SAND
      ) {
        particlesToDisplace.push({ x: checkX, y: checkY });
      }
    }

    for (const p of particlesToDisplace) {
      if (!displaceSand(p.x, p.y, this)) {
        this.x = originalX;
        this.y = originalY;
        this.placeInGrid();
        return;
      }
    }

    this.placeInGrid();
  }

  canMoveDown() {
    if (this.y + this.height >= Config.GRID_HEIGHT) return false;

    for (const point of this.shape) {
      const checkX = this.x + point.x;
      const checkY = this.y + point.y + 1;

      if (this.containsGlobalPoint(checkX, checkY)) {
        continue;
      }
      if (!isInBounds(checkX, checkY)) continue;

      if (GameState.grid[checkY][checkX] === Config.STONE) {
        return false;
      }
    }

    return true;
  }

  moveDown() {
    if (!this.canMoveDown()) return false;
    // We can use moveTo because it now safely checks for other stones.
    this.moveTo(this.x, this.y + 1);
    return true;
  }

  // countDisplacements is not currently used but kept for potential future use.
  countDisplacements(initialParticles) {
    if (initialParticles.length === 0) return 0;
    let displacedCount = 0;
    const queue = [...initialParticles];
    const visited = new Set(initialParticles.map((p) => `${p.x},${p.y}`));
    let emptySlotsFound = 0;
    while (queue.length > 0) {
      const current = queue.shift();
      displacedCount++;
      const directions = [
        { dx: 0, dy: 1 },
        { dx: -1, dy: 1 },
        { dx: 1, dy: 1 },
        { dx: -1, dy: 0 },
        { dx: 1, dy: 0 },
        { dx: -1, dy: -1 },
        { dx: 1, dy: -1 },
        { dx: 0, dy: -1 },
      ].sort(() => Math.random() - 0.5);
      let spaceFoundForThisParticle = false;
      for (const dir of directions) {
        const nx = current.x + dir.dx;
        const ny = current.y + dir.dy;
        const key = `${nx},${ny}`;
        if (!isInBounds(nx, ny) || visited.has(key)) continue;
        const isFutureStonePos =
          ny >= this.y + 1 &&
          ny < this.y + 1 + this.height &&
          nx >= this.x &&
          nx < this.x + this.width;
        if (GameState.grid[ny][nx] === Config.EMPTY && !isFutureStonePos) {
          emptySlotsFound++;
          spaceFoundForThisParticle = true;
          visited.add(key);
          if (emptySlotsFound >= initialParticles.length) return displacedCount;
          break;
        }
      }
      if (!spaceFoundForThisParticle) {
        for (const dir of directions) {
          const nx = current.x + dir.dx;
          const ny = current.y + dir.dy;
          const key = `${nx},${ny}`;
          if (
            isInBounds(nx, ny) &&
            !visited.has(key) &&
            GameState.grid[ny][nx] === Config.SAND
          ) {
            visited.add(key);
            queue.push({ x: nx, y: ny });
          }
        }
      }
    }
    return emptySlotsFound < initialParticles.length
      ? Infinity
      : displacedCount;
  }
}
