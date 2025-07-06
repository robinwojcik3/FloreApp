document.addEventListener('DOMContentLoaded', async () => {
    document.querySelectorAll('.subtab').forEach(btn => {
        btn.addEventListener('click', () => {
            document.querySelectorAll('.subtab').forEach(b => b.classList.remove('active'));
            document.querySelectorAll('.subtab-content').forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            const target = document.getElementById(btn.dataset.target);
            if (target) target.classList.add('active');
        });
    });

    await loadData();

    const stored = localStorage.getItem('comparisonSpeciesData');
    let speciesData = [];
    if (stored) {
        try { speciesData = JSON.parse(stored); } catch(e) { speciesData = []; }
    }

    const speciesNames = speciesData.map(s => s.species).join(',');
    const iframe = document.getElementById('map-iframe');
    if (iframe) {
        iframe.src = `carte_interactive/map_view.html?species=${encodeURIComponent(speciesNames)}`;
    }

    const resultsDiv = document.getElementById('comparison-results');
    if (!resultsDiv) return;

    if (speciesData.length < 2) {
        resultsDiv.innerHTML = '<p>Sélectionnez au moins deux espèces pour la comparaison.</p>';
        return;
    }

    resultsDiv.innerHTML = '<i>Analyse en cours...</i>';
    const comparisonText = await getComparisonFromGemini(speciesData);
    const { intro, tableMarkdown, summary } = parseComparisonText(comparisonText);
    const tableHtml = markdownTableToHtml(tableMarkdown);
    resultsDiv.innerHTML = `
        <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">
            <h2 style="margin:0;color:var(--primary);">Analyse Comparative des Espèces</h2>
        </div>
        <hr style="border:none;border-top:1px solid var(--border);margin:1rem 0;">
        <div id="comparison-table-content"><p>${intro}</p>${tableHtml}</div>
        <div id="comparison-summary" style="margin-top:1rem;display:flex;align-items:flex-start;gap:0.5rem;">
            <p id="comparison-summary-text" style="margin:0;">${summary}</p>
            <a href="#" id="comparison-tts-btn" title="Écouter la synthèse" style="flex-shrink:0;">
                <img src="assets/Audio.png" alt="Écouter" class="logo-icon" style="height:32px;">
            </a>
        </div>`;

    document.getElementById('comparison-tts-btn').addEventListener('click', async (e) => {
        e.preventDefault();
        const btn = e.currentTarget;
        const textEl = document.getElementById('comparison-summary-text');
        if (!textEl) return;
        btn.innerHTML = '<i>...</i>';
        btn.style.pointerEvents = 'none';
        const audioData = await synthesizeSpeech(textEl.innerText);
        if (audioData) {
            playAudioFromBase64(audioData);
        } else {
            showInfoModal('Échec de la synthèse audio', "La conversion du texte en audio a échoué.");
        }
        btn.innerHTML = '<img src="assets/Audio.png" alt="Écouter" class="logo-icon" style="height:32px;">';
        btn.style.pointerEvents = 'auto';
    });
});
