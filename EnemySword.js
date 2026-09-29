// The enemy's sword, in two phases:
// - "windup": the enemy lifts it - a "|" at WINDUP_DX/WINDUP_DY
//   from the enemy (below it, by default) for `windup` ms. Only a
//   warning for the player; it doesn't touch or hit anything yet.
// - "strike": a "-" one tile in front of the enemy, on whichever
//   side it's currently heading, for `duration` ms. Only now does it
//   count in combat (see drawn).
// Started by updateEnemySword() in game.js; put away again by
// sheathe() at the end of the strike, after which the enemy can't
// draw for `cooldown` ms. Glued to the enemy via getters, like the
// player's Sword/Shield, so it moves along while the enemy keeps
// closing in.
class EnemySword {

    // Where the lifted sword shows during the windup, relative to
    // the enemy (in cells, WINDUP_DX along the enemy's direction).
    static WINDUP_DX = 0;
    static WINDUP_DY = -1;

    static WINDUP_CHAR = "|";
    static STRIKE_CHAR = "-";


    constructor(enemy, windup, duration, cooldown) {
        this.enemy = enemy;
        this.z = 25;

        this.windup = windup;
        this.duration = duration;
        this.cooldown = cooldown;
        this.elapsed = 0;

        this.alive = true;
    }


    update(dt) {

        this.elapsed += dt;

        if (this.elapsed >= this.windup + this.duration) {
            this.sheathe();
        }
    }


    get phase() {
        return this.elapsed < this.windup ? "windup" : "strike";
    }


    // True once the sword is actually out (striking) - only then
    // does it count as a combat part and as "sword drawn".
    get drawn() {
        return this.alive && this.phase === "strike";
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
        const dx = this.drawn ? 1 : EnemySword.WINDUP_DX;
        return this.enemy.x + this.enemy.direction * dx;
    }


    get y() {
        return this.enemy.y + (this.drawn ? 0 : EnemySword.WINDUP_DY);
    }


    getAscii() {
        return this.drawn ? EnemySword.STRIKE_CHAR : EnemySword.WINDUP_CHAR;
    }
}
