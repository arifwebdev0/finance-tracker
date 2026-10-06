const STORAGE_KEY = "spendwise_transactions";
const BUDGET_KEY = "spendwise_budget";
const THEME_KEY = "spendwise_theme";

let transactions = JSON.parse(localStorage.getItem(STORAGE_KEY)) || [];
let budget = Number(localStorage.getItem(BUDGET_KEY)) || 0;
let selectedType = "expense";
let pendingDeleteId = null;
let expenseChart = null;

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => document.querySelectorAll(selector);

const elements = {
  body: document.body,
  sidebar: $("#sidebar"),
  menuBtn: $("#menuBtn"),
  pageTitle: $("#pageTitle"),
  todayText: $("#todayText"),
  themeBtn: $("#themeBtn"),
  quickAddBtn: $("#quickAddBtn"),

  balanceValue: $("#balanceValue"),
  incomeValue: $("#incomeValue"),
  expenseValue: $("#expenseValue"),
  budgetValue: $("#budgetValue"),
  budgetProgress: $("#budgetProgress"),
  budgetMeta: $("#budgetMeta"),

  transactionForm: $("#transactionForm"),
  transactionId: $("#transactionId"),
  formTitle: $("#formTitle"),
  title: $("#title"),
  amount: $("#amount"),
  category: $("#category"),
  date: $("#date"),
  submitBtn: $("#submitBtn"),
  cancelEditBtn: $("#cancelEditBtn"),
  formError: $("#formError"),

  recentTransactions: $("#recentTransactions"),
  allTransactions: $("#allTransactions"),
  emptyState: $("#emptyState"),
  searchInput: $("#searchInput"),
  filterSelect: $("#filterSelect"),
  categoryFilter: $("#categoryFilter"),
  sortSelect: $("#sortSelect"),

  budgetForm: $("#budgetForm"),
  budgetInput: $("#budgetInput"),
  budgetOverviewValue: $("#budgetOverviewValue"),
  bigBudgetProgress: $("#bigBudgetProgress"),
  budgetSpent: $("#budgetSpent"),
  budgetRemaining: $("#budgetRemaining"),

  converterForm: $("#converterForm"),
  convertAmount: $("#convertAmount"),
  fromCurrency: $("#fromCurrency"),
  toCurrency: $("#toCurrency"),
  swapCurrencyBtn: $("#swapCurrencyBtn"),
  conversionResult: $("#conversionResult"),
  apiStatus: $("#apiStatus"),

  expenseChart: $("#expenseChart"),
  chartEmpty: $("#chartEmpty"),

  deleteDialog: $("#deleteDialog"),
  closeDialogBtn: $("#closeDialogBtn"),
  cancelDeleteBtn: $("#cancelDeleteBtn"),
  confirmDeleteBtn: $("#confirmDeleteBtn"),
  toast: $("#toast")
};

function formatCurrency(amount, currency = "INR") {
  try {
    return new Intl.NumberFormat("en-IN", {
      style: "currency",
      currency,
      maximumFractionDigits: 2
    }).format(amount);
  } catch {
    return `₹${Number(amount).toFixed(2)}`;
  }
}

function formatDate(dateString) {
  return new Date(`${dateString}T00:00:00`).toLocaleDateString("en-IN", {
    day: "2-digit",
    month: "short",
    year: "numeric"
  });
}

function saveTransactions() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(transactions));
}

function saveBudget() {
  localStorage.setItem(BUDGET_KEY, String(budget));
}

function showToast(message) {
  elements.toast.textContent = message;
  elements.toast.classList.add("show");

  clearTimeout(showToast.timer);
  showToast.timer = setTimeout(() => {
    elements.toast.classList.remove("show");
  }, 2200);
}

function setToday() {
  const now = new Date();

  elements.todayText.textContent = now.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric"
  });

  const localDate = new Date(now.getTime() - now.getTimezoneOffset() * 60000)
    .toISOString()
    .slice(0, 10);

  if (!elements.date.value) {
    elements.date.value = localDate;
  }
}

function calculateTotals() {
  const income = transactions
    .filter(t => t.type === "income")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  const expenses = transactions
    .filter(t => t.type === "expense")
    .reduce((sum, t) => sum + Number(t.amount), 0);

  return {
    income,
    expenses,
    balance: income - expenses
  };
}

function updateDashboard() {
  const { income, expenses, balance } = calculateTotals();

  elements.balanceValue.textContent = formatCurrency(balance);
  elements.incomeValue.textContent = formatCurrency(income);
  elements.expenseValue.textContent = formatCurrency(expenses);
  elements.budgetValue.textContent = formatCurrency(budget);

  const percentage = budget > 0 ? Math.min((expenses / budget) * 100, 100) : 0;
  elements.budgetProgress.style.width = `${percentage}%`;

  if (!budget) {
    elements.budgetMeta.textContent = "Set a budget to start tracking.";
  } else if (expenses > budget) {
    elements.budgetMeta.textContent = `${formatCurrency(expenses - budget)} over budget`;
  } else {
    elements.budgetMeta.textContent =
      `${Math.round(percentage)}% used • ${formatCurrency(budget - expenses)} left`;
  }

  elements.budgetOverviewValue.textContent = formatCurrency(budget);
  elements.bigBudgetProgress.style.width = `${percentage}%`;
  elements.budgetSpent.textContent = formatCurrency(expenses);
  elements.budgetRemaining.textContent = formatCurrency(Math.max(budget - expenses, 0));
}

function transactionIcon(transaction) {
  const icons = {
    Food: "🍔",
    Shopping: "🛍️",
    Bills: "🧾",
    Transport: "🚗",
    Entertainment: "🎬",
    Health: "❤️",
    Education: "📚",
    Salary: "💼",
    Freelance: "💻",
    Other: "💳"
  };

  return transaction.type === "income" ? "💰" : (icons[transaction.category] || "💳");
}

function transactionHTML(transaction) {
  const sign = transaction.type === "income" ? "+" : "-";
  const amount = `${sign} ${formatCurrency(Number(transaction.amount))}`;

  return `
    <div class="transaction-item ${transaction.type}" data-id="${transaction.id}">
      <div class="transaction-icon">${transactionIcon(transaction)}</div>

      <div class="transaction-info">
        <strong>${escapeHTML(transaction.title)}</strong>
        <small>${escapeHTML(transaction.category)} • ${formatDate(transaction.date)}</small>
      </div>

      <div class="transaction-amount">${amount}</div>

      <div class="transaction-actions">
        <button class="small-action edit-btn" type="button" title="Edit">✏️</button>
        <button class="small-action delete delete-btn" type="button" title="Delete">🗑️</button>
      </div>
    </div>
  `;
}

function escapeHTML(value) {
  const div = document.createElement("div");
  div.textContent = String(value);
  return div.innerHTML;
}

function renderRecentTransactions() {
  const recent = [...transactions]
    .sort((a, b) => new Date(b.date) - new Date(a.date))
    .slice(0, 6);

  if (!recent.length) {
    elements.recentTransactions.innerHTML =
      `<div class="empty-state"><div>🧾</div><p>No transactions yet.</p></div>`;
    return;
  }

  elements.recentTransactions.innerHTML = recent.map(transactionHTML).join("");
}

function getFilteredTransactions() {
  const search = elements.searchInput.value.trim().toLowerCase();
  const type = elements.filterSelect.value;
  const category = elements.categoryFilter.value;
  const sort = elements.sortSelect.value;

  let result = transactions.filter(transaction => {
    const matchesSearch =
      transaction.title.toLowerCase().includes(search) ||
      transaction.category.toLowerCase().includes(search);

    const matchesType = type === "all" || transaction.type === type;
    const matchesCategory = category === "all" || transaction.category === category;

    return matchesSearch && matchesType && matchesCategory;
  });

  result.sort((a, b) => {
    if (sort === "newest") return new Date(b.date) - new Date(a.date);
    if (sort === "oldest") return new Date(a.date) - new Date(b.date);
    if (sort === "high") return Number(b.amount) - Number(a.amount);
    if (sort === "low") return Number(a.amount) - Number(b.amount);
    return 0;
  });

  return result;
}

function renderAllTransactions() {
  const filtered = getFilteredTransactions();

  elements.allTransactions.innerHTML = filtered.map(transactionHTML).join("");
  elements.emptyState.classList.toggle("hidden", filtered.length !== 0);
}

function populateCategoryFilter() {
  const current = elements.categoryFilter.value;

  const categories = [...new Set(transactions.map(t => t.category))]
    .sort((a, b) => a.localeCompare(b));

  elements.categoryFilter.innerHTML =
    `<option value="all">All categories</option>` +
    categories.map(category => `<option value="${escapeHTML(category)}">${escapeHTML(category)}</option>`).join("");

  if (categories.includes(current)) {
    elements.categoryFilter.value = current;
  }
}

function renderChart() {
  const expenseData = transactions
    .filter(t => t.type === "expense")
    .reduce((acc, transaction) => {
      acc[transaction.category] = (acc[transaction.category] || 0) + Number(transaction.amount);
      return acc;
    }, {});

  const labels = Object.keys(expenseData);
  const data = Object.values(expenseData);

  elements.chartEmpty.classList.toggle("hidden", labels.length > 0);

  if (!window.Chart) return;

  if (expenseChart) {
    expenseChart.destroy();
  }

  expenseChart = new Chart(elements.expenseChart, {
    type: "doughnut",
    data: {
      labels,
      datasets: [{
        data,
        borderWidth: 0
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: "bottom",
          labels: {
            color: getComputedStyle(document.body).getPropertyValue("--text")
          }
        }
      }
    }
  });
}

function renderEverything() {
  updateDashboard();
  populateCategoryFilter();
  renderRecentTransactions();
  renderAllTransactions();
  renderChart();
}

function resetForm() {
  elements.transactionForm.reset();
  elements.transactionId.value = "";
  elements.formTitle.textContent = "Add New Transaction";
  elements.submitBtn.textContent = "＋ Add Transaction";
  elements.cancelEditBtn.classList.add("hidden");
  elements.formError.textContent = "";
  selectedType = "expense";

  $$(".type-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === selectedType);
  });

  setToday();
}

function startEdit(id) {
  const transaction = transactions.find(t => String(t.id) === String(id));
  if (!transaction) return;

  elements.transactionId.value = transaction.id;
  elements.title.value = transaction.title;
  elements.amount.value = transaction.amount;
  elements.category.value = transaction.category;
  elements.date.value = transaction.date;

  selectedType = transaction.type;

  $$(".type-btn").forEach(btn => {
    btn.classList.toggle("active", btn.dataset.type === selectedType);
  });

  elements.formTitle.textContent = "Edit Transaction";
  elements.submitBtn.textContent = "Save Changes";
  elements.cancelEditBtn.classList.remove("hidden");
  elements.formError.textContent = "";

  showSection("dashboard");
  elements.title.focus();
}

function requestDelete(id) {
  pendingDeleteId = id;
  elements.deleteDialog.showModal();
}

function deleteTransaction() {
  if (pendingDeleteId === null) return;

  transactions = transactions.filter(t => String(t.id) !== String(pendingDeleteId));
  saveTransactions();
  pendingDeleteId = null;

  elements.deleteDialog.close();
  renderEverything();
  showToast("Transaction deleted.");
}

function handleTransactionSubmit(event) {
  event.preventDefault();
  elements.formError.textContent = "";

  const title = elements.title.value.trim();
  const amount = Number(elements.amount.value);
  const category = elements.category.value;
  const date = elements.date.value;

  if (!title || !amount || amount <= 0 || !category || !date) {
    elements.formError.textContent = "Please fill every field with valid values.";
    return;
  }

  const id = elements.transactionId.value;

  if (id) {
    const transaction = transactions.find(t => String(t.id) === String(id));

    if (transaction) {
      transaction.title = title;
      transaction.amount = amount;
      transaction.category = category;
      transaction.date = date;
      transaction.type = selectedType;
      showToast("Transaction updated.");
    }
  } else {
    transactions.push({
      id: Date.now(),
      title,
      amount,
      category,
      date,
      type: selectedType
    });

    showToast("Transaction added.");
  }

  saveTransactions();
  resetForm();
  renderEverything();
}

function showSection(sectionId) {
  $$(".page-section").forEach(section => {
    section.classList.toggle("active", section.id === sectionId);
  });

  $$(".nav-link").forEach(link => {
    link.classList.toggle("active", link.dataset.section === sectionId);
  });

  const names = {
    dashboard: "Dashboard",
    transactions: "Transactions",
    budget: "Budget",
    converter: "Currency Converter"
  };

  elements.pageTitle.textContent = names[sectionId] || "Dashboard";
  elements.sidebar.classList.remove("open");
  window.scrollTo({ top: 0, behavior: "smooth" });
}

function applyTheme(theme) {
  elements.body.classList.toggle("dark", theme === "dark");
  elements.themeBtn.innerHTML = theme === "dark" ? "🌙 <span>Theme</span>" : "☀️ <span>Theme</span>";
  localStorage.setItem(THEME_KEY, theme);

  if (expenseChart) {
    renderChart();
  }
}

async function convertCurrency(event) {
  event.preventDefault();

  const amount = Number(elements.convertAmount.value);
  const from = elements.fromCurrency.value;
  const to = elements.toCurrency.value;

  if (!amount || amount < 0) {
    elements.apiStatus.textContent = "Enter a valid amount.";
    return;
  }

  if (from === to) {
    elements.conversionResult.innerHTML = `
      <span>Result</span>
      <strong>${formatCurrency(amount, to)}</strong>
      <small>Same currency selected.</small>
    `;
    elements.apiStatus.textContent = "";
    return;
  }

  elements.apiStatus.textContent = "Loading exchange rate...";

  try {
    const response = await fetch(
      `https://api.frankfurter.app/latest?amount=${encodeURIComponent(amount)}&from=${encodeURIComponent(from)}&to=${encodeURIComponent(to)}`
    );

    if (!response.ok) {
      throw new Error("Exchange-rate request failed.");
    }

    const data = await response.json();
    const converted = data.rates[to];

    elements.conversionResult.innerHTML = `
      <span>${formatCurrency(amount, from)}</span>
      <strong>${formatCurrency(converted, to)}</strong>
      <small>Rate date: ${data.date}</small>
    `;

    elements.apiStatus.textContent = "Exchange rate loaded successfully.";
  } catch (error) {
    elements.apiStatus.textContent =
      "Could not load exchange rates. Check your internet connection and try again.";
  }
}

function setupEvents() {
  $$(".nav-link").forEach(link => {
    link.addEventListener("click", () => showSection(link.dataset.section));
  });

  $$("[data-section-target]").forEach(button => {
    button.addEventListener("click", () => showSection(button.dataset.sectionTarget));
  });

  elements.menuBtn.addEventListener("click", () => {
    elements.sidebar.classList.toggle("open");
  });

  elements.themeBtn.addEventListener("click", () => {
    const next = elements.body.classList.contains("dark") ? "light" : "dark";
    applyTheme(next);
  });

  elements.quickAddBtn.addEventListener("click", () => {
    showSection("dashboard");
    resetForm();
    elements.title.focus();
  });

  elements.transactionsAddBtn.addEventListener("click", () => {
    showSection("dashboard");
    resetForm();
    elements.title.focus();
  });

  $$(".type-btn").forEach(button => {
    button.addEventListener("click", () => {
      selectedType = button.dataset.type;

      $$(".type-btn").forEach(btn => {
        btn.classList.toggle("active", btn === button);
      });

      if (selectedType === "income") {
        elements.category.value = "";
      }
    });
  });

  elements.transactionForm.addEventListener("submit", handleTransactionSubmit);
  elements.cancelEditBtn.addEventListener("click", resetForm);

  [elements.searchInput, elements.filterSelect, elements.categoryFilter, elements.sortSelect]
    .forEach(element => {
      element.addEventListener("input", renderAllTransactions);
      element.addEventListener("change", renderAllTransactions);
    });

  document.addEventListener("click", event => {
    const editButton = event.target.closest(".edit-btn");
    const deleteButton = event.target.closest(".delete-btn");

    if (editButton) {
      const item = editButton.closest(".transaction-item");
      startEdit(item.dataset.id);
    }

    if (deleteButton) {
      const item = deleteButton.closest(".transaction-item");
      requestDelete(item.dataset.id);
    }
  });

  elements.budgetForm.addEventListener("submit", event => {
    event.preventDefault();

    const value = Number(elements.budgetInput.value);

    if (value < 0 || Number.isNaN(value)) return;

    budget = value;
    saveBudget();
    renderEverything();
    showToast("Budget saved.");
    elements.budgetInput.value = "";
  });

  elements.converterForm.addEventListener("submit", convertCurrency);

  elements.swapCurrencyBtn.addEventListener("click", () => {
    const from = elements.fromCurrency.value;
    elements.fromCurrency.value = elements.toCurrency.value;
    elements.toCurrency.value = from;
  });

  elements.closeDialogBtn.addEventListener("click", () => elements.deleteDialog.close());
  elements.cancelDeleteBtn.addEventListener("click", () => elements.deleteDialog.close());
  elements.confirmDeleteBtn.addEventListener("click", deleteTransaction);

  document.addEventListener("keydown", event => {
    const tag = document.activeElement.tagName.toLowerCase();
    const typing = ["input", "textarea", "select"].includes(tag);

    if (event.key === "Escape" && elements.deleteDialog.open) {
      elements.deleteDialog.close();
    }

    if (typing) return;

    if (event.key.toLowerCase() === "n") {
      showSection("dashboard");
      resetForm();
      elements.title.focus();
    }

    if (event.key === "/") {
      event.preventDefault();
      showSection("transactions");
      elements.searchInput.focus();
    }

    if (event.key.toLowerCase() === "d") {
      const next = elements.body.classList.contains("dark") ? "light" : "dark";
      applyTheme(next);
    }
  });
}

function init() {
  const savedTheme = localStorage.getItem(THEME_KEY) || "light";
  applyTheme(savedTheme);
  setToday();

  if (budget > 0) {
    elements.budgetInput.value = budget;
  }

  setupEvents();
  renderEverything();
}

init();
