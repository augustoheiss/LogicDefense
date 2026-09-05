# **Engenharia de Orçamentação Espacial em DOM Real e Ajuste Automático para Currículos A4 de Página Única**

## **Modelação Matemática da Orçamentação de Altura para Folha A4**

A composição automatizada de documentos em formato A4 de página única impõe limites espaciais rígidos determinados pelas especificações físicas do padrão internacional ISO 2161. A folha A4 possui dimensões nominais de ![][image1]. Em ambientes de renderização Web orientados pelo padrão W3C CSS Values and Units, a conversão para píxeis de ecrã e de impressão adota a relação canónica de ![][image2], na qual uma polegada linear (![][image3]) corresponde exatamente a ![][image4]. A altura física total disponível na viewport de impressão, expressa em píxeis CSS, é formalmente calculada por:  
![][image5]  
A conversão matricial implementada em motores de impressão sem interface gráfica como o Chromium, através do dispositivo Skia PDF, processa coordenadas de página a ![][image6], aplicando internamente um fator de conversão de escala de ![][image7]2. Qualquer fração subpixel que exceda o limite físico nominal da folha desencadeia a instanciação de um novo contexto de fragmentação paginada, gerando uma segunda página residual quase vazia4. Em consequência, o orçamento de altura efetivo (![][image8]) subtrai as margens físicas perimetrais e uma margem de segurança analítica (![][image9]):  
![][image10]  
Nesta formulação, ![][image11] e ![][image12] representam os preenchimentos verticais externos do documento. O termo ![][image9] absorve imprecisões de arredondamento em aritmética de vírgula flutuante inerentes ao cálculo de caixas no motor de layout, fixando-se estritamente no intervalo ![][image13]5.  
A estrutura do currículo organiza-se como uma árvore ordenada de ![][image14] blocos semânticos primários ![][image15], interligados por regras de separação espacial vertical. A condição de fronteira para a contenção em página única é modelada pela inequação:  
![][image16]  
O cálculo do termo de espaçamento cumulativo ![][image17] depende do contexto de formatação aplicado pelo motor de renderização:  
Em contextos de fluxo normal de blocos unidimensionais, as margens verticais adjacentes colapsam de acordo com as regras de margem da especificação CSS, resultando em:  
![][image18]  
Em contrapartida, caso o elemento contentor utilize contextos de formatação modernos, tais como flexbox em coluna (display: flex; flex-direction: column;) ou grelha CSS (display: grid;), o fenómeno de colapso de margens é desativado. O espaçamento passa a ser governado pela propriedade row-gap (![][image19]), assumindo a forma linear direta:  
![][image20]  
A altura individual de cada bloco estrutural ![][image21] é o resultado das suas propriedades de caixa perimetrais adicionadas à altura de conteúdo:  
![][image22]  
em que ![][image23] e ![][image24] indicam preenchimentos e bordas, ![][image25] corresponde à largura útil de linha disponível para o bloco, e ![][image26] define o vetor ativo de fatores de escala contínuos.  
A função de altura de conteúdo ![][image27] exibe um comportamento matemático não-linear e descontínuo. Em parágrafos e alíneas de texto corrido, a dimensão vertical é governada pelo mecanismo de quebra de linhas (*line wrapping*). Para um texto composto por um conjunto de termos com largura acumulada ![][image28] sob um tamanho de fonte ![][image29], o número total de linhas ![][image30] requer a aplicação da função teto (*ceiling*):  
![][image31]  
![][image32]  
onde ![][image33] representa o coeficiente de entrelinha relativa (*line-height factor*) e ![][image34] constitui o fator de empacotamento que expressa a ineficiência de quebra nas margens laterais. A função teto gera degraus de descontinuidade: reduções graduais e infinitesimais na fonte não produzem variação contínua na altura do bloco até que uma palavra migre para a linha superior, momento em que a altura total colapsa subitamente na magnitude de ![][image35] píxeis.  
Em subsistemas multidimensionais fluidos, como nuvens de competências estruturadas por crachás (*badge pills*) sob display: flex; flex-wrap: wrap;, a altura do bloco resulta do particionamento combinatorial de caixas rígidas. Para uma coleção de ![][image36] crachás com larguras individuais ![][image37] e espaçamento horizontal ![][image38], o número de linhas horizontais geradas ![][image39] reproduz o problema de empacotamento unidimensional:  
![][image40]  
![][image41]  
A existência simultânea de descontinuidades em escada e restrições de empacotamento combinatorial impede a resolução do sistema por cálculo analítico direto, exigindo um mecanismo de medição empírica sobre o motor de layout do DOM real.

## **Algoritmos de Microiteração em DOM Real e Sandbox Isolada**

A avaliação exata da geometria das quebras de texto e do empacotamento de grelhas depende da execução do pipeline de layout do navegador7. No entanto, a alternância descontrolada entre escritas de propriedades no estilo e leituras geométricas imediatas (scrollHeight, offsetHeight, getBoundingClientRect) no documento ativo induz o fenómeno de layout síncrono forçado (*Forced Synchronous Layout* ou *layout thrashing*)8. O motor é coagido a interromper o processamento assíncrono para recalcular a geometria da árvore visual de modo bloqueante9.  
Para isolar o ciclo de renderização principal e suprimir qualquer cintilação visual (*layout flicker*), o sistema opera sobre uma sandbox de medição fora do ecrã (*Offscreen Isolated Measurement Sandbox*). Uma réplica fiel do nó do currículo é clonada via cloneNode(true) e inserida num nó contentor dedicado no final do corpo do documento. A sandbox é neutralizada visualmente através de posicionamento absoluto negativo e isolamento rigoroso de layout:

CSS  
.cv-measurement-sandbox {  
  position: fixed \!important;  
  top: \-10000px \!important;  
  left: \-10000px \!important;  
  width: 793.700787px \!important; /\* 210mm exatos convertidos a 96 DPI \*/  
  min-width: 793.700787px \!important;  
  max-width: 793.700787px \!important;  
  height: auto \!important;  
  min-height: 0 \!important;  
  max-height: none \!important;  
  margin: 0 \!important;  
  box-sizing: border-box \!important;  
  visibility: hidden \!important;  
  pointer-events: none \!important;  
  contain: layout style size \!important;  
}

A diretiva contain: layout style size assegura ao motor de renderização que nenhuma mutação realizada no interior da sandbox invalida a geometria, a herança estilística ou as caixas do documento visível10. A utilização de content-visibility: hidden é estritamente evitada neste contexto: essa propriedade suspende por completo o cálculo geométrico dos nós filhos (*skips rendering*), fazendo com que as consultas dimensionais retornem invariavelmente zero ou valores estáticos sintéticos12.

### **Vetor de Escalamento Paramétrico Acoplado**

A exploração independente de três variáveis livres geraria um espaço de pesquisa volumétrico tridimensional ![][image42], inviável para processamento em tempo real. O sistema parametriza a otimização através de um escalar unidimensional estritamente monotónico ![][image43], projetando-o no vetor de variáveis CSS ![][image44]:  
![][image45]  
Nesta transformação, ![][image46] define a barreira inferior de preservação tipográfica (permitindo a redução proporcional de ![][image47] até ao limiar de ![][image48]), enquanto ![][image49] e ![][image50] configuram os limites mínimos para os espaçamentos estruturais. Os expoentes sublineares ![][image51] impõem uma desaceleração côncava: para pequenos valores de ![][image52], os espaçamentos laterais e entre blocos absorvem a contração espacial prioritariamente, resguardando o tamanho de corpo do texto até que a compressão dos vazios se aproxime da exaustão.

### **Análise Comparativa de Métodos Numéricos**

A presença das funções teto na quebra de parágrafos introduz descontinuidades em escada na resposta de altura ![][image53]. A escolha do algoritmo numérico determina a estabilidade assintótica e a eficiência temporal do ajustamento:

| Algoritmo Numérico | Comportamento sob Funções em Escada | Risco de Divergência | Iterações para Δ≤0,001 | Adequação ao DOM Real |
| :---- | :---- | :---- | :---- | :---- |
| **Newton-Raphson** | Falha estrutural crítica: nos patamares horizontais a derivada é nula (![][image54]), provocando divisão por zero ou oscilação infinita. | Elevado (divergência quase imediata)14. | Indeterminado. | Inaplicável. |
| **Método da Secante** | A aproximação linear entre pontos de descontinuidade projeta estimativas fora do intervalo paramétrico admissível ![][image55]. | Médio a elevado (*overshooting* agressivo). | 6 a 12 (comportamento errático). | Desaconselhado. |
| **Regula Falsi** | Preserva o confinamento do intervalo, mas estagna se uma das extremidades ficar ancorada num patamar plano invariante. | Nulo quanto ao confinamento, elevado quanto à latência. | 8 a 16\. | Subótimo. |
| **Pesquisa Binária (*Bisection*)** | Insensível à nulidade da derivada local; convergência estritamente monotónica garantida pelo teorema do valor intermédio14. | Nulo (estabilidade matemática incondicional)14. | ![][image56] iterações determinísticas. | **Excelente e Recomendado**14. |

A pesquisa binária assegura a convergência assintótica em exatamente 10 passos para uma tolerância de ![][image57]. Quando executado na sandbox isolada fora do ecrã, este ciclo de bisseção consome entre ![][image58] num motor baseado em Chromium, permitindo a conclusão da orçamentação no intervalo de uma única microtarefa sem bloqueio da thread principal de interface.

## **Comparativo Técnico de Abordagens de Redimensionamento em Motores de Impressão**

A contenção do transbordo vertical em documentos formatados frequentemente recorre a primitivas de estilização CSS gerais. Todavia, a interação entre estas propriedades e os subsistemas de paginação de motores como o Blink/Skia revela discrepâncias fundamentais de arquitetura3:

| Critério de Avaliação | Variáveis CSS Paramétricas (--cv-\*) | Propriedade CSS zoom | CSS transform: scale() | Consultas de Contentor (@container) |
| :---- | :---- | :---- | :---- | :---- |
| **Modelo de Formatação Visual** | Preservação integral do modelo de caixas; fluxo de texto e elementos flexíveis recalculados exatamente10. | Modifica a escala do layout das caixas, mas introduz distorções em arredondamento de bordas16. | Afeta estritamente a fase de composição e pintura gráfica; geometria das caixas no DOM permanece inalterada16. | Excelente para adaptação inline (inline-size), inoperante para altura10. |
| **Integridade de Paginação (PDF Print)** | Ausência de quebras de página fantasmas; o motor valida que o conteúdo coube nos ![][image59]2. | Gera inconsistências ocasionais no cálculo de margens e cabeçalhos em impressão Chromium2. | **Falha de paginação crítica:** o motor reserva a altura original e emite páginas subsequentes em branco15. | Neutra; incapaz de coordenar a altura agregada do documento10. |
| **Preservação de Envolvimento e Quebras** | Fluida e orgânica: preserva as métricas de quebra natural de palavras e preenchimento de grelhas. | Redimensiona de modo proporcional estático; quebras de linha podem tornar-se inconsistentes16. | Estática: preserva a geometria das linhas não escaladas no layout subjacente16. | Condicionada estritamente à largura do contentor10. |
| **Fidelidade Vetorial e Nitidez Gráfica** | Máxima: glifos rasterizados nativamente no tamanho final; bordas de ![][image60] preservam a densidade física. | Pode induzir atenuação (*blurring*) de fontes e fusão indesejada de traços finos contíguos. | Distorce as primitivas vetoriais; linhas de ![][image60] tornam-se frações de subpixel atenuadas. | Máxima: renderização vetorial nativa sem matrizes afins. |
| **Padronização e Compatibilidade** | Especificação W3C estável; comportamento idêntico no Chromium, Gecko e WebKit. | Propriedade histórica não estandardizada; comportamento divergente no Firefox e Safari. | Estandardizada no ecrã, mas imprevisível na geração de PDFs via Chromium/Puppeteer1. | Padrão moderno estável em todos os motores para inline-size10. |

### **Falha Arquitetural do CSS transform: scale() em Paginação Impressa**

A intervenção via transform: scale(k) com ponto de ancoragem em transform-origin: top left representa um erro conceptual em engenharia de documentos paginados2. A operação geométrica de transformação afim atua exclusivamente no subsistema de composição gráfica e pintura vetorial, não alterando a geometria alocada pelo modelo de caixas da árvore de renderização (*render tree*)16.  
Se a altura de um currículo totalizar ![][image61] e for sujeita a uma contração visual de ![][image62] através de transform: scale(0.9), a dimensão perceptual reduz-se para ![][image63]. Contudo, para o subsistema de paginação e fragmentação do Chromium (que divide o fluxo a cada ![][image59]), a caixa de layout permanece inalterada com ![][image61]15. O motor emite imperativamente uma segunda página contendo os ![][image64] excedentes1. O documento impresso resultante exibe a totalidade do texto comprimida na parte superior da primeira folha, acompanhada por um grande vazio no rodapé e uma segunda página em branco ou com fragmentos gráficos órfãos15. Registam-se ainda relatos de distorções verticais incorretas (*scale Y mismatch*) quando transformações afins são processadas pelo pipeline do Puppeteer15.

### **Inviabilidade de Consultas de Contentor em Altura**

As consultas de contentor (@container) introduziram um paradigma robusto de adaptação geométrica local quando associadas à diretiva container-type: inline-size10. Não obstante, a tentativa de solucionar o transbordo vertical através de consultas ancoradas no eixo de bloco (container-type: size) confronta-se com um impedimento formal de dependência cíclica (*circular layout dependency*)10.  
O mecanismo de dependência circular manifesta-se quando um elemento contentor declara contenção bidimensional através de container-type: size. O conteúdo textual interno ajusta o seu tamanho de fonte em conformidade com a altura registada no contentor; a alteração dimensional da fonte recalcula o volume de quebra de linhas, modificando de imediato a altura total ocupada pelo texto; esta variação força um novo recálculo da altura do contentor progenitor, originando um ciclo infinito de invalidação de geometria21.  
Para preservar a estabilidade determinística e impedir o congelamento dos motores de renderização em ciclos infinitos, a especificação W3C Containment Level 3 postula que contentores com container-type: size perdem a sua capacidade de dimensionamento intrínseco no eixo vertical10. Na ausência de uma altura fixa explicitamente imposta por propriedades CSS estáticas externas, a dimensão do contentor colapsa imediatamente para zero10. Este princípio normativo inviabiliza o ajustamento tipográfico autônomo baseado em altura puramente via CSS, estabelecendo a necessidade incontornável de um sistema de microiteração no DOM real.

## **Cascata de Degradação Graciosa Guiada por Metadados**

Ao atingir a contração paramétrica máxima contínua (![][image65]), os limites de legibilidade humana entram em conflito com a densidade textual bruta. Os padrões internacionais de ergonomia tipográfica e composição editorial prescrevem que o corpo de texto principal de um currículo impresso não deve ser inferior a ![][image48] (equivalente a ![][image66] a ![][image2]), sob pena de comprometer a legibilidade durante a avaliação dos recrutadores22. Se, perante a saturação destes limites, a condição de conformidade ![][image67] não for satisfeita, o sistema comuta da compressão elástica para uma cascata de degradação estrutural discreta guiada por metadados semânticos1.  
Os elementos da interface recebem anotações através de atributos HTML estruturados: data-fit-priority (com valores escalonados de 1 a 4\) e data-fit-action (definindo a estratégia de contenção local).

| Nível | Categoria Semântica | Componentes Abrangidos no Documento | Diretiva de Degradação | Impacto na Avaliação Técnica |
| :---- | :---- | :---- | :---- | :---- |
| **4** | Conteúdo Acessório | Hobbies, interesses secundários, referências disponíveis a pedido, elementos visuais puramente decorativos. | prune: supressão integral do nó do DOM. | Nulo: informação dispensável para triagem de competências essenciais. |
| **3** | Expansões Complementares | Crachás de competências periféricas, certificações expiradas, alíneas secundárias de projetos antigos. | collapse-tags ou prune: redução dimensional da matriz. | Ligeiro: preserva competências prioritárias e purga detalhes secundários. |
| **2** | Narrativas Condensáveis | Resumos de responsabilidades de cargos anteriores, descrições detalhadas de publicações. | line-clamp: truncagem de parágrafos para o limite máximo de duas linhas. | Moderado: assegura a cronologia profissional contendo a inflação de linhas. |
| **1** | Núcleo Inviolável | Nome, dados de contacto essenciais, cargos principais recentes, formação superior. | Protegido: imunidade absoluta contra supressão física ou truncagem. | Crítico: salvaguarda a identidade e as qualificações essenciais do perfil. |

A transição entre os estados de degradação obedece a uma orquestração rigorosa em quatro fases sucessivas, complementada por um mecanismo final de relaxamento elástico.  
Na primeira fase, o algoritmo promove a compactação espacial contínua, reduzindo os coeficientes de \--cv-gap-scale e \--cv-padding-scale de modo côncavo até ao limite mínimo estabelecido. Caso o documento passe a verificar a restrição de altura física da página A4, o processo converge e as variáveis resultantes são aplicadas ao documento ativo.  
Persistindo o transbordo, o pipeline transita para a segunda fase, acionando o ajuste tipográfico contínuo através da diminuição controlada de \--cv-font-scale até à barreira inviolável de ![][image48] (![][image66]). Havendo sucesso nesta etapa, a execução encerra-se de imediato.  
Caso o volume textual continue a exceder o orçamento físico no limiar de contração máxima contínua, o sistema avança para a terceira fase, consistente na condensação textual discreta. Os elementos anotados com o atributo data-fit-action="line-clamp" ou data-fit-priority="2" sofrem a aplicação programática de propriedades CSS para truncagem vetorial multi-linha (-webkit-line-clamp: 2), cessando as alterações assim que o orçamento de altura é alcançado.  
Se o excesso persistir, a quarta fase de poda seletiva discreta é acionada: os elementos classificados sob a prioridade 4 são removidos sequencialmente da árvore da sandbox por ordem decrescente de profundidade hierárquica no DOM; caso o transbordo permaneça após a remoção de todos os itens de nível 4, a poda estende-se sucessivamente aos nós de prioridade 3\.  
Uma vez restaurada a conformidade geométrica mediante a supressão de nós discretos, o sistema ativa a etapa de reexpansão elástica (*relaxation step*). A eliminação de uma secção acessória (como um bloco de interesses de ![][image68]) frequentemente abre um vazio que torna a redução tipográfica anterior desnecessariamente severa. O algoritmo reinicializa a pesquisa binária em sentido inverso exclusivamente sobre as variáveis contínuas de escala, relaxando a fonte de ![][image69] para valores situados entre ![][image70] e ![][image71] da dimensão nominal. Deste modo, assegura-se que os elementos essenciais mantêm a maior escala tipográfica possível compatível com a folha A4.

## **Implementação Completa e Otimizada de RealDOMSpatialFitter em TypeScript**

A classe TypeScript disponibilizada abaixo materializa este pipeline espacial integrado. A implementação contempla:

> 1. Isolamento completo de medições numa sandbox fora do ecrã com isolamento de estilo e geometria9.  
> 2. Otimização contínua via pesquisa binária estrita sobre o parâmetro unificado ![][image52]14.  
> 3. Execução da cascata de degradação progressiva orientada por metadados de prioridade semântica.  
> 4. Ciclo de reexpansão elástica para maximizar a escala dos nós remanescentes após cortes discretos.  
> 5. Transposição atómica e sem cintilação das propriedades computadas para o documento vivo via requestAnimationFrame e microtarefas.

TypeScript  
/\*\*  
 \* Parâmetros de configuração para o algoritmo de ajuste em DOM real.  
 \*/  
export interface SpatialFitterOptions {  
  /\*\* Altura física máxima em píxeis CSS (Folha A4 a 96 DPI: 1122.52px) \*/  
  targetHeightPx?: number;  
  /\*\* Margem de tolerância analítica contra erros de arredondamento no PDF (px) \*/  
  safetyEpsilonPx?: number;  
  /\*\* Fator mínimo de redução da tipografia (ex: 0.8571 reduz 14px até 12px / 9pt) \*/  
  minFontScale?: number;  
  /\*\* Fator mínimo de escala para espaçamentos verticais (row-gap) \*/  
  minGapScale?: number;  
  /\*\* Fator mínimo de escala para preenchimentos internos (padding) \*/  
  minPaddingScale?: number;  
  /\*\* Critério de paragem da pesquisa binária em delta paramétrico \*/  
  tolerance?: number;  
  /\*\* Limite máximo de iterações do ciclo de bisseção \*/  
  maxIterations?: number;  
}

/\*\*  
 \* Métricas consolidadas resultantes da execução do ajuste dimensional.  
 \*/  
export interface SpatialFitResult {  
  success: boolean;  
  finalHeightPx: number;  
  targetBudgetPx: number;  
  iterationsTaken: number;  
  elementsPruned: number;  
  elementsClamped: number;  
  scales: {  
    fontScale: number;  
    gapScale: number;  
    paddingScale: number;  
  };  
}

/\*\*  
 \* Gestor de orçamentação espacial e contenção de layouts A4 sobre o DOM real.  
 \*/  
export class RealDOMSpatialFitter {  
  private readonly targetHeightPx: number;  
  private readonly safetyEpsilonPx: number;  
  private readonly minFontScale: number;  
  private readonly minGapScale: number;  
  private readonly minPaddingScale: number;  
  private readonly tolerance: number;  
  private readonly maxIterations: number;

  constructor(options: SpatialFitterOptions \= {}) {  
    this.targetHeightPx \= options.targetHeightPx ?? 1122.52;  
    this.safetyEpsilonPx \= options.safetyEpsilonPx ?? 1.5;  
    this.minFontScale \= options.minFontScale ?? 0.8571;  
    this.minGapScale \= options.minGapScale ?? 0.45;  
    this.minPaddingScale \= options.minPaddingScale ?? 0.45;  
    this.tolerance \= options.tolerance ?? 0.002;  
    this.maxIterations \= options.maxIterations ?? 12;  
  }

  /\*\*  
   \* Executa a orçamentação geométrica de modo isolado, transpondo as alterações atomicamente.  
   \*   
   \* @param liveContainer Elemento contentor do currículo na árvore DOM ativa.  
   \* @returns Promessa com o relatório de convergência e métricas dimensionais.  
   \*/  
  public async fit(liveContainer: HTMLElement): Promise\<SpatialFitResult\> {  
    const effectiveBudget \= this.targetHeightPx \- this.safetyEpsilonPx;

    // Instanciação da sandbox isolada fora do ecrã  
    const sandbox \= this.createSandbox(liveContainer);  
    document.body.appendChild(sandbox);

    let elementsPrunedCount \= 0;  
    let elementsClampedCount \= 0;  
    let totalIterations \= 0;

    try {  
      // Fase 1 e 2: Otimização contínua com integridade total do conteúdo  
      let optResult \= this.binarySearchScale(sandbox, effectiveBudget);  
      totalIterations \+= optResult.iterations;

      // Fase 3 e 4: Degradação graciosa em caso de transbordo persistente no limiar mínimo  
      if (optResult.height \> effectiveBudget) {  
        const degradationResult \= this.applyGracefulDegradation(sandbox, effectiveBudget);  
        elementsPrunedCount \= degradationResult.pruned;  
        elementsClampedCount \= degradationResult.clamped;  
        totalIterations \+= degradationResult.iterations;

        // Fase de Reexpansão Elástica: reotimização contínua sobre a estrutura podada  
        optResult \= this.binarySearchScale(sandbox, effectiveBudget);  
        totalIterations \+= optResult.iterations;  
      }

      const finalSuccess \= optResult.height \<= effectiveBudget;

      // Transposição atómica dos resultados para o nó visível principal  
      await this.commitToLiveDocument(  
        liveContainer,  
        sandbox,  
        optResult.fontScale,  
        optResult.gapScale,  
        optResult.paddingScale,  
        elementsPrunedCount \> 0 || elementsClampedCount \> 0  
      );

      return {  
        success: finalSuccess,  
        finalHeightPx: optResult.height,  
        targetBudgetPx: effectiveBudget,  
        iterationsTaken: totalIterations,  
        elementsPruned: elementsPrunedCount,  
        elementsClamped: elementsClampedCount,  
        scales: {  
          fontScale: optResult.fontScale,  
          gapScale: optResult.gapScale,  
          paddingScale: optResult.paddingScale,  
        },  
      };  
    } finally {  
      // Descarte determinístico da sandbox para prevenção de fugas de memória  
      if (sandbox.parentElement) {  
        sandbox.parentElement.removeChild(sandbox);  
      }  
    }  
  }

  /\*\*  
   \* Constrói uma réplica do nó do documento numa sandbox com contenção estrita.  
   \*/  
  private createSandbox(source: HTMLElement): HTMLElement {  
    const sandbox \= source.cloneNode(true) as HTMLElement;  
    const sourceRect \= source.getBoundingClientRect();  
    const explicitWidth \= sourceRect.width \> 0 ? \`${sourceRect.width}px\` : "793.700787px";

    sandbox.setAttribute("data-cv-measurement-sandbox", "true");  
    sandbox.style.cssText \= \`  
      position: fixed \!important;  
      top: \-10000px \!important;  
      left: \-10000px \!important;  
      width: ${explicitWidth} \!important;  
      min-width: ${explicitWidth} \!important;  
      max-width: ${explicitWidth} \!important;  
      height: auto \!important;  
      min-height: 0 \!important;  
      max-height: none \!important;  
      margin: 0 \!important;  
      box-sizing: border-box \!important;  
      visibility: hidden \!important;  
      pointer-events: none \!important;  
      contain: layout style size \!important;  
      overflow: visible \!important;  
    \`;

    return sandbox;  
  }

  /\*\*  
   \* Converte o escalar unitário lambda no vetor acoplado de escalamento espacial.  
   \*/  
  private computeScales(lambda: number): { fontScale: number; gapScale: number; paddingScale: number } {  
    const clampedLambda \= Math.max(0, Math.min(1, lambda));  
    // Curva de desaceleração côncava para priorizar a compressão de margens e gaps  
    const spacingLambda \= Math.pow(clampedLambda, 0.65);

    return {  
      fontScale: 1.0 \- clampedLambda \* (1.0 \- this.minFontScale),  
      gapScale: 1.0 \- spacingLambda \* (1.0 \- this.minGapScale),  
      paddingScale: 1.0 \- spacingLambda \* (1.0 \- this.minPaddingScale),  
    };  
  }

  /\*\*  
   \* Injeta as variáveis de escala no elemento especificado.  
   \*/  
  private applyVariables(target: HTMLElement, scales: { fontScale: number; gapScale: number; paddingScale: number }): void {  
    target.style.setProperty("--cv-font-scale", scales.fontScale.toFixed(5));  
    target.style.setProperty("--cv-gap-scale", scales.gapScale.toFixed(5));  
    target.style.setProperty("--cv-padding-scale", scales.paddingScale.toFixed(5));  
  }

  /\*\*  
   \* Mede a altura física real ocupada pelo documento inspecionando a geometria do DOM na sandbox.  
   \*/  
  private measureDOMHeight(container: HTMLElement): number {  
    const scrollH \= container.scrollHeight;  
    const clientH \= container.getBoundingClientRect().height;  
    return Math.max(scrollH, clientH);  
  }

  /\*\*  
   \* Executa a pesquisa binária de convergência sobre a resposta de altura do DOM real.  
   \*/  
  private binarySearchScale(  
    sandbox: HTMLElement,  
    budget: number  
  ): { height: number; fontScale: number; gapScale: number; paddingScale: number; iterations: number } {  
    let low \= 0.0;  
    let high \= 1.0;  
    let bestLambda \= 1.0;  
    let bestHeight \= Infinity;  
    let iterations \= 0;

    // Avaliação inicial na escala nominal intacta (lambda \= 0\)  
    const baseScales \= this.computeScales(0.0);  
    this.applyVariables(sandbox, baseScales);  
    let currentHeight \= this.measureDOMHeight(sandbox);  
    iterations++;

    if (currentHeight \<= budget) {  
      return {  
        height: currentHeight,  
        fontScale: baseScales.fontScale,  
        gapScale: baseScales.gapScale,  
        paddingScale: baseScales.paddingScale,  
        iterations,  
      };  
    }

    // Ciclo de bisseção matemática  
    while (iterations \< this.maxIterations && (high \- low) \> this.tolerance) {  
      const mid \= (low \+ high) / 2;  
      const midScales \= this.computeScales(mid);  
      this.applyVariables(sandbox, midScales);  
      currentHeight \= this.measureDOMHeight(sandbox);  
      iterations++;

      if (currentHeight \<= budget) {  
        bestLambda \= mid;  
        bestHeight \= currentHeight;  
        high \= mid; // Conteúdo ajustado; explora menor taxa de compressão  
      } else {  
        low \= mid;  // Conteúdo excede orçamento; incrementa compressão  
      }  
    }

    const finalScales \= this.computeScales(bestLambda);  
    this.applyVariables(sandbox, finalScales);  
    const resolvedHeight \= bestHeight \!== Infinity ? bestHeight : this.measureDOMHeight(sandbox);

    return {  
      height: resolvedHeight,  
      fontScale: finalScales.fontScale,  
      gapScale: finalScales.gapScale,  
      paddingScale: finalScales.paddingScale,  
      iterations,  
    };  
  }

  /\*\*  
   \* Aplica a cascata de degradação discreta sequencial sobre nós de menor prioridade.  
   \*/  
  private applyGracefulDegradation(  
    sandbox: HTMLElement,  
    budget: number  
  ): { pruned: number; clamped: number; iterations: number } {  
    let pruned \= 0;  
    let clamped \= 0;  
    let iterations \= 0;

    // Fixar na compressão contínua máxima para validar as correções discretas  
    this.applyVariables(sandbox, this.computeScales(1.0));

    // Passo 1: Truncagem textual controlada (line-clamp) sobre nós de prioridade 2  
    const clampCandidates \= Array.from(  
      sandbox.querySelectorAll\<HTMLElement\>('\[data-fit-action="line-clamp"\], \[data-fit-priority="2"\]')  
    );

    for (const el of clampCandidates) {  
      if (this.measureDOMHeight(sandbox) \<= budget) break;

      el.style.display \= "-webkit-box";  
      el.style.webkitLineClamp \= "2";  
      el.style.webkitBoxOrient \= "vertical";  
      el.style.overflow \= "hidden";  
      el.setAttribute("data-fit-applied-clamp", "true");  
      clamped++;  
      iterations++;  
    }

    if (this.measureDOMHeight(sandbox) \<= budget) {  
      return { pruned, clamped, iterations };  
    }

    // Passo 2: Poda de elementos ordenados por ordem estrita de prioridade (4 \-\> 3\)  
    const priorityBuckets \= \["4", "3"\];

    for (const priorityLevel of priorityBuckets) {  
      const candidates \= Array.from(  
        sandbox.querySelectorAll\<HTMLElement\>(\`\[data-fit-priority="${priorityLevel}"\]\`)  
      );

      // Ordenar por profundidade decrescente no DOM (eliminar folhas antes dos ancestrais)  
      candidates.sort((a, b) \=\> this.getDOMDepth(b) \- this.getDOMDepth(a));

      for (const el of candidates) {  
        if (this.measureDOMHeight(sandbox) \<= budget) break;

        if (el.parentElement) {  
          el.parentElement.removeChild(el);  
          pruned++;  
          iterations++;  
        }  
      }

      if (this.measureDOMHeight(sandbox) \<= budget) break;  
    }

    return { pruned, clamped, iterations };  
  }

  /\*\*  
   \* Determina a profundidade hierárquica do elemento na árvore do documento.  
   \*/  
  private getDOMDepth(node: HTMLElement): number {  
    let depth \= 0;  
    let current: HTMLElement | null \= node;  
    while (current.parentElement) {  
      depth++;  
      current \= current.parentElement;  
    }  
    return depth;  
  }

  /\*\*  
   \* Sincroniza atomicamente os atributos validados da sandbox com o documento vivo visível.  
   \*/  
  private async commitToLiveDocument(  
    liveContainer: HTMLElement,  
    sandbox: HTMLElement,  
    fontScale: number,  
    gapScale: number,  
    paddingScale: number,  
    hasStructuralChanges: boolean  
  ): Promise\<void\> {  
    return new Promise((resolve) \=\> {  
      requestAnimationFrame(() \=\> {  
        // Aplicação síncrona dos fatores de escala contínuos  
        liveContainer.style.setProperty("--cv-font-scale", fontScale.toFixed(5));  
        liveContainer.style.setProperty("--cv-gap-scale", gapScale.toFixed(5));  
        liveContainer.style.setProperty("--cv-padding-scale", paddingScale.toFixed(5));

        // Transposição de modificações estruturais discretas  
        if (hasStructuralChanges) {  
          // Replicar regras de truncagem multi-linha  
          const clampedInSandbox \= sandbox.querySelectorAll('\[data-fit-applied-clamp="true"\]');  
          clampedInSandbox.forEach((sbEl) \=\> {  
            const selector \= this.generateSelector(sbEl as HTMLElement, sandbox);  
            if (selector) {  
              const liveEl \= liveContainer.querySelector\<HTMLElement\>(selector);  
              if (liveEl) {  
                liveEl.style.display \= "-webkit-box";  
                liveEl.style.webkitLineClamp \= "2";  
                liveEl.style.webkitBoxOrient \= "vertical";  
                liveEl.style.overflow \= "hidden";  
              }  
            }  
          });

          // Purgar elementos podados durante a degradação  
          const allPriorityEls \= liveContainer.querySelectorAll\<HTMLElement\>(  
            '\[data-fit-priority="4"\], \[data-fit-priority="3"\]'  
          );  
          allPriorityEls.forEach((liveEl) \=\> {  
            const selector \= this.generateSelector(liveEl, liveContainer);  
            if (selector && \!sandbox.querySelector(selector)) {  
              liveEl.parentElement?.removeChild(liveEl);  
            }  
          });  
        }

        queueMicrotask(() \=\> resolve());  
      });  
    });  
  }

  /\*\*  
   \* Gera um seletor unívoco determinístico para mapeamento entre a sandbox e a árvore ativa.  
   \*/  
  private generateSelector(element: HTMLElement, root: HTMLElement): string | null {  
    if (element \=== root) return "";  
    const path: string\[\] \= \[\];  
    let current: HTMLElement | null \= element;

    while (current && current \!== root) {  
      const parent: HTMLElement | null \= current.parentElement;  
      if (\!parent) break;

      const tag \= current.tagName.toLowerCase();  
      const siblings \= Array.from(parent.children).filter((c) \=\> c.tagName.toLowerCase() \=== tag);

      if (siblings.length \> 1) {  
        const index \= siblings.indexOf(current) \+ 1;  
        path.unshift(\`${tag}:nth-of-type(${index})\`);  
      } else {  
        path.unshift(tag);  
      }

      current \= parent;  
    }

    return path.join(" \> ");  
  }  
}

### **Especificação da Folha de Estilos Complementar**

Para viabilizar a responsividade contínua dos blocos de conteúdo face ao ajustamento vetorial das variáveis sem degradação do modelo de caixas, a arquitetura requer a parametrização do CSS através da função nativa calc():

CSS  
:root {  
  \--cv-font\-scale: 1;  
  \--cv-gap-scale: 1;  
  \--cv-padding\-scale: 1;  
}

/\* Contentor principal parametrizado para folha A4 \*/  
.resume-page-root {  
  width: 210mm;  
  height: 297mm;  
  max-height: 297mm;  
  box-sizing: border-box;  
  padding: calc(20mm \* var(--cv-padding-scale)) calc(18mm \* var(--cv-padding-scale));  
  display: flex;  
  flex-direction: column;  
  row-gap: calc(14px \* var(--cv-gap-scale));  
  background: \#ffffff;  
  overflow: hidden;  
}

/\* Hierarquia tipográfica governada pela variável escalar \*/  
.resume-header h1 {  
  font-size: calc(22px \* var(--cv-font-scale));  
  line-height: 1.15;  
  margin-bottom: calc(6px \* var(--cv-gap-scale));  
}

.resume-section-title {  
  font-size: calc(14px \* var(--cv-font-scale));  
  line-height: 1.2;  
  border-bottom: 1px solid \#1a1a1a;  
  margin-bottom: calc(8px \* var(--cv-gap-scale));  
  padding-bottom: calc(3px \* var(--cv-padding-scale));  
}

.resume-body-text,  
.resume-bullet-item {  
  font-size: calc(10.5px \* var(--cv-font-scale));  
  line-height: 1.35;  
}

/\* Espaçamentos verticais de listas e alíneas \*/  
.resume-timeline-item {  
  display: flex;  
  flex-direction: column;  
  row-gap: calc(4px \* var(--cv-gap-scale));  
  margin-bottom: calc(8px \* var(--cv-gap-scale));  
}

/\* Nuvem de competências e crachás com envolvimento fluido \*/  
.resume-skills-grid {  
  display: flex;  
  flex-wrap: wrap;  
  gap: calc(6px \* var(--cv-gap-scale));  
}

.resume-badge {  
  font-size: calc(9.5px \* var(--cv-font-scale));  
  padding: calc(3px \* var(--cv-padding-scale)) calc(7px \* var(--cv-padding-scale));  
  border: 1px solid \#d1d5db;  
  border-radius: 4px;  
}

/\* Regras de impressão para supressão de quebras de página espúrias \*/  
@media print {  
  @page {  
    size: A4 portrait;  
    margin: 0;  
  }

  body {  
    margin: 0 \!important;  
    padding: 0 \!important;  
    \-webkit-print-color\-adjust: exact;  
    print-color\-adjust: exact;  
  }

  .resume-page-root {  
    page-break-inside: avoid;  
    break-inside: avoid;  
  }  
}

## **Conclusão**

A garantia analítica e visual de enquadramento de documentos em folha única A4 elimina a dependência de métodos paliativos de transformação de ecrã. A inadequação das abordagens baseadas em transform: scale() comprova-se pela dissociação entre a matriz visual e a alocação do modelo de caixas na árvore de fragmentação paginada do Chromium, gerando páginas adicionais em branco durante a conversão vetorial para PDF.  
Do ponto de vista matemático, as funções descontínuas geradas pela quebra natural de palavras e o empacotamento combinatorial de grelhas flexíveis desqualificam os métodos de convergência baseados em derivadas clássicas14. Em contrapartida, a aplicação da **pesquisa binária paramétrica sobre o DOM real numa sandbox isolada fora do ecrã** oferece garantia determinística de convergência e ausência de degradação da fluidez da interface11.  
Ao estruturar a compressão contínua em consonância com uma **cascata de degradação graciosa guiada por metadados de prioridade semântica**, o sistema resolve de forma definitiva o problema de transbordo vertical, maximizando a escala de leitura dos conteúdos essenciais e assegurando fidelidade vetorial rigorosa na composição de documentos técnicos sob as normas internacionais de impressão2.

#### **Referências citadas**

> 1. \[Bug\]: inconsistent PDF rendering for transform on HTML from 19.2.0, [https://github.com/puppeteer/puppeteer/issues/12669](https://github.com/puppeteer/puppeteer/issues/12669)  
> 2. Extra whitespace above the header and below the footer. \#4132, [https://github.com/puppeteer/puppeteer/issues/4132](https://github.com/puppeteer/puppeteer/issues/4132)  
> 3. How does header and footer printing work in Puppeter's page.pdf API?, [https://stackoverflow.com/questions/51458286/how-does-header-and-footer-printing-work-in-puppeters-page-pdf-api](https://stackoverflow.com/questions/51458286/how-does-header-and-footer-printing-work-in-puppeters-page-pdf-api)  
> 4. page-break-inside CSS property \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/page-break-inside](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/page-break-inside)  
> 5. \[Printing\] Blank Page on Chrome \#9295 \- mozilla/pdf.js \- GitHub, [https://github.com/mozilla/pdf.js/issues/9295](https://github.com/mozilla/pdf.js/issues/9295)  
> 6. when printing page table rows/cells get random heights, [https://stackoverflow.com/questions/29293718/when-printing-page-table-rows-cells-get-random-heights](https://stackoverflow.com/questions/29293718/when-printing-page-table-rows-cells-get-random-heights)  
> 7. RenderingNG deep-dive: LayoutNG block fragmentation | Chromium, [https://developer.chrome.com/docs/chromium/renderingng-fragmentation](https://developer.chrome.com/docs/chromium/renderingng-fragmentation)  
> 8. Check if element is visible in DOM \- javascript \- Stack Overflow, [https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom](https://stackoverflow.com/questions/19669786/check-if-element-is-visible-in-dom)  
> 9. Scaling of a Single-User Web-Application \- EOT | Essence of Today, [https://essenceoftoday.org/defination/scaling\_to\_billion\_users\_web\_applications](https://essenceoftoday.org/defination/scaling_to_billion_users_web_applications)  
> 10. CSS Container Queries: Browser Support, Features, Limits \- TestMu AI, [https://www.testmuai.com/learning-hub/css-container-queries-browser-support/](https://www.testmuai.com/learning-hub/css-container-queries-browser-support/)  
> 11. Frontend System Design: CSS, CSSOM, and DOM Rendering in, [https://dev.to/zeeshanali0704/frontend-system-design-css-cssom-and-dom-rendering-in-browser-3fjm](https://dev.to/zeeshanali0704/frontend-system-design-css-cssom-and-dom-rendering-in-browser-3fjm)  
> 12. CSSOM View Module \- W3C, [https://www.w3.org/TR/cssom-view-1/](https://www.w3.org/TR/cssom-view-1/)  
> 13. Element: checkVisibility() method \- Web APIs \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility](https://developer.mozilla.org/en-US/docs/Web/API/Element/checkVisibility)  
> 14. Improve bisection method or alternate algorithm for efficient, [https://softwareengineering.stackexchange.com/questions/288406/improve-bisection-method-or-alternate-algorithm-for-efficient-determination-of-t](https://softwareengineering.stackexchange.com/questions/288406/improve-bisection-method-or-alternate-algorithm-for-efficient-determination-of-t)  
> 15. CSS transform scale() works in browser and fails in PDF \[40942122\], [https://issues.chromium.org/40942122](https://issues.chromium.org/40942122)  
> 16. Hide Table Row in CSS for Puppeteer PDF Generation \- Medium, [https://selvasudar.medium.com/hide-table-row-in-css-for-puppeteer-pdf-generation-9928699906b8](https://selvasudar.medium.com/hide-table-row-in-css-for-puppeteer-pdf-generation-9928699906b8)  
> 17. How To Apply CSS Multiple Transforms Properties \- TestMu AI, [https://www.testmuai.com/blog/css-multiple-transform/](https://www.testmuai.com/blog/css-multiple-transform/)  
> 18. CSS Container Queries, [https://lougd.com/posts/css-container-queries-responsive-components](https://lougd.com/posts/css-container-queries-responsive-components)  
> 19. HTML/CSS to PDF: How I Solved the "Page Break" Nightmare, [https://dev.to/resumemind/htmlcss-to-pdf-how-i-solved-the-page-break-nightmare-mdg](https://dev.to/resumemind/htmlcss-to-pdf-how-i-solved-the-page-break-nightmare-mdg)  
> 20. CSS Container Query Units: Support, Units, Examples \- TestMu AI, [https://www.testmuai.com/learning-hub/css-container-query-units-browser-support/](https://www.testmuai.com/learning-hub/css-container-query-units-browser-support/)  
> 21. Target outside element with container queries \- Stack Overflow, [https://stackoverflow.com/questions/76971867/target-outside-element-with-container-queries](https://stackoverflow.com/questions/76971867/target-outside-element-with-container-queries)  
> 22. Font scaling based on size of container \- Stack Overflow, [https://stackoverflow.com/questions/16056591/font-scaling-based-on-size-of-container](https://stackoverflow.com/questions/16056591/font-scaling-based-on-size-of-container)

[image1]: <data:image/png;base64,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>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAAZCAYAAACGqvb0AAAC7UlEQVR4Xu2XS6hNURzGP6HIa0C5QveSRyYmXFJigihMGIgyoSiZMFC6MxlQJCkljyQTE+lmIoMjE2UieZRHHokQJijk8X3++3/uWmvvs/c5uUrZX/26Z6/3t/da//W/QK1atf5XjSQbyQmyn0yJqyPNJgdhbdeRoXF1pMPkK/kZ8Ia8z36/JgfIWO+QaTv5iLif+rzMfhf1K5pLY2isluoi18gRmOnV5AlZHDaihpM+cpPMI9NJPyoGp4aQ87DFrErq9CI191syP6mT9sL6bUrK55LH5A7pTupOwvrsScpzGgZrfJ9MDMr19W+QcUGZTD4kPdmzjGiSs96gRGrzCfbSUmmOq+QB8kZkQHOsScqlbbC6Y7AX7PI+qi/VHPKONMjooFyT/SDLsuepMONHmy1s0doJC4OyViozL62EzbcPxUaKzKtMdQ3Eay/rE0mL0aIayJsPt86G7FnbbwSZhLh9larM6wi9InfJhKC8zIjWorrLsDW5yvpEqjKvIyHpi+tZX+Yc2UFuwYKOYkGVqszryOkMfya9QXkrI5rzAvlOlid1rfrkpK2rs32djAnKdeY1gJ9n/U232EzY19qdPZepyrzGbCC/aDdyBXa7iFPkUcbSgaZNtW1e0nWlaOtntwcWAIvMh0HEF5xu1SJVmfcv/w3xLeNGtON01JzxiGNDqI7MaxBdb3qTz8hFDERSP/N+fYQDuvkyU64q837mn5LJQbkb8XW0o47MF0nmw2i/C/kBB9O8R/tW19ZfM78Tdua7s2dNfgbxPb+IfEGcbAzWtvd7XtnbjKTuT8xX3vOSFiZjMigtgG3Btc0Wlv72w7a/EiOp3YCnl6kMr8j8NHIJFnN8/lCe4XVivu0MT5LJe2QrLGl5QTYjH1CUEKndabKF3CbHUX7VKd/2PF4o134Om0PX1AdyCBbEQimb1P8A3k/o2Y9hkdK5vE9V+v072uqMrCCjkrpQMrqErCezkH9BtWrVqlWrVq1/Q78AG8TgbGhxwAsAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE8AAAAZCAYAAABw43NsAAADSklEQVR4Xu2XS6hNYRTH/zcUIYpIkUMGlEJC5DUhkoiEkjwGJCUkUQYyQR5xDYSSJM+BiYFHuVLIQCmGBiQGYiAk8vj/rb3a6+yuffY+DJzsf/2696z9nW9/3/rW4ztApUqVKv2fGkR2kRNkNxlR//iXlpAppBdpIwPICjI2DmpCC8n+rLFVNJHcJNPIGHKN/CBbYU6SupJLiT1ymfRJxjSjGnlGzmTsLaEe5CpZQ7oktn7kIflIxic26RR5Ql6QK2Qe0u80o26wOXUILek8petz8h4Wda6dsE1tCbZ21DvzT6UycJC8RIs6T6d/hFyHOdK1HeY8/XX9TefVYPV1JOzw8pyn6FZ9HU3mwrJlIJlPpsP2IPUksxNiKdFzjVd5mpl8rsFqrfYTM05zakz3xFZaqm9Ky2+wiVzHyGHyCBYt98m48LyotPgDZBLSyM9zXl9YvdV69N59ZA9ZRu6RW2Q5OZvYNNcbpJlUI3dgwfCAHIdl1EpYvVXp2ATbn75/gzwmg9GEtCnVO0WGn6p0muxAelLqtO9gJ1pGi2GLVzMq4jyXl5KNwbYoscm5vtbh5DXqs0bvOke+kznB7nPqMDRGmkq+wqKwlBTuOkmdotIgqjfqG4RORpFwHhatRTSUnESaVmWcJ2e8JaOCTRvU5uVEl88ZnSfpHU9J/2DTmE9kQrAplRU8pZynk1NIH4LVlUbyRSr0VVMaSQ7eC4tsV1nnaWysze68uNE853XA7qkujcneKko7zx0X01InrOIrrYaF/Prks+SLzG7od1LRvwu76jivYJv/knyO82f1TzqvDXYh3pz871qHNB30Ei0ybs7TtgPpgrwzFu1WLR15ctYqWN7LETEq1AxUPKXJsG4UG8hS8hnWAFxrYZspWgf9AFTM48F1JhV3jY1dMM95R4NNc+sdinzVblee8xQ8ufIXaQFZ1LHUuSSPztswB2lhKt4bkmcubUIOVR3MS2U1owuwdPX36bA6S1tFsn7x+Dh9Zxu5CLu+yKa/+iz7hzBW35sBW4/b9Fw3BV214pyq9SKuST8/s42zaQ2BXS6zF9EopWw7ijWRShkNg12Ci6RtpSA1DDluVvZBpcZSnVuAxsW/UqVKlSq1kH4CRc3a9+BVFyIAAAAASUVORK5CYII=>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAZCAYAAAB3oa15AAACrElEQVR4Xu2WS8hNURTHl1CECHmEfCkkkVKkZCSRxwQlZEIhTAgpM0mMJKXkkSQlob7JVyYXA8pE8iiPUMpAiCiPwv/X2vvefc49p9uHrjs4//p1795nnXPW2nuttY9ZpUqVogaKteKkOCjGZy9nNFUcMbddKfpmL7dfY8QNcdTc8WXihZifGkn9xX5xV8wWk0S32JIatVv9xCnxWIxO5tmFO2JoMoejT0VXGC8Rv8S5aPA/NE28EzUxOJlfLn6KhWE8wdz5Y3ULD44dmZvMtV2kwhcrDoDV3RvGa8J4nRggxlrWvkh9xAgxWSwVw82DXhQY1DCtPzPCfWTHqNwcz8yoVQCkF2LlGR8Q58U2cU8cNq+NIuEUxf7ZfDdvi7Pmi3EmzBMYmmWest/N33NRjDOvN8bvzZ/FMzNiRbjxlhiSzFMDaX7zy7hmjUBZ2TdiVxiXKS7GRmusIEFfEm/F9DCHSMdPYo95dzsk9oX/paIV8qCYy13mRV0UwOYwRgRSEw/FyGQ+rxgAv6kWm+8MixVFgDjPipO+x618h+viJlrnM/FKXDV3NK0BUinvRAyAFCQVy1QWQEzfy+b5HsWZRHv+KGYm870SAaRdaKc1O/GvArhg2eJkxdnxr+aHZcsd2GFeAxPDmIdRbOk5ME98M+9CUX+bQrGzbU/mePfuwGrxQ6xPrheKaHEOJ9Ec8+JcUbdobCupFLe7t0VMMcaVZmFuigfmrRJRqBT6dfOGgi018MHcp1Lh6COxyfxgei02WHPP5dDDjhbIi+6LE9Z6i2MA10SPOC1eiivmnzGItoxNhFOeL4PnydwTMSPYNwljXpQ/YPLC2QVilZhizUEWKU0h7uddwzIWHa6yGuh4sTsc/1vNA+C38HOgU8WxTzehFUYYN30OVKpU6c/0GxPPm3+QsFNyAAAAAElFTkSuQmCC>

[image5]: <data:image/png;base64,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>

[image6]: <data:image/png;base64,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>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGsAAAAZCAYAAAA2VdDGAAAFRklEQVR4Xu2Ze6hmUxjGH6EY9xnXojnkfhdy18ldLiNMuf0nEUoIEc0IuYTQIFJIoog/ZEaSOeEvRDRSLoVECBFyyeX5zbuWb+09+3O+fc6Zs0/H99TTOXvttdfa3/u8633ftba0KrY2F5m3mTvW7u1q3mJea25ZuzfENGO++bw5Ys4znzG3T/dOM+8155h3mTel9iEGw98DcmBcoxBrnXT9qHmVuYX5irl7aj/ePCD9P0RHQBxYv0acj82F5vXmceYaRb8hOsC55nJzfXMt82nFSrvS/EMh1prmfeYF6ZmuMWKeUW9sgQ3NS8wHFY5Inq47ItdEknsUvx07rFfpEdjKvE4x1uXmNtXbK4H9TlCMw3jHmGtXegyIjcwnzZPNE80vFCvrMvNTxcsAQuOYQtQusIt5ofmy+aeq0aAN9lL8jlFzE/N883eFobNgOO3dihxN8bWDIiWsUOT4jJPMpYoxNzNvMH81Ty36YK+nzIvNzc39FBFrmcL2rYHyDMTAOWcRBj9RVaz3zE3T9XQDsU4xDzY/18TFwrMRG+cECPaG+a1iDsBfrl9UzznPVhQDPA/I8USg7819Utt25peq2uko8y/zfoUTAJyAsXCUVjjQfEvhQVSDeMpu5rbma6kdINYT6k3YFXAeVvxExbpDYSjCP9jAfNX8UbFCwE7mV+Y7CpsAVgvPPZSuEetZhfCjqQ1b4UisHAo0wD360DcXcRR1jEX0agWEwYOIoxggL2FCwqXmzeZhCi8qQ0BXmKxY5Aq8nmgCqHZZHWOqhviNi2tssUSxQsoQh/ERM4dPijD6IGh2au7RJwu1rvmC+bO5b2prBV4KIzTlI14aL5lQQlwNmKxYJSg0Hjc/M/eu3cvA2Mea35m3q78dWFXkNUJqjkZ14CCsaIQih2WRO8WZCgMMyjfV24iPh6kQi6qOooq5CVmIkVdaCfINfb42H1BzvibXE0YJf6QTQmmTCFTSjEV4pXpsqixnHaZCrBI7Kyrgx9TfgAhJOiBcImA/HGH+Yi5W/xVIGGR7hJPkgmYg1I89BmWXmGqxWAWEQn7Xf+0j91cIQfnOampCLlYoKI6u3SuRi5XnFOJ1CpIpRh2UbXLiZMRiDoomWM5HpYvx8ph7Kkp0/mbkeXNhwB5psaKkL8MeYzAWY4IjzTtVzWM8zziMx7idYr55egsuMOeufHJ8jCcWRVJZoZXIRqpXYtnAeQ+Vr8s58rN5P8aGmD6lwZl7LLWzhyqvs3ggP9t634phUb7JeHgDGziOSQ5XswGmG1ksQlf9fRCJvdFv5kG1e4CjoA/NR9Q7PeCZ11Xd3GLYbxSleMY5CgPnzS3iUSHeqN4qpUgi/72vsB39KOM/UG+V8s6cdDAWpyatQCwm2eXKjMmWK7xnkSKmctzChGelZ7oAiZ2Ki3zAD4U/me+ae6Q+eDKbevY6V6S2OjiZ+ci8VXG+yP7xh9SegZAcALykKLUxKnNRQWaRMTrHX6wONrmEw7cVY5fbgFzSc+REHwoVjreYf9DQ/y/YDCMY4AXOU5xfsVTLXT0rjJfvVzHNJCAs+5h+IKeOKqIIEaPJaNhiRHHEBZsOaAHiYUPGYrU1bQFow/npg11ZzZPGoYoPjgBRDlHvhxDP8cK8E5/J4ItBUxicNUDtJWo+CcarVqh3+DmTQSQgT3ReEq9OEL/5dF8HK4v2hVo1oc9EEGb6HffMCiDCw6qWlwChSJ7szAGFRten7v975G865fcVBLxI4amUy3w2uDq1D9EhOEGgfEeYjFFVy2TIKhuiY7Ba2AQ3lbBDdIh/AKsFKbswZEAEAAAAAElFTkSuQmCC>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADsAAAAaCAYAAAAJ1SQgAAAC00lEQVR4Xu2XS6hNURjHP3nkLY88ImKCFEoMZHBFeZSSRxImHiEyUBIZKAllJK9EHreLgRh4pzxSKAOlZOiOFGIgDLz/P99anX1Wp905N2ew2f/6de5d3/rWWXt9j72OWalSpYqsmeKd+JXhg1glBokH4kfG9klcFL1wLqpOip9idmowH8N2WnRKbIVTf/FUtIvh1aY/2m4e1RWpoYgaL96LS6JLYuN/xrEzr/AiYkSOCKYi0u3mkScDCq9D4rtYKIYlLDWvV+YUXrFeP4tz4kTCK/vP63WseBHg9dQRbRRfxN7U0IC6ia7pYJ5ivW5NDZZfr/jVOqB61V1csdqvunrE914QC1JDnni/fhMzUoP5GLZa9Yrf+nSwAY0QT8SY1FCnhojH1sAboqPvV/zuif3ivHlj47IxR9wQk8M8Hmi1VaLfw/yALouD4qZVbmLRRrRXiilhvLOYL84EWHNNmPfG/KIzMczNFQvSmGqlI2l2XXwUkxIbp/lSTBN9xDWxWCwRO8XuMI/Nx6zoZ77eXKv0gliv1N0Rscz80A6b+8XxbWF8qlgXfLJr54o6eW3V9+G3YrkYKO6Irxkbf7eJnjhbdb3G7CAaI80jS/qzOXwWBR+igY0IcpBXxbxgY84j87XiQfAd7JN9bTBvaJQOkY1z4tpNFScaGxpRpivzSaZwUGyaLk2qx5o6ax51lNYrDxGjlPWjjEjXtOOmazdVbC52wc3imPlpM0Y0Y8rdFdPNI8jDRh9SmXqdJVrM0zne3vgVxi8tDoxUxS+KUhhnnjm3zUuIjBqdmfPXRa1y4SC6fLIJNMq8Ltea19pDscc8kjSvVrFFHBW3xD4xOPiRlsfFM6uu81PmabxJHBADxARxX+wwP7imi7rrnQ6ap1x8eOZA1ha7b60LQazzbPdnjD6SXQelaxdCLeK5eYTJGLKBTPgnNVTsMn9dUf99q6ylSpX6Df5RmnsKc8qiAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADQAAAAaCAYAAAD43n+tAAACiElEQVR4Xu2WS6iNURiGX7nnfskl5FIIA2FCSVvuSgkDMjAwMCIZIGQiuRS5DYSJRJJC7lHIRFJGSiZKZjKgTIy8T9/6O79ln9PZ9jmcU/9bT+29vvX/a33fer+1t1SpUqVKlSp1LfU2oxN87rYabM6YL+a2OWem/TajG2mi+WAumf5ZrCPUwwwzPfNAZwhb3TCfzeQs1hGiQBfMU3Mii9UTyQ/IBxvRDPPV/DSfSmwqT2pCC81ds8csz2L1tMDcNwPzQHs1z/xQLNgZ2qXozfaq0fl/aLb5rrYTwgZrzT1z1AxJ49hpm8Ky6xTFKTRUMfe9eWMOKS6eQtPNccU7l5lJ5rT5aJ4rEmP+PnNRLWsuMYvS57piU1iCTRXXdO5jFjxo+pnrpqawBJtZqZh/1RxO8wsx54HCdmWR/B3FJgcpkmW9keaZog3QBjPfPFRYkfXZ66oUb1VjFA+9UDTwS7Pf9EpxTuGbooJzFLfVRsVmKUhrC403r8yU0hibfmdOms3mvKIoiMQfK5JEUxUJPVHckvXe16aoaL0fVKq3w7xNjDCXFXZA4xRFyBfKN4iwJTZks7koXN4/tEJx8ksVhW/qFtyqsAHJUiGsiVVIaE2aQ4VZCH/X0hjiBJhXFnZ6bcam79h1rulrbirsOMFsSXGeZwxRwNzWDatmjiksRnMuTuMrzBWzU2HTR+aIGZXiiGpT9bJIgNPmwiDhs4pTY/yU4rfqgFougfXmWnqGn5fc1n8lLDhcsWg+Xhx/n/Qd0VP0JX+haOZ64sS5Ccvi/dizWId38zz9M0tha+z9T0UytxTJcHLN/JXarrh46FlOktP6L1ptditOqRnx/F7FtT4zi1Wq1BX0C30rZREc8jdNAAAAAElFTkSuQmCC>

[image10]: <data:image/png;base64,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>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACIAAAAaCAYAAADSbo4CAAAB5UlEQVR4Xu2VTyhtURTGl1DIn0Qhiqky8HdAiDJTBqTIgDLA1IAYvcmbvqQYoIQM/ClJJMQtE2VipujVM6EIExO9enxfa+86d9/7QvZV6n7169yz17pn77POt9cWiSuuj6kZ3ICXAA/g1vx+AhMg0/4h1poDf0G9M14puqg9kO7EvCsDHIPfIM+JcfIQ+AdawkP+VQruwTpIcmLZ4FSiV8u72kT9MOwGoFrwDE5AlhPzrkmJ/sac+ADcgWon5l3WA3zrZTBjWADXYB4U2eRYyvpjHxSDggApgTwqEaQ5Y95k/THuBqKoS7RCMRH98d6tyV4z4A76kO0ff0BheChM5aKVYAfeAr1mPFm0ShtgCpSIGvyXaIWbwBIYMrn/VRl4BNsS6QdX9NIRyDX3fDAn7wYJoAasii6sAVyCDhNbFLVAhJh4JZHnS38wyVGP6K7igylOyIXZtl8FzkCd6Pm1Y2JskGyUoybv06KXgv7g9v4ZuOdCQ6KTc1LmU/zkF/I+D74ptvlD0fJXgFZR4/aZeCpYE/0UtgLtJsYrP72XA5MTrYAfoscA/cFOuytqXBq5U/SzsQLnYBMMglmQLx7FZsZd5o7lmKsVjwn6g7vHzf8ysSJjYNoNfLW4Y7ibRkCjE4vr++gV4EZZkdsPu1oAAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAaCAYAAAANIPQdAAACzUlEQVR4Xu2XS6hNURjHP3lEXnkU8gwpj5JnKQaKYsCAFBGnqDskBiKDGxlQ8igTKUmSR1HyFgeFmBiZCRNCmJiI8P/1rZV11jmHm0732rX/9evuvb699lnf/h5rXbNSpUr9z1oo3oqfCZ/E+3D9RRwSA+KEIuu4+CbmZ+MzzR2+KfpltkKpv3ggXohhmQ3HquKHWFRrKpYmi4/iguiR2QaJp9Y4yoXScvP625obpHniq3gsBma2QumINY4UTt0WH8TszFYoxZojWqfFscBJ8UacEKPiw0VVrMdbYqwYkdA7eW63+C7akrG/qZfomdx3E32T+05TrMeduSETDeie1ad0M9HAzohlyRj1fcW6YCuiHjuyPUw332aG5oYmYit6ZJ4pUTQ2fq9TFffHV2JkralOa8V9sV8cEMPDOOm4WlwUR8U4sTHcvzOv6SXisHhpXv84SyqjCeKguCTWi+7m0T8npopN4pqoiEnmh5az4bpDmiY+m6dQWn+NRARoSDi1wnzxXOPYGvN6m2O+uD7mtZtGjQy4a7WRnWvu3GDz+byTj8lHonxuBBv9gYPKtvBcxdzZP2qBeG3151Ve3kh5PbKQqthgvvBYY7PEM/NuzMGCjxHFXBZN9iC2p4fmPSGKjt4uxojLiY330hhZB9ortofrlomvT33FIx8RAhbFD0ZF5+nSedTyyLLw52J8uMeBJ+aOUTqUUbTxXqJMFPk4OEwTa6loOtQYEcNRanOGecpUwjOk6Hmx0mqjtk5MtN+RHW2eAbzzjhjCZGmxedngBPOvmv9eTOO4dWFj3hRrnnn/JGpvn9gsTomlYZxT0HXzRbOQVeaLomFUxQ7zpsMY/67RsHaZO8I7GSMTtph/sNjMaEzt4Zpn+Q0ij4ggjWiPeca0VCyUlKL7peKeaOTjNLK0mTGfyPI3FdHK9838EJE3RQ4Uqb1UqVKlul6/AO94hZjfKB8VAAAAAElFTkSuQmCC>

[image13]: <data:image/png;base64,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>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABHElEQVR4XmNgGAWUAkcgfg3E/6F4BxBzIsnzAfEuJHkQXgfE3EhqUAAjEM8C4l9A/BOILVGlwSAIiNcwoFqEFQgC8UIgzmeA2DyFAWIBMigC4mg0MaxAH4j7gVgSiK8D8RMgVkSSZwHi2VB1BAHIxnQou4EB4rocuCwDgwgDxOUgHxAEfUBsDGXrAPF7ID4BxPxQMRsgngxl4wWw8ALZDgIgLy0H4n9A7AEVA7mapPBCDnCQISDDQIaCYo+s8IIBkPdA3gR514mByPACuQYUFqboEkAQwwCJiGtA3IkmhxWghxcyEGeAJBOQgUSFF8gLoKzBhS4BBQ1A/BaINdHEUYALEH9hQOQ1UBbyRlEBAaBkAsqrBMNrFIyCIQMA260zNBT6yKgAAAAASUVORK5CYII=>

[image15]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJkAAAAaCAYAAACkeP7MAAAE+UlEQVR4Xu2aW8gVVRTH/1FJll1ISaworSwKwsQKiooQlXrIHiLMB+uh64NZFCVWUA9FET5VYEjiBTKIKEKNiB4+Sqgnu9BFIsGikooKoiLFLv+/axZnzv5mzzczZ2b0G+YHf/zce86ePWvWXmvtfQ7Q09PT02VOoWZSx4YdPZ3mKGo6Gn73l1BfUl9TD1Mzhrt7Os4x1HXUFup36lHU7GwnUx9SbyA+8BRqA3WA+i+lH6g/kr+/p1YiPkZVrqS+xfB9dU/dW3//Q+2gzvcPdIy2bX819Rd1S9gxCrOob6jVYUcGF1K/UC/DQqxzNPUY7IEfTLXXyXOwh78saJ9L7YFF4jODvi7Rlu3L+ENhygy6FPYwd4cdZAH1JzVGTRvuGhmNN0Z9juxUvhk2rxvCjg7Rlu3L+ENhygz6FOxh9FAhboRXYDm+Ts6h9lEbMbyKhTvgfuqK4a5O0Zbty/hDYYoOmhdNVNe9R/1MzQv66iBvFS+D1WUvYHQDH6m0afui/lCKooN6NHmdOh32OUmF4q6kvamaSKtYkep6DO57NvU49SO1HFabdJU2bV/UH0qhFKOC+vawI8CjyTvU+pS2U+9T12B8KqsDX8VaqUqXfl/tuLSyn6RO8os7Spu299OGOlLvoYPXa6kvYC/vhKHe8cRqAj3cGpgR7gz6TqNupY4L2suQV4/Nhu0stZp1L6GIdhPsJTyCbjhgFdvr2T+mdlOXJ23Hw3bpapNzhjt151KYzZ+BRchKWUIeuor6iHqTOne4exx5NYHw3c27MGe9gNoGW2ljGG3Hk1ePCd9ZKpUKXXcVBlv7nbDT7MlKWdun0fPraEf1qi/QE2FlxlS/KAP13U/9RL2GEc8g9SK0En6l5gd9aWJnNI5Oi/+FHYqmo5aOFMYwmpPFzseEjPE27N6LMHghLyX9ioI6tHQHnIxUtb1s8QC1AnaYPSdpl01u84syUABaR31FnRf0VcbTUV6hlxdNdMr8KmyHp+vS5DmZ2hRhsgznTLSKVfhqQ6Baxe9xMWxTIPSC5GRyQEcLS6k1L4WrLlGBHZubxpiN0ceYaB6iqu317CpVZsKi2cqkXQtuoV+UgRf+Sre1UWQ3EYsmchKtMBlBp82hQWNOps99gonPtmKrWC9IxvqN+gwDpwrRM6UdUGiDo/nGCtsic2tjDKeq7ZfAvpITT8CKeTn+PdQZSXsWRfyhNLFBtcI2YfD9mKS0qtAr6e8DsLrrIvvIOGJOpv+/BQvzDwV9QhFKc/L7aqV+B7uv/j1I7aXuRby2ULG7lTo1aNec/oZtGPTsIT43pYuY8/oY+jFB+HKFj6EIEjtayJtHHbZXqlQUE0p7e6mbYREqL3rG/GEkGhk0IeZkjtKYh/E60a9KnoYVwnIy33k6MvLzGLyEw0VT8/B6zCOkFoKK/0+pO/yiCI34QyODJkzkZIoEsXRSFUWfZ6mzYM+mwjdMNXOotchPU23Q1Dy8HksjO+tnPOn6NItG/MEH1VlMXegMTmcsH8C211tg0SWNvgLRLjCW7qqgyKCfLHmKkZRe0ylL9Zxe7OJU2+GgiXkoYt0Fq1N1FpbeVcvOLyK/HhOylWxWq5NpFa2DFdGaVKWDtwooysXqlSbRoroR2bVUmxwp80jjmwmdNiga1oocS2F0EyxvhyfLPd1mCuxrOu1A78PkPrzu6enp6enp6elJ+B+XZkmcjQkWXAAAAABJRU5ErkJggg==>

[image16]: <data:image/png;base64,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>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD8AAAAaCAYAAAAAPoRaAAADRklEQVR4Xu2YWchNURiGPyEzmedkHpKUKWVKEhck9FMkEcoUZQ6hJCJThqRMKUTIVC4QrihTlEghV+5cuDS8T99e/fssW0nnnIvdfuvpP2ettfdZ65vWWr9ZoUKFUmoqxomJokXS1lq0DQPyqPpis/ggVoql4qnYKx6K/rVD86V64pi4IJqk2vH4E/HAPCJyqZHikxgYd0ibxKG4MU/aKb6ILnGHtFZMjRvzpDPil9go6kZ9vUSrqC1Xmm2+ePgh7omFonl6UF5Fpd9lvvBgBHhp2amQSxHybGm7xTdzAywpGVF54YhFVgWjs1hyuk7cIU0SP8X6uKPCYtEnRce4o9zqIQ6b7/OxhojvYk7ckRexhd0QDeMOaa54J7qm2jgAbRG3zY1CxHQWZ8V8MU1cEtOTPjRAnBLbxXir3TnoJ7rOJf19xChxXUxOxnCkPihWiEHmEXHeSlOC94wxf88O86N5o1T/X8X+jndHRO2kAsVuRqqNH6EoMsG+4o75CZBdgXvARzFcNBM3zSMH414xPx0OE2/No413rTM/QGHQq2KrucH5zYvmKcn30eZOoJ3nSMN0KtJ+3LxWYMznok2qP1NMiImtEW+SzyzkgPlCZllpLSA6bonXYrXoZJ4uvc2jAO8xvqX5nYDnuRMwITTB3GAslhPlK/Oo4RmioZ3oYP6ekGq8m+fvms+XsfSHIkxUvjB3COK5y5adxiUiNPAwwmpDxUzzsMlKA9TTPAy/in1JWzwhPP7e3CMsMIQo3iLSwuesSXYXj5O/Qenn2pvfM8Ili/TAGcHTHMPLvjthDEIzhBs5vS35jKc5FBHWiDFckkiBa+Yew9DUCdKA2+IGcSQZj7g69zOfOIYkMsaaG4caEo7X/OX7YFFj7nHey2+Qgo+StrIK73L0XSYWixPmIYrw9GdxWqwS+81DmwkxjhShjTpw1Pw02c3cmPPM38m5gtAn7bhZ8lsYDE/ft9pIYPEUVwyMwYjYPeYGo3D/U77/r1hQfLUN+d7ASq/DQRRAihcGTPeHXGcBaYXxKH4GNbY/7x+IaMxKpYqJSeCJ5XFHFUSYPzMviEQBxbiqt88p5kWSvb/a/+khYhaY1x5g+y1UqFC2fgNhb4oWs61vugAAAABJRU5ErkJggg==>

[image18]: <data:image/png;base64,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>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAABLklEQVR4Xu3STytEURjH8UdYSJKwspvIQqGkSHaTvdmMsrHyJ2VpfSV5A3YWshDvgDILRZOyYGOjZEOSFcVG5Pt4jrnPHTNjM8v7q8/iPPfcc+9zzhFJk6ZyWjGFETSWPasZnbyCK8xjA5e4Q5+bVzENWMU9ekOtBUe4RleoVc0AnrEltpimAxfYc7VBzLhxKRG+kHW1IbxiwdWWxNpLRFfTrzwi4+qzeMeoq1XNLk7RFsa66I7E/evJrGEb7WFOIou4RY/Yy3l8Stz/NIZxiPHwTiLN2MQDbnCAD4n712Mcw7HY5v4b7f9N7DL9Jgr+ZELsQXcYN2Ef5xL3q/twJvYXy2J3pJQCntAv1u8cXpBzczrF5q1j0tV/ove+iBOxa6y7r4uVR/dJTyNNvfMNpjgv9pmeH5oAAAAASUVORK5CYII=>

[image20]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABNCAYAAAAb+jifAAAEc0lEQVR4Xu3dW6hmYxgH8EfGRMQ4m4ZEmEaSwoVyMSGNQk4XSkkjXJhETpkbQymHlEM5FzMuSOQCUYRwRTHkUKSQFDdywY3E83jXmv3Nahv72zPfPvX71b/1fu+7ZtfcPT3vWu+KAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAgCVldebbzGPd7w8zX2aWb7tjeuszK4aTAABMxsuZn7vxuZl1I2vTeS5aUbdyuAAAwGQcmtnQXTdm9tx+eVpbQ8EGADAn1nTX3TJvZM7ofi/LXJd5YiS3Z/bp1hVsAABz5OyR8feZVSO/d0TBBgAwB7Zkfouplwf+79m13s2ZPzMvDhcAAAAAAAAAAAAAAICloY7yuC3zd+anwdp0Toh2Tlvdv2n7JQAAJmW/aAVYpcYzUWe1fRXtoF0AgAVrbUwVOAePzC9GF2f+6jJTR2Y2DycBABaCRzPPd+MDo30svT/9fzHrO21PZ/YYrAEALCr1NYB6lqtXz3QtFb9GK9puHC4AACwmVdDUg/q9Y0bGi1111vrn2ap7OFv1MsNxsXN/AwBg1vqC5u3MvoO1peDraP+/+tj7bLdG38s8mXkrc/dgDQBgTuyeuSdaYXPNYG22zhxOzJPqjt0SMz/qY1T92wdiasv4ssyp3fiqzOHdGABgIo7OPDyY+z1aUbIQ1Pbjyh1kXL9EK9zGUcXZHyO/P4pWxAEAzInzM68M5mr78IhuXIXJq9HetlyVuSJzQeaibv34zB3RzjAr6zLPRnvW67DMndGOB3kwc2LmqZjqSNXfrnvrnr26uaHq0F2yg4yjtkJnsyV6crQittePT8+cMzIPADARL2Vu6q5XZr6L7btHtTVaxdbyzLHRjseo9eoy1TNdVaCdlXk9c1q0oq7W9+zuf6G71n11TEit1d+sgnBrNNXNW9aNJ2VD5v3h5BhOivYm7ZuZLzIHRCtIF0onEgBYwvq3QU+J1rGqQmvU3plPom1N9sVW+SbzWbRu2a2Zu7rraOFV40u7ca2V+orAmmidqc+7uYe66yR9Gu1Q3J21f7SitRzVBQBg3qyN9hJCvRlZamvwmcz10Qq52l68IdqW6SPRCqLLM9dG60CtjrbdWUXaO9HUFmwVb7UteW+07dgqCCepirWZqqK0LzJ79aLC/dE6atVV7L8EUR3JOgrlv7ZzAQDmVL1BumU4uRM+jrZN+lq0Im4SqrCqLcxxXhD4IWxzAgCL1HnRtkxrO3NXWJ/ZFK0LNynVAazM1H2ZH8M2JwDAxFVHrT9zbdxU1w8AgAk7JFq3rO+wjZMVAQAAAAAAAAAAALvO1cOJgTpHrr5eAADAArZ5OAEAwORdGO0boPWN08cz7w6ysd32LwUbAMA82dRd61uoKwcZPcJDwQYAMA8OynwQ7dumdTabgg0AYAGqj8wDAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsM0/sXKim4yZLHgAAAAASUVORK5CYII=>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAaCAYAAAD1wA/qAAAC/ElEQVR4Xu2WS8iNQRjH/0K5Xz5yiXLJBt+ClCixoViQWFDshI2V+MTqlCyUhcuCUFgoopAsRPlCFqwsxIIckqJkwwK5/P9nZpx5n/d6TufbcP7165z3mfedmeeZ55kZoKt/T6PIMGvskMaSodZYRYPIBDLONuRoATkHN+BAaDG5iBb7P0J+e3abtixNJ/fIfNtA9ZDb5Ceafer/O/LdP78gG+GCV6St5BRaXJkN5AdZZhuMNPhRUjN2q5XkFzlg7MPJeTjn1iWbUtK7N+HmVlnHSZ1MM3arXriI6rdI++AckUNWa+FW5oJtyNBm8ggVU0xF20+ukiHJppQ0wVsoLnL1ob7qyA6M+pAjNWPP0mzyEuWZ0tBc8glugMlwEVuOdG5q8nLCpouVJl9HtsMzySvyFK7WyjSS3EX5mA0pV5Wz+uAkmsup/FSeBk0lb+AcLZKip3o7DPdNQLn+mpwgY/6+XS6loHawss2hUR9yZBOaL2t1NGlNIGgR+YDyZQ71cY2cjnhArpN5zVcrSf31w5VArkJ9aNA4lQ7BpYBSLUiOvPW/eSqqD/Wvs0fbcLwJyL4d+akmR56Q8bYhVlwfQXnFX8WRovqQwo51NrLJAT3Hqx9Lc7NBTUn18Q3JdNFEv5ItkS3YyxzJOz+CdsE5onSuqkqppRSqI5kGNbiTeBZZRXZ4u7bC92SNf85S0fmhK9Bj8pks9DYF8AaK+9QctRFpB8tUVgrFthHkGJnj2yaSZ2Snf7YK27OCYPNdQbkPVx/hpJ4Edw3RdeUyGeztsbT5aMcqXMEZcBHWcgfpwz64Q0jOrDdtKlbbqSJ9B827lPgIl4bii+cMkg7qXjYFrk+bxkEqcK1i4XVGE9OLWZHQLTgrJ3XGqOPCHaQFaaUe+t8sLSXPkd/ethR9DbzaNrQppalWRBNeYdoU6IOe0sOwHWmZryB56rerbeQS2Y90f6pNFblKYECk6Oz1dCJSo5FO73B4tnSFb0caaA9ZYhs6JJ30nUrfrrr6r/UH4vaXYc3Z2DsAAAAASUVORK5CYII=>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAxCAYAAABnGvUlAAALiElEQVR4Xu3ceaxt1xzA8Z+YpxgqagqvqKnGooYgMfNHRRQlpgg1k9IgrUZuU5ISszaGmsVMRQxVmjiGqCCmmGKIEioICQmJimF/rf3r+d11z3jfe/fd234/ycq9e99z9llr7bXX+u219rkRkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkiRJkqTd4ipDumK/c3StIR3T71wRx3xUv1N7xuWGdFi/cxe4/pCu0e/cwxZdf4fC22L71/xlGe3yhuPv1xzS5aNdQyeNPyVpv9xuSP8d0uH9HwZXGNJZ3b7HD+kv0d5D+uOQLh7S2fVFxefCzn+v4rxyjneTd0XL0xP6P+xRi66/Q4Fr/lll+0pDemdMr/eLxp+/i9WDzAti+v67DukmZftn42ueWPZdfdy3VxCMHT+kfw/p90P6yZB+E62soJ6OG3+XpP3y537H6PNDel6/c3DjIX022swAmO2YxLSDqpih+3q/cw96e79jjzux3zHDS6MNQDvlNUO6U7+zw+D4rSFdp//DLrSsLGne9bfTrhrtmp+FQOqZZZtrfRKrz3QSYNOe0imx+WaA8/rgsr2X0Bf+o2xTlr/H5v7wQ+V3Sdq2f/Y7Rj8f0m37nYP7xObOlwDuwiEdUfZVr4x2576XvbffscfV8zcPA9Gk33kQvTlmB/3V9Yb07tgbS0zLypLmXX87jfxyzc/SByCPiBaErHpdHxstSEu/jM0B21Gx+ozdbpNlqW2yzrCBgHUv3GRI2sW4Q/7FkJ4xpJfF5rvcWUEKHfTHh3R0tOc1jozWyT+gvqhDx3X3fuc2kb/XDem8IZ06pOfGziy5zqqL6lDla7tWCdj+M6RfR1si24lnEVcJ2Jjlob29aEi/6v622ywrCxZdfzuNNj6rnd98SOcM6UbRrvnvjNvroC7y2PxOe8qA7b5DOnn8fS/i+sjlXBJLo9fd9IpWbztxDUm6FONO+f7j73TMDIRgIJk1qDO79q9uH3ffnyjbjyu/g87qQD1z9PJod6rM/oAAkjtc8LzNuu4Ys2drrh0t35k+1m33S0Hz8nWbIf0pXzRHzizMysc6OM4J/c4Rf6v5P73b5gHpivxPYlpOArd83dXGfatiWfzZ/c5RzQPPSj20bB9WXpdYDs16mgzpLkP6UbSZt3lqftfNe4+ykGapZSH1ZZl1fuddf9uxTvsnL/2zYpOYfc0zQ16Dz5Nj8+zYvGuoog4m0QJSluM5Hv0GeahLrdtF++JBf2b9Zt0c3jo2t5OHDekDsTjflKvvyxZ5yZDOj2ngVh8n4TqiHiVp294UbUkTDB4EZJgXsLGPmZdqMqS/lW1mCyo66/0ZiHoMbJk3OuCvRgswtvOcyLxAgtkOnlvLxGxO3X7a9KWXmJUvBpEvX/KKrcg3y0W4V2wNBNfBw9zv6HeO7h2b8//tbnvfJa9saBO0DRCIEnzyYDwDGEuS6+BZrjP7naOah58O6ZNl+4zyusQgn3i+jgGfm4FFS3P1uax1896jLPPOUS0LqS8LNwG9edffdqzT/mlreXORJrH1ms/nU2tAXIMtzLuGKvoAgm2+NMK3KXnUgmf3bhHz63Md2b447rzgvW8nywJFytX3ZbPcLzbPqN0zWsBWZysp47xrU5KWIsDIh8qPGNJvoz14/PpoHdusDubC2NrR0zm9JVoHflpsnYHgcx7e7cPNhvToBalfVkjcqeYgtxFtloXB8Q/R7opBYHFWtECEpcpThvT+2PycDPk9u2wvUjvfeWbli3p8Q7SOn88mZd4I+sg3QQR3/ASFBLbMlDCQcR6eHC2g++iQnj6kc4d0qyF9ZPxZfSpm1/Ms/cDcY1DOWRVmCli2unO09vLpcT/lIP/7op3zrOM6gDODwTeFee8yqyyJMtMHjntRtGDyS0P64JAeOf6N2c7PRAuQXhzteSJmu6hn8v6UaO8nryTOEefnyGj1+5Bo9cs5qjg+ZVnVsrIsuv6Q5aDNZH6zTb01Wn2TX9CW+vbPowucF+qG64ky0Rb3RWtrk9g8K8fr+2ueILLOpoG2yLIf+muIwGTWzCj7udGjfCCA41zOCjKPG9KTot1k0Ae8IlodcH1Rdm5MaCucU+qF85LtK28yUI9T2wnvqYEds2/UM7N/KcvV92W0qT7wphz9jQB1Vq8xPv9A3rRKuozZiPYVdBA8/TDaHXB2UmzXu1X+hQcd0cXRBkEGTF6Ty2kMeNxd9g/Xcmd7IO6ikYPcN6I9+3P8uJ/BJp8RYbDi8xgwvxdtyYmBls6+dqLk94tle5FlAdu8fDFjQn2QPz6bQSPzxsDD/nTe+JP6Z6AEn3vTmAZJvI/jMXjVsjCwMWisuvS8LGBjUGMWjmVKAraUy0hZx6COGRSzjmuZmE1h/yozR6sEbK8a0vui/TsI8kF5+TzqhBmcGgBQd+zPJTJey3vwg/EngcODogW/fDb1TkBCOfhZcR4OZMC2EfOvvywH38RmNizzS12T36+N2+SX15DfbP/MHBGocI5pF2zTNjhfXxhfQ1tj9rfiWOQhvSemy3tc7ySuff4VSeqvIeqnn4FPNRgkL5PYuiRJWQ+PFngR4HB88kX5XjD+pD0ScF0QrX1xXmhf7OP6Qn+c2k64AcrAjv6NGzoCYG6aUpar78u+H1vLR1tkmZggNuurv5kif3kzJ0lro6OvgRR3sfVZJpaoVhloq41umw521l30dtF50zGS95pXOmo6bGRwRSc9iTZw0UHTYTLYVRvd9jzLArZ5+WKwxHejfTaBFsgbg3QOMMhBhIGeABDfjJZvlleRQQeDCYNSxSB+RLdvnmUBGygLg16V5an1MYnWjrKOGcAq8trPVMyySsAGBums4xyQOfc8o/TjcX8G53UmJesXGVTmQNoHwtRjBkWJ+q7ByTLLyrLo+stygPxkfikj+SUftIMzx/2Usbb/GghlIH/7mC7P17pIlJlrfl0b3XZ/jaV684eju21QVvKeQT6/k38wS0iATQCegTU4L7SvDMrQH6e2k3vEtB44RwRns2z0O0YndNsEvnwW6bDYOgOHjVi8bC9J+4UZoBpQLENndX605bN0WrSHcQ8EBjNmUbizZnCrJjH9ptndoi17PSZaJ8osBsuFZ49/f2q0jpr8nj7u2x+L8kVQ9pxodQmep8q8HRUt39zZk8/XRht4OAaBw4lDukG0gWZj/Fs+j3VutLxzJ5/B14fj4H7bjuWsjWj5yTpmMCXvBBFZx+SZOv7r/9/VArHnj78faMfE9Dkx6ueF0ZY3WfrCg6MtHZJ3lgTJO/XLEtgbx23wfnwlWlmYQaQ+OSbloL1wfihLDYYOFspBHvhM2lDmN9sXf6NNnRPtuTraUp57Xk/wQrug3AQtlOOkaMutHIPjnjq+vuKYHGtV/TVEXupM2rruEO1bl/Qjr45W1/QfXAsg6CHfnJtse5SF9sX+PD/9cWo7oX6oE26KeO0Z4/s4x9lus1y1LwPXKrO862IGT5IOKjq6VWZHUh+wcMe7zvsX2RfTTpc77YrZClKiw005YFUMLOi/Kbcd+2J+vlA/m+Cu5q3muS5RMfOSsy88Z5T1mq8n33XwBu+vs3sHQ80j5cjPYxajr+MHjj9zBuJgqXWIfoYj66nWDfmpbTW/PVqf6cqyUg7aC++p5T/Yajn6/GZZ6r5aD8xm5d/qN2OzvS86J8xc9edykXoNHRvTm5PtIm/kvZ6LWrb8vPxJOTLV89Mfpx6j/l5nOZHtdlbf8NhYr25wy2hBoiRpAZ6t4g6db3Kl/R1QdpMrx/yBd6dQxwSNfR0fWbb3sktLObTcpandSpIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkSZIkHTL/A/WL7h/txYA9AAAAAElFTkSuQmCC>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAbCAYAAABFuB6DAAAA5UlEQVR4XmNgGAXUBHxA7AnEslA+NxC7AbExEDPDFHEC8VQgrgLiZ0DcAcRrgDgaSs8CYlaQQhcgrgZiTSB+C8RzoJpBwBSI30PVMCQAsRkQ+wHxX5ggFNgA8W8gLkISY2gF4gdALI0klg7E/4E4CEmMOIUgX+5hgDieBSoGokF8kLtB7gcDJSB+DsTlMAEgUATiJ0A8nQGhGewRkBUNUD4jEDcD8RUgloeKgQHIfaBgOAHEq4H4IAPEWglkRTxAfACItzJAwk8YKoYBsLkPK0hjgLgvDogF0ORQACguYTgCTW54AgD8LykjBVdY8AAAAABJRU5ErkJggg==>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAkAAAAaCAYAAABl03YlAAAA00lEQVR4Xu3RvQtBURjH8SOUwUAGySAGZbaymSX+CcnMZJLsdoPJYrXb2UkpLCajgfLyfa5zcu6ZbBa/+nTvPc/TfZ7uVepnCSCBmFsw6eGGJwZOzZcK7qi6BTtdnJBzCyYRzLFA1F/6JI09hsijhpTdIJF9Hjigjya2qNtNso8s3bDOJsoaH8LMPtCRJnmzN9bsM7Ia4lhih6QcFHFR/vkFnDFV70le01FfTdq4omwOstigpJ8zWKOj3v/Ti9y0sMJYN8ibgqbBjnx1WTLsFv75Li9k8SOwWiXhbwAAAABJRU5ErkJggg==>

[image25]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFcAAAAaCAYAAADCDsDeAAAD+0lEQVR4Xu2YW4iXRRjGnyCjMNFUtPDQ4lkMtSI1VBA0PEBiUiK4lF1ohBrVRVGI7qLhARSPGCqKiCnihZJUkNh6AMEuBCEKQdArL8QbwQtvtPfnO+POzv6/XVfX3Zt54OH/zeGbme+Z9zDzlwoKCgoKuhL9jZeMDxPeMr5rHGy8krVdM4569KZUn7WdMvYMbQUJvpcLtDJvMPwob1uYNxjGG88a67L6ggRL5AIico4oLn1SvGBcbfwgqy/I8KFcQIRMUWe8rtrCjzNuNvbI6gsyzDI+MB5K6rDM9cZtai3ui8YNcoEL2gEJ7J5aikvdRnmsRdy0bbrxB/kGFLSDKO4ZecbH1bcbRyRtUdxXjXuMQ0K5oB28YbxpbJKLR5L6OrTlwpPYvghtzxu9jV+G317Go8a7xvfSTjUw2vhPIMfNiDnG28Yj6rjXcTJarI6/91jcv+XWesA4ILSNNd6RCz/cuFu+AV2BCcZdap6PtfylloJVASM4Ic8PKXbo6YyDTV6eVz4JXpMLi8BrjZ8kbVH4C8Y16t6jV5VgtbBfrUXkO88Zp2X1zxVYRpP8xHDM+ErSFsUlqeGWVUcv3uFjjsuTIOEE9JWfOjjm8S6b85OaBeImuMW40zjbOEjueguMvxknhn4gt7qqORERCych/yIfizFrWT4hhCPladU2HEJho3GfPDx1GAxATL0vPwmkiMITd+Pic9CHxRHT+AhiGgLyvFTu3uflGzXZeDK887bckl6Xi/yf3KoQYa58QxrkyK2uak7A+/8aJ8ljNf1Ye275bAjX9hjT16n1Ff4j+Qb/bnw/a3tiHJK7Uu5yUVwmrgrmBHqsDEt62firXBzGGmmcL7cuynzEV+EZT4hXbgThf46B8ng/VD5mFDO3uqo5QSpiDHlclFLLZxwS3tbQ/2f5RuVg/VOMf8rHeiqws1WJ4h25e1eBjYm3O9ya+DwslNmQg2q+PiPSx3IrvqrmzJ9uAMBK+KDoirnVtTUnIn4bnpkPEfGY1PL5XjwF8dpDQ2C3gA/FMgC7jwvNNM6QWz5WFUVcJD8jI25T+GUDOBUgyOdy60UgboXzjG+FMlb3mdwI2poTD4xteAbncsbA8hEZV0f0y/L5AWvAiNi8qcZPwzNzXZRb7wq1zEddAhLRYfnZeK/xD/n1GPdm0d/JExbt0fVYOKGGP382yRMpFv5NeCcmuVWhTD/Ky0K5rTmJtdSxWfxi/W/Kw0ij3MIZg/BE0sMrGDvmFNZzQy58P3k+Yq15PuoycBKIyeClUE6BBRMbc8QbYXyOcZ1f4nNVGbQ1J3MxZwrq8jXQp09WB+rlHgTSeQqeEVgr4SRP7gWdgDHy42FBQUFBZ+F/kM/CYYOZnmoAAAAASUVORK5CYII=>

[image26]: <data:image/png;base64,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>

[image27]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAD0AAAAaCAYAAAAEy1RnAAAC5klEQVR4Xu2YS6hOURTH//LIM89ICOWRiGIkUp4ZIElRxEAx8ApFJCkp5P2ITISQkkdeeRQiylCRAblKysDQQBL/X+vszvlOV93LZXB8//p177fP/vZea+211j73SnXV9d+olelpupUfVFV7zY+M9aVnldY8881MLD+osg6bBtOvNF5ZdTYPzSXTpvZRdTXCfDabTB8z20wybYuTqqY55ru5b46bheapuW46FOZVStQzTi9QXF2IU39v+qZJVVKq5yuqTeed5q0i3f+WCHCn8uBvqp2aUY7Fek76V41tvLmp2O9PhI0XFL2oSaKev6r2fh5nvphFhbG/IV6EKK0/Fdn4THGATRJp3KDa+3m7+WAGm+lmeTZOOs40Z80pMywb72W2mRtmg6L58d3zZr6ZYC6ag6arGWQOmXeKjMJ50hMNN3sUa7E3p8j+J8xQs8XcNjOy+csUpflJYdPobPyXaiyNi2MdFcYNUTi8UbEpdchGGDtQkaIYhHi+yqxWGPZGkcbotPIUJFAPVHs6vBVeUwSmi9mh+O4sc05xsxBQMvGq8rJYoWZkDAZ/VBiZlJzDWByfm42z+QtFRjCnh2mvqKViP+D3M4ogYAzRZz4G3jXTsnmU0x2Fc4ggvDT7FWXFyZJVvRUZ9UThLKIkuU7Zn8PCTgLWJGFMd9O6/EDx11axweBMubFxnb1S3g+SAcxlbRxOfWGUeaRwDpVPB4deK8+Yonh2T2Er6x5VfB81ljEtJlL5WOEzKUitPlZu6EiFY2QQBmJoOh0CQf+YaiYrP50BZqnC6OfK3wtwbqwikAQuZQyZxp4Ekf4xRXnGLFb0khYTjlDHS8xKs1uR4uvMSUWzoXGl5jbG3FIEB2HgAbNWcZ/S1PaZrdkcHFpjdimcPKI8YKzPWyLqby4rGid7EOiHZrOiHFpcqZbLLwHUVvmfD5QMjbAoGiBrIH5yOulzEiVVXot1iiXI/qnbI/aHuuqqq67q6ydOW3oOLy0jFgAAAABJRU5ErkJggg==>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEkAAAAaCAYAAAD7aXGFAAAD90lEQVR4Xu2Ya4hNURTHl1CE5JG3EiKRN0WYkkSS8ojyHTWURxFSI8kHkVeRREgijyRECpE8ShT5IDUkSqHEBxTWr3X3zD77nnPuOfeaMR/ur/6dmb3POXvtddZee+0rUqVKS6Szqm3Y2MLAPuysCF4yXLVQNVPVQ9Uqckc8c1S75P85qbVqnGqapNtA3x7V/LAjC+1V61WfVPvEnLRUdUP1SjVdkp01RnVLzKEO7n+teptRM+yxsmDiB1WHVffEnJBkK3RTXVVNDDvSIPyuqb6oJgd9DIbzfheu4eA495JqidfGPQdUZ1QDCv/DEbH3zCr8z9evUdWrJhTaymGS6oOqVvVddVrVJnJHMdhAAHQMO5JYofojNrHQCdBF9Vj1Q8wgHwZ7purptfH3WYlGlntHvaqv146RJ1X9vLa8bBeL2v5i0dEh2h0LgXFfoh83EYy8LeaktHV6XOweDHLg0GNiy9OHpbMmaBul+qo6J9GvjPN4vpPXlod2qiuqm5LNOT7MJbQnlt6qN2IOmBv0+TgncXV0V72QYucuUg0J2shvPL8haCc/LJP4CE6DpUqkjhSzn4/FXHhf1nfNFnu2ZBTjfb4CE2AicTDoKSmeJLsJSZdrKchHv1RTwo4yYUnvVF0Uy3PkFxJ3Hodj9zvJmA9XijkgXDYOl09I7CO8diKPhDnQa4sjKR/9C7ChXOe7VZS2ghogbJ+LTYQJheBxdo1wa+XlDMJgabjnM63/nGySbB8qDuekpBVUxGKxxBruXsASe68aHLRndVJSPqoUlwbuSnmJ3zlpbdgR0lU1VqwgI/mFE2H3o1CkTOCe0dIYDVmcxER4b7lLIg23jP3NJA+ZlxsJcL/YVsqyOC/RrXSY6rJYXUFIc/RwS45JE2Fs70nkzUd8CJZ/2tHCgW2cEOIigTlsEausieS4ZM58sJ9dLhVedkF1QuyLP5RoZOBlikV2DqryjV4fRjJI2pEibz7iI7A064L2OBj3Z+Hqg0N2iH3EoWJ2UxqEsKtRhDKPkrCrYRgiL/mRscrrQ77XXSG63GsDaqQnqs8Sffab6qWklwyrxbZ0ypJSRwYiKC5puwKTzYiitk+0uwEi7LaUHqdi6iR7lGSFIpUUkFZBu6SNM3BKyCDVXtVHsegMwV7OeHVBe5PAjvdUovVTpbDDcpiOY7zYePPEch01ng8Oo8B0GxCngbqG3kaw+0Hh2iysU+2W+OSYF0L/qNhvWnEcEstDm1WPpPhIgQ3kzVqx6ptc2ityh92zVeJ/1Wgy2IlYHgvCjjIgidaEjR6UIHdU18XObUng7KRcM1UsRVT8C2VeyB/bpDiJtjQoQzj9N7uDqlSpUuVf8BdaqcT2rBik+gAAAABJRU5ErkJggg==>

[image29]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAaCAYAAAC6nQw6AAABMElEQVR4Xu3UMSiGQRzH8Z9I9BIivUopg1LKwsSg9NqUUSkGg2yyMVmUgRRFycBgkdHGZsOiWMyMFlkk8b3+5O7ep9xjMfCrz/D0v+557n93j/RnU8AIulAR1ZLTgTOs4B6lsJyeJdlEy3jDeFBNTBMusIsW9KIyGJGYbjxgPi6kpgZtmMCrbDnuuc4flJIB7OASzzj4eO73B+XJvqxHrlc/Tr1st45QFdVypR13WIwLeTOIF4zGhbyZwaPs7MQpYg3HGI5qZdnAjewg+qmV7WAnhnCIan+AH3dJT5XdaDfxtWwjpvTNjn422i0vK33YwxOmw5L9HuZwgjHZRD3BCKkZV/ragAVlXOJW3MoO4Ba2Vb4s159VTMpeui5rQxD3RbM4xyYawnKQRtl9/M9v5h12OC5O7OpfuQAAAABJRU5ErkJggg==>

[image30]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA4AAAAaCAYAAACHD21cAAAAuUlEQVR4XmNgGHnAEYhfA/F/JPwLiHcDsTCSOpxgDhD/A2IPdAl8QBCITwPxAyCWRpXCDzSB+C0QrwFiFjQ5vCCaAeK3cnQJQmASEP8GYht0CXwA5r+7QCyOJocXEPIfGxCzoguCAMx/RegSQMAIxE1ArIMuAQKg+MPlPxUgngvEnOgS+OIP5LxZDBAXYQBjIP7KgOk/SQaIpkdArIgkzuACxM8YEGnzLxA/gWIQGya+nAF7gI2CkQgA+LEntuOlP9kAAAAASUVORK5CYII=>

[image31]: <data:image/png;base64,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>

[image32]: <data:image/png;base64,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>

[image33]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAA8AAAAbCAYAAACjkdXHAAABBElEQVR4XmNgGBaAB4jFgJgZXQIf0ALiO0D8H4ivArEIqjRhIAjEp4F4KRAzoskRBJpA/BaI09EliAHRQPwbiG3QJYgBkxgo9O8aIGZBkyMIaOLfDCD+BsStaOIoAJd/OYB4MxD7oYmjALI14wssaSA+DMRKaOJwgBxY6kBcjSTnAsTHgLgIiLcDcQIDWurzBOKfDJDAygLiCCS5cgaIzUJALAnEB6A0HIBy0Tkg3g/Ei4GYHyqO7l9jID7CgBkuDKwMEENANAyg+zcHiKcwEJlpQN7YxgDJ45wMEFe4AnEeAxbb0QEokGCJA2TAciAuA2JnuAo8gI0B1Rug0oULiT8KSAUAlpQr6cKen14AAAAASUVORK5CYII=>

[image34]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFAAAAAaCAYAAAAg0tunAAADPElEQVR4Xu2YS6hOURiGv5NL5H6IhIHLwOUURaFIyoCEkmIip5TLGUkuxeQoJopcohi4DEQuI5kpxIgxmUgkoiQykVzet28v1vn22mdf2/5f+6mn/5y19zn/Wu9e69trb5GGhoZkhsMhtrEGRsOJcCzsMMfahnnwIhxlD9TAVtHvvi56EduOyfAenGPaORsWwlPwLFwNB/Q5Ix9DYbfojLMwuMPRZ1vBkE7A3kD7PvgAThVdXlfgeTjIOy+NTrgRXoKf4CvR5Wr5pwHyS9kp36wd6YLPo0+f+fA9XOK1TRMNYKXXlgYDXAcXwGvSYgHOFl16d0VnBu2BG+As77z+2A/vSPzmcUTigx0BH4rWqyLF/rLE/6cjV4Aj4So4JfqdS4JXaA2c4E7qB3a+W7Tosn4VhaExvAMJ7XawHNx9+ASO8dqzUkmAPOEcPATfwM3wNtwGD8LPcMWfs8Nwed2S8ndMDoQD4oXzcUHZwSa1Z6WSAFk/tsO58Ivo8nNBuAFxWSXB2XcULrYHChCqc8T1ww62JQLcKRreevgdLveOsW59hLu9Ngu/4AycKX9vGCFtTQvBAF9Hnz4sIy8kPtiWCNDBvRU76de8tfCbxGeED7+AtY+F3N04QrLGppEUYFJQSe1ZqSxAdze7CQd67aFQLZxZnIGT7IECJAXIPrFvdrAuQPadY8hLZQGGlqrrnA01BGsoLQv3dW8lPFtZh9lHfzs0Dj4VvdAO7iDGR59pVBagq3/+Ug2FmgRvOlzGaXfrNFwgoYsxQ3SXsMlrWwo/SN8b2DH4S+JPMiEYIP9naOuVK8Be0Y5zAI4s9c+HO/yrost5uhR7Ru0QraX+jPLhhX4pusXaAp+JbtT5d45d8KfobiI0eM5OLvmvokHTH6JB7vDOyxUg65g9kTv/tPpn4UBYv06KPo6xnjm5v8wCZ9hjSd4Y8xmY+0TKn0NwIpyGw+yBHOQK0JKn/lUNQ3kk+Z5vLVzSfPFQhlIBspi/k3AtqgOWjxuir5vywgFfkPirsLyUCpBXn49wdjtRFywFeyP9+pYF3vyW2cYClAqQnR5sG2uG25A9cJE9UAPHRes2X3eVqaMNDQ0N/zW/Ae6rqFXMuNzqAAAAAElFTkSuQmCC>

[image35]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAaCAYAAADxNd/XAAACLUlEQVR4Xu2XT0gVURTGv1DDTIpUFCmICpLahVsRxT8gQUiroI3QoohqUWBR4U7QhQvFVboTUURw0b9lkRGBkqt2uRDatlAoiBb1fRyfzpzezJvR1wQyP/jxeHOGe9/ce86584CcnLJSSxtphQ9kxCF6nvbSoy4Wy0X6hf6mn2lDOJwJ+vEP6BJdpM/pkdAdJThBV+gsbLCsOUO/0rt0g36kx0N3lOAC/UZv+kBGXKdb9BJtpfXhcGk0wC/a5gMZMUHXaZMPJEUDZJ3/SlWt9Dm6TN/AUil1Iynkv4qn0sX+Jeo0T2F195Ou0mf0EVIW8P/Of+X8d1ga74mo/L9Ff9Bhdz2Oflg3uewDMVxF8fkTE5X/1bB+fMVdj2Madp6M+UAMj2EPfcoHkhCX/ydhxXXWXY/jGG1H8hzWnJr7LexNIDXB/G+hTwKxbvqB3qev6QDKf8hp17X72jmP5lJKvqAjiDjY+mAdQPl3m14LxB7CdqCONsNWSZ/lJK6B9NAhWCrP045QdBv13E+wHjyD3af0+a9O8R5/18l+CS6gRw+1ScdhJ3Tk2VAFexB9FvD5f4dOovwppAIu1kCEzol7dG3bVK8XWpFXsMJSQWo3tKUasNhkaTgNW5wbsAIutjCKKSs0v7rTAiJqIAoVbqH/a5A5Oki7du7YO3rjVKvV+FpZpYeng47CanKKdoaiCTiMcEop/2oC3/eDVvQlfQf78xKF5lcD8buTk5NzUPgDcvBbug7WYi0AAAAASUVORK5CYII=>

[image36]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABYAAAAaCAYAAACzdqxAAAABTUlEQVR4Xu2ULUsEURSGj2BQ0KKCQcNiM4pY/ACDRo3rD7CYLWrbYhBEMBtFLEYFEYN/wigYXDaJIGpQ/HjeOfeye/cDdwymeeBhhz2HM2feubtmBf/NLNbwO3iLI0lHyjJ+mvfq8xqHk44m9rGKDzjeVItowCk+4xn2puVWBvAYD/EVp9NyRg9u4A5+4WZabs8EHmHZ/BFX0nLGlPngbfzA+bTcnlXzTWbwzVq36ccKjuEF3uFoY0MnKriEk/iIu0nVbM28rsH3ljNfvTBtoW1OzDMVJdwyH6ThufPtM7/JTVDXGqahJW/NrnPnK7Slto0ZakPFIHTjP+UbUb7KeRH3zF+cUFQ6413nqwOvOCLKTydDA3TEIrnyncNzHGz4TmdYZ1nxxBco9CS/5ruAT1b/f3jH9VDTr+7K6r//A3wJfbH3EodCvaCgoBt+AHZzRnAvsxTcAAAAAElFTkSuQmCC>

[image37]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJkAAAAaCAYAAACkeP7MAAAFmUlEQVR4Xu2ZWagcRRSGf3FBE1cUQ1xwSTSoDyouKK4PgvFBH0w0bk+K+KCocV8ejIKgqLihgrhLFBeQ4Pag4AXFSAQ3jIILJCKIigqC4gLq+Txd6eqanul7u2dunLE++LkzXXOruqrOOXVOt5TJZDKTzPameabN04bMRLOJaUeNeO8PMn1q+sJ0lWmnanNmwtnMtNj0hOln0/UasrFtZ3rH9IKG3HFmLDnG9KvpjLShC/NN601Xpw2Z/yUjsYeRdJoZW0ZiDyPpNDO2jMQemjql6jjJtHtyfctCsJXpWNO2ZXNnGI9xGT9mrsrckfEYl/EnCebHvA4xbRpd5/M2xWcqwgNNC8vmodBkD60Y1Omh8oLgOtOXpkXF9a1NU6aHiu8XmP423Vx878qppsdNt5o+VGlou5rWmS4rvt8jH/fs4vskQCG20nSF6RPTeVEbe8Q+8KhhP9MPpndNO0S/6coge2jNkfJqIp4MEKXuk3sKm85vDivawgQxLtjD9JmGY2QYFMbLX4z7a9NuRdsJpj+Kv3C46SdNlpGdK58Pc2burAGwHy8X4jPR7kEN38jC04an5Y82OsGD1+Pl3vKo/BiK4bhaLp8MAzIwNwAsQmx0wGIEowP6Y8EYZyYQPc9U/WQx4tjoODK492B0+8ujG+LzuME8iSA7yx8hsMYEAdjb9I1KowPWn/UJaQtHKYaHw7+m3lSDtOJJ+Z5zQu1Vbd4Ae8BYt8jXOj6ypw2Tudj0vmmVaUG1uQI3wsauiK6xiWtVfWh7kzyHYGJM/EX5ZAi/bQgRNjyvST05XCPacowebLpUviBHmb4yHV38btxgf1LHTqN4uEYgiCGqYUjvqXTGADkue9504mCMrOV3pudN+1abZwYbcq3pR/km1XGK6XeVG4a3vCnPG4gkwELcr2rYxuA+UHsjw6PxJjwY0uMDcIC7VUaAkK/wncUJOeO4EXLP2BjS1AGuUa8jUQwQQN6S70GAlOYc09uqGmoKa/eAPBouTNpaE8Jwv0SP6/Hk6hJDog6vo2IGGRlHMEfCoDcMJP4Yc6im6O8X08kbfiEtKwREVXI0DD9EPSJuDAULkTY4RwpOt6fKSFkHDrWLuvVBCjEojQhzJRcOsB5T8jkA98H8QqQLLJFHrCmVa4XhnKUyPQqOW0fY39iZO1NnNDHkWXFE4bUDkS14GYZCNEmtfpCR3SGvClck12NYwDipxQvjShJjIXqmeQcwNlEtjs78jkqVew95TgrFD2P0S3qH0cci07dyx+2XE4XCKp7rGlXXg7a6gudCucNhlKEKP0L+fprfx+lGHU320IqmTvGUV00fy2/8WfkRy0LxQpWbxnNSBhkZ5/1fptdVemYK4Z0NJZo9J8+9ME4252HTS/KFS+F+n1KvETDOK/Jxr0zaAnj+b/KoXBepQh8cJdxfHaGPy9OGAk4E5sV9xFE5hrH5fwyNNX/DdL7pc/lePGO6Ub0nAQbIy22MmyCAMNDT5BGWIqkpH2uyh1ZMt1PCO0dcqDTwBv63n1cMMjLA2+5Vb1Ubw2KzSChsOhtN3pUuMGBgt8kjAQu9T7X5X8hHLkovbgQwmjrnjEnXmLVnD/odtcx7afGZEwhn4zv/gwE25WMwXXuYESPpVM1GRqRJ87guYHQ3yPtlTPIzNjKFMdMoN9vgALer/3HZliUqCwGiJAXdicV39qMpH4OR2EPotCmMThe8juOIsP6nvMpLPZZo9IjpgOR6F0IuFCtOnIHKi4qTEn1jslj+NqPuSG4Dke1O+YPpVfK8D6MiV54jrzZXm7433SU/CfoRqvihGlkoWblBjKHVg7cZQlg/Lr04C+Dd6bOj2Yb1Pl29VeF/AdKSlfJCjz0aKhgWZ/Vjpo9Ufb6SmXy2kBdTPPy9RPUVeyaTyWQymUxmzPgHLbMNKGceggsAAAAASUVORK5CYII=>

[image38]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABP0lEQVR4Xu3TMSgHYRjH8UcoQiIsTCIDZZDJKgspBgYDEyajxYBBJptkUDKIMkopklJSBhaLkoUkE8Ui8n16Hv9775a7jeF+9am757173+t57xXJk+dvUoE+dKE4MZY5+uIMrjGJJVzhHq3Bc6kpwiwe0OK1chziBnVey5R2vGBVbGJNDS6xHdQyZQHf6A1qnXjDVFBLja6qqz+hOaiP4QPdQS1TtnCGKr/XBTYl3i/dhA2sYAB7GPKxWKZxh0axiUbxJVG/mjDu1/NivV3EAcokkVIs4xG32MWnRP1qQK3Yi/sYRKVLjfbrXezHDaNfru0IextLj9hu1vt9CXZwgWqv9Yv1S3t1ItbbDoz4eCHHeEabWE8m8Irh4BmtrWMNR2InZE6ixQrRc3iOU7GjpLuoEyejX6NHTv3uep7/lB9hDDQyF185IQAAAABJRU5ErkJggg==>

[image39]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAaCAYAAAC+aNwHAAABC0lEQVR4XmNgGAXowBGInwPxfyT8Coh/AfFfID4JxMFAzAzTgAvMAeLfQGyDJAbSlMYAMagMiBmR5FAALxAfBuK7QCyOJicJxA9xyMGBJhC/BeI1QMyCJmcKxN+A+CoQi6DJwYEfA8Tv6egSQNDAAJErRhNHAZMYMP3PCsTJDBCXlUL5WAEPEB9ggIT6MSj7OgPE1ulALAxTiAtg8z8otCsZIKHvChXDCWD+L0ITNwbirwyQ6MULsPkfBKIZIAa3oomjAHzxDzIYZEA5mjgK0AHi9wyY8Q9ir2JANaAaiF1gCmwZIKkLPf2DwgMGQOkfFIggg2KBeDYQcyLJEwVA3vJlgMQEyZpHwfAGAGlHPJOLUE8QAAAAAElFTkSuQmCC>

[image40]: <data:image/png;base64,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>

[image41]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAxCAYAAABnGvUlAAAFg0lEQVR4Xu3dW6h0ZRkH8CcyKA9pnios1BJMVCQ6GJ3QDmIXdVGQSnUhgoJ4oIK0CClCIuoquqiI0ouORCpaCkXtEDLwLgqjDCzKLqILo4KKsPfPuxZ7fcv5Zs/sbzd7f3y/HzzMrHdmz553sWH+PO+7ZlcBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADAMes5rU6eD27QifMBAGD/PKvVKfPBY9QLqwelg+BLrV47H9ygs4cCAA6Ad7d643zwKHNJq7+1Om44fkmr39R6geOkVt+t7dfYT2+vxd21zDHvMTLHn9d6czycG1v9t9Xds/EvtLptNgYAbFiWvbbqYISUI/H5Vv+ZHKdr+HSrGyZjO3lX/f+D6yrh51WtfjsfHGSO43vMHL9e681xmd/XMwPbC1o9OhsDADbsglZ/rb4U+M46OMuB69pq9avJ8bmtHqvehVpVQt85rV7d6qWHPrRnVglsCWAPzwerh+vM8fThOHP8Y603x2UWBbb4SvVwuK4rqodPAOAIJaRkKWz8QM6H9n55qNUfltQy6aY9Xj3o/LnV2w59eCUJrqcO93MeVglX61rlNbda3TkfrN4BzBy3Wv2z+hyfPX3CETpcYEuQf/F8cImPVA+S8bw6NEgDALuw1eqeyfHvhtvTWv2legdumbNaPTkf3AfTpcLM4f7JY1P3tbp3Pjj41+R+Qt+HJsdzbx1uc46ynPzZ6nsB59KxTPcygSf1qcn91KLAtVWLg13C9TjHc6rPMYFoLuF7+jvmdTjLAtvL5oO1/bcyl3OSvW+RJdUs2wIARyAhZQwBWb563+SxBIRVLOoG7UZC4jxcrBI0EiqnFwtkz1UC1yK5OOG8+WD15cZxM38CT14jYWMnPx1ucw5Xef6iIDa3Vc983rh0Pc4xvytzXBSkdmtZYFt0/t88H6h+7qbvK39Pr9l+GABY1xhSEgLGiw+Orx5osk/qPdU/gLMUl2Dyola/rh5O8lh+Jvfz4Zyvn/heq4uq7x3LFY55TrxjuL2j1bdaXTYc74W8v3RzphcLJIQmfJzb6ouT8WWmFxwkoOT+m1pdWL1D9OXqHbSvVQ9945WZ4/kbw95O5kFskQTl78/GMsfpRRWvrz7HBKnM8bmTx3Yrr7eoG/axWu/103lL5/Wq2l5uf12rB6u/zuG6nwDAAgkdNw3386GavUdj8Bg7RgkjH50875HqS3zjlYPZR3VC9bCXbkp+LuEuG+c/UD2gjF9P8VSrV9biZcDdyIf/36vvX/t3bS/t/qjVP1p9tVbfy/aJ6vOKnJcHqv/8ma1+WNvdx8wt4W7sdGWeCbc/GY53skpgy+v/cnJ8V/U5pjLH51c/p5lj3tOqc1wme87G3/GLVhcP4+uE0dGnW/2pejgfQ2YCW85jLpDIV5EAAHtg3L91ZauXV+/kJNRl/Nrq+8Cyf+oH1b/D62fDcxIoEiKmy6kJQNdV78h9pxZ/v9hBlq5T5p6wmsCZwHF99WXKS6uHtsx3p/1+kc7YTvK7stctt/vt/a2+PR9c4g2tzhjuf7O2w9nd1TuU6dbt1RI6ABzzErISxNIlSZfl460+U31J8IPVlwg/V30T/9XVO3D5YH+ienDJzye4paOUYHfZ8LzL6+iS0JSO0y2t3jKM/bjVK6rP8ZOt3tvqG7W3X4mSTlSWY/dbAvk6/20h3c3zq5+3dFTHCzGyPJ5zlH144xI5ALBBWZq8uXpg+fDssaNdOmhjx2jTEhBvnQ9uUL5Hba+6fAl+uahk3NcIAGzYuIR3UJbx9tI11TuN4541duf26n8fAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAALAR/wPML80/CldnbgAAAABJRU5ErkJggg==>

[image42]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABcAAAAaCAYAAABctMd+AAABc0lEQVR4Xu3UvytFYRzH8a/8SPlRElKKBYXN71ERBiWSwWgxKQb/gJTfRTfJopTBhLDfslmkDAYGA6NJZu+v73Nu9z7Oua6LMtxPvTqn53vO9zz3Oee5Iv84LVjEsjv/tbTiCOVoxD16U674QXrwiE7UuvOplCvINC5xhT3ExWZxjlc8YU2sQVSGcIM6v6DRG3XtNDNod+el2EQH9tHlxoNUii3NLfq8WiJRzTWT6EeN2IOKk2pBtHaNcb+gSdd8xMkT+yqC5WnCGArFfmEcFxLy8HTNRzGMCqyjxI1v40Fs1mVi703HPiWquc5Kx3XNN8QeFETHDjGIWbHmX77QORzjBC94wy6aXT05+nCdeTXyvVoi/sx1GXZQhRU0uFpW8ZvrsgxgHm1YFZtlVglrXoAlsW9bN9qEq387Yc01+oJiYptFX6i/iTJKVHONzlhnXo9Td8w4eqPuruC/RY93WECR2Fpv4QBneEb3x5255JLL3+YdxPhAt79TKAQAAAAASUVORK5CYII=>

[image43]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE4AAAAaCAYAAAAZtWr8AAADDUlEQVR4Xu2YS6hNURzGP6EIed1ITDySx50REZkYkKRQTOSWQkYmmJ7BNVFXeQ4MPAYiMSQDhUzImEzkkYiSFCN5fF//s2vtddbee+19zrn36Oyvfu1z19p7r72+vf7r/98XqFWr3zWOzCbzmkf9PZqagQpj6yIxlppK7pLr5BiZlO7uug6QK+QW7FkKNYEcJz/JPURe1AVp3Guwt+5Kb38tOUsukm1kfOqMcppMhhBeKHqG4eYxWifIH7LZ7xglhYyTaXqpj8lCWBhpRV4iE53zijSL7CFXyTfyDq0vSKpk3CDspudRIsYD0qB6KJeYBwkZt4p8JhuctkWwiW9x2ook43aQ1eQmOmyclvB98pbMT3dFaQV5SB7AVoQ4QnaT5c55WQoZdxKtk5xGnsD2oyovWGP490xUyTjpEPlL9vodOdLDD8E21QXprlLyjVNyULLwJ6nzHpHnZKbTHquuGKcw+ERuwJJGjBROd8h0v6OkfOMSg/xJZrXHqivGyazbMPNkYpG02k6RdX5HBfnG6agJ+pPsSeOUUT/CwlVhWyQNcIEsgz1IFjE1mW/cXPIarZPsOeNUHz0j62EJQolCCSNPGkB7mzbqJCGE2JpckCPfuCyDstpj1VHjdpIPZA0s/FSSqDQZdE8KSCtJK65KFvblG5dsG/4kE+OUWZVhy6pjxsm072SX06YaScWwiuIiKaRjwrpIvnGSxv+KdDkzQF7AviQSqRie0zwWqSPGyaxfsOpcKy2R0rzS/VMUZ0v1K1zb/eIIGbcEFgluebSRfEE6IY3A9uWG05YljaF7hkqnKOOWwqryBsJvqgFbdTEVuipzlTAK28Wo9i0ZMk5SRLwhB8l+8hJWWLsv+ijsWVV8hyat1ajQ/gEzWPyGGXjYOS/KOA2slZU1SbVrwNybONL9VNOdIa/Ie4d9znlZyjJO0jfq9ib6HZJC+ByZ4neUUJRxvaY842Kk0NWW0476zjhde5ms9DtKqu+MU9bd5DdW0H9pnPYm/ctHe6KO7exVVXQaYzd2rVq1avWE/gHATaCsWzcVlwAAAABJRU5ErkJggg==>

[image44]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAbCAYAAADh0qZQAAACv0lEQVR4Xu2WS6hNURjHP6HIOyJRHmUgCil5dkfEgGKkGDMx88zoTu5ISjKSuiMDj4GSx0DuDQMxMBKJQiImSijk8f/59jpnn28/7jm3c2fnV//2OWutvfd/fWt939pmPXp0zFRpUmxsg1HdN06aLc3PrvyHKdLENCiwWhqUZoR2xs/NrlUskq5m17bok15Kf6UP0m/pk3RSeivtbA5tsFAaklbEDrFcuif9tPJ7E1uka1acZIE10mfphjQ9axsv7Za+mRuPLyLKZ6T+0J5ngfTa/LlVy8pzzknHY0fkrLmRPbFD7Ldykyul59m1imSAANSN2yA9k5bEjgT77Y65EfZW3EMpGtEkM6+LUGK79MfqIzVLeiztix0JZos5TKIn0jHzmWMgJVPeDL8xyH4diTnSU+mh1e+7C9JFayZrga3miZKM5nVdWtwY6ZD9b6wY3SoGpB/my1oFkb4vTYsdCdwfsmqjL6y1TKyVPkqbc211MO6XudkqmDATJwC1MOCgeUn4aq1GSYC0FJikLHEdCfb8oHkAWHaWvwxMUvqWxg7gxRvNEySyzHxDY3LY/ISAdk2yBy+b7/ET5glEIpWByS/SqtgBvHjYPIJlUJZGYxKDt6Tz5hWDRKQU5VckT+1yJ5OcDmXZx82YZMnSw1mS99KONCiQDFLa0jMnS7fNy1nZqlF+XknzYgckkxh5JG2yZq3k7L1rHoF1WRukslIWfUxhLiYbYIT37A3tQDmrrLuYHJJOSael79aaMJznfY3RTqqtnFQRnkFEOLsjnCjvzCNKZBMTzD806gr+/9rEWZ2YacUvoQjRIPKcFnmIRNq7ZdDHCuXfh3mOxbo6OiqYwAOrztZO4PvgkhWP5K6wS7pirUvXKUz2prXu+a7CVjiaqWpb1ME9/dLh7PeYwRIdkdbHjjbYJh2wMTbYo0e3+QervYwneDGhPwAAAABJRU5ErkJggg==>

[image45]: <data:image/png;base64,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>

[image46]: <data:image/png;base64,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>

[image47]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEEAAAAZCAYAAABuKkPfAAADD0lEQVR4Xu2XTchNURSG3y8UIaRIqEtKiiIiMjBASX7yE2EiA5IyECIDJYXIz2ckJQPJT0lfRsQ3ohAlmUgiUYQUpeTnfVtnu/ts5+xz7nfvxeC89XTPXWffc/Zae6299gUqVapUKa4aWR0aPY0nh8gpsob0S98upZVkFhlAOsgwso5M9gf9bU0gm8lN8p2cTd/+reXkCWyycmAfuU4G+YMK1JtcJD8DLqGx5xRJc1wQGmNSEJbCVucVsoMwmjwlaz3bEHKPbPFsZXSaPCYvyWWykPRKjWheG8nO0FhGI8gLZAdBzn8hUz2bUvkc6YZlRll1Iv2cVqsPLNtaHoQT+DMIksa+IWMDe0yNBkFODSfTyZzkew2WvXqOn0W63gora5WrfNKeUzrTYkGQLS8IWfaYTpKj5AGs/O6QKakRadXILZhj78htsgeWnQ9hJTkqGbuBXCE/yH3YBn6ADE7uFyovCEr1bmQ725MgnCG7UF8ddYYPsJWOSe96C9vDnMaR16QL9U6luWhOLS2H/uQGsp3tSRAGIp2eWkVlxHlY98iT3qX5aZ5OHbDM+kZmJ7a2BEHKczbP3ojce5/Baj9PWUGQ5KzarOtcbQvCfmQ7q7FaRVeTRVoPq9dNns29N8tBX0VBWJZ8D4Og8hmZXBcqFoTFsI1prmfrS64l6FpSmms3dt9DuQn7QXDl0I14q80KgspHZfSRTExsYRD0uSi5LpQLgnp/R3BvKLlL9no2bUqavH/M1u4sJ/PqeyashtXmnFaRr7ATaUwKgpyb4dl0Ldsx1Oesdq22reyVdsPeG5VWV85opd0x9jN5RCZ546aR52QHWQFrTQeRdkgRl0Oq7zBtJU10G6zlKWA6f7yHHdvDwIdSELTiV8kF2FFbv92O9BzcOz7BTqRHgvtNS51iPuygoqN0llQKnYhvcvqtnqFnlf3P4JeDykafeWUnaYwyuCi4bdEYchjZ5dCMsvaE/1LaGBWAeeGNJqRU1u7eBTss6VAV20D/ubRKS9DaFKyR47AjsKOhv8mVKlWqVFa/ADuUrcBz3WgHAAAAAElFTkSuQmCC>

[image48]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACMAAAAZCAYAAAC7OJeSAAAB/ElEQVR4Xu2WTyhlURzHf0IRIsqfmhosRnYipCgLqakxG0pRVjI2JptpNra28mehpGSt2FjI6slGNjaT2YxEZCFLSjLm+/W7983vnvfuuy/v9Wzetz69e37nnPu+55zf+XVF8srr7SoFY2ANzIMPwe7cqR4cgEVRE1/AOei1g7Kgz6DNDVoVgXXwG9SZOHfnCFSaWKZaBkNu0KoV3IEYKDdxTvoLBkwsE9WAY4kw0wHuJbmZF/DTxKxKQAPoB92gUHRhI+ATKIiP1HxcEH3fhOg8mrNjXhVlhkeYTJz3S3TMpej872DKa2+JHjFN/wD73lj+8pIwxr6AOIG5cQgqTJw5w8mbJuaK5mPgBNSaeB94FL0Q/ur9xaU8JmoY3IpuN9UomtDpmiF2V3kse+AGNHuxtM3QPa/zH3ABdsA3SZ0zVJgZiot4kv/lIW0zyUQzUbcpyswD6PTarpl2UO09BzQjmjMfvTZ3akOi60yYGT8Pbe1yzayIXoIEcRVMuB6v3SV63l/jI5LLN3Mmmme+RsEzmDYxHhePbVy00C6BJtMfF//0FEyCOXAlWg8S6oAj3wxzjQnLRe2KFlEasvOLwSq4Bttg1ukPiNvJLRwEZU5fmNxjqhJ9D/84TBxDsi7XzLuJ1bNFtOARPidU1FyJnwIs65aUnwd55ZVt/QNmS2pKJ40/9gAAAABJRU5ErkJggg==>

[image49]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGgAAAAaCAYAAABb9hlrAAAFu0lEQVR4Xu2ZachtUxzGnxvKPF9DpnuNmcmUucxDhgwZS5fMU9wikm5JITJniFwfDNeYDyjEubkZC8lFhgwpUXyiUIbn9/73stfZ5+x93vN6tQ/3PPW0z57WWns96z+tI42xxGIV89ziOMYIYnvzDnPF6o0xxljiMNO81bzQ3M68z3zI3Ng83XzePN9cxpxhHm0+Z+7Ay8Zs82HzOHNPc4F5i9p3f1uYN5j3mieby3XfnhSON/dQeAq+fS3zVJXfnkDb9EFf9Enf0wY63Nv8xDxWMZDLzQ/Mjcw1zJcVbm1L81DzSnNe8SzCHmR+Zu6uwIPmEcXvNsB3fKiYSCb3GvNFDbdoljYfM/+s8HF1t8Nv2qYP+qJP+mYM04LNzEPMF1SulAfMU4r7WNKr5nqKFbShwoL2UnwE759dvMO7tEFbB/ByC9jA/FTl+MFq5tvmBdm1yQBvwkL92nzCPNxcquuJWMy0TR8J9P2RuXZ27R+BTq4tftMRK2Kn4vxEhQtDDICV5KuxKug25kJzzeJ8skBYrJX2mrBs9UIFjONnleMHtInb7mi4xOZ2dbdTRRIej5FjF/Mn88jK9UYwyFmKGLKPIqaAZMqpMQa0SDHB6R4i4QqJN7cpBD1MIUZV0CT2/op+BgGhH1XpQr43T1LvSgUrKeJhExhfVSDAJH6r8AiTxSCBcPk/qFcg3mEMadEPBGLcaT6iCOZXm08qghtm+Ipi8gFiJHeFQPebNyoSBq7dpBg4sYdzYhMuL1nUXPNm82KVi6AOvH+9eabKZxnHU+Yb5lbFtQT8OvGvCUxWnUD9rjeBUoJvecf8xnzd3DG7n4SoE6h6vRbEmNcUq51JR6jFCithklYoH524n9wZYCWzchN4nnOOgPvLl7cnQHvpfhMYzyXqfZbz/RSx5F1FdtRRiLZ++VgPcF8d9RdiKgKxUK9Qac14kR/NXYtzEiGsvirE0ALhdn41z1L4+W0Ltg0seFb1YgasCqGwGo6DLJKF8ZL6CzEVgViIuatlcWBJLHAWMRnttAh0oPm7Sj9PzJjZ9US72FkRh7AQXOPK3bf/BgkCmVQT6oSouz4M1jW/Mj9XhIY6IequN2JT8zJF2ohIl3bfbg0kJ9RgFyniHx/1nfonCqTQg2IQgbmfELTL6m9ykTnmmH+Y52TXkkCQ3yQcJB5VIZJAg8Y64UJIBpgAahiQUkNql7aBS6Lyxu3mYBKfMd9SFNFMBkfqMY5NQHC8RV6HYXnPFkxpOuIzJ3VpO2GBhZwLlFxcRxHvUszL2wX0/VtxbARmSKAl2KWtDird9xQW1TYYH3GxH5hA3BmZEysZyycOzcgf6gPERth52TW+lYnFQhPOUAiQ4kkV1HtkcXncO8H8Rd27BCQOFLKzi3PGx64C7nrgzgUPkyVhMWRCmOKb5r75QwVIae9RDIqtm9WL66yalFofrNhRoN3TzPmKjOY6Rf2xTrzSOohpXyhcOmUF3086n082GRiTTTzBQqvgG+cqShDE5Puoec4r7iXQ5l3Fc9SYiLNYvft1jcD8GMSq1RsFmGRqDxSn+GSbgiKMnH+hYuIR6mPFFs/WigyG6hzhGeQxKuunUQDuk4XGpBG7+oF5YeE1bcnwLm3QVp1F8M2bKxZDvgkwLUh+NG3VIACiUCNh/mn/CsFwN3wMvnsTde8g8H5Hw22ltA3cEkV4Pxc3MmAngCQCAQDJA+aMxb2v2FcCBF+2fdLHIMwilcUu1sN7/xUQ4xCHEmSkQarILgOCYJpPK6yB805xRABiE6n5HIUV8Qwujnu4geo2yKiD7zpKo+OSa8EAcWMLFLvWXyqsCUsh4F2lCLAUklhJ2prhNxZG/UIcIsMa418G7ow/5/L/Ngi2KeilPbZ8B7u6HTLGNIIsBpfGzjQi3K1ILQdhN0WeP0rbRf9LYA0Ef1wZZOIH+WTSbbZhqA2oCUY6AxpjjCnjL0rVEKR4uFGdAAAAAElFTkSuQmCC>

[image50]: <data:image/png;base64,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>

[image51]: <data:image/png;base64,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>

[image52]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAaCAYAAACD+r1hAAAA1UlEQVR4Xu2SPQ5BQRSFr6CQSNBodAqVWqFWSHQ0dmAHtG8R9qBRiyUQm1AIUYlCJcE5rklmxhuPQqLwJV9z7/yeGZGfp/jwLTJwCE9wBvNuO8wIXmDLb4SowwMcw5TXiyUH53ANK24rzABeYd9vhKjCHZyIhpEIB01FJ3FyIkxoK3osHu8lHbiETdGLMwAGEUsXbmBDNFJGy4gZ9RMcfIQ9q9YWfUQ+pgMHnUW/hv1YJbiCC1gwxRrcwwhmTdEiEt2Fu93hilwpbQoerJflg8/45/vcALruH5wG+666AAAAAElFTkSuQmCC>

[image53]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC8AAAAaCAYAAAAnkAWyAAACoUlEQVR4Xu2WXYhNURTH/0L5TKIkSuRFlAdRapTP4oFEaiQ1bzwoRfE6kncjHkhppkTySuLBlZKa1wmlyShRhNJ48O3/n3V39qyz97nnzh0f6f7q19zZ65x711lrnX0O0Ob/YzKd5RcrMNbzxg39+Hm6xq1PoHPoDLceo+RP010+0IgN9A39EfmO7qdz6T36LYoN06t0uk6uM4meowejtYCS7qFf6FnYsSl0gTdRvPhKXKTf6WYfgK0pdglWSc8WWkO+9TpH576ly1wsZiu9jfIuFZhN++kQXTA6NMJxWNX3+QCZSm/RQz7gUGIqQNlxuvgHtNMHylA1VJXrKLZV/2s9V7VV9CnSsZh59DGsQ2WVPYV0HllUUVVWFfaoE0OwzqhDngP0Pp3pAwnO0E90rQ9EbKPP6UIfyKEv/Up30vnOPbB265gUvXWr0AG7cbvdeow6+YKu9oEUYd4/0j56wfkM+XlX+2uwVlch/Faui0IFU+W3+0CKVuY9JJ8aN492nC76AfldTYTkU8UqEOb9iA+g8bxXTV6Ja5e5QTfBuqw9P7XthuRT+RTQ/q451Dx6wozm5r1K8krwKH1EF+HX1qqdRzuQp/LYtLK/izBWKkCKkLie4PGTU13Q9+6I1gJL6EvYrlOK7my1MDXvU2Bt1oyudLEYdUXH6fgYJX4M1rndLqYEX9ErKP6udplBpO+xEXSz6Ori95nXdC/sHeMO/RzF9PkynaaTHareAOw9KGY9rDBdKM62Elbi7+kKF1OXayh/kI0bi+kTFO+ZibCx9IkH9CapmY87Fi6qO1r7rSi5k8jvHs2wlD6s//1j6FF+ly73gSbQhZ+A3SetFqFptJtcQ/61uBHrYBvHWM9vmY30sF+sgLZpvWL8tcTbtPlX+QlXJYz+zGFhpAAAAABJRU5ErkJggg==>

[image54]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE8AAAAXCAYAAABK6RIcAAADBklEQVR4Xu2YS6hNURjH//LIqzzziBIxEEUpj5ISAwYkUYShTIzkUUopmUsGkhISxUBJKcrxyICRIhI5JIVQYuDt/7/fWbV8+3H2OafT2Y7zq1/33vWdve/d3/7Wt9a6QI8e3cBIOtwPRig22A8WYAQd6Ae7iVH0Hj3pAzXm0hOwRMQomeNofzceM5+eQfLaUrGUvqO/Iz/QLXQsvUF/RrHP9BwdRufQj3QDkkym1+ksHyBL6GPY79U9sthMj+IfqMDj9Bdd7gOwMcVURf2i8U20SidFY0KfOUT3u/GYefQLPewDEUPoJbrWB8pEmH5VJBMh9sCqTsmKUcKP4O+EitmwytLXLJSYK/QRHe9iMarqOyjx9J1J39MLdICL6WeNK67PBZTwCl0UjQWU7Muov1Bsh72U1T4QMY0+pYt9oCyoovQQemiPKrEKq0wlLKBEnoZVUIwSpsTtdeNphJd2FsmXFlBvvYZi9+sI6js/6Bo60bke1u98b9JiMsONCV3zgq7ygRRCVb+iU10sRqu5Vl7fHjpO6Hdq3qfoMedzpPe7LLQQvEHxaRaqPu/+mhEV5O8nR8N66MsG3Nd3ZQs00+/yUPL0h+lrPSbApqQqO69HKnm+bZSC8OZ3+ACy+10eRZOnfeAtWFvQFkj7xazVWcl7hvxVuSNou/Ed6dNMY4r5fpdHkeRNoffpblgfWwGrPq2+aRSZtrrPGCR7dp46WjZNs/u7PLS1eE1X+kANJe4BrJ+Gk4MqSvu9CtITdBA2vbXyZqF7LaPrGnBB35VNEnb5af0ubDk+If8I5dEq/JBu8wFY4p7AEuE3vUrQVyT3jaoorbSNVH9b0XFL1RHOq/It3Qgr/av0WxTT93qAobq4DnpY9TD/sIPoRXoTtlB4lDQlz59YNDvuIn8j3VXoSKUH9otMvX9PqQfp5cXJU1I1pfP2gV2FEnAbthC0gpJ4oGbpNsjtRNPsPJLHt0aYDuuP6pX/FaqUXTWbqRqtnuqdpf53VDtRAnbShT5QgK1ofdr3KBN/AMpapOu9rJB8AAAAAElFTkSuQmCC>

[image55]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAWCAYAAACosj4+AAABq0lEQVR4Xu2WPShGURjHH6EI5StSFrLISEmRVUnKwkYpyWTBamBkoAwGH4PSm9VmIKOZTSILJYvVx//v3Mt5n9t1zz337X0Xv/p1e59zzzn/95z7JfKPG2WwCbYFR/4uJvXyO/c3tfAUHsElWBU2FIlZuA9zYYGBDsWktOFK9cMtuANHYXneGemohjNiVkTDDGv2Dx2IYZbhBewQs5xcwV1YaZ2XRCOchAfwFd5L9I+TxEC98AkOWrVOMQOOWLUkGGgc9sFjyRBoXaKd6+ClmP32ufA5hx4z5M9AvKh5kevOPO8cXsEGq+6Kd6BwYt05ru6KdyAe2VF3LlmgVngr0c4lCxQ3cVzdFe9AFfBEop3DQLzTeMelxTsQWYEvsNuqNcNrMU/uED4kW4JjEpkCdcFHOGXVhuAzHLBqG/ATrlq1ODgHx2zXDeIQiEzAOzgHp+ENXJD8h+Ii/IBnYsbRcPW4xW9igtN3McHmrfOcAhG+w8YCfz4PFNzKbVijG1LgHMgFbiFfxFkoWCD23YM9uiElBQvEu3BYFz3IC8S956fBQ3DMci34sCnB3F9uK2ksJNLJIgAAAABJRU5ErkJggg==>

[image56]: <data:image/png;base64,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>

[image57]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAZCAYAAABzVH1EAAACEElEQVR4Xu2WsUtcQRDGJ0UgIQEJgjaxUESxSsRISGMlgoIS0EKif0CKtFGwEsRCyzSBkMbCP0EbAx7YiFYWapFCEEkqrWKhkJjvY3fN3tzNvYGDwMH74Mex35udm3lv374VKVWqlFePwTvwBayD/urLbnnz0Od1xjGe8ywNgjFt1lMb2AEr4Cl4CU7AdB7kkDcPx/R5nXGM5zzOT3oNFsAhuAOL2TVTDOKEZ5k3B05BZ+YVyZOnC3yPfhLjOe9D5rGRSTABrsXRSEqyofxh8AtMKd+SNw8bYGFD9xEiD8AmqEh4QrkY52pkAFxKbQEpwaryLXnzfIrjvBGK836CHuW7G0mBVgHat2TFa5+/ViP1fHcjXId8mYoKKJInD5dNJY51wU03Mi7FBXjkyfMEfItjXXDTjVgFW74lK177VsGW726ELxdfMquAJeVb8ubhS1+vYM67AM+V724krdst8CjzR8Ft/E1ibLuE7VLLm4fb8O9sTDGe8/Rcyt0INQ/OQXccs1B+bffl39eWDRyBG/AmelrePAdgOY6pXglPYzbzkvQTbaiH4DPYBW8l/PmxhCNEEu/4NvgDPmZ+Lk8e6hU4k3AEmZHwIV2TMD/pPfghYQNJXIE90JHF1Yh3r09C4hGpTpqLSyI/Smh583AH40GQDfPY8t/Fu2gtrZbRC/BVGh+5W0L8euvtsVSpUi2gvxfdnAw1oeQKAAAAAElFTkSuQmCC>

[image58]: <data:image/png;base64,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>

[image59]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAGIAAAAZCAYAAADKQPsMAAAEiklEQVR4Xu2Ye6hmYxTGH6Fo3Eck5IRIRpSQ+/nDJUoJIYppxJSUy5Rb5Ai55H4pSa4Juf8xTSJpphT+UCLlUsglhBIKuTy/WXud79377O+b/c0cM8fYTz19337ftfde71rrXWu9W+rRo0ePHj26Y8I8vTnYwIbmqQrZNuxgXm0+YF5r7l6fXolNzTMUMnebRymeOw42Mc8yF1T/uX8n8zzN1G1P8xbF+5YodJxz2Ms833zN/NN8tD69EhjuBPMu80vzF3P/mkTgQPMV83BzX3Op+bdi8RtUMluaz5vnmruZ1yjeu6ya64qtzDcVzy95q7lxIXey+ZxCH/R6x/zdPKmQmRPAESeah5hfaLgjjjMnFYZrcwQyL5qLNIju+eZbqstfYD5mblFd46DrFEa8rBrrgs0Ujn7P/MR8xDxIA4eD7c0Vih2X4+zQr8yPzJ2rsTkFtutnandECYzV5oi8/ydF9CWuVBj5kuqa55fX4ADzV/NVc14xPgo4gmeNSjPoiK44CqcAHPKEQgeCa85hTR1BOiB1vay6cZAvo53d97559LTEwGCvKwzcBV0cQaojLT2s+nMzGEi3bSDt7aKY31FRgyara3Z5gjXjYHSA25kbVTLl2Fj1b00d0QaUelZRAybrUzWcqTDMbc2JEcCwT5u3K9ITteslzSzUTWxtvm1+oyjibbhYMY9OpNYXFDreqFg76ZWdNaF458+V7BsKxz1TXTP+lMKxnfFvOIKcjSzdSllASxC1y80PFVHYFTiC3XeawiiQWrOq5yBPYFyqej1pIncpxT8jOt/B/eWOnlCkv1znQvNBRd0cG7PtCAxMzn9cw/M+C8MgHyuahnHAvZtXv4msNVPFWAkc9IFiflhgJNIRzQaCdvlHxU5nxyfozpCnJj6p8TrAGmbTESzyfkXaGBUVKE9XM9EYX12k8dqKPoZZal6objl7mCPSTqQ30lyCgLjT/Ms8vhgfG7PliHTCFRosmGg/ZloigBOWmdtU16Qa8jCFsQtuNv9Qt6KfTsg0Bo4w95uWmIlVOYIAYkcmeO5VGgTCOt0RKLNEUezKlLFY9QMUBz9ayFJZnEXXlffhUDqOYSkEPZu5OlMTXVL5HCK1eYC7XiE/DMMccbD5m3mv6msksO4xD1WkLmpJOd8Z6QgMNOoBKMZim4vgnoWKOQ6Gnxf8wTysksPg1IRvW2RuqGQAHRSdx1QxVoJPMZdroCu/7EKMgKMBTphSGK58F/p9au5aybUhHYFTMxj45fo7c+9qjPceqzix84kF0FURJDinMzh1ohg3svBsu94196lkyLe0YRgrZSAnVOoASEeW88mvNVg0kdycT5KaEhcp8i3bvO1sgVHuU5wTzlac1r9X/ZCWxmy+BzZzfBN5L59++GxDR0SbTDu7RyVDui3txiEVW6FzjmEzbPyfxraK7d4svAmiEaOcojindK0vXVCmJmodaXK+RmeL9RbkY9rbdYFhNeJ/B9LRQxrk4rUJTsJ8zqAru0Or8ZlifQJF/cjm4FrCOYqakLxJY36m6NGjR48ePWYD/wCmFhnXOY+gdwAAAABJRU5ErkJggg==>

[image60]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACEAAAAWCAYAAABOm/V6AAABiUlEQVR4Xu2UzStFURTFl6SIohQpRfKRIkooUQbMJcXURDIw8Cf4CwxlIsrISBkYSK83komSUiIRGclEShJr2fd45x6kx+vq1Vv1696zzz73rLvPB1BQQT+rkUyFwSTUTubIHnkha/HuZCQTY2SAXOOfTDjVkUvkkYlSWP4w6SfFsIpOkFZSFOXpWR3lOjS2wmvHlI2JHnJMXskVSZF5MhO1N0klbMJFchPlPpIhMh21tQdjysaEpL9JkUNS48U1yRNZQqYiJWSVnJIG0gIb2xz1f+i3JoTencrIDrklTV5ck8uEvr8OW8ZPypUJSd94JoNBfBS2BMvIVCmmXJvQ+vcGcS3VBbknfUHfu3JlQhtyn5yQWi+u5dgiXWSXHMBOTkzOxAa+KVUgZ+Icdt07TcJKPuvF6kmajEftDlg1VlzCCOym1EAdG/FAjkinS/pCzsQZbCOqgtvkDmZEP6JT446yUAXKyYIX+5PC5aiClV/HMTGFJhKXbsI22EUl9K5YouqGbSofxfJTbz4RXqNKlivmAAAAAElFTkSuQmCC>

[image61]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAZCAYAAABnweOlAAADa0lEQVR4Xu2XS6hNURjHvxvK+xGFKOciEkp55W1gQCKhCHVHDMwRKQOZGHlFSclA8ihJJsg7KYXkMSGRCGFCicT/d7/9uevuc+69+wyuTpx//br3rL322mv997e+b22zuuqqq67OVUmszjdm6iIWi4MZK0WPVj1ctK0Rh8VuMbb15WY1iOlin/lYjMv4NaNxYqO4In6KY60vN6ub2C92iFFivfgqHokRSb9+4pLYKXqLSeKJWJH0wZDN4rpoFAPFcXMTeU5NCFOWiZnitVU2ZaG4LIYlbevEL3FEdM3atoi7YkB0ktaKp2Jw9nuyeCdm/+lhNlK8NH9OTWmo+cQqmcJiw4DQcHMTn5svGCMwJH//VPFFLM1+7zJ/Ds8L9RE3xVHzSKoZtWfKFPFAbEjaon8skIj7aOX3ExlsNczoLi5YuSlstWtWHmUhthXGTxPzs98l8whn/DQf9TcfO2BsnptvK6T2TKkkwv+HOGv+0Fh8/v60PRbflin59lBJXDXPeR/EbbHdfGveNzeTyEXkx2fmkU3/JjFPfM/auIaZhVSNKbwpQv2z+dtDS8wfmr8/NSUfXaGOTAkxxnvzqAyNFm/EeWuphg1iq7XMj2R+0TxvVqVqTKGavBULkrZF1rEpbAFyUH7x1ZiS74MBB8yjNk3eVEKKA1V1j1iVXCusoqbg/D3zBJqqM7dPqJIpKAoB2ynVePPtRpT0zF0rpCKmYMgt85BFlGJKM8mNskr05O8PU7aZ9z9j5QsLU6hAVKK21JEpy3PtzJOz1DdrfVYqrI5M4ZDGgtLD2iDzQxcLiYVRXUi8IbYYSS62GgugSqV5gXEem59w21MlUzD6hHn+mJC0s31OiVnmcyTvxMssrDCF02VD7toQcUN8Eq8SSHo8OA5vRA3tjdlvxuF0e8d8koiJcb5JPyfmmI81I2mrJEwh6vhECPE/beSNmHdf83UQnYhcxgGSHBPzaFe8QSZJ+SIEgcPWQzEx6xPhWQnOHyGq0iHz8knZwxAigON+KsL8hfm5p8n8U4BSmn8ZeWEKEXFOnBSnzaNuk/mze2XXYm5xsIwiAKyTe+n718TCxph/MM61tr9nKJOUceD/Ikq3D9uVv+lW/S9VKaf8tyLa+BjlgEbuoQoWPqr/qyqJveZVJCBP1FVXXXXVtH4DtUnZnY5zR5QAAAAASUVORK5CYII=>

[image62]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAZCAYAAABdEVzWAAACSklEQVR4Xu2Wz0tXQRTFT1iQVEQEgVgk/SBcREK6yEUYlLQpolpEgX+ACFKLwgqKpIVWIK4i2rhwE0krIVBCahHVJlq4cRFBIO51KXoOd6bmXd48nougxTvw4fvezLw35907c+cLNPo/1EIOkN2+w2kX2eEb/5X2knfkGXlDBsi2wgjTMdi4g74jpw5ywzcmOkHGyStyk7QWu3GPvCXbyX7ymXwkF0kbOU7ukxVyOTyTVScZJB/IOpkqdv/RNbJIumBpGiVzsChJSs08bOKoEXKW9JFbsI8eJpMw85WSsSukl/xGubFDZAn28qh95BsZCveKyC9Y1KJ0fSm519pTimunUIovLjMmQ2vkdNKmtTNNFmAR3EM+oWjsLjkfrjV+DDVS6FVlTKH3xiSNXSZHwv0LmFmZ0Pp7SdpD3wUygRop9KoypracsbT9MCy9D2Am7oR2pW4m/G5ZOWNK0wLqGZMUKUXnFCxyipBMxhSqXztau/toaKtUzljcbd6AVGbMS4ZiClVQVWoewTbda1iUK5UzJuUM5NqjfArPwHZ3XJOqb7fDdVZVxp6i3IDGqsSUrR2fQklrTnNoLknP6d2VqjKml6v4xq0v7SSzAV17pSmMUilJjen3Oex8zSoai9s9lY6Xr+Rx0qbzTtEqO8IUCRVSFdRUV1E0pgw8+dtdlKKgCRSRjcAq+UFOJuO6yU9Y0bwOKwsqmP4fQkyhdqaXTpDv5Bzs4x+ifNyWpR3aDzvCNEmZ+mAT+qhH9ZAv5D1sffkPa9SoUaO62gR8OHI269J/zAAAAABJRU5ErkJggg==>

[image63]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEUAAAAZCAYAAABnweOlAAADjklEQVR4Xu2XS6iNURTH1w3l/QhJyCElrygirxhIJBKKKGaUzITIQMmAEZKBiQwkj5SkhLgoAwYij/JIJEIyoUTi/7O+fe8++5zv3HOSrtzvX//Od9Ze59t7//faa61jVqBAgQJ/FyVxVWqMMFrcJx4RV4vdyod/Axtj+OA7Vmwq8/Dv08SD4mFxkdipzKOdMUbcKF4Vf4jHyodbsFx8JE4Se4q7xctin8iH57PiWnGwOFG8IW62VmH43CpeF0eI/cXj5iJ2yXzaHYiyVJwhvrbqogwTn4prIls/8Y64KbLxvCP6DsaLd80FAJPFd+KsFg+zkeJLcUFk+yfAybKwaqIgxhfzDQVw4pxws3nkAH67NxsL4L2IQtSAPebzYA/oJd4Uj1rlVWtX1BKFu5+KAvB9a37SgA3/NPfvkdlWihfMheuaPaeiMNZsHnlEYAqu1SBxqjg3+14yj3DWFOejvubvDgzzpra6UEsUbHmixPbh4hNzYZ6Zi0QEYAdh83mipPaAknjNPOd9EG+JO80jmChEzKGZL/mRuVkD/uvEOeK3zMYYYtaFPFHCgusRBZCjXpkvAOLTOxsLc6Sbb0uUAN713nyOgFHiG/G8tVbDJnG7+Mk8ukjml8zzZkPIE4VrcMUqNw9SUTgtImODeQViDGE4WRbGFXhulZtvRJTUBwEOid+tPHlTCVk3VXW/+TVuGHmigHTz1eycEqe1LRpHpHPmwlCZ8jafZ09RTRTAnMwRV0cwzvy6ESXdk7G6UEsUckOeKJRxNk91IZ/EoQ0Q66K5b2fxjFVuLIhClFGJ8tCWKMsSO1frgfjVvM9qGLVEWWKetOZFtlBJIM8IRnMXKlEMehcqEmADH61cvAHiQ2v1yUM1URD6hHn+oCcK4PqcEmeaN4bkHURqCEEUeo+mZIx8cFvcFdmYgCgJfws4bcKUBBf/fqB5FEzPvqe/A7PNE2jwyQOiELH8RQjgGRt5I8xLYmcfoZEklz02zzFxB54LTp9FEgmhYnwW74sTIr8p4gvzFn2FeRmkUYtbczZ8z1wc7jeLIgJIurFQhDnvWm9eMokwSml6GCkQhYggT50UT5tH3RbzdVAUQg6DJHUEWRjZ2Ce/DX3UH4MXzTev87T+1UAjxVVCOHzzJif6FmfkuR7E14fI5JOr26FRLad0WHA1hpiXfHIPDVndrfr/ipJ4wLyKBJInChQoUOCfxi+Ggtp6r2hS2QAAAABJRU5ErkJggg==>

[image64]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAE4AAAAZCAYAAACfIRhSAAAD2UlEQVR4Xu2YW8iNWRjH/9NQJoYRkdB8bjQOhRTJIeRcGjk0am6UCy6UKES4ceEQ0VCE0tCEaCZpLkT6oigj0xS5Ukg0yUyJMuTw/Dx7tde39n733u/+prb0/uvX17vW2u9a61nPYb2fVKhQoUKfv+YYx42RxoCE/kZXo4dxzPjRGFRl3DdqXguMXWmjqaex2jhsbDEGd+xuvTYY7zN4ZgyTG+dBlf7AT2pObcY94+ek/VvjgvxQmXuq8ZexMBrTch01fpOfbOCIcd9Yb3xhjDVuJWPgvHFHvtG8wpOZG8PHhmO+A6o0Eka8YvRK2lsiQvCg0TdpH2+cML4qPc83VpS7P4qNHzJmJu2Naomxx3ikjoZjTe3GsqgNcXg35emj5cIwGKlL1NbPOKuOXkS4DoyeEYZcJ/eQvGqTe+x38hQQG461MP9r+fs5IObYKD/keK2xyLOsmUNmrd3kIc5zn/Kwj+/D+CE/s1/eyZi47cvwg0bEC8hXP6QdicYYv6q5sGHhu+UHFnJnmuPGGf/Kw/iGsVeeTmrNt8b4W+XfMJ5itt14aaySH0Cbcc54URp7TW7oM6Vn2k8pZ8GbbFxU7QWy8dPG0rSjQS0y1so3kWU4NM34T+UCtFXl1JElwhkjcTDBY5hnm/FWHdNKm7ww4fnsaZk859abo0J420nVr5AT5IWD8M0rQonCEw4my3Cj5cWIqwohyqYxHtemWhsLhuOmEIurFh5MCohDnUNk/Cb53ms5TKbCy3HvLHF6VLw/jN5JXz2x4B3yEA2qZjjyC0aLq+pw40/jnby6ZinLcGGedN3sZ5/8vfOi9lwi2XOqJNMsUX25frTLq18eYZCrxsOIx/I5KQQ8rzTmGrdVWelJ6HdVaZRY9QzH/F9H7Rhus/w3l9SkxxHfb4xJaUekUcZzVbp8EHkFA1HRGlE1j+PgUs9AbPIXVV6LYmUZjvRCviRaeE8QobrfmCiPNnJh3F9XbPR3+aRMnqUZcrdOc1LQcrkHkS+qGTYVn2/c4zBIWDBtfCWklZ2ry3VjSNIeKxjumDzhI/7y/NQYUWpjrtny8Gc+RNUll2LMhtVd7qr1DEcYpTf9WHjLK3m1wpuyxHyUfEI0VM1/5KGK8JAn8mJA9d4pD9Pppf4sBcNdlt8OqJiEPdeToaUxs1QuNkCFD/uP14KTNCQqHmFa6+LH6U1VbaPgvbh/Z2/4zDXFWFz6GzyoluJQDWmjj3KGX6tEKHGPaiRU/29l5bhPXpwyRmv2+7Uz4qZPqqDA8aWR+7OplSKEv1drQoPCFP/nhjtjrs+mQoUKFSokfQDqONMvu1LzoQAAAABJRU5ErkJggg==>

[image65]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAaCAYAAAD1wA/qAAABXElEQVR4Xu2WTytFQRjGH6Eo5c+CZEGSUmwtrC2UBWHBJ1A+ANv7IXwBC9lYy8qaWPkEl0RWUqzkz/Oc916dc9IdZw5zqPnVbzPvnc557sx5Z4BIJAh9Df81HXSbPtMj2pMtV8oYXc8Putihb3Q+XwjMFN2iJ/SV7mXLbqbpA92lbblaSBRkmc7RG3gE6abHtE5HsqVKGKZX8AgiNuk7PPblL1AqyDi9owewJlAlpYLo5Q9hYRTKxQa9LuAFnUhmuikVRB3rFra9tM2qxDvIIj2DdYs67MNXA6gKryArsFY3C2u9asFqxWrJreiCPfC7DtHOZKabwkEU4pGupsYWYIejDslWjNK1Ai7RgWSmm0JB9PIvsCuKVqJJPz2np7Q3NR6SZpB9OA7oSXpPa/h6uWuwVdHqhEQNR9tc1xM1HflEL+lM6nefKKX++fZ8oYHGB/G3LpGRSCQSifwoH26CShsJ9AOPAAAAAElFTkSuQmCC>

[image66]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAZCAYAAAB3oa15AAACVklEQVR4Xu2WT0gVURTGT2iQSBQVqSQkVAuJQigVxKVIIoJQQYt2kZC5rWjVKoK2hQvxDy4iiFChjaC4EEFBCIlWQZAiCAWFoRBFf76vc++bO9f59zbOW8wHP96bM3dm7nfnnnNGpFChQr6awA0/aFQFesGw4RqoCY3ISc1gECyA32AyfPq/DoJn4BE4A26DXfAenHbG5SIa6AcdYFOiDVwB8+CUE7sJ/oJRUO3Ec1MDWJdoAw8kmKxVo6jhj6DOieemJAOXwRoYcGJ2POF/XwfAcXBONHeOgSOg21AbDJVDovew8Dq+1ZNejPeMVZKBKHWCX2BadAK+GHsKdsAfsAwmRIvEuInTGNUCVsBP0Tf9UnS7rprjr6L3inpOSeUYYFJzMt9Am3fOV5/oJG5JsIK8/hX4As6bGNUOvoP7olXvCXho/qeqHANXwRbo8k9EyBrgrysWBr6Zx06MBjl5rjjz7rmo2UzKaoAr/ha0+idiFGfgkmgpfi3hKsbe8gZsg4tOPFVZDHDyS+CsOeaDWU6PlkbsVZqBFxJOTq445/ADjJjjTEozwIbF1XIb1wnRhxx2Yr7iDDCZGR9yYjRyz3BdtEhwgTLJGvBXhKoHi6J7c8Phs2gyJjUya4DJaO/Lcsr7sZOzVFJMVCb6nOiCcCxzILVQMBHZkPgZwQcRlrh34IIZYxtZFG4SRskamAGzYAx8AlOiC0PdNWMsPaLNkU3Sxj5IMJ99lbuFuJ85saScqTjF5UDFi3uY7f+OqAH+pn4OVJLY9llNWKUsPE78HChUqFB2/QONWofEffGuFQAAAABJRU5ErkJggg==>

[image67]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIYAAAAaCAYAAABy3SSpAAAFNUlEQVR4Xu2aeah1YxTGHyHzLENI5gxlypghY/zDhxQZSsoUfYZEkpL8ISGSjH1RpoxlDHFRhpQkU6LvplDEH0IyP7+7ztvZZ9197rfPOfe7znfsp57uOXu9e9+91rvW8673vVdq0aJFixYtWrRY/jjM/N78p8IfzTPMjc3Xzb8qtp/NR8y1uHnCcbbC32psvjYPNncxP0o24nbzzJ0ThHvNv80js0FxDdsSc6VkWxGwrnm1+Ya5XbItCxTAK+YP5s7JBs5VJMUV2TAJ2MB8z5w2t+g1zQCncf60bBhzbGTeaL5pHm6u3GtuhG3Nb80pc+1e00yRUCx/mAcl20SASqAiHjdXSTa+c71fxYwjtjHvUyjEfhpN5YpaXp8N6hbUx4pld+KAEvSTQxRkWhEAAjHO2Ml8rEN6gFESooCEIDbHZYOxt/mL6gtqInCb+ae5yNw88WRFxTBmHMHkowovKFQCtZgvrG4+p1DLAzQ7NpcrkoY+Y+JQ5JDMf8C8O3Gpxru/ON78yTxR86MQVZT+ApJ01bjQW7Cba/uLZANrqnlD13TsMYqAP6jmEz0fTWYdhukv2Ob/quEVdh3zYfM3jZZwTePdF6W/uDQbNHd/sZ75omKdXRYGGQsI6jDyXLal7yiUZKTAqNtfHJsN6t9flGIaRWEpwtc0fEM7aLxrwflFPznkGra67N9dUaFNXn6QsSQgh2p179MUnD0sNt83zzTX6DU3Qjm/YBlhSckoBZUTeFPzbdUrbFOwLOaEGwSDxLsWw5xf0JDRdL1kfmXeam7VsfEi15jPmpeZ688xll0D6/S1CvnfsHN91GqpYlXzFEWCkChMdlMMe37B93fNG8x7zB0ViXlV5zvVDI4wD+l8BluaNynGPKNeBSdWd5m3m0erGyuei38kEfduov7xHgj95BCUjpzGjgzMyHK/tWL8Dp3vBOLCzuc8lq3fE4qA72N+pm5VkoR17zMKWFJYWpDX7ZOtH3hHiqKuvyBp6S2+VChEFfiJ0pAA+MYkn27ur9g5sbshtk+pe8q8r0IlN1PE4Qt1Ew7bk4rn7WZ+qigevvOMkzrj2FGWJS/HuzF4oW/Ue87/nXmqopF72fy9YuMzzSANDUBpXlU4DphEGqbqOQif79fssTjEwRNNJuBdCFip5qGdmiecp4hFNTZLzQMV1f+BZv/tCHUAub9gcj9R3EtiEFfigTog9fwsSVKKiElnKSLhKJwp9T6PBOIZxIgEotkl1igGsc3xXlBkuWdPTwBKlpcA8cJ5LCr1oSIogDGlKuejv/gvgY9MeFFYJg8VZfKrflIMJAPXiR3xKBNZ7S94zufq9is8r/R7FB0JmXduOd4LCjIYBWENv0AhzwSkLCO7KiaY5SWPPdR8WlENrJHPK2Qb214KpziwOkHNwHOprnz4VEfW4FF3KnOB92AZ4XfhG36WE1MmkkkHLLMkCT7i65TiHiaZPoL+4ixFsrzVseEnyVTUgwSpKjTLUF28S0+zIDhKIYs4uKfCoUsUBz/nmA8pZLduLAnBOMbfomhU71A0UThGotCQ1u0E6rCHZh/K9SNyS5CXF4jDxQpfmeDzO9cAvQBx4Rr9Fcf2i83VzOsU22yShTFLFPHhXpaYRzvXp9VVD2LFvz+QCCTIlYpkzPFecNATkJVVII3sRDLqxnKQQ/XifHW3wDPgigyqNPsLKIriW/G/oBojPuclAvWgd2C5LeB+loz8u+ri3WJCUJrSixSTfKfiCKDF/xwoBv0JywykF8kq0qJFixYtWowT/gX21TEgtv7IBwAAAABJRU5ErkJggg==>

[image68]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAZCAYAAAB3oa15AAACcklEQVR4Xu2Wz6tNURTHl1CE/Hj1EEoiAxE9j39AIpFCCTMTYkIhb6ReL1FvIiNCBlKSlJRi8KIQUxmQSEpRREjkx/fTOru73777nPvu6N7B+dane8865+yz1tprrXPMatWqldN0cUksT09IS8VpcU7sEpNHn+68xonj4rvoS85tE8/FSjFVDIq75gF3jdaKT9YcwALxUuyObDPFU3EwsnVUZPK8eXmkAeB4amO3rogR8x3pqHDmsHmZHLNmZ89kbOiyeC8WJXbEmj1iidgkZpknaX3BlMalNknMjeC+CaI3sbFmVmvEsJho+QBwNLVV2RFO0fDfxF/xyHw47BQXCzuBIfrqsfgl/omrYp55iXJMWbMWazaJrFA2C4vjNADKYySxBVUFELTZ3Im91sggibomPoplhQ3Rg1/FUTFenDQfKvzPigUPiR2RLQ2Arb6X2ILaCYDfWBvMd2YosuEPzpNx/DhrHmypVlmjdILSAFCZo2X2WGUBcA/3Xjev9yDeLbfEF7Eisme1T7xNoDZ54AfxwLyRyFLOUQJ4J+Yn9litAmCSxc1JMln3p3lpV+5ATrkd2CL+iHWRjYa6XZBtrkJlAdDM2OP3CIEcKaCsf4s90fkxaUD8EP2RrUc8ESci22Lz7ONIlUIANGPINIPjvnhmvsOIRqXRebtPM7+WHvhsPiVbiuxSNjwMyPhDazxgtXht3mTbzUfcKWu9xSGAm+KOuCDeiBtiTnHNgeKawEYxW7yKbC8s/33WlphIvIS2mn9ejEVxCREsjs0YdUWXq6wHul7UML2z3zwAfjmOJ05Xi8nENGEUBjiumli1atVqQ/8B/seTNLytUwoAAAAASUVORK5CYII=>

[image69]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAZCAYAAABdEVzWAAACsklEQVR4Xu2WS6hOURiGX2Egt4GQkNwGpJAoBjoKKZFcIqRkQFJCkUspZeAWYSApGUi5JilJEUVSLoWBy4BMDJgpI7zP+fY6/9rrHOcwIOm89bT3v/a6fOu7rPVLnfo31NUMML3KD4V6mu5l459SX3PFHDDnzSrTpdYjNErRb0j5oVQPs9ycNPvNWLWecImZpvAE3/DKSjMh67PNXDTdTD/zwNw1c8wgM9rsMB/N/GrMT8UuLyt2x+Dxism2qGEcC+GB7wUXFOMRobmlWDhpu5lumswKs8xsNEcVc7arDapPhsaZJ2Z41nbKPDfvFV6Zq8inJDb1TuG1JN7nZb/xMhvsMITojNmneuhYBMPwXtIxMyn7Xaq3uae6YVvNzOqd+VmnwxAm7VWEBfcSDrTUXFe9sjoyDB0yZxVGkLcnzODq2yxzRL8QwqRh5pXCuDcKQ9k57bmOm8PmsfmgSOyJtR4x5pHZqTBic9VO6C5Vz9/SGEXupKQmvH1qPaTTimROeUVFfjZTWnqE8BTeIQ3wHB7CyBTCdAJQ/SOrtjbFLvDQWkVlflEYd19R8knkUJ7sjMNz59R+eDAohZADlSNpt8IZFFQZmWZh/TXVE5YFryqMo2J/plSFb83A4ltSGcKp5rUZUf3mfNtUvdeEu8kvrM+FwTcUIUWrzTezrqVHwzDgvVQZQkTO5f0xmJxuJarspRo7yMXZRqUiPIoHc8NSKO+o7XsxD2ES8+SG8Tyoeoo0iwlvKpI6P8f6KxbE9YgnVZlfuhwpX82irC0JozlIOVBzLVTdMByzp/G5Li7UZwoDuTbw1AvVL2CeXFG3zRqFJz+Z9VmfpBRCKrPUUPPUzFCM26W2+7UIV2L9YjNbjYO2FBMvUPRJd2SpJsWCpcFJk81DRQ6TX3/tr0+nOtWp/04/AInMef3MNVvHAAAAAElFTkSuQmCC>

[image70]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAZCAYAAABdEVzWAAACnklEQVR4Xu2WTahNURTH/8JAyED56HmRj4EREiK9nkLKRyIRUqJISagnvFKvDHxFGEhKBlI+MjVQHgZIyUAMkEhJYqaY4P9v7X3v2su5790JSfdfv+45e69z9jprrb32BVr6NzSQjCLD4kTQUDI4Dv4pjSA3yTFylWwiAwoL02SY3bg4ETWErCfnyWFUP7CGzINFQospKhvJdGezj1wng8hI8oDcI0vIWDKFHCAfyYr0TEONIXfJKZhDy8gbMt/ZaCFF4GfgGixKklJzG7Zw1n7SQTrJBrKO7CKnYe9sKE1eIC/IaDeuqD1EfVFJds/IO1hUlsLqKUsReQuLWpaul7t7RVkfWJWRQlPJZ9KLslj1sh9koRs7Q2a6+6jh5D5Kx7pQf4fSfwRNpFDSQl9R7ZhS5RfpzzHpBLkMc0J1e460pblFsHLpM4VZ/Tmm9GWdJSfJE/IeVtgz3Lw0njwmB2FO7EnjSt2N9NuUVEOqJaVAqchSjcmxS27sIqyYc11pR34hs2sWJkVK0ZkGi5wiJCdzCnMHOEompbFKrSafyJx0PwG2GaJjctwXu75ekbuCvtMjh3IK1VDVkg7B6lsZUZQrpa9Si3gF21VqfNvwe41F5V34GuWO9oopnEtekonpXv1td7puSnLM78rN6X57zaLumNB1VEyhpJrz9nJYZVOpnbAayyFVBFVPvo8pcoqgdyynshfV56JPYZbe4x3T73GUJVKT6ug7LMySivkDyi/VnHalP3TXkm+wGo2S02qkaqheq1A6pq7QU58uJQeek62kGxaFePjqei+5Q7bAjhQ15h3BTsop1M6MaidPyQLYc1qvyq4mFa9612LYmddIevFKmJ0/rrw6YQtGh7NmkUfkFqy+/tpfn5Zaaum/0y+pRH1J1fcr0QAAAABJRU5ErkJggg==>

[image71]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADAAAAAZCAYAAAB3oa15AAACyUlEQVR4Xu2WzavNQRjHn1sUIS9XpMhLXrIQhZSQBWJB8pbwF2BFl5KFQmEhkbxkYyEiRbIQcctGLJTCwkJEVjZio8T30zPPPXPH+f3OPXdj4Xzr0/n9npn5zXxnnpk5Zh393xojukVXWZBpqBhRBv+1GPB+cVecEpes+SCHi/NiQ1lQp2liexnMNMe808tih3knpYhRRh3q0ibXQvFGzDA3c1R8FnvEVDFZbBUvxQUxxJtVa67YLR6LX+Jq/+I+bTbveIEYad7xQzE6q8MzMcqoQ13a0Da0TzwVo9L7MtFjPg4mb6fYJu6Ym2kpGm4US8Una25ginhn/vHQWPFC7M1iB1OMshBt3oqJ6Z3v95obRKzIufSMWJWT1mbqoEnigzU3wCB+mHcWoqNr1hhMGCrbLxbfrTGgQ9bfAOXH0jNaLc7YAFKnVJ2Bs/a3AUTdL+b5zEp+TbFctKHt8fS+0nw1Iz1I3zA3QdzMytpSnQFiVQYiHgMt25dxjkY25y3zjXvDfDWYcWa+7dQJVRng473W2sB68TvFcpUGUJeYb54ucZIx8EgdypeI02Jtem+pKgOc0Y+stYF1NnADpUiZ2+kXcWrR5yxxWGxK8VpVGUD5QKviVQOtiofK1OEofmaNE4/T66I1Nn2l6gywAasMcPQyc2xkNnTZPgxw+jRTnjqI1PpmnpKI9DlhPr5a1RmgEy65VVlsmLif4Dn2SryHaPMz/ZYqUweF4TCAMMAtXaswwNmO61zd4rk4ksVmms9+/tdjl/gopqd3vsOtTErkNzaK1GEj58IM3w0DTAyn1vi+GoWYGRoww2xC4OJ5JeZl9RaJ9+KA2GJ+aXFjciyG4oh8Yn67M/jX5n8pSrGqtC8nC2NXsrLl5hddWW9Q4kRaYz44/l40Ex3NNje5wvobDLGiDJLfZhonrosH4p4N8mLrqKOOOuqoVn8AaMWbFOh6mLMAAAAASUVORK5CYII=>