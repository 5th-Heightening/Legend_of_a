class Player extends MovingObject {

    constructor(x, y) {
        super(x, y, 20);

        // Last horizontal direction faced, kept even while
        // moving vertically or standing still.
        this.facing = "right";

        // Currently-equipped weapons, or null when not out. Set by
        // dash()/swing()/raiseShield() in game.js; both clear
        // themselves once their time is up (see Sword.js, Shield.js).
        this.sword = null;
        this.shield = null;

        // Decorative letter string while "Q" is held, or null - see
        // startSquiggle()/stopSquiggle() in game.js.
        this.squiggle = null;

        // Flips to false once a push carries it into the
        // environment/border - see killPlayer() in game.js.
        this.alive = true;
    }


    // An action (dash, swing, shield) is still running - no new one
    // can start until it's over.
    get busy() {
        return this.sword !== null || this.shield !== null;
    }


    // Behind the shield the player stands still: no steps, no pull.
    get rooted() {
        return this.shield !== null;
    }


    getAscii() {
        return "A";
    }
}
