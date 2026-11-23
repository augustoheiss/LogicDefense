import { custoDeEvoluir, descricaoDaEvolucao, NIVEL_MAXIMO } from './evolucaoObra'
import type { PecaId } from './partidaPolicies'

/**
 * A LISTA VERTICAL DE CONSTRUÇÕES (pedido do usuário, 23/11): «o status dos seus edifícios não é pra ficar mostrando horizontalmente [...] podemos fazer um filtro vertical que ao clicar aparece as suas construções e o que você quer
 * evoluir». Este módulo é PURO (sem React, sem a partida): recebe as obras e os recursos e devolve, para cada obra NOSSA e VIVA, o que a tela precisa desenhar: nome, nível, vida, o que o PRÓXIMO nível dá, o preço e se dá para pagar. O texto
 * do ganho e o preço saem da tabela de evolução (`evolucaoObra.ts`), a mesma que `evoluir` cobra: o que o jogador lê é o que a simulação faz. Tudo aceita entrada suja (NaN, negativo, infinito) sem produzir NaN, `undefined` nem linha quebrada.
 */

/** Só os campos de uma obra que a lista lê (a `Obra` da partida satisfaz): este módulo não importa a partida. */
export interface ObraDaLista {
  readonly id: number
  readonly lado: string
  readonly tipo: PecaId
  readonly nivel: number
  readonly hp: number
  readonly maxHp: number
  readonly construindoRestante?: number
}

export interface RecursosDaLista {
  readonly credito: number
  readonly madeira: number
  readonly ouro: number
}

export interface LinhaDaLista {
  readonly id: number
  readonly tipo: PecaId
  readonly titulo: string
  readonly nivel: number
  readonly nivelMaximo: boolean
  /** Vida e vida máxima INTEIRAS (arredondadas para baixo: a tela nunca mostra mais vida do que a obra tem). */
  readonly vida: number
  readonly vidaMaxima: number
  /** Abaixo de metade da vida máxima. */
  readonly fraca: boolean
  readonly emConstrucao: boolean
  /** O que o PRÓXIMO nível dá (texto da tabela) ou `null` no nível máximo. */
  readonly ganho: string | null
  /** O preço do PRÓXIMO nível (a tabela) ou `null` no nível máximo. */
  readonly preco: { credito: number; madeira: number; ouro: number } | null
  readonly podeEvoluir: boolean
  /** Por que NÃO dá para evoluir (só quando `podeEvoluir` é falso e há próximo nível); `undefined` quando pode. */
  readonly motivo?: string
}

/** Nomes CURTOS das obras para a lista (o título longo do ícone, «Torre de Vigia e Cerco», não cabe numa linha estreita). */
const NOME_CURTO: Readonly<Record<PecaId, string>> = {
  nucleo: 'Núcleo',
  torre: 'Torre',
  portao: 'Portão',
  quartel: 'Quartel',
  britador: 'Britador',
  serraria: 'Serraria',
  mina: 'Mina',
}

/** A ordem dos tipos na lista: o núcleo primeiro, depois a defesa, o recrutamento e a economia. */
const ORDEM_DO_TIPO: Readonly<Record<PecaId, number>> = { nucleo: 0, torre: 1, portao: 2, quartel: 3, britador: 4, serraria: 5, mina: 6 }

const finito = (v: number, padrao = 0): number => (typeof v === 'number' && Number.isFinite(v) ? v : padrao)
const naoNegativo = (v: number): number => Math.max(0, finito(v))
const inteiroBaixo = (v: number): number => Math.floor(naoNegativo(v))

/** O nível inteiro de 1 a `NIVEL_MAXIMO` (sujo vira 1). */
function nivelSeguro(nivel: number): number {
  const n = Math.floor(finito(nivel, 1))
  return Math.min(NIVEL_MAXIMO, Math.max(1, n))
}

/**
 * As linhas da lista: uma por obra NOSSA e VIVA (ruína e obra inimiga ficam de fora), com o núcleo primeiro e os demais por tipo e por id (ordem estável, que não depende da ordem em que as obras chegam). `recursos` decide se
 * dá para pagar a evolução: por licença OU por madeira e ouro, como `evoluir` cobra.
 */
export function linhasDaLista(obras: readonly ObraDaLista[], recursos: RecursosDaLista): LinhaDaLista[] {
  const credito = naoNegativo(recursos.credito)
  const madeira = naoNegativo(recursos.madeira)
  const ouro = naoNegativo(recursos.ouro)
  return obras
    .filter((obra) => obra.lado !== 'inimigo' && finito(obra.hp) > 0)
    .sort((a, b) => ORDEM_DO_TIPO[a.tipo] - ORDEM_DO_TIPO[b.tipo] || a.id - b.id)
    .map((obra): LinhaDaLista => {
      const nivel = nivelSeguro(obra.nivel)
      const nivelMaximo = nivel >= NIVEL_MAXIMO
      const emConstrucao = naoNegativo(obra.construindoRestante ?? 0) > 0
      const vida = inteiroBaixo(obra.hp)
      const vidaMaxima = Math.max(vida, inteiroBaixo(obra.maxHp))
      const preco = custoDeEvoluir(nivel)
      const ganho = descricaoDaEvolucao(obra.tipo, nivel)
      const pagaPorLicenca = preco !== null && credito >= preco.credito
      const pagaPorRecursos = preco !== null && madeira >= preco.madeira && ouro >= preco.ouro
      const podeEvoluir = !nivelMaximo && !emConstrucao && (pagaPorLicenca || pagaPorRecursos)
      let motivo: string | undefined
      if (!nivelMaximo && !podeEvoluir) motivo = emConstrucao ? 'Aguarde concluir a construção' : 'Falta licença ou recursos'
      return {
        id: obra.id,
        tipo: obra.tipo,
        titulo: NOME_CURTO[obra.tipo] ?? 'Construção',
        nivel,
        nivelMaximo,
        vida,
        vidaMaxima,
        fraca: vidaMaxima > 0 && vida < vidaMaxima / 2,
        emConstrucao,
        ganho: nivelMaximo ? null : ganho,
        preco: nivelMaximo ? null : preco,
        podeEvoluir,
        ...(motivo !== undefined ? { motivo } : {}),
      }
    })
}

export interface ContextoDoResumo {
  readonly tropas: number
  readonly emOrdens: number
  readonly emVigia: number
  /** Segundos para a próxima leva inimiga, ou `null` quando não há contador a mostrar. */
  readonly levaEm: number | null
  readonly dragao: boolean
  /** Alguma tropa está sem caminho até o destino (o aviso «sem caminho» da linha antiga). */
  readonly semCaminho?: boolean
  /** O núcleo inimigo DESTE mapa caiu: «sem novas levas» (o aviso da linha antiga). */
  readonly nucleoInimigoCaiu?: boolean
}

export interface ResumoDaBase {
  readonly temBase: boolean
  /** Um núcleo nosso que CAIU (hp 0): «base destruída», diferente de «sem base» (nunca teve). */
  readonly baseDestruida: boolean
  readonly vidaDoNucleo: number
  readonly tropas: number
  readonly emOrdens: number
  readonly emVigia: number
  /** Quantas obras nossas estão em construção (frágeis). */
  readonly emObras: number
  readonly levaEm: number | null
  readonly dragao: boolean
  readonly semCaminho: boolean
  readonly nucleoInimigoCaiu: boolean
}

/** O que a linha horizontal antiga dizia («Núcleo nível 1 · vida 100 · tropas 3 · ...»), agora como DADOS para o topo do painel. */
export function resumoDaBase(obras: readonly ObraDaLista[], contexto: ContextoDoResumo): ResumoDaBase {
  const nossas = obras.filter((obra) => obra.lado !== 'inimigo')
  const nucleos = nossas.filter((obra) => obra.tipo === 'nucleo')
  const vivo = nucleos.find((obra) => finito(obra.hp) > 0)
  return {
    temBase: vivo !== undefined,
    baseDestruida: vivo === undefined && nucleos.length > 0,
    vidaDoNucleo: vivo ? inteiroBaixo(vivo.hp) : 0,
    tropas: inteiroBaixo(contexto.tropas),
    emOrdens: inteiroBaixo(contexto.emOrdens),
    emVigia: inteiroBaixo(contexto.emVigia),
    emObras: nossas.filter((obra) => finito(obra.hp) > 0 && naoNegativo(obra.construindoRestante ?? 0) > 0).length,
    levaEm: contexto.levaEm === null ? null : Math.max(0, Math.ceil(finito(contexto.levaEm))),
    dragao: contexto.dragao === true,
    semCaminho: contexto.semCaminho === true,
    nucleoInimigoCaiu: contexto.nucleoInimigoCaiu === true,
  }
}
