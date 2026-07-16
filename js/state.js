export const STORAGE_KEYS = {
  theme: "cassell_theme",
  avatar: "cassell_avatar",
  userStatus: "cassell_user_status",
  apiConfig: "cassell_api_config",
  selectedThreadId: "cassell_selected_thread_id",
  profile: "cassell_profile",
  authSession: "cassell_auth_session",
  authToken: "cassell_auth_token",
  currentAccount: "cassell_current_account",
  wallpaper: "cassell_wallpaper",
  localAvatarOverrides: "cassell_local_avatar_overrides",
forumAiSettings: "cassell_forum_ai_settings",
characterAccountSettings: "cassell_character_account_settings",
normaBotSettings: "cassell_norma_bot_settings"

};

const defaultProfile = {
  forumId: "A.I. Observer",
  gender: "未设定",
  signature: "终端记录保持在线。",
  identityType: "student",
  immutableCode: "AIMMDDXX",
  identityGroups: ["已认证"]
};

function readJsonStorage(key, fallback) {
  try {
    const raw = localStorage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

export const state = {
  themeFamily: localStorage.getItem("cassell_theme_family") || "classic",
  themeMode: localStorage.getItem("cassell_theme_mode") || "night",
  customBase: localStorage.getItem("cassell_custom_base") || "classic",
  opacityClassic: Number(localStorage.getItem("cassell_opacity_classic")) || 1,
  opacitySakura: Number(localStorage.getItem("cassell_opacity_sakura")) || 1,

  avatar:
    localStorage.getItem(STORAGE_KEYS.avatar) ||
    "https://api.dicebear.com/7.x/lorelei/svg?seed=CassellForum",
  userStatus: localStorage.getItem(STORAGE_KEYS.userStatus) || "online",
  selectedRoute: "threads",
  selectedThreadId: Number(localStorage.getItem(STORAGE_KEYS.selectedThreadId)) || 1,
  apiConfig: readJsonStorage(STORAGE_KEYS.apiConfig, {
    baseUrl: "",
    apiKey: "",
    model: ""
  }),
  profile: {
    ...defaultProfile,
    ...readJsonStorage(STORAGE_KEYS.profile, {})
  },
  authSession: readJsonStorage(STORAGE_KEYS.authSession, {
    loggedIn: false,
    isGuest: false,
    studentId: ""
  }),
  authToken: localStorage.getItem(STORAGE_KEYS.authToken) || "",
  currentAccount: readJsonStorage(STORAGE_KEYS.currentAccount, null),
  account: readJsonStorage(STORAGE_KEYS.currentAccount, null),
  wallpaper: localStorage.getItem(STORAGE_KEYS.wallpaper) || "",
  localAvatarOverrides: readJsonStorage(STORAGE_KEYS.localAvatarOverrides, {}),
forumAiSettings: {},

characterAccountSettings: readJsonStorage(STORAGE_KEYS.characterAccountSettings, {}),
customCss: localStorage.getItem("cassell_custom_css") || "",
bubbleCss: localStorage.getItem("cassell_bubble_css") || "",

normaBotSettings: readJsonStorage(STORAGE_KEYS.normaBotSettings, {
  apiBaseUrl: "",
  apiKey: "",
  model: "",
  availableModels: [],
  prompt: ""
})

};

export function saveThemeFamily(family) {
  state.themeFamily = family;
  localStorage.setItem("cassell_theme_family", family);
}

export function saveThemeMode(mode) {
  state.themeMode = mode;
  localStorage.setItem("cassell_theme_mode", mode);
}

export function saveCustomBase(base) {
  state.customBase = base;
  localStorage.setItem("cassell_custom_base", base);
}

export function saveThemeOpacity(family, opacity) {
  const key = "cassell_opacity_" + family;
  state["opacity" + family.charAt(0).toUpperCase() + family.slice(1)] = opacity;
  localStorage.setItem(key, String(opacity));
}

export function getThemeOpacity(family) {
  const key = "opacity" + family.charAt(0).toUpperCase() + family.slice(1);
  return state[key] ?? 1;
}

// 兼容旧版
export function saveTheme(theme) {
  if (theme === "dark") {
    saveThemeFamily("classic");
    saveThemeMode("night");
  } else {
    saveThemeFamily("classic");
    saveThemeMode("day");
  }
}

export function saveAvatar(avatar) {
  state.avatar = avatar;
  localStorage.setItem(STORAGE_KEYS.avatar, avatar);
}

export function saveUserStatus(status) {
  state.userStatus = status;
  localStorage.setItem(STORAGE_KEYS.userStatus, status);
}

export function saveSelectedThreadId(id) {
  state.selectedThreadId = id;
  localStorage.setItem(STORAGE_KEYS.selectedThreadId, String(id));
}

export function saveApiConfig(config) {
  state.apiConfig = config;
  localStorage.setItem(STORAGE_KEYS.apiConfig, JSON.stringify(config));
}

export function saveProfile(profilePatch) {
  state.profile = {
    ...state.profile,
    ...profilePatch
  };
  localStorage.setItem(STORAGE_KEYS.profile, JSON.stringify(state.profile));
}

export function saveAuthSession(sessionPatch) {
  state.authSession = {
    ...state.authSession,
    ...sessionPatch
  };
  localStorage.setItem(STORAGE_KEYS.authSession, JSON.stringify(state.authSession));
}

export function saveAuthToken(token) {
  state.authToken = token;
  localStorage.setItem(STORAGE_KEYS.authToken, token);
}

export function clearAuthToken() {
  state.authToken = "";
  localStorage.removeItem(STORAGE_KEYS.authToken);
}

export function saveCurrentAccount(account) {
  state.currentAccount = account || null;
  state.account = account || null;
  localStorage.setItem(STORAGE_KEYS.currentAccount, JSON.stringify(account || null));
}

export function clearCurrentAccount() {
  state.currentAccount = null;
  state.account = null;
  localStorage.removeItem(STORAGE_KEYS.currentAccount);
}

export function saveWallpaper(wallpaper) {
  state.wallpaper = wallpaper;
  localStorage.setItem(STORAGE_KEYS.wallpaper, wallpaper);
}

export function saveLocalAvatarOverrides(overrides) {
  state.localAvatarOverrides = overrides;
  localStorage.setItem(
    STORAGE_KEYS.localAvatarOverrides,
    JSON.stringify(overrides)
  );
}

const DEFAULT_FORUM_AI_SETTINGS = {
  apiBaseUrl: "",
  apiKey: "",
  model: "",
  availableModels: [],
  forumPrompt: "",
  worldBooks: [],
  activeWorldBookId: "",
  enabledWorldEntryIds: [],
  enabledStoryBoardSlugs: [],
  syncThreadCount: 1,
  syncCommentCount: 3,
  keepThreadCount: 30
};

function getForumSettingsOwnerId() {
  const guestId = state.authSession?.isGuest
    ? state.authSession?.studentId
    : "";

  const accountId =
    guestId ||
    state.authSession?.studentId ||
    state.currentAccount?.studentId ||
    "未登录";

  return encodeURIComponent(String(accountId));
}

function getForumSettingsStorageKey() {
  return `${STORAGE_KEYS.forumAiSettings}_${getForumSettingsOwnerId()}`;
}

export function loadForumAiSettingsForCurrentAccount() {
  const key = getForumSettingsStorageKey();

  try {
    const raw = localStorage.getItem(key);
    const saved = raw ? JSON.parse(raw) : {};

    state.forumAiSettings = {
      ...DEFAULT_FORUM_AI_SETTINGS,
      ...(saved && typeof saved === "object" ? saved : {})
    };
  } catch {
    state.forumAiSettings = {
      ...DEFAULT_FORUM_AI_SETTINGS
    };
  }

  return state.forumAiSettings;
}

export function saveForumAiSettings(settingsPatch) {
  state.forumAiSettings = {
    ...DEFAULT_FORUM_AI_SETTINGS,
    ...state.forumAiSettings,
    ...settingsPatch
  };

  localStorage.setItem(
    getForumSettingsStorageKey(),
    JSON.stringify(state.forumAiSettings)
  );
}

loadForumAiSettingsForCurrentAccount();

export function saveCharacterAccountSettings(settings) {
  state.characterAccountSettings = settings || {};
  localStorage.setItem(
    STORAGE_KEYS.characterAccountSettings,
    JSON.stringify(state.characterAccountSettings)
  );
}

export function saveNormaBotSettings(settingsPatch) {
  state.normaBotSettings = {
    ...state.normaBotSettings,
    ...settingsPatch
  };

  localStorage.setItem(
    STORAGE_KEYS.normaBotSettings,
    JSON.stringify(state.normaBotSettings)
  );
}


// ====== 自定义 CSS ======
export function saveCustomCss(css) {
  state.customCss = css;
  localStorage.setItem("cassell_custom_css", css);
}

export function saveBubbleCss(css) {
  state.bubbleCss = css;
  localStorage.setItem("cassell_bubble_css", css);
}

// ====== API 预设管理 ======
export function loadApiPresets() {
  const accountId = getForumSettingsOwnerId();
  try {
    return JSON.parse(localStorage.getItem(`cassell_api_presets_${accountId}`) || "[]");
  } catch { return []; }
}

export function saveApiPresets(presets) {
  const accountId = getForumSettingsOwnerId();
  localStorage.setItem(`cassell_api_presets_${accountId}`, JSON.stringify(presets));
}

export function loadApiPresetAssignments() {
  const accountId = getForumSettingsOwnerId();
  try {
    return JSON.parse(localStorage.getItem(`cassell_api_preset_assign_${accountId}`) || "{}");
  } catch { return {}; }
}

export function saveApiPresetAssignments(assignments) {
  const accountId = getForumSettingsOwnerId();
  localStorage.setItem(`cassell_api_preset_assign_${accountId}`, JSON.stringify(assignments));
}

// ====== 记忆本 ======
export function getMemoryBookKey(chatId) {
  const accountId = getForumSettingsOwnerId();
  const safeChatId = String(chatId || "unknown").toUpperCase().replace(/[^A-Z0-9]/g, "_");
  return `cassell_memory_book_${accountId}_${safeChatId}`;
}

export function loadMemoryBook(chatId) {
  try {
    return JSON.parse(localStorage.getItem(getMemoryBookKey(chatId)) || "null");
  } catch { return null; }
}

export function saveMemoryBook(chatId, data) {
  localStorage.setItem(getMemoryBookKey(chatId), JSON.stringify(data));
}

export function deleteMemoryBook(chatId) {
  localStorage.removeItem(getMemoryBookKey(chatId));
}

// ====== 根据预设选择返回对应的 API 设置 ======
export function getApiForPurpose(purpose) {
  // purpose: "forum" | "private_chat" | "summary"
  const assignments = loadApiPresetAssignments();
  const presetName = assignments[purpose] || "";
  
  if (presetName) {
    const presets = loadApiPresets();
    const found = presets.find(p => p.name === presetName);
    if (found && found.apiBaseUrl && found.apiKey && found.model) {
      return found;
    }
  }
  
  // 没有分配预设，就用默认的论坛 API 设置
  return {
    apiBaseUrl: state.forumAiSettings?.apiBaseUrl || "",
    apiKey: state.forumAiSettings?.apiKey || "",
    model: state.forumAiSettings?.model || ""
  };
}
