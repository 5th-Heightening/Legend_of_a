// A fighter's stance: an attack or a block, from one of three
// DIRECTIONS - above, below or as a dash (a charge straight ahead).
// Who wins a collision is decided by Clash.js; this class only holds
// the stance and draws it one cell in front of its owner, on the row
// of its direction. Glued to the owner via getters, so it moves and
// turns along. Every collision deletes it (see clearStance() in
// game.js).
//
// Each look's char is written for facing right; facing left it's
// mirrored. A dash stance is held on its owner's own row, so it adds
// reach (see combatParts() in game.js); above/below don't.
//
// The owner needs x, y, facing ("left"/"right") and a stance field.
class Stance {

    static ATTACK = "attack";
    static BLOCK = "block";

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
        this.direction = direction;
        this.z = 25;
    }


    get facing() {
        return this.owner.facing === "left" ? -1 : 1;
    }


    get x() {
        return this.owner.x + this.facing;
    }


    get y() {
        return this.owner.y + Stance.ROWS[this.direction];
    }


    // On its owner's row, i.e. a part that can touch the other side.
    get inFront() {
        return Stance.ROWS[this.direction] === 0;
    }


    getAscii() {
        const char = Stance.CHARS[this.kind][this.direction];
        return this.facing < 0 ? Stance.MIRRORED[char] : char;
    }
}
