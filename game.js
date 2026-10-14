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
// player input, enemy AI, movement, hit checks,
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
// 2. objects - enemy AI, particles, ...
// 3. enemy tactics, rubber band - player and enemy pull on each other in combat
//    (a fighter holding a block is held in place right after)
// 4. movement - everything that moves, one cell at a time
// 5. combat - player/enemy encounter
// 6. draw
function tick(dt) {

    if (gameStarted && player.alive) {
        playerController.update(dt);
    }

    world.update(dt);

    if (gameStarted) {
        enemyTactics.update(dt);
        rubberBand.update(dt);
        holdBlockers();

        movement.update(dt);
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

// In combat, player and enemy pull on each other - see RubberBand.js.
const rubberBand = new RubberBand(player, enemy);
playerController.rubberBand = rubberBand;
enemy.rubberBand = rubberBand;

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
// - Both: running into the border/scenery at LETHAL_SPEED or more
//   kills (killPlayer(), vanishEnemy()) - no matter whether that
//   speed comes from a hit, the rubber band's pull or the player's
//   own impulse. Slower, it just stops the speed. Walking steps
//   (the player's) never kill.
// - Neither can step onto the other's cell - they fight by touching
//   (see checkEnemyEncounter()), not by overlapping. Being blocked by
//   the other's body leaves the speed alone: the encounter
//   recalculates it.
//
// Both leave a trace of particles behind while that fast.
// ==================================================

// Cells per second.
const LETHAL_SPEED = 5;


function occupies(object, x, y) {
    return object.alive !== false && object.x === x && object.y === y;
}


// Fast enough to die running into something.
function isFlying(object) {
    return Math.abs(object.velocityX) >= LETHAL_SPEED;
}


function registerMovement() {

    movement.add(player, {

        canEnter: (x, y) =>
            x >= PLAYER_MIN_X && x <= PLAYER_MAX_X &&
            y >= PLAYER_MIN_Y && y <= PLAYER_MAX_Y &&
            !wouldCollideAt(x, y) &&
            !occupies(enemy, x, y),

        // Only a step along the player's own speed counts - walking
        // into something (also sideways, or against the speed) just
        // doesn't happen. Riding the speed into it does kill.
        onBlocked: (x, y) => {
            const along = Math.sign(x - player.x) === Math.sign(player.velocityX);

            if (x === player.x || !along || occupies(enemy, x, y)) {
                return;
            }

            if (isFlying(player)) {
                killPlayer();
            }
            else {
                player.mover.stop();
            }
        },

        onMoved: (fromX, fromY) => {

            // Debug: only leave particles on push
            if (Math.sign(player.mover.velocityX) != Math.sign( enemy.x - fromX ) ) {
                if (isFlying(player)) {
                    leavePushTrace(fromX, fromY);
                }
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

            if (isFlying(enemy)) {
                vanishEnemy();
            }
            else {
                enemy.bump();
            }
        },

        onMoved: (fromX, fromY) => {

            if (Math.sign(enemy.mover.velocityX) != Math.sign( enemy.x - fromX ) ) {
                if (isFlying(enemy)) {
                    leavePushTrace(fromX, fromY);
                }
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
// Combat: stances - attacks and blocks (see Stance.js)
//
// Each fighter holds at most one stance: an attack or a block, from
// above, below or as a dash. Who wins a collision is decided by
// Clash.js (see checkEnemyEncounter()); every collision deletes all
// stances.
//
// The player:
// - W/S attack from above/below. A short set up runs first (see
//   SwordWindup.js), then the attack stance is taken. It already
//   counts during the set up. With an attack held, W/S switch its
//   direction at once.
// - in combat, A dashes left and D right: a fresh press toward the
//   enemy is a charge - the dash attack, plus an impulse (see
//   PlayerController.js)
// - holding the other one (away from the enemy) brakes; once
//   stopped, the player takes the block. The shield sits by itself
//   where the enemy's attack comes from (see shieldDirection()). It
//   lasts while the key is held; W/S do nothing meanwhile.
//
// The enemy picks its stances itself - see EnemyTactics.js.
//
// A fighter holding a block stands still: tick() stops it right
// after the rubber band's pull.
// ==================================================

// Takes the stance `kind` from `direction` - an existing one of the
// same kind just changes its direction.
function setStance(fighter, kind, direction) {

    if (fighter.alive === false) {
        return;
    }

    if (fighter.stance && fighter.stance.kind === kind) {
        fighter.stance.direction = direction;
        return;
    }

    clearStance(fighter);

    fighter.stance = new Stance(fighter, kind, direction);
    world.add(fighter.stance);
}


function clearStance(fighter) {

    if (!fighter.stance) {
        return;
    }

    world.remove(fighter.stance);
    fighter.stance = null;
}


function isBlocking(fighter) {
    return fighter.stance !== null && fighter.stance.kind === Stance.BLOCK;
}


// W/S: an above/below attack, after the set up.
function drawSword(direction) {

    if (!player.alive || playerController.bracing) {
        return;
    }

    if (player.stance && player.stance.kind === Stance.ATTACK) {
        player.stance.direction = direction;
        return;
    }

    if (player.windup) {
        player.windup.stance = direction;
        return;
    }

    player.windup = new SwordWindup(player, direction, readyDirection => {
        player.windup = null;
        setStance(player, Stance.ATTACK, readyDirection);
    });

    world.add(player.windup);
}


// Drops the player's attack set up, if one is running.
function cancelWindup() {

    if (!player.windup) {
        return;
    }

    world.remove(player.windup);
    player.windup = null;
}


// The player's stance for a collision: the one held, or the attack
// being set up (see SwordWindup.js) - as { kind, direction }, or null.
function playerCombatStance() {

    if (player.stance) {
        return player.stance;
    }

    if (player.windup) {
        return { kind: Stance.ATTACK, direction: player.windup.stance };
    }

    return null;
}


// The player's shield is placed automatically: against the enemy's
// attack, if it holds one; otherwise it stays where it is, or starts
// at SHIELD_DEFAULT_DIRECTION.
const SHIELD_DEFAULT_DIRECTION = "dash";

function shieldDirection() {

    if (enemy.stance && enemy.stance.kind === Stance.ATTACK) {
        return enemy.stance.direction;
    }

    if (isBlocking(player)) {
        return player.stance.direction;
    }

    return SHIELD_DEFAULT_DIRECTION;
}


playerController.hooks = {

    charge() {
        cancelWindup();
        setStance(player, Stance.ATTACK, "dash");
    },

    // Starts braking for a block - an attack is dropped.
    brace() {
        cancelWindup();

        if (player.stance && player.stance.kind === Stance.ATTACK) {
            clearStance(player);
        }
    },

    // Called every tick while blocking, so the shield follows the
    // enemy's attack.
    block() {
        setStance(player, Stance.BLOCK, shieldDirection());
    },

    unblock() {
        if (isBlocking(player)) {
            clearStance(player);
        }
    }
};


const enemyTactics = new EnemyTactics(enemy, rubberBand, playerCombatStance, {

    attack(direction) {
        setStance(enemy, Stance.ATTACK, direction);
    },

    block(direction) {
        setStance(enemy, Stance.BLOCK, direction);
    },

    drop() {
        clearStance(enemy);
    }
});


// Called in tick() right after the rubber band: a fighter holding a
// block doesn't move.
function holdBlockers() {

    for (const fighter of [player, enemy]) {
        if (isBlocking(fighter)) {
            fighter.mover.stop();
        }
    }
}


// ==================================================
// Encounter: player and enemy run into each other
//
// Both have one horizontal speed (see Mover.js) and nothing else - a
// push is just that speed pointing away from the other. Every
// encounter recalculates both speeds from the current ones. In
// combat the rubber band then brakes them and pulls both back
// together (see RubberBand.js); outside of combat they brake (see
// PlayerController.js, Enemy.update()).
//
// Each side's speed toward the other at the moment of contact adds
// up to the closing speed. Both stances decide (see Clash.js) what
// each side gets, as a speed away from the other:
// - stands firm: 0
// - pushed back: the closing speed, plus PLAYER_PUSH_IMPULSE /
//   ENEMY_PUSH_IMPULSE
// - reflected: its own speed, turned around (multiplied by -1)
// The player's attack already counts while it's being set up (see
// SwordWindup.js). With LOG_ENCOUNTERS on, every encounter is logged
// to the console (see logEncounter()).
//
// Every encounter deletes both stances and the player's set up; the
// enemy picks anew (see EnemyTactics.reset()).
// ==================================================

// Cells per second added to a fighter's speed when it's pushed back.
const PLAYER_PUSH_IMPULSE = 6;
const ENEMY_PUSH_IMPULSE = 0;

// Cells per second added to everyone who bounces off in an
// encounter (anyone who stands firm keeps 0). Makes up for the speed
// the fixed tick loses on every bounce, so a fight doesn't slowly
// die down.
const ENCOUNTER_PUSH = 2*3; // 2;

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

    clearStance(enemy);

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

    clearStance(player);
    cancelWindup();
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


// The cells a side takes up in the fight: its body plus a dash
// stance, which is held on its own row, in front (see Stance.js).
// Above/below stances add no reach.
function combatParts(fighter) {

    const parts = [fighter];

    if (fighter.stance && fighter.stance.inFront) {
        parts.push(fighter.stance);
    }

    return parts;
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
// as any part of the player touches any part of the enemy - see
// findContact() - while the two are closing in on each other. Once
// they fly apart it can't fire again, so staying in contact doesn't
// keep re-triggering it.
//
// Everything directional follows from one `enemySide`: who is
// pushed which way.
function checkEnemyEncounter() {

    if (!enemy.alive || !player.alive) {
        return;
    }

    const contact = findContact(combatParts(player), combatParts(enemy));

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

    // Each side's speed toward the other, negative while moving away.
    const playerApproach = player.velocityX * enemySide;
    const enemyApproach = -enemy.velocityX * enemySide;
    const closing = playerApproach + enemyApproach;

    if (closing <= 0) {
        return;
    }

    // Burst at the player's touching part - stance or body.
    spawnParticles(contact.a.x, contact.a.y, COLLISION_PARTICLE_COUNT);

    const playerStance = playerCombatStance();
    const enemyStance = enemy.stance;
    const clash = Clash.resolve(playerStance, enemyStance);

    const playerAway = withEncounterPush(
        awaySpeed(clash.a, closing, playerApproach, PLAYER_PUSH_IMPULSE)
    );
    const enemyAway = withEncounterPush(
        awaySpeed(clash.b, closing, enemyApproach, ENEMY_PUSH_IMPULSE)
    );

    player.mover.knock(-enemySide * playerAway);
    enemy.mover.knock(enemySide * enemyAway);

    if (LOG_ENCOUNTERS) {
        logEncounter({
            playerStance: describeStance(playerStance, !player.stance),
            enemyStance: describeStance(enemyStance, false),
            clash,
            playerSpeed: playerAway,
            enemySpeed: enemyAway
        });
    }

    clearStance(player);
    cancelWindup();
    clearStance(enemy);
    enemyTactics.reset();
}


// A side's speed away from the other after the encounter, from its
// Clash outcome. `approach` is its own speed toward the other before.
function awaySpeed(outcome, closing, approach, pushImpulse) {

    if (outcome === Clash.PUSHED) {
        return closing + pushImpulse;
    }

    if (outcome === Clash.REFLECTED) {
        return approach;
    }

    return 0;
}


// Encounter log, for balancing: one console line per collision.
const LOG_ENCOUNTERS = true;


// "attack above (set up)", "block dash", "none".
function describeStance(stance, settingUp) {

    if (!stance) {
        return "none";
    }

    return `${stance.kind} ${stance.direction}` + (settingUp ? " (set up)" : "");
}


function logEncounter(e) {

    console.log(
        `Encounter | player: ${e.playerStance} | enemy: ${e.enemyStance}` +
        ` | ${e.clash.rule}: player ${e.clash.a}, enemy ${e.clash.b}` +
        ` | speeds away: player ${e.playerSpeed.toFixed(1)}, enemy ${e.enemySpeed.toFixed(1)} cells/s`
    );
}


// A speed away from the other side, plus ENCOUNTER_PUSH if it
// bounces off at all.
function withEncounterPush(away) {
    return away > 0 ? away + ENCOUNTER_PUSH : away;
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
// Squiggle (E, held)
//
// Decorative only - a string of random letters (see Squiggle.js)
// grows from the player while "E" is held and vanishes on release.
// Nothing collides with it.
// ==================================================

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
// The key handlers only record input - arrow keys and A/D go to the
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

    // Auto-repeat is ignored: a held key would keep making the enemy
    // react anew (see EnemyTactics.js).
    if (key === "w") {
        if (!event.repeat) {
            drawSword("above");
        }
        return;
    }

    if (key === "s") {
        if (!event.repeat) {
            drawSword("below");
        }
        return;
    }

    if (key === "e") {
        startSquiggle();
        return;
    }

    if (playerController.handles(event.key)) {
        playerController.press(event.key, event.repeat);
    }
});


document.addEventListener("keyup", event => {

    const key = event.key.toLowerCase();

    if (key === "e") {
        stopSquiggle();
    }

    if (playerController.handles(event.key)) {
        playerController.release(event.key);
    }
});


window.addEventListener("blur", () => playerController.releaseAll());


// Last, once everything above exists.
loop.start();
