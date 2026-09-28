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
// While the player is being pushed, arrow keys don't move it - they
// fight the knockback instead (see update()).
class PlayerController {

    static DIRECTIONS = {
        ArrowUp: { dx: 0, dy: -1 },
        ArrowDown: { dx: 0, dy: 1 },
        ArrowLeft: { dx: -1, dy: 0 },
        ArrowRight: { dx: 1, dy: 0 }
    };

    // Time between steps while an arrow is held.
    static MOVE_INTERVAL = 120;

    // How many recovery keypresses it takes to shave
    // PUSH_RECOVER_AMOUNT (cells per second) off the player's push
    // speed. Higher = slower to recover from a push.
    static PUSH_RECOVER_PRESSES_PER_POINT = 1;
    static PUSH_RECOVER_AMOUNT = 5;

    // How much one held-arrow repeat (every MOVE_INTERVAL while the
    // key stays down) counts toward recovery, compared to a fresh
    // press (1). Lower = holding recovers slower, so tapping is the
    // way to recover quickly.
    static PUSH_RECOVER_HOLD_WEIGHT = 0.25;


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

        if (!key) {
            this.holdTime = 0;
            return;
        }

        const { dx, dy } = PlayerController.DIRECTIONS[key];

        if (dx !== 0) {
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

        if (this.player.push.active()) {
            this.recover(freshPresses, heldRepeat);
            return;
        }

        if (freshPresses > 0 || heldRepeat) {
            this.player.mover.queueStep(dx, dy);
        }
    }


    // Chips away at the push: every fresh press counts fully, a held
    // key's repeat only PUSH_RECOVER_HOLD_WEIGHT. It doesn't matter
    // which arrow is pressed, only that one is.
    recover(freshPresses, heldRepeat) {

        const push = this.player.push;

        for (let i = 0; i < freshPresses; i++) {
            push.recoverStep(
                PlayerController.PUSH_RECOVER_PRESSES_PER_POINT,
                1,
                PlayerController.PUSH_RECOVER_AMOUNT
            );
        }

        if (heldRepeat) {
            push.recoverStep(
                PlayerController.PUSH_RECOVER_PRESSES_PER_POINT,
                PlayerController.PUSH_RECOVER_HOLD_WEIGHT,
                PlayerController.PUSH_RECOVER_AMOUNT
            );
        }
    }
}
