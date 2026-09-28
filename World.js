// Every game object that's currently in play. Adding an object here
// also adds it to the renderer; update(dt), called once per game
// tick, advances every object that has an update(dt) method. An
// object that sets `alive` to false is dropped from both the world
// and the renderer in that same update, so short-lived objects
// (particles, sword swings) can simply expire on their own.
class World {

    constructor(renderer) {
        this.renderer = renderer;
        this.objects = new Set();
    }


    add(object) {

        if (this.objects.has(object)) {
            return object;
        }

        this.objects.add(object);
        this.renderer.add(object);

        return object;
    }


    remove(object) {

        if (!this.objects.has(object)) {
            return;
        }

        this.objects.delete(object);
        this.renderer.remove(object);
    }


    update(dt) {

        // Iterate a snapshot: updates may add or remove objects.
        for (const object of Array.from(this.objects)) {

            // Removed by an earlier object's update this tick.
            if (!this.objects.has(object)) {
                continue;
            }

            if (typeof object.update === "function") {
                object.update(dt);
            }

            if (object.alive === false) {
                this.remove(object);
            }
        }
    }
}
