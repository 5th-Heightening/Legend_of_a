// Walks back and forth along a fixed row between minX and maxX,
// reversing direction at either end, until its target (the player)
// shares its row - then it stops patrolling and closes in on the
// target instead, slowly accelerating. update() only decides the
// enemy's velocity once per game tick; the MovementSystem moves it.
class Enemy extends MovingObject {

    // Closing-in speed, in cells per second. Starts at
    // APPROACH_START_SPEED and grows by APPROACH_ACCELERATION every
    // second, up to APPROACH_MAX_SPEED.
    static APPROACH_START_SPEED = 1.25;
    static APPROACH_ACCELERATION = 1.5625;
    static APPROACH_MAX_SPEED = 5;

    // Speed while patrolling, in cells per second.
    static PATROL_SPEED = 2.5;

    // The enemy has no input to fight a push with, so it recovers on
    // its own: loses PUSH_RECOVER_AMOUNT (cells per second) of push
    // speed every PUSH_RECOVER_INTERVAL ms.
    static PUSH_RECOVER_INTERVAL = 500;
    static PUSH_RECOVER_AMOUNT = 5;


    constructor(x, y, minX, maxX, target) {
        super(x, y, 15);

        this.minX = minX;
        this.maxX = maxX;

        this.target = target;

        this.direction = 1;

        // Current closing-in speed, 0 while not approaching.
        this.approachSpeed = 0;

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


    // How fast the enemy is currently moving under its own power,
    // in cells per second - what a collision reaction uses as "the
    // enemy's speed".
    get speed() {
        return this.approachSpeed > 0 ? this.approachSpeed : Enemy.PATROL_SPEED;
    }


    // Same row as a living target - combat mode.
    isChasing() {
        return this.target && this.target.alive !== false && this.target.y === this.y;
    }


    // One game tick of decision making. While being pushed, the
    // push alone moves the enemy, and it slowly recovers from it.
    // Otherwise: in combat mode, face and close in on the target;
    // off its row, patrol.
    update(dt) {

        this.swordCooldown = Math.max(0, this.swordCooldown - dt);

        if (this.push.active()) {
            this.stopApproach();
            this.mover.setVelocity(0, 0);

            this.push.recoverOverTime(
                dt,
                Enemy.PUSH_RECOVER_INTERVAL,
                Enemy.PUSH_RECOVER_AMOUNT
            );
            return;
        }

        if (this.isChasing()) {
            this.approach(dt);
            return;
        }

        this.patrol();
    }


    // Speeds up toward the target - it stops right next to the
    // target (see allowsStep()); touching it triggers an encounter.
    approach(dt) {

        if (Math.abs(this.x - this.target.x) <= 1) {
            this.mover.setVelocity(0, 0);
            return;
        }

        const direction = this.target.x < this.x ? -1 : 1;

        // Turning around starts the run-up from scratch.
        if (direction !== this.direction) {
            this.stopApproach();
            this.direction = direction;
        }

        this.approachSpeed = Math.min(
            Math.max(
                this.approachSpeed + Enemy.APPROACH_ACCELERATION * dt / 1000,
                Enemy.APPROACH_START_SPEED
            ),
            Enemy.APPROACH_MAX_SPEED
        );

        this.mover.setVelocity(this.direction * this.approachSpeed, 0);
    }


    patrol() {

        this.stopApproach();

        if (this.x >= this.maxX) {
            this.direction = -1;
        }
        else if (this.x <= this.minX) {
            this.direction = 1;
        }

        this.mover.setVelocity(this.direction * Enemy.PATROL_SPEED, 0);
    }


    stopApproach() {

        if (this.approachSpeed === 0) {
            return;
        }

        this.approachSpeed = 0;
        this.mover.resetOffset();
    }


    // Movement rule for the enemy's own steps (not pushes): while
    // chasing, it never moves onto or past the target.
    allowsStep(x) {

        if (!this.isChasing()) {
            return true;
        }

        return (x - this.target.x) * this.direction < 0;
    }
}
