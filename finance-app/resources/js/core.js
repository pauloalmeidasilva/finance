/* Estado, persistência SQLite e utilitários compartilhados do aplicativo. */
const FinanceCore = {
    databaseName: 'finance.sqlite',
    legacyStorageKey: 'finance_data',
    database: null,
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
        const SQL = await initSqlJs({ locateFile: file => `js/${file}` });
        const path = `${window.NL_DATAPATH || '.'}/${this.databaseName}`;
        let bytes;
        try { bytes = new Uint8Array(await Neutralino.filesystem.readBinaryFile(path)); } catch { bytes = null; }
        this.database = bytes ? new SQL.Database(bytes) : new SQL.Database();
        this.database.run('CREATE TABLE IF NOT EXISTS app_state (key TEXT PRIMARY KEY, value TEXT NOT NULL)');
        const stored = this.readState();
        if (stored) this.data = stored;
        else {
            this.data = await this.readLegacyData() || this.createInitialData();
            await this.save();
        }
        return this.data;
    },

    async save() {
        if (!this.database) throw new Error('Banco de dados não inicializado');
        this.database.run('INSERT OR REPLACE INTO app_state (key, value) VALUES (?, ?)', ['finance', JSON.stringify(this.data)]);
        const bytes = this.database.export();
        await Neutralino.filesystem.writeBinaryFile(`${window.NL_DATAPATH || '.'}/${this.databaseName}`, bytes);
    },

    readState() {
        const result = this.database.exec('SELECT value FROM app_state WHERE key = "finance"');
        if (!result.length || !result[0].values.length) return null;
        return this.normalizeData(JSON.parse(result[0].values[0][0]));
    },

    async readLegacyData() {
        try {
            const content = await Neutralino.storage.getData(this.legacyStorageKey);
            return this.normalizeData(JSON.parse(content));
        } catch { return null; }
    },

    normalizeData(data) {
        if (!data?.accounts || !data?.periods) throw new Error('Dados inválidos');
        data.categories = Array.isArray(data.categories) ? data.categories : this.createInitialData().categories;
        Object.values(data.accounts).forEach(account => {
            account.entries = Array.isArray(account.entries) ? account.entries : [];
            account.investments = Array.isArray(account.investments) ? account.investments : [];
        });
        return data;
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
