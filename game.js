// ==================== GAME STATE & CONFIGURATION ====================
const gameState = {
  score: 0,
  lives: 3,
  level: 1,
  highScore: localStorage.getItem("highScore") || 0,
  isPlaying: false,
  isPaused: false,
  animationId: null,
  currentInput: "",
  activeWord: null,
};

const config = {
  canvas: {
    width: 800,
    height: 600,
  },
  word: {
    minSpeed: 0.5,
    maxSpeed: 2,
    spawnRate: 2000, // milliseconds
    fontSize: 24,
  },
};

// Word bank for the game
const wordBank = [
  // Easy words (3-4 letters)
  "code",
  "type",
  "game",
  "play",
  "word",
  "fast",
  "jump",
  "run",
  "star",
  "moon",
  "fire",
  "wind",
  "rain",
  "snow",
  "tree",
  "rock",
  // Medium words (5-6 letters)
  "keyboard",
  "typing",
  "letter",
  "winner",
  "player",
  "attack",
  "defend",
  "rocket",
  "planet",
  "galaxy",
  "comet",
  "meteor",
  "cosmic",
  "stellar",
  // Hard words (7+ letters)
  "javascript",
  "programming",
  "developer",
  "computer",
  "challenge",
  "adventure",
  "universe",
  "asteroid",
  "nebula",
  "supernova",
  "quantum",
];

// ==================== GAME OBJECTS ====================
let canvas, ctx;
let words = [];
let particles = [];
let lastWordSpawn = 0;

// ==================== SCREEN MANAGEMENT ====================
function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });
  document.getElementById(screenId).classList.add("active");
}

// ==================== INITIALIZATION ====================
function init() {
  // Get canvas and context
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");

  // Set canvas size
  canvas.width = config.canvas.width;
  canvas.height = config.canvas.height;

  // Display high score
  document.getElementById("high-score-display").textContent =
    gameState.highScore;

  // Event listeners
  setupEventListeners();
}

function setupEventListeners() {
  // Button clicks
  document.getElementById("start-btn").addEventListener("click", startGame);
  document
    .getElementById("instructions-btn")
    .addEventListener("click", () => showScreen("instructions-screen"));
  document
    .getElementById("back-btn")
    .addEventListener("click", () => showScreen("start-screen"));
  document.getElementById("restart-btn").addEventListener("click", startGame);
  document.getElementById("menu-btn").addEventListener("click", () => {
    showScreen("start-screen");
    resetGame();
  });

  // Keyboard input for typing
  document.addEventListener("keydown", handleTyping);
}

// ==================== TYPING HANDLER ====================
function handleTyping(e) {
  if (!gameState.isPlaying) return;

  // Ignore special keys
  if (e.key.length > 1 && e.key !== "Backspace") return;

  e.preventDefault();

  if (e.key === "Backspace") {
    gameState.currentInput = gameState.currentInput.slice(0, -1);
    gameState.activeWord = null;
  } else {
    const char = e.key.toLowerCase();
    gameState.currentInput += char;

    // Check if input matches any word
    checkWordMatch();
  }

  updateTypingDisplay();
}

function checkWordMatch() {
  const input = gameState.currentInput.toLowerCase();

  // First, check if we're continuing to type the active word
  if (gameState.activeWord) {
    if (gameState.activeWord.text.startsWith(input)) {
      gameState.activeWord.typedLength = input.length;

      // Check if word is complete
      if (input === gameState.activeWord.text) {
        destroyWord(gameState.activeWord);
        gameState.currentInput = "";
        gameState.activeWord = null;
      }
      return;
    } else {
      // Wrong letter, reset
      gameState.activeWord.typedLength = 0;
      gameState.activeWord = null;
    }
  }

  // Find a word that starts with current input
  for (let word of words) {
    if (word.text.startsWith(input)) {
      gameState.activeWord = word;
      word.typedLength = input.length;

      // Check if word is complete
      if (input === word.text) {
        destroyWord(word);
        gameState.currentInput = "";
        gameState.activeWord = null;
      }
      return;
    }
  }

  // No match found, input is wrong
  if (input.length > 0) {
    // Visual feedback for wrong input
    flashTypingDisplay("error");
  }
}

function updateTypingDisplay() {
  const display = document.getElementById("typed-text");
  display.textContent = gameState.currentInput.toUpperCase();

  // Color based on match
  if (gameState.activeWord) {
    display.style.color = "#10b981"; // Green for correct
  } else if (gameState.currentInput.length > 0) {
    display.style.color = "#ef4444"; // Red for wrong
  } else {
    display.style.color = "#06b6d4"; // Default cyan
  }
}

function flashTypingDisplay(type) {
  const container = document.querySelector(".typing-input-display");
  if (type === "error") {
    container.style.borderColor = "#ef4444";
    setTimeout(() => {
      container.style.borderColor = "";
    }, 200);
  }
}

// ==================== GAME LOOP ====================
function startGame() {
  resetGame();
  gameState.isPlaying = true;
  showScreen("game-screen");
  updateHUD();

  // Focus on game for keyboard input
  canvas.focus();

  gameLoop();
}

function resetGame() {
  gameState.score = 0;
  gameState.lives = 3;
  gameState.level = 1;
  gameState.isPlaying = false;
  gameState.currentInput = "";
  gameState.activeWord = null;

  words = [];
  particles = [];

  lastWordSpawn = 0;

  updateTypingDisplay();

  if (gameState.animationId) {
    cancelAnimationFrame(gameState.animationId);
  }
}

function gameLoop(timestamp = 0) {
  if (!gameState.isPlaying) return;

  // Clear canvas
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Update game objects
  updateWords(timestamp);
  updateParticles();

  // Draw everything
  drawWords();
  drawParticles();

  // Continue loop
  gameState.animationId = requestAnimationFrame(gameLoop);
}

// ==================== WORDS ====================
function updateWords(timestamp) {
  // Spawn new words
  const spawnRate = Math.max(
    1000,
    config.word.spawnRate - gameState.level * 100,
  );
  if (timestamp - lastWordSpawn > spawnRate) {
    spawnWord();
    lastWordSpawn = timestamp;
  }

  // Update word positions
  words = words.filter((word) => {
    word.y += word.speed;

    // Check if word reached bottom
    if (word.y > canvas.height) {
      loseLife();
      return false;
    }

    return true;
  });
}

function spawnWord() {
  // Select random word based on level
  let availableWords;
  if (gameState.level <= 2) {
    availableWords = wordBank.filter((w) => w.length <= 4);
  } else if (gameState.level <= 5) {
    availableWords = wordBank.filter((w) => w.length <= 6);
  } else {
    availableWords = wordBank;
  }

  const text =
    availableWords[Math.floor(Math.random() * availableWords.length)];
  const speed = config.word.minSpeed + gameState.level * 0.1;

  // Measure text width for positioning
  ctx.font = `${config.word.fontSize}px 'Orbitron', sans-serif`;
  const textWidth = ctx.measureText(text).width;

  words.push({
    text: text,
    x: Math.random() * (canvas.width - textWidth - 40) + 20,
    y: -30,
    speed: Math.min(speed, config.word.maxSpeed),
    typedLength: 0,
    color: `hsl(${Math.random() * 360}, 70%, 60%)`,
  });
}

function drawWords() {
  ctx.font = `bold ${config.word.fontSize}px 'Orbitron', sans-serif`;

  words.forEach((word) => {
    // Draw shadow for depth
    ctx.shadowBlur = 15;
    ctx.shadowColor = word.color;

    // Draw each character
    let xOffset = 0;
    for (let i = 0; i < word.text.length; i++) {
      const char = word.text[i];

      // Color based on typing progress
      if (i < word.typedLength) {
        ctx.fillStyle = "#10b981"; // Green for typed
      } else if (word === gameState.activeWord && i === word.typedLength) {
        ctx.fillStyle = "#fbbf24"; // Yellow for next letter
      } else {
        ctx.fillStyle = word.color; // Original color
      }

      ctx.fillText(char, word.x + xOffset, word.y);
      xOffset += ctx.measureText(char).width;
    }

    ctx.shadowBlur = 0;
  });
}

function destroyWord(word) {
  // Create explosion effect
  createParticles(
    word.x + ctx.measureText(word.text).width / 2,
    word.y,
    word.color,
    30,
  );

  // Remove word
  const index = words.indexOf(word);
  if (index > -1) {
    words.splice(index, 1);
  }

  // Add score based on word length
  const points = word.text.length * 5;
  addScore(points);
}

// ==================== PARTICLES ====================
function createParticles(x, y, color, count = 10) {
  for (let i = 0; i < count; i++) {
    particles.push({
      x: x,
      y: y,
      vx: (Math.random() - 0.5) * 6,
      vy: (Math.random() - 0.5) * 6,
      life: 1,
      color: color,
      size: Math.random() * 4 + 2,
    });
  }
}

function updateParticles() {
  particles = particles.filter((particle) => {
    particle.x += particle.vx;
    particle.y += particle.vy;
    particle.life -= 0.02;
    return particle.life > 0;
  });
}

function drawParticles() {
  particles.forEach((particle) => {
    ctx.globalAlpha = particle.life;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
    ctx.fill();
    ctx.globalAlpha = 1;
  });
}

// ==================== GAME LOGIC ====================
function addScore(points) {
  gameState.score += points;
  updateHUD();

  // Level up every 150 points
  const newLevel = Math.floor(gameState.score / 150) + 1;
  if (newLevel > gameState.level) {
    gameState.level = newLevel;
    updateHUD();

    // Visual feedback for level up
    createParticles(canvas.width / 2, canvas.height / 2, "#a855f7", 50);
  }
}

function loseLife() {
  gameState.lives--;
  updateHUD();

  if (gameState.lives <= 0) {
    gameOver();
  } else {
    // Visual feedback
    createParticles(canvas.width / 2, canvas.height - 50, "#ef4444", 30);
  }
}

function updateHUD() {
  document.getElementById("score").textContent = gameState.score;
  document.getElementById("level").textContent = gameState.level;

  // Update lives display
  const hearts = "❤️".repeat(gameState.lives);
  document.getElementById("lives").textContent = hearts || "💀";
}

function gameOver() {
  gameState.isPlaying = false;

  // Update high score
  if (gameState.score > gameState.highScore) {
    gameState.highScore = gameState.score;
    localStorage.setItem("highScore", gameState.highScore);
    document.getElementById("new-record-container").style.display = "block";
  } else {
    document.getElementById("new-record-container").style.display = "none";
  }

  // Display final stats
  document.getElementById("final-score").textContent = gameState.score;
  document.getElementById("final-level").textContent = gameState.level;

  // Show game over screen
  showScreen("gameover-screen");
}

// ==================== START THE GAME ====================
window.addEventListener("load", init);
