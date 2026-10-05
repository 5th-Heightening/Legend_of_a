// Shield held out in front of the player, in whichever direction
// it's currently facing, for `duration` ms - counted in game ticks
// (see update()). Then it's put away (alive = false) and clears
// player.shield itself. While it's up the player is rooted: it
// can't move (see Player.rooted). Glued to the player via getters.
class Shield {

    constructor(player, duration) {
        this.player = player;
        this.z = 25;

        this.duration = duration;
        this.elapsed = 0;

        this.alive = true;
    }


    // Like Sword.update(): visible for exactly `duration`.
    update(dt) {

        if (this.elapsed >= this.duration) {
            this.alive = false;

            if (this.player.shield === this) {
                this.player.shield = null;
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
        return this.player.facing === "left" ? "[" : "]";
    }
}
