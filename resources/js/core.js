/* Estado, persistência SQLite e utilitários compartilhados do aplicativo. */
const FinanceCore = {
    databaseName: "finance.db",
    database: null,
    data: null,

    schema: `
        PRAGMA foreign_keys = ON;
        CREATE TABLE IF NOT EXISTS settings (
            key TEXT PRIMARY KEY,
            value TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS accounts (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            icon TEXT,
            color TEXT,
            is_active INTEGER NOT NULL DEFAULT 1
        );

        CREATE TABLE IF NOT EXISTS periods (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            description TEXT,
            start_date TEXT NOT NULL,
            end_date TEXT,
            is_open INTEGER NOT NULL DEFAULT 1,
            close_description TEXT,
            created_at TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS categories (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS subcategories (
            id INTEGER PRIMARY KEY AUTOINCREMENT,
            category_id TEXT NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
            name TEXT NOT NULL
        );

        CREATE TABLE IF NOT EXISTS entries (
            id INTEGER PRIMARY KEY,
            account_id TEXT NOT NULL REFERENCES accounts(id) ON DELETE CASCADE,
            period_id TEXT REFERENCES periods(id) ON DELETE SET NULL,
            type TEXT NOT NULL,
            value REAL NOT NULL DEFAULT 0,
            description TEXT,
            category TEXT,
            notes TEXT,
            date TEXT NOT NULL,
            created_at TEXT NOT NULL
        );
    `,

    async load() {
        const SQL = await initSqlJs({ locateFile: (file) => `js/${file}` });
        const path = `${window.NL_DATAPATH || "."}/${this.databaseName}`;
        let bytes;
        try {
            bytes = new Uint8Array(
                await Neutralino.filesystem.readBinaryFile(path),
            );
        } catch {
            bytes = null;
        }
        this.database = bytes ? new SQL.Database(bytes) : new SQL.Database();
        this.database.run(this.schema);
        const stored = this.readRelationalData();
        this.data = stored;

        return this.data;
    },

    async save() {
        if (!this.database) throw new Error("Banco de dados não inicializado");
        const db = this.database;
        db.run("BEGIN");
        try {
            [
                "settings",
                "subcategories",
                "entries",
                "investments",
                "categories",
                "periods",
                "accounts",
            ].forEach((table) => db.run(`DELETE FROM ${table}`));
            db.run("INSERT INTO settings VALUES (?, ?), (?, ?)", [
                "current_account",
                this.data.currentAccount,
                "current_period",
                this.data.currentPeriod,
            ]);
            this.accounts().forEach((account) => {
                db.run("INSERT INTO accounts VALUES (?, ?, ?, ?, ?)", [
                    account.id,
                    account.name,
                    account.icon || "",
                    account.color || "",
                    account.isActive ? 1 : 0,
                ]);
                (account.entries || []).forEach((entry) =>
                    db.run(
                        "INSERT INTO entries VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)",
                        [
                            entry.id,
                            account.id,
                            entry.periodId || null,
                            entry.type,
                            entry.value || 0,
                            entry.description || "",
                            entry.category || "",
                            entry.notes || "",
                            entry.date,
                            entry.createdAt || entry.date,
                        ],
                    ),
                );
                (account.investments || []).forEach((item) =>
                    db.run(
                        "INSERT INTO investments VALUES (?, ?, ?, ?, ?, ?)",
                        [
                            item.id,
                            account.id,
                            item.value || 0,
                            item.type || "",
                            item.member || "",
                            item.date,
                        ],
                    ),
                );
            });
            this.data.periods.forEach((period) =>
                db.run("INSERT INTO periods VALUES (?, ?, ?, ?, ?, ?, ?, ?)", [
                    period.id,
                    period.name,
                    period.description || "",
                    period.startDate,
                    period.endDate || null,
                    period.isOpen ? 1 : 0,
                    period.closeDescription || "",
                    period.createdAt,
                ]),
            );
            this.data.categories.forEach((category) => {
                db.run("INSERT INTO categories VALUES (?, ?)", [
                    category.id,
                    category.name,
                ]);
                (Array.isArray(category.subcategories)
                    ? category.subcategories
                    : []
                ).forEach((name) =>
                    db.run(
                        "INSERT INTO subcategories (category_id, name) VALUES (?, ?)",
                        [category.id, name],
                    ),
                );
            });
            db.run("COMMIT");
        } catch (error) {
            db.run("ROLLBACK");
            throw error;
        }
        const bytes = this.database.export();
        await Neutralino.filesystem.writeBinaryFile(
            `${window.NL_DATAPATH || "."}/${this.databaseName}`,
            bytes,
        );
    },

    readState() {
        const result = this.database.exec(
            'SELECT value FROM app_state WHERE key = "finance"',
        );
        if (!result.length || !result[0].values.length) return null;
        return this.normalizeData(JSON.parse(result[0].values[0][0]));
    },

    readRelationalData() {
        const rows = (sql) => this.database.exec(sql)[0]?.values || [];
        const accounts = rows(
            "SELECT id, name, icon, color, is_active FROM accounts",
        );
        if (!accounts.length) return null;
        const data = {
            accounts: {},
            periods: [],
            categories: [],
            currentAccount: "default",
            currentPeriod: "current",
        };
        rows("SELECT key, value FROM settings").forEach(
            ([key, value]) =>
                (data[
                    key === "current_account"
                        ? "currentAccount"
                        : "currentPeriod"
                ] = value),
        );
        accounts.forEach(([id, name, icon, color, active]) => {
            data.accounts[id] = {
                id,
                name,
                icon,
                color,
                isActive: !!active,
                entries: [],
                investments: [],
            };
        });
        rows(
            "SELECT id, name, description, start_date, end_date, is_open, close_description, created_at FROM periods",
        ).forEach((row) =>
            data.periods.push({
                id: row[0],
                name: row[1],
                description: row[2],
                startDate: row[3],
                endDate: row[4],
                isOpen: !!row[5],
                closeDescription: row[6],
                createdAt: row[7],
            }),
        );
        const categories = {};
        rows("SELECT id, name FROM categories").forEach(
            ([id, name]) => (categories[id] = { id, name, subcategories: [] }),
        );
        rows("SELECT category_id, name FROM subcategories").forEach(
            ([id, name]) => categories[id]?.subcategories.push(name),
        );
        data.categories = Object.values(categories);
        rows(
            "SELECT id, account_id, period_id, type, value, description, category, notes, date, created_at FROM entries",
        ).forEach((row) => {
            const [
                id,
                accountId,
                periodId,
                type,
                value,
                description,
                category,
                notes,
                date,
                createdAt,
            ] = row;
            data.accounts[accountId]?.entries.push({
                id,
                periodId,
                type,
                value,
                description,
                category,
                notes,
                date,
                createdAt,
            });
        });
        rows(
            "SELECT id, account_id, value, type, member, date FROM investments",
        ).forEach(([id, accountId, value, type, member, date]) =>
            data.accounts[accountId]?.investments.push({
                id,
                value,
                type,
                member,
                date,
            }),
        );
        return this.normalizeData(data);
    },

    normalizeData(data) {
        if (!data?.accounts || !data?.periods)
            throw new Error("Dados inválidos");
        data.categories = Array.isArray(data.categories)
            ? data.categories
            : this.createInitialData().categories;
        data.categories.forEach((category) => {
            category.subcategories = Array.isArray(category.subcategories)
                ? category.subcategories
                : category.subcategories
                  ? [category.subcategories]
                  : [];
        });
        Object.values(data.accounts).forEach((account) => {
            account.entries = Array.isArray(account.entries)
                ? account.entries
                : [];
            account.investments = Array.isArray(account.investments)
                ? account.investments
                : [];
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
        return this.entries(account).filter((entry) => entry.type === "income");
    },

    expenses(account) {
        return this.entries(account).filter(
            (entry) => entry.type === "expense",
        );
    },

    formatCurrency(value) {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value || 0);
    },

    setText(id, text) {
        const element = document.getElementById(id);
        if (element) element.textContent = text;
    },

    toggleModal(id, show) {
        const modal = document.getElementById(id);
        if (modal) modal.classList.toggle("active", show);
    },

    today() {
        return new Date().toISOString().split("T")[0];
    },

    getCurrentPeriod() {
        return this.data.periods.find(
            (period) => period.id === this.data.currentPeriod,
        );
    },
};

const StorageManager = {
    init: () => FinanceCore.load(),
    load: () => Promise.resolve(FinanceCore.data),
    save: () => FinanceCore.save(),
    createNewDataStructure: () => FinanceCore.createInitialData(),
};
