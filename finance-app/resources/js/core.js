/* Estado, persistência e utilitários compartilhados do aplicativo. */
const FinanceCore = {
    storageKey: 'finance_data',
    data: null,

    createInitialData() {
        const today = new Date().toISOString().split('T')[0];
        return {
            accounts: {
                default: {
                    id: 'default',
                    name: 'Principal',
                    icon: 'ph-bank',
                    color: 'indigo',
                    isActive: true,
                    entries: [],
                    investments: []
                }
            },
            currentAccount: 'default',
            periods: [{
                id: 'current',
                name: 'Período Atual',
                description: '',
                startDate: today,
                endDate: null,
                isOpen: true,
                closeDescription: '',
                createdAt: new Date().toISOString()
            }],
            currentPeriod: 'current',
            categories: [
                { id: 'essentials', name: 'Essenciais', subcategories: [] },
                { id: 'lifestyle', name: 'Estilo de Vida', subcategories: [] },
                { id: 'other', name: 'Outros', subcategories: [] }
            ]
        };
    },

    async load() {
        try {
            const content = await Neutralino.storage.getData(this.storageKey);
            const data = JSON.parse(content);
            if (!data || !data.accounts || !data.periods) throw new Error('Dados inválidos');
            data.categories = Array.isArray(data.categories) ? data.categories : [
                { id: 'essentials', name: 'Essenciais', subcategories: [] },
                { id: 'lifestyle', name: 'Estilo de Vida', subcategories: [] },
                { id: 'other', name: 'Outros', subcategories: [] }
            ];
            Object.values(data.accounts).forEach(account => {
                account.entries = Array.isArray(account.entries) ? account.entries : [];
                account.investments = Array.isArray(account.investments) ? account.investments : [];
            });
            this.data = data;
        } catch {
            this.data = this.createInitialData();
            await this.save();
        }
        return this.data;
    },

    async save() {
        await Neutralino.storage.setData(this.storageKey, JSON.stringify(this.data, null, 2));
    },

    currentAccount() {
        return this.data.accounts[this.data.currentAccount];
    },

    accounts() {
        return Object.values(this.data.accounts);
    },

    entries(account = this.currentAccount()) {
        return account?.entries || [];
    },

    incomes(account) {
        return this.entries(account).filter(entry => entry.type === 'income');
    },

    expenses(account) {
        return this.entries(account).filter(entry => entry.type === 'expense');
    },

    investments(account) {
        return account?.investments || [];
    },

    formatCurrency(value) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(value || 0);
    },

    setText(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    },

    toggleModal(id, show) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.toggle('active', show);
    },

    today() {
        return new Date().toISOString().split('T')[0];
    },

    getCurrentPeriod() {
        return this.data.periods.find(period => period.id === this.data.currentPeriod);
    }
};

const StorageManager = {
    init: () => FinanceCore.load(),
    load: () => Promise.resolve(FinanceCore.data),
    save: () => FinanceCore.save(),
    createNewDataStructure: () => FinanceCore.createInitialData()
};
