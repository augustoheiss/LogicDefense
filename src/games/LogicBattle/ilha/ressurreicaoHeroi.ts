import type { BiomaId } from './biomaRecursos'
import { fatorDoBuff } from './buffPorErro'
import { PARTIDA, type ClasseHeroi, type GrauConta } from './partidaPolicies'
import { clampVidaPartida, pontoLivreAoRedorDaObra, type Obra, type PartidaState } from './partidaSim'

export interface FichaRessurreicaoMin {
  readonly i: number
  readonly j: number
  readonly state: PartidaState
  readonly ritmo: 'cheio' | 'lento'
  readonly alerta: 'nenhum' | 'verde' | 'vermelho'
  readonly corpo: boolean
}

export interface AtlasRessurreicaoMin<TFicha extends FichaRessurreicaoMin = FichaRessurreicaoMin> {
  readonly heroiI: number
  readonly heroiJ: number
  readonly cenaI: number
  readonly cenaJ: number
  readonly fichas: TFicha[]
  readonly ressurreicao?: EstadoRessurreicao | null
}

export interface NucleoVivoNoAtlas {
  readonly mapaI: number
  readonly mapaJ: number
  readonly obraId: number
  readonly x: number
  readonly z: number
  readonly nivel: number
  readonly hp: number
  readonly maxHp: number
  readonly bioma: BiomaId
}

export interface EstadoRessurreicao {
  readonly aguardando: boolean
  readonly heroiClasse: ClasseHeroi
  readonly cooldownTotalSeg: number
  readonly cooldownRestanteSeg: number
  readonly nucleoDestino?: { readonly mapaI: number; readonly mapaJ: number; readonly obraId: number }
  readonly motivoQueda?: string
}

/**
 * Bônus de vida ao ressuscitar via conta matemática (alinhado à tabela base-2 do GRAU_PARTIDA):
 * graus 1..7 concedem +4, +8, +16, +32, +64, +128 e +256 de vida extra sobre a vida base.
 */
export function bonusVidaPorGrauConta(grau: GrauConta): number {
  return Math.pow(2, grau + 1)
}

/**
 * Calcula o tempo de espera passiva da ressurreição: 15s na primeira queda,
 * crescendo 5s por queda adicional até o teto de 45s.
 */
export function calcularCooldownRessurreicao(mortesAnteriores: number): number {
  const n = Number.isFinite(mortesAnteriores) && mortesAnteriores > 0 ? Math.floor(mortesAnteriores) : 0
  return Math.min(45, PARTIDA.ressurreicaoCooldownBaseSeg + n * 5)
}

/**
 * Lista todos os Núcleos aliados vivos (incluindo os em construção) em qualquer quadrado `(i, j)` do Atlas.
 */
export function nucleosVivosEmTodoAtlas<T extends AtlasRessurreicaoMin>(atlas: T): NucleoVivoNoAtlas[] {
  const lista: NucleoVivoNoAtlas[] = []
  for (const ficha of atlas.fichas) {
    for (const obra of ficha.state.obras) {
      if (obra.lado !== 'inimigo' && obra.tipo === 'nucleo' && obra.hp > 0) {
        lista.push({
          mapaI: ficha.i,
          mapaJ: ficha.j,
          obraId: obra.id,
          x: obra.x,
          z: obra.z,
          nivel: obra.nivel,
          hp: obra.hp,
          maxHp: obra.maxHp,
          bioma: ficha.state.bioma,
        })
      }
    }
  }
  lista.sort((a, b) => {
    const aAtual = a.mapaI === atlas.heroiI && a.mapaJ === atlas.heroiJ ? 0 : 1
    const bAtual = b.mapaI === atlas.heroiI && b.mapaJ === atlas.heroiJ ? 0 : 1
    if (aAtual !== bAtual) return aAtual - bAtual
    return Math.hypot(a.mapaI, a.mapaJ) - Math.hypot(b.mapaI, b.mapaJ)
  })
  return lista
}

/**
 * Escolhe um ponto caminhável ao redor do Núcleo que maximize a distância dos inimigos próximos
 * para evitar loop de spawn-kill ao ressuscitar sob cerco.
 */
export function pontoSeguroAoRedorDoNucleo(state: PartidaState, nucleo: Obra): { x: number; z: number } {
  const inimigos = state.unidades.filter((u) => u.lado === 'inimigo' && u.hp > 0)
  let melhor: { x: number; z: number } | null = null
  let melhorScore = -1
  for (const dist of [2.6, 3.6, 4.5]) {
    for (let passo = 0; passo < 12; passo += 1) {
      const ang = (passo * 2 * Math.PI) / 12
      const cx = nucleo.x + Math.cos(ang) * dist
      const cz = nucleo.z + Math.sin(ang) * dist
      const livre = pontoLivreAoRedorDaObra(state, nucleo, cx, cz)
      if (!livre) continue
      const menorDistInimigo =
        inimigos.length === 0
          ? 100
          : inimigos.reduce((menor, u) => Math.min(menor, Math.hypot(livre.x - u.x, livre.z - u.z)), Number.POSITIVE_INFINITY)
      if (menorDistInimigo > melhorScore) {
        melhorScore = menorDistInimigo
        melhor = livre
      }
    }
  }
  return melhor ?? pontoLivreAoRedorDaObra(state, nucleo) ?? { x: nucleo.x, z: Math.max(-PARTIDA.radius + 1, nucleo.z - 2.6) }
}

function nucleoPadraoParaRessuscitar<T extends AtlasRessurreicaoMin>(
  atlas: T,
  vivoPreferido?: { mapaI: number; mapaJ: number; obraId: number },
): NucleoVivoNoAtlas | null {
  const vivos = nucleosVivosEmTodoAtlas(atlas)
  if (vivos.length === 0) return null
  if (vivoPreferido) {
    const achado = vivos.find(
      (n) => n.mapaI === vivoPreferido.mapaI && n.mapaJ === vivoPreferido.mapaJ && n.obraId === vivoPreferido.obraId,
    )
    if (achado) return achado
  }
  return vivos[0]
}

/**
 * Inicializa o estado de espera de ressurreição quando o herói tomba e existe pelo menos um Núcleo vivo no Atlas.
 */
export function iniciarRessurreicao<T extends AtlasRessurreicaoMin>(atlas: T, heroiClasse: ClasseHeroi = 'ataque'): T {
  const destino = nucleoPadraoParaRessuscitar(atlas, atlas.ressurreicao?.nucleoDestino)
  if (!destino) return atlas
  const fichaCorpo = atlas.fichas.find((f) => f.i === atlas.heroiI && f.j === atlas.heroiJ)
  const mortesAnteriores = Math.max(0, (fichaCorpo?.state.mortesHeroi ?? 1) - 1)
  const cooldownTotalSeg = calcularCooldownRessurreicao(mortesAnteriores)
  return {
    ...atlas,
    ressurreicao: {
      aguardando: true,
      heroiClasse,
      cooldownTotalSeg,
      cooldownRestanteSeg: cooldownTotalSeg,
      nucleoDestino: { mapaI: destino.mapaI, mapaJ: destino.mapaJ, obraId: destino.obraId },
      motivoQueda: 'O herói tombou em combate.',
    },
  }
}

/**
 * Atualiza o Núcleo de destino escolhido pelo jogador para ressuscitar.
 */
export function escolherNucleoRessurreicao<T extends AtlasRessurreicaoMin>(
  atlas: T,
  mapaI: number,
  mapaJ: number,
  obraId: number,
): T {
  const existe = nucleosVivosEmTodoAtlas(atlas).find(
    (n) => n.mapaI === mapaI && n.mapaJ === mapaJ && n.obraId === obraId,
  )
  if (!existe || !atlas.ressurreicao?.aguardando) return atlas
  return {
    ...atlas,
    ressurreicao: {
      ...atlas.ressurreicao,
      nucleoDestino: { mapaI: existe.mapaI, mapaJ: existe.mapaJ, obraId: existe.obraId },
    },
  }
}

/**
 * Executa a ressurreição imediata do herói no Núcleo escolhido (em qualquer quadrado do Atlas),
 * concedendo bônus de HP quando via conta matemática e 3s de invulnerabilidade contra spawn-kill.
 */
export function ressuscitarHeroiNoNucleo<TFicha extends FichaRessurreicaoMin, T extends AtlasRessurreicaoMin<TFicha>>(
  atlas: T,
  opcoes: { viaConta?: { grau: GrauConta; erros?: number } } = {},
): T {
  const destino = nucleoPadraoParaRessuscitar(atlas, atlas.ressurreicao?.nucleoDestino)
  if (!destino) return atlas

  const fichaOrigem = atlas.fichas.find((f) => f.i === atlas.heroiI && f.j === atlas.heroiJ)
  const fichaDestino = atlas.fichas.find((f) => f.i === destino.mapaI && f.j === destino.mapaJ)
  if (!fichaOrigem || !fichaDestino) return atlas

  const nucleoObra = fichaDestino.state.obras.find(
    (o) => o.id === destino.obraId && o.lado !== 'inimigo' && o.tipo === 'nucleo' && o.hp > 0,
  )
  if (!nucleoObra) return atlas

  const spawn = pontoSeguroAoRedorDoNucleo(fichaDestino.state, nucleoObra)
  const bonusBruto = opcoes.viaConta ? bonusVidaPorGrauConta(opcoes.viaConta.grau) : 0
  const fator = opcoes.viaConta ? fatorDoBuff(opcoes.viaConta.erros ?? 0) : 1
  const bonusEfetivo = opcoes.viaConta ? Math.max(1, Math.floor(bonusBruto * fator)) : 0
  const vidaFinal = clampVidaPartida(PARTIDA.ressurreicaoVidaBase + bonusEfetivo)

  const mesmoMapa = fichaOrigem.i === fichaDestino.i && fichaOrigem.j === fichaDestino.j
  const madeiraCarregada = mesmoMapa ? 0 : fichaOrigem.state.madeira
  const ouroCarregado = mesmoMapa ? 0 : fichaOrigem.state.ouro
  const creditoCarregado = mesmoMapa ? 0 : fichaOrigem.state.credito

  const fichas: TFicha[] = atlas.fichas.map((ficha) => {
    if (ficha.i === fichaDestino.i && ficha.j === fichaDestino.j) {
      const heroiAtualizado = {
        ...fichaOrigem.state.heroi,
        x: spawn.x,
        z: spawn.z,
        y: 0,
        vy: 0,
        army: vidaFinal,
        shootCooldown: 0,
        carregandoKg: 0,
        invulneravelRestante: PARTIDA.invulnerabilidadeRessurreicaoSeg,
      }
      const heroisSinc = ficha.state.herois?.length
        ? ficha.state.herois.map((h) =>
            h.id === (ficha.state.heroiAtivoId ?? ficha.state.herois?.[0]?.id)
              ? { ...h, ...heroiAtualizado, vivo: true, ordem: null, tarefaConstrutor: null }
              : h,
          )
        : undefined
      return {
        ...ficha,
        corpo: true,
        ritmo: 'cheio' as const,
        alerta: 'nenhum' as const,
        state: {
          ...ficha.state,
          semCorpo: false,
          derrota: false,
          heroiCaido: false,
          mortesHeroi: fichaOrigem.state.mortesHeroi ?? ficha.state.mortesHeroi,
          olhar: 'terceira' as const,
          heroiOrdem: null,
          madeira: ficha.state.madeira + madeiraCarregada,
          ouro: ficha.state.ouro + ouroCarregado,
          credito: ficha.state.credito + creditoCarregado,
          ...(heroisSinc ? { herois: heroisSinc } : {}),
          heroi: heroiAtualizado,
        },
      }
    }
    if (ficha.i === fichaOrigem.i && ficha.j === fichaOrigem.j) {
      return {
        ...ficha,
        corpo: false,
        state: {
          ...ficha.state,
          semCorpo: true,
          heroiCaido: false,
          heroiOrdem: null,
          madeira: 0,
          ouro: 0,
          credito: 0,
        },
      }
    }
    return ficha
  })

  return {
    ...atlas,
    heroiI: destino.mapaI,
    heroiJ: destino.mapaJ,
    cenaI: destino.mapaI,
    cenaJ: destino.mapaJ,
    fichas,
    ressurreicao: null,
  }
}
