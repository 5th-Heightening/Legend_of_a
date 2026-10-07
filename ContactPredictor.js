// Predicts when two fighters will touch, by running a copy of each
// fighter's Mover forward, tick by tick - the same math the game
// itself uses. Fractional speeds, half-crossed cells and the end of a
// push or dash all come out exactly as they will play out, as long as
// nobody presses a key, changes speed or runs into something in the
// meantime.
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

            ContactPredictor.step(simA, dt);
            ContactPredictor.step(simB, dt);
        }

        return null;
    }


    static snapshot(fighter) {
        return {
            x: fighter.x,
            mover: fighter.mover.clone()
        };
    }


    // One tick of movement for one fighter (see Mover.advance()).
    static step(fighter, dt) {
        fighter.x += fighter.mover.advance(dt).dx;
    }
}
