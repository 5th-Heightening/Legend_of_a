// Predicts when two fighters in combat will touch, by running the
// rubber band's pull and the Mover's cell stepping forward, tick by
// tick - the same math the game itself uses. Fractional speeds, the
// pull's speed cap and half-crossed cells all come out exactly as
// they will play out, as long as nobody presses a key or runs into
// something in the meantime.
class ContactPredictor {

    // How far ahead (ms) to look before giving up.
    static LOOKAHEAD = 3000;


    constructor(tickInterval) {
        this.tickInterval = tickInterval;
    }


    // Milliseconds until the front of `a` (reachA cells ahead of it,
    // toward b) and the front of `b` (reachB cells ahead) are at most
    // contactDistance cells apart. 0 if they already are, null if they
    // aren't on the same row or won't touch within LOOKAHEAD.
    timeToContact(a, reachA, b, reachB, contactDistance) {

        if (a.y !== b.y) {
            return null;
        }

        const side = Math.sign(b.x - a.x);

        if (side === 0) {
            return null;
        }

        const simA = ContactPredictor.snapshot(a);
        const simB = ContactPredictor.snapshot(b);
        const dt = this.tickInterval;

        // Distance between the fronts, negative once they'd cross.
        const gap = () => (simB.x - simA.x) * side - reachA - reachB;

        for (let time = 0; time <= ContactPredictor.LOOKAHEAD; time += dt) {

            if (gap() <= contactDistance) {
                return time;
            }

            ContactPredictor.step(simA, simB, dt);
            ContactPredictor.step(simB, simA, dt);
        }

        return null;
    }


    static snapshot(fighter) {
        return {
            x: fighter.x,
            offsetX: fighter.mover.offsetX,
            velocityX: fighter.mover.velocityX,
            rooted: fighter.rooted === true
        };
    }


    // One tick for one fighter: the pull toward the other one, then
    // the movement (see RubberBand.pull() and Mover.advance()).
    static step(fighter, other, dt) {

        if (fighter.rooted) {
            return;
        }

        const toward = Math.sign(other.x - fighter.x);

        fighter.velocityX = RubberBand.pulledVelocity(fighter.velocityX, toward, dt);

        fighter.offsetX += fighter.velocityX * dt / 1000;

        const cells = Mover.wholeCells(fighter.offsetX);

        fighter.offsetX -= cells;
        fighter.x += cells;
    }
}
