import { withBalances } from "./accounts.js";
import { getActiveAllocations } from "./allocations.js";
import { getUpcoming } from "./planned-expenses.js";

/** Total money = sum of every non-archived account's current balance. */
export function calculateTotalMoney(accounts, transactions) {
  const balances = withBalances(accounts.filter((a) => !a.archived), transactions);
  return balances.reduce((sum, a) => sum + a.balanceCentavos, 0);
}

/** Groups account balances into Cash / Bank / E-Wallet / Other buckets. */
export function calculateMoneyByType(accounts, transactions) {
  const balances = withBalances(accounts.filter((a) => !a.archived), transactions);
  const buckets = { cash: 0, bank: 0, ewallet: 0, other: 0 };
  for (const account of balances) {
    buckets[account.type] = (buckets[account.type] || 0) + account.balanceCentavos;
  }
  return buckets;
}

/** Available money = Total - money the user has reserved for something. */
export function calculateAvailableMoney(totalMoneyCentavos, allocations) {
  const reserved = getActiveAllocations(allocations).reduce((sum, a) => sum + a.amountCentavos, 0);
  return { reserved, available: totalMoneyCentavos - reserved };
}

/** Projected money = Total - upcoming (not yet paid) planned expenses. This is an estimate only; it never changes real balances. */
export function calculateProjectedMoney(totalMoneyCentavos, plannedExpenses) {
  const upcoming = getUpcoming(plannedExpenses).reduce((sum, p) => sum + p.amountCentavos, 0);
  return { upcoming, projected: totalMoneyCentavos - upcoming };
}

function isSameDay(dateA, dateB) {
  return dateA.slice(0, 10) === dateB.slice(0, 10);
}

function isSameMonth(dateA, yearMonth) {
  return dateA.slice(0, 7) === yearMonth;
}

/** Returns the "YYYY-MM" string for a given Date object. */
export function toYearMonth(date) {
  return date.toISOString().slice(0, 7);
}

export function previousYearMonth(yearMonth) {
  const [year, month] = yearMonth.split("-").map(Number);
  const date = new Date(year, month - 2, 1); // month is 1-indexed in the string
  return toYearMonth(date);
}

/** All expense/income transactions for a single calendar day, plus the day's total. */
export function getDailySummary(transactions, isoDate) {
  const dayTransactions = transactions.filter(
    (t) => t.type === "expense" && isSameDay(t.date, isoDate)
  );
  const total = dayTransactions.reduce((sum, t) => sum + t.amountCentavos, 0);
  return { transactions: dayTransactions, totalCentavos: total };
}

/** Full monthly report: income, expenses, savings, averages, category breakdown, etc. */
export function getMonthlySummary(transactions, yearMonth) {
  const monthTransactions = transactions.filter((t) => isSameMonth(t.date, yearMonth));

  const income = monthTransactions
    .filter((t) => t.type === "income")
    .reduce((sum, t) => sum + t.amountCentavos, 0);

  const expenseTransactions = monthTransactions.filter((t) => t.type === "expense");
  const expenses = expenseTransactions.reduce((sum, t) => sum + t.amountCentavos, 0);

  const savings = income - expenses;

  const [year, month] = yearMonth.split("-").map(Number);
  const daysInMonth = new Date(year, month, 0).getDate();
  const today = new Date();
  const isCurrentMonth = toYearMonth(today) === yearMonth;
  const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;
  const averageDailySpending = daysElapsed > 0 ? Math.round(expenses / daysElapsed) : 0;

  const spendingByDay = {};
  for (const t of expenseTransactions) {
    const day = t.date.slice(0, 10);
    spendingByDay[day] = (spendingByDay[day] || 0) + t.amountCentavos;
  }
  let highestSpendingDay = null;
  let highestSpendingAmount = 0;
  for (const [day, amount] of Object.entries(spendingByDay)) {
    if (amount > highestSpendingAmount) {
      highestSpendingAmount = amount;
      highestSpendingDay = day;
    }
  }

  const categoryTotals = {};
  for (const t of expenseTransactions) {
    const key = t.categoryId || "uncategorized";
    categoryTotals[key] = (categoryTotals[key] || 0) + t.amountCentavos;
  }

  return {
    yearMonth,
    incomeCentavos: income,
    expensesCentavos: expenses,
    savingsCentavos: savings,
    savingsRatePercent: income > 0 ? (savings / income) * 100 : null,
    averageDailySpendingCentavos: averageDailySpending,
    highestSpendingDay,
    highestSpendingAmountCentavos: highestSpendingAmount,
    categoryTotals,
    transactionCount: monthTransactions.length,
  };
}

/**
 * Compares two months and returns a plain-language, non-judgmental
 * verdict. Improvements are celebrated; setbacks are framed neutrally,
 * never with guilt or shame (see rule #19 in the brief).
 */
export function compareMonths(currentSummary, previousSummary) {
  const savingsDiff = currentSummary.savingsCentavos - previousSummary.savingsCentavos;
  const expenseDiff = currentSummary.expensesCentavos - previousSummary.expensesCentavos;
  const expenseDiffPercent =
    previousSummary.expensesCentavos > 0
      ? (expenseDiff / previousSummary.expensesCentavos) * 100
      : null;

  let message;
  let tone; // "positive" | "neutral" | "negative" is used only for subtle styling, never to shame

  if (savingsDiff > 0) {
    tone = "positive";
    message = "Great job! You saved more than last month.";
  } else if (expenseDiff < 0) {
    tone = "positive";
    message = "Nice work! You spent less than last month.";
  } else if (savingsDiff === 0 && expenseDiff === 0) {
    tone = "neutral";
    message = "About the same as last month.";
  } else {
    tone = "neutral";
    message =
      "Your spending increased this month. That's okay — review your biggest categories to see where the difference came from.";
  }

  return { savingsDiff, expenseDiff, expenseDiffPercent, message, tone };
}
