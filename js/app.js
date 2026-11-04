/**
 * Haryana Cyber Police - Leave Management Portal
 * Core Application Engine & Workflow Controller
 */

// Application State
const AppState = {
  users: [],
  leaves: [],
  branches: [],
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
  populateUserSwitcher();
  setupEventListeners();
  renderApp();

  // Connect to shared LAN office database in background
  syncWithOfficeDatabase();
  startLanBackgroundSync();
}

function updateSyncIndicator(isConnected, statusText) {
  const indicator = document.getElementById("lanSyncIndicator");
  const textEl = document.getElementById("syncStatusText");
  if (!indicator) return;

  if (isConnected) {
    indicator.classList.remove("offline");
    if (textEl) textEl.textContent = statusText || "ऑफिस LAN सिंक ✓";
  } else {
    indicator.classList.add("offline");
    if (textEl) textEl.textContent = statusText || "लोकल मोड (ऑफ़लाइन)";
  }
}

// Load data from localStorage or Seed Data
function loadFromLocalStorage() {
  try {
    const storedBranches = localStorage.getItem("cyber_police_branches");
    AppState.branches = storedBranches ? JSON.parse(storedBranches) : BRANCHES;

    const storedUsers = localStorage.getItem("cyber_police_users");
    AppState.users = storedUsers ? JSON.parse(storedUsers) : DEFAULT_USERS;
    const spUser = AppState.users.find(u => u.id === "SP-001" || u.role === "sp_cyber");
    if (spUser) {
      spUser.name = "Mayank Gupta, IPS";
    }

    const storedLeaves = localStorage.getItem("cyber_police_leaves");
    if (storedLeaves) {
      AppState.leaves = JSON.parse(storedLeaves);
      AppState.leaves.forEach(l => {
        if (!l.originalDays) l.originalDays = l.totalDays;
        if (!l.originalToDate) l.originalToDate = l.toDate;
        if (l.attachment === undefined) l.attachment = null;
      });
    } else {
      AppState.leaves = DEFAULT_LEAVES;
    }

    const savedUserId = localStorage.getItem("cyber_police_current_user_id");
    if (savedUserId) {
      AppState.currentUser = AppState.users.find(u => u.id === savedUserId) || AppState.users[0];
    } else {
      // Default to Constable Rahul Deswal (Member) or SP Cyber
      AppState.currentUser = AppState.users.find(u => u.id === "CYB-101") || AppState.users[0];
    }
  } catch (e) {
    console.error("Error loading data from localStorage, reverting to defaults", e);
    AppState.branches = BRANCHES;
    AppState.users = DEFAULT_USERS;
    AppState.leaves = DEFAULT_LEAVES;
    AppState.currentUser = DEFAULT_USERS[0];
  }
}

// Connect and Sync with Shared Office Database (database.json via server)
async function syncWithOfficeDatabase() {
  try {
    const res = await fetch("/api/data", { cache: "no-store" });
    if (res.ok) {
      const data = await res.json();
      if (data && data.users && data.leaves && data.branches) {
        // Shared database exists on office server, load it!
        AppState.branches = data.branches;
        AppState.users = data.users;
        AppState.leaves = data.leaves;
        isLanServerConnected = true;
        updateSyncIndicator(true, "ऑफिस LAN सिंक ✓");
        saveToLocalStorageOnly();
        populateUserSwitcher();
        renderNavigationTabs();
        renderApp();
        return;
      } else {
        // Server running but database.json not initialized yet, push initial seed data
        isLanServerConnected = true;
        updateSyncIndicator(true, "ऑफिस LAN सिंक ✓");
        await pushDataToOfficeServer();
      }
    }
  } catch (e) {
    console.log("Office server API offline or running file:// standalone", e);
    isLanServerConnected = false;
    updateSyncIndicator(false, "लोकल मोड (लोकलहोस्ट)");
  }
}

// Save data to localStorage & Push to Shared Office Database
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
  if (AppState.currentUser) {
    localStorage.setItem("cyber_police_current_user_id", AppState.currentUser.id);
  }
}

async function pushDataToOfficeServer() {
  try {
    updateSyncIndicator(true, "सिंक हो रहा है...");
    const payload = {
      branches: AppState.branches,
      users: AppState.users,
      leaves: AppState.leaves,
      updatedAt: new Date().toISOString()
    };
    const res = await fetch("/api/save", {
      method: "POST",
      headers: { "Content-Type": "application/json; charset=utf-8" },
      body: JSON.stringify(payload)
    });
    if (res.ok) {
      isLanServerConnected = true;
      updateSyncIndicator(true, "ऑफिस LAN सिंक ✓");
    }
  } catch (e) {
    console.warn("Failed to push data to office server", e);
    isLanServerConnected = false;
    updateSyncIndicator(false, "लोकल मोड");
  }
}

// Multi-computer real-time sync polling every 10 seconds
function startLanBackgroundSync() {
  if (lanSyncPollingId) clearInterval(lanSyncPollingId);
  lanSyncPollingId = setInterval(async () => {
    if (document.hidden) return; // Save resources when tab is minimized
    try {
      const res = await fetch("/api/data", { cache: "no-store" });
      if (res.ok) {
        const data = await res.json();
        if (data && data.leaves && data.users) {
          const currentLeavesJson = JSON.stringify(AppState.leaves);
          const newLeavesJson = JSON.stringify(data.leaves);
          if (currentLeavesJson !== newLeavesJson) {
            AppState.leaves = data.leaves;
            AppState.users = data.users;
            saveToLocalStorageOnly();
            renderNavigationTabs();
            // Re-render active view if on list/table tabs
            if (["dashboard", "incharge_desk", "sp_desk", "daily_sitrep", "master_register"].includes(AppState.activeTab)) {
              renderApp();
            }
          }
          isLanServerConnected = true;
          updateSyncIndicator(true, "ऑफिस LAN सिंक ✓");
        }
      }
    } catch (e) {
      isLanServerConnected = false;
      updateSyncIndicator(false, "लोकल मोड");
    }
  }, 10000);
}

// Reset Demo Data
function resetDemoData() {
  if (confirm("क्या आप सभी डेटा को डिफ़ॉल्ट डेमो डेटा पर रीसेट करना चाहते हैं?\n(Are you sure you want to reset all data to default demo state?)")) {
    localStorage.removeItem("cyber_police_branches");
    localStorage.removeItem("cyber_police_users");
    localStorage.removeItem("cyber_police_leaves");
    localStorage.removeItem("cyber_police_current_user_id");
    AppState.branches = BRANCHES;
    AppState.users = DEFAULT_USERS;
    AppState.leaves = DEFAULT_LEAVES;
    AppState.currentUser = DEFAULT_USERS[0];
    saveData();
    populateUserSwitcher();
    renderApp();
    showToast("डेटा सफलतापूर्वक रीसेट कर दिया गया (Data reset to defaults)", "success");
  }
}

// Populate the Quick User & Role Switcher
function populateUserSwitcher() {
  const select = document.getElementById("userSwitchSelect");
  if (!select) return;

  select.innerHTML = "";

  // Group by role
  const spGroup = document.createElement("optgroup");
  spGroup.label = "--- एसपी साइबर (SP Cyber - Approving Authority) ---";
  const inchargeGroup = document.createElement("optgroup");
  inchargeGroup.label = "--- शाखा प्रभारी (Branch Incharges) ---";
  const memberGroup = document.createElement("optgroup");
  memberGroup.label = "--- पुलिस सदस्य / स्टाफ (Staff / Members) ---";

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
}

// Switch Active User / Role
function handleUserSwitch(userId) {
  const user = AppState.users.find(u => u.id === userId);
  if (!user) return;
  AppState.currentUser = user;
  saveData();

  updateHeaderUserInfo();
  renderNavigationTabs();
  renderApp();

  showToast(`लॉगिन बदला गया: ${user.name} (${getRoleDisplay(user.role)})`, "info");
}

function getRoleDisplay(role) {
  switch (role) {
    case "sp_cyber": return "एसपी साइबर (Approving Authority)";
    case "branch_incharge": return "शाखा प्रभारी (Branch Incharge)";
    case "admin": return "एडमिन (Establishment/Reader)";
    default: return "पुलिस कर्मी (Staff Member)";
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
}

// Navigation Tabs Handling
function switchTab(tabId) {
  const user = AppState.currentUser;
  const isSPRole = user && (user.role === "sp_cyber");
  const isBranchIncharge = user && (user.role === "branch_incharge" || user.role === "admin");

  if (isSPRole && (tabId === "apply_leave" || tabId === "my_leaves")) {
    showToast("पुलिस अधीक्षक (SP महोदय) अंतिम स्वीकृति प्राधिकारी हैं।", "info");
    return;
  }

  if (isSPRole && tabId === "incharge_desk") {
    showToast("शाखा प्रभारी डेस्क केवल शाखा प्रभारियों हेतु है। कृपया 'एसपी साइबर स्वीकृति पटल' का उपयोग करें।", "info");
    return;
  }

  if (tabId === "incharge_desk" && !isBranchIncharge) {
    showToast("शाखा प्रभारी डेस्क केवल संबंधित शाखा प्रभारियों हेतु उपलब्ध है।", "error");
    return;
  }

  const isAuthorized = user && (user.role === "branch_incharge" || user.role === "sp_cyber" || user.role === "admin");
  if (tabId === "directory" && !isAuthorized) {
    showToast("स्टाफ डायरेक्टरी केवल शाखा प्रभारी व एसपी महोदय हेतु उपलब्ध है।", "error");
    return;
  }

  const canViewSitrep = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  if (tabId === "daily_sitrep" && !canViewSitrep) {
    showToast("दैनिक रोज़नामचा (Sitrep) केवल पुलिस अधीक्षक (SP Cyber) एवं रीडर पटल हेतु उपलब्ध है।", "error");
    return;
  }

  const canViewRegister = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  if (tabId === "master_register" && !canViewRegister) {
    showToast("मास्टर अवकाश रजिस्टर केवल पुलिस अधीक्षक (SP Cyber) एवं रीडर पटल हेतु उपलब्ध है।", "error");
    return;
  }

  AppState.activeTab = tabId;
  document.querySelectorAll(".nav-tab-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.tab === tabId);
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

  // Staff Directory visible only to Branch Incharge & SP Cyber
  const directoryTabBtn = document.getElementById("tabBtnDirectory");
  if (directoryTabBtn) {
    directoryTabBtn.style.display = canViewDirectory ? "flex" : "none";
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
  updateHeaderUserInfo();
  renderNavigationTabs();

  const container = document.getElementById("tabContentContainer");
  if (!container) return;

  switch (AppState.activeTab) {
    case "dashboard":
      renderDashboard(container);
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
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            कमांड डैशबोर्ड | ${user.name} (SP Cyber Crime, Panchkula)
          </h2>
          <p>सर्वोच्च स्वीकृति प्राधिकारी | <strong>समस्त 13 साइबर शाखाएं</strong> | स्थिति: सामान्य एवं सक्रिय</p>
        </div>
        <div style="display: flex; gap: 8px; flex-wrap: wrap;">
          <button class="btn btn-outline" onclick="switchTab('daily_sitrep')" title="दैनिक नफरी व अवकाश रोज़नामचा रिपोर्ट">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            दैनिक रोज़नामचा (Daily Sitrep)
          </button>
          <button class="btn btn-gold" onclick="switchTab('sp_desk')">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            एसपी स्वीकृति पटल खोलें (SP Approval Desk)
          </button>
        </div>
      </div>

      <!-- SP EXECUTIVE STATS CARDS -->
      <div class="stats-grid">
        <div class="stat-card gold">
          <div class="stat-header">
            <span class="stat-title">अंतिम स्वीकृति लंबित (Pending SP Approval)</span>
            <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
          </div>
          <div class="stat-number">${spPendingLeaves.length}</div>
          <div class="stat-subtext">शाखा प्रभारियों द्वारा अनुशंसित</div>
        </div>

        <div class="stat-card blue">
          <div class="stat-header">
            <span class="stat-title">शाखा प्रभारी स्तर पर (With Incharges)</span>
            <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle></svg></div>
          </div>
          <div class="stat-number">${inchargePendingCount}</div>
          <div class="stat-subtext">प्रारंभिक समीक्षाधीन आवेदन</div>
        </div>

        <div class="stat-card green">
          <div class="stat-header">
            <span class="stat-title">स्वीकृत आदेश (Total Sanctioned)</span>
            <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg></div>
          </div>
          <div class="stat-number">${unitApprovedCount}</div>
          <div class="stat-subtext">सत्र 2026 में जारी आदेश</div>
        </div>

        <div class="stat-card purple">
          <div class="stat-header">
            <span class="stat-title">साइबर नफरी स्थिति (Unit Force)</span>
            <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
          </div>
          <div class="stat-number">${onDutyCount} / ${totalForce}</div>
          <div class="stat-subtext">${currentlyOnLeave} जवान आज अवकाश पर (${onDutyCount} ऑन-ड्यूटी)</div>
        </div>
      </div>

      <!-- 13 BRANCHES SUMMARY FOR SP -->
      <div class="leave-quota-card">
        <div class="leave-quota-title">
          <span>हरियाणा साइबर पुलिस - 13 शाखाओं की वर्तमान स्थिति (13 Branches Strength & Leave Overview)</span>
          <span style="font-size: 0.8rem; font-weight: normal; color: #64748b;">पंचकूला मुख्यालय</span>
        </div>
        <div class="leave-pills-row">
          <div class="leave-pill-item">
            <div class="type-code">13</div>
            <div class="type-name">कुल शाखाएं</div>
            <div class="days-count">100%</div>
            <div class="days-label">सक्रिय शाखाएं</div>
          </div>
          <div class="leave-pill-item">
            <div class="type-code">FORCE</div>
            <div class="type-name">कुल नफरी</div>
            <div class="days-count">${totalForce}</div>
            <div class="days-label">पंजीकृत जवान</div>
          </div>
          <div class="leave-pill-item">
            <div class="type-code">DUTY</div>
            <div class="type-name">ड्यूटी पर तैनात</div>
            <div class="days-count" style="color: #15803d;">${onDutyCount}</div>
            <div class="days-label">उपस्थित नफरी</div>
          </div>
          <div class="leave-pill-item">
            <div class="type-code">LEAVE</div>
            <div class="type-name">आज अवकाश पर</div>
            <div class="days-count" style="color: #b45309;">${currentlyOnLeave}</div>
            <div class="days-label">स्वीकृत अवकाश</div>
          </div>
          <div class="leave-pill-item">
            <div class="type-code">SP-DESK</div>
            <div class="type-name">स्वीकृति लंबित</div>
            <div class="days-count" style="color: #dc2626;">${spPendingLeaves.length}</div>
            <div class="days-label">तत्काल निर्णय हेतु</div>
          </div>
        </div>
      </div>

      <!-- PENDING APPROVALS TABLE FOR SP -->
      <div class="card-table-wrap">
        <div class="table-toolbar">
          <div class="table-title">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
            अनुमोदन हेतु लंबित अवकाश आवेदन (Applications Awaiting SP Sanction)
          </div>
          <div>
            <button class="btn btn-outline btn-sm" onclick="switchTab('sp_desk')">एसपी पटल खोलें (Open SP Desk)</button>
          </div>
        </div>
        <div class="responsive-table">
          <table class="data-table">
            <thead>
              <tr>
                <th>आवेदन क्रमांक</th>
                <th>आवेदक पुलिस कर्मी</th>
                <th>प्रकार (Type)</th>
                <th>अवधि (Period)</th>
                <th>दिन (Days)</th>
                <th>दस्तावेज</th>
                <th>प्रभारी अनुशंसा (Recommendation)</th>
                <th>कार्रवाई (Action)</th>
              </tr>
            </thead>
            <tbody>
              ${spPendingLeaves.length === 0 ? `
                <tr>
                  <td colspan="8" style="text-align: center; color: #166534; padding: 28px; background: #f0fdf4;">
                    <strong>✓ वर्तमान में एसपी महोदय के स्तर पर कोई अवकाश आवेदन लंबित नहीं है।</strong><br>
                    <small style="color: #64748b;">शाखा प्रभारियों द्वारा जैसे ही किसी आवेदन की अनुशंसा की जाएगी, वह यहां स्वतः प्रदर्शित होगा।</small>
                  </td>
                </tr>
              ` : spPendingLeaves.map(leave => `
                <tr>
                  <td>
                    <strong>${leave.id}</strong><br>
                    <small style="color: #64748b;">${formatDate(leave.appliedDate)}</small>
                  </td>
                  <td>
                    <strong>${leave.applicantName}</strong><br>
                    <small style="color: #64748b;">${leave.rank} (${leave.beltNo})</small><br>
                    <span class="branch-tag">${leave.branchName}</span>
                  </td>
                  <td>
                    <span style="font-weight: 700; color: #1e3a8a;">${leave.leaveType}</span><br>
                    <small style="color: #64748b;">${leave.leaveTypeName}</small>
                  </td>
                  <td>
                    ${formatDate(leave.fromDate)} से<br>${formatDate(leave.toDate)}
                    ${leave.stationLeave ? `<br><small style="color: #b45309; font-weight: 600;">★ स्टेशन लीव</small>` : ''}
                  </td>
                  <td>
                    <span style="font-size: 1.1rem; font-weight: 700; color: #0f172a;">${leave.totalDays} दिन</span>
                    ${leave.originalDays && leave.originalDays !== leave.totalDays ? `
                      <br><small style="color: #b45309; font-weight: 600;">(मूल: ${leave.originalDays} दिन)</small>
                    ` : ''}
                  </td>
                  <td>
                    ${leave.attachment ? `
                      <button class="attachment-chip" onclick="viewAttachment('${leave.id}')" title="${leave.attachment.name}">
                        📎 संलग्नक
                      </button>
                    ` : `<span style="color: #94a3b8; font-size: 0.8rem;">-</span>`}
                  </td>
                  <td>
                    <em style="color: #0369a1; font-size: 0.85rem;">"${leave.inchargeRemarks || 'अग्रेषित'}"</em><br>
                    <small style="color: #64748b;">संस्तुतकर्ता: ${leave.inchargeName || 'प्रभारी'}</small>
                  </td>
                  <td>
                    <div style="display: flex; gap: 6px;">
                      <button class="btn btn-gold btn-sm" onclick="openSPActionModal('${leave.id}')">
                        समीक्षा / स्वीकृति
                      </button>
                      <button class="btn btn-outline btn-sm" onclick="openLeaveDetailsModal('${leave.id}')">
                        विवरण
                      </button>
                    </div>
                  </td>
                </tr>
              `).join("")}
            </tbody>
          </table>
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

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"></path><polyline points="9 22 9 12 15 12 15 22"></polyline></svg>
          डैशबोर्ड | Welcome, ${user.name} (${user.beltNo})
        </h2>
        <p>शाखा: <strong>${branchName}</strong> | पद: <strong>${user.rank}</strong> | प्रणाली स्थिति: सामान्य एवं सक्रिय</p>
      </div>
      <div style="display: flex; gap: 8px; flex-wrap: wrap;">
        ${isReaderUser ? `
          <button class="btn btn-outline" onclick="switchTab('daily_sitrep')" title="दैनिक नफरी व अवकाश रोज़नामचा रिपोर्ट">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg>
            दैनिक रोज़नामचा (Daily Sitrep)
          </button>
        ` : ''}
        <button class="btn btn-gold" onclick="switchTab('apply_leave')">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          छुट्टी के लिए नया आवेदन करें (Apply Leave)
        </button>
      </div>
    </div>

    <!-- STATS CARDS -->
    <div class="stats-grid">
      <div class="stat-card blue">
        <div class="stat-header">
          <span class="stat-title">आकस्मिक अवकाश (CL Balance)</span>
          <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"></rect><line x1="16" y1="2" x2="16" y2="6"></line><line x1="8" y1="2" x2="8" y2="6"></line><line x1="3" y1="10" x2="21" y2="10"></line></svg></div>
        </div>
        <div class="stat-number">${user.leaveBalances?.CL ?? 0} <span style="font-size: 1rem; font-weight: normal; color: #64748b;">दिन</span></div>
        <div class="stat-subtext">कुल 20 दिन वार्षिक कोटा</div>
      </div>

      <div class="stat-card green">
        <div class="stat-header">
          <span class="stat-title">अर्जित अवकाश (EL Balance)</span>
          <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon></svg></div>
        </div>
        <div class="stat-number">${user.leaveBalances?.EL ?? 0} <span style="font-size: 1rem; font-weight: normal; color: #64748b;">दिन</span></div>
        <div class="stat-subtext">संचित प्रिविलेज अवकाश</div>
      </div>

      <div class="stat-card gold">
        <div class="stat-header">
          <span class="stat-title">प्रक्रियाधीन आवेदन (Pending)</span>
          <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
        </div>
        <div class="stat-number">${pendingLeaves.length}</div>
        <div class="stat-subtext">स्वीकृति हेतु विचाराधीन</div>
      </div>

      <div class="stat-card purple">
        <div class="stat-header">
          <span class="stat-title">साइबर नफरी (Force On-Duty)</span>
          <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg></div>
        </div>
        <div class="stat-number">${onDutyCount} / ${totalForce}</div>
        <div class="stat-subtext">${currentlyOnLeave} जवान आज अवकाश पर</div>
      </div>
    </div>

    <!-- LEAVE BALANCES OVERVIEW -->
    <div class="leave-quota-card">
      <div class="leave-quota-title">
        <span>आपके अवकाश कोटे की विस्तृत स्थिति (Leave Quota Summary for ${user.name})</span>
        <span style="font-size: 0.8rem; font-weight: normal; color: #64748b;">कैलेंडर वर्ष 2026</span>
      </div>
      <div class="leave-pills-row">
        ${LEAVE_TYPES.map(lt => {
          const bal = user.leaveBalances ? (user.leaveBalances[lt.code] ?? 0) : 0;
          return `
            <div class="leave-pill-item">
              <div class="type-code">${lt.code}</div>
              <div class="type-name">${lt.hindi}</div>
              <div class="days-count">${bal}</div>
              <div class="days-label">शेष दिन / Balance</div>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <!-- RECENT APPLICATIONS TABLE -->
    <div class="card-table-wrap">
      <div class="table-toolbar">
        <div class="table-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
          आपके हालिया अवकाश आवेदन (Recent Applications)
        </div>
        <div>
          <button class="btn btn-outline btn-sm" onclick="switchTab('my_leaves')">सभी देखें (View All)</button>
        </div>
      </div>
      <div class="responsive-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>आवेदन क्रमांक</th>
              <th>प्रकार (Type)</th>
              <th>अवधि (Period)</th>
              <th>दिन (Days)</th>
              <th>कारण (Reason)</th>
              <th>स्टेशन लीव</th>
              <th>स्थिति (Status)</th>
              <th>कार्रवाई (Action)</th>
            </tr>
          </thead>
          <tbody>
            ${userLeaves.length === 0 ? `
              <tr><td colspan="8" style="text-align: center; color: #64748b; padding: 28px;">अभी तक कोई अवकाश आवेदन दर्ज नहीं किया गया है।</td></tr>
            ` : userLeaves.slice(0, 5).map(leave => renderLeaveTableRow(leave)).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// Table row renderer
function renderLeaveTableRow(leave, showApplicantInfo = false) {
  const statusBadge = getStatusBadge(leave.status);
  const applicantInfoHtml = showApplicantInfo ? `
    <td>
      <strong>${leave.applicantName}</strong><br>
      <small style="color: #64748b;">${leave.rank} (${leave.beltNo})</small><br>
      <span class="branch-tag">${leave.branchName}</span>
    </td>
  ` : "";

  return `
    <tr>
      <td>
        <strong>${leave.id}</strong><br>
        <small style="color: #64748b;">${leave.appliedAt}</small>
      </td>
      ${applicantInfoHtml}
      <td>
        <span style="font-weight: 700; color: #0f274c;">${leave.leaveType}</span><br>
        <small style="color: #64748b;">${leave.leaveTypeName.split("(")[0]}</small>
      </td>
      <td>
        <strong>${formatDate(leave.fromDate)}</strong> से <strong>${formatDate(leave.toDate)}</strong>
      </td>
      <td>
        <span style="font-weight: 700; font-size: 1rem;">${leave.totalDays}</span> दिन
        ${leave.originalDays && leave.originalDays !== leave.totalDays ? `
          <br><span class="curtailed-badge" title="मूल आवेदन: ${leave.originalDays} दिन (${formatDate(leave.fromDate)} - ${formatDate(leave.originalToDate)})">
            ✂️ घटाया: ${leave.originalDays}➔${leave.totalDays}
          </span>
        ` : ''}
      </td>
      <td style="max-width: 220px;">
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
      <td>
        ${leave.stationLeave ? '<span style="color: #15803d; font-weight: 600;">✓ अनुमति सहित</span>' : '<span style="color: #64748b;">-</span>'}
      </td>
      <td>${statusBadge}</td>
      <td>
        <div style="display: flex; gap: 6px; flex-wrap: wrap;">
          <button class="btn btn-outline btn-sm" onclick="openLeaveDetailsModal('${leave.id}')">विवरण</button>
          ${leave.attachment ? `
            <button class="btn btn-outline btn-sm" onclick="viewAttachment('${leave.id}')" title="दस्तावेज देखें" style="color: #2563eb; padding: 4px 7px;">
              📎
            </button>
          ` : ''}
          ${leave.status === "APPROVED" ? `
            <button class="btn btn-primary btn-sm" onclick="openSanctionSlipModal('${leave.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
              आदेश
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
      return `<span class="status-badge pending_incharge"><span class="dot yellow"></span>शाखा प्रभारी स्तर पर</span>`;
    case "RECOMMENDED":
      return `<span class="status-badge recommended"><span class="dot blue"></span>अनुशंसित (SP विचाराधीन)</span>`;
    case "APPROVED":
      return `<span class="status-badge approved"><span class="dot green"></span>स्वीकृत (Sanctioned)</span>`;
    case "REJECTED":
      return `<span class="status-badge rejected"><span class="dot red"></span>अस्वीकृत (Rejected)</span>`;
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
        <span style="font-weight: 700; color: #0f274c;">📋 गत अवकाश रिकॉर्ड (Previous Leave History):</span>
        <span class="status-badge ${lastLeave.status.toLowerCase()}">${getStatusBadge(lastLeave.status)}</span>
      </div>
      <div style="font-size: 0.84rem; color: #334155;">
        अंतिम बार <strong>${lastLeave.leaveTypeName || lastLeave.leaveType}</strong>: 
        <strong>${formatDate(lastLeave.fromDate)}</strong> से <strong>${formatDate(lastLeave.toDate)}</strong> 
        (कुल <strong>${lastLeave.totalDays} दिन</strong>) | कारण: <em>"${lastLeave.reason}"</em>
        ${lastLeave.sanctionNo ? ` | आदेश क्रमांक: <strong>${lastLeave.sanctionNo}</strong>` : ''}
      </div>
    </div>
  ` : `
    <div class="last-leave-banner">
      <span style="font-weight: 700; color: #0f274c;">📋 गत अवकाश रिकॉर्ड:</span>
      सत्र 2026 में यह आपका <strong>प्रथम अवकाश आवेदन</strong> है।
    </div>
  `;

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path></svg>
          अवकाश आवेदन पत्र (Cyber Police Leave Application)
        </h2>
        <p>कार्यालय पुलिस अधीक्षक, राज्य साइबर अपराध, पंचकूला (हरियाणा)</p>
      </div>
      <div>
        <button class="btn btn-outline" onclick="switchTab('my_leaves')">आवेदन इतिहास देखें</button>
      </div>
    </div>

    <div style="background: #fff; border-radius: 12px; border: 1px solid var(--border-light); padding: 24px; box-shadow: var(--shadow-sm); max-width: 920px; margin: 0 auto;">
      
      <!-- FEATURE 7: LAST LEAVE BANNER -->
      ${lastLeaveHtml}

      <form id="applyLeaveForm" onsubmit="handleApplyLeaveSubmit(event)">
        
        <!-- APPLICANT INFO (READONLY) -->
        <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px 18px; margin-bottom: 22px;">
          <h4 style="font-size: 0.9rem; color: #0f274c; margin-bottom: 10px; font-weight: 700;">आवेदक पुलिस कर्मचारी का विवरण (Applicant Police Personnel Details)</h4>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-size: 0.85rem;">
            <div>नाम / Name: <strong>${user.name}</strong></div>
            <div>बेल्ट नं. / Belt No: <strong>${user.beltNo}</strong></div>
            <div>पद / Rank: <strong>${user.rank}</strong></div>
            <div>मोबाइल / Mobile: <strong>${user.mobile}</strong></div>
            <div>ईमेल / Email: <strong>${user.email}</strong></div>
          </div>
        </div>

        <div class="form-grid">
          <!-- BRANCH SELECTION DROPDOWN -->
          <div class="form-group form-full">
            <label for="leaveBranchSelect" style="font-weight: 700; color: #0f274c; font-size: 0.9rem;">
              अपनी साइबर शाखा चुनें (Select Your Cyber Branch) <span class="required">*</span>
            </label>
            <select id="leaveBranchSelect" class="form-control" required onchange="handleLeaveBranchChange(this.value)" style="border: 2px solid var(--police-blue); font-weight: 600; font-size: 0.92rem; padding: 10px;">
              <option value="">-- अपनी साइबर शाखा चुनें (Select Cyber Branch) --</option>
              ${AppState.branches.map(b => `
                <option value="${b.id}" ${b.id === user.branchId ? 'selected' : ''}>
                  ${b.name} (${b.hindi})
                </option>
              `).join("")}
            </select>
            <small style="color: #64748b; font-size: 0.78rem; margin-top: 2px;">
              * यह अवकाश आवेदन आपके द्वारा चयनित शाखा के संबंधित शाखा प्रभारी को अनुशंसा हेतु भेजा जाएगा।
            </small>
          </div>

          <!-- LEAVE TYPE -->
          <div class="form-group form-full">
            <label for="leaveTypeSelect">अवकाश का प्रकार (Leave Type) <span class="required">*</span></label>
            <select id="leaveTypeSelect" class="form-control" required onchange="handleLeaveTypeChange()">
              <option value="">-- अवकाश प्रकार चुनें (Select Leave Type) --</option>
              ${LEAVE_TYPES.map(lt => {
                const bal = user.leaveBalances ? (user.leaveBalances[lt.code] ?? 0) : 0;
                return `<option value="${lt.code}">${lt.code} - ${lt.name} (${lt.hindi}) [उपलब्ध कोटा: ${bal} दिन]</option>`;
              }).join("")}
            </select>
            <small id="leaveTypeDesc" style="color: #64748b; font-size: 0.78rem;"></small>

            <!-- FEATURE 5: MANDATORY MEDICAL NOTICE ALERT -->
            <div id="medicalNoticeAlert" style="display: none; margin-top: 8px; background: #fef2f2; border: 1px solid #fecaca; color: #991b1b; padding: 10px 14px; border-radius: 6px; font-weight: 600; font-size: 0.85rem;">
              🏥 <strong>अनिवार्य चिकित्सा प्रमाण पत्र:</strong> मेडिकल अवकाश (ML) अथवा सीसीएल (CCL) हेतु अधिकृत शासकीय / मान्यता प्राप्त डॉक्टर का पर्चा अथवा मेडिकल प्रमाण पत्र संलग्न करना अनिवार्य है।
            </div>
          </div>

          <!-- FROM DATE -->
          <div class="form-group">
            <label for="leaveFromDate">कब से (From Date) <span class="required">*</span></label>
            <input type="date" id="leaveFromDate" class="form-control" required onchange="calculateLeaveDays()">
          </div>

          <!-- TO DATE -->
          <div class="form-group">
            <label for="leaveToDate">कब तक (To Date) <span class="required">*</span></label>
            <input type="date" id="leaveToDate" class="form-control" required onchange="calculateLeaveDays()">
          </div>

          <!-- FEATURE 6: HALF DAY LEAVE (CL ONLY) -->
          <div id="halfDaySection" style="display: none;" class="form-group form-full">
            <div class="half-day-box">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; color: #0f274c; margin: 0;">
                  <input type="checkbox" id="halfDayCheck" onchange="handleHalfDayToggle(this)">
                  🕒 क्या केवल आधा दिन (Half Day) का आकस्मिक अवकाश चाहिए? (0.5 Day CL)
                </label>
                <span style="font-size: 0.8rem; background: #e2e8f0; color: #334155; padding: 2px 8px; border-radius: 4px; font-weight: 600;">0.5 दिन कोटा</span>
              </div>
              <div id="halfDayShiftBox" style="display: none; margin-top: 10px; padding-top: 10px; border-top: 1px dashed #cbd5e1;">
                <label style="font-size: 0.82rem; font-weight: 600; color: #475569; margin-bottom: 6px; display: block;">ड्यूटी पाली चुनें (Select Shift):</label>
                <div style="display: flex; gap: 20px; font-size: 0.88rem;">
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="radio" name="halfDayShift" value="Morning Shift (प्रथम पाली - सुबह 09:00 से दोपहर 02:00)" checked onchange="calculateLeaveDays()">
                    प्रथम पाली / Morning Shift (09:00 AM से 02:00 PM)
                  </label>
                  <label style="display: flex; align-items: center; gap: 6px; cursor: pointer;">
                    <input type="radio" name="halfDayShift" value="Evening Shift (द्वितीय पाली - दोपहर 02:00 से रात्रि 08:00)" onchange="calculateLeaveDays()">
                    द्वितीय पाली / Evening Shift (02:00 PM से 08:00 PM)
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
                  📅 क्या अवकाश के साथ पूर्ववर्ती / उत्तरवर्ती छुट्टियां जोड़नी हैं? (Prefix & Suffix Holidays)
                </label>
                <span style="font-size: 0.78rem; color: #64748b;">(C-OFF, रविवार या राजपत्रित अवकाश)</span>
              </div>
              <div id="prefixSuffixFields" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #cbd5e1;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                  <div>
                    <label for="prefixDaysInput" style="font-size: 0.82rem; font-weight: 600; color: #334155;">
                      पूर्ववर्ती छुट्टियां / Prefix Days (शुरुआत से पहले पड़ने वाले C-OFF/रविवार)
                    </label>
                    <input type="number" id="prefixDaysInput" class="form-control" min="0" max="7" value="0" onchange="calculateLeaveDays()" placeholder="दिन संख्या">
                  </div>
                  <div>
                    <label for="suffixDaysInput" style="font-size: 0.82rem; font-weight: 600; color: #334155;">
                      उत्तरवर्ती छुट्टियां / Suffix Days (समाप्ति के बाद पड़ने वाले C-OFF/रविवार)
                    </label>
                    <input type="number" id="suffixDaysInput" class="form-control" min="0" max="7" value="0" onchange="calculateLeaveDays()" placeholder="दिन संख्या">
                  </div>
                </div>
                <small style="color: #64748b; font-size: 0.76rem; margin-top: 6px; display: block;">
                  * पुलिस मैनुअल नियम: प्रीफिक्स एवं सफिक्स दिनों को अवकाश कोटे से नहीं काटा जाता, परंतु गैर-हाजिरी अवधि में दर्ज किया जाता है।
                </small>
              </div>
            </div>
          </div>

          <!-- COMPUTED DAYS NOTICE -->
          <div class="form-group form-full">
            <div id="leaveDaysNotice" style="background: #eff6ff; border: 1px solid #bfdbfe; color: #1e40af; border-radius: 6px; padding: 10px 14px; font-size: 0.88rem; font-weight: 600;">
              कृपया तिथियां चुनें (Total Days: 0)
            </div>
          </div>

          <!-- FEATURE 2: LIVE BRANCH OVERLAP ALERT -->
          <div class="form-group form-full">
            <div id="branchOverlapNotice" style="display: none;"></div>
          </div>

          <!-- REASON -->
          <div class="form-group form-full">
            <label for="leaveReason">अवकाश का स्पष्ट कारण / उद्देश्य (Reason for Leave) <span class="required">*</span></label>
            <textarea id="leaveReason" class="form-control" rows="3" required placeholder="अवकाश का विस्तृत कारण लिखें (जैसे: पारिवारिक कार्य, चिकित्सा, विवाह आदि)"></textarea>
          </div>

          <!-- FEATURE 3: COURT EVIDENCE & CASE HANDOVER -->
          <div class="form-group form-full">
            <div class="court-case-box">
              <div style="display: flex; align-items: center; justify-content: space-between;">
                <label style="display: flex; align-items: center; gap: 8px; cursor: pointer; font-weight: 700; color: #854d0e; margin: 0;">
                  <input type="checkbox" id="courtEvidenceCheck" onchange="toggleCourtCaseFields(this)">
                  ⚖️ क्या इस अवकाश अवधि में कोई न्यायालयीन गवाही / पेशी (Court Evidence / Summons) नियत है?
                </label>
              </div>
              <div id="courtCaseFields" style="display: none; margin-top: 12px; padding-top: 12px; border-top: 1px dashed #fef08a;">
                <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px;">
                  <div>
                    <label for="courtCaseDetails" style="font-size: 0.82rem; font-weight: 600; color: #713f12;">
                      न्यायालय / केस विवरण (Court Name, Case / FIR No., पेशी तिथि)
                    </label>
                    <input type="text" id="courtCaseDetails" class="form-control" placeholder="उदा: CBI कोर्ट पंचकूला / FIR 42/2025, पेशी 12-Nov">
                  </div>
                  <div>
                    <label for="courtOfficerHandover" style="font-size: 0.82rem; font-weight: 600; color: #713f12;">
                      केस डायरी व पैरवी किस सहकर्मी को सौंपी गई (Officer Assigned for Court Appearance)
                    </label>
                    <input type="text" id="courtOfficerHandover" class="form-control" placeholder="उदा: ASI Rajesh (312/PKL) को केस फाइल सुपुर्द की गई">
                  </div>
                </div>
              </div>
            </div>
          </div>

          <!-- HANDOVER TO -->
          <div class="form-group">
            <label for="handoverOfficer">ड्यूटी / प्रभार किसे सौंपा गया (Charge Handover To)</label>
            <select id="handoverOfficer" class="form-control">
              <option value="">-- सहकर्मी चुनें (Select Officer) --</option>
              ${sameBranchMembers.map(m => `<option value="${m.name} (${m.beltNo})">${m.name} - ${m.rank} (${m.beltNo})</option>`).join("")}
              <option value="शाखा प्रभारी (Branch Incharge)">शाखा प्रभारी (Branch Incharge)</option>
              <option value="अन्य (Other)">अन्य व्यवस्था (Other)</option>
            </select>
          </div>

          <!-- EMERGENCY MOBILE -->
          <div class="form-group">
            <label for="emergencyMobile">अवकाश के दौरान आपातकालीन मोबाइल नंबर (Emergency Contact) <span class="required">*</span></label>
            <input type="tel" id="emergencyMobile" class="form-control" value="${user.mobile}" required>
          </div>

          <!-- STATION LEAVE CHECKBOX -->
          <div class="form-group form-full">
            <div class="checkbox-row">
              <input type="checkbox" id="stationLeaveCheck" onchange="toggleStationLeaveInputs()">
              <label for="stationLeaveCheck">
                क्या अवकाश के दौरान स्टेशन / हेडक्वार्टर छोड़ने की अनुमति चाहिए? (Permission to Leave Station / HQ)
              </label>
            </div>
          </div>

          <!-- FEATURE 4: EXPANDED STATION LEAVE DETAILS -->
          <div id="stationLeaveBox" class="form-group form-full" style="display: none;">
            <div class="station-leave-card">
              <h4 style="font-size: 0.88rem; color: #92400e; margin-bottom: 12px; font-weight: 700; display: flex; align-items: center; gap: 6px;">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"></path><circle cx="12" cy="10" r="3"></circle></svg>
                मुख्यालय छोड़ने का विस्तृत यात्रा विवरण (Station Leave / Out-of-HQ Details)
              </h4>
              <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px;">
                <div>
                  <label for="stationDestination" style="font-size: 0.8rem; font-weight: 600; color: #92400e;">
                    गंतव्य शहर व राज्य (Destination City & State)
                  </label>
                  <input type="text" id="stationDestination" class="form-control" placeholder="उदा: जयपुर, राजस्थान">
                </div>
                <div>
                  <label for="stationLocalPS" style="font-size: 0.8rem; font-weight: 600; color: #92400e;">
                    संबंधित स्थानीय थाना (Nearest Local Police Station)
                  </label>
                  <input type="text" id="stationLocalPS" class="form-control" placeholder="उदा: थाना मालवीय नगर, जयपुर">
                </div>
                <div>
                  <label for="stationTravelMode" style="font-size: 0.8rem; font-weight: 600; color: #92400e;">
                    यात्रा का साधन (Mode of Travel)
                  </label>
                  <select id="stationTravelMode" class="form-control">
                    <option value="ट्रेन (Indian Railways)">ट्रेन (Train / Indian Railways)</option>
                    <option value="बस (State / Private Bus)">बस (State Roadways / Bus)</option>
                    <option value="निजी कार (Private Car)">निजी चार पहिया वाहन (Private Car)</option>
                    <option value="दो पहिया (Motorcycle / Bike)">दो पहिया (Two Wheeler)</option>
                    <option value="हवाई यात्रा (Flight)">हवाई यात्रा (Flight)</option>
                    <option value="अन्य (Other)">अन्य व्यवस्था (Other)</option>
                  </select>
                </div>
                <div>
                  <label for="stationFamilyContact" style="font-size: 0.8rem; font-weight: 600; color: #92400e;">
                    आपातकालीन संपर्क परिजन (Family Member & Relation)
                  </label>
                  <input type="text" id="stationFamilyContact" class="form-control" placeholder="उदा: पिता - श्री रामकिशन (98120XXXXX)">
                </div>
                <div style="grid-column: 1 / -1;">
                  <label for="stationLeaveAddress" style="font-size: 0.8rem; font-weight: 600; color: #92400e;">
                    स्टेशन से बाहर ठहरने का पूर्ण पता (Complete Address During Leave)
                  </label>
                  <textarea id="stationLeaveAddress" class="form-control" rows="2" placeholder="मकान नं, गली/मोहल्ला, गांव/शहर, पिन कोड"></textarea>
                </div>
              </div>
              <small style="color: #b45309; font-size: 0.74rem; margin-top: 6px; display: block;">
                * पुलिस नियमों के अनुसार स्टेशन लीव की अंतिम अनुमति पुलिस अधीक्षक (SP Cyber) महोदय के आदेश द्वारा ही मान्य होगी।
              </small>
            </div>
          </div>

          <!-- REAL FILE ATTACHMENT UPLOAD -->
          <div class="form-group form-full">
            <label style="font-size: 0.82rem; font-weight: 600; color: var(--text-secondary);">
              दस्तावेज / प्रमाणपत्र संलग्नक (Attachment: Medical Slip / Marriage Card / Application Letter)
            </label>
            <div class="attachment-upload-zone" onclick="document.getElementById('leaveAttachmentInput').click()">
              <input type="file" id="leaveAttachmentInput" accept=".pdf,image/*,.doc,.docx" onchange="handleAttachmentSelect(event)">
              <div id="attachmentPrompt">
                <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="color: var(--police-blue); margin-bottom: 6px;"><path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48"></path></svg>
                <p style="font-weight: 600; font-size: 0.9rem; color: #1e293b;">फ़ाइल संलग्न करने के लिए यहां क्लिक करें या ड्रैग करें</p>
                <p style="font-size: 0.75rem; color: #64748b;">(समर्थित: PDF, JPG, PNG, DOC - अधिकतम 5MB)</p>
              </div>
              <div id="attachmentPreviewBox" style="display: none;" class="attachment-preview-card" onclick="event.stopPropagation()">
                <div style="display: flex; align-items: center; gap: 10px;">
                  <div class="attachment-icon">📎</div>
                  <div style="text-align: left;">
                    <strong id="attachmentFileName" style="font-size: 0.85rem; color: #0f274c;"></strong>
                    <div id="attachmentFileSize" style="font-size: 0.72rem; color: #64748b;"></div>
                  </div>
                </div>
                <button type="button" class="btn btn-danger btn-sm" onclick="clearSelectedAttachment(event)">हटाएं (Remove)</button>
              </div>
            </div>
          </div>
        </div>

        <!-- FORM ACTION BUTTONS WITH PREVIEW OPTION -->
        <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #e2e8f0; display: flex; justify-content: flex-end; gap: 12px; flex-wrap: wrap;">
          <button type="button" class="btn btn-outline" onclick="switchTab('dashboard')">रद्द करें</button>
          
          <!-- FEATURE 8: PREVIEW BUTTON -->
          <button type="button" class="btn btn-outline" onclick="openApplicationPreviewModal()" style="border-color: #0f274c; color: #0f274c; font-weight: 600;">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
            आवेदन का पूर्वावलोकन (Preview Application)
          </button>

          <button type="submit" class="btn btn-primary">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
            आवेदन अग्रेषित करें (Submit Leave Application)
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
    alert("फ़ाइल का आकार 5MB से कम होना चाहिए।");
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
    if (sizeEl) sizeEl.textContent = `${(file.size / 1024).toFixed(1)} KB (${file.type || "दस्तावेज"})`;

    showToast(`दस्तावेज "${file.name}" सफलतापूर्वक संलग्न किया गया।`, "info");
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
      <option value="">-- सहकर्मी चुनें (Select Officer) --</option>
      ${branchMembers.map(m => `<option value="${m.name} (${m.beltNo})">${m.name} - ${m.rank} (${m.beltNo})</option>`).join("")}
      <option value="शाखा प्रभारी (Branch Incharge)">शाखा प्रभारी (Branch Incharge)</option>
      <option value="अन्य व्यवस्था (Other)">अन्य व्यवस्था (Other)</option>
    `;
  }

  calculateLeaveDays();
}

function handleLeaveTypeChange() {
  const code = document.getElementById("leaveTypeSelect")?.value;
  const descEl = document.getElementById("leaveTypeDesc");
  if (descEl) {
    const lt = LEAVE_TYPES.find(l => l.code === code);
    descEl.textContent = lt ? `${lt.hindi}: ${lt.desc}` : "";
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
    noticeEl.textContent = "कृपया तिथियां चुनें (Total Days: 0)";
    noticeEl.style.background = "#eff6ff";
    noticeEl.style.color = "#1e40af";
    if (halfDaySec) halfDaySec.style.display = "none";
    checkBranchOverlap(branchVal, null, null);
    return;
  }

  const fromDate = new Date(fromVal);
  const toDate = new Date(toVal);

  if (toDate < fromDate) {
    noticeEl.textContent = "त्रुटि: समाप्ति तिथि (To Date) प्रारंभिक तिथि से पहले नहीं हो सकती।";
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

  let detailsText = `कुल अवकाश कोटा कटौती: <strong>${diffDays} दिन</strong> (${formatDate(fromVal)} से ${formatDate(toVal)})`;
  if (prefix > 0 || suffix > 0) {
    detailsText += ` | कुल अनुपस्थिति: <strong>${totalAbsence} दिन</strong> (${prefix} पूर्ववर्ती + ${diffDays} अवकाश + ${suffix} उत्तरवर्ती)`;
  }
  if (isHalfDay) {
    const shiftVal = document.querySelector('input[name="halfDayShift"]:checked')?.value || "Morning Shift";
    detailsText += ` [आधा दिन: ${shiftVal}]`;
  }

  // CL max 10 days policy advice
  let policyWarning = "";
  if (leaveCode === "CL" && diffDays > 10) {
    policyWarning = `<br><span style="color: #b45309; font-weight: normal; font-size: 0.8rem;">⚠ पुलिस सेवा नियम: आकस्मिक अवकाश (CL) सामान्यतः एक बार में 10 दिन से अधिक स्वीकृत नहीं किया जाता। अधिक अवधि हेतु EL का उपयोग करें।</span>`;
  }

  if (diffDays > balance) {
    noticeEl.innerHTML = `${detailsText} | <strong>चेतावनी:</strong> आपके पास इस अवकाश का शेष कोटा केवल <strong>${balance} दिन</strong> है!${policyWarning}`;
    noticeEl.style.background = "#fffbeb";
    noticeEl.style.color = "#b45309";
  } else {
    noticeEl.innerHTML = `${detailsText} | कोटा पर्याप्त है (${balance} शेष)${policyWarning}`;
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
          <strong>शाखा नफरी उपलब्धता (Branch Strength Check):</strong>
          चयनित अवधि में आपकी शाखा का कोई अन्य जवान अवकाश पर नहीं है। शाखा में सभी ${totalBranchStaff} जवान ऑन-ड्यूटी उपलब्ध रहेंगे।
        </div>
      </div>
    `;
  } else {
    overlapBox.className = "branch-overlap-box warning";
    const names = overlappingLeaves.map(l => `<strong>${l.applicantName}</strong> (${l.rank} - ${formatDate(l.fromDate)} से ${formatDate(l.toDate)})`).join(", ");
    const remainingOnDuty = Math.max(0, totalBranchStaff - overlappingLeaves.length - 1);
    overlapBox.innerHTML = `
      <div style="display: flex; align-items: flex-start; gap: 8px;">
        <span style="font-size: 1.2rem;">👥</span>
        <div>
          <strong>शाखा अवकाश समवर्ती अलर्ट (Concurrent Branch Leave Alert):</strong><br>
          इस अवधि के दौरान आपकी शाखा के <strong>${overlappingLeaves.length} जवान</strong> पहले से अवकाश पर / प्रक्रियाधीन हैं: ${names}.<br>
          अनुमानित शेष ऑन-ड्यूटी नफरी: <strong>${remainingOnDuty} जवान</strong> (कुल ${totalBranchStaff} में से)।
        </div>
      </div>
    `;
  }
}

// FEATURE 8: OPEN APPLICATION PREVIEW MODAL
function openApplicationPreviewModal() {
  const selectedBranchId = document.getElementById("leaveBranchSelect")?.value;
  if (!selectedBranchId) {
    alert("कृपया पहले अपनी साइबर शाखा चुनें।");
    document.getElementById("leaveBranchSelect")?.focus();
    return;
  }
  const branchObj = AppState.branches.find(b => b.id === selectedBranchId);
  const branchName = branchObj ? `${branchObj.name} (${branchObj.hindi})` : selectedBranchId;

  const leaveType = document.getElementById("leaveTypeSelect")?.value;
  if (!leaveType) {
    alert("कृपया अवकाश का प्रकार चुनें।");
    document.getElementById("leaveTypeSelect")?.focus();
    return;
  }
  const ltObj = LEAVE_TYPES.find(l => l.code === leaveType);
  const leaveTypeName = ltObj ? `${ltObj.name} (${ltObj.hindi})` : leaveType;

  const fromDate = document.getElementById("leaveFromDate")?.value;
  const toDate = document.getElementById("leaveToDate")?.value;
  if (!fromDate || !toDate) {
    alert("कृपया अवकाश की प्रारंभिक एवं समाप्ति तिथि चुनें।");
    return;
  }
  if (new Date(toDate) < new Date(fromDate)) {
    alert("त्रुटि: समाप्ति तिथि प्रारंभिक तिथि से पहले नहीं हो सकती।");
    return;
  }

  const reason = document.getElementById("leaveReason")?.value.trim();
  if (!reason) {
    alert("कृपया अवकाश का स्पष्ट कारण लिखें।");
    document.getElementById("leaveReason")?.focus();
    return;
  }

  // FEATURE 5: Mandatory check for ML/CCL in preview as well
  if ((leaveType === "ML" || leaveType === "CCL") && !AppState.currentAttachment) {
    alert("अनिवार्य दस्तावेज आवश्यक: मेडिकल अवकाश (ML) अथवा सीसीएल हेतु डॉक्टर का पर्चा / प्रमाण पत्र संलग्न करना अनिवार्य है।");
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
  const courtCaseDetails = courtDuty ? (document.getElementById("courtCaseDetails")?.value || "विवरण नियत") : "कोई पेशी नहीं";
  const courtOfficerHandover = courtDuty ? (document.getElementById("courtOfficerHandover")?.value || "अन्य सहकर्मी") : "-";

  const handoverTo = document.getElementById("handoverOfficer")?.value || "शाखा प्रभारी";
  const emergencyContact = document.getElementById("emergencyMobile")?.value || user.mobile;

  const stationLeave = document.getElementById("stationLeaveCheck")?.checked;
  const stationDestination = stationLeave ? (document.getElementById("stationDestination")?.value || "उल्लिखित नहीं") : "-";
  const stationLocalPS = stationLeave ? (document.getElementById("stationLocalPS")?.value || "-") : "-";
  const stationTravelMode = stationLeave ? (document.getElementById("stationTravelMode")?.value || "-") : "-";
  const stationFamilyContact = stationLeave ? (document.getElementById("stationFamilyContact")?.value || "-") : "-";
  const stationLeaveAddress = stationLeave ? (document.getElementById("stationLeaveAddress")?.value || "मुख्यालय से बाहर") : "-";

  const previewBody = document.getElementById("applicationPreviewBody");
  if (!previewBody) return;

  const now = new Date();
  const dateFormatted = `${String(now.getDate()).padStart(2, '0')}-${String(now.getMonth() + 1).padStart(2, '0')}-${now.getFullYear()}`;

  previewBody.innerHTML = `
    <div class="application-preview-sheet">
      <div class="preview-memo-header">
        <h4 style="font-size: 0.95rem; margin: 0; color: #0f274c; text-transform: uppercase; letter-spacing: 0.5px;">कार्यालय पुलिस अधीक्षक, राज्य साइबर अपराध, पंचकूला (हरियाणा)</h4>
        <div style="font-size: 0.78rem; color: #64748b; margin-top: 2px;">OFFICE OF THE SUPERINTENDENT OF POLICE, STATE CYBER CRIME, PANCHKULA</div>
        <div style="margin-top: 8px; font-size: 0.85rem; font-weight: 700; color: #b45309; text-decoration: underline;">
          अवकाश प्रार्थना पत्र / POLICE LEAVE APPLICATION MEMORANDUM
        </div>
        <div style="display: flex; justify-content: space-between; font-size: 0.8rem; margin-top: 10px; color: #475569;">
          <span>दिनांक: <strong>${dateFormatted}</strong></span>
          <span>प्रारूप: <strong>HP-CYB/FORM-L1</strong></span>
        </div>
      </div>

      <div style="font-size: 0.85rem; margin-bottom: 12px; line-height: 1.5;">
        <strong>सेवा में,</strong><br>
        श्रीमान पुलिस अधीक्षक महोदय,<br>
        राज्य साइबर अपराध, पंचकूला (हरियाणा)।<br>
        <span style="color: #64748b;">(मार्फत: शाखा प्रभारी - <strong>${branchName}</strong>)</span>
      </div>

      <div style="background: #f1f5f9; padding: 6px 12px; border-radius: 4px; font-size: 0.86rem; font-weight: 700; color: #0f274c; margin-bottom: 14px;">
        विषय: <strong>${leaveTypeName}</strong> (${diffDays} दिन) की अनुमति / स्वीकृति बाबत।
      </div>

      <table class="preview-table">
        <tbody>
          <tr>
            <th>आवेदक पुलिस कर्मचारी</th>
            <td><strong>${user.name}</strong> (${user.beltNo}) | पद: <strong>${user.rank}</strong></td>
          </tr>
          <tr>
            <th>पदस्थ शाखा</th>
            <td><strong>${branchName}</strong></td>
          </tr>
          <tr>
            <th>अवकाश का प्रकार</th>
            <td><strong>${leaveTypeName}</strong></td>
          </tr>
          <tr>
            <th>अवकाश अवधि</th>
            <td>
              <strong>${formatDate(fromDate)}</strong> से <strong>${formatDate(toDate)}</strong> 
              (कुल कार्यदिवस कटौती: <strong>${diffDays} दिन</strong>)
              ${isHalfDay ? `<br><span style="color: #b45309; font-weight: 600;">[आधा दिन अवकाश: ${halfDayShift}]</span>` : ''}
            </td>
          </tr>
          ${prefixCheck && (prefix > 0 || suffix > 0) ? `
            <tr>
              <th>प्रीफिक्स / सफिक्स छुट्टियां</th>
              <td>
                पूर्ववर्ती (Prefix): <strong>${prefix} दिन</strong> | उत्तरवर्ती (Suffix): <strong>${suffix} दिन</strong><br>
                <small style="color: #64748b;">(कुल गैर-हाजिरी अवधि: <strong>${totalAbsence} दिन</strong>)</small>
              </td>
            </tr>
          ` : ''}
          <tr>
            <th>अवकाश का स्पष्ट कारण</th>
            <td><em>"${reason}"</em></td>
          </tr>
          <tr>
            <th>न्यायालयीन पेशी स्थिति</th>
            <td>
              ${courtDuty ? `
                <span style="color: #dc2626; font-weight: 700;">⚠ हाँ, पेशी नियत है:</span> ${courtCaseDetails}<br>
                केस डायरी व पैरवी सुपुर्द: <strong>${courtOfficerHandover}</strong>
              ` : `
                <span style="color: #16a34a; font-weight: 600;">✓ अवकाश अवधि में कोई न्यायालयीन पेशी / गवाही नियत नहीं है।</span>
              `}
            </td>
          </tr>
          <tr>
            <th>कार्यभार / प्रभार सुपुर्दगी</th>
            <td><strong>${handoverTo}</strong> को कार्यभार सौंपा गया है।</td>
          </tr>
          <tr>
            <th>आपातकालीन संपर्क</th>
            <td><strong>${emergencyContact}</strong></td>
          </tr>
          <tr>
            <th>स्टेशन लीव (मुख्यालय छोड़ने का विवरण)</th>
            <td>
              ${stationLeave ? `
                <span style="color: #b45309; font-weight: 700;">★ स्टेशन लीव अनुमति प्रार्थित है:</span><br>
                • गंतव्य: <strong>${stationDestination}</strong> (स्थानीय थाना: <strong>${stationLocalPS}</strong>)<br>
                • यात्रा माध्यम: <strong>${stationTravelMode}</strong><br>
                • संपर्क परिजन: <strong>${stationFamilyContact}</strong><br>
                • बाहर रहने का पता: ${stationLeaveAddress}
              ` : `
                <span style="color: #16a34a;">स्टेशन छोड़ने की आवश्यकता नहीं है (मुख्यालय पर उपस्थित रहेंगे)।</span>
              `}
            </td>
          </tr>
          <tr>
            <th>संलग्नक दस्तावेज</th>
            <td>
              ${AppState.currentAttachment ? `
                <span style="color: #1e40af; font-weight: 600;">📎 ${AppState.currentAttachment.name}</span> (${AppState.currentAttachment.size})
              ` : `
                <span style="color: #64748b;">कोई दस्तावेज संलग्न नहीं किया गया।</span>
              `}
            </td>
          </tr>
        </tbody>
      </table>

      <div style="margin-top: 18px; padding-top: 12px; border-top: 1px dashed #cbd5e1; font-size: 0.8rem; color: #475569; display: flex; justify-content: space-between; align-items: flex-end;">
        <div>
          * घोषणा: मेरे द्वारा दी गई उपरोक्त जानकारी पूर्णतः सत्य एवं नियमानुसार है।
        </div>
        <div style="text-align: right;">
          <div style="font-weight: 700; color: #0f274c;">${user.name}</div>
          <div>${user.rank} (${user.beltNo})</div>
          <div>हस्ताक्षर आवेदक (Digital Stamp)</div>
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
    alert("कृपया अपनी साइबर शाखा चुनें (Please select Cyber Branch).");
    return;
  }
  const branchObj = AppState.branches.find(b => b.id === selectedBranchId);
  const branchName = branchObj ? branchObj.name : selectedBranchId;

  const leaveType = document.getElementById("leaveTypeSelect").value;
  const fromDate = document.getElementById("leaveFromDate").value;
  const toDate = document.getElementById("leaveToDate").value;
  const reason = document.getElementById("leaveReason").value;
  const handoverTo = document.getElementById("handoverOfficer").value || "शाखा प्रभारी";
  const emergencyContact = document.getElementById("emergencyMobile").value;

  // FEATURE 5: MANDATORY MEDICAL CERTIFICATE VALIDATION
  if ((leaveType === "ML" || leaveType === "CCL") && !AppState.currentAttachment) {
    showToast("मेडिकल अवकाश (ML) हेतु अधिकृत चिकित्सक का प्रमाण पत्र / पर्चा संलग्न करना अनिवार्य है!", "error");
    alert("अनिवार्य दस्तावेज आवश्यक: मेडिकल अवकाश (ML) अथवा सीसीएल हेतु डॉक्टर का पर्चा / मेडिकल प्रमाण पत्र संलग्न करें।");
    document.getElementById("leaveAttachmentInput")?.focus();
    return;
  }

  if (new Date(toDate) < new Date(fromDate)) {
    alert("त्रुटि: समाप्ति तिथि प्रारंभिक तिथि के बाद होनी चाहिए।");
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
  const leaveTypeName = ltObj ? `${ltObj.name} (${ltObj.hindi})` : leaveType;

  const now = new Date();
  const appliedAt = now.toISOString().replace("T", " ").substring(0, 16);

  const newId = `LV-2026-${String(AppState.leaves.length + 1).padStart(3, "0")}`;
  const sanctionNo = `CYB/PKL/LEAVE/2026/${String(AppState.leaves.length + 140).padStart(4, "0")}`;

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

  showToast(`अवकाश आवेदन ${newId} (${totalDays} दिन) सफलतापूर्वक दर्ज किया गया। शाखा प्रभारी को अग्रेषित।`, "success");
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
          मेरे अवकाश आवेदन (My Leave History)
        </h2>
        <p>आपके द्वारा दर्ज सभी अवकाश आवेदनों की वर्तमान स्थिति एवं स्वीकृति पत्र</p>
      </div>
      <div>
        <button class="btn btn-gold" onclick="switchTab('apply_leave')">नया आवेदन करें</button>
      </div>
    </div>

    <div class="card-table-wrap">
      <div class="responsive-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>आवेदन आईडी</th>
              <th>प्रकार (Type)</th>
              <th>अवधि (Period)</th>
              <th>दिन (Days)</th>
              <th>कारण (Reason)</th>
              <th>स्टेशन लीव</th>
              <th>स्थिति (Status)</th>
              <th>कार्रवाई (Action)</th>
            </tr>
          </thead>
          <tbody>
            ${userLeaves.length === 0 ? `
              <tr><td colspan="8" style="text-align: center; color: #64748b; padding: 30px;">कोई अवकाश आवेदन नहीं मिला।</td></tr>
            ` : userLeaves.map(leave => renderLeaveTableRow(leave)).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// ==========================================
// VIEW 4: BRANCH INCHARGE DESK
// ==========================================
function renderInchargeDesk(container) {
  const user = AppState.currentUser;
  const isBranchIncharge = user && (user.role === "branch_incharge" || user.role === "admin");
  const isSPRole = user && (user.role === "sp_cyber");

  if (!isBranchIncharge) {
    container.innerHTML = `
      <div style="background: #fff; border-radius: 12px; border: 1px solid #fee2e2; padding: 40px 24px; text-align: center; max-width: 600px; margin: 40px auto; box-shadow: var(--shadow-sm);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 1.6rem;">🔒</div>
        <h3 style="color: #991b1b; font-size: 1.2rem; margin-bottom: 8px;">पहुंच केवल शाखा प्रभारियों हेतु (Incharge Desk Access Restricted)</h3>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">
          यह पटल केवल <strong>शाखा प्रभारियों (Branch Incharges)</strong> के लिए है।
          ${isSPRole ? '<br><span style="color: #1e3a8a; font-weight: 600;">एसपी महोदय अंतिम स्वीकृति हेतु "एसपी साइबर स्वीकृति पटल" का उपयोग करें।</span>' : ''}
        </p>
        <button class="btn btn-primary" onclick="switchTab('${isSPRole ? 'sp_desk' : 'dashboard'}')">
          ${isSPRole ? 'एसपी स्वीकृति पटल खोलें (Open SP Desk)' : 'डैशबोर्ड पर जाएं'}
        </button>
      </div>
    `;
    return;
  }

  const branch = AppState.branches.find(b => b.id === user.branchId);
  const branchName = branch ? branch.name : "Cyber Branch";

  // Filter pending leaves for this branch
  const branchPendingLeaves = AppState.leaves.filter(l => {
    if (l.status !== "PENDING_INCHARGE") return false;
    return l.branchId === user.branchId;
  });

  const branchProcessedLeaves = AppState.leaves.filter(l => {
    if (l.status === "PENDING_INCHARGE") return false;
    return l.branchId === user.branchId;
  });

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M16 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><polyline points="16 11 18 13 22 9"></polyline></svg>
          शाखा प्रभारी डेस्क (Branch Incharge Verification Desk)
        </h2>
        <p>शाखा: <strong>${isSP ? "सभी 13 शाखाएं (SP विशेषाधिकार)" : branchName}</strong> | प्रभारी: <strong>${user.name}</strong></p>
      </div>
    </div>

    <!-- NOTICE ON WORKFLOW -->
    <div style="background: #eff6ff; border-left: 4px solid #2563eb; padding: 12px 18px; border-radius: 6px; margin-bottom: 20px; font-size: 0.85rem; color: #1e3a8a;">
      <strong>कार्यप्रणाली निर्देश:</strong> शाखा प्रभारी अपने अधीन कार्यरत जवानों के अवकाश आवेदन की समीक्षा करेंगे। यदि शाखा में कार्य व्यवस्था ठीक है तो <strong>"अनुशंसा सहित SP साइबर को अग्रेषित"</strong> करें अन्यथा कारण सहित अस्वीकार करें।
    </div>

    <div class="card-table-wrap">
      <div class="table-toolbar">
        <div class="table-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg>
          अनुशंसा हेतु लंबित आवेदन (Pending for Branch Recommendation)
          <span class="tab-badge" style="margin-left: 8px;">${branchPendingLeaves.length}</span>
        </div>
      </div>
      <div class="responsive-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>आवेदन आईडी</th>
              <th>कर्मचारी विवरण</th>
              <th>अवकाश प्रकार</th>
              <th>अवधि (Period)</th>
              <th>दिन (Days)</th>
              <th>कारण (Reason)</th>
              <th>हैंडओवर किसे</th>
              <th>कार्रवाई (Incharge Action)</th>
            </tr>
          </thead>
          <tbody>
            ${branchPendingLeaves.length === 0 ? `
              <tr><td colspan="8" style="text-align: center; color: #166534; padding: 24px;">✓ वर्तमान में कोई आवेदन अनुशंसा हेतु लंबित नहीं है। सभी निपटाए जा चुके हैं।</td></tr>
            ` : branchPendingLeaves.map(leave => `
              <tr>
                <td><strong>${leave.id}</strong><br><small style="color: #64748b;">${leave.appliedAt}</small></td>
                <td>
                  <strong>${leave.applicantName}</strong><br>
                  <small style="color: #64748b;">${leave.rank} (${leave.beltNo})</small><br>
                  <span class="branch-tag">${leave.branchName}</span>
                </td>
                <td><span style="font-weight: 700;">${leave.leaveType}</span><br><small>${leave.leaveTypeName.split("(")[0]}</small></td>
                <td>${formatDate(leave.fromDate)} से ${formatDate(leave.toDate)}</td>
                <td><strong>${leave.totalDays}</strong> दिन</td>
                <td style="max-width: 200px;">${leave.reason}</td>
                <td>${leave.handoverTo || "-"}</td>
                <td>
                  <button class="btn btn-primary btn-sm" onclick="openInchargeActionModal('${leave.id}')">
                    समीक्षा व अनुशंसा (Review)
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>

    <!-- PREVIOUSLY PROCESSED LEAVES -->
    <div class="card-table-wrap" style="margin-top: 24px;">
      <div class="table-toolbar">
        <div class="table-title">इस शाखा के पूर्व में अनुशंसित / निपटाए गए आवेदन (Branch Processed Leaves)</div>
      </div>
      <div class="responsive-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>आईडी</th>
              <th>कर्मचारी</th>
              <th>प्रकार</th>
              <th>अवधि</th>
              <th>दिन</th>
              <th>प्रभारी रिमार्क (Incharge Remarks)</th>
              <th>अंतिम स्थिति</th>
              <th>विवरण</th>
            </tr>
          </thead>
          <tbody>
            ${branchProcessedLeaves.length === 0 ? `
              <tr><td colspan="8" style="text-align: center; color: #64748b; padding: 20px;">कोई पूर्व रिकॉर्ड नहीं।</td></tr>
            ` : branchProcessedLeaves.slice(0, 8).map(leave => `
              <tr>
                <td>${leave.id}</td>
                <td><strong>${leave.applicantName}</strong> (${leave.beltNo})</td>
                <td>${leave.leaveType}</td>
                <td>${formatDate(leave.fromDate)} - ${formatDate(leave.toDate)}</td>
                <td>${leave.totalDays} दिन</td>
                <td><small>${leave.inchargeRemarks || "-"}</small></td>
                <td>${getStatusBadge(leave.status)}</td>
                <td><button class="btn btn-outline btn-sm" onclick="openLeaveDetailsModal('${leave.id}')">विवरण</button></td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
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
  const approvedLeaves = AppState.leaves.filter(l => l.status === "APPROVED");

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z"></path></svg>
          पुलिस अधीक्षक (साइबर) अंतिम स्वीकृति पटल (SP Cyber Approval Desk)
        </h2>
        <p>सर्वोच्च स्वीकृति अधिकारी: <strong>Mayank Gupta, IPS (SP Cyber Crime, Panchkula)</strong></p>
      </div>
    </div>

    <!-- SP STATS BANNER -->
    <div class="stats-grid">
      <div class="stat-card gold">
        <div class="stat-header">
          <span class="stat-title">अंतिम स्वीकृति हेतु लंबित</span>
          <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="10"></circle><polyline points="12 6 12 12 16 14"></polyline></svg></div>
        </div>
        <div class="stat-number">${recommendedLeaves.length}</div>
        <div class="stat-subtext">शाखा प्रभारियों द्वारा अनुशंसित</div>
      </div>

      <div class="stat-card green">
        <div class="stat-header">
          <span class="stat-title">स्वीकृत अवकाश (Approved)</span>
          <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="20 6 9 17 4 12"></polyline></svg></div>
        </div>
        <div class="stat-number">${approvedLeaves.length}</div>
        <div class="stat-subtext">आदेश जारी किए जा चुके हैं</div>
      </div>

      <div class="stat-card blue">
        <div class="stat-header">
          <span class="stat-title">कुल साइबर शाखाएं</span>
          <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"></rect><path d="M16 21V5a2 2 0 0 0-2-2h-4a2 2 0 0 0-2 2v16"></path></svg></div>
        </div>
        <div class="stat-number">13</div>
        <div class="stat-subtext">पंचकूला मुख्यालय एवं विंग्स</div>
      </div>

      <div class="stat-card purple">
        <div class="stat-header">
          <span class="stat-title">हेल्पलाइन 1930 नफरी</span>
          <div class="stat-icon"><svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6 19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72 12.84 12.84 0 0 0 .7 2.81 2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45 12.84 12.84 0 0 0 2.81.7A2 2 0 0 1 22 16.92z"></path></svg></div>
        </div>
        <div class="stat-number">100%</div>
        <div class="stat-subtext">24x7 कॉल रिस्पॉन्स एक्टिव</div>
      </div>
    </div>

    <div class="card-table-wrap">
      <div class="table-toolbar">
        <div class="table-title">
          <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline></svg>
          शाखा प्रभारियों द्वारा अनुशंसित अवकाश (Recommended Leaves Awaiting SP Sanction)
        </div>
      </div>
      <div class="responsive-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>आईडी</th>
              <th>कर्मचारी एवं शाखा</th>
              <th>प्रकार</th>
              <th>अवधि</th>
              <th>दिन</th>
              <th>कारण (Reason)</th>
              <th>शाखा प्रभारी अनुशंसा (Incharge Remarks)</th>
              <th>स्टेशन लीव</th>
              <th>कार्रवाई (SP Action)</th>
            </tr>
          </thead>
          <tbody>
            ${recommendedLeaves.length === 0 ? `
              <tr><td colspan="9" style="text-align: center; color: #166534; padding: 26px;">✓ वर्तमान में एसपी महोदय की स्वीकृति हेतु कोई भी आवेदन लंबित नहीं है।</td></tr>
            ` : recommendedLeaves.map(leave => `
              <tr>
                <td><strong>${leave.id}</strong></td>
                <td>
                  <strong>${leave.applicantName}</strong><br>
                  <small style="color: #64748b;">${leave.rank} (${leave.beltNo})</small><br>
                  <span class="branch-tag">${leave.branchName}</span>
                </td>
                <td><span style="font-weight: 700;">${leave.leaveType}</span></td>
                <td>${formatDate(leave.fromDate)} से ${formatDate(leave.toDate)}</td>
                <td><strong>${leave.totalDays}</strong> दिन</td>
                <td style="max-width: 180px;">${leave.reason}</td>
                <td style="background: #f8fafc; font-size: 0.8rem; color: #1e3a8a;">
                  "${leave.inchargeRemarks || 'अनुशंसित'}"
                </td>
                <td>${leave.stationLeave ? '<span style="color: #15803d; font-weight: 700;">हाँ (Yes)</span>' : 'नहीं'}</td>
                <td>
                  <button class="btn btn-gold btn-sm" onclick="openSPActionModal('${leave.id}')">
                    स्वीकृति / निर्णय लें
                  </button>
                </td>
              </tr>
            `).join("")}
          </tbody>
        </table>
      </div>
    </div>
  `;

  container.innerHTML = html;
}

// ==========================================
// VIEW 6: ALL 13 BRANCHES VIEW
// ==========================================
function renderBranchesView(container) {
  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"></path><polyline points="3.27 6.96 12 12.01 20.73 6.96"></polyline><line x1="12" y1="22.08" x2="12" y2="12"></line></svg>
          साइबर क्राइम शाखाएं एवं नफरी स्थिति (13 Cyber Branches of Panchkula)
        </h2>
        <p>हरियाणा साइबर पुलिस की सभी 13 शाखाओं का विवरण, प्रभारी अधिकारी एवं वर्तमान नफरी तैनाती</p>
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
                  <div class="hindi-name">${branch.hindi}</div>
                </div>
              </div>

              <div class="branch-incharge-line">
                प्रभारी: <strong>${incharge ? `${incharge.name} (${incharge.rank})` : "नियुक्ति प्रक्रियाधीन"}</strong><br>
                <small style="color: #64748b;">मो: ${incharge ? incharge.mobile : "-"}</small>
              </div>
            </div>

            <div>
              <div class="branch-stats-pills">
                <div class="branch-stat-item">
                  <div class="val">${branchMembers.length}</div>
                  <div class="lbl">कुल स्टाफ</div>
                </div>
                <div class="branch-stat-item">
                  <div class="val" style="color: #16a34a;">${onDutyCount}</div>
                  <div class="lbl">ड्यूटी पर</div>
                </div>
                <div class="branch-stat-item">
                  <div class="val" style="color: #dc2626;">${onLeaveCount}</div>
                  <div class="lbl">अवकाश पर</div>
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
        <h3 style="color: #991b1b; font-size: 1.2rem; margin-bottom: 8px;">पहुंच प्रतिबंधित (Access Restricted)</h3>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">
          मास्टर अवकाश रजिस्टर देखने एवं एक्सेल डाउनलोड करने की अनुमति केवल <strong>पुलिस अधीक्षक (SP Cyber)</strong> एवं <strong>रीडर पटल (Reader Desk)</strong> को है।
        </p>
        <button class="btn btn-primary" onclick="switchTab('dashboard')">डैशबोर्ड पर वापस जाएं</button>
      </div>
    `;
    return;
  }

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20"></path><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z"></path></svg>
          मास्टर अवकाश रजिस्टर (Master Leave Register)
        </h2>
        <p>समस्त साइबर शाखाओं का समेकित अवकाश रिकॉर्ड, फ़िल्टर एवं एक्सेल एक्सपोर्ट</p>
      </div>
      <div style="display: flex; gap: 10px;">
        <button class="btn btn-outline" onclick="exportLeavesToCSV()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
          एक्सेल एक्सपोर्ट (Export to Excel)
        </button>
        <button class="btn btn-primary" onclick="window.print()">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          रजिस्टर प्रिंट करें
        </button>
      </div>
    </div>

    <div class="card-table-wrap">
      <div class="table-toolbar">
        <div class="table-filters" style="width: 100%;">
          <input type="text" id="registerSearchInput" class="search-input" placeholder="नाम, बेल्ट नं. या आईडी से खोजें..." oninput="filterRegisterTable()" style="min-width: 240px;">
          
          <select id="registerBranchFilter" class="select-filter" onchange="filterRegisterTable()">
            <option value="">-- सभी 13 शाखाएं --</option>
            ${AppState.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join("")}
          </select>

          <select id="registerStatusFilter" class="select-filter" onchange="filterRegisterTable()">
            <option value="">-- सभी स्थितियां (Status) --</option>
            <option value="PENDING_INCHARGE">प्रभारी स्तर पर लंबित</option>
            <option value="RECOMMENDED">अनुशंसित (SP लंबित)</option>
            <option value="APPROVED">स्वीकृत (Approved)</option>
            <option value="REJECTED">अस्वीकृत (Rejected)</option>
          </select>

          <select id="registerTypeFilter" class="select-filter" onchange="filterRegisterTable()">
            <option value="">-- सभी अवकाश प्रकार --</option>
            ${LEAVE_TYPES.map(lt => `<option value="${lt.code}">${lt.code} - ${lt.name}</option>`).join("")}
          </select>
        </div>
      </div>

      <div class="responsive-table">
        <table class="data-table" id="masterTable">
          <thead>
            <tr>
              <th>आईडी व तारीख</th>
              <th>कर्मचारी विवरण</th>
              <th>प्रकार</th>
              <th>अवधि (Period)</th>
              <th>दिन</th>
              <th>कारण</th>
              <th>स्टेशन लीव</th>
              <th>स्थिति (Status)</th>
              <th>आदेश / विवरण</th>
            </tr>
          </thead>
          <tbody id="masterTableBody">
            ${AppState.leaves.map(leave => renderLeaveTableRow(leave, true)).join("")}
          </tbody>
        </table>
      </div>
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
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: #64748b; padding: 24px;">फ़िल्टर के अनुसार कोई रिकॉर्ड नहीं मिला।</td></tr>`;
    } else {
      tbody.innerHTML = filtered.map(l => renderLeaveTableRow(l, true)).join("");
    }
  }
}

// Export to CSV / Excel
function exportLeavesToCSV() {
  const user = AppState.currentUser;
  const canViewRegister = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  if (!canViewRegister) {
    showToast("अनुमति नहीं है (Permission Denied)", "error");
    return;
  }

  const headers = ["Application ID", "Applicant Name", "Belt No", "Rank", "Branch", "Leave Type", "From Date", "To Date", "Total Days", "Reason", "Station Leave", "Station Address", "Handover To", "Emergency Contact", "Status", "Applied At", "Incharge Remarks", "SP Remarks", "Sanction No"];
  
  const rows = AppState.leaves.map(l => [
    `"${l.id}"`,
    `"${l.applicantName}"`,
    `"${l.beltNo}"`,
    `"${l.rank}"`,
    `"${l.branchName}"`,
    `"${l.leaveType}"`,
    `"${l.fromDate}"`,
    `"${l.toDate}"`,
    l.totalDays,
    `"${(l.reason || '').replace(/"/g, '""')}"`,
    l.stationLeave ? "Yes" : "No",
    `"${(l.stationLeaveAddress || '').replace(/"/g, '""')}"`,
    `"${(l.handoverTo || '').replace(/"/g, '""')}"`,
    `"${l.emergencyContact || ''}"`,
    `"${l.status}"`,
    `"${l.appliedAt}"`,
    `"${(l.inchargeRemarks || '').replace(/"/g, '""')}"`,
    `"${(l.spRemarks || '').replace(/"/g, '""')}"`,
    `"${l.sanctionNo || ''}"`
  ]);

  const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map(e => e.join(","))].join("\n");
  const encodedUri = encodeURI(csvContent);
  const link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", `Cyber_Police_Leave_Register_${new Date().toISOString().split("T")[0]}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);

  showToast("अवकाश रजिस्टर सफलतापूर्वक एक्सेल (CSV) में डाउनलोड किया गया।", "success");
}

// ==========================================
// VIEW 8: PERSONNEL DIRECTORY & ADD MEMBER
// ==========================================
function renderPersonnelDirectory(container) {
  const user = AppState.currentUser;
  const isAuthorized = user && (user.role === "branch_incharge" || user.role === "sp_cyber" || user.role === "admin");

  if (!isAuthorized) {
    container.innerHTML = `
      <div style="background: #fff; border-radius: 12px; border: 1px solid #fee2e2; padding: 40px 24px; text-align: center; max-width: 600px; margin: 40px auto; box-shadow: var(--shadow-sm);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 1.6rem;">🔒</div>
        <h3 style="color: #991b1b; font-size: 1.2rem; margin-bottom: 8px;">पहुंच प्रतिबंधित (Access Restricted)</h3>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">
          साइबर पुलिस स्टाफ डायरेक्टरी देखने की अनुमति केवल <strong>शाखा प्रभारी (Branch Incharge)</strong> एवं <strong>पुलिस अधीक्षक (SP Cyber)</strong> महोदय को है।
        </p>
        <button class="btn btn-primary" onclick="switchTab('dashboard')">डैशबोर्ड पर वापस जाएं</button>
      </div>
    `;
    return;
  }

  let html = `
    <div class="page-header">
      <div class="page-title-group">
        <h2>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"></path><circle cx="9" cy="7" r="4"></circle><path d="M23 21v-2a4 4 0 0 0-3-3.87"></path><path d="M16 3.13a4 4 0 0 1 0 7.75"></path></svg>
          साइबर पुलिस स्टाफ डायरेक्टरी (Cyber Force Directory)
        </h2>
        <p>सभी 13 शाखाओं में पदस्थ पुलिस अधिकारियों व जवानों की सूची</p>
      </div>
      <div>
        <button class="btn btn-primary" onclick="openAddUserModal()">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
          नया पुलिस जवान जोड़ें (Add Member)
        </button>
      </div>
    </div>

    <div class="card-table-wrap">
      <div class="table-toolbar">
        <div class="table-title">कुल दर्ज नफरी: ${AppState.users.length} अधिकारी / जवान</div>
      </div>
      <div class="responsive-table">
        <table class="data-table">
          <thead>
            <tr>
              <th>आईडी / बेल्ट नं.</th>
              <th>नाम</th>
              <th>पद (Rank)</th>
              <th>पदस्थ शाखा (Branch)</th>
              <th>रोल (System Role)</th>
              <th>संपर्क</th>
              <th>CL कोटा</th>
              <th>EL कोटा</th>
            </tr>
          </thead>
          <tbody>
            ${AppState.users.map(u => {
              const b = AppState.branches.find(br => br.id === u.branchId);
              return `
                <tr>
                  <td><strong>${u.id}</strong><br><small style="color: #64748b;">${u.beltNo}</small></td>
                  <td><strong>${u.name}</strong></td>
                  <td>${u.rank}</td>
                  <td><span class="branch-tag">${b ? b.name : u.branchId}</span></td>
                  <td><span style="font-size: 0.8rem; font-weight: 600;">${getRoleDisplay(u.role)}</span></td>
                  <td><small>${u.mobile}<br>${u.email}</small></td>
                  <td><strong>${u.leaveBalances?.CL ?? 0}</strong> दिन</td>
                  <td><strong>${u.leaveBalances?.EL ?? 0}</strong> दिन</td>
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
    showToast("अनुमति नहीं है (Permission Denied)", "error");
    return;
  }
  window.print();
}

function exportSitrepCSV(targetDate) {
  const user = AppState.currentUser;
  const canViewSitrep = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");
  if (!canViewSitrep) {
    showToast("अनुमति नहीं है (Permission Denied)", "error");
    return;
  }
  const dateStr = targetDate || currentSitrepDate;
  const onLeaveList = AppState.leaves.filter(l => {
    if (l.status !== "APPROVED") return false;
    return l.fromDate <= dateStr && l.toDate >= dateStr;
  });

  let csvContent = "\uFEFF"; // UTF-8 BOM for Excel Hindi support
  csvContent += `हरियाणा पुलिस - राज्य साइबर अपराध शाखा पंचकूला\n`;
  csvContent += `दैनिक नफरी एवं अवकाश रोज़नामचा रिपोर्ट (Daily Sitrep)\n`;
  csvContent += `दिनांक: ${dateStr}, कुल नफरी: ${AppState.users.length}, ऑन-ड्यूटी: ${AppState.users.length - onLeaveList.length}, अवकाश पर: ${onLeaveList.length}\n\n`;
  
  csvContent += `क्र. सं.,आईडी,आवेदक का नाम,पद (Rank),बेल्ट नं.,शाखा,अवकाश प्रकार,प्रारंभ तिथि,समाप्ति तिथि,कुल दिन,स्टेशन लीव गंतव्य,आपातकालीन संपर्क\n`;

  if (onLeaveList.length === 0) {
    csvContent += `1,-,कोई पुलिस कर्मी अवकाश पर नहीं है (समस्त नफरी ड्यूटी पर उपस्थित),-,-,-,-,-,-,0,-,-\n`;
  } else {
    onLeaveList.forEach((l, idx) => {
      csvContent += `${idx + 1},"${l.id}","${l.applicantName}","${l.rank}","${l.beltNo}","${l.branchName}","${l.leaveType} - ${l.leaveTypeName}","${l.fromDate}","${l.toDate}",${l.totalDays},"${l.stationLeave ? (l.stationDestination || l.stationLeaveAddress || 'स्वीकृत') : 'मुख्यालय पर'}","${l.emergencyContact || ''}"\n`;
    });
  }

  csvContent += `\n\nसमस्त 13 शाखाओं की नफरी स्थिति:\n`;
  csvContent += `शाखा क्र.,शाखा का नाम,शाखा प्रभारी,कुल नफरी,ऑन-ड्यूटी,अवकाश पर,स्थिति\n`;

  AppState.branches.forEach((b, idx) => {
    const branchUsers = AppState.users.filter(u => u.branchId === b.id);
    const branchIncharge = AppState.users.find(u => u.branchId === b.id && u.role === "branch_incharge");
    const branchOnLeave = onLeaveList.filter(l => l.branchId === b.id).length;
    const branchOnDuty = Math.max(0, branchUsers.length - branchOnLeave);
    const statusText = branchOnLeave > 0 ? `${branchOnLeave} अवकाश पर` : "100% उपस्थित";
    csvContent += `${idx + 1},"${b.name}","${branchIncharge ? branchIncharge.name : 'नोडल अधिकारी'}",${branchUsers.length},${branchOnDuty},${branchOnLeave},"${statusText}"\n`;
  });

  const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", `Cyber_Daily_Sitrep_${dateStr}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  showToast(`दैनिक रोज़नामचा CSV (${dateStr}) सफलतापूर्वक डाउनलोड हुई।`, "success");
}

function renderDailySitrep(container) {
  if (!container) return;

  const user = AppState.currentUser;
  const canViewSitrep = user && (user.role === "sp_cyber" || user.role === "admin" || user.id === "INCH-ADMIN");

  if (!canViewSitrep) {
    container.innerHTML = `
      <div style="background: #fff; border-radius: 12px; border: 1px solid #fee2e2; padding: 40px 24px; text-align: center; max-width: 600px; margin: 40px auto; box-shadow: var(--shadow-sm);">
        <div style="width: 56px; height: 56px; border-radius: 50%; background: #fee2e2; color: #dc2626; display: flex; align-items: center; justify-content: center; margin: 0 auto 16px; font-size: 1.6rem;">🔒</div>
        <h3 style="color: #991b1b; font-size: 1.2rem; margin-bottom: 8px;">पहुंच प्रतिबंधित (Access Restricted)</h3>
        <p style="color: #64748b; font-size: 0.9rem; margin-bottom: 20px;">
          दैनिक नफरी एवं अवकाश रोज़नामचा (Sitrep) देखने व प्रिंट करने की अनुमति केवल <strong>पुलिस अधीक्षक (SP Cyber)</strong> एवं <strong>रीडर पटल (Reader Desk)</strong> को है।
        </p>
        <button class="btn btn-primary" onclick="switchTab('dashboard')">डैशबोर्ड पर वापस जाएं</button>
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
          दैनिक नफरी व अवकाश रोज़नामचा (Daily Force & Leave Sitrep)
        </h2>
        <p>हरियाणा राज्य साइबर अपराध मुख्यालय, पंचकूला | A4 प्रिंटेबल जनरल डायरी रोज़नामचा रिपोर्ट</p>
      </div>

      <div style="display: flex; gap: 8px; align-items: center; flex-wrap: wrap;">
        <!-- Date Selector -->
        <div style="display: flex; align-items: center; gap: 6px; background: #fff; padding: 4px 10px; border-radius: 6px; border: 1px solid #cbd5e1;">
          <label style="font-size: 0.8rem; font-weight: 700; color: #475569; margin: 0;">दिनांक:</label>
          <input type="date" value="${targetDate}" onchange="changeSitrepDate(this.value)" class="form-control" style="padding: 4px 8px; font-size: 0.84rem; border: none; width: auto; font-weight: 600;">
        </div>

        <button class="btn btn-sm ${isToday ? 'btn-primary' : 'btn-outline'}" onclick="setSitrepQuickDate(0)" title="आज की रिपोर्ट">आज</button>
        <button class="btn btn-sm btn-outline" onclick="setSitrepQuickDate(1)" title="कल की रिपोर्ट">कल</button>
        <button class="btn btn-sm btn-outline" onclick="setSitrepQuickDate(-1)" title="बीते कल की रिपोर्ट">बीता कल</button>

        <button class="btn btn-gold btn-sm" onclick="printSitrepReport()">
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="6 9 6 2 18 2 18 9"></polyline><path d="M6 18H4a2 2 0 0 1-2-2v-5a2 2 0 0 1 2-2h16a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2h-2"></path><rect x="6" y="14" width="12" height="8"></rect></svg>
          प्रिंट / A4 रिपोर्ट (Print Sitrep)
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
        <div class="sitrep-title">दैनिक नफरी एवं अवकाश रोज़नामचा रिपोर्ट (Daily Sitrep / GD Entry)</div>
        <div class="sitrep-subtitle">हरियाणा राज्य साइबर अपराध शाखा, सेक्टर 20, पंचकूला | सक्षम प्राधिकारी: Mayank Gupta, IPS, SP Cyber Crime</div>
        
        <div class="sitrep-meta-bar">
          <div>रपट दिनांक: <strong>${displayDate}</strong></div>
          <div>रपट पंजी क्रमांक: <strong>CYB/PKL/ROZ/${targetDate.replace(/-/g, '')}/01</strong></div>
          <div>सत्र / समय: <strong>09:00 AM (मॉर्निंग परेड व रवानगी स्थिति)</strong></div>
        </div>
      </div>

      <!-- SITREP SUMMARY METRIC GRID -->
      <div class="sitrep-summary-grid">
        <div class="sitrep-metric-card navy">
          <div class="sitrep-metric-title">कुल स्वीकृत नफरी (Total Force)</div>
          <div class="sitrep-metric-num">${totalForce}</div>
          <small style="color: #64748b; font-size: 0.72rem;">पंजीकृत साइबर पुलिस बल</small>
        </div>

        <div class="sitrep-metric-card green">
          <div class="sitrep-metric-title">ड्यूटी पर उपस्थित (On Duty)</div>
          <div class="sitrep-metric-num" style="color: #15803d;">${onDutyCount}</div>
          <small style="color: #15803d; font-size: 0.72rem;">विभिन्न विंग्स व डेस्क पर तैनात</small>
        </div>

        <div class="sitrep-metric-card amber">
          <div class="sitrep-metric-title">स्वीकृत अवकाश पर (On Leave)</div>
          <div class="sitrep-metric-num" style="color: #b45309;">${onLeaveCount}</div>
          <small style="color: #b45309; font-size: 0.72rem;">सक्षम स्तर से आदेशित</small>
        </div>

        <div class="sitrep-metric-card blue">
          <div class="sitrep-metric-title">1930 हेल्पलाइन डेस्क</div>
          <div class="sitrep-metric-num" style="color: #1d4ed8;">${helplineOnDuty} / ${helplineUsers.length}</div>
          <small style="color: #1d4ed8; font-size: 0.72rem;">24x7 कॉल सेंटर सक्रिय नफरी</small>
        </div>

        <div class="sitrep-metric-card navy">
          <div class="sitrep-metric-title">स्टेशन लीव (HQ से बाहर)</div>
          <div class="sitrep-metric-num" style="color: #6b21a8;">${stationLeaveCount}</div>
          <small style="color: #6b21a8; font-size: 0.72rem;">मुख्यालय त्याग अनुमति प्राप्त</small>
        </div>
      </div>

      <!-- SECTION 1: PERSONNEL CURRENTLY ON LEAVE -->
      <div class="sitrep-section-header">
        <span>भाग - 1: आज अवकाश पर रहने वाले पुलिस जवानों की सूची (Personnel on Sanctioned Leave)</span>
        <span style="font-size: 0.78rem; font-weight: normal; color: #475569;">दिनांक: ${displayDate}</span>
      </div>

      ${onLeaveLeaves.length === 0 ? `
        <div style="background: #f0fdf4; border: 1px dashed #86efac; border-radius: 6px; padding: 22px; text-align: center; color: #166534; margin-bottom: 20px;">
          <div style="font-size: 1.1rem; font-weight: 700;">✓ चयनित तिथि को कोई भी पुलिस कर्मी अवकाश पर नहीं है।</div>
          <div style="font-size: 0.85rem; margin-top: 4px; color: #15803d;">मुख्यालय की समस्त 13 शाखाओं की कुल ${totalForce} नफरी पूर्णतः ऑन-ड्यूटी उपस्थित है।</div>
        </div>
      ` : `
        <table class="sitrep-table">
          <thead>
            <tr>
              <th style="width: 40px; text-align: center;">क्र.</th>
              <th>नाम, पद व बेल्ट नं.</th>
              <th>संबद्ध शाखा (Branch)</th>
              <th>अवकाश का प्रकार</th>
              <th>अवकाश अवधि (From - To)</th>
              <th style="text-align: center;">कुल दिन</th>
              <th>स्टेशन लीव / गंतव्य</th>
              <th>आपातकालीन मोबाइल</th>
              <th>वापसी ड्यूटी संभावित</th>
            </tr>
          </thead>
          <tbody>
            ${onLeaveLeaves.map((l, idx) => {
              let returnDateStr = "अगले कार्यदिवस";
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
                    <small style="color: #64748b;">${l.leaveTypeName}</small>
                  </td>
                  <td>
                    <strong>${formatDate(l.fromDate)}</strong> से<br>
                    <strong>${formatDate(l.toDate)}</strong>
                  </td>
                  <td style="text-align: center; font-weight: 700; color: #0f172a;">${l.totalDays} दिन</td>
                  <td>
                    ${l.stationLeave ? `
                      <span style="color: #b45309; font-weight: 700;">★ स्टेशन लीव</span><br>
                      <small style="color: #475569;">${l.stationDestination || l.stationLeaveAddress || 'स्वीकृत पते पर'}</small>
                    ` : `
                      <span style="color: #166534; font-weight: 600;">मुख्यालय पर</span>
                    `}
                  </td>
                  <td><strong>${l.emergencyContact || '-'}</strong></td>
                  <td><strong style="color: #15803d;">${returnDateStr}</strong></td>
                </tr>
              `;
            }).join("")}
          </tbody>
        </table>
      `}

      <!-- SECTION 2: 13 BRANCHES FORCE STRENGTH MATRIX -->
      <div class="sitrep-section-header">
        <span>भाग - 2: समस्त 13 साइबर शाखाओं की नफरी व उपस्थिति स्थिति (13 Branches Deployment Matrix)</span>
        <span style="font-size: 0.78rem; font-weight: normal; color: #475569;">कुल शाखाएं: 13 | मुख्यालय पंचकूला</span>
      </div>

      <table class="sitrep-table">
        <thead>
          <tr>
            <th style="width: 40px; text-align: center;">क्र.</th>
            <th>शाखा का नाम (Cyber Branch)</th>
            <th>शाखा प्रभारी (Branch Incharge)</th>
            <th style="text-align: center;">स्वीकृत नफरी</th>
            <th style="text-align: center;">ड्यूटी उपस्थित</th>
            <th style="text-align: center;">अवकाश पर</th>
            <th>संचालन स्थिति (Operational Status)</th>
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
                  <strong>${b.hindi || b.name}</strong><br>
                  <small style="color: #64748b;">${b.name}</small>
                </td>
                <td>
                  ${incharge ? `<strong>${incharge.name}</strong><br><small style="color: #64748b;">${incharge.rank}</small>` : '<span style="color: #94a3b8;">नोडल अधिकारी</span>'}
                </td>
                <td style="text-align: center; font-weight: 700;">${branchUsers.length}</td>
                <td style="text-align: center; font-weight: 700; color: #15803d;">${branchOnDuty}</td>
                <td style="text-align: center; font-weight: 700; color: ${branchOnLeave > 0 ? '#dc2626' : '#64748b'};">${branchOnLeave}</td>
                <td>
                  ${isFullStrength ? `
                    <span style="display: inline-flex; align-items: center; gap: 4px; color: #15803d; font-weight: 600; font-size: 0.78rem;">
                      <span style="width: 7px; height: 7px; border-radius: 50%; background: #16a34a;"></span>
                      पूर्ण सक्रिय (100% On-Duty)
                    </span>
                  ` : `
                    <span style="display: inline-flex; align-items: center; gap: 4px; color: #b45309; font-weight: 600; font-size: 0.78rem;">
                      <span style="width: 7px; height: 7px; border-radius: 50%; background: #f59e0b;"></span>
                      सक्रिय (${branchOnDuty} उपस्थित, ${branchOnLeave} अवकाश पर)
                    </span>
                  `}
                </td>
              </tr>
            `;
          }).join("")}
        </tbody>
      </table>

      <!-- OFFICIAL VERIFICATION & SIGNATURES BLOCK -->
      <div class="sitrep-signature-block">
        <div class="sitrep-sig-box">
          <div style="font-size: 0.78rem; color: #64748b;">तैयारकर्ता / उपस्थिति मिलान:</div>
          <div class="sitrep-sig-line">
            मुंशी / रीडर एसपी साइबर<br>
            <span style="font-size: 0.76rem; font-weight: normal; color: #64748b;">Reader to SP Cyber Crime, Panchkula</span>
          </div>
        </div>

        <div class="sitrep-sig-box">
          <div style="font-size: 0.78rem; color: #64748b;">सत्यापनकर्ता अधिकारी:</div>
          <div class="sitrep-sig-line">
            डीएसपी साइबर / नोडल अधिकारी<br>
            <span style="font-size: 0.76rem; font-weight: normal; color: #64748b;">DSP Cyber / Establishment Incharge</span>
          </div>
        </div>

        <div class="sitrep-sig-box">
          <div style="font-size: 0.78rem; color: #64748b;">सक्षम स्वीकृति प्राधिकारी:</div>
          <div class="sitrep-sig-line">
            Mayank Gupta, IPS<br>
            <span style="font-size: 0.76rem; font-weight: 600; color: #0f274c;">पुलिस अधीक्षक, राज्य साइबर अपराध</span><br>
            <span style="font-size: 0.74rem; font-weight: normal; color: #64748b;">पंचकूला (हरियाणा)</span>
          </div>
        </div>
      </div>

      <div style="margin-top: 18px; font-size: 0.74rem; color: #94a3b8; text-align: center; border-top: 1px dotted #cbd5e1; padding-top: 8px;">
        यह दैनिक रोज़नामचा रपट हरियाणा राज्य साइबर अपराध मुख्यालय पंचकूला के डिजिटल अवकाश प्रबंधन सर्वर द्वारा स्वतः संकलित की गई है।
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

  const isPendingIncharge = leave.status === "PENDING_INCHARGE";
  const isRecommended = leave.status === "RECOMMENDED";
  const isApproved = leave.status === "APPROVED";
  const isRejected = leave.status === "REJECTED";

  modalBody.innerHTML = `
    <!-- STEPPER -->
    <div class="stepper-box">
      <div class="step-node completed">
        <div class="step-circle">1</div>
        <div class="step-label">आवेदन दर्ज (Applied)</div>
      </div>
      <div class="step-node ${isRecommended || isApproved ? 'completed' : (isPendingIncharge ? 'active' : '')}">
        <div class="step-circle">${isRecommended || isApproved ? '✓' : '2'}</div>
        <div class="step-label">शाखा प्रभारी अनुशंसा</div>
      </div>
      <div class="step-node ${isApproved ? 'completed' : (isRecommended ? 'active' : '')}">
        <div class="step-circle">${isApproved ? '✓' : '3'}</div>
        <div class="step-label">एसपी साइबर स्वीकृति</div>
      </div>
      <div class="step-node ${isApproved ? 'completed' : ''}">
        <div class="step-circle">${isApproved ? '★' : '4'}</div>
        <div class="step-label">आदेश निर्गत</div>
      </div>
    </div>

    <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 14px; font-size: 0.88rem;">
      <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
        <span style="color: #64748b; font-size: 0.78rem;">आवेदक:</span><br>
        <strong>${leave.applicantName}</strong> (${leave.rank})<br>
        बेल्ट नं: <strong>${leave.beltNo}</strong><br>
        शाखा: <strong>${leave.branchName}</strong>
      </div>

      <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
        <span style="color: #64748b; font-size: 0.78rem;">अवकाश विवरण:</span><br>
        प्रकार: <strong>${leave.leaveTypeName}</strong><br>
        अवधि: <strong>${formatDate(leave.fromDate)}</strong> से <strong>${formatDate(leave.toDate)}</strong><br>
        कुल दिन: <strong>${leave.totalDays} दिन</strong>
        ${leave.isHalfDay ? `<br><span style="color: #b45309; font-weight: 600;">(आधा दिन / 0.5 Day: ${leave.halfDayShift})</span>` : ''}
        ${leave.prefixDays > 0 || leave.suffixDays > 0 ? `<br><small style="color: #475569;">प्रीफिक्स: ${leave.prefixDays || 0} दिन | सफिक्स: ${leave.suffixDays || 0} दिन</small>` : ''}
      </div>

      <!-- CURTAILMENT / REDUCTION NOTICE IF APPLICABLE -->
      ${leave.originalDays && leave.originalDays !== leave.totalDays ? `
        <div style="grid-column: 1 / -1; background: #fffbeb; border: 1px solid #fef08a; padding: 12px 16px; border-radius: 8px;">
          <span style="color: #92400e; font-weight: 700;">✂️ अवकाश दिवस में कटौती विवरण (Curtailment Note):</span>
          <div style="color: #78350f; font-size: 0.82rem; margin-top: 4px;">
            मूल आवेदित अवकाश: <strong>${leave.originalDays} दिन</strong> (${formatDate(leave.fromDate)} से ${formatDate(leave.originalToDate)}) ➔ 
            घटाकर स्वीकृत/अनुशंसित: <strong>${leave.totalDays} दिन</strong> (${formatDate(leave.fromDate)} से ${formatDate(leave.toDate)})<br>
            कटौती करने वाले अधिकारी: <strong>${leave.curtailedBy || 'सक्षम अधिकारी'}</strong>
            ${leave.curtailReason ? `<br>कारण: <em>"${leave.curtailReason}"</em>` : ''}
          </div>
        </div>
      ` : ''}

      <div style="grid-column: 1 / -1; background: #fff; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px;">
        <span style="color: #64748b; font-size: 0.78rem;">अवकाश का कारण (Reason):</span><br>
        <p style="margin-top: 4px;">${leave.reason}</p>
      </div>

      <!-- COURT EVIDENCE / DUTY HANDOVER IF APPLICABLE -->
      ${leave.courtDuty ? `
        <div style="grid-column: 1 / -1; background: #fefce8; border: 1px solid #fef08a; padding: 12px; border-radius: 8px; font-size: 0.84rem;">
          <span style="color: #854d0e; font-weight: 700;">⚖️ न्यायालयीन गवाही / पेशी विवरण:</span>
          <div style="color: #713f12; margin-top: 4px;">
            केस / अदालत: <strong>${leave.courtCaseDetails || 'उल्लिखित'}</strong><br>
            केस डायरी व पैरवी सुपुर्द: <strong>${leave.courtHandoverOfficer || 'नामित सहकर्मी'}</strong>
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
                <div style="font-size: 0.74rem; color: #64748b;">आकार: ${leave.attachment.size || 'उपलब्ध'} | प्रकार: ${leave.attachment.type || 'दस्तावेज'}</div>
              </div>
            </div>
            <button class="btn btn-primary btn-sm" onclick="viewAttachment('${leave.id}')">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
              दस्तावेज देखें (View)
            </button>
          </div>
        ` : `
          <div style="background: #f8fafc; border: 1px dashed #cbd5e1; padding: 10px; border-radius: 8px; text-align: center; color: #64748b; font-size: 0.8rem;">
            कोई दस्तावेज संलग्न नहीं किया गया है (No Attachment Attached)
          </div>
        `}
      </div>

      ${leave.stationLeave ? `
        <div style="grid-column: 1 / -1; background: #fffbeb; border: 1px solid #fef3c7; padding: 12px; border-radius: 8px;">
          <span style="color: #92400e; font-weight: 700; font-size: 0.82rem;">★ स्टेशन लीव विस्तृत विवरण (Station Leave / Out-of-HQ Itinerary):</span>
          <div style="margin-top: 6px; font-size: 0.84rem; color: #78350f; display: grid; grid-template-columns: 1fr 1fr; gap: 8px;">
            <div>गंतव्य: <strong>${leave.stationDestination || 'उल्लिखित नहीं'}</strong></div>
            <div>स्थानीय थाना: <strong>${leave.stationLocalPS || '-'}</strong></div>
            <div>यात्रा साधन: <strong>${leave.stationTravelMode || '-'}</strong></div>
            <div>आपातकालीन परिजन संपर्क: <strong>${leave.stationFamilyContact || '-'}</strong></div>
            <div style="grid-column: 1 / -1;">बाहर ठहरने का पता: <strong>${leave.stationLeaveAddress || '-'}</strong></div>
          </div>
        </div>
      ` : ""}

      <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
        <span style="color: #64748b; font-size: 0.78rem;">प्रभार सौंपा गया (Handover):</span><br>
        <strong>${leave.handoverTo || "शाखा प्रभारी"}</strong>
      </div>

      <div style="background: #f8fafc; padding: 12px; border-radius: 8px;">
        <span style="color: #64748b; font-size: 0.78rem;">आपातकालीन मोबाइल:</span><br>
        <strong>${leave.emergencyContact}</strong>
      </div>

      <!-- APPROVAL AUDIT LOG -->
      <div style="grid-column: 1 / -1; border-top: 1px solid #e2e8f0; padding-top: 14px; margin-top: 6px;">
        <h5 style="color: #0f274c; font-weight: 700; margin-bottom: 8px;">स्वीकृति / अनुशंसा विवरण (Audit Trail)</h5>
        <div style="display: flex; flex-direction: column; gap: 8px; font-size: 0.82rem;">
          <div style="padding: 8px 12px; background: #f1f5f9; border-radius: 6px;">
            <strong>1. आवेदन दर्ज:</strong> ${leave.appliedAt} द्वारा ${leave.applicantName}
          </div>
          <div style="padding: 8px 12px; background: ${leave.inchargeActionAt ? '#eff6ff' : '#f8fafc'}; border-radius: 6px;">
            <strong>2. शाखा प्रभारी टिप्पणी:</strong> ${leave.inchargeRemarks || "विचाराधीन (Awaiting Review)"}
            ${leave.inchargeActionAt ? `<br><small style="color: #64748b;">दिनांक: ${leave.inchargeActionAt}</small>` : ''}
          </div>
          <div style="padding: 8px 12px; background: ${leave.spActionAt ? '#f0fdf4' : '#f8fafc'}; border-radius: 6px;">
            <strong>3. एसपी साइबर महोदय का आदेश:</strong> ${leave.spRemarks || "विचाराधीन (Awaiting SP Approval)"}
            ${leave.spActionAt ? `<br><small style="color: #64748b;">स्वीकृति आदेश क्रमांक: ${leave.sanctionNo} | दिनांक: ${leave.spActionAt}</small>` : ''}
          </div>
        </div>
      </div>
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
        अवकाश: <strong>${leave.leaveTypeName}</strong> | आवेदित अवधि: <strong>${leave.totalDays} दिन</strong> (${formatDate(leave.fromDate)} से ${formatDate(leave.toDate)})
      </div>
      <div style="margin-top: 6px; color: #1e293b;">
        कारण: <em>"${leave.reason}"</em>
      </div>

      <!-- ATTACHMENT CARD IF PRESENT -->
      ${leave.attachment ? `
        <div style="margin-top: 10px; padding: 8px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 0.82rem; color: #1e40af;">📎 संलग्न दस्तावेज: <strong>${leave.attachment.name}</strong></span>
          <button type="button" class="btn btn-outline btn-sm" onclick="viewAttachment('${leave.id}')" style="background: #fff;">दस्तावेज देखें</button>
        </div>
      ` : ''}

      ${leave.stationLeave ? `<div style="color: #b45309; font-weight: 600; margin-top: 6px;">⚠ स्टेशन लीव अनुमति मांगी गई है (${leave.stationLeaveAddress})</div>` : ''}
    </div>

    <!-- CURTAIL / REDUCE LEAVE DAYS CONTROL -->
    <div class="curtail-control-box">
      <div class="curtail-header">
        <span>✂️ क्या अवकाश के दिन कम करने हैं? (Reduce / Curtail Leave Days?)</span>
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.82rem; font-weight: normal; color: #451a03;">
          <input type="checkbox" id="inchargeCurtailCheck" onchange="toggleInchargeCurtail(this)">
          दिन घटाएं (Reduce Days)
        </label>
      </div>
      <div id="inchargeCurtailFields" style="display: none; margin-top: 10px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="font-size: 0.78rem; font-weight: 600; color: #78350f;">प्रारंभिक तिथि (From Date):</label>
            <input type="text" class="form-control" value="${formatDate(leave.fromDate)}" readonly>
          </div>
          <div>
            <label style="font-size: 0.78rem; font-weight: 600; color: #78350f;">नई समाप्ति तिथि (New To Date):</label>
            <input type="date" id="inchargeNewToDate" class="form-control" min="${leave.fromDate}" max="${leave.toDate}" value="${leave.toDate}" onchange="calculateInchargeCurtailDays()">
          </div>
        </div>
        <div id="inchargeCurtailPreview" style="margin-top: 8px; font-size: 0.82rem; color: #b45309; font-weight: 600;"></div>
      </div>
    </div>

    <div class="form-group">
      <label for="inchargeRemarksText">शाखा प्रभारी की टिप्पणी / अनुशंसा (Incharge Remarks) <span class="required">*</span></label>
      <textarea id="inchargeRemarksText" class="form-control" rows="3" placeholder="उदा: अनुशंसित। इस दौरान हेल्पलाइन / शाखा में अन्य जवानों की ड्यूटी समायोजित कर ली गई है।"></textarea>
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
    preview.innerHTML = `<span style="color: #dc2626;">त्रुटि: नई समाप्ति तिथि प्रारंभिक तिथि से पहले नहीं हो सकती।</span>`;
    return;
  }

  const diffTime = Math.abs(newToDate - fromDate);
  const newDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const originalDays = leave.originalDays || leave.totalDays;
  const cutDays = originalDays - newDays;

  if (cutDays < 0) {
    preview.innerHTML = `<span style="color: #dc2626;">त्रुटि: आप केवल दिन कम कर सकते हैं (अधिकतम ${originalDays} दिन)।</span>`;
  } else if (cutDays === 0) {
    preview.innerHTML = `दिन में कोई कटौती नहीं (कुल: <strong>${newDays} दिन</strong>)`;
  } else {
    preview.innerHTML = `✂️ संशोधित अवधि: <strong>${formatDate(leave.fromDate)}</strong> से <strong>${formatDate(newToVal)}</strong> (कुल <strong>${newDays} दिन</strong>) | <strong>${cutDays} दिन कम</strong> किए जा रहे हैं।`;
  }
}

function submitInchargeDecision(action) {
  const leave = AppState.selectedLeaveForAction;
  if (!leave) return;

  let remarks = document.getElementById("inchargeRemarksText")?.value.trim() || "";
  if (!remarks) {
    alert("कृपया अपनी अनुशंसा या कारण टिप्पणी अवश्य दर्ज करें।");
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
        leave.curtailedBy = `शाखा प्रभारी (${AppState.currentUser.name})`;
        leave.curtailReason = `शाखा प्रभारी द्वारा नफरी व्यवस्था हेतु दिन घटाकर ${newDays} दिन अनुशंसित किए गए`;

        remarks += ` [नोट: शाखा प्रभारी द्वारा प्रशासनिक आवश्यकता हेतु अवकाश मूल ${leave.originalDays} दिन से घटाकर ${newDays} दिन अनुशंसित]`;
      }
    }

    leave.inchargeRemarks = remarks;
    leave.inchargeActionAt = now;
    leave.status = "RECOMMENDED";
    showToast(`आवेदन ${leave.id} (${leave.totalDays} दिन) अनुशंसित कर पुलिस अधीक्षक महोदय को अग्रेषित किया गया।`, "success");
  } else {
    leave.inchargeRemarks = remarks;
    leave.inchargeActionAt = now;
    leave.status = "REJECTED";
    showToast(`आवेदन ${leave.id} शाखा स्तर पर अस्वीकृत किया गया।`, "error");
  }

  saveData();
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
        <strong>${leave.applicantName} (${leave.rank}) - बेल्ट नं: ${leave.beltNo}</strong>
        <span class="branch-tag">${leave.branchName}</span>
      </div>
      <div style="margin-top: 6px;">
        अवकाश: <strong>${leave.leaveTypeName}</strong> | वर्तमान अवधि: <strong>${leave.totalDays} दिन</strong> (${formatDate(leave.fromDate)} से ${formatDate(leave.toDate)})
        ${leave.originalDays && leave.originalDays !== leave.totalDays ? `
          <br><span style="color: #b45309; font-weight: 600;">(मूल आवेदन: ${leave.originalDays} दिन - शाखा प्रभारी द्वारा पहले ही घटाया गया)</span>
        ` : ''}
      </div>
      <div style="margin-top: 6px;">
        कारण: <em>"${leave.reason}"</em>
      </div>

      <!-- ATTACHMENT CARD IF PRESENT -->
      ${leave.attachment ? `
        <div style="margin-top: 10px; padding: 8px 12px; background: #eff6ff; border: 1px solid #bfdbfe; border-radius: 6px; display: flex; align-items: center; justify-content: space-between;">
          <span style="font-size: 0.82rem; color: #1e40af;">📎 संलग्न दस्तावेज: <strong>${leave.attachment.name}</strong></span>
          <button type="button" class="btn btn-outline btn-sm" onclick="viewAttachment('${leave.id}')" style="background: #fff;">दस्तावेज देखें</button>
        </div>
      ` : ''}

      <div style="margin-top: 8px; padding: 8px 12px; background: #e0e7ff; border-radius: 6px; color: #1e1b4b;">
        <strong>शाखा प्रभारी की अनुशंसा:</strong> "${leave.inchargeRemarks || 'अग्रेषित'}"
      </div>
      ${leave.stationLeave ? `<div style="color: #b45309; font-weight: 700; margin-top: 6px;">★ स्टेशन लीव अनुमति मांगी गई है: ${leave.stationLeaveAddress}</div>` : ''}
    </div>

    <!-- SP CURTAIL / REDUCE DAYS CONTROL -->
    <div class="curtail-control-box">
      <div class="curtail-header">
        <span>✂️ एसपी महोदय द्वारा अवकाश दिवस कम / संशोधित करना (Curtail by SP Cyber)</span>
        <label style="display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 0.82rem; font-weight: normal; color: #451a03;">
          <input type="checkbox" id="spCurtailCheck" onchange="toggleSPCurtail(this)">
          दिन घटाकर स्वीकृत करें
        </label>
      </div>
      <div id="spCurtailFields" style="display: none; margin-top: 10px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
          <div>
            <label style="font-size: 0.78rem; font-weight: 600; color: #78350f;">प्रारंभ तिथि:</label>
            <input type="text" class="form-control" value="${formatDate(leave.fromDate)}" readonly>
          </div>
          <div>
            <label style="font-size: 0.78rem; font-weight: 600; color: #78350f;">स्वीकृत नई समाप्ति तिथि (Sanctioned To Date):</label>
            <input type="date" id="spNewToDate" class="form-control" min="${leave.fromDate}" max="${leave.toDate}" value="${leave.toDate}" onchange="calculateSPCurtailDays()">
          </div>
        </div>
        <div id="spCurtailPreview" style="margin-top: 8px; font-size: 0.82rem; color: #b45309; font-weight: 600;"></div>
      </div>
    </div>

    <div class="form-group">
      <label for="spRemarksText">पुलिस अधीक्षक का आदेश / टिप्पणी (SP Cyber Sanction Order Remarks)</label>
      <input type="text" id="spRemarksText" class="form-control" value="अवकाश एवं स्टेशन लीव अनुमति नियमानुसार स्वीकृत की जाती है।" placeholder="स्वीकृति आदेश टिप्पणी">
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
    preview.innerHTML = `<span style="color: #dc2626;">त्रुटि: नई समाप्ति तिथि प्रारंभिक तिथि से पहले नहीं हो सकती।</span>`;
    return;
  }

  const diffTime = Math.abs(newToDate - fromDate);
  const newDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24)) + 1;
  const currentDays = leave.totalDays;
  const cutDays = currentDays - newDays;

  if (cutDays < 0) {
    preview.innerHTML = `<span style="color: #dc2626;">त्रुटि: स्वीकृत दिन वर्तमान ${currentDays} दिन से अधिक नहीं हो सकते।</span>`;
  } else if (cutDays === 0) {
    preview.innerHTML = `दिन में कोई कटौती नहीं (स्वीकृत: <strong>${newDays} दिन</strong>)`;
  } else {
    preview.innerHTML = `★ एसपी महोदय द्वारा संशोधित: <strong>${formatDate(leave.fromDate)}</strong> से <strong>${formatDate(newToVal)}</strong> (कुल <strong>${newDays} दिन स्वीकृत</strong>) | <strong>${cutDays} दिन कम</strong> किए गए।`;
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
        leave.curtailReason = `एसपी साइबर द्वारा प्रशासनिक आधार पर दिन घटाकर ${newDays} दिन स्वीकृत किए गए`;

        remarks += ` [आदेश: एसपी साइबर द्वारा प्रशासनिक आधार पर अवकाश घटाकर ${newDays} दिन स्वीकृत किया गया]`;
      }
    }

    leave.spRemarks = remarks;
    leave.spActionAt = now;
    leave.status = "APPROVED";

    // Deduct only final sanctioned leave balance from applicant
    const applicant = AppState.users.find(u => u.id === leave.applicantId);
    if (applicant && applicant.leaveBalances && applicant.leaveBalances[leave.leaveType] !== undefined) {
      applicant.leaveBalances[leave.leaveType] = Math.max(0, applicant.leaveBalances[leave.leaveType] - leave.totalDays);
    }

    showToast(`अवकाश स्वीकृत! आदेश क्रमांक ${leave.sanctionNo} जारी किया गया (${leave.totalDays} दिन)।`, "success");
  } else {
    leave.spRemarks = remarks;
    leave.spActionAt = now;
    leave.status = "REJECTED";
    showToast(`आवेदन ${leave.id} निरस्त (Reject) कर दिया गया।`, "error");
  }

  saveData();
  closeModals();
  renderApp();
}

// ATTACHMENT VIEWER FUNCTION
function viewAttachment(leaveId) {
  const leave = AppState.leaves.find(l => l.id === leaveId);
  if (!leave || !leave.attachment) {
    alert("इस आवेदन के साथ कोई दस्तावेज संलग्न नहीं है।");
    return;
  }

  const att = leave.attachment;
  const modal = document.getElementById("attachmentPreviewModal");
  const titleEl = document.getElementById("attachmentModalTitle");
  const contentEl = document.getElementById("attachmentPreviewContent");
  const downloadBtn = document.getElementById("attachmentDownloadBtn");

  if (titleEl) titleEl.innerHTML = `संलग्न दस्तावेज: <strong>${att.name}</strong> (${att.size || ''})`;

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
        <p style="color: #64748b; font-size: 0.85rem; margin-top: 6px;">आकार: ${att.size} | प्रकार: ${att.type}</p>
        <p style="margin-top: 14px;">दस्तावेज को देखने हेतु कृपया नीचे दिए गए बटन से डाउनलोड करें।</p>
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
        OFFICE ORDER / अवकाश स्वीकृति आदेश
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
  const branchSelect = document.getElementById("newUserBranch");
  if (branchSelect) {
    branchSelect.innerHTML = AppState.branches.map(b => `<option value="${b.id}">${b.name}</option>`).join("");
  }
  document.getElementById("addUserModal").classList.add("active");
}

function handleAddUserSubmit(e) {
  e.preventDefault();
  const name = document.getElementById("newUserName").value.trim();
  const beltNo = document.getElementById("newUserBelt").value.trim();
  const rank = document.getElementById("newUserRank").value;
  const branchId = document.getElementById("newUserBranch").value;
  const mobile = document.getElementById("newUserMobile").value.trim();
  const role = document.getElementById("newUserRole").value;

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
  showToast(`नया पुलिस कर्मी ${name} (${beltNo}) सफलतापूर्वक जोड़ा गया।`, "success");
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
