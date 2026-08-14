/**
 * ============================================================================
 * MAIN.JS - CONTROLADOR PRINCIPAL DO APLICATIVO
 * ============================================================================
 * Este arquivo atua como o orquestrador do sistema.
 * Responsável por:
 * 1. Inicializar o ciclo de vida do app (Neutralino, Banco de Dados, UI).
 * 2. Gerenciar a navegação global através do Navigation.
 * 3. Prover funções utilitárias compartilhadas (Formatação, Modais, Notificações).
 */

const App = {
    /**
     * Ponto de entrada. Inicializa todas as dependências e componentes.
     */
    async init() {
        try {
            console.log("Iniciando carregamento do aplicativo...");

            // 1. Carrega os arquivos de tela dinâmicos (se houver o gerenciador visual)
            if (typeof ScreenLoadingManager !== 'undefined') {
                await ScreenLoadingManager.loadAll();
            }

            // 2. Conecta e estrutura o banco de dados SQLite
            await DatabaseManager.init();

            // 3. Inicializa o controle de rotas/navegação
            Navigation.init((sectionId) => this.handleRoutePageChange(sectionId));

            // 4. Registra eventos nativos da janela e botões globais
            this.registerGlobalEvents();

            // 5. Atualiza elementos visuais fixos
            this.updateCurrentDate();

            // 6. Renderiza a tela inicial / ativa
            this.handleRoutePageChange('dashboard');

            console.log("Aplicativo inicializado com sucesso!");
        } catch (error) {
            console.error("Falha na inicialização do aplicativo:", error);
            this.showAlert("Erro ao iniciar a aplicação. Verifique o console.", "danger");
        } finally {
            // Remove a tela de carregamento (splash screen)
            this.hideSplashScreen();
        }
    },

    /**
     * Registra eventos nativos do Neutralino e elementos fixos da interface.
     */
    registerGlobalEvents() {
        // Evento acionado ao fechar a janela da aplicação
        Neutralino.events.on('windowClose', () => {
            Neutralino.app.exit();
        });

        // Alternador de tema (Claro / Escuro)
        const themeBtn = document.getElementById('themeToggle');
        if (themeBtn && typeof ThemeManager !== 'undefined') {
            themeBtn.addEventListener('click', () => ThemeManager.toggle());
        }
    },

    /**
     * Função executada sempre que a rota (tela) do aplicativo é alterada.
     * @param {string} sectionId - Nome da seção para a qual o usuário navegou.
     */
    handleRoutePageChange(sectionId) {
        console.log(`Navegou para a seção: ${sectionId}`);
        // Os módulos de tela (AccountsScreen, CategoriesScreen, etc)
        // escutarão esse evento no futuro para recarregar seus dados.

        // Chama a renderização da tela correspondente
        if ((sectionId === 'category' || sectionId === 'categories') && typeof CategoriesScreen !== 'undefined') {
            CategoriesScreen.render();
        }
    },

    // ========================================================================
    // FUNÇÕES UTILITÁRIAS COMPARTILHADAS (DISPONÍVEIS PARA TODO O APP)
    // ========================================================================

    /**
     * Formata um número para o padrão monetário brasileiro (R$).
     * @param {number} value - Valor numérico (ex: 1250.50)
     * @returns {string} Texto formatado (ex: "R$ 1.250,50")
     */
    formatCurrency(value) {
        return new Intl.NumberFormat("pt-BR", {
            style: "currency",
            currency: "BRL",
        }).format(value || 0);
    },

    /**
     * Define o texto de um elemento do DOM de forma segura.
     * @param {string} elementId - ID do elemento HTML.
     * @param {string} text - Texto a ser inserido.
     */
    setText(elementId, text) {
        const element = document.getElementById(elementId);
        if (element) element.textContent = text;
    },

    /**
     * Abre ou fecha um Modal adicionando/removendo a classe 'active'.
     * @param {string} modalId - ID da div do modal no HTML.
     * @param {boolean} show - True para abrir, False para fechar.
     */
    toggleModal(modalId, show) {
        const modal = document.getElementById(modalId);
        if (modal) modal.classList.toggle("active", show);
    },

    /**
     * Exibe um aviso/notificação na tela para o usuário (Alert / Toast).
     * @param {string} message - Mensagem a ser exibida.
     * @param {string} type - Tipo da mensagem: 'success', 'danger', 'info', 'warning'.
     */
    showAlert(message, type = "info") {
        // Implementação simplificada de aviso (pode ser customizada no futuro)
        console.log(`[AVISO - ${type.toUpperCase()}]: ${message}`);
        
        const alertBox = document.getElementById('global-alert');
        if (alertBox) {
            alertBox.textContent = message;
            alertBox.className = `alert alert-${type} show`;
            setTimeout(() => alertBox.classList.remove('show'), 4000);
        }
    },

    /**
     * Retorna a data atual no formato padrão ISO (AAAA-MM-DD).
     */
    getTodayDate() {
        return new Date().toISOString().split("T")[0];
    },

    /**
     * Atualiza o cabeçalho com a data atual formatada por extenso.
     */
    updateCurrentDate() {
        const currentDate = new Date().toLocaleString('pt-BR', { month: 'long', year: 'numeric' });
        this.setText('currentDate', currentDate.charAt(0).toUpperCase() + currentDate.slice(1));
    },

    /**
     * Esconde a tela de carregamento (Splash Screen) com um efeito de fade out.
     */
    hideSplashScreen() {
        const splash = document.getElementById('splash-screen');
        if (!splash) return;
        setTimeout(() => {
            splash.classList.add('fade-out');
            setTimeout(() => splash.remove(), 800);
        }, 600);
    }
};

// Inicializa a API do Neutralino e logo em seguida inicia o App
Neutralino.init();
App.init();