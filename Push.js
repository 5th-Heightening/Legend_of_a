// Knockback state, one per Mover (see Mover.js): a speed (cells per
// second, horizontal only, may be fractional) and a direction
// (-1/1). speed of 0 means not currently pushed. Push only holds the
// knockback and how it wears off - actually moving the owner is the
// Mover's job, and deciding what a collision while pushed means is
// done in game.js.
class Push {

    // How the owner's own horizontal input changes how fast the push
    // wears off (see wearOff()): pushing against it ("digging in")
    // wears it off DIG_IN_FACTOR times faster, going along with it
    // ("riding it") at RIDE_FACTOR.
    static DIG_IN_FACTOR = 4;
    static RIDE_FACTOR = 1;


    constructor() {
        this.speed = 0;
        this.direction = 0;

        // Milliseconds accumulated toward shaving speed off - see
        // recoverOverTime().
        this.recoverTime = 0;
    }


    active() {
        return this.speed > 0;
    }


    // Signed speed in cells per second, 0 while stopped. In combat the
    // speed may also be negative - moving against `direction`, see
    // RubberBand.js.
    get velocity() {
        return this.direction * this.speed;
    }


    // True if horizontal input dx (-1/0/1) pushes back against an
    // active push.
    isAgainst(dx) {
        return this.active() && dx !== 0 && dx === -this.direction;
    }


    // True if horizontal input dx (-1/0/1) goes along with an active
    // push.
    isAlong(dx) {
        return this.active() && dx !== 0 && dx === this.direction;
    }


    start(direction, speed) {
        this.direction = direction;
        this.speed = speed;
        this.recoverTime = 0;
    }


    // Keeps the velocity, but measures it along `direction` from now
    // on - the speed flips sign if the direction flips.
    orient(direction) {

        if (direction === this.direction) {
            return;
        }

        if (this.direction !== 0) {
            this.speed = -this.speed;
        }
        else {
            this.speed = 0;
        }

        this.direction = direction;
    }


    // Adds a signed velocity (cells per second). The speed may drop
    // below 0, i.e. turn against `direction`.
    addVelocity(velocity) {

        if (this.direction === 0) {
            this.direction = Math.sign(velocity);
            this.speed = Math.abs(velocity);
            return;
        }

        this.speed += velocity * this.direction;
    }


    stop() {
        this.speed = 0;
        this.direction = 0;
        this.recoverTime = 0;
    }


    // Time-based recovery, scaled by the owner's horizontal input dx
    // (-1/0/1): against the push digs in (DIG_IN_FACTOR), along it
    // rides it (RIDE_FACTOR), no input recovers at the normal pace.
    wearOff(elapsedMs, dx, msPerStep, amount) {
        let factor = 1;

        if (this.isAgainst(dx)) {
            factor = Push.DIG_IN_FACTOR;
        }
        else if (this.isAlong(dx)) {
            factor = Push.RIDE_FACTOR;
        }

        this.recoverOverTime(elapsedMs * factor, msPerStep, amount);
    }


    // Time-based recovery: every msPerStep of elapsedMs accumulated,
    // shaves `amount` off speed. The leftover time carries over, so
    // the pace stays exact even if elapsedMs doesn't divide msPerStep.
    recoverOverTime(elapsedMs, msPerStep, amount) {
        this.recoverTime += elapsedMs;

        while (this.active() && this.recoverTime >= msPerStep) {
            this.recoverTime -= msPerStep;
            this.loseSpeed(amount);
        }
    }


    // Drops speed by amount, stop()ping outright once it bottoms out.
    loseSpeed(amount) {
        this.speed -= amount;

        if (this.speed <= 0) {
            this.stop();
        }
    }
}
