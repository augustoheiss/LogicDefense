# 🧪 Heiss-Lab

Bem-vindo ao **Heiss-Lab**, um portal educacional focado no ensino de Matemática e no desenvolvimento do pensamento lógico. Nascido da evolução do projeto *LogicDefense*, o Heiss-Lab é um ecossistema completo de aprendizado que une materiais tradicionais à tecnologia de ponta.

🔗 **Acesse o portal:** [heisslab.com.br](https://heisslab.com.br)

## 🎯 O Propósito
Este projeto foi elaborado 100% em cocriação com a Inteligência Artificial. No entanto, sua filosofia central é a de que **a IA deve ser uma alavanca para o esforço humano, e não um substituto para o ato de pensar.** Vivemos uma era onde a produção de conteúdo foi banalizada pelos algoritmos. O Heiss-Lab defende o "processo" — a jornada de aprendizado, a pesquisa, o erro e o trabalho árduo. Os jogos e materiais aqui presentes não entregam respostas fáceis; eles exigem cálculo, estratégia e lógica pura.

## 🚀 O Ecossistema
O portal é dividido em três pilares principais, focados no Ensino Fundamental II e adaptáveis ao Ensino Médio:
1. **Vídeo-Aulas (YouTube):** Explicações visuais e didáticas.
2. **Materiais Didáticos:** PDFs e recursos prontos para download e uso em sala de aula real.
3. **Jogos Educacionais:** Aplicações interativas para fixação de conteúdo.

### 🎮 Os Jogos
* **🛡️ Logic Defense:** Nosso primeiro jogo. Uma abordagem estratégica onde o conhecimento matemático é a única defesa.
* **🌌 Logic Ascension:** Um RPG *Roguelike* infinito. Apresenta geração procedural de mapas (ProcGen), biomas dinâmicos com *glassmorphism*, e um Motor Matemático em JavaScript que escala desde o PEMDAS básico até operações complexas com frações (incluindo a regra KCF - *Keep, Change, Flip*).

## 🛠️ Arquitetura Técnica
Os jogos foram arquitetados com foco em performance, escalabilidade e UX fluida:
* **Stack:** React, TypeScript, Vite.
* **Math Engine (Logic Ascension):** Gerador dinâmico de expressões matemáticas em tempo real (sem uso de strings estáticas), contendo "armadilhas pedagógicas" que preveem os erros mais comuns dos alunos (ex: somar denominadores).
* **UI/UX:** Design responsivo focado em Mobile/Tablets (Accordion UI, Viewport Camera com CSS `translate3d` para aceleração de GPU).
* **Persistência:** Leaderboard via `localStorage` para retenção de pontuações (New Game+ infinito).

## 🤝 Contato
Quer contribuir como autor, educador, ou somar forças com o nosso projeto?
📧 **Email:** augustoheiss@gmail.com
