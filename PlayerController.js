// Turns the left/right arrow keys into the player's fencing, sampled
// once per game tick (see update()) - the key handlers in game.js only
// record presses and releases. The player doesn't walk: it only moves
// by its speed (pushes, charges, the rubber band - see Mover.js).
// Up/down (above/below attacks) are handled in game.js.
//
// The OS key auto-repeat is ignored.
//
// Outside of combat the speed brakes on its own (BRAKE).
//
// In combat (see RubberBand.js) the player keeps facing the enemy. The
// FENCE_KEYS (ArrowLeft = left, ArrowRight = right) fence:
// - each fresh press toward the enemy is a charge: it adds
//   COMBAT_IMPULSE to the player's speed once and takes the dash
//   attack (hooks.charge())
// - holding the key away from the enemy braces for a block: the
//   player brakes (see Bracing.js) and, once stopped, takes the block
//   stance (hooks.block()) - game.js puts it where it's needed.
//   Releasing the key drops the block (hooks.unblock()). A collision
//   ends the bracing (spendBlock()): the key has to be released and
//   pressed again to brace anew.
// Outside of combat the fence keys do nothing.
//
// The hooks are set in game.js, which owns the stances.
class PlayerController {

    // Combat keys and their direction: a fresh press toward the enemy
    // charges, holding one away from it blocks.
    static FENCE_KEYS = {
        ArrowLeft: -1,
        ArrowRight: 1
    };

    // Outside of combat the speed brakes by BRAKE (cells per second,
    // per second) - see brake().
    static BRAKE = 10;

    // Speed (cells per second) one fence key press adds in combat.
    static COMBAT_IMPULSE = 4;


    constructor(player) {
        this.player = player;

        // Fence keys currently held, in press order.
        this.heldFenceKeys = [];

        // Fresh presses since the last tick, in order. Kept apart
        // from heldFenceKeys so a tap that's pressed and released
        // between two ticks still counts.
        this.fencePresses = [];

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


    handles(key) {
        return key in PlayerController.FENCE_KEYS;
    }


    press(key, isRepeat) {

        if (isRepeat || this.heldFenceKeys.includes(key)) {
            return;
        }

        this.heldFenceKeys.push(key);
        this.fencePresses.push(key);
    }


    release(key) {

        const index = this.heldFenceKeys.indexOf(key);

        if (index !== -1) {
            this.heldFenceKeys.splice(index, 1);
        }
    }


    // Focus leaving the page means no keyup will arrive for keys
    // still held - drop them, so the player doesn't keep blocking.
    releaseAll() {
        this.heldFenceKeys.length = 0;
    }


    update(dt) {

        const fencePresses = this.fencePresses.splice(0);
        const inCombat = this.rubberBand !== null && this.rubberBand.engaged();

        if (inCombat) {
            this.fence(dt, fencePresses);
        }
        else {
            this.stopBracing();
            this.blockSpent = false;
            this.brake(dt);
        }
    }


    // Outside of combat: brakes the speed toward 0, see BRAKE.
    brake(dt) {

        if (Math.sign(this.player.velocityX) === 0) {
            return;
        }

        this.player.mover.brake(PlayerController.BRAKE * dt / 1000);
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
