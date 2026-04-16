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
        this.y = canvas.height - 160;
        this.speedX = 5;
        this.fuel = 100;
        this.maxFuel = 100;
        this.fuelRaid = 0.025;
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
            this.width = 66;
            this.height = 36;
            this.speedX = 1;
            this.color = '#ff3333';
        } else if (type === 'heli') {
            this.width = 52;
            this.height = 22;
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

        // Bouncing off terrain properly
        let leftLimit = 100;
        let rightLimit = canvas.width - 100;
        let islandActive = false;
        let islandCenter = 0;
        let islandW = 0;

        if (typeof gameMap !== 'undefined' && gameMap.segments.length > 0) {
            // Find segment that matches enemy Y (approximate)
            let currentSeg = gameMap.segments.find(s => this.y >= s.y && this.y <= s.y + 20) || gameMap.segments[gameMap.segments.length - 1];
            leftLimit = currentSeg.left;
            rightLimit = canvas.width - currentSeg.right;
            if (currentSeg.islandW > 0) {
                islandActive = true;
                islandCenter = currentSeg.islandCenter;
                islandW = currentSeg.islandW;
            }
        }

        if (this.x < leftLimit) {
            this.x = leftLimit;
            this.dirx = 1;
        }
        if (this.x + this.width > rightLimit) {
            this.x = rightLimit - this.width;
            this.dirx = -1;
        }

        // Bounce off islands
        if (islandActive) {
            let islandLeftEdge = islandCenter - islandW / 2;
            let islandRightEdge = islandCenter + islandW / 2;
            if (this.x + this.width > islandLeftEdge && this.x < islandCenter) {
                this.x = islandLeftEdge - this.width;
                this.dirx = -1;
            } else if (this.x < islandRightEdge && this.x + this.width >= islandCenter) {
                this.x = islandRightEdge;
                this.dirx = 1;
            }
        }

        if (this.y > canvas.height) this.active = false;
    }

    draw(ctx) {
        let sprite = [];
        let colors = {};

        if (this.type === 'heli') {
            const rotor = frameCount % 10 < 5 ? "RRRRRRRRRRRRR" : "  RRR RRR RRR";
            sprite = [
                "      " + rotor + "       ",
                "               D      ",
                "  D           LDD     ",
                " LLD       LLLLLDDD   ",
                " LLLL   LLLLLLLLDDDD  ",
                " LLLLLLLLLLLLLLDDDDD  ",
                " LLDLLLLLLLLLLLDDDDD  ",
                "         LLLLLLLLDD   ",
                "         LLLLLLLL     ",
                "         D      D     ",
                "      DDDDDDDDDDDDDD  "
            ];
            // If moving right, flip sprite
            if (this.dirx === 1) {
                sprite = sprite.map(row => row.split('').reverse().join(''));
            }
            colors = { 'L': '#5b7b42', 'D': '#222', 'R': '#555' };
        } else if (this.type === 'ship') {
            sprite = [
                "           DD         ",
                "           YY         ",
                "          DYYD        ",
                "     W    WWWW  WW    ",
                "   WWWW  DWWWWD WW    ",
                "  WWWWWW DWWWWD WW    ",
                " WWWWWWWWWWWWWWWWWWWW ",
                " WWBBWWBBWWBBWWWWWWWW ",
                " DDDDDDDDDDDDDDDDDDDD ",
                "DDBBDBBDBBDBBDBBDBBDDD",
                "DDDDDDDDDDDDDDDDDDDDDD",
                " RRRRRRRRRRRRRRRRRRRR "
            ];
            // If moving right, flip sprite
            if (this.dirx === 1) {
                sprite = sprite.map(row => row.split('').reverse().join(''));
            }
            colors = { 'D': '#2b2d42', 'Y': '#f3c642', 'W': '#e8ebf0', 'B': '#3a86ff', 'R': '#d90429' };
        } else {
            // Fallback Jet
            ctx.fillStyle = this.color;
            ctx.fillRect(this.x, this.y, this.width, this.height);
            return;
        }

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

        this.islandActive = false;
        this.islandTimer = 0;
        this.currentIslandCenter = 0;
        this.currentIslandW = 0;
        this.targetIslandW = 0;

        // Fill initial screen
        for (let i = 0; i < canvas.height / this.segmentHeight + 2; i++) {
            this.addSegment(canvas.height - i * this.segmentHeight);
        }
    }

    addSegment(y) {
        // change targets occasionally
        // Do not change limits if island is active, to prevent dead ends
        if (!this.islandActive && Math.random() < 0.05) {
            let minWidth = Math.max(100, 300 - (level * 15));
            let newWidth = minWidth + Math.random() * 200;
            let maxLeft = canvas.width - newWidth;
            let newLeft = Math.random() * maxLeft;

            // To prevent impossible jumps, move left/width by maximum 40px steps
            this.targetLeft = this.currentLeft + Math.max(-40, Math.min(40, newLeft - this.currentLeft));
            this.targetWidth = this.targetWidth + Math.max(-40, Math.min(40, newWidth - this.targetWidth));

            // Re-bound
            if (this.targetLeft < 0) this.targetLeft = 0;
            if (this.targetLeft + this.targetWidth > canvas.width) this.targetLeft = canvas.width - this.targetWidth;

            // Snap directly to targets instead of smooth curves to make rigid, straight terrain layout
            this.currentLeft = this.targetLeft;
        }
        let rightSize = canvas.width - this.currentLeft - this.targetWidth;
        this.currentRight = rightSize;

        // Island logic
        if (!this.islandActive && Math.random() < 0.015 && this.targetWidth > 200) {
            this.islandActive = true;
            this.islandTimer = 40 + Math.random() * 60; // duration in segments
            this.currentIslandCenter = this.currentLeft + this.targetWidth / 2;
            this.targetIslandW = this.targetWidth * 0.35; // island takes 35% of river
        }

        if (this.islandActive) {
            this.islandTimer--;
            if (this.islandTimer <= 0) {
                this.islandActive = false;
                this.targetIslandW = 0;
            }
        }

        this.currentIslandW = this.targetIslandW;

        this.segments.unshift({
            y: y,
            left: Math.round(this.currentLeft / 20) * 20,
            right: Math.round(this.currentRight / 20) * 20,
            islandCenter: Math.round(this.currentIslandCenter / 20) * 20,
            islandW: Math.round(this.currentIslandW / 20) * 20,
            riverWidth: canvas.width - this.currentLeft - this.currentRight
        });

        // Spawn chance for entities
        if (distance > 30 && Math.random() < 0.045 + (level * 0.008)) {
            let eX = this.currentLeft + 20 + Math.random() * (canvas.width - this.currentLeft - this.currentRight - 60);

            if (this.currentIslandW > 20) {
                let leftChannel = (this.currentIslandCenter - this.currentIslandW / 2) - this.currentLeft;
                let rightChannel = (canvas.width - this.currentRight) - (this.currentIslandCenter + this.currentIslandW / 2);

                if (Math.random() > 0.5 && leftChannel > 50) {
                    eX = this.currentLeft + 10 + Math.random() * (leftChannel - 40);
                } else if (rightChannel > 50) {
                    eX = (this.currentIslandCenter + this.currentIslandW / 2) + 10 + Math.random() * (rightChannel - 40);
                }
            }

            // Type decision
            let type = 'ship';
            if (level >= 3 && Math.random() < 0.3) type = 'heli';
            if (level >= 6 && Math.random() < 0.2) type = 'jet';

            let e = new Enemy(y, type);
            e.x = eX;
            enemies.push(e);
        }

        // Increase fuel tank spawn rate
        if (distance > 50 && Math.random() < 0.025) {
            let fX = this.currentLeft + 20 + Math.random() * (canvas.width - this.currentLeft - this.currentRight - 60);

            if (this.currentIslandW > 20) {
                let leftChannel = (this.currentIslandCenter - this.currentIslandW / 2) - this.currentLeft;
                let rightChannel = (canvas.width - this.currentRight) - (this.currentIslandCenter + this.currentIslandW / 2);
                if (Math.random() > 0.5 && leftChannel > 40) {
                    fX = this.currentLeft + 5 + Math.random() * (leftChannel - 35);
                } else if (rightChannel > 40) {
                    fX = (this.currentIslandCenter + this.currentIslandW / 2) + 5 + Math.random() * (rightChannel - 35);
                }
            }
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

            let h = nextSeg.y - seg.y;

            // Draw left and right bank blocks
            ctx.fillRect(0, seg.y, seg.left, h + 1);
            ctx.fillRect(canvas.width - seg.right, seg.y, seg.right, h + 1);

            // Draw Island block
            if (seg.islandW > 0) {
                ctx.fillRect(seg.islandCenter - seg.islandW / 2, seg.y, seg.islandW, h + 1);
            }
        }
    }

    // Check boundary collision for player rect
    checkCollision(rect) {
        // find segment matching rect Y
        for (let seg of this.segments) {
            if (rect.y >= seg.y && rect.y <= seg.y + this.segmentHeight) {
                if (rect.x < seg.left) return true; // left bank
                if (rect.x + rect.width > canvas.width - seg.right) return true; // right bank
                // island
                if (seg.islandW > 0) {
                    if (rect.x + rect.width > seg.islandCenter - seg.islandW / 2 &&
                        rect.x < seg.islandCenter + seg.islandW / 2) {
                        return true;
                    }
                }
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

    // Update Fuel Needle
    const fNeedle = document.getElementById('fuel-needle');
    const fuelPercent = player.fuel / player.maxFuel;
    const leftPos = 10 + (fuelPercent * 80);
    fNeedle.style.left = Math.max(10, Math.min(90, leftPos)) + '%';
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
