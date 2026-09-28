class Player extends MovingObject {

    constructor(x, y) {
        super(x, y, 20);

        // Last horizontal direction faced, kept even while
        // moving vertically or standing still.
        this.facing = "right";

        // Currently-equipped weapons, or null when not out. Set/
        // cleared by swingSword()/showShield()/hideShield() in
        // game.js (a finished swing clears itself, see Sword.js).
        this.sword = null;
        this.shield = null;

        // Decorative letter string while "D" is held, or null - see
        // startSquiggle()/stopSquiggle() in game.js.
        this.squiggle = null;
    }


    getAscii() {
        return "A";
    }
}
