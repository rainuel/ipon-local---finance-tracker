import { getAll, putOne, removeOne, makeId } from "./database.js";
import { recordExpense } from "./transactions.js";

export async function getAllocations() {
  return getAll("allocations");
}

export async function createAllocation({ name, amountCentavos }) {
  if (!name.trim()) throw new Error("Please name what this money is set aside for.");
  if (!Number.isFinite(amountCentavos) || amountCentavos <= 0) {
    throw new Error("Amount must be greater than zero.");
  }

  return putOne("allocations", {
    id: makeId(),
    name: name.trim(),
    amountCentavos,
    status: "active", // "active" | "spent"
    spentTransactionId: null,
    createdAt: new Date().toISOString(),
  });
}

export async function deleteAllocation(id) {
  return removeOne("allocations", id);
}

export function getActiveAllocations(allocations) {
  return allocations.filter((a) => a.status === "active");
}

/**
 * Converts a reserved allocation into an actual expense once the user
 * spends it. The allocation moves to "spent" (so it stops being counted
 * as reserved) and a real expense transaction is created — this is the
 * only path that touches the account balance, avoiding double deduction.
 */
export async function spendAllocation(allocation, { accountId, categoryId, date }) {
  if (allocation.status === "spent") {
    throw new Error("This reserved amount has already been spent.");
  }

  const transaction = await recordExpense({
    amountCentavos: allocation.amountCentavos,
    categoryId,
    note: allocation.name,
    date: date || new Date().toISOString().slice(0, 10),
    accountId,
  });

  await putOne("allocations", {
    ...allocation,
    status: "spent",
    spentTransactionId: transaction.id,
  });

  return transaction;
}
