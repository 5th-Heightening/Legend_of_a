// Moves every registered MovingObject once per game tick: asks its
// Mover how many whole cells to move, then walks it there one cell
// at a time (x first, then y). Every single cell is checked against
// the object's own rules, so fast movement (pushes) can't tunnel
// through anything.
//
// Rules, all optional, passed to add():
// - canEnter(x, y)          -> false blocks the step. The rest of
//                              the move on that axis is dropped, and
//                              the Mover forgets its half-crossed cell.
// - onBlocked(x, y)         -> called after a blocked step, with the
//                              cell that couldn't be entered.
// - onMoved(fromX, fromY)   -> called after every cell actually moved.
//
// Objects whose `alive` turns false are dropped automatically.
class MovementSystem {

    constructor() {
        this.entries = [];
    }


    // Objects move in the order they were added - relevant when one
    // object's rules depend on where another one is.
    add(object, rules = {}) {
        this.entries.push({ object, rules });
    }


    remove(object) {
        this.entries = this.entries.filter(entry => entry.object !== object);
    }


    update(dt) {

        for (const entry of [...this.entries]) {

            const { object } = entry;

            if (object.alive === false) {
                this.remove(object);
                continue;
            }

            object.previousX = object.x;
            object.previousY = object.y;

            const { dx, dy } = object.mover.advance(dt);

            this.walk(entry, dx, 0);
            this.walk(entry, 0, dy);
        }
    }


    walk(entry, dx, dy) {

        const { object, rules } = entry;

        const steps = Math.abs(dx) + Math.abs(dy);
        const stepX = Math.sign(dx);
        const stepY = Math.sign(dy);

        for (let i = 0; i < steps; i++) {

            if (object.alive === false) {
                return;
            }

            const fromX = object.x;
            const fromY = object.y;

            const toX = fromX + stepX;
            const toY = fromY + stepY;

            if (rules.canEnter && !rules.canEnter(toX, toY)) {
                object.mover.resetOffset();

                if (rules.onBlocked) {
                    rules.onBlocked(toX, toY);
                }

                return;
            }

            object.x = toX;
            object.y = toY;

            if (rules.onMoved) {
                rules.onMoved(fromX, fromY);
            }
        }
    }
}
