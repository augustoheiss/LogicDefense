# 🏛️ CV Maker 2.0 — Arquitetura de Modelos A4 Multi-Layout & Matriz de Temas

> **Documento:** Master Plan & Contrato Arquitetural  
> **Autor:** Master Plan Architect (`agency-master-plan-architect`)  
> **Data:** 31 de Agosto de 2026  
> **Status:** Proposto / Aguardando Aprovação  
> **Localização:** `LogicDefense/src/tools/cv-maker/master-plan/2026-08-31-master-plan-cv-maker-multi-layout-a4.md`

---

## 1. 🎓 A Super Aula: Filosofia, Fundamentos & A Matriz Ortogonal $M \times N$

### 1.1. O Problema Real: A Confusão entre "Estrutura (Wireframe)" e "Estilo (Tema)"
Na maioria dos geradores de currículos do mercado, quando o usuário troca de "Modelo", o sistema mistura arbitrariamente duas variáveis distintas:
1. **Estrutura Espacial (Layout A4 / Wireframe):** Como os blocos de informação são dispostos no espaço bidimensional da folha A4 (Ex: Seções em cartões isolados, lista cronológica contínua, ou divisão em 2 colunas com sidebar lateral).
2. **Estilo Visual (Tema / Skin):** A paleta de cores, tipografia (fontes serifadas vs sans-serif vs monospace), espaçamentos, bordas e sombras.

Ao acoplar layout e tema, o usuário que adora a disposição em **Sidebar Lateral**, mas quer a paleta **Terminal Monospace**, fica órfão. Ou quem gosta da densidade do **Layout Linear Harvard**, mas quer a paleta **Executiva Azul**, não tem como escolher.

### 1.2. A Solução: Arquitetura Ortogonal $M \times N$

Desacoplamos a renderização do CV em duas dimensões perfeitamente ortogonais:

$$\text{CV Renderizado} = \text{Modelo A4 (Estrutura)} \times \text{Tema Visual (Paleta \& Tipografia)}$$

```
                  ┌─────────────────────────────────────────────────────────┐
                  │                 MATRIZ ORTOGONAL CV MAKER               │
                  └─────────────────────────────────────────────────────────┘
                                              │
                      ┌───────────────────────┴───────────────────────┐
                      ▼                                               ▼
          📐 EIXO 1: MODELO A4 (Estrutura)               🎨 EIXO 2: TEMA VISUAL (Skin)
          ────────────────────────────────               ─────────────────────────────
          • Modelo 01: Modular / Card Grid               • 👔 Executivo (Navy / Slate)
          • Modelo 02: Linear / Clean Compact            • 🎨 Criativo (Indigo / Violet)
          • Modelo 03: Duas Colunas / Sidebar            • 🔹 Minimalista (Carvão / Clean)
          • Modelo 04: Suíço / Tipográfico Moderno       • 📄 White (Monocromático Puro)
          • Modelo 05: Compacto / One-Page High-Density  • >_ Terminal (Matrix Green / Mono)
```

Essa separação garante que:
- **$4 \text{ Modelos A4} \times 5 \text{ Temas Visuais} = 20 \text{ combinações visuais instantâneas}$** sem duplicar dados ou lógica de parsing.
- O mesmo dado `JSON Resume (YAML)` alimenta qualquer uma das 20 combinações sem perder nenhum campo.
- A paridade entre **Web Preview**, **HTML Standalone**, **Exportação ZIP**, **PDF A4** e **API REST Backend** é 100% determinística.

---

## 2. 🔍 Crítica Cirúrgica & Red Teaming (O que pode quebrar?)

### 2.1. Risco 1: Quebra de Página em A4 (`@media print`)
* **Problema:** Layouts de 2 colunas (com sidebar) frequentemente sofrem no `window.print()` quando a coluna esquerda é mais curta que a direita ou quando blocos de experiência são cortados ao meio entre a página 1 e a página 2.
* **Mitigação:** Utilizar `break-inside: avoid-page;` (e `-webkit-column-break-inside: avoid;`) rigorosamente em todos os `.cv-item`, e definir a altura da folha A4 em `min-height: 297mm; max-width: 210mm;` com regras estritas de overflow.

### 2.2. Risco 2: Divergência entre Frontend (React) e Backend (Python)
* **Problema:** Se o React renderizar o Layout 02 com um CSS e o Python `cv_html_renderer.py` renderizar com outro, o usuário verá um preview no site e baixará um HTML/PDF diferente via API.
* **Mitigação:** O `standaloneHtmlService.ts` já compila client-side no React com CSS embutido. Faremos a sincronização do `cv_html_renderer.py` com o mesmo motor de templates CSS/HTML, compartilhando o catálogo de classes canônicas (`layout-modular`, `layout-linear`, `layout-sidebar`).

### 2.3. Risco 3: Anti-Scope Creep (Tesoura do Minimal Change)
* **O que NÃO fazer nesta fase:** Não tentar criar um editor drag-and-drop de blocos na folha A4. O layout deve ser puramente declarativo derivado do YAML e dos seletores de Layout/Tema, mantendo a performance ultra-leve (< 10ms) e sem dependências pesadas.

---

## 3. 🗺️ Esqueleto do Implementation Plan

### 3.1. Catálogo dos Modelos A4

| ID do Layout | Nome do Modelo A4 | Filosofia Estrutural | Ideal Para |
| :--- | :--- | :--- | :--- |
| `layout-modular` (Modelo 01) | **Modular / Card Grid** | Header destacado com avatar lateral, badges em pill-tags, seções envelopadas em containers modulares. | Tech Leads, Gestores, Portfólios Web |
| `layout-linear` (Modelo 02) | **Linear Clássico / Compacto** | Linha contínua com divisores horizontais discretos, contatos em linha única, foco em leitura rápida ATS. | Finanças, Consultoria, Executivos, ATS |
| `layout-sidebar` (Modelo 03) | **Duas Colunas / Sidebar Lateral** | Coluna esquerda fixa (30%) com Foto, Contatos, Skills, Idiomas, e Coluna direita (70%) com Experiência e Projetos. | Designers, Fullstack Devs, Criativos |
| `layout-swiss` (Modelo 04) | **Suíço / Tipográfico** | Tipografia assimétrica de grande porte, datas na margem esquerda, alta elegância editorial. | Pesquisadores, Acadêmicos, Arquitetos |

### 3.2. Mapeamento de Arquivos

#### [MODIFY] `src/tools/cv-maker/types/cv.ts`
- Adicionar tipo `export type LayoutVariant = 'modular' | 'linear' | 'sidebar' | 'swiss';`
- Adicionar lista de metadados dos layouts com ícones e descrições.

#### [MODIFY] `src/tools/cv-maker/components/Toolbar/CVToolbar.tsx`
- Adicionar o seletor visual de **Modelo A4** (Layout) ao lado do seletor de **Tema Visual** (Skin).
- Renderizar preview com ícones: `📐 Modelo A4 01 (Modular)`, `📐 Modelo A4 02 (Linear)`, `📐 Modelo A4 03 (Sidebar)`.

#### [MODIFY] `src/tools/cv-maker/components/CVViewer/CVViewer.tsx`
- Receber `layout?: LayoutVariant` e aplicar a classe estrutural `layout-${layout}` junto com `theme-${theme}`.
- Chamar os subcomponentes de acordo com o wireframe selecionado.

#### [MODIFY] `src/tools/cv-maker/services/standaloneHtmlService.ts`
- Atualizar o gerador HTML standalone para embutir os estilos de todos os Modelos A4.
- Adicionar na barra flutuante do HTML autônomo **dois seletores dinâmicos**:
  1. `📐 Modelo A4` (Modular, Linear, Sidebar, Suíço)
  2. `🎨 Tema Visual` (Executivo, Criativo, Minimalista, White, Terminal)
- Permitir que o destinatário do arquivo HTML troque tanto a estrutura quanto o tema em tempo real com 0ms de delay!

#### [MODIFY] `LogicDefense/backend/services/cv_html_renderer.py` e `cv_router.py`
- Adicionar o parâmetro opcional `layout: Optional[str] = "modular"` no payload `/api/v1/cv/render`.
- Gerar o HTML com paridade absoluta aos templates do frontend.

---

## 4. 🧪 Protocolo de Validação & Evidências de Verdade

1. **Teste da Matriz $4 \times 5 = 20$:**
   - Alternar entre os 4 Modelos A4 e os 5 Temas Visuais no Preview do React, validando a renderização correta de todos os campos sem quebras visuais.
2. **Teste de Impressão A4 (`Ctrl + P` / `window.print`):**
   - Validar em visualização de impressão que cada layout respeita as margens A4, sem corte de cabeçalho ou overflow horizontal.
3. **Teste do HTML Standalone & ZIP:**
   - Baixar o `.html` de uma versão do histórico, abri-lo isoladamente no navegador (com rede desconectada) e testar a alternância ao vivo de Layouts e Temas.
4. **Teste de Paridade da API:**
   - Executar chamada cURL para `/api/v1/cv/render?layout=linear&theme=terminal` e verificar que o HTML retornado reflete exatamente a estrutura e paleta requisitadas.

---

## 5. 🚦 Perguntas Abertas & Decisões Críticas

1. **Layout Padrão Inicial:** Deseja que o `Modelo A4 01 (Modular)` permaneça como padrão ao abrir o app pela primeira vez, com o usuário podendo alternar para o `Modelo A4 02 (Linear)` a qualquer momento?
2. **Layout Sidebar no Mobile:** Em telas pequenas de smartphone, o layout de duas colunas (Sidebar) deve colapsar automaticamente para uma coluna vertical para garantir legibilidade perfeita? (Recomendado: Sim).
