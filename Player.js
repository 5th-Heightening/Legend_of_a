class Player extends MovingObject {

    constructor(x, y) {
        super(x, y, 20);

        // Last horizontal direction faced, kept even while
        // moving vertically or standing still.
        this.facing = "right";

        // Current attack or block (see Stance.js), or null. Set/
        // cleared by setStance()/clearStance() in game.js.
        this.stance = null;

        // Set up before an above/below attack is taken (see
        // SwordWindup.js), or null.
        this.windup = null;

        // Decorative letter string while "D" is held, or null - see
        // startSquiggle()/stopSquiggle() in game.js.
        this.squiggle = null;

        // Flips to false once a push carries it into the
        // environment/border - see killPlayer() in game.js.
        this.alive = true;
    }


    getAscii() {
        return "A";
    }
}
