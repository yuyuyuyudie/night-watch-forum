import { switchRoute } from "./router.js";
import { state, STORAGE_KEYS } from "./state.js";
import { friends, groups } from "./data.js";
import {
  sendForumThreadShareToContact,
  sendForumCommentShareToContact,
  sendForumThreadShareToGroup,
  sendForumCommentShareToGroup,
  getFriendShareSortTime,
  getGroupShareSortTime,
  openChatWithContactFromForum,
  openContactProfileByStudentId
} from "./social.js";
import {
  generateStorySyncBatch,
  generateStoryThreadReplies,
  readTavernContextText
} from "./character-ai.js";

const API_BASE_URL = "http://43.135.26.183:3000";

let forumSearchTimer = null;
let lastGlobalUserResults = [];

function getForumAuthHeaders() {
  return state.authToken
    ? {
        Authorization: `Bearer ${state.authToken}`
      }
    : {};
}

// ====== 这里是给帖子用的彩色徽章颜料 ======
let normaGroupsCache = [];
async function loadNormaGroups() {
  try {
    const res = await fetch(`http://43.135.26.183:3000/api/norma/groups`);
    const data = await res.json();
    if (data.success) {
      normaGroupsCache = data.groups;
    }
  } catch (e) {
    console.warn("加载身份组失败:", e);
  }
}
loadNormaGroups();

function getNormaGroupByName(name) {
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

function getNormaGroupColor(group) {
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

function getIdentityGroupColorStyle(groupName) {
  const grp = getNormaGroupByName(groupName);
  const color = getNormaGroupColor(grp);

  if (!color) {
    return {
      textStyle: "",
      badgeStyle: "",
      color: ""
    };
  }

  const isGradient = color.includes("gradient");

  return {
    textStyle: isGradient
      ? `display:inline-block;background:${color};-webkit-background-clip:text;background-clip:text;color:transparent;font-weight:800;`
      : `color:${color};font-weight:800;`,
    badgeStyle: `background:${color};color:#fff;`,
    color
  };
}

function getForumIdByAccountCode(accountCode) {
  const code = String(accountCode || "").trim();
  if (!code) return "";

  const currentAccount = state.currentAccount || state.account || null;

  if (
    currentAccount &&
    String(currentAccount.studentId || currentAccount.code || "").trim() === code
  ) {
    return (
      currentAccount.profile?.forumId ||
      currentAccount.forumId ||
      state.profile?.forumId ||
      code
    );
  }

  const matchedFriend = friends.find((friend) => {
    const friendCodes = [
      friend.code,
      friend.friendCode,
      friend.studentId,
      friend.characterId,
      ...(Array.isArray(friend.timelines)
        ? friend.timelines.flatMap((timeline) => [
            timeline.code,
            timeline.studentId,
            timeline.characterId
          ])
        : [])
    ]
      .filter(Boolean)
      .map((item) => String(item).trim());

    return friendCodes.includes(code);
  });

  if (!matchedFriend) return code;

  return (
    matchedFriend.forumId ||
    matchedFriend.remark ||
    matchedFriend.name ||
    code
  );
}

function renderTextWithAccountAt(text) {
  return escapeHtml(text || "")
    .replace(
      /@([A-Za-z]{1,10}\d{3,12})/g,
      (full, code) => {
        const forumId = getForumIdByAccountCode(code);
        return `<button class="account-at" type="button" data-account-code="${escapeHtml(code)}" title="${escapeHtml(code)}">@${escapeHtml(forumId)}</button>`;
      }
    )
    .replace(
      /cassell-forum:\/\/thread\/(\d+)|thread:(\d+)/g,
      (full, id1, id2) => {
        const threadId = id1 || id2;
        return `<button class="inline-thread-link" type="button" data-inline-thread-id="${escapeHtml(threadId)}">↗ 帖子链接 #${escapeHtml(threadId)}</button>`;
      }
    );
}

function renderIdentityBadge(name) {
  const safeName = escapeHtml(name || "");
  if (!safeName) return "";

  const grp = getNormaGroupByName(name);
  const styleInfo = getIdentityGroupColorStyle(name);

  const iconHtml = grp?.icon
    ? `<img src="${escapeHtml(grp.icon)}" class="badge-icon" alt="" />`
    : "";

  return `
    <span class="identity-badge identity-badge-bubble" style="${styleInfo.badgeStyle}">
      ${iconHtml}${safeName}
    </span>
  `;
}

// ======================================

let forumBoards = [];
let selectedBoard = null;
let selectedThread = null;
let replyTarget = null;
let isComposerOpen = false;

let commentPressTimer = null;
let activeCommentAction = null;
let ignoreNextCommentClick = false;
let shareMode = "thread"; // thread | comment
let shareCommentTarget = null;

let boardThreads = [];
let threadDetailCache = new Map();

let globalPinnedItems = [];
let specialView = "";
let archiveSection = "";
let favoriteThreads = [];

function goForumHomeFromNav() {
  hideCommentActionMenu();
  selectedBoard = null;
  selectedThread = null;
  replyTarget = null;
  isComposerOpen = false;
  boardThreads = [];
  specialView = "";
  archiveSection = "";
  favoriteThreads = [];
  resetComposerForm();
  switchRoute("threads");
  renderForum();
}

function getCurrentAccountGroups() {
  const account = state.currentAccount || state.account || {};
  const profileGroups = Array.isArray(account?.profile?.identityGroups)
    ? account.profile.identityGroups
    : [];

  const accountGroups = Array.isArray(account?.identityGroups)
    ? account.identityGroups
    : [];

  const localGroups = Array.isArray(state.profile?.identityGroups)
    ? state.profile.identityGroups
    : [];

  return [...new Set([...profileGroups, ...accountGroups, ...localGroups])];
}

function isCurrentUserManager() {
  return getCurrentAccountGroups().includes("管理组");
}

function isStoryBoard(board = selectedBoard) {
  return board?.boardType === "story";
}

function closeSocialOverlaysForForumJump() {
  const socialOverlay = document.getElementById("socialMainOverlay");
  const contactOverlay = document.getElementById("contactProfileOverlay");
  const profileOverlay = document.getElementById("profileHomeOverlay");
  const miniPopover = document.getElementById("contactMiniPopover");

  if (socialOverlay) socialOverlay.hidden = true;
  if (contactOverlay) contactOverlay.hidden = true;
  if (miniPopover) miniPopover.hidden = true;

  if (profileOverlay) {
    profileOverlay.classList.remove("active");
    profileOverlay.classList.remove("top-layer");
  }
}

function goForumBoardFromNav() {
  hideCommentActionMenu();
  selectedThread = null;
  replyTarget = null;
  isComposerOpen = false;
  resetComposerForm();
  renderForum();
}

function closeForumComposerFromNav() {
  isComposerOpen = false;
  resetComposerForm();
  renderForum();
}

function pushForumNav(label, closeAction, options = {}) {
  if (window.ForumNav?.pushOrReplace && options.type) {
    window.ForumNav.pushOrReplace(label, closeAction, options);
    return;
  }

  if (window.ForumNav?.push) {
    window.ForumNav.push(label, closeAction, options);
  }
}

function highlightCommentById(commentId) {
  const id = Number(commentId);
  if (!Number.isInteger(id) || id <= 0) return;

  // 等页面先画完，再找评论
  window.setTimeout(() => {
    const el = document.getElementById(`comment-${id}`);
    if (!el) return;

    el.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });

    el.classList.remove("comment-flash");
    // 强制重启动画
    void el.offsetWidth;
    el.classList.add("comment-flash");

    window.setTimeout(() => {
      el.classList.remove("comment-flash");
    }, 1600);
  }, 80);
}

async function navigateForumTarget(target, commentId = null) {
  if (!target) return;

  switchRoute("threads");
  closeSocialOverlaysForForumJump();

  if (target.startsWith("thread:")) {
    // 支持两种写法：
    // thread:12
    // thread:12#comment:34
    const raw = String(target).replace("thread:", "");
    const [threadPart, commentPart] = raw.split("#comment:");
    const threadId = Number(threadPart);
    const finalCommentId = Number(commentId || commentPart || 0) || null;

    if (!threadId) return;

    try {
      const detail = await loadThreadDetail(threadId);

      const boardSlug =
        detail.boardSlug ||
        detail.board?.slug ||
        detail.board_slug ||
        detail.board?.id ||
        "";

      let targetBoard = null;

      if (boardSlug) {
        targetBoard = forumBoards.find((item) => {
          return String(item.slug) === String(boardSlug) || String(item.id) === String(boardSlug);
        }) || null;
      }

      if (!targetBoard && detail.boardName) {
        targetBoard = forumBoards.find((item) => item.name === detail.boardName) || null;
      }

      if (!targetBoard && selectedBoard) {
        targetBoard = selectedBoard;
      }

      if (!targetBoard) {
        alert("找不到这个帖子所在的板块，暂时无法跳转。");
        return;
      }

      if (window.ForumNav?.popTo) {
        window.ForumNav.popTo(0);
      }

      selectedBoard = targetBoard;
      selectedThread = null;
      replyTarget = null;
      isComposerOpen = false;
      boardThreads = [];
      resetComposerForm();

      renderForum();

      pushForumNav(targetBoard.name, goForumHomeFromNav, {
  type: "forum-board",
  key: targetBoard.slug
});


      await loadThreadsByBoard(targetBoard.slug);

      selectedThread = detail;
      threadDetailCache.set(detail.id, detail);

      renderForum();

      pushForumNav(detail.title, goForumBoardFromNav, {
  type: "forum-thread",
  key: String(detail.id)
});

      if (finalCommentId) {
        highlightCommentById(finalCommentId);
      }

      return;
    } catch (error) {
      console.error("跳转帖子失败：", error);
      alert(error.message || "跳转帖子失败。");
      return;
    }
  }

  if (target.startsWith("notice:")) {
    alert("公告详情页后面接入。");
  }
}

export async function initForum() {
  bindForumActions();
  await loadBoards();
  await loadHomePinnedItems();
  switchRoute("threads");
  renderForum();
  window.addEventListener("profile:changed", async () => {
  try {
    threadDetailCache.clear();

    if (selectedBoard?.slug) {
      await loadThreadsByBoard(selectedBoard.slug);
    }

    if (selectedThread?.id) {
      selectedThread = await loadThreadDetail(selectedThread.id);
    }

    renderForum();
  } catch (error) {
    console.warn("资料变化后刷新论坛失败：", error);
  }
});

}

window.addEventListener("auth:changed", async () => {
  try {
    await loadBoards();
    await loadHomePinnedItems();

    if (selectedBoard?.slug) {
      const matchedBoard = forumBoards.find((item) => item.slug === selectedBoard.slug) || null;
      selectedBoard = matchedBoard;

      if (selectedBoard) {
        await loadThreadsByBoard(selectedBoard.slug);
      } else {
        selectedThread = null;
        boardThreads = [];
      }
    }

    renderForum();
  } catch (error) {
    console.error("登录状态变更后刷新论坛失败：", error);
  }
});

window.addEventListener("forum:refresh-breadcrumb", () => {
  try {
    renderBreadcrumb();
  } catch (error) {
    console.error("刷新面包屑失败：", error);
  }
});

window.addEventListener("forum:navigate-target", async (event) => {
  try {
    await navigateForumTarget(event.detail?.target || "");
  } catch (error) {
    console.error("论坛跳转失败：", error);
  }
});

async function loadBoards() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/boards`, {
      headers: {
        ...getAuthHeaders()
      }
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "获取板块失败");
    }

    forumBoards = Array.isArray(data.boards) ? data.boards : [];
  } catch (error) {
    console.error("加载板块失败：", error);
    forumBoards = [];
  }
}

async function loadHomePinnedItems() {
  try {
    const res = await fetch(`${API_BASE_URL}/api/forum/home-pinned`, {
      headers: {
        ...getAuthHeaders()
      }
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      throw new Error(data.message || "获取首页横幅失败");
    }

    globalPinnedItems = Array.isArray(data.items) ? data.items : [];
  } catch (error) {
    console.error("加载首页横幅失败：", error);
    globalPinnedItems = [];
  }
}

function getAuthorAvatar(seed) {
  return `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(seed)}`;
}

function getCommentAvatar(board, seed) {
  if (board?.forceAnonymous) {
    return getAuthorAvatar(`anonymous-${seed}`);
  }
  return getAuthorAvatar(seed);
}

function getNormaSystemAvatar() {
  const normaAccount = friends.find((item) => {
    return item.accountKind === "norma_bot" || item.name === "诺玛" || item.forumId === "诺玛";
  });

  return normaAccount?.avatar || normaAccount?.friendAvatar || getAuthorAvatar("诺玛");
}

function getRenderedCommentAvatar(comment) {
  if (comment?.isSystem) {
    return getNormaSystemAvatar();
  }

  return comment.avatar || getCommentAvatar(selectedBoard, comment.id);
}

function getCurrentUserDisplayName() {
  const nameEl = document.getElementById("userName");
  const name = String(nameEl?.textContent || "").trim();
  return name || "当前账号";
}

function getCurrentUserAvatar() {
  const avatarEl = document.getElementById("userAvatar");
  const src = String(avatarEl?.getAttribute("src") || "").trim();
  return src || getAuthorAvatar("current-user");
}

function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getForumAuthorAlias(authorStudentId) {
  try {
    const myId = String(
      state.authSession?.studentId ||
        state.currentAccount?.studentId ||
        ""
    )
      .trim()
      .toUpperCase();

    const friendId = String(authorStudentId || "")
      .trim()
      .toUpperCase();

    if (!friendId || !myId) return "";

    const s = JSON.parse(
      localStorage.getItem(`friend_alias_${friendId}_${myId}`) || "{}"
    );
    return s && s.alias ? s.alias : "";
  } catch (e) {
    return "";
  }
}

function getCommentDisplayName(comment) {
  if (!comment) return "";
  const alias = getForumAuthorAlias(comment.authorStudentId);
  return alias || comment.author || "";
}

function getReplyToDisplayName(replyTo, comments = []) {
  if (!replyTo) return "";

  // 先从评论列表里找原评论，这样才能用到备注
  const parent = (Array.isArray(comments) ? comments : []).find(
    (item) => Number(item.id) === Number(replyTo.id)
  );

  if (parent) {
    return getCommentDisplayName(parent);
  }

  // 找不到就退回原始名字
  return replyTo.author || "原评论";
}

function renderAuthorNameWithDisplayGroup(name, displayGroup, authorStudentId) {
  // 优先显示好友备注
  const alias = getForumAuthorAlias(authorStudentId);
  const displayName = alias || name || "";
  const safeName = escapeHtml(displayName);
  const finalGroup = String(displayGroup || "").trim();

  if (!finalGroup) {
    return `<span class="author-name-text">${safeName}</span>`;
  }

  const styleInfo = getIdentityGroupColorStyle(finalGroup);
  const badgeHtml = renderIdentityBadge(finalGroup);

  return `
    <span class="author-name-wrap">
      <span class="author-name-text author-name-colored" style="${styleInfo.textStyle}">
        ${safeName}
      </span>
      ${badgeHtml}
    </span>
  `;
}

function renderCommentBadges(comment) {
  let html = "";

  // 身份组已经在名字旁边显示过了，这里不再重复
  // 顺序：名字旁身份组 → BZ → LZ → 系统提示

  // 1) BZ
  const authorGroups = Array.isArray(comment.authorIdentityGroups)
    ? comment.authorIdentityGroups
    : [];
  if (shouldShowBoardModeratorBadge(authorGroups, selectedBoard)) {
    html += `<span class="bz-badge">BZ</span>`;
  }

  // 2) LZ
  if (comment.isLz) {
    html += `<span class="lz-badge">LZ</span>`;
  }

  // 3) 系统提示
  if (comment.isSystem) {
    html += `<span class="system-badge">${escapeHtml(comment.systemLabel || "系统")}</span>`;
  }

  return html;
}

function renderCommentMetaRight(comment, index = 0) {
  const floorNo = Number(comment.floorNo || 0);
  const safeFloorNo = floorNo > 0 ? floorNo : index + 1;
  return `${safeFloorNo}楼`;
}

function renderCommentTime(comment) {
  return comment.time || "";
}

function getCurrentStudentId() {
  const fromState =
    state.currentAccount?.studentId ||
    state.account?.studentId ||
    "";

  if (fromState) return String(fromState).trim();

  const userCodeEl = document.getElementById("userCodeText");
  const rawText = String(userCodeEl?.textContent || "").trim();

  const matched = rawText.match(/ID:\s*([A-Za-z0-9_-]+)/i);
  if (matched?.[1]) {
    return matched[1].trim();
  }

  return "";
}

function getCurrentIdentityGroups() {
  return [
    ...(Array.isArray(state.currentAccount?.profile?.identityGroups)
      ? state.currentAccount.profile.identityGroups
      : []),
    ...(Array.isArray(state.account?.profile?.identityGroups)
      ? state.account.profile.identityGroups
      : []),
    ...(Array.isArray(state.profile?.identityGroups)
      ? state.profile.identityGroups
      : []),
    ...(Array.isArray(state.currentAccount?.identityGroups)
      ? state.currentAccount.identityGroups
      : []),
    ...(Array.isArray(state.account?.identityGroups)
      ? state.account.identityGroups
      : [])
  ];
}

function isCurrentManager() {
  return getCurrentIdentityGroups().includes("管理组");
}

// 当前账号在指定板块里是不是版主
// 由身份组决定：身份组名 = 板块名 + "版主"，例如"狮心会版主"
function isCurrentBoardModerator(board = selectedBoard) {
  if (isCurrentManager()) return true;

  const boardName = String(board?.name || "").trim();
  if (!boardName) return false;

  const wantedGroup = `${boardName}版主`;
  return getCurrentIdentityGroups().includes(wantedGroup);
}

function isThreadOwner(thread) {
  const currentStudentId = getCurrentStudentId();
  if (!currentStudentId || !thread) return false;

  // 拥有者：这个剧情账号下的帖子归谁管（可删帖、删评论）
  return (
    thread.ownerStudentId === currentStudentId ||
    thread.authorStudentId === currentStudentId
  );
}

// 真正的“发帖人”：帖子名字上显示的那个人
function isThreadAuthor(thread) {
  const currentStudentId = getCurrentStudentId();
  if (!currentStudentId || !thread) return false;
  return thread.authorStudentId === currentStudentId;
}

// 只有发帖人（作者）才能改正文，管理组不行
function canEditThreadContent(thread) {
  if (!thread || Boolean(thread.isLocked)) return false;
  if (isCurrentManager() && !isThreadAuthor(thread)) return false;
  if (!isThreadAuthor(thread)) return false;
  return Number(thread.authorEditCount || 0) < 1;
}

function canEditThreadTitle(thread) {
  if (!thread || Boolean(thread.isLocked)) return false;
  return isCurrentManager();
}

function canLockThread(thread) {
  if (!thread) return false;
  return isCurrentManager();
}

// 删除帖子：发帖人 / 管理组 / 版主
function canDeleteThread(thread) {
  if (!thread) return false;
  if (isThreadOwner(thread)) return true;
  if (isCurrentManager()) return true;
  return isCurrentBoardModerator(selectedBoard);
}

// 置顶 / 取消置顶：管理组 / 版主
function canPinThread(thread) {
  if (!thread || !selectedBoard) return false;
  return isCurrentBoardModerator(selectedBoard);
}

function canDeleteComment(comment) {
  const currentStudentId = getCurrentStudentId();

  if (!currentStudentId || !selectedThread) return false;
  if (comment.isDeleted || comment.isSystem) return false;

  const isCommentOwner =
    comment.authorStudentId === currentStudentId ||
    comment.studentId === currentStudentId;

  const isOwner = isThreadOwner(selectedThread);

  return Boolean(isCurrentManager() || isCommentOwner || isOwner);
}

// 作者姓名后面是否要显示 BZ
// 由 “作者拥有的身份组” 决定，跟板块名挂钩
function shouldShowBoardModeratorBadge(identityGroups, board = selectedBoard) {
  if (!Array.isArray(identityGroups) || !board) return false;
  const boardName = String(board.name || "").trim();
  if (!boardName) return false;
  return identityGroups.includes(`${boardName}版主`);
}

function hideCommentActionMenu() {
  const menu = document.getElementById("commentActionMenu");
  if (menu) {
    menu.hidden = true;
    menu.style.visibility = "hidden";
  }
  activeCommentAction = null;
}

function showCommentActionMenu(comment, anchorEl) {
  const menu = document.getElementById("commentActionMenu");
  const deleteBtn = document.getElementById("commentActionDeleteBtn");
  const reportBtn = document.getElementById("commentActionReportBtn");
  const shareBtn = document.getElementById("commentActionShareBtn");

  if (!menu || !anchorEl) return;

  if (comment.isDeleted || comment.isSystem) {
    hideCommentActionMenu();
    return;
  }

  activeCommentAction = {
    id: comment.id,
    author: comment.author,
    canDelete: canDeleteComment(comment),
    isDeleted: Boolean(comment.isDeleted),
    isSystem: Boolean(comment.isSystem)
  };


  


  if (deleteBtn) {
  deleteBtn.hidden = !activeCommentAction.canDelete || activeCommentAction.isDeleted;
}

if (reportBtn) {
  reportBtn.hidden = activeCommentAction.isDeleted || activeCommentAction.isSystem;
}

if (shareBtn) {
  shareBtn.hidden = activeCommentAction.isDeleted;
}

if (activeCommentAction.isDeleted) {
  hideCommentActionMenu();
  return;
}

  ignoreNextCommentClick = true;

  const rect = anchorEl.getBoundingClientRect();

  menu.hidden = false;
  menu.style.visibility = "hidden";
  menu.style.top = "0px";
  menu.style.left = "0px";

  const menuHeight = menu.offsetHeight;
  const menuWidth = menu.offsetWidth;

  let top = rect.top - menuHeight - 8;
  if (top < 8) {
    top = rect.bottom + 8;
  }

  let left = rect.left + 8;
  if (left + menuWidth > window.innerWidth - 8) {
    left = window.innerWidth - menuWidth - 8;
  }
  if (left < 8) {
    left = 8;
  }

  menu.style.top = `${top}px`;
  menu.style.left = `${left}px`;
  menu.style.visibility = "visible";
}

function startCommentPress(comment, el) {
  clearTimeout(commentPressTimer);

  commentPressTimer = setTimeout(() => {
    showCommentActionMenu(comment, el);
  }, 500);
}

function cancelCommentPress() {
  clearTimeout(commentPressTimer);
  commentPressTimer = null;
}

function setReplyTargetFromComment(comment) {
  if (!comment || comment.isDeleted || comment.isSystem) return;

  replyTarget = {
    id: comment.id,
    author: getCommentDisplayName(comment),
    authorStudentId: comment.authorStudentId || "",
    text: comment.text
  };

  renderThreadDetailView();
  document.getElementById("commentInput")?.focus();
}

function getAuthHeaders() {
  const token =
    state.authToken ||
    localStorage.getItem(STORAGE_KEYS.authToken) ||
    localStorage.getItem("forum_token") ||
    localStorage.getItem("token") ||
    "";

  return token
    ? {
        Authorization: `Bearer ${token}`
      }
    : {};
}

function mergeThreadKeepingPinned(oldThread, updatedThread) {
  if (!oldThread) return updatedThread;

  const updatedHasPinnedInfo =
    Object.prototype.hasOwnProperty.call(updatedThread || {}, "pinnedAt") ||
    Object.prototype.hasOwnProperty.call(updatedThread || {}, "pinned_at") ||
    Object.prototype.hasOwnProperty.call(updatedThread || {}, "pinnedByStudentId") ||
    Object.prototype.hasOwnProperty.call(updatedThread || {}, "pinned_by_student_id");

  return {
    ...oldThread,
    ...updatedThread,

    isPinned: updatedHasPinnedInfo
      ? Boolean(updatedThread.isPinned)
      : Boolean(oldThread.isPinned),

    pinnedAt: updatedHasPinnedInfo
      ? (updatedThread.pinnedAt || updatedThread.pinned_at || "")
      : oldThread.pinnedAt,

    pinnedByStudentId: updatedHasPinnedInfo
      ? (updatedThread.pinnedByStudentId || updatedThread.pinned_by_student_id || "")
      : oldThread.pinnedByStudentId
  };
}

function sortThreadsWithPinnedFirst(threads) {
  return [...threads].sort((a, b) => {
    if (Number(b.isPinned) !== Number(a.isPinned)) {
      return Number(b.isPinned) - Number(a.isPinned);
    }

    const timeA = new Date(a.createdAt || 0).getTime();
    const timeB = new Date(b.createdAt || 0).getTime();
    return timeB - timeA;
  });
}

async function loadThreadsByBoard(boardSlug) {
  const res = await fetch(`${API_BASE_URL}/api/boards/${encodeURIComponent(boardSlug)}/threads`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "获取帖子列表失败");
  }

  boardThreads = sortThreadsWithPinnedFirst(
    Array.isArray(data.threads) ? data.threads : []
  );

  return boardThreads;
}

async function loadThreadDetail(threadId, forceRefresh = false) {
  if (!forceRefresh && threadDetailCache.has(threadId)) {
    return threadDetailCache.get(threadId);
  }

  // 强制刷新时，先丢掉旧缓存
  if (forceRefresh) {
    threadDetailCache.delete(threadId);
  }

  const res = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "获取帖子详情失败");
  }

  const thread = {
    ...data.thread,
    comments: Array.isArray(data.thread?.comments) ? data.thread.comments : []
  };

  threadDetailCache.set(threadId, thread);
  return thread;
}

async function openBoardBySlug(slug) {
  const board = forumBoards.find(item => item.slug === slug) || null;

  if (!board) {
    alert("未找到该板块。");
    return;
  }

  if (board.canCurrentUserAccess === false) {
    alert("你当前没有访问该板块的权限。");
    return;
  }

  try {
  if (window.ForumNav?.popTo && selectedBoard?.slug && selectedBoard.slug !== slug) {
    window.ForumNav.popTo(0);
  }

  selectedBoard = board;
  selectedThread = null;
  replyTarget = null;
  isComposerOpen = false;
  boardThreads = [];
  resetComposerForm();

  renderForum();

  pushForumNav(board.name, goForumHomeFromNav, {
  type: "forum-board",
  key: board.slug
});

  await loadThreadsByBoard(slug);
  renderForum();
} catch (error) {

    console.error("加载板块帖子失败：", error);
    alert(error.message || "加载板块帖子失败");
  }
}

async function openThreadById(threadId) {
  hideCommentActionMenu();

  try {
    const detail = await loadThreadDetail(threadId);

    const boardSlug = detail.boardSlug || detail.board?.slug || "";
    if (boardSlug) {
      const board = forumBoards.find((item) => item.slug === boardSlug) || null;

      if (board) {
        selectedBoard = board;
        await loadThreadsByBoard(boardSlug);
      }
    }

    selectedThread = detail;
    replyTarget = null;
    isComposerOpen = false;
    resetComposerForm();

    switchRoute("threads");
    renderForum();

    pushForumNav(detail.title, goForumBoardFromNav, {
      type: "forum-thread",
      key: String(detail.id)
    });
  } catch (error) {
    console.error("加载帖子详情失败：", error);
    alert(error.message || "加载帖子详情失败");
  }
}

window.openForumThreadById = async function(threadId, commentId = null) {
  const id = Number(threadId);
  const cid = Number(commentId || 0) || null;

  if (!Number.isInteger(id) || id <= 0) {
    alert("帖子链接不正确。");
    return;
  }

  if (cid) {
    await navigateForumTarget(`thread:${id}#comment:${cid}`, cid);
  } else {
    await navigateForumTarget(`thread:${id}`);
  }
};

window.addEventListener("forum:open-thread", async (event) => {
  const threadId = Number(event.detail?.threadId);
  const commentId = Number(event.detail?.commentId || 0) || null;

  if (!Number.isInteger(threadId) || threadId <= 0) {
    alert("帖子链接不正确。");
    return;
  }

  if (commentId) {
    await navigateForumTarget(`thread:${threadId}#comment:${commentId}`, commentId);
  } else {
    await navigateForumTarget(`thread:${threadId}`);
  }
});

// 随机整数
function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// AI 帖子的点赞 / 点踩 / 转发
function makeAiThreadStats() {
  return {
    likeCount: randomInt(4, 56),
    dislikeCount: randomInt(0, 7),
    shareCount: randomInt(0, 15)
  };
}

// AI 评论的点赞 / 点踩
function makeAiCommentStats() {
  return {
    likeCount: randomInt(0, 22),
    dislikeCount: randomInt(0, 5)
  };
}

// 当前登录的号主学号
function getHostStudentId() {
  return String(
    state.currentAccount?.studentId ||
    state.account?.studentId ||
    getCurrentStudentId() ||
    ""
  ).trim().toUpperCase();
}

// 根据 AI 给的 characterId，找到真正的角色账号
// 找不到就返回 null，绝对不要回落到号主
function findCharacterAuthorPatch(characterId, friendList = []) {
  const rawId = String(characterId || "").trim();
  if (!rawId) return null;

  const list = Array.isArray(friendList) ? friendList : [];

  const matched = list.find((item) => {
    const ids = [
      item.characterId,
      item.code,
      item.forumId,
      item.name,
      item.id
    ]
      .map((v) => String(v || "").trim().toLowerCase())
      .filter(Boolean);

    return ids.includes(rawId.toLowerCase());
  });

  if (!matched) return null;

  // 只允许剧情角色账号
  if (matched.accountKind && matched.accountKind !== "character_account") {
    return null;
  }

  const studentId = String(matched.code || matched.studentId || "").trim();
  const forumId = String(matched.forumId || matched.name || "").trim();

  if (!studentId || !forumId) return null;

  // 再防一层：绝不能等于号主
  if (studentId.toUpperCase() === getHostStudentId()) {
    return null;
  }

  return {
    authorStudentId: studentId,
    authorForumId: forumId
  };
}

function getCharacterIdentityGroupsForBoard(character) {
  if (!character) return [];

  const settings =
    state.characterAccountSettings?.[
      character.characterId ||
      character.code ||
      character.name ||
      ""
    ] || {};

  const timelines = Array.isArray(character.timelines)
    ? character.timelines
    : [];

  const activeTimelineId =
    settings.timelineId ||
    character.defaultTimelineId ||
    timelines[0]?.id ||
    "";

  const timeline =
    timelines.find((item) => item.id === activeTimelineId) ||
    timelines[0] ||
    null;

  const groups =
    timeline?.identityGroups ||
    character.identityGroups ||
    [];

  return Array.isArray(groups) ? groups : [];
}

function canCharacterPostInBoard(characterId, board, friendList = []) {
  if (!board || board.boardType !== "story") {
    return false;
  }

  if (!board.allowAiPost) {
    return false;
  }

  const character = friendList.find((item) => {
    const ids = [
      item.characterId,
      item.code,
      item.forumId,
      item.name,
      item.id
    ]
      .map((value) => String(value || "").trim().toLowerCase())
      .filter(Boolean);

    return ids.includes(String(characterId || "").trim().toLowerCase());
  });

  if (!character) {
    return false;
  }

  const characterGroups = getCharacterIdentityGroupsForBoard(character);
  const requiredGroups = Array.isArray(board.postGroups)
    ? board.postGroups
    : [];

  // 板块没有设置身份组要求时，角色可以发
  if (!requiredGroups.length) {
    return true;
  }

  return requiredGroups.some((group) =>
    characterGroups.includes(group)
  );
}

async function createThreadInBoard(boardSlug, payload) {
  const res = await fetch(`${API_BASE_URL}/api/boards/${encodeURIComponent(boardSlug)}/threads`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "发帖失败");
  }

  return data.thread;
}

async function pruneBoardThreads(boardSlug, keepCount) {
  const res = await fetch(`${API_BASE_URL}/api/boards/${encodeURIComponent(boardSlug)}/threads/prune`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ keepCount })
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "清理旧帖失败");
  }

  return data;
}

// 把 AI 的 replyTo 变成真正的评论 id
// 支持：
// 1) "post" / 空 = 直接回帖
// 2) 数字 = 楼层号（1楼、2楼）或下标
// 3) 正文里写了“回复3楼：xxx”时，也自动识别
function resolveAiReplyCommentId(replyTo, content, commentList = []) {
  const list = Array.isArray(commentList) ? commentList.filter(Boolean) : [];

  // 先看正文有没有“回复3楼”
  const text = String(content || "");
  const floorFromText = text.match(/回复\s*(\d+)\s*楼/);
  if (floorFromText) {
    const floorNo = Number(floorFromText[1]);
    const byFloor = list.find((item) => Number(item.floorNo) === floorNo);
    if (byFloor?.id) return byFloor.id;

    // 没有 floorNo 时，按顺序第 N 条
    if (floorNo >= 1 && floorNo <= list.length && list[floorNo - 1]?.id) {
      return list[floorNo - 1].id;
    }
  }

  if (replyTo === "post" || replyTo === "" || replyTo == null) {
    return null;
  }

  const num = Number(replyTo);
  if (!Number.isInteger(num) || num <= 0) return null;

  // 优先按楼层号
  const byFloor = list.find((item) => Number(item.floorNo) === num);
  if (byFloor?.id) return byFloor.id;

  // 再按 1 开始的顺序号
  if (num <= list.length && list[num - 1]?.id) {
    return list[num - 1].id;
  }

  // 再按 0 开始的下标
  if (num < list.length && list[num]?.id) {
    return list[num].id;
  }

  return null;
}

// 去掉正文里的“回复3楼：”前缀，只保留真正说话内容
function cleanAiReplyContent(content) {
  return String(content || "")
    .replace(/^\s*回复\s*\d+\s*楼\s*[:：]?\s*/u, "")
    .replace(/^\s*回复\s*[^:：\n]{1,20}\s*[:：]\s*/u, "")
    .trim();
}

// AI 生成后，给帖子补点赞 / 点踩 / 转发
async function updateThreadAiStats(threadId, stats = {}) {
  const res = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}/ai-stats`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({
      likeCount: Number(stats.likeCount) || 0,
      dislikeCount: Number(stats.dislikeCount) || 0,
      shareCount: Number(stats.shareCount) || 0
    })
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "更新帖子互动数据失败");
  }

  return data.thread;
}

async function updateCommentsAiStats(threadId, comments = []) {
  const res = await fetch(
    `${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}/ai-comment-stats`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...getAuthHeaders()
      },
      body: JSON.stringify({ comments })
    }
  );

  const data = await res.json().catch(() => null);
  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "更新评论互动数据失败");
  }
  return data;
}

async function createCommentInThread(threadId, payload) {
  const res = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}/comments`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify(payload)
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "评论发送失败");
  }

  return data.comment;
}

async function shareThread(threadId) {
  const res = await fetch(`${API_BASE_URL}/api/threads/${threadId}/share`, {
    method: "POST",
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "记录转发失败");
  }

  return data.thread;
}

async function toggleThreadFavorite(threadId, shouldFavorite) {
  const res = await fetch(`${API_BASE_URL}/api/threads/${threadId}/favorite`, {
    method: shouldFavorite ? "POST" : "DELETE",
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "收藏操作失败");
  }

  return data.thread;
}

async function likeThread(threadId) {
  const res = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}/like`, {
    method: "POST",
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "点赞失败");
  }

  return data.thread;
}

async function dislikeThread(threadId) {
  const res = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}/dislike`, {
    method: "POST",
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "点踩失败");
  }

  return data.thread;
}

async function setThreadPinned(threadId, pinned) {
  const res = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}/pin`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({
      pinned: Boolean(pinned)
    })
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "置顶操作失败");
  }

  return data.thread;
}

async function editThreadContent(threadId, content) {
  const res = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}/content`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ content })
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "编辑正文失败");
  }

  return data.thread;
}

async function editThreadTitle(threadId, title) {
  const res = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}/title`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      ...getAuthHeaders()
    },
    body: JSON.stringify({ title })
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "修改标题失败");
  }

  return data.thread;
}

async function setThreadLocked(threadId, locked) {
  const path = locked ? "lock" : "unlock";

  const res = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}/${path}`, {
    method: "POST",
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || (locked ? "封贴失败" : "解封失败"));
  }

  return data.thread;
}

async function likeComment(commentId) {
  const res = await fetch(`${API_BASE_URL}/api/comments/${encodeURIComponent(commentId)}/like`, {
    method: "POST",
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "评论点赞失败");
  }

  return data.comment;
}

async function dislikeComment(commentId) {
  const res = await fetch(`${API_BASE_URL}/api/comments/${encodeURIComponent(commentId)}/dislike`, {
    method: "POST",
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data.message || "评论点踩失败");
  }

  return data.comment;
}

async function deleteThreadById(threadId) {
  const res = await fetch(`${API_BASE_URL}/api/threads/${encodeURIComponent(threadId)}`, {
    method: "DELETE",
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await res.json();

  if (!res.ok || !data.success) {
    throw new Error(data?.message || "删除帖子失败");
  }

  return data;
}

function resetComposerForm() {
  const titleInput = document.getElementById("composerTitleInput");
  const tagsInput = document.getElementById("composerTagsInput");
  const contentInput = document.getElementById("composerContentInput");

  if (titleInput) titleInput.value = "";
  if (tagsInput) tagsInput.value = "";
  if (contentInput) contentInput.value = "";
}

function makeContentPreview(content = "", maxLen = 80) {
  const text = String(content || "")
    .replace(/\s+/g, " ")
    .trim();

  if (!text) return "";
  if (text.length <= maxLen) return text;
  return `${text.slice(0, maxLen)}...`;
}

function collectComposerPayload() {
  const title = String(document.getElementById("composerTitleInput")?.value || "").trim();
  const tags = String(document.getElementById("composerTagsInput")?.value || "").trim();
  const content = String(document.getElementById("composerContentInput")?.value || "").trim();

  return {
    title,
    summary: makeContentPreview(content),
    tags,
    content,
    postType: "normal",
    visibility: "public"
  };
}

function renderComposerView() {
  const boardView = document.getElementById("forumBoardSelectView");
  const listView = document.getElementById("forumThreadListView");
  const detailView = document.getElementById("forumThreadDetailView");
  const composerView = document.getElementById("forumComposerView");

  if (!boardView || !listView || !detailView || !composerView) return;

  boardView.hidden = true;
  listView.hidden = true;
  detailView.hidden = true;
  composerView.hidden = false;
}

function renderForum() {
  renderBreadcrumb();
  renderActionBar();
  renderBoardDrawer();

  // 搜索模式：整个内容区只显示搜索页
  if (currentForumSearchKeyword) {
    isComposerOpen = false;
    hideForumViewsForSearchPage();
    renderForumGlobalSearchPanel(currentForumSearchKeyword);
    return;
  }

  renderPinnedBox();

  if (specialView) {

    isComposerOpen = false;

    if (specialView === "archive") {
      renderArchiveView();
      return;
    }

    if (specialView === "favorites") {
      renderFavoriteLibraryView();
      return;
    }
  }

  if (!selectedBoard) {
    selectedThread = null;
    isComposerOpen = false;
    renderBoardSelectView();
    return;
  }

  if (isComposerOpen) {
    renderComposerView();
    return;
  }

  if (!selectedThread) {
    renderThreadListView();
    return;
  }

  renderThreadDetailView();

}

function renderBreadcrumb() {
  if (window.ForumNav?.render) {
    window.ForumNav.render();
    return;
  }

  const el = document.getElementById("forumBreadcrumb");
  if (!el) return;

  if (!selectedBoard) {
    el.textContent = "守夜人论坛";
    return;
  }

  if (!selectedThread) {
    el.textContent = `守夜人论坛 → ${selectedBoard.name}`;
    return;
  }

  el.textContent = `守夜人论坛 → ${selectedBoard.name} → ${selectedThread.title}`;
}

function renderActionBar() {
  const actionBar = document.getElementById("forumActionBar");
  const backBtn = document.getElementById("forumBackBtn");
  const newThreadBtn = document.getElementById("newThreadBtn");
  const deleteBoardBtn = document.getElementById("deleteBoardBtn");

  if (!actionBar || !backBtn || !newThreadBtn) return;

    // 搜索模式下：只显示"返回"，不显示"新建帖子"
  if (currentForumSearchKeyword) {
    actionBar.hidden = false;
    backBtn.textContent = "返回";
    backBtn.hidden = false;
    newThreadBtn.hidden = true;
    return;
  }

    if (!selectedBoard && !specialView) {
    actionBar.hidden = true;
    return;
  }

  actionBar.hidden = false;

  if (specialView) {
    newThreadBtn.hidden = true;
    backBtn.textContent = "返回";
    return;
  }

  backBtn.textContent = "返回";

  if (selectedThread || isComposerOpen) {
    newThreadBtn.hidden = true;
    deleteBoardBtn.style.display = "none";
  } else {
    newThreadBtn.hidden = false;
    // 管理员或版主才显示删除按钮
    if (selectedBoard && (isCurrentUserManager() || isBoardModerator(selectedBoard))) {
      deleteBoardBtn.style.display = "";
    } else {
      deleteBoardBtn.style.display = "none";
    }
  }

}

function renderBoardDrawer() {
  const row = document.getElementById("forumBoardDrawerRow");
  const dropdown = document.getElementById("boardPickerDropdown");
  const label = document.getElementById("boardDrawerLabel");

  if (!row || !dropdown || !label) return;

  if (!selectedBoard || selectedThread) {
    row.hidden = true;
    dropdown.hidden = true;
    return;
  }

  row.hidden = false;
  label.textContent = selectedBoard.name;

  dropdown.innerHTML = forumBoards.map(board => `
    <button class="board-picker-item compact" data-board-slug="${board.slug}" type="button">
      <span>${board.name}</span>
    ${
      isCurrentUserManager
        ? `<button class="board-delete-btn" data-board-slug="${escapeHtml(board.slug)}" data-board-name="${escapeHtml(board.name)}" title="删除板块" style="margin-left:4px;color:var(--red,#c00);background:none;border:none;cursor:pointer;font-size:14px">✕</button>`
        : ""
    }
    </button>
  `).join("");

  dropdown.querySelectorAll("[data-board-slug]").forEach(item => {
  item.addEventListener("click", async () => {
    const slug = item.dataset.boardSlug;
    dropdown.hidden = true;
    await openBoardBySlug(slug);
  });
});

}

function renderPinnedBox() {
  const box = document.getElementById("forumPinnedBox");
  const list = document.getElementById("forumPinnedList");

  if (!box || !list) return;

    if (selectedBoard || specialView) {
    box.hidden = true;
    return;
  }

  box.hidden = false;

  list.innerHTML = globalPinnedItems.length
  ? globalPinnedItems.slice(0, 3).map(item => `
      <button
        class="forum-pinned-item forum-pinned-link"
        type="button"
        data-pinned-board-slug="${item.board?.slug || item.boardSlug || ""}"
        data-pinned-thread-id="${item.id}"
      >
        <span class="forum-pinned-type">置顶</span>
        <span class="forum-pinned-title">${item.title}</span>
        <span class="forum-pinned-board">${item.board?.name || ""}</span>
      </button>
    `).join("")
  : `<div class="empty-tip">暂无置顶内容。</div>`;

  list.querySelectorAll("[data-pinned-thread-id]").forEach(item => {
  item.addEventListener("click", async () => {
    const boardSlug = item.dataset.pinnedBoardSlug;
    const threadId = Number(item.dataset.pinnedThreadId);

    if (!boardSlug || !threadId) return;

    await openBoardBySlug(boardSlug);
    await openThreadById(threadId);
  });
});

}

function formatAccessGroups(board) {
  if (!board?.accessGroups?.length) return "公开访问";
  return board.accessGroups.join(" / ");
}

function renderCreateBoardView() {
  const boardView = document.getElementById("forumBoardSelectView");
  const listView = document.getElementById("forumThreadListView");
  const detailView = document.getElementById("forumThreadDetailView");
  const composerView = document.getElementById("forumComposerView");

  if (!boardView || !listView || !detailView || !composerView) return;

  listView.hidden = true;
  detailView.hidden = true;
  composerView.hidden = true;
  boardView.hidden = false;

  boardView.innerHTML = `
    <div class="create-board-page">
      <div class="create-board-header">
        <div>
          <div class="panel-title">创建板块</div>
          <div class="create-board-subtitle">
            填写完成后提交审核
          </div>
        </div>

        <button
          id="cancelCreateBoardBtn"
          class="win-btn"
          type="button"
        >
          返回
        </button>
      </div>

      <div class="create-board-form">
        <label class="field-label">板块名称</label>
        <input
          id="createBoardNameInput"
          class="retro-input"
          placeholder="例如：执行部"
        />

        <label class="field-label">板块说明</label>
        <textarea
          id="createBoardDescriptionInput"
          class="retro-input create-board-textarea"
          placeholder="简单说明这个板块用来做什么"
        ></textarea>

        <label class="field-label">板块类型</label>
        <select id="createBoardTypeInput" class="retro-input">
          <option value="story">剧情板块</option>
          <option value="real">真人板块</option>
        </select>

        <label class="field-label">进入要求</label>
        <input
          id="createBoardAccessGroupsInput"
          class="retro-input"
          placeholder="例如：已认证；留空表示不限制"
        />

        <label class="field-label">发帖要求</label>
        <input
          id="createBoardPostGroupsInput"
          class="retro-input"
          placeholder="例如：学生；留空表示不限制"
        />

        <label class="field-label">评论要求</label>
        <input
          id="createBoardCommentGroupsInput"
          class="retro-input"
          placeholder="例如：已认证；留空表示不限制"
        />

        <label class="field-label">申请理由</label>
        <textarea
          id="createBoardReasonInput"
          class="retro-input create-board-textarea"
          placeholder="请说明为什么要创建这个板块"
        ></textarea>

        <button
          id="submitCreateBoardBtn"
          class="retro-btn"
          type="button"
        >
          提交审核
        </button>

        <div id="createBoardResult" class="create-board-result" hidden></div>
      </div>
    </div>
  `;

  document
    .getElementById("cancelCreateBoardBtn")
    ?.addEventListener("click", () => {
      renderBoardSelectView();
    });

  document
    .getElementById("submitCreateBoardBtn")
    ?.addEventListener("click", async () => {
      const name = document
        .getElementById("createBoardNameInput")
        ?.value.trim();

      const description = document
        .getElementById("createBoardDescriptionInput")
        ?.value.trim();

      const type = document
        .getElementById("createBoardTypeInput")
        ?.value;

      const accessGroups = document
        .getElementById("createBoardAccessGroupsInput")
        ?.value.trim();

      const postGroups = document
        .getElementById("createBoardPostGroupsInput")
        ?.value.trim();

      const commentGroups = document
        .getElementById("createBoardCommentGroupsInput")
        ?.value.trim();

      const reason = document
        .getElementById("createBoardReasonInput")
        ?.value.trim();

      const result = document.getElementById("createBoardResult");
      const submitBtn = document.getElementById("submitCreateBoardBtn");

      if (!name) {
        result.hidden = false;
        result.textContent = "请填写板块名称。";
        return;
      }

      if (!description) {
        result.hidden = false;
        result.textContent = "请填写板块说明。";
        return;
      }

      if (!reason) {
        result.hidden = false;
        result.textContent = "请填写申请理由。";
        return;
      }

      const splitGroups = (text) =>
        String(text || "")
          .split(/[;；,，]/)
          .map((item) => item.trim())
          .filter(Boolean);

      const payload = {
        name,
        description,
        boardType: type,
        accessGroups: splitGroups(accessGroups),
        postGroups: splitGroups(postGroups),
        commentGroups: splitGroups(commentGroups),
        reason,
        tavernContext: readTavernContextText()
      };

      submitBtn.disabled = true;
      submitBtn.textContent = "提交中...";
      result.hidden = false;
      result.textContent =
        type === "story"
          ? "正在把申请交给诺玛审核..."
          : "正在提交给管理组...";

      try {
        const response = await fetch(`${API_BASE_URL}/api/board-applications`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getForumAuthHeaders()
          },
          body: JSON.stringify(payload)
        });

        const data = await response.json();

        if (!response.ok || !data.success) {
          result.textContent = data.message || "提交失败。";
          submitBtn.disabled = false;
          submitBtn.textContent = "提交审核";
          return;
        }

        result.textContent = data.message || "提交成功。";
        submitBtn.textContent = "已提交";
      } catch (error) {
        console.error("提交板块申请失败：", error);
        result.textContent = "无法连接到后端，请确认后端已经启动。";
        submitBtn.disabled = false;
        submitBtn.textContent = "提交审核";
      }
    });
}

function renderBoardSelectView() {
  const boardView = document.getElementById("forumBoardSelectView");
  const listView = document.getElementById("forumThreadListView");
  const detailView = document.getElementById("forumThreadDetailView");
  const composerView = document.getElementById("forumComposerView");

  if (!boardView || !listView || !detailView || !composerView) return;

boardView.hidden = false;
listView.hidden = true;
detailView.hidden = true;
composerView.hidden = true;


  if (!forumBoards.length) {
    boardView.innerHTML = `<div class="empty-tip">暂无板块数据。</div>`;
    return;
  }

    boardView.innerHTML = `
    <div class="board-select-grid">
      ${forumBoards.map(board => `
        <button class="board-select-card" data-board-slug="${board.slug}" type="button">
          <div class="board-select-title">${board.name}</div>
          <div class="board-select-desc">${board.description || "暂无板块说明。"}</div>
          <div class="board-select-meta">
            <span>${board.boardType === "real" ? "REAL" : "STORY"}</span>
            <span>${board.forceAnonymous ? "匿名" : "常规"}</span>
            <span>${formatAccessGroups(board)}</span>
          </div>
        </button>
      `).join("")}
    </div>

    <button
      class="board-create-card"
      id="createBoardBtn"
      type="button"
    >
      <strong>＋ 创建板块</strong>
      <span>创建新的剧情板块或真人板块</span>
    </button>

    <section class="forum-special-zone">
      <button class="forum-special-card" data-special-entry="archive" type="button">
        <div class="forum-special-label">ARCHIVE</div>
        <div class="forum-special-title">档案馆</div>
        <div class="forum-special-desc">
          收录个人履历、执行部任务、学院大事件与保密记录。
        </div>
        <div class="forum-special-meta">
          <span>管理组限定</span>
          <span>占位开放</span>
        </div>
      </button>

      <button class="forum-special-card" data-special-entry="favorites" type="button">
        <div class="forum-special-label">PRIVATE</div>
        <div class="forum-special-title">收藏库</div>
        <div class="forum-special-desc">
          只属于当前账号的私人收藏夹，收藏数量不会公开显示。
        </div>
        <div class="forum-special-meta">
          <span>仅本人可见</span>
          <span>收藏帖子</span>
        </div>
      </button>
    </section>
  `;

    boardView.querySelector("#createBoardBtn")?.addEventListener("click", () => {
    renderCreateBoardView();
  });

  boardView.querySelectorAll("[data-board-slug]").forEach(item => {
  item.addEventListener("click", async () => {
    await openBoardBySlug(item.dataset.boardSlug);
  });
});

  boardView.querySelector('[data-special-entry="archive"]')?.addEventListener("click", () => {
    openArchiveHome();
  });

  boardView.querySelector('[data-special-entry="favorites"]')?.addEventListener("click", async () => {
    await openFavoriteLibrary();
  });

}

function hideForumMainViews() {
  const boardView = document.getElementById("forumBoardSelectView");
  const listView = document.getElementById("forumThreadListView");
  const detailView = document.getElementById("forumThreadDetailView");
  const composerView = document.getElementById("forumComposerView");

  if (boardView) boardView.hidden = false;
  if (listView) listView.hidden = true;
  if (detailView) detailView.hidden = true;
  if (composerView) composerView.hidden = true;

  return { boardView, listView, detailView, composerView };
}

function showArchiveHomeFromNav() {
  hideCommentActionMenu();
  selectedBoard = null;
  selectedThread = null;
  replyTarget = null;
  isComposerOpen = false;
  specialView = "archive";
  archiveSection = "";
  renderForum();
}

async function showFavoriteLibraryFromNav() {
  hideCommentActionMenu();
  selectedBoard = null;
  selectedThread = null;
  replyTarget = null;
  isComposerOpen = false;
  specialView = "favorites";
  archiveSection = "";

  try {
    await loadMyFavoriteThreads();
  } catch (error) {
    console.error("返回收藏库失败：", error);
  }

  renderForum();
}

function openArchiveHome() {
  showArchiveHomeFromNav();

  if (window.ForumNav?.popTo) window.ForumNav.popTo(0);

  pushForumNav("档案馆", goForumHomeFromNav, {
    type: "special",
    key: "archive"
  });
}

function openArchiveSection(section) {
  archiveSection = section;

  const label = section === "personal" ? "个人档案" : "事件档案";

  pushForumNav(label, showArchiveHomeFromNav, {
    type: "archive-section",
    key: section
  });

  renderForum();
}

function renderArchiveView() {
  const { boardView } = hideForumMainViews();
  if (!boardView) return;

  const isManager = isCurrentUserManager();

  if (!isManager) {
    boardView.innerHTML = `
      <section class="panel-box archive-placeholder-box">
        <div class="archive-page-head">
          <div class="panel-title">档案馆</div>
          <button class="retro-btn small ghost" data-special-back-home type="button">返回首页</button>
        </div>

        <div class="archive-warning">权限不足：档案馆暂未对非管理组开放。</div>
        <div class="archive-placeholder-text">
          这里将用于收录个人履历、事件档案、执行部任务和学院保密记录。
        </div>
      </section>

    `;
    return;
  }

  if (archiveSection) {
    const title = archiveSection === "personal" ? "个人档案" : "事件档案";
    const desc = archiveSection === "personal"
      ? "这里后期用于记录角色个人履历、身份变更、履历备注等。"
      : "这里后期用于记录大事件、执行部任务、任务档案与时间线。";

        boardView.innerHTML = `
      <section class="panel-box archive-placeholder-box">
        <div class="archive-page-head">
          <div class="panel-title">${title}</div>
          <button class="retro-btn small ghost" data-archive-back type="button">返回档案馆</button>
        </div>

        <div class="archive-placeholder-text">${desc}</div>
        <div class="archive-empty-file">

          <div class="archive-empty-title">暂无开放档案</div>
          <div>档案系统占位中，后期再接入具体档案列表和详情页。</div>
        </div>
      </section>
    `;

        boardView.querySelector("[data-archive-back]")?.addEventListener("click", () => {
      if (window.ForumNav?.back) {
        window.ForumNav.back();
        return;
      }

      showArchiveHomeFromNav();
    });

    return;
  }

    boardView.innerHTML = `
    <section class="panel-box archive-placeholder-box">
      <div class="archive-page-head">
        <div class="panel-title">档案馆</div>
        <button class="retro-btn small ghost" data-special-back-home type="button">返回首页</button>
      </div>

      <div class="archive-placeholder-text">

        管理组限定区域。请选择要进入的档案分类。
      </div>

      <div class="archive-entry-grid">
        <button class="archive-entry-card" data-archive-section="personal" type="button">
          <div class="forum-special-label">PROFILE</div>
          <div class="forum-special-title">个人档案</div>
          <div class="forum-special-desc">个人履历、身份记录、角色档案。</div>
        </button>

        <button class="archive-entry-card" data-archive-section="event" type="button">
          <div class="forum-special-label">EVENT</div>
          <div class="forum-special-title">事件档案</div>
          <div class="forum-special-desc">大事件、执行部任务、行动记录。</div>
        </button>
      </div>
    </section>
  `;

  boardView.querySelectorAll("[data-archive-section]").forEach((btn) => {
    btn.addEventListener("click", () => {
      openArchiveSection(btn.dataset.archiveSection);
    });
  });
    boardView.querySelector("[data-special-back-home]")?.addEventListener("click", () => {
    if (window.ForumNav?.popTo) {
      window.ForumNav.popTo(0);
    }

    goForumHomeFromNav();
  });

}

async function loadMyFavoriteThreads() {
  const res = await fetch(`${API_BASE_URL}/api/me/favorites`, {
    headers: {
      ...getAuthHeaders()
    }
  });

  const data = await res.json().catch(() => null);

  if (!res.ok || !data?.success) {
    throw new Error(data?.message || "读取收藏库失败");
  }

  favoriteThreads = Array.isArray(data.threads) ? data.threads : [];
  return favoriteThreads;
}

async function openFavoriteLibrary() {
  if (window.ForumNav?.popTo) window.ForumNav.popTo(0);

  pushForumNav("收藏库", goForumHomeFromNav, {
    type: "special",
    key: "favorites"
  });

  try {
    await showFavoriteLibraryFromNav();
  } catch (error) {
    console.error("打开收藏库失败：", error);
    alert(error.message || "打开收藏库失败");
  }
}

async function openFavoriteThread(threadId) {
  const id = Number(threadId);
  if (!id) return;

  try {
    const detail = await loadThreadDetail(id);
    selectedThread = detail;
    selectedBoard = {
      name: "收藏库",
      slug: "__favorites",
      canCurrentUserPost: false
    };
    specialView = "favorites";
    archiveSection = "";
    replyTarget = null;
    isComposerOpen = false;

    pushForumNav(detail.title, showFavoriteLibraryFromNav, {
      type: "favorite-thread",
      key: String(detail.id)
    });

    renderForum();
  } catch (error) {
    console.error("打开收藏帖子失败：", error);
    alert(error.message || "打开收藏帖子失败");
  }
}

function renderFavoriteLibraryView() {
  if (selectedThread) {
    renderThreadDetailView();
    return;
  }

  const { boardView } = hideForumMainViews();
  if (!boardView) return;

    boardView.innerHTML = `
    <section class="panel-box favorite-library-box">
      <div class="archive-page-head">
        <div class="panel-title">收藏库</div>
        <button class="retro-btn small ghost" data-special-back-home type="button">返回首页</button>
      </div>

      <div class="favorite-library-desc">

        这里仅当前账号本人可见。帖子收藏数量不会公开显示。
      </div>

      <div class="favorite-thread-list">
        ${
          favoriteThreads.length
            ? favoriteThreads.map((thread) => `
              <button class="favorite-thread-card" data-favorite-thread-id="${thread.id}" type="button">
                <div class="favorite-thread-title">${escapeHtml(thread.title || "")}</div>
                <div class="favorite-thread-summary">${escapeHtml(makeContentPreview(thread.content || thread.summary || "", 90) || "暂无正文预览。")}</div>
                <div class="favorite-thread-meta">
                  <span>${escapeHtml(thread.boardName || "")}</span>
                  <span>${escapeHtml(getForumAuthorAlias(thread.authorStudentId) || thread.author || "")}</span>
                  <span>${escapeHtml(thread.time || "")}</span>
                </div>
              </button>
            `).join("")
            : `<div class="empty-tip">收藏库还是空的。打开帖子后点击“收藏”即可加入。</div>`
        }
      </div>
    </section>
  `;

  boardView.querySelectorAll("[data-favorite-thread-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      await openFavoriteThread(btn.dataset.favoriteThreadId);
    });
  });
    boardView.querySelector("[data-special-back-home]")?.addEventListener("click", () => {
    if (window.ForumNav?.popTo) {
      window.ForumNav.popTo(0);
    }

    goForumHomeFromNav();
  });

}

function renderThreadListView() {
  const boardView = document.getElementById("forumBoardSelectView");
  const listView = document.getElementById("forumThreadListView");
  const detailView = document.getElementById("forumThreadDetailView");
  const composerView = document.getElementById("forumComposerView");
  const listEl = document.getElementById("forumThreadList");


  if (!boardView || !listView || !detailView || !composerView || !listEl) return;

boardView.hidden = true;
listView.hidden = false;
detailView.hidden = true;
composerView.hidden = true;


  const threads = sortThreadsWithPinnedFirst(boardThreads);

  listEl.innerHTML = threads.length
    ? threads.map(thread => `
        <article class="thread-card thread-feed-card ${thread.isPinned ? "is-pinned" : ""}" data-thread-id="${thread.id}">
  <div class="thread-card-left">
    <img class="thread-author-avatar" src="${thread.authorAvatar}" alt="${thread.author}" />
  </div>

  <div class="thread-card-right">
    <div class="thread-card-meta-top">
      <span class="thread-author-inline">${renderAuthorNameWithDisplayGroup(thread.author, thread.authorDisplayGroup, thread.authorStudentId)}</span>
      <span class="thread-meta-divider">/</span>
      <span class="thread-time-inline">${thread.time}</span>
    </div>

    <div class="thread-card-title-row">
      ${thread.tags?.length ? `<span class="thread-first-tag">${thread.tags[0]}</span>` : ""}
      <div class="thread-card-title">${thread.title}</div>
    </div>

    <div class="thread-card-summary clamp-2">${escapeHtml(makeContentPreview(thread.content || thread.summary || "", 90))}</div>

    <div class="thread-card-stats">
  <span>👍 ${thread.likeCount}</span>
  <span>👎 ${thread.dislikeCount}</span>
  <button
  class="thread-card-share-link"
  type="button"
  data-jump-thread-id="${thread.id}"
>
  ↗
</button>

  ${thread.isPinned ? `<span class="thread-pin-mark thread-pin-mark-bottom">置顶</span>` : ""}
</div>

  </div>
</article>

      `).join("")
    : `<div class="empty-tip">该板块下暂无帖子。</div>`;

    listEl.querySelectorAll("[data-jump-thread-id]").forEach((btn) => {
  btn.addEventListener("click", async (event) => {
    event.stopPropagation();

    const threadId = Number(btn.dataset.jumpThreadId);
    if (!threadId) return;

    await navigateForumTarget(`thread:${threadId}`);
  });
});

  listEl.querySelectorAll("[data-thread-id]").forEach(item => {
  item.addEventListener("click", async () => {
    const threadId = Number(item.dataset.threadId);
    if (!threadId) return;
    await openThreadById(threadId);
  });
});

}

function getShareFriendDisplayName(friend) {
  return friend?.forumId || friend?.remark || friend?.name || "未知联系人";
}

function getShareFriendCode(friend) {
  return friend?.code || friend?.friendCode || friend?.characterId || friend?.forumId || "";
}

function getShareFriendAvatar(friend) {
  return friend?.avatar || friend?.friendAvatar || "";
}

function getThreadShareLink(thread = selectedThread) {
  const threadId = thread?.id || "";
  return `cassell-forum://thread/${threadId}`;
}

function getThreadSharePayload(thread = selectedThread) {
  if (!thread) return null;

  return {
    threadId: thread.id,
    id: thread.id,
    title: thread.title || "未命名帖子",
    boardName: thread.boardName || selectedBoard?.name || "未知板块",
    author: thread.author || "未知作者",
    summary: makeContentPreview(thread.content || thread.summary || "", 90) || "暂无正文预览。"
  };
}

function getCommentSharePayload(comment, thread = selectedThread) {
  if (!comment || !thread) return null;

  const rawText = String(
    comment.text ||
    comment.content ||
    comment.body ||
    comment.message ||
    ""
  ).trim();

  return {
    commentId: comment.id,
    id: comment.id,
    author: comment.author || comment.authorName || "未知用户",
    text: makeContentPreview(rawText, 120) || "暂无内容",
    floorNo: comment.floorNo || comment.floor || "",
    threadId: thread.id,
    threadTitle: thread.title || "未命名帖子",
    boardName: thread.boardName || selectedBoard?.name || "未知板块"
  };
}

function getMixedShareTargets() {
  const friendTargets = (friends || []).map((friend, index) => ({
    type: "friend",
    index,
    name: getShareFriendDisplayName(friend),
    code: getShareFriendCode(friend) || "好友",
    avatar: getShareFriendAvatar(friend) || "",
    sortTime: Number(getFriendShareSortTime?.(friend) || 0),
    badge: "好友"
  }));

  const groupTargets = (groups || []).map((group, index) => ({
    type: "group",
    index,
    name: group?.name || "未命名群聊",
    code: `${Number(group?.members || 0)} 人`,
    avatar: group?.avatar || "",
    sortTime: Number(getGroupShareSortTime?.(group) || 0),
    badge: "群聊"
  }));

  return [...friendTargets, ...groupTargets].sort((a, b) => {
    if (b.sortTime !== a.sortTime) return b.sortTime - a.sortTime;
    return String(a.name || "").localeCompare(String(b.name || ""), "zh");
  });
}

function renderShareTargetListHtml() {
  const targets = getMixedShareTargets();

  if (!targets.length) {
    return `<div class="empty-tip">暂无可转发的好友或群聊。</div>`;
  }

  return targets
    .map((target) => {
      const avatar = target.avatar || "";
      const name = target.name || "未知";
      const badge = target.badge || "";

      return `
        <button
          class="thread-share-avatar-item"
          data-share-target-type="${escapeHtml(target.type)}"
          data-share-target-index="${target.index}"
          type="button"
          title="${escapeHtml(name)}"
        >
          <span class="thread-share-avatar-wrap">
            ${
              avatar
                ? `<img class="thread-share-avatar-img" src="${escapeHtml(avatar)}" alt="${escapeHtml(name)}" />`
                : `<span class="thread-share-avatar-fallback">${escapeHtml(name.slice(0, 1))}</span>`
            }
            <span class="thread-share-avatar-tag">${escapeHtml(badge)}</span>
          </span>
          <span class="thread-share-avatar-name">${escapeHtml(name)}</span>
        </button>
      `;
    })
    .join("");
}

function bindShareTargetButtons(rootEl) {
  const root = rootEl || document;
  const buttons = root.querySelectorAll("[data-share-target-type]");

  buttons.forEach((btn) => {
    btn.addEventListener("click", async (event) => {
    if (isCurrentUserGuest()) {
        alert("游客不能转发内容，请先发送 /实名认证 完成认证。");
        return;
      }

      event.preventDefault();
      event.stopPropagation();

      if (!selectedThread?.id) return;

      const targetType = btn.dataset.shareTargetType;
      const index = Number(btn.dataset.shareTargetIndex);

      try {
        if (shareMode === "comment") {
          const comment =
            shareCommentTarget ||
            (selectedThread.comments || []).find(
              (item) => Number(item.id) === Number(activeCommentAction?.id)
            );

          if (!comment) {
            alert("没有找到要转发的评论。");
            return;
          }

          const payload = getCommentSharePayload(comment, selectedThread);
          if (!payload) {
            alert("评论信息异常。");
            return;
          }

          if (targetType === "friend") {
            const friend = friends[index];
            if (!friend) {
              alert("没有找到这个好友。");
              return;
            }

            const displayName = getShareFriendDisplayName(friend);
            const ok = window.confirm(`确定要把这条评论转发给「${displayName}」吗？`);
            if (!ok) return;

            sendForumCommentShareToContact(friend, payload);
            alert(`已把评论转发给 ${displayName}。`);
          } else if (targetType === "group") {
            const group = groups[index];
            if (!group) {
              alert("没有找到这个群聊。");
              return;
            }

            const ok = window.confirm(`确定要把这条评论转发到群「${group.name}」吗？`);
            if (!ok) return;

            sendForumCommentShareToGroup(group, payload);
            alert(`已把评论转发到群「${group.name}」。`);
          }
        } else {
          const payload = getThreadSharePayload(selectedThread);
          if (!payload) {
            alert("帖子信息异常。");
            return;
          }

          if (targetType === "friend") {
            const friend = friends[index];
            if (!friend) {
              alert("没有找到这个好友。");
              return;
            }

            const displayName = getShareFriendDisplayName(friend);
            const ok = window.confirm(`确定要把这个帖子转发给「${displayName}」吗？`);
            if (!ok) return;

            sendForumThreadShareToContact(friend, payload);
            alert(`已转发给 ${displayName}。`);
          } else if (targetType === "group") {
            const group = groups[index];
            if (!group) {
              alert("没有找到这个群聊。");
              return;
            }

            const ok = window.confirm(`确定要把这个帖子转发到群「${group.name}」吗？`);
            if (!ok) return;

            sendForumThreadShareToGroup(group, payload);
            alert(`已转发到群「${group.name}」。`);
          }

          // 只有转发帖子时，转发数 +1
          const updatedThread = await shareThread(selectedThread.id);
          selectedThread = {
            ...mergeThreadKeepingPinned(selectedThread, updatedThread),
            comments: selectedThread.comments || []
          };
          threadDetailCache.set(selectedThread.id, selectedThread);
          boardThreads = boardThreads.map((item) =>
            Number(item.id) === Number(updatedThread.id)
              ? mergeThreadKeepingPinned(item, updatedThread)
              : item
          );
        }

        const panel = document.getElementById("threadSharePanel");
        if (panel) panel.hidden = true;

        shareMode = "thread";
        shareCommentTarget = null;
        renderThreadDetailView();
      } catch (error) {
        console.error("转发失败：", error);
        alert(error.message || "转发失败");
      }
    });
  });
}

function getThreadShareText(thread = selectedThread) {
  if (!thread) return "";

  return getThreadShareLink(thread);
}

async function copyTextToClipboard(text) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  textarea.style.top = "-9999px";
  document.body.appendChild(textarea);
  textarea.focus();
  textarea.select();
  document.execCommand("copy");
  textarea.remove();
}

function renderThreadDetailView() {
  const boardView = document.getElementById("forumBoardSelectView");
  const listView = document.getElementById("forumThreadListView");
  const detailView = document.getElementById("forumThreadDetailView");
  const composerView = document.getElementById("forumComposerView");
  const detailEl = document.getElementById("forumThreadDetail");


  if (!boardView || !listView || !detailView || !composerView || !detailEl || !selectedThread) return;

boardView.hidden = true;
listView.hidden = true;
detailView.hidden = false;
composerView.hidden = true;


    const hasAuthorEdited = Number(selectedThread.authorEditCount || 0) > 0;
  const isLocked = Boolean(selectedThread.isLocked);

  detailEl.innerHTML = `
    <h2>
      ${escapeHtml(selectedThread.title)}
      ${isLocked ? `<span class="thread-locked-badge">已封贴</span>` : ""}
    </h2>

    <div class="thread-detail-author-row">
      <img
        class="thread-detail-author-avatar"
        src="${selectedThread.authorAvatar}"
        alt="${selectedThread.author}"
      />
      <div class="thread-detail-author-meta">
        <div class="thread-detail-author-name-line">
          <div class="thread-detail-author-name">
            ${renderAuthorNameWithDisplayGroup(selectedThread.author, selectedThread.authorDisplayGroup, selectedThread.authorStudentId)}
          </div>

          ${hasAuthorEdited ? `<span class="thread-edited-badge">已编辑</span>` : ""}
        </div>
        <div class="thread-detail-author-submeta">
          <span>${selectedBoard?.name || "-"}</span>
          <span>${selectedThread.time}</span>
          ${
            hasAuthorEdited
              ? `<span class="thread-edited-time">编辑于 ${escapeHtml(selectedThread.authorEditedTime || selectedThread.authorEditedAt || "")}</span>`
              : ""
          }
        </div>
      </div>
    </div>

    <div class="thread-content">${renderTextWithAccountAt(selectedThread.content)}</div>
    <div class="thread-tags-bar">
      ${(selectedThread.tags || []).map(tag => `
        <span class="thread-detail-tag">${tag}</span>
      `).join("")}
    </div>

    <div class="thread-actions-bar">
      <div class="thread-actions-left">
    <button
  id="threadLikeBtn"
  class="thread-action-btn ${selectedThread.currentUserReaction === "like" ? "active-like" : ""}"
  type="button"
>
  👍 ${selectedThread.likeCount}
</button>

<button
  id="threadDislikeBtn"
  class="thread-action-btn ${selectedThread.currentUserReaction === "dislike" ? "active-dislike" : ""}"
  type="button"
>
  👎 ${selectedThread.dislikeCount}
</button>
  <button id="threadShareBtn" class="thread-action-btn" type="button">
  ↗ ${selectedThread.shareCount ? selectedThread.shareCount : ""}</button>
</div>
<div class="thread-actions-right">
  <button
  id="threadFavoriteBtn"
  class="thread-action-btn ${selectedThread.isFavorited ? "active-favorite" : ""}"
  type="button"
>
  ${selectedThread.isFavorited ? "★ 已收藏" : "☆ 收藏"}
</button>

  ${
    canEditThreadContent(selectedThread)
      ? `<button id="editThreadContentBtn" class="thread-action-btn" type="button">编辑正文</button>`
      : ""
  }
  ${
    canEditThreadTitle(selectedThread)
      ? `<button id="editThreadTitleBtn" class="thread-action-btn" type="button">修改标题</button>`
      : ""
  }
  ${
    canPinThread(selectedThread)
      ? `<button id="pinThreadBtn" class="thread-action-btn" type="button">${selectedThread.isPinned ? "取消置顶" : "置顶帖子"}</button>`
      : ""
  }
  ${
    canLockThread(selectedThread)
      ? `<button id="lockThreadBtn" class="thread-action-btn" type="button">${selectedThread.isLocked ? "解封帖子" : "封贴"}</button>`
      : ""
  }
  ${
    canDeleteThread(selectedThread)
      ? `<button id="deleteThreadBtn" class="thread-action-btn warn" type="button">删除帖子</button>`
      : ""
  }

</div>
    </div>

        <div id="threadSharePanel" class="thread-share-overlay" hidden>
      <div class="thread-share-sheet">
        <div class="thread-share-sheet-head">
          <div class="thread-share-sheet-title" id="threadShareTitle">转发</div>
          <button id="closeThreadSharePanelBtn" class="thread-share-close-btn" type="button">×</button>
        </div>

        <div class="thread-share-sheet-sub">选择最近联系人 / 群聊</div>

        <div class="thread-share-avatar-grid" id="threadShareTargetList">
          ${renderShareTargetListHtml()}
        </div>
      </div>
    </div>

    </div>

    <div class="reply-box">

      <div class="panel-title">评论区</div>

      <div id="threadCommentList">
        ${
          selectedThread.comments.length
  ? selectedThread.comments.map((comment, index) => `
      <div class="comment-item ${comment.isDeleted ? "is-deleted" : ""} ${comment.isSystem ? "is-system" : ""}" id="comment-${comment.id}">
        <div class="comment-avatar-col">
                  <button
            class="comment-avatar-btn"
            type="button"
            data-comment-author-student-id="${escapeHtml(comment.authorStudentId || "")}"
          >
            <img
              class="comment-avatar"
              src="${getRenderedCommentAvatar(comment)}"
            />
          </button>

        </div>

        <div class="comment-main-col">
          <div class="comment-header">
            <div class="comment-header-left">
              <span class="comment-author">${renderAuthorNameWithDisplayGroup(comment.author, comment.authorDisplayGroup, comment.authorStudentId)}</span>
              ${renderCommentBadges(comment)}
            </div>

            <div class="comment-header-right">
              ${renderCommentMetaRight(comment, index)}
            </div>
          </div>

          ${
            !comment.isDeleted && comment.replyTo
  ? `
    <button
      class="comment-quote ${comment.replyTo.isDeleted ? "is-deleted" : ""}"
      data-jump-comment-id="${comment.replyTo.id}"
      type="button"
    >
      <strong>回复 ${renderTextWithAccountAt(getReplyToDisplayName(comment.replyTo, selectedThread.comments))}：</strong>
      <span>${renderTextWithAccountAt(comment.replyTo.text)}</span>
    </button>
  `
  : ""
          }

          <div class="comment-text">${renderTextWithAccountAt(comment.text)}</div>

                    <div class="comment-footer">
            <div class="comment-footer-left">
              ${
                comment.isDeleted || comment.isSystem
                  ? ""
                  : `
                    <button
                      class="comment-reaction-btn ${comment.currentUserReaction === "like" ? "active-like" : ""}"
                      data-like-comment-id="${comment.id}"
                      type="button"
                    >
                      👍 ${comment.likeCount || 0}
                    </button>

                    <button
                      class="comment-reaction-btn ${comment.currentUserReaction === "dislike" ? "active-dislike" : ""}"
                      data-dislike-comment-id="${comment.id}"
                      type="button"
                    >
                      👎 ${comment.dislikeCount || 0}
                    </button>
                  `
              }
            </div>

            <div class="comment-footer-right">
              ${renderCommentTime(comment)}
            </div>
          </div>
        </div>
      </div>
    `).join("")

            : `<div class="empty-tip">目前还没有评论。</div>`
        }
      </div>

      <div class="comment-editor">
        <div id="replyTargetBar" class="reply-target-bar" ${replyTarget ? "" : "hidden"}>
          ${
            replyTarget
              ? `
                <span>正在回复：${replyTarget.author}</span>
                <button id="cancelReplyBtn" class="retro-btn small ghost" type="button">取消</button>
              `
              : ""
          }
        </div>

                ${
          isLocked && !isCurrentManager()
            ? `<div class="empty-tip">本帖已封，暂时不能评论。</div>`
            : `
              <textarea
                id="commentInput"
                class="retro-input comment-textarea"
                placeholder="${replyTarget ? `回复 ${replyTarget.author}...` : "输入评论内容..."}"
              ></textarea>

              <div class="btn-row">
                <button id="submitCommentBtn" class="retro-btn" type="button">发送评论</button>
              </div>
            `
        }

      </div>
    </div>
  `;

    detailEl.querySelectorAll("[data-reply-comment-id]").forEach(btn => {
  btn.addEventListener("click", () => {
    const commentId = Number(btn.dataset.replyCommentId);
    const target = selectedThread.comments.find(item => Number(item.id) === commentId);

    if (!target || target.isDeleted || target.isSystem) return;

    replyTarget = {
      id: target.id,
      author: getCommentDisplayName(target),
      authorStudentId: target.authorStudentId || "",
      text: target.text
    };

    renderThreadDetailView();
    document.getElementById("commentInput")?.focus();
  });
});

  detailEl.querySelectorAll("[data-jump-comment-id]").forEach(btn => {
    btn.addEventListener("click", () => {
      const targetEl = document.getElementById(`comment-${btn.dataset.jumpCommentId}`);
      if (targetEl) {
        targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
      }
    });
  });

  detailEl.querySelectorAll(".comment-item").forEach(itemEl => {
  const commentId = Number(itemEl.id.replace("comment-", ""));
  const comment = selectedThread.comments.find(item => Number(item.id) === commentId);

  if (!comment) return;

  itemEl.addEventListener("click", (event) => {
  if (
    event.target.closest(".comment-quote") ||
    event.target.closest(".comment-reaction-btn")
  ) {
    return;
  }

  if (ignoreNextCommentClick) {
    ignoreNextCommentClick = false;
    return;
  }

  if (activeCommentAction) {
    hideCommentActionMenu();
    return;
  }

  setReplyTargetFromComment(comment);
});

  itemEl.addEventListener("mousedown", () => {
  if (comment.isDeleted || comment.isSystem) return;
  startCommentPress(comment, itemEl);
});

  itemEl.addEventListener("mouseup", cancelCommentPress);
  itemEl.addEventListener("mouseleave", cancelCommentPress);

  itemEl.addEventListener("touchstart", () => {
  if (comment.isDeleted || comment.isSystem) return;
  startCommentPress(comment, itemEl);
}, { passive: true });

  itemEl.addEventListener("touchend", cancelCommentPress);
  itemEl.addEventListener("touchcancel", cancelCommentPress);
});

  document.getElementById("cancelReplyBtn")?.addEventListener("click", () => {
    replyTarget = null;
    renderThreadDetailView();
  });

      document.getElementById("submitCommentBtn")?.addEventListener("click", async () => {
    const input = document.getElementById("commentInput");
    const text = String(input?.value || "").trim();

    if (!text) {
      alert("请输入评论内容。");
      return;
    }

    if (!selectedThread?.id) {
      alert("当前帖子信息异常。");
      return;
    }

    try {

      const commentStats = isStoryBoard()
        ? makeAiCommentStats()
        : { likeCount: 0, dislikeCount: 0 };

      await createCommentInThread(selectedThread.id, {
        content: text,
        replyCommentId: replyTarget ? replyTarget.id : null,
        likeCount: commentStats.likeCount,
        dislikeCount: commentStats.dislikeCount
      });

      threadDetailCache.delete(selectedThread.id);
      const freshDetail = await loadThreadDetail(selectedThread.id);
      selectedThread = freshDetail;
      replyTarget = null;
      renderThreadDetailView();
    } catch (error) {
      console.error("发送评论失败：", error);
      alert(error.message || "发送评论失败");
    }
  });

  document.getElementById("threadShareBtn")?.addEventListener("click", () => {
    const panel = document.getElementById("threadSharePanel");
    const titleEl = document.getElementById("threadShareTitle");
    const listEl = document.getElementById("threadShareTargetList");

    if (!panel) return;

        if (isCurrentUserGuest()) {
      alert("游客不能转发内容，请先发送 /实名认证 完成认证。");
      return;
    }

    shareMode = "thread";
    shareCommentTarget = null;

    if (titleEl) titleEl.textContent = "转发帖子";
    if (listEl) {
      listEl.innerHTML = renderShareTargetListHtml();
      bindShareTargetButtons(listEl); // 关键：重新画完后马上绑点击
    }

    panel.hidden = false;
  });

  document.getElementById("closeThreadSharePanelBtn")?.addEventListener("click", () => {
    const panel = document.getElementById("threadSharePanel");
    if (panel) panel.hidden = true;
  });

  document.getElementById("threadSharePanel")?.addEventListener("click", (event) => {
    // 点遮罩空白才关，点里面的白卡片不关
    if (event.target && event.target.id === "threadSharePanel") {
      event.target.hidden = true;
    }
  });

  detailEl.querySelectorAll("[data-comment-author-student-id]").forEach((btn) => {
  btn.addEventListener("click", async (event) => {
    event.stopPropagation();

    const studentId = btn.dataset.commentAuthorStudentId;
    if (!studentId) return;

    window.dispatchEvent(
      new CustomEvent("social:open-mini-profile", {
        detail: {
          studentId,
          anchorRect: btn.getBoundingClientRect()
        }
      })
    );
  });
});

detailEl.querySelectorAll("[data-account-code]").forEach((btn) => {
  btn.addEventListener("click", async (event) => {
    event.stopPropagation();

    const studentId = btn.dataset.accountCode;
    if (!studentId) return;

    window.dispatchEvent(
      new CustomEvent("social:open-mini-profile", {
        detail: {
          studentId,
          anchorRect: btn.getBoundingClientRect()
        }
      })
    );
  });
});

    detailEl.querySelectorAll("[data-inline-thread-id]").forEach((btn) => {
    btn.addEventListener("click", async () => {
      const threadId = Number(btn.dataset.inlineThreadId);

      if (!Number.isInteger(threadId) || threadId <= 0) {
        alert("帖子链接不正确。");
        return;
      }

      await navigateForumTarget(`thread:${threadId}`);
    });
  });

  bindShareTargetButtons(detailEl);

  document.getElementById("threadLikeBtn")?.addEventListener("click", async () => {
    if (!selectedThread?.id) return;

    try {
      const updatedThread = await likeThread(selectedThread.id);
      threadDetailCache.delete(selectedThread.id);

      selectedThread = {
  ...mergeThreadKeepingPinned(selectedThread, updatedThread),
  comments: selectedThread.comments || []
};

threadDetailCache.set(selectedThread.id, selectedThread);

boardThreads = boardThreads.map((item) =>
  Number(item.id) === Number(updatedThread.id)
    ? mergeThreadKeepingPinned(item, updatedThread)
    : item
);

boardThreads = sortThreadsWithPinnedFirst(boardThreads);

renderThreadDetailView();

    } catch (error) {
      console.error("点赞失败：", error);
      alert(error.message || "点赞失败");
    }
  });

  document.getElementById("threadDislikeBtn")?.addEventListener("click", async () => {
    if (!selectedThread?.id) return;

    try {
      const updatedThread = await dislikeThread(selectedThread.id);
      threadDetailCache.delete(selectedThread.id);

      selectedThread = {
  ...mergeThreadKeepingPinned(selectedThread, updatedThread),
  comments: selectedThread.comments || []
};

threadDetailCache.set(selectedThread.id, selectedThread);

boardThreads = boardThreads.map((item) =>
  Number(item.id) === Number(updatedThread.id)
    ? mergeThreadKeepingPinned(item, updatedThread)
    : item
);

boardThreads = sortThreadsWithPinnedFirst(boardThreads);

renderThreadDetailView();

    } catch (error) {
      console.error("点踩失败：", error);
      alert(error.message || "点踩失败");
    }
  });

    document.getElementById("threadFavoriteBtn")?.addEventListener("click", async () => {
    if (!selectedThread?.id) return;

    try {
      const updatedThread = await toggleThreadFavorite(
        selectedThread.id,
        !selectedThread.isFavorited
      );

      selectedThread = {
  ...mergeThreadKeepingPinned(selectedThread, updatedThread),
  comments: selectedThread.comments || []
};

      threadDetailCache.set(selectedThread.id, selectedThread);

      boardThreads = boardThreads.map((item) =>
        Number(item.id) === Number(updatedThread.id)
          ? mergeThreadKeepingPinned(item, updatedThread)
          : item
      );

            if (specialView === "favorites") {
        await loadMyFavoriteThreads();

        if (!updatedThread.isFavorited) {
          selectedThread = null;

          if (window.ForumNav?.back) {
            window.ForumNav.back();
            return;
          }

          renderFavoriteLibraryView();
          return;
        }
      }

      renderThreadDetailView();

    } catch (error) {
      console.error("收藏操作失败：", error);
      alert(error.message || "收藏操作失败");
    }
  });

    detailEl.querySelectorAll("[data-like-comment-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const commentId = Number(btn.dataset.likeCommentId);
      if (!commentId || !selectedThread?.id) return;

      try {
        const updatedComment = await likeComment(commentId);

        selectedThread = {
          ...selectedThread,
          comments: (selectedThread.comments || []).map((item) =>
            item.id === updatedComment.id ? { ...item, ...updatedComment } : item
          )
        };

        threadDetailCache.set(selectedThread.id, selectedThread);
        renderThreadDetailView();
      } catch (error) {
        console.error("评论点赞失败：", error);
        alert(error.message || "评论点赞失败");
      }
    });
  });

    document.getElementById("editThreadContentBtn")?.addEventListener("click", async () => {
    if (!selectedThread?.id) return;
    if (Boolean(selectedThread.isLocked)) {
      alert("帖子已封，无法编辑。");
      return;
    }

    const nextContent = window.prompt("编辑正文（只能编辑一次）", selectedThread.content || "");
    if (nextContent === null) return;

    const content = String(nextContent || "").trim();
    if (!content) {
      alert("正文不能为空。");
      return;
    }

    try {
      await editThreadContent(selectedThread.id, content);
      threadDetailCache.delete(selectedThread.id);
      selectedThread = await loadThreadDetail(selectedThread.id);
      renderThreadDetailView();
    } catch (error) {
      console.error("编辑正文失败：", error);
      alert(error.message || "编辑正文失败");
    }
  });

  document.getElementById("editThreadTitleBtn")?.addEventListener("click", async () => {
    if (!selectedThread?.id) return;
    if (Boolean(selectedThread.isLocked)) {
      alert("帖子已封，无法修改标题。");
      return;
    }

    const nextTitle = window.prompt("修改标题", selectedThread.title || "");
    if (nextTitle === null) return;

    const title = String(nextTitle || "").trim();
    if (!title) {
      alert("标题不能为空。");
      return;
    }

    try {
      await editThreadTitle(selectedThread.id, title);
      threadDetailCache.delete(selectedThread.id);
      selectedThread = await loadThreadDetail(selectedThread.id);
      renderThreadDetailView();
    } catch (error) {
      console.error("修改标题失败：", error);
      alert(error.message || "修改标题失败");
    }
  });

  document.getElementById("lockThreadBtn")?.addEventListener("click", async () => {
    if (!selectedThread?.id) return;

    const nextLocked = !Boolean(selectedThread.isLocked);
    const ok = window.confirm(nextLocked ? "确定封贴吗？封贴后不能编辑和评论。" : "确定解封吗？");
    if (!ok) return;

    try {
      await setThreadLocked(selectedThread.id, nextLocked);
      threadDetailCache.delete(selectedThread.id);
      selectedThread = await loadThreadDetail(selectedThread.id);
      renderThreadDetailView();
    } catch (error) {
      console.error("封贴/解封失败：", error);
      alert(error.message || "操作失败");
    }
  });

  document.getElementById("pinThreadBtn")?.addEventListener("click", async () => {
  if (!selectedThread?.id || !selectedBoard?.slug) return;

  const nextPinned = !Boolean(selectedThread.isPinned);
  const confirmText = nextPinned ? "确定要置顶这个帖子吗？" : "确定要取消置顶这个帖子吗？";
  const ok = window.confirm(confirmText);
  if (!ok) return;

  const threadId = Number(selectedThread.id);
  const currentBoardSlug = selectedBoard.slug;

  try {
    const updatedThread = await setThreadPinned(threadId, nextPinned);

    selectedThread = {
      ...selectedThread,
      ...updatedThread
    };

    threadDetailCache.set(threadId, selectedThread);

    boardThreads = boardThreads.map((item) =>
      Number(item.id) === threadId ? { ...item, ...updatedThread } : item
    );

    boardThreads = sortThreadsWithPinnedFirst(boardThreads);

    await loadThreadsByBoard(currentBoardSlug);
    await loadHomePinnedItems();
    threadDetailCache.delete(threadId);
    selectedThread = await loadThreadDetail(threadId);

    renderForum();

  } catch (error) {
    console.error("置顶操作失败：", error);
    alert(error.message || "置顶操作失败");
  }
});

  document.getElementById("deleteThreadBtn")?.addEventListener("click", async () => {
  if (!selectedThread?.id || !selectedBoard?.slug) return;

  const ok = window.confirm("确定删除这个帖子吗？删除后会返回帖子列表。");
  if (!ok) return;

  const deletedThreadId = Number(selectedThread.id);
  const currentBoardSlug = selectedBoard.slug;

  try {
    await deleteThreadById(deletedThreadId);

    threadDetailCache.delete(deletedThreadId);
    boardThreads = boardThreads.filter(item => Number(item.id) !== deletedThreadId);

    selectedThread = null;
    replyTarget = null;

    await loadThreadsByBoard(currentBoardSlug);
    renderForum();
  } catch (error) {
    console.error("删除帖子失败：", error);
    alert(error.message || "删除帖子失败");
  }
});

  detailEl.querySelectorAll("[data-dislike-comment-id]").forEach(btn => {
    btn.addEventListener("click", async () => {
      const commentId = Number(btn.dataset.dislikeCommentId);
      if (!commentId || !selectedThread?.id) return;

      try {
        const updatedComment = await dislikeComment(commentId);

        selectedThread = {
          ...selectedThread,
          comments: (selectedThread.comments || []).map((item) =>
            item.id === updatedComment.id ? { ...item, ...updatedComment } : item
          )
        };

        threadDetailCache.set(selectedThread.id, selectedThread);
        renderThreadDetailView();
      } catch (error) {
        console.error("评论点踩失败：", error);
        alert(error.message || "评论点踩失败");
      }
    });
  });

}

function isIdLikeSearchText(keyword) {
  const q = String(keyword || "").trim();

  // A1999999、AI000000、1999999 这种都当成 ID/学号
  // 重点：带数字的短输入，不允许模糊搜用户，保护一下隐私
  return /^[A-Za-z]*\d+[A-Za-z0-9]*$/.test(q);
}

async function searchExactUserForTopBar(keyword) {
  const q = String(keyword || "").trim();

  if (!q || !state.authToken || state.authSession?.isGuest) {

    lastGlobalUserResults = [];
    renderForumGlobalSearchPanel("");
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/users/${encodeURIComponent(q)}`, {
      headers: {
        ...getForumAuthHeaders()
      }
    });

    const data = await res.json();

    if (!res.ok || !data.success || !data.user) {

      lastGlobalUserResults = [];
      renderForumGlobalSearchPanel(q);
      return;
    }

    lastGlobalUserResults = [data.user];

    renderForumGlobalSearchPanel(q);
  } catch (error) {
    
    lastGlobalUserResults = [];
    renderForumGlobalSearchPanel(q);
  }
}

async function searchUsersForTopBar(keyword) {
  const q = String(keyword || "").trim();

  if (!q || q.length < 2 || !state.authToken || state.authSession?.isGuest) {
    lastGlobalUserResults = [];
    renderForumGlobalSearchPanel(q);
    return;
  }

  // 只要像 ID/学号，就不走模糊搜索
  // 例如输入 A199、199，都不会搜出一堆账号
  if (isIdLikeSearchText(q)) {
    await searchExactUserForTopBar(q);
    return;
  }

  try {
    const res = await fetch(`${API_BASE_URL}/api/users/search?q=${encodeURIComponent(q)}`, {
      headers: {
        ...getForumAuthHeaders()
      }
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
      lastGlobalUserResults = [];
      renderForumGlobalSearchPanel(q);
      return;
    }

    lastGlobalUserResults = Array.isArray(data.users) ? data.users : [];
    renderForumGlobalSearchPanel(q);
  } catch (error) {
    console.warn("顶部搜索用户失败：", error);
    lastGlobalUserResults = [];
    renderForumGlobalSearchPanel(q);
  }
}

let currentForumSearchKeyword = "";

function setForumSearchBreadcrumb(keyword) {
  const el = document.getElementById("forumBreadcrumb");
  if (!el) return;

  el.textContent = `守夜人论坛 → 搜索“${keyword}”`;
}

function hideForumViewsForSearchPage() {
  const ids = [
    "forumPinnedBox",
    "forumBoardSelectView",
    "forumThreadListView",
    "forumThreadDetailView",
    "forumComposerView"
  ];

  ids.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.hidden = true;
  });
}

function closeForumSearchPage(shouldRenderForum = false) {
  currentForumSearchKeyword = "";
  lastGlobalUserResults = [];

  const panel = document.getElementById("forumGlobalSearchPanel");
  if (panel) {
    panel.hidden = true;
    panel.innerHTML = "";
  }

  if (shouldRenderForum) {
    renderForum();
  }
}

// 点面包屑上的"守夜人论坛"时，从搜索页干净地回到论坛首页
function goForumHomeFromSearchNav() {
  currentForumSearchKeyword = "";
  lastGlobalUserResults = [];

  const panel = document.getElementById("forumGlobalSearchPanel");
  if (panel) {
    panel.hidden = true;
    panel.innerHTML = "";
  }

  goForumHomeFromNav();
}

async function openForumSearchPage(keyword) {
  const q = String(keyword || "").trim();
  if (!q) {
    closeForumSearchPage(true);
    return;
  }

  currentForumSearchKeyword = q;

        hideForumViewsForSearchPage();
  renderActionBar();
  pushForumNav(`搜索"${q}"`, goForumHomeFromSearchNav, {
    type: "forum-search",
    key: q
  });

  const panel = document.getElementById("forumGlobalSearchPanel");
  if (panel) {
    panel.hidden = false;
    panel.innerHTML = `
      <section class="panel-box forum-search-page">
        <div class="global-search-title">搜索“${escapeHtml(q)}”</div>
        <div class="empty-tip">正在搜索……</div>
      </section>
    `;
  }

  await searchUsersForTopBar(q);
}

function normalizeForumSearchUser(user) {
  const name = user.name || user.forumId || user.studentId || "未知用户";
  const code = user.studentId || user.code || "";
  const avatar = user.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(name)}`;
  const desc = user.desc || user.signature || "暂无签名。";
  const status = user.status || "online";

  const identityGroups = Array.isArray(user.identityGroups) && user.identityGroups.length
    ? user.identityGroups
    : ["已认证"];

  return {
    ...user,
    name,
    forumId: user.forumId || name,
    code,
    studentId: user.studentId || code,
    avatar,
    desc,
    signature: user.signature || desc,
    status,
    identityGroups,
    accountKind: user.accountKind || "real_user",
    friendshipStatus: user.friendshipStatus || "none",
    codeKind: user.codeKind || "student"
  };
}

function renderForumGlobalSearchPanel(keyword) {
  const panel = document.getElementById("forumGlobalSearchPanel");
  if (!panel) return;

  const q = String(keyword || currentForumSearchKeyword || "").trim();

  if (!q) {
    panel.hidden = true;
    panel.innerHTML = "";
    return;
  }

  currentForumSearchKeyword = q;
  hideForumViewsForSearchPage();

  const users = lastGlobalUserResults.map(normalizeForumSearchUser);

  panel.hidden = false;

  const userResultHtml = users.length
    ? users.map((user, index) => {
        const displayName = user.forumId || user.name || "未知用户";
        const code = user.studentId || user.code || "";
        const avatar = user.avatar || `https://api.dicebear.com/7.x/lorelei/svg?seed=${encodeURIComponent(displayName)}`;
        const desc = user.desc || user.signature || "暂无签名。";
        const statusText = user.status === "offline" ? "离线" : "在线";
        const firstGroup = user.identityGroups?.[0] || "已认证";

        return `
          <article class="thread-card thread-feed-card global-search-user-card-large" data-global-user-index="${index}">
            <div class="thread-card-left">
              <img class="thread-author-avatar" src="${avatar}" alt="${escapeHtml(displayName)}" />
            </div>

            <div class="thread-card-right">
              <div class="thread-card-meta-top">
                <span class="thread-author-inline">${escapeHtml(displayName)}</span>
                ${renderIdentityBadge(firstGroup)}
                <span class="thread-meta-divider">/</span>
                <span class="global-search-status-dot ${user.status === "offline" ? "offline" : "online"}"></span>
                <span class="thread-time-inline">${statusText}</span>
              </div>

              <div class="thread-card-title-row">
                <div class="thread-card-title">${escapeHtml(displayName)}</div>
              </div>

              <div class="thread-card-summary clamp-2">
                ${escapeHtml(desc)}
              </div>

              <div class="thread-card-stats">
                <span>ID: ${escapeHtml(code)}</span>
              </div>

            </div>
          </article>
        `;
      }).join("")
    : `
      <section class="panel-box">
        <div class="empty-tip">
          没有找到用户结果。你可以换一个昵称、论坛名或完整学号再试。
        </div>
      </section>
    `;

  panel.innerHTML = `
    <section class="forum-search-page">
      <div class="global-search-title">搜索“${escapeHtml(q)}”</div>

      <div class="forum-search-result-block">
        <div class="panel-title">用户结果 / USER RESULTS</div>
        ${userResultHtml}
      </div>
    </section>
  `;

    panel.querySelectorAll("[data-global-user-index]").forEach((card) => {
    card.style.cursor = "pointer";
    card.addEventListener("click", () => {
      const index = Number(card.dataset.globalUserIndex);
      const user = users[index];
      if (!user) return;

      const studentId = user.studentId || user.code;
      if (!studentId) return;

      openContactProfileByStudentId(studentId);
    });
  });

}

function handleTopSearchInput(value) {
  clearTimeout(forumSearchTimer);

  const panel = document.getElementById("forumGlobalSearchPanel");
  const isSearchPageOpen = panel && !panel.hidden;

  // 输入时不搜索。
  // 如果当前正在搜索页面，用户重新输入，就先回到正常论坛。
  if (isSearchPageOpen) {
    closeForumSearchPage(true);
  }
}

function filterCurrentView(keyword) {
  const lowerKeyword = String(keyword || "").trim().toLowerCase();

  if (!selectedBoard) {
    const boardView = document.getElementById("forumBoardSelectView");
    if (!boardView) return;

    const filteredBoards = forumBoards.filter(board =>
      [board.name, board.description, board.boardType, formatAccessGroups(board)]
        .join(" ")
        .toLowerCase()
        .includes(lowerKeyword)
    );

    boardView.innerHTML = `
      <div class="board-select-grid">
        ${filteredBoards.map(board => `
          <button class="board-select-card" data-board-slug="${board.slug}" type="button">
            <div class="board-select-title">${board.name}</div>
            <div class="board-select-desc">${board.description || "暂无板块说明。"}</div>
            <div class="board-select-meta">
              <span>${board.boardType === "real" ? "REAL" : "STORY"}</span>
              <span>${board.forceAnonymous ? "匿名" : "常规"}</span>
              <span>${formatAccessGroups(board)}</span>
            </div>
          </button>
          ${
            isCurrentUserManager
              ? `<button class="board-delete-btn" data-board-slug="${escapeHtml(board.slug)}" data-board-name="${escapeHtml(board.name)}" title="删除板块" style="color:var(--red,#c00);background:none;border:none;cursor:pointer;font-size:14px;padding:4px">✕ 删除</button>`
              : ""
          }
        `).join("")}
      </div>
    `;

    boardView.querySelectorAll("[data-board-slug]").forEach(item => {
  item.addEventListener("click", async () => {
    await openBoardBySlug(item.dataset.boardSlug);
  });
});


    // 给板块管理页面的删除按钮添加点击事件
    boardView.querySelectorAll(".board-delete-btn").forEach((btn) => {
      btn.addEventListener("click", async (e) => {
        e.stopPropagation();
        const slug = btn.dataset.boardSlug;
        const name = btn.dataset.boardName;

        if (isCurrentUserManager()) {
          const reason = prompt(`确定要删除板块「${name}」吗？\n请输入删除理由（可选）：`);
          if (reason === null) return;

          try {
            const res = await fetch(`http://43.135.26.183:3000/api/boards/${encodeURIComponent(slug)}/direct-delete`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...getForumAuthHeaders()
              },
              body: JSON.stringify({ reason })
            });
            const data = await res.json();
            alert(data.message || "操作完成");
            if (data.success) {
              window.dispatchEvent(new CustomEvent("forum:reload-threads"));
              renderForumHome();
            }
          } catch (err) {
            alert("删除失败：" + err.message);
          }
        } else {
          const reason = prompt(`你是版主，需要提交删除申请。\n请输入删除板块「${name}」的理由：`);
          if (!reason) {
            alert("请填写删除理由");
            return;
          }

          try {
            const res = await fetch(`http://43.135.26.183:3000/api/boards/${encodeURIComponent(slug)}/delete-request`, {
              method: "POST",
              headers: {
                "Content-Type": "application/json",
                ...getForumAuthHeaders()
              },
              body: JSON.stringify({ reason })
            });
            const data = await res.json();
            alert(data.message || "操作完成");
          } catch (err) {
            alert("提交失败：" + err.message);
          }
        }
      });
    });

    return;
  }

  if (selectedBoard && !selectedThread) {
    const listEl = document.getElementById("forumThreadList");
    if (!listEl) return;

    const filteredThreads = sortThreadsWithPinnedFirst(boardThreads).filter(thread =>
      [thread.title, thread.summary, thread.content, thread.author, (thread.tags || []).join(" ")]
        .join(" ")
        .toLowerCase()
        .includes(lowerKeyword)
    );

    listEl.innerHTML = filteredThreads.length
      ? filteredThreads.map(thread => `
          <article class="thread-card thread-feed-card ${thread.isPinned ? "is-pinned" : ""}" data-thread-id="${thread.id}">
  <div class="thread-card-left">
    <img class="thread-author-avatar" src="${thread.authorAvatar}" alt="${thread.author}" />
  </div>

  <div class="thread-card-right">
    <div class="thread-card-meta-top">
      <span class="thread-author-inline">${renderAuthorNameWithDisplayGroup(thread.author, thread.authorDisplayGroup, thread.authorStudentId)}</span>
      <span class="thread-meta-divider">/</span>
      <span class="thread-time-inline">${thread.time}</span>
    </div>

    <div class="thread-card-title-row">
      ${thread.tags?.length ? `<span class="thread-first-tag">${thread.tags[0]}</span>` : ""}
      <div class="thread-card-title">${thread.title}</div>
    </div>

        <div class="thread-card-summary clamp-2">${escapeHtml(makeContentPreview(thread.content || thread.summary || "", 90))}</div>

    <div class="thread-card-stats">
  <span>👍 ${thread.likeCount}</span>
  <span>👎 ${thread.dislikeCount}</span>
  <button
  class="thread-card-share-link"
  type="button"
  data-jump-thread-id="${thread.id}"
>
  ↗
</button>

  ${thread.isPinned ? `<span class="thread-pin-mark thread-pin-mark-bottom">置顶</span>` : ""}
</div>

  </div>
</article>

        `).join("")
      : `<div class="empty-tip">没有匹配的帖子。</div>`;

      listEl.querySelectorAll("[data-jump-thread-id]").forEach((btn) => {
  btn.addEventListener("click", async (event) => {
    event.stopPropagation();

    const threadId = Number(btn.dataset.jumpThreadId);
    if (!threadId) return;

    await navigateForumTarget(`thread:${threadId}`);
  });
});

    listEl.querySelectorAll("[data-thread-id]").forEach(item => {
  item.addEventListener("click", async () => {
    const threadId = Number(item.dataset.threadId);
    if (!threadId) return;
    await openThreadById(threadId);
  });
});

  }
}

function handleBack() {
  hideCommentActionMenu();

  if (window.ForumNav?.back) {
  window.ForumNav.back();
  return;
}

  if (isComposerOpen) {
    isComposerOpen = false;
    resetComposerForm();
    renderForum();
    return;
  }

  if (selectedThread) {
    selectedThread = null;
    replyTarget = null;
    renderForum();
    return;
  }

  if (selectedBoard) {
    selectedBoard = null;
    selectedThread = null;
    replyTarget = null;
    boardThreads = [];
    renderForum();
  }
}

async function handleSyncStoryThread() {
  console.log("【调试】点击了同步按钮！当前选择的板块为：", selectedBoard);

  const settings = state.forumAiSettings || {};

  // 当前账号在论坛设置里勾选的剧情板块
  const enabledStoryBoardSlugs = Array.isArray(
    settings.enabledStoryBoardSlugs
  )
    ? settings.enabledStoryBoardSlugs
    : [];

  // 只保留：剧情板块 + 已经勾选启用的板块
  const enabledStoryBoards = forumBoards.filter((board) => {
    const boardType = board.boardType || board.board_type;
    const boardSlug = String(board.slug || "");

    return (
      boardType === "story" &&
      enabledStoryBoardSlugs.includes(boardSlug)
    );
  });

  let syncBoard = null;

  // 如果当前已经打开的是一个启用中的剧情板块，就使用当前板块
  if (
    selectedBoard &&
    (selectedBoard.boardType || selectedBoard.board_type) === "story" &&
    enabledStoryBoardSlugs.includes(String(selectedBoard.slug || ""))
  ) {
    syncBoard = selectedBoard;
  }

  // 首页没有打开板块，或者当前板块没有启用，就使用第一个启用板块
  if (!syncBoard) {
    syncBoard = enabledStoryBoards[0] || null;
  }

  if (!syncBoard) {
    alert("请先在“论坛基础”里勾选至少一个剧情启用板块。");
    return;
  }

  const btn = document.getElementById("syncStoryBtn");
  const oldText = btn?.textContent || "同步";

  if (btn) {
    btn.disabled = true;
    btn.textContent = "同步中";
  }

  try {
    const settings = state.forumAiSettings || {};
    const contextText = readTavernContextText();

    console.log("【调试】正在读取设置...", {
      apiBaseUrl: settings.apiBaseUrl,
      model: settings.model,
      syncThreadCount: settings.syncThreadCount,
      hasContextText: !!contextText
    });

    // ====== 如果当前正在看某篇帖子，就让 AI 回复本帖 ======
    if (selectedThread && selectedThread.id) {
      console.log("【调试】当前在帖子页，改为 AI 回复本帖：", selectedThread.id);

      // 先拉最新帖子详情，避免评论不全
      const latestThread = await loadThreadDetail(selectedThread.id);
      selectedThread = latestThread || selectedThread;

      await createStoryRepliesForThread(selectedThread, contextText);

      // createStoryRepliesForThread 内部已经强制刷新并 renderForum 了
      // 这里再保险刷新一次
      selectedThread = await loadThreadDetail(selectedThread.id, true);
      renderForum();

      alert("本帖 AI 回复已生成！");
      return;
    }

    // ====== 不在帖子页：才生成新帖 ======
    console.log("【调试】当前不在帖子页，开始生成新帖……");
    const result = await generateStorySyncBatch({
  boardSlug: syncBoard.slug,
  boardName: syncBoard.name,
  boardDesc: syncBoard.description || "",
  postGroups: syncBoard.postGroups || [],
  allowAiPost:
  syncBoard.allowAiPost === true ||
  syncBoard.allowAiPost === 1 ||
  syncBoard.allowAiPost === "1" ||
  syncBoard.allow_ai_post === 1 ||
  syncBoard.allow_ai_post === "1",
  contextText,
  threadCount: settings.syncThreadCount || 1,
  commentCount: settings.syncCommentCount ?? 3
});

    console.log("【调试】AI 成功返回数据：", result);

    const threads = Array.isArray(result.threads) ? result.threads : [];

    if (!threads.length) {
      alert("AI 没有生成任何帖子。");
      return;
    }

    const currentBatchId = `batch_${Date.now()}`;

    let lastThread = null;
    const { friends } = await import("./data.js");

    for (const item of threads) {
  if (
    !canCharacterPostInBoard(
      item.characterId,
      syncBoard,
      friends

    )
  ) {
    console.warn(
      "跳过没有发帖权限的剧情角色：",
      item.characterId,
      syncBoard.name
    );
    continue;
  }

  const authorPatch = findCharacterAuthorPatch(
    item.characterId,
    friends
  );

if (!authorPatch) {
  console.warn("跳过无角色帖子：", item);
  continue;
}

      const content = String(item.content || "").trim();
      if (!content) continue;

      const stats = makeAiThreadStats();
const payload = {
  title: String(item.title || "同步记录").trim(),
  summary: makeContentPreview(content),
  tags: Array.isArray(item.tags) ? item.tags.join(", ") : "",
  content,
  postType: "normal",
  visibility: "public",
  likeCount: stats.likeCount,
  dislikeCount: stats.dislikeCount,
  shareCount: stats.shareCount,
  syncBatchId: currentBatchId,
  ...authorPatch
};

      console.log("【调试】正在将生成的帖子发送到后端...", payload);
      const createdThread = await createThreadInBoard(syncBoard.slug, payload);
      lastThread = createdThread;

            const comments = Array.isArray(item.comments) ? item.comments : [];
      const createdComments = []; // 已成功发出的评论，用来挂楼中楼

      for (let commentIndex = 0; commentIndex < comments.length; commentIndex++) {
  const comment = comments[commentIndex];
  const rawContent = String(comment.content || "").trim();

  if (!rawContent) continue;

  if (
    !canCharacterPostInBoard(
      comment.characterId,
      syncBoard,
      friends
    )
  ) {
    console.warn(
      "跳过没有评论权限的剧情角色：",
      comment.characterId,
      syncBoard.name
    );
    continue;
  }

  const replyPatch = findCharacterAuthorPatch(
    comment.characterId,
    friends
  );

  if (!replyPatch) {
    console.warn("跳过无角色评论：", comment);
    continue;
  }

        // 先尽量解析 replyTo；解析不到时，再从正文“回复3楼”识别
        const replyCommentId = resolveAiReplyCommentId(
          comment.replyTo,
          rawContent,
          createdComments
        );

        // 正文去掉“回复3楼：”这种前缀
        const content = cleanAiReplyContent(rawContent);
        if (!content) continue;

        const commentStats = makeAiCommentStats();

        console.log("【调试】正在向帖子发送评论...", {
          threadId: createdThread.id,
          content,
          replyCommentId,
          rawReplyTo: comment.replyTo,
          author: replyPatch
        });

        const createdComment = await createCommentInThread(createdThread.id, {
          content,
          replyCommentId,
          likeCount: commentStats.likeCount,
          dislikeCount: commentStats.dislikeCount,
          syncBatchId: currentBatchId,
          ...replyPatch
        });

        if (createdComment) {
          // 给后面的评论当“已有楼层”
          createdComments.push({
            id: createdComment.id,
            floorNo: createdComment.floorNo || createdComments.length + 1,
            author: createdComment.author || createdComment.authorForumId || "",
            text: createdComment.text || content
          });
        }
      }

    }

    console.log("【调试】全部数据发送完成，正在重新加载帖子列表……");
        try {
      await pruneBoardThreads(
      syncBoard.slug,

        Number(state.forumAiSettings?.keepThreadCount || 30)
      );
    } catch (error) {
      console.warn("清理旧帖失败：", error);
    }

    await loadThreadsByBoard(syncBoard.slug);
    trimBoardThreadsBySetting();

    if (lastThread) {
      selectedThread = await loadThreadDetail(lastThread.id);
      renderForum();

      pushForumNav(selectedThread.title, goForumBoardFromNav, {
        type: "forum-thread",
        key: String(selectedThread.id)
      });
    } else {
      renderForum();
    }

    // 保存本次同步的 batch ID，用于一键撤回
    try {
      localStorage.setItem(
        `last_sync_batch_${syncBoard.slug}`,
        currentBatchId
      );
    } catch (e) {}

    window.dispatchEvent(new CustomEvent("characters:status-changed"));
    alert("同步成功！");
  } catch (error) {
    console.error("【调试错误】剧情同步发生异常：", error);
    alert("同步失败，错误信息：" + error.message);
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = oldText;
    }
  }
}

function trimBoardThreadsBySetting() {
  const keepCount = Number(state.forumAiSettings?.keepThreadCount || 30);

  if (!Array.isArray(boardThreads) || !Number.isFinite(keepCount) || keepCount <= 0) {
    return;
  }

  boardThreads = boardThreads.slice(0, keepCount);
}

async function createStoryRepliesForThread(thread, contextText = "") {
  if (!selectedBoard || !thread || !isStoryBoard()) return;

  const result = await generateStoryThreadReplies({
    boardName: selectedBoard.name,
    boardDesc: selectedBoard.description || "",
    thread,
    contextText
  });

  const replies = Array.isArray(result.replies) ? result.replies : [];
  const { friends } = await import("./data.js");

  const existingComments = Array.isArray(thread.comments) ? [...thread.comments] : [];

  for (const reply of replies) {
    const rawContent = String(reply.content || "").trim();
    if (!rawContent) continue;

    const authorPatch = findCharacterAuthorPatch(reply.characterId, friends);
    if (!authorPatch) {
      console.warn("【调试】跳过无角色回复：", reply);
      continue;
    }

    const replyCommentId = resolveAiReplyCommentId(
      reply.replyTo,
      rawContent,
      existingComments
    );

    const content = cleanAiReplyContent(rawContent);
    if (!content) continue;

    const commentStats = makeAiCommentStats();

    const createdComment = await createCommentInThread(thread.id, {
      content,
      replyCommentId,
      likeCount: commentStats.likeCount,
      dislikeCount: commentStats.dislikeCount,
      ...authorPatch
    });

    // 新评论也加进列表，方便后面楼中楼识别
    if (createdComment) {
      existingComments.push({
        id: createdComment.id,
        floorNo: createdComment.floorNo || existingComments.length + 1,
        author: createdComment.author || createdComment.authorForumId || "",
        text: createdComment.text || content
      });
    }
  }

  // AI 回复完后，给帖子补一点“人气”数据
  try {
    const stats = makeAiThreadStats();
    await updateThreadAiStats(thread.id, stats);
  } catch (e) {
    console.warn("更新帖子点赞数据失败：", e);
  }

  // 给已有评论（尤其是玩家评论）补一点赞/踩
  try {
    const latestForStats = await loadThreadDetail(thread.id, true);
    const allComments = Array.isArray(latestForStats?.comments)
      ? latestForStats.comments
      : [];

    const commentStatsPayload = allComments
      .filter((c) => c && !c.isDeleted && !c.isSystem)
      .filter((c) => Number(c.likeCount || 0) <= 0 && Number(c.dislikeCount || 0) <= 0)
      .map((c) => {
        const stats = makeAiCommentStats();
        return {
          commentId: c.id,
          likeCount: stats.likeCount,
          dislikeCount: stats.dislikeCount
        };
      });

    if (commentStatsPayload.length) {
      await updateCommentsAiStats(thread.id, commentStatsPayload);
    }
  } catch (e) {
    console.warn("更新评论点赞数据失败：", e);
  }

  // 强制从服务器重新拉帖子，并立刻刷新页面
  try {
    const latest = await loadThreadDetail(thread.id, true);
    if (latest) {
      selectedThread = latest;
      threadDetailCache.set(latest.id, latest);
      renderForum();
    }
  } catch (e) {
    console.warn("刷新帖子详情失败：", e);
  }

  window.dispatchEvent(new CustomEvent("characters:status-changed"));
}

function bindForumActions() {
  document.getElementById("syncStoryBtn")?.addEventListener("click", handleSyncStoryThread);

  document.getElementById("forumHomeBtn")?.addEventListener("click", () => {
    if (window.ForumNav?.popTo) {
      window.ForumNav.popTo(0);
    }

    goForumHomeFromNav();
  });

  document.getElementById("commentActionCancelBtn")?.addEventListener("click", () => {
  hideCommentActionMenu();
});

document.getElementById("commentActionReportBtn")?.addEventListener("click", () => {
  hideCommentActionMenu();
  alert("举报功能下一步接入。");
});

document.getElementById("commentActionShareBtn")?.addEventListener("click", () => {
  // 先把评论信息存起来，再关菜单（关菜单会清空 activeCommentAction）
  const actionSnapshot = activeCommentAction ? { ...activeCommentAction } : null;
  const threadSnapshot = selectedThread;

  hideCommentActionMenu();

  if (!threadSnapshot?.id || !actionSnapshot?.id) {
    alert("当前评论信息异常。");
    return;
  }

  const comment = (threadSnapshot.comments || []).find(
    (item) => Number(item.id) === Number(actionSnapshot.id)
  );

  if (!comment || comment.isDeleted || comment.isSystem) {
    alert("这条评论不能转发。");
    return;
  }

      if (isCurrentUserGuest()) {
      alert("游客不能转发内容，请先发送 /实名认证 完成认证。");
      return;
    }

   shareMode = "comment";

  shareCommentTarget = comment;

  const panel = document.getElementById("threadSharePanel");
  const titleEl = document.getElementById("threadShareTitle");
  const listEl = document.getElementById("threadShareTargetList");

  if (!panel) {
    alert("转发面板不存在，请先打开帖子详情。");
    return;
  }

  if (titleEl) titleEl.textContent = "转发评论";
  if (listEl) {
    listEl.innerHTML = renderShareTargetListHtml();
    bindShareTargetButtons(listEl); // 关键：评论转发也要重新绑点击
  }

  panel.hidden = false;
});

document.getElementById("commentActionDeleteBtn")?.addEventListener("click", async () => {
  if (!activeCommentAction?.id || !selectedThread?.id) return;

  const deletedCommentId = Number(activeCommentAction.id);

  const ok = window.confirm("确定删除这条评论吗？删除后楼层会保留。");
  if (!ok) return;

  try {
    const res = await fetch(`${API_BASE_URL}/api/comments/${activeCommentAction.id}`, {
      method: "DELETE",
      headers: {
        ...getAuthHeaders()
      }
    });

    const data = await res.json();

    if (!res.ok || !data.success) {
  
      if (data?.message === "该评论已删除") {
  hideCommentActionMenu();

  selectedThread = {
    ...selectedThread,
    comments: (selectedThread.comments || []).map((item) => {
      if (Number(item.id) === deletedCommentId) {
        return {
          ...item,
          isDeleted: true,
          text: "该评论已删除",
          likeCount: 0,
          dislikeCount: 0,
          currentUserReaction: null
        };
      }

      if (item.replyTo && Number(item.replyTo.id) === deletedCommentId) {
        return {
          ...item,
          replyTo: {
            ...item.replyTo,
            text: "原评论已删除",
            isDeleted: true
          }
        };
      }

      return item;
    })
  };

  threadDetailCache.set(selectedThread.id, selectedThread);
  replyTarget = null;
  renderThreadDetailView();

  threadDetailCache.delete(selectedThread.id);
  const detail = await loadThreadDetail(selectedThread.id);
  selectedThread = detail;
  replyTarget = null;
  renderThreadDetailView();
  return;
}

  throw new Error(data?.message || "删除评论失败");
}

    hideCommentActionMenu();

selectedThread = {
  ...selectedThread,
  comments: (selectedThread.comments || []).map((item) => {
    if (Number(item.id) === deletedCommentId) {
      return {
        ...item,
        isDeleted: true,
        text: "该评论已删除",
        likeCount: 0,
        dislikeCount: 0,
        currentUserReaction: null
      };
    }

    if (item.replyTo && Number(item.replyTo.id) === deletedCommentId) {
      return {
        ...item,
        replyTo: {
          ...item.replyTo,
          text: "原评论已删除",
          isDeleted: true
        }
      };
    }

    return item;
  })
};

threadDetailCache.set(selectedThread.id, selectedThread);
replyTarget = null;
renderThreadDetailView();

threadDetailCache.delete(selectedThread.id);
const detail = await loadThreadDetail(selectedThread.id);
selectedThread = detail;
replyTarget = null;
renderThreadDetailView();

  } catch (error) {
    console.error("删除评论失败：", error);
    alert(error.message || "删除评论失败");
  }
});

document.addEventListener("click", (event) => {
  const menu = document.getElementById("commentActionMenu");
  if (!menu || menu.hidden) return;

  if (menu.contains(event.target)) return;
  if (event.target.closest(".comment-item")) return;

  hideCommentActionMenu();
});

  document.getElementById("forumBackBtn")?.addEventListener("click", () => {
    handleBack();
  });


  // ====== 删除板块按钮 ======
  document.getElementById("deleteBoardBtn")?.addEventListener("click", async () => {
    if (!selectedBoard) return;

    const name = selectedBoard.name;
    const slug = selectedBoard.slug;

    if (isCurrentUserManager()) {
      const reason = prompt(`确定要删除板块「${name}」吗？\n请输入删除理由（可选）：`);
      if (reason === null) return;

      try {
        const res = await fetch(`http://43.135.26.183:3000/api/boards/${encodeURIComponent(slug)}/direct-delete`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getForumAuthHeaders()
          },
          body: JSON.stringify({ reason })
        });
        const data = await res.json();
        alert(data.message || "操作完成");
        if (data.success) {
          window.dispatchEvent(new CustomEvent("forum:reload-threads"));
          goForumHomeFromNav();
        }
      } catch (err) {
        alert("删除失败：" + err.message);
      }
    } else {
      const reason = prompt(`你是版主，需要提交删除申请给管理员审核。\n请输入删除板块「${name}」的理由：`);
      if (!reason) {
        alert("请填写删除理由");
        return;
      }

      try {
        const res = await fetch(`http://43.135.26.183:3000/api/boards/${encodeURIComponent(slug)}/delete-request`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            ...getForumAuthHeaders()
          },
          body: JSON.stringify({ reason })
        });
        const data = await res.json();
        alert(data.message || "操作完成");
      } catch (err) {
        alert("提交失败：" + err.message);
      }
    }
  });

  document.getElementById("toggleBoardPickerBtn")?.addEventListener("click", () => {
    const dropdown = document.getElementById("boardPickerDropdown");
    if (!dropdown) return;
    dropdown.hidden = !dropdown.hidden;
  });

const threadSearchInput = document.getElementById("threadSearchInput");

// 防止浏览器刷新后把学号/账号自动填进搜索框
if (threadSearchInput) {
  threadSearchInput.value = "";
  threadSearchInput.setAttribute("autocomplete", "off");

  // 有些浏览器会稍晚才自动填充，延迟再清一次
  setTimeout(() => {
    if (threadSearchInput.value && !threadSearchInput.dataset.userTyped) {
      threadSearchInput.value = "";
    }
  }, 50);

  setTimeout(() => {
    if (threadSearchInput.value && !threadSearchInput.dataset.userTyped) {
      threadSearchInput.value = "";
    }
  }, 300);

  threadSearchInput.addEventListener("input", () => {
    threadSearchInput.dataset.userTyped = "1";
  }, { once: true });
}

threadSearchInput?.addEventListener("input", (e) => {

    handleTopSearchInput(e.target.value || "");
  });

  threadSearchInput?.addEventListener("keydown", async (e) => {
  if (e.key !== "Enter") return;

  e.preventDefault();

  const keyword = e.target.value || "";
  const q = String(keyword).trim();

  if (!q) {
    closeForumSearchPage(true);
    return;
  }

  await openForumSearchPage(q);
});

  document.getElementById("newThreadBtn")?.addEventListener("click", () => {
  if (!selectedBoard) return;

  if (selectedBoard.canCurrentUserPost === false) {
    alert("当前身份组无该板块发帖权限。");
    return;
  }

  isComposerOpen = true;
  selectedThread = null;
  replyTarget = null;
renderForum();

pushForumNav("发布帖子", closeForumComposerFromNav, {
  type: "forum-composer",
  key: selectedBoard.slug
});

});

document.getElementById("cancelComposerBtn")?.addEventListener("click", () => {
  if (window.ForumNav?.back) {
    window.ForumNav.back();
    return;
  }

  isComposerOpen = false;
  resetComposerForm();
  renderForum();
});


document.getElementById("submitComposerBtn")?.addEventListener("click", async () => {
  if (!selectedBoard) return;

  const payload = collectComposerPayload();

  if (!payload.title) {
    alert("请输入标题。");
    return;
  }

  if (!payload.content) {
    alert("请输入正文。");
    return;
  }

  try {
    const submitBtn = document.getElementById("submitComposerBtn");
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = "发布中...";
    }

    // 1. 先发帖
    const newThread = await createThreadInBoard(selectedBoard.slug, payload);

    // 2. 立刻关闭发帖框，刷新列表并打开新帖
    isComposerOpen = false;
    resetComposerForm();

    await loadThreadsByBoard(selectedBoard.slug);

    selectedThread = await loadThreadDetail(newThread.id);
    if (!selectedThread) {
      selectedThread = newThread;
    }

    threadDetailCache.set(selectedThread.id, selectedThread);
    renderForum();

    // 导航：先回到板块，再进入新帖，避免卡在发帖页
    if (window.ForumNav?.back) {
      window.ForumNav.back();
    }

    pushForumNav(selectedThread.title || newThread.title, goForumBoardFromNav, {
      type: "forum-thread",
      key: String(selectedThread.id)
    });

    // 3. 剧情区：帖子已经显示后，再请求 AI 回复
    if (isStoryBoard()) {
      try {
        await createStoryRepliesForThread(selectedThread, readTavernContextText());

        // createStoryRepliesForThread 内部已经强制刷新了
        // 这里再保险一次
        selectedThread = await loadThreadDetail(selectedThread.id, true);
        if (selectedThread) {
          renderForum();
        }
      } catch (aiError) {
        console.warn("帖子已发布，但 AI 回复失败：", aiError);
        alert("帖子已发布，但 AI 回复失败：" + (aiError.message || "未知错误"));
      }
    }
  } catch (error) {
    console.error("发帖失败：", error);
    alert(error.message || "发帖失败");
  } finally {
    const submitBtn = document.getElementById("submitComposerBtn");
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.textContent = "发布";
    }
  }
});

}


// ====== 板块删除按钮事件 ======
document.addEventListener("click", async (e) => {
  const btn = e.target.closest(".board-delete-btn");
  if (!btn) return;

  e.stopPropagation();
  e.preventDefault();

  const slug = btn.dataset.boardSlug;
  const name = btn.dataset.boardName;

  if (typeof isCurrentUserManager === "function" && isCurrentUserManager()) {
    const reason = prompt(`确定要删除板块「${name}」吗？\n请输入删除理由（可选）：`);
    if (reason === null) return;

    try {
      const res = await fetch(`http://43.135.26.183:3000/api/boards/${encodeURIComponent(slug)}/direct-delete`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getForumAuthHeaders()
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      alert(data.message || "操作完成");
      if (data.success) {
        window.dispatchEvent(new CustomEvent("forum:reload-threads"));
        if (typeof renderForumHome === "function") renderForumHome();
      }
    } catch (err) {
      alert("删除失败：" + err.message);
    }
  } else {
    const reason = prompt(`你是版主，需要提交删除申请给管理员审核。\n请输入删除板块「${name}」的理由：`);
    if (!reason) {
      alert("请填写删除理由");
      return;
    }

    try {
      const res = await fetch(`http://43.135.26.183:3000/api/boards/${encodeURIComponent(slug)}/delete-request`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...getForumAuthHeaders()
        },
        body: JSON.stringify({ reason })
      });
      const data = await res.json();
      alert(data.message || "操作完成");
    } catch (err) {
      alert("提交失败：" + err.message);
    }
  }
});
