// A fighter's sword, held in one of two STANCES: one cell in front
// of its owner (player or enemy), on the row above or below it. No
// swing and no timing - it's out the moment it's drawn and stays
// until the next encounter puts it away (see sheatheSword() in
// game.js). Glued to the owner via getters, like Shield, so it moves
// and turns along.
//
// Each stance's char is written for facing right; facing left it's
// mirrored, so the blade always reads as a diagonal line pointing
// away from the owner.
//
// The owner needs x, y, facing ("left"/"right") and a sword field.
class Sword {

    static STANCES = {
        above: { dy: -1, char: "/" },
        below: { dy: 1, char: "\\" }
    };

    static STANCE_NAMES = Object.keys(Sword.STANCES);

    static MIRRORED = { "/": "\\", "\\": "/" };


    static randomStance() {
        const names = Sword.STANCE_NAMES;
        return names[Math.floor(Math.random() * names.length)];
    }


    // `stance` is one of STANCE_NAMES; it can be changed while the
    // sword is out.
    constructor(owner, stance) {
        this.owner = owner;
        this.z = 25;

        this.stance = stance;
    }


    get facing() {
        return this.owner.facing === "left" ? -1 : 1;
    }


    get x() {
        return this.owner.x + this.facing;
    }


    get y() {
        return this.owner.y + Sword.STANCES[this.stance].dy;
    }


    getAscii() {
        const char = Sword.STANCES[this.stance].char;
        return this.facing < 0 ? Sword.MIRRORED[char] : char;
    }
}
