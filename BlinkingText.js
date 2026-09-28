class BlinkingText {

    constructor(x, y, text, interval) {
        this.x = x;
        this.y = y;
        this.z = 1;

        this.text = text;
        this.visible = true;

        // Toggles visibility every `interval` ms of game ticks.
        this.interval = interval;
        this.elapsed = 0;

        this.transparentChar = " ";
    }


    update(dt) {
        this.elapsed += dt;

        while (this.elapsed >= this.interval) {
            this.elapsed -= this.interval;
            this.visible = !this.visible;
        }
    }


    getAscii() {
        return this.visible ? this.text : "";
    }
}
