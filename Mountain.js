class Mountain extends ParallaxObject {

    constructor(corners) {
        super(corners, 1);
    }


    getAscii() {
        return `
    /\\
 /\\/ ,\\
/______\\`;
    }
}
