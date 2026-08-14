/* Navegação entre as sections já carregadas no DOM. */
const Navigation = {
    init() {
        document.querySelectorAll('.nav-item').forEach(item => {
            item.addEventListener('click', event => {
                event.preventDefault();
                this.show(item.dataset.section);
            });
        });
    },

    show(sectionId) {
        document.querySelectorAll('.content-section').forEach(section => section.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(item => item.classList.remove('active'));
        document.getElementById(sectionId)?.classList.add('active');
        document.querySelector(`[data-section="${sectionId}"]`)?.classList.add('active');

        if (sectionId === 'dashboard') DashboardScreen.refresh();
        if (sectionId === 'accounts') AccountsScreen.render();
        if (sectionId === 'periods') PeriodsScreen.render();
        if (sectionId === 'cashbook') CashbookScreen.render();
    }
};
