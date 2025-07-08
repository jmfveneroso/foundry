import { RigidBody } from "./rigid_body.js";

// Helper to generate a rectangular shape array
function createRectangleShape(width, height) {
  const shape = [];
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      shape.push({ x, y });
    }
  }
  return shape;
}

export class StoneBlock extends RigidBody {
  constructor(startX, startY) {
    const shape = createRectangleShape(5, 5);
    super(startX, startY, shape);
  }
}
