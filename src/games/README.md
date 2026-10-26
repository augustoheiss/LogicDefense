# 🎮 Heiss-Lab Logic Games Suite (`src/games`) — Catálogo Arquitetural & Diagramas Interativos (PR Lens + ELI5)

Bem-vindo à suíte de jogos cognitivos e matemáticos do ecossistema **LogicDefense (`src/games`)**. Cada um dos **6 jogos** foi documentado com **Master Plan Architect (`agency-master-plan-architect`)**, um **Guia ELI5 (`@[.agents/skills/eli5]`)** para entendimento imediato passo a passo e **Arquitetura Completa (`@[.agents/skills/pr-lens]`)** com fluxos de dados e payloads tipados.

---

## 🗺️ Tabela Mestra dos 6 Jogos e READMEs

| Jogo & Pasta | Gênero & Mecânica Central | Resumo ELI5 em 1 Frase | 📖 README Completo | 🟢 Canvas Interativo ELI5 | 🏛️ Canvas Arquitetura Completa |
| :--- | :--- | :--- | :--- | :--- | :--- |
| ⚔️ **1. Logic Ascension**<br/>(`src/games/LogicAscension`) | **RPG Tático de Masmorra + Arena de Arco 60fps**<br/>Oráculo de Rota Ótima (`runOracle`), 400 contas sem repetição, Frações MDC (`snapVal`) e Modo Desespero. | *"Logic Ascension usa contas para vencer chefes."* | [**📄 Ler README do Logic Ascension**](./LogicAscension/README.md) | [**👉 Abrir ELI5 (`fk6IVd...`)**](https://prlens.dev/c/fk6IVdOojoz0W_4I-dDxjQ)<br/>[[SVG](https://prlens.dev/c/fk6IVdOojoz0W_4I-dDxjQ.svg)] | [**👉 Abrir Arquitetura (`KHf9c0...`)**](https://prlens.dev/c/KHf9c03vFnakuCzzmYh_5A)<br/>[[SVG](https://prlens.dev/c/KHf9c03vFnakuCzzmYh_5A.svg)] |
| 🏰 **2. LogicDefense (Genesis 2.0)**<br/>(`src/games/LogicDefense`) | **Tower Defense Tático 2D a 60fps Zero-Rerender**<br/>Ressonância de Operadores (`+30%`), Rotas que Giram a cada 3 Ondas (com salvamento BFS), SpinEsfera 3D e Museu de Vieses. | *"Contas certas turbinam torres no mapa que gira."* | [**📄 Ler README do LogicDefense**](./LogicDefense/README.md) | [**👉 Abrir ELI5 (`ZcJV6J...`)**](https://prlens.dev/c/ZcJV6JIGoWvACgeSQ2qwiA)<br/>[[SVG](https://prlens.dev/c/ZcJV6JIGoWvACgeSQ2qwiA.svg)] | [**👉 Abrir Arquitetura (`6d1Oj5...`)**](https://prlens.dev/c/6d1Oj5IZ4bXslWA0JPIZEw)<br/>[[SVG](https://prlens.dev/c/6d1Oj5IZ4bXslWA0JPIZEw.svg)] |
| ⚡ **3. LogicFriction**<br/>(`src/games/LogicFriction`) | **Arena MOBA 2.5D/3D WebGL (R3F + Rapier) & Labirinto A\***<br/>Grid A\* dinâmico anti-bloqueio, Desconflicção de Torres Sniper e 4 Pedestais Matemáticos Cardeais (`N/S/L/O`) que soltam Raios em Cadeia. | *"Pise nos altares 3D para eletrocutar hordas A\*."* | [**📄 Ler README do LogicFriction**](./LogicFriction/README.md) | [**👉 Abrir ELI5 (`Me1xix...`)**](https://prlens.dev/c/Me1xixa3VNSVkZaqmRle3w)<br/>[[SVG](https://prlens.dev/c/Me1xixa3VNSVkZaqmRle3w.svg)] | [**👉 Abrir Arquitetura (`5ecXQN...`)**](https://prlens.dev/c/5ecXQNKGoPrIsmtr5Lbyvw)<br/>[[SVG](https://prlens.dev/c/5ecXQNKGoPrIsmtr5Lbyvw.svg)] |
| 🚀 **4. LogicInvaders v5**<br/>(`src/games/LogicInvaders`) | **Space Shooter Arcade das 6 Lentes Matemáticas**<br/>Trava de Plasma `[1][2][3]` nas bolhas, Zero Game-Over (*Difficulty Surge*), Andaime *"💡 Luz Guia"*, 4 Chefes Voxel e Portal Godot 4. | *"Trave nas bolhas certas para explodir chefes."* | [**📄 Ler README do LogicInvaders**](./LogicInvaders/README.md) | [**👉 Abrir ELI5 (`Y56Ui9...`)**](https://prlens.dev/c/Y56Ui9cQ3xTopiafkP2FJw)<br/>[[SVG](https://prlens.dev/c/Y56Ui9cQ3xTopiafkP2FJw.svg)] | [**👉 Abrir Arquitetura (`sI239O...`)**](https://prlens.dev/c/sI239OE5lya_IRmlFcx2mw)<br/>[[SVG](https://prlens.dev/c/sI239OE5lya_IRmlFcx2mw.svg)] |
| 🧩 **5. LogicTetris (Cordão Tríplice)**<br/>(`src/games/LogicTetris`) | **Puzzle Polimórfico 3-em-1 (Tetris + Fruit Match + Tactile Grid)**<br/>Muta de jogo a cada 4 acertos, Scanner de Buracos (`cavityScanner`), Alquimia de Peças, 8 Lentes Isomórficas e Escudo Fênix `142857`. | *"Acerte 4 contas para mutar entre 3 puzzles."* | [**📄 Ler README do LogicTetris**](./LogicTetris/README.md) | [**👉 Abrir ELI5 (`q_ssSx...`)**](https://prlens.dev/c/q_ssSxw3zIVDPbEr9WN2aw)<br/>[[SVG](https://prlens.dev/c/q_ssSxw3zIVDPbEr9WN2aw.svg)] | [**👉 Abrir Arquitetura (`yE8Fmx...`)**](https://prlens.dev/c/yE8FmxmKF31memO1-HTKaw)<br/>[[SVG](https://prlens.dev/c/yE8FmxmKF31memO1-HTKaw.svg)] |
| 🌉 **6. LogicBattle (Genesis Edition)**<br/>(`src/games/LogicBattle`) | **Crowd Runner de Portões Honestos + Reino Territorial**<br/>Oráculo de Caminhos (`pathOracle`), Pelotões Posicionais na Base 10 (`Vai-Um`), 20 Pegadinhas com Fichas de Resgate e Cidadela. | *"Cruze os portões certos, funda 10 soldados em 1 pelotão e conquiste o Reino."* | [**📄 Ler README do LogicBattle**](./LogicBattle/README.md) | [**👉 Ver Diagrama no README**](./LogicBattle/README.md) | [**👉 Ver Master Plan**](./LogicBattle/master-plan/MASTER_PLAN_LOGIC_BATTLE_GENESIS.md) |

---

## 🏛️ Visão Arquitetural Unificada da Suíte (`src/games`)

```mermaid
flowchart TB
    subgraph Suite["🎮 Heiss-Lab Cognitive & Mathematical Games Suite (src/games)"]
        direction LR
        G1["⚔️ LogicAscension<br/>Grid RPG + Oráculo de Rota + Arena 60fps"]
        G2["🏰 LogicDefense (Genesis 2.0)<br/>2D Tower Defense 60fps + Ressonância + SpinEsfera"]
        G3["⚡ LogicFriction<br/>3D WebGL MOBA (R3F/Rapier) + A* + Altares N/S/L/O"]
        G4["🚀 LogicInvaders v5<br/>Space Shooter + 6 Lentes + Luz Guia + VoxelBoss"]
        G5["🧩 LogicTetris (Trinity)<br/>Polimórfico 3-em-1 + Cavity Scanner + Fênix 142857"]
        G6["🌉 LogicBattle (Genesis Edition)<br/>Crowd Runner Pseudo-3D + Oráculo + Reino SVG"]
    end

    subgraph Pillars["🧠 Pilares Pedagógicos e de Engenharia Compartilhados"]
        P1["Oráculos Determinísticos<br/>(runOracle, BFS Relocation, A* Anti-Block, Cascade Oracle, Cavity Scanner, pathOracle)"]
        P2["Lentes Mentais Heiss-Lab<br/>(Andaime Luz Guia, 2 Métodos de Solução, Harmonia 142857, Distratores Diagnósticos)"]
        P3["Zero-Punishment Flow<br/>(Modo Desespero, Difficulty Surge sem Game-Over, Intervenção Fênix de 2ª Chance)"]
        P4["Motores 60fps & WebAudio<br/>(stateRef Zero-Rerender, React Three Fiber + Rapier 3D, Web Audio API Synth)"]
    end

    Suite --> P1
    Suite --> P2
    Suite --> P3
    Suite --> P4
```

---

## 📂 Estrutura de Diretórios e Artefatos `.pr-lens`

- [`LogicAscension/`](file:///C:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/games/LogicAscension/README.md) — Contém `README.md`, `.pr-lens/eli5.graph.json`, `.pr-lens/graph.json` e 9 SVGs renderizados.
- [`LogicDefense/`](file:///C:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/games/LogicDefense/README.md) — Contém `README.md`, `.pr-lens/eli5.graph.json`, `.pr-lens/graph.json` e 8 SVGs renderizados.
- [`LogicFriction/`](file:///C:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/games/LogicFriction/README.md) — Contém `README.md`, `.pr-lens/eli5.graph.json`, `.pr-lens/graph.json` e 8 SVGs renderizados.
- [`LogicInvaders/`](file:///C:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/games/LogicInvaders/README.md) — Contém `README.md`, `.pr-lens/eli5.graph.json`, `.pr-lens/graph.json` e 8 SVGs renderizados.
- [`LogicTetris/`](file:///C:/Users/Usuario/Desktop/AHeiss_GoogleDrive/02-Programacao/projetos-IA/LogicDefense/src/games/LogicTetris/README.md) — Contém `README.md`, `.pr-lens/eli5.graph.json`, `.pr-lens/graph.json` e 8 SVGs renderizados.
