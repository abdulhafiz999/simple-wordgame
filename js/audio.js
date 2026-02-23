import { gameState } from "./state.js";

// ============================================================
//  AUDIO SYSTEM — Type Attack
//  Local audio files + Web Audio API for ambience
// ============================================================

const SFX_URLS = {
  click:     "../audio/click.wav",
  error:     "../audio/error_beep.wav",
  fail:      "../audio/fail.wav",
  explosion: "../audio/explosion.wav",
  powerup:   "../audio/powerup.mp3",
  gameover:  "../audio/gameover.wav",
};

const AMBIENCE_URLS = [
  "../audio/space_ambience.mp3",
  "../audio/dark_ambience.mp3",
  "../audio/space_ambience.ogg",
  "../audio/dark_ambience.ogg",
];

// ============================================================
//  SFX — HTMLAudioElement with clone-for-polyphony
// ============================================================
const sfxElements = {};

function loadSfx(key, url, volume) {
  const el = new Audio(url);
  el.volume = volume;
  el.preload = "auto";
  sfxElements[key] = el;
}

loadSfx("click",     SFX_URLS.click,     0.40);
loadSfx("error",     SFX_URLS.error,     0.40);
loadSfx("fail",      SFX_URLS.fail,      0.45);
loadSfx("explosion", SFX_URLS.explosion, 0.55);
loadSfx("powerup",   SFX_URLS.powerup,   0.50);
loadSfx("gameover",  SFX_URLS.gameover,  0.50);

function playSfx(key) {
  if (gameState.isMuted) return;
  const el = sfxElements[key];
  if (!el) return;
  try {
    const clone = el.cloneNode();
    clone.volume = el.volume;
    clone.play().catch(() => {});
  } catch (_) {}
}

export const sounds = {
  type:     () => playSfx("click"),
  error:    () => playSfx("error"),
  fail:     () => playSfx("fail"),
  explode:  () => playSfx("explosion"),
  powerup:  () => playSfx("powerup"),
  gameOver: () => playSfx("gameover"),
};

// ============================================================
//  AMBIENCE — Web Audio API (reliable looping + fade)
// ============================================================
let audioCtx       = null;
let ambienceSource = null;
let ambienceGain   = null;
let ambienceBuffer = null;
let ambienceLoaded = false;
let fadeTimer      = null;

async function tryLoadAmbience() {
  for (const url of AMBIENCE_URLS) {
    try {
      const res = await fetch(url);
      if (!res.ok) continue;
      const raw = await res.arrayBuffer();
      ambienceBuffer = await audioCtx.decodeAudioData(raw);
      ambienceLoaded = true;
      console.log("[Audio] Ambience loaded:", url);
      return;
    } catch (e) {
      console.warn("[Audio] Skipping:", url, e.message);
    }
  }
  console.warn("[Audio] No ambience file could be loaded. Add space_ambience.mp3 to audio/");
}

export const atmosphereSystem = {
  isPlaying: false,

  async init() {
    if (audioCtx) return;
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      ambienceGain = audioCtx.createGain();
      ambienceGain.gain.setValueAtTime(0, audioCtx.currentTime);
      ambienceGain.connect(audioCtx.destination);
      await tryLoadAmbience();
    } catch (e) {
      console.warn("[Audio] AudioContext init failed:", e);
    }
  },

  start() {
    if (this.isPlaying || gameState.isMuted || !ambienceLoaded || !audioCtx) return;
    if (audioCtx.state === "suspended") {
      audioCtx.resume().then(() => this._play());
    } else {
      this._play();
    }
  },

  _play() {
    if (this.isPlaying) return;
    try {
      if (ambienceSource) {
        try { ambienceSource.stop(); } catch (_) {}
      }
      ambienceSource = audioCtx.createBufferSource();
      ambienceSource.buffer = ambienceBuffer;
      ambienceSource.loop = true;
      ambienceSource.connect(ambienceGain);
      ambienceSource.start(0);
      this.isPlaying = true;

      // Fade in over 2.5s
      ambienceGain.gain.cancelScheduledValues(audioCtx.currentTime);
      ambienceGain.gain.setValueAtTime(0, audioCtx.currentTime);
      ambienceGain.gain.linearRampToValueAtTime(0.35, audioCtx.currentTime + 2.5);
    } catch (e) {
      console.warn("[Audio] Playback error:", e);
    }
  },

  stop() {
    if (!this.isPlaying || !audioCtx) return;
    this.isPlaying = false;
    clearTimeout(fadeTimer);

    ambienceGain.gain.cancelScheduledValues(audioCtx.currentTime);
    ambienceGain.gain.setValueAtTime(ambienceGain.gain.value, audioCtx.currentTime);
    ambienceGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5);

    fadeTimer = setTimeout(() => {
      try { ambienceSource?.stop(); ambienceSource = null; } catch (_) {}
    }, 1600);
  },

  toggle() {
    gameState.isMuted = !gameState.isMuted;
    const btn = document.getElementById("mute-btn");
    if (btn) {
      btn.textContent = gameState.isMuted ? "🔇" : "🔊";
      btn.classList.toggle("muted", gameState.isMuted);
    }
    if (gameState.isMuted) {
      this.stop();
    } else if (gameState.isPlaying && !gameState.isPaused) {
      this.start();
    }
  },
};

// ============================================================
//  AUDIO GATE — unlocks AudioContext via user gesture
// ============================================================
export function initAudioGate() {
  const gate = document.getElementById("audio-gate");
  const btn  = document.getElementById("audio-start-btn");
  if (!gate) return;

  const unlock = async () => {
    btn?.removeEventListener("click", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("pointerdown", unlock);

    gate.classList.add("hidden");
    gate.setAttribute("aria-hidden", "true");

    await atmosphereSystem.init();
    if (!gameState.isMuted) atmosphereSystem.start();
  };

  if (btn) btn.addEventListener("click", unlock);
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("pointerdown", unlock, { once: true });
}