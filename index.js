import { getContext, extension_settings, ModuleWorkerWrapper } from "../../extensions.js";
import { saveSettingsDebounced } from "../../../script.js";
import { renderExtensionTemplateAsync } from "../../../extensions.js";

const MODULE_NAME = "night-watch-forum";

// 记录设置
const defaultSettings = {
  enabled: true,
  auto_send_context: true,
  apiBaseUrl: "http://43.135.26.183:3000"
};

function loadSettings() {
  extension_settings[MODULE_NAME] = extension_settings[MODULE_NAME] || {};
  if (Object.keys(extension_settings[MODULE_NAME]).length === 0) {
    Object.assign(extension_settings[MODULE_NAME], defaultSettings);
  }
  Object.assign(defaultSettings, extension_settings[MODULE_NAME]);
}

// ====== 在酒馆"拓展设置"面板里显示设置区域 ======
jQuery(() => {
  loadSettings();

  $("#extensions_settings").append(
    `<div id="${MODULE_NAME}_settings" class="extension_container">
      <hr>
      <div class="extension_setting_block">
        <h4>守夜人论坛 Night Watch Forum</h4>
        <div class="flex-container">
          <input type="text" id="${MODULE_NAME}_api_url" class="text_pole" 
            placeholder="后端API地址" value="${defaultSettings.apiBaseUrl}">
        </div>
        <div>
          <label class="checkbox_label">
            <input type="checkbox" id="${MODULE_NAME}_auto_context" ${defaultSettings.auto_send_context ? "checked" : ""}>
            自动同步酒馆上下文到论坛
          </label>
        </div>
        <div>
          <label class="checkbox_label">
            <input type="checkbox" id="${MODULE_NAME}_enabled" ${defaultSettings.enabled ? "checked" : ""}>
            启用论坛按钮
          </label>
        </div>
        <hr>
        <button id="${MODULE_NAME}_open_btn" class="menu_button">打开守夜人论坛</button>
        <button id="${MODULE_NAME}_send_context_btn" class="menu_button">立即同步酒馆上下文</button>
      </div>
    </div>`
  );

  // ====== 按钮事件 ======
  $(document).on("click", `#${MODULE_NAME}_open_btn`, function () {
    openForumWindow();
  });

  $(document).on("click", `#${MODULE_NAME}_send_context_btn`, function () {
    sendTavernContext();
  });

  // 同步设置勾选框和输入框
  $(document).on("change", `#${MODULE_NAME}_auto_context`, function () {
    extension_settings[MODULE_NAME].auto_send_context = !!$(this).prop("checked");
    saveSettingsDebounced();
  });

  $(document).on("change", `#${MODULE_NAME}_enabled`, function () {
    extension_settings[MODULE_NAME].enabled = !!$(this).prop("checked");
    saveSettingsDebounced();
  });

  $(document).on("change", `#${MODULE_NAME}_api_url`, function () {
    const val = String($(this).val() || "").trim();
    extension_settings[MODULE_NAME].apiBaseUrl = val;
    defaultSettings.apiBaseUrl = val;
    saveSettingsDebounced();
  });

  // ====== 酒馆每次发消息时自动同步上下文 ======
  eventSource.on(event_types.MESSAGE_SENT, function () {
    if (defaultSettings.auto_send_context) {
      sendTavernContext();
    }
  });

  eventSource.on(event_types.MESSAGE_RECEIVED, function () {
    if (defaultSettings.auto_send_context) {
      sendTavernContext();
    }
  });

  console.log("[守夜人论坛] 插件已加载");
});

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
    padding: 8px 16px;
    background: #0c1210;
    color: #34d399;
    font-family: monospace;
    flex-shrink: 0;
  `;
  topBar.innerHTML = `
    <strong>守夜人论坛 // NIGHT WATCH FORUM</strong>
    <button id="night-watch-forum-close" style="
      padding: 4px 12px;
      background: #111a14;
      color: #34d399;
      border: 1px solid #34d399;
      cursor: pointer;
    ">✕ 关闭论坛</button>
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
}

// ====== 把酒馆上下文发给论坛 ======
async function sendTavernContext() {
  try {
    const context = getContext();

    const persona = context?.name2 || "未知角色";
    const personaDescription = context?.description || "";
    const characterData = context?.characters?.[context?.characterId] || {};

    const chat = Array.isArray(context?.chat) ? context.chat : [];
    const recentChat = chat.slice(-20).map(function (item) {
      return {
        role: item.is_user ? "user" : "assistant",
        name: item.name || (item.is_user ? context?.name1 : context?.name2),
        text: item.mes || ""
      };
    });

    const worldInfo = context?.world_info || {};

    const tavernContext = {
      character: {
        name: persona,
        description: personaDescription,
        avatar: characterData?.avatar || ""
      },
      chatHistory: recentChat,
      worldInfo: worldInfo,
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
        } catch (e) {
          console.log("[守夜人论坛] 传递上下文到iframe失败（跨域限制）");
        }
      }
    }

    console.log("[守夜人论坛] 酒馆上下文已同步", tavernContext.character.name);
  } catch (error) {
    console.error("[守夜人论坛] 同步上下文失败:", error);
  }
}
