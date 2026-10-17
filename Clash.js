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
// - both have the same stance: whoever has taken it later stops,
//   the other one is pushed back
// - both have different stances: both are pushed back
// - neither has one: both are pushed back
class Clash {

    static STOPPED = "stopped";
    static PUSHED = "pushed";

    // Which side has taken its stance later, for resolve().
    static SIDE_A = "a";
    static SIDE_B = "b";


    // Returns { a, b, rule }: the outcome of each side, and which
    // rule decided (for the encounter log). `later` is SIDE_A, SIDE_B
    // or null - the side that has taken its stance later.
    static resolve(a, b, later = null) {

        if (!a && !b) {
            return Clash.result(Clash.PUSHED, Clash.PUSHED, "no stances, both pushed back");
        }

        if (!a || !b) {
            return a
                ? Clash.result(Clash.STOPPED, Clash.PUSHED, "only one stance, the other is pushed back")
                : Clash.result(Clash.PUSHED, Clash.STOPPED, "only one stance, the other is pushed back");
        }

        if (a.direction !== b.direction) {
            return Clash.result(Clash.PUSHED, Clash.PUSHED, "different stances, both pushed back");
        }

        if (later === Clash.SIDE_A) {
            return Clash.result(Clash.STOPPED, Clash.PUSHED, "same stance, player was later");
        }

        if (later === Clash.SIDE_B) {
            return Clash.result(Clash.PUSHED, Clash.STOPPED, "same stance, enemy was later");
        }

        return Clash.result(Clash.PUSHED, Clash.PUSHED, "same stance, nobody later, both pushed back");
    }


    static result(a, b, rule) {
        return { a, b, rule };
    }
}
