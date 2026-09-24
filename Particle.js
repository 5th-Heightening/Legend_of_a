// A single short-lived particle: drifts at a fixed speed in a
// random direction while "decaying" through one of a few character
// sequences. Starts on the sequence's first character and, every
// PARTICLE_FRAME_DURATION ms, jumps ahead 1 or 2 characters at
// random. Once it runs past the end of its sequence it's dead
// (alive = false) - removing it from the renderer and the particle
// array is done by the driving loop in game.js, same as Enemy.
class Particle {

    static SEQUENCES = ["Oo+-.", "O*°'´`", ";:,.", ">v<^>v<^>", "%=\"'"];

    // "\\|/-\\|/-" rotating particle
    //  ["#Oo+-.", "#O*°'´`", "#;:,."];

    static FRAME_DURATION = 100; // 750;

    constructor(x, y, speed, gravitation) {

        // Smooth (fractional) position - the renderer only takes
        // whole cells, so x/y below are the rounded view of these.
        this.posX = x;
        this.posY = y;
        this.z = 18;

        // Fixed speed (cells per second) in a random direction.
        const angle = Math.random() * Math.PI * 2;
        this.velocityX = Math.cos(angle) * speed;
        this.velocityY = Math.sin(angle) * speed;

        this.gravitation = gravitation;

        this.sequence = Particle.SEQUENCES[
            Math.floor(Math.random() * Particle.SEQUENCES.length)
        ];
        this.index = 0;

        // Time (ms) accumulated toward the next character jump.
        this.frameTime = 0;

        this.alive = true;
    }


    get x() {
        return Math.round(this.posX);
    }


    get y() {
        return Math.round(this.posY);
    }


    getAscii() {
        return this.alive ? this.sequence[this.index] : "";
    }


    // Advances the particle by dt milliseconds: moves it, and steps
    // through its sequence once per FRAME_DURATION elapsed. Flips
    // alive to false once the index runs off the end.
    update(dt) {

        if (!this.alive) {
            return;
        }

        this.posX += this.velocityX * dt / 1000;
        this.posY += this.velocityY * dt / 1000;

        this.frameTime += dt;

        if (this.gravitation) {
            this.velocityY += PARTICLE_GRAVITATION * dt / 1000;
        }

        while (this.frameTime >= Particle.FRAME_DURATION) {
            // fixed step, random ageing
            this.frameTime -= Particle.FRAME_DURATION;
            this.frameTime += Particle.FRAME_DURATION * .5 * Math.random();
            
            this.index += 1;
            if (this.index >= this.sequence.length) {
                this.alive = false;
                return;
            }
        }
    }
}
