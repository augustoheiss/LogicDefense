# **Fragmentação e Paginação Determinística de Dossiers e Currículos Executivos em Mídia Impressa**

A transição de um sumário executivo de página única para um dossier técnico ou institucional de duas páginas impõe exigências tipográficas rigorosas que frequentemente colapsam sob o modelo de paginação dos navegadores contemporâneos1. Projetados primordialmente para a renderização de fluxos contínuos e hipertextuais, os motores de renderização tratam a mídia impressa como uma preocupação secundária2. Quando estruturas complexas de dados profissionais — tais como cartões de experiência corporativa, listas de realizações de impacto e blocos de validação institucional — são processadas pelo motor do Chromium, observam-se anomalias severas de fragmentação1. O recurso ingénuo à propriedade break-inside: avoid tende a produzir grandes clarabóias ou vazios assimétricos na folha inicial, enquanto a última folha é frequentemente descarregada com duas ou três linhas de texto isoladas, gerando o clássico e deselegante defeito da página órfã1.  
A superação deste desafio exige uma compreensão profunda dos limites arquiteturais do subsistema LayoutNG do Chromium, a comparação matemática e estrutural entre a fragmentação nativa e a partição virtual baseada em JavaScript, e a aplicação de modelos de otimização combinatória derivados dos cânones da tipografia automatizada1.

## **Estado da Arte do CSS Paged Media nos Motores Chromium**

A evolução do suporte a documentos paginados no Chromium sofreu uma viragem profunda com a consolidação do motor LayoutNG, introduzido gradualmente a partir do Chrome 77 para substituir a arquitetura herdada do WebKit1. O novo pipeline eliminou a mutabilidade histórica da árvore de layout através de árvores de fragmentos imutáveis (*fragment trees*), permitindo que um único elemento de bloco gere múltiplos fragmentos físicos discretos distribuídos ao longo de quebras sucessivas de coluna ou página1. Mais recentemente, o lançamento do Chrome 131 em novembro de 2024 representou um marco normativo ao viabilizar o suporte nativo às caixas de margem da regra @page, historicamente indisponíveis em navegadores de consumo10. Não obstante esses progressos, a conformidade do Chromium com as especificações da W3C permanece incompleta e fragmentada12.

### **Capacidades Nativas e Avanços do LayoutNG**

No domínio dos descritores fundamentais do *CSS Paged Media Module Level 3*, o Chromium implementa com elevada precisão a definição dimensional da folha de impressão através da regra at-rule @page13. Os desenvolvedores podem parametrizar formatos universais ou geometrias personalizadas milimétricas por meio do descritor size, associando margens físicas explícitas que estabelecem de forma estável o retângulo de contenção inicial do documento10. A orientação de rotação geométrica pós-disposição via page-orientation (upright, rotate-left, rotate-right) e as páginas nomeadas por intermédio da propriedade page operam com estabilidade, viabilizando a alternância deliberada de geometria entre a capa executiva e as tabelas financeiras anexas14. A cascata tipográfica responde satisfatoriamente aos seletores pseudo-classe @page :first, @page :left, @page :right e @page :blank, permitindo geometrias assimétricas em impressões frente e verso10.  
A inovação mais substantiva reside no suporte a todas as 16 regiões de caixas de margem periféricas (@top-left, @top-center, @top-right, margens laterais e os respetivos cantos)10. A ativação de qualquer uma dessas caixas de margem acarreta a supressão automática dos cabeçalhos e rodapés gerados por padrão pelo Chromium (como URLs, carimbos de data e títulos da janela), substituindo-os pelos nós declarados na folha de estilo10. Concomitantemente, os contadores dinâmicos de paginação counter(page) e counter(pages) foram habilitados com sucesso restrito ao interior dessas margens, viabilizando a renderização nativa da contagem de folhas sem recorrer a scripts auxiliares10. No fluxo interno do conteúdo, a fragmentação de caixas de bloco convencionais obedece às regras break-before: page, break-after: page e break-inside: avoid, enquanto o motor tipográfico do LayoutNG respeita escrupulosamente os limites mínimos configurados via orphans e widows em parágrafos contínuos1.

### **Falhas Estruturais, Regressões e Limitações Práticas**

Em contrapartida, lacunas persistentes no motor Chromium impedem a paginação totalmente declarativa de layouts corporativos sofisticados12. A ausência de suporte às propriedades string-set e à função string() do *CSS Generated Content for Paged Media* inviabiliza a extração dinâmica de títulos textuais presentes no corpo da página para projeção nos cabeçalhos periféricos das caixas de margem13. Da mesma forma, o mecanismo de elementos correntes (position: running() e content: element()) permanece inoperante, impossibilitando a transposição de marcas vetoriais, heráldica corporativa complexa ou caixas de assinatura ricas para as margens do papel12.  
Outro entrave crítico decorre da interação volátil entre o modelo de fragmentação e os contentores flexíveis (display: flex) ou bidimensionais (display: grid)1. Embora o suporte preliminar à fragmentação de Flexbox e Grid tenha estreado no Chrome 103, o comportamento sob restrições de corte é inconsistente1. A declaração de break-inside: avoid em elementos descendentes integrados em grelhas assimétricas frequentemente induz o motor a tratar todo o contentor circundante como uma caixa monolítica1. Nessas circunstâncias, em vez de seccionar suavemente o nó problemático ou movê-lo de forma isolada, o Chromium desloca arbitrariamente blocos substanciais de layout para a folha subsequente, abrindo fossos visuais intoleráveis no final da primeira página1.  
Agrava-se a este cenário a ineficácia recorrente da diretiva break-after: avoid quando aplicada a cabeçalhos (h2, h3)5. Se o bloco de realizações imediatamente posterior estiver encapsulado por restrições de quebra e exceder o espaço residual da página, o motor frequentemente prioriza o isolamento do conteúdo subsequente, violando a regra de adjacência do título e deixando-o desamparado na margem inferior da folha5. Por fim, a coexistência recente de caixas de margem nativas desencadeou regressões operacionais em motores híbridos como o Paged.js: ao detetar regras @page combinadas com polyfills baseados em mutação de DOM, o Chrome 131 sobrepõe rodapés nativos duplicados aos elementos virtuais gerados por script (*ghost footers*), exigindo neutralização forçada através de content: none \!important; na camada de impressão19.

| Propriedade ou Mecanismo CSS | Módulo de Especificação W3C | Estado Operacional no Chromium | Comportamento Observado e Restrições de Engenharia |
| :---- | :---- | :---- | :---- |
| @page { size; margin; } | Paged Media Level 3 | Totalmente Funcional | Parametrização estável de dimensões físicas e margens externas absolutas13. |
| @page Margin Boxes (16 regiões) | Paged Media Level 3 | Funcional (Chrome 131+) | Caixas de margem ativas; suprime rodapés pré-definidos do navegador10. |
| counter(page) / counter(pages) | Paged Media Level 3 | Funcional (Chrome 131+) | Opera exclusivamente no interior das caixas de margem da folha10. |
| break-inside: avoid (Blocos) | Fragmentation Level 3 | Funcional | Impede a quebra de caixas de bloco convencionais; risco de grandes vazios residuais1. |
| break-inside: avoid (Flex/Grid) | Fragmentation Level 4 | Instável | Propensão a tratar o contentor pai como elemento monolítico indivisível3. |
| break-after: avoid em Títulos | Fragmentation Level 3 | Deficitário | Desacopla frequentemente títulos do conteúdo quando o bloco filho salta de página5. |
| orphans e widows | Fragmentation Level 3 | Totalmente Funcional | Respeitado com rigor em fragmentações de fluxos tipográficos contínuos1. |
| string-set e string() | Generated Content Level 3 | Não Implementado | Ignorado pelo motor; impede running headers contextuais declarativos13. |
| position: running() / element() | Generated Content Paged Media | Não Implementado | Inviabiliza a transferência de nós HTML enriquecidos para as caixas de margem12. |

## **Paginação Nativa do Navegador versus Virtual Page Splitting no DOM**

A incapacidade do motor de renderização em assegurar uma divisão equilibrada de dossiers executivos coloca os arquitetos de software diante de uma escolha fundamental de engenharia: delegar as decisões de paginação às heurísticas internas do navegador ou assumir o controlo determinístico do documento por meio de *Virtual Page Splitting* executado via JavaScript no Document Object Model1.

### **O Paradigma Declarativo Nativo e a Miopia do Modelo First-Fit**

A abordagem puramente declarativa ancora-se na aplicação de propriedades padronizadas de quebra de fluxo diretamente sobre as classes estilísticas dos elementos4. As principais virtudes deste modelo residem na simplicidade de implementação, na ausência de consumo de ciclos de CPU em scripts no cliente e na preservação da semântica original do DOM, uma vez que a árvore de nós permanece inalterada1. O navegador compõe a paginação em código nativo C++ de baixo nível durante o ciclo de rasterização da janela de impressão, consumindo praticamente zero memória adicional1.  
Todavia, a fragilidade arquitetural deste modelo decorre do seu algoritmo subjacente, historicamente baseado numa abordagem gulosa de primeiro encaixe (*first-fit greedy algorithm*)28. O motor avalia o fluxo sequencialmente: ao processar o elemento ![][image1], o subsistema verifica se a altura do bloco excede o espaço residual da página corrente29. Caso exceda e contenha a diretiva break-inside: avoid, o bloco inteiro é projetado para a folha subsequente21. Esse mecanismo não possui retrocesso (*backtracking*), não prevê o impacto da decisão nas folhas futuras e ignora o peso visual global do documento28. Como consequência incontornável, a transferência sucessiva de blocos pesados empurra os elementos finais para além do limite da segunda folha, criando inadvertidamente uma página terciária com poucas linhas ou esvaziando a porção inferior da primeira página1.

### **Arquitetura de Divisão Virtual e Medição Preditiva**

O paradigma de *Virtual Page Splitting* adota uma premissa diametralmente oposta: a árvore do DOM original atua exclusivamente como uma fonte canónica de dados não paginados26. Antes da chamada de impressão física, um motor algorítmico em JavaScript intercepta o documento, executa uma cópia de medição em ambiente invisível (*off-screen stage*) e calcula as dimensões físicas absolutas de cada nó estrutural26. A partir desse perfil métrico, o algoritmo secciona e redistribui programaticamente os elementos em contentores artificiais de altura estrita (.page-container), que emulam com exatidão os limites da folha física26.  
Cada contentor virtual de página recebe propriedades que forçam a sua impressão como uma entidade fechada e contínua:

CSS  
.page-container {  
  width: 210mm;  
  height: 297mm;  
  padding: 15mm;  
  box-sizing: border-box;  
  overflow: hidden;  
  break-after: page;  
  page-break-after: always;  
}

Ao delegar ao navegador apenas a rasterização de caixas cuja altura coincide com a capacidade da folha, anula-se completamente o arbítrio do motor de layout26. As decisões de corte deixam de ser um subproduto de heurísticas cegas de renderização e passam a responder a um plano matemático predeterminado26.  
A fiabilidade deste método depende, contudo, de controlar rigorosamente variáveis ambientais do navegador33. A medição de alturas de nós através de getBoundingClientRect() antes da conclusão do descarregamento das fontes corporativas conduz a erros catastróficos, uma vez que o motor calcula as dimensões com base nas fontes genéricas do sistema30. Por este motivo, qualquer rotina de virtualização tem de aguardar obrigatoriamente a resolução da promessa document.fonts.ready30.  
Adicionalmente, os arredondamentos de subpixel do motor gráfico impõem a introdução de uma margem de segurança (*epsilon buffer* de 2 a 4 píxeis por página) para prevenir que um erro residual de meio píxel force a criação de uma folha vazia33. O algoritmo deve igualmente contabilizar o colapso vertical de margens, pois a separação de nós em contentores virtuais distintos anula o colapso nativo das propriedades margin, demandando a medição contínua da distância euclidiana entre as extremidades dos elementos34.

| Vetor de Análise Técnica | Paginação Declarativa Nativa (CSS) | Virtual Page Splitting no DOM (JavaScript) |
| :---- | :---- | :---- |
| **Determinismo Espacial** | Baixo; sujeito a desvios imprevisíveis no LayoutNG1. | Absoluto; a composição final reflete com rigor os limites calculados26. |
| **Equilíbrio Volumétrico** | Inexistente; preenchimento estritamente sequencial e guloso28. | Elevado; viabiliza balanceamento global e retrocesso32. |
| **Latência de Processamento** | Nula no cliente; processamento em pipeline nativo C++1. | Moderada; incorre em custos de refluxo (*reflow*) e medições26. |
| **Sincronização Tipográfica** | Transparente; o motor reavalia a quebra após o carregamento da fonte. | Crítica; falhas graves se executado antes de document.fonts.ready30. |
| **Resiliência Estrutural** | Elevada; preserva a integridade semântica do documento. | Média; exige clonagem, injeção de nós e gestão de sub-listas26. |
| **Extensibilidade Contextual** | Limitada; incapaz de alterar conteúdo nas páginas de continuação13. | Total; permite injetar carimbos e cabeçalhos condicionais31. |

## **Modelação Matemática e Algoritmos de Balanceamento Global**

O imperativo estético de um dossier executivo de duas páginas reside na harmonia espacial entre as folhas: uma primeira página densa complementada por uma segunda página contendo apenas duas linhas de realizações transmite desleixo editorial e fragilidade compositiva1. A eliminação desta assimetria requer a transposição do problema da quebra de páginas para o domínio da otimização combinatória8.

### **O Problema da Página Órfã e Limitações da Partição Gulosa**

Consideremos um currículo executivo formulado como uma sequência finita de ![][image2] nós ou blocos indivisíveis de conteúdo:  
![][image3]  
Cada nó ![][image1] possui uma altura intrínseca ![][image4], calculada num ambiente com largura útil constante. O documento deve ser distribuído por exatamente ![][image5] páginas de capacidade máxima idêntica ![][image6].  
O particionamento formal estabelece um índice de corte ![][image7] que separa a sequência em dois conjuntos contíguos: a folha ![][image8] e a folha ![][image9], com alturas acumuladas definidas respetivamente por:  
![][image10]  
sob a restrição física elementar:  
![][image11]  
A estratégia nativa do navegador determina o ponto de corte ![][image12] através do critério maximal:  
![][image13]  
Se a carga total do documento exceder ligeiramente a capacidade de uma única folha por um valor residual ![][image14], tal que ![][image15], com ![][image16], a execução gulosa esgota a capacidade de ![][image17], forçando ![][image18] e relegando para a segunda página um volume infame de ![][image19]8. A disparidade visual resultante ![][image20] atinge o patamar máximo de desequilíbrio8.

### **Adaptação Vertical do Algoritmo Knuth-Plass e Funções de Demérito**

Para garantir um equilíbrio visual rigoroso, adapta-se o modelo formulado por Donald Knuth e Michael Plass para quebra de parágrafos em linhas tipográficas ao eixo vertical de documentos estruturados8. No modelo original, o texto é decomposto em caixas rígidas, elementos elásticos (*glue*) e penalidades explícitas associadas aos pontos potenciais de quebra8. Na verticalização do modelo para dossiers executivos, os nós de texto atuam como caixas com alturas bem determinadas, enquanto as margens interlineares e os espaçamentos entre blocos operam como cola com propriedades elásticas de compressão e expansão8.  
A altura ideal de cada folha num documento balanceado de duas páginas é o ponto médio do volume total do documento:  
![][image21]  
A maldade (*badness*) de uma página candidata ![][image22] que acomode um intervalo de nós entre os índices de corte ![][image23] e ![][image24] é expressa em função da deformação elástica necessária para normalizar a folha em relação a essa meta volumétrica ideal8. Sendo a discrepância dimensional calculada por ![][image25], a medida de maldade tipográfica adota a formulação cúbica convencional ponderada:  
![][image26]  
O sistema global de deméritos ![][image27] para a partição do documento em duas páginas consolida a maldade das duas folhas geradas e a penalidade semântica intrínseca ![][image28] atribuída ao local da quebra8:  
![][image29]  
onde ![][image30] representa um multiplicador de equilíbrio estético.  
A calibração das penalidades semânticas ![][image31] reflete a arquitetura do documento e rege as preferências de fragmentação:

* **Penalidade Proibitiva (![][image32])**: Aplicada entre um cabeçalho de secção (h2, h3) e o seu item de abertura imediato, garantindo a erradicação de títulos órfãos5. É igualmente aplicada ao interior de blocos de assinatura executiva ou secções sumárias invioláveis.  
* **Penalidade Elevada (![][image33])**: Aplicada à quebra introduzida entre dois cartões de experiência distintos pertencentes à mesma empresa ou secção temática.  
* **Penalidade Moderada (![][image34])**: Atribuída à divisão de uma lista de realizações corporativas (li), aceitando o seccionamento dos tópicos de um mesmo cargo contanto que o cabeçalho institucional seja replicado com indicativo de continuação na página seguinte31.  
* **Penalidade Mínima (![][image35])**: Estabelecida nas fronteiras naturais entre secções estruturais maiores (como a transição entre "Experiência de Liderança" e "Formação Académica").

A determinação da partição ótima ![][image36] é obtida pela minimização formal:  
![][image37]  
Dado que a cardinalidade dos nós candidatos num dossier executivo raramente excede cinquenta elementos atómicos, a avaliação da função de demérito sobre todos os cortes legais é resolvida de forma quase instantânea em tempo linear ![][image38]8.

### **Heurística de Partição Equitativa e Compensação Dinâmica de Folga**

Em aplicações com requisitos críticos de fluidez de interface, a procura exaustiva pode ser otimizada por uma heurística em dois passos baseada em convergência rápida e redistribuição elástica de espaçamento (*slack redistribution*).  
Na primeira fase, o algoritmo calcula o volume total cumulativo de todas as unidades de layout atómicas presentes no documento. Se o montante total não ultrapassar a capacidade da folha única, o documento é imediatamente emitido em formato unificado sem transformações adicionais. Se o volume estiver contido no intervalo entre a capacidade máxima de uma página e o limite absoluto de duas folhas (![][image39]), define-se a meta de altura ideal em metade do valor consolidado.  
O motor efetua uma varredura ordenada sobre os pontos de quebra semânticos permitidos, identificando o corte que minimize a soma da distância absoluta em relação à meta média e da penalidade estrutural do elemento. Caso nenhum corte viável satisfaça as restrições de corte por escassez de espaço — por exemplo, quando o volume acumulado ultrapassa a área útil por uma fração inferior a dez por cento —, a heurística ativa a compensação paramétrica de folga.  
Neste regime, o algoritmo ajusta proporcionalmente as variáveis CSS globais que regem as propriedades elásticas de entrelinha (--base-line-height) e espaçamentos inter-elementos (--base-item-gap). Ao reduzir dinamicamente essas propriedades numa faixa controlada de três a seis por cento, o volume total do documento encolhe com uniformidade tipográfica, eliminando a pressão sobre as margens e permitindo que o particionamento atinja a convergência ótima sem comprometer a legibilidade do texto.

## **Engenharia de Contadores, Cabeçalhos Dinâmicos e Indicadores de Continuação**

A confeção de dossiers de nível sénior impõe exigências formais de paginação: a primeira folha atua tipicamente como sumário executivo e dispensa marcadores de continuidade, ao passo que as páginas subsequentes exigem numeração formal consolidada, identificadores temáticos da secção em decurso e carimbos inequívocos de continuidade quando um bloco funcional é seccionado10.

### **Mecânica de Numeração e Limitações de Escopo em Caixas de Margem**

No Chrome 131+, a inserção da paginação do tipo "Página X de Y" pode ser delegada integralmente ao motor nativo, utilizando as caixas de margem padronizadas10. O contador page reflete o número de sequência corrente gerado no pipeline de impressão, enquanto o contador pages agrega o somatório absoluto de folhas do documento impresso10.

CSS  
@page {  
  size: A4 portrait;  
  margin: 20mm 15mm 20mm 15mm;

  @bottom-right {  
    content: "Página " counter(page) " de " counter(pages);  
    font-family: \-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;  
    font-size: 8pt;  
    font-weight: 500;  
    color: \#64748b;  
  }  
}

@page :first {  
  @top-center {  
    content: none;  
  }  
  @bottom-right {  
    content: none;  
  }  
}

A declaração @page :first combinada com content: none; assegura que a folha introdutória permaneça limpa de rodapés, iniciando formalmente a sinalização visual apenas na segunda folha10. Todavia, esta solução nativa esbarra na já documentada inoperância da propriedade string-set no Chromium: caso a segunda página necessite de estampar no cabeçalho o cargo em análise ou a área funcional em continuidade, o CSS declarativo falha em fornecer o dado13.

### **Superação da Ausência de string-set através de Segmentação no DOM**

A superação desta lacuna decorre naturalmente da adoção da virtualização da página em JavaScript. Quando o particionamento é conduzido por script, cada invólucro .page-container é construído com sub-regiões estruturadas: um elemento explícito .virtual-page-header, um corpo .virtual-page-body e um rodapé .virtual-page-footer.  
Durante o processamento das quebras, o motor inspeciona a natureza do primeiro nó atribuído à segunda página. Se o nó pertencer a uma secção temática identificada com o atributo data-category="leadership-experience", o algoritmo injeta dinamicamente no cabeçalho da folha um carimbo formal:

HTML  
\<header class\="virtual-page-header"\>  
  \<span class\="dossier-id"\>Dossier Executivo Ref. 2026/EX-09\</span\>  
  \<span class\="category-continuation-stamp"\>Liderança Executiva & Governação (Continuação)\</span\>  
\</header\>

Paralelamente, a integridade de leitura de um currículo exige que, caso uma lista de realizações de uma empresa específica seja bipartida entre o fim da primeira folha e o início da segunda, o leitor não seja confrontado com itens desconexos no topo da nova página31. O algoritmo identifica que o elemento ![][image40] é um tópico (li) pertencente a um cartão de experiência já aberto na folha anterior e injeta um marcador explícito de continuação:

HTML  
\<div class\="card-continuation-badge" aria-label\="Continuação de entidade anterior"\>  
  Diretor de Operações — Logística Global S.A. (Continuação da experiência profissional)  
\</div\>

Esse componente restaura o contexto semântico do recrutador ou avaliador institucional, eliminando a ambiguidade inerente à fragmentação de tópicos corporativos em limites físicos de página31.

## **Arquitetura de Componentes Resilientes à Fragmentação e Implementação de Referência**

A viabilidade de um documento paginado de alto padrão técnico depende de uma arquitetura de componentes concebida desde a base para resistir e colaborar com os mecanismos de corte do motor de renderização.

### **Princípios Estruturais de Design Sensível à Paginação**

O projeto de marcação de um dossier executivo deve aderir a restrições arquiteturais rigorosas. O eixo principal de progressão do documento deve ser governado estritamente pelo fluxo de blocos tradicional (display: block)3. Contentores flexíveis e grelhas devem ter a sua aplicação circunscrita exclusivamente a nós terminais atómicos com garantia absoluta de não partição interna — como linhas de metadados onde a empresa se alinha à esquerda e as datas à direita.  
As listas ordenadas e não ordenadas de realizações devem adotar break-inside: auto, facultando ao motor pontos de corte legítimos entre os itens da lista, ao passo que cada item isolado (li) deve ser encapsulado com break-inside: avoid; para impedir a cisão desconexa de frases longas de impacto4.  
Adicionalmente, para contornar a inoperância do break-after: avoid no Chromium, aplica-se uma âncora vertical por pseudo-elemento ao cabeçalho do cartão de experiência: o pseudo-elemento ::after projeta uma dimensão invisível descendente com margem negativa equivalente, compelindo o motor a reservar espaço para a primeira realização sob pena de transferir o cabeçalho inteiro para a folha seguinte5.

### **Implementação de Referência: Componentes e Motor de Execução**

A implementação a seguir ilustra a arquitetura completa de componentes sensíveis à paginação e o respetivo motor determinístico em JavaScript, encarregado de executar a partição e o balanceamento estético em duas páginas úteis:

HTML  
\<\!DOCTYPE **html**\>  
\<html lang\="pt-PT"\>  
\<head\>  
  \<meta charset\="UTF-8"\>  
  \<title\>Dossier Executivo \- Paginação Determinística\</title\>  
  \<style\>  
    :root {  
      \--page-width: 210mm;  
      \--page-height: 297mm;  
      \--page-margin: 18mm;  
      \--base-line-height: 1.45;  
      \--base-item-gap: 6px;  
      \--text-color: \#1e293b;  
      \--accent-color: \#0f172a;  
    }

    @media screen {  
      body {  
        background-color: \#f1f5f9;  
        margin: 0;  
        padding: 24px;  
        display: flex;  
        flex-direction: column;  
        align-items: center;  
      }  
      .virtual-page-container {  
        box-shadow: 0 10px 25px \-5px rgba(0, 0, 0, 0.1), 0 8px 10px \-6px rgba(0, 0, 0, 0.1);  
        margin-bottom: 24px;  
      }  
    }

    @media print {  
      body {  
        background: transparent;  
        margin: 0;  
        padding: 0;  
        \-webkit-print-color-adjust: exact;  
        print-color-adjust: exact;  
      }  
      .virtual-page-container {  
        box-shadow: none;  
        margin: 0;  
      }  
      @page {  
        size: A4 portrait;  
        margin: 0;  
      }  
    }

    /\* Estrutura dos contentores virtuais gerados \*/  
    .virtual-page-container {  
      width: var(--page-width);  
      height: var(--page-height);  
      padding: var(--page-margin);  
      box-sizing: border-box;  
      background: \#ffffff;  
      position: relative;  
      overflow: hidden;  
      break-after: page;  
      page-break-after: always;  
      display: flex;  
      flex-direction: column;  
    }

    .virtual-page-header {  
      height: 14mm;  
      border-bottom: 1px solid \#cbd5e1;  
      display: flex;  
      justify-content: space-between;  
      align-items: center;  
      font-size: 8pt;  
      font-weight: 600;  
      color: \#64748b;  
      margin-bottom: 4mm;  
      text-transform: uppercase;  
      letter-spacing: 0.05em;  
    }

    .virtual-page-content {  
      flex: 1 1 auto;  
      overflow: hidden;  
    }

    .virtual-page-footer {  
      height: 10mm;  
      border-top: 1px solid \#e2e8f0;  
      display: flex;  
      justify-content: space-between;  
      align-items: center;  
      font-size: 8pt;  
      color: \#94a3b8;  
      margin-top: 4mm;  
    }

    /\* Componentes Semânticos de Currículo \*/  
    .experience-card {  
      display: block;  
      margin-bottom: 14px;  
      break-inside: auto;  
    }

    .card-header {  
      display: block;  
      break-inside: avoid;  
      break-after: avoid-page;  
      position: relative;  
      margin-bottom: var(--base-item-gap);  
      border-bottom: 1px solid \#e2e8f0;  
      padding-bottom: 4px;  
    }

    /\* Âncora contra títulos órfãos \*/  
    .card-header::after {  
      content: "";  
      display: block;  
      height: 32px;  
      margin-bottom: \-32px;  
    }

    .meta-row-primary,  
    .meta-row-secondary {  
      display: flex;  
      justify-content: space-between;  
      align-items: baseline;  
    }

    .role-title {  
      font-size: 10.5pt;  
      font-weight: 700;  
      color: var(--accent-color);  
      margin: 0;  
    }

    .role-period {  
      font-size: 8.5pt;  
      font-weight: 600;  
      color: \#475569;  
    }

    .organization-name {  
      font-size: 9pt;  
      font-weight: 600;  
      color: \#334155;  
    }

    .location-stamp {  
      font-size: 8pt;  
      color: \#64748b;  
    }

    .achievements-list {  
      display: block;  
      margin: 0;  
      padding-left: 18px;  
    }

    .achievement-item {  
      display: list-item;  
      break-inside: avoid;  
      margin-bottom: var(--base-item-gap);  
      line-height: var(--base-line-height);  
      font-size: 8.8pt;  
      color: var(--text-color);  
      text-align: justify;  
    }

    .continuation-indicator {  
      display: block;  
      font-size: 8.5pt;  
      font-style: italic;  
      color: \#475569;  
      background: \#f8fafc;  
      border-left: 3px solid \#64748b;  
      padding: 4px 8px;  
      margin-bottom: 8px;  
    }

    .section-title {  
      font-size: 12pt;  
      font-weight: 800;  
      color: var(--accent-color);  
      border-bottom: 1.5px solid var(--accent-color);  
      padding-bottom: 3px;  
      margin-top: 14px;  
      margin-bottom: 10px;  
      text-transform: uppercase;  
      letter-spacing: 0.05em;  
      break-after: avoid;  
      break-inside: avoid;  
    }  
  \</style\>  
\</head\>  
\<body\>

  \<\!-- Estrutura Canónica de Origem \--\>  
  \<div id\="dossier-source-tree"\>  
    \<div class\="executive-summary" style\="margin-bottom: 16px;"\>  
      \<h1 style\="font-size: 18pt; margin: 0 0 6px 0; color: \#0f172a;"\>António Silva-Carvalho\</h1\>  
      \<div style\="font-size: 9.5pt; font-weight: 600; color: \#475569; margin-bottom: 8px;"\>  
        Diretor-Geral de Operações & Transformação Tecnológica  
      \</div\>  
      \<p style\="font-size: 8.8pt; line-height: 1.45; margin: 0; text-align: justify;"\>  
        Líder executivo com mais de 18 anos de governação estratégica em conglomerados multinacionais.   
        Especialista em restruturação de modelos operacionais complexos, eficiência de cadeias de valor   
        e orquestração de ecossistemas digitais escaláveis de alto rendimento.  
      \</p\>  
    \</div\>

    \<h2 class\="section-title" data-category\="experiencia"\>Trajetória de Liderança Executiva\</h2\>

    \<article class\="experience-card" data-entity\="Grupo Lusitânia Logística"\>  
      \<header class\="card-header"\>  
        \<div class\="meta-row-primary"\>  
          \<h3 class\="role-title"\>Chief Operating Officer (COO)\</h3\>  
          \<span class\="role-period"\>2021 — Presente\</span\>  
        \</div\>  
        \<div class\="meta-row-secondary"\>  
          \<span class\="organization-name"\>Grupo Lusitânia Logística\</span\>  
          \<span class\="location-stamp"\>Lisboa, Portugal\</span\>  
        \</div\>  
      \</header\>  
      \<ul class\="achievements-list"\>  
        \<li class\="achievement-item"\>  
          Reestruturação do plano diretor operacional em 24 plataformas industriais na Península Ibérica,   
          assegurando uma redução sustentada de despesas operacionais em 18,5 milhões de euros.  
        \</li\>  
        \<li class\="achievement-item"\>  
          Unificação dos sistemas de planeamento de transportes com recurso a inteligência preditiva,   
          elevando os níveis de conformidade de entrega de 92,1% para 99,4% num período de 14 meses.  
        \</li\>  
        \<li class\="achievement-item"\>  
          Liderança direta sobre 1.200 colaboradores diretos e indiretos, renegociando acordos de   
          trabalho coletivo sem qualquer ocorrência de perturbação laboral em três anos de mandato.  
        \</li\>  
        \<li class\="achievement-item"\>  
          Revisão do balanço de emissões carbónicas operacionais, atingindo a meta de descarbonização   
          de 30% da frota dois anos antes do calendário regulamentar comunitário.  
        \</li\>  
      \</ul\>  
    \</article\>

    \<article class\="experience-card" data-entity\="Apex Global Energy"\>  
      \<header class\="card-header"\>  
        \<div class\="meta-row-primary"\>  
          \<h3 class\="role-title"\>Vice-Presidente Sénior de Operações\</h3\>  
          \<span class\="role-period"\>2016 — 2021\</span\>  
        \</div\>  
        \<div class\="meta-row-secondary"\>  
          \<span class\="organization-name"\>Apex Global Energy Europe\</span\>  
          \<span class\="location-stamp"\>Madrid, Espanha\</span\>  
        \</div\>  
      \</header\>  
      \<ul class\="achievements-list"\>  
        \<li class\="achievement-item"\>  
          Supervisão de operações de geração renovável com orçamento anual atribuído de 140 milhões de euros   
          e 480 engenheiros especializados sob reporte funcional e executivo.  
        \</li\>  
        \<li class\="achievement-item"\>  
          Condução da fusão operacional de dois ativos eólicos recém-adquiridos, integrando os sistemas   
          de monitorização em tempo real em menos de 100 dias úteis e poupando 4,2 milhões em redundâncias.  
        \</li\>  
        \<li class\="achievement-item"\>  
          Conceção de uma matriz de gestão de risco operacional que reduziu acidentes com paragem de tempo   
          para zero incidentes registados durante quatro trimestres consecutivos.  
        \</li\>  
      \</ul\>  
    \</article\>

    \<h2 class\="section-title" data-category\="governanca"\>Governação Corporativa & Conselhos\</h2\>

    \<article class\="experience-card" data-entity\="Fintech Horizon"\>  
      \<header class\="card-header"\>  
        \<div class\="meta-row-primary"\>  
          \<h3 class\="role-title"\>Membro Não Executivo do Conselho de Administração\</h3\>  
          \<span class\="role-period"\>2020 — Presente\</span\>  
        \</div\>  
        \<div class\="meta-row-secondary"\>  
          \<span class\="organization-name"\>Fintech Horizon SGPS\</span\>  
          \<span class\="location-stamp"\>Porto, Portugal\</span\>  
        \</div\>  
      \</header\>  
      \<ul class\="achievements-list"\>  
        \<li class\="achievement-item"\>  
          Supervisão do comité de auditoria e conformidade regulatória nas rondas de capitalização Série B e C,   
          assegurando a aderência escrupulosa aos requisitos do Banco Central Europeu.  
        \</li\>  
        \<li class\="achievement-item"\>  
          Aconselhamento estratégico do conselho executivo na expansão para mercados emergentes,   
          resultando numa valorização corporativa agregada superior a 200 milhões de euros.  
        \</li\>  
      \</ul\>  
    \</article\>  
  \</div\>

  \<div id\="dossier-render-mount"\>\</div\>

  \<script\>  
    /\*\*  
     \* Motor de Virtualização e Balanceamento Tipográfico Determinístico  
     \*/  
    class ExecutiveDossierPaginator {  
      constructor(config \= {}) {  
        this.sourceEl \= document.getElementById(config.sourceId || 'dossier-source-tree');  
        this.mountEl \= document.getElementById(config.mountId || 'dossier-render-mount');  
        this.targetPages \= config.targetPages || 2;  
          
        // Parâmetros Físicos em Milímetros convertidos para Pixels (96 DPI standard: 1mm \= 3.779528px)  
        this.pxPerMm \= 3.779528;  
        this.pageHeightMm \= 297;  
        this.pageWidthMm \= 210;  
        this.marginMm \= 18;  
        this.headerAreaMm \= 14 \+ 4; // Altura do cabeçalho \+ margem inferior  
        this.footerAreaMm \= 10 \+ 4; // Altura do rodapé \+ margem superior  
          
        // Altura útil líquida da folha disponível para o conteúdo  
        this.netContentHeightPx \= Math.floor(  
          (this.pageHeightMm \- (this.marginMm \* 2) \- this.headerAreaMm \- this.footerAreaMm) \* this.pxPerMm  
        ) \- 4; // Subtração de 4px de tolerância estrita (epsilon)  
      }

      async execute() {  
        // Garantia de convergência das métricas tipográficas  
        await document.fonts.ready;

        // Montagem de palco isolado de medição  
        const probeStage \= document.createElement('div');  
        probeStage.style.position \= 'absolute';  
        probeStage.style.visibility \= 'hidden';  
        probeStage.style.left \= '-9999px';  
        probeStage.style.top \= '0';  
        probeStage.style.width \= \`${this.pageWidthMm \- (this.marginMm \* 2)}mm\`;  
        document.body.appendChild(probeStage);

        // Decomposição hierárquica em unidades atómicas e fragmentáveis  
        const atomicUnits \= this.\_linearizeContent(this.sourceEl, probeStage);  
        document.body.removeChild(probeStage);

        // Execução do balanceamento combinatório Knuth-Plass adaptado  
        const balancedPages \= this.\_optimizePartition(atomicUnits);

        // Renderização dos contentores finais de página  
        this.\_renderPages(balancedPages);  
      }

      \_measure(node, container) {  
        container.appendChild(node);  
        const box \= node.getBoundingClientRect();  
        const style \= window.getComputedStyle(node);  
        const vMargin \= (parseFloat(style.marginTop) || 0) \+ (parseFloat(style.marginBottom) || 0);  
        container.removeChild(node);  
        return Math.ceil(box.height \+ vMargin);  
      }

      \_linearizeContent(sourceRoot, stage) {  
        const units \= \[\];  
        const topChildren \= Array.from(sourceRoot.children);

        for (const child of topChildren) {  
          if (child.classList.contains('experience-card')) {  
            const cardHeader \= child.querySelector('.card-header');  
            const items \= Array.from(child.querySelectorAll('.achievement-item'));  
            const entityName \= child.getAttribute('data-entity') || 'Organização';  
            const roleName \= cardHeader.querySelector('.role-title')?.textContent || 'Função';

            units.push({  
              type: 'header',  
              domNode: cardHeader.cloneNode(true),  
              entity: entityName,  
              role: roleName,  
              penalty: 800, // Alto custo para desassociação do cartão  
              height: this.\_measure(cardHeader.cloneNode(true), stage)  
            });

            items.forEach((item, idx) \=\> {  
              units.push({  
                type: 'item',  
                domNode: item.cloneNode(true),  
                entity: entityName,  
                role: roleName,  
                isSubsequent: idx \> 0,  
                penalty: 150, // Custo moderado para cisão entre realizações  
                height: this.\_measure(item.cloneNode(true), stage)  
              });  
            });  
          } else {  
            const isHeading \= child.tagName.startsWith('H');  
            units.push({  
              type: 'atomic',  
              domNode: child.cloneNode(true),  
              category: child.getAttribute('data-category') || null,  
              penalty: isHeading ? 10000 : 50, // Penalidade quase infinita para quebra após título  
              height: this.\_measure(child.cloneNode(true), stage)  
            });  
          }  
        }  
        return units;  
      }

      \_optimizePartition(units) {  
        const totalHeight \= units.reduce((sum, u) \=\> sum \+ u.height, 0);  
        const idealPageHeight \= totalHeight / this.targetPages;  
          
        let bestCutIndex \= \-1;  
        let lowestDemerits \= Infinity;

        let accumulatedP1 \= 0;

        // Procura da quebra ótima entre os nós  
        for (let i \= 0; i \< units.length \- 1; i++) {  
          accumulatedP1 \+= units\[i\].height;  
          const accumulatedP2 \= totalHeight \- accumulatedP1;

          // Se qualquer folha exceder a restrição física, a partição é inviável  
          if (accumulatedP1 \> this.netContentHeightPx || accumulatedP2 \> this.netContentHeightPx) {  
            continue;  
          }

          // Cálculo da maldade (badness) em relação à média ideal  
          const badness1 \= Math.pow(Math.abs(accumulatedP1 \- idealPageHeight) / idealPageHeight, 2) \* 1000;  
          const badness2 \= Math.pow(Math.abs(accumulatedP2 \- idealPageHeight) / idealPageHeight, 2) \* 1000;  
          const semanticPenalty \= units\[i\].penalty;

          // Deméritos Globais  
          const totalDemerits \= badness1 \+ badness2 \+ semanticPenalty;

          if (totalDemerits \< lowestDemerits) {  
            lowestDemerits \= totalDemerits;  
            bestCutIndex \= i;  
          }  
        }

        // Se nenhuma partição satisfez a capacidade, aplica corte forçado de primeiro encaixe  
        if (bestCutIndex \=== \-1) {  
          let runningH \= 0;  
          bestCutIndex \= 0;  
          for (let j \= 0; j \< units.length; j++) {  
            if (runningH \+ units\[j\].height \<= this.netContentHeightPx) {  
              runningH \+= units\[j\].height;  
              bestCutIndex \= j;  
            } else {  
              break;  
            }  
          }  
        }

        return \[  
          units.slice(0, bestCutIndex \+ 1),  
          units.slice(bestCutIndex \+ 1)  
        \];  
      }

      \_renderPages(pagesData) {  
        this.mountEl.innerHTML \= '';  
        this.sourceEl.style.display \= 'none';

        pagesData.forEach((pageUnits, pageIdx) \=\> {  
          const pageContainer \= document.createElement('div');  
          pageContainer.className \= 'virtual-page-container';

          // Cabeçalho da Página  
          const header \= document.createElement('header');  
          header.className \= 'virtual-page-header';  
          if (pageIdx \=== 0) {  
            header.innerHTML \= \`\<span\>Dossier de Qualificação Executiva\</span\>\<span\>Confidencial\</span\>\`;  
          } else {  
            header.innerHTML \= \`\<span\>António Silva-Carvalho — Percurso Profissional\</span\>\<span\>Continuação\</span\>\`;  
          }  
          pageContainer.appendChild(header);

          // Corpo de Conteúdo  
          const contentArea \= document.createElement('main');  
          contentArea.className \= 'virtual-page-content';

          let activeCard \= null;  
          let activeList \= null;

          pageUnits.forEach((unit, uIdx) \=\> {  
            if (unit.type \=== 'header') {  
              activeCard \= document.createElement('article');  
              activeCard.className \= 'experience-card';  
              activeCard.appendChild(unit.domNode);  
              activeList \= document.createElement('ul');  
              activeList.className \= 'achievements-list';  
              activeCard.appendChild(activeList);  
              contentArea.appendChild(activeCard);  
            } else if (unit.type \=== 'item') {  
              // Verifica se a página inicia por uma realização orfã de cabeçalho  
              if (\!activeList) {  
                activeCard \= document.createElement('article');  
                activeCard.className \= 'experience-card';

                const contBadge \= document.createElement('div');  
                contBadge.className \= 'continuation-indicator';  
                contBadge.textContent \= \`${unit.role} na ${unit.entity} (Continuação)\`;  
                activeCard.appendChild(contBadge);

                activeList \= document.createElement('ul');  
                activeList.className \= 'achievements-list';  
                activeCard.appendChild(activeList);  
                contentArea.appendChild(activeCard);  
              }  
              activeList.appendChild(unit.domNode);  
            } else {  
              activeCard \= null;  
              activeList \= null;  
              contentArea.appendChild(unit.domNode);  
            }  
          });

          pageContainer.appendChild(contentArea);

          // Rodapé Determinístico  
          const footer \= document.createElement('footer');  
          footer.className \= 'virtual-page-footer';  
          footer.innerHTML \= \`  
            \<span\>Curriculum Vitae Executivo\</span\>  
            \<span\>Página ${pageIdx \+ 1} de ${pagesData.length}\</span\>  
          \`;  
          pageContainer.appendChild(footer);

          this.mountEl.appendChild(pageContainer);  
        });  
      }  
    }

    // Inicialização da paginação determinística  
    window.addEventListener('DOMContentLoaded', () \=\> {  
      const paginator \= new ExecutiveDossierPaginator({  
        sourceId: 'dossier-source-tree',  
        mountId: 'dossier-render-mount',  
        targetPages: 2  
      });  
      paginator.execute();  
    });  
  \</script\>  
\</body\>  
\</html\>

## **Considerações Finais e Diretrizes Arquiteturais**

A obtenção de um dossier executivo ou currículo técnico com paginação impecável no ecossistema Chromium depende de assumir que a especificação CSS Paged Media e as implementações atuais do motor LayoutNG respondem a objetivos estruturalmente distintos1. Enquanto o motor de layout privilegia a renderização contínua e tolera anomalias de corte através de heurísticas sequenciais de primeiro encaixe, a paginação formal exige determinismo dimensional, estabilidade visual e equilíbrio de densidade entre as folhas2.  
A adoção do suporte nativo a caixas de margem e contadores introduzida no Chrome 131 representa um avanço apreciável para publicações estáticas simples10. Não obstante, a ausência contínua de propriedades essenciais para cabeçalhos dinâmicos — especificamente string-set e position: running — impede a composição inteiramente declarativa de documentos profissionais com marcações contextuais de continuidade13.  
Em virtude destas limitações, a virtualização determinística executada no DOM através de JavaScript estabelece-se como o padrão técnico fiável para dossiers de extensão fixa26. Ao decompor a estrutura de dados em unidades atómicas, medir as suas propriedades espaciais após a sincronização estrita de fontes via document.fonts.ready e calcular o particionamento ideal com base na adaptação do modelo combinatório de Knuth-Plass, o sistema elimina as páginas órfãs e a dispersão aleatória de vazios8.  
A engenharia do documento deve conjugar contentores de bloco rígidos com zonas pontuais de relaxamento elástico, permitindo que micro-ajustes paramétricos na entrelinha absorvam variações de volume textual3. Este paradigma garante que o produto impresso ou exportado em PDF preserve a sofisticação, a hierarquia e o equilíbrio exigidos em contextos executivos de elevado escrutínio.

#### **Referências citadas**

> 1. RenderingNG deep-dive: LayoutNG block fragmentation | Chromium, [https://developer.chrome.com/docs/chromium/renderingng-fragmentation](https://developer.chrome.com/docs/chromium/renderingng-fragmentation)  
> 2. CSS Paged Media Module & Specifications \- DocRaptor, [https://docraptor.com/css-paged-media](https://docraptor.com/css-paged-media)  
> 3. \[css-grid\] Implement fragmentation support \[40470638\] \- Chromium, [https://issues.chromium.org/40470638](https://issues.chromium.org/40470638)  
> 4. How to Fix PDF Page Breaks in HTML (The Complete Guide), [https://dev.to/digital\_trubador/how-to-fix-pdf-page-breaks-in-html-the-complete-guide-1m7g](https://dev.to/digital_trubador/how-to-fix-pdf-page-breaks-in-html-the-complete-guide-1m7g)  
> 5. How do I avoid a page break immediately after a heading, [https://stackoverflow.com/questions/9238868/how-do-i-avoid-a-page-break-immediately-after-a-heading](https://stackoverflow.com/questions/9238868/how-do-i-avoid-a-page-break-immediately-after-a-heading)  
> 6. Orphan CSS: How avoid headers (h1, h2...) on bottom page?, [https://stackoverflow.com/questions/34808650/orphan-css-how-avoid-headers-h1-h2-on-bottom-page](https://stackoverflow.com/questions/34808650/orphan-css-how-avoid-headers-h1-h2-on-bottom-page)  
> 7. LayoutNG \- Google Git, [https://chromium.googlesource.com/chromium/src/third\_party/+/refs/heads/main/blink/renderer/core/layout/layout\_ng.md](https://chromium.googlesource.com/chromium/src/third_party/+/refs/heads/main/blink/renderer/core/layout/layout_ng.md)  
> 8. Knuth–Plass line-breaking algorithm \- Wikipedia, [https://en.wikipedia.org/wiki/Knuth%E2%80%93Plass\_line-breaking\_algorithm](https://en.wikipedia.org/wiki/Knuth%E2%80%93Plass_line-breaking_algorithm)  
> 9. LayoutNG \- The Chromium Projects, [https://www.chromium.org/blink/layoutng/](https://www.chromium.org/blink/layoutng/)  
> 10. CSS Page Margin Boxes & Page Numbers \- Doppio.sh, [https://doppio.sh/guide/css-page-margin-boxes](https://doppio.sh/guide/css-page-margin-boxes)  
> 11. New in Chrome 131 | Blog, [https://developer.chrome.com/blog/new-in-chrome-131](https://developer.chrome.com/blog/new-in-chrome-131)  
> 12. Kickstarting the next iteration of Paged.js, [https://pagedjs.org/posts/en/kickstarting-the-next-iteration-of-paged.js/](https://pagedjs.org/posts/en/kickstarting-the-next-iteration-of-paged.js/)  
> 13. CSS Paged Media vs Paged.js: When You Need a Polyfill ... \- Doppio, [https://doppio.sh/guide/css-paged-media-vs-pagedjs](https://doppio.sh/guide/css-paged-media-vs-pagedjs)  
> 14. page CSS at-rule \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/At-rules/@page)  
> 15. Named pages with page-orientation \- Chrome Platform Status, [https://chromestatus.com/feature/5173237715566592](https://chromestatus.com/feature/5173237715566592)  
> 16. Named pages with page-orientation · Issue \#346 \- GitHub, [https://github.com/mozilla/standards-positions/issues/346](https://github.com/mozilla/standards-positions/issues/346)  
> 17. Can I use it in a PDF? CSS support across HTML to PDF engines, [https://html2img.com/articles/html-to-pdf-css-support](https://html2img.com/articles/html-to-pdf-css-support)  
> 18. @page | CSS-Tricks, [https://css-tricks.com/almanac/rules/p/page/](https://css-tricks.com/almanac/rules/p/page/)  
> 19. Chromium 131 supports the CSS Paged Media Module Level 3, [https://github.com/pagedjs/pagedjs/issues/248](https://github.com/pagedjs/pagedjs/issues/248)  
> 20. Handling content breaks in multi-column layout \- CSS | MDN, [https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Multicol\_layout/Handling\_content\_breaks](https://developer.mozilla.org/en-US/docs/Web/CSS/Guides/Multicol_layout/Handling_content_breaks)  
> 21. break-inside CSS property \- MDN Web Docs \- Mozilla, [https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/break-inside](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/break-inside)  
> 22. CSS Paged Media In The Browser \- The Publishing Project, [https://publishing-project.rivendellweb.net/css-paged-media-in-the-browser/](https://publishing-project.rivendellweb.net/css-paged-media-in-the-browser/)  
> 23. Support string-set and string from CSS Generated Content for Paged, [https://issues.chromium.org/issues/376420244](https://issues.chromium.org/issues/376420244)  
> 24. Severe layout performance regression in Chrome 103 \[40854697, [https://doc-3qv0-09ag-issuetracker.googleusercontent.com/issues/40854697](https://doc-3qv0-09ag-issuetracker.googleusercontent.com/issues/40854697)  
> 25. Breaking Boxes With CSS Fragmentation \- Smashing Magazine, [https://www.smashingmagazine.com/2019/02/css-fragmentation/](https://www.smashingmagazine.com/2019/02/css-fragmentation/)  
> 26. How Paged.js works, [https://pagedjs.org/en/documentation/4-how-paged.js-works/](https://pagedjs.org/en/documentation/4-how-paged.js-works/)  
> 27. page-break-inside CSS property \- MDN Web Docs, [https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/page-break-inside](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Properties/page-break-inside)  
> 28. Any progress on Knuth-Plass algorithm? \- LaTeX Stack Exchange, [https://tex.stackexchange.com/questions/230668/any-progress-on-knuth-plass-algorithm](https://tex.stackexchange.com/questions/230668/any-progress-on-knuth-plass-algorithm)  
> 29. Why no vertical-mode Knuth-Plass? \- TeX \- LaTeX Stack Exchange, [https://tex.stackexchange.com/questions/114292/why-no-vertical-mode-knuth-plass](https://tex.stackexchange.com/questions/114292/why-no-vertical-mode-knuth-plass)  
> 30. Detect whether a particular font is installed \- javascript \- Stack Overflow, [https://stackoverflow.com/questions/2881645/detect-whether-a-particular-font-is-installed](https://stackoverflow.com/questions/2881645/detect-whether-a-particular-font-is-installed)  
> 31. @rizkyandriawan/foliojs | Yarn, [https://classic.yarnpkg.com/en/package/@rizkyandriawan/foliojs](https://classic.yarnpkg.com/en/package/@rizkyandriawan/foliojs)  
> 32. Pagination Reconsidered, [https://mirror.gutenberg-asso.fr/tex.loria.fr/typographie/brueggemann1995pagination1.pdf](https://mirror.gutenberg-asso.fr/tex.loria.fr/typographie/brueggemann1995pagination1.pdf)  
> 33. How to be notified once a web font has loaded \- Stack Overflow, [https://stackoverflow.com/questions/5680013/how-to-be-notified-once-a-web-font-has-loaded](https://stackoverflow.com/questions/5680013/how-to-be-notified-once-a-web-font-has-loaded)  
> 34. 2 bugs with paragraphs split between pages · Issue \#167 \- GitHub, [https://github.com/pagedjs/pagedjs/issues/167](https://github.com/pagedjs/pagedjs/issues/167)  
> 35. Long table causes page break for no reason · Issue \#89 \- GitHub, [https://github.com/pagedjs/pagedjs/issues/89](https://github.com/pagedjs/pagedjs/issues/89)  
> 36. (PDF) A General Framework for Globally Optimized Pagination, [https://www.researchgate.net/publication/307572946\_A\_General\_Framework\_for\_Globally\_Optimized\_Pagination](https://www.researchgate.net/publication/307572946_A_General_Framework_for_Globally_Optimized_Pagination)  
> 37. Text: splitText() method \- Web APIs | MDN, [https://developer.mozilla.org/en-US/docs/Web/API/Text/splitText](https://developer.mozilla.org/en-US/docs/Web/API/Text/splitText)  
> 38. Page fragmentation: \`margin-top\` of first element on a continuation, [https://github.com/Kozea/WeasyPrint/issues/2817](https://github.com/Kozea/WeasyPrint/issues/2817)  
> 39. \[PDF\] Breaking paragraphs into lines \- Semantic Scholar, [https://www.semanticscholar.org/paper/Breaking-paragraphs-into-lines-Knuth-Plass/0ed30a53d7cd562eb3c98af78c4dd9fcfd9fa1e5](https://www.semanticscholar.org/paper/Breaking-paragraphs-into-lines-Knuth-Plass/0ed30a53d7cd562eb3c98af78c4dd9fcfd9fa1e5)  
> 40. Cocoa® Programming \- Books, [https://book.caibitim.duckdns.org/download/35/pdf/35.pdf](https://book.caibitim.duckdns.org/download/35/pdf/35.pdf)

[image1]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABAAAAAZCAYAAAA4/K6pAAAA80lEQVR4Xu3RP0tCYRTH8V9kUDo0ROkmDmlBkBCtLdGYs6OT76Ah2oSWFqcaegEFOoZrYzT6GsStraGhqe/pPNhzL1eRcLw/+MC9z99zz5Xy5MlOGZc4w0ZqbmHqeMcz2rjBEFvxonk5xgeusRbGdjGSV7QwdsMLpqiFMdt0jyv9HWg5DxKx2z/xjYn8M+5wouTmAm5xEY395hRf8salU8Q6KnhATxmN3ZbfaqfHsYOtoTvoyCt9QzVaM0sTY3nXH+UH9lGSl76PFgbhPTNW6l5gz3Fs05P89/4rh/KqjtBVsrlLpYFXeRMPUnNLZzPIs+r8APsKHo+vlsU2AAAAAElFTkSuQmCC>

[image2]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABMAAAAaCAYAAABVX2cEAAABHElEQVR4XmNgGAWUAkcgfg3E/6F4BxBzIsnzAfEuJHkQXgfE3EhqUAAjEM8C4l9A/BOILVGlwSAIiNcwoFqEFQgC8UIgzmeA2DyFAWIBMigC4mg0MaxAH4j7gVgSiK8D8RMgVkSSZwHi2VB1BAHIxnQou4EB4rocuCwDgwgDxOUgHxAEfUBsDGXrAPF7ID4BxPxQMRsgngxl4wWw8ALZDgIgLy0H4n9A7AEVA7mapPBCDnCQISDDQIaCYo+s8IIBkPdA3gR514mByPACuQYUFqboEkAQwwCJiGtA3IkmhxWghxcyEGeAJBOQgUSFF8gLoKzBhS4BBQ1A/BaINdHEUYALEH9hQOQ1UBbyRlEBAaBkAsqrBMNrFIyCIQMA260zNBT6yKgAAAAASUVORK5CYII=>

[image3]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAxCAYAAABnGvUlAAADxElEQVR4Xu3dy6u1UxwH8CWUa+SamJASKcolJjKQy4CUZCAmCiPl9gqJkjCQIpFEDNyNxD9gQDKgDKSUZCIjSjFwWd+e/bTXWWefffY553nJfj+f+nXWWs9e5znPM/r1W2vtUwoAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAsdVCNo/tBdi3vEwA4AF1e48pZ+8RmfApn13i+H2TXDq9xcj8IAKyvF2u83fQ/r3FU05/Ca0WCMbUkwIf0gwDAevqxxmlN//6mPYUs313aD7JnV9e4ux8EANbT3zUebPpnNu0pnF6GJbxWkrjra1zQja8q1bpraxzaX1hR5l/WD/6HdvM+Tqjxaj8IAKynJ2v8WYbELdFW20bH1fhhSTwy/+gmr3T9JFo3zdrn1jiyubaKn8t80/1HZWdLreeVITnN/OzT28nc/WUv7yOVSwcQAOAAcXCNp2v8UuOO7tpePdO0T6rxdY1jylDJe7e7dljTXySVuizhRpKtLN8mYTmnxnOzn1vJ3A/LUPGLF8o82Xm8xlOz9r9p2ft4qMY3NS6ucUQZnu+T5nrkmcbnAQDWVH9yM0tyN3djkcTmlCVx7Pyjm+TAwSjJYKp4i6TStN1hhytqPNAPVt+VYQP++/2FRub+1Q9Wl9S4qAzPsejZ96dl7yPv4pYyVDDjjObaKEnrdu8MAPif+61pp8LzVdOfSrtsl2rQWCHL2HVlvr+tT9iOr/FH049Uop5o+m+V4XORZDOJ2yjP0h52yNzPmn6StHHuO2WodI3Ge/eHJZJc5Z6t3Kf/O28rw2fbU5xn1fipbKyILXsf41esPFaGv/3OWX+U390n3ADAmklydF+ND8qQYHxf5nupppQE5NSmf02N12t8UePeZrxP2NJeVBH7ssbLZUi+2v1eb5aNCdbHZfOJ1/NrvFeG+c9211KtumHWHu/dz/+9xr5uLPf5thvLs+SzrewNTHKXa62t3sc9s59JpG8swxJpK/vdsqwLADCJl8r2+9P6hC365Ggrj5ZhSTP7vVp9hWyR7A1Lspb/xJD2KPdeZf5OpCq26p6zW5v2r2VY0m3lhGhOigIATCIHD1IR2kr2wH1a440yVMFG/QnTrYwnXNv9YDkR2n+dyCIX1riqxl1l4wnZ3HuV+TuR707b7lRnrt9ehgMHoyS8bZUyHu76AAB7kj1Y/fIiu5evWZk6mQQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADY6B80o3SXO1kCKAAAAABJRU5ErkJggg==>

[image4]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACsAAAAaCAYAAAAue6XIAAACrklEQVR4Xu2WTahNURTH//KRz/AoiRKhRHolopCJYkBIUcpE+YiRHsroSGYGSCmSjAwIJRTK85HExEQZUI+kDAwNJB//v7WPt886Z7vnvvPE4P7q1+3udc85a++99roH6PD/MpaO9INtMpyO94OtGEIn0Qk+kKCbXsAAHuRQsifoJh9IcZz+CO53sSqm0/t0vg8MEC3SLbrEB1JoZl/pch9waAe0Epkbb8oaegdWWi05RfvoNDfuWUBfhc/BROX0hG71AY9m00uv0GHFUIlD9CaaH6wqjqFGDvPoJ1giU+g6uhJW/DFKUIkeduMe/W4V7D6qx7qspW9hZyLJevqN3qNnYFuhLblBR0W/mwq7mZKoYgysnF7QHXQ7fYz6B3ERfU8X+0CMHqBkt8AOkNAqKzElmKObfUT1IVQp6UQ/RLGdnYatWB1aLcbver2G4rarft7AyiJHyb4Ln57d9Dv6D4hKQSt7FcXkF8J+ky9KTJ7sNh/Iies1J3XgUslq+1VC6tMfYN3iPN2MYhmJPXSnG8vJk032etXrFxS3Vsl8RnmGqWQn05ewCdbqkwlaloG2uw/F/prBCn0mXY3+lZgFWzlfg+PoI3rRjQuV1gjY6h+h55D+i07d/xdV2x2PjaYn6ewQy1dwV/gek9HndGI01gV7f9CubYS9T9ymy6LfxKgL6JyoNEvMgM1kXzSmwj9IX8MS3uBieri6h0erdYk+oGfpddj7w9wQn0OX0rsoTihGZdeLRCnp4bpwqA/A3r6qLtJJfob0A3Wdaq/qHy4LVqGd1WQzN94I/SOp0evFox1UQrpOq7sX5S6hUnsaPgcVdZDLKD/wT2iSam9H6QoX0w7r8Kn8qvpvI3TDA8F2bq7OoK7gUfI6H6ku0Rg9uAe2rU1Qy1T7/GuJdujwL/gJVl1x+T9HnCwAAAAASUVORK5CYII=>

[image5]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADkAAAAaCAYAAAANIPQdAAAB7klEQVR4Xu2WzysFURTHj1BEyYYkkfxIKUp2KLIg2aAQ/gLFQpFsXlHKSuptpGQhGxaKv8DGr7JRFlJICmFlgfz4HmeuuTOPeTObN7O4n/r0mnPve2/u3HPOXCKDwRBlWuED/NJ8giPanFnX+DbM0cZTRTVcgMtwAhY5h5OzAj9hu3sAVMIDOAyzXGOpohduwTrYDE/gG+zRJ3mRD4/gJSx2DlEb3IFlrngqKYR7JBuQZsUq4C08hyVWzJMa+Ah3yd6pdDgG52G2FQuLBvgCL0gWzPBi10nKp9OKeTJEMnnKuuZ6i5PUpXpyYZJHkqqrMFeLr5Hcd7cW+5cl+A6bYBVJvu+T/HhUUSV2R9KQPFGTr+Ao3CBZIDehDm2eX7hWjuF1AAd/vhmMfvgBJ8lHtql65C/MwEw4QJIGvOAMe2pkKIVnMEZyv0lR9ThN9hPh4uYfeYa1ViwqcAlxgxwnaY6+4PejqkedGMni+TMI/McFJC9qv+rNxAu1QE5VtSEtsP53xh+oetRbs4J3kHeSd9Q95gV35i7YF0AumWRwWi5S4st/Dja6Yg7U+2eTEmuPrznOu8knnTDhBcbgKzkb1g3JAaZcTdThkwOfFvTz6D3ZXY7T7dA1fkrSOcNAbYZ+P0rORM5Ig8FgMBgMBptvOZ1y7JLcrrwAAAAASUVORK5CYII=>

[image6]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC0AAAAaCAYAAAAjZdWPAAAB40lEQVR4Xu2WTygFURTGj6LkTxIbLLCQrCwoCySFUpT8WUhWFjZWJCv1yoZiwYKXlChlgSgW2CA7kqWdt7IgFmLj//c5d2rmeukt3usNzVe/ZuZ+Z2buPffcuSMSKND/ViO4A58uHkA/yAfH4N3lPYF1kMmbk60l8AGabEO0jd4ySLG8pCkXnIEIKPJa3xoTzXKfbSRTFeAebIBUy+M12+kzzjdiBplJZtQWMx8RnQnOiG80B95AByiw6BGtZ8b4Rk49P4NVsGhxLUE9x0dOPQ/bhvi4nvl9fgV1tiHaRs+X9RyR2L/P6WAUbIFuMAv2QT1oBztgGuSY+BrRQTMuJLqTOs/gmpkEJebI61be9JuqRBdgtHrmg/fAI6i0vGzR7T0kukPyRbeg2lyvgUETGxadTWoIzJhzqgscgEIwD8pd3g9xW74R7/8GX9oL8sAheHF5PGdHMngzlAWORDNLcfC7ooOhVsT7zWfWW8CU8RyliQ7qRHTACVW0Tm+bdsrpNLM+AjZBqWi8u9NUg+gPWrPVHnfF2mluTpfGp7g26PHI2i42cbXg1FwnRKz1cdG1wHrsFM0kf1nZzrrlhnQO2sCC6N/hAJgAF6KLjrEsSdZ4mejH4MrE+UKcAWcWAgUK9Ff1BfPEdlcRzM3QAAAAAElFTkSuQmCC>

[image7]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAK0AAAAaCAYAAADFYNyOAAAFAElEQVR4Xu2aa6guUxjHn5NLbrlHbtlHElEUPihyiSK5hFB8EB9IigjluiPhA3KXW4cSHySlgyTt8kVR+IJOKeQSQgk55PL/eWbZM2vPzDvzzpyZ2e87v/q332bNu/Y7s/7rWc+zZsxGRkZGRkbyWCPtIu0mbRa1jQyPMF67S1tEbY0IHe8YNwyMU6Rvpfeli6Vts80jA2Rz6WTpWeln6UZrwbw3S39I/0h3RG1DYq30pXS3+SQrYmvpIhv+BKzC8dL35mODXje/vsD20hupdvSS9TOZWfXOlRai42mOkX6Tzo8bpuFE6S/p9LhhQBwu/SqdFjeInaXzpHXST9Ln0h7pE1YxTNDHzQPLRumobPN/nCW9aFlDdwH/j/G4X/rKfHwYpyIYE8bm+rhhGujkG2m/uKFFiHz86LS2ypxRziTTniEdIb1gs2XanaRnpCvNI+lDtnKluVq6IDrWBZiWlO046Vbr0LQYZ720JG2XbWoMN/cE6V3pZfOI8Yh0iXSOtNfyqRMpM20aBniWTHuodJ/59XxsniKRKgXIGZ9IzusTjNiZaTHOZ9Kd0gHSmdbOgJNs3yI9bJ57NWVeTUsEvTT5vGgeba/4v9VsV/NrJiL3SaemJZ/927yz26XLpA3meVIT+D6GbVwpJsyrae+1ZSMcYp6zvyPtkBw7Wnow+dwnnZqWDijCzk4dY+CXbPp0gVznScsuY02h4vzTPH8qY5ZMG/JZoimQCjxvHmTYRgKicB/5bEwV0zLRmHBcA9cyFXyRqnPJsgaNB54tFPZFq24j8b3HpH2Sz3mqstm8xnz/mK0UCsWbbPJ34t++mgn5LPchgFkxLQNPcKiTz+YVw0WqG7CqmBYolhnLu6S9bYoHRCGffSB1jNlN4fSpdKD5zXlF+siqG4Hz3jIvvMp0WPhCAdy428wLEAYnRJwyZsm06Xw2EKIVaQJFLtdbJZ+l4L7WVo5BkSiW61DVtEy0q6TvzAMmdVQtQp6Yzl8Pkn6wbAjnvA+suhEw16NWf7YWEdINzMvsLGNWTEt0JVc9Mm4QF5oXZAQSHrYMgSqmxU/4YoO0f9RWGf7BF8nfAJXpRvOnF4G6puWGczNPihsaQMFBTtukECO14J2FohSDpWrByvePiXR72sq90kCVPpjMpD1FfUCcz6YhtWICY9wh5LNQxbSMCWNzQ9xQh7XSJ+aGgH3Nb8Z1lr2hdU0L9LXePHK3QVgVqpiWvcy8iHyP+UAvRscDLIm0FxUKGO1DK34yBW30ASz9PJLdJm5IWDRfEdu6v03BtDyizVsZAsG0jXYPMObl0nvSU+aGJdLGyfE0poUF82fj7NeWRacqlJmW6Pm29IstP4NnRwTzsoUXIJeiiHnT8lMX+v7dVk7aAN951Xx5Y1LmEfq4Jm5ICH3wO8gxY9iCTF8H5j41c4bD9hfvIlTJZzcVFOg8gfzRsu8/fG2+VRfTimkDLGVl1fy0pgUmAAOxzry4Ix1BfE6nIJMoM20dWG7JFft4qSQN94QAMU+0atpJNDFtW7RlWpZkImnf8BvK0oNZpBPThm2S18yLILYoeEGiD4JpmxQeLM1PSwfHDR3Dviq7IV2/ldU31BmkbJvUtEMCw5Efk1awv5uXc06CouXY+GAPsFrkFYqzDAXoc+YPFoZSPHYCkYm3w4j4bLDP28CvRrY0L/IZL16vxLwjIyMjIyMjIyMjc8u/GMAO3wkxzI4AAAAASUVORK5CYII=>

[image8]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAJcAAAAaCAYAAAC6sc5/AAAEO0lEQVR4Xu2aWahNURjHPxki8xAZiutBCWUqXZEhwgMeSJ68yJAnFDJ2X6REGUu6iBIPkhIJmYtShgeRUnigCC8UKfz/1l7Z5zt73ufss7vWr/517lp779a319rfsNYVcTgcDkdj6ezJkZ9OUEfd+D+zC2rWjY5MzIVW6cY8zIDeQ799+gx98H5/hfZBPewNJWIAdATqpjscmeD7PAH11B15aYV+QlNU+3gxC+2qlG8Sl0JrdKMjF9ukeg3kojt0F3olZvX64YK6Bf2CZlV2NZQO0H6oSXc4csEUYzfUTndkZST0CTonZtL89IYeSrBXaySjocNSPV5HPrqISTUG646sLBCTX63XHWJW8g/ogdQhFudgq5gENAxWkNOh+VDfyq42R61tXSEm5agJByTYM3ExXYc+QhNVXyPhuI5D/XQH6CrGnifQcmgZdA8a5b+ojVAvW5lq0Hvl3uKxORW902noqKeT0Dsx1cMQe3FKtkNvU+gK1OfvndHQY9FzaWjLZeiOVHrZQ9A8399tgXraylSDKQdTj1zYfOsaNBQa6JNeue3FDHysai8SJpo7oQm6A6wWU3hYl87x82s+L5UTUAY78hJnK8PjDTFRh3OclrAPOBU239qiOxTsvwi9ERPbGwVDAV02F79uZwinLfS4L6Bj0GIxSaqlLHbkIamtTHNuiynK0kKvxWqcH2JmGLOTbjPYEJp0Uni93xPGqb8kM4Z7WzrhZP71TMz44vbj0tpRNpLaygKN85sFvmM6nszY/a3Xkqz0TDspY8R8TUnFUOX/8sIYDh2Uym0IawtzRQ3Py3huZomyg4ubi1ynBH4YdgZJ+F4QnzFM8j2DY+Y4gs76ktjKd8OtJZ6u8LqVXl8SODbm2nrPMxV0fV+gSxL9IixRk1IkYQlni5g9OX8YYIHAF+WvhKPsYNXFcHNGgvfQmMs8FVMANas+Sy2esVfMM1pUu6VFom2ld3sELRKzgE9Jck/E+7lTn4mpYnIOe5ZI8TyRLyWKqEkpGiac61QbvzhOKPMMVrwXoJvQCP9FEm0H276LOa3QeR3hvazSXoopgIKwz9gowZ7JPuO5hFfia8WkK8ytgkJfnK3+fMt6sc3QHDELbZx3nYbj5Q592KKvG1GTUjRRh6y9JLjatcTZwfsYdnOFhRpA78NxMIEPI8xW/ndDq/ebz3ks//JqVppB1TZhesSCKUl6UlPiJqVoWConKUQ0cXY0QXskOKQVCb0HvV8WmMxv8n7TyzP1sR4wanGxUOIOfaEw2aY7/QbdhzZI9ddSNHxB3PMKCj1hxNnBZJwLa7avrRFwIfAUIutuO0M2PTurvrNSGX7DFhffA70WP67/Hrpuuv5avgyGmIWSbsHWA258TtONKWF1GJQ2hC0uFkgsJBpte2lgaJusGx2hTBKT3O+Q6u2nJdBM1eZwOBwOh8PhKBl/APw60ycI1LAfAAAAAElFTkSuQmCC>

[image9]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAALAAAAAaCAYAAAAXMNbWAAAFcUlEQVR4Xu2aaag9YxzHv7Jk37PL/0+RkJ3+lixZsyZJhBeyhMhetm4kS5Q1S3bZSnhhp1xLES/wwhIpvCCElBdk/X385nGf89yZOXPPzD1nbj2f+nbPmWdm7jMzv+e3zZEymUwmk+mC5Qtl+s1ypmXTjRnpGtOSdGOmdxxkOi3d2AX7mL41/RPpJ9P3xedfTTeZVg0H9Ih1TXeaVk4HMr2DZ3W/abV0oCvuMf1h2iPZvoPcmF9W/wzlWNMZ6cZMb7lMs+2rE1YxvWn6Qr5SYjDaadPfpv0GhybKMqabTYvTgUxvIdW73rRUOtCWLU0/mp6UG0bMGqb3VO6dJ8nWpts1e76Z/rKCPOXbMB1oy+HyfPe8dEC+an43vaN5zF9G4FJ5YVAFnYm9TYeZ1hocyjSErsFOpiNNGydjo3KKPPXrlFtU7mEx2FdNP8gvpC8wr/tMa6cDxkry6/nAdLLpRNNbpq3inTK1YLgXmj43nS03uNdM+8c7jQgpH164s9ZnyHHxso+Y7i70oOkbeeW4Udh5jlxu+noOetG05n9H1oPnxQOncC3Pm97QYLS4zXRw9D1TDSkZ9wvjXRRtP0vlEXqucH5SP1LATgj57yumTUzrR4pXCfnLqXLj5i/fJwEFwNWmHdMB43R5sRlCFPPHAz+lGYO+0vSnuu9JMq+dTQekAwsMvOxfpqniO974QNNLcvsIbGF6QV7441FDLbK76V3Tx/KCjRcYKVUOaCRC/ntJOhDB5BjfXG64D5ge1WTerJAicMNYYOl20h2uhcjxqele09EaXGwUpa9rdrrUhN1UXjQeZ3rW9JHp4mRsoUE7lXtI6xTjfEKeipW9B8D5PW36ToMe9VDV1yfsSwdp6XRgFMgXh7XIMJavNBNCePgYybb/71EOIT326MO0jppdFL3ftBAgH8aAplXfr2bOtAzL8udh4OHrzk3atZANmIj1nPxZpw6iDKLNIfICfyrazn2q6zTw/HCcrQn93y9V/w8Jj7to5qFj7BgwK7CObeQesKnIU5ukJpuabtWgNwzXghGlEClCKDteniMT3m40rRd2akAbA2ZhskDrihfSnA1U3SflHIvU/hxV8+AY6qBpzb5Ojlsx2YZD470B+fEnxWeOI1qXnR+YH3VV+r5hJHDlP8tXXdU/TMFoCDN3FJ8nQVUhMCXvWZMmBCgKuWEhZSDikMdj1EcVY1UPO6WNAROGCc2Pqfy+0er7UF5ML0nGAuM4B5EN54STCOBU+M3JCdE27gMGzDkWy4twjuW4k6L9UngOvJFrxZ7yMMGFBPH7By5uGDx0jKCJp5xPyLHOTbaxunkw5LgY6TPy9g+5O6T5L954Wl4Q4pHPLLYDHodQF7oy6G25wYfvtJhiI6gzYPrRv8nzyrLwjEHQQflMg8VSTDjHRSpfdOEceMOqztGwebCwrzO9L79GcmBShL3ineTRlwIZmMtV8i4SkXTfsFMC+3GfqxbXvEOIP19+kYShJi2v+aLuxyGryx9OGlW46RhhCF8sRAQYMR62jjYeGJgPqU8n4bMFTeYR6peq6yX/pagNEA1xio+rOh1lOwX4RJwfOTC5DfkVF3aBqlf5uKAVU1d8plDAUTXzUHh45MLbF2PjMGBC7Q0qD93jpIt5hPw3wLmIfnXpKCkGb+LGTsit4pSDgonCaZJgdPSEy8JpGSE8nmN6WIMvN9oY8Hbylh0/S6V9d608CsSQkmA0XbzNakPbeWxmesj0i+kuDV5nWVoXwKjxviyeTAGhiIJyLjcFYycX5kHGtDHgJhC1jlDzxTZfTGoepBh0fcb9f3sPRUmci40CudkV8l/j7ZqMZbrhGFUXd5lMJpPJZDKZTKaGfwGYV/h3k9GX4gAAAABJRU5ErkJggg==>

[image10]: <data:image/png;base64,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>

[image11]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAAAxCAYAAABnGvUlAAAFhElEQVR4Xu3cT8jlVRkH8CMplJplBpIGoiARLjQSoXKRoVEL/+BGpQhRpE1gq4KBViIUUZAIpQaDgqaYuCpFB3zVRUEhLipCF85GpcRN0CLF6nz53TP3zHnvfe9978y8zqufDzzMPef+ec+5z8Dv4Zzzu6UAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACwh04bO9Z05tjBCfOJsWNNcgQAHwApBO4bO9d0wSw4sZKjK8bONckRAJzEfl3jv0Nf2geHvq2yffXmjBqHalw0a59S4z81fnnkFXP31vjh2LnCR2r8cexcYpzD1WX7HPar5CjzafI488333VxTphyNkqM3yzxH15cpR6ceecXcJjnK562To3/V+F3X/miNf9f4YtcHACzxdo3fdu1cyNP3+a4vF9W+3bTCoZfiIDE6u8afxs4FUmDcWeO2Gh8bnlsmYxvnkPaiMe83mUPy0RdYmVv6eq+WxfNNju7u2inc+gKut0mO1vVujSu7dh7f07UBgB38rxy9qnJ+mS7auXg3363x8a7d5H15fy/t3wx9TVaK+lWh0VllWq25YXxihW+V7XM4XI6ew167tMaPanxmfGKXMrfxOz5cthdWL5blOfpm1765TJ+3aIUtTkSOkofDZcpLk3FlbgDACrmQZlvqoRr3z+K1cvSFNIfRt7p273CNt8r0vsdq/KNMF/Rlri2LC5jPlmmF6PTxiTW0VaFxDmORs5dSjFw4e5xtxnO653Yrc0uO2twSmduYo34VrWmFa7aGW45+WjbP0S/KZjnKWP9Q5uN/skwrs+9nQQ0A+0bbSmyrLYu2Encq2HLRfaBMF/hzy9F3kX6ne9ykGFi0FRd570tl2m7bjXW3DPfSX8t0RituLMd2TmudLevkaNHZs7Zlnfy0HDXZjly0JblTjrI6t0mO8nfG7dBskQIAa8j216oL6bKCLQXJWDj0tsaOsnz1ppcbDb5W4+dl9WsjcxjHnPaiYmSvjAXkschcxhyNc1tWsOWQ/6LCNa9N8ZYx5vvr7TZHq2RrODccnEwFNQDsG1n1yVZbfyHNBT4X11EKhLZi1Hxj1r/M1thRHSjbP2eVx8eOQebQr0Dl8zOHFAqRc13Pl+lcVs5yXV7j4TKdy/tVmQqW781eG8/UOK/G57q+3codm7eW6W9mO3TTLdHkqF8BjeSoza2X/vG7zeraTjnK539h6NttjvI97ZSjbMeOBXXG1ReKWYXMql5W7nKHcVZbs4Waeb5SpuLy0Oy1T9W4qUxF56a/CwgA+0K2ynIOKvHPGrfUeLbrS0HTn1W6rsanu3be01676I7Q2Brabbv1eMkc3ijzcbQ5vDNr59/MoV8hTIGSAu7BMl+Ryk+V/GT2OFLEvdC1N5UzebkRIGPaxJijFH0tR5lbctT7S1meo6u6/ibzfmToO945erTMx/B0jU+VxePKql7yFCne4uXZv1nN+3aZ/3RIfmfub0WxBgDbZKUoh+d3untwtDW0c9HNofdF2kpUO2s1xrEYC7a0W8GWoiB9ORSfyApP+r9S9t+PyN5VphytI8XOl8r03d7R9a/K0ZiX45WjvmDL40hukovkKjcnpFjNmDPeL9f4Qdnd/0cA+FB4rsYlY+cCn6zx4zJtVV7W9f++LP8V/vae/k7IPo5FflojY8nKzROz9ms1/lym7beDZSp28vfz3M9qXFzj73nzPpK7OJOjddxe5qtcbUUrVuVozMvxylG2Pw/U+P7sccaUbe2vlukmhxRnyd0tNV4v0zbse2W6MxgAGOSg+Sa+XqyG7JX8oO0m5AgAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA4efwfUk0DpL4bYvAAAAAASUVORK5CYII=>

[image12]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAaCAYAAABRqrc5AAABFklEQVR4Xu3TsUtCURTH8RMlCDUoDhEOYYPY7JpbS0tE/QdNEa3W5BTR3u7g5OIW4epeQ1OKIJRLU2NDhdr38N6F+6743n20RPSDD/LuOe9w7+Up8mezhAJybsE3DXxihiunliq7mGDfLaTJBV6x5RZ8k8UdeliLlvxTxDOuUcYBNuwGn+h9TPGCS5xgiEO7KSl6H3qpR9ZaS1IcbwUdmX9Bh+jOzLFWcSwLviNzHzfWWh73GKGCNm7xJAvuqop3iZ5/G28SvKw71Wjfo8QMGYe/Jmf4QM1aix1SwgA74fMm+jiX4P9kEjtEG0/xgKYEA3Qny3aTJAwx0a92HRm3EMZrSFJ+NER3WEcXXxJ8U3uRjv/84nwDzSowU7rpjgAAAAAASUVORK5CYII=>

[image13]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABNCAYAAAAb+jifAAAISklEQVR4Xu3da+ht6RwH8EcuuQ7myBCaaKSRmCInl+ENEy9cMpEojReYiVKESBq3YoomRcIkCrkUMoOYphPSNLygiCbqEKNmQgmFXNa3tVZ7nee/L2vttc+x//t8PvXr7P2sf/uy1qn17fc8e61SAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAYKP71wMjvLUe2MLJeoDRTtQDAMDhSvD6ez04wvvqgS1cUw8w2p1NPaweBAAOz81NXVkPjjQ3sF3X1PX1IJPc3tQf6kEA4HBc1NSf68EJ5gS2C5t6ZFO31huY5IGl3YdPqzcAAIfhOU19vx6cYE5gi7z/d+pBJnt/VwDAAXpBU5+pByeYG9i+0dQL60Eme1uZdxwBgD32/w5s6e49ph5kMoENAA7Y3BP9nMD2oabuWQ+ylbnHEQDYY3NP9HMCG7sz9zgCAHts7oleYNsPc48jALDH5p7oNwW2JzX1l6b+29Rv11S21/WEwlhzjyMAsMfmnug3Bba7NfX20gawS6pttdwaKyHtV6X9+2vP2Mo6c48jALDH5p7oNwW23h2lDWFT7j16Sz0w0t1LGxTHyEVnD8Hc4wgAByG3/kngeHC94Zgbc6J/RlOvrgc7YwPbPcpiqvPiats69a9I71sWr7PMm5v6cD24wcfL0feZ6yFl8Tn/2dS9m/rgYOxniz/dibmXZwGAg5AT8M/L+M7NcTEmsP26tN99mbGBLb5X2rDy6TIvIL2jrL535o+aenQ9uEEu3vuSenCDC0r7fdZ5fjkaLLMfT1dju5DA9rlyeP8/AWCS1zX1t3rwmMuasVNl3j0opwS2uLq0IWbO/UtPl+W3YXpEaW91NVUu3Jt1c5skCN7Q1MkyLhjdVI4Gy3z3/F/atYua+mNTl9YbAOB8kq5QujfpZIw5WW/roaVdeH+f0p6En9WN36+pK8qZa64e1dS7S9vJiXyuE009vKsEsv7xMglq/yjte62S98hrrjI1sKWz1k8Lrnvddf7d1Iu7evJgPGEtN5OvZT/muK3q6mXf3lwPVh7X1Jebeny9YY2EtVOD5zk+/2rqmYOxXco+TccUAM5b6a59YvB4GBRWqS9dMawfl9W/msyU3xu6x5mq+1Jpw0Y6QX3H5uVlMd2WwHWqexwJl7c39diy+j3yen8q6ztS7yxtyPhPaQPPMlMDW1xe2qCY4DVV1oKlO/f07nmmcxNM+8dZK9fLJUXuKouAnY7XKgk6/esMvai0lyXZJqTn+HyrtP9vUrnJ/VfKmZ9xly4u7dq4Q/khBQBMkpN11h5lHVvkRJyu1o3d+K4lPPRdsQSlPixl7Dfd40i3J+Hva9V4PLe0i+mXeXZpw9qYEJJwkft9PqDe0NkmsEXCUfbj6+sNGyRg9jeLzxTo6cWmI2vxErSy4P/Wpq4ri++b75T9M5R9nk7cKlmzltdJgBsj4Tpdu3TvIu+dIH22umtDv6gHAOB8kHDRL+hOh+d3ZbGwvQ4JQ/105LJKOFg1RTcmsF1T2k5fLmERdWBLF2vdOrGsdUqA6APFKgmpH6kHB7YNbHFnGRcah7JvEoYiwS2dul59LNIZHDtFuKrDNpR99camXlXWTyNHAv1wnV1+XZwp9T70nw3Zl+nMvrTeAADng3Rk+pNvpraGU051SNiFTIn2a7FWBbZ09k51j7PuLeO5bETk14uZSs1auHzeVcEwPwBIqFknC+TXLWTfJrAlWOR6bNtM3Z0ePM53znH5WPc8n3UYiNIRG4amLzR1VWmnSjN92MvnSSCfIkH52/Vgp/8xRx8sI5+tn8KOvOfnS3tsft+N5bjH80ob6NOhyzq/K0s7ndp/z1US4DN9DgDnraw5+2xpT/pDuw5st5XFtbveUtp1XqkvNvXXblv+Jh2cdNDyq8V8pnSrXlHaNUz5m5zs39Q9zmstk1CQ6bO+W1hLUM2aq1XTobFNYEsXKNOs28g0Zy9hNMflKd3zrCschsvLmvpJaf8u4S0dsqzrS2duuI4s3a/s011IeM7+zn7P8crxeU/3PJXj0/9woe/+JWAPn0e+UzpyCekJdZne7r/nMun4JXwn7AEAlV0HtnMtIeFT9WBpf3CQk/+qsNebGtie2tXZ8s2yfroygS7h7bVlMR373q6WSVhKsK2ntFMJZ3P0Ae1U9bz/P/XD0nbX0g3Mth9048ukCztcMwcAHJAEgTp0Jsj8tKmXlcUauVWmBLa85lX14Bony/rwtUzCzdfrwUrWIfYSyKZeNPdcuLAe2CBTrvVxBAAOxLLANsXYwJb1alm31ne1xsgvYLeRLtq96sEVXlMPHFNzjyMAsMfmnujHBLZ06bJGrJ5SHFZ+ZPHKpj5aFuu98itWxpl7HAGAPTb3RL8psKWjls5aH8KmlAX04809jgDAHpt7ot8U2Dg35h5HAGCPzT3RC2z7Ye5xBAD22NwTvcC2H+YeRwBgj2Wh/5wT/ZTA9sTS3rR+nax5u6IeZCOBDQAOWC64OudEPyWw5f6nuWDtKrlTw41lcQFZxhPYAOCAJbDdVA9OMDaw5Qr8nyzj7h8qsE2XfbbsjhUAwAHIPTVzCY1tjQ1suYfnd0t7385NBLZpLmnqjrL6nrAAwAHITeRP1IMjjQ1scW3374PK0QvnDt9fYJsmN7efE7oBgGPirrL5HpzLjA1sCWS5wfrl9YaBy5q6oalfNvWBahvLvau0FybOPVEBgAN3QVPX14MjXF0PrJF1bOzWV+sBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADjr/gf3NmN5AqkeUwAAAABJRU5ErkJggg==>

[image14]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAoAAAAaCAYAAACO5M0mAAAA5klEQVR4Xu3RMQtBURQH8CMpSpSBDBYpsSqlTCYGZovdJ6AYZZfBbvABZDEYjCYx+AAWJovNgv955z3OvVaDwb9+5d3zf8999xH9VPIwhg4UIWiOJVmYkBTm8ICu0XBTh6H7209yQ+Q9ficHW8jYAzshWMIKotbsIy24wwB81sxJDGawgB3coGQ0kCRsSI6En9IkeeOeLvFgRFL09sUvdYGpV+Kk4UzmefE/HMl6Yo1kP2W1xjefoKHWnOIVCmqNCwdIqDVKuYtV95rPkj9f+9VQqcCeZPNr6ENAF3T428YhbA/++V6edoEhw7l7aiQAAAAASUVORK5CYII=>

[image15]: <data:image/png;base64,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>

[image16]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAFcAAAAaCAYAAADCDsDeAAADlElEQVR4Xu2YW6hNURSGf6Hcco+ERC6RUEIiuccDihIhxYNLKS8uUV6keFBSKJE8uJR7LgnllAdELg88KHV4oIgH8YBcxtdY0157nbPPPmvvczpLZ/31d/aaY+6z5/rXmP8Yc0k5cuTIURajjAeNW40TjR2KwzkqxQjjYbmoV4x/jNuKZrQcOhlPG3/J1wX5fMfYy7jW+DkWg++Ms/lyFrDAuCf63FYuctdCOBMYa/xivK66u4prxr8ZxydiLY6RxifGoclAFeAhLVfdHdBZbj1LE+PlsEKld1R/Y63xkbFHcajl0dF4U77VuiViadHGONP4UC5I+2icv1wzTpx5aUA9+GmcmgzIx4gxJ5NYZfxt3K30Nx5AUbxr3KWCrZDBc+SikslcpwXZSFbWyrM0CbKZrObhZQo9jaeMV43PjN+Nk4tmlMcA4znjIWO/aIwHNEYu9na5HVQKbOuT8YZxoPw3AgcZb0dx5mUGLO6B3AMRY5k8A3bEJzUAspOteFHecQQEsYlR0atF8Nv7xqMJXpLvuEz5LWIekIsbfDZkyMkwqQTw6C3yrJymgo0EsRF2cDTWFPjv/HaI8b2Kqy+Z/EblM3eG8aXcS+P+vM742Dg6NlYtgt++NvZNxEAm/Xa+3F/j2YDgNOALY2OlQJZSuMheClkAlnAmIp+rRehvzxvbJWJcM545v0VcFh1vuhH1herPkFJAwONyK4iLieAUmn2q7kBSSX87Tm5t+42r5cWaQ9Iw41552zkrmovF7YzGTxinROPoE3yd/8dJkM/YYfIQUwdUXYScF13zIxx91/+bkQ6IeU3u40HMeM+7Sf4bacD3ueFSfssRl2J2LBkwLDa+le9GOpVbxiPyfnuCvDj2lu+MV9FfkopePxRnOhHWPsm4USlbSW78ufwp18ifYGj6K0EQkyLJEw5ihtMaC10UXTcExDhr/KrC+4If8oyjdaQn/xCLQeoHtSCAI32NsUt0zT0iOGC30naGtpH1YCsr5WuP7+YlcvE3qIL+n3/cR4VFNAWCmCx0bmwcsWn78OnhsfHmQH3iMgbi4pKd9+TC8uAuR/EAWknugx2ZWtzmBLugvsMDnlXWt6pEY8XFy4kBfJs6sUZ+kGL9xLEMXgyRxa0eFCA89aO8rdwstw3GsAZeYVLM6Y2ny19aUWvYVRfkO4sa8TQihZNTLG/dyODuytFoYGNs/3K1IEeOHDly5Gg9+AsKOrnjezpuRAAAAABJRU5ErkJggg==>

[image17]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABUAAAAbCAYAAACTHcTmAAABGElEQVR4XmNgGAW0Bo5A/ByI/yPhd0D8Csr+AsQTgJgPpoEUMAeIfwOxDZq4EQPEgl1AzIMmhxfwAvFhIL4LxOJociCDDgDxPyB2QZXCDzSB+C0QrwFiFjQ5QSA+zYDdF3iBHwMk/IrQJYDAEoh/AvEJIOZHk8MLJjFgdwnIkD1A/BqITdDk8AJYmIFcsxSIZ0HxQiB+BsTzgVgGpphYAAvP3UAsD8SSSJgDSR0IMAOxJxAboIljAFh4VqFLoAGQ/GYgfgjEvmhyGIAmhoIiidg0CAt/vIbCEv0DIJZGlcIKiDJUB4jfA/FWBsxIwQbwGmrLAAkb9EIkGVkRFoDXUHLB0DAUlOgXAfFXID4OxKUMxMXDKBj2AABmUkDqcZPXCAAAAABJRU5ErkJggg==>

[image18]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIEAAAAaCAYAAACQAT/QAAAFIUlEQVR4Xu2aW6itUxTH/0K5XyISdfZRCIkSRaQjRHJJ7gcvp+MWKXL34FqklMuJ4xrlGiLXoix58MCDBxyRzlYuIZQojuv47bFma+6x53dZu7Xaa5/z/erfWnuOb63vm3OOOcaYc22po6OjY5xsato2No6IrUybxcaOyYLJX206OBpGxBLT8/3XjhGzzPSj6b9MP5vONe1oetf0T2b7zfSMaUs+3GcT0yrThVlbzgr5d+b3+CFr+950pWnz9IEKDje9pPFFm2GhX4xH3q9v5M+5j+njYKO/d818ckJ52PSv6ahokLdhe8y0UbDB0aae6icHp3nb9J1p96yd7zvJ9KfpfrlDVcG195mujoYFJPXrJ9PewQYXyB1gkp65yPamD0zTpl1nm2agA3RkeTTIV++bpkuiIbCb6Wv5gOVRBHYxfaXqgcw5xLTGtDQaFggcGsfuyeuWHJyWhfOX6bBgmzgYeCaAnBtXIn/TXjVBB5q+UNmWk6LJbdGgwUDGKFEiOWzJIaugYN2p/1oH9o1jYwN1/UrP+ok8tU40DGhVyCIyTMs7Q6cihLv3TFtHQyBFk+OiwThTbntac52wBKnrSZVTUw72i03r5N9PbXOPaZv8oozz5FFpGJh8vvvEaJAvkN9VXlwTBwPzt+lk+SDkOk3u6VxT4vG+6mBr95rKK32J6XN5EcX7NuBQbRyPWuVR0w79v0lD18jT0lmaveq5N/2oq2siqV9ESdJUHDuKXRyEhTLRpJCFxz5hejBorarrAXJgT+VQmJOiCbsQcmT67mflO4M7Vb06S5wgryGaVi27lVKNQ33yovzeTDzPgWMcn1/UgjyNPaLZ40Y/6e96Xw8kJyilkZyUNx/S7JWys+bmaXI3YbnuYAgnKEWVyB6a26cEqWJP0+WmczSIFsOw3tUDDEakqR5o6wSpHjglGjL2Mr1ielXlSjsHJ/jVtH80FGACbjV9ZLpbfp8qjtBwzpDqgVKds6jqAYqsqpBFG7aqeqCNE+R5sxRNIkxwT81O0CYdEPZxYJ7/VNMNpm9N92pu+mGirpdHpzZUnXsk0uJaNPXAtMq5s+58AFK6wJGqSOcDPdVPbKKNE/A8X6p5wpgATu9yONegOKQe4MSP5yNtkMdvUvOOIzGf84Ep+WEX9zpdXpc8IL//taY35KkwPQOFOieMq00XyVPnARrUHUQgxPvbTdv5x4ajLmSlFdwUdlllXFeVw49V/e4i0sYJrlP9PROXqpzGgLTARK0z/aJ2x9Y5bAlZIKV6gBRELVBy1IPkiyI5BwuIyWdXgkN+KI+YRBraSdM4BdELpwWuxXaG3AlYrLG2aoSChrBIJ5I4y2fbRE58S4O9NeI9+/It+HCAwWB7F4sffnvgO/N7sHKW5RcVaHKCFH3qUtA4YccR+7XWdKi80KT2iL+13DHzSYeFxzUpldEPnBpow8Y1CZyIMWH88z7zQ92ncicc2gFGzVLTZyrXFPOhyQm43xr5vnwxUnKCNLm5EzCxq/piYebXAXYWw8saLoKNBULVLfJc1zaf1tHkBGzn2NcvuPfPk7ZOEK9jxd8sr4cY55Xy6ENNcVW/bUEhl71j2jcahoCihuLmfQ0OriiCclgRr2t8/7MwbqZML5j+kNdIZ8ujKOI9bdRgT5n2k69yDtIoCnmlzsAZevKfrKlrKGZJP4zXlBYYJuY5DXfsOgx4+o2mK/rvNxRYHE0F8ERxpOmy2DgijjGdrw3LATo6Ojo6Ojo6xsr/qEg816ykl3AAAAAASUVORK5CYII=>

[image19]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAF4AAAAaCAYAAAA+G+sUAAAD5ElEQVR4Xu2YWahOURTHl1BmGSJRF+XBlKSUMVeIB0OGIsOLDEkRSSm5kTx4kyFToox5UCJF3SselAclRSSXRIgH8WD2/3/rbPbZd599zne/4V46v/r3nW+vM+2111pnnSOSk5NTHtpD3d3BMtEF6uAO5qjDD0NjXUOZqIEuRr+thTbQZOggtA4aLhp8maiF3kG/LH2AlkO9oZvQD8v2CToHdebBEe2gA9Baa8xmpeg57Wu8tcbeQFugjuaABCZBl6RyWVUsU6A90HjonuhcZts7ZOEY9BOa5hpEx2g7IbrKLtOhBgk7hAt1A3oNDbbGeb650BfokOgiJsF990NbXUMLwftYGm0zaJjtacETowd0F2qE+sdNBXgBrqa5iA0vdA1a7xocBkAvRZ1vZwvpBz2H3kNDHZvLOOghNMg1tAAMyNtQL9eQFU6Wk2YNdSOO/zme5JQx0BPx22xM1ux2DaIZwExws8GHCRJfEFSbvqJBcESKqO02nAQj2pfCzIBG0cly0i5roFtQV9fgYLJmlmsAi0VtZ6XpwvtgWTwt/rJXTXj9naL3vsyxZWIf9B2aJ5r2thaJRir38XEyUgi2gVfEH9E10GPoQbSdBS5ilsWuJAOhetFgYZlkGS2q/JnU/QydEk0bW88kub6zt24Qf/mwMVnD7okPaHPu86IdzV6om9k5A+wcOFkGRojt0IsixGdVz8KRYUaKBsuC6H+dqI/mmx2yUEp9N473lSgbU9+PSjybWCPt2jhMNLMobidBx/uypxqwmbgs8bJo5pfmhximvm9yDZJe37M63tT3UESMhjZCbaEJohE4MbbHX+j4j9Ao11AFeE9sfedYY2wwWDFC82sCH1TfxD9JjtGWVN+zON7U96SsMfAcT0WzwGQa781H1lLD+3OfWSH1EV34EAxQN9voJ5ZMLkAmSunfSZqDiOnfG0QdkQTfkvkCwk7BLFbSgvN+zCKFYC1eWITYcaW9ANHx7qLTT3w+pB37B5MivvpuJp+W0nQO90v6gDVTwl2RD94XHcvy42ObhK9ZScy9jYj+M0sYvHx7T4UPg1fS9NvJEtG3sOvQV8vGbfbNnXiwA2sdW0FGrA2/9fCc9jWYorX2Th742eGM6BuqD5NlofJWSZiRnNt96Dh0B1oRjVcV9q6PxP+MKBY6na0lnwV08JC4uQCvx7fFpIWpFuzGWOpaIusKcKV3iX68KmXVOZEdog5l/WS9XxXbQ+EbIvv/Zr2i/2/wAVov+j26ufDTsV2WfO0ny+BVqdw3/38SOuOChD8NlwKzqQ7aHG3nWEyFNriDZWIGtFpyp+fk5OTktEJ+A7tY4LPJNf0DAAAAAElFTkSuQmCC>

[image20]: <data:image/png;base64,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>

[image21]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABNCAYAAAAb+jifAAAFNklEQVR4Xu3dWahvUxwH8CVDpnLlZogyFYmiTIk8mLoSmR6UBw+KB09SZCgXKSWZKSkhkiGKN+KGokiUGxkyZAgPUjwgw/rdtff9r7vu+U/n/t3zP8fnU9/O3mvv/8PZT7/WmBIAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAACsCHvkfJLzYnd/aM7HOas2vgEAwJJ7KueH6v6S6hoAgDlwZM6anCNytslZveljAACWUl2crc85q7oHAGAOHF1dR8H2fHUPAMCM7JRzds63adMCbJxYcPBzzgHdfQyJ3rHxKQAAMxMF25k5N6bpCjYAALaya5KCDQBgrinYAADmnIINAGDOjSvYrs35J+e79sECYgHCdam8HwEAYAbGFWy7pUEBFteTOCXns5y92gcAAExul1SOl+qLsVE9aBfk/NXl9ObZKI+2DZ09c3ZtGzu35pzfNo7wbNsAADBKbJNxT9MWG8vu27QtR3VP2/bNs2l9n3NQ25gdnnNg2zhGHIsVvYQAABOJ3qFzmrbfcrZr2par2DA3Crar2gdT2DFnXdq8hy0Kr/u6v9P6KE1f6AEA/1PRc1QXIlF8/FndL3fRs/ZQKkVbnHiwGKflnJvKSQkxd27bqv3z7roVJzKc3DZWHs55om0EAFjI3zn7VIkhvhgSXUn2T6Vgi8JtMUOjMXz5as4tqRRod1Xt67rr3iE5b+dclHN9KqczLCR++0bbCADQiqG+6GGrXZxzeXcdc8COqp6tzfm9uh/msZxf2sYldnUav1BhmC/TYNgzFgy80l3HAoV6kUIUZ9+kMtQZq03vT4Pfndq/1IkeuPbbAwBsJhYcxBy23u457+Ssrtpaw1ZR1mKI9YW2sRMFTAxN1r16dVYNXp25H1Mp3KZVF1ZRsJ7UXbcFWwyRTrqYIAq2r9pGAIBWu+Ag5mfVCw4uTaUICdHrtjbnte4+Cq/Hc07s7mOl6d2pbL0xqmCLIcnobbpwSI4fvDpT/Vy2aYdE41usq65juDN6Hs9I5fv1vW3h2FQKsVrMd3sg5+amPXoyh81/AwDYsKfYH6kMEf6as0MqBUW/BcaHg1c3FCAxvFf3KkXhEkODUWBFAROFXl/ExPNRBdtSiOJysfPFTshZ011HsfduGvxv8X9/2l333s95JpXvcmcq3yqK4qfrl1L5fpP2xgEAjBQFWwxV9icLREEWvWh1z1IURM+lMndrHgu22EQ3Fh4sRvSQ9fPQQgznxty/EEVqFGa1eD8K4n4laXgylUUItdjWI4pBAIAtEkOib6Wy8CAKtOgR+iKVuW8xwf7BnCu760e699/LuSHnp+53sxQ9XPfmHJzK0G3dEzjMB6kUbJNqC6txojgdd5JCrDCth0Sj6DuuugcAWDGiYIwh27BfKisyh539Gb1fL6fpNrWNOWgxt2xah+Xc1DaOcFnbAACwUhyTyhyxEMO0scoy/i4kFhhEJnV7KvP6YlgXAIAZiCHYOHZqIf2ea9MmNhEGAGBGYm+0fsuRVvSW9T1s0+S2+DEAAFvuze5vbJnxX260CwDAlPbOeT3n6y5xckG/yS8AAHOgXyVaBwCAZW7cFhov5axvGwEAmC/1Ae4AAGwl56Vy0kIc/9Qf4N5m53gxKdgAAJbM2uo6Ntht05+CoGADAFgCq1PZ/uOKVM46bYs1BRsAwByIw+IBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAmMi/h97K5d3xOrYAAAAASUVORK5CYII=>

[image22]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAsAAAAbCAYAAACqenW9AAAA9UlEQVR4Xu3SoYsCQRTH8ScqKOqhGC+IeAjX/AMuarJpNPgPWLQYxSheunbRfigGu2C0mkwGsVmMd3B33+fOwDK7cggXDP7gAztvht03Mytyk4kgj6w74WaET/yg58yFpoEvvLgTYXnDDo9OPZAMVlgg4cwF8owj+masmy2jhqRdZNPCN6qIY4gx5hKyYdtvCQNUxFsUOJ0c1tjgXbyWNNpGFykzPsf2exLv7drCg3+BP1ct9l/GE7aYyYUjdC9jIt4edC91tE1d0ljiAzFT08U61vN9RdHUpYADOrZAmthjaup6Qefog34uagsm+sU/f9V7/j+/q+oqHbeR1QMAAAAASUVORK5CYII=>

[image23]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACQAAAAaCAYAAADfcP5FAAABlklEQVR4Xu2VzysFURTHj/xIIaRIFmKhlIWyUn6U5MeCRP4HyUqhhI1kb2GhLHhhYydk93YUe1IKGwtZWlB+fL+de3Pn6tXMpDep+dSn19xzunPm3DPzRFL+MQWwBlb5gSRYhu/wC655scTohx9w1A8kxQJ8gs1+IAlK4THMwvJgKBka4D1chy1wDNa7CfmG8/MJH+AqnIK3cNxNyiecHw70hLO2IwkdYRE8lN83Z0HsGI9uCD6L5jE/LoVwGLb7ARc7PxvOWjW8hHewzqwxzk7GZREeiT7kiBcL0AFfJTgvrfAFHoh2pAKewS4nJw48gayEKOjR/Fpm4BvsNtcs8EK0m50wA/tMLAqhCmqCN/Lz9I3wGs6L/r8Rdo/zMwAH4SmcNbEohCqIN52GV3BbtBh2iANo4fywaBbD/EpYbGI9cCuHm6LdtYQqyMKvNQfY3sjCTU7gpOhRLQXDkYhUUC7c+eFGe7BN9FMQlT8piN+NfdG3rVd0flZgrZsUAu6zK/pGn8M50VOJDI+wxLkuM2spKSlh+AZ4h0asaUw0FwAAAABJRU5ErkJggg==>

[image24]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABIAAAAaCAYAAAC6nQw6AAABTElEQVR4Xu3TvyuFURzH8a/8SF1Cim4GMShlMylS0sVAIv+DZDKwYJHsdoOExYpsRsVOSmExyGig/Hh/Oude53ku9ZzJwKde3Z7z/d7znOf73Gv2J1KBZjSmCzFZwSs+sJ6qRWcYb5hIF2KzhAd0pgsxqcUhTlGXLMWlDbfYQBcmkQ8bskbzeccd1jCLa0yFTVmi+WjQ08HatkU+ahUOrPxL2kgn1COO4tFcn/q/TXE+m8FaE85xg1a/prpO/mN68WzJeXTjCfvmTlCPE/QHPWXRRvf+s5h5vGDAX2vjM3On78MOhnytlA5c2dfd2nGJRXP/P0Wn1XwKGMExFnytFDXP4QJb5jbRiSqDHs1HN9Mm6m9AdVBPRL9uDTbdoDd5hBlzj7ScLGdPOJ9x7KLH3E8iKmPYM/f2Bs3NZxUtYVOW6FFrguucX/vPb+UTJkk1grZaZAgAAAAASUVORK5CYII=>

[image25]: <data:image/png;base64,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>

[image26]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAmwAAABCCAYAAADqrIpKAAAFVklEQVR4Xu3dT8hmUxwH8KMZZfyJQeRf0wglCmEnScjkT0SRwYIFDRsLiYUNFpT/C6UpWUgxMiXyL81SZjs2opBSNkpYkD/n9957e+5z3Hvf55l5Xu/Tez+f+vXce85t5vSuvp1z7rkpAQAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAADDskVznlY3rZJnGAgCwNJ7MdVHZ2OP8XAfKxtrbuf7JtaPsmMM8YwEAGI1ZQ1LMfL2X6+9cJxR94Yhc7+c6uuyYw6xjAQAYlVlD0nO57sz1Yf1bOi3Xt2XjnGYdCwDAqMwSkg5Lk5AWM2ix9Hn7pHtF7D/7PdcTue7O9cJ090xmGQsAwOjMEpK2p+ll0FgW/bx1H2I59OfW/b7W9axmGQsAwOisFpIirEUYa4vZtZhla+9X+yvXjfV1LI8+1eqLcBdtq1ltLAAAo7RaSNqb6+SyMU32s23JtTlVM2oR4OL6zVzH5rqmfjaWS49K1T64IV1j2ZOq0Li/aAcAGI2ukNT2R67vO+qnVC2NXpumZ9ROyfVdqpZQo47JdX2ue3J9VT/Tp2ssX+e6OR3cEisAsEHFBvvrcu3M9UCuS6a710S5gT88k+uOVM1gNeL61bpvUbpC0rw2perv1ojrOOYjxDLpTWm2GbKusRyZ68VcdxXtAMCIXZ3r5db97tb1ou3K9Vmu14v2W3JdmKo3Lj9ptcd1LDtGXzyzCF0haZFeStWY4wy3e4u+0tBYPkjToRAAGLHbWtexd+v+1v1aiCXEdmCLmb3f6usIKG+kKvBsTdPP/Zomm/zbji8bslNTf9gZCkmLEHvXQszCraZrLL/kuiBVf4dm1g4AGLEIaLFR/s9UvQX5zXT3migDW1w3ga25v7iu9nPxTDkz1/iodf146g9roSskrZeusUTQOynX4UU7ADBSl6Uq3MRm+ZgZemu6e1C5Kb9d8TZlnzKw7Uvdge2G+roxFNhiyXRbqkLOw0VfqSskrZdlGgsAsKTK0/kfS9Ws21W5Pi76FqUMbIuYYQuxd2yWGcIyJMXM4v9ZbeVYAAD+o/2yQfMx8/iN4NY+CLZLBK++iiW9PmVgi/+nDGyn5zqzvm7EMzGuLs3MWnywfVvRV1qmkLRMYwEAllT7nLBPc71SX8dJ/VekKgQteqYtAltsqG/EcuwX9fVZuX5o9cXyaohl2xhTHE5birD2UOv+3DQc2pYpJC3TWACAJRRLnzGbFr/HFX3P57ovdQektRIvP5xRtEVQuzXX5UX7oegLSSemybJlHJ4bf5un6/v4DNWByaML0zcWAIAV8cJBlwgqcXxGzISdnargtpEMhaQdqdoL1/Zlmu27oAdjaCwAACszV13aR2I0Z4ptJEMhKfbwxd65tvJFgUUaGgsAwGgNhaQfU3VobyPCa5xRt1aGxgIAMFpDISlm0+LbpU3FCxd7pp5YrKGxAACMVl9IiqXQeFO2EbNrr6XJXr84auTKSfeKoXPhGjFjt7dsrPWNBQBg1PpCUrxw0D57bmuu/al6e7SPwAYAsAa6QlKEqn1p+oWDeDu2/cJBzLjF57Li99FUnf/2bt0Xb9XGfSyhxjEpu+v2Z5PABgAwt0MJSRHY4riT+GxWiBm2eJO2XEp9J9f2ul9gAwCY06GEpAhsW3LtTFUwa77Y8GCuzan6dy9N04EuPtMlsAEAzGERISnC2qY0fU5dHDjciFm19vEgfRYxFgCADWdXrnPKxnWyTGMBAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAOzr+ViOJ9PFspBwAAAABJRU5ErkJggg==>

[image27]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADIAAAAaCAYAAAD1wA/qAAAC+klEQVR4Xu2XTahNURTH/0KR77ySKB9JiaQ8ogwRAwaihBkykYF8lNGTFElhZKKXgQlmPgfiFlFMDIhEPhIhKaEo8f+3zr5vn3XP5+1dA91//brn7r3P2Wutvfba5wBd/f8aTUb4xjY1jgz3jf9CC0g/zIBYcmwS6hu1mJxD6/MKNZQsJ5fJN/In4jd5SY6TyeEGp6nkFpkbtc0ij2DPeE9mRn1VtYWcRsUgzCb3yAWyjTwlX8h2spGcJB9hBv0i6+y2poaQE6TPtUtajSukAUu7uhpJLqF1zhZNI8/IzuT/BPIgQddBeuBBmDOfkI78PJjz+vWaQl6Rw669jhTMuyhJsaNI56FS5C25SIaFQYlCdOTMjqh9PyzqWZtc6arUXOs7akgp+Zws8x1FWkR+ID+CckCOyHgppM6B5oi0NE77Yz5ZCTNG+7GORpEbyJ8jU5thhuZFcA2sf3fyX5v/ddLuFZz8CSsEevZZcg0laZIh3afM0X6spFPkM5njOxLJARm2NPm/kHxA9rKH/aFoBsM1/ivyA5UnrWwDFQuGBjUSsm7QHrkO2ye6lmTYm+TXS87J6dhojfuOgdRUhJXOSrsiabwvQLlS1VHZDZN4ySDluw6qoCJH9By/uiF1tbKbYOfWY+TPGaT+F7CDtVQqwYpWllG9sEPR1/MiR5TXt8mYqE2pG6empHFVHGkgO1NSCmkjQtqE9n3kISwFvFQa35HVvgNmoAhSNJ+Q80if1FUcURXVXlMFy5XydAUsUnodWE+2ws4SpcYxMrY5Oq0eWGrE50pQHwbOI82hgMgRHcKxyhzRvapYWs1C7UL63UqvIzJgA0oiAJukH9mT6HC9CXvWVVhqTI/6g8oc0Qa/j/qVrrb0CqGJsiqKHJ1IxvuOSGWOaD9pJWf4jsGWDL1DVvmOiipyRIE4lKDrjkvLrrfnuFCUSd8vZ2AlXS+dR9C6cvoU0Cb3+6pjUrT2JgxW5FTZtP98ye+4NPEessR3tCl9D7Wbrl111VWkv/J/lsN5BpKEAAAAAElFTkSuQmCC>

[image28]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAC4AAAAaCAYAAADIUm6MAAACrklEQVR4Xu2XTahNURTHl3xE5CMvEpKPkqSUjzJQBhTFhIkiAxMTI0KMnoGBiQzeSCImJBMRJYMbJWVigiKJRCaMmMjH/2effc8+651z77nvnVvU/dWvd9/e5529zt5rrXue2YD/j4lyjpzgJ8bAZDnLD/YDFjojd7txHmaenOHGu8H9ztvo+zXOUXnO8t2eIi/Jn/K33JeN98JceVdu9BNNsVo+lUv9hDgkv8l1fqIm2+V96/3EusIOj2T63Ob3yxYeitwfC+T5Y7nXT4yXhfKV3OonxJB8biF4/1C9QO3clJP8hIfCmC8XVDg7v/RvwG/komQsQnqQJgeyz7vkzMIV9dgh31n5Gm3WyvcWCqrKB3J6dv0J2bLyHCS/f8nX8og8Jt/K9elFNeChP8gNfiKywkIQFASFdt1CRW+RFyzf8TTIK1Z+jDG/v1reFfi7VjbeS+qwJjvOiZVCASzPPq+ysMBUC0d1Ml7kIHD0UIwUZRpkDBzjw3NyB62Yfp4YeK2WethCUcApCylRRlXgMb9Jl8gy+clCqi2W1+Rt+cJCcFXEwEm3jtCCHlreKQis18A51u9WzEvuR84PJ2M84DOrF3hlqkTIcVocrQ4I7GI+XYBTSYs1wiIsFgMiXej1Hy3UUqRO4JwUf0fKVkIrvGHFgiPwlxZapIdUoFfTs1M2WegmLAoUKGmyp31FoE7gnBotl7qrZI38YsVvKvL9s1yZjEVYmAD9TdmAs/KRvGrhBHfa6G5SJ3CKsmXlLbcNN6Yj8FYX6fSKyfgTq654FuPtML1fSrfAOXWKeNiNN8J+C29x0/xEDboFTj2wMWldNAa7ekdu8xMd4PuBb9J78oeFmvLFx+mflsezz31hibyV/WyKzRYeqCpNG4MCZYf4J2K80IpptX0PesCAf50/Q9V3ZE23M7MAAAAASUVORK5CYII=>

[image29]: <data:image/png;base64,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>

[image30]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAwAAAAaCAYAAACD+r1hAAAA1UlEQVR4Xu2SPQ5BQRSFr6CQSNBodAqVWqFWSHQ0dmAHtG8R9qBRiyUQm1AIUYlCJcE5rklmxhuPQqLwJV9z7/yeGZGfp/jwLTJwCE9wBvNuO8wIXmDLb4SowwMcw5TXiyUH53ANK24rzABeYd9vhKjCHZyIhpEIB01FJ3FyIkxoK3osHu8lHbiETdGLMwAGEUsXbmBDNFJGy4gZ9RMcfIQ9q9YWfUQ+pgMHnUW/hv1YJbiCC1gwxRrcwwhmTdEiEt2Fu93hilwpbQoerJflg8/45/vcALruH5wG+666AAAAAElFTkSuQmCC>

[image31]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACYAAAAaCAYAAADbhS54AAACVElEQVR4Xu2WzatNURjGH/mIKETdRMlHhJQSI0QoBiYmFHORCYoYMTCVdAeSkhFJSSFkcDOQMjCSIgMSGfAPGPD87tq7vc/bXut2OofR+dXT2ed991l7nbWe911bGvH/mW4ttKbFRIaZ1vwYHDY85LJ1MCYK8Jur6u83fXPGuqLyas21TllrWrFF1hNrays2NDZYb6wVMRE4bf2xjoX4Puu5NS/EB4IVGq9UWi1YbO2y5oQ4PntlHQ7xgVhqfbD2xESf4M/71oyYaIMpx6wlGS1obp2c0CdrWSsWYbwd1malyu1iv/VZhXE2WV+UvJDTCyUjwzlrQnl/LLceWCeUfEgVdm05k/5qbYkJWK30EMyIke8qVctO64aaFWtP4rbyW4CXriuNO9t6rPyfYFxW7EBMAOZbVV2vs24pDcgyn69vCjAx1MV663h1jTXY8mtNuod6YkdiInJSyZBwQWnLuihNrM0267fyzbSeGC0lC+X7Uk2l8eBBJ0bv+qm0E10Ut7IGj9ECaAXAg2826R5Y1XYxdIH/8CHm5yztYqX1Tck2nVDa99RraCb2XsknEVbinVLzzEGOe3L+AqoRD+ZWVButX+rtwvjth7W2FauhzD+qMKCm9hdg+gl1V+wk9BiWu90IS68nxF+rXE0YuuQvduaOdTHEB+ao0htCfQbiN9rL7ir2tFI8I2voc/w5PocKy//I2lt9p7I4IXgNOmR9V/61hh26ZJ2trocOR8/D6pPz7pn1VunEyJ5/ZrtSoeWsMhTwEP9+VkxkoB3Rbv7ppEaMmIq/5bxicPLrC5AAAAAASUVORK5CYII=>

[image32]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAEwAAAAaCAYAAAAdQLrBAAACPklEQVR4Xu2WQUgVURSGT2ggJlgtEksoS5CESMhciAsXQkW4MlAh3LRVVKQikRZKtAt0I4gQ4kY0qHWFihs3LgNBceOiaFGB2DL0/z13nJnbfePVzTzkfvDhvDNnBufcc+6MSCAQCAQCgbPDIHxkBwOFeQk77GAenIdVsLqAF+PUXDlJwcpgm2j+VXgudVYpgbfhE/OXv4+lEe7A/Qy/wgvRBTniW7Am+AN+h3uiz7AKbyRy7sMtuAyfwUk4CysTOf9RB1fgQ1gL52Gz6MpMS9xhFZruhPdYFy26rz2HV54cn4LVwI+i/xdh1wzAf3BbtJP4jJvwgaQ7j/HXVixFN7xljnmj96KtzI31VZSUA4W2iHHY64hfkXicuBh8riQswAvRTvsmWqzOVIbCvFF40z7hog++MccjoquZFy2iHW7LTv7siE9IPG7v4D1znISLwFwWjfcoT58+Ygi220Ebzi1nPErkLPsWjCvLFbZXPcusEc/CZyTHxF0wchfuihaNHecavX7YagdtuIexTa+Z3yzYTHw6E74MHou+aXzl+J8Gn4J1GW3YFF/gIvwjuqfZY8mFnBPdzwvCVl2AH2CpibFgG6L7SDHhUzAWZgpeT8QuixaKcT4vF/iv8amJceE5zs/F3XlH3IG/Jb1Rcj/7CesTsWLAp2CEb0p20ye4BH/BYdHCRDTANYk/ndhxb60cJ6zmJUl/tPGizO+RnPAtWAQ/uJNvUBccQ+6r/Do4c/Dtedr9LxAIBAKBQKBYOADhBmyX5aqR2gAAAABJRU5ErkJggg==>

[image33]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIoAAAAaCAYAAABo4cQnAAAFGklEQVR4Xu2ZaaiuUxTH/0IRmYeErstFPhjCVTJdmTMklzLlA4XEF2W4KMdUxg/IkETUzZAxlKLc+CIkyRSJJEIo8YEyrJ/1LM86+7zP875vvec952r/6995nv3svd+99/rvtdbeR6qoqKioqKioqKgYHxsazzQ+YLzJuMPsz/9id+Ot8jrUpU2J3A91aVPxP8EexveMq+QCOc34lnGbVGel8SPjPsaNjTcYXzFumurwTBnfqENd2tC2Yi0HYvhALpJ1jBsZXzX+ZtyvqbOj8TPjWc072Nz4tvHiVHZFU8a3AG0+Nm6byiqmhPXlBuZvH/i+bllYAOP+KPcqgSOMV6oNLRg7CwcgqtXGNXLvEcJ5JNUBy42/Gk8qyoeCwaOu7Tq4WVt1quB3y7EEGe8wo0wDGOci4x/Gv41/Gu8ybpIrJZwjH38XCBVvyg28ZUMEWIqL3yiFAhDFt8ad5UJDcKVQaENb8p6RQcz6Sj7JLuL2cH/TAgK4XXPHUfK4aLCAOMr4kNyggHVi539tPEOzDbxEbrScQ5QI4yKWe4xXG+82fii3VYB+uoQS5SGILqGU5Z1YJndTxxqXGh83HmBcIc+QY/fixrpAH+/IxTYqWcAusENn5IvDwp5uvE0+DsqOaZ4H7bKFwIXG7ctCeQL6jPE7uUGekIvn+FxpAMKIfxlPacpYk1vkeQX9Yo81Tb0+oZwo31ClIMYWCkbYpXlGyQ8bN5Dv1FVRacogSTtbvjgAz3KkfKcyvkFHxElixvi7PE8YBbsa1ysLGzCH3YyXyucUXqcPYUQ8yFapPIx+gQYnt4EsFOw4EaFkkClHzLpKoy/UfII8hKMd8RaBvK7++D4psIDjzB+D3ig/zt6p/nuKw9QvmL2Nv6hNSAOld8iCyMjlXYLoKh8KYiZGYOeCcRYK908YKJPNPvaFsgw83gtyL8fkMMRiEwoCJvEkuTzVeI3xG3mYLBNaPA85R9+xlG+fa7hQ2NRdQiHEMS42GIltKYgQCg5hLJCjfKo21tLxg+3nXuAGibss0qjMx74ucAx8Wa3BmNyX8h2XgTGuNz5qfN64l7wtBrlZHq4OauruZLzf+JjxWnkSurU8ecalvygPPa9pdKHQ7pCijN8noSU/OU9uNEIUed91asPqICAmxlfefeTQAzjacsKKzQ3YUC815DlymXgP0IZTWm47FCzSk8an1MZahLLQFzIsPtn/wc177IJ8mYRBEAfxn4V4Vi4QxITw+csciOcRDg6X77gV8nmTQ3BrSU6GAVkP+hlVKJdotkEz+E2EilF+Nl6mwVfsJThJ/aDWWzCunMwCwhc3tTPNO1gmnxueOMDacIBY2rzTF/PlVNV3+pqDPY0/aXbnGIPd0Bdr5xvs/DwZDM5C3fFfDRcCSR8utgQhEc/FQtFPLDp/n1Pr1un3fbWCBOOEnvkAYiWEfWE8Xx7GEMD+uVLzTp3L5Z4aL4Sg8v0Sz/fJveTJcpGwZvmoPRJQGDsiHzXpfCy1zQPCdWYwprwIGB0jxy4LLDG+IRfJFnJhdAmFnIfcJ8f6hRZKgBMgxj1a3fdYlPOdetQfBGyM50RMh2pxXFROFSTR78pzLIBb51SBkSOBYxNwcjrXeKDmCiVyofifCYu6WotDKBUTxHJ5DoKLxu3uK3fJCIjLMNzy03LXe0Lz/L3xXnlyC3DD0QcCwZ1/osVx81sxQQwKnzyT8I16e5v7wJ33nUwqKioqKioqKioqKtYG/AN3lhVE9huw8wAAAABJRU5ErkJggg==>

[image34]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAIsAAAAaCAYAAACHI68ZAAAFC0lEQVR4Xu2Za8hlUxjH/0KRuxEJYdBEhFwmuTQkl0RCMYhSM1PI0IRMjd5CciuXkqTkgwgjGuT24R0+jJjiA6ZIhkQUn/hAuTw/z37evfZ69z5nnxlzzjtj/evfe87aa6+z1rP+z2WtVyooKCgoKCgoKCjYfCww3m980rjCuH/z8b/YzrjQ+KjxceMFxu0bPRzpWFcad24+LtiacalxtfFY4+nGj41/GC9J+iCU24xrjYca5xmflQtix6QfY31uPM64q/Eu4zvGPZI+BVsp9jO+bzxbLghwuPF745fGg6q2E4w/Gk+rvoP5xm+M51Xf6cs7V830kPYyfmS8MWkrGDPwWrw7NrgLO+UNGRDBb8av5MIBjEnU+Nt4ftV2j1wYaXraTS60p+XvIBLGYsxAjDUtn/NIIGQxKX60jXvWXccKfjefS5D5pqF2kiCcPy/fSPiTcbHaawc284a8MQPjkYLY8HQzn5GPf6FccK9rtljoPy2PHEQQaplcLICxfpBHot4gj32reqFtfNe4S7wwBiCCBzV7HjnDwyYJvPQ+4xLV4qV+eNn4gfGoqi1A/bAya+uDSB2kHYrVEEWXWKIdUXSJpa29E+TBaXl+Y4F4x8nGRfIiKbx4UKhijPVywfUlXtcFjD9lfMx4sPEK4wPyedB2bvV5X7V77rjBJt6i2amH72fJ6wWKU+w5LRfQgXW33rjc+Ke8oGVsbIAgBonlsOpzmyhGFgsbwYDgSHnYI7zhsXdEpzGDguxq1cYnwlDoEdmYX2po+lxjvK76PAlwBD0kb0xAtEE0RBP+bkrqxGk2yJ0o3icNU9MMEst8eVZoE8XIYklBZUzBBFjY7cmzSQGDcMRj0YjkPTUNs4PxIfm8QywnGc+c6TE+nCiPzESO5cbdm49ngDNyF9IX1C/UJoyZRtI83XS1d4miq30omBAbgQcDBuorFhZASoiU1YeD0loKIt8auYFZ1CdqGqYNiJ4CcJy4yPiF8Sb5nLEftcVizU6VRM6+NUsIhRQUznCGvM7EUV5St1g4EVFM40htomCO32kTUiI1C4s9oPrOQE/VjweC9ICnXDYCSXnDQHh/U7VoWexG+SVVAKMx13vlxrtebpi3jY+oTg+nylPYc/ICE/HdKi9CmQ9935JffiG0V+Xpr8+lFevnZnRe1s4mMM6H8nHZUP6yifwdBtLNw2pewoG75dETYJuf1bTnPsbP5KcggJCpdSIQgDhJwWHH+AaY1AtylWJwwAaQI+OMPwlgUAwRF06IBSEQOVJgTOYb4HMaWY43viHfTMjno+Vet1ZeB+C11GkceUknfOceYpmGAxstzRsrEFVwpHXGv4yfyuuWiBJdYE+mjL+reTAgEmxUfdzlcEEb0SyA3VjHKdV31oxgp6KD2t/rhWOMv6j5IhsSR7RJ4Ql5/g/vZlMQMDVKCoQxSCyEYVJsRDU+8zzCdfRFjK/JRQQYp28q/q8RjpFfFcC4PwngLF/LBXut/FqfCJsKEgegDycpbMAYHPdHLrYZlB9PcyuD9AnBWxKEx7y2YU75ArvEsre8liKdps8DbWJ5pWoHkxTLqCB6sA6Yp8MA6fIc48Wq/13wv0OXWNj8RfJ6jGgS4j9CHk23JbEU9AAFLsUs19ZRXyyRF643y4tMIuYK44vyMH2nPOKsUl0ME8pXG3+t2knDhO31mhu3xAVbEITcPF3NhdRaUFBQUFBQUFBQUDAX8A8e+hNkYWU9FAAAAABJRU5ErkJggg==>

[image35]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAHcAAAAaCAYAAACNU8MOAAAEKklEQVR4Xu2Yb+iNZxjHv0JN7I+IaWRGiTJi2GrLErHWvPCnKFJkhIgXW0hJ7cXYvCBrGW2UWhItf1K8+I0XZGtbi6ltYpKy2t55Q43r0/Xcnufc5zznd06dnd8P96e+Pedc5z7Pc9/3dV/Xdd+PlEgkEolEIvFsMdz0rWlQZO9hmmrabfrC9L6pZ0WLRLemt+lr01+mIQU7jv3I9L1phGmA6bBpn/w/iSeABaYHqnbuJNNd09sF22vydrMLtkQL6CePHiKqHs/Fhjq8Ko/Ek6p27ic1bM+bLsgjvbN+PIYwHyy/US29lDdtKzw37ksQ/W1HenpRXg8fZvrbtEi1ax+TvyY2lkDfPzdNMR1UpSNZIKciG7DAOkw/mPoX7KVMMN1S3vlaOmfqG/7QBhj4Z6ruR6z3wh/+J4iOT00rlC8k6t8x0yXT2MwWmGfaHNnKoO1G+TNi5wYnljk3ttdklLwxOZxOs0JZSe/K00WIEm5aBvf4Ub5AGhUrvwwGu820R76LXGjaKe8HtlnZZ3aWtaKnlRAdG1SdAvk+3fSH6Wf5XHXIHT40b1YK4/pKnhUgdi5XvsdObMq5TNzI7PMYeS4nJRARm0KjNjPMtFj5hBLBM+SZg/41Mnmtoo+8LpZBNONkopVrI2UiZCWOOIHYuZSc65ENmnJukbXyIg509uPCb10Fgzwr3yXi1PNqclAt4g15ViMy15teqPz5MQQGZ9F6zFGejgOxc8ucWGavC+mBiSNCgIc16lxSIymShzWqemm+CJnlhHzSOBr8oiYG1SJwxu+mdfL+MDccURapuiyQdTqrubtUXabuy/cQd+SLiMVzVNVODM5lx8zmrSGouQzglew7A9if/1wX0iWrdX4TogR0BinxjPJFhnNvmsaHBvIUt0yecQ6YtmZ2+rTN9I387c7LmZ1J2246ZPrO9HpmL4P77JAfgYqQRfj/ZdM7cgdwZdK5NkscucC4/1HlXA00XZWPqSGYoCPyldIrs/Gwa/K02FUwSQwuHOJx7j15+Qhg47UcKY7ND+mOMeyV123gykaMxYJD+E4mOG7akrUpg/F/GBsziFoW9UXTf6Yr8rpbTLeNQPvDptuq3E+wUcVGtggwJxzF3irY6jLO9K8qb8IEknpGF2zt5kt5jQs7SiaaBcfZMDBCHs0dymsh9flP+conS3A9bXpTvur5vbuwSj734WhHeiYth2PnXNMN+QJbavrNtFpNLKCw6ov1g2gOk9pVEF1xbaZPxR0pUUqdWylPiUQmR7mb8qguwvdf1d7ddiugJHyQKS4PTzU4bEn2mQ0G6Y1oJlJDJmLxkj7ZT/yk/L0saXpa9jnRDcG57KaXy+stNZRopl5xhMLG7nVm1n6y/G0baY43TxMze6IbQikhMknfpPGYOI1DrTKUSCQSiUQikUhU8gh3u9BxLNZHewAAAABJRU5ErkJggg==>

[image36]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAABEAAAAaCAYAAABRqrc5AAABTUlEQVR4Xu3UQShEQRzH8f+GUjaRJDlsJHHmyE1JaRMnNzlJrijltMmdg1ISJRc3ycHFnYMTUgoXJ0cHK9b338zUzLz37J43v/q0vZn//ndmmrcidZscOtAWT9SaDZRRwWY05zKMnXgwzji+UYzG+3GACaxgHut+gZ81vKEvniC9OMYL5tAUTps04xxXyIdT0ok9HGEXl5gOKmx68IwtDIgp6rZzLRjEiJgzabU1ieh5/IhZbgmLeMSMV6NNp7znRPQ89FBnvbFDSd9eahpxKskvaBNdmdvWn3Hnse2NteMaT+jyxjOjl+hDwv0P4R0nYlaq0QNekIwbrU1e7afLMj4xJuZV0GZnuJOM7elFesCofS7gHqti3icX/ZFbyWiihUu4wb6YBrqSBr9IqjRx0Vurh5h6paXGJtVSJ030rPR/5AJfYm73ZFDxn0R+AaUUOf8GctHjAAAAAElFTkSuQmCC>

[image37]: <data:image/png;base64,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>

[image38]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAADMAAAAaCAYAAAAaAmTUAAADC0lEQVR4Xu2XTahNURTHl1CEJF/5SmRAvhNRGEhiwMhAMcbAyGeMzsTAREIp1BtJIpn4nFBkwEyJQiIRQsyk8P+9fXb23ufsc+/r3mfy3q/+nff22nffvdZZa+19zQYZOIyWRqSDHdC19cZLG6St0jxpaGyusETqkcamhg6YKV0pn31miLRWeiTdlLaXuiO9kJb/mxoxXborzU8NYoJ0X/pT6pu0IJphdrC0eb2TFpa2NdI162OQhkvHpNdW3TS2s+Y2sjSxEYATUpGMp2yRvpvbbBGbeiEgD6W5yTjrn5YOJeNZ2OwZ6au0IrF5SLUv5hbmCzxE+Xn5bKKQdpmL+jNpcmQ1Wyydk4Yl47DK3GdmpYY6dku/y2eOcdJj6am51PEQsevWXKijpPPmok8weDvbohkunfcmYx7/3cxpZI703uqjFeIXfCNNKcdwAEeO+EkZZpuLOvOJ8k/pljQymEOKrw7+TyEYFyzOigqFuUgdTcZT2NAHi53hyf+b/aQMm6QD5d84gCM4hGNAoC5ZczDJABrJmNTgoY/fM5di62NTBezMCxdcJn205ohCYfH6pBgB9PVHPVKzdfXiIWBhICv4yFLYLNjESat2Ipx5Wz5z+HqZFozxBkhrmgFF3VQvHpwhM8iQWrwzjR6LGebOmc8WnyXtOBPWS0hhLjh7rHW9AM78MNf1aqEr0Z2anCENDpv74n2JrR1nOF/4fIpvPKTpbYs7ZB0t04wcvSj9snxkOHc4LDk0OY9CiDobosBzFFZfj/4wJEhcWZrqBUjFV9bcJHpPdDbbY9XNrpM+ScctbqMe/2Y5DOuYaC7qi1JDiW/Tuc+H0P5bnWe9cH15ae5O5u9j3M2emHMo19sZJwg0h5BJ5tYK71unrHpZJUBXLZ8VHt4ab6/tKw1fREfjlkx+TrW8EyG0WTbOWdFf0PHofv5c6jf4qfBA2pgausgOc4dqWgb9Ah3rstXXVacQrBuWvwB3HdKR6wpqJzXbhbUKc0dCN9dtCSmwX1qZGjqAX7o77T87MsggA4G/J2WStVh5SPcAAAAASUVORK5CYII=>

[image39]: <data:image/png;base64,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>

[image40]: <data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACkAAAAaCAYAAAAqjnX1AAABiUlEQVR4Xu2UvytGURjHH6H8TH5ntJCJEjaTxaCUkvIHMJiUhFFKFqWkpJQBxYbJwEZZLDKTzaYYDPL99pzbe+4T3st7daXzqU/33uece+/Tc855RAKBQCDwXZrhEOyHpWYsc9rgJdyDY3ABHsByf1KWdMJHOAeLXKwRnohWNnNYqSP4AFtdjImtwxnRpNvhjbPBzUmLYjgIu+yAD6v4BF/hveiSr8BuyVWVjMNDWOLFklAG+2zQMS9aoDvRc/ApA/ANztoBwxacsMEEVMFJG/Tg+LnkSbIHvsjHkypEl6MWnsFluAuHJV7lr0glyRrRJV4ycSbPk14PO+At7IXV8Fh0OyQhlSQJN+21aMvZFE16FVa6cX8/sqpXcASOwn3Y4uYRvsP2xe/QbXjhPVO2uIjESRIua5OT9z5rcNrds6o85bySRYknaUmtkvngoYk+MgU3JHfK/0yS3ItcJlaTV+7jiEKSZH/cgc+iW4J9mS3rx/Bl/tBSSJK/DpebPfZUNIm6+HAg8H95B6oAQgf8wvdHAAAAAElFTkSuQmCC>