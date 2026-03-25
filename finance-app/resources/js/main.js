/**
 * Storage Manager - Handles data persistence using Neutralino Storage API
 */
const StorageManager = {
    async init() {
        try {
            const data = await this.load();
            if (!data || Object.keys(data).length === 0) {
                const initialData = { incomes: [], expenses: [] };
                await this.save(initialData);
            }
        } catch (err) {
            console.error("Storage initialization error:", err);
        }
    },

    async load() {
        try {
            const content = await Neutralino.storage.getData('finance_data');
            return JSON.parse(content);
        } catch (err) {
            // If key doesn't exist, it might throw or return null
            return { incomes: [], expenses: [] };
        }
    },

    async save(data) {
        try {
            await Neutralino.storage.setData('finance_data', JSON.stringify(data, null, 2));
        } catch (err) {
            console.error("Error saving data:", err);
        }
    }
};

/**
 * Screen Loading Manager - Handles dynamic loading of HTML screens
 */
const ScreenLoadingManager = {
    screens: ['dashboard', 'incomes', 'expenses', 'investments', 'about'],
    
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
                container.appendChild(tempDiv.firstElementChild);
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
    data: { incomes: [], expenses: [] },
    chart: null,

    async init() {
        await ScreenLoadingManager.loadAll();
        await StorageManager.init();
        const storedData = await StorageManager.load();
        this.data = {
            incomes: storedData.incomes || [],
            expenses: storedData.expenses || [],
            investments: storedData.investments || []
        };
        
        this.registerEvents();
        this.initChart();
        this.updateUI();
        
        // Update current date display
        const now = new Date();
        const monthYear = now.toLocaleString('pt-br', { month: 'long', year: 'numeric' });
        document.getElementById('currentDate').textContent = monthYear.charAt(0).toUpperCase() + monthYear.slice(1);

        // Hide splash screen
        this.hideSplashScreen();
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

        // Neutralino events
        Neutralino.events.on("windowClose", () => Neutralino.app.exit());
    },

    switchSection(id) {
        document.querySelectorAll('.content-section').forEach(s => s.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(i => i.classList.remove('active'));
        
        document.getElementById(id).classList.add('active');
        const navItem = document.querySelector(`[data-section="${id}"]`);
        if (navItem) navItem.classList.add('active');

        // Fix: Force chart update/resize when returning to dashboard
        if (id === 'dashboard' && this.chart) {
            this.chart.update();
        }
    },

    toggleModal(id, show) {
        document.getElementById(id).classList.toggle('active', show);
    },

    async addIncome() {
        const income = {
            id: Date.now(),
            value: parseFloat(document.getElementById('incomeValue').value),
            type: document.getElementById('incomeType').value,
            member: document.getElementById('incomeMember').value,
            date: new Date().toISOString()
        };

        this.data.incomes.push(income);
        await StorageManager.save(this.data);
        this.updateUI();
        document.getElementById('incomeForm').reset();
    },

    async addExpense() {
        const expense = {
            id: Date.now(),
            value: parseFloat(document.getElementById('expenseValue').value),
            type: document.getElementById('expenseType').value,
            location: document.getElementById('expenseLocation').value,
            member: document.getElementById('expenseMember').value,
            category: document.getElementById('expenseCategory').value,
            date: new Date().toISOString()
        };

        this.data.expenses.push(expense);
        await StorageManager.save(this.data);
        this.updateUI();
        document.getElementById('expenseForm').reset();
    },

    async addInvestment() {
        const investment = {
            id: Date.now(),
            value: parseFloat(document.getElementById('investmentValue').value),
            type: document.getElementById('investmentType').value,
            member: document.getElementById('investmentMember').value,
            date: new Date().toISOString()
        };

        this.data.investments.push(investment);
        await StorageManager.save(this.data);
        this.updateUI();
        document.getElementById('investmentForm').reset();
    },

    async deleteItem(type, id) {
        if (type === 'income') {
            this.data.incomes = this.data.incomes.filter(i => i.id !== id);
        } else if (type === 'expense') {
            this.data.expenses = this.data.expenses.filter(e => e.id !== id);
        } else if (type === 'investment') {
            this.data.investments = this.data.investments.filter(inv => inv.id !== id);
        }
        await StorageManager.save(this.data);
        this.updateUI();
    },

    updateUI() {
        const totalIncome = this.data.incomes.reduce((acc, curr) => acc + curr.value, 0);
        const totalExpense = this.data.expenses.reduce((acc, curr) => acc + curr.value, 0);
        const totalInvestment = this.data.investments.reduce((acc, curr) => acc + curr.value, 0);
        const balance = totalIncome - totalExpense - totalInvestment;

        // Update cards
        document.getElementById('totalIncome').textContent = this.formatCurrency(totalIncome);
        document.getElementById('totalExpense').textContent = this.formatCurrency(totalExpense);
        document.getElementById('totalInvestment').textContent = this.formatCurrency(totalInvestment);
        document.getElementById('totalBalance').textContent = this.formatCurrency(balance);
        document.getElementById('totalBalance').style.color = balance >= 0 ? 'var(--success)' : 'var(--danger)';

        // Update Section Totals
        document.getElementById('sectionTotalIncome').textContent = this.formatCurrency(totalIncome);
        document.getElementById('sectionTotalExpense').textContent = this.formatCurrency(totalExpense);
        document.getElementById('sectionTotalInvestment').textContent = this.formatCurrency(totalInvestment);

        // Update 50-15-35 Rule
        this.updateRule(totalIncome, totalInvestment);

        // Update Tables
        this.renderTables();
        
        // Update Chart
        this.updateChart();
    },

    updateRule(totalIncome, currentInvestments) {
        const expensesByCategory = {
            essentials: this.calculateCategoryTotal('essentials'),
            lifestyle: this.calculateCategoryTotal('lifestyle'),
            investments: currentInvestments
        };

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

        updateBar('essentialsBar', 'essentialsPercent', expensesByCategory.essentials, 50);
        updateBar('prioritiesBar', 'prioritiesPercent', expensesByCategory.investments, 15);
        updateBar('lifestyleBar', 'lifestylePercent', expensesByCategory.lifestyle, 35);
    },

    calculateCategoryTotal(category) {
        return this.data.expenses
            .filter(e => e.category === category)
            .reduce((acc, curr) => acc + curr.value, 0);
    },

    renderTables() {
        const incomeBody = document.querySelector('#incomeTable tbody');
        incomeBody.innerHTML = this.data.incomes.map(i => `
            <tr>
                <td>${i.member}</td>
                <td>${i.type}</td>
                <td>${this.formatCurrency(i.value)}</td>
                <td>${new Date(i.date).toLocaleDateString('pt-br')}</td>
                <td><button class="action-btn" onclick="App.deleteItem('income', ${i.id})"><i class="ph ph-trash"></i></button></td>
            </tr>
        `).join('');

        const expenseBody = document.querySelector('#expenseTable tbody');
        expenseBody.innerHTML = this.data.expenses.map(e => `
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
        investmentBody.innerHTML = this.data.investments.map(inv => `
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

            const sumIncome = this.data.incomes
                .filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate.getMonth() === m && itemDate.getFullYear() === y;
                })
                .reduce((acc, curr) => acc + curr.value, 0);

            const sumExpense = this.data.expenses
                .filter(item => {
                    const itemDate = new Date(item.date);
                    return itemDate.getMonth() === m && itemDate.getFullYear() === y;
                })
                .reduce((acc, curr) => acc + curr.value, 0);

            const sumInvestment = this.data.investments
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
    }
};

// Initialize app
Neutralino.init();
App.init();
