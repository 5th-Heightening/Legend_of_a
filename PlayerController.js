// Turns the arrow keys into player movement, sampled once per game
// tick (see update()) - the key handlers in game.js only record
// presses and releases.
//
// The OS key auto-repeat is ignored. Instead, a fresh press moves
// one step on the next tick, and holding the key keeps stepping
// every MOVE_INTERVAL ms. With several arrows held, the most
// recently pressed one wins; releasing it falls back to the next one
// still held.
//
// The player has one horizontal speed (see Mover.js); a push is just
// that speed after a hit. Outside of combat it brakes on its own
// while the player keeps moving and steering: holding the arrow
// against it digs in (no step, brakes DIG_IN_FACTOR times harder),
// holding it along rides it (steps on top of it, RIDE_FACTOR).
//
// In combat (see RubberBand.js) left/right don't step. Each fresh
// press adds COMBAT_IMPULSE to the player's speed once instead -
// holding the key adds nothing more. The player keeps facing the
// enemy. Up/down step as usual.
class PlayerController {

    static DIRECTIONS = {
        ArrowUp: { dx: 0, dy: -1 },
        ArrowDown: { dx: 0, dy: 1 },
        ArrowLeft: { dx: -1, dy: 0 },
        ArrowRight: { dx: 1, dy: 0 }
    };

    // Time between steps while an arrow is held.
    static MOVE_INTERVAL = 120;

    // Outside of combat the speed brakes by BRAKE (cells per second,
    // per second), scaled by the held arrow - see brake().
    static BRAKE = 10;
    static DIG_IN_FACTOR = 4;
    static RIDE_FACTOR = 1;

    // Speed (cells per second) one left/right press adds in combat.
    static COMBAT_IMPULSE = 4;


    constructor(player) {
        this.player = player;

        // Arrow keys currently held, in press order - the last one is
        // the direction being walked.
        this.heldArrows = [];

        // Fresh presses since the last tick, in order. Kept apart
        // from heldArrows so a tap that's pressed and released
        // between two ticks still counts.
        this.presses = [];

        // Time the current arrow has been held since its last step.
        this.holdTime = 0;

        // Set in game.js - decides when the player is in combat.
        this.rubberBand = null;
    }


    handles(key) {
        return key in PlayerController.DIRECTIONS;
    }


    press(key, isRepeat) {

        if (isRepeat || this.heldArrows.includes(key)) {
            return;
        }

        this.heldArrows.push(key);
        this.presses.push(key);
    }


    release(key) {

        const index = this.heldArrows.indexOf(key);

        if (index !== -1) {
            this.heldArrows.splice(index, 1);
        }
    }


    // Focus leaving the page means no keyup will arrive for keys
    // still held - drop them, so the player doesn't keep walking.
    releaseAll() {
        this.heldArrows.length = 0;
    }


    update(dt) {

        const presses = this.presses.splice(0);
        const key = presses.at(-1) ?? this.heldArrows.at(-1);
        const mover = this.player.mover;
        const inCombat = this.rubberBand !== null && this.rubberBand.engaged();

        if (inCombat) {
            this.fence(presses);
        }
        else {
            this.brake(dt, key ? PlayerController.DIRECTIONS[key].dx : 0);
        }

        if (!key) {
            this.holdTime = 0;
            return;
        }

        const { dx, dy } = PlayerController.DIRECTIONS[key];

        // In combat left/right only change the speed - see fence().
        if (inCombat && dx !== 0) {
            this.holdTime = 0;
            return;
        }

        const drift = Math.sign(mover.velocityX);

        // Digging in: stand your ground, don't step.
        const diggingIn = dx !== 0 && dx === -drift;

        // While drifting, the player stays turned toward where the
        // hit came from, so riding it doesn't turn its back to the
        // enemy.
        if (dx !== 0 && drift === 0) {
            this.player.facing = dx < 0 ? "left" : "right";
        }

        // Fresh presses act right away; a held key only acts every
        // MOVE_INTERVAL.
        let freshPresses = presses.length;
        let heldRepeat = false;

        if (freshPresses > 0) {
            this.holdTime = 0;
        }
        else if (this.heldArrows.length > 0) {
            this.holdTime += dt;

            if (this.holdTime >= PlayerController.MOVE_INTERVAL) {
                this.holdTime -= PlayerController.MOVE_INTERVAL;
                heldRepeat = true;
            }
        }

        if (diggingIn) {
            return;
        }

        if (freshPresses > 0 || heldRepeat) {
            this.player.mover.queueStep(dx, dy);
        }
    }


    // Outside of combat: brakes the speed toward 0, harder when the
    // held arrow dx (-1/0/1) points against it, see BRAKE.
    brake(dt, dx) {

        const drift = Math.sign(this.player.velocityX);

        if (drift === 0) {
            return;
        }

        let factor = 1;

        if (dx === -drift) {
            factor = PlayerController.DIG_IN_FACTOR;
        }
        else if (dx === drift) {
            factor = PlayerController.RIDE_FACTOR;
        }

        this.player.mover.brake(PlayerController.BRAKE * factor * dt / 1000);
    }


    // Combat: every fresh left/right press adds COMBAT_IMPULSE to the
    // speed, and the player turns toward the enemy.
    fence(presses) {

        for (const key of presses) {
            const { dx } = PlayerController.DIRECTIONS[key];

            if (dx !== 0) {
                this.player.mover.accelerate(dx * PlayerController.COMBAT_IMPULSE);
            }
        }

        const toward = this.rubberBand.towardOther(this.player);

        if (toward !== 0) {
            this.player.facing = toward < 0 ? "left" : "right";
        }
    }
}
