// The enemy's sword: a "-" one tile in front of the enemy, on
// whichever side it's currently heading. Drawn by drawEnemySword()
// in game.js; put away again by sheathe() after `duration` ms of game
// ticks, after which the enemy can't draw for `cooldown` ms. Glued
// to the enemy via getters, like the player's Sword/Shield, so it
// moves along while the enemy keeps closing in.
class EnemySword {

    constructor(enemy, duration, cooldown) {
        this.enemy = enemy;
        this.z = 25;

        this.duration = duration;
        this.cooldown = cooldown;
        this.elapsed = 0;

        this.alive = true;
    }


    update(dt) {

        this.elapsed += dt;

        if (this.elapsed >= this.duration) {
            this.sheathe();
        }
    }


    sheathe() {

        if (!this.alive) {
            return;
        }

        this.alive = false;

        if (this.enemy.sword === this) {
            this.enemy.sword = null;
            this.enemy.swordCooldown = this.cooldown;
        }
    }


    get x() {
        return this.enemy.x + this.enemy.direction;
    }


    get y() {
        return this.enemy.y;
    }


    getAscii() {
        return "-";
    }
}
