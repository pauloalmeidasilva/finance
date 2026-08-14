/* Tela Livro Caixa: filtros, lançamentos, resumo e impressão. */
const CashbookScreen = {

    // Inicializa os botões e interações da tela
    init() {
        document.getElementById('openCashbookModal')?.addEventListener('click', () => this.openForm());
        document.getElementById('printCashbookBtn')?.addEventListener('click', () => this.print());
        document.querySelectorAll('.close-cashbook-modal').forEach(button => button.addEventListener('click', () => FinanceCore.toggleModal('cashbookModal', false)));
        document.getElementById('cashbookForm')?.addEventListener('submit', event => this.save(event));
        ['cashbookPeriodFilter', 'cashbookAccountFilter', 'cashbookTypeFilter', 'cashbookCategoryFilter'].forEach(id => {
            document.getElementById(id)?.addEventListener('change', () => this.render());
        });
    },


    render() {
        const periodId = document.getElementById('cashbookPeriodFilter')?.value || FinanceCore.data.currentPeriod;
        const accountId = document.getElementById('cashbookAccountFilter')?.value || 'all';
        const type = document.getElementById('cashbookTypeFilter')?.value || 'all';
        const category = document.getElementById('cashbookCategoryFilter')?.value || 'all';
        const accounts = accountId === 'all' ? FinanceCore.accounts() : [FinanceCore.data.accounts[accountId]].filter(Boolean);
        let entries = accounts.flatMap(account => FinanceCore.entries(account)
            .filter(entry => entry.periodId === periodId)
            .map(entry => ({ ...entry, accountId: account.id, accountName: account.name })));

        if (type !== 'all') entries = entries.filter(entry => entry.type === type);
        if (category !== 'all') entries = entries.filter(entry => entry.category === category);
        entries.sort((a, b) => new Date(a.date) - new Date(b.date));

        let income = 0;
        let expense = 0;
        let balance = 0;
        const body = document.querySelector('#cashbookTable tbody');
        if (!body) return;

        body.innerHTML = entries.length ? entries.map(entry => {
            const isIncome = entry.type === 'income';
            if (isIncome) {
                income += entry.value;
                balance += entry.value;
            } else {
                expense += entry.value;
                balance -= entry.value;
            }
            return `<tr>
                <td>${new Date(entry.date).toLocaleDateString('pt-BR')}</td>
                <td>${entry.accountName}</td>
                <td>${isIncome ? 'Entrada' : 'Saída'}</td>
                <td>${App.translateCategory(entry.category)}</td>
                <td>${entry.description}</td>
                <td>${isIncome ? FinanceCore.formatCurrency(entry.value) : '-'}</td>
                <td>${!isIncome ? FinanceCore.formatCurrency(entry.value) : '-'}</td>
                <td>${FinanceCore.formatCurrency(balance)}</td>
                <td><button class="icon-btn" onclick="App.deleteCashbookEntry('${entry.accountId}', '${entry.id}')"><i class="ph ph-trash"></i></button></td>
            </tr>`;
        }).join('') : '<tr><td colspan="9">Nenhum registro encontrado</td></tr>';

        FinanceCore.setText('cashbookTotalIncome', `+ ${FinanceCore.formatCurrency(income)}`);
        FinanceCore.setText('cashbookTotalExpense', `- ${FinanceCore.formatCurrency(expense)}`);
        FinanceCore.setText('cashbookBalance', FinanceCore.formatCurrency(income - expense));
        this.populateFilters();
    },

    populateFilters() {
        const period = document.getElementById('cashbookPeriodFilter');
        if (period) {
            const value = period.value;
            period.innerHTML = FinanceCore.data.periods.map(item => `<option value="${item.id}">${item.name}</option>`).join('');
            period.value = value || FinanceCore.data.currentPeriod;
        }
        const account = document.getElementById('cashbookAccountFilter');
        if (account) {
            const value = account.value;
            account.innerHTML = '<option value="all">Todas as Contas</option>' + FinanceCore.accounts().map(item => `<option value="${item.id}">${item.name}</option>`).join('');
            account.value = value || 'all';
        }
    },

    openForm() {
        document.getElementById('cashbookForm').reset();
        document.getElementById('cashbookDate').value = FinanceCore.today();
        this.populateSelects();
        FinanceCore.toggleModal('cashbookModal', true);
    },

    populateSelects() {
        const period = document.getElementById('cashbookPeriod');
        if (period) period.innerHTML = FinanceCore.data.periods.filter(item => item.isOpen).map(item => `<option value="${item.id}">${item.name}</option>`).join('');
        const account = document.getElementById('cashbookAccount');
        if (account) account.innerHTML = FinanceCore.accounts().filter(item => item.isActive).map(item => `<option value="${item.id}">${item.name}</option>`).join('');
    },

    async save(event) {
        event.preventDefault();
        const periodId = document.getElementById('cashbookPeriod').value;
        const accountId = document.getElementById('cashbookAccount').value;
        const period = FinanceCore.data.periods.find(item => item.id === periodId);
        if (!period?.isOpen) return alert('O período selecionado está encerrado.');
        const account = FinanceCore.data.accounts[accountId];
        account.entries.push({
            id: Date.now(),
            type: document.getElementById('cashbookType').value,
            value: Number(document.getElementById('cashbookValue').value) || 0,
            description: document.getElementById('cashbookDescription').value.trim(),
            category: document.getElementById('cashbookCategory').value,
            notes: document.getElementById('cashbookNotes').value.trim(),
            periodId,
            date: document.getElementById('cashbookDate').value,
            createdAt: new Date().toISOString()
        });
        await FinanceCore.save();
        FinanceCore.toggleModal('cashbookModal', false);
        App.refresh();
    },

    async delete(accountId, entryId) {
        if (!confirm('Deseja deletar este registro?')) return;
        const account = FinanceCore.data.accounts[accountId];
        account.entries = account.entries.filter(entry => entry.id != entryId);
        await FinanceCore.save();
        App.refresh();
    },

    print() {
        window.print();
    }
};
