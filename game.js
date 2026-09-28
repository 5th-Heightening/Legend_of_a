// ==================================================
// Game
// ==================================================

const viewport = document.getElementById("viewport");

// Drawn in a one-cell frame around the play area, so its edges are
// visible. The viewport's CSS size is the play area + 2 in each
// direction (see Legend_of_a.html).
const VIEWPORT_BORDER_CHAR = "#";

const renderer = new AsciiRenderer(
    viewport,
    41,
    18,
    VIEWPORT_BORDER_CHAR
);


// ==================================================
// Game loop
//
// Everything advances on one shared, fixed tick (see GameLoop.js):
// player input, enemy AI, movement, weapon timers, hit checks,
// particles. The screen is drawn once, at the end of each tick.
// All durations in the game are counted in these ticks, so the same
// situation always plays out the same way.
// ==================================================

const TICK_INTERVAL = 40;

// Every game object that's in play (drawn and updated each tick),
// and everything that moves on the grid.
const world = new World(renderer);
const movement = new MovementSystem();


// The order of one tick:
// 1. input - the arrow keys pressed/held since the last tick
// 2. objects - enemy AI, weapon timers, particles, ...
// 3. movement - everything that moves, one cell at a time
// 4. combat - enemy sword, player/enemy encounter
// 5. draw
function tick(dt) {

    if (gameStarted) {
        playerController.update(dt);
    }

    world.update(dt);

    if (gameStarted) {
        movement.update(dt);
        updateEnemySword();
        checkEnemyEncounter();
    }

    renderer.render();
}


const loop = new GameLoop(TICK_INTERVAL, tick);


// ==================================================
// Title screen
// ==================================================

const TITLE_BLINK_INTERVAL = 500;

const splash = new SplashScreen();
splash.x = 0;
splash.y = 4;

const pressAnyKey = new BlinkingText(14, 15, "Press any key", TITLE_BLINK_INTERVAL);


world.add(splash);
world.add(pressAnyKey);

let gameStarted = false;


// ==================================================
// Game objects
// ==================================================

const ground = new Ground();
const player = new Player(15, 10);
const playerController = new PlayerController(player);

const enemy = new Enemy(5, 12, 5, 35, player);

const tree = new Tree({
    topLeft: { x: 3, y: 3 },
    topRight: { x: 30, y: 3 },
    bottomLeft: { x: 6, y: 5 },
    bottomRight: { x: 33, y: 5 }
});

const mountain = new Mountain({
    topLeft: { x: 12, y: 0 },
    topRight: { x: 20, y: 0 },
    bottomLeft: { x: 10, y: 1 },
    bottomRight: { x: 22, y: 1 }
});

const parallaxObjects = [mountain, tree];


// Player movement is clamped to the viewport, since the
// parallax positions are interpolated from where the
// player is between its 4 corners.
const PLAYER_MIN_X = 0;
const PLAYER_MAX_X = renderer.width - 1;
const PLAYER_MIN_Y = 0;
const PLAYER_MAX_Y = renderer.height - 1;


// Normalized (0..1) position of a player coordinate between
// its min/max bounds - what the parallax interpolation and
// the collision prediction below are both driven by.
function parallaxCoordsFor(x, y) {
    return {
        t: (x - PLAYER_MIN_X) / (PLAYER_MAX_X - PLAYER_MIN_X),
        u: (y - PLAYER_MIN_Y) / (PLAYER_MAX_Y - PLAYER_MIN_Y)
    };
}


function updateParallax() {

    const { t, u } = parallaxCoordsFor(player.x, player.y);

    for (const object of parallaxObjects) {
        object.updatePosition(t, u);
    }
}


// Wraps a game object as a plain {x, y, getAscii, ...} probe
// pinned to a specific position, so renderer.objectsCollide()
// can be reused to test a *hypothetical* position without
// actually moving the real object.
function makeCollisionProbe(source, x, y) {

    const probe = {
        x,
        y,
        transparentChar: source.transparentChar,
        getAscii: () => source.getAscii()
    };

    if (typeof source.getCollisionMap === "function") {
        probe.getCollisionMap = () => source.getCollisionMap();
    }

    return probe;
}


// Would the player collide with any environment part if it
// stood at (px, py)? Each part's own position is predicted
// for that same candidate spot, since the environment shifts
// with the player (parallax).
function wouldCollideAt(px, py) {

    const { t, u } = parallaxCoordsFor(px, py);

    const playerProbe = makeCollisionProbe(player, px, py);

    for (const object of parallaxObjects) {

        const { x, y } = object.interpolatePosition(t, u);

        const objectProbe = makeCollisionProbe(object, x, y);

        if (renderer.objectsCollide(playerProbe, objectProbe)) {
            return true;
        }
    }

    return false;
}


// Could the enemy stand at (x, y) - inside the display and clear
// of all scenery? Scenery is checked where it's currently drawn;
// the player moves before the enemy, and every player step updates
// the parallax right away (see the player's movement rules).
function enemyFitsAt(x, y) {

    if (x < 0 || x >= renderer.width) {
        return false;
    }

    const enemyProbe = makeCollisionProbe(enemy, x, y);

    for (const object of parallaxObjects) {
        if (renderer.objectsCollide(enemyProbe, object)) {
            return false;
        }
    }

    return true;
}


// ==================================================
// Movement rules
//
// The MovementSystem (see MovementSystem.js) moves both, one cell at
// a time, in this order - the player first.
//
// - Player: stays inside the viewport and is blocked by scenery,
//   whether walking or pushed. Every step shifts the parallax.
// - Enemy: its own steps follow Enemy.allowsStep() (never onto or
//   past the player while chasing). A push that would carry it off
//   the display or into scenery kills it instead - see vanishEnemy().
// - Neither can step onto the other's cell - they fight by touching
//   (see checkEnemyEncounter()), not by overlapping.
//
// Both leave a trace of particles behind while pushed.
// ==================================================

function occupies(object, x, y) {
    return object.alive !== false && object.x === x && object.y === y;
}


function registerMovement() {

    movement.add(player, {

        canEnter: (x, y) =>
            x >= PLAYER_MIN_X && x <= PLAYER_MAX_X &&
            y >= PLAYER_MIN_Y && y <= PLAYER_MAX_Y &&
            !wouldCollideAt(x, y) &&
            !occupies(enemy, x, y),

        onMoved: (fromX, fromY) => {
            if (player.push.active()) {
                leavePushTrace(fromX, fromY);
            }

            updateParallax();
        }
    });

    movement.add(enemy, {

        canEnter: (x, y) => {

            if (occupies(player, x, y)) {
                return false;
            }

            return enemy.push.active() ? enemyFitsAt(x, y) : enemy.allowsStep(x);
        },

        // Only the border/scenery kill - bumping into the player
        // just stops the step.
        onBlocked: (x, y) => {
            if (enemy.push.active() && !enemyFitsAt(x, y)) {
                vanishEnemy();
            }
        },

        onMoved: (fromX, fromY) => {
            if (enemy.push.active()) {
                leavePushTrace(fromX, fromY);
            }
        }
    });
}


function startGame() {

    world.remove(splash);
    world.remove(pressAnyKey);

    world.add(ground);
    world.add(mountain);
    world.add(tree);
    world.add(enemy);
    world.add(player);

    registerMovement();
    updateParallax();
}


// ==================================================
// Combat: sword swing (W, one-shot) and shield (A, held)
// ==================================================

const SWORD_FRAME_DURATION = 120;

function swingSword() {

    // A swing already in progress isn't interrupted or restarted.
    if (player.sword) {
        return;
    }

    player.sword = new Sword(player, SWORD_FRAME_DURATION);
    world.add(player.sword);
}


function showShield() {

    if (player.shield) {
        return;
    }

    player.shield = new Shield(player);
    world.add(player.shield);
}


function hideShield() {

    if (!player.shield) {
        return;
    }

    world.remove(player.shield);
    player.shield = null;
}


// ==================================================
// Combat: enemy sword
//
// While closing in on the player's row, the enemy draws its
// sword ("-", see EnemySword.js) once the player is within
// ENEMY_SWORD_DRAW_DISTANCE cells, puts it away again after
// ENEMY_SWORD_DURATION, and waits ENEMY_SWORD_COOLDOWN before it
// can draw again.
// ==================================================

const ENEMY_SWORD_DRAW_DISTANCE = 3;
const ENEMY_SWORD_DURATION = 1200;
const ENEMY_SWORD_COOLDOWN = 800;


// Called every tick - draws the sword if the enemy is in range,
// able to fight and not still cooling down.
function updateEnemySword() {

    if (!enemy.alive || enemy.sword || enemy.push.active()) {
        return;
    }

    if (player.y !== enemy.y) {
        return;
    }

    if (Math.abs(player.x - enemy.x) > ENEMY_SWORD_DRAW_DISTANCE) {
        return;
    }

    if (enemy.swordCooldown > 0) {
        return;
    }

    enemy.sword = new EnemySword(enemy, ENEMY_SWORD_DURATION, ENEMY_SWORD_COOLDOWN);
    world.add(enemy.sword);
}


// ==================================================
// Push: knockback from running into the enemy
//
// Both player and enemy carry a Push (see Push.js, via their Mover):
// a speed in cells per second and a direction, away from the other
// side. The player's only goes down by pressing an arrow key (see
// PlayerController.js); the enemy recovers on its own instead (see
// Enemy.update()) - unless it hits the border/environment first,
// vanishing there (see the enemy's movement rules).
//
// Combat resolution, decided by both sides' weapons at the moment
// of collision. The enemy's speed is its current approach speed
// (enemy.speed); the player's is PLAYER_SWORD_SPEED, the force of
// its swing:
// - shield up: a reflector - the player takes nothing, the
//   enemy bounces off with PUSH_INITIAL_SPEED
// - both swords drawn: an exchange - each side is knocked back
//   with the *other* side's speed
// - only the player's sword drawn: the player takes nothing, the
//   enemy bounces off with the sum of both speeds
// - only the enemy's sword drawn: the player is knocked back with
//   PUSH_INITIAL_SPEED plus the enemy's speed
// - neither armed: only the player is knocked back, with
//   PUSH_INITIAL_SPEED
// Shield wins if somehow both shield and sword are active at
// once (blocking takes priority over attacking).
// ==================================================

// Cells per second.
const PUSH_INITIAL_SPEED = 15;
const PLAYER_SWORD_SPEED = 15;

// Burst spawned where the player and enemy collide, and the
// (slower) speed of the trace particles a pushed player/enemy
// leaves, plus the chance (0..1) of a trace particle per cell.
const COLLISION_PARTICLE_COUNT = 3;
const TRACE_PARTICLE_SPEED = 1;
const TRACE_PARTICLE_DENSITY = .5;


// Removes the enemy for good - called once a push carries it
// into the border or the environment.
function vanishEnemy() {
    enemy.alive = false;
    enemy.push.stop();

    if (enemy.sword) {
        const sword = enemy.sword;
        sword.sheathe();
        world.remove(sword);
    }

    world.remove(enemy);
    movement.remove(enemy);
}


// Trace left behind by a push: on the cell the push just carried
// its owner out of, spawns one slow particle with probability
// TRACE_PARTICLE_DENSITY.
function leavePushTrace(x, y) {
    if (Math.random() < TRACE_PARTICLE_DENSITY) {
        spawnParticles(x, y, 1, TRACE_PARTICLE_SPEED, false);
    }
}


// How far apart (in cells, same row) a part of the player and a part
// of the enemy may be and still touch. 1 = adjacent cells.
const CONTACT_DISTANCE = 1;


// The cells a side takes up in the fight: its body plus every
// weapon it currently has out.
function combatParts(body, ...weapons) {
    return [body, ...weapons.filter(Boolean)];
}


// The first pair of parts (one per side) that touch - on the same
// row, at most CONTACT_DISTANCE cells apart - or null.
function findContact(partsA, partsB) {

    for (const a of partsA) {
        for (const b of partsB) {
            if (a.y === b.y && Math.abs(a.x - b.x) <= CONTACT_DISTANCE) {
                return { a, b };
            }
        }
    }

    return null;
}


// Checked once per tick, after everything has moved. Fires as soon
// as any part of the player (body, sword, shield) touches any part
// of the enemy (body, sword) - see findContact(). Only fires when
// neither side is already mid-push - otherwise every tick of contact
// would refresh it to full speed and neither would ever finish
// recovering/flying apart.
//
// Everything directional follows from one `enemySide`: who is
// pushed which way, and whether each side's weapon actually faces
// the other (a shield on the back doesn't block, a sword pointing
// away doesn't hit).
function checkEnemyEncounter() {

    if (!enemy.alive) {
        return;
    }

    if (player.push.active() || enemy.push.active()) {
        return;
    }

    const contact = findContact(
        combatParts(player, player.sword, player.shield),
        combatParts(enemy, enemy.sword)
    );

    if (!contact) {
        return;
    }

    // Burst at the player's touching part - sword tip, shield or body.
    spawnParticles(contact.a.x, contact.a.y, COLLISION_PARTICLE_COUNT);

    const playerFacing = player.facing === "left" ? -1 : 1;

    // Which side of the player the enemy is on (-1 left, 1 right).
    // Bodies can't share a cell, so this only falls back to where
    // they came from / the player's facing in odd cases.
    const enemySide =
        Math.sign(enemy.x - player.x) ||
        Math.sign(enemy.previousX - player.previousX) ||
        playerFacing;

    const awayFromEnemy = -enemySide;
    const awayFromPlayer = enemySide;

    const playerFacesEnemy = playerFacing === enemySide;
    const enemyFacesPlayer = enemy.direction === -enemySide;

    const shield = player.shield && playerFacesEnemy;
    const playerSword = player.sword && playerFacesEnemy;
    const enemySword = enemy.sword && enemyFacesPlayer;

    if (shield) {
        enemy.mover.startPush(awayFromPlayer, PUSH_INITIAL_SPEED);
    }
    else if (playerSword && enemySword) {
        player.mover.startPush(awayFromEnemy, enemy.speed);
        enemy.mover.startPush(awayFromPlayer, PLAYER_SWORD_SPEED);
    }
    else if (playerSword) {
        enemy.mover.startPush(awayFromPlayer, PLAYER_SWORD_SPEED + enemy.speed);
    }
    else if (enemySword) {
        player.mover.startPush(awayFromEnemy, PUSH_INITIAL_SPEED + enemy.speed);
    }
    else {
        player.mover.startPush(awayFromEnemy, PUSH_INITIAL_SPEED);
    }
}


// ==================================================
// Particles
//
// Particles (see Particle.js) are ordinary world objects: updated
// every tick, and dropped by the world once they've run out of
// characters.
// ==================================================

const PARTICLE_GRAVITATION = 10;
const PARTICLE_SPEED = 6;


// Spawns `count` particles at (x, y), each flying off in its own
// random direction with its own random character sequence.
function spawnParticles(x, y, count, speed = PARTICLE_SPEED, gravitation = true) {

    for (let i = 0; i < count; i++) {
        world.add(new Particle(x, y, speed, gravitation));
    }
}


// ==================================================
// Squiggle (D, held)
//
// Decorative only - a string of random letters (see Squiggle.js)
// grows from the player while "D" is held and vanishes on release.
// Nothing collides with it.
// ==================================================

function startSquiggle() {

    if (player.squiggle) {
        return;
    }

    player.squiggle = new Squiggle(player);
    player.squiggle.grow();
    world.add(player.squiggle);
}


function stopSquiggle() {

    if (!player.squiggle) {
        return;
    }

    world.remove(player.squiggle);
    player.squiggle = null;
}


// ==================================================
// Input: title screen -> game, then play
//
// The key handlers only record input - arrow keys go to the
// PlayerController, which acts on them on the next tick. Weapons are
// created right away, but they too only count (and show) from the
// next tick on.
// ==================================================

document.addEventListener("keydown", event => {

    if (!gameStarted) {
        gameStarted = true;
        startGame();
        return;
    }

    const key = event.key.toLowerCase();

    if (key === "w") {

        // Ignore auto-repeat while the key is held - one press,
        // one swing.
        if (!event.repeat) {
            swingSword();
        }

        return;
    }

    if (key === "a") {
        showShield();
        return;
    }

    if (key === "d") {
        startSquiggle();
        return;
    }

    if (playerController.handles(event.key)) {
        playerController.press(event.key, event.repeat);
    }
});


document.addEventListener("keyup", event => {

    const key = event.key.toLowerCase();

    if (key === "a") {
        hideShield();
    }

    if (key === "d") {
        stopSquiggle();
    }

    if (playerController.handles(event.key)) {
        playerController.release(event.key);
    }
});


window.addEventListener("blur", () => playerController.releaseAll());


// Last, once everything above exists.
loop.start();
