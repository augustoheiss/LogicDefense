# 🏛️ CV Maker 2.0 — Auditoria Tripla & Plano de Evolução

**Data:** 04 de Setembro de 2026  
**Autor:** Antigravity (Personas: Master Plan Architect · AI-Generated Code Security Auditor · Code Reviewer)  
**Escopo:** Auditoria de segurança, revisão de código, análise de integridade IA, e plano de evolução com templates, backgrounds, e imagens customizáveis.

---

## Índice

1. [Auditoria de Segurança (AI-Generated Code Security Auditor)](#1-auditoria-de-segurança)
2. [Code Review Arquitetural (Code Reviewer)](#2-code-review-arquitetural)
3. [Análise de Integridade IA — Datas & Conteúdo](#3-análise-de-integridade-ia--datas--conteúdo)
4. [Fraquezas Identificadas & Oportunidades](#4-fraquezas-identificadas--oportunidades)
5. [Plano de Evolução: Templates, Backgrounds & Imagens](#5-plano-de-evolução-templates-backgrounds--imagens)
6. [Integração com Resume Tailor Skill](#6-integração-com-resume-tailor-skill)
7. [Red Teaming: O Que Pode Quebrar?](#7-red-teaming-o-que-pode-quebrar)

---

## 1. Auditoria de Segurança

### 1.1 Metodologia CWE-Mapped Scan

Auditoria baseada na persona `agency-ai-generated-code-security-auditor`: scan → fix → rescan.

### 1.2 Findings

| # | Arquivo | CWE | Severidade | Achado | Status |
|---|---------|-----|-----------|--------|--------|
| S-1 | [`cvService.ts`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/services/cvService.ts) L16-18 | CWE-798 | 🟡 Médio | URLs de backend hardcoded (`ocorrencias-pdf-writer.onrender.com`, `heiss-cv-engine.onrender.com`). **Não são secrets**, mas são endpoints de produção expostos no bundle client-side. Risco: permite brute-force de endpoints se a rate-limiting do backend for fraca. | Aceitável — arquitetura Agent-Native pública |
| S-2 | [`cvService.ts`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/services/cvService.ts) L36-38 | CWE-312 | 🟡 Médio | API keys armazenadas em `localStorage` (`ld_pro_license_key`, `am_license_key`). Vulnerável a XSS que lê `localStorage`. | Recomendação: considerar `httpOnly` cookies ou session-scoped memory |
| S-3 | [`AgentHubModal.tsx`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/components/Modals/AgentHubModal.tsx) L292 | CWE-312 | 🟢 Baixo | API key lida de `localStorage` e exibida como hint (`...últimos 4 chars`). A chave completa fica na memória do componente React. Aceito como trade-off de UX. | Aceitável |
| S-4 | [`standaloneHtmlService.ts`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/services/standaloneHtmlService.ts) L460 | CWE-79 (XSS) | 🟡 Médio | `designConfig.backgroundPattern` é interpolado diretamente em `url('...')` dentro de um atributo `style`. Se o valor vier de input do usuário sem sanitização, abre vetor XSS via CSS injection. | **Fix necessário**: validar URL pattern contra allowlist ou sanitizar com regex |
| S-5 | [`standaloneHtmlService.ts`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/services/standaloneHtmlService.ts) L473-730 | CWE-79 | 🟢 Baixo | Template literals gigantes com `escapeHtml()` aplicado consistentemente em todos os dados do usuário. A função `escapeHtml` está corretamente implementada (L5-13). **Sem falhas encontradas neste ponto.** | ✅ Seguro |
| S-6 | [`canvasBuilderService.ts`](file:///c:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/tools/cv-maker/services/canvasBuilderService.ts) L230-241 | CWE-502 | 🟢 Baixo | `JSON.parse()` de `localStorage` sem try/catch robusto pode crashar a UI com dados corrompidos. O catch existe mas é silencioso e retorna `[]`, o que é seguro. | Aceitável |
| S-7 | Geral | CWE-311 | 🟢 Info | Dados pessoais (nome, email, telefone, endereço) ficam em `localStorage` como YAML plaintext. Não há criptografia at-rest. Em Local-First, isso é aceitável — são dados do próprio usuário no próprio navegador. | Aceitável por design |

### 1.3 Veredicto de Segurança

> **RESULTADO: APROVADO COM RESSALVAS**
> 
> Nenhum secret hardcoded encontrado (✅). Zero vulnerabilidades críticas. Dois pontos médios (S-2 e S-4) requerem atenção:
> - **S-2**: Migrar keys de `localStorage` para `sessionStorage` ou `httpOnly` cookies é uma melhoria incremental.  
> - **S-4**: Sanitização de `backgroundPattern` é urgente se o campo vier de input do usuário.

---

## 2. Code Review Arquitetural

### 2.1 Pontos Fortes (O que funciona bem)

| Área | Evidência |
|------|-----------|
| **Modularidade do Layout Engine** | `canvasBuilderService.ts` com 15 block types, 4 presets e grid de 12 colunas é uma abstração poderosa. |
| **AtomicItemRenderer** (491 linhas) | Renderizador polimórfico com 7 categorias × 3-4 variantes = ~25 combinações visuais. Código limpo e bem organizado por seção. |
| **Sistema de Blueprints** | `engine/blueprints.ts` com composição declarativa de layouts via `LAYOUT_BLUEPRINTS`. |
| **Standalone HTML Export** | Arquivo HTML autocontido com toolbar flutuante, seletores de tema/layout/view, e print-to-PDF nativo. |
| **Validador robusto** | `cvValidator.ts` normaliza todos os campos com `String().trim()` e aplica safe defaults. |
| **Failover multi-backend** | `cvService.ts` itera por candidatos de backend com failover automático e early exit para 401/402. |
| **ZIP Export** | Empacota YAML + Cover Letter TXT + LEIAME com instruções de uso com IAs. |

### 2.2 Problemas Arquiteturais

| # | Problema | Arquivo(s) | Impacto | Recomendação |
|---|----------|-----------|---------|--------------|
| A-1 | **God Component** | `AgentHubModal.tsx` (1.309 linhas / 69 KB) | Difícil de manter, testar e revisar. Contém prompts, API key management, OpenAPI spec, UI — tudo num único componente. | Extrair em 5 sub-componentes: `AgentPromptTab`, `MasterSynthesisTab`, `PromptsLibraryTab`, `OpenApiTab`, `ApiKeyTab` |
| A-2 | **Prompts hardcoded no frontend** | `AgentHubModal.tsx` L14-256 (const `PERSONAS_LIBRARY`) | Não é um bug, é uma decisão de design. Mas impede atualização de prompts sem novo deploy. | Mover para JSON estático servido pelo backend ou arquivo de config importável |
| A-3 | **UniversalLayoutRenderer.tsx** (64.861 bytes) | CVViewer | Outro God Component — provavelmente renderiza todos os 10+ layouts num único arquivo. | Considerar split por layout variant |
| A-4 | **`standaloneHtmlService.ts`** (882 linhas) | services | Renderização HTML inline com template literals é funcional mas difícil de manter a paridade com o React renderer. | Aceito como trade-off — o standalone HTML precisa ser autocontido por design |
| A-5 | **Tipo `any` excessivo** | `AtomicItemRenderer.tsx` L8 (`item: any`) | Perde type safety. O componente faz casting interno com `as CVWork`, etc. | Usar union type: `item: CVWork \| CVEducation \| CVProject \| ...` com discriminated union via `category` |
| A-6 | **Fallback silencioso no `cvValidator.ts`** | L167-183 | Seções vazias retornam `undefined` em vez de `[]`. Isso força `|| []` defensivo em todo lugar que consome `CVData`. | Padronizar: retornar `[]` em vez de `undefined` para arrays opcionais |

### 2.3 Veredicto de Code Review

> **RESULTADO: SÓLIDO COM DÍVIDA TÉCNICA GERENCIÁVEL**
>
> A arquitetura é madura, bem pensada e funcional. Os dois God Components (A-1, A-3) são a maior dívida técnica, mas não bloqueiam funcionalidades. A prioridade é A-5 (type safety) e A-6 (normalização de arrays).

---

## 3. Análise de Integridade IA — Datas & Conteúdo

### 3.1 Diagnóstico: Por que a IA inventa datas?

Analisei o fluxo completo de dados:

```
Usuário cola texto bruto
    ↓
ChatInterface.tsx → generateCVFromText() → Backend /api/v1/cv/generate
    ↓
Backend envia raw_text ao Gemini com o prompt do PERSONAS_LIBRARY
    ↓
Gemini retorna JSON Resume com datas preenchidas
    ↓
Frontend recebe, valida com cvValidator.ts, renderiza
```

**O problema está no passo 3: o Gemini inferiu/fabricou datas** quando o texto bruto não continha datas explícitas. Isso é um comportamento conhecido de LLMs.

### 3.2 Defesas Existentes

| Camada | Mecanismo | Eficácia |
|--------|-----------|----------|
| **Prompt** | Regra 1: "ZERO FABRICAÇÃO: Jamais invente empresas, graduações, datas ou tecnologias" | 🟡 Parcial — LLMs frequentemente ignoram instruções negativas |
| **Prompt** | Regra 3: "Para empregos em andamento, OMITA a chave endDate ou defina null" | 🟡 Parcial — resolve apenas 1 caso |
| **Validator** | `cvValidator.ts` L56-57: `startDate: String(w.startDate \|\| '').trim()` | 🔴 Insuficiente — aceita qualquer string sem validar formato ou plausibilidade |
| **Frontend** | Nenhuma validação de plausibilidade temporal | 🔴 Ausente |

### 3.3 Vetores de Fabricação Identificados

| Vetor | Exemplo Real Observado | Causa |
|-------|----------------------|-------|
| **Datas inventadas** | Usuário informa "trabalhei na IBM" sem datas → IA gera `"startDate": "2019-03-15"` | LLM preenche lacunas com dados plausíveis mas fictícios |
| **endDate = startDate** | Usuário informa cargo atual → IA copia startDate no endDate | Prompt instrui omitir, mas LLM não obedece 100% |
| **Métricas fabricadas** | Usuário diz "otimizei queries" → IA gera "redução de 67% na latência p99" | Fórmula X-Y-Z incentiva métricas, LLM inventa quando ausentes |
| **Datas futuras** | IA gera `"endDate": "2027-12-31"` para certificação | LLM não tem noção de data atual |

### 3.4 Recomendações Concretas

| # | Defesa | Impacto | Complexidade |
|---|--------|---------|-------------|
| D-1 | **Validação de formato de data** no `cvValidator.ts`: rejeitar strings que não sejam `YYYY-MM-DD`, `YYYY-MM` ou `YYYY` | Alto | Baixa |
| D-2 | **Validação de plausibilidade**: `startDate` não pode ser > hoje; `endDate` não pode ser < `startDate`; `startDate` não pode ser = `endDate` para trabalhos | Alto | Baixa |
| D-3 | **Prompt reforçado**: Adicionar ao prompt base: `"Se o candidato NÃO forneceu uma data explícita, use 'YYYY' (apenas o ano estimado) e marque com [ESTIMADO] no summary. NUNCA invente meses ou dias."` | Médio | Mínima |
| D-4 | **Visual warning no frontend**: Se o validator detectar data duvidosa (ex: dia exato quando usuário não informou dia), destacar em amarelo no CV preview com tooltip "⚠️ Data inferida pela IA — verifique" | Alto | Média |
| D-5 | **Diff de datas**: Comparar as datas no texto bruto do usuário com as datas no JSON gerado. Destacar divergências. | Muito alto | Média |

---

## 4. Fraquezas Identificadas & Oportunidades

### 4.1 Fraquezas de UX/Produto

| # | Fraqueza | Detalhes |
|---|----------|---------|
| F-1 | **Template único de background** | O `designConfig.backgroundPattern` existe mas só suporta um pattern global. Não há seleção granular por seção (ex: fundo diferente para "Experiência" vs "Educação"). |
| F-2 | **Sem suporte a imagens customizadas** | Além da foto de perfil (`basics.image`), não há mecanismo para inserir imagens em seções (logo da empresa, badge de certificação, QR code, banner de projeto). |
| F-3 | **Sem galeria de templates visuais** | O usuário precisa experimentar cada layout/tema um por um. Não há preview visual rápido tipo "galeria de cards com thumbnails". |
| F-4 | **Standalone HTML não reflete Canvas Builder** | O `standaloneHtmlService.ts` renderiza um layout fixo (linear), independente dos blocos configurados no Canvas Builder. São dois motores desconectados. |
| F-5 | **Sem link direto para o Resume Tailor skill** | O AgentHubModal menciona "ResumeTailor" nos prompts mas não linka para o skill real no GitHub. |
| F-6 | **Exportação PDF depende do browser** | `window.print()` produz resultados inconsistentes entre Chrome, Firefox e Safari. |

### 4.2 Oportunidades Estratégicas

| Oportunidade | Valor | Esforço |
|-------------|-------|---------|
| Galeria visual de templates com thumbnails | 🔥🔥🔥 Reduz atrito de decisão | Médio |
| Backgrounds por seção (per-section theming) | 🔥🔥 Diferenciação visual premium | Médio |
| Imagens customizáveis (logos, badges, QR codes) | 🔥🔥🔥 Feature única no mercado | Alto |
| Validação de integridade de datas com visual feedback | 🔥🔥🔥🔥 Resolve problema reportado pelo usuário | Baixo |

---

## 5. Plano de Evolução: Templates, Backgrounds & Imagens

### 5.1 Sistema de Seleção de Background por Seção

**Conceito**: Cada seção/bloco no Canvas Builder ganha propriedades visuais independentes.

```typescript
// Em types/cv.ts — Extensão do CanvasBlockConfig existente
interface CanvasBlockConfig {
  // ... campos existentes (id, type, colSpan, etc.)

  // NOVOS CAMPOS — Background & Visual por Seção
  bgType?: 'solid' | 'gradient' | 'pattern' | 'image' | 'none'
  bgColor?: string           // Ex: '#f0f9ff'
  bgGradient?: string        // Ex: 'linear-gradient(135deg, #667eea, #764ba2)'
  bgPattern?: string         // Ex: 'dots' | 'grid' | 'diagonal' | 'waves'
  bgImage?: string           // URL ou base64 de imagem de fundo
  bgOpacity?: number         // 0.0 a 1.0
  borderStyle?: 'none' | 'solid' | 'dashed' | 'accent-left' | 'accent-top'
  borderRadius?: number      // px
  textColor?: string         // Override de cor de texto
  accentColor?: string       // Override de cor de destaque
}
```

**Fluxo UX**:
1. Usuário seleciona um bloco no Canvas Builder
2. Painel lateral exibe "🎨 Fundo & Visual" 
3. Opções: Cor Sólida | Gradiente | Padrão | Imagem | Transparente
4. Preview em tempo real no bloco selecionado

### 5.2 Galeria de Templates com Thumbnails

**Conceito**: Modal de seleção visual com preview instantâneo.

```
┌─────────────────────────────────────────────────┐
│  📐 Galeria de Templates A4                      │
│                                                   │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │ 👔   │  │ 📑   │  │ 🚀   │  │ 📜   │         │
│  │Exec. │  │2-Col │  │Hero  │  │Time  │         │
│  │Balanc│  │Modern│  │Tech  │  │line  │         │
│  └──────┘  └──────┘  └──────┘  └──────┘         │
│                                                   │
│  ┌──────┐  ┌──────┐  ┌──────┐  ┌──────┐         │
│  │ 🎨   │  │ 📄   │  │ 🧠   │  │ 📷   │         │
│  │Creat.│  │Blank │  │Corpo │  │Photo │         │
│  │Accent│  │Canvas│  │rate  │  │Focus │         │
│  └──────┘  └──────┘  └──────┘  └──────┘         │
│                                                   │
│  [Aplicar Template]  [Preview A4 →]               │
└─────────────────────────────────────────────────┘
```

**Implementação**: Gerar thumbnails miniatura via `html2canvas` dos presets existentes no `CANVAS_PRESETS`, mais novos presets temáticos.

### 5.3 Sistema de Imagens Customizáveis

**Conceito**: Permitir ao usuário inserir imagens em qualquer posição do currículo.

#### Novo Block Type: `custom_image`

```typescript
// Adicionar ao AVAILABLE_PALETTE_ITEMS em canvasBuilderService.ts
{
  type: 'custom_image',
  label: 'Imagem Customizada',
  icon: '🖼️',
  description: 'Logo, badge, QR code, banner ou qualquer imagem do usuário',
  category: 'extras',
  defaultColSpan: 4,
  defaultTitle: 'Imagem'
}
```

#### Novo Tipo de Dado: `CVCustomImage`

```typescript
// Em types/cv.ts
interface CVCustomImage {
  id: string
  src: string          // base64 data:image/... ou URL
  alt: string          // Texto alternativo
  caption?: string     // Legenda opcional
  width?: number       // px ou % 
  height?: number      // px ou %
  fit?: 'contain' | 'cover' | 'fill'
  position?: 'left' | 'center' | 'right'
  borderRadius?: number
}
```

#### Onde o usuário pode colocar imagens:

| Posição | Exemplo de Uso |
|---------|---------------|
| Bloco independente no Canvas | Logo da empresa pessoal, banner de portfólio |
| Dentro de um projeto (`projects[].image`) | Screenshot do sistema, demo GIF |
| Dentro de uma experiência (`work[].companyLogo`) | Logo da empresa empregadora |
| Na formação acadêmica (`education[].institutionLogo`) | Brasão da universidade |
| Como QR Code | Link para LinkedIn ou portfólio |

#### Fluxo de Upload:

```
1. Usuário clica "🖼️ Adicionar Imagem" no Canvas Builder
2. Modal abre: "Arraste uma imagem ou cole uma URL"
3. Imagem é convertida para base64 e salva no YAML/localStorage
4. Preview imediato no bloco do Canvas
5. Controles: enquadramento (X/Y/Scale), border-radius, tamanho
```

### 5.4 Novos Templates Propostos

| # | Nome | Layout | Descrição |
|---|------|--------|-----------|
| T-1 | **Foto Hero** | Photo + Name em banner top, 2 colunas abaixo | Para quem quer foto grande com impacto |
| T-2 | **Corporate Navy** | Sidebar escura (#0f172a) à esquerda + conteúdo branco | Estilo corporate banking |
| T-3 | **Creative Accent** | Barra colorida lateral + tipografia moderna | Para designers e criativos |
| T-4 | **Minimal Academic** | Sem cores, sem ícones, tipografia serif clássica | Para academia e pós-graduação |
| T-5 | **Data Dashboard** | Cards com métricas numéricas, barras de skills proeminentes | Para cientistas de dados e engenheiros |
| T-6 | **QR Portfolio** | Espaço para QR code no canto, links visuais para portfólio | Para devs com projetos online |

---

## 6. Integração com Resume Tailor Skill

### 6.1 Link Oficial

O Resume Tailor skill está disponível no repositório Agency Agents:

```
https://github.com/phdheiss/agency-agents/tree/main/skills/agency-resume-tailor
```

### 6.2 Onde Integrar no CV Maker

| Local | Ação |
|-------|------|
| `AgentHubModal.tsx` — Tab "Prompts Library" | Adicionar card com link clicável para o skill no GitHub + instrução de uso |
| LEIAME.txt do ZIP export | Incluir referência: "Para otimização avançada com agentes IA, use o Resume Tailor Skill:" |
| `defaultTemplate.ts` — Comentário no topo | Adicionar referência ao padrão de engenharia |
| README do projeto cv-maker (se existir) | Seção "Ferramentas Complementares" |

### 6.3 Botão "Abrir Resume Tailor" no AgentHubModal

```typescript
// Novo card na tab prompts_library
{
  title: 'Resume Tailor (Agency Skill)',
  icon: '🎯',
  badge: 'GitHub • Open Source',
  desc: 'Skill especializado em otimização de currículos com fórmula X-Y-Z, ATS alignment e zero fabricação.',
  link: 'https://github.com/phdheiss/agency-agents/tree/main/skills/agency-resume-tailor',
  action: 'open_link'
}
```

---

## 7. Red Teaming: O Que Pode Quebrar?

### 7.1 Riscos do Plano de Evolução

| Risco | Probabilidade | Impacto | Mitigação |
|-------|--------------|---------|-----------|
| **Imagens base64 inflam o localStorage** | Alta | Quota excedida (5-10MB limit) | Compressão de imagem no upload (max 200KB), aviso quando se aproximar do limite |
| **Backgrounds por seção criam inconsistência visual** | Média | CV fica "carnaval" | Presets de design curados com combinações harmônicas pré-aprovadas |
| **Thumbnails de galeria pesam no bundle** | Média | Load time aumenta | Gerar thumbnails sob demanda (lazy) ou usar SVG simplificado |
| **Standalone HTML não suporta imagens custom** | Alta | Imagens base64 funcionam, mas URLs externas não (offline) | Converter todas as imagens para base64 no momento do export |
| **Validação de datas pode rejeitar dados legítimos** | Média | Frustração do usuário | Avisar (warning) em vez de bloquear; permitir override manual |

### 7.2 Premissas Que Precisam Ser Validadas

| Premissa | Como Validar |
|----------|-------------|
| "Usuários querem backgrounds por seção" | Pesquisa rápida com 5 usuários beta |
| "Imagens custom são úteis em CVs" | Em mercados europeus (foto obrigatória) e portfólios visuais, sim |
| "A galeria de templates reduz atrito" | A/B test: medir tempo até primeiro PDF gerado |

---

## Apêndice A: Matriz de Priorização

| Item | Impacto | Esforço | Prioridade |
|------|---------|---------|-----------|
| D-1: Validação formato de data | 🔥🔥🔥🔥 | 🟢 Baixo | **P0** |
| D-2: Validação plausibilidade temporal | 🔥🔥🔥 | 🟢 Baixo | **P0** |
| D-3: Prompt reforçado anti-fabricação | 🔥🔥🔥 | 🟢 Mínimo | **P0** |
| S-4: Sanitização backgroundPattern | 🔥🔥🔥 | 🟢 Baixo | **P0** |
| D-4: Visual warning de datas duvidosas | 🔥🔥🔥 | 🟡 Médio | **P1** |
| 6.3: Link Resume Tailor | 🔥🔥 | 🟢 Mínimo | **P1** |
| 5.2: Galeria de templates | 🔥🔥🔥 | 🟡 Médio | **P1** |
| A-5: Type safety AtomicItemRenderer | 🔥🔥 | 🟢 Baixo | **P1** |
| A-6: Normalizar arrays undefined → [] | 🔥🔥 | 🟢 Baixo | **P1** |
| 5.1: Backgrounds por seção | 🔥🔥 | 🟡 Médio | **P2** |
| 5.3: Imagens customizáveis | 🔥🔥🔥 | 🔴 Alto | **P2** |
| A-1: Split AgentHubModal | 🔥🔥 | 🟡 Médio | **P2** |
| D-5: Diff de datas input vs output | 🔥🔥🔥🔥 | 🟡 Médio | **P2** |
| F-4: Unificar Canvas Builder ↔ Standalone | 🔥 | 🔴 Alto | **P3 (Futuro)** |

---

## Apêndice B: Referências de Ferramentas & Skills

| Ferramenta | Link |
|-----------|------|
| Resume Tailor Skill | [agency-resume-tailor](https://github.com/phdheiss/agency-agents/tree/main/skills/agency-resume-tailor) |
| CV Maker (Produção) | [heisslab.com.br/laboratorio/cv-maker](https://www.heisslab.com.br/laboratorio/cv-maker) |
| JSON Resume Standard | [jsonresume.org](https://jsonresume.org/) |

---

> **Próximos Passos**: Aprovar prioridades P0/P1 → Implementar validação de datas → Adicionar link Resume Tailor → Galeria de templates.
>
> _"A architectural plan without Red Teaming is just a wish list."_ — Master Plan Architect
