import { gameState, config, wordBank } from "./state.js";
import { sounds, atmosphereSystem } from "./audio.js";
import {
  showScreen,
  updateHUD,
  updateTypingDisplay,
  flashTypingDisplay,
  showLevelUpModal,
  hideLevelUpModal,
} from "./ui.js";

// ============================================================
//  GAME — Type Attack
// ============================================================

let canvas, ctx;
let words        = [];
let particles    = [];
let lastWordSpawn = 0;

// Track used words to avoid repetition
let recentWords = [];
const RECENT_LIMIT = 20;

// ============================================================
//  INIT
// ============================================================
export function init() {
  canvas = document.getElementById("game-canvas");
  ctx    = canvas.getContext("2d");

  resizeCanvas();
  window.addEventListener("resize", resizeCanvas);

  document.getElementById("high-score-display").textContent =
    gameState.highScore.toLocaleString();

  setupEventListeners();
}

function resizeCanvas() {
  // Match canvas internal resolution to its CSS display size
  const rect = canvas.getBoundingClientRect();
  canvas.width  = rect.width  || config.canvas.width;
  canvas.height = rect.height || config.canvas.height;
}

// ============================================================
//  EVENT LISTENERS
// ============================================================
function setupEventListeners() {
  document.getElementById("start-btn").addEventListener("click", startGame);

  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) pauseBtn.addEventListener("click", () => { togglePause(); pauseBtn.blur(); });

  const resumeBtn = document.getElementById("resume-btn");
  if (resumeBtn) resumeBtn.addEventListener("click", togglePause);

  const quitBtn = document.getElementById("quit-btn");
  if (quitBtn) quitBtn.addEventListener("click", () => {
    if (gameState.isPaused) togglePause();
    atmosphereSystem.stop();
    resetGame();
    showScreen("start-screen");
  });

  const muteBtn = document.getElementById("mute-btn");
  if (muteBtn) muteBtn.addEventListener("click", () => atmosphereSystem.toggle());

  document.getElementById("instructions-btn")
    .addEventListener("click", () => showScreen("instructions-screen"));
  document.getElementById("back-btn")
    .addEventListener("click", () => showScreen("start-screen"));
  document.getElementById("restart-btn")
    .addEventListener("click", startGame);
  document.getElementById("menu-btn")
    .addEventListener("click", () => { showScreen("start-screen"); resetGame(); });

  const levelUpModal = document.getElementById("levelup-modal");
  if (levelUpModal) levelUpModal.addEventListener("click", hideLevelUpModal);

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gameState.isPlaying) togglePause();
    handleTyping(e);
  });

  // Mobile tap-to-focus (keeps keyboard up on mobile)
  canvas.addEventListener("touchstart", () => {
    const hidden = document.getElementById("mobile-input");
    if (hidden) hidden.focus();
  }, { passive: true });
}

// ============================================================
//  PAUSE
// ============================================================
function togglePause() {
  if (!gameState.isPlaying) return;
  gameState.isPaused = !gameState.isPaused;

  const pauseScreen = document.getElementById("pause-screen");
  const pauseBtn    = document.getElementById("pause-btn");

  if (gameState.isPaused) {
    cancelAnimationFrame(gameState.animationId);
    atmosphereSystem.stop();
    pauseScreen.classList.add("active");
    if (pauseBtn) pauseBtn.textContent = "▶️";
  } else {
    pauseScreen.classList.remove("active");
    if (pauseBtn) pauseBtn.textContent = "⏸️";
    lastWordSpawn = performance.now();
    if (!gameState.isMuted) atmosphereSystem.start();
    gameLoop();
  }
}

// ============================================================
//  TYPING HANDLER
// ============================================================
function handleTyping(e) {
  if (!gameState.isPlaying || gameState.isPaused) return;
  if (e.key.length > 1 && e.key !== "Backspace") return;
  e.preventDefault();

  if (e.key === "Backspace") {
    gameState.currentInput = gameState.currentInput.slice(0, -1);
    gameState.activeWord   = null;
  } else {
    gameState.currentInput += e.key.toLowerCase();
    checkWordMatch();
  }
  updateTypingDisplay();
}

function checkWordMatch() {
  const input = gameState.currentInput;
  let matchFound    = false;
  let wordCompleted = false;

  // Try to extend current active word first
  if (gameState.activeWord) {
    if (gameState.activeWord.text.startsWith(input)) {
      gameState.activeWord.typedLength = input.length;
      matchFound = true;
      if (input === gameState.activeWord.text) {
        destroyWord(gameState.activeWord);
        gameState.currentInput = "";
        gameState.activeWord   = null;
        wordCompleted = true;
      }
    } else {
      gameState.activeWord.typedLength = 0;
      gameState.activeWord = null;
    }
  }

  // Search all words if no active match
  if (!matchFound) {
    for (const word of words) {
      if (word.text.startsWith(input)) {
        gameState.activeWord      = word;
        word.typedLength          = input.length;
        matchFound                = true;
        if (input === word.text) {
          destroyWord(word);
          gameState.currentInput = "";
          gameState.activeWord   = null;
          wordCompleted          = true;
        }
        break;
      }
    }
  }

  if (wordCompleted) {
    // nothing extra needed — destroyWord handles sounds + score
  } else if (matchFound) {
    sounds.type();
  } else if (input.length > 0) {
    sounds.error();
    flashTypingDisplay("error");
    applyPenalty();
    // Clear bad input so player can start fresh
    gameState.currentInput = "";
    updateTypingDisplay();
  }
}

function applyPenalty() {
  gameState.mistakes++;
  gameState.score = Math.max(0, gameState.score - config.difficulty.wrongKeyPenalty);
  updateHUD();

  const now = performance.now();
  if (now - gameState.lastFailSoundAt > 150) {
    sounds.fail();
    gameState.lastFailSoundAt = now;
  }

  if (gameState.mistakes % config.difficulty.mistakeLifeThreshold === 0) {
    loseLife();
  }
}

// ============================================================
//  GAME LIFECYCLE
// ============================================================
async function startGame() {
  await atmosphereSystem.init();
  resetGame();
  gameState.isPlaying = true;
  showScreen("game-screen");
  resizeCanvas();
  updateHUD();
  updateTypingDisplay();

  if (!gameState.isMuted) atmosphereSystem.start();
  gameLoop();
}

function resetGame() {
  cancelAnimationFrame(gameState.animationId);
  clearTimeout(gameState.freezeTimer);
  clearTimeout(gameState.levelUpTimer);
  clearTimeout(gameState.modalPauseTimer);

  Object.assign(gameState, {
    score:            0,
    lives:            3,
    level:            1,
    isPlaying:        false,
    isPaused:         false,
    currentInput:     "",
    activeWord:       null,
    isFrozen:         false,
    mistakes:         0,
    bossMode:         false,
    bossModeEndsAt:   0,
    lastBossLevel:    0,
    modalPauseActive: false,
    lastFailSoundAt:  0,
    freezeTimer:      null,
    levelUpTimer:     null,
    modalPauseTimer:  null,
    animationId:      null,
  });

  words        = [];
  particles    = [];
  recentWords  = [];
  lastWordSpawn = 0;

  const cv = document.getElementById("game-canvas");
  cv.style.borderColor = "";
  cv.style.boxShadow   = "";

  document.getElementById("pause-screen").classList.remove("active");
  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) pauseBtn.textContent = "⏸️";

  hideLevelUpModal();
  atmosphereSystem.stop();
  updateTypingDisplay();
}

// ============================================================
//  GAME LOOP
// ============================================================
function gameLoop(timestamp = 0) {
  if (!gameState.isPlaying || gameState.isPaused) return;

  // End boss mode if timer expired
  if (gameState.bossMode && timestamp >= gameState.bossModeEndsAt) {
    gameState.bossMode = false;
    canvas.style.borderColor = "";
    canvas.style.boxShadow   = "";
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateWords(timestamp);
  updateParticles();
  drawWords();
  drawParticles();

  gameState.animationId = requestAnimationFrame(gameLoop);
}

// ============================================================
//  WORDS
// ============================================================
function updateWords(timestamp) {
  const baseSpawn = Math.max(
    config.difficulty.minSpawn,
    config.word.spawnRate - gameState.level * config.difficulty.spawnDecay
  );
  const spawnRate = gameState.bossMode
    ? Math.min(baseSpawn, config.difficulty.bossSpawn)
    : baseSpawn;

  const canSpawn = !gameState.isFrozen && !gameState.modalPauseActive;
  if (canSpawn && timestamp - lastWordSpawn > spawnRate) {
    spawnWord();
    lastWordSpawn = timestamp;
  }

  words = words.filter((word) => {
    if (!gameState.isFrozen && !gameState.modalPauseActive) {
      word.y += word.speed;
    }
    if (word.y > canvas.height + 10) {
      if (word === gameState.activeWord) {
        gameState.activeWord   = null;
        gameState.currentInput = "";
        updateTypingDisplay();
      }
      loseLife();
      return false;
    }
    return true;
  });
}

function pickWord() {
  const lvl = gameState.level;
  let minLen = 3, maxLen = 5;

  if (lvl >= 5)  { minLen = 4; maxLen = 6; }
  if (lvl >= 8)  { minLen = 5; maxLen = 7; }
  if (lvl >= 10) { minLen = 6; maxLen = 8; }
  if (lvl >= 15) { minLen = 7; maxLen = 9; }
  if (lvl >= 20) { minLen = 8; maxLen = 99; }
  if (gameState.bossMode) { minLen = Math.max(minLen, 7); maxLen = 99; }

  let pool = wordBank.filter(w => w.length >= minLen && w.length <= maxLen);
  if (pool.length === 0) pool = wordBank;

  // Avoid recent repeats
  const fresh = pool.filter(w => !recentWords.includes(w));
  const source = fresh.length > 0 ? fresh : pool;

  const picked = source[Math.floor(Math.random() * source.length)];
  recentWords.push(picked);
  if (recentWords.length > RECENT_LIMIT) recentWords.shift();
  return picked;
}

function spawnWord() {
  const text  = pickWord();
  let speed   = config.word.minSpeed + gameState.level * config.difficulty.speedRamp;
  if (gameState.bossMode) speed += config.difficulty.bossSpeedBoost;
  speed = Math.min(speed, config.word.maxSpeed + (gameState.bossMode ? 1.2 : 0));

  ctx.font = `bold ${config.word.fontSize}px 'Bungee', sans-serif`;
  const textWidth = ctx.measureText(text).width;
  const xMax      = Math.max(20, canvas.width - textWidth - 20);
  const x         = Math.random() * xMax + 10;

  // Word type & color
  const rng = Math.random();
  let type  = "normal";
  let color = `hsl(${Math.random() * 280 + 160}, 100%, 72%)`;

  if (rng > 0.95) {
    type  = "nuke";
    color = "#fbbf24"; // amber
  } else if (rng > 0.88) {
    type  = "freeze";
    color = "#22d3ee"; // cyan
  }

  words.push({ text, x, y: -30, speed, typedLength: 0, color, type });
}

function drawWords() {
  ctx.font      = `bold ${config.word.fontSize}px 'Bungee', sans-serif`;
  ctx.lineWidth = 3;
  ctx.lineJoin  = "round";

  words.forEach((word) => {
    let xOffset = 0;

    // Glow backdrop per word
    ctx.save();
    ctx.shadowColor = word.color;
    ctx.shadowBlur  = 12;
    ctx.fillStyle   = "rgba(0,0,0,0)";
    ctx.fillText(word.text, word.x, word.y);
    ctx.restore();

    // Draw letter by letter
    for (let i = 0; i < word.text.length; i++) {
      const char = word.text[i];
      const charW = ctx.measureText(char).width;

      // Stroke for legibility
      ctx.strokeStyle = "rgba(0,0,0,0.85)";
      ctx.lineWidth   = 4;
      ctx.strokeText(char, word.x + xOffset, word.y);

      // Fill color by state
      if (i < word.typedLength) {
        ctx.fillStyle = "#00f5a0"; // typed → green
      } else if (word === gameState.activeWord && i === word.typedLength) {
        ctx.fillStyle = "#fbbf24"; // next char → amber
      } else {
        ctx.fillStyle = word.color;
      }

      ctx.fillText(char, word.x + xOffset, word.y);
      xOffset += charW;
    }

    // Type badge above special words
    if (word.type !== "normal") {
      ctx.font      = "bold 10px 'Space Grotesk', sans-serif";
      ctx.fillStyle = word.color;
      ctx.fillText(
        word.type === "nuke" ? "💥 NUKE" : "❄️ FREEZE",
        word.x,
        word.y - 14
      );
      ctx.font = `bold ${config.word.fontSize}px 'Bungee', sans-serif`;
    }
  });
}

// ============================================================
//  DESTROY / POWERUPS
// ============================================================
function destroyWord(word) {
  sounds.explode();

  ctx.font = `bold ${config.word.fontSize}px 'Bungee', sans-serif`;
  const cx = word.x + ctx.measureText(word.text).width / 2;
  createParticles(cx, word.y, word.color, 22);

  const idx = words.indexOf(word);
  if (idx > -1) words.splice(idx, 1);

  if (word.type === "nuke")   triggerNuke();
  else if (word.type === "freeze") triggerFreeze();

  const points = word.text.length * 10 + (word.type !== "normal" ? 75 : 0);
  addScore(points);
}

function triggerNuke() {
  sounds.powerup();

  // Flash effect
  document.body.style.background = "rgba(251,191,36,0.25)";
  setTimeout(() => { document.body.style.background = ""; }, 120);

  words.forEach(w => {
    createParticles(w.x, w.y, w.color, 10);
    gameState.score += 10;
  });
  words                  = [];
  gameState.activeWord   = null;
  gameState.currentInput = "";
  updateHUD();
  updateTypingDisplay();
}

function triggerFreeze() {
  sounds.powerup();
  gameState.isFrozen = true;

  const cv = document.getElementById("game-canvas");
  cv.style.borderColor = "#22d3ee";
  cv.style.boxShadow   = "0 0 60px rgba(34,211,238,0.6), inset 0 0 40px rgba(34,211,238,0.1)";

  clearTimeout(gameState.freezeTimer);
  gameState.freezeTimer = setTimeout(() => {
    gameState.isFrozen   = false;
    cv.style.borderColor = "";
    cv.style.boxShadow   = "";
  }, 3500);
}

// ============================================================
//  PARTICLES
// ============================================================
function createParticles(x, y, color, count = 12) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const speed = Math.random() * 4 + 1.5;
    particles.push({
      x, y,
      vx:    Math.cos(angle) * speed,
      vy:    Math.sin(angle) * speed,
      life:  1,
      color,
      size:  Math.random() * 5 + 2,
    });
  }
}

function updateParticles() {
  particles = particles.filter(p => {
    p.x    += p.vx;
    p.y    += p.vy;
    p.vy   += 0.08; // gravity
    p.life -= 0.025;
    return p.life > 0;
  });
}

function drawParticles() {
  particles.forEach(p => {
    ctx.save();
    ctx.globalAlpha = p.life;
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

// ============================================================
//  SCORE / LEVEL
// ============================================================
function addScore(points) {
  gameState.score += points;
  updateHUD();

  const newLevel = Math.floor(gameState.score / 200) + 1;
  if (newLevel > gameState.level) {
    gameState.level = newLevel;
    updateHUD();
    createParticles(canvas.width / 2, canvas.height / 2, "#a855f7", 32);

    if (gameState.level % 10 === 0 && gameState.lastBossLevel !== gameState.level) {
      startBossMode(gameState.level);
    } else {
      showLevelUpModal(gameState.level);
    }
  }
}

function startBossMode(level) {
  gameState.bossMode        = true;
  gameState.bossModeEndsAt  = performance.now() + config.difficulty.bossDurationMs;
  gameState.lastBossLevel   = level;

  // Red border during boss
  canvas.style.borderColor = "#ef4444";
  canvas.style.boxShadow   = "0 0 60px rgba(239,68,68,0.5)";

  showLevelUpModal(level, {
    badgeText: "⚠️ BOSS WAVE",
    subtitle:  "Elite words inbound. Survive the storm.",
  });
}

// ============================================================
//  LIVES / GAME OVER
// ============================================================
function loseLife() {
  gameState.lives--;
  updateHUD();

  if (gameState.lives <= 0) {
    gameOver();
  } else {
    sounds.fail();
    // Screen shake via CSS class
    const gs = document.getElementById("game-screen");
    gs.classList.add("shake");
    setTimeout(() => gs.classList.remove("shake"), 400);
    createParticles(canvas.width / 2, canvas.height - 30, "#ef4444", 20);
  }
}

function gameOver() {
  gameState.isPlaying = false;
  cancelAnimationFrame(gameState.animationId);
  atmosphereSystem.stop();
  sounds.gameOver();

  const isNewRecord = gameState.score > gameState.highScore;
  if (isNewRecord) {
    gameState.highScore = gameState.score;
    localStorage.setItem("highScore", gameState.highScore);
    document.getElementById("high-score-display").textContent =
      gameState.highScore.toLocaleString();
  }

  document.getElementById("new-record-container").style.display =
    isNewRecord ? "block" : "none";
  document.getElementById("final-score").textContent =
    gameState.score.toLocaleString();
  document.getElementById("final-level").textContent = gameState.level;

  showScreen("gameover-screen");
}