/* Inicialização do aplicativo e fachada de compatibilidade dos botões HTML. */
const App = {
    get data() {
        return FinanceCore.data;
    },

    async init() {
        try {
            await ScreenLoadingManager.loadAll();
            await ThemeManager.init();
            await FinanceCore.load();
            this.registerGlobalEvents();
            Navigation.init();
            EntriesScreen.init();
            InvestmentsScreen.init();
            CategoriesScreen.init();
            DashboardScreen.init();
            AccountsScreen.init();
            PeriodsScreen.init();
            CashbookScreen.init();
            this.refresh();
            this.updateCurrentDate();
        } catch (error) {
            console.error('Erro ao inicializar o aplicativo:', error);
        } finally {
            this.hideSplashScreen();
        }
    },

    registerGlobalEvents() {
        document.getElementById('themeToggle')?.addEventListener('click', () => ThemeManager.toggle());
        document.getElementById('printCashbookBtn')?.addEventListener('click', () => CashbookScreen.print());
        Neutralino.events.on('windowClose', () => Neutralino.app.exit());
    },

    refresh() {
        this.populateAccountFilters();
        DashboardScreen.refresh();
        InvestmentsScreen.render();
        CategoriesScreen.render();
        AccountsScreen.render();
        PeriodsScreen.render();
        CashbookScreen.render();
    },

    populateAccountFilters() {
        const filter = document.getElementById('dashboardAccountFilter');
        if (!filter) return;
        const selected = filter.value;
        filter.innerHTML = '<option value="all">Todas as Contas</option>' + FinanceCore.accounts().map(account => `<option value="${account.id}">${account.name}</option>`).join('');
        filter.value = selected || 'all';
    },

    switchSection(id) { Navigation.show(id); },
    toggleModal(id, show) { FinanceCore.toggleModal(id, show); },
    deleteItem(type, id) {
        return type === 'investment' ? InvestmentsScreen.delete(id) : EntriesScreen.delete(type, id);
    },
    deleteInvestment(id) { return InvestmentsScreen.delete(id); },
    deleteCategory(id) { return CategoriesScreen.delete(id); },
    translateCategory(category) { return { essentials: 'Essenciais', lifestyle: 'Estilo de Vida', other: 'Outros' }[category] || category || '-'; },
    openEditAccountModal(id) { AccountsScreen.openEdit(id); },
    toggleAccountActive(id) { return AccountsScreen.toggleActive(id); },
    promptDeleteAccount(id) { AccountsScreen.promptDelete(id); },
    activatePeriod(id) { return PeriodsScreen.activate(id); },
    promptDeletePeriod(id) { PeriodsScreen.promptDelete(id); },
    deleteCashbookEntry(accountId, entryId) { return CashbookScreen.delete(accountId, entryId); },
    printCashbook() { CashbookScreen.print(); },

    updateCurrentDate() {
        const currentDate = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        FinanceCore.setText('currentDate', currentDate.charAt(0).toUpperCase() + currentDate.slice(1));
    },

    hideSplashScreen() {
        const splash = document.getElementById('splash-screen');
        if (!splash) return;
        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => splash.remove(), 800);
        }, 800);
    }
};

Neutralino.init();
App.init();
