I think most of the clunkiness comes from how the fight is built, not from the push idea itself. Here's what I see in the current code, and what I'd change.

## Why it feels clunky

1. **Four separate clocks.** The enemy moves every 400 ms, pushes update every 200 ms, the player moves every 120 ms, and a sword swing lasts 240 ms. A hit is only checked when the enemy or player takes a step. So whether your sword was out at the moment of impact depends partly on luck, not skill.
2. **Hits need the bodies to overlap.** The swords are drawn one tile in front, but that tile never hits anything. The only thing that counts is both characters landing on the same cell. So it plays like a bumper-car game with weapon modifiers, not fencing, where the whole game is keeping the right distance.
3. **No warning, no response.** The enemy draws its sword by distance and timer, with no wind-up you can read and react to. Without a "see it coming → answer it" moment, the player has nothing to master.
4. **Getting hit takes away control.** While you're pushed you can't move, only tap to cancel it. So every hit you take means a stretch of not playing.
5. **Hits don't feel like hits.** There are a few particles, but no pause, flash or shake, so impacts feel weightless.



## Ideas, most important first

**1. Implemented: One game tick for everything** (e.g. 50–100 ms). Enemy movement, pushes, weapon timing and hit checks all advance on the same beat. Timing then becomes predictable and learnable. Your "next steps" notes already suggested this.

**2. Attacks in three phases, with reach-based hits.** Each attack gets a wind-up (visible), a short active window, and a recovery.
- A hit happens when the sword's tile touches the opponent, not when the bodies overlap. This makes distance matter.
- The enemy's wind-up is the warning: the `E` changes, or a `'` appears above it, for a few ticks before the `-` lashes out.
- Its speed-up run-up turns into a lunge: slow approach, stop at striking distance, wind up, strike.

**3. Parry by timing instead of holding.** Pressing the shield just before the enemy's active window is a parry: a big push for the enemy and you don't move at all. Holding the shield all the time only half-blocks: both of you slide back a little. Now the shield is a skill, not a toggle you can keep pressed.

**4. Implemented: Push as losing your balance, not losing control.** While pushed, you keep moving and steering. Pressing *toward* the enemy digs in and slows you down faster. Pressing *away* rides the push (a retreat you choose). Mashing any key goes away. The fight becomes a game of footing.

**5. Implemented: Knock-outs, like sumo.** Enemies already die when pushed into the border or scenery. Make that the main way to win, and make it apply to the player too. Then every push matters and the arena's layout becomes part of the fight. To make it readable, mark the danger zones, e.g. the tree's collision area and the screen edges.

**6. Make hits feel like hits.**
- **Hit-stop:** freeze the whole game for 60–100 ms on a hit.
- **Flash:** briefly swap the hit character, e.g. `E` → `*`.
- **Shake:** move the viewport by one character for a frame.

These are cheap to build and have a big effect on how it feels.

**7. Give the enemy a rhythm.** Its AI can cycle through a few states: keep its distance (hover 3–4 tiles away), step in, wind up, strike, recover, back off. The recovery phase is the player's opening to attack. Without openings, there's nothing to read.

## Where I'd start

Start with **1 + 2 + 6**: one tick, three-phase attacks with reach-based hits, and hit-stop. That should give the "measure the distance, read the enemy, strike at the right moment" feel, and the other ideas can then be added one by one. The push system stays; it just becomes the result of a hit instead of the whole fight.

Shall I prototype that first step? It would mostly be a new tick loop in `game.js` plus a small attack-state class, and the old collision rules would be replaced by reach-based hits.