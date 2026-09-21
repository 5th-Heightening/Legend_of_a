class Ground {

    constructor() {
        this.x = 0;
        this.y = 0;
        this.z = 0;

        this.transparentChar = ".";
    }


    getAscii() {
        const row = ".".repeat(41);

        return "\n" + Array(18).fill(row).join("\n");
    }
}
