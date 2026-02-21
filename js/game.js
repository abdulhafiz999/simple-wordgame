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

let canvas, ctx;
let words = [];
let particles = [];
let lastWordSpawn = 0;

export function init() {
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
    startGame();
  });

  const pauseBtn = document.getElementById("pause-btn");
  if (pauseBtn) {
    pauseBtn.addEventListener("click", () => {
      togglePause();
      pauseBtn.blur();
    });
  }

  const resumeBtn = document.getElementById("resume-btn");
  if (resumeBtn) resumeBtn.addEventListener("click", togglePause);

  const quitBtn = document.getElementById("quit-btn");
  if (quitBtn) {
    quitBtn.addEventListener("click", () => {
      togglePause();
      showScreen("start-screen");
      atmosphereSystem.stop();
      resetGame();
    });
  }

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

  const levelUpModal = document.getElementById("levelup-modal");
  if (levelUpModal) {
    levelUpModal.addEventListener("click", hideLevelUpModal);
  }

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && gameState.isPlaying) {
      togglePause();
    }
    handleTyping(e);
  });
}

function togglePause() {
  if (!gameState.isPlaying) return;

  gameState.isPaused = !gameState.isPaused;

  if (gameState.isPaused) {
    cancelAnimationFrame(gameState.animationId);
    atmosphereSystem.stop();
    document.getElementById("pause-screen").classList.add("active");
  } else {
    document.getElementById("pause-screen").classList.remove("active");
    lastWordSpawn = performance.now();
    gameLoop();
    canvas.focus();
    if (!gameState.isMuted) atmosphereSystem.start();
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
    applyPenalty();
  }
}

function applyPenalty() {
  gameState.mistakes += 1;
  gameState.score = Math.max(0, gameState.score - config.difficulty.wrongKeyPenalty);
  updateHUD();

  const now = performance.now();
  if (now - gameState.lastFailSoundAt > 120) {
    sounds.fail();
    gameState.lastFailSoundAt = now;
  }

  if (gameState.mistakes % config.difficulty.mistakeLifeThreshold === 0) {
    loseLife();
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
  clearTimeout(gameState.levelUpTimer);
  clearTimeout(gameState.modalPauseTimer);
  gameState.mistakes = 0;
  gameState.bossMode = false;
  gameState.bossModeEndsAt = 0;
  gameState.lastBossLevel = 0;
  gameState.modalPauseActive = false;
  gameState.lastFailSoundAt = 0;
  document.getElementById("game-canvas").style.borderColor = "";
  document.getElementById("game-canvas").style.boxShadow = "";
  document.getElementById("pause-screen").classList.remove("active");
  hideLevelUpModal();

  words = [];
  particles = [];
  lastWordSpawn = 0;

  atmosphereSystem.stop();

  updateTypingDisplay();
  if (gameState.animationId) cancelAnimationFrame(gameState.animationId);
}

function gameLoop(timestamp = 0) {
  if (!gameState.isPlaying || gameState.isPaused) return;

  if (gameState.bossMode && timestamp >= gameState.bossModeEndsAt) {
    gameState.bossMode = false;
  }

  ctx.clearRect(0, 0, canvas.width, canvas.height);
  updateWords(timestamp);
  updateParticles();
  drawWords();
  drawParticles();

  gameState.animationId = requestAnimationFrame(gameLoop);
}

function updateWords(timestamp) {
  const baseSpawn = Math.max(
    config.difficulty.minSpawn,
    config.word.spawnRate - gameState.level * config.difficulty.spawnDecay
  );
  const spawnRate = gameState.bossMode
    ? Math.min(baseSpawn, config.difficulty.bossSpawn)
    : baseSpawn;

  if (timestamp - lastWordSpawn > spawnRate && !gameState.isFrozen && !gameState.modalPauseActive) {
    spawnWord();
    lastWordSpawn = timestamp;
  }

  words = words.filter((word) => {
    if (!gameState.isFrozen && !gameState.modalPauseActive) {
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
  let minLen = 3;
  if (gameState.level >= 5) minLen = 4;
  if (gameState.level >= 8) minLen = 5;
  if (gameState.level >= 10) minLen = 6;
  if (gameState.level >= 15) minLen = 8;
  if (gameState.level >= 20) minLen = 9;

  if (gameState.bossMode) {
    minLen = Math.max(minLen, 7);
  }

  let availableWords = wordBank.filter((w) => w.length >= minLen);
  if (availableWords.length === 0) availableWords = wordBank;

  const text =
    availableWords[Math.floor(Math.random() * availableWords.length)];
  let speed =
    config.word.minSpeed + gameState.level * config.difficulty.speedRamp;
  if (gameState.bossMode) speed += config.difficulty.bossSpeedBoost;

  ctx.font = `${config.word.fontSize}px 'Bungee', 'Space Grotesk', sans-serif`;
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
    speed: Math.min(speed, config.word.maxSpeed + (gameState.bossMode ? 1 : 0)),
    typedLength: 0,
    color: color,
    type: type,
  });
}

function drawWords() {
  ctx.font = `bold ${config.word.fontSize}px 'Bungee', 'Space Grotesk', sans-serif`;
  ctx.lineWidth = 3;
  ctx.lineJoin = "round";
  ctx.strokeStyle = "#000000";

  words.forEach((word) => {
    ctx.shadowBlur = 8;
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
      ctx.shadowBlur = 6;
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
    20
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
    createParticles(w.x, w.y, w.color, 10);
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
    createParticles(canvas.width / 2, canvas.height / 2, "#a855f7", 28);
    if (gameState.level % 10 === 0 && gameState.lastBossLevel !== gameState.level) {
      startBossMode(gameState.level);
    } else {
      showLevelUpModal(gameState.level);
    }
  }
}

function startBossMode(level) {
  gameState.bossMode = true;
  gameState.bossModeEndsAt = performance.now() + config.difficulty.bossDurationMs;
  gameState.lastBossLevel = level;
  showLevelUpModal(level, {
    badgeText: "BOSS WAVE",
    subtitle: "Elite words inbound. Survive the storm.",
  });
}

function loseLife() {
  gameState.lives--;
  updateHUD();
  if (gameState.lives <= 0) {
    gameOver();
  } else {
    sounds.fail();
    createParticles(canvas.width / 2, canvas.height - 50, "#ef4444", 18);
  }
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
