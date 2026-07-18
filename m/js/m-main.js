// 守夜人论坛 - 手机版主入口（Ins 风完整版）
const M_API_BASE = "http://43.135.26.183:3000";

var GUEST_DEVICE_ID_KEY = "cassell_guest_device_id_v1";
var AUTH_STORAGE_KEY = "cassell_auth_session";
var AUTH_TOKEN_KEY = "cassell_auth_token";

var localAuthState = { loggedIn: false, isGuest: false, studentId: "" };
var currentAccount = null;
var currentTab = "home";
var backTarget = "home";
var currentThreadId = null;
var currentThreadSlug = null;
var currentThreadData = null;

var tabs = document.querySelectorAll(".m-tab");
var content = document.getElementById("mContent");
var backBtn = document.getElementById("mBackBtn");
var searchBtn = document.getElementById("mSearchBtn");
var headerTitle = document.getElementById("mHeaderTitle");
var themeToggleBtn = document.getElementById("mThemeToggleBtn");
var appEl = document.getElementById("app");
var tabBar = document.getElementById("mTabBar");
var bottomReply = document.getElementById("mBottomReply");

/* ========== SVG 图标 ========== */
var ICO = {
  like: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
  likeOn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3H14zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/></svg>',
  dislike: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M10 15V19a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>',
  dislikeOn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M10 15V19a3 3 0 0 0 3 3l4-9V2H5.72a2 2 0 0 0-2 1.7l-1.38 9a2 2 0 0 0 2 2.3H10zM17 2h2.67A2.31 2.31 0 0 1 22 4v7a2.31 2.31 0 0 1-2.33 2H17"/></svg>',
  share: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8"/><polyline points="16 6 12 2 8 6"/><line x1="12" y1="2" x2="12" y2="15"/></svg>',
  fav: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  favOn: '<svg viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2"><path d="M19 21l-7-5-7 5V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2z"/></svg>',
  report: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 15s1-1 4-1 5 2 8 2 4-1 4-1V3s-1 1-4 1-5-2-8-2-4 1-4 1z"/><line x1="4" y1="22" x2="4" y2="15"/></svg>',
  trash: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>',
  pin: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="17" x2="12" y2="22"/><path d="M5 17h14v-1.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V6h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1v4.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24z"/></svg>',
  edit: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>',
  lock: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>',
  close: '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>'
};

/* ========== 工具 ========== */
function mFetch(path, options) {
  options = options || {};
  var headers = Object.assign({ "Content-Type": "application/json" }, options.headers || {});
  var token = localStorage.getItem(AUTH_TOKEN_KEY);
  if (token) headers.Authorization = "Bearer " + token;
  return fetch(M_API_BASE + path, Object.assign({}, options, { headers: headers }))
    .then(function (resp) {
      return resp.json().then(function (d) {
        return { ok: resp.ok, status: resp.status, data: d };
      }).catch(function () {
        return { ok: resp.ok, status: resp.status, data: {} };
      });
    });
}

function loadLocalAuth() {
  try {
    var raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (raw) localAuthState = JSON.parse(raw);
  } catch (e) {}
}

function saveLocalAuth(s) {
  localAuthState = Object.assign({}, localAuthState, s);
  localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(localAuthState));
}

function showMobileLogin() {
  var el = document.getElementById("mLoginPage");
  if (el) el.style.display = "flex";
  document.body.style.overflow = "hidden";
}

function hideMobileLogin() {
  var el = document.getElementById("mLoginPage");
  if (el) el.style.display = "none";
  document.body.style.overflow = "";
}

function getGuestDeviceId() {
  var saved = localStorage.getItem(GUEST_DEVICE_ID_KEY);
  if (saved) return saved;
  var chars = "ABCDEFGHJKLMNPQRSTUVWXYZ0123456789";
  var t = "";
  for (var i = 0; i < 12; i++) t += chars[Math.floor(Math.random() * chars.length)];
  var id = "游客#" + t;
  localStorage.setItem(GUEST_DEVICE_ID_KEY, id);
  return id;
}

function formatTime(t) {
  if (!t) return "";
  var d = new Date(t);
  if (isNaN(d.getTime())) return String(t);
  var diff = Date.now() - d.getTime();
  if (diff < 60000) return "刚刚";
  if (diff < 3600000) return Math.floor(diff / 60000) + "分钟前";
  if (diff < 86400000) return Math.floor(diff / 3600000) + "小时前";
  if (diff < 172800000) return "昨天";
  return (d.getMonth() + 1) + "/" + d.getDate();
}

function defaultAvatar(seed) {
  return "https://api.dicebear.com/7.x/lorelei/svg?seed=" + encodeURIComponent(seed || "user");
}

function escapeHtml(s) {
  if (!s) return "";
  return String(s).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

function accountFromUser(u) {
  if (!u) return null;
  var sid = String(u.studentId || u.student_id || "").toUpperCase();
  var profile = u.profile || {};
  return {
    studentId: sid,
    name: profile.forumId || u.forumId || u.name || sid,
    avatar: u.avatar || defaultAvatar(sid),
    signature: profile.signature || u.signature || "",
    identityGroups: profile.identityGroups || u.identityGroups || [],
    wearingGroup: profile.wearingGroup || u.wearingGroup || null
  };
}

function fetchMe() {
  return new Promise(function (resolve) {
    if (localAuthState.isGuest) {
      currentAccount = {
        studentId: localAuthState.studentId, name: localAuthState.studentId,
        avatar: defaultAvatar(localAuthState.studentId || "guest"),
        signature: "游客访问中。", identityGroups: [], wearingGroup: null
      };
      resolve(currentAccount);
      return;
    }
    var token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) { currentAccount = null; resolve(null); return; }
    mFetch("/api/me").then(function (res) {
      if (!res.ok || !res.data || !res.data.success || !res.data.user) { resolve(currentAccount); return; }
      currentAccount = accountFromUser(res.data.user);
      resolve(currentAccount);
    }).catch(function () { resolve(currentAccount); });
  });
}

/* ========== 权限判断 ========== */
function isAdminOrMod() {
  if (!currentAccount) return false;
  var groups = currentAccount.identityGroups || [];
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    var name = typeof g === "object" ? (g.text || g.name || "") : String(g);
    if (/管理|admin|版主|mod/i.test(name)) return true;
  }
  return false;
}

function isAdmin() {
  if (!currentAccount) return false;
  var groups = currentAccount.identityGroups || [];
  for (var i = 0; i < groups.length; i++) {
    var g = groups[i];
    var name = typeof g === "object" ? (g.text || g.name || "") : String(g);
    if (/管理|admin/i.test(name)) return true;
  }
  return false;
}

/* ========== 顶部 / 底部 ========== */
function showBackOnly() { if (backBtn) backBtn.style.display = "flex"; if (searchBtn) searchBtn.style.display = "none"; }
function showSearchOnly() { if (backBtn) backBtn.style.display = "none"; if (searchBtn) searchBtn.style.display = "flex"; }
function showTabBar() { if (tabBar) tabBar.style.display = "flex"; if (bottomReply) bottomReply.style.display = "none"; }
function showReplyBar() { if (tabBar) tabBar.style.display = "none"; if (bottomReply) bottomReply.style.display = "flex"; }
function hideBottomBar() { if (tabBar) tabBar.style.display = "none"; if (bottomReply) bottomReply.style.display = "none"; }

function setActiveTab(tabName) {
  currentTab = tabName;
  tabs.forEach(function (x) { x.classList.toggle("active", x.dataset.tab === tabName); });
}

/* ========== 右上角按钮 ========== */
var themeSvgNight = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
var themeSvgDay = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
var menuSvg = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>';

function showThemeButton() {
  if (!themeToggleBtn) return;
  themeToggleBtn.innerHTML = localStorage.getItem("m_forum_theme_mode") !== "day" ? themeSvgNight : themeSvgDay;
  themeToggleBtn.onclick = function () {
    var next = localStorage.getItem("m_forum_theme_mode") === "night" ? "day" : "night";
    applyThemeMode(next);
  };
}

function showMenuButton() {
  if (!themeToggleBtn) return;
  themeToggleBtn.innerHTML = menuSvg;
  themeToggleBtn.onclick = function () { showThreadMenu(); };
}

/* ========== 帖子菜单 ========== */
function showThreadMenu() {
  var old = document.getElementById("mThreadMenuOverlay");
  if (old) old.remove();
  if (!currentThreadData) return;

  var authorSid = currentThreadData.ownerStudentId || currentThreadData.authorStudentId || "";
  var isAuthor = currentAccount && authorSid &&
    String(currentAccount.studentId).toUpperCase() === String(authorSid).toUpperCase();

  var items = [
    { text: "分享本帖", svg: ICO.share, action: "share" },
    { text: "举报本帖", svg: ICO.report, action: "report" }
  ];

  // 发帖人可以编辑自己的帖子
  if (isAuthor) {
    items.push({ text: "编辑帖子", svg: ICO.edit, action: "edit" });
  }

    if (isAdminOrMod()) {
    items.push({
      text: currentThreadData.isPinned ? "取消置顶" : "置顶本帖",
      svg: ICO.pin,
      action: "pin",
      danger: true
    });
  }

  // 作者 或 管理/版主 可以删除
  if (isAuthor || isAdminOrMod()) {
    items.push({
      text: "删除本帖",
      svg: ICO.trash,
      action: "delete",
      danger: true
    });
  }

  if (isAdmin()) {
    items.push({
      text: currentThreadData.isLocked ? "解封本帖" : "封锁本帖",
      svg: ICO.lock,
      action: "block",
      danger: true
    });
  }

  var html = '<div class="m-menu-overlay" id="mThreadMenuOverlay">' +
    '<div class="m-menu-sheet" id="mThreadMenuSheet">';

  items.forEach(function (item) {
    html += '<div class="m-menu-item' + (item.danger ? ' danger' : '') + '" data-action="' + item.action + '">' +
      '<span class="m-menu-icon">' + item.svg + '</span>' +
      '<span>' + item.text + '</span>' +
    '</div>';
  });

  html += '<div class="m-menu-item cancel" data-action="cancel"><span>取消</span></div>';
  html += '</div></div>';

  document.body.insertAdjacentHTML("beforeend", html);

  var overlay = document.getElementById("mThreadMenuOverlay");
  var sheet = document.getElementById("mThreadMenuSheet");

  overlay.addEventListener("click", function (e) { if (e.target === overlay) closeThreadMenu(); });
  setTimeout(function () { sheet.classList.add("show"); }, 10);

  sheet.querySelectorAll(".m-menu-item").forEach(function (el) {
    el.addEventListener("click", function () {
      var action = el.dataset.action;
      closeThreadMenu();
      handleMenuAction(action);
    });
  });
}

function closeThreadMenu() {
  var sheet = document.getElementById("mThreadMenuSheet");
  var overlay = document.getElementById("mThreadMenuOverlay");
  if (sheet) sheet.classList.remove("show");
  setTimeout(function () { if (overlay) overlay.remove(); }, 300);
}

function handleMenuAction(action) {
  if (action === "cancel") return;

  if (action === "edit") {
    showEditThreadModal();
    return;
  }

  if (action === "share") {
    if (navigator.share) {
      navigator.share({ title: document.title, url: window.location.href }).catch(function () {});
    } else if (navigator.clipboard) {
      navigator.clipboard.writeText(window.location.href);
      alert("链接已复制到剪贴板");
    } else {
      alert("分享功能暂不支持");
    }
    return;
  }

  if (action === "report") {
    alert("举报功能后续接入");
    return;
  }

  if (!currentThreadData || !currentThreadData.id) {
    alert("帖子信息还没加载好，请稍后再试");
    return;
  }

  var tid = currentThreadData.id;

  if (action === "delete") {
    if (!confirm("确定要删除这个帖子吗？")) return;
    mFetch("/api/threads/" + encodeURIComponent(tid), { method: "DELETE" })
      .then(function (res) {
        if (res.ok && res.data && res.data.success) {
          alert("已删除");
          switchTab("home");
        } else {
          alert("删除失败：" + ((res.data && res.data.message) || "无权限"));
        }
      })
      .catch(function () { alert("请求失败"); });
    return;
  }

  if (action === "pin") {
    // 已经置顶就取消，没置顶就置顶
    var nextPinned = !currentThreadData.isPinned;
    mFetch("/api/threads/" + encodeURIComponent(tid) + "/pin", {
      method: "POST",
      body: JSON.stringify({ pinned: nextPinned })
    }).then(function (res) {
      if (res.ok && res.data && res.data.success) {
        alert(res.data.message || (nextPinned ? "已置顶" : "已取消置顶"));
        if (res.data.thread) {
          currentThreadData = res.data.thread;
          paintThread(currentThreadData, currentThreadData.comments || currentThreadData.replies || []);
        }
      } else {
        alert((res.data && res.data.message) || "置顶失败");
      }
    }).catch(function () { alert("请求失败"); });
    return;
  }

  if (action === "block") {
    var isLocked = !!currentThreadData.isLocked;
    var path = isLocked ? "/unlock" : "/lock";
    var tip = isLocked ? "确定要解封这个帖子吗？" : "确定要封锁这个帖子吗？";
    if (!confirm(tip)) return;

    mFetch("/api/threads/" + encodeURIComponent(tid) + path, { method: "POST" })
      .then(function (res) {
        if (res.ok && res.data && res.data.success) {
          alert(res.data.message || (isLocked ? "已解封" : "已封锁"));
          if (res.data.thread) {
            currentThreadData = res.data.thread;
            paintThread(currentThreadData, currentThreadData.comments || currentThreadData.replies || []);
          }
        } else {
          alert((res.data && res.data.message) || "操作失败");
        }
      })
      .catch(function () { alert("请求失败"); });
  }
}

/* ========== 主题 ========== */
function applyThemeMode(mode) {
  var isNight = mode === "night";
  [document.documentElement, appEl].forEach(function (el) {
    if (!el) return;
    el.classList.remove("mode-day", "mode-night");
    el.classList.add("mode-" + mode);
    if (!el.classList.contains("theme-classic")) el.classList.add("theme-classic");
  });
  document.documentElement.style.background = isNight ? "#000000" : "#faf9f6";
  document.documentElement.style.color = isNight ? "#ffffff" : "#1c1c1e";
  localStorage.setItem("m_forum_theme_mode", mode);
  if (themeToggleBtn && themeToggleBtn.onclick) {
    var isThemeMode = themeToggleBtn.innerHTML.indexOf("21 12.79") !== -1 || themeToggleBtn.innerHTML.indexOf("12 12 r=\"5\"") !== -1;
    if (isThemeMode) themeToggleBtn.innerHTML = isNight ? themeSvgNight : themeSvgDay;
  }
}

(function () {
  applyThemeMode(localStorage.getItem("m_forum_theme_mode") || "night");
  showThemeButton();
})();

/* ========== Tab / 返回 ========== */
tabs.forEach(function (tab) {
  tab.addEventListener("click", function () { switchTab(tab.dataset.tab); });
});

if (searchBtn) searchBtn.addEventListener("click", function () { alert("搜索功能后续再做"); });

if (backBtn) backBtn.addEventListener("click", function () {
  closeThreadMenu();
  if (backTarget === "setting") { switchTab("setting"); backTarget = "home"; }
  else { switchTab("home"); }
});

function switchTab(t) {
  setActiveTab(t);
  showTabBar();
  showThemeButton();
  currentThreadData = null;
  if (t === "home")      { headerTitle.textContent = "守夜人论坛"; showSearchOnly(); renderHome(); }
  else if (t === "archive") { headerTitle.textContent = "档案"; showSearchOnly(); renderArchive(); }
  else if (t === "post")    { headerTitle.textContent = "发帖"; showSearchOnly(); renderPost(); }
  else if (t === "message") { headerTitle.textContent = "消息"; showSearchOnly(); renderMessage(); }
  else if (t === "setting") { headerTitle.textContent = "设置"; showSearchOnly(); renderSetting(); }
}

/* ========== 登录 ========== */
function updateLoginPreview() {
  var sid = document.getElementById("mAuthStudentIdInput");
  var v = (sid && sid.value || "").trim().toUpperCase();
  var prev = document.getElementById("mAuthPreviewStudentId");
  var img = document.getElementById("mAuthAvatarPreview");
  if (prev) prev.textContent = v || "请输入学号";
  if (img) img.src = defaultAvatar(v || "NightWatch");
}

function doLoginAccount() {
  var sidInput = document.getElementById("mAuthStudentIdInput");
  var pwInput = document.getElementById("mAuthAccessCodeInput");
  var studentId = (sidInput && sidInput.value || "").trim().toUpperCase();
  var accessCode = (pwInput && pwInput.value || "").trim();
  if (!studentId) { alert("请输入学号后再登录。"); return; }
  if (!accessCode) { alert("请输入访问码后再登录。"); return; }
  fetch(M_API_BASE + "/api/login", {
    method: "POST", headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId: studentId, accessCode: accessCode })
  }).then(function (r) { return r.json(); }).then(function (data) {
    if (!data || !data.success) { alert((data && data.message) || "登录失败"); return; }
    var returnedSid = String(data.user && (data.user.studentId || data.user.student_id) || "").toUpperCase();
    if (returnedSid !== studentId) { alert("登录失败：服务器返回账号不一致。"); return; }
    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    saveLocalAuth({ loggedIn: true, isGuest: false, studentId: returnedSid });
    currentAccount = accountFromUser(data.user);
    var img = document.getElementById("mAuthAvatarPreview");
    if (img && currentAccount.avatar) img.src = currentAccount.avatar;
    hideMobileLogin(); setActiveTab("home"); switchTab("home"); fetchMe();
  }).catch(function () { alert("无法连接服务器"); });
}

function doLoginGuest() {
  var guestId = getGuestDeviceId();
  localStorage.removeItem(AUTH_TOKEN_KEY);
  saveLocalAuth({ loggedIn: true, isGuest: true, studentId: guestId });
  currentAccount = { studentId: guestId, name: guestId, avatar: defaultAvatar(guestId), signature: "游客访问中。", identityGroups: [], wearingGroup: null };
  hideMobileLogin(); setActiveTab("home"); switchTab("home");
}

function mobileLogout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  saveLocalAuth({ loggedIn: false, isGuest: false, studentId: "" });
  currentAccount = null;
  showMobileLogin(); updateLoginPreview();
}

(function () {
  loadLocalAuth();
  var sid = document.getElementById("mAuthStudentIdInput");
  if (sid) sid.addEventListener("input", updateLoginPreview);
  var loginBtn = document.getElementById("mLoginAccountBtn");
  var guestBtn = document.getElementById("mGuestLoginBtn");
  if (loginBtn) loginBtn.addEventListener("click", doLoginAccount);
  if (guestBtn) guestBtn.addEventListener("click", doLoginGuest);
  if (!localAuthState.loggedIn) { showMobileLogin(); updateLoginPreview(); }
  else { hideMobileLogin(); fetchMe().then(function () { setActiveTab("home"); switchTab("home"); }); }
})();

/* ==========================================================
   操作栏 — 真实数据 + 点击交互
   ========================================================== */
function buildActionBar(t) {
  var isLiked = false;
  var isDisliked = false;
  // 兼容多种后端返回格式
  var reaction = t.currentUserReaction || t.my_reaction || t.userReaction;
  if (reaction) {
    var rtype = typeof reaction === "string" ? reaction : (reaction.reaction_type || reaction.type || "");
    isLiked = rtype === "like" || rtype === "liked";
    isDisliked = rtype === "dislike" || rtype === "disliked";
  }

  return '<div class="m-thread-action-bar">' +
    '<div class="m-thread-action-left">' +
      '<button class="m-thread-action-btn' + (isLiked ? ' active-like' : '') + '" data-act="like">' +
        (isLiked ? ICO.likeOn : ICO.like) +
        '<span>' + (t.likeCount || 0) + '</span>' +
      '</button>' +
      '<button class="m-thread-action-btn' + (isDisliked ? ' active-dislike' : '') + '" data-act="dislike">' +
        (isDisliked ? ICO.dislikeOn : ICO.dislike) +
        '<span>' + (t.dislikeCount || 0) + '</span>' +
      '</button>' +
      '<button class="m-thread-action-btn" data-act="share">' +
        ICO.share +
        '<span>' + (t.shareCount || 0) + '</span>' +
      '</button>' +
    '</div>' +
    '<button class="m-thread-action-btn' + (t.isFavorited ? ' active-fav' : '') + '" data-act="favorite">' +
      (t.isFavorited ? ICO.favOn : ICO.fav) +
      '<span>收藏</span>' +
    '</button>' +
  '</div>';
}

function bindActionBar(container, threadId) {
  container.querySelectorAll(".m-thread-action-btn").forEach(function (btn) {
    btn.addEventListener("click", function (e) {
      e.stopPropagation();
      var act = btn.dataset.act;
      if (act === "like") doThreadAction(threadId, "like");
      else if (act === "dislike") doThreadAction(threadId, "dislike");
      else if (act === "favorite") doThreadAction(threadId, "favorite");
      else if (act === "share") doThreadAction(threadId, "share");
    });
  });
}

function doThreadAction(threadId, action) {
  var method = "POST";
  var path = "/api/threads/" + encodeURIComponent(threadId) + "/" + action;
  if (action === "favorite" && currentThreadData && currentThreadData.isFavorited) {
    method = "DELETE";
  }
  if (action === "share") {
    // 分享先记录转发数，再弹出系统分享
    mFetch(path, { method: method }).then(function (res) {
      if (res.ok && res.data && res.data.thread) {
        currentThreadData = res.data.thread;
        refreshActionBar();
      }
      // 弹出系统分享
      if (navigator.share) {
        navigator.share({ title: document.title, url: window.location.href }).catch(function () {});
      } else if (navigator.clipboard) {
        navigator.clipboard.writeText(window.location.href);
        alert("链接已复制到剪贴板");
      }
    }).catch(function () {});
    return;
  }
  mFetch(path, { method: method }).then(function (res) {
    if (res.ok && res.data && res.data.thread) {
      currentThreadData = res.data.thread;
      refreshActionBar();
    } else {
      var msg = (res.data && res.data.message) || "操作失败";
      if (res.status === 401) msg = "请先登录";
      alert(msg);
    }
  }).catch(function () { alert("请求失败"); });
}

function refreshActionBar() {
  if (!currentThreadData) return;
  var bar = content.querySelector(".m-thread-action-bar");
  if (!bar) return;
  var tmp = document.createElement("div");
  tmp.innerHTML = buildActionBar(currentThreadData);
  var newBar = tmp.querySelector(".m-thread-action-bar");
  if (newBar && bar.parentNode) {
    bar.parentNode.replaceChild(newBar, bar);
    bindActionBar(newBar, currentThreadData.id);
  }
}

/* ==========================================================
   首页 — 抽屉板块 + 热门帖子
   ========================================================== */
function renderHome() {
  headerTitle.textContent = "守夜人论坛";
  showSearchOnly();
  showTabBar();
  content.innerHTML =
    '<div class="m-board-drawer" id="mBoardDrawer">' +
      '<div class="m-board-drawer-header" id="mBoardDrawerHeader">' +
        '<div class="m-board-drawer-title">板块</div>' +
        '<div class="m-board-drawer-arrow">\u25BE</div>' +
      '</div>' +
      '<div class="m-board-drawer-content">' +
        '<div class="m-board-list-inner" id="mBoardGrid"><div class="m-loading">加载中</div></div>' +
      '</div>' +
    '</div>' +
    '<div class="m-section-title">热门</div>' +
    '<div id="mHotList"><div class="m-loading">加载中</div></div>';

  var drawer = document.getElementById("mBoardDrawer");
  var header = document.getElementById("mBoardDrawerHeader");
  if (header) header.addEventListener("click", function () { drawer.classList.toggle("expanded"); });

  loadBoards();
  loadHotThreads();
}

function loadBoards() {
  var grid = document.getElementById("mBoardGrid");
  if (!grid) return;
  mFetch("/api/boards").then(function (res) {
    var boards = (res.data && (res.data.boards || res.data.data)) || res.data || [];
    if (!res.ok || !Array.isArray(boards) || boards.length === 0) {
      grid.innerHTML = '<div class="m-empty">暂无板块</div>';
      return;
    }
    var html = '<div class="m-board-grid-inner">';
    boards.forEach(function (b) {
      var slug = b.slug || b.id || "";
      var name = b.name || b.title || slug;
      var firstLetter = (name || "板").charAt(0);
      html +=
        '<div class="m-board-item" data-slug="' + escapeHtml(slug) + '" data-name="' + escapeHtml(name) + '">' +
          '<div class="m-board-icon">' + escapeHtml(firstLetter) + '</div>' +
          '<div class="m-board-info">' +
            '<div class="m-board-name">' + escapeHtml(name) + '</div>' +
            '<div class="m-board-desc">' + escapeHtml(b.description || b.desc || "") + '</div>' +
          '</div>' +
        '</div>';
    });
    html += '</div>';
    grid.innerHTML = html;
    grid.querySelectorAll(".m-board-item").forEach(function (el) {
      el.addEventListener("click", function () { renderBoardPage(el.dataset.slug, el.dataset.name); });
    });
  }).catch(function () { grid.innerHTML = '<div class="m-empty">板块加载失败</div>'; });
}

function loadHotThreads() {
  var list = document.getElementById("mHotList");
  if (!list) return;
  mFetch("/api/boards").then(function (res) {
    var boards = (res.data && (res.data.boards || res.data.data)) || res.data || [];
    if (!Array.isArray(boards) || boards.length === 0) { list.innerHTML = '<div class="m-empty">暂无热门</div>'; return; }
    var board = boards.find(function (b) { return /public|公共/i.test(String(b.slug || b.name || "")); }) || boards[0];
    var slug = board.slug || board.id;
    var boardName = board.name || board.title || slug;
    return mFetch("/api/boards/" + encodeURIComponent(slug) + "/threads").then(function (r2) {
      var threads = (r2.data && (r2.data.threads || r2.data.data)) || r2.data || [];
      if (!r2.ok || !Array.isArray(threads) || threads.length === 0) { list.innerHTML = '<div class="m-empty">暂无帖子</div>'; return; }
      var html = "";
      threads.slice(0, 10).forEach(function (t) {
        var id = t.id || t.threadId || t.thread_id;
        var authorName = t.authorName || t.author || t.forumId || "匿名";
        var authorSid = t.authorStudentId || t.studentId || "";
        var avatar = t.authorAvatar || defaultAvatar(authorSid || authorName);
        html +=
          '<div class="m-thread-item" data-id="' + id + '" data-slug="' + escapeHtml(slug) + '">' +
            '<div class="m-thread-top">' +
              '<div class="m-thread-author-row">' +
                '<img class="m-thread-author-avatar" src="' + escapeHtml(avatar) + '">' +
                '<div class="m-thread-author">' + escapeHtml(authorName) + '</div>' +
              '</div>' +
              '<div class="m-thread-board-tag">' + escapeHtml(boardName) + '</div>' +
            '</div>' +
            '<div class="m-thread-title">' + escapeHtml(t.title || "无标题") + '</div>' +
            buildActionBar(t) +
          '</div>';
      });
      list.innerHTML = html;
      // 绑定列表里的操作按钮
      list.querySelectorAll(".m-thread-item").forEach(function (el) {
        var tid = el.dataset.id;
        bindActionBar(el, tid);
        el.querySelector(".m-thread-title").addEventListener("click", function () {
          renderThreadPage(tid, el.dataset.slug);
        });
      });
    });
  }).catch(function () { list.innerHTML = '<div class="m-empty">热门加载失败</div>'; });
}

/* ========== 板块页 ========== */
function renderBoardPage(slug, boardName) {
  backTarget = "home";
  headerTitle.textContent = boardName || "板块";
  showBackOnly(); showTabBar(); showThemeButton();
  content.innerHTML = '<div class="m-section-title">' + escapeHtml(boardName || slug) + '</div><div id="mBoardThreads" class="m-loading">加载中</div>';
  mFetch("/api/boards/" + encodeURIComponent(slug) + "/threads").then(function (res) {
    var box = document.getElementById("mBoardThreads");
    if (!box) return;
    var threads = (res.data && (res.data.threads || res.data.data)) || res.data || [];
    if (!res.ok || !Array.isArray(threads) || threads.length === 0) { box.innerHTML = '<div class="m-empty">暂无帖子</div>'; return; }
    var html = "";
    threads.forEach(function (t) {
      var id = t.id || t.threadId || t.thread_id;
      var authorName = t.authorName || t.author || "匿名";
      var authorSid = t.authorStudentId || t.studentId || "";
      var avatar = t.authorAvatar || defaultAvatar(authorSid || authorName);
      html +=
        '<div class="m-thread-item" data-id="' + id + '" data-slug="' + escapeHtml(slug) + '">' +
          '<div class="m-thread-top">' +
            '<div class="m-thread-author-row">' +
              '<img class="m-thread-author-avatar" src="' + escapeHtml(avatar) + '">' +
              '<div class="m-thread-author">' + escapeHtml(authorName) + '</div>' +
            '</div>' +
            '<div class="m-thread-board-tag">' + (t.replyCount || t.replies || 0) + ' 回复</div>' +
          '</div>' +
          '<div class="m-thread-title">' + escapeHtml(t.title || "无标题") + '</div>' +
          buildActionBar(t) +
        '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll(".m-thread-item").forEach(function (el) {
      var tid = el.dataset.id;
      bindActionBar(el, tid);
      el.querySelector(".m-thread-title").addEventListener("click", function () {
        renderThreadPage(tid, el.dataset.slug);
      });
    });
  }).catch(function () { var box = document.getElementById("mBoardThreads"); if (box) box.innerHTML = '<div class="m-empty">加载失败</div>'; });
}

/* ==========================================================
   帖子详情
   ========================================================== */
function renderThreadPage(threadId, slug) {
  backTarget = "home";
  headerTitle.textContent = "帖子详情";
  showBackOnly(); showReplyBar(); showMenuButton();
  content.innerHTML = '<div class="m-loading">加载中</div>';

  mFetch("/api/threads/" + encodeURIComponent(threadId)).then(function (res) {
    if (res.ok && res.data && (res.data.thread || res.data.data || res.data.title)) {
      var t = res.data.thread || res.data.data || res.data;
      currentThreadData = t;
      paintThread(t, res.data.replies || t.replies || []);
      return;
    }
    return mFetch("/api/boards/" + encodeURIComponent(slug) + "/threads").then(function (r2) {
      var threads = (r2.data && (r2.data.threads || r2.data.data)) || [];
      var found = (threads || []).find(function (x) { return String(x.id || x.threadId || x.thread_id) === String(threadId); });
      if (!found) { content.innerHTML = '<div class="m-empty">帖子不存在或接口未就绪</div>'; return; }
      currentThreadData = found;
      paintThread(found, found.replies || []);
    });
  }).catch(function () { content.innerHTML = '<div class="m-empty">帖子加载失败</div>'; });
}

function paintThread(t, replies) {
  replies = replies || [];
  var authorName = t.author || t.authorForumId || t.authorName || "匿名";
  var authorSid = t.authorStudentId || t.studentId || "";
  var authorAvatar = t.authorAvatar || defaultAvatar(authorSid || authorName);

  content.innerHTML =
    '<div class="m-thread-detail">' +
      '<div class="m-thread-detail-title">' + escapeHtml(t.title || "无标题") + '</div>' +
      '<div class="m-thread-detail-author">' +
        '<img class="m-thread-detail-avatar" src="' + escapeHtml(authorAvatar) + '">' +
        '<div class="m-thread-detail-author-info">' +
          '<div class="m-thread-detail-author-name">' + escapeHtml(authorName) + '</div>' +
          '<div class="m-thread-detail-meta"><span>' + formatTime(t.createdAt || t.created_at || t.time) + '</span></div>' +
        '</div>' +
      '</div>' +
      '<div class="m-thread-detail-content">' + escapeHtml(t.content || t.body || "（无正文）").replace(/\n/g, "<br>") + '</div>' +
      buildActionBar(t) +
    '</div>' +
    '<div class="m-section-title">回复 (' + replies.length + ')</div>' +
    '<div id="mReplyList">' +
      (replies.length ? replies.map(function (r) {
        var rName = r.author || r.authorForumId || r.authorName || "匿名";
        var rSid = r.authorStudentId || r.studentId || "";
        var rAvatar = r.authorAvatar || defaultAvatar(rSid || rName);
        return '<div class="m-reply-item">' +
          '<div class="m-reply-header">' +
            '<div class="m-reply-author-row">' +
              '<img class="m-reply-avatar" src="' + escapeHtml(rAvatar) + '">' +
              '<span class="m-reply-author">' + escapeHtml(rName) + '</span>' +
            '</div>' +
            '<span class="m-reply-time">' + formatTime(r.createdAt || r.time) + '</span>' +
          '</div>' +
          '<div class="m-reply-content">' + escapeHtml(r.content || "").replace(/\n/g, "<br>") + '</div>' +
        '</div>';
      }).join("") : '<div class="m-empty">暂无回复</div>') +
    '</div>';

  // 绑定操作栏
  var detail = content.querySelector(".m-thread-detail");
  if (detail) bindActionBar(detail, t.id);
}

/* ========== 档案 / 发帖 / 消息 ========== */
function renderArchive() {
  content.innerHTML =
    '<div class="m-section-title">档案馆</div><div class="m-empty">暂未开启</div>' +
    '<div class="m-section-title">收藏库</div><div class="m-empty">暂无收藏</div>';
}
function renderPost() {
  content.innerHTML = '<div class="m-card"><h2>发布新帖</h2><p>发帖表单后续再接后端</p></div>';
}
function renderMessage() {
  content.innerHTML = '<div class="m-empty">暂无消息</div>';
}

/* ========== 设置页 ========== */
function renderSetting() {
  var me = currentAccount || { name: "未登录", studentId: "", avatar: defaultAvatar("guest"), signature: "", identityGroups: [] };
  var wearing = me.wearingGroup || (me.identityGroups && me.identityGroups[0]) || "";
  if (wearing && typeof wearing === "object") wearing = wearing.text || wearing.name || "";
  var badgeHtml = wearing ? '<div class="m-profile-badge">' + escapeHtml(wearing) + '</div>' : "";

  content.innerHTML =
    '<div class="m-profile-card" id="mProfileCard">' +
      '<div class="m-profile-avatar"><img src="' + escapeHtml(me.avatar || defaultAvatar(me.studentId)) + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>' +
      '<div class="m-profile-info">' +
        '<div class="m-profile-row"><div class="m-profile-name">' + escapeHtml(me.name || me.studentId || "未登录") + '</div>' + badgeHtml + '</div>' +
        '<div class="m-profile-student">学号: ' + escapeHtml(me.studentId || "-") + '</div>' +
        '<div class="m-profile-bio">' + escapeHtml(me.signature || "这个人很懒，什么都没写。") + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="m-setting-group">' +
      '<div class="m-setting-item" id="mForumSettingBtn"><div class="m-setting-left"><span class="m-setting-label">论坛设置</span></div><div class="m-setting-arrow">›</div></div>' +
      '<div class="m-setting-item" id="mBeautifyBtn"><div class="m-setting-left"><span class="m-setting-label">美化主题</span></div><div class="m-setting-arrow">›</div></div>' +
      '<div class="m-setting-item" id="mAccountBtn"><div class="m-setting-left"><span class="m-setting-label">账号管理</span></div><div class="m-setting-arrow">›</div></div>' +
      '<div class="m-setting-item danger" id="mLogoutBtn"><div class="m-setting-left"><span class="m-setting-label">退出登录</span></div><div class="m-setting-arrow">›</div></div>' +
    '</div>';

  document.getElementById("mProfileCard").addEventListener("click", function () { renderProfilePage(); });
  document.getElementById("mForumSettingBtn").addEventListener("click", function () { alert("论坛设置（后续）"); });
  document.getElementById("mBeautifyBtn").addEventListener("click", function () { alert("美化主题（后续）"); });
  document.getElementById("mAccountBtn").addEventListener("click", function () { alert("账号管理（后续）"); });
  document.getElementById("mLogoutBtn").addEventListener("click", function () { if (confirm("确定退出登录？")) mobileLogout(); });
}

/* ========== 个人主页 ========== */
function renderProfilePage() {
  backTarget = "setting";
  headerTitle.textContent = "个人主页";
  showBackOnly(); hideBottomBar(); showThemeButton();

  var me = currentAccount || { name: "未登录", studentId: "", avatar: defaultAvatar("guest"), signature: "", identityGroups: [], wearingGroup: null };

  var wearing = me.wearingGroup;
  if (wearing && typeof wearing === "object") wearing = wearing.text || wearing.name || "";
  if (!wearing && me.identityGroups && me.identityGroups[0]) {
    var g0 = me.identityGroups[0];
    wearing = typeof g0 === "object" ? (g0.text || g0.name || "") : g0;
  }

  var groups = me.identityGroups || [];
  var ownedHtml = "";
  if (groups.length) {
    ownedHtml = '<div class="m-profile-owned-list">' + groups.map(function (g) {
      var text = typeof g === "object" ? (g.text || g.name || "") : g;
      var color = (typeof g === "object" && g.color) ? g.color : "#262626";
      return '<span class="m-profile-owned-tag" style="background:' + color + ';">' + escapeHtml(text) + '</span>';
    }).join("") + '</div>';
  } else {
    ownedHtml = '<div class="m-empty" style="padding:12px 0;">暂无身份组</div>';
  }

  content.innerHTML =
    '<div class="m-profile-page-card">' +
      '<div class="m-profile-page-avatar"><img src="' + escapeHtml(me.avatar || defaultAvatar(me.studentId)) + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>' +
      '<div class="m-profile-page-name-row">' +
        '<span class="m-profile-page-name">' + escapeHtml(me.name || me.studentId) + '</span>' +
        (wearing ? '<span class="m-profile-page-wearing">' + escapeHtml(wearing) + '</span>' : '') +
      '</div>' +
      '<div class="m-profile-page-student">学号: ' + escapeHtml(me.studentId || "-") + '</div>' +
      '<div class="m-profile-page-bio">' + escapeHtml(me.signature || "这个人很懒，什么都没写。") + '</div>' +
      ownedHtml +
      '<div class="m-profile-stats">' +
        '<div class="m-profile-stat"><div class="m-profile-stat-num">-</div><div class="m-profile-stat-label">发帖</div></div>' +
        '<div class="m-profile-stat"><div class="m-profile-stat-num">-</div><div class="m-profile-stat-label">回复</div></div>' +
        '<div class="m-profile-stat"><div class="m-profile-stat-num">-</div><div class="m-profile-stat-label">收藏</div></div>' +
      '</div>' +
    '</div>' +
    '<div class="m-profile-tabs">' +
      '<button class="m-profile-tab active" data-ptab="posts">发帖</button>' +
      '<button class="m-profile-tab" data-ptab="replies">回复</button>' +
      '<button class="m-profile-tab" data-ptab="favs">收藏</button>' +
    '</div>' +
    '<div id="mProfileList"><div class="m-empty">暂无数据</div></div>';

    /* ========== 编辑帖子弹窗 ========== */
function showEditThreadModal() {
  if (!currentThreadData) return;

  var old = document.getElementById("mEditOverlay");
  if (old) old.remove();

  var html =
    '<div class="m-menu-overlay" id="mEditOverlay">' +
      '<div class="m-menu-sheet" id="mEditSheet">' +
        '<div class="m-edit-form">' +
          '<div class="m-edit-header">' +
            '<div class="m-edit-title">编辑帖子</div>' +
            '<button class="m-edit-close" id="mEditClose" style="background:none;border:none;cursor:pointer;">' + ICO.close + '</button>' +
          '</div>' +
          '<div class="m-edit-body">' +
            '<label class="m-edit-label">标题</label>' +
            '<input class="m-edit-input" id="mEditTitle" value="">' +
            '<label class="m-edit-label">正文</label>' +
            '<textarea class="m-edit-textarea" id="mEditContent"></textarea>' +
          '</div>' +
          '<div class="m-edit-footer">' +
            '<button class="m-edit-save" id="mEditSave">保存修改</button>' +
          '</div>' +
        '</div>' +
      '</div>' +
    '</div>';

  document.body.insertAdjacentHTML("beforeend", html);

  var overlay = document.getElementById("mEditOverlay");
  var sheet = document.getElementById("mEditSheet");

  setTimeout(function () { sheet.classList.add("show"); }, 10);

  overlay.addEventListener("click", function (e) {
    if (e.target === overlay) closeEditModal();
  });

  document.getElementById("mEditClose").addEventListener("click", closeEditModal);

  // 填充当前值
  var t = currentThreadData;
  document.getElementById("mEditTitle").value = t.title || "";
  document.getElementById("mEditContent").value = (t.content || t.body || "").replace(/<br\s*\/?>/gi, "\n");

  document.getElementById("mEditSave").addEventListener("click", function () {
    var newTitle = document.getElementById("mEditTitle").value.trim();
    var newContent = document.getElementById("mEditContent").value.trim();
    if (!newTitle) { alert("标题不能为空"); return; }
    if (!newContent) { alert("正文不能为空"); return; }

    saveThreadEdit(newTitle, newContent);
  });
}

function closeEditModal() {
  var sheet = document.getElementById("mEditSheet");
  var overlay = document.getElementById("mEditOverlay");
  if (sheet) sheet.classList.remove("show");
  setTimeout(function () { if (overlay) overlay.remove(); }, 300);
}

function saveThreadEdit(newTitle, newContent) {
  if (!currentThreadData) return;

  // 先发标题
  mFetch("/api/threads/" + encodeURIComponent(currentThreadData.id) + "/title", {
    method: "PUT",
    body: JSON.stringify({ title: newTitle })
  }).then(function (res1) {
    if (!res1.ok) {
      alert((res1.data && res1.data.message) || "标题修改失败");
      return;
    }
    // 再发正文
    mFetch("/api/threads/" + encodeURIComponent(currentThreadData.id) + "/content", {
      method: "PUT",
      body: JSON.stringify({ content: newContent })
    }).then(function (res2) {
      if (res2.ok && res2.data && res2.data.thread) {
        alert("修改成功");
        closeEditModal();
        currentThreadData = res2.data.thread;
        // 重新渲染帖子详情
        paintThread(currentThreadData, res2.data.replies || currentThreadData.replies || []);
      } else {
        alert((res2.data && res2.data.message) || "正文修改失败");
      }
    }).catch(function () { alert("请求失败"); });
  }).catch(function () { alert("请求失败"); });
}

}

