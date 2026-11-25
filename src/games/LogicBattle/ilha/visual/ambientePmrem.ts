import {
  BackSide,
  Color,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  Vector3,
  type Texture,
  type WebGLRenderer,
} from 'three'
import type { BiomaId } from '../biomaRecursos'
import { ambienteDoBioma, direcaoDoSol } from './ceuEIbl'
import type { RecursoDescartavel } from './recursoGpuPool'

/**
 * O AMBIENTE (IBL) de um bioma na GPU (24/11/2026, F1 Task 8b): a luz que vem do CÉU e do CHÃO ao redor, refletida pelos materiais. O jogo não tinha `scene.environment`: o ouro, a água, a pedra
 * úmida e as obras metálicas (60 materiais PBR, metal até 0,78, rugosidade até 0,22) refletiam o NADA, e a iluminação indireta ficava chapada.
 *
 * COMO: uma cena mínima com o céu do bioma (o mesmo gradiente e o mesmo disco do sol do shader da atmosfera, nas cores do catálogo), um chão da cor do solo e o `PMREMGenerator.fromScene`, que a
 * converte no formato que o three usa para reflexo (um cubo com mips pré-borrados por rugosidade). NÃO é o `Sky` Preetham do three: aquilo é uma atmosfera terrestre azul, e a tundra roxa e o
 * basalto em brasa perderiam a identidade que o catálogo deu a cada bioma. O ouro reflete o céu DESTE bioma.
 *
 * O QUE PODE DAR ERRADO é a GPU, não a lógica: o gerador cria alvos de render e materiais. Por isso (1) o resultado é um `RecursoDescartavel` para viver no `BiomeGpuAssetPool` (capacidade 2,
 * `dispose()` ao ser expulso: trocar de bioma não vaza memória); (2) a geração é protegida por `try/catch` no chamador (a falha devolve `null` e o jogo segue sem ambiente: nunca tela preta);
 * (3) o gerador interno é liberado a cada geração (`PMREMGenerator` é estático e barato de recriar, e guardá-lo seguraria memória parada).
 */

/** Lado do cubo do ambiente. 128 basta para reflexo DIFUSO (o jogo não tem espelho): 256 custaria 4× a memória sem ganho visível em material rugoso. */
export const LADO_DO_CUBO_DO_AMBIENTE = 128

export interface AmbienteGpu extends RecursoDescartavel {
  /** A textura PMREM para `scene.environment`. */
  readonly textura: Texture
  readonly intensidade: number
}

/** O mesmo gradiente do céu da atmosfera, mais o disco do sol: o ambiente reflete o que o jogador vê no céu. Sem `cameraPosition`: a cena do ambiente é centrada na origem. */
function materialDoCeuDoAmbiente(topo: string, horizonte: string, corSol: string, solDir: Vector3): ShaderMaterial {
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    uniforms: {
      uTopo: { value: new Color(topo) },
      uHorizonte: { value: new Color(horizonte) },
      uSolCor: { value: new Color(corSol) },
      uSolDir: { value: solDir },
    },
    vertexShader: `
      varying vec3 vDir;
      void main() {
        vDir = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform vec3 uTopo;
      uniform vec3 uHorizonte;
      uniform vec3 uSolCor;
      uniform vec3 uSolDir;
      varying vec3 vDir;
      void main() {
        vec3 dir = normalize(vDir);
        float h = clamp(dir.y * 0.9 + 0.12, 0.0, 1.0);
        vec3 ceu = mix(uHorizonte, uTopo, pow(h, 0.72));
        float sol = max(dot(dir, uSolDir), 0.0);
        // o disco do sol do ambiente é mais largo e mais forte que o do céu visto: é a LUZ QUENTE que o ouro devolve
        ceu += uSolCor * pow(sol, 18.0) * 1.4;
        gl_FragColor = vec4(ceu, 1.0);
      }
    `,
  })
}

/**
 * Gera o ambiente do bioma. Pode LANÇAR (GPU sem suporte, memória): quem chama trata o erro e segue sem ambiente. Libera tudo o que é só do gerador; devolve só a textura, que o chamador guarda
 * no pool e descarta com `dispose()`.
 */
export function gerarAmbientePmrem(renderer: WebGLRenderer, bioma: BiomaId): AmbienteGpu {
  const dados = ambienteDoBioma(bioma)
  const d = direcaoDoSol(bioma, 0)
  const cena = new Scene()
  const ceuMaterial = materialDoCeuDoAmbiente(dados.topo, dados.horizonte, dados.corSol, new Vector3(d[0], d[1], d[2]))
  const ceuGeometria = new SphereGeometry(50, 24, 16)
  cena.add(new Mesh(ceuGeometria, ceuMaterial))
  // o chão visto de cima: metade de baixo do cubo. Uma esfera achatada na cor do solo, com o topo em y = -0,5 (o jogador está acima dele).
  const soloMaterial = new MeshBasicMaterial({ color: new Color(dados.solo) })
  const soloGeometria = new SphereGeometry(40, 24, 8, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)
  const solo = new Mesh(soloGeometria, soloMaterial)
  solo.position.y = -0.5
  cena.add(solo)

  const gerador = new PMREMGenerator(renderer)
  try {
    const alvo = gerador.fromScene(cena, 0, 0.1, 100, { size: LADO_DO_CUBO_DO_AMBIENTE })
    return {
      textura: alvo.texture,
      intensidade: dados.intensidade,
      dispose() {
        alvo.dispose()
      },
    }
  } finally {
    gerador.dispose()
    ceuGeometria.dispose()
    ceuMaterial.dispose()
    soloGeometria.dispose()
    soloMaterial.dispose()
  }
}
