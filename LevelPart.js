// One environment part of a level, built from the part data in a
// level file (see Level.js and README "Levels"): a ParallaxObject
// whose art and collision map come from that data instead of from
// a subclass.
class LevelPart extends ParallaxObject {

    // Draw order of a part that doesn't set its own z. Between the
    // ground (0) and the enemy/player (15/20).
    static DEFAULT_Z = 5;

    static CORNERS = ["topLeft", "topRight", "bottomLeft", "bottomRight"];


    // label names the part in error messages, e.g. "meadow.parts[1]".
    constructor(data, label) {

        LevelPart.checkCorners(data.corners, label);

        super(data.corners, data.z ?? LevelPart.DEFAULT_Z);

        this.name = data.name ?? label;

        this.transparentChar = data.transparentChar ?? " ";

        this.ascii = LevelPart.normalizeArt(data.ascii, `${label}.ascii`);

        // true: the ASCII art itself is the collision map - every
        // visible character blocks. false: `collision` is a separate
        // map, laid over the art cell by cell.
        this.collisionFromAscii = data.collisionFromAscii ?? true;

        this.collision = this.collisionFromAscii
            ? null
            : LevelPart.normalizeArt(data.collision, `${label}.collision`);
    }


    // Art in a level file is written as a String.raw template literal
    // that starts and ends on its own line, so one leading and one
    // trailing line break are dropped. Windows line endings are
    // turned into plain "\n".
    static normalizeArt(text, label) {

        if (typeof text !== "string") {
            throw new Error(`${label}: must be a string`);
        }

        return text
            .replace(/\r\n?/g, "\n")
            .replace(/^\n/, "")
            .replace(/\n$/, "");
    }


    static checkCorners(corners, label) {

        for (const corner of LevelPart.CORNERS) {

            const point = corners?.[corner];

            if (!Number.isFinite(point?.x) || !Number.isFinite(point?.y)) {
                throw new Error(`${label}.corners.${corner}: needs numeric x and y`);
            }
        }
    }


    getAscii() {
        return this.ascii;
    }


    getCollisionMap() {
        return this.collisionFromAscii ? this.ascii : this.collision;
    }
}
