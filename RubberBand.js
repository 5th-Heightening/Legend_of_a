// Fencing as a rubber band: while two fighters are in combat - on
// the same row or at most COMBAT_ROW_DISTANCE rows apart - both are
// accelerated toward each other with a constant ATTRACTION. Neither
// has a drive of its own then; all horizontal motion is the one
// velocity of each fighter's Mover:
// - moving away from the other (after a hit) is braked by the pull
// - once it turns, the fighter swings back toward the other; the
//   pull alone accelerates it up to MAX_PULL_SPEED
// A collision (see checkEnemyEncounter() in game.js) recalculates
// both velocities from the current ones. Outside of combat the pull
// lets go, and the velocity just brakes (see Enemy.js and
// PlayerController.js).
class RubberBand {

    static COMBAT_ROW_DISTANCE = 1;

    // Cells per second, per second.
    static ATTRACTION = 14.4;

    // Cells per second - the fastest the pull alone moves a fighter
    // toward the other one. It never brakes a faster approach (e.g.
    // from the player's own impulse).
    static MAX_PULL_SPEED = 8;


    constructor(a, b) {
        this.a = a;
        this.b = b;
    }


    engaged() {
        return this.a.alive !== false && this.b.alive !== false &&
            Math.abs(this.a.y - this.b.y) <= RubberBand.COMBAT_ROW_DISTANCE;
    }


    // Direction (-1/1) from one fighter toward the other, 0 while
    // they stand in the same column (possible one row apart).
    towardOther(fighter) {
        const other = fighter === this.a ? this.b : this.a;
        return Math.sign(other.x - fighter.x);
    }


    // The fighter's speed toward the other one - negative while
    // flying apart.
    speedToward(fighter) {
        return fighter.velocityX * this.towardOther(fighter);
    }


    // Called every tick, before movement.
    update(dt) {

        if (!this.engaged()) {
            return;
        }

        this.pull(this.a, dt);
        this.pull(this.b, dt);
    }


    pull(fighter, dt) {

        const velocity = fighter.velocityX;
        const pulled = RubberBand.pulledVelocity(velocity, this.towardOther(fighter), dt);

        fighter.mover.accelerate(pulled - velocity);
    }


    // The velocity after one tick of pull toward direction `toward`
    // (-1/1; 0 = same column, no pull). Also used to predict contact,
    // see ContactPredictor.js.
    static pulledVelocity(velocity, toward, dt) {

        if (toward === 0) {
            return velocity;
        }

        const speed = velocity * toward;

        if (speed >= RubberBand.MAX_PULL_SPEED) {
            return velocity;
        }

        const pulled = Math.min(
            speed + RubberBand.ATTRACTION * dt / 1000,
            RubberBand.MAX_PULL_SPEED
        );

        return pulled * toward;
    }
}
