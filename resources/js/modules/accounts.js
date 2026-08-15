/**
 * ============================================================================
 * ACCOUNTS.JS - GERENCIAMENTO DE CONTAS BANCÁRIAS E CARTEIRAS
 * ============================================================================
 * Este módulo gerencia o ciclo de vida das contas (Criação, Leitura, Edição, 
 * Ativação/Desativação e Exclusão no SQLite).
 */

const AccountsScreen = {
    // Variável temporária para guardar o ID da conta pendente de exclusão
    pendingDeleteId: null,

    /**
     * Inicializa os eventos da tela usando delegação global de eventos no document.
     * Isso garante que os botões continuem funcionando mesmo se a página for recarregada.
     */
    init() {
        // 1. Escuta todos os cliques em botões e elementos interativos da tela
        document.addEventListener("click", (event) => {
            // Abrir formulário para criar nova conta
            if (event.target.closest("#openAccountModal") || event.target.closest("#emptyStateCreateBtn")) {
                this.openModalForCreate();
            }

            // Fechar modal de cadastro/edição
            if (event.target.closest(".close-account-modal")) {
                this.closeModal();
            }

            // Fechar modal de exclusão
            if (event.target.closest(".close-delete-modal")) {
                this.closeDeleteModal();
            }

            // Confirmar a exclusão da conta
            if (event.target.closest("#confirmDeleteAccountBtn")) {
                this.executeDelete();
            }

            // Captura ações disparadas pelos botões dentro da tabela
            const actionTarget = event.target.closest("[data-account-action]");
            if (actionTarget) {
                this.handleTableActions(actionTarget);
            }
        });

        // 2. Escuta a sincronização dos campos de cor (Seletor nativo <-> Campo texto Hexadecimal)
        document.addEventListener("input", (event) => {
            if (event.target.id === "accountColorPicker") {
                document.getElementById("accountColor").value = event.target.value;
            } else if (event.target.id === "accountColor") {
                const hexValue = event.target.value;
                if (/^#([A-Fa-f0-9]{6})$/.test(hexValue)) {
                    document.getElementById("accountColorPicker").value = hexValue;
                }
            }
        });

        // 3. Escuta o envio do formulário de criação/edição de conta
        document.addEventListener("submit", (event) => {
            if (event.target && event.target.id === "accountForm") {
                this.handleFormSubmit(event);
            }
        });

        // 4. Realiza a renderização inicial
        this.render();
    },

    /**
     * Renderiza a tabela de contas e atualiza o quadro de resumo de saldos.
     */
    render() {
        const tbody = document.querySelector("#accountsTable tbody");
        const tableContainer = document.getElementById("accountsTableContainer");
        const emptyState = document.getElementById("emptyAccountsState");

        if (!tbody) return; // Cancela se a tela não estiver visível no DOM

        // Busca todas as contas gravadas no banco de dados SQLite
        const accounts = DatabaseManager.query("SELECT * FROM accounts ORDER BY name ASC");

        // Atualiza os contadores e cartões de estatísticas no topo da tela
        this.updateSummaryCards(accounts);

        // Se não houver nenhuma conta cadastrada, exibe o aviso visual
        if (accounts.length === 0) {
            if (tableContainer) tableContainer.style.display = "none";
            if (emptyState) emptyState.style.display = "flex";
            tbody.innerHTML = "";
            return;
        }

        // Exibe a tabela e esconde o aviso
        if (tableContainer) tableContainer.style.display = "block";
        if (emptyState) emptyState.style.display = "none";

        // Monta as linhas da tabela em formato HTML
        tbody.innerHTML = accounts.map((acc) => {
            const isActive = acc.is_active === 1;
            const staticBalance = 0; // O saldo permanecerá zerado até o módulo de Fluxo de Caixa

            return `
                <tr class="${isActive ? '' : 'row-inactive'}">
                    <td>
                        <div style="
                            width: 24px; 
                            height: 24px; 
                            border-radius: 50%; 
                            background-color: ${acc.color || '#4f46e5'};
                            border: 2px solid rgba(255,255,255,0.2);
                        " title="${acc.color}"></div>
                    </td>
                    <td>
                        <strong><i class="ph ${acc.icon || 'ph-bank'}"></i> ${acc.name}</strong>
                    </td>
                    <td>
                        <span class="badge ${isActive ? 'badge-active' : 'badge-inactive'}">
                            ${isActive ? 'Ativa' : 'Inativa'}
                        </span>
                    </td>
                    <td>
                        <strong>${App.formatCurrency(staticBalance)}</strong>
                    </td>
                    <td style="text-align: center;">
                        <button 
                            type="button" 
                            class="btn-secondary btn-sm" 
                            data-account-action="toggle-status" 
                            data-id="${acc.id}" 
                            data-status="${acc.is_active}"
                            title="${isActive ? 'Desativar Conta' : 'Ativar Conta'}"
                        >
                            <i class="ph ${isActive ? 'ph-eye-slash' : 'ph-eye'}"></i>
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
        }).join("");
    },

    /**
     * Atualiza os valores estatísticos nos cards do topo da página.
     * @param {Array} accounts - Lista de contas vindas do banco de dados.
     */
    updateSummaryCards(accounts) {
        let activeCount = 0;
        let totalCount = accounts.length;

        // Atualmente o saldo global é R$ 0,00 estático até a implementação das movimentações
        const totalActiveBalance = 0;
        const totalInactiveBalance = 0;

        accounts.forEach(acc => {
            if (acc.is_active === 1) activeCount++;
        });

        // Atualiza os textos nos elementos HTML da tela
        App.setText("globalActiveBalance", App.formatCurrency(totalActiveBalance));
        App.setText("globalInactiveBalance", App.formatCurrency(totalInactiveBalance));
        App.setText("totalActiveBalance", App.formatCurrency(totalActiveBalance));
        App.setText("activeAccountsCount", activeCount);
        App.setText("totalAccountsCount", totalCount);
    },

    /**
     * Trata o clique nos botões de ação localizados nas linhas da tabela.
     * @param {HTMLElement} target - Elemento HTML que disparou a ação.
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

    /**
     * Prepara o modal para a criação de uma NOVA conta bancária.
     */
    openModalForCreate() {
        const form = document.getElementById("accountForm");
        if (form) form.reset();

        document.getElementById("accountId").value = ""; // Vazio indica criação
        document.getElementById("accountModalTitle").textContent = "Nova Conta Bancária";
        document.getElementById("accountColorPicker").value = "#4f46e5";
        document.getElementById("accountColor").value = "#4f46e5";

        App.toggleModal("accountModal", true);
    },

    /**
     * Busca as informações da conta no banco e preenche o formulário para EDIÇÃO.
     * @param {string} id - ID único da conta a ser editada.
     */
    openModalForEdit(id) {
        const account = DatabaseManager.queryOne("SELECT * FROM accounts WHERE id = ?", [id]);
        if (!account) return;

        document.getElementById("accountId").value = account.id;
        document.getElementById("accountModalTitle").textContent = `Editar Conta: ${account.name}`;
        document.getElementById("accountName").value = account.name;
        document.getElementById("accountIcon").value = account.icon || "ph-bank";
        
        const color = account.color || "#4f46e5";
        document.getElementById("accountColor").value = color;
        document.getElementById("accountColorPicker").value = color;

        App.toggleModal("accountModal", true);
    },

    /**
     * Fecha o modal de formulário de contas.
     */
    closeModal() {
        App.toggleModal("accountModal", false);
    },

    /**
     * Salva ou atualiza os dados da conta no banco SQLite.
     */
    async handleFormSubmit(event) {
        event.preventDefault();

        const id = document.getElementById("accountId").value;
        const name = document.getElementById("accountName").value.trim();
        const icon = document.getElementById("accountIcon").value;
        const color = document.getElementById("accountColor").value.trim();

        if (!name) return;

        try {
            if (id) {
                // EDIÇÃO: Atualiza os dados de uma conta existente
                await DatabaseManager.execute(
                    "UPDATE accounts SET name = ?, icon = ?, color = ? WHERE id = ?",
                    [name, icon, color, id]
                );
                App.showAlert("Conta bancária atualizada com sucesso!", "success");
            } else {
                // INCLUSÃO: Gera um novo ID e cadastra a conta como ATIVA (1)
                const newId = `acc_${Date.now()}`;
                await DatabaseManager.execute(
                    "INSERT INTO accounts (id, name, icon, color, is_active) VALUES (?, ?, ?, ?, 1)",
                    [newId, name, icon, color]
                );
                App.showAlert("Conta bancária criada com sucesso!", "success");
            }

            this.closeModal();
            this.render(); // Recarrega a tabela de contas na tela
        } catch (error) {
            console.error("Erro ao salvar conta no banco de dados:", error);
            App.showAlert("Erro ao salvar conta bancária.", "danger");
        }
    },

    /**
     * Alterna o status da conta entre Ativa (1) e Inativa (0).
     */
    async toggleAccountStatus(id, currentStatus) {
        const newStatus = currentStatus === 1 ? 0 : 1;
        try {
            await DatabaseManager.execute(
                "UPDATE accounts SET is_active = ? WHERE id = ?",
                [newStatus, id]
            );
            App.showAlert(
                `Conta ${newStatus === 1 ? 'ativada' : 'desativada'} com sucesso!`, 
                "info"
            );
            this.render();
        } catch (error) {
            console.error("Erro ao alterar status da conta:", error);
            App.showAlert("Erro ao alterar status da conta.", "danger");
        }
    },

    /**
     * Exibe o modal perguntando se o usuário realmente deseja excluir a conta.
     */
    promptDeleteAccount(id, name) {
        this.pendingDeleteId = id;
        document.getElementById("deleteAccountMessage").textContent = 
            `Tem certeza que deseja excluir a conta "${name}"? Todas as movimentações vinculadas serão afetadas.`;
        App.toggleModal("deleteAccountModal", true);
    },

    /**
     * Fecha o modal de confirmação de exclusão.
     */
    closeDeleteModal() {
        this.pendingDeleteId = null;
        App.toggleModal("deleteAccountModal", false);
    },

    /**
     * Executa a remoção definitiva da conta no banco de dados SQLite.
     */
    async executeDelete() {
        if (!this.pendingDeleteId) return;

        try {
            await DatabaseManager.execute(
                "DELETE FROM accounts WHERE id = ?",
                [this.pendingDeleteId]
            );
            App.showAlert("Conta excluída com sucesso!", "success");
            this.closeDeleteModal();
            this.render();
        } catch (error) {
            console.error("Erro ao excluir conta do banco de dados:", error);
            App.showAlert("Erro ao excluir conta.", "danger");
        }
    }
};

// Inicialização automatizada do módulo
document.addEventListener("DOMContentLoaded", () => {
    AccountsScreen.init();
});