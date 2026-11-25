import { CicloDePacote } from './cicloDePacote'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** Um «pacote de texturas» de mentira: só registra se foi descartado e quantas vezes (descartar 2× seria outro defeito). */
interface PacoteDeMentira {
  readonly nome: string
  descartes: number
  dispose(): void
}

/**
 * Quantas vezes o pacote foi descartado. Lido por FUNÇÃO de propósito: depois de uma asserção «o campo vale 0» o TypeScript estreita o campo ao literal 0 e acusa a comparação seguinte com 1 de
 * impossível, ignorando que o `dispose()` o muda no meio. A estreitação não atravessa uma chamada de função.
 */
function d(p: PacoteDeMentira): number {
  return p.descartes
}

function pacote(nome: string): PacoteDeMentira {
  return {
    nome,
    descartes: 0,
    dispose() {
      this.descartes += 1
    },
  }
}

/**
 * O CICLO DE VIDA do pacote de texturas dos blocos (24/11/2026). O defeito, medido evento a evento com `instrumentos/rastro-texturas.js` em toda troca de qualidade que MUDA a resolução (256 ↔ 512):
 * o `CenaBiomaVisual` gerava o pacote novo e DESCARTAVA o antigo no cleanup do mesmo efeito que anunciava o novo, mas quem usa o pacote (`IlhaRua` → obras) só troca para o novo no commit SEGUINTE
 * (o `setState` do pai). Naquele quadro as obras ainda apontavam para as texturas já descartadas e o three as REENVIAVA à GPU (12 texturas por troca, folga de exatamente 1 quadro); como o dono já
 * as tinha descartado, ninguém as descartava de novo: GPU 29 → 137 texturas em 4 voltas, sem platô.
 *
 * A regra: o pacote que SAI não pode ser descartado no passo em que o novo é ANUNCIADO. Fica RETIDO e só é descartado no passo seguinte (quando o consumidor já commitou o novo), ou ao desmontar.
 * Este teste modela os passos na ordem real do React, e o componente usa a MESMA classe (contrato de texto em `contratoDoCiclo`).
 */
export function contratoDoCiclo(cenaBioma: string): void {
  const codigo = cenaBioma
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n')
  assert(/import \{[^}]*\bCicloDePacote\b[^}]*\} from '\.\/cicloDePacote'/.test(codigo), 'a cena importa `CicloDePacote`')
  assert(/new CicloDePacote<PacoteTexturasBlocos>\(\)/.test(codigo), 'o pacote de blocos vive num `CicloDePacote`')
  assert(/ciclo\??\.anunciar\(texturasBlocos\)/.test(codigo), 'o efeito ANUNCIA o pacote novo pelo ciclo (e não descarta o antigo no mesmo passo)')
  assert(/ciclo\??\.encerrar\(\)/.test(codigo), 'ao desmontar, o ciclo descarta TUDO (`encerrar`)')
  assert(/cicloBlocosRef\.current\?\.confirmar\(\)/.test(codigo), 'há um efeito que CONFIRMA a cada commit (é ele que descarta o pacote retido, 1 commit depois)')
  // A ORDEM É O CONTRATO. Dentro de um commit os efeitos rodam na ordem em que foram DECLARADOS: o `confirmar` tem de vir ANTES do `anunciar`, para cada commit confirmar o que foi anunciado no
  // commit ANTERIOR e só então anunciar o seu. Invertida, o retido sairia no mesmo commit que o anuncia: o defeito (obras apontando para textura descartada, reenviada à GPU) de volta.
  const posConfirmar = codigo.indexOf('cicloBlocosRef.current?.confirmar()')
  const posAnunciar = codigo.search(/ciclo\??\.anunciar\(texturasBlocos\)/)
  assert(posConfirmar >= 0 && posAnunciar >= 0 && posConfirmar < posAnunciar, 'o efeito de `confirmar` é declarado ANTES do de `anunciar` (a ordem dos efeitos é o que dá 1 commit de folga)')
  // o efeito de `confirmar` roda a CADA commit: SEM array de dependências (com `[]` ou `[x]` ele confirmaria só uma vez ou só quando x mudasse, e o retido ficaria vivo)
  assert(/useEffect\(\(\) => \{\s*cicloBlocosRef\.current\?\.confirmar\(\)\s*\}\)/.test(codigo), 'o efeito de `confirmar` NÃO tem array de dependências: roda a cada commit')
  // a desmontagem do ciclo é um efeito de `[]` (só ao sair de cena), e não o cleanup do efeito do pacote (que rodaria a cada troca, o defeito original)
  assert(/return \(\) => \{\s*ciclo\?\.encerrar\(\)\s*\}\s*\}, \[\]\)/.test(codigo), '`encerrar` roda só ao desmontar (efeito com `[]`), nunca a cada troca de pacote')
  // o descarte direto no cleanup do efeito de blocos (a causa do vazamento) NÃO voltou
  assert(!/return \(\) => \{\s*texturasBlocos\?\.dispose\(\)\s*\}/.test(codigo), 'o cleanup NÃO descarta `texturasBlocos` direto: era a causa do vazamento (descartava o antigo antes de o pai trocar)')
}

export function run(cenaBioma?: string): void {
  if (cenaBioma !== undefined) contratoDoCiclo(cenaBioma)

  // ── 1. A ORDEM REAL: o pacote A está em uso; chega B. A NÃO pode ser descartado no passo em que B é anunciado. ─────────────────────────────────────────────────────────────────────────────
  {
    const ciclo = new CicloDePacote<PacoteDeMentira>()
    const A = pacote('A')
    const B = pacote('B')
    ciclo.anunciar(A)
    assert(d(A) === 0, 'o 1º pacote não é descartado ao ser anunciado')
    ciclo.anunciar(B)
    assert(d(A) === 0, 'A NÃO é descartado no passo em que B é anunciado: o consumidor ainda aponta para A (o defeito: era aqui que A morria e as obras o reenviavam à GPU)')
    assert(d(B) === 0, 'B (o novo) nunca é descartado ao ser anunciado')
    ciclo.confirmar()
    assert(d(A) === 1, 'A é descartado quando o consumidor já commitou B (`confirmar`)')
    assert(d(B) === 0, 'B segue vivo depois de A sair')
    ciclo.encerrar()
    assert(d(B) === 1, 'ao desmontar, B é descartado')
    assert(d(A) === 1, 'A não é descartado uma 2ª vez')
  }

  // ── 2. TROCAS EM SEQUÊNCIA (4 voltas de qualidade = 12 trocas): cada pacote é descartado EXATAMENTE 1 vez, e no fim não sobra nenhum vivo. ─────────────────────────────────────────────────
  {
    const ciclo = new CicloDePacote<PacoteDeMentira>()
    const todos: Array<PacoteDeMentira> = []
    for (let i = 0; i < 12; i += 1) {
      const p = pacote(`P${i}`)
      todos.push(p)
      ciclo.anunciar(p)
      // o consumidor commita o novo no passo seguinte
      ciclo.confirmar()
      const vivos = todos.filter((x) => d(x) === 0).length
      assert(vivos === 1, `depois de ${i + 1} trocas confirmadas sobra exatamente 1 pacote vivo (o atual), e não ${vivos}: sem teto, é o vazamento`)
    }
    ciclo.encerrar()
    assert(todos.every((x) => d(x) === 1), 'no fim cada pacote foi descartado exatamente 1 vez (nenhum vazou, nenhum em dobro)')
  }

  // ── 3. O TETO sem confirmação: o consumidor NUNCA confirma (um bug dele não pode fazer o ciclo acumular pacotes sem limite): no máximo 1 retido além do atual. ──────────────────────────────
  {
    const ciclo = new CicloDePacote<PacoteDeMentira>()
    const todos: Array<PacoteDeMentira> = []
    for (let i = 0; i < 10; i += 1) {
      const p = pacote(`Q${i}`)
      todos.push(p)
      ciclo.anunciar(p)
    }
    const vivos = todos.filter((x) => d(x) === 0).length
    assert(vivos <= 2, `sem nenhuma confirmação o ciclo retém no máximo 2 pacotes (o atual e 1 retido), e não ${vivos}: um consumidor que não confirma não pode vazar sem limite`)
    ciclo.encerrar()
    assert(todos.every((x) => d(x) === 1), 'o `encerrar` descarta tudo mesmo sem confirmações, exatamente 1 vez cada')
  }

  // ── 4. NULL e REPETIÇÃO: o `useMemo` pode entregar `null` (a geração falhou) e o mesmo pacote duas vezes (re-render): nada quebra e nada é descartado em dobro. ──────────────────────────────────────
  {
    const ciclo = new CicloDePacote<PacoteDeMentira>()
    const A = pacote('A')
    ciclo.anunciar(null)
    ciclo.confirmar()
    ciclo.anunciar(A)
    ciclo.anunciar(A) // o mesmo pacote de novo (o efeito rodou 2× com o mesmo valor, como o StrictMode faz)
    ciclo.confirmar()
    assert(d(A) === 0, 'anunciar o MESMO pacote duas vezes não o descarta: ele segue em uso')
    ciclo.anunciar(null)
    ciclo.confirmar()
    assert(d(A) === 1, 'quando o pacote vira null, o antigo é descartado ao confirmar')
    ciclo.confirmar()
    ciclo.encerrar()
    assert(d(A) === 1, 'nunca descartado em dobro, por mais `confirmar`/`encerrar` que sobrem')
  }

  // ── 4b. O MESMO PACOTE REANUNCIADO COM UM RETIDO PENDENTE (o caso do StrictMode, que roda o efeito 2× com o mesmo valor). A sequência MÍNIMA que a enumeração exaustiva (55.986 sequências) achou
  //    para distinguir o código real do mutante «sem a guarda de repetição»: anunciar(P0), anunciar(P1), anunciar(P1). Com a guarda o 3º anúncio não faz NADA; sem ela, P0 (o retido) era
  //    descartado cedo demais, antes de o consumidor confirmar. O cenário 4 só repetia o anúncio sem nenhum retido pendente, e por isso não via a diferença (24/11). ───────────────────────────────
  {
    const ciclo = new CicloDePacote<PacoteDeMentira>()
    const P0 = pacote('P0')
    const P1 = pacote('P1')
    ciclo.anunciar(P0)
    ciclo.anunciar(P1)
    ciclo.anunciar(P1) // o efeito rodou de novo com o MESMO valor
    assert(d(P0) === 0, 'reanunciar o pacote atual NÃO descarta o retido: o consumidor ainda não confirmou (sem a guarda de repetição, P0 morria aqui)')
    assert(d(P1) === 0, 'o pacote atual segue vivo')
    ciclo.confirmar()
    assert(d(P0) === 1 && d(P1) === 0, 'e é a confirmação que descarta o retido, uma vez só')
    ciclo.encerrar()
  }

  // ── 5. O STRICTMODE do React (dev): monta, desmonta e monta de novo. `encerrar` seguido de novo uso tem de funcionar: um ciclo encerrado pode ser reaproveitado, sem lançar. ────────────────────
  {
    const ciclo = new CicloDePacote<PacoteDeMentira>()
    const A = pacote('A')
    ciclo.anunciar(A)
    ciclo.encerrar() // o cleanup simulado do StrictMode
    assert(d(A) === 1, 'o `encerrar` descarta o pacote em uso')
    const B = pacote('B')
    ciclo.anunciar(B) // a 2ª montagem
    ciclo.confirmar()
    assert(d(B) === 0 && d(A) === 1, 'depois de um `encerrar`, o ciclo volta a funcionar: B vive, A não é descartado de novo')
    ciclo.encerrar()
    assert(d(B) === 1, 'e `encerrar` de novo descarta B')
  }
}
