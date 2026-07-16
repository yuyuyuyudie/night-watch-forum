import {
  state, saveThemeFamily, saveThemeMode,
  saveThemeOpacity, getThemeOpacity, saveCustomBase
} from "./state.js";

import { initRouter } from "./router.js";
import { initProfile } from "./profile.js";
import { initForum } from "./forum.js";
import { initSocial } from "./social.js";
import { initApiPanel } from "./api.js";
import { initCacheActions } from "./cache.js";
import { initAuth } from "./auth.js";

/* ---------- 主题颜色表（用来算 rgba 透明度） ---------- */
const THEME_COLORS = {
  classic: {
    day:   { bg: "#c0c0c0", panel: "#efefef", panel2: "#ffffff" },
    night: { bg: "#0c1210", panel: "#111a14", panel2: "#162019" }
  },
  sakura: {
    day:   { bg: "#fbcfe8", panel: "#fff1f2", panel2: "#ffffff" },
    night: { bg: "#2d0b1a", panel: "#1a0410", panel2: "#14020c" }
  }
};

function hexToRgba(hex, alpha) {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}

function clamp(val, min, max) {
  return Math.max(min, Math.min(max, val));
}

document.addEventListener("DOMContentLoaded", async () => {
  applyTheme();
  initSystemTime();
  initRouter();
  initAuth();
  initProfile();
  await initForum();
  initSocial();
  initApiPanel();
  initCacheActions();
  bindThemeToggle();
});

/* ---------- 主题 ---------- */
function applyTheme() {
  const app = document.getElementById("app");
  if (!app) return;

  app.classList.remove(
    "theme-classic", "theme-sakura", "theme-custom",
    "mode-day", "mode-night"
  );

  const family = state.themeFamily || "classic";
  const mode = state.themeMode || "night";

  if (family === "custom") {
    const base = state.customBase || "classic";
    app.classList.add("theme-" + base, "mode-" + mode, "theme-custom");
  } else {
    app.classList.add("theme-" + family, "mode-" + mode);
  }

  // ---- 透明度：每个主题独立 ----
  const opacity = getThemeOpacity(family === "custom" ? (state.customBase || "classic") : family);
  const colors = THEME_COLORS[family === "custom" ? (state.customBase || "classic") : family]?.[mode];
  if (colors) {
    app.style.setProperty("--bg", hexToRgba(colors.bg, opacity));
    app.style.setProperty("--panel", hexToRgba(colors.panel, clamp(opacity + 0.15, 0, 1)));
    app.style.setProperty("--panel-2", hexToRgba(colors.panel2, clamp(opacity + 0.2, 0, 1)));
  }

  // ---- 注入用户自定义 CSS ----
  const userCssEl = document.getElementById("userCustomCss");
  if (userCssEl) userCssEl.textContent = state.customCss || "";

  const bubbleCssEl = document.getElementById("userBubbleCss");
  if (bubbleCssEl) bubbleCssEl.textContent = state.bubbleCss || "";

  // ---- 按钮文字 ----
  const btn = document.getElementById("themeToggleBtn");
  if (btn) {
    btn.textContent = mode === "night" ? "LIGHT UI" : "DARK UI";
  }
}

function bindThemeToggle() {
  const btn = document.getElementById("themeToggleBtn");
  btn?.addEventListener("click", () => {
    const next = state.themeMode === "night" ? "day" : "night";
    saveThemeMode(next);
    applyTheme();
  });
}

function initSystemTime() {
  const el = document.getElementById("systemTime");
  if (!el) return;

  const update = () => {
    const now = new Date();
    el.textContent = now.toLocaleString("zh-CN", { hour12: false });
  };

  update();
  setInterval(update, 1000);
}

window.__applyTheme = applyTheme;
