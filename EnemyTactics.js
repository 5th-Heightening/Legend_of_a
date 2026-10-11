// The enemy's fencing in combat: which stance it takes, and when.
// Runs once per game tick (see tick() in game.js), only while the
// rubber band holds the two in combat.
//
// After every collision (reset()) the enemy waits DECISION_DELAY,
// then picks a stance (see choose()):
// - with COUNTER_CHANCE, one that wins against the player's current
//   stance (see Clash.favors()) - if the player shows one
// - otherwise an attack (ATTACK_CHANCE) or a block, in a random
//   direction
// With CAN_BLOCK off, the enemy only ever attacks.
// Whenever the player shows a new stance, the enemy picks again
// REACTION_DELAY later.
//
// An attack is taken at once; a dash attack also charges toward the
// player with CHARGE_IMPULSE. A block first brakes the enemy to a
// stop (see Bracing.js), then holds for BLOCK_DURATION before the
// enemy drops it and picks anew.
//
// The stance itself is set by game.js, through the `hooks`:
// attack(direction), block(direction) and drop().
class EnemyTactics {

    // Milliseconds.
    static DECISION_DELAY = 300;
    static REACTION_DELAY = 250;
    static BLOCK_DURATION = 1000;

    // 0..1.
    static COUNTER_CHANCE = 0.4;
    static ATTACK_CHANCE = 0.6;

    // Whether the enemy takes block stances at all.
    static CAN_BLOCK = false;

    // Cells per second.
    static CHARGE_IMPULSE = 4;


    // `readPlayerStance()` returns the player's { kind, direction }
    // or null.
    constructor(enemy, rubberBand, readPlayerStance, hooks) {
        this.enemy = enemy;
        this.rubberBand = rubberBand;
        this.readPlayerStance = readPlayerStance;
        this.hooks = hooks;

        this.reset();
    }


    // Starts over after a collision: no plan, decide again after
    // DECISION_DELAY.
    reset() {
        // { kind, direction } the enemy is going for, or null.
        this.plan = null;

        // Time until the next choice; 0 = nothing pending.
        this.wait = EnemyTactics.DECISION_DELAY;

        // Block held (after bracing), and for how much longer.
        this.blocking = false;
        this.blockTime = 0;

        this.seenStance = EnemyTactics.describe(this.readPlayerStance());
    }


    update(dt) {

        if (this.enemy.alive === false || !this.rubberBand.engaged()) {
            return;
        }

        this.watchPlayer();

        if (this.wait > 0) {
            this.wait -= dt;

            if (this.wait <= 0) {
                this.wait = 0;
                this.decide();
            }
        }

        if (this.plan && this.plan.kind === Stance.BLOCK) {
            this.holdBlock(dt);
        }
    }


    // A new stance from the player calls for a new choice, unless one
    // is pending anyway.
    watchPlayer() {
        const stance = this.readPlayerStance();
        const seen = EnemyTactics.describe(stance);

        if (seen === this.seenStance) {
            return;
        }

        this.seenStance = seen;

        if (stance && this.wait <= 0) {
            this.wait = EnemyTactics.REACTION_DELAY;
        }
    }


    decide() {
        const plan = this.choose(this.readPlayerStance());
        this.plan = plan;
        this.blocking = false;

        if (plan.kind === Stance.BLOCK) {
            // Bracing first - no stance until it has stopped.
            this.hooks.drop();
            return;
        }

        this.hooks.attack(plan.direction);

        if (plan.direction === "dash") {
            const toward = this.rubberBand.towardOther(this.enemy);
            this.enemy.mover.accelerate(toward * EnemyTactics.CHARGE_IMPULSE);
        }
    }


    choose(playerStance) {

        if (playerStance && Math.random() < EnemyTactics.COUNTER_CHANCE) {
            const winners = Stance.OPTIONS.filter(option =>
                EnemyTactics.allowed(option) && Clash.favors(option, playerStance)
            );

            if (winners.length > 0) {
                return winners[Math.floor(Math.random() * winners.length)];
            }
        }

        const attack = !EnemyTactics.CAN_BLOCK || Math.random() < EnemyTactics.ATTACK_CHANCE;
        const kind = attack ? Stance.ATTACK : Stance.BLOCK;

        return { kind, direction: Stance.randomDirection() };
    }


    // Brakes until stopped, takes the block, holds it BLOCK_DURATION,
    // then drops it and picks anew.
    holdBlock(dt) {

        if (!this.blocking) {
            const toward = this.rubberBand.towardOther(this.enemy);

            if (Bracing.brace(this.enemy, toward, dt)) {
                this.blocking = true;
                this.blockTime = EnemyTactics.BLOCK_DURATION;
                this.hooks.block(this.plan.direction);
            }
            return;
        }

        this.blockTime -= dt;

        if (this.blockTime > 0) {
            return;
        }

        this.hooks.drop();
        this.plan = null;
        this.blocking = false;
        this.decide();
    }


    static allowed(option) {
        return EnemyTactics.CAN_BLOCK || option.kind !== Stance.BLOCK;
    }


    static describe(stance) {
        return stance ? `${stance.kind} ${stance.direction}` : "none";
    }
}
