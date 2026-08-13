/* Eventos e operações da tela de investimentos. */
const InvestmentsScreen = {
    
    // Inicializa os botões da tela de investimentos
    init() {
        // botão de abertura do modal
        document.getElementById('openInvestmentModal')?.addEventListener('click', () => this.openModal());
        // Botão de fechamento do modal
        document.querySelectorAll('#investmentModal .close-modal').forEach(button => {
            button.addEventListener('click', () => this.closeModal());
        });
        // botão de submissão do formulário
        document.getElementById('investmentForm')?.addEventListener('submit', event => this.submit(event));
    },

    // Função de abertura do modal
    openModal() {
        document.getElementById('investmentForm')?.reset();
        FinanceCore.toggleModal('investmentModal', true);
    },

    // função de fechamento do modal
    closeModal() {
        FinanceCore.toggleModal('investmentModal', false);
    },

    // função de submissão do formulário
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

    // função de exclusão de registro
    async delete(id) {
        const account = FinanceCore.currentAccount();
        if (!account) return;

        account.investments = account.investments.filter(investment => investment.id != id);
        await FinanceCore.save();
        App.refresh();
    },

    // Renderização da tabela
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
