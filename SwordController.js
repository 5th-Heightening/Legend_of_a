// Turns W/A/S/D into the direction of the player's sword (see
// Sword.js), sampled once per game tick (see update()) - the key
// handlers in game.js only record presses and releases.
//
// The keys held add up to one of the eight directions: W up, S down,
// A left, D right, two neighbouring ones a diagonal (W+D up-right,
// S+A down-left, ...). Opposite keys cancel each other out. With no
// key held (or only cancelling ones) the sword stays where it is.
//
// The two keys of a diagonal are never pressed or released at exactly
// the same time. So a combination only counts once it's been held for
// SETTLE ms - otherwise letting go of W+A would first swing the sword
// to whichever of the two is still held a moment longer, and pressing
// them would start the swing toward the first one. A combination
// reached by pressing a key also counts if all keys are released
// before that (a quick tap). One that's only left over from releasing
// other keys doesn't.
class SwordController {

    static KEYS = {
        w: { dx: 0, dy: -1 },
        s: { dx: 0, dy: 1 },
        a: { dx: -1, dy: 0 },
        d: { dx: 1, dy: 0 }
    };

    // Milliseconds a key combination has to be held to count.
    static SETTLE = 60;


    constructor(sword) {
        this.sword = sword;

        // Keys currently held, and the fresh presses since the last
        // tick - so a tap pressed and released between two ticks
        // still counts.
        this.held = new Set();
        this.presses = new Set();

        // The keys counted on the last tick.
        this.lastKeys = new Set();

        // The direction the keys add up to, waiting to count: since
        // when (ms), whether a key press led to it, and whether it
        // has been handed to the sword already.
        this.pending = null;
        this.pendingTime = 0;
        this.pendingPressed = false;
        this.pendingDone = false;
    }


    static normalize(key) {
        return key.length === 1 ? key.toLowerCase() : key;
    }


    handles(key) {
        return SwordController.normalize(key) in SwordController.KEYS;
    }


    press(key) {
        key = SwordController.normalize(key);
        this.held.add(key);
        this.presses.add(key);
    }


    release(key) {
        this.held.delete(SwordController.normalize(key));
    }


    // Focus leaving the page means no keyup will arrive for keys
    // still held.
    releaseAll() {
        this.held.clear();
    }


    // The direction (index into Sword.DIRECTIONS) `keys` add up to, or
    // null.
    static directionOf(keys) {

        let dx = 0;
        let dy = 0;

        for (const key of keys) {
            dx += SwordController.KEYS[key].dx;
            dy += SwordController.KEYS[key].dy;
        }

        return Sword.directionOf(dx, dy);
    }


    update(dt) {

        const keys = new Set([...this.held, ...this.presses]);
        const pressed = [...keys].some(key => !this.lastKeys.has(key));

        this.presses.clear();
        this.lastKeys = keys;

        const direction = SwordController.directionOf(keys);

        if (direction === null) {

            if (this.pending !== null && this.pendingPressed && !this.pendingDone) {
                this.sword.point(this.pending);
            }

            this.pending = null;
            return;
        }

        if (direction !== this.pending) {
            this.pending = direction;
            this.pendingTime = 0;
            this.pendingPressed = pressed;
            this.pendingDone = false;
        }

        this.pendingTime += dt;

        if (!this.pendingDone && this.pendingTime >= SwordController.SETTLE) {
            this.sword.point(direction);
            this.pendingDone = true;
        }
    }
}
