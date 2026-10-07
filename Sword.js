// A fighter's sword during one action (dash, swing or the enemy's
// strike), glued to its owner via getters. An action is a list of
// FRAMES, each one blade character at an offset from the owner,
// shown one after the other for `frameDuration` ms each - counted in
// game ticks (see update()). The last frame stays for `holdDuration`
// (default: frameDuration). Then the sword is put away (alive =
// false) and clears owner.sword itself.
//
// The owner needs x, y, facing ("left"/"right") and a sword field.
// Frames are written for facing right; facing left, dx and the
// diagonal characters are mirrored.
class Sword {

    static FRAMES = {

        // Sword held straight out in front (the player's dash, the
        // enemy's thrust).
        dash: [
            { dx: 1, dy: 0, char: "-" }
        ],

        // Swing from above: over the owner, diagonal, in front.
        overhead: [
            { dx: 0, dy: -1, char: "|" },
            { dx: 1, dy: -1, char: "/" },
            { dx: 1, dy: 0, char: "-" }
        ],

        // Swing from below: under the owner, diagonal, in front.
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


    // Index of the first frame with the blade straight in front - when
    // the blade starts to reach the opponent on the owner's row.
    static frontFrameIndex(frames) {
        return frames.findIndex(frame => frame.dx !== 0 && frame.dy === 0);
    }


    constructor(owner, frames, frameDuration, holdDuration = frameDuration) {
        this.owner = owner;
        this.z = 25;

        this.frames = frames;
        this.frameDuration = frameDuration;
        this.holdDuration = holdDuration;

        // Time this action has been out, in ms of game ticks.
        this.elapsed = 0;

        this.alive = true;
    }


    get duration() {
        return (this.frames.length - 1) * this.frameDuration + this.holdDuration;
    }


    // Looks at how long the sword has been out *before* counting
    // this tick, so each frame is visible for exactly its time.
    update(dt) {

        if (this.elapsed >= this.duration) {
            this.putAway();
            return;
        }

        this.elapsed += dt;
    }


    // True while the sword is out - it counts as a combat part.
    get drawn() {
        return this.alive;
    }


    putAway() {

        if (!this.alive) {
            return;
        }

        this.alive = false;

        if (this.owner.sword === this) {
            this.owner.sword = null;
        }
    }


    get frame() {
        const index = Math.floor(this.elapsed / this.frameDuration);
        return this.frames[Math.min(index, this.frames.length - 1)];
    }


    get facing() {
        return this.owner.facing === "left" ? -1 : 1;
    }


    get x() {
        return this.owner.x + this.frame.dx * this.facing;
    }


    get y() {
        return this.owner.y + this.frame.dy;
    }


    // The blade character as drawn (mirrored when facing left).
    getAscii() {
        const char = this.frame.char;
        return this.facing < 0 ? Sword.MIRRORED[char] : char;
    }
}
