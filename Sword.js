// One-shot sword swing, one tile in front of the player, held in one
// of the POSITIONS ("/", "\" or "-") for `duration` ms - counted in
// game ticks (see update()). The enemy's sword uses the same
// positions (see EnemySword.js); whether both match decides a sword
// clash (see checkEnemyEncounter() in game.js). Glued to the player
// via getters, like Shield - x/y track the player's current
// position/facing rather than freezing at swing start.
class Sword {

    static POSITIONS = ["/", "\\", "-"];

    // The fighters face each other, so one's "/" is the other's "\":
    // two positions match when one is the mirror image of the other.
    static MIRRORED = { "/": "\\", "\\": "/", "-": "-" };


    static matches(a, b) {
        return Sword.MIRRORED[a] === b;
    }


    constructor(player, position, duration) {
        this.player = player;
        this.z = 25;

        this.position = position;
        this.duration = duration;

        // Time this swing has been out, in ms of game ticks.
        this.elapsed = 0;

        this.alive = true;
    }


    // Looks at how long the swing has been out *before* counting
    // this tick, so it's visible for exactly `duration`.
    update(dt) {

        if (this.elapsed >= this.duration) {
            this.alive = false;

            if (this.player.sword === this) {
                this.player.sword = null;
            }

            return;
        }

        this.elapsed += dt;
    }


    get x() {
        const offset = this.player.facing === "left" ? -1 : 1;
        return this.player.x + offset;
    }


    get y() {
        return this.player.y;
    }


    getAscii() {
        return this.position;
    }
}
