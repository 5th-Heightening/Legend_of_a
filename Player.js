class Player {

    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.z = 20;

        // Last horizontal direction faced, kept even while
        // moving vertically or standing still.
        this.facing = "right";

        // Knockback - see Push.js and the "Push" section in
        // game.js for how this is driven.
        this.push = new Push();

        // Currently-equipped weapons, or null when not out. Set/
        // cleared by swingSword()/showShield()/hideShield() in
        // game.js, which also add/remove them from the renderer.
        this.sword = null;
        this.shield = null;

        // Decorative letter string while "D" is held, or null - see
        // startSquiggle()/stopSquiggle() in game.js.
        this.squiggle = null;
    }


    getAscii() {
        return "A";
    }


    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    }
}
