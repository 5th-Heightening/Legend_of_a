// The set up before the player's sword is out: a CHAR straight above
// the owner for the "above" stance, straight below it for "below".
// Glued to the owner via getters, like Sword. After DURATION ms
// (counted in game ticks via update()) it expires and hands its
// stance to onDone, which draws the actual sword (see drawSword() in
// game.js). The stance can still be changed while it runs; the time
// left stays the same.
//
// Drawn above Initiative (higher z), so it covers the "!" while it's
// shown.
class SwordWindup {

    static DURATION = 125;

    static CHAR = "|";

    // Rows relative to the owner, per stance.
    static OFFSETS = {
        above: -1,
        below: 1
    };


    constructor(owner, stance, onDone) {
        this.owner = owner;
        this.stance = stance;
        this.onDone = onDone;
        this.z = 26;

        this.remaining = SwordWindup.DURATION;
        this.alive = true;
    }


    get x() {
        return this.owner.x;
    }


    get y() {
        return this.owner.y + SwordWindup.OFFSETS[this.stance];
    }


    update(dt) {

        if (!this.alive) {
            return;
        }

        this.remaining -= dt;

        if (this.remaining > 0) {
            return;
        }

        // Dropped from the world by World.update() right after this.
        this.alive = false;
        this.onDone(this.stance);
    }


    getAscii() {
        return SwordWindup.CHAR;
    }
}
