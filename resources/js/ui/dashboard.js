/**
 * ============================================================================
 * DASHBOARD.JS - MÓDULO DE GESTÃO DO PAINEL PRINCIPAL
 * ============================================================================
 * Gerencia a busca de dados no SQLite via DatabaseManager/FinanceCore,
 * calcula métricas financeiras, regra 50/15/35, atualiza alertas e gráficos.
 */

const DashboardScreen = {
    // Guarda instâncias ativas do Chart.js para destruição/atualização limpa
    charts: {
        main: null,
        incomeVsExpense: null,
        topSubcategories: null,
    },

    /**
     * Inicializa a tela de Dashboard, definindo datas, escutadores e renderizando dados.
     */
    init() {
        this.setDefaultDates();
        this.loadActiveAccountsFilter();
        this.loadCategorySelectFilter();
        this.setupEventListeners();
        this.refresh();
    },

    /**
     * Define o intervalo de busca padrão para os últimos 30 dias.
     */
    setDefaultDates() {
        const endDate = new Date();
        const startDate = new Date();
        startDate.setDate(endDate.getDate() - 30);

        const startInput = document.getElementById("dashStartDate");
        const endInput = document.getElementById("dashEndDate");

        if (startInput && !startInput.value) {
            startInput.value = startDate.toISOString().split("T")[0];
        }
        if (endInput && !endInput.value) {
            endInput.value = endDate.toISOString().split("T")[0];
        }
    },

    /**
     * Popula o combo-box do filtro apenas com contas que estejam ATIVAS.
     */
    loadActiveAccountsFilter() {
        const select = document.getElementById("dashboardAccountFilter");
        if (!select) return;

        try {
            const activeAccounts =
                DatabaseManager.query(
                    "SELECT id, name FROM accounts WHERE is_active = 1 ORDER BY name ASC",
                ) || [];

            select.innerHTML =
                '<option value="all">Todas as Contas (Ativas)</option>';
            activeAccounts.forEach((acc) => {
                const opt = document.createElement("option");
                opt.value = acc.id;
                opt.textContent = acc.name;
                select.appendChild(opt);
            });
        } catch (err) {
            console.error("Erro ao carregar contas ativas:", err);
        }
    },

    /**
     * Popula o seletor de categorias do gráfico de subcategorias.
     */
    loadCategorySelectFilter() {
        const select = document.getElementById("dashCategorySelect");
        if (!select) return;

        try {
            const categories =
                DatabaseManager.query(
                    "SELECT id, name FROM categories WHERE type = 'expense' ORDER BY name ASC",
                ) || [];

            select.innerHTML = categories
                .map((c) => `<option value="${c.id}">${c.name}</option>`)
                .join("");
        } catch (err) {
            console.error("Erro ao carregar categorias para o filtro:", err);
        }
    },

    /**
     * Configura ouvintes de eventos para botões e filtros.
     */
    setupEventListeners() {
        // Evento de clique no botão Filtrar
        document
            .getElementById("dashFilterBtn")
            ?.addEventListener("click", () => this.refresh());

        // Evento de mudança no seletor de conta
        document
            .getElementById("dashboardAccountFilter")
            ?.addEventListener("change", () => this.refresh());

        // Evento de alteração no select da categoria (Top 5 Subcategorias)
        document
            .getElementById("dashCategorySelect")
            ?.addEventListener("change", (e) => {
                this.renderTopSubcategoriesChart(e.target.value);
            });

        // Evento de Impressão
        document
            .getElementById("printDashboardBtn")
            ?.addEventListener("click", () => {
                const printDateSpan =
                    document.getElementById("dashboardPrintDate");
                if (printDateSpan) {
                    const now = new Date();
                    printDateSpan.textContent = `${now.toLocaleDateString("pt-BR")} às ${now.toLocaleTimeString("pt-BR", { hour: "2-digit", minute: "2-digit" })}`;
                }
                window.print();
            });

        // Atualiza a tela quando os dados do banco forem alterados no app
        window.addEventListener("app:data-changed", () => this.refresh());
    },

    /**
     * Recarrega todos os cálculos e atualiza elementos visuais e gráficos.
     */
    refresh() {
        const filters = this.getFilterValues();
        const transactions = this.fetchFilteredTransactions(filters);

        // 1. Calcula os Totais de Receita, Despesa e Investimento
        let totalIncome = 0;
        let totalExpense = 0;
        let totalInvestment = 0;

        transactions.forEach((t) => {
            const amount = parseFloat(t.amount) || 0;
            if (t.type === "income") totalIncome += amount;
            else if (t.type === "expense") totalExpense += amount;
            else if (t.type === "investment") totalInvestment += amount;
        });

        const totalBalance = totalIncome - (totalExpense + totalInvestment);

        // 2. Atualiza Cards de Resumo na UI
        App.setText("totalIncome", App.formatCurrency(totalIncome));
        App.setText("totalExpense", App.formatCurrency(totalExpense));
        App.setText("totalInvestment", App.formatCurrency(totalInvestment));
        App.setText("totalBalance", App.formatCurrency(totalBalance));

        // 3. Atualiza Banner de Insight / Alerta
        this.updateBudgetInsightBanner(totalIncome, totalExpense);

        // 4. Atualiza Regra 50/15/35
        this.renderRule(totalIncome, transactions);

        // 5. Renderiza Gráficos Dinâmicos
        this.renderMainChart(filters);
        this.renderIncomeVsExpenseChart(
            totalExpense,
            totalInvestment,
            Math.max(0, totalBalance),
        );

        const selectedCategoryId =
            document.getElementById("dashCategorySelect")?.value;
        if (selectedCategoryId) {
            this.renderTopSubcategoriesChart(selectedCategoryId);
        }
    },

    /**
     * Retorna os valores atuais dos filtros na tela.
     */
    getFilterValues() {
        return {
            accountId:
                document.getElementById("dashboardAccountFilter")?.value ||
                "all",
            startDate: document.getElementById("dashStartDate")?.value || "",
            endDate: document.getElementById("dashEndDate")?.value || "",
        };
    },

    /**
     * Busca transações do SQLite aplicando os filtros de Conta e Período.
     */
    fetchFilteredTransactions(filters) {
        try {
            let sql = `
                SELECT 
                    e.id, 
                    e.account_id, 
                    e.type, 
                    e.value AS amount, 
                    e.date, 
                    c.id AS category_type
                FROM entries e
                INNER JOIN accounts a ON e.account_id = a.id
                LEFT JOIN categories c ON e.category_id = c.id
                WHERE a.is_active = 1
            `;
            const params = [];

            if (filters.accountId !== "all") {
                sql += " AND e.account_id = ?";
                params.push(filters.accountId);
            }

            if (filters.startDate) {
                sql += " AND e.date >= ?";
                params.push(filters.startDate);
            }

            if (filters.endDate) {
                sql += " AND e.date <= ?";
                params.push(filters.endDate);
            }

            return DatabaseManager.query(sql, params) || [];
        } catch (err) {
            console.error("Erro ao buscar transações filtradas:", err);
            return [];
        }
    },

    /**
     * Atualiza o Banner de Alerta com base no comprometimento da receita.
     * @param {number} income - Receita total.
     * @param {number} expense - Despesa total.
     */
    updateBudgetInsightBanner(income, expense) {
        const banner = document.getElementById("budgetInsightBanner");
        const iconContainer = document.getElementById("alertBannerIcon");
        const titleEl = document.getElementById("alertBannerTitle");
        const msgEl = document.getElementById("alertBannerMessage");
        const percentEl = document.getElementById("alertBannerPercent");

        if (!banner) return;

        // Limpa classes anteriores
        banner.className = "budget-alert-banner glass";

        const ratio =
            income > 0 ? (expense / income) * 100 : expense > 0 ? 100 : 0;
        percentEl.textContent = `${ratio.toFixed(1)}%`;

        if (ratio <= 50) {
            banner.classList.add("alert-safe");
            iconContainer.innerHTML = '<i class="ph ph-check-circle"></i>';
            titleEl.textContent = "Orçamento Saudável";
            msgEl.textContent =
                "Você comprometeu até 50% da sua receita. Excelente controle financeiro!";
        } else if (ratio <= 75) {
            banner.classList.add("alert-warning");
            iconContainer.innerHTML = '<i class="ph ph-warning-circle"></i>';
            titleEl.textContent = "Atenção ao Orçamento";
            msgEl.textContent =
                "Seus gastos estão entre 51% e 75% das receitas. Monitore saídas não essenciais.";
        } else {
            banner.classList.add("alert-danger");
            iconContainer.innerHTML = '<i class="ph ph-warning"></i>';
            titleEl.textContent = "Alerta Orçamentário";
            msgEl.textContent =
                "Atenção! Mais de 75% da sua receita está comprometida. Risco de déficit financeiro.";
        }
    },

    /**
     * Calcula e atualiza visualmente o progresso da Regra 50/15/35.
     */
    renderRule(totalIncome, transactions) {
        let essentialsSum = 0;
        let lifestyleSum = 0;
        let investmentsSum = 0;

        transactions.forEach((t) => {
            const val = parseFloat(t.amount) || 0;
            if (t.category_type === "essentials") essentialsSum += val;
            else if (t.category_type === "lifestyle") lifestyleSum += val;
            else if (t.type === "investment") investmentsSum += val;
        });

        const updateBar = (barId, valId, statusId, sum, targetPercent) => {
            const actualPercent =
                totalIncome > 0 ? (sum / totalIncome) * 100 : 0;
            const bar = document.getElementById(barId);
            const valLabel = document.getElementById(valId);
            const statusLabel = document.getElementById(statusId);

            if (bar) bar.style.width = `${Math.min(actualPercent, 100)}%`;
            if (valLabel)
                valLabel.textContent = `${actualPercent.toFixed(1)}% (${App.formatCurrency(sum)})`;

            if (statusLabel) {
                if (actualPercent <= targetPercent) {
                    statusLabel.className = "rule-status success";
                    statusLabel.textContent = `Dentro da meta de ${targetPercent}%`;
                } else {
                    statusLabel.className = "rule-status danger";
                    statusLabel.textContent = `Excedeu a meta de ${targetPercent}% em ${(actualPercent - targetPercent).toFixed(1)}%`;
                }
            }
        };

        updateBar(
            "essentialsBar",
            "essentialsVal",
            "essentialsStatus",
            essentialsSum,
            50,
        );
        updateBar(
            "lifestyleBar",
            "lifestyleVal",
            "lifestyleStatus",
            lifestyleSum,
            35,
        );
        updateBar(
            "prioritiesBar",
            "prioritiesVal",
            "prioritiesStatus",
            investmentsSum,
            15,
        );
    },

    /**
     * Renderiza o gráfico de Evolução Financeira (Histórico de 6 Meses).
     */
    renderMainChart(filters) {
        const ctx = document.getElementById("mainChart")?.getContext("2d");
        if (!ctx) return;

        const labels = [];
        const incomeData = [];
        const expenseData = [];

        // Monta os últimos 6 meses retroativos
        for (let i = 5; i >= 0; i--) {
            const d = new Date();
            d.setMonth(d.getMonth() - i);
            const monthStr = d.toLocaleString("pt-BR", { month: "short" });
            const yearStr = d.getFullYear();
            const monthNum = String(d.getMonth() + 1).padStart(2, "0");

            labels.push(`${monthStr}/${yearStr}`);

            // Consulta dinamicamente a receita e despesa do mês específico no SQLite
            let sqlIncome =
                "SELECT SUM(amount) as total FROM cashbook WHERE type = 'income' AND strftime('%Y-%m', date) = ?";
            let sqlExpense =
                "SELECT SUM(amount) as total FROM cashbook WHERE type = 'expense' AND strftime('%Y-%m', date) = ?";
            const params = [`${yearStr}-${monthNum}`];

            if (filters.accountId !== "all") {
                sqlIncome += " AND account_id = ?";
                sqlExpense += " AND account_id = ?";
                params.push(filters.accountId);
            }

            const incRes = DatabaseManager.queryOne(sqlIncome, params);
            const expRes = DatabaseManager.queryOne(sqlExpense, params);

            incomeData.push(incRes?.total || 0);
            expenseData.push(expRes?.total || 0);
        }

        if (this.charts.main) this.charts.main.destroy();

        this.charts.main = new Chart(ctx, {
            type: "bar",
            data: {
                labels,
                datasets: [
                    {
                        label: "Receitas",
                        data: incomeData,
                        backgroundColor: "#10b981",
                        borderRadius: 4,
                    },
                    {
                        label: "Despesas",
                        data: expenseData,
                        backgroundColor: "#ef4444",
                        borderRadius: 4,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: { legend: { labels: { color: "#94a3b8" } } },
                scales: {
                    x: {
                        ticks: { color: "#94a3b8" },
                        grid: { display: false },
                    },
                    y: {
                        ticks: { color: "#94a3b8" },
                        grid: { color: "rgba(255,255,255,0.05)" },
                    },
                },
            },
        });
    },

    /**
     * Renderiza o gráfico de Rosca: Receita vs Gastos vs Investimentos.
     */
    renderIncomeVsExpenseChart(expense, investment, balance) {
        const ctx = document
            .getElementById("incomeVsExpenseChart")
            ?.getContext("2d");
        if (!ctx) return;

        if (this.charts.incomeVsExpense) this.charts.incomeVsExpense.destroy();

        this.charts.incomeVsExpense = new Chart(ctx, {
            type: "doughnut",
            data: {
                labels: ["Despesas", "Investimentos", "Saldo Livre"],
                datasets: [
                    {
                        data: [expense, investment, balance],
                        backgroundColor: ["#ef4444", "#3b82f6", "#10b981"],
                        borderWidth: 0,
                    },
                ],
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                plugins: {
                    legend: {
                        position: "bottom",
                        labels: { color: "#94a3b8" },
                    },
                },
            },
        });
    },

    /**
     * Renderiza o gráfico Top 5 Subcategorias por Categoria no SQLite.
     * @param {string} categoryId - ID da categoria selecionada.
     */
    renderTopSubcategoriesChart(categoryId) {
        const ctx = document
            .getElementById("topSubcategoriesChart")
            ?.getContext("2d");
        if (!ctx || !categoryId) return;

        const filters = this.getFilterValues();

        try {
            let sql = `
                SELECT s.name AS subcategory, SUM(e.value) AS total
                FROM entries e
                INNER JOIN subcategories s ON e.subcategory_id = s.id
                WHERE e.category_id = ?
            `;
            const params = [categoryId];

            if (filters.accountId !== "all") {
                sql += " AND e.account_id = ?";
                params.push(filters.accountId);
            }

            sql += " GROUP BY s.id ORDER BY total DESC LIMIT 5";

            const results = DatabaseManager.query(sql, params) || [];
            const labels = results.map((r) => r.subcategory);
            const data = results.map((r) => r.total);

            if (this.charts.topSubcategories)
                this.charts.topSubcategories.destroy();

            this.charts.topSubcategories = new Chart(ctx, {
                type: "bar",
                data: {
                    labels: labels.length ? labels : ["Sem dados"],
                    datasets: [
                        {
                            label: "Gasto (R$)",
                            data: data.length ? data : [0],
                            backgroundColor: "#6366f1",
                            borderRadius: 4,
                        },
                    ],
                },
                options: {
                    indexAxis: "y",
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        x: {
                            ticks: { color: "#94a3b8" },
                            grid: { color: "rgba(255,255,255,0.05)" },
                        },
                        y: {
                            ticks: { color: "#94a3b8" },
                            grid: { display: false },
                        },
                    },
                },
            });
        } catch (err) {
            console.error("Erro ao gerar gráfico de subcategorias:", err);
        }
    },
};

// Inicializa a tela de Dashboard quando o DOM estiver pronto
document.addEventListener("DOMContentLoaded", () => {
    if (DatabaseManager.isInitialized) {
        DashboardScreen.init();
    } else {
        window.addEventListener(
            "db:ready",
            () => {
                DashboardScreen.init();
            },
            { once: true },
        );
    }
});
