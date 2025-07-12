import { Config } from "./config.js";
import { GameState } from "./game_state.js";
import { canvas, ctx } from "./ui.js";
import { isInBounds } from "./grid.js";

function getPointerPos(evt) {
  const rect = canvas.getBoundingClientRect();
  // For touchend, the data is in changedTouches. For others, it's in touches. For mouse, it's the event itself.
  const pointer = evt.changedTouches?.[0] || evt.touches?.[0] || evt;

  // If for any reason a pointer couldn't be determined, exit gracefully.
  if (!pointer || typeof pointer.clientX === "undefined") {
    return null;
  }

  return {
    x: pointer.clientX - rect.left,
    y: pointer.clientY - rect.top,
  };
}

/**
 * NEW: Displaces a horizontal chain of water particles until an empty space is found.
 * This function allows water to flow and level itself much faster.
 * @param {number} startX
 * @param {number} startY
 * @returns {boolean} True if the particle was successfully moved as part of a flow.
 */
function displaceWaterHorizontally(startX, startY) {
  const direction = Math.random() < 0.5 ? 1 : -1; // -1 for left, 1 for right

  // --- Pathfinding (Linear Search) ---
  const path = [{ x: startX, y: startY }];
  let destination = null;
  const MAX_SCAN = Config.GRID_WIDTH; // How far to scan horizontally

  // Scan in the first direction
  for (let i = 1; i < MAX_SCAN; i++) {
    const nextX = startX + i * direction;
    if (!isInBounds(nextX, startY)) break; // Hit edge of the world

    const cellType = GameState.grid[startY][nextX];
    if (cellType === Config.EMPTY) {
      destination = { x: nextX, y: startY };
      break;
    }
    if (cellType !== Config.IRON_MOLTEN) break; // Hit a solid
    path.push({ x: nextX, y: startY });
  }

  // --- Execution ---
  if (destination) {
    // A path was found. Move all particles in the chain over by one.
    // We iterate backwards from the destination to the start.
    for (let i = path.length - 1; i >= 0; i--) {
      const current = path[i];
      const next = i === path.length - 1 ? destination : path[i];
      GameState.grid[next.y][next.x] = GameState.grid[current.y][current.x];
    }
    GameState.grid[startY][startX] = Config.EMPTY; // Original spot is now empty
    return true;
  }

  return false; // Could not find a path
}

export function updateWaterShapes() {
  if (!Config.waterMode) {
    if (GameState.waterShapes.size > 0) GameState.waterShapes.clear();
    return;
  }

  const visited = new Array(Config.GRID_HEIGHT)
    .fill(0)
    .map(() => new Array(Config.GRID_WIDTH).fill(false));
  const directions = [
    { dx: 0, dy: 1 },
    { dx: 0, dy: -1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: -1 },
    { dx: 1, dy: -1 },
    { dx: -1, dy: 1 },
  ];
  const stableDirections = [
    { dx: 0, dy: 1 },
    { dx: 1, dy: 0 },
    { dx: -1, dy: 0 },
    { dx: 1, dy: 1 },
    { dx: -1, dy: 1 },
  ];
  const neighborCheckDirections = [...stableDirections];

  const currentShapeIds = new Set();
  const newShapes = new Map();

  for (let y = 0; y < Config.GRID_HEIGHT; y++) {
    for (let x = 0; x < Config.GRID_WIDTH; x++) {
      if (GameState.grid[y][x] === Config.IRON_MOLTEN && !visited[y][x]) {
        const shapeParticles = [];
        const queue = [{ x, y }];
        visited[y][x] = true;

        while (queue.length > 0) {
          const current = queue.shift();
          shapeParticles.push(current);
          for (const dir of directions) {
            const nx = current.x + dir.dx;
            const ny = current.y + dir.dy;
            if (
              isInBounds(nx, ny) &&
              !visited[ny][nx] &&
              GameState.grid[ny][nx] === Config.IRON_MOLTEN
            ) {
              visited[ny][nx] = true;
              queue.push({ x: nx, y: ny });
            }
          }
        }

        shapeParticles.sort((a, b) => a.y - b.y || a.x - b.x);
        const id = `${shapeParticles[0].x},${shapeParticles[0].y}`;
        currentShapeIds.add(id);
        const highestY = shapeParticles[0].y;

        let isStable = true;
        // 1. A shape is UNSTABLE if any particle has just FALLEN into place.
        // We check this by seeing if a particle's current spot was empty in the
        // previous frame, AND the space above it was occupied.
        for (const particle of shapeParticles) {
          const px = particle.x;
          const py = particle.y;

          if (GameState.prevGrid[py][px] === Config.EMPTY) {
            const upY = py - 1;
            if (isInBounds(px, upY)) {
              // Check if it fell from directly above or diagonally above
              if (
                GameState.prevGrid[upY][px] === Config.IRON_MOLTEN ||
                (isInBounds(px - 1, upY) &&
                  GameState.prevGrid[upY][px - 1] === Config.IRON_MOLTEN) ||
                (isInBounds(px + 1, upY) &&
                  GameState.prevGrid[upY][px + 1] === Config.IRON_MOLTEN)
              ) {
                isStable = false;
                break;
              }
            }
          }
        }

        for (const particle of shapeParticles) {
          // Only check particles that are "underwater"
          if (particle.y > highestY) {
            for (const dir of neighborCheckDirections) {
              const nx = particle.x + dir.dx;
              const ny = particle.y + dir.dy;

              if (
                isInBounds(nx, ny) &&
                GameState.grid[ny][nx] === Config.EMPTY
              ) {
                // This is a potential internal bubble. It only makes the shape unstable
                // if the bubble itself is also "underwater".
                if (ny > highestY) {
                  isStable = false;
                  break;
                }
              }
            }
          }
          if (!isStable) break;
        }

        // Update cache
        if (GameState.waterShapes.has(id)) {
          const existingShape = GameState.waterShapes.get(id);
          existingShape.particles = shapeParticles;
          existingShape.isStable = isStable;
        } else {
          GameState.waterShapes.set(id, {
            particles: shapeParticles,
            isStable: isStable,
          });
        }
      }
    }
  }

  for (const oldId of GameState.waterShapes.keys()) {
    if (!currentShapeIds.has(oldId)) {
      GameState.waterShapes.delete(oldId);
    }
  }
}

export function drawWaterShapeDebug(ctx) {
  ctx.fillStyle = "rgba(0, 0, 0, 0.7)";
  for (const shape of GameState.waterShapes.values()) {
    if (shape.isStable) {
      for (const particle of shape.particles) {
        ctx.fillRect(
          particle.x * Config.cellSize,
          particle.y * Config.cellSize,
          Config.cellSize,
          Config.cellSize
        );
      }
    }
  }
}

/**
 * The final implementation of the communicating vessels principle.
 * It acts on stable shapes and moves one particle up per frame to level the shape.
 */
export function enforceCommunicatingVessels() {
  return;

  // This function can only run in water mode and if there are shapes to process
  if (!Config.waterMode || GameState.waterShapes.size === 0) {
    return;
  }

  for (const shape of GameState.waterShapes.values()) {
    // Only act on shapes that have been marked as stable in the current frame
    if (!shape.isStable) {
      continue;
    }

    const highestY = shape.particles[0].y;
    const possibleMoves = [];

    // Find all particles below the water level that can move up
    for (const particle of shape.particles) {
      if (particle.y > highestY) {
        const upY = particle.y - 1;
        if (
          isInBounds(particle.x, upY) &&
          GameState.grid[upY][particle.x] === Config.EMPTY
        ) {
          possibleMoves.push({
            from: particle,
            to: { x: particle.x, y: upY },
          });
        }
      }
    }

    // If there are valid upward moves, pick one and execute it
    if (possibleMoves.length > 0) {
      // Pick one particle to move up. This makes the leveling gradual.
      const move =
        possibleMoves[Math.floor(Math.random() * possibleMoves.length)];

      // Execute the move
      GameState.grid[move.to.y][move.to.x] = Config.IRON_MOLTEN;
      GameState.grid[move.from.y][move.from.x] = Config.EMPTY;

      // By making this move, the shape will become unstable for the next frame,
      // preventing further actions until it settles again.
      // We only process one stable shape per frame to keep the effect subtle.
      return;
    }
  }
}

export function updateSand(x, y) {
  let material = GameState.grid[y][x];
  // --- WATER PHYSICS ---
  if (Config.waterMode) {
    const down = y + 1;

    // 1. Gravity is the highest priority
    if (isInBounds(x, down) && GameState.grid[down][x] === Config.EMPTY) {
      GameState.grid[y][x] = Config.EMPTY;
      GameState.grid[down][x] = material;
      return;
    }

    // 2. Diagonal flow with gap prevention
    const dir = Math.random() < 0.5 ? 1 : -1; // -1 for left, 1 for right

    // Check first diagonal direction
    let nextX1 = x + dir;
    if (
      isInBounds(nextX1, down) &&
      GameState.grid[down][nextX1] === Config.EMPTY && // Is the destination empty?
      GameState.grid[y][nextX1] !== Config.STONE // *** Is the path to the side clear? ***
    ) {
      GameState.grid[y][x] = Config.EMPTY;
      GameState.grid[down][nextX1] = material;
      return;
    }

    // Check other diagonal direction
    let nextX2 = x - dir;
    if (
      isInBounds(nextX2, down) &&
      GameState.grid[down][nextX2] === Config.EMPTY && // Is the destination empty?
      GameState.grid[y][nextX2] !== Config.STONE // *** Is the path to the side clear? ***
    ) {
      GameState.grid[y][x] = Config.EMPTY;
      GameState.grid[down][nextX2] = material;
      return;
    }

    // 3. Horizontal pressure flow (no change needed here)
    displaceWaterHorizontally(x, y);
  }
  // --- SAND/CLAY PHYSICS ---
  else {
    if (Math.random() * 100 < Config.viscosity) {
      return;
    }
    const down = y + 1;
    if (!isInBounds(x, down)) return;
    const downCell = GameState.grid[down][x] === Config.EMPTY;
    const leftDiagCell =
      !isInBounds(x - 1, down) || GameState.grid[down][x - 1] === Config.EMPTY;
    const rightDiagCell =
      !isInBounds(x + 1, down) || GameState.grid[down][x + 1] === Config.EMPTY;
    let unsupported = 0;
    if (downCell) unsupported++;
    if (leftDiagCell) unsupported++;
    if (rightDiagCell) unsupported++;
    if (downCell && unsupported > Config.cohesion) {
      GameState.grid[y][x] = Config.EMPTY;
      GameState.grid[down][x] = material;
      return;
    }
    if (Config.cohesion < 2) {
      const dir = Math.random() < 0.5 ? -1 : 1;
      if (leftDiagCell && dir === -1) {
        GameState.grid[y][x] = Config.EMPTY;
        GameState.grid[down][x - 1] = material;
      } else if (rightDiagCell && dir === 1) {
        GameState.grid[y][x] = Config.EMPTY;
        GameState.grid[down][x + 1] = material;
      }
    }
  }
}

export function addSandFromSpout(spoutBody) {
  const material =
    spoutBody.materialType === "brass"
      ? Config.BRASS_MOLTEN
      : Config.IRON_MOLTEN;

  // Pour from the spout's current location
  const x = spoutBody.x;
  const y = spoutBody.y + 1;

  if (isInBounds(x, y) && GameState.grid[y][x] === Config.EMPTY) {
    GameState.grid[y][x] = material;
    // No resource tracking in sandbox mode
  }
}

// This function now accepts the index of the spout that is pouring
export function addSand(spoutIndex) {
  const level = GameState.gameLevels[GameState.currentLevelIndex];
  const spout = level.spouts[spoutIndex];
  if (!spout) return;

  const isBrass = spout.material === "brass";
  const material = isBrass ? Config.BRASS_MOLTEN : Config.IRON_MOLTEN;

  // Use the spout's defined position
  const x = spout.pos.x;
  const y = spout.pos.y + 1;

  if (isInBounds(x, y) && GameState.grid[y][x] === Config.EMPTY) {
    GameState.grid[y][x] = material;
    // Decrement the resource count for the specific spout
    GameState.spoutResources[spoutIndex]--;
  }
}

/**
 * Finds a path for a particle to an empty spot and moves the entire chain.
 * @param {number} startX The initial particle's X coordinate.
 * @param {number} startY The initial particle's Y coordinate.
 * @param {RigidBody} movingBody The body causing the displacement, to define a forbidden zone.
 * @returns {boolean} True if displacement was successful, false otherwise.
 */
export function displaceSand(startX, startY, movingBody) {
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

  const startKey = `${startX},${startY}`;
  const queue = [{ x: startX, y: startY }];
  const visited = new Set([startKey]);
  const parentMap = new Map();
  let destination = null;

  while (queue.length > 0) {
    const current = queue.shift();

    for (const dir of directions) {
      const nextX = current.x + dir.dx;
      const nextY = current.y + dir.dy;
      const key = `${nextX},${nextY}`;

      if (!isInBounds(nextX, nextY) || visited.has(key)) {
        continue;
      }
      visited.add(key);

      // UPDATED: Check if the target cell is forbidden by the custom shape
      const isForbidden =
        movingBody && movingBody.containsGlobalPoint(nextX, nextY);

      const cellType = GameState.grid[nextY][nextX];

      if (cellType === Config.EMPTY && !isForbidden) {
        destination = { x: nextX, y: nextY };
        parentMap.set(key, current);
        queue.length = 0;
        break;
      } else if (cellType === Config.IRON_MOLTEN) {
        parentMap.set(key, current);
        queue.push({ x: nextX, y: nextY });
      }
    }
  }

  if (!destination) {
    return false; // Trapped
  }

  // Path found. Move particles along the path in reverse.
  let currentKey = `${destination.x},${destination.y}`;
  let currentPos = destination;

  while (parentMap.has(currentKey)) {
    const parentPos = parentMap.get(currentKey);
    GameState.grid[currentPos.y][currentPos.x] =
      GameState.grid[parentPos.y][parentPos.x];
    currentPos = parentPos;
    currentKey = `${parentPos.x},${parentPos.y}`;
  }
  GameState.grid[startY][startX] = Config.EMPTY;

  return true;
}
