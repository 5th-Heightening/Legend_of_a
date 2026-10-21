// The player's sword: one of eight DIRECTIONS around its owner, in
// 45° steps, drawn as "|", "/", "-" or "\" on the LENGTH cells next to
// it in that direction. Glued to the owner via getters, so it moves
// along.
//
// point(direction) gives it a new direction. It doesn't jump there:
// it swings, the short way round, through every position in between,
// one position per SWING_STEP ms. A new direction mid-swing just
// changes where the swing goes, from where the sword is now. Only the
// exact opposite of the current position is taken at once - see
// reverse(), the hook for e.g. a thrust.
//
// Once the sword arrives where it was pointed, its owner moves one
// cell that way (hooks.move(direction, moves)). Pointing it again
// where it already is (or is swinging to) moves once more - right
// away, or on arrival.
//
// Every position the sword leaves (also the intermediate ones) stays
// in its trail for TRAIL_DURATION ms: drawn like the sword, and active
// (see activeCells()).
//
// The owner needs x and y.
class Sword {

    // Clockwise, starting straight up. The index into this list is
    // what the sword's directions are (see point()).
    static DIRECTIONS = [
        { name: "up",         dx: 0,  dy: -1, char: "|" },
        { name: "up-right",   dx: 1,  dy: -1, char: "/" },
        { name: "right",      dx: 1,  dy: 0,  char: "-" },
        { name: "down-right", dx: 1,  dy: 1,  char: "\\" },
        { name: "down",       dx: 0,  dy: 1,  char: "|" },
        { name: "down-left",  dx: -1, dy: 1,  char: "/" },
        { name: "left",       dx: -1, dy: 0,  char: "-" },
        { name: "up-left",    dx: -1, dy: -1, char: "\\" }
    ];

    // Index into DIRECTIONS the sword starts in.
    static START_DIRECTION = 2;

    // Cells the blade reaches out from its owner.
    static LENGTH = 1;

    // Milliseconds per position while swinging.
    static SWING_STEP = 40;

    // Milliseconds a position the sword has left stays visible and
    // active.
    static TRAIL_DURATION = 120;

    // Whether the position left by reverse() (no swing) leaves a trail
    // too.
    static REVERSE_LEAVES_TRAIL = true;


    // Index into DIRECTIONS for a direction (dx, dy - only the signs
    // count), or null for (0, 0).
    static directionOf(dx, dy) {

        dx = Math.sign(dx);
        dy = Math.sign(dy);

        const index = Sword.DIRECTIONS.findIndex(d => d.dx === dx && d.dy === dy);
        return index === -1 ? null : index;
    }


    // Steps (0..4) between two directions, the short way round.
    static distance(from, to) {
        const steps = Sword.wrap(to - from);
        return Math.min(steps, Sword.DIRECTIONS.length - steps);
    }


    static isOpposite(from, to) {
        return Sword.distance(from, to) === Sword.DIRECTIONS.length / 2;
    }


    static wrap(index) {
        const count = Sword.DIRECTIONS.length;
        return ((index % count) + count) % count;
    }


    constructor(owner) {
        this.owner = owner;
        this.z = 25;

        // Where the sword is now, and where it swings to.
        this.direction = Sword.START_DIRECTION;
        this.target = Sword.START_DIRECTION;

        // Milliseconds until the next position of the swing.
        this.untilStep = 0;

        // Positions left behind: { direction, life } - life in ms.
        this.trail = [];

        // Times the owner moves once the sword arrives at its target.
        this.moves = 0;

        // Set in game.js, see reverse() and arrive().
        this.hooks = { reverse: null, move: null };
    }


    get swinging() {
        return this.direction !== this.target;
    }


    // A new direction (index into DIRECTIONS) to swing to.
    point(to) {

        // Again: one more move, now or on arrival.
        if (to === this.target) {
            this.moves++;

            if (!this.swinging) {
                this.arrive();
            }
            return;
        }

        if (Sword.isOpposite(this.direction, to)) {
            this.reverse(to);
            return;
        }

        // A fresh swing takes its first step on this tick; a running
        // one keeps its pace.
        if (!this.swinging) {
            this.untilStep = 0;
        }

        // Moves owed to an abandoned target are dropped.
        this.target = to;
        this.moves = 1;
    }


    // Hook: `to` is the exact opposite of where the sword is. If
    // hooks.reverse(from, to) is set and returns true, it has taken
    // care of it (e.g. a thrust) - also of moving the owner, if at
    // all. Otherwise the sword turns over at once, without swinging,
    // and the owner moves that way.
    reverse(to) {

        this.moves = 0;

        if (this.hooks.reverse && this.hooks.reverse(this.direction, to)) {
            return;
        }

        this.moves = 1;
        this.jumpTo(to, Sword.REVERSE_LEAVES_TRAIL);
    }


    // Straight to `to`, no swing.
    jumpTo(to, leaveTrail = true) {

        if (leaveTrail) {
            this.leaveTrail(this.direction);
        }

        this.direction = to;
        this.target = to;

        this.arrive();
    }


    // At the target: the owner makes the moves owed (see point()),
    // through hooks.move(direction, moves).
    arrive() {

        const moves = this.moves;
        this.moves = 0;

        if (moves > 0 && this.hooks.move) {
            this.hooks.move(this.direction, moves);
        }
    }


    update(dt) {

        for (const entry of this.trail) {
            entry.life -= dt;
        }

        this.trail = this.trail.filter(entry => entry.life > 0);

        if (!this.swinging) {
            return;
        }

        while (this.swinging && this.untilStep <= 0) {
            this.step();
            this.untilStep += Sword.SWING_STEP;
        }

        this.untilStep -= dt;
    }


    // One position on toward the target, the short way round.
    step() {

        const clockwise = Sword.wrap(this.target - this.direction) <= Sword.DIRECTIONS.length / 2;

        this.leaveTrail(this.direction);
        this.direction = Sword.wrap(this.direction + (clockwise ? 1 : -1));

        if (!this.swinging) {
            this.arrive();
        }
    }


    // A position passed again starts its trail over.
    leaveTrail(direction) {
        this.trail = this.trail.filter(entry => entry.direction !== direction);
        this.trail.push({ direction, life: Sword.TRAIL_DURATION });
    }


    // The cells of the blade pointing in `direction`, in play area
    // coordinates: { x, y, char }.
    cellsOf(direction) {

        const { dx, dy, char } = Sword.DIRECTIONS[direction];
        const cells = [];

        for (let reach = 1; reach <= Sword.LENGTH; reach++) {
            cells.push({ x: this.owner.x + dx * reach, y: this.owner.y + dy * reach, char });
        }

        return cells;
    }


    // Every cell that's active now - the sword and its trail, oldest
    // first. For hit checks.
    activeCells() {

        const directions = this.trail
            .map(entry => entry.direction)
            .filter(direction => direction !== this.direction);

        directions.push(this.direction);

        return directions.flatMap(direction => this.cellsOf(direction));
    }


    // A square of 2 * LENGTH + 1 cells around the owner.
    get x() {
        return this.owner.x - Sword.LENGTH;
    }


    get y() {
        return this.owner.y - Sword.LENGTH;
    }


    getAscii() {

        const size = 2 * Sword.LENGTH + 1;
        const rows = Array.from({ length: size }, () => Array(size).fill(" "));

        for (const cell of this.activeCells()) {
            rows[cell.y - this.y][cell.x - this.x] = cell.char;
        }

        return rows.map(row => row.join("")).join("\n");
    }
}
