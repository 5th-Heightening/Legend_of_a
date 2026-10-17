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
// 3. enemy tactics, then every attacker heads for the other one at
//    its constant speed
// 4. movement - everything that moves, one cell at a time
// 5. combat - player/enemy encounter, initiative trail
// 6. draw
function tick(dt) {

    if (gameStarted && player.alive) {
        playerController.update(dt);
    }

    world.update(dt);

    if (gameStarted) {
        enemyTactics.update(dt);
        steerAttackers();

        movement.update(dt);
        checkEnemyEncounter();
        leaveInitiativeTrail();
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

// Decides when the two are in combat - see RubberBand.engaged(). Its
// pull isn't used: in combat the speed is constant (see "Combat"
// below).
const rubberBand = new RubberBand(player, enemy);
playerController.rubberBand = rubberBand;
enemy.rubberBand = rubberBand;


// ==================================================
// Levels
//
// The scenery comes from the current level (see Level.js and the
// level files in levels/). parallaxObjects is always that level's
// parts - what updateParallax() moves and what blocks movement.
// ==================================================

const START_LEVEL_ID = "meadow";

let currentLevel = null;
let parallaxObjects = [];


// Swaps the scenery of the current level for that of `level`.
function loadLevel(level) {

    for (const part of parallaxObjects) {
        world.remove(part);
    }

    currentLevel = level;
    parallaxObjects = level.parts;

    for (const part of parallaxObjects) {
        world.add(part);
    }

    updateParallax();
}


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
// with the player (parallax). `parts` defaults to the current
// level; checking an arrival spot passes the next level's.
function wouldCollideAt(px, py, parts = parallaxObjects) {

    const { t, u } = parallaxCoordsFor(px, py);

    const playerProbe = makeCollisionProbe(player, px, py);

    for (const object of parts) {

        const { x, y } = object.interpolatePosition(t, u);

        const objectProbe = makeCollisionProbe(object, x, y);

        if (renderer.objectsCollide(playerProbe, objectProbe)) {
            return true;
        }
    }

    return false;
}


// Which edge of the play area (x, y) lies beyond - "left",
// "right", "up", "down" - or null while it's inside. Movement goes
// one axis at a time, so a step only ever crosses one edge.
function exitSideAt(x, y) {

    if (x < PLAYER_MIN_X) return "left";
    if (x > PLAYER_MAX_X) return "right";
    if (y < PLAYER_MIN_Y) return "up";
    if (y > PLAYER_MAX_Y) return "down";

    return null;
}


// Where the player lands in the next level after stepping out to
// (x, y) over `side`: on the opposite edge, same row/column.
function arrivalFor(side, x, y) {

    switch (side) {
        case "left":  return { x: PLAYER_MAX_X, y };
        case "right": return { x: PLAYER_MIN_X, y };
        case "up":    return { x, y: PLAYER_MAX_Y };
        case "down":  return { x, y: PLAYER_MIN_Y };
    }
}


// Can the player step out of the play area to (x, y)? Only over an
// edge with an exit, and only if the arrival spot in the next level
// is free - otherwise the edge blocks like a closed one.
function canLeaveTo(x, y) {

    const side = exitSideAt(x, y);
    const next = currentLevel.exitTowards(side);

    if (!next) {
        return false;
    }

    const arrival = arrivalFor(side, x, y);

    return !wouldCollideAt(arrival.x, arrival.y, next.parts) &&
        !occupies(enemy, arrival.x, arrival.y);
}


// The player has stepped out over an edge (canLeaveTo() allowed
// it): put it on the opposite edge and switch to the next level.
function changeLevel() {

    const side = exitSideAt(player.x, player.y);
    const arrival = arrivalFor(side, player.x, player.y);

    player.x = arrival.x;
    player.y = arrival.y;

    loadLevel(currentLevel.exitTowards(side));
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
//   speed comes from a hit or an attack. Slower, it just stops the speed. Walking steps
//   (the player's) never kill. Grace rule: after a successful
//   fighting collision, the first such deadly hit only stops the
//   fighter (see grantGrace()).
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

        canEnter: (x, y) => {

            if (exitSideAt(x, y)) {
                return canLeaveTo(x, y);
            }

            return !wouldCollideAt(x, y) && !occupies(enemy, x, y);
        },

        // Only a step along the player's own speed counts - walking
        // into something (also sideways, or against the speed) just
        // doesn't happen. Riding the speed into it does kill.
        onBlocked: (x, y) => {
            const along = Math.sign(x - player.x) === Math.sign(player.velocityX);

            if (x === player.x || !along || occupies(enemy, x, y)) {
                return;
            }

            if (isFlying(player) && !useGrace(player)) {
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

            if (exitSideAt(player.x, player.y)) {
                changeLevel();
                return;
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

            if (isFlying(enemy) && !useGrace(enemy)) {
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
    world.add(enemy);
    world.add(player);
    world.add(initiative);

    registerMovement();

    Level.checkExits();
    loadLevel(Level.get(START_LEVEL_ID));
}


// ==================================================
// Combat: attack stances (see Stance.js)
//
// The speed is constant: nothing accelerates or brakes a fighter in
// combat. It only changes at once, to one of:
// - ATTACK_SPEED toward the other fighter, while it holds an attack
//   stance (see steerAttackers()) - also when the other one moves
//   past it, one row apart
// - 0, or PUSH_SPEED away from the other one - after a collision
//   (see checkEnemyEncounter())
// - 0, after running into something too slowly to die (see the
//   movement rules)
// Outside of combat the old braking still applies (see
// PlayerController.brake(), Enemy.update()).
//
// Each fighter holds at most one stance: an attack from above, below
// or as a dash. Every collision deletes both stances.
//
// The player:
// - W/S attack from above/below
// - in combat, A/D toward the enemy: the dash attack (see
//   PlayerController.js)
// Taking a stance - or switching to another direction - makes the
// player the later one (see Initiative.js); taking the same one again
// changes nothing.
//
// The enemy takes its stance EnemyTactics.STANCE_DELAY after every
// collision - see EnemyTactics.js.
// ==================================================

// Cells per second.
const ATTACK_SPEED = 8;

const initiative = new Initiative();

// Takes an attack stance from `direction`. An existing stance just
// changes its direction. Either way the fighter is the later one now,
// unless the stance stays as it is.
function setStance(fighter, direction) {

    if (fighter.alive === false) {
        return;
    }

    if (fighter.stance) {

        if (fighter.stance.direction === direction) {
            return;
        }

        fighter.stance.direction = direction;
    }
    else {
        fighter.stance = new Stance(fighter, Stance.ATTACK, direction);
        world.add(fighter.stance);
    }

    initiative.claim(fighter);
}


function clearStance(fighter) {

    if (!fighter.stance) {
        return;
    }

    world.remove(fighter.stance);
    fighter.stance = null;
}


// W/S: an above/below attack.
function drawSword(direction) {

    if (!player.alive) {
        return;
    }

    setStance(player, direction);
}


// The player's stance for a collision, or null.
function playerCombatStance() {
    return player.stance;
}


playerController.hooks = {

    charge() {
        setStance(player, "dash");
    }
};


const enemyTactics = new EnemyTactics(enemy, rubberBand, {

    attack(direction) {
        setStance(enemy, direction);
    }
});


// Called in tick() before movement: in combat, a fighter with an
// attack stance heads for the other one at ATTACK_SPEED. In the same
// column (one row apart) it keeps its direction.
function steerAttackers() {

    if (!rubberBand.engaged()) {
        return;
    }

    for (const fighter of [player, enemy]) {

        if (!fighter.stance) {
            continue;
        }

        const toward = rubberBand.towardOther(fighter);
        const direction = toward || Math.sign(fighter.velocityX);

        fighter.mover.setVelocity(direction * ATTACK_SPEED, fighter.mover.velocityY);
    }
}


// ==================================================
// Encounter: player and enemy run into each other
//
// Both have one horizontal speed (see Mover.js) and nothing else - a
// push is just that speed pointing away from the other. Every
// encounter sets both speeds anew, from both stances (see Clash.js):
// - stopped: 0
// - pushed back: PLAYER_PUSH_SPEED / ENEMY_PUSH_SPEED away from the
//   other - and that stays, until it takes a stance again or runs
//   into something
// With LOG_ENCOUNTERS on, every encounter is logged to the console
// (see logEncounter()).
//
// Every encounter deletes both stances and the initiative; the enemy
// takes a new stance after a short while (see EnemyTactics.reset()).
//
// Grace rule: a fighter whose encounter outcome is one of
// GRACE_OUTCOMES survives the first deadly hit of the
// border/environment afterwards - it just stops. The next encounter
// grants or takes the grace anew.
// ==================================================

// Clash outcomes that count as a successful collision.
const GRACE_OUTCOMES = [Clash.STOPPED];

// Burst where a fighter is saved by its grace.
const GRACE_PARTICLE_COUNT = 4;

// Cells per second away from the other one, when pushed back.
const PLAYER_PUSH_SPEED = 12;
const ENEMY_PUSH_SPEED = 12;

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


// Trail behind the fighter with the initiative (see Initiative.js):
// with Initiative.TRAIL_DENSITY per tick, one slow particle on the
// row of its attack, drawn as that swing (Initiative.TRAIL_SEQUENCES).
function leaveInitiativeTrail() {

    const stance = initiative.has(player) ? playerCombatStance() : enemy.stance;
    const cell = initiative.trailCell(stance);

    if (cell && Math.random() < Initiative.TRAIL_DENSITY) {
        spawnParticles(cell.x, cell.y, 1, Initiative.TRAIL_SPEED, false, cell.sequence);
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
    const clash = Clash.resolve(playerStance, enemyStance, laterSide());

    const playerAway = awaySpeed(clash.a, PLAYER_PUSH_SPEED);
    const enemyAway = awaySpeed(clash.b, ENEMY_PUSH_SPEED);

    player.mover.knock(-enemySide * playerAway);
    enemy.mover.knock(enemySide * enemyAway);

    grantGrace(player, clash.a);
    grantGrace(enemy, clash.b);

    if (LOG_ENCOUNTERS) {
        logEncounter({
            playerStance: describeStance(playerStance),
            enemyStance: describeStance(enemyStance),
            clash,
            playerSpeed: playerAway,
            enemySpeed: enemyAway
        });
    }

    clearStance(player);
    clearStance(enemy);
    enemyTactics.reset();
    initiative.reset();
}


// Grace rule: after an encounter, `fighter` gets the saving throw if
// its Clash `outcome` was successful, otherwise loses it.
function grantGrace(fighter, outcome) {
    fighter.grace = GRACE_OUTCOMES.includes(outcome);
}


// A deadly hit of the border/environment: true if `fighter` is saved
// by its grace - which is used up then, with a small particle burst
// (and a console line with LOG_ENCOUNTERS on).
function useGrace(fighter) {

    if (!fighter.grace) {
        return false;
    }

    fighter.grace = false;
    spawnParticles(fighter.x, fighter.y, GRACE_PARTICLE_COUNT);

    if (LOG_ENCOUNTERS) {
        console.log(`grace used: ${fighter === player ? "player" : "enemy"} saved at ${fighter.x},${fighter.y}`);
    }

    return true;
}


// Who has taken its stance later (holds the initiative), as
// Clash.resolve() wants it.
function laterSide() {

    if (initiative.has(player)) {
        return Clash.SIDE_A;
    }

    if (initiative.has(enemy)) {
        return Clash.SIDE_B;
    }

    return null;
}


// A side's speed away from the other after the encounter, from its
// Clash outcome.
function awaySpeed(outcome, pushSpeed) {
    return outcome === Clash.PUSHED ? pushSpeed : 0;
}


// Encounter log, for balancing: one console line per collision.
const LOG_ENCOUNTERS = true;


// "attack above (set up)", "attack dash", "none".
function describeStance(stance) {

    if (!stance) {
        return "none";
    }

    return `${stance.kind} ${stance.direction}` + (stance.settingUp ? " (set up)" : "");
}


function logEncounter(e) {

    console.log(
        `Encounter | player: ${e.playerStance} | enemy: ${e.enemyStance}` +
        ` | ${e.clash.rule}: player ${e.clash.a}, enemy ${e.clash.b}` +
        ` | speeds away: player ${e.playerSpeed.toFixed(1)}, enemy ${e.enemySpeed.toFixed(1)} cells/s`
    );
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
// random direction. They all decay through `sequence` if given, else
// each through its own random one (see Particle.SEQUENCES).
function spawnParticles(x, y, count, speed = PARTICLE_SPEED, gravitation = true, sequence = null) {

    for (let i = 0; i < count; i++) {
        world.add(new Particle(x, y, speed, gravitation, sequence));
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
