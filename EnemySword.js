// The enemy's sword: a Sword (see Sword.js) whose owner is the enemy,
// so it uses the same frames as the player's - a thrust, or a swing
// from above or below. Started by updateEnemySword() in game.js.
// Once put away, the enemy can't draw again for `cooldown` ms.
class EnemySword extends Sword {

    constructor(enemy, frames, frameDuration, holdDuration, cooldown) {
        super(enemy, frames, frameDuration, holdDuration);

        this.cooldown = cooldown;
    }


    putAway() {

        if (this.alive && this.owner.sword === this) {
            this.owner.swordCooldown = this.cooldown;
        }

        super.putAway();
    }
}
