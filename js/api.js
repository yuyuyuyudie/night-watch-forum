import {
  state,
  saveForumAiSettings,
  loadForumAiSettingsForCurrentAccount,
  loadApiPresets,
  saveApiPresets,
  loadApiPresetAssignments,
  saveApiPresetAssignments
} from "./state.js";

export function initApiPanel() {
  loadForumAiSettingsForCurrentAccount();
  bindForumAiSettings();
  initApiPresetPanel();

  window.addEventListener("auth:changed", () => {
    loadForumAiSettingsForCurrentAccount();
  });
}

function bindForumAiSettings() {
  const openBtn = document.getElementById("openForumAiSettingsBtn");
  const closeBtn = document.getElementById("closeForumAiSettingsBtn");
  const overlay = document.getElementById("forumAiSettingsOverlay");

  const baseInput = document.getElementById("forumApiBaseInput");
  const keyInput = document.getElementById("forumApiKeyInput");
  const modelInput = document.getElementById("forumApiModelInput");
  const modelSelect = document.getElementById("forumModelSelect");

  const saveApiBtn = document.getElementById("saveForumApiBtn");
  const testApiBtn = document.getElementById("testForumApiBtn");
  const fetchModelsBtn = document.getElementById("fetchForumModelsBtn");
  const statusBox = document.getElementById("forumApiStatusBox");

  const promptInput = document.getElementById("forumPromptInput");
  const savePromptBtn = document.getElementById("saveForumPromptBtn");

  const syncThreadCountInput = document.getElementById("syncThreadCountInput");
const syncCommentCountInput = document.getElementById("syncCommentCountInput");
const keepThreadCountInput = document.getElementById("keepThreadCountInput");
const saveSyncRulesBtn = document.getElementById("saveSyncRulesBtn");

  const importWorldBookBtn = document.getElementById("importWorldBookBtn");
  const readTavernWorldBooksBtn = document.getElementById("readTavernWorldBooksBtn");
  const worldBookFileInput = document.getElementById("worldBookFileInput");
  const activeWorldBookSelect = document.getElementById("activeWorldBookSelect");
  const worldBookEntryList = document.getElementById("worldBookEntryList");
  const saveWorldBookSettingsBtn = document.getElementById("saveWorldBookSettingsBtn");
  const normaApiUrlInput = document.getElementById("normaApiUrlInput");
  const normaApiKeyInput = document.getElementById("normaApiKeyInput");
  const normaModelInput = document.getElementById("normaModelInput");
  const loadNormaSettingsBtn = document.getElementById("loadNormaSettingsBtn");
  const saveNormaSettingsBtn = document.getElementById("saveNormaSettingsBtn");
  const normaSettingsStatusBox = document.getElementById(
    "normaSettingsStatusBox"
  );

    const storyBoardEnableList = document.getElementById(
    "storyBoardEnableList"
  );
  const saveStoryBoardEnableBtn = document.getElementById(
    "saveStoryBoardEnableBtn"
  );

  if (!openBtn || !overlay) return;

    async function loadNormaSettings() {
    writeStatus(normaSettingsStatusBox, ["正在读取诺玛设置……"]);

    try {
      const response = await fetch(
        "http://43.135.26.183:3000/api/norma/settings",
        {
          headers: {
            ...getForumAuthHeadersForNorma()
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success) {
        writeStatus(normaSettingsStatusBox, [
          data.message || "读取诺玛设置失败。"
        ]);
        return;
      }

      const settings = data.settings || {};

      if (normaApiUrlInput) {
        normaApiUrlInput.value = settings.api_url || "";
      }

      if (normaModelInput) {
        normaModelInput.value = settings.model || "";
      }

      if (normaApiKeyInput) {
        normaApiKeyInput.value = "";
        normaApiKeyInput.placeholder = settings.has_api_key
          ? "已有 Key，如需更换请重新输入"
          : "输入诺玛使用的 API Key";
      }

      writeStatus(normaSettingsStatusBox, [
        "诺玛设置读取成功。",
        settings.has_api_key
          ? "数据库里已经保存了 API Key。"
          : "数据库里还没有 API Key。"
      ]);
    } catch (error) {
      writeStatus(normaSettingsStatusBox, [
        "读取失败。",
        String(error)
      ]);
    }
  }

  function getForumAuthHeaders() {
  return state.authToken
    ? {
        Authorization: `Bearer ${state.authToken}`
      }
    : {};
}

  function getForumAuthHeadersForNorma() {
    return state.authToken
      ? {
          Authorization: `Bearer ${state.authToken}`
        }
      : {};
  }

  loadNormaSettingsBtn?.addEventListener("click", loadNormaSettings);

  saveNormaSettingsBtn?.addEventListener("click", async () => {
    const api_url = normaApiUrlInput?.value.trim() || "";
    const api_key = normaApiKeyInput?.value.trim() || "";
    const model = normaModelInput?.value.trim() || "";

    if (!api_url || !api_key || !model) {
      writeStatus(normaSettingsStatusBox, [
        "API 地址、API Key、模型都要填写。"
      ]);
      return;
    }

    try {
      const response = await fetch(
        "http://43.135.26.183:3000/api/norma/settings",
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getForumAuthHeadersForNorma()
          },
          body: JSON.stringify({
            api_url,
            api_key,
            model
          })
        }
      );

      const data = await response.json();

      writeStatus(normaSettingsStatusBox, [
        data.message || (data.success ? "保存成功。" : "保存失败。")
      ]);

      if (data.success && normaApiKeyInput) {
        normaApiKeyInput.value = "";
        normaApiKeyInput.placeholder = "已有 Key，如需更换请重新输入";
      }
    } catch (error) {
      writeStatus(normaSettingsStatusBox, [
        "保存失败。",
        String(error)
      ]);
    }
  });

  openBtn.addEventListener("click", async () => {
    loadForumAiSettingsForCurrentAccount();
    fillForumAiSettingsForm();
    await loadStoryBoardEnableList();
    await loadNormaSettings();
    overlay.hidden = false;
    });

  closeBtn?.addEventListener("click", () => {
    overlay.hidden = true;
  });

  modelSelect?.addEventListener("change", () => {
    if (modelSelect.value && modelInput) {
      modelInput.value = modelSelect.value;
    }
  });

  saveApiBtn?.addEventListener("click", async () => {
    const apiBaseUrl = baseInput?.value.trim() || "";
    const apiKey = keyInput?.value.trim() || "";
    const model = modelInput?.value.trim() || "";

    saveForumAiSettings({
      apiBaseUrl,
      apiKey,
      model
    });

    // 同时存到后端数据库（聊天回复接口需要用到）
    try {
      await fetch("http://43.135.26.183:3000/api/forum-ai/settings", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getForumAuthHeaders()
        },
        body: JSON.stringify({ apiBaseUrl, apiKey, model })
      });
    } catch (e) {
      console.warn("保存 API 设置到后端失败:", e);
    }

    writeStatus(statusBox, [
      "已保存用户总API。",
      `API 地址：${state.forumAiSettings.apiBaseUrl || "未填写"}`,
      `模型：${state.forumAiSettings.model || "未填写"}`,
      `API Key：${state.forumAiSettings.apiKey ? "******已保存******" : "未填写"}`
    ]);

    
    // 如果填了预设名，同时存为预设
    const presetNameInput = document.getElementById("presetNameInput");
    const presetName = presetNameInput?.value.trim() || "";
    if (presetName && apiBaseUrl && apiKey && model) {
      const presets = loadApiPresets();
      const existIdx = presets.findIndex(p => p.name === presetName);
      const presetData = { name: presetName, apiBaseUrl, apiKey, model };
      if (existIdx !== -1) {
        presets[existIdx] = presetData;
      } else {
        presets.push(presetData);
      }
      saveApiPresets(presets);
      renderApiPresetList();
      loadApiPresetAssignmentsToUI();
      if (presetNameInput) presetNameInput.value = "";
      const statusLines = [
        "已保存用户总API。",
        `同时已存为预设「${presetName}」。`,
        `API 地址：${apiBaseUrl || "未填写"}`,
        `模型：${model || "未填写"}`
      ];
      writeStatus(statusBox, statusLines);
    }

  });

  testApiBtn?.addEventListener("click", async () => {
    const apiBaseUrl = baseInput?.value.trim() || "";
    const apiKey = keyInput?.value.trim() || "";

    if (!apiBaseUrl) {
      writeStatus(statusBox, ["请先填写 API 地址。"]);
      return;
    }

    writeStatus(statusBox, ["正在测试连接……", apiBaseUrl]);

    try {
      const testUrl = apiBaseUrl.replace(/\/+$/, "") + "/models";
      const response = await fetch(testUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {})
        }
      });

      writeStatus(statusBox, [
        "连接测试结束。",
        `状态：${response.status}`,
        response.ok ? "结果：连接成功" : "结果：连接失败，但地址可以访问"
      ]);
    } catch (error) {
      writeStatus(statusBox, [
        "连接失败。",
        String(error)
      ]);
    }
  });

  fetchModelsBtn?.addEventListener("click", async () => {
    const apiBaseUrl = baseInput?.value.trim() || "";
    const apiKey = keyInput?.value.trim() || "";

    if (!apiBaseUrl) {
      writeStatus(statusBox, ["请先填写 API 地址。"]);
      return;
    }

    const modelsUrl = buildModelsUrl(apiBaseUrl);

    writeStatus(statusBox, [
      "正在拉取模型列表……",
      `模型地址：${modelsUrl}`
    ]);

    try {
      const response = await fetch(modelsUrl, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
          ...(apiKey ? { "Authorization": `Bearer ${apiKey}` } : {})
        }
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        writeStatus(statusBox, [
          "模型列表拉取失败。",
          `状态：${response.status}`,
          data?.error?.message || data?.message || "请检查 API 地址和 Key。"
        ]);
        return;
      }

      const models = normalizeModels(data);

      if (!models.length) {
        writeStatus(statusBox, [
          "没有读到模型。",
          "这个 API 可能不支持模型列表读取，或者返回格式不是常见格式。",
          "你仍然可以手动填写模型名。"
        ]);
        return;
      }

      saveForumAiSettings({
        apiBaseUrl,
        apiKey,
        availableModels: models,
        model: modelInput?.value.trim() || models[0]
      });

      if (modelInput && !modelInput.value.trim()) {
        modelInput.value = models[0];
      }

      renderModelSelect();

      writeStatus(statusBox, [
        "模型列表拉取成功。",
        `共读取到 ${models.length} 个模型。`,
        `当前模型：${state.forumAiSettings.model || models[0]}`
      ]);
    } catch (error) {
      writeStatus(statusBox, [
        "模型列表拉取失败。",
        String(error),
        "如果你用的是本地代理，请确认它允许读取 /models。"
      ]);
    }
  });

  savePromptBtn?.addEventListener("click", () => {
    saveForumAiSettings({
      forumPrompt: promptInput?.value || ""
    });

    alert("论坛总提示词已保存。");
  });

  saveSyncRulesBtn?.addEventListener("click", () => {
  saveForumAiSettings({
    syncThreadCount: clampNumber(syncThreadCountInput?.value, 1, 10, 1),
    syncCommentCount: clampNumber(syncCommentCountInput?.value, 0, 20, 3),
    keepThreadCount: clampNumber(keepThreadCountInput?.value, 1, 200, 30)
  });

  alert("同步规则已保存。");
});


  // ====== 一键撤回最近一次同步 ======
  const undoLastSyncBtn = document.getElementById("undoLastSyncBtn");

  undoLastSyncBtn?.addEventListener("click", async () => {
  if (!confirm("确定要撤回最近一次同步生成的帖子吗？\n这会删除这批帖子里的所有帖子和评论，玩家自己发的帖子不会受影响。")) {
    return;
  }

  undoLastSyncBtn.disabled = true;
  undoLastSyncBtn.textContent = "正在撤回……";

  try {
    const settings = state.forumAiSettings || {};
    const enabledStoryBoardSlugs = Array.isArray(settings.enabledStoryBoardSlugs)
      ? settings.enabledStoryBoardSlugs
      : [];

    const boardSlug = enabledStoryBoardSlugs[0] || "";

    if (!boardSlug) {
      alert("没有找到启用的剧情板块，请先在「论坛基础」里设置。");
      return;
    }

    const batchKey = `last_sync_batch_${boardSlug}`;
    const batchId = localStorage.getItem(batchKey) || "";

    const res = await fetch(
      `http://43.135.26.183:3000/api/boards/${encodeURIComponent(boardSlug)}/undo-last-sync`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getForumAuthHeaders()
        },
        body: JSON.stringify({
          syncBatchId: batchId
        })
      }
    );

    const data = await res.json().catch(() => null);

    if (!res.ok || !data?.success) {
      alert(data?.message || "撤回失败。");
      return;
    }

    try {
      localStorage.removeItem(batchKey);
    } catch (e) {}

    alert(data.message || "撤回成功！");
    window.dispatchEvent(new CustomEvent("forum:reload-threads"));
  } catch (error) {
    console.error("撤回失败：", error);
    alert("撤回失败：" + error.message);
  } finally {
    undoLastSyncBtn.disabled = false;
    undoLastSyncBtn.textContent = "撤回本次同步";
  }
});

  importWorldBookBtn?.addEventListener("click", () => {
    worldBookFileInput?.click();
  });

  worldBookFileInput?.addEventListener("change", async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const json = JSON.parse(text);
      const worldBook = normalizeWorldBook(json, file.name);

      saveOneWorldBook(worldBook);

      fillForumAiSettingsForm();
      alert(`已导入世界书：${worldBook.name}`);
    } catch (error) {
      console.error("导入世界书失败：", error);
      alert("导入失败，请确认这是酒馆世界书 JSON 文件。");
    }

    event.target.value = "";
  });

  readTavernWorldBooksBtn?.addEventListener("click", async () => {
    try {
      const books = await readTavernWorldBooks();

      if (!books.length) {
        alert(
          "没有从酒馆读取到世界书。\n\n" +
          "如果你现在是在普通网页里打开论坛，这是正常的。\n" +
          "等论坛做成酒馆拓展后，这个按钮就可以直接读取酒馆里的世界书。"
        );
        return;
      }

      const oldBooks = Array.isArray(state.forumAiSettings.worldBooks)
        ? state.forumAiSettings.worldBooks
        : [];

      const nextBooks = [
        ...oldBooks.filter((oldBook) => !books.some((book) => book.id === oldBook.id)),
        ...books
      ];

      const firstBook = books[0];

      saveForumAiSettings({
        worldBooks: nextBooks,
        activeWorldBookId: firstBook.id,
        enabledWorldEntryIds: firstBook.entries.map((entry) => entry.id)
      });

      fillForumAiSettingsForm();
      alert(`已从酒馆读取 ${books.length} 本世界书。`);
    } catch (error) {
      console.error("读取酒馆世界书失败：", error);
      alert("读取失败。现在如果不是酒馆拓展环境，这是正常的。");
    }
  });

  activeWorldBookSelect?.addEventListener("change", () => {
    renderWorldBookEntries();
  });

  saveWorldBookSettingsBtn?.addEventListener("click", () => {
    const activeWorldBookId = activeWorldBookSelect?.value || "";

    const enabledWorldEntryIds = Array.from(
      worldBookEntryList?.querySelectorAll(".worldbook-entry-check:checked") || []
    ).map((item) => item.value);

    saveForumAiSettings({
      activeWorldBookId,
      enabledWorldEntryIds
    });

    alert("世界书设置已保存。");
  });
}

  saveStoryBoardEnableBtn?.addEventListener("click", () => {
    const enabledStoryBoardSlugs = Array.from(
      storyBoardEnableList?.querySelectorAll(
        "input[type='checkbox']:checked"
      ) || []
    ).map((input) => input.value);

    saveForumAiSettings({
      enabledStoryBoardSlugs
    });

    alert("剧情角色启用板块已保存。");
  });

function fillForumAiSettingsForm() {
  const settings = state.forumAiSettings || {};

  const baseInput = document.getElementById("forumApiBaseInput");
  const keyInput = document.getElementById("forumApiKeyInput");
  const modelInput = document.getElementById("forumApiModelInput");
  const promptInput = document.getElementById("forumPromptInput");

  const syncThreadCountInput = document.getElementById("syncThreadCountInput");
const syncCommentCountInput = document.getElementById("syncCommentCountInput");
const keepThreadCountInput = document.getElementById("keepThreadCountInput");

  if (baseInput) baseInput.value = settings.apiBaseUrl || "";
  if (keyInput) keyInput.value = settings.apiKey || "";
  if (modelInput) modelInput.value = settings.model || "";
  if (promptInput) promptInput.value = settings.forumPrompt || "";

  if (syncThreadCountInput) syncThreadCountInput.value = settings.syncThreadCount || 1;
if (syncCommentCountInput) syncCommentCountInput.value = settings.syncCommentCount ?? 3;
if (keepThreadCountInput) keepThreadCountInput.value = settings.keepThreadCount || 30;

  renderModelSelect();
  renderWorldBookSelect();
  renderWorldBookEntries();
}

function renderModelSelect() {
  const select = document.getElementById("forumModelSelect");
  if (!select) return;

  const settings = state.forumAiSettings || {};
  const models = Array.isArray(settings.availableModels) ? settings.availableModels : [];
  const currentModel = settings.model || "";

  if (!models.length) {
    select.innerHTML = `<option value="">暂无模型，请先拉取</option>`;
    return;
  }

  select.innerHTML = [
    `<option value="">选择已拉取模型</option>`,
    ...models.map((model) => {
      return `<option value="${escapeHtml(model)}">${escapeHtml(model)}</option>`;
    })
  ].join("");

  select.value = models.includes(currentModel) ? currentModel : "";
}

function buildModelsUrl(apiBaseUrl) {
  let url = apiBaseUrl.trim();

  url = url.replace(/\/+$/, "");

  if (url.endsWith("/chat/completions")) {
    return url.replace(/\/chat\/completions$/, "/models");
  }

  if (url.endsWith("/responses")) {
    return url.replace(/\/responses$/, "/models");
  }

  if (url.endsWith("/completions")) {
    return url.replace(/\/completions$/, "/models");
  }

  if (url.endsWith("/models")) {
    return url;
  }

  return `${url}/models`;
}

function normalizeModels(data) {
  if (!data) return [];

  const rawList = Array.isArray(data.data)
    ? data.data
    : Array.isArray(data.models)
      ? data.models
      : Array.isArray(data)
        ? data
        : [];

  return rawList
    .map((item) => {
      if (typeof item === "string") return item;
      return item.id || item.name || item.model || "";
    })
    .map((item) => String(item).trim())
    .filter(Boolean)
    .sort();
}

function renderWorldBookSelect() {
  const select = document.getElementById("activeWorldBookSelect");
  if (!select) return;

  const settings = state.forumAiSettings || {};
  const books = Array.isArray(settings.worldBooks) ? settings.worldBooks : [];

  select.innerHTML = [
    `<option value="">不挂载世界书</option>`,
    ...books.map((book) => {
      return `<option value="${escapeHtml(book.id)}">${escapeHtml(book.name)}</option>`;
    })
  ].join("");

  select.value = settings.activeWorldBookId || "";
}

function renderWorldBookEntries() {
  const select = document.getElementById("activeWorldBookSelect");
  const list = document.getElementById("worldBookEntryList");
  if (!list) return;

  const settings = state.forumAiSettings || {};
  const books = Array.isArray(settings.worldBooks) ? settings.worldBooks : [];
  const activeWorldBookId = select?.value || settings.activeWorldBookId || "";
  const book = books.find((item) => item.id === activeWorldBookId);

  if (!book) {
    list.innerHTML = `<div class="empty-tip">当前没有挂载世界书。</div>`;
    return;
  }

  const enabledIds = Array.isArray(settings.enabledWorldEntryIds)
    ? settings.enabledWorldEntryIds
    : [];

  if (!book.entries.length) {
    list.innerHTML = `<div class="empty-tip">这本世界书没有读取到条目。</div>`;
    return;
  }

  list.innerHTML = book.entries.map((entry) => {
    const checked = enabledIds.includes(entry.id) ? "checked" : "";

    return `
      <label class="worldbook-entry-item">
        <input
          class="worldbook-entry-check"
          type="checkbox"
          value="${escapeHtml(entry.id)}"
          ${checked}
        />
        <div>
          <div class="worldbook-entry-title">${escapeHtml(entry.title)}</div>
          <div class="worldbook-entry-keywords">${escapeHtml(entry.keys.join(" / "))}</div>
          <div class="worldbook-entry-content">${escapeHtml(entry.content.slice(0, 120))}</div>
        </div>
      </label>
    `;
  }).join("");
}

function saveOneWorldBook(worldBook) {
  const oldBooks = Array.isArray(state.forumAiSettings.worldBooks)
    ? state.forumAiSettings.worldBooks
    : [];

  const nextBooks = [
    ...oldBooks.filter((book) => book.id !== worldBook.id),
    worldBook
  ];

  saveForumAiSettings({
    worldBooks: nextBooks,
    activeWorldBookId: worldBook.id,
    enabledWorldEntryIds: worldBook.entries.map((entry) => entry.id)
  });
}

async function readTavernWorldBooks() {
  const directBooks =
    window.CassellTavernWorldBooks ||
    window.parent?.CassellTavernWorldBooks ||
    [];

  if (Array.isArray(directBooks) && directBooks.length) {
    return directBooks.map((book, index) => normalizeWorldBook(book, `酒馆世界书-${index + 1}.json`, `tavern-${index}`));
  }

  window.dispatchEvent(new CustomEvent("cassell:request-worldbooks"));

  await wait(500);

  const afterRequestBooks =
    window.CassellTavernWorldBooks ||
    window.parent?.CassellTavernWorldBooks ||
    [];

  if (Array.isArray(afterRequestBooks) && afterRequestBooks.length) {
    return afterRequestBooks.map((book, index) => normalizeWorldBook(book, `酒馆世界书-${index + 1}.json`, `tavern-${index}`));
  }

  try {
    const raw = localStorage.getItem("cassell_tavern_worldbooks");
    const parsed = raw ? JSON.parse(raw) : [];

    if (Array.isArray(parsed) && parsed.length) {
      return parsed.map((book, index) => normalizeWorldBook(book, `酒馆世界书-${index + 1}.json`, `tavern-local-${index}`));
    }
  } catch {
    // 不处理
  }

  return [];
}

function wait(ms) {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function normalizeWorldBook(json, fileName, fixedId = "") {
  const bookName =
    json.name ||
    json.title ||
    json.comment ||
    fileName.replace(/\.json$/i, "");

  const rawEntries = Array.isArray(json.entries)
    ? json.entries
    : Array.isArray(json)
      ? json
      : Object.values(json.entries || json.data || {});

  const entries = rawEntries.map((entry, index) => {
    const keys = Array.isArray(entry.keys)
      ? entry.keys
      : Array.isArray(entry.key)
        ? entry.key
        : entry.key
          ? [entry.key]
          : [];

    return {
      id: String(entry.uid || entry.id || `${bookName}-${index}`),
      title: String(entry.comment || entry.name || entry.title || `条目 ${index + 1}`),
      keys: keys.map((item) => String(item)),
      content: String(entry.content || entry.text || entry.value || "")
    };
  }).filter((entry) => entry.content.trim());

  return {
    id: fixedId || `file-${bookName}`,
    name: bookName,
    entries
  };
}

function writeStatus(el, lines) {
  if (!el) return;
  el.textContent = lines.join("\n");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function clampNumber(value, min, max, fallback) {
  const number = Number(value);

  if (!Number.isFinite(number)) return fallback;

  return Math.min(max, Math.max(min, Math.floor(number)));
}

async function loadStoryBoardEnableList() {
  const list = document.getElementById("storyBoardEnableList");
  if (!list) return;

  try {
    const response = await fetch("http://43.135.26.183:3000/api/boards");
    const data = await response.json();

    if (!response.ok || !data.success) {
      list.innerHTML = `<div class="empty-tip">读取板块失败。</div>`;
      return;
    }

    const storyBoards = (Array.isArray(data.boards) ? data.boards : [])
      .filter((board) => {
        const type = board.boardType || board.board_type;
        return type === "story";
      });

    const enabledSlugs = Array.isArray(
      state.forumAiSettings?.enabledStoryBoardSlugs
    )
      ? state.forumAiSettings.enabledStoryBoardSlugs
      : [];

    if (!storyBoards.length) {
      list.innerHTML = `<div class="empty-tip">暂时没有剧情板块。</div>`;
      return;
    }

    list.innerHTML = storyBoards
      .map((board) => {
        const slug = String(board.slug || "");
        const checked = enabledSlugs.includes(slug) ? "checked" : "";

        return `
          <label class="story-board-enable-item">
            <input
              type="checkbox"
              value="${escapeHtml(slug)}"
              ${checked}
            />
            <span>
              <strong>${escapeHtml(board.name || slug)}</strong>
              <small>${escapeHtml(board.description || "")}</small>
            </span>
          </label>
        `;
      })
      .join("");
  } catch (error) {
    console.error("读取剧情板块失败：", error);
    list.innerHTML = `<div class="empty-tip">读取板块失败，请确认后端已启动。</div>`;
  }
}

export function initApiPresetPanel() {
  renderApiPresetList();
  loadApiPresetAssignmentsToUI();


  document.getElementById("saveApiAssignmentsBtn")?.addEventListener("click", () => {
    const assignments = {
      forum: document.getElementById("assignForumApi")?.value || "",
      private_chat: document.getElementById("assignPrivateChatApi")?.value || "",
      summary: document.getElementById("assignSummaryApi")?.value || ""
    };
    saveApiPresetAssignments(assignments);
    const statusEl = document.getElementById("apiPresetStatus");
    if (statusEl) statusEl.textContent = "已保存用途分配。";
  });
}

function renderApiPresetList() {
  const container = document.getElementById("apiPresetList");
  if (!container) return;
  const presets = loadApiPresets();
  if (presets.length === 0) {
    container.innerHTML = '<div style="font-size:12px;color:var(--muted,#888);padding:8px 0">暂无预设，点击「新建预设」添加。</div>';
    return;
  }
  container.innerHTML = presets.map((p, i) => `
    <div style="display:flex;align-items:center;gap:8px;padding:6px 0;border-bottom:1px dashed rgba(128,128,128,0.2)">
      <span style="flex:1;font-size:13px"><b>${escapeHtml2(p.name)}</b> — ${escapeHtml2(p.model || "未填模型")}</span>
      <button class="retro-btn small ghost api-preset-delete" data-index="${i}" title="删除">✕</button>
    </div>
  `).join("");

  container.querySelectorAll(".api-preset-delete").forEach(btn => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.index);
      const presets = loadApiPresets();
      if (confirm(`删除预设「${presets[idx]?.name}」？`)) {
        presets.splice(idx, 1);
        saveApiPresets(presets);
        renderApiPresetList();
        loadApiPresetAssignmentsToUI();
      }
    });
  });
}

function loadApiPresetAssignmentsToUI() {
  const presets = loadApiPresets();
  const assignments = loadApiPresetAssignments();
  const optionsHtml = '<option value="">使用默认 API</option>' + 
    presets.map(p => `<option value="${escapeHtml2(p.name)}">${escapeHtml2(p.name)}</option>`).join("");
  
  ["assignForumApi", "assignPrivateChatApi", "assignSummaryApi"].forEach(id => {
    const sel = document.getElementById(id);
    if (sel) {
      sel.innerHTML = optionsHtml;
      sel.value = assignments[id.replace("assign", "").replace("Api", "").toLowerCase()] || "";
    }
  });
}

function escapeHtml2(str) {
  return String(str || "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
