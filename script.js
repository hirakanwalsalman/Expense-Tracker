const STORAGE_KEY = 'personal-expense-tracker-v2';
const THEME_KEY = 'expense-theme';

const categoryMeta = {
  Food: { color: '#16a34a', soft: 'rgba(34, 197, 94, 0.12)' },
  Transport: { color: '#2563eb', soft: 'rgba(59, 130, 246, 0.12)' },
  Shopping: { color: '#8b5cf6', soft: 'rgba(168, 85, 247, 0.12)' },
  Bills: { color: '#f97316', soft: 'rgba(249, 115, 22, 0.12)' },
  Health: { color: '#ef4444', soft: 'rgba(239, 68, 68, 0.12)' },
  Other: { color: '#64748b', soft: 'rgba(100, 116, 139, 0.12)' },
};

const expenseForm = document.getElementById('expense-form');
const titleInput = document.getElementById('title');
const amountInput = document.getElementById('amount');
const categoryInput = document.getElementById('category');
const recurringInput = document.getElementById('recurring');
const categoryFilter = document.getElementById('category-filter');
const searchInput = document.getElementById('expense-search');
const totalExpenses = document.getElementById('total-expenses');
const expenseList = document.getElementById('expense-list');
const breakdownEl = document.getElementById('category-breakdown');
const chartBarsEl = document.getElementById('chart-bars');
const recentExpensesEl = document.getElementById('recent-expenses');
const exportButton = document.getElementById('export-csv');
const themeToggle = document.getElementById('theme-toggle');
const donutChart = document.getElementById('donut-chart');
const submitButton = expenseForm.querySelector('button[type="submit"]');
const titleError = document.getElementById('title-error');
const amountError = document.getElementById('amount-error');
const formMessage = document.getElementById('form-message');

const state = {
  expenses: loadExpenses(),
  filter: 'All',
  searchTerm: '',
  editingId: null,
  expandedId: null,
  theme: localStorage.getItem(THEME_KEY) || 'light',
};

function formatCurrency(value) {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(Number(value || 0));
}

function generateId() {
  if (window.crypto && typeof window.crypto.randomUUID === 'function') {
    return window.crypto.randomUUID();
  }

  return `expense-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function loadExpenses() {
  try {
    const savedExpenses = JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
    return Array.isArray(savedExpenses) ? savedExpenses : [];
  } catch (error) {
    return [];
  }
}

function saveExpenses() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.expenses));
}

function getCategoryMeta(category) {
  return categoryMeta[category] || { color: '#64748b', soft: 'rgba(100, 116, 139, 0.12)' };
}

function resetForm() {
  expenseForm.reset();
  categoryInput.value = 'Food';
  recurringInput.checked = false;
  state.editingId = null;
  submitButton.textContent = 'Add Expense';
  clearValidation();
  formMessage.textContent = '';
}

function clearValidation() {
  titleError.textContent = '';
  amountError.textContent = '';
  titleInput.classList.remove('input-error');
  amountInput.classList.remove('input-error');
}

function showValidation(field, message) {
  if (field === 'title') {
    titleError.textContent = message;
    titleInput.classList.add('input-error');
  }

  if (field === 'amount') {
    amountError.textContent = message;
    amountInput.classList.add('input-error');
  }
}

function validateForm(title, amount) {
  clearValidation();

  let isValid = true;

  if (!title.trim()) {
    showValidation('title', 'Please enter an expense title.');
    isValid = false;
  }

  if (Number(amount) <= 0) {
    showValidation('amount', 'Amount must be greater than $0.00.');
    isValid = false;
  }

  return isValid;
}

function getVisibleExpenses() {
  const query = state.searchTerm.trim().toLowerCase();

  let filtered = state.filter === 'All'
    ? [...state.expenses]
    : state.expenses.filter((expense) => expense.category === state.filter);

  if (query) {
    filtered = filtered.filter((expense) => {
      const matchesTitle = expense.title.toLowerCase().includes(query);
      const matchesCategory = expense.category.toLowerCase().includes(query);
      return matchesTitle || matchesCategory;
    });
  }

  return filtered.sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0));
}

function renderEmptyState(message) {
  expenseList.innerHTML = `
    <tr class="empty-row">
      <td colspan="5">${message}</td>
    </tr>
  `;
}

function updateTotal() {
  const total = state.expenses.reduce((sum, expense) => sum + Number(expense.amount), 0);
  totalExpenses.textContent = formatCurrency(total);
}

function updateTheme() {
  document.body.classList.toggle('dark-theme', state.theme === 'dark');
  localStorage.setItem(THEME_KEY, state.theme);

  const toggleText = themeToggle?.querySelector('.theme-toggle-text');
  const toggleIcon = themeToggle?.querySelector('.theme-toggle-icon');

  if (toggleText) {
    toggleText.textContent = state.theme === 'dark' ? 'Light' : 'Dark';
  }

  if (toggleIcon) {
    toggleIcon.textContent = state.theme === 'dark' ? '☀️' : '🌙';
  }
}

function renderDonutChart() {
  const totals = {};
  state.expenses.forEach((expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + Number(expense.amount);
  });

  const entries = Object.entries(totals);

  if (!entries.length) {
    donutChart.style.background = 'conic-gradient(#94a3b8 0 100%)';
    donutChart.innerHTML = '<div class="donut-chart-label">0%<br />Spent</div>';
    return;
  }

  const totalAmount = entries.reduce((sum, [, value]) => sum + value, 0);
  let start = 0;
  const gradientSegments = entries.map(([category, value]) => {
    const meta = getCategoryMeta(category);
    const end = start + (value / totalAmount) * 100;
    const segment = `${meta.color} ${start}% ${end}%`;
    start = end;
    return segment;
  });

  donutChart.style.background = `conic-gradient(${gradientSegments.join(', ')})`;
  donutChart.innerHTML = `<div class="donut-chart-label">${formatCurrency(totalAmount)}<br /><span style="font-size:0.7rem; font-weight:600; opacity:0.8;">Total</span></div>`;
}

function renderBreakdown() {
  const totals = {};

  state.expenses.forEach((expense) => {
    totals[expense.category] = (totals[expense.category] || 0) + Number(expense.amount);
  });

  const entries = Object.entries(totals).sort(([, a], [, b]) => b - a);

  if (!entries.length) {
    breakdownEl.innerHTML = '<p class="muted-text">No category totals yet.</p>';
    chartBarsEl.innerHTML = '';
    renderDonutChart();
    return;
  }

  const maxValue = Math.max(...entries.map(([, value]) => value), 1);

  breakdownEl.innerHTML = entries
    .map(([category, totalAmount]) => {
      const meta = getCategoryMeta(category);
      return `
        <div class="breakdown-row">
          <span class="category-tag" style="--tag-soft:${meta.soft}; background:${meta.soft}; color:${meta.color};">${category}</span>
          <strong>${formatCurrency(totalAmount)}</strong>
        </div>
      `;
    })
    .join('');

  chartBarsEl.innerHTML = entries
    .map(([category, totalAmount]) => {
      const meta = getCategoryMeta(category);
      const percent = (totalAmount / maxValue) * 100;
      return `
        <div class="chart-item">
          <div class="chart-label">
            <span class="dot" style="background:${meta.color};"></span>
            ${category}
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width:${percent}%; background:${meta.color};"></div>
          </div>
          <span class="chart-value">${formatCurrency(totalAmount)}</span>
        </div>
      `;
    })
    .join('');

  renderDonutChart();
}

function renderRecentExpenses() {
  const recent = [...state.expenses]
    .sort((a, b) => Number(b.createdAt || 0) - Number(a.createdAt || 0))
    .slice(0, 5);

  if (!recent.length) {
    recentExpensesEl.innerHTML = '<p class="muted-text">No recent expenses yet.</p>';
    return;
  }

  recentExpensesEl.innerHTML = recent
    .map((expense) => {
      const meta = getCategoryMeta(expense.category);
      return `
        <div class="recent-card">
          <span class="category-tag" style="--tag-soft:${meta.soft}; background:${meta.soft}; color:${meta.color};">${expense.category}</span>
          <strong>${expense.title}</strong>
          <span class="recent-amount">${formatCurrency(expense.amount)}</span>
          <small>${expense.recurring ? 'Recurring' : 'One-time'}</small>
        </div>
      `;
    })
    .join('');
}

function renderExpenses() {
  const visibleExpenses = getVisibleExpenses();

  if (!visibleExpenses.length) {
    const message = state.expenses.length
      ? 'No matching expenses found.'
      : 'No expenses yet.';
    renderEmptyState(message);
    return;
  }

  expenseList.innerHTML = visibleExpenses
    .map((expense) => {
      const meta = getCategoryMeta(expense.category);

      if (state.editingId === expense.id) {
        return `
          <tr class="edit-row" data-id="${expense.id}">
            <td>
              <input class="inline-edit-input" id="edit-title-${expense.id}" value="${expense.title.replace(/"/g, '&quot;')}" />
            </td>
            <td>
              <input class="inline-edit-input" id="edit-amount-${expense.id}" type="number" min="0" step="0.01" value="${Number(expense.amount).toFixed(2)}" />
            </td>
            <td>
              <select class="inline-edit-input" id="edit-category-${expense.id}">
                ${Object.keys(categoryMeta).map((category) => `
                  <option value="${category}" ${category === expense.category ? 'selected' : ''}>${category}</option>
                `).join('')}
              </select>
            </td>
            <td>
              <label class="checkbox-row">
                <input type="checkbox" id="edit-recurring-${expense.id}" ${expense.recurring ? 'checked' : ''} />
                <span>Yes</span>
              </label>
            </td>
            <td>
              <button type="button" class="action-btn save" data-action="save" data-id="${expense.id}">Save</button>
              <button type="button" class="action-btn cancel" data-action="cancel" data-id="${expense.id}">Cancel</button>
            </td>
          </tr>
        `;
      }

      return `
        <tr class="expense-row ${state.expandedId === expense.id ? 'expanded' : ''}" data-id="${expense.id}" data-action="toggle-row">
          <td>${expense.title}</td>
          <td>${formatCurrency(expense.amount)}</td>
          <td>
            <span class="category-pill" style="background:${meta.soft}; color:${meta.color};">${expense.category}</span>
          </td>
          <td>${expense.recurring ? '<span class="recurring-badge">Recurring</span>' : '<span class="muted-text">One-time</span>'}</td>
          <td>
            <button type="button" class="action-btn edit" data-action="edit" data-id="${expense.id}">Edit</button>
            <button type="button" class="action-btn delete" data-action="delete" data-id="${expense.id}">Delete</button>
          </td>
        </tr>
        <tr class="mobile-details-row ${state.expandedId === expense.id ? 'show' : ''}">
          <td colspan="5">
            <div class="mobile-detail">
              <span><strong>Title:</strong> ${expense.title}</span>
              <span><strong>Category:</strong> ${expense.category}</span>
              <span><strong>Status:</strong> ${expense.recurring ? 'Recurring' : 'One-time'}</span>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');
}

function exportCsv() {
  if (!state.expenses.length) {
    formMessage.textContent = 'There are no expenses to export.';
    return;
  }

  const rows = [
    ['Title', 'Amount', 'Category', 'Recurring'],
    ...state.expenses.map((expense) => [
      expense.title,
      expense.amount,
      expense.category,
      expense.recurring ? 'Yes' : 'No',
    ]),
  ];

  const csvContent = rows
    .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
    .join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = 'expenses.csv';
  link.click();
  URL.revokeObjectURL(url);
  formMessage.textContent = 'Expenses exported as CSV.';
}

function handleFormSubmit(event) {
  event.preventDefault();

  const title = titleInput.value;
  const amount = amountInput.value;
  const category = categoryInput.value;
  const recurring = recurringInput.checked;

  if (!validateForm(title, amount)) {
    return;
  }

  const expenseData = {
    id: state.editingId || generateId(),
    title: title.trim(),
    amount: Number(amount),
    category,
    recurring,
    createdAt: Date.now(),
  };

  if (state.editingId) {
    state.expenses = state.expenses.map((expense) =>
      expense.id === state.editingId ? { ...expense, ...expenseData } : expense
    );
  } else {
    state.expenses.push(expenseData);
  }

  saveExpenses();
  updateTotal();
  renderBreakdown();
  renderRecentExpenses();
  renderExpenses();
  resetForm();
  formMessage.textContent = state.editingId ? 'Expense updated successfully.' : 'Expense added successfully.';
}

function handleListClick(event) {
  const actionButton = event.target.closest('[data-action]');

  if (!actionButton) {
    const row = event.target.closest('.expense-row');
    if (!row) {
      return;
    }

    const id = row.dataset.id;
    state.expandedId = state.expandedId === id ? null : id;
    renderExpenses();
    return;
  }

  const { action, id } = actionButton.dataset;

  if (action === 'delete') {
    state.expenses = state.expenses.filter((expense) => expense.id !== id);
    if (state.editingId === id) {
      resetForm();
    }
    saveExpenses();
    updateTotal();
    renderBreakdown();
    renderRecentExpenses();
    renderExpenses();
    return;
  }

  if (action === 'edit') {
    state.editingId = id;
    state.expandedId = null;
    renderExpenses();
    return;
  }

  if (action === 'cancel') {
    state.editingId = null;
    renderExpenses();
    return;
  }

  if (action === 'save') {
    const rowId = id;
    const title = document.getElementById(`edit-title-${rowId}`)?.value || '';
    const amount = document.getElementById(`edit-amount-${rowId}`)?.value || '0';
    const category = document.getElementById(`edit-category-${rowId}`)?.value || 'Food';
    const recurring = document.getElementById(`edit-recurring-${rowId}`)?.checked || false;

    if (!validateForm(title, amount)) {
      return;
    }

    state.expenses = state.expenses.map((expense) =>
      expense.id === rowId
        ? { ...expense, title: title.trim(), amount: Number(amount), category, recurring }
        : expense
    );

    state.editingId = null;
    saveExpenses();
    updateTotal();
    renderBreakdown();
    renderRecentExpenses();
    renderExpenses();
  }
}

expenseForm.addEventListener('submit', handleFormSubmit);
expenseList.addEventListener('click', handleListClick);
categoryFilter.addEventListener('change', (event) => {
  state.filter = event.target.value;
  renderExpenses();
});
searchInput.addEventListener('input', (event) => {
  state.searchTerm = event.target.value;
  renderExpenses();
});
exportButton.addEventListener('click', exportCsv);
themeToggle.addEventListener('click', () => {
  state.theme = state.theme === 'dark' ? 'light' : 'dark';
  updateTheme();
});

updateTheme();
updateTotal();
renderBreakdown();
renderRecentExpenses();
renderExpenses();
