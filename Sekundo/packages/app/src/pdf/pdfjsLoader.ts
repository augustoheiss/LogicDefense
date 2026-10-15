/**
 * Local-First PDF.js Loader (`pdfjsLoader.ts`)
 *
 * Resolves A7 & V6:
 * Loads `pdf.min.mjs` and `pdf.worker.min.mjs` from local `/pdfjs/` assets
 * (pre-cached by Service Worker `sw.js`), with CDN fallback only if needed.
 */

let cachedPdfJs: any = null;

export async function loadPdfJsLocalFirst(): Promise<any> {
  if (typeof window === 'undefined') return null;
  if (cachedPdfJs) return cachedPdfJs;
  if ((window as any).pdfjsLib) {
    cachedPdfJs = (window as any).pdfjsLib;
    return cachedPdfJs;
  }

  // Strategy 1: Load local ESM bundle from `/pdfjs/pdf.min.mjs`
  try {
    const localUrl = `${window.location.origin}/pdfjs/pdf.min.mjs`;
    // Dynamic import of local static asset bypassing Metro static analysis
    const dynamicImport = new Function('url', 'return import(url)');
    const mod = await dynamicImport(localUrl);
    if (mod && mod.getDocument) {
      mod.GlobalWorkerOptions.workerSrc = `${window.location.origin}/pdfjs/pdf.worker.min.mjs`;
      (window as any).pdfjsLib = mod;
      cachedPdfJs = mod;
      return mod;
    }
  } catch {
    // Fallback to CDN script if local ESM import fails
  }

  // Strategy 2: Fallback to CDN script
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.min.js';
    script.onload = () => {
      const pdfjsLib = (window as any).pdfjsLib;
      if (pdfjsLib) {
        pdfjsLib.GlobalWorkerOptions.workerSrc =
          'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.4.120/pdf.worker.min.js';
        cachedPdfJs = pdfjsLib;
        resolve(pdfjsLib);
      } else {
        reject(new Error('pdfjsLib unavailable after script load'));
      }
    };
    script.onerror = (e) => reject(e);
    document.head.appendChild(script);
  });
}
