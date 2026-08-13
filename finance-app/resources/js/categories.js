/* Eventos e operações da tela de categorias. */
const CategoriesScreen = {
    init() {
        document.getElementById('openCategoryModal')?.addEventListener('click', () => this.openModal());
        document.querySelectorAll('#categoryModal .close-modal').forEach(button => {
            button.addEventListener('click', () => this.closeModal());
        });
        document.getElementById('categoryForm')?.addEventListener('submit', event => this.submit(event));
    },

    openModal() {
        document.getElementById('categoryForm')?.reset();
        FinanceCore.toggleModal('categoryModal', true);
    },

    closeModal() {
        FinanceCore.toggleModal('categoryModal', false);
    },

    async submit(event) {
        event.preventDefault();
        const name = document.getElementById('categoryName').value.trim();
        const subcategories = document.getElementById('categorySubcategories').value
            .split(',')
            .map(item => item.trim())
            .filter(Boolean);

        if (!name) return;
        if (FinanceCore.data.categories.some(category => category.name.toLowerCase() === name.toLowerCase())) {
            alert('Já existe uma categoria com esse nome.');
            return;
        }

        FinanceCore.data.categories.push({
            id: `category_${Date.now()}`,
            name,
            subcategories
        });
        await FinanceCore.save();
        this.closeModal();
        App.refresh();
    },

    async delete(id) {
        FinanceCore.data.categories = FinanceCore.data.categories.filter(category => category.id !== id);
        await FinanceCore.save();
        App.refresh();
    },

    render() {
        const body = document.querySelector('#categoryTable tbody');
        if (!body) return;

        body.innerHTML = FinanceCore.data.categories.map(category => `
            <tr>
                <td>${category.name}</td>
                <td>${category.subcategories.join(', ') || '-'}</td>
                <td>
                    <button class="action-btn" onclick="App.deleteCategory('${category.id}')">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
};
