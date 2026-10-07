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
| [Mover.js](Mover.js) | Movement state of one moving object: its one horizontal velocity, fixed-span travel (pushes, dash), queued steps, sub-cell offset — see "Movement" below. |
| [MovingObject.js](MovingObject.js) | Base class for everything that moves (`Player`, `Enemy`): position + a `Mover`. |
| [MovementSystem.js](MovementSystem.js) | Moves every registered `MovingObject` once per tick, one cell at a time, against per-object rules. |
| [ContactPredictor.js](ContactPredictor.js) | Predicts when two fighters will touch, for the enemy's sword timing — see "Enemy" below. |
| [Player.js](Player.js) | Player state (`extends MovingObject`): facing and `sword`/`shield` weapon references. |
| [PlayerController.js](PlayerController.js) | Arrow-key input → player steps, sampled once per tick. |
| [Sword.js](Sword.js), [Shield.js](Shield.js) | The player's timed weapons (dash/swing frames, shield), both take a `player` reference in their constructor. |
| [Ground.js](Ground.js) | Background floor plane. |
| [Enemy.js](Enemy.js) | Patrolling/combat enemy (`extends MovingObject`): approach → pushed back → recover rhythm. |
| [EnemySword.js](EnemySword.js) | The enemy's sword (`extends Sword`): thrust or swing, plus its cooldown — see "Enemy" below. |
| [Initiative.js](Initiative.js) | Which fighter has the initiative, drawn as a `!` above it — see "Initiative" below. |
| [DeathJump.js](DeathJump.js) | Death feedback: a dying character's copy jumps up and falls out of the play area — see "Push" below. |
| [Particle.js](Particle.js) | Short-lived drifting particle that decays through a random character sequence — see "Particles" below. |
| [Squiggle.js](Squiggle.js) | Decorative random-letter string grown from the player while `Q` is held — see "Squiggle" below. |
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
   `ContactPredictor.js`, then `Player.js`, `PlayerController.js`, `Sword.js`, `Shield.js`,
   `Ground.js`, `Enemy.js`, `EnemySword.js`, `Initiative.js`, `Squiggle.js`,
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
the game (walk speed, sword swing, enemy sword window, push recovery,
particle ageing) is counted in the same ticks, and the same situation
always plays out the same way. There are no other `setInterval`/
`setTimeout` calls anywhere. Anything timed keeps its own `elapsed`
counter and advances it in `update(dt)`.

One tick, in this order:

1. **Input** — `playerController.update(dt)` turns the arrow keys
   pressed/held since the last tick into a queued step.
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
the action/squiggle keys create their objects right away, but those are drawn and
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
`velocityX` (cells per second, signed), set in one of two ways:

- `setVelocity(vx, vy)` — keeps moving until told otherwise: the
  enemy's patrol and its approach in combat.
- `travel(vx, cells)` — moves **exactly `cells` cells** at that
  speed, then stops on its own (`traveling` is true until then). A
  push back and the player's dash are travels.
- `stop()` — running into something, standing firm in an encounter.

`MovingObject` wraps the travel: `startPush(direction, span, speed)`
for a push back (`pushed` is true while it's carrying the object),
`lunge(direction, span, speed)` for a travel that isn't a push (the
dash). `Player.pushBack(direction)` / `Enemy.pushBack(direction)`
call `startPush` with their own `PUSHBACK_SPAN`/`PUSHBACK_SPEED`.

On top of that, **queued steps** (`queueStep(dx, dy)`) move exactly
one cell on the next tick, for grid-exact movement like the player's
walk.

`advance(dt)` adds the velocities to a hidden sub-cell offset, takes
off the whole cells crossed and returns them (plus any queued step),
never more than a travel has left. The fractional rest carries over
to the next tick. The offset is reset by `resetOffset()` (being
blocked), `travel()` and `stop()`. `clone()` copies the movement for
the contact prediction.

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
- **Both**: being **pushed back** into the border/scenery
  (`pushed`) kills — `killPlayer()` / `vanishEnemy()`. Anything else
  running into it (a walking step, the dash, the enemy's approach)
  just stops (a patrolling enemy also turns around, `enemy.bump()`).
  Every cell crossed while pushed leaves a push trace.
- Neither can step onto the other's cell (`occupies()`). They fight
  by touching, not by overlapping (see "Push"). Being blocked by the
  other's body leaves the movement alone — the encounter decides.

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
- while pushed back, dashing (`mover.traveling`), behind the shield
  (`rooted`) or recovering after a push back (`recovering`), the
  player doesn't step

**Approach in combat:** in combat the player runs at the enemy on
its own at `Player.ATTACK_SPEED` (4 cells/s,
`PlayerController.approach()`), like the enemy does. Arrow steps
come on top of it. It pauses in the same four cases as the steps.
After a push back, the player stands still for
`Player.RECOVERY_DELAY` (200ms, counted down in `Player.update()`
once the push is over) before it moves or dashes again.

A window `blur` drops all held arrows, since no `keyup` would arrive
for them.

`player.facing` is `"left"` or `"right"` (default `"right"`), set by
the controller whenever `ArrowLeft`/`ArrowRight` is the active
direction — `ArrowUp`/`Down` leave it untouched, and it updates even
if the move itself is blocked by a collision, since it's about which
way the player is turned, not whether they actually moved. In
combat (`enemy.inCombat()`, via `playerController.opponent`) the
player always faces the enemy instead, so stepping back doesn't turn
its back on it.

## Combat: the player's four actions

*Branch `rock_paper_scissor_fencing`.* The player has exactly four
actions, `ACTION_KEYS` in [game.js](game.js):

| Key | Action | What happens |
|---|---|---|
| `A` | **dash** (`dash()`) | travels `DASH_SPAN` (3) cells at `DASH_SPEED` (12 cells/s) toward where the player faces (in combat: toward the enemy), sword `-` held out in front for `DASH_DURATION` (320ms) — a burst well above the approach speed. Not while pushed back or recovering. |
| `D` | **shield** (`raiseShield()`) | stops the player (a dash, not a push back); `[`/`]` in front for `SHIELD_DURATION` (480ms) |
| `W` | **swing from above** (`swing()`) | `\|` over the player, then `/` diagonally above in front, then `-` in front |
| `S` | **swing from below** (`swing()`) | `\|` under the player, then `\` diagonally below in front, then `-` in front |

Every action ends on its own after its time: the weapon sets
`alive = false` and clears `player.sword`/`player.shield` itself, so
the world drops it and the player has nothing drawn again. Only one
action runs at a time (`player.busy`); a key pressed meanwhile is
ignored, and the `keydown` handler ignores auto-repeat, so holding a
key gives exactly one action per press.

**`Sword`** ([Sword.js](Sword.js)) is one action as a list of frames,
`Sword.FRAMES` (`dash`, `overhead`, `underhand`): each frame is one
blade character at an offset `dx`/`dy` from the player, written for
facing right. Facing left, `dx` and the diagonals are mirrored
(`Sword.MIRRORED`). Each frame shows for `frameDuration`:
`SWING_FRAME_DURATION` (120ms = 3 ticks) for a swing, `DASH_DURATION`
for the dash's single frame. `x`/`y`/`getAscii()` are getters reading
the player live, so the blade stays glued to it.

**`Shield`** ([Shield.js](Shield.js)) is timed the same way. While it's
up, the player is **rooted** (`player.rooted`): arrow keys are ignored
(it only keeps facing the enemy). In a shield encounter the player
stands firm (see "Push").

Neither weapon is affected by movement collision or parallax.

## Enemy

`Enemy` (`extends MovingObject`, `z = 15`, drawn as `"E"`) moves on
its own, independent of player input. It's constructed with its
`target` (the player). Its `update(dt)` runs every tick as part of
`world.update()` and only *decides* the velocity; the movement system
moves it. It's **in combat** (`inCombat()`) while both are alive and
at most `Enemy.COMBAT_ROW_DISTANCE` (1) rows apart; then it always
faces the player. Four cases, checked in order:

1. **Pushed back** (`pushed`) — it lets the push carry it.
2. **Recovering** (`recoveryTime > 0`) — it stands still for
   `Enemy.RECOVERY_DELAY` (400ms) after every encounter: after the
   push back if it was pushed (`pushBack()`), right away if it stood
   firm (`holdGround()`).
3. **Combat** — it runs straight at the player at
   `Enemy.ATTACK_SPEED` (6 cells/s).
4. **Patrol** (otherwise) — walk a fixed row back and forth between
   `minX`/`maxX` (`5`/`35` currently) at `Enemy.PATROL_SPEED` (2.5),
   reversing `direction` at either end.

So in combat its whole movement is set by four constants in
[Enemy.js](Enemy.js): approach at `ATTACK_SPEED` → encounter →
pushed back `PUSHBACK_SPAN` (4) cells at `PUSHBACK_SPEED` (15
cells/s) → stop for `RECOVERY_DELAY` → approach again.

`this.alive` starts `true` and flips to `false` in `vanishEnemy()`
(see "Push" below) once a knockback carries it into the border or the
environment. That also removes it from the world and the movement
system, so a vanished enemy is inert even though the `enemy` reference
itself is never reassigned/replaced.

**Enemy sword:** the enemy times its attack. Each tick,
`updateEnemySword()` (in [game.js](game.js)) asks
`contactPredictor.timeToContact()` ([ContactPredictor.js](ContactPredictor.js))
how many ms until its sword tip (`ENEMY_SWORD_REACH`, 1 cell) would
touch the player (body, plus 1 cell if a sword/shield is out toward
the enemy, `playerReach()`). The predictor copies both fighters'
cell and a `clone()` of their `Mover` and runs it forward tick by
tick, up to `ContactPredictor.LOOKAHEAD` (3s) — the same math as
the game (including where a push or dash ends), so the prediction
holds as long as nobody presses a key or hits anything. A
recovering enemy stands still, so no contact is predicted until it
starts its approach.

The enemy attacks with the same frames as the player: an
`EnemySword` ([EnemySword.js](EnemySword.js), `extends Sword`, owner
= the enemy, whose `facing` comes from `direction`). Each strike is
one of `ENEMY_ATTACKS` — thrust (`Sword.FRAMES.dash`, a plain `-`),
swing from above or swing from below — picked at random in advance
(`enemyNextAttack`). A swing shows each frame for
`ENEMY_SWING_FRAME_DURATION` (120ms), so its blade only reaches the
front after a **windup** (`Sword.frontFrameIndex()` × frame time =
240ms); the enemy starts it that much earlier. It strikes once the
predicted contact is `ENEMY_SWORD_LEAD` (80ms) + windup or less away
— not while it's too far off, or `enemy.swordCooldown` hasn't run
down to 0. The last frame (`-` in front) stays for
`ENEMY_SWORD_HOLD` (600ms).

Then `putAway()` clears `enemy.sword` and sets
`enemy.swordCooldown` to `ENEMY_SWORD_COOLDOWN` (0 — no cooldown), counted down
in `Enemy.update()`. `enemy.sword` is the current sword or `null`, mirroring `player.sword`. Whether it's drawn at the
moment of impact changes the collision outcome (see "Push" below).

The enemy isn't in `parallaxObjects` (it has no corners, its position
isn't a function of the player) and isn't checked in `wouldCollideAt`.
Its body blocks the player through the movement rules instead (see
"Movement"). Touching it triggers the push, below.

## Initiative

Exactly one of the two fighters has the initiative. `initiative`
(an `Initiative`, [Initiative.js](Initiative.js), created in
[game.js](game.js)) holds it in `holder`, and the **enemy starts
with it**. `give(character)` hands it over, `has(character)` asks.

It's also its own renderable: an `Initiative.MARK` (`"!"`) at
`MARK_DX`/`MARK_DY` (default: directly above the holder), glued to
the holder via getters like the weapons. It's added to the world in
`startGame()` and draws nothing while its holder is dead.

It changes hands on a sword clash with matching positions (see
"Push").

Not done yet, deliberately out of scope for now:

- One enemy, one hardcoded patrol row — no patrol-path data structure,
  no spawning/despawning, no respawn once `alive` goes `false`.

## Push (knockback)

A push back is a fixed **span** at a fixed **speed**: the loser of an
encounter travels `PUSHBACK_SPAN` cells straight away from the other
at `PUSHBACK_SPEED` (`Player.*` and `Enemy.*`, 4 cells at 15 cells/s
each), then stops (see "Movement"). While it flies, no new encounter
can fire and the player can't step. Whoever isn't pushed back stands
firm (`mover.stop()` — this also ends a dash). The enemy then
recovers for `Enemy.RECOVERY_DELAY` either way before it runs at the
player again (see "Enemy").

The weapons decide who is pushed back:

| Player | Enemy | Pushed back |
|---|---|---|
| shield up | any | enemy |
| sword drawn | sword drawn, **matching position** | both |
| sword drawn | sword drawn, **non-matching position** | whoever doesn't have the initiative |
| sword drawn | unarmed | enemy |
| bare-handed | sword drawn | player |
| bare-handed | unarmed | both |

**Sword clash:** both blades are compared as currently drawn (the
current frame of each side's swing). The fighters face each other, so
they're compared mirrored (`Sword.matches()`, `Sword.MIRRORED`): `"/"`
meets `"\"` and `"-"` meets `"-"` match; `"/"` meets `"/"` and `"\"`
meets `"\"` don't — so the same swing on both sides at the same
moment matches. A blade only counts as "sword drawn" while it's on
the other fighter's row. Matching positions
reflect both fighters *and* hand the initiative to the other side (see
"Initiative"). Non-matching positions push back only whoever doesn't
hold the initiative.

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
  only fires when both are alive, touching, and **neither is being
  pushed back**. The push carries the loser out of reach, so staying
  in contact doesn't keep re-triggering it.
- Being pushed back into the border/scenery kills, see "Movement".
  `vanishEnemy()` (and `killPlayer()`) call `playDeathJump()`: a
  `DeathJump` (`z = 30`, same character as the dead one) starts at
  the last cell and jumps straight up at `DeathJump.JUMP_SPEED` (18
  cells/s). `DeathJump.GRAVITY` (40 cells/s²) pulls it back down
  (peak ≈ 4 cells) until it has fallen below the play area's bottom
  edge, where it removes itself.

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

Holding `Q` (`SQUIGGLE_KEY`) grows a `Squiggle` ([Squiggle.js](Squiggle.js), `z = 22`,
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
length, so it flickers for as long as `Q` is held. It's glued to the player via getters
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
