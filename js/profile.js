import {
  state,
  saveAvatar,
  saveUserStatus,
  saveProfile,
  saveLocalAvatarOverrides
} from "./state.js";

import { getRouteTitle } from "./router.js";
import { syncCurrentAccountData, isGuestMode } from "./auth.js";

const API_BASE = "http://43.135.26.183:3000";

let avatarClickTimer = null;

export function initProfile() {
  renderProfile();
  window.addEventListener("auth:changed", renderProfile);

  const profileEntryCard = document.getElementById("profileEntryCard");
  const closeProfileHomeBtn = document.getElementById("closeProfileHomeBtn");
  const avatarFileInput = document.getElementById("avatarFileInput");
  const profileHomeAvatarBox = document.getElementById("profileHomeAvatarBox");
  const avatarPreviewModal = document.getElementById("avatarPreviewModal");
  const avatarPreviewClose = document.getElementById("avatarPreviewClose");
  const saveProfileBtn = document.getElementById("saveProfileBtn");

  profileEntryCard?.addEventListener("click", openProfileHome);
  closeProfileHomeBtn?.addEventListener("click", closeProfileHome);
  avatarFileInput?.addEventListener("change", handleAvatarFileUpload);

  profileHomeAvatarBox?.addEventListener("click", (event) => {
    event.stopPropagation();
    clearTimeout(avatarClickTimer);
    avatarClickTimer = setTimeout(() => {
      openAvatarPreview();
    }, 220);
  });

  profileHomeAvatarBox?.addEventListener("dblclick", (event) => {
    event.preventDefault();
    event.stopPropagation();
    clearTimeout(avatarClickTimer);
    chooseAvatarChangeMode();
  });

  avatarPreviewClose?.addEventListener("click", closeAvatarPreview);

  avatarPreviewModal?.addEventListener("click", (event) => {
    if (event.target === avatarPreviewModal) {
      closeAvatarPreview();
    }
  });

  saveProfileBtn?.addEventListener("click", handleSaveProfile);

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      closeAvatarPreview();
      closeProfileHome();
    }
  });

  bindSideSwitchTabs();

}

export function renderProfile() {
  const sidebarAvatar = document.getElementById("userAvatar");
  const homeAvatar = document.getElementById("profileHomeAvatar");
  const previewAvatar = document.getElementById("avatarPreviewImg");

  const sidebarFallback = document.querySelector(".bbs-avatar-fallback");
  const homeFallback = document.querySelector(".profile-home-avatar-fallback");

  const userStatusText = document.getElementById("userStatusText");
  const profileHomeStatusText = document.getElementById("profileHomeStatusText");

  const userName = document.getElementById("userName");
  const profileHomeName = document.getElementById("profileHomeName");
  const userCodeText = document.getElementById("userCodeText");

  const profileHomeCodeLine = document.getElementById("profileHomeCodeLine");
  const profileHomeSignature = document.getElementById("profileHomeSignature");
  const profileGroupList = document.getElementById("profileGroupList");

  const profileForumIdInput = document.getElementById("profileForumIdInput");
  const profileGenderInput = document.getElementById("profileGenderInput");
  const profileRealNameInput = document.getElementById("profileRealNameInput");

  const profileSignatureInput = document.getElementById("profileSignatureInput");
  const profileDisplayGroupInput = document.getElementById("profileDisplayGroupInput");
  const profileDisplayGroupPreview = document.getElementById("profileDisplayGroupPreview");
  const saveProfileBtn = document.getElementById("saveProfileBtn");

  const isGuest = isGuestMode();

  [
  profileForumIdInput,
  profileGenderInput,
  profileSignatureInput,
  profileDisplayGroupInput
].forEach((el) => {
  if (el) el.disabled = isGuest;
});

  if (saveProfileBtn) {
    saveProfileBtn.disabled = isGuest;
    saveProfileBtn.textContent = isGuest ? "游客不可修改资料" : "保存资料";
  }

  const profile = state.profile || {};

  if (userName) userName.textContent = profile.forumId || "未命名用户";
  if (profileHomeName) profileHomeName.textContent = profile.forumId || "未命名用户";

  if (userStatusText) userStatusText.textContent = state.userStatus.toUpperCase();
  if (profileHomeStatusText) profileHomeStatusText.textContent = state.userStatus.toUpperCase();

  if (userCodeText) {
    userCodeText.textContent = `ID: ${profile.immutableCode || "UNKNOWN"}`;
  }

  if (profileHomeCodeLine) {
    profileHomeCodeLine.textContent = `${getCodeLabel(profile.identityType)}：${profile.immutableCode || "UNKNOWN"}`;
  }

  if (profileHomeSignature) {
    profileHomeSignature.textContent = profile.signature || "暂无个签。";
  }

  if (profileForumIdInput) profileForumIdInput.value = profile.forumId || "";
  if (profileGenderInput) profileGenderInput.value = profile.gender || "";
  if (profileSignatureInput) profileSignatureInput.value = profile.signature || "";

  if (profileDisplayGroupInput) {
    const options = Array.isArray(profile.displayGroupOptions) ? profile.displayGroupOptions : [];
    const currentValue = String(profile.displayGroup || "");

    profileDisplayGroupInput.innerHTML = [
      `<option value="">不佩戴</option>`,
      ...options.map((item) => {
        const optionLabel = item.groupKey === item.value
          ? item.value
          : `${item.groupKey} · ${item.value}`;
        return `<option value="${escapeHtml(item.value)}">${escapeHtml(optionLabel)}</option>`;
      })
    ].join("");

    profileDisplayGroupInput.value = currentValue;
    renderDisplayGroupPreview(profileDisplayGroupPreview, currentValue);
profileDisplayGroupInput.onchange = () => {
  renderDisplayGroupPreview(profileDisplayGroupPreview, profileDisplayGroupInput.value);
};
  }

  renderGroupTags(profileGroupList, profile.identityGroups || [], profile.displayGroup || "");

  if (previewAvatar) {
    previewAvatar.src = state.avatar;
  }

  if (sidebarAvatar) {
    sidebarAvatar.src = state.avatar;
    sidebarAvatar.onload = () => {
      sidebarAvatar.style.display = "block";
      if (sidebarFallback) sidebarFallback.style.display = "none";
    };
    sidebarAvatar.onerror = () => {
      sidebarAvatar.style.display = "none";
      if (sidebarFallback) sidebarFallback.style.display = "flex";
    };
  }

  if (homeAvatar) {
    homeAvatar.src = state.avatar;
    homeAvatar.onload = () => {
      homeAvatar.style.display = "block";
      if (homeFallback) homeFallback.style.display = "none";
    };
    homeAvatar.onerror = () => {
      homeAvatar.style.display = "none";
      if (homeFallback) homeFallback.style.display = "flex";
    };
  }
}

function renderGroupTags(container, groups, displayGroup = "") {
  if (!container) return;

  const normalized = normalizeGroups(groups);

  container.innerHTML = normalized.map((group) => {
    const className =
      group === "已认证" ? "verified" :
      group === "未认证" ? "unverified" :
      "normal";

    const activeClass = group === displayGroup ? " active-display" : "";
    return `<span class="profile-group-tag ${className}${activeClass}">${group}</span>`;
  }).join("");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function normalizeGroups(groups) {
  const list = Array.isArray(groups) ? groups : [];
  const cleaned = list.map((item) => String(item).trim()).filter(Boolean);

  if (!cleaned.length) return ["已认证"];

  const hasVerified = cleaned.includes("已认证");
  const hasUnverified = cleaned.includes("未认证");

  const result = [...new Set(cleaned.filter((item) => item !== "已认证" && item !== "未认证"))];

  if (hasUnverified && !hasVerified) {
    return ["未认证", ...result];
  }

  return ["已认证", ...result];
}

function getCodeLabel(identityType) {
  if (state.profile.immutableCode === "GUEST") return "游客编号";
  if (identityType === "exec") return "执行部编号";
  if (identityType === "staff") return "教职编号";
  return "学号";
}

function updateProfileBreadcrumb() {
  const breadcrumb = document.getElementById("forumBreadcrumb");
  if (!breadcrumb) return;

  breadcrumb.textContent = "守夜人论坛 → 个人主页";
}

function openProfileHome() {
  const studentId = String(
    state.authSession?.studentId ||
      state.currentAccount?.studentId ||
      state.currentAccount?.student_id ||
      ""
  )
    .trim()
    .toUpperCase();

  const dramaStudentIds = [
    "AI060143",
    "AI112933",
    "AI071721",
    "AI102403",
    "AI100598"
  ];

  // 剧情角色登录后，点击自己的资料卡，打开剧情角色主页
  // 不打开普通个人资料页面
  if (dramaStudentIds.includes(studentId)) {
    window.dispatchEvent(
      new CustomEvent("social:open-own-character-profile", {
        detail: {
          studentId
        }
      })
    );
    return;
  }

  const overlay = document.getElementById("profileHomeOverlay");
  const routeTitle = document.getElementById("routeTitle");

  overlay?.classList.add("active");
  overlay?.classList.add("top-layer");

  if (routeTitle) routeTitle.textContent = "个人主页";

  if (window.ForumNav) {
    window.ForumNav.pushOrReplace(
      "个人主页",
      () => {
        overlay?.classList.remove("active");
        overlay?.classList.remove("top-layer");
      },
      {
        type: "self-profile",
        key: "self"
      }
    );
  } else {
    updateProfileBreadcrumb();
  }
}

function closeProfileHome() {
  const overlay = document.getElementById("profileHomeOverlay");
  const routeTitle = document.getElementById("routeTitle");

  const wasOpen = overlay?.classList.contains("active");

  if (!wasOpen) {
    return;
  }

  overlay?.classList.remove("active");
  overlay?.classList.remove("top-layer");

  if (routeTitle) routeTitle.textContent = getRouteTitle();

  if (window.ForumNav?.backOnly) {
    window.ForumNav.backOnly();
  } else if (window.ForumNav?.back) {
    window.ForumNav.back();
  } else {
    window.dispatchEvent(new CustomEvent("forum:refresh-breadcrumb"));
  }
}

function openAvatarPreview() {
  const modal = document.getElementById("avatarPreviewModal");
  const previewImg = document.getElementById("avatarPreviewImg");

  if (!modal || !previewImg || !state.avatar) return;

  previewImg.src = state.avatar;
  modal.classList.add("active");
}

function closeAvatarPreview() {
  const modal = document.getElementById("avatarPreviewModal");
  modal?.classList.remove("active");
}

function chooseAvatarChangeMode() {
  const avatarFileInput = document.getElementById("avatarFileInput");
  const mode = prompt(
    "更换头像：\n输入 1 = 本地上传（仅保存在当前浏览器）\n输入 2 = 图片链接（保存到账号数据库）",
    "1"
  );

  if (mode === null) return;

  const value = mode.trim();

  if (value === "1") {
    avatarFileInput?.click();
    return;
  }

  if (value === "2") {
    handleAvatarUrlImport();
    return;
  }

  alert("请输入 1 或 2。");
}

function handleAvatarFileUpload(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  if (!state.authSession.loggedIn || state.authSession.isGuest || !state.authSession.studentId) {
    alert("请先登录正式账号后再设置本地头像。");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();

  reader.onload = () => {
    const studentId = state.authSession.studentId;
    const nextOverrides = {
      ...(state.localAvatarOverrides || {}),
      [studentId]: reader.result
    };

    saveLocalAvatarOverrides(nextOverrides);
    saveAvatar(reader.result);
    renderProfile();
    alert("本地头像已保存，仅保存在当前浏览器。");
  };

  reader.readAsDataURL(file);
  event.target.value = "";
}

function bindSideSwitchTabs() {
  const tabs = document.querySelectorAll(".side-switch-tab");
  const views = {
    messages: document.getElementById("sideTabMessages"),
    friends: document.getElementById("sideTabFriends"),
    groups: document.getElementById("sideTabGroups")
  };

  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.dataset.sideTab;

      tabs.forEach((item) => {
        item.classList.toggle("active", item === tab);
      });

      Object.entries(views).forEach(([name, view]) => {
        if (!view) return;
        const isActive = name === key;
        view.hidden = !isActive;
        view.classList.toggle("active", isActive);
      });
    });
  });
}

async function handleAvatarUrlImport() {
  const url = prompt("请输入头像图片链接：", state.avatar || "");
  if (url === null) return;

  const trimmed = url.trim();
  if (!trimmed) return;

  if (!state.authSession.loggedIn || state.authSession.isGuest || !state.authSession.studentId) {
    alert("请先登录正式账号后再设置数据库头像。");
    return;
  }

  const studentId = state.authSession.studentId;
  const nextOverrides = {
    ...(state.localAvatarOverrides || {})
  };

  delete nextOverrides[studentId];
  saveLocalAvatarOverrides(nextOverrides);

  const ok = await syncCurrentAccountData({
    avatar: trimmed,
    userStatus: state.userStatus
  });

  if (!ok) {
    alert("头像链接保存失败，请检查链接是否有效。");
    return;
  }

  renderProfile();
  alert("头像链接已保存到数据库。");
}

async function handleSaveProfile() {
  const forumId = document.getElementById("profileForumIdInput")?.value.trim() || "未命名用户";
  const gender = document.getElementById("profileGenderInput")?.value.trim() || "未设定";
  const signature = document.getElementById("profileSignatureInput")?.value.trim() || "暂无个签。";
  const displayGroup = document.getElementById("profileDisplayGroupInput")?.value || "";
  const realName = document.getElementById("profileRealNameInput")?.value.trim() || "";

  const identityType = state.profile?.identityType || "student";
  const identityGroups = Array.isArray(state.profile?.identityGroups)
    ? state.profile.identityGroups
    : [];

  if (!state.authToken || !state.authSession.loggedIn || state.authSession.isGuest) {
    alert("当前账号不可保存资料，请先登录正式账户。");
    return;
  }

  try {
    const response = await fetch(`${API_BASE}/api/profile`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${state.authToken}`
      },
      body: JSON.stringify({
        forumId,
        gender,
        signature,
        identityType,
        identityGroups,
        displayGroup
      })
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      alert(data.message || "资料保存失败。");
      return;
    }

    saveProfile(data.user.profile);

    
    // 单独保存真名
    fetch(`${API_BASE}/api/real-name`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${state.authToken}`
      },
      body: JSON.stringify({ realName })
    }).catch(() => {});

if (data.user) {
  state.currentAccount = data.user;
  state.account = data.user;
  localStorage.setItem("cassell_current_account", JSON.stringify(data.user));
}

window.dispatchEvent(new CustomEvent("auth:changed"));
window.dispatchEvent(new CustomEvent("profile:changed"));

renderProfile();
alert("个人资料已保存到后端。");

  } catch (error) {
    console.error("保存资料失败：", error);
    alert("无法连接到后端，请确认后端服务已启动。");
  }
}

async function resetAvatar() {
  const studentId = state.authSession.studentId;
  const seed = state.profile?.immutableCode || "CassellForum";
  const defaultAvatar = `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;

  if (studentId) {
    const nextOverrides = {
      ...(state.localAvatarOverrides || {})
    };
    delete nextOverrides[studentId];
    saveLocalAvatarOverrides(nextOverrides);
  }

  const ok = await syncCurrentAccountData({
    avatar: defaultAvatar,
    userStatus: state.userStatus
  });

  if (!ok) {
    alert("默认头像恢复失败。");
    return;
  }

  renderProfile();
}

async function toggleUserStatus() {
  const nextStatus = state.userStatus === "online" ? "offline" : "online";

  const ok = await syncCurrentAccountData({
    userStatus: nextStatus
  });

  if (!ok) {
    alert("状态同步失败。");
    return;
  }

  saveUserStatus(nextStatus);
  renderProfile();
}

document.getElementById("resetAvatarBtn")?.addEventListener("click", resetAvatar);
document.getElementById("toggleStatusBtn")?.addEventListener("click", toggleUserStatus);

let profileNormaGroupsCache = [];

async function loadProfileNormaGroups() {
  try {
    const res = await fetch(`${API_BASE}/api/norma/groups`);
    const data = await res.json();

    if (data.success && Array.isArray(data.groups)) {
      profileNormaGroupsCache = data.groups;
      renderProfile();
    }
  } catch (error) {
    console.warn("加载身份组颜色失败：", error);
  }
}

function getProfileNormaGroupByName(name) {
  const target = String(name || "").trim();
  if (!target) return null;

  return profileNormaGroupsCache.find((g) => {
    const groupName = String(g.name || "").trim();
    const badgeText = String(g.badgeText || g.badge_text || "").trim();

    const beautifyTexts = Array.isArray(g.beautifyTexts)
      ? g.beautifyTexts
      : Array.isArray(g.beautify_texts)
        ? g.beautify_texts
        : String(g.beautifyTexts || g.beautify_texts || "")
            .split(/[\n,，/]/)
            .map((item) => item.trim())
            .filter(Boolean);

    return (
      groupName === target ||
      badgeText === target ||
      beautifyTexts.includes(target)
    );
  }) || null;
}

function getProfileNormaGroupColor(group) {
  if (!group) return "";

  const directColor = String(group.color || "").trim();
  if (directColor) return directColor;

  const colorList = Array.isArray(group.colors)
    ? group.colors
    : String(group.colors || group.color_list || "")
        .split(/[\n,，]/)
        .map((item) => item.trim())
        .filter(Boolean);

  if (colorList.length >= 2) {
    return `linear-gradient(90deg, ${colorList.join(", ")})`;
  }

  if (colorList.length === 1) {
    return colorList[0];
  }

  return "";
}

function renderDisplayGroupPreview(container, groupName) {
  if (!container) return;

  const name = String(groupName || "").trim();

  if (!name) {
    container.innerHTML = `
      <div class="display-group-preview-empty">
        当前不佩戴身份组
      </div>
    `;
    return;
  }

  const group = getProfileNormaGroupByName(name);
  const color = getProfileNormaGroupColor(group);

  const nameStyle = color
    ? (
      color.includes("gradient")
        ? `background:${color};-webkit-background-clip:text;background-clip:text;color:transparent;`
        : `color:${color};`
    )
    : "";

  const badgeStyle = color
    ? `background:${color};color:#fff;`
    : "";

  const iconHtml = group?.icon
    ? `<img src="${escapeHtml(group.icon)}" class="badge-icon" alt="" />`
    : "";

  container.innerHTML = `
    <div class="display-group-preview-card">
      <div class="display-group-preview-title">标签预览</div>

      <div class="display-group-preview-line">
        <span class="author-name-text author-name-colored" style="${nameStyle}">
          ${escapeHtml(state.profile?.forumId || "论坛ID")}
        </span>

        <span class="identity-badge identity-badge-bubble" style="${badgeStyle}">
          ${iconHtml}${escapeHtml(name)}
        </span>
      </div>
    </div>
  `;
}

loadProfileNormaGroups();
