import { createPartida } from '../partidaSim'
import { PARTIDA } from '../partidaPolicies'
import { avaliarRespostasDoMundo } from './respostasDoMundo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export async function run(): Promise<void> {
  const base = createPartida(0, 0)

  // 1. Chave desligada, qualidade Leve ou subsolo retornam estado neutro
  for (const opts of [
    { ativo: false, movimentoReduzido: false, noSubsolo: false, qualidade: 'ultra' as const },
    { ativo: true, movimentoReduzido: false, noSubsolo: true, qualidade: 'ultra' as const },
    { ativo: true, movimentoReduzido: false, noSubsolo: false, qualidade: 'leve' as const },
  ]) {
    const r = avaliarRespostasDoMundo(base, opts)
    assert(
      r.intensidadeOnda === 0 &&
        r.corrupcao === null &&
        r.pulsoAltar === null &&
        r.pulsoNucleo === null &&
        r.tensaoCeu === 0 &&
        r.animado === false,
      `estado neutro esperado para ativo=${opts.ativo}, subsolo=${opts.noSubsolo}, qualidade=${opts.qualidade}`,
    )
  }

  // 2. Corrupção ao redor da base inimiga escala com nível e fatorInimigo
  const inimigo = base.obras.find((o) => o.lado === 'inimigo' && o.tipo === 'nucleo')
  assert(inimigo !== undefined, 'partida inicial possui núcleo inimigo')
  const rBase = avaliarRespostasDoMundo(base, {
    ativo: true,
    movimentoReduzido: false,
    noSubsolo: false,
    qualidade: 'bonito',
  })
  assert(rBase.corrupcao !== null && rBase.corrupcao.raio >= 5.5, 'corrupção ativa para núcleo inimigo vivo')

  const forte = {
    ...base,
    fatorInimigo: 4,
    obras: base.obras.map((o) => (o.id === inimigo.id ? { ...o, nivel: 5 } : o)),
  }
  const rForte = avaliarRespostasDoMundo(forte, {
    ativo: true,
    movimentoReduzido: false,
    noSubsolo: false,
    qualidade: 'ultra',
  })
  assert(
    rForte.corrupcao !== null &&
      rForte.corrupcao.raio > rBase.corrupcao!.raio &&
      rForte.corrupcao.intensidade > rBase.corrupcao!.intensidade,
    'corrupção cresce com nivel do núcleo inimigo e fatorInimigo',
  )

  // 3. Alerta nos últimos 5s da onda
  const longeOnda = avaliarRespostasDoMundo(
    { ...base, ondaRelogio: Math.max(0, PARTIDA.ondaPeriodo - 12) },
    { ativo: true, movimentoReduzido: false, noSubsolo: false, qualidade: 'bonito' },
  )
  assert(longeOnda.intensidadeOnda === 0, 'sem alerta quando faltam > 5s para onda')

  const pertoOnda = avaliarRespostasDoMundo(
    { ...base, ondaRelogio: Math.max(0, PARTIDA.ondaPeriodo - 2) },
    { ativo: true, movimentoReduzido: false, noSubsolo: false, qualidade: 'bonito' },
  )
  assert(
    Math.abs(pertoOnda.intensidadeOnda - 0.6) < 1e-6 && pertoOnda.tensaoCeu > 0,
    `intensidadeOnda proporcional nos últimos 5s (veio ${pertoOnda.intensidadeOnda})`,
  )

  // 4. Altar resolvido: acerto vs erro
  const sAcerto = {
    ...base,
    altar: {
      tier: 1 as const,
      correta: 0 as const,
      placasAtivas: true,
      cx: 3,
      cz: -4,
      resolvido: true,
      aviso: 'Correto! +4 tropas',
      ganhoVida: 4,
      erros: 0,
      placaPisada: null,
    },
  }
  const rAcerto = avaliarRespostasDoMundo(sAcerto, {
    ativo: true,
    movimentoReduzido: false,
    noSubsolo: false,
    qualidade: 'bonito',
  })
  assert(rAcerto.pulsoAltar?.tipo === 'acerto' && rAcerto.pulsoAltar.cx === 3, 'acerto no altar gera pulso dourado')

  const sErro = {
    ...base,
    altar: {
      tier: 1 as const,
      correta: 0 as const,
      placasAtivas: true,
      cx: 3,
      cz: -4,
      resolvido: true,
      aviso: 'Resposta incorreta!',
      ganhoVida: -2,
      erros: 1,
      placaPisada: 1 as const,
    },
  }
  const rErro = avaliarRespostasDoMundo(sErro, {
    ativo: true,
    movimentoReduzido: false,
    noSubsolo: false,
    qualidade: 'bonito',
  })
  assert(rErro.pulsoAltar?.tipo === 'erro', 'erro no altar gera pulso rubro')

  const sErroAberto = {
    ...base,
    altar: {
      tier: 1 as const,
      correta: 0 as const,
      placasAtivas: true,
      cx: 3,
      cz: -4,
      resolvido: false,
      aviso: '',
      erros: 2,
      placaPisada: 1 as const,
    },
  }
  const rErroAberto = avaliarRespostasDoMundo(sErroAberto, {
    ativo: true,
    movimentoReduzido: false,
    noSubsolo: false,
    qualidade: 'bonito',
  })
  assert(rErroAberto.pulsoAltar?.tipo === 'erro', 'erro em altar aberto (altar.erros > 0) também gera pulso rubro')

  // 5. Herói caído encontra núcleo aliado vivo e eleva tensão
  const sCaido = {
    ...base,
    heroiCaido: true,
    obras: [
      ...base.obras,
      { ...inimigo, id: 999, lado: 'nosso' as const, tipo: 'nucleo' as const, x: 2, z: 3, hp: 100 },
    ],
  }
  const rCaido = avaliarRespostasDoMundo(sCaido, {
    ativo: true,
    movimentoReduzido: true,
    noSubsolo: false,
    qualidade: 'bonito',
  })
  assert(
    rCaido.pulsoNucleo?.x === 2 && rCaido.pulsoNucleo.z === 3 && rCaido.tensaoCeu >= 0.45 && rCaido.animado === false,
    'heroiCaido aponta núcleo aliado e respeita movimentoReduzido',
  )
}
