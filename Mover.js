// Movement state of one object on the grid. The owner's x/y always
// stay whole cells; the Mover keeps the smooth rest.
//
// Three things can make an object move, and they add up:
// - its own drive: a velocity in cells per second, set every tick by
//   whatever steers it (AI, ...) - see setVelocity()
// - single queued steps, for grid-exact movement like the player's
//   walk - see queueStep()
// - a knockback (Push, horizontal only)
//
// Each tick advance(dt) turns all of that into whole cells to move.
// The MovementSystem then walks the owner there one cell at a time,
// so nothing can skip over a wall or another object at high speed.
class Mover {

    // Guards against float rounding (e.g. 3 x 0.333... = 0.999...),
    // which would otherwise delay a cell crossing by a whole tick.
    static EPSILON = 1e-9;


    constructor() {

        // Own drive, cells per second.
        this.velocityX = 0;
        this.velocityY = 0;

        this.push = new Push();

        // Hidden sub-cell position relative to the owner's cell,
        // always in (-1, 1).
        this.offsetX = 0;
        this.offsetY = 0;

        // Whole cells to move on the next advance(), on top of the
        // velocities - see queueStep().
        this.queuedX = 0;
        this.queuedY = 0;

        this.wasPushed = false;
    }


    setVelocity(velocityX, velocityY) {
        this.velocityX = velocityX;
        this.velocityY = velocityY;
    }


    // Moves exactly one step (dx, dy) on the next tick, regardless of
    // velocity.
    queueStep(dx, dy) {
        this.queuedX = dx;
        this.queuedY = dy;
    }


    startPush(direction, speed) {
        this.push.start(direction, speed);
        this.offsetX = 0;
    }


    // Forgets any half-crossed cell - e.g. after turning around, or
    // after running into something.
    resetOffset() {
        this.offsetX = 0;
        this.offsetY = 0;
    }


    // Advances the smooth position by dt milliseconds and returns
    // the signed whole cells crossed on each axis - the amount the
    // owner should actually move this tick. The fractional rest is
    // kept for the next tick, so e.g. 12.5 cells per second at a 40ms
    // tick moves one cell every other tick.
    advance(dt) {

        const seconds = dt / 1000;

        // A push that just wore off leaves no half-crossed cell
        // behind for the drive to inherit.
        if (this.wasPushed && !this.push.active()) {
            this.resetOffset();
        }

        this.wasPushed = this.push.active();

        this.offsetX += (this.velocityX + this.push.velocity) * seconds;
        this.offsetY += this.velocityY * seconds;

        const cellsX = Mover.wholeCells(this.offsetX);
        const cellsY = Mover.wholeCells(this.offsetY);

        this.offsetX -= cellsX;
        this.offsetY -= cellsY;

        const dx = cellsX + this.queuedX;
        const dy = cellsY + this.queuedY;

        this.queuedX = 0;
        this.queuedY = 0;

        return { dx, dy };
    }


    static wholeCells(offset) {
        return Math.trunc(offset + Math.sign(offset) * Mover.EPSILON);
    }
}
