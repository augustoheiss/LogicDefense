## 🎯 Objetivo deste Pull Request

<!-- Descreva O QUE mudou, POR QUÊ e qual subprojeto do monorepo foi impactado -->

- **Issue / Tarefa vinculada:** `Closes #`
- **Pilar(es) Impactado(s) no Monorepo:**
  - [ ] 🎮 **Jogos Cognitivos (`src/games/`):** `LogicDefense` / `LogicBattle` / `LogicTetris` / `LogicFriction` / `LogicInvaders` / `LogicAscension`
  - [ ] 🛠️ **Ferramentas Web SaaS (`src/tools/`):** `cv-maker` / `ocorrencias` / `universal-api-port` / SEO (`scripts/`)
  - [ ] 💰 **Assistente Moeda (`Assistente-Moeda-App/`):** App Play Store / React Native Web / Motor Financeiro
  - [ ] ⏱️ **Sekundo v2 (`Sekundo/`):** `@sekundo/core` / `@sekundo/coin-engine` / `@sekundo/app` / `packages/backend`
  - [ ] ⚡ **Backend Python (`backend/`):** Gateway FastAPI v3.0 / Licenças / IA / PDF Headless
- **Tipo de mudança (`Fowler's Two Hats`):**
  - [ ] `feat:` Nova funcionalidade (mudança de comportamento)
  - [ ] `fix:` Correção de bug ou vulnerabilidade
  - [ ] `refactor:` Refatoração estrutural pura (sem alterar comportamento externo)
  - [ ] `chore:` / `docs:` / `test:` CI/CD, documentação ou suíte de testes

---

## 🛡️ Checklist Automatizado de Engenharia, Qualidade & Segurança

### 1. Compilação, Tipagem & Paridade Isomórfica
- [ ] **TypeScript Strict (`0` erros):** Passa em `npm run lint` (raiz), `npx tsc --noEmit` (`Assistente-Moeda-App`) e `npm run typecheck:core` + `typecheck:app` (`Sekundo`).
- [ ] **Paridade Matemática:** Se regras financeiras ou ATS mudaram, a paridade entre TypeScript (`metricsEngine.ts` / `AtsEngine`) e Python (`coin_metrics_engine.py`) foi preservada e testada.

### 2. Segurança, Segredos & Higiene Clean-Room / LGPD
- [ ] **Zero Segredos / Binários Sensíveis:** Nenhum `.env`, `.db`/`.sqlite`, `.jks`/`.keystore`, `client_secret.json`, `youtube_token.json` ou tabela de chaves foi incluída no commit.
- [ ] **Clean-Room & LGPD (`cleanRoomAudit.mjs`):** Zero CPFs reais, e-mails pessoais sensíveis, PDFs de referência de terceiros ou caminhos absolutos locais (`C:\Users\...`) no código rastreado.
- [ ] **Zero Broken Windows:** Sem blocos `catch {}` vazios, `debugger;` esquecidos ou bypasses de autenticação.

---

## 🧪 Evidência de Testes / Visual

<!-- Cole o resultado dos testes locais ou print/vídeo da funcionalidade -->
