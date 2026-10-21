// Movement state of one object on the grid. The owner's x/y always
// stay whole cells; the Mover keeps the smooth rest.
//
// Horizontally there is exactly one speed, velocityX (cells per
// second, signed). There is no separate knockback: a push is just
// a velocity pointing away from whoever pushed. Whatever acts on
// the object changes that one value:
// - its own drive (the enemy's patrol) - see setVelocity()
// - the rubber band's pull in combat - see RubberBand.js
// - a collision, which sets it anew - see knock()
// - braking - see brake()
//
// On top of that, single queued steps for grid-exact movement like
// the player's walk - see queueStep().
//
// Each tick advance(dt) turns all of that into whole cells to move.
// The MovementSystem then walks the owner there one cell at a time,
// so nothing can skip over a wall or another object at high speed.
class Mover {

    // Guards against float rounding (e.g. 3 x 0.333... = 0.999...),
    // which would otherwise delay a cell crossing by a whole tick.
    static EPSILON = 1e-9;


    constructor() {

        // Cells per second.
        this.velocityX = 0;
        this.velocityY = 0;

        // Hidden sub-cell position relative to the owner's cell,
        // always in (-1, 1).
        this.offsetX = 0;
        this.offsetY = 0;

        // Whole cells to move on the next advance(), on top of the
        // velocities - see queueStep().
        this.queuedX = 0;
        this.queuedY = 0;
    }


    setVelocity(velocityX, velocityY) {
        this.velocityX = velocityX;
        this.velocityY = velocityY;
    }


    // Adds a signed horizontal velocity (cells per second).
    accelerate(velocityX) {
        this.velocityX += velocityX;
    }


    // The outcome of a collision: sets the horizontal speed anew and
    // forgets the half-crossed cell.
    knock(velocityX) {
        this.velocityX = velocityX;
        this.offsetX = 0;
    }


    // Takes `amount` (cells per second) off the horizontal speed,
    // stopping at 0 instead of turning around.
    brake(amount) {

        if (Math.abs(this.velocityX) <= amount) {
            this.stop();
            return;
        }

        this.velocityX -= Math.sign(this.velocityX) * amount;
    }


    stop() {
        this.velocityX = 0;
        this.offsetX = 0;
    }


    // Moves (dx, dy) cells on the next tick, regardless of velocity.
    // Several steps queued in one tick add up (e.g. an arrow step and
    // a sword move, see Sword.js).
    queueStep(dx, dy) {
        this.queuedX += dx;
        this.queuedY += dy;
    }


    // Forgets any half-crossed cell - e.g. after running into
    // something.
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

        this.offsetX += this.velocityX * seconds;
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
