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
// In combat (see RubberBand.engaged()) left/right don't step, and
// the player keeps facing the enemy. The speed isn't the player's to
// change there - it follows the stance (see steerAttackers() in
// game.js). Of the FENCE_KEYS (A = left, D = right), a fresh press
// toward the enemy takes the dash attack (hooks.charge()); the other
// one does nothing. Up/down step as usual. Outside of combat A/D do
// nothing.
//
// The hooks are set in game.js, which owns the stances.
class PlayerController {

    static DIRECTIONS = {
        ArrowUp: { dx: 0, dy: -1 },
        ArrowDown: { dx: 0, dy: 1 },
        ArrowLeft: { dx: -1, dy: 0 },
        ArrowRight: { dx: 1, dy: 0 }
    };

    // Combat keys (lower case) and their direction: a fresh press
    // toward the enemy takes the dash attack.
    static FENCE_KEYS = {
        a: -1,
        d: 1
    };

    // Time between steps while an arrow is held.
    static MOVE_INTERVAL = 120;

    // Outside of combat the speed brakes by BRAKE (cells per second,
    // per second), scaled by the held arrow - see brake().
    static BRAKE = 10;
    static DIG_IN_FACTOR = 4;
    static RIDE_FACTOR = 1;


    constructor(player) {
        this.player = player;

        // Arrow keys currently held, in press order - the last one is
        // the direction being walked.
        this.heldArrows = [];

        // Fresh presses since the last tick, in order. Kept apart
        // from heldArrows so a tap that's pressed and released
        // between two ticks still counts.
        this.presses = [];

        // The same two for the FENCE_KEYS.
        this.heldFenceKeys = [];
        this.fencePresses = [];

        // Time the current arrow has been held since its last step.
        this.holdTime = 0;

        // Set in game.js - decides when the player is in combat.
        this.rubberBand = null;

        // Set in game.js: charge() - see fence().
        this.hooks = null;
    }


    // Arrow keys as they are, letters in lower case (Shift or Caps
    // Lock don't matter).
    static normalize(key) {
        return key.length === 1 ? key.toLowerCase() : key;
    }


    // The held and freshly pressed lists `key` belongs to, or null.
    lists(key) {

        if (key in PlayerController.DIRECTIONS) {
            return { held: this.heldArrows, presses: this.presses };
        }

        if (key in PlayerController.FENCE_KEYS) {
            return { held: this.heldFenceKeys, presses: this.fencePresses };
        }

        return null;
    }


    handles(key) {
        return this.lists(PlayerController.normalize(key)) !== null;
    }


    press(key, isRepeat) {

        key = PlayerController.normalize(key);
        const { held, presses } = this.lists(key);

        if (isRepeat || held.includes(key)) {
            return;
        }

        held.push(key);
        presses.push(key);
    }


    release(key) {

        key = PlayerController.normalize(key);
        const { held } = this.lists(key);
        const index = held.indexOf(key);

        if (index !== -1) {
            held.splice(index, 1);
        }
    }


    // Focus leaving the page means no keyup will arrive for keys
    // still held - drop them, so the player doesn't keep walking.
    releaseAll() {
        this.heldArrows.length = 0;
        this.heldFenceKeys.length = 0;
    }


    update(dt) {

        const presses = this.presses.splice(0);
        const fencePresses = this.fencePresses.splice(0);

        const key = presses.at(-1) ?? this.heldArrows.at(-1);
        const mover = this.player.mover;
        const inCombat = this.rubberBand !== null && this.rubberBand.engaged();

        if (inCombat) {
            this.fence(fencePresses);
        }
        else {
            this.brake(dt, key ? PlayerController.DIRECTIONS[key].dx : 0);
        }

        if (!key) {
            this.holdTime = 0;
            return;
        }

        const { dx, dy } = PlayerController.DIRECTIONS[key];

        // In combat left/right do nothing - A/D fence, see fence().
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


    // Combat: a fresh fence key press toward the enemy takes the dash
    // attack. The player turns toward the enemy.
    fence(presses) {

        const toward = this.rubberBand.towardOther(this.player);

        if (toward !== 0) {
            this.player.facing = toward < 0 ? "left" : "right";
        }

        for (const key of presses) {
            if (PlayerController.FENCE_KEYS[key] === toward) {
                this.hooks.charge();
            }
        }
    }
}
