import { Gate } from './contaContratos'

export type ClasseHeroi = 'ataque' | 'tanque' | 'construtor'
export type TipoTropaAliada = 'soldado' | 'arqueiro' | 'lanceiro'
export type TipoFormacao = 'linha' | 'caixa' | 'dispersa'
export type TipoUpgradeEra = 'forja' | 'alvenaria' | 'botas'
export type Olhar = 'primeira' | 'terceira' | 'imperio'

export interface UpgradesEra {
  readonly forja: number
  readonly alvenaria: number
  readonly botas: number
}

export interface SpecUpgradeEra {
  readonly id: TipoUpgradeEra
  readonly nomePt: string
  readonly resumoPt: string
  readonly custoOuroBase: number
  readonly custoMadeiraBase: number
  readonly bonusPorNivel: number
  readonly maxNivel: number
}

export const SPEC_UPGRADE_ERA: Readonly<Record<TipoUpgradeEra, SpecUpgradeEra>> = {
  forja: {
    id: 'forja',
    nomePt: 'Forja de Guerra',
    resumoPt: '+20% de dano de tropas aliadas por nível',
    custoOuroBase: 4,
    custoMadeiraBase: 2,
    bonusPorNivel: 0.2,
    maxNivel: 3,
  },
  alvenaria: {
    id: 'alvenaria',
    nomePt: 'Alvenaria Reforçada',
    resumoPt: '+30% de HP de obras aliadas por nível',
    custoOuroBase: 3,
    custoMadeiraBase: 4,
    bonusPorNivel: 0.3,
    maxNivel: 3,
  },
  botas: {
    id: 'botas',
    nomePt: 'Botas de Marcha',
    resumoPt: '+15% de velocidade das tropas aliadas por nível',
    custoOuroBase: 3,
    custoMadeiraBase: 3,
    bonusPorNivel: 0.15,
    maxNivel: 3,
  },
}

export function custoUpgradeEra(tipo: TipoUpgradeEra, nivelAtual: number): { ouro: number; madeira: number } {
  const spec = SPEC_UPGRADE_ERA[tipo]
  const escala = Math.max(1, nivelAtual + 1)
  return {
    ouro: spec.custoOuroBase * escala,
    madeira: spec.custoMadeiraBase * escala,
  }
}

export function fatorDanoForja(upgrades?: UpgradesEra): number {
  return 1 + (upgrades?.forja ?? 0) * SPEC_UPGRADE_ERA.forja.bonusPorNivel
}

export function fatorHpAlvenaria(upgrades?: UpgradesEra): number {
  return 1 + (upgrades?.alvenaria ?? 0) * SPEC_UPGRADE_ERA.alvenaria.bonusPorNivel
}

export function fatorVelBotas(upgrades?: UpgradesEra): number {
  return 1 + (upgrades?.botas ?? 0) * SPEC_UPGRADE_ERA.botas.bonusPorNivel
}

/**
 * Triângulo clássico AoE de contra-unidades:
 * - Arqueiro causa +30% contra hordas.
 * - Lanceiro causa +35% contra sitiantes e dragões.
 * - Soldado de escudo sofre -25% de dano (0,75x) de torres, arqueiros e dragões.
 */
export function multiplicadorTrianguloAoE(
  atacanteTipo: TipoTropaAliada | 'inimigo_sitiante' | 'inimigo_dragao' | 'inimigo_horda' | 'torre',
  alvoTipo: TipoTropaAliada | Papel,
): number {
  if (atacanteTipo === 'arqueiro' && alvoTipo === 'horda') return 1.3
  if (atacanteTipo === 'lanceiro' && (alvoTipo === 'sitiante' || alvoTipo === 'dragao')) return 1.35
  if (
    alvoTipo === 'soldado' &&
    (atacanteTipo === 'torre' || atacanteTipo === 'arqueiro' || atacanteTipo === 'inimigo_dragao')
  ) {
    return 0.75
  }
  return 1.0
}

export interface EstadoPosse {
  readonly tipo: 'tropa'
  readonly unidadeId: number
  readonly modo: 'primeira' | 'terceira'
  readonly yaw: number
  readonly pitch: number
  readonly y: number
  readonly vy: number
  readonly shootCooldown: number
}

export interface SpecHeroi {
  readonly classe: ClasseHeroi
  readonly tituloPt: string
  readonly hpBase: number
  readonly reducaoDanoPct: number
  readonly danoTiro: number
  readonly alcance: number
  readonly cooldownTreinoSeg: number
  readonly capacidadeConstrutor: boolean
}

export const SPEC_HEROI: Readonly<Record<ClasseHeroi, SpecHeroi>> = {
  ataque: {
    classe: 'ataque',
    tituloPt: 'Herói Ataque (DPS)',
    hpBase: 14,
    reducaoDanoPct: 0,
    danoTiro: 12,
    alcance: 18,
    cooldownTreinoSeg: 8,
    capacidadeConstrutor: false,
  },
  tanque: {
    classe: 'tanque',
    tituloPt: 'Herói Tanque',
    hpBase: 30,
    reducaoDanoPct: 0.45,
    danoTiro: 5,
    alcance: 10,
    cooldownTreinoSeg: 10,
    capacidadeConstrutor: false,
  },
  construtor: {
    classe: 'construtor',
    tituloPt: 'Herói Construtor',
    hpBase: 16,
    reducaoDanoPct: 0.1,
    danoTiro: 4,
    alcance: 12,
    cooldownTreinoSeg: 7,
    capacidadeConstrutor: true,
  },
}

export interface SpecTropaAliada {
  readonly tipo: TipoTropaAliada
  readonly tituloPt: string
  readonly cooldownSeg: number
  readonly custoCredito: number
  readonly custoOuro: number
  readonly custoMadeira: number
  readonly hpFator: number
  readonly danoBase: number
  readonly danoOrdem: number
  readonly alcance: number
  readonly vel: number
}

export const SPEC_TROPA_ALIADA: Readonly<Record<TipoTropaAliada, SpecTropaAliada>> = {
  soldado: {
    tipo: 'soldado',
    tituloPt: 'Soldado',
    cooldownSeg: 4,
    custoCredito: 1,
    custoOuro: 2,
    custoMadeira: 0,
    hpFator: 1.0,
    danoBase: 4,
    danoOrdem: 10,
    alcance: 1.15,
    vel: 8,
  },
  arqueiro: {
    tipo: 'arqueiro',
    tituloPt: 'Arqueiro',
    cooldownSeg: 5,
    custoCredito: 1,
    custoOuro: 2,
    custoMadeira: 1,
    hpFator: 0.75,
    danoBase: 5,
    danoOrdem: 9,
    alcance: 10,
    vel: 7.6,
  },
  lanceiro: {
    tipo: 'lanceiro',
    tituloPt: 'Lanceiro',
    cooldownSeg: 5,
    custoCredito: 1,
    custoOuro: 3,
    custoMadeira: 0,
    hpFator: 1.15,
    danoBase: 6,
    danoOrdem: 12,
    alcance: 1.45,
    vel: 9.6,
  },
}

/**
 * Limite de heróis simultâneos de acordo com o maior nível de Núcleo aliado vivo:
 * Nv 1–2 = 1 herói; Nv 3–4 = 2 heróis; Nv 5 = 3 heróis.
 */
export function limiteHeroisPorNivelNucleo(nivelMaxNucleo: number): number {
  if (!Number.isFinite(nivelMaxNucleo) || nivelMaxNucleo <= 2) return 1
  if (nivelMaxNucleo <= 4) return 2
  return 3
}
export type Postura = 'ordens' | 'automatico' | 'vigia' | 'noLugar' | 'calado'
export type PecaId = 'nucleo' | 'torre' | 'portao' | 'quartel' | 'britador' | 'serraria' | 'mina'
export type Papel = 'horda' | 'tropa' | 'sitiante' | 'isca' | 'dragao'
export type PoliticaMinimapas = 'atual' | 'alguns' | 'todos'
export type QualidadeGraficaPreset = 'auto' | 'leve' | 'bonito' | 'ultra'

export const OBRA_CENTRO_Y = 0.8
export const DIMENSOES_OBRA: Record<PecaId, [number, number, number]> = {
  nucleo: [2, 1.6, 2],
  quartel: [2, 1.6, 2],
  britador: [2, 1.6, 2],
  serraria: [1.9, 1.5, 1.9],
  mina: [2.1, 1.5, 2.1],
  torre: [1.1, 2.4, 1.1],
  portao: [2.4, 2.2, 0.4],
}

export const TEMPO_CONSTRUCAO: Record<PecaId, number> = {
  nucleo: 6,
  torre: 5,
  portao: 4,
  quartel: 6,
  britador: 5,
  serraria: 5,
  mina: 6,
}

export interface OrdemMover {
  tipo: 'mover'
  x: number
  z: number
  /**
   * O destino ORIGINAL que o jogador pediu, só quando ele fica FORA do quadrado do mapa (M5, pedido do usuário 23/11: tropas atravessam de mapa). `x`/`z` seguem PRESOS dentro do mapa (a formação e o A* só
   * enxergam pontos de dentro), e a tropa anda até a borda; o atlas lê `alem` para saber que ela quer passar e a transfere com a ordem convertida. Ausente em toda ordem com destino interno.
   */
  alem?: { x: number; z: number }
}

export interface OrdemAtacar {
  tipo: 'atacar'
  alvoId: number
}

export interface OrdemAtacarObra {
  tipo: 'atacarObra'
  obraId: number
}

export interface OrdemPatrulhar {
  tipo: 'patrulhar'
  ax: number
  az: number
  bx: number
  bz: number
  indoPara: 'a' | 'b'
}

export interface OrdemAttackMove {
  tipo: 'attackMove'
  x: number
  z: number
}

export type Ordem = OrdemMover | OrdemAtacar | OrdemAtacarObra | OrdemPatrulhar | OrdemAttackMove

export const PARTIDA = {
  vidaCap: 999_999,
  invulnerabilidadeRessurreicaoSeg: 3,
  ressurreicaoCooldownBaseSeg: 15,
  ressurreicaoVidaBase: 10,
  maxFilaProducao: 5,
  heroiCustoCredito: 2,
  heroiCustoOuro: 4,
  heroiCustoMadeira: 3,
  construtorColetaCooldownSeg: 1.5,
  construtorReparoCooldownSeg: 1.0,
  construtorReparoPorTick: 15,
  enemHabilitado: true as boolean,
  radius: 56,
  body: 0.35,
  eyeY: 1.6,
  pitchMin: -1.45,
  pitchMax: 1.45,
  pitchTetoTiro: 1,
  dtMax: 0.05,
  dtBudgetMax: 3,
  heroSpeed: 8,
  pulo: 9.6,
  gravidade: 28,
  allyCap: 24,
  tropaEspacoFormacao: 1.2,
  tropaRaioSeparacao: 0.85,
  enemyCap: 12,
  creditoInicial: 4,
  shootRange: 14,
  shootDot: 0.5,
  tiroFolgaMin: 0.55,
  tiroFolgaExtra: 2.1,
  tiroFolgaEscala: 6,
  tiroCorpoBaixo: 0.2,
  tiroCorpoAlto: 1.35,
  shootCooldown: 0.45,
  hitRadius: 0.9,
  hitDamage: 3,
  danoContatoSitianteHeroi: 1,
  danoContatoDragaoHeroi: 3,
  contatoInimigoHeroiCooldown: 4.0,
  atrasoPrimeiraLevaNucleoConstrucao: true as boolean,
  acquireHorda: 16,
  aggroZ: 22,
  acquireAliado: 22,
  allySpeed: 8,
  enemySpeed: 4.2,
  melee: 1.15,
  nucleoContato: 1.7,
  danoOrdem: 10,
  danoAutomatico: 4,
  danoSitio: 3,
  golpeCooldown: 0.5,
  nucleoHp: 100,
  obraMeio: 1.15,
  // O alcance, o dano e a visão da torre vêm de `evolucaoObra.ts` (a tabela de evolução, 23/11): `torreAlcance` (12) e `torreDano` (6) saíram daqui. A recarga continua aqui.
  torreCooldown: 0.8,
  ondaPeriodo: 20,
  pedraX: -8,
  pedraZ: 10,
  pedraKg: 35,
  pedraMeio: 0.4,
  pedraAltura: 0.7,
  britadorDivisor: 10,
  reparoLingotes: 3,
  reparoCredito: 2,
  nivelMaximoObra: 5,
  // O preço de evoluir NÃO mora mais aqui: cresce 1,5× por nível e vem de `custoDeEvoluir` (`evolucaoObra.ts`), a mesma tabela que `evoluir` cobra e que o painel mostra.
  rebroteArvoreSeg: 45,
  aguaFatorVelocidade: 0.55,
  custoAguaCaminho: 2.2,
  orcamentoFrameTodosMs: 28,
  orcamentoStepTodosMs: 9,
  maxLentosPorFrame: 2,
  visualPbrHabilitado: true as boolean,
  // Névoa de guerra PINTADA no chão (relevo e visual AoE, F1): troca as 12.769 colunas cinza (141.120 triângulos) por um plano com textura 113×113. LIGADA por padrão desde 24/11/2026 (decisão do usuário, depois de ver as fotos; desligar volta às colunas de hoje: é a janela de rollback); ligada, o
  // desenho das colunas (`nuvem`/`penumbra` em IlhaRua) não é montado. A REGRA de visão (`cobertoAgora`, `chaoRevelado`) é a mesma nos dois modos: só o desenho muda.
  nevoaPintada: true as boolean,
  // Pós-processamento HDR (relevo e visual AoE, F1): bloom seletivo, oclusão ambiente (Ultra) e o tom aplicado uma vez no fim, por `EffectComposer`. DESLIGADO por padrão até a foto aprovar. O Leve
  // NUNCA o liga, com a chave ligada ou não (`configDoComposer`): é a rede de segurança de máquina fraca.
  posProcessamento: true as boolean,
  // Ambiente por IBL (relevo e visual AoE, F1 Task 8b): `scene.environment` gerado do céu do bioma (`ambientePmrem.ts`), só no Bonito e no Ultra. Ligada em 27/11/2026 junto com `fatorDeReflexo` por material na cena para preservar cores quentes do solo/grama enquanto ouro e cristais refletem o céu.
  ambienteIbl: true as boolean,
  // RELEVO (relevo e visual AoE, F2, 25/11/2026): o terreno de morros, vales e lagoas em bacia. `visual` liga o desenho SÓ (o chão, as obras, os props, as tropas, a câmera e o clique seguem o
  // terreno); a SIMULAÇÃO continua plana (o herói e as tropas ainda atravessam o morro: as regras do relevo são a F3, com «ok» separado do usuário). Ligada em 27/11/2026 por pedido do usuário.
  // A ÁGUA (relevo e visual AoE, F2, 26/11/2026): `agua` liga os RIOS (valetas escavadas com água dentro, só desenho). Ligada em 27/11/2026.
  // AS REGRAS DO RELEVO (F3, 27/11/2026, «ok» separado do usuário): `regras` liga bloqueio por penhasco (declMaxAndar), A* por declive e rio, plataformas em obras, linha de visão na névoa/combate, dano ±25% e alcance ±0,5 m/m. Desligada = plano I1.
  relevo: { visual: true as boolean, agua: true as boolean, regras: true as boolean },
  // EFEITOS DE AMBIENTE E RESPOSTAS (relevo e visual AoE, F4/F5, 27/11/2026): nuvens FBM, partículas por bioma, bando de pássaros, vento em árvores/grama, tochas HDR nas obras e respostas visuais do mundo (F5).
  // Só visual (não toca em `partidaSim.ts`). O Leve, o subsolo e `prefers-reduced-motion` desligam ou congelam os efeitos automaticamente.
  efeitos: {
    ativo: true as boolean,
    nuvens: true as boolean,
    particulas: true as boolean,
    passaros: true as boolean,
    ventoArvores: true as boolean,
    tochasObras: true as boolean,
    respostas: true as boolean,
  },
  qualidadeGraficaPadrao: 'auto' as QualidadeGraficaPreset,
  capacidadePoolBiomasGpu: 2,
  mostrarFaixaTiroVisual: false as boolean,
  usarLoSPorAltura: true as boolean,
  alturaLinhaPadrao: 2 as 1 | 2 | 3,
  materialBlocoPadrao: 'madeira' as 'madeira' | 'pedra' | 'ouro',
  alcanceEdicaoBlocos: 7,
  limiarArrastoPx: 6,
  limiarArrastoRmbPx: 12,
  altarPasso: 4,
  altarRaio: 1.15,
  asphaltEndZ: 40,
  celula: 1,
  espiral: 5,
  recalcularSeg: 0.4,
  maxVisitas: 5000,
  caminho: 'grade' as 'grade' | 'reto',
  levaDistancia: 16,
  levaPrimeira: 4,
  levaSeguinte: 1,
  levaAlvo: 'nucleo' as 'nucleo' | 'perto',
  corpoPasso: 3.2,
  nuvem: true as boolean,
  ladoMapa: 112,
  mapasResidentes: 3,
  atlas: 'grade' as 'grade' | 'um',
  visao: {
    heroi: 18,
    tropa: 12,
    obra: 10,
    // a visão da TORRE não é mais fixa: é o alcance dela (`alcanceDaTorre`, 22 m no nível 1, +2 m por nível), em `evolucaoObra.ts`.
  },
} as const

/**
 * O que uma conta CERTA paga, por grau (base 2: `bonus = 2^(grau + 1)` → +4 .. +256).
 * Graus 1..4 vêm dos motores paramétricos; graus 5..7 (Hardcore, Super Hardcore, Especialista)
 * são alimentados pelo acervo ENEM + motores ENEM-like. Cada erro divide o buff por 2 (`buffPorErro`).
 */
export type GrauConta = 1 | 2 | 3 | 4 | 5 | 6 | 7

export const GRAU_PARTIDA: Record<GrauConta, { wipe: number; bonus: number; credito: number; rotulo: string; sub: string }> = {
  1: { wipe: 0.35, bonus: 4, credito: 1, rotulo: '🟢 Fácil (+4)', sub: 'Cálculo ágil' },
  2: { wipe: 0.6, bonus: 8, credito: 1, rotulo: '🔵 Médio (+8)', sub: 'Aritmética elegante' },
  3: { wipe: 0.85, bonus: 16, credito: 2, rotulo: '🟣 Difícil (+16)', sub: 'Problemas & álgebra' },
  4: { wipe: 1, bonus: 32, credito: 2, rotulo: '👑 Muito Difícil (+32)', sub: 'Desafios contextuais' },
  5: { wipe: 1, bonus: 64, credito: 3, rotulo: '🔥 Hardcore · ENEM (+64)', sub: 'ENEM · 1º nível' },
  6: { wipe: 1, bonus: 128, credito: 4, rotulo: '⚡ S. Hardcore · ENEM (+128)', sub: 'ENEM · Multi-passo' },
  7: { wipe: 1, bonus: 256, credito: 5, rotulo: '🏆 Especialista · ENEM (+256)', sub: 'ENEM · Alta complexidade' },
}

export const PLUS_TEN: Gate = {
  id: 'arco-mais-10',
  op: '+',
  operand: { value: 10, num: 10, den: 1 },
  label: '+10',
  readingTimeMs: 0,
}

// SEM OBSTÁCULOS FIXOS (25/11/2026, decisão do usuário: «essa rua não era pra existir, ela fazia parte de outro jogo»). As 3 caixas laranja do corredor de portões saíram do desenho e da regra: cada
// minimapa é do seu bioma e do seu relevo, não uma pista igual em todos. A lista continua EXISTINDO (vazia) porque a colisão, o piso e o caminho a leem (8 usos em `partidaSim`, 1 em `verticalidadeVoxel`);
// quem quiser um obstáculo fixo no futuro (uma estrutura por bioma) o põe aqui e tudo o mais já o respeita.
export const OBSTACULOS: readonly { x: number; z: number; hx: number; hz: number; altura: number }[] = []
