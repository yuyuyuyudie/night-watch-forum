export function initCacheActions() {
  document.getElementById("clearCacheBtn")?.addEventListener("click", clearAllCacheAndReload);
  document.getElementById("clearForumDataBtn")?.addEventListener("click", clearForumStorageOnly);
}

async function clearAllCacheAndReload() {
  const ok = confirm("确定清除所有本地缓存并刷新页面吗？");
  if (!ok) return;

  try {
    localStorage.clear();
    sessionStorage.clear();

    if ("caches" in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map(key => caches.delete(key)));
    }
  } catch (error) {
    console.error("清缓存失败：", error);
  }

  window.location.reload(true);
}

function clearForumStorageOnly() {
  const ok = confirm("确定清空当前论坛本地数据吗？");
  if (!ok) return;

  Object.keys(localStorage)
    .filter(key => key.startsWith("cassell_"))
    .forEach(key => localStorage.removeItem(key));

  location.reload();
}
