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
| [Mover.js](Mover.js) | Movement state of one moving object: own velocity, queued steps, knockback (`Push`), sub-cell offset — see "Movement" below. |
| [MovingObject.js](MovingObject.js) | Base class for everything that moves (`Player`, `Enemy`): position + a `Mover`. |
| [MovementSystem.js](MovementSystem.js) | Moves every registered `MovingObject` once per tick, one cell at a time, against per-object rules. |
| [Player.js](Player.js) | Player state (`extends MovingObject`): facing and `sword`/`shield` weapon references. |
| [PlayerController.js](PlayerController.js) | Arrow-key input → player steps / push recovery, sampled once per tick. |
| [Sword.js](Sword.js), [Shield.js](Shield.js) | Combat visuals, both take a `player` reference in their constructor. |
| [Ground.js](Ground.js) | Background floor plane. |
| [Enemy.js](Enemy.js) | Patrolling/combat enemy (`extends MovingObject`). |
| [EnemySword.js](EnemySword.js) | The enemy's `-` sword, glued to the enemy — see "Enemy" below. |
| [Push.js](Push.js) | Knockback state (speed, direction, recovery), one per `Mover`. |
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
3. `Push.js`, `Mover.js`, `MovingObject.js`, `MovementSystem.js`,
   then `Player.js`, `PlayerController.js`, `Sword.js`, `Shield.js`,
   `Ground.js`, `Enemy.js`, `EnemySword.js`, `Squiggle.js`,
   `BlinkingText.js`, `SplashScreen.js`. `MovingObject.js` must come
   before `Player.js`/`Enemy.js` (they `extends MovingObject`).
   `Push.js`/`Mover.js` only need to exist by the time something is
   constructed, but keeping them first keeps it obvious. The rest
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
the game (walk speed, sword swing, enemy sword window, push recovery,
particle ageing) is counted in the same ticks, and the same situation
always plays out the same way. There are no other `setInterval`/
`setTimeout` calls anywhere. Anything timed keeps its own `elapsed`
counter and advances it in `update(dt)`.

One tick, in this order:

1. **Input** — `playerController.update(dt)` turns the arrow keys
   pressed/held since the last tick into a queued step or push
   recovery (see "Player").
2. **Objects** — `world.update(dt)`: every object in the `World`
   ([World.js](World.js)) that has an `update(dt)` method runs it —
   enemy AI, sword/enemy-sword timers, particles, squiggle, title
   blink. Any object that sets `alive = false` is removed from the
   world *and* the renderer right there.
3. **Movement** — `movement.update(dt)` moves every `MovingObject`
   (see "Movement" below).
4. **Combat** — `updateEnemySword()`, then `checkEnemyEncounter()`,
   once, after everything has moved.
5. **Draw** — `renderer.render()`, the only render call in the game.

Key handlers never move or render anything themselves. Arrow keys are
only recorded (the controller acts on them on the next tick), and
`W`/`A`/`D` create their objects right away, but those are drawn and
checked from the next tick on. Input is therefore at most one tick
(40ms) late, and always on the beat.

`world.add(obj)`/`world.remove(obj)` replace direct
`renderer.add`/`remove` calls for everything in play.

## Movement

Everything that moves on the grid `extends MovingObject`
([MovingObject.js](MovingObject.js)): `x`/`y`/`z`, a `mover`, a
`push` getter (the mover's `Push`), and `previousX`/`previousY` (where
it stood before this tick's movement).

A `Mover` ([Mover.js](Mover.js)) collects three sources of movement,
which add up:

- **Own velocity** (`setVelocity(vx, vy)`, cells per second) — set
  every tick by whatever steers the object (the enemy AI).
- **Queued steps** (`queueStep(dx, dy)`) — exactly one cell on the next
  tick, for grid-exact movement like the player's walk.
- **Push** (`startPush(direction, speed)`) — knockback, horizontal
  only, see "Push" below.

`advance(dt)` adds the velocities to a hidden sub-cell offset, takes
off the whole cells crossed and returns them (plus any queued step).
The fractional rest carries over to the next tick. The offset is
reset by `resetOffset()` (turning around, being blocked) and when a
push starts or wears off.

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
  (`wouldCollideAt`, see "Movement collision"), whether walking *or*
  pushed. Every step leaves a push trace if pushed and updates the
  parallax.
- **Enemy**: its own steps follow `enemy.allowsStep(x)` (never onto or
  past the player while chasing). While pushed, `enemyFitsAt(x, y)`
  checks the display bounds and scenery. A push step blocked by those
  calls `vanishEnemy()`.
- Neither can step onto the other's cell (`occupies()`). They fight
  by touching, not by overlapping (see "Push"). An enemy push blocked
  only by the player's body just stops, it doesn't kill.

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
- a tap pressed *and* released between two ticks still counts, which
  matters for mashing out of a push

A window `blur` drops all held arrows, since no `keyup` would arrive
for them.

`player.facing` is `"left"` or `"right"` (default `"right"`), set by
the controller whenever `ArrowLeft`/`ArrowRight` is the active
direction — `ArrowUp`/`Down` leave it untouched, and it updates even
if the move itself is blocked by a collision, since it's about which
way the player is turned, not whether they actually moved.

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
  one-shot, tick-driven animation: on press it's added to the world;
  its `update(dt)` flips `frame` from `"slash"` to `"dash"` once it has
  been out for `SWORD_FRAME_DURATION` (120ms = 3 ticks), and after
  another 120ms it sets `alive = false` and clears `player.sword`
  itself, so the world drops it. `player.sword` doubles as a
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

`Enemy` (`extends MovingObject`, `z = 15`, drawn as `"E"`) moves on
its own, independent of player input. It's constructed with its
`target` (the player). Its `update(dt)` runs every tick as part of
`world.update()` and only *decides* the velocity; the movement system
moves it afterwards. All speeds are in cells per second. Three cases,
checked in order:

1. **Mid-push** (`this.push.active()`) — own velocity 0, so only the
   push moves it. It recovers on its own: loses
   `Enemy.PUSH_RECOVER_AMOUNT` (5) push speed every
   `Enemy.PUSH_RECOVER_INTERVAL` (500ms).
2. **Combat mode** (`isChasing()`: same row as the target) —
   `approach(dt)` turns to face the player and closes in, slowly
   accelerating: `approachSpeed` starts at `Enemy.APPROACH_START_SPEED`
   (1.25), grows by `Enemy.APPROACH_ACCELERATION` (1.5625 per second),
   capped at `Enemy.APPROACH_MAX_SPEED` (5). `allowsStep(x)` (used as
   its movement rule) never lets it step onto or past `player.x`, so it
   stops right next to the player. Touching the player is what
   triggers `checkEnemyEncounter()`.
   The run-up resets (`stopApproach()`, also forgetting the mover's
   half-crossed cell) when it turns around, is pushed, or goes back to
   patrolling. `enemy.speed` (getter) is `approachSpeed` while
   approaching, else `Enemy.PATROL_SPEED` (2.5).
3. **Patrol** (otherwise) — walk a fixed row back and forth between
   `minX`/`maxX` (`5`/`35` currently), reversing `direction` at
   either end.

These speeds are the old per-400ms-step values converted to cells per
second, so the enemy moves as fast as before, only smoothly instead
of in 400ms jumps.

`this.alive` starts `true` and flips to `false` in `vanishEnemy()`
(see "Push" below) once a knockback carries it into the border or the
environment. That also removes it from the world and the movement
system, so a vanished enemy is inert even though the `enemy` reference
itself is never reassigned/replaced.

**Enemy sword:** each tick, `updateEnemySword()` (in
[game.js](game.js)) draws an `EnemySword` (`"-"`, one tile in front
of the enemy along `direction`, `z = 25`) when the enemy is alive,
not pushed, on the player's row, within `ENEMY_SWORD_DRAW_DISTANCE`
(2) cells, and `enemy.swordCooldown` has run down to 0. The sword's
own `update(dt)` calls `sheathe()` after `ENEMY_SWORD_DURATION`
(1200ms), which clears `enemy.sword` and sets `enemy.swordCooldown`
to `ENEMY_SWORD_COOLDOWN` (800ms), counted down in `Enemy.update()`.
`enemy.sword` is the current sword or `null`, mirroring
`player.sword`. Whether it's out at the moment of impact changes the
collision outcome (see "Push" below).

The enemy isn't in `parallaxObjects` (it has no corners, its position
isn't a function of the player) and isn't checked in `wouldCollideAt`.
Its body blocks the player through the movement rules instead (see
"Movement"). Touching it triggers the push, below.

Not done yet, deliberately out of scope for now:

- The enemy's own movement (chasing, patrol) isn't checked against
  `parallaxObjects` — an enemy chasing the player through where a
  tree stands just walks straight through it. Only its pushes are.
- One enemy, one hardcoded patrol row — no patrol-path data structure,
  no spawning/despawning, no respawn once `alive` goes `false`.

## Push (knockback)

`Push` ([Push.js](Push.js)) is a small class — `speed` (cells per
second, may be fractional, `0` = inactive), `direction` (`-1`/`1`),
and recovery counters — with `active()`, a `velocity` getter,
`start(direction, speed)`, `stop()`, `recoverStep(pressesPerPoint,
weight, amount)` and `recoverOverTime(elapsedMs, msPerStep, amount)`.
Each `Mover` owns one (`player.push`/`enemy.push` are getters for
it). Push only holds the knockback; the `Mover` turns its velocity
into cells like any other movement (see "Movement"). A push is
started with `mover.startPush(direction, speed)`, which also clears
the half-crossed cell.

The reaction to a player/enemy collision, resolved by both sides'
weapons at the moment of impact. "Enemy speed" is `enemy.speed`
(current approach speed, or 2.5 while patrolling); the player's speed
is `PLAYER_SWORD_SPEED` (15), the force of its swing:

| Player | Enemy | Player result | Enemy result |
|---|---|---|---|
| shield up (reflector) | any | unaffected | knocked back, `PUSH_INITIAL_SPEED` (15) |
| sword drawn | sword drawn (exchange) | knocked back, enemy speed | knocked back, `PLAYER_SWORD_SPEED` |
| sword drawn | unarmed | unaffected | knocked back, `PLAYER_SWORD_SPEED` + enemy speed |
| bare-handed | sword drawn | knocked back, `PUSH_INITIAL_SPEED` + enemy speed | unaffected |
| bare-handed | unarmed | knocked back, `PUSH_INITIAL_SPEED` (15) | unaffected |

(15 cells/s is the old "3 cells per 200ms push step".)

If both `sword` and `shield` are somehow active at once, shield wins —
blocking takes priority over attacking.

**Contact:** an encounter happens when the two sides *touch*, not
when they overlap. Each side is a list of parts (`combatParts()`):
the player's body plus its sword and shield if out, and the enemy's
body plus its sword if out. `findContact()` looks for a player part
and an enemy part on the same row, at most `CONTACT_DISTANCE` (1)
cells apart, i.e. on adjacent cells. So reach matters. With a sword
out, the player hits an enemy two cells away. If both have their
swords out and facing each other, the blades touch with the bodies
three cells apart. The collision particles burst at the player's
touching part (sword tip, shield or body).

**Directions:** bodies never share a cell, so `enemySide` (-1/1,
which side of the player the enemy is on) comes straight from the
current positions. It falls back to where they stood before the tick
(`previousX`), then to `player.facing`, only in odd cases. It
decides everything directional:

- the player is pushed away from `enemySide`, the enemy toward it
  (i.e. away from the player);
- the player's shield/sword only count if `player.facing` points
  toward `enemySide`, and the enemy's sword only counts if
  `enemy.direction` points toward the player — a weapon facing away
  is treated as not drawn.

- `checkEnemyEncounter()` runs once per tick, after all movement, and
  only fires when the enemy is still `alive` and *neither* side is
  already mid-push (so staying in contact for several ticks doesn't
  keep re-triggering it). It reads
  `player.sword`/`player.shield`/`enemy.sword` (non-null exactly while
  a swing/shield is active) to pick which row of the table above
  applies, and calls `mover.startPush(direction, speed)` on the player
  and/or the enemy accordingly.
- Moving anyone mid-push is ordinary movement (see "Movement"), with
  these per-object rules:
  - **Player**: blocked by the viewport edge and by scenery. It stays
    there while the push wears off.
  - **Enemy**: *not* clamped. A push step that would leave the display
    or overlap any `parallaxObjects` shape (`enemyFitsAt()`) calls
    `vanishEnemy()` (sets `alive = false`, stops its push, removes it
    and its sword from the world and the movement system) instead of
    landing there. This is the "enemy dies hitting the
    environment/border" case from the original design.
    `vanishEnemy()` then calls `playDeathJump(enemy)`: a `DeathJump`
    (`z = 30`, same character as the dead one) starts at the enemy's
    last cell and jumps straight up at `DeathJump.JUMP_SPEED` (18
    cells/s). `DeathJump.GRAVITY` (40 cells/s²) pulls it back down
    (peak ≈ 4 cells) until it has fallen below the play area's bottom
    edge, where it removes itself. `playDeathJump(character)` works
    for any character. The player can't die yet, but a player death
    should call it too.
- Enemy recovery: see "Enemy" — 5 cells/s off every 500ms.
- Player recovery (in `PlayerController.recover()`): while
  `player.push.active()`, arrow keys don't move the player. Every
  fresh press counts 1 toward `PUSH_RECOVER_PRESSES_PER_POINT` (1), a
  held key's repeat (every `MOVE_INTERVAL`) only
  `PUSH_RECOVER_HOLD_WEIGHT` (0.25), so tapping recovers much faster
  than holding. Each full point drops the push speed by
  `PUSH_RECOVER_AMOUNT` (5 cells/s), auto-`stop()`ing at 0. All
  these constants are statics on `PlayerController`. It doesn't matter
  which of the 4 arrow keys is pressed, only that one is.

Known gaps / deliberate simplifications:

- The environment check for the enemy (`enemyFitsAt()`) uses each
  `parallaxObject`'s *current* rendered position, not a predicted one.
  That's fine because the player moves first in the tick and updates
  the parallax on every step.
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
