import * as pdfjsLib from '../pdfjs/build/pdf.mjs';

// Configuration du worker
try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = `../pdfjs/build/pdf.worker.mjs`;
    // Permet de charger les modules WebAssembly (JPEG2000, ICC) nécessaires
    // pour le rendu complet du PDF.
    pdfjsLib.GlobalWorkerOptions.wasmUrl = `../pdfjs/wasm/`;
} catch (e) {
    console.error('Erreur de configuration du worker PDF.js:', e);
}

const viewerContainer = document.getElementById('pdf-viewer');
const ocrBtn = document.getElementById('ocr-btn');
const downloadBtn = document.getElementById('download-btn');
let pdfUrlGlobal = '';
let pdfDoc = null;
let genusName = '';
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent);
// Increase render scale for crisper text in generated excerpts
const RENDER_SCALE = isIOS ? 2.5 : 3.0;

function capitalizeGenus(name) {
    if (typeof name !== 'string') return name;
    return name.replace(/^(?:[x×]\s*)?([a-z])/, (m, p1) => m.replace(p1, p1.toUpperCase()));
}

/**
 * Affiche un message d'erreur et un lien de secours.
 */
function displayFallback(title, message, pdfUrl, pageNum) {
    // Utilise un lien direct vers le PDF avec ancre de page pour un comportement
    // cohérent, notamment sur iOS
    const altUrl = `${encodeURI(pdfUrl)}#page=${pageNum}`;
    viewerContainer.innerHTML = `
        <div class="error-message">
            <h2>${title}</h2>
            <p>${message}</p>
            <p>Page cible : ${pageNum}</p>
            <a href="${altUrl}" target="_blank" rel="noopener noreferrer">
                Ouvrir le PDF directement – page ${pageNum}
            </a>
        </div>
    `;
}

/**
 * Rend une page PDF sur son canvas. Appelée par l'IntersectionObserver.
 */
async function renderPageOnCanvas(page, canvas) {
    try {
        const finalScale = (window.devicePixelRatio || 1) * RENDER_SCALE;
        const viewport = page.getViewport({ scale: finalScale });

        const context = canvas.getContext('2d');
        canvas.height = viewport.height;
        canvas.width = viewport.width;

        const renderContext = {
            canvasContext: context,
            viewport: viewport
        };
        await page.render(renderContext).promise;
    } catch (error) {
        console.error(`Erreur lors du rendu de la page ${page.pageNumber}:`, error);
    }
}

/**
 * Fonction principale qui initialise le visualiseur.
 */
async function loadPdfViewer() {
    const urlParams = new URLSearchParams(window.location.search);
    pdfUrlGlobal = urlParams.get('file');
    const initialPageNum = parseInt(urlParams.get('page'), 10) || 1;
    const genParam = urlParams.get('genus');
    if (genParam) genusName = genParam;

    if (!pdfUrlGlobal) {
        viewerContainer.innerHTML = '<div class="error-message"><h1>Erreur : Aucun fichier PDF spécifié.</h1></div>';
        return;
    }

    try {
        const loadingTask = pdfjsLib.getDocument(pdfUrlGlobal);
        pdfDoc = await loadingTask.promise;
        if (ocrBtn) ocrBtn.style.display = 'inline-block';
        if (downloadBtn) downloadBtn.style.display = 'inline-block';

        const observer = new IntersectionObserver(async (entries, self) => {
            for (const entry of entries) {
                if (entry.isIntersecting) {
                    const pageContainer = entry.target;
                    const pageNum = parseInt(pageContainer.dataset.pageNum, 10);
                    
                    self.unobserve(pageContainer);

                    const canvas = document.createElement('canvas');
                    pageContainer.appendChild(canvas);
                    
                    const page = await pdfDoc.getPage(pageNum);
                    renderPageOnCanvas(page, canvas);
                }
            }
        }, { rootMargin: '200px' });

        // Étape 1: Créer des placeholders pour toutes les pages
        const firstPage = await pdfDoc.getPage(1);
        const viewportForRatio = firstPage.getViewport({ scale: 1 });
        const aspectRatio = viewportForRatio.width / viewportForRatio.height;
        
        // La largeur est déterminée par le CSS. On calcule la hauteur du placeholder en fonction.
        const containerStyle = window.getComputedStyle(viewerContainer);
        const maxWidth = parseFloat(containerStyle.maxWidth) || 1000;
        const parentWidth = parseFloat(containerStyle.width);
        const placeholderWidth = Math.min(parentWidth * 0.95, maxWidth);
        const placeholderHeight = placeholderWidth / aspectRatio;

        for (let pageNum = 1; pageNum <= pdfDoc.numPages; pageNum++) {
            const pageContainer = document.createElement('div');
            pageContainer.id = `page-container-${pageNum}`;
            pageContainer.className = 'page-container';
            pageContainer.dataset.pageNum = pageNum;

            // Correction: Ne pas fixer la largeur, fixer seulement la hauteur pour maintenir le ratio
            pageContainer.style.height = `${placeholderHeight}px`;

            viewerContainer.appendChild(pageContainer);
            observer.observe(pageContainer);
        }

        // Étape 2: Sauter à la page cible
        const targetElement = document.getElementById(`page-container-${initialPageNum}`);
        if (targetElement) {
            const scrollFn = () => {
                const top = targetElement.getBoundingClientRect().top + window.pageYOffset;
                window.scrollTo({ top, behavior: 'auto' });
            };
            scrollFn();
            if (isIOS) setTimeout(scrollFn, 150);
        }

    } catch (error) {
        console.error('Erreur lors du chargement du PDF:', error);
        displayFallback('Erreur de chargement', 'Impossible de charger le lecteur PDF.', pdfUrl, initialPageNum);
    }
}

async function extractTextFromDocument(doc) {
    let text = '';
    for (let n = 1; n <= doc.numPages; n++) {
        const page = await doc.getPage(n);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: ctx, viewport }).promise;
        const result = await Tesseract.recognize(canvas, 'fra');
        text += result.data.text + '\n';
    }
    return text;
}

if (ocrBtn) {
    ocrBtn.addEventListener('click', async () => {
        if (!pdfDoc) return;
        ocrBtn.disabled = true;
        const original = ocrBtn.textContent;
        ocrBtn.textContent = 'OCR en cours...';
        try {
            const txt = await extractTextFromDocument(pdfDoc);
            const blob = new Blob([txt], { type: 'text/plain' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            const name = genusName ? capitalizeGenus(genusName) : 'extrait';
            a.href = url;
            a.download = `${name}.txt`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            setTimeout(() => URL.revokeObjectURL(url), 30000);
        } catch (e) {
            console.error('OCR error:', e);
        } finally {
            ocrBtn.textContent = original;
            ocrBtn.disabled = false;
        }
    });
}

if (downloadBtn) {
    downloadBtn.addEventListener('click', () => {
        if (!pdfUrlGlobal) return;
        const a = document.createElement('a');
        const name = genusName ? capitalizeGenus(genusName) : 'extrait';
        a.href = pdfUrlGlobal;
        a.download = `${name}.pdf`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
    });
}

window.addEventListener('unload', () => {
    if (pdfUrlGlobal && pdfUrlGlobal.startsWith('blob:')) {
        URL.revokeObjectURL(pdfUrlGlobal);
    }
});

// Lancement de l'application
loadPdfViewer();
