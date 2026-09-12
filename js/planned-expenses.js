import { getAll, putOne, removeOne, makeId } from "./database.js";
import { recordExpense } from "./transactions.js";

export async function getPlannedExpenses() {
  const all = await getAll("plannedExpenses");
  return all.sort((a, b) => new Date(a.dueDate) - new Date(b.dueDate));
}

export async function createPlannedExpense({ description, amountCentavos, categoryId, dueDate }) {
  if (!description.trim()) throw new Error("Please describe this planned expense.");
  if (!Number.isFinite(amountCentavos) || amountCentavos <= 0) {
    throw new Error("Amount must be greater than zero.");
  }
  if (!dueDate) throw new Error("Please choose a due date.");

  return putOne("plannedExpenses", {
    id: makeId(),
    description: description.trim(),
    amountCentavos,
    categoryId,
    dueDate,
    status: "planned", // "planned" | "completed"
    completedTransactionId: null,
    createdAt: new Date().toISOString(),
  });
}

export async function updatePlannedExpense(id, updates) {
  const all = await getAll("plannedExpenses");
  const existing = all.find((p) => p.id === id);
  if (!existing) throw new Error("Planned expense not found.");
  return putOne("plannedExpenses", { ...existing, ...updates });
}

export async function deletePlannedExpense(id) {
  return removeOne("plannedExpenses", id);
}

/**
 * Marks a planned expense as paid: creates the real expense transaction
 * (which is what actually reduces the account balance) and links the two
 * records together so the planned expense can never be double counted.
 */
export async function markPlannedExpenseAsPaid(plannedExpense, { accountId, date }) {
  if (plannedExpense.status === "completed") {
    throw new Error("This planned expense is already marked as paid.");
  }

  const transaction = await recordExpense({
    amountCentavos: plannedExpense.amountCentavos,
    categoryId: plannedExpense.categoryId,
    note: plannedExpense.description,
    date: date || new Date().toISOString().slice(0, 10),
    accountId,
  });

  await putOne("plannedExpenses", {
    ...plannedExpense,
    status: "completed",
    completedTransactionId: transaction.id,
  });

  return transaction;
}

/** Only "planned" (not yet paid) items count toward projected balance. */
export function getUpcoming(plannedExpenses) {
  return plannedExpenses.filter((p) => p.status === "planned");
}
