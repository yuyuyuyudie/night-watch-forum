import {
  state,
  STORAGE_KEYS,
  saveAuthSession,
  saveWallpaper,
  saveAuthToken,
  clearAuthToken,
  saveCurrentAccount,
  clearCurrentAccount,
  saveLocalAvatarOverrides
} from "./state.js";

import { switchRoute, getRouteTitle } from "./router.js";
const API_BASE = "http://43.135.26.183:3000";

const DEFAULT_AVATAR_STYLE = "lorelei";

function getDefaultAvatar(seed) {
  return `https://api.dicebear.com/7.x/${DEFAULT_AVATAR_STYLE}/svg?seed=${encodeURIComponent(seed)}`;
}

function looksLikeStudentId(value) {
  const text = String(value || "").trim().toUpperCase();
  return /^[A-Z]{2}\d{6,}$/.test(text);
}

let previewRequestId = 0;



export function initAuth() {
  bindAuthActions();
  applyWallpaper();
  restoreSessionIfNeeded();
  bindForumHomeReturn();
}

export function isGuestMode() {
  return state.authSession?.isGuest === true;
}

export async function syncCurrentAccountData(payload = {}) {
  if (
    !state.authSession.loggedIn ||
    state.authSession.isGuest ||
    !state.authSession.studentId ||
    !state.authToken
  ) {
    return false;
  }

  try {
    const response = await fetch(`${API_BASE}/api/account-preferences`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.authToken}`
      },
      body: JSON.stringify(payload)
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      console.error("同步账户偏好失败：", data.message || data);
      return false;
    }

    const localAvatar =
  state.localAvatarOverrides?.[state.authSession.studentId] || "";

saveCurrentAccount(data.user);

state.avatar = localAvatar || data.user.avatar;
state.userStatus = data.user.userStatus;
state.profile = data.user.profile;

    localStorage.setItem(STORAGE_KEYS.avatar, state.avatar);
    localStorage.setItem(STORAGE_KEYS.userStatus, state.userStatus);
    localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(state.profile));

    return true;
  } catch (error) {
    console.error("同步账户偏好失败：", error);
    return false;
  }
}

function bindAuthActions() {
  const loginBtn = document.getElementById("loginAccountBtn");
  const guestBtn = document.getElementById("guestLoginBtn");
  const studentInput = document.getElementById("authStudentIdInput");
const accessCodeInput = document.getElementById("authAccessCodeInput");


  const settingsBtn = document.getElementById("settingsMenuBtn");
  const settingsDropdown = document.getElementById("settingsDropdown");
  const logoutBtn = document.getElementById("logoutAccountBtn");
  const beautifyBtn = document.getElementById("openBeautifyCenterBtn");

  studentInput?.addEventListener("input", updateAuthPreview);

  [studentInput, accessCodeInput].forEach((input) => {
  input?.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      loginAccount();
    }
  });
});


  loginBtn?.addEventListener("click", loginAccount);
  guestBtn?.addEventListener("click", loginGuest);

  settingsBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    settingsDropdown?.classList.toggle("active");
  });

  document.addEventListener("click", () => {
    settingsDropdown?.classList.remove("active");
  });

  logoutBtn?.addEventListener("click", () => {
    settingsDropdown?.classList.remove("active");
    logoutAccount();
  });

  beautifyBtn?.addEventListener("click", () => {
    settingsDropdown?.classList.remove("active");
    openBeautifyCenter();
  });

  
  // ====== 账号设置（修改密码） ======
  const accountSettingsBtn = document.getElementById("openAccountSettingsBtn");
  const accountSettingsOverlay = document.getElementById("accountSettingsOverlay");
  const closeAccountSettingsBtn = document.getElementById("closeAccountSettingsBtn");
  const acsStudentId = document.getElementById("acsStudentId");
  const acsSubmitBtn = document.getElementById("acsSubmitBtn");
  const acsMsg = document.getElementById("acsMsg");

  accountSettingsBtn?.addEventListener("click", () => {
    settingsDropdown?.classList.remove("active");
    // 自动填入学号
    if (acsStudentId && state.authSession?.studentId) {
      acsStudentId.value = state.authSession.studentId;
    }
    if (acsMsg) acsMsg.textContent = "";
    if (accountSettingsOverlay) accountSettingsOverlay.classList.add("active");
  });

  closeAccountSettingsBtn?.addEventListener("click", () => {
    if (accountSettingsOverlay) accountSettingsOverlay.classList.remove("active");
  });

  acsSubmitBtn?.addEventListener("click", async () => {
    const studentId = acsStudentId?.value?.trim();
    const oldCode = document.getElementById("acsOldCode")?.value?.trim();
    const newCode = document.getElementById("acsNewCode")?.value?.trim();
    const confirmCode = document.getElementById("acsConfirmCode")?.value?.trim();

    if (!oldCode || !newCode || !confirmCode) {
      acsMsg.textContent = "请填写所有字段";
      acsMsg.style.color = "var(--red)";
      return;
    }

    if (newCode.length < 4) {
      acsMsg.textContent = "新访问码至少4位";
      acsMsg.style.color = "var(--red)";
      return;
    }

    if (newCode !== confirmCode) {
      acsMsg.textContent = "两次输入的新访问码不一致";
      acsMsg.style.color = "var(--red)";
      return;
    }

    try {
      const resp = await fetch(`${API_BASE}/api/change-access-code`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.authToken}`
        },
        body: JSON.stringify({ studentId, oldCode, newCode, confirmCode })
      });

      const data = await resp.json();

      if (data.success) {
        acsMsg.textContent = "✅ 密码修改成功";
        acsMsg.style.color = "var(--green)";
        document.getElementById("acsOldCode").value = "";
        document.getElementById("acsNewCode").value = "";
        document.getElementById("acsConfirmCode").value = "";
      } else {
        acsMsg.textContent = data.message || "修改失败";
        acsMsg.style.color = "var(--red)";
      }
    } catch (err) {
      acsMsg.textContent = "无法连接到服务器";
      acsMsg.style.color = "var(--red)";
    }
  });

  // ====== 管理员：查看角色密码 ======
  const dramaCodesOverlay = document.getElementById("dramaCodesOverlay");
  const closeDramaCodesBtn = document.getElementById("closeDramaCodesBtn");
  const dramaCodesList = document.getElementById("dramaCodesList");
  const rotateCodesBtn = document.getElementById("rotateCodesBtn");

  closeDramaCodesBtn?.addEventListener("click", () => {
    if (dramaCodesOverlay) dramaCodesOverlay.classList.remove("active");
  });

  rotateCodesBtn?.addEventListener("click", async () => {
    if (!confirm("确认立即重新生成所有角色密码？")) return;

    try {
      const resp = await fetch(`${API_BASE}/api/admin/rotate-codes`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${state.authToken}`
        }
      });

      const data = await resp.json();
      if (data.success) {
        alert("密码已重新生成！");
        loadDramaCodes();
      } else {
        alert(data.message || "操作失败");
      }
    } catch (err) {
      alert("无法连接到服务器");
    }
  });

  // 把 loadDramaCodes 挂到 window 上方便其他地方调用
  window.__openDramaCodes = async function () {
    if (dramaCodesOverlay) dramaCodesOverlay.classList.add("active");
    await loadDramaCodes();
  };

  async function loadDramaCodes() {
    try {
      const resp = await fetch(`${API_BASE}/api/admin/drama-codes`, {
        headers: {
          Authorization: `Bearer ${state.authToken}`
        }
      });

      const data = await resp.json();
      if (!data.success || !data.codes) {
        dramaCodesList.innerHTML = `<span style="color:var(--red)">${data.message || "加载失败"}</span>`;
        return;
      }

      let html = `<div style="margin-bottom:8px; opacity:0.7;">日期：${data.date}</div>`;
      for (const c of data.codes) {
        const code = c.access_code || "（未生成）";
        html += `<div style="display:flex; justify-content:space-between; padding:4px 0; border-bottom:1px solid var(--line-dark);">
          <span>${c.true_name}（${c.student_id}）</span>
          <span style="color:var(--amber); font-weight:bold;">${code}</span>
        </div>`;
      }
      dramaCodesList.innerHTML = html;
    } catch (err) {
      dramaCodesList.innerHTML = `<span style="color:var(--red)">无法连接到服务器</span>`;
    }
  }

  updateAuthPreview();
}

function bindForumHomeReturn() {
  const btn = document.getElementById("forumHomeBtn");
  btn?.addEventListener("click", () => {
    const authOverlay = document.getElementById("authOverlay");
    if (authOverlay?.classList.contains("active")) return;

    const profileHomeOverlay = document.getElementById("profileHomeOverlay");
    const routeTitle = document.getElementById("routeTitle");

    if (profileHomeOverlay?.classList.contains("active")) {
      profileHomeOverlay.classList.remove("active");
      if (routeTitle) routeTitle.textContent = getRouteTitle();
      return;
    }

    switchRoute("threads");
if (routeTitle) routeTitle.textContent = "守夜人论坛";

  });
}

async function restoreSessionIfNeeded() {
  if (!state.authSession.loggedIn) {
    showAuthOverlay();
    return;
  }

  if (state.authSession.isGuest) {
  const guestId =
    state.authSession.studentId || getGuestDeviceId();

  loadGuestState(guestId);
  emitAuthChanged();
  hideAuthOverlay();
  return;
}

  if (!state.authSession.studentId || !state.authToken) {
  clearCurrentAccount();
  showAuthOverlay();
  return;
}

  try {
    const response = await fetch(`${API_BASE}/api/me`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${state.authToken}`
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
clearAuthToken();
clearCurrentAccount();

saveAuthSession({
  loggedIn: false,
  isGuest: false,
  studentId: ""
});

  showAuthOverlay();
  return;
}

    loadAccountIntoState(data.user);
    emitAuthChanged();
    hideAuthOverlay();
  } catch (error) {
    console.error("恢复登录状态失败：", error);
    showAuthOverlay();
  }
}


async function loginAccount() {
  const studentId = getStudentIdInputValue().toUpperCase();
  const accessCode = getAccessCodeInputValue();

  if (!studentId) {
    alert("请输入学号后再登录。");
    return;
  }

  if (!accessCode) {
    alert("请输入访问码后再登录。");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/login`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        studentId,
        accessCode
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success || !data.user || !data.token) {
      alert(data.message || "登录失败，请检查学号和访问码。");
      return;
    }

    const returnedStudentId = String(
      data.user.studentId || data.user.student_id || ""
    )
      .trim()
      .toUpperCase();

    // 后端返回的账号必须和输入的学号一致
    // 防止登录路明非却错误显示成 AI999999
    if (!returnedStudentId || returnedStudentId !== studentId) {
      console.error("登录账号不一致：", {
        输入的学号: studentId,
        后端返回的学号: returnedStudentId,
        返回的账号资料: data.user
      });

      alert(
        `登录失败：服务器返回的是 ${returnedStudentId || "空账号"}，不是 ${studentId}。请检查后端登录代码。`
      );
      return;
    }

    // 先清除旧账号在内存中的资料
    clearCurrentAccount();
    clearAuthToken();

    // 保存新账号的登录状态
    saveAuthSession({
      loggedIn: true,
      isGuest: false,
      studentId: returnedStudentId
    });

    saveAuthToken(data.token);
    loadAccountIntoState(data.user);

    emitAuthChanged();
    hideAuthOverlay();
    switchRoute("threads");
  } catch (error) {
    console.error("登录请求失败：", error);
    alert("无法连接到后端，请确认后端服务已启动。");
  }
}

const GUEST_DEVICE_ID_KEY = "cassell_guest_device_id_v1";

function getGuestDeviceId() {
  const saved = localStorage.getItem(GUEST_DEVICE_ID_KEY);

  if (saved) {
    return saved;
  }

  const chars =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz0123456789";

  let randomText = "";

  // 生成 12 位随机字符
  for (let i = 0; i < 12; i++) {
    const index = Math.floor(Math.random() * chars.length);
    randomText += chars[index];
  }

  const guestId = `游客#${randomText}`;
  localStorage.setItem(GUEST_DEVICE_ID_KEY, guestId);

  return guestId;
}

function loginGuest() {
  clearAuthToken();
  clearCurrentAccount();

  const guestId = getGuestDeviceId();

  saveAuthSession({
    loggedIn: true,
    isGuest: true,
    studentId: guestId
  });

  loadGuestState(guestId);
  emitAuthChanged();
  hideAuthOverlay();
  switchRoute("threads");
}

// 游客实名认证成功后的回调
window.onGuestVerified = function(user, token, studentId) {
  saveAuthSession({
    loggedIn: true,
    isGuest: false,
    studentId: studentId
  });
  saveAuthToken(token);
  loadAccountIntoState(user);
};

async function logoutAccount() {
  try {
    if (state.authToken) {
      await fetch(`${API_BASE}/api/logout`, {
        method: "POST",
        headers: {
          "Authorization": `Bearer ${state.authToken}`
        }
      });
    }
  } catch (error) {
    console.error("登出请求失败：", error);
  }

  clearAuthToken();
clearCurrentAccount();

saveAuthSession({
  loggedIn: false,
  isGuest: false,
  studentId: ""
});


  const routeTitle = document.getElementById("routeTitle");
  if (routeTitle) routeTitle.textContent = "守夜人论坛";

  const profileHomeOverlay = document.getElementById("profileHomeOverlay");
  profileHomeOverlay?.classList.remove("active");

  showAuthOverlay();
}

function openBeautifyCenter() {
  const old = document.getElementById("beautifyCenterOverlay");
  if (old) old.remove();

  const currentWallpaper = state.wallpaper || "";
  const currentFamily = state.themeFamily || "classic";
  const currentMode = state.themeMode || "night";

  const overlay = document.createElement("div");
  overlay.id = "beautifyCenterOverlay";
  overlay.style.cssText = "position:fixed;inset:0;z-index:9999;display:flex;align-items:center;justify-content:center;background:rgba(0,0,0,0.5);";

  overlay.innerHTML = `
    <div style="background:var(--panel);color:var(--text);box-shadow:var(--shadow-outset);width:560px;max-width:92vw;max-height:85vh;overflow-y:auto;padding:0;">
      <div style="padding:12px 16px;background:var(--titlebar);color:var(--titlebar-text);display:flex;justify-content:space-between;align-items:center;font-family:'Share Tech Mono',monospace;font-size:14px;">
        <span>美化中心 // BEAUTIFY CENTER</span>
        <button id="beautifyCloseBtn" class="win-btn" style="color:var(--titlebar-text);">✕</button>
      </div>
      <div style="padding:16px;">

        <!-- 三套主题 -->
        <div id="beautifyThemeList"></div>

        <!-- 壁纸 -->
        <div style="border-top:1px dashed var(--muted);padding-top:12px;margin-top:8px;">
          <div style="font-weight:700;font-size:14px;margin-bottom:8px;">🖼 壁纸</div>
          <div style="display:flex;gap:8px;align-items:center;">
            <input id="beautifyWallpaperInput" class="retro-input" placeholder="粘贴壁纸图片链接..." style="flex:1;" value="${currentWallpaper}" />
            <button id="beautifyWallpaperSaveBtn" class="win-btn">应用</button>
            <button id="beautifyWallpaperClearBtn" class="win-btn warn-btn">清除</button>
          </div>
        </div>

      </div>
    </div>
  `;

  document.getElementById("app").appendChild(overlay);

  // ====== 渲染三套主题卡片 ======
  const themeList = document.getElementById("beautifyThemeList");
  if (themeList) {
    const themes = [
      { id: "classic", name: "💚 经典", desc: "日间灰蓝、夜间守夜人绿", colors: ["#c0c0c0","#0c1210","#34d399","#f59e0b","#1084d0"] },
      { id: "sakura",  name: "🌸 樱花", desc: "日间草莓粉、夜间霓虹粉", colors: ["#fbcfe8","#2d0b1a","#ff71ce","#f472b6","#ffa726"] },
      { id: "custom",  name: "🎨 自定义", desc: "写你自己的 CSS 样式", colors: ["#3b82f6","#60a5fa","#93c5fd","#6366f1","#8b5cf6"] }
    ];

    themeList.innerHTML = themes.map(t => {
      const active = currentFamily === t.id;
      const opacity = getThemeOpacityFor(t.id);
      return `
        <div style="border:2px solid ${active ? "var(--blue-2)" : "var(--line-dark)"};padding:12px;margin-bottom:12px;background:var(--panel-2);box-shadow:var(--shadow-outset);">
          <div class="beautify-theme-card" data-theme="${t.id}" style="cursor:pointer;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
              <span style="font-weight:700;font-size:15px;">${t.name}</span>
              <span class="label ${active ? "blue" : ""}" style="font-size:11px;${active ? "" : "background:var(--gray);color:#fff;"}">${active ? "当前使用" : "使用"}</span>
            </div>
            <div style="font-size:13px;color:var(--muted);margin-bottom:10px;">${t.desc}</div>
            <div style="display:flex;gap:6px;">
              ${t.colors.map(c => `<span style="width:24px;height:24px;border-radius:4px;background:${c};border:1px solid rgba(128,128,128,0.3);"></span>`).join("")}
            </div>
          </div>

          ${t.id !== "custom" ? `
          <!-- 透明度滑块 -->
          <div style="margin-top:10px;">
            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:4px;">
              <span style="font-size:12px;">透明度</span>
              <span style="font-size:12px;color:var(--muted);" id="opacityVal_${t.id}">${Math.round(opacity * 100)}%</span>
            </div>
            <input type="range" min="20" max="100" step="5" value="${Math.round(opacity * 100)}"
                   data-opacity-theme="${t.id}"
                   style="width:100%;accent-color:var(--blue-2);" />
          </div>
          ` : ""}

          ${t.id === "custom" && active ? `
          <!-- 自定义 CSS 编辑器 -->
          <div style="margin-top:12px;border-top:1px dashed var(--muted);padding-top:10px;">
            <div style="font-weight:700;font-size:13px;margin-bottom:6px;">📝 主体 CSS</div>
            <textarea id="customCssEditor" style="width:100%;height:160px;background:var(--panel-2);color:var(--text);border:1px solid var(--line-dark);padding:10px;font-family:'Share Tech Mono',monospace;font-size:12px;resize:vertical;box-shadow:var(--shadow-inset);">${escapeHtml(state.customCss || "")}</textarea>
            <div style="margin-top:8px;display:flex;gap:8px;">
              <button id="customCssSaveBtn" class="win-btn" style="flex:1;">保存主体 CSS</button>
              <button id="customCssClearBtn" class="win-btn warn-btn">清空</button>
            </div>
            <div style="margin-top:8px;border-top:1px dashed var(--muted);padding-top:10px;">
              <div style="font-weight:700;font-size:13px;margin-bottom:6px;">💬 气泡 CSS</div>
              <textarea id="bubbleCssEditor" style="width:100%;height:120px;background:var(--panel-2);color:var(--text);border:1px solid var(--line-dark);padding:10px;font-family:'Share Tech Mono',monospace;font-size:12px;resize:vertical;box-shadow:var(--shadow-inset);">${escapeHtml(state.bubbleCss || "")}</textarea>
              <div style="margin-top:8px;display:flex;gap:8px;">
                <button id="bubbleCssSaveBtn" class="win-btn" style="flex:1;">保存气泡 CSS</button>
                <button id="bubbleCssClearBtn" class="win-btn warn-btn">清空</button>
              </div>
            </div>
          </div>
          ` : ""}

          ${t.id === "custom" && !active ? `
          <div style="margin-top:10px;font-size:12px;color:var(--muted);">点击「使用」后可以编辑自定义 CSS</div>
          ` : ""}
        </div>
      `;
    }).join("");

    // 绑定主题切换点击
    themeList.querySelectorAll(".beautify-theme-card").forEach(card => {
      card.addEventListener("click", () => {
        const family = card.getAttribute("data-theme");
        import("./state.js").then(m => {
          if (family === "custom") {
            const prev = state.themeFamily || "classic";
            if (prev !== "custom") m.saveCustomBase(prev);
          }
          m.saveThemeFamily(family);
          if (window.__applyTheme) window.__applyTheme();
          overlay.remove();
          openBeautifyCenter();
        });
      });
    });

    // 绑定透明度滑块
    themeList.querySelectorAll("input[data-opacity-theme]").forEach(slider => {
      slider.addEventListener("input", (e) => {
        const theme = e.target.getAttribute("data-opacity-theme");
        const val = Number(e.target.value) / 100;
        const label = document.getElementById("opacityVal_" + theme);
        if (label) label.textContent = e.target.value + "%";
        import("./state.js").then(m => {
          m.saveThemeOpacity(theme, val);
          if (window.__applyTheme) window.__applyTheme();
        });
      });
    });

    // 绑定自定义 CSS 保存
    document.getElementById("customCssSaveBtn")?.addEventListener("click", () => {
      const css = document.getElementById("customCssEditor")?.value || "";
      import("./state.js").then(m => {
        m.saveCustomCss(css);
        if (window.__applyTheme) window.__applyTheme();
      });
    });

    document.getElementById("customCssClearBtn")?.addEventListener("click", () => {
      const editor = document.getElementById("customCssEditor");
      if (editor) editor.value = "";
      import("./state.js").then(m => {
        m.saveCustomCss("");
        if (window.__applyTheme) window.__applyTheme();
      });
    });

    // 绑定气泡 CSS 保存
    document.getElementById("bubbleCssSaveBtn")?.addEventListener("click", () => {
      const css = document.getElementById("bubbleCssEditor")?.value || "";
      import("./state.js").then(m => {
        m.saveBubbleCss(css);
        if (window.__applyTheme) window.__applyTheme();
      });
    });

    document.getElementById("bubbleCssClearBtn")?.addEventListener("click", () => {
      const editor = document.getElementById("bubbleCssEditor");
      if (editor) editor.value = "";
      import("./state.js").then(m => {
        m.saveBubbleCss("");
        if (window.__applyTheme) window.__applyTheme();
      });
    });
  }

  // 关闭
  overlay.addEventListener("mousedown", (e) => {
    if (e.target === overlay) overlay.remove();
  });
  document.getElementById("beautifyCloseBtn")?.addEventListener("click", () => overlay.remove());

  // 壁纸应用
  document.getElementById("beautifyWallpaperSaveBtn")?.addEventListener("click", () => {
    const url = document.getElementById("beautifyWallpaperInput").value.trim();
    saveWallpaper(url);
    applyWallpaper();
  });

  // 壁纸清除
  document.getElementById("beautifyWallpaperClearBtn")?.addEventListener("click", () => {
    saveWallpaper("");
    applyWallpaper();
    document.getElementById("beautifyWallpaperInput").value = "";
  });
}

function getThemeOpacityFor(family) {
  if (family === "classic") return state.opacityClassic ?? 1;
  if (family === "sakura") return state.opacitySakura ?? 1;
  return 1;
}

function escapeHtml(text) {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function applyWallpaper() {
  if (state.wallpaper) {
    document.body.style.background = `linear-gradient(rgba(0,0,0,0.16), rgba(0,0,0,0.16)), url("${state.wallpaper}") center / cover fixed no-repeat`;
  } else {
    document.body.style.background = "";
  }
}

function loadAccountIntoState(account) {
  if (!account) return;

  const studentId = String(
    account.studentId || account.student_id || account.code || ""
  )
    .trim()
    .toUpperCase();

  const normalizedAccount = {
    ...account,
    studentId
  };

  const localAvatar =
    state.localAvatarOverrides?.[studentId] || "";

  saveCurrentAccount(normalizedAccount);

  state.avatar = localAvatar || normalizedAccount.avatar || getDefaultAvatar(studentId);
  state.userStatus = normalizedAccount.userStatus || "online";
  state.profile = normalizedAccount.profile || {
    forumId: normalizedAccount.forumId || normalizedAccount.name || studentId,
    gender: "未设定",
    signature: normalizedAccount.signature || "",
    identityType: "student",
    immutableCode: studentId,
    identityGroups: normalizedAccount.identityGroups || ["已认证"]
  };

  saveAuthSession({
    loggedIn: true,
    isGuest: false,
    studentId
  });

  localStorage.setItem(STORAGE_KEYS.avatar, state.avatar);
  localStorage.setItem(STORAGE_KEYS.userStatus, state.userStatus);
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(state.profile));
}

function loadGuestState(guestId = getGuestDeviceId()) {
  const guestProfile = {
    forumId: guestId,
    gender: "未设定",
    signature: "游客访问中。",
    identityType: "guest",
    immutableCode: guestId,
    identityGroups: ["未认证"]
  };

  state.avatar = getDefaultAvatar(guestId);
  state.userStatus = "online";
  state.profile = guestProfile;

  // 游客也保存一份当前账号资料，方便页面显示游客名字
  saveCurrentAccount({
    studentId: guestId,
    forumId: guestId,
    name: guestId,
    avatar: state.avatar,
    userStatus: "online",
    profile: guestProfile,
    identityGroups: ["未认证"],
    accountKind: "guest"
  });

  localStorage.setItem(STORAGE_KEYS.avatar, state.avatar);
  localStorage.setItem(STORAGE_KEYS.userStatus, state.userStatus);
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(guestProfile));
}

function showAuthOverlay() {
  const overlay = document.getElementById("authOverlay");
  const app = document.getElementById("app");

  document.body.classList.add("auth-locked");
  overlay?.classList.add("active");

  if (app) app.style.display = "none";

  resetAuthPanel();
}

function hideAuthOverlay() {
  const overlay = document.getElementById("authOverlay");
  const app = document.getElementById("app");

  document.body.classList.remove("auth-locked");
  overlay?.classList.remove("active");

  if (app) app.style.display = "block";
}

function resetAuthPanel() {
  const studentInput = document.getElementById("authStudentIdInput");
  const accessCodeInput = document.getElementById("authAccessCodeInput");

  if (studentInput) studentInput.value = "";
  if (accessCodeInput) accessCodeInput.value = "";

  updateAuthPreview();
}


async function updateAuthPreview() {
  const input = document.getElementById("authStudentIdInput");
  const previewStudentId = document.getElementById("authPreviewStudentId");
  const previewAvatar = document.getElementById("authAvatarPreview");

  const value = input?.value.trim() || "";
  const currentRequestId = ++previewRequestId;

  if (previewStudentId) {
    previewStudentId.textContent = value || "请输入学号";
  }

  if (!previewAvatar) return;

  if (!value) {
    previewAvatar.src = getDefaultAvatar("NightWatch");
    return;
  }

    if (!looksLikeStudentId(value)) {
    previewAvatar.src = getDefaultAvatar(value);

    if (previewStudentId) {
      previewStudentId.textContent = value;
    }

    return;
  }

  try {
    const response = await fetch(
      `${API_BASE}/api/account-preview/${encodeURIComponent(value)}`
    );

    const data = await response.json();

    if (currentRequestId !== previewRequestId) return;

    if (response.ok && data.success && data.account) {
      previewAvatar.src = data.account.avatar || getDefaultAvatar(value);

      if (previewStudentId) {
        previewStudentId.textContent =
          `${data.account.forumId} / ${data.account.studentId}`;
      }
      return;
    }

    previewAvatar.src = getDefaultAvatar(value);
  } catch (error) {
    if (currentRequestId !== previewRequestId) return;

    previewAvatar.src = getDefaultAvatar(value);
  }
}


function emitAuthChanged() {
  window.dispatchEvent(new CustomEvent("auth:changed"));
}

function getStudentIdInputValue() {
  return document.getElementById("authStudentIdInput")?.value.trim() || "";
}

function getAccessCodeInputValue() {
  return document.getElementById("authAccessCodeInput")?.value.trim() || "";
}
