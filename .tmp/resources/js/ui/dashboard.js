/* Dashboard: totais, regra 50-15-35, filtros e gráfico. */
const DashboardScreen = {
    chart: null,

    // Inicialização dos botões e gráficos da tela
    init() {
        // Captura o evento de mudança filtro select
        document.getElementById('dashboardAccountFilter')?.addEventListener('change', () => this.refresh());

        // Carrega o gráfico
        const canvas = document.getElementById('mainChart');
        if (!canvas) return;
        this.chart = new Chart(canvas.getContext('2d'), { type: 'line', data: { labels: [], datasets: [
            { label: 'Receitas', data: [], borderColor: '#6366f1', backgroundColor: 'rgba(99,102,241,.1)', fill: true, tension: .4 },
            { label: 'Saídas (Exp+Inv)', data: [], borderColor: '#ef4444', backgroundColor: 'rgba(239,68,68,.1)', fill: true, tension: .4 }
        ] }, options: { responsive: true, maintainAspectRatio: false } });
    },

    // função que atualiza os dados em tela com base no filtro informado pelo usuário
    refresh() {
        const accounts = this.selectedAccounts();
        const income = accounts.reduce((sum, account) => sum + FinanceCore.incomes(account).reduce((total, item) => total + item.value, 0), 0);
        const expense = accounts.reduce((sum, account) => sum + FinanceCore.expenses(account).reduce((total, item) => total + item.value, 0), 0);
        FinanceCore.setText('totalIncome', FinanceCore.formatCurrency(income));
        FinanceCore.setText('totalExpense', FinanceCore.formatCurrency(expense));
        FinanceCore.setText('sectionTotalIncome', FinanceCore.formatCurrency(income));
        FinanceCore.setText('sectionTotalExpense', FinanceCore.formatCurrency(expense));
        this.renderRule(income, 0);
        this.renderChart(accounts);
        EntriesScreen.renderTables();
    },

    // Recupera os registros de contas cadastradas
    selectedAccounts() {
        const selected = document.getElementById('dashboardAccountFilter')?.value || 'all';
        return selected === 'all' ? FinanceCore.accounts() : [FinanceCore.data.accounts[selected]].filter(Boolean);
    },

    // Renderiza a barra de progresso do sistema 50-15-35
    renderRule(income, investment) {
        const expenses = FinanceCore.accounts().flatMap(account => FinanceCore.expenses(account));
        const values = { essentials: expenses.filter(item => item.category === 'essentials').reduce((sum, item) => sum + item.value, 0), lifestyle: expenses.filter(item => item.category === 'lifestyle').reduce((sum, item) => sum + item.value, 0), investment };
        [['essentials', 50], ['investment', 15], ['lifestyle', 35]].forEach(([key, target]) => {
            const percent = income ? (values[key] / (income * target / 100)) * 100 : 0;
            const bar = document.getElementById(key === 'investment' ? 'prioritiesBar' : `${key}Bar`);
            const label = document.getElementById(key === 'investment' ? 'prioritiesPercent' : `${key}Percent`);
            if (bar) bar.style.width = `${Math.min(percent, 100)}%`;
            if (label) label.textContent = `${percent.toFixed(1)}%`;
        });
    },

    // Renderiza o gráfico da tela
    renderChart(accounts) {
        if (!this.chart) return;
        const labels = [], incomes = [], expenses = [];
        for (let offset = 5; offset >= 0; offset--) {
            const date = new Date(); date.setMonth(date.getMonth() - offset);
            labels.push(date.toLocaleString('pt-BR', { month: 'short' }));
            const month = date.getMonth(), year = date.getFullYear();
            const entries = accounts.flatMap(account => FinanceCore.entries(account));
            incomes.push(entries.filter(item => item.type === 'income' && new Date(item.date).getMonth() === month && new Date(item.date).getFullYear() === year).reduce((sum, item) => sum + item.value, 0));
            expenses.push(entries.filter(item => (item.type === 'expense' || item.type === 'investment') && new Date(item.date).getMonth() === month && new Date(item.date).getFullYear() === year).reduce((sum, item) => sum + item.value, 0));
        }
        this.chart.data.labels = labels; this.chart.data.datasets[0].data = incomes; this.chart.data.datasets[1].data = expenses; this.chart.update();
    }
};
