// ==================== CINEMATIC AUDIO SYSTEM ====================
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

// 1. Create a "Noise Buffer" for realistic explosions (Static)
const bufferSize = audioCtx.sampleRate * 2; // 2 seconds of noise
const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
const data = noiseBuffer.getChannelData(0);
for (let i = 0; i < bufferSize; i++) {
  data[i] = Math.random() * 2 - 1;
}

const sounds = {
  // High-tech holographic click
  type: () => {
    if (gameState.isMuted) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = "sine";
    // Start high, drop slightly (tech chirp)
    osc.frequency.setValueAtTime(1200, audioCtx.currentTime); 
    osc.frequency.exponentialRampToValueAtTime(800, audioCtx.currentTime + 0.05);
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.05);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.05);
  },

  // Soft digital error thud
  error: () => {
    if (gameState.isMuted) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = "triangle";
    osc.frequency.setValueAtTime(150, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(50, audioCtx.currentTime + 0.2);
    
    gain.gain.setValueAtTime(0.2, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.2);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.2);
  },

  // Realistic Explosion (White Noise + Lowpass Filter)
  explode: () => {
    if (gameState.isMuted) return;
    const noise = audioCtx.createBufferSource();
    const noiseGain = audioCtx.createGain();
    const filter = audioCtx.createBiquadFilter();

    noise.buffer = noiseBuffer;
    filter.type = "lowpass";
    filter.frequency.value = 1000; // Muffle the harsh static

    noiseGain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    noiseGain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 0.3);

    noise.connect(filter);
    filter.connect(noiseGain);
    noiseGain.connect(audioCtx.destination);
    noise.start();
  },

  // Ethereal Powerup Shimmer
  powerup: () => {
    if (gameState.isMuted) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    
    osc.type = "sine";
    osc.frequency.setValueAtTime(400, audioCtx.currentTime);
    osc.frequency.linearRampToValueAtTime(1200, audioCtx.currentTime + 0.3);
    
    gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.3);
    
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.3);
  },

  // Deep Game Over Drone
  gameOver: () => {
    if (gameState.isMuted) return;
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(100, audioCtx.currentTime);
    osc.frequency.exponentialRampToValueAtTime(10, audioCtx.currentTime + 1.5);
    gain.gain.setValueAtTime(0.3, audioCtx.currentTime);
    gain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5);
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 1.5);
  }
};

// ==================== ATMOSPHERE GENERATOR (The "Professional" Sound) ====================
const atmosphereSystem = {
  nodes: [],
  isPlaying: false,

  start() {
    if (this.isPlaying || gameState.isMuted) return;
    if (audioCtx.state === "suspended") audioCtx.resume();
    this.isPlaying = true;

    const now = audioCtx.currentTime;
    const masterGain = audioCtx.createGain();
    masterGain.gain.setValueAtTime(0, now);
    masterGain.gain.linearRampToValueAtTime(0.15, now + 4); // Slow fade in

    // Frequencies for a dark space chord (A2 + E3 + A3)
    const freqs = [55, 82.4, 110]; 

    freqs.forEach((f, i) => {
      const osc = audioCtx.createOscillator();
      const oscGain = audioCtx.createGain();
      
      osc.type = "triangle"; 
      osc.frequency.value = f;
      // Slight detune makes it sound "wide" and "spacey"
      osc.detune.value = Math.random() * 10 - 5; 

      // LFO makes the sound "breathe" instead of just buzzing
      const lfo = audioCtx.createOscillator();
      lfo.type = "sine";
      lfo.frequency.value = 0.1 + (i * 0.05);
      const lfoGain = audioCtx.createGain();
      lfoGain.gain.value = 0.05; 

      lfo.connect(lfoGain);
      lfoGain.connect(oscGain.gain);
      
      osc.connect(oscGain);
      oscGain.connect(masterGain);
      
      osc.start(now);
      lfo.start(now);
      
      this.nodes.push(osc, oscGain, lfo, lfoGain);
    });

    masterGain.connect(audioCtx.destination);
    this.nodes.push(masterGain);
  },

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    
    this.nodes.forEach(node => {
      try { node.stop(); } catch(e){}
      try { node.disconnect(); } catch(e){}
    });
    this.nodes = [];
  },

  toggle() {
    gameState.isMuted = !gameState.isMuted;
    const btn = document.getElementById("mute-btn");
    if (btn) {
      btn.textContent = gameState.isMuted ? "🔇" : "🔊";
      btn.classList.toggle("muted");
    }

    if (gameState.isMuted) {
      this.stop();
    } else if (gameState.isPlaying && !gameState.isPaused) {
      this.start();
    }
  }
};

// ==================== GAME STATE ====================
const gameState = {
  score: 0,
  lives: 3,
  level: 1,
  highScore: localStorage.getItem("highScore") || 0,
  isPlaying: false,
  isPaused: false,
  isMuted: false,
  animationId: null,
  currentInput: "",
  activeWord: null,
  isFrozen: false,
  freezeTimer: null,
};

const config = {
  canvas: { width: 800, height: 600 },
  word: {
    minSpeed: 0.5,
    maxSpeed: 2,
    spawnRate: 2000,
    fontSize: 24,
  },
};

const wordBank = [
  "code", "type", "game", "play", "word", "fast", "jump", "run", "star",
  "moon", "fire", "wind", "rain", "snow", "tree", "rock", "keyboard",
  "typing", "letter", "winner", "player", "attack", "defend", "rocket",
  "planet", "galaxy", "comet", "meteor", "cosmic", "stellar", "javascript",
  "programming", "developer", "computer", "challenge", "adventure",
  "universe", "asteroid", "nebula", "supernova", "quantum",
];

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

function init() {
  canvas = document.getElementById("game-canvas");
  ctx = canvas.getContext("2d");
  canvas.width = config.canvas.width;
  canvas.height = config.canvas.height;

  document.getElementById("high-score-display").textContent =
    gameState.highScore;
  setupEventListeners();
}

function setupEventListeners() {
  document.getElementById("start-btn").addEventListener("click", () => {
    if (audioCtx.state === "suspended") audioCtx.resume();
    startGame();
  });

  // Pause Button
  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      togglePause();
      pauseBtn.blur();
    });
  }

  // Resume Button
  const resumeBtn = document.getElementById("resume-btn");
  if (resumeBtn) resumeBtn.addEventListener("click", togglePause);

  // Quit Button
  const quitBtn = document.getElementById("quit-btn");
  if (quitBtn) {
    quitBtn.addEventListener("click", () => {
      togglePause(); // Unpause to clean up state
      showScreen("start-screen");
      atmosphereSystem.stop();
      resetGame();
    });
  }

  // Mute Button
  const muteBtn = document.getElementById("mute-btn");
  if (muteBtn) muteBtn.addEventListener("click", () => atmosphereSystem.toggle());

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

  // Handle Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gameState.isPlaying) {
      togglePause();
    }
    handleTyping(e);
  });
}

// ==================== GAME LOGIC ====================
function togglePause() {
  if (!gameState.isPlaying) return;

  gameState.isPaused = !gameState.isPaused;

  if (gameState.isPaused) {
    // Pausing
    cancelAnimationFrame(gameState.animationId);
    audioCtx.suspend(); // Instantly pauses the atmosphere
    document.getElementById("pause-screen").classList.add("active");
  } else {
    // Resuming
    audioCtx.resume();
    document.getElementById("pause-screen").classList.remove("active");
    lastWordSpawn = performance.now(); // Reset spawn timer
    gameLoop();
    canvas.focus();
  }
}

function handleTyping(e) {
  if (!gameState.isPlaying || gameState.isPaused) return; 
  if (e.key.length > 1 && e.key !== "Backspace") return;
  e.preventDefault();

  if (e.key === "Backspace") {
    gameState.currentInput = gameState.currentInput.slice(0, -1);
    gameState.activeWord = null;
  } else {
    const char = e.key.toLowerCase();
    gameState.currentInput += char;
    checkWordMatch();
  }
  updateTypingDisplay();
}

function checkWordMatch() {
  const input = gameState.currentInput.toLowerCase();
  let matchFound = false;
  let wordCompleted = false;

  if (gameState.activeWord) {
    if (gameState.activeWord.text.startsWith(input)) {
      gameState.activeWord.typedLength = input.length;
      matchFound = true;
      if (input === gameState.activeWord.text) {
        destroyWord(gameState.activeWord);
        gameState.currentInput = "";
        gameState.activeWord = null;
        wordCompleted = true;
      }
    } else {
      gameState.activeWord.typedLength = 0;
      gameState.activeWord = null;
    }
  }

  if (!matchFound) {
    for (let word of words) {
      if (word.text.startsWith(input)) {
        gameState.activeWord = word;
        word.typedLength = input.length;
        matchFound = true;
        if (input === word.text) {
          destroyWord(word);
          gameState.currentInput = "";
          gameState.activeWord = null;
          wordCompleted = true;
        }
        break;
      }
    }
  }

  if (!wordCompleted && matchFound) {
    sounds.type();
  } else if (!matchFound && input.length > 0) {
    sounds.error();
    flashTypingDisplay("error");
  }
}

function updateTypingDisplay() {
  const display = document.getElementById("typed-text");
  display.textContent = gameState.currentInput.toUpperCase();

  if (gameState.activeWord) {
    display.style.color = "#10b981";
  } else if (gameState.currentInput.length > 0) {
    display.style.color = "#ef4444";
  } else {
    display.style.color = "#06b6d4";
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

function startGame() {
  resetGame();
  gameState.isPlaying = true;
  showScreen("game-screen");
  updateHUD();
  canvas.focus();

  if (!gameState.isMuted) {
    atmosphereSystem.start();
  }

  gameLoop();
}

function resetGame() {
  gameState.score = 0;
  gameState.lives = 3;
  gameState.level = 1;
  gameState.isPlaying = false;
  gameState.isPaused = false;
  gameState.currentInput = "";
  gameState.activeWord = null;
  gameState.isFrozen = false;
  clearTimeout(gameState.freezeTimer);
  document.getElementById("game-canvas").style.borderColor = "";
  document.getElementById("game-canvas").style.boxShadow = "";
  document.getElementById("pause-screen").classList.remove("active");

  words = [];
  particles = [];
  lastWordSpawn = 0;

  atmosphereSystem.stop();

  updateTypingDisplay();
  if (gameState.animationId) cancelAnimationFrame(gameState.animationId);
}

function gameLoop(timestamp = 0) {
  if (!gameState.isPlaying || gameState.isPaused) return;

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateWords(timestamp);
  updateParticles();
  drawWords();
  drawParticles();

  gameState.animationId = requestAnimationFrame(gameLoop);
}

function updateWords(timestamp) {
  const spawnRate = Math.max(
    1000,
    config.word.spawnRate - gameState.level * 100
  );

  if (timestamp - lastWordSpawn > spawnRate && !gameState.isFrozen) {
    spawnWord();
    lastWordSpawn = timestamp;
  }

  words = words.filter((word) => {
    if (!gameState.isFrozen) {
      word.y += word.speed;
    }
    if (word.y > canvas.height) {
      loseLife();
      return false;
    }
    return true;
  });
}

function spawnWord() {
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

  ctx.font = `${config.word.fontSize}px 'Orbitron', sans-serif`;
  const textWidth = ctx.measureText(text).width;

  const rng = Math.random();
  let type = "normal";
  let color = `hsl(${Math.random() * 360}, 100%, 75%)`;

  if (rng > 0.95) {
    type = "nuke";
    color = "#f59e0b";
  } else if (rng > 0.9) {
    type = "freeze";
    color = "#22d3ee";
  }

  words.push({
    text: text,
    x: Math.random() * (canvas.width - textWidth - 40) + 20,
    y: -30,
    speed: Math.min(speed, config.word.maxSpeed),
    typedLength: 0,
    color: color,
    type: type,
  });
}

function drawWords() {
  ctx.font = `bold ${config.word.fontSize}px 'Orbitron', sans-serif`;
  ctx.lineWidth = 4;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000000";

  words.forEach((word) => {
    ctx.shadowBlur = 15;
    ctx.shadowColor = word.color;
    let xOffset = 0;
    for (let i = 0; i < word.text.length; i++) {
      const char = word.text[i];
      if (i < word.typedLength) {
        ctx.fillStyle = "#10b981";
      } else if (word === gameState.activeWord && i === word.typedLength) {
        ctx.fillStyle = "#fbbf24";
      } else {
        ctx.fillStyle = word.color;
      }
      ctx.shadowBlur = 0;
      ctx.strokeText(char, word.x + xOffset, word.y);
      ctx.shadowBlur = 10;
      ctx.fillText(char, word.x + xOffset, word.y);
      xOffset += ctx.measureText(char).width;
    }
    ctx.shadowBlur = 0;
  });
}

function destroyWord(word) {
  sounds.explode();
  createParticles(
    word.x + ctx.measureText(word.text).width / 2,
    word.y,
    word.color,
    30
  );

  if (word.type === "nuke") triggerNuke();
  else if (word.type === "freeze") triggerFreeze();

  const index = words.indexOf(word);
  if (index > -1) words.splice(index, 1);

  let points = word.text.length * 5;
  if (word.type !== "normal") points += 50;
  addScore(points);
}

function triggerNuke() {
  sounds.powerup();
  document.body.style.backgroundColor = "#fff";
  setTimeout(() => {
    document.body.style.backgroundColor = "";
  }, 100);

  words.forEach((w) => {
    createParticles(w.x, w.y, w.color, 15);
    addScore(10);
  });
  words = [];
  gameState.activeWord = null;
  gameState.currentInput = "";
}

function triggerFreeze() {
  sounds.powerup();
  gameState.isFrozen = true;
  const canvas = document.getElementById("game-canvas");
  canvas.style.borderColor = "#06b6d4";
  canvas.style.boxShadow = "0 0 50px #06b6d4";

  if (gameState.freezeTimer) clearTimeout(gameState.freezeTimer);
  gameState.freezeTimer = setTimeout(() => {
    gameState.isFrozen = false;
    canvas.style.borderColor = "";
    canvas.style.boxShadow = "";
  }, 3000);
}

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

function addScore(points) {
  gameState.score += points;
  updateHUD();

  const newLevel = Math.floor(gameState.score / 150) + 1;
  if (newLevel > gameState.level) {
    gameState.level = newLevel;
    updateHUD();
    createParticles(canvas.width / 2, canvas.height / 2, "#a855f7", 50);
  }
}

function loseLife() {
  gameState.lives--;
  updateHUD();
  if (gameState.lives <= 0) {
    gameOver();
  } else {
    createParticles(canvas.width / 2, canvas.height - 50, "#ef4444", 30);
  }
}

function updateHUD() {
  document.getElementById("score").textContent = gameState.score;
  document.getElementById("level").textContent = gameState.level;
  document.getElementById("lives").textContent =
    "❤️".repeat(gameState.lives) || "💀";
}

function gameOver() {
  gameState.isPlaying = false;

  atmosphereSystem.stop();
  sounds.gameOver();

  if (gameState.score > gameState.highScore) {
    gameState.highScore = gameState.score;
    localStorage.setItem("highScore", gameState.highScore);
    document.getElementById("new-record-container").style.display = "block";
  } else {
    document.getElementById("new-record-container").style.display = "none";
  }

  document.getElementById("final-score").textContent = gameState.score;
  document.getElementById("final-level").textContent = gameState.level;
  showScreen("gameover-screen");
}

window.addEventListener("load", init);