// Copies a stance with a delay: copy() remembers the stance, and
// DELAY ms later (counted in game ticks via update()) hands it to
// onCopy. A new copy() before then replaces the stance and starts
// the delay over, so only the latest one is taken. cancel() drops
// whatever is still pending.
//
// Used for the enemy without the initiative: it answers the
// player's stance with the same one (see drawSword() in game.js).
class StanceMirror {

    // Milliseconds between the player choosing a stance and the
    // enemy taking it.
    static DELAY = 250;


    constructor(onCopy) {
        this.onCopy = onCopy;

        // Pending stance, or null.
        this.stance = null;
        this.remaining = 0;
    }


    copy(stance) {
        this.stance = stance;
        this.remaining = StanceMirror.DELAY;
    }


    cancel() {
        this.stance = null;
    }


    update(dt) {

        if (this.stance === null) {
            return;
        }

        this.remaining -= dt;

        if (this.remaining > 0) {
            return;
        }

        const stance = this.stance;
        this.stance = null;
        this.onCopy(stance);
    }
}
