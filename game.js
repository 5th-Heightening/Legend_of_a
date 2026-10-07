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
    52,
    22,
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

    if (gameStarted && player.alive) {
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
splash.x = 1;
splash.y = 4;

const pressAnyKey = new BlinkingText(20, 16, "Press any key", TITLE_BLINK_INTERVAL);


world.add(splash);
world.add(pressAnyKey);

let gameStarted = false;


// ==================================================
// Game objects
// ==================================================

// Start positions: both on the same row, on opposite sides.
const START_ROW = 12;
const PLAYER_START_X = 35;
const ENEMY_START_X = 5;

const ground = new Ground();
const player = new Player(PLAYER_START_X, START_ROW);
const playerController = new PlayerController(player);

const enemy = new Enemy(ENEMY_START_X, START_ROW, 5, 35, player);

// The enemy decides when the player is in combat (Enemy.inCombat()).
playerController.opponent = enemy;

// One of the two fighters has the initiative, marked with a "!"
// above it - see Initiative.js. The enemy starts with it.
const initiative = new Initiative(enemy);

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
// - Player: stays inside the viewport and is blocked by scenery.
// - Enemy: stays inside the display and is blocked by scenery.
// - Both: being pushed back into the border/scenery kills
//   (killPlayer(), vanishEnemy()). Anything else running into it
//   (a walking step, the dash, the enemy's approach) just stops.
// - Neither can step onto the other's cell - they fight by touching
//   (see checkEnemyEncounter()), not by overlapping. Being blocked by
//   the other's body leaves the movement alone: the encounter
//   decides what happens.
//
// Both leave a trace of particles behind while pushed back.
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

        onBlocked: (x, y) => {

            if (occupies(enemy, x, y)) {
                return;
            }

            if (player.pushed) {
                killPlayer();
            }
            else {
                player.mover.stop();
            }
        },

        onMoved: (fromX, fromY) => {

            if (player.pushed) {
                leavePushTrace(fromX, fromY);
            }

            updateParallax();
        }
    });

    movement.add(enemy, {

        canEnter: (x, y) => !occupies(player, x, y) && enemyFitsAt(x, y),

        onBlocked: (x, y) => {

            if (occupies(player, x, y)) {
                return;
            }

            if (enemy.pushed) {
                vanishEnemy();
            }
            else {
                enemy.bump();
            }
        },

        onMoved: (fromX, fromY) => {

            if (enemy.pushed) {
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
    world.add(initiative);

    registerMovement();
    updateParallax();
}


// ==================================================
// Combat: the player's four actions
//
// - A: dash DASH_SPAN cells toward the enemy (the way the player
//   faces) at DASH_SPEED, sword held out in front
// - D: shield - the player stops and stands still behind it
// - W: swing from above ("|" over the player, "/", "-" in front)
// - S: swing from below ("|" under the player, "\", "-" in front)
//
// Every action is over after its time and the player has nothing
// drawn again (see Sword.js, Shield.js). One action at a time - a
// running one isn't interrupted or restarted.
// ==================================================

const ACTION_KEYS = {
    a: dash,
    d: raiseShield,
    w: () => swing(Sword.FRAMES.overhead),
    s: () => swing(Sword.FRAMES.underhand)
};

// How many cells the dash covers, and how fast (cells per second).
const DASH_SPAN = 3;
const DASH_SPEED = 12;

// How long the sword stays out during the dash, in ms.
const DASH_DURATION = 320;

// How long each of a swing's frames shows, in ms.
const SWING_FRAME_DURATION = 120;

// How long the shield stays up, in ms.
const SHIELD_DURATION = 480;


function dash() {

    if (!player.alive || player.busy || player.pushed || player.recovering) {
        return;
    }

    const facing = player.facing === "left" ? -1 : 1;
    player.lunge(facing, DASH_SPAN, DASH_SPEED);

    drawSword(Sword.FRAMES.dash, DASH_DURATION);
}


function swing(frames) {

    if (!player.alive || player.busy) {
        return;
    }

    drawSword(frames, SWING_FRAME_DURATION);
}


function drawSword(frames, frameDuration) {
    player.sword = new Sword(player, frames, frameDuration);
    world.add(player.sword);
}


function raiseShield() {

    if (!player.alive || player.busy) {
        return;
    }

    // Stops a dash, but not a push back.
    if (!player.pushed) {
        player.mover.stop();
    }

    player.shield = new Shield(player, SHIELD_DURATION);
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
// The enemy attacks with the same sword frames as the player (see
// Sword.js, EnemySword.js): every strike is one of ENEMY_ATTACKS,
// picked at random in advance. It times the strike: every tick it
// predicts when its sword tip would touch the player (see
// ContactPredictor.js) and starts the next attack so that the blade
// arrives in front of it ENEMY_SWORD_LEAD ms or less before the
// predicted contact - a swing starts earlier than a thrust, since
// its blade first passes over/under the enemy. The blade then stays
// in front for ENEMY_SWORD_HOLD, and the enemy waits
// ENEMY_SWORD_COOLDOWN before it can draw again.
// ==================================================

const ENEMY_ATTACKS = [
    Sword.FRAMES.dash,
    Sword.FRAMES.overhead,
    Sword.FRAMES.underhand
];

// How long each of a swing's frames shows, in ms.
const ENEMY_SWING_FRAME_DURATION = 120;

// How long the blade stays in front once it got there, in ms.
const ENEMY_SWORD_HOLD = 600;

const ENEMY_SWORD_COOLDOWN = 0;

// Latest the blade is in front before the predicted contact (ms).
// At least one TICK_INTERVAL, or the right moment could fall
// between two ticks.
const ENEMY_SWORD_LEAD = 80;

// Cells in front of the enemy the strike reaches.
const ENEMY_SWORD_REACH = 1;

let enemyNextAttack = randomEnemyAttack();


function randomEnemyAttack() {
    return ENEMY_ATTACKS[Math.floor(Math.random() * ENEMY_ATTACKS.length)];
}


const contactPredictor = new ContactPredictor(TICK_INTERVAL);


// Cells the player reaches toward the enemy right now - one more
// with a sword or shield out in front of it, on its own row (a
// swing's "|" over or under the player doesn't add reach).
function playerReach() {
    const toward = Math.sign(enemy.x - player.x);

    const inFront = [player.sword, player.shield].some(weapon =>
        weapon && weapon.y === player.y && Math.sign(weapon.x - player.x) === toward
    );

    return inFront ? 1 : 0;
}


// Called every tick - starts the next attack once its blade would
// be in front right when the sword touches the player.
function updateEnemySword() {

    if (!enemy.alive || enemy.sword || enemy.swordCooldown > 0) {
        return;
    }

    if (!player.alive) {
        return;
    }

    const eta = contactPredictor.timeToContact(
        enemy, ENEMY_SWORD_REACH,
        player, playerReach(),
        CONTACT_DISTANCE
    );

    // Time from starting the attack until its blade is in front.
    const windup = Sword.frontFrameIndex(enemyNextAttack) * ENEMY_SWING_FRAME_DURATION;

    // No contact coming, or still too early.
    if (eta === null || eta > ENEMY_SWORD_LEAD + windup) {
        return;
    }

    enemy.sword = new EnemySword(
        enemy,
        enemyNextAttack,
        ENEMY_SWING_FRAME_DURATION,
        ENEMY_SWORD_HOLD,
        ENEMY_SWORD_COOLDOWN
    );
    world.add(enemy.sword);

    enemyNextAttack = randomEnemyAttack();
}


// ==================================================
// Encounter: player and enemy run into each other
//
// An encounter only decides who is pushed back - moved a fixed span
// away from the other at a fixed speed (Player/Enemy.PUSHBACK_SPAN,
// PUSHBACK_SPEED). Whoever isn't pushed back stands firm (stops). The
// enemy then stops for Enemy.RECOVERY_DELAY in either case before it
// runs at the player again (see Enemy.js). Decided by both sides'
// weapons:
// - shield up: the enemy is pushed back
// - both swords drawn, matching positions (mirrored, see
//   Sword.matches(): "/" meets "\", "-" meets "-"): both are pushed
//   back - and the initiative goes to the other side
// - both swords drawn, different positions: whoever doesn't have the
//   initiative is pushed back
// - only the player's sword drawn: the enemy is pushed back
// - only the enemy's sword drawn: the player is pushed back
// - neither armed: both are pushed back
// Shield wins if somehow both shield and sword are active at
// once (blocking takes priority over attacking).
// ==================================================

// Burst spawned where the player and enemy collide, and the
// (slower) speed of the trace particles a pushed player/enemy
// leaves, plus the chance (0..1) of a trace particle per cell.
const COLLISION_PARTICLE_COUNT = 3;
const TRACE_PARTICLE_SPEED = 1;
const TRACE_PARTICLE_DENSITY = .2;


// Death feedback for any character: a copy of it jumps straight up
// from where it stands and falls out of the play area (see
// DeathJump.js). Removing the character itself is up to the caller.
function playDeathJump(character) {
    world.add(new DeathJump(character.x, character.y, character.getAscii(), renderer.height));
}


// Removes the enemy for good - called once a push carries it
// into the border or the environment. It stays where it was when
// the blocked step was tried, so the death jump starts right at
// the border/scenery it hit.
function vanishEnemy() {
    enemy.alive = false;
    enemy.mover.stop();

    if (enemy.sword) {
        const sword = enemy.sword;
        sword.putAway();
        world.remove(sword);
    }

    world.remove(enemy);
    movement.remove(enemy);

    playDeathJump(enemy);
}


// Removes the player for good - called once a push carries it into
// the border or the environment. Everything it had out goes with
// it; from then on input is ignored and the enemy goes back to
// patrolling (see Enemy.inCombat()).
function killPlayer() {
    player.alive = false;
    player.mover.stop();

    if (player.sword) {
        world.remove(player.sword);
        player.sword = null;
    }

    hideShield();
    stopSquiggle();

    world.remove(player);
    movement.remove(player);

    playDeathJump(player);
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
// of the enemy (body, sword) - see findContact() - while neither is
// being pushed back. A push carries the loser out of reach, so
// staying in contact doesn't keep re-triggering it.
//
// Everything directional follows from one `enemySide`: who is
// pushed which way, and whether each side's weapon actually faces
// the other (a shield on the back doesn't block, a sword pointing
// away doesn't hit).
function checkEnemyEncounter() {

    if (!enemy.alive || !player.alive) {
        return;
    }

    if (player.pushed || enemy.pushed) {
        return;
    }

    const enemyStrike = enemy.sword && enemy.sword.drawn ? enemy.sword : null;

    const contact = findContact(
        combatParts(player, player.sword, player.shield),
        combatParts(enemy, enemyStrike)
    );

    if (!contact) {
        return;
    }

    const playerFacing = player.facing === "left" ? -1 : 1;

    // Which side of the player the enemy is on (-1 left, 1 right).
    // Bodies can't share a cell, so this only falls back to where
    // they came from / the player's facing in odd cases.
    const enemySide =
        Math.sign(enemy.x - player.x) ||
        Math.sign(enemy.previousX - player.previousX) ||
        playerFacing;

    // Burst at the player's touching part - sword tip, shield or body.
    spawnParticles(contact.a.x, contact.a.y, COLLISION_PARTICLE_COUNT);

    const playerFacesEnemy = playerFacing === enemySide;
    const enemyFacesPlayer = enemy.direction === -enemySide;

    const shield = player.shield && playerFacesEnemy;
    // A swing only counts once its blade is on the other's row.
    const playerSword = player.sword && playerFacesEnemy && player.sword.y === enemy.y;
    const enemySword = enemyStrike && enemyFacesPlayer && enemyStrike.y === player.y;

    let playerPushed;
    let enemyPushed;

    if (shield) {
        playerPushed = false;
        enemyPushed = true;
    }
    else if (playerSword && enemySword) {

        if (Sword.matches(player.sword.getAscii(), enemyStrike.getAscii())) {
            playerPushed = true;
            enemyPushed = true;
            initiative.give(initiative.has(player) ? enemy : player);
        }
        else {
            playerPushed = !initiative.has(player);
            enemyPushed = initiative.has(player);
        }
    }
    else if (playerSword) {
        playerPushed = false;
        enemyPushed = true;
    }
    else if (enemySword) {
        playerPushed = true;
        enemyPushed = false;
    }
    else {
        playerPushed = true;
        enemyPushed = true;
    }

    if (playerPushed) {
        player.pushBack(-enemySide);
    }
    else {
        player.mover.stop();
    }

    if (enemyPushed) {
        enemy.pushBack(enemySide);
    }
    else {
        enemy.holdGround();
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
// Squiggle (Q, held)
//
// Decorative only - a string of random letters (see Squiggle.js)
// grows from the player while SQUIGGLE_KEY is held and vanishes on
// release. Nothing collides with it.
// ==================================================

const SQUIGGLE_KEY = "q";

function startSquiggle() {

    if (!player.alive || player.squiggle) {
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

    if (key in ACTION_KEYS) {

        // Ignore auto-repeat while the key is held - one press,
        // one action.
        if (!event.repeat) {
            ACTION_KEYS[key]();
        }

        return;
    }

    if (key === SQUIGGLE_KEY) {
        startSquiggle();
        return;
    }

    if (playerController.handles(event.key)) {
        playerController.press(event.key, event.repeat);
    }
});


document.addEventListener("keyup", event => {

    const key = event.key.toLowerCase();

    if (key === SQUIGGLE_KEY) {
        stopSquiggle();
    }

    if (playerController.handles(event.key)) {
        playerController.release(event.key);
    }
});


window.addEventListener("blur", () => playerController.releaseAll());


// Last, once everything above exists.
loop.start();
