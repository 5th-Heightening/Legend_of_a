// ==================================================
// Parallax scenery
//
// An environment piece doesn't have a fixed position.
// Instead, it has 4 predefined positions - one for
// each corner the player can stand in - and its actual
// position is linearly interpolated between them based
// on where the player currently is. Pieces with a wider
// spread of corner positions appear to move more,
// giving a pseudo-3D parallax effect.
// ==================================================

class ParallaxObject {

    constructor(corners, z) {
        this.corners = corners;
        this.z = z;

        this.x = corners.topLeft.x;
        this.y = corners.topLeft.y;
    }


    static lerp(a, b, t) {
        return a + (b - a) * t;
    }


    // t: player's horizontal position, 0 (left) .. 1 (right)
    // u: player's vertical position, 0 (top) .. 1 (bottom)
    //
    // Pure - returns where this object would be, without
    // moving it. Used both to actually move the object and
    // to predict its position for a collision check before
    // a move is committed.
    interpolatePosition(t, u) {

        const { topLeft, topRight, bottomLeft, bottomRight } =
            this.corners;

        const topX = ParallaxObject.lerp(topLeft.x, topRight.x, t);
        const topY = ParallaxObject.lerp(topLeft.y, topRight.y, t);

        const bottomX =
            ParallaxObject.lerp(bottomLeft.x, bottomRight.x, t);
        const bottomY =
            ParallaxObject.lerp(bottomLeft.y, bottomRight.y, t);

        return {
            x: Math.round(ParallaxObject.lerp(topX, bottomX, u)),
            y: Math.round(ParallaxObject.lerp(topY, bottomY, u))
        };
    }


    updatePosition(t, u) {
        const { x, y } = this.interpolatePosition(t, u);

        this.x = x;
        this.y = y;
    }


    // Default collision shape: the whole visible shape blocks
    // movement. Override in a subclass for a smaller footprint
    // (e.g. only a tree's trunk, not its canopy).
    getCollisionMap() {
        return this.getAscii();
    }
}
