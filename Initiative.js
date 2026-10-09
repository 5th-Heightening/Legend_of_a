// Which of the two fighters has the initiative. Only one side holds
// it at a time; give()/swap() hand it over. Shown as a MARK above the
// holder's head, glued to it via getters like the weapons, so it
// moves along. Hidden while the holder is dead.
class Initiative {

    static MARK = "!";

    // Where the mark shows, relative to the holder (in cells).
    static MARK_DX = 0;
    static MARK_DY = -1;


    // `a` and `b` are the two fighters; `a` starts with the
    // initiative.
    constructor(a, b) {
        this.a = a;
        this.b = b;
        this.holder = a;
        this.z = 24;
    }


    has(fighter) {
        return this.holder === fighter;
    }


    // Hands the initiative over to the other fighter.
    swap() {
        this.holder = this.holder === this.a ? this.b : this.a;
    }


    get x() {
        return this.holder.x + Initiative.MARK_DX;
    }


    get y() {
        return this.holder.y + Initiative.MARK_DY;
    }


    getAscii() {
        return this.holder.alive === false ? "" : Initiative.MARK;
    }
}
