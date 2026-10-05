// The enemy's sword: one tile in front of the enemy, on whichever
// side it's currently heading, for `duration` ms. Every attack picks
// one of the POSITIONS at random, and switches to another one at
// random every `positionInterval` ms while the sword is out.
// Started by updateEnemySword() in game.js; put away again by
// sheathe() at the end of the strike, after which the enemy can't
// draw for `cooldown` ms. Glued to the enemy via getters, like the
// player's Sword/Shield, so it moves along while the enemy keeps
// closing in.
class EnemySword {

    static POSITIONS = ["/", "\\", "-"];


    constructor(enemy, duration, cooldown, positionInterval) {
        this.enemy = enemy;
        this.z = 25;

        this.duration = duration;
        this.cooldown = cooldown;
        this.elapsed = 0;

        this.positionInterval = positionInterval;
        this.positionTime = 0;

        this.position = this.randomPosition();

        this.alive = true;
    }


    update(dt) {

        this.elapsed += dt;

        if (this.elapsed >= this.duration) {
            this.sheathe();
            return;
        }

        this.positionTime += dt;

        if (this.positionTime >= this.positionInterval) {
            this.positionTime -= this.positionInterval;
            this.position = this.randomPosition(this.position);
        }
    }


    // A random sword position other than `current` (if given).
    randomPosition(current = null) {
        const choices = EnemySword.POSITIONS.filter(position => position !== current);
        return choices[Math.floor(Math.random() * choices.length)];
    }


    // True while the sword is out - it counts as a combat part and
    // as "sword drawn".
    get drawn() {
        return this.alive;
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
        return this.position;
    }
}
