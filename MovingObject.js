// Base class for every game object that moves around the grid on
// its own or can be pushed (Player, Enemy, ...). It only carries
// the movement state - a Mover - and where the object stood before
// this tick's movement. Actually moving it is done by the
// MovementSystem (see MovementSystem.js), once per game tick.
class MovingObject {

    constructor(x, y, z) {
        this.x = x;
        this.y = y;
        this.z = z;

        this.mover = new Mover();

        // Position at the start of the current tick's movement - set
        // by the MovementSystem. A collision means two objects share
        // a cell, so only these tell which side each came from.
        this.previousX = x;
        this.previousY = y;
    }


    // Knockback - see Push.js.
    get push() {
        return this.mover.push;
    }
}
