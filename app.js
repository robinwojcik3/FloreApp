// --- Globals ---
const API_KEY = "your-plantnet-key"; // Remplacez par votre clé
const PROJECT = "all";
const ENDPOINT = `https://my-api.plantnet.org/v2/identify/${PROJECT}?api-key=${API_KEY}`;
const GEMINI_API_KEY = "your-gemini-key"; // Remplacez par votre clé
const TTS_API_KEY = "your-text-to-speech-key"; // Remplacez par votre clé

let taxref = {};
let ecology = {};
let floraGallicaToc = {};
let floreAlpesIndex = {};
let criteres = {};
let physionomie = {};
let regalVegetalToc = {};
let floreMedToc = {}; // NOUVEAU: Variable pour la table des matières de Flore Méd

let cdRef = (name) => taxref[name];
let ecolOf = (name) => ecology[norm(name)];
let trigramIndex = {};

// --- Helper functions ---
const norm = (str) => str.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]/g, '');
const makeTrigram = (name) => name.toLowerCase().split(/\s+/).reduce((acc, part) => {
    if (part === 'subsp.' || part === 'var.') return acc + 'subsp';
    return acc + part.slice(0, 3);
}, '');

function makeTimestampedName(originalName) {
    const now = new Date();
    const f = (n) => String(n).padStart(2, '0');
    const timestamp = `${now.getFullYear()}-${f(now.getMonth()+1)}-${f(now.getDate())} ${f(now.getHours())}h${f(now.getMinutes())}`;
    const safeName = originalName.replace(/:/g, '_');
    return `${safeName} ${timestamp}.jpg`;
}


// --- DOM manipulation ---
function getById(id){ return document.getElementById(id); }

// --- Service Worker and Data Loading ---
document.addEventListener('DOMContentLoaded', () => {
    loadData().then(() => {
        setupEventListeners();
        getById('multi-file-input').value = '';
        getById('file-capture').value = '';
        console.log("Données et événements chargés.");
    }).catch(error => {
        console.error("Erreur critique lors du chargement des données :", error);
        showNotification("Erreur de chargement des données essentielles.", "error");
    });
});

async function loadData() {
    toggleSpinner(true);
    try {
        const responses = await Promise.all([
            fetch('taxref.json'), fetch('ecology.json'),
            fetch('assets/flora_gallica_toc.json'), fetch('assets/florealpes_index.json'),
            fetch('Criteres_herbier.json'), fetch('Physionomie.json'),
            fetch('assets/regal_vegetal_toc.json'),
            fetch('assets/flore_med_toc.json') // NOUVEAU: Chargement du JSON de Flore Méd
        ]);

        for (const res of responses) {
            if (!res.ok) throw new Error(`Échec du chargement de ${res.url}`);
        }

        [taxref, ecology, floraGallicaToc, floreAlpesIndex, criteres, physionomie, regalVegetalToc, floreMedToc] = await Promise.all(responses.map(res => res.json()));

        // Index trigram
        trigramIndex = Object.keys(taxref).reduce((acc, name) => {
            const trigram = makeTrigram(name);
            if (!acc[trigram]) acc[trigram] = [];
            acc[trigram].push(name);
            return acc;
        }, {});

        // Index physionomie et critères
        const criteriaData = criteres;
        criteres = criteriaData.reduce((acc, item) => {
            acc[norm(item.species)] = item.description;
            return acc;
        }, {});

        const physionomieData = physionomie;
        physionomie = physionomieData.reduce((acc, item) => {
            acc[norm(item.nom_latin)] = item.physionomie;
            return acc;
        }, {});

    } finally {
        toggleSpinner(false);
    }
}

// --- Event Listeners Setup ---
function setupEventListeners() {
    getById('file-capture').addEventListener('change', handleFileSelect);
    getById('multi-file-input').addEventListener('change', handleMultiFileSelect);
    getById('name-search-button').addEventListener('click', handleNameSearch);
    getById('name-search-input').addEventListener('input', handleNameInput);
    getById('name-search-input').addEventListener('keydown', (e) => {
        if (e.key === 'Enter') handleNameSearch();
    });

    const multiImageIdentifyBtn = getById('multi-image-identify-button');
    if(multiImageIdentifyBtn) {
        multiImageIdentifyBtn.addEventListener('click', () => identifyImages(window.imageFiles || []));
    }
    document.body.addEventListener('click', (e) => {
        if (e.target.classList.contains('text-popup-trigger')) {
            const text = e.target.getAttribute('data-full-text');
            showModal(text);
        } else if (e.target.closest('.popup-overlay')) {
            e.target.closest('.popup-overlay').style.display = 'none';
        } else if (e.target.classList.contains('copy-latin-name')) {
            const name = e.target.getAttribute('data-latin-name');
            navigator.clipboard.writeText(name).then(() => showNotification(`"${name}" copié dans le presse-papiers`));
        }
    });

    // Synthesis Modal
    const synthesisModal = getById('synthesis-modal');
    getById('synthesis-modal-close').addEventListener('click', () => synthesisModal.style.display = 'none');
    getById('synthesis-play-btn').addEventListener('click', () => {
        const text = getById('synthesis-modal-body').textContent;
        synthesizeSpeech(text);
    });

    // Image Modal
    const imageModal = getById('image-modal');
    getById('image-modal-close').addEventListener('click', () => imageModal.style.display = 'none');
}

// --- Image Handling and Identification ---
function handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
        document.body.classList.remove('home');
        window.location.href = `organ.html?image=${URL.createObjectURL(file)}`;
    }
}

function handleMultiFileSelect(event) {
    const files = Array.from(event.target.files);
    if (files.length > 0) {
        window.imageFiles = files; // Stocker les fichiers pour l'identification
        displayMultiImageSelector(files);
        getById('multi-image-identify-button').style.display = 'block';
    }
}

function displayMultiImageSelector(files) {
    const section = getById('multi-image-section');
    const listArea = getById('multi-image-list-area');
    section.style.display = 'block';
    listArea.innerHTML = ''; // Vider la liste précédente

    files.forEach((file, index) => {
        const fileItem = document.createElement('div');
        fileItem.className = 'image-organ-item';
        fileItem.innerHTML = `
            <span class="file-info"><span class="file-index">${index + 1}.</span> ${file.name}</span>
            <select data-file-index="${index}">
                <option value="auto" selected>Auto</option>
                <option value="flower">Fleur</option>
                <option value="leaf">Feuille</option>
                <option value="fruit">Fruit</option>
                <option value="bark">Écorce</option>
                <option value="other">Autre</option>
            </select>
            <button class="delete-file-btn" data-file-index="${index}">×</button>
        `;
        listArea.appendChild(fileItem);
    });

    listArea.querySelectorAll('.delete-file-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const indexToRemove = parseInt(e.target.getAttribute('data-file-index'), 10);
            window.imageFiles.splice(indexToRemove, 1); // Retirer le fichier de la liste
            displayMultiImageSelector(window.imageFiles); // Rafraîchir l'affichage
        });
    });
}

async function identifyImages(files, organs = []) {
    if (files.length === 0) {
        showNotification("Aucune image à identifier.", "error");
        return;
    }
    document.body.classList.remove('home');
    toggleSpinner(true);

    const formData = new FormData();
    files.forEach((file, index) => {
        formData.append('images', file, makeTimestampedName(file.name));
        const organSelect = document.querySelector(`select[data-file-index="${index}"]`);
        formData.append('organs', organSelect ? organSelect.value : 'auto');
    });

    try {
        const response = await fetch(ENDPOINT, { method: 'POST', body: formData });
        if (!response.ok) throw new Error(`Erreur réseau: ${response.statusText}`);
        const data = await response.json();
        displayResultsInTable(data);
    } catch (error) {
        console.error("Erreur d'identification:", error);
        showNotification("L'identification a échoué. Veuillez réessayer.", "error");
    } finally {
        toggleSpinner(false);
    }
}


// --- Name Search ---
async function handleNameSearch() {
    const input = getById('name-search-input');
    const query = input.value.trim();
    if (!query) return;

    toggleSpinner(true);
    document.body.classList.remove('home');
    getById('results').innerHTML = '';

    try {
        let results = [];
        const trigramQuery = makeTrigram(query);
        const directMatch = trigramIndex[trigramQuery];

        if (directMatch) {
            results = directMatch;
        } else {
            const suggestions = await taxrefFuzzyMatch(query);
            if (suggestions.length > 0) {
                results = suggestions.slice(0, 5).map(s => s.nom_complet);
            }
        }

        if (results.length > 0) {
            const data = {
                results: results.map(name => ({
                    score: 1,
                    species: { scientificNameWithoutAuthor: name, scientificName: name },
                    gbif: { id: null, name: name }
                }))
            };
            displayResultsInTable(data);
        } else {
            showNotification('Aucune espèce trouvée pour ce nom.');
            getById('results').innerHTML = '<p>Aucun résultat.</p>';
        }
    } catch (error) {
        console.error("Erreur de recherche par nom:", error);
        showNotification("La recherche a échoué.", "error");
    } finally {
        toggleSpinner(false);
    }
}

async function handleNameInput(event) {
    const input = event.target;
    const query = input.value;
    const datalist = getById('species-suggestions');

    if (query.length < 3) {
        datalist.innerHTML = '';
        return;
    }

    const trigramQuery = makeTrigram(query);
    const matches = Object.keys(trigramIndex).filter(k => k.startsWith(trigramQuery)).flatMap(k => trigramIndex[k]);

    datalist.innerHTML = matches.slice(0, 10).map(name => `<option value="${name}"></option>`).join('');
}

// --- API Calls ---
async function taxrefFuzzyMatch(name) {
    const url = `https://taxref.mnhn.fr/api/taxa/fuzzyMatch?term=${encodeURIComponent(name)}&page=1&size=5`;
    const response = await fetch(url);
    if (!response.ok) return [];
    const data = await response.json();
    return data?._embedded?.taxa || [];
}

async function getSynthesisFromGemini(plantName) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `Fournis une description botanique concise (150 mots maximum) pour ${plantName}, en te concentrant sur les critères d'identification clés (feuilles, fleurs, fruits, tige) et l'habitat typique. Le ton doit être technique et direct.`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!response.ok) throw new Error('Erreur API Gemini');
    const data = await response.json();
    return data.candidates[0].content.parts[0].text;
}

async function synthesizeSpeech(text) {
    toggleSpinner(true);
    const url = `https://texttospeech.googleapis.com/v1/text:synthesize?key=${TTS_API_KEY}`;
    try {
        const response = await fetch(url, {
            method: 'POST',
            body: JSON.stringify({
                input: { text },
                voice: { languageCode: 'fr-FR', name: 'fr-FR-Wavenet-D' },
                audioConfig: { audioEncoding: 'MP3' }
            })
        });
        if (!response.ok) throw new Error('Erreur API Text-to-Speech');
        const data = await response.json();
        const audio = new Audio(`data:audio/mp3;base64,${data.audioContent}`);
        audio.play();
    } catch (error) {
        console.error("Erreur de synthèse vocale:", error);
        showNotification("La synthèse vocale a échoué.", "error");
    } finally {
        toggleSpinner(false);
    }
}

// --- Display Results ---
function displayResultsInTable(data) {
    const resultsDiv = getById('results');
    resultsDiv.innerHTML = ''; // Clear previous results
    if (!data.results || data.results.length === 0) {
        resultsDiv.innerHTML = '<table><tbody><tr><td>Aucun résultat concluant.</td></tr></tbody></table>';
        return;
    }

    const table = document.createElement('table');
    // MODIFIÉ: Ajout de la colonne "Flore Méd"
    table.innerHTML = `
        <thead>
            <tr>
                <th>Image</th>
                <th>Nom Latin & Score</th>
                <th>Critères Physio.</th>
                <th>Écologie</th>
                <th>Physionomie</th>
                <th>FloreAlpes</th>
                <th>Flora Gallica</th>
                <th>Régal Végétal</th>
                <th>Flore Méd</th>
                <th>Cartes</th>
            </tr>
        </thead>
        <tbody></tbody>
    `;
    const tbody = table.querySelector('tbody');

    if (data.results.length === 0) {
        // MODIFIÉ: Le colspan passe de 9 à 10
        tbody.innerHTML = `<tr><td colspan="10">Aucun résultat concluant.</td></tr>`;
        resultsDiv.appendChild(table);
        return;
    }

    data.results.forEach(result => {
        const species = result.species;
        const score = (result.score * 100).toFixed(1);
        const latinName = species.scientificNameWithoutAuthor;
        const cdNom = cdRef(latinName);
        const ecologyInfo = ecolOf(latinName) || 'N/A';
        const normalizedName = norm(latinName);
        const criteresInfo = criteres[normalizedName] || 'N/A';
        const physionomieInfo = physionomie[normalizedName] || 'N/A';
        const genus = (species.scientificName || '').split(' ')[0].toLowerCase();

        // FloreAlpes Link
        const faEntry = floreAlpesIndex[latinName];
        let faLink = 'N/A';
        if (faEntry) {
            faLink = `<a href="https://www.florealpes.com/fiche_${faEntry.file}.php" target="_blank"><img src="assets/FloreAlpes.png" alt="FloreAlpes" class="small-logo"></a>`;
        }

        // Flora Gallica Link
        const fgEntry = floraGallicaToc[genus];
        let fgLink = 'N/A';
        if (fgEntry) {
            const url = `viewer.html?file=assets/flora_gallica_pdfs/${fgEntry.pdfFile}&page=${fgEntry.page}`;
            fgLink = `<a href="${url}" target="_blank"><img src="assets/Flora Gallica.png" alt="Flora Gallica" class="small-logo"></a>`;
        }

        // Régal Végétal Link
        const rvEntry = regalVegetalToc[genus];
        let rvLink = 'N/A';
        if (rvEntry) {
            const url = `viewer.html?file=assets/regal_vegetal_pdf/${rvEntry.pdfFile}&page=${rvEntry.page}`;
            rvLink = `<a href="${url}" target="_blank"><img src="assets/Régal Végétal.png" alt="Régal Végétal" class="small-logo"></a>`;
        }
        
        // NOUVEAU: Logique pour le lien "Flore Méd"
        const fmEntry = floreMedToc[genus];
        let fmLink = 'N/A';
        if (fmEntry) {
            // Assurez-vous que le nom du fichier PDF est correct et que le chemin est bon.
            const url = `viewer.html?file=assets/flore_med_pdf/${fmEntry.pdfFile}&page=${fmEntry.page}`;
            // Assurez-vous d'avoir une icône "Flore Med.png" dans le dossier assets.
            fmLink = `<a href="${url}" target="_blank"><img src="assets/Flore Med.png" alt="Flore Méd" class="small-logo"></a>`;
        }

        const mapsLink = cdNom ?
            `<a href="https://inpn.mnhn.fr/espece/cd_nom/${cdNom}" target="_blank"><img src="assets/INPN.png" alt="INPN" class="small-logo"></a>
             <a href="https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${cdNom}" target="_blank"><img src="assets/Biodiv'AURA.png" alt="Biodiv'AURA" class="small-logo"></a>` : 'N/A';

        const row = document.createElement('tr');
        row.innerHTML = `
            <td>
                ${result.images ? `<img src="${result.images[0].url.m}" alt="${latinName}" style="width: 80px; border-radius: 4px;">` : ''}
                <button class="image-btn" data-cd-nom="${cdNom}">Voir Images</button>
            </td>
            <td class="copy-latin-name" data-latin-name="${latinName}" title="Cliquer pour copier">
                ${latinName}<br><small class="score">Score: ${score}%</small>
            </td>
            <td class="text-popup-trigger" data-full-text="${criteresInfo}">${criteresInfo}</td>
            <td class="text-popup-trigger" data-full-text="${ecologyInfo}">${ecologyInfo}</td>
            <td class="text-popup-trigger" data-full-text="${physionomieInfo}">${physionomieInfo}</td>
            <td>${faLink}</td>
            <td>${fgLink}</td>
            <td>${rvLink}</td>
            <td>${fmLink}</td> 
            <td>${mapsLink}</td>
        `;
        tbody.appendChild(row);
    });

    resultsDiv.appendChild(table);

    // Attach event listeners for dynamic content
    document.querySelectorAll('.image-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const cdNom = btn.getAttribute('data-cd-nom');
            if (cdNom) showImagesInModal(cdNom);
        });
    });

    if (data.results.length === 1) {
        const singleSpeciesName = data.results[0].species.scientificNameWithoutAuthor;
        createSimilarSpeciesButton(singleSpeciesName, resultsDiv);
    }
}

// --- Modal and Dynamic UI ---
async function showImagesInModal(cdNom) {
    toggleSpinner(true);
    const modal = getById('image-modal');
    const gallery = getById('image-modal-gallery');
    gallery.innerHTML = '';
    try {
        const response = await fetch(`/.netlify/functions/aura-images?cd=${cdNom}`);
        if (!response.ok) throw new Error('Failed to fetch images');
        const { images } = await response.json();
        if (images.length > 0) {
            images.forEach(src => {
                const img = document.createElement('img');
                img.src = src;
                gallery.appendChild(img);
            });
            modal.style.display = 'flex';
        } else {
            showNotification("Aucune image disponible pour cette espèce sur l'Atlas AURA.", "info");
        }
    } catch (error) {
        console.error("Image loading error:", error);
        showNotification("Erreur lors du chargement des images.", "error");
    } finally {
        toggleSpinner(false);
    }
}

function createSimilarSpeciesButton(speciesName, container) {
    const btnArea = getById('similar-btn-area');
    btnArea.innerHTML = ''; // Clear previous button
    const button = document.createElement('button');
    button.id = 'similar-btn';
    button.textContent = `Chercher espèces similaires à ${speciesName}`;
    button.onclick = async () => {
        toggleSpinner(true);
        try {
            const similarSpecies = await getSimilarSpeciesFromGemini(speciesName);
            if (similarSpecies.length > 0) {
                getById('name-search-input').value = similarSpecies.join(', ');
                await handleNameSearch();
            } else {
                showNotification('Aucune espèce similaire trouvée.');
            }
        } catch (error) {
            console.error("Similar species search failed:", error);
            showNotification("La recherche d'espèces similaires a échoué.", "error");
        } finally {
            toggleSpinner(false);
        }
    };
    btnArea.appendChild(button);
}

async function getSimilarSpeciesFromGemini(plantName) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${GEMINI_API_KEY}`;
    const prompt = `Liste jusqu'à cinq espèces du même genre que "${plantName}" qui peuvent être confondues avec elle en France (région Rhône-Alpes ou PACA). Réponds uniquement avec les noms scientifiques latins, séparés par des virgules. N'ajoute aucun texte supplémentaire.`;
    const response = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
    });
    if (!response.ok) throw new Error('Erreur API Gemini (similar)');
    const data = await response.json();
    const text = data.candidates[0].content.parts[0].text;
    return text.replace(/\*/g, '').split(',').map(s => s.trim()).filter(Boolean);
}
