import { openDatabase } from "./database.js";
import { seedDefaultAccountIfNeeded } from "./accounts.js";
import { seedDefaultCategoriesIfNeeded } from "./categories.js";
import {
  renderDashboard,
  renderTransactions,
  renderAccounts,
  renderPlanned,
  renderReserved,
  renderReports,
  renderSettings,
  setRefreshCallback,
  openQuickAddMenu,
} from "./ui.js";
import { showToast } from "./modal.js";

const VIEW_RENDERERS = {
  dashboard: renderDashboard,
  transactions: renderTransactions,
  accounts: renderAccounts,
  planned: renderPlanned,
  reserved: renderReserved,
  reports: renderReports,
  settings: renderSettings,
};

let currentView = "dashboard";

async function renderCurrentView() {
  const container = document.getElementById(`view-${currentView}`);
  try {
    await VIEW_RENDERERS[currentView](container);
  } catch (err) {
    console.error(`Failed to render ${currentView} view`, err);
    container.innerHTML = `<div class="view-header"><h1>Something went wrong</h1></div>
      <p class="empty-state">This screen couldn't load. Try switching to another tab and back, or reload the page.</p>`;
  }
}

function switchView(viewName) {
  currentView = viewName;
  document.querySelectorAll(".view").forEach((el) => {
    el.hidden = el.id !== `view-${viewName}`;
  });
  document.querySelectorAll(".nav-button").forEach((btn) => {
    btn.classList.toggle("nav-button-active", btn.dataset.view === viewName);
  });
  renderCurrentView();
}

function wireNavigation() {
  document.querySelectorAll(".nav-button").forEach((btn) => {
    btn.addEventListener("click", () => switchView(btn.dataset.view));
  });
  document.getElementById("sidebar-add-btn").addEventListener("click", () => openQuickAddMenu());
}

async function init() {
  try {
    await openDatabase();
    await seedDefaultAccountIfNeeded();
    await seedDefaultCategoriesIfNeeded();
  } catch (err) {
    console.error("Failed to initialize the database", err);
    document.getElementById("main-content").innerHTML = `
      <div class="view-header"><h1>Couldn't start Money Tracker</h1></div>
      <p class="empty-state">Your browser blocked local storage (IndexedDB). Try a different browser, or check that you aren't in strict private-browsing mode.</p>
    `;
    return;
  }

  setRefreshCallback(renderCurrentView);
  wireNavigation();
  switchView("dashboard");
}

init();
