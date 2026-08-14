/* Eventos e operações de receitas e despesas. */
const EntriesScreen = {
    init() {
        document.getElementById('openIncomeModal')?.addEventListener('click', () => FinanceCore.toggleModal('incomeModal', true));
        document.getElementById('openExpenseModal')?.addEventListener('click', () => FinanceCore.toggleModal('expenseModal', true));
        document.querySelectorAll('#incomeModal .close-modal, #expenseModal .close-modal').forEach(button => {
            button.addEventListener('click', () => {
                FinanceCore.toggleModal('incomeModal', false);
                FinanceCore.toggleModal('expenseModal', false);
            });
        });

        document.getElementById('incomeForm')?.addEventListener('submit', event => this.submitIncome(event));
        document.getElementById('expenseForm')?.addEventListener('submit', event => this.submitExpense(event));
    },

    async submitIncome(event) {
        event.preventDefault();
        const account = FinanceCore.currentAccount();
        account.entries.push({
            id: Date.now(), type: 'income',
            value: Number(document.getElementById('incomeValue').value) || 0,
            description: document.getElementById('incomeType').value.trim(),
            category: 'other',
            notes: document.getElementById('incomeMember').value.trim(),
            periodId: FinanceCore.data.currentPeriod,
            date: new Date().toISOString(), createdAt: new Date().toISOString()
        });
        await FinanceCore.save();
        event.target.reset();
        FinanceCore.toggleModal('incomeModal', false);
        App.refresh();
    },

    async submitExpense(event) {
        event.preventDefault();
        const account = FinanceCore.currentAccount();
        account.entries.push({
            id: Date.now(), type: 'expense',
            value: Number(document.getElementById('expenseValue').value) || 0,
            description: document.getElementById('expenseType').value.trim(),
            category: document.getElementById('expenseCategory').value || 'other',
            notes: `${document.getElementById('expenseMember').value.trim()} @ ${document.getElementById('expenseLocation').value.trim()}`,
            periodId: FinanceCore.data.currentPeriod,
            date: new Date().toISOString(), createdAt: new Date().toISOString()
        });
        await FinanceCore.save();
        event.target.reset();
        FinanceCore.toggleModal('expenseModal', false);
        App.refresh();
    },

    async delete(type, id) {
        const account = FinanceCore.currentAccount();
        account.entries = account.entries.filter(item => item.id != id);
        await FinanceCore.save();
        App.refresh();
    },

    renderTables() {
        const account = FinanceCore.currentAccount();
        const incomeBody = document.querySelector('#incomeTable tbody');
        const expenseBody = document.querySelector('#expenseTable tbody');
        if (incomeBody) incomeBody.innerHTML = FinanceCore.incomes(account).map(item => `<tr><td>${item.notes || '-'}</td><td>${item.description || '-'}</td><td>${FinanceCore.formatCurrency(item.value)}</td><td>${new Date(item.date).toLocaleDateString('pt-BR')}</td><td><button class="action-btn" onclick="App.deleteItem('income', ${item.id})"><i class="ph ph-trash"></i></button></td></tr>`).join('');
        if (expenseBody) expenseBody.innerHTML = FinanceCore.expenses(account).map(item => `<tr><td>${item.notes || '-'}</td><td>${item.description || '-'}</td><td>${App.translateCategory(item.category)}</td><td>${FinanceCore.formatCurrency(item.value)}</td><td>${new Date(item.date).toLocaleDateString('pt-BR')}</td><td><button class="action-btn" onclick="App.deleteItem('expense', ${item.id})"><i class="ph ph-trash"></i></button></td></tr>`).join('');
    }
};
