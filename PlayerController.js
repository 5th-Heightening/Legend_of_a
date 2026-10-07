// Turns the arrow keys into player steps, sampled once per game tick
// (see update()) - the key handlers in game.js only record presses
// and releases.
//
// The OS key auto-repeat is ignored. Instead, a fresh press moves
// one step on the next tick, and holding the key keeps stepping
// every MOVE_INTERVAL ms. With several arrows held, the most
// recently pressed one wins; releasing it falls back to the next one
// still held.
//
// In combat the player also runs at the enemy on its own, at
// Player.ATTACK_SPEED (see approach()), and always faces it, so
// stepping back doesn't turn its back on it.
//
// The player neither steps nor approaches while it's being pushed
// back, dashing (both a fixed travel, see Mover.travel()), behind its
// shield (player.rooted) or recovering after a push back
// (player.recovering).
class PlayerController {

    static DIRECTIONS = {
        ArrowUp: { dx: 0, dy: -1 },
        ArrowDown: { dx: 0, dy: 1 },
        ArrowLeft: { dx: -1, dy: 0 },
        ArrowRight: { dx: 1, dy: 0 }
    };

    // Time between steps while an arrow is held.
    static MOVE_INTERVAL = 120;


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

        // Set in game.js - the enemy, which decides when the player is
        // in combat.
        this.opponent = null;
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
        const inCombat = this.opponent !== null && this.opponent.inCombat();

        if (inCombat) {
            this.faceOpponent();
        }

        this.approach(inCombat);

        if (!key || this.held()) {
            this.holdTime = 0;
            return;
        }

        const { dx, dy } = PlayerController.DIRECTIONS[key];

        if (dx !== 0 && !inCombat) {
            this.player.facing = dx < 0 ? "left" : "right";
        }

        // Fresh presses act right away; a held key only acts every
        // MOVE_INTERVAL.
        if (presses.length > 0) {
            this.holdTime = 0;
            this.player.mover.queueStep(dx, dy);
            return;
        }

        this.holdTime += dt;

        if (this.holdTime >= PlayerController.MOVE_INTERVAL) {
            this.holdTime -= PlayerController.MOVE_INTERVAL;
            this.player.mover.queueStep(dx, dy);
        }
    }


    // Pushed back, dashing, behind the shield or recovering - the
    // player can't move on its own.
    held() {
        return this.player.mover.traveling ||
            this.player.rooted ||
            this.player.recovering;
    }


    // In combat: runs at the enemy with Player.ATTACK_SPEED. Otherwise
    // (or while held) the speed is 0 - a push or dash in progress is
    // left alone.
    approach(inCombat) {

        const mover = this.player.mover;

        if (mover.traveling) {
            return;
        }

        const toward = inCombat && !this.held()
            ? Math.sign(this.opponent.x - this.player.x)
            : 0;

        if (toward === 0) {
            mover.stop();
            return;
        }

        mover.setVelocity(toward * Player.ATTACK_SPEED, 0);
    }


    // In combat the player always faces the enemy.
    faceOpponent() {

        const toward = Math.sign(this.opponent.x - this.player.x);

        if (toward !== 0) {
            this.player.facing = toward < 0 ? "left" : "right";
        }
    }
}
