// The player's sword during one action (dash or swing), glued to the
// player via getters. An action is a list of FRAMES, each one blade
// character at an offset from the player, shown one after the other
// for `frameDuration` ms each - counted in game ticks (see update()).
// After the last frame the sword is put away (alive = false) and
// clears player.sword itself.
//
// Frames are written for a player facing right; facing left, dx and
// the diagonal characters are mirrored.
class Sword {

    static FRAMES = {

        // Sword held straight out in front during the dash.
        dash: [
            { dx: 1, dy: 0, char: "-" }
        ],

        // Swing from above: over the player, diagonal, in front.
        overhead: [
            { dx: 0, dy: -1, char: "|" },
            { dx: 1, dy: -1, char: "/" },
            { dx: 1, dy: 0, char: "-" }
        ],

        // Swing from below: under the player, diagonal, in front.
        underhand: [
            { dx: 0, dy: 1, char: "|" },
            { dx: 1, dy: 1, char: "\\" },
            { dx: 1, dy: 0, char: "-" }
        ]
    };

    // The fighters face each other, so one's "/" is the other's "\":
    // two blades match when one is the mirror image of the other.
    static MIRRORED = { "/": "\\", "\\": "/", "-": "-", "|": "|" };


    static matches(a, b) {
        return Sword.MIRRORED[a] === b;
    }


    constructor(player, frames, frameDuration) {
        this.player = player;
        this.z = 25;

        this.frames = frames;
        this.frameDuration = frameDuration;

        // Time this action has been out, in ms of game ticks.
        this.elapsed = 0;

        this.alive = true;
    }


    // Looks at how long the sword has been out *before* counting
    // this tick, so each frame is visible for exactly frameDuration.
    update(dt) {

        if (this.elapsed >= this.frames.length * this.frameDuration) {
            this.alive = false;

            if (this.player.sword === this) {
                this.player.sword = null;
            }

            return;
        }

        this.elapsed += dt;
    }


    get frame() {
        const index = Math.floor(this.elapsed / this.frameDuration);
        return this.frames[Math.min(index, this.frames.length - 1)];
    }


    get facing() {
        return this.player.facing === "left" ? -1 : 1;
    }


    get x() {
        return this.player.x + this.frame.dx * this.facing;
    }


    get y() {
        return this.player.y + this.frame.dy;
    }


    // The blade character as drawn (mirrored when facing left).
    getAscii() {
        const char = this.frame.char;
        return this.facing < 0 ? Sword.MIRRORED[char] : char;
    }
}
