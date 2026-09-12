# Ipon Local — Finance Tracker

A simple, local-first personal money tracker. Built with Filipino users in mind, but flexible enough for anyone.

**No account. No backend. No tracking. No ads.** Your data lives only in your browser.

> **"I opened this and immediately understand my money."**
>
> That's the entire goal of this project.

## Why this exists

Most budgeting apps are either too simple (just a list of transactions) or too complicated (a banking dashboard full of jargon).

Ipon Local tries to sit in the middle. It focuses on answering three questions clearly:

1. **How much money do I have?**
   Total money across every account.

2. **Where is my money?**
   Cash, banks, and e-wallets.

3. **Where is my money going?**
   Daily and monthly spending, categories, upcoming expenses, and trends.

It also doubles as a learning project. The code favors **clarity over cleverness** so that it's easy to read, understand, and contribute to.

## Features

* Cash, bank, and e-wallet accounts with balances calculated from actual transactions
* Income, expenses, transfers, deposits, and withdrawals
* A withdrawal-fee helper — enter what you actually received instead of calculating the fee yourself
* Planned expenses that don't affect your balance until they're marked as paid
* Reserved / set-aside money that stays in your account but is excluded from available money
* Daily and monthly breakdowns
* Category charts and spending summaries
* Income vs. expense and savings trends
* Non-judgmental month-over-month comparisons
* Full transaction history with search, filters, editing, and deletion
* Automatic recalculation after changes
* One-click JSON backup export
* Confirmed JSON backup import for restoring data
* Works offline once loaded
* No login, cloud account, or advertising

## Technology

Ipon Local is built with:

* **HTML5**
* **CSS3**
* **Vanilla JavaScript (ES modules)**
* **IndexedDB**
* **Inline SVG**

There is no framework or backend, and no build step in the traditional sense — the small `package.json` in this repo exists purely to give you a one-command local server (see below), not to compile or bundle anything.

Data is stored in **IndexedDB**, the browser's built-in database, allowing it to survive page reloads and work offline.

Money is stored internally as **integer centavos** to avoid floating-point rounding errors.

For example:

```text
₱820.50 → 82050 centavos
```

Values are only formatted into peso amounts when displayed.

Charts are drawn using inline SVG instead of a charting library. The project's charts are simple enough that an external dependency isn't necessary.

## Running it

Ipon Local uses ES modules (`<script type="module">`) and IndexedDB, both of which browsers restrict when a page is opened directly from disk (a `file://` URL). **Double-clicking `index.html` will not work reliably** — module imports get blocked by the browser's security rules, and the app will appear to hang with no visible error.

Instead, serve the folder over `http://localhost` with any static file server. Two easy options:

**Option 1 — npm (uses the included `package.json`)**
```bash
cd ipon-local
npm start
```
This runs a local server on `http://localhost:3000`. Open that URL in your browser. Leave the terminal window open for as long as you're using the app — closing it stops the server (your data is safe either way, since it's saved in IndexedDB, not in the server process).

**Option 2 — Python (no Node/npm required)**
```bash
cd ipon-local
python3 -m http.server 8000
```
Then open `http://localhost:8000`.

Either way works identically — pick whichever you already have installed.

## Project structure

```text
ipon-local/
├── index.html              Page shell + navigation
├── package.json            npm script for a local dev server (no build step)
├── manifest.json            PWA manifest
├── LICENSE
├── README.md
├── css/
│   └── styles.css          All styling
├── js/
│   ├── app.js              Entry point: initialization + navigation
│   ├── database.js         IndexedDB open/read/write helpers
│   ├── money.js            Centavo math + peso formatting
│   ├── accounts.js         Accounts + balance calculation
│   ├── categories.js       Expense/income categories
│   ├── transactions.js     Income, expense, transfer, withdrawal
│   ├── planned-expenses.js Future expenses
│   ├── allocations.js      Reserved / set-aside money
│   ├── calculations.js     Derived numbers + monthly reports
│   ├── charts.js            Dependency-free inline SVG charts
│   ├── backup.js            JSON export/import
│   ├── modal.js              Modal, toast, and confirmation helpers
│   └── ui.js                Screen rendering
└── assets/
    └── logo.svg             App icon
```

## Data model (IndexedDB)

| Store             | Purpose                                                    |
| ----------------- | ---------------------------------------------------------- |
| `accounts`        | Cash, bank, and e-wallet accounts with starting balances   |
| `transactions`    | Every income, expense, transfer, and withdrawal            |
| `plannedExpenses` | Future expenses kept separate until marked as paid         |
| `allocations`     | Reserved / set-aside money                                 |
| `categories`      | Expense and income categories, including custom categories |
| `settings`        | Reserved for future app-level settings                     |

Account balances, monthly totals, savings, and other summary figures are **calculated from the stored data** rather than maintained as separate cached totals.

## Backing up your data

Go to:

**Settings → Export Backup**

This downloads a JSON file containing your app data.

To restore a backup:

**Settings → Import Backup**

Select a previously exported JSON file. Importing a backup **replaces the current data**, and the app will ask for confirmation before doing so.

## Limitations / What this is not

Ipon Local is a personal money tracker, not a banking platform.

It intentionally does **not** include:

* Bank synchronization
* Authentication
* Cloud storage
* Investments
* Loans
* Credit scores
* Financial advice

These features are outside the scope of the project.

## Future possibilities

Possible future improvements include:

* Optional monthly budgets per category
* A basic service worker for full offline installability
* Multi-currency support

Multi-currency support is not fundamentally blocked by the data model, but it is intentionally out of scope for v1.

## Contributing

Contributions are welcome.

Before making a major change, please consider opening an issue first so the approach can be discussed.

When contributing, try to keep the project's core philosophy in mind:

> **Keep it simple. Keep it understandable. Keep the user's money easy to understand.**

## License

MIT — see [LICENSE](LICENSE).