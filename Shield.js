// Shield held out in front of the player, in whichever
// direction it's currently facing. Stays glued to the player
// via getters, so it turns along.
//
// It lasts DURATION ms (counted in game ticks via update()), then
// expires and calls onExpire - unless game.js takes it down earlier
// (see hideShield()). While it's up the player can't move (see
// PlayerController.update() and tick() in game.js).
class Shield {

    static DURATION = 750;


    constructor(player, onExpire) {
        this.player = player;
        this.onExpire = onExpire;
        this.z = 25;

        this.remaining = Shield.DURATION;
        this.alive = true;
    }


    get x() {
        const offset = this.player.facing === "left" ? -1 : 1;
        return this.player.x + offset;
    }


    get y() {
        return this.player.y;
    }


    update(dt) {

        if (!this.alive) {
            return;
        }

        this.remaining -= dt;

        if (this.remaining > 0) {
            return;
        }

        // Dropped from the world by World.update() right after this.
        this.alive = false;
        this.onExpire();
    }


    getAscii() {
        return this.player.facing === "left" ? "[" : "]";
    }
}
