// Shield held out in front of the player, in whichever
// direction it's currently facing. Stays glued to the player
// via getters, since it's shown for as long as a key is held
// rather than for a fixed duration.
class Shield {

    constructor(player) {
        this.player = player;
        this.z = 25;
    }


    get x() {
        const offset = this.player.facing === "left" ? -1 : 1;
        return this.player.x + offset;
    }


    get y() {
        return this.player.y;
    }


    getAscii() {
        return this.player.facing === "left" ? "[" : "]";
    }
}
