export type ArmyCount = number

export const ARMY_CAP: ArmyCount = 1e300

export type GateOperator = '+' | '−' | '×' | '÷' | '%+' | '%−' | '^' | '√' | 'expr'

export interface RationalOperand {
  value: number
  num: number
  den: number
  exprKind?: 'add_mul' | 'double_neg_mul' | 'sub_neg'
  secondaryValue?: number
}

export interface Gate {
  id: string
  op: GateOperator
  operand: RationalOperand
  label: string
  subLabel?: string
  readingTimeMs: number
}

export type ConceptId =
  | 'ponto_de_virada'
  | 'nao_comutatividade'
  | 'soma_repetida_esteira'
  | 'visao_caminho_inteiro'
  | 'fracao_menor_que_um'
  | 'divisao_por_fracao'
  | 'fracao_impropria'
  | 'precedencia_operacoes'
  | 'divisao_euclidiana_resto'
  | 'multiplicacao_decimal'
  | 'assimetria_porcentagem'
  | 'divisao_decimal'
  | 'porcentagem_acumulada'
  | 'notacao_milhar'
  | 'expoente_zero'
  | 'crescimento_quadratico'
  | 'subtracao_negativo'
  | 'raiz_quadrada'
  | 'potencia_base_dez'
  | 'produto_sinais'
  | 'equivalencia_gemeos'

export interface RedemptionChoice {
  id: string
  label: string
  value: number
  isCorrect: boolean
  diagnosticPt: string
}

export type EngineId =
  | 'ponte_portoes'
  | 'cerco_torres'
  | 'forte_bandeira'
  | 'pedreira_rei'
  | 'arena_ondas'
  | 'serpente_numeros'
