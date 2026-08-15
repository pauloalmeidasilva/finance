/**
 * ============================================================================
 * NAVIGATION.JS - GERENCIADOR DE ROTAS E TELAS
 * ============================================================================
 * Este módulo é responsável por alternar a visibilidade das seções da interface.
 * Ele modifica as classes CSS ativas no menu de navegação e nos contêineres de tela.
 */

const Navigation = {
    /**
     * Inicializa os escutadores de clique nos itens de menu.
     * @param {Function} onPageChangeCallback - Função chamada quando a página muda (para atualizar dados).
     */
    init(onPageChangeCallback) {
        this.onPageChange = onPageChangeCallback;

        // Seleciona todos os botões do menu que tenham o atributo data-section
        const navItems = document.querySelectorAll('.nav-item');
        
        navItems.forEach(item => {
            item.addEventListener('click', (event) => {
                event.preventDefault();
                const targetSection = item.dataset.section;
                this.navigateTo(targetSection);
            });
        });
    },

    /**
     * Altera a tela visível no aplicativo.
     * @param {string} sectionId - ID da seção HTML a ser exibida (ex: 'dashboard', 'accounts').
     */
    navigateTo(sectionId) {
        if (!sectionId) return;

        // 1. Remove a classe 'active' de todas as seções para escondê-las
        document.querySelectorAll('.content-section').forEach(section => {
            section.classList.remove('active');
        });

        // 2. Remove a classe 'active' de todos os itens do menu
        document.querySelectorAll('.nav-item').forEach(item => {
            item.classList.remove('active');
        });

        // 3. Ativa a seção e o item de menu correspondente ao ID informado
        const targetSection = document.getElementById(sectionId);
        const targetNavItem = document.querySelector(`[data-section="${sectionId}"]`);

        if (targetSection) targetSection.classList.add('active');
        if (targetNavItem) targetNavItem.classList.add('active');

        // 4. Notifica o aplicativo de que a rota mudou (útil para atualizar dados da tela)
        if (typeof this.onPageChange === 'function') {
            this.onPageChange(sectionId);
        }
    }
};