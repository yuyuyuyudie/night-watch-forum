// 守夜人论坛 - 手机版酒馆拓展
;(function () {
  const MODULE_NAME = "night-watch-forum";
  const API_BASE = "http://43.135.26.183:3000";
  const FLOAT_BTN_ICON = "https://i.ibb.co/x8rcFvSv/CASSELL-COLLEGE-gold-only-1.png";

  function getContextStub() {
    return (typeof getContext === "function") ? getContext() : {};
  }

  // ====== 设置存储 ======
  function loadSettings() {
    try {
      const raw = localStorage.getItem("night_watch_forum_settings");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function saveSettings(s) {
    try {
      localStorage.setItem("night_watch_forum_settings", JSON.stringify(s));
    } catch (e) {}
  }

  let settings = loadSettings();
  if (!settings.apiBaseUrl) settings.apiBaseUrl = API_BASE;
  if (typeof settings.auto_send_context !== "boolean") settings.auto_send_context = true;
  settings.enabled = true;
  saveSettings(settings);

  // ====== 弹出提示框 ======
  function showToast(msg, bg, fg) {
    const toast = document.createElement("div");
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 14px 24px;
      border-radius: 10px;
      font-size: 15px;
      font-weight: bold;
      z-index: 2147483647;
      background: ${bg || "#0c1210"};
      color: ${fg || "#34d399"};
      border: 2px solid ${fg || "#34d399"};
      box-shadow: 0 4px 20px rgba(0,0,0,0.6);
      pointer-events: none;
      opacity: 0;
      transition: opacity 0.3s ease;
      max-width: 90vw;
      text-align: center;
      white-space: nowrap;
    `;
    document.body.appendChild(toast);

    setTimeout(function() {
      toast.style.opacity = "1";
    }, 10);

    setTimeout(function() {
      toast.style.opacity = "0";
      setTimeout(function() {
        if (toast.parentNode) toast.remove();
      }, 300);
    }, 2500);
  }

  // ====== 注入设置面板 ======
  function injectPanel() {
    if (document.getElementById(MODULE_NAME + "_settings")) return;

    const host = document.getElementById("extensions_settings");
    if (!host) {
      setTimeout(injectPanel, 1000);
      return;
    }

    const wrap = document.createElement("div");
    wrap.id = MODULE_NAME + "_settings";
    wrap.className = "extension_container";
    wrap.innerHTML = `
      <div class="inline-drawer">
        <div class="inline-drawer-toggle inline-drawer-header">
          <b>守夜人论坛</b>
          <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
          <div class="extension_setting_block" style="padding: 10px 4px;">

            <div id="${MODULE_NAME}_api_row" style="display:none; margin-bottom: 10px;">
              <small style="opacity:0.7;">后端地址（一般不用改）</small>
              <input type="text" id="${MODULE_NAME}_api_url" class="text_pole"
                placeholder="后端地址" value="${settings.apiBaseUrl}">
            </div>

            <label class="checkbox_label" style="display:flex;align-items:center;gap:8px;margin:10px 0;line-height:1.4;">
              <input type="checkbox" id="${MODULE_NAME}_auto_context" ${settings.auto_send_context ? "checked" : ""} style="flex-shrink:0;">
              <span>自动同步酒馆上下文到论坛</span>
            </label>

            <label class="checkbox_label" style="display:flex;align-items:center;gap:8px;margin:10px 0;line-height:1.4;">
              <input type="checkbox" id="${MODULE_NAME}_enabled" ${settings.enabled ? "checked" : ""} style="flex-shrink:0;">
              <span>启用论坛悬浮按钮</span>
            </label>

            <div style="display:flex;gap:10px;margin-top:12px;flex-wrap:wrap;">
              <div id="${MODULE_NAME}_open_btn" class="menu_button" style="flex:1;min-width:120px;text-align:center;">打开守夜人论坛</div>
              <div id="${MODULE_NAME}_send_context_btn" class="menu_button" style="flex:1;min-width:120px;text-align:center;">立即同步上下文</div>
            </div>

            <div style="margin-top:14px;padding-top:10px;border-top:1px dashed rgba(255,255,255,0.2);">
              <div id="${MODULE_NAME}_test_btn" class="menu_button" style="width:100%;text-align:center;background:#1a2a1e;color:#c9a227;border:1px solid #c9a227;">🔧 测试悬浮按钮（点这里）</div>
            </div>

          </div>
        </div>
      </div>
    `;
    host.appendChild(wrap);

    document.getElementById(MODULE_NAME + "_open_btn").addEventListener("click", function () {
      openForumWindow();
    });

    document.getElementById(MODULE_NAME + "_send_context_btn").addEventListener("click", function () {
      sendTavernContext();
      showToast("已同步上下文", "#0c1210", "#34d399");
    });

    document.getElementById(MODULE_NAME + "_test_btn").addEventListener("click", function () {
      hideFloatingButton();
      showFloatingButton();
      const btn = document.getElementById("night-watch-forum-float-btn");
      if (btn) {
        showToast("测试：悬浮按钮已创建，应该在右下角", "#0c1210", "#34d399");
      } else {
        showToast("测试：按钮创建失败", "#0c1210", "#f87171");
      }
    });

    document.getElementById(MODULE_NAME + "_api_url").addEventListener("change", function () {
      settings.apiBaseUrl = this.value.trim() || API_BASE;
      saveSettings(settings);
    });

    document.getElementById(MODULE_NAME + "_auto_context").addEventListener("change", function () {
      settings.auto_send_context = this.checked;
      saveSettings(settings);
      showToast(this.checked ? "自动同步已开启" : "自动同步已关闭", "#0c1210", this.checked ? "#34d399" : "#f59e0b");
    });

    document.getElementById(MODULE_NAME + "_enabled").addEventListener("change", function () {
      settings.enabled = this.checked;
      saveSettings(settings);
      if (this.checked) {
        showFloatingButton();
        showToast("论坛悬浮按钮已开启，回聊天页看右下角", "#0c1210", "#34d399");
      } else {
        hideFloatingButton();
        showToast("论坛悬浮按钮已关闭", "#0c1210", "#f59e0b");
      }
    });

    console.log("[守夜人论坛] 设置面板已注入");
  }

  // ====== 悬浮按钮 ======
  function showFloatingButton() {
    if (document.getElementById("night-watch-forum-float-btn")) return;

    const btn = document.createElement("div");
    btn.id = "night-watch-forum-float-btn";
    btn.title = "守夜人论坛";
    btn.innerHTML = `<img src="${FLOAT_BTN_ICON}" style="width:100%;height:100%;object-fit:contain;border-radius:50%;pointer-events:none;">`;
    btn.style.cssText = `
      position: fixed;
      right: 14px;
      bottom: 160px;
      width: 60px;
      height: 60px;
      border-radius: 50%;
      background: rgba(12, 18, 16, 0.9);
      border: 2px solid #c9a227;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2147483000;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      padding: 5px;
      overflow: hidden;
    `;

    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;
    let hasMoved = false;

    function onStart(clientX, clientY) {
      const rect = btn.getBoundingClientRect();
      startLeft = rect.left;
      startTop = rect.top;
      startX = clientX;
      startY = clientY;
      isDragging = true;
      hasMoved = false;
      btn.style.transition = "none";
    }

    function onMove(clientX, clientY) {
      if (!isDragging) return;
      const dx = clientX - startX;
      const dy = clientY - startY;
      if (Math.abs(dx) > 5 || Math.abs(dy) > 5) hasMoved = true;
      btn.style.left = (startLeft + dx) + "px";
      btn.style.top = (startTop + dy) + "px";
      btn.style.right = "auto";
      btn.style.bottom = "auto";
    }

    function onEnd() {
      if (!isDragging) return;
      isDragging = false;
      btn.style.transition = "box-shadow 0.2s";
      if (!hasMoved) openForumWindow();
    }

    btn.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      onStart(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    btn.addEventListener("touchmove", function (e) {
      if (e.touches.length !== 1) return;
      onMove(e.touches[0].clientX, e.touches[0].clientY);
    }, { passive: true });

    btn.addEventListener("touchend", function () {
      onEnd();
    }, { passive: true });

    btn.addEventListener("mousedown", function (e) {
      e.preventDefault();
      onStart(e.clientX, e.clientY);
      function mm(ev) { onMove(ev.clientX, ev.clientY); }
      function mu() {
        document.removeEventListener("mousemove", mm);
        document.removeEventListener("mouseup", mu);
        onEnd();
      }
      document.addEventListener("mousemove", mm);
      document.addEventListener("mouseup", mu);
    });

    document.body.appendChild(btn);
    console.log("[守夜人论坛] 悬浮按钮已显示");
  }

  function hideFloatingButton() {
    const btn = document.getElementById("night-watch-forum-float-btn");
    if (btn) btn.remove();
  }

  // ====== 打开论坛窗口 ======
  function openForumWindow() {
    const existing = document.getElementById("night-watch-forum-frame");
    if (existing) {
      existing.style.display = "flex";
      const restore = document.getElementById("night-watch-forum-restore");
      if (restore) restore.remove();
      return;
    }

    const screenW = window.innerWidth;
    const screenH = window.innerHeight;
    let winW = Math.round(screenW * 0.96);
    let winH = Math.round(screenH * 0.88);
    let winX = Math.round((screenW - winW) / 2);
    let winY = Math.round((screenH - winH) / 2);

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
      <span style="font-size: 15px; font-weight: bold;">守夜人论坛</span>
      <div style="display: flex; gap: 8px; align-items: center;">
        <button id="night-watch-forum-sync" style="padding:6px 12px;background:#111a14;color:#34d399;border:1px solid #34d399;border-radius:6px;font-size:12px;cursor:pointer;">同步</button>
        <button id="night-watch-forum-min" style="padding:6px 12px;background:#111a14;color:#fbbf24;border:1px solid #fbbf24;border-radius:6px;font-size:12px;cursor:pointer;">─</button>
        <button id="night-watch-forum-close" style="padding:6px 12px;background:#111a14;color:#f87171;border:1px solid #f87171;border-radius:6px;font-size:12px;cursor:pointer;">✕</button>
      </div>
    `;
    overlay.appendChild(topBar);

    const resizeHandle = document.createElement("div");
    resizeHandle.id = "night-watch-forum-resize";
    resizeHandle.style.cssText = `
      position: absolute; right: 0; bottom: 0; width: 24px; height: 24px;
      cursor: se-resize; touch-action: none; z-index: 10;
    `;
    resizeHandle.innerHTML = `<div style="position:absolute;right:4px;bottom:4px;width:14px;height:14px;border-right:3px solid #34d399;border-bottom:3px solid #34d399;border-radius:0 0 6px 0;"></div>`;
    overlay.appendChild(resizeHandle);

    const frame = document.createElement("iframe");
    frame.src = settings.apiBaseUrl || API_BASE;
    frame.style.cssText = `flex:1;width:100%;border:none;background:#0c1210;`;
    overlay.appendChild(frame);

    document.body.appendChild(overlay);

    let dragging = false;
    let dragStartX = 0, dragStartY = 0, dragWinX = 0, dragWinY = 0;

    topBar.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1 || e.target.tagName === "BUTTON") return;
      const t = e.touches[0];
      dragStartX = t.clientX; dragStartY = t.clientY;
      dragWinX = winX; dragWinY = winY;
      dragging = true;
    }, { passive: true });

    topBar.addEventListener("touchmove", function (e) {
      if (!dragging || e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      winX = dragWinX + (t.clientX - dragStartX);
      winY = dragWinY + (t.clientY - dragStartY);
      overlay.style.left = winX + "px";
      overlay.style.top = winY + "px";
    }, { passive: false });

    topBar.addEventListener("touchend", function () {
      if (dragging) { dragging = false; saveWinPos(); }
    }, { passive: true });

    let resizing = false;
    let resizeStartW = 0, resizeStartH = 0, resizeStartX = 0, resizeStartY = 0;

    resizeHandle.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      const t = e.touches[0];
      resizeStartW = winW; resizeStartH = winH;
      resizeStartX = t.clientX; resizeStartY = t.clientY;
      resizing = true;
    }, { passive: true });

    resizeHandle.addEventListener("touchmove", function (e) {
      if (!resizing || e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      winW = Math.max(280, resizeStartW + (t.clientX - resizeStartX));
      winH = Math.max(300, resizeStartH + (t.clientY - resizeStartY));
      overlay.style.width = winW + "px";
      overlay.style.height = winH + "px";
    }, { passive: false });

    resizeHandle.addEventListener("touchend", function () {
      if (resizing) { resizing = false; saveWinPos(); }
    }, { passive: true });

    function saveWinPos() {
      try {
        localStorage.setItem("night_watch_forum_win", JSON.stringify({ w: winW, h: winH, x: winX, y: winY }));
      } catch (e) {}
    }

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
    showToast("论坛已打开", "#0c1210", "#34d399");
    console.log("[守夜人论坛] 论坛窗口已打开");
  }

  function showRestoreButton() {
    if (document.getElementById("night-watch-forum-restore")) return;
    const r = document.createElement("div");
    r.id = "night-watch-forum-restore";
    r.innerHTML = `<img src="${FLOAT_BTN_ICON}" style="width:100%;height:100%;object-fit:contain;border-radius:50%;pointer-events:none;">`;
    r.style.cssText = `
      position: fixed; right: 16px; bottom: 80px; width: 56px; height: 56px;
      border-radius: 50%; background: rgba(12, 18, 16, 0.9);
      border: 2px solid #c9a227; padding: 5px; overflow: hidden;
      cursor: pointer; z-index: 2147483000;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
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

  // ====== 同步上下文 ======
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
        character: { name: persona, description: personaDescription },
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
    setTimeout(showFloatingButton, 500);
    setTimeout(showFloatingButton, 1500);
    setTimeout(showFloatingButton, 3000);
    setTimeout(showFloatingButton, 5000);
    setTimeout(function() {
      showToast("守夜人论坛已启动", "#0c1210", "#34d399");
    }, 1500);
    console.log("[守夜人论坛] 插件已启动");
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
