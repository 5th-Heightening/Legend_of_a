// Which fighter has the initiative. With Clash.ATTACK_RULE INITIATIVE
// it decides attack against attack in different directions (see
// Clash.js).
//
// After a collision nobody holds it (reset()); the first fighter to
// take a stance afterwards claims it (claim()). Shown as a MARK above
// the holder's head, glued to it via getters, so it moves along.
// Hidden while nobody holds it or the holder is dead.
//
// The holder also leaves a particle trail behind it (spawned by
// game.js, see leaveInitiativeTrail()): one row above it for an above
// attack, one row below for a below attack, else on its own row - see
// trailCell().
class Initiative {

    static MARK = "!";

    // Where the mark shows, relative to the holder (in cells).
    static MARK_DX = 0;
    static MARK_DY = -1;

    // Trail rows relative to the holder, per attack direction. Any
    // other stance (or none) trails on the holder's own row.
    static TRAIL_ROWS = {
        above: -1,
        below: 1
    };

    // Chance per tick to spawn one trail particle, and its speed
    // (cells per second).
    static TRAIL_DENSITY = 0.6;
    static TRAIL_SPEED = 1;


    constructor() {
        this.holder = null;
        this.z = 24;
    }


    has(fighter) {
        return this.holder === fighter;
    }


    // `fighter` takes a stance: it gets the initiative, unless someone
    // holds it already.
    claim(fighter) {
        if (this.holder === null) {
            this.holder = fighter;
        }
    }


    // After a collision: nobody holds it.
    reset() {
        this.holder = null;
    }


    shown() {
        return this.holder !== null && this.holder.alive !== false;
    }


    // The cell behind the holder the trail starts from, given the
    // holder's stance ({ kind, direction } or null) - or null while
    // not shown.
    trailCell(stance) {

        if (!this.shown()) {
            return null;
        }

        const behind = this.holder.facing === "left" ? 1 : -1;
        let dy = 0;

        if (stance && stance.kind === Stance.ATTACK) {
            dy = Initiative.TRAIL_ROWS[stance.direction] ?? 0;
        }

        return { x: this.holder.x + behind, y: this.holder.y + dy };
    }


    get x() {
        return this.shown() ? this.holder.x + Initiative.MARK_DX : 0;
    }


    get y() {
        return this.shown() ? this.holder.y + Initiative.MARK_DY : 0;
    }


    getAscii() {
        return this.shown() ? Initiative.MARK : "";
    }
}
