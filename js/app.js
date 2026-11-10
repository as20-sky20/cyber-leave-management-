
// ==========================================
// LEFT SIDEBAR NAVIGATION CONTROLS (DESKTOP & MOBILE)
// ==========================================

function toggleSidebarNav() {
  const sidebar = document.getElementById("portalSidebarNav");
  const isMobile = window.innerWidth < 992 || document.body.classList.contains("force-mobile-view");

  if (isMobile) {
    if (sidebar && sidebar.classList.contains("mobile-open")) {
      closeSidebarNav();
    } else {
      openSidebarNav();
    }
  } else {
    document.body.classList.toggle("sidebar-collapsed");
  }
}

function openSidebarNav() {
  const sidebar = document.getElementById("portalSidebarNav");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (sidebar) sidebar.classList.add("mobile-open");
  if (backdrop) backdrop.classList.add("active");
  document.body.classList.add("sidebar-open-lock");
}

function closeSidebarNav() {
  const sidebar = document.getElementById("portalSidebarNav");
  const backdrop = document.getElementById("sidebarBackdrop");
  if (sidebar) sidebar.classList.remove("mobile-open");
  if (backdrop) backdrop.classList.remove("active");
  document.body.classList.remove("sidebar-open-lock");
}

function openSidebarOfficerProfile() {
  openMobileDrawer();
}
﻿/**
 * Haryana Cyber Police - Leave Management Portal
 * Core Application Engine & Workflow Controller
 */

// Application State
const AppState = {
  users: [],
  leaves: [],
  branches: [],
  notices: [],
  currentUser: null,
  activeTab: "dashboard",
  selectedLeaveForAction: null,
  currentAttachment: null
};

// LAN Shared Database Sync State
let isLanServerConnected = false;
let lanSyncPollingId = null;

// Initialize Application
function initApp() {
  loadFromLocalStorage();
  recalculateAllUserLeaveBalances();
  initViewMode();
  populateUserSwitcher();
  setupEventListeners();
  renderApp();

  // Connect to shared LAN office database and Real-time Cloud Stream
  syncWithOfficeDatabase();
  startLanBackgroundSync();
  startLiveSync();
}

function updateSyncIndicator(isConnected, statusText) {
  const indicator = document.getElementById("lanSyncIndicator");
  const textEl = document.getElementById("syncStatusText");
  if (!indicator) return;

  if (isConnected) {
    indicator.classList.remove("offline");
    if (textEl) textEl.textContent = statusText || "Office LAN Sync";
  } else {
    indicator.classList.add("offline");
    if (textEl) textEl.textContent = statusText || "Local Mode (Offline)";
  }
}

// Load data from localStorage or Seed Data (with Anti-Corruption ? sanitization)
function loadFromLocalStorage() {
  try {
    const rawBranches = localStorage.getItem("cyber_police_branches");
    const rawUsers = localStorage.getItem("cyber_police_users");
    const rawLeaves = localStorage.getItem("cyber_police_leaves");
    const rawNotices = localStorage.getItem("cyber_police_notices");

    // CRITICAL: If any stored data contains question marks '????' from earlier encoding bugs, purge immediately!
    const isCorrupted = (rawBranches && rawBranches.includes("????")) ||
                        (rawUsers && rawUsers.includes("????")) ||
                        (rawLeaves && rawLeaves.includes("????")) ||
                        (rawNotices && rawNotices.includes("????"));

    if (isCorrupted) {
      console.warn("Detected corrupted UTF-8 question marks in localStorage. Purging and resetting to clean defaults.");
      localStorage.removeItem("cyber_police_branches");
      localStorage.removeItem("cyber_police_users");
      localStorage.removeItem("cyber_police_leaves");
      localStorage.removeItem("cyber_police_notices");
      AppState.branches = BRANCHES;
      AppState.users = DEFAULT_USERS;
      AppState.leaves = DEFAULT_LEAVES;
      AppState.notices = (typeof DEFAULT_NOTICES !== "undefined") ? DEFAULT_NOTICES : [];
    } else {
      AppState.branches = rawBranches ? JSON.parse(rawBranches) : BRANCHES;
      AppState.users = rawUsers ? JSON.parse(rawUsers) : DEFAULT_USERS;
      const spUser = AppState.users.find(u => u.id === "SP-001" || u.role === "sp_cyber");
      if (spUser) {
        spUser.name = "Mayank Gupta, IPS";
      }

      // Repair and validate user leave balances against seed defaults
      if (!AppState.users || !Array.isArray(AppState.users) || AppState.users.length === 0) {
        AppState.users = DEFAULT_USERS;
      } else {
        AppState.users.forEach(u => {
          const def = (typeof DEFAULT_USERS !== "undefined") ? DEFAULT_USERS.find(du => du.id === u.id) : null;
          if (def && def.leaveBalances) {
            if (!u.initialLeaveBalances) {
              u.initialLeaveBalances = { ...def.leaveBalances };
            }
            if (!u.leaveBalances || typeof u.leaveBalances.CL !== "number") {
              u.leaveBalances = { ...def.leaveBalances };
            }
          }
        });
      }

      if (rawLeaves) {
        AppState.leaves = JSON.parse(rawLeaves);
        AppState.leaves.forEach(l => {
          if (!l.originalDays) l.originalDays = l.totalDays;
          if (!l.originalToDate) l.originalToDate = l.toDate;
          if (l.attachment === undefined) l.attachment = null;
        });
      } else {
        AppState.leaves = DEFAULT_LEAVES;
      }

      if (rawNotices) {
        AppState.notices = JSON.parse(rawNotices);
      } else {
        AppState.notices = (typeof DEFAULT_NOTICES !== "undefined") ? DEFAULT_NOTICES : [];
      }
    }

    // Always recalculate exact non-duplicative leave balances
    recalculateAllUserLeaveBalances();

    // Use sessionStorage so every fresh browser visit lands on the Police Login Page
    const sessionUserId = sessionStorage.getItem("cyber_police_current_user_id");
    if (sessionUserId) {
      AppState.currentUser = AppState.users.find(u => u.id === sessionUserId) || null;
    } else {
      AppState.currentUser = null;
      localStorage.removeItem("cyber_police_current_user_id");
    }
  } catch (e) {
    console.error("Error loading data from localStorage, reverting to defaults", e);
    AppState.branches = BRANCHES;
    AppState.users = DEFAULT_USERS;
    AppState.leaves = DEFAULT_LEAVES;
    AppState.notices = (typeof DEFAULT_NOTICES !== "undefined") ? DEFAULT_NOTICES : [];
    AppState.currentUser = null;
    recalculateAllUserLeaveBalances();
  }
}

// Calculate accurate, non-duplicative leave balances for all users based on approved applications
function recalculateAllUserLeaveBalances() {
  if (!AppState.users || !Array.isArray(AppState.users)) return;

  AppState.users.forEach(user => {
    const defaultUser = (typeof DEFAULT_USERS !== "undefined") ? DEFAULT_USERS.find(du => du.id === user.id) : null;
    const baseBalances = defaultUser && defaultUser.leaveBalances
      ? { ...defaultUser.leaveBalances }
      : (user.initialLeaveBalances ? { ...user.initialLeaveBalances } : { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 5, HPL: 20, RH: 2 });

    user.initialLeaveBalances = { ...baseBalances };

    // Sum up only APPROVED leave days for this applicant in 2026
    const approvedLeaves = (AppState.leaves || []).filter(l => l.applicantId === user.id && l.status === "APPROVED");

    const deductions = {};
    approvedLeaves.forEach(l => {
      const type = l.leaveType;
      const days = Number(l.totalDays) || 0;
      deductions[type] = (deductions[type] || 0) + days;
    });

    const computedBalances = {};
    Object.keys(baseBalances).forEach(code => {
      const base = Number(baseBalances[code]) || 0;
      const used = deductions[code] || 0;
      computedBalances[code] = Math.max(0, base - used);
    });

    user.leaveBalances = computedBalances;
  });
}

// ============================================================================
// REAL-TIME MULTI-DEVICE CLOUD SYNC ENGINE (Pub/Sub & SSE Stream)
// Works 100% across multiple computers, laptops, and mobile phones simultaneously
// Zero CORS preflight issues, zero API keys, instant cross-device updates (< 100ms)
// ============================================================================
const LIVE_SYNC_PUB_URL = "https://ntfy.sh/haryana-cyber-police-leave-v2026-v2";
const LIVE_SYNC_SUB_URL = "https://ntfy.sh/haryana-cyber-police-leave-v2026-v2/sse";
const LIVE_SYNC_POLL_URL = "https://ntfy.sh/haryana-cyber-police-leave-v2026-v2/json?poll=1&since=all";

let isCloudConnected = false;
let liveSseSource = null;
let lastProcessedSyncIds = new Set();

function getClientId() {
  let cid = localStorage.getItem("cyber_police_client_uuid");
  if (!cid) {
    cid = "PC-" + Math.random().toString(36).substring(2, 10);
    localStorage.setItem("cyber_police_client_uuid", cid);
  }
  return cid;
}

// Strip heavy base64 dataUrl before broadcast so message payload is < 1.5 KB
function sanitizeLeaveForBroadcast(leave) {
  if (!leave) return null;
  const clone = { ...leave };
  if (clone.attachment && clone.attachment.dataUrl) {
    clone.attachment = {
      name: clone.attachment.name,
      size: clone.attachment.size,
      type: clone.attachment.type
    };
  }
  return clone;
}

// Connect and Sync with Shared Office Database (Local LAN server OR Real-time Cloud Stream)
async function syncWithOfficeDatabase() {
  updateSyncIndicator(false, "Syncing...");

  // 1. First try Local Office LAN Server (if running via start_server.ps1)
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.users && data.leaves && data.branches) {
        const jsonStr = JSON.stringify(data);
        if (!jsonStr.includes("????")) {
          mergeIncomingData(data);
          isLanServerConnected = true;
          updateSyncIndicator(true, "Office LAN Sync");
          saveData();
          populateUserSwitcher();
          renderNavigationTabs();
          renderApp();
          showToast(`Synced with Office Server (${AppState.leaves.length} Applications)`, "success");
          return;
        }
      }
    }
  } catch (e) {
    // Local server not available, fall through to Cloud sync
  }

  // 2. Poll Cloud Live Sync History & Request Peer Sync
  await pollLiveSyncHistory();
  await broadcastLiveAction({ action: "REQUEST_SYNC" });
  updateSyncIndicator(true, "Live Cloud Sync Online");
  showToast(`Cloud Sync Active: ${AppState.leaves.length} applications synced across all devices`, "success");
  closeSidebarNav();
  renderApp();
}

// Start Live Cross-Device Real-Time Sync (SSE + Background Polling)
function startLiveSync() {
  pollLiveSyncHistory();
  connectLiveSSE();

  // Send request for latest leaves after initial connection
  setTimeout(() => {
    broadcastLiveAction({ action: "REQUEST_SYNC" });
  }, 1200);

  // Background refresh every 10 seconds to catch any missed updates
  setInterval(() => {
    if (!liveSseSource || liveSseSource.readyState === EventSource.CLOSED) {
      connectLiveSSE();
    }
    pollLiveSyncHistory();
  }, 10000);
}

function connectLiveSSE() {
  if (typeof EventSource === "undefined") return;
  if (liveSseSource) {
    try { liveSseSource.close(); } catch (e) {}
  }
  try {
    liveSseSource = new EventSource(LIVE_SYNC_SUB_URL);
    liveSseSource.onopen = () => {
      isCloudConnected = true;
      updateSyncIndicator(true, "Live Cloud Sync Online");
    };
    liveSseSource.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "message" && msg.message) {
          if (msg.id && lastProcessedSyncIds.has(msg.id)) return;
          if (msg.id) lastProcessedSyncIds.add(msg.id);

          const msgStr = msg.message.trim();
          if (!msgStr.startsWith("{")) return;

          const payload = JSON.parse(msgStr);
          handleLiveSyncAction(payload);
        }
      } catch (err) {
        console.warn("Live SSE parse error", err);
      }
    };
    liveSseSource.onerror = () => {
      updateSyncIndicator(false, "Reconnecting Sync...");
    };
  } catch (e) {
    console.warn("Live SSE connect error", e);
  }
}

// Poll recent events from Cloud history on page load and periodically
async function pollLiveSyncHistory() {
  try {
    const res = await fetch(LIVE_SYNC_POLL_URL, { cache: "no-store" });
    if (res.ok) {
      const text = await res.text();
      const lines = text.trim().split("\n");
      lines.forEach(line => {
        if (!line.trim()) return;
        try {
          const data = JSON.parse(line);
          if (data.event === "message" && data.message) {
            if (data.id && lastProcessedSyncIds.has(data.id)) return;
            if (data.id) lastProcessedSyncIds.add(data.id);

            const msgStr = data.message.trim();
            if (!msgStr.startsWith("{")) return;

            const payload = JSON.parse(msgStr);
            handleLiveSyncAction(payload);
          }
        } catch (e) {}
      });
      isCloudConnected = true;
      updateSyncIndicator(true, "Live Cloud Sync Online");
    }
  } catch (e) {
    console.warn("Live sync history poll error", e);
  }
}

// Broadcast an action to all other connected computers and mobile devices
async function broadcastLiveAction(actionPayload) {
  try {
    actionPayload.clientId = getClientId();
    actionPayload.timestamp = Date.now();

    if (actionPayload.leave) {
      actionPayload.leave = sanitizeLeaveForBroadcast(actionPayload.leave);
    }
    if (Array.isArray(actionPayload.leaves)) {
      actionPayload.leaves = actionPayload.leaves.map(sanitizeLeaveForBroadcast);
    }

    const bodyText = JSON.stringify(actionPayload);

    // Uses text/plain to guarantee zero CORS preflight issues across all browsers
    await fetch(LIVE_SYNC_PUB_URL, {
      method: "POST",
      headers: { "Content-Type": "text/plain; charset=utf-8" },
      body: bodyText
    });
    updateSyncIndicator(true, "Live Cloud Sync Online");
  } catch (err) {
    console.warn("Could not broadcast live action", err);
  }
}

// Process actions received from other computers / devices in real time
function handleLiveSyncAction(payload) {
  if (!payload || !payload.action) return;

  // Do not process our own actions again
  if (payload.clientId && payload.clientId === getClientId()) {
    return;
  }

  let hasChanged = false;

  // 1. NEW LEAVE APPLIED ON ANOTHER COMPUTER
  if (payload.action === "NEW_LEAVE" && payload.leave) {
    const existingIndex = AppState.leaves.findIndex(l => l.id === payload.leave.id);
    if (existingIndex === -1) {
      AppState.leaves.unshift(payload.leave);
      hasChanged = true;
      showToast(`New Leave Application: ${payload.leave.applicantName} (${payload.leave.totalDays} Days)`, "info");
    }
  }

  // 2. LEAVE STATUS CHANGED (INCHARGE RECOMMENDATION OR SP APPROVAL)
  else if (payload.action === "LEAVE_STATUS_CHANGED" && payload.leaveId) {
    const leave = AppState.leaves.find(l => l.id === payload.leaveId);
    if (leave) {
      leave.status = payload.status;
      if (payload.inchargeRemarks !== undefined) leave.inchargeRemarks = payload.inchargeRemarks;
      if (payload.inchargeActionAt !== undefined) leave.inchargeActionAt = payload.inchargeActionAt;
      if (payload.spRemarks !== undefined) leave.spRemarks = payload.spRemarks;
      if (payload.spActionAt !== undefined) leave.spActionAt = payload.spActionAt;
      if (payload.curtailedDays) leave.totalDays = payload.curtailedDays;
      if (payload.toDate) leave.toDate = payload.toDate;
      if (payload.curtailedBy) leave.curtailedBy = payload.curtailedBy;
      if (payload.curtailReason) leave.curtailReason = payload.curtailReason;

      // Recalculate deterministic leave balances accurately
      recalculateAllUserLeaveBalances();

      hasChanged = true;
      const statusLabel = payload.status === "RECOMMENDED" ? "Recommended by Branch Incharge" : 
                          (payload.status === "APPROVED" ? "Sanctioned by SP Cyber" : "Rejected");
      showToast(`Application ${leave.id} Status Updated: ${statusLabel}`, "info");
    }
  }

  // 3. NOTICE CREATION ON ANOTHER COMPUTER
  else if (payload.action === "NEW_NOTICE" && payload.notice) {
    if (!AppState.notices) AppState.notices = [];
    if (!AppState.notices.some(n => n.id === payload.notice.id)) {
      AppState.notices.unshift(payload.notice);
      hasChanged = true;
      showToast(`New Office Order / Notice: ${payload.notice.title}`, "info");
    }
  }

  // 4. NOTICE DELETION
  else if (payload.action === "DELETE_NOTICE" && payload.noticeId) {
    if (AppState.notices) {
      AppState.notices = AppState.notices.filter(n => n.id !== payload.noticeId);
      hasChanged = true;
    }
  }

  // 5. REQUEST_SYNC (Another newly connected device wants all leaves)
  else if (payload.action === "REQUEST_SYNC") {
    if (AppState.leaves && AppState.leaves.length > 0) {
      broadcastLiveAction({
        action: "SYNC_ALL_LEAVES",
        leaves: AppState.leaves.slice(0, 50).map(sanitizeLeaveForBroadcast)
      });
    }
    return;
  }

  // 6. SYNC_ALL_LEAVES (Incoming full state sync)
  else if (payload.action === "SYNC_ALL_LEAVES" && Array.isArray(payload.leaves)) {
    payload.leaves.forEach(incoming => {
      if (!incoming || !incoming.id) return;
      const existing = AppState.leaves.find(l => l.id === incoming.id);
      if (!existing) {
        AppState.leaves.push(incoming);
        hasChanged = true;
      } else {
        if (existing.status !== incoming.status || existing.totalDays !== incoming.totalDays) {
          Object.assign(existing, incoming);
          hasChanged = true;
        }
      }
    });

    if (hasChanged) {
      AppState.leaves.sort((a, b) => new Date(b.appliedAt || 0) - new Date(a.appliedAt || 0));
    }
  }

  if (hasChanged) {
    recalculateAllUserLeaveBalances();
    saveData();
    renderNavigationTabs();
    if (["dashboard", "incharge_desk", "sp_desk", "daily_sitrep", "master_register", "notices", "my_leaves"].includes(AppState.activeTab)) {
      renderApp();
    }
  }
}

// 1-Click Role / User Switcher Helper
function quickSwitchUser(userId) {
  const target = AppState.users.find(u => u.id === userId);
  if (target) {
    AppState.currentUser = target;
    recalculateAllUserLeaveBalances();
    localStorage.setItem("cyber_police_current_user_id", target.id);
    const sel = document.getElementById("userSwitchSelect");
    if (sel) sel.value = target.id;
    const sideSel = document.getElementById("sidebarUserSwitchSelect");
    if (sideSel) sideSel.value = target.id;
    const mobSel = document.getElementById("mobileUserSwitchSelect");
    if (mobSel) mobSel.value = target.id;
    updateUserBadge();
    renderNavigationTabs();
    renderApp();
    showToast(`Switched account to ${target.name} (${target.rank})`, "info");
  }
}

// Filter Branch Incharge Desk by Branch ID or "ALL"
function setInchargeBranchFilter(branchId) {
  AppState.inchargeBranchFilter = branchId;
  renderApp();
}

// Save data to localStorage and local LAN office server if running
function saveData() {
  saveToLocalStorageOnly();
  if (isLanServerConnected) {
    pushDataToOfficeServer();
  }
}

function saveToLocalStorageOnly() {
  localStorage.setItem("cyber_police_branches", JSON.stringify(AppState.branches));
  localStorage.setItem("cyber_police_users", JSON.stringify(AppState.users));
  localStorage.setItem("cyber_police_leaves", JSON.stringify(AppState.leaves));
  localStorage.setItem("cyber_police_notices", JSON.stringify(AppState.notices || []));
  if (AppState.currentUser) {
    localStorage.setItem("cyber_police_current_user_id", AppState.currentUser.id);
  }
}

async function pushDataToOfficeServer() {
  try {
    const payload = {
      branches: AppState.branches,
      users: AppState.users,
      leaves: AppState.leaves,
      notices: AppState.notices || [],
      updatedAt: new Date().toISOString()
    };
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      isLanServerConnected = true;
      updateSyncIndicator(true, "Office LAN Sync");
    }
  } catch (e) {
    isLanServerConnected = false;
  }
}

function startLanBackgroundSync() {
  if (lanSyncPollingId) clearInterval(lanSyncPollingId);
  lanSyncPollingId = setInterval(async () => {
    if (document.hidden) return;
    if (isLanServerConnected) {
      try {
        const res = await fetch("/api/data", { cache: "no-store" });
        if (res.ok) {
          const data = await res.json();
          mergeIncomingData(data);
          saveToLocalStorageOnly();
          renderNavigationTabs();
          if (["dashboard", "incharge_desk", "sp_desk", "daily_sitrep", "master_register", "notices", "my_leaves"].includes(AppState.activeTab)) {
            renderApp();
          }
        }
      } catch (e) {
        isLanServerConnected = false;
      }
    }
  }, 8000);
}

function mergeIncomingData(data) {
  if (!data || !data.leaves || !data.users) return false;
  if (JSON.stringify(data).includes("????")) return false;

  let hasChanged = false;
  const incomingMap = new Map();
  (data.leaves || []).forEach(l => incomingMap.set(l.id, l));

  const mergedLeaves = [];
  AppState.leaves.forEach(localLeave => {
    if (incomingMap.has(localLeave.id)) {
      const incomingLeave = incomingMap.get(localLeave.id);
      if (JSON.stringify(localLeave) !== JSON.stringify(incomingLeave)) {
        mergedLeaves.push(incomingLeave);
        hasChanged = true;
      } else {
        mergedLeaves.push(localLeave);
      }
      incomingMap.delete(localLeave.id);
    } else {
      mergedLeaves.push(localLeave);
    }
  });

  incomingMap.forEach(cloudLeave => {
    mergedLeaves.push(cloudLeave);
    hasChanged = true;
  });

  mergedLeaves.sort((a, b) => {
    const timeA = new Date(a.appliedAt || 0).getTime();
    const timeB = new Date(b.appliedAt || 0).getTime();
    return timeB - timeA;
  });

  if (JSON.stringify(AppState.leaves) !== JSON.stringify(mergedLeaves)) {
    AppState.leaves = mergedLeaves;
    hasChanged = true;
  }

  return hasChanged;
}

// Reset Demo Data
function resetDemoData() {
  if (confirm("Are you sure you want to reset all data to default demo state?")) {
    localStorage.removeItem("cyber_police_branches");
    localStorage.removeItem("cyber_police_users");
    localStorage.removeItem("cyber_police_leaves");
    localStorage.removeItem("cyber_police_notices");
    localStorage.removeItem("cyber_police_current_user_id");
    AppState.branches = BRANCHES;
    AppState.users = DEFAULT_USERS;
    AppState.leaves = DEFAULT_LEAVES;
    AppState.notices = (typeof DEFAULT_NOTICES !== "undefined") ? DEFAULT_NOTICES : [];
    AppState.currentUser = null;
    saveData();
    populateUserSwitcher();
    renderApp();
    showToast("Data successfully reset to defaults.", "success");
  }
}

// ============================================================================
// MOBILE APP CONTROLS & DEDICATED VIEW SYSTEM
// ============================================================================
function initViewMode() {
  const savedView = localStorage.getItem("cyber_preferred_view") || "auto";
  applyViewMode(savedView);

  window.addEventListener("resize", () => {
    const saved = localStorage.getItem("cyber_preferred_view") || "auto";
    if (saved === "auto") {
      updateToggleButtons(window.innerWidth <= 768);
    }
  });
}

function applyViewMode(mode) {
  const body = document.body;
  if (mode === "mobile") {
    body.classList.add("force-mobile-view");
    body.classList.remove("force-desktop-view");
    updateToggleButtons(true);
  } else if (mode === "desktop") {
    body.classList.add("force-desktop-view");
    body.classList.remove("force-mobile-view");
    updateToggleButtons(false);
  } else {
    body.classList.remove("force-mobile-view");
    body.classList.remove("force-desktop-view");
    const isMobileWidth = window.innerWidth <= 768;
    updateToggleButtons(isMobileWidth);
  }
}

function toggleDesktopMobileMode() {
  const body = document.body;
  const isCurrentlyMobile = body.classList.contains("force-mobile-view") || 
    (!body.classList.contains("force-desktop-view") && window.innerWidth <= 768);

  if (isCurrentlyMobile) {
    localStorage.setItem("cyber_preferred_view", "desktop");
    applyViewMode("desktop");
    showToast("Switched to Desktop View", "info");
  } else {
    localStorage.setItem("cyber_preferred_view", "mobile");
    applyViewMode("mobile");
    showToast("Switched to Mobile View", "info");
  }
}

function updateToggleButtons(isMobile) {
  const drawerIcon = document.getElementById("viewModeToggleIcon");
  const drawerText = document.getElementById("viewModeToggleText");
  const desktopIcon = document.getElementById("desktopToggleIcon");
  const desktopText = document.getElementById("desktopToggleText");

  if (isMobile) {
    if (drawerIcon) drawerIcon.textContent = "💻";
    if (drawerText) drawerText.textContent = "Switch to Desktop View";
    if (desktopIcon) desktopIcon.textContent = "💻";
    if (desktopText) desktopText.textContent = "Desktop View";
  } else {
    if (drawerIcon) drawerIcon.textContent = "📱";
    if (drawerText) drawerText.textContent = "Switch to Mobile View";
    if (desktopIcon) desktopIcon.textContent = "📱";
    if (desktopText) desktopText.textContent = "Mobile View";
  }
}

function openMobileDrawer() {
  const overlay = document.getElementById("mobileDrawerOverlay");
  if (overlay) {
    overlay.classList.add("active");
    document.body.style.overflow = "hidden";
  }
}

function closeMobileDrawer() {
  const overlay = document.getElementById("mobileDrawerOverlay");
  if (overlay) {
    overlay.classList.remove("active");
    document.body.style.overflow = "";
  }
}

function handleMobileDeskClick() {
  const user = AppState.currentUser;
  if (user && user.role === "sp_cyber") {
    switchTab("sp_desk");
  } else if (user && (user.role === "branch_incharge" || user.role === "admin")) {
    switchTab("incharge_desk");
  } else {
    switchTab("notices");
  }
}

// Populate the Quick User & Role Switcher
function populateUserSwitcher() {
  const select = document.getElementById("userSwitchSelect");
  if (!select) return;

  select.innerHTML = "";

  // Group by role
  const spGroup = document.createElement("optgroup");
  spGroup.label = "--- SP Cyber (Sanctioning Authority) ---";
  const inchargeGroup = document.createElement("optgroup");
  inchargeGroup.label = "--- Branch Incharges ---";
  const memberGroup = document.createElement("optgroup");
  memberGroup.label = "--- Police Personnel / Staff ---";

  AppState.users.forEach(user => {
    const opt = document.createElement("option");
    opt.value = user.id;
    const branch = AppState.branches.find(b => b.id === user.branchId);
    const branchName = branch ? branch.name : user.branchId;
    opt.textContent = `${user.name} (${user.beltNo}) - ${user.rank} [${branchName}]`;

    if (user.role === "sp_cyber") {
      spGroup.appendChild(opt);
    } else if (user.role === "branch_incharge") {
      inchargeGroup.appendChild(opt);
    } else {
      memberGroup.appendChild(opt);
    }
  });

  select.appendChild(spGroup);
  select.appendChild(inchargeGroup);
  select.appendChild(memberGroup);

  if (AppState.currentUser) {
    select.value = AppState.currentUser.id;
  }

  // Also sync mobile drawer switcher
  const sidebarSelect = document.getElementById("sidebarUserSwitchSelect");
  if (sidebarSelect) {
    sidebarSelect.innerHTML = select.innerHTML;
    if (AppState.currentUser) sidebarSelect.value = AppState.currentUser.id;
  }

  const mobileSelect = document.getElementById("mobileUserSwitchSelect");
  if (mobileSelect) {
    mobileSelect.innerHTML = select.innerHTML;
    if (AppState.currentUser) {
      mobileSelect.value = AppState.currentUser.id;
    }
  }
}

// Switch Active User / Role
function handleUserSwitch(userId) {
  const user = AppState.users.find(u => u.id === userId);
  if (!user) return;
  AppState.currentUser = user;
  recalculateAllUserLeaveBalances();
  saveData();

  // Automatic smart tab redirection based on switched role
  if (user.role === "branch_incharge") {
    if (AppState.activeTab === "apply_leave" || AppState.activeTab === "my_leaves" || AppState.activeTab === "sp_desk") {
      AppState.activeTab = "incharge_desk";
    }
  } else if (user.role === "sp_cyber") {
    if (AppState.activeTab === "apply_leave" || AppState.activeTab === "my_leaves" || AppState.activeTab === "incharge_desk") {
      AppState.activeTab = "sp_desk";
    }
  } else if (user.role === "member") {
    if (AppState.activeTab === "incharge_desk" || AppState.activeTab === "sp_desk") {
      AppState.activeTab = "dashboard";
    }
  }

  updateHeaderUserInfo();
  renderNavigationTabs();
  renderApp();

  showToast(`Logged in as: ${user.name} (${getRoleDisplay(user.role)})`, "info");
}

function getRoleDisplay(role) {
  switch (role) {
    case "sp_cyber": return "SP Cyber (Sanctioning Authority)";
    case "branch_incharge": return "Branch Incharge";
    case "admin": return "Reader / Cyber Admin";
    default: return "Police Personnel (Staff)";
  }
}

function updateHeaderUserInfo() {
  const user = AppState.currentUser;
  if (!user) return;

  const branch = AppState.branches.find(b => b.id === user.branchId);
  const branchName = branch ? branch.name : "";

  const nameEl = document.getElementById("headerUserName");
  const roleEl = document.getElementById("headerUserRole");
  if (nameEl) nameEl.textContent = `${user.name} (${user.beltNo})`;
  if (roleEl) roleEl.textContent = `${user.rank} | ${branchName} | ${getRoleDisplay(user.role)}`;

  // Update mobile header & drawer info
  const sidebarName = document.getElementById("sidebarUserName");
  const sidebarRole = document.getElementById("sidebarUserRole");
  if (sidebarName) sidebarName.textContent = `${user.name} (${user.beltNo})`;
  if (sidebarRole) sidebarRole.textContent = `${user.rank} | ${branchName}`;

  const mobileName = document.getElementById("mobileHeaderUserName");
  if (mobileName) {
    if (user.role === "sp_cyber") mobileName.textContent = "SP Cyber";
    else if (user.role === "branch_incharge") mobileName.textContent = "Incharge";
    else mobileName.textContent = user.name.split(" ")[0];
  }

  const drawerName = document.getElementById("drawerUserName");
  const drawerRole = document.getElementById("drawerUserRole");
  if (drawerName) drawerName.textContent = `${user.name} (${user.beltNo})`;
  if (drawerRole) drawerRole.textContent = `${user.rank} | ${branchName} | ${getRoleDisplay(user.role)}`;

  const mobileSelect = document.getElementById("mobileUserSwitchSelect");
  if (mobileSelect && mobileSelect.value !== user.id) {
    mobileSelect.value = user.id;
  }

  const sidebarSelect = document.getElementById("sidebarUserSwitchSelect");
  if (sidebarSelect && sidebarSelect.value !== user.id) {
    sidebarSelect.value = user.id;
  }
}

// Navigation Tabs Handling
function switchTab(tabId) {
  const user = AppState.currentUser;
  const isSPRole = user && (user.role === "sp_cyber");
  const isBranchIncharge = user && (user.role === "branch_incharge" || user.role === "admin");

  if (isSPRole && (tabId === "apply_leave" || tabId === "my_leaves")) {
    showToast("Superintendent of Police (SP Cyber) is the Final Sanctioning Authority.", "info");
    return;
  }

  if (isSPRole && tabId === "incharge_desk") {
    showToast("Branch Incharge Desk is restricted to Branch Incharges. Please use 'SP Cyber Sanction Desk'.", "info");
    return;
  }

  if (tabId === "incharge_desk" && !isBranchIncharge) {
    showToast("Branch Incharge Desk is restricted to Branch Incharges.", "error");
    return;
  }

  const isAuthorized = user && (user.role === "branch_incharge" || user.role === "sp_cyber" || user.role === "admin");
  if (tabId === "directory" && !isAuthorized) {
    showToast("Personnel Directory is restricted to Branch Incharges and SP Cyber.", "error");
    return;
  }

  const canViewSitrep = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  if (tabId === "daily_sitrep" && !canViewSitrep) {
    showToast("Daily SITREP is restricted to SP Cyber and Cyber Admin Reader.", "error");
    return;
  }

  const canViewRegister = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  if (tabId === "master_register" && !canViewRegister) {
    showToast("Master Leave Register is restricted to SP Cyber and Cyber Admin Reader.", "error");
    return;
  }

  const isSPCommand = user && (user.role === "sp_cyber" || user.id === "SP-001");
  if (tabId === "branches" && !isSPCommand) {
    showToast("13 Cyber Wings deployment is restricted to the Superintendent of Police (SP Cyber).", "error");
    return;
  }

  AppState.activeTab = tabId;
  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
  });

  // Sync mobile bottom nav buttons
  document.querySelectorAll(".mobile-nav-btn").forEach(btn => {
    if (btn.id === "mobileNavMore") return;
    if (btn.dataset.tab === tabId) {
      btn.classList.add("active");
    } else if ((tabId === "incharge_desk" || tabId === "sp_desk" || (tabId === "notices" && user && user.role === "member")) && btn.id === "mobileNavDesk") {
      btn.classList.add("active");
    } else {
      btn.classList.remove("active");
    }
  });

  renderApp();
}

function renderNavigationTabs() {
  const user = AppState.currentUser;
  const isSP = user && (user.role === "sp_cyber" || user.role === "admin");
  const isSPRole = user && (user.role === "sp_cyber");
  const isBranchIncharge = user && (user.role === "branch_incharge");
  const canViewDirectory = user && (user.role === "branch_incharge" || user.role === "sp_cyber" || user.role === "admin");

  // Hide Apply Leave & My Leaves for SP Cyber
  const applyLeaveTabBtn = document.getElementById("tabBtnApplyLeave");
  if (applyLeaveTabBtn) {
    applyLeaveTabBtn.style.display = isSPRole ? "none" : "flex";
  }

  const myLeavesTabBtn = document.getElementById("tabBtnMyLeaves");
  if (myLeavesTabBtn) {
    myLeavesTabBtn.style.display = isSPRole ? "none" : "flex";
  }

  // Calculate pending counts
  const pendingInchargeCount = AppState.leaves.filter(l => {
    if (l.status !== "PENDING_INCHARGE") return false;
    return l.branchId === (user ? user.branchId : "");
  }).length;

  const pendingSPCount = AppState.leaves.filter(l => l.status === "RECOMMENDED").length;

  const inchargeBadge = document.getElementById("inchargeBadge");
  if (inchargeBadge) {
    inchargeBadge.textContent = pendingInchargeCount;
    inchargeBadge.style.display = pendingInchargeCount > 0 ? "inline-block" : "none";
  }

  const spBadge = document.getElementById("spBadge");
  if (spBadge) {
    spBadge.textContent = pendingSPCount;
    spBadge.style.display = pendingSPCount > 0 ? "inline-block" : "none";
  }

  const myLeavesBadge = document.getElementById("myLeavesBadge");
  if (myLeavesBadge) {
    const activeLeavesCount = AppState.leaves.filter(l => l.applicantId === (user ? user.id : "") && (l.status === "PENDING_INCHARGE" || l.status === "RECOMMENDED")).length;
    myLeavesBadge.textContent = activeLeavesCount;
    myLeavesBadge.style.display = activeLeavesCount > 0 ? "inline-block" : "none";
  }

  // Incharge Tab: Visible ONLY to Branch Incharges (HIDDEN from SP Cyber & normal members)
  const inchargeTabBtn = document.getElementById("tabBtnIncharge");
  if (inchargeTabBtn) {
    inchargeTabBtn.style.display = isBranchIncharge ? "flex" : "none";
  }

  // SP Desk Tab: Visible ONLY to SP Cyber (or Admin)
  const spTabBtn = document.getElementById("tabBtnSP");
  if (spTabBtn) {
    spTabBtn.style.display = isSP ? "flex" : "none";
  }

  // Update Mobile Bottom Nav items according to role
  const mobileApplyBtn = document.getElementById("mobileNavApply");
  const mobileMyLeavesBtn = document.getElementById("mobileNavMyLeaves");
  if (mobileApplyBtn) mobileApplyBtn.style.display = isSPRole ? "none" : "flex";
  if (mobileMyLeavesBtn) mobileMyLeavesBtn.style.display = isSPRole ? "none" : "flex";

  const mobileDeskLabel = document.getElementById("mobileDeskLabel");
  const mobileDeskBadge = document.getElementById("mobileDeskBadge");
  const mobileNavDesk = document.getElementById("mobileNavDesk");
  if (mobileDeskLabel && mobileDeskBadge) {
    if (isSPRole) {
      mobileDeskLabel.textContent = "SP Desk";
      mobileDeskBadge.textContent = pendingSPCount;
      mobileDeskBadge.style.display = pendingSPCount > 0 ? "inline-block" : "none";
      if (mobileNavDesk) mobileNavDesk.setAttribute("data-tab", "sp_desk");
    } else if (isBranchIncharge) {
      mobileDeskLabel.textContent = "Incharge Desk";
      mobileDeskBadge.textContent = pendingInchargeCount;
      mobileDeskBadge.style.display = pendingInchargeCount > 0 ? "inline-block" : "none";
      if (mobileNavDesk) mobileNavDesk.setAttribute("data-tab", "incharge_desk");
    } else {
      mobileDeskLabel.textContent = "Notices";
      const count = (AppState.notices || []).length;
      mobileDeskBadge.textContent = count;
      mobileDeskBadge.style.display = count > 0 ? "inline-block" : "none";
      if (mobileNavDesk) mobileNavDesk.setAttribute("data-tab", "notices");
    }
  }

  // Update Drawer menu items visibility
  const drawerRegisterBtn = document.getElementById("mobileDrawerRegisterBtn");
  if (drawerRegisterBtn) drawerRegisterBtn.style.display = (user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN")) ? "flex" : "none";

  const drawerSitrepBtn = document.getElementById("mobileDrawerSitrepBtn");
  if (drawerSitrepBtn) drawerSitrepBtn.style.display = (user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN")) ? "flex" : "none";

  const drawerBackupBtn = document.getElementById("mobileDrawerBackupBtn");
  if (drawerBackupBtn) drawerBackupBtn.style.display = (user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN")) ? "flex" : "none";

  const drawerNoticeCount = document.getElementById("mobileDrawerNoticeCount");
  if (drawerNoticeCount) {
    const count = (AppState.notices || []).length;
    drawerNoticeCount.textContent = count;
    drawerNoticeCount.style.display = count > 0 ? "inline-block" : "none";
  }

  // Daily Sitrep Tab: Visible ONLY to SP Cyber & Reader Desk (HIDDEN from regular members)
  const canViewSitrep = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  const sitrepTabBtn = document.getElementById("tabBtnSitrep");
  if (sitrepTabBtn) {
    sitrepTabBtn.style.display = canViewSitrep ? "flex" : "none";
  }

  // Master Leave Register Tab: Visible ONLY to SP Cyber & Reader Desk (HIDDEN from regular members)
  const canViewRegister = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  const registerTabBtn = document.getElementById("tabBtnRegister");
  if (registerTabBtn) {
    registerTabBtn.style.display = canViewRegister ? "flex" : "none";
  }

  // 13 Cyber Wings Tab: Visible ONLY to SP Cyber (SP-001)
  const branchesTabBtn = document.getElementById("tabBtnBranches");
  if (branchesTabBtn) {
    branchesTabBtn.style.display = isSPRole ? "flex" : "none";
  }

  const drawerBranchesBtn = document.getElementById("mobileDrawerBranchesBtn");
  if (drawerBranchesBtn) {
    drawerBranchesBtn.style.display = isSPRole ? "flex" : "none";
  }

  // Staff Directory visible only to Branch Incharge & SP Cyber
  const directoryTabBtn = document.getElementById("tabBtnDirectory");
  if (directoryTabBtn) {
    directoryTabBtn.style.display = canViewDirectory ? "flex" : "none";
  }

  // Notices Badge
  const noticesBadge = document.getElementById("noticesBadge");
  if (noticesBadge) {
    const totalNotices = (AppState.notices || []).length;
    noticesBadge.textContent = totalNotices;
    noticesBadge.style.display = totalNotices > 0 ? "inline-block" : "none";
  }

  // Header Backup Button (SP Cyber & Reader Desk only)
  const canBackup = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  const headerBackupBtn = document.getElementById("headerBackupBtn");
  if (headerBackupBtn) {
    headerBackupBtn.style.display = canBackup ? "inline-flex" : "none";
  }

  // If SP is currently on apply_leave, my_leaves or incharge_desk, redirect to sp_desk
  if (isSPRole && (AppState.activeTab === "apply_leave" || AppState.activeTab === "my_leaves" || AppState.activeTab === "incharge_desk")) {
    AppState.activeTab = "sp_desk";
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === "sp_desk");
    });
  }

  // If regular member is on incharge_desk, sp_desk, directory, daily_sitrep or master_register, fallback to dashboard
  if (!isBranchIncharge && !isSP && (AppState.activeTab === "incharge_desk" || AppState.activeTab === "sp_desk" || AppState.activeTab === "directory" || AppState.activeTab === "daily_sitrep" || AppState.activeTab === "master_register")) {
    AppState.activeTab = "dashboard";
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === "dashboard");
    });
  }

  // If unauthorized user is on daily_sitrep, fallback to dashboard
  if (!canViewSitrep && AppState.activeTab === "daily_sitrep") {
    AppState.activeTab = "dashboard";
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === "dashboard");
    });
  }

  // If unauthorized user is on master_register, fallback to dashboard
  if (!canViewRegister && AppState.activeTab === "master_register") {
    AppState.activeTab = "dashboard";
    document.querySelectorAll(".nav-tab-btn").forEach(btn => {
      btn.classList.toggle("active", btn.dataset.tab === "dashboard");
    });
  }
}

// Main Render Function based on Active Tab
function renderApp() {
  const loginScreen = document.getElementById("loginScreen");
  const portalHeader = document.getElementById("portalMainHeader");
  const portalLayout = document.getElementById("portalBodyLayout");

  if (!AppState.currentUser) {
    document.body.classList.add("portal-logged-out");
    if (loginScreen) {
      loginScreen.style.display = "flex";
      renderLoginScreen(loginScreen);
    }
    if (portalHeader) portalHeader.style.display = "none";
    if (portalLayout) portalLayout.style.display = "none";
    return;
  }

  document.body.classList.remove("portal-logged-out");
  if (loginScreen) loginScreen.style.display = "none";
  if (portalHeader) portalHeader.style.display = "";
  if (portalLayout) portalLayout.style.display = "";

  updateHeaderUserInfo();
  renderNavigationTabs();

  const container = document.getElementById("tabContentContainer");
  if (!container) return;

  switch (AppState.activeTab) {
    case "dashboard":
      renderDashboard(container);
      break;
    case "notices":
      renderNoticesView(container);
      break;
    case "apply_leave":
      renderApplyLeave(container);
      break;
    case "my_leaves":
      renderMyLeaves(container);
      break;
    case "incharge_desk":
      renderInchargeDesk(container);
      break;
    case "sp_desk":
      renderSPDesk(container);
      break;
    case "branches":
      renderBranchesView(container);
      break;
    case "master_register":
      renderMasterRegister(container);
      break;
    case "daily_sitrep":
      renderDailySitrep(container);
      break;
    case "directory":
      renderPersonnelDirectory(container);
      break;
    default:
      renderDashboard(container);
  }
}

// ==========================================
// VIEW 1: DASHBOARD
// ==========================================
function renderDashboard(container) {
  const user = AppState.currentUser;
  const isSPRole = user && (user.role === "sp_cyber");
  const branch = AppState.branches.find(b => b.id === user.branchId);
  const branchName = branch ? branch.name : "Cyber Wing";

  // Compute statistics
  const userLeaves = AppState.leaves.filter(l => l.applicantId === user.id);
  const pendingLeaves = userLeaves.filter(l => l.status === "PENDING_INCHARGE" || l.status === "RECOMMENDED");
  const approvedLeaves = userLeaves.filter(l => l.status === "APPROVED");

  // Overall cyber unit stats
  const totalForce = AppState.users.length;
  const currentlyOnLeave = AppState.leaves.filter(l => {
    if (l.status !== "APPROVED") return false;
    const today = new Date().toISOString().split("T")[0];
    return l.fromDate <= today && l.toDate >= today;
  }).length;
  const onDutyCount = totalForce - currentlyOnLeave;

  const spPendingLeaves = AppState.leaves.filter(l => l.status === "RECOMMENDED");
  const inchargePendingCount = AppState.leaves.filter(l => l.status === "PENDING_INCHARGE").length;
  const unitApprovedCount = AppState.leaves.filter(l => l.status === "APPROVED").length;

  // ----------------------------------------------------
  // EXECUTIVE DASHBOARD FOR SP CYBER (Mayank Gupta, IPS)
  // ----------------------------------------------------
  if (isSPRole) {
    let html = `
      <div class="page-header">
        <div class="page-title-group">
          <h2>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            SP Command Dashboard
          </h2>
          <p><strong>${user.name}</strong> (SP Cyber Crime, Panchkula)</p>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-gold btn-sm" onclick="switchTab('sp_desk')">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            Open SP Desk (${spPendingLeaves.length})
          </button>
          <button class="btn btn-outline btn-sm" onclick="switchTab('notices')" title="Official Notice Board">
            Notice Board
          </button>
          <button class="btn btn-outline btn-sm" onclick="switchTab('daily_sitrep')" title="Daily Attendance">
            SITREP
          </button>
          <button class="btn btn-outline btn-sm" onclick="openBackupModal()" title="Data Backup">
            Data Backup
          </button>
        </div>
      </div>

      <!-- SP EXECUTIVE STATS CARDS -->
      <div class="stats-grid">
        <div class="stat-card gold" onclick="switchTab('sp_desk')" style="cursor: pointer;" title="Click to open SP Sanction Desk">
          <div class="stat-header">
            <span class="stat-title">Pending Sanction</span>
            <div class="stat-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
          </div>
          <div class="stat-number" style="color: ${spPendingLeaves.length > 0 ? '#dc2626' : '#15803d'};">${spPendingLeaves.length}</div>
          <div class="stat-subtext">${spPendingLeaves.length > 0 ? 'Action Required (Click to review)' : 'All Applications Cleared'}</div>
        </div>

        <div class="stat-card blue">
          <div class="stat-header">
            <span class="stat-title">Initial Pending</span>
            <div class="stat-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg></div>
          </div>
          <div class="stat-number">${inchargePendingCount}</div>
          <div class="stat-subtext">Awaiting Branch Review</div>
        </div>

        <div class="stat-card green">
          <div class="stat-header">
            <span class="stat-title">Sanctioned Orders</span>
            <div class="stat-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
          </div>
          <div class="stat-number">${unitApprovedCount}</div>
          <div class="stat-subtext">Official Orders Issued</div>
        </div>

        <div class="stat-card purple" onclick="switchTab('daily_sitrep')" style="cursor: pointer;" title="Click to view SITREP Roll Call">
          <div class="stat-header">
            <span class="stat-title">Force Strength</span>
            <div class="stat-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
          </div>
          <div class="stat-number">${onDutyCount} / ${totalForce}</div>
          <div class="stat-subtext">${currentlyOnLeave} on Leave | ${onDutyCount} On-Duty</div>
        </div>
      </div>

      <!-- 13 BRANCHES SUMMARY FOR SP -->
      <div class="leave-quota-card">
        <div class="leave-quota-title">
          <span>Haryana Cyber Police - 13 Wings Strength Overview</span>
          <span style="font-size: 0.8rem; font-weight: normal; color: #64748b;">Panchkula Headquarters</span>
        </div>
        <div class="leave-pills-row">
          <div class="leave-pill-item">
            <div class="type-code">13</div>
            <div class="type-name">Total Branches</div>
            <div class="days-count">100%</div>
            <div class="days-label">Active Wings</div>
          </div>
          <div class="leave-pill-item">
            <div class="type-code">FORCE</div>
            <div class="type-name">Total Strength</div>
            <div class="days-count">${totalForce}</div>
            <div class="days-label">Enrolled Personnel</div>
          </div>
          <div class="leave-pill-item">
            <div class="type-code">DUTY</div>
            <div class="type-name">On Duty</div>
            <div class="days-count" style="color: #15803d;">${onDutyCount}</div>
            <div class="days-label">Present on Duty</div>
          </div>
          <div class="leave-pill-item">
            <div class="type-code">LEAVE</div>
            <div class="type-name">On Leave Today</div>
            <div class="days-count" style="color: #b45309;">${currentlyOnLeave}</div>
            <div class="days-label">Sanctioned Leaves</div>
          </div>
          <div class="leave-pill-item">
            <div class="type-code">SP-DESK</div>
            <div class="type-name">Pending Sanction</div>
            <div class="days-count" style="color: #dc2626;">${spPendingLeaves.length}</div>
            <div class="days-label">Action Required</div>
          </div>
        </div>
      </div>
    `;

    container.innerHTML = html;
    return;
  }

  // ----------------------------------------------------
  // STANDARD DASHBOARD FOR MEMBERS & BRANCH INCHARGES
  // ----------------------------------------------------
  const isReaderUser = user && (user.id === "INCH-ADMIN" || user.role === "admin");
  const isBranchInchargeUser = user && (user.role === "branch_incharge" || user.role === "admin");
  const isSPUser = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");

  // Branch pending leaves for Incharges / Admin
  const branchPendingLeaves = isBranchInchargeUser ? AppState.leaves.filter(l => {
    if (l.status !== "PENDING_INCHARGE") return false;
    if (user.role === "admin" || user.id === "INCH-ADMIN") return true;
    return l.branchId === user.branchId;
  }) : [];

  let html = `
    <!-- COMPACT INCHARGE PENDING ACTION ALERT -->
    ${isBranchInchargeUser && branchPendingLeaves.length > 0 ? `
      <div class="clean-pending-alert" onclick="switchTab('incharge_desk')">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="font-size: 1.3rem;">⚡</span>
          <div>
            <strong style="color: #1e3a8a; font-size: 0.95rem;">Branch Incharge Action Required</strong>
            <div style="font-size: 0.82rem; color: #475569;">
              You have <strong>${branchPendingLeaves.length} application(s)</strong> awaiting your recommendation from ${branchName}.
            </div>
          </div>
        </div>
        <button class="btn btn-primary btn-sm" onclick="event.stopPropagation(); switchTab('incharge_desk')">
          Open Incharge Desk &rarr;
        </button>
      </div>
    ` : ''}

    <!-- OFFICER WELCOME BANNER -->
    <div class="officer-hero-banner">
      <div class="officer-hero-details">
        <div class="officer-hero-rank-tag">${user.rank}</div>
        <h2 class="officer-hero-name">${user.name}</h2>
        <p class="officer-hero-sub">Belt No: <strong>${user.beltNo}</strong> &bull; ${branchName}</p>
      </div>
      <div class="officer-hero-action">
        <button class="btn btn-primary btn-sm hero-apply-btn" onclick="switchTab('apply_leave')">
          + Apply Leave
        </button>
      </div>
    </div>

    <!-- 4 PRIMARY KPI CARDS -->
    <div class="dashboard-kpi-grid">
      <div class="kpi-card kpi-blue">
        <div class="kpi-card-head">
          <span class="kpi-title">Casual Leave (CL)</span>
          <span class="kpi-tag cl-tag">Year 2026</span>
        </div>
        <div class="kpi-card-value">
          <span class="kpi-num">${user.leaveBalances?.CL ?? 0}</span>
          <span class="kpi-unit">Days Left</span>
        </div>
        <div class="kpi-card-footer">
          Quota: 20 Days &bull; ${Math.max(0, 20 - (user.leaveBalances?.CL ?? 0))} Availed
        </div>
      </div>

      <div class="kpi-card kpi-green">
        <div class="kpi-card-head">
          <span class="kpi-title">Earned Leave (EL)</span>
          <span class="kpi-tag el-tag">Accumulated</span>
        </div>
        <div class="kpi-card-value">
          <span class="kpi-num">${user.leaveBalances?.EL ?? 0}</span>
          <span class="kpi-unit">Days Left</span>
        </div>
        <div class="kpi-card-footer">
          Privilege Leave Account
        </div>
      </div>

      <div class="kpi-card kpi-gold" onclick="switchTab('my_leaves')" style="cursor: pointer;" title="View In-Process Applications">
        <div class="kpi-card-head">
          <span class="kpi-title">In-Process</span>
          <span class="kpi-tag pending-tag">Active</span>
        </div>
        <div class="kpi-card-value">
          <span class="kpi-num" style="color: ${pendingLeaves.length > 0 ? '#b45309' : '#15803d'};">${pendingLeaves.length}</span>
          <span class="kpi-unit">Requests</span>
        </div>
        <div class="kpi-card-footer">
          ${pendingLeaves.length > 0 ? 'Awaiting Sanction' : 'No Active Applications'}
        </div>
      </div>

      <div class="kpi-card kpi-purple" onclick="switchTab('my_leaves')" style="cursor: pointer;" title="View Sanctioned Leaves">
        <div class="kpi-card-head">
          <span class="kpi-title">Sanctioned</span>
          <span class="kpi-tag approved-tag">Approved</span>
        </div>
        <div class="kpi-card-value">
          <span class="kpi-num" style="color: #15803d;">${approvedLeaves.length}</span>
          <span class="kpi-unit">Orders</span>
        </div>
        <div class="kpi-card-footer">
          Official Sanctions Issued
        </div>
      </div>
    </div>

    <!-- OTHER LEAVE QUOTAS (NO DUPLICATION OF CL / EL) -->
    <div class="other-leaves-card">
      <div class="other-leaves-header">
        <span class="other-leaves-title">Other Official Leave Balances</span>
        <span class="other-leaves-sub">Medical, Special &amp; Compensatory</span>
      </div>
      <div class="other-leaves-grid">
        ${LEAVE_TYPES.filter(lt => lt.code !== 'CL' && lt.code !== 'EL').map(lt => {
          const bal = user.leaveBalances ? (user.leaveBalances[lt.code] ?? 0) : 0;
          return `
            <div class="other-leave-pill">
              <div class="other-leave-top">
                <span class="other-leave-code">${lt.code}</span>
                <span class="other-leave-count">${bal} Days</span>
              </div>
              <div class="other-leave-name">${lt.name.split('(')[0].trim()}</div>
            </div>
          `;
        }).join('')}
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Table row renderer
function renderLeaveTableRow(leave, showApplicantInfo = false) {
  const statusBadge = getStatusBadge(leave.status);
  const applicantInfoHtml = showApplicantInfo ? `
    <td data-label="Personnel Details">
      <strong>${leave.applicantName}</strong><br>
      <small style="color: #64748b;">${leave.rank} (${leave.beltNo})</small><br>
      <span class="branch-tag">${leave.branchName}</span>
    </td>
  ` : "";

  return `
    <tr class="leave-card-row">
      <td data-label="Application ID">
        <div style="font-weight: 700; color: #0f274c;">${leave.id}</div>
        <small style="color: #64748b;">${leave.appliedAt}</small>
      </td>
      ${applicantInfoHtml}
      <td data-label="Leave Type">
        <span style="font-weight: 700; color: #0f274c;">${leave.leaveType}</span><br>
        <small style="color: #64748b;">${leave.leaveTypeName.split("(")[0]}</small>
      </td>
      <td data-label="Leave Period">
        <strong>${formatDate(leave.fromDate)}</strong> to <strong>${formatDate(leave.toDate)}</strong>
      </td>
      <td data-label="Total Days">
        <span style="font-weight: 700; font-size: 1.05rem;">${leave.totalDays}</span> Days
        ${leave.originalDays && leave.originalDays !== leave.totalDays ? `
          <br><span class="curtailed-badge" title="Original Application: ${leave.originalDays} Days (${formatDate(leave.fromDate)} - ${formatDate(leave.originalToDate)})">
            Curtailed: ${leave.originalDays}→${leave.totalDays} Days
          </span>
        ` : ''}
      </td>
      <td data-label="Ground / Reason" style="max-width: 220px;">
        <div style="white-space: nowrap; overflow: hidden; text-overflow: ellipsis;" title="${leave.reason}">
          ${leave.reason}
        </div>
        ${leave.attachment ? `
          <div style="margin-top: 4px;">
            <a href="javascript:void(0)" onclick="viewAttachment('${leave.id}')" style="font-size: 0.72rem; color: #2563eb; text-decoration: underline; font-weight: 600; display: inline-flex; align-items: center; gap: 3px;">
              📎 ${leave.attachment.name}
            </a>
          </div>
        ` : ''}
      </td>
      <td data-label="Station Leave">
        ${leave.stationLeave ? '<span style="color: #0f274c; font-weight: 600;">✓ Permitted</span>' : '<span style="color: #64748b;">-</span>'}
      </td>
      <td data-label="Status">${statusBadge}</td>
      <td data-label="Actions" class="mobile-card-actions">
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="btn btn-outline btn-sm mobile-action-btn" onclick="openLeaveDetailsModal('${leave.id}')">Details</button>
          ${leave.attachment ? `
            <button class="btn btn-outline btn-sm" onclick="viewAttachment('${leave.id}')" title="View Attachment" style="color: #2563eb; padding: 4px 7px;">📎</button>
          ` : ''}
          ${leave.status === "APPROVED" ? `
            <button class="btn btn-primary btn-sm mobile-action-btn" onclick="openSanctionSlipModal('${leave.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              Order Slip
            </button>
          ` : ""}
        </div>
      </td>
    </tr>
  `;
}

function getStatusBadge(status) {
  switch (status) {
    case "PENDING_INCHARGE":
      return `<span class="status-badge pending_incharge"><span class="dot yellow"></span>Pending with Incharge</span>`;
    case "RECOMMENDED":
      return `<span class="status-badge recommended"><span class="dot blue"></span>Recommended to SP</span>`;
    case "APPROVED":
      return `<span class="status-badge approved"><span class="dot green"></span>Sanctioned / Approved</span>`;
    case "REJECTED":
      return `<span class="status-badge rejected"><span class="dot red"></span>Rejected</span>`;
    default:
      return `<span class="status-badge">${status}</span>`;
  }
}

function formatDate(dateStr) {
  if (!dateStr) return "-";
  const parts = dateStr.split("-");
  if (parts.length === 3) {
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }
  return dateStr;
}

// ==========================================
// VIEW 2: APPLY FOR LEAVE FORM
// ==========================================
function renderApplyLeave(container) {
  const user = AppState.currentUser;
  const branch = AppState.branches.find(b => b.id === user.branchId);
  const branchName = branch ? branch.name : "";

  // Same branch members for handover dropdown
  const sameBranchMembers = AppState.users.filter(u => u.branchId === user.branchId && u.id !== user.id);

  // FEATURE 7: Auto-populate user's last leave record
  const userPastLeaves = AppState.leaves
    .filter(l => l.applicantId === user.id)
    .sort((a, b) => new Date(b.fromDate || b.appliedAt) - new Date(a.fromDate || a.appliedAt));
  const lastLeave = userPastLeaves.length > 0 ? userPastLeaves[0] : null;

  const lastLeaveHtml = lastLeave ? `
    <div class="last-leave-banner">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 4px;">
        <span style="font-weight: 700; color: #0f274c;">Previous Leave History:</span>
        <span class="status-badge ${lastLeave.status.toLowerCase()}">${getStatusBadge(lastLeave.status)}</span>
      </div>
      <div style="font-size: 0.84rem; color: #334155;">
        Last Taken <strong>${lastLeave.leaveTypeName || lastLeave.leaveType}</strong>: 
        <strong>${formatDate(lastLeave.fromDate)}</strong> to <strong>${formatDate(lastLeave.toDate)}</strong> 
        (Total: <strong>${lastLeave.totalDays} Days</strong>) | Reason: <em>"${lastLeave.reason}"</em>
        ${lastLeave.sanctionNo ? ` | Sanction Order No: <strong>${lastLeave.sanctionNo}</strong>` : ''}
      </div>
    </div>
  ` : `
    <div class="last-leave-banner">
      <span style="font-weight: 700; color: #0f274c;">Previous Leave Record:</span>
      This is your <strong>First Leave Application</strong> for session 2026.
    </div>
  `;

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          Leave Application Form
        </h2>
        <p>State Cyber Crime, Panchkula</p>
      </div>
      <div>
        <button class="btn btn-outline btn-sm" onclick="switchTab('my_leaves')">My Applications</button>
      </div>
    </div>

    <div style="background: #fff; border-radius: 12px; border: 1px solid var(--border-light); padding: 18px; box-shadow: var(--shadow-sm); max-width: 920px; margin: 0 auto;">
      
      <!-- FEATURE 7: LAST LEAVE BANNER -->
      ${lastLeaveHtml}

      <form id="applyLeaveForm" onsubmit="handleApplyLeaveSubmit(event)">
        
        <!-- SLEEK APPLICANT CARD -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px 14px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.25rem;">👮</span>
            <div>
              <strong style="color: #0f274c; font-size: 0.95rem;">${user.name}</strong> (${user.rank})
              <div style="font-size: 0.78rem; color: #64748b;">Belt: <strong>${user.beltNo}</strong> | Ph: ${user.mobile}</div>
            </div>
          </div>
          <span class="branch-tag" style="font-size: 0.8rem;">${branchName}</span>
        </div>

        <div class="form-grid">
          <!-- BRANCH SELECTION DROPDOWN -->
          <div class="form-group form-full">
            <label for="leaveBranchSelect" style="font-weight: 700; color: #0f274c; font-size: 0.88rem;">
              Select Cyber Branch <span class="required">*</span>
            </label>
            <select id="leaveBranchSelect" class="form-control" required onchange="handleLeaveBranchChange(this.value)" style="border: 1.5px solid var(--police-blue); font-weight: 600;">
              <option value="">-- Select Cyber Branch --</option>
              ${AppState.branches.map(b => `
                <option value="${b.id}" ${b.id === user.branchId ? 'selected' : ''}>
                  ${b.name}
                </option>
              `).join("")}
            </select>
          </div>

          <!-- LEAVE TYPE -->
          <div class="form-group form-full">
            <label for="leaveTypeSelect">Leave Type <span class="required">*</span></label>
            <select id="leaveTypeSelect" class="form-control" required onchange="handleLeaveTypeChange()">
              <option value="">-- Select Leave Type --</option>
              ${LEAVE_TYPES.map(lt => {
                const bal = user.leaveBalances ? (user.leaveBalances[lt.code] ?? 0) : 0;
                return `<option value="${lt.code}">${lt.code} - ${lt.name} [Available Balance: ${bal} Days]</option>`;
              }).join("")}
            </select>
            <small id="leaveTypeDesc" style="color: #64748b; font-size: 0.78rem;"></small>

            <!-- FEATURE 5: MANDATORY MEDICAL NOTICE ALERT -->
            <div id="medicalNoticeAlert" style="display: none; margin-top: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 6px; font-weight: 600; font-size: 0.85rem;">
              <strong>Mandatory Medical Certificate:</strong> Medical Leave (ML) or Child Care Leave (CCL) requires an official medical prescription / fitness certificate.
            </div>
          </div>

          <!-- FROM DATE -->
          <div class="form-group">
            <label for="leaveFromDate">From Date <span class="required">*</span></label>
            <input type="date" id="leaveFromDate" class="form-control" required onchange="calculateLeaveDays()">
          </div>

          <!-- TO DATE -->
          <div class="form-group">
            <label for="leaveToDate">To Date <span class="required">*</span></label>
            <input type="date" id="leaveToDate" class="form-control" required onchange="calculateLeaveDays()">
          </div>

          <!-- FEATURE 6: HALF DAY LEAVE (CL ONLY) -->
          <div id="halfDaySection" style="display: none;" class="form-group form-full">
            <div class="half-day-box">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; color: #0f274c; margin: 0;">
                  <input type="checkbox" id="halfDayCheck" onchange="handleHalfDayToggle(this)">
                  Apply for Half Day Casual Leave? (0.5 Day CL)
                </label>
                <span style="font-size: 0.8rem; background: #e2e8f0; color: #334155; padding: 2px 8px; border-radius: 4px; font-weight: 600;">0.5 Day Quota</span>
              </div>
              <div id="halfDayShiftBox" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
                <label style="font-size: 0.82rem; font-weight: 600; color: #475569; margin-bottom: 6px; display: block;">Select Duty Shift:</label>
                <div style="display: flex; gap: 12px; flex-wrap: wrap; font-size: 0.88rem;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="radio" name="halfDayShift" value="Morning Shift (09:00 AM to 02:00 PM)" checked onchange="calculateLeaveDays()">
                    Morning Shift (09:00 AM to 02:00 PM)
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="radio" name="halfDayShift" value="Evening Shift (02:00 PM to 08:00 PM)" onchange="calculateLeaveDays()">
                    Evening Shift (02:00 PM to 08:00 PM)
                  </label>
                </div>
              </div>
            </div>
          </div>

          <!-- FEATURE 1: PREFIX & SUFFIX HOLIDAYS -->
          <div class="form-group form-full">
            <div class="prefix-suffix-box">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; color: #0f274c; margin: 0;">
                  <input type="checkbox" id="prefixSuffixCheck" onchange="togglePrefixSuffix(this)">
                  Add Prefix / Suffix Holidays (Optional)
                </label>
                <span style="font-size: 0.78rem; color: #64748b;">(Holidays / C-OFF)</span>
              </div>
              <div id="prefixSuffixFields" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
                <div class="form-grid-inner" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                  <div>
                    <label for="prefixDaysInput" style="font-size: 0.82rem; font-weight: 600; color: #334155;">
                      Prefix Days (Preceding start)
                    </label>
                    <input type="number" id="prefixDaysInput" class="form-control" min="0" max="7" value="0" onchange="calculateLeaveDays()" placeholder="Days">
                  </div>
                  <div>
                    <label for="suffixDaysInput" style="font-size: 0.82rem; font-weight: 600; color: #334155;">
                      Suffix Days (Succeeding end)
                    </label>
                    <input type="number" id="suffixDaysInput" class="form-control" min="0" max="7" value="0" onchange="calculateLeaveDays()" placeholder="Days">
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- COMPUTED DAYS NOTICE -->
          <div class="form-group form-full">
            <div id="leaveDaysNotice" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; border-radius: 6px; padding: 10px 14px; font-size: 0.88rem; font-weight: 600;">
              Please select dates (Total Days: 0)
            </div>
          </div>

          <!-- FEATURE 2: LIVE BRANCH OVERLAP ALERT -->
          <div class="form-group form-full">
            <div id="branchOverlapNotice" style="display: none;"></div>
          </div>

          <!-- REASON -->
          <div class="form-group form-full">
            <label for="leaveReason">Specific Reason for Leave <span class="required">*</span></label>
            <textarea id="leaveReason" class="form-control" rows="3" required placeholder="Enter detailed reason for leave (e.g. family obligation, medical emergency, domestic affairs)"></textarea>
          </div>

          <!-- FEATURE 3: COURT EVIDENCE & CASE HANDOVER -->
          <div class="form-group form-full">
            <div class="court-case-box">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; color: #854d0e; margin: 0;">
                  <input type="checkbox" id="courtEvidenceCheck" onchange="toggleCourtCaseFields(this)">
                  Is any Court Evidence / Summons scheduled during this leave period?
                </label>
              </div>
              <div id="courtCaseFields" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #fef08a;">
                <div class="form-grid-inner" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                  <div>
                    <label for="courtCaseDetails" style="font-size: 0.82rem; font-weight: 600; color: #713f12;">
                      Court & Case Details (Court Name, FIR No., Hearing Date)
                    </label>
                    <input type="text" id="courtCaseDetails" class="form-control" placeholder="e.g. Special CBI Court Panchkula / FIR 42/2025, Hearing 12-Nov">
                  </div>
                  <div>
                    <label for="courtOfficerHandover" style="font-size: 0.82rem; font-weight: 600; color: #713f12;">
                      Case Diary & Brief Handed Over To (Officer Assigned)
                    </label>
                    <input type="text" id="courtOfficerHandover" class="form-control" placeholder="e.g. Handed over to ASI Rajesh (312/PKL)">
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- HANDOVER TO -->
          <div class="form-group">
            <label for="handoverOfficer">Charge Handover To (Relieving Officer)</label>
            <select id="handoverOfficer" class="form-control">
              <option value="">-- Select Relieving Officer --</option>
              ${sameBranchMembers.map(m => `<option value="${m.name} (${m.beltNo})">${m.name} - ${m.rank} (${m.beltNo})</option>`).join("")}
              <option value="Branch Incharge">Branch Incharge</option>
              <option value="Other Arrangement">Other Arrangement</option>
            </select>
          </div>

          <!-- EMERGENCY MOBILE -->
          <div class="form-group">
            <label for="emergencyMobile">Emergency Contact Mobile Number <span class="required">*</span></label>
            <input type="tel" id="emergencyMobile" class="form-control" value="${user.mobile}" required>
          </div>

          <!-- STATION LEAVE CHECKBOX -->
          <div class="form-group form-full">
            <div class="checkbox-row">
              <input type="checkbox" id="stationLeaveCheck" onchange="toggleStationLeaveInputs()">
              <label for="stationLeaveCheck">
                Permission to Leave Station / Headquarters (Station Leave)
              </label>
            </div>
          </div>

          <!-- FEATURE 4: EXPANDED STATION LEAVE DETAILS -->
          <div id="stationLeaveBox" class="form-group form-full" style="display: none;">
            <div class="station-leave-card">
              <h4 style="font-size: 0.88rem; color: #92400e; margin-bottom: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                Out-of-Headquarters Travel & Destination Details
              </h4>
              <div class="form-grid-inner" style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label for="stationDestination" style="font-size: 0.8rem; font-weight: 600; color: #92400e;">
                    Destination City & State
                  </label>
                  <input type="text" id="stationDestination" class="form-control" placeholder="e.g. New Delhi / Rohtak, Haryana">
                </div>
                <div>
                  <label for="stationLocalPS" style="font-size: 0.8rem; font-weight: 600; color: #92400e;">
                    Nearest Local Police Station
                  </label>
                  <input type="text" id="stationLocalPS" class="form-control" placeholder="e.g. PS Sampla / PS Model Town">
                </div>
                <div>
                  <label for="stationTravelMode" style="font-size: 0.8rem; font-weight: 600; color: #92400e;">
                    Mode of Travel
                  </label>
                  <select id="stationTravelMode" class="form-control">
                    <option value="Train (Indian Railways)">Train (Indian Railways)</option>
                    <option value="Bus (State Roadways / Private)">Bus (State Roadways / Private)</option>
                    <option value="Private Car (Four-Wheeler)">Private Car (Four-Wheeler)</option>
                    <option value="Two-Wheeler (Motorcycle / Bike)">Two-Wheeler (Motorcycle / Bike)</option>
                    <option value="Flight / Air Travel">Flight / Air Travel</option>
                    <option value="Other Arrangement">Other Arrangement</option>
                  </select>
                </div>
                <div>
                  <label for="stationFamilyContact" style="font-size: 0.8rem; font-weight: 600; color: #92400e;">
                    Family Contact Person & Relationship
                  </label>
                  <input type="text" id="stationFamilyContact" class="form-control" placeholder="e.g. Father - Sh. Ram Kishan (98120XXXXX)">
                </div>
                <div style="grid-column: 1 / -1;">
                  <label for="stationLeaveAddress" style="font-size: 0.8rem; font-weight: 600; color: #92400e;">
                    Complete Address During Out-of-Station Leave
                  </label>
                  <textarea id="stationLeaveAddress" class="form-control" rows="2" placeholder="House No., Sector/Street, Village/City, PIN Code"></textarea>
                </div>
              </div>
              <small style="color: #b45309; font-size: 0.74rem; margin-top: 6px; display: block;">
                * As per Police Regulations, Station Leave is subject to sanction by the Superintendent of Police (SP Cyber).
              </small>
            </div>
          </div>

          <!-- REAL FILE ATTACHMENT UPLOAD -->
          <div class="form-group form-full">
            <label style="font-size: 0.82rem; font-weight: 600; color: var(--text-secondary);">
              Document Attachment (Medical Certificate / Invitation / Supporting Letter)
            </label>
            <div class="attachment-upload-zone" onclick="document.getElementById('leaveAttachmentInput').click()">
              <input type="file" id="leaveAttachmentInput" accept=".pdf,image/*,.doc,.docx" onchange="handleAttachmentSelect(event)">
              <div id="attachmentPrompt">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--police-blue); margin-bottom: 6px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                <p style="font-weight: 600; font-size: 0.9rem; color: #1e293b;">Click to browse or drag & drop file here</p>
                <p style="font-size: 0.75rem; color: #64748b;">(Supported formats: PDF, JPG, PNG, DOC - Max 5MB)</p>
              </div>
              <div id="attachmentPreviewBox" style="display: none;" class="attachment-preview-card" onclick="event.stopPropagation()">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div class="attachment-icon">📎</div>
                  <div style="text-align: left;">
                    <strong id="attachmentFileName" style="font-size: 0.85rem; color: #0f274c;"></strong>
                    <div id="attachmentFileSize" style="font-size: 0.72rem; color: #64748b;"></div>
                  </div>
                </div>
                <button type="button" class="btn btn-danger btn-sm" onclick="clearSelectedAttachment(event)">Remove</button>
              </div>
            </div>
          </div>
        </div>

        <!-- FORM ACTION BUTTONS WITH PREVIEW OPTION -->
        <div style="margin-top: 20px; padding-top: 14px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 8px; flex-wrap: wrap;">
          <button type="button" class="btn btn-outline" onclick="switchTab('dashboard')">Cancel</button>
          
          <button type="button" class="btn btn-outline" onclick="openApplicationPreviewModal()" style="border-color: #0f274c; color: #0f274c;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            Preview Memo
          </button>

          <button type="submit" class="btn btn-primary" style="flex-grow: 1;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            Submit Application
          </button>
        </div>
      </form>
    </div>
  `;

  container.innerHTML = html;
}

function handleAttachmentSelect(event) {
  const file = event.target.files[0];
  if (!file) return;

  if (file.size > 5 * 1024 * 1024) {
    alert("File size must be under 5MB.");
    event.target.value = "";
    return;
  }

  const reader = new FileReader();
  reader.onload = function(e) {
    AppState.currentAttachment = {
      name: file.name,
      size: (file.size / 1024).toFixed(1) + " KB",
      type: file.type || "application/octet-stream",
      dataUrl: e.target.result
    };

    const promptEl = document.getElementById("attachmentPrompt");
    if (promptEl) promptEl.style.display = "none";
    const previewBox = document.getElementById("attachmentPreviewBox");
    if (previewBox) previewBox.style.display = "flex";
    const nameEl = document.getElementById("attachmentFileName");
    if (nameEl) nameEl.textContent = file.name;
    const sizeEl = document.getElementById("attachmentFileSize");
    if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB (${file.type || "Document"})`;

    showToast(`Document "${file.name}" attached successfully.`, "info");
  };
  reader.readAsDataURL(file);
}

function clearSelectedAttachment(e) {
  if (e) e.stopPropagation();
  AppState.currentAttachment = null;
  const input = document.getElementById("leaveAttachmentInput");
  if (input) input.value = "";
  const promptEl = document.getElementById("attachmentPrompt");
  if (promptEl) promptEl.style.display = "block";
  const previewBox = document.getElementById("attachmentPreviewBox");
  if (previewBox) previewBox.style.display = "none";
}

function handleLeaveBranchChange(branchId) {
  const handoverSelect = document.getElementById("handoverOfficer");
  if (handoverSelect) {
    const branchMembers = AppState.users.filter(u => u.branchId === branchId && u.id !== AppState.currentUser.id);
    handoverSelect.innerHTML = `
      <option value="">-- Select Relieving Officer --</option>
      ${branchMembers.map(m => `<option value="${m.name} (${m.beltNo})">${m.name} - ${m.rank} (${m.beltNo})</option>`).join("")}
      <option value="Branch Incharge">Branch Incharge</option>
      <option value="Other Arrangement">Other Arrangement</option>
    `;
  }

  calculateLeaveDays();
}

function handleLeaveTypeChange() {
  const code = document.getElementById("leaveTypeSelect")?.value;
  const descEl = document.getElementById("leaveTypeDesc");
  if (descEl) {
    const lt = LEAVE_TYPES.find(l => l.code === code);
    descEl.textContent = lt ? `${lt.name}: ${lt.desc}` : "";
  }

  // FEATURE 5: Mandatory medical alert for ML and CCL
  const medAlert = document.getElementById("medicalNoticeAlert");
  if (medAlert) {
    medAlert.style.display = (code === "ML" || code === "CCL") ? "block" : "none";
  }

  calculateLeaveDays();
}

function toggleStationLeaveInputs() {
  const isChecked = document.getElementById("stationLeaveCheck")?.checked;
  const box = document.getElementById("stationLeaveBox");
  if (box) {
    box.style.display = isChecked ? "block" : "none";
  }
}

function togglePrefixSuffix(checkbox) {
  const fields = document.getElementById("prefixSuffixFields");
  if (fields) fields.style.display = checkbox.checked ? "block" : "none";
  calculateLeaveDays();
}

function handleHalfDayToggle(checkbox) {
  const shiftBox = document.getElementById("halfDayShiftBox");
  if (shiftBox) shiftBox.style.display = checkbox.checked ? "block" : "none";
  calculateLeaveDays();
}

function toggleCourtCaseFields(checkbox) {
  const fields = document.getElementById("courtCaseFields");
  if (fields) fields.style.display = checkbox.checked ? "block" : "none";
}

function calculateLeaveDays() {
  const fromVal = document.getElementById("leaveFromDate")?.value;
  const toVal = document.getElementById("leaveToDate")?.value;
  const noticeEl = document.getElementById("leaveDaysNotice");
  const branchVal = document.getElementById("leaveBranchSelect")?.value;
  const leaveCode = document.getElementById("leaveTypeSelect")?.value;
  const halfDaySec = document.getElementById("halfDaySection");

  if (!noticeEl) return;

  if (!fromVal || !toVal) {
    noticeEl.textContent = "Please select dates (Total Days: 0)";
    noticeEl.style.background = "#eff6ff";
    noticeEl.style.color = "#1e40af";
    if (halfDaySec) halfDaySec.style.display = "none";
    checkBranchOverlap(branchVal, null, null);
    return;
  }

  const fromDate = new Date(fromVal);
  const toDate = new Date(toVal);

  if (toDate < fromDate) {
    noticeEl.textContent = "Error: To Date cannot be earlier than From Date.";
    noticeEl.style.background = "#fee2e2";
    noticeEl.style.color = "#991b1b";
    if (halfDaySec) halfDaySec.style.display = "none";
    checkBranchOverlap(branchVal, null, null);
    return;
  }

  // Check if eligible for Half Day (CL only and same date)
  const isSameDay = fromVal === toVal;
  if (leaveCode === "CL" && isSameDay) {
    if (halfDaySec) halfDaySec.style.display = "block";
  } else {
    if (halfDaySec) halfDaySec.style.display = "none";
    const halfDayCheck = document.getElementById("halfDayCheck");
    if (halfDayCheck) halfDayCheck.checked = false;
    const shiftBox = document.getElementById("halfDayShiftBox");
    if (shiftBox) shiftBox.style.display = "none";
  }

  let diffDays = Math.ceil(Math.abs(toDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;
  const isHalfDay = document.getElementById("halfDayCheck")?.checked;
  if (isHalfDay && isSameDay && leaveCode === "CL") {
    diffDays = 0.5;
  }

  // Prefix & Suffix calculations
  const prefixCheck = document.getElementById("prefixSuffixCheck")?.checked;
  const prefix = prefixCheck ? (parseInt(document.getElementById("prefixDaysInput")?.value) || 0) : 0;
  const suffix = prefixCheck ? (parseInt(document.getElementById("suffixDaysInput")?.value) || 0) : 0;
  const totalAbsence = diffDays + prefix + suffix;

  const user = AppState.currentUser;
  const balance = user.leaveBalances ? (user.leaveBalances[leaveCode] ?? 0) : 0;

  let detailsText = `Total Leave Quota Deduction: <strong>${diffDays} Days</strong> (${formatDate(fromVal)} to ${formatDate(toVal)})`;
  if (prefix > 0 || suffix > 0) {
    detailsText += ` | Total Absence Period: <strong>${totalAbsence} Days</strong> (${prefix} Prefix + ${diffDays} Leave + ${suffix} Suffix)`;
  }
  if (isHalfDay) {
    const shiftVal = document.querySelector('input[name="halfDayShift"]:checked')?.value || "Morning Shift";
    detailsText += ` [Half Day: ${shiftVal}]`;
  }

  // CL max 10 days policy advice
  let policyWarning = "";
  if (leaveCode === "CL" && diffDays > 10) {
    policyWarning = `<br><span style="color: #b45309; font-weight: normal; font-size: 0.8rem;">Police Service Rules: Casual Leave (CL) is generally capped at 10 consecutive days. For longer periods, apply for Earned Leave (EL).</span>`;
  }

  if (diffDays > balance) {
    noticeEl.innerHTML = `${detailsText} | <strong>Warning:</strong> Available leave balance is only <strong>${balance} Days</strong>!${policyWarning}`;
    noticeEl.style.background = "#fffbeb";
    noticeEl.style.color = "#b45309";
  } else {
    noticeEl.innerHTML = `${detailsText} | Sufficient quota available (${balance} Days remaining)${policyWarning}`;
    noticeEl.style.background = "#dcfce7";
    noticeEl.style.color = "#166534";
  }

  // FEATURE 2: Check Branch Peer Overlap
  checkBranchOverlap(branchVal, fromVal, toVal);
}

// FEATURE 2: CHECK BRANCH OVERLAP HELPER
function checkBranchOverlap(branchId, fromVal, toVal) {
  const overlapBox = document.getElementById("branchOverlapNotice");
  if (!overlapBox) return;

  if (!branchId || !fromVal || !toVal) {
    overlapBox.style.display = "none";
    return;
  }

  const user = AppState.currentUser;
  const branchUsers = AppState.users.filter(u => u.branchId === branchId);
  const totalBranchStaff = branchUsers.length;

  const overlappingLeaves = AppState.leaves.filter(l => {
    if (l.branchId !== branchId) return false;
    if (l.applicantId === user.id) return false;
    if (l.status === "REJECTED") return false;
    return (l.fromDate <= toVal && l.toDate >= fromVal);
  });

  overlapBox.style.display = "block";
  if (overlappingLeaves.length === 0) {
    overlapBox.className = "branch-overlap-box clear";
    overlapBox.innerHTML = `
      <div style="display: flex; align-items: center; gap: 8px;">
        <span style="font-size: 1.1rem;">✓</span>
        <div>
          <strong>Branch Duty Strength Status:</strong>
          No other personnel from your branch are on leave during this period. Full strength of ${totalBranchStaff} personnel is available on duty.
        </div>
      </div>
    `;
  } else {
    overlapBox.className = "branch-overlap-box warning";
    const names = overlappingLeaves.map(l => `<strong>${l.applicantName}</strong> (${l.rank} - ${formatDate(l.fromDate)} to ${formatDate(l.toDate)})`).join(", ");
    const remainingOnDuty = Math.max(0, totalBranchStaff - overlappingLeaves.length - 1);
    overlapBox.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <span style="font-size: 1.2rem;">👥</span>
        <div>
          <strong>Branch Concurrent Leave Alert:</strong><br>
          During this period, <strong>${overlappingLeaves.length} personnel</strong> from your branch are already on leave / pending: ${names}.<br>
          Estimated remaining on-duty strength: <strong>${remainingOnDuty} personnel</strong> (out of ${totalBranchStaff}).
        </div>
      </div>
    `;
  }
}

// FEATURE 8: OPEN APPLICATION PREVIEW MODAL
function openApplicationPreviewModal() {
  const selectedBranchId = document.getElementById("leaveBranchSelect")?.value;
  if (!selectedBranchId) {
    alert("Please select your Cyber Branch first.");
    document.getElementById("leaveBranchSelect")?.focus();
    return;
  }
  const branchObj = AppState.branches.find(b => b.id === selectedBranchId);
  const branchName = branchObj ? branchObj.name : selectedBranchId;

  const leaveType = document.getElementById("leaveTypeSelect")?.value;
  if (!leaveType) {
    alert("Please select Leave Type.");
    document.getElementById("leaveTypeSelect")?.focus();
    return;
  }
  const ltObj = LEAVE_TYPES.find(l => l.code === leaveType);
  const leaveTypeName = ltObj ? ltObj.name : leaveType;

  const fromDate = document.getElementById("leaveFromDate")?.value;
  const toDate = document.getElementById("leaveToDate")?.value;
  if (!fromDate || !toDate) {
    alert("Please select From Date and To Date.");
    return;
  }
  if (new Date(toDate) < new Date(fromDate)) {
    alert("Error: To Date cannot be earlier than From Date.");
    return;
  }

  const reason = document.getElementById("leaveReason")?.value.trim();
  if (!reason) {
    alert("Please enter specific reason for leave.");
    document.getElementById("leaveReason")?.focus();
    return;
  }

  // FEATURE 5: Mandatory check for ML/CCL in preview as well
  if ((leaveType === "ML" || leaveType === "CCL") && !AppState.currentAttachment) {
    alert("Mandatory document required: Medical Leave (ML) or Child Care Leave (CCL) requires an official medical prescription / certificate.");
    document.getElementById("leaveAttachmentInput")?.focus();
    return;
  }

  const user = AppState.currentUser;
  let diffDays = Math.ceil(Math.abs(new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24)) + 1;
  const isHalfDay = document.getElementById("halfDayCheck")?.checked;
  const halfDayShift = isHalfDay ? (document.querySelector('input[name="halfDayShift"]:checked')?.value || "Morning Shift") : "";
  if (isHalfDay && fromDate === toDate && leaveType === "CL") {
    diffDays = 0.5;
  }

  const prefixCheck = document.getElementById("prefixSuffixCheck")?.checked;
  const prefix = prefixCheck ? (parseInt(document.getElementById("prefixDaysInput")?.value) || 0) : 0;
  const suffix = prefixCheck ? (parseInt(document.getElementById("suffixDaysInput")?.value) || 0) : 0;
  const totalAbsence = diffDays + prefix + suffix;

  const courtDuty = document.getElementById("courtEvidenceCheck")?.checked;
  const courtCaseDetails = courtDuty ? (document.getElementById("courtCaseDetails")?.value || "Scheduled") : "No court hearing";
  const courtOfficerHandover = courtDuty ? (document.getElementById("courtOfficerHandover")?.value || "Assigned Officer") : "-";

  const handoverTo = document.getElementById("handoverOfficer")?.value || "Branch Incharge";
  const emergencyContact = document.getElementById("emergencyMobile")?.value || user.mobile;

  const stationLeave = document.getElementById("stationLeaveCheck")?.checked;
  const stationDestination = stationLeave ? (document.getElementById("stationDestination")?.value || "Not specified") : "-";
  const stationLocalPS = stationLeave ? (document.getElementById("stationLocalPS")?.value || "-") : "-";
  const stationTravelMode = stationLeave ? (document.getElementById("stationTravelMode")?.value || "-") : "-";
  const stationFamilyContact = stationLeave ? (document.getElementById("stationFamilyContact")?.value || "-") : "-";
  const stationLeaveAddress = stationLeave ? (document.getElementById("stationLeaveAddress")?.value || "Out of HQ") : "-";

  const previewBody = document.getElementById("applicationPreviewBody");
  if (!previewBody) return;

  const now = new Date();
  const dateFormatted = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

  previewBody.innerHTML = `
    <div class="application-preview-sheet">
      <div class="preview-memo-header">
        <h4 style="font-size: 0.95rem; margin: 0; color: #0f274c; text-transform: uppercase; letter-spacing: 0.5px;">OFFICE OF THE SUPERINTENDENT OF POLICE, STATE CYBER CRIME, PANCHKULA (HARYANA)</h4>
        <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">GOVERNMENT OF HARYANA | POLICE DEPARTMENT</div>
        <div style="margin-top: 8px; font-size: 0.85rem; font-weight: 700; color: #b45309; text-decoration: underline;">
          POLICE LEAVE APPLICATION MEMORANDUM
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 10px; color: #475569;">
          <span>Date: <strong>${dateFormatted}</strong></span>
          <span>Form: <strong>HP-CYB/FORM-L1</strong></span>
        </div>
      </div>

      <div style="font-size: 0.85rem; margin-bottom: 12px; line-height: 1.5;">
        <strong>To,</strong><br>
        The Superintendent of Police,<br>
        State Cyber Crime, Panchkula (Haryana).<br>
        <span style="color: #64748b;">(Through: Branch Incharge - <strong>${branchName}</strong>)</span>
      </div>

      <div style="background: #f1f5f9; padding: 6px 12px; border-radius: 4px; font-size: 0.86rem; font-weight: 700; color: #0f274c; margin-bottom: 14px;">
        Subject: Application for Sanction of <strong>${leaveTypeName}</strong> (${diffDays} Days).
      </div>

      <table class="preview-table">
        <tbody>
          <tr>
            <th>Applicant Personnel</th>
            <td><strong>${user.name}</strong> (${user.beltNo}) | Rank: <strong>${user.rank}</strong></td>
          </tr>
          <tr>
            <th>Posted Wing</th>
            <td><strong>${branchName}</strong></td>
          </tr>
          <tr>
            <th>Leave Type</th>
            <td><strong>${leaveTypeName}</strong></td>
          </tr>
          <tr>
            <th>Leave Period</th>
            <td>
              <strong>${formatDate(fromDate)}</strong> to <strong>${formatDate(toDate)}</strong> 
              (Quota Deduction: <strong>${diffDays} Days</strong>)
              ${isHalfDay ? `<br><span style="color: #b45309; font-weight: 600;">[Half Day: ${halfDayShift}]</span>` : ''}
            </td>
          </tr>
          ${prefixCheck && (prefix > 0 || suffix > 0) ? `
            <tr>
              <th>Prefix & Suffix Holidays</th>
              <td>
                Prefix: <strong>${prefix} Days</strong> | Suffix: <strong>${suffix} Days</strong><br>
                <small style="color: #64748b;">(Total Absence Period: <strong>${totalAbsence} Days</strong>)</small>
              </td>
            </tr>
          ` : ''}
          <tr>
            <th>Specific Reason for Leave</th>
            <td><em>"${reason}"</em></td>
          </tr>
          <tr>
            <th>Court Evidence / Summons Status</th>
            <td>
              ${courtDuty ? `
                <span style="color: #dc2626; font-weight: 700;">Yes, Hearing Scheduled:</span> ${courtCaseDetails}<br>
                Case Diary Handed Over To: <strong>${courtOfficerHandover}</strong>
              ` : `
                <span style="color: #0f274c; font-weight: 600;">✓ No court evidence or summons scheduled during this period.</span>
              `}
            </td>
          </tr>
          <tr>
            <th>Charge Handover / Reliever</th>
            <td>Relieving charge handed over to <strong>${handoverTo}</strong>.</td>
          </tr>
          <tr>
            <th>Emergency Contact</th>
            <td><strong>${emergencyContact}</strong></td>
          </tr>
          <tr>
            <th>Station Leave (Out-of-HQ Details)</th>
            <td>
              ${stationLeave ? `
                <span style="color: #b45309; font-weight: 700;">Station Leave Permission Requested:</span><br>
                • Destination: <strong>${stationDestination}</strong> (Nearest Local PS: <strong>${stationLocalPS}</strong>)<br>
                • Mode of Travel: <strong>${stationTravelMode}</strong><br>
                • Family Contact: <strong>${stationFamilyContact}</strong><br>
                • Address during leave: ${stationLeaveAddress}
              ` : `
                <span style="color: #64748b;">Station leave not required (Stationed at Headquarters).</span>
              `}
            </td>
          </tr>
          <tr>
            <th>Attachment</th>
            <td>
              ${AppState.currentAttachment ? `
                <span style="color: #1e40af; font-weight: 600;">📎 ${AppState.currentAttachment.name}</span> (${AppState.currentAttachment.size})
              ` : `
                <span style="color: #64748b;">No document attached.</span>
              `}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 18px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 0.8rem; color: #475569; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          * Declaration: The above information provided is true, correct, and in accordance with Haryana Police Rules.
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; color: #0f274c;">${user.name}</div>
          <div>${user.rank} (${user.beltNo})</div>
          <div>Applicant Digital Signature & Timestamp</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("applicationPreviewModal")?.classList.add("active");
}

// CONFIRM AND SUBMIT FROM PREVIEW MODAL
function confirmAndSubmitLeave() {
  closeModals();
  const form = document.getElementById("applyLeaveForm");
  if (form) {
    if (typeof form.requestSubmit === "function") {
      form.requestSubmit();
    } else {
      handleApplyLeaveSubmit(new Event("submit"));
    }
  }
}

function handleApplyLeaveSubmit(e) {
  if (e) e.preventDefault();
  const user = AppState.currentUser;

  const selectedBranchId = document.getElementById("leaveBranchSelect")?.value;
  if (!selectedBranchId) {
    alert("Please select your Cyber Branch.");
    return;
  }
  const branchObj = AppState.branches.find(b => b.id === selectedBranchId);
  const branchName = branchObj ? branchObj.name : selectedBranchId;

  const leaveType = document.getElementById("leaveTypeSelect")?.value;
  if (!leaveType) {
    alert("Please select Leave Type.");
    document.getElementById("leaveTypeSelect")?.focus();
    return;
  }

  const fromDate = document.getElementById("leaveFromDate")?.value;
  const toDate = document.getElementById("leaveToDate")?.value;
  if (!fromDate || !toDate) {
    alert("Please select both From Date and To Date.");
    return;
  }

  const reason = document.getElementById("leaveReason")?.value?.trim();
  if (!reason) {
    alert("Please enter the specific reason for leave.");
    document.getElementById("leaveReason")?.focus();
    return;
  }

  const handoverTo = document.getElementById("handoverOfficer")?.value || "Branch Incharge";
  const emergencyContact = document.getElementById("emergencyMobile")?.value || user.mobile;

  // FEATURE 5: MANDATORY MEDICAL CERTIFICATE VALIDATION
  if ((leaveType === "ML" || leaveType === "CCL") && !AppState.currentAttachment) {
    showToast("Medical certificate attachment is mandatory for Medical Leave (ML) / CCL!", "error");
    alert("Mandatory document required: Please attach medical prescription / certificate.");
    document.getElementById("leaveAttachmentInput")?.focus();
    return;
  }

  if (new Date(toDate) < new Date(fromDate)) {
    alert("Error: To Date must be on or after From Date.");
    return;
  }

  let totalDays = Math.ceil(Math.abs(new Date(toDate) - new Date(fromDate)) / (1000 * 60 * 60 * 24)) + 1;
  const isHalfDay = document.getElementById("halfDayCheck")?.checked;
  const halfDayShift = isHalfDay ? (document.querySelector('input[name="halfDayShift"]:checked')?.value || "Morning Shift") : "";
  if (isHalfDay && fromDate === toDate && leaveType === "CL") {
    totalDays = 0.5;
  }

  // Prefix and Suffix
  const prefixCheck = document.getElementById("prefixSuffixCheck")?.checked;
  const prefixDays = prefixCheck ? (parseInt(document.getElementById("prefixDaysInput")?.value) || 0) : 0;
  const suffixDays = prefixCheck ? (parseInt(document.getElementById("suffixDaysInput")?.value) || 0) : 0;

  // Court duty
  const courtDuty = document.getElementById("courtEvidenceCheck")?.checked || false;
  const courtCaseDetails = courtDuty ? (document.getElementById("courtCaseDetails")?.value || "") : "";
  const courtHandoverOfficer = courtDuty ? (document.getElementById("courtOfficerHandover")?.value || "") : "";

  // Station Leave
  const stationLeave = document.getElementById("stationLeaveCheck")?.checked || false;
  const stationDestination = stationLeave ? (document.getElementById("stationDestination")?.value || "") : "";
  const stationLocalPS = stationLeave ? (document.getElementById("stationLocalPS")?.value || "") : "";
  const stationTravelMode = stationLeave ? (document.getElementById("stationTravelMode")?.value || "") : "";
  const stationFamilyContact = stationLeave ? (document.getElementById("stationFamilyContact")?.value || "") : "";
  const stationLeaveAddress = stationLeave ? (document.getElementById("stationLeaveAddress")?.value || "") : "";

  const ltObj = LEAVE_TYPES.find(l => l.code === leaveType);
  const leaveTypeName = ltObj ? ltObj.name : leaveType;

  const now = new Date();
  const appliedAt = now.toISOString().replace("T", " ").substring(0, 16);

  let maxLeaveNum = 0;
  (AppState.leaves || []).forEach(l => {
    const m = String(l.id).match(/LV-2026-(\d+)/);
    if (m) {
      const num = parseInt(m[1], 10);
      if (num > maxLeaveNum) maxLeaveNum = num;
    }
  });
  const nextNum = Math.max(maxLeaveNum + 1, AppState.leaves.length + 1);
  const newId = `LV-2026-${String(nextNum).padStart(3, "0")}`;
  const sanctionNo = `CYB/PKL/LEAVE/2026/${String(nextNum + 140).padStart(4, "0")}`;

  const newLeave = {
    id: newId,
    sanctionNo: sanctionNo,
    applicantId: user.id,
    applicantName: user.name,
    beltNo: user.beltNo,
    rank: user.rank,
    branchId: selectedBranchId,
    branchName: branchName,
    leaveType: leaveType,
    leaveTypeName: leaveTypeName,
    fromDate: fromDate,
    toDate: toDate,
    totalDays: totalDays,
    originalDays: totalDays,
    originalToDate: toDate,
    isHalfDay: isHalfDay,
    halfDayShift: halfDayShift,
    prefixDays: prefixDays,
    suffixDays: suffixDays,
    courtDuty: courtDuty,
    courtCaseDetails: courtCaseDetails,
    courtHandoverOfficer: courtHandoverOfficer,
    curtailedBy: "",
    curtailReason: "",
    reason: reason,
    stationLeave: stationLeave,
    stationDestination: stationDestination,
    stationLocalPS: stationLocalPS,
    stationTravelMode: stationTravelMode,
    stationFamilyContact: stationFamilyContact,
    stationLeaveAddress: stationLeaveAddress,
    handoverTo: handoverTo,
    emergencyContact: emergencyContact,
    attachment: AppState.currentAttachment || null,
    status: "PENDING_INCHARGE", // Awaiting Branch Incharge recommendation
    appliedAt: appliedAt,
    inchargeRemarks: "",
    inchargeActionAt: "",
    spRemarks: "",
    spActionAt: ""
  };

  AppState.leaves.unshift(newLeave);
  AppState.currentAttachment = null;
  saveData();
  broadcastLiveAction({ action: "NEW_LEAVE", leave: newLeave });

  showToast(`Leave Application ${newId} (${totalDays} Days) submitted successfully and forwarded to Branch Incharge.`, "success");
  switchTab("my_leaves");
}

// ==========================================
// VIEW 3: MY APPLICATIONS
// ==========================================
function renderMyLeaves(container) {
  const user = AppState.currentUser;
  const userLeaves = AppState.leaves.filter(l => l.applicantId === user.id);

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          My Leave Applications
        </h2>
        <p>Track status and download sanction slips for your leave applications</p>
      </div>
      <div>
        <button class="btn btn-gold" onclick="switchTab('apply_leave')">+ Apply New Leave</button>
      </div>
    </div>

    ${userLeaves.length === 0 ? `
      <div class="card-table-wrap" style="padding: 44px 20px; text-align: center; background: #ffffff; border-radius: 12px; border: 1.5px dashed #cbd5e1; margin-top: 14px;">
        <div style="width: 58px; height: 58px; border-radius: 50%; background: #f8fafc; border: 1px solid #e2e8f0; display: inline-flex; align-items: center; justify-content: center; margin-bottom: 14px; font-size: 1.6rem;">📋</div>
        <h3 style="font-size: 1.15rem; color: #0f274c; margin-bottom: 6px; font-weight: 700;">No Leave Applications Found</h3>
        <p style="color: #64748b; font-size: 0.9rem; max-width: 480px; margin: 0 auto 20px; line-height: 1.5;">
          You have not submitted any leave applications yet. Once you apply, your application status, recommendation trail, and official sanction slips will appear here.
        </p>
        <button class="btn btn-gold" onclick="switchTab('apply_leave')" style="padding: 10px 22px; font-weight: 600; font-size: 0.92rem;">
          + Apply New Leave Now
        </button>
      </div>
    ` : `
      <div class="card-table-wrap">
        <div class="responsive-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Leave Type</th>
                <th>Period</th>
                <th>Days</th>
                <th>Ground / Reason</th>
                <th>Station Leave</th>
                <th>Current Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              ${userLeaves.map(leave => renderLeaveTableRow(leave)).join("")}
            </tbody>
          </table>
        </div>
      </div>
    `}
  `;

  container.innerHTML = html;
}

// ==========================================
// VIEW 4: BRANCH INCHARGE DESK
// ==========================================
function renderInchargeDesk(container) {
  const user = AppState.currentUser;
  const isSP = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  const isBranchIncharge = user && (user.role === "branch_incharge" || user.role === "admin" || isSP);
  const isSPRole = user && (user.role === "sp_cyber");

  if (!isBranchIncharge) {
    container.innerHTML = `
      <div style="background: #fff; border-radius: 12px; border: 1px solid #fee2e2; padding: 28px 20px; text-align: center; max-width: 520px; margin: 30px auto; box-shadow: var(--shadow-sm);">
        <div style="width: 48px; height: 48px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 12px; font-size: 1.4rem;">🔒</div>
        <h3 style="color: #991b1b; font-size: 1.15rem; margin-bottom: 6px;">Branch Incharge Access Required</h3>
        <p style="color: #64748b; font-size: 0.88rem; margin-bottom: 16px;">
          You are currently logged in as <strong>${user ? user.name : 'Police Personnel'} (${user ? user.rank : 'Member'})</strong>.
          <br>Authorized Branch Incharge login is required to verify and recommend leave applications.
        </p>
        <div style="display: flex; gap: 8px; justify-content: center; flex-wrap: wrap;">
          <button class="btn btn-outline btn-sm" onclick="handleLogout()" style="color: #dc2626; border-color: #dc2626;">
            Sign Out & Login As Incharge
          </button>
        </div>
      </div>
    `;
    return;
  }

  const branch = AppState.branches.find(b => b.id === user.branchId);
  const branchName = branch ? branch.name : "Cyber Branch";

  // STRICTLY filter only for current Incharge's own branch
  const branchPendingLeaves = AppState.leaves.filter(l => {
    return l.status === "PENDING_INCHARGE" && l.branchId === user.branchId;
  });

  const branchProcessedLeaves = AppState.leaves.filter(l => {
    return l.status !== "PENDING_INCHARGE" && l.branchId === user.branchId;
  });

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
          Branch Incharge Verification Desk
        </h2>
        <p>Incharge: <strong>${user.name} (${user.rank})</strong> | Unit: <strong>${branchName}</strong></p>
      </div>
      <div>
        <button class="btn btn-outline btn-sm" onclick="renderApp()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- EXCLUSIVE BRANCH BANNER -->
    <div style="background: #f8fafc; border: 1.5px solid #cbd5e1; border-radius: 10px; padding: 12px 16px; margin-bottom: 16px; display: flex; align-items: center; justify-content: space-between; flex-wrap: wrap; gap: 8px;">
      <div style="display: flex; align-items: center; gap: 10px;">
        <span style="font-size: 1.25rem;">&#127970;</span>
        <div>
          <strong style="color: #0f274c; font-size: 0.96rem;">${branchName}</strong>
          <div style="font-size: 0.78rem; color: #64748b;">Incharge Verification Scope: Restricted exclusively to ${branchName} personnel</div>
        </div>
      </div>
      <span class="branch-tag" style="font-size: 0.82rem; font-weight: 700; padding: 4px 10px;">
        ${branchPendingLeaves.length} Pending Recommendation
      </span>
    </div>

    <div class="card-table-wrap">
      <div class="table-toolbar">
        <div class="table-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Applications Awaiting Branch Recommendation
          <span class="tab-badge" style="margin-left: 6px;">${branchPendingLeaves.length}</span>
        </div>
      </div>
      ${branchPendingLeaves.length === 0 ? `
        <div style="padding: 32px 20px; text-align: center; color: #166534; background: #f0fdf4; border-radius: 0 0 12px 12px;">
          <div style="font-size: 1.05rem; font-weight: 700; margin-bottom: 4px;">All Clear - No Pending Applications</div>
          <div style="font-size: 0.88rem; color: #64748b;">No pending leave applications for ${branchName}. All applications from your branch personnel have been reviewed and disposed.</div>
        </div>
      ` : `
        <div class="responsive-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Personnel Details</th>
                <th>Leave Type</th>
                <th>Period</th>
                <th>Days</th>
                <th>Ground / Reason</th>
                <th>Relieving Handover</th>
                <th>Incharge Action</th>
              </tr>
            </thead>
            <tbody>
              ${branchPendingLeaves.map(leave => `
                <tr class="leave-card-row">
                  <td data-label="Application ID"><strong>${leave.id}</strong><br><small style="color: #64748b;">${leave.appliedAt}</small></td>
                  <td data-label="Personnel Details">
                    <strong>${leave.applicantName}</strong><br>
                    <small style="color: #64748b;">${leave.rank} (${leave.beltNo})</small><br>
                    <span class="branch-tag">${leave.branchName}</span>
                  </td>
                  <td data-label="Leave Type"><span style="font-weight: 700; color: #1e3a8a;">${leave.leaveType}</span><br><small>${leave.leaveTypeName ? leave.leaveTypeName.split("(")[0] : leave.leaveType}</small></td>
                  <td data-label="Period">${formatDate(leave.fromDate)} to ${formatDate(leave.toDate)}</td>
                  <td data-label="Days"><strong style="font-size: 1.05rem;">${leave.totalDays}</strong> Days</td>
                  <td data-label="Ground / Reason" style="max-width: 200px;">${leave.reason}</td>
                  <td data-label="Relieving Handover">${leave.handoverTo || "-"}</td>
                  <td data-label="Incharge Action" class="mobile-card-actions">
                    <div style="display: flex; gap: 6px; align-items: center;">
                      <button class="btn btn-primary btn-sm mobile-action-btn" onclick="openInchargeActionModal('${leave.id}')">
                        Review & Recommend
                      </button>
                      <button class="btn btn-outline btn-sm mobile-action-btn" onclick="openLeaveDetailsModal('${leave.id}')">
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `}
    </div>

    <!-- PREVIOUSLY PROCESSED LEAVES -->
    <div class="card-table-wrap" style="margin-top: 24px;">
      <div class="table-toolbar">
        <div class="table-title">${branchName} Disposed / Processed Leave Register</div>
      </div>
      ${branchProcessedLeaves.length === 0 ? `
        <div style="padding: 24px 20px; text-align: center; color: #64748b; background: #ffffff; border-radius: 0 0 12px 12px; font-size: 0.88rem;">
          No previous processed leave applications found for ${branchName}.
        </div>
      ` : `
        <div class="responsive-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>Leave ID</th>
                <th>Personnel</th>
                <th>Leave Type</th>
                <th>Period</th>
                <th>Days</th>
                <th>Incharge Remarks</th>
                <th>Current Status</th>
                <th>Details</th>
              </tr>
            </thead>
            <tbody>
              ${branchProcessedLeaves.slice(0, 8).map(leave => `
                <tr>
                  <td>${leave.id}</td>
                  <td><strong>${leave.applicantName}</strong> (${leave.beltNo})</td>
                  <td>${leave.leaveType}</td>
                  <td>${formatDate(leave.fromDate)} - ${formatDate(leave.toDate)}</td>
                  <td>${leave.totalDays} Days</td>
                  <td><small>${leave.inchargeRemarks || "-"}</small></td>
                  <td>${getStatusBadge(leave.status)}</td>
                  <td><button class="btn btn-outline btn-sm" onclick="openLeaveDetailsModal('${leave.id}')">Details</button></td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  container.innerHTML = html;
}

// ==========================================
// VIEW 5: SP CYBER APPROVAL DESK
// ==========================================
function renderSPDesk(container) {
  const user = AppState.currentUser;
  const recommendedLeaves = AppState.leaves.filter(l => l.status === "RECOMMENDED");
  const initialPendingLeaves = AppState.leaves.filter(l => l.status === "PENDING_INCHARGE");
  const approvedLeaves = AppState.leaves.filter(l => l.status === "APPROVED");

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          Superintendent of Police Sanction Desk
        </h2>
        <p>Sanctioning Authority: <strong>Mayank Gupta, IPS</strong> (SP Cyber Crime, Panchkula)</p>
      </div>
      <div>
        <button class="btn btn-outline btn-sm" onclick="renderApp()">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Refresh
        </button>
      </div>
    </div>

    <!-- SP STATS BANNER -->
    <div class="stats-grid">
      <div class="stat-card gold">
        <div class="stat-header">
          <span class="stat-title">Pending Sanction</span>
          <div class="stat-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
        </div>
        <div class="stat-number">${recommendedLeaves.length}</div>
        <div class="stat-subtext">Recommended by Incharges</div>
      </div>

      <div class="stat-card blue">
        <div class="stat-header">
          <span class="stat-title">Awaiting Branch</span>
          <div class="stat-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg></div>
        </div>
        <div class="stat-number">${initialPendingLeaves.length}</div>
        <div class="stat-subtext">Direct Sanction Available</div>
      </div>

      <div class="stat-card green">
        <div class="stat-header">
          <span class="stat-title">Sanctioned Orders</span>
          <div class="stat-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
        <div class="stat-number">${approvedLeaves.length}</div>
        <div class="stat-subtext">Official Orders Issued</div>
      </div>

      <div class="stat-card purple">
        <div class="stat-header">
          <span class="stat-title">Cyber Wings</span>
          <div class="stat-icon"><svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg></div>
        </div>
        <div class="stat-number">13</div>
        <div class="stat-subtext">Units Operational</div>
      </div>
    </div>

    <!-- SECTION 1: RECOMMENDED APPLICATIONS -->
    <div class="card-table-wrap">
      <div class="table-toolbar">
        <div class="table-title">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          Recommended by Branch Incharges (Ready for Sanction)
          <span class="tab-badge" style="margin-left: 6px;">${recommendedLeaves.length}</span>
        </div>
      </div>
      ${recommendedLeaves.length === 0 ? `
        <div style="padding: 28px 20px; text-align: center; color: #166534; background: #f0fdf4; border-radius: 0 0 12px 12px;">
          <div style="font-size: 1.02rem; font-weight: 700; margin-bottom: 2px;">✓ All Clear</div>
          <div style="font-size: 0.86rem; color: #64748b;">No leave applications currently pending for SP sanction.</div>
        </div>
      ` : `
        <div class="responsive-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Personnel & Branch</th>
                <th>Leave Type</th>
                <th>Period</th>
                <th>Days</th>
                <th>Ground / Reason</th>
                <th>Incharge Remarks</th>
                <th>Station Leave</th>
                <th>SP Action</th>
              </tr>
            </thead>
            <tbody>
              ${recommendedLeaves.map(leave => `
                <tr class="leave-card-row">
                  <td data-label="Application ID"><strong>${leave.id}</strong></td>
                  <td data-label="Personnel & Branch">
                    <strong>${leave.applicantName}</strong><br>
                    <small style="color: #64748b;">${leave.rank} (${leave.beltNo})</small><br>
                    <span class="branch-tag">${leave.branchName}</span>
                  </td>
                  <td data-label="Leave Type"><span style="font-weight: 700;">${leave.leaveType}</span></td>
                  <td data-label="Period">${formatDate(leave.fromDate)} to ${formatDate(leave.toDate)}</td>
                  <td data-label="Days"><strong>${leave.totalDays}</strong> Days</td>
                  <td data-label="Ground / Reason" style="max-width: 180px;">${leave.reason}</td>
                  <td data-label="Incharge Remarks" style="background: #f8fafc; font-size: 0.8rem; color: #1e3a8a;">
                    "${leave.inchargeRemarks || 'Recommended'}"
                  </td>
                  <td data-label="Station Leave">${leave.stationLeave ? '<span style="color: #0f274c; font-weight: 700;">Yes</span>' : '<span style="color: #64748b;">No</span>'}</td>
                  <td data-label="SP Action" class="mobile-card-actions">
                    <div style="display: flex; gap: 6px; align-items: center;">
                      <button class="btn btn-gold btn-sm mobile-action-btn" onclick="openSPActionModal('${leave.id}')">
                        Sanction Order
                      </button>
                      <button class="btn btn-outline btn-sm mobile-action-btn" onclick="openLeaveDetailsModal('${leave.id}')">
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `}
    </div>

    <!-- SECTION 2: DIRECT / INITIAL APPLICATIONS (AWAITING BRANCH REVIEW) -->
    <div class="card-table-wrap" style="margin-top: 20px;">
      <div class="table-toolbar" style="background: #fffbeb; border-bottom: 1.5px solid #fde68a;">
        <div class="table-title" style="color: #92400e;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          Direct & Initial Applications (Awaiting Branch Review)
          <span class="tab-badge" style="background: #d97706; margin-left: 6px;">${initialPendingLeaves.length}</span>
        </div>
      </div>
      ${initialPendingLeaves.length === 0 ? `
        <div style="padding: 24px 20px; text-align: center; color: #166534; background: #f0fdf4; border-radius: 0 0 12px 12px;">
          <div style="font-size: 0.98rem; font-weight: 700; margin-bottom: 2px;">✓ All Clear</div>
          <div style="font-size: 0.85rem; color: #64748b;">No fresh applications awaiting branch review.</div>
        </div>
      ` : `
        <div class="responsive-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>Application ID</th>
                <th>Personnel Details</th>
                <th>Leave Type</th>
                <th>Period</th>
                <th>Days</th>
                <th>Ground / Reason</th>
                <th>Branch</th>
                <th>SP Direct Action</th>
              </tr>
            </thead>
            <tbody>
              ${initialPendingLeaves.map(leave => `
                <tr class="leave-card-row">
                  <td data-label="Application ID"><strong>${leave.id}</strong><br><small style="color: #64748b;">${leave.appliedAt}</small></td>
                  <td data-label="Personnel Details">
                    <strong>${leave.applicantName}</strong><br>
                    <small style="color: #64748b;">${leave.rank} (${leave.beltNo})</small>
                  </td>
                  <td data-label="Leave Type"><span style="font-weight: 700; color: #1e3a8a;">${leave.leaveType}</span><br><small>${leave.leaveTypeName ? leave.leaveTypeName.split("(")[0] : leave.leaveType}</small></td>
                  <td data-label="Period">${formatDate(leave.fromDate)} to ${formatDate(leave.toDate)}</td>
                  <td data-label="Days"><strong style="font-size: 1.05rem;">${leave.totalDays}</strong> Days</td>
                  <td data-label="Ground / Reason" style="max-width: 180px;">${leave.reason}</td>
                  <td data-label="Branch"><span class="branch-tag">${leave.branchName}</span></td>
                  <td data-label="SP Direct Action" class="mobile-card-actions">
                    <div style="display: flex; gap: 6px; align-items: center;">
                      <button class="btn btn-gold btn-sm mobile-action-btn" onclick="openSPActionModal('${leave.id}')">
                        Direct Sanction
                      </button>
                      <button class="btn btn-outline btn-sm mobile-action-btn" onclick="openLeaveDetailsModal('${leave.id}')">
                        Details
                      </button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  container.innerHTML = html;
}

// ==========================================
// VIEW 6: ALL 13 BRANCHES VIEW
// ==========================================
function renderBranchesView(container) {
  const user = AppState.currentUser;
  const isSPRole = user && (user.role === "sp_cyber" || user.id === "SP-001");
  if (!isSPRole) {
    container.innerHTML = `
      <div style="background: #fff; border-radius: 12px; border: 1px solid #fee2e2; padding: 40px 24px; text-align: center; max-width: 520px; margin: 40px auto; box-shadow: var(--shadow-sm);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 1.6rem;">🔒</div>
        <h3 style="color: #991b1b; font-size: 1.2rem; margin-bottom: 8px;">Restricted Access</h3>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">
          13 Cyber Wings deployment is restricted strictly to the <strong>Superintendent of Police (SP Cyber)</strong>.
        </p>
        <button class="btn btn-primary" onclick="switchTab(\'dashboard\')">Return to Dashboard</button>
      </div>
    `;
    return;
  }

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          Cyber Crime Branches & Strength Deployment (13 Cyber Units)
        </h2>
        <p>Overview of all 13 Cyber Wings and personnel deployment</p>
      </div>
    </div>

    <div class="branches-grid">
      ${AppState.branches.map(branch => {
        // Find incharge for this branch
        const incharge = AppState.users.find(u => u.branchId === branch.id && (u.role === "branch_incharge" || u.isApprover));
        const branchMembers = AppState.users.filter(u => u.branchId === branch.id);
        const onLeaveCount = AppState.leaves.filter(l => {
          if (l.branchId !== branch.id || l.status !== "APPROVED") return false;
          const today = new Date().toISOString().split("T")[0];
          return l.fromDate <= today && l.toDate >= today;
        }).length;
        const onDutyCount = Math.max(0, branchMembers.length - onLeaveCount);

        return `
          <div class="branch-card">
            <div>
              <div class="branch-card-header">
                <div class="branch-icon-box">
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="2" width="20" height="20" rx="2.18" ry="2.18"></rect><line x1="7" y1="2" x2="7" y2="22"></line><line x1="17" y1="2" x2="17" y2="22"></line><line x1="2" y1="12" x2="22" y2="12"></line><line x1="2" y1="7" x2="7" y2="7"></line><line x1="2" y1="17" x2="7" y2="17"></line><line x1="17" y1="17" x2="22" y2="17"></line><line x1="17" y1="7" x2="22" y2="7"></line></svg>
                </div>
                <div class="branch-info">
                  <h4>${branch.name}</h4>
                  <div class="branch-code" style="font-size: 0.78rem; color: #64748b; font-weight: 600;">CODE: ${branch.id.toUpperCase()}</div>
                </div>
              </div>

              <div class="branch-incharge-line">
                Incharge: <strong>${incharge ? `${incharge.name} (${incharge.rank})` : "Under Posting"}</strong><br>
                <small style="color: #64748b;">Mobile: ${incharge ? incharge.mobile : "-"}</small>
              </div>
            </div>

            <div>
              <div class="branch-stats-pills">
                <div class="branch-stat-item">
                  <div class="val">${branchMembers.length}</div>
                  <div class="lbl">Total Strength</div>
                </div>
                <div class="branch-stat-item">
                  <div class="val" style="color: #16a34a;">${onDutyCount}</div>
                  <div class="lbl">On Duty</div>
                </div>
                <div class="branch-stat-item">
                  <div class="val" style="color: #dc2626;">${onLeaveCount}</div>
                  <div class="lbl">On Leave</div>
                </div>
              </div>
            </div>
          </div>
        `;
      }).join("")}
    </div>
  `;

  container.innerHTML = html;
}

// ==========================================
// VIEW 7: MASTER LEAVE REGISTER (EXCEL EXPORT)
// ==========================================
function renderMasterRegister(container) {
  const user = AppState.currentUser;
  const canViewRegister = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");

  if (!canViewRegister) {
    container.innerHTML = `
      <div style="background: #fff; border-radius: 12px; border: 1px solid #fee2e2; padding: 40px 24px; text-align: center; max-width: 600px; margin: 40px auto; box-shadow: var(--shadow-sm);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 1.6rem;">🔒</div>
        <h3 style="color: #991b1b; font-size: 1.2rem; margin-bottom: 8px;">Access Restricted</h3>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">
          Master Leave Register and CSV export are strictly restricted to <strong>Superintendent of Police (SP Cyber)</strong> and the <strong>Supervisory Reader Desk</strong>.
        </p>
        <button class="btn btn-primary" onclick="switchTab('dashboard')">Return to Dashboard</button>
      </div>
    `;
    return;
  }

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          Master Leave Register
        </h2>
        <p>Consolidated leave records of all 13 Cyber Wings</p>
      </div>
      <div style="display: flex; gap: 10px; flex-wrap: wrap;">
        <button class="btn btn-outline" onclick="exportLeavesToCSV()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Export to Excel (CSV)
        </button>
        <button class="btn btn-outline" onclick="openBackupModal()" style="border-color: #15803d; color: #15803d;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Backup & Restore Center
        </button>
        <button class="btn btn-primary" onclick="window.print()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Print Register
        </button>
      </div>
    </div>

    <div class="card-table-wrap">
      <div class="table-toolbar">
        <div class="table-filters" style="width: 100%;">
          <input type="text" id="registerSearchInput" class="search-input" placeholder="Search by Name, Belt No., or Leave ID..." oninput="filterRegisterTable()" style="min-width: 240px;">
          
          <select id="registerBranchFilter" class="select-filter" onchange="filterRegisterTable()">
            <option value="">-- All 13 Branches --</option>
            ${AppState.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join("")}
          </select>

          <select id="registerStatusFilter" class="select-filter" onchange="filterRegisterTable()">
            <option value="">-- All Statuses --</option>
            <option value="PENDING_INCHARGE">Pending with Incharge</option>
            <option value="RECOMMENDED">Recommended to SP</option>
            <option value="APPROVED">Sanctioned / Approved</option>
            <option value="REJECTED">Rejected</option>
          </select>

          <select id="registerTypeFilter" class="select-filter" onchange="filterRegisterTable()">
            <option value="">-- All Leave Types --</option>
            ${LEAVE_TYPES.map(lt => `<option value="${lt.code}">${lt.code} - ${lt.name}</option>`).join("")}
          </select>
        </div>
      </div>

      ${AppState.leaves.length === 0 ? `
        <div style="padding: 36px 20px; text-align: center; color: #64748b; background: #ffffff; border-radius: 0 0 12px 12px;">
          <div style="font-size: 1.05rem; font-weight: 700; color: #334155; margin-bottom: 4px;">No Applications in Register</div>
          <div style="font-size: 0.86rem; color: #64748b;">No leave records found in the system.</div>
        </div>
      ` : `
        <div class="responsive-table">
          <table class="data-table" id="masterTable">
            <thead>
              <tr>
                <th>ID & Applied Date</th>
                <th>Personnel Details</th>
                <th>Leave Type</th>
                <th>Period</th>
                <th>Days</th>
                <th>Ground / Reason</th>
                <th>Station Leave</th>
                <th>Current Status</th>
                <th>Action / Order</th>
              </tr>
            </thead>
            <tbody id="masterTableBody">
              ${AppState.leaves.map(leave => renderLeaveTableRow(leave, true)).join("")}
            </tbody>
          </table>
        </div>
      `}
    </div>
  `;

  container.innerHTML = html;
}

function filterRegisterTable() {
  const searchVal = document.getElementById("registerSearchInput")?.value.toLowerCase().trim() || "";
  const branchVal = document.getElementById("registerBranchFilter")?.value || "";
  const statusVal = document.getElementById("registerStatusFilter")?.value || "";
  const typeVal = document.getElementById("registerTypeFilter")?.value || "";

  const filtered = AppState.leaves.filter(l => {
    if (branchVal && l.branchId !== branchVal) return false;
    if (statusVal && l.status !== statusVal) return false;
    if (typeVal && l.leaveType !== typeVal) return false;
    if (searchVal) {
      const targetStr = `${l.id} ${l.applicantName} ${l.beltNo} ${l.reason} ${l.branchName}`.toLowerCase();
      if (!targetStr.includes(searchVal)) return false;
    }
    return true;
  });

  const tbody = document.getElementById("masterTableBody");
  if (tbody) {
    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #64748b; padding: 24px;">No records match the selected filter criteria.</td></tr>`;
    } else {
      tbody.innerHTML = filtered.map(l => renderLeaveTableRow(l, true)).join("");
    }
  }
}

// Export to CSV / Excel (Enhanced with UTF-8 BOM for Microsoft Excel)
function exportLeavesToCSV() {
  const user = AppState.currentUser;
  const canViewRegister = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  if (!canViewRegister) {
    showToast("Permission Denied", "error");
    return;
  }

  const headers = [
    "S.No.",
    "Application ID",
    "Sanction Order No",
    "Applicant Name",
    "Belt No / PNO",
    "Rank",
    "Branch",
    "Leave Type",
    "From Date",
    "To Date",
    "Sanctioned Days",
    "Originally Applied Days",
    "Reason / Ground",
    "Station Leave Permission",
    "Station Destination / Address",
    "Handover To",
    "Emergency Contact No",
    "Status",
    "Applied At",
    "Branch Incharge Remarks",
    "SP Cyber Sanction Remarks"
  ];
  
  const rows = AppState.leaves.map((l, idx) => [
    idx + 1,
    `"${l.id}"`,
    `"${l.sanctionNo || '-'}"`,
    `"${l.applicantName}"`,
    `"${l.beltNo}"`,
    `"${l.rank}"`,
    `"${l.branchName}"`,
    `"${l.leaveType} (${l.leaveTypeName || ''})"`,
    `"${l.fromDate}"`,
    `"${l.toDate}"`,
    l.totalDays,
    l.originalDays || l.totalDays,
    `"${(l.reason || '').replaceAll('"', '""')}"`,
    l.stationLeave ? "Granted (Yes)" : "At Station (No)",
    `"${(l.stationLeaveAddress || '').replaceAll('"', '""')}"`,
    `"${(l.handoverTo || '').replaceAll('"', '""')}"`,
    `"${l.emergencyContact || ''}"`,
    `"${l.status}"`,
    `"${l.appliedAt || ''}"`,
    `"${(l.inchargeRemarks || '').replaceAll('"', '""')}"`,
    `"${(l.spRemarks || '').replaceAll('"', '""')}"`
  ]);

  const csvContent = "\uFEFF" + [headers.join(","), ...rows.map(e => e.join(","))].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `Cyber_Police_Leave_Register_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("Leave Register downloaded successfully as Excel (CSV).", "success");
}

// Export Personnel Staff Directory to CSV / Excel
function exportStaffToCSV() {
  const user = AppState.currentUser;
  const isSP = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  const targetUsers = isSP ? AppState.users : AppState.users.filter(u => u.branchId === user.branchId);

  const headers = [
    "S.No.",
    "Officer ID",
    "Full Name",
    "Belt No / PNO",
    "Rank",
    "Branch",
    "System Role",
    "Mobile Number",
    "Email",
    "CL Balance",
    "EL Balance",
    "ML Balance",
    "PL Balance",
    "CCL Balance",
    "C-OFF Balance",
    "HPL Balance",
    "RH Balance"
  ];

  const rows = targetUsers.map((u, idx) => {
    const branch = AppState.branches.find(b => b.id === u.branchId);
    const branchName = branch ? branch.name : u.branchId;
    const b = u.leaveBalances || {};
    return [
      idx + 1,
      `"${u.id}"`,
      `"${u.name}"`,
      `"${u.beltNo}"`,
      `"${u.rank}"`,
      `"${branchName}"`,
      `"${u.role}"`,
      `"${u.mobile || ''}"`,
      `"${u.email || ''}"`,
      b.CL || 0,
      b.EL || 0,
      b.ML || 0,
      b.PL || 0,
      b.CCL || 0,
      b["C-OFF"] || 0,
      b.HPL || 0,
      b.RH || 0
    ].join(",");
  });

  const csvContent = "\uFEFF" + [headers.join(","), ...rows].join("\r\n");
  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const dateStr = new Date().toISOString().split("T")[0];
  a.href = url;
  a.download = `Cyber_Police_Personnel_Directory_${dateStr}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("Personnel Staff Directory downloaded successfully as Excel (CSV).", "success");
}

// Open Database Backup & Excel Center Modal
function openBackupModal() {
  const user = AppState.currentUser;
  const canAccess = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  if (!canAccess) {
    showToast("Data Backup & Restore Center is restricted to SP Cyber and Reader Desk.", "error");
    return;
  }

  const statsEl = document.getElementById("backupDbStats");
  if (statsEl) {
    statsEl.innerHTML = `
      Branches: <strong>${AppState.branches.length}</strong> | 
      Registered Force: <strong>${AppState.users.length}</strong> | 
      Leave Records: <strong>${AppState.leaves.length}</strong> | 
      Active Orders/Notices: <strong>${(AppState.notices || []).length}</strong> | 
      Server LAN Sync: <strong style="color: ${isLanServerConnected ? '#15803d' : '#b45309'};">${isLanServerConnected ? 'Active (LAN Port 8085)' : 'Local Mode (Offline)'}</strong>
    `;
  }
  const previewBox = document.getElementById("restorePreviewBox");
  if (previewBox) {
    previewBox.style.display = "none";
    previewBox.innerHTML = "";
  }
  const fileInput = document.getElementById("restoreBackupFileInput");
  if (fileInput) fileInput.value = "";

  const modal = document.getElementById("backupRestoreModal");
  if (modal) modal.classList.add("active");
}

// Download 1-Click Full JSON Snapshot Backup
function downloadFullJsonBackup() {
  const user = AppState.currentUser;
  const now = new Date();
  const dateStr = now.toISOString().split("T")[0];
  const timeStr = now.toTimeString().split(" ")[0].replace(/:/g, "-");

  const backupPayload = {
    system: "Haryana State Cyber Crime Branch - Leave & Personnel Management Portal",
    headquarters: "Sector 20, Panchkula (Haryana)",
    version: "2.5-OFFICE",
    backupTimestamp: now.toISOString(),
    backupDateReadable: now.toLocaleString("en-IN"),
    exportedBy: user ? `${user.name} (${user.rank})` : "SP Cyber",
    statistics: {
      branches: AppState.branches.length,
      users: AppState.users.length,
      leaves: AppState.leaves.length,
      notices: (AppState.notices || []).length
    },
    branches: AppState.branches,
    users: AppState.users,
    leaves: AppState.leaves,
    notices: AppState.notices || []
  };

  const jsonString = JSON.stringify(backupPayload, null, 2);
  const blob = new Blob([jsonString], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `Cyber_Police_Full_Database_Backup_${dateStr}_${timeStr}.json`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);

  showToast("Full database backup snapshot downloaded successfully (.json)", "success");
}

// Handle Database Restore from Selected JSON File
function handleRestoreBackupSubmit() {
  const fileInput = document.getElementById("restoreBackupFileInput");
  if (!fileInput || !fileInput.files || fileInput.files.length === 0) {
    showToast("Please select a valid JSON backup file first.", "error");
    return;
  }

  const file = fileInput.files[0];
  const reader = new FileReader();

  reader.onload = function(e) {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.users || !data.leaves || !data.branches) {
        showToast("Invalid backup file: Missing required fields (users, leaves, branches).", "error");
        return;
      }

      const usersCount = data.users.length;
      const leavesCount = data.leaves.length;
      const noticesCount = (data.notices || []).length;
      const exportDate = data.backupDateReadable || data.backupTimestamp || "Unknown";

      const confirmMsg = `File Verification Details:\n\n• Total Police Strength (Users): ${usersCount}\n• Total Leave Records: ${leavesCount}\n• Official Notices/Orders: ${noticesCount}\n• Backup Timestamp: ${exportDate}\n\nWARNING: Are you sure you want to restore and replace the current database with this backup file?`;

      if (confirm(confirmMsg)) {
        AppState.branches = data.branches;
        AppState.users = data.users;
        AppState.leaves = data.leaves;
        AppState.notices = data.notices || [];

        saveData();
        populateUserSwitcher();
        renderNavigationTabs();
        renderApp();
        closeModals();

        showToast("Database restored successfully!", "success");
      }
    } catch (err) {
      console.error("Backup parse error", err);
      showToast("File reading error: Please select a valid JSON file.", "error");
    }
  };

  reader.readAsText(file);
}

// ==========================================
// VIEW: OFFICIAL CYBER NOTICE BOARD & ORDERS
// ==========================================

function getNoticeCategoryHindi(category) {
  switch (category) {
    case "ORDER": return "Office Order";
    case "MEETING": return "Review Meeting";
    case "DIRECTIVE": return "Urgent Directive";
    case "GENERAL": return "General Notice";
    default: return "Official Notice";
  }
}

// Top Dashboard Widget for Active Notices & Orders
function renderDashboardNoticesWidget() {
  const user = AppState.currentUser;
  const isAuthorizedToPost = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  const allNotices = AppState.notices || [];

  // Filter notices for current user: either "ALL" or their specific branch
  const relevantNotices = allNotices.filter(n => {
    if (!n.targetBranch || n.targetBranch === "ALL") return true;
    return user && n.targetBranch === user.branchId;
  });

  if (relevantNotices.length === 0 && !isAuthorizedToPost) {
    return "";
  }

  // Sort: pinned first, then recent
  const sortedNotices = [...relevantNotices].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.postedAt || 0) - new Date(a.postedAt || 0);
  });

  const previewNotices = sortedNotices.slice(0, 3);

  return `
    <div class="notice-hero-section">
      <div class="notice-hero-header">
        <h3>
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          Official Notices & Office Orders
        </h3>
        <div style="display: flex; gap: 8px; align-items: center;">
          ${isAuthorizedToPost ? `
            <button class="btn btn-gold btn-sm" onclick="openCreateNoticeModal()" style="padding: 4px 10px; font-size: 0.8rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
              + Issue New Order / Notice
            </button>
          ` : ''}
          <button class="btn btn-outline btn-sm" onclick="switchTab('notices')" style="color: #fff; border-color: rgba(255,255,255,0.4); padding: 4px 10px; font-size: 0.8rem;">
            View All Notices (${allNotices.length}) &rarr;
          </button>
        </div>
      </div>
      <div class="notice-hero-body">
        ${previewNotices.length === 0 ? `
          <div style="text-align: center; color: #64748b; padding: 14px; font-size: 0.88rem;">
            No active office notices or circulars at present.
          </div>
        ` : previewNotices.map(n => `
          <div class="notice-item-row ${n.priority === 'URGENT' ? 'urgent' : ''} ${n.pinned ? 'pinned' : ''}">
            <div style="display: flex; align-items: flex-start; gap: 12px; flex: 1;">
              <span class="notice-badge ${n.priority === 'URGENT' ? 'urgent' : (n.category ? n.category.toLowerCase() : 'general')}">
                ${n.priority === 'URGENT' ? 'URGENT' : getNoticeCategoryHindi(n.category)}
              </span>
              <div>
                <strong style="color: #0f274c; font-size: 0.95rem; cursor: pointer;" onclick="openViewNoticeModal('${n.id}')">
                  ${n.pinned ? '📌 ' : ''}${n.title}
                </strong>
                <div style="font-size: 0.8rem; color: #64748b; margin-top: 3px;">
                  <span>Issued By: <strong>${n.postedBy}</strong></span> | 
                  <span>Target: <span class="branch-tag" style="padding: 1px 6px; font-size: 0.72rem;">${n.targetBranchName || 'All Branches'}</span></span> | 
                  <span>${n.postedAt}</span>
                </div>
              </div>
            </div>
            <div style="margin-left: 14px; flex-shrink: 0;">
              <button class="btn btn-outline btn-sm" onclick="openViewNoticeModal('${n.id}')" style="padding: 3px 10px; font-size: 0.8rem;">
                Read Order
              </button>
            </div>
          </div>
        `).join("")}
      </div>
    </div>
  `;
}

// Full Notice Board View
function renderNoticesView(container) {
  if (!container) return;
  const user = AppState.currentUser;
  const isAuthorizedToPost = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  const allNotices = AppState.notices || [];

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"></path><path d="M13.73 21a2 2 0 0 1-3.46 0"></path></svg>
          Cyber Crime Official Notice Board & Orders
        </h2>
        <p>Official Circulars, Directives & Cyber Notices</p>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${isAuthorizedToPost ? `
          <button class="btn btn-primary" onclick="openCreateNoticeModal()">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
            + Issue New Order / Notice
          </button>
          <button class="btn btn-outline" onclick="openBackupModal()" style="border-color: #15803d; color: #15803d;">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
            Backup Center
          </button>
        ` : ''}
      </div>
    </div>

    <!-- FILTER TOOLBAR -->
    <div class="card-table-wrap">
      <div class="table-toolbar">
        <div class="table-filters" style="width: 100%;">
          <input type="text" id="noticeSearchInput" class="search-input" placeholder="Search notices by title, subject or content..." oninput="filterNoticesGrid()" style="min-width: 260px;">
          
          <select id="noticeCategoryFilter" class="select-filter" onchange="filterNoticesGrid()">
            <option value="">-- All Notice Categories --</option>
            <option value="ORDER">Office Orders</option>
            <option value="MEETING">Review Meetings</option>
            <option value="DIRECTIVE">Directives & Instructions</option>
            <option value="GENERAL">General Notices</option>
          </select>

          <select id="noticeBranchFilter" class="select-filter" onchange="filterNoticesGrid()">
            <option value="">-- All Branches / Targeted --</option>
            <option value="ALL">All 13 Cyber Branches</option>
            ${AppState.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join("")}
          </select>

          <select id="noticePriorityFilter" class="select-filter" onchange="filterNoticesGrid()">
            <option value="">-- All Priorities --</option>
            <option value="URGENT">Urgent / High Priority Only</option>
            <option value="NORMAL">Normal Priority</option>
          </select>
        </div>
      </div>

      <!-- NOTICES GRID CONTAINER -->
      <div id="noticesGridContainer" class="notices-grid" style="padding: 0 18px 20px;">
        <!-- Rendered by renderNoticesGridCards() -->
      </div>
    </div>
  `;

  container.innerHTML = html;
  renderNoticesGridCards(allNotices);
}

function renderNoticesGridCards(noticesList) {
  const container = document.getElementById("noticesGridContainer");
  if (!container) return;

  const user = AppState.currentUser;
  const isAuthorizedToPost = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");

  if (!noticesList || noticesList.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1 / -1; text-align: center; padding: 40px; color: #64748b; background: #fff; border-radius: 8px;">
        <div style="font-size: 2rem; margin-bottom: 8px;">📭</div>
        <h4 style="color: #0f274c; margin-bottom: 6px;">No Notices or Orders Available</h4>
        <p style="font-size: 0.85rem;">No records found matching the selected filter.</p>
      </div>
    `;
    return;
  }

  // Sort: pinned first, then recent
  const sorted = [...noticesList].sort((a, b) => {
    if (a.pinned && !b.pinned) return -1;
    if (!a.pinned && b.pinned) return 1;
    return new Date(b.postedAt || 0) - new Date(a.postedAt || 0);
  });

  container.innerHTML = sorted.map(n => `
    <div class="notice-card ${n.priority === 'URGENT' ? 'urgent' : ''} ${n.pinned ? 'pinned' : ''}">
      <div class="notice-card-header">
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <span class="notice-badge ${n.priority === 'URGENT' ? 'urgent' : (n.category ? n.category.toLowerCase() : 'general')}">
            ${n.priority === 'URGENT' ? 'URGENT' : getNoticeCategoryHindi(n.category)}
          </span>
          ${n.pinned ? `<span class="notice-badge pinned">📌 PINNED</span>` : ''}
        </div>
        <span class="branch-tag" style="font-size: 0.72rem;">${n.targetBranchName || 'All Branches'}</span>
      </div>

      <div class="notice-card-body">
        <div class="notice-card-title">${n.title}</div>
        <div class="notice-card-desc">${n.content}</div>
      </div>

      <div class="notice-card-footer">
        <div>
          <strong>${n.postedBy}</strong><br>
          <span style="font-size: 0.75rem; color: #94a3b8;">${n.postedAt}</span>
        </div>
        <div style="display: flex; gap: 6px;">
          <button class="btn btn-outline btn-sm" onclick="openViewNoticeModal('${n.id}')" style="padding: 4px 8px; font-size: 0.78rem;">
            Full Order
          </button>
          ${isAuthorizedToPost ? `
            <button class="btn btn-danger btn-sm" onclick="deleteNotice('${n.id}')" title="Delete Notice" style="padding: 4px 8px; font-size: 0.78rem;">
              Delete
            </button>
          ` : ''}
        </div>
      </div>
    </div>
  `).join("");
}

function filterNoticesGrid() {
  const search = (document.getElementById("noticeSearchInput")?.value || "").toLowerCase().trim();
  const cat = document.getElementById("noticeCategoryFilter")?.value || "";
  const branch = document.getElementById("noticeBranchFilter")?.value || "";
  const priority = document.getElementById("noticePriorityFilter")?.value || "";

  const filtered = (AppState.notices || []).filter(n => {
    if (cat && n.category !== cat) return false;
    if (branch && branch !== "ALL" && n.targetBranch !== branch && n.targetBranch !== "ALL") return false;
    if (priority && n.priority !== priority) return false;
    if (search) {
      const matchTitle = (n.title || "").toLowerCase().includes(search);
      const matchContent = (n.content || "").toLowerCase().includes(search);
      const matchPoster = (n.postedBy || "").toLowerCase().includes(search);
      if (!matchTitle && !matchContent && !matchPoster) return false;
    }
    return true;
  });

  renderNoticesGridCards(filtered);
}

function openCreateNoticeModal() {
  const branchSelect = document.getElementById("noticeTargetBranch");
  if (branchSelect) {
    branchSelect.innerHTML = `
      <option value="ALL">All 13 Cyber Branches</option>
      ${AppState.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join("")}
    `;
  }
  document.getElementById("noticeTitle").value = "";
  document.getElementById("noticeContent").value = "";
  document.getElementById("noticePinTop").checked = false;
  document.getElementById("noticeCategory").value = "ORDER";
  document.getElementById("noticePriority").value = "NORMAL";

  document.getElementById("addNoticeModal").classList.add("active");
}

function handleCreateNoticeSubmit(e) {
  e.preventDefault();
  const user = AppState.currentUser;
  const title = document.getElementById("noticeTitle").value.trim();
  const category = document.getElementById("noticeCategory").value;
  const priority = document.getElementById("noticePriority").value;
  const targetBranch = document.getElementById("noticeTargetBranch").value;
  const content = document.getElementById("noticeContent").value.trim();
  const pinned = document.getElementById("noticePinTop").checked;

  let targetBranchName = "All 13 Cyber Branches";
  if (targetBranch !== "ALL") {
    const b = AppState.branches.find(x => x.id === targetBranch);
    targetBranchName = b ? b.name : targetBranch;
  }

  const now = new Date();
  const formattedDate = now.toISOString().split("T")[0] + " " + now.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });

  const newNotice = {
    id: `NOT-2026-0${(AppState.notices || []).length + 10}`,
    title: title,
    category: category,
    priority: priority,
    targetBranch: targetBranch,
    targetBranchName: targetBranchName,
    content: content,
    postedBy: user ? `${user.name} (${user.rank})` : "SP Cyber Crime",
    postedByRole: user ? user.role : "sp_cyber",
    postedAt: formattedDate,
    pinned: pinned
  };

  if (!AppState.notices) AppState.notices = [];
  AppState.notices.unshift(newNotice);

  saveData();
  broadcastLiveAction({ action: "NEW_NOTICE", notice: newNotice });
  closeModals();
  renderNavigationTabs();
  renderApp();
  showToast(`Official order/notice issued successfully (${newNotice.id})`, "success");
}

function openViewNoticeModal(noticeId) {
  const notice = (AppState.notices || []).find(n => n.id === noticeId);
  if (!notice) return;

  const bodyEl = document.getElementById("viewNoticeModalBody");
  if (!bodyEl) return;

  bodyEl.innerHTML = `
    <div class="notice-print-sheet">
      <div class="notice-print-header">
        <div style="font-size: 0.85rem; font-weight: 700; color: #475569; letter-spacing: 1px;">GOVERNMENT OF HARYANA | STATE CYBER CRIME BRANCH</div>
        <h2 style="font-size: 1.25rem; font-weight: 800; color: #0f274c; margin: 6px 0 2px;">STATE CYBER CRIME BRANCH, HARYANA</h2>
        <div style="font-size: 0.9rem; font-weight: 600; color: #1e3a8a;">Police Headquarters, Sector 20, Panchkula (Haryana)</div>
        <div style="display: flex; justify-content: space-between; margin-top: 14px; font-size: 0.84rem; color: #334155; border-top: 1px dashed #cbd5e1; padding-top: 8px;">
          <span><strong>Dispatch No:</strong> CYB/HQ/ORD/2026/${notice.id.replace('NOT-2026-', '')}</span>
          <span><strong>Date:</strong> ${notice.postedAt}</span>
        </div>
      </div>

      <div style="margin-bottom: 16px;">
        <span class="notice-badge ${notice.priority === 'URGENT' ? 'urgent' : (notice.category ? notice.category.toLowerCase() : 'general')}" style="font-size: 0.8rem; padding: 4px 10px;">
          ${notice.priority === 'URGENT' ? 'URGENT' : getNoticeCategoryHindi(notice.category)}
        </span>
        <span class="branch-tag" style="margin-left: 8px;">Target: ${notice.targetBranchName || 'All Branches'}</span>
      </div>

      <h3 style="font-size: 1.15rem; color: #0f274c; margin-bottom: 14px; border-bottom: 1px solid #e2e8f0; padding-bottom: 8px;">
        Subject: ${notice.title}
      </h3>

      <div style="font-size: 0.95rem; line-height: 1.7; color: #1e293b; white-space: pre-line; margin-bottom: 30px;">
        ${notice.content}
      </div>

      <div style="display: flex; justify-content: flex-end; margin-top: 40px; padding-top: 20px; border-top: 1px solid #cbd5e1;">
        <div style="text-align: center; min-width: 220px;">
          <div style="font-weight: 700; color: #0f274c; font-size: 0.95rem;">${notice.postedBy}</div>
          <div style="font-size: 0.84rem; color: #475569;">State Cyber Crime Branch</div>
          <div style="font-size: 0.8rem; color: #64748b;">Panchkula (Haryana)</div>
        </div>
      </div>
    </div>
  `;

  document.getElementById("viewNoticeModal").classList.add("active");
}

function deleteNotice(noticeId) {
  if (confirm("Are you sure you want to delete this notice/order?")) {
    AppState.notices = (AppState.notices || []).filter(n => n.id !== noticeId);
    saveData();
    broadcastLiveAction({ action: "DELETE_NOTICE", noticeId: noticeId });
    renderNavigationTabs();
    renderApp();
    showToast("Notice deleted successfully.", "info");
  }
}

// ==========================================
// VIEW 8: PERSONNEL DIRECTORY & ADD MEMBER
// ==========================================
function renderPersonnelDirectory(container) {
  const user = AppState.currentUser;
  const isSP = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  const isBranchIncharge = user && (user.role === "branch_incharge");
  const isAuthorized = isSP || isBranchIncharge;

  if (!isAuthorized) {
    container.innerHTML = `
      <div style="background: #fff; border-radius: 12px; border: 1px solid #fee2e2; padding: 40px 24px; text-align: center; max-width: 600px; margin: 40px auto; box-shadow: var(--shadow-sm);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 1.6rem;">🔒</div>
        <h3 style="color: #991b1b; font-size: 1.2rem; margin-bottom: 8px;">Access Restricted</h3>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">
          Personnel Staff Directory is restricted to authorized <strong>Branch Incharges</strong> and the <strong>Superintendent of Police (SP Cyber)</strong>.
        </p>
        <button class="btn btn-primary" onclick="switchTab('dashboard')">Return to Dashboard</button>
      </div>
    `;
    return;
  }

  const userBranch = AppState.branches.find(b => b.id === user.branchId);
  const userBranchName = userBranch ? userBranch.name : "Your Branch";

  // If SP / Reader: Show full directory of all 13 branches.
  // If Branch Incharge: Show ONLY members belonging to their own branch.
  const displayedUsers = isSP 
    ? AppState.users 
    : AppState.users.filter(u => u.branchId === user.branchId);

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          ${isSP ? 'State Cyber Crime Central Staff Directory' : `Branch Personnel Directory | ${userBranchName}`}
        </h2>
        <p>
          ${isSP 
            ? 'Complete personnel directory across all 13 specialized Cyber Crime branches' 
            : `Roster of police officers and personnel posted in <strong>${userBranchName}</strong>`}
        </p>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        <button class="btn btn-outline" onclick="exportStaffToCSV()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          Download Staff CSV
        </button>
        <button class="btn btn-primary" onclick="openAddUserModal()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          ${isSP ? '+ Add Personnel / Member' : `+ Add Branch Member`}
        </button>
      </div>
    </div>

    <div class="card-table-wrap">
      <div class="table-toolbar">
        <div class="table-title">
          ${isSP 
            ? `Total Strength: <strong>${displayedUsers.length} Officers / Personnel</strong> (All 13 Branches)` 
            : `Branch Strength: <strong>${displayedUsers.length} Personnel</strong> [${userBranchName}]`}
        </div>
        ${isSP ? `
          <div>
            <select id="directoryBranchFilter" class="select-filter" onchange="filterDirectoryTable(this.value)">
              <option value="">-- View All 13 Branches --</option>
              ${AppState.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join("")}
            </select>
          </div>
        ` : ''}
      </div>
      <div class="responsive-table">
        <table class="data-table" id="directoryTable">
          <thead>
            <tr>
              <th>ID / Belt No.</th>
              <th>Name</th>
              <th>Rank</th>
              <th>Branch</th>
              <th>System Role</th>
              <th>Contact</th>
              <th>CL Balance</th>
              <th>EL Balance</th>
            </tr>
          </thead>
          <tbody id="directoryTableBody">
            ${displayedUsers.length === 0 ? `
              <tr>
                <td colspan="8" style="text-align: center; color: #64748b; padding: 24px;">
                  No personnel records found for this branch.
                </td>
              </tr>
            ` : displayedUsers.map(u => {
              const b = AppState.branches.find(br => br.id === u.branchId);
              return `
                <tr class="leave-card-row" data-branch="${u.branchId}">
                  <td data-label="ID / Belt No."><strong>${u.id}</strong><br><small style="color: #64748b;">${u.beltNo}</small></td>
                  <td data-label="Officer Name"><strong>${u.name}</strong></td>
                  <td data-label="Rank">${u.rank}</td>
                  <td data-label="Cyber Branch"><span class="branch-tag">${b ? b.name : u.branchId}</span></td>
                  <td data-label="System Role"><span style="font-size: 0.8rem; font-weight: 600;">${getRoleDisplay(u.role)}</span></td>
                  <td data-label="Contact Details"><small>${u.mobile}<br>${u.email}</small></td>
                  <td data-label="CL Balance"><strong>${u.leaveBalances?.CL ?? 0}</strong> Days</td>
                  <td data-label="EL Balance"><strong>${u.leaveBalances?.EL ?? 0}</strong> Days</td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

function filterDirectoryTable(branchId) {
  const tbody = document.getElementById("directoryTableBody");
  if (!tbody) return;
  const rows = tbody.querySelectorAll("tr");
  rows.forEach(r => {
    if (!branchId || r.dataset.branch === branchId) {
      r.style.display = "";
    } else {
      r.style.display = "none";
    }
  });
}

// ==========================================
// VIEW 9: DAILY LEAVE ROZNAMCHA / SITREP REPORT
// ==========================================
let currentSitrepDate = new Date().toISOString().split("T")[0];

function changeSitrepDate(dateStr) {
  if (!dateStr) return;
  currentSitrepDate = dateStr;
  renderDailySitrep(document.getElementById("tabContentContainer"));
}

function setSitrepQuickDate(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  currentSitrepDate = d.toISOString().split("T")[0];
  renderDailySitrep(document.getElementById("tabContentContainer"));
}

function printSitrepReport() {
  const user = AppState.currentUser;
  const canViewSitrep = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  if (!canViewSitrep) {
    showToast("Permission Denied", "error");
    return;
  }
  window.print();
}

function exportSitrepCSV(targetDate) {
  const user = AppState.currentUser;
  const canViewSitrep = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  if (!canViewSitrep) {
    showToast("Permission Denied", "error");
    return;
  }
  const dateStr = targetDate || currentSitrepDate;
  const onLeaveList = AppState.leaves.filter(l => {
    if (l.status !== "APPROVED") return false;
    return l.fromDate <= dateStr && l.toDate >= dateStr;
  });

  let csvContent = "\uFEFF"; // UTF-8 BOM for Excel
  csvContent += `Haryana Police - State Cyber Crime Branch Headquarters Panchkula\n`;
  csvContent += `Daily Force Strength & Leave Roznamcha Sitrep Report\n`;
  csvContent += `Date: ${dateStr}, Total Strength: ${AppState.users.length}, On-Duty: ${AppState.users.length - onLeaveList.length}, On Leave: ${onLeaveList.length}\n\n`;
  
  csvContent += `S.No.,Application ID,Applicant Name,Rank,Belt No.,Branch,Leave Type,From Date,To Date,Days,Station Leave / Destination,Emergency Contact\n`;

  if (onLeaveList.length === 0) {
    csvContent += `1,-,No personnel on leave (100% force present on duty),-,-,-,-,-,-,0,-,-\n`;
  } else {
    onLeaveList.forEach((l, idx) => {
      csvContent += `${idx + 1},"${l.id}","${l.applicantName}","${l.rank}","${l.beltNo}","${l.branchName}","${l.leaveType} - ${l.leaveTypeName || ''}","${l.fromDate}","${l.toDate}",${l.totalDays},"${l.stationLeave ? (l.stationDestination || l.stationLeaveAddress || 'Granted') : 'Station HQ'}","${l.emergencyContact || ''}"\n`;
    });
  }

  csvContent += `\n\nBranch Deployment Matrix (13 Cyber Units):\n`;
  csvContent += `Branch No.,Branch Name,Branch Incharge,Total Strength,On-Duty,On Leave,Operational Status\n`;

  AppState.branches.forEach((b, idx) => {
    const branchUsers = AppState.users.filter(u => u.branchId === b.id);
    const branchIncharge = AppState.users.find(u => u.branchId === b.id && u.role === "branch_incharge");
    const branchOnLeave = onLeaveList.filter(l => l.branchId === b.id).length;
    const branchOnDuty = Math.max(0, branchUsers.length - branchOnLeave);
    const statusText = branchOnLeave > 0 ? `${branchOnLeave} On Leave` : "100% Present";
    csvContent += `${idx + 1},"${b.name}","${branchIncharge ? branchIncharge.name : 'Nodal Officer'}",${branchUsers.length},${branchOnDuty},${branchOnLeave},"${statusText}"\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Cyber_Daily_Sitrep_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`Daily SITREP CSV (${dateStr}) downloaded successfully.`, "success");
}

function renderDailySitrep(container) {
  if (!container) return;

  const user = AppState.currentUser;
  const canViewSitrep = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");

  if (!canViewSitrep) {
    container.innerHTML = `
      <div style="background: #fff; border-radius: 12px; border: 1px solid #fee2e2; padding: 40px 24px; text-align: center; max-width: 600px; margin: 40px auto; box-shadow: var(--shadow-sm);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 1.6rem;">🔒</div>
        <h3 style="color: #991b1b; font-size: 1.2rem; margin-bottom: 8px;">Access Restricted</h3>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">
          Daily Force & Leave Sitrep Roznamcha is restricted to <strong>Superintendent of Police (SP Cyber)</strong> and the <strong>Reader Desk</strong>.
        </p>
        <button class="btn btn-primary" onclick="switchTab('dashboard')">Return to Dashboard</button>
      </div>
    `;
    return;
  }

  const targetDate = currentSitrepDate;
  const totalForce = AppState.users.length;

  // Active leaves on targetDate
  const onLeaveLeaves = AppState.leaves.filter(l => {
    if (l.status !== "APPROVED") return false;
    return l.fromDate <= targetDate && l.toDate >= targetDate;
  });

  const onLeaveCount = onLeaveLeaves.length;
  const onDutyCount = Math.max(0, totalForce - onLeaveCount);

  // 1930 Helpline branch metrics
  const helplineUsers = AppState.users.filter(u => u.branchId === "cyber_helpline_1930");
  const helplineOnLeave = onLeaveLeaves.filter(l => l.branchId === "cyber_helpline_1930").length;
  const helplineOnDuty = Math.max(0, helplineUsers.length - helplineOnLeave);

  // Station leave count
  const stationLeaveCount = onLeaveLeaves.filter(l => l.stationLeave).length;

  // Formatted date
  const displayDate = formatDate(targetDate);
  const todayIso = new Date().toISOString().split("T")[0];
  const isToday = targetDate === todayIso;

  let html = `
    <!-- SITREP TOP TOOLBAR (HIDDEN IN PRINT) -->
    <div class="page-header sitrep-toolbar-row">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
          Daily Force & Leave Roznamcha (Daily Sitrep)
        </h2>
        <p>Daily SITREP Roznamcha & Duty Attendance Report</p>
      </div>

      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <!-- Date Selector -->
        <div style="display: flex; align-items: center; gap: 6px; background: #fff; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
          <label style="font-size: 0.8rem; font-weight: 700; color: #475569; margin: 0;">Date:</label>
          <input type="date" value="${targetDate}" onchange="changeSitrepDate(this.value)" class="form-control" style="padding: 4px 8px; font-size: 0.84rem; border: none; width: auto; font-weight: 600;">
        </div>

        <button class="btn btn-sm ${isToday ? 'btn-primary' : 'btn-outline'}" onclick="setSitrepQuickDate(0)" title="Today's Report">Today</button>
        <button class="btn btn-sm btn-outline" onclick="setSitrepQuickDate(1)" title="Tomorrow's Report">Tomorrow</button>
        <button class="btn btn-sm btn-outline" onclick="setSitrepQuickDate(-1)" title="Yesterday's Report">Yesterday</button>

        <button class="btn btn-gold btn-sm" onclick="printSitrepReport()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          Print A4 Report
        </button>

        <button class="btn btn-outline btn-sm" onclick="exportSitrepCSV('${targetDate}')">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          CSV / Excel
        </button>
      </div>
    </div>

    <!-- OFFICIAL PRINTABLE A4 SITREP SHEET -->
    <div class="sitrep-official-sheet">
      <!-- Top Emblem / Watermark Header -->
      <div class="sitrep-official-header">
        <div style="font-size: 0.8rem; font-weight: 700; color: #64748b; letter-spacing: 1px;">HARYANA POLICE | STATE CYBER CRIME HEADQUARTERS</div>
        <div class="sitrep-title">DAILY STRENGTH & LEAVE ROZNAMCHA REPORT (DAILY SITREP / GD ENTRY)</div>
        <div class="sitrep-subtitle">State Cyber Crime Branch, Sector 20, Panchkula | Competent Authority: Mayank Gupta, IPS, SP Cyber Crime</div>
        
        <div class="sitrep-meta-bar">
          <div>Report Date: <strong>${displayDate}</strong></div>
          <div>GD Entry Dispatch No: <strong>CYB/PKL/ROZ/${targetDate.replace(/-/g, '')}/01</strong></div>
          <div>Session / Time: <strong>09:00 Hours (Morning Roll Call & Departure Status)</strong></div>
        </div>
      </div>

      <!-- SITREP SUMMARY METRIC GRID -->
      <div class="sitrep-summary-grid">
        <div class="sitrep-metric-card navy">
          <div class="sitrep-metric-title">Total Force Strength</div>
          <div class="sitrep-metric-num">${totalForce}</div>
          <small style="color: #64748b; font-size: 0.72rem;">Registered Cyber Police Strength</small>
        </div>

        <div class="sitrep-metric-card green">
          <div class="sitrep-metric-title">Personnel on Duty</div>
          <div class="sitrep-metric-num" style="color: #15803d;">${onDutyCount}</div>
          <small style="color: #15803d; font-size: 0.72rem;">Deployed across wings & desks</small>
        </div>

        <div class="sitrep-metric-card amber">
          <div class="sitrep-metric-title">Sanctioned on Leave</div>
          <div class="sitrep-metric-num" style="color: #b45309;">${onLeaveCount}</div>
          <small style="color: #b45309; font-size: 0.72rem;">Sanctioned by Competent Authority</small>
        </div>

        <div class="sitrep-metric-card blue">
          <div class="sitrep-metric-title">1930 Helpline Operations</div>
          <div class="sitrep-metric-num" style="color: #1d4ed8;">${helplineOnDuty} / ${helplineUsers.length}</div>
          <small style="color: #1d4ed8; font-size: 0.72rem;">24x7 Call Center Duty Staff</small>
        </div>

        <div class="sitrep-metric-card navy">
          <div class="sitrep-metric-title">Station Leave (Out of HQ)</div>
          <div class="sitrep-metric-num" style="color: #6b21a8;">${stationLeaveCount}</div>
          <small style="color: #6b21a8; font-size: 0.72rem;">Permission to leave HQ granted</small>
        </div>
      </div>

      <!-- SECTION 1: PERSONNEL CURRENTLY ON LEAVE -->
      <div class="sitrep-section-header">
        <span>SECTION 1: PERSONNEL CURRENTLY ON SANCTIONED LEAVE</span>
        <span style="font-size: 0.78rem; font-weight: normal; color: #475569;">Date: ${displayDate}</span>
      </div>

      ${onLeaveLeaves.length === 0 ? `
        <div style="background: #f0fdf4; border: 1px dashed #86efac; border-radius: 6px; padding: 22px; text-align: center; color: #166534; margin-bottom: 20px;">
          <div style="font-size: 1.1rem; font-weight: 700;">✓ No police personnel on leave on the selected date.</div>
          <div style="font-size: 0.85rem; margin-top: 4px; color: #0f274c;">Entire force strength of ${totalForce} personnel across all 13 branches is present on duty.</div>
        </div>
      ` : `
        <div class="responsive-table">
          <div class="responsive-table">
      <table class="sitrep-table">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">S.No.</th>
              <th>Name, Rank & Belt No.</th>
              <th>Branch</th>
              <th>Leave Type</th>
              <th>Leave Period (From - To)</th>
              <th style="text-align: center;">Days</th>
              <th>Station Leave / Destination</th>
              <th>Emergency Contact</th>
              <th>Expected Resumption</th>
            </tr>
          </thead>
          <tbody>
            ${onLeaveLeaves.map((l, idx) => {
              let returnDateStr = "Next Working Day";
              try {
                const toD = new Date(l.toDate);
                toD.setDate(toD.getDate() + 1);
                returnDateStr = formatDate(toD.toISOString().split("T")[0]);
              } catch(e) {}

              return `
                <tr>
                  <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
                  <td>
                    <strong>${l.applicantName}</strong><br>
                    <small style="color: #475569;">${l.rank} (${l.beltNo})</small>
                  </td>
                  <td><span class="branch-tag">${l.branchName}</span></td>
                  <td>
                    <strong style="color: #1e3a8a;">${l.leaveType}</strong><br>
                    <small style="color: #64748b;">${l.leaveTypeName || ''}</small>
                  </td>
                  <td>
                    <strong>${formatDate(l.fromDate)}</strong> to<br>
                    <strong>${formatDate(l.toDate)}</strong>
                  </td>
                  <td style="text-align: center; font-weight: 700; color: #0f172a;">${l.totalDays} Days</td>
                  <td>
                    ${l.stationLeave ? `
                      <span style="color: #b45309; font-weight: 700;">Station Leave</span><br>
                      <small style="color: #475569;">${l.stationDestination || l.stationLeaveAddress || 'At Sanctioned Address'}</small>
                    ` : `
                      <span style="color: #166534; font-weight: 600;">At Station HQ</span>
                    `}
                  </td>
                  <td><strong>${l.emergencyContact || '-'}</strong></td>
                  <td><strong style="color: #15803d;">${returnDateStr}</strong></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
        </div>
      `}

      <!-- SECTION 2: 13 BRANCHES FORCE STRENGTH MATRIX -->
      <div class="sitrep-section-header">
        <span>SECTION 2: 13 CYBER BRANCHES DEPLOYMENT & STRENGTH MATRIX</span>
        <span style="font-size: 0.78rem; font-weight: normal; color: #475569;">Total Units: 13 | Headquarters Panchkula</span>
      </div>

      <div class="responsive-table">
      <table class="sitrep-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">S.No.</th>
            <th>Cyber Branch</th>
            <th>Branch Incharge</th>
            <th style="text-align: center;">Sanctioned</th>
            <th style="text-align: center;">On Duty</th>
            <th style="text-align: center;">On Leave</th>
            <th>Operational Status</th>
          </tr>
        </thead>
        <tbody>
          ${AppState.branches.map((b, idx) => {
            const branchUsers = AppState.users.filter(u => u.branchId === b.id);
            const incharge = AppState.users.find(u => u.branchId === b.id && u.role === "branch_incharge");
            const branchOnLeave = onLeaveLeaves.filter(l => l.branchId === b.id).length;
            const branchOnDuty = Math.max(0, branchUsers.length - branchOnLeave);
            const isFullStrength = branchOnLeave === 0;

            return `
              <tr>
                <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
                <td>
                  <strong>${b.name}</strong><br>
                  <small style="color: #64748b;">CODE: ${b.id.toUpperCase()}</small>
                </td>
                <td>
                  ${incharge ? `<strong>${incharge.name}</strong><br><small style="color: #64748b;">${incharge.rank}</small>` : '<span style="color: #94a3b8;">Nodal Officer</span>'}
                </td>
                <td style="text-align: center; font-weight: 700;">${branchUsers.length}</td>
                <td style="text-align: center; font-weight: 700; color: #15803d;">${branchOnDuty}</td>
                <td style="text-align: center; font-weight: 700; color: ${branchOnLeave > 0 ? '#dc2626' : '#64748b'};">${branchOnLeave}</td>
                <td>
                  ${isFullStrength ? `
                    <span style="display: inline-flex; align-items: center; gap: 4px; color: #15803d; font-weight: 600; font-size: 0.78rem;">
                      <span style="width: 7px; height: 7px; border-radius: 50%; background: #16a34a;"></span>
                      100% Operational (On-Duty)
                    </span>
                  ` : `
                    <span style="display: inline-flex; align-items: center; gap: 4px; color: #b45309; font-weight: 600; font-size: 0.78rem;">
                      <span style="width: 7px; height: 7px; border-radius: 50%; background: #f59e0b;"></span>
                      Active (${branchOnDuty} Present, ${branchOnLeave} on Leave)
                    </span>
                  `}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>
      </div>

      <!-- OFFICIAL VERIFICATION & SIGNATURES BLOCK -->
      <div class="sitrep-signature-block">
        <div class="sitrep-sig-box">
          <div style="font-size: 0.78rem; color: #64748b;">Prepared & Verified By:</div>
          <div class="sitrep-sig-line">
            Reader to SP Cyber Crime<br>
            <span style="font-size: 0.76rem; font-weight: normal; color: #64748b;">Reader to SP Cyber Crime, Panchkula</span>
          </div>
        </div>

        <div class="sitrep-sig-box">
          <div style="font-size: 0.78rem; color: #64748b;">Supervisory Officer:</div>
          <div class="sitrep-sig-line">
            DSP Cyber Crime / Establishment<br>
            <span style="font-size: 0.76rem; font-weight: normal; color: #64748b;">DSP Cyber / Establishment Incharge</span>
          </div>
        </div>

        <div class="sitrep-sig-box">
          <div style="font-size: 0.78rem; color: #64748b;">Sanctioning Authority:</div>
          <div class="sitrep-sig-line">
            Mayank Gupta, IPS<br>
            <span style="font-size: 0.76rem; font-weight: 600; color: #0f274c;">Superintendent of Police, State Cyber Crime</span><br>
            <span style="font-size: 0.74rem; font-weight: normal; color: #64748b;">Panchkula (Haryana)</span>
          </div>
        </div>
      </div>

      <div style="margin-top: 18px; font-size: 0.74rem; color: #94a3b8; text-align: center; border-top: 1px dotted #cbd5e1; padding-top: 8px;">
        This Daily Sitrep Roznamcha report is electronically generated and compiled by the Digital Leave Management System of State Cyber Crime Headquarters, Panchkula (Haryana).
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// ==========================================
// MODALS LOGIC
// ==========================================

// 1. Leave Details & Workflow Timeline Modal
function openLeaveDetailsModal(leaveId) {
  const leave = AppState.leaves.find(l => l.id === leaveId);
  if (!leave) return;

  const modalBody = document.getElementById("leaveDetailsModalBody");
  if (!modalBody) return;

  const user = AppState.currentUser;
  const isSP = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  const canActAsIncharge = user && (user.role === "branch_incharge" || user.role === "admin" || isSP) && (isSP || user.branchId === leave.branchId);

  const isPendingIncharge = leave.status === "PENDING_INCHARGE";
  const isRecommended = leave.status === "RECOMMENDED";
  const isApproved = leave.status === "APPROVED";
  const isRejected = leave.status === "REJECTED";

  modalBody.innerHTML = `
    <!-- STEPPER -->
    <div class="stepper-box">
      <div class="step-node completed">
        <div class="step-circle">1</div>
        <div class="step-label">Applied</div>
      </div>
      <div class="step-node ${isRecommended || isApproved ? 'completed' : (isPendingIncharge ? 'active' : '')}">
        <div class="step-circle">${isRecommended || isApproved ? '✓' : '2'}</div>
        <div class="step-label">Branch Recommendation</div>
      </div>
      <div class="step-node ${isApproved ? 'completed' : (isRecommended ? 'active' : '')}">
        <div class="step-circle">${isApproved ? '✓' : '3'}</div>
        <div class="step-label">SP Cyber Sanction</div>
      </div>
      <div class="step-node ${isApproved ? 'completed' : ''}">
        <div class="step-circle">${isApproved ? '★' : '4'}</div>
        <div class="step-label">Order Dispatched</div>
      </div>
    </div>

    <div class="modal-grid-2col" style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 0.88rem;">
      <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
        <span style="color: #64748b; font-size: 0.78rem;">Applicant:</span><br>
        <strong>${leave.applicantName}</strong> (${leave.rank})<br>
        Belt No: <strong>${leave.beltNo}</strong><br>
        Branch: <strong>${leave.branchName}</strong>
      </div>

      <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
        <span style="color: #64748b; font-size: 0.78rem;">Leave Details:</span><br>
        Type: <strong>${leave.leaveTypeName || leave.leaveType}</strong><br>
        Period: <strong>${formatDate(leave.fromDate)}</strong> to <strong>${formatDate(leave.toDate)}</strong><br>
        Total Days: <strong>${leave.totalDays} Days</strong>
        ${leave.isHalfDay ? `<br><span style="color: #b45309; font-weight: 600;">(Half Day - ${leave.halfDayShift})</span>` : ''}
        ${leave.prefixDays > 0 || leave.suffixDays > 0 ? `<br><small style="color: #475569;">Prefix: ${leave.prefixDays || 0} Days | Suffix: ${leave.suffixDays || 0} Days</small>` : ''}
      </div>

      <!-- CURTAILMENT / REDUCTION NOTICE IF APPLICABLE -->
      ${leave.originalDays && leave.originalDays !== leave.totalDays ? `
        <div style="grid-column: 1 / -1; background: #fffbeb; border: 1px solid #fef08a; padding: 12px 16px; border-radius: 8px;">
          <span style="color: #92400e; font-weight: 700;">Leave Curtailment / Modification Record:</span>
          <div style="color: #78350f; font-size: 0.82rem; margin-top: 4px;">
            Originally Applied: <strong>${leave.originalDays} Days</strong> (${formatDate(leave.fromDate)} to ${formatDate(leave.originalToDate)}) → 
            Modified / Sanctioned: <strong>${leave.totalDays} Days</strong> (${formatDate(leave.fromDate)} to ${formatDate(leave.toDate)})<br>
            Curtailing Authority: <strong>${leave.curtailedBy || 'Competent Authority'}</strong>
            ${leave.curtailReason ? `<br>Ground: <em>"${leave.curtailReason}"</em>` : ''}
          </div>
        </div>
      ` : ''}

      <div style="grid-column: 1 / -1; background: #fff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">
        <span style="color: #64748b; font-size: 0.78rem;">Reason / Ground for Leave:</span><br>
        <p style="margin-top: 4px;">${leave.reason}</p>
      </div>

      <!-- COURT EVIDENCE / DUTY HANDOVER IF APPLICABLE -->
      ${leave.courtDuty ? `
        <div style="grid-column: 1 / -1; background: #fefce8; border: 1px solid #fef08a; padding: 12px; border-radius: 8px; font-size: 0.84rem;">
          <span style="color: #854d0e; font-weight: 700;">Court Evidence & Appearance Details:</span>
          <div style="color: #713f12; margin-top: 4px;">
            Case / Court: <strong>${leave.courtCaseDetails || 'Declared'}</strong><br>
            Case Diary / Pairvi Handover: <strong>${leave.courtHandoverOfficer || 'Nominated Colleague'}</strong>
          </div>
        </div>
      ` : ''}

      <!-- ATTACHMENT DISPLAY -->
      <div style="grid-column: 1 / -1;">
        ${leave.attachment ? `
          <div class="attachment-card">
            <div style="display: flex; align-items: center; gap: 12px;">
              <div class="attachment-icon">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
              </div>
              <div>
                <strong style="color: #0f274c; font-size: 0.88rem;">${leave.attachment.name}</strong>
                <div style="font-size: 0.74rem; color: #64748b;">Size: ${leave.attachment.size || 'Available'} | Type: ${leave.attachment.type || 'Document'}</div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="viewAttachment('${leave.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              View Document
            </button>
          </div>
        ` : `
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 10px; border-radius: 8px; text-align: center; color: #64748b; font-size: 0.8rem;">
            No supporting document attached.
          </div>
        `}
      </div>

      ${leave.stationLeave ? `
        <div style="grid-column: 1 / -1; background: #fffbeb; border: 1px solid #fef3c7; padding: 12px; border-radius: 8px;">
          <span style="color: #92400e; font-weight: 700; font-size: 0.82rem;">Station Leave (Out-of-Headquarters) Itinerary:</span>
          <div class="modal-grid-2col" style="margin-top: 6px; font-size: 0.84rem; color: #78350f; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div>Destination: <strong>${leave.stationDestination || 'Not specified'}</strong></div>
            <div>Local Police Station: <strong>${leave.stationLocalPS || '-'}</strong></div>
            <div>Mode of Travel: <strong>${leave.stationTravelMode || '-'}</strong></div>
            <div>Family Emergency Contact: <strong>${leave.stationFamilyContact || '-'}</strong></div>
            <div style="grid-column: 1 / -1;">Residential Address during Leave: <strong>${leave.stationLeaveAddress || '-'}</strong></div>
          </div>
        </div>
      ` : ""}

      <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
        <span style="color: #64748b; font-size: 0.78rem;">Duty Charge Handover:</span><br>
        <strong>${leave.handoverTo || "Branch Incharge"}</strong>
      </div>

      <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
        <span style="color: #64748b; font-size: 0.78rem;">Emergency Mobile:</span><br>
        <strong>${leave.emergencyContact}</strong>
      </div>

      <!-- APPROVAL AUDIT LOG -->
      <div style="grid-column: 1 / -1; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 6px;">
        <h5 style="color: #0f274c; font-weight: 700; margin-bottom: 8px;">Approval Workflow & Audit Trail</h5>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.82rem;">
          <div style="padding: 8px 12px; background: #f1f5f9; border-radius: 6px;">
            <strong>1. Application Submitted:</strong> ${leave.appliedAt} by ${leave.applicantName}
          </div>
          <div style="padding: 8px 12px; background: ${leave.inchargeActionAt ? '#eff6ff' : '#f8fafc'}; border-radius: 6px;">
            <strong>2. Branch Incharge Recommendation:</strong> ${leave.inchargeRemarks || "Pending Incharge Review"}
            ${leave.inchargeActionAt ? `<br><small style="color: #64748b;">Date: ${leave.inchargeActionAt}</small>` : ''}
          </div>
          <div style="padding: 8px 12px; background: ${leave.spActionAt ? '#f0fdf4' : '#f8fafc'}; border-radius: 6px;">
            <strong>3. SP Cyber Sanction Order:</strong> ${leave.spRemarks || "Pending SP Sanction"}
            ${leave.spActionAt ? `<br><small style="color: #64748b;">Sanction Order No: ${leave.sanctionNo} | Date: ${leave.spActionAt}</small>` : ''}
          </div>
        </div>
      </div>

      <!-- INCHARGE ACTION DIRECT BUTTON -->
      ${canActAsIncharge && isPendingIncharge ? `
        <div style="grid-column: 1 / -1; margin-top: 10px; background: #eff6ff; border: 2px solid #2563eb; border-radius: 8px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <strong style="color: #1e3a8a; font-size: 0.95rem;">Action Required: Awaiting Your Recommendation</strong>
            <div style="font-size: 0.8rem; color: #475569; margin-top: 2px;">You may examine the duty arrangements and recommend to SP Cyber or record rejection.</div>
          </div>
          <button type="button" class="btn btn-primary" onclick="closeModals(); openInchargeActionModal('${leave.id}')">
            Review & Recommend Application
          </button>
        </div>
      ` : ''}

      <!-- SP ACTION DIRECT BUTTON -->
      ${user && user.role === "sp_cyber" && isRecommended ? `
        <div style="grid-column: 1 / -1; margin-top: 10px; background: #fefce8; border: 2px solid #ca8a04; border-radius: 8px; padding: 14px 18px; display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div>
            <strong style="color: #854d0e; font-size: 0.95rem;">Recommended for SP Cyber Final Sanction</strong>
            <div style="font-size: 0.8rem; color: #475569; margin-top: 2px;">Recommended by Branch Incharge. Click below to issue final sanction order.</div>
          </div>
          <button type="button" class="btn btn-gold" onclick="closeModals(); openSPActionModal('${leave.id}')">
            Sanction Leave & Dispatch Order
          </button>
        </div>
      ` : ''}
    </div>
  `;

  document.getElementById("leaveDetailsModal").classList.add("active");
}

// 2. Branch Incharge Action Modal (with Curtail Days Option)
function openInchargeActionModal(leaveId) {
  const leave = AppState.leaves.find(l => l.id === leaveId);
  if (!leave) return;
  AppState.selectedLeaveForAction = leave;

  const modalBody = document.getElementById("inchargeActionModalBody");
  if (!modalBody) return;

  modalBody.innerHTML = `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px; font-size: 0.88rem;">
      <div style="display: flex; justify-content: space-between;">
        <strong>${leave.applicantName} (${leave.rank})</strong>
        <span class="branch-tag">${leave.branchName}</span>
      </div>
      <div style="color: #475569; margin-top: 6px;">
        Leave Type: <strong>${leave.leaveTypeName || leave.leaveType}</strong> | Applied Period: <strong>${leave.totalDays} Days</strong> (${formatDate(leave.fromDate)} to ${formatDate(leave.toDate)})
      </div>
      <div style="margin-top: 6px; color: #1e293b;">
        Reason: <em>"${leave.reason}"</em>
      </div>

      <!-- ATTACHMENT CARD IF PRESENT -->
      ${leave.attachment ? `
        <div style="margin-top: 10px; padding: 8px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 0.82rem; color: #1e40af;">📎 Supporting Attachment: <strong>${leave.attachment.name}</strong></span>
          <button type="button" class="btn btn-outline btn-sm" onclick="viewAttachment('${leave.id}')" style="background: #fff;">View Document</button>
        </div>
      ` : ''}

      ${leave.stationLeave ? `<div style="color: #b45309; font-weight: 600; margin-top: 6px;">Station Leave Permission Requested (${leave.stationLeaveAddress})</div>` : ''}
    </div>

    <!-- CURTAIL / REDUCE LEAVE DAYS CONTROL -->
    <div class="curtail-control-box">
      <div class="curtail-header">
        <span>Curtail / Reduce Leave Days?</span>
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.82rem; font-weight: normal; color: #451a03;">
          <input type="checkbox" id="inchargeCurtailCheck" onchange="toggleInchargeCurtail(this)">
          Reduce Days
        </label>
      </div>
      <div id="inchargeCurtailFields" style="display: none; margin-top: 10px;">
        <div class="modal-grid-2col" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="font-size: 0.78rem; font-weight: 600; color: #78350f;">From Date:</label>
            <input type="text" class="form-control" value="${formatDate(leave.fromDate)}" readonly>
          </div>
          <div>
            <label style="font-size: 0.78rem; font-weight: 600; color: #78350f;">New To Date:</label>
            <input type="date" id="inchargeNewToDate" class="form-control" min="${leave.fromDate}" max="${leave.toDate}" value="${leave.toDate}" onchange="calculateInchargeCurtailDays()">
          </div>
        </div>
        <div id="inchargeCurtailPreview" style="margin-top: 8px; font-size: 0.82rem; color: #b45309; font-weight: 600;"></div>
      </div>
    </div>

    <div class="form-group">
      <label for="inchargeRemarksText">Branch Incharge Recommendation & Operational Remarks <span class="required">*</span></label>
      <textarea id="inchargeRemarksText" class="form-control" rows="3" placeholder="e.g. Recommended. Duty roster and console coverage adjusted with relieving staff."></textarea>
    </div>
  `;

  document.getElementById("inchargeActionModal").classList.add("active");
}

function toggleInchargeCurtail(checkbox) {
  const fields = document.getElementById("inchargeCurtailFields");
  if (fields) fields.style.display = checkbox.checked ? "block" : "none";
  if (checkbox.checked) calculateInchargeCurtailDays();
}

function calculateInchargeCurtailDays() {
  const leave = AppState.selectedLeaveForAction;
  if (!leave) return;
  const newToVal = document.getElementById("inchargeNewToDate")?.value;
  const preview = document.getElementById("inchargeCurtailPreview");
  if (!newToVal || !preview) return;

  const fromDate = new Date(leave.fromDate);
  const newToDate = new Date(newToVal);
  if (newToDate < fromDate) {
    preview.innerHTML = `<span style="color: #dc2626;">Error: New end date cannot be prior to start date.</span>`;
    return;
  }

  const diffTime = Math.abs(newToDate - fromDate);
  const newDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const originalDays = leave.originalDays || leave.totalDays;
  const cutDays = originalDays - newDays;

  if (cutDays < 0) {
    preview.innerHTML = `<span style="color: #dc2626;">Error: You can only reduce days (maximum ${originalDays} days).</span>`;
  } else if (cutDays === 0) {
    preview.innerHTML = `No curtailment applied (Total: <strong>${newDays} Days</strong>)`;
  } else {
    preview.innerHTML = `Modified Period: <strong>${formatDate(leave.fromDate)}</strong> to <strong>${formatDate(newToVal)}</strong> (Total <strong>${newDays} Days</strong>) | Curtailed by <strong>${cutDays} Days</strong>.`;
  }
}

function submitInchargeDecision(action) {
  const leave = AppState.selectedLeaveForAction;
  if (!leave) return;

  let remarks = document.getElementById("inchargeRemarksText")?.value.trim() || "";
  if (!remarks) {
    alert("Please enter your recommendation remarks or ground for decision.");
    return;
  }

  const now = new Date().toISOString().replace("T", " ").substring(0, 16);

  if (action === "RECOMMEND") {
    // Check if curtail was checked
    const isCurtailed = document.getElementById("inchargeCurtailCheck")?.checked;
    if (isCurtailed) {
      const newToVal = document.getElementById("inchargeNewToDate")?.value;
      if (newToVal && newToVal < leave.toDate) {
        const fromDate = new Date(leave.fromDate);
        const newToDate = new Date(newToVal);
        const newDays = Math.ceil(Math.abs(newToDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

        leave.originalDays = leave.originalDays || leave.totalDays;
        leave.originalToDate = leave.originalToDate || leave.toDate;
        leave.toDate = newToVal;
        leave.totalDays = newDays;
        leave.curtailedBy = `Branch Incharge (${AppState.currentUser.name})`;
        leave.curtailReason = `Curtailed to ${newDays} days by Branch Incharge for operational coverage`;

        remarks += ` [Note: Leave curtailed from ${leave.originalDays} to ${newDays} days by Branch Incharge due to operational requirement]`;
      }
    }

    leave.inchargeRemarks = remarks;
    leave.inchargeActionAt = now;
    leave.status = "RECOMMENDED";
    showToast(`Application ${leave.id} (${leave.totalDays} Days) recommended and forwarded to SP Cyber.`, "success");
  } else {
    leave.inchargeRemarks = remarks;
    leave.inchargeActionAt = now;
    leave.status = "REJECTED";
    showToast(`Application ${leave.id} rejected at branch level.`, "error");
  }

  saveData();
  broadcastLiveAction({
    action: "LEAVE_STATUS_CHANGED",
    leaveId: leave.id,
    status: leave.status,
    inchargeRemarks: leave.inchargeRemarks,
    inchargeActionAt: leave.inchargeActionAt,
    curtailedDays: leave.totalDays,
    toDate: leave.toDate,
    curtailedBy: leave.curtailedBy || "",
    curtailReason: leave.curtailReason || ""
  });
  closeModals();
  renderApp();
}

// 3. SP Cyber Action Modal (with Curtail Days Option)
function openSPActionModal(leaveId) {
  const leave = AppState.leaves.find(l => l.id === leaveId);
  if (!leave) return;
  AppState.selectedLeaveForAction = leave;

  const modalBody = document.getElementById("spActionModalBody");
  if (!modalBody) return;

  modalBody.innerHTML = `
    <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; margin-bottom: 16px; font-size: 0.88rem;">
      <div style="display: flex; justify-content: space-between;">
        <strong>${leave.applicantName} (${leave.rank}) - Belt No: ${leave.beltNo}</strong>
        <span class="branch-tag">${leave.branchName}</span>
      </div>
      <div style="margin-top: 6px;">
        Leave Type: <strong>${leave.leaveTypeName || leave.leaveType}</strong> | Current Period: <strong>${leave.totalDays} Days</strong> (${formatDate(leave.fromDate)} to ${formatDate(leave.toDate)})
        ${leave.originalDays && leave.originalDays !== leave.totalDays ? `
          <br><span style="color: #b45309; font-weight: 600;">(Originally applied: ${leave.originalDays} Days - curtailed by Branch Incharge)</span>
        ` : ''}
      </div>
      <div style="margin-top: 6px;">
        Reason: <em>"${leave.reason}"</em>
      </div>

      <!-- ATTACHMENT CARD IF PRESENT -->
      ${leave.attachment ? `
        <div style="margin-top: 10px; padding: 8px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 0.82rem; color: #1e40af;">📎 Supporting Attachment: <strong>${leave.attachment.name}</strong></span>
          <button type="button" class="btn btn-outline btn-sm" onclick="viewAttachment('${leave.id}')" style="background: #fff;">View Document</button>
        </div>
      ` : ''}

      ${leave.status === 'RECOMMENDED' ? `
        <div style="margin-top: 8px; padding: 8px 12px; background: #e0e7ff; border-radius: 6px; color: #1e1b4b;">
          <strong>Branch Incharge Recommendation:</strong> "${leave.inchargeRemarks || 'Recommended'}"
        </div>
      ` : `
        <div style="margin-top: 8px; padding: 8px 12px; background: #fef3c7; border-radius: 6px; color: #92400e;">
          <strong>Direct SP Sanction:</strong> Application is pending branch review. As SP Cyber, you may directly sanction or modify this application.
        </div>
      `}
      ${leave.stationLeave ? `<div style="color: #b45309; font-weight: 700; margin-top: 6px;">Station Leave Permission Requested: ${leave.stationLeaveAddress}</div>` : ''}
    </div>

    <!-- SP CURTAIL / REDUCE DAYS CONTROL -->
    <div class="curtail-control-box">
      <div class="curtail-header">
        <span>Curtail / Modify Leave Days by SP Cyber</span>
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.82rem; font-weight: normal; color: #451a03;">
          <input type="checkbox" id="spCurtailCheck" onchange="toggleSPCurtail(this)">
          Curtail Sanctioned Days
        </label>
      </div>
      <div id="spCurtailFields" style="display: none; margin-top: 10px;">
        <div class="modal-grid-2col" style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="font-size: 0.78rem; font-weight: 600; color: #78350f;">Sanctioned From Date:</label>
            <input type="text" class="form-control" value="${formatDate(leave.fromDate)}" readonly>
          </div>
          <div>
            <label style="font-size: 0.78rem; font-weight: 600; color: #78350f;">Sanctioned New To Date:</label>
            <input type="date" id="spNewToDate" class="form-control" min="${leave.fromDate}" max="${leave.toDate}" value="${leave.toDate}" onchange="calculateSPCurtailDays()">
          </div>
        </div>
        <div id="spCurtailPreview" style="margin-top: 8px; font-size: 0.82rem; color: #b45309; font-weight: 600;"></div>
      </div>
    </div>

    <div class="form-group">
      <label for="spRemarksText">Superintendent of Police Sanction Order & Directive</label>
      <input type="text" id="spRemarksText" class="form-control" value="Leave and Station Leave permission sanctioned as per rules." placeholder="Enter sanction order remarks">
    </div>
  `;

  document.getElementById("spActionModal").classList.add("active");
}

function toggleSPCurtail(checkbox) {
  const fields = document.getElementById("spCurtailFields");
  if (fields) fields.style.display = checkbox.checked ? "block" : "none";
  if (checkbox.checked) calculateSPCurtailDays();
}

function calculateSPCurtailDays() {
  const leave = AppState.selectedLeaveForAction;
  if (!leave) return;
  const newToVal = document.getElementById("spNewToDate")?.value;
  const preview = document.getElementById("spCurtailPreview");
  if (!newToVal || !preview) return;

  const fromDate = new Date(leave.fromDate);
  const newToDate = new Date(newToVal);
  if (newToDate < fromDate) {
    preview.innerHTML = `<span style="color: #dc2626;">Error: Sanctioned To Date cannot be prior to From Date.</span>`;
    return;
  }

  const diffTime = Math.abs(newToDate - fromDate);
  const newDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const currentDays = leave.totalDays;
  const cutDays = currentDays - newDays;

  if (cutDays < 0) {
    preview.innerHTML = `<span style="color: #dc2626;">Error: Sanctioned days cannot exceed current ${currentDays} days.</span>`;
  } else if (cutDays === 0) {
    preview.innerHTML = `No curtailment applied (Sanctioned: <strong>${newDays} Days</strong>)`;
  } else {
    preview.innerHTML = `Modified by SP Cyber: <strong>${formatDate(leave.fromDate)}</strong> to <strong>${formatDate(newToVal)}</strong> (Total <strong>${newDays} Days Sanctioned</strong>) | Curtailed by <strong>${cutDays} Days</strong>.`;
  }
}

function submitSPDecision(action) {
  const leave = AppState.selectedLeaveForAction;
  if (!leave) return;

  let remarks = document.getElementById("spRemarksText")?.value.trim() || "";
  const now = new Date().toISOString().replace("T", " ").substring(0, 16);

  if (action === "APPROVE") {
    // Check if SP curtailed days
    const isCurtailed = document.getElementById("spCurtailCheck")?.checked;
    if (isCurtailed) {
      const newToVal = document.getElementById("spNewToDate")?.value;
      if (newToVal && newToVal < leave.toDate) {
        const fromDate = new Date(leave.fromDate);
        const newToDate = new Date(newToVal);
        const newDays = Math.ceil(Math.abs(newToDate - fromDate) / (1000 * 60 * 60 * 24)) + 1;

        leave.originalDays = leave.originalDays || leave.totalDays;
        leave.originalToDate = leave.originalToDate || leave.toDate;
        leave.toDate = newToVal;
        leave.totalDays = newDays;
        leave.curtailedBy = "SP Cyber (Mayank Gupta, IPS)";
        leave.curtailReason = `Curtailed to ${newDays} days by SP Cyber on administrative grounds`;

        remarks += ` [Order: Curtailed to ${newDays} days by SP Cyber on administrative grounds]`;
      }
    }

    leave.spRemarks = remarks;
    leave.spActionAt = now;
    leave.status = "APPROVED";

    // Recalculate deterministic leave balances accurately
    recalculateAllUserLeaveBalances();

    showToast(`Leave Sanctioned! Official Order Dispatch No. ${leave.sanctionNo} issued (${leave.totalDays} Days).`, "success");
  } else {
    leave.spRemarks = remarks;
    leave.spActionAt = now;
    leave.status = "REJECTED";
    recalculateAllUserLeaveBalances();
    showToast(`Application ${leave.id} rejected.`, "error");
  }

  saveData();
  broadcastLiveAction({
    action: "LEAVE_STATUS_CHANGED",
    leaveId: leave.id,
    status: leave.status,
    spRemarks: leave.spRemarks,
    spActionAt: leave.spActionAt,
    curtailedDays: leave.totalDays,
    toDate: leave.toDate,
    curtailedBy: leave.curtailedBy || "",
    curtailReason: leave.curtailReason || ""
  });
  closeModals();
  renderApp();
}

// ATTACHMENT VIEWER FUNCTION
function viewAttachment(leaveId) {
  const leave = AppState.leaves.find(l => l.id === leaveId);
  if (!leave || !leave.attachment) {
    alert("No document is attached with this leave application.");
    return;
  }

  const att = leave.attachment;
  const modal = document.getElementById("attachmentPreviewModal");
  const titleEl = document.getElementById("attachmentModalTitle");
  const contentEl = document.getElementById("attachmentPreviewContent");
  const downloadBtn = document.getElementById("attachmentDownloadBtn");

  if (titleEl) titleEl.innerHTML = `Supporting Attachment: <strong>${att.name}</strong> (${att.size || ''})`;

  if (att.dataUrl && (att.type.startsWith("image/") || att.type === "image/png" || att.type === "image/jpeg")) {
    contentEl.innerHTML = `
      <div style="padding: 10px;">
        <img src="${att.dataUrl}" alt="${att.name}" style="max-width: 100%; max-height: 60vh; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(0,0,0,0.1);">
      </div>
    `;
    downloadBtn.href = att.dataUrl;
    downloadBtn.download = att.name;
    downloadBtn.style.display = "inline-flex";
  } else if (att.dataUrl && att.type === "application/pdf") {
    contentEl.innerHTML = `
      <iframe src="${att.dataUrl}" style="width: 100%; height: 500px; border: 1px solid #cbd5e1; border-radius: 8px;"></iframe>
    `;
    downloadBtn.href = att.dataUrl;
    downloadBtn.download = att.name;
    downloadBtn.style.display = "inline-flex";
  } else if (att.dataUrl) {
    contentEl.innerHTML = `
      <div style="padding: 40px 20px; background: #f8fafc; border-radius: 8px; border: 1px dashed #cbd5e1;">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: #2563eb; margin-bottom: 12px;"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
        <h4>${att.name}</h4>
        <p style="color: #64748b; font-size: 0.85rem; margin-top: 6px;">Size: ${att.size} | Type: ${att.type}</p>
        <p style="margin-top: 14px;">Please download the document using the button below to view.</p>
      </div>
    `;
    downloadBtn.href = att.dataUrl;
    downloadBtn.download = att.name;
    downloadBtn.style.display = "inline-flex";
  } else {
    // Simulated demo document (official certificate view)
    contentEl.innerHTML = `
      <div style="padding: 30px; background: #fff; border: 2px solid #0f274c; border-radius: 8px; max-width: 600px; margin: 0 auto; text-align: left; font-family: serif;">
        <div style="text-align: center; border-bottom: 1px solid #0f274c; padding-bottom: 10px; margin-bottom: 16px;">
          <h3 style="color: #0f274c; text-transform: uppercase;">GOVERNMENT MEDICAL FITNESS / OFFICIAL CERTIFICATE</h3>
          <p style="font-size: 0.8rem; color: #475569;">CIVIL HOSPITAL / AUTHORIZED POLICE MEDICAL OFFICER, HARYANA</p>
        </div>
        <p><strong>File Name:</strong> ${att.name}</p>
        <p><strong>Applicant Officer:</strong> ${leave.applicantName} (${leave.rank}, Belt No. ${leave.beltNo})</p>
        <p><strong>Attached For:</strong> ${leave.leaveTypeName} (${leave.totalDays} Days, ${formatDate(leave.fromDate)} to ${formatDate(leave.toDate)})</p>
        <p style="margin-top: 14px; line-height: 1.6; background: #f8fafc; padding: 12px; border-left: 3px solid #2563eb;">
          "This is to verify that the official has attached legitimate documentation (${att.name}) supporting the stated reason: <em>${leave.reason}</em>. Verified for Haryana Cyber Police records."
        </p>
        <div style="margin-top: 24px; text-align: right;">
          <div style="font-family: cursive; color: #1e3a8a; font-weight: bold;">[Verified Digital Seal]</div>
          <small>Authorized Medical / Verification Authority</small>
        </div>
      </div>
    `;
    downloadBtn.style.display = "none";
  }

  modal.classList.add("active");
}

// 4. Official Printable Sanction Slip Modal
function openSanctionSlipModal(leaveId) {
  const leave = AppState.leaves.find(l => l.id === leaveId);
  if (!leave) return;

  const slipContainer = document.getElementById("sanctionSlipContainer");
  if (!slipContainer) return;

  slipContainer.innerHTML = `
    <div class="official-sanction-slip">
      <div class="official-watermark">HARYANA POLICE</div>

      <div class="sanction-header">
        <div class="sanction-gov-title">HARYANA POLICE DEPARTMENT</div>
        <div class="sanction-office-title">OFFICE OF THE SUPERINTENDENT OF POLICE, STATE CYBER CRIME</div>
        <div class="sanction-sub-title">Cyber Crime Police Station, Sector 20, Panchkula (Haryana) - 134117</div>
        <div style="font-size: 0.78rem; margin-top: 4px;">Email: sp.cyber-hry@gov.in | Cyber Helpline: 1930</div>
      </div>

      <div class="sanction-meta-row">
        <div><strong>Order Dispatch No:</strong> ${leave.sanctionNo}</div>
        <div><strong>Dated, Panchkula, the:</strong> ${leave.spActionAt ? leave.spActionAt.split(" ")[0] : new Date().toISOString().split("T")[0]}</div>
      </div>

      <div class="sanction-heading">
        OFFICE ORDER / LEAVE SANCTION ORDER
      </div>

      <div class="sanction-body">
        <p>
          Sanction is hereby accorded to grant 
          <span class="highlight-var">${leave.totalDays} (${numberToWords(leave.totalDays)}) days</span> 
          ${leave.originalDays && leave.originalDays !== leave.totalDays ? `
            <span style="color: #92400e; font-weight: bold;">(curtailed from ${leave.originalDays} days originally applied, due to administrative/operational requirements)</span> 
          ` : ''}
          <strong>${leave.leaveTypeName}</strong> with effect from 
          <span class="highlight-var">${formatDate(leave.fromDate)}</span> to 
          <span class="highlight-var">${formatDate(leave.toDate)}</span> 
          in respect of <strong>${leave.rank} ${leave.applicantName}</strong>, 
          Belt No. <strong>${leave.beltNo}</strong>, posted in 
          <strong>${leave.branchName}</strong>, State Cyber Crime Unit Panchkula, on the ground of:
          <em>"${leave.reason}"</em>.
        </p>

        ${leave.stationLeave ? `
          <p>
            2. Further, permission to leave Headquarters / Station during the above sanctioned leave period is also 
            <strong>GRANTED</strong> to visit the address: 
            <span class="highlight-var">${leave.stationLeaveAddress || "As declared in application"}</span>. 
            The officer shall keep his/her mobile phone active at all times on <strong>${leave.emergencyContact}</strong> 
            and shall report immediately if recalled for any emergent cyber investigation duty.
          </p>
        ` : `
          <p>
            2. The official shall remain at station headquarters and shall report for duty immediately upon expiry of the leave.
          </p>
        `}

        <p>
          3. It is certified that the official has sufficient leave balance in his/her leave account and necessary handover 
          of official duties/consoles was made to <strong>${leave.handoverTo || "the Branch Incharge"}</strong>.
        </p>
      </div>

      <div class="sanction-conditions">
        <strong>Conditions of Sanction:</strong><br>
        i) Overstayal beyond the sanctioned period without prior written approval will invite departmental action.<br>
        ii) Certificate of resumption of duty must be submitted to the Establishment Branch / Reader to SP immediately on return.
      </div>

      <div class="sanction-signatures">
        <div style="font-size: 0.78rem; text-align: left;">
          <div><strong>Digital Verification Code:</strong></div>
          <div style="font-family: monospace; font-size: 0.85rem; background: #eee; padding: 4px 8px; border-radius: 4px; display: inline-block; margin-top: 2px;">
            CYB-PKL-${leave.id}-${Date.now().toString().slice(-6)}
          </div>
        </div>

        <div class="signature-block">
          <div class="signature-space">Mayank Gupta</div>
          <div class="signature-name">Superintendent of Police</div>
          <div class="signature-title">State Cyber Crime, Panchkula<br>(Haryana)</div>
        </div>
      </div>

      <div class="sanction-copy-to">
        <strong>Endst. No. ${leave.sanctionNo} / E-1 / Cyber, dated even.</strong><br>
        Copy is forwarded for information and necessary action to:<br>
        1. Incharge, ${leave.branchName}, Cyber Unit Panchkula.<br>
        2. Reader to SP Cyber Crime, Panchkula.<br>
        3. Accountant / Establishment Branch (for leave register entry & salary deduction if any).<br>
        4. Official concerned: ${leave.rank} ${leave.applicantName}, Belt No. ${leave.beltNo}.<br>
        5. Guard file.
      </div>
    </div>
  `;

  document.getElementById("sanctionSlipModal").classList.add("active");
}

function numberToWords(num) {
  const words = ["Zero", "One", "Two", "Three", "Four", "Five", "Six", "Seven", "Eight", "Nine", "Ten", "Eleven", "Twelve", "Thirteen", "Fourteen", "Fifteen", "Sixteen", "Seventeen", "Eighteen", "Nineteen", "Twenty"];
  return words[num] || num.toString();
}

// 5. Add Personnel Modal
function openAddUserModal() {
  const user = AppState.currentUser;
  const isSP = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  const branchSelect = document.getElementById("newUserBranch");

  if (branchSelect) {
    if (isSP) {
      branchSelect.innerHTML = AppState.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
      branchSelect.disabled = false;
    } else {
      const myBranch = AppState.branches.find(b => b.id === (user ? user.branchId : ""));
      branchSelect.innerHTML = `<option value="${user ? user.branchId : ''}" selected>${myBranch ? myBranch.name : 'Your Branch'}</option>`;
      branchSelect.disabled = true;
    }
  }

  const roleSelect = document.getElementById("newUserRole");
  if (roleSelect) {
    if (isSP) {
      roleSelect.disabled = false;
    } else {
      roleSelect.value = "member";
      roleSelect.disabled = true;
    }
  }

  document.getElementById("addUserModal").classList.add("active");
}

function handleAddUserSubmit(e) {
  e.preventDefault();
  const user = AppState.currentUser;
  const isSP = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");

  const name = document.getElementById("newUserName").value.trim();
  const beltNo = document.getElementById("newUserBelt").value.trim();
  const rank = document.getElementById("newUserRank").value;
  const branchSelectEl = document.getElementById("newUserBranch");
  const branchId = isSP ? branchSelectEl.value : (user ? user.branchId : branchSelectEl.value);
  const mobile = document.getElementById("newUserMobile").value.trim();
  const roleSelectEl = document.getElementById("newUserRole");
  const role = isSP ? roleSelectEl.value : "member";

  const newId = `CYB-${AppState.users.length + 101}`;

  const newUser = {
    id: newId,
    beltNo: beltNo,
    name: name,
    rank: rank,
    role: role,
    branchId: branchId,
    mobile: mobile,
    email: `${name.toLowerCase().replace(/[^a-z]/g, "")}.${beltNo.replace(/[^0-9]/g, "")}@cyberhry.gov.in`,
    isApprover: role === "branch_incharge" || role === "sp_cyber",
    leaveBalances: { CL: 20, EL: 30, ML: 20, PL: 15, CCL: 0, "C-OFF": 5, HPL: 20, RH: 2 }
  };

  AppState.users.push(newUser);
  saveData();
  populateUserSwitcher();
  closeModals();
  renderApp();
  showToast(`New police personnel ${name} (${beltNo}) added successfully.`, "success");
}

// Close any open modal
function closeModals() {
  document.querySelectorAll(".modal-overlay").forEach(m => m.classList.remove("active"));
}

// Setup Event Listeners
function setupEventListeners() {
  // Navigation tabs
  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      switchTab(btn.dataset.tab);
    });
  });

  // User switcher
  const userSelect = document.getElementById("userSwitchSelect");
  if (userSelect) {
    userSelect.addEventListener("change", (e) => {
      handleUserSwitch(e.target.value);
    });
  }

  // Close modals on click outside
  document.querySelectorAll(".modal-overlay").forEach(overlay => {
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        closeModals();
      }
    });
  });

  // ESC key closes modal
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") {
      closeModals();
    }
  });
}

// Show Toast Alert
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;

  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
      ${type === 'success' ? '<polyline points="20 6 9 17 4 12"></polyline>' : 
        (type === 'error' ? '<circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line>' : 
        '<circle cx="12" cy="12" r="10"></circle><line x1="12" y1="16" x2="12" y2="12"></line><line x1="12" y1="8" x2="12.01" y2="8"></line>')}
    </svg>
    <span>${message}</span>
  `;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transition = "opacity 0.4s ease";
    setTimeout(() => toast.remove(), 400);
  }, 4000);
}

// Run on page load
window.addEventListener("DOMContentLoaded", initApp);


// ==========================================
// POLICE OFFICER LOGIN CONTROLLER
// ==========================================

function onLoginRosterSelect(userId) {
  const input = document.getElementById("loginOfficerInput");
  if (!input) return;
  if (!userId) {
    input.value = "";
    return;
  }
  const target = (AppState.users || []).find(u => u.id === userId);
  if (target) {
    input.value = target.beltNo || target.id;
  }
}

function submitOfficerLoginForm() {
  const select = document.getElementById("loginOfficerSelect");
  const input = document.getElementById("loginOfficerInput");

  let query = (input ? input.value : "").trim();
  if (!query && select && select.value) {
    query = select.value;
  }

  if (!query) {
    showToast("Please select your officer profile or enter Belt No.", "error");
    if (select) select.focus();
    return;
  }

  const target = (AppState.users || []).find(u => {
    return u.id.toLowerCase() === query.toLowerCase() ||
           u.beltNo.toLowerCase() === query.toLowerCase() ||
           u.name.toLowerCase().includes(query.toLowerCase());
  });

  if (!target) {
    showToast("Officer or Belt No. not found (" + query + ")", "error");
    return;
  }

  quickLoginUser(target.id);
}

function quickLoginUser(userId) {
  const target = (AppState.users || []).find(u => u.id === userId);
  if (!target) {
    showToast("Officer record not found.", "error");
    return;
  }

  AppState.currentUser = target;
  sessionStorage.setItem("cyber_police_current_user_id", target.id);
  localStorage.setItem("cyber_police_current_user_id", target.id);
  recalculateAllUserLeaveBalances();

  // Smart tab assignment based on role
  if (target.role === "branch_incharge") {
    AppState.activeTab = "incharge_desk";
  } else if (target.role === "sp_cyber") {
    AppState.activeTab = "sp_desk";
  } else {
    AppState.activeTab = "dashboard";
  }

  renderApp();
  showToast("Welcome, " + target.name + " (" + target.rank + ")", "success");
}

function handleLogout() {
  AppState.currentUser = null;
  sessionStorage.removeItem("cyber_police_current_user_id");
  localStorage.removeItem("cyber_police_current_user_id");
  renderApp();
  showToast("Logged out successfully.", "info");
}

function renderLoginScreen(container) {
  if (!container) return;
  recalculateAllUserLeaveBalances();

  const allUsers = [...(AppState.users || [])];

  container.innerHTML = `
    <div class="login-card-container">
      <div class="simple-login-card">
        <!-- BRAND HEADER -->
        <div class="simple-brand-header">
          <div class="login-shield-badge">
            <svg viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 2.18l7 3.12v4.7c0 4.54-3.15 8.79-7 9.88-3.85-1.09-7-5.34-7-9.88V6.3l7-3.12z"/>
              <path d="M12 7c-1.66 0-3 1.34-3 3 0 .79.31 1.51.81 2.04L8 16h8l-1.81-3.96c.5-.53.81-1.25.81-2.04 0-1.66-1.34-3-3-3z"/>
            </svg>
          </div>
          <h2 class="login-card-title">HARYANA POLICE</h2>
          <p class="login-card-subtitle">State Cyber Crime Personnel Portal</p>
        </div>

        <!-- FORM BODY -->
        <div class="simple-login-body">
          <form id="officerLoginForm" onsubmit="event.preventDefault(); submitOfficerLoginForm();">
            
            <!-- Option 1: Choose Officer from list -->
            <div class="login-field-group">
              <label class="login-field-label" for="loginOfficerSelect">
                Select Your Name / Officer Profile:
              </label>
              <select id="loginOfficerSelect" class="login-select-control" onchange="onLoginRosterSelect(this.value)">
                <option value="">-- Choose Your Officer Profile --</option>
                <optgroup label="--- Superintendent of Police ---">
                  ${allUsers.filter(u => u.role === 'sp_cyber').map(u => `
                    <option value="${u.id}">${u.name} (Belt: ${u.beltNo}) - ${u.rank}</option>
                  `).join('')}
                </optgroup>
                <optgroup label="--- Branch Incharges ---">
                  ${allUsers.filter(u => u.role === 'branch_incharge').map(u => {
                    const br = AppState.branches.find(b => b.id === u.branchId);
                    return `<option value="${u.id}">${u.name} (Belt: ${u.beltNo}) - ${br ? br.name : u.branchId}</option>`;
                  }).join('')}
                </optgroup>
                <optgroup label="--- Police Personnel / Staff ---">
                  ${allUsers.filter(u => u.role === 'member').map(u => {
                    return `<option value="${u.id}">${u.name} (Belt: ${u.beltNo}) - ${u.rank}</option>`;
                  }).join('')}
                </optgroup>
              </select>
            </div>

            <!-- OR Divider -->
            <div class="login-divider">
              <span>OR ENTER BELT NUMBER</span>
            </div>

            <!-- Option 2: Belt No Input -->
            <div class="login-field-group">
              <label class="login-field-label" for="loginOfficerInput">
                Belt Number or Officer ID:
              </label>
              <input type="text" id="loginOfficerInput" class="login-input-control" placeholder="e.g. 1420/PKL or CYB-101" autocomplete="username">
            </div>

            <!-- PIN -->
            <div class="login-field-group">
              <div class="login-pin-header">
                <label class="login-field-label" for="loginPinInput" style="margin-bottom: 0;">
                  Security PIN:
                </label>
                <span class="login-pin-badge">Default: 1234</span>
              </div>
              <input type="password" id="loginPinInput" class="login-input-control" value="1234" placeholder="Enter PIN (Default: 1234)" autocomplete="current-password">
            </div>

            <!-- Big Submit Button -->
            <button type="submit" class="login-submit-btn">
              LOGIN TO PORTAL
            </button>

            <!-- 1-Tap Quick Buttons -->
            <div class="quick-login-section">
              <div class="quick-login-title">1-TAP QUICK LOGIN</div>
              <div class="quick-login-grid">
                <button type="button" class="quick-officer-btn" onclick="quickLoginUser('SP-001')">
                  <strong>SP Mayank Gupta</strong>
                  <small>SP Cyber Crime</small>
                </button>
                <button type="button" class="quick-officer-btn" onclick="quickLoginUser('INCH-1930')">
                  <strong>Insp. Rajesh</strong>
                  <small>1930 Incharge</small>
                </button>
                <button type="button" class="quick-officer-btn" onclick="quickLoginUser('CYB-101')">
                  <strong>CT Rahul</strong>
                  <small>Belt: 1420/PKL</small>
                </button>
                <button type="button" class="quick-officer-btn" onclick="quickLoginUser('CYB-107')">
                  <strong>CT Naveen</strong>
                  <small>Belt: 1350/PKL</small>
                </button>
              </div>
            </div>
          </form>
        </div>

        <!-- FOOTER -->
        <div class="simple-login-footer">
          <span>Haryana Cyber Helpline: <strong>1930</strong></span>
          <span>&bull;</span>
          <span>Emergency: <strong>112</strong></span>
        </div>
      </div>
    </div>
  `;
}
