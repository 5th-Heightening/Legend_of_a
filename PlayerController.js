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
// While the player is being pushed, it keeps moving and steering. The
// push wears off on its own; holding the arrow against it digs in
// (no step, wears off faster), holding it along the push rides it
// (steps on top of the push). See Push.wearOff().
class PlayerController {

    static DIRECTIONS = {
        ArrowUp: { dx: 0, dy: -1 },
        ArrowDown: { dx: 0, dy: 1 },
        ArrowLeft: { dx: -1, dy: 0 },
        ArrowRight: { dx: 1, dy: 0 }
    };

    // Time between steps while an arrow is held.
    static MOVE_INTERVAL = 120;

    // While pushed, the push wears off by PUSH_RECOVER_AMOUNT (cells
    // per second) every PUSH_RECOVER_INTERVAL ms on its own - faster
    // or slower depending on the held arrow, see Push.wearOff().
    static PUSH_RECOVER_INTERVAL = 500;
    static PUSH_RECOVER_AMOUNT = 5;


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
        const push = this.player.push;

        if (push.active()) {
            const dx = key ? PlayerController.DIRECTIONS[key].dx : 0;

            push.wearOff(
                dt,
                dx,
                PlayerController.PUSH_RECOVER_INTERVAL,
                PlayerController.PUSH_RECOVER_AMOUNT
            );
        }

        if (!key) {
            this.holdTime = 0;
            return;
        }

        const { dx, dy } = PlayerController.DIRECTIONS[key];

        // Digging in: stand your ground, don't step.
        const diggingIn = push.isAgainst(dx);

        // While pushed, the player stays turned toward where the push
        // came from, so riding it doesn't turn its back to the enemy.
        if (dx !== 0 && !push.active()) {
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
}
