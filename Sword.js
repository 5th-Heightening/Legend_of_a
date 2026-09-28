// One-shot sword swing, one tile in front of the player. Starts
// as "/" or "\", switches to "_" after frameDuration ms, and is gone
// after another frameDuration - counted in game ticks (see
// update()). Glued to the player via getters, like Shield - x/y and
// the slash direction track the player's current position/facing
// rather than freezing at swing start.
class Sword {

    constructor(player, frameDuration) {
        this.player = player;
        this.z = 25;

        this.frameDuration = frameDuration;

        // Time this swing has been out, in ms of game ticks.
        this.elapsed = 0;

        // Flips from "slash" to "dash" after frameDuration.
        this.frame = "slash";

        this.alive = true;
    }


    // Looks at how long the swing has been out *before* counting
    // this tick, so it's visible for exactly 2 x frameDuration.
    update(dt) {

        if (this.elapsed >= this.frameDuration * 2) {
            this.alive = false;

            if (this.player.sword === this) {
                this.player.sword = null;
            }

            return;
        }

        if (this.elapsed >= this.frameDuration) {
            this.frame = "dash";
        }

        this.elapsed += dt;
    }


    get x() {
        const offset = this.player.facing === "left" ? -1 : 1;
        return this.player.x + offset;
    }


    get y() {
        return this.player.y;
    }


    getAscii() {

        if (this.frame === "dash") {
            return "_";
        }

        return this.player.facing === "left" ? "\\" : "/";
    }
}
