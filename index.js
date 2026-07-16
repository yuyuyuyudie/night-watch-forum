// 守夜人论坛 - 手机版酒馆拓展
;(function () {
  const MODULE_NAME = "night-watch-forum";
  const API_BASE = "http://43.135.26.183:3000";
  const FLOAT_BTN_ICON = "https://i.ibb.co/x8rcFvSv/CASSELL-COLLEGE-gold-only-1.png";

  // 找到真正的聊天页面
  const parentWin = (typeof window.parent !== "undefined" && window.parent !== window) ? window.parent : window;
  const parentDoc = parentWin.document;

  function getContextStub() {
    try {
      return (typeof getContext === "function") ? getContext() : (parentWin.getContext ? parentWin.getContext() : {});
    } catch (e) { return {}; }
  }

  // ====== 酒馆自带提示框 ======
  function notify(msg, type) {
    try {
      const t = parentWin.toastr || (typeof toastr !== "undefined" ? toastr : null);
      if (t) {
        if (type === "error") t.error(msg);
        else if (type === "warning") t.warning(msg);
        else t.success(msg);
        return;
      }
    } catch (e) {}

    const toast = parentDoc.createElement("div");
    toast.textContent = msg;
    toast.style.cssText = `
      position: fixed; top: 20px; left: 50%; transform: translateX(-50%);
      padding: 12px 24px; border-radius: 8px; font-size: 14px; font-weight: bold;
      z-index: 2147483647; color: #34d399; background: #1a2a1e;
      border: 1px solid #34d399; box-shadow: 0 4px 16px rgba(0,0,0,0.5);
      pointer-events: none; opacity: 0; transition: opacity 0.3s; max-width: 90vw;
    `;
    parentDoc.body.appendChild(toast);
    setTimeout(function() { toast.style.opacity = "1"; }, 10);
    setTimeout(function() {
      toast.style.opacity = "0";
      setTimeout(function() { if (toast.parentNode) toast.remove(); }, 300);
    }, 2500);
  }

  // ====== 设置存储 ======
  function loadSettings() {
    try {
      const raw = parentWin.localStorage.getItem("night_watch_forum_settings");
      if (raw) return JSON.parse(raw);
    } catch (e) {}
    return {};
  }

  function saveSettings(s) {
    try {
      parentWin.localStorage.setItem("night_watch_forum_settings", JSON.stringify(s));
    } catch (e) {}
  }

  let settings = loadSettings();
  if (!settings.apiBaseUrl) settings.apiBaseUrl = API_BASE;
  if (typeof settings.auto_send_context !== "boolean") settings.auto_send_context = true;
  settings.enabled = true;
  saveSettings(settings);

  // ====== 默认按钮大小 ======
  const DEFAULT_BTN_SIZE = 60;
  if (!settings.btnSize) settings.btnSize = DEFAULT_BTN_SIZE;
  saveSettings(settings);

  // ====== 注入设置面板 ======
  function injectPanel() {
    if (parentDoc.getElementById(MODULE_NAME + "_settings")) return;

    const host = parentDoc.getElementById("extensions_settings");
    if (!host) {
      setTimeout(injectPanel, 1000);
      return;
    }

    const wrap = parentDoc.createElement("div");
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
              <div style="margin-bottom:8px;font-size:13px;color:#c9a227;">悬浮按钮大小：<span id="${MODULE_NAME}_size_label">${settings.btnSize}px</span></div>
              <div style="display:flex;align-items:center;gap:10px;">
                <input type="range" id="${MODULE_NAME}_size_slider" min="40" max="120" step="5" value="${settings.btnSize}" style="flex:1;">
                <button id="${MODULE_NAME}_apply_size" class="menu_button" style="padding:4px 12px;">应用</button>
              </div>
              <div id="${MODULE_NAME}_test_btn" class="menu_button" style="width:100%;margin-top:10px;text-align:center;background:#1a2a1e;color:#c9a227;border:1px solid #c9a227;">🔄 重新显示悬浮按钮</div>
            </div>

          </div>
        </div>
      </div>
    `;
    host.appendChild(wrap);

    parentDoc.getElementById(MODULE_NAME + "_open_btn").addEventListener("click", function () {
      openForumWindow();
    });

    parentDoc.getElementById(MODULE_NAME + "_send_context_btn").addEventListener("click", function () {
      sendTavernContext();
      notify("已同步上下文");
    });

    parentDoc.getElementById(MODULE_NAME + "_test_btn").addEventListener("click", function () {
      hideFloatingButton();
      showFloatingButton();
      const btn = parentDoc.getElementById("night-watch-forum-float-btn");
      if (btn) {
        notify("悬浮按钮已重新显示");
      } else {
        notify("按钮创建失败", "error");
      }
    });

    parentDoc.getElementById(MODULE_NAME + "_size_slider").addEventListener("input", function () {
      parentDoc.getElementById(MODULE_NAME + "_size_label").textContent = this.value + "px";
    });

    parentDoc.getElementById(MODULE_NAME + "_apply_size").addEventListener("click", function () {
      const size = parseInt(parentDoc.getElementById(MODULE_NAME + "_size_slider").value) || DEFAULT_BTN_SIZE;
      settings.btnSize = size;
      saveSettings(settings);
      hideFloatingButton();
      showFloatingButton();
      notify("按钮大小已更新为 " + size + "px");
    });

    parentDoc.getElementById(MODULE_NAME + "_api_url").addEventListener("change", function () {
      settings.apiBaseUrl = this.value.trim() || API_BASE;
      saveSettings(settings);
    });

    parentDoc.getElementById(MODULE_NAME + "_auto_context").addEventListener("change", function () {
      settings.auto_send_context = this.checked;
      saveSettings(settings);
      notify(this.checked ? "自动同步已开启" : "自动同步已关闭", this.checked ? "" : "warning");
    });

    parentDoc.getElementById(MODULE_NAME + "_enabled").addEventListener("change", function () {
      settings.enabled = this.checked;
      saveSettings(settings);
      if (this.checked) {
        showFloatingButton();
        notify("论坛悬浮按钮已开启");
      } else {
        hideFloatingButton();
        notify("论坛悬浮按钮已关闭", "warning");
      }
    });

    console.log("[守夜人论坛] 设置面板已注入");
  }

  // ====== 悬浮按钮（初次出现在屏幕中间偏右，可拖动） ======
  function showFloatingButton() {
    if (parentDoc.getElementById("night-watch-forum-float-btn")) return;

    const size = settings.btnSize || DEFAULT_BTN_SIZE;

    // 检查有没有保存的位置
    let savedPos = null;
    try {
      const saved = parentWin.localStorage.getItem("night_watch_forum_btn_pos");
      if (saved) savedPos = JSON.parse(saved);
    } catch (e) {}

    let btnX, btnY;
    if (savedPos && typeof savedPos.x === "number" && typeof savedPos.y === "number") {
      // 用保存的位置
      btnX = savedPos.x;
      btnY = savedPos.y;
    } else {
      // 初次：屏幕中间偏右
      btnX = parentWin.innerWidth - size - 20;
      btnY = Math.round(parentWin.innerHeight / 2 - size / 2);
    }

    const btn = parentDoc.createElement("div");
    btn.id = "night-watch-forum-float-btn";
    btn.title = "守夜人论坛";
    btn.innerHTML = `<img src="${FLOAT_BTN_ICON}" style="width:100%;height:100%;object-fit:contain;border-radius:50%;pointer-events:none;">`;
    btn.style.cssText = `
      position: fixed;
      left: ${btnX}px;
      top: ${btnY}px;
      width: ${size}px;
      height: ${size}px;
      border-radius: 50%;
      background: rgba(12, 18, 16, 0.9);
      border: 2px solid #c9a227;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 2147483647;
      box-shadow: 0 4px 14px rgba(0,0,0,0.5);
      user-select: none;
      -webkit-user-select: none;
      touch-action: none;
      padding: 4px;
      overflow: hidden;
    `;

    let isDragging = false;
    let startX = 0, startY = 0;
    let startLeft = 0, startTop = 0;
    let hasMoved = false;

    function onStart(clientX, clientY) {
      startLeft = btnX;
      startTop = btnY;
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
      btnX = Math.max(0, Math.min(parentWin.innerWidth - size, startLeft + dx));
      btnY = Math.max(0, Math.min(parentWin.innerHeight - size, startTop + dy));
      btn.style.left = btnX + "px";
      btn.style.top = btnY + "px";
    }

    function onEnd() {
      if (!isDragging) return;
      isDragging = false;
      btn.style.transition = "box-shadow 0.2s";
      if (hasMoved) {
        // 拖动了就保存位置
        try {
          parentWin.localStorage.setItem("night_watch_forum_btn_pos", JSON.stringify({ x: btnX, y: btnY }));
        } catch (e) {}
      } else {
        // 没拖动，打开论坛
        openForumWindow();
      }
    }

    function handleStart(e) {
      if (e.touches && e.touches.length !== 1) return;
      if (e.touches) onStart(e.touches[0].clientX, e.touches[0].clientY);
      else onStart(e.clientX, e.clientY);
    }

    function handleMove(e) {
      if (e.touches && e.touches.length !== 1) return;
      if (e.touches) onMove(e.touches[0].clientX, e.touches[0].clientY);
      else onMove(e.clientX, e.clientY);
    }

    btn.addEventListener("touchstart", handleStart, { passive: true });
    btn.addEventListener("touchmove", handleMove, { passive: true });
    btn.addEventListener("touchend", onEnd, { passive: true });
    btn.addEventListener("mousedown", function(e) {
      e.preventDefault();
      handleStart(e);
      function mm(ev) { handleMove(ev); }
      function mu() {
        parentDoc.removeEventListener("mousemove", mm);
        parentDoc.removeEventListener("mouseup", mu);
        onEnd();
      }
      parentDoc.addEventListener("mousemove", mm);
      parentDoc.addEventListener("mouseup", mu);
    });

    parentDoc.body.appendChild(btn);
    console.log("[守夜人论坛] 悬浮按钮已显示，位置:", btnX, btnY, "大小:", size);
  }

  function hideFloatingButton() {
    const btn = parentDoc.getElementById("night-watch-forum-float-btn");
    if (btn) btn.remove();
  }

  // ====== 打开论坛窗口（居中） ======
  function openForumWindow() {
    const existing = parentDoc.getElementById("night-watch-forum-frame");
    if (existing) {
      existing.style.display = "flex";
      const restore = parentDoc.getElementById("night-watch-forum-restore");
      if (restore) restore.remove();
      return;
    }

    const screenW = parentWin.innerWidth;
    const screenH = parentWin.innerHeight;
    const winW = Math.round(screenW * 0.96);
    const winH = Math.round(screenH * 0.88);
    const winX = Math.round((screenW - winW) / 2);
    const winY = Math.round((screenH - winH) / 2);

    const overlay = parentDoc.createElement("div");
    overlay.id = "night-watch-forum-frame";
    overlay.style.cssText = `
      position: fixed;
      left: ${winX}px;
      top: ${winY}px;
      width: ${winW}px;
      height: ${winH}px;
      z-index: 2147483646;
      background: #0c1210;
      display: flex;
      flex-direction: column;
      border: none;
      border-radius: 0;
      overflow: hidden;
    `;

    const topBar = parentDoc.createElement("div");
    topBar.id = "night-watch-forum-dragbar";
        topBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 8px 12px;
      background: #0c1210;
      color: #34d399;
      flex-shrink: 0;
      cursor: move;
      touch-action: none;
      border-bottom: 1px solid #1a2a1e;
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

    const resizeHandle = parentDoc.createElement("div");
    resizeHandle.id = "night-watch-forum-resize";
    resizeHandle.style.cssText = `
      position: absolute; right: 0; bottom: 0; width: 24px; height: 24px;
      cursor: se-resize; touch-action: none; z-index: 10;
    `;
    resizeHandle.innerHTML = `<div style="position:absolute;right:4px;bottom:4px;width:14px;height:14px;border-right:3px solid #34d399;border-bottom:3px solid #34d399;border-radius:0 0 6px 0;"></div>`;
    overlay.appendChild(resizeHandle);

    const frame = parentDoc.createElement("iframe");
    frame.src = settings.apiBaseUrl || API_BASE;
    frame.style.cssText = `flex:1;width:100%;border:none;background:#0c1210;`;
    overlay.appendChild(frame);

    parentDoc.body.appendChild(overlay);

    let curX = winX, curY = winY, curW = winW, curH = winH;

    let dragging = false;
    let dragStartX = 0, dragStartY = 0, dragWinX = 0, dragWinY = 0;

    topBar.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1 || e.target.tagName === "BUTTON") return;
      const t = e.touches[0];
      dragStartX = t.clientX; dragStartY = t.clientY;
      dragWinX = curX; dragWinY = curY;
      dragging = true;
    }, { passive: true });

    topBar.addEventListener("touchmove", function (e) {
      if (!dragging || e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      curX = dragWinX + (t.clientX - dragStartX);
      curY = dragWinY + (t.clientY - dragStartY);
      overlay.style.left = curX + "px";
      overlay.style.top = curY + "px";
    }, { passive: false });

    topBar.addEventListener("touchend", function () {
      dragging = false;
    }, { passive: true });

    let resizing = false;
    let resizeStartW = 0, resizeStartH = 0, resizeStartX = 0, resizeStartY = 0;

    resizeHandle.addEventListener("touchstart", function (e) {
      if (e.touches.length !== 1) return;
      e.stopPropagation();
      const t = e.touches[0];
      resizeStartW = curW; resizeStartH = curH;
      resizeStartX = t.clientX; resizeStartY = t.clientY;
      resizing = true;
    }, { passive: true });

    resizeHandle.addEventListener("touchmove", function (e) {
      if (!resizing || e.touches.length !== 1) return;
      e.preventDefault();
      const t = e.touches[0];
      curW = Math.max(280, resizeStartW + (t.clientX - resizeStartX));
      curH = Math.max(300, resizeStartH + (t.clientY - resizeStartY));
      overlay.style.width = curW + "px";
      overlay.style.height = curH + "px";
    }, { passive: false });

    resizeHandle.addEventListener("touchend", function () {
      resizing = false;
    }, { passive: true });

    parentDoc.getElementById("night-watch-forum-close").addEventListener("click", function () {
      overlay.remove();
    });

    parentDoc.getElementById("night-watch-forum-min").addEventListener("click", function () {
      overlay.style.display = "none";
      showRestoreButton();
    });

    parentDoc.getElementById("night-watch-forum-sync").addEventListener("click", function () {
      sendTavernContext();
    });

    sendTavernContext();
    notify("论坛已打开");
    console.log("[守夜人论坛] 论坛窗口已打开");
  }

  function showRestoreButton() {
    if (parentDoc.getElementById("night-watch-forum-restore")) return;
    const size = settings.btnSize || DEFAULT_BTN_SIZE;
    const r = parentDoc.createElement("div");
    r.id = "night-watch-forum-restore";
    r.innerHTML = `<img src="${FLOAT_BTN_ICON}" style="width:100%;height:100%;object-fit:contain;border-radius:50%;pointer-events:none;">`;
    r.style.cssText = `
      position: fixed; right: 16px; bottom: 80px; width: ${size}px; height: ${size}px;
      border-radius: 50%; background: rgba(12, 18, 16, 0.9);
      border: 2px solid #c9a227; padding: 4px; overflow: hidden;
      cursor: pointer; z-index: 2147483647;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
    `;
    r.addEventListener("click", function () {
      const frame = parentDoc.getElementById("night-watch-forum-frame");
      if (frame) {
        frame.style.display = "flex";
        r.remove();
      }
    });
    parentDoc.body.appendChild(r);
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

      parentWin.CassellTavernContext = JSON.stringify(tavernContext);

      const frame = parentDoc.getElementById("night-watch-forum-frame");
      if (frame) {
        const innerFrame = frame.querySelector("iframe");
        if (innerFrame && innerFrame.contentWindow) {
          try {
            innerFrame.contentWindow.postMessage({
              type: "tavern-context",
              data: parentWin.CassellTavernContext
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
      notify("守夜人论坛已启动");
    }, 1500);
    console.log("[守夜人论坛] 插件已启动");
  }

  if (parentDoc.readyState === "loading") {
    parentDoc.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
