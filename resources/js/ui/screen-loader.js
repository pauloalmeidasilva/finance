/* Carrega as telas HTML dentro do container principal. */
const ScreenLoadingManager = {
    screens: ['dashboard', 'cashbook', 'accounts', 'category', 'about'],

    async loadAll() {
        const container = document.getElementById('main-container');
        if (!container) return;
        container.innerHTML = '';

        for (const screen of this.screens) {
            try {
                const response = await fetch(`screens/${screen}.html`);
                if (!response.ok) throw new Error(`HTTP ${response.status}`);
                const wrapper = document.createElement('div');
                wrapper.innerHTML = (await response.text()).trim();
                while (wrapper.firstChild) container.appendChild(wrapper.firstChild);
            } catch (error) {
                console.error(`Não foi possível carregar a tela ${screen}:`, error);
            }
        }
    }
};
