// ==================================================
// Levels
//
// A level is one screen of scenery: a list of environment parts
// (see LevelPart.js) plus, for each edge of the play area, the id
// of the level the player lands in when walking out over that edge
// (null = closed, the edge blocks like before).
//
// Level files (levels/*.js) are plain scripts that call
// Level.register({...}) - see README "Levels" for the format.
// They're scripts rather than JSON files, because fetch() is
// blocked when the game is opened from file://.
// ==================================================

class Level {

    static SIDES = ["left", "right", "up", "down"];

    static registry = new Map();


    static register(data) {

        const level = new Level(data);

        if (Level.registry.has(level.id)) {
            throw new Error(`Level "${level.id}" is registered twice`);
        }

        Level.registry.set(level.id, level);

        return level;
    }


    static get(id) {

        const level = Level.registry.get(id);

        if (!level) {
            throw new Error(`Unknown level "${id}" - is its <script src> missing?`);
        }

        return level;
    }


    // Warns about exits that point at a level that was never
    // registered (typo, or a level file missing from the HTML).
    // Called once at game start, so a broken link shows up right
    // away instead of only when someone walks over that edge.
    static checkExits() {

        for (const level of Level.registry.values()) {
            for (const side of Level.SIDES) {

                const target = level.exits[side];

                if (target !== null && !Level.registry.has(target)) {
                    console.warn(`Level "${level.id}": exit ${side} -> unknown level "${target}"`);
                }
            }
        }
    }


    constructor(data) {

        if (typeof data.id !== "string" || data.id === "") {
            throw new Error("Level: needs a non-empty string id");
        }

        this.id = data.id;
        this.name = data.name ?? data.id;

        const exits = data.exits ?? {};

        for (const side of Object.keys(exits)) {
            if (!Level.SIDES.includes(side)) {
                throw new Error(`Level "${this.id}": unknown exit side "${side}"`);
            }
        }

        this.exits = {};

        for (const side of Level.SIDES) {
            this.exits[side] = exits[side] ?? null;
        }

        this.parts = (data.parts ?? []).map(
            (part, i) => new LevelPart(part, `${this.id}.parts[${i}]`)
        );
    }


    // The level behind the given edge, or null if that edge is closed.
    exitTowards(side) {

        const id = this.exits[side];

        return id === null ? null : Level.get(id);
    }
}
