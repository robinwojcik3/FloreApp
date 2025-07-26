import * as pdfjsLib from '../pdfjs/build/pdf.mjs';
try {
  pdfjsLib.GlobalWorkerOptions.workerSrc = './pdfjs/build/pdf.worker.mjs';
  pdfjsLib.GlobalWorkerOptions.wasmUrl = './pdfjs/wasm/';
} catch (e) {
  console.error('PDF.js init error:', e);
}
window.pdfjsLib = pdfjsLib;
