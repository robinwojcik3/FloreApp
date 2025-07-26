export async function ocrPdfBytes(bytes) {
    const pdfjsLib = await import('../pdfjs/build/pdf.mjs');
    pdfjsLib.GlobalWorkerOptions.workerSrc = '../pdfjs/build/pdf.worker.mjs';
    pdfjsLib.GlobalWorkerOptions.wasmUrl = '../pdfjs/wasm/';

    const { createWorker } = Tesseract;
    const worker = await createWorker({
        workerPath: 'assets/worker.min.js',
        langPath: 'https://tesseract.projectnaptha.com/4.0.2',
        logger: m => console.log(m)
    });
    await worker.loadLanguage('eng+fra');
    await worker.initialize('eng+fra');

    const loadingTask = pdfjsLib.getDocument({ data: bytes });
    const pdf = await loadingTask.promise;
    let text = '';
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const viewport = page.getViewport({ scale: 2 });
        const canvas = document.createElement('canvas');
        canvas.width = viewport.width;
        canvas.height = viewport.height;
        await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
        const { data: { text: pageText } } = await worker.recognize(canvas);
        text += `\n\n# Page ${i}\n${pageText.trim()}`;
    }
    await worker.terminate();
    return text.trim();
}
