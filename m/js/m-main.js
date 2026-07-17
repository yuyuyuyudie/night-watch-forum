// 守夜人论坛 - 手机版主入口（修复完整版）
const M_API_BASE = "http://43.135.26.183:3000";

var GUEST_DEVICE_ID_KEY = "cassell_guest_device_id_v1";
var AUTH_STORAGE_KEY = "cassell_auth_session";
var AUTH_TOKEN_KEY = "cassell_auth_token";

var localAuthState = { loggedIn: false, isGuest: false, studentId: "" };
var currentAccount = null;
var currentTab = "home";
var backTarget = "home";

var tabs = document.querySelectorAll(".m-tab");
var content = document.getElementById("mContent");
var backBtn = document.getElementById("mBackBtn");
var searchBtn = document.getElementById("mSearchBtn");
var headerTitle = document.getElementById("mHeaderTitle");
var themeToggleBtn = document.getElementById("mThemeToggleBtn");
var appEl = document.getElementById("app");
var tabBar = document.getElementById("mTabBar");
var bottomReply = document.getElementById("mBottomReply");

/* ---------- 工具 ---------- */
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
        studentId: localAuthState.studentId,
        name: localAuthState.studentId,
        avatar: defaultAvatar(localAuthState.studentId || "guest"),
        signature: "游客访问中。",
        identityGroups: [],
        wearingGroup: null
      };
      resolve(currentAccount);
      return;
    }
    var token = localStorage.getItem(AUTH_TOKEN_KEY);
    if (!token) {
      currentAccount = null;
      resolve(null);
      return;
    }
    mFetch("/api/me").then(function (res) {
      if (!res.ok || !res.data || !res.data.success || !res.data.user) {
        resolve(currentAccount);
        return;
      }
      currentAccount = accountFromUser(res.data.user);
      resolve(currentAccount);
    }).catch(function () {
      resolve(currentAccount);
    });
  });
}

/* ---------- 顶部/底部 ---------- */
function showBackOnly() {
  if (backBtn) backBtn.style.display = "flex";
  if (searchBtn) searchBtn.style.display = "none";
}
function showSearchOnly() {
  if (backBtn) backBtn.style.display = "none";
  if (searchBtn) searchBtn.style.display = "flex";
}
function showTabBar() {
  if (tabBar) tabBar.style.display = "flex";
  if (bottomReply) bottomReply.style.display = "none";
}
function showReplyBar() {
  if (tabBar) tabBar.style.display = "none";
  if (bottomReply) bottomReply.style.display = "flex";
}
function hideBottomBar() {
  if (tabBar) tabBar.style.display = "none";
  if (bottomReply) bottomReply.style.display = "none";
}

function setActiveTab(tabName) {
  currentTab = tabName;
  tabs.forEach(function (x) {
    x.classList.toggle("active", x.dataset.tab === tabName);
  });
}

/* ---------- 主题 ---------- */
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
  if (themeToggleBtn) {
    themeToggleBtn.innerHTML = isNight
      ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/></svg>'
      : '<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/><line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/><line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/><line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/><line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/></svg>';
  }
  localStorage.setItem("m_forum_theme_mode", mode);
}

(function initTheme() {
  applyThemeMode(localStorage.getItem("m_forum_theme_mode") || "night");
})();

if (themeToggleBtn) {
  themeToggleBtn.addEventListener("click", function () {
    var next = localStorage.getItem("m_forum_theme_mode") === "night" ? "day" : "night";
    applyThemeMode(next);
  });
}

/* ---------- Tab / 返回 ---------- */
tabs.forEach(function (tab) {
  tab.addEventListener("click", function () {
    switchTab(tab.dataset.tab);
  });
});

if (searchBtn) {
  searchBtn.addEventListener("click", function () {
    alert("搜索功能后续再做");
  });
}

if (backBtn) {
  backBtn.addEventListener("click", function () {
    if (backTarget === "setting") {
      switchTab("setting");
      backTarget = "home";
    } else {
      switchTab("home");
    }
  });
}

function switchTab(t) {
  setActiveTab(t);
  showTabBar();
  if (t === "home") {
    headerTitle.textContent = "守夜人论坛";
    showSearchOnly();
    renderHome();
  } else if (t === "archive") {
    headerTitle.textContent = "档案";
    showSearchOnly();
    renderArchive();
  } else if (t === "post") {
    headerTitle.textContent = "发帖";
    showSearchOnly();
    renderPost();
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

/* ---------- 登录 ---------- */
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
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ studentId: studentId, accessCode: accessCode })
  }).then(function (r) { return r.json(); }).then(function (data) {
    if (!data || !data.success) {
      alert((data && data.message) || "登录失败");
      return;
    }
    var returnedSid = String(data.user && (data.user.studentId || data.user.student_id) || "").toUpperCase();
    if (returnedSid !== studentId) {
      alert("登录失败：服务器返回账号不一致。");
      return;
    }

    localStorage.setItem(AUTH_TOKEN_KEY, data.token);
    saveLocalAuth({ loggedIn: true, isGuest: false, studentId: returnedSid });
    currentAccount = accountFromUser(data.user);

    // 登录页立刻显示真实头像
    var img = document.getElementById("mAuthAvatarPreview");
    if (img && currentAccount.avatar) img.src = currentAccount.avatar;

    hideMobileLogin();
    setActiveTab("home");
    switchTab("home");

    // 再静默拉一次最新资料
    fetchMe();
  }).catch(function () {
    alert("无法连接服务器");
  });
}

function doLoginGuest() {
  var guestId = getGuestDeviceId();
  localStorage.removeItem(AUTH_TOKEN_KEY);
  saveLocalAuth({ loggedIn: true, isGuest: true, studentId: guestId });
  currentAccount = {
    studentId: guestId,
    name: guestId,
    avatar: defaultAvatar(guestId),
    signature: "游客访问中。",
    identityGroups: [],
    wearingGroup: null
  };
  hideMobileLogin();
  setActiveTab("home");
  switchTab("home");
}

function mobileLogout() {
  localStorage.removeItem(AUTH_TOKEN_KEY);
  saveLocalAuth({ loggedIn: false, isGuest: false, studentId: "" });
  currentAccount = null;
  showMobileLogin();
  updateLoginPreview();
}

(function initLogin() {
  loadLocalAuth();

  var sid = document.getElementById("mAuthStudentIdInput");
  if (sid) sid.addEventListener("input", updateLoginPreview);

  var loginBtn = document.getElementById("mLoginAccountBtn");
  var guestBtn = document.getElementById("mGuestLoginBtn");
  if (loginBtn) loginBtn.addEventListener("click", doLoginAccount);
  if (guestBtn) guestBtn.addEventListener("click", doLoginGuest);

  if (!localAuthState.loggedIn) {
    showMobileLogin();
    updateLoginPreview();
  } else {
    hideMobileLogin();
    fetchMe().then(function () {
      setActiveTab("home");
      switchTab("home");
    });
  }
})();

/* ---------- 首页：板块 + 热门 ---------- */
function renderHome() {
  headerTitle.textContent = "守夜人论坛";
  showSearchOnly();
  showTabBar();
  content.innerHTML =
    '<div class="m-section-title">板块</div>' +
    '<div id="mBoardGrid" class="m-board-grid"><div class="m-loading">加载中</div></div>' +
    '<div class="m-section-title">热门</div>' +
    '<div id="mHotList"><div class="m-loading">加载中</div></div>';
  loadBoards();
  loadHotThreads();
}

function loadBoards() {
  var grid = document.getElementById("mBoardGrid");
  if (!grid) return;
  mFetch("/api/boards").then(function (res) {
    var boards = (res.data && (res.data.boards || res.data.data)) || res.data || [];
    if (!res.ok || !Array.isArray(boards) || boards.length === 0) {
      grid.innerHTML = '<div class="m-empty">暂无板块 / 加载失败</div>';
      return;
    }
    var html = "";
    boards.forEach(function (b) {
      var slug = b.slug || b.id || "";
      var name = b.name || b.title || slug;
      html +=
        '<div class="m-board-tile" data-slug="' + slug + '" data-name="' + name + '">' +
          '<div class="m-board-tile-name">' + name + '</div>' +
        '</div>';
    });
    grid.innerHTML = html;
    grid.querySelectorAll(".m-board-tile").forEach(function (el) {
      el.addEventListener("click", function () {
        renderBoardPage(el.dataset.slug, el.dataset.name);
      });
    });
  }).catch(function () {
    grid.innerHTML = '<div class="m-empty">板块加载失败</div>';
  });
}

function loadHotThreads() {
  var list = document.getElementById("mHotList");
  if (!list) return;
  mFetch("/api/boards").then(function (res) {
    var boards = (res.data && (res.data.boards || res.data.data)) || res.data || [];
    if (!Array.isArray(boards) || boards.length === 0) {
      list.innerHTML = '<div class="m-empty">暂无热门</div>';
      return;
    }
    var board = boards.find(function (b) {
      return /public|公共/i.test(String(b.slug || b.name || ""));
    }) || boards[0];
    var slug = board.slug || board.id;
    var boardName = board.name || board.title || slug;
    return mFetch("/api/boards/" + encodeURIComponent(slug) + "/threads").then(function (r2) {
      var threads = (r2.data && (r2.data.threads || r2.data.data)) || r2.data || [];
      if (!r2.ok || !Array.isArray(threads) || threads.length === 0) {
        list.innerHTML = '<div class="m-empty">暂无帖子</div>';
        return;
      }
      var html = "";
      threads.slice(0, 10).forEach(function (t) {
        var id = t.id || t.threadId || t.thread_id;
        html +=
          '<div class="m-thread-item" data-id="' + id + '" data-slug="' + slug + '">' +
            '<div class="m-thread-top">' +
              '<div class="m-thread-author">' + (t.authorName || t.author || t.forumId || "匿名") + '</div>' +
              '<div class="m-thread-board-tag">' + boardName + '</div>' +
            '</div>' +
            '<div class="m-thread-title">' + (t.title || "无标题") + '</div>' +
            '<div class="m-thread-bottom">' +
              '<div class="m-thread-actions"><span class="m-action">赞 ' + (t.likeCount || t.likes || 0) + '</span></div>' +
              '<div class="m-thread-time">' + formatTime(t.createdAt || t.created_at || t.time) + '</div>' +
            '</div>' +
          '</div>';
      });
      list.innerHTML = html;
      list.querySelectorAll(".m-thread-item").forEach(function (el) {
        el.addEventListener("click", function () {
          renderThreadPage(el.dataset.id, el.dataset.slug);
        });
      });
    });
  }).catch(function () {
    list.innerHTML = '<div class="m-empty">热门加载失败</div>';
  });
}

/* ---------- 板块页 ---------- */
function renderBoardPage(slug, boardName) {
  backTarget = "home";
  headerTitle.textContent = boardName || "板块";
  showBackOnly();
  showTabBar();
  content.innerHTML = '<div class="m-section-title">' + (boardName || slug) + '</div><div id="mBoardThreads" class="m-loading">加载中</div>';
  mFetch("/api/boards/" + encodeURIComponent(slug) + "/threads").then(function (res) {
    var box = document.getElementById("mBoardThreads");
    if (!box) return;
    var threads = (res.data && (res.data.threads || res.data.data)) || res.data || [];
    if (!res.ok || !Array.isArray(threads) || threads.length === 0) {
      box.innerHTML = '<div class="m-empty">暂无帖子</div>';
      return;
    }
    var html = "";
    threads.forEach(function (t) {
      var id = t.id || t.threadId || t.thread_id;
      html +=
        '<div class="m-thread-item" data-id="' + id + '" data-slug="' + slug + '">' +
          '<div class="m-thread-top">' +
            '<div class="m-thread-author">' + (t.authorName || t.author || "匿名") + '</div>' +
            '<div class="m-thread-board-tag">' + (t.replyCount || t.replies || 0) + ' 回复</div>' +
          '</div>' +
          '<div class="m-thread-title">' + (t.title || "无标题") + '</div>' +
          '<div class="m-thread-bottom">' +
            '<div class="m-thread-actions"><span class="m-action">赞 ' + (t.likeCount || t.likes || 0) + '</span></div>' +
            '<div class="m-thread-time">' + formatTime(t.createdAt || t.created_at) + '</div>' +
          '</div>' +
        '</div>';
    });
    box.innerHTML = html;
    box.querySelectorAll(".m-thread-item").forEach(function (el) {
      el.addEventListener("click", function () {
        renderThreadPage(el.dataset.id, el.dataset.slug);
      });
    });
  }).catch(function () {
    var box = document.getElementById("mBoardThreads");
    if (box) box.innerHTML = '<div class="m-empty">加载失败</div>';
  });
}

/* ---------- 帖子详情 ---------- */
function renderThreadPage(threadId, slug) {
  backTarget = "home";
  headerTitle.textContent = "帖子详情";
  showBackOnly();
  showReplyBar();
  content.innerHTML = '<div class="m-loading">加载中</div>';

  // 优先尝试详情接口；没有就从板块列表里找
  mFetch("/api/threads/" + encodeURIComponent(threadId)).then(function (res) {
    if (res.ok && res.data && (res.data.thread || res.data.data || res.data.title)) {
      var t = res.data.thread || res.data.data || res.data;
      paintThread(t, res.data.replies || t.replies || []);
      return;
    }
    return mFetch("/api/boards/" + encodeURIComponent(slug) + "/threads").then(function (r2) {
      var threads = (r2.data && (r2.data.threads || r2.data.data)) || [];
      var found = (threads || []).find(function (x) {
        return String(x.id || x.threadId || x.thread_id) === String(threadId);
      });
      if (!found) {
        content.innerHTML = '<div class="m-empty">帖子不存在或接口未就绪</div>';
        return;
      }
      paintThread(found, found.replies || []);
    });
  }).catch(function () {
    content.innerHTML = '<div class="m-empty">帖子加载失败</div>';
  });
}

function paintThread(t, replies) {
  replies = replies || [];
  content.innerHTML =
    '<div class="m-thread-detail">' +
      '<div class="m-thread-detail-title">' + (t.title || "无标题") + '</div>' +
      '<div class="m-thread-detail-meta">' +
        '<span>' + (t.authorName || t.author || "匿名") + '</span>' +
        '<span>' + formatTime(t.createdAt || t.created_at || t.time) + '</span>' +
      '</div>' +
      '<div class="m-thread-detail-content">' + String(t.content || t.body || "（无正文）").replace(/\n/g, "<br>") + '</div>' +
    '</div>' +
    '<div class="m-section-title">回复 (' + replies.length + ')</div>' +
    '<div id="mReplyList">' +
      (replies.length ? replies.map(function (r) {
        return '<div class="m-reply-item"><div class="m-reply-header"><span class="m-reply-author">' +
          (r.authorName || r.author || "匿名") + '</span><span class="m-reply-time">' +
          formatTime(r.createdAt || r.time) + '</span></div><div class="m-reply-content">' +
          (r.content || "") + '</div></div>';
      }).join("") : '<div class="m-empty">暂无回复</div>') +
    '</div>';
}

/* ---------- 档案 / 发帖 / 消息 ---------- */
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

/* ---------- 设置（找回菜单 + 论坛设置） ---------- */
function renderSetting() {
  var me = currentAccount || {
    name: "未登录",
    studentId: "",
    avatar: defaultAvatar("guest"),
    signature: "",
    identityGroups: []
  };
  var wearing = me.wearingGroup || (me.identityGroups && me.identityGroups[0]) || "";
  if (wearing && typeof wearing === "object") wearing = wearing.text || wearing.name || "";
  var badgeHtml = wearing ? '<div class="m-profile-badge">' + wearing + '</div>' : "";

  content.innerHTML =
    '<div class="m-profile-card" id="mProfileCard">' +
      '<div class="m-profile-avatar"><img src="' + (me.avatar || defaultAvatar(me.studentId)) + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>' +
      '<div class="m-profile-info">' +
        '<div class="m-profile-row"><div class="m-profile-name">' + (me.name || me.studentId || "未登录") + '</div>' + badgeHtml + '</div>' +
        '<div class="m-profile-student">学号: ' + (me.studentId || "-") + '</div>' +
        '<div class="m-profile-bio">' + (me.signature || "这个人很懒，什么都没写。") + '</div>' +
      '</div>' +
    '</div>' +
    '<div class="m-setting-group">' +
      '<div class="m-setting-item" id="mForumSettingBtn"><div class="m-setting-left"><span class="m-setting-label">论坛设置</span></div><div class="m-setting-arrow">›</div></div>' +
      '<div class="m-setting-item" id="mBeautifyBtn"><div class="m-setting-left"><span class="m-setting-label">美化主题</span></div><div class="m-setting-arrow">›</div></div>' +
      '<div class="m-setting-item" id="mAccountBtn"><div class="m-setting-left"><span class="m-setting-label">账号管理</span></div><div class="m-setting-arrow">›</div></div>' +
      '<div class="m-setting-item danger" id="mLogoutBtn"><div class="m-setting-left"><span class="m-setting-label">退出登录</span></div><div class="m-setting-arrow">›</div></div>' +
    '</div>';

  var card = document.getElementById("mProfileCard");
  if (card) {
    card.addEventListener("click", function () {
      renderProfilePage();
    });
  }
  document.getElementById("mForumSettingBtn").addEventListener("click", function () {
    alert("论坛设置（后续：字体/通知/隐私等）");
  });
  document.getElementById("mBeautifyBtn").addEventListener("click", function () {
    alert("美化主题（后续：日夜/壁纸/自定义）");
  });
  document.getElementById("mAccountBtn").addEventListener("click", function () {
    alert("账号管理（后续：修改访问码）");
  });
  document.getElementById("mLogoutBtn").addEventListener("click", function () {
    if (confirm("确定要退出登录吗？")) mobileLogout();
  });
}

/* ---------- 个人主页 ---------- */
function renderProfilePage() {
  backTarget = "setting";
  headerTitle.textContent = "个人主页";
  showBackOnly();
  hideBottomBar();

  var me = currentAccount || {
    name: "未登录",
    studentId: "",
    avatar: defaultAvatar("guest"),
    signature: "",
    identityGroups: [],
    wearingGroup: null
  };

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
      return '<span class="m-profile-owned-tag" style="background:' + color + ';">' + text + '</span>';
    }).join("") + '</div>';
  } else {
    ownedHtml = '<div class="m-empty" style="padding:12px 0;">暂无身份组</div>';
  }

  content.innerHTML =
    '<div class="m-profile-page-card">' +
      '<div class="m-profile-page-avatar"><img src="' + (me.avatar || defaultAvatar(me.studentId)) + '" style="width:100%;height:100%;border-radius:50%;object-fit:cover;"></div>' +
      '<div class="m-profile-page-name-row">' +
        '<span class="m-profile-page-name">' + (me.name || me.studentId) + '</span>' +
        (wearing ? '<span class="m-profile-page-wearing">' + wearing + '</span>' : '') +
      '</div>' +
      '<div class="m-profile-page-student">学号: ' + (me.studentId || "-") + '</div>' +
      '<div class="m-profile-page-bio">' + (me.signature || "这个人很懒，什么都没写。") + '</div>' +
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
}
