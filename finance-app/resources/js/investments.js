/* Eventos e operações da tela de investimentos. */
const InvestmentsScreen = {
    init() {
        document.getElementById('openInvestmentModal')?.addEventListener('click', () => this.openModal());
        document.querySelectorAll('#investmentModal .close-modal').forEach(button => {
            button.addEventListener('click', () => this.closeModal());
        });
        document.getElementById('investmentForm')?.addEventListener('submit', event => this.submit(event));
    },

    openModal() {
        document.getElementById('investmentForm')?.reset();
        FinanceCore.toggleModal('investmentModal', true);
    },

    closeModal() {
        FinanceCore.toggleModal('investmentModal', false);
    },

    async submit(event) {
        event.preventDefault();
        const account = FinanceCore.currentAccount();
        if (!account) return;

        account.investments.push({
            id: Date.now(),
            value: Number(document.getElementById('investmentValue').value) || 0,
            type: document.getElementById('investmentType').value.trim(),
            member: document.getElementById('investmentMember').value.trim(),
            date: new Date().toISOString()
        });

        await FinanceCore.save();
        this.closeModal();
        App.refresh();
    },

    async delete(id) {
        const account = FinanceCore.currentAccount();
        if (!account) return;

        account.investments = account.investments.filter(investment => investment.id != id);
        await FinanceCore.save();
        App.refresh();
    },

    render() {
        const body = document.querySelector('#investmentTable tbody');
        if (!body) return;

        const investments = FinanceCore.investments(FinanceCore.currentAccount());
        body.innerHTML = investments.map(investment => `
            <tr>
                <td>${investment.member || '-'}</td>
                <td>${investment.type || '-'}</td>
                <td>${FinanceCore.formatCurrency(investment.value)}</td>
                <td>${new Date(investment.date).toLocaleDateString('pt-BR')}</td>
                <td>
                    <button class="action-btn" onclick="App.deleteInvestment(${investment.id})">
                        <i class="ph ph-trash"></i>
                    </button>
                </td>
            </tr>
        `).join('');
    }
};
