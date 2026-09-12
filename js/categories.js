import { getAll, putOne, removeOne, makeId } from "./database.js";

export const DEFAULT_EXPENSE_CATEGORIES = [
  "Food",
  "Transportation",
  "School",
  "Rent",
  "Electricity",
  "Water",
  "Load",
  "Internet",
  "Groceries",
  "Medicine",
  "Family",
  "Savings",
  "Entertainment",
  "Shopping",
  "Other",
];

export const DEFAULT_INCOME_CATEGORIES = [
  "Salary",
  "Allowance",
  "Freelance",
  "Business",
  "Gift",
  "Other",
];

/** Creates the default categories if none exist yet. Safe to call every launch. */
export async function seedDefaultCategoriesIfNeeded() {
  const existing = await getAll("categories");
  if (existing.length > 0) return;

  const seed = [
    ...DEFAULT_EXPENSE_CATEGORIES.map((name) => ({ name, kind: "expense" })),
    ...DEFAULT_INCOME_CATEGORIES.map((name) => ({ name, kind: "income" })),
  ];

  for (const item of seed) {
    await putOne("categories", {
      id: makeId(),
      name: item.name,
      kind: item.kind,
      isDefault: true,
    });
  }
}

export async function getCategories(kind) {
  const all = await getAll("categories");
  return kind ? all.filter((c) => c.kind === kind) : all;
}

export async function addCategory(name, kind) {
  const trimmed = name.trim();
  if (!trimmed) throw new Error("Category name cannot be empty.");
  return putOne("categories", {
    id: makeId(),
    name: trimmed,
    kind,
    isDefault: false,
  });
}

export async function deleteCategory(id) {
  return removeOne("categories", id);
}
