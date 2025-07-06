function showTab(name) {
    const isCarac = name === 'carac';
    document.getElementById('carac-content').style.display = isCarac ? 'block' : 'none';
    document.getElementById('loc-content').style.display = isCarac ? 'none' : 'block';
    document.getElementById('tab-carac').classList.toggle('active', isCarac);
    document.getElementById('tab-loc').classList.toggle('active', !isCarac);
    if (isCarac) {
        loadComparisonResults();
    } else {
        const frame = document.getElementById('map-frame');
        if (frame && frame.contentWindow && typeof frame.contentWindow.focusSearchArea === 'function') {
            frame.contentWindow.focusSearchArea();
        }
    }
}

const SPEAKER_ICON = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" class="logo-icon" style="height:32px;"><path d="M3 9v6h4l5 5V4L7 9H3z"/><path d="M14 3.23v2.06c2.89.86 5 3.54 5 6.71s-2.11 5.85-5 6.71v2.06c4.01-1 7-4.69 7-8.77s-2.99-7.77-7-8.77z"/></svg>';

let comparisonLoaded = false;
async function loadComparisonResults() {
    if (comparisonLoaded) return;
    comparisonLoaded = true;
    const stored = localStorage.getItem('comparisonData');
    if (!stored) return;
    try {
        const speciesData = JSON.parse(stored);
        if (Array.isArray(speciesData) && speciesData.length) {
            const comparisonText = await getComparisonFromGemini(speciesData);
            const { intro, tableMarkdown, summary } = parseComparisonText(comparisonText);
            const tableHtml = markdownTableToHtml(tableMarkdown);
            const container = document.getElementById('comparison-results-container');
            container.style.display = 'block';
            container.style.cssText = `
                margin-top: 2rem;
                padding: 1.5rem;
                background: var(--card, #ffffff);
                border: 1px solid var(--border, #e0e0e0);
                border-radius: 8px;
                box-shadow: 0 2px 6px rgba(0,0,0,.05);
            `;
            container.innerHTML = `
                <div style="display:flex;align-items:center;justify-content:space-between;gap:1rem;">
                    <h2 style="margin:0;color:var(--primary,#388e3c);">Analyse Comparative des Espèces</h2>
                </div>
                <hr style="border:none;border-top:1px solid var(--border,#e0e0e0);margin:1rem 0;">
                <div id="comparison-table-content"><p>${intro}</p>${tableHtml}</div>
                <div id="comparison-summary" style="margin-top:1rem;display:flex;align-items:flex-start;gap:0.5rem;">
                    <p id="comparison-summary-text" style="margin:0;">${summary}</p>
                    <a href="#" id="comparison-tts-btn" title="Écouter la synthèse" style="flex-shrink:0;">
                        ${SPEAKER_ICON}
                    </a>
                </div>`;
            document.getElementById('comparison-tts-btn').addEventListener('click', async (e) => {
                e.preventDefault();
                const btn = e.currentTarget;
                const textElement = document.getElementById('comparison-summary-text');
                if (!textElement) return;
                const textToSynthesize = textElement.innerText;
                btn.innerHTML = '<i>...</i>';
                btn.style.pointerEvents = 'none';
                const audioData = await synthesizeSpeech(textToSynthesize);
                if (audioData) {
                    playAudioFromBase64(audioData);
                } else {
                    showInfoModal("Échec de la synthèse audio", "La conversion du texte en audio a échoué.");
                }
                btn.innerHTML = SPEAKER_ICON;
                btn.style.pointerEvents = 'auto';
            });
        }
    } catch(e) {
        console.error('Impossible de traiter les données de comparaison', e);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const speciesParam = params.get('species');
    if (speciesParam) {
        const frame = document.getElementById('map-frame');
        frame.src = 'carte_interactive/map_view.html?species=' + encodeURIComponent(speciesParam);
    }
    showTab('loc');
});
