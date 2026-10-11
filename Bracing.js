// Bracing for a block: a fighter brakes its speed toward the other
// one, and once it has stopped, it can take its block stance. Shared
// by the player (arrow key against the enemy, see
// PlayerController.js) and the enemy (see EnemyTactics.js).
//
// The rubber band (see RubberBand.js) keeps pulling meanwhile, so
// BRAKE has to be well above RubberBand.ATTRACTION. Flying away from
// the other one (after a push) isn't braked - the pull does that
// already; the fighter stops once the pull has turned it around.
class Bracing {

    // Cells per second, per second.
    static BRAKE = 60;


    // One tick of bracing. `toward` is the direction (-1/0/1) from
    // the fighter to the other one. Returns true once the fighter
    // stands still - then it's stopped for good (mover.stop()).
    static brace(fighter, toward, dt) {

        const mover = fighter.mover;
        const speed = mover.velocityX * toward;
        const brake = Bracing.BRAKE * dt / 1000;

        if (speed > brake) {
            mover.accelerate(-toward * brake);
            return false;
        }

        if (speed < 0) {
            return false;
        }

        mover.stop();
        return true;
    }
}
