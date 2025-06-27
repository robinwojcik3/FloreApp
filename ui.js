(function() {
    // --- Initialisation des composants UI (Notifications, Modals, Spinner) ---
    // Cette partie est un utilitaire générique pour l'interface.
    const style = document.createElement('style');
    style.textContent = `
        #notification-container { position: fixed; top: 1rem; right: 1rem; z-index: 2000; display: flex; flex-direction: column; align-items: flex-end; }
        .notification { padding: 10px 15px; margin-top: .5rem; border-radius: 4px; color: #fff; box-shadow: 0 2px 6px rgba(0,0,0,.3); font-family: system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
        .notification.success { background: #4caf50; }
        .notification.error { background: #e53935; }
        #modal-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,.6); display: none; align-items: center; justify-content: center; z-index: 3000; padding: 1rem; }
        #modal-overlay.show { display: flex; }
        #modal-overlay .modal-content { background: var(--card, #fff); color: var(--text, #000); padding: 1rem 1.5rem; border-radius: 6px; max-width: 500px; width: 100%; }
        #modal-overlay .modal-close { float: right; cursor: pointer; background: none; border: none; font-size: 1.5rem; }
        #spinner-overlay { position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(255,255,255,.7); display: none; align-items: center; justify-content: center; z-index: 4000; }
        #spinner-overlay.show { display: flex; }
        #spinner-overlay .spinner { border: 4px solid #f3f3f3; border-top: 4px solid #4caf50; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; }
        @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
    `;
    document.head.appendChild(style);

    document.addEventListener('DOMContentLoaded', () => {
        const savedTheme = localStorage.getItem('theme') || 'dark';
        document.documentElement.setAttribute('data-theme', savedTheme);

        const notificationContainer = document.createElement('div');
        notificationContainer.id = 'notification-container';
        document.body.appendChild(notificationContainer);

        const modalOverlay = document.createElement('div');
        modalOverlay.id = 'modal-overlay';
        modalOverlay.innerHTML = '<div class="modal-content"><button class="modal-close" aria-label="Fermer">&times;</button><div class="modal-body"></div></div>';
        document.body.appendChild(modalOverlay);
        modalOverlay.querySelector('.modal-close').addEventListener('click', () => modalOverlay.classList.remove('show'));

        const spinnerOverlay = document.createElement("div");
        spinnerOverlay.id = "spinner-overlay";
        spinnerOverlay.innerHTML = '<div class="spinner"></div>';
        document.body.appendChild(spinnerOverlay);

        const themeToggle = document.createElement('button');
        themeToggle.id = 'theme-toggle';
        themeToggle.className = 'theme-toggle';
        themeToggle.textContent = savedTheme === 'light' ? '🌞' : '🌙';
        themeToggle.addEventListener('click', () => {
            const current = document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark';
            document.documentElement.setAttribute('data-theme', current);
            localStorage.setItem('theme', current);
            themeToggle.textContent = current === 'light' ? '🌞' : '🌙';
        });
        const nav = document.querySelector('.tabs-container');
        if (nav) nav.appendChild(themeToggle);

    });

    window.showNotification = function(message, type = 'info') {
        const container = document.getElementById('notification-container');
        if (!container) return;
        const notificationDiv = document.createElement('div');
        notificationDiv.className = 'notification ' + (type === 'error' ? 'error' : 'success');
        notificationDiv.textContent = message;
        container.appendChild(notificationDiv);
        setTimeout(() => notificationDiv.remove(), 4000);
    };

    window.showModal = function(message) {
        const overlay = document.getElementById('modal-overlay');
        if (!overlay) return;
        overlay.querySelector('.modal-body').textContent = message;
        overlay.classList.add('show');
    };
    
    window.toggleSpinner = function(show) {
        const spinner = document.getElementById("spinner-overlay");
        if (spinner) spinner.classList.toggle("show", !!show);
    };

    /**
     * Affiche les résultats de la recherche dans le conteneur principal.
     * @param {Array} speciesList - La liste des espèces à afficher.
     * @param {Array} floraGallicaToc - La table des matières de Flora Gallica.
     */
    window.displayResults = function(speciesList, floraGallicaToc) {
        // ... (code original non modifié)
    };

})();
