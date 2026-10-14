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
// - both attack, by ATTACK_RULE:
//   - INITIATIVE: the same direction reflects both; otherwise the
//     side without the initiative (see Initiative.js) is pushed back,
//     the one with it stands firm (nobody holding it: both reflected)
//   - MATCH: the side `a` (the player) wins when both directions
//     are the same, otherwise `b` (the enemy) wins - the loser is
//     pushed back
//   - CIRCLE: the losing direction (see Stance.BEATS) is pushed
//     back; the same direction on both sides reflects both
// - attack against block: the same direction reflects the attacker,
//   a different one pushes the blocker back
// - both block: both reflected
// - only one has a stance: the one without is pushed back
// - neither has one: both reflected
class Clash {

    static FIRM = "firm";
    static PUSHED = "pushed";
    static REFLECTED = "reflected";

    // How attack against attack is decided - see the top of this file.
    static INITIATIVE = "initiative";
    static MATCH = "match";
    static CIRCLE = "circle";
    static ATTACK_RULE = Clash.INITIATIVE;

    // Which side holds the initiative, for resolve().
    static SIDE_A = "a";
    static SIDE_B = "b";


    // Returns { a, b, rule }: the outcome of each side, and which
    // rule decided (for the encounter log). `a` is the player's
    // stance, `b` the enemy's - with the MATCH rule the sides differ.
    // `initiative` is SIDE_A, SIDE_B or null (nobody) - only the
    // INITIATIVE rule reads it.
    static resolve(a, b, initiative = null) {

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

        if (attackA && attackB && Clash.ATTACK_RULE === Clash.INITIATIVE) {

            if (same) {
                return Clash.result(Clash.REFLECTED, Clash.REFLECTED, "swords match, both reflected");
            }

            if (initiative === Clash.SIDE_A) {
                return Clash.result(Clash.FIRM, Clash.PUSHED, "swords differ, player has the initiative");
            }

            if (initiative === Clash.SIDE_B) {
                return Clash.result(Clash.PUSHED, Clash.FIRM, "swords differ, enemy has the initiative");
            }

            return Clash.result(Clash.REFLECTED, Clash.REFLECTED, "swords differ, no initiative, both reflected");
        }

        if (attackA && attackB && Clash.ATTACK_RULE === Clash.MATCH) {
            return same
                ? Clash.result(Clash.FIRM, Clash.PUSHED, "swords match, player wins")
                : Clash.result(Clash.PUSHED, Clash.FIRM, "swords don't match, enemy wins");
        }

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


    // Does side `a` (the player's) come out ahead of `b` - `b` pushed
    // back, or `b` reflected while `a` stands firm?
    static favors(a, b) {
        const { a: outcomeA, b: outcomeB } = Clash.resolve(a, b);

        return outcomeB === Clash.PUSHED ||
            (outcomeB === Clash.REFLECTED && outcomeA === Clash.FIRM);
    }


    static result(a, b, rule) {
        return { a, b, rule };
    }
}
