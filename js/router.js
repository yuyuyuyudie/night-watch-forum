import { state } from "./state.js";

const routeMap = {
  threads: "守夜人论坛",
  events: "活动档案",
  messages: "消息中心",
  settings: "终端设置"
};

export function initRouter() {
  const tabs = document.querySelectorAll(".nav-tab");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      switchRoute(tab.dataset.route);
    });
  });
}

export function getRouteTitle(route = state.selectedRoute) {
  return routeMap[route] || "守夜人论坛";
}


export function switchRoute(route) {
  state.selectedRoute = route;

  document.querySelectorAll(".nav-tab").forEach((btn) => {
    btn.classList.toggle("active", btn.dataset.route === route);
  });

  document.querySelectorAll(".page").forEach((page) => {
    page.classList.remove("active");
  });

  const target = document.getElementById(`page-${route}`);
  if (target) target.classList.add("active");

  const routeTitle = document.getElementById("routeTitle");
  const profileHomeOverlay = document.getElementById("profileHomeOverlay");

  if (profileHomeOverlay?.classList.contains("active")) {
    if (routeTitle) routeTitle.textContent = "个人主页";
  } else {
    if (routeTitle) routeTitle.textContent = getRouteTitle(route);
  }
}
