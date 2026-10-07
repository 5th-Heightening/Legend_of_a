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

        // Whether the current travel() is a push back (see pushed).
        this.travelIsPush = false;

        // Position at the start of the current tick's movement - set
        // by the MovementSystem. A collision means two objects share
        // a cell, so only these tell which side each came from.
        this.previousX = x;
        this.previousY = y;
    }


    // The one horizontal speed, cells per second - see Mover.js.
    get velocityX() {
        return this.mover.velocityX;
    }


    // Being pushed back: moves exactly `span` cells in `direction`
    // (-1/1) at `speed` (cells per second), then stops on its own.
    startPush(direction, span, speed) {
        this.mover.travel(direction * speed, span);
        this.travelIsPush = true;
    }


    // Moving on its own for a fixed span (the player's dash) - like a
    // push, but it isn't one.
    lunge(direction, span, speed) {
        this.mover.travel(direction * speed, span);
        this.travelIsPush = false;
    }


    // True while a push back is still carrying it.
    get pushed() {
        return this.travelIsPush && this.mover.traveling;
    }
}
