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
// In combat (see RubberBand.js) left/right don't step, and the player
// keeps facing the enemy. The FENCE_KEYS (A = left, D = right) fence:
// - each fresh press toward the enemy is a charge: it adds
//   COMBAT_IMPULSE to the player's speed once and takes the dash
//   attack (hooks.charge())
// - holding the key away from the enemy braces for a block: the
//   player brakes (see Bracing.js) and, once stopped, takes the block
//   stance (hooks.block()) - game.js puts it where it's needed. The
//   arrows don't step meanwhile. Releasing the key drops the block
//   (hooks.unblock()). A collision ends the bracing (spendBlock()):
//   the key has to be released and pressed again to brace anew.
// Otherwise up/down step as usual. Outside of combat A/D do nothing.
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
    // toward the enemy charges, holding one away from it blocks.
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

        // The same two for the FENCE_KEYS.
        this.heldFenceKeys = [];
        this.fencePresses = [];

        // Time the current arrow has been held since its last step.
        this.holdTime = 0;

        // Set in game.js - decides when the player is in combat.
        this.rubberBand = null;

        // Set in game.js: charge(), brace(), block(), unblock() - see
        // fence().
        this.hooks = null;

        // Holding the fence key away from the enemy in combat
        // (braking or blocking).
        this.bracing = false;

        // Bracing ended by a collision while the key stays held - no
        // new bracing until it's released.
        this.blockSpent = false;
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
            this.fence(dt, fencePresses);
        }
        else {
            this.stopBracing();
            this.blockSpent = false;
            this.brake(dt, key ? PlayerController.DIRECTIONS[key].dx : 0);
        }

        // Bracing: the arrows don't step - see fence().
        if (this.bracing) {
            this.holdTime = 0;
            return;
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


    // Combat: a fresh fence key press toward the enemy charges,
    // holding the one away from it braces for a block - see the top
    // of this file. The player turns toward the enemy.
    fence(dt, presses) {

        const toward = this.rubberBand.towardOther(this.player);

        if (toward !== 0) {
            this.player.facing = toward < 0 ? "left" : "right";
        }

        for (const key of presses) {
            const dx = PlayerController.FENCE_KEYS[key];

            if (dx === toward) {
                this.player.mover.accelerate(dx * PlayerController.COMBAT_IMPULSE);
                this.hooks.charge();
            }
        }

        const away = toward !== 0 && this.heldFenceKeys.some(key =>
            PlayerController.FENCE_KEYS[key] === -toward
        );

        if (!away) {
            this.stopBracing();
            this.blockSpent = false;
            return;
        }

        if (this.blockSpent) {
            return;
        }

        if (!this.bracing) {
            this.bracing = true;
            this.hooks.brace();
        }

        const blocking = this.player.stance !== null && this.player.stance.kind === Stance.BLOCK;

        if (blocking || Bracing.brace(this.player, toward, dt)) {
            this.hooks.block();
        }
    }


    // A collision: the bracing ends (game.js has deleted the block
    // already) and stays off until the key is pressed anew.
    spendBlock() {

        if (!this.bracing) {
            return;
        }

        this.bracing = false;
        this.blockSpent = true;
    }


    // Lets go of the key away from the enemy (or leaves combat):
    // the block, if taken, is dropped.
    stopBracing() {

        if (!this.bracing) {
            return;
        }

        this.bracing = false;
        this.hooks.unblock();
    }
}
