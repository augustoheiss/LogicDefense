import type { BiomaId } from '../biomaRecursos'
import { GLSL_NUVENS_FBM, perfilNuvensBioma } from './nuvensFbm'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

const BIOMAS: readonly BiomaId[] = ['clareira', 'bosque', 'serra_ouro', 'ribeira', 'tundra_cristal', 'basalto_brasa']

export async function run(): Promise<void> {
  for (const bioma of BIOMAS) {
    const p = perfilNuvensBioma(bioma)
    assert(p.corNuvem.startsWith('#') && p.corBordaSol.startsWith('#'), `cores válidas de nuvem em ${bioma}`)
    assert(p.cobertura >= 0.35 && p.cobertura <= 0.68, `cobertura controlada em ${bioma}`)
    assert(p.opacidade > 0 && p.opacidade <= 0.6, `opacidade sutil em ${bioma}`)
    assert(p.velocidade > 0, `velocidade positiva de deriva em ${bioma}`)
  }

  assert(/uniform float uTempo;/.test(GLSL_NUVENS_FBM.fragmento), 'fragmento declara uTempo')
  assert(/uniform vec3 uSolDir;/.test(GLSL_NUVENS_FBM.fragmento), 'fragmento declara uSolDir para iluminar bordas voltadas ao sol')
  assert(/smoothstep\(/.test(GLSL_NUVENS_FBM.fragmento) && /fbm/.test(GLSL_NUVENS_FBM.fragmento), 'fragmento usa FBM e fade suave')
  assert(/vDistCentro/.test(GLSL_NUVENS_FBM.vertice) && /vDistCentro/.test(GLSL_NUVENS_FBM.fragmento), 'fade radial evita bordas quadradas do plano')
}
