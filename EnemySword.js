// The enemy's sword: a "-" one tile in front of the enemy, on
// whichever side it's currently heading. Drawn and put away by
// drawEnemySword()/sheathEnemySword() in game.js. Glued to the
// enemy via getters, like the player's Sword/Shield, so it moves
// along while the enemy keeps closing in.
class EnemySword {

    constructor(enemy) {
        this.enemy = enemy;
        this.z = 25;
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
