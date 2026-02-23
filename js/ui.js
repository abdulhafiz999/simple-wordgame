import { gameState } from "./state.js";

// ============================================================
//  UI — Type Attack
// ============================================================

export function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const target = document.getElementById(screenId);
  if (target) target.classList.add("active");
}

export function updateHUD() {
  document.getElementById("score").textContent  = gameState.score.toLocaleString();
  document.getElementById("level").textContent  = gameState.level;

  const livesEl = document.getElementById("lives");
  if (gameState.lives > 0) {
    livesEl.textContent = "❤️".repeat(gameState.lives);
  } else {
    livesEl.textContent = "💀";
  }

  // Pulse score on update
  const scoreEl = document.getElementById("score");
  scoreEl.classList.remove("hud-pop");
  void scoreEl.offsetWidth; // reflow to restart animation
  scoreEl.classList.add("hud-pop");
}

export function updateTypingDisplay() {
  const display = document.getElementById("typed-text");
  if (!display) return;
  display.textContent = gameState.currentInput.toUpperCase();

  if (gameState.activeWord) {
    display.style.color = "var(--green)";
  } else if (gameState.currentInput.length > 0) {
    display.style.color = "var(--coral)";
  } else {
    display.style.color = "var(--cyan)";
  }
}

export function flashTypingDisplay(type) {
  const container = document.querySelector(".typing-input-display");
  if (!container) return;

  if (type === "error") {
    container.style.borderColor = "var(--coral)";
    container.style.boxShadow   = "var(--glow-coral)";
    setTimeout(() => {
      container.style.borderColor = "";
      container.style.boxShadow   = "";
    }, 220);
  }
}

export function showLevelUpModal(level, options = {}) {
  const modal    = document.getElementById("levelup-modal");
  const number   = document.getElementById("levelup-number");
  const badge    = document.querySelector(".levelup-badge");
  const subtitle = document.querySelector(".levelup-subtitle");
  if (!modal || !number) return;

  number.textContent = level;
  if (badge)    badge.textContent    = options.badgeText || "LEVEL UP";
  if (subtitle) subtitle.textContent = options.subtitle  || "Incoming wave faster and tougher";

  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");

  if (gameState.levelUpTimer)    clearTimeout(gameState.levelUpTimer);
  if (gameState.modalPauseTimer) clearTimeout(gameState.modalPauseTimer);

  gameState.modalPauseActive = true;
  gameState.modalPauseTimer  = setTimeout(() => {
    gameState.modalPauseActive = false;
  }, 900);

  gameState.levelUpTimer = setTimeout(hideLevelUpModal, 1800);
}

export function hideLevelUpModal() {
  const modal = document.getElementById("levelup-modal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}