/**
 * Contratos unificados do subsistema de estudo (Fases Q2–Q4).
 *
 * Mantém a arquitetura Dual-Track ortogonal:
 *  - `motor_parametrico`: geradores infinitos locais (4 opções, altar físico 3D compatível).
 *  - `enem_oficial`: questões oficiais do INEP inalteradas, com citação completa CC BY-ND 3.0
 *    e 5 alternativas (A–E), sem colisão com as 4 placas físicas do altar.
 *
 * ZERO-SPOILER INVARIANT: `dicas[0..2]` guiam o raciocínio sem jamais revelar a resposta final.
 * `posAcerto` fica bloqueado na UI até o acerto.
 */
import type { ConceptId } from '../contaContratos'
import type { InfiniteMathChallenge } from '../infiniteMathEngine'

export type GrauDificuldade = 1 | 2 | 3 | 4 | 5 | 6 | 7

export type OrigemQuestao = 'motor_parametrico' | 'enem_oficial' | 'senai_oficial' | 'etec_oficial'

export type TipoErroPedagogico =
  | 'leitura_interpretacao'
  | 'unidade_escala'
  | 'conversao_unidades'
  | 'geometria_escala'
  | 'proporcao_invertida'
  | 'sinal_precedencia'
  | 'algebra_manipulacao'
  | 'porcentagem_base'
  | 'formula_geometria'
  | 'estatistica_mediana'
  | 'combinatoria_probabilidade'
  | 'calculo_aritmetico'
  | 'chute_rapido'

export interface ReferenciaOficial {
  readonly exame: 'ENEM' | 'SENAI' | 'ETEC'
  readonly ano: number
  readonly questao: number
  readonly aplicacao?: 'regular' | 'ppl_reaplicacao'
  readonly dia?: 2
  readonly caderno?: string
  readonly licenca: string
  readonly citacaoCurta: string
}

export interface DicaProgressiva {
  readonly nivel: 1 | 2 | 3
  readonly titulo: string
  readonly textoPt: string
}

export interface AlternativaUnificada {
  readonly id: string
  readonly letra: 'A' | 'B' | 'C' | 'D' | 'E'
  readonly rotulo: string
  readonly valorNumerico?: number
  readonly correta: boolean
  readonly diagnosticoPt: string
  readonly tagErro?: TipoErroPedagogico
}

export interface FiguraOficial {
  readonly src: string
  readonly alt: string
  readonly largura: number
  readonly altura: number
  readonly papel?: 'enunciado' | 'alternativa'
  readonly letra?: 'A' | 'B' | 'C' | 'D' | 'E'
  readonly tipoVisual?: 'grafico' | 'tabela' | 'geometria' | 'ilustracao'
}

export interface DesafioUnificado {
  readonly id: string
  readonly assinatura: string
  readonly origem: OrigemQuestao
  readonly grau: GrauDificuldade
  readonly temaId: string
  readonly temaTituloPt: string
  readonly arquetipoOuItemId: string
  readonly referenciaOficial?: ReferenciaOficial
  readonly enunciadoMarkdown: string
  readonly figuras?: readonly FiguraOficial[]
  /** Chave do acervo visual: `senai:2018:2143:30` ou `etec:2019:1:12`. O ENEM usa ano e número. */
  readonly chaveFigura?: string
  readonly alternativas: readonly AlternativaUnificada[]
  readonly altarFisicoCompativel: boolean
  readonly dicas: readonly [DicaProgressiva, DicaProgressiva, DicaProgressiva]
  readonly posAcerto: {
    readonly solucaoCompletaPt: string
    readonly metodos: readonly { readonly selo: string; readonly resumo: string }[]
    readonly dicaVidaRealPt: string
  }
}

export const TITULO_TEMA_ESTUDO: Record<string, string> = {
  ponto_de_virada: 'Equações e Compensação Numérica',
  nao_comutatividade: 'Ordem e Operações Não Comutativas',
  soma_repetida_esteira: 'Multiplicação Ágil e Fatores',
  visao_caminho_inteiro: 'Caminho Inteiro e Conjuntos',
  fracao_menor_que_um: 'Frações, Taxas e Proporções',
  divisao_por_fracao: 'Razão, Proporção e Regra de Três Inversa',
  fracao_impropria: 'Proporção Direta e Frações Impróprias',
  precedencia_operacoes: 'Média Aritmética e Precedência',
  divisao_euclidiana_resto: 'Divisores, Múltiplos, MMC e MDC',
  multiplicacao_decimal: 'Multiplicação com Decimais e Atalhos',
  assimetria_porcentagem: 'Porcentagem e Variação Assimétrica',
  divisao_decimal: 'Divisão Decimal e Escalas',
  porcentagem_acumulada: 'Porcentagem Acumulada e Juros',
  notacao_milhar: 'Notação Numérica e Ordens de Grandeza',
  expoente_zero: 'Potenciação e Expoentes',
  crescimento_quadratico: 'Quadrados, Fatoração e Diferença de Quadrados',
  subtracao_negativo: 'Subtração e Números Negativos',
  raiz_quadrada: 'Raízes e Estimativas',
  potencia_base_dez: 'Potências de Base 10 e Unidades',
  produto_sinais: 'Regra de Sinais em Produtos e Colchetes',
  equivalencia_gemeos: 'Dízimas Periódicas e Frações Geratrizes',
  enem_razoes_escalas: 'Razões, Escalas e Conversão de Unidades (ENEM)',
  enem_porcentagem_financeira: 'Porcentagem, Lucro e Matemática Financeira (ENEM)',
  enem_estatistica_medias: 'Médias, Mediana e Interpretação de Dados (ENEM)',
  enem_probabilidade_contagem: 'Probabilidade e Análise Combinatória (ENEM)',
  enem_funcoes_sequencias: 'Funções, Modelagem e Sequências (ENEM)',
  enem_geometria_medidas: 'Geometria Plana, Espacial e Medidas (ENEM)',
  enem_aritmetica_ciclos: 'Aritmética Aplicada, Ciclos e Sistemas (ENEM)',
  leitura_dados_codigo: 'Leitura de Dados, Códigos e Sistemas (ENEM)',
}

export function tituloDoTema(temaId: string): string {
  return TITULO_TEMA_ESTUDO[temaId] ?? temaId.replace(/_/g, ' ')
}

/**
 * Escapa `R$` / `US$` fora de trechos matemáticos `$...$` / `$$...$$`,
 * garantindo que `$R$` ou `$11 - R$` em LaTeX (ex.: ENEM 2022 Q159) nunca sejam quebrados.
 */
export function protegerCifraoMoeda(texto: string): string {
  let out = ''
  let inMath: null | '$' | '$$' = null
  let i = 0
  while (i < texto.length) {
    const ch = texto[i]
    if (ch === '\\') {
      out += texto.slice(i, i + 2)
      i += 2
      continue
    }
    if (inMath === '$$') {
      if (texto.startsWith('$$', i)) {
        out += '$$'
        inMath = null
        i += 2
      } else {
        out += ch
        i += 1
      }
      continue
    }
    if (inMath === '$') {
      if (ch === '$') inMath = null
      out += ch
      i += 1
      continue
    }
    if (texto.startsWith('$$', i)) {
      out += '$$'
      inMath = '$$'
      i += 2
      continue
    }
    if (ch === '$') {
      out += '$'
      inMath = '$'
      i += 1
      continue
    }
    if (texto.startsWith('R$', i) || texto.startsWith('US$', i)) {
      const prefix = texto.startsWith('US$', i) ? 'US' : 'R'
      out += `${prefix}\\$`
      i += prefix.length + 1
      continue
    }
    out += ch
    i += 1
  }
  return out
}

function atualizarEstadoMathNaLinha(linha: string, estadoInicial: null | '$' | '$$'): null | '$' | '$$' {
  let inMath = estadoInicial
  let i = 0
  while (i < linha.length) {
    if (linha[i] === '\\') {
      i += 2
      continue
    }
    if (inMath === '$$') {
      if (linha.startsWith('$$', i)) {
        inMath = null
        i += 2
      } else {
        i += 1
      }
      continue
    }
    if (inMath === '$') {
      if (linha[i] === '$') inMath = null
      i += 1
      continue
    }
    if (linha.startsWith('$$', i)) {
      inMath = '$$'
      i += 2
      continue
    }
    if (linha[i] === '$') {
      inMath = '$'
      i += 1
      continue
    }
    i += 1
  }
  return inMath
}

/**
 * Escapa marcadores de bloco CommonMark no início de cada linha fora de `$...$` / `$$...$$`
 * (ex.: `'5.'`, `'0109082.'`, `'10.'`, `'- item'`, `'>'`, `'#'`, `'---'`), evitando que alternativas
 * e células de tabela virem listas ordenadas vazias `<ol start="10"><li></li></ol>`.
 */
export function protegerMarkdownInline(texto: string): string {
  const comMoeda = protegerCifraoMoeda(texto)
  const linhas = comMoeda.replace(/\r\n/g, '\n').split('\n')
  let inMath: null | '$' | '$$' = null
  const protegidas = linhas.map((linha) => {
    let resultado = linha
    const comecaEmMath = inMath !== null || /^\s*\$/.test(linha)
    if (!comecaEmMath) {
      resultado = resultado
        .replace(/^(\s*\d+)([.)])(?=\s|$)/, '$1\\$2')
        .replace(/^(\s*)([-*_])((?:\s*\2){2,}\s*)$/, '$1\\$2$3')
        .replace(/^(\s*)([*+-]|>|#+)(?=\s|$)/, '$1\\$2')
    }
    inMath = atualizarEstadoMathNaLinha(linha, inMath)
    return resultado
  })
  return protegidas.join('\n')
}

export const DESCRICAO_ERRO_PEDAGOGICO: Record<
  TipoErroPedagogico,
  { readonly titulo: string; readonly alertaPratico: string }
> = {
  leitura_interpretacao: {
    titulo: 'Leitura do comando e restrições',
    alertaPratico:
      'Sublinhe exatamente o que a pergunta pede no último parágrafo (unidade, "pelo menos", "no máximo", "respectivamente") antes de armar a conta.',
  },
  unidade_escala: {
    titulo: 'Conversão de unidades e escalas',
    alertaPratico:
      'Confira sempre se área muda pelo quadrado do fator (k²) e volume pelo cubo (k³), e se 1 m³ = 1.000 L ou 1 L = 1.000 cm³.',
  },
  conversao_unidades: {
    titulo: 'Conversão entre unidades de medida',
    alertaPratico:
      'Antes de dividir ou multiplicar grandezas, padronize tudo para a mesma unidade (cm para m, m³ para L, segundos para minutos).',
  },
  geometria_escala: {
    titulo: 'Relações geométricas e escala',
    alertaPratico:
      'Verifique proporções entre lados, catetos e ângulos antes de aplicar fórmulas de área, perímetro ou Pitágoras.',
  },
  proporcao_invertida: {
    titulo: 'Proporção direta vs. inversa',
    alertaPratico:
      'Antes de multiplicar cruzado, pergunte: "Se uma grandeza dobrar, a outra dobra ou cai pela metade?"',
  },
  sinal_precedencia: {
    titulo: 'Sinais, parênteses e ordem das operações',
    alertaPratico:
      'Resolva de dentro para fora (parênteses → colchetes), multiplique/divida antes de somar e vigie sinais negativos antes de blocos.',
  },
  algebra_manipulacao: {
    titulo: 'Manipulação algébrica e equações',
    alertaPratico:
      'Ao isolar incógnitas ou resolver funções, mantenha a equivalência dos dois lados da igualdade e revise sinais ao trocar de termo.',
  },
  porcentagem_base: {
    titulo: 'Base da porcentagem e variações sucessivas',
    alertaPratico:
      'Aumentos/descontos sucessivos NÃO se somam em linha reta: cada etapa multiplica pelo fator sobre o novo valor-base.',
  },
  formula_geometria: {
    titulo: 'Áreas, volumes e relações geométricas',
    alertaPratico:
      'Verifique se o dado é raio ou diâmetro (d = 2r) e se a questão pede área lateral/fundo (sem tampa) ou volume.',
  },
  estatistica_mediana: {
    titulo: 'Mediana, moda e ordenação de dados',
    alertaPratico:
      'Para achar a mediana, ordene SEMPRE o conjunto em ordem crescente antes de olhar os valores do centro.',
  },
  combinatoria_probabilidade: {
    titulo: 'Contagem, restrições e espaço amostral',
    alertaPratico:
      'Confira se a ordem importa, se há repetição de grupos iguais e quantos casos satisfazem TODAS as condições.',
  },
  calculo_aritmetico: {
    titulo: 'Cálculo aritmético intermediário',
    alertaPratico:
      'Arme em frações para simplificar antes de multiplicar números grandes — reduz erro de conta e acelera a conferência.',
  },
  chute_rapido: {
    titulo: 'Resposta impulsiva (< 1,5 s)',
    alertaPratico:
      'Você clicou muito rápido antes de ler/armar a conta. Use o botão "Jogo (Q)" se estiver sob ataque e volte depois com calma.',
  },
}

interface DicasDoArquetipo {
  readonly foco: string
  readonly estrategia: string
  readonly armadilha: string
}

/**
 * Dicas socráticas 100% livres de spoiler para todos os 26 arquétipos do motor atual.
 * As dicas originais (`luzGuiaPt` / `stepByStepPt`) frequentemente entregavam a resposta final
 * e passam a ficar exclusivamente em `posAcerto` após o jogador acertar.
 */
const DICAS_POR_ARQUETIPO: Record<string, DicasDoArquetipo> = {
  g1_massinha_soma: {
    foco: 'Veja quanto falta para o primeiro número completar a próxima dezena redonda terminada em 0.',
    estrategia: 'Resumo de boteco: tire exatamente essa pontinha do segundo número e cole no primeiro — o total não muda e a soma vira brincadeira!',
    armadilha: 'Armadilha clássica: arredondar o primeiro número para cima e esquecer de descontar a mesma quantidade do segundo.',
  },
  g1_hack_japones_2d: {
    foco: 'Olhe para o número que está subtraindo: quanto falta para ele chegar numa dezena exata?',
    estrategia: 'Resumo de boteco: na subtração, somar o mesmo valor aos DOIS números mantém a distância intacta na régua e elimina o "pedir emprestado".',
    armadilha: 'Armadilha: arredondar só quem subtrai e esquecer de somar o mesmo ajuste no número da frente.',
  },
  g1_dobro_do_dobro_x4: {
    foco: 'Multiplicar por 4 equivale a dobrar duas vezes seguidas; multiplicar por 8 equivale a dobrar três vezes seguidas.',
    estrategia: 'Resumo de boteco: vá dobrando passo a passo em voz baixa (×2 → ×4 → ×8) em vez de armar tabuada longa.',
    armadilha: 'Cuidado para não parar no segundo dobro quando o fator pedido for 8!',
  },
  g1_relogio_x5_corta_meio: {
    foco: 'Pense no 5 como metade de 10 (5 = 10 ÷ 2).',
    estrategia: 'Resumo de boteco: corte o número par pela metade primeiro e só depois jogue um zero no final (multiplique por 10).',
    armadilha: 'Se o número for ímpar ou tiver resto ao dividir por 2, a meia unidade vale 5 no final — não descarte o resto.',
  },
  g1_equacao_balanca_1passo: {
    foco: 'Identifique o que foi feito com o número desconhecido e descubra qual é a operação inversa.',
    estrategia: 'Resumo de boteco: rebobine a história de trás para frente! Quem somou desfaz subtraindo; quem dividiu desfaz multiplicando.',
    armadilha: 'Confira no fim se o valor escolhido faz a frase do enunciado fechar certinha.',
  },
  g2_dobra_e_meia: {
    foco: 'Um dos fatores é par e o outro termina em 5 ou 50: dá para trocar peso entre os dois sem mudar o produto.',
    estrategia: 'Resumo de boteco: corte o fator par ao meio e dobre o outro fator ao mesmo tempo — aparece um número redondo na hora!',
    armadilha: 'Não dobre os dois lados nem divida os dois lados: enquanto um divide por 2, o outro multiplica por 2.',
  },
  g2_segredo_do_11_e_99: {
    foco: 'Observe se o multiplicador é 11 (10 + 1) ou próximo de uma potência de 10 (9, 99 = 100 − 1).',
    estrategia: 'Resumo de boteco: multiplique pela base redonda (×10 ou ×100) e depois some ou tire 1 cópia do outro número.',
    armadilha: 'No truque do 11 com dois dígitos, se a soma do meio passar de 9, lembre-se de subir 1 para a centena!',
  },
  g2_porcentagem_universo_100: {
    foco: 'Traduza a frase para uma fração centesimal ou compare a parte sobre o todo em escala percentual.',
    estrategia: 'Resumo de boteco: ache um décimo (dividir por dez) e um centésimo (dividir por cem) e vá montando o percentual desejado por blocos — ou inverta A% de B = B% de A!',
    armadilha: 'Verifique bem quem é o todo (denominador) e quem é a parte (numerador) antes de multiplicar por cem.',
  },
  g2_sinais_peso_alivio: {
    foco: 'Desenhe um termômetro ou elevador: abaixo do marco zero é dívida/subsolo; subir soma e perdoar dívida (−(−)) soma!',
    estrategia: 'Resumo de boteco: se você está no subsolo e sobe até o térreo, já andou a profundidade; depois soma o que subiu acima do nível do solo.',
    armadilha: 'Menos com menos colados antes de um número vira ganho positivo; duas dívidas somadas ficam mais negativas.',
  },
  g2_pemdas_trincheira: {
    foco: 'Separe os termos ligados por multiplicação/divisão antes de juntar com soma ou subtração.',
    estrategia: 'Resumo de boteco: multiplicação e divisão têm prioridade VIP! Resolva os blocos multiplicados primeiro e só no fim some ou subtraia da esquerda.',
    armadilha: 'Nunca some o primeiro número com o multiplicando antes de fazer a multiplicação!',
  },
  g3_fator_comum_evidencia: {
    foco: 'Existe um fator que se repete nos dois blocos separados por + ou −.',
    estrategia: 'Resumo de boteco: puxe o fator repetido para fora como chefe de fila, some ou subtraia os outros dois dentro dos parênteses e faça uma só conta!',
    armadilha: 'Verifique se o sinal entre os dois termos dentro dos parênteses foi respeitado (+ ou −).',
  },
  g3_diferenca_de_quadrados_e_final5: {
    foco: 'Reconheça o padrão a² − b² ou quadrado de número terminado em 5.',
    estrategia: 'Resumo de boteco: a² − b² é igual a (a + b) × (a − b)! E número terminado em 5 ao quadrado sempre termina em 25.',
    armadilha: 'Não confunda (a − b)² com a² − b²: na diferença de quadrados somamos os dois termos e multiplicamos pela diferença deles.',
  },
  g3_dizima_periodica_noves: {
    foco: 'Cada algarismo que se repete infinitamente na dízima coloca um algarismo nove no denominador da fração geratriz.',
    estrategia: 'Resumo de boteco: escreva a fração com noves no denominador, simplifique tudo o que puder com o outro número e só depois multiplique.',
    armadilha: 'Não trunque a dízima cortando casas decimais! Use a fração geratriz exata colocando um nove no denominador para cada dígito do período.',
  },
  g3_maquina_do_tempo_equacao: {
    foco: 'Escreva a história da esquerda para a direita como uma fila de operações sobre x.',
    estrategia: 'Resumo de boteco: desmonte na ordem INVERSA! Primeiro desfaça a última soma/subtração do lado de fora, só depois divida pelo coeficiente de x.',
    armadilha: 'Se dividir antes de desfazer a soma/subtração solta, a conta desalinha.',
  },
  g3_corte_cruzado_trincheira: {
    foco: 'Observe que cada numerador conversa por divisão exata com algum denominador cruzado.',
    estrategia: 'Resumo de boteco: passe a tesoura antes de multiplicar! Simplifique em cruz até sobrar números pequenos de cabeça.',
    armadilha: 'Só simplifique um de cima com um de baixo — nunca corte dois números que estão ambos em cima ou ambos em baixo!',
  },
  g4_problema_tanque_fracoes: {
    foco: 'Descubra quanto aumentou em fração do tanque entre o antes e o depois.',
    estrategia: 'Resumo de boteco: a diferença entre as duas frações corresponde exatamente aos litros adicionados. Ache quanto vale 1 fatia do denominador e multiplique pelo tanque inteiro!',
    armadilha: 'Não divida os litros apenas por uma das frações isoladas — use a diferença entre elas.',
  },
  g4_problema_heranca_restante: {
    foco: 'Coloque as duas frações gastas no mesmo denominador para ver que fração sobrou no cofre.',
    estrategia: 'Resumo de boteco: a parte que sobrou em fração (1 − soma gasta) corresponde às moedas restantes. Descubra quanto vale 1 pedaço e reconstrua o todo.',
    armadilha: 'Atenção à pergunta: ela pede o total inteiro, e não apenas a fração gasta!',
  },
  g4_problema_balanca_montar_resolver: {
    foco: 'Identifique claramente a expressão interna (parênteses → colchetes) ou a equação da fração.',
    estrategia: 'Resumo de boteco: resolva de dentro para fora com calma, cuidando dos sinais antes de multiplicar ou desfazer a fração.',
    armadilha: 'Sinal negativo antes de colchete inverte o sinal do resultado inteiro do colchete; multiplique antes de somar!',
  },
  g3_mmc_coincidencia: {
    foco: 'Você busca o PRIMEIRO instante futuro em que todos os ciclos se encontram ao mesmo tempo.',
    estrategia: 'Resumo de boteco: pegue o maior período da lista e teste os múltiplos dele (×1, ×2, ×3…) até achar o primeiro que todos os outros dividem sem resto!',
    armadilha: 'Armadilha: multiplicar todos os períodos entre si acha um encontro, mas quase nunca o PRIMEIRO encontro (MMC).',
  },
  g4_problema_regra3_inversa_equipe: {
    foco: 'Compare as duas situações: mais gente trabalhando no mesmo ritmo faz o tempo aumentar ou diminuir?',
    estrategia: 'Resumo de boteco: ache a carga total de trabalho multiplicando pessoas × tempo da primeira situação; depois reparta essa mesma carga pela nova equipe.',
    armadilha: 'Armadilha do "multiplica cruzado automático": como as grandezas são inversas, o produto (pessoas × tempo) é que permanece constante!',
  },
  g3_regra3_direta_producao: {
    foco: 'A produção mantém ritmo constante: mais tempo produz proporcionalmente mais.',
    estrategia: 'Resumo de boteco: descubra quanto é produzido em 1 unidade de tempo (dividindo produção inicial pelo tempo inicial) e multiplique pelo novo tempo.',
    armadilha: 'Não some apenas a diferença de tempo: a variação aqui é proporcional (multiplicativa).',
  },
  g3_media_nota_que_falta: {
    foco: 'Lembre-se de que a média alvo vale para TODAS as avaliações juntas, incluindo a que falta.',
    estrategia: 'Resumo de boteco: multiplique a média desejada pela quantidade total de provas para saber a soma total necessária, e desconte o que já foi somado.',
    armadilha: 'Não divida apenas pelas provas já feitas e não esqueça que a última prova entra na contagem total.',
  },
  g3_conjuntos_uniao_inter: {
    foco: 'Desenhe mentalmente dois círculos que se cruzam: quem faz as duas coisas está dentro da interseção.',
    estrategia: 'Resumo de boteco: ao somar os dois grupos inteiros, quem faz as duas coisas entra duas vezes! Desconte a interseção uma vez antes de comparar com o total.',
    armadilha: 'Leia com atenção se a pergunta quer quem faz PELO MENOS UMA das atividades ou quem não faz NENHUMA.',
  },
  g3_razao_dividir_proporcional: {
    foco: 'Veja quantas partes iguais o total inteiro representa quando somamos os dois termos da razão.',
    estrategia: 'Resumo de boteco: some as partes da razão para achar quantas fatias existem no bolo todo, divida o total por essas fatias e dê a cada um suas fatias!',
    armadilha: 'Confira exatamente para quem a pergunta pede o valor — não entregue a parte do outro!',
  },
  g4_problema_senhores_do_tempo_divisores: {
    foco: 'Leia se o pedido é divisores totais, só pares, só ímpares, primos ou divisores comuns entre dois números.',
    estrategia: 'Resumo de boteco: para um número só, monte os pares (1 × N, 2 × …) sem pular nenhum; para divisores comuns, ache o MDC dos dois e conte os divisores desse MDC.',
    armadilha: 'Não esqueça do 1 nem do próprio número (quando ele satisfaz a condição pedida)!',
  },
  g4_torneiras_em_paralelo: {
    foco: 'Em paralelo nunca somamos tempos direto — somamos (ou subtraímos, se um esvazia) a fração feita em 1 hora.',
    estrategia: 'Resumo de boteco: transforme cada tempo T em taxa por hora (1/T). Se ajudam, soma 1/t₁ + 1/t₂; se uma enche e outra esvazia, subtrai 1/t₁ − 1/t₂.',
    armadilha: 'Duas torneiras juntas SEMPRE terminam mais rápido do que a mais rápida sozinha (nunca na soma nem na média dos tempos!).',
  },
}

const LETRAS: readonly ('A' | 'B' | 'C' | 'D' | 'E')[] = ['A', 'B', 'C', 'D', 'E']

function dicasSegurasParaMotor(challenge: InfiniteMathChallenge): readonly [DicaProgressiva, DicaProgressiva, DicaProgressiva] {
  const d = DICAS_POR_ARQUETIPO[challenge.archetypeId]
  if (d) {
    return [
      { nivel: 1, titulo: 'Foco & Leitura', textoPt: d.foco },
      { nivel: 2, titulo: 'Resumo de Boteco', textoPt: d.estrategia },
      { nivel: 3, titulo: 'Primeiro Passo & Armadilha', textoPt: d.armadilha },
    ]
  }
  return [
    { nivel: 1, titulo: 'Foco & Leitura', textoPt: 'Identifique os dados conhecidos, a unidade e exatamente o que a pergunta pede.' },
    { nivel: 2, titulo: 'Resumo de Boteco', textoPt: 'Organize o problema em etapas simples antes de escolher a alternativa.' },
    { nivel: 3, titulo: 'Primeiro Passo & Armadilha', textoPt: 'Confira sinais, proporções e unidades antes de confirmar sua conta.' },
  ]
}

export function adaptarDesafioMotor(challenge: InfiniteMathChallenge): DesafioUnificado {
  const alternativas: AlternativaUnificada[] = challenge.choices.slice(0, 4).map((ch, idx) => ({
    id: ch.id,
    letra: LETRAS[idx] ?? 'A',
    rotulo: ch.label,
    valorNumerico: Number.isFinite(ch.value) ? ch.value : undefined,
    correta: ch.isCorrect,
    diagnosticoPt: ch.diagnosticPt,
    tagErro: tagErroPorConceptId(challenge.conceptId),
  }))

  return {
    id: challenge.id,
    assinatura: challenge.signature,
    origem: 'motor_parametrico',
    grau: challenge.tier,
    temaId: challenge.conceptId,
    temaTituloPt: tituloDoTema(challenge.conceptId),
    arquetipoOuItemId: challenge.archetypeId,
    enunciadoMarkdown: challenge.questionPt,
    alternativas,
    altarFisicoCompativel: true,
    dicas: dicasSegurasParaMotor(challenge),
    posAcerto: {
      solucaoCompletaPt: challenge.stepByStepPt,
      metodos: challenge.methods.map((m) => ({ selo: m.badge, resumo: m.summary })),
      dicaVidaRealPt: challenge.realLifeTipPt,
    },
  }
}

export function tagErroPorConceptId(conceptId: ConceptId): TipoErroPedagogico {
  switch (conceptId) {
    case 'assimetria_porcentagem':
    case 'porcentagem_acumulada':
      return 'porcentagem_base'
    case 'divisao_por_fracao':
    case 'fracao_impropria':
    case 'fracao_menor_que_um':
      return 'proporcao_invertida'
    case 'subtracao_negativo':
    case 'produto_sinais':
    case 'precedencia_operacoes':
      return 'sinal_precedencia'
    case 'divisao_decimal':
    case 'multiplicacao_decimal':
    case 'potencia_base_dez':
      return 'unidade_escala'
    default:
      return 'calculo_aritmetico'
  }
}
