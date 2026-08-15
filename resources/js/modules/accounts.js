/**
 * ============================================================================
 * ACCOUNTS.JS - GERENCIAMENTO DE CONTAS BANCÁRIAS E CARTEIRAS
 * ============================================================================
 * Este módulo gerencia o ciclo de vida das contas (Criação, Leitura, Edição,
 * Ativação/Desativação e Exclusão no SQLite) e calcula os saldos dinamicamente.
 */

const AccountsScreen = {
    // Variável temporária para guardar o ID da conta pendente de exclusão
    pendingDeleteId: null,

    /**
     * Inicializa os eventos da tela usando delegação global de eventos no document.
     */
    init() {
        // 1. Escuta todos os cliques em botões e elementos interativos da tela
        document.addEventListener("click", (event) => {
            if (
                event.target.closest("#openAccountModal") ||
                event.target.closest("#emptyStateCreateBtn")
            ) {
                this.openModalForCreate();
            }

            if (event.target.closest(".close-account-modal")) {
                this.closeModal();
            }

            if (event.target.closest(".close-delete-modal")) {
                this.closeDeleteModal();
            }

            if (event.target.closest("#confirmDeleteAccountBtn")) {
                this.executeDelete();
            }

            const actionTarget = event.target.closest("[data-account-action]");
            if (actionTarget) {
                this.handleTableActions(actionTarget);
            }
        });

        // 2. Escuta a sincronização dos campos de cor (Seletor nativo <-> Campo texto Hexadecimal)
        document.addEventListener("input", (event) => {
            if (event.target.id === "accountColorPicker") {
                document.getElementById("accountColor").value =
                    event.target.value;
            } else if (event.target.id === "accountColor") {
                const hexValue = event.target.value;
                if (/^#([A-Fa-f0-9]{6})$/.test(hexValue)) {
                    document.getElementById("accountColorPicker").value =
                        hexValue;
                }
            }
        });

        // 3. Escuta o envio do formulário de criação/edição de conta
        document.addEventListener("submit", (event) => {
            if (event.target && event.target.id === "accountForm") {
                this.handleFormSubmit(event);
            }
        });

        // Escuta o evento global de atualização de dados
        window.addEventListener("app:data-changed", () => {
            this.render();
        });

        // Atualiza os dados sempre que a tela de contas for focada/exibida
        document.addEventListener("visibilitychange", () => {
            if (!document.hidden) this.render();
        });

        // 4. Realiza a renderização inicial
        this.render();
    },

    /**
     * Calcula o saldo dinâmico de uma conta com base nos lançamentos do livro caixa.
     * @param {string} accountId - ID da conta bancária.
     * @returns {number} Saldo atual da conta.
     */
    calculateAccountBalance(accountId) {
        try {
            // Garante que o ID seja tratado como string para evitar inconsistências no SQLite
            const targetId = String(accountId);

            const transactions =
                DatabaseManager.query(
                    "SELECT type, value FROM entries WHERE CAST(account_id AS TEXT) = ?",
                    [targetId],
                ) || [];

            return transactions.reduce((acc, item) => {
                const amount = parseFloat(item.value) || 0;
                return item.type === "income" ? acc + amount : acc - amount;
            }, 0);
        } catch (error) {
            console.warn("Erro ao calcular saldo da conta:", error);
            return 0;
        }
    },

    /**
     * Renderiza a tabela de contas e atualiza o quadro de resumo de saldos dinâmicos.
     */
    render() {
        const tbody = document.querySelector("#accountsTable tbody");
        const tableContainer = document.getElementById(
            "accountsTableContainer",
        );
        const emptyState = document.getElementById("emptyAccountsState");

        if (!tbody) return;

        // Busca todas as contas gravadas no banco de dados SQLite[cite: 12]
        const accounts =
            DatabaseManager.query("SELECT * FROM accounts ORDER BY name ASC") ||
            [];

        // Mapeia as contas injetando o saldo dinâmico calculado
        const accountsWithBalance = accounts.map((acc) => ({
            ...acc,
            balance: this.calculateAccountBalance(acc.id),
        }));

        // Atualiza os contadores e cartões de estatísticas no topo da tela[cite: 12]
        this.updateSummaryCards(accountsWithBalance);

        // Se não houver nenhuma conta cadastrada, exibe o aviso visual[cite: 12]
        if (accountsWithBalance.length === 0) {
            if (tableContainer) tableContainer.style.display = "none";
            if (emptyState) emptyState.style.display = "flex";
            tbody.innerHTML = "";
            return;
        }

        if (tableContainer) tableContainer.style.display = "block";
        if (emptyState) emptyState.style.display = "none";

        // Monta as linhas da tabela em formato HTML com os saldos dinâmicos
        tbody.innerHTML = accountsWithBalance
            .map((acc) => {
                const isActive = acc.is_active === 1;

                return `
                <tr class="${isActive ? "" : "row-inactive"}">
                    <td>
                        <div style="
                            width: 24px; 
                            height: 24px; 
                            border-radius: 50%; 
                            background-color: ${acc.color || "#4f46e5"};
                            border: 2px solid rgba(255,255,255,0.2);
                        " title="${acc.color}"></div>
                    </td>
                    <td>
                        <strong><i class="ph ${acc.icon || "ph-bank"}"></i> ${acc.name}</strong>
                    </td>
                    <td>
                        <span class="badge ${isActive ? "badge-active" : "badge-inactive"}">
                            ${isActive ? "Ativa" : "Inativa"}
                        </span>
                    </td>
                    <td>
                        <strong class="${acc.balance >= 0 ? "text-success" : "text-danger"}">
                            ${App.formatCurrency(acc.balance)}
                        </strong>
                    </td>
                    <td style="text-align: center;">
                        <button 
                            type="button" 
                            class="btn-secondary btn-sm" 
                            data-account-action="toggle-status" 
                            data-id="${acc.id}" 
                            data-status="${acc.is_active}"
                            title="${isActive ? "Desativar Conta" : "Ativar Conta"}"
                        >
                            <i class="ph ${isActive ? "ph-eye-slash" : "ph-eye"}"></i>
                        </button>

                        <button 
                            type="button" 
                            class="btn-secondary btn-sm" 
                            data-account-action="edit" 
                            data-id="${acc.id}"
                            title="Editar Conta"
                        >
                            <i class="ph ph-pencil-simple"></i>
                        </button>

                        <button 
                            type="button" 
                            class="btn-danger btn-sm" 
                            data-account-action="delete" 
                            data-id="${acc.id}" 
                            data-name="${acc.name}"
                            title="Excluir Conta"
                        >
                            <i class="ph ph-trash"></i>
                        </button>
                    </td>
                </tr>
            `;
            })
            .join("");
    },

    /**
     * Atualiza os valores estatísticos nos cards do topo da página.
     * @param {Array} accounts - Lista de contas com saldos calculados.
     */
    updateSummaryCards(accounts) {
        let activeCount = 0;
        let totalActiveBalance = 0;
        let totalInactiveBalance = 0;

        accounts.forEach((acc) => {
            if (acc.is_active === 1) {
                activeCount++;
                totalActiveBalance += acc.balance;
            } else {
                totalInactiveBalance += acc.balance;
            }
        });

        const totalBalance = totalActiveBalance + totalInactiveBalance;

        // Atualiza os textos nos elementos HTML da tela[cite: 12]
        App.setText(
            "globalActiveBalance",
            App.formatCurrency(totalActiveBalance),
        );
        App.setText(
            "globalInactiveBalance",
            App.formatCurrency(totalInactiveBalance),
        );
        App.setText("totalAccountsBalance", App.formatCurrency(totalBalance));
        App.setText("activeAccountsCount", activeCount);
        App.setText("totalAccountsCount", accounts.length);
    },

    /**
     * Trata o clique nos botões de ação localizados nas linhas da tabela.[cite: 12]
     */
    handleTableActions(target) {
        const action = target.dataset.accountAction;
        const id = target.dataset.id;

        if (action === "toggle-status") {
            const currentStatus = parseInt(target.dataset.status, 10);
            this.toggleAccountStatus(id, currentStatus);
        } else if (action === "edit") {
            this.openModalForEdit(id);
        } else if (action === "delete") {
            const name = target.dataset.name;
            this.promptDeleteAccount(id, name);
        }
    },

    openModalForCreate() {
        const form = document.getElementById("accountForm");
        if (form) form.reset();

        document.getElementById("accountId").value = "";
        document.getElementById("accountModalTitle").textContent =
            "Nova Conta Bancária";
        document.getElementById("accountColorPicker").value = "#4f46e5";
        document.getElementById("accountColor").value = "#4f46e5";

        App.toggleModal("accountModal", true);
    },

    openModalForEdit(id) {
        const account = DatabaseManager.queryOne(
            "SELECT * FROM accounts WHERE id = ?",
            [id],
        );
        if (!account) return;

        document.getElementById("accountId").value = account.id;
        document.getElementById("accountModalTitle").textContent =
            `Editar Conta: ${account.name}`;
        document.getElementById("accountName").value = account.name;
        document.getElementById("accountIcon").value =
            account.icon || "ph-bank";

        const color = account.color || "#4f46e5";
        document.getElementById("accountColor").value = color;
        document.getElementById("accountColorPicker").value = color;

        App.toggleModal("accountModal", true);
    },

    closeModal() {
        App.toggleModal("accountModal", false);
    },

    async handleFormSubmit(event) {
        event.preventDefault();

        const id = document.getElementById("accountId").value;
        const name = document.getElementById("accountName").value.trim();
        const icon = document.getElementById("accountIcon").value;
        const color = document.getElementById("accountColor").value.trim();

        if (!name) return;

        try {
            if (id) {
                await DatabaseManager.execute(
                    "UPDATE accounts SET name = ?, icon = ?, color = ? WHERE id = ?",
                    [name, icon, color, id],
                );
                App.showAlert(
                    "Conta bancária atualizada com sucesso!",
                    "success",
                );
            } else {
                const newId = `acc_${Date.now()}`;
                await DatabaseManager.execute(
                    "INSERT INTO accounts (id, name, icon, color, is_active) VALUES (?, ?, ?, ?, 1)",
                    [newId, name, icon, color],
                );
                App.showAlert("Conta bancária criada com sucesso!", "success");
            }

            this.closeModal();
            this.render();
        } catch (error) {
            console.error("Erro ao salvar conta no banco de dados:", error);
            App.showAlert("Erro ao salvar conta bancária.", "danger");
        }
    },

    async toggleAccountStatus(id, currentStatus) {
        const newStatus = currentStatus === 1 ? 0 : 1;
        try {
            await DatabaseManager.execute(
                "UPDATE accounts SET is_active = ? WHERE id = ?",
                [newStatus, id],
            );
            App.showAlert(
                `Conta ${newStatus === 1 ? "ativada" : "desativada"} com sucesso!`,
                "info",
            );
            this.render();
        } catch (error) {
            console.error("Erro ao alterar status da conta:", error);
            App.showAlert("Erro ao alterar status da conta.", "danger");
        }
    },

    promptDeleteAccount(id, name) {
        this.pendingDeleteId = id;
        document.getElementById("deleteAccountMessage").textContent =
            `Tem certeza que deseja excluir a conta "${name}"? Todas as movimentações vinculadas serão afetadas.`;
        App.toggleModal("deleteAccountModal", true);
    },

    closeDeleteModal() {
        this.pendingDeleteId = null;
        App.toggleModal("deleteAccountModal", false);
    },

    async executeDelete() {
        if (!this.pendingDeleteId) return;

        try {
            await DatabaseManager.execute("DELETE FROM accounts WHERE id = ?", [
                this.pendingDeleteId,
            ]);
            App.showAlert("Conta excluída com sucesso!", "success");
            this.closeDeleteModal();
            this.render();
        } catch (error) {
            console.error("Erro ao excluir conta do banco de dados:", error);
            App.showAlert("Erro ao excluir conta.", "danger");
        }
    },
};

// Inicialização automatizada do módulo
document.addEventListener("DOMContentLoaded", () => {
    AccountsScreen.init();
});
