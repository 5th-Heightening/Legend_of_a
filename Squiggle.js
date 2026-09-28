// A string of random letters from Squiggle.CHARACTERS, starting
// right next to the player and growing to the right while "D" is
// held (see startSquiggle()/stopSquiggle() in game.js). Each letter
// sits one column right of the last; the row only changes every
// DY_STEP_EVERY letters, and the whole string is re-rolled every
// time it grows - see generate(). Purely decorative - nothing
// collides with it, so it doesn't interfere with combat. Glued to
// the player via getters, like Sword/Shield.
class Squiggle {

    static CHARACTERS = "=-~+";

    // The row may only change on every Nth letter.
    static DY_STEP_EVERY = 2;

    // Grows one letter every GROW_INTERVAL ms, up to MAX_LENGTH
    // letters; at full length it keeps being re-rolled every tick.
    static GROW_INTERVAL = 5;
    static MAX_LENGTH = 20;


    constructor(player) {
        this.player = player;
        this.z = 22;

        // One entry per letter, in order: its row offset from the
        // player and its character.
        this.segments = [];

        // Time accumulated toward the next letter.
        this.growTime = 0;
    }


    // Adds however many letters GROW_INTERVAL allows for this tick
    // (the interval is shorter than a tick), re-rolling the whole
    // string once - or just re-rolls it at full length.
    update(dt) {
        this.growTime += dt;

        const letters = Math.floor(this.growTime / Squiggle.GROW_INTERVAL);
        this.growTime -= letters * Squiggle.GROW_INTERVAL;

        this.generate(Math.min(this.segments.length + letters, Squiggle.MAX_LENGTH));
    }


    get length() {
        return this.segments.length;
    }


    // Grows by one letter - and re-rolls the whole string at the
    // new length, so every letter and the path change each time.
    grow() {
        this.generate(this.segments.length + 1);
    }


    // Builds a fresh random string of `length` letters. The row
    // only changes every Squiggle.DY_STEP_EVERY letters (randomly
    // one up, one down, or the same); in between it stays on the
    // previous letter's row. The first letter is on the player's row.
    generate(length) {
        this.segments = [];

        let dy = 0;

        for (let i = 0; i < length; i++) {

            if (i > 0 && i % Squiggle.DY_STEP_EVERY === 0) {
                dy += Math.floor(Math.random() * 3) - 1;
            }

            const char = Squiggle.CHARACTERS[
                Math.floor(Math.random() * Squiggle.CHARACTERS.length)
            ];

            this.segments.push({ dy, char });
        }
    }


    minDy() {
        return Math.min(0, ...this.segments.map(segment => segment.dy));
    }


    maxDy() {
        return Math.max(0, ...this.segments.map(segment => segment.dy));
    }


    get x() {
        return this.player.x + 1;
    }


    // The top of the drawn block - the highest letter's row.
    get y() {
        return this.player.y + this.minDy();
    }


    getAscii() {
        const top = this.minDy();
        const rows = this.maxDy() - top + 1;

        const lines = Array.from(
            { length: rows },
            () => Array(this.segments.length).fill(" ")
        );

        this.segments.forEach((segment, column) => {
            lines[segment.dy - top][column] = segment.char;
        });

        return lines.map(line => line.join("")).join("\n");
    }
}
