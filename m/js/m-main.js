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
var currentBoardContext = null;
var pageHistory = [];
var mPrivateChats = [];
var mFriendsCache = [];
var currentChatContact = null;
var currentChatId = null;
var mFriendsLoading = false;
var mFriendsLoadedOnce = false;

var tabs = document.querySelectorAll(".m-tab");
var content = document.getElementById("mContent");
var backBtn = document.getElementById("mBackBtn");
var searchBtn = document.getElementById("mSearchBtn");
var headerTitle = document.getElementById("mHeaderTitle");
var themeToggleBtn = document.getElementById("mThemeToggleBtn");
var appEl = document.getElementById("app");
var tabBar = document.getElementById("mTabBar");
var bottomReply = document.getElementById("mBottomReply");
var bottomPublish = document.getElementById("mBottomPublish");
var bottomPublishBtn = document.getElementById("mPostSubmit");
var bottomChat = document.getElementById("mBottomChat");
var chatInput = document.getElementById("mChatInput");
var chatSendBtn = document.getElementById("mChatSendBtn");

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

/* ========== 手机版诺玛 ========== */
var M_NORMA_CONTACT = {
  studentId: "AI000000",
  name: "诺玛",
  forumId: "诺玛",
  avatar: "https://i.ibb.co/jktdRJ2v/IMG-20260609-181805.png",
  signature: "我会一直保持在线。",
  accountKind: "norma_bot",
  status: "online"
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

  var wearing =
    profile.displayGroup ||
    profile.wearingGroup ||
    u.displayGroup ||
    u.wearingGroup ||
    "";

  var localAvatar = "";
  try {
    localAvatar = localStorage.getItem("cassell_local_avatar_" + sid) || "";
  } catch (e) {}

  return {
    studentId: sid,
    name: profile.forumId || u.forumId || u.name || sid,
    avatar: localAvatar || u.avatar || defaultAvatar(sid),
    signature: profile.signature || u.signature || "",
    identityGroups: profile.identityGroups || u.identityGroups || [],
    wearingGroup: wearing || null,
    displayGroup: wearing || "",
    displayGroupOptions:
      profile.displayGroupOptions ||
      u.displayGroupOptions ||
      []
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

function showTabBar() {
  if (tabBar) tabBar.style.display = "flex";
  if (bottomReply) bottomReply.style.display = "none";
  if (bottomPublish) bottomPublish.style.display = "none";
  if (bottomChat) bottomChat.style.display = "none";
}

function showReplyBar() {
  if (tabBar) tabBar.style.display = "none";
  if (bottomReply) bottomReply.style.display = "flex";
  if (bottomPublish) bottomPublish.style.display = "none";
  if (bottomChat) bottomChat.style.display = "none";
}

function showPublishBar() {
  if (tabBar) tabBar.style.display = "none";
  if (bottomReply) bottomReply.style.display = "none";
  if (bottomPublish) bottomPublish.style.display = "flex";
  if (bottomChat) bottomChat.style.display = "none";
}

function showChatBar() {
  if (tabBar) tabBar.style.display = "none";
  if (bottomReply) bottomReply.style.display = "none";
  if (bottomPublish) bottomPublish.style.display = "none";
  if (bottomChat) bottomChat.style.display = "flex";
}

function hideBottomBar() {
  if (tabBar) tabBar.style.display = "none";
  if (bottomReply) bottomReply.style.display = "none";
  if (bottomPublish) bottomPublish.style.display = "none";
  if (bottomChat) bottomChat.style.display = "none";
}

function setActiveTab(tabName) {
  currentTab = tabName;
  tabs.forEach(function (x) { x.classList.toggle("active", x.dataset.tab === tabName); });
}

/* ========== 右上角按钮 ========== */
var themeSvgNight = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>';
var themeSvgDay = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
var menuSvg = '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="5" r="1"/><circle cx="12" cy="12" r="1"/><circle cx="12" cy="19" r="1"/></svg>';

function hideRightButton() {
  if (!themeToggleBtn) return;

  themeToggleBtn.style.display = "none";
  themeToggleBtn.onclick = null;
}

function showThemeButton() {
  if (!themeToggleBtn) return;

  themeToggleBtn.style.display = "flex";
  themeToggleBtn.innerHTML = localStorage.getItem("m_forum_theme_mode") !== "day" ? themeSvgNight : themeSvgDay;
  themeToggleBtn.onclick = function () {
    var next = localStorage.getItem("m_forum_theme_mode") === "night" ? "day" : "night";
    applyThemeMode(next);
  };
}

function showMenuButton() {
  if (!themeToggleBtn) return;

  themeToggleBtn.style.display = "flex";
  themeToggleBtn.innerHTML = menuSvg;
  themeToggleBtn.onclick = function () { showThreadMenu(); };
}

/* ========== 评论长按菜单 ========== */
function showCommentActionSheet(commentId) {
  var old = document.getElementById("mCommentSheetOverlay");
  if (old) old.remove();

  if (!currentThreadData || !currentThreadData.id) return;

  var comments = currentThreadData.comments || [];

  var target = comments.find(function (c) {
    return String(c.id) === String(commentId);
  });

  if (!target) return;

  var overlay = document.createElement("div");
  overlay.id = "mCommentSheetOverlay";
  overlay.className = "m-sheet-overlay";

  var sheet = document.createElement("div");
  sheet.className = "m-comment-sheet";

  var isSystem = Boolean(target.isSystem || target.system_flag);

  if (isSystem) {
    sheet.innerHTML =
      '<button class="m-sheet-item" data-act="close">关闭</button>';

    overlay.appendChild(sheet);
    document.body.appendChild(overlay);

    overlay.querySelectorAll(".m-sheet-item").forEach(function (btn) {
      btn.addEventListener("click", function () {
        overlay.remove();
      });
    });

    return;
  }

  var myStudentId =
    currentAccount && currentAccount.studentId
      ? String(currentAccount.studentId).toUpperCase()
      : "";

  var commentStudentId = String(
    target.authorStudentId ||
    target.author_student_id ||
    ""
  ).toUpperCase();

  var threadOwner = String(
    currentThreadData.ownerStudentId ||
    currentThreadData.authorStudentId ||
    currentThreadData.author_student_id ||
    ""
  ).toUpperCase();

  var canDelete =
    isAdminOrMod() ||
    commentStudentId === myStudentId ||
    threadOwner === myStudentId;

  var html = "";

  html +=
    '<button class="m-sheet-item" data-act="share">' +
      '<span class="m-sheet-icon">' + ICO.share + '</span>' +
      '<span>转发评论</span>' +
    '</button>';

  html +=
    '<button class="m-sheet-item" data-act="report">' +
      '<span class="m-sheet-icon">' + ICO.report + '</span>' +
      '<span>举报评论</span>' +
    '</button>';

  if (canDelete) {
    html +=
      '<button class="m-sheet-item danger" data-act="delete">' +
        '<span class="m-sheet-icon">' + ICO.trash + '</span>' +
        '<span>删除评论</span>' +
      '</button>';
  }

  html += '<button class="m-sheet-item cancel" data-act="close">取消</button>';

  sheet.innerHTML = html;
  overlay.appendChild(sheet);
  document.body.appendChild(overlay);

  overlay.querySelectorAll(".m-sheet-item").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var act = btn.getAttribute("data-act");
      overlay.remove();

      if (act === "share") shareComment(commentId);
      else if (act === "report") reportComment(commentId);
      else if (act === "delete") deleteComment(commentId);
    });
  });

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) overlay.remove();
  });
}

/* ========== 分享评论 ========== */
function shareComment(commentId) {
  var url =
    window.location.origin +
    "/m-index.html?thread=" +
    encodeURIComponent(currentThreadData.id) +
    "&comment=" +
    encodeURIComponent(commentId) +
    "&v=14";

  var title = currentThreadData.title || "守夜人论坛";

  if (navigator.share) {
    navigator.share({
      title: title,
      text: "看看这条评论",
      url: url
    }).catch(function () {});
  } else if (navigator.clipboard) {
    navigator.clipboard.writeText(url);
    alert("评论链接已复制");
  } else {
    alert(url);
  }
}

/* ========== 举报评论 ========== */
function reportComment(commentId) {
  var reason = prompt("请输入举报原因（选填）：");

  if (reason === null) return;

  mFetch(
    "/api/comments/" + encodeURIComponent(commentId) + "/report",
    {
      method: "POST",
      body: JSON.stringify({ reason: reason || "" })
    }
  )
    .then(function (res) {
      if (res.ok && res.data && res.data.success) {
        alert(res.data.message || "举报已提交");
      } else {
        alert(
          (res.data && res.data.message) || "举报失败"
        );
      }
    })
    .catch(function () {
      alert("请求失败");
    });
}

/* ========== 删除评论 ========== */
function deleteComment(commentId) {
  if (!confirm("确定要删除这条评论吗？")) return;

  mFetch(
    "/api/comments/" + encodeURIComponent(commentId),
    { method: "DELETE" }
  )
    .then(function (res) {
      if (res.ok && res.data && res.data.success) {
        reloadCurrentThreadComments();
      } else {
        alert(
          (res.data && res.data.message) || "删除失败"
        );
      }
    })
    .catch(function () {
      alert("请求失败");
    });
}

/* ========== 重新加载当前帖子的评论 ========== */
function reloadCurrentThreadComments() {
  if (!currentThreadData || !currentThreadData.id) return;

  mFetch(
    "/api/threads/" +
      encodeURIComponent(currentThreadData.id)
  )
    .then(function (res) {
      if (
        res.ok &&
        res.data &&
        res.data.thread
      ) {
        currentThreadData = res.data.thread;

        var comments = Array.isArray(currentThreadData.comments)
          ? currentThreadData.comments
          : [];

        currentThreadData.comments = comments;
        paintThread(currentThreadData, comments);
      }
    })
    .catch(function () {});
}

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

  // 发帖人：标题和正文一起编辑，只能编辑一次
  if (isAuthor) {
    items.push({
      text: "编辑帖子",
      svg: ICO.edit,
      action: "edit"
    });
  }

  // 管理员：可以无限修改标题
  if (isAdmin()) {
    items.push({
      text: "修改标题",
      svg: ICO.edit,
      action: "editTitle"
    });
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

  if (action === "editTitle") {
    editThreadTitleByAdmin();
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
      if (!res.ok || !res.data || !res.data.success) {
        alert((res.data && res.data.message) || "置顶失败");
        return;
      }

      alert(res.data.message || (nextPinned ? "已置顶" : "已取消置顶"));

      /*
       * 置顶接口会新建一条诺玛系统评论。
       * 所以操作成功后，再重新读取一次帖子详情，
       * 才能把这条评论显示出来。
       */
      return mFetch("/api/threads/" + encodeURIComponent(tid));
    }).then(function (detailRes) {
      if (!detailRes) return;

      if (
        detailRes.ok &&
        detailRes.data &&
        detailRes.data.thread
      ) {
        currentThreadData = detailRes.data.thread;

        var comments = Array.isArray(currentThreadData.comments)
          ? currentThreadData.comments
          : [];

        currentThreadData.comments = comments;
        paintThread(currentThreadData, comments);
      }
    }).catch(function () {
      alert("请求失败");
    });

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
  goBackPage();
});

function goBackPage() {
  var prev = pageHistory.pop();

  if (!prev) {
    switchTab("home");
    return;
  }

  if (prev.type === "message") {
    switchTab("message");
    return;
  }

  if (prev.type === "board") {
    renderBoardPage(prev.slug, prev.name, true);
    return;
  }

  if (prev.type === "thread") {
    renderThreadPage(prev.id, prev.slug, true);
    return;
  }

  if (prev.type === "setting") {
    switchTab("setting");
    return;
  }

  if (prev.type === "home") {
    switchTab("home");
    return;
  }

  switchTab("home");
}

function switchTab(t) {
  setActiveTab(t);
  currentThreadData = null;

  if (t === "post") {
  if (currentBoardContext && currentBoardContext.slug) {
    pageHistory.push({
      type: "board",
      slug: currentBoardContext.slug,
      name: currentBoardContext.name || "板块"
    });
  } else {
    pageHistory.push({ type: "home" });
  }

  headerTitle.textContent = "发帖";
  showBackOnly();
  hideRightButton();
  showPublishBar();
  renderPost();
  return;
}

  showTabBar();
  showThemeButton();

  if (t === "home") {
    headerTitle.textContent = "守夜人论坛";
    showSearchOnly();
    renderHome();
  } else if (t === "archive") {
    headerTitle.textContent = "档案";
    showSearchOnly();
    renderArchive();
  } else if (t === "message") {
    headerTitle.textContent = "消息";
    showSearchOnly();
    renderMessage();
  } else if (t === "setting") {
    headerTitle.textContent = "设置";
    showSearchOnly();
    renderSetting();
  }
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

function isThreadPinned(t) {
  return Boolean(
    t &&
    (t.isPinned === true ||
      t.isPinned === 1 ||
      t.is_pinned === true ||
      t.is_pinned === 1)
  );
}

/* ========== 评论操作栏（点赞、点踩、楼层） ========== */
function buildCommentFooter(comment, commentStudentId) {
  var isDeleted = Boolean(comment.isDeleted || comment.is_deleted);

  if (isDeleted) {
    return '<div class="m-reply-footer"></div>';
  }

  var isLiked = false;
  var isDisliked = false;

  var reaction =
    comment.currentUserReaction ||
    comment.my_reaction ||
    comment.userReaction;

  if (reaction) {
    var reactionType =
      typeof reaction === "string"
        ? reaction
        : (reaction.reactionType ||
           reaction.reaction_type ||
           reaction.type ||
           "");

    isLiked = reactionType === "like" || reactionType === "liked";
    isDisliked = reactionType === "dislike" || reactionType === "disliked";
  }

  var floorNo = Number(comment.floorNo || comment.floor_no || 0);

  return (
    '<div class="m-reply-footer">' +
      '<div class="m-reply-actions">' +
        '<button ' +
          'type="button" ' +
          'class="m-reply-action-btn' + (isLiked ? ' active-like' : '') + '" ' +
          'data-comment-act="like" ' +
          'data-comment-id="' + escapeHtml(comment.id) + '">' +
          (isLiked ? ICO.likeOn : ICO.like) +
          '<span>' + escapeHtml(String(comment.likeCount || comment.like_count || 0)) + '</span>' +
        '</button>' +
        '<button ' +
          'type="button" ' +
          'class="m-reply-action-btn' + (isDisliked ? ' active-dislike' : '') + '" ' +
          'data-comment-act="dislike" ' +
          'data-comment-id="' + escapeHtml(comment.id) + '">' +
          (isDisliked ? ICO.dislikeOn : ICO.dislike) +
          '<span>' + escapeHtml(String(comment.dislikeCount || comment.dislike_count || 0)) + '</span>' +
        '</button>' +
      '</div>' +
      '<div class="m-reply-floor">' +
        (floorNo > 0 ? escapeHtml(floorNo) + '楼' : '') +
      '</div>' +
    '</div>'
  );
}

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
  currentBoardContext = null;
  pageHistory = [];
  headerTitle.textContent = "守夜人论坛";
  showSearchOnly();
  showTabBar();
  content.innerHTML =
    '<div id="mPinnedBanner" class="m-pinned-banner"></div>' +

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
  loadHomePinned();
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

function loadHomePinned() {
  var box = document.getElementById("mPinnedBanner");
  if (!box) return;

  mFetch("/api/forum/home-pinned")
    .then(function (res) {
      var items =
        res.data && Array.isArray(res.data.items)
          ? res.data.items.slice(0, 3)
          : [];

      if (!res.ok || items.length === 0) {
        box.innerHTML = "";
        box.style.display = "none";
        return;
      }

      box.style.display = "block";

      var html = "";

      items.forEach(function (item) {
        var threadId = item.id || item.threadId || item.thread_id;
        var boardSlug =
          item.boardSlug ||
          item.board_slug ||
          (item.board && item.board.slug) ||
          "";

        html +=
          '<button class="m-pinned-banner-item" ' +
            'data-thread-id="' + escapeHtml(threadId) + '" ' +
            'data-board-slug="' + escapeHtml(boardSlug) + '">' +
            '<span class="m-pinned-mark">置顶</span>' +
            '<span class="m-pinned-banner-title">' +
              escapeHtml(item.title || "无标题") +
            '</span>' +
          '</button>';
      });

      box.innerHTML = html;

      box.querySelectorAll(".m-pinned-banner-item").forEach(function (item) {
        item.addEventListener("click", function () {
          var threadId = item.dataset.threadId;
          var slug = item.dataset.boardSlug;

          if (threadId && slug) {
            renderThreadPage(threadId, slug);
          }
        });
      });
    })
    .catch(function () {
      box.innerHTML = "";
      box.style.display = "none";
    });
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
        var pinnedClass = isThreadPinned(t)
  ? " m-thread-item-pinned"
  : "";

var pinnedMark = isThreadPinned(t)
  ? '<span class="m-pinned-mark">置顶</span>'
  : "";

html +=
  '<div class="m-thread-item' + pinnedClass +
    '" data-id="' + id +
    '" data-slug="' + escapeHtml(slug) + '">' +

            '<div class="m-thread-top">' +
              '<div class="m-thread-author-row">' +
                '<img class="m-thread-author-avatar" src="' + escapeHtml(avatar) + '">' +
                '<div class="m-thread-author">' + escapeHtml(authorName) + '</div>' +
              '</div>' +
              '<div class="m-thread-board-tag">' + escapeHtml(boardName) + '</div>' +
            '</div>' +
            '<div class="m-thread-title-row">' +
  pinnedMark +
  '<div class="m-thread-title">' +
    escapeHtml(t.title || "无标题") +
  '</div>' +
'</div>' +

            buildActionBar(t) +
          '</div>';
      });
      list.innerHTML = html;
      // 绑定列表里的操作按钮
      list.querySelectorAll(".m-thread-item").forEach(function (el) {
        var tid = el.dataset.id;
        bindActionBar(el, tid);
        el.addEventListener("click", function (event) {
  if (
    event.target.closest(".m-thread-action-btn") ||
    event.target.closest("button") ||
    event.target.closest("a")
  ) {
    return;
  }

  renderThreadPage(tid, el.dataset.slug);
});

      });
    });
  }).catch(function () { list.innerHTML = '<div class="m-empty">热门加载失败</div>'; });
}

/* ========== 板块页 ========== */
function renderBoardPage(slug, boardName, fromBack) {
  currentBoardContext = {
    slug: String(slug || ""),
    name: String(boardName || "")
  };

  if (!fromBack) {
    pageHistory = [{ type: "home" }];
  }

  backTarget = "home";
  headerTitle.textContent = boardName || "板块";
  showBackOnly(); showTabBar(); showThemeButton();
  content.innerHTML = '<div id="mBoardThreads" class="m-loading">加载中</div>';
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
      var pinnedClass = isThreadPinned(t)
  ? " m-thread-item-pinned"
  : "";

var pinnedMark = isThreadPinned(t)
  ? '<span class="m-pinned-mark">置顶</span>'
  : "";

html +=
  '<div class="m-thread-item' + pinnedClass +
    '" data-id="' + id +
    '" data-slug="' + escapeHtml(slug) + '">' +

          '<div class="m-thread-top">' +
            '<div class="m-thread-author-row">' +
              '<img class="m-thread-author-avatar" src="' + escapeHtml(avatar) + '">' +
              '<div class="m-thread-author">' + escapeHtml(authorName) + '</div>' +
            '</div>' +
            '<div class="m-thread-board-tag">' + (t.replyCount || t.replies || 0) + ' 回复</div>' +
          '</div>' +
          '<div class="m-thread-title-row">' +
  pinnedMark +
  '<div class="m-thread-title">' +
    escapeHtml(t.title || "无标题") +
  '</div>' +
'</div>' +
          buildActionBar(t) +
        '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll(".m-thread-item").forEach(function (el) {
      var tid = el.dataset.id;
      bindActionBar(el, tid);
      el.addEventListener("click", function (event) {
  if (
    event.target.closest(".m-thread-action-btn") ||
    event.target.closest("button") ||
    event.target.closest("a")
  ) {
    return;
  }

  renderThreadPage(tid, el.dataset.slug);
});

    });
  }).catch(function () { var box = document.getElementById("mBoardThreads"); if (box) box.innerHTML = '<div class="m-empty">加载失败</div>'; });
}

/* ==========================================================
   帖子详情
   ========================================================== */
function renderThreadPage(threadId, slug, fromBack) {
  currentThreadId = threadId;
  currentThreadSlug = slug || "";

  if (!fromBack) {
    if (currentBoardContext && currentBoardContext.slug) {
      pageHistory = [
        { type: "home" },
        {
          type: "board",
          slug: currentBoardContext.slug,
          name: currentBoardContext.name || "板块"
        }
      ];
    } else {
      pageHistory = [{ type: "home" }];
    }
  }

  backTarget = "home";
  headerTitle.textContent = "帖子详情";
  showBackOnly();
  showReplyBar();
  showMenuButton();
  content.innerHTML = '<div class="m-loading">加载中</div>';

  mFetch("/api/threads/" + encodeURIComponent(threadId)).then(function (res) {
    if (res.ok && res.data && res.data.thread) {
      var t = res.data.thread;

      // 后端把回复和诺玛系统提醒都放在 comments 里
      var comments = Array.isArray(t.comments)
        ? t.comments
        : (Array.isArray(res.data.replies) ? res.data.replies : []);

      t.comments = comments;
      currentThreadData = t;
      paintThread(t, comments);
      return;
    }

    return mFetch("/api/boards/" + encodeURIComponent(slug) + "/threads")
      .then(function (r2) {
        var threads = (r2.data && (r2.data.threads || r2.data.data)) || [];

        var found = (threads || []).find(function (x) {
          return String(x.id || x.threadId || x.thread_id) === String(threadId);
        });

        if (!found) {
          content.innerHTML = '<div class="m-empty">帖子不存在或接口未就绪</div>';
          return;
        }

        var comments = Array.isArray(found.comments)
          ? found.comments
          : (Array.isArray(found.replies) ? found.replies : []);

        found.comments = comments;
        currentThreadData = found;
        paintThread(found, comments);
      });
  }).catch(function () {
    content.innerHTML = '<div class="m-empty">帖子加载失败</div>';
  });
}

var mentionAccountCache = {};

function renderCommentText(text) {
  var safeText = escapeHtml(String(text || ""));

  safeText = safeText.replace(
    /@([A-Za-z][A-Za-z0-9_-]{2,31})/g,
    function (fullText, studentId) {
      return '<button type="button" class="m-mention-link" ' +
        'data-student-id="' + studentId.toUpperCase() + '">@</button>';
    }
  );

  return safeText.replace(/\n/g, "<br>");
}

/* ========== 绑定评论的点赞、点踩、回复、长按 ========== */
function bindCommentActions(root) {
  if (!root) return;

  var replyItems = root.querySelectorAll(".m-reply-item");

  replyItems.forEach(function (item) {
    var commentId = item.getAttribute("data-comment-id");

    if (!commentId) return;

    /* 点赞点踩按钮 */
    item.querySelectorAll(".m-reply-action-btn").forEach(function (btn) {
      btn.addEventListener("click", function (event) {
        event.stopPropagation();
        var act = btn.getAttribute("data-comment-act");
        if (act === "like" || act === "dislike") {
          doCommentAction(commentId, act, btn);
        }
      });
    });

    /* 点击评论内容进入回复引用 */
var replyContent = item.querySelector(".m-reply-content");

if (replyContent) {
  replyContent.addEventListener("click", function () {
    if (item.dataset.longPressed === "1") {
      item.dataset.longPressed = "0";
      return;
    }
    enterReplyQuoteState(commentId);
  });
}

    /* 长按评论弹出菜单 */
    var pressTimer = null;
    var hasLongPressed = false;

    item.addEventListener("touchstart", function () {
  hasLongPressed = false;
  item.dataset.longPressed = "0";
  pressTimer = setTimeout(function () {
    hasLongPressed = true;
    item.dataset.longPressed = "1";
    showCommentActionSheet(commentId);
  }, 600);
}, { passive: true });

    item.addEventListener("touchend", function () {
  clearTimeout(pressTimer);
}, { passive: true });

item.addEventListener("touchmove", function () {
  clearTimeout(pressTimer);
}, { passive: true });

    /* 引用方块点击跳转 */
    var quoteBlock = item.querySelector(".m-reply-quote");

    if (quoteBlock) {
      quoteBlock.addEventListener("click", function (event) {
        event.stopPropagation();
        var targetId = quoteBlock.getAttribute("data-quote-comment-id");
        if (targetId) scrollToComment(targetId);
      });
    }
  });
}

/* ========== 点赞或点踩 ========== */
function doCommentAction(commentId, action, btn) {
  if (btn && btn.dataset.loading === "1") return;

  if (btn) {
    btn.dataset.loading = "1";
    btn.style.opacity = "0.55";
  }

  var path =
    "/api/comments/" +
    encodeURIComponent(commentId) +
    "/" +
    action;

  mFetch(path, { method: "POST" })
    .then(function (res) {
      if (
        res.ok &&
        res.data &&
        res.data.comment
      ) {
        refreshSingleComment(commentId, res.data.comment);
      } else {
        var msg =
          (res.data && res.data.message) ||
          "操作失败";

        if (res.status === 401) msg = "请先登录";
        alert(msg);
      }
    })
    .catch(function () {
      alert("请求失败");
    })
    .finally(function () {
      if (btn) {
        btn.dataset.loading = "0";
        btn.style.opacity = "";
      }
    });
}

/* ========== 刷新单条评论 ========== */
function refreshSingleComment(commentId, commentData) {
  var oldItem = document.querySelector(
    '.m-reply-item[data-comment-id="' +
      escapeHtml(commentId) +
    '"]'
  );

  if (!oldItem) return;

  // 同步本地评论数据
  if (currentThreadData && Array.isArray(currentThreadData.comments)) {
    currentThreadData.comments = currentThreadData.comments.map(function (item) {
      if (String(item.id) === String(commentId)) {
        return Object.assign({}, item, commentData);
      }
      return item;
    });
  }

  var oldFooter = oldItem.querySelector(".m-reply-footer");
  if (!oldFooter) return;

  var temp = document.createElement("div");
  temp.innerHTML = buildCommentFooter(commentData);

  var newFooter = temp.firstChild;
  if (!newFooter) return;

  oldItem.replaceChild(newFooter, oldFooter);

  // 只重新绑定底部按钮，不要重复绑定整条评论
  newFooter.querySelectorAll(".m-reply-action-btn").forEach(function (btn) {
    btn.addEventListener("click", function (event) {
      event.stopPropagation();
      var act = btn.getAttribute("data-comment-act");
      if (act === "like" || act === "dislike") {
        doCommentAction(commentId, act, btn);
      }
    });
  });
}

/* ========== 进入回复引用状态 ========== */
var replyQuoteState = null;

function enterReplyQuoteState(commentId) {
  if (!currentThreadData || !currentThreadData.id) return;

  var comments = currentThreadData.comments || [];

  var target = comments.find(function (c) {
    return String(c.id) === String(commentId);
  });

  if (!target) return;

  if (Boolean(target.isDeleted || target.is_deleted)) {
    alert("这条评论已删除，无法回复");
    return;
  }

  replyQuoteState = {
    commentId: commentId,
    authorForumId:
      target.authorForumId ||
      target.author_forum_id ||
      target.author ||
      "匿名",
    text: target.text != null ? target.text : (target.content || "")
  };

  showReplyBar();

  var input = document.getElementById("mReplyInput");
  if (input) {
    input.value = "";
    input.setAttribute(
      "placeholder",
      "回复 @" + replyQuoteState.authorForumId + "："
    );
    input.focus();
  }
}

/* ========== 跳转到被引用的评论并闪烁 ========== */
function scrollToComment(commentId) {
  var target = document.querySelector(
    '.m-reply-item[data-comment-id="' +
      escapeHtml(commentId) +
    '"]'
  );

  if (!target) return;

  target.scrollIntoView({ behavior: "smooth", block: "center" });

  target.classList.remove("m-reply-flash");

  void target.offsetWidth;

  target.classList.add("m-reply-flash");
}

function loadCommentMentions(root) {
  if (!root) return;

  var buttons = root.querySelectorAll(".m-mention-link");
  if (!buttons.length) return;

  var pendingIds = {};

  buttons.forEach(function (button) {
    var studentId = String(
      button.getAttribute("data-student-id") || ""
    ).toUpperCase();

    if (!studentId) return;

    button.onclick = function (event) {
      event.stopPropagation();
      renderMentionProfilePage(studentId);
    };

    if (mentionAccountCache[studentId]) {
      button.textContent =
        "@" + mentionAccountCache[studentId].forumId;
      return;
    }

    // 先显示学号，避免空白
    button.textContent = "@" + studentId;

    if (!pendingIds[studentId]) {
      pendingIds[studentId] = [];
    }
    pendingIds[studentId].push(button);
  });

  Object.keys(pendingIds).forEach(function (studentId) {
    mFetch("/api/account-preview/" + encodeURIComponent(studentId))
      .then(function (res) {
        var forumId = studentId;

        if (
          res.ok &&
          res.data &&
          res.data.account &&
          res.data.account.forumId
        ) {
          mentionAccountCache[studentId] = res.data.account;
          forumId = res.data.account.forumId;
        }

        pendingIds[studentId].forEach(function (button) {
          button.textContent = "@" + forumId;
        });
      })
      .catch(function () {
        pendingIds[studentId].forEach(function (button) {
          button.textContent = "@" + studentId;
        });
      });
  });
}

function renderMentionProfilePage(studentId) {
  backTarget = "thread";
  headerTitle.textContent = "个人主页";
  showBackOnly();
  hideBottomBar();
  showThemeButton();

  content.innerHTML = '<div class="m-loading">加载中</div>';

  mFetch("/api/users/" + encodeURIComponent(studentId))
    .then(function (res) {
      if (res.ok && res.data && res.data.user) {
        paintMentionProfile(res.data.user);
        return;
      }

      return mFetch(
        "/api/account-preview/" + encodeURIComponent(studentId)
      ).then(function (previewRes) {
        if (
          previewRes.ok &&
          previewRes.data &&
          previewRes.data.account
        ) {
          paintMentionProfile(previewRes.data.account);
          return;
        }

        content.innerHTML =
          '<div class="m-empty">没有找到该用户</div>';
      });
    })
    .catch(function () {
      content.innerHTML =
        '<div class="m-empty">个人主页加载失败</div>';
    });
}

function paintMentionProfile(user) {
  var studentId =
    user.studentId ||
    user.code ||
    "";

  var forumId =
    user.forumId ||
    user.name ||
    studentId ||
    "未命名用户";

  var avatar =
    user.avatar ||
    defaultAvatar(studentId || forumId);

  var signature =
    user.signature ||
    user.desc ||
    "";

  var groups = Array.isArray(user.identityGroups)
    ? user.identityGroups
    : [];

  var groupsHtml = groups.length
    ? '<div class="m-profile-owned-list">' +
        groups.map(function (group) {
          var text =
            typeof group === "object"
              ? (group.text || group.name || "")
              : group;

          var color =
            typeof group === "object" && group.color
              ? group.color
              : "#262626";

          return '<span class="m-profile-owned-tag" style="background:' +
            escapeHtml(color) +
            ';">' +
            escapeHtml(text) +
            '</span>';
        }).join("") +
      '</div>'
    : "";

  content.innerHTML =
    '<div class="m-profile-page-card">' +
      '<div class="m-profile-page-avatar">' +
        '<img src="' + escapeHtml(avatar) + '" ' +
          'style="width:100%;height:100%;border-radius:50%;object-fit:cover;">' +
      '</div>' +

      '<div class="m-profile-page-name-row">' +
        '<span class="m-profile-page-name">' +
          escapeHtml(forumId) +
        '</span>' +
      '</div>' +

      '<div class="m-profile-page-student">' +
        '学号: ' + escapeHtml(studentId || "-") +
      '</div>' +

      (
        signature
          ? '<div class="m-profile-page-bio">' +
              escapeHtml(signature) +
            '</div>'
          : ""
      ) +

      groupsHtml +
    '</div>';
}

var pendingScrollCommentId = null;

function paintThread(t, comments) {
  comments = Array.isArray(comments) ? comments : [];

  var authorName =
    t.author ||
    t.authorForumId ||
    t.authorName ||
    "匿名";

  var authorSid =
    t.authorStudentId ||
    t.studentId ||
    "";

  var authorAvatar =
    t.authorAvatar ||
    defaultAvatar(authorSid || authorName);

  var detailPinnedClass = isThreadPinned(t)
  ? " m-thread-detail-pinned"
  : "";

var detailPinnedMark = "";

  var authorEditedAt =
    t.authorEditedAt ||
    t.author_edited_at ||
    "";

  var authorEdited =
    Number(t.authorEditCount || t.author_edit_count || 0) > 0 &&
    Boolean(authorEditedAt);

  var authorEditedLabel = authorEdited
    ? '<span class="m-thread-edited-label">编辑于</span>'
    : "";

  var authorEditedTime = authorEdited
    ? '<span class="m-thread-edited-time">' +
        formatTime(authorEditedAt) +
      '</span>'
    : "";

  var tags = Array.isArray(t.tags)
    ? t.tags.filter(Boolean)
    : [];

  var tagsHtml = tags.length
    ? '<div class="m-thread-detail-tags">' +
        tags.map(function (tag) {
          return '<span class="m-thread-detail-tag">' +
            escapeHtml(tag) +
          '</span>';
        }).join("") +
      '</div>'
    : "";

  var location =
    t.location ||
    t.postLocation ||
    t.post_location ||
    "";

  var locationHtml = location
    ? '<div class="m-thread-detail-location">' +
        escapeHtml(location) +
      '</div>'
    : "";

  content.innerHTML =
    '<div class="m-thread-detail' + detailPinnedClass + '">' +

      detailPinnedMark +

      '<div class="m-thread-detail-title-row">' +
        '<div class="m-thread-detail-title">' +
          escapeHtml(t.title || "无标题") +
        '</div>' +
      '</div>' +

      '<div class="m-thread-detail-author">' +
        '<img class="m-thread-detail-avatar" src="' +
          escapeHtml(authorAvatar) +
        '">' +

        '<div class="m-thread-detail-author-info">' +

          '<div class="m-thread-detail-author-name-row">' +
            '<div class="m-thread-detail-author-name">' +
              escapeHtml(authorName) +
            '</div>' +
            authorEditedLabel +
          '</div>' +

          '<div class="m-thread-detail-meta">' +
            '<span>' +
              formatTime(t.createdAt || t.created_at || t.time) +
            '</span>' +
            authorEditedTime +
          '</div>' +

        '</div>' +
      '</div>' +

      '<div class="m-thread-detail-content">' +
        escapeHtml(
          t.content ||
          t.body ||
          "（无正文）"
        ).replace(/\n/g, "<br>") +
      '</div>' +

      tagsHtml +
      locationHtml +

      buildActionBar(t) +
    '</div>' +

    '<div class="m-section-title">回复 (' +
      comments.length +
    ')</div>' +

    '<div id="mReplyList">' +
      (
        comments.length
          ? comments.map(function (r) {
              var isSystem = Boolean(
                r.isSystem ||
                r.system_flag
              );

              var rName = isSystem
                ? (
                    r.author ||
                    r.authorForumId ||
                    "诺玛"
                  )
                : (
                    r.author ||
                    r.authorForumId ||
                    r.authorName ||
                    "匿名"
                  );

              var rSid =
                r.authorStudentId ||
                r.studentId ||
                "";

              var rAvatar =
                r.avatar ||
                r.authorAvatar ||
                defaultAvatar(
                  isSystem
                    ? "norma-system"
                    : (rSid || rName)
                );

              var isDeletedComment = Boolean(r.isDeleted || r.is_deleted);

var rText = isDeletedComment
  ? "该评论已删除"
  : (
      r.text != null
        ? r.text
        : (r.content || "")
    );

              var systemBadge = isSystem
                ? '<span class="m-system-badge">' +
                    escapeHtml(
                      r.systemLabel ||
                      r.system_label ||
                      "系统提示"
                    ) +
                  '</span>'
                : "";

              var quoteBlockHtml = "";

var replyTo = r.replyTo || r.reply_to || null;

var replyTargetId =
  (replyTo && (replyTo.id || replyTo.commentId)) ||
  r.replyCommentId ||
  r.reply_comment_id ||
  "";

if (replyTargetId) {
  var quoteAuthor =
    (replyTo && (replyTo.author || replyTo.authorForumId)) ||
    r.replyPreviewAuthor ||
    r.reply_preview_author ||
    "匿名";

  var quoteText =
    replyTo && replyTo.text != null
      ? replyTo.text
      : (
          r.replyPreviewText != null
            ? (r.replyPreviewText || "")
            : (r.reply_preview_text || "")
        );

  var safeQuoteText = String(quoteText).replace(/\n/g, " ");

  quoteBlockHtml =
    '<div ' +
      'class="m-reply-quote" ' +
      'data-quote-comment-id="' +
        escapeHtml(replyTargetId) +
      '">' +
      '<span class="m-reply-quote-author">' +
        escapeHtml(quoteAuthor) +
      '</span>' +
      '<span class="m-reply-quote-text">' +
        escapeHtml(safeQuoteText) +
      '</span>' +
    '</div>';
}

return '<div class="m-reply-item' +
  (isSystem ? ' m-reply-system' : '') +
  '" data-comment-id="' + escapeHtml(r.id) + '">' +
  quoteBlockHtml +


                '<div class="m-reply-header">' +
                  '<div class="m-reply-author-row">' +
                    '<img class="m-reply-avatar" src="' +
                      escapeHtml(rAvatar) +
                    '">' +

                    '<span class="m-reply-author">' +
                      escapeHtml(rName) +
                    '</span>' +

                    systemBadge +
                  '</div>' +

                  '<span class="m-reply-time">' +
                    formatTime(
                      r.createdAt ||
                      r.created_at ||
                      r.time
                    ) +
                  '</span>' +
                '</div>' +

                '<div class="m-reply-content' +
  (isDeletedComment ? ' m-reply-deleted' : '') +
'">' +
  (
    isDeletedComment
      ? escapeHtml(rText)
      : renderCommentText(rText)
  ) +
'</div>' +

buildCommentFooter(r, rSid) +

'</div>';

            }).join("")
          : '<div class="m-empty">暂无回复</div>'
      ) +
    '</div>';

  var detail = content.querySelector(".m-thread-detail");

  if (detail) {
    bindActionBar(detail, t.id);
  }

    loadCommentMentions(content);
  bindCommentActions(content);

  if (pendingScrollCommentId) {
    setTimeout(function () {
      scrollToComment(pendingScrollCommentId);
      pendingScrollCommentId = null;
    }, 200);
  }
}

/* ========== 档案 / 发帖 / 消息 ========== */
function renderArchive() {
  content.innerHTML =
    '<div class="m-section-title">档案馆</div><div class="m-empty">暂未开启</div>' +
    '<div class="m-section-title">收藏库</div><div class="m-empty">暂无收藏</div>';
}

function renderPost() {
  if (!currentAccount || localAuthState.isGuest) {
    hideBottomBar();

    content.innerHTML =
      '<div class="m-card">' +
        '<p>请先登录正式账号后再发帖。</p>' +
      '</div>';

    return;
  }

  showPublishBar();

  content.innerHTML =
    '<div class="m-card m-post-form-card">' +

      '<label class="m-edit-label">选择板块</label>' +
      '<select class="m-edit-input" id="mPostBoard">' +
        '<option value="">正在加载板块...</option>' +
      '</select>' +

      '<label class="m-edit-label">标题</label>' +
      '<input class="m-edit-input" id="mPostTitle" maxlength="100" placeholder="请输入帖子标题">' +

      '<label class="m-edit-label">正文</label>' +
      '<textarea class="m-edit-textarea m-post-content-input" id="mPostContent" placeholder="请输入帖子正文"></textarea>' +

      '<label class="m-edit-label">标签</label>' +
      '<input class="m-edit-input" id="mPostTags" maxlength="100" placeholder="多个标签用逗号隔开">' +

      '<div class="m-post-location-field" id="mPostLocationField" style="display:none;">' +
  '<label class="m-edit-label">位置</label>' +
  '<div class="m-location-picker">' +
    '<input ' +
      'class="m-edit-input m-location-search-input" ' +
      'id="mPostLocation" ' +
      'maxlength="80" ' +
      'autocomplete="off" ' +
      'placeholder="搜索或填写位置">' +
    '<div class="m-location-options" id="mPostLocationOptions"></div>' +
  '</div>' +
'</div>' +

    '</div>';

  loadPostBoards();
bindPostLocationPicker();

  if (bottomPublishBtn) {
    bottomPublishBtn.disabled = false;
    bottomPublishBtn.textContent = "发布帖子";
    bottomPublishBtn.onclick = submitMobilePost;
  }
}

function loadPostBoards() {
  var select = document.getElementById("mPostBoard");

  if (!select) return;

  mFetch("/api/boards")
    .then(function (res) {
      var boards =
        res.data && Array.isArray(res.data.boards)
          ? res.data.boards
          : [];

      if (!res.ok || boards.length === 0) {
        select.innerHTML =
          '<option value="">没有可用板块</option>';

        updatePostLocationAvailability();
        return;
      }

      var allowedBoards = boards.filter(function (board) {
        return board.canCurrentUserPost !== false;
      });

      if (allowedBoards.length === 0) {
        select.innerHTML =
          '<option value="">当前账号没有发帖权限</option>';

        updatePostLocationAvailability();
        return;
      }

      select.innerHTML =
        '<option value="">请选择板块</option>' +
        allowedBoards.map(function (board) {
          var boardType =
            board.boardType ||
            board.board_type ||
            "";

          return (
            '<option ' +
              'value="' + escapeHtml(board.slug) + '" ' +
              'data-board-type="' +
                escapeHtml(boardType) +
              '">' +
              escapeHtml(board.name) +
            '</option>'
          );
        }).join("");

      if (
        currentBoardContext &&
        currentBoardContext.slug
      ) {
        var wantedSlug =
          String(currentBoardContext.slug);

        var canSelectCurrentBoard =
          allowedBoards.some(function (board) {
            return String(board.slug) === wantedSlug;
          });

        if (canSelectCurrentBoard) {
          select.value = wantedSlug;
        }
      }

      select.addEventListener(
        "change",
        updatePostLocationAvailability
      );

      updatePostLocationAvailability();
    })
    .catch(function () {
      select.innerHTML =
        '<option value="">板块加载失败</option>';

      updatePostLocationAvailability();
    });
}

function updatePostLocationAvailability() {
  var boardSelect =
    document.getElementById("mPostBoard");

  var locationField =
    document.getElementById("mPostLocationField");

  var locationInput =
    document.getElementById("mPostLocation");

  var locationOptions =
    document.getElementById("mPostLocationOptions");

  if (
    !boardSelect ||
    !locationField ||
    !locationInput
  ) {
    return;
  }

  var selectedOption =
    boardSelect.options[boardSelect.selectedIndex];

  var boardType = selectedOption
    ? String(
        selectedOption.getAttribute("data-board-type") ||
        ""
      )
    : "";

  var isStoryBoard =
    /story|剧情/i.test(boardType);

  if (isStoryBoard) {
    locationField.style.display = "block";
    locationInput.disabled = false;
    return;
  }

  locationField.style.display = "none";
  locationInput.disabled = true;
  locationInput.value = "";

  if (locationOptions) {
    locationOptions.innerHTML = "";
    locationOptions.classList.remove("show");
  }
}

/* ========== 发帖位置搜索和选择 ========== */
function bindPostLocationPicker() {
  var input = document.getElementById("mPostLocation");
  var optionsBox = document.getElementById("mPostLocationOptions");

  if (!input || !optionsBox) return;

  var allLocations = [];
  var locationLoaded = false;

  function hideOptionsLater() {
    setTimeout(function () {
      optionsBox.classList.remove("show");
    }, 180);
  }

  function renderLocationOptions() {
    var keyword = input.value.trim();
    var lowerKeyword = keyword.toLowerCase();

    var matchedLocations = allLocations.filter(function (location) {
      return String(location.name || "")
        .toLowerCase()
        .indexOf(lowerKeyword) !== -1;
    });

    var exactLocation = allLocations.some(function (location) {
      return String(location.name || "").toLowerCase() === lowerKeyword;
    });

    var html = "";

    matchedLocations.slice(0, 30).forEach(function (location) {
      html +=
        '<button ' +
          'type="button" ' +
          'class="m-location-option" ' +
          'data-location-name="' + escapeHtml(location.name) + '">' +
          '<span class="m-location-option-name">' +
            escapeHtml(location.name) +
          '</span>' +
        '</button>';
    });

    if (keyword && !exactLocation) {
      html +=
        '<button ' +
          'type="button" ' +
          'class="m-location-option m-location-custom-option" ' +
          'data-location-name="' + escapeHtml(keyword) + '">' +
          '<span class="m-location-option-name">' +
            '使用“' + escapeHtml(keyword) + '”' +
          '</span>' +
        '</button>';
    }

    if (!html && !keyword) {
      html =
        '<div class="m-location-empty">' +
          (
            locationLoaded
              ? "暂时没有可选位置"
              : "正在读取位置..."
          ) +
        '</div>';
    }

    optionsBox.innerHTML = html;
    optionsBox.classList.add("show");
  }

  optionsBox.addEventListener("click", function (event) {
    var option = event.target.closest(".m-location-option");

    if (!option) return;

    var locationName = option.getAttribute("data-location-name") || "";

    input.value = locationName;
    optionsBox.classList.remove("show");
    input.focus();
  });

  input.addEventListener("focus", function () {
    renderLocationOptions();
  });

  input.addEventListener("input", function () {
    renderLocationOptions();
  });

  input.addEventListener("blur", hideOptionsLater);

  mFetch("/api/locations")
    .then(function (res) {
      if (
        res.ok &&
        res.data &&
        Array.isArray(res.data.locations)
      ) {
        allLocations = res.data.locations;
      } else {
        allLocations = [];
      }

      locationLoaded = true;

      if (document.activeElement === input) {
        renderLocationOptions();
      }
    })
    .catch(function () {
      allLocations = [];
      locationLoaded = true;

      if (document.activeElement === input) {
        renderLocationOptions();
      }
    });
}

function submitMobilePost() {
  var boardSelect = document.getElementById("mPostBoard");
  var titleInput = document.getElementById("mPostTitle");
  var contentInput = document.getElementById("mPostContent");
  var tagsInput = document.getElementById("mPostTags");
  var locationInput = document.getElementById("mPostLocation");
  var submitBtn = document.getElementById("mPostSubmit");

  if (!boardSelect || !titleInput || !contentInput) return;

  var boardSlug = boardSelect.value.trim();
var title = titleInput.value.trim();
var postContent = contentInput.value.trim();

var selectedBoardOption =
  boardSelect.options[boardSelect.selectedIndex];

var selectedBoardType = selectedBoardOption
  ? String(
      selectedBoardOption.getAttribute("data-board-type") ||
      ""
    )
  : "";

var canUseLocation =
  /story|剧情/i.test(selectedBoardType);

var location =
  canUseLocation && locationInput
    ? locationInput.value.trim()
    : "";

  var tags = tagsInput
    ? tagsInput.value
        .split(/[,，]/)
        .map(function (tag) {
          return tag.trim();
        })
        .filter(Boolean)
        .slice(0, 10)
    : [];

  if (!boardSlug) {
    alert("请选择板块");
    return;
  }

  if (!title) {
    alert("请输入标题");
    return;
  }

  if (!postContent) {
    alert("请输入正文");
    return;
  }

  if (!currentAccount || !currentAccount.studentId) {
    alert("请先登录");
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.textContent = "发布中";
  }

  mFetch("/api/boards/" + encodeURIComponent(boardSlug) + "/threads", {
    method: "POST",
    body: JSON.stringify({
      title: title,
      content: postContent,
      summary: "",
      postType: "normal",
      tags: tags,
      location: location,
      authorStudentId: currentAccount.studentId,
      authorForumId: currentAccount.name || currentAccount.studentId
    })
  })
    .then(function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        alert((res.data && res.data.message) || "发帖失败");
        return;
      }

      var newThread = res.data.thread;

      if (newThread && newThread.id) {
        renderThreadPage(newThread.id, boardSlug);
      } else {
        switchTab("home");
      }
    })
    .catch(function () {
      alert("请求失败");
    })
    .finally(function () {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = "发布帖子";
      }
    });
}

function renderMessage() {
  currentChatContact = null;
  currentChatId = null;

  headerTitle.textContent = "消息";
  showSearchOnly();
  showTabBar();
  showThemeButton();

  if (!currentAccount || localAuthState.isGuest) {
    content.innerHTML =
      '<div class="m-empty">登录后可查看好友和消息</div>';
    return;
  }

  // 不要一直写“加载中”，避免闪烁
  content.innerHTML =
    '<div class="m-section-title">好友</div>' +
    '<div id="mFriendList" class="m-friend-strip"></div>' +
    '<div class="m-section-title">最近聊天</div>' +
    '<div id="mChatList"></div>';

  // 有缓存就先直接显示
  if (mFriendsCache && mFriendsCache.length) {
    paintMobileFriendList(mFriendsCache);
  } else {
    mFriendsCache = [M_NORMA_CONTACT];
    paintMobileFriendList(mFriendsCache);
  }

  loadMobilePrivateChats();
  paintMobileChatList();

  // 后台静默更新好友，不反复刷整页
  loadMobileFriendsAndChats(true);
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
  showBackOnly();
  hideBottomBar();
  showThemeButton();

  if (!currentAccount || localAuthState.isGuest) {
    content.innerHTML = '<div class="m-empty">请先登录正式账号</div>';
    return;
  }

  paintProfilePage(currentAccount);

  // 再静默刷新一次最新资料
  fetchMe().then(function () {
    if (headerTitle && headerTitle.textContent === "个人主页") {
      paintProfilePage(currentAccount);
    }
  });
}

function paintProfilePage(me) {
  if (!me) return;

  var wearing = me.wearingGroup || me.displayGroup || "";
  if (wearing && typeof wearing === "object") {
    wearing = wearing.text || wearing.name || "";
  }

  if (!wearing && me.identityGroups && me.identityGroups[0]) {
    var g0 = me.identityGroups[0];
    wearing = typeof g0 === "object" ? (g0.text || g0.name || "") : g0;
  }

  var groups = me.identityGroups || [];
  var ownedHtml = "";

  if (groups.length) {
    ownedHtml =
      '<div class="m-profile-owned-wrap">' +
        '<div class="m-profile-owned-title">拥有的身份组</div>' +
        '<div class="m-profile-owned-list">' +
          groups.map(function (g) {
            var text = typeof g === "object" ? (g.text || g.name || "") : g;
            var color = (typeof g === "object" && g.color) ? g.color : "#262626";
            return (
              '<span class="m-profile-owned-tag" style="background:' + color + ';">' +
                escapeHtml(text) +
              '</span>'
            );
          }).join("") +
        '</div>' +
      '</div>';
  } else {
    ownedHtml =
      '<div class="m-profile-owned-wrap">' +
        '<div class="m-profile-owned-title">拥有的身份组</div>' +
        '<div class="m-empty" style="padding:8px 0 0;">暂无身份组</div>' +
      '</div>';
  }

  content.innerHTML =
    '<div class="m-profile-page-card">' +
      '<button type="button" class="m-profile-page-avatar" id="mProfileAvatarBtn">' +
        '<img src="' + escapeHtml(me.avatar || defaultAvatar(me.studentId)) + '" ' +
          'style="width:100%;height:100%;border-radius:50%;object-fit:cover;">' +
        '<div class="m-profile-avatar-tip">点击更换</div>' +
      '</button>' +

      '<div class="m-profile-page-name-row">' +
        '<span class="m-profile-page-name">' +
          escapeHtml(me.name || me.studentId) +
        '</span>' +
        '<button type="button" class="m-profile-page-wearing" id="mProfileWearBtn">' +
          escapeHtml(wearing || "选择佩戴") +
        '</button>' +
      '</div>' +

      '<div class="m-profile-page-student">学号: ' +
        escapeHtml(me.studentId || "-") +
      '</div>' +

      '<div class="m-profile-page-bio">' +
        escapeHtml(me.signature || "这个人很懒，什么都没写。") +
      '</div>' +

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

  var avatarBtn = document.getElementById("mProfileAvatarBtn");
  if (avatarBtn) {
    avatarBtn.addEventListener("click", function () {
      showAvatarChangeSheet();
    });
  }

  var wearBtn = document.getElementById("mProfileWearBtn");
  if (wearBtn) {
    wearBtn.addEventListener("click", function () {
      showWearGroupSheet();
    });
  }
}

/* ========== 换头像 ========== */
function showAvatarChangeSheet() {
  var old = document.getElementById("mAvatarSheetOverlay");
  if (old) old.remove();

  var overlay = document.createElement("div");
  overlay.id = "mAvatarSheetOverlay";
  overlay.className = "m-sheet-overlay";

  overlay.innerHTML =
    '<div class="m-comment-sheet">' +
      '<button class="m-sheet-item" data-act="link">链接上传头像</button>' +
      '<button class="m-sheet-item" data-act="local">本地上传头像</button>' +
      '<button class="m-sheet-item" data-act="frame">更换头像框（占位）</button>' +
      '<button class="m-sheet-item cancel" data-act="close">取消</button>' +
      '<input id="mAvatarFileInput" type="file" accept="image/*" style="display:none;">' +
    '</div>';

  document.body.appendChild(overlay);

  var fileInput = document.getElementById("mAvatarFileInput");

  overlay.querySelectorAll(".m-sheet-item").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var act = btn.getAttribute("data-act");

      if (act === "close") {
        overlay.remove();
        return;
      }

      if (act === "frame") {
        alert("头像框功能稍后完善，这里先占位。");
        return;
      }

      if (act === "link") {
        overlay.remove();
        changeAvatarByLink();
        return;
      }

      if (act === "local") {
        if (fileInput) fileInput.click();
      }
    });
  });

  if (fileInput) {
    fileInput.addEventListener("change", function () {
      var file = fileInput.files && fileInput.files[0];
      overlay.remove();
      if (!file) return;
      changeAvatarByLocalFile(file);
    });
  }

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) overlay.remove();
  });
}

function changeAvatarByLink() {
  var url = prompt("请输入头像图片链接：", currentAccount.avatar || "");
  if (url === null) return;

  url = String(url || "").trim();
  if (!url) {
    alert("链接不能为空");
    return;
  }

  saveAvatarToServer(url);
}

function changeAvatarByLocalFile(file) {
  if (!file) return;

  if (!/^image\//.test(file.type || "")) {
    alert("请选择图片文件");
    return;
  }

  // 本地太大就提示
  if (file.size > 2 * 1024 * 1024) {
    alert("图片太大了，请选择 2MB 以内的图片，或改用图片链接。");
    return;
  }

  var reader = new FileReader();

  reader.onload = function () {
    var dataUrl = String(reader.result || "");

    if (!dataUrl) {
      alert("读取图片失败");
      return;
    }

    // 后端目前不接收 base64，所以本地先保存到本机，并立即显示
    try {
      localStorage.setItem(
        "cassell_local_avatar_" + String(currentAccount.studentId || "").toUpperCase(),
        dataUrl
      );
    } catch (e) {
      alert("本地保存失败，可能是图片太大。请改用链接上传。");
      return;
    }

    currentAccount.avatar = dataUrl;
    paintProfilePage(currentAccount);
    alert("本地头像已更换。注意：本地上传目前只保存在这台设备。若要全端同步，请用链接上传。");
  };

  reader.onerror = function () {
    alert("读取图片失败");
  };

  reader.readAsDataURL(file);
}

function saveAvatarToServer(avatarUrl) {
  mFetch("/api/account-preferences", {
    method: "POST",
    body: JSON.stringify({
      avatar: avatarUrl,
      userStatus: "online"
    })
  })
    .then(function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        alert((res.data && res.data.message) || "头像保存失败");
        return;
      }

      // 清掉本地覆盖，改用服务器头像
      try {
        localStorage.removeItem(
          "cassell_local_avatar_" + String(currentAccount.studentId || "").toUpperCase()
        );
      } catch (e) {}

      if (res.data.user) {
        currentAccount = accountFromUser(res.data.user);
      } else {
        currentAccount.avatar = avatarUrl;
      }

      paintProfilePage(currentAccount);
      alert("头像已更新");
    })
    .catch(function () {
      alert("请求失败");
    });
}

/* ========== 佩戴身份组 ========== */
function showWearGroupSheet() {
  if (!currentAccount) return;

  var groups = currentAccount.identityGroups || [];
  var options = currentAccount.displayGroupOptions || [];

  // 可佩戴列表：先用身份组，再补上展示选项
  var wearList = [];

  groups.forEach(function (g) {
    var text = typeof g === "object" ? (g.text || g.name || "") : String(g || "");
    text = String(text || "").trim();
    if (text && wearList.indexOf(text) === -1) {
      wearList.push(text);
    }
  });

  options.forEach(function (opt) {
    var text =
      (opt && (opt.value || opt.label || opt.name || opt.text)) || "";
    text = String(text || "").trim();
    if (text && wearList.indexOf(text) === -1) {
      wearList.push(text);
    }
  });

  if (!wearList.length) {
    alert("当前没有可佩戴的身份组");
    return;
  }

  var old = document.getElementById("mWearSheetOverlay");
  if (old) old.remove();

  var currentWear =
    currentAccount.wearingGroup ||
    currentAccount.displayGroup ||
    "";

  if (currentWear && typeof currentWear === "object") {
    currentWear = currentWear.text || currentWear.name || "";
  }

  var overlay = document.createElement("div");
  overlay.id = "mWearSheetOverlay";
  overlay.className = "m-sheet-overlay";

  var itemsHtml = wearList.map(function (name) {
    var active = String(name) === String(currentWear);
    return (
      '<button class="m-sheet-item' + (active ? ' active-wear' : '') + '" data-wear="' +
        escapeHtml(name) +
      '">' +
        escapeHtml(name) +
        (active ? '（当前）' : '') +
      '</button>'
    );
  }).join("");

  overlay.innerHTML =
    '<div class="m-comment-sheet">' +
      '<div class="m-sheet-title">选择佩戴的身份组</div>' +
      itemsHtml +
      '<button class="m-sheet-item cancel" data-wear="">取消</button>' +
    '</div>';

  document.body.appendChild(overlay);

  overlay.querySelectorAll(".m-sheet-item").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var wear = btn.getAttribute("data-wear");
      overlay.remove();

      if (!wear) return;
      saveWearingGroup(wear);
    });
  });

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) overlay.remove();
  });
}

function saveWearingGroup(displayGroup) {
  if (!currentAccount) return;

  mFetch("/api/profile", {
    method: "POST",
    body: JSON.stringify({
      forumId: currentAccount.name || currentAccount.studentId,
      gender: "未设定",
      signature: currentAccount.signature || "这个人很懒，什么都没写。",
      identityType: "student",
      identityGroups: currentAccount.identityGroups || [],
      displayGroup: displayGroup
    })
  })
    .then(function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        alert((res.data && res.data.message) || "佩戴失败");
        return;
      }

      if (res.data.user) {
        currentAccount = accountFromUser(res.data.user);
      } else {
        currentAccount.wearingGroup = displayGroup;
        currentAccount.displayGroup = displayGroup;
      }

      paintProfilePage(currentAccount);
      alert("已佩戴：" + displayGroup);
    })
    .catch(function () {
      alert("请求失败");
    });
}

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

function editThreadTitleByAdmin() {
  if (!currentThreadData || !currentThreadData.id) return;

  var newTitle = prompt(
    "修改标题",
    currentThreadData.title || ""
  );

  if (newTitle === null) return;

  newTitle = newTitle.trim();

  if (!newTitle) {
    alert("标题不能为空");
    return;
  }

  mFetch(
    "/api/threads/" +
      encodeURIComponent(currentThreadData.id) +
      "/title",
    {
      method: "PUT",
      body: JSON.stringify({
        title: newTitle
      })
    }
  )
    .then(function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        alert(
          (res.data && res.data.message) ||
          "标题修改失败"
        );
        return null;
      }

      return mFetch(
        "/api/threads/" +
          encodeURIComponent(currentThreadData.id)
      );
    })
    .then(function (detailRes) {
      if (!detailRes) return;

      if (
        detailRes.ok &&
        detailRes.data &&
        detailRes.data.thread
      ) {
        currentThreadData = detailRes.data.thread;

        var comments = Array.isArray(
          currentThreadData.comments
        )
          ? currentThreadData.comments
          : [];

        currentThreadData.comments = comments;
        paintThread(currentThreadData, comments);
        alert("标题修改成功");
      }
    })
    .catch(function () {
      alert("请求失败");
    });
}

function closeEditModal() {
  var sheet = document.getElementById("mEditSheet");
  var overlay = document.getElementById("mEditOverlay");
  if (sheet) sheet.classList.remove("show");
  setTimeout(function () { if (overlay) overlay.remove(); }, 300);
}

function saveThreadEdit(newTitle, newContent) {
  if (!currentThreadData || !currentThreadData.id) {
    alert("帖子信息还没加载好");
    return;
  }

  mFetch(
    "/api/threads/" +
      encodeURIComponent(currentThreadData.id) +
      "/edit",
    {
      method: "PUT",
      body: JSON.stringify({
        title: newTitle,
        content: newContent
      })
    }
  )
    .then(function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        alert(
          (res.data && res.data.message) ||
          "编辑失败"
        );
        return null;
      }

      return mFetch(
        "/api/threads/" +
          encodeURIComponent(currentThreadData.id)
      );
    })
    .then(function (detailRes) {
      if (!detailRes) return;

      if (
        detailRes.ok &&
        detailRes.data &&
        detailRes.data.thread
      ) {
        currentThreadData = detailRes.data.thread;

        var comments = Array.isArray(
          currentThreadData.comments
        )
          ? currentThreadData.comments
          : [];

        currentThreadData.comments = comments;

        closeEditModal();
        paintThread(currentThreadData, comments);
        alert("编辑成功");
      }
    })
    .catch(function () {
      alert("请求失败");
    });
}

/* ========== 手机版发送评论 ========== */
function sendMobileReply() {
  var input = document.getElementById("mReplyInput");
  var sendBtn = document.getElementById("mReplySendBtn");

  if (!input) return;

  if (!currentThreadData || !currentThreadData.id) {
    alert("帖子还没有加载完成");
    return;
  }

  var replyContent = input.value.trim();

  if (!replyContent) {
    alert("请输入回复内容");
    return;
  }

  if (!currentAccount || !currentAccount.studentId) {
    alert("请先登录");
    return;
  }

  if (sendBtn) {
    sendBtn.disabled = true;
    sendBtn.textContent = "发送中";
  }

  mFetch(
    "/api/threads/" +
      encodeURIComponent(currentThreadData.id) +
      "/comments",
    {
      method: "POST",
      body: JSON.stringify({
  content: replyContent,
  replyCommentId:
    replyQuoteState && replyQuoteState.commentId
      ? replyQuoteState.commentId
      : null,
  authorStudentId: currentAccount.studentId,
  authorForumId: currentAccount.name || currentAccount.studentId
})

    }
  )
    .then(function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        alert((res.data && res.data.message) || "回复失败");
        return null;
      }

      input.value = "";
      replyQuoteState = null;

      var replyInput2 = document.getElementById("mReplyInput");
      if (replyInput2) {
        replyInput2.setAttribute(
          "placeholder",
          "写下你的回复..."
        );
      }

      return mFetch(
        "/api/threads/" +
          encodeURIComponent(currentThreadData.id)
      );
    })
    .then(function (res) {
      if (
        res &&
        res.ok &&
        res.data &&
        res.data.thread
      ) {
        currentThreadData = res.data.thread;

        var comments = Array.isArray(currentThreadData.comments)
          ? currentThreadData.comments
          : [];

        currentThreadData.comments = comments;
        paintThread(currentThreadData, comments);
      }
    })
    .catch(function () {
      alert("请求失败");
    })
    .finally(function () {
      if (sendBtn) {
        sendBtn.disabled = false;
        sendBtn.textContent = "发送";
      }
    });
}

/* ========== 绑定评论发送按钮 ========== */
var mobileReplySendBtn = document.getElementById("mReplySendBtn");
var mobileReplyInput = document.getElementById("mReplyInput");

if (mobileReplySendBtn) {
  mobileReplySendBtn.addEventListener("click", sendMobileReply);
}

if (mobileReplyInput) {
  mobileReplyInput.addEventListener("keydown", function (event) {
    if (event.key === "Enter") {
      event.preventDefault();
      sendMobileReply();
    }
  });
}

/* ========== 从分享链接自动定位评论 ========== */
(function () {
  var params = new URLSearchParams(window.location.search);
  var threadId = params.get("thread");
  var commentId = params.get("comment");

  if (!threadId) return;

  if (commentId) {
    pendingScrollCommentId = commentId;
  }

  var tryOpenSharedThread = function (retryCount) {
    if (typeof renderThreadPage !== "function") {
      if (retryCount > 0) {
        setTimeout(function () {
          tryOpenSharedThread(retryCount - 1);
        }, 300);
      }
      return;
    }

    if (String(currentThreadId || "") === String(threadId)) {
      if (pendingScrollCommentId) {
        setTimeout(function () {
          scrollToComment(pendingScrollCommentId);
          pendingScrollCommentId = null;
        }, 200);
      }
      return;
    }

    renderThreadPage(threadId);
  };

  setTimeout(function () {
    tryOpenSharedThread(8);
  }, 400);
})();

/* ==========================================================
   手机版好友 / 聊天 / 诺玛
   ========================================================== */

function getMobilePrivateChatStorageKey() {
  var sid =
    (currentAccount && currentAccount.studentId) ||
    localAuthState.studentId ||
    "guest";

  return "cassell_private_chats_v1_" + String(sid).toUpperCase();
}

function loadMobilePrivateChats() {
  try {
    var raw = localStorage.getItem(getMobilePrivateChatStorageKey());
    mPrivateChats = raw ? JSON.parse(raw) : [];
    if (!Array.isArray(mPrivateChats)) mPrivateChats = [];
  } catch (e) {
    mPrivateChats = [];
  }
}

function saveMobilePrivateChats() {
  try {
    localStorage.setItem(
      getMobilePrivateChatStorageKey(),
      JSON.stringify(mPrivateChats)
    );
  } catch (e) {}
}

function getContactKey(contact) {
  return String(
    (contact && (contact.studentId || contact.code || contact.forumId || contact.name)) ||
    ""
  )
    .trim()
    .toUpperCase();
}

function findMobileChatByContact(contact) {
  var key = getContactKey(contact);

  return (
    mPrivateChats.find(function (chat) {
      var chatKey = getContactKey(chat);
      return chatKey && chatKey === key;
    }) || null
  );
}

function createMobileChatFromContact(contact) {
  var chat = {
    id: "chat-" + getContactKey(contact) + "-" + Date.now(),
    studentId: contact.studentId || contact.code || "",
    code: contact.studentId || contact.code || "",
    name: contact.name || contact.forumId || "好友",
    forumId: contact.forumId || contact.name || "好友",
    avatar: contact.avatar || defaultAvatar(contact.studentId || contact.name || "friend"),
    accountKind: contact.accountKind || "user",
    signature: contact.signature || "",
    status: contact.status || "offline",
    messages: [],
    updatedAt: Date.now()
  };

  mPrivateChats.unshift(chat);
  saveMobilePrivateChats();
  return chat;
}

function ensureMobileChat(contact) {
  return findMobileChatByContact(contact) || createMobileChatFromContact(contact);
}

function getLastMessagePreview(chat) {
  if (!chat || !Array.isArray(chat.messages) || !chat.messages.length) {
    return "暂无消息";
  }

  var last = chat.messages[chat.messages.length - 1];
  var text = String(last.text || last.content || "").trim();

  if (!text) return "暂无消息";
  if (text.length > 28) return text.slice(0, 28) + "...";
  return text;
}

function loadMobileFriendsAndChats(silent) {
  loadMobilePrivateChats();

  // 防止重复请求导致页面一直闪
  if (mFriendsLoading) {
    paintMobileChatList();
    return;
  }

  mFriendsLoading = true;

  // 静默更新时不要先清空页面
  if (!silent) {
    if (!mFriendsCache.length) {
      mFriendsCache = [M_NORMA_CONTACT];
    }
    paintMobileFriendList(mFriendsCache);
    paintMobileChatList();
  }

  mFetch("/api/social/friends")
    .then(function (res) {
      var friends =
        res.data && Array.isArray(res.data.friends)
          ? res.data.friends
          : [];

      var realFriends = friends
        .map(function (item) {
          return {
            studentId: item.studentId || item.code || "",
            name: item.forumId || item.name || item.studentId || "好友",
            forumId: item.forumId || item.name || item.studentId || "好友",
            avatar: item.avatar || defaultAvatar(item.studentId || item.name || "friend"),
            signature: item.signature || item.desc || "",
            accountKind: "user",
            status: item.userStatus || item.status || "offline"
          };
        })
        .filter(function (item) {
          return String(item.studentId || "").toUpperCase() !== "AI000000";
        });

      mFriendsCache = [M_NORMA_CONTACT].concat(realFriends);
      mFriendsLoadedOnce = true;

      // 只有还在消息页时才重绘
      if (currentTab === "message" && !currentChatContact) {
        paintMobileFriendList(mFriendsCache);
        paintMobileChatList();
      }
    })
    .catch(function () {
      if (!mFriendsCache.length) {
        mFriendsCache = [M_NORMA_CONTACT];
      }

      if (currentTab === "message" && !currentChatContact) {
        paintMobileFriendList(mFriendsCache);
        paintMobileChatList();
      }
    })
    .finally(function () {
      mFriendsLoading = false;
    });
}

function paintMobileFriendList(friends) {
  var box = document.getElementById("mFriendList");
  if (!box) return;

  if (!friends || !friends.length) {
    box.innerHTML = '<div class="m-empty">暂无好友</div>';
    return;
  }

  box.className = "m-friend-strip";

  box.innerHTML = friends
    .map(function (friend, index) {
      return (
        '<button type="button" class="m-friend-avatar-item" data-friend-index="' + index + '">' +
          '<img class="m-friend-avatar-only" src="' +
            escapeHtml(friend.avatar || defaultAvatar(friend.studentId || friend.name)) +
          '">' +
          '<div class="m-friend-id-only">' +
            escapeHtml(friend.forumId || friend.name || "好友") +
          '</div>' +
        '</button>'
      );
    })
    .join("");

  box.querySelectorAll(".m-friend-avatar-item").forEach(function (el) {
    el.addEventListener("click", function () {
      var index = Number(el.getAttribute("data-friend-index"));
      var friend = mFriendsCache[index];
      if (friend) openMobileChat(friend);
    });
  });
}

function paintMobileChatList() {
  var box = document.getElementById("mChatList");
  if (!box) return;

  loadMobilePrivateChats();

  if (!mPrivateChats.length) {
    box.innerHTML = '<div class="m-empty">还没有聊天，先点上面的好友开始</div>';
    return;
  }

  var sorted = mPrivateChats.slice().sort(function (a, b) {
    return Number(b.updatedAt || 0) - Number(a.updatedAt || 0);
  });

  box.innerHTML = sorted
    .map(function (chat, index) {
      return (
        '<div class="m-chat-item" data-chat-index="' + index + '">' +
          '<img class="m-chat-list-avatar" src="' +
            escapeHtml(chat.avatar || defaultAvatar(chat.studentId || chat.name)) +
          '">' +
          '<div class="m-chat-list-info">' +
            '<div class="m-chat-list-name">' +
              escapeHtml(chat.forumId || chat.name || "好友") +
            '</div>' +
            '<div class="m-chat-list-preview">' +
              escapeHtml(getLastMessagePreview(chat)) +
            '</div>' +
          '</div>' +
        '</div>'
      );
    })
    .join("");

  box.querySelectorAll(".m-chat-item").forEach(function (el) {
    el.addEventListener("click", function () {
      var index = Number(el.getAttribute("data-chat-index"));
      var chat = sorted[index];
      if (!chat) return;

      openMobileChat({
        studentId: chat.studentId || chat.code || "",
        name: chat.name,
        forumId: chat.forumId,
        avatar: chat.avatar,
        accountKind: chat.accountKind,
        signature: chat.signature || ""
      });
    });
  });
}

function openMobileChat(contact) {
  if (!currentAccount || localAuthState.isGuest) {
    alert("请先登录正式账号");
    return;
  }

  // 避免重复点同一个人时，返回历史叠很多层
  var last = pageHistory[pageHistory.length - 1];
  if (!last || last.type !== "message") {
    pageHistory.push({ type: "message" });
  }

  currentChatContact = contact;
  var chat = ensureMobileChat(contact);
  currentChatId = chat.id;

  headerTitle.textContent = contact.forumId || contact.name || "聊天";
  showBackOnly();
  showChatBar();
  showChatMenuButton(contact, chat);

  paintMobileChatPage(chat);

  if (chatSendBtn) {
    chatSendBtn.onclick = sendMobileChatMessage;
  }

  if (chatInput) {
    chatInput.value = "";
    chatInput.onkeydown = function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        sendMobileChatMessage();
      }
    };
  }
}

function showChatMenuButton(contact, chat) {
  if (!themeToggleBtn) return;

  themeToggleBtn.style.display = "flex";
  themeToggleBtn.innerHTML =
    '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor">' +
      '<circle cx="5" cy="12" r="2"></circle>' +
      '<circle cx="12" cy="12" r="2"></circle>' +
      '<circle cx="19" cy="12" r="2"></circle>' +
    '</svg>';

  themeToggleBtn.onclick = function () {
    showMobileChatMenu(contact, chat);
  };
}

function showMobileChatMenu(contact, chat) {
  var old = document.getElementById("mChatMenuOverlay");
  if (old) old.remove();

  var overlay = document.createElement("div");
  overlay.id = "mChatMenuOverlay";
  overlay.className = "m-sheet-overlay";

  overlay.innerHTML =
    '<div class="m-comment-sheet">' +
      '<button class="m-sheet-item" data-act="profile">查看主页</button>' +
      '<button class="m-sheet-item" data-act="clear">清空聊天记录</button>' +
      '<button class="m-sheet-item cancel" data-act="close">取消</button>' +
    '</div>';

  document.body.appendChild(overlay);

  overlay.querySelectorAll(".m-sheet-item").forEach(function (btn) {
    btn.addEventListener("click", function () {
      var act = btn.getAttribute("data-act");
      overlay.remove();

      if (act === "profile") {
        var sid = contact.studentId || contact.code || "";
        if (sid) renderMentionProfilePage(sid);
      }

      if (act === "clear") {
        if (!confirm("确定清空和对方的聊天记录吗？")) return;
        chat.messages = [];
        chat.updatedAt = Date.now();
        saveMobilePrivateChats();
        paintMobileChatPage(chat);
      }
    });
  });

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) overlay.remove();
  });
}

function paintMobileChatPage(chat) {
  var messages = Array.isArray(chat.messages) ? chat.messages : [];

  var myAvatar =
    (currentAccount && currentAccount.avatar) ||
    defaultAvatar((currentAccount && currentAccount.studentId) || "me");

  var otherAvatar =
    (currentChatContact && currentChatContact.avatar) ||
    chat.avatar ||
    defaultAvatar(chat.studentId || chat.name || "friend");

  content.innerHTML =
    '<div class="m-chat-page" id="mChatPage">' +
      '<div class="m-chat-messages" id="mChatMessages">' +
        (
          messages.length
            ? messages.map(function (msg) {
                return buildMobileChatBubbleHtml(msg, myAvatar, otherAvatar);
              }).join("")
            : '<div class="m-empty">还没有消息，先打个招呼吧</div>'
        ) +
      '</div>' +
    '</div>';

  var box = document.getElementById("mChatMessages");
  if (box) {
    box.scrollTop = box.scrollHeight;
  }
}

function buildMobileChatBubbleHtml(msg, myAvatar, otherAvatar) {
  var side = msg.side === "me" ? "me" : "other";
  var avatar = side === "me" ? myAvatar : otherAvatar;
  var timeText = formatChatTime(msg.createdAt || msg.time || Date.now());

  return (
    '<div class="m-chat-bubble-row ' + side + '">' +
      (
        side === "other"
          ? '<img class="m-chat-msg-avatar" src="' + escapeHtml(avatar) + '">'
          : ""
      ) +
      '<div class="m-chat-bubble-wrap">' +
        '<div class="m-chat-bubble">' +
          escapeHtml(msg.text || msg.content || "") +
        '</div>' +
        '<div class="m-chat-time">' +
          escapeHtml(timeText) +
        '</div>' +
      '</div>' +
      (
        side === "me"
          ? '<img class="m-chat-msg-avatar" src="' + escapeHtml(avatar) + '">'
          : ""
      ) +
    '</div>'
  );
}

function formatChatTime(t) {
  var d = new Date(t);
  if (isNaN(d.getTime())) return "";

  var now = new Date();
  var hh = String(d.getHours()).padStart(2, "0");
  var mm = String(d.getMinutes()).padStart(2, "0");
  var timePart = hh + ":" + mm;

  var sameDay =
    d.getFullYear() === now.getFullYear() &&
    d.getMonth() === now.getMonth() &&
    d.getDate() === now.getDate();

  if (sameDay) return timePart;

  var mon = String(d.getMonth() + 1).padStart(2, "0");
  var day = String(d.getDate()).padStart(2, "0");
  return mon + "-" + day + " " + timePart;
}

function appendMobileChatBubble(side, text, createdAt) {
  var box = document.getElementById("mChatMessages");
  if (!box) return;

  var empty = box.querySelector(".m-empty");
  if (empty) empty.remove();

  var myAvatar =
    (currentAccount && currentAccount.avatar) ||
    defaultAvatar((currentAccount && currentAccount.studentId) || "me");

  var otherAvatar =
    (currentChatContact && currentChatContact.avatar) ||
    defaultAvatar(
      (currentChatContact && (currentChatContact.studentId || currentChatContact.name)) ||
      "friend"
    );

  var temp = document.createElement("div");
  temp.innerHTML = buildMobileChatBubbleHtml(
    {
      side: side,
      text: text,
      createdAt: createdAt || new Date().toISOString()
    },
    myAvatar,
    otherAvatar
  );

  if (temp.firstChild) {
    box.appendChild(temp.firstChild);
  }

  box.scrollTop = box.scrollHeight;
}

function pushMobileChatMessage(chat, side, text) {
  if (!chat.messages) chat.messages = [];

  var createdAt = new Date().toISOString();

  chat.messages.push({
    id: "msg-" + Date.now() + "-" + Math.floor(Math.random() * 1000),
    side: side,
    text: text,
    content: text,
    createdAt: createdAt
  });

  chat.updatedAt = Date.now();
  saveMobilePrivateChats();

  return createdAt;
}

async function handleMobileNormaCommand(text, chat) {
  var command = String(text || "").trim();

  if (
    command === "/管理IP" ||
    command === "/管理ip" ||
    command === "/位置管理"
  ) {
    var tMe = pushMobileChatMessage(chat, "me", command);
    appendMobileChatBubble("me", command, tMe);

    try {
      var res = await mFetch("/api/norma/can-manage");

      if (!res.ok || !res.data || !res.data.canManage) {
        var denyText = "权限不足。管理剧情位置需要拥有“管理组”身份组。";
        var tDeny = pushMobileChatMessage(chat, "other", denyText);
        appendMobileChatBubble("other", denyText, tDeny);
        return true;
      }

      var okText = "权限验证通过。已打开剧情位置管理面板。";
      var tOk = pushMobileChatMessage(chat, "other", okText);
      appendMobileChatBubble("other", okText, tOk);

      openMobileLocationManagePanel();
      return true;
    } catch (e) {
      var errText = "无法验证管理权限，请确认后端已启动。";
      var tErr = pushMobileChatMessage(chat, "other", errText);
      appendMobileChatBubble("other", errText, tErr);
      return true;
    }
  }

  return false;
}

async function sendMobileChatMessage() {
  if (!currentChatContact || !currentChatId) return;

  var text = chatInput ? chatInput.value.trim() : "";
  if (!text) return;

  var chat = mPrivateChats.find(function (item) {
    return String(item.id) === String(currentChatId);
  });

  if (!chat) {
    chat = ensureMobileChat(currentChatContact);
    currentChatId = chat.id;
  }

  if (chatSendBtn) {
    chatSendBtn.disabled = true;
    chatSendBtn.textContent = "发送中";
  }

  try {
    if (
      currentChatContact.accountKind === "norma_bot" ||
      String(currentChatContact.studentId || "").toUpperCase() === "AI000000"
    ) {
      var handled = await handleMobileNormaCommand(text, chat);
      if (handled) {
        if (chatInput) chatInput.value = "";
        return;
      }
    }

    var tMe = pushMobileChatMessage(chat, "me", text);
    appendMobileChatBubble("me", text, tMe);
    if (chatInput) chatInput.value = "";

    if (
      currentChatContact.accountKind === "norma_bot" ||
      String(currentChatContact.studentId || "").toUpperCase() === "AI000000"
    ) {
      var res = await mFetch("/api/norma/chat", {
        method: "POST",
        body: JSON.stringify({ content: text })
      });

      var reply =
        (res.data && (res.data.reply || res.data.message)) ||
        "诺玛暂时没有回应。";

      if (!res.ok) {
        reply = (res.data && res.data.message) || "诺玛暂时无法回复。";
      }

      var parts = String(reply)
        .split("|||")
        .map(function (item) {
          return item.trim();
        })
        .filter(Boolean);

      if (!parts.length) parts = [reply];

      parts.forEach(function (part) {
        var tOther = pushMobileChatMessage(chat, "other", part);
        appendMobileChatBubble("other", part, tOther);
      });
    }
  } catch (e) {
    alert("发送失败");
  } finally {
    if (chatSendBtn) {
      chatSendBtn.disabled = false;
      chatSendBtn.textContent = "发送";
    }
  }
}

/* ========== 手机版位置管理面板 ========== */
function openMobileLocationManagePanel() {
  var old = document.getElementById("mLocationManageOverlay");
  if (old) old.remove();

  var overlay = document.createElement("div");
  overlay.id = "mLocationManageOverlay";
  overlay.className = "m-location-manage-overlay";

  overlay.innerHTML =
    '<div class="m-location-manage-panel">' +
      '<div class="m-location-manage-header">' +
        '<div>' +
          '<div class="m-location-manage-title">剧情位置管理</div>' +
          '<div class="m-location-manage-sub">/管理IP · 仅管理组</div>' +
        '</div>' +
        '<button type="button" id="mLocationManageCloseBtn">关闭</button>' +
      '</div>' +

      '<div class="m-location-manage-add">' +
        '<input id="mLocationNameInput" maxlength="80" placeholder="新位置，例如：芝加哥地铁站">' +
        '<button type="button" id="mLocationAddBtn">添加</button>' +
      '</div>' +

      '<div class="m-location-manage-search">' +
        '<input id="mLocationSearchInput" placeholder="搜索位置">' +
        '<button type="button" id="mLocationSearchBtn">搜索</button>' +
      '</div>' +

      '<div id="mLocationManageList" class="m-location-manage-list">' +
        '<div class="m-empty">加载中</div>' +
      '</div>' +
    '</div>';

  document.body.appendChild(overlay);

  document
    .getElementById("mLocationManageCloseBtn")
    .addEventListener("click", function () {
      overlay.remove();
    });

  overlay.addEventListener("click", function (event) {
    if (event.target === overlay) overlay.remove();
  });

  document
    .getElementById("mLocationAddBtn")
    .addEventListener("click", addMobileLocation);

  document
    .getElementById("mLocationSearchBtn")
    .addEventListener("click", loadMobileLocationManageList);

  document
    .getElementById("mLocationSearchInput")
    .addEventListener("keydown", function (event) {
      if (event.key === "Enter") {
        event.preventDefault();
        loadMobileLocationManageList();
      }
    });

  loadMobileLocationManageList();
}

function loadMobileLocationManageList() {
  var list = document.getElementById("mLocationManageList");
  var searchInput = document.getElementById("mLocationSearchInput");
  if (!list) return;

  list.innerHTML = '<div class="m-empty">加载中</div>';

  var keyword = searchInput ? searchInput.value.trim() : "";
  var path = "/api/norma/locations" +
    (keyword ? ("?q=" + encodeURIComponent(keyword)) : "");

  mFetch(path)
    .then(function (res) {
      var locations =
        res.data && Array.isArray(res.data.locations)
          ? res.data.locations
          : [];

      if (!res.ok) {
        list.innerHTML =
          '<div class="m-empty">' +
            escapeHtml((res.data && res.data.message) || "读取失败") +
          '</div>';
        return;
      }

      if (!locations.length) {
        list.innerHTML = '<div class="m-empty">暂时没有位置</div>';
        return;
      }

      list.innerHTML = locations
        .map(function (item) {
          return (
            '<div class="m-location-manage-item" data-id="' + item.id + '">' +
              '<div class="m-location-manage-item-main">' +
                '<div class="m-location-manage-item-name">' +
                  escapeHtml(item.name || "") +
                '</div>' +
                '<div class="m-location-manage-item-meta">' +
                  (item.status === "inactive" ? "已停用" : "启用中") +
                '</div>' +
              '</div>' +
              '<div class="m-location-manage-item-actions">' +
                '<button type="button" data-act="edit">改</button>' +
                '<button type="button" data-act="toggle">' +
                  (item.status === "inactive" ? "启用" : "停用") +
                '</button>' +
                '<button type="button" data-act="delete" class="danger">删</button>' +
              '</div>' +
            '</div>'
          );
        })
        .join("");

      list.querySelectorAll(".m-location-manage-item").forEach(function (row) {
        var id = row.getAttribute("data-id");

        row.querySelectorAll("button").forEach(function (btn) {
          btn.addEventListener("click", function () {
            var act = btn.getAttribute("data-act");
            if (act === "edit") editMobileLocation(id, row);
            if (act === "toggle") toggleMobileLocation(id, row);
            if (act === "delete") deleteMobileLocation(id);
          });
        });
      });
    })
    .catch(function () {
      list.innerHTML = '<div class="m-empty">请求失败</div>';
    });
}

function addMobileLocation() {
  var input = document.getElementById("mLocationNameInput");
  var name = input ? input.value.trim() : "";

  if (!name) {
    alert("请输入位置名称");
    return;
  }

  mFetch("/api/norma/locations", {
    method: "POST",
    body: JSON.stringify({ name: name, sortOrder: 0 })
  })
    .then(function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        alert((res.data && res.data.message) || "添加失败");
        return;
      }

      if (input) input.value = "";
      loadMobileLocationManageList();
    })
    .catch(function () {
      alert("请求失败");
    });
}

function editMobileLocation(id, row) {
  var oldName = "";
  var nameEl = row.querySelector(".m-location-manage-item-name");
  if (nameEl) oldName = nameEl.textContent || "";

  var nextName = prompt("修改位置名称：", oldName);
  if (nextName === null) return;

  nextName = String(nextName || "").trim();
  if (!nextName) {
    alert("名称不能为空");
    return;
  }

  mFetch("/api/norma/locations/" + encodeURIComponent(id), {
    method: "PUT",
    body: JSON.stringify({
      name: nextName,
      status: "active"
    })
  })
    .then(function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        alert((res.data && res.data.message) || "修改失败");
        return;
      }
      loadMobileLocationManageList();
    })
    .catch(function () {
      alert("请求失败");
    });
}

function toggleMobileLocation(id, row) {
  var meta = row.querySelector(".m-location-manage-item-meta");
  var isInactive = meta && meta.textContent.indexOf("停用") !== -1;
  var nameEl = row.querySelector(".m-location-manage-item-name");
  var name = nameEl ? nameEl.textContent : "";

  mFetch("/api/norma/locations/" + encodeURIComponent(id), {
    method: "PUT",
    body: JSON.stringify({
      name: name,
      status: isInactive ? "active" : "inactive"
    })
  })
    .then(function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        alert((res.data && res.data.message) || "操作失败");
        return;
      }
      loadMobileLocationManageList();
    })
    .catch(function () {
      alert("请求失败");
    });
}

function deleteMobileLocation(id) {
  if (!confirm("确定删除这个位置吗？")) return;

  mFetch("/api/norma/locations/" + encodeURIComponent(id), {
    method: "DELETE"
  })
    .then(function (res) {
      if (!res.ok || !res.data || !res.data.success) {
        alert((res.data && res.data.message) || "删除失败");
        return;
      }
      loadMobileLocationManageList();
    })
    .catch(function () {
      alert("请求失败");
    });
}
