import { getAll, putOne, removeOne, makeId } from "./database.js";

export async function getTransactions() {
  const all = await getAll("transactions");
  return all.sort((a, b) => new Date(b.date) - new Date(a.date));
}

function assertPositiveAmount(amountCentavos) {
  if (!Number.isFinite(amountCentavos) || amountCentavos <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
}

function assertValidDate(date) {
  if (!date || Number.isNaN(new Date(date).getTime())) {
    throw new Error("Please enter a valid date.");
  }
}

export async function recordIncome({ amountCentavos, categoryId, note, date, accountId }) {
  assertPositiveAmount(amountCentavos);
  assertValidDate(date);
  if (!accountId) throw new Error("Please choose an account.");

  return putOne("transactions", {
    id: makeId(),
    type: "income",
    amountCentavos,
    categoryId,
    note: note?.trim() || "",
    date,
    accountId,
    toAccountId: null,
    createdAt: new Date().toISOString(),
  });
}

export async function recordExpense({ amountCentavos, categoryId, note, date, accountId }) {
  assertPositiveAmount(amountCentavos);
  assertValidDate(date);
  if (!accountId) throw new Error("Please choose an account.");
  if (!categoryId) throw new Error("Please choose a category.");

  return putOne("transactions", {
    id: makeId(),
    type: "expense",
    amountCentavos,
    categoryId,
    note: note?.trim() || "",
    date,
    accountId,
    toAccountId: null,
    createdAt: new Date().toISOString(),
  });
}

/** Used for both "Transfer" and "Deposit" — moving money between two of the user's own accounts. */
export async function recordTransfer({ amountCentavos, note, date, accountId, toAccountId }) {
  assertPositiveAmount(amountCentavos);
  assertValidDate(date);
  if (!accountId || !toAccountId) throw new Error("Please choose both accounts.");
  if (accountId === toAccountId) throw new Error("Choose two different accounts.");

  return putOne("transactions", {
    id: makeId(),
    type: "transfer",
    amountCentavos,
    categoryId: null,
    note: note?.trim() || "",
    date,
    accountId,
    toAccountId,
    createdAt: new Date().toISOString(),
  });
}

/**
 * Records money leaving one account (e.g. an ATM withdrawal). The user
 * only has to enter the TOTAL amount debited from the source and how
 * much cash they actually received — the difference is stored as a fee,
 * but never has to be calculated by hand.
 */
export async function recordWithdrawal({
  totalDebitedCentavos,
  cashReceivedCentavos,
  note,
  date,
  accountId,
  toAccountId,
}) {
  assertPositiveAmount(totalDebitedCentavos);
  assertPositiveAmount(cashReceivedCentavos);
  assertValidDate(date);
  if (!accountId || !toAccountId) throw new Error("Please choose both accounts.");
  if (accountId === toAccountId) throw new Error("Choose two different accounts.");
  if (cashReceivedCentavos > totalDebitedCentavos) {
    throw new Error("Cash received can't be more than the total amount debited.");
  }

  return putOne("transactions", {
    id: makeId(),
    type: "withdrawal",
    amountCentavos: totalDebitedCentavos,
    cashReceivedCentavos,
    feeCentavos: totalDebitedCentavos - cashReceivedCentavos,
    categoryId: null,
    note: note?.trim() || "",
    date,
    accountId,
    toAccountId,
    createdAt: new Date().toISOString(),
  });
}

/** Suggests a withdrawal fee using the default rule: max(2% of amount, ₱10). Purely a convenience the user can override. */
export function suggestWithdrawalFee(totalDebitedCentavos) {
  const FEE_RATE = 0.02;
  const MIN_FEE_CENTAVOS = 1000; // ₱10.00
  return Math.round(Math.max(totalDebitedCentavos * FEE_RATE, MIN_FEE_CENTAVOS));
}

export async function updateTransaction(id, updates) {
  const all = await getAll("transactions");
  const existing = all.find((t) => t.id === id);
  if (!existing) throw new Error("Transaction not found.");
  const merged = { ...existing, ...updates };
  assertPositiveAmount(merged.amountCentavos);
  assertValidDate(merged.date);
  return putOne("transactions", merged);
}

export async function deleteTransaction(id) {
  return removeOne("transactions", id);
}

/** Simple text + dimension search/filter used by the Transaction History screen. */
export function filterTransactions(transactions, { search, type, categoryId, accountId, fromDate, toDate }) {
  return transactions.filter((t) => {
    if (type && t.type !== type) return false;
    if (categoryId && t.categoryId !== categoryId) return false;
    if (accountId && t.accountId !== accountId && t.toAccountId !== accountId) return false;
    if (fromDate && t.date < fromDate) return false;
    if (toDate && t.date > toDate) return false;
    if (search) {
      const haystack = `${t.note || ""}`.toLowerCase();
      if (!haystack.includes(search.toLowerCase())) return false;
    }
    return true;
  });
}
