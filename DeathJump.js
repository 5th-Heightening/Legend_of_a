// The last moment of a dying character: a copy of its look that
// jumps straight up from where it died, is pulled back down by
// gravity (like a particle), and falls out through the bottom of
// the play area. Once it's fully below bottomY it's dead
// (alive = false) and the world drops it. Purely visual - nothing
// collides with it or moves it but its own update().
class DeathJump {

    // Initial upward speed, cells per second, and the gravity
    // pulling it back down, cells per second squared. Peak height
    // is JUMP_SPEED^2 / (2 * GRAVITY) cells.
    static JUMP_SPEED = 18;
    static GRAVITY = 40;


    constructor(x, y, ascii, bottomY) {
        this.x = x;
        this.z = 30;

        // Smooth vertical position - the renderer only takes whole
        // cells, so y below is the rounded view of it.
        this.posY = y;
        this.velocityY = -DeathJump.JUMP_SPEED;
         
        this.ascii = ascii;
        this.bottomY = bottomY;

        this.alive = true;
    }


    get y() {
        return Math.round(this.posY);
    }


    getAscii() {
        return this.ascii;
    }


    update(dt) {
        const seconds = dt / 1000;

        this.posY += this.velocityY * seconds;
        this.velocityY += DeathJump.GRAVITY * seconds;

        // Only once it's falling - on the way up it may briefly leave
        // through the top, but it comes back down.
        if (this.velocityY > 0 && this.y >= this.bottomY) {
            this.alive = false;
        }
    }
}
