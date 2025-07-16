import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { isInBounds } from "./grid.js";
import { displaceSand } from "./sand.js";

export class RigidBody {
  constructor(x, y, shape, materialType = "iron", isStatic = false) {
    this.x = x;
    this.y = y;
    this.shape = shape;
    this.materialType = materialType;
    this.isStatic = isStatic;
    this.isSpout = false;

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

  draw(ctx, isHighlighted = false) {
    if (isHighlighted) {
      // --- Draw the simple green highlight for completed levels ---
      ctx.fillStyle = "#00ff00";
      for (const point of this.shape) {
        ctx.fillRect(
          (this.x + point.x) * Config.cellSize,
          (this.y + point.y) * Config.cellSize,
          Config.cellSize,
          Config.cellSize
        );
      }
    } else if (this.isStatic) {
      // --- Draw a distinct look for static blocks (e.g., darker) ---
      const baseColor = "#4a4a4a"; // Darker base for static blocks
      const shadowColor = "#222";
      for (const point of this.shape) {
        const canvasX = (this.x + point.x) * Config.cellSize;
        const canvasY = (this.y + point.y) * Config.cellSize;
        const gradient = ctx.createLinearGradient(
          canvasX,
          canvasY,
          canvasX + Config.cellSize,
          canvasY + Config.cellSize
        );
        gradient.addColorStop(0, baseColor);
        gradient.addColorStop(1, shadowColor);
        ctx.fillStyle = gradient;
        ctx.fillRect(canvasX, canvasY, Config.cellSize, Config.cellSize);
      }
    } else {
      if (this.materialType === "brass") {
        // --- Draw the new shiny BRASS look ---
        const highlightColor = "#f5f5dc"; // Beige
        const baseColor = "#d2b48c"; // Tan
        const shadowColor = "#8b4513"; // SaddleBrown
        for (const point of this.shape) {
          // ... (gradient drawing logic as before, but with brass colors) ...
          const canvasX = (this.x + point.x) * Config.cellSize;
          const canvasY = (this.y + point.y) * Config.cellSize;
          const gradient = ctx.createLinearGradient(
            canvasX,
            canvasY,
            canvasX + Config.cellSize,
            canvasY + Config.cellSize
          );
          gradient.addColorStop(0, highlightColor);
          gradient.addColorStop(0.5, baseColor);
          gradient.addColorStop(1, shadowColor);
          ctx.fillStyle = gradient;
          ctx.fillRect(canvasX, canvasY, Config.cellSize, Config.cellSize);
        }
      } else {
        // --- Draw the new shiny metal look ---
        const highlightColor = "#c0c0c0"; // Light silver
        const baseColor = "#808080"; // Medium gray
        const shadowColor = "#404040"; // Dark gray

        for (const point of this.shape) {
          const canvasX = (this.x + point.x) * Config.cellSize;
          const canvasY = (this.y + point.y) * Config.cellSize;

          // Create a top-left to bottom-right gradient for each tile
          const gradient = ctx.createLinearGradient(
            canvasX,
            canvasY,
            canvasX + Config.cellSize,
            canvasY + Config.cellSize
          );
          gradient.addColorStop(0, highlightColor);
          gradient.addColorStop(0.5, baseColor);
          gradient.addColorStop(1, shadowColor);

          ctx.fillStyle = gradient;
          ctx.fillRect(canvasX, canvasY, Config.cellSize, Config.cellSize);
        }
      }
    }

    // Draw a grid overlay on top of the shape's tiles
    ctx.strokeStyle = "rgba(0, 0, 0, 0.2)"; // A subtle, dark line for the grid
    ctx.lineWidth = 1;
    for (const point of this.shape) {
      ctx.strokeRect(
        (this.x + point.x) * Config.cellSize,
        (this.y + point.y) * Config.cellSize,
        Config.cellSize,
        Config.cellSize
      );
    }

    // --- CONTOUR DRAWING ---
    const edgeSet = new Set();
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

    // Create the path for the outline
    ctx.beginPath();
    for (const edge of edgeSet) {
      const [x1, y1, x2, y2] = edge.split(",").map(Number);
      ctx.moveTo(x1 * Config.cellSize, y1 * Config.cellSize);
      ctx.lineTo(x2 * Config.cellSize, y2 * Config.cellSize);
    }
    ctx.closePath();

    // Draw the outline based on whether it's highlighted
    if (isHighlighted) {
      ctx.strokeStyle = "rgba(255, 255, 255, 1)";
      ctx.lineWidth = 5;
      ctx.stroke();
    } else {
      // Pass 1: Draw a thick, dark background for the border.
      ctx.lineWidth = 3;
      ctx.strokeStyle = "rgba(0, 0, 0, 0.7)";
      ctx.lineJoin = "round"; // Use 'round' for clean corners on thick lines
      ctx.stroke();

      // Pass 2: Draw a thin, lighter line on top to create a beveled highlight.
      // ctx.lineWidth = 1;
      // ctx.strokeStyle = "rgba(255, 255, 255, 0.2)";
      // ctx.stroke();
    }
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
      newGridY < 0
      // newGridY + this.height > Config.GRID_HEIGHT
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
    this.y = newGridY;
    
    const particlesToDisplace = [];
    for (const point of this.shape) {
     const checkX = newGridX + point.x;
     const checkY = newGridY + point.y;
     if (isInBounds(checkX, checkY)) {
      const cell = GameState.grid[checkY][checkX];
      if (cell === Config.IRON_MOLTEN || cell === Config.BRASS_MOLTEN) {
       particlesToDisplace.push({ x: checkX, y: checkY });
      }
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
    // if (this.y + this.height >= Config.GRID_HEIGHT) return false;

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
            GameState.grid[ny][nx] === Config.IRON_MOLTEN
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

  // Add this new method to the end of the RigidBody class
  destroyTile(localPoint) {
    // 1. Create a new shape array without the destroyed point
    const remainingPoints = this.shape.filter(
      (p) => p.x !== localPoint.x || p.y !== localPoint.y
    );

    // 2. Remove the original block from the game
    this.removeFromGrid();
    GameState.stoneBlocks = GameState.stoneBlocks.filter((b) => b !== this);

    if (remainingPoints.length === 0) {
      return; // Block is completely destroyed
    }

    // 3. Find all new "islands" of connected points
    const visited = new Set();
    const newBlockShapes = [];

    for (const point of remainingPoints) {
      const pointKey = `${point.x},${point.y}`;
      if (visited.has(pointKey)) continue;

      const componentPoints = [];
      const queue = [point];
      visited.add(pointKey);

      while (queue.length > 0) {
        const currentPoint = queue.shift();
        componentPoints.push(currentPoint);

        const neighbors = [
          { x: currentPoint.x, y: currentPoint.y - 1 },
          { x: currentPoint.x, y: currentPoint.y + 1 },
          { x: currentPoint.x - 1, y: currentPoint.y },
          { x: currentPoint.x + 1, y: currentPoint.y },
        ];

        for (const neighbor of neighbors) {
          const neighborKey = `${neighbor.x},${neighbor.y}`;
          if (
            !visited.has(neighborKey) &&
            remainingPoints.some(
              (p) => p.x === neighbor.x && p.y === neighbor.y
            )
          ) {
            visited.add(neighborKey);
            queue.push(neighbor);
          }
        }
      }
      newBlockShapes.push(componentPoints);
    }

    // 4. Create new RigidBody objects for each resulting fragment
    for (const shapeComponent of newBlockShapes) {
      const minX = Math.min(...shapeComponent.map((p) => p.x));
      const minY = Math.min(...shapeComponent.map((p) => p.y));

      const normalizedShape = shapeComponent.map((p) => ({
        x: p.x - minX,
        y: p.y - minY,
      }));

      const newBlockX = this.x + minX;
      const newBlockY = this.y + minY;

      const newBlock = new RigidBody(
        newBlockX,
        newBlockY,
        normalizedShape,
        this.materialType,
        this.isStatic
      );
      GameState.stoneBlocks.push(newBlock);
      newBlock.placeInGrid();
    }
  }
}
