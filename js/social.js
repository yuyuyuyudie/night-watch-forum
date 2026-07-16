import {
  inboxMessages,
  friends,
  groups,
  systemNoticeItems,
  privateChats
} from "./data.js";

import {
  state,
  saveCharacterAccountSettings,
  saveNormaBotSettings,
  loadMemoryBook as loadMB,
  saveMemoryBook as saveMB,
  deleteMemoryBook as deleteMB,
  getApiForPurpose
} from "./state.js";

// ====== 新增：预先加载身份组颜色 ======
const API_BASE_URL = "http://43.135.26.183:3000";
const PRIVATE_CHAT_STORAGE_KEY_PREFIX = "cassell_private_chats_v1";
const GROUP_CHAT_STORAGE_KEY_PREFIX = "cassell_group_chats_v1";
const groupChats = [];
// 用户自己创建的群聊（存在 localStorage）
const userGroupChats = [];

function getMyGroupsStorageKey() {
  const sid =
    state.authSession?.studentId ||
    state.currentAccount?.studentId ||
    "guest";
  return `cassell_my_groups_v1_${String(sid).toUpperCase()}`;
}

function loadMyGroups() {
  try {
    const raw = localStorage.getItem(getMyGroupsStorageKey());
    if (!raw) return;
    const arr = JSON.parse(raw);
    if (Array.isArray(arr)) {
      userGroupChats.splice(0, userGroupChats.length, ...arr);
    }
  } catch (e) {
    console.warn("读取我的群聊失败：", e);
  }
}

function saveMyGroups() {
  try {
    localStorage.setItem(
      getMyGroupsStorageKey(),
      JSON.stringify(userGroupChats)
    );
  } catch (e) {
    console.warn("保存我的群聊失败：", e);
  }
}

// 生成一个 8 位邀请码
function generateInviteCode() {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 8; i++) {
    code += chars[Math.floor(Math.random() * chars.length)];
  }
  return code;
}

// 通过 group 对象打开群聊（兼容旧 groupChats）
function openGroupByGroup(group) {
  let chat = findGroupChat(group);
  if (!chat) {
    chat = createGroupChat(group);
  }
  openGroupChat(chat);
}

function getPrivateChatStorageKey() {
  const studentId =
    state.authSession?.studentId ||
    state.currentAccount?.studentId ||
    "guest";

  return `${PRIVATE_CHAT_STORAGE_KEY_PREFIX}_${String(studentId).toUpperCase()}`;
}

function getGroupChatStorageKey() {
  const studentId =
    state.authSession?.studentId ||
    state.currentAccount?.studentId ||
    "guest";

  return `${GROUP_CHAT_STORAGE_KEY_PREFIX}_${String(studentId).toUpperCase()}`;
}

let normaGroupsCache = [];
let realFriendRequestItems = [];
let lastUserSearchResults = [];

// 诺玛：论坛助手 bot，登录后永远在好友列表里，不用加好友
const NORMA_CONTACT = {
  name: "诺玛",
  forumId: "诺玛",
  code: "AI000000",
  codeKind: "student",
  avatar: "https://i.ibb.co/jktdRJ2v/IMG-20260609-181805.png",
  status: "online",
  accountKind: "norma_bot",
  desc: "我会一直保持在线。",
  signature: "我会一直保持在线。",
  identityGroups: ["已认证", "学院秘书"],
  friendshipStatus: "friends"
};

async function loadNormaGroups() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/norma/groups`);
    const data = await res.json();
    if (data.success) {
      normaGroupsCache = data.groups;
    }
  } catch (e) {
    console.warn("加载身份组失败:", e);
  }
}
loadNormaGroups();

function getAuthHeaders() {
  return state.authToken
    ? {
        Authorization: `Bearer ${state.authToken}`
      }
    : {};
}

function getSignedInStudentId() {
  const candidates = [
    state.authSession?.studentId,
    state.authSession?.student_id,
    state.currentAccount?.studentId,
    state.currentAccount?.student_id,
    state.currentAccount?.code,
    state.profile?.studentId,
    state.profile?.student_id,
    state.profile?.code
  ];

  for (const value of candidates) {
    const id = String(value || "").trim().toUpperCase();
    if (id) return id;
  }

  return "";
}

const DRAMA_STUDENT_IDS = [
  "AI060143",
  "AI112933",
  "AI071721",
  "AI102403",
  "AI100598"
];

function accountToContact(user) {
  const studentId = String(user.studentId || user.code || "").toUpperCase();
  const isDramaCharacter = DRAMA_STUDENT_IDS.includes(studentId);

  return {
    name: user.name || user.forumId || user.studentId,
    forumId: user.forumId || user.name || user.studentId,
    code: user.studentId || user.code,
    codeKind: "student",
    avatar: user.avatar || "",
    status: user.status || "online",
    accountKind: isDramaCharacter ? "character_account" : "real_user",
    desc: user.desc || user.signature || "",
    signature: user.signature || user.desc || "",
    identityGroups: user.identityGroups || ["已认证"],
    friendshipStatus: user.friendshipStatus || "none"
  };
}

async function loadRealFriendsAndRequests() {
  if (!state.authToken || state.authSession?.isGuest) {
    // 没登录也至少放一个诺玛
    friends.splice(0, friends.length, NORMA_CONTACT);
    realFriendRequestItems = [];
    renderSidebarMessages();
    renderFriends();
    return;
  }

  try {
    const [friendsRes, requestsRes] = await Promise.all([
      fetch(`${API_BASE_URL}/api/social/friends`, {
        headers: {
          ...getAuthHeaders()
        }
      }),
      fetch(`${API_BASE_URL}/api/social/friend-requests/incoming`, {
        headers: {
          ...getAuthHeaders()
        }
      })
    ]);

    const friendsData = await friendsRes.json();
    const requestsData = await requestsRes.json();

    if (friendsData.success && Array.isArray(friendsData.friends)) {
      // 后端返回的真人好友里，先把诺玛过滤掉，避免重复
      const realContacts = friendsData.friends
        .map(accountToContact)
        .filter((c) => String(c.code || "").toUpperCase() !== "AI000000");

      // 诺玛永远固定排在最前面
      friends.splice(0, friends.length, NORMA_CONTACT, ...realContacts);
    } else {
      // 就算没有任何真人好友，也至少保留诺玛
      friends.splice(0, friends.length, NORMA_CONTACT);
    }

    if (requestsData.success && Array.isArray(requestsData.requests)) {
      realFriendRequestItems = requestsData.requests;
    } else {
      realFriendRequestItems = [];
    }

    renderSidebarMessages();
    renderFriends();

    await enrichFriendsWithDramaData();
  } catch (error) {
    console.warn("加载真人好友数据失败：", error);
    friends.splice(0, friends.length, NORMA_CONTACT);
    realFriendRequestItems = [];
    renderSidebarMessages();
    renderFriends();

    await enrichFriendsWithDramaData();
  }
}

// ====== 剧情角色时间线资料：从后端拉取，补充进好友列表 ======

let dramaCharactersCache = [];

async function enrichFriendsWithDramaData() {
  try {
    const res = await fetch(
  `${API_BASE_URL}/api/drama/characters?t=${Date.now()}`,
  {
    cache: "no-store",
    headers: {
      ...getAuthHeaders()
    }
  }
);
    const data = await res.json();

    if (data.success && Array.isArray(data.characters)) {
      dramaCharactersCache = data.characters;
    }
  } catch (e) {
    console.warn("拉取剧情角色资料失败:", e);
    return;
  }

  if (!dramaCharactersCache.length) return;

  for (const friend of friends) {
    // 只给剧情角色账号补充时间线资料
    if (friend.accountKind !== "character_account") {
      continue;
    }

    const studentId = String(friend.code || friend.studentId || "").toUpperCase();
    if (!studentId) continue;

    const dramaData = dramaCharactersCache.find(
      (c) => String(c.studentId).toUpperCase() === studentId
    );

    if (!dramaData) continue;

    friend.accountKind = "character_account";
    friend.name = dramaData.trueName || friend.name;
    friend.characterId = dramaData.studentId;
    friend.timelines = dramaData.timelines || [];
    friend.defaultTimelineId = dramaData.timelines?.[0]?.id || "";
  }

  renderFriends();
  renderSidebarMessages();
}

async function searchRealUsers(keyword) {
  const q = String(keyword || "").trim();

  if (!q) {
    lastUserSearchResults = [];
    renderFriends();
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(q)}`, {
      headers: {
        ...getAuthHeaders()
      }
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || "搜索失败。");
      return;
    }

    lastUserSearchResults = Array.isArray(data.users)
      ? data.users.map(accountToContact)
      : [];

    renderFriends();
  } catch (error) {
    console.error("搜索用户失败：", error);
    alert("搜索失败，请确认后端已启动。");
  }
}

async function sendFriendRequest(targetStudentId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/social/friend-requests`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders()
      },
      body: JSON.stringify({
        targetStudentId
      })
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || "发送好友申请失败。");
      return;
    }

        alert(data.message || "好友申请已发送。");

    // 先拉最新好友列表，再判断当前主页应该显示什么按钮
    await loadRealFriendsAndRequests();

    if (currentContact) {
      // 看这个人现在是不是已经在好友里了（角色账号会自动通过）
      const isFriendNow = friends.some((f) => {
        if (!f) return false;
        if (f.code && currentContact.code && f.code === currentContact.code) return true;
        if (f.forumId && currentContact.forumId && f.forumId === currentContact.forumId) return true;
        return false;
      });

      if (isFriendNow) {
        currentContact.friendshipStatus = "friends";
      } else {
        currentContact.friendshipStatus = data.friendshipStatus || "sent";
      }

      openContactProfile(currentContact);
    }

  } catch (error) {
    console.error("发送好友申请失败：", error);
    alert("发送好友申请失败。");
  }
}

async function acceptFriendRequest(requestId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/social/friend-requests/${encodeURIComponent(requestId)}/accept`, {
      method: "POST",
      headers: {
        ...getAuthHeaders()
      }
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || "通过好友申请失败。");
      return;
    }

    alert("已通过好友申请。");
    await loadRealFriendsAndRequests();
    openSystemNotice();
  } catch (error) {
    console.error("通过好友申请失败：", error);
    alert("通过好友申请失败。");
  }
}

async function rejectFriendRequest(requestId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/social/friend-requests/${encodeURIComponent(requestId)}/reject`, {
      method: "POST",
      headers: {
        ...getAuthHeaders()
      }
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      alert(data.message || "拒绝好友申请失败。");
      return;
    }

    alert("已拒绝好友申请。");
    await loadRealFriendsAndRequests();
    openSystemNotice();
  } catch (error) {
    console.error("拒绝好友申请失败：", error);
    alert("拒绝好友申请失败。");
  }
}

function loadSavedPrivateChats() {
  try {
    // 重点：换账号时先清空当前页面里的旧聊天
    privateChats.splice(0, privateChats.length);

    const raw = localStorage.getItem(getPrivateChatStorageKey());
    if (!raw) return;

    const savedChats = JSON.parse(raw);
    if (!Array.isArray(savedChats)) return;

    privateChats.splice(0, privateChats.length, ...savedChats);
  } catch (error) {
    console.warn("读取私聊记录失败：", error);
    privateChats.splice(0, privateChats.length);
  }
}

function savePrivateChats() {
  try {
    localStorage.setItem(getPrivateChatStorageKey(), JSON.stringify(privateChats));
  } catch (error) {
    console.warn("保存私聊记录失败：", error);
  }
}

function getCurrentStudentId() {
  return String(
    state.authSession?.studentId ||
      state.currentAccount?.studentId ||
      ""
  )
    .trim()
    .toUpperCase();
}

function getPrivatePersonalKey(chat) {
  return `private_personal_${chat?.id}_${getCurrentStudentId()}`;
}

function getGroupPersonalKey(chat) {
  const groupKey = String(
    chat?.groupKey ||
      chat?.id ||
      chat?.name ||
      ""
  )
    .trim()
    .toLowerCase();

  return `group_personal_${groupKey}_${getCurrentStudentId()}`;
}

function loadChatPersonalSettings(key) {
  try {
    const raw = localStorage.getItem(key);
    const settings = raw ? JSON.parse(raw) : {};

    return settings && typeof settings === "object"
      ? settings
      : {};
  } catch {
    return {};
  }
}

function saveChatPersonalSettings(key, settings) {
  try {
    localStorage.setItem(key, JSON.stringify(settings || {}));
  } catch (e) {
    console.warn("保存聊天个人设置失败:", e);
  }
}

function loadSavedGroupChats() {
  try {
    groupChats.splice(0, groupChats.length);

    const raw = localStorage.getItem(getGroupChatStorageKey());
    if (!raw) return;

    const saved = JSON.parse(raw);
    if (!Array.isArray(saved)) return;

    groupChats.splice(0, groupChats.length, ...saved);
  } catch (error) {
    console.warn("读取群聊记录失败：", error);
    groupChats.splice(0, groupChats.length);
  }
}

function saveGroupChats() {
  try {
    localStorage.setItem(getGroupChatStorageKey(), JSON.stringify(groupChats));
  } catch (error) {
    console.warn("保存群聊记录失败：", error);
  }
}

function getChatLastActiveMs(chat) {
  if (!chat) return 0;

  if (Number(chat.lastActiveAt) > 0) {
    return Number(chat.lastActiveAt);
  }

  const messages = Array.isArray(chat.messages) ? chat.messages : [];
  if (!messages.length) return 0;

  const last = messages[messages.length - 1];
  return Number(last?.createdAt || 0);
}

export function getFriendShareSortTime(friend) {
  const chat = findChatForContact(friend);
  return getChatLastActiveMs(chat);
}

export function getGroupShareSortTime(group) {
  const chat = findGroupChat(group);
  return getChatLastActiveMs(chat);
}

function getGroupKey(group) {
  return String(group?.id || group?.name || "").trim().toLowerCase();
}

function findGroupChat(group) {
  const key = getGroupKey(group);
  if (!key) return null;

  return (
    groupChats.find((chat) => {
      const chatKey = String(chat.groupKey || chat.id || chat.name || "")
        .trim()
        .toLowerCase();
      return chatKey === key || String(chat.name || "") === String(group?.name || "");
    }) || null
  );
}

function createGroupChat(group) {
  const name = String(group?.name || "未命名群聊");
  const key = getGroupKey(group) || name;

  const newChat = {
    id: `group-${key}-${Date.now()}`,
    groupKey: key,
    name,
    avatar: group?.avatar || getDefaultAvatar(name),
    members: Number(group?.members || 0),
    desc: group?.desc || "",
    messages: [],
    lastActiveAt: 0,
    // 把群聊数据也带到聊天窗口里，这样设置面板能找到
    ownerId: group?.ownerId || "",
    managerIds: Array.isArray(group?.managerIds) ? group.managerIds : [],
    memberList: Array.isArray(group?.memberList) ? group.memberList : [],
    inviteCode: group?.inviteCode || "",
    inviteCodeUsed: !!group?.inviteCodeUsed,
    announcement: group?.announcement || "",
    notice: group?.notice || ""
  };

  groupChats.unshift(newChat);
  saveGroupChats();
  return newChat;
}

function touchChatActive(chat) {
  if (!chat) return;
  chat.lastActiveAt = Date.now();
}

function findNormaGroupByDisplayText(name) {
  const target = String(name || "").trim();
  if (!target) return null;

  return normaGroupsCache.find((g) => {
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

function getNormaGroupColorForBadge(group) {
  if (!group) return "";

  const directColor = String(group.color || "").trim();
  if (directColor) return directColor;

  const colorList = Array.isArray(group.colors)
    ? group.colors
    : String(group.colors || "")
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

function renderIdentityBadge(name) {
  const safeName = escapeHtml(name || "");
  if (!safeName) return "";

  const grp = findNormaGroupByDisplayText(name);
  const color = getNormaGroupColorForBadge(grp);

  const style = color
    ? `background:${color};color:#fff;`
    : "";

  const iconHtml = grp?.icon
    ? `<img src="${escapeHtml(grp.icon)}" class="badge-icon" />`
    : "";

  return `
    <span class="identity-badge identity-badge-bubble" style="${style}">
      ${iconHtml}${safeName}
    </span>
  `;
}

function getPreviewColorFromInput(value) {
  const colors = splitLinesOrComma(value || "");

  if (!colors.length) {
    return "#ff6600";
  }

  if (colors.length === 1) {
    return colors[0];
  }

  return `linear-gradient(90deg, ${colors.join(", ")})`;
}

function getReadableTextColorFromInput(value) {
  const colors = splitLinesOrComma(value || "");
  const firstColor = String(colors[0] || "").trim().toLowerCase();

  const lightColors = [
    "#fff",
    "#ffffff",
    "#fbf8cc",
    "#fef3c7",
    "#fef9c3",
    "#ffffcc",
    "#fde68a",
    "#fef08a"
  ];

  return lightColors.includes(firstColor) ? "#1d1d1d" : "#fff";
}

function renderNormaTagPreview(preview, label, colorValue, iconValue = "") {
  if (!preview) return;

  const safeLabel = escapeHtml(label || "身份组预览");
  const color = getPreviewColorFromInput(colorValue);
  const textColor = getReadableTextColorFromInput(colorValue);

  const icon = String(iconValue || "").trim();

  const iconHtml = icon
    ? (
      icon.startsWith("http") || icon.startsWith("./") || icon.startsWith("/")
        ? `<img src="${escapeHtml(icon)}" class="badge-icon" alt="" />`
        : `<span>${escapeHtml(icon)}</span>`
    )
    : "";

  preview.style.background = "transparent";
  preview.style.color = "";
  preview.style.textShadow = "none";

  preview.innerHTML = `
    <div class="norma-tag-preview-title">标签预览</div>
    <div class="norma-tag-preview-line">
      <span class="norma-tag-preview-name">论坛ID</span>
      <span
        class="identity-badge identity-badge-bubble"
        style="background:${color};color:${textColor};"
      >
        ${iconHtml}${safeLabel}
      </span>
    </div>
  `;
}

function getSelectedEditGroupName(panel) {
  const select = getPanelField(panel, "editGroupId");
  if (!select) return "";

  const selectedOption = select.options?.[select.selectedIndex];
  const text = selectedOption?.textContent || "";

  return text
    .split("/")
    .pop()
    .trim();
}

// ======================================

let currentSocialView = null;
let currentChat = null;
let currentContact = null;

const SYSTEM_NOTICE_ICON = "https://i.ibb.co/PvwN72Cj/IMG-20260707-103019.png";

const DELETED_FRIENDS_STORAGE_KEY = "cassell_deleted_friends";
const DELETED_CHATS_STORAGE_KEY = "cassell_deleted_chats";

function getCharacterKey(contact) {
  return String(contact.characterId || contact.code || contact.friendCode || contact.name || contact.friendName || "");
}

function getCharacterSettings(contact) {
  const key = getCharacterKey(contact);
  return state.characterAccountSettings?.[key] || {};
}

function saveOneCharacterSettings(contact, settingsPatch) {
  const key = getCharacterKey(contact);
  if (!key) return;

  saveCharacterAccountSettings({
    ...(state.characterAccountSettings || {}),
    [key]: {
      ...(state.characterAccountSettings?.[key] || {}),
      ...settingsPatch
    }
  });
}

function getActiveTimeline(contact) {
  const settings = getCharacterSettings(contact);
  const timelines = Array.isArray(contact.timelines) ? contact.timelines : [];
  const timelineId =
    contact.previewTimelineId ||
    settings.timelineId ||
    contact.defaultTimelineId ||
    timelines[0]?.id ||
    "";

  return timelines.find((item) => item.id === timelineId) || timelines[0] || null;
}

function getEffectiveContact(contact) {
  const timeline = getActiveTimeline(contact);
  const settings = getCharacterSettings(contact);

  const forumId =
    timeline?.forumId ||
    contact.forumId ||
    contact.friendName ||
    contact.name ||
    "未知账号";

  const code =
    timeline?.code ||
    contact.code ||
    contact.friendCode ||
    "";

    const rawKind =
    timeline?.identityType ||
    timeline?.codeKind ||
    contact.identityType ||
    contact.codeKind ||
    guessCodeKind(code);

  // 统一名字，避免 executive / executor 对不上
  const codeKind =
    rawKind === "executive" ? "executor" :
    rawKind === "teacher" ? "teacher" :
    rawKind === "system" ? "system" :
    rawKind === "student" ? "student" :
    rawKind;

  const bloodRank =
    timeline?.bloodRank ||
    contact.bloodRank ||
    "";

  const enabled = typeof contact.previewEnabled === "boolean"
    ? contact.previewEnabled
    : isCharacterEnabled(contact);

  const status = contact.accountKind === "character_account"
    ? (enabled ? (settings.lastCallStatus || "offline") : "offline")
    : (contact.status || contact.friendStatus || "offline");

    return {
  ...contact,
  name: forumId,
  forumId,
  code,
  codeKind,
  bloodRank,
  avatar: timeline?.avatar || contact.avatar || contact.friendAvatar || "",

    signature: timeline?.signature || contact.signature || "",
    desc: timeline?.desc || contact.desc || "",
    identityGroups: timeline?.identityGroups || contact.identityGroups || [],
    status,
    activeTimelineId: timeline?.id || "",
    activeTimelineName: timeline?.name || "",
    aiIdentityName: contact.name || contact.friendName || forumId,
    userPrompt:
      typeof contact.previewUserPrompt === "string"
        ? contact.previewUserPrompt
        : settings.userPrompt || ""
  };
}

function guessCodeKind(code) {
  const text = String(code || "").trim();

  if (/^AI\d{6}$/i.test(text)) {
    return "student";
  }

  if (/^\d{6}[A-Z]$/i.test(text)) {
    return "executor";
  }

  return "code";
}

function getAccountCodeLabel(contact) {
  if (contact.accountKind === "norma_bot") return "编号";

  const kind = String(contact.codeKind || contact.identityType || "").toLowerCase();

  if (kind === "student") return "学号";
  if (kind === "teacher") return "教职编号";
  if (kind === "executor" || kind === "executive" || kind === "archive") return "档案号";
  if (kind === "system") return "系统编号";

  return "编号";
}

function formatAccountCode(code, contact = {}) {
  const text = String(code || "").trim();
  if (!text) return "UNKNOWN";

  const kind = String(contact.codeKind || contact.identityType || "").toLowerCase();

  // 执行部 / 教职工：去 AI，尾巴加血统字母，例如 060143A（不带 -）
  // 血统等级本身不在主页单独展示，只影响档案号字母，并留给 AI 提示词
  if (
    kind === "executor" ||
    kind === "executive" ||
    kind === "teacher" ||
    kind === "archive"
  ) {
    return toArchiveCode(text, contact.bloodRank);
  }

  // 学生 / 系统：No.AI060143
  if (kind === "student" || kind === "system" || !kind) {
    if (text.startsWith("No.")) return text;
    return `No.${text}`;
  }

  if (text.startsWith("No.")) return text;
  return `No.${text}`;
}

function toArchiveCode(code, bloodRank = "") {
  const text = String(code || "").trim();
  if (!text) return "UNKNOWN";

  // 已经是档案号，比如 060143A，就直接显示。
  if (/^\d{6}[A-Z]$/i.test(text)) {
    return text.toUpperCase();
  }

  const studentMatch = text.match(/^AI(\d{6})$/i);
  if (!studentMatch) {
    return text;
  }

  const rank = String(bloodRank || "").trim().toUpperCase() || "A";
  return `${studentMatch[1]}${rank}`;
}

function isCharacterEnabled(contact) {
  if (contact.accountKind === "norma_bot") return true;
  if (contact.accountKind !== "character_account") return true;

  const settings = getCharacterSettings(contact);
  return settings.enabled === true;
}

function getCurrentUserStorageKey() {
  return state.authSession?.studentId || "guest";
}

function readDeletedFriendsMap() {
  try {
    const raw = localStorage.getItem(DELETED_FRIENDS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDeletedFriendsMap(map) {
  localStorage.setItem(DELETED_FRIENDS_STORAGE_KEY, JSON.stringify(map));
}

function getDeletedFriendKeys() {
  const map = readDeletedFriendsMap();
  const userKey = getCurrentUserStorageKey();
  return Array.isArray(map[userKey]) ? map[userKey] : [];
}

function saveDeletedFriendKeys(list) {
  const map = readDeletedFriendsMap();
  const userKey = getCurrentUserStorageKey();

  map[userKey] = Array.from(new Set(list.filter(Boolean)));
  saveDeletedFriendsMap(map);
}

function getFriendDeleteKey(friend) {
  return String(
    friend.code ||
    friend.friendCode ||
    friend.name ||
    friend.friendName ||
    ""
  );
}

function isFriendDeleted(friend) {
  const key = getFriendDeleteKey(friend);
  if (!key) return false;

  return getDeletedFriendKeys().includes(key);
}

function markFriendDeleted(friend) {
  const key = getFriendDeleteKey(friend);
  if (!key) return;

  const list = getDeletedFriendKeys();
  saveDeletedFriendKeys([...list, key]);
}

function readDeletedChatsMap() {
  try {
    const raw = localStorage.getItem(DELETED_CHATS_STORAGE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

function saveDeletedChatsMap(map) {
  localStorage.setItem(DELETED_CHATS_STORAGE_KEY, JSON.stringify(map));
}

function getDeletedChatKeys() {
  const map = readDeletedChatsMap();
  const userKey = getCurrentUserStorageKey();
  return Array.isArray(map[userKey]) ? map[userKey] : [];
}

function saveDeletedChatKeys(list) {
  const map = readDeletedChatsMap();
  const userKey = getCurrentUserStorageKey();

  map[userKey] = Array.from(new Set(list.filter(Boolean)));
  saveDeletedChatsMap(map);
}

function getChatDeleteKey(chat) {
  return String(chat.id || "");
}

function isChatDeleted(chat) {
  const key = getChatDeleteKey(chat);
  if (!key) return false;

  return getDeletedChatKeys().includes(key);
}

function markChatDeleted(chat) {
  const key = getChatDeleteKey(chat);
  if (!key) return;

  const list = getDeletedChatKeys();
  saveDeletedChatKeys([...list, key]);
}

function markContactChatsDeleted(contact) {
  const contactKey = getFriendDeleteKey(contact);

  privateChats.forEach((chat) => {
    const chatFriendKey = getFriendDeleteKey(chat);

    if (contactKey && chatFriendKey && contactKey === chatFriendKey) {
      markChatDeleted(chat);
    }
  });
}

let navStack = [
  {
    label: "守夜人论坛",
    close: null,
    type: "home",
    key: "home"
  }
];

function resetNavFromCurrentBreadcrumb() {
  const breadcrumb = document.getElementById("forumBreadcrumb");
  const text = breadcrumb?.textContent?.trim() || "守夜人论坛";

  const labels = text
    .split("→")
    .map((item) => item.trim())
    .filter(Boolean);

  navStack = labels.length
  ? labels.map((label, index) => ({
      label,
      close: null,
      type: index === 0 ? "home" : "normal",
      key: index === 0 ? "home" : ""
    }))
  : [{ label: "守夜人论坛", close: null, type: "home", key: "home" }];

  renderNavBreadcrumb();
}

function pushNav(label, closeAction, options = {}) {
  navStack.push({
    label,
    close: closeAction || null,
    type: options.type || "normal",
    key: options.key || ""
  });

  renderNavBreadcrumb();
}

function replaceLastNav(label, closeAction, options = {}) {
  if (!navStack.length) {
    navStack = [{ label: "守夜人论坛", close: null, type: "home", key: "home" }];
  }

  navStack[navStack.length - 1] = {
    label,
    close: closeAction || null,
    type: options.type || "normal",
    key: options.key || ""
  };

  renderNavBreadcrumb();
}

function pushOrReplaceNav(label, closeAction, options = {}) {
  const last = navStack[navStack.length - 1];

  if (last && options.type && last.type === options.type) {
    replaceLastNav(label, closeAction, options);
    return;
  }

  pushNav(label, closeAction, options);
}

function popNavTo(index) {
  if (index < 0 || index >= navStack.length) return;

  const removed = navStack.slice(index + 1).reverse();

  removed.forEach((item) => {
    if (typeof item.close === "function") {
      item.close();
    }
  });

  navStack = navStack.slice(0, index + 1);
  renderNavBreadcrumb();
}

function popNavOnly(index) {
  if (index < 0 || index >= navStack.length) return;

  navStack = navStack.slice(0, index + 1);
  renderNavBreadcrumb();
}

function backNavOnly() {
  if (navStack.length > 1) {
    popNavOnly(navStack.length - 2);
  } else {
    renderNavBreadcrumb();
  }
}

function renderNavBreadcrumb() {
  const breadcrumb = document.getElementById("forumBreadcrumb");
  if (!breadcrumb) return;

  breadcrumb.innerHTML = navStack.map((item, index) => {
    const isLast = index === navStack.length - 1;

    return `
      <button
        class="breadcrumb-link ${isLast ? "active" : ""}"
        type="button"
        data-nav-index="${index}"
      >
        ${escapeHtml(item.label)}
      </button>
    `;
  }).join(`<span class="breadcrumb-sep">→</span>`);

  breadcrumb.querySelectorAll(".breadcrumb-link").forEach((btn) => {
    btn.addEventListener("click", () => {
      const index = Number(btn.dataset.navIndex);
      popNavTo(index);
    });
  });
}

function closeSocialLayerOnly() {
  const overlay = document.getElementById("socialMainOverlay");
  if (overlay) overlay.hidden = true;

  currentSocialView = null;
  currentChat = null;
}

function closeContactLayerOnly() {
  const overlay = document.getElementById("contactProfileOverlay");
  if (overlay) overlay.hidden = true;

  const menu = document.getElementById("contactProfileMenu");
  if (menu) menu.hidden = true;

  currentContact = null;
}

window.ForumNav = {
  resetFromCurrent: resetNavFromCurrentBreadcrumb,
  push: pushNav,
  pushOrReplace: pushOrReplaceNav,
  replaceLast: replaceLastNav,
  popTo: popNavTo,
  popOnly: popNavOnly,
  back: () => {
    if (navStack.length > 1) {
      popNavTo(navStack.length - 2);
    } else {
      renderNavBreadcrumb();
    }
  },
  backOnly: backNavOnly,
  closeAllLayers: () => {
    popNavTo(0);
  },
  render: renderNavBreadcrumb
};

export function initSocial() {
  loadSavedPrivateChats();
  loadSavedGroupChats();
  loadMyGroups();
  resetNavFromCurrentBreadcrumb();
  renderSidebarMessages();
  renderFriends();
  renderGroups();
  bindSocialOverlayActions();
  loadRealFriendsAndRequests();
}

window.addEventListener("auth:changed", () => {
  loadSavedPrivateChats();
  loadSavedGroupChats();
  loadRealFriendsAndRequests();
  renderSidebarMessages();
  renderFriends();
});

window.addEventListener("characters:status-changed", () => {
  renderSidebarMessages();
  renderFriends();

  if (currentContact) {
    openContactProfile(currentContact);
  }
});

function findFriendForContact(contact) {
  const contactKeys = [
    contact.characterId,
    contact.code,
    contact.friendCode,
    contact.name,
    contact.friendName,
    contact.forumId
  ]
    .filter(Boolean)
    .map((item) => String(item).trim().toLowerCase());

  return friends.find((friend) => {
    const timelines = Array.isArray(friend.timelines) ? friend.timelines : [];

    const friendKeys = [
      friend.characterId,
      friend.code,
      friend.friendCode,
      friend.name,
      friend.friendName,
      friend.forumId,
      ...timelines.flatMap((timeline) => [
        timeline.id,
        timeline.code,
        timeline.name,
        timeline.forumId
      ])
    ]
      .filter(Boolean)
      .map((item) => String(item).trim().toLowerCase());

    return contactKeys.some((key) => friendKeys.includes(key));
  }) || null;
}

function renderSidebarMessages() {
  const el = document.getElementById("sidebarMessages");
  if (!el) return;

  const systemPreview = realFriendRequestItems.length
    ? `${realFriendRequestItems.length} 条好友申请待处理`
    : (systemNoticeItems?.[0]?.title || "暂无新通知");

  // 读取系统通知最后活动时间
  const systemLastTime =
    realFriendRequestItems.length > 0
      ? realFriendRequestItems
          .map((item) => String(item.createdAt || item.updated_at || ""))
          .sort()
          .pop()
      : (systemNoticeItems?.[0]?.time || "");

  // 把系统通知也当成一个消息条目，统一排序
  const allItems = [];

  // 系统通知条目
  allItems.push({
    kind: "system",
    timeKey: systemLastTime || "",
    pinned: false,
    muted: false,
    html: `
      <div class="social-card msg-item" data-message-kind="system">
        <div class="social-avatar-wrap">
          <img class="social-avatar" src="${SYSTEM_NOTICE_ICON}" alt="系统提醒" />
        </div>
        <div class="social-main">
          <div class="social-title-row">
            <strong>诺玛 (系统通知)</strong>

            ${
              realFriendRequestItems.length
                ? '<span class="chat-setting-mark" style="color:#f60;border-color:#f60">待处理</span>'
                : ""
            }

            <span class="msg-time" style="margin-left:auto">${systemLastTime || ""}</span>
          </div>
          <div class="social-desc">${escapeHtml(systemPreview)}</div>
        </div>
      </div>
    `
  });

  // 私聊条目
  const chatList = [...privateChats].sort((a, b) => {
    const personalA = loadChatPersonalSettings(
      getPrivatePersonalKey(a)
    );
    const personalB = loadChatPersonalSettings(
      getPrivatePersonalKey(b)
    );

    if (Boolean(personalA.pinned) !== Boolean(personalB.pinned)) {
      return personalB.pinned ? 1 : -1;
    }

    return getChatLastActiveMs(b) - getChatLastActiveMs(a);
  });

  chatList.forEach((chat) => {
    const matchedFriend = findFriendForContact(chat);
    const effectiveChat = getEffectiveContact(matchedFriend || chat);

    // 先从聊天设置里读取备注，保证备注能在消息列表生效
    const personal = loadChatPersonalSettings(
      getPrivatePersonalKey(chat)
    );
    const displayName = personal.alias
      ? personal.alias
      : getDisplayName(effectiveChat);

    const lastMsg = chat.messages[chat.messages.length - 1];

    // 如果这个私聊还没有任何消息，就跳过它，不显示在消息列表里
    if (!lastMsg) {
      return;
    }

    let previewText = lastMsg.text || "";
    if (previewText.length > 20) {
      previewText = previewText.substring(0, 20) + "...";
    }

    const timeKey = lastMsg.time || "";

    allItems.push({
      kind: "chat",
      chatId: chat.id,
      timeKey,
      pinned: !!personal.pinned,
      muted: false,
      html: `
        <div class="social-card msg-item" data-chat-id="${chat.id}">
          <div class="social-avatar-wrap">
            <img class="social-avatar" src="${effectiveChat.avatar || getDefaultAvatar(displayName)}" alt="${escapeHtml(displayName)}" />
          </div>
          <div class="social-main">
            <div class="social-title-row">
              <strong>${escapeHtml(displayName)}</strong>
              <span class="social-status-dot ${effectiveChat.status === "online" ? "online" : "offline"}"></span>

              ${
                personal.pinned
                  ? '<span class="chat-setting-mark">置顶</span>'
                  : ""
              }

              ${
                personal.muted
                  ? '<span class="chat-setting-mark">免打扰</span>'
                  : ""
              }

              <span class="msg-time" style="margin-left:auto">${lastMsg.time}</span>
            </div>

            <div class="social-desc">${escapeHtml(previewText)}</div>
          </div>
        </div>
      `
    });
  });

  // 统一按时间排序：置顶的排前面，同样置顶时按时间倒序
  const sortedItems = allItems.sort((a, b) => {
    if (a.pinned !== b.pinned) {
      return b.pinned ? 1 : -1;
    }
    return String(b.timeKey || "").localeCompare(String(a.timeKey || ""));
  });

  const allHtml = sortedItems.map((item) => item.html).join("");

  el.innerHTML = allHtml;

  el.querySelectorAll(".msg-item").forEach((item) => {
    item.addEventListener("click", () => {
      if (item.dataset.messageKind === "system") {
        openSystemNotice();
        return;
      }

      const chatId = item.dataset.chatId;
      const chat = privateChats.find((one) => String(one.id) === String(chatId));
      if (chat) {
        openPrivateChat(chat);
      }
    });
  });

}

function renderFriends() {
  const el = document.getElementById("friendList");
  if (!el) return;

  const visibleFriends = friends
    .filter((friend) => !isFriendDeleted(friend))
    .sort((a, b) => {
      // 诺玛永远排在最前面
      const aIsNorma = String(a.code || "").toUpperCase() === "AI000000";
      const bIsNorma = String(b.code || "").toUpperCase() === "AI000000";
      if (aIsNorma) return -1;
      if (bIsNorma) return 1;

      // 其余按名字排：中文按拼音，英文按字母
      const nameA = getDisplayName(getEffectiveContact(a));
      const nameB = getDisplayName(getEffectiveContact(b));
      return nameA.localeCompare(nameB, "zh");
    });

  const friendHtml = visibleFriends.length
    ? visibleFriends.map((friend, index) => {
        const effectiveFriend = getEffectiveContact(friend);
        const displayName = getDisplayName(effectiveFriend);

        return `
          <div class="social-card friend-item" data-friend-index="${index}" title="查看个人主页">
            <div class="social-avatar-wrap social-friend-avatar">
              <img
                class="social-avatar"
                src="${effectiveFriend.avatar || getDefaultAvatar(displayName)}"
                alt="${escapeHtml(displayName)}"
              />
            </div>

            <div class="social-main">
              <div class="social-title-row">
                <strong>${escapeHtml(displayName)}</strong>
                ${effectiveFriend.identityGroups && effectiveFriend.identityGroups.length > 0 ? renderIdentityBadge(effectiveFriend.identityGroups[0]) : ""}
                <span class="social-status-dot ${effectiveFriend.status === "online" ? "online" : "offline"}"></span>
              </div>
              <div class="social-sub">${effectiveFriend.status === "online" ? "在线" : "离线"}</div>
              <div class="social-desc">${escapeHtml(effectiveFriend.desc || "")}</div>
            </div>
          </div>
        `;
      }).join("")
    : `<div class="empty-tip">暂无好友。你可以在顶部搜索栏搜索学号或用户名。</div>`;

  el.innerHTML = friendHtml;

  el.querySelectorAll(".friend-item").forEach((item) => {
    item.addEventListener("click", () => {
      const index = Number(item.dataset.friendIndex);
      const friend = visibleFriends[index];

      if (friend) {
        openContactProfile(friend, { fromChat: null });
      }
    });
  });
}

function renderGroups() {
  const el = document.getElementById("groupList");
  if (!el) return;

  // 把 groups + userGroupChats 合并，然后按 groupKey 去重
  const allGroups = [...groups, ...userGroupChats];
  const seenKeys = new Set();
  const deduped = [];

  for (const g of allGroups) {
    const key = getGroupKey(g);
    if (!key || seenKeys.has(key)) continue;
    seenKeys.add(key);
    deduped.push(g);
  }

  // 置顶群聊排在最前面，再按群名称排序
  const sortedGroups = [...deduped].sort((a, b) => {
    const chatA = findGroupChat(a);
    const chatB = findGroupChat(b);

    const personalA = loadChatPersonalSettings(
      getGroupPersonalKey(chatA || a)
    );
    const personalB = loadChatPersonalSettings(
      getGroupPersonalKey(chatB || b)
    );

    if (Boolean(personalA.pinned) !== Boolean(personalB.pinned)) {
      return personalB.pinned ? 1 : -1;
    }

    return String(a.name || "").localeCompare(
      String(b.name || ""),
      "zh"
    );
  });

  const groupsHtml = sortedGroups
    .map((group) => {
      const chat = findGroupChat(group);
      const personal = loadChatPersonalSettings(
        getGroupPersonalKey(chat || group)
      );

      return `
    <div class="social-card group-item" data-group-key="${escapeHtml(getGroupKey(group))}">
      <div class="social-avatar-wrap">
        <img class="social-avatar" src="${group.avatar || getDefaultAvatar(group.name)}" alt="${escapeHtml(group.name)}" />
      </div>

      <div class="social-main">
        <div class="social-title-row">
          <strong>${escapeHtml(group.name)}</strong>
          ${
            personal.pinned
              ? '<span class="chat-setting-mark">置顶</span>'
              : ""
          }
          ${
            personal.muted
              ? '<span class="chat-setting-mark">免打扰</span>'
              : ""
          }
        </div>
        <div class="social-sub">${Number(group.members || 0)} 人</div>
        <div class="social-desc">${escapeHtml(group.desc || "")}</div>
      </div>
    </div>
  `;
    })
    .join("");

  // 末尾的"添加群聊"按钮
  const addGroupHtml = `
    <div class="social-card group-item add-group-card" id="addGroupCard">
      <div class="social-avatar-wrap add-group-avatar-wrap">
        <span class="add-group-plus">＋</span>
      </div>
      <div class="social-main">
        <div class="social-title-row">
          <strong>添加群聊</strong>
        </div>
        <div class="social-desc">创建群聊或通过邀请码加入</div>
      </div>
    </div>
  `;

  el.innerHTML = groupsHtml + addGroupHtml;

  // 点已有群聊 → 打开群聊
  el.querySelectorAll(".group-item[data-group-key]").forEach((item) => {
    item.addEventListener("click", () => {
      const key = item.dataset.groupKey;
      const found = deduped.find((g) => getGroupKey(g) === key);
      if (found) {
        openGroupByGroup(found);
      }
    });
  });

  // 点"添加群聊" → 弹出窗口
  document.getElementById("addGroupCard")?.addEventListener("click", openAddGroupSheet);
}

// ====== 添加群聊弹窗 ======
function openAddGroupSheet() {
  const overlay = document.getElementById("socialMainOverlay");
  const title = document.getElementById("socialMainTitle");
  const sub = document.getElementById("socialMainSub");
  const body = document.getElementById("socialMainBody");
  if (!overlay || !body) return;

  if (title) title.textContent = "添加群聊";
  if (sub) sub.textContent = "创建群聊或加入群聊";

  body.innerHTML = `
    <div class="add-group-sheet">
      <div class="add-group-choice">
        <button class="retro-btn add-group-choice-btn" id="choiceCreateGroup" type="button">
          创建群聊
        </button>
        <button class="retro-btn add-group-choice-btn" id="choiceJoinGroup" type="button">
          加入群聊
        </button>
      </div>
      <div id="addGroupSheetBody" class="add-group-sheet-body"></div>
    </div>
  `;

  overlay.hidden = false;

  document.getElementById("choiceCreateGroup")?.addEventListener("click", showCreateGroupForm);
  document.getElementById("choiceJoinGroup")?.addEventListener("click", showJoinGroupForm);
}

// 显示"创建群聊"表单
function showCreateGroupForm() {
  const wrap = document.getElementById("addGroupSheetBody");
  if (!wrap) return;

  // 列出好友（排除诺玛）
  const friendList = (friends || []).filter(
    (f) => String(f.code || "").toUpperCase() !== "AI000000"
  );

  wrap.innerHTML = `
    <div class="create-group-form">
      <div class="create-group-row">
        <label class="create-group-label">群聊名称</label>
        <input class="retro-input" id="newGroupName" placeholder="给群聊起个名字" />
      </div>

      <div class="create-group-row">
        <label class="create-group-label">选择成员（至少 1 人）</label>
        <div class="create-group-friend-list" id="createGroupFriendList">
          ${
            friendList.length
              ? friendList
                  .map((f, i) => {
                    const effective = getEffectiveContact(f);
                    const name = getDisplayName(effective);
                    const avatar = effective.avatar || getDefaultAvatar(name);
                    return `
                      <label class="create-group-friend-item">
                        <input type="checkbox" data-friend-index="${i}" />
                        <img class="create-group-friend-avatar" src="${avatar}" alt="${escapeHtml(name)}" />
                        <span class="create-group-friend-name">${escapeHtml(name)}</span>
                      </label>
                    `;
                  })
                  .join("")
              : `<div class="empty-tip">没有好友可以拉入群聊。</div>`
          }
        </div>
      </div>

      <button class="retro-btn" id="confirmCreateGroupBtn" type="button">确认创建</button>
    </div>
  `;

  document.getElementById("confirmCreateGroupBtn")?.addEventListener("click", () => {
    const nameInput = document.getElementById("newGroupName");
    const name = String(nameInput?.value || "").trim();

    if (!name) {
      alert("请填写群聊名称。");
      return;
    }

    // 收集勾选的好友
    const checked = wrap.querySelectorAll("input[type=checkbox]:checked");
    if (checked.length < 1) {
      alert("至少要选拉 1 个好友进群。");
      return;
    }

    const selectedFriends = Array.from(checked).map((cb) => {
      const idx = Number(cb.dataset.friendIndex);
      return friendList[idx];
    });

    // 生成邀请码
    const inviteCode = generateInviteCode();

    // 生成群聊的 key
    const groupKey = `mygroup-${Date.now()}`;
    const myName =
      state.currentAccount?.forumId ||
      state.currentAccount?.name ||
      "我";
    const myAvatar =
      state.currentAccount?.avatar ||
      getDefaultAvatar(myName);

    // 创建 group 对象
    const newGroup = {
      id: groupKey,
      name,
      avatar: getDefaultAvatar(name),
      members: 1 + selectedFriends.length,
      desc: `邀请码：${inviteCode}`,
      inviteCode,
      ownerId: String(
        state.currentAccount?.studentId || ""
      ).toUpperCase(),
      memberList: [
        {
          name: myName,
          avatar: myAvatar,
          studentId: String(
            state.currentAccount?.studentId || ""
          ).toUpperCase()
        },
        ...selectedFriends.map((f) => {
          const eff = getEffectiveContact(f);
          return {
            name: getDisplayName(eff),
            avatar: eff.avatar || "",
            studentId: String(f.code || "").toUpperCase()
          };
        })
      ]
    };

    // 存到"我的群聊"
    userGroupChats.push(newGroup);
    saveMyGroups();

    // 刷新群聊列表
    renderGroups();

    // 创建群聊聊天窗口
    const chat = createGroupChat(newGroup);
    openGroupChat(chat);

    alert(`群聊「${name}」已创建！\n邀请码：${inviteCode}`);
  });
}

// 显示"加入群聊"表单
function showJoinGroupForm() {
  const wrap = document.getElementById("addGroupSheetBody");
  if (!wrap) return;

  wrap.innerHTML = `
    <div class="join-group-form">
      <div class="join-group-row">
        <label class="join-group-label">输入群聊邀请码</label>
        <input class="retro-input" id="joinGroupCode" placeholder="例如：K7M3XR9P" maxlength="8" style="text-transform:uppercase" />
      </div>
      <button class="retro-btn" id="confirmJoinGroupBtn" type="button">加入群聊</button>
    </div>
  `;

  document.getElementById("confirmJoinGroupBtn")?.addEventListener("click", () => {
    const codeInput = document.getElementById("joinGroupCode");
    const code = String(codeInput?.value || "").trim().toUpperCase();

    if (!code) {
      alert("请输入邀请码。");
      return;
    }

    // 在"我的群聊"里找邀请码（现在只有本地建群，后面接服务器后会更多）
    const found = userGroupChats.find(
      (g) => String(g.inviteCode || "").toUpperCase() === code
    );

    if (!found) {
      alert("没有找到这个邀请码对应的群聊。");
      return;
    }

    // 如果已经在群里就不用重复加
    const alreadyIn = [...groups, ...userGroupChats].some(
      (g) => getGroupKey(g) === getGroupKey(found)
    );

    if (alreadyIn) {
      alert("你已经在群聊里了。");
      openGroupByGroup(found);
      return;
    }

    // 邀请码只能用一次
    if (found.inviteCodeUsed) {
      alert("这个邀请码已经被使用过了，请向群主获取新邀请码。");
      return;
    }

    // 把自己加入成员列表
    const myName =
      state.currentAccount?.forumId ||
      state.currentAccount?.name ||
      "我";
    const myAvatar =
      state.currentAccount?.avatar ||
      getDefaultAvatar(myName);
    const mySid = String(
      state.currentAccount?.studentId || state.authSession?.studentId || ""
    ).toUpperCase();

    if (!Array.isArray(found.memberList)) found.memberList = [];
    // 避免重复加
    const alreadyMember = found.memberList.some(
      (m) => String(m.studentId || "").toUpperCase() === mySid
    );
    if (!alreadyMember) {
      found.memberList.push({
        name: myName,
        avatar: myAvatar,
        studentId: mySid
      });
      found.members = found.memberList.length;
    }

    // 标记邀请码已使用
    found.inviteCodeUsed = true;
    saveMyGroups();

    // 加入成功
    alert(`已加入群聊「${found.name}」！`);
    renderGroups();
    openGroupByGroup(found);
  });
}

function bindSocialOverlayActions() {
  document.getElementById("closeSocialMainBtn")?.addEventListener("click", closeSocialMain);
  document.getElementById("closeContactProfileBtn")?.addEventListener("click", closeContactProfile);

  document.getElementById("contactProfileMenuBtn")?.addEventListener("click", (event) => {
    event.stopPropagation();
    const menu = document.getElementById("contactProfileMenu");
    if (!menu) return;
    menu.hidden = !menu.hidden;
  });

  document.getElementById("contactProfileMenu")?.addEventListener("click", (event) => {
    const btn = event.target.closest("[data-contact-action]");
    if (!btn || !currentContact) return;

    const action = btn.dataset.contactAction;
    handleContactAction(action, currentContact);
  });

  document.addEventListener("click", (event) => {
    const popover = document.getElementById("contactMiniPopover");
    const menu = document.getElementById("contactProfileMenu");

    if (popover && !popover.hidden && !event.target.closest(".contact-mini-popover") && !event.target.closest(".chat-avatar-btn")) {
      popover.hidden = true;
    }

    if (menu && !menu.hidden && !event.target.closest(".contact-profile-actions")) {
      menu.hidden = true;
    }
  });
}

async function openSystemNotice() {
  currentSocialView = "system";
  currentChat = null;
  currentContact = null;

  closeContactLayerOnly();

  pushOrReplaceNav("系统提醒", closeSocialLayerOnly, {
    type: "social",
    key: "system-notice"
  });

  const overlay = document.getElementById("socialMainOverlay");
  const title = document.getElementById("socialMainTitle");
  const sub = document.getElementById("socialMainSub");
  const body = document.getElementById("socialMainBody");

  if (!overlay || !body) return;

  if (title) title.textContent = "系统提醒";
  if (sub) sub.textContent = "通知 / 回复 / 点赞";

  let normaNotifications = [];

  try {
    const response = await fetch(
      `${API_BASE_URL}/api/norma/notifications`,
      {
        headers: {
          ...getAuthHeaders()
        }
      }
    );

    const data = await response.json();

    if (response.ok && data.success) {
      normaNotifications = Array.isArray(data.notifications)
        ? data.notifications
        : [];
    }
  } catch (error) {
    console.warn("读取诺玛通知失败：", error);
  }

  const friendRequestHtml = realFriendRequestItems.length
    ? realFriendRequestItems
        .map((item) => {
          const requester = accountToContact(item.requester || {});
          const displayName = getDisplayName(requester);

          return `
            <div class="system-notice-card friend-request-card">
              <div class="system-notice-time">
                ${escapeHtml(item.createdAt || "")}
              </div>

              <div class="system-notice-title">
                好友申请
              </div>

              <div class="friend-request-user">
                <img
                  class="social-avatar"
                  src="${requester.avatar || getDefaultAvatar(displayName)}"
                  alt="${escapeHtml(displayName)}"
                />

                <div>
                  <strong>${escapeHtml(displayName)}</strong>
                  <div class="social-desc">
                    ID: ${escapeHtml(
                      requester.code || requester.studentId || ""
                    )}
                  </div>
                </div>
              </div>

              <div class="btn-row">
                <button
                  class="retro-btn small"
                  type="button"
                  data-accept-request-id="${item.id}"
                >
                  同意
                </button>

                <button
                  class="retro-btn small ghost"
                  type="button"
                  data-reject-request-id="${item.id}"
                >
                  拒绝
                </button>
              </div>
            </div>
          `;
        })
        .join("")
    : "";

  const normaNotificationHtml = normaNotifications
    .map(
      (item) => `
        <div class="system-notice-card norma-notice-card">
          <div class="system-notice-time">
            ${escapeHtml(item.time || "")}
          </div>

          <div class="system-notice-title">
            ${escapeHtml(item.title || "诺玛通知")}
          </div>

          <div class="system-notice-content">
            ${escapeHtml(item.content || "")}
          </div>
        </div>
      `
    )
    .join("");

  const localNoticeHtml = systemNoticeItems
    .map(
      (item) => `
        <div class="system-notice-card">
          <div class="system-notice-time">
            ${escapeHtml(item.time || "")}
          </div>

          <div class="system-notice-title">
            ${escapeHtml(item.title || "")}
          </div>

          <div class="system-notice-content">
            ${escapeHtml(item.content || "")}
          </div>

          <button
            class="system-notice-link"
            type="button"
            data-target="${escapeHtml(item.linkTarget || "")}"
          >
            ${escapeHtml(item.linkText || "跳转")}
          </button>
        </div>
      `
    )
    .join("");

  body.innerHTML = `
    <div class="system-notice-list">
      ${friendRequestHtml}
      ${normaNotificationHtml}
      ${localNoticeHtml}

      ${
        !friendRequestHtml &&
        !normaNotificationHtml &&
        !localNoticeHtml
          ? `
            <div class="system-notice-card">
              <div class="system-notice-content">
                暂时没有通知。
              </div>
            </div>
          `
          : ""
      }
    </div>
  `;

  body
    .querySelectorAll("[data-accept-request-id]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await acceptFriendRequest(button.dataset.acceptRequestId);
      });
    });

  body
    .querySelectorAll("[data-reject-request-id]")
    .forEach((button) => {
      button.addEventListener("click", async () => {
        await rejectFriendRequest(button.dataset.rejectRequestId);
      });
    });

  body.querySelectorAll(".system-notice-link").forEach((button) => {
    button.addEventListener("click", () => {
      const target = button.dataset.target || "";

      window.dispatchEvent(
        new CustomEvent("forum:navigate-target", {
          detail: {
            target
          }
        })
      );
    });
  });

  overlay.hidden = false;

  try {
    await fetch(
      `${API_BASE_URL}/api/norma/notifications/read-all`,
      {
        method: "POST",
        headers: {
          ...getAuthHeaders()
        }
      }
    );
  } catch (error) {
    console.warn("标记诺玛通知已读失败：", error);
  }
}

function getContactChatKeys(contact) {
  const effective = getEffectiveContact(contact || {});

  return [
    contact?.id,
    contact?.characterId,
    contact?.code,
    contact?.friendCode,
    contact?.forumId,
    contact?.name,
    contact?.friendName,

    effective?.id,
    effective?.characterId,
    effective?.code,
    effective?.friendCode,
    effective?.forumId,
    effective?.name,
    effective?.friendName
  ]
    .filter(Boolean)
    .map((item) => String(item).trim().toLowerCase())
    .filter(Boolean);
}

function hasSameContactKey(a, b) {
  const keysA = getContactChatKeys(a);
  const keysB = getContactChatKeys(b);

  return keysA.some((key) => keysB.includes(key));
}

function getContactChatKey(contact) {
  return getContactChatKeys(contact)[0] || "";
}

function findChatForContact(contact) {
  return privateChats.find((chat) => {
    return hasSameContactKey(contact, chat);
  }) || null;
}

function createChatFromContact(contact) {
  const effective = getEffectiveContact(contact);
  const displayName = getDisplayName(effective);
  const key = getContactChatKey(effective) || getContactChatKey(contact) || displayName || Date.now();

  const newChat = {
    id: `chat-${key}-${Date.now()}`,
    friendName: displayName,
    friendRemark: effective.remark || "",
    friendCode: effective.code || effective.friendCode || "",
    friendAvatar: effective.avatar || effective.friendAvatar || getDefaultAvatar(displayName),
    friendStatus: effective.status || effective.friendStatus || "offline",
    accountKind: effective.accountKind || "",
    aiMode: effective.aiMode || "",
    desc: effective.desc || "",
    signature: effective.signature || effective.desc || "",
    identityGroups: Array.isArray(effective.identityGroups)
      ? effective.identityGroups
      : [],
    characterId: effective.characterId || "",
    code: effective.code || effective.friendCode || "",
    name: effective.name || effective.friendName || displayName,
    forumId: effective.forumId || displayName,
    avatar: effective.avatar || effective.friendAvatar || getDefaultAvatar(displayName),
    status: effective.status || effective.friendStatus || "offline",
    messages: []
  };

  privateChats.unshift(newChat);
  savePrivateChats();
  return newChat;

}

function buildForumThreadSharePanel(threadShare) {
  const title = escapeHtml(threadShare?.title || "未命名帖子");
  const boardName = escapeHtml(threadShare?.boardName || "未知板块");
  const author = escapeHtml(threadShare?.author || "未知作者");
  const summary = escapeHtml(threadShare?.summary || "暂无摘要。");
  const threadId = escapeHtml(threadShare?.threadId || threadShare?.id || "");

  return `
    <button class="chat-thread-share-card" type="button" data-shared-thread-id="${threadId}">
      <div class="chat-thread-share-label">FORUM THREAD</div>
      <div class="chat-thread-share-title">《${title}》</div>
      <div class="chat-thread-share-meta">
        <span>${boardName}</span>
        <span>${author}</span>
      </div>
      <div class="chat-thread-share-summary">${summary}</div>
      <div class="chat-thread-share-code">thread:${threadId}</div>
    </button>
  `;
}

function buildForumCommentSharePanel(commentShare) {
  const author = escapeHtml(commentShare?.author || "未知用户");
  const text = escapeHtml(commentShare?.text || "暂无内容");
  const threadTitle = escapeHtml(commentShare?.threadTitle || "未知帖子");
  const boardName = escapeHtml(commentShare?.boardName || "未知板块");
  const threadId = escapeHtml(commentShare?.threadId || "");
  const commentId = escapeHtml(commentShare?.commentId || "");
  const floorNo = escapeHtml(commentShare?.floorNo || "");

  return `
    <button
      class="chat-thread-share-card chat-comment-share-card"
      type="button"
      data-shared-thread-id="${threadId}"
      data-shared-comment-id="${commentId}"
    >
      <div class="chat-thread-share-label">FORUM COMMENT</div>
      <div class="chat-thread-share-title">${author}${floorNo ? ` · ${floorNo}楼` : ""}</div>
      <div class="chat-thread-share-meta">
        <span>${boardName}</span>
        <span>《${threadTitle}》</span>
      </div>
      <div class="chat-thread-share-summary">${text}</div>
      <div class="chat-thread-share-code">thread:${threadId}${commentId ? ` · comment:${commentId}` : ""}</div>
    </button>
  `;
}

function openChatWithContact(contact) {
  const existingChat = findChatForContact(contact);
  const chat = existingChat || createChatFromContact(contact);

  closeContactLayerOnly();
  openPrivateChat(chat);
  renderSidebarMessages();
}

export function openChatWithContactFromForum(contact) {
  const safeContact = accountToContact(contact);
  const existingChat = findChatForContact(safeContact);
  const chat = existingChat || createChatFromContact(safeContact);

  closeContactLayerOnly();
  openPrivateChat(chat);
  renderSidebarMessages();
}

export function sendForumThreadShareToContact(contact, threadShare) {
  const existingChat = findChatForContact(contact);
  const chat = existingChat || createChatFromContact(contact);

  const threadId = threadShare?.threadId || threadShare?.id || "";
  const title = threadShare?.title || "未命名帖子";
  const boardName = threadShare?.boardName || "未知板块";
  const author = threadShare?.author || "未知作者";
  const summary = threadShare?.summary || "暂无摘要。";

  const text = [
    "【帖子转发】",
    `《${title}》`,
    `板块：${boardName}`,
    `作者：${author}`,
    "",
    `摘要：${summary}`,
    "",
    `引用格式：thread:${threadId}`
  ].join("\n");

  const now = Date.now();

  chat.messages.push({
    id: `share-${threadId}-${now}`,
    from: "我",
    side: "me",
    text,
    panelHtml: buildForumThreadSharePanel({
      ...threadShare,
      threadId
    }),
    threadShare: {
      ...threadShare,
      threadId
    },
    time: new Date().toLocaleTimeString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
 }),
    createdAt: now
  });

  touchChatActive(chat);
  savePrivateChats();

  closeContactLayerOnly();
  openPrivateChat(chat);
  renderSidebarMessages();

  const body = document.getElementById("socialMainBody");
  const listEl = body?.querySelector(".chat-message-list");
  if (listEl) {
    listEl.scrollTop = listEl.scrollHeight;
  }

  return chat;
}

export function sendForumCommentShareToContact(contact, commentShare) {
  const existingChat = findChatForContact(contact);
  const chat = existingChat || createChatFromContact(contact);

  const threadId = commentShare?.threadId || "";
  const commentId = commentShare?.commentId || commentShare?.id || "";
  const author = commentShare?.author || "未知用户";
  const textContent = commentShare?.text || "暂无内容";
  const threadTitle = commentShare?.threadTitle || "未知帖子";
  const boardName = commentShare?.boardName || "未知板块";
  const floorNo = commentShare?.floorNo || "";

  const text = [
    "【评论转发】",
    `${author}${floorNo ? `（${floorNo}楼）` : ""}：`,
    textContent,
    "",
    `来自：《${threadTitle}》`,
    `板块：${boardName}`,
    `引用：thread:${threadId}${commentId ? ` comment:${commentId}` : ""}`
  ].join("\n");

  const now = Date.now();

  chat.messages.push({
    id: `comment-share-${commentId || threadId}-${now}`,
    from: "我",
    side: "me",
    text,
    panelHtml: buildForumCommentSharePanel({
      ...commentShare,
      threadId,
      commentId
    }),
    commentShare: {
      ...commentShare,
      threadId,
      commentId
    },
    time: new Date().toLocaleTimeString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
 }),
    createdAt: now
  });

  touchChatActive(chat);
  savePrivateChats();

  closeContactLayerOnly();
  openPrivateChat(chat);
  renderSidebarMessages();

  const body = document.getElementById("socialMainBody");
  const listEl = body?.querySelector(".chat-message-list");
  if (listEl) {
    listEl.scrollTop = listEl.scrollHeight;
  }

  return chat;
}

function openGroupChat(chat) {
  currentSocialView = "group-chat";
  currentChat = chat;
  currentContact = null;

  closeContactLayerOnly();

  const displayName = chat?.name || "群聊";

  pushOrReplaceNav(`群聊：${displayName}`, closeSocialLayerOnly, {
    type: "social-group",
    key: chat.id
  });

  const overlay = document.getElementById("socialMainOverlay");
  const title = document.getElementById("socialMainTitle");
  const sub = document.getElementById("socialMainSub");
  const body = document.getElementById("socialMainBody");

  if (!overlay || !body) return;

  if (title) title.textContent = displayName;
  if (sub) sub.textContent = `${Number(chat.members || 0)} 人 · 群聊`;

  body.innerHTML = `
    <div class="chat-panel">
      <div class="chat-toolbar">
        <button class="retro-btn small ghost chat-settings-btn" type="button">聊天设置</button>
      </div>
      <div class="chat-message-list">
      ${
        (chat.messages || []).length
          ? chat.messages
              .map((msg) => {
                const sideClass = msg.side === "me" ? "me" : "other";
                return `
                  <div class="chat-message-row ${sideClass}">
                    <div class="chat-bubble">
                      ${msg.panelHtml || escapeHtml(msg.text || "")}
                      <div class="chat-time">${escapeHtml(msg.time || "")}</div>
                    </div>
                  </div>
                `;
              })
              .join("")
          : `<div class="empty-tip">群聊还没有消息。转发内容会出现在这里。</div>`
      }
    </div>
    <div class="empty-tip" style="margin-top:10px;">
      完整群聊输入下一步再做。现在可以接收转发卡片。
    </div>
  `;

  overlay.hidden = false;

  // 群聊"聊天设置"按钮
  const groupSettingsBtn = body.querySelector(".chat-settings-btn");
  groupSettingsBtn?.addEventListener("click", () => {
    openChatSettingsSheet(chat, null, displayName);
  });

  const listEl = body.querySelector(".chat-message-list");
  if (listEl) {
    // 立即滚到底部，不用平滑动画（打开页面时）
    requestAnimationFrame(() => {
      listEl.scrollTop = listEl.scrollHeight;
    });
  }

  bindThreadShareCards(body);
}

export function sendForumThreadShareToGroup(group, threadShare) {
  const existingChat = findGroupChat(group);
  const chat = existingChat || createGroupChat(group);

  const threadId = threadShare?.threadId || threadShare?.id || "";
  const title = threadShare?.title || "未命名帖子";
  const boardName = threadShare?.boardName || "未知板块";
  const author = threadShare?.author || "未知作者";
  const summary = threadShare?.summary || "暂无摘要。";

  const text = [
    "【帖子转发】",
    `《${title}》`,
    `板块：${boardName}`,
    `作者：${author}`,
    "",
    `摘要：${summary}`,
    "",
    `引用格式：thread:${threadId}`
  ].join("\n");

  const now = Date.now();

  chat.messages.push({
    id: `group-share-${threadId}-${now}`,
    from: "我",
    side: "me",
    text,
    panelHtml: buildForumThreadSharePanel({
      ...threadShare,
      threadId
    }),
    threadShare: {
      ...threadShare,
      threadId
    },
    time: new Date().toLocaleTimeString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
 }),
    createdAt: now
  });

  touchChatActive(chat);
  saveGroupChats();

  openGroupChat(chat);
  renderSidebarMessages();
  return chat;
}

export function sendForumCommentShareToGroup(group, commentShare) {
  const existingChat = findGroupChat(group);
  const chat = existingChat || createGroupChat(group);

  const threadId = commentShare?.threadId || "";
  const commentId = commentShare?.commentId || commentShare?.id || "";
  const author = commentShare?.author || "未知用户";
  const textContent = commentShare?.text || "暂无内容";
  const threadTitle = commentShare?.threadTitle || "未知帖子";
  const boardName = commentShare?.boardName || "未知板块";
  const floorNo = commentShare?.floorNo || "";

  const text = [
    "【评论转发】",
    `${author}${floorNo ? `（${floorNo}楼）` : ""}：`,
    textContent,
    "",
    `来自：《${threadTitle}》`,
    `板块：${boardName}`,
    `引用：thread:${threadId}${commentId ? ` comment:${commentId}` : ""}`
  ].join("\n");

  const now = Date.now();

  chat.messages.push({
    id: `group-comment-share-${commentId || threadId}-${now}`,
    from: "我",
    side: "me",
    text,
    panelHtml: buildForumCommentSharePanel({
      ...commentShare,
      threadId,
      commentId
    }),
    commentShare: {
      ...commentShare,
      threadId,
      commentId
    },
    time: new Date().toLocaleTimeString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
 }),
    createdAt: now
  });

  touchChatActive(chat);
  saveGroupChats();

  openGroupChat(chat);
  renderSidebarMessages();
  return chat;
}

function getGuestVerifyPanelHtml() {
  return `
    <div class="norma-inline-panel guest-verify-inline-panel" data-norma-panel="guest-verify">
      <div class="norma-inline-title">实名认证</div>

      <div class="norma-inline-sub">
        请填写白名单中的学号和访问码。
      </div>

      <label class="field-label">学号</label>
      <input
        class="retro-input"
        data-guest-verify-field="studentId"
        placeholder="例如：AI060143"
        autocomplete="off"
      />

      <label class="field-label">访问码</label>
      <input
        class="retro-input"
        data-guest-verify-field="accessCode"
        type="password"
        placeholder="请输入访问码"
        autocomplete="off"
      />

      <button
        class="retro-btn"
        type="button"
        data-guest-verify-action="submit"
      >
        确认认证
      </button>

      <div
        class="guest-verify-result"
        data-guest-verify-result
        hidden
      ></div>
    </div>
  `;
}

async function submitGuestVerify(panel) {
  if (!panel) return;

  const sidInput = panel.querySelector(
    '[data-guest-verify-field="studentId"]'
  );

  const codeInput = panel.querySelector(
    '[data-guest-verify-field="accessCode"]'
  );

  const resultEl = panel.querySelector("[data-guest-verify-result]");
  const submitBtn = panel.querySelector(
    '[data-guest-verify-action="submit"]'
  );

  const studentId = String(sidInput?.value || "")
    .trim()
    .toUpperCase();

  const accessCode = String(codeInput?.value || "").trim();

  if (!studentId) {
    showGuestVerifyResult(panel, "请填写学号。", true);
    sidInput?.focus();
    return;
  }

  if (!accessCode) {
    showGuestVerifyResult(panel, "请填写访问码。", true);
    codeInput?.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "认证中...";
  }

  try {
    const response = await fetch(`${API_BASE_URL}/api/guest-verify`, {
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

    if (!response.ok || !data.success) {
      showGuestVerifyResult(
        panel,
        data.message || "认证失败，请检查学号和访问码。",
        true
      );

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "确认认证";
      }

      return;
    }

    showGuestVerifyResult(
      panel,
      `认证成功！欢迎你，${data.user.forumId}。页面即将刷新。`,
      false
    );

    if (typeof window.onGuestVerified === "function") {
      window.onGuestVerified(data.user, data.token, studentId);
    }

    window.setTimeout(() => {
      window.location.reload();
    }, 800);
  } catch (error) {
    console.error("游客实名认证失败：", error);

    showGuestVerifyResult(
      panel,
      "无法连接到后端，请确认后端已经启动。",
      true
    );

    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "确认认证";
    }
  }
}

function showGuestVerifyResult(panel, message, isError) {
  const resultEl = panel.querySelector("[data-guest-verify-result]");
  if (!resultEl) return;

  resultEl.hidden = false;
  resultEl.textContent = message;
  resultEl.classList.toggle("is-error", isError);
  resultEl.classList.toggle("is-success", !isError);
}

// 检查当前是不是游客
function isCurrentUserGuest() {
  return state.authSession?.isGuest === true;
}

// 聊天设置弹窗
function openChatSettingsSheet(chat, effectiveChat, displayName) {
  const overlay = document.getElementById("socialMainOverlay");
  const title = document.getElementById("socialMainTitle");
  const sub = document.getElementById("socialMainSub");
  const body = document.getElementById("socialMainBody");
  if (!overlay || !body) return;

  const isGroup = currentSocialView === "group-chat";

  if (title) title.textContent = "聊天设置";
  if (sub) sub.textContent = isGroup ? "群聊设置" : "私聊设置";

  // ===== 群聊设置 =====
  if (isGroup) {
    const groupKey = String(chat.groupKey || chat.id || "").trim().toLowerCase();

    let groupData = userGroupChats.find((g) => getGroupKey(g) === groupKey);

    if (!groupData) {
      groupData = {
        id: chat.groupKey || chat.id,
        name: chat.name || "群聊",
        avatar: chat.avatar || "",
        members: Number(chat.members || 0),
        desc: chat.desc || "",
        ownerId: chat.ownerId || "",
        managerIds: Array.isArray(chat.managerIds) ? chat.managerIds : [],
        memberList: Array.isArray(chat.memberList) ? chat.memberList : [],
        inviteCode: chat.inviteCode || "",
        inviteCodeUsed: !!chat.inviteCodeUsed,
        notice: chat.notice || "",
        announcement: chat.announcement || ""
      };
      if (groupData.ownerId) {
        userGroupChats.push(groupData);
        saveMyGroups();
      }
    }

    const myStudentId = String(
      state.currentAccount?.studentId || state.authSession?.studentId || ""
    ).toUpperCase();

    const isOwner = String(groupData.ownerId || "").toUpperCase() === myStudentId;
    const isManager = Array.isArray(groupData.managerIds) &&
      groupData.managerIds.some((id) => String(id).toUpperCase() === myStudentId);

    const personalKey = getGroupPersonalKey(chat);
    const personal = loadChatPersonalSettings(personalKey);

    const groupNotice = String(groupData.announcement || groupData.notice || "").trim();
    const memberList = Array.isArray(groupData.memberList) ? groupData.memberList : [];
    const managerIds = Array.isArray(groupData.managerIds) ? groupData.managerIds : [];
    const groupAvatar = groupData.avatar || getDefaultAvatar(groupData.name);

    // ===== 画界面（仿真实社交软件） =====
    body.innerHTML = `
      <div class="chat-settings-sheet im-settings">

        <!-- 顶部群信息卡片 -->
        <div class="im-profile-card">
          <img class="im-profile-avatar" src="${escapeHtml(groupAvatar)}" alt="群头像" />
          <div class="im-profile-info">
            <div class="im-profile-name">${escapeHtml(groupData.name || "群聊")}</div>
            <div class="im-profile-sub">${memberList.length || groupData.members || 0} 人 · 群聊</div>
          </div>
          ${isOwner ? '<span class="im-profile-tag im-tag-owner">群主</span>' : 
            isManager ? '<span class="im-profile-tag im-tag-manager">管理</span>' : 
            '<span class="im-profile-tag im-tag-member">成员</span>'}
        </div>

        ${isOwner ? `
          <!-- 群主管理 -->
          <div class="im-section">
            <div class="im-section-header">
              <span class="im-section-title">群主管理</span>
            </div>

            <!-- 群头像 -->
            <div class="im-row" id="imAvatarRow">
              <span class="im-row-label">群头像</span>
              <div class="im-row-value im-avatar-value">
                <img class="im-row-avatar" src="${escapeHtml(groupAvatar)}" alt="" />
                <span class="im-row-arrow">›</span>
              </div>
            </div>
            <div class="im-avatar-edit-area" id="imAvatarEditArea" hidden>
              <input type="text" class="retro-input" id="groupAvatarUrl" placeholder="粘贴头像图片网址" value="${escapeHtml(groupData.avatar || "")}" />
              <button class="retro-btn small" id="saveAvatarBtn" type="button">保存</button>
              <button class="retro-btn small ghost" id="cancelAvatarBtn" type="button">取消</button>
            </div>

            <!-- 群名 -->
            <div class="im-row im-row-edit" id="imNameRow">
              <span class="im-row-label">群聊名称</span>
              <div class="im-row-value">
                <span class="im-row-text">${escapeHtml(groupData.name || "")}</span>
                <span class="im-row-arrow">›</span>
              </div>
            </div>
            <div class="im-edit-area" id="imNameEditArea" hidden>
              <input class="retro-input" id="groupNameInput" value="${escapeHtml(groupData.name || "")}" />
              <button class="retro-btn small" id="saveNameBtn" type="button">保存</button>
              <button class="retro-btn small ghost" id="cancelNameBtn" type="button">取消</button>
            </div>

            <!-- 群公告 -->
            <div class="im-row im-row-edit" id="imNoticeRow">
              <span class="im-row-label">群公告</span>
              <div class="im-row-value">
                <span class="im-row-text">${escapeHtml(groupNotice ? (groupNotice.length > 20 ? groupNotice.slice(0, 20) + "…" : groupNotice) : "未设置")}</span>
                <span class="im-row-arrow">›</span>
              </div>
            </div>
            <div class="im-edit-area" id="imNoticeEditArea" hidden>
              <textarea class="retro-input group-notice-input" id="groupNoticeInput" placeholder="设置群公告...">${escapeHtml(groupNotice)}</textarea>
              <button class="retro-btn small" id="saveNoticeBtn" type="button">保存</button>
              <button class="retro-btn small ghost" id="cancelNoticeBtn" type="button">取消</button>
            </div>

            <!-- 群管理 -->
            <div class="im-row" id="imManagerRow">
              <span class="im-row-label">群管理</span>
              <div class="im-row-value">
                <span class="im-row-text">${managerIds.length ? `${managerIds.length} 位管理` : "未设置"}</span>
                <span class="im-row-arrow">›</span>
              </div>
            </div>
            <div class="im-edit-area" id="imManagerEditArea" hidden>
              <div class="im-manager-tags" id="imManagerTags">
                ${
                  managerIds.length
                    ? managerIds.map((mid) => {
                        const m = memberList.find((mb) => String(mb.studentId || "").toUpperCase() === String(mid).toUpperCase());
                        const mname = m?.name || mid;
                        const isMgrOwner = String(mid).toUpperCase() === String(groupData.ownerId || "").toUpperCase();
                        return `<span class="im-manager-tag" data-manager-id="${escapeHtml(mid)}">${escapeHtml(mname)}${isMgrOwner ? "（群主）" : ""}${!isMgrOwner ? " ✕" : ""}</span>`;
                      }).join("")
                    : `<span class="empty-tip-inline">暂无群管理</span>`
                }
              </div>
              ${(() => {
                const candidates = memberList.filter((m) => {
                  const sid = String(m.studentId || "").toUpperCase();
                  return sid !== String(groupData.ownerId || "").toUpperCase() && !managerIds.includes(sid);
                });
                if (!candidates.length) return `<span class="empty-tip-inline">没有可设为管理的成员</span>`;
                return `
                  <select class="retro-input im-add-manager-select" id="addManagerSelect">
                    <option value="">选择群成员...</option>
                    ${candidates.map((m) => `<option value="${escapeHtml(m.studentId)}">${escapeHtml(m.name || m.studentId)}</option>`).join("")}
                  </select>
                  <button class="retro-btn small" id="addManagerBtn" type="button">设为管理</button>
                `;
              })()}
            </div>
          </div>
        ` : ""}

        ${(isOwner || isManager) ? `
          <!-- 成员管理 -->
          <div class="im-section">
            <div class="im-section-header">
              <span class="im-section-title">成员管理</span>
              <span class="im-section-count">${memberList.length} 人</span>
            </div>
            <div class="im-member-list">
              ${memberList.map((m) => {
                const isOwnerMember = String(m.studentId || "").toUpperCase() === String(groupData.ownerId || "").toUpperCase();
                const cantRemove = isManager && isOwnerMember;
                return `
                  <div class="im-member-item" data-member-id="${escapeHtml(m.studentId || "")}">
                    <img class="im-member-avatar" src="${escapeHtml(m.avatar || getDefaultAvatar(m.name || ""))}" alt="" />
                    <span class="im-member-name">${escapeHtml(m.name || m.studentId || "")}</span>
                    ${isOwnerMember ? '<span class="im-member-role im-role-owner">群主</span>' :
                      managerIds.includes(String(m.studentId || "").toUpperCase()) ? '<span class="im-member-role im-role-manager">管理</span>' : 
                      '<span class="im-member-role im-role-normal">成员</span>'}
                    ${!cantRemove && !isOwnerMember ? '<button class="retro-btn small warn im-member-remove-btn" type="button">移出</button>' : ""}
                  </div>
                `;
              }).join("")}
            </div>
          </div>
        ` : ""}

        <!-- 邀请码 -->
        <div class="im-section">
          <div class="im-section-header">
            <span class="im-section-title">邀请码</span>
          </div>
          <div class="im-row" id="imInviteRow">
            <span class="im-row-label">邀请码</span>
            <div class="im-row-value">
              <span class="im-row-text">${groupData.inviteCode ? "已生成" : "未生成"}</span>
              <span class="im-row-arrow">›</span>
            </div>
          </div>
          <div class="im-edit-area" id="imInviteEditArea" hidden>
            <button class="retro-btn" id="newInviteCodeBtn" type="button">生成新邀请码</button>
            <div class="group-invite-code-display" id="newInviteCodeDisplay" hidden></div>
            <button class="retro-btn small" id="copyNewInviteCodeBtn" type="button" hidden>复制</button>
          </div>
        </div>

        <!-- 个人设置 -->
        <div class="im-section">
          <div class="im-section-header">
            <span class="im-section-title">个人设置</span>
          </div>
          <div class="im-row im-row-edit" id="imAliasRow">
            <span class="im-row-label">群备注</span>
            <div class="im-row-value">
              <span class="im-row-text">${escapeHtml(personal.alias || "未设置")}</span>
              <span class="im-row-arrow">›</span>
            </div>
          </div>
          <div class="im-edit-area" id="imAliasEditArea" hidden>
            <input class="retro-input" id="groupAliasInput" placeholder="给群聊加个备注" value="${escapeHtml(personal.alias || "")}" />
            <button class="retro-btn small" id="saveAliasBtn" type="button">保存</button>
            <button class="retro-btn small ghost" id="cancelAliasBtn" type="button">取消</button>
          </div>

          <div class="im-row im-row-edit" id="imNicknameRow">
            <span class="im-row-label">群内昵称</span>
            <div class="im-row-value">
              <span class="im-row-text">${escapeHtml(personal.nickname || "未设置")}</span>
              <span class="im-row-arrow">›</span>
            </div>
          </div>
          <div class="im-edit-area" id="imNicknameEditArea" hidden>
            <input class="retro-input" id="groupNicknameInput" placeholder="在这个群里叫什么" value="${escapeHtml(personal.nickname || "")}" />
            <button class="retro-btn small" id="saveNicknameBtn" type="button">保存</button>
            <button class="retro-btn small ghost" id="cancelNicknameBtn" type="button">取消</button>
          </div>

          <div class="im-row im-toggle-row">
            <span class="im-row-label">置顶群聊</span>
            <label class="im-switch">
              <input type="checkbox" id="groupPinToggle" ${personal.pinned ? "checked" : ""} />
              <span class="im-switch-slider"></span>
            </label>
          </div>

          <div class="im-row im-toggle-row">
            <span class="im-row-label">消息免打扰</span>
            <label class="im-switch">
              <input type="checkbox" id="groupMuteToggle" ${personal.muted ? "checked" : ""} />
              <span class="im-switch-slider"></span>
            </label>
          </div>
        </div>

        <!-- 危险操作 -->
        <div class="im-section im-danger-section">
          <div class="im-row" id="clearGroupChatRow">
            <span class="im-row-label">清空聊天记录</span>
            <span class="im-row-arrow">›</span>
          </div>
          <div class="im-row" id="quitGroupRow">
            <span class="im-row-label">退出群聊</span>
            <span class="im-row-arrow">›</span>
          </div>
          ${isOwner ? `
          <div class="im-row" id="dissolveGroupRow">
            <span class="im-row-label im-danger-text">解散群聊</span>
            <span class="im-row-arrow">›</span>
          </div>
          ` : ""}
        </div>
      </div>
    `;

    overlay.hidden = false;

    // ===== 工具：展开/收起编辑区 =====
    const toggleEditArea = (rowId, areaId) => {
      const row = document.getElementById(rowId);
      const area = document.getElementById(areaId);
      if (!row || !area) return;
      row.addEventListener("click", () => {
        area.hidden = !area.hidden;
      });
    };

    // 群头像
    toggleEditArea("imAvatarRow", "imAvatarEditArea");
    document.getElementById("saveAvatarBtn")?.addEventListener("click", () => {
      const url = String(document.getElementById("groupAvatarUrl")?.value || "").trim();
      if (!url) { alert("请输入头像图片网址。"); return; }
      groupData.avatar = url;
      chat.avatar = url;
      saveMyGroups();
      saveGroupChats();
      alert("群头像已更新。");
      openChatSettingsSheet(chat, null, displayName);
    });
    document.getElementById("cancelAvatarBtn")?.addEventListener("click", () => {
      document.getElementById("imAvatarEditArea").hidden = true;
    });

    // 群名
    toggleEditArea("imNameRow", "imNameEditArea");
    document.getElementById("saveNameBtn")?.addEventListener("click", () => {
      const val = String(document.getElementById("groupNameInput")?.value || "").trim();
      if (!val) { alert("群名不能为空。"); return; }
      groupData.name = val;
      chat.name = val;
      saveMyGroups();
      saveGroupChats();
      alert("群名已更新。");
      openChatSettingsSheet(chat, null, displayName);
    });
    document.getElementById("cancelNameBtn")?.addEventListener("click", () => {
      document.getElementById("imNameEditArea").hidden = true;
    });

    // 群公告
    toggleEditArea("imNoticeRow", "imNoticeEditArea");
    document.getElementById("saveNoticeBtn")?.addEventListener("click", () => {
      const val = String(document.getElementById("groupNoticeInput")?.value || "").trim();
      groupData.announcement = val;
      groupData.notice = val;
      saveMyGroups();
      alert("群公告已更新。");
      openChatSettingsSheet(chat, null, displayName);
    });
    document.getElementById("cancelNoticeBtn")?.addEventListener("click", () => {
      document.getElementById("imNoticeEditArea").hidden = true;
    });

    // 群管理
    toggleEditArea("imManagerRow", "imManagerEditArea");
    document.getElementById("addManagerBtn")?.addEventListener("click", () => {
      const select = document.getElementById("addManagerSelect");
      const sid = String(select?.value || "").toUpperCase();
      if (!sid) { alert("请先选择要设为管理的成员。"); return; }
      if (!Array.isArray(groupData.managerIds)) groupData.managerIds = [];
      if (groupData.managerIds.includes(sid)) { alert("该成员已经是管理了。"); return; }
      groupData.managerIds.push(sid);
      saveMyGroups();
      alert("已设为群管理。");
      openChatSettingsSheet(chat, null, displayName);
    });

    document.querySelectorAll(".im-manager-tag[data-manager-id]").forEach((tag) => {
      tag.addEventListener("click", () => {
        const mid = String(tag.dataset.managerId || "").toUpperCase();
        if (mid === String(groupData.ownerId || "").toUpperCase()) { alert("群主不能被移除管理权限。"); return; }
        if (!Array.isArray(groupData.managerIds)) return;
        groupData.managerIds = groupData.managerIds.filter((id) => id !== mid);
        saveMyGroups();
        alert("已移除管理权限。");
        openChatSettingsSheet(chat, null, displayName);
      });
    });

    // 移出成员
    document.querySelectorAll(".im-member-remove-btn").forEach((btn) => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const item = btn.closest(".im-member-item");
        const mid = String(item?.dataset.memberId || "").toUpperCase();
        if (!mid) return;
        if (isManager && !isOwner && mid === String(groupData.ownerId || "").toUpperCase()) { alert("不能移出群主。"); return; }
        const m = memberList.find((mb) => String(mb.studentId || "").toUpperCase() === mid);
        const mname = m?.name || mid;
        const ok = confirm(`确定要把「${mname}」移出群聊吗？`);
        if (!ok) return;
        groupData.memberList = memberList.filter((mb) => String(mb.studentId || "").toUpperCase() !== mid);
        groupData.members = groupData.memberList.length;
        if (Array.isArray(groupData.managerIds)) { groupData.managerIds = groupData.managerIds.filter((id) => id !== mid); }
        saveMyGroups();
        chat.members = groupData.members;
        saveGroupChats();
        alert("已移出。");
        openChatSettingsSheet(chat, null, displayName);
      });
    });

    // 邀请码
    toggleEditArea("imInviteRow", "imInviteEditArea");
    document.getElementById("newInviteCodeBtn")?.addEventListener("click", () => {
      const newCode = generateInviteCode();
      groupData.inviteCode = newCode;
      groupData.inviteCodeUsed = false;
      saveMyGroups();
      const display = document.getElementById("newInviteCodeDisplay");
      const copyBtn = document.getElementById("copyNewInviteCodeBtn");
      if (display) { display.textContent = newCode; display.hidden = false; }
      if (copyBtn) copyBtn.hidden = false;
    });
    document.getElementById("copyNewInviteCodeBtn")?.addEventListener("click", () => {
      const text = String(groupData.inviteCode || "").toUpperCase();
      if (!text) return;
      navigator.clipboard.writeText(text).then(() => {
        alert("邀请码已复制：" + text + "\n注意：只能用一次。");
      }).catch(() => { alert("复制失败，请手动复制：" + text); });
    });

    // 个人设置
    const savePersonalField = (inputId, field) => {
      const input = document.getElementById(inputId);
      const val = String(input?.value || "").trim();
      personal[field] = val;
      try { localStorage.setItem(personalKey, JSON.stringify(personal)); } catch (e) {}
    };

    toggleEditArea("imAliasRow", "imAliasEditArea");
    document.getElementById("saveAliasBtn")?.addEventListener("click", () => {
      savePersonalField("groupAliasInput", "alias");
      alert("群备注已保存。");
      openChatSettingsSheet(chat, null, displayName);
    });
    document.getElementById("cancelAliasBtn")?.addEventListener("click", () => {
      document.getElementById("imAliasEditArea").hidden = true;
    });

    toggleEditArea("imNicknameRow", "imNicknameEditArea");
    document.getElementById("saveNicknameBtn")?.addEventListener("click", () => {
      savePersonalField("groupNicknameInput", "nickname");
      alert("群内昵称已保存。");
      openChatSettingsSheet(chat, null, displayName);
    });
    document.getElementById("cancelNicknameBtn")?.addEventListener("click", () => {
      document.getElementById("imNicknameEditArea").hidden = true;
    });

    document.getElementById("groupPinToggle")?.addEventListener("change", (e) => {
      personal.pinned = !!e.target.checked;
      try {
        localStorage.setItem(personalKey, JSON.stringify(personal));
      } catch (err) {}
      renderSidebarMessages();
      renderGroups();
    });

    document.getElementById("groupMuteToggle")?.addEventListener("change", (e) => {
      personal.muted = !!e.target.checked;
      try {
        localStorage.setItem(personalKey, JSON.stringify(personal));
      } catch (err) {}
      renderSidebarMessages();
      renderGroups();
    });

    // 危险操作
    document.getElementById("clearGroupChatRow")?.addEventListener("click", () => {
      const ok = confirm("确定要清空这个群聊的聊天记录吗？\n清空后不可恢复。");
      if (!ok) return;
      chat.messages = [];
      saveGroupChats();
      alert("聊天记录已清空。");
      openGroupChat(chat);
    });

    document.getElementById("quitGroupRow")?.addEventListener("click", () => {
      const ok = confirm(`确定要退出群聊「${displayName}」吗？`);
      if (!ok) return;
      if (Array.isArray(groupData.memberList)) {
        groupData.memberList = groupData.memberList.filter((m) => String(m.studentId || "").toUpperCase() !== myStudentId);
        groupData.members = groupData.memberList.length;
      }
      if (Array.isArray(groupData.managerIds)) {
        groupData.managerIds = groupData.managerIds.filter((id) => id !== myStudentId);
      }
      saveMyGroups();
      const gidx = groupChats.findIndex((g) => String(g.id) === String(chat.id));
      if (gidx >= 0) { groupChats.splice(gidx, 1); saveGroupChats(); }
      if (isOwner && groupData.memberList.length > 0) {
        groupData.ownerId = groupData.memberList[0].studentId;
        saveMyGroups();
      }
      if (groupData.memberList.length === 0) {
        const myIdx = userGroupChats.findIndex((g) => getGroupKey(g) === groupKey);
        if (myIdx >= 0) { userGroupChats.splice(myIdx, 1); saveMyGroups(); }
      }
      closeSocialLayerOnly();
      renderSidebarMessages();
      renderGroups();
      alert("已退出群聊。");
    });

    document.getElementById("dissolveGroupRow")?.addEventListener("click", () => {
      const ok = confirm(`确定要解散群聊「${displayName}」吗？\n解散后所有成员都会被移出，且不可恢复。`);
      if (!ok) return;
      const ok2 = confirm(`再次确认：真的要解散「${displayName}」吗？`);
      if (!ok2) return;
      const myIdx = userGroupChats.findIndex((g) => getGroupKey(g) === groupKey);
      if (myIdx >= 0) { userGroupChats.splice(myIdx, 1); saveMyGroups(); }
      const gidx = groupChats.findIndex((g) => String(g.id) === String(chat.id));
      if (gidx >= 0) { groupChats.splice(gidx, 1); saveGroupChats(); }
      closeSocialLayerOnly();
      renderSidebarMessages();
      renderGroups();
      alert("群聊已解散。");
    });

    return;
  }

  // ===== 私聊设置 =====
  const personalKey = getPrivatePersonalKey(chat);
  const personal = loadChatPersonalSettings(personalKey);

  const friendAvatar = effectiveChat?.avatar || getDefaultAvatar(displayName);

  body.innerHTML = `
    <div class="chat-settings-sheet im-settings">

      <!-- 顶部好友信息卡片 -->
      <div class="im-profile-card">
        <img class="im-profile-avatar" src="${escapeHtml(friendAvatar)}" alt="头像" />
        <div class="im-profile-info">
          <div class="im-profile-name">${escapeHtml(displayName)}</div>
          <div class="im-profile-sub">${escapeHtml(effectiveChat?.forumId || "")}</div>
        </div>
      </div>

      <!-- 个人设置 -->
      <div class="im-section">
        <div class="im-section-header">
          <span class="im-section-title">个人设置</span>
        </div>

        <div class="im-row im-row-edit" id="pAliasRow">
          <span class="im-row-label">好友备注</span>
          <div class="im-row-value">
            <span class="im-row-text">${escapeHtml(personal.alias || "未设置")}</span>
            <span class="im-row-arrow">›</span>
          </div>
        </div>
        <div class="im-edit-area" id="pAliasEditArea" hidden>
          <input class="retro-input" id="privateAliasInput" placeholder="给好友加个备注" value="${escapeHtml(personal.alias || "")}" />
          <button class="retro-btn small" id="savePrivateAliasBtn" type="button">保存</button>
          <button class="retro-btn small ghost" id="cancelPrivateAliasBtn" type="button">取消</button>
        </div>


        <div class="im-row im-toggle-row">
          <span class="im-row-label">置顶聊天</span>
          <label class="im-switch">
            <input type="checkbox" id="privatePinToggle" ${personal.pinned ? "checked" : ""} />
            <span class="im-switch-slider"></span>
          </label>
        </div>

        <div class="im-row im-toggle-row">
          <span class="im-row-label">消息免打扰</span>
          <label class="im-switch">
            <input type="checkbox" id="privateMuteToggle" ${personal.muted ? "checked" : ""} />
            <span class="im-switch-slider"></span>
          </label>
        </div>

      </div>

      <!-- 消息设置 -->
      <div class="im-section">
        <div class="im-section-header">
          <span class="im-section-title">消息设置</span>
        </div>

        <div class="im-row im-row-edit" id="msgCountRow">
          <span class="im-row-label">上下文条数</span>
          <div class="im-row-value">
            <span class="im-row-text" id="msgCountDisplay">${personal.messageContextCount || 20}</span>
            <span class="im-row-arrow">›</span>
          </div>
        </div>
        <div class="im-edit-area" id="msgCountEditArea" hidden>
          <div style="display:flex;align-items:center;gap:8px;margin:6px 0">
            <input type="range" id="msgCountRange" min="1" max="1000" value="${personal.messageContextCount || 20}" style="flex:1" />
            <input type="number" id="msgCountInput" class="retro-input" min="1" max="1000" value="${personal.messageContextCount || 20}" style="width:70px" />
          </div>
          <div style="font-size:11px;color:var(--muted,#888)">发送最近多少条消息作为 AI 上下文（1-1000，默认20）</div>
          <button class="retro-btn small" id="saveMsgCountBtn" type="button">保存</button>
        </div>
      </div>

      <!-- 时间感知 -->
      <div class="im-section">
        <div class="im-section-header">
          <span class="im-section-title">时间感知</span>
        </div>

        <div class="im-row" id="timePerceptionRow">
          <span class="im-row-label">实时时间感知</span>
          <div class="im-row-value" style="display:flex;align-items:center;gap:8px">
            <span class="im-row-text" id="timePerceptionStatus">${personal.realTimePerception ? "已开启" : "已关闭"}</span>
            <label class="im-toggle">
              <input type="checkbox" id="timePerceptionToggle" ${personal.realTimePerception ? "checked" : ""} />
              <span class="im-toggle-slider"></span>
            </label>
          </div>
        </div>

        <div id="timeZoneArea" ${personal.realTimePerception ? "" : "hidden"} style="margin-top:8px">
          <div class="im-row">
            <span class="im-row-label">时区</span>
            <div class="im-row-value">
              <select id="timeZoneSelect" class="retro-input" style="width:auto;flex:1">
                <option value="Asia/Shanghai" ${(personal.timeZone || "Asia/Shanghai") === "Asia/Shanghai" ? "selected" : ""}>中国标准时间 (UTC+8)</option>
                <option value="Asia/Tokyo" ${personal.timeZone === "Asia/Tokyo" ? "selected" : ""}>日本标准时间 (UTC+9)</option>
                <option value="Asia/Seoul" ${personal.timeZone === "Asia/Seoul" ? "selected" : ""}>韩国标准时间 (UTC+9)</option>
                <option value="America/New_York" ${personal.timeZone === "America/New_York" ? "selected" : ""}>美东时间 (UTC-5)</option>
                <option value="America/Los_Angeles" ${personal.timeZone === "America/Los_Angeles" ? "selected" : ""}>美西时间 (UTC-8)</option>
                <option value="Europe/London" ${personal.timeZone === "Europe/London" ? "selected" : ""}>格林威治时间 (UTC+0)</option>
                <option value="Europe/Paris" ${personal.timeZone === "Europe/Paris" ? "selected" : ""}>中欧时间 (UTC+1)</option>
                <option value="Asia/Dubai" ${personal.timeZone === "Asia/Dubai" ? "selected" : ""}>迪拜时间 (UTC+4)</option>
                <option value="Asia/Kolkata" ${personal.timeZone === "Asia/Kolkata" ? "selected" : ""}>印度时间 (UTC+5:30)</option>
                <option value="Asia/Bangkok" ${personal.timeZone === "Asia/Bangkok" ? "selected" : ""}>曼谷时间 (UTC+7)</option>
                <option value="Australia/Sydney" ${personal.timeZone === "Australia/Sydney" ? "selected" : ""}>悉尼时间 (UTC+10)</option>
              </select>
            </div>
          </div>
          <div style="font-size:11px;color:var(--muted,#888);margin-top:4px">开启后角色会知道当前真实日期和时间</div>
        </div>
      </div>

      <!-- 记忆本 -->
      <div class="im-section">
        <div class="im-section-header">
          <span class="im-section-title">记忆本</span>
        </div>

        <div class="im-row im-row-edit" id="memoryBookRow">
          <span class="im-row-label">记忆内容</span>
          <div class="im-row-value">
            <span class="im-row-text" id="memoryBookDisplay">点击查看</span>
            <span class="im-row-arrow">›</span>
          </div>
        </div>
        <div class="im-edit-area" id="memoryBookEditArea" hidden>
          <textarea class="retro-input" id="memoryBookTextarea" rows="5" placeholder="记忆本内容，会自动塞进 AI 上下文..." style="width:100%;resize:vertical;font-size:13px"></textarea>
          <div style="font-size:11px;color:var(--muted,#888);margin:4px 0">记忆本内容会自动注入 AI 上下文，AI 会"记住"这些信息。</div>
          <div class="btn-row">
            <button class="retro-btn small" id="saveMemoryBookBtn" type="button">保存记忆</button>
            <button class="retro-btn small ghost" id="summarizeChatBtn" type="button">总结对话</button>
            <button class="retro-btn small ghost" id="clearMemoryBookBtn" type="button">清空记忆</button>
          </div>
          <div id="memoryBookStatus" style="font-size:11px;color:var(--muted,#888);margin-top:4px"></div>
        </div>
      </div>

      <!-- 危险操作 -->
      <div class="im-section im-danger-section">
        <div class="im-row" id="clearPrivateChatRow">
          <span class="im-row-label">清空聊天记录</span>
          <span class="im-row-arrow">›</span>
        </div>
        <div class="im-row" id="deletePrivateChatRow">
          <span class="im-row-label im-danger-text">删除会话</span>
          <span class="im-row-arrow">›</span>
        </div>
      </div>
    </div>
  `;

  overlay.hidden = false;

  // 私聊：展开收起
  const togglePrivateArea = (rowId, areaId) => {
    const row = document.getElementById(rowId);
    const area = document.getElementById(areaId);
    if (!row || !area) return;
    row.addEventListener("click", () => { area.hidden = !area.hidden; });
  };

  togglePrivateArea("pAliasRow", "pAliasEditArea");

    // 上下文条数：展开收起 + 同步滑块和数字框
  togglePrivateArea("msgCountRow", "msgCountEditArea");
  const msgCountRange = document.getElementById("msgCountRange");
  const msgCountInput = document.getElementById("msgCountInput");
  if (msgCountRange && msgCountInput) {
    msgCountRange.addEventListener("input", () => { msgCountInput.value = msgCountRange.value; });
    msgCountInput.addEventListener("input", () => { msgCountRange.value = msgCountInput.value; });
  }
  document.getElementById("saveMsgCountBtn")?.addEventListener("click", () => {
    const val = Math.max(1, Math.min(1000, Number(msgCountInput?.value || 20)));
    const personalKey2 = getPrivatePersonalKey(chat);
    const personal2 = loadChatPersonalSettings(personalKey2);
    personal2.messageContextCount = val;
    saveChatPersonalSettings(personalKey2, personal2);
    document.getElementById("msgCountDisplay").textContent = val;
    document.getElementById("msgCountEditArea").hidden = true;
  });

  // 时间感知开关
  document.getElementById("timePerceptionToggle")?.addEventListener("change", function() {
    const enabled = this.checked;
    const personalKey2 = getPrivatePersonalKey(chat);
    const personal2 = loadChatPersonalSettings(personalKey2);
    personal2.realTimePerception = enabled;
    saveChatPersonalSettings(personalKey2, personal2);
    document.getElementById("timePerceptionStatus").textContent = enabled ? "已开启" : "已关闭";
    document.getElementById("timeZoneArea").hidden = !enabled;
  });

  // 时区选择保存
  document.getElementById("timeZoneSelect")?.addEventListener("change", function() {
    const personalKey2 = getPrivatePersonalKey(chat);
    const personal2 = loadChatPersonalSettings(personalKey2);
    personal2.timeZone = this.value;
    saveChatPersonalSettings(personalKey2, personal2);
  });

  // 记忆本：展开收起
  togglePrivateArea("memoryBookRow", "memoryBookEditArea");
  const chatId = String(chat.code || chat.forumId || chat.id || "").toUpperCase();
  const existingMemory = loadMB(chatId);
  const memoryTextarea = document.getElementById("memoryBookTextarea");
  const memoryStatus = document.getElementById("memoryBookStatus");
  if (memoryTextarea && existingMemory) {
    memoryTextarea.value = existingMemory.summary || "";
  }
  if (existingMemory && memoryStatus) {
    memoryStatus.textContent = `上次总结：${existingMemory.updatedAt || "未知"}`;
  }

  document.getElementById("saveMemoryBookBtn")?.addEventListener("click", () => {
    const text = memoryTextarea?.value.trim() || "";
    saveMB(chatId, {
      summary: text,
      updatedAt: new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
    });
    if (memoryStatus) memoryStatus.textContent = "已保存";
  });

  document.getElementById("clearMemoryBookBtn")?.addEventListener("click", () => {
    if (confirm("确定清空记忆本？")) {
      deleteMB(chatId);
      if (memoryTextarea) memoryTextarea.value = "";
      if (memoryStatus) memoryStatus.textContent = "已清空";
    }
  });

  document.getElementById("summarizeChatBtn")?.addEventListener("click", async () => {
    if (!memoryStatus) return;
    memoryStatus.textContent = "正在总结对话...";

    const messages = chat.messages.map(m => ({
      role: m.side === "me" ? "user" : "assistant",
      content: m.text || ""
    }));

    if (messages.length === 0) {
      memoryStatus.textContent = "没有聊天记录可以总结。";
      return;
    }

    const apiSettings = getApiForPurpose("summary");

    try {
      let apiUrl = (apiSettings.apiBaseUrl || "").replace(/\/+$/, "");
      if (apiUrl.endsWith("/v1")) apiUrl += "/chat/completions";
      else if (!apiUrl.endsWith("/chat/completions")) apiUrl += "/chat/completions";

      const res = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiSettings.apiKey}`
        },
        body: JSON.stringify({
          model: apiSettings.model,
          messages: [
            { role: "system", content: "请总结以下对话的关键信息，包括：双方讨论了什么话题、达成了什么结论、重要的情感交流、以及用户（我）的性格特点和偏好。用简洁的中文写成一段连贯的摘要，方便以后回顾。" },
            ...messages
          ],
          temperature: 0.3
        })
      });

      const data = await res.json();
      const summary = data?.choices?.[0]?.message?.content || "";
      if (summary && memoryTextarea) {
        memoryTextarea.value = summary;
        saveMB(chatId, {
          summary: summary,
          updatedAt: new Date().toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
        });
        memoryStatus.textContent = "总结完成，已自动保存";
      } else {
        memoryStatus.textContent = "总结失败，请检查 API 设置。";
      }
    } catch (e) {
      memoryStatus.textContent = "总结失败：" + e.message;
    }
  });

  document.getElementById("savePrivateAliasBtn")?.addEventListener("click", () => {
    personal.alias = String(document.getElementById("privateAliasInput")?.value || "").trim();
    try { localStorage.setItem(personalKey, JSON.stringify(personal)); } catch (e) {}

    // 额外存一份按学号索引的备注，让好友列表、主页、论坛都能读到
    const friendCode = String(
      chat.friendCode || chat.code || effectiveChat?.code || ""
    )
      .trim()
      .toUpperCase();

    if (friendCode) {
      const aliasKey = `friend_alias_${friendCode}_${getCurrentStudentId()}`;
      try {
        const aliasSettings = loadChatPersonalSettings(aliasKey);
        aliasSettings.alias = personal.alias;
        localStorage.setItem(aliasKey, JSON.stringify(aliasSettings));
      } catch (e) {}
    }

    // 同时更新聊天的备注字段，让消息列表显示备注
    if (personal.alias) {
      chat.friendRemark = personal.alias;
      chat.remark = personal.alias;
    } else {
      chat.friendRemark = "";
      chat.remark = "";
    }
    savePrivateChats();

    alert("好友备注已保存。");
    renderSidebarMessages();
    renderFriends();
    openChatSettingsSheet(chat, effectiveChat, displayName);
  });
  document.getElementById("cancelPrivateAliasBtn")?.addEventListener("click", () => {
    document.getElementById("pAliasEditArea").hidden = true;
  });



  document.getElementById("privatePinToggle")?.addEventListener("change", (e) => {
    personal.pinned = !!e.target.checked;
    try {
      localStorage.setItem(personalKey, JSON.stringify(personal));
    } catch (err) {}
    renderSidebarMessages();
  });

  document.getElementById("privateMuteToggle")?.addEventListener("change", (e) => {
    personal.muted = !!e.target.checked;
    try {
      localStorage.setItem(personalKey, JSON.stringify(personal));
    } catch (err) {}
    renderSidebarMessages();
  });

  document.getElementById("clearPrivateChatRow")?.addEventListener("click", () => {
    const ok = confirm("确定要清空聊天记录吗？\n清空后不可恢复。");
    if (!ok) return;
    chat.messages = [];
    savePrivateChats();
    alert("聊天记录已清空。");
    openPrivateChat(chat);
  });

  document.getElementById("deletePrivateChatRow")?.addEventListener("click", () => {
    const ok = confirm(`确定要删除与 ${displayName} 的聊天吗？`);
    if (!ok) return;
    deletePrivateChat(chat.id);
    closeSocialLayerOnly();
    renderSidebarMessages();
  });
}

function deletePrivateChat(chatId) {
  const index = privateChats.findIndex((chat) => String(chat.id) === String(chatId));

  if (index >= 0) {
  privateChats.splice(index, 1);
  savePrivateChats();
}

}

function openPrivateChat(chat) {
  currentSocialView = "chat";
  currentChat = chat;
  currentContact = null;

  closeContactLayerOnly();

  const matchedFriend = findFriendForContact(chat);
  const effectiveChat = getEffectiveContact(matchedFriend || chat);
  const personal = loadChatPersonalSettings(getPrivatePersonalKey(chat));
  const displayName = personal.alias || getDisplayName(effectiveChat);

  pushOrReplaceNav(`与 ${displayName} 的私聊`, closeSocialLayerOnly, {
    type: "social",
    key: chat.id
  });

  const overlay = document.getElementById("socialMainOverlay");
  const title = document.getElementById("socialMainTitle");
  const sub = document.getElementById("socialMainSub");
  const body = document.getElementById("socialMainBody");

  if (!overlay || !body) return;

  if (title) title.textContent = displayName;

  // 修复：必须给这个子标题传对状态
  if (sub) {
    if (effectiveChat.status === "online") {
      sub.innerHTML = `<span class="social-status-dot online"></span> 在线`;
    } else {
      sub.innerHTML = `<span class="social-status-dot offline"></span> 离线`;
    }
  }

  renderPrivateChatBody(chat, body);

  overlay.hidden = false;

  const backBtn = document.getElementById("closeSocialMainBtn");
  if (backBtn) backBtn.textContent = "返回";
}

function renderPrivateChatBody(chat, body) {
  const matchedFriend = findFriendForContact(chat);
  const effectiveChat = getEffectiveContact(matchedFriend || chat);
  const displayName = getDisplayName(effectiveChat);

  body.innerHTML = `
    <div class="chat-panel">
      <div class="chat-toolbar">
        <button class="retro-btn small ghost chat-settings-btn" type="button">聊天设置</button>
      </div>
      <div class="chat-message-list">
        ${renderChatMessages(chat, effectiveChat, displayName)}
      </div>
      <div class="chat-toolbar-extra" id="chatExtraToolbar" hidden>
        <button class="chat-extra-btn" id="chatRegenerateBtn" title="重新生成">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 4v6h6"/><path d="M23 20v-6h-6"/><path d="M20.49 9A9 9 0 0 0 5.64 5.64L1 10m22 4l-4.64 4.36A9 9 0 0 1 3.51 15"/></svg>
        </button>
        <button class="chat-extra-btn" id="chatStickerBtn" title="表情包">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"/><path d="M8 14s1.5 2 4 2 4-2 4-2"/><line x1="9" y1="9" x2="9.01" y2="9"/><line x1="15" y1="9" x2="15.01" y2="9"/></svg>
        </button>
        <button class="chat-extra-btn" id="chatImageBtn" title="发图片">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </button>
      </div>
      <div class="chat-sticker-panel" id="chatStickerPanel" hidden></div>
      <div class="chat-sticker-panel" id="chatImagePanel" hidden></div>

      <div class="chat-input-bar">
        <button class="chat-plus-btn" id="chatPlusBtn" title="更多功能">
          <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2.5"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>
        </button>
        <input class="retro-input chat-input" placeholder="输入消息..." />
        <button class="chat-round-btn chat-recv-btn" id="chatReceiveBtn" title="接收回复" style="display:none">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="2"><polyline points="1 4 1 10 7 10"/><path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10"/></svg>
        </button>
        <button class="chat-round-btn chat-send-round" id="chatSendRoundBtn" type="button" title="发送">
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><path d="M2.01 21L23 12 2.01 3 2 10l15 2-15 2z"/></svg>
        </button>
      </div>
    </div>
  `;

  const settingsBtn = body.querySelector(".chat-settings-btn");
  settingsBtn?.addEventListener("click", () => {
    openChatSettingsSheet(chat, effectiveChat, displayName);
  });

  // 长按消息：弹出引用/撤回/删除菜单
  body.querySelectorAll(".chat-msg-anim").forEach((el) => {
    let longTimer = null;
    const startLong = (e) => {
      longTimer = setTimeout(() => {
        const idx = Number(el.dataset.msgIndex);
        const touch = e.touches?.[0];
        showMsgContextMenu({
          clientX: touch ? touch.clientX : e.clientX,
          clientY: touch ? touch.clientY : e.clientY,
          preventDefault: () => {},
          stopPropagation: () => {}
        }, chat, idx, body);
      }, 500);
    };
    const cancelLong = () => { if (longTimer) { clearTimeout(longTimer); longTimer = null; } };
    el.addEventListener("mousedown", startLong);
    el.addEventListener("mouseup", cancelLong);
    el.addEventListener("mouseleave", cancelLong);
    el.addEventListener("touchstart", startLong, { passive: true });
    el.addEventListener("touchend", cancelLong);
    el.addEventListener("touchcancel", cancelLong);
  });

  const input = body.querySelector(".chat-input");
  const sendBtn = body.querySelector("#chatSendRoundBtn") || body.querySelector(".chat-send-btn");

    const handleSend = async () => {
    const text = input.value.trim();
    if (!text) return;

    // ====== 游客限制 ======
    if (isCurrentUserGuest()) {
      // 游客只能和诺玛聊天
      const isNormaTarget = effectiveChat.accountKind === "norma_bot" ||
                           String(effectiveChat?.code || effectiveChat?.forumId || "").toUpperCase() === "AI000000" ||
                           String(displayName || "") === "诺玛";

      if (!isNormaTarget) {
        // 不是诺玛，直接拦截
        alert("游客只能和诺玛对话，请先发送 /实名认证 完成认证。");
        input.value = "";
        return;
      }

      // 是诺玛，走 handleNormaPanelCommand
      // 已认证和游客的指令都由 handleNormaPanelCommand 处理
      // 游客在 handleNormaPanelCommand 里会被拦住
    }

    if (effectiveChat.accountKind === "norma_bot") {
      const handledByNormaPanel = await handleNormaPanelCommand(text, chat, body);
      if (handledByNormaPanel) {
        input.value = "";
        return;
      }
    }

    input.value = "";

    // 把消息推入数组
    const now = Date.now();

    // 读取引用内容
    const quoteText = input?.dataset?.quoteText || "";

    chat.messages.push({
      side: "me",
      text,
      time: new Date().toLocaleTimeString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }),
      createdAt: now,
      quoteText: quoteText || undefined
    });

    touchChatActive(chat);
    savePrivateChats();

    // 追加单条玩家消息（带动画）
    const lastMsg = chat.messages[chat.messages.length - 1];
    appendSingleMessage(body, lastMsg, displayName, effectiveChat, chat);
    renderSidebarMessages();

    // 剧情角色 & 诺玛：发送后显示接收按钮
    if (effectiveChat.accountKind === "character_account" || effectiveChat.accountKind === "norma_bot") {
      const recvBtn = body.querySelector("#chatReceiveBtn");
      if (recvBtn) {
        recvBtn.style.display = "";
        recvBtn.style.animation = "none";
      }
    }

    // 诺玛：只有 / 指令才自动秒回
    if (effectiveChat.accountKind === "norma_bot" && text.trim().startsWith("/")) {
      const subEl = document.getElementById("socialMainSub");
      const originalSubHtml = subEl ? subEl.innerHTML : "";
      if (subEl) {
        subEl.innerHTML = `<span class="social-status-dot online"></span> 正在输入...`;
        subEl.classList.add("chat-typing-indicator");
      }

      let reply = "诺玛暂时没有回应。";
      try {
        const res = await fetch(`${API_BASE_URL}/api/norma/chat`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.authToken || ""}`
          },
          body: JSON.stringify({ content: text })
        });
        const data = await res.json();
        reply = data.reply || data.message || "诺玛已收到。";
      } catch (e) {
        reply = "【系统提示】无法连接诺玛，请确认后端已启动。";
      }

      const replyParts = reply.split("|||").map(s => s.trim()).filter(Boolean);
      // 一条一条弹出，每条间隔600ms
      for (let idx = 0; idx < replyParts.length; idx++) {
        const part = replyParts[idx];
        const msg = {
          side: "other",
          text: part,
          time: new Date().toLocaleTimeString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }),
          createdAt: Date.now() + idx,
          isAiGenerated: true,
          temporary: true
        };
        chat.messages.push(msg);
        appendSingleMessage(body, msg, displayName, effectiveChat, chat);
        if (idx < replyParts.length - 1) {
          await new Promise(r => setTimeout(r, 600));
        }
      }

      touchChatActive(chat);
      savePrivateChats();
      renderSidebarMessages();

      if (subEl) {
        subEl.innerHTML = originalSubHtml;
        subEl.classList.remove("chat-typing-indicator");
      }
    }
  };

  sendBtn?.addEventListener("click", handleSend);
  input?.addEventListener("keydown", (e) => {
    if (e.key === "Enter") handleSend();
  });

  
  // ====== 更多功能按钮：展开/收起工具栏 ======
  const plusBtn = body.querySelector("#chatPlusBtn");
  const extraToolbar = body.querySelector("#chatExtraToolbar");
  const receiveBtn = body.querySelector("#chatReceiveBtn");

  plusBtn?.addEventListener("click", () => {
    if (extraToolbar) {
      extraToolbar.hidden = !extraToolbar.hidden;
    }
  });

  // ====== 接收回复按钮：让 AI 开始回复 ======
  receiveBtn?.addEventListener("click", async () => {
    if (effectiveChat.accountKind !== "character_account" && effectiveChat.accountKind !== "norma_bot") return;

        receiveBtn.disabled = true;
    receiveBtn.style.opacity = "0.4";

    // 显示"对方正在输入..."
    const subEl = document.getElementById("socialMainSub");
    const originalSubHtml = subEl ? subEl.innerHTML : "";
    if (subEl) {
      subEl.innerHTML = `<span class="social-status-dot online"></span> 正在输入...`;
      subEl.classList.add("chat-typing-indicator");
    }

    try {

            let reply = "……";

      if (effectiveChat.accountKind === "norma_bot") {
        // 诺玛：通过后端接口回复
        let lastUserMsg = "";
        for (let i = chat.messages.length - 1; i >= 0; i--) {
          if (chat.messages[i].side === "me") { lastUserMsg = chat.messages[i].text; break; }
        }
        if (!lastUserMsg) { reply = "没有找到可回复的消息。"; }
        else {
          try {
            const res = await fetch(`${API_BASE_URL}/api/norma/chat`, {
              method: "POST",
              headers: { "Content-Type": "application/json", "Authorization": `Bearer ${state.authToken || ""}` },
              body: JSON.stringify({ content: lastUserMsg })
            });
            const data = await res.json();
            reply = data.reply || data.message || "诺玛暂时没有回应。";
          } catch (e) {
            reply = "【系统提示】无法连接诺玛。";
          }
        }
      } else {
        // 剧情角色：通过角色接口回复
        const studentId = String(
          effectiveChat.characterId || effectiveChat.studentId || effectiveChat.code || ""
        ).trim().toUpperCase();

        const chatPersonalKey = getPrivatePersonalKey(chat);
        const chatPersonalSettings = loadChatPersonalSettings(chatPersonalKey);
        const contextCount = chatPersonalSettings.messageContextCount || 20;

                const recentMessages = chat.messages.slice(-contextCount).map((m) => {
          // 撤回的消息：告诉AI对方撤回了
          if (m.recalled) {
            return {
              role: m.side === "me" ? "user" : "assistant",
              content: `[对方撤回了一条消息]`
            };
          }
          // 表情包消息转成描述性文字给AI看
          if (m.type === "sticker") {
            return {
              role: m.side === "me" ? "user" : "assistant",
              content: `[发送了表情包「${m.stickerName || "表情包"}」]`
            };
          }
          // 引用消息：带上引用内容
          let content = m.text || "";
          if (m.quoteText) {
            content = `[引用了"${m.quoteText.substring(0, 100)}"并说] ${content}`;
          }
          return {
            role: m.side === "me" ? "user" : "assistant",
            content
          };
        });

        // 实时时间感知：注入真实日期时间
        if (chatPersonalSettings.realTimePerception) {
          const tz = chatPersonalSettings.timeZone || "Asia/Shanghai";
          const now = new Date();
          const timeStr = now.toLocaleString("zh-CN", {
            timeZone: tz,
            year: "numeric", month: "2-digit", day: "2-digit",
            weekday: "long",
            hour: "2-digit", minute: "2-digit", hour12: false
          });
          recentMessages.unshift({
            role: "system",
            content: `[系统提示] 当前真实世界时间是 ${timeStr}（时区：${tz}），请据此回应。`
          });
        }

        const chatIdKey = String(studentId).toUpperCase();
        const memoryBook = loadMB(chatIdKey);
        if (memoryBook && memoryBook.summary) {
          recentMessages.unshift({
            role: "system",
            content: `[记忆本] 以下是之前的对话总结，请记住这些信息：\\n${memoryBook.summary}`
          });
        }

        // 教AI可以用表情包回复，只用玩家上传的
        const myStickers = loadStickers();
        if (myStickers.length > 0) {
          const stickerList = myStickers.map(s => s.name).join("、");
          recentMessages.unshift({
            role: "system",
            content: `[系统提示] 你可以用表情包回复。在回复中写 [sticker:表情包名字] 就会发送对应表情包。例如 [sticker:拍拍]。不可以混在文字里（前面或后面加其他文字），只可以单独发送。你只能使用以下表情包：${stickerList}。不要使用列表之外的表情包名字。`
          });
        }

        try {
          const res = await fetch(`${API_BASE_URL}/api/character-ai/reply`, {
            method: "POST",
            headers: { "Content-Type": "application/json", ...getAuthHeaders() },
            body: JSON.stringify({
              studentId,
              messages: recentMessages,
              apiBaseUrl: state.forumAiSettings?.apiBaseUrl || "",
              apiKey: state.forumAiSettings?.apiKey || "",
              model: state.forumAiSettings?.model || ""
            })
          });
          const data = await res.json();
          reply = data.reply || data.content || "……";
        } catch (e) {
          reply = "【系统提示】无法连接角色 AI。";
        }
      }

      const replyParts = reply.split("|||").map((s) => s.trim()).filter(Boolean);

      // 一条一条弹出，每条间隔600ms
      for (let idx = 0; idx < replyParts.length; idx++) {
        const part = replyParts[idx];

        // 解析表情包语法 [sticker:名字]（可以混在文字里，也可以单独发）
        const stickerMatch = part.match(/\[sticker:(.+?)\]/);
        const msg = {
          side: "other",
          text: part,
          time: new Date().toLocaleTimeString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }),
          createdAt: Date.now() + idx,
          isAiGenerated: true
        };

        if (stickerMatch) {
          const stickerName = stickerMatch[1].trim();
          const myStickers = loadStickers();
          const found = myStickers.find(s => s.name === stickerName);
          if (found) {
            // 找到了玩家的表情包，显示为表情包
            msg.type = "sticker";
            msg.stickerName = stickerName;
            msg.stickerUrl = found.url;
            msg.text = stickerName;
          }
          // 没找到就不改，显示为普通文字
        }

        chat.messages.push(msg);
        appendSingleMessage(body, msg, displayName, effectiveChat, chat);
        if (idx < replyParts.length - 1) {
          await new Promise(r => setTimeout(r, 600));
        }
      }

      touchChatActive(chat);
      savePrivateChats();
      renderSidebarMessages();

    } catch (error) {
          } finally {
      receiveBtn.disabled = false;
      receiveBtn.style.opacity = "";
      receiveBtn.style.animation = "pulse 1.5s infinite";
      if (subEl) {
        subEl.innerHTML = originalSubHtml;
        subEl.classList.remove("chat-typing-indicator");
      }
    }
  });

  // ====== 重新生成 ======
  const regenerateBtn = body.querySelector("#chatRegenerateBtn");
  regenerateBtn?.addEventListener("click", async () => {
    let removedCount = 0;
    while (chat.messages.length > 0) {
      const last = chat.messages[chat.messages.length - 1];
      if (last.side !== "other" || !last.isAiGenerated) break;
      chat.messages.pop();
      removedCount++;
    }
    if (removedCount === 0) { alert("没有可以重新生成的 AI 回复。"); return; }
    savePrivateChats();
    renderPrivateChatBody(chat, body);

    // 撤销后显示接收按钮，让玩家自己点接收
    if (effectiveChat.accountKind === "character_account" || effectiveChat.accountKind === "norma_bot") {
      const recvBtn = body.querySelector("#chatReceiveBtn");
      if (recvBtn) {
        recvBtn.style.display = "";
        recvBtn.style.animation = "pulse 1.5s infinite";
      }
    }
  });

  // ====== 表情包面板（内嵌在输入框上方） ======
  const stickerBtn = body.querySelector("#chatStickerBtn");
  const stickerPanel = body.querySelector("#chatStickerPanel");

  function getStickerStorageKey() {
    const sid = state.authSession?.studentId || state.currentAccount?.studentId || "guest";
    const chatId = effectiveChat?.code || effectiveChat?.forumId || "unknown";
    return `cassell_stickers_v1_${String(sid).toUpperCase()}_${String(chatId).toUpperCase()}`;
  }

  function loadStickers() {
    try {
      return JSON.parse(localStorage.getItem(getStickerStorageKey()) || "[]");
    } catch { return []; }
  }

  function saveStickers(arr) {
    localStorage.setItem(getStickerStorageKey(), JSON.stringify(arr));
  }

  let stickerManageMode = false;

  function renderStickerPanel() {
    if (!stickerPanel) return;
    const stickers = loadStickers();
    stickerManageMode = false;
    stickerPanel.innerHTML = `
      <div class="sticker-panel-header">
        <span class="sticker-panel-title">表情包</span>
        <div class="sticker-panel-actions">
          <button class="retro-btn small sticker-add-btn" title="添加表情包">＋</button>
          <button class="retro-btn small ghost sticker-manage-btn" title="管理表情包">管理</button>
        </div>
      </div>
      <div class="sticker-panel-grid">
        ${stickers.length === 0 ? '<div class="sticker-panel-empty">暂无表情包，点击 ＋ 添加</div>' : ''}
        ${stickers.map((s, i) => `
          <div class="sticker-panel-item" data-index="${i}" title="${s.name || ''}">
            <img src="${s.url}" alt="${s.name || '表情包'}" class="sticker-panel-thumb" onerror="this.style.display='none'" />
            <span class="sticker-panel-name">${s.name || ''}</span>
            <button class="sticker-delete-btn" data-index="${i}" title="删除">✕</button>
          </div>
        `).join('')}
      </div>
    `;

    // 管理按钮
    stickerPanel.querySelector(".sticker-manage-btn")?.addEventListener("click", () => {
      stickerManageMode = !stickerManageMode;
      const btn = stickerPanel.querySelector(".sticker-manage-btn");
      if (btn) btn.textContent = stickerManageMode ? "完成" : "管理";
      stickerPanel.querySelectorAll(".sticker-panel-item").forEach(item => {
        item.classList.toggle("manage-mode", stickerManageMode);
      });
    });

    // 点击表情包：管理模式下不可发送
    stickerPanel.querySelectorAll(".sticker-panel-item").forEach(item => {
      item.addEventListener("click", (e) => {
        if (stickerManageMode) return;
        if (e.target.closest(".sticker-delete-btn")) return;
        const idx = Number(item.dataset.index);
        const arr = loadStickers();
        const s = arr[idx];
        if (!s) return;
        const stickerMsg = {
          side: "me", text: s.name,
          time: new Date().toLocaleTimeString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false }),
          createdAt: Date.now(), stickerUrl: s.url, stickerName: s.name, type: "sticker"
        };
        chat.messages.push(stickerMsg);
        touchChatActive(chat);
        savePrivateChats();
        appendSingleMessage(body, stickerMsg, displayName, effectiveChat, chat);
        renderSidebarMessages();
      });
    });

    // 删除按钮
    stickerPanel.querySelectorAll(".sticker-delete-btn").forEach(btn => {
      btn.addEventListener("click", (e) => {
        e.stopPropagation();
        const idx = Number(btn.dataset.index);
        const arr = loadStickers();
        if (arr[idx] && confirm(`删除「${arr[idx].name}」？`)) {
          arr.splice(idx, 1);
          saveStickers(arr);
          renderStickerPanel();
          stickerManageMode = true;
          const manageBtn = stickerPanel.querySelector(".sticker-manage-btn");
          if (manageBtn) manageBtn.textContent = "完成";
          stickerPanel.querySelectorAll(".sticker-panel-item").forEach(item => {
            item.classList.add("manage-mode");
          });
        }
      });
    });

    // 添加按钮
    stickerPanel.querySelector(".sticker-add-btn")?.addEventListener("click", () => {
      const url = prompt("表情包图片URL：");
      if (!url) return;
      const name = prompt("表情包名字（会显示在聊天里）：");
      if (!name) return;
      const arr = loadStickers();
      arr.push({ url: url.trim(), name: name.trim() });
      saveStickers(arr);
      renderStickerPanel();
    });
  }

  stickerBtn?.addEventListener("click", () => {
    if (!stickerPanel) return;
    stickerPanel.hidden = !stickerPanel.hidden;
    if (!stickerPanel.hidden) {
      renderStickerPanel();
      // 隐藏图片面板
      const imgPanel = body.querySelector("#chatImagePanel");
      if (imgPanel) imgPanel.hidden = true;
    }
  });

    // ====== 图片面板（内嵌在输入框上方） ======
  const imageBtn = body.querySelector("#chatImageBtn");

  function renderImagePanel() {
    const imgPanel = body.querySelector("#chatImagePanel");
    if (!imgPanel) return;
    imgPanel.innerHTML = `
      <div class="sticker-panel-header">
        <span class="sticker-panel-title">发图片</span>
      </div>
      <div style="padding:8px">
        <textarea class="retro-input image-desc-input" rows="2" placeholder="描述你想发送的图片内容，AI会把它当成图片理解……" style="width:100%;resize:vertical;font-size:13px"></textarea>
        <button class="retro-btn small image-confirm-inline" style="margin-top:6px">发送</button>
      </div>
    `;
    imgPanel.querySelector(".image-confirm-inline")?.addEventListener("click", () => {
      const desc = imgPanel.querySelector(".image-desc-input")?.value.trim();
      if (!desc) { alert("请填写图片描述。"); return; }
      chat.messages.push({
        side: "me", text: desc,
        time: new Date().toLocaleTimeString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
 }),
        createdAt: Date.now(), type: "image", imageDesc: desc
      });
      touchChatActive(chat);
      savePrivateChats();
      renderPrivateChatBody(chat, body);
      renderSidebarMessages();
      imgPanel.hidden = true;
    });
  }

  imageBtn?.addEventListener("click", () => {
    const imgPanel = body.querySelector("#chatImagePanel");
    if (!imgPanel) return;
    imgPanel.hidden = !imgPanel.hidden;
    if (!imgPanel.hidden) {
      renderImagePanel();
      if (stickerPanel) stickerPanel.hidden = true;
    }
  });


  // ====== 非剧情角色时，隐藏接收按钮 ======
  if (effectiveChat.accountKind !== "character_account") {
    if (receiveBtn) receiveBtn.style.display = "none";
  } else {
    if (receiveBtn) receiveBtn.style.display = "";
  }

    const listEl = body.querySelector(".chat-message-list");
  if (listEl) {
    listEl.scrollTop = listEl.scrollHeight;
  }

  bindChatAvatarPopover(body, effectiveChat);
  bindNormaInlinePanels(chat, body);
  bindThreadShareCards(body);

}

function bindThreadShareCards(body) {
  if (!body || body.dataset.threadShareBinded === "1") return;

  body.dataset.threadShareBinded = "1";

  body.addEventListener("click", async (event) => {
    const card = event.target.closest(".chat-thread-share-card[data-shared-thread-id]");
    if (!card) return;

    event.preventDefault();
    event.stopPropagation();

    const threadId = Number(card.dataset.sharedThreadId);
    const commentId = Number(card.dataset.sharedCommentId || 0);

    if (!Number.isInteger(threadId) || threadId <= 0) {
      alert("帖子链接不正确。");
      return;
    }

    const socialOverlay = document.getElementById("socialMainOverlay");
    if (socialOverlay) {
      socialOverlay.hidden = true;
    }

    if (typeof window.openForumThreadById === "function") {
      await window.openForumThreadById(threadId, commentId || null);
      return;
    }

    window.dispatchEvent(
      new CustomEvent("forum:open-thread", {
        detail: {
          threadId,
          commentId: commentId || null
        }
      })
    );
  });
}

function renderChatTextWithThreadLinks(text) {
  return escapeHtml(text || "")
    .replace(/\n/g, "<br>")
    .replace(/thread:(\d+)/g, (full, threadId) => {
      return `<button class="chat-inline-thread-link" type="button" data-shared-thread-id="${escapeHtml(threadId)}">thread:${escapeHtml(threadId)}</button>`;
    })
    .replace(/cassell-forum:\/\/thread\/(\d+)/g, (full, threadId) => {
      return `<button class="chat-inline-thread-link" type="button" data-shared-thread-id="${escapeHtml(threadId)}">cassell-forum://thread/${escapeHtml(threadId)}</button>`;
    });
}

function renderChatMessages(chat, effectiveChat, displayName) {
  function timeToMinutes(timeText) {
    const text = String(timeText || "").trim();

    // 处理 09:21 这种
    const shortMatch = text.match(/^(\d{1,2}):(\d{2})$/);
    if (shortMatch) {
      return Number(shortMatch[1]) * 60 + Number(shortMatch[2]);
    }

    // 处理 09:21:33 这种
    const longMatch = text.match(/^(\d{1,2}):(\d{2}):(\d{2})$/);
    if (longMatch) {
      return Number(longMatch[1]) * 60 + Number(longMatch[2]);
    }

    // 如果以后是完整日期，也尽量处理
    const date = new Date(text);
    if (!Number.isNaN(date.getTime())) {
      return date.getHours() * 60 + date.getMinutes();
    }

    return null;
  }

  function shouldShowTime(msg, prevMsg) {
    // 第一条消息一定显示时间
    if (!prevMsg) return true;

    // 换人说话，要显示时间
    if (msg.side !== prevMsg.side) return true;

    const currentMinutes = timeToMinutes(msg.time);
    const prevMinutes = timeToMinutes(prevMsg.time);

    // 如果时间格式读不懂，就不额外显示
    if (currentMinutes === null || prevMinutes === null) return false;

    // 同一个人继续发，但超过 5 分钟，也显示时间
    return currentMinutes - prevMinutes > 5;
  }

  // 清理超过5分钟的临时消息（/ 指令的回复）
  const now = Date.now();
  const filteredMessages = chat.messages.filter(msg => {
    if (!msg.temporary) return true;
    return (now - (msg.createdAt || 0)) < 5 * 60 * 1000;
  });

  return filteredMessages.map((msg, index) => {

    const prevMsg = chat.messages[index - 1];
    const showTime = shouldShowTime(msg, prevMsg);

    const isMe = msg.side === "me";

    const avatarSrc = isMe
      ? (state.avatar || getDefaultAvatar("me"))
      : (effectiveChat.avatar || getDefaultAvatar(displayName));

    const avatarAlt = isMe ? "我" : displayName;

        const avatarButton = `
      <button
        class="chat-avatar-btn ${isMe ? "chat-avatar-me" : ""}"
        type="button"
        data-chat-avatar="${isMe ? "me" : "other"}"
        ${isMe ? "disabled" : ""}
      >
        <img src="${avatarSrc}" alt="${escapeHtml(avatarAlt)}" />
      </button>
    `;

    // 撤回消息
    if (msg.recalled) {
      return `
        <div class="chat-row ${isMe ? "me" : "other"}" style="justify-content:center;">
          <div style="font-size:12px;color:var(--muted,#888);font-style:italic;padding:4px 0;">
            ${isMe ? "你" : displayName} 撤回了一条消息
          </div>
        </div>
      `;
    }

       let bubbleContent = "";

    if (msg.panelHtml) {
      // 诺玛面板消息，原样显示
      bubbleContent = msg.panelHtml;
    } else if (msg.type === "sticker" && msg.stickerUrl) {
      // 表情包：显示图片
      bubbleContent = `
        <div class="chat-text chat-sticker-msg">
          <img src="${escapeHtml(msg.stickerUrl)}" alt="${escapeHtml(msg.stickerName || "表情包")}" class="chat-sticker-img" />
          <div class="chat-sticker-name">${escapeHtml(msg.stickerName || "")}</div>
        </div>
      `;
    } else if (msg.type === "image") {
      // 图片描述：显示图片占位符 + 描述文字
      bubbleContent = `
        <div class="chat-text chat-image-msg">
          <div class="chat-image-placeholder">
            <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
              <rect x="3" y="3" width="18" height="18" rx="2"/>
              <circle cx="8.5" cy="8.5" r="1.5"/>
              <polyline points="21 15 16 10 5 21"/>
            </svg>
            <span>图片</span>
          </div>
          <div class="chat-image-desc">${escapeHtml(msg.text || "")}</div>
        </div>
      `;
    } else {
      // 普通文字消息
      bubbleContent = `<div class="chat-text">${renderChatTextWithThreadLinks(msg.text || "")}</div>`;
    }

    // 引用消息显示（放在气泡内顶部）
    let quoteHtml = "";
    if (msg.quoteText) {
      quoteHtml = `
        <div class="chat-quote-block">
          <span class="chat-quote-icon">❝</span>
          ${escapeHtml(msg.quoteText).substring(0, 60)}${(msg.quoteText || "").length > 60 ? "..." : ""}
        </div>
      `;
    }

    const bubble = `
      <div class="chat-bubble ${msg.panelHtml ? "chat-bubble-panel" : ""}">
        ${quoteHtml}
        ${bubbleContent}
      </div>
    `;

    return `
      ${showTime ? `
        <div style="
          text-align:center;
          font-size:12px;
          color:#666;
          margin:14px 0 10px;
          font-family:'Share Tech Mono', monospace;
        ">
          ${escapeHtml(msg.time || "")}
        </div>
      ` : ""}

      <div class="chat-row ${isMe ? "me" : "other"} chat-msg-anim" data-msg-index="${index}">
        ${isMe ? bubble + avatarButton : avatarButton + bubble}
      </div>
    `;
  }).join("");
}


// ====== 追加单条消息到聊天页面（带弹入动画） ======
function appendSingleMessage(body, msg, displayName, effectiveChat, chat) {
  const listEl = body.querySelector(".chat-message-list");
  if (!listEl) return;

  const isMe = msg.side === "me";
  const avatarSrc = isMe
    ? (state.avatar || getDefaultAvatar("me"))
    : (effectiveChat.avatar || getDefaultAvatar(displayName));
  const avatarAlt = isMe ? "我" : displayName;

  if (msg.recalled) {
    const div = document.createElement("div");
    div.innerHTML = `
      <div class="chat-row ${isMe ? "me" : "other"}" style="justify-content:center;">
        <div style="font-size:12px;color:var(--muted,#888);font-style:italic;padding:4px 0;">
          ${isMe ? "你" : displayName} 撤回了一条消息
        </div>
      </div>
    `;
    listEl.appendChild(div.firstElementChild);
    requestAnimationFrame(() => { listEl.scrollTop = listEl.scrollHeight; });
    return;
  }

  let bubbleContent = "";
  if (msg.panelHtml) {
    bubbleContent = msg.panelHtml;
  } else if (msg.type === "sticker" && msg.stickerUrl) {
    bubbleContent = `
      <div class="chat-text chat-sticker-msg">
        <img src="${escapeHtml(msg.stickerUrl)}" alt="${escapeHtml(msg.stickerName || "表情包")}" class="chat-sticker-img" />
        <div class="chat-sticker-name">${escapeHtml(msg.stickerName || "")}</div>
      </div>
    `;
  } else if (msg.type === "image") {
    bubbleContent = `
      <div class="chat-text chat-image-msg">
        <div class="chat-image-placeholder">
          <svg viewBox="0 0 24 24" width="28" height="28" fill="none" stroke="currentColor" stroke-width="1.5">
            <rect x="3" y="3" width="18" height="18" rx="2"/>
            <circle cx="8.5" cy="8.5" r="1.5"/>
            <polyline points="21 15 16 10 5 21"/>
          </svg>
          <span>图片</span>
        </div>
        <div class="chat-image-desc">${escapeHtml(msg.text || "")}</div>
      </div>
    `;
  } else {
    bubbleContent = `<div class="chat-text">${renderChatTextWithThreadLinks(msg.text || "")}</div>`;
  }

  // 引用（放在气泡内部顶部，和 renderChatMessages 一致）
  let quoteHtml = "";
  if (msg.quoteText) {
    quoteHtml = `
      <div class="chat-quote-block">
        <span class="chat-quote-icon">❝</span>
        ${escapeHtml(msg.quoteText).substring(0, 60)}${(msg.quoteText || "").length > 60 ? "..." : ""}
      </div>
    `;
  }

  const bubble = `
    <div class="chat-bubble ${msg.panelHtml ? "chat-bubble-panel" : ""}">
      ${quoteHtml}
      ${bubbleContent}
    </div>
  `;

  const avatarButton = `
    <button class="chat-avatar-btn ${isMe ? "chat-avatar-me" : ""}" type="button" ${isMe ? "disabled" : ""}>
      <img src="${avatarSrc}" alt="${escapeHtml(avatarAlt)}" />
    </button>
  `;

  const div = document.createElement("div");
  div.innerHTML = `
    <div class="chat-row ${isMe ? "me" : "other"} chat-msg-anim" data-msg-index="${chat.messages.indexOf(msg)}">
      ${isMe ? bubble + avatarButton : avatarButton + bubble}
    </div>
  `;

  const newEl = div.firstElementChild;
  listEl.appendChild(newEl);

  requestAnimationFrame(() => {
    listEl.scrollTo({ top: listEl.scrollHeight, behavior: "smooth" });
  });

  let longTimer = null;
  const startLong = (e) => {
    longTimer = setTimeout(() => {
      const idx = Number(newEl.dataset.msgIndex);
      const touch = e.touches?.[0];
      showMsgContextMenu({
        clientX: touch ? touch.clientX : e.clientX,
        clientY: touch ? touch.clientY : e.clientY,
        preventDefault: () => {},
        stopPropagation: () => {}
      }, chat, idx, body);
    }, 500);
  };
  const cancelLong = () => { if (longTimer) { clearTimeout(longTimer); longTimer = null; } };
  newEl.addEventListener("mousedown", startLong);
  newEl.addEventListener("mouseup", cancelLong);
  newEl.addEventListener("mouseleave", cancelLong);
  newEl.addEventListener("touchstart", startLong, { passive: true });
  newEl.addEventListener("touchend", cancelLong);
}


// ====== 长按消息菜单 ======
function showMsgContextMenu(e, chat, msgIndex, body) {
  e.preventDefault();
  e.stopPropagation();
  // 删除旧菜单
  document.querySelectorAll(".chat-context-menu").forEach(el => el.remove());

  const msg = chat.messages[msgIndex];
  if (!msg) return;

  const menu = document.createElement("div");
  menu.className = "chat-context-menu";
  menu.innerHTML = `
    <div class="chat-ctx-item" data-action="quote">引用</div>
    ${msg.side === "me" ? '<div class="chat-ctx-item" data-action="recall">撤回</div>' : ""}
    ${msg.side === "me" ? '<div class="chat-ctx-item chat-ctx-danger" data-action="delete">删除</div>' : ""}
  `;

  // 定位
  const x = Math.min(e.clientX || e.pageX, window.innerWidth - 140);
  const y = Math.min(e.clientY || e.pageY, window.innerHeight - 120);
  menu.style.left = x + "px";
  menu.style.top = y + "px";
  document.body.appendChild(menu);

  // 点击菜单项
  menu.querySelectorAll(".chat-ctx-item").forEach(item => {
    item.addEventListener("click", () => {
      const action = item.dataset.action;

      if (action === "quote") {
        // 引用：显示引用预览
        const inputEl = body.querySelector(".chat-input");
        const inputBar = body.querySelector(".chat-input-bar");
        if (inputEl && inputBar) {
          inputEl.dataset.quoteText = msg.text || "";
          inputEl.focus();
          // 显示引用预览条（放在输入框栏的上方，独占一行）
          let previewBar = body.querySelector(".chat-quote-preview");
          if (!previewBar) {
            previewBar = document.createElement("div");
            previewBar.className = "chat-quote-preview";
            inputBar.parentNode.insertBefore(previewBar, inputBar);
          }
          previewBar.innerHTML = `
            <div class="chat-quote-preview-inner">
              <span class="chat-quote-icon">❝</span>
              <span class="chat-quote-preview-text">${escapeHtml((msg.text || "").substring(0, 50))}${(msg.text || "").length > 50 ? "..." : ""}</span>
              <button class="chat-quote-cancel-btn" type="button">✕</button>
            </div>
          `;
          previewBar.querySelector(".chat-quote-cancel-btn").addEventListener("click", () => {
            inputEl.dataset.quoteText = "";
            previewBar.remove();
          });
        }
      }

      if (action === "recall") {
        // 撤回：角色知道，玩家知道，但原文不显示
        if (confirm("确定撤回这条消息？角色会知道你撤回了。")) {
          msg.recalled = true;
          msg.text = "";
          msg.type = "";
          msg.stickerUrl = "";
          msg.stickerName = "";
          msg.quoteText = "";
          savePrivateChats();
          renderPrivateChatBody(chat, body);
        }
      }

      if (action === "delete") {
        // 删除：从记录中彻底移除
        if (confirm("确定彻底删除这条消息？角色将完全看不到。")) {
          chat.messages.splice(msgIndex, 1);
          savePrivateChats();
          renderPrivateChatBody(chat, body);
        }
      }

      menu.remove();
    });
  });

  // 点别处关闭（用 mousedown 而不是 click，避免松开鼠标时误关）
  setTimeout(() => {
    document.addEventListener("mousedown", function closeMenu(e) {
      // 如果点击在菜单内部，不关闭
      if (menu.contains(e.target)) return;
      menu.remove();
      document.removeEventListener("mousedown", closeMenu);
    });
  }, 100);
}

function deleteCurrentChatConversation(chat) {
  const displayName = getDisplayName(chat);

  const ok = confirm(
    `确定要删除与「${displayName}」的聊天会话吗？\n\n删除后，这个聊天会从消息列表中消失。`
  );

  if (!ok) return;

  markChatDeleted(chat);

  alert(`已删除与 ${displayName} 的聊天会话。`);

  closeSocialLayerOnly();
  currentChat = null;
  currentSocialView = null;

  renderSidebarMessages();

  if (window.ForumNav?.backOnly) {
    window.ForumNav.backOnly();
  } else {
    backNavOnly();
  }
}

function getChatTimeMinutes(timeText) {
  const match = String(timeText || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!match) return null;

  const hour = Number(match[1]);
  const minute = Number(match[2]);

  if (Number.isNaN(hour) || Number.isNaN(minute)) return null;

  return hour * 60 + minute;
}

function getCurrentChatTime() {
  const now = new Date();
  const hour = String(now.getHours()).padStart(2, "0");
  const minute = String(now.getMinutes()).padStart(2, "0");
  return `${hour}:${minute}`;
}

function bindChatAvatarPopover(body, contact) {
  body.querySelectorAll('.chat-avatar-btn[data-chat-avatar="other"]').forEach((btn) => {
    btn.addEventListener("click", (event) => {
      event.stopPropagation();
      openMiniPopover(contact, btn);
    });
  });
}

function openMiniPopover(contact, anchor) {
  const popover = document.getElementById("contactMiniPopover");
  if (!popover) return;

  const displayName = getDisplayName(contact);
  const rect = anchor.getBoundingClientRect();

  popover.innerHTML = `
    <div class="mini-profile-card">
      <div class="mini-profile-top">
        <img class="mini-profile-avatar" src="${contact.friendAvatar || contact.avatar || getDefaultAvatar(displayName)}" alt="${escapeHtml(displayName)}" />
        <div>
          <div class="mini-profile-name">${escapeHtml(displayName)}</div>
          <div class="mini-profile-code">ID: ${escapeHtml(contact.friendCode || contact.code || "UNKNOWN")}</div>
          <div class="mini-profile-status">${(contact.friendStatus || contact.status) === "online" ? "ONLINE" : "OFFLINE"}</div>
        </div>
      </div>
            <div class="mini-profile-desc">${escapeHtml(contact.signature || contact.desc || "")}</div>

            <div class="mini-profile-actions">
        <button id="miniProfileOpenBtn" class="retro-btn small">查看对方主页</button>
      </div>

    </div>
  `;

  popover.style.left = `${rect.right + 8}px`;
  popover.style.top = `${rect.top}px`;
  popover.hidden = false;

  document.getElementById("miniProfileOpenBtn")?.addEventListener("click", () => {
    popover.hidden = true;
    openContactProfile(contact, { fromChat: currentChat });
  });
  document.getElementById("miniProfileOpenBtn")?.addEventListener("click", () => {
    popover.hidden = true;
    openContactProfile(contact, { fromChat: currentChat });
  });

}

async function openMiniPopoverByStudentId(studentId, anchorRect) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(studentId)}`, {
      headers: {
        ...getAuthHeaders()
      }
    });

    const data = await res.json();

    if (!res.ok || !data.success || !data.user) {
      alert(data.message || "没有找到这个用户。");
      return;
    }

    const contact = accountToContact(data.user);

    const fakeAnchor = {
      getBoundingClientRect() {
        return anchorRect || {
          right: 320,
          top: 160
        };
      }
    };

    openMiniPopover(contact, fakeAnchor);
  } catch (error) {
    console.error("打开用户小名片失败：", error);
    alert("打开用户小名片失败。");
  }
}

// 论坛搜索卡片用：直接打开对方主页（不弹小名片）
export async function openContactProfileByStudentId(studentId) {
  try {
    const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(studentId)}`, {
      headers: {
        ...getAuthHeaders()
      }
    });

    const data = await res.json();

    if (!res.ok || !data.success || !data.user) {
      alert(data.message || "没有找到这个用户。");
      return;
    }

    const contact = accountToContact(data.user);
    openContactProfile(contact);
  } catch (error) {
    console.error("打开对方主页失败：", error);
    alert("打开对方主页失败。");
  }
}

window.addEventListener("social:open-mini-profile", async (event) => {
  const studentId = event.detail?.studentId;
  const anchorRect = event.detail?.anchorRect;

  if (!studentId) return;

  await openMiniPopoverByStudentId(studentId, anchorRect);
});

window.addEventListener(
  "social:open-own-character-profile",
  async (event) => {
    const studentId = String(event.detail?.studentId || "")
      .trim()
      .toUpperCase();

    if (!studentId) return;

    try {
      const response = await fetch(
        `${API_BASE_URL}/api/drama/characters/${encodeURIComponent(studentId)}`,
        {
          headers: {
            ...getAuthHeaders()
          }
        }
      );

      const data = await response.json();

      if (!response.ok || !data.success || !data.character) {
        alert(data.message || "没有找到这个剧情角色的资料。");
        return;
      }

      const character = data.character;

      const contact = {
        name: character.trueName || studentId,
        forumId: character.trueName || studentId,
        code: character.studentId || studentId,
        studentId: character.studentId || studentId,
        characterId: character.studentId || studentId,
        accountKind: "character_account",
        codeKind: "student",
        avatar:
          character.timelines?.[0]?.avatar ||
          state.currentAccount?.avatar ||
          "",
        status: state.userStatus || "online",
        signature:
          character.timelines?.[0]?.signature ||
          state.profile?.signature ||
          "",
        desc:
          character.timelines?.[0]?.description ||
          character.timelines?.[0]?.desc ||
          "",
        identityGroups:
          character.timelines?.[0]?.identityGroups ||
          state.profile?.identityGroups ||
          ["已认证"],
        timelines: Array.isArray(character.timelines)
          ? character.timelines
          : [],
        defaultTimelineId: character.timelines?.[0]?.id || "",
        friendshipStatus: "self"
      };

      openContactProfile(contact);
    } catch (error) {
      console.error("打开自己的剧情角色主页失败：", error);
      alert("打开剧情角色主页失败，请确认后端已经启动。");
    }
  }
);

async function openContactProfile(contact, options = {}) {
  // 每次打开剧情角色主页，都重新读取后端最新资料
  // 防止其他账号看到旧的时间线
  if (contact?.accountKind === "character_account") {
    const studentId = String(
      contact.characterId ||
        contact.studentId ||
        contact.code ||
        contact.friendCode ||
        ""
    )
      .trim()
      .toUpperCase();

    if (studentId) {
      try {
        const res = await fetch(
          `${API_BASE_URL}/api/drama/characters/${encodeURIComponent(
            studentId
          )}?t=${Date.now()}`,
          {
            cache: "no-store",
            headers: {
              ...getAuthHeaders()
            }
          }
        );

        const data = await res.json();

        if (res.ok && data.success && data.character) {
          contact = {
            ...contact,
            accountKind: "character_account",
            name: data.character.trueName || contact.name,
            characterId: data.character.studentId || studentId,
            studentId: data.character.studentId || studentId,
            code: data.character.studentId || studentId,
            timelines: Array.isArray(data.character.timelines)
              ? data.character.timelines
              : [],
            defaultTimelineId:
              data.character.timelines?.[0]?.id ||
              contact.defaultTimelineId ||
              ""
          };

          // 同时更新好友列表里保存的那份资料
          const friend = friends.find((item) => {
            const friendId = String(
              item.characterId ||
                item.studentId ||
                item.code ||
                item.friendCode ||
                ""
            )
              .trim()
              .toUpperCase();

            return friendId === studentId;
          });

          if (friend) {
            friend.timelines = contact.timelines;
            friend.defaultTimelineId = contact.defaultTimelineId;
            friend.name = contact.name;
            friend.characterId = contact.characterId;
            friend.studentId = contact.studentId;
            friend.code = contact.code;
          }
        }
      } catch (error) {
        console.warn("读取最新剧情角色时间线失败：", error);
      }
    }
  }

  currentContact = normalizeContact(contact);
  const effectiveContact = getEffectiveContact(currentContact);

  const forumId = effectiveContact.forumId || getDisplayName(effectiveContact);
  const accountCode = formatAccountCode(effectiveContact.code, effectiveContact);
  const accountCodeLabel = getAccountCodeLabel(effectiveContact);

  const overlay = document.getElementById("contactProfileOverlay");
  const title = document.getElementById("contactProfileTitle");
  const sub = document.getElementById("contactProfileSub");
  const body = document.getElementById("contactProfileBody");

  if (!overlay || !body) return;

  pushOrReplaceNav(`${forumId} 的个人主页`, closeContactLayerOnly, {
    type: "contact-profile",
    key: effectiveContact.code || forumId
  });

  if (title) title.textContent = `${forumId} 的个人主页`;
  if (sub) sub.textContent = `${accountCodeLabel}：${accountCode}`;

  const isCharacter = effectiveContact.accountKind === "character_account";

  body.innerHTML = `
    <div class="contact-profile-main">
      <div class="contact-profile-left">
        <img
          class="contact-profile-avatar"
          src="${effectiveContact.avatar || getDefaultAvatar(forumId)}"
          alt="${escapeHtml(forumId)}"
        />
        <div class="contact-profile-status ${effectiveContact.status === "online" ? "online" : "offline"}">
          ${effectiveContact.status === "online" ? "ONLINE" : "OFFLINE"}
        </div>
      </div>

      <div class="contact-profile-right">
        <h2>${escapeHtml(getDisplayName(effectiveContact))}</h2>
        ${
          getDisplayName(effectiveContact) !== forumId
            ? `<div class="contact-profile-id" style="font-size:12px;opacity:0.7">论坛ID：${escapeHtml(forumId)}</div>`
            : ""
        }

        <div class="contact-profile-id">
          ${escapeHtml(accountCodeLabel)}：${escapeHtml(accountCode)}
        </div>

        <div class="contact-profile-signature">
          ${escapeHtml(effectiveContact.signature || effectiveContact.desc || "暂无记录。")}
        </div>

                <div class="contact-profile-tags">
          ${(effectiveContact.identityGroups || ["已认证"]).map((tag) => `
            ${renderIdentityBadge(tag)}
          `).join("")}
        </div>

        <div class="contact-profile-main-actions">
          <button id="contactStartChatBtn" class="retro-btn" type="button">
            ${getContactMainActionText(effectiveContact)}
          </button>
        </div>

        ${isCharacter ? renderCharacterSettingsPanel(currentContact) : renderNormaPublicPanel(effectiveContact)}

      </div>
    </div>
  `;

  bindContactProfileForm(currentContact);
  bindContactStartChatButton(effectiveContact);
  refreshContactMenu(currentContact);

  overlay.hidden = false;

}

function renderNormaPublicPanel(contact) {
  return `
    <div class="profile-home-section">
      <div class="panel-title">档案说明</div>
      <div class="profile-home-text">
        ${escapeHtml(contact.desc || "暂无更多公开信息。")}
      </div>
    </div>
  `;
}

function renderCharacterSettingsPanel(contact) {
  
    const me = getSignedInStudentId();

  const possibleIds = [
    contact.code,
    contact.studentId,
    contact.student_id,
    contact.characterId,
    contact.character_id,
    contact.friendCode
  ]
    .map((value) => String(value || "").trim().toUpperCase())
    .filter(Boolean);

  // 只有当前登录编号和角色编号完全相同，才是这个角色本人
  // 管理员不能因为有管理权限而看到角色自己的编辑页面
  const isSelf =
    Boolean(me) &&
    possibleIds.includes(me);

  const timelines =
    Array.isArray(contact.timelines) && contact.timelines.length
      ? contact.timelines
      : [{ id: "default", name: "默认", identityGroups: ["已认证"] }];

  const settings = getCharacterSettings(contact);
  const activeTimeline = getActiveTimeline(contact);
  const activeTimelineId = activeTimeline?.id || timelines[0]?.id || "";

  // 账号本身已拥有的身份组：优先用自己主页资料；否则合并所有时间线里的
  function getAccountOwnedGroups() {
    if (
      isSelf &&
      Array.isArray(state.profile?.identityGroups) &&
      state.profile.identityGroups.length
    ) {
      return state.profile.identityGroups;
    }

    const set = new Set();

    (contact.ownedIdentityGroups || []).forEach((name) => {
      if (name) set.add(name);
    });

    (contact.identityGroups || []).forEach((name) => {
      if (name) set.add(name);
    });

    timelines.forEach((timeline) => {
      (timeline.identityGroups || []).forEach((name) => {
        if (name) set.add(name);
      });
    });

    if (!set.size) set.add("已认证");
    return Array.from(set);
  }

  const accountOwnedGroups = getAccountOwnedGroups();

  // 别人查看角色主页时：选择时间线 + 启用该账号 + 发私信
  if (!isSelf) {
    return `
      <div class="profile-home-section">
        <div class="panel-title">时间线</div>

        <div class="ai-account-settings-body">
          <label class="field-label">选择时间线</label>

          <select id="characterTimelineSelect" class="retro-input">
            ${timelines
              .map(
                (timeline) => `
              <option value="${escapeHtml(timeline.id)}" ${
                  timeline.id === activeTimelineId ? "selected" : ""
                }>
                ${escapeHtml(timeline.name || timeline.id)}
              </option>
            `
              )
              .join("")}
          </select>

          <label class="checkbox-line" style="margin-top:16px">
            <input
              type="checkbox"
              id="characterEnabledInput"
              ${settings.enabled === true ? "checked" : ""}
            />
            启用这个角色账号
          </label>

          <div class="btn-row">
            <button id="saveCharacterProfileSettingsBtn" class="retro-btn" type="button">
              保存设置
            </button>
          </div>
        </div>
      </div>
    `;
  }

  // ========== 角色自己登号：完整时间线设置 ==========
  return `
    <div class="profile-home-section">
      <div class="panel-title">时间线设置</div>

      <div class="ai-account-settings-body">
        <label class="field-label">选择时间线</label>
        <select id="characterTimelineSelect" class="retro-input">
          ${timelines
            .map(
              (t) => `
            <option value="${escapeHtml(t.id)}" ${
                t.id === activeTimelineId ? "selected" : ""
              }>
              ${escapeHtml(t.name || t.id)}
            </option>
          `
            )
            .join("")}
        </select>

        <div class="btn-row">
          <button id="characterAddTimelineBtn" class="retro-btn ghost" type="button">
            新建时间线
          </button>
        </div>

        <label class="field-label">时间线名称</label>
        <input id="characterTimelineNameInput" class="retro-input" />

        <label class="field-label">论坛ID</label>
        <input id="characterForumIdInput" class="retro-input" />

        <label class="field-label">性别</label>
        <input id="characterGenderInput" class="retro-input" placeholder="男 / 女 / 未设定" />

        <label class="field-label">签名</label>
        <input id="characterSignatureInput" class="retro-input" />

        <label class="field-label">头像链接</label>
        <input id="characterAvatarInput" class="retro-input" />

        <label class="field-label">编号展示形式</label>
        <select id="characterIdentityTypeInput" class="retro-input">
          <option value="student">学生学号（No. 前缀）</option>
          <option value="teacher">教职工号（去 AI，加血统尾缀）</option>
          <option value="executive">执行部档案号（去 AI，加血统尾缀）</option>
          <option value="system">系统账号</option>
        </select>

        <label class="field-label">血统等级</label>
        <input id="characterBloodRankInput" class="retro-input" placeholder="例如 A / S" />

        <label class="field-label">时间线简介</label>
        <textarea
          id="characterDescInput"
          class="retro-input ai-account-prompt-textarea"
          placeholder="这条时间线的背景说明……"
        ></textarea>

        <label class="field-label">该时间线拥有身份组（从账号已有身份组里多选）</label>
        <div class="checkbox-group" id="characterOwnedGroupsList">
          ${
            accountOwnedGroups.length
              ? accountOwnedGroups
                  .map(
                    (name) => `
            <label class="checkbox-line">
              <input
                type="checkbox"
                value="${escapeHtml(name)}"
                data-group-checkbox
              />
              ${escapeHtml(name)}
            </label>
          `
                  )
                  .join("")
              : `<div class="social-desc">这个账号还没有身份组。</div>`
          }
        </div>

        <label class="field-label">佩戴身份组（只显示上面勾选的）</label>
        <select id="characterDisplayGroupInput" class="retro-input">
          <option value="">不单独佩戴</option>
        </select>

        <div class="btn-row">
          <button id="characterSaveTimelineBtn" class="retro-btn" type="button">
            保存这条时间线
          </button>
        </div>

        <pre id="characterTimelineStatusBox" class="forum-ai-status">
只有角色自己能修改时间线资料。学号固定不变。
        </pre>
      </div>
    </div>
  `;
}

function getContactMainActionText(contact) {
  if (contact.accountKind !== "real_user") {
    return "发私信";
  }

  if (contact.friendshipStatus === "self") return "这是你自己";
  if (contact.friendshipStatus === "friends") return "发私信";
  if (contact.friendshipStatus === "sent") return "申请已发送";
  if (contact.friendshipStatus === "received") return "对方已申请你";

  return "添加好友";
}

function bindContactStartChatButton(contact) {
  const btn = document.getElementById("contactStartChatBtn");

  btn?.addEventListener("click", async () => {
    if (contact.accountKind !== "real_user") {
      openChatWithContact(contact);
      return;
    }

    if (contact.friendshipStatus === "self") {
      alert("这是你自己的主页。");
      return;
    }

    if (contact.friendshipStatus === "friends") {
      openChatWithContact(contact);
      return;
    }

    if (contact.friendshipStatus === "sent") {
      alert("好友申请已经发送，请等待对方通过。");
      return;
    }

    if (contact.friendshipStatus === "received") {
      alert("对方已经申请添加你，请到系统通知里处理。");
      openSystemNotice();
      return;
    }

    await sendFriendRequest(contact.code);
  });
}

function bindContactProfileForm(contact) {
  const select = document.getElementById("characterTimelineSelect");
  if (!select) return;

  const nameInput = document.getElementById("characterTimelineNameInput");
  const forumIdInput = document.getElementById("characterForumIdInput");
  const genderInput = document.getElementById("characterGenderInput");
  const signatureInput = document.getElementById("characterSignatureInput");
  const avatarInput = document.getElementById("characterAvatarInput");
  const identityTypeInput = document.getElementById("characterIdentityTypeInput");
  const bloodRankInput = document.getElementById("characterBloodRankInput");
  const descInput = document.getElementById("characterDescInput");
  const displayGroupInput = document.getElementById("characterDisplayGroupInput");
  const enabledInput = document.getElementById("characterEnabledInput");
  const userPromptInput = document.getElementById("characterUserPromptInput");
  const statusBox = document.getElementById("characterTimelineStatusBox");

  // 有 nameInput 说明是“角色自己”的完整编辑页
  const isSelfEditor = !!nameInput;

  const studentId = String(
    contact.code || contact.characterId || contact.studentId || ""
  )
    .trim()
    .toUpperCase();

  let timelines = Array.isArray(contact.timelines) ? [...contact.timelines] : [];

  function writeStatus(text) {
    if (statusBox) statusBox.textContent = text;
  }

  function collectOwnedGroups() {
    return Array.from(
      document.querySelectorAll("[data-group-checkbox]:checked")
    ).map((item) => item.value);
  }

  function getBeautifyTextsForGroup(groupName) {
    const target = String(groupName || "").trim();
    if (!target) return [];

    const group = findNormaGroupByDisplayText(target);
    if (!group) return [];

    const beautifyTexts = Array.isArray(group.beautifyTexts)
      ? group.beautifyTexts
      : Array.isArray(group.beautify_texts)
        ? group.beautify_texts
        : String(group.beautifyTexts || group.beautify_texts || "")
            .split(/[\n,，/]/)
            .map((item) => item.trim())
            .filter(Boolean);

    const badgeText = String(
      group.badgeText || group.badge_text || ""
    ).trim();

    return [...new Set(
      [
        badgeText,
        ...beautifyTexts
      ].filter(Boolean)
    )];
  }

    function getDisplayGroupOptions(ownedGroups) {
    const options = [];
    const list = Array.isArray(ownedGroups) ? ownedGroups : [];

    list.forEach((groupName) => {
      const originalName = String(groupName || "").trim();
      if (!originalName) return;

      // 原身份组本身也可以佩戴
      options.push({
        value: originalName,
        label: originalName
      });

      const beautifyTexts = getBeautifyTextsForGroup(originalName);

      beautifyTexts.forEach((beautifyText) => {
        const text = String(beautifyText || "").trim();

        if (!text || text === originalName) return;

        options.push({
          // 保存时仍然保存真正的美化名称
          value: text,

          // 下拉框显示为：S级·美化身份组名字
          label: `${originalName}·${text}`
        });
      });
    });

    const uniqueOptions = [];
    const usedValues = new Set();

    options.forEach((option) => {
      if (usedValues.has(option.value)) return;

      usedValues.add(option.value);
      uniqueOptions.push(option);
    });

    return uniqueOptions;
  }

  function refreshDisplayGroupOptions(ownedGroups, currentDisplay = "") {
    if (!displayGroupInput) return;

    const options = getDisplayGroupOptions(ownedGroups);
    const selectedValue = String(currentDisplay || "").trim();

    displayGroupInput.innerHTML =
      `<option value="">不单独佩戴</option>` +
      options
        .map(
          (option) => `
        <option value="${escapeHtml(option.value)}" ${
            option.value === selectedValue ? "selected" : ""
          }>
          ${escapeHtml(option.label)}
        </option>
      `
        )
        .join("");

    // 如果以前保存的是美化名称，也能正确显示
    if (selectedValue) {
      displayGroupInput.value = selectedValue;
    }
  }

  function fillFormByTimelineId(timelineId) {
    if (!isSelfEditor) return;

    const timeline =
      timelines.find((item) => item.id === timelineId) || timelines[0];

    if (!timeline) return;

    if (nameInput) nameInput.value = timeline.name || "";
    if (forumIdInput) forumIdInput.value = timeline.forumId || "";
    if (genderInput) genderInput.value = timeline.gender || "未设定";
    if (signatureInput) signatureInput.value = timeline.signature || "";
    if (avatarInput) avatarInput.value = timeline.avatar || "";
    if (identityTypeInput) {
      identityTypeInput.value =
        timeline.identityType || timeline.codeKind || "student";
    }
    if (bloodRankInput) bloodRankInput.value = timeline.bloodRank || "";
    if (descInput) descInput.value = timeline.desc || "";

    const owned = Array.isArray(timeline.identityGroups)
      ? timeline.identityGroups
      : ["已认证"];

    document.querySelectorAll("[data-group-checkbox]").forEach((checkbox) => {
      checkbox.checked = owned.includes(checkbox.value);
    });

    refreshDisplayGroupOptions(owned, timeline.displayGroup || "");
  }

  // 勾选身份组时，实时刷新“佩戴身份组”
  document.querySelectorAll("[data-group-checkbox]").forEach((checkbox) => {
    checkbox.addEventListener("change", () => {
      const owned = collectOwnedGroups();
      const current = displayGroupInput?.value || "";
      refreshDisplayGroupOptions(
        owned,
        owned.includes(current) ? current : ""
      );
    });
  });

  // 切换时间线
  select.addEventListener("change", () => {
    // 别人看：只切换展示用的时间线
    if (!isSelfEditor) {
      saveOneCharacterSettings(contact, {
        timelineId: select.value
      });
      openContactProfile(contact);
      return;
    }

    // 角色自己：切换后填表
    saveOneCharacterSettings(contact, {
      timelineId: select.value
    });
    fillFormByTimelineId(select.value);
  });

  if (isSelfEditor) {
    fillFormByTimelineId(select.value || timelines[0]?.id || "");
  }

  // 新建时间线（只有角色自己）
  document
    .getElementById("characterAddTimelineBtn")
    ?.addEventListener("click", async () => {
      const name = prompt(
        "新时间线叫什么？",
        `时间线 ${timelines.length + 1}`
      );
      if (name === null) return;

      writeStatus("正在新建时间线……");

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/drama/characters/${studentId}/timelines`,
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders()
            },
            body: JSON.stringify({
              name: name.trim() || `时间线 ${timelines.length + 1}`,
              forumId: contact.forumId || contact.name || "",
              gender: "未设定",
              signature: "",
              avatar: contact.avatar || "",
              identityType: "student",
              identityGroups: ["已认证"]
            })
          }
        );

        const data = await res.json();

        if (!res.ok || !data.success) {
          writeStatus(data.message || "新建失败。");
          return;
        }

        contact.timelines = data.character?.timelines || [];
        await enrichFriendsWithDramaData();
        await openContactProfile(contact);
        writeStatus("已新建时间线。");
      } catch (error) {
        console.error(error);
        writeStatus("新建失败。");
      }
    });

  // 保存时间线资料（只有角色自己）
  document
    .getElementById("characterSaveTimelineBtn")
    ?.addEventListener("click", async () => {
      const timelineId = select.value;

      if (!timelineId) {
        writeStatus("没有可保存的时间线。");
        return;
      }

      const identityGroups = collectOwnedGroups();
      if (!identityGroups.length) {
        writeStatus("至少勾选一个拥有身份组。");
        return;
      }

      const displayGroup = displayGroupInput?.value || "";

      const allowedDisplayGroups = getDisplayGroupOptions(identityGroups).map(
        (option) => option.value
      );

      if (
        displayGroup &&
        !allowedDisplayGroups.includes(displayGroup)
      ) {
        writeStatus(
          "佩戴身份组必须从已勾选的拥有身份组，或这些身份组的美化名称里选择。"
        );
        return;
      }

      writeStatus("正在保存时间线……");

      try {
        const res = await fetch(
          `${API_BASE_URL}/api/drama/characters/${studentId}/timelines/${encodeURIComponent(
            timelineId
          )}`,
          {
            method: "PUT",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders()
            },
            body: JSON.stringify({
              name: nameInput?.value.trim() || "",
              forumId: forumIdInput?.value.trim() || "",
              gender: genderInput?.value.trim() || "未设定",
              signature: signatureInput?.value.trim() || "",
              avatar: avatarInput?.value.trim() || "",
              identityType: identityTypeInput?.value || "student",
              bloodRank: bloodRankInput?.value.trim() || "",
              desc: descInput?.value || "",
              identityGroups,
              displayGroup
            })
          }
        );

        const data = await res.json();

        if (!res.ok || !data.success) {
          writeStatus(data.message || "保存失败。");
          return;
        }

        contact.timelines = data.character?.timelines || [];
        timelines = [...contact.timelines];

        saveOneCharacterSettings(contact, {
          timelineId
        });

        await enrichFriendsWithDramaData();
        writeStatus("时间线已保存。");
        await openContactProfile(contact);
      } catch (error) {
        console.error(error);
        writeStatus("保存失败。");
      }
    });

  // 保存“启用账号 / 用户提示词”（所有人都能存自己的本地设置）
  document
    .getElementById("saveCharacterProfileSettingsBtn")
    ?.addEventListener("click", () => {
      saveOneCharacterSettings(contact, {
        timelineId: select.value,
        enabled: !!enabledInput?.checked,
        userPrompt: userPromptInput?.value || ""
      });

      writeStatus("已保存启用状态和用户提示词。");
      openContactProfile(contact);
    });
}

function closeSocialMain() {
  // 私聊：只关掉聊天层，回到上一级
  if (currentSocialView === "chat" && currentChat) {
    const chat = currentChat;
    // 注意：当前这一层是私聊本身，要看“上一层”
    const previous = navStack[navStack.length - 2];

    closeSocialLayerOnly();
    backNavOnly();

    // 如果是从个人主页点进来的，返回个人主页
    if (previous && previous.type === "contact-profile") {
      const matchedFriend = findFriendForContact(chat);
      openContactProfile(matchedFriend || chat);
    }

    return;
  }

  // 群聊：同样只退一层
  if (currentSocialView === "group-chat" && currentChat) {
    closeSocialLayerOnly();
    backNavOnly();
    return;
  }

  // 系统通知等
  closeContactLayerOnly();
  closeSocialLayerOnly();
  backNavOnly();
}

function closeContactProfile() {
  closeContactLayerOnly();
  backNavOnly();
}

function refreshContactMenu(contact) {
  const deleteBtn = document.querySelector('[data-contact-action="delete"]');
  const editBtn = document.querySelector('[data-contact-action="edit"]');

  if (deleteBtn) {
    deleteBtn.hidden = contact.accountKind === "norma_bot";
  }

  if (editBtn) {
    editBtn.hidden = !isManager();

        if (contact.accountKind === "norma_bot") {
      editBtn.textContent = "诺玛设置";
    } else {
      editBtn.textContent = "修改对方主页";
    }

  }
}

function getAiAccountAdminSettings(contact, mode) {
  if (mode === "norma") {
    return state.normaBotSettings || {};
  }

  return getCharacterSettings(contact).adminSettings || {};
}

function saveAiAccountAdminSettings(contact, mode, settingsPatch) {
  if (mode === "norma") {
    saveNormaBotSettings(settingsPatch);
    return;
  }

  const current = getCharacterSettings(contact);

  saveOneCharacterSettings(contact, {
    adminSettings: {
      ...(current.adminSettings || {}),
      ...settingsPatch
    }
  });
}

async function openAiAccountSettings(contact, mode) {
  if (!isManager()) {
    alert("只有管理员可以打开这个设置。");
    return;
  }

  const displayContact = getEffectiveContact(contact);
  const displayName = getDisplayName(displayContact);

    let settings = getAiAccountAdminSettings(contact, mode);

  if (mode === "norma") {
    const response = await fetch(`${API_BASE_URL}/api/norma/settings`, {
      headers: {
        ...getAuthHeaders()
      }
    });

    const data = await response.json();

    if (!response.ok || !data.success) {
      alert(data.message || "读取诺玛设置失败。");
      return;
    }

    settings = {
      ...settings,
      apiBaseUrl: data.settings.api_url || "",
      model: data.settings.model || "",
      prompt: data.settings.prompt || "",
      apiKey: settings.apiKey || ""
    };
  }

  closeAiAccountSettings();

  const overlay = document.createElement("div");
  overlay.id = "aiAccountSettingsOverlay";
  overlay.className = "ai-account-settings-overlay";

  overlay.innerHTML = `
    <div class="ai-account-settings-window">
      <div class="social-main-header">
        <div>
          <div class="panel-title">${escapeHtml(displayName)} 设置</div>
          <div class="social-main-sub">${mode === "norma" ? "诺玛专属 API / 提示词" : "剧情角色 API / 官方提示词"}</div>
        </div>
        <button id="closeAiAccountSettingsBtn" class="win-btn">返回</button>
      </div>

      <div class="ai-account-settings-body">
        <label class="field-label">API 地址</label>
        <input id="aiAccountApiBaseInput" class="retro-input" value="${escapeHtml(settings.apiBaseUrl || "")}" />

        <label class="field-label">API Key</label>
        <input id="aiAccountApiKeyInput" class="retro-input" type="password" value="${escapeHtml(settings.apiKey || "")}" />

        <label class="field-label">模型名</label>
        <input id="aiAccountModelInput" class="retro-input" value="${escapeHtml(settings.model || "")}" />

        <label class="field-label">已拉取模型</label>
        <select id="aiAccountModelSelect" class="retro-input">
          ${renderAiModelOptions(settings)}
        </select>

        <div class="btn-row">
          <button
  id="saveAiAccountSettingsBtn"
  class="retro-btn"
  type="button"
>
  保存设置
</button>

<button
  id="fetchAiAccountModelsBtn"
  class="retro-btn ghost"
  type="button"
>
  拉取模型
</button>

        </div>

        <pre id="aiAccountStatusBox" class="forum-ai-status">等待设置。</pre>

        <label class="field-label">${mode === "norma" ? "诺玛提示词" : "官方提示词"}</label>
        <textarea id="aiAccountPromptInput" class="retro-input ai-account-prompt-textarea">${escapeHtml(settings.prompt || "")}</textarea>

                ${
          mode === "norma"
            ? `
              <div class="norma-prompt-entry-box">
                <div class="panel-title">提示词条目</div>

                <p class="ai-account-help">
                  蓝灯：每次都读取。绿灯：出现关键词时才读取。
                </p>

                <label class="field-label">条目名称</label>
                <input
                  id="normaPromptTitleInput"
                  class="retro-input"
                  placeholder="例如：身份组规则"
                />

                <label class="field-label">灯号</label>
                <select id="normaPromptTypeInput" class="retro-input">
                  <option value="blue">蓝灯：每次读取</option>
                  <option value="green">绿灯：关键词触发</option>
                </select>

                <label class="field-label">关键词</label>
                <input
                  id="normaPromptKeywordsInput"
                  class="retro-input"
                  placeholder="绿灯填写，多个关键词用逗号隔开"
                />

                <label class="field-label">提示词内容</label>
                <textarea
                  id="normaPromptContentInput"
                  class="retro-input ai-account-prompt-textarea"
                  placeholder="写诺玛需要遵守的规则"
                ></textarea>

                <button
                  id="addNormaPromptEntryBtn"
                  class="retro-btn"
                  type="button"
                >
                  添加提示词条目
                </button>

                <pre id="normaPromptEntryStatusBox" class="forum-ai-status">
尚未读取提示词条目。
                </pre>

                <div id="normaPromptEntryList"></div>
              </div>
            `
            : ""
        }

      </div>
    </div>
  `;

  document.body.appendChild(overlay);

    if (mode === "norma") {
    const promptTitleInput = document.getElementById(
      "normaPromptTitleInput"
    );
    const promptTypeInput = document.getElementById(
      "normaPromptTypeInput"
    );
    const promptKeywordsInput = document.getElementById(
      "normaPromptKeywordsInput"
    );
    const promptContentInput = document.getElementById(
      "normaPromptContentInput"
    );
    const addPromptBtn = document.getElementById(
      "addNormaPromptEntryBtn"
    );
    const promptStatusBox = document.getElementById(
      "normaPromptEntryStatusBox"
    );
    const promptList = document.getElementById(
      "normaPromptEntryList"
    );

    function showPromptStatus(message) {
      if (promptStatusBox) {
        promptStatusBox.textContent = message;
      }
    }

    function showPromptEntries(entries) {
      if (!promptList) return;

      if (!entries.length) {
        promptList.innerHTML = `
          <div class="ai-account-help">
            还没有提示词条目。
          </div>
        `;
        return;
      }

      promptList.innerHTML = entries
        .map((entry) => {
          const lightName =
            entry.light_type === "green"
              ? "绿灯"
              : "蓝灯";

          const keywords = Array.isArray(entry.keywords)
            ? entry.keywords.join("、")
            : "";

          return `
            <div class="norma-prompt-entry-item">
              <div class="norma-prompt-entry-title">
                ${escapeHtml(entry.title)}
                <span>${lightName}</span>
              </div>

              ${
                keywords
                  ? `<div>关键词：${escapeHtml(keywords)}</div>`
                  : ""
              }

              <div class="norma-prompt-entry-content">
                ${escapeHtml(entry.content)}
              </div>

              <button
                class="retro-btn edit-norma-prompt-btn"
                data-entry-id="${entry.id}"
                type="button"
              >
                修改
              </button>

              <button
                class="retro-btn ghost delete-norma-prompt-btn"
                data-entry-id="${entry.id}"
                type="button"
              >
                删除
              </button>
            </div>
          `;
        })
        .join("");

              promptList
        .querySelectorAll(".edit-norma-prompt-btn")
        .forEach((button) => {
          button.addEventListener("click", () => {
            const entryId = Number(button.dataset.entryId);
            const entry = entries.find(
              (item) => Number(item.id) === entryId
            );

            if (!entry) {
              showPromptStatus("找不到这条提示词。");
              return;
            }

            promptTitleInput.value = entry.title || "";
            promptTypeInput.value = entry.light_type || "blue";
            promptKeywordsInput.value = Array.isArray(entry.keywords)
              ? entry.keywords.join(",")
              : "";
            promptContentInput.value = entry.content || "";

            addPromptBtn.textContent = "保存修改";
            addPromptBtn.dataset.editingId = String(entry.id);

            showPromptStatus(
              "已经把这条提示词放进上面的输入框。修改完成后，点击“保存修改”。"
            );
          });
        });

      promptList
        .querySelectorAll(".delete-norma-prompt-btn")
        .forEach((button) => {
          button.addEventListener("click", async () => {
            const entryId = button.dataset.entryId;

            if (!confirm("确定要删除这条提示词吗？")) {
              return;
            }

            const response = await fetch(
              `${API_BASE_URL}/api/norma/prompt-entries/${entryId}`,
              {
                method: "DELETE",
                headers: {
                  ...getAuthHeaders()
                }
              }
            );

            const data = await response.json();

            if (!response.ok || !data.success) {
              showPromptStatus(data.message || "删除失败。");
              return;
            }

            showPromptStatus("提示词已删除。");
            loadPromptEntries();
          });
        });
    }

    async function loadPromptEntries() {
      try {
        const response = await fetch(
          `${API_BASE_URL}/api/norma/prompt-entries`,
          {
            headers: {
              ...getAuthHeaders()
            }
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          showPromptStatus(data.message || "读取提示词失败。");
          return;
        }

        showPromptEntries(data.entries || []);
      } catch (error) {
        showPromptStatus("读取提示词失败，请确认后端已启动。");
      }
    }

    addPromptBtn?.addEventListener("click", async () => {
      const editingId = addPromptBtn.dataset.editingId || "";
      const title = promptTitleInput?.value.trim() || "";
      const lightType = promptTypeInput?.value || "blue";
      const content = promptContentInput?.value.trim() || "";

      const keywords = (promptKeywordsInput?.value || "")
        .split(/[，,]/)
        .map((item) => item.trim())
        .filter(Boolean);

      if (!title) {
        showPromptStatus("请填写条目名称。");
        return;
      }

      if (!content) {
        showPromptStatus("请填写提示词内容。");
        return;
      }

      if (lightType === "green" && keywords.length === 0) {
        showPromptStatus("绿灯提示词必须填写关键词。");
        return;
      }

      try {
        const response = await fetch(
          editingId
            ? `${API_BASE_URL}/api/norma/prompt-entries/${editingId}`
            : `${API_BASE_URL}/api/norma/prompt-entries`,
          {
            method: editingId ? "PUT" : "POST",
            headers: {
              "Content-Type": "application/json",
              ...getAuthHeaders()
            },
            body: JSON.stringify({
              title,
              content,
              light_type: lightType,
              keywords
            })
          }
        );

        const data = await response.json();

        if (!response.ok || !data.success) {
          showPromptStatus(data.message || "添加失败。");
          return;
        }

        promptTitleInput.value = "";
        promptKeywordsInput.value = "";
        promptContentInput.value = "";

        delete addPromptBtn.dataset.editingId;
        addPromptBtn.textContent = "添加提示词条目";

        showPromptStatus(
          editingId ? "提示词条目已修改。" : "提示词条目已添加。"
        );
        loadPromptEntries();
      } catch (error) {
        showPromptStatus("添加失败，请确认后端已启动。");
      }
    });

    loadPromptEntries();
  }

  const closeBtn = document.getElementById("closeAiAccountSettingsBtn");
  const saveBtn = document.getElementById("saveAiAccountSettingsBtn");
  const fetchBtn = document.getElementById("fetchAiAccountModelsBtn");
    document
    .getElementById("fetchAiAccountModelsBtn")
    ?.addEventListener("click", async (event) => {
      event.preventDefault();

      const form = readAiAccountSettingsForm();
      const statusBox = document.getElementById("aiAccountStatusBox");

      if (!form.apiBaseUrl) {
        statusBox.textContent = "请先填写 API 地址。";
        return;
      }

      const modelsUrl = buildModelsUrl(form.apiBaseUrl);

      statusBox.textContent =
        `正在拉取模型列表……\n${modelsUrl}`;

      try {
        const response = await fetch(modelsUrl, {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
            ...(form.apiKey
              ? {
                  Authorization: `Bearer ${form.apiKey}`
                }
              : {})
          }
        });

        const data = await response.json().catch(() => null);

        if (!response.ok) {
          statusBox.textContent =
            `拉取失败：${response.status}\n` +
            (data?.error?.message ||
              data?.message ||
              "请检查 API 地址和 Key。");
          return;
        }

        const models = normalizeModels(data);

        if (!models.length) {
          statusBox.textContent =
            "没有读到模型。这个服务可能不支持读取模型列表。";
          return;
        }

        saveAiAccountAdminSettings(contact, mode, {
          ...form,
          availableModels: models,
          model: form.model || models[0]
        });

        statusBox.textContent =
          `拉取成功，共找到 ${models.length} 个模型。`;

        document
          .getElementById("aiAccountModelSelect")
          .innerHTML = renderAiModelOptions({
            ...form,
            availableModels: models,
            model: form.model || models[0]
          });
      } catch (error) {
        statusBox.textContent =
          "拉取失败。\n" +
          String(error);
      }
    });

  const modelSelect = document.getElementById("aiAccountModelSelect");
  const modelInput = document.getElementById("aiAccountModelInput");

  closeBtn?.addEventListener("click", closeAiAccountSettings);

  modelSelect?.addEventListener("change", () => {
    if (modelSelect.value && modelInput) {
      modelInput.value = modelSelect.value;
    }
  });

    saveBtn?.addEventListener("click", async () => {
    const form = readAiAccountSettingsForm();

    if (mode !== "norma") {
      saveAiAccountAdminSettings(contact, mode, form);
      writeAiAccountStatus(["设置已保存。"]);
      return;
    }

    if (!form.apiBaseUrl || !form.apiKey || !form.model) {
      writeAiAccountStatus([
        "诺玛 API 地址、API Key、模型名都要填写。"
      ]);
      return;
    }

    try {
      const response = await fetch(`${API_BASE_URL}/api/norma/settings`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          api_url: form.apiBaseUrl,
          api_key: form.apiKey,
          model: form.model,
          prompt: form.prompt
        })
      });

      const data = await response.json();

      if (!response.ok || !data.success) {
        writeAiAccountStatus([
          data.message || "保存诺玛设置失败。"
        ]);
        return;
      }

      writeAiAccountStatus(["诺玛设置已保存。"]);
    } catch (error) {
      writeAiAccountStatus([
        "保存失败，请确认后端已经启动。"
      ]);
    }
  });

}

function closeAiAccountSettings() {

  document.getElementById("aiAccountSettingsOverlay")?.remove();
}

// ====== 管理员：修改角色主页 / 时间线管理 ======

function closeCharacterAdminPanel() {
  document.getElementById("characterAdminOverlay")?.remove();
}

async function openCharacterAdminPanel(contact) {
  if (!isManager()) {
    alert("只有管理员可以修改角色主页。");
    return;
  }

  const studentId = String(contact.code || contact.characterId || "").toUpperCase();
  if (!studentId) {
    alert("找不到这个角色的学号。");
    return;
  }

  closeCharacterAdminPanel();

  let character = null;

  try {
    const res = await fetch(`${API_BASE_URL}/api/drama/characters/${studentId}`, {
      headers: {
        ...getAuthHeaders()
      }
    });
    const data = await res.json();

    if (!data.success || !data.character) {
      alert(data.message || "读取角色资料失败。");
      return;
    }

    character = data.character;
  } catch (error) {
    console.error(error);
    alert("读取角色资料失败。");
    return;
  }

  const timelines = Array.isArray(character.timelines) ? character.timelines : [];
  const firstId = timelines[0]?.id || "";

  const overlay = document.createElement("div");
  overlay.id = "characterAdminOverlay";
  overlay.className = "ai-account-settings-overlay";

  overlay.innerHTML = `
    <div class="ai-account-settings-window">
      <div class="social-main-header">
        <div>
          <div class="panel-title">修改 ${escapeHtml(character.trueName || studentId)} 的主页</div>
          <div class="social-main-sub">管理时间线 · 学号固定为 ${escapeHtml(studentId)}</div>
        </div>
        <button id="closeCharacterAdminBtn" class="win-btn">返回</button>
      </div>

      <div class="ai-account-settings-body">
        <label class="field-label">选择时间线</label>
        <select id="adminTimelineSelect" class="retro-input">
          ${timelines.map((t) => `
            <option value="${escapeHtml(t.id)}">${escapeHtml(t.name || t.id)}</option>
          `).join("")}
        </select>

        <div class="btn-row">
          <button id="adminAddTimelineBtn" class="retro-btn ghost">新建时间线</button>
        </div>

        <label class="field-label">时间线名称</label>
        <input id="adminTimelineNameInput" class="retro-input" />

        <label class="field-label">论坛ID</label>
        <input id="adminForumIdInput" class="retro-input" />

        <label class="field-label">性别</label>
        <input id="adminGenderInput" class="retro-input" placeholder="男 / 女 / 未设定" />

        <label class="field-label">签名</label>
        <input id="adminSignatureInput" class="retro-input" />

        <label class="field-label">头像链接</label>
        <input id="adminAvatarInput" class="retro-input" />

        <label class="field-label">编号展示形式</label>
        <select id="adminIdentityTypeInput" class="retro-input">
          <option value="student">学生学号（No. 前缀）</option>
          <option value="teacher">教职工号（去 AI，加血统尾缀）</option>
          <option value="executive">执行部档案号（去 AI，加血统尾缀）</option>
          <option value="system">系统账号</option>
        </select>

        <label class="field-label">血统等级（仅给 AI 提示词 / 档案号字母用，主页不单独显示）</label>
        <input id="adminBloodRankInput" class="retro-input" placeholder="例如 A / S" />

        <label class="field-label">时间线简介</label>
        <textarea id="adminDescInput" class="retro-input ai-account-prompt-textarea" placeholder="这条时间线的背景说明……"></textarea>

        <div class="btn-row">
          <button id="adminSaveTimelineBtn" class="retro-btn">保存这条时间线</button>
        </div>

        <pre id="adminTimelineStatusBox" class="forum-ai-status">学号固定不变，只改展示形式和主页资料。</pre>
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  const select = document.getElementById("adminTimelineSelect");
  const nameInput = document.getElementById("adminTimelineNameInput");
  const forumIdInput = document.getElementById("adminForumIdInput");
  const genderInput = document.getElementById("adminGenderInput");
  const signatureInput = document.getElementById("adminSignatureInput");
  const avatarInput = document.getElementById("adminAvatarInput");
  const identityTypeInput = document.getElementById("adminIdentityTypeInput");
  const bloodRankInput = document.getElementById("adminBloodRankInput");
  const descInput = document.getElementById("adminDescInput");
  const statusBox = document.getElementById("adminTimelineStatusBox");

  function fillFormByTimelineId(timelineId) {
    const timeline = timelines.find((t) => t.id === timelineId) || timelines[0];
    if (!timeline) return;

    nameInput.value = timeline.name || "";
    forumIdInput.value = timeline.forumId || "";
    genderInput.value = timeline.gender || "未设定";
    signatureInput.value = timeline.signature || "";
    avatarInput.value = timeline.avatar || "";
    identityTypeInput.value = timeline.identityType || timeline.codeKind || "student";
    bloodRankInput.value = timeline.bloodRank || "";
    descInput.value = timeline.desc || "";
  }

  function writeStatus(text) {
    if (statusBox) statusBox.textContent = text;
  }

  fillFormByTimelineId(firstId);

  document.getElementById("closeCharacterAdminBtn")?.addEventListener("click", closeCharacterAdminPanel);

  select?.addEventListener("change", () => {
    fillFormByTimelineId(select.value);
  });

  document.getElementById("adminAddTimelineBtn")?.addEventListener("click", async () => {
    const name = prompt("新时间线叫什么？", `时间线 ${timelines.length + 1}`);
    if (name === null) return;

    writeStatus("正在新建时间线……");

    try {
      const res = await fetch(`${API_BASE_URL}/api/drama/characters/${studentId}/timelines`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getAuthHeaders()
        },
        body: JSON.stringify({
          name: name.trim() || `时间线 ${timelines.length + 1}`,
          forumId: character.trueName || "",
          gender: "未设定",
          signature: "",
          avatar: contact.avatar || "",
          identityType: "student",
          identityGroups: ["已认证"]
        })
      });

      const data = await res.json();

      if (!data.success) {
        writeStatus(data.message || "新建失败。");
        return;
      }

      // 刷新面板
      contact.timelines = data.character?.timelines || [];
      await enrichFriendsWithDramaData();
      openCharacterAdminPanel(contact);
    } catch (error) {
      console.error(error);
      writeStatus("新建失败。");
    }
  });

  document.getElementById("adminSaveTimelineBtn")?.addEventListener("click", async () => {
    const timelineId = select?.value;
    if (!timelineId) {
      writeStatus("没有可保存的时间线。");
      return;
    }

    writeStatus("正在保存……");

    try {
      const res = await fetch(
        `${API_BASE_URL}/api/drama/characters/${studentId}/timelines/${encodeURIComponent(timelineId)}`,
        {
          method: "PUT",
          headers: {
            "Content-Type": "application/json",
            ...getAuthHeaders()
          },
          body: JSON.stringify({
            name: nameInput.value.trim(),
            forumId: forumIdInput.value.trim(),
            gender: genderInput.value.trim(),
            signature: signatureInput.value.trim(),
            avatar: avatarInput.value.trim(),
            identityType: identityTypeInput.value,
            bloodRank: bloodRankInput.value.trim(),
            desc: descInput.value,
            identityGroups: timelines.find((t) => t.id === timelineId)?.identityGroups || ["已认证"]
          })
        }
      );

      const data = await res.json();

      if (!data.success) {
        writeStatus(data.message || "保存失败。");
        return;
      }

      contact.timelines = data.character?.timelines || [];
      await enrichFriendsWithDramaData();
      writeStatus("已保存。");
      openCharacterAdminPanel(contact);
    } catch (error) {
      console.error(error);
      writeStatus("保存失败。");
    }
  });
}

function readAiAccountSettingsForm() {
  return {
    apiBaseUrl: document.getElementById("aiAccountApiBaseInput")?.value.trim() || "",
    apiKey: document.getElementById("aiAccountApiKeyInput")?.value.trim() || "",
    model: document.getElementById("aiAccountModelInput")?.value.trim() || "",
    prompt: document.getElementById("aiAccountPromptInput")?.value || ""
  };
}

function renderAiModelOptions(settings) {
  const models = Array.isArray(settings.availableModels) ? settings.availableModels : [];

  if (!models.length) {
    return `<option value="">暂无模型，请先拉取</option>`;
  }

  return [
    `<option value="">选择已拉取模型</option>`,
    ...models.map((model) => {
      return `<option value="${escapeHtml(model)}" ${model === settings.model ? "selected" : ""}>${escapeHtml(model)}</option>`;
    })
  ].join("");
}

function writeAiAccountStatus(lines) {
  const statusBox = document.getElementById("aiAccountStatusBox");
  if (!statusBox) return;

  statusBox.textContent = lines.join("\n");
}

function buildModelsUrl(apiBaseUrl) {
  let url = apiBaseUrl.trim().replace(/\/+$/, "");

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

function handleContactAction(action, contact) {
  const displayName = getDisplayName(contact);

  if (action === "block") {
    alert(`已屏蔽与 ${displayName} 的聊天。`);
  }

  if (action === "delete") {
  if (contact.accountKind === "norma_bot") {
    alert("诺玛是系统联络人，不能删除。");
    return;
  }

  const ok = confirm(
    `确定要删除好友「${displayName}」吗？\n\n删除后，对方将不再显示在好友列表中。`
  );

  if (!ok) {
    return;
  }

  markFriendDeleted(contact);
markContactChatsDeleted(contact);

alert(`已删除好友：${displayName}`);

closeContactProfile();
renderFriends();
renderSidebarMessages();

}

  if (action === "remark") {
    const next = prompt("请输入备注：", contact.remark || "");
    if (next === null) return;
    contact.remark = next.trim();
    alert("备注已临时保存。后面接后端后会永久保存。");
    renderSidebarMessages();
    renderFriends();
  }

    if (action === "edit") {
    if (contact.accountKind === "norma_bot") {
      openAiAccountSettings(contact, "norma");
      return;
    }

    if (contact.accountKind === "character_account") {
      openCharacterAdminPanel(contact);
      return;
    }

    alert(`管理功能：修改 ${displayName} 的主页。`);
    return;
  }

  const menu = document.getElementById("contactProfileMenu");
  if (menu) menu.hidden = true;
}

function normalizeContact(contact) {
  return {
    name: contact.name || contact.friendName || "",
    characterId: contact.characterId || contact.character_id || "",
    studentId:
      contact.studentId ||
      contact.student_id ||
      contact.code ||
      contact.friendCode ||
      "",
    forumId: contact.forumId || contact.friendName || contact.name || "",
    remark: contact.remark || contact.friendRemark || "",
    code: contact.code || contact.friendCode || contact.studentId || "",
    codeKind: contact.codeKind || contact.identityType || "",
    bloodRank: contact.bloodRank || "",
    avatar: contact.avatar || contact.friendAvatar || "",
    status: contact.status || contact.friendStatus || "offline",
    accountKind: contact.accountKind || "",
    aiMode: contact.aiMode || "",
    characterSource: contact.characterSource || "",
    defaultTimelineId: contact.defaultTimelineId || "",
    timelines: Array.isArray(contact.timelines) ? contact.timelines : [],
    desc: contact.desc || "",
    signature: contact.signature || "",
    identityGroups: Array.isArray(contact.identityGroups)
      ? contact.identityGroups
      : [],
    ownedIdentityGroups: Array.isArray(contact.ownedIdentityGroups)
      ? contact.ownedIdentityGroups
      : [],
    previewTimelineId: contact.previewTimelineId || "",
    previewEnabled: contact.previewEnabled,
    previewUserPrompt: contact.previewUserPrompt,
    friendshipStatus: contact.friendshipStatus || ""
  };
}

function getDisplayName(item) {
  if (!item) return "未知用户";

  // 通过学号读取好友备注
  let alias = "";
  try {
    const studentId = String(
      item.friendCode || item.code || item.studentId || ""
    )
      .trim()
      .toUpperCase();

    if (studentId) {
      const s = loadChatPersonalSettings(
        `friend_alias_${studentId}_${getCurrentStudentId()}`
      );
      if (s.alias) alias = s.alias;
    }
  } catch (e) {}

  if (alias) return alias;

  return item.remark || item.friendRemark || item.name || item.friendName || "未知用户";
}

function isManager() {
  const groups = state.profile?.identityGroups || [];
  return groups.includes("管理组");
}

function getDefaultAvatar(seed) {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getNowChatTime() {
  return new Date().toLocaleTimeString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false
 });
}

function pushChatMessage(chat, side, text, extra = {}) {
  chat.messages.push({
    side,
    text,
    time: getNowChatTime(),
    ...extra
  });
}

async function handleNormaPanelCommand(text, chat, body) {
  const command = String(text || "").trim();

  // ====== 游客实名认证 ======
    if (command === "/实名认证" || command === "/认证") {
    pushChatMessage(chat, "me", text);

    pushChatMessage(
      chat,
      "other",
      "收到，请在下面的对话框里填写学号和访问码。",
      {
        panelHtml: getGuestVerifyPanelHtml()
      }
    );

    renderPrivateChatBody(chat, body);
    renderSidebarMessages();

    return true;
  }

  // ====== 游客不能用其他指令 ======
  if (isCurrentUserGuest()) {
    pushChatMessage(chat, "me", text);
    pushChatMessage(chat, "other", "你现在是游客身份，只能和我对话。发送 /实名认证 可以完成认证，解锁更多功能。");
    renderPrivateChatBody(chat, body);
    renderSidebarMessages();
    const listEl3 = body.querySelector(".chat-message-list");
    if (listEl3) listEl3.scrollTop = listEl3.scrollHeight;
    return true;
  }

  if (command === "/申请身份组" || command === "/身份组申请") {

    pushChatMessage(chat, "me", text);
    await loadNormaGroups();

    pushChatMessage(chat, "other", "已打开身份组申请面板。", {
      panelHtml: getNormaApplyPanelHtml()
    });

    renderPrivateChatBody(chat, body);
    renderSidebarMessages();
    return true;
  }

  if (command === "/创建身份组" || command === "/身份组创建") {
    pushChatMessage(chat, "me", text);

    try {
      const res = await fetch(`${API_BASE_URL}/api/norma/can-manage`, {
        headers: {
          "Authorization": `Bearer ${state.authToken || ""}`
        }
      });

      const data = await res.json();

      if (!data.canManage) {
        pushChatMessage(chat, "other", "权限不足。创建身份组需要拥有“管理组”身份组。");
        renderPrivateChatBody(chat, body);
        renderSidebarMessages();
        return true;
      }

      pushChatMessage(chat, "other", "权限验证通过。已打开身份组创建面板。", {
        panelHtml: getNormaCreatePanelHtml()
      });

      renderPrivateChatBody(chat, body);
      renderSidebarMessages();
      return true;
    } catch (error) {
      pushChatMessage(chat, "other", "无法验证管理权限，请确认后端已启动。");
      renderPrivateChatBody(chat, body);
      renderSidebarMessages();
      return true;
    }
  }

    if (command === "/修改身份组" || command === "/身份组修改") {
    pushChatMessage(chat, "me", text);

    try {
      const res = await fetch(`${API_BASE_URL}/api/norma/can-manage`, {
        headers: {
          "Authorization": `Bearer ${state.authToken || ""}`
        }
      });

      const data = await res.json();

      if (!data.canManage) {
        pushChatMessage(chat, "other", "权限不足。修改身份组需要拥有“管理组”身份组。");
        renderPrivateChatBody(chat, body);
        renderSidebarMessages();
        return true;
      }

      await loadNormaGroups();

      pushChatMessage(chat, "other", "权限验证通过。已打开身份组修改面板。", {
        panelHtml: getNormaEditPanelHtml()
      });

      renderPrivateChatBody(chat, body);
      renderSidebarMessages();
      return true;
    } catch (error) {
      pushChatMessage(chat, "other", "无法验证管理权限，请确认后端已启动。");
      renderPrivateChatBody(chat, body);
      renderSidebarMessages();
      return true;
    }
  }

  return false;
}

function closeNormaPanel() {
  const old = document.getElementById("normaPanelOverlay");
  old?.remove();
}

function createNormaPanel(title, subtitle, innerHtml) {
  closeNormaPanel();

  const overlay = document.createElement("div");
  overlay.id = "normaPanelOverlay";
  overlay.className = "norma-panel-overlay";
  overlay.innerHTML = `
    <div class="norma-panel-window">
      <div class="norma-panel-header">
        <div>
          <div class="panel-title">${escapeHtml(title)}</div>
          <div class="social-main-sub">${escapeHtml(subtitle)}</div>
        </div>
        <button id="closeNormaPanelBtn" class="win-btn" type="button">关闭</button>
      </div>

      <div class="norma-panel-body">
        ${innerHtml}
      </div>
    </div>
  `;

  document.body.appendChild(overlay);

  document.getElementById("closeNormaPanelBtn")?.addEventListener("click", closeNormaPanel);

  overlay.addEventListener("click", (event) => {
    if (event.target === overlay) {
      closeNormaPanel();
    }
  });

  return overlay;
}

function getNormaInputValue(id) {
  return document.getElementById(id)?.value.trim() || "";
}

function getNormaCheckedValue(id) {
  return document.getElementById(id)?.checked === true;
}

function splitLinesOrComma(text) {
  return String(text || "")
    .split(/[\n,，]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

async function openNormaApplyGroupPanel(chat, body) {
  await loadNormaGroups();

  const availableGroups = normaGroupsCache.filter((group) => {
    return group.allow_apply !== 0;
  });

  const groupOptions = availableGroups.length
    ? availableGroups.map((group) => {
        const board = group.board_name ? `（${group.board_name}）` : "";
        return `<option value="${escapeHtml(group.name)}">${escapeHtml(group.name + board)}</option>`;
      }).join("")
    : `<option value="">暂无可申请身份组</option>`;

  const overlay = createNormaPanel(
    "身份组申请",
    "提交后由诺玛记录。需要审核的身份组之后会接入上下文判断。",
    `
      <div class="norma-form-grid">
        <label class="field-label">申请人</label>
        <input class="retro-input" value="${escapeHtml(state.profile?.forumId || "当前用户")}" disabled />

        <label class="field-label">申请身份组</label>
        <select id="normaApplyGroupName" class="retro-input">
          ${groupOptions}
        </select>

        <label class="field-label">申请理由</label>
        <textarea
          id="normaApplyReason"
          class="retro-input norma-panel-textarea"
          placeholder="请认真写申请理由。比如：我已在剧情中加入狮心会，希望申请正式成员身份组。"
        ></textarea>

        <label class="field-label">补充证明</label>
        <textarea
          id="normaApplyEvidence"
          class="retro-input norma-panel-textarea"
          placeholder="可以写相关剧情、帖子、关键词、发生过的事件。第一版先保存，下一版会让诺玛读取上下文审核。"
        ></textarea>

        <div class="btn-row">
          <button id="submitNormaApplyBtn" class="retro-btn" type="button">提交申请</button>
          <button id="cancelNormaApplyBtn" class="retro-btn ghost" type="button">取消</button>
        </div>

        <pre id="normaApplyStatus" class="forum-ai-status">等待提交。</pre>
      </div>
    `
  );

  document.getElementById("cancelNormaApplyBtn")?.addEventListener("click", closeNormaPanel);

  document.getElementById("submitNormaApplyBtn")?.addEventListener("click", async () => {
    const status = document.getElementById("normaApplyStatus");
    const groupName = getNormaInputValue("normaApplyGroupName");
    const reason = getNormaInputValue("normaApplyReason");
    const evidence = getNormaInputValue("normaApplyEvidence");

    if (!groupName) {
      if (status) status.textContent = "请选择要申请的身份组。";
      return;
    }

    if (reason.length < 8) {
      if (status) status.textContent = "申请理由太短啦，请认真写一点。";
      return;
    }

    if (status) status.textContent = "正在提交给诺玛……";

    try {
      const res = await fetch(`${API_BASE_URL}/api/norma/group-applications`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${state.authToken || ""}`
        },
        body: JSON.stringify({
          groupName,
          reason,
          evidence
        })
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (status) status.textContent = data.message || "提交失败。";
        return;
      }

      if (status) status.textContent = data.message || "申请已提交。";

      pushChatMessage(chat, "other", data.message || "申请已提交。");
      renderPrivateChatBody(chat, body);
      renderSidebarMessages();

      if (data.status === "已通过") {
        await refreshCurrentAccountAfterNormaChange();
      }
    } catch (error) {
      if (status) status.textContent = "提交失败，请确认后端已启动。";
    }
  });
}

function updateCreateGroupPreview() {
  const preview = document.getElementById("normaGroupColorPreview");
  if (!preview) return;

  const name =
    getNormaInputValue("normaCreateBadgeText") ||
    getNormaInputValue("normaCreateName") ||
    "身份组预览";

  const colors = getNormaInputValue("normaCreateColors");
  const icon = getNormaInputValue("normaCreateIcon");

  renderNormaTagPreview(preview, name, colors, icon);
}

function openNormaCreateGroupPanel(chat, body) {
  const overlay = createNormaPanel(
    "创建身份组",
    "管理组专用。美化选项会在玩家获得该主身份组后出现在个人主页。",
    `
      <div class="norma-form-grid">
        <label class="field-label">所属板块</label>
        <input id="normaCreateBoardName" class="retro-input" placeholder="例如：狮心会" />

        <label class="field-label">身份组大类</label>
        <select id="normaCreateScope" class="retro-input">
          <option value="真实身份组">真实身份组</option>
          <option value="剧情身份组" selected>剧情身份组</option>
        </select>

        <label class="field-label">身份组用途</label>
        <select id="normaCreateRole" class="retro-input">
          <option value="版主身份组">版主身份组</option>
          <option value="正式成员身份组" selected>正式成员身份组</option>
          <option value="娱乐身份组">娱乐身份组</option>
        </select>

        <label class="field-label">主身份组名称</label>
        <input id="normaCreateName" class="retro-input" placeholder="例如：狮心会正式成员" />

        <label class="field-label">颜色</label>
        <textarea
          id="normaCreateColors"
          class="retro-input norma-panel-small-textarea"
          placeholder="#1d4ed8&#10;#facc15&#10;填两个或更多颜色会自动变渐变色"
        ></textarea>

        <div id="normaGroupColorPreview" class="norma-color-preview">颜色预览</div>

        <label class="field-label">图标</label>
        <input id="normaCreateIcon" class="retro-input" placeholder="例如：🦁 或图片链接" />

        <label class="field-label">身份组说明</label>
        <textarea
          id="normaCreateDescription"
          class="retro-input norma-panel-textarea"
          placeholder="例如：加入狮心会后可申请。"
        ></textarea>

        <label class="field-label">默认显示文字</label>
        <input id="normaCreateBadgeText" class="retro-input" placeholder="例如：狮心" />

        <label class="field-label">美化显示文字</label>
        <textarea
          id="normaCreateBeautifyTexts"
          class="retro-input norma-panel-small-textarea"
          placeholder="每行一个。例如：&#10;狮心&#10;🦁&#10;Lionheart&#10;狮心会成员"
        ></textarea>

        <label class="norma-check-line">
          <input id="normaCreateAllowApply" type="checkbox" checked />
          允许普通玩家申请
        </label>

        <label class="norma-check-line">
          <input id="normaCreateNeedReview" type="checkbox" />
          需要诺玛审核
        </label>

        <label class="field-label">审核要求</label>
        <textarea
          id="normaCreateReviewRule"
          class="retro-input norma-panel-textarea"
          placeholder="例如：需要上下文证明玩家已经加入狮心会。"
        ></textarea>

        <label class="field-label">申请理由要求</label>
        <textarea
          id="normaCreateReasonRule"
          class="retro-input norma-panel-textarea"
          placeholder="例如：理由不能太敷衍，不能恶搞，需要像正式申请。"
        ></textarea>

        <div class="btn-row">
          <button id="submitNormaCreateBtn" class="retro-btn" type="button">创建身份组</button>
          <button id="cancelNormaCreateBtn" class="retro-btn ghost" type="button">取消</button>
        </div>

        <pre id="normaCreateStatus" class="forum-ai-status">等待创建。</pre>
      </div>
    `
  );

  document.getElementById("cancelNormaCreateBtn")?.addEventListener("click", closeNormaPanel);
  document.getElementById("normaCreateName")?.addEventListener("input", updateCreateGroupPreview);
  document.getElementById("normaCreateBadgeText")?.addEventListener("input", updateCreateGroupPreview);
  document.getElementById("normaCreateIcon")?.addEventListener("input", updateCreateGroupPreview);

  document.getElementById("normaCreateColors")?.addEventListener("input", updateCreateGroupPreview);
  updateCreateGroupPreview();

  document.getElementById("submitNormaCreateBtn")?.addEventListener("click", async () => {
    const status = document.getElementById("normaCreateStatus");

    const payload = {
      boardName: getPanelValue(panel, "createScope") === "通用身份组" ? "" : getPanelValue(panel, "createBoardName"),
      groupScope: getPanelValue(panel, "createScope"),
      universalCategory: getPanelValue(panel, "createScope") === "通用身份组" ? getPanelValue(panel, "createUniversalCategory") : "",
      groupRole: getPanelValue(panel, "createScope") === "通用身份组" ? "" : getPanelValue(panel, "createRole"),
      name: getNormaInputValue("normaCreateName"),
      colors: splitLinesOrComma(getNormaInputValue("normaCreateColors")),
      icon: getNormaInputValue("normaCreateIcon"),
      description: getNormaInputValue("normaCreateDescription"),
      badgeText: getNormaInputValue("normaCreateBadgeText"),
      beautifyTexts: splitLinesOrComma(getNormaInputValue("normaCreateBeautifyTexts")),
      allowApply: getNormaCheckedValue("normaCreateAllowApply"),
      needReview: getNormaCheckedValue("normaCreateNeedReview"),
      reviewRule: getNormaInputValue("normaCreateReviewRule"),
      reasonRule: getNormaInputValue("normaCreateReasonRule")
    };

          if (isUniversal && !payload.universalCategory) {
        if (status) status.textContent = "请填写通用分类，例如：血统等级。";
        return;
      }

      if (!payload.name) {
        if (status) {
          status.textContent = isUniversal
            ? "请填写该分类下的身份组名称，例如：S级。"
            : "主身份组名称不能为空。";
        }
        return;
      }

    if (status) status.textContent = "正在创建身份组……";

    try {
      const res = await fetch(`${API_BASE_URL}/api/norma/groups/create-panel`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${state.authToken || ""}`
        },
        body: JSON.stringify(payload)
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        if (status) status.textContent = data.message || "创建失败。";
        return;
      }

      if (status) status.textContent = data.message || "身份组已创建。";

      await loadNormaGroups();

      pushChatMessage(chat, "other", data.message || "身份组已创建。");
      renderPrivateChatBody(chat, body);
      renderSidebarMessages();
    } catch (error) {
      if (status) status.textContent = "创建失败，请确认后端已启动。";
    }
  });
}

async function refreshCurrentAccountAfterNormaChange() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/me`, {
      headers: {
        "Authorization": `Bearer ${state.authToken || ""}`
      }
    });

    const data = await res.json();

    if (res.ok && data.success && data.user) {
      state.currentAccount = data.user;
      state.account = data.user;
      state.avatar = data.user.avatar;
      state.userStatus = data.user.userStatus;
      state.profile = data.user.profile;

      localStorage.setItem("cassell_current_account", JSON.stringify(data.user));
      localStorage.setItem("cassell_avatar", state.avatar);
      localStorage.setItem("cassell_user_status", state.userStatus);
      localStorage.setItem("cassell_profile", JSON.stringify(state.profile));

      window.dispatchEvent(new CustomEvent("auth:changed"));
    }
  } catch (error) {
    console.warn("刷新当前账号资料失败：", error);
  }
}

function getNormaApplyPanelHtml() {
  const availableGroups = normaGroupsCache.filter((group) => {
    return group.allow_apply !== 0;
  });

  const groupOptions = availableGroups.length
    ? availableGroups.map((group) => {
        const board = group.board_name ? `（${group.board_name}）` : "";
        return `<option value="${escapeHtml(group.name)}">${escapeHtml(group.name + board)}</option>`;
      }).join("")
    : `<option value="">暂无可申请身份组</option>`;

  return `
    <div class="norma-inline-panel" data-norma-panel="apply">
      <div class="norma-inline-title">身份组申请</div>
      <div class="norma-inline-sub">申请的是主身份组。美化选项会在通过后自动出现在个人主页。</div>

      <label class="field-label">申请人</label>
      <input class="retro-input" value="${escapeHtml(state.profile?.forumId || "当前用户")}" disabled />

      <label class="field-label">申请身份组</label>
      <select data-norma-field="applyGroupName" class="retro-input">
        ${groupOptions}
      </select>

      <label class="field-label">申请理由</label>
      <textarea
        data-norma-field="applyReason"
        class="retro-input norma-panel-textarea"
        placeholder="请认真写申请理由。比如：我已在剧情中加入狮心会，希望申请正式成员身份组。"
      ></textarea>

      <label class="field-label">补充证明</label>
      <textarea
        data-norma-field="applyEvidence"
        class="retro-input norma-panel-textarea"
        placeholder="可以写相关剧情、帖子、关键词、发生过的事件。"
      ></textarea>

      <div class="btn-row">
        <button data-norma-action="submit-apply" class="retro-btn" type="button">提交申请</button>
      </div>

      <pre data-norma-status="apply" class="forum-ai-status">等待提交。</pre>
    </div>
  `;
}

function getNormaEditPanelHtml() {
  const groupOptions = normaGroupsCache.length
    ? normaGroupsCache.map((group) => {
        const scope = group.group_scope || "未分类";
        const category = group.group_scope === "通用身份组"
          ? (group.universal_category || "未填通用分类")
          : (group.board_name || "未填板块");

        return `
          <option value="${group.id}">
            ${escapeHtml(scope)} / ${escapeHtml(category)} / ${escapeHtml(group.name)}
          </option>
        `;
      }).join("")
    : `<option value="">暂无身份组</option>`;

  return `
    <div class="norma-inline-panel" data-norma-panel="edit">
      <div class="norma-inline-title">修改身份组</div>
      <div class="norma-inline-sub">选择一个已经创建好的身份组，单独修改颜色、美化和申请要求。</div>

      <label class="field-label">选择身份组</label>
      <select data-norma-field="editGroupId" class="retro-input">
        ${groupOptions}
      </select>

      <div class="norma-edit-summary" data-norma-edit-summary>
        请选择身份组。
      </div>

      <label class="field-label" data-norma-edit-category-label>分类或所属板块</label>
<input
  data-norma-field="editCategoryName"
  class="retro-input"
  placeholder="通用身份组填：血统等级；剧情/真实身份组填：狮心会、内测区"
/>

      <label class="field-label" data-norma-edit-role-label>身份组用途</label>
      <select data-norma-field="editGroupRole" class="retro-input">
        <option value="">无</option>
        <option value="版主身份组">版主身份组</option>
        <option value="正式成员身份组">正式成员身份组</option>
        <option value="娱乐身份组">娱乐身份组</option>
      </select>

      <label class="field-label">颜色</label>
      <textarea
        data-norma-field="editColors"
        class="retro-input norma-panel-small-textarea"
        placeholder="#fbf8cc&#10;#facc15&#10;多个颜色会自动变渐变色"
      ></textarea>

      <div data-norma-preview="editColor" class="norma-color-preview">颜色预览</div>

      <label class="field-label">身份组说明</label>
      <textarea
        data-norma-field="editDescription"
        class="retro-input norma-panel-textarea"
        placeholder="例如：血统等级评定为 S 级的学员。"
      ></textarea>

      <label class="field-label">身份组名称</label>
      <input
        data-norma-field="editGroupName"
        class="retro-input"
        placeholder="例如：S级 / 狮心会 / 内测用户"
      />

      <label class="field-label">美化显示文字</label>
      <textarea
        data-norma-field="editBeautifyTexts"
        class="retro-input norma-panel-small-textarea"
        placeholder="每行一个。例如：&#10;S级&#10;S&#10;🩸S级&#10;S-RANK"
      ></textarea>

      <label class="norma-check-line">
        <input data-norma-field="editAllowApply" type="checkbox" />
        <span>允许普通玩家申请</span>
      </label>

      <label class="norma-check-line">
        <input data-norma-field="editNeedReview" type="checkbox" />
        <span>需要诺玛审核</span>
      </label>

      <label class="field-label">审核要求</label>
      <textarea
        data-norma-field="editReviewRule"
        class="retro-input norma-panel-textarea"
        placeholder="例如：需要上下文证明玩家已经获得该血统等级评定。"
      ></textarea>

      <label class="field-label">申请理由要求</label>
      <textarea
        data-norma-field="editReasonRule"
        class="retro-input norma-panel-textarea"
        placeholder="例如：理由不能太敷衍，需要说明评定来源。"
      ></textarea>

      <div class="btn-row">
        <button data-norma-action="save-edit" class="retro-btn" type="button">保存修改</button>
        <button data-norma-action="delete-edit" class="retro-btn warn" type="button">删除身份组</button>
      </div>

      <pre data-norma-status="edit" class="forum-ai-status">等待选择。</pre>
    </div>
  `;
}

function getNormaCreatePanelHtml() {
  return `
    <div class="norma-inline-panel" data-norma-panel="create">
      <div class="norma-inline-title">创建身份组</div>
      <div class="norma-inline-sub">
        创建基础身份组。通用身份组可以批量添加，例如血统等级下的 S级 / A级 / B级。
        详细颜色、美化、审核要求请之后发送 /修改身份组 单独设置。
      </div>

      <label class="field-label">身份组大类</label>
      <select data-norma-field="createScope" class="retro-input">
        <option value="真实身份组">真实身份组</option>
        <option value="剧情身份组" selected>剧情身份组</option>
        <option value="通用身份组">通用身份组</option>
      </select>

      <div data-norma-row="universalCategory" style="display:none;">
        <label class="field-label">通用分类</label>
        <input
          data-norma-field="createUniversalCategory"
          class="retro-input"
          placeholder="例如：血统等级 / 认证身份组 / 内测资格"
        />

        <div class="norma-inline-sub">
          这里填的是分类，比如“血统等级”。下面每一行才是该分类下的具体身份组，比如“S级”“A级”。
        </div>

        <div data-norma-universal-list class="norma-universal-list"></div>

        <div class="btn-row">
          <button data-norma-action="add-universal-row" class="retro-btn small" type="button">＋ 添加身份组</button>
        </div>

        <pre data-norma-status="universal-create" class="forum-ai-status">填写通用分类后，点击“＋ 添加身份组”。</pre>
      </div>

      <div data-norma-row="boardName">
        <label class="field-label">所属板块</label>
        <input
          data-norma-field="createBoardName"
          class="retro-input"
          placeholder="例如：狮心会 / 学生会 / 内测区"
        />
      </div>

      <div data-norma-row="groupRole">
        <label class="field-label">身份组用途</label>
        <select data-norma-field="createRole" class="retro-input">
          <option value="版主身份组">版主身份组</option>
          <option value="正式成员身份组" selected>正式成员身份组</option>
          <option value="娱乐身份组">娱乐身份组</option>
        </select>
      </div>

      <div data-norma-row="normalGroupName">
        <label class="field-label">主身份组名称</label>
        <input
          data-norma-field="createNameNormal"
          class="retro-input"
          placeholder="例如：狮心会正式成员 / 狮心会版主"
        />
      </div>

      <div data-norma-row="normalDetails">
        <label class="field-label">颜色</label>
        <textarea
          data-norma-field="createColors"
          class="retro-input norma-panel-small-textarea"
          placeholder="#1d4ed8&#10;#facc15&#10;填两个或更多颜色会自动变渐变色"
        ></textarea>

        <div data-norma-preview="color" class="norma-color-preview">颜色预览</div>

        <label class="field-label">身份组说明</label>
        <textarea
          data-norma-field="createDescription"
          class="retro-input norma-panel-textarea"
          placeholder="例如：加入狮心会后可申请。"
        ></textarea>

        <label class="field-label">默认显示文字</label>
        <input data-norma-field="createBadgeText" class="retro-input" placeholder="例如：狮心 / 内测" />

        <label class="field-label">美化显示文字</label>
        <textarea
          data-norma-field="createBeautifyTexts"
          class="retro-input norma-panel-small-textarea"
          placeholder="每行一个。例如：&#10;狮心&#10;🦁&#10;Lionheart&#10;狮心会成员"
        ></textarea>

        <label class="norma-check-line">
          <input data-norma-field="createAllowApply" type="checkbox" checked />
          <span>允许普通玩家申请</span>
        </label>

        <label class="norma-check-line">
          <input data-norma-field="createNeedReview" type="checkbox" />
          <span>需要诺玛审核</span>
        </label>

        <label class="field-label">审核要求</label>
        <textarea
          data-norma-field="createReviewRule"
          class="retro-input norma-panel-textarea"
          placeholder="例如：需要上下文证明玩家已经加入狮心会。"
        ></textarea>

        <label class="field-label">申请理由要求</label>
        <textarea
          data-norma-field="createReasonRule"
          class="retro-input norma-panel-textarea"
          placeholder="例如：理由不能太敷衍，不能恶搞，需要像正式申请。"
        ></textarea>

        <div class="btn-row">
          <button data-norma-action="submit-create" class="retro-btn" type="button">创建身份组</button>
        </div>

        <pre data-norma-status="create" class="forum-ai-status">等待创建。</pre>
      </div>
    </div>
  `;
}

function getPanelField(panel, name) {
  return panel.querySelector(`[data-norma-field="${name}"]`);
}

function getPanelValue(panel, name) {
  return getPanelField(panel, name)?.value.trim() || "";
}

function getPanelChecked(panel, name) {
  return getPanelField(panel, name)?.checked === true;
}

function setPanelValue(panel, name, value) {
  const el = getPanelField(panel, name);
  if (el) el.value = value ?? "";
}

function setPanelChecked(panel, name, value) {
  const el = getPanelField(panel, name);
  if (el) el.checked = value === true || value === 1;
}

function bindNormaInlinePanels(chat, body) {
  const panels = body.querySelectorAll(".norma-inline-panel");

  panels.forEach((panel) => {
    const verifyBtn = panel.querySelector(
      '[data-guest-verify-action="submit"]'
    );

    if (!verifyBtn || panel.dataset.guestVerifyBound === "1") {
      return;
    }

    panel.dataset.guestVerifyBound = "1";

    verifyBtn.addEventListener("click", () => {
      submitGuestVerify(panel);
    });

    panel.querySelectorAll("input").forEach((input) => {
      input.addEventListener("keydown", (event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          submitGuestVerify(panel);
        }
      });
    });
  });

  panels.forEach((panel) => {
    if (panel.dataset.bound === "1") return;
    panel.dataset.bound = "1";

    const colorInput = getPanelField(panel, "createColors");
    const preview = panel.querySelector(`[data-norma-preview="color"]`);

        const scopeInput = getPanelField(panel, "createScope");
    const boardRow = panel.querySelector(`[data-norma-row="boardName"]`);
    const roleRow = panel.querySelector(`[data-norma-row="groupRole"]`);
    const universalCategoryRow = panel.querySelector(`[data-norma-row="universalCategory"]`);
    const normalGroupNameRow = panel.querySelector(`[data-norma-row="normalGroupName"]`);
    const normalDetailsRow = panel.querySelector(`[data-norma-row="normalDetails"]`);

    const updateCreateScopeRows = () => {
      if (!scopeInput) return;

      const isUniversal = scopeInput.value === "通用身份组";

      if (boardRow) {
        boardRow.style.display = isUniversal ? "none" : "block";
      }

      if (roleRow) {
        roleRow.style.display = isUniversal ? "none" : "block";
      }

      if (normalGroupNameRow) {
        normalGroupNameRow.style.display = isUniversal ? "none" : "block";
      }

      if (normalDetailsRow) {
        normalDetailsRow.style.display = isUniversal ? "none" : "block";
      }

      if (universalCategoryRow) {
        universalCategoryRow.style.display = isUniversal ? "block" : "none";
      }
    };

    scopeInput?.addEventListener("change", updateCreateScopeRows);
    updateCreateScopeRows();

        const universalList = panel.querySelector("[data-norma-universal-list]");
    const addUniversalRowBtn = panel.querySelector(`[data-norma-action="add-universal-row"]`);

    const createUniversalRow = () => {
      if (!universalList) return;

      const row = document.createElement("div");
      row.className = "norma-universal-row";

      row.innerHTML = `
        <input
          class="retro-input"
          data-universal-name
          placeholder="例如：S级 / A级 / 已认证 / 内测玩家"
        />
        <button class="retro-btn small" type="button" data-universal-save>保存</button>
      `;

      const input = row.querySelector("[data-universal-name]");
      const saveBtn = row.querySelector("[data-universal-save]");

      saveBtn?.addEventListener("click", async () => {
        const status = panel.querySelector(`[data-norma-status="universal-create"]`);
        const category = getPanelValue(panel, "createUniversalCategory");
        const name = input?.value.trim() || "";

        if (!category) {
          if (status) status.textContent = "请先填写通用分类，例如：血统等级。";
          return;
        }

        if (!name) {
          if (status) status.textContent = "请填写这一行的身份组名称，例如：S级。";
          return;
        }

        if (status) status.textContent = `正在创建“${category} / ${name}”……`;
        if (saveBtn) saveBtn.disabled = true;

        const payload = {
          boardName: "",
          groupScope: "通用身份组",
          universalCategory: category,
          groupRole: "",
          name,
          colors: [],
          icon: "",
          description: `${category}分类下的身份组：${name}`,
          badgeText: name,
          beautifyTexts: [name],
          allowApply: true,
          needReview: false,
          reviewRule: "",
          reasonRule: ""
        };

        try {
          const res = await fetch(`${API_BASE_URL}/api/norma/groups/create-panel`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              "Authorization": `Bearer ${state.authToken || ""}`
            },
            body: JSON.stringify(payload)
          });

          const data = await res.json().catch(() => null);

          if (!res.ok || !data?.success) {
            if (status) status.textContent = data?.message || "创建失败，请检查后端。";
            if (saveBtn) saveBtn.disabled = false;
            return;
          }

          if (status) {
            status.textContent = `“${category} / ${name}”已创建。需要详细设置时，请发送 /修改身份组。`;
          }

          input.disabled = true;
          saveBtn.textContent = "已保存";
          saveBtn.disabled = true;

          await loadNormaGroups();

          pushChatMessage(chat, "other", `已创建通用身份组：“${category} / ${name}”。如需设置颜色、美化和审核要求，请发送 /修改身份组。`);
          renderSidebarMessages();
        } catch (error) {
          if (status) status.textContent = "创建失败，请确认后端已启动。";
          if (saveBtn) saveBtn.disabled = false;
        }
      });

      universalList.appendChild(row);
      input?.focus();
    };

    addUniversalRowBtn?.addEventListener("click", createUniversalRow);

        const updateInlineCreatePreview = () => {
      if (!preview) return;

      const name =
        getPanelValue(panel, "createBadgeText") ||
        getPanelValue(panel, "createName") ||
        "身份组预览";

      const colors = getPanelValue(panel, "createColors");
      const icon = getPanelValue(panel, "createIcon");

      renderNormaTagPreview(preview, name, colors, icon);
    };

    colorInput?.addEventListener("input", updateInlineCreatePreview);
    getPanelField(panel, "createName")?.addEventListener("input", updateInlineCreatePreview);
    getPanelField(panel, "createBadgeText")?.addEventListener("input", updateInlineCreatePreview);
    getPanelField(panel, "createIcon")?.addEventListener("input", updateInlineCreatePreview);

    updateInlineCreatePreview();

    const editGroupSelect = getPanelField(panel, "editGroupId");
    const editPreview = panel.querySelector(`[data-norma-preview="editColor"]`);

    const updateEditColorPreview = () => {
  if (!editPreview) return;

  const name =
    getPanelValue(panel, "editBadgeText") ||
    getSelectedEditGroupName(panel) ||
    "身份组预览";

  const colors = getPanelValue(panel, "editColors");
  const icon = "";

  renderNormaTagPreview(editPreview, name, colors, icon);
};

    const loadEditGroupDetail = async () => {
      if (!editGroupSelect || !editGroupSelect.value) return;

      const status = panel.querySelector(`[data-norma-status="edit"]`);
      const summary = panel.querySelector(`[data-norma-edit-summary]`);

      if (status) status.textContent = "正在读取身份组资料……";

      try {
        const res = await fetch(`${API_BASE_URL}/api/norma/groups/${editGroupSelect.value}/detail`, {
          headers: {
            "Authorization": `Bearer ${state.authToken || ""}`
          }
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          if (status) status.textContent = data.message || "读取失败。";
          return;
        }

        const group = data.group;

        if (summary) {
          const category = group.group_scope === "通用身份组"
            ? (group.universal_category || "未填通用分类")
            : (group.board_name || "未填板块");

          summary.textContent = `当前修改：${group.group_scope || "未分类"} / ${category} / ${group.name}`;
        }

                const isUniversalGroup = group.group_scope === "通用身份组";
        const categoryValue = isUniversalGroup
          ? (group.universal_category || "")
          : (group.board_name || "");

        setPanelValue(panel, "editCategoryName", categoryValue);
        setPanelValue(panel, "editGroupRole", group.group_role || "");

        const categoryLabel = panel.querySelector("[data-norma-edit-category-label]");
        const roleLabel = panel.querySelector("[data-norma-edit-role-label]");
        const roleInput = getPanelField(panel, "editGroupRole");

        if (categoryLabel) {
          categoryLabel.textContent = isUniversalGroup ? "通用分类" : "所属板块";
        }

        if (roleLabel && roleInput) {
          roleLabel.style.display = isUniversalGroup ? "none" : "block";
          roleInput.style.display = isUniversalGroup ? "none" : "block";
        }

        setPanelValue(panel, "editColors", Array.isArray(group.colors) ? group.colors.join("\n") : "");
        setPanelValue(panel, "editDescription", group.description || "");
        setPanelValue(panel, "editBadgeText", group.badge_text || group.name || "");
        setPanelValue(panel, "editBeautifyTexts", Array.isArray(group.beautifyTexts) ? group.beautifyTexts.join("\n") : "");
        setPanelChecked(panel, "editAllowApply", group.allow_apply);
        setPanelChecked(panel, "editNeedReview", group.need_review);
        setPanelValue(panel, "editReviewRule", group.review_rule || "");
        setPanelValue(panel, "editReasonRule", group.reason_rule || "");

        updateEditColorPreview();

        if (status) status.textContent = "资料已载入，可以修改。";
      } catch (error) {
        if (status) status.textContent = "读取失败，请确认后端已启动。";
      }
    };

    editGroupSelect?.addEventListener("change", loadEditGroupDetail);
    getPanelField(panel, "editColors")?.addEventListener("input", updateEditColorPreview);
    getPanelField(panel, "editBadgeText")?.addEventListener("input", updateEditColorPreview);
    getPanelField(panel, "editGroupId")?.addEventListener("change", updateEditColorPreview);
    updateEditColorPreview();

    if (editGroupSelect) {
      loadEditGroupDetail();
    }

    const saveEditBtn = panel.querySelector(`[data-norma-action="save-edit"]`);
    saveEditBtn?.addEventListener("click", async () => {
      if (!editGroupSelect || !editGroupSelect.value) return;

      const status = panel.querySelector(`[data-norma-status="edit"]`);

            const selectedGroup = normaGroupsCache.find((group) => {
        return String(group.id) === String(editGroupSelect.value);
      });

      const isUniversalGroup = selectedGroup?.group_scope === "通用身份组";

      const payload = {
        boardName: isUniversalGroup ? "" : getPanelValue(panel, "editCategoryName"),
        universalCategory: isUniversalGroup ? getPanelValue(panel, "editCategoryName") : "",
        groupRole: isUniversalGroup ? "" : getPanelValue(panel, "editGroupRole"),
        colors: splitLinesOrComma(getPanelValue(panel, "editColors")),
        description: getPanelValue(panel, "editDescription"),
        badgeText: getPanelValue(panel, "editBadgeText"),
        beautifyTexts: splitLinesOrComma(getPanelValue(panel, "editBeautifyTexts")),
        allowApply: getPanelChecked(panel, "editAllowApply"),
        needReview: getPanelChecked(panel, "editNeedReview"),
        reviewRule: getPanelValue(panel, "editReviewRule"),
        reasonRule: getPanelValue(panel, "editReasonRule")
      };

      if (status) status.textContent = "正在保存修改……";
      saveEditBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE_URL}/api/norma/groups/${editGroupSelect.value}/update-panel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.authToken || ""}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          if (status) status.textContent = data?.message || "保存失败。";
          return;
        }

        if (status) status.textContent = data.message || "修改已保存。";

        await loadNormaGroups();

        pushChatMessage(chat, "other", data.message || "身份组修改已保存。");
        renderPrivateChatBody(chat, body);
        renderSidebarMessages();
      } catch (error) {
        if (status) status.textContent = "保存失败，请确认后端已启动。";
      } finally {
        saveEditBtn.disabled = false;
      }
    });

        const deleteEditBtn = panel.querySelector(`[data-norma-action="delete-edit"]`);
    deleteEditBtn?.addEventListener("click", async () => {
      if (!editGroupSelect || !editGroupSelect.value) return;

      const status = panel.querySelector(`[data-norma-status="edit"]`);

      const selectedGroup = normaGroupsCache.find((group) => {
        return String(group.id) === String(editGroupSelect.value);
      });

      const groupName = selectedGroup?.name || getSelectedEditGroupName(panel) || "这个身份组";

      const ok = confirm(
        `确定要删除身份组“${groupName}”吗？\n\n` +
        `删除后会同时：\n` +
        `1. 删除这个身份组\n` +
        `2. 删除它的美化标签\n` +
        `3. 从所有玩家身上移除它\n` +
        `4. 如果有人正在佩戴它，也会自动取消佩戴\n` +
        `5. 从板块权限里移除它\n\n` +
        `这个操作不能直接撤销。`
      );

      if (!ok) return;

      if (status) status.textContent = "正在删除身份组……";
      deleteEditBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE_URL}/api/norma/groups/${editGroupSelect.value}`, {
          method: "DELETE",
          headers: {
            "Authorization": `Bearer ${state.authToken || ""}`
          }
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          if (status) status.textContent = data?.message || "删除失败。";
          deleteEditBtn.disabled = false;
          return;
        }

        if (status) status.textContent = data.message || "身份组已删除。";

        await loadNormaGroups();

        pushChatMessage(chat, "other", data.message || `身份组“${groupName}”已删除。`);
        pushChatMessage(chat, "other", "如果还要继续管理身份组，请重新发送 /修改身份组 打开最新面板。");

        renderPrivateChatBody(chat, body);
        renderSidebarMessages();
      } catch (error) {
        if (status) status.textContent = "删除失败，请确认后端已启动。";
        deleteEditBtn.disabled = false;
      }
    });

    const applyBtn = panel.querySelector(`[data-norma-action="submit-apply"]`);
    applyBtn?.addEventListener("click", async () => {
      const status = panel.querySelector(`[data-norma-status="apply"]`);
      const groupName = getPanelValue(panel, "applyGroupName");
      const reason = getPanelValue(panel, "applyReason");
      const evidence = getPanelValue(panel, "applyEvidence");

      if (!groupName) {
        if (status) status.textContent = "请选择要申请的身份组。";
        return;
      }

      if (reason.length < 8) {
        if (status) status.textContent = "申请理由太短啦，请认真写一点。";
        return;
      }

      if (status) status.textContent = "正在提交给诺玛……";

      try {
        const res = await fetch(`${API_BASE_URL}/api/norma/group-applications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.authToken || ""}`
          },
          body: JSON.stringify({
            groupName,
            reason,
            evidence
          })
        });

        const data = await res.json();

        if (!res.ok || !data.success) {
          if (status) status.textContent = data.message || "提交失败。";
          return;
        }

        if (status) status.textContent = data.message || "申请已提交。";

        pushChatMessage(chat, "other", data.message || "申请已提交。");
        renderPrivateChatBody(chat, body);
        renderSidebarMessages();

        if (data.status === "已通过") {
          await refreshCurrentAccountAfterNormaChange();
        }
      } catch (error) {
        if (status) status.textContent = "提交失败，请确认后端已启动。";
      }
    });

    const createBtn = panel.querySelector(`[data-norma-action="submit-create"]`);

    createBtn?.addEventListener("click", async () => {
      const status = panel.querySelector(`[data-norma-status="create"]`);
      const isUniversal = getPanelValue(panel, "createScope") === "通用身份组";

      const payload = {
        boardName: isUniversal ? "" : getPanelValue(panel, "createBoardName"),
        groupScope: getPanelValue(panel, "createScope"),
        universalCategory: isUniversal ? getPanelValue(panel, "createUniversalCategory") : "",
        groupRole: isUniversal ? "" : getPanelValue(panel, "createRole"),
        name: isUniversal ? getPanelValue(panel, "createNameUniversal") : getPanelValue(panel, "createNameNormal"),
        colors: splitLinesOrComma(getPanelValue(panel, "createColors")),
        icon: "",
        description: getPanelValue(panel, "createDescription"),
        badgeText: getPanelValue(panel, "createBadgeText"),
        beautifyTexts: splitLinesOrComma(getPanelValue(panel, "createBeautifyTexts")),
        allowApply: getPanelChecked(panel, "createAllowApply"),
        needReview: getPanelChecked(panel, "createNeedReview"),
        reviewRule: getPanelValue(panel, "createReviewRule"),
        reasonRule: getPanelValue(panel, "createReasonRule")
      };

      if (isUniversal && !payload.universalCategory) {
        if (status) status.textContent = "请填写通用分类，例如：血统等级。";
        return;
      }

      if (!payload.name) {
        if (status) {
          status.textContent = isUniversal
            ? "请填写该分类下的身份组名称，例如：S级。"
            : "主身份组名称不能为空。";
        }
        return;
      }

      if (status) status.textContent = "正在创建身份组……";
      if (createBtn) createBtn.disabled = true;

      try {
        const res = await fetch(`${API_BASE_URL}/api/norma/groups/create-panel`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${state.authToken || ""}`
          },
          body: JSON.stringify(payload)
        });

        const data = await res.json().catch(() => null);

        if (!res.ok || !data?.success) {
          if (status) {
            status.textContent = data?.message || "创建失败，请检查后端有没有报错。";
          }
          return;
        }

        if (status) {
          status.textContent = data.message || "身份组已创建。";
        }

        await loadNormaGroups();

        pushChatMessage(chat, "other", data.message || `身份组“${payload.name}”已创建。`);
        renderPrivateChatBody(chat, body);
        renderSidebarMessages();
      } catch (error) {
        console.warn("创建身份组失败：", error);
        if (status) status.textContent = "创建失败，请确认后端已启动。";
      } finally {
        if (createBtn) createBtn.disabled = false;
      }
    });
  });
}

