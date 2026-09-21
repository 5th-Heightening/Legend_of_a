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
        enemy.step();
        checkEnemyEncounter();
        renderer.render();
    }, ENEMY_STEP_INTERVAL);
}


// ==================================================
// Combat: sword swing (W, one-shot) and shield (A, held)
// ==================================================

const SWORD_FRAME_DURATION = 120;

let sword = null;

function swingSword() {

    // A swing already in progress isn't interrupted or restarted.
    if (sword) {
        return;
    }

    sword = new Sword(player);
    renderer.add(sword);
    renderer.render();

    setTimeout(() => {
        sword.char = "_";
        renderer.render();

        setTimeout(() => {
            renderer.remove(sword);
            sword = null;
            renderer.render();
        }, SWORD_FRAME_DURATION);

    }, SWORD_FRAME_DURATION);
}


let shield = null;

function showShield() {

    if (shield) {
        return;
    }

    shield = new Shield(player);
    renderer.add(shield);
    renderer.render();
}


function hideShield() {

    if (!shield) {
        return;
    }

    renderer.remove(shield);
    shield = null;
    renderer.render();
}


// ==================================================
// Push: knockback from running into the enemy
//
// A push has a speed (cells moved per tick) and a direction,
// away from the enemy. It doesn't decay on its own - the only
// way it goes down is the player pressing an arrow key, which
// costs 1 speed and no movement. Once speed reaches 0, normal
// movement resumes.
// ==================================================

const PUSH_INITIAL_SPEED = 3;
const PUSH_STEP_INTERVAL = 200;

function applyPush(direction) {
    player.pushDirection = direction;
    player.pushSpeed = PUSH_INITIAL_SPEED;
}


// Bare-handed collision with the enemy knocks the player back.
// Only fires when the player isn't already reeling from one -
// otherwise every tick of overlap would refresh it to full
// speed and the player would never recover.
function checkEnemyEncounter() {

    if (player.pushSpeed > 0) {
        return;
    }

    if (renderer.objectsCollide(player, enemy)) {
        applyPush(player.x <= enemy.x ? -1 : 1);
    }
}


setInterval(() => {

    if (player.pushSpeed <= 0) {
        return;
    }

    player.x = clamp(
        player.x + player.pushDirection * player.pushSpeed,
        PLAYER_MIN_X,
        PLAYER_MAX_X
    );

    updateParallax();
    renderer.render();
}, PUSH_STEP_INTERVAL);


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
    // player - they only fight the knockback, 1 speed at a time.
    if (player.pushSpeed > 0) {
        player.pushSpeed -= 1;
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

    if (event.key.toLowerCase() === "a") {
        hideShield();
    }
});
