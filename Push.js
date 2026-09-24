// Knockback state shared by the player and the enemy: a speed
// (cells per tick, horizontal only, may be fractional) and a
// direction (-1/1). speed of 0 means not currently pushed. Whoever
// owns an instance (Player, Enemy) just holds it - actually moving
// the owner each tick, and deciding what a collision while pushed
// means, is done by the driving loop in game.js.
class Push {

    constructor() {
        this.speed = 0;
        this.direction = 0;

        // Hidden sub-cell position relative to the owner's actual
        // cell, always in (-1, 1) - see step().
        this.offset = 0;

        // Recovery keypresses accumulated toward shaving 1 off
        // speed - see recoverStep().
        this.recoverProgress = 0;
    }


    active() {
        return this.speed > 0;
    }


    start(direction, speed) {
        this.direction = direction;
        this.speed = speed;
        this.offset = 0;
        this.recoverProgress = 0;
    }


    stop() {
        this.speed = 0;
        this.direction = 0;
        this.offset = 0;
        this.recoverProgress = 0;
    }


    // Advances the smooth position by one tick's worth of speed
    // and returns the signed number of whole cells crossed - the
    // amount the owner should actually move this tick. The
    // fractional rest is kept for the next tick, so e.g. speed 0.5
    // moves one cell every other tick.
    step() {
        this.offset += this.direction * this.speed;

        const cells = Math.trunc(this.offset);
        this.offset -= cells;

        return cells;
    }


    // One recovery keypress. Once pressesPerPoint of these have
    // accumulated, shaves 1 off speed and resets the counter -
    // stop()s outright once speed bottoms out.
    recoverStep(pressesPerPoint) {
        this.recoverProgress += 1;

        if (this.recoverProgress >= pressesPerPoint) {
            this.recoverProgress = 0;
            this.speed -= 1;

            if (this.speed <= 0) {
                this.stop();
            }
        }
    }
}
