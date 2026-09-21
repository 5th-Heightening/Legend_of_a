class BlinkingText {

    constructor(x, y, text) {
        this.x = x;
        this.y = y;
        this.z = 1;

        this.text = text;
        this.visible = true;

        this.transparentChar = " ";
    }


    getAscii() {
        return this.visible ? this.text : "";
    }
}
