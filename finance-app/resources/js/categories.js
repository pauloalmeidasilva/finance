/* Eventos e operações da tela de categorias. */

// Essas categorias são fixas e não podem ser alteradas pelo usuário, mas são usadas para organizar as transações.
const categories = {
    income: {
        name: "Receitas",
        percent: 100,
    },
    essentials: {
        name: "Despesas Necessárias",
        percent: 50,
    },
    lifestyle: {
        name: "Despesas Eventuais",
        percent: 35,
    },
    investments: {
        name: "Investimentos",
        percent: 15,
    },
};

const CategoriesScreen = {
    init() {
        document
            .getElementById("openCategoryModal")
            ?.addEventListener("click", () => this.openModal());
        document
            .querySelectorAll("#categoryModal .close-modal")
            .forEach((button) => {
                button.addEventListener("click", () => this.closeModal());
            });
        document
            .getElementById("categoryForm")
            ?.addEventListener("submit", (event) => this.submit(event));
        document
            .querySelector("#categoryTable tbody")
            ?.addEventListener("click", (event) =>
                this.handleTableClick(event),
            );
    },

    openModal() {
        document.getElementById("categoryForm")?.reset();
        FinanceCore.toggleModal("categoryModal", true);
    },

    closeModal() {
        FinanceCore.toggleModal("categoryModal", false);
    },

    async submit(event) {
        event.preventDefault();
        const form = event.currentTarget;
        const name = document.getElementById("categoryName").value;
        const subcategory = document
            .getElementById("categorySubcategories")
            .value.trim();

        if (!name) return;

        const editingId = form.dataset.editId;
        if (
            FinanceCore.data.categories.some(
                (category) =>
                    category.id !== editingId &&
                    (Array.isArray(category.subcategories)
                        ? category.subcategories
                        : [category.subcategories].filter(Boolean)
                    ).some(
                        (sub) =>
                            sub.toLowerCase() === subcategory.toLowerCase(),
                    ),
            )
        ) {
            alert("Já existe uma subcategoria com esse nome.");
            return;
        }

        const category = editingId
            ? FinanceCore.data.categories.find((item) => item.id === editingId)
            : null;
        if (category) {
            category.name = name;
            category.subcategories = subcategory ? [subcategory] : [];
        } else {
            FinanceCore.data.categories.push({
                id: `category_${Date.now()}`,
                name,
                subcategories: subcategory ? [subcategory] : [],
            });
        }
        delete form.dataset.editId;
        await FinanceCore.save();
        this.closeModal();
        App.refresh();
    },

    async delete(id) {
        FinanceCore.data.categories = FinanceCore.data.categories.filter(
            (category) => category.id !== id,
        );
        await FinanceCore.save();
        App.refresh();
    },

    update(id) {
        const category = FinanceCore.data.categories.find(
            (item) => item.id === id,
        );
        const form = document.getElementById("categoryForm");
        if (!category || !form) return;

        document.getElementById("categoryName").value = category.name;
        document.getElementById("categorySubcategories").value = Array.isArray(
            category.subcategories,
        )
            ? category.subcategories.join(", ")
            : category.subcategories || "";
        form.dataset.editId = id;
        FinanceCore.toggleModal("categoryModal", true);
    },

    handleTableClick(event) {
        const button = event.target.closest("button[id]");
        if (!button) return;
        const [action, ...idParts] = button.id.split("-");
        const id = idParts.join("-");
        if (action === "update") this.update(id);
        if (action === "delete") this.delete(id);
    },

    // Renderiza a tabela de categorias na tela.
    render() {
        const body = document.querySelector("#categoryTable tbody");
        if (!body) return;

        body.innerHTML = FinanceCore.data.categories
            .sort((a, b) => {
                const nameA = categories[a.name]?.name || "";
                const nameB = categories[b.name]?.name || "";

                return nameA.localeCompare(nameB, "pt-BR");
            })
            .map((category) => {
                const subcategories = Array.isArray(category.subcategories)
                    ? category.subcategories
                    : [category.subcategories].filter(Boolean);
                return `
            <tr>
                <td>${categories[category.name]?.name}</td>
                <td>${subcategories.join(", ") || "-"}</td>
                <td>
                    <button class="action-btn" id="update-${category.id}">
                        <i class="ph ph-pencil"></i>
                    </button>
                    <button class="action-btn" id="delete-${category.id}">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>
        `;
            })
            .join("");
    },
};
