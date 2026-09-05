# 🏛️ Unificação Universal de 9 Layouts A4 & Paridade Total Web / Standalone / API

> **Base Teórica & Padrões**: Decoupled Slot-and-Blueprint Architecture, CSS Paged Media Fragmentation, Zero-Layout-Thrashing Canvas Density Measurement, e Governança Agent-Native (BYOK).

---

## 1. 🎓 A Super Aula: Filosofia, Fundamentos & Visão Geral

### O Problema Real
No frontend React (`UniversalLayoutRenderer.tsx`), temos os 9 Modelos A4 operando com perfeição. Porém, no serviço backend de renderização (`cv_html_renderer.py`) e no arquivo gerado `02-super-dashboard-5-archetypes.html`:
1. O seletor de topo da Dashboard Standalone possui apenas **Persona** e **Tema**, mas **NÃO possui o seletor dos 9 Modelos A4**.
2. O corpo do HTML gerado pelo Python utilizava uma estrutura monolítica única em vez de suportar os 9 Blueprints declarativos (`modular`, `linear`, `sidebar`, `compact_split`, `editorial_accent`, `corporate_timeline`, `warm_magazine`, `hero_matrix`, `dynamic_math`).
3. Ao baixar o HTML offline ou executar `POST /api/v1/cv/compile` e `POST /api/v1/cv/render`, o usuário não conseguia alternar dinamicamente entre os 9 Modelos A4 no arquivo standalone.

### Fundamentos da Skill `/agency-pdf-engine-architect`
1. **Slot-and-Blueprint Matrix**: O schema JSON Resume / YAML é a fonte única da verdade (dados puros). O Layout Blueprint define como os slots (Header, Sidebar, Main, Footer) organizam esses dados.
2. **Contenção Estrita em Impressão (`@media print`)**: Zero resets destrutivos (`* { display: block }`). Toda sidebar possui `min-width: 0`, `overflow-wrap: break-word` e empilhamento vertical de cards.
3. **Matemática dos Grids**:
   - $N = 1$: 1 coluna (`1fr`).
   - $N \equiv 0 \pmod 3$: 3 colunas (`3x3`).
   - $N \equiv 2 \pmod 3$: $3 \times 2$ balanceado com `span 3` em base 6.
   - $N \equiv 1 \pmod 3$: $2 \times 2$ balanceado (`repeat(2, 1fr)`).
4. **Auto-Contido & Zero Dependência de Servidor**: O Dashboard HTML Standalone possui embutidos em JavaScript todos os 9 renderizadores de layout, permitindo que qualquer pessoa que receba o arquivo `.html` alterne entre as **5 Personas**, os **9 Modelos A4**, os **5 Temas Visuais** e os **Modos de Exibição (Currículo / Cover Letter / Dossiê)** sem precisar de internet ou servidor!

---

## 2. 🔍 Crítica Cirúrgica & Red Teaming (O que pode quebrar?)

| Ponto de Risco | Diagnóstico de Falha | Mitigação Arquitetural |
| :--- | :--- | :--- |
| **Peso do HTML Standalone** | Renderizar 5 personas $\times$ 9 layouts no DOM estático geraria 45 blocos HTML inflados (~1.5 MB). | Embutir os YAMLs em `<script type="text/yaml">` e renderizar o layout ativo via JavaScript leve e nativo (~120 KB total), com renderização estática SSR da combinação padrão inicial para quem desabilitar JS. |
| **Paridade Visual DOM vs Print** | O layout alternado no dropdown pode perder classes de print ao imprimir (`Ctrl+P`). | O seletor de layout aplica classes declarativas no container principal (`.layout-{id}`) e sincroniza o DOM do painel ativo antes de invocar `window.print()`. |
| **Cover Letter nos 9 Layouts** | Alguns layouts (ex: Sidebar, Split Duo) têm grids assimétricos que deformariam a carta. | O modo `cover_letter` utiliza a página dedicada `.cv-cover-letter-page` padronizada em documento A4 epistolar formal, e no modo `both` (Dossiê) adiciona a quebra de página A4 matemática. |

---

## 3. 🗺️ Esqueleto do Implementation Plan (Mapeamento de Arquivos)

### 3.1 Backend Python Service
#### [MODIFY] [`LogicDefense/backend/services/cv_html_renderer.py`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/backend/services/cv_html_renderer.py)
- Adicionar o catálogo de layouts e I18N dos 9 Modelos A4.
- Implementar as funções de renderização modular para cada um dos 9 Blueprints:
  - `modular` (Modelo 01)
  - `linear` (Modelo 02)
  - `sidebar` (Modelo 03)
  - `compact_split` (Modelo 04)
  - `editorial_accent` (Modelo 05)
  - `corporate_timeline` (Modelo 06)
  - `warm_magazine` (Modelo 07)
  - `hero_matrix` (Modelo 08)
  - `dynamic_math` (Modelo 09)
- Adicionar no topo do Dashboard Standalone:
  - `<select id="layout-switcher">` com as 9 opções A4.
  - `<select id="viewmode-switcher">` com Currículo, Cover Letter e Dossiê (2 Páginas).
- Injetar no script embutido do Standalone o motor dinâmico que recalcula e comuta os layouts em tempo real sem recarregar a página.

#### [MODIFY] [`LogicDefense/backend/routers/cv_router.py`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/backend/routers/cv_router.py)
- Garantir que `POST /api/v1/cv/compile` e `POST /api/v1/cv/render` recebam e respeitem `layout="dynamic_math"` e os demais 8 modelos.

---

## 4. 🧪 Protocolo de Validação & Evidências de Verdade

1. **Validação da API**: Executar `test_and_export_all.py` testando renderização individual dos 9 layouts e compilação do Super Dashboard.
2. **Validação do Standalone HTML**: Abrir `02-super-dashboard-5-archetypes.html` e verificar:
   - Alternância entre as 5 Personas.
   - Alternância entre os 9 Modelos A4 (01 a 09).
   - Alternância entre os 5 Temas.
   - Alternância de View Mode (Currículo, Cover Letter, Dossiê 2 Páginas).
   - Inclusão / Remoção de foto em tempo real.
   - Download de YAML individual e ZIP completo.
3. **Build do Frontend**: Executar `npm run build:vite` com status de saída zero.
4. **Git Commit & Push**: Sincronizar tudo com a branch `main`.

---

## 5. 🚦 Decisões Críticas

- **Opção A (Recomendada)**: Dashboard Standalone Ultra-Rápido com motor híbrido (SSR do layout inicial + JavaScript Client-Side nativo para trocar entre qualquer uma das 5 personas, 9 layouts e 5 temas instantaneamente).
- **Opção B**: 45 páginas pré-renderizadas no HTML estático (documento pesado com ~1.5 MB).

> Proceder com a **Opção A** (Padrão `/agency-pdf-engine-architect` — leve, modular e ultra-performático).
