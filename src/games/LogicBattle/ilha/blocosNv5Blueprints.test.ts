import { criarBlocosFortalezaNv5, indiceVoxelLocal, VOXEL_NV5 } from './biomaRecursos'
import { criarBlocosObraNv5, meiaLarguraNv5 } from './blocosNv5Blueprints'
import type { PecaId } from './partidaPolicies'
import { bateBlocoNv5, ObraVertical } from './verticalidadeVoxel'

function assert(cond: boolean, msg: string): asserts cond {
  if (!cond) throw new Error(`blocosNv5Blueprints: ${msg}`)
}

export function run(): void {
  const todosTipos: readonly PecaId[] = ['nucleo', 'torre', 'portao', 'quartel', 'britador', 'serraria', 'mina']
  assert(Math.abs(meiaLarguraNv5() - (VOXEL_NV5.nx * VOXEL_NV5.passo) / 2) < 1e-9, 'meiaLarguraNv5 deriva de VOXEL_NV5')

  // Núcleo preserva 100% compatibilidade com criarBlocosFortalezaNv5 legado
  const legado = criarBlocosFortalezaNv5()
  const nucleo = criarBlocosObraNv5('nucleo')
  assert(legado.length === nucleo.length, 'tamanho igual ao legado')
  for (let i = 0; i < legado.length; i += 1) {
    assert(legado[i] === nucleo[i], `núcleo difere do legado no índice ${i}`)
  }

  // Todos os 7 tipos produzem blueprints distintos entre si (nenhum par idêntico)
  const assinaturas = new Map<string, PecaId>()
  for (const tipo of todosTipos) {
    const bp = criarBlocosObraNv5(tipo)
    assert(bp.length === VOXEL_NV5.nx * VOXEL_NV5.ny * VOXEL_NV5.nz, `${tipo}: comprimento 7x5x7`)
    const solidos = bp.reduce((acc, v) => acc + (v > 0 ? 1 : 0), 0)
    assert(solidos >= 40 && solidos < 200, `${tipo}: estrutura oca com sólidos razoáveis (${solidos})`)
    const sig = Array.from(bp).join('')
    assert(!assinaturas.has(sig), `${tipo} duplica blueprint de ${assinaturas.get(sig)}`)
    assinaturas.set(sig, tipo)
  }

  // Invariante crítico do Portão Nv5: corredor central (bx=2..4, bz=0..6, by=0..2) 100% transitável
  const portaoBp = criarBlocosObraNv5('portao')
  for (let bz = 0; bz < VOXEL_NV5.nz; bz += 1) {
    for (let bx = 2; bx <= 4; bx += 1) {
      for (let by = 0; by <= 2; by += 1) {
        assert(
          portaoBp[indiceVoxelLocal(bx, by, bz)] === 0,
          `portao Nv5 deve manter corredor livre em (${bx},${by},${bz})`,
        )
      }
    }
  }
  const portaoObra: ObraVertical = {
    id: 70,
    lado: 'nosso',
    tipo: 'portao',
    x: 0,
    z: 20,
    nivel: 5,
    hp: 150,
    blocosNv5: portaoBp,
  }
  assert(!bateBlocoNv5(0, 0, 20, portaoObra), 'herói atravessa centro do Portão Nv5 sem colidir')
  assert(!bateBlocoNv5(0, 0, 18, portaoObra), 'entrada norte do Portão Nv5 é aberta')
  assert(!bateBlocoNv5(0, 0, 22, portaoObra), 'saída sul do Portão Nv5 é aberta')

  // Invariante crítico da Torre Nv5: porta sul aberta, centro caminhável e topo alcançável
  const torreObra: ObraVertical = {
    id: 71,
    lado: 'nosso',
    tipo: 'torre',
    x: 12,
    z: 12,
    nivel: 5,
    hp: 150,
    blocosNv5: criarBlocosObraNv5('torre'),
  }
  assert(!bateBlocoNv5(12, 0, 12, torreObra), 'interior da Torre Nv5 é caminhável')
  assert(
    torreObra.blocosNv5![indiceVoxelLocal(3, 0, 5)] === 0 &&
      torreObra.blocosNv5![indiceVoxelLocal(3, 1, 5)] === 0,
    'Torre Nv5 tem porta sul aberta para o herói entrar',
  )
}
