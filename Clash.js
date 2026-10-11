// Decides a collision of two fighters from their stances alone - no
// speeds, no positions (game.js turns the outcome into speeds, see
// checkEnemyEncounter()). A stance is anything with { kind, direction }
// (see Stance.js), or null for none.
//
// Each side ends up with one OUTCOME:
// - FIRM: stands its ground
// - PUSHED: pushed back
// - REFLECTED: bounces off with its own speed, turned around
//
// The rules:
// - both attack: the losing direction (see Stance.BEATS) is pushed
//   back; the same direction on both sides reflects both
// - attack against block: the same direction reflects the attacker,
//   a different one pushes the blocker back
// - both block: both reflected
// - only one has a stance: the one without is pushed back
// - neither has one: both reflected
class Clash {

    static FIRM = "firm";
    static PUSHED = "pushed";
    static REFLECTED = "reflected";


    // Returns { a, b, rule }: the outcome of each side, and which
    // rule decided (for the encounter log).
    static resolve(a, b) {

        if (!a && !b) {
            return Clash.result(Clash.REFLECTED, Clash.REFLECTED, "no stances, both reflected");
        }

        if (!a || !b) {
            return a
                ? Clash.result(Clash.FIRM, Clash.PUSHED, "only one stance, the other is pushed back")
                : Clash.result(Clash.PUSHED, Clash.FIRM, "only one stance, the other is pushed back");
        }

        const attackA = a.kind === Stance.ATTACK;
        const attackB = b.kind === Stance.ATTACK;
        const same = a.direction === b.direction;

        if (attackA && attackB) {

            if (Stance.beats(a.direction, b.direction)) {
                return Clash.result(Clash.FIRM, Clash.PUSHED, `${a.direction} beats ${b.direction}`);
            }

            if (Stance.beats(b.direction, a.direction)) {
                return Clash.result(Clash.PUSHED, Clash.FIRM, `${b.direction} beats ${a.direction}`);
            }

            return Clash.result(Clash.REFLECTED, Clash.REFLECTED, "same attacks, both reflected");
        }

        if (attackA !== attackB) {

            if (same) {
                return attackA
                    ? Clash.result(Clash.REFLECTED, Clash.FIRM, "block matches, attacker reflected")
                    : Clash.result(Clash.FIRM, Clash.REFLECTED, "block matches, attacker reflected");
            }

            return attackA
                ? Clash.result(Clash.FIRM, Clash.PUSHED, "block misses, blocker pushed back")
                : Clash.result(Clash.PUSHED, Clash.FIRM, "block misses, blocker pushed back");
        }

        return Clash.result(Clash.REFLECTED, Clash.REFLECTED, "both block, both reflected");
    }


    // Does side `a` come out ahead of `b` - `b` pushed back, or `b`
    // reflected while `a` stands firm?
    static favors(a, b) {
        const { a: outcomeA, b: outcomeB } = Clash.resolve(a, b);

        return outcomeB === Clash.PUSHED ||
            (outcomeB === Clash.REFLECTED && outcomeA === Clash.FIRM);
    }


    static result(a, b, rule) {
        return { a, b, rule };
    }
}
