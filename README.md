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
| [Player.js](Player.js) | Player state: position, facing, push (knockback) fields. |
| [Sword.js](Sword.js), [Shield.js](Shield.js) | Combat visuals, both take a `player` reference in their constructor. |
| [Ground.js](Ground.js) | Background floor plane. |
| [Enemy.js](Enemy.js) | Patrolling enemy. |
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
3. `Player.js`, `Sword.js`, `Shield.js`, `Ground.js`, `Enemy.js`,
   `BlinkingText.js`, `SplashScreen.js` — no `extends` between them or
   anything else, so their relative order doesn't matter; they just
   all need to load before `game.js`.
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

`player.facing` is `"left"` or `"right"` (default `"right"`), set only
by `ArrowLeft`/`ArrowRight` in the `keydown` handler — `ArrowUp`/`Down`
leave it untouched, and it updates even if the move itself is blocked
by a collision, since it's about which way the player is turned, not
whether they actually moved.

## Combat: sword and shield

Both live one tile out from the player, on whichever side
`player.facing` currently points, and neither is affected by movement
collision (`wouldCollideAt` only checks `parallaxObjects`) or by
parallax — they're relative to the player, not scenery.

- **`Sword`** (`W`, in the `keydown` handler's `swingSword()`) is a
  one-shot, timer-driven animation: on press it's added to the
  renderer as `"/"`, `setTimeout` flips its `char` to `"_"` after
  `SWORD_FRAME_DURATION` (120ms), and a second `setTimeout` removes it
  after another 120ms. The `sword` variable doubles as a re-entrancy
  guard — `swingSword()` no-ops while it's non-null — and the
  `keydown` handler also checks `!event.repeat`, so holding `W` down
  triggers exactly one swing per physical press, not continuous OS
  key-repeat swings. Position is captured once at swing start (from
  `player.x/y/facing` at that instant) and does not track further
  player movement mid-swing.
- **`Shield`** (`A`, held) is the opposite: no timer, glued to the
  player for as long as the key is down. Its `x`/`y`/`getAscii()` are
  getters reading `player.x`/`player.y`/`player.facing` live, so it
  stays correctly positioned through any moves made while `A` is held,
  with no per-move update needed. `showShield()` on `keydown` and
  `hideShield()` on a separate `keyup` listener add/remove it;
  `showShield()` is idempotent (checks `shield` first) so repeated
  auto-repeat keydowns while holding `A` are harmless. Character is
  `"["` when facing left, `"]"` when facing right.

Known gap: if the browser never delivers a `keyup` for `A` (e.g. focus
leaves the page while it's held), the shield can get stuck on. There's
no blur-handler safety net for that yet.

## Enemy

`Enemy` (`enemy`, `z = 15`, drawn as `"E"`) is the first game object
that moves on its own, independent of player input. It walks a fixed
row (`y = 12` currently) back and forth between `minX`/`maxX`
(`5`/`35`), reversing `direction` in `step()` whenever it hits either
end. `startGame()` starts a `setInterval` (`ENEMY_STEP_INTERVAL`,
400ms) that calls `enemy.step()` + `renderer.render()` on its own
cadence — this is the first thing in the game that re-renders without
a keypress causing it, so it's also the first evidence that
`renderer.render()` is cheap enough to call from multiple independent
timers without coordination.

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
- The enemy never dies, reacts, or bounces off anything itself — it
  keeps patrolling through a push exactly as if nothing happened.
- One enemy, one hardcoded patrol row — no patrol-path data structure,
  no spawning/despawning, no chase/aggro behavior.

## Push (knockback)

The reaction to a player/enemy collision, resolved by the player's
combat state at the moment of impact:

| Player state | Player result | Enemy result |
|---|---|---|
| bare-handed | knocked back, speed `PUSH_INITIAL_SPEED` (3) | unaffected |
| sword drawn (exchange) | knocked back, speed = enemy's (`Math.abs(enemy.direction)`, always 1) | knocked back, speed `PUSH_INITIAL_SPEED` (3) |
| shield up (reflector) | unaffected (speed stays 0) | knocked back, speed `PUSH_INITIAL_SPEED` (3) |

If both `sword` and `shield` are somehow active at once, shield wins —
blocking takes priority over attacking. There's still no "enemy dies
hitting the environment/border" (the original design's fourth case) —
a reflected/exchanged enemy just gets shoved, clamped to the viewport,
and resumes patrolling once `step()`'s own bounds check pulls it back
onto its row.

- `player.pushSpeed` (cells moved per tick, `0` = not pushed),
  `player.pushDirection` (`-1`/`1`), and `player.pushRecoverProgress`
  (see recovery pacing below) live on `Player`.
- `checkEnemyEncounter()` — called right after the player's own move
  commits in the `keydown` handler, and right after `enemy.step()` in
  its patrol interval — is the only trigger point, and only fires when
  `player.pushSpeed` is already `0` (so standing inside the enemy for
  several ticks doesn't keep re-triggering it). It reads the module-level
  `sword`/`shield` variables (non-null exactly while a swing/shield is
  active) to pick which row of the table above applies, and calls
  `applyPush(direction, speed)` for the player and/or `pushEnemyBack(speed)`
  for the enemy accordingly.
- `applyPush(direction, speed)` sets the player's push state (any
  positive integer speed, not just the constant) and resets
  `pushRecoverProgress` to 0.
- `pushEnemyBack(speed)` is a one-shot displacement, not a gradual
  drift like the player's — the enemy has no input to fight a push
  with, so there's nothing to recover *from*; it just teleports `speed`
  cells away from the player immediately, clamped to the viewport.
- A dedicated `setInterval` (`PUSH_STEP_INTERVAL`, 200ms) is the only
  thing that actually moves a *pushed player*: while `pushSpeed > 0`, it
  adds `pushDirection * pushSpeed` to `player.x` each tick (clamped to
  the viewport, same as normal movement) and re-renders. Speed itself
  never decays here — an unrecovered push would drift forever if
  ignored (capped only by the viewport edge).
- Recovery pacing: pressing an arrow key while `pushSpeed > 0` adds 1
  to `pushRecoverProgress` instead of moving the player; once that hits
  `PUSH_RECOVER_PRESSES_PER_POINT` (3), it resets to 0 and `pushSpeed`
  drops by 1. So fully recovering costs `pushSpeed * PUSH_RECOVER_PRESSES_PER_POINT`
  presses in total — 9 from a bare-handed hit, 3 from a sword exchange's
  small nudge. Raise `PUSH_RECOVER_PRESSES_PER_POINT` to make recovery
  feel slower still; it doesn't matter which of the 4 arrow keys is
  pressed, only that one is.

Known gaps / deliberate simplifications:

- Push movement isn't checked against `parallaxObjects` — a pushed
  player (or a knocked-back enemy) can be shoved straight through the
  tree/mountain's collision map without stopping. Fine for now since
  pushes are short and rare; would need the same kind of multi-cell
  sweep check `wouldCollideAt` doesn't currently do either.
- Any arrow key decrements the recovery progress, not specifically the
  one pointing back at the enemy — simplest interpretation of "press
  the direction key to recover," easy to change to a directional check
  if that turns out to feel wrong.
- The enemy never has its own sword/shield — "both sides armed" (the
  original design's third case, distinct from today's sword exchange)
  can't occur, since the enemy has no weapon state to be in.

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
