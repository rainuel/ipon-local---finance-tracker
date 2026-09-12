import { getAll, putOne, removeOne, makeId } from "./database.js";

export const ACCOUNT_TYPES = ["cash", "bank", "ewallet", "other"];

/** Creates the very first account a new user sees: Cash in Hand, ₱1,000. */
export async function seedDefaultAccountIfNeeded() {
  const existing = await getAll("accounts");
  if (existing.length > 0) return;

  await putOne("accounts", {
    id: makeId(),
    name: "Cash in Hand",
    type: "cash",
    initialBalanceCentavos: 0, 
    archived: false,
    createdAt: new Date().toISOString(),
  });
}

export async function getAccounts({ includeArchived = false } = {}) {
  const all = await getAll("accounts");
  return includeArchived ? all : all.filter((a) => !a.archived);
}

export async function createAccount({ name, type, initialBalanceCentavos = 0 }) {
  if (!name.trim()) throw new Error("Account name is required.");
  if (!ACCOUNT_TYPES.includes(type)) throw new Error("Invalid account type.");

  return putOne("accounts", {
    id: makeId(),
    name: name.trim(),
    type,
    initialBalanceCentavos,
    archived: false,
    createdAt: new Date().toISOString(),
  });
}

export async function updateAccount(id, updates) {
  const accounts = await getAll("accounts");
  const account = accounts.find((a) => a.id === id);
  if (!account) throw new Error("Account not found.");
  return putOne("accounts", { ...account, ...updates });
}

export async function archiveAccount(id) {
  return updateAccount(id, { archived: true });
}

/**
 * Deletes an account only if it has no transactions pointing to it.
 * If it does, the caller should archive instead — we never silently
 * erase transaction history.
 */
export async function deleteAccountSafely(id, transactions) {
  const isReferenced = transactions.some(
    (t) => t.accountId === id || t.toAccountId === id
  );
  if (isReferenced) {
    throw new Error(
      "This account has transaction history. Archive it instead, or move its transactions first."
    );
  }
  return removeOne("accounts", id);
}

/**
 * Calculates an account's current balance in centavos from its starting
 * balance plus the effect of every transaction that touched it.
 */
export function calculateAccountBalance(account, transactions) {
  let balance = account.initialBalanceCentavos;

  for (const t of transactions) {
    if (t.type === "income" && t.accountId === account.id) {
      balance += t.amountCentavos;
    } else if (t.type === "expense" && t.accountId === account.id) {
      balance -= t.amountCentavos;
    } else if (t.type === "transfer") {
      if (t.accountId === account.id) balance -= t.amountCentavos;
      if (t.toAccountId === account.id) balance += t.amountCentavos;
    } else if (t.type === "withdrawal") {
      // accountId = source (loses the full amount debited),
      // toAccountId = destination (gains only the cash received).
      if (t.accountId === account.id) balance -= t.amountCentavos;
      if (t.toAccountId === account.id) balance += t.cashReceivedCentavos;
    }
  }

  return balance;
}

/** Returns every account with a `balanceCentavos` field attached. */
export function withBalances(accounts, transactions) {
  return accounts.map((account) => ({
    ...account,
    balanceCentavos: calculateAccountBalance(account, transactions),
  }));
}
