import {
  derivarContextoHud,
  recuperarGrupoControle,
  salvarGrupoControle,
  selecionarMesmoTipoNoViewport,
} from './hudContextual'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export function run(): void {
  // 1) Mapa livre: nunca exibe comandos de tropa ou construcao
  const livre = derivarContextoHud({
    qtdTropasSelecionadas: 0,
    heroiEscolhido: false,
    heroiAtivoClasse: 'ataque',
    obraPainelTipo: null,
    modoConstruirAberto: false,
  })
  assert(livre.contexto === 'mapa_livre', 'hud: sem selecao -> mapa_livre')
  assert(
    !livre.mostrarOrdensCombate && !livre.mostrarPosturas && !livre.mostrarConstrucao && !livre.mostrarProducaoQuartel,
    'hud: mapa_livre proibe ataque/postura/construcao/tropa',
  )

  // 2) Herói Construtor -> mostra construcao e acoes de construtor, proibe ataque/posturas
  const constr = derivarContextoHud({
    qtdTropasSelecionadas: 0,
    heroiEscolhido: true,
    heroiAtivoClasse: 'construtor',
    obraPainelTipo: null,
    modoConstruirAberto: false,
  })
  assert(constr.contexto === 'heroi_construtor', 'hud: construtor selecionado')
  assert(constr.mostrarConstrucao && constr.mostrarAcoesConstrutor, 'hud: construtor exibe obras e acoes de construtor')
  assert(!constr.mostrarOrdensCombate && !constr.mostrarPosturas, 'hud: construtor nao mistura combate de campo')

  // 3) Tropas ou Herói de combate -> ordens + posturas, proibe construir predios
  const tropas = derivarContextoHud({
    qtdTropasSelecionadas: 3,
    heroiEscolhido: false,
    heroiAtivoClasse: 'ataque',
    obraPainelTipo: null,
    modoConstruirAberto: false,
  })
  assert(tropas.contexto === 'tropas', 'hud: 3 tropas -> tropas')
  assert(tropas.mostrarOrdensCombate && tropas.mostrarPosturas && !tropas.mostrarConstrucao, 'hud: tropas sem construcao')

  const combate = derivarContextoHud({
    qtdTropasSelecionadas: 0,
    heroiEscolhido: true,
    heroiAtivoClasse: 'tanque',
    obraPainelTipo: null,
    modoConstruirAberto: false,
  })
  assert(combate.contexto === 'heroi_combate' && combate.mostrarOrdensCombate && !combate.mostrarConstrucao, 'hud: heroi tanque -> combate')

  // 4) Quartel / Núcleo
  const q = derivarContextoHud({
    qtdTropasSelecionadas: 0,
    heroiEscolhido: false,
    obraPainelTipo: 'quartel',
    modoConstruirAberto: false,
  })
  assert(q.contexto === 'quartel' && q.mostrarProducaoQuartel && !q.mostrarOrdensCombate, 'hud: quartel')

  const n = derivarContextoHud({
    qtdTropasSelecionadas: 0,
    heroiEscolhido: false,
    obraPainelTipo: 'nucleo',
    modoConstruirAberto: false,
  })
  assert(n.contexto === 'nucleo' && n.mostrarProducaoNucleo && !n.mostrarProducaoQuartel, 'hud: nucleo')

  // 5) Selecao do mesmo tipo no viewport (duplo clique LMB)
  const unidades = [
    { id: 1, lado: 'aliado' as const, hp: 10, x: 0, z: 0, tipoTropa: 'arqueiro' as const },
    { id: 2, lado: 'aliado' as const, hp: 10, x: 5, z: 0, tipoTropa: 'arqueiro' as const },
    { id: 3, lado: 'aliado' as const, hp: 10, x: 40, z: 40, tipoTropa: 'arqueiro' as const },
    { id: 4, lado: 'aliado' as const, hp: 10, x: 2, z: 2, tipoTropa: 'soldado' as const },
    { id: 5, lado: 'inimigo' as const, hp: 10, x: 1, z: 1, tipoTropa: 'arqueiro' as const },
  ]
  const sel = selecionarMesmoTipoNoViewport(unidades, 1, (x, z) =>
    x > 20 || z > 20 ? { x: 1.5, y: 1.5, z: 0.5 } : { x: 0.2, y: -0.1, z: 0.5 },
  )
  assert(sel.length === 2 && sel.includes(1) && sel.includes(2) && !sel.includes(3) && !sel.includes(4) && !sel.includes(5), 'viewport: selecionou apenas arqueiros aliados dentro do frustum')

  // 6) Grupos de controle Ctrl+1..9
  const g1 = salvarGrupoControle({}, 1, [1, 2, 3])
  assert(g1[1]?.length === 3, 'grupos: salva slot 1')
  const rec = recuperarGrupoControle(g1, 1, new Set([1, 3]))
  assert(rec.length === 2 && rec[0] === 1 && rec[1] === 3, 'grupos: filtra mortos ao recuperar')
  assert(recuperarGrupoControle(g1, 9, new Set([1, 3])).length === 0, 'grupos: slot vazio')
}
