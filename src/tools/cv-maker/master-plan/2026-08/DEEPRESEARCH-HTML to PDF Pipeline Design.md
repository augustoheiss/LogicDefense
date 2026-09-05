# **Architecture and Engineering of Production-Ready HTML-to-PDF Rendering Pipelines in Chromium**

Building a high-throughput, deterministic, and secure HTML-to-PDF generation pipeline using headless Chromium driven by Playwright or Puppeteer requires navigating the low-level interactions between the Blink layout engine, the Skia 2D graphics library, and CSS paged media specifications1. While web browsers are designed primarily for dynamic screen rendering, outputting to a static, multi-page PDF document introduces architectural challenges such as unwanted page breaks, font loading race conditions, vector rasterization artifacts, color space shifts, resource overhead, and security vulnerabilities1.

## **Pagination Mechanics and Elimination of Trailing Blank Pages**

### **CSS Fragmentation Specifications and Legacy Aliases**

Chromium processes document pagination through the CSS Paged Media Module and CSS Fragmentation Module1. Modern layout engines implement break-before, break-after, and break-inside, while maintaining legacy aliases such as page-break-before, page-break-after, and page-break-inside for backward compatibility1. In modern Chromium releases, page-break-after: always is aliased internally to break-after: page1.

| Legacy CSS Property | Modern CSS Standard | Chromium Internal Layout Engine Behavior |
| :---- | :---- | :---- |
| page-break-before: always | break-before: page | Forces a page break immediately before the element box1. |
| page-break-after: always | break-after: page | Forces a page break immediately after the element box1. |
| page-break-inside: avoid | break-inside: avoid | Forbids a fragment split within the interior of the element box1. |
| page-break-after: avoid | break-after: avoid | Prevents page breaks between the current element and the next sibling box1. |

A frequent failure mode in multi-page document generation is the unintended creation of trailing blank pages5. This behavior stems from three primary layout mismatches within the Blink rendering engine:

> 1. **Forced Break Propagation on Terminal Nodes**: When forced page breaks, such as break-after: page, are applied to structural containers where the container happens to be the last child in the DOM tree, Blink executes the break rule regardless of subsequent content1. This appends an empty page box to the output display list1.  
> 2. **Cumulative Element Box Overflow**: Cumulative element padding, margins, or inline-block borders overflowing the target printable page height trigger automatic pagination5. Printable height ![][image1] is calculated as:  
>    ![][image2]  
>    When an element’s bottom box edge aligns perfectly with or exceeds ![][image1] by even a fraction of a pixel, Blink creates an additional fragment container, yielding a blank or near-blank final page5.  
> 3. **Margin Collisions**: Uncollapsible margins on the root \<body\> element or container elements interacting with CSS @page declarations can push content over page thresholds5.

To resolve terminal node page breaks, the CSS pseudo-class :last-of-type or :last-child should be leveraged to reset break behaviors on final structural containers:

CSS  
.page-container {  
  break-after: page;  
}

/\* Prevent trailing blank page by clearing forced breaks on the final section \*/  
.page-container:last-of-type {  
  break-after: auto \!important;  
  page-break-after: auto \!important;  
}

### **Margin Collisions and Page Geometry**

A major source of unexpected rendering output is the collision between programmatically declared margins in Playwright/Puppeteer script parameters and CSS-declared margins within @page rules10. When options are passed to the Chrome DevTools Protocol (CDP) Page.printToPDF command via library APIs, Chromium sets default printable bounds for the page frame10. If the document's CSS also specifies @page { margin: 1.6cm; }, these margins can stack or cause element box clipping10.  
To maintain deterministic layout control, programmatic margins in the execution script should be set to 0 or preferCSSPageSize: true should be explicitly passed, delegating all geometry definitions directly to stylesheet rules10.

CSS  
/\* Unified Page Geometry Rules \*/  
@page {  
  size: A4 portrait; /\* 210mm x 297mm \*/  
  margin: 20mm 15mm 20mm 15mm;  
}

html, body {  
  margin: 0;  
  padding: 0;  
  background-color: \#ffffff;  
}

### **Table Pagination and Row-Group Semantics**

Tables spanning across multiple pages frequently suffer from sliced rows or missing table headers8. To prevent mid-row fragmentation and guarantee that table headers repeat on every page fragment, specific display and fragmentation rules must be assigned to table sub-elements7.

CSS  
/\* Force repeating headers across page boundaries \*/  
thead {  
  display: table-header-group;  
  break-inside: avoid;  
}

/\* Prevent individual table rows from splitting across pages \*/  
tr {  
  break-inside: avoid;  
  page-break-inside: avoid;  
}

/\* Ensure table body maintains row-group formatting \*/  
tbody {  
  display: table-row-group;  
}

Applying display: block to \<thead\> or \<tbody\> breaks the structural table semantics in Blink, disabling automatic header repetition across pages and corrupting column alignment7. Similarly, placing break-inside: avoid on the entire \<table\> container forces the entire table onto a single page if possible, but if the table height exceeds ![][image1], Chromium overrides the property, leading to uncontrolled splits7.

### **Calculated Layout Truncation**

In scenarios where dynamic third-party HTML generates unpredictable trailing whitespace, a programmatic pass using DOM element geometry can calculate the exact required page count before rendering the PDF5.  
Chromium's headless layout engine operates at a base logical resolution of 96 CSS pixels per inch5. For standard paper sizes, the logical pixel dimensions are:

* **Letter**: ![][image3]  
  \[cite: 5\]  
* **A4**: ![][image4]

Using these metrics, the client script can calculate the total pages ![][image5] based on the document scroll height ![][image6] and pass an explicit pageRanges parameter to the rendering method:  
![][image7]  
Passing pageRanges: '1-' \+ N to page.pdf() forces Chromium to truncate any trailing layout fragment that contains no content5.

JavaScript  
// Dynamic page truncation pass in Playwright  
const pageHeightPixels \= 1122.5; // A4 height at 96 DPI  
const totalPages \= await page.evaluate((height) \=\> {  
  return Math.max(1, Math.round(document.body.scrollHeight / height));  
}, pageHeightPixels);

await page.pdf({  
  path: 'output.pdf',  
  format: 'A4',  
  pageRanges: \`1-${totalPages}\`  
});

## **Deterministic Font Loading, SVG Vector Preservation, and Color-Space Accuracy**

### **Deterministic Font Loading Strategies**

When Chromium renders a document to PDF, asynchronous font loading introduces Flash of Unstyled Text (FOUT) or Flash of Invisible Text (FOIT) artifacts4. If page.pdf() is invoked while web fonts are in the process of downloading or parsing, Chromium renders the PDF using fallback system fonts or transparent glyphs, altering character metrics and line wrapping4.  
To eliminate non-deterministic font rendering:

> 1. **Font Face Loading Verification**: Execute document.fonts.ready prior to calling the print command4. This returns a Promise that resolves only when all referenced font faces are fully fetched and parsed into the browser context.  
> 2. **Font Embedding**: Inlining Base64-encoded WOFF2 strings inside @font-face CSS blocks removes network latency and external fetch dependencies entirely.  
> 3. **Environment Uniformity**: Lock the Chromium binary version across development and production environments4. Variations in font rendering engines between OS builds (e.g., FreeType on Linux vs. DirectWrite on Windows) cause slight font metric deviations that change line breaks and total page counts4.

JavaScript  
// Node.js Playwright Deterministic Font Await Pattern  
await page.goto(documentUrl, { waitUntil: 'networkidle' });

// Ensure all CSS Font Loading API fonts are fully active  
await page.evaluate(async () \=\> {  
  await document.fonts.ready;  
  if (document.fonts.status \!== 'loaded') {  
    throw new Error('Font face initialization failed');  
  }  
});

await page.pdf({ path: 'output.pdf', format: 'A4' });

### **SVG Vector Preservation vs. Skia Rasterization**

Chromium utilizes Google's Skia graphics engine to translate DOM elements into PDF primitives2. SVG elements are naturally converted into native PDF vector graphics paths (/Path objects), preserving sharp edges at arbitrary zoom levels14. However, specific CSS properties force Skia to treat the SVG element as a composited layer, causing it to rasterize the vector graphic into a low-resolution bitmap texture within the PDF document structure14.

| Element / CSS Styling Applied | Skia PDF Output Format | Vector Preservation Status |
| :---- | :---- | :---- |
| Pure Inline SVG (\<path d="..."\>) | Native PDF Vector Path (/Path) | Preserved (Pixel-perfect at any scale)14 |
| SVG with Inline Gradient (\<linearGradient\>) | Native PDF Shading Pattern (/Shading) | Preserved14 |
| SVG with CSS filter: drop-shadow() | Bitmap Image Stream (/XObject /Image) | Lossy (Rasterized to fixed-DPI bitmap)14 |
| SVG inside Container with opacity: 0.9 | ExtGState Soft Mask / Vector Group | Preserved (If supported by PDF spec target)14 |
| SVG with transform: translate3d() | Rasterized Composited Sub-layer | Lossy (Promoted to GPU/bitmap layer)14 |

Rasterization triggers include:

* **CSS Filters**: Properties such as filter: drop-shadow(), blur(), or hue-rotate() applied directly to SVG parent containers14.  
* **Complex Clipping and Masking**: CSS-based clip-path or mask applied via external raster images14.  
* **Hardware Acceleration Layers**: CSS transform properties that promote elements to GPU layers (e.g., transform: translateZ(0) or will-change: transform).  
* **Non-Standard Blend Modes**: mix-blend-mode values other than normal17.

To enforce pure vector export, icons and vector graphics must use inline SVG attributes (e.g., \<svg fill="..."\>) rather than CSS filter effects, and container elements must remain free of layer-promoting CSS properties.

### **Color-Space Preservation and CMYK Management**

When printing web content, Chromium’s default behavior hides background colors and non-essential graphic assets to save ink. To override this, the CSS rule print-color-adjust: exact (or its legacy vendor alias \-webkit-print-color-adjust: exact) must be declared on the root or target elements.

CSS  
\* {  
  \-webkit-print-color\-adjust: exact \!important;  
  print-color\-adjust: exact \!important;  
}

Regarding color space conversions, Chromium processes colors within an sRGB pipeline2. Skia maps sRGB inputs into an intermediate XYZ D50 connection space before rendering2.  
Because Chromium's print pipeline is tailored for standard desktop engines rather than commercial prepress workflows:

* CSS color functions such as rgb(), hsl(), and color(srgb ...) are exported directly as sRGB streams inside the generated PDF2.  
* Native CMYK export is **not supported** natively by Chromium's PDF engine19. If CMYK values are provided via color(device-cmyk ...) rules, standard Chromium builds fall back to sRGB approximations20.

For applications requiring strict prepress CMYK or PDF/X compliance, the generated sRGB PDF must undergo post-processing through specialized color management utilities (such as Ghostscript, pdfmark, or custom LCMS pipelines) to apply ICC profiles and perform vector color transformation18.

## **High-Throughput Performance Optimization Architecture**

### **Browser Context Pooling**

Launching a headless Chromium browser instance (chromium.launch()) requires executing a heavy OS process, consuming 100MB+ of memory and taking 300ms to 1000ms in execution overhead4. In high-throughput PDF generation microservices, launching a new browser process per document destroys system performance4.  
The optimal architectural pattern uses **Browser Context Pooling**4:

* **Browser Instance**: A single master Chromium process is launched and kept alive continuously4.  
* **BrowserContext**: For each PDF generation task, a new isolated BrowserContext is instantiated via browser.newContext()4.  
* **Page Isolation**: A single Page is opened within the context, the document rendered, the PDF generated, and the context destroyed (context.close())4.

| Pooling Strategy | Creation Latency | RAM Usage per Request | Process Isolation Security |
| :---- | :---- | :---- | :---- |
| **New Browser per Request** | High (300ms–1200ms)4 | Very High (\~150MB)4 | Maximum (Separate OS processes)4 |
| **Browser Context Pooling** | Minimal (5ms–20ms)4 | Low (\~10–20MB)4 | High (Isolated memory sandboxes)4 |
| **Single Page Reuse** | Ultra-Low (\<2ms)4 | Minimal (\<5MB)4 | Low (Risk of cross-request state pollution)4 |

This context-pooling pattern provides total memory and session isolation between concurrent jobs while reducing generation latency to the time required for DOM layout and PDF serialization4.

### **Serverless Execution and Cold-Start Mitigation**

Deploying Chromium within serverless runtimes (such as AWS Lambda or Vercel) introduces constraints regarding binary size limits and cold-start latency14.  
To optimize execution in serverless environments:

> 1. **Minified Chromium Binaries**: Utilize lightweight Chromium builds (e.g., @sparticuz/chromium) stripped of audio, video, and non-essential driver codecs.  
> 2. **Chromium Process Execution Flags**: Pass low-overhead startup flags to disable unnecessary background services22:

JavaScript  
const browser \= await playwright.chromium.launch({  
  args: \[  
    '--headless=new',                 // Modern efficient headless engine  
    '--disable-gpu',                  // Force software rendering path  
    '--disable-dev-shm-usage',        // Prevent /dev/shm memory exhaustion  
    '--disable-setuid-sandbox',       // Bypass container namespace checks  
    '--no-first-run',                 // Skip initial setup checks  
    '--no-zygote',                    // Reduce subprocess spawning overhead  
    '--single-process',               // Run renderer and browser in one process (Serverless only)  
  \],  
});

### **Offline Single-File HTML Bundling**

Network I/O is a major bottleneck in PDF generation4. Fetching external CSS files, Google Fonts, and remote images over HTTP during page load introduces network latency and timeout errors4.  
The optimal pattern is compiling the document into a **standalone, self-contained HTML payload**:

* Inline all CSS styles directly into \<style\> tags.  
* Encode all image assets as Base64 Data URIs (data:image/png;base64,...).  
* Bundle all custom typography as embedded Base64 WOFF2 strings inside @font-face.

Once assembled, the complete document payload is pushed directly to the browser instance using page.setContent(htmlString, { waitUntil: 'domcontentloaded' }). By preventing all external sub-resource network requests, document load latency is reduced to near 0ms, allowing local rendering to proceed immediately4.

## **Security Hardening and Input Sandboxing**

Rendering untrusted, user-supplied HTML or Markdown in a server-side headless browser introduces severe security risks, including Cross-Site Scripting (XSS), Server-Side Request Forgery (SSRF), DOM clobbering, and unauthorized access to the local host file system6.

| Threat Vector | Mechanism | Primary Mitigation Strategy |
| :---- | :---- | :---- |
| **Cross-Site Scripting (XSS)** | Injection of \<script\> tags or event handlers (onload, onerror)6. | DOMPurify sanitization with strict element allowlists6. |
| **Server-Side Request Forgery (SSRF)** | Embedded images or iframes fetching internal cloud metadata IPs (e.g., 169.254.169.254)6. | Playwright network routing interception (page.route())4. |
| **Local File Exfiltration** | Resource references targeting file:///etc/passwd or system files6. | Aborting non-approved protocols and disabling local file schemes6. |
| **SVG Script Injection** | Scripting payloads embedded within SVG \<script\> or \<foreignObject\> tags6. | SVG protocol stripping and strict CSP meta headers6. |

### **DOM Sanitization with DOMPurify**

Before user input is injected into the browser layout engine, it must be sanitized using a DOM-aware parsing library such as DOMPurify6. Regex-based sanitization is insufficient to prevent advanced XSS payloads6.

JavaScript  
import { JSDOM } from 'jsdom';  
import DOMPurify from 'dompurify';

const window \= new JSDOM('').window;  
const purify \= DOMPurify(window);

// Strict DOMPurify Configuration for Document Generation  
const cleanHtml \= purify.sanitize(userSubmittedHtml, {  
  ALLOWED\_TAGS: \[  
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'p', 'a', 'b', 'i', 'strong', 'em',  
    'table', 'thead', 'tbody', 'tr', 'th', 'td', 'ul', 'ol', 'li',  
    'div', 'span', 'img', 'svg', 'path', 'defs', 'g'  
  \],  
  ALLOWED\_ATTR: \[  
    'href', 'src', 'alt', 'class', 'style', 'id',  
    'width', 'height', 'viewBox', 'd', 'fill', 'stroke'  
  \],  
  ALLOWED\_URI\_REGEXP: /^(?:(?:https?|mailto|data):|\[^a-z\]|\[a-z+.\\-\]+(?:\[^a-z+.\\-:\]|$))/i,  
  ADD\_ATTR: \['target'\],  
  FORBID\_TAGS: \['script', 'iframe', 'object', 'embed', 'form', 'input'\],  
  FORBID\_ATTR: \['onerror', 'onload', 'onclick', 'onmouseover'\],  
});

SVG elements require stringent sanitization rules, as they can embed executable JavaScript within \<script\> tags, animation tags (\<animate\>), or nested \<foreignObject\> elements6.

### **SSRF and Local File Access Prevention**

Headless Chromium will attempt to resolve any network resource or system path specified in source attributes (e.g., \<img src="file:///etc/passwd"\> or \<img src="http://169.254.169.254/latest/meta-data/"\>)6.  
To mitigate SSRF and local file access:

> 1. **Disable Local File Scheme Access**: Never load HTML using file:// URLs. Pass HTML content strictly via page.setContent().  
> 2. **Playwright Route Interception**: Intercept and abort all outbound network requests that do not target explicitly approved asset domains4:

JavaScript  
// Strict Network Request Interception in Playwright  
await page.route('\*\*/\*', (route) \=\> {  
  const url \= route.request().url();  
    
  // Allow internal data URIs  
  if (url.startsWith('data:')) {  
    return route.continue();  
  }  
    
  // Abort access to local file systems, metadata addresses, and internal networks  
  if (  
    url.startsWith('file:') ||  
    url.includes('169.254.169.254') ||  
    url.includes('localhost') ||  
    url.includes('127.0.0.1')  
  ) {  
    return route.abort();  
  }  
    
  const allowedOrigins \= \['https://assets.yourdomain.com'\];  
  const isAllowed \= allowedOrigins.some(origin \=\> url.startsWith(origin));  
    
  return isAllowed ? route.continue() : route.abort();  
});

> 3. **Content Security Policy (CSP) Injection**: Ensure the HTML template includes a restrictive CSP meta header to disable script execution and untrusted fetches at the browser engine level26:

HTML  
\<meta http-equiv\="Content-Security-Policy"   
      content\="default-src 'none';   
               img-src 'self' data: https://assets.yourdomain.com;   
               style-src 'unsafe-inline' https://assets.yourdomain.com;   
               font-src data: https://assets.yourdomain.com;"\>

### **Container Process Hardening**

In containerized deployments (such as Docker), running Chromium with the \--no-sandbox flag bypasses OS-level security namespaces22. If an attacker bypasses DOMPurify and achieves arbitrary code execution within the rendering engine, disabling the sandbox grants full access to the host container6.  
To securely run Chromium in container environments:

* Avoid executing processes as root. Create a dedicated, unprivileged system user inside the Dockerfile (e.g., USER node or USER pwuser).  
* Configure the container kernel with appropriate security profiles (seccomp and AppArmor) to grant Chromium the necessary system calls for process cloning without needing root privileges.  
* Set the container filesystem to read-only mode, mounting a temporary tmpfs volume exclusively at /tmp for Chromium’s transient operations.

## **Architectural Synthesis and Operational Blueprint**

A production-grade HTML-to-PDF rendering system relies on a tightly coupled sequence of layout control, asset bundling, performance management, and security sandboxing1. The workflow begins by compiling raw markdown or HTML templates into self-contained single-file HTML strings where styles, images, and fonts are inlined as Base64 assets4. This string undergoes strict DOM-level sanitization via DOMPurify to strip script elements, event listeners, and dangerous SVG structures6.  
Once sanitized, the HTML is pushed directly into a pre-warmed Chromium instance managed under a Browser Context pool4. The page context enforces strict network routing rules, blocking all outbound traffic to non-whitelisted domains, loopback addresses, metadata IPs, and local file:// URIs4. Within the layout engine, typography is verified via document.fonts.ready before rendering begins4.  
CSS fragmentation rules ensure clean multi-page output: :last-of-type selectors strip forced breaks from terminal elements, display: table-header-group maintains repeating headers across page boundaries, and vector elements remain free of layer-promoting CSS filters to preserve native Skia vector paths (/Path)1. Page geometry is governed strictly by @page stylesheet blocks while programmatic script margins are kept at zero10.  
Finally, the browser serializes the layout into a binary PDF stream4. The temporary BrowserContext is closed immediately upon completion, returning the master browser process to the pool for zero-latency reuse in subsequent rendering operations4. This multi-layered architecture guarantees deterministic, high-resolution document exports capable of handling untrusted input at enterprise scale1.

#### **Referências citadas**

> 1. page-break-after CSS property \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/page-break-after](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/page-break-after)  
> 2. Skia Color Management, [https://skia.org/docs/user/color/](https://skia.org/docs/user/color/)  
> 3. Graphics and Skia \- The Chromium Projects, [https://www.chromium.org/developers/design-documents/graphics-and-skia/](https://www.chromium.org/developers/design-documents/graphics-and-skia/)  
> 4. How to Generate PDFs with Playwright \- BrowserStack, [https://www.browserstack.com/guide/playwright-pdf-html-generation](https://www.browserstack.com/guide/playwright-pdf-html-generation)  
> 5. pdf always print an extra page. last page always blank ... \- GitHub, [https://github.com/puppeteer/puppeteer/issues/6704](https://github.com/puppeteer/puppeteer/issues/6704)  
> 6. How does DOMPurify ensure that sanitized HTML is safe for, [https://dompurify.com/how-does-dompurify-ensure-that-sanitized-html-is-safe-for-injection-into-the-dom-2/](https://dompurify.com/how-does-dompurify-ensure-that-sanitized-html-is-safe-for-injection-into-the-dom-2/)  
> 7. Prevent page breaks in puppeteer pdf \- Stack Overflow, [https://stackoverflow.com/questions/75185272/prevent-page-breaks-in-puppeteer-pdf](https://stackoverflow.com/questions/75185272/prevent-page-breaks-in-puppeteer-pdf)  
> 8. How to Fix PDF Page Breaks in HTML (The Complete Guide), [https://dev.to/digital\_trubador/how-to-fix-pdf-page-breaks-in-html-the-complete-guide-1m7g](https://dev.to/digital_trubador/how-to-fix-pdf-page-breaks-in-html-the-complete-guide-1m7g)  
> 9. Common Issues in HTML-to-PDF Printing (and How to Fix Them), [https://www.customjs.space/blog/html-to-pdf-issues](https://www.customjs.space/blog/html-to-pdf-issues)  
> 10. Issue with margins when print to PDF \#2592 \- GitHub, [https://github.com/puppeteer/puppeteer/issues/2592](https://github.com/puppeteer/puppeteer/issues/2592)  
> 11. How to set different page margins for specific pages in puppeteer, [https://community.latenode.com/t/how-to-set-different-page-margins-for-specific-pages-in-puppeteer-pdf-output/35879](https://community.latenode.com/t/how-to-set-different-page-margins-for-specific-pages-in-puppeteer-pdf-output/35879)  
> 12. Puppeteere/Chromium pdf printing ignores css page-breaks in tables, [https://stackoverflow.com/questions/59124560/puppeteere-chromium-pdf-printing-ignores-css-page-breaks-in-tables](https://stackoverflow.com/questions/59124560/puppeteere-chromium-pdf-printing-ignores-css-page-breaks-in-tables)  
> 13. Docbook | Hacker News, [https://news.ycombinator.com/item?id=21436245](https://news.ycombinator.com/item?id=21436245)  
> 14. skia-canvas | Yarn, [https://classic.yarnpkg.com/en/package/skia-canvas](https://classic.yarnpkg.com/en/package/skia-canvas)  
> 15. Release Notes | Skia Canvas, [https://skia-canvas.org/releases](https://skia-canvas.org/releases)  
> 16. ImageSharp \- Six Labors Documentation, [https://docs.sixlabors.com/articles/toc.pdf](https://docs.sixlabors.com/articles/toc.pdf)  
> 17. (PDF) Semantics for 2D Rasterization \- ResearchGate, [https://www.researchgate.net/publication/403154389\_Semantics\_for\_2D\_Rasterization](https://www.researchgate.net/publication/403154389_Semantics_for_2D_Rasterization)  
> 18. GitHub \- AndyCappDev/stet: A PDF rendering engine and PostScript, [https://github.com/AndyCappDev/stet](https://github.com/AndyCappDev/stet)  
> 19. Feasability of adding PDF/X support, exporting "sRGB objects" in PDF, [https://groups.google.com/g/skia-discuss/c/ze7IAEH5YkA](https://groups.google.com/g/skia-discuss/c/ze7IAEH5YkA)  
> 20. The CMYK Problem Nobody Warns You About When Building a, [https://dev.to/vjmanoj/the-cmyk-problem-nobody-warns-you-about-when-building-a-pdf-editor-in-the-browser-3a02](https://dev.to/vjmanoj/the-cmyk-problem-nobody-warns-you-about-when-building-a-pdf-editor-in-the-browser-3a02)  
> 21. C\# HTML to PDF with Playwright .NET: Full Guide \- PDFBolt, [https://pdfbolt.com/blog/html-to-pdf-playwright-csharp-dotnet](https://pdfbolt.com/blog/html-to-pdf-playwright-csharp-dotnet)  
> 22. List of Chromium Command Line Switches \- Peter Beverloo, [https://peter.sh/experiments/chromium-command-line-switches/](https://peter.sh/experiments/chromium-command-line-switches/)  
> 23. HTML Sanitizer API \- GitHub Pages, [https://wicg.github.io/sanitizer-api/](https://wicg.github.io/sanitizer-api/)  
> 24. DOMPurify – Fast & Secure XSS Sanitizer for HTML, [https://dompurify.com/](https://dompurify.com/)  
> 25. DOMPurify \- a DOM-only, super-fast, uber-tolerant XSS sanitizer for, [https://github.com/cure53/dompurify](https://github.com/cure53/dompurify)  
> 26. LLM-rendered HTML and Markdown — the XSS vector ... \- Vibe Eval, [https://vibe-eval.com/patterns/llm-rendered-html-markdown/](https://vibe-eval.com/patterns/llm-rendered-html-markdown/)  
> 27. Are user-uploaded SVGs an XSS risk? How can you sanitize an SVG?, [https://stackoverflow.com/questions/10557137/are-user-uploaded-svgs-an-xss-risk-how-can-you-sanitize-an-svg](https://stackoverflow.com/questions/10557137/are-user-uploaded-svgs-an-xss-risk-how-can-you-sanitize-an-svg)  
> 28. sanitize-html vs DOMPurify vs xss 2026 — PkgPulse Guides, [https://www.pkgpulse.com/guides/sanitize-html-vs-dompurify-vs-xss-xss-prevention-2026](https://www.pkgpulse.com/guides/sanitize-html-vs-dompurify-vs-xss-xss-prevention-2026)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEsAAAAaCAYAAAD/nKG4AAADDElEQVR4Xu2YW8hMURiGP6EccyZRpChFCDdIiHJIyamQXAglbhxSlAtRKDcOKYkokXP9DoWEC4fcuJLcmAtRhBIl5/fx7WX2LP/Mb8bMlGa/9fTv2e9ea9b+1re+tf4xy5QpU6b/V5PFa/EjxVuxVPQUt8W3lPdBnBIdadyoOiy+i6mxYX4P76hoFXkNp27iociJfoXWL20yz6olsdGIGireiLOiTeTxmfv4PNfwImPIHDIoFpmWM888MrDhtVd8FXNE34gF5vWKZxpeoV59FMfFoYhnltWr36pHveoitouRsfGPmijeiWOxYaW9ihXq1brYsOrVq/7ippgSG0XEUWV0fLOI5lrxgMy24l5F4nz1RUyIDfN7ePWsV5zjdtjfB6tUQEp5ZauS81U7sVFcF2vFAXFOjE/85eKGeaZeEPOTexfNM2ag2G9eDxeK8+Kg6CXai13iU9J2p+iaeCzj3eaTO8TyIiBNYoO4JFab9xO8dLAYIwfrk2KelXnAZvYo7M3VK4JyWbwXIyKvh7gvFpl/If5jMUq0NX9RArJMbEueOWE+eDRWPLd8NhOAUAY6mQc2nVnTxVPRRwwznwzGgOjzjnldRGvMg8/7pIPF2K6YtwOu6atFMcMvrPD/wVfmL09HZM3nlMc1L9uBxvbnC4WNgOWDGGAITFD6Hu0emR9NEBkcznhx30FMwhixwnw1hLZx9tCOiRsUeYyNoJLpwHU8xpqouRdiUGRIuI4HUkmweovu5kF6IKaZbxa3rHSwcubZnvYYW9XqVznihZrMlxMKy5KdCVUrWJOSv7QNPhlz17zmDDfvk6xnqSOW7DXzftLB4n56uQ42b19zMRAGdNr8pxyK9BbzpbJKvEx8CjviL4fbe2Km+YZAEWeXXSyeJMwwf+k9Yp95HeO7mAQyixrI91Am6GOAmCWOmAdzpXk94zwHjIGfnzabl5D14ox5P1stH7iaKj377FZsBtVWZ9E69ZmJYEmGDIrVkh/Ec3UJUhBHjqtiXGxkKhRZxPpnR6FuhLqTKVOmTLXQT0betrkxpndwAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAzCAYAAAAq0lQuAAAGeUlEQVR4Xu3dW6jlUxzA8Z9ccg0RCTWJByHk8oByyQOF3HPNg9wyL5Q7EVFChIlBDOLBXUghxiWReZCQRDMplOJBeHBfX+u/Zq+z5uxz9pz2tvc58/3Ur/P/r7322eu/13/6/+a3/nufCEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSJEmSpNHaMsXStlFztmGKu9pGSZIm0eEp/unipxRnp3g7xV9d2y8pNlvde2F5N3rHvizFxpGPl32O/9PVPSfDkhQXVvsbpXg4esfQ2iR6jzGv41CP8YLmMYx7jNukOLBtlCRpEn2UYlXTdkWKM5u2hejmFMdV+/ul+DXFBlXbJCCxWdw2du5N8XXTtijF9V379lMfGorb24ZZMMZHm7ZFMdoxDur9tkGSpEn0Y4pnqn2SFfZ3r9oWIipqr6TYpWojSZ2uWjVuJJL95uOEFMtTbF61kXAfHHkeR5F83tM2zGIcYxwUSfs4X1+SpIH8meL4FDt0cUqKv6f0WJiOjHyc5biJL1J8VneaEG11qiDZJPG8u9sGy3xU5EiIDunahm1tErYyxu+7bfwfYxwUyfABbaMkSZNk68hLgI+leKCLlTGZVabpfDNDrEixa6/rGqiscJzluAn262rjJKAqtbxt7JTl3EsjJx3rRb7PrVQPR7XUuDYJWxnjb/H/jnFQJOrHto2SJE0SlgC52NdWRb6vbRB7R755vx+qWFQwpvNErHmhbPdHiYrPG9U+icQfMdqKD0nKZTE1Sazj3F7X1folbLQ/3m2TCDGPN0SuXpXqYcHjfMBkrraLqeOkElnvH93rOkU9RhK2mcY43fnQujh6y6rMV73EOlckbO2/AUmSJspDsWaCQtLCEtswUMXql7CxzNdeoNv92dTLmW1QueGrG/qhmsb4CqqNLIduW7VNgn4JG8uLD1bbzBlJEK6OPI/F4lj793Ymg1bY6jGSIM80xunOh9b90UvSmN9hJWyzva4kSWPVfiKSCtDPkStnxQcpTu/aPo9cHSEBuDHFFile7vpRxSnJX6lYvBC9hO3LyBdZqlr8Di7QV0W+l4l+KBdOltFItl6L0SyZcaGv76kCXztRV1p4/WtTrB95eZUxvdr1KQnLUZHfPx7bLfJ7wLERe3Z9hoFEh7mpLUtxYrfN8dSfFOXY6qXdOhnaN/L4sCRy5e2TyBUr5nWQJGjQhG1Z9Ma4PGYfY30+tOPkfaa9jI/zqmzz+FmR+/M8juXJyHP4beQxkCBO9x8R5qzfBzokSRorqhzfRa4y/RA5IXs9xe9dGz837fqWpIsLJhdYLpIlCWO7JFu0Ua0AN5OjTti4eO4febmVfnUSQX9+P/vldU6OnCyW5w8LS7jlOPneNb4rjO+gK98HVn//WhkflbiSXJBAsnyHkuCRqFKhox/jJoZZtSEhLJU/EjeWGct4SzsJy16Rk+ryGPOK+r2uq4r05f0tc0gC21ZcpzNbwjbdGB+JwcfI+XBLtw36M7Z+CVs5DpTjK+fgOyl26vZ5jRa3BQySpEqSNNFeil7liARqLgkbUdr43quTIl88qXxQDeF7ulAu2FR6SNyolizq2sahVIeejzz+jyMfI0kBF3ru3eIvEJSlVypu7IPEZFjKe8TPuSjJ0GGRj4kqFqhgMjelSkq1bedueybHtA1D0J4P7TjLucbPcg7ykw8w8DjvPf3LnJXzbXnkOeuXsHFOS5I073ExfCrFcymuSXFd5ASGZIVlJip0VGWejbzkdEbkm9J5/I7I1RgurB+mOCdyJY++t6W4M3Lyw4V0n8ivxe/cKsV9KS6Jme9DGzWWQPkgAPdh8RcfXow8buKiyFWfUik6NPLy6dORj7MkbsPyVoo92sYBnRd5/qg08X6SEJ0feSmQxOerbv+98oQxaM+Hdpx4M8WV3TYfhGD7tO5xzin68zyWt1dEPhdZ9l/a7a/875k9JIeXN22SJM1LJC0HtY3rAJKvU9vGChf7W7ufYAmwVIRG5Yi2YQiYW+Z4XbNjTF0eliRp3uJeJO7HYglzXUNyRPWm/mBCi6SOD1/cFPP3b64yt8xx+6EGSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZps/wLyGixmxZZu3wAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,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>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABHElEQVR4XmNgGAWUAkcgfg3E/6F4BxBzIsnzAfEuJHkQXgfE3EhqUAAjEM8C4l9A/BOILVGlwSAIiNcwoFqEFQgC8UIgzmeA2DyFAWIBMigC4mg0MaxAH4j7gVgSiK8D8RMgVkSSZwHi2VB1BAHIxnQou4EB4rocuCwDgwgDxOUgHxAEfUBsDGXrAPF7ID4BxPxQMRsgngxl4wWw8ALZDgIgLy0H4n9A7AEVA7mapPBCDnCQISDDQIaCYo+s8IIBkPdA3gR514mByPACuQYUFqboEkAQwwCJiGtA3IkmhxWghxcyEGeAJBOQgUSFF8gLoKzBhS4BBQ1A/BaINdHEUYALEH9hQOQ1UBbyRlEBAaBkAsqrBMNrFIyCIQMA260zNBT6yKgAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAaCAYAAAAaAmTUAAACH0lEQVR4Xu2XTahNURTH/0L5eIV4SSJJ8pEkyUR6ijIhKUXIgDA2kY9ioh4z8k2EPNJ7pcSACaaMKRN3IIUYiInv3/+tfXLeJrn35TqD869fd5+19j7tddZee+8r1apVazBaBm/ge4l3sBkmwAP4WvJ9gOsw2oOrqvPwDZbnDoXNvoswJPNVTuPgETRg8kBXv3YrsrIxd1RRs+Et9MKwzOdn2+13v8rLX9xf3hnI5Uw1FJlzBiuvY/AF1sCkjHWKenGfyquol49wGc5mPFddLy3pkOIYWAWz4Cnch45Snz+qqJdduUP/p14uKYKxFsJNNRGMz5fPsCR3KGz2tbNeWg6m1fNlJhyGbrgC8xSH6VK4prgh7IcZcDrZDsAF6ISRsAOOwjmYo59qORh3duH/rl5GwG14D/Mz33FYlNqrFe9ZAQ9hPHTBM5iquC69SLYbito7AZsUcv87sCA9Nx2MrycvNfA+9ho2KF5+Dz6VfG5fhVEejA6m/mdgsSIrXq4u4Fz5hKbDk2Qv5ACKsU0HM1j5ktmlWCavFFnxJPaW+hTKJ+QsN5K9kMcWddn2YPbBxNReq6itnYrl4nqw5sIU/Toh/96FlenZ/W8p3mO1PRiv+SOwHk4pNgBPypuCD9ptiix5A+hTLMmTME0h143t2xX1tweGw1bFIf0YtkCPomadtbH9I/+BvFkMVeyG+V8Cbxx/+yXHKIKoVatWreb1AxOpg3us8jITAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABDCAYAAAAh8FnvAAAE5klEQVR4Xu3dXahlYxgH8FeDiGGYQVK+ckNq0lxIoZSLmaQkN5oRJSRzQ8lHlBvFBcX4yldRiGYywpDc4Ea5kRQpmaSUCTdcycfzeNey195z9tnTOWuOvc78fvVvr/Xutfc+5+7fWutdbykAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAQ7Mu8lDk2SaPjb+96mwpo/81c+P42wAA8+fUyOeTg8uwL/J3k+siGyJ/Nvu/RY4ZHfq/uyvy0uQgAMC86buwnRDZGzmtM5bFaGtnf14obADAIPRd2M6N7Iwc3hnL/RyfNwobADAIfRe2xyNXlfq9bf4aO2J+KGwAwCD0Xdg+i7xcxm/sz/vX5pHCBgAMQt+FbbKc5b1sWeKWqy1WmyLHdt9YBoUNABiEPgtbO+Ggqzvh4LBSHyGSl01ztuilkdci90XOabZfjJwUuaXUR4yc9+8nFTYA4BDWZ2HLMpUTDFpHRd6NbGz287fWljohIUvXx5H1kW8ip0d+iLxR6gSFbc1n9jSvChsAMFfyeWV5afGJUs9Kpa+bsUyfD7fts7DNsqbUIvZm5OTIveNvl93Naxa8LGapLVQKGwAwV86OPFdqOdveGd/R2e7LSha2/K1bIzeXWroeLnVSQha3vCT6U+TM5thdzXH3lLoawXeR6yOvlnpJtQ8KGwCwZLl80p2RXyOfNmN5f9jr/x3Rn5UsbHm2MC+Tds+Q5f40x08O9ExhAwCW7PlSZ1duLvUZZnnPV964f0f3oJ6sZGGbNwobALBkeTk0zzzlGaY8w3Z+qZcPL+4e1HFt5PtFkpcbp1HYAACW4PLO9lmRryJPl/HlnvoyrbC1ExxWUyYpbADAkuSEg8n7uvJetmln19IZkWsWyYmjQ/czrbAdChQ2AGBJbiijR3m08oGyGybG+qKwAQDMuVmFLR+p0T4XLnNJ5MvO/i+jQwdHYQMABmFWYUu5jNTPpa5A0Mqlo7LwDJnCBgAMwoEUtpwE8WBnP58Jlwu6H6zLtCtFYQMABmFWYWvXA72o1GMz+VDfhWZdDo3CBgAMwqzClrNWf4y8UOoyUpl9kT+6Bw2UwgYADMKswpaXQifPpv0e2TkxdjB9Usbvn5smy9eVk4OLUNgAgEGYVdg+LPUMW1cWuJx0MG8UNgBgVZpV2LKcdScc5ESDbyOndMa+KPXZcdtLXdg910JNjzSv70c2RT6KHBd5shnfUfZ/5tz6UpfjyvGNkQsi75T6+Vyq673IlsgRpf5WPmak/e22sL0SWVtmr72qsAEAgzCrsB2I3c1rfleWqV2lLqnVlqEPIo9Gbi+1hO1txheSJaz9vpTlL/ezsKUsam812/lb+ZuttrBl6dtWZv9fChsAMAh9FLY8A5YuK7VYteUqy9DWyG1ltNzW0ZE9zfYVkSOb7VYWtreb7SxeV5dRYcszaTdFnmm28yxfzl5NWd7awnZ38/5TzXvTKGwAwCD0UdiyUGW5WtPsZ+nKtPJsV8qzbjnrNOXlzZSF7P5O8hlv+X3ryv5rqi4ki1l+piv/jgP5rMIGABwSsvDlAvOLFaQLIw+Uep/ZLJtL/b7upU4AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAbqH8vwATF97V0NAAAAAElFTkSuQmCC>