// 守夜人论坛 - 手机版酒馆拓展
;(function () {
  const MODULE_NAME = "night-watch-forum";
  const API_BASE = "http://43.135.26.183:3000";

  // 安全区：如果内部若找不到函数就用空代替
  let saveSettingsDebounced = function () {};
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
      // 找不到就等会儿再试
      setTimeout(injectPanel, 1000);
      return;
    }

    const div = document.createElement("div");
    div.id = MODULE_NAME + "_settings";
    div.className = "extension_container";
    div.innerHTML = `
      <hr>
      <div class="extension_setting_block">
        <h4>守夜人论坛 Night Watch Forum</h4>
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
            启用论坛按钮
          </label>
        </div>
        <hr>
        <button id="${MODULE_NAME}_open_btn" class="menu_button">打开守夜人论坛</button>
        <button id="${MODULE_NAME}_send_context_btn" class="menu_button">立即同步酒馆上下文</button>
      </div>
    `;
    host.appendChild(div);

    // 按钮事件
    document.getElementById(MODULE_NAME + "_open_btn").addEventListener("click", function () {
      openForumWindow();
    });

    document.getElementById(MODULE_NAME + "_send_context_btn").addEventListener("click", function () {
      sendTavernContext();
    });

    // 设置变化
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
    });

    console.log("[守夜人论坛] 设置面板已注入");
  }

  // ====== 打开论坛窗口 ======
  function openForumWindow() {
    let existing = document.getElementById("night-watch-forum-frame");
    if (existing) {
      existing.style.display = "flex";
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

    const topBar = document.createElement("div");
    topBar.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      padding: 10px 16px;
      background: #0c1210;
      color: #34d399;
      font-family: monospace;
      flex-shrink: 0;
      font-size: 14px;
    `;
    topBar.innerHTML = `
      <strong>守夜人论坛</strong>
      <button id="night-watch-forum-close" style="
        padding: 6px 14px;
        background: #111a14;
        color: #34d399;
        border: 1px solid #34d399;
        cursor: pointer;
        font-size: 13px;
      ">✕ 关闭</button>
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
      overlay.style.display = "none";
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

      // 传给 iframe
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
    console.log("[守夜人论坛] 插件已启动");
  }

  // 等页面加载完再启动
  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", start);
  } else {
    start();
  }
})();
