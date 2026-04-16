// --- ANTIGRAVITY ENGINE JS TRANSPILATION ---
// GDD: Antigravity River Run

const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// Game State
let frameCount = 0;
let playing = false;
let score = 0;
let level = 1;
let distance = 0;
let baseScrollSpeed = 2;
let scrollSpeed = baseScrollSpeed;

// Input State
const keys = {
    ArrowLeft: false,
    ArrowRight: false,
    ArrowUp: false,
    ArrowDown: false,
    Space: false
};

document.addEventListener('keydown', (e) => {
    if (keys.hasOwnProperty(e.code) || e.code === 'Space') {
        if (e.code === 'Space') keys.Space = true;
        else keys[e.code] = true;
        e.preventDefault();
    }
});

document.addEventListener('keyup', (e) => {
    if (keys.hasOwnProperty(e.code) || e.code === 'Space') {
        if (e.code === 'Space') keys.Space = false;
        else keys[e.code] = false;
    }
});

// Audio System (Procedural Web Audio API for retro style)
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration) {
    if (audioCtx.state === 'suspended') audioCtx.resume();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    gain.gain.exponentialRampToValueAtTime(0.00001, audioCtx.currentTime + duration);
    osc.stop(audioCtx.currentTime + duration);
}
function playShootSound() { playTone(800, 'square', 0.1); }
function playExplosionSound() {
    // Noise gen
    const bufferSize = audioCtx.sampleRate * 0.3;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    const gain = audioCtx.createGain();
    gain.gain.setValueAtTime(1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.01, audioCtx.currentTime + 0.3);
    noise.connect(gain);
    gain.connect(audioCtx.destination);
    noise.start();
}
function playFuelSound() { playTone(400, 'sine', 0.1); }

// Utility: Box Collision
function AABB(rect1, rect2) {
    return (
        rect1.x < rect2.x + rect2.width &&
        rect1.x + rect1.width > rect2.x &&
        rect1.y < rect2.y + rect2.height &&
        rect1.y + rect1.height > rect2.y
    );
}

// --- CLASSES ---
class Player {
    constructor() {
        this.width = 42;
        this.height = 44;
        this.x = canvas.width / 2 - this.width / 2;
        this.y = canvas.height - 100;
        this.speedX = 5;
        this.fuel = 100;
        this.maxFuel = 100;
        this.fuelRaid = 0.05;
        this.shootCooldown = 0;
    }

    update() {
        // Movement
        if (keys.ArrowLeft) this.x -= this.speedX;
        if (keys.ArrowRight) this.x += this.speedX;

        // Speed control (vertical scroll)
        if (keys.ArrowUp) {
            scrollSpeed = baseScrollSpeed * 2;
            this.fuel -= this.fuelRaid * 1.5; // consumes more fuel when accelerating
        } else if (keys.ArrowDown) {
            scrollSpeed = baseScrollSpeed * 0.5;
            this.fuel -= this.fuelRaid * 0.5;
        } else {
            scrollSpeed = baseScrollSpeed;
            this.fuel -= this.fuelRaid;
        }

        // Shooting
        if (this.shootCooldown > 0) this.shootCooldown--;
        if (keys.Space && this.shootCooldown === 0) {
            bullets.push(new Bullet(this.x + this.width / 2 - 2, this.y));
            playShootSound();
            this.shootCooldown = 15;
        }

        // Fuel check
        if (this.fuel <= 0) gameOver();
    }

    draw(ctx) {
        const sprite = [
            "          B          ",
            "         BWB         ",
            "         BWB         ",
            "         BYB         ",
            "         BYB         ",
            "        BWYWB        ",
            "        BWWWB        ",
            "       BWWWWWB       ",
            "      BWWWWWWWB      ",
            "     BWWWWWWWWWB     ",
            "    BWWWWWWWWWWWB    ",
            "   BWWWWWWWWWWWWWB   ",
            "  BWWWWWWWWWWWWWWWB  ",
            " BWWWWWWWWWWWWWWWWWB ",
            "BWWWWWWWWWWWWWWWWWWWB",
            "BBBBBBBBWWWWWBBBBBBBB",
            "   BWWDBWWWWBDWWB    ",
            "   BWWDBWWWWBDWWB    ",
            "   BBBBBWWWWWBBBB    ",
            "       BWWWWWB       ",
            "       BBBEBBB       ",
            "         BBB         "
        ];
        const colors = {
            'B': '#111',
            'W': '#e8ebf0',
            'Y': '#f3c642',
            'D': '#5a6b82',
            'E': '#333'
        };
        const rows = sprite.length;
        const cols = sprite[0].length;
        const pixelW = this.width / cols;
        const pixelH = this.height / rows;

        for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
                const char = sprite[r][c];
                if (char !== ' ' && colors[char]) {
                    ctx.fillStyle = colors[char];
                    ctx.fillRect(this.x + c * pixelW, this.y + r * pixelH, pixelW + 0.5, pixelH + 0.5);
                }
            }
        }
    }
}

class Bullet {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.width = 4;
        this.height = 10;
        this.speed = 10;
        this.active = true;
    }
    update() {
        this.y -= this.speed;
        if (this.y < 0) this.active = false;
    }
    draw(ctx) {
        ctx.fillStyle = '#fff';
        ctx.fillRect(this.x, this.y, this.width, this.height);
    }
}

class Enemy {
    constructor(y, type) {
        this.width = 40;
        this.height = 30;
        this.x = canvas.width / 2;
        this.y = y;
        this.type = type; // 'ship', 'heli', 'jet'
        this.active = true;
        this.dirx = Math.random() > 0.5 ? 1 : -1;

        if (type === 'ship') {
            this.speedX = 1;
            this.color = '#ff3333';
        } else if (type === 'heli') {
            this.speedX = 2;
            this.color = '#ff9933';
            this.timer = Math.random() * 100;
        } else if (type === 'jet') {
            this.speedX = 4;
            this.color = '#cc33ff';
            this.width = 30; this.height = 20;
        }

        // Ensure starting within river visually (approximate)
        this.x = 150 + Math.random() * (canvas.width - 300);
    }

    update() {
        this.y += scrollSpeed;

        // Movement Logic
        if (this.type === 'ship') {
            this.x += this.speedX * this.dirx;
        } else if (this.type === 'heli') {
            this.timer++;
            if (this.timer > 60) {
                this.dirx *= -1;
                this.timer = 0;
            }
            this.x += this.speedX * this.dirx;
        } else if (this.type === 'jet') {
            this.x += this.speedX * this.dirx;
        }

        // Bouncing off generic boundaries
        if (this.x < 100) this.dirx = 1;
        if (this.x > canvas.width - 100 - this.width) this.dirx = -1;

        if (this.y > canvas.height) this.active = false;
    }

    draw(ctx) {
        ctx.fillStyle = this.color;
        ctx.fillRect(this.x, this.y, this.width, this.height);

        // details
        ctx.fillStyle = '#000';
        if (this.type === 'heli') {
            // rotor
            ctx.fillRect(this.x + this.width / 2 - ((frameCount % 10) / 10) * this.width, this.y - 5, ((frameCount % 10) / 10) * this.width * 2, 2);
        }
    }
}

class FuelTank {
    constructor(y, x) {
        this.width = 30;
        this.height = 40;
        this.x = x || canvas.width / 2 - 15;
        this.y = y;
        this.active = true;
    }
    update() {
        this.y += scrollSpeed;
        if (this.y > canvas.height) this.active = false;
    }
    draw(ctx) {
        ctx.fillStyle = '#eeeee0';
        ctx.fillRect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = '#ff0000';
        ctx.font = "10px Courier";
        ctx.fillText("FUEL", this.x + 2, this.y + 20);
    }
}

class Map {
    constructor() {
        this.segmentHeight = 20;
        this.segments = [];
        this.targetWidth = 300;
        this.currentLeft = 100;
        this.currentRight = 100;
        this.targetLeft = 100;

        // Fill initial screen
        for (let i = 0; i < canvas.height / this.segmentHeight + 2; i++) {
            this.addSegment(canvas.height - i * this.segmentHeight);
        }
    }

    addSegment(y) {
        // change targets occasionally
        if (Math.random() < 0.05) {
            // Difficult scales: narrower river in higher levels
            let minWidth = Math.max(100, 300 - (level * 15));
            this.targetWidth = minWidth + Math.random() * 200;
            let maxLeft = canvas.width - this.targetWidth;
            this.targetLeft = Math.random() * maxLeft;
        }

        // Lerp towards targets for smooth curves
        this.currentLeft += (this.targetLeft - this.currentLeft) * 0.1;
        let rightSize = canvas.width - this.currentLeft - this.targetWidth;
        this.currentRight += (rightSize - this.currentRight) * 0.1;

        this.segments.unshift({
            y: y,
            left: this.currentLeft,
            right: this.currentRight,
            riverWidth: canvas.width - this.currentLeft - this.currentRight
        });

        // Spawn chance for entities
        if (distance > 100 && Math.random() < 0.02 + (level * 0.005)) {
            // Ensure enemy is spawned over water
            let eX = this.currentLeft + 20 + Math.random() * (canvas.width - this.currentLeft - this.currentRight - 60);

            // Type decision
            let type = 'ship';
            if (level >= 3 && Math.random() < 0.3) type = 'heli';
            if (level >= 6 && Math.random() < 0.2) type = 'jet';

            let e = new Enemy(y, type);
            e.x = eX;
            enemies.push(e);
        }

        if (distance > 50 && Math.random() < 0.015) {
            let fX = this.currentLeft + 20 + Math.random() * (canvas.width - this.currentLeft - this.currentRight - 60);
            fuelTanks.push(new FuelTank(y, fX));
        }
    }

    update() {
        // Move segments down
        for (let seg of this.segments) {
            seg.y += scrollSpeed;
        }
        // Remove bottom segments and add to top
        while (this.segments[this.segments.length - 1].y > canvas.height) {
            this.segments.pop();
            let topY = this.segments[0].y;
            this.addSegment(topY - this.segmentHeight);
            distance += 1;

            // Level progress
            if (distance % 500 === 0) {
                level++;
                updateHUD();
            }
        }
    }

    draw(ctx) {
        ctx.fillStyle = '#228B22'; // Grass green

        for (let i = 0; i < this.segments.length - 1; i++) {
            let seg = this.segments[i];
            let nextSeg = this.segments[i + 1];

            // Draw left bank quad
            ctx.beginPath();
            ctx.moveTo(0, seg.y);
            ctx.lineTo(seg.left, seg.y);
            ctx.lineTo(nextSeg.left, nextSeg.y);
            ctx.lineTo(0, nextSeg.y);
            ctx.fill();

            // Draw right bank quad
            ctx.beginPath();
            ctx.moveTo(canvas.width, seg.y);
            ctx.lineTo(canvas.width - seg.right, seg.y);
            ctx.lineTo(canvas.width - nextSeg.right, nextSeg.y);
            ctx.lineTo(canvas.width, nextSeg.y);
            ctx.fill();
        }
    }

    // Check boundary collision for player rect
    checkCollision(rect) {
        // find segment matching rect Y
        for (let seg of this.segments) {
            if (rect.y >= seg.y && rect.y <= seg.y + this.segmentHeight) {
                if (rect.x < seg.left) return true; // left bank
                if (rect.x + rect.width > canvas.width - seg.right) return true; // right bank
            }
        }
        return false;
    }
}

// --- GLOBAL VARIABLES ---
let player;
let gameMap;
let bullets = [];
let enemies = [];
let fuelTanks = [];
let animationId;

// --- GAME LOOP ---
function init() {
    player = new Player();
    gameMap = new Map();
    bullets = [];
    enemies = [];
    fuelTanks = [];
    score = 0;
    level = 1;
    distance = 0;
    frameCount = 0;
    playing = true;
    updateHUD();
    document.getElementById('game-over').style.display = 'none';
    requestAnimationFrame(loop);
}

function startGame() {
    audioCtx.resume();
    document.getElementById('start-screen').style.display = 'none';
    init();
}

function gameOver() {
    playing = false;
    playExplosionSound();
    cancelAnimationFrame(animationId);
    document.getElementById('final-score').innerText = Math.floor(score);
    document.getElementById('game-over').style.display = 'flex';
}

function showStartScreen() {
    document.getElementById('game-over').style.display = 'none';
    document.getElementById('start-screen').style.display = 'flex';
    ctx.fillStyle = '#0000a0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function updateHUD() {
    document.getElementById('score-display').innerText = Math.floor(score);
    document.getElementById('level-display').innerText = level;

    // Update Fuel Bar colors
    const fBar = document.getElementById('fuel-bar');
    fBar.style.width = Math.max(0, (player.fuel / player.maxFuel) * 100) + '%';
    if (player.fuel > 50) fBar.style.backgroundColor = '#00ff00';
    else if (player.fuel > 20) fBar.style.backgroundColor = '#ffff00';
    else fBar.style.backgroundColor = '#ff0000';
}

function loop() {
    if (!playing) return;
    frameCount++;

    // --- UPDATE ---
    player.update();
    gameMap.update();
    score += scrollSpeed * 0.05; // Base score for moving

    bullets.forEach(b => b.update());
    bullets = bullets.filter(b => b.active);

    enemies.forEach(e => e.update());
    enemies = enemies.filter(e => e.active);

    fuelTanks.forEach(f => f.update());
    fuelTanks = fuelTanks.filter(f => f.active);

    // Collisions
    // Map bounds
    if (gameMap.checkCollision(player)) {
        gameOver();
        return;
    }

    // Fuel Collection
    for (let f of fuelTanks) {
        if (AABB(player, f)) {
            player.fuel = Math.min(player.maxFuel, player.fuel + 1); // continuous refuel
            if (frameCount % 10 === 0) playFuelSound();
        }
    }

    // Bullets vs Enemies / Fuel
    for (let b of bullets) {
        // Enemeis
        for (let e of enemies) {
            if (e.active && b.active && AABB(b, e)) {
                e.active = false;
                b.active = false;
                score += (e.type === 'jet' ? 100 : e.type === 'heli' ? 60 : 30);
                playExplosionSound();
            }
        }
        // Fuel destruction
        for (let f of fuelTanks) {
            if (f.active && b.active && AABB(b, f)) {
                f.active = false;
                b.active = false;
                score += 80;
                playExplosionSound();
            }
        }
        // Terrain collision for bullets
        if (b.active && gameMap.checkCollision(b)) {
            b.active = false;
        }
    }

    // Player vs Enemies
    for (let e of enemies) {
        if (AABB(player, e)) {
            gameOver();
            return;
        }
    }

    updateHUD();

    // --- DRAW ---
    ctx.clearRect(0, 0, canvas.width, canvas.height); // clear to blue

    gameMap.draw(ctx);
    fuelTanks.forEach(f => f.draw(ctx));
    enemies.forEach(e => e.draw(ctx));
    bullets.forEach(b => b.draw(ctx));
    player.draw(ctx);

    animationId = requestAnimationFrame(loop);
}

// Draw initial state before start
window.onload = () => {
    ctx.fillStyle = '#0000a0';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
};
