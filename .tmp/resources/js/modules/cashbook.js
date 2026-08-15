/**
 * ============================================================================
 * CASHBOOK.JS - MÓDULO DO LIVRO CAIXA
 * ============================================================================
 */

const CashbookScreen = {
    initialized: false,

    init() {
        if (!this.initialized) {
            this.bindEvents();
            this.initialized = true;
        }

        this.setDefaultFilterDates();
        this.populateFilterSelects();
        this.render();
    },

    /**
     * Anexa os manipuladores de eventos apenas UMA vez
     */
    bindEvents() {
        // --- Abertura e Fechamento de Modais ---
        document
            .getElementById("openCashbookModal")
            ?.addEventListener("click", () => this.openModal());
        document
            .getElementById("openTransferModal")
            ?.addEventListener("click", () => this.openTransferModal());

        document
            .getElementById("printCashbookBtn")
            ?.addEventListener("click", () => {
                // Insere a data e hora atual no span de emissão
                const issueDateSpan = document.getElementById("printIssueDate");
                if (issueDateSpan) {
                    const now = new Date();
                    issueDateSpan.textContent =
                        now.toLocaleDateString("pt-BR") +
                        " às " +
                        now.toLocaleTimeString("pt-BR", {
                            hour: "2-digit",
                            minute: "2-digit",
                        });
                }

                // Chama a janela de impressão nativa
                window.print();
            });

        document.querySelectorAll(".close-cashbook-modal").forEach((button) => {
            button.addEventListener("click", () =>
                App.toggleModal("cashbookModal", false),
            );
        });

        document.querySelectorAll(".close-transfer-modal").forEach((button) => {
            button.addEventListener("click", () =>
                App.toggleModal("transferModal", false),
            );
        });

        // --- Alternância de Categorias por Tipo (Entrada/Saída) ---
        document
            .getElementById("cashbookOperationType")
            ?.addEventListener("change", (e) => {
                this.loadCategoriesForm(e.target.value);
            });

        document
            .getElementById("cashbookCategory")
            ?.addEventListener("change", (e) => {
                this.loadSubcategoriesForm(e.target.value);
            });

        // --- Filtros ---
        const filterElements = [
            "cashbookAccountFilter",
            "cashbookCategoryFilter",
            "cashbookSubcategoryFilter",
            "cashbookStartDate",
            "cashbookEndDate",
        ];

        filterElements.forEach((id) => {
            document.getElementById(id)?.addEventListener("change", () => {
                if (id === "cashbookCategoryFilter") {
                    this.loadSubcategoriesFilter();
                }
                this.render();
            });
        });

        document
            .getElementById("clearCashbookFiltersBtn")
            ?.addEventListener("click", () => {
                this.resetFilters();
            });

        // --- Submit dos Formulários ---
        const entryForm = document.getElementById("cashbookForm");
        if (entryForm) {
            entryForm.onsubmit = (e) => this.handleSaveEntry(e);
        }

        const transferForm = document.getElementById("cashbookTransferForm");
        if (transferForm) {
            transferForm.onsubmit = (e) => this.handleSaveTransfer(e);
        }
    },

    setDefaultFilterDates() {
        const now = new Date();
        const firstDay = new Date(now.getFullYear(), now.getMonth(), 1)
            .toISOString()
            .split("T")[0];
        const today = now.toISOString().split("T")[0];

        const startInput = document.getElementById("cashbookStartDate");
        const endInput = document.getElementById("cashbookEndDate");

        if (startInput && !startInput.value) startInput.value = firstDay;
        if (endInput && !endInput.value) endInput.value = today;
    },

    loadCategoriesForm(type) {
        const categorySelect = document.getElementById("cashbookCategory");
        if (!categorySelect) return;

        const categories = DatabaseManager.query(
            "SELECT * FROM categories WHERE type = ? ORDER BY name ASC",
            [type],
        );

        categorySelect.innerHTML =
            '<option value="">Selecione uma categoria...</option>' +
            categories
                .map((cat) => `<option value="${cat.id}">${cat.name}</option>`)
                .join("");

        this.loadSubcategoriesForm("");
    },

    loadSubcategoriesForm(categoryId) {
        const subcategorySelect = document.getElementById(
            "cashbookSubcategory",
        );
        if (!subcategorySelect) return;

        if (!categoryId) {
            subcategorySelect.innerHTML =
                '<option value="">Selecione a categoria primeiro...</option>';
            return;
        }

        const subcategories = DatabaseManager.query(
            "SELECT * FROM subcategories WHERE category_id = ? ORDER BY name ASC",
            [categoryId],
        );

        subcategorySelect.innerHTML =
            '<option value="">Sem subcategoria (Opcional)</option>' +
            subcategories
                .map((sub) => `<option value="${sub.id}">${sub.name}</option>`)
                .join("");
    },

    populateFilterSelects() {
        const accountFilter = document.getElementById("cashbookAccountFilter");
        if (accountFilter) {
            const accounts = DatabaseManager.query(
                "SELECT * FROM accounts WHERE is_active = 1 ORDER BY name ASC",
            );
            accountFilter.innerHTML =
                '<option value="all">Todas as Contas</option>' +
                accounts
                    .map(
                        (acc) =>
                            `<option value="${acc.id}">${acc.name}</option>`,
                    )
                    .join("");
        }

        const categoryFilter = document.getElementById(
            "cashbookCategoryFilter",
        );
        if (categoryFilter) {
            const categories = DatabaseManager.query(
                "SELECT * FROM categories ORDER BY name ASC",
            );
            categoryFilter.innerHTML =
                '<option value="all">Todas as Categorias</option>' +
                categories
                    .map(
                        (cat) =>
                            `<option value="${cat.id}">${cat.name}</option>`,
                    )
                    .join("");
        }

        this.loadSubcategoriesFilter();
    },

    loadSubcategoriesFilter() {
        const categoryId = document.getElementById(
            "cashbookCategoryFilter",
        )?.value;
        const subcategoryFilter = document.getElementById(
            "cashbookSubcategoryFilter",
        );

        if (!subcategoryFilter) return;

        if (!categoryId || categoryId === "all") {
            subcategoryFilter.innerHTML =
                '<option value="all">Todas as Subcategorias</option>';
            return;
        }

        const subcategories = DatabaseManager.query(
            "SELECT * FROM subcategories WHERE category_id = ? ORDER BY name ASC",
            [categoryId],
        );

        subcategoryFilter.innerHTML =
            '<option value="all">Todas as Subcategorias</option>' +
            subcategories
                .map((sub) => `<option value="${sub.id}">${sub.name}</option>`)
                .join("");
    },

    resetFilters() {
        document.getElementById("cashbookAccountFilter").value = "all";
        document.getElementById("cashbookCategoryFilter").value = "all";
        document.getElementById("cashbookSubcategoryFilter").value = "all";
        this.setDefaultFilterDates();
        this.loadSubcategoriesFilter();
        this.render();
    },

    openModal() {
        const form = document.getElementById("cashbookForm");
        if (form) form.reset();

        document.getElementById("cashbookDate").value = App.getTodayDate();

        const accounts = DatabaseManager.query(
            "SELECT * FROM accounts WHERE is_active = 1 ORDER BY name ASC",
        );
        const accountOptions =
            '<option value="">Selecione...</option>' +
            accounts
                .map((acc) => `<option value="${acc.id}">${acc.name}</option>`)
                .join("");

        document.getElementById("cashbookAccount").innerHTML = accountOptions;

        document.getElementById("cashbookOperationType").value = "income";
        this.loadCategoriesForm("income");

        App.toggleModal("cashbookModal", true);
    },

    openTransferModal() {
        const form = document.getElementById("cashbookTransferForm");
        if (form) form.reset();

        document.getElementById("transferDate").value = App.getTodayDate();

        const accounts = DatabaseManager.query(
            "SELECT * FROM accounts WHERE is_active = 1 ORDER BY name ASC",
        );
        const accountOptions =
            '<option value="">Selecione...</option>' +
            accounts
                .map((acc) => `<option value="${acc.id}">${acc.name}</option>`)
                .join("");

        document.getElementById("cashbookSourceAccount").innerHTML =
            accountOptions;
        document.getElementById("cashbookTargetAccount").innerHTML =
            accountOptions;

        App.toggleModal("transferModal", true);
    },

    async handleSaveEntry(event) {
        event.preventDefault();

        const type = document.getElementById("cashbookOperationType").value;
        const accountId = document.getElementById("cashbookAccount").value;
        const categoryId = document.getElementById("cashbookCategory").value;
        const subcategoryId =
            document.getElementById("cashbookSubcategory").value || null;
        const date = document.getElementById("cashbookDate").value;
        const value = parseFloat(
            document.getElementById("cashbookValue").value,
        );
        const description = document
            .getElementById("cashbookDescription")
            .value.trim();
        const notes = document.getElementById("cashbookNotes").value.trim();

        try {
            const newId = `entry_${Date.now()}`;

            await DatabaseManager.execute(
                `
                INSERT INTO entries (id, type, account_id, category_id, subcategory_id, value, date, description, notes)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            `,
                [
                    newId,
                    type,
                    accountId,
                    categoryId,
                    subcategoryId,
                    value,
                    date,
                    description,
                    notes,
                ],
            );

            // Adicione esta linha logo após salvar ou deletar uma movimentação no cashbook.js:
            window.dispatchEvent(new CustomEvent("app:data-changed"));

            App.showAlert("Lançamento salvo com sucesso!", "success");
            App.toggleModal("cashbookModal", false);
            this.render();
        } catch (error) {
            console.error("Erro ao salvar lançamento no Livro Caixa:", error);
            App.showAlert("Erro ao salvar o registro.", "danger");
        }
    },

    async handleSaveTransfer(event) {
        event.preventDefault();

        const sourceAccountId = document.getElementById(
            "cashbookSourceAccount",
        ).value;
        const targetAccountId = document.getElementById(
            "cashbookTargetAccount",
        ).value;
        const date = document.getElementById("transferDate").value;
        const value = parseFloat(
            document.getElementById("transferValue").value,
        );
        const description = document
            .getElementById("transferDescription")
            .value.trim();
        const notes = document.getElementById("transferNotes").value.trim();

        if (sourceAccountId === targetAccountId) {
            App.showAlert(
                "A conta de origem e destino não podem ser iguais!",
                "danger",
            );
            return;
        }

        try {
            const transferGroupId = `trans_${Date.now()}`;

            // 1. Saída na origem
            await DatabaseManager.execute(
                `
                INSERT INTO entries (id, type, account_id, value, date, description, notes, transfer_group_id)
                VALUES (?, 'expense', ?, ?, ?, ?, ?, ?)
            `,
                [
                    `${transferGroupId}_out`,
                    sourceAccountId,
                    value,
                    date,
                    `[Transferência Saída] ${description}`,
                    notes,
                    transferGroupId,
                ],
            );

            // 2. Entrada no destino
            await DatabaseManager.execute(
                `
                INSERT INTO entries (id, type, account_id, value, date, description, notes, transfer_group_id)
                VALUES (?, 'income', ?, ?, ?, ?, ?, ?)
            `,
                [
                    `${transferGroupId}_in`,
                    targetAccountId,
                    value,
                    date,
                    `[Transferência Entrada] ${description}`,
                    notes,
                    transferGroupId,
                ],
            );

            // Adicione esta linha logo após salvar ou deletar uma movimentação no cashbook.js:
            window.dispatchEvent(new CustomEvent("app:data-changed"));

            App.showAlert("Transferência realizada com sucesso!", "success");
            App.toggleModal("transferModal", false);
            this.render();
        } catch (error) {
            console.error("Erro ao realizar transferência:", error);
            App.showAlert("Erro ao realizar a transferência.", "danger");
        }
    },

    render() {
        const tbody = document.querySelector("#cashbookTable tbody");
        if (!tbody) return;

        const accountFilter =
            document.getElementById("cashbookAccountFilter")?.value || "all";
        const categoryFilter =
            document.getElementById("cashbookCategoryFilter")?.value || "all";
        const subcategoryFilter =
            document.getElementById("cashbookSubcategoryFilter")?.value ||
            "all";
        const startDate = document.getElementById("cashbookStartDate")?.value;
        const endDate = document.getElementById("cashbookEndDate")?.value;

        let query = `
            SELECT 
                e.*, 
                a.name as account_name,
                c.name as category_name,
                s.name as subcategory_name
            FROM entries e
            LEFT JOIN accounts a ON e.account_id = a.id
            LEFT JOIN categories c ON e.category_id = c.id
            LEFT JOIN subcategories s ON e.subcategory_id = s.id
            WHERE 1=1
        `;

        const params = [];

        if (accountFilter !== "all") {
            query += ` AND e.account_id = ?`;
            params.push(accountFilter);
        }

        if (categoryFilter !== "all") {
            query += ` AND e.category_id = ?`;
            params.push(categoryFilter);
        }

        if (subcategoryFilter !== "all") {
            query += ` AND e.subcategory_id = ?`;
            params.push(subcategoryFilter);
        }

        if (startDate) {
            query += ` AND e.date >= ?`;
            params.push(startDate);
        }

        if (endDate) {
            query += ` AND e.date <= ?`;
            params.push(endDate);
        }

        query += ` ORDER BY e.date ASC, e.id ASC`;

        const entries = DatabaseManager.query(query, params);

        let totalIncome = 0;
        let totalExpense = 0;
        let runningBalance = 0;

        if (entries.length === 0) {
            tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-secondary);">Nenhum lançamento encontrado para os filtros aplicados.</td></tr>`;
            this.updateSummary(0, 0, 0);
            return;
        }

        tbody.innerHTML = entries
            .map((entry) => {
                const isIncome = entry.type === "income";

                if (isIncome) {
                    totalIncome += entry.value;
                    runningBalance += entry.value;
                } else {
                    totalExpense += entry.value;
                    runningBalance -= entry.value;
                }

                let categoryText = entry.category_name || "Transferência";
                if (entry.subcategory_name) {
                    categoryText += ` <small style="color: var(--text-secondary);">(${entry.subcategory_name})</small>`;
                }

                return `
                <tr>
                    <td>${new Date(entry.date + "T00:00:00").toLocaleDateString("pt-BR")}</td>
                    <td><strong>${entry.account_name || "N/A"}</strong></td>
                    <td>
                        <span class="badge ${isIncome ? "badge-active" : "badge-inactive"}">
                            ${isIncome ? "Entrada" : "Saída"}
                        </span>
                    </td>
                    <td>${categoryText}</td>
                    <td>${entry.description}</td>
                    <td class="income-value">${isIncome ? App.formatCurrency(entry.value) : "-"}</td>
                    <td class="expense-value">${!isIncome ? App.formatCurrency(entry.value) : "-"}</td>
                    <td class="balance-value">${App.formatCurrency(runningBalance)}</td>
                    <td style="text-align: center;">
                        <button type="button" class="btn-danger btn-sm" onclick="CashbookScreen.deleteEntry('${entry.id}')" title="Excluir">
                            <i class="ph ph-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            })
            .join("");

        this.updateSummary(
            totalIncome,
            totalExpense,
            totalIncome - totalExpense,
        );
    },

    updateSummary(income, expense, balance) {
        App.setText("cashbookTotalIncome", `+ ${App.formatCurrency(income)}`);
        App.setText("cashbookTotalExpense", `- ${App.formatCurrency(expense)}`);
        App.setText("cashbookBalance", App.formatCurrency(balance));
    },

    async deleteEntry(id) {
        if (!confirm("Tem certeza que deseja excluir este lançamento?")) return;

        try {
            await DatabaseManager.execute("DELETE FROM entries WHERE id = ?", [
                id,
            ]);

            // Adicione esta linha logo após salvar ou deletar uma movimentação no cashbook.js:
            window.dispatchEvent(new CustomEvent("app:data-changed"));

            App.showAlert("Lançamento excluído com sucesso!", "info");
            this.render();
        } catch (error) {
            console.error("Erro ao excluir lançamento:", error);
            App.showAlert("Erro ao excluir o lançamento.", "danger");
        }
    },
};
