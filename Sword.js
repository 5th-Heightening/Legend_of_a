// One-shot sword swing, one tile in front of the player. Starts
// as "/" or "\", switches to "_" partway through, then removes
// itself. Glued to the player via getters, like Shield - x/y and
// the slash direction track the player's current position/facing
// rather than freezing at swing start.
class Sword {

    constructor(player) {
        this.player = player;
        this.z = 25;

        // Flips from "slash" to "dash" partway through the swing -
        // see SWORD_FRAME_DURATION in game.js.
        this.frame = "slash";
    }


    get x() {
        const offset = this.player.facing === "left" ? -1 : 1;
        return this.player.x + offset;
    }


    get y() {
        return this.player.y;
    }


    getAscii() {

        if (this.frame === "dash") {
            return "_";
        }

        return this.player.facing === "left" ? "\\" : "/";
    }
}
