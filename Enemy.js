// Walks back and forth along a fixed row between minX and maxX,
// reversing direction at either end, until it's in combat with its
// target (the player). In combat it runs at the target with
// ATTACK_SPEED. update() only decides the enemy's velocity once per
// game tick; the MovementSystem moves it.
//
// After every encounter (see checkEnemyEncounter() in game.js) the
// enemy is either pushed back - PUSHBACK_SPAN cells at PUSHBACK_SPEED
// - or stands its ground. Either way it then stops for RECOVERY_DELAY
// before it moves again. Its whole rhythm in combat is:
//
//   approach (ATTACK_SPEED) -> encounter -> pushed back (PUSHBACK_SPAN
//   at PUSHBACK_SPEED) -> stop (RECOVERY_DELAY) -> approach ...
class Enemy extends MovingObject {

    // Speed while patrolling, in cells per second.
    static PATROL_SPEED = 2.5;

    // Speed it runs at the player with in combat, in cells per second.
    static ATTACK_SPEED = 6;

    // A push back: how many cells, how fast (cells per second).
    static PUSHBACK_SPAN = 4;
    static PUSHBACK_SPEED = 15;

    // How long it stands still after an encounter (after the push
    // back, if it was pushed), in ms.
    static RECOVERY_DELAY = 400;

    // In combat while the target is at most this many rows away.
    static COMBAT_ROW_DISTANCE = 1;


    constructor(x, y, minX, maxX, target) {
        super(x, y, 15);

        this.minX = minX;
        this.maxX = maxX;

        this.target = target;

        this.direction = 1;

        // Time left standing still after an encounter, in ms.
        this.recoveryTime = 0;

        // Drawn sword, or null when not out. Set by updateEnemySword()
        // in game.js, cleared by EnemySword.putAway(). The enemy won't
        // draw again until swordCooldown (ms) has run down to 0.
        this.sword = null;
        this.swordCooldown = 0;

        // Flips to false once pushed into the environment/border
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
        return this.alive && this.target.alive !== false &&
            Math.abs(this.y - this.target.y) <= Enemy.COMBAT_ROW_DISTANCE;
    }


    // Direction (-1/1) toward the target, 0 in the same column.
    towardTarget() {
        return Math.sign(this.target.x - this.x);
    }


    // Lost an encounter: flies back, then recovers.
    pushBack(direction) {
        this.startPush(direction, Enemy.PUSHBACK_SPAN, Enemy.PUSHBACK_SPEED);
        this.recoveryTime = Enemy.RECOVERY_DELAY;
    }


    // Won an encounter: stops where it is, then recovers.
    holdGround() {
        this.mover.stop();
        this.recoveryTime = Enemy.RECOVERY_DELAY;
    }


    // One game tick of decision making, in this order: still being
    // pushed back -> let it fly; recovering -> stand still; in combat
    // -> run at the target; else patrol.
    update(dt) {

        this.swordCooldown = Math.max(0, this.swordCooldown - dt);

        if (this.inCombat()) {
            this.direction = this.towardTarget() || this.direction;
        }

        if (this.pushed) {
            return;
        }

        if (this.recoveryTime > 0) {
            this.recoveryTime = Math.max(0, this.recoveryTime - dt);
            this.mover.stop();
            return;
        }

        if (this.inCombat()) {
            this.mover.setVelocity(this.towardTarget() * Enemy.ATTACK_SPEED, 0);
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


    // Ran into something without being pushed: stops, and while
    // patrolling turns around.
    bump() {
        this.mover.stop();

        if (!this.inCombat()) {
            this.direction = -this.direction;
        }
    }
}
