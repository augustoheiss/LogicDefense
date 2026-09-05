# 🏛️ Master Plan: Expansão de Modelos A4 (01 a 08), Cover Letter Integrada & Schema YAML Avançado

> **Documento de Governança & Contrato de Engenharia**  
> **Autor:** Master Plan Architect & Technical Educator (`agency-master-plan-architect`)  
> **Data:** 31 de Agosto de 2026  
> **Status:** 📋 Proposto para Revisão e Aprovação (Zero Código Executado)

---

## 1. 🎓 A Super Aula: Filosofia, Fundamentos & Visão Geral

### 1.1 O Problema Real & A Dor do Candidato Moderno
No mercado de contratação de alta performance (Tech, Design, Engenharia e Liderança Executiva), o currículo isolado responde apenas a **"O que você já fez"**. A **Cover Letter (Carta de Apresentação)**, por sua vez, responde a **"Por que você é a pessoa certa para ESTA empresa agora"**.

Quando um candidato envia um currículo com uma identidade visual moderna e uma carta de apresentação em Word sem formatação ou desalinhada, há uma quebra imediata de autoridade e consistência de marca pessoal.

Além disso, diferentes culturas de recrutamento exigem diferentes densidades de informação:
1. **Modelos Modulares e Lineares (ATS Direct)**: Focados em scanners automáticos de palavras-chave.
2. **Modelos Executivos com Sidebar e Timeline**: Focados em triagens humanas rápidas de 6 segundos por recrutadores seniores.
3. **Modelos Editoriais e de Destaque Visual (Brand Accent / Warm Magazine)**: Focados em posições criativas, design, produto e liderança institucional.

### 1.2 Fundamentos Teóricos & Padrões Adotados
1. **Separação Ortogonal Tridimensional ($L \times T \times V$)**:
   - **$L$ (Layout Wireframe - 8 Modelos A4)**: Define a geometria do grid, proporções de colunas, headers, timelines e matrizes.
   - **$T$ (Tema Visual - 5 Estéticas)**: Governa tokens de cor (Navy, Coral, Slate, Emerald, Terminal), fontes e contraste.
   - **$V$ (View Mode - 3 Modos de Visualização/Download)**:
     - `cv`: Apenas o Currículo A4 de 1 página.
     - `cover_letter`: Apenas a Carta de Apresentação A4 de 1 página no design espelho.
     - `both`: Dossiê Completo de 2 páginas A4 com quebra de página perfeita (`page-break-before: always;`).
2. **Total de Combinações Nativas**: $8 \text{ Modelos A4} \times 5 \text{ Temas} \times 3 \text{ Modos} = \mathbf{120 \text{ Variações Visuais Instantâneas}}$ geradas a partir de um **único arquivo YAML**!
3. **JSON Resume v1.0.0 com Extensões Canônicas**:
   - Adição transparente de `coverLetter`, `references`, habilidades com `levelPercent` (barras de progresso), `hobbies` com ícones vetoriais e metadados de perfil civil/nacionalidade/CNH sem quebrar parsers externos.

---

## 2. 🔍 Crítica Cirúrgica & Red Teaming (O que pode quebrar?)

### 2.1 Premissas Frágeis & Mitigações
- **Risco 1: Quebra de Página no PDF de 2 Páginas (Dossiê Completo)**
  - *Problema:* Quando o usuário imprime ou salva em PDF a versão combinada (`both`), a Cover Letter pode vazar para a página 3 ou a página 1 transbordar.
  - *Mitigação:* Aplicar regras estritas `@media print`:
    ```css
    .cv-page-container {
      page-break-inside: avoid;
      break-inside: avoid;
    }
    .cv-page-cover-letter {
      page-break-before: always;
      break-before: page;
    }
    ```
- **Risco 2: YAML Legado sem o Bloco `coverLetter` ou `references`**
  - *Problema:* Usuários com currículos antigos importados no histórico podem não ter esses campos.
  - *Mitigação:* Renderização puramente defensiva: se `coverLetter` não existir no YAML, o app exibe uma carta padrão gerada a partir dos dados do perfil ou oferece um botão "Gerar Carta com IA". O modo de download de Cover Letter exibe um placeholder formatado sem quebrar a UI.
- **Risco 3: Sobrecarga Visual na Toolbar**
  - *Problema:* 8 Modelos A4 + 5 Temas + 3 Modos de Visualização podem poluir a barra superior.
  - *Mitigação:* Agrupamento ergonômico em abas e dropdowns/pílulas colapsáveis:
    - Grupo 1: **Modo de Exibição** (`[📄 Currículo] [✉️ Cover Letter] [📑 Dossiê 2 Páginas]`).
    - Grupo 2: **Modelo A4** (Dropdown / Pílulas `Modelo A4 01` a `08`).
    - Grupo 3: **Tema Visual** (`Executivo`, `Criativo`, `Minimalista`, `White`, `Terminal`).
    - Grupo 4: **Ações de Download** (`[⬇️ Baixar CV] [⬇️ Baixar Carta] [📦 Baixar ZIP / Dossiê]`).

---

## 3. 🗺️ Esqueleto do Implementation Plan (Mapeamento de Arquivos)

### 3.1 Lista dos 8 Modelos A4 de Wireframe

| ID | Nome | Estilo Inspirador | Características Principais |
| :--- | :--- | :--- | :--- |
| `modular` | **Modelo A4 01 (Modular)** | Padrão CV Maker 2.0 | Cards modulares, badges destacados, header dinâmico |
| `linear` | **Modelo A4 02 (Linear)** | ATS Clássico | Linha contínua, divisores finos, alta densidade textual |
| `sidebar` | **Modelo A4 03 (Sidebar)** | Modern Executive | 2 Colunas com barra lateral esquerda para skills e contatos |
| `compact_split` | **Modelo A4 04 (Executive Duo)** | *Imagem 1 (Victoria Wotton)* | Coluna esquerda com avatar, profile, barras de expertise e hobbies circulares; coluna direita com header, timeline e 3 colunas de referências |
| `editorial_accent` | **Modelo A4 05 (Brand Block)** | *Imagem 4 (Basil Hailward)* | Bloco de topo marcante ("hello, i'm"), foto vertical, badges de ano sólidos, marcadores em seta e grid de interesses com ícones |
| `corporate_timeline` | **Modelo A4 06 (Navy Timeline)** | *Imagem 2 (Wilkins Micawber)* | Sidebar sólida de alto contraste (Dark Navy), timeline com nós circulares conectados por linha vertical, dados civis/CNH e barras de nível |
| `warm_magazine` | **Modelo A4 07 (Warm Editorial)** | *Imagem 5 (Editorial Cream)* | Fundo bege claro/editorial, tipografia imponente, selo circular sobre o avatar e gráficos de idiomas |
| `hero_matrix` | **Modelo A4 08 (Hero Matrix)** | *Imagem 3 (Mary Smith)* | Barra de contato superior, hero header com foto à direita, grid duplo de experiências e matriz inferior de habilidades com barras deslizantes |

---

### 3.2 Estrutura de Arquivos a Serem Modificados

#### `[MODIFY]` [`types/cv.ts`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/types/cv.ts)
- Expandir `LayoutVariant`: `'modular' | 'linear' | 'sidebar' | 'compact_split' | 'editorial_accent' | 'corporate_timeline' | 'warm_magazine' | 'hero_matrix'`.
- Adicionar tipos `CoverLetter`, `CVReference`, `SkillLevel`, `CivilDetails`.
- Adicionar `ViewMode`: `'cv' | 'cover_letter' | 'both'`.

#### `[MODIFY]` [`templates/defaultTemplate.ts`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/templates/defaultTemplate.ts)
- Incluir no YAML padrão os blocos `coverLetter`, `references`, `skills[].levelPercent`, `hobbies` e dados civis.

#### `[MODIFY]` [`components/Toolbar/CVToolbar.tsx`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/components/Toolbar/CVToolbar.tsx)
- Adicionar seletor de `ViewMode` (Currículo / Carta / Dossiê 2 Páginas).
- Atualizar seletor para os 8 Modelos A4.
- Adicionar botões de download específicos (Baixar CV, Baixar Cover Letter, Baixar Dossiê).

#### `[MODIFY]` [`components/CVViewer/CVViewer.tsx`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/components/CVViewer/CVViewer.tsx)
- Implementar a renderização dos 8 modelos A4 e da sub-página de Cover Letter com paridade visual idêntica para cada um dos modelos.

#### `[MODIFY]` [`styles/cv-viewer.css`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/styles/cv-viewer.css)
- Adicionar estilos para os novos layouts e a formatação A4 de quebra de página de impressão para Cover Letter.

#### `[MODIFY]` [`services/standaloneHtmlService.ts`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/services/standaloneHtmlService.ts)
- Adicionar suporte a alternar entre CV, Cover Letter e Dossiê no arquivo HTML exportado offline.
- Adicionar funções `downloadCVCoverLetterHtml` e `downloadCVDossierPdf`.

#### `[MODIFY]` [`components/History/CVHistoryTab.tsx`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/components/History/CVHistoryTab.tsx)
- Permitir download individual de CV, Cover Letter ou Dossiê Completo diretamente de qualquer versão salva no histórico.

#### `[MODIFY]` [`CVMakerApp.tsx`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/CVMakerApp.tsx)
- Integrar estado `activeViewMode`, novos downloads e persistência no `localStorage`.

#### `[MODIFY]` [`backend/routers/cv_router.py`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/backend/routers/cv_router.py) & [`backend/services/cv_html_renderer.py`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/backend/services/cv_html_renderer.py)
- Suportar parâmetros `view_mode` e novos layouts nos endpoints de renderização e compilação em lote.

#### `[MODIFY]` [`backend/prompts/cv_prompts.py`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/backend/prompts/cv_prompts.py)
- Ensinar a IA a gerar automaticamente o bloco `coverLetter` sob medida nos 5 arquétipos.

---

## 4. 🧪 Protocolo de Validação & Evidências de Verdade

1. **Validação de Compilação TypeScript (`npm run build:vite`)**:
   - Zero erros de tipagem em `LayoutVariant`, `ViewMode` e componentes React.
2. **Validação de Quebra de Página A4 (Print Preview)**:
   - Modo `cv`: Exatamente 1 página A4 no diálogo de impressão.
   - Modo `cover_letter`: Exatamente 1 página A4 no diálogo de impressão.
   - Modo `both`: Exatamente 2 páginas A4 sem transbordar linhas soltas.
3. **Validação de Paridade Offline**:
   - O arquivo `.html` gerado e baixado deve permitir alternar em tempo real entre os 8 Modelos A4, 5 Temas e os Modos Currículo/Cover Letter via JavaScript puro no navegador sem conexão com a internet.
4. **Validação de API REST Backend**:
   - Requisições para `/api/v1/cv/render?view_mode=cover_letter&layout=corporate_timeline` devem retornar o HTML com a carta de apresentação formatada no layout solicitado.

---

## 5. 🚦 Perguntas Abertas & Decisões Críticas (Trade-offs)

1. **Opção de Download de PDF Separado vs. Unificado**:
   - **Recomendação:** Disponibilizar **3 botões claros de exportação**:
     - `📄 Baixar Currículo (PDF/HTML)` (1 página)
     - `✉️ Baixar Cover Letter (PDF/HTML)` (1 página)
     - `📑 Baixar Dossiê Completo (PDF 2 Páginas / ZIP)` (Currículo + Carta + YAML)
   - Isso dá autonomia total ao candidato dependendo da exigência de cada processo seletivo (algumas vagas pedem apenas o CV, outras pedem a carta em anexo separado, e outras aceitam um PDF único).
