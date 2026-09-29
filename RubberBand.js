// Fencing as a rubber band: while two fighters are in combat - on
// the same row or at most COMBAT_ROW_DISTANCE rows apart - both are
// pulled toward each other with a constant ATTRACTION. Neither has
// a drive of its own then; all horizontal motion is one speed per
// fighter, kept in its Push (see Push.js):
// - Push.direction always points away from the other fighter
// - a positive speed flies apart (a push), the pull brakes it
// - once it drops below 0 the fighter swings back toward the other,
//   up to MAX_PULL_SPEED
// A hit (see checkEnemyEncounter() in game.js) just sets the speed
// away again. Outside of combat the pull lets go: any speed toward
// the other fighter is dropped, a push wears off as before.
class RubberBand {

    static COMBAT_ROW_DISTANCE = 1;

    // Cells per second, per second.
    static ATTRACTION = 12;

    // Cells per second - the fastest the pull alone moves a fighter
    // toward the other one.
    static MAX_PULL_SPEED = 8;


    constructor(a, b) {
        this.a = a;
        this.b = b;
    }


    engaged() {
        return this.a.alive !== false && this.b.alive !== false &&
            Math.abs(this.a.y - this.b.y) <= RubberBand.COMBAT_ROW_DISTANCE;
    }


    // Direction (-1/1) from one fighter toward the other, 0 while
    // they stand in the same column (possible one row apart).
    towardOther(fighter) {
        const other = fighter === this.a ? this.b : this.a;
        return Math.sign(other.x - fighter.x);
    }


    // Called every tick, before movement.
    update(dt) {

        const engaged = this.engaged();

        for (const fighter of [this.a, this.b]) {
            if (engaged) {
                this.pull(fighter, dt);
            }
            else {
                RubberBand.letGo(fighter);
            }
        }
    }


    pull(fighter, dt) {

        const toward = this.towardOther(fighter);

        // Same column: no horizontal pull this tick.
        if (toward === 0) {
            return;
        }

        const push = fighter.push;

        push.orient(-toward);
        push.addVelocity(toward * RubberBand.ATTRACTION * dt / 1000);
        push.speed = Math.max(push.speed, -RubberBand.MAX_PULL_SPEED);
    }


    static letGo(fighter) {
        if (fighter.push.speed < 0) {
            fighter.push.stop();
        }
    }
}
