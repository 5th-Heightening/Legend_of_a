// Movement state of one object on the grid. The owner's x/y always
// stay whole cells; the Mover keeps the smooth rest.
//
// Horizontally there is exactly one speed, velocityX (cells per
// second, signed). Two ways to move with it:
// - setVelocity() - keeps moving until told otherwise (the enemy's
//   patrol and approach)
// - travel() - moves exactly a given number of cells, then stops on
//   its own (a push back, the player's dash)
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

        // Cells left to go on the current travel(), or null while not
        // travelling.
        this.remainingX = null;

        // Whole cells to move on the next advance(), on top of the
        // velocities - see queueStep().
        this.queuedX = 0;
        this.queuedY = 0;
    }


    setVelocity(velocityX, velocityY) {
        this.velocityX = velocityX;
        this.velocityY = velocityY;
        this.remainingX = null;
    }


    // Moves exactly `cells` cells at the signed `velocityX` (cells per
    // second), then stops. Starts on a whole cell.
    travel(velocityX, cells) {

        if (cells <= 0) {
            this.stop();
            return;
        }

        this.velocityX = velocityX;
        this.offsetX = 0;
        this.remainingX = cells;
    }


    // True while a travel() hasn't covered all its cells yet.
    get traveling() {
        return this.remainingX !== null;
    }


    stop() {
        this.velocityX = 0;
        this.offsetX = 0;
        this.remainingX = null;
    }


    // Moves exactly one step (dx, dy) on the next tick, regardless of
    // velocity.
    queueStep(dx, dy) {
        this.queuedX = dx;
        this.queuedY = dy;
    }


    // Forgets any half-crossed cell - e.g. after running into
    // something.
    resetOffset() {
        this.offsetX = 0;
        this.offsetY = 0;
    }


    // A copy of the current movement (without queued steps), to run
    // ahead without touching the real one - see ContactPredictor.js.
    clone() {
        const copy = new Mover();

        copy.velocityX = this.velocityX;
        copy.velocityY = this.velocityY;
        copy.offsetX = this.offsetX;
        copy.offsetY = this.offsetY;
        copy.remainingX = this.remainingX;

        return copy;
    }


    // Advances the smooth position by dt milliseconds and returns
    // the signed whole cells crossed on each axis - the amount the
    // owner should actually move this tick. The fractional rest is
    // kept for the next tick, so e.g. 12.5 cells per second at a 40ms
    // tick moves one cell every other tick. A travel() ends exactly
    // on its last cell.
    advance(dt) {

        const seconds = dt / 1000;

        this.offsetX += this.velocityX * seconds;
        this.offsetY += this.velocityY * seconds;

        let cellsX = Mover.wholeCells(this.offsetX);
        const cellsY = Mover.wholeCells(this.offsetY);

        this.offsetX -= cellsX;
        this.offsetY -= cellsY;

        if (this.traveling) {

            if (Math.abs(cellsX) >= this.remainingX) {
                cellsX = Math.sign(cellsX) * this.remainingX;
                this.stop();
            }
            else {
                this.remainingX -= Math.abs(cellsX);
            }
        }

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
