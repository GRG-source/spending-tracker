// Initialize data
let transactions = JSON.parse(localStorage.getItem('transactions')) || [];

// DOM Loaded
document.addEventListener('DOMContentLoaded', () => {
  updateTransactionList();
  updateSummary();
  if (localStorage.getItem('darkMode') === 'true') {
    document.body.classList.add('dark-mode');
  }
  
  // Request notification permission
  Notification.requestPermission();
});

// ======================
// SMS AUTO-TRACKING
// ======================
document.getElementById('smsPermissionBtn').addEventListener('click', async () => {
  try {
    if (!navigator.sms) {
      throw new Error('SMS API not supported');
    }
    
    const permissionStatus = await navigator.permissions.query({ name: 'sms' });
    
    if (permissionStatus.state === 'granted') {
      startSMSTracking();
    } else {
      const result = await navigator.sms.requestReadPermission();
      if (result === 'granted') {
        startSMSTracking();
      } else {
        alert('SMS permission denied. Auto-tracking disabled.');
      }
    }
  } catch (error) {
    console.error('SMS Error:', error);
    alert(`SMS auto-tracking not available: ${error.message}`);
  }
});

function startSMSTracking() {
  // Listen for new SMS
  navigator.sms.addEventListener('onmessage', (event) => {
    processBankSMS(event.message);
  });
  
  // Check existing SMS
  navigator.sms.getMessages({
    filter: { 
      from: ['AXISBANK', 'HDFCBANK', 'ICICIBANK', 'SBI'] // Common Indian bank SMS IDs
    },
    limit: 20
  }).then(messages => {
    messages.forEach(processBankSMS);
  });
}

function processBankSMS(sms) {
  const message = sms.body;
  
  // Indian bank SMS patterns
  const patterns = {
    credit: /(?:credited|received|deposited).*?(?:rs\.?|₹)\s?(\d+,?\d*\.?\d+)/i,
    debit: /(?:debited|spent|paid).*?(?:rs\.?|₹)\s?(\d+,?\d*\.?\d+)/i,
    balance: /(?:bal|balance).*?(?:rs\.?|₹)\s?(\d+,?\d*\.?\d+)/i
  };
  
  let amount, type, category = 'Bank Transaction';
  
  if (patterns.credit.test(message)) {
    const match = message.match(patterns.credit);
    amount = parseFloat(match[1].replace(',', ''));
    type = 'income';
    category = 'Bank Credit';
  } 
  else if (patterns.debit.test(message)) {
    const match = message.match(patterns.debit);
    amount = parseFloat(match[1].replace(',', ''));
    type = 'expense';
    category = 'Bank Debit';
  }
  
  if (amount && type) {
    addTransaction({
      amount: type === 'income' ? amount : -amount,
      type,
      category,
      date: new Date().toISOString().split('T')[0],
      source: 'auto-sms'
    });
    
    // Show notification
    if (Notification.permission === 'granted') {
      new Notification(`Added ${type}: ₹${amount}`, {
        body: `From: ${sms.address}`
      });
    }
  }
}

// ======================
// CORE FUNCTIONALITY
// ======================
function addTransaction(transaction) {
  transactions.push(transaction);
  localStorage.setItem('transactions', JSON.stringify(transactions));
  updateTransactionList();
  updateSummary();
}

// Form: Add Transaction
document.getElementById('transactionForm').addEventListener('submit', (e) => {
  e.preventDefault();
  const amount = parseFloat(document.getElementById('amount').value);
  const type = document.getElementById('type').value;
  const category = type === 'expense' ? document.getElementById('category').value : 'Income';
  const date = document.getElementById('date').value;

  if (!amount || !date) return alert('Please fill all fields!');

  addTransaction({
    amount: type === 'expense' ? -Math.abs(amount) : Math.abs(amount),
    type,
    category,
    date,
    source: 'manual'
  });
  
  e.target.reset();
});

// Update Transactions Table
function updateTransactionList() {
  const tbody = document.getElementById('transactionsList');
  tbody.innerHTML = '';

  transactions.forEach((transaction, index) => {
    const row = document.createElement('tr');
    row.innerHTML = `
      <td>₹${Math.abs(transaction.amount).toFixed(2)}</td>
      <td>${transaction.type}</td>
      <td>${transaction.category}</td>
      <td>${transaction.date}</td>
      <td>${transaction.source === 'auto-sms' ? '📱 Auto' : '✏️ Manual'}</td>
      <td><button class="btn btn-sm btn-danger" onclick="deleteTransaction(${index})">Delete</button></td>
    `;
    tbody.appendChild(row);
  });
}

// Update Summary Cards
function updateSummary() {
  const totalIncome = transactions
    .filter(t => t.amount > 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const totalExpense = transactions
    .filter(t => t.amount < 0)
    .reduce((sum, t) => sum + t.amount, 0);

  const balance = totalIncome + totalExpense;
  const balanceElement = document.getElementById('balance');
  const balanceCard = document.getElementById('balanceCard');

  // Update values
  document.getElementById('totalIncome').textContent = `₹${totalIncome.toFixed(2)}`;
  document.getElementById('totalExpense').textContent = `₹${Math.abs(totalExpense).toFixed(2)}`;
  balanceElement.textContent = `₹${balance.toFixed(2)}`;

  // Update balance card color
  balanceCard.classList.remove('positive-balance', 'negative-balance');
  if (balance < 0) {
    balanceCard.classList.add('negative-balance');
  } else {
    balanceCard.classList.add('positive-balance');
  }
}

// Delete Transaction
function deleteTransaction(index) {
  if (confirm('Delete this transaction?')) {
    transactions.splice(index, 1);
    localStorage.setItem('transactions', JSON.stringify(transactions));
    updateTransactionList();
    updateSummary();
  }
}

// Export to CSV
function exportToCSV() {
  let csv = 'Amount,Type,Category,Date,Source\n';
  transactions.forEach(t => {
    csv += `${t.amount},${t.type},${t.category},${t.date},${t.source}\n`;
  });

  const blob = new Blob([csv], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'transactions.csv';
  a.click();
}

// Dark Mode Toggle
document.getElementById('darkModeToggle').addEventListener('click', () => {
  document.body.classList.toggle('dark-mode');
  localStorage.setItem('darkMode', document.body.classList.contains('dark-mode'));
});

// Toggle category field
document.getElementById('type').addEventListener('change', function() {
  document.getElementById('categoryField').style.display = 
    this.value === 'expense' ? 'block' : 'none';
});