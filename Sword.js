// One-shot sword swing, one tile in front of the player. Starts
// as "/", switches to "_" partway through, then removes itself.
class Sword {

    constructor(player) {
        this.z = 25;

        const offset = player.facing === "left" ? -1 : 1;

        this.x = player.x + offset;
        this.y = player.y;

        this.char = ((offset == 1) ? "/" : "\\");
    }


    getAscii() {
        return this.char;
    }
}
