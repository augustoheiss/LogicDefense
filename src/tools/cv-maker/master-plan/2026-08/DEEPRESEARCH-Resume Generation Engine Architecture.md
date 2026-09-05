# **Architectural Design Patterns for Component-Based Dynamic Resume and CV Document Engines**

Component-based document generation engines designed for rendering dynamic resumes and curriculum vitae (CVs) present complex software engineering challenges1. Unlike standard web applications designed for continuous viewport scrolling, print-targeted document engines operate under immutable physical page boundaries, rigid structural constraints, and strict design requirements1. To deliver visually compelling documents while scaling across dozens of visual styles, engineering teams must separate raw content data from visual presentation logic, implement composable layout algorithms, and systematically evaluate underlying rendering engines2.

## **Decoupled Slot-and-Blueprint Architecture**

A primary structural bottleneck in document generation systems is the tight coupling of dynamic content logic with rendering markup1. When personal details, employment histories, and skill sets are directly embedded into presentation components, modifying visual themes or adding support for new layout variants requires sweeping modifications across the entire codebase2. Resolving this bottleneck requires an architectural pattern that enforces absolute decoupling between a Canonical Content Schema and a Layout Blueprint Schema2.  
The architectural flow transforms raw input data into a fully formatted document through a strict operational pipeline. Raw content, ingested as unstructured or normalized JSON and YAML datasets, is validated against the Canonical Content Schema to ensure semantic integrity2. Concurrently, the engine loads a Layout Blueprint Schema that defines structural slots, layout regions, grid alignments, and thematic tokens2.  
These two decoupled abstractions converge within the Slot Resolution Engine2. This engine evaluates section visibility, applies display filters, and maps normalized content records into designated structural slots such as headers, sidebars, main content channels, and footers2. The resulting resolved map is passed to a polymorphic component factory, which instantiates the appropriate React component tree or native rendering nodes for final layout processing2.

### **Data Schema vs. Blueprint Schema**

The Canonical Content Schema defines domain data in its purest form, free from visual formatting, styling tokens, or positional assumptions2. It represents the user's career facts structured strictly as standardized JSON or YAML schemas2. Conversely, the Layout Blueprint Schema governs visual orchestration2. It dictates how content sections map into structural layout zones (referred to as slots), controls section ordering, toggles visibility, overrides typography scale factors, and specifies visual spacing rules2.

| Architectural Domain | Primary Responsibility | Data Structure Attributes |
| :---- | :---- | :---- |
| **Canonical Content Schema** | Data persistence, schema validation, semantic categorization2. | Normalized arrays, localized text strings, entity IDs, ISO dates2. |
| **Layout Blueprint Schema** | Spatial ordering, slot assignment, thematic rules2. | Grid area maps, slot binding keys, visibility flags, color/font tokens2. |
| **Slot Resolution Pipeline** | Binding content records to layout blueprints2. | Dynamic component mapping, fallback rendering, context propagation8. |

### **Data Model and Slot Resolution Interfaces**

To implement this architecture in TypeScript, the domain data models and layout configurations must be defined as decoupled interfaces.

TypeScript  
export interface WorkExperience {  
  id: string;  
  company: string;  
  position: string;  
  startDate: string;  
  endDate?: string;  
  summary: string;  
  highlights: string\[\];  
}

export interface SkillCategory {  
  id: string;  
  name: string;  
  keywords: string\[\];  
}

export interface ResumeData {  
  basics: {  
    name: string;  
    label: string;  
    email: string;  
    phone: string;  
    location: { city: string; countryCode: string };  
    profiles: Array\<{ network: string; url: string }\>;  
  };  
  work: WorkExperience\[\];  
  skills: SkillCategory\[\];  
  education: Array\<{  
    id: string;  
    institution: string;  
    area: string;  
    studyType: string;  
  }\>;  
}

export type SectionKey \= 'basics' | 'work' | 'skills' | 'education';  
export type SlotIdentifier \= 'header' | 'mainBar' | 'sideBar' | 'footer';

export interface BlueprintConfig {  
  id: string;  
  name: string;  
  layoutType: 'single-column' | 'two-column-left' | 'two-column-right';  
  dimensions: {  
    pageSize: 'A4' | 'LETTER';  
    margins: { top: number; right: number; bottom: number; left: number };  
  };  
  theme: {  
    primaryColor: string;  
    textColor: string;  
    fontFamily: string;  
    fontSizePt: number;  
  };  
  slots: Record\<SlotIdentifier, SectionKey\[\]\>;  
  visibility: Record\<SectionKey, boolean\>;  
}

### **Dynamic Slot Resolution Pipeline**

The slot resolution pipeline ingests the raw content schema alongside a selected layout blueprint, dynamically dispatching mapped content sections into targeted layout regions.

TypeScript  
import React from 'react';  
import { ResumeData, BlueprintConfig, SlotIdentifier, SectionKey } from './types';

interface SlotProps {  
  slotId: SlotIdentifier;  
  blueprint: BlueprintConfig;  
  data: ResumeData;  
  sectionComponents: Record\<SectionKey, React.ComponentType\<{ data: ResumeData }\>\>;  
}

export const DocumentSlotResolver: React.FC\<SlotProps\> \= ({  
  slotId,  
  blueprint,  
  data,  
  sectionComponents,  
}) \=\> {  
  const assignedSections \= blueprint.slots\[slotId\] || \[\];

  return (  
    \<div className={\`document-slot slot-${slotId}\`}\>  
      {assignedSections.map((sectionKey) \=\> {  
        const isVisible \= blueprint.visibility\[sectionKey\] ?? true;  
        const Component \= sectionComponents\[sectionKey\];

        if (\!isVisible || \!Component) {  
          return null;  
        }

        return (  
          \<section key={sectionKey} className={\`section-block section-${sectionKey}\`}\>  
            \<Component data={data} /\>  
          \</section\>  
        );  
      })}  
    \</div\>  
  );  
};

## **Composable Layout Engines under Rigid Page Constraints**

A fundamental engineering challenge in CV generation is managing variable text volume within fixed physical page limits1. Resumes must conform to standardized print specifications—primarily ISO A4 (![][image1]) or North American US Letter (![][image2], equivalent to ![][image3])8. Uncontrolled vertical growth causes visual tearing, orphaned headings, or trailing pages1.  
The spatial constraints of fixed document layouts require strict height management within the page geometry. An A4 document page defines a rigid rectangular boundary8. Within this boundary, the layout engine constructs a structural hierarchy: top-level headers span the full width, while the core body uses CSS Grid or multi-column subgrids to allocate space between asymmetric sidebars and primary content bars3.  
To enforce strict page budgets, the engine monitors section heights3. If content exceeds the page boundary, the layout engine either dynamically scales typography and padding or breaks content across discrete page containers3.

### **Physical Dimensions and Pixel Conversions**

At standard Web CSS resolution (![][image4]), fixed dimensions translate directly to CSS pixel boundaries:

* **ISO A4**: ![][image5]  
  \[cite: 8\]  
* **US Letter**: ![][image6]  
  \[cite: 9\]

At high-resolution print output (![][image7]):

* **ISO A4**: ![][image8]  
  \[cite: 8\]  
* **US Letter**: ![][image9]  
  \[cite: 9\]

Layout engines built with modern CSS Grid and Flexbox must leverage viewport-independent print units (mm, pt, in) to prevent scaling discrepancies between browser screens and generated PDF buffers3.

### **CSS Layout Strategies for Single-Page and Multi-Page Engines**

To enforce single-page or two-page constraints without layout tearing, document builders use CSS Grid container regions coupled with dynamic font and padding adjustments3.

CSS  
@page {  
  size: A4 portrait;  
  margin: 0;  
}

.document-page {  
  width: 210mm;  
  height: 297mm;  
  box-sizing: border-box;  
  padding: 15mm;  
  overflow: hidden;  
  page-break-after: always;  
  background-color: \#ffffff;  
}

.layout-grid-two-column-left {  
  display: grid;  
  grid-template-columns: 65mm 1fr;  
  grid-template-rows: auto 1fr;  
  grid-template-areas:  
    "header header"  
    "sidebar mainbar";  
  gap: 10mm;  
  height: 100%;  
}

.area-header { grid-area: header; }  
.area-sidebar { grid-area: sidebar; }  
.area-mainbar { grid-area: mainbar; }

.section-grid {  
  display: grid;  
  grid-template-columns: subgrid;  
  gap: 4mm;  
}

.section-block {  
  display: flex;  
  flex-direction: column;  
  gap: 3mm;  
  break-inside: avoid;  
}

### **Algorithmic Height Budgeting and Auto-Scaling**

When static content exceeds physical bounds, layout engines must calculate DOM element heights dynamically prior to final PDF rendering3. If content overflows, the engine adjusts layout properties according to a dynamic scaling factor3:  
![][image10]  
If ![][image11] (e.g., ![][image12]), the content cannot fit cleanly on a single page via font scaling alone3. The system then switches to a multi-page pagination pass or reconfigures column layouts3.

TypeScript  
export interface LayoutFitResult {  
  fitsInTargetPageCount: boolean;  
  computedScaleFactor: number;  
  overflowSections: string\[\];  
}

export function computeDocumentLayoutFit(  
  containerRef: HTMLElement,  
  maxPageHeightPx: number \= 1122.5,  
  allowedPages: number \= 1  
): LayoutFitResult {  
  const totalTargetHeight \= maxPageHeightPx \* allowedPages;  
  const contentHeight \= containerRef.scrollHeight;

  if (contentHeight \<= totalTargetHeight) {  
    return {  
      fitsInTargetPageCount: true,  
      computedScaleFactor: 1.0,  
      overflowSections: \[\],  
    };  
  }

  const rawScale \= totalTargetHeight / contentHeight;  
  const clampedScale \= Math.max(0.82, Math.floor(rawScale \* 100) / 100);  
  const isFitPossible \= rawScale \>= 0.82;

  return {  
    fitsInTargetPageCount: isFitPossible,  
    computedScaleFactor: clampedScale,  
    overflowSections: isFitPossible ? \[\] : detectOverflowingNodes(containerRef, totalTargetHeight),  
  };  
}

function detectOverflowingNodes(container: HTMLElement, targetHeight: number): string\[\] {  
  const overflowingIds: string\[\] \= \[\];  
  const sections \= container.querySelectorAll\<HTMLElement\>('.section-block');

  sections.forEach((sec) \=\> {  
    if (sec.offsetTop \+ sec.offsetHeight \> targetHeight) {  
      if (sec.id) overflowingIds.push(sec.id);  
    }  
  });

  return overflowingIds;  
}

## **Comparative Analysis: Declarative Box Models vs. CSS Paged Media vs. Native Compilers**

Building a scalable document generation architecture requires evaluating the trade-offs of competing rendering paradigms1. Modern document engines fall into three primary technical categories:

* **Declarative Box Models (Yoga / Engine-Native DSLs)**: Abstract rendering trees using layout engines (e.g., Yoga flexbox engine in @react-pdf/renderer or structured JSON objects in pdfmake)1.  
* **CSS Paged Media Standards & Browser Engines**: Headless Chromium controlled via Puppeteer or Playwright, browser polyfills like Paged.js, or dedicated C++ rendering binaries like PrinceXML and WeasyPrint1.  
* **Compiled Functional Typesetting Engines**: High-performance native compilers such as Typst, or legacy typesetting frameworks like LaTeX13.

### **Compilation Speed and Operational Latency**

Native compiled binaries, such as Typst (built in Rust), achieve sub-100ms compilation times, rendering 2,000-page documents in approximately one minute13. Headless browser pipelines (Puppeteer and Playwright) incur higher operational latency (![][image13]) due to browser process spawning, DOM construction, asset fetching, and layout passes18. @react-pdf/renderer operates in Node.js memory, executing layout passes rapidly (![][image14]) without external browser processes1.

### **Memory Footprint and Serverless Execution Economics**

Headless Chromium deployments pose operational challenges in serverless environments (e.g., AWS Lambda or Vercel Edge Functions)1. A minimal Chromium binary requires ![][image15] of storage, experiences noticeable cold starts (![][image16]), and consumes ![][image17] of RAM per active tab1. This footprint makes high-concurrency serverless execution costly1.  
In contrast, @react-pdf/renderer compiles to a lightweight JavaScript bundle (![][image18]) with minimal memory consumption1. Typst operates as a statically linked binary (![][image19]) that can execute natively inside serverless functions, compiling hundreds of documents per second13.

### **Layout Determinism and Page-Break Reliability**

Browser layout engines handle continuous Web displays effectively, but often require extra configuration for fixed-page layout constraints1. Unwanted page breaks, split table rows, and orphan headings frequently occur in Puppeteer unless complex custom CSS print rules are configured1. Paged.js polyfills W3C Paged Media by using JavaScript to slice the DOM tree into explicit page containers via CSS multi-column fragmentation3.  
PrinceXML provides robust native implementations of CSS Paged Media specifications (@page, margin-boxes, break-inside: avoid), but requires proprietary server licenses (![][image20] per server)5. @react-pdf/renderer enforces layout bounds through its Yoga flexbox engine, though developers must explicitly set wrap={false} on table primitives to prevent line splits1.

### **Design System and Code Reusability**

Headless browsers and Paged.js allow engineering teams to reuse web UI components, Tailwind styles, and CSS design tokens directly1. Conversely, @react-pdf/renderer does not support standard Web DOM elements (div, span) or standard CSS class structures4. Developers must reimplement interfaces using custom primitives (\<Document\>, \<Page\>, \<View\>, \<Text\>)1. Typst uses a specialized functional markup language, requiring a mapping layer to convert React component props into Typst template parameters15.

### **Engine Architecture Comparison Matrix**

| Technical Metric | @react-pdf/renderer | Puppeteer / Playwright \+ Chromium | Paged.js Polyfill Engine | Typst Native Compiler | PrinceXML Engine |
| :---- | :---- | :---- | :---- | :---- | :---- |
| **Primary Runtime** | Node.js / React Fiber (Yoga C++)4 | Headless Browser (Blink / V8)1 | JS \+ DOM CSS Columns3 | Native Binary (Rust)20 | C++ Purpose-Built Native Engine5 |
| **Average Latency** | **![][image14]** \[cite: 1\] | ![][image21] \[cite: 18, 19\] | ![][image22] \[cite: 3\] | ![][image23] \[cite: 16\] | ![][image24] \[cite: 25\] |
| **Deployment Weight** | **![][image18]** Bundle1 | ![][image25] Package1 | ![][image26] Library12 | ![][image19] Binary13 | ![][image19] Binary5 |
| **Serverless Overhead** | Minimal (Runs in Lambda/Edge)1 | High (Cold starts, high RAM)1 | Moderate (Requires DOM pass)3 | Extremely Low (Fast execution)13 | Low (High server throughput)5 |
| **CSS Reusability** | None (Custom primitives)4 | ![][image27] Web Design System1 | ![][image27] Web Design System3 | No CSS (Functional markup)15 | High (Native CSS Print specs)5 |
| **Page-Break Determinism** | High (Yoga Layout Engine)1 | Low to Moderate (Requires CSS)1 | High (Slices DOM algorithmically)3 | Excellent (Native typesetting)14 | Absolute (CSS Print standard)5 |
| **Licensing Model** | Open Source (MIT)1 | Open Source (Apache / MIT)1 | Open Source (MIT)3 | Open Source (Apache 2.0)13 | Proprietary ($3,800+/server)5 |

## **Scaling Layout Variants without Markup Duplication (5 to 50+ Themes)**

A common challenge when expanding a resume engine from 5 to over 50 visual layouts is avoiding boilerplate markup proliferation. Without abstraction, developers often duplicate core data-rendering logic across every visual template.  
Scaling visual themes efficiently requires a Polymorphic Template Layout System powered by atomic component composition2. Theme design tokens (colors, typography ratios, spacing metrics) and atomic content components (WorkExperienceItem, EducationItem, SkillPill) feed into a central Polymorphic Layout Registry2. This registry maps layout blueprints—such as minimal single-column formats, asymmetric splits, or academic multi-page templates—to specific presentation components, generating the final document without duplicating markup2.

### **Design System Architecture**

> 1. **Atomic Content Renderers**: Components dedicated exclusively to displaying structural content items (WorkExperienceItem, EducationItem, SkillPill). These components remain agnostic of macro-layout attributes2.  
> 2. **Layout Blueprint Containers**: Wrapper structural layouts (ClassicSingleColumn, AsymmetricTwoColumn, ModernGridHeader) that define visual structure and positioning slots2.  
> 3. **Dynamic Registry Mapping**: A central registry object mapping blueprint identifiers to layout components, resolving templates dynamically at runtime8.

### **Implementation Code Pattern**

The following implementation demonstrates how to build a scalable, polymorphic resume builder with React.

#### **Step 1: Define Atomic Content Renderers**

TypeScript  
import React from 'react';  
import { WorkExperience } from '../../types';

export const WorkExperienceItem: React.FC\<{ item: WorkExperience }\> \= ({ item }) \=\> (  
  \<div className="work-item mb-4"\>  
    \<div className="flex justify-between items-baseline"\>  
      \<h4 className="font-bold text-base"\>{item.position}\</h4\>  
      \<span className="text-xs text-gray-600"\>  
        {item.startDate} – {item.endDate || 'Present'}  
      \</span\>  
    \</div\>  
    \<div className="text-sm font-medium text-gray-700 mb-1"\>{item.company}\</div\>  
    \<p className="text-xs text-gray-800 leading-relaxed mb-2"\>{item.summary}\</p\>  
    {item.highlights.length \> 0 && (  
      \<ul className="list-disc list-inside text-xs text-gray-700 space-y-0.5"\>  
        {item.highlights.map((highlight, idx) \=\> (  
          \<li key={idx}\>{highlight}\</li\>  
        ))}  
      \</ul\>  
    )}  
  \</div\>  
);

#### **Step 2: Implement Layout Blueprint Wrappers**

TypeScript  
import React from 'react';  
import { ResumeData, BlueprintConfig } from '../types';  
import { DocumentSlotResolver } from '../DocumentSlotResolver';

export const AsymmetricTwoColumnLayout: React.FC\<{  
  data: ResumeData;  
  blueprint: BlueprintConfig;  
  sectionComponents: any;  
}\> \= ({ data, blueprint, sectionComponents }) \=\> (  
  \<div  
    className="layout-container grid grid-cols-12 gap-6 w-full h-full p-8"  
    style={{  
      fontFamily: blueprint.theme.fontFamily,  
      color: blueprint.theme.textColor,  
      fontSize: \`${blueprint.theme.fontSizePt}pt\`,  
    }}  
  \>  
    \<header className="col-span-12 border-b pb-4 mb-2" style={{ borderColor: blueprint.theme.primaryColor }}\>  
      \<DocumentSlotResolver  
        slotId="header"  
        blueprint={blueprint}  
        data={data}  
        sectionComponents={sectionComponents}  
      /\>  
    \</header\>

    \<aside className="col-span-4 space-y-6 border-r pr-4" style={{ borderColor: '\#e5e7eb' }}\>  
      \<DocumentSlotResolver  
        slotId="sideBar"  
        blueprint={blueprint}  
        data={data}  
        sectionComponents={sectionComponents}  
      /\>  
    \</aside\>

    \<main className="col-span-8 space-y-6"\>  
      \<DocumentSlotResolver  
        slotId="mainBar"  
        blueprint={blueprint}  
        data={data}  
        sectionComponents={sectionComponents}  
      /\>  
    \</main\>  
  \</div\>  
);

#### **Step 3: Implement the Polymorphic Template Registry**

TypeScript  
import React from 'react';  
import { ResumeData, BlueprintConfig, SectionKey } from '../types';  
import { AsymmetricTwoColumnLayout } from '../layouts/AsymmetricTwoColumnLayout';  
import { WorkExperienceItem } from '../components/atomic/WorkExperienceItem';

export const defaultSectionRenderers: Record\<SectionKey, React.ComponentType\<{ data: ResumeData }\>\> \= {  
  basics: ({ data }) \=\> (  
    \<div\>  
      \<h1 className="text-2xl font-bold"\>{data.basics.name}\</h1\>  
      \<p className="text-sm"\>{data.basics.label}\</p\>  
      \<div className="text-xs space-x-2 mt-1"\>  
        \<span\>{data.basics.email}\</span\>  
        \<span\>•\</span\>  
        \<span\>{data.basics.phone}\</span\>  
      \</div\>  
    \</div\>  
  ),  
  work: ({ data }) \=\> (  
    \<div\>  
      \<h3 className="text-sm font-bold uppercase tracking-wider mb-3 border-b pb-1"\>Experience\</h3\>  
      {data.work.map((item) \=\> (  
        \<WorkExperienceItem key={item.id} item={item} /\>  
      ))}  
    \</div\>  
  ),  
  skills: ({ data }) \=\> (  
    \<div\>  
      \<h3 className="text-sm font-bold uppercase tracking-wider mb-2 border-b pb-1"\>Skills\</h3\>  
      \<div className="space-y-2"\>  
        {data.skills.map((skillGroup) \=\> (  
          \<div key={skillGroup.id}\>  
            \<div className="text-xs font-semibold"\>{skillGroup.name}\</div\>  
            \<div className="text-xs text-gray-600"\>{skillGroup.keywords.join(', ')}\</div\>  
          \</div\>  
        ))}  
      \</div\>  
    \</div\>  
  ),  
  education: ({ data }) \=\> (  
    \<div\>  
      \<h3 className="text-sm font-bold uppercase tracking-wider mb-2 border-b pb-1"\>Education\</h3\>  
      {data.education.map((edu) \=\> (  
        \<div key={edu.id} className="mb-2 text-xs"\>  
          \<div className="font-bold"\>{edu.studyType} in {edu.area}\</div\>  
          \<div\>{edu.institution}\</div\>  
        \</div\>  
      ))}  
    \</div\>  
  ),  
};

export const LayoutRegistry: Record\<string, React.ComponentType\<{  
  data: ResumeData;  
  blueprint: BlueprintConfig;  
  sectionComponents: any;  
}\>\> \= {  
  'two-column-left': AsymmetricTwoColumnLayout,  
  'single-column': ({ data, blueprint, sectionComponents }) \=\> (  
    \<div className="p-8 max-w-full space-y-6"\>  
      \<DocumentSlotResolver slotId="header" blueprint={blueprint} data={data} sectionComponents={sectionComponents} /\>  
      \<DocumentSlotResolver slotId="mainBar" blueprint={blueprint} data={data} sectionComponents={sectionComponents} /\>  
    \</div\>  
  ),  
};

export const DocumentEngineFactory: React.FC\<{  
  data: ResumeData;  
  blueprint: BlueprintConfig;  
}\> \= ({ data, blueprint }) \=\> {  
  const SelectedLayout \= LayoutRegistry\[blueprint.layoutType\] || LayoutRegistry\['single-column'\];

  return (  
    \<div className={\`page-box page-${blueprint.dimensions.pageSize.toLowerCase()}\`}\>  
      \<SelectedLayout  
        data={data}  
        blueprint={blueprint}  
        sectionComponents={defaultSectionRenderers}  
      /\>  
    \</div\>  
  );  
};

## **Strategic System Synthesis and Architectural Guidance**

Selecting an engine architecture depends on the target deployment environment, operational constraints, and rendering requirements1. System architects should align their choices with their primary operational priorities:  
High-throughput serverless architectures (such as AWS Lambda or Vercel Functions) benefit significantly from compiled native engines like Typst13. With execution latencies under ![][image28] and minimal memory demands, Typst reduces serverless execution costs while guaranteeing deterministic page breaks13. @react-pdf/renderer provides a strong alternative for Node.js-based serverless environments, avoiding headless browser overhead while rendering directly from React component trees1.  
Client-side and offline-first applications are well served by @react-pdf/renderer or browser polyfills like Paged.js1. Generating documents directly within the user's browser eliminates backend rendering costs and server maintenance1. Paged.js enables teams to reuse standard DOM structures and CSS frameworks, such as Tailwind CSS, directly in interactive web preview tools3.  
When exact visual reproduction of complex web application components is required—including custom web fonts, embedded charting SVG nodes, or dynamic HTML elements—headless Chromium via Puppeteer or Playwright remains the most flexible choice1. However, because browser processes consume considerable memory and suffer cold-start delays, infrastructure teams should deploy Puppeteer within dedicated container pools (such as AWS ECS or Docker worker fleets) rather than transient serverless functions1.

#### **Referências citadas**

> 1. react-pdf vs Puppeteer: an honest comparison \- PDFx Builder, [https://pdfxbuilder.com/blog/react-pdf-vs-puppeteer](https://pdfxbuilder.com/blog/react-pdf-vs-puppeteer)  
> 2. viktorrudi/Reactive-Resume: A one-of-a-kind resume builder that, [https://github.com/viktorrudi/Reactive-Resume](https://github.com/viktorrudi/Reactive-Resume)  
> 3. Our position paper for the W3C CSS print workshop \- Paged.js —, [https://pagedjs.org/posts/en/our-position-paper-for-the-w3c-css-print-workshop/](https://pagedjs.org/posts/en/our-position-paper-for-the-w3c-css-print-workshop/)  
> 4. react-pdf vs Playwright: which one for PDF generation in 2026?, [https://pdf4.dev/blog/react-pdf-vs-playwright-pdf-generation](https://pdf4.dev/blog/react-pdf-vs-playwright-pdf-generation)  
> 5. WeasyPrint vs Prince: CSS to PDF engines compared (2026), [https://pdf4.dev/blog/weasyprint-vs-prince](https://pdf4.dev/blog/weasyprint-vs-prince)  
> 6. Autype vs. Puppeteer vs. wkhtmltopdf – Comparison, [https://autype.com/blog/autype-vs-puppeteer-vs-wkhtmltopdf-which-tool-is-right-for-you](https://autype.com/blog/autype-vs-puppeteer-vs-wkhtmltopdf-which-tool-is-right-for-you)  
> 7. DESIGN.md \- amruthpillai/reactive-resume \- GitHub, [https://github.com/amruthpillai/reactive-resume/blob/main/DESIGN.md](https://github.com/amruthpillai/reactive-resume/blob/main/DESIGN.md)  
> 8. Architecture \- nbprint v0.11.2, [https://nbprint.dev/docs/src/architecture.html](https://nbprint.dev/docs/src/architecture.html)  
> 9. HTML to PDF API \- High-Quality PDF Conversion with PrinceXML, [https://docraptor.com/](https://docraptor.com/)  
> 10. Paged.js in Vue 3 ignores page-break attempts \- Stack Overflow, [https://stackoverflow.com/questions/78440645/paged-js-in-vue-3-ignores-page-break-attempts](https://stackoverflow.com/questions/78440645/paged-js-in-vue-3-ignores-page-break-attempts)  
> 11. PDF Generation in 2026 — react-pdf vs Puppeteer \- Aidxn, [https://aidxn.com/engineering/pdf-generation-react-pdf-puppeteer-2026/](https://aidxn.com/engineering/pdf-generation-react-pdf-puppeteer-2026/)  
> 12. Best JavaScript PDF libraries 2026: A complete guide to viewers, [https://www.nutrient.io/blog/javascript-pdf-libraries/](https://www.nutrient.io/blog/javascript-pdf-libraries/)  
> 13. It's great to see Typst getting more visibility. We migrated a real, [https://news.ycombinator.com/item?id=45394479](https://news.ycombinator.com/item?id=45394479)  
> 14. Typst: A Possible LaTeX Replacement | Hacker News, [https://news.ycombinator.com/item?id=45393842](https://news.ycombinator.com/item?id=45393842)  
> 15. PDF generation without Chromium dependency \- Elixir Forum, [https://elixirforum.com/t/pdf-generation-without-chromium-dependency/68211](https://elixirforum.com/t/pdf-generation-without-chromium-dependency/68211)  
> 16. Tools to generate PDF files? : r/golang \- Reddit, [https://www.reddit.com/r/golang/comments/1io1l9m/tools\_to\_generate\_pdf\_files/](https://www.reddit.com/r/golang/comments/1io1l9m/tools_to_generate_pdf_files/)  
> 17. 1.5+ million PDFs in 25 minutes \- Zerodha Tech Blog, [https://zerodha.tech/blog/1-5-million-pdfs-in-25-minutes/](https://zerodha.tech/blog/1-5-million-pdfs-in-25-minutes/)  
> 18. Anyone generating PDF's server-side in Next.js? : r/nextjs \- Reddit, [https://www.reddit.com/r/nextjs/comments/1pqkmeu/anyone\_generating\_pdfs\_serverside\_in\_nextjs/](https://www.reddit.com/r/nextjs/comments/1pqkmeu/anyone_generating_pdfs_serverside_in_nextjs/)  
> 19. Generating 1 Million PDFs in 10 Minutes with Serverless Rust, [https://www.ersteiger.com/posts/rendering-one-million-pdfs/](https://www.ersteiger.com/posts/rendering-one-million-pdfs/)  
> 20. RayZ3R0/typst-raster \- GitHub, [https://github.com/RayZ3R0/typst-raster](https://github.com/RayZ3R0/typst-raster)  
> 21. HTML to PDF \- The Complete Guide for 2026 | LightningPDF, [https://lightningpdf.dev/blog/html-to-pdf-guide](https://lightningpdf.dev/blog/html-to-pdf-guide)  
> 22. A full comparison of 6 JS libraries for generating PDFs, [https://dev.to/handdot/generate-a-pdf-in-js-summary-and-comparison-of-libraries-3k0p](https://dev.to/handdot/generate-a-pdf-in-js-summary-and-comparison-of-libraries-3k0p)  
> 23. Report Generation Using Typst: Faster PDF Rendering in Python., [https://dev.swastikgn.com/posts/report-typst/report-typst/](https://dev.swastikgn.com/posts/report-typst/report-typst/)  
> 24. The Definitive Guide to HTML to PDF Conversion Tools in 2026, [https://ironsoftware.com/suite/blog/comparison/html-to-pdf-2026-guide/](https://ironsoftware.com/suite/blog/comparison/html-to-pdf-2026-guide/)  
> 25. What is nowadays (opensource) way of converting HTML to PDF?, [https://news.ycombinator.com/item?id=45404760](https://news.ycombinator.com/item?id=45404760)  
> 26. Paged.js \- GitHub, [https://github.com/pagedjs/pagedjs/](https://github.com/pagedjs/pagedjs/)  
> 27. pdfmake vs pagedjs | Document Generation Libraries, [https://npm-compare.com/pagedjs,pdfmake](https://npm-compare.com/pagedjs,pdfmake)  
> 28. 5 Best wkhtmltopdf Alternatives for HTML to PDF Conversion, [https://www.easypdfserver.com/blog/wkhtmltopdf-alternatives](https://www.easypdfserver.com/blog/wkhtmltopdf-alternatives)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAH4AAAAZCAYAAAD30ppqAAAFHUlEQVR4Xu2YfcifUxjHv4uJprxGhoy8tBBLLLXpUYg/SMjrlCj+kZetEWV7GH+w8pYQaknKO6UV0fZopYXYP6y21CwjCaVthbxcn1331X3u87vv3+/3PJvH8+h869vvd59z3+c+1/W9znWuc0sFBQUFBQUF/3ccYbzP+JzxfuPxze4G9jJeaZyTtQf2M14rH+sR40nN7kkD7+X9zGOJ3MYcM4zzjU8anzaeU7UF9jeuMl5nPEo+RsoD61unH84yfmBcaDzNuNr4t9xZ4QTEvNj4hHGbcYfxjKovxQHysVbInXa68Svj5elNkwDe96bcHuz6wvi78bLknpnGUeMnxlONc40fyQM/7Ebcb+T+aCMBMy2BoO8Yb5SvZHCI3BmpuNx3kXHEuDzrS3G38VPjQUkbq2Wj8fCk7d8E71lnPE+1gGSw74ybjUdXbQQBwXBhdQ0WGH8ynl1dY+Pn8qyR8l3jl8ZjqvumHSKif5WvjsC98ohenLQFELdNeMRG9Bez9jON242XZO05Dq7YBQJztpqpuA3Mi/l9rTrYeOZluU0E8L7yzJbbEf6IlUyWu6Xu3gUyxbPG87P2aQWMIH2/r+YeiLg4id8cXcKTKlktufAhxENZe44TjG+rfRUxz2XGpRosPNsNaZ69me0mwLywCTFpH1OvHSE8fdyDTUcm/YBAGDQP9n7s4F08T6CNVNdkVEAg8+5L5fVSjEf7YcZT5EFKtiWAeZYaBF+AWcYLKmLzbmNv4xvGP+WTzdElfAjcJXze3gZqAoIwFX88onchstEP8qJvkPBptkgxz/iWBjv6TuMv8kAj4AnCq+WZ5Gd5DfKK8Wa5Xczjjl1PetC8Jvf/t8aH5TUTz39s/NB4jfGlqg2//qhmxp4QqHKZCHtZRFeKLuGJSAzNBR6P8CAVf0+IDq6SO/Iu1eOMGnfKt6IAe/wfcvHzUwBzeVXu7GHAuIz/nnzVAk4GiEm9ESenWGhjamao2G5vTdqoS2gjMEKb44zfqz07Dw0imYgimkglbegSnrS0J4QHiL/G+Lx2X3QCiOJyVM1Apn2T8R75+PS9ILehTXgKvi3y9D8Mwu60RoiMQr2R2oRvxtQUHj+zdabvi8WVnk5izAkLH0XLo6ojtA1dwncJ3NXeD8yFtEjKJaInCgJ5tfF21aeWFHPkgb5NfuS7Xs09PoBIT6n3xNIPYTdiBUKk3BddwucBGMK3jTkh4UN0oj8cRKRROOToEj5STm5UOIDUNQyYy0r5Sj9ZLly65w+LEJ00H6uL4ohs0oUoUPPz+aHy49uYmuL0w5QXHqcskRck4SBAikpTSqBL+CiYcDZVbIDzNOdlfgchFT3mghjjFZ9xHlfv/B9UvadTDG2QV9UBjpzsy6T1FNzLkZe9mD15GExp4XHuDXJjKTq2JqT6pNjJwQvyoiiwSP7ssdU141ORrtfgShixqGDzAATjEZ9xRo2/qWkP9m1RvXWEE7kXRH3zjHrFJWj/Uq9g/YB/8FPbfpyPwzUZhcwSIEMyZwrCQD/h8yzVF/EQg+UkbYeTKPQ4fhAM6T1Up9QEAZyO49bKVxKiY1C/9Bo413ibekUPUAU/YNwn78gQKy23B6Z7NA79TD7Hm6r/q9Re1HYVrl14TH6KiPe+Ls9ifMiKNgpLvmryG230XyH/chptZEue5UQRY/LLdT4mz/EN4D8Bwp0oNyD94DAVER9WCNL4lNsGbBhRb6VfUFBQUFBQUFBQUFBQUDBZ+AeBMVAWFZSP8QAAAABJRU5ErkJggg==>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF4AAAAZCAYAAAC4j5m6AAADXklEQVR4Xu2YS6hNURzGP0mRV7nekUNS5JnHzUDdkRBl4BXSncgdiKKIkpEBA3lMZEYpUSSPZCCPQimPwZVEHmHGCMUA33fXXp2119377HXOPke3rF99dfZ/r73XWt9a+7/WOkAkEolE/gcGURup09QRagbVL1Uim1nUWmo0TPkh1BJqk1voH9KfWkdVvLjPPGqpH8xB5a5Rs/0bZRlOXaK2UOOoOdQ9ajeKzd9A/fH0gZrrFmoxmjSrqOPUJ+o7NT9VwtBO7aEew7Rzb/p2LmdQX/lgtlP7vdhM6ik12Yv7qMNvEj2idlLDUiVaj4xfTnVQB1HbeLV3BUyZUCOnUQeosf6NsmhEDyM9uzXzZbxmfy3UkdAO+EykBvhBh8FUmx8sQG3JM96ie/UY3zIOwXxKJ2A6K9ZT12Fydi3KGL+ZOoZs8zW7LlOL/BsFNNt49X8CTJ6fnsTU3jEwbetIrivUaph3a50JYhL1Csb81zADcT+JFyHj9cXchEk3b6mtCKtcX5jS3EmkzW/UdNFs41dSL5HO8RXqbhJTej1F7YJZI+WBNihZkykTjaYWRbtAysyQXC3jb1Mjkuup1EeYRaxoYRa++WVMF802XmjGq09uebX7HPWbWubEtVZ+QfXrqIlerBm+DWbU1CiZ/wDFOXZgIottkBpatDBbrPkXqKto3HTRCuO13r1H7/KanN3USCcWUn8P2hGos+5LNRBXYMyXIfWiBulZ7TRC0UL7jDqLOj7TDEI63kzj7yC9DobU34N2Lcrv/qehAVHe1svz0DZL+2YNnMpbrPFKQyFooFVXO9WJ3jm/HkI63ieMV4EX1BT/Bky+0k7HooPWeFRzt+2Aa7xNNUGVo2q6TS96vhONmx/S8T5hvB66Re1DejEcBfPSxcl1G/Wc+unENBAyuZJcC/0OXdlluo7iC7x4GfPV8R/UQv+GgzXePzTmkWW8nWBaG4c68WDjhXYiMlUDoP9Y1KBumIXWDoYG6AZMWnK3mTLtCcwzO6h31HmYQSlCp0HfdIvqXQPzv0sROnuozq9I/3XxmTrqlOtKYm4ZPSPz9F9TFnrmG6rlL8J8nZpcNqb7OpM8dGK/kK47F+27NUrqrA4L9iAVgsrqGR0gKgjbRkYikUgkEolEIpHG+As7wcrMClaOYwAAAABJRU5ErkJggg==>

[image3]: <data:image/png;base64,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>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAAZCAYAAACGqvb0AAAC7UlEQVR4Xu2XS6hNURzGP6HIa0C5QveSRyYmXFJigihMGIgyoSiZMFC6MxlQJCkljyQTE+lmIoMjE2UieZRHHokQJijk8X3++3/uWmvvs/c5uUrZX/26Z6/3t/da//W/QK1atf5XjSQbyQmyn0yJqyPNJgdhbdeRoXF1pMPkK/kZ8Ia8z36/JgfIWO+QaTv5iLif+rzMfhf1K5pLY2isluoi18gRmOnV5AlZHDaihpM+cpPMI9NJPyoGp4aQ87DFrErq9CI191syP6mT9sL6bUrK55LH5A7pTupOwvrsScpzGgZrfJ9MDMr19W+QcUGZTD4kPdmzjGiSs96gRGrzCfbSUmmOq+QB8kZkQHOsScqlbbC6Y7AX7PI+qi/VHPKONMjooFyT/SDLsuepMONHmy1s0doJC4OyViozL62EzbcPxUaKzKtMdQ3Eay/rE0mL0aIayJsPt86G7FnbbwSZhLh9larM6wi9InfJhKC8zIjWorrLsDW5yvpEqjKvIyHpi+tZX+Yc2UFuwYKOYkGVqszryOkMfya9QXkrI5rzAvlOlid1rfrkpK2rs32djAnKdeY1gJ9n/U232EzY19qdPZepyrzGbCC/aDdyBXa7iFPkUcbSgaZNtW1e0nWlaOtntwcWAIvMh0HEF5xu1SJVmfcv/w3xLeNGtON01JzxiGNDqI7MaxBdb3qTz8hFDERSP/N+fYQDuvkyU64q837mn5LJQbkb8XW0o47MF0nmw2i/C/kBB9O8R/tW19ZfM78Tdua7s2dNfgbxPb+IfEGcbAzWtvd7XtnbjKTuT8xX3vOSFiZjMigtgG3Btc0Wlv72w7a/EiOp3YCnl6kMr8j8NHIJFnN8/lCe4XVivu0MT5LJe2QrLGl5QTYjH1CUEKndabKF3CbHUX7VKd/2PF4o134Om0PX1AdyCBbEQimb1P8A3k/o2Y9hkdK5vE9V+v072uqMrCCjkrpQMrqErCezkH9BtWrVqlWrVq1/Q78AG8TgbGhxwAsAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAAAZCAYAAAB9/QMrAAADa0lEQVR4Xu2XS6hOURTH102KvBKRYkC6KDfkMaM7EBmQPEqYGTBQQlFGJAPKxIBigEQyk5Si3KKIqUt5JPIoQkShPNbP2qtvfft+55x7XeoOzr/+dfbae+2z13/vs/Y6IjVq1KgxMDFSuU15XLlP2a5saxphmKY8JDZuvXJoc/cfYKOPMYzFpwxblJ+VvwLfK9+kZ/pOKCe6Q8I45S1p9vuhfCHmw/NN5SJpxNKhfJj5QOZhvkLMUnYpO5WjlZuV35U7pVmo1cr7ytnK4cr9yqvKUWEMz9joYwxj8cG3CnvEFrwjs09QnlN+Va7K+gDiIcxdsfU72Cw2/Kf0jIWYPymfic1fiSNiqq9IbV7EC98pZyTbJOUj5YbUBj5ua7DtTra4WHweKMcHWyvgi0jL8w7FYLGT+UG5IOsjSILtEtuYiLHKbjG/mcHuPvQxphKHxRa3KbVHKG+IKY3igEC/KOemNmBnzkpjcS7a6TAGzBc7/r4JRSgTCRAkwV4QE81RJhJt7Pm8ZT4twQtRc1Bq+2K6pDEBpy0XCSDIa+UUsVPH6ctFwgffA5k9R5VIrU44KAvYffjkFgd7mU8lSOCcjudi+cRB4EUiud3FKBIpt+eoEmmY8prYmJibygJeqPymvCTNl0yZTyFYwHkxcZ4ol0rjZPmRrRKJ4AggF+NfiQSYgzGMdXjAb5UnxXIXvCh2AfEVEF/EX4kUMV35SnlGbHLfwSqRlsn/FSmepHiBeMAvxXIobeeQMC6i3yK1iX1yLIYaBkQxIqK9SIwie44qkTy/5OvwgCHPvUGfRCJpb0+MN4Yv2AMj6eaLA/RTo1CrkLxJ4rkYLhJ1UBmqRPIL5Yq0zi//TSQPIBeAQFkw3zPg+qaWijcER/lyIs+eu7ztwIfcEH1boUwkr5NIwiTjiP6I1C29qJO8SDwljcp5jPKO2K7NyWx7UxtMFTtF64Jto1jyn5zabWLV921prsxbwSvuXCTefVSs4l4rPX+XvOLui0h9rrhJuI+VB8UC5iR8TPaIecqnyl3KNWL5AZ/4mfJ8THlduVJMIHYrlhM5yHv+nwY5dQgNeYbcWvk/IP9aFL30R19u6fw2c3Qo74l9FdGHeUr/3QCfR6dY8PwQxsAjePkSMQE4ha3ATrdL9Vw1atSoUaNGjRoDFb8BJA0E/VmCU6QAAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,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>

[image9]: <data:image/png;base64,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>

[image10]: <data:image/png;base64,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>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHYAAAAZCAYAAADkBdqeAAAD2UlEQVR4Xu1YWYhOYRh+ZMkWY4mUMvYlRJKyNYS4sIQLSiglEookWZqUrBeIRHZZskQpSspWuLJdIG5MKeGKKDfiebzf6T/zzczxn/Ofmfn75zz11H++95t33vO+37t8B8iQIUOGDEWOLuQ0cg7Zl2xeXdyoKGbbihZDyCfkH493yY6hfY2BYratqDGX/EiOJ5vBMmE0WUX+JEfltjY4itm2okZvmON2eOty4nnyGdnNkyVFS7KdvxiBhrSt5DATVtYOwRwWQL87w4JRKDqQW8in5FhPFoWGsK1kUUH+dlyGdAeSHrCg3IMFNK7uCtSfbSUPnfp9yA0kz8mJqJ4hcaESeoK8TQ5Hcl31YVuTghylAIQnz0uIP3EOJK846ncaSMu2JoUysnXoWU6cSn6FOXC/W4tC4Hhlp7JU2ZoG8rFNg5iC/Jq8T74g35EPYAdBz5qgz5LfkP4E3RbJdA8i38Bsbl9d9C8hZPcHWCuLBZW43eRbcpgnE+RA9bX7qPmPfWgqVQ89jQSG1II4tnWHTcxB9m5067JZB2E1OcM930A85+eLpLq1X39Xm38lU3Bj+3MBzDlTfIGDFFaRV8kWnqw2hLP2DAorw3Fs60muDMnCgRWUrZPccxLn54OkuuslsHK+ytlSbz2AnPEdlh1xoaDK6UkHpzi2tSF7hWR+YHUlUkUJnD8bluHXYLYJmrb1BWsdeZ2c79bHkafIi+Q82HsMgFWTXeQ5WEWJ0i3oq5nahm4Ha2A2C35gpfskeZmsJF8hQWBXwJynLzeLkLsP6joxgXxJLkb8oIQRvuqMQf66CrHND2wAPcuOStjfqTzfgfVo6VdAZesScjs5krwF+zYt6vdQt0dVQJgFC06U7rAeQe9zGFYFw4HtB7O73O3T4dXcEDuwQR8LpswwdWJU4tKCXmov+YicjP/fRQuxLSqwWtcHD8HPFlWJQCYo8x7CslfUb8kryS/kUeQOa5Ru6ZHuAJIpYH28faoWqnJB20tcigNo+JBBMr4CNR2SJnSC18K+/eaDJLalFdjjbs2H3qGCPEB+hrWDKN2+Hsnek4O9fbLb31dQYEsNaQV2OixLg2m7P6yfboYdOEEHVP8vSrf23ESur0qvyrRk4X1af0x2cvtU7hP12FLDCPIY7Iqk3qy75QbYPVjc6tblVDlbA84Pt76K/ORkGqQEtYv1sA8t6rvbYEFWf9wDm9yPwIITpVtB2wTrzcudTNlaTl6ADYEHya7kTtg7LIS1nF+wkl+GDKlD/T78hUs9UEFXZtU2vNUFX09d0CHUYdD+Vp4sQ4YMGTJkyNBI+AtKo/1ARUtsRQAAAABJRU5ErkJggg==>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACUAAAAZCAYAAAC2JufVAAACUklEQVR4Xu2US0hVURSG/8jASIoeJInRC3o4EiShSaQY2ECJCopq4CScBEFQkWANokGBSBEIzgyaRY1UwsBLDYoKJUiDaNREELRJBgU9/t+1j2fvfe65SNLs/PBxOWvtvfa6e6+1gEKF/p/WkrNkkNwl+0J3Ra0nl2B7e8n20L0oP/590kZWBysibSBj5BapIY1kmpz0F+VoB3lG2sk2coS8Jye8NYr/hFwge8hN8ouMOl9ZXSNvyUbPdo58JLWeLdYq8gBhApISfIH0wIvkIexGJe3TBfyBnZ2RElFCQ5H9IPlGOiO7L91qiXSFZjSRd0j/kGIrgctLKyz+d/KcrPPsizpA5pBNSoEXyO3I7quKPCY/yRWyBnYL18mA80vHyRQ56r6lJH4J9ucCJc68pGJ7rGbyFXYTb0g/eYoKteKk8tCevtghdcCc8eHLTUpqIT9gccQNWLflSQmr5j7BGiWjY1hZUurUCdgT6dnUVYqnwi6XmJ73KvkMK52yyjs8z+5rKywhv/sayCT5DevCWBozL8nOyB5oN5lB9vAkqZ7I7ku3/IFsiezqOo2TuN2VkGbTJvetAldtVS+t8BwlMozQqYmrrtJvItVCHewJJNVjPN8k+R+Rbs+mhpDNbwA93z2k8QKdJ1/ILvetRRpur5EG2Qyb1CroQ85W72yn3Xei/eQV0ng6XDU0CzsnYR4VRo7mi+bKOKxglZDmioo4kW50BNmOUYJ6fhX2GXIH9nSt3hqVRtKZMXq+XOl29pJT5DAs0eVKa7XnX/YWKlSoUCX9BYkyep93MltrAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,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>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFEAAAAWCAYAAAC40nDiAAAEKElEQVR4Xu2XXahVRRTHV1iglWkfGIHivSlKUCiYxQ2LHioKMcQP8CPoIbyBiIJQQS8a5YOJDxaE9BIlglbUg0iBIreC8APUhwqppBQjSvJJA4Oo/++uWefOmbP3vedqp6f9hz9nzzoze2b+a9Zas80aNGjQoEGJPnGNOF2cIE4U54mD6TnHXPFN8V3zMZPa/+4ajGM873lLfMJ87hwPiCvFaeIN4q3io+LavFP672Hz97wjLrbOd/Ucj4hXxX8yXjFfTI7l4nfifPMNvS4eEqfknboA/T8R14mzxC3i3+Jn6b/AKmtfEzxvPn8AAV8WvxD7xTvFvebOuSnr13MsMBfnjHhafE28p62H2QzxB2s/BbeLJ8QNma0b0P8D8bbURggcgkivRCdhiXg28ai4yUbGBFj7b+KizHaveE58OrP1HCzk7dJYAPE4nfQNsHm8PmR+MrvF++aCbc5sC8U/xcPiLcmGiLmoVdhmLlju9MniV+J75mv8X9CNiOSbUkSAIL+ae79bLBW/FZ/MbLyX9w/ZiEPGEpF8fdA6RWT8kHmUEC0lyJfk2fvFZ8zz893m8z1mI2kAZz6VWKYsnDNHfDEMbOBT8xD70TzvkKfyooFYdSJW2ccLTjqnc2dmY1O8/3PzkP7JPI9G0Qix6kQs7YGp4ofmefiCuN08nZCDvzaPhtXinmRjDRfNiy1AQNb5hnkxHgYCHBNnpzbJ+biNJOdYVJVY/4WIePlL8XtxZmZHxCPiHanN+tg0hYSNIBBClWKNJWLgVXPH5Tl9WbIhcpxIooxoi6jg1J40T0Et0DnyUIAJqNgD6T+8UyVWiEiFJzRWjMH7fFgLiIEoRED5H+GaX7HoSw5GyH7zzXBCS7G6FRFR/rD2eXEcIiJmIJwVIt5lno6+EZ+LTlVgQJ78605c2PEKeYYJR2NZgJabF4G+wl4H5mNdOKxOrDp7CfZY9gkR+Q2UIgKuf+ybvsOhSwJGVUQIhIgxkCpYJyIno5UbxgEE5G4Y4crmyY2cPpL2L+IB68zNsckbxY+tU4gQEedQqetwPSIC1vk4D9GhFDHyxbOpzS+JmC+LQFRHWH7ZjIWHzEMzr3qE1S7zsI1qnYuInTG5M6tCMsKNG8VouFYRaePMVlThzd3mn02BSPTkwdhkFJutqQ0i0VPBxgM2TA783fwmELxkfuIB8yJYX2oDnsmB+ddI1Rr4NOTdA5mtChyUMopGEzGcQhsnMU8LVESO/g7xBfGUeakvQ/RB82sGhYAiQRrgehAb6hYRklXMv4iYjyrIZjeKP4v7rPPORhFgXYPi8+ZfX+ut/qJNxHEgYs6/xJfE/ebRho1f2tgvZ30Zx/0Sfdj/R5YBIbhoRgWt+4CPCygXZj4Fe418vj6rF4ZI4fRAnnsJtLk5PXPnbNCgQYMGCf8CPBcCwKh9p4YAAAAASUVORK5CYII=>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGQAAAAZCAYAAADHXotLAAAE3klEQVR4Xu2YfeieUxjHvwtF3tJkCW2kpITCNCFFQyJvRfyhtbBJ0RRS8kjSKOUlJJFJsok/xBR/bMh7oTB5iUkWhX9Qo+H67Lqv3ec+z32e5/49K/453/r2+z3n/Xyv65zruo9UUVFRUVGxc1hkvMx4sHEX4+7GY4xXNf+nOMJ4t/FReZ89utWDwTznGB8y3m9catyt08Kxj/E6+Xy3Gg/sVm/HPOOJ8nEYj3EZv4QDjG8b/0l4aadFFwuMm9S2/cV4hvFe459JedT90Pz/o3G1fA9zwknGreoO/Lt8YykuMn5mPNa4l/EO46vGfdNGA0DfdcZr5eIcb/zauF7dsRYaPzZeKXeMs41fGBcnbTDGjcaNxkON841Pyw3YZ+AUGPc94x/G54y7dqt34BL5+tDlpqyO+ZkPvY7L6tD1V/ma2ctgMBBCf278yHi7xj3xEOOXxsuTsv2M78uFnQvwrr+ND6sV4U75hq9uflP+mMaFot0rak8ma8cTT97RQjrMuNl4VlLWB/a4xviUXLijutXbwdwj433qNwh4Uv0GAbGvUVY+EQz0QF6YAUPkk4Z3bJB7/VCcZtxmfEHtlXiLfOGrmt+IukXjAlyo7jrYMOKnDrS38Q3jE/I1lkAfxLxA7iD5XOBIuZg3azaD0J5+tBmMIQbhfu6blIkQDgGHApG4WsIYeDten44fpygX4Fz5BnEQ+r+kcYPgHBvkp5dTXEIYhNj5TsP8+l1mXKJW2Hw9oGQQrsy1cuc7L6ubCAbCWzm+Xxm/M96mbsAuTVoqHwqC73L5GFx94dEhfC5AWh7ClwySl+cIg9Ce8XAAHCGAcXBE/k4zCHHoTPmYkJhBgsFVSAyKfQ0CYr5rPLz5jfcS7CIwxgb7hN8Zg6yQG58YQAa1Z1JXEiA1CBtH9Fz4WQxC/EC8B9WKx8nghIDSegBjYEycGs2CHxgfl2emcwKip2IA7vSt8kVR95r6hQ+DkFGQBV08hdzJOTiJBG8ymagnlvQJkBpkgbxPLvwsBiF4s4bv5dkaRhmpXc80g/Rpg64YhitrZVY3Z8QCIsiWJo3yE+QpbBzZEkvBn2DNfC/KDfRfX1mAbxE8nb8Ye6Q2w5vFIACD/qzW0FPB9UTw+0QuaCBfANlM36QshskIjENxuvyjKu3DuIwfIpLG/qVxAcIgGDC8Ohc+DEKmRcZVQm4QjLBJnmAsk88VyPVIMckgzMH6SvVjiA65QSINjeyAvxy9NOhFlgPzL/oSQqx8cyH0p8b9jQcZv5UH1RR8p+Bx6VWS/gb0Z5y8b47cIPPkMQTxXpYbKDCrQZbIr/7BJwQve0T+9BAgq3hdHjciDYxAP2p+A5IAJpr07JCD+fjg4+v16KYMIfjqZ8M3ZGVpKhpp5DNqr5K+NZxi/EkuxiRgxPXqOmIIyI2QYhaDcAOgI/2uz+omYqH8eN8jT0E/NL6l8WuIJ45v5E8VBGiuutWa/kSRIxbK8wnfE3fJ34TysTAEnvqsPGEgY3lT4+vi+mJdvL1dIX91uEblVBMDsEeECj4vT144LZz4MCY3AsZN2/JWRTnXLm9XaR1tyRx/a37zZnaqymspAiHoGJlQ6XGORfMQeL78OWVWMD7zMB/XFSewD7TD82jH39K66M84k8aqqKioqKioqKioqPj/8S/RjVI3KTKoTgAAAABJRU5ErkJggg==>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHIAAAAZCAYAAADt7nrkAAAFK0lEQVR4Xu2Ya6ilUxjH/xNyN25hQs4wxsgIuTXj0iRlhGlIoZn4IJcQIabxaYQPPpAQEiHJDErS+DDJ7KEQ5ZZLuSSayEgT8cFMmOfnWc85612z33323uec4rT+9a+z11rv8661/s/tPVJFRUVFRcW0wAzjfsY9yonJwF7Gm4yPG+80zpW/cCIYMV5aDiZg+1Tjg8ZHjOcZd2ismJ643vhP4opibsI4ztgxLjLuY7zGuMV4qwYX82jjdcY3jH8Zn2lO/wts3m7cYJwt987n5E60U7ZuuuJI4yZNgZBEBZe+JP1GzPeNv8iFGQSsX2pcaNyo7kKeaPzJeHo2drjxO+PibGy6Ypb8rJMu5H3yUL8y/d7T+JbxN3m0DoPYbDch75HPsSYQ73xKg2eB/xumTEjS2f4aq1HzjZvl6XbYgtwm5C7GtWkuF5L3dOSZgIzQhkONV8jT/7HyqN4xm9/VeL68zhPd/C5BKl8ud6gL5f1BDu7jTOMdxguMuxdzBxpPkZcifo/IsxCZpludZ4y5i+UZ6xBtLyTOS1/CuTgf68hqQ4NDUa++Nx5fzA2CNiFDsDYhy/EcVxmfNx6WSJO0XmPOxuE/Mq40HpHmP05rAZd1uTytY2u28TXjF/LLBdjAmW5IY5cYPzeeleZH5LWdDPau8THjLXK732j7Oo+N94yvyBu/G+WZ50+NCcm+yIp3p/XsgfXl3fUFvG61XEA2dI66e1e/aBMyxkvBxhOS/b1uvCgbI4s8Kn82nkfoiFAiB5G4JECX/IdcJEB2eFku7FHGA4yfGu9SM70Tvaw5Jv1mDmf/W82aTgTnfcVM45vGF9QUt2x22OcHxpNHV7iN2PfQmGf8wfis/AIxSlroxXPVTGNtQrJpHKUUbDwhIyX/KO+KuYyd5bWViz1bfrGkpkBceEdun/pbNnDYjYjmWWxgKwdpEQcgFQc412dyZwogDOtYD2geidxloyscZY3EBrZwIpyGqER4zjYhxAWwiWvlB+XlvYg35xHcJmSbYG3jOUj1ZIz4DvtV7kCAS2FsnTy95bxNXhc76m3/CTWFCISQZISol5yro2YPUQoZe6LO5iiFBHxH82yc7WsNWNpQ/ubEPPxjE6UQ/aJNSNLeS2mum5DUj16eyB5PkqcxbPwsT3lEUzfvD/TjKHyGbVXzswiEkOw70vZkCwnIDouM98qdlAglQPpCbLL0RDbKJjjcMGgTEnCAMsVFeml7X6TGg7OxOfISwEXNl3faefoDCH+aXIBV6i4UzRB2aUY4c16HAet5Lmor6EfIbukelELyG3u5rTPkZyuzQyto578yPi0vzoA0RKfFxZyQxgZFbJYUPaOYQwD+WZD/+46N0wAsyMZycMj18hoSoN6+Iz8s73hAfnhqfAC7K9M8gn0pj6yo5wj9sDyqeQepOW9OeI7mJ48OxjhXmT1KIXnHq/KGJ+6WZy+TCxxOx13hxOw1gGOiQe6444I6Q04mpLnctWrWn0GAFyIS/ymKfP+78RP5d18Ar//WeLX8u4kWnyamFD3AJdOSRytP7aP9z5/h8qmHRPuLxjXGJzV2iWCu3AbnZY66l3eefH49ZPxQ/o4NcuEPSvOcgWYtPxvOhUPF2Bbj/Wn9vnLH4DMIe9wtczgta3kPor0t/+xh3+yLLnaY+x/Nz3SgfAzn9XKqQOSTFiF/9wJiRaOBqERj2x4ZZ37vciIDc71scB9ESp7uJoJ8zzSFRHfY5vdu6W/2VTaOFRUVFRUVFRUVFRUV/xVsA3WVMPRTFbE/AAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAG8AAAAZCAYAAAA/vnC8AAAE9ElEQVR4Xu2YW+itQxjGH6GI7dBWCDm0I0WUw46QCzkkEkIoSQ5pl6IokVW4IBeSKIlcOB9yQ0JsceFwIcIuh/xJRO3coJDD+9vv91rzzZpZ6/uWvS9knnpa35rzvM/MO++M1NDQ0NDQ8P/FfsYL8sQEBxnvND5gvNC4fT97E0gjjzKUpc6ySPu7zrhnP3sTtjKuNd5jvM94unHrXgnHTsZr5G3drHJbKa4y/mT8q+Pbxp17JfpYp2nZP4xPGo82fpqkR9438rb5fst4gnweo3Gw8Wrja/LGHuln/4NzjJ8YDzfuaLzV+Ir6E+KbNPIoQ1nqUHcsqPOs8TDj8cb3jb8Zz07KMOHrjW8Y9zeuNj4qF2jbpNy+xg+Mlxu3M54mNyrGXYQbjF8Yfzcel+UFmPfzxl+NX2l2YRxl/EWztmWhPygXlXmMFhDxzjIeK18ReQdgH+NnxouStF2N78lXXICJkkZegDobjLsnaYtA2TeNJ2k6oTXGb+XjYDzgCOP36hv1ALkBT+3+byM30DPdd+B240sqe48UzOkm44/Ge1U28DHyMvRbEo9x/qyybRnvd3LbswCXAh3ScakDBKBzBhFgEqzy9fJdFmLm9Vl1uIgzs/R5iMmy4kP06I9Vys4BCJAba5Vc+IfldcI4iJCCHZzPqQTqnWd8wbhi3KuX67jFeIqWEy/sPmQsVcwTj/Ok1DhlMQwGYgdv7NJSxMAx9FDghnCZCMDCCNA24p0hd38YNDcW5ddr6gHYvX9qVjzaoK3Um5RAPcoSC9BOHhOwuCZyb7CMeBwJuNuX1Z/rKMwTj7SaeJFeG2AtfSxiZ+MmCWRCpNxYeXqIVBMvT88R4rHjVuQLhoUTOL9j2C8fDwgbPN3lBXHtK8bnjHtE4WVQEy+MsUi8MEZef3OJh4EIqOJgrxkrFw/jl0QaKx59cuZx9h3S5XGGTuS7rzYeEDb4Uh5MBRHzQ9Uj98GoibeD8VUtFo9zaJF4a43nLuCJ6gcWgGhxg9xQEUViMM7E3Fi5eNeqLNJY8QCBEVHnpPuPiJx3YIh4uW0AES8L4h3N1huMmnggFamWXhtgmr6L+m6jxNXqR3Scf7gq7mjp/S0XqZZeE6mWniMVj7Fw34s736XySBMsKx4gpmAskyx9MOaJR7BRE48Qd29No7q8fgz8xix9CEI4XGYIyoWW+yO7k/A/N1aIR8S5StPdkosU4qX3xhJS8cA6TQOXuzQNMv6NePRR8lqDMU88wnzOGyK3QER7kO8wWvwPUIfLdVp3CHCPd2vWuLfJrx+ASW+UR7qB3Ywfy1cziEAj/geu1GzdEnLxcJW4uc+NlyXpy4rHInxcm2nncZeKVR7Alb2rfuNr5LsuDZ0vNn6t6WWTdnhtWfS0lAPhJvIQmvaC9Lci3+WgNAZC7x80dWelMdD+U3KjYbwacNPsLkQKm4Sx44oUWEY82qdtNgYvQHiwUWBHYAAaQH3IpZoo6NCk3JHyaIloj8CCsP0O9Z+h+L7f+Lr81QajsQtwc2MQk43xpMxfcNiZjOsK4yXy5zie+9IFiGgvyt8bCawekr8pzjMWbaQ2Sb0HnugxuZAEdE90+an9SCMY+Uiz7bAQeS3iP7sYO/L2ukXBQE+WCxNPVDkw2oFygTmfUnG3FPAMuDbIdwmschYF4+K39Hjd0NDQ0NDQ0NDQ0NDwX8bfR1FxmoULmCcAAAAASUVORK5CYII=>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD4AAAAWCAYAAACYPi8fAAAAoElEQVR4Xu3TsQkCMRSH8Yha2Yl4CJbiAlYOILeAcL1id+U5giNYOoD27mBlK1x/Ywj3BSMXs4A8+P/gI/B4TQhxTkRERERs6VFBDb3pSvOfjc6IDunQqg3daUlT2tOL1vFSkFGZDi0a0Ml9LhRb0IN21A8zf1aUf5csm9AxHQZjulFNF3rSmYbxklX+ErN0GPH/33+BLa1c9/oiIiLyXy0Hyw4+5CG6ZAAAAABJRU5ErkJggg==>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGMAAAAWCAYAAADU1CLnAAAApUlEQVR4Xu3VQQpBQRyA8Ses7CRSlnIBKweQCyh7srPkCI5g6QDs3cHKVtk7hvJNnozJcrL6fvU19e+/mpr3ikKSJEmSJP1PhWZ0pwcdqPe18dGgZTpUPmM60YDatKArjeKlUodW6VB51GhbvC451qczzalazsK5psl7SXm1aJMOS0060o32dKEd1eMl5RMutpsOI+F/Ej5fUxoWn1ciSZIkSb88AeO3Dj6Prh4iAAAAAElFTkSuQmCC>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEIAAAAZCAYAAACFHfjcAAADR0lEQVR4Xu2XW6hOQRTHl1DkHh6ERHJLIVJKOg8ihYQiyovEgxJClCIpxAtvQiS5JJJIeDghiQd5ILlEEk8S5QG5/H9mz9mz95nt2993Dkn7X7/Ot2fPrL1mzZpZc8wqVapUqZx6ijXioNguRogOmR7l1FUsMWdnjxhjcTsjzb2nH/0Zl1fo01YxIPu6/TVONIsm0UesFF/EeotPoki9xDmxzJzT2L1hre0sEI/EeNFd7BDXzI33GiIeiBWii5glnojJQZ92137xTcxNngnGPfFOjPadSmi12JJrGyvui6HJ82DxVCxt6ZF+j/Gokzgkzia/vXaKKxbPnlB7zS1C3donfojlyXMPcVN8tPoMHhO7Lbv6ZAaB8HYIwCcxsaWH63/CXFaSIcPEW7Ep6IPmW+uxMR2w2n2i6iz6iY7JM6v43lLHyooVI6BkWLekbZG4ZKkd3sUmQxCZPEGYLr5b60DMMWc/zKaYGg5EKA4oVueVuT1cj9jX7GOcfWYuMGQW7V5MuCgQvt1PuCgQ+fa82hQIVvCUuQA8FzMtzZB6xJmCDRwGJkhwEVnRbLUDwURjE/4rgQg1SrwRxy1N8TIaZC4DqDpUDiaG47dFX3O2rifteUfDQKyz+ITzgaCacAblOWxuIfPt+FBPFWw5vPjoqty7InGSX7Ss8wTmgjk7viK059ZYaO6OkeexOB9p3yV6/xoZEQfl2gR+e/n0xMEyoipwPuTLLQGi5Hk7nBtFgXhtLnhTxVcrDgTV43dqaGswAMfyzuEYH+WU92KPF6UXY7kkcernxd3C2+Guwp2FyuBFilNZgN8DxUvLfhux5crcbRoKhL/gHLX0Zsdk75oroROCNm56n8WUpC0UQboqNls2UP3NHZB+jLe9LXlGw81lw+LkmfHcNu9Y6hPZekactOwlK6aGAoG4vlLuuAzhDCvzIWn3YqKXzdX3DUF7KCZEsAgItZ5MeGju4AyDM0m8EBvN7XNulXw73JoEgO+dNufHEXHL3NappYYDgUjJJnOOTbOsU6FIaX/wxUTJxQnszLDiqkM77+eZy8qYQlv8LVvO2xSIsmIVY1vjX9Js+8P/qVIZ+Geo1j89/70oX2X2aKVKlSr9V/oJK364m9mJJgwAAAAASUVORK5CYII=>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAG0AAAAWCAYAAADKHRJUAAAE0ElEQVR4Xu2YXaimUxTH14Qi30YmIecgckFTnCaa0RRN5DMfJaZcTIYm+WwopdQkcUG5oKTkQhQ1TRJFHNxMlAuFmkmDGFG4wYXy8f+dtdc5+9nvs99nn2Gm6PnXv/d91rM/1l5r7bXXfsxGjBgxYsSI/y9mxBtLYYazxMfFZ8WbxMO6rxeAjHe0oS19SqwQ14hPiU+Ll4sHdVq0g370ZxzG2yAe0mlhdo54g3iC+dxHiOvEm/NG6V2LXi122K84W9wiviP+Ib7Qfb2I68TPxNXmi94mviUenbXhPzLe0Ya29KFvAMPcL74nzoorxRfNDVAaewjM8Yp4h7lDzhe/EN+wrl4E4l8FvzbXL9CqV4sd9jtw2jXiheI31u+0U8Td1o3MY8WPzA0WeCDJeBegz+fiqvR8nvi9uHaxhdlp4lfipZmsBZeIf4rPiAcn2SPmTrktGglXmjsT7hTvEo/K3oMWvVrtcMBwormCfU5DyV/NFxYgMonEefOIC+XL/nPiL+JV6RmjMg/zBY4UPxCfNx+3FevNs8N28dAke9DcafemZ4DTCKhpaNGrxQ4HFNOcRo4vlQW0/c48ItmxPyZZDvrQF6Ng2Ndt0jgsdt4md+kQMBhpLBzG2fKmTeo65LRWvVrs0IdjxFPN9TjJfL716Rn9AWcn45L1ZmwyeNnltxSyqU5DVlM25OGcsn8uDyPUjFPKlwMWvcl8LlJVvmiMw/w4lBS5R7zVloqM2vylvMUOfbhH/Nk8AxC87FzOWYLgJ/Nz8mVxs7jVfKy7F3o60PUlc8d3UHNaKN6nVK4shkGpsn/utJhjyDjLxe3mhQVn0kPi4d3XC7pRaB2Xns8wP78pPHBui16np/9DdqhhTvzNPHCi2jzZXI+95joBzuZXbSndspa3xWvT+w5qTotOfUrlyl5mw06jGCHSpxmHNHu1eP0ASTMlMAYLZg7GCZCOIoUCHMU5hMFmrU0vUl+LHWoIO+QFUtgcXdApwHjz5vNH6ib9UuV3UHMaqCmVy3Pn5MjltR2Vy8ndGJH305g7IQcRSfC8ZtPvT+hDO4KtRS/kLXaoIezArg/UbJ47DXC9IJOgbwe1AQB5uE8p2hKtbHMikWgo+4eyVHWx9WvGoVKjYmvFxeIT5vMHYr6Y40zxW5t0YjgNI7bq1WKHGv6J0wB3Re6hHdQGAJTrlNbciwKxbSH/Y4HxHKDP7+kXUMVRZebp63jxU/ODuRUxH4bPK8M4WxmPccNYudNWmKek3AEterXYoYZ9dRqkcOk7DhYHKPMrWCl+KD6cyeIwzz97bTTfxrPpmXH4YrDTlr4Y9PVbJ/4gXpDJhsDueE7cJZ6bZDEfTrsvyZiXNc2kZ8B/zrD8a0eLXq126MOceSGSFxTTnBZBh9PeNbftIogaJiWCWCzkMvyJ+Te7AFtzj3nFRSHA3eUx637i4T9fJ5iE+wYGZPL8cxFAccbabH734LMQh2wZLEMgHb1v/imLi++j5ru61AvdPzZP0XeKX5qX2OWnpxa9WuxQ4knr2hd9t5rbOWQEH2vgN/fDFeIO82Dhd9mgktxg7hAKhj6wQM4RFnSR1RdD1JIq8gvmvoC7FimN+aaNles+Y/UAadGrxQ7/FtAzrjD5GTdixIgRI0b8p/E3wA5z7HvTLu4AAAAASUVORK5CYII=>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGMAAAAWCAYAAADU1CLnAAAE2ElEQVR4Xu2YW6ilYxjH/5ND5GxEQvagQRFiSKF9wThFMi4mxIUckhKKUkJyQSgSkhyTY+6YaYjlUESRi6EcckhEDREuyOH/W8/37O9d71prr7U3e66+f/3b63u+9/Q8z/scvi116NChQ4cOC8eO5pXmg+bN5kpz2cCIwIHm7Ypx55rbDr7uAxnvGMNY5vxXHGGuroUNyv3uMU80txgYESh1vMHcc/B1H+h8jGKd+8zTNXqtJcNhZs+cNXcxLzX/MK/RoEPWmB+Zh5vbm7eYL5s7FWP4jYx3jGEsc5i7UGCUa833zH/M6wZf98F+L5gXm/ubN5p/meuad4l9zQ+bcduYp5qfmEcXY9CV/V43V5jLzScVztuqGLek4BagwJnNMw7BAJvMgxvZPuan5nnNM8hxVxQyDIaMdwnmfGzuUcimAc44wzzN/E2jncHejytuPcCgXITSeVuaD5nPN78Tt5rr1Ub3keb35nFzI6T9zK/MUwrZkuJOxeEvap53MN80f1FEDcCgGIQDJ1Ccm9NTREE657FiDFhl/qrW2QsFe45zBntx9qsLGfv9br5ibqcw6Hcann+2BnXCORi+TF9pi0c0Om3/7yAEd1ObGw8xf1JrZED01M4AGANFUZgoIppqZ6QxUXYxmM8ZZ5kbzZMKWY7vKc5PDflbw/OJOhzJRSN1vahhZzC/p+FoT2A7Ip50N9s8zyjOxTnSpqQ89mMMe5VgzgmVrA/Cndv+tSLfJzDwOGekPI0wzhm1fFrM54xRwLgYmYgHafR6filPo49zRi1PzChqDOu8Yz6giNILzM8V6ZGm4V5zrblBUbv2VmB381VVWYNwflrhBBY5Wa1X80CTnJHK1UbfnM6gaL+hKM4UbcC8Sc7A0Bi8NvokZ4BligtM9JW15XrF+tQwxgDq0Z+KvQGNBM4kHY7EQea35hMKJ0Hy7yRnsPAkZ1CUz5nAWQ0W2mmdgcJ0Q5+pbTwAN3WSM0g1XMLa6NM4A6Ab6ZJ0n2BdateqQpa6pDNIoTRPT82NqJCe5qCXNbLS6CVK+bgIKOU7K5Saj8s1WCyndcYaRbGdqeRLmaYS6NZTW2MB69Y2q51BvbhDcY7+w1UNy146QzsNS/GtFwa8/0aRA7NrGecMwnYxmMYZOGKduWvzjFGyMGdqqOenM+iqiERa39ro6QycPDaVaPHOSBCZcy/rSSzOQemiAAWGcCKsEtmBQH7nwfM5wRw+Isu5C8EkZ9DJEMnlRx5p6m5FhO1lfqlWlwQft5vUpjTWL58BaWejhufWWKwz+DunV37MPapWGdLEu4r2ln9DlLKbmmdwgCIq6BIS5yuagBXNM8aggNFplMZaCOaLLAxHjfhBsW/yR7Wt9KgzkAWeVeTqrE+j9DlesfaxhawG63MZ6uiZzxlcBIAzsCv27YPCi0K3KQ7Czf65kZc4yvxCUSQptPTezCnTG7/vN19T9NoYgZtVtsnTgnpFI0GEJjEyStMSgozgUSz/W4ATXjKfUej1sPmW2hYzQcpCx0vMCxX/yrlc4z/4DlUU/tyTj1su5NuFjKxwV0N+p/w5hR0/MN9XAdLKbPOSD5DSwCXorFYrDE1UjQIHX6nJa21u0KpzMzkXf7N1r8Et5cbCuRu7RNhaYZ9xZ+nQoUOHDh2G8C+PGUxzhB6/UAAAAABJRU5ErkJggg==>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAAWCAYAAAB3/EQhAAADLElEQVR4Xu2XS6hNURjHP6G8H3ml1EVSpAwkXSEjkRhIeeYOFCUjN8REwgCZUJKSkIFHJCnJwKMUyqOQRCIlZMaAEv/f/fZ3zjr72ue457p3cs+/fp2z11l77fX/1re+tY9ZQw011BM1XqwW40Rv0U9MFxuy7x1Vf/PxjosDYqroVdHDr2eJw+KoWGz+7G7XbPFD/E74bj6hjmqouCTWibHmQbwjWq0cAD63idtighghzpoHq2/Wp9s0Q7wQL8UTsdt84vVos9iZa5smHpsbRTzvk5hT6mE2UbwTC5O2bhGTOZJvrFOnxH6rTHMCiXmyAO0zN5oGeLC4K05a+y3Spfqf5jHGtmEvD8zaVohrYpB5DeF73jy/3RIPxfCkPUQ9GG2eRYvM68oYsUTMs/J24ZkLMtiCqQjqZLFRtEQj5i+L0+K1eC92mT+go2oSr8wDwFgEgxWlHYXJIvP59tAwcV78Eh/Ms2uPWCnuiZtilTiTtZGBX6ycbRg/JPaaF/YpWXub+ftiUnZNAXpg9RcgBiaAUTyZyJDsN4xhMG+ylvkQ9YQxqS2hZVkbwYn5UkM+iu3ZNVnySMzMrkvihkjREA/hBGg2N7O8BpGKRJWVJrWo+JwaTIzVIahM4o21N/mv5jHz1ZKVM099nkEQQhHkMD9SPBfPxFrzeRaKmxhwi/nEGKwa7EcCeDW7N8RDrlh5tYpMFrXnxdj5PmGez1DePOLojsWAttWgyBARDITCfHpzLbG/2O/pqiAy4rp5+vcRF629gTBP1lD5i9QZ84iCO9+8ZpQ65c3H3lqatNVSvC+w3/JiPE4A9LfUjbSMPkWq1zzXBJ8gl8RKHDN/1QxxRPBWRgXNHxfVxMA3xA6rPKtHma9qc3ZNYaViU5VDc8VnK/cpEkHk3nTPVjMfweSa4PKcCjWZp9tBsd78hYQCVbUoFAhjT82DsMZ8sjyU4pcGhOL01vz/Q4t5xmzK9UlFVnICxX79KbaKc+bHH218ck37t6Qv9/F+gCe2+AVxwhJR8XlZoHKTjp35k8G9bAHG4mUjf5KEqDesFvC9K8WcBmTfeWdIt3hDDTXUA/QHcO+54Avlk6gAAAAASUVORK5CYII=>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFoAAAAWCAYAAABAMosVAAAEI0lEQVR4Xu2YW6hVVRSGR6iQqaUcUcLCY4jhgxDkrcjwQQ6FJFEGokEv3ohAEFJQBEF8SNSHFAUTI0Syy2NGUJSSoNaTQQWFaKGFQj3Zg4Xm/znWOHuuedba+9xBWD/8nLXGGnPuMf85xrwcswYNGjRocD+hW1yVGxM8Ke4Rj4irxfHlz/eAjW/44Eub4cBM8aQ4LbM/IC4S3xUPicvFMSUPx8PiJvO4doiPlj+PPOaKb4pfi7fFD8qfe/Gq+JP4lDhR3CV+KT6S+PCMjW/44Esb2g4F48T3xd+sLBAibxHPiLPELvGEuZi0CTBJF8V14oPii+Iv4sLEZ8SB0C+Lz4pXrVrox8VfxTWJbYr4vfhWYtta2PgWoM3P4vTENlC8Jv5nfYV+WrwuPpfYnjD3e6F4HyseFT8tngO7xS+suipHFAyAAKuERqx/zAcWIJvIntPm2RvC5+0XiDfFFZm9v+g2z9DPrK/QiJXbJonfmlcAMSL8n+ZJkOIV6zumUUE7oVn/qoLCl0EwGCrjr8KWgja0RZSBgvLfZ17i9JuKyhJwKrMBJv20tSprmXjH+gr9kvi/las0Bf08JvaYj41Y5ptXPxUOmMg54srCJ98bJpgvUyW0ExpbndBhD0Hz9nX2/oC1fbP5gHKhQ9A6ocMegtYJndsDCHrN3IeKOm4+KdvNx7O2sBPfxsL3oLWWJ4Q/Ky4u3ntRJ3QE3knoCDxvP1ih2cDes9Zmmwsd8XYSGiGrBO0kNCCj2bfSPSaWplviksIG8mWMCWBpJUlKqBOa9P/KOgtNiXQSmmMYZdaOS82Xhb2FfyAXmoFfymwgF5oBVwnaH6FDE5bOQPSP2IgeoJ80lg3mp7gDvR4F6oQGqaB19rrMTe2TzX+nHbvMN85YMgK50LmggdxeJ2idPUVokvpE/5DnQC40lfiJ+W+U0E5oyqJOaEqLEovdPW8fQm/L7O2wX/w947/mQf9hfnHhAsKRrU7oyDiOfhwNc0FDaE4fdRiK0IBE6U7e76Gd0GQYZcAOHohdH/IcAcR7gDaIlLYdDIgrHwiD46TDxhOYKv5orXKfIV5J3gOUdt42x1CEfttqjrTRadUCTjl/J+5MbLPNszm9sr9unn2zinf64ZZ43so3yIGCfogrqidQFQMb1A3xmeK9KgaOah+LH1r5EpMjNsO0GtsJnU4c7/xG7w2VTKMzMpZSglwwfhDnhZP5GfKy+ZWXTYtz6jtWvuryfFj8xvx4xADJLq7igwVHp7+tFRvVwdLBJg0ofeJaL75hfuXnXwppsiDw5+JH5pv2MfOjVzppOfjdWK4giUYipbHwjO1cYqMNbcnoC+YTPGAwuB4rH9pzMMA55pPxvJUnYqRAxbHmQp6rwGWC/YK4+JtfLoYbD5n/xmiMv0GDBg0aDBJ3AZDNIn7a+NlDAAAAAElFTkSuQmCC>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGwAAAAWCAYAAAAl33lqAAAAp0lEQVR4Xu3VMQ4BQRhA4RVUOhEiUYoLqBxAXECiJzolR3AEpQPQu4NKK9E7hsSbWDGm00wh70teNvnzV7PZnaKQJEmSJEn6NxWa0Z0edKDe18ZHg5bpUHmN6UQDatOCrjSKl0odWqVD5VOjbfF6EbE+nWlO1XIWnmuavJeUX4s26bDUpCPdaE8X2lE9XlJe4fC76TAS7rfwq5zSsPh8bZIkSZKk3z0Bh/IOPvUhHKAAAAAASUVORK5CYII=>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE4AAAAWCAYAAABud6qHAAAAoUlEQVR4Xu3UMQ4BQRhA4RVUOhEiUYoLqBxAXECiJzolR3AEpQPQu4NKK9E7hsSbWDGm0inmfcnLJH/+ajK7RSFJkiRJv6rQjO70oAP1vjY+GrRMh7ka04kG1KYFXWkUL5U6tEqHOarRtnhdSKxPZ5pTtZyFc02T91LOWrRJh6UmHelGe7rQjurxUq7CJXTTYST8/8InPKVh8Xl9kiRJ+p8nuecOPjaC0G4AAAAASUVORK5CYII=>

[image27]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACoAAAAWCAYAAAC2ew6NAAACoklEQVR4Xu2VzauNURTG1y2KkI9bpMhHPjIQhZSQAWJAykfCX4ARoWSgMGAgkUQmBiJSJAMRt0zEQCkMDERkZCImSjw/a6979tn33efekaTz1K9z3rU/3mfv9e61zbr6vzRO9IqesiHTcDGqDP4tYWy/uCNOiYvWbGakOC82lg1outheBjPNNZ/8kthhPlkpYrTRh76MybVIvBYzzU0fE5/EHjFNTBFbxQtxQQzzYWbzxG7xSPwUV6Kh0GbzFywUo81f8ECMzfrwnxht9KEvYxgb2ieeiDHpebk4YO6DTdoptonb5qb7RYdNYpn4aM1Gp4q35pOExovnYm8WO5RitIUY80ZMSs/M32e+EMQOn0v/Ebt80iopR5PFe2s2ysu+m08aYsKr1nppGC/HLxHfrPXiw9ZulPbj6T9aI85YlvJSnYyetYFGEX0/m39vZOZLiuViDGNPpOdV5tmJtPLZxSImihtZW6M6GSVWMxrxMFSOL+OUHA7JTfMDdN18d9lBdrKa8lDNKJP02eBGN4hfKZarNIp6xALzNEflwGCknPal4rRYl9r7VTNKjXtogxtdb0M3WopU30q/iCrBO2eLI9EpVDOKckO1eM1QLR4qU06Je2qtChPVol+djHIQakYpaewEB4qDVY4Po5z2JuUpR3wSX80/JcRn0KZORpmMy2B1Fhsh7iX4H99yPIcY8yP9lipTjmJhYXSAwii1sVxFr3gmjmaxWea7mV+5u8QHMSM9Mw+3FKnMbzAUKedA5cI084bRqLd/VkoDO8ZhAAr0SzE/OkmLxTtxUGwxL+7cIJSbUJSex+a3HSZfmV+lpcgS48tNYQGXs7YV7c1DExVgrbkJrtUmMfkc88WstPaFhMgQZvht0gRxTdwXd4u2rrr65/QbxPqXiTq7DLEAAAAASUVORK5CYII=>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAZCAYAAACclhZ6AAACoklEQVR4Xu2WT4hPURTHv0L5GzKREEkjpagZiSILKYk0JBllodhYoJiazRAWZpJiM01JlFKULKamWPwapVBYIKFEYkdqRlmI73fOPfO7v/d7d+bXSL9ZvG99eu+ed99759x3zrkPKFSo0Fi0lOwni8hEMoWsJofDeawVpJP0wO6ZWnm5/tpAfpE/EYNkezyJ2k1ekzVkBjlL7pNZ8aR6qwnm5BvygpwhCypmAIvJO9Ia2eaQp+RoZKu7FMyVrDEjBaGvpbmuCeQmKcG+1LhQLcFcRnUw0nXylSzL2F2zyRKygyyE1eDmMJ4b5qhO9dxdsPrVIrl03kiOkINkJawsktKD7pIb5D35RDpQWdxyOhVMnt11nHyH1eF5co3sgy3ON1gd3oI1m5OwZx0butMCuUjOwZqTArkHe2dScuQxWR7GWrEnsI41GZZCJeQ7PVow0lryk/ShvEBy7jP5gvJ7J5E7KKftfPIMdr9LASnApOTw9IytHdbh1odrD5DvdC3B6JrmKFVcajAfYTUXp5WeV4IF00BekZfkAGwB5OtMn1yr2mCpcSKMU06n7LE8GNWJy4PJpkwcjKTtQff6lqEy0NaQK6WU2quinxfZPRgdJeV7ntN6udJFq5bSvwQjedO4QH6g2tdh+UOzE5RmCmZnGOv4m2wZnmEv6Q1k/xRijTUYzdE4DmwjrM6yizokFV03WRfZtKP3w+rEd3dvCqfDWFLh6quoO40kbwAtkW2kYFQnqhfN0bkCcK2C+aE2nyvtAw9JFzlEnpNHqE6dZvKBnCJ7YOmpT6+iTOkS7It6zt+GteCByPYWtinr6DZd3wvzQ+/RfVdh3W0bRpEc2gRzUu1PG1me1Nm2wjY4/eL8T8mHaeFcm6/KIOVXoUKFChUaf/oL8tqXsn2rV8cAAAAASUVORK5CYII=>