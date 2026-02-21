import { gameState } from "./state.js";

export function showScreen(screenId) {
  document.querySelectorAll(".screen").forEach((screen) => {
    screen.classList.remove("active");
  });
  document.getElementById(screenId).classList.add("active");
}

export function updateHUD() {
  document.getElementById("score").textContent = gameState.score;
  document.getElementById("level").textContent = gameState.level;
  document.getElementById("lives").textContent =
    "❤️".repeat(gameState.lives) || "💀";
}

export function updateTypingDisplay() {
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

export function flashTypingDisplay(type) {
  const container = document.querySelector(".typing-input-display");
  if (type === "error") {
    container.style.borderColor = "#ef4444";
    setTimeout(() => {
      container.style.borderColor = "";
    }, 200);
  }
}

export function showLevelUpModal(level, options = {}) {
  const modal = document.getElementById("levelup-modal");
  const number = document.getElementById("levelup-number");
  const badge = document.querySelector(".levelup-badge");
  const subtitle = document.querySelector(".levelup-subtitle");
  if (!modal || !number) return;

  number.textContent = level;
  if (badge) badge.textContent = options.badgeText || "LEVEL UP";
  if (subtitle) {
    subtitle.textContent =
      options.subtitle || "Incoming wave faster and tougher";
  }
  modal.classList.add("active");
  modal.setAttribute("aria-hidden", "false");

  if (gameState.levelUpTimer) clearTimeout(gameState.levelUpTimer);
  if (gameState.modalPauseTimer) clearTimeout(gameState.modalPauseTimer);

  gameState.modalPauseActive = true;
  gameState.modalPauseTimer = setTimeout(() => {
    gameState.modalPauseActive = false;
  }, 900);

  gameState.levelUpTimer = setTimeout(() => {
    hideLevelUpModal();
  }, 1200);
}

export function hideLevelUpModal() {
  const modal = document.getElementById("levelup-modal");
  if (!modal) return;
  modal.classList.remove("active");
  modal.setAttribute("aria-hidden", "true");
}
