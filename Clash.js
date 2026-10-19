// Decides a collision of two fighters from their attack stances alone
// - no speeds, no positions (game.js turns the outcome into speeds,
// see checkEnemyEncounter()). A stance is anything with a
// `direction` (see Stance.js), or null for none.
//
// Each side ends up with one OUTCOME:
// - STOPPED: stops where it is
// - PUSHED: pushed back
//
// The rules:
// - only one has a stance: it stops, the other one is pushed back
// - both have the same stance: both are pushed back
// - both have different stances: whoever holds the initiative (see
//   Initiative.js) stops, the other one is pushed back - both are
//   pushed back if nobody holds it
// - neither has one: both are pushed back
class Clash {

    static STOPPED = "stopped";
    static PUSHED = "pushed";

    // Which side holds the initiative, for resolve().
    static SIDE_A = "a";
    static SIDE_B = "b";


    // Returns { a, b, rule }: the outcome of each side, and which
    // rule decided (for the encounter log). `later` is SIDE_A, SIDE_B
    // or null - the side that holds the initiative.
    static resolve(a, b, later = null) {

        if (!a && !b) {
            return Clash.result(Clash.PUSHED, Clash.PUSHED, "no stances, both pushed back");
        }

        if (!a || !b) {
            return a
                ? Clash.result(Clash.STOPPED, Clash.PUSHED, "only one stance, the other is pushed back")
                : Clash.result(Clash.PUSHED, Clash.STOPPED, "only one stance, the other is pushed back");
        }

        if (a.direction === b.direction) {
            return Clash.result(Clash.PUSHED, Clash.PUSHED, "same stance, both pushed back");
        }

        if (later === Clash.SIDE_A) {
            return Clash.result(Clash.STOPPED, Clash.PUSHED, "different stances, player has initiative");
        }

        if (later === Clash.SIDE_B) {
            return Clash.result(Clash.PUSHED, Clash.STOPPED, "different stances, enemy has initiative");
        }

        return Clash.result(Clash.PUSHED, Clash.PUSHED, "different stances, no initiative, both pushed back");
    }


    static result(a, b, rule) {
        return { a, b, rule };
    }
}
