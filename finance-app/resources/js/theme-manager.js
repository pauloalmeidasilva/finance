/* Controla o tema visual e sua preferência persistida. */
const ThemeManager = {
    storageKey: 'theme_preference',

    async init() {
        let theme = 'dark-mode';
        try {
            theme = await Neutralino.storage.getData(this.storageKey) || this.systemTheme();
        } catch {
            theme = this.systemTheme();
        }
        this.apply(theme);
    },

    systemTheme() {
        return window.matchMedia?.('(prefers-color-scheme: light)').matches ? 'light-mode' : 'dark-mode';
    },

    apply(theme) {
        document.body.className = theme;
        const icon = document.querySelector('#themeToggle i');
        if (icon) icon.className = theme === 'dark-mode' ? 'ph ph-moon' : 'ph ph-sun';
    },

    async toggle() {
        const theme = document.body.className === 'dark-mode' ? 'light-mode' : 'dark-mode';
        await Neutralino.storage.setData(this.storageKey, theme);
        this.apply(theme);
    }
};
