// Walks back and forth along a fixed row between minX and
// maxX, reversing direction at either end. Movement isn't
// driven by player input - see the patrol timer in the game
// section.
class Enemy {

    constructor(x, y, minX, maxX) {
        this.x = x;
        this.y = y;
        this.z = 15;

        this.minX = minX;
        this.maxX = maxX;

        this.direction = 1;
    }


    getAscii() {
        return "E";
    }


    step() {
        this.x += this.direction;

        if (this.x >= this.maxX) {
            this.x = this.maxX;
            this.direction = -1;
        }
        else if (this.x <= this.minX) {
            this.x = this.minX;
            this.direction = 1;
        }
    }
}
