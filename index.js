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

  // ====== 注入设置面板（酒馆标准折叠格式） ======
  function injectPanel() {
    if (document.getElementById(MODULE_NAME + "_settings")) return;

    const host = document.getElementById("extensions_settings");
    if (!host) {
      setTimeout(injectPanel, 1000);
      return;
    }

    // 酒馆标准折叠头
    const header = document.createElement("div");
    header.className = "extension_container";
    header.id = MODULE_NAME + "_settings";
    header.innerHTML = `
      <div class="extension_container_header" onclick="this.parentElement.classList.toggle('collapsed')">
        <span class="extension_container_title">守夜人论坛 Night Watch Forum</span>
        <span class="extension_container_collapse_icon"></span>
      </div>
      <div class="extension_container_body">
        <!-- 折叠头下面的内容 -->
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
      </div>
    `;
    host.appendChild(header);

    // 按钮事件
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
  }

  // ====== 聊天页悬浮按钮 ======
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
      width: 48px;
      height: 48px;
      border-radius: 50%;
      background: linear-gradient(135deg, #34d399, #1a7f5a);
      color: #fff;
      font-size: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      z-index: 99998;
      box-shadow: 0 4px 12px rgba(0,0,0,0.4);
      user-select: none;
      -webkit-user-select: none;
    `;

    btn.addEventListener("click", function () {
      openForumWindow();
    });

    document.body.appendChild(btn);
  }

  function hideFloatingButton() {
    const btn = document.getElementById("night-watch-forum-float-btn");
    if (btn) btn.remove();
  }

  // ====== 打开论坛窗口 ======
  function openForumWindow() {
    let existing = document.getElementById("night-watch-forum-frame");
    if (existing) {
      existing.remove();
      return;
    }

    const overlay = document.createElement("div");
    overlay.id = "night-watch-forum-frame";
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      z-index: 99999;
      background: rgba(0,0,0,0.85);
      display: flex;
      flex-direction: column;
    `;

    // 顶栏
    const topBar = document.createElement("div");
    topBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      background: #0c1210;
      color: #34d399;
      flex-shrink: 0;
    `;
    topBar.innerHTML = `
      <span style="font-size: 15px; font-weight: bold;">守夜人论坛</span>
      <div style="display: flex; gap: 8px;">
        <button id="night-watch-forum-sync" style="
          padding: 6px 14px;
          background: #111a14;
          color: #34d399;
          border: 1px solid #34d399;
          cursor: pointer;
          font-size: 12px;
        ">同步</button>
        <button id="night-watch-forum-close" style="
          padding: 6px 14px;
          background: #111a14;
          color: #f87171;
          border: 1px solid #f87171;
          cursor: pointer;
          font-size: 12px;
        ">✕</button>
      </div>
    `;
    overlay.appendChild(topBar);

    const frame = document.createElement("iframe");
    frame.src = "index.html";
    frame.style.cssText = `
      flex: 1;
      width: 100%;
      border: none;
      background: #0c1210;
    `;
    overlay.appendChild(frame);

    document.body.appendChild(overlay);

    document.getElementById("night-watch-forum-close").addEventListener("click", function () {
      overlay.remove();
    });

    document.getElementById("night-watch-forum-sync").addEventListener("click", function () {
      sendTavernContext();
    });

    sendTavernContext();

    console.log("[守夜人论坛] 论坛窗口已打开");
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
            innerFrame.contentWindow.CassellTavernContext = window.CassellTavernContext;
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
