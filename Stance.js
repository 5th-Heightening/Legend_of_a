// A fighter's stance: an attack or a block, from one of three
// DIRECTIONS - above, below or as a dash (a charge straight ahead).
// Who wins a collision is decided by Clash.js; this class only holds
// the stance and draws it one cell in front of its owner, on the row
// of its direction. Glued to the owner via getters, so it moves and
// turns along. Every collision deletes it (see clearStance() in
// game.js), and so does its expiry after DURATION.
//
// Each look's char is written for facing right; facing left it's
// mirrored. A dash stance is held on its owner's own row, so it adds
// reach (see combatParts() in game.js); above/below don't.
//
// The owner needs x, y, facing ("left"/"right") and a stance field.
class Stance {

    static ATTACK = "attack";
    static BLOCK = "block";
" ´ - ."
    static KINDS = [Stance.ATTACK, Stance.BLOCK];

    static DIRECTIONS = ["above", "below", "dash"];

    // Non-transitive, like scissors-paper-rock: the key wins against
    // its value. Only decides attack against attack.
    static BEATS = {
        dash: "above",
        above: "below",
        below: "dash"
    };

    // Rows relative to the owner, per direction.
    static ROWS = {
        above: -1,
        below: 1,
        dash: 0
    };

    static CHARS = {
        attack: { above: "/", below: "\\", dash: "-" },
        block: { above: "\\", below: "/", dash: "]" }
    };

    static MIRRORED = { "/": "\\", "\\": "/", "]": "[", "[": "]", "-": "-" };

    // Set up of a swing (an attack with a trail sequence, see
    // Initiative.TRAIL_SEQUENCES): the stance first shows that
    // sequence backwards, one char per SETUP_STEP ms, before its own
    // char. Meanwhile the trail only uses the part of the sequence
    // revealed so far (see setupHidden). A direction change starts
    // the set up over.
    static SETUP_STEP = 150; // 60;

    // Column of the set up chars, in cells in front of the owner
    // (0 = straight above/below it). The finished stance is 1 in front.
    static SETUP_DX = 0;

    // Milliseconds a stance lasts after it was taken; then it expires
    // (see expireStances() in game.js). Until then its owner can't
    // take another one (see setStance() in game.js).
    static DURATION = 1000;

    // Every stance there is, as plain { kind, direction } - e.g. for
    // the enemy to pick from (see EnemyTactics.js).
    static OPTIONS = Stance.KINDS.flatMap(kind =>
        Stance.DIRECTIONS.map(direction => ({ kind, direction }))
    );


    static beats(direction, other) {
        return Stance.BEATS[direction] === other;
    }


    // Any direction but `except`, if given.
    static randomDirection(except = null) {
        const names = Stance.DIRECTIONS.filter(name => name !== except);
        return names[Math.floor(Math.random() * names.length)];
    }


    // `kind` is ATTACK or BLOCK, `direction` one of DIRECTIONS; the
    // direction can be changed while the stance is held.
    constructor(owner, kind, direction) {
        this.owner = owner;
        this.kind = kind;
        this._direction = direction;
        this.z = 25;

        // Time (ms) since the set up started.
        this.setupTime = 0;

        // Time (ms) since the stance was taken.
        this.age = 0;
    }


    get direction() {
        return this._direction;
    }


    set direction(direction) {

        if (direction !== this._direction) {
            this.setupTime = 0;
        }

        this._direction = direction;
    }


    // The chars shown during the set up ("" = none for this stance).
    // Looked up at runtime, as Initiative.js loads after this file.
    get setupSequence() {

        if (this.kind !== Stance.ATTACK) {
            return "";
        }

        return Initiative.TRAIL_SEQUENCES[this.direction] ?? "";
    }


    // How many leading chars of setupSequence aren't revealed yet
    // (0 once the set up is done).
    get setupHidden() {
        const step = Math.floor(this.setupTime / Stance.SETUP_STEP);
        return Math.max(0, this.setupSequence.length - 1 - step);
    }


    get settingUp() {
        return this.setupTime < this.setupSequence.length * Stance.SETUP_STEP;
    }


    // Held for Stance.DURATION already.
    get expired() {
        return this.age >= Stance.DURATION;
    }


    update(dt) {

        this.age += dt;

        if (this.settingUp) {
            this.setupTime += dt;
        }
    }


    get facing() {
        return this.owner.facing === "left" ? -1 : 1;
    }


    // In front of the owner - during the set up on its own column
    // (SETUP_DX), straight above/below it.
    get x() {
        const dx = this.settingUp ? Stance.SETUP_DX : 1;
        return this.owner.x + this.facing * dx;
    }


    get y() {
        return this.owner.y + Stance.ROWS[this.direction];
    }


    // On its owner's row, i.e. a part that can touch the other side.
    get inFront() {
        return Stance.ROWS[this.direction] === 0;
    }


    getAscii() {

        if (this.settingUp) {
            return this.setupSequence[this.setupHidden];
        }

        const char = Stance.CHARS[this.kind][this.direction];
        return this.facing < 0 ? Stance.MIRRORED[char] ?? char : char;
    }
}
