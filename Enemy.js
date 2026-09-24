// Walks back and forth along a fixed row between minX and maxX,
// reversing direction at either end, until the player shares its
// row - then it stops patrolling and closes in on the player
// instead (see step()). Movement isn't driven by player input -
// see the patrol timer in the game section.
class Enemy {

    constructor(x, y, minX, maxX) {
        this.x = x;
        this.y = y;
        this.z = 15;

        this.minX = minX;
        this.maxX = maxX;

        this.direction = 1;

        // Knockback - see Push.js and the "Push" section in
        // game.js for how this is driven.
        this.push = new Push();

        // Flips to false once knocked into the environment/border
        // - see vanishEnemy() in game.js. A dead enemy is removed
        // from the renderer, so nothing here reads this directly,
        // but game.js checks it before touching the enemy further.
        this.alive = true;
    }


    getAscii() {
        return "E";
    }


    // Advances one tick. While being pushed, the driving loop in
    // game.js moves the enemy directly - step() leaves it alone.
    // Otherwise: if the player is on the same row, combat mode -
    // face and close in on the player instead of patrolling; the
    // two sides meeting triggers checkEnemyEncounter() in game.js.
    // Off that row, resume the normal left/right patrol.
    step(player) {

        if (this.push.active()) {
            return;
        }

        if (player && player.y === this.y) {

            if (this.x === player.x) {
                return;
            }

            this.direction = player.x < this.x ? -1 : 1;
            this.x += this.direction;
            return;
        }

        this.x += this.direction;

        if (this.x >= this.maxX) {
            this.x = this.maxX;
            this.direction = -1;
        }
        else if (this.x <= this.minX) {
            this.x = this.minX;
            this.direction = 1;
        }
    }
}
