// Walks back and forth along a fixed row between minX and maxX,
// reversing direction at either end, until the player shares its
// row - then it stops patrolling and closes in on the player
// instead, slowly accelerating (see step()). Movement isn't driven
// by player input - see the patrol timer in the game section.
class Enemy {

    // Closing-in speed, in cells per tick (may be fractional - a
    // hidden sub-cell offset accumulates it, like Push). Starts at
    // APPROACH_START_SPEED and grows by APPROACH_ACCELERATION every
    // tick, up to APPROACH_MAX_SPEED.
    static APPROACH_START_SPEED = 0.5;
    static APPROACH_ACCELERATION = 0.25;
    static APPROACH_MAX_SPEED = 2;

    // Speed while patrolling - its fixed one-cell step per tick.
    static PATROL_SPEED = 1;


    constructor(x, y, minX, maxX) {
        this.x = x;
        this.y = y;
        this.z = 15;

        this.minX = minX;
        this.maxX = maxX;

        this.direction = 1;

        // Current closing-in speed and sub-cell offset, 0 while not
        // approaching - see approach()/resetApproach().
        this.approachSpeed = 0;
        this.approachOffset = 0;

        // Knockback - see Push.js and the "Push" section in
        // game.js for how this is driven.
        this.push = new Push();

        // Drawn sword, or null when not out. Set/cleared by
        // drawEnemySword()/sheathEnemySword() in game.js, which
        // also add/remove it from the renderer. swordReadyAt is the
        // performance.now() time before which it won't draw again.
        this.sword = null;
        this.swordReadyAt = 0;

        // Flips to false once knocked into the environment/border
        // - see vanishEnemy() in game.js. A dead enemy is removed
        // from the renderer, so nothing here reads this directly,
        // but game.js checks it before touching the enemy further.
        this.alive = true;
    }


    getAscii() {
        return "E";
    }


    // How fast the enemy is currently moving under its own power -
    // what a collision reaction uses as "the enemy's speed".
    get speed() {
        return this.approachSpeed > 0 ? this.approachSpeed : Enemy.PATROL_SPEED;
    }


    // Advances one tick. While being pushed, the driving loop in
    // game.js moves the enemy directly - step() leaves it alone.
    // Otherwise: if the player is on the same row, combat mode -
    // face and close in on the player instead of patrolling; the
    // two sides meeting triggers checkEnemyEncounter() in game.js.
    // Off that row, resume the normal left/right patrol.
    step(player) {

        if (this.push.active()) {
            this.resetApproach();
            return;
        }

        if (player && player.y === this.y) {
            this.approach(player);
            return;
        }

        this.resetApproach();

        this.x += this.direction;

        if (this.x >= this.maxX) {
            this.x = this.maxX;
            this.direction = -1;
        }
        else if (this.x <= this.minX) {
            this.x = this.minX;
            this.direction = 1;
        }
    }


    // One closing-in tick: speed up, then move by however many
    // whole cells the smooth position crossed - never past the
    // player, so it stops right on them.
    approach(player) {

        if (this.x === player.x) {
            return;
        }

        const direction = player.x < this.x ? -1 : 1;

        // Turning around starts the run-up from scratch.
        if (direction !== this.direction) {
            this.resetApproach();
            this.direction = direction;
        }

        this.approachSpeed = Math.min(
            Math.max(this.approachSpeed + Enemy.APPROACH_ACCELERATION, Enemy.APPROACH_START_SPEED),
            Enemy.APPROACH_MAX_SPEED
        );

        this.approachOffset += this.approachSpeed;

        const cells = Math.trunc(this.approachOffset);
        this.approachOffset -= cells;

        const distance = Math.abs(player.x - this.x);
        this.x += this.direction * Math.min(cells, distance);
    }


    resetApproach() {
        this.approachSpeed = 0;
        this.approachOffset = 0;
    }
}
