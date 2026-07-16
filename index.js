// 守夜人论坛 - 手机版酒馆拓展
;(function () {
  const MODULE_NAME = "night-watch-forum";
  const API_BASE = "http://43.135.26.183:3000";

  let getContextStub = function () {
    return (typeof getContext === "function") ? getContext() : {};
  };

  // ====== 设置存储 ======
  function loadSettings() {
    try {
      const raw = localStorage.getItem("night_watch_forum_settings");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function saveSettings(settings) {
    try {
      localStorage.setItem("night_watch_forum_settings", JSON.stringify(settings));
    } catch (e) {}
  }

  let settings = loadSettings();
  if (!settings.apiBaseUrl) settings.apiBaseUrl = API_BASE;
  if (typeof settings.auto_send_context !== "boolean") settings.auto_send_context = true;
  if (typeof settings.enabled !== "boolean") settings.enabled = true;
  saveSettings(settings);

  // ====== 注入设置面板 ======
  function injectPanel() {
    if (document.getElementById(MODULE_NAME + "_settings")) return;

    const host = document.getElementById("extensions_settings");
    if (!host) {
      setTimeout(injectPanel, 1000);
      return;
    }

    const header = document.createElement("div");
    header.className = "extension_container";
    header.id = MODULE_NAME + "_settings";

    const headerInner = document.createElement("div");
    headerInner.className = "extension_container_header";
    headerInner.innerHTML = `
      <span class="extension_container_title">守夜人论坛 Night Watch Forum</span>
      <span class="extension_container_collapse_icon"></span>
    `;
    headerInner.addEventListener("click", function(e) {
      if (e.target.tagName === "BUTTON" || e.target.tagName === "INPUT" || e.target.tagName === "A") {
        return;
      }
      header.classList.toggle("collapsed");
    });
    header.appendChild(headerInner);

    const body = document.createElement("div");
    body.className = "extension_container_body";
    body.innerHTML = `
      <div class="extension_setting_block">
        <div class="flex-container">
          <input type="text" id="${MODULE_NAME}_api_url" class="text_pole"
            placeholder="后端API地址" value="${settings.apiBaseUrl}">
        </div>
        <div>
          <label class="checkbox_label">
            <input type="checkbox" id="${MODULE_NAME}_auto_context" ${settings.auto_send_context ? "checked" : ""}>
            自动同步酒馆上下文到论坛
          </label>
        </div>
        <div>
          <label class="checkbox_label">
            <input type="checkbox" id="${MODULE_NAME}_enabled" ${settings.enabled ? "checked" : ""}>
            启用论坛悬浮按钮
          </label>
        </div>
        <hr>
        <div class="flex-container">
          <button id="${MODULE_NAME}_open_btn" class="menu_button">打开守夜人论坛</button>
          <button id="${MODULE_NAME}_send_context_btn" class="menu_button">立即同步酒馆上下文</button>
        </div>
      </div>
    `;
    header.appendChild(body);
    host.appendChild(header);

    document.getElementById(MODULE_NAME + "_open_btn").addEventListener("click", function () {
      openForumWindow();
    });

    document.getElementById(MODULE_NAME + "_send_context_btn").addEventListener("click", function () {
      sendTavernContext();
    });

    document.getElementById(MODULE_NAME + "_api_url").addEventListener("change", function () {
      settings.apiBaseUrl = this.value.trim();
      saveSettings(settings);
    });

    document.getElementById(MODULE_NAME + "_auto_context").addEventListener("change", function () {
      settings.auto_send_context = this.checked;
      saveSettings(settings);
    });

    document.getElementById(MODULE_NAME + "_enabled").addEventListener("change", function () {
      settings.enabled = this.checked;
      saveSettings(settings);
      toggleFloatingButton();
    });

    console.log("[守夜人论坛] 设置面板已注入");
  }

  // ====== 悬浮按钮（可拖动） ======
  function toggleFloatingButton() {
    if (settings.enabled) {
      showFloatingButton();
    } else {
      hideFloatingButton();
    }
  }

  function showFloatingButton() {
    if (document.getElementById("night-watch-forum-float-btn")) return;

    const btn = document.createElement("div");
    btn.id = "night-watch-forum-float-btn";
    btn.textContent = "📖";
    btn.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 120px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, #34d399, #1a7f5a);
      color: #fff;
      font-size: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 99998;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
    `;

    // 可拖动逻辑
    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;
    let hasMoved = false;

    btn.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      const touch = e.touches[0];
      const rect = btn.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      startX = touch.clientX;
      startY = touch.clientY;
      isDragging = true;
      hasMoved = false;
      btn.style.transition = "none";
    }, { passive: true });

    btn.addEventListener("touchmove", function (e) {
      if (!isDragging || e.touches.length !== 1) return;
      const touch = e.touches[0];
      const dx = touch.clientX - startX;
      const dy = touch.clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) {
        hasMoved = true;
      }
      const newLeft = startLeft + dx;
      const newTop = startTop + dy;
      btn.style.left = newLeft + "px";
      btn.style.top = newTop + "px";
      btn.style.right = "auto";
      btn.style.bottom = "auto";
    }, { passive: true });

    btn.addEventListener("touchend", function (e) {
      isDragging = false;
      btn.style.transition = "box-shadow 0.2s";
      if (!hasMoved) {
        openForumWindow();
      }
    }, { passive: true });

    document.body.appendChild(btn);
  }

  function hideFloatingButton() {
    const btn = document.getElementById("night-watch-forum-float-btn");
    if (btn) btn.remove();
  }

  // ====== 论坛窗口（可拖动+可缩放悬浮窗） ======
  function openForumWindow() {
    if (document.getElementById("night-watch-forum-frame")) {
      return;
    }

    // 获取屏幕尺寸
    const screenW = window.innerWidth;
    const screenH = window.innerHeight;

    // 默认大小：屏幕的90%
    let winW = Math.round(screenW * 0.92);
    let winH = Math.round(screenH * 0.85);

    // 默认位置：居中
    let winX = Math.round((screenW - winW) / 2);
    let winY = Math.round((screenH - winH) / 2);

    // 从 localStorage 读取上次位置和大小
    try {
      const saved = JSON.parse(localStorage.getItem("night_watch_forum_win") || "{}");
      if (saved.w) winW = saved.w;
      if (saved.h) winH = saved.h;
      if (typeof saved.x === "number") winX = saved.x;
      if (typeof saved.y === "number") winY = saved.y;
    } catch (e) {}

    const overlay = document.createElement("div");
    overlay.id = "night-watch-forum-frame";
    overlay.style.cssText = `
      position: fixed;
      left: ${winX}px;
      top: ${winY}px;
      width: ${winW}px;
      height: ${winH}px;
      z-index: 99999;
      background: #0c1210;
      display: flex;
      flex-direction: column;
      border: 2px solid #34d399;
      border-radius: 12px;
      overflow: hidden;
      box-shadow: 0 8px 32px rgba(0,0,0,0.6);
    `;

    // ===== 顶栏（可拖动） =====
    const topBar = document.createElement("div");
    topBar.id = "night-watch-forum-dragbar";
    topBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 14px;
      background: #0c1210;
      color: #34d399;
      flex-shrink: 0;
      cursor: move;
      touch-action: none;
      border-bottom: 1px solid #1f3329;
      user-select: none;
      -webkit-user-select: none;
    `;
    topBar.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 16px; font-weight: bold;">守夜人论坛</span>
      </div>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button id="night-watch-forum-sync" style="
          padding: 6px 12px;
          background: #111a14;
          color: #34d399;
          border: 1px solid #34d399;
          cursor: pointer;
          font-size: 12px;
          border-radius: 6px;
        ">同步</button>
        <button id="night-watch-forum-min" style="
          padding: 6px 12px;
          background: #111a14;
          color: #fbbf24;
          border: 1px solid #fbbf24;
          cursor: pointer;
          font-size: 12px;
          border-radius: 6px;
        ">─</button>
        <button id="night-watch-forum-close" style="
          padding: 6px 12px;
          background: #111a14;
          color: #f87171;
          border: 1px solid #f87171;
          cursor: pointer;
          font-size: 12px;
          border-radius: 6px;
        ">✕</button>
      </div>
    `;
    overlay.appendChild(topBar);

    // ===== 缩放手柄（右下角） =====
    const resizeHandle = document.createElement("div");
    resizeHandle.id = "night-watch-forum-resize";
    resizeHandle.style.cssText = `
      position: absolute;
      right: 0;
      bottom: 0;
      width: 24px;
      height: 24px;
      cursor: se-resize;
      touch-action: none;
      z-index: 10;
    `;
    resizeHandle.innerHTML = `<div style="
      position: absolute;
      right: 4px;
      bottom: 4px;
      width: 14px;
      height: 14px;
      border-right: 3px solid #34d399;
      border-bottom: 3px solid #34d399;
      border-radius: 0 0 6px 0;
    "></div>`;
    overlay.appendChild(resizeHandle);

    // ===== iframe：直接打开服务器网站 =====
    const frame = document.createElement("iframe");
    frame.src = settings.apiBaseUrl || "http://43.135.26.183:3000";
    frame.style.cssText = `
      flex: 1;
      width: 100%;
      border: none;
      background: #0c1210;
    `;
    overlay.appendChild(frame);

    document.body.appendChild(overlay);

    // ===== 拖动窗口 =====
    let dragging = false;
    let dragStartX = 0, dragStartY = 0;
    let dragWinX = 0, dragWinY = 0;

    topBar.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      if (e.target.tagName === "BUTTON") return;
      const touch = e.touches[0];
      dragStartX = touch.clientX;
      dragStartY = touch.clientY;
      dragWinX = winX;
      dragWinY = winY;
      dragging = true;
    }, { passive: true });

    topBar.addEventListener("touchmove", function (e) {
      if (!dragging || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartX;
      const dy = touch.clientY - dragStartY;
      winX = dragWinX + dx;
      winY = dragWinY + dy;
      overlay.style.left = winX + "px";
      overlay.style.top = winY + "px";
    }, { passive: false });

    topBar.addEventListener("touchend", function () {
      if (dragging) {
        dragging = false;
        saveWinPos();
      }
    }, { passive: true });

    // ===== 缩放窗口 =====
    let resizing = false;
    let resizeStartW = 0, resizeStartH = 0;
    let resizeStartX = 0, resizeStartY = 0;

    resizeHandle.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      const touch = e.touches[0];
      resizeStartW = winW;
      resizeStartH = winH;
      resizeStartX = touch.clientX;
      resizeStartY = touch.clientY;
      resizing = true;
    }, { passive: true });

    resizeHandle.addEventListener("touchmove", function (e) {
      if (!resizing || e.touches.length !== 1) return;
      e.preventDefault();
      const touch = e.touches[0];
      const dw = touch.clientX - resizeStartX;
      const dh = touch.clientY - resizeStartY;
      winW = Math.max(280, resizeStartW + dw);
      winH = Math.max(300, resizeStartH + dh);
      overlay.style.width = winW + "px";
      overlay.style.height = winH + "px";
    }, { passive: false });

    resizeHandle.addEventListener("touchend", function () {
      if (resizing) {
        resizing = false;
        saveWinPos();
      }
    }, { passive: true });

    function saveWinPos() {
      try {
        localStorage.setItem("night_watch_forum_win", JSON.stringify({
          w: winW, h: winH, x: winX, y: winY
        }));
      } catch (e) {}
    }

    // ===== 按钮事件 =====
    document.getElementById("night-watch-forum-close").addEventListener("click", function () {
      overlay.remove();
    });

    document.getElementById("night-watch-forum-min").addEventListener("click", function () {
      overlay.style.display = "none";
      showRestoreButton();
    });

    document.getElementById("night-watch-forum-sync").addEventListener("click", function () {
      sendTavernContext();
    });

    sendTavernContext();
    console.log("[守夜人论坛] 论坛窗口已打开");
  }

  // ===== 最小化后的恢复按钮 =====
  function showRestoreButton() {
    if (document.getElementById("night-watch-forum-restore")) return;
    const r = document.createElement("div");
    r.id = "night-watch-forum-restore";
    r.textContent = "📖";
    r.style.cssText = `
      position: fixed;
      right: 16px;
      bottom: 60px;
      width: 52px;
      height: 52px;
      border-radius: 50%;
      background: linear-gradient(135deg, #34d399, #1a7f5a);
      color: #fff;
      font-size: 26px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 99998;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      touch-action: none;
    `;
    r.addEventListener("click", function () {
      const frame = document.getElementById("night-watch-forum-frame");
      if (frame) {
        frame.style.display = "flex";
        r.remove();
      }
    });
    document.body.appendChild(r);
  }

  // ====== 同步酒馆上下文 ======
  async function sendTavernContext() {
    try {
      const context = getContextStub();

      const persona = (context && context.name2) ? context.name2 : "未知角色";
      const personaDescription = (context && context.description) ? context.description : "";

      const chat = (context && Array.isArray(context.chat)) ? context.chat : [];
      const recentChat = chat.slice(-20).map(function (item) {
        return {
          role: item.is_user ? "user" : "assistant",
          name: item.name || (item.is_user ? (context.name1 || "玩家") : (context.name2 || "角色")),
          text: item.mes || ""
        };
      });

      const tavernContext = {
        character: {
          name: persona,
          description: personaDescription
        },
        chatHistory: recentChat,
        timestamp: new Date().toISOString()
      };

      window.CassellTavernContext = JSON.stringify(tavernContext);

      const frame = document.getElementById("night-watch-forum-frame");
      if (frame) {
        const innerFrame = frame.querySelector("iframe");
        if (innerFrame && innerFrame.contentWindow) {
          try {
            innerFrame.contentWindow.postMessage({
              type: "tavern-context",
              data: window.CassellTavernContext
            }, "*");
          } catch (e) {}
        }
      }

      console.log("[守夜人论坛] 上下文已同步:", tavernContext.character.name);
    } catch (error) {
      console.error("[守夜人论坛] 同步失败:", error);
    }
  }

  // ====== 启动 ======
  function start() {
    injectPanel();
    if (settings.enabled) {
      setTimeout(showFloatingButton, 2000);
    }
    console.log("[守夜人论坛] 插件已启动");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
