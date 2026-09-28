// Knockback state, one per Mover (see Mover.js): a speed (cells per
// second, horizontal only, may be fractional) and a direction
// (-1/1). speed of 0 means not currently pushed. Push only holds the
// knockback and how it wears off - actually moving the owner is the
// Mover's job, and deciding what a collision while pushed means is
// done in game.js.
class Push {

    constructor() {
        this.speed = 0;
        this.direction = 0;

        // Recovery keypresses accumulated toward shaving speed off -
        // see recoverStep().
        this.recoverProgress = 0;

        // Milliseconds accumulated toward shaving speed off - see
        // recoverOverTime().
        this.recoverTime = 0;
    }


    active() {
        return this.speed > 0;
    }


    // Signed speed in cells per second, 0 while not pushed.
    get velocity() {
        return this.active() ? this.direction * this.speed : 0;
    }


    start(direction, speed) {
        this.direction = direction;
        this.speed = speed;
        this.recoverProgress = 0;
        this.recoverTime = 0;
    }


    stop() {
        this.speed = 0;
        this.direction = 0;
        this.recoverProgress = 0;
        this.recoverTime = 0;
    }


    // One recovery keypress. Once pressesPerPoint of these have
    // accumulated, shaves `amount` off speed and resets the counter -
    // stop()s outright once speed bottoms out.
    // `weight` is how much this press counts - 1 for a real press,
    // less for weaker input (e.g. a held key's repeat tick).
    recoverStep(pressesPerPoint, weight, amount) {
        this.recoverProgress += weight;

        if (this.recoverProgress >= pressesPerPoint) {
            this.recoverProgress = 0;
            this.loseSpeed(amount);
        }
    }


    // Time-based recovery, for owners with no keys to fight the
    // push with: every msPerStep of elapsedMs accumulated, shaves
    // `amount` off speed. The leftover time carries over, so the
    // pace stays exact even if elapsedMs doesn't divide msPerStep.
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
