/**

*/

class SpeechBubble {

    constructor(x, y, text, options = {}) {
        this.x = x;
        this.y = y;

        this.z = options.z ?? 100;

        this.maxWidth = options.maxWidth ?? 30;

        this.pointerType = options.pointerType ?? "V";

        // Position of the pointer relative to the bubble.
        // null means centered.
        this.pointerPosition = options.pointerPosition ?? null;

        // Alternatively point at another game object.
        this.target = options.target ?? null;

        this.transparentChar =
            options.transparentChar ?? " ";

        this.text = text;
    }


    getAscii() {
        const lines = this.wrapText(
            this.text,
            this.maxWidth
        );

        const width = Math.max(
            ...lines.map(line => line.length)
        );

        const result = [];

        // Top border
        result.push(
            `┌${"─".repeat(width + 2)}┐`
        );


        // Text
        for (const line of lines) {
            result.push(
                `│ ${line.padEnd(width)} │`
            );
        }


        // Bottom border
        result.push(
            `└${"─".repeat(width + 2)}┘`
        );


        // Pointer
        const pointerPosition =
            this.getPointerPosition(width);


        if (this.pointerType === "V") {

            result.push(
                this.createPointerLine(
                    width + 2,
                    pointerPosition,
                    "V"
                )
            );
        }

        else if (this.pointerType === "\\/") {

            result.push(
                this.createPointerLine(
                    width + 2,
                    pointerPosition,
                    "\\/"
                )
            );
        }


        return result.join("\n");
    }


    /**
     * Determine where the pointer should appear.
     *
     * Position is relative to the inside of the box.
     */
    getPointerPosition(width) {

        // Explicit position wins.
        if (this.pointerPosition !== null) {
            return Math.max(
                0,
                Math.min(this.pointerPosition, width)
            );
        }


        // If we have a target, calculate its
        // horizontal position relative to the bubble.
        if (this.target) {

            const targetX = this.target.x;

            const relativeX =
                targetX - this.x - 1;

            return Math.max(
                0,
                Math.min(relativeX, width)
            );
        }


        // Default: center.
        return Math.floor(width / 2);
    }


    /**
     * Create the line containing the pointer.
     */
    createPointerLine(totalWidth, position, pointer) {

        // Pointer is positioned relative to
        // the left edge of the box.
        const pointerLength = pointer.length;

        let start = position;

        // Keep the pointer inside the line.
        if (start + pointerLength > totalWidth) {
            start = totalWidth - pointerLength;
        }

        start = Math.max(0, start);


        return (
            " ".repeat(start) +
            pointer +
            " ".repeat(totalWidth - start - pointerLength)
        );
    }


    wrapText(text, maxWidth) {

        const words = text.split(/\s+/);

        const lines = [];

        let currentLine = "";


        for (const word of words) {

            const candidate =
                currentLine.length === 0
                    ? word
                    : currentLine + " " + word;


            if (candidate.length <= maxWidth) {
                currentLine = candidate;
            }
            else {

                if (currentLine.length > 0) {
                    lines.push(currentLine);
                }

                currentLine = word;
            }
        }


        if (currentLine.length > 0) {
            lines.push(currentLine);
        }


        return lines;
    }
}

