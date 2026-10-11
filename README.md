# Legend of A

A client-side ASCII-art game, plain classic `<script src>` files with
no build step, bundler, or server — open [Legend_of_a.html](Legend_of_a.html)
directly in a browser and it works. That constraint (double-click and
go) is also why this **isn't** ES modules: module scripts are blocked
by CORS when loaded from `file://`, so everything here relies on
classic scripts sharing one global scope instead, loaded in a specific
order (see "Load order" below).

## Files

One file per class, named to match, in the style already established
by `SplashScreen.js`/`SpeechBubble.js` before this split:

| File | Role |
|---|---|
| [Legend_of_a.html](Legend_of_a.html) | Page shell: CSS, the `<pre id="viewport">` + theme button markup, and the `<script src>` list in load order. No game logic of its own. |
| [AsciiRenderer.js](AsciiRenderer.js) | The renderer: object list, draw loop, collision primitives (`objectsCollide`, `detectCollisions`). |
| [GameLoop.js](GameLoop.js) | The single fixed-tick clock everything runs on — see "Game loop" below. |
| [World.js](World.js) | Set of all objects in play: adds/removes them to/from the renderer and calls `update(dt)` on each every tick. |
| [ParallaxObject.js](ParallaxObject.js) | Base class for scenery that shifts with the player — see "Parallax scenery" below. |
| [Tree.js](Tree.js), [Mountain.js](Mountain.js) | Scenery pieces, both `extends ParallaxObject`. |
| [Mover.js](Mover.js) | Movement state of one moving object: its one horizontal velocity, queued steps, sub-cell offset — see "Movement" below. |
| [MovingObject.js](MovingObject.js) | Base class for everything that moves (`Player`, `Enemy`): position + a `Mover`. |
| [MovementSystem.js](MovementSystem.js) | Moves every registered `MovingObject` once per tick, one cell at a time, against per-object rules. |
| [RubberBand.js](RubberBand.js) | Combat pull: player and enemy accelerate toward each other while in combat — see "Rubber band" below. |
| [Player.js](Player.js) | Player state (`extends MovingObject`): facing, `stance` and attack set up. |
| [PlayerController.js](PlayerController.js) | Arrow-key input → player steps / braking / charges / bracing for a block, sampled once per tick. |
| [Stance.js](Stance.js) | A fighter's attack or block (above, below, dash), drawn in front of its owner — see "Combat" below. |
| [Clash.js](Clash.js) | Decides a collision from both stances (firm / pushed / reflected) — see "Push" below. |
| [Bracing.js](Bracing.js) | Braking to a stop before a block, for player and enemy — see "Combat" below. |
| [SwordWindup.js](SwordWindup.js) | Short set up mark above/below the player before its above/below attack — see "Combat" below. |
| [EnemyTactics.js](EnemyTactics.js) | Which stance the enemy takes in combat, and when — see "Enemy" below. |
| [Ground.js](Ground.js) | Background floor plane. |
| [Enemy.js](Enemy.js) | Patrolling/combat enemy (`extends MovingObject`). |
| [DeathJump.js](DeathJump.js) | Death feedback: a dying character's copy jumps up and falls out of the play area — see "Push" below. |
| [Particle.js](Particle.js) | Short-lived drifting particle that decays through a random character sequence — see "Particles" below. |
| [Squiggle.js](Squiggle.js) | Decorative random-letter string grown from the player while `D` is held — see "Squiggle" below. |
| [BlinkingText.js](BlinkingText.js) | The "Press any key" title-screen prompt. |
| [SplashScreen.js](SplashScreen.js) | Title-screen logo. |
| [theme.js](theme.js) | Light/dark mode toggle — entirely independent of the game, see "Theme toggle" below. |
| [game.js](game.js) | Everything that isn't a class: renderer setup, object instantiation, `startGame()`, input handling, the push/combat/parallax orchestration functions. Loaded last, after every class. |
| [SpeechBubble.js](SpeechBubble.js) | Speech bubble renderable — **written but not yet wired in** (no `<script src>` in the HTML, never instantiated) |
| [logo.txt](logo.txt) | Scratch notes / ASCII sketches (player facing variants, color list). Not read by any code — a reference doodle pad, not an asset |

## Load order

Classic scripts share one global scope, so there's no `import`/
`export` making dependencies explicit — order in `Legend_of_a.html`'s
`<script src>` list is what makes this work, and getting it wrong
fails at the first `new` call, not at parse time:

1. `theme.js` first — independent of everything else, needs only the
   button element (already in the HTML above it).
2. `AsciiRenderer.js`, `GameLoop.js`, `World.js`, then
   `ParallaxObject.js`, then `Tree.js`/`Mountain.js` — in that order
   specifically, since `class Tree extends ParallaxObject` needs
   `ParallaxObject` to already exist.
3. `Mover.js`, `MovingObject.js`, `MovementSystem.js`,
   `RubberBand.js`, then `Player.js`, `PlayerController.js`, `Stance.js`, `Clash.js`,
   `Bracing.js`, `SwordWindup.js`, `EnemyTactics.js`, `Ground.js`, `Enemy.js`, `Squiggle.js`,
   `BlinkingText.js`, `SplashScreen.js`. `MovingObject.js` must come
   before `Player.js`/`Enemy.js` (they `extends MovingObject`).
   `Mover.js` only needs to exist by the time something is
   constructed, but keeping it first keeps it obvious. The rest
   just need to load before `game.js`.
4. `game.js` last, always — it's the only file whose top-level code
   actually runs immediately (instantiating `renderer`, `player`,
   `tree`, etc., registering the `keydown`/`keyup` listeners and
   starting the game loop as its very last line), and it references
   every class above by name.

Adding a new class file just means: pick a name matching the class,
add one `<script src>` line before `game.js` (before `Tree.js`/
`Mountain.js` too, only if the new class extends `ParallaxObject`).

## Theme toggle

The `#theme-toggle` button (top-right, fixed position) and
[theme.js](theme.js) are entirely separate from the game — they just
flip a `light-mode` class on `<html>` via
`classList.toggle`, and CSS variables (`--bg`, `--fg`,
`--viewport-bg`, `--viewport-fg`, defined on `:root` / `:root.light-mode`
in `<style>`) do the rest. No game object, renderer state, or
`localStorage` is involved — reloading the page always starts back in
dark mode.

## Rendering model

`AsciiRenderer` (in [AsciiRenderer.js](AsciiRenderer.js)) owns a
`width x height` character grid and a flat list of "game objects".
Every frame it:

1. Clears a blank buffer.
2. Sorts objects by `z` ascending (low z drawn first, so higher z
   paints over it).
3. For each object, splits `object.getAscii()` on `\n` and stamps each
   non-transparent character into the buffer at `(object.x + dx, object.y + dy)`.
4. Joins the buffer into one string and writes it to `element.textContent`.

**The object contract** — anything pushed via `renderer.add(obj)` just
needs:

- `x`, `y` — top-left position in grid cells
- `z` — draw order
- `getAscii()` — returns a `\n`-joined string
- `transparentChar` *(optional, defaults to `" "`)* — this character is
  skipped instead of drawn, so lower layers show through
- `getCollisionMap()` *(optional)* — if present, used instead of
  `getAscii()` for hit-testing (e.g. a decorative border that shouldn't
  block movement)
- `onCollision(other)` *(optional)* — called by
  `renderer.detectCollisions()` when two objects' shapes overlap

`renderer.objectsCollide(a, b)` is reused directly (see "Movement
collision" below) to block the player from walking into scenery.
`renderer.detectCollisions()` itself (the all-pairs sweep that calls
`onCollision`) still isn't called anywhere — it's there for whenever
hazards/pickups need an event rather than a hard block.

Current play area size is `41 x 18` (set where `AsciiRenderer` is
constructed), chosen because the splash art is 40 characters wide at
its widest line.

**Border:** the optional 4th constructor argument, `borderChar`
(`VIEWPORT_BORDER_CHAR`, `"#"`, in [game.js](game.js)), makes
`render()` wrap the finished buffer in a one-cell frame of that
character (`frame()`), so the play area's edges are visible. The
frame is outside the play area: `renderer.width`/`height` and all
game coordinates are unchanged, and nothing can be drawn onto or
collide with it. The `#viewport` CSS size in
[Legend_of_a.html](Legend_of_a.html) is the play area + 2 in each
direction (`43ch x 20em`). Change both together if the play area
size changes.

## Game loop

There is exactly one clock in the game: `loop`, a `GameLoop`
([GameLoop.js](GameLoop.js)) that calls `tick(dt)` in
[game.js](game.js) every `TICK_INTERVAL` (40ms). `dt` is always that
fixed interval, never the measured real time, so every duration in
the game (walk speed, push recovery, particle ageing) is counted in the same ticks, and the same situation
always plays out the same way. There are no other `setInterval`/
`setTimeout` calls anywhere. Anything timed keeps its own `elapsed`
counter and advances it in `update(dt)`.

One tick, in this order:

1. **Input** — `playerController.update(dt)` turns the arrow keys
   pressed/held since the last tick into a queued step, brakes the
   player's speed outside of combat, or adds a combat impulse (see
   "Push").
2. **Objects** — `world.update(dt)`: every object in the `World`
   ([World.js](World.js)) that has an `update(dt)` method runs it —
   enemy AI, particles, squiggle, title
   blink. Any object that sets `alive = false` is removed from the
   world *and* the renderer right there.
3. **Rubber band** — `rubberBand.update(dt)` pulls player and enemy
   toward each other while they're in combat (see "Rubber band").
4. **Movement** — `movement.update(dt)` moves every `MovingObject`
   (see "Movement" below).
5. **Combat** — `checkEnemyEncounter()`, once, after everything has
   moved.
6. **Draw** — `renderer.render()`, the only render call in the game.

Key handlers never move or render anything themselves. Arrow keys are
only recorded (the controller acts on them on the next tick), and
`W`/`S`/`D` create their objects right away, but those are drawn and
checked from the next tick on. Input is therefore at most one tick
(40ms) late, and always on the beat.

`world.add(obj)`/`world.remove(obj)` replace direct
`renderer.add`/`remove` calls for everything in play.

## Movement

Everything that moves on the grid `extends MovingObject`
([MovingObject.js](MovingObject.js)): `x`/`y`/`z`, a `mover`, a
`velocityX` getter (the mover's), and `previousX`/`previousY` (where
it stood before this tick's movement).

A `Mover` ([Mover.js](Mover.js)) has **one horizontal speed**,
`velocityX` (cells per second, signed). There is no separate
knockback: a push is just that speed pointing away from whoever
pushed. Everything that moves an object horizontally changes that
one value:

- `setVelocity(vx, vy)` — the enemy's patrol drive.
- `accelerate(dvx)` — the rubber band's pull, the player's combat
  impulse.
- `knock(vx)` — the outcome of a collision, sets it anew (and forgets
  the half-crossed cell).
- `brake(amount)` / `stop()` — braking toward 0 outside of combat,
  running into something.

On top of that, **queued steps** (`queueStep(dx, dy)`) move exactly
one cell on the next tick, for grid-exact movement like the player's
walk.

`advance(dt)` adds the velocities to a hidden sub-cell offset, takes
off the whole cells crossed and returns them (plus any queued step).
The fractional rest carries over to the next tick. The offset is
reset by `resetOffset()` (being blocked), `knock()` and `stop()`.

`MovementSystem` ([MovementSystem.js](MovementSystem.js)) owns the
list of moving objects. `movement.add(object, rules)` registers one
with optional rules:

- `canEnter(x, y)` — `false` blocks that step, drops the rest of the
  move on that axis, and resets the mover's offset
- `onBlocked(x, y)` — after a blocked step
- `onMoved(fromX, fromY)` — after every cell actually moved

Each tick it calls `mover.advance(dt)` and walks the object there
**one cell at a time** (x, then y), checking `canEnter` for each
cell. A fast push therefore can't tunnel through scenery. Objects
move in the order they were added (the player first, then the enemy),
and dead objects (`alive === false`) are dropped.

The rules for player and enemy are set in `registerMovement()` in
[game.js](game.js):

- **Player**: stays inside the viewport and doesn't enter scenery
  (`wouldCollideAt`, see "Movement collision"). Every step updates the
  parallax.
- **Enemy**: stays inside the display and doesn't enter scenery
  (`enemyFitsAt(x, y)`).
- **Both**: running into the border/scenery at `LETHAL_SPEED` (5
  cells/s) or more (`isFlying()`) kills — `killPlayer()` /
  `vanishEnemy()`. It doesn't matter where the speed comes from (a
  hit, the rubber band's pull, the player's impulse). Slower, the
  speed just stops (a patrolling enemy also turns around,
  `enemy.bump()`). The player's walking steps never kill; only a step
  along its own speed counts. Every cell crossed that fast leaves a
  push trace.
- Neither can step onto the other's cell (`occupies()`). They fight
  by touching, not by overlapping (see "Push"). Being blocked by the
  other's body leaves the speed alone — the encounter recalculates
  it.

To add another moving thing: `class Boulder extends MovingObject`,
steer it through `this.mover` in its `update(dt)`, `world.add()` it,
and `movement.add(boulder, { ...rules })`.

## Game state

Two phases, controlled by a single `gameStarted` flag and one
`keydown` listener. The loop runs in both. `tick()` only runs input,
movement and combat once `gameStarted` is set.

1. **Title screen** — `splash` (a `SplashScreen` instance) and
   `pressAnyKey` (a `BlinkingText`) are in the world. `pressAnyKey`
   toggles its own `visible` every `TITLE_BLINK_INTERVAL` (500ms) in
   `update(dt)`.
2. **Playing** — the first `keydown` calls `startGame()`, which removes
   the two title-screen objects, adds `ground`, `mountain`, `tree`,
   `enemy`, `player` to the world, registers the player and enemy
   with the movement system, and does one parallax update.

`BlinkingText` is a minimal renderable: `getAscii()` returns either its
text or `""` depending on `visible`, which flips on its own timer.
It's the pattern to copy for any other "blink/flash" effect.

## Player

`Player` (`extends MovingObject`) is a single character (`"A"`) at
`(x, y)`, `z = 20` (drawn on top of everything). Clamping bounds
(`PLAYER_MIN_X/MAX_X/MIN_Y/MAX_Y`, currently `0..width-1` / `0..height-1`)
live in [game.js](game.js), not on `Player`, since they're really
viewport bounds. They're enforced by the player's movement rules.

**Held-key movement** ([PlayerController.js](PlayerController.js)):
the key handlers only call `playerController.press(key, repeat)`/
`release(key)`. The OS key auto-repeat is ignored. Once per tick,
`update(dt)` looks at the arrows pressed since the last tick
(`presses`) and the ones still held (`heldArrows`, press order):

- a fresh press queues one step (`mover.queueStep`) on this tick
- a held key queues another step every `PlayerController.MOVE_INTERVAL`
  (120ms = 3 ticks)
- the most recently pressed arrow is the direction; releasing it falls
  back to the next one still held
- a tap pressed *and* released between two ticks still counts
- while pushed, the player keeps moving, except when holding the arrow
  against the push (digging in, see "Push")

A window `blur` drops all held arrows, since no `keyup` would arrive
for them.

`player.facing` is `"left"` or `"right"` (default `"right"`), set by
the controller whenever `ArrowLeft`/`ArrowRight` is the active
direction — `ArrowUp`/`Down` leave it untouched, and it updates even
if the move itself is blocked by a collision, since it's about which
way the player is turned, not whether they actually moved. While
pushed, `facing` doesn't change, so the player stays turned toward
where the push came from.

## Combat: attacks and blocks

*Experimental, branch `block-and-attack-fencing` (from
`rubber_band_fencing`).* There is no initiative and no shield. Each
fighter holds at most one **stance** (`player.stance`/`enemy.stance`,
set/cleared by `setStance()`/`clearStance()` in [game.js](game.js)):
an **attack** or a **block**, each from one of three directions —
**above**, **below** or **dash** (a charge straight ahead). Who wins a
collision is decided by [Clash.js](Clash.js), see "Push". Every
collision deletes all stances.

The directions beat each other in a circle, like
scissors-paper-rock (`Stance.BEATS`, winner → loser):

`dash → above → below → dash`

**`Stance`** ([Stance.js](Stance.js), `z = 25`) is drawn one cell in
front of its owner (along `facing`), on the row of its direction
(`Stance.ROWS`: above -1, below +1, dash 0) and glued to it via
getters. Chars (`Stance.CHARS`, written for facing right, mirrored
via `Stance.MIRRORED`): attack above `"/"`, below `"\"`, dash `"-"`;
every block `"]"`. A dash stance is on its owner's own row, so it
adds reach (`combatParts()`); above/below don't.

The player's stances:

- **Attack above/below** (`W`/`S`): `drawSword(direction)` first shows a
  set up ([SwordWindup.js](SwordWindup.js), `z = 26`, `"|"` straight
  above/below the player) for `SwordWindup.DURATION`, then takes the
  attack stance. The set up already counts as the attack in a
  collision (`playerCombatStance()`). The other key during the set up
  only changes its direction; with an attack held, `W`/`S` switch
  its direction at once. Key auto-repeat is ignored. Ignored while
  bracing (below).
- **Dash attack** (charge): in combat, every fresh arrow press
  *toward* the enemy adds `PlayerController.COMBAT_IMPULSE` to the
  speed and takes the dash attack (`hooks.charge()`).
- **Block**: in combat, holding the arrow *away* from the enemy
  braces: an attack (or set up) is dropped, and the player brakes by
  `Bracing.BRAKE` (60 cells/s², [Bracing.js](Bracing.js) — well above
  the rubber band's pull). A speed away from the enemy (after a push)
  isn't braked; the pull turns it around first. Once stopped, the
  player takes the block: **above** while `ArrowUp` is held,
  **below** while `ArrowDown` is held (the most recent one wins), else
  **dash**. Up/down don't step while bracing, and switch the block's
  direction at once while it's held. Releasing the arrow (or leaving
  combat) drops the block.

A fighter holding a block doesn't move: `holdBlockers()` stops its
`Mover` every tick, right after the rubber band's pull.
## Enemy

`Enemy` (`extends MovingObject`, `z = 15`, drawn as `"E"`) moves on
its own, independent of player input. It's constructed with its
`target` (the player). Its `update(dt)` runs every tick as part of
`world.update()` and only *decides* the velocity; the movement system
moves it afterwards. All speeds are in cells per second. Three cases,
checked in order:

1. **Combat** (`inCombat()`, see "Rubber band") — it doesn't touch
   its speed, the rubber band alone moves it. It only turns to face
   the player. Touching the player is what triggers
   `checkEnemyEncounter()`.
2. **Too fast to patrol** outside of combat (`|velocityX| >
   Enemy.PATROL_SPEED`, e.g. after a hit) — it brakes by
   `Enemy.BRAKE` (20 cells/s²).
3. **Patrol** (otherwise) — walk a fixed row back and forth between
   `minX`/`maxX` (`5`/`35` currently) at `Enemy.PATROL_SPEED` (2.5),
   reversing `direction` at either end.

`this.alive` starts `true` and flips to `false` in `vanishEnemy()`
(see "Push" below) once a knockback carries it into the border or the
environment. That also removes it from the world and the movement
system, so a vanished enemy is inert even though the `enemy` reference
itself is never reassigned/replaced.

**Enemy stances** ([EnemyTactics.js](EnemyTactics.js)): in combat,
`enemyTactics.update(dt)` picks the enemy's stance. After every
collision (`reset()`) it waits `EnemyTactics.DECISION_DELAY` (300 ms),
then chooses:

- with `COUNTER_CHANCE` (0.4), a stance that beats the player's
  current one (`Clash.favors()`: the player pushed back, or reflected
  while the enemy stands firm) — if the player shows a stance;
- otherwise an attack (`ATTACK_CHANCE`, 0.6) or a block, in a random
  direction.

Whenever the player shows a new stance, it chooses again
`REACTION_DELAY` (250 ms) later. An attack is taken at once; a dash
attack also charges toward the player with `CHARGE_IMPULSE` (4
cells/s). A block first brakes the enemy to a stop (`Bracing.brace()`,
same as the player), then holds for `BLOCK_DURATION` (1000 ms), then
the enemy drops it and chooses anew.

The enemy isn't in `parallaxObjects` (it has no corners, its position
isn't a function of the player) and isn't checked in `wouldCollideAt`.
Its body blocks the player through the movement rules instead (see
"Movement"). Touching it triggers the push, below.

Not done yet, deliberately out of scope for now:

- One enemy, one hardcoded patrol row — no patrol-path data structure,
  no spawning/despawning, no respawn once `alive` goes `false`.

## Push (knockback)

There is no separate knockback state. A push is just a fighter's one
horizontal speed (`mover.velocityX`, see "Movement") pointing away
from the other fighter. Every encounter **recalculates both speeds
from the current ones**, via `mover.knock(vx)`.

At the moment of contact, each side's speed toward the other
(negative while moving away) adds up to the **closing speed**. Both
stances decide, via `Clash.resolve(playerStance, enemyStance)`
([Clash.js](Clash.js)), what each side gets — as a speed *away* from
the other side:

- **firm**: 0 (stands its ground)
- **pushed** back: closing speed + `PLAYER_PUSH_IMPULSE` (6) /
  `ENEMY_PUSH_IMPULSE` (0)
- **reflected**: its own speed, turned around (× -1)

| Side A | Side B | Result |
|---|---|---|
| attack | attack, other direction | the losing direction (see `Stance.BEATS`) is pushed, the winner firm |
| attack | attack, same direction | both reflected |
| attack | block, same direction | attacker reflected, blocker firm |
| attack | block, other direction | blocker pushed, attacker firm |
| block | block | both reflected |
| any stance | none | the one without is pushed, the other firm |
| none | none | both reflected |

After every encounter both stances and the player's set up are
deleted, and the enemy chooses anew (`enemyTactics.reset()`).

**Encounter log:** with `LOG_ENCOUNTERS = true` (in
[game.js](game.js)), every encounter writes one line to the browser
console: both stances (`(set up)` for the player's set up), the rule
that decided, both outcomes and both resulting speeds away from the
other side, e.g.
`Encounter | player: attack above (set up) | enemy: block below | block misses, blocker pushed back: player firm, enemy pushed | speeds away: player 0.0, enemy 20.0 cells/s`.

On top of that, everyone who bounces off (result > 0) gets
`ENCOUNTER_PUSH` extra; whoever stands firm keeps 0. The fixed tick
loses a little speed on every bounce (the pull already brakes the
first tick after the reversal), and without this the fight would
slowly die down.

**Contact:** an encounter happens when the two sides *touch*, not
when they overlap. Each side is a list of parts (`combatParts()`):
its body plus its stance if that's a dash (held on the body's row).
`findContact()` looks for a player part and an enemy part on the
same row, at most `CONTACT_DISTANCE` (1) cells apart, i.e. on
adjacent cells. With a dash stance, a fighter touches the other one
two cells away. The collision particles burst at the player's
touching part (stance or body).

**Directions:** bodies never share a cell, so `enemySide` (-1/1,
which side of the player the enemy is on) comes straight from the
current positions. It falls back to where they stood before the tick
(`previousX`), then to `player.facing`, only in odd cases. The player
is pushed away from `enemySide`, the enemy toward it (i.e. away from
the player).

- `checkEnemyEncounter()` runs once per tick, after all movement, and
  only fires when both are alive, touching, and **closing in**
  (closing speed > 0). Right after an encounter they move apart, so
  staying in contact doesn't keep re-triggering it. Standing pressed
  together (a clinch), the pull closes in by a tiny amount every tick
  and the stances decide who bounces off.
- Running into the border/scenery fast enough kills, see "Movement".
  `vanishEnemy()` (and `killPlayer()`) call `playDeathJump()`: a
  `DeathJump` (`z = 30`, same character as the dead one) starts at
  the last cell and jumps straight up at `DeathJump.JUMP_SPEED` (18
  cells/s). `DeathJump.GRAVITY` (40 cells/s²) pulls it back down
  (peak ≈ 4 cells) until it has fallen below the play area's bottom
  edge, where it removes itself.
- In combat the speed doesn't brake on its own: the rubber band pulls
  both fighters together (see "Rubber band").
- Outside of combat the speed brakes toward 0:
  - Enemy: see "Enemy" — `Enemy.BRAKE` (20 cells/s²) until it can
    patrol again.
  - Player (balance, not control): the player keeps moving and
    steering. `PlayerController.brake()` takes
    `PlayerController.BRAKE` (10 cells/s²) off, scaled by the active
    arrow:
    - no arrow / up / down: normal pace; up/down step as usual
    - against the speed (**digging in**):
      `PlayerController.DIG_IN_FACTOR` (4) times harder, and the
      player doesn't step
    - along the speed (**riding it**): `PlayerController.RIDE_FACTOR`
      (1), and the player steps on top of it

    It's time-based on the held key, so mashing gives no advantage.

Known gaps / deliberate simplifications:

- The environment check for the enemy (`enemyFitsAt()`) uses each
  `parallaxObject`'s *current* rendered position, not a predicted one.
  That's fine because the player moves first in the tick and updates
  the parallax on every step.

## Rubber band (combat)

*Experimental, branch `rubber_band_fencing`.* `RubberBand`
([RubberBand.js](RubberBand.js)) pulls player and enemy toward each
other while they're **in combat**: both alive and at most
`RubberBand.COMBAT_ROW_DISTANCE` (1) rows apart (`engaged()`).

- **One speed per fighter, one constant acceleration.**
  `rubberBand.update(dt)` accelerates each fighter's `velocityX`
  toward the other by `RubberBand.ATTRACTION` (14.4 cells/s²). Moving
  apart (after a hit), that brakes it; then it swings back. The pull
  alone accelerates up to `RubberBand.MAX_PULL_SPEED` (8 cells/s)
  toward the other, but never brakes a faster approach.
  `speedToward(fighter)` is a fighter's speed toward the other one
  (negative while flying apart).
- **An encounter** (`checkEnemyEncounter()`) recalculates both speeds
  from the current ones, see "Push". Hitting a border or scenery at
  `LETHAL_SPEED` or more is deadly, pushed or pulled alike.
- **Arrow keys**: every fresh press toward the enemy adds
  `PlayerController.COMBAT_IMPULSE` (4 cells/s) once and takes the
  dash attack; holding the arrow away from the enemy braces for a
  block (see "Combat"). Left/right don't step in combat. Up/down step
  as usual (except while bracing), so moving 2 rows away leaves
  combat. The player always faces the enemy in combat.
- **Blocked** by something slower than `LETHAL_SPEED`: the speed
  stops (`mover.stop()`), then the pull builds up again. Blocked by
  the other's body: the speed stays, the encounter handles it.
- **One row apart** the two can't touch, so they swing past each
  other. The pull then points the other way and brakes them.
- **Leaving combat** keeps the speed; it just brakes from then on
  (see "Push").
- The enemy has no drive of its own in combat.

## Particles

`Particle` ([Particle.js](Particle.js), `z = 18`) picks one of
`Particle.SEQUENCES` (`"#Oo+-."`, `` "#O*°'´`" ``, `"#;:,."`) at random
and starts on its first character. Every `Particle.FRAME_DURATION`
(250ms) it jumps ahead 1 or 2 characters (50/50); running past the
end sets `alive = false`. Meanwhile it moves at a fixed speed (cells
per second) in a random direction chosen at creation. Position is
kept smooth in `posX`/`posY`; `x`/`y` are rounding getters, since the
renderer only accepts whole cells.

Particles are ordinary world objects. `spawnParticles(x, y, count,
speed?, gravitation?)` in [game.js](game.js) adds a burst to the
world, which calls `update(dt)` on each every tick and drops them
once `alive` is false.

Currently spawned in two places:

- `checkEnemyEncounter()` — a burst of `COLLISION_PARTICLE_COUNT` (3)
  at the player's position whenever a player/enemy collision actually
  triggers a push reaction.
- Push movement — the player's and the enemy's `onMoved` movement rule
  calls `leavePushTrace(fromX, fromY)` for every cell a push carries it
  out of, which with probability `TRACE_PARTICLE_DENSITY` (0.5) spawns
  one particle at `TRACE_PARTICLE_SPEED` (1) there, leaving a trace
  behind. An enemy that vanishes leaves no trace for that last cell,
  since it never lands.

## Squiggle

Holding `D` grows a `Squiggle` ([Squiggle.js](Squiggle.js), `z = 22`,
referenced as `player.squiggle`) from the tile right of the player:
one random letter from `Squiggle.CHARACTERS` (`"=-~+"`) every
`Squiggle.GROW_INTERVAL` (5ms), up to `Squiggle.MAX_LENGTH` (20).
The interval is shorter than a game tick, so its `update(dt)` adds
all the letters due for that tick at once.
Each letter is one column right of the previous one; the row only
changes (randomly one up, one down, or the same) on every
`Squiggle.DY_STEP_EVERY` (2nd) letter. Every tick re-rolls
the whole string (letters and path) at the new length; once it
reaches `Squiggle.MAX_LENGTH` it keeps being re-rolled at that
length, so it flickers for as long as `D` is held. It's glued to the player via getters
(it keeps its shape while the player moves) and is removed on
`keyup`. Purely decorative — no collision check reads it, so it
never affects combat. A missed `keyup` would leave it stuck on.

## Parallax scenery

This is the newest piece and the one most likely to need tuning or
extending.

**Idea:** background pieces don't have one fixed position. Each has 4
hand-placed positions — where it should sit when the player is
standing in each of the 4 corners of the movement area — and its
actual position each frame is the bilinear interpolation of those 4
corners, based on where the player currently is (normalized to `0..1`
on each axis). A piece whose 4 corners are far apart visually "moves a
lot" as the player walks around; a piece whose corners are close
together barely moves. That difference in movement speed between
layers is the whole parallax/pseudo-3D illusion — it needs at least
two layers with different spreads to be visible at all.

**`ParallaxObject`** (base class):

```js
new SomeLayer({
    topLeft:     { x, y },   // player at (minX, minY)
    topRight:    { x, y },   // player at (maxX, minY)
    bottomLeft:  { x, y },   // player at (minX, maxY)
    bottomRight: { x, y }    // player at (maxX, maxY)
})
```

- Constructor takes the 4 corners plus a `z`, and sets initial
  `x`/`y` to `topLeft` (overwritten on the first `updatePosition`
  call).
- `updatePosition(t, u)` does two horizontal lerps (top edge, bottom
  edge) then one vertical lerp between those results, rounds to
  integers (the grid only has integer cells), and stores the result in
  `x`/`y`.
- `getAscii()` is *not* provided by the base class — subclasses
  (`Tree`, `Mountain`) supply their own art, exactly like any other
  game object.

**Driving it:** `updateParallax()` (in [game.js](game.js)) computes
`t = (player.x - MIN_X) / (MAX_X - MIN_X)` and the equivalent `u` for
y, then calls `object.updatePosition(t, u)` for every entry in the
`parallaxObjects` array. It's called once in `startGame()` and after
every cell the player moves (its `onMoved` movement rule). **If you add a new layer, remember to add the
instance to `parallaxObjects` too** — being in the renderer's object
list only makes it draw, it doesn't make it move.

**Currently defined layers:**

| Layer | z | Corner spread | Behaves like |
|---|---|---|---|
| `mountain` | 1 | narrow (x: 10–22, y: 0–1) | distant background |
| `tree` | 10 | wide (x: 3–33, y: 3–5) | closer foreground |

Both sit between `ground` (`z = 0`) and `player` (`z = 20`).

### Extending it

To add another scenery piece:

1. `class Bush extends ParallaxObject { constructor(corners) { super(corners, someZ); } getAscii() { return "..."; } }`
2. Instantiate it with 4 corners (bigger spread = moves more = reads as
   closer; smaller spread = reads as farther away).
3. `world.add(instance)` in `startGame()`.
4. Push it into `parallaxObjects` so `updateParallax()` actually moves
   it *and* so it's checked for collisions (see below).
5. If the whole visible shape shouldn't block movement (e.g. only a
   tree's trunk, not its leafy canopy), override `getCollisionMap()`
   in the subclass — blank/space rows in that string are exactly as
   permeable as blank rows in `getAscii()`, just for hit-testing
   instead of drawing.

## Movement collision

Every `ParallaxObject` has a `getCollisionMap()` (inherited default:
same shape as `getAscii()` — the whole thing blocks). Since scenery
moves with the player (parallax), checking "does the player collide
with the environment" has to predict where each piece *would* be at
the player's candidate position, not where it currently is — otherwise
by the time you've moved next to a tree, the tree has already shifted
out from under you.

The player's `canEnter(x, y)` movement rule (see "Movement") checks,
for every single cell the player would move into:

1. That the cell is inside the viewport.
2. `wouldCollideAt(x, y)`:
   - Get `t`/`u` for that *candidate* position (same normalization
     `updateParallax()` uses).
   - For each object in `parallaxObjects`, call
     `object.interpolatePosition(t, u)` — a pure version of
     `updatePosition` that returns `{x, y}` instead of mutating the
     object — to get where it would render if the move went through.
   - Wrap the player and that hypothetical position in a lightweight
     `{x, y, getAscii, getCollisionMap?, transparentChar}` object via
     `makeCollisionProbe()`, and reuse `renderer.objectsCollide(a, b)`
     (the pixel-level shape overlap test that's already part of
     `AsciiRenderer`) to test them — no new collision math, just
     feeding the existing pairwise test a hypothetical instead of a
     real object.
3. Only if no probe collides does the movement system actually write
   `player.x`/`player.y`. The `onMoved` rule then calls
   `updateParallax()`.

`ground` is not in `parallaxObjects` and is never checked — it can't
block anything anyway, since its own `transparentChar` is `"."`, the
same character its art is made of, so it never draws (or collides)
regardless.

### Known rough edges / next steps

- Corner positions for `tree`/`mountain` were chosen by eyeballing the
  viewport size, not measured against actual play — worth tuning once
  you can see it running. The same goes for their collision maps
  (currently full-shape default): a trunk-only `getCollisionMap()` on
  `Tree` would probably feel better than blocking the whole canopy.
- `SpeechBubble.js` exists and looks feature-complete (word wrap,
  pointer aimed at a target object) but isn't loaded or used yet. To
  wire it in: add `<script src="SpeechBubble.js"></script>` next to
  the `SplashScreen.js` include, then `renderer.add(new SpeechBubble(x, y, "text", { target: someObject }))`.
- `renderer.detectCollisions()` (the all-pairs sweep + `onCollision`
  callback) is still never called — movement blocking uses
  `objectsCollide()` directly instead. `detectCollisions()` remains
  available for anything that should fire an *event* on overlap
  (pickups, hazards) rather than just prevent movement.
- No game-over / win condition, no scoring — this is still just a
  moving-around tech demo.
