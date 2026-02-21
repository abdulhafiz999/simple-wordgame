import { gameState } from "./state.js";

const audio = {
  ambience: new Audio("../audio/space_ambience.ogg"),
  click: new Audio("../audio/click.wav"),
  error: new Audio("../audio/error_beep.wav"),
  fail: new Audio("../audio/fail.wav"),
  powerup: new Audio("../audio/powerup.ogg"),
  explosion: new Audio("../audio/explosion.wav"),
  gameover: new Audio("../audio/gameover.wav"),
};

audio.ambience.loop = true;
audio.ambience.volume = 0.35;
audio.ambience.preload = "auto";
audio.click.volume = 0.5;
audio.error.volume = 0.45;
audio.fail.volume = 0.55;
audio.powerup.volume = 0.55;
audio.explosion.volume = 0.6;
audio.gameover.volume = 0.5;

function playSfx(source) {
  if (gameState.isMuted) return;
  try {
    const clip = source.cloneNode();
    clip.volume = source.volume;
    clip.play().catch(() => {});
  } catch (e) {}
}

export const sounds = {
  type: () => playSfx(audio.click),
  error: () => playSfx(audio.error),
  fail: () => playSfx(audio.fail),
  explode: () => playSfx(audio.explosion),
  powerup: () => playSfx(audio.powerup),
  gameOver: () => playSfx(audio.gameover),
};

export const atmosphereSystem = {
  isPlaying: false,

  start() {
    if (this.isPlaying || gameState.isMuted) return;
    this.isPlaying = true;
    audio.ambience.currentTime = 0;
    audio.ambience.play().catch(() => {});
  },

  stop() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    audio.ambience.pause();
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
  },
};

export function initAudioGate() {
  const gate = document.getElementById("audio-gate");
  const btn = document.getElementById("audio-start-btn");
  if (!gate) return;

  const start = () => {
    gate.classList.add("hidden");
    gate.setAttribute("aria-hidden", "true");
    if (!gameState.isMuted) {
      atmosphereSystem.start();
    }
  };

  if (btn) btn.addEventListener("click", start);
  window.addEventListener("keydown", start, { once: true });
  window.addEventListener("pointerdown", start, { once: true });
}
