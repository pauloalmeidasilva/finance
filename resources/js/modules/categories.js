/**
 * ============================================================================
 * CATEGORIES.JS - MÓDULO DE CATEGORIAS E SUBCATEGORIAS
 * ============================================================================
 * Gerencia a exibição das 4 categorias padrão (Receitas, Necessárias, Eventuais, Investimentos)
 * e permite criar, editar e excluir subcategorias associadas a elas no banco SQLite.
 */

// Definição estática das informações auxiliares das 4 categorias padrão
const CATEGORY_METADATA = {
    income: { name: "Receitas", percent: 100, badgeClass: "badge-success" },
    essentials: { name: "Despesas Necessárias", percent: 50, badgeClass: "badge-warning" },
    lifestyle: { name: "Despesas Eventuais", percent: 35, badgeClass: "badge-info" },
    investments: { name: "Investimentos", percent: 15, badgeClass: "badge-primary" }
};

const CategoriesScreen = {
    /**
     * Inicializa os eventos da tela de categorias.
     */
    init() {
        // Escuta eventos de clique em toda a página (evita problemas se a tela demorar para carregar)
        document.addEventListener("click", (event) => {
            // Fechar modal ao clicar em botões .close-modal
            if (event.target.closest("#subcategoryModal .close-modal")) {
                this.closeModal();
            }

            // Tratar botões de ação da tabela de categorias/subcategorias
            const actionTarget = event.target.closest("[data-action]");
            if (actionTarget) {
                this.handleTableAction(actionTarget);
            }
        });

        // Escuta o envio do formulário no modal
        document.addEventListener("submit", (event) => {
            if (event.target && event.target.id === "subcategoryForm") {
                this.handleFormSubmit(event);
            }
        });

        // Tenta renderizar caso o HTML já esteja pronto
        this.render();
    },

    /**
     * Renderiza as categorias e suas subcategorias cadastradas no banco de dados.
     */
    render() {
        const tbody = document.querySelector("#categoryTable tbody");
        if (!tbody) return;

        // 1. Busca todas as categorias do banco
        const categoriesInDb = DatabaseManager.query("SELECT * FROM categories");

        // 2. Busca todas as subcategorias do banco
        const subcategoriesInDb = DatabaseManager.query("SELECT * FROM subcategories ORDER BY name ASC");

        // 3. Monta o HTML das linhas da tabela
        tbody.innerHTML = categoriesInDb.map(category => {
            const meta = CATEGORY_METADATA[category.id] || { name: category.name, percent: 0 };
            
            // Filtra as subcategorias desta categoria específica
            const subs = subcategoriesInDb.filter(sub => sub.category_id === category.id);

            // Monta as 'tags/pills' das subcategorias com botões de editar e deletar
            const subcategoriesHtml = subs.length > 0 
                ? subs.map(sub => `
                    <span class="tag-pill">
                        ${sub.name}
                        <button class="tag-btn-edit" data-action="edit-sub" data-sub-id="${sub.id}" data-sub-name="${sub.name}" data-cat-id="${category.id}" title="Editar subcategoria">
                            <i class="ph ph-pencil-simple"></i>
                        </button>
                        <button class="tag-btn-delete" data-action="delete-sub" data-sub-id="${sub.id}" data-sub-name="${sub.name}" title="Excluir subcategoria">
                            <i class="ph ph-x"></i>
                        </button>
                    </span>
                  `).join("")
                : '<span class="text-muted">Nenhuma subcategoria cadastrada</span>';

            return `
                <tr>
                    <td><strong>${meta.name}</strong></td>
                    <td><span class="percent-tag">${meta.percent}%</span></td>
                    <td><div class="subcategories-wrapper">${subcategoriesHtml}</div></td>
                    <td style="text-align: center;">
                        <button class="btn-secondary btn-sm" data-action="add-sub" data-cat-id="${category.id}" data-cat-name="${meta.name}">
                            <i class="ph ph-plus"></i> Add Subcategoria
                        </button>
                    </td>
                </tr>
            `;
        }).join("");
    },

    /**
     * Intercepta e processa os cliques dos botões de ação ([data-action]).
     * @param {HTMLElement} target - O elemento/botão que recebeu o clique.
     */
    handleTableAction(target) {
        const action = target.dataset.action;

        // Ação: Abrir modal para adicionar subcategoria
        if (action === "add-sub") {
            const catId = target.dataset.catId;
            const catName = target.dataset.catName;
            this.openModalForAdd(catId, catName);
        }

        // Ação: Abrir modal para editar subcategoria
        if (action === "edit-sub") {
            const subId = target.dataset.subId;
            const subName = target.dataset.subName;
            const catId = target.dataset.catId;
            const catName = CATEGORY_METADATA[catId]?.name || "";
            this.openModalForEdit(subId, subName, catId, catName);
        }

        // Ação: Excluir subcategoria
        if (action === "delete-sub") {
            const subId = target.dataset.subId;
            const subName = target.dataset.subName;
            this.deleteSubcategory(subId, subName);
        }
    },

    /**
     * Prepara e abre o modal para ADICIONAR uma nova subcategoria.
     */
    openModalForAdd(categoryId, categoryName) {
        document.getElementById("subcategoryForm")?.reset();
        document.getElementById("subcategoryModalTitle").textContent = "Nova Subcategoria";
        document.getElementById("subcategoryCategoryId").value = categoryId;
        document.getElementById("subcategoryId").value = ""; // Vazio indica criação
        document.getElementById("subcategoryCategoryName").value = categoryName;

        App.toggleModal("subcategoryModal", true);
    },

    /**
     * Prepara e abre o modal para EDITAR uma subcategoria existente.
     */
    openModalForEdit(subId, subName, categoryId, categoryName) {
        document.getElementById("subcategoryModalTitle").textContent = "Editar Subcategoria";
        document.getElementById("subcategoryCategoryId").value = categoryId;
        document.getElementById("subcategoryId").value = subId; // ID preenchido indica edição
        document.getElementById("subcategoryCategoryName").value = categoryName;
        document.getElementById("subcategoryName").value = subName;

        App.toggleModal("subcategoryModal", true);
    },

    /**
     * Fecha o modal de subcategoria.
     */
    closeModal() {
        App.toggleModal("subcategoryModal", false);
    },

    /**
     * Salva a subcategoria (Inclusão ou Alteração) no banco de dados SQLite.
     */
    async handleFormSubmit(event) {
        event.preventDefault();

        const categoryId = document.getElementById("subcategoryCategoryId").value;
        const subcategoryId = document.getElementById("subcategoryId").value;
        const name = document.getElementById("subcategoryName").value.trim();

        if (!name || !categoryId) return;

        try {
            // Verifica se já existe uma subcategoria com o mesmo nome na mesma categoria
            const existing = DatabaseManager.queryOne(
                "SELECT id FROM subcategories WHERE category_id = ? AND LOWER(name) = LOWER(?) AND id != ?",
                [categoryId, name, subcategoryId || 0]
            );

            if (existing) {
                App.showAlert("Já existe uma subcategoria com esse nome nesta categoria.", "warning");
                return;
            }

            if (subcategoryId) {
                // UPDATE: Atualiza o nome da subcategoria existente
                await DatabaseManager.execute(
                    "UPDATE subcategories SET name = ? WHERE id = ?",
                    [name, subcategoryId]
                );
                App.showAlert("Subcategoria atualizada com sucesso!", "success");
            } else {
                // INSERT: Cria uma nova subcategoria
                await DatabaseManager.execute(
                    "INSERT INTO subcategories (category_id, name) VALUES (?, ?)",
                    [categoryId, name]
                );
                App.showAlert("Subcategoria cadastrada com sucesso!", "success");
            }

            this.closeModal();
            this.render(); // Recarrega a tabela
        } catch (error) {
            console.error("Erro ao salvar subcategoria:", error);
            App.showAlert("Erro ao salvar subcategoria no banco de dados.", "danger");
        }
    },

    /**
     * Remove uma subcategoria do banco de dados após confirmação.
     */
    async deleteSubcategory(id, name) {
        if (!confirm(`Deseja realmente excluir a subcategoria "${name}"?`)) return;

        try {
            await DatabaseManager.execute("DELETE FROM subcategories WHERE id = ?", [id]);
            App.showAlert("Subcategoria removida com sucesso!", "success");
            this.render(); // Recarrega a tabela
        } catch (error) {
            console.error("Erro ao deletar subcategoria:", error);
            App.showAlert("Erro ao remover subcategoria.", "danger");
        }
    }
};

// Inicializa a tela de categorias quando o arquivo for carregado
document.addEventListener("DOMContentLoaded", () => {
    CategoriesScreen.init();
});