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
| [ParallaxObject.js](ParallaxObject.js) | Base class for scenery that shifts with the player — see "Parallax scenery" below. |
| [Tree.js](Tree.js), [Mountain.js](Mountain.js) | Scenery pieces, both `extends ParallaxObject`. |
| [Player.js](Player.js) | Player state: position, facing, a `push` field, and `sword`/`shield` weapon references. |
| [Sword.js](Sword.js), [Shield.js](Shield.js) | Combat visuals, both take a `player` reference in their constructor. |
| [Ground.js](Ground.js) | Background floor plane. |
| [Enemy.js](Enemy.js) | Patrolling/combat enemy. |
| [EnemySword.js](EnemySword.js) | The enemy's `-` sword, glued to the enemy — see "Enemy" below. |
| [Push.js](Push.js) | Knockback state (speed, direction, recovery) shared by `Player` and `Enemy`. |
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
2. `AsciiRenderer.js`, then `ParallaxObject.js`, then `Tree.js`/
   `Mountain.js` — in that order specifically, since `class Tree
   extends ParallaxObject` needs `ParallaxObject` to already exist.
3. `Push.js`, `Player.js`, `Sword.js`, `Shield.js`, `Ground.js`,
   `Enemy.js`, `EnemySword.js`, `Squiggle.js`, `BlinkingText.js`, `SplashScreen.js` — no `extends`
   between them, but `Push.js` has to come before `Player.js`/
   `Enemy.js` since their constructors do `new Push()`. Otherwise
   their relative order doesn't matter; they just all need to load
   before `game.js`.
4. `game.js` last, always — it's the only file whose top-level code
   actually runs immediately (instantiating `renderer`, `player`,
   `tree`, etc. and registering the `keydown`/`keyup` listeners), and
   it references every class above by name.

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

Current viewport size is `41 x 18` (set where `AsciiRenderer` is
constructed), chosen because the splash art is 40 characters wide at
its widest line.

## Game state

Two phases, controlled by a single `gameStarted` flag and one
`keydown` listener:

1. **Title screen** — `splash` (a `SplashScreen` instance) and
   `pressAnyKey` (a `BlinkingText`) are added to the renderer.
   `pressAnyKey.visible` is toggled by `blinkTimer` (a 500ms
   `setInterval`) and re-rendered each toggle.
2. **Playing** — the first `keydown` calls `startGame()`, which stops
   the blink timer, removes the two title-screen objects, adds
   `ground`, `mountain`, `tree`, `enemy`, `player`, starts the enemy's
   patrol timer, and does one parallax update + render. Every keydown
   *after* that runs the arrow-key
   switch, clamps the player into the viewport, recomputes parallax,
   and re-renders.

`BlinkingText` is a minimal renderable: `getAscii()` returns either its
text or `""` depending on `visible`. It has no other behavior — it's
the pattern to copy for any other "blink/flash" effect.

## Player

`Player` is a single character (`"A"`) at `(x, y)`, `z = 20` (drawn on
top of everything). `move(dx, dy)` (adds to `x`/`y`) exists as a plain
primitive but isn't called by the input handler directly anymore — see
"Movement collision" below for why. Clamping bounds
(`PLAYER_MIN_X/MAX_X/MIN_Y/MAX_Y`, currently `0..width-1` / `0..height-1`)
live in [game.js](game.js), not on `Player`, since they're really
viewport bounds.

**Held-key movement:** the OS key auto-repeat (one step, a pause,
then fast repeats) is ignored (`event.repeat`). Instead the arrow
keys currently held are tracked in `heldArrows` (press order), and
`pressArrow()` on a fresh press steps once right away and (re)starts
`moveTimer`, which calls `stepPlayer()` every `PLAYER_MOVE_INTERVAL`
(120ms) — a constant speed for as long as the key is held. The last
pressed, still-held arrow is the direction walked; releasing it
(`releaseArrow()` on `keyup`) falls back to the next one still held,
and the timer stops once none are. A window `blur` drops all held
arrows, since no `keyup` would arrive for them.

`player.facing` is `"left"` or `"right"` (default `"right"`), set only
by `ArrowLeft`/`ArrowRight` steps in `stepPlayer()` — `ArrowUp`/`Down`
leave it untouched, and it updates even if the move itself is blocked
by a collision, since it's about which way the player is turned, not
whether they actually moved.

## Combat: sword and shield

Both live one tile out from the player, on whichever side
`player.facing` currently points, and neither is affected by movement
collision (`wouldCollideAt` only checks `parallaxObjects`) or by
parallax — they're relative to the player, not scenery. Both are also
glued to the player via getters rather than a captured position, and
both are referenced from `player.sword`/`player.shield` (set/cleared
by `swingSword()`/`showShield()`/`hideShield()` in `game.js`, which
also add/remove them from the renderer) rather than module-level
variables — "which weapon is out" is state that belongs to the
character.

- **`Sword`** (`W`, in the `keydown` handler's `swingSword()`) is a
  one-shot, timer-driven animation: on press it's added to the
  renderer, `setTimeout` flips its `frame` from `"slash"` to `"dash"`
  after `SWORD_FRAME_DURATION` (120ms), and a second `setTimeout`
  removes it after another 120ms. `player.sword` doubles as a
  re-entrancy guard — `swingSword()` no-ops while it's non-null — and
  the `keydown` handler also checks `!event.repeat`, so holding `W`
  down triggers exactly one swing per physical press, not continuous
  OS key-repeat swings. Like `Shield`, its `x`/`y` and (while still in
  the `"slash"` frame) its `"/"`/`"\"` character are getters reading
  `player.x`/`player.y`/`player.facing` live, so a swing that outlasts
  a move — or a facing change — stays glued to the player instead of
  hanging in the air at wherever the swing started.
- **`Shield`** (`A`, held) is the opposite: no timer, glued to the
  player for as long as the key is down. Its `x`/`y`/`getAscii()` are
  getters reading `player.x`/`player.y`/`player.facing` live, so it
  stays correctly positioned through any moves made while `A` is held,
  with no per-move update needed. `showShield()` on `keydown` and
  `hideShield()` on a separate `keyup` listener add/remove it;
  `showShield()` is idempotent (checks `player.shield` first) so
  repeated auto-repeat keydowns while holding `A` are harmless.
  Character is `"["` when facing left, `"]"` when facing right.

Known gap: if the browser never delivers a `keyup` for `A` (e.g. focus
leaves the page while it's held), the shield can get stuck on. There's
no blur-handler safety net for that yet.

## Enemy

`Enemy` (`enemy`, `z = 15`, drawn as `"E"`) is the first game object
that moves on its own, independent of player input. `startGame()`
starts a `setInterval` (`ENEMY_STEP_INTERVAL`, 400ms) that calls
`enemy.step(player)` + `checkEnemyEncounter()` + `renderer.render()`
on its own cadence — this is the first thing in the game that
re-renders without a keypress causing it, so it's also the first
evidence that `renderer.render()` is cheap enough to call from
multiple independent timers without coordination.

`step(player)` has three cases, checked in order:

1. **Mid-push** (`this.push.active()`) — leave `x` alone. A dedicated
   push loop in `game.js` (see "Push" below) is moving it instead.
2. **Combat mode** (`player.y === this.y`, same row) — patrolling
   stops and `approach(player)` runs instead: it turns to face the
   player and closes in, slowly accelerating. `approachSpeed` (cells
   per tick, fractional, with a hidden `approachOffset` like `Push`)
   starts at `Enemy.APPROACH_START_SPEED` (0.5), grows by
   `Enemy.APPROACH_ACCELERATION` (0.25) per tick, capped at
   `Enemy.APPROACH_MAX_SPEED` (2). It never moves past `player.x` —
   it stops right on the player (colliding there is what feeds
   `checkEnemyEncounter()`). The run-up resets (`resetApproach()`)
   when it turns around, is pushed, or goes back to patrolling.
   `enemy.speed` (getter) is `approachSpeed` while approaching, else
   `Enemy.PATROL_SPEED` (1).
3. **Patrol** (otherwise) — the original behavior: walk a fixed row
   back and forth between `minX`/`maxX` (`5`/`35` currently),
   reversing `direction` at either end.

`this.alive` starts `true` and flips to `false` in `vanishEnemy()`
(see "Push" below) once a knockback carries it into the border or the
environment; `game.js` checks it before stepping, colliding, or
pushing the enemy any further, so a vanished enemy is inert even
though the `enemy` reference itself is never reassigned/replaced.

**Enemy sword:** each enemy tick, `updateEnemySword()` (in
[game.js](game.js)) draws an `EnemySword` (`"-"`, one tile in front
of the enemy along `direction`, `z = 25`) when the enemy is alive,
not pushed, on the player's row, within `ENEMY_SWORD_DRAW_DISTANCE`
(2) cells, and `enemy.swordReadyAt` has passed. `sheathEnemySword()`
removes it after `ENEMY_SWORD_DURATION` (1200ms) and sets
`swordReadyAt` to now + `ENEMY_SWORD_COOLDOWN` (800ms). `enemy.sword`
is the current sword or `null`, mirroring `player.sword`; whether it's
out at the moment of impact changes the collision outcome (see "Push"
below).

The enemy isn't in `parallaxObjects` (it has no corners, its position
isn't a function of the player) and isn't checked in `wouldCollideAt`
— walking into it never blocks the player's movement. What it *does*
trigger on contact is the push, below.

Not done yet, deliberately out of scope for now:

- No interaction with `Sword`/`Shield` — nothing currently checks
  whether a swing overlaps the enemy, or changes the collision outcome
  while `Shield` is up (see "Push" below for the one reaction that
  does exist). `renderer.getCollisionShape()`'s default (fall back to
  `getAscii()`) already works for `Enemy` with no changes needed once
  that's wired up.
- Combat-mode closing-in isn't checked against `parallaxObjects`
  either — an enemy chasing the player through where a tree stands
  just walks straight through it, same as patrol movement always has.
- One enemy, one hardcoded patrol row — no patrol-path data structure,
  no spawning/despawning, no respawn once `alive` goes `false`.

## Push (knockback)

`Push` ([Push.js](Push.js)) is a small reusable class — `speed` (cells
per tick, may be fractional, `0` = inactive), `direction` (`-1`/`1`),
a hidden sub-cell `offset`, and `recoverProgress` — with `active()`,
`start(direction, speed)`, `stop()`, `step()`, and
`recoverStep(pressesPerPoint)` methods.

**Smooth position:** the owner's `x` stays an integer grid cell, but
each tick `step()` adds `direction * speed` to `offset` (the "smooth"
position relative to that cell), takes off whatever whole cells were
crossed (`Math.trunc`), and returns them. Only that integer amount
actually moves the owner; the fractional rest carries over to the
next tick. So speed `0.5` moves one cell every other tick, `1.5`
alternates 1 and 2 cells, and integer speeds behave exactly as
before. `offset` is reset on `start()`/`stop()`. Both `Player`
and `Enemy` hold one as `this.push`; `game.js` never touches
speed/direction fields directly, only these methods, so the knockback
rules themselves live on the class and `game.js` just orchestrates
*when* to call them.

The reaction to a player/enemy collision, resolved by both sides'
weapons at the moment of impact. "Enemy speed" is `enemy.speed`
(current approach speed, or 1 while patrolling); the player's speed
is `PLAYER_SWORD_SPEED` (3), the force of its swing:

| Player | Enemy | Player result | Enemy result |
|---|---|---|---|
| shield up (reflector) | any | unaffected | knocked back, `PUSH_INITIAL_SPEED` (3) |
| sword drawn | sword drawn (exchange) | knocked back, enemy speed | knocked back, `PLAYER_SWORD_SPEED` |
| sword drawn | unarmed | unaffected | knocked back, `PLAYER_SWORD_SPEED` + enemy speed |
| bare-handed | sword drawn | knocked back, `PUSH_INITIAL_SPEED` + enemy speed | unaffected |
| bare-handed | unarmed | knocked back, `PUSH_INITIAL_SPEED` (3) | unaffected |

If both `sword` and `shield` are somehow active at once, shield wins —
blocking takes priority over attacking.

**Directions:** a collision means both share one cell, so their
current positions can't tell who came from where. The callers pass
`checkEnemyEncounter(playerFromX, enemyFromX)` the positions from
*before* the move that brought them together (the player's step in
`stepPlayer()`, or the enemy's `step()` in its interval). From those,
`enemySide` (-1/1, which side of the player the enemy came from —
falling back to `player.facing` if both were in the same column, i.e.
the player stepped in vertically) decides everything directional:

- the player is pushed away from `enemySide`, the enemy toward it
  (i.e. away from the player);
- the player's shield/sword only count if `player.facing` points
  toward `enemySide`, and the enemy's sword only counts if
  `enemy.direction` points toward the player — a weapon facing away
  is treated as not drawn.

- `checkEnemyEncounter()` — called right after the player's own move
  commits in the `keydown` handler, and right after `enemy.step()` in
  its patrol interval — is the only trigger point, and only fires when
  the enemy is still `alive` and *neither* side is already mid-push
  (so standing inside the enemy for several ticks doesn't keep
  re-triggering it). It reads `player.sword`/`player.shield`/`enemy.sword`
  (non-null exactly while a swing/shield is active) to pick which row
  of the table above applies, and calls `.push.start(direction,
  speed)` on the player and/or the enemy accordingly.
- A dedicated `setInterval` (`PUSH_STEP_INTERVAL`, 200ms) is what
  actually moves anything mid-push:
  - **Player**: while `player.push.active()`, adds the cells
    returned by `player.push.step()` to `player.x` each tick,
    clamped to the viewport (same as normal movement). A tick that
    crosses no whole cell moves nothing.
  - **Enemy**: while `enemy.push.active()` (and still `alive`),
    calls `stepEnemyPush(cells)` with `enemy.push.step()`'s result
    instead (skipped when it's `0`). Unlike the player, the enemy
    is *not* clamped — `stepEnemyPush()` computes the unclamped next
    `x` and, if that's off the display (`< 0` or `>= renderer.width`)
    or overlaps any `parallaxObjects` shape at its current position,
    calls `vanishEnemy()` (sets `alive = false`, stops its `push`,
    `renderer.remove(enemy)`) instead of landing there. Otherwise it
    moves normally. This is the "enemy dies hitting the
    environment/border" case from the original design — a hard enough
    push sends it flying off-screen or into scenery for good, rather
    than bouncing/clamping.
  - Either side actually changing cell triggers one
    `updateParallax()` + `renderer.render()` for the tick.
- Enemy recovery: the enemy has no input to fight a push with, so
  each push-loop tick calls `enemy.push.recoverOverTime(PUSH_STEP_INTERVAL,
  ENEMY_PUSH_RECOVER_INTERVAL, ENEMY_PUSH_RECOVER_AMOUNT)` — it loses
  1 speed every 500ms, with leftover time carried over between ticks.
- Player recovery pacing: each `stepPlayer()` step (a fresh arrow
  press, or every `PLAYER_MOVE_INTERVAL` while one is held) while
  `player.push.active()` calls
  `player.push.recoverStep(PUSH_RECOVER_PRESSES_PER_POINT, weight)`,
  which adds `weight` to `recoverProgress` — 1 for a fresh press,
  `PUSH_RECOVER_HOLD_WEIGHT` (0.25) for a held-key tick, so tapping
  recovers much faster than holding — and, once that hits
  `PUSH_RECOVER_PRESSES_PER_POINT` (1), resets it and drops `speed` by
  1 (auto-`stop()`ing at 0). It doesn't matter which of the 4 arrow
  keys is pressed, only that one is.

Known gaps / deliberate simplifications:

- Player push movement still isn't checked against `parallaxObjects`
  — a pushed player can be shoved straight through the tree/mountain's
  collision map without stopping. Fine for now since pushes are short
  and rare; would need the same kind of multi-cell sweep check
  `wouldCollideAt` doesn't currently do either. (The enemy's push *is*
  now checked against `parallaxObjects` — see above — since colliding
  with them is exactly what makes it vanish.)
- The environment check in `stepEnemyPush()` uses each `parallaxObject`'s
  *current* rendered position, not a predicted one — fine because a
  push tick never moves the player, so parallax positions don't shift
  mid-check (unlike `wouldCollideAt`, which has to predict, since the
  player's own move is what shifts them).
- The enemy has no shield, only a sword.

## Particles

`Particle` ([Particle.js](Particle.js), `z = 18`) picks one of
`Particle.SEQUENCES` (`"#Oo+-."`, `` "#O*°'´`" ``, `"#;:,."`) at random
and starts on its first character. Every `Particle.FRAME_DURATION`
(250ms) it jumps ahead 1 or 2 characters (50/50); running past the
end sets `alive = false`. Meanwhile it moves at a fixed speed (cells
per second) in a random direction chosen at creation. Position is
kept smooth in `posX`/`posY`; `x`/`y` are rounding getters, since the
renderer only accepts whole cells.

In [game.js](game.js), live particles are kept in the `particles`
array (and the renderer). `spawnParticles(x, y, count, speed?)`
creates a burst; one `setInterval` (`PARTICLE_STEP_INTERVAL`, 50ms)
calls `update(dt)` with the real elapsed time on each, and removes
dead ones from both the array and the renderer.

Currently spawned in two places:

- `checkEnemyEncounter()` — a burst of `COLLISION_PARTICLE_COUNT` (3)
  at the player's position whenever a player/enemy collision actually
  triggers a push reaction.
- The push loop — while the player or the enemy is being pushed,
  `spawnPushTrail(fromX, toX, y)` rolls once per cell the push carries
  it out of and, with probability `TRACE_PARTICLE_DENSITY` (0.5),
  spawns one particle at `TRACE_PARTICLE_SPEED` (1) there, leaving a
  trace behind. An enemy that vanishes on a tick leaves no trail for
  that tick, since it never lands.

## Squiggle

Holding `D` grows a `Squiggle` ([Squiggle.js](Squiggle.js), `z = 22`,
referenced as `player.squiggle`) from the tile right of the player:
one random letter from `Squiggle.CHARACTERS` (`"=-~+"`) every
`SQUIGGLE_GROW_INTERVAL` (5ms), up to `SQUIGGLE_MAX_LENGTH` (20).
Each letter is one column right of the previous one; the row only
changes (randomly one up, one down, or the same) on every
`Squiggle.DY_STEP_EVERY` (2nd) letter. Every growth step re-rolls
the whole string (letters and path) at the new length; once it
reaches `SQUIGGLE_MAX_LENGTH` it keeps being re-rolled at that
length every tick, so it flickers for as long as `D` is held. It's glued to the player via getters
(it keeps its shape while the player moves) and is removed on
`keyup`. Purely decorative — no collision check reads it, so it
never affects combat. Like the shield, a missed `keyup` would leave
it stuck on.

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
`parallaxObjects` array. It's called once in `startGame()` and once
per movement keypress. **If you add a new layer, remember to add the
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
3. `renderer.add(instance)` in `startGame()`.
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

The `keydown` handler in [game.js](game.js) does this in order:

1. Compute `dx`/`dy` from the arrow key, then `targetX`/`targetY` =
   the player's position after that step, clamped to the viewport.
2. `wouldCollideAt(targetX, targetY)`:
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
3. Only if no probe collides does the handler actually write
   `player.x`/`player.y`; either way it calls `updateParallax()` (to
   reflect wherever the player ended up) and `renderer.render()`.

This is why `Player.move()` is unused now — mutating the player up
front and clamping/reverting afterwards gets fiddly at boundaries, so
the handler computes the candidate position first and only commits it
once it's known to be collision-free.

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
