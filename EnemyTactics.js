// The enemy's fencing in combat: which attack stance it takes, and
// when. Runs once per game tick (see tick() in game.js), only while
// the two are in combat (see RubberBand.engaged()).
//
// After every collision (reset()) the enemy waits STANCE_DELAY, then
// takes an attack stance in a random direction (see
// Stance.DIRECTIONS) - and keeps it until the next collision, or
// until it expires (Stance.DURATION, also calls reset()). Taking
// it sends the enemy toward the player (see steerAttackers() in
// game.js).
//
// The stance itself is set by game.js, through the hook
// attack(direction).
class EnemyTactics {

    // Milliseconds between a collision and the enemy's next stance.
    static STANCE_DELAY = 500;


    constructor(enemy, rubberBand, hooks) {
        this.enemy = enemy;
        this.rubberBand = rubberBand;
        this.hooks = hooks;

        this.reset();
    }


    // Starts over after a collision: a new stance after STANCE_DELAY.
    reset() {
        // Time until the next stance; 0 = none pending.
        this.wait = EnemyTactics.STANCE_DELAY;
    }


    update(dt) {

        if (this.enemy.alive === false || !this.rubberBand.engaged()) {
            return;
        }

        if (this.wait <= 0) {
            return;
        }

        this.wait -= dt;

        if (this.wait <= 0) {
            this.wait = 0;
            this.hooks.attack(Stance.randomDirection());
        }
    }
}
