import * as pdfjsLib from '../pdfjs/build/pdf.mjs';

pdfjsLib.GlobalWorkerOptions.workerSrc = '../pdfjs/build/pdf.worker.mjs';
pdfjsLib.GlobalWorkerOptions.wasmUrl = '../pdfjs/wasm/';

window.extractTextFromPdfBlob = async function(blob) {
  const data = await blob.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data });
  const pdf = await loadingTask.promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const viewport = page.getViewport({ scale: 2 });
    const canvas = Object.assign(document.createElement('canvas'), {
      width: viewport.width,
      height: viewport.height
    });
    await page.render({ canvasContext: canvas.getContext('2d'), viewport }).promise;
    const result = await Tesseract.recognize(canvas, 'fra');
    text += result.data.text.trim() + '\n';
  }
  return text;
};
