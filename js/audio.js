import { gameState } from "./state.js";

// ============================================================
//  AUDIO SYSTEM — Type Attack
//  Fix: paths are relative to js/ folder → ../audio/
//  Fix: ambience uses Web Audio API gain node for reliable
//       volume control and fade-in to avoid autoplay blocks.
// ============================================================

let audioCtx = null;
let ambienceSource = null;
let ambienceGain = null;
let ambienceBuffer = null;
let ambienceLoaded = false;
let ambienceFadeTimer = null;

// Simple one-shot SFX via HTMLAudioElement (clone trick for polyphony)
const sfx = {
  click:     createSfx("../audio/click.wav",      0.45),
  error:     createSfx("../audio/error_beep.wav", 0.45),
  fail:      createSfx("../audio/fail.wav",        0.50),
  explosion: createSfx("../audio/explosion.wav",  0.60),
  powerup:   createSfx("../audio/powerup.ogg",    0.55),
  gameover:  createSfx("../audio/gameover.wav",   0.50),
};

function createSfx(src, volume) {
  const el = new Audio(src);
  el.volume = volume;
  el.preload = "auto";
  return el;
}

function playSfx(el) {
  if (gameState.isMuted) return;
  try {
    const clone = el.cloneNode();
    clone.volume = el.volume;
    clone.play().catch(() => {});
  } catch (_) {}
}

// ============================================================
//  PUBLIC SFX API
// ============================================================
export const sounds = {
  type:     () => playSfx(sfx.click),
  error:    () => playSfx(sfx.error),
  fail:     () => playSfx(sfx.fail),
  explode:  () => playSfx(sfx.explosion),
  powerup:  () => playSfx(sfx.powerup),
  gameOver: () => playSfx(sfx.gameover),
};

// ============================================================
//  WEB AUDIO AMBIENCE SYSTEM
//  Uses AudioContext + BufferSource for seamless looping and
//  smooth fade-in/out — avoids the HTMLAudioElement autoplay
//  issues that caused the silent background bug.
// ============================================================
export const atmosphereSystem = {
  isPlaying: false,

  /** Must be called after a user gesture (audio gate handles this). */
  async init() {
    if (audioCtx) return; // already initialised
    try {
      audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      ambienceGain = audioCtx.createGain();
      ambienceGain.gain.setValueAtTime(0, audioCtx.currentTime);
      ambienceGain.connect(audioCtx.destination);
      await this._loadAmbience();
    } catch (e) {
      console.warn("AudioContext failed:", e);
    }
  },

  async _loadAmbience() {
    // Try the primary file; fall back to the dark variant
    const candidates = [
      "../audio/space_ambience.ogg",
      "../audio/dark_ambience.ogg",
    ];
    for (const url of candidates) {
      try {
        const res = await fetch(url);
        if (!res.ok) continue;
        const arrayBuffer = await res.arrayBuffer();
        ambienceBuffer = await audioCtx.decodeAudioData(arrayBuffer);
        ambienceLoaded = true;
        console.log(`[Audio] Loaded ambience: ${url}`);
        return;
      } catch (e) {
        console.warn(`[Audio] Could not load ${url}:`, e);
      }
    }
    console.warn("[Audio] No ambience file could be loaded.");
  },

  start() {
    if (this.isPlaying || gameState.isMuted || !ambienceLoaded || !audioCtx) return;

    // Resume context if suspended (browser policy)
    if (audioCtx.state === "suspended") {
      audioCtx.resume().then(() => this._startSource());
    } else {
      this._startSource();
    }
  },

  _startSource() {
    if (this.isPlaying) return;
    try {
      // Stop any existing source
      if (ambienceSource) {
        try { ambienceSource.stop(); } catch (_) {}
        ambienceSource = null;
      }

      ambienceSource = audioCtx.createBufferSource();
      ambienceSource.buffer = ambienceBuffer;
      ambienceSource.loop = true;
      ambienceSource.connect(ambienceGain);
      ambienceSource.start(0);
      this.isPlaying = true;

      // Fade in over 2 seconds
      clearTimeout(ambienceFadeTimer);
      ambienceGain.gain.cancelScheduledValues(audioCtx.currentTime);
      ambienceGain.gain.setValueAtTime(0, audioCtx.currentTime);
      ambienceGain.gain.linearRampToValueAtTime(0.38, audioCtx.currentTime + 2.0);
    } catch (e) {
      console.warn("[Audio] Could not start ambience:", e);
    }
  },

  stop() {
    if (!this.isPlaying || !audioCtx) return;
    this.isPlaying = false;

    // Fade out over 1.2 seconds then stop
    ambienceGain.gain.cancelScheduledValues(audioCtx.currentTime);
    ambienceGain.gain.setValueAtTime(ambienceGain.gain.value, audioCtx.currentTime);
    ambienceGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.2);

    ambienceFadeTimer = setTimeout(() => {
      try {
        if (ambienceSource) {
          ambienceSource.stop();
          ambienceSource = null;
        }
      } catch (_) {}
    }, 1300);
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
//  AUDIO GATE — must be triggered by user gesture
// ============================================================
export function initAudioGate() {
  const gate = document.getElementById("audio-gate");
  const btn  = document.getElementById("audio-start-btn");
  if (!gate) return;

  const unlock = async () => {
    // Remove all listeners immediately so it only fires once
    btn?.removeEventListener("click", unlock);
    window.removeEventListener("keydown", unlock);
    window.removeEventListener("pointerdown", unlock);

    // Hide gate with a smooth fade
    gate.classList.add("hidden");
    gate.setAttribute("aria-hidden", "true");

    // Init Web Audio (requires user gesture)
    await atmosphereSystem.init();

    // Start ambience if not muted
    if (!gameState.isMuted) {
      atmosphereSystem.start();
    }
  };

  if (btn) btn.addEventListener("click", unlock);
  window.addEventListener("keydown", unlock, { once: true });
  window.addEventListener("pointerdown", unlock, { once: true });
}