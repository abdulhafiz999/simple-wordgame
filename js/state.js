export const gameState = {
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
  levelUpTimer: null,
  mistakes: 0,
  bossMode: false,
  bossModeEndsAt: 0,
  lastBossLevel: 0,
  modalPauseActive: false,
  modalPauseTimer: null,
  lastFailSoundAt: 0,
};

export const config = {
  canvas: { width: 800, height: 600 },
  word: {
    minSpeed: 0.5,
    maxSpeed: 3.5,
    spawnRate: 2000,
    fontSize: 24,
  },
  difficulty: {
    minSpawn: 650,
    spawnDecay: 140,
    speedRamp: 0.18,
    wrongKeyPenalty: 5,
    mistakeLifeThreshold: 5,
    bossDurationMs: 14000,
    bossSpawn: 450,
    bossSpeedBoost: 0.6,
  },
};

export const wordBank = [
  "code", "type", "game", "play", "word", "fast", "jump", "run", "star",
  "moon", "fire", "wind", "rain", "snow", "tree", "rock", "keyboard",
  "typing", "letter", "winner", "player", "attack", "defend", "rocket",
  "planet", "galaxy", "comet", "meteor", "cosmic", "stellar", "javascript",
  "programming", "developer", "computer", "challenge", "adventure",
  "universe", "asteroid", "nebula", "supernova", "quantum",
];
