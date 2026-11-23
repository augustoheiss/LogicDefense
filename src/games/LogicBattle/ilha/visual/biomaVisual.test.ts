import { BiomaId, gerarPaisagemBioma } from '../biomaRecursos'
import { BIOMA_VISUAL_CATALOG, nomeDoBioma } from './biomaVisualCatalog'
import { gerarPropsDecorativos } from './propsDecorativos'
import {
  aplicarContextLost,
  criarEstadoQualidade,
  definirPresetQualidade,
  passoAutoQualidade,
  SPEC_QUALIDADE,
} from './qualidadeGrafica'
import { BiomeGpuAssetPool, type RecursoDescartavel } from './recursoGpuPool'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

interface FakeGpuAsset extends RecursoDescartavel {
  readonly id: string
  disposed: boolean
}

export async function run(): Promise<void> {
  // 1. Catálogo cobre todos os 6 biomas sem campos vazios
  const biomas: BiomaId[] = ['clareira', 'bosque', 'serra_ouro', 'ribeira', 'tundra_cristal', 'basalto_brasa']
  for (const b of biomas) {
    const res = BIOMA_VISUAL_CATALOG[b]
    assert(res && res.id === b && nomeDoBioma(b).length > 3, `catálogo completo para ${b}`)
  }

  // 2. FSM de qualidade gráfica (Auto downgrade/upgrade + contextLost)
  let q = criarEstadoQualidade('auto')
  assert(q.efetiva === 'bonito', 'auto inicia em bonito')
  for (let i = 0; i < 4; i += 1) q = passoAutoQualidade(q, 38, 1.0)
  assert(q.efetiva === 'leve', 'auto faz downgrade bonito -> leve após 3s > 33ms')
  for (let i = 0; i < 11; i += 1) q = passoAutoQualidade(q, 14, 1.0)
  assert(q.efetiva === 'bonito', 'auto recupera para bonito após 10s < 17ms')
  q = definirPresetQualidade(q, 'ultra')
  assert(q.efetiva === 'ultra', 'preset ultra selecionável')
  q = aplicarContextLost(q)
  assert(q.efetiva === 'leve' && q.contextLost, 'webglcontextlost força preset leve')
  q = definirPresetQualidade(q, 'ultra')
  assert(q.efetiva === 'leve', 'após contextLost mantém proteção em leve')

  // 3. Props decorativos são determinísticos e nunca invadem a estrada central de (0,0)
  const paisagem00 = gerarPaisagemBioma(0, 0)
  const propsA = gerarPropsDecorativos(0, 0, paisagem00.bioma, paisagem00.lagoas, paisagem00.recursos, SPEC_QUALIDADE.bonito)
  const propsB = gerarPropsDecorativos(0, 0, paisagem00.bioma, paisagem00.lagoas, paisagem00.recursos, SPEC_QUALIDADE.bonito)
  assert(propsA.gramas.length > 200 && JSON.stringify(propsA) === JSON.stringify(propsB), 'props decorativos são determinísticos')
  const invadiuEstrada = propsA.gramas.some((g) => Math.abs(g.x) < 4.9 && g.z > -6.4 && g.z < 44.4)
  assert(!invadiuEstrada, 'grama decorativa respeita corredor da estrada central')

  // 4. Pool LRU de GPU com capacidade 2 e descarte determinístico (.dispose())
  const criados: FakeGpuAsset[] = []
  const pool = new BiomeGpuAssetPool<FakeGpuAsset>(2)
  const fabricar = (id: string): FakeGpuAsset => {
    const asset: FakeGpuAsset = {
      id,
      disposed: false,
      dispose() {
        this.disposed = true
      },
    }
    criados.push(asset)
    return asset
  }

  for (let ciclo = 0; ciclo < 5; ciclo += 1) {
    for (const b of ['clareira', 'bosque', 'serra_ouro', 'ribeira'] as const) {
      pool.obterOuCriar(`${b}:512`, () => fabricar(`${b}-${ciclo}`))
    }
  }
  const stats = pool.estatisticas()
  assert(stats.ativos === 2, `pool LRU mantém no máximo 2 ativos (veio ${stats.ativos})`)
  assert(stats.descartados === stats.evictados, 'toda evicção chama dispose exatamente 1 vez')
  assert(criados.filter((c) => !c.disposed).length === 2, 'exatamente 2 assets vivos após 20 trocas de bioma')

  // 5. Cancelamento de corrida assíncrona descarta resultado obsoleto imediatamente
  let resolverA!: (v: FakeGpuAsset) => void
  const pA = pool.adquirirAsync('tundra:1024', () => new Promise<FakeGpuAsset>((r) => { resolverA = r }))
  const pB = pool.adquirirAsync('basalto:1024', async () => fabricar('basalto-novo'))
  const resB = await pB
  const obsoleto = fabricar('tundra-lento')
  resolverA(obsoleto)
  const resA = await pA
  assert(resB !== null && resA === null && obsoleto.disposed, 'requisição superada é descartada com dispose() sem vazar')

  pool.descartarTudo()
  assert(criados.every((c) => c.disposed), 'descartarTudo libera 100% dos recursos restantes')
}
