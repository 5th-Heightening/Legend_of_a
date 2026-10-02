// Which of the two fighters has the initiative. Only one side holds
// it at a time; give() hands it over. Shown as a MARK above the
// holder, glued to it via getters like the weapons, so it moves
// along. Hidden while the holder is dead.
class Initiative {

    static MARK = "!";

    // Where the mark shows, relative to the holder (in cells).
    static MARK_DX = 0;
    static MARK_DY = -1;


    constructor(holder) {
        this.holder = holder;
        this.z = 24;
    }


    give(character) {
        this.holder = character;
    }


    has(character) {
        return this.holder === character;
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
