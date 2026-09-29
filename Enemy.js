// Walks back and forth along a fixed row between minX and maxX,
// reversing direction at either end, until it's in combat with its
// target (the player) - then the rubber band (see RubberBand.js)
// pulls it toward the target instead, and it only keeps facing it.
// update() only decides the enemy's velocity once per game tick;
// the MovementSystem moves it.
class Enemy extends MovingObject {

    // Speed while patrolling, in cells per second.
    static PATROL_SPEED = 2.5;

    // Outside of combat the enemy has no input to fight a push with,
    // so it recovers on its own: loses PUSH_RECOVER_AMOUNT (cells per
    // second) of push speed every PUSH_RECOVER_INTERVAL ms.
    static PUSH_RECOVER_INTERVAL = 500;
    static PUSH_RECOVER_AMOUNT = 5;


    constructor(x, y, minX, maxX, target) {
        super(x, y, 15);

        this.minX = minX;
        this.maxX = maxX;

        this.target = target;

        this.direction = 1;

        // Set in game.js - decides when the enemy is in combat.
        this.rubberBand = null;

        // Drawn sword, or null when not out. Set by drawEnemySword()
        // in game.js, cleared by EnemySword.sheathe(). The enemy won't
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


    // How fast the enemy is currently closing in on the target, in
    // cells per second - what a collision reaction uses as "the
    // enemy's speed".
    get speed() {
        return this.inCombat() ? Math.max(0, -this.push.speed) : Enemy.PATROL_SPEED;
    }


    inCombat() {
        return this.rubberBand !== null && this.rubberBand.engaged();
    }


    // Same row as a living target.
    isChasing() {
        return this.target && this.target.alive !== false && this.target.y === this.y;
    }


    // One game tick of decision making. In combat, the rubber band
    // alone moves the enemy; it just keeps facing the target.
    // Otherwise: while pushed, the push alone moves it and it slowly
    // recovers; else it patrols.
    update(dt) {

        this.swordCooldown = Math.max(0, this.swordCooldown - dt);

        if (this.inCombat()) {
            this.mover.setVelocity(0, 0);
            this.direction = this.rubberBand.towardOther(this) || this.direction;
            return;
        }

        if (this.push.active()) {
            this.mover.setVelocity(0, 0);

            this.push.recoverOverTime(
                dt,
                Enemy.PUSH_RECOVER_INTERVAL,
                Enemy.PUSH_RECOVER_AMOUNT
            );
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


    // Movement rule for the enemy's steps while not pushed: on the
    // target's row, it never moves onto or past the target.
    allowsStep(x) {

        if (!this.isChasing()) {
            return true;
        }

        return (x - this.target.x) * this.direction < 0;
    }
}
