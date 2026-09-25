// ==================================================
// Game
// ==================================================

const viewport = document.getElementById("viewport");

const renderer = new AsciiRenderer(
    viewport,
    41,
    18
);


// ==================================================
// Title screen
// ==================================================

const splash = new SplashScreen();
splash.x = 0;
splash.y = 4;

const pressAnyKey = new BlinkingText(14, 15, "Press any key");


renderer.add(splash);
renderer.add(pressAnyKey);

renderer.render();


const blinkTimer = setInterval(() => {
    pressAnyKey.visible = !pressAnyKey.visible;
    renderer.render();
}, 500);


// ==================================================
// Game objects
// ==================================================

const ground = new Ground();
const player = new Player(15, 10);

const enemy = new Enemy(5, 12, 5, 35);
const ENEMY_STEP_INTERVAL = 400;

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


function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
}


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


function startGame() {

    clearInterval(blinkTimer);

    renderer.remove(splash);
    renderer.remove(pressAnyKey);

    renderer.add(ground);
    renderer.add(mountain);
    renderer.add(tree);
    renderer.add(enemy);
    renderer.add(player);

    updateParallax();
    renderer.render();

    setInterval(() => {

        if (!enemy.alive) {
            return;
        }

        enemy.step(player);
        updateEnemySword();
        checkEnemyEncounter();
        renderer.render();
    }, ENEMY_STEP_INTERVAL);
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

    player.sword = new Sword(player);
    renderer.add(player.sword);
    renderer.render();

    setTimeout(() => {
        player.sword.frame = "dash";
        renderer.render();

        setTimeout(() => {
            renderer.remove(player.sword);
            player.sword = null;
            renderer.render();
        }, SWORD_FRAME_DURATION);

    }, SWORD_FRAME_DURATION);
}


function showShield() {

    if (player.shield) {
        return;
    }

    player.shield = new Shield(player);
    renderer.add(player.shield);
    renderer.render();
}


function hideShield() {

    if (!player.shield) {
        return;
    }

    renderer.remove(player.shield);
    player.shield = null;
    renderer.render();
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

const ENEMY_SWORD_DRAW_DISTANCE = 2;
const ENEMY_SWORD_DURATION = 1200;
const ENEMY_SWORD_COOLDOWN = 800;


// Called every enemy tick - draws the sword if the enemy is in
// range, able to fight and not still cooling down.
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

    if (performance.now() < enemy.swordReadyAt) {
        return;
    }

    drawEnemySword();
}


function drawEnemySword() {

    enemy.sword = new EnemySword(enemy);
    renderer.add(enemy.sword);
    renderer.render();

    setTimeout(sheathEnemySword, ENEMY_SWORD_DURATION);
}


function sheathEnemySword() {

    if (!enemy.sword) {
        return;
    }

    renderer.remove(enemy.sword);
    enemy.sword = null;
    enemy.swordReadyAt = performance.now() + ENEMY_SWORD_COOLDOWN;
    renderer.render();
}


// ==================================================
// Push: knockback from running into the enemy
//
// Both player and enemy carry a Push (see Push.js): a speed
// (cells per tick, may be fractional - a hidden sub-cell offset
// accumulates it and only whole cells crossed actually move
// anyone) and a direction, away from the other side. The
// player's only goes down by pressing an arrow key (see the
// keydown handler); the enemy has no input to fight it with, so
// it recovers on its own instead - ENEMY_PUSH_RECOVER_AMOUNT
// speed every ENEMY_PUSH_RECOVER_INTERVAL - unless it hits the
// border/environment first (vanishing there, see
// stepEnemyPush()).
//
// Combat resolution, decided by both sides' weapons at the
// moment of collision. The enemy's speed is its current approach
// speed (enemy.speed); the player's is PLAYER_SWORD_SPEED, the
// force of its swing:
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

const PUSH_INITIAL_SPEED = 3;
const PLAYER_SWORD_SPEED = 3;

// Burst spawned where the player and enemy collide, and the
// (slower) speed of the trace particles a pushed player/enemy
// leaves, plus the chance (0..1) of a trace particle per cell.
const COLLISION_PARTICLE_COUNT = 3;
const TRACE_PARTICLE_SPEED = 1;
const TRACE_PARTICLE_DENSITY = .5;
const PUSH_STEP_INTERVAL = 200;

// How many recovery keypresses it takes to shave 1 off the
// player's push speed. Higher = slower to recover from a push.
const PUSH_RECOVER_PRESSES_PER_POINT = 1;

// The enemy's self-recovery from a push: loses
// ENEMY_PUSH_RECOVER_AMOUNT speed every ENEMY_PUSH_RECOVER_INTERVAL ms.
const ENEMY_PUSH_RECOVER_INTERVAL = 500;
const ENEMY_PUSH_RECOVER_AMOUNT = 1;


// Removes the enemy for good - called once a push carries it
// into the border or the environment. Its own push is stopped
// too, so a stale reference can't keep nudging a dead enemy.
function vanishEnemy() {
    enemy.alive = false;
    enemy.push.stop();
    sheathEnemySword();
    renderer.remove(enemy);
}


// Moves the enemy by `cells` (from enemy.push.step()). Unlike the
// player, the enemy isn't clamped to the viewport - it can fly
// straight off the display - but the moment it would leave the
// display, or its new spot overlaps any scenery, it vanishes
// instead of landing there.
function stepEnemyPush(cells) {

    const nextX = enemy.x + cells;

    if (nextX < 0 || nextX >= renderer.width) {
        vanishEnemy();
        return;
    }

    const enemyProbe = makeCollisionProbe(enemy, nextX, enemy.y);

    for (const object of parallaxObjects) {
        if (renderer.objectsCollide(enemyProbe, object)) {
            vanishEnemy();
            return;
        }
    }

    enemy.x = nextX;
}


// Trace left behind by a push: on every cell between fromX
// (inclusive) and toX (exclusive) - the cells the push just
// carried its owner out of - spawns one slow particle with
// probability TRACE_PARTICLE_DENSITY.
function spawnPushTrail(fromX, toX, y) {

    const step = Math.sign(toX - fromX);

    for (let x = fromX; x !== toX; x += step) {
        if (Math.random() < TRACE_PARTICLE_DENSITY) {
            spawnParticles(x, y, 1, TRACE_PARTICLE_SPEED, false);
        }
    }
}


// Only fires when neither side is already mid-push - otherwise
// every tick of overlap would refresh it to full speed and
// neither would ever finish recovering/flying apart.
function checkEnemyEncounter() {

    if (!enemy.alive) {
        return;
    }

    if (player.push.active() || enemy.push.active()) {
        return;
    }

    if (!renderer.objectsCollide(player, enemy)) {
        return;
    }

    spawnParticles(player.x, player.y, COLLISION_PARTICLE_COUNT);

    const awayFromEnemy = player.x <= enemy.x ? -1 : 1;
    const awayFromPlayer = -awayFromEnemy;

    if (player.shield) {
        enemy.push.start(awayFromPlayer, PUSH_INITIAL_SPEED);
    }
    else if (player.sword && enemy.sword) {
        player.push.start(awayFromEnemy, enemy.speed);
        enemy.push.start(awayFromPlayer, PLAYER_SWORD_SPEED);
    }
    else if (player.sword) {
        enemy.push.start(awayFromPlayer, PLAYER_SWORD_SPEED + enemy.speed);
    }
    else if (enemy.sword) {
        player.push.start(awayFromEnemy, PUSH_INITIAL_SPEED + enemy.speed);
    }
    else {
        player.push.start(awayFromEnemy, PUSH_INITIAL_SPEED);
    }
}


setInterval(() => {

    let moved = false;

    // Push.step() advances the hidden smooth position and says how
    // many whole cells were crossed - only those move the owner.
    if (player.push.active()) {
        const cells = player.push.step();

        if (cells !== 0) {
            const startX = player.x;
            player.x = clamp(player.x + cells, PLAYER_MIN_X, PLAYER_MAX_X);
            spawnPushTrail(startX, player.x, player.y);
            moved = true;
        }
    }

    if (enemy.alive && enemy.push.active()) {
        const cells = enemy.push.step();

        if (cells !== 0) {
            const startX = enemy.x;
            stepEnemyPush(cells);

            // A vanished enemy never lands, so x stays put and no
            // trail is left for that last tick.
            spawnPushTrail(startX, enemy.x, enemy.y);
            moved = true;
        }

        enemy.push.recoverOverTime(
            PUSH_STEP_INTERVAL,
            ENEMY_PUSH_RECOVER_INTERVAL,
            ENEMY_PUSH_RECOVER_AMOUNT
        );
    }

    if (moved) {
        updateParallax();
        renderer.render();
    }
}, PUSH_STEP_INTERVAL);


// ==================================================
// Particles
//
// Every live Particle (see Particle.js) sits in `particles` and
// in the renderer. One shared loop advances them all by the real
// time elapsed since the last tick, and drops any that have run
// out of characters from both lists.
// ==================================================

const PARTICLE_STEP_INTERVAL = 50;
const PARTICLE_GRAVITATION = 10;
const PARTICLE_SPEED = 6;

const particles = [];


// Spawns `count` particles at (x, y), each flying off in its own
// random direction with its own random character sequence.
function spawnParticles(x, y, count, speed = PARTICLE_SPEED, gravitation = true) {

    for (let i = 0; i < count; i++) {
        const particle = new Particle(x, y, speed, gravitation);

        particles.push(particle);
        renderer.add(particle);
    }

    renderer.render();
}


let lastParticleTick = performance.now();

setInterval(() => {

    const now = performance.now();
    const dt = now - lastParticleTick;
    lastParticleTick = now;

    if (particles.length === 0) {
        return;
    }

    // Iterate backwards so splicing out dead particles doesn't
    // skip the next one.
    for (let i = particles.length - 1; i >= 0; i--) {
        const particle = particles[i];

        particle.update(dt);

        if (!particle.alive) {
            renderer.remove(particle);
            particles.splice(i, 1);
        }
    }

    renderer.render();
}, PARTICLE_STEP_INTERVAL);


// ==================================================
// Squiggle (D, held)
//
// Decorative only - a string of random letters (see Squiggle.js)
// grows from the player one letter every SQUIGGLE_GROW_INTERVAL
// ms while "D" is held, up to SQUIGGLE_MAX_LENGTH letters, and
// vanishes on release. Nothing collides with it.
// ==================================================

const SQUIGGLE_GROW_INTERVAL = 5;
const SQUIGGLE_MAX_LENGTH = 20;

let squiggleTimer = null;


function startSquiggle() {

    if (player.squiggle) {
        return;
    }

    player.squiggle = new Squiggle(player);
    renderer.add(player.squiggle);

    growSquiggle();
    squiggleTimer = setInterval(growSquiggle, SQUIGGLE_GROW_INTERVAL);
}


function growSquiggle() {

    if (!player.squiggle || player.squiggle.length >= SQUIGGLE_MAX_LENGTH) {
        player.squiggle.generate(player.squiggle.segments.length);
        return;
    }

    player.squiggle.grow();
    renderer.render();
}

function stopSquiggle() {

    if (!player.squiggle) {
        return;
    }

    clearInterval(squiggleTimer);
    squiggleTimer = null;

    renderer.remove(player.squiggle);
    player.squiggle = null;
    renderer.render();
}


// ==================================================
// Input: title screen -> game, then move the player
// ==================================================

let gameStarted = false;

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

    let dx = 0;
    let dy = 0;

    switch (event.key) {

        case "ArrowUp":
            dy = -1;
            break;

        case "ArrowDown":
            dy = 1;
            break;

        case "ArrowLeft":
            dx = -1;
            player.facing = "left";
            break;

        case "ArrowRight":
            dx = 1;
            player.facing = "right";
            break;

        default:
            return;
    }

    // While reeling from a push, arrow keys don't move the
    // player - they only fight the knockback, chipping away at
    // it PUSH_RECOVER_PRESSES_PER_POINT presses per point of speed.
    if (player.push.active()) {
        player.push.recoverStep(PUSH_RECOVER_PRESSES_PER_POINT);
        return;
    }

    const targetX = clamp(player.x + dx, PLAYER_MIN_X, PLAYER_MAX_X);
    const targetY = clamp(player.y + dy, PLAYER_MIN_Y, PLAYER_MAX_Y);

    if (!wouldCollideAt(targetX, targetY)) {
        player.x = targetX;
        player.y = targetY;
    }

    checkEnemyEncounter();

    updateParallax();
    renderer.render();
});


document.addEventListener("keyup", event => {

    const key = event.key.toLowerCase();

    if (key === "a") {
        hideShield();
    }

    if (key === "d") {
        stopSquiggle();
    }
});
