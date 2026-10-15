// Which fighter has the initiative. With Clash.ATTACK_RULE INITIATIVE
// it decides attack against attack in different directions (see
// Clash.js).
//
// After a collision nobody holds it (reset()); the first fighter to
// take an attack stance afterwards claims it (claim()) - a block
// doesn't. Shown as a MARK above
// the holder's head, glued to it via getters, so it moves along.
// Hidden while nobody holds it or the holder is dead.
//
// The holder also leaves a particle trail behind it (spawned by
// game.js, see leaveInitiativeTrail()): one row above it for an above
// attack, one row below for a below attack (both in its own column),
// else on its own row one cell behind it - see trailCell().
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

    // Trail columns, in cells behind the holder, per attack direction
    // (0 = the holder's own column). Any other stance (or none) trails
    // TRAIL_BEHIND cells behind it.
    static TRAIL_COLUMNS = {
        above: 0,
        below: 0
    };
    static TRAIL_BEHIND = 1;

    // Chance per tick to spawn one trail particle, and its speed
    // (cells per second).
    static TRAIL_DENSITY = 0.6;
    static TRAIL_SPEED = 1;

    // Trail particle characters per attack direction (a swing). Any
    // other stance (or none) uses Particle's default sequences.
    static TRAIL_SEQUENCES = {
        above: "|,",
        below: "|'"
    };


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


    // The cell behind the holder the trail starts from, plus the
    // particle sequence to use there (null = default), given the
    // holder's stance ({ kind, direction } or null) - or null while
    // not shown.
    trailCell(stance) {

        if (!this.shown()) {
            return null;
        }

        const backwards = this.holder.facing === "left" ? 1 : -1;
        let behind = Initiative.TRAIL_BEHIND;
        let dy = 0;
        let sequence = null;

        if (stance && stance.kind === Stance.ATTACK) {
            behind = Initiative.TRAIL_COLUMNS[stance.direction] ?? behind;
            dy = Initiative.TRAIL_ROWS[stance.direction] ?? 0;
            sequence = Initiative.TRAIL_SEQUENCES[stance.direction] ?? null;

            // Mid set up only the part the stance shows so far (see
            // Stance.setupHidden).
            if (sequence && stance.setupHidden) {
                sequence = sequence.slice(stance.setupHidden);
            }
        }

        return { x: this.holder.x + backwards * behind, y: this.holder.y + dy, sequence };
    }


    get x() {
        return this.shown() ? this.holder.x + Initiative.MARK_DX : 0;
    }


    get y() {
        return this.shown() ? this.holder.y + Initiative.MARK_DY : 0;
    }


    getAscii() {
        // DEBUG: Show no mark, as the particle trail is already an indicator
        return "";
        return this.shown() ? Initiative.MARK : "";
    }
}
