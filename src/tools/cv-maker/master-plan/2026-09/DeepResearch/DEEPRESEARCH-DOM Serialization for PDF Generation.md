# **Serialização da Árvore DOM em Tempo Real para Geração Determinística de PDF**

A convergência entre interfaces reativas modernas executadas no navegador e os subsistemas de composição de documentos impressos impõe desafios de engenharia que expõem as limitações dos modelos tradicionais de renderização. Em aplicações contemporâneas orientadas a componentes, a interface com o utilizador é o resultado direto de um grafo de dependências dinâmico, onde estados de ciclo de vida, mutações no Document Object Model (DOM), folhas de estilo construtíveis e variáveis em cascata determinam a geometria visual final.  
A abordagem convencional de transferir a responsabilidade de geração de relatórios e documentos paginados para motores de modelos no lado do servidor (como Handlebars, Pug ou geradores baseados em linguagens de composição estática) introduz uma fratura arquitetural severa. Esta bifurcação exige a manutenção paralela de duas implementações visuais distintas para a mesma entidade de negócio, conduzindo a desvios sistemáticos de layout, discrepâncias na quebra tipográfica e inconsistências cronológicas entre a vista do ecrã e o documento exportado.  
A resolução determinística deste problema exige a adoção do princípio de fonte única de verdade através da captura e serialização hermética da subárvore do DOM ativo diretamente a partir da memória do navegador hospedeiro. Este processo congela as propriedades de estilo computadas, materializa nós gerados por pseudo-elementos, incorpora fontes tipográficas em formatos binários e substitui todos os recursos de rede por identificadores estáticos de dados, produzindo um documento autónomo para o subsistema de paginação do Chromium1.

## **Arquitetura de Clonagem Profunda e Preservação de Estados Computados**

A extração de uma subárvore ativa para subsequente processamento em motores desacoplados não pode basear-se na invocação ingénua do método nativo Node.cloneNode(true). A implementação padrão deste método limita-se a duplicar a hierarquia estrutural estática de elementos, os seus atributos intrínsecos e os nós textuais associados, ignorando o estado interno mutável da máquina virtual e as estruturas instanciadas pelo subsistema de renderização do motor de visualização2.  
Durante a mutação interativa, o estado de controlos de formulário desvia-se dos atributos HTML declarativos. O valor presente no buffer de um elemento HTMLInputElement ou HTMLTextAreaElement reside na propriedade de instância do protótipo, não sendo refletido no atributo textual value a menos que uma rotina de sincronização o declare expressamente. O mesmo comportamento governa caixas de seleção e botões de rádio, cujo estado lógico reside na propriedade booleana checked, e caixas de seleção múltipla (HTMLSelectElement), nas quais a relação ordinal selecionada deve ser persistida através da aposição do atributo selected no nó HTMLOptionElement correspondente. Adicionalmente, elementos de computação gráfica de baixa granularidade, como o HTMLCanvasElement, mantêm os seus mapas de bits em texturas de GPU ou buffers de memória volátil, resultando em superfícies transparentes caso a camada não seja convertida num elemento HTMLImageElement estático preenchido com a serialização rasterizada do buffer através de chamadas a toDataURL('image/png')2.

TypeScript  
// Exemplo conceitual da sincronização imperativa de estado durante a clonagem  
if (sourceNode instanceof HTMLInputElement) {  
  if (sourceNode.type \=== 'checkbox' || sourceNode.type \=== 'radio') {  
    if (sourceNode.checked) clone.setAttribute('checked', '');  
  } else {  
    clone.setAttribute('value', sourceNode.value);  
  }  
} else if (sourceNode instanceof HTMLCanvasElement) {  
  const img \= document.createElement('img');  
  img.src \= sourceNode.toDataURL('image/png');  
  return img;  
}

A preservação das variáveis de CSS (CSS Custom Properties) introduz complexidades adicionais devido à sua semântica de cascata e herança léxica7. Caso uma subárvore isolada seja serializada fora do contexto raiz (:root ou \<html\>), os nós clonados perdem imediatamente o acesso aos valores herdados do topo do documento7. Mais crítico ainda, quando estas variáveis são redefinidas dinamicamente em nós intermédios por meio de manipuladores de estilo em tempo de execução, a cópia estática do CSSOM é insuficiente para rastrear o grafo de resolução de nós descendentes.  
A extração das variáveis no motor Blink pode ser executada por intermédio de três técnicas fundamentais: a interrogação de propriedades via window.getComputedStyle(), a introspeção tipada com a API CSS Typed OM (Element.computedStyleMap()), e a análise sintática de texto através de document.styleSheets9.

| Mecanismo de Extração | Suporte no Chromium | Complexidade Computacional | Natureza da Tipagem | Enumeração Direta de Variáveis (--\*) |
| :---- | :---- | :---- | :---- | :---- |
| window.getComputedStyle() | Integral (Blink legado e moderno)12 | ![][image1] recalculos de estilo | Textual não estruturada (string)11 | Não acessível por índices numéricos no Chromium10 |
| element.computedStyleMap() | Nativo no Blink (Chromium moderno)8 | ![][image2] acesso direto via C++ | Objetos estruturados (CSSStyleValue)14 | Sim (Iterável direto chave-valor)10 |
| Varredura Léxica de styleSheets | Dependente de permissões de origem9 | ![][image3] parsing de regras9 | Fragmentos crus de folha de estilo9 | Sim (limitado a regras declaradas estáticas)8 |

A interface Element.computedStyleMap() sobressai como a abordagem mais eficiente para a serialização no Chromium, pois permite iterar sobre um objeto StylePropertyMapReadOnly e recolher todas as propriedades ativas no nó que iniciam pelo prefixo canónico \--10. Quando estas variáveis são consolidadas, devem ser projetadas num bloco de declarações estáticas associado à pseudo-classe :root no cabeçalho do documento serializado, estabilizando permanentemente o cálculo da cascata em qualquer leitor posterior7.  
Os pseudo-elementos estruturais (::before e ::after) constituem outro caso limite de extrema relevância: dado que não integram o grafo de nós DOM, não possuem interface no DOM clássico e não admitem a injeção de estilos diretos através de atributos style17. Em designs modernos, estes pseudo-elementos suportam decorações tipográficas, separadores visuais e contadores algorítmicos18.  
Para os materializar, o algoritmo de inspeção deve aplicar window.getComputedStyle(elemento, '::before') e window.getComputedStyle(elemento, '::after') em cada nó do percurso12. Caso a propriedade content retorne um valor semântico discernível (ou seja, diferente da palavra-chave 'none' ou de cadeias vazias sem ocupação espacial), o algoritmo associa um atributo identificador determinístico ao elemento hospedeiro (como data-pdf-pseudo-id="uid-n")4. Simultaneamente, as propriedades de posicionamento, geometria, fundos e tipografia do pseudo-elemento são extraídas e convertidas numa regra explícita injetada numa folha de estilos global gerada dinamicamente3.  
A proliferação de arquiteturas baseadas em componentes encapsulados e Web Components trouxe a utilização em larga escala de folhas de estilo construtíveis partilhadas através da matriz adoptedStyleSheets em nós de raiz de sombra (ShadowRoot) e no próprio Document20. Tais regras residem exclusivamente na memória da instância e não existem na forma de elementos declarativos \<style\> na árvore21. Consequentemente, o processo de serialização deve transpor os nós que abrigam raízes de sombra para a sintaxe padronizada de Declarative Shadow DOM (DSD), estruturando o encapsulamento através do elemento \<template shadowrootmode="open"\>23. No interior de cada template, as regras contidas nas instâncias de CSSStyleSheet associadas a esse escopo são lidas iterativamente através de sheet.cssRules e impressas como folhas de estilo inline convencionais, garantindo a recomposição exata do grafo estilístico sem recurso a hidratação de scripts16.

## **Resolução e Embutimento Determinístico de Fontes Tipográficas**

A integridade do layout paginado depende intrinsecamente da sincronização métrica das fontes tipográficas. O motor de renderização Blink processa o carregamento de fontes através de um pipeline assíncrono projetado para minimizar o bloqueio da renderização de páginas interativas na web, o que frequentemente resulta na transição visual indesejada de fontes substitutas para as fontes definitivas25. No contexto da geração de um PDF estático, a ocorrência de texto invisível ou a aplicação tardia de uma métrica tipográfica distinta resulta em quebras de linha desalinhadas, tabelas sobrepostas e truncagem de parágrafos1.  
Embora a API de carregamento de fontes disponibilize a promessa document.fonts.ready, a sua resolução assinala unicamente que as fontes ativamente referenciadas pelo renderizador completaram o seu carregamento imediato25. Quando fontes web externas (por exemplo, distribuídas via Google Fonts ou redes de entrega de conteúdo) são declaradas através de nós \<link\> ou regras @import, o navegador adia o descarregamento dos binários até que um nó visível e correspondente a um determinado intervalo de carateres (unicode-range) seja efetivamente desenhado no viewport27. Para contornar esta latência, a orquestração deve percorrer os nós de texto, analisar os valores computados de font-family, font-weight e font-style, e invocar imperativamente o método document.fonts.load() para todas as permutações presentes no documento antes de acionar o congelamento da árvore27.  
O embutimento determinístico exige a neutralização completa de dependências de rede externas na folha de estilos, substituindo qualquer referência remota por um descritor binário autocontido baseado em Data URIs1. O algoritmo varre o conjunto de regras CSSFontFaceRule presentes em document.styleSheets, contornando exceções de segurança originadas por restrições de mesma origem (CORS) em folhas externas através do consumo direto das propriedades autorizadas9. Ao isolar as declarações de origem (src), extrai os URLs dos ficheiros tipográficos, efetua o pedido binário através de uma camada de rede configurada para tirar partido da cache do navegador e codifica o vetor binário resultante em cadeias Base6430.

| Formato Tipográfico | Rácio de Compressão | Algoritmo de Contentor | Fidelidade no Blink / Skia | Recomendações de Utilização |
| :---- | :---- | :---- | :---- | :---- |
| **WOFF2** | Muito Alto | Compressão Brotli | Suporte nativo completo (Blink ![][image4] 36\) | Formato padrão prioritário; menor peso textual em Base6430 |
| **WOFF** | Médio | Compressão zlib | Suporte nativo amplo | Formato secundário para contingência de navegadores antigos |
| **TTF / OTF** | Baixo | Sem compressão intrínseca | Suporte nativo direto | Evitar devido à expansão excessiva da cadeia de serialização |
| **SVG Fonts** | Nulo | XML vetorial não compactado | Descontinuado no Chromium | Inadequado para pipelines de publicação paged media modernos |

O formato WOFF2 destaca-se como o padrão prioritário para este procedimento, oferecendo taxas de compressão superiores devido à modelação preditiva e ao empacotamento com Brotli, reduzindo substancialmente a sobrecarga decorrente da posterior conversão em texto alfanumérico29. A regra tipográfica é então reconstruída no cabeçalho do documento estático com a sintaxe explícita src: url("data:font/woff2;base64,...") format("woff2");, garantindo que o subsistema de paginação disponha de acesso síncrono e instantâneo aos glifos no exato momento da rasterização vetorial no Chromium30.

## **Serialização Hermética de Ativos Gráficos e Vetoriais**

A presença de referências remotas a imagens e elementos vetoriais inviabiliza o determinismo temporal exigido por chamadas à API Page.printToPDF via Chrome DevTools Protocol (CDP)32. Se uma imagem contiver um URL relativo ou externo, o método page.setContent() em instâncias headless do navegador tentará restabelecer conexões de rede ou falhará perante políticas de segurança e isolamento de processos34.  
Para garantir que a totalidade dos ativos de média seja serializada sem custos adicionais de latência, o subsistema baseia-se na extração direta dos recursos a partir do contexto de execução local2. Elementos HTMLImageElement que já se encontrem completamente descodificados pelo navegador (com a propriedade booleana complete estabelecida como verdadeira e com resolução física confirmada por naturalWidth \> 0\) podem ter o seu conteúdo rasterizado transcrito sem novo ciclo de rede2.  
A via mais rápida consiste na alocação de um elemento temporário \<canvas\> no qual a imagem é desenhada nas suas dimensões nativas, convertendo a matriz de píxeis imediatamente para uma cadeia de dados Base64 através do método toDataURL('image/png')2. Quando o ativo tem origem num domínio externo sem cabeçalhos Access-Control-Allow-Origin, a tela entra em estado corrompido (*tainted canvas*), provocando uma exceção do tipo SecurityError3. Para assegurar a robustez da arquitetura, implementa-se um mecanismo de recuperação que efetua a leitura através de window.fetch(src, { cache: 'force-cache' }), assegurando que o motor extraia os bytes diretamente da cache HTTP local do processo e os converta para Base64 através da API FileReader3.  
A mesma problemática afeta declarações de estilo associadas a imagens decorativas ou de preenchimento, tais como background-image, mask-image e border-image4. A rotina de serialização analisa as regras computadas de todos os elementos recolhidos, submetendo os valores das propriedades a analisadores baseados em expressões regulares concebidos para isolar padrões da forma url(...)35. Os caminhos relativos são resolvidos contra o endereço base do documento original (document.baseURI), recuperados via cache e substituídos na réplica pela respetiva cadeia de dados35.  
Ao contrário de imagens rasterizadas, elementos vetoriais embutidos sob a forma de nós \<svg\> beneficiam de preservação direta no DOM2. O motor de impressão do Chromium trata as primitivas vetoriais (curvas de Bézier, caminhos poligonais e polígonos preenchidos) como instruções geométricas diretas enviadas ao rasterizador de impressão Skia, garantindo fidelidade perfeita em qualquer resolução de saída (300 a 1200 DPI) sem degradação de nitidez2.  
A integridade do SVG exige, no entanto, a validação de parâmetros estruturais essenciais: a inclusão explícita do atributo de espaço de nomes XML (xmlns="http://www.w3.org/2000/svg") e a declaração de dimensões escaláveis através de viewBox, suprimindo incongruências na definição de limites provocadas pelo modelo de corte do modo de impressão2.

## **Gestão de Memória, Sobrecarga de Desempenho e Casos Limite no Chromium**

A serialização de documentos densos de uma a três páginas com ilustrações ou planos de fundo de alta definição e fontes corporativas embutidas impõe exigências severas à alocação de memória do motor V8 e aos algoritmos de fragmentação do subsistema de layout do Chromium32.  
A conversão de fluxos binários para representações textuais em Base64 introduz uma penalização matemática invariável na dimensão dos recursos30. Cada bloco de três bytes binários (24 bits) é reconfigurado em quatro carateres alfanuméricos ASCII (32 bits), estabelecendo uma expansão teórica volumétrica exata de quatro terços:  
![][image5]  
Ao considerar um documento de formato ISO A4 impresso a uma densidade de 300 pontos por polegada (DPI), a dimensão física do quadro em píxeis é calculada através das proporções estandardizadas do papel:  
![][image6]  
![][image7]  
Um único plano de fundo rasterizado que ocupe a totalidade da mancha gráfica necessita, no contexto de decodificação interna de píxeis RGBA de 32 bits, de uma área substancial de memória:  
![][image8]  
Embora a imagem comprimida em formato PNG ou JPEG possua uma pegada física em disco habitualmente contida entre 2 MB e 6 MB, a sua transcrição para o formato Base64 eleva o consumo de caracteres, gerando repercussões diretas no heap do motor JavaScript V8.

| Componente Serializado (3 Páginas A4) | Dimensão Binária Estimada | Dimensão do Texto Base64 | Ocupação no Heap do V8 (UTF-16) |
| :---- | :---- | :---- | :---- |
| **3× Imagens de Fundo (300 DPI)** | **![][image9]** | **![][image10]** | **![][image11]** |
| **4× Variantes de Fontes WOFF2** | **![][image12]** | **![][image13]** | **![][image14]** |
| **Estrutura DOM e Regras CSSOM** | **![][image15]** | N/A (Codificação textual) | ![][image16] |
| **Carga Útil Consolidada** | **![][image17]** | **![][image18]** | **![][image19]** |

No motor V8, cadeias de texto que excedem os limiares de alocação imediata passam a residir no *Large Object Space* (LOS). Mutações ou concatenações iterativas através de operadores aritméticos simples geram representações intermédias redundantes na memória, induzindo a fragmentação da pilha e despoletando pausas prolongadas para recolha de lixo por parte dos algoritmos de compactação de memória36. Desta forma, a serialização deve estruturar os dados através de acumuladores matriciais baseados em Array\<string\>, agregando a saída numa operação atómica através de Array.prototype.join('').  
No âmbito do modelo de formatação paged media, o motor de paginação do Chromium (LayoutNG) apresenta particularidades operacionais críticas no tratamento de fragmentação vertical37. A utilização de contentores modernos estruturados via CSS Flexbox e CSS Grid pode induzir anomalias na segmentação física das páginas impressas, com o motor a dividir elementos indivisíveis ao meio ou a ignorar sistematicamente declarações de controlo de quebra como break-inside: avoid37.  
A resolução desta fragilidade exige que o gerador de instantâneos interceda no CSS computado dos elementos demarcados como indivisíveis, convertendo temporariamente a sua propriedade display para block ou adotando abstrações tabulares tradicionais (display: table, display: table-row), sobre as quais o algoritmo de paginação do LayoutNG demonstra estabilidade comprovada.  
Adicionalmente, os navegadores baseados no Chromium aplicam historicamente otimizações concebidas para a economia de consumíveis em impressoras domésticas, suprimindo o desenho de fundos cromáticos e imagens estruturais38. O documento serializado deve neutralizar ativamente esta política através da injeção explícita de declarações globais de alta prioridade40:

CSS  
\*, \*::before, \*::after {  
  \-webkit-print-color\-adjust: exact \!important;  
  print-color\-adjust: exact \!important;  
}

A orquestração do documento deve ser acompanhada pela configuração precisa dos parâmetros submetidos via automação (Puppeteer, Playwright ou chamadas diretas ao CDP) para que a representação em papel reflita com exatidão o viewport ativo32.

| Parâmetro CDP (Page.printToPDF) | Configuração Determinística | Função no Subsistema de Renderização |
| :---- | :---- | :---- |
| printBackground | true | Ativa explicitamente o desenho de gradientes, cores de preenchimento e imagens em camadas de fundo32. |
| preferCSSPageSize | true | Prioriza as dimensões declaradas nas regras @page em oposição aos parâmetros dimensionais padrão fornecidos pela automação32. |
| scale | 1.0 | Inibe a interpolação artificial do viewport, preservando a fidelidade submétrica de linhas e corpos tipográficos33. |
| marginTop, marginBottom, marginLeft, marginRight | 0 (Zero absoluto) | Elimina margens artificiais injetadas pelo perfil do agente de utilizador, transferindo o controlo espacial exclusivamente para o modelo CSS33. |
| displayHeaderFooter | false | Remove as marcações de cabeçalho e rodapé geradas automaticamente pelo Chromium (data, endereço e numeração não estilizada)33. |

## **Implementação de Referência: DOMSnapshotSerializer**

A implementação seguinte reúne os padrões arquiteturais discutidos, providenciando uma solução em TypeScript estrito para a serialização de subárvores DOM ativas em documentos herméticos de alta fidelidade.

TypeScript  
export interface DOMSnapshotOptions {  
  freezeCustomProperties?: boolean;  
  inlinePseudoElements?: boolean;  
  inlineFonts?: boolean;  
  inlineImages?: boolean;  
  pageSize?: 'A4' | 'Letter';  
  orientation?: 'portrait' | 'landscape';  
}

export class DOMSnapshotSerializer {  
  private pseudoCounter \= 0;  
  private generatedRules: string\[\] \= \[\];  
  private processedFonts \= new Set\<string\>();

  constructor(private options: DOMSnapshotOptions \= {}) {  
    this.options \= {  
      freezeCustomProperties: true,  
      inlinePseudoElements: true,  
      inlineFonts: true,  
      inlineImages: true,  
      pageSize: 'A4',  
      orientation: 'portrait',  
      ...options,  
    };  
  }

  public async serialize(element: HTMLElement): Promise\<string\> {  
    this.pseudoCounter \= 0;  
    this.generatedRules \= \[\];  
    this.processedFonts.clear();

    await document.fonts.ready;

    const clonedRoot \= this.cloneSubtree(element);

    let fontStyles \= '';  
    if (this.options.inlineFonts) {  
      fontStyles \= await this.extractAndInlineFonts();  
    }

    let customPropertiesStyle \= '';  
    if (this.options.freezeCustomProperties) {  
      customPropertiesStyle \= this.extractAndFreezeCustomProperties(element);  
    }

    if (this.options.inlineImages) {  
      await this.inlineImagesAndBackgrounds(clonedRoot);  
    }

    const adoptedStyles \= this.extractAdoptedStylesheets();

    const pseudoStyleBlock \= this.generatedRules.length \> 0  
      ? \`\<style id="pdf-materialized-pseudos"\>\\n${this.generatedRules.join('\\n')}\\n\</style\>\`  
      : '';

    const basePageStyle \= \`  
      \<style id="pdf-base-page-rules"\>  
        @page {  
          size: ${this.options.pageSize} ${this.options.orientation};  
          margin: 0;  
        }  
        \*, \*::before, \*::after {  
          \-webkit-print-color-adjust: exact \!important;  
          print-color-adjust: exact \!important;  
          box-sizing: border-box;  
        }  
        html, body {  
          margin: 0;  
          padding: 0;  
          width: 100%;  
          background-color: \#ffffff;  
        }  
        .pdf-page-break-avoid {  
          break-inside: avoid \!important;  
          page-break-inside: avoid \!important;  
          display: block \!important;  
        }  
      \</style\>  
    \`;

    return \[  
      '\<\!DOCTYPE html\>',  
      '\<html lang="pt"\>',  
      '\<head\>',  
      '  \<meta charset="utf-8" /\>',  
      '  \<meta name="viewport" content="width=device-width, initial-scale=1.0" /\>',  
      basePageStyle,  
      fontStyles,  
      customPropertiesStyle,  
      adoptedStyles,  
      pseudoStyleBlock,  
      '\</head\>',  
      '\<body\>',  
      clonedRoot.outerHTML,  
      '\</body\>',  
      '\</html\>'  
    \].join('\\n');  
  }

  private cloneSubtree(sourceNode: HTMLElement): HTMLElement {  
    const clone \= sourceNode.cloneNode(false) as HTMLElement;

    if (sourceNode instanceof HTMLInputElement) {  
      if (sourceNode.type \=== 'checkbox' || sourceNode.type \=== 'radio') {  
        if (sourceNode.checked) clone.setAttribute('checked', '');  
      } else {  
        clone.setAttribute('value', sourceNode.value);  
      }  
    } else if (sourceNode instanceof HTMLTextAreaElement) {  
      clone.textContent \= sourceNode.value;  
    } else if (sourceNode instanceof HTMLSelectElement) {  
      const selectClone \= clone as HTMLSelectElement;  
      for (let i \= 0; i \< sourceNode.options.length; i++) {  
        if (sourceNode.options\[i\].selected) {  
          selectClone.options\[i\]?.setAttribute('selected', 'selected');  
        }  
      }  
    } else if (sourceNode instanceof HTMLCanvasElement) {  
      const img \= document.createElement('img');  
      img.width \= sourceNode.width;  
      img.height \= sourceNode.height;  
      img.className \= sourceNode.className;  
      img.style.cssText \= sourceNode.style.cssText;  
      try {  
        img.src \= sourceNode.toDataURL('image/png');  
      } catch {  
        img.src \= '';  
      }  
      return img;  
    }

    if (this.options.inlinePseudoElements) {  
      this.materializePseudoElement(sourceNode, clone, '::before');  
      this.materializePseudoElement(sourceNode, clone, '::after');  
    }

    for (let child \= sourceNode.firstChild; child \!== null; child \= child.nextSibling) {  
      if (child.nodeType \=== Node.ELEMENT\_NODE) {  
        clone.appendChild(this.cloneSubtree(child as HTMLElement));  
      } else if (child.nodeType \=== Node.TEXT\_NODE) {  
        clone.appendChild(child.cloneNode(false));  
      }  
    }

    return clone;  
  }

  private materializePseudoElement(  
    source: HTMLElement,  
    target: HTMLElement,  
    pseudo: '::before' | '::after'  
  ): void {  
    const computed \= window.getComputedStyle(source, pseudo);  
    const content \= computed.getPropertyValue('content');

    if (\!content || content \=== 'none' || content \=== '""' || content \=== "''") {  
      return;  
    }

    const pseudoUid \= \`pdf-pseudo-${++this.pseudoCounter}\`;  
    const pseudoAttr \= pseudo \=== '::before' ? 'data-pdf-pseudo-before' : 'data-pdf-pseudo-after';  
    target.setAttribute(pseudoAttr, pseudoUid);

    const propertiesToPreserve \= \[  
      'content', 'display', 'position', 'top', 'right', 'bottom', 'left',  
      'width', 'height', 'margin', 'padding', 'background', 'background-color',  
      'background-image', 'border', 'color', 'font', 'font-family', 'font-size',  
      'font-weight', 'line-height', 'text-align', 'box-shadow', 'opacity',  
      'transform', 'z-index'  
    \];

    const declarations \= propertiesToPreserve  
      .map(prop \=\> {  
        const val \= computed.getPropertyValue(prop);  
        return val ? \`  ${prop}: ${val} \!important;\` : null;  
      })  
      .filter((line): line is string \=\> line \!== null)  
      .join('\\n');

    const selector \= \`\[${pseudoAttr}="${pseudoUid}"\]${pseudo}\`;  
    this.generatedRules.push(\`${selector} {\\n${declarations}\\n}\`);  
  }

  private extractAndFreezeCustomProperties(element: HTMLElement): string {  
    const variableEntries: \[string, string\]\[\] \= \[\];

    if ('computedStyleMap' in element) {  
      const styleMap \= (element as any).computedStyleMap();  
      for (const \[prop, val\] of styleMap) {  
        if (typeof prop \=== 'string' && prop.startsWith('--')) {  
          variableEntries.push(\[prop, val.toString().trim()\]);  
        }  
      }  
    } else {  
      const computed \= window.getComputedStyle(element);  
      for (let i \= 0; i \< computed.length; i++) {  
        const prop \= computed\[i\];  
        if (prop.startsWith('--')) {  
          variableEntries.push(\[prop, computed.getPropertyValue(prop).trim()\]);  
        }  
      }  
    }

    if (variableEntries.length \=== 0) {  
      return '';  
    }

    const declarations \= variableEntries  
      .map((\[k, v\]) \=\> \`  ${k}: ${v};\`)  
      .join('\\n');

    return \`\<style id="pdf-frozen-custom-properties"\>\\n:root {\\n${declarations}\\n}\\n\</style\>\`;  
  }

  private extractAdoptedStylesheets(): string {  
    const sheets: CSSStyleSheet\[\] \= \[\];

    if (document.adoptedStyleSheets) {  
      sheets.push(...document.adoptedStyleSheets);  
    }

    const rules: string\[\] \= \[\];  
    for (const sheet of sheets) {  
      try {  
        for (let i \= 0; i \< sheet.cssRules.length; i++) {  
          rules.push(sheet.cssRules\[i\].cssText);  
        }  
      } catch {  
        continue;  
      }  
    }

    if (rules.length \=== 0) return '';  
    return \`\<style id="pdf-adopted-stylesheets"\>\\n${rules.join('\\n')}\\n\</style\>\`;  
  }

  private async extractAndInlineFonts(): Promise\<string\> {  
    const inlinedFontRules: string\[\] \= \[\];

    for (let i \= 0; i \< document.styleSheets.length; i++) {  
      const sheet \= document.styleSheets\[i\];  
      let sheetRules: CSSRuleList;  
      try {  
        sheetRules \= sheet.cssRules;  
      } catch {  
        continue;  
      }

      for (let j \= 0; j \< sheetRules.length; j++) {  
        const rule \= sheetRules\[j\];  
        if (rule instanceof CSSFontFaceRule) {  
          const cssText \= rule.cssText;  
          const urlMatch \= cssText.match(/url\\((?:\["'\]?)(.\*?)(?:\["'\]?)\\)/);  
          if (\!urlMatch || \!urlMatch\[1\] || urlMatch\[1\].startsWith('data:')) {  
            inlinedFontRules.push(cssText);  
            continue;  
          }

          const fontUrl \= new URL(urlMatch\[1\], sheet.href || document.baseURI).href;  
          if (this.processedFonts.has(fontUrl)) continue;  
          this.processedFonts.add(fontUrl);

          try {  
            const base64Data \= await this.fetchResourceAsBase64(fontUrl);  
            const formatMatch \= cssText.match(/format\\((?:\["'\]?)(.\*?)(?:\["'\]?)\\)/);  
            const format \= formatMatch ? formatMatch\[1\] : 'woff2';  
            const newSrc \= \`url("data:font/${format};base64,${base64Data}") format("${format}")\`;  
            const modifiedRule \= cssText.replace(/src:\\s\*\[^;\]+;/, \`src: ${newSrc};\`);  
            inlinedFontRules.push(modifiedRule);  
          } catch {  
            inlinedFontRules.push(cssText);  
          }  
        }  
      }  
    }

    if (inlinedFontRules.length \=== 0) return '';  
    return \`\<style id="pdf-inlined-fonts"\>\\n${inlinedFontRules.join('\\n')}\\n\</style\>\`;  
  }

  private async inlineImagesAndBackgrounds(target: HTMLElement): Promise\<void\> {  
    const images \= Array.from(target.querySelectorAll('img'));  
    for (const img of images) {  
      if (img.src && \!img.src.startsWith('data:')) {  
        try {  
          const absoluteUrl \= new URL(img.src, document.baseURI).href;  
          const base64 \= await this.fetchResourceAsBase64(absoluteUrl);  
          const mime \= absoluteUrl.endsWith('.svg') ? 'image/svg+xml' : 'image/png';  
          img.src \= \`data:${mime};base64,${base64}\`;  
        } catch {  
          continue;  
        }  
      }  
    }

    const elements \= Array.from(target.querySelectorAll('\*')) as HTMLElement\[\];  
    elements.push(target);

    for (const el of elements) {  
      const bg \= el.style.backgroundImage || window.getComputedStyle(el).backgroundImage;  
      if (bg && bg \!== 'none' && bg.includes('url(')) {  
        const urlMatch \= bg.match(/url\\((?:\["'\]?)(.\*?)(?:\["'\]?)\\)/);  
        if (urlMatch && urlMatch\[1\] && \!urlMatch\[1\].startsWith('data:')) {  
          try {  
            const absoluteUrl \= new URL(urlMatch\[1\], document.baseURI).href;  
            const base64 \= await this.fetchResourceAsBase64(absoluteUrl);  
            const dataUri \= \`data:image/png;base64,${base64}\`;  
            el.style.backgroundImage \= \`url("${dataUri}")\`;  
          } catch {  
            continue;  
          }  
        }  
      }  
    }  
  }

  private async fetchResourceAsBase64(url: string): Promise\<string\> {  
    const response \= await fetch(url, { mode: 'cors', cache: 'force-cache' });  
    if (\!response.ok) {  
      throw new Error(\`Falha ao descarregar recurso: ${url}\`);  
    }  
    const blob \= await response.blob();  
    return new Promise((resolve, reject) \=\> {  
      const reader \= new FileReader();  
      reader.onloadend \= () \=\> {  
        const result \= reader.result as string;  
        const base64Index \= result.indexOf('base64,');  
        if (base64Index \!== \-1) {  
          resolve(result.substring(base64Index \+ 7));  
        } else {  
          reject(new Error('Formato Base64 inválido na conversão'));  
        }  
      };  
      reader.onerror \= reject;  
      reader.readAsDataURL(blob);  
    });  
  }  
}

## **Conclusões e Recomendações de Engenharia**

A conceção de um mecanismo de serialização em tempo real para exportação de documentos paginados altera a relação entre a lógica de apresentação e o motor de impressão. Ao tratar a subárvore ativa do DOM como um estado de composição efémero que deve ser compilado e materializado antes da sua transmissão ao Chromium headless, eliminam-se os desvios de layout inerentes a geradores desacoplados1.  
A sincronização imperativa de variáveis computadas através de APIs como computedStyleMap() e a materialização determinística de pseudo-elementos fornecem ao subsistema de renderização uma representação estática idêntica à do ecrã ativo10. Simultaneamente, a eliminação integral de pedidos de rede, suportada pela injeção direta de tipografias em WOFF2 e ativos gráficos codificados em Data URIs Base64, protege a fase de paginação contra atrasos de transporte ou bloqueios de segurança1.  
A gestão criteriosa da fragmentação de blocos no motor LayoutNG e a prevenção de sobrecarga na pilha de memória do V8 constituem fatores determinantes para a escalabilidade do sistema em ambientes de produção36. Documentos com elevada complexidade gráfica e densidade visual devem pautar-se por estruturas de layout resilientes à quebra paginada e pelo agrupamento eficiente de buffers textuais, garantindo uma transição determinística entre a interface reativa e a saída final em PDF33.

#### **Referências citadas**

> 1. Puppeteer Interview Questions and Answers \- GoodSpace AI, [https://goodspace.ai/interview-questions/puppeteer](https://goodspace.ai/interview-questions/puppeteer)  
> 2. html2canvas vs html-to-image vs dom-to-image \- npm-compare.com, [https://npm-compare.com/dom-to-image,html-to-image,html2canvas](https://npm-compare.com/dom-to-image,html-to-image,html2canvas)  
> 3. html2canvas vs html-to-image vs dom-to-image-more, [https://npm-compare.com/dom-to-image-more,html-to-image,html2canvas](https://npm-compare.com/dom-to-image-more,html-to-image,html2canvas)  
> 4. snapdom/CHANGELOG.md at main \- GitHub, [https://github.com/zumerlab/snapdom/blob/main/CHANGELOG.md](https://github.com/zumerlab/snapdom/blob/main/CHANGELOG.md)  
> 5. Figma QA and SDET Interview Questions (2026) | QAJobFit, [https://qajobfit.com/resources/figma-qa-sdet-interview-questions](https://qajobfit.com/resources/figma-qa-sdet-interview-questions)  
> 6. Canva QA and SDET Interview Questions (2026) | QAJobFit, [https://qajobfit.com/resources/canva-qa-sdet-interview-questions](https://qajobfit.com/resources/canva-qa-sdet-interview-questions)  
> 7. Using CSS custom properties (variables) \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading\_variables/Using\_custom\_properties](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Cascading_variables/Using_custom_properties)  
> 8. List CSS custom properties (CSS Variables) \- Stack Overflow, [https://stackoverflow.com/questions/45763121/list-css-custom-properties-css-variables](https://stackoverflow.com/questions/45763121/list-css-custom-properties-css-variables)  
> 9. How to Get All Custom Properties on a Page in JavaScript | CSS-Tricks, [https://css-tricks.com/how-to-get-all-custom-properties-on-a-page-in-javascript/](https://css-tricks.com/how-to-get-all-custom-properties-on-a-page-in-javascript/)  
> 10. Get all CSS variables on an HTML element with JavaScript when, [https://stackoverflow.com/questions/78226469/get-all-css-variables-on-an-html-element-with-javascript-when-you-dont-know-the](https://stackoverflow.com/questions/78226469/get-all-css-variables-on-an-html-element-with-javascript-when-you-dont-know-the)  
> 11. Element: computedStyleMap() method \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/Element/computedStyleMap](https://developer.mozilla.org/en-US/docs/Web/API/Element/computedStyleMap)  
> 12. Window: getComputedStyle() method \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle](https://developer.mozilla.org/en-US/docs/Web/API/Window/getComputedStyle)  
> 13. JavaScript Element computedStyleMap() Method | CodeToFun, [https://codetofun.com/js/element/methods/computed-style-map](https://codetofun.com/js/element/methods/computed-style-map)  
> 14. content/files/en-us/web/api/css\_typed\_om\_api/guide/index.md at main, [https://github.com/mdn/content/blob/main/files/en-us/web/api/css\_typed\_om\_api/guide/index.md?plain=1](https://github.com/mdn/content/blob/main/files/en-us/web/api/css_typed_om_api/guide/index.md?plain=1)  
> 15. CSS Typed OM Level 1 \- W3C, [https://www.w3.org/TR/css-typed-om-1/](https://www.w3.org/TR/css-typed-om-1/)  
> 16. CSSStyleSheet \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet)  
> 17. CSS in Javascript: The future of component based styling \- Reddit, [https://www.reddit.com/r/webdev/comments/67gs71/css\_in\_javascript\_the\_future\_of\_component\_based/](https://www.reddit.com/r/webdev/comments/67gs71/css_in_javascript_the_future_of_component_based/)  
> 18. ::after Pseudo Element \- CSS Portal, [https://www.cssportal.com/css-pseudo-class/after.php](https://www.cssportal.com/css-pseudo-class/after.php)  
> 19. Generate static css \+ html files using TypeStyle | egghead.io, [https://egghead.io/lessons/css-generate-static-css-html-files-using-typestyle](https://egghead.io/lessons/css-generate-static-css-html-files-using-typestyle)  
> 20. ShadowRoot: adoptedStyleSheets property \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/adoptedStyleSheets](https://developer.mozilla.org/en-US/docs/Web/API/ShadowRoot/adoptedStyleSheets)  
> 21. Constructable Stylesheets and adoptedStyleSheets: One Parse, [https://blog.master.dev/constructable-stylesheets-and-adoptedstylesheets-one-parse-every-shadow-root/](https://blog.master.dev/constructable-stylesheets-and-adoptedstylesheets-one-parse-every-shadow-root/)  
> 22. CSSStyleSheet() constructor \- Web APIs \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet](https://developer.mozilla.org/en-US/docs/Web/API/CSSStyleSheet/CSSStyleSheet)  
> 23. ShadowRoot: getHTML() method \- Web APIs | MDN, [https://monge.univ-eiffel.fr/\~forax/MDN/en-US/docs/Web/API/ShadowRoot/getHTML.html](https://monge.univ-eiffel.fr/~forax/MDN/en-US/docs/Web/API/ShadowRoot/getHTML.html)  
> 24. declarative-shadow-dom/README.md at master \- GitHub, [https://github.com/mfreed7/declarative-shadow-dom/blob/master/README.md](https://github.com/mfreed7/declarative-shadow-dom/blob/master/README.md)  
> 25. Wait for fonts to load before rendering web page \- Stack Overflow, [https://stackoverflow.com/questions/4712242/wait-for-fonts-to-load-before-rendering-web-page](https://stackoverflow.com/questions/4712242/wait-for-fonts-to-load-before-rendering-web-page)  
> 26. Drawing text to with @font-face does not work at the first, [https://stackoverflow.com/questions/2756575/drawing-text-to-canvas-with-font-face-does-not-work-at-the-first-time](https://stackoverflow.com/questions/2756575/drawing-text-to-canvas-with-font-face-does-not-work-at-the-first-time)  
> 27. Dom Tree | Dashboard | CheckPhish Platform, [https://checkphish.bolster.ai/dom/1747999515424/5c9844c68baba618477db5ed0616209560d06fcea57057193a5732db5c8aa802](https://checkphish.bolster.ai/dom/1747999515424/5c9844c68baba618477db5ed0616209560d06fcea57057193a5732db5c8aa802)  
> 28. serp-parser/test/google/desktop/\_com-domains.html at master \- GitHub, [https://github.com/zlurad/serp-parser/blob/master/test/google/desktop/\_com-domains.html](https://github.com/zlurad/serp-parser/blob/master/test/google/desktop/_com-domains.html)  
> 29. Releases — Zigmoon Apps Changelog & Version History, [https://app.zigmoon.com/release.html](https://app.zigmoon.com/release.html)  
> 30. Markdown Text Styling and Formatting: Complete Guide for, [https://blog.markdowntools.com/posts/markdown-text-styling-formatting-complete-guide](https://blog.markdowntools.com/posts/markdown-text-styling-formatting-complete-guide)  
> 31. Is it possible to dynamically change font to a custom typeface with, [https://stackoverflow.com/questions/62349536/is-it-possible-to-dynamically-change-font-to-a-custom-typeface-with-javascript](https://stackoverflow.com/questions/62349536/is-it-possible-to-dynamically-change-font-to-a-custom-typeface-with-javascript)  
> 32. I observed ChatGPT Web's DOM, communications, and API, [https://dev.classmethod.jp/en/articles/codex-app-cdp-chatgpt/](https://dev.classmethod.jp/en/articles/codex-app-cdp-chatgpt/)  
> 33. webFrameMain \- Electron, [https://electronjs.org/docs/latest/api/web-frame-main](https://electronjs.org/docs/latest/api/web-frame-main)  
> 34. puppeteer's setContent function not making network requests for, [https://stackoverflow.com/questions/57364320/puppeteers-setcontent-function-not-making-network-requests-for-static-files](https://stackoverflow.com/questions/57364320/puppeteers-setcontent-function-not-making-network-requests-for-static-files)  
> 35. html-to-image \- UNPKG, [https://app.unpkg.com/html-to-image@1.11.13/files/src/util.ts](https://app.unpkg.com/html-to-image@1.11.13/files/src/util.ts)  
> 36. Connect Puppeteer or Playwright \- Obscura Docs, [https://docs.obscura.sh/quickstart/connect-puppeteer-or-playwright](https://docs.obscura.sh/quickstart/connect-puppeteer-or-playwright)  
> 37. @rizkyandriawan/foliojs | Yarn, [https://classic.yarnpkg.com/en/package/@rizkyandriawan/foliojs](https://classic.yarnpkg.com/en/package/@rizkyandriawan/foliojs)  
> 38. HTML to PDF: Background Colors and Images Missing? Here's the Fix, [https://www.useanvil.com/ask-anvil/pdfs/pdf-background-colors-images-missing-html-css/](https://www.useanvil.com/ask-anvil/pdfs/pdf-background-colors-images-missing-html-css/)  
> 39. Background color not showing in print preview \- Stack Overflow, [https://stackoverflow.com/questions/14987496/background-color-not-showing-in-print-preview](https://stackoverflow.com/questions/14987496/background-color-not-showing-in-print-preview)  
> 40. print-color-adjust CSS property \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/print-color-adjust](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/print-color-adjust)  
> 41. Controlling the Settings in Chrome's Print Dialogue With CSS, [https://excessivelyadequate.com/posts/print.html](https://excessivelyadequate.com/posts/print.html)  
> 42. Background color on header / footer in Headless Chrome \- API2PDF, [https://www.api2pdf.com/background-color-on-header-footer-in-headless-chrome](https://www.api2pdf.com/background-color-on-header-footer-in-headless-chrome)  
> 43. Closer to the Metal: Leaving Playwright for CDP \- Browser Use, [https://browser-use.com/posts/playwright-to-cdp](https://browser-use.com/posts/playwright-to-cdp)  
> 44. mediawiki-services-chromium-render \- GitHub, [https://github.com/wikimedia/mediawiki-services-chromium-render](https://github.com/wikimedia/mediawiki-services-chromium-render)  
> 45. Enhance print-to-pdf in headless mode to support all Page, [https://groups.google.com/a/chromium.org/g/chromium-dev/c/LXZQz6UpVZI](https://groups.google.com/a/chromium.org/g/chromium-dev/c/LXZQz6UpVZI)  
> 46. I'm not able to print page with Selenium WebDriver Chrome, [https://stackoverflow.com/questions/76112313/im-not-able-to-print-page-with-selenium-webdriver-chrome](https://stackoverflow.com/questions/76112313/im-not-able-to-print-page-with-selenium-webdriver-chrome)  
> 47. Chrome headless PDF printing does not honour @page { size } for, [https://issues.chromium.org/41320352](https://issues.chromium.org/41320352)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAAAXCAYAAABH92JbAAACyklEQVR4Xu2YS6hNURjHP3nkFXmUhDwyEUVhoJRHXmVAMiDmDEQxkNkxMFCiUAoTSQykFJIM7lBMTFAeAyUGkgkKefx/1lqdby/7nLNLN6vb+dWvu1trnf341re+vfY169OnVIbLSXJY3jEUmSKXxOORcpncKudY5wAw7pjclncMNciE/fKxXCr3yS/yl/OchYDkHJInrT6Ia+R7a5/jrhzj+ifIe64fb8hxbkwRcEOXo5PlCXk/HvPgG+VH+VNuir9JLJSP5Nys3cM5zstv8qtcUe3+A1l43aoBLAYygwcgKBPlXvlGzveDRMvCLF90bTz82WhdFiWoVZfkAQvnqBt/UO7K2orBB4Vs4LjlB0RWyu/ythwd22bI53JdGtSBxfKUnC6fWbiGz7wR8kIcVxyz5At53MLM7rQw42RUDnXqs4UlwUMBwXklZ6ZBHSBD9sTjloVsouYlplq4LhlXHNw42UGW9CIF6bRrOywH5HjXVgdFnd/DIgv17YG1J4Prn4nHRUHmXLGQ+r0yASisZMAO18bs+8yqI9UjsgUYe9WqLwEmq8h6xOwPyNcWakU3UoGmnkxz7Tw8diPVI1+oCQ5BIli8zZrWI14y3AdZ2GRi/5kUpHdyXrXrLyjqZBz7IU+TIPl6lGCZ8aAsu7XWvB4xQdTAH3J1tWtwYG/Ea79u7+PJtwieXkEie6g1y/MOsdvC8n1q4cXRFCaMrPOZOai0LNxoXQCAXfgR+dDq05tPEX7baXec1yMPWcHy5fpF1qMEs/LWwo3etPbehVmij6J8zcLOuw6W0ROrDwKwlPjEGJt3RFryg1yQtRfHKvnSqt9OyCxvsZBNneC1zj4rf0j2T5+sfS4+RTZXRgTYDvAt16Qe/XfS1/52ucHCfwKakApw0culBCjAd6zQD9NSYCtxS67PO/pUmW2h8PO3Txco3kflqLyjzxDmN3iNh8R8ITZzAAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAXCAYAAAB0zH1SAAADBUlEQVR4Xu2WS8iNQRjHH7nkFrmUhFyyEUW5lFIit1JIFsRWLESxEKsjWShRKEJJEguprw9JFlYSGxuUy0KJhWSDQuH/e2fmnDlj3vecOu/mK7/613tm5sw87zP/Z+Y1+8/AZ7A0ThqUdvTAWGlo2ljGBGmBf+ZPi6RN0gwrD4pxx6TNaUePLJGumXuBUsjYXumZtFDaI32X/kQ6Z/kMHJBOWv7FVkifrDXHPWlE1D9Guh/1o1vSKN+/Qzpv+XWLQVe9xksnpAf+mWDWSl+k39I6/5/AXOmpNDNpj2GOC9JP6Ye0tL27gN26ae0vBfzut8xu8iZMSqBsyW7pvTQ7HiQa5rJxKWojoLNeuWwH8P4VaZ+5OXLj90vbk7bAVumRJZaJAyVrPDfiAZ5l0i/pjjTct02RXkmrwqAS5kunpMnSS3NrxDs0RLrox+WYJb0xF0PBNOm1dNxcBraZy0yuGPD9N3PbyUJAwG+lqWFQCWRyl39umMs6NRSYaG5ddiYHVsYRh0MDk5HF5ptUEAI/HbUdlB5Ko6O2HBQu/4d55urlsbUSxPpn/HMZvBgnTJFhHti2ThkDioNM4bcAk8U7kCP4m6wCY69be6GTwDJ/B0KSiizx8M6c96oIRYg/J0XtBISqCP6Oi5GACZwX4NSo8neAwDm9moF/NGf+KihcdobzOqabwGN/B7AIVsEyK63a3wECp56ahs+dzTHpcRnTKXCyjHcXpx3mLhas98Lc4dCJplWgYe7PuaCA2/SQ9MTydcA1z3/DLZeS+jsGy2E91u/kbwhrFWCBD+b+3Gets5VM0Ufh3TB3g+bAAs8tHxhgA67vkWmHpyF9luYk7SnEw0ESn2i23NzhHn8rILKx0VzWy+CI4x5IF+Z8/2qtubjm17eNcHA08u3Syd/0s+sb0o7wFbhFWmPuC7EbQpF1s9W9wLcNiQyOqAWK7K79+3FUF9jkqFd8pPYMx+ptaXXaURPUGkU5Pe2oAyaluOueHAtftswnbZ1QoEekYWlHD+y06jtm4PAXoAKZNkWCDtYAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEQAAAAXCAYAAACyCenrAAACvklEQVR4Xu2XS6hNURjH//KIiLySkEcmYqAoKXEHXiOEQswMSDLwSGRwDCQlCaVkIikDkjxG0s1ITBhIeRQlhrc7YCKP/79vrfY631ln3zO55+7L/tWve1prn7Pv/ta3vm9toKam24ykk+kIPzHcmUqXhs+j6XK6hc5D+4fVdWfoVj/hmEB76Ho6KYzpftPjBVVCK3yIvqLL6EH6g/5JvAp7eM8RegHlATtFP8LucYC+pOfpM7qouLQajKc3g1Ng/+iT8FkPuYH20d90Y/hOZDHs4ea78cgoWCBvw+4TUWa8oL2wzKkMWr1rsAAojffTL3RhehFpwLLkejKmYF0JtsuOlfQzXeInyEl6yQ8ONWkAtMr63EgvCKyiP+kjOjaMzaLv6Np4UQbVFv3mbD9BjtFNfnAomUPf03OwFd5Fb6AoeCmqK9/pHdg2EAqE6kLuYSP6PWXWCVidStEiaFtWhn2wVdfqD0QMSJrixzFwDdiJoij/ok/pXjoxvagKKCNuoX06e9RS9VB6wIhWP82YHKpRZ2HBSDvWa3R2366hVe2FFbyZzVMtxOL5ls5IxhUQ2QnaLmqv2p79sKAoQ8vQGSi26kEnBuQbXdA81YL2ujJJ542UsoAoAPpervuodauFa8uVcRgWuHsoCvmgoTOBWm3ubJHi23JKWUAU5MvIb6dYj3b7Ccc4uhpdrDcN2ArkHlZoldUddIDK7Xe1VH03PXBF1E4fIL+ye2DtWl2uUiilv8KCch/FaVNprjkVTJ0w27VG1YA3dJqfgAVLWbDCjet3VVC3ufHKsIZ+QHMHkCqgm9F6dkhR6usc499FVJ/u0qOwgOmzWu1F+onuQL62VIb4Vrsd9iaq94xO0DZ7jtZaoL2vTBDpb/cgv4X+KVQPHsOCUAPbHg/pOj/xPzMXVpT1tyagwnqajvETNcOQv4svgAKKvEnOAAAAAElFTkSuQmCC>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAWCAYAAADwza0nAAAAsElEQVR4XmNgGAUEgSMQnwDiCCBmRZMjCDiBOAmILwBxMhBzo0oTBiAbQTafAeIaIOZDlSYMmIHYCYgPA3E3EAujShMGjEBsDsT7gXgKEEuiShMG7EBcB8RPgFgFTQ4rQA60fAYiAg2kAKTwHAOR0QQKRVBoguLVnwESSHgByNMgz4MCwYqBCA0g4APEG4FYjwESioMYgEJMnAHiT0JYjAHJ/wZAPItI3MtARuqhHAAAUy8ZXUJCyYEAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,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>

[image8]: <data:image/png;base64,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>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGEAAAAZCAYAAAAhd0APAAAERElEQVR4Xu2YXahVRRTH/6KC0oeGDykVWAiiBAmlIqiIhB+EIhp+1EspVlQkFSSK0QnxIRHB8EGkF4msUKQefKh8uFBgHw9SRA9WpKKFPhSIBSal69fac8/sufvrHL2JsH/w59wzM3fOrFlrzZq9pZaWlpaWlv+PkabVpslJe2CS6XXTftObpin57kqmmnbK//cJ09h89xCeM10yXc30pWlcbkSeF9Ud+4/pQ9Ms08moPfSdlc/N31+Y5ptG6CbCZiwz7TGdM/1pejg3wsGgz0zzTA+ZjsqNelX1Bqwy/WCaYbrdtF0+V9WmBjabfjZdMc1N+gLM85Hpsum0PFhiZpr+Mh1I2rH9Hbkdr6nejmGDhSw1LTC9oWInMAYj18uzBSaYvlbx+Jj7TD+anoza7jJ9I4/eOnDCNtMfpr0q3qg58jE4oMgJrI91pk6AB0y/ybPj/qSvFiKKjShaVMyYtKECDC7aVIzCuIvyLAhslUfRK1FbCpufzsma3zMNyO2ogjVxRJJ5p0z35Hodgmex+nNCsC1dYyWk3gfqnnEXTOvUjdCYO0wvpI0VlDlhtPy4+kR5AxnPGvgs420Vz8mGEIFEYhXMzXG51vRv9hlzt6kjz7h+nMDxyjH2qeoD4j+IoLdMG+UbA6TQEXnhmp61BTiLidamlDmhiFGmw/LitiDflQPDi+Ysa08JTiADTskzIs7uNZlCRFc54VDWF7REPif7NzEMroOz9GUNPYL4vlB+9p6Q30AG5I65tzusll6cMFs+lt8KAZFCZA2oeM5enYCN1ARqw4NZH4HQkWdDEyf8Il9vEE75Ts1ua4MwcHLaGMFm4Ayin8+yzSmjqRM4Eo+Z3jXdlvTF0Me4ojl7dQJwO+KW1Mm+4wzqATRxAr+Zwq0Px36lof9XySPyukCkbzLdme8ehLR9LG2soIkTcOw+0241i56yzS5rT4mdgPOxOTwzPC2/GUG/TgDqFrWtk7SXslz+APKSvEgx8XkVF2eK1Y2sCcEBW9T9rWmmRYMjhrJDxXOybq6Fdcdl7ATgWhsK9C51i+n1OIHfwAll/TlIb546JyTtGPKx/N5OtWcRfH6efTalygkj5A9maU161rQy+j4+U4CgoXg/GrWRoUcz1V2hUydwBHF8/GTaELX36wTqyvvqIRMoQM+kjRlEJkfPcXmkfC+vC/GG1YHBPFnOTNqZ4yl5H9F7JtLv6j7J8mqCrIwffAgYgqOTfYcp8jHpdTMFm4h2NjvYETYtvd724wTmZ26C5FvVZ+WwQXZRX9jM+B3Lr/JzH4KBcX9QvBkYgTEEQRy91DBuJrwaeFz+tMxVu+ri8Lx8c8Lv/K1uNpFdB+UOCeunP4zlvRBtFF2CMZ2H4ME+vpNVrKWsrt6y8BzDq5AYNovasUJeq1qGEaKTIyQcRy03AZ5CSe9ealHLDYQs4GVbk1fULS0tLS0ttzTXAChvFpJApMPiAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGEAAAAZCAYAAAAhd0APAAAEUUlEQVR4Xu2YW6hVRRzGP6mg6I5iiQkWQRRBQRoEJdHFjCii++UpIosSxRe7QgfEhySEsl6ilx66EUQ9+FI9HCjo9tCFNEhDjSwqUpAKSrp8v/5rzp49Z1322WmnYH3wcc7+z6xZM/P9LzNL6tGjR48ePf49HGbeZC4u7DmOMm8znzE3mKcMNzfiDHOj4jmeZ5w23GP+ZP5Z8T3z+KEew1ilQd/fzZfN880vMntq+1oxNv+/Yy4z52gWwWZcbT5h7jF/Ns8b6jHAmebH5oOKzb/R/MCcn3eqwfXmNvNc8xhzvfmm2jc14X7zS/OAeWHRlsA4r5m/mrvNBcPNWmr+Yj5X2Fn7swpx1mkWhWAiV5oXm4+qWQQ2+jOFAEz2aPMtNfdPWGRuN2/PbCeaHyq8twuI8Ii5z3xK9Rt1gaIPAtSJwPyYZykCOM38VhEdpxZtncCj5qp+UjmOLA0tYMFNm0rbj4poSLjUfEDtqYXNL8dkzs+bk4p1tIH3kiK3mLvMhUOtAZznCo0nAn15ppxjKwi9lzTIcd+btyryeYljzftKYwuaROCd5GS8F+EhkVH3zhJPqn5MNgQPxBPbwJxIl7eYf1R/c5xkTigibhwRLlKksTfU7RB/Aw96zLzLPKKyEUKvKjbprMqWQC5+qLC1oUkEvJ8o4B1Pmw+bm82tijzfBhZeN2aTvUQSgQjYpYiIPLpvrpg8uk2EV6q2xBWKMdm/k1PnLpBL12p6CuL3JYrc+5HiBDKp2LRRTy+gSYS0CDzxusqWHOJzNb8Dz5pU/ZgzFYH3UROoDWdXbYcrooBoGEWEnYq9SUSUTzXaaW0KdFxcGjMQHYiB9/M3Rcuo6BIBz5+X2dkcUuLdmS1HW/GeqQiA0xGnpInqN2JQD8AoIvDOEhxjEfZ9TX+uFUsUdQFPX2MeN9w8BcL2qtLYgiYRzjH3a3ohTSLULS6habOb7CVyEVJtSneGOxQnIzCuCIC6xTomCnsjrlFcQFYrihQDf6f64kyxOhg1gXDnrD6pmYvAha5uTJ7hWNiUyhJyEQDH2lSgH9dgPv9EBN7RtY4pEN7cOucWdhbyuuLiRLVnEvx9u/o7KppEIPe+qDgdUZcS6tLRCRUTcBpuppdlNiJ0S8WuI3QpAimI9LHDvDOzjytCWtvIkYBHriyNFYgCUs+7Ck/hYkVdmJN36gAL5ma5tGwwLjd/0EAgxi0LM58miMr84oPD4BwT1W9wuqJPedwswZrwdjY7rSNtWnm8HUcExmdsnOQTdUflIQPRRX3Zq+FvLN+Ym7J+FHlupZwwcITNio2kPiWwCBaDE+TeSx+e49PADYqIQsC2g8O9is1J8/lNg2giul5QCJLmT3vqy3chbBRdnLEc5yvF+vhNVDGXprr6nwR15lpzuWID6sA9hk8hOejLMzzLGD0OIfBOUkhKRz1mAdxCCe+Z1KIeBxFEAR/bRvlE3aNHjx49evyv8Re1yRoaqkDcJgAAAABJRU5ErkJggg==>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGEAAAAZCAYAAAAhd0APAAAEoElEQVR4Xu2YbcieYxjH/8sUeW/CQkaTSKht1gpJ8pJI3mb44CUsW9aoaWtySxJJkbzli+QtEh/2AfvwNKthH9a09mFoIxFCyRTycvw6ruO5zuu8r5f7uefZSte//l3PfZ7nc17n8X6cl9SjR48ePXpMP2YYFxqfMj5jvNZ4UGWFY7bxfuMLxgeNc6vTrTjF+Jj8f28wHlidHsJS46/Gfwp+ZDyssqKK5SrX/mV8w3i2cUcyHnNfy/fm743G8+Q62GeYaXzS+LDxOOPJxg3GbcYTknUI9IHxXOOZxnVyoe5VtwBXG7cbzzIebHxIvlebUgP3Gb8w/mk8J5sLsM87xt+NX8qdJcUC42/Gl7JxHOFFuRyr1C3HtOFU44/G9+UKAjfKD0ZkAA6LkLca9yvGZhk/Me42zivG6nC88TP5noEjjJvl3tsFjLDW+LPxadUrapF8DQaoMwLn45y5EcBJxm/l0XFiNtcJFIYi6g6V4oB8IANp4jvjVvl+4Cq5EfASgFAI94s8CgJr5OvuScZyoPzcUJz5FeOESsM3ASNcJ4+8XcZjK7OOB4wXazwjhGz5GVtB6L2uMsd9b1yi0kNTHGJclg/W4HCVykBBeNzfcmOA/eUp6z1VBURBnIFnE4imOgFRCB6IJ7aBvS83Xi8/E88URxsH8ogbxwikV9JYmglagYIeNd4uVwwghN6WF67TirEAuRhvHRXsj0f9ZHxc5TvqQC15S17czq9OVYDgTUaoG88RRiACdskjIo3uxQXDo9uM8GYxF7xEvif6OyYWd4FculLDKYjfF8hz7xZ5BzIhNwzFdhRcaPxKHlnPG4+sTg+BbgrBeFeTsfCsCdUre6pGiAilNpxezOEIA3k0jGKEnfLzBjHKpxqtW5sEC+fkgwlQBsbA+3k2KacNpLVH5MJimDqQEtcbX1Z9KxtgjnV1yp6qEQDdEV3SoPiNMagHYBQj8M4cdH3I+rGG/68V8+V1AU9fYTy0Oj0JwvayfHAELJC3dLSpR2VzGPY54xMazXualN00niM1AsZH5rgz3CLvjMC4RgDULWrbIBtvxBXyC8jd8iLFxnQ3SzRcnClWXTXhDPkheAZCoFxJYYDVKt9Fi3vR5IphcP/I9wGcm7awK12mRgC0tVGgqVtRTPfECNFgNM1XQHhz65yVjSPIu/K+nWrPIXh+WDzbwIvzA8ShuT+gZDBDfjHLa9KdKrsoQKcFAzgNxTtNbUTouoJdLXRuBFIQ6eNz423J+LhGoK68pilEAgXojnywAJ5J6tkk9xRSCXUhVVgdEPIHeacQuEl+qGflh2SPm+UpCu+lgAfppOImG3eO9OKDw+Acg+I3mCtfk7ebOZAJb0fZIUcoLW9vxzEC+7M3TsI9qSsqpw3kVoSigHIgvJ3vKtSc+KwQAsbdJGWqDIRAGJwg9V5qGJ0Jnwaukd+WabXbGoe75MqJ9/yhMpqIrlflBiE7cFbmY22cn6KLM+b74DzfFL+JKs7SVFf3GvCyOcYrC1JL9gTcYy7NxlAWteO/2L9HB/BOUkikox77ANQWwrurFvWYJhAFfGyLWtKjR48ePXr8b/EvoBwjEKI3zrsAAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAAAZCAYAAAC1ken9AAAEOElEQVR4Xu2Ya6hnUxjGH6HIPZNLkUMkyowalxSS5JJINOUYNaKZKcrEKaIUHySSIrmlJIkiUXzAfDgu5fZBhA+kc0iEUEI5cnl+3r3OXnvty/9/jExpP/W0z3+ttdd617Pe9b7vPtKIESNGjPg/YgfzRPMe8z5znblbY0TgQPMm8yHzFvPwZvffKOc619yxMaKNu8wl88+MH5nHVP3YsrXov7rq/7ho/938wvyp+vt181SFXdsFO5l3m7eaB5lHmK+aH5iHZONOMF82TzHXmC8oNjSn2nie15mvmIea+5qPKw5k52pMH3iXsb+ZJxd94Hhz0TxH7QOj7xfz0aJ9V/NhhZ3YtV1EPsr8znzJ3L1qW68wCi8EGPqsebnqzSHe2+bP5tqqjefXagp0mPmZeXbW1gcEyudL4KA53OOK9gTG814pMGD9rxRezaFPDcRgk5NOZZeyocCRClHeU8wHLlQIzOkDQgMi/ajw3oQbFeOurX5zCxjH+IQ9zNfMRzTZ1i6BEfd589isrcSQwMn2ct5e7GU+qTrmfGPOqn1tAJu7qmzswN6qvRcR7jX/UAgNuN6EkRfVFO96hQ08OUjCRikw886b75j7ZO1dKAVGXNYcEhcMCUxI+1XNG9oLNn+7uVF1TMPtnzHfNI+u2hIuUnjZtGD+s8zvzTs1HDeJ3U8rEslpqoXsE7hs70IuMAmUBEY+wKmGkAR+SrFGImFpUaHPAWnwEPCAa9S+avw+3fzEfFeRVOYVopO4psEZ5ueKG/GguarZ3QKVAptKCSxdxVLIlQqcbgSeC/l9g9p7zpEEXlDYk4jg75uXKPLIRDBopmzMwEYRGq/lOeSBfSDU3Gb+oBC9C3gUZdNjqsu5/c1P1RbynwicKhiIF2MLVUwfhkIE7/H+W5q8/jLIpsRhPHSLuWezexnERerQlSKVPWx0v6KPQ3tAUbvmXtEnZF97FxCIdVk/gTBHGOJA+0LFkMCAaoiDu7lo78T5ilOl0L5YMSlVwKzaie5gTY7BqxUG8ExI173MvElcrmxaizLvTNUxuRQyCUwlQdIdAnvpWpMKBIH6atlJAqdk3Ne/DK7jHarLqQTi7HOKupSsyQZ5simeQ0jXMl88GUx9jICAjc2pnQM2q6422Ej+DiCWf6i6ph5Cl8BgRhF++kLFkMAc/BOa0oOJc5vKxgp4FOHgDUWJxfUmDnedeA5E+VbND4FLFQbdrzCQOS5TXF8KdpJhIhVH+rAg89PPzUrggEmcJ2VtXWANvuRYl6+1ElRO9HWFij6B0eQKRYihzp824f+rwFhOGMMxBi/lO54YnzaSQgYbLMlXEl9LCXjzgsIRNij+p3Clhg+aeM5B5fPm/4sgBCFS3k+FgDfjSHnfkuLgv6x+4/WUtn156j8Bm58xL6hI7N4WEMLOq1iGsxEjRowYMWLEiBEjVoK/AGEDDlWD6/iXAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAAAZCAYAAAC1ken9AAAD5ElEQVR4Xu2YW6hOQRTHl1DklksuRT7y4JLINYUk5BKJFJ5ELqWIU0QpHhRC8SSUJFEuUZRbEsolJZIHkksiCiWUI5f1+2bPt2fPt/fs7zzIwf7Vv+/stfbeM7NmzZrZR6SgoKCg4H9gpmqbb1S6qTao9qo2qfok3WX/CdXU6G9freNbE+xU1at+OnqoGhj5W6kuef4Vkf+RZ/+ueqn6FP19XTVW1UQaCSXVE9VBzz5CdVE1RjVIdVbMgOok7vxQ1efInqal0X1p8I7Dqm+q0Z4PhqueqaaomiZdZd8Xqe5zS9V+MW2vkUYQ5OYSd8jtLB09pVoo8eA6qm6LCSiBhemqO2Iy3NUVMRnYLrovC9p032fpKWZyh3l2i51YP8DQW/VaTFb38nxBWG4MMm9WWviGAHNUO8R0xu0sy/u56qOY7LWsFzMZq6PrVaoJsbsMQT2mGuDZ00gLMME9oxrs2HxCAbZ999+bCR0+KvGye6uaJ9XLBtqolvvGDEpisq2vmA65nSWzd6nOi+mwZa2YPvALQ1QdYnd58reqZju2EH6ACS5thoILoQBT0r6qLkj2HlDBdnixmEEDaX9SdVPVP7JZGBhZlgfv2q4aKfGMp3XWpZnquJiNZFzSVWGGao/Efc3DDTAbKBvYVckvLTbArBR3U50spm4Tn6725hDtxSxDAu3C9XjVY9VdieseQe8e35YJE8Ey5z21BpjJYFC0lRZAytdl1SjfEYA27YogcxHX66R6zC42wE8lWfsJ+H3VfDH7SC7cVPKNDgyUQJO1/KYN3IdluE/iLKklwNzLpnVIzBEqjbmqB6pOviOADTDP0S9EFn8Qc4rJIlQieI7nb0myvAVhN6UOk6ErVW2T7gpscNN8owPLfIuYbLTkBZhJY9lzds3KCuznxJQQ2qgV2uS4xbHLwuqiDIVOIaEAw24xE7fRs6dCXWNWOWiTJbz0jaRvdD0kXIM7q66pXjh6JaYz9dH1ssrdcXBZsratfqpJlTti2zvJHnAW3O/v9rR5QMJn2bwA2804y1+B5cgXFvXNhTp7Wsy5lF2TLOSX4PHbELIymIHVSfUewMfDLOca+BhgQJs9ex5pAYaSmI+frFIRCjAr6IjUmMFdVEt8YwQZRTm4ofohpo5Rh9NmPASTxTmYryr7LL8LxCxffG7Gv5fqLy+C7h7faoE2aJPnmCAfTk740kpFVoCJySIxJeae1Lbh/zZYHdR1SgMDQQSPEmGz2tpd8ZXE15ILJ5KGBJh6Tlvue93/RVCCCJLr54RANpNIrs+WNlvqyHqOtln71F8JkzVR/rFBFRQUFBQUFBQU/BF+AXQ8/saAbGeJAAAAAElFTkSuQmCC>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAAAZCAYAAAC1ken9AAAEL0lEQVR4Xu2YW6hVVRSGh6iQmEoIXiDpGJkoiIIeQ+kCoqJIvlSgJiKIIiheoUgETw8+pNVD9RAiiIEXFBKhh9IQsdBMwZJuZGGKKCrmSwoeSf0/xpruuedea+3j7tABWT/8rL3mnGvNMf85xphjbbMKFSpUqPC4YrS4RdwmLhT713dbm7hAfFrsLT4hjheXZb/z0EtcIy5POxJ8KHaK9yP+Io7L+rHl66R/Vdb/e9L+r3hJ/Cf7/a34srktPYbXxH3iGHMBMf6U+Ew0Zqp4x+oXc0ucE41J8YL5mLfTjhwgwC7xrvhi0gfaxb/E2eYbHIO+2+LOpL2fuN3c1resh0QeKn5pLmwAhnwidkRtE8296jfxB/FdcXjUn2KQeMR8cV0RGCAQG8JcMdjow+KkpD2A8TyXCgyeFa+Ye/XIpK8UT4qDrfmuFIVvAMYh2qikHVHY/QDGfRzdlwGb1olbreseDPIERtwvxAlRW4oygXGCC9b43kLgGXutFqbXxPnWGDZggLgibUwQdvgP8ZWsjTkOiXPDIHs0gUkN74tT7L8JjLhfWbm4oEzgl8xTG+vBKUuBZ7wnLhX7Zm24/efid+LYrC2A3LohaUvBO8lPYcN2iAfF9VlfAIs4IH5mvhkXxU3meS4Gm8NB2Wa1hbci8HPmB9gx83eWIcyz39xjA2eZ5230GRYGl+Epca01pgXup4nnxDPmCzxqLnqcW4uA92+2msjXxRnWKPBJ84WDweL35nOFzWY89r2R3bcicMjZeC7k/h1rXHOMMM95c3sCEfysefWTOkIuGNSWNkZgoQiN13INCy8Dhq80DyEqBbyXRVHiLIrG8a60dGMewo9UACaLH1ht3lYF/sk8PUC8+Kb5u4tQliJ4judxjrJDuQ6cpuRhPHS1OLC++yE44MrKKICnsqAR2T3ezI5j8K/mVUYREA5BONDIb59avQO0IjDlVnvURppjs6mDi1JFmcDgI3M7O5L2XHDwsKvUqvPMX3rV8g86RGuWg6kUMCAF+etvc+NJB9TFbMSQaEwQmCtFP+FIbg7kAKafop/76f5YIeIcHEA0cC7wnqJatpnAwc6i/ocgRPnaYsExyLOENjmRU5NQ4PpNdi0Dk5J/U/DO0+YfH6HUSQVm8zA8rjZitOLBqcCgTfzTilNFmcB9xD3WRQ8mXPk0zQPeSzo4Id4zF4M8nLfjMRDnZ6sPbZ5ZLO42NxAS/pRfAYQrJ3xZ6BLqhHyzKALMyZccQvC1loLKib68+YoERpMl5inmR+vagd/twAhC74a4UXzT/PTlBI9LGw4cIoKPB4ymWjlu+Ubj5fSxMESBpIuiFMF/EaSjMBbG/0XMtPp3QWzEm3GkuK/TPB1dzu7xekrbonPqfwNp51XxdfF5y/d88iF/nDCG1JHm/AoVKlSoUKFChQoVuhsPANWKBkYmBOKOAAAAAElFTkSuQmCC>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAAAZCAYAAAC1ken9AAAEKklEQVR4Xu2YS8hVVRTH/5JC4aNCscLCz2xiIAr2QEkHEaGIDtSBRtBAcqCg1EDRSTVooEEDhQgRREEKDUXIgY+BL8wSeqERmvhAEgV1koKGj/VjnfV9+9v3PO4XgiHnB3/uvfvse87e/7322uteqaWlpaXlceQJ02zTV4UWmJ7q10PqMb1nelHe/0nTJNOS4n0wyPSmab38XtyX/nV8abpjup/oD9PE4vpQ04Hs+vLi+ums/a7pkumf4v1R0wz5uB4JQ0wbTJ+Yxps+NN00nTSNTfpNM91W/8nQDwMDJrHSdMg0zjTStM20Uf6cOvguff81vZVdg9dN502z1LlgXLtl2pK1EySb5GNlXI/E5Jny6BiTtL0vHxSDG1y0TZFH1Z+mX02fmV4orgX0uaL+Br1suiB/ThMYxKJxnxQWer/ptaw9oD/fyw0Gnn9ZHtUsetcMk0dI06qk27eMVeozMyANMKCzpueKNiZBpNfxudzM1PjhpiOmzWoea5nBmPu9aXLSllNnMGNhTPl9K3na9K36tulV0yJ1bhtgcsvyxgyigogklwYxqNSsJoNZyD3qNJhAOGg6YXo2aS8jNxhz96reXKgzeLo8te2Tj6UWImCtPE9GTiPsd5qOm14t2oL5pjVZWzewxcmFu9S3A5gEn7ea/jJdlOftOAzDyCqD8/YyUoNfkR9gh+VBVUcYvEP+jBBp6bzcn+ejcx1EwEfq3Gp8ftt0xvSL/FA5KDed7T4QWDi28w3TG0k7k/hRPnEgPf2kvgOsLOphoAazK0lbRC7i82p1zjklDD4nH08Iw3+XVz95VVQKnXryxgQmitFELa9NJ3cZRD2HwjtZO/eiXErhOWy/qfJcTc7OjfwvBkcFg4jifLFz6lIE3+P7BEfT83shb5KHidAVphH9L/fC9k7LqCYYzM/ysqcb4oD8WNVGVrWXgUGUW+nzWXDqWSqdqlRRZzBQkzPOT7P2UubKV5VCe6H8ppRGi9R50L2k7nMw5lKURwqgPKNce0aeDjikiKzRxXUIg3ml/3fqNDIMppLg0K2DueSnfaQsnlNVyzYZHOOsut4LW3SdfMIp5Nnd8pzIqckEeWVSvDbBVsQcXoNR8jyGKZFfc4NZPAbOogMTuWaa0NvD73NKHkVNlBkMPfL0U5Uq6gxm4b9RlxFMnkvLqZT4ufuD6Z7cDPJw2YqncLpyUl+XVwYhyr/t8gGir+U/gQO2K99Lty7RT/3MzgpYYO5Fnq6DcfJLDiP4tZZD5cS1slRRZTCeLJanmN808AP/oRDbp0z8cAiIbnbEF/JBU60cU+eg58lPcwLhA/mvv6WqX2j+i2CB02en/0W8KzcpvU6FQDQTSOm1O/IA+bv4TNRT2ladU/8ryIf8ccKfQaSBPOcHpLA5hfJ01tLS0tLS0tLS0jIQHgD1CAszwt901wAAAABJRU5ErkJggg==>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFgAAAAZCAYAAAC1ken9AAAEL0lEQVR4Xu2YW4hWVRiGP9FASROZMIWkGRGlQChqFCW7EAlDDPGAeQCJKKSgiKDIK0G8qAsFE4UIogspLALBufAAjhqkBYWSCko4RSgF1k2GKabv47fX/GuvfZoRDxD7hZf977XWXnutd32n/Zu1aNGiRYv/I1aIc8Wx4ghxorhWfDIeJIwRV4sfix+KM/Ldt8Dzs8Vt4g5xkTgyN6KILeJV8UbE0+LMrP9B8WDS/2bWfzZpvy7+Jv6d/f5GfM58XfcFo8Tdll8k/FIcH43j9wFxk/lBID4iLIvGsIl3xcNij9gl7jI/kAeicWXgWcZeE59N+kCvOCC+YMUDo+8f8bOkHYP4xHw/rOu+icwifhJ/Fb+ycqt7T/xenBC1rRHPiI9k90+Lv1teoKniL+LCqK0KCHTZfJ4Yj5kf7jNJewDjeS4VGPD+i+ZWzaEPGVgRFtJ0KqPThhJ8ZMVNxUBUxE03gOXgii9m95vNxZw8OMJsnHhU/NSa11omMOLutWK4ilEnMGthTem8lcBVv7COK/8hrrKixQE290baWIImgR8XL1lxA2FjCMtB9llRYAyh34rWX4ZUYMTdZ/XigjqB54n/ivvN11ILLOAD8VXrxDTM/mvxmPhE1hZAfNyQtJVhu7hV/MHclb4Vn4r6qzYQtwchqwRO28sQCzzNPIEdsXwuKENYB3mDdwQSlgbM9ZkUBtcBC3jbiq7G/XzxnPijeVLpNxf90c6wSuC+71vHC6gg/hRnZfeLzb2lTuDgiqmQwxWY9xDvsVzIPWtL9xwjrOO8+d4DEfykeeVDwmsEg7rTxghYNUJjtVybMncAoSQOMRwKlvy5eZVB5m4SmET3sxWFvB2BSbiEB4gV/2Wdwy5DlYcBnuP549b8/kGQTYnDWOhb4kP57kEQF6kIhotgjQiGcFUbuBshgnKrN2ojzFHPUgdXhYqq9QVQk3NwG5P2UpCxOVUK7ZfMJ6U0WmXFRDfFmmPwy+J/4vqoLXX3UOqkGwgb4x1YOiVeKmQQmEoCT6kD88dJDuCFhDAEqqplmwQm5JR5YAF80fAF1ZW049J7xO/MsyYb5MqmuNYhvDwWOISIfnOBgkh9li/7Fph/gXEFzEW1QdUR8LB4ytyKmlAmMOg296aqUFEnMAdPqBuSBeOur6WNGbBewgEVABZJHCMOl514jDnmVUQcr1eKVyz/lUbi40OkJ7tnXr7qCFPBdcn8HAyeFcABU0rynjowH19yCEHMT0HlRF9ZqKgSGE1eMQ8xJ2xoCf+Og429Ix4yXwyWhhW+nvUFcAA7s3FLzMXFMtMadal5NscQ1pl/TqdzpeC/CKoWBAyM/4t43lykuJ8KAWvGkOI+PApDuJDdY/WUtlV56p6BeI1wbCa1kABEmi4uN/8DpapKIYRR2sE0nLVo0aJFixYtWrRoMRzcBIm9DaANzl0/AAAAAElFTkSuQmCC>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGsAAAAZCAYAAAA2VdDGAAAEuUlEQVR4Xu2Za8hmUxTH/xOK3CMSmiElMiG3CE1ym0RyFx9ccpd7RMlIPpDcQ64hEXL5MEWUwQdCpBSRQi5RKCGXXNbPOus9++yzz8UTM0znV/+eefbezzl777X2Wmu/I01MTExMTEwEq5iOMi3I2oNNTJeb7jRdadqq2d3JkaY9TGuZ5pk2Mh1v2iEZc6DpAdN28vek2ti0Wj10joWm901/VPrZtHtjRBOe/a3q8fyWZ1xv+iVpR9+YPq/+/aXpGtM6WsGsYTrYdJPpM9MPpp0aI5xdTc+Z9jJtb1oqX8iFcgN0sarpUTU3Aj1mWjcZd0lhTOhr0zb10BbM9z25sa7O+lIuNn0lfyZrTmEND6m8fhwNI2Pc+VnfcgVjLTYtMl2h8mQZ85TpJPnpgw1Mr6k8Pudu0zumT0yPmw5S/ZyAMU/KT23oLtNH8k3ucwjef4/pGdO78pOYg2NcJX9/yVhwv7rXgxPwuyVZ+ygIKWxY3yJg9byhB7y7NFlC0cem7+SnKrhMvoALkrYSt6j9zBTWcrtpw6x9N9ODcmfpg2fzjtPk8zmk2f0X+8r7McgsxoqTz5jR4CGPqA4RHOtj1fZUWNt0Vt7YQ5exyBeEyWflhgtiAXz2MWQsjIFhCJkBeY1TMCbshLG2MH1qeljNZ+HQOBb9sxiL9RPKf1PZEYrwUhLdKaoTLhN4wvSqaduqLThcPsmxdBmrBJvBZrKARc2uFreabjC9Kd/MV0w7NkY04dk3m47OOzoIY7E/96md49ij6+TPHTLWj6YDVBc3OMtt8pzFfIYi2Rzrm85X+wd838f0gektebxfJjfgZvWwQf6OsTgJjOVdpUothQ28VPXppxKk2qJoKUERQzGTFiB9hLGAqvJ309l1t46QGwCGjMVv89z5hule09b10GEIFwvyxgQ2DaNxmvgc2sScscZiE5+X55M1s74ShOM0TONApXAFfKedkzWW1Fg49OtyR2We7NmNqvPhkLFK62cfMRpR5Iysb5Cd5XmLCZ2r7vqf4oLKayxjjMXE75DfTYYSfxdRsHyoduUWd6HjsvY+UmPBEtV3Lp7HHgWzGAsIq4RXnIywOgoSHPX+OaZj5C/g0lYqMjbXP5uzwlBpSGMR+8+NaHOiPLScnrSFsVBasEBUdKXN7CI3VhicXHlR1R/MaqyYc1d/C0LOtfKSPYWw8rT83kO858F8vlx9jqXPWPPkF+A8Z7K5hyXf16sURMWYGivC4DJ52Z7CfetX055Zex+5sTjx3LnIi+TLNALMaixOKad19MkiZJyaN1bg6YQ8Ki08mUsoeSvd2CHYWKqhXbJ2nnGCvI/JcrkNsSGxsSRgTnm6IBaJh6f5k6rqJ3m1mkLYXqruDetiP3laSI1C1MEoeTidxVg410vy352X9S1XOK0slE1nMiH+LkZegggBaX/oC9OW1TgW9bbcWWIz4kS+YDpZXjgQ+8+s+lKYC4VLacNKLJQ7Rjof7oOwqelF1U7DyU7XSLGAQ/MM1pmvn/srzvh99Z1DsLfac/7fwz1wcdZG/jxUnt/6SvL58pOa59+JfwFKby6go+L6xIqFSyl/ZVnpwsXKBqeK/w/rC3MTExMTExMT/yH+BPmhLliYzl9JAAAAAElFTkSuQmCC>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGsAAAAZCAYAAAA2VdDGAAAE0ElEQVR4Xu2ZWehVVRTGv7BAacYwoqK/L00kJRahYEg2SSRS2fgYTRjN2GCQEoFGhpX20KBGRBGR9BD00MOtHhITKjCMBqQowaKiyCChYf1aZ3f22ffsc869hBqdDz7+3r3PPXvv9a1pX6UePXr06NGjR8Ak4xXGiWQ8xhTjNcanjQ8bj6tOd8Ii4yPpoOEw423yd68wnmg8oPJEFTOMnxr/LPibcXbliSpOM/6o8nm+yzseM+6JxuEPxp3Fv3cZV8n3t0+B8S8xPm78xrjbOKvyRIlTjB8a75OLtNi4xTgtfqgFE8YvjM8n46cbB8Z5xiONN8oNeJeaBQPs9xO5WDhQDkuN38oF4MwxWONF1Z9/jlxkxD0hmdurQKwFciM9qPrNAgTZJheKgx1sfEv55+twkPFZubFSsZ4w/m5cWHxGsPeN38udpAms/5zxTeN249HV6b9xuPEh46uqFwuwp9x5cAK+tzwZ74RDjFPV7nWT04EG3KP8ZplLDTffeK9c8C4gElcbv9awWIxjjOuKz4ca3zX+LI+6JrDfJ+XRyDuC4DHOk8+z7jhicf46J2sEHvKyytxKWF8trzcpOPCSdLABObFYc7Pc03EQSKTVrZnDhLwWnWz8UsOHJuqOUvnOUF8GcsdsQhBrutwRXjIeGM3j0PcX8+OIxd5eUTXyW8GiFLrr5S8AbOA1uTFPLcYCLpNvsityYhFNRBVrrDMukxvnY+MZ0XM5sNdHjWcbj1G9WDEo5NSPr9Tt/UEs7LNBwxkAG7E+AraJ9avxQvk+ITXqKbnjXKn2TPYPyON3aPgLfD7X+JnxA7kHD+TGHaVby4nFZ8b/MF5ajAXHoUa0rYHT3Cn/TpNY1EGyBiLRhGC0LtEbxAIXyfd5Szmty+XvAm1i8d1NchsGbjWuN55UPtoOasNEOhgBD0Y0oom/Ifq6ok0sIolUFcCBOTi1IAc88xl5KgVNYsUgXdI6vyAXsQmxWKExwVFZE5utUbnvNrHqzo8dEY00eHMy14oz5R7IhriX5Pp/mouL08EG5MSiwFPoB6rWjyBWzvCknZXy9BfQVSyikFTI+29K5lLEYoHlKu9c1D5sFDCOWCCUAmri9GQuCwoc/f6txqvkC+xSfZNxvP6dmkUrTFoaaDSxaELo6EhrgeGiyR2KzwiB55LeYZwNunZgqVihOVlrvLuYDxhXrOBkufkhkA64+U9NxqkZr8svqHPlL+YvhuJvV+TEIkLosEgvpJmAujR4RMEc6iIrpNl07WBY7mBNSMUi9XHn4lcIGo74ajGuWEQp0do5svDwG9LBAkQVKe89eZHkAkvdIp10BWLRDZ2VThjON36n8iC8N20wKMBEedOBeJZ5UlzYGxmA5mijytqGQ+J8RMjMYiwH9kZZiEUh6yDKtdEYGEcs9vyO/Hu3J3N7FaEDwwvZTCDpit/MAkhPDxh3yB0GT8bo1M8ADvWR3FlSY4R14t/gWDPUowXGz+UOgKHfMP5UjOcwQ76HeN/8bAaONb6t0mlYJz4jzQIOzTs4Z3p+7q+k6V+KzwTBORrN+fc5iAJ+iL1A+S6Ne2CTkXOgIZonb7UxzKjdbI8RQX3jAppLgz32I3ApJZX9p9LF/xFEFf8fFpqEHj169OjRo8d+jr8Abs86tYjud0UAAAAASUVORK5CYII=>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGsAAAAZCAYAAAA2VdDGAAAExUlEQVR4Xu2Ya8hmUxTH/xOK3DONhN5XuWdmCImiSYREcr/MN2FEbiPKFyNJbpNbbrlLJJEPSvLhRbkXSsjlA0khRCjKZf2ss5z97Pdctqcxrw/7V/+e5zn77HX23muvtdd5pEqlUqlUKotMB5huNd1hOsm06cQdzhamC033mK4y7SrvO0aJ/VnT6aYdTBuYNjYtN53dfO9iqekj05+NfjUdOHHHJHuZvld7P32xsdb0W3IdfWf6svn+lek6+fwXlA1Nt5iukS/ULqaXTO+ZZpL7WLg50wrT1qZz5BNcrWGHldo/SL7Y6YL9bDo6uaePfU0fyvvznD4uM30tt31M1sYcHpU/E3spjA0n49x0zOudPUzfmp43bdZcO0M+ISIh4PvvpmOb3zjsTXlfbPRRap8Fel++6O/II3e7pH0I+t5nes70gWnbyea/2dJ0telJdTsLHlK3s4BNQL812fUimPg2Gt7V0JdCgt3kYf6u3B4cLx/YvXGTcVNz7czm9+aml00/yqOuj1L7LNBtye9/Q/Ql2rEbGyrlMHk7DpnGWZfL+3FPMeyQx9WmCsL6NHmez2FBz8svdrCV2l2P8283/SFf1GAj02K1z4n8P6e2bx8l9teFs3YyfWF6TJ5+A555RdM+jbOY+xOazCyj8FAOurPkBoABPGV6zbRncy04QT7IUrB/hPxwvVHtM3I4aMnvn5v2ztqGGLLPAj1tetj0idz2laZNknv6CGdh/wHNT82sEc/DgWPO+kU+RlIwmpEXRWzMUzSeyf6Bc+Jize/A70NNH5velldrc3IHcqiXQJpggYjUu+VRlEMFR1Rz36fySXVFdBdj9lnw1007N79JmW/I59K3aYI0Ko+UR+35bbNOlI8VxpxFXzYNzw29ZbpfntKLYZfN5hcTmBROI5r4HJtkFyz+tfKdxAL3sbu8tH1E88vwIfrsM9bcDvMYK8chdVYUPmxUjgzW7Ga1m2PMWX1pEKeRBs/N2kbZT77DGRDvPX31P8VFSembs788HVBeL8naAqKZVMjEV2VtY5TYhzjUL8kbMvLzbo1aJ3O2skbBNM6CqGo5E0mrRXDAUe9fYDpV/gCqra4iY0eNn1nL5CU0nwG5+jO1A2dnkX5RGq0lFVKJfVIe0ZA7L+zzOUTurCh+KGQubdqDaZ2Vj3kU0sT1akvggHPpGXmOP1humE9Kaz6HiMGnC85gGFQc1PE7H2j0Td+XqPxQUGI/FiJ3FhuNvmMVWO4sUh/vXBQyFBxpkTKts4hSorU4snjZ4++XLogqUt6r8kOSiXNuLUpv6oBd+438YA5Wyid0p7yCIkIpXh6UnwPAhmFzsIP3aa7FO1U6oRL76C75X1IBz+Gfjhea70McLj8WUqeQdXgGL+Ap0ziLYGAs9Lsoa1uvsBC8l7AovPCuNv0kn3y6SEfJS2peHViIZ00/NNcDJsXLL5slFqPU/ow8E9zQ3EdV+4qGq9ml8o3BIob4awu2N72odtNwrhJpcR/FAhsaG2uzNkTVSvXKWPlNEByi8c3/n8MAZk3HNSKSuqBgWSEvhRl4X7XJe2DqxFL72MMu9kmP+RlcWceQ0ngBLcrrlYWFs4lUueDpojIMUXWyxguCSqVSqVQq/xP+Ar1TRLzi5z1yAAAAAElFTkSuQmCC>