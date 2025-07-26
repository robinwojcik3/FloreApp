import * as pdfjsLib from '../pdfjs/build/pdf.mjs';

try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = '../pdfjs/build/pdf.worker.mjs';
  pdfjsLib.GlobalWorkerOptions.wasmUrl = '../pdfjs/wasm/';
} catch (e) {
  console.error('Erreur configuration PDF.js:', e);
}

window.pdfjsLib = pdfjsLib;
