/* ================================================================
    CONFIGURATION GÉNÉRALE
    ================================================================ */
const MAX_RESULTS = 5;
const MAX_MULTI_IMAGES = 5;
const PROXY_ENDPOINT = '/.netlify/functions/api-proxy';

/* ================================================================
    INITIALISATION ET GESTION DES DONNÉES
    ================================================================ */
let taxref = {};
let taxrefNames = [];
let trigramIndex = {};
let nameTrigram = {};
let ecology = {};
let floraToc = {};
let regalVegetalToc = {};
let floreMedToc = {}; // Variable pour la table des matières de Flore Méd
let floreAlpesIndex = {};
let criteres = {};
let physionomie = {};
let phenologie = {};
let userLocation = { latitude: 45.188529, longitude: 5.724524 };

let displayedItems = [];
let statusData = {};

let dataPromise = null;
function loadData() {
  if (dataPromise) return dataPromise;
  dataPromise = Promise.all([
    fetch("taxref.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => {
      taxrefNames.push(k);
      taxref[norm(k)] = v;
      const tri = makeTrigram(k);
      nameTrigram[k] = tri;
      if (!trigramIndex[tri]) trigramIndex[tri] = [];
      trigramIndex[tri].push(k);
    })),
    fetch("ecology.json").then(r => r.json()).then(j => Object.entries(j).forEach(([k,v]) => ecology[norm(k.split(';')[0])] = v)),
    fetch("assets/flora_gallica_toc.json").then(r => r.json()).then(j => floraToc = j),
    fetch("assets/regal_vegetal_toc.json").then(r => r.json()).then(j => regalVegetalToc = j),
    fetch("assets/flore_med_toc.json").then(r => r.json()).then(j => floreMedToc = j), // Chargement de la TOC de Flore Méd
    fetch("assets/florealpes_index.json").then(r => r.json()).then(j => floreAlpesIndex = j),
    fetch("Criteres_herbier.json").then(r => r.json()).then(j => j.forEach(item => criteres[norm(item.species)] = item.description)),
    fetch("Physionomie.csv").then(r => r.text()).then(t => parseCsv(t).forEach(row => {
      const [name, desc] = row;
      if (name) physionomie[norm(name)] = desc;
    })),
    fetch("Phenologie.csv").then(r => r.text()).then(t => parseCsv(t).forEach(row => {
      const [name, phen] = row;
      if (name) phenologie[norm(name)] = phen;
    }))
  ]).then(() => { taxrefNames.sort(); console.log("Données prêtes."); })
    .catch(err => {
      dataPromise = null;
      showNotification("Erreur chargement des données: " + err.message, 'error');
    });
  return dataPromise;
}


/* ================================================================
    FONCTIONS UTILITAIRES ET HELPERS
    ================================================================ */
function norm(txt) {
  if (typeof txt !== 'string') return "";
  return txt.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().trim().replace(/\s+/g, "");
}
function makeTrigram(name) {
  const tokens = name.toLowerCase().split(/\s+/);
  if (tokens.length < 2) return "";
  let tri = tokens[0].slice(0, 3) + tokens[1].slice(0, 3);
  if (tokens[2] && tokens[2].startsWith("subsp")) {
    tri += "subsp" + (tokens[3] ? tokens[3].slice(0, 3) : "");
  } else if (tokens[2] && tokens[2].startsWith("var")) {
    tri += "var" + (tokens[3] ? tokens[3].slice(0, 3) : "");
  }
  return norm(tri);
}
const cdRef = n => taxref[norm(n)];
const ecolOf = n => ecology[norm(n)] || "—";
const criteresOf = n => criteres[norm(n)] || "—";
const physioOf = n => physionomie[norm(n)] || "—";
const phenoOf  = n => phenologie[norm(n)] || "—";
const slug = n => norm(n).replace(/ /g, "-");

// === Statut analysis constants ===
const nonPatrimonialLabels = new Set([
  "Liste des espèces végétales sauvages pouvant faire l'objet d'une réglementation préfectorale dans les départements d'outre-mer : Article 1"
]);
const nonPatrimonialRedlistCodes = new Set(['LC', 'DD', 'NA', 'NE']);
const HABITATS_DIRECTIVE_CODES = new Set(['CDH1', 'CDH2', 'CDH4', 'CDH5']);
const OLD_REGIONS_TO_DEPARTMENTS = {
  'Alsace': ['67', '68'], 'Aquitaine': ['24', '33', '40', '47', '64'],
  'Auvergne': ['03', '15', '43', '63'], 'Basse-Normandie': ['14', '50', '61'],
  'Bourgogne': ['21', '58', '71', '89'], 'Champagne-Ardenne': ['08', '10', '51', '52'],
  'Franche-Comté': ['25', '39', '70', '90'], 'Haute-Normandie': ['27', '76'],
  'Languedoc-Roussillon': ['11', '30', '34', '48', '66'], 'Limousin': ['19', '23', '87'],
  'Lorraine': ['54', '55', '57', '88'], 'Midi-Pyrénées': ['09', '12', '31', '32', '46', '65', '81', '82'],
  'Nord-Pas-de-Calais': ['59', '62'], 'Picardie': ['02', '60', '80'],
  'Poitou-Charentes': ['16', '17', '79', '86'], 'Rhône-Alpes': ['01', '07', '26', '38', '42', '69', '73', '74']
};
const ADMIN_NAME_TO_CODE_MAP = {
  "France": "FR",
  "Ain": "01", "Aisne": "02", "Allier": "03", "Alpes-de-Haute-Provence": "04",
  "Hautes-Alpes": "05", "Alpes-Maritimes": "06", "Ardèche": "07", "Ardennes": "08",
  "Ariège": "09", "Aube": "10", "Aude": "11", "Aveyron": "12", "Bouches-du-Rhône": "13",
  "Calvados": "14", "Cantal": "15", "Charente": "16", "Charente-Maritime": "17",
  "Cher": "18", "Corrèze": "19", "Corse-du-Sud": "2A", "Haute-Corse": "2B",
  "Côte-d'Or": "21", "Côtes-d'Armor": "22", "Creuse": "23", "Dordogne": "24",
  "Doubs": "25", "Drôme": "26", "Eure": "27", "Eure-et-Loir": "28", "Finistère": "29",
  "Gard": "30", "Haute-Garonne": "31", "Gers": "32", "Gironde": "33", "Hérault": "34",
  "Ille-et-Vilaine": "35", "Indre": "36", "Indre-et-Loire": "37", "Isère": "38",
  "Jura": "39", "Landes": "40", "Loir-et-Cher": "41", "Loire": "42", "Haute-Loire": "43",
  "Loire-Atlantique": "44", "Loiret": "45", "Lot": "46", "Lot-et-Garonne": "47",
  "Lozère": "48", "Maine-et-Loire": "49", "Manche": "50", "Marne": "51",
  "Haute-Marne": "52", "Mayenne": "53", "Meurthe-et-Moselle": "54", "Meuse": "55",
  "Morbihan": "56", "Moselle": "57", "Nièvre": "58", "Nord": "59", "Oise": "60",
  "Orne": "61", "Pas-de-Calais": "62", "Puy-de-Dôme": "63", "Pyrénées-Atlantiques": "64",
  "Hautes-Pyrénées": "65", "Pyrénées-Orientales": "66", "Bas-Rhin": "67", "Haut-Rhin": "68",
  "Rhône": "69", "Haute-Saône": "70", "Saône-et-Loire": "71", "Sarthe": "72", "Savoie": "73",
  "Haute-Savoie": "74", "Paris": "75", "Seine-Maritime": "76", "Seine-et-Marne": "77",
  "Yvelines": "78", "Deux-Sèvres": "79", "Somme": "80", "Tarn": "81", "Tarn-et-Garonne": "82",
  "Var": "83", "Vaucluse": "84", "Vendée": "85", "Vienne": "86", "Haute-Vienne": "87",
  "Vosges": "88", "Yonne": "89", "Territoire de Belfort": "90", "Essonne": "91",
  "Hauts-de-Seine": "92", "Seine-Saint-Denis": "93", "Val-de-Marne": "94",
  "Val-d'Oise": "95", "Auvergne-Rhône-Alpes": "84", "Bourgogne-Franche-Comté": "27",
  "Bretagne": "53", "Centre-Val de Loire": "24", "Corse": "94", "Grand Est": "44",
  "Hauts-de-France": "32", "Île-de-France": "11", "Normandie": "28", "Nouvelle-Aquitaine": "75",
  "Occitanie": "76", "Pays de la Loire": "52", "Provence-Alpes-Côte d'Azur": "93",
  "Guadeloupe": "01", "Martinique": "02", "Guyane": "03", "La Réunion": "04", "Mayotte": "06"
};
let statutRulesIndex = null;

function parseCsv(text) {
  if (text.charCodeAt(0) === 0xFEFF) text = text.slice(1);
  const rows = [];
  let field = '';
  let row = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      if (inQuotes && text[i + 1] === '"') {
        field += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (c === ';' && !inQuotes) {
      row.push(field);
      field = '';
    } else if ((c === '\n' || c === '\r') && !inQuotes) {
      if (c === '\r' && text[i + 1] === '\n') i++;
      row.push(field);
      if (row.length) rows.push(row);
      row = [];
      field = '';
    } else {
      field += c;
    }
  }
  if (field || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

function indexRulesFromCSV(csvText) {
  const lines = csvText.trim().split(/\r?\n/);
  const header = lines.shift().split(';').map(h => h.trim().replace(/"/g, ''));
  const idx = {
    adm: header.indexOf('LB_ADM_TR'),
    nom: header.indexOf('LB_NOM'),
    code: header.indexOf('CODE_STATUT'),
    type: header.indexOf('LB_TYPE_STATUT'),
    label: header.indexOf('LABEL_STATUT')
  };
  const index = new Map();
  lines.forEach(line => {
    const cols = line.split(';');
    const rowData = {
      adm: cols[idx.adm]?.trim().replace(/"/g, '') || '',
      nom: cols[idx.nom]?.trim().replace(/"/g, '') || '',
      code: cols[idx.code]?.trim().replace(/"/g, '') || '',
      type: cols[idx.type]?.trim().replace(/"/g, '') || '',
      label: cols[idx.label]?.trim().replace(/"/g, '') || ''
    };
    if (rowData.nom && rowData.type) {
      if (!index.has(rowData.nom)) index.set(rowData.nom, []);
      index.get(rowData.nom).push(rowData);
    }
  });
  return index;
}

async function loadStatusRules() {
  if (statutRulesIndex) return statutRulesIndex;
  const resp = await fetch('BDCstatut.csv');
  if (!resp.ok) throw new Error('BDCstatut.csv introuvable');
  const text = await resp.text();
  statutRulesIndex = indexRulesFromCSV(text);
  return statutRulesIndex;
}

async function analyzeStatusForSpecies(speciesNames) {
  await loadStatusRules();
  let coords = { ...userLocation };
  try {
    const pos = await new Promise((res, rej) => navigator.geolocation.getCurrentPosition(res, rej, { timeout: 5000 }));
    coords = { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
    userLocation = coords;
  } catch(e) {}
  const locInfo = await (await fetch(`https://geo.api.gouv.fr/communes?lat=${coords.latitude}&lon=${coords.longitude}&fields=departement,region`)).json();
  const { departement, region } = locInfo[0];
  const relevantRules = new Map();
  for (const speciesName of speciesNames) {
    const rulesForThisTaxon = statutRulesIndex.get(speciesName);
    if (!rulesForThisTaxon) continue;
    for (const row of rulesForThisTaxon) {
      let ruleApplies = false;
      const type = row.type.toLowerCase();
      const isHab = type.includes('directive habitat') && HABITATS_DIRECTIVE_CODES.has(row.code);
      if (isHab) ruleApplies = true;
      else if (ADMIN_NAME_TO_CODE_MAP[row.adm] === 'FR' || type.includes('nationale')) ruleApplies = true;
      else if (OLD_REGIONS_TO_DEPARTMENTS[row.adm]?.includes(departement.code)) ruleApplies = true;
      else {
        const adm = ADMIN_NAME_TO_CODE_MAP[row.adm];
        if (adm === departement.code || adm === region.code) ruleApplies = true;
      }
      if (ruleApplies) {
        if (nonPatrimonialLabels.has(row.label) || type.includes('déterminante znieff')) continue;
        const isRed = type.includes('liste rouge');
        if (isRed && nonPatrimonialRedlistCodes.has(row.code)) continue;
        const key = `${row.nom}|${row.type}|${row.adm}`;
        if (!relevantRules.has(key)) {
          const desc = isRed ? `${row.type} (${row.code}) (${row.adm})` : row.label;
          relevantRules.set(key, { species: row.nom, status: desc });
        }
      }
    }
  }
  const resp = await fetch('/.netlify/functions/analyze-patrimonial-status', {
    method: 'POST',
    body: JSON.stringify({
      relevantRules: Array.from(relevantRules.values()),
      uniqueSpeciesNames: speciesNames,
      coords
    })
  });
  if (!resp.ok) throw new Error('Analyse des statuts échouée');
  return resp.json();
}

function capitalizeGenus(name) {
  if (typeof name !== 'string') return name;
  return name.replace(/^(?:[x×]\s*)?([a-z])/,
                      (m, p1) => m.replace(p1, p1.toUpperCase()));
}
const infoFlora  = n => `https://www.infoflora.ch/fr/flore/${slug(n)}.html`;
const inpnStatut = c => `https://inpn.mnhn.fr/espece/cd_nom/${c}/tab/statut`;
const aura       = c => `https://atlas.biodiversite-auvergne-rhone-alpes.fr/espece/${c}`;
const pfaf       = n => `https://pfaf.org/user/Plant.aspx?LatinName=${encodeURIComponent(n).replace(/%20/g, '+')}`;
const isIOS = () => typeof navigator !== 'undefined' &&
  /iPad|iPhone|iPod/.test(navigator.userAgent);
const isAndroid = () => typeof navigator !== 'undefined' && /Android/.test(navigator.userAgent);
const floraHelveticaPackage = 'de.haupt.florahelvetica.pro.fr';

const floraHelveticaUrl = n => {
  const code = cdRef(n);
  const base = code ? `species/${code}` : `species?name=${encodeURIComponent(n)}`;
  if (isAndroid()) {
    return `intent://${base}#Intent;scheme=florahelvetica;package=${floraHelveticaPackage};end`;
  }
  return `florahelvetica://${base}`;
};

function enableDragScroll(el) {
  if (!el) return;
  let isDown = false;
  let startX = 0;
  let scrollLeft = 0;
  el.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    isDown = true;
    startX = e.clientX;
    scrollLeft = el.scrollLeft;
    el.setPointerCapture(e.pointerId);
  });
  el.addEventListener('pointermove', e => {
    if (!isDown) return;
    const dx = startX - e.clientX;
    el.scrollLeft = scrollLeft + dx;
  });
  const stop = () => { isDown = false; };
  el.addEventListener('pointerup', stop);
  el.addEventListener('pointercancel', stop);
  el.addEventListener('pointerleave', stop);
}


function makeTimestampedName(prefix = "") {
  const d = new Date();
  const pad = n => n.toString().padStart(2, "0");
  const timestamp = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ` +
                    `${pad(d.getHours())}h${pad(d.getMinutes())}`;
  const safePrefix = prefix ? prefix.replace(/[\\/:*?"<>|]/g, "_").trim() + " " : "";
  return `${safePrefix}${timestamp}.jpg`;
}

function savePhotoLocally(blob, name) {
  try {
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.style.display = "none";
    a.href = url;
    a.download = makeTimestampedName(name);
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch (e) {
    console.error("Erreur sauvegarde photo:", e);
  }
}

function resizeImageToDataURL(file, maxDim = 1600) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = e => {
      const img = new Image();
      img.onload = () => {
        let { width, height } = img;
        if (width > maxDim || height > maxDim) {
          if (width > height) {
            height = Math.round(height * maxDim / width);
            width = maxDim;
          } else {
            width = Math.round(width * maxDim / height);
            height = maxDim;
          }
        }
        const canvas = document.createElement('canvas');
        canvas.width = width;
        canvas.height = height;
        canvas.getContext('2d').drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL('image/jpeg', 0.85));
      };
      img.onerror = () => reject(new Error('Image load error'));
      img.src = e.target.result;
    };
    reader.onerror = () => reject(new Error('File read error'));
    reader.readAsDataURL(file);
  });
}

async function apiFetch(target, payload) {
    toggleSpinner(true);
    try {
        const res = await fetch(PROXY_ENDPOINT, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ target, payload })
        });

        const responseData = await res.json();
        if (!res.ok) {
            const errorMessage = responseData.error || `Erreur API (${res.status})`;
            throw new Error(errorMessage);
        }
        return responseData;
    } catch (e) {
        console.error(`Erreur lors de l'appel proxy pour "${target}":`, e);
        showNotification(e.message || "Erreur lors de la requête", 'error');
        return null;
    } finally {
        toggleSpinner(false);
    }
}

async function taxrefFuzzyMatch(term) {
  // This API is public and does not require a key, so it can be called directly.
  const url = `https://taxref.mnhn.fr/api/taxa/fuzzyMatch?term=${encodeURIComponent(term)}`;
  toggleSpinner(true);
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error('TaxRef API request failed');
    const data = await res.json();
    if (Array.isArray(data)) return data;
    if (Array.isArray(data.matches)) return data.matches;
    return [];
  } catch (e) {
    console.error(e);
    showNotification(e.message || "Erreur de recherche TaxRef", 'error');
    return [];
  } finally {
    toggleSpinner(false);
  }
}


/* ================================================================
    NOUVEAU : FENÊTRE MODALE D'INFORMATION GÉNÉRIQUE
    ================================================================ */

function showInfoModal(title, content) {
    const existingModal = document.getElementById('info-modal-overlay');
    if (existingModal) {
        existingModal.remove();
    }

    const modalOverlay = document.createElement('div');
    modalOverlay.id = 'info-modal-overlay';
    modalOverlay.style.cssText = 'position: fixed; top: 0; left: 0; width: 100%; height: 100%; background: rgba(0,0,0,0.6); z-index: 1000; display: flex; justify-content: center; align-items: center; padding: 1rem;';

    const modalContainer = document.createElement('div');
    modalContainer.style.cssText = 'background: var(--card, #ffffff); color: var(--text, #202124); padding: 2rem; border-radius: 8px; max-width: 800px; width: 100%; max-height: 90vh; overflow-y: auto; box-shadow: 0 5px 15px rgba(0,0,0,0.3);';

    const modalTitle = document.createElement('h2');
    modalTitle.textContent = title;
    modalTitle.style.marginTop = '0';
    modalTitle.style.color = 'var(--primary, #388e3c)';

    const modalText = document.createElement('div');
    modalText.innerHTML = content.replace(/</g, "<").replace(/>/g, ">").replace(/\n/g, '<br>');
    modalText.style.lineHeight = '1.6';

    const closeButton = document.createElement('button');
    closeButton.textContent = 'Fermer';
    closeButton.className = 'action-button';
    closeButton.style.display = 'block';
    closeButton.style.margin = '1.5rem auto 0';
    
    closeButton.onclick = () => modalOverlay.remove();
    modalOverlay.onclick = (e) => {
        if (e.target === modalOverlay) {
            modalOverlay.remove();
        }
    };
    
    modalContainer.appendChild(modalTitle);
    modalContainer.appendChild(modalText);
    modalContainer.appendChild(closeButton);
    modalOverlay.appendChild(modalContainer);
    document.body.appendChild(modalOverlay);
}


/* ================================================================
    NOUVEAU : FONCTIONS POUR LA FICHE DE SYNTHÈSE (TEXTE ET AUDIO)
    ================================================================ */

async function getSynthesisFromGemini(speciesName) {
    const prompt = `En tant qu'expert botaniste, rédige une fiche de synthèse narrative et fluide pour l'espèce "${speciesName}". Le style doit être oral, comme si tu t'adressais à des étudiants, pour une future conversion en audio. N'utilise ni tableau, ni formatage de code, ni listes à puces. Structure ta réponse en couvrant les points suivants de manière conversationnelle, sans utiliser de titres : commence par une introduction (nom commun, nom latin, famille), puis décris un ou deux critères d'identification clés pour la distinguer d'espèces proches. Mentionne ces espèces sources de confusion et comment les différencier. Ensuite, décris son écologie et habitat préférentiel. Termine par son statut de conservation en France (si pertinent) et sa répartition générale. Dans ta réponse, n'utilise aucun formatage Markdown : pas de gras, italique, titres ou listes. Évite également d'insérer des caractères spéciaux tels que '*' ou ':' et réponds uniquement avec du texte simple qui sera mis en forme par le contexte. Utilise ton savoir encyclopédique pour générer cette fiche.`;
    const requestBody = { "contents": [{ "parts": [{ "text": prompt }] }], "generationConfig": { "temperature": 0.4, "maxOutputTokens": 800 } };
    try {
        const responseData = await apiFetch('gemini', requestBody);
        if (!responseData) return "Erreur lors de la génération du texte.";
        if (responseData.candidates &&
            responseData.candidates[0] &&
            responseData.candidates[0].content &&
            responseData.candidates[0].content.parts &&
            responseData.candidates[0].content.parts[0] &&
            responseData.candidates[0].content.parts[0].text)
            return responseData.candidates[0].content.parts[0].text.trim();
        if (responseData.promptFeedback && responseData.promptFeedback.blockReason)
            return `Réponse bloquée par le modèle (${responseData.promptFeedback.blockReason}).`;
        return "Le modèle n'a pas pu générer de synthèse.";
    } catch (error) { console.error("Erreur Gemini:", error); return "Erreur lors de la génération du texte."; }
}

async function synthesizeSpeech(text) {
    const requestBody = {
        input: { text: text },
        voice: { languageCode: 'fr-FR', name: 'fr-FR-Wavenet-D' },
        audioConfig: { audioEncoding: "MP3" }
    };
    try {
        const responseData = await apiFetch('tts', requestBody);
        return responseData ? responseData.audioContent : null;
    } catch (error) {
        console.error("Erreur Text-to-Speech:", error);
        return null;
    }
}

function playAudioFromBase64(base64Audio) {
    if (!base64Audio) return;
    const audio = new Audio(`data:audio/mp3;base64,${base64Audio}`);
    audio.play().catch(err => {
        console.error("Erreur lecture audio:", err);
        showNotification("Impossible de lire l'audio", 'error');
    });
}

async function getSimilarSpeciesFromGemini(speciesName, limit = 5) {
    const genus = speciesName.split(/\s+/)[0];
    const prompt = `Donne une liste de ${limit} espèces du genre ${genus} avec lesquelles ${speciesName} peut être confondu pour des raisons morphologiques en région Rhône-Alpes ou PACA. Réponds uniquement par une liste séparée par des virgules. Attention à ce que ta réponse ne comporte absoluement aucun élément de formatae Markdown`;
    const requestBody = {
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { temperature: 0.4, maxOutputTokens: 60 }
    };
    const data = await apiFetch('gemini', requestBody);
    if (!data) return [];
    const txt = data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts && data.candidates[0].content.parts[0] && data.candidates[0].content.parts[0].text;
    if (!txt) return [];
    return txt
        .split(/[\,\n;]+/)
        .map(s => s.trim().replace(/^\*+|\*+$/g, ''))
        .filter(Boolean);
}


window.handleSynthesisClick = async function(event, element, speciesName) {
    event.preventDefault();
    const parentCell = element.parentElement;
    parentCell.innerHTML = '<i>Texte en cours...</i>';
    element.style.pointerEvents = 'none';

    const synthesisText = await getSynthesisFromGemini(speciesName);
    if (synthesisText.startsWith('Erreur') || synthesisText.startsWith('Réponse')) {
        showInfoModal('Erreur de Synthèse',synthesisText);
        parentCell.innerHTML = `<a href="#" onclick="handleSynthesisClick(event, this, '${speciesName.replace(/'/g, "\\'")}')">Générer</a>`;
        return;
    }
    
    parentCell.innerHTML = '<i>Audio en cours...</i>';
    const audioData = await synthesizeSpeech(synthesisText);

    if (audioData) {
        playAudioFromBase64(audioData);
    } else {
        showInfoModal("Échec de la synthèse audio", "La synthèse audio a échoué. Le texte généré était :\n\n" + synthesisText);
    }

    parentCell.innerHTML = `<a href="#" onclick="handleSynthesisClick(event, this, '${speciesName.replace(/'/g, "\\'")}')">Générer</a>`;
};


/* ================================================================
    NOUVEAU : FONCTIONS POUR L'ANALYSE COMPARATIVE
    ================================================================ */
async function getComparisonFromGemini(speciesData) {
    const speciesDataString = speciesData.map(s => `Espèce: ${s.species}\nDonnées morphologiques (Physionomie): ${s.physio || 'Non renseignée'}\nDonnées écologiques: ${s.eco || 'Non renseignée'}`).join('\n\n');
    
    const promptTemplate = `En te basant sur les données fournies ci-dessous, rédige une analyse comparative dont l'objectif est de mettre en évidence les points de distinction clairs entre les espèces.
Données :
---
${speciesDataString}
---
Ta réponse doit être structurée en deux parties distinctes, sans aucun texte introductif ou superflu.

Commence par une phrase unique (1 à 2 lignes maximum) qui met en évidence le critère morphologique le plus facilement observable et le plus discriminant pour distinguer les espèces analysées.

Ensuite, présente un tableau comparatif en format Markdown. Ce tableau doit regrouper pour chaque espèce les principaux critères morphologiques (forme, taille, couleur des organes, etc.) et écologiques (habitat, type de sol, altitude), en t’appuyant sur les informations des colonnes « Physionomie » et « Écologie ». Organise les lignes du tableau en commençant par les critères les plus simples et discriminants à observer. Le contenu du tableau doit rester clair, sans utiliser de gras, italique ou autres styles typographiques.

Après le tableau, ajoute un paragraphe de synthèse plus développé (cinq à six phrases environ) rédigé dans un style oral mais technique. Fais ressortir les éléments clés qui différencient les espèces. Pour ce paragraphe de synthèse, n'utilise aucun élément de mise en forme markdown ni liste, uniquement du texte simple sans '*' et '/' ni aucun formatage de markdown.`;

    const requestBody = { 
        "contents": [{ "parts": [{ "text": promptTemplate }] }], 
        "generationConfig": { "temperature": 0.3, "maxOutputTokens": 1500 } 
    };
    try {
        const responseData = await apiFetch('gemini', requestBody);
        if (!responseData) return "Erreur technique lors de la génération de la comparaison.";
        if (responseData.candidates &&
            responseData.candidates[0] &&
            responseData.candidates[0].content &&
            responseData.candidates[0].content.parts &&
            responseData.candidates[0].content.parts[0] &&
            responseData.candidates[0].content.parts[0].text) {
            return responseData.candidates[0].content.parts[0].text.trim();
        }
        if (responseData.promptFeedback && responseData.promptFeedback.blockReason) {
            return `Réponse bloquée par le modèle (${responseData.promptFeedback.blockReason}). Vérifiez le contenu du prompt.`;
        }
        return "Le modèle n'a pas pu générer de comparaison. La réponse était vide.";
    } catch (error) {
        console.error("Erreur Gemini (comparaison):", error);
        return `Erreur technique lors de la génération de la comparaison: ${error.message}`;
    }
}

function parseComparisonText(text) {
    const lines = text.split(/\n+/);
    let introLines = [];
    let tableLines = [];
    let summaryLines = [];
    let mode = 'intro';
    for (const line of lines) {
        const trimmed = line.trim();
        if (mode === 'intro' && trimmed.startsWith('|')) {
            mode = 'table';
        }
        if (mode === 'table' && !trimmed.startsWith('|') && tableLines.length) {
            mode = 'summary';
        }
        if (mode === 'intro') {
            if (trimmed) introLines.push(trimmed);
        } else if (mode === 'table') {
            tableLines.push(line);
        } else if (trimmed) {
            summaryLines.push(trimmed);
        }
    }
    return {
        intro: introLines.join(' '),
        tableMarkdown: tableLines.join('\n'),
        summary: summaryLines.join(' ')
    };
}

function markdownTableToHtml(md) {
    const lines = md.trim().split(/\n+/).filter(Boolean);
    if (lines.length < 2) return '';
    const headerCells = lines[0].split('|').slice(1, -1).map(c => c.trim());
    const rows = lines.slice(2).map(l => l.split('|').slice(1, -1).map(c => c.trim()));
    const thead = '<thead><tr>' + headerCells.map(c => `<th>${c}</th>`).join('') + '</tr></thead>';
    const tbody = '<tbody>' + rows.map(r => '<tr>' + r.map(c => `<td>${c}</td>`).join('') + '</tr>').join('') + '</tbody>';
    return `<table>${thead}${tbody}</table>`;
}

async function handleComparisonClick() {
    const compareBtn = document.getElementById('compare-btn');
    if (!compareBtn) return;
    
    compareBtn.disabled = true;
    compareBtn.textContent = 'Analyse en cours...';

    const resultsContainer = document.getElementById('comparison-results-container');
    if (!resultsContainer) {
        console.error("Le conteneur de résultats (#comparison-results-container) est introuvable.");
        compareBtn.disabled = false;
        compareBtn.textContent = 'Comparer les espèces';
        return;
    }
    resultsContainer.innerHTML = '<i>Génération de la comparaison en cours...</i>';
    resultsContainer.style.display = 'block';

    const checkedBoxes = document.querySelectorAll('.species-checkbox:checked');
    const speciesData = Array.from(checkedBoxes).map(box => ({
        species: box.dataset.species,
        physio: decodeURIComponent(box.dataset.physio),
        eco: decodeURIComponent(box.dataset.eco)
    }));

    const cdCodes = speciesData.map(s => cdRef(s.species)).filter(Boolean);

    const comparisonText = await getComparisonFromGemini(speciesData);
    const { intro, tableMarkdown, summary } = parseComparisonText(comparisonText);
    const tableHtml = markdownTableToHtml(tableMarkdown);

    resultsContainer.style.cssText = `
        margin-top: 2rem;
        padding: 1.5rem;
        background: var(--card, #ffffff);
        border: 1px solid var(--border, #e0e0e0);
        border-radius: 8px;
        box-shadow: 0 2px 6px rgba(0,0,0,.05);
    `;
    resultsContainer.innerHTML = `
        <div style="display: flex; align-items: center; justify-content: space-between; gap: 1rem;">
            <h2 style="margin:0; color:var(--primary, #388e3c);">Analyse Comparative des Espèces</h2>
        </div>
        <hr style="border: none; border-top: 1px solid var(--border, #e0e0e0); margin: 1rem 0;">
        <div id="comparison-table-content"><p>${intro}</p>${tableHtml}</div>
        <div id="comparison-summary" style="margin-top:1rem; display:flex; align-items:flex-start; gap:0.5rem;">
            <p id="comparison-summary-text" style="margin:0;">${summary}</p>
            <a href="#" id="comparison-tts-btn" title="Écouter la synthèse" style="flex-shrink:0;">
                <img src="assets/Audio.png" alt="Écouter" class="logo-icon" style="height: 32px;">
            </a>
        </div>
    `;

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

        btn.innerHTML = '<img src="assets/Audio.png" alt="Écouter" class="logo-icon" style="height: 32px;">';
        btn.style.pointerEvents = 'auto';
    });

    resultsContainer.scrollIntoView({ behavior: 'smooth', block: 'start' });

    compareBtn.disabled = false;
    compareBtn.textContent = 'Comparer les espèces';
}


/* ================================================================
    LOGIQUE D'IDENTIFICATION ET D'AFFICHAGE
    ================================================================ */
async function callPlantNetAPI(imagesPayload, retries = 2) {
    for (let attempt = 0; attempt <= retries; attempt++) {
        const data = await apiFetch('plantnet', { images: imagesPayload });
        if (data) return data.results.slice(0, MAX_RESULTS);
        if (attempt < retries) {
            await new Promise(res => setTimeout(res, 1000));
        }
    }
    showNotification('Échec de l\'analyse après plusieurs tentatives.', 'error');
    return null;
}

async function identifySingleImage(fileBlob, organ) {
    await loadData();
    const dataURL = await resizeImageToDataURL(fileBlob);
    const payload = [{
        dataUrl: dataURL,
        organ: organ,
        name: fileBlob.name || "photo.jpg"
    }];
    const results = await callPlantNetAPI(payload);
    if (results) {
        document.body.classList.remove("home");
        const preview = document.getElementById("preview");
        if (preview) {
            preview.classList.add('thumbnail');
            preview.addEventListener('click', () => {
                preview.classList.toggle('enlarged');
            });
        }
        displayedItems = results;
        buildTable(displayedItems, statusData);
        buildCards(displayedItems);
        const latin = results[0] && results[0].species ?
            results[0].species.scientificNameWithoutAuthor :
            undefined;
        if (latin) savePhotoLocally(fileBlob, latin);
    }
}

async function identifyMultipleImages(files, organs) {
    await loadData();
    const imagePromises = files.map(file => resizeImageToDataURL(file));
    const dataURLs = await Promise.all(imagePromises);
    const payload = dataURLs.map((dataUrl, i) => ({
        dataUrl,
        organ: organs[i],
        name: files[i].name || `photo_${i}.jpg`
    }));

    if (payload.length === 0) {
        return showNotification("Aucune image valide.", 'error');
    }

    const results = await callPlantNetAPI(payload);
    if (results) {
        sessionStorage.setItem("identificationResults", JSON.stringify(results));
        ["photoData", "speciesQueryNames"].forEach(k => sessionStorage.removeItem(k));
        location.href = "organ.html";
    }
}

function buildTable(items, statusMap = {}){
  const wrap = document.getElementById("results");
  if (!wrap) return;

  const linkIcon = (url, img, alt, extraClass = '') => {
    if (!url) return "—";
    const encoded = img.split('/').map(s => encodeURIComponent(s)).join('/');
    const cls = extraClass ? `logo-icon ${extraClass}` : 'logo-icon';
    return `<a href="${url}" target="_blank" rel="noopener"><img src="assets/${encoded}" alt="${alt}" class="${cls}"></a>`;
  };

  const rows = items.map(item => {
    const pct = item.score !== undefined ? `${Math.round(item.score * 100)}%` : "N/A";
    const sci  = item.species.scientificNameWithoutAuthor;
    const displaySci = capitalizeGenus(sci);
    const cd   = cdRef(sci);
    const eco  = ecolOf(sci);
    const crit = criteresOf(sci);
    const phys = physioOf(sci);
    const pheno = phenoOf(sci);
    const genus = sci.split(' ')[0].toLowerCase();
    
    const tocEntryFloraGallica = floraToc[genus];
    let floraGallicaLink = "—";
    if (tocEntryFloraGallica && tocEntryFloraGallica.pdfFile && tocEntryFloraGallica.page) {
      const pdfPath = `assets/flora_gallica_pdfs/${tocEntryFloraGallica.pdfFile}`;
      const viewerUrl = `viewer.html?file=${encodeURIComponent(pdfPath)}&page=${tocEntryFloraGallica.page}`;
      floraGallicaLink = linkIcon(viewerUrl, "Flora Gallica.png", "Flora Gallica");
    }

    const tocEntryRegalVegetal = regalVegetalToc[genus];
    let regalVegetalLink = "—";
    if (tocEntryRegalVegetal && tocEntryRegalVegetal.pdfFile && tocEntryRegalVegetal.page) {
        const pdfPath = `assets/regal_vegetal_pdf/${tocEntryRegalVegetal.pdfFile}`;
        const viewerUrl = `viewer.html?file=${encodeURIComponent(pdfPath)}&page=${tocEntryRegalVegetal.page}`;
        regalVegetalLink = linkIcon(viewerUrl, "Régal Végétal.png", "Régal Végétal");
    }

    // LOGIQUE POUR FLORE MED
    const tocEntryFloreMed = floreMedToc[genus];
    let floreMedLink = "—";
    if (tocEntryFloreMed && tocEntryFloreMed.pdfFile && tocEntryFloreMed.page) {
        const pdfPath = `assets/flore_med_pdf/${tocEntryFloreMed.pdfFile}`;
        const viewerUrl = `viewer.html?file=${encodeURIComponent(pdfPath)}&page=${tocEntryFloreMed.page}`;
        floreMedLink = linkIcon(viewerUrl, "Flore Med.png", "Flore Méd");
    }

    const normalizedSci = norm(sci);
    let floreAlpesLink = "—";
    const foundKey = Object.keys(floreAlpesIndex).find(key => norm(key.split('(')[0]) === normalizedSci);
    if (foundKey) {
        const urlPart = floreAlpesIndex[foundKey].split('?')[0];
        floreAlpesLink = linkIcon(`https://www.florealpes.com/${urlPart}`, "FloreAlpes.png", "FloreAlpes");
    }
    const escapedSci = displaySci.replace(/'/g, "\\'");
    const stat = statusMap[sci] ? statusMap[sci].join('<br>') : '—';
    const checkedAttr = item.autoCheck ? ' checked' : '';
    const floraHelveticaLink = `<a href="${floraHelveticaUrl(sci)}">FH</a>`;
    
    return `<tr>
              <td class="col-checkbox">
                <input type="checkbox" class="species-checkbox"${checkedAttr}
                       data-species="${escapedSci}"
                       data-physio="${encodeURIComponent(phys)}"
                       data-eco="${encodeURIComponent(eco)}"
                       data-pheno="${encodeURIComponent(pheno)}">
              </td>
            	 <td class="col-nom-latin" data-latin="${displaySci}">${displaySci}<br><span class="score">(${pct})</span></td>
            	 <td class="col-link">${floreAlpesLink}</td>
            	 <td class="col-link">${floraGallicaLink}</td>
            	 <td class="col-link">${linkIcon(cd && inpnStatut(cd), "INPN.png", "INPN", "small-logo")}</td>
            	 <td class="col-criteres">
            	 	 <div class="text-popup-trigger" data-title="Critères physiologiques" data-fulltext="${encodeURIComponent(crit)}">${crit}</div>
            	 </td>
            	 <td class="col-ecologie">
            	 	 	 <div class="text-popup-trigger" data-title="Écologie" data-fulltext="${encodeURIComponent(eco)}">${eco}</div>
            	 </td>
            	 <td class="col-physionomie">
            	 	 <div class="text-popup-trigger" data-title="Physionomie" data-fulltext="${encodeURIComponent(phys)}">${phys}</div>
          	 	 </td>
          	 	 <td class="col-phenologie">
          	 	 	 <div class="text-popup-trigger" data-title="Phénologie" data-fulltext="${encodeURIComponent(pheno)}">${pheno}</div>
          	 	 </td>
          	 	 <td class="col-link">${linkIcon(cd && aura(cd), "Biodiv'AURA.png", "Biodiv'AURA")}</td>
          	 	 <td class="col-link">${linkIcon(infoFlora(sci), "Info Flora.png", "Info Flora")}</td>
          	 	 <td class="col-link">${floraHelveticaLink}</td>
          	 	 <td class="col-link"><a href="#" onclick="handleSynthesisClick(event, this, '${escapedSci}')"><img src="assets/Audio.png" alt="Audio" class="logo-icon"></a></td>
          	 	 <td class="col-link">${linkIcon(pfaf(sci), "PFAF.png", "PFAF")}</td>
         <td class="col-link">${regalVegetalLink}</td>
         <td class="col-link">${floreMedLink}</td>
         <td class="col-statut">${stat}</td>
         </tr>`;
  }).join("");

  const headerHtml = `<tr><th><button type="button" id="toggle-select-btn" class="select-toggle-btn">Tout sélectionner</button></th><th>Nom latin (score %)</th><th>FloreAlpes</th><th>Flora Gallica</th><th>INPN statut</th><th>Critères physiologiques</th><th>Écologie</th><th>Physionomie</th><th>Phénologie</th><th>Biodiv'AURA</th><th>Info Flora</th><th>Flora Helvetica</th><th>Fiche synthèse</th><th>PFAF</th><th>Régal Végétal</th><th>Flore Méd</th><th>Statut</th></tr>`;
  
  wrap.innerHTML = `<div class="table-wrapper"><table><thead>${headerHtml}</thead><tbody>${rows}</tbody></table></div><div id="comparison-footer" style="padding-top: 1rem; text-align: center;"></div><div id="comparison-results-container" style="display:none;"></div>`;
  enableDragScroll(wrap);

  const footer = document.getElementById('comparison-footer');
  if (footer) {
      const compareBtn = document.createElement('button');
      compareBtn.id = 'compare-btn';
      compareBtn.textContent = 'Comparer les espèces';
      compareBtn.className = 'action-button';
      compareBtn.style.display = 'none';
      compareBtn.style.padding = '0.8rem 1.5rem';
      compareBtn.style.marginRight = '0.5rem';
      compareBtn.style.width = 'auto';

      const locationBtn = document.createElement('button');
      locationBtn.id = 'location-btn';
      locationBtn.textContent = 'Carte de localisation';
      locationBtn.className = 'action-button';
      locationBtn.style.display = 'none';
      locationBtn.style.padding = '0.8rem 1.5rem';
      locationBtn.style.width = 'auto';
      locationBtn.style.backgroundColor = '#0277BD';

      footer.appendChild(compareBtn);
      footer.appendChild(locationBtn);

      compareBtn.addEventListener('click', handleComparisonClick);
      
      locationBtn.addEventListener('click', () => {
          const checkedBoxes = document.querySelectorAll('.species-checkbox:checked');
          const speciesNames = Array.from(checkedBoxes).map(box => {
              const latinCell = box.closest('tr')?.querySelector('.col-nom-latin');
              if (latinCell) {
                  return (latinCell.dataset.latin || latinCell.textContent.split('\n')[0]).trim();
              }
              return box.dataset.species || '';
          }).filter(Boolean).join(',');
          if (speciesNames) {
              const mapUrl = `carte_interactive/map_view.html?species=${encodeURIComponent(speciesNames)}`;
              window.open(mapUrl, '_blank');
          }
      });
  }

  const updateCompareVisibility = () => {
      const checkedCount = wrap.querySelectorAll('.species-checkbox:checked').length;
      const compareBtn = document.getElementById('compare-btn');
      const locationBtn = document.getElementById('location-btn');
      const toggleBtn = document.getElementById('toggle-select-btn');
      if(compareBtn) {
        compareBtn.style.display = (checkedCount >= 2) ? 'inline-block' : 'none';
      }
      if(locationBtn) {
        locationBtn.style.display = (checkedCount >= 2) ? 'inline-block' : 'none';
      }
      if(toggleBtn) {
        const total = wrap.querySelectorAll('.species-checkbox').length;
        const allChecked = checkedCount === total && total > 0;
        toggleBtn.textContent = allChecked ? 'Tout désélectionner' : 'Tout sélectionner';
      }
  };

  updateCompareVisibility();

  const toggleBtn = document.getElementById('toggle-select-btn');
  if (toggleBtn) {
      toggleBtn.addEventListener('click', () => {
          const boxes = wrap.querySelectorAll('.species-checkbox');
          const allChecked = Array.from(boxes).every(b => b.checked);
          boxes.forEach(b => { b.checked = !allChecked; });
          updateCompareVisibility();
      });
  }

  let startX, startY, moved = false;
  const MOVE_THRESHOLD = 6;
  const startPoint = ev => {
      const t = ev.touches ? ev.touches[0] : ev;
      startX = t.clientX;
      startY = t.clientY;
      moved = false;
  };
  const checkMove = ev => {
      const t = ev.touches ? ev.touches[0] : ev;
      if (Math.abs(t.clientX - startX) > MOVE_THRESHOLD || Math.abs(t.clientY - startY) > MOVE_THRESHOLD) {
          moved = true;
      }
  };
  wrap.addEventListener('pointerdown', startPoint);
  wrap.addEventListener('pointermove', checkMove);
  wrap.addEventListener('touchstart', startPoint);
  wrap.addEventListener('touchmove', checkMove);

  wrap.addEventListener('change', (e) => {
      if (e.target.classList.contains('species-checkbox')) {
          updateCompareVisibility();
      }
  });

  const handleWrapClick = (e) => {
      const popupTrigger = e.target.closest('.text-popup-trigger');
      if (popupTrigger) {
          const overlay = document.getElementById('popup-overlay');
          const content = document.getElementById('popup-content');
          if (overlay && content) {
              const title = popupTrigger.dataset.title || '';
              let fullText = decodeURIComponent(popupTrigger.dataset.fulltext || '');
              const latinCell = popupTrigger.closest('tr')?.querySelector('.col-nom-latin');
              const latin = latinCell ? (latinCell.dataset.latin || '').trim() : '';
              if (latin) {
                  const re = new RegExp(latin.replace(/[.*+?^${}()|[\]\\]/g, '\\amp;'), 'gi');
                  fullText = fullText.replace(re, '').trim();
              }
              content.innerHTML = `<h3 style="margin-top:0">${title}</h3><p>${fullText}</p>`;
              overlay.style.display = 'flex';
          }
          return;
      }

      const nameCell = e.target.closest('.col-nom-latin');
      if (nameCell) {
        const latin = (nameCell.dataset.latin || '').trim();
        const text = latin || nameCell.innerText.replace(/\s*\(.*/, '').replace(/\s+/g, ' ').trim();
        const copy = (t) => {
            if (navigator.clipboard && navigator.clipboard.writeText) {
                navigator.clipboard.writeText(t).then(() => {
                    showNotification('Nom latin copié', 'success');
                }).catch(() => showNotification('Échec de la copie', 'error'));
            } else {
                const ta = document.createElement('textarea');
                ta.value = t;
                ta.style.position = 'fixed';
                ta.style.opacity = '0';
                document.body.appendChild(ta);
                ta.focus();
                ta.select();
                try {
                    document.execCommand('copy');
                    showNotification('Nom latin copié', 'success');
                } catch(err) {
                    showNotification('Échec de la copie', 'error');
                }
                document.body.removeChild(ta);
            }
        };
        copy(text);
        return;
      }

  };

  const safeClick = e => {
      if (moved) { moved = false; return; }
      handleWrapClick(e);
  };
  wrap.addEventListener('click', safeClick);
  wrap.addEventListener('touchend', safeClick);

  const overlay = document.getElementById('popup-overlay');
  if (overlay) {
      overlay.addEventListener('click', (ev) => {
          if (ev.target === overlay) overlay.style.display = 'none';
      });
  }
}

function buildCards(items){
  const zone = document.getElementById("cards");
  if (!zone) return;
  zone.innerHTML = "";
  items.forEach(item => {
    const sci = item.species.scientificNameWithoutAuthor;
    const displaySci = capitalizeGenus(sci);
    const cd = cdRef(sci);
    if(!cd && !(item.score === 1.00 && items.length === 1)) return;
    const pct = item.score !== undefined ? Math.round(item.score * 100) : "Info";
    const isNameSearchResult = item.score === 1.00 && items.length === 1;
    const details = document.createElement("details");
    let iframeHTML = '';
    if (cd) {
      iframeHTML = `<div class="iframe-grid"><iframe loading="lazy" src="${inpnStatut(cd)}" title="Statut INPN"></iframe><iframe loading="lazy" src="${aura(cd)}" title="Biodiv'AURA"></iframe></div>`;
    }
    details.innerHTML = `<summary>${displaySci} — ${pct}${!isNameSearchResult ? '%' : ''}</summary><p style="padding:0 12px 8px;font-style:italic">${ecolOf(sci)}</p>${iframeHTML}`;
    zone.appendChild(details);
  });
}

function showSimilarSpeciesButton(speciesName) {
  const area = document.getElementById('similar-btn-area');
  if (!area) return;
  area.innerHTML = '';
  const btn = document.createElement('button');
  btn.id = 'similar-btn';
  btn.textContent = 'Montrer des espèces similaires (Rhône-Alpes/PACA)';
  btn.className = 'action-button';
  area.appendChild(btn);
  btn.addEventListener('click', async () => {
    btn.disabled = true;
    btn.textContent = 'Recherche...';
    const extras = await getSimilarSpeciesFromGemini(speciesName);
    btn.remove();
    if (extras.length) {
      extras.forEach(n => {
        if (!displayedItems.some(it => it.species.scientificNameWithoutAuthor === n)) {
          displayedItems.push({ score: 0, species: { scientificNameWithoutAuthor: n }, autoCheck: false });
        }
      });
      buildTable(displayedItems, statusData);
      buildCards(displayedItems);
    } else {
      showNotification('Aucune espèce similaire trouvée.', 'error');
    }
  });
}

/* ================================================================
    LOGIQUE SPÉCIFIQUE AUX PAGES (ÉCOUTEURS)
    ================================================================ */
function handleSingleFileSelect(file) {
  if (!file) return;
  resizeImageToDataURL(file).then(dataURL => {
    try {
      sessionStorage.setItem("photoData", dataURL);
      ["speciesQueryNames", "identificationResults"].forEach(k => sessionStorage.removeItem(k));
      location.href = "organ.html";
    } catch (e) {
      console.error("Erreur stockage photo:", e);
      showNotification("Image trop volumineuse.", 'error');
    }
  }).catch(() => showNotification("Erreur lecture image.", 'error'));
}
const nameSearchInput = document.getElementById("name-search-input");
const nameSearchButton = document.getElementById("name-search-button");
const speciesSuggestions = document.getElementById("species-suggestions");
const statusAnalysisBtn = document.getElementById("status-analysis-btn");

const organBoxOnPage = document.getElementById("organ-choice");

async function performNameSearch() {
  const raw = nameSearchInput.value.trim();
  if (!raw) return;
  await loadData();
  const queries = raw.split(/[;,\n]+/).map(q => q.trim()).filter(Boolean);
  if (queries.length === 1 && queries[0].split(/\s+/).length === 1) {
    const q = queries[0];
    const tocEntry = floraToc[norm(q)];
    if (tocEntry && tocEntry.pdfFile && tocEntry.page) {
      if (organBoxOnPage) {
        displayResults([q], true);
      } else {
        sessionStorage.setItem("speciesQueryNames", JSON.stringify([q]));
        ["photoData", "identificationResults"].forEach(k => sessionStorage.removeItem(k));
        location.href = "organ.html";
      }
      return;
    }
  }
  const found = [];
  for (const q of queries) {
    const normQuery = norm(q);
    let foundName = taxrefNames.find(n => norm(n) === normQuery);
    if (!foundName) {
      const triList = trigramIndex[normQuery];
      if (triList && triList.length === 1) {
        foundName = triList[0];
      } else {
        const partial = taxrefNames.filter(n => {
          const nk = norm(n);
          return nk.startsWith(normQuery) || (nameTrigram[n] && nameTrigram[n].startsWith(normQuery));
        });
        if (partial.length === 1) foundName = partial[0];
      }
      if (!foundName) {
        const matches = await taxrefFuzzyMatch(q);
        if (matches.length) {
          const best = matches[0];
          foundName = best.nom_complet || best.name || best.nom;
          const sc = best.score !== undefined ? ` (${Math.round(best.score * 100)}%)` : '';
          showNotification(`Suggestion : ${foundName}${sc}`, 'success');
        }
      }
    }
    if (foundName) {
      found.push(foundName);
    } else {
      showNotification(`Espèce "${q}" non trouvée.`, "error");
    }
  }
  if (found.length) {
    if (organBoxOnPage) {
      found.forEach(n => {
        if (!displayedItems.some(it => it.species.scientificNameWithoutAuthor === n)) {
          displayedItems.push({ score: 1.0, species: { scientificNameWithoutAuthor: n }, autoCheck: found.length === 1 });
        }
      });
    buildTable(displayedItems, statusData);
      buildCards(displayedItems);
      if (found.length === 1) {
        showSimilarSpeciesButton(found[0]);
      } else {
        const area = document.getElementById('similar-btn-area');
        if (area) area.innerHTML = '';
      }
    } else {
      sessionStorage.setItem("speciesQueryNames", JSON.stringify(found));
      ["photoData", "identificationResults"].forEach(k => sessionStorage.removeItem(k));
      location.href = "organ.html";
    }
  }
}
if (nameSearchButton) nameSearchButton.addEventListener("click", performNameSearch);
if (nameSearchInput) nameSearchInput.addEventListener("keypress", e => { if (e.key === "Enter") performNameSearch(); });
if (statusAnalysisBtn) statusAnalysisBtn.addEventListener('click', async () => {
  statusAnalysisBtn.disabled = true;
  statusAnalysisBtn.textContent = 'Analyse...';
  try {
    const species = displayedItems.map(it => it.species.scientificNameWithoutAuthor);
    statusData = await analyzeStatusForSpecies(species);
    buildTable(displayedItems, statusData);
  } catch(e) {
    showNotification(e.message, 'error');
  }
  statusAnalysisBtn.disabled = false;
  statusAnalysisBtn.textContent = 'Analyse statuts';
});

if (document.getElementById("file-capture")) {
  const fileCaptureInput = document.getElementById("file-capture");
  const multiFileInput = document.getElementById("multi-file-input");
  const multiImageListArea = document.getElementById("multi-image-list-area");
  const multiImageIdentifyButton = document.getElementById("multi-image-identify-button");
  const multiImageSection = document.getElementById("multi-image-section");
  let selectedMultiFilesData = [];
  if (fileCaptureInput) {
    fileCaptureInput.addEventListener("change", e => {
      const f = e.target.files[0];
      if (f) handleSingleFileSelect(f);
    });
  }
  
  function renderMultiImageList() {
    multiImageListArea.innerHTML = '';
    multiImageIdentifyButton.style.display = selectedMultiFilesData.length > 0 ? 'block' : 'none';
    if (multiImageSection) multiImageSection.style.display = selectedMultiFilesData.length > 0 ? 'block' : 'none';
    if (selectedMultiFilesData.length === 0) multiFileInput.value = '';
    selectedMultiFilesData.forEach((item, index) => {
      const itemDiv = document.createElement('div');
      itemDiv.className = 'image-organ-item';
      itemDiv.innerHTML = `<span class="file-info"><span class="file-index">Image ${index + 1}:</span> <span>${item.file.name.substring(0, 20)}...</span></span><select data-index="${index}"><option value="leaf">🍃</option><option value="flower">🌸</option><option value="fruit">🍒</option><option value="bark">🪵</option></select><button type="button" class="delete-file-btn" data-index="${index}" title="Supprimer">✖</button>`;
      itemDiv.querySelector('select').value = item.organ;
      multiImageListArea.appendChild(itemDiv);
    });
  }
  if (multiImageListArea) multiImageListArea.addEventListener('click', (e) => {
    if (e.target && e.target.classList.contains('delete-file-btn')) {
      selectedMultiFilesData.splice(parseInt(e.target.dataset.index, 10), 1);
      renderMultiImageList();
    }
  });
  if (multiImageListArea) multiImageListArea.addEventListener('change', (e) => {
    if (e.target && e.target.tagName === 'SELECT') {
      selectedMultiFilesData[parseInt(e.target.dataset.index, 10)].organ = e.target.value;
    }
  });
  if (multiFileInput) multiFileInput.addEventListener("change", (e) => {
    const files = Array.from(e.target.files);
    if (selectedMultiFilesData.length === 0 && files.length === 1) {
      handleSingleFileSelect(files[0]);
      e.target.value = '';
      return;
    }
    const r = MAX_MULTI_IMAGES - selectedMultiFilesData.length;
    if (r <= 0) return showNotification(`Limite de ${MAX_MULTI_IMAGES} atteinte.`, "error");
    files.slice(0, r).forEach(f => {
      if (!selectedMultiFilesData.some(i => i.file.name === f.name && i.file.size === f.size)) selectedMultiFilesData.push({ file: f, organ: 'leaf' });
    });
    if (files.length > r) showNotification(`Limite atteinte.`, "error");
    renderMultiImageList();
    e.target.value = '';
  });
  if (multiImageIdentifyButton) multiImageIdentifyButton.addEventListener("click", () => {
    if (selectedMultiFilesData.length === 0) return showNotification("Veuillez sélectionner au moins une image.", "error");
    identifyMultipleImages(selectedMultiFilesData.map(i => i.file), selectedMultiFilesData.map(i => i.organ));
  });
}
if (organBoxOnPage) {
  const displayResults = async (results, isNameSearch = false) => {
    const previewEl = document.getElementById("preview");
    if (previewEl) {
      previewEl.classList.add('thumbnail');
      previewEl.addEventListener('click', () => {
        previewEl.classList.toggle('enlarged');
      });
    }
    organBoxOnPage.style.display = 'none';
    await loadData();
    document.body.classList.remove("home");
    let items = isNameSearch
      ? results.map(n => ({ score: 1.0, species: { scientificNameWithoutAuthor: n }, autoCheck: results.length === 1 }))
      : results;

    displayedItems = items;
    buildTable(displayedItems, statusData);
    buildCards(displayedItems);

    if (isNameSearch && results.length === 1) {
      showSimilarSpeciesButton(results[0]);
    } else {
      const area = document.getElementById('similar-btn-area');
      if (area) area.innerHTML = '';
    }
  };

  const namesRaw = sessionStorage.getItem("speciesQueryNames");
  const storedImage = sessionStorage.getItem("photoData");
  const multiImageResults = sessionStorage.getItem("identificationResults");

  if (namesRaw) {
    sessionStorage.removeItem("speciesQueryNames");
    let names;
    try { names = JSON.parse(namesRaw); } catch { names = [namesRaw]; }
    displayResults(names, true);
  } else if (multiImageResults) {
    try {
      displayResults(JSON.parse(multiImageResults));
    } catch (e) {
      location.href = "index.html";
    }
  } else if (storedImage) {
    const previewElement = document.getElementById("preview");
    if (previewElement) previewElement.src = storedImage;
    organBoxOnPage.style.display = 'block';
    const toBlob = dataURL => {
      try {
        const [m,b] = dataURL.split(','), [,e] = /:(.*?);/.exec(m), B=atob(b), a=new Uint8Array(B.length);
        for (let i=0; i<B.length; i++) a[i] = B.charCodeAt(i);
        return new Blob([a], { type: e });
      } catch(e) { return null; }
    };
    const imageBlob = toBlob(storedImage);
    if (imageBlob) {
      organBoxOnPage.querySelectorAll("button").forEach(b =>
        b.addEventListener("click", e => identifySingleImage(imageBlob, e.currentTarget.dataset.organ))
      );
    } else {
      showNotification("Erreur lors de la préparation de l'image.", 'error');
    }
  } else {
    location.href = "index.html";
  }
}


if (nameSearchInput) nameSearchInput.addEventListener("input", async e => {
  if (!speciesSuggestions) return;
  await loadData();
  const parts = e.target.value.split(/[;,\n]+/);
  const term = parts[parts.length - 1].trim();
  const q = norm(term);
  if (!q) { speciesSuggestions.innerHTML = ""; return; }
  const matches = taxrefNames.filter(n => {
    const nk = norm(n);
    return nk.startsWith(q) || (nameTrigram[n] && nameTrigram[n].startsWith(q));
  }).slice(0, 5);
  speciesSuggestions.innerHTML = matches.map(n => `<option value="${n}">`).join("");
});

if (typeof document !== 'undefined' && document.addEventListener) {
  document.addEventListener('DOMContentLoaded', () => {
    const trigger = () => { loadData(); };
    document.addEventListener('click', trigger, { once: true });
    document.addEventListener('keydown', trigger, { once: true });
  });
}
