class Player {

    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.z = 20;

        // Last horizontal direction faced, kept even while
        // moving vertically or standing still.
        this.facing = "right";

        // Knockback: cells moved per push tick, and which way.
        // 0 means not currently being pushed. See the "Push"
        // section in the game code for how this is driven.
        this.pushSpeed = 0;
        this.pushDirection = 0;
    }


    getAscii() {
        return "A";
    }


    move(dx, dy) {
        this.x += dx;
        this.y += dy;
    }
}
