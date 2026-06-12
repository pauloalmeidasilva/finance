/**
 * Theme Manager - Handles theme switching and persistence
 */
const ThemeManager = {
    STORAGE_KEY: 'theme_preference',
    
    async init() {
        const savedTheme = await this.getTheme();
        const systemPreference = this.getSystemPreference();
        const theme = savedTheme || systemPreference || 'dark-mode';
        this.applyTheme(theme);
    },

    async getTheme() {
        try {
            return await Neutralino.storage.getData(this.STORAGE_KEY);
        } catch {
            return null;
        }
    },

    async setTheme(theme) {
        try {
            await Neutralino.storage.setData(this.STORAGE_KEY, theme);
            this.applyTheme(theme);
        } catch (err) {
            console.error("Error saving theme:", err);
        }
    },

    getSystemPreference() {
        if (window.matchMedia && window.matchMedia('(prefers-color-scheme: light)').matches) {
            return 'light-mode';
        }
        return 'dark-mode';
    },

    applyTheme(theme) {
        document.body.className = theme;
        const icon = document.getElementById('themeToggle')?.querySelector('i');
        if (icon) {
            icon.className = theme === 'dark-mode' ? 'ph ph-moon' : 'ph ph-sun';
        }
    },

    toggle() {
        const current = document.body.className === 'dark-mode' ? 'light-mode' : 'dark-mode';
        this.setTheme(current);
    }
};

/**
 * Storage Manager - Handles data persistence using Neutralino Storage API
 */
const StorageManager = {
    DATA_KEY: 'finance_data',
    
    async init() {
        try {
            const data = await this.load();
            if (!data || (data.version === undefined)) {
                // Migrate old data or create new structure
                const initialData = this.createNewDataStructure();
                await this.save(initialData);
            }
        } catch (err) {
            console.error("Storage initialization error:", err);
        }
    },

    createNewDataStructure() {
        return {
            version: 2,
            accounts: {
                'default': {
                    id: 'default',
                    name: 'Principal',
                    icon: 'ph-bank',
                    color: 'indigo',
                    isActive: true,
                    entries: [],
                    investments: []
                }
            },
            currentAccount: 'default',
            periods: [
                {
                    id: 'current',
                    name: 'Período Atual',
                    description: '',
                    startDate: new Date().toISOString().split('T')[0],
                    endDate: null,
                    isOpen: true,
                    closeDescription: '',
                    createdAt: new Date().toISOString()
                }
            ],
            currentPeriod: 'current',
            transfers: []
        };
    },

    async load() {
        try {
            const content = await Neutralino.storage.getData(this.DATA_KEY);
            const data = JSON.parse(content);
            
            // Migrate v1 to v2 if needed
            if (!data.version || data.version === 1) {
                return this.migrateFromV1(data);
            }
            return this.ensureAccountFields(data);
        } catch (err) {
            return this.createNewDataStructure();
        }
    },

    migrateFromV1(oldData) {
        const newData = this.createNewDataStructure();
        // Move old data to default account
        if (oldData.incomes || oldData.expenses || oldData.investments) {
            const entries = [];
            // Convert incomes to entries
            if (oldData.incomes) {
                oldData.incomes.forEach(income => {
                    entries.push({
                        id: income.id,
                        type: 'income',
                        value: income.value,
                        description: income.type,
                        category: 'other',
                        notes: `Migrado - ${income.member}`,
                        periodId: 'current',
                        date: income.date,
                        createdAt: income.date
                    });
                });
            }
            // Convert expenses to entries
            if (oldData.expenses) {
                oldData.expenses.forEach(expense => {
                    entries.push({
                        id: expense.id,
                        type: 'expense',
                        value: expense.value,
                        description: expense.type,
                        category: expense.category || 'other',
                        notes: `Migrado - ${expense.member} @ ${expense.location}`,
                        periodId: 'current',
                        date: expense.date,
                        createdAt: expense.date
                    });
                });
            }
            newData.accounts.default.entries = entries;
            newData.accounts.default.investments = oldData.investments || [];
        }
        return newData;
    },

    // Ensure accounts have new fields added in later versions
    ensureAccountFields(data) {
        for (const account of Object.values(data.accounts)) {
            if (account.isActive === undefined) account.isActive = true;
            if (!account.color) account.color = 'indigo';
            // Migrate old structure to new
            if (account.incomes || account.expenses) {
                if (!account.entries) account.entries = [];
                if (account.incomes) {
                    account.incomes.forEach(income => {
                        account.entries.push({
                            id: income.id || Date.now() + Math.random(),
                            type: 'income',
                            value: income.value,
                            description: income.type,
                            category: 'other',
                            notes: `Migrado - ${income.member}`,
                            periodId: data.currentPeriod || 'current',
                            date: income.date,
                            createdAt: income.date
                        });
                    });
                    delete account.incomes;
                }
                if (account.expenses) {
                    account.expenses.forEach(expense => {
                        account.entries.push({
                            id: expense.id || Date.now() + Math.random(),
                            type: 'expense',
                            value: expense.value,
                            description: expense.type,
                            category: expense.category || 'other',
                            notes: `Migrado - ${expense.member} @ ${expense.location}`,
                            periodId: data.currentPeriod || 'current',
                            date: expense.date,
                            createdAt: expense.date
                        });
                    });
                    delete account.expenses;
                }
            }
            if (!account.entries) account.entries = [];
        }
        // Ensure periods have new fields
        if (data.periods) {
            data.periods.forEach(p => {
                if (p.description === undefined) p.description = '';
                if (p.closeDescription === undefined) p.closeDescription = '';
            });
        }
        return data;
    },

    async save(data) {
        try {
            await Neutralino.storage.setData(this.DATA_KEY, JSON.stringify(data, null, 2));
        } catch (err) {
            console.error("Error saving data:", err);
        }
    }
};

/**
 * Screen Loading Manager - Handles dynamic loading of HTML screens
 */
const ScreenLoadingManager = {
    screens: ['dashboard', 'cashbook', 'periods', 'accounts', 'investments', 'about'],
    
    async loadAll() {
        const container = document.getElementById('main-container');
        if (!container) return;
        
        container.innerHTML = ''; // Clear loading state
        
        for (const screen of this.screens) {
            try {
                const response = await fetch(`screens/${screen}.html`);
                const html = await response.text();
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = html.trim();
                // Append ALL root children (screens may have sibling modals)
                while (tempDiv.firstChild) {
                    container.appendChild(tempDiv.firstChild);
                }
            } catch (err) {
                console.error(`Error loading screen ${screen}:`, err);
            }
        }
    }
};

/**
 * App Controller - Handles UI and business logic
 */
const App = {
    data: null,
    chart: null,

    async init() {
        try {
            await ScreenLoadingManager.loadAll();
            await ThemeManager.init();
            await StorageManager.init();
            
            this.data = await StorageManager.load();
            this.registerEvents();
            this.initChart();
            this.updateUI();
            
            const now = new Date();
            const monthYear = now.toLocaleString('pt-br', { month: 'long', year: 'numeric' });
            document.getElementById('currentDate').textContent = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);
        } catch (err) {
            console.error("App init error:", err);
        } finally {
            this.hideSplashScreen();
        }
    },

    registerEvents() {
        // Navigation
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', (e) => {
                e.preventDefault();
                const sectionId = item.getAttribute('data-section');
                this.switchSection(sectionId);
            });
        });

        // Theme toggle
        const themeToggle = document.getElementById('themeToggle');
        if (themeToggle) {
            themeToggle.addEventListener('click', () => ThemeManager.toggle());
        }

        // Modals
        document.getElementById('openIncomeModal').onclick = () => this.toggleModal('incomeModal', true);
        document.getElementById('openExpenseModal').onclick = () => this.toggleModal('expenseModal', true);
        document.getElementById('openInvestmentModal').onclick = () => this.toggleModal('investmentModal', true);
        document.querySelectorAll('.close-modal').forEach(btn => {
            btn.onclick = () => {
                this.toggleModal('incomeModal', false);
                this.toggleModal('expenseModal', false);
                this.toggleModal('investmentModal', false);
            };
        });

        // Forms
        document.getElementById('incomeForm').onsubmit = async (e) => {
            e.preventDefault();
            await this.addIncome();
            this.toggleModal('incomeModal', false);
        };

        document.getElementById('expenseForm').onsubmit = async (e) => {
            e.preventDefault();
            await this.addExpense();
            this.toggleModal('expenseModal', false);
        };

        document.getElementById('investmentForm').onsubmit = async (e) => {
            e.preventDefault();
            await this.addInvestment();
            this.toggleModal('investmentModal', false);
        };

        // Account modal open
        document.getElementById('openAccountModal').addEventListener('click', () => {
            this.openAddAccountModal();
        });

        // Account modal close (using class close-account-modal to avoid conflict)
        document.querySelectorAll('.close-account-modal').forEach(btn => {
            btn.addEventListener('click', () => {
                this.toggleModal('accountModal', false);
            });
        });

        // Account form submit
        document.getElementById('accountForm').addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.saveAccountFromForm();
        });

        // Periods events
        const openPeriodBtn = document.getElementById('openPeriodModal');
        if (openPeriodBtn) {
            openPeriodBtn.addEventListener('click', () => this.openAddPeriodModal());
        }

        document.querySelectorAll('.close-period-modal').forEach(btn => {
            btn.addEventListener('click', () => this.toggleModal('periodModal', false));
        });

        const periodForm = document.getElementById('periodForm');
        if (periodForm) {
            periodForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.savePeriodFromForm();
            });
        }

        const closePeriodBtn = document.getElementById('closePeriodBtn');
        if (closePeriodBtn) {
            closePeriodBtn.addEventListener('click', () => this.openClosePeriodModal());
        }

        const closePeriodForm = document.getElementById('closePeriodForm');
        if (closePeriodForm) {
            closePeriodForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.closeCurrentPeriod();
            });
        }

        // Cashbook events
        const openCashbookBtn = document.getElementById('openCashbookModal');
        if (openCashbookBtn) {
            openCashbookBtn.addEventListener('click', () => this.openAddCashbookModal());
        }

        document.querySelectorAll('.close-cashbook-modal').forEach(btn => {
            btn.addEventListener('click', () => this.toggleModal('cashbookModal', false));
        });

        const cashbookForm = document.getElementById('cashbookForm');
        if (cashbookForm) {
            cashbookForm.addEventListener('submit', async (e) => {
                e.preventDefault();
                await this.saveCashbookEntry();
            });
        }

        // Filter events
        const dashAccountFilter = document.getElementById('dashboardAccountFilter');
        if (dashAccountFilter) {
            dashAccountFilter.addEventListener('change', () => this.updateDashboard());
        }

        const cashPeriodFilter = document.getElementById('cashbookPeriodFilter');
        if (cashPeriodFilter) {
            cashPeriodFilter.addEventListener('change', () => this.renderCashbook());
        }

        const cashAccountFilter = document.getElementById('cashbookAccountFilter');
        if (cashAccountFilter) {
            cashAccountFilter.addEventListener('change', () => this.renderCashbook());
        }

        // Neutralino events
        Neutralino.events.on("windowClose", () => Neutralino.app.exit());
    },

    switchSection(id) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        
        document.getElementById(id).classList.add('active');
        const navItem = document.querySelector(`[data-section="${id}"]`);
        if (navItem) navItem.classList.add('active');

        if (id === 'dashboard' && this.chart) {
            this.chart.update();
            this.updateDashboard();
        }
        if (id === 'accounts') {
            this.renderAccountsSection();
        }
        if (id === 'periods') {
            this.renderPeriodsSection();
        }
        if (id === 'cashbook') {
            this.renderCashbook();
        }
    },

    toggleModal(id, show) {
        document.getElementById(id).classList.toggle('active', show);
    },

    getCurrentAccount() {
        return this.data.accounts[this.data.currentAccount];
    },

    async addIncome() {
        const account = this.getCurrentAccount();
        const income = {
            id: Date.now(),
            value: parseFloat(document.getElementById('incomeValue').value),
            type: document.getElementById('incomeType').value,
            member: document.getElementById('incomeMember').value,
            date: new Date().toISOString()
        };

        account.incomes.push(income);
        await StorageManager.save(this.data);
        this.updateUI();
        document.getElementById('incomeForm').reset();
    },

    async addExpense() {
        const account = this.getCurrentAccount();
        const expense = {
            id: Date.now(),
            value: parseFloat(document.getElementById('expenseValue').value),
            type: document.getElementById('expenseType').value,
            location: document.getElementById('expenseLocation').value,
            member: document.getElementById('expenseMember').value,
            category: document.getElementById('expenseCategory').value,
            date: new Date().toISOString()
        };

        account.expenses.push(expense);
        await StorageManager.save(this.data);
        this.updateUI();
        document.getElementById('expenseForm').reset();
    },

    async addInvestment() {
        const account = this.getCurrentAccount();
        const investment = {
            id: Date.now(),
            value: parseFloat(document.getElementById('investmentValue').value),
            type: document.getElementById('investmentType').value,
            member: document.getElementById('investmentMember').value,
            date: new Date().toISOString()
        };

        account.investments.push(investment);
        await StorageManager.save(this.data);
        this.updateUI();
        document.getElementById('investmentForm').reset();
    },

    async deleteItem(type, id) {
        const account = this.getCurrentAccount();
        if (type === 'income') {
            account.incomes = account.incomes.filter(i => i.id !== id);
        } else if (type === 'expense') {
            account.expenses = account.expenses.filter(e => e.id !== id);
        } else if (type === 'investment') {
            account.investments = account.investments.filter(inv => inv.id !== id);
        }
        await StorageManager.save(this.data);
        this.updateUI();
    },

    updateUI() {
        // Get current account for display
        const account = this.getCurrentAccount();
        
        // Calculate global totals (across all accounts for the rule)
        let globalTotalIncome = 0;
        let globalTotalExpense = 0;
        let globalTotalInvestment = 0;
        
        for (const acc of Object.values(this.data.accounts)) {
            globalTotalIncome += acc.incomes.reduce((acc, curr) => acc + curr.value, 0);
            globalTotalExpense += acc.expenses.reduce((acc, curr) => acc + curr.value, 0);
            globalTotalInvestment += acc.investments.reduce((acc, curr) => acc + curr.value, 0);
        }
        
        // Calculate account-specific totals for display
        const totalIncome = account.incomes.reduce((acc, curr) => acc + curr.value, 0);
        const totalExpense = account.expenses.reduce((acc, curr) => acc + curr.value, 0);
        const totalInvestment = account.investments.reduce((acc, curr) => acc + curr.value, 0);
        const balance = totalIncome - totalExpense - totalInvestment;

        // Update cards (display current account totals)
        document.getElementById('totalIncome').textContent = this.formatCurrency(totalIncome);
        document.getElementById('totalExpense').textContent = this.formatCurrency(totalExpense);
        document.getElementById('totalInvestment').textContent = this.formatCurrency(totalInvestment);
        document.getElementById('totalBalance').textContent = this.formatCurrency(balance);
        document.getElementById('totalBalance').style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';

        // Update Section Totals
        document.getElementById('sectionTotalIncome').textContent = this.formatCurrency(totalIncome);
        document.getElementById('sectionTotalExpense').textContent = this.formatCurrency(totalExpense);
        document.getElementById('sectionTotalInvestment').textContent = this.formatCurrency(totalInvestment);

        // Update 50-15-35 Rule (GLOBAL - using all accounts)
        this.updateRule(globalTotalIncome, globalTotalInvestment);

        // Update Tables
        this.renderTables();
        
        // Update Chart
        this.updateChart();
    },

    updateRule(totalIncome, currentInvestments) {
        // Calculate essentials and lifestyle from ALL accounts
        let essentials = 0;
        let lifestyle = 0;
        
        for (const account of Object.values(this.data.accounts)) {
            essentials += account.expenses
                .filter(e => e.category === 'essentials')
                .reduce((acc, curr) => acc + curr.value, 0);
            lifestyle += account.expenses
                .filter(e => e.category === 'lifestyle')
                .reduce((acc, curr) => acc + curr.value, 0);
        }

        const updateBar = (id, percentId, value, targetPercent) => {
            const quotaValue = totalIncome * (targetPercent / 100);
            const progressPercent = quotaValue > 0 ? (value / quotaValue) * 100 : 0;
            const bar = document.getElementById(id);
            const label = document.getElementById(percentId);
            
            bar.style.width = `${Math.min(progressPercent, 100)}%`;
            label.textContent = `${progressPercent.toFixed(1)}%`;
            
            if (progressPercent > 100) {
                bar.style.backgroundColor = 'var(--danger)';
            } else {
                bar.style.backgroundColor = ''; 
            }
        };

        updateBar('essentialsBar', 'essentialsPercent', essentials, 50);
        updateBar('prioritiesBar', 'prioritiesPercent', currentInvestments, 15);
        updateBar('lifestyleBar', 'lifestylePercent', lifestyle, 35);
    },

    calculateCategoryTotal(category) {
        const account = this.getCurrentAccount();
        return account.expenses
            .filter(e => e.category === category)
            .reduce((acc, curr) => acc + curr.value, 0);
    },

    renderTables() {
        const account = this.getCurrentAccount();
        
        const incomeBody = document.querySelector('#incomeTable tbody');
        incomeBody.innerHTML = account.incomes.map(i => `
            <tr>
                <td>${i.member}</td>
                <td>${i.type}</td>
                <td>${this.formatCurrency(i.value)}</td>
                <td>${new Date(i.date).toLocaleDateString('pt-br')}</td>
                <td><button class="action-btn" onclick="App.deleteItem('income', ${i.id})"><i class="ph ph-trash"></i></button></td>
            </tr>
        `).join('');

        const expenseBody = document.querySelector('#expenseTable tbody');
        expenseBody.innerHTML = account.expenses.map(e => `
            <tr>
                <td>${e.member}</td>
                <td>${e.type} @ ${e.location}</td>
                <td>${this.translateCategory(e.category)}</td>
                <td>${this.formatCurrency(e.value)}</td>
                <td>${new Date(e.date).toLocaleDateString('pt-br')}</td>
                <td><button class="action-btn" onclick="App.deleteItem('expense', ${e.id})"><i class="ph ph-trash"></i></button></td>
            </tr>
        `).join('');

        const investmentBody = document.querySelector('#investmentTable tbody');
        investmentBody.innerHTML = account.investments.map(inv => `
            <tr>
                <td>${inv.member}</td>
                <td>${inv.type}</td>
                <td>${this.formatCurrency(inv.value)}</td>
                <td>${new Date(inv.date).toLocaleDateString('pt-br')}</td>
                <td><button class="action-btn" onclick="App.deleteItem('investment', ${inv.id})"><i class="ph ph-trash"></i></button></td>
            </tr>
        `).join('');
    },

    initChart() {
        if (this.chart) {
            this.chart.destroy();
        }
        const canvas = document.getElementById('mainChart');
        const ctx = canvas.getContext('2d');
        
        this.chart = new Chart(ctx, {
            type: 'line',
            data: {
                labels: [],
                datasets: [
                    {
                        label: 'Receitas',
                        data: [],
                        borderColor: '#6366f1',
                        backgroundColor: 'rgba(99, 102, 241, 0.1)',
                        fill: true,
                        tension: 0.4
                    },
                    {
                        label: 'Saídas (Exp+Inv)',
                        data: [],
                        borderColor: '#ef4444',
                        backgroundColor: 'rgba(239, 68, 68, 0.1)',
                        fill: true,
                        tension: 0.4
                    }
                ]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                resizeDelay: 200,
                plugins: {
                    legend: {
                        labels: { color: '#94a3b8' }
                    }
                },
                scales: {
                    y: {
                        beginAtZero: true,
                        grid: { color: 'rgba(255, 255, 255, 0.05)' },
                        ticks: { color: '#94a3b8' }
                    },
                    x: {
                        grid: { display: false },
                        ticks: { color: '#94a3b8' }
                    }
                }
            }
        });
    },

    updateChart() {
        if (!this.chart) return;

        const account = this.getCurrentAccount();
        const months = [];
        const incomeData = [];
        const expenseData = [];

        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthLabel = d.toLocaleString('pt-br', { month: 'short' });
            months.push(monthLabel);

            const m = d.getMonth();
            const y = d.getFullYear();

            const entries = account.entries || [];

            const sumIncome = entries
                .filter(item => {
                    const itemDate = new Date(item.date);
                    return item.type === 'income' && itemDate.getMonth() === m && itemDate.getFullYear() === y;
                })
                .reduce((acc, curr) => acc + curr.value, 0);

            const sumExpense = entries
                .filter(item => {
                    const itemDate = new Date(item.date);
                    return item.type === 'expense' && itemDate.getMonth() === m && itemDate.getFullYear() === y;
                })
                .reduce((acc, curr) => acc + curr.value, 0);

            const sumInvestment = (account.investments || [])
                .filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate.getMonth() === m && itemDate.getFullYear() === y;
                })
                .reduce((acc, curr) => acc + curr.value, 0);

            incomeData.push(sumIncome);
            expenseData.push(sumExpense + sumInvestment);
        }

        this.chart.data.labels = months;
        this.chart.data.datasets[0].data = incomeData;
        this.chart.data.datasets[1].data = expenseData;
        this.chart.update();
    },

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value);
    },

    translateCategory(cat) {
        const maps = {
            'essentials': 'Essencial',
            'lifestyle': 'Estilo de Vida'
        };
        return maps[cat] || cat;
    },

    hideSplashScreen() {
        const splash = document.getElementById('splash-screen');
        if (splash) {
            setTimeout(() => {
                splash.classList.add('fade-out');
                // Remove from DOM after transition
                setTimeout(() => {
                    splash.remove();
                }, 800);
            }, 2000); // Show splash for at least 2 seconds
        }
    },

    // Period Management Methods
    getCurrentPeriod() {
        return this.data.periods.find(p => p.id === this.data.currentPeriod);
    },

    async openPeriod(name, startDate) {
        // Close current period if open
        const current = this.getCurrentPeriod();
        if (current && current.isOpen) {
            current.isOpen = false;
            current.endDate = new Date().toISOString().split('T')[0];
        }

        // Create new period
        const newPeriod = {
            id: `period_${Date.now()}`,
            name: name,
            startDate: startDate,
            endDate: null,
            isOpen: true,
            createdAt: new Date().toISOString()
        };

        this.data.periods.push(newPeriod);
        this.data.currentPeriod = newPeriod.id;

        await StorageManager.save(this.data);
        this.updateUI();
    },

    async closePeriod() {
        const current = this.getCurrentPeriod();
        if (current) {
            current.isOpen = false;
            current.endDate = new Date().toISOString().split('T')[0];
            this.data.currentPeriod = null;
            await StorageManager.save(this.data);
            this.updateUI();
        }
    },

    getPeriodTransactions() {
        const period = this.getCurrentPeriod();
        if (!period) return null;

        const account = this.getCurrentAccount();
        const startDate = new Date(period.startDate);
        const endDate = period.endDate ? new Date(period.endDate) : new Date();

        const filterByPeriod = (item) => {
            const itemDate = new Date(item.date);
            return itemDate >= startDate && itemDate <= endDate;
        };

        return {
            incomes: account.incomes.filter(filterByPeriod),
            expenses: account.expenses.filter(filterByPeriod),
            investments: account.investments.filter(filterByPeriod)
        };
    },

    // Account Management Methods
    async addAccount(name, icon = 'ph-bank', color = 'indigo') {
        const accountId = `account_${Date.now()}`;
        this.data.accounts[accountId] = {
            id: accountId,
            name,
            icon,
            color,
            isActive: true,
            incomes: [],
            expenses: [],
            investments: []
        };
        await StorageManager.save(this.data);
        return accountId;
    },

    async deleteAccount(accountId) {
        if (accountId === 'default') return;
        delete this.data.accounts[accountId];
        if (this.data.currentAccount === accountId) {
            this.data.currentAccount = Object.keys(this.data.accounts)[0] || 'default';
        }
        await StorageManager.save(this.data);
        this.updateUI();
    },

    async switchAccount(accountId) {
        if (this.data.accounts[accountId]) {
            this.data.currentAccount = accountId;
            await StorageManager.save(this.data);
            this.updateUI();
        }
    },

    getAccounts() {
        return Object.values(this.data.accounts);
    },

    calculateAccountBalance(accountId) {
        const account = this.data.accounts[accountId];
        if (!account) return 0;
        const entries = account.entries || [];
        const income     = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
        const expense    = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.value, 0);
        const investment = (account.investments || []).reduce((s, inv) => s + inv.value, 0);
        return income - expense - investment;
    },

    // ─── Account UI ────────────────────────────────────────────────────────

    renderAccountsSection() {
        const accounts = this.getAccounts();
        const grid  = document.getElementById('accountsGrid');
        const empty = document.getElementById('emptyAccountsState');
        if (!grid) return;

        if (accounts.length === 0) {
            grid.style.display = 'none';
            empty.style.display = 'flex';
        } else {
            grid.style.display = 'grid';
            empty.style.display = 'none';
            grid.innerHTML = accounts.map(a => this.buildAccountCard(a)).join('');
        }
        this.updateAccountsSummary();
    },

    buildAccountCard(account) {
        const balance  = this.calculateAccountBalance(account.id);
        const entries  = account.entries || [];
        const income   = entries.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
        const expense  = entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.value, 0);
        const color    = account.color || 'indigo';
        const isActive = account.isActive !== false;
        const balanceClass   = balance > 0 ? 'positive' : balance < 0 ? 'negative' : 'zero';
        const inactiveClass  = isActive ? '' : ' account-inactive';
        const badgeClass     = isActive ? 'badge-active'   : 'badge-inactive';
        const badgeText      = isActive ? '<i class="ph ph-check-circle"></i> Ativa' : '<i class="ph ph-pause-circle"></i> Inativa';
        const toggleClass    = isActive ? 'btn-toggle-active' : 'btn-toggle-inactive';
        const toggleIcon     = isActive ? 'ph-eye-slash' : 'ph-eye';
        const toggleLabel    = isActive ? 'Desativar' : 'Ativar';
        const totalEntries   = entries.length + (account.investments?.length || 0);

        return `<div class="account-card glass${inactiveClass}">
            <div class="account-accent accent-${color}"></div>
            <div class="account-card-header">
                <div class="account-card-icon icon-${color}">
                    <i class="ph ${account.icon || 'ph-bank'}"></i>
                </div>
                <div class="account-card-name">
                    <h3>${account.name}</h3>
                    <span class="account-badge ${badgeClass}">${badgeText}</span>
                </div>
            </div>
            <div class="account-card-balance">
                <span class="account-card-balance-label">Saldo atual</span>
                <span class="account-card-balance-value ${balanceClass}">${this.formatCurrency(balance)}</span>
            </div>
            <div class="account-card-stats">
                <div class="account-stat">
                    <span class="account-stat-label">Receitas</span>
                    <span class="account-stat-value income-color">${this.formatCurrency(income)}</span>
                </div>
                <div class="account-stat">
                    <span class="account-stat-label">Despesas</span>
                    <span class="account-stat-value expense-color">${this.formatCurrency(expense)}</span>
                </div>
                <div class="account-stat">
                    <span class="account-stat-label">Lançamentos</span>
                    <span class="account-stat-value">${totalEntries}</span>
                </div>
            </div>
            <div class="account-card-actions">
                <button class="account-action-btn ${toggleClass}" onclick="App.toggleAccountActive('${account.id}')">
                    <i class="ph ${toggleIcon}"></i> ${toggleLabel}
                </button>
                <button class="account-action-btn btn-edit" onclick="App.openEditAccountModal('${account.id}')">
                    <i class="ph ph-pencil"></i> Editar
                </button>
                <button class="account-action-btn btn-delete" onclick="App.promptDeleteAccount('${account.id}')">
                    <i class="ph ph-trash"></i>
                </button>
            </div>
        </div>`;
    },

    updateAccountsSummary() {
        let activeBalance = 0, inactiveBalance = 0, activeCount = 0;
        for (const account of this.getAccounts()) {
            const bal = this.calculateAccountBalance(account.id);
            if (account.isActive !== false) { activeBalance += bal; activeCount++; }
            else { inactiveBalance += bal; }
        }
        const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
        set('globalActiveBalance',   this.formatCurrency(activeBalance));
        set('globalInactiveBalance', this.formatCurrency(inactiveBalance));
        set('totalActiveBalance',    this.formatCurrency(activeBalance));
        set('activeAccountsCount',   activeCount);
        set('totalAccountsCount',    this.getAccounts().length);
    },

    openAddAccountModal() {
        document.getElementById('accountModalTitle').textContent = 'Nova Conta Bancária';
        document.getElementById('accountForm').reset();
        document.getElementById('accountInitialBalance').value = '0';
        document.getElementById('accountInitialBalance').disabled = false;
        document.getElementById('accountForm').dataset.editId = '';
        this.toggleModal('accountModal', true);
    },

    openEditAccountModal(accountId) {
        const account = this.data.accounts[accountId];
        if (!account) return;
        document.getElementById('accountModalTitle').textContent = `Editar: ${account.name}`;
        document.getElementById('accountName').value = account.name;
        document.getElementById('accountIcon').value = account.icon || 'ph-bank';
        document.getElementById('accountColor').value = account.color || 'indigo';
        document.getElementById('accountInitialBalance').value = '0';
        document.getElementById('accountInitialBalance').disabled = true;
        document.getElementById('accountForm').dataset.editId = accountId;
        this.toggleModal('accountModal', true);
    },

    async saveAccountFromForm() {
        const name   = document.getElementById('accountName').value.trim();
        const icon   = document.getElementById('accountIcon').value;
        const color  = document.getElementById('accountColor').value;
        const editId = document.getElementById('accountForm').dataset.editId;
        if (!name) return;

        if (editId) {
            const account = this.data.accounts[editId];
            if (account) { account.name = name; account.icon = icon; account.color = color; }
        } else {
            const initialBalance = parseFloat(document.getElementById('accountInitialBalance').value) || 0;
            const accountId = `account_${Date.now()}`;
            this.data.accounts[accountId] = {
                id: accountId, name, icon, color, isActive: true,
                entries: [], investments: []
            };
            if (initialBalance > 0) {
                this.data.accounts[accountId].entries.push({
                    id: Date.now() + 1,
                    type: 'income',
                    value: initialBalance,
                    description: 'Saldo Inicial',
                    category: 'other',
                    notes: 'Saldo inicial da conta',
                    periodId: this.data.currentPeriod || 'current',
                    date: new Date().toISOString().split('T')[0],
                    createdAt: new Date().toISOString()
                });
            }
        }

        document.getElementById('accountInitialBalance').disabled = false;
        await StorageManager.save(this.data);
        this.toggleModal('accountModal', false);
        this.renderAccountsSection();
    },

    async toggleAccountActive(accountId) {
        const account = this.data.accounts[accountId];
        if (!account) return;
        account.isActive = account.isActive === false;
        await StorageManager.save(this.data);
        this.renderAccountsSection();
    },

    promptDeleteAccount(accountId) {
        const account = this.data.accounts[accountId];
        if (!account) return;
        const msg = document.getElementById('deleteAccountMessage');
        const confirmBtn = document.getElementById('confirmDeleteAccountBtn');

        if (accountId === 'default') {
            msg.textContent = 'A conta "Principal" não pode ser deletada pois é a conta padrão do sistema.';
            confirmBtn.style.display = 'none';
        } else {
            const total = (account.entries?.length || 0) + (account.investments?.length || 0);
            msg.textContent = `Deseja deletar a conta "${account.name}"?${total > 0 ? ` Ela possui ${total} lançamento(s) que serão perdidos.` : ''} Esta ação não pode ser desfeita.`;
            confirmBtn.style.display = '';
            confirmBtn.onclick = async () => {
                await this.deleteAccount(accountId);
                this.toggleModal('deleteAccountModal', false);
                this.renderAccountsSection();
            };
        }
        this.toggleModal('deleteAccountModal', true);
    },

    // ─── Dashboard Filters ────────────────────────────────────────────────────────
    updateDashboard() {
        const filterValue = document.getElementById('dashboardAccountFilter')?.value;
        let accounts = [];

        if (filterValue === 'all') {
            accounts = this.getAccounts();
        } else {
            const account = this.data.accounts[filterValue];
            if (account) accounts = [account];
        }

        // Calculate totals
        let totalIncome = 0, totalExpense = 0, totalInvestment = 0;
        for (const account of accounts) {
            if (account.entries) {
                totalIncome += account.entries.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
                totalExpense += account.entries.filter(e => e.type === 'expense').reduce((s, e) => s + e.value, 0);
            }
            if (account.investments) {
                totalInvestment += account.investments.reduce((s, i) => s + i.value, 0);
            }
        }

        const balance = totalIncome - totalExpense - totalInvestment;

        // Update UI
        this.setText('totalIncome', this.formatCurrency(totalIncome));
        this.setText('totalExpense', this.formatCurrency(totalExpense));
        this.setText('totalInvestment', this.formatCurrency(totalInvestment));
        this.setText('totalBalance', this.formatCurrency(balance));

        // Update chart if needed
        if (this.chart) this.updateChart();
    },

    // ─── Periods Management ────────────────────────────────────────────────────────
    renderPeriodsSection() {
        const grid = document.getElementById('periodsGrid');
        const empty = document.getElementById('emptyPeriodsState');
        const currentAlert = document.getElementById('currentPeriodAlert');
        const currentNameEl = document.getElementById('currentPeriodName');

        if (!grid) return;

        const periods = this.data.periods || [];
        const currentPeriod = this.getCurrentPeriod();

        if (currentNameEl) {
            currentNameEl.textContent = currentPeriod?.name || '-';
        }

        if (currentAlert && currentPeriod) {
            currentAlert.style.display = currentPeriod.isOpen ? 'flex' : 'none';
            const alertName = document.getElementById('alertPeriodName');
            const alertDates = document.getElementById('alertPeriodDates');
            if (alertName) alertName.textContent = currentPeriod.name;
            if (alertDates) {
                const start = new Date(currentPeriod.startDate).toLocaleDateString('pt-br');
                const end = currentPeriod.endDate ? new Date(currentPeriod.endDate).toLocaleDateString('pt-br') : 'Em aberto';
                alertDates.textContent = `${start} - ${end}`;
            }
        }

        if (periods.length === 0) {
            grid.style.display = 'none';
            if (empty) empty.style.display = 'flex';
        } else {
            grid.style.display = 'grid';
            if (empty) empty.style.display = 'none';
            grid.innerHTML = periods.map(p => this.buildPeriodCard(p)).join('');
        }
    },

    buildPeriodCard(period) {
        const isOpen = period.isOpen;
        const badgeClass = isOpen ? 'badge-period-open' : 'badge-period-closed';
        const badgeText = isOpen ? '<i class="ph ph-lock-open"></i> Aberto' : '<i class="ph ph-lock"></i> Encerrado';
        const cardClass = isOpen ? 'period-open' : 'period-closed';

        const startDate = new Date(period.startDate).toLocaleDateString('pt-br');
        const endDate = period.endDate ? new Date(period.endDate).toLocaleDateString('pt-br') : 'Em aberto';

        // Count entries in this period
        let entriesCount = 0;
        let incomeTotal = 0;
        let expenseTotal = 0;

        for (const account of this.getAccounts()) {
            if (account.entries) {
                const periodEntries = account.entries.filter(e => e.periodId === period.id);
                entriesCount += periodEntries.length;
                incomeTotal += periodEntries.filter(e => e.type === 'income').reduce((s, e) => s + e.value, 0);
                expenseTotal += periodEntries.filter(e => e.type === 'expense').reduce((s, e) => s + e.value, 0);
            }
        }

        const balance = incomeTotal - expenseTotal;

        return `<div class="period-card glass ${cardClass}">
            <div class="period-card-header">
                <div class="period-card-title">
                    <h3>${period.name}</h3>
                    <span class="period-badge ${badgeClass}">${badgeText}</span>
                </div>
            </div>
            <div class="period-card-dates">
                <i class="ph ph-calendar"></i> ${startDate} - ${endDate}
            </div>
            ${period.description ? `<div class="period-card-description">${period.description}</div>` : '<div class="period-card-description">Sem descrição</div>'}
            <div class="period-card-stats">
                <div class="period-stat">
                    <span class="period-stat-label">Lançamentos</span>
                    <span class="period-stat-value">${entriesCount}</span>
                </div>
                <div class="period-stat">
                    <span class="period-stat-label">Saldo</span>
                    <span class="period-stat-value">${this.formatCurrency(balance)}</span>
                </div>
            </div>
            <div class="period-card-actions">
                ${!isOpen ? `<button class="btn-secondary btn-sm" onclick="App.promptDeletePeriod('${period.id}')">
                    <i class="ph ph-trash"></i> Deletar
                </button>` : ''}
            </div>
        </div>`;
    },

    openAddPeriodModal() {
        document.getElementById('periodModalTitle').textContent = 'Novo Período';
        document.getElementById('periodForm').reset();
        document.getElementById('periodStartDate').value = new Date().toISOString().split('T')[0];
        this.toggleModal('periodModal', true);
    },

    async savePeriodFromForm() {
        const name = document.getElementById('periodName').value.trim();
        const description = document.getElementById('periodDescription').value.trim();
        const startDate = document.getElementById('periodStartDate').value;

        if (!name || !startDate) return;

        // Close current period if open
        const current = this.getCurrentPeriod();
        if (current && current.isOpen) {
            current.isOpen = false;
            current.endDate = new Date().toISOString().split('T')[0];
        }

        // Create new period
        const newPeriod = {
            id: `period_${Date.now()}`,
            name,
            description,
            startDate,
            endDate: null,
            isOpen: true,
            closeDescription: '',
            createdAt: new Date().toISOString()
        };

        this.data.periods.push(newPeriod);
        this.data.currentPeriod = newPeriod.id;

        await StorageManager.save(this.data);
        this.toggleModal('periodModal', false);
        this.renderPeriodsSection();
    },

    openClosePeriodModal() {
        const current = this.getCurrentPeriod();
        if (!current || !current.isOpen) return;

        document.getElementById('closePeriodDate').value = new Date().toISOString().split('T')[0];
        document.getElementById('closePeriodDescription').value = '';
        this.toggleModal('closePeriodModal', true);
    },

    async closeCurrentPeriod() {
        const current = this.getCurrentPeriod();
        if (!current) return;

        const endDate = document.getElementById('closePeriodDate').value;
        const closeDescription = document.getElementById('closePeriodDescription').value.trim();

        current.isOpen = false;
        current.endDate = endDate;
        current.closeDescription = closeDescription;

        await StorageManager.save(this.data);
        this.toggleModal('closePeriodModal', false);
        this.renderPeriodsSection();
    },

    promptDeletePeriod(periodId) {
        const period = this.data.periods.find(p => p.id === periodId);
        if (!period) return;

        // Count entries that will be deleted
        let entriesCount = 0;
        for (const account of this.getAccounts()) {
            if (account.entries) {
                entriesCount += account.entries.filter(e => e.periodId === periodId).length;
            }
        }

        const msg = document.getElementById('deletePeriodMessage');
        if (msg) {
            msg.innerHTML = `<strong>ATENÇÃO:</strong> Ao deletar o período "${period.name}", todos os ${entriesCount} registro(s) de entrada e saída serão apagados permanentemente. Esta ação não pode ser desfeita.`;
        }

        const confirmBtn = document.getElementById('confirmDeletePeriodBtn');
        if (confirmBtn) {
            confirmBtn.onclick = async () => {
                await this.deletePeriod(periodId);
            };
        }

        this.toggleModal('deletePeriodModal', true);
    },

    async deletePeriod(periodId) {
        // Remove period
        this.data.periods = this.data.periods.filter(p => p.id !== periodId);

        // Remove all entries from this period
        for (const account of this.getAccounts()) {
            if (account.entries) {
                account.entries = account.entries.filter(e => e.periodId !== periodId);
            }
        }

        // Update current period if deleted
        if (this.data.currentPeriod === periodId) {
            const openPeriod = this.data.periods.find(p => p.isOpen);
            this.data.currentPeriod = openPeriod?.id || null;
        }

        await StorageManager.save(this.data);
        this.toggleModal('deletePeriodModal', false);
        this.renderPeriodsSection();
    },

    // ─── Cashbook (Livro Caixa) ────────────────────────────────────────────────────────
    renderCashbook() {
        const periodFilter = document.getElementById('cashbookPeriodFilter')?.value || 'current';
        const accountFilter = document.getElementById('cashbookAccountFilter')?.value || 'all';

        // Get accounts to display
        let accounts = [];
        if (accountFilter === 'all') {
            accounts = this.getAccounts();
        } else {
            const account = this.data.accounts[accountFilter];
            if (account) accounts = [account];
        }

        // Get entries from selected period
        let entries = [];
        for (const account of accounts) {
            if (account.entries) {
                const accountEntries = account.entries
                    .filter(e => e.periodId === periodFilter)
                    .map(e => ({...e, accountId: account.id, accountName: account.name}));
                entries.push(...accountEntries);
            }
        }

        // Sort by date (oldest first)
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));

        // Calculate totals and running balance
        let totalIncome = 0;
        let totalExpense = 0;
        let runningBalance = 0;

        const tbody = document.querySelector('#cashbookTable tbody');
        if (!tbody) return;

        if (entries.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" style="text-align: center; padding: 2rem; color: var(--text-secondary);">Nenhum registro encontrado</td></tr>';
        } else {
            tbody.innerHTML = entries.map(entry => {
                const date = new Date(entry.date).toLocaleDateString('pt-br');
                const isIncome = entry.type === 'income';
                const value = entry.value;

                if (isIncome) {
                    totalIncome += value;
                    runningBalance += value;
                } else {
                    totalExpense += value;
                    runningBalance -= value;
                }

                const balanceClass = runningBalance >= 0 ? 'positive' : 'negative';

                return `<tr>
                    <td>${date}</td>
                    <td>${entry.accountName}</td>
                    <td>${isIncome ? '<span class="badge" style="background: rgba(16,185,129,0.15); color: var(--success);">Entrada</span>' : '<span class="badge" style="background: rgba(239,68,68,0.15); color: var(--danger);">Saída</span>'}</td>
                    <td>${entry.description}</td>
                    <td class="income-value">${isIncome ? this.formatCurrency(value) : '-'}</td>
                    <td class="expense-value">${!isIncome ? this.formatCurrency(value) : '-'}</td>
                    <td class="balance-value ${balanceClass}">${this.formatCurrency(runningBalance)}</td>
                    <td>
                        <button class="icon-btn" onclick="App.deleteCashbookEntry('${entry.accountId}', '${entry.id}')">
                            <i class="ph ph-trash"></i>
                        </button>
                    </td>
                </tr>`;
            }).join('');
        }

        // Update summary
        const balance = totalIncome - totalExpense;
        this.setText('cashbookTotalIncome', this.formatCurrency(totalIncome));
        this.setText('cashbookTotalExpense', this.formatCurrency(totalExpense));
        this.setText('cashbookBalance', this.formatCurrency(balance));

        // Populate filter selects
        this.populateCashbookFilters();
    },

    populateCashbookFilters() {
        // Populate period filter
        const periodFilter = document.getElementById('cashbookPeriodFilter');
        if (periodFilter) {
            const currentValue = periodFilter.value;
            periodFilter.innerHTML = this.data.periods.map(p => 
                `<option value="${p.id}">${p.name}</option>`
            ).join('');
            if (currentValue) periodFilter.value = currentValue;
            else periodFilter.value = this.data.currentPeriod || 'current';
        }

        // Populate account filter
        const accountFilter = document.getElementById('cashbookAccountFilter');
        if (accountFilter) {
            const currentValue = accountFilter.value;
            accountFilter.innerHTML = '<option value="all">Todas as Contas</option>' + 
                this.getAccounts().map(a => 
                    `<option value="${a.id}">${a.name}</option>`
                ).join('');
            if (currentValue) accountFilter.value = currentValue;
        }
    },

    openAddCashbookModal() {
        document.getElementById('cashbookModalTitle').textContent = 'Novo Registro';
        document.getElementById('cashbookForm').reset();
        document.getElementById('cashbookDate').value = new Date().toISOString().split('T')[0];
        this.populateCashbookSelects();
        this.toggleModal('cashbookModal', true);
    },

    populateCashbookSelects() {
        // Populate period select (only open periods)
        const periodSelect = document.getElementById('cashbookPeriod');
        if (periodSelect) {
            const openPeriods = this.data.periods.filter(p => p.isOpen);
            periodSelect.innerHTML = openPeriods.length === 0 
                ? '<option value="">Nenhum período aberto</option>'
                : openPeriods.map(p => `<option value="${p.id}">${p.name}</option>`).join('');
            
            if (this.data.currentPeriod) {
                periodSelect.value = this.data.currentPeriod;
            }
        }

        // Populate account select
        const accountSelect = document.getElementById('cashbookAccount');
        if (accountSelect) {
            const activeAccounts = this.getAccounts().filter(a => a.isActive !== false);
            accountSelect.innerHTML = activeAccounts.map(a => 
                `<option value="${a.id}">${a.name}</option>`
            ).join('');
        }

        // Populate dashboard account filter
        const dashFilter = document.getElementById('dashboardAccountFilter');
        if (dashFilter) {
            const currentValue = dashFilter.value;
            dashFilter.innerHTML = '<option value="all">Todas as Contas</option>' + 
                this.getAccounts().map(a => 
                    `<option value="${a.id}">${a.name}</option>`
                ).join('');
            if (currentValue) dashFilter.value = currentValue;
        }
    },

    async saveCashbookEntry() {
        const type = document.getElementById('cashbookType').value;
        const value = parseFloat(document.getElementById('cashbookValue').value);
        const periodId = document.getElementById('cashbookPeriod').value;
        const accountId = document.getElementById('cashbookAccount').value;
        const date = document.getElementById('cashbookDate').value;
        const description = document.getElementById('cashbookDescription').value.trim();
        const category = document.getElementById('cashbookCategory').value;
        const notes = document.getElementById('cashbookNotes').value.trim();

        if (!type || !value || !periodId || !accountId || !date || !description) {
            alert('Preencha todos os campos obrigatórios');
            return;
        }

        // Check if period is open
        const period = this.data.periods.find(p => p.id === periodId);
        if (!period || !period.isOpen) {
            alert('O período selecionado está encerrado e não pode receber novos registros');
            return;
        }

        const account = this.data.accounts[accountId];
        if (!account) return;

        if (!account.entries) account.entries = [];

        const entry = {
            id: Date.now(),
            type,
            value,
            description,
            category,
            notes,
            periodId,
            date,
            createdAt: new Date().toISOString()
        };

        account.entries.push(entry);

        await StorageManager.save(this.data);
        this.toggleModal('cashbookModal', false);
        this.renderCashbook();
        this.updateUI();
    },

    async deleteCashbookEntry(accountId, entryId) {
        if (!confirm('Deseja deletar este registro?')) return;

        const account = this.data.accounts[accountId];
        if (!account || !account.entries) return;

        account.entries = account.entries.filter(e => e.id != entryId);

        await StorageManager.save(this.data);
        this.renderCashbook();
        this.updateUI();
    }
};

// Initialize app
Neutralino.init();
App.init();
