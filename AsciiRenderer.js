// ==================================================
// ASCII Renderer
// ==================================================

class AsciiRenderer {

    // width/height are the play area. With a borderChar, a one-cell
    // frame of it is drawn around that area, so the element shows
    // (width + 2) x (height + 2) characters - game coordinates stay
    // the same, (0, 0) is still the play area's top-left cell.
    constructor(element, width = 36, height = 18, borderChar = null) {
        this.element = element;

        this.width = width;
        this.height = height;

        this.borderChar = borderChar;

        this.objects = [];
    }


    // ==================================================
    // Object management
    // ==================================================

    add(object) {
        this.objects.push(object);

        return object;
    }


    remove(object) {
        const index = this.objects.indexOf(object);

        if (index !== -1) {
            this.objects.splice(index, 1);
        }
    }


    // ==================================================
    // Rendering
    // ==================================================

    render() {

        const buffer = Array.from(
            { length: this.height },
            () => Array(this.width).fill(" ")
        );


        const objects = [...this.objects]
            .sort((a, b) => a.z - b.z);


        for (const object of objects) {
            this.renderObject(buffer, object);
        }


        this.element.textContent = this.frame(buffer)
            .map(row => row.join(""))
            .join("\n");
    }


    // Wraps the play area buffer in a one-cell border of borderChar,
    // if one is set.
    frame(buffer) {

        if (this.borderChar === null) {
            return buffer;
        }

        const edge = Array(this.width + 2).fill(this.borderChar);

        return [
            edge,
            ...buffer.map(row => [this.borderChar, ...row, this.borderChar]),
            edge
        ];
    }


    renderObject(buffer, object) {

        const ascii = object.getAscii();

        const transparentChar =
            object.transparentChar ?? " ";

        const lines = ascii.split("\n");


        for (let dy = 0; dy < lines.length; dy++) {

            const line = lines[dy];


            for (let dx = 0; dx < line.length; dx++) {

                const x = object.x + dx;
                const y = object.y + dy;


                if (
                    x < 0 ||
                    x >= this.width ||
                    y < 0 ||
                    y >= this.height
                ) {
                    continue;
                }


                const character = line[dx];


                if (character === transparentChar) {
                    continue;
                }


                buffer[y][x] = character;
            }
        }
    }


    // ==================================================
    // Collision Detection
    // ==================================================

    detectCollisions() {

        for (let i = 0; i < this.objects.length; i++) {

            const objectA = this.objects[i];


            for (
                let j = i + 1;
                j < this.objects.length;
                j++
            ) {

                const objectB = this.objects[j];


                if (this.objectsCollide(objectA, objectB)) {

                    this.notifyCollision(
                        objectA,
                        objectB
                    );
                }
            }
        }
    }


    objectsCollide(a, b) {

        const shapeA = this.getCollisionShape(a);
        const shapeB = this.getCollisionShape(b);

        const transparentA =
            a.transparentChar ?? " ";

        const transparentB =
            b.transparentChar ?? " ";


        const linesA = shapeA.split("\n");
        const linesB = shapeB.split("\n");


        // --------------------------------------------------
        // Bounding box
        // --------------------------------------------------

        const left = Math.max(
            a.x,
            b.x
        );

        const right = Math.min(
            a.x + this.getAsciiWidth(linesA),
            b.x + this.getAsciiWidth(linesB)
        );

        const top = Math.max(
            a.y,
            b.y
        );

        const bottom = Math.min(
            a.y + linesA.length,
            b.y + linesB.length
        );


        // No bounding-box overlap.
        if (
            left >= right ||
            top >= bottom
        ) {
            return false;
        }


        // --------------------------------------------------
        // Pixel/character collision
        // --------------------------------------------------

            for (let y = top; y < bottom; y++) {

                for (let x = left; x < right; x++) {

                    const ax = x - a.x;
                    const ay = y - a.y;

                    const bx = x - b.x;
                    const by = y - b.y;


                    const charA =
                        linesA[ay]?.[ax] ?? transparentA;

                    const charB =
                        linesB[by]?.[bx] ?? transparentB;


                    // Both collision shapes occupy
                    // this character position.
                    if (
                        charA !== transparentA &&
                        charB !== transparentB
                    ) {
                        return true;
                    }
                }
    }


    return false;
}


/**
 * Get the collision shape of an object.
 *
 * If the object provides getCollisionMap(),
 * use that.
 *
 * Otherwise its visible ASCII representation
 * is automatically used as its collision shape.
 */
getCollisionShape(object) {

    if (
        typeof object.getCollisionMap === "function"
    ) {
        return object.getCollisionMap();
    }


    // Default:
    // visible ASCII == collision shape
    return object.getAscii();
}


getAsciiWidth(lines) {

    return Math.max(
        0,
        ...lines.map(line => line.length)
    );
}


// ==================================================
// Collision callbacks
// ==================================================

notifyCollision(a, b) {

    if (
        typeof a.onCollision === "function"
    ) {
        a.onCollision(b);
    }


    if (
        typeof b.onCollision === "function"
    ) {
        b.onCollision(a);
    }
}
}
