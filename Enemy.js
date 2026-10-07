// Walks back and forth along a fixed row between minX and maxX,
// reversing direction at either end, until it's in combat with its
// target (the player) - then the rubber band (see RubberBand.js)
// pulls it toward the target instead, and it only keeps facing it.
// update() only decides the enemy's velocity once per game tick;
// the MovementSystem moves it.
//
// The enemy has one horizontal speed (see Mover.js). A hit is just
// that speed pointing away; there is no separate push.
class Enemy extends MovingObject {

    // Speed while patrolling, in cells per second.
    static PATROL_SPEED = 2.5;

    // Outside of combat, a speed above PATROL_SPEED (e.g. after a
    // hit) is braked by BRAKE (cells per second, per second) until
    // the enemy can patrol again.
    static BRAKE = 20;


    constructor(x, y, minX, maxX, target) {
        super(x, y, 15);

        this.minX = minX;
        this.maxX = maxX;

        this.target = target;

        this.direction = 1;

        // Set in game.js - decides when the enemy is in combat.
        this.rubberBand = null;

        // Drawn sword, or null when not out. Set by updateEnemySword()
        // in game.js, cleared by EnemySword.putAway(). The enemy won't
        // draw again until swordCooldown (ms) has run down to 0.
        this.sword = null;
        this.swordCooldown = 0;

        // Flips to false once knocked into the environment/border
        // - see vanishEnemy() in game.js.
        this.alive = true;
    }


    getAscii() {
        return "E";
    }


    // Like player.facing - the side its sword is drawn on.
    get facing() {
        return this.direction < 0 ? "left" : "right";
    }


    inCombat() {
        return this.rubberBand !== null && this.rubberBand.engaged();
    }


    // One game tick of decision making. In combat, the rubber band
    // alone moves the enemy; it just keeps facing the target.
    // Otherwise: faster than patrolling, it brakes; else it patrols.
    update(dt) {

        this.swordCooldown = Math.max(0, this.swordCooldown - dt);

        if (this.inCombat()) {
            this.direction = this.rubberBand.towardOther(this) || this.direction;
            return;
        }

        if (Math.abs(this.velocityX) > Enemy.PATROL_SPEED) {
            this.mover.brake(Enemy.BRAKE * dt / 1000);
            return;
        }

        this.patrol();
    }


    patrol() {

        if (this.x >= this.maxX) {
            this.direction = -1;
        }
        else if (this.x <= this.minX) {
            this.direction = 1;
        }

        this.mover.setVelocity(this.direction * Enemy.PATROL_SPEED, 0);
    }


    // Ran into something too slowly to die: stops, and while
    // patrolling turns around.
    bump() {
        this.mover.stop();

        if (!this.inCombat()) {
            this.direction = -this.direction;
        }
    }
}
