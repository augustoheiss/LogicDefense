# ⚔️ Logic Battle (Genesis Edition) — A Ponte dos Portões & O Reino

> **Resumo ELI5 em 1 Frase:** *"Guie sua legião pelos portões matemáticos certos na ponte, veja cada 10 soldados se fundirem em 1 pelotão maior e use Fichas de Resgate quando cair em pegadinhas."*

---

## 🟢 Camada 1 — Explicação ELI5 (Para Qualquer Pessoa Entender em 30 Segundos)

Sabe aqueles anúncios de jogos de celular onde um exército corre por uma ponte com portões `+50` ou `×2`, mas quando você baixa o jogo ele era mentira?
O **Logic Battle** transforma essa promessa em um jogo real, honesto e educativo com **dois mundos conectados**:

1. **🌉 Mundo 1 — A Ponte dos Portões (Corrida Matemática a 60fps):**
   Você desliza sua legião pela ponte escolhendo entre portões matemáticos (`+`, `−`, `×`, `÷`, `%`, potências).
   - **Sem travar a tela (Fusão "Vai-Um"):** Em vez de desenhar 1 milhão de bonequinhos iguais, sempre que você junta **10 Recrutas (`1`)**, eles brilham e se fundem em **1 Decurião (`10`)**! Dez Decuriões viram **1 Centurião (`0,1k`)**, depois **Quiliarca (`1k`)**, ensinando o sistema posicional de base 10 com os olhos.
   - **20 Pegadinhas da Intuição (Zero Punição Cega):** Alguns portões parecem ótimos à primeira vista, mas escondem uma armadilha clássica (como achar que `× 0,5` aumenta o exército, ou que `−50%` seguido de `+50%` volta ao mesmo valor). Se você cair numa pegadinha, a **Capitã Vírgula** mostra o porquê e te entrega uma **Ficha de Resgate** para recuperar **100% dos soldados perdidos** respondendo uma conta-irmã com apoio passo a passo!

2. **🏰 Mundo 2 — O Reino & A Cidadela (Estratégia Territorial):**
   Os soldados que vencem na ponte vão para a **Reserva do seu Reino**. No mapa de 12 províncias, você conquista territórios (ganhando bônus de **Precisão Cirúrgica** quando envia exatamente `Guarnição + 1` soldados!) e evolui 5 construções na **Cidadela** (Quartel, Observatório Socrático, Academia, Mina do Resto Euclidiano e Forja da Luneta).

---

## 🧭 Camada 2 — Diagrama Visual do Fluxo Dual-World (ASCII)

```text
+===================================================================================+
|                      LOGIC BATTLE · ARQUITETURA DUAL-WORLD                        |
+===================================================================================+

   [ MUNDO 2: O REINO & A CIDADELA ]            [ MUNDO 1: A PONTE DOS PORTÕES ]
  +---------------------------------+          +---------------------------------+
  | 🗺️ Mapa de 12 Províncias (SVG)  | -------> | 🌉 Corrida Pseudo-3D (Canvas2D) |
  | 🎯 Ataque Precisão (Guarn.+1)   |Escolhe   | 🏃 Filotaxia 137,5° (<=150 spr) |
  | 🏰 5 Construções da Cidadela:   |Região    | 🔟 Fusão Vai-Um (10×1 -> 10)    |
  |    - Quartel (Exército N0)      |          +----------------+----------------+
  |    - Observatório (Detector ⚠)  |                           |
  |    - Academia (+★ em Gêmeos)    |                           v
  |    - Mina do Resto (D = d*q+r)  |          +---------------------------------+
  |    - Forja (Luneta Tática 🔭)   |          | ⚖️ Passagem pelo Segmento       |
  +----------------+----------------+          +-------+-----------------+-------+
                   ^                                   |                 |
                   |                           [Escolha Ótima]   [Caiu em Pegadinha]
         Sobreviventes + Restos                        |                 |
                   |                                   v                 v
                   |                           +---------------+ +---------------+
                   |                           | Cresce Legião | | ⚡ Alerta Opa!|
                   |                           | + Som log10(N)| | + Ficha Resg. |
                   |                           +-------+-------+ +-------+-------+
                   |                                   |                 |
                   |                                   +--------+--------+
                   |                                            |
                   |                                            v
                   |                           +---------------------------------+
                   +-------------------------- | ⚔️ Batalha Final & Contrato     |
                                               | Honesto (Margem >= +5% Vitória) |
                                               +---------------------------------+
```

---

## 🏛️ Camada 3 — Profundidade Técnica & Contratos DbC (`domain/`)

O núcleo de domínio (`src/games/LogicBattle/domain/`) é **100% puro** (zero dependências de React, Canvas ou `localStorage`) e certificado por testes de propriedade em **10.000 seeds determinísticas**:

| Módulo | Responsabilidade & Invariantes DbC |
| :--- | :--- |
| [`domain/rng.ts`](./domain/rng.ts) | PRNG determinístico `mulberry32(seed)` — garante reprodutibilidade total via `?seed=`. |
| [`domain/armyMath.ts`](./domain/armyMath.ts) | `applyGateWithRemainder(n, gate)` — aritmética racional exata (`num/den`), política `floor`, captura de resto euclidiano e `clamp(0, ARMY_CAP)`. |
| [`domain/notation.ts`](./domain/notation.ts) | `formatArmy(n, mode)` com vírgula `pt-BR` sem arredondamento prematuro (`1999 -> '1,99k'`) e `decomposeTiers(n)` + `detectVaiUmMerge(prev, next)`. |
| [`domain/pathOracle.ts`](./domain/pathOracle.ts) | `pathOracle(plan)` — programação dinâmica que garante `oracle.best >= enemy * 1.15` e `oracle.worst < enemy`. |
| [`domain/trapDetector.ts`](./domain/trapDetector.ts) | `detectTrap(segment, n, chosenLane)` — dispara exclusivamente para `trapId` em `TRAP_CATALOG` (zero falso positivo) com perda limitada a `<= 60%` nas pegadinhas comuns. |
| [`domain/redemption.ts`](./domain/redemption.ts) | `issueToken`, `redeem` (3 níveis de andaime Vygotskiano sem jamais destruir a ficha no erro) e `evaluateRedemptionContract` (Regra do Contrato Honesto). |
| [`domain/gateGenerator.ts`](./domain/gateGenerator.ts) | `generateRun(params)` — garante ao menos 1 Portão Justo por segmento, frequência controlada de pegadinhas, Portões Gêmeos e validação pelo Oráculo. |
| [`domain/economy.ts`](./domain/economy.ts) | `resolveDirectPrecisionAttack` (bônus cirúrgico em `garrison + 1`), `calculateCappedSurvivorBonus`, `purchaseCitadelUpgrade` e `convertRemainderVaultToTroops`. |

---

## 📖 Glossário Rápido

- **Fusão Vai-Um (*Carry-Over Merge*):** Animação e transformação visual em que 10 unidades de uma ordem de grandeza se fundem em 1 unidade da ordem imediatamente superior (`10 × 1 = 10`, `10 × 10 = 0,1k`, `10 × 0,1k = 1k`).
- **Pegadinha Matemática (`T01`–`T20`):** Par de portões onde a resposta rápida e intuitiva (Sistema 1 de Kahneman) perde para a análise algébrica ou aritmética (Sistema 2).
- **Portões Gêmeos (`G01`–`G06`):** Dois portões escritos em notações diferentes que produzem exatamente o mesmo resultado (ex.: `+ 50%` e `× 1,5`), premiando o jogador com Estrelas de Sabedoria.
- **Contrato de Resgate Honesto:** Garantia ética do jogo: ao perder a Batalha Final, o Contrato de Resgate só é oferecido como promessa de vitória se as fichas acumuladas cobrirem 100% do déficit mais 5% de margem de segurança.
