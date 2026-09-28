// The one clock of the game. Every tickInterval ms it calls onTick
// with that same fixed dt - never the real elapsed time - so every
// timing in the game (movement, weapon windows, hit checks,
// particles) advances on the same beat and plays out identically
// every time. What happens within a tick, and in which order, is
// up to onTick - see tick() in game.js.
class GameLoop {

    constructor(tickInterval, onTick) {
        this.tickInterval = tickInterval;
        this.onTick = onTick;

        // Number of ticks run so far.
        this.tick = 0;

        this.timer = null;
    }


    start() {

        if (this.timer) {
            return;
        }

        this.timer = setInterval(() => this.step(), this.tickInterval);
    }


    stop() {
        clearInterval(this.timer);
        this.timer = null;
    }


    step() {
        this.tick += 1;
        this.onTick(this.tickInterval, this.tick);
    }
}
