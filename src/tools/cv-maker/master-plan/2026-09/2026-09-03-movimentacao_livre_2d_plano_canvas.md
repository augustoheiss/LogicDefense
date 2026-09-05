# Plano de Implementação — Movimentação Livre Bidimensional (Eixos X e Y), Margens Laterais e Troca de Colunas no Canvas Livre

## 1. Diagnóstico: Por que os blocos estavam travados na vertical?

Após investigação técnica detalhada no código, identificamos as 3 razões físicas para a limitação:
1. **Trava no Eixo X durante o Arraste (`PointerEvents`):**
   No `StructuralBoxWrapper.tsx`, o cálculo de arraste aplicava exclusivamente `translateY(deltaY)`. O eixo horizontal `deltaX` era descartado, fazendo o bloco se recusar a acompanhar o cursor para os lados.
2. **Ausência de Deslocamento Lateral Persistido:**
   Tínhamos suporte a `marginTopPx` (vertical), mas nenhum controle ou propriedade para deslocamento lateral (`marginLeftPx`). Um bloco com 50% de largura ficava eternamente ancorado na borda esquerda sem poder ser empurrado para a direita ou centro.
3. **Confinamento Estrutural das Colunas do DOM:**
   Em modelos de 2 colunas (*Sidebar*, *Split Duo*, *Editorial Accent*, *Corporate Timeline*), as seções estavam codificadas fixas dentro de `<aside>` (esquerda) e `<main>` (direita). O arraste só olhava os irmãos do mesmo container, impedindo cruzar de uma coluna para a outra.

---

## 2. Solução Arquitetural: O Motor 2D de Posicionamento no Plano

Implementaremos um sistema de posicionamento no plano com 4 capacidades fundamentais:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│ BARRA DE FERRAMENTAS DO BLOCO NOVO:                                                    │
│ [⠿ Nome da Seção]  [↔ X: 0px [-][+]]  [↕ Y: 0px [-][+]]  [|◀] [|■|] [▶|]  [⇄ Coluna]    │
└────────────────────────────────────────────────────────────────────────────────────────┘
                                      │
        ┌─────────────────────────────┴─────────────────────────────┐
        ▼                                                           ▼
[EIXO HORIZONTAL (X)]                                       [EIXO VERTICAL (Y)]
• Arraste 2D livre no mouse/touch                           • Arraste 2D livre no mouse/touch
• Margem lateral: marginLeftPx (-20px a +350px)             • Margem vertical: marginTopPx (-15px a +60px)
• Alinhamento no plano: Esquerda, Centro, Direita           • Reordenação sequencial (CSS order)
• Migração de Coluna: [⇄] Esquerda <-> Direita              • Alerta de capacidade A4 (1130px)
```

---

## 3. Detalhamento dos 4 Pilares

### Pilar 1: Arraste 2D Completo no Cursor (`translateX` e `translateY`)
- No `handleMovePointerDown`:
  - Capturar `startX` e `startY`.
  - Aplicar `transform: translate(${deltaX}px, ${deltaY}px)` em tempo real no elemento arrastado.
  - O bloco agora acompanha livremente o ponteiro em qualquer ângulo do plano (diagonal, horizontal, vertical).

### Pilar 2: Deslocamento Lateral Fino & Alinhamento Rápido no Plano
- **`marginLeftPx` no modelo de dados:** Permite deslocar o bloco horizontalmente no plano, criando recuos, margens laterais personalizadas ou posicionamento livre.
- **Controle Stepper na Toolbar (`↔ X: 0px [-] [+]`):** Ajuste fino em incrementos de 8px.
- **Botões de Alinhamento Rápido na Toolbar:**
  - `|◀` (Esquerda): `marginLeft: 0`, alinha à borda esquerda.
  - `|■|` (Centralizar): `margin-left: auto; margin-right: auto;`, centraliza no container.
  - `▶|` (Direita): `margin-left: auto; margin-right: 0;`, empurra para a margem direita da folha.

### Pilar 3: Migração Dinâmica entre Colunas (Cross-Column Reallocation)
- Em modelos de 2 colunas (*Sidebar*, *Split Duo*, *Corporate Timeline*, *Editorial Accent*):
  - Adicionar no `structureConfig`:
    ```ts
    sectionZone?: Record<string, 'left' | 'right'>
    ```
  - **Botão `⇄` na Toolbar:** Permite com 1 clique mover uma seção da coluna esquerda para a direita ou vice-versa.
  - **Arraste Cross-Column:** Se o usuário arrastar um bloco ultrapassando a divisória central das colunas, o sistema detecta que o cursor entrou na coluna oposta e realiza a migração de zona automaticamente!
  - No `UniversalLayoutRenderer`, as seções passam a ser renderizadas dinamicamente na coluna correspondente ao seu `sectionZone`.

### Pilar 4: Preservação de Impressão Vetorial A4 e Zero Regressão
- Todos os deslocamentos (`marginLeftPx`, `marginTopPx`, `alignment`, `order`) são aplicados via estilos CSS padrão perfeitamente interpretados pelo motor de impressão e PDF do navegador (`@media print`).
- Nenhuma ferramenta externa ou biblioteca pesada: código 100% nativo em React e PointerEvents.
