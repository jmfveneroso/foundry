import { GameState } from "./game_state.js";
import { RigidBody } from "./rigid_body.js";
import { isInBounds } from "./grid.js";

export class HammerBlock extends RigidBody {
  constructor(x, y, width, height) {
    super(x, y, width, height);
    this.state = "descending";
  }

  moveUp() {
    this.removeFromGrid();
    this.y--;
    this.placeInGrid();
  }

  update() {
    if (this.state === "descending") {
      if (!this.moveDown()) this.state = "ascending";
    } else {
      if (this.y + this.height < 0) {
        this.removeFromGrid();
        GameState.activeHammer = null;
      } else {
        this.moveUp();
      }
    }
  }
}
