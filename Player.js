class Player extends MovingObject {

    // A push back: how many cells, how fast (cells per second).
    static PUSHBACK_SPAN = 4;
    static PUSHBACK_SPEED = 15;

    // How long it stands still after a push back, in ms.
    static RECOVERY_DELAY = 200;

    // Speed it runs at the enemy with in combat, in cells per second
    // - see PlayerController.approach().
    static ATTACK_SPEED = 4;


    constructor(x, y) {
        super(x, y, 20);

        // Time left standing still after a push back, in ms.
        this.recoveryTime = 0;

        // Last horizontal direction faced, kept even while
        // moving vertically or standing still.
        this.facing = "right";

        // Currently-equipped weapons, or null when not out. Set by
        // dash()/swing()/raiseShield() in game.js; both clear
        // themselves once their time is up (see Sword.js, Shield.js).
        this.sword = null;
        this.shield = null;

        // Decorative letter string while "Q" is held, or null - see
        // startSquiggle()/stopSquiggle() in game.js.
        this.squiggle = null;

        // Flips to false once a push carries it into the
        // environment/border - see killPlayer() in game.js.
        this.alive = true;
    }


    // Lost an encounter: flies back PUSHBACK_SPAN cells, then
    // recovers for RECOVERY_DELAY.
    pushBack(direction) {
        this.startPush(direction, Player.PUSHBACK_SPAN, Player.PUSHBACK_SPEED);
        this.recoveryTime = Player.RECOVERY_DELAY;
    }


    // Still standing still after a push back - no approach, no steps,
    // no dash.
    get recovering() {
        return this.recoveryTime > 0;
    }


    // The recovery only counts down once the push back is over.
    update(dt) {

        if (!this.pushed) {
            this.recoveryTime = Math.max(0, this.recoveryTime - dt);
        }
    }


    // An action (dash, swing, shield) is still running - no new one
    // can start until it's over.
    get busy() {
        return this.sword !== null || this.shield !== null;
    }


    // Behind the shield the player stands still: no steps.
    get rooted() {
        return this.shield !== null;
    }


    getAscii() {
        return "A";
    }
}
