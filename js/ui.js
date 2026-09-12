import { getAccounts, createAccount, updateAccount, archiveAccount, deleteAccountSafely, withBalances, ACCOUNT_TYPES } from "./accounts.js";
import { getTransactions, recordIncome, recordExpense, recordTransfer, recordWithdrawal, suggestWithdrawalFee, updateTransaction, deleteTransaction, filterTransactions } from "./transactions.js";
import { getCategories, addCategory, deleteCategory } from "./categories.js";
import { getPlannedExpenses, createPlannedExpense, markPlannedExpenseAsPaid, deletePlannedExpense, getUpcoming } from "./planned-expenses.js";
import { getAllocations, createAllocation, spendAllocation, deleteAllocation, getActiveAllocations } from "./allocations.js";
import { calculateTotalMoney, calculateMoneyByType, calculateAvailableMoney, calculateProjectedMoney, getDailySummary, getMonthlySummary, compareMonths, toYearMonth, previousYearMonth } from "./calculations.js";
import { buildHorizontalBarChart, buildLineChart } from "./charts.js";
import { pesosToCentavos, centavosToPesos, formatPeso, formatSignedPeso, formatPercent } from "./money.js";
import { openModal, closeModal, showToast, confirmDialog } from "./modal.js";
import { exportBackup, readBackupFile, restoreBackup } from "./backup.js";

const ACCOUNT_TYPE_LABELS = { cash: "Cash", bank: "Bank", ewallet: "E-wallet", other: "Other" };
const TRANSACTION_TYPE_LABELS = {
  income: "Income",
  expense: "Expense",
  transfer: "Transfer",
  withdrawal: "Withdrawal",
};

let refreshCallback = () => {};

export function setRefreshCallback(fn) {
  refreshCallback = fn;
}
async function refresh() {
  await refreshCallback();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function escapeHtml(str) {
  return String(str ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function categoryName(categories, id) {
  return categories.find((c) => c.id === id)?.name || "Uncategorized";
}

function accountName(accounts, id) {
  return accounts.find((a) => a.id === id)?.name || "Unknown account";
}

function accountOptions(accounts, selectedId) {
  return accounts
    .map((a) => `<option value="${a.id}" ${a.id === selectedId ? "selected" : ""}>${escapeHtml(a.name)}</option>`)
    .join("");
}

function categoryOptions(categories, selectedId) {
  return categories
    .map((c) => `<option value="${c.id}" ${c.id === selectedId ? "selected" : ""}>${escapeHtml(c.name)}</option>`)
    .join("");
}

/* -------------------------------------------------------------------- */
/*  DASHBOARD                                                            */
/* -------------------------------------------------------------------- */

export async function renderDashboard(container) {
  const [accounts, transactions, allocations, plannedExpenses, categories] = await Promise.all([
    getAccounts(),
    getTransactions(),
    getAllocations(),
    getPlannedExpenses(),
    getCategories(),
  ]);

  const totalMoney = calculateTotalMoney(accounts, transactions);
  const byType = calculateMoneyByType(accounts, transactions);
  const { reserved, available } = calculateAvailableMoney(totalMoney, allocations);
  const { upcoming, projected } = calculateProjectedMoney(totalMoney, plannedExpenses);

  const currentMonth = toYearMonth(new Date());
  const monthSummary = getMonthlySummary(transactions, currentMonth);

  const upcomingItems = getUpcoming(plannedExpenses).slice(0, 5);
  const recentTransactions = transactions.slice(0, 6);

  const typeBreakdown = [
    { key: "cash", label: "Cash" },
    { key: "bank", label: "Bank Accounts" },
    { key: "ewallet", label: "E-Wallets" },
    { key: "other", label: "Other" },
  ].filter((t) => byType[t.key] > 0 || accounts.some((a) => a.type === t.key));

  container.innerHTML = `
    <div class="view-header">
      <h1>Dashboard</h1>
      <button class="button button-primary" data-open="quick-add">+ Add transaction</button>
    </div>

    <section class="hero-money">
      <p class="hero-label">Total money</p>
      <p class="hero-amount">${formatPeso(totalMoney)}</p>
      ${
        typeBreakdown.length > 1
          ? `<div class="hero-breakdown">
              ${typeBreakdown
                .map((t) => `<div><span class="breakdown-label">${t.label}</span><span class="breakdown-value">${formatPeso(byType[t.key] || 0)}</span></div>`)
                .join("")}
            </div>`
          : ""
      }
    </section>

    <section class="stat-row">
      <div class="stat-card">
        <p class="stat-label">Available money</p>
        <p class="stat-value">${formatPeso(available)}</p>
        ${reserved > 0 ? `<p class="stat-footnote">₱${(reserved / 100).toLocaleString("en-PH", { minimumFractionDigits: 2 })} reserved</p>` : `<p class="stat-footnote">Nothing reserved right now</p>`}
      </div>
      <div class="stat-card">
        <p class="stat-label">Projected money</p>
        <p class="stat-value">${formatPeso(projected)}</p>
        ${upcoming > 0 ? `<p class="stat-footnote">After ${formatPeso(upcoming)} in upcoming planned expenses</p>` : `<p class="stat-footnote">No upcoming planned expenses</p>`}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header"><h2>This month</h2></div>
      <div class="month-stats">
        <div><span class="month-stat-label">Income</span><span class="month-stat-value positive">${formatPeso(monthSummary.incomeCentavos)}</span></div>
        <div><span class="month-stat-label">Expenses</span><span class="month-stat-value negative">${formatPeso(monthSummary.expensesCentavos)}</span></div>
        <div><span class="month-stat-label">Saved</span><span class="month-stat-value ${monthSummary.savingsCentavos >= 0 ? "positive" : "negative"}">${formatPeso(monthSummary.savingsCentavos)}</span></div>
      </div>
    </section>

    <div class="two-column">
      <section class="panel">
        <div class="panel-header">
          <h2>Upcoming expenses</h2>
          <a href="#" data-nav="planned">View all</a>
        </div>
        ${
          upcomingItems.length === 0
            ? `<p class="empty-state">No upcoming expenses. Add a planned expense to keep track of what's coming.</p>`
            : `<ul class="simple-list">
                ${upcomingItems
                  .map(
                    (p) => `<li>
                      <span class="list-primary">${escapeHtml(p.description)}</span>
                      <span class="list-secondary">${formatDate(p.dueDate)}</span>
                      <span class="list-amount">${formatPeso(p.amountCentavos)}</span>
                    </li>`
                  )
                  .join("")}
              </ul>`
        }
      </section>

      <section class="panel">
        <div class="panel-header">
          <h2>Recent transactions</h2>
          <a href="#" data-nav="transactions">View all</a>
        </div>
        ${
          recentTransactions.length === 0
            ? `<p class="empty-state">No transactions yet. Start by adding your first income or expense.</p>`
            : `<ul class="simple-list">
                ${recentTransactions.map((t) => renderTransactionListItem(t, accounts, categories)).join("")}
              </ul>`
        }
      </section>
    </div>
<br>
    <section class="panel">
      <div class="panel-header" id="dashboard-category"><h2>Spending by category</h2></div>
      ${buildHorizontalBarChart(
        Object.entries(monthSummary.categoryTotals)
          .map(([categoryId, valueCentavos]) => ({ label: categoryName(categories, categoryId), valueCentavos }))
          .sort((a, b) => b.valueCentavos - a.valueCentavos)
          .slice(0, 8)
      )}
    </section>
  `;

  wireNavLinks(container);
  container.querySelector('[data-open="quick-add"]').addEventListener("click", () => openQuickAddMenu());
}

function formatDate(isoDate) {
  return new Date(`${isoDate}T00:00:00`).toLocaleDateString("en-PH", { month: "short", day: "numeric" });
}

function renderTransactionListItem(t, accounts, categories) {
  const isPositive = t.type === "income";
  const amountClass = t.type === "income" ? "positive" : t.type === "expense" ? "negative" : "";
  const sign = t.type === "income" ? "+" : t.type === "expense" ? "-" : "";
  let title;
  if (t.type === "transfer") title = `${accountName(accounts, t.accountId)} → ${accountName(accounts, t.toAccountId)}`;
  else if (t.type === "withdrawal") title = `Withdrawal · ${accountName(accounts, t.accountId)}`;
  else title = categoryName(categories, t.categoryId);

  return `<li>
    <span class="list-primary">${escapeHtml(title)}</span>
    <span class="list-secondary">${escapeHtml(t.note) || formatDate(t.date)}</span>
    <span class="list-amount ${amountClass}">${sign}${formatPeso(t.amountCentavos)}</span>
  </li>`;
}

function wireNavLinks(container) {
  container.querySelectorAll("[data-nav]").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      document.querySelector(`.nav-button[data-view="${link.dataset.nav}"]`)?.click();
    });
  });
}

/* -------------------------------------------------------------------- */
/*  QUICK ADD MENU + TRANSACTION FORMS                                   */
/* -------------------------------------------------------------------- */

export function openQuickAddMenu() {
  const body = openModal("Add", `
    <div class="quick-add-grid">
      <button type="button" class="quick-add-option" data-quick="income">
      <span class="quick-add-icon">
        <img src="assets/addIncome.png" alt="" aria-hidden="true">
      </span>
      Add income
    </button>
      <button type="button" class="quick-add-option" data-quick="expense">
      <span class="quick-add-icon">
        <img src="assets/addExpense.png" alt="" aria-hidden="true">
      </span>
      Add expense
    </button>
      <button type="button" class="quick-add-option" data-quick="transfer">
      <span class="quick-add-icon">
        <img src="assets/moveMoney.png" alt="" aria-hidden="true">
      </span>
      Move money
    </button>
      <button type="button" class="quick-add-option" data-quick="deposit">
      <span class="quick-add-icon">
        <img src="assets/depositMoney.png" alt="" aria-hidden="true">
      </span>
      Deposit money
    </button>
       <button type="button" class="quick-add-option" data-quick="withdrawal">
      <span class="quick-add-icon">
        <img src="assets/withdraw.png" alt="" aria-hidden="true">
      </span>
      Withdraw cash
    </button>
      <button type="button" class="quick-add-option" data-quick="planned">
      <span class="quick-add-icon">
        <img src="assets/plannedFinal.png" alt="" aria-hidden="true">
      </span>
      Planned expense
    </button>
      <button type="button" class="quick-add-option" data-quick="reserve">
      <span class="quick-add-icon">
        <img src="assets/savedMoney.png" alt="" aria-hidden="true">
      </span>
      Set aside money
    </button>
    </div>
  `);

  body.querySelectorAll("[data-quick]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const kind = btn.dataset.quick;
      if (kind === "income") openIncomeForm();
      else if (kind === "expense") openExpenseForm();
      else if (kind === "transfer") openTransferForm(false);
      else if (kind === "deposit") openTransferForm(true);
      else if (kind === "withdrawal") openWithdrawalForm();
      else if (kind === "planned") openPlannedExpenseForm();
      else if (kind === "reserve") openAllocationForm();
    });
  });
}

async function openIncomeForm(existing = null) {
  const [accounts, categories] = await Promise.all([getAccounts(), getCategories("income")]);
  const body = openModal(existing ? "Edit income" : "Add income", `
    <form id="income-form" class="stacked-form">
      <label>Amount (₱)
        <input type="number" name="amount" min="0.01" step="0.01" required value="${existing ? centavosToPesos(existing.amountCentavos) : ""}" autofocus>
      </label>
      <label>Category
        <select name="categoryId" required>${categoryOptions(categories, existing?.categoryId)}</select>
      </label>
      <label>Account
        <select name="accountId" required>${accountOptions(accounts, existing?.accountId)}</select>
      </label>
      <label>Date
        <input type="date" name="date" required value="${existing?.date || todayIso()}">
      </label>
      <label>Note (optional)
        <input type="text" name="note" placeholder="e.g. September allowance" value="${escapeHtml(existing?.note)}">
      </label>
      <div class="modal-actions">
        <button type="button" class="button button-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="button button-primary">${existing ? "Save changes" : "Add income"}</button>
      </div>
    </form>
  `);
  body.querySelector('[data-close-modal]').addEventListener("click", closeModal);

  body.querySelector("#income-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      const payload = {
        amountCentavos: pesosToCentavos(form.get("amount")),
        categoryId: form.get("categoryId"),
        accountId: form.get("accountId"),
        date: form.get("date"),
        note: form.get("note"),
      };
      if (existing) await updateTransaction(existing.id, payload);
      else await recordIncome(payload);
      closeModal();
      showToast(existing ? "Income updated." : "Income added.");
      await refresh();
    } catch (err) {
      showFormError(e.target, err.message);
    }
  });
}

async function openExpenseForm(existing = null) {
  const [accounts, categories] = await Promise.all([getAccounts(), getCategories("expense")]);
  const body = openModal(existing ? "Edit expense" : "Add expense", `
    <form id="expense-form" class="stacked-form">
      <label>Amount (₱)
        <input type="number" name="amount" min="0.01" step="0.01" required value="${existing ? centavosToPesos(existing.amountCentavos) : ""}" autofocus>
      </label>
      <label>Category
        <select name="categoryId" required>${categoryOptions(categories, existing?.categoryId)}</select>
      </label>
      <label>Account
        <select name="accountId" required>${accountOptions(accounts, existing?.accountId)}</select>
      </label>
      <label>Date
        <input type="date" name="date" required value="${existing?.date || todayIso()}">
      </label>
      <label>Note (optional)
        <input type="text" name="note" placeholder="e.g. Lunch at school" value="${escapeHtml(existing?.note)}">
      </label>
      <div class="modal-actions">
        <button type="button" class="button button-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="button button-primary">${existing ? "Save changes" : "Add expense"}</button>
      </div>
    </form>
  `);
  body.querySelector('[data-close-modal]').addEventListener("click", closeModal);

  body.querySelector("#expense-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      const payload = {
        amountCentavos: pesosToCentavos(form.get("amount")),
        categoryId: form.get("categoryId"),
        accountId: form.get("accountId"),
        date: form.get("date"),
        note: form.get("note"),
      };
      if (existing) await updateTransaction(existing.id, payload);
      else await recordExpense(payload);
      closeModal();
      showToast(existing ? "Expense updated." : "Expense added.");
      await refresh();
    } catch (err) {
      showFormError(e.target, err.message);
    }
  });
}

async function openTransferForm(isDeposit, existing = null) {
  const accounts = await getAccounts();
  const title = isDeposit ? "Deposit to bank" : "Move money";
  const body = openModal(existing ? "Edit transfer" : title, `
    <form id="transfer-form" class="stacked-form">
      <label>From
        <select name="accountId" required>${accountOptions(accounts, existing?.accountId)}</select>
      </label>
      <label>To
        <select name="toAccountId" required>${accountOptions(accounts, existing?.toAccountId)}</select>
      </label>
      <label>Amount (₱)
        <input type="number" name="amount" min="0.01" step="0.01" required value="${existing ? centavosToPesos(existing.amountCentavos) : ""}">
      </label>
      <label>Date
        <input type="date" name="date" required value="${existing?.date || todayIso()}">
      </label>
      <label>Note (optional)
        <input type="text" name="note" value="${escapeHtml(existing?.note)}">
      </label>
      <p class="form-hint">Moving money between your own accounts doesn't count as income or an expense.</p>
      <div class="modal-actions">
        <button type="button" class="button button-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="button button-primary">${existing ? "Save changes" : "Move money"}</button>
      </div>
    </form>
  `);
  body.querySelector('[data-close-modal]').addEventListener("click", closeModal);

  body.querySelector("#transfer-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      const payload = {
        amountCentavos: pesosToCentavos(form.get("amount")),
        accountId: form.get("accountId"),
        toAccountId: form.get("toAccountId"),
        date: form.get("date"),
        note: form.get("note"),
      };
      if (existing) await updateTransaction(existing.id, payload);
      else await recordTransfer(payload);
      closeModal();
      showToast(existing ? "Transfer updated." : "Money moved.");
      await refresh();
    } catch (err) {
      showFormError(e.target, err.message);
    }
  });
}

async function openWithdrawalForm(existing = null) {
  const accounts = await getAccounts();
  const body = openModal(existing ? "Edit withdrawal" : "Withdraw cash", `
    <form id="withdrawal-form" class="stacked-form">
      <label>From (source account)
        <select name="accountId" required>${accountOptions(accounts, existing?.accountId)}</select>
      </label>
      <label>To (where the cash goes)
        <select name="toAccountId" required>${accountOptions(accounts, existing?.toAccountId)}</select>
      </label>
      <label>Total amount debited (₱)
        <input type="number" name="totalDebited" min="0.01" step="0.01" required value="${existing ? centavosToPesos(existing.amountCentavos) : ""}">
      </label>
      <label>Cash received (₱)
        <input type="number" name="cashReceived" min="0.01" step="0.01" required value="${existing ? centavosToPesos(existing.cashReceivedCentavos) : ""}">
      </label>
      <label>Date
        <input type="date" name="date" required value="${existing?.date || todayIso()}">
      </label>
      <label>Note (optional)
        <input type="text" name="note" value="${escapeHtml(existing?.note)}">
      </label>
      <p class="form-hint">Just enter the total that left your source account and how much cash you actually got — we'll work out the fee for you.</p>
      <div class="modal-actions">
        <button type="button" class="button button-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="button button-primary">${existing ? "Save changes" : "Record withdrawal"}</button>
      </div>
    </form>
  `);
  body.querySelector('[data-close-modal]').addEventListener("click", closeModal);

  body.querySelector("#suggest-fee-btn").addEventListener("click", () => {
    const form = body.querySelector("#withdrawal-form");
    const total = parseFloat(form.totalDebited.value);
    if (!total || total <= 0) return;
    const feeCentavos = suggestWithdrawalFee(pesosToCentavos(total));
    form.cashReceived.value = centavosToPesos(pesosToCentavos(total) - feeCentavos);
  });

  body.querySelector("#withdrawal-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      const payload = {
        totalDebitedCentavos: pesosToCentavos(form.get("totalDebited")),
        cashReceivedCentavos: pesosToCentavos(form.get("cashReceived")),
        accountId: form.get("accountId"),
        toAccountId: form.get("toAccountId"),
        date: form.get("date"),
        note: form.get("note"),
      };
      if (existing) {
        await updateTransaction(existing.id, {
          amountCentavos: payload.totalDebitedCentavos,
          cashReceivedCentavos: payload.cashReceivedCentavos,
          feeCentavos: payload.totalDebitedCentavos - payload.cashReceivedCentavos,
          accountId: payload.accountId,
          toAccountId: payload.toAccountId,
          date: payload.date,
          note: payload.note,
        });
      } else {
        await recordWithdrawal(payload);
      }
      closeModal();
      showToast(existing ? "Withdrawal updated." : "Withdrawal recorded.");
      await refresh();
    } catch (err) {
      showFormError(e.target, err.message);
    }
  });
}

function showFormError(formEl, message) {
  let errorEl = formEl.querySelector(".form-error");
  if (!errorEl) {
    errorEl = document.createElement("p");
    errorEl.className = "form-error";
    formEl.prepend(errorEl);
  }
  errorEl.textContent = message;
}

/* -------------------------------------------------------------------- */
/*  PLANNED EXPENSE + ALLOCATION FORMS                                   */
/* -------------------------------------------------------------------- */

async function openPlannedExpenseForm() {
  const categories = await getCategories("expense");
  const body = openModal("Add planned expense", `
    <form id="planned-form" class="stacked-form">
      <label>What is it?
        <input type="text" name="description" placeholder="e.g. Brand New Computer" required autofocus>
      </label>
      <label>Amount (₱)
        <input type="number" name="amount" min="0.01" step="0.01" required>
      </label>
      <label>Category
        <select name="categoryId">${categoryOptions(categories)}</select>
      </label>
      <label>Due date
        <input type="date" name="dueDate" required value="${todayIso()}">
      </label>
      <p class="form-hint">This won't affect your account balance until you mark it as paid.</p>
      <div class="modal-actions">
        <button type="button" class="button button-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="button button-primary">Add planned expense</button>
      </div>
    </form>
  `);
  body.querySelector('[data-close-modal]').addEventListener("click", closeModal);

  body.querySelector("#planned-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      await createPlannedExpense({
        description: form.get("description"),
        amountCentavos: pesosToCentavos(form.get("amount")),
        categoryId: form.get("categoryId"),
        dueDate: form.get("dueDate"),
      });
      closeModal();
      showToast("Planned expense added.");
      await refresh();
    } catch (err) {
      showFormError(e.target, err.message);
    }
  });
}

async function openMarkAsPaidForm(plannedExpense) {
  const accounts = await getAccounts();
  const body = openModal("Mark as paid", `
    <form id="mark-paid-form" class="stacked-form">
      <p class="confirm-message">Pay <strong>${escapeHtml(plannedExpense.description)}</strong> (${formatPeso(plannedExpense.amountCentavos)}) from which account?</p>
      <label>Account
        <select name="accountId" required>${accountOptions(accounts)}</select>
      </label>
      <label>Date paid
        <input type="date" name="date" required value="${todayIso()}">
      </label>
      <div class="modal-actions">
        <button type="button" class="button button-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="button button-primary">Mark as paid</button>
      </div>
    </form>
  `);
  body.querySelector('[data-close-modal]').addEventListener("click", closeModal);

  body.querySelector("#mark-paid-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      await markPlannedExpenseAsPaid(plannedExpense, { accountId: form.get("accountId"), date: form.get("date") });
      closeModal();
      showToast("Planned expense marked as paid.");
      await refresh();
    } catch (err) {
      showFormError(e.target, err.message);
    }
  });
}

async function openAllocationForm() {
  const body = openModal("Set aside money", `
    <form id="allocation-form" class="stacked-form">
      <label>What is this for?
        <input type="text" name="name" placeholder="e.g. Internet Bill" required autofocus>
      </label>
      <label>Amount (₱)
        <input type="number" name="amount" min="0.01" step="0.01" required>
      </label>
      <p class="form-hint">This money stays in your account — we'll just remember it's reserved.</p>
      <div class="modal-actions">
        <button type="button" class="button button-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="button button-primary">Set aside</button>
      </div>
    </form>
  `);
  body.querySelector('[data-close-modal]').addEventListener("click", closeModal);

  body.querySelector("#allocation-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      await createAllocation({ name: form.get("name"), amountCentavos: pesosToCentavos(form.get("amount")) });
      closeModal();
      showToast("Money set aside.");
      await refresh();
    } catch (err) {
      showFormError(e.target, err.message);
    }
  });
}

async function openSpendAllocationForm(allocation) {
  const [accounts, categories] = await Promise.all([getAccounts(), getCategories("expense")]);
  const body = openModal("Spend reserved money", `
    <form id="spend-allocation-form" class="stacked-form">
      <p class="confirm-message">Spend <strong>${escapeHtml(allocation.name)}</strong> (${formatPeso(allocation.amountCentavos)})?</p>
      <label>Account
        <select name="accountId" required>${accountOptions(accounts)}</select>
      </label>
      <label>Category
        <select name="categoryId" required>${categoryOptions(categories)}</select>
      </label>
      <label>Date
        <input type="date" name="date" required value="${todayIso()}">
      </label>
      <div class="modal-actions">
        <button type="button" class="button button-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="button button-primary">Record as spent</button>
      </div>
    </form>
  `);
  body.querySelector('[data-close-modal]').addEventListener("click", closeModal);

  body.querySelector("#spend-allocation-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      await spendAllocation(allocation, {
        accountId: form.get("accountId"),
        categoryId: form.get("categoryId"),
        date: form.get("date"),
      });
      closeModal();
      showToast("Recorded as spent.");
      await refresh();
    } catch (err) {
      showFormError(e.target, err.message);
    }
  });
}

/* -------------------------------------------------------------------- */
/*  ACCOUNTS VIEW                                                        */
/* -------------------------------------------------------------------- */

async function openAccountForm(existing = null) {
  const body = openModal(existing ? "Edit account" : "Add account", `
    <form id="account-form" class="stacked-form">
      <label>Account name
        <input type="text" name="name" placeholder="e.g. BPI, GCash" required value="${escapeHtml(existing?.name)}" autofocus>
      </label>
      <label>Type
        <select name="type" required>
          ${ACCOUNT_TYPES.map((t) => `<option value="${t}" ${existing?.type === t ? "selected" : ""}>${ACCOUNT_TYPE_LABELS[t]}</option>`).join("")}
        </select>
      </label>
      <label>${existing ? "Starting balance" : "Current balance"} (₱)
        <input type="number" name="initialBalance" min="0" step="0.01" value="${existing ? centavosToPesos(existing.initialBalanceCentavos) : "0"}">
      </label>
      ${existing ? `<p class="form-hint">Changing this adjusts the account's starting point, not a transaction.</p>` : ""}
      <div class="modal-actions">
        <button type="button" class="button button-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="button button-primary">${existing ? "Save changes" : "Add account"}</button>
      </div>
    </form>
  `);
  body.querySelector('[data-close-modal]').addEventListener("click", closeModal);

  body.querySelector("#account-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      const payload = {
        name: form.get("name"),
        type: form.get("type"),
        initialBalanceCentavos: pesosToCentavos(form.get("initialBalance") || 0),
      };
      if (existing) await updateAccount(existing.id, payload);
      else await createAccount(payload);
      closeModal();
      showToast(existing ? "Account updated." : "Account added.");
      await refresh();
    } catch (err) {
      showFormError(e.target, err.message);
    }
  });
}

export async function renderAccounts(container) {
  const [accounts, transactions] = await Promise.all([getAccounts({ includeArchived: true }), getTransactions()]);
  const active = withBalances(accounts.filter((a) => !a.archived), transactions);
  const archived = accounts.filter((a) => a.archived);

  container.innerHTML = `
    <div class="view-header">
      <h1>Accounts</h1>
      <button class="button button-primary" data-action="add-account">+ Add account</button>
    </div>
    <section class="panel">
      <div class="account-grid">
        ${active
          .map(
            (a) => `
          <article class="account-card">
            <div class="account-card-top">
              <span class="account-type-tag">${ACCOUNT_TYPE_LABELS[a.type]}</span>
              <div class="account-card-menu">
                <button class="icon-button" data-edit-account="${a.id}" aria-label="Edit ${escapeHtml(a.name)}">
                  <img src="assets/edit.png" alt="Edit" aria-hidden="true">
                </button>
                <button class="icon-button" data-archive-account="${a.id}" aria-label="Archive ${escapeHtml(a.name)}">
                  <img src="assets/archive.png" alt="Archive" aria-hidden="true">
                </button>
                <button class="icon-button" data-delete-account="${a.id}" aria-label="Delete ${escapeHtml(a.name)}">
                  <img src="assets/delete.png" alt="Delete" aria-hidden="true">
                </button>
              </div>
            </div>
            <p class="account-card-name">${escapeHtml(a.name)}</p>
            <p class="account-card-balance">${formatPeso(a.balanceCentavos)}</p>
          </article>`
          )
          .join("")}
      </div>
    </section>
    ${
      archived.length > 0
        ? `<section class="panel">
            <div class="panel-header"><h2>Archived accounts</h2></div>
            <ul class="simple-list">
              ${archived.map((a) => `<li><span class="list-primary">${escapeHtml(a.name)}</span><span class="list-secondary">${ACCOUNT_TYPE_LABELS[a.type]}</span></li>`).join("")}
            </ul>
          </section>`
        : ""
    }
  `;

  container.querySelector('[data-action="add-account"]').addEventListener("click", () => openAccountForm());
  container.querySelectorAll("[data-edit-account]").forEach((btn) =>
    btn.addEventListener("click", () => openAccountForm(active.find((a) => a.id === btn.dataset.editAccount)))
  );
  container.querySelectorAll("[data-archive-account]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const ok = await confirmDialog("Archive this account? It will be hidden from your dashboard but its history stays intact.", "Archive");
      if (!ok) return;
      await archiveAccount(btn.dataset.archiveAccount);
      showToast("Account archived.");
      await refresh();
    })
  );
  container.querySelectorAll("[data-delete-account]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const ok = await confirmDialog("Delete this account permanently? This can't be undone.", "Delete");
      if (!ok) return;
      try {
        await deleteAccountSafely(btn.dataset.deleteAccount, transactions);
        showToast("Account deleted.");
        await refresh();
      } catch (err) {
        showToast(err.message, { type: "error" });
      }
    })
  );
}

/* -------------------------------------------------------------------- */
/*  TRANSACTIONS VIEW                                                    */
/* -------------------------------------------------------------------- */

let transactionFilters = { search: "", type: "", categoryId: "", accountId: "" };

export async function renderTransactions(container) {
  const [transactions, accounts, categories] = await Promise.all([
    getTransactions(),
    getAccounts({ includeArchived: true }),
    getCategories(),
  ]);

  const filtered = filterTransactions(transactions, transactionFilters).filter((t) => {
    if (!transactionFilters.search) return true;
    const haystack = [t.note, categoryName(categories, t.categoryId), accountName(accounts, t.accountId), accountName(accounts, t.toAccountId)]
      .join(" ")
      .toLowerCase();
    return haystack.includes(transactionFilters.search.toLowerCase());
  });

  container.innerHTML = `
    <div class="view-header">
      <h1>Transactions</h1>
      <button class="button button-primary" data-open="quick-add">+ Add transaction</button>
    </div>

    <section class="panel">
      <div class="filter-bar">
        <input type="search" id="tx-search" placeholder="Search notes, categories, accounts…" value="${escapeHtml(transactionFilters.search)}">
        <select id="tx-type-filter">
          <option value="">All types</option>
          ${Object.entries(TRANSACTION_TYPE_LABELS).map(([v, label]) => `<option value="${v}" ${transactionFilters.type === v ? "selected" : ""}>${label}</option>`).join("")}
        </select>
        <select id="tx-account-filter">
          <option value="">All accounts</option>
          ${accounts.map((a) => `<option value="${a.id}" ${transactionFilters.accountId === a.id ? "selected" : ""}>${escapeHtml(a.name)}</option>`).join("")}
        </select>
        <select id="tx-category-filter">
          <option value="">All categories</option>
          ${categories.map((c) => `<option value="${c.id}" ${transactionFilters.categoryId === c.id ? "selected" : ""}>${escapeHtml(c.name)}</option>`).join("")}
        </select>
      </div>
    </section>

    <section class="panel">
      ${
        filtered.length === 0
          ? `<p class="empty-state">No transactions match your filters.</p>`
          : `<table class="tx-table">
              <thead><tr><th>Date</th><th>Type</th><th>Details</th><th>Account</th><th class="align-right">Amount</th><th></th></tr></thead>
              <tbody>
                ${filtered.map((t) => renderTransactionRow(t, accounts, categories)).join("")}
              </tbody>
            </table>`
      }
    </section>
  `;

  container.querySelector('[data-open="quick-add"]').addEventListener("click", () => openQuickAddMenu());

  container.querySelector("#tx-search").addEventListener("input", (e) => {
    transactionFilters.search = e.target.value;
    renderTransactions(container);
  });
  container.querySelector("#tx-type-filter").addEventListener("change", (e) => {
    transactionFilters.type = e.target.value;
    renderTransactions(container);
  });
  container.querySelector("#tx-account-filter").addEventListener("change", (e) => {
    transactionFilters.accountId = e.target.value;
    renderTransactions(container);
  });
  container.querySelector("#tx-category-filter").addEventListener("change", (e) => {
    transactionFilters.categoryId = e.target.value;
    renderTransactions(container);
  });

  container.querySelectorAll("[data-edit-tx]").forEach((btn) =>
    btn.addEventListener("click", () => {
      const t = transactions.find((tx) => tx.id === btn.dataset.editTx);
      if (t.type === "income") openIncomeForm(t);
      else if (t.type === "expense") openExpenseForm(t);
      else if (t.type === "transfer") openTransferForm(false, t);
      else if (t.type === "withdrawal") openWithdrawalForm(t);
    })
  );
  container.querySelectorAll("[data-delete-tx]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const ok = await confirmDialog("Delete this transaction? This action cannot be undone.", "Delete");
      if (!ok) return;
      await deleteTransaction(btn.dataset.deleteTx);
      showToast("Transaction deleted.");
      await refresh();
    })
  );
}

function renderTransactionRow(t, accounts, categories) {
  const amountClass = t.type === "income" ? "positive" : t.type === "expense" ? "negative" : "";
  const sign = t.type === "income" ? "+" : t.type === "expense" ? "-" : "";
  let details;
  let accountText;
  if (t.type === "transfer") {
    details = t.note || "Money moved";
    accountText = `${accountName(accounts, t.accountId)} → ${accountName(accounts, t.toAccountId)}`;
  } else if (t.type === "withdrawal") {
    details = t.note || "Cash withdrawal";
    accountText = `${accountName(accounts, t.accountId)} → ${accountName(accounts, t.toAccountId)}`;
  } else {
    details = `${categoryName(categories, t.categoryId)}${t.note ? ` — ${escapeHtml(t.note)}` : ""}`;
    accountText = accountName(accounts, t.accountId);
  }

  return `<tr>
    <td>${formatDate(t.date)}</td>
    <td><span class="type-pill type-${t.type}">${TRANSACTION_TYPE_LABELS[t.type]}</span></td>
    <td>${details}</td>
    <td>${escapeHtml(accountText)}</td>
    <td class="align-right ${amountClass}">${sign}${formatPeso(t.amountCentavos)}</td>
    <td class="row-actions">
      <button class="icon-button" data-edit-tx="${t.id}" aria-label="Edit">
        <img src="assets/edit.png" alt="" aria-hidden="true">
      </button>

      <button class="icon-button" data-delete-tx="${t.id}" aria-label="Delete">
        <img src="assets/delete.png" alt="" aria-hidden="true">
      </button>
    </td>
  </tr>`;
}

/* -------------------------------------------------------------------- */
/*  PLANNED EXPENSES VIEW                                                */
/* -------------------------------------------------------------------- */

export async function renderPlanned(container) {
  const [plannedExpenses, categories] = await Promise.all([getPlannedExpenses(), getCategories()]);
  const upcoming = plannedExpenses.filter((p) => p.status === "planned");
  const completed = plannedExpenses.filter((p) => p.status === "completed");

  container.innerHTML = `
    <div class="view-header">
      <h1>Planned expenses</h1>
      <button class="button button-primary" data-action="add-planned">+ Add planned expense</button>
    </div>

    <section class="panel">
      <div class="panel-header"><h2>Upcoming</h2></div>
      ${
        upcoming.length === 0
          ? `<p class="empty-state">No upcoming expenses. Add a planned expense to keep track of what's coming.</p>`
          : `<ul class="simple-list">
              ${upcoming
                .map(
                  (p) => `<li>
                    <span class="list-primary">${escapeHtml(p.description)}</span>
                    <span class="list-secondary">${formatDate(p.dueDate)} · ${categoryName(categories, p.categoryId)}</span>
                    <span class="list-amount">${formatPeso(p.amountCentavos)}</span>
                    <span class="row-actions">
                      <button class="button button-small" data-mark-paid="${p.id}">Mark as paid</button>
                      <button class="icon-button" data-delete-planned="${p.id}" aria-label="Delete">
  <img src="assets/delete.png" alt="" aria-hidden="true">
</button>
                    </span>
                  </li>`
                )
                .join("")}
            </ul>`
      }
    </section>

    ${
      completed.length > 0
        ? `<section class="panel">
            <div class="panel-header"><h2>Paid</h2></div>
            <ul class="simple-list">
              ${completed
                .slice(0, 10)
                .map(
                  (p) => `<li>
                    <span class="list-primary">${escapeHtml(p.description)}</span>
                    <span class="list-secondary">Paid · ${formatDate(p.dueDate)}</span>
                    <span class="list-amount">${formatPeso(p.amountCentavos)}</span>
                  </li>`
                )
                .join("")}
            </ul>
          </section>`
        : ""
    }
  `;

  container.querySelector('[data-action="add-planned"]').addEventListener("click", () => openPlannedExpenseForm());
  container.querySelectorAll("[data-mark-paid]").forEach((btn) =>
    btn.addEventListener("click", () => openMarkAsPaidForm(plannedExpenses.find((p) => p.id === btn.dataset.markPaid)))
  );
  container.querySelectorAll("[data-delete-planned]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const ok = await confirmDialog("Delete this planned expense?", "Delete");
      if (!ok) return;
      await deletePlannedExpense(btn.dataset.deletePlanned);
      showToast("Planned expense deleted.");
      await refresh();
    })
  );
}

/* -------------------------------------------------------------------- */
/*  RESERVED MONEY VIEW                                                  */
/* -------------------------------------------------------------------- */

export async function renderReserved(container) {
  const [allocations, accounts, transactions] = await Promise.all([getAllocations(), getAccounts(), getTransactions()]);
  const active = getActiveAllocations(allocations);
  const spent = allocations.filter((a) => a.status === "spent");
  const totalMoney = calculateTotalMoney(accounts, transactions);
  const { reserved, available } = calculateAvailableMoney(totalMoney, allocations);

  container.innerHTML = `
    <div class="view-header">
      <h1>Reserved money</h1>
      <button class="button button-primary" data-action="add-allocation">+ Set aside money</button>
    </div>

    <section class="stat-row">
      <div class="stat-card"><p class="stat-label">Total money</p><p class="stat-value">${formatPeso(totalMoney)}</p></div>
      <div class="stat-card"><p class="stat-label">Reserved</p><p class="stat-value">${formatPeso(reserved)}</p></div>
      <div class="stat-card"><p class="stat-label">Available</p><p class="stat-value">${formatPeso(available)}</p></div>
    </section>

    <section class="panel">
      <div class="panel-header"><h2>Set aside for</h2></div>
      ${
        active.length === 0
          ? `<p class="empty-state">You haven't set any money aside. It stays in your accounts, but reserving it helps you see what's really free to spend.</p>`
          : `<ul class="simple-list">
              ${active
                .map(
                  (a) => `<li>
                    <span class="list-primary">${escapeHtml(a.name)}</span>
                    <span class="list-amount">${formatPeso(a.amountCentavos)}</span>
                    <span class="row-actions">
                      <button class="button button-small" data-spend-allocation="${a.id}">Spend it</button>
<button class="icon-button" data-delete-allocation="${a.id}" aria-label="Delete">
  <img src="assets/delete.png" alt="delete" aria-hidden="true">
</button>
                    </span>
                  </li>`
                )
                .join("")}
            </ul>`
      }
    </section>

    ${
      spent.length > 0
        ? `<section class="panel">
            <div class="panel-header"><h2>Already spent</h2></div>
            <ul class="simple-list">
              ${spent.map((a) => `<li><span class="list-primary">${escapeHtml(a.name)}</span><span class="list-amount">${formatPeso(a.amountCentavos)}</span></li>`).join("")}
            </ul>
          </section>`
        : ""
    }
  `;

  container.querySelector('[data-action="add-allocation"]').addEventListener("click", () => openAllocationForm());
  container.querySelectorAll("[data-spend-allocation]").forEach((btn) =>
    btn.addEventListener("click", () => openSpendAllocationForm(active.find((a) => a.id === btn.dataset.spendAllocation)))
  );
  container.querySelectorAll("[data-delete-allocation]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const ok = await confirmDialog("Remove this reserved amount? The money remains in your account either way.", "Remove");
      if (!ok) return;
      await deleteAllocation(btn.dataset.deleteAllocation);
      showToast("Removed.");
      await refresh();
    })
  );
}

/* -------------------------------------------------------------------- */
/*  REPORTS VIEW                                                         */
/* -------------------------------------------------------------------- */

let reportsSelectedMonth = null;

export async function renderReports(container) {
  const transactions = await getTransactions();
  const categories = await getCategories();

  if (!reportsSelectedMonth) reportsSelectedMonth = toYearMonth(new Date());
  const summary = getMonthlySummary(transactions, reportsSelectedMonth);
  const previousMonth = previousYearMonth(reportsSelectedMonth);
  const previousSummary = getMonthlySummary(transactions, previousMonth);
  const comparison = compareMonths(summary, previousSummary);

  const dailyBreakdown = await getDailyBreakdownForMonth(transactions, reportsSelectedMonth);
  const trend = getTrendSeries(transactions, reportsSelectedMonth, 6);

  const monthLabel = new Date(`${reportsSelectedMonth}-01T00:00:00`).toLocaleDateString("en-PH", { month: "long", year: "numeric" });

  container.innerHTML = `
    <div class="view-header">
      <h1>Reports</h1>
      <input type="month" id="report-month-picker" value="${reportsSelectedMonth}"> <!-- Change the look of this thing -->
    </div>

    <section class="panel">
      <div class="panel-header"><h2>${monthLabel}</h2></div>
      <div class="month-stats">
        <div><span class="month-stat-label">Income</span><span class="month-stat-value positive">${formatPeso(summary.incomeCentavos)}</span></div>
        <div><span class="month-stat-label">Expenses</span><span class="month-stat-value negative">${formatPeso(summary.expensesCentavos)}</span></div>
        <div><span class="month-stat-label">Saved</span><span class="month-stat-value ${summary.savingsCentavos >= 0 ? "positive" : "negative"}">${formatPeso(summary.savingsCentavos)}</span></div>
        <div><span class="month-stat-label">Savings rate</span><span class="month-stat-value">${summary.savingsRatePercent === null ? "—" : summary.savingsRatePercent.toFixed(0) + "%"}</span></div>
        <div><span class="month-stat-label">Avg. daily spending</span><span class="month-stat-value">${formatPeso(summary.averageDailySpendingCentavos)}</span></div>
        <div><span class="month-stat-label">Highest spending day</span><span class="month-stat-value">${summary.highestSpendingDay ? formatDate(summary.highestSpendingDay) : "—"}</span></div>
      </div>
    </section>

    <section class="panel comparison-panel comparison-${comparison.tone}">
      <div class="panel-header"><h2>Compared to ${new Date(`${previousMonth}-01T00:00:00`).toLocaleDateString("en-PH", { month: "long" })}</h2></div>
      <p class="comparison-message">${comparison.message}</p>
      <div class="comparison-figures">
        <span>${formatSignedPeso(comparison.savingsDiff)} saved</span>
        ${comparison.expenseDiffPercent !== null ? `<span>${formatSignedPeso(comparison.expenseDiff)} spending (${comparison.expenseDiffPercent >= 0 ? "+" : ""}${comparison.expenseDiffPercent.toFixed(0)}%)</span>` : ""}
      </div>
    </section>

    <section class="panel">
      <div class="panel-header><h2>Spending by category</h2></div>
      ${buildHorizontalBarChart(
        Object.entries(summary.categoryTotals)
          .map(([categoryId, valueCentavos]) => ({ label: categoryName(categories, categoryId), valueCentavos }))
          .sort((a, b) => b.valueCentavos - a.valueCentavos)
      )}
    </section>

    <section class="panel">
      <div class="panel-header"><h2>Income vs. expenses (last 6 months)</h2></div>
      ${buildLineChart([
        { name: "Income", color: "var(--accent-teal)", points: trend.map((m) => ({ label: m.shortLabel, valueCentavos: m.incomeCentavos })) },
        { name: "Expenses", color: "var(--accent-rust)", points: trend.map((m) => ({ label: m.shortLabel, valueCentavos: m.expensesCentavos })) },
      ])}
    </section>

    <section class="panel">
      <div class="panel-header"><h2>Savings trend</h2></div>
      ${buildLineChart([
        { name: "Savings", color: "var(--accent-teal)", points: trend.map((m) => ({ label: m.shortLabel, valueCentavos: m.savingsCentavos })) },
      ])}
    </section>

    <section class="panel">
      <div class="panel-header"><h2>Daily spending</h2></div>
      ${buildHorizontalBarChart(dailyBreakdown.slice(0, 15))}
    </section>
  `;

  container.querySelector("#report-month-picker").addEventListener("change", (e) => {
    reportsSelectedMonth = e.target.value;
    renderReports(container);
  });
}

async function getDailyBreakdownForMonth(transactions, yearMonth) {
  const monthExpenses = transactions.filter((t) => t.type === "expense" && t.date.slice(0, 7) === yearMonth);
  const byDay = {};
  for (const t of monthExpenses) byDay[t.date] = (byDay[t.date] || 0) + t.amountCentavos;
  return Object.entries(byDay)
    .sort((a, b) => (a[0] < b[0] ? 1 : -1))
    .map(([date, valueCentavos]) => ({ label: formatDate(date), valueCentavos }));
}

function getTrendSeries(transactions, endYearMonth, monthCount) {
  const months = [];
  let cursor = endYearMonth;
  for (let i = 0; i < monthCount; i++) {
    months.unshift(cursor);
    cursor = previousYearMonth(cursor);
  }
  return months.map((ym) => {
    const summary = getMonthlySummary(transactions, ym);
    const shortLabel = new Date(`${ym}-01T00:00:00`).toLocaleDateString("en-PH", { month: "short" });
    return { ...summary, shortLabel };
  });
}

/* -------------------------------------------------------------------- */
/*  SETTINGS VIEW                                                        */
/* -------------------------------------------------------------------- */

export async function renderSettings(container) {
  const categories = await getCategories();
  const expenseCategories = categories.filter((c) => c.kind === "expense");
  const incomeCategories = categories.filter((c) => c.kind === "income");

  container.innerHTML = `
    <div class="view-header"><h1>Settings</h1></div>

    <section class="panel">
      <div class="panel-header"><h2>Your data is private</h2></div>
      <p class="settings-copy">Your financial data is stored locally in this browser, in IndexedDB. Nothing is sent to a server, there's no account, no login, and no analytics or tracking of any kind.</p>
    </section>

    <section class="panel">
      <div class="panel-header"><h2>Backup &amp; restore</h2></div>
      <p class="settings-copy">Since everything lives only in this browser, export a backup regularly so you never lose your data.</p>
      <div class="settings-actions">
        <button class="button button-primary" id="export-backup-btn">Export backup</button>
        <label class="button button-ghost file-button">
          Import backup
          <input type="file" id="import-backup-input" accept="application/json" hidden>
        </label>
      </div>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Expense categories</h2>
        <button class="button button-small" data-add-category="expense">+ Add</button>
      </div>
      <ul class="chip-list">
        ${expenseCategories.map((c) => `<li class="chip">${escapeHtml(c.name)} ${c.isDefault ? "" : `<button class="chip-remove" data-delete-category="${c.id}" aria-label="Delete ${escapeHtml(c.name)}">✕</button>`}</li>`).join("")}
      </ul>
    </section>

    <section class="panel">
      <div class="panel-header">
        <h2>Income categories</h2>
        <button class="button button-small" data-add-category="income">+ Add</button>
      </div>
      <ul class="chip-list">
        ${incomeCategories.map((c) => `<li class="chip">${escapeHtml(c.name)} ${c.isDefault ? "" : `<button class="chip-remove" data-delete-category="${c.id}" aria-label="Delete ${escapeHtml(c.name)}">✕</button>`}</li>`).join("")}
      </ul>
    </section>
  `;

  container.querySelector("#export-backup-btn").addEventListener("click", async () => {
    await exportBackup();
    showToast("Backup downloaded.");
  });

  container.querySelector("#import-backup-input").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const parsed = await readBackupFile(file);
      const ok = await confirmDialog(
        `This will REPLACE all current data with the backup from ${new Date(parsed.exportedAt).toLocaleString("en-PH")}. This can't be undone.`,
        "Replace my data"
      );
      if (!ok) {
        e.target.value = "";
        return;
      }
      await restoreBackup(parsed);
      showToast("Backup restored successfully.");
      await refresh();
    } catch (err) {
      showToast(err.message, { type: "error" });
    }
    e.target.value = "";
  });

  container.querySelectorAll("[data-add-category]").forEach((btn) =>
    btn.addEventListener("click", () => openCategoryForm(btn.dataset.addCategory))
  );
  container.querySelectorAll("[data-delete-category]").forEach((btn) =>
    btn.addEventListener("click", async () => {
      const ok = await confirmDialog("Delete this category? Past transactions using it will keep the label as-is.", "Delete");
      if (!ok) return;
      await deleteCategory(btn.dataset.deleteCategory);
      showToast("Category deleted.");
      await refresh();
    })
  );
}

function openCategoryForm(kind) {
  const body = openModal(`Add ${kind} category`, `
    <form id="category-form" class="stacked-form">
      <label>Category name
        <input type="text" name="name" required autofocus>
      </label>
      <div class="modal-actions">
        <button type="button" class="button button-ghost" data-close-modal>Cancel</button>
        <button type="submit" class="button button-primary">Add category</button>
      </div>
    </form>
  `);
  body.querySelector('[data-close-modal]').addEventListener("click", closeModal);

  body.querySelector("#category-form").addEventListener("submit", async (e) => {
    e.preventDefault();
    const form = new FormData(e.target);
    try {
      await addCategory(form.get("name"), kind);
      closeModal();
      showToast("Category added.");
      await refresh();
    } catch (err) {
      showFormError(e.target, err.message);
    }
  });
}
