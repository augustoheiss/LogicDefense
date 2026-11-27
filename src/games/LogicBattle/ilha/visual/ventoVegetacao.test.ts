import { ShaderLib } from 'three'
import { injetarGramaInterativa, injetarVentoNaCopa, MARCA_GRAMA_VIVA, MARCA_VENTO_COPA } from './ventoVegetacao'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export async function run(): Promise<void> {
  // 1. Injeção nas copas contra ShaderLib.standard real do three@0.184.0
  const baseStdVert = ShaderLib.standard.vertexShader
  const copa1 = injetarVentoNaCopa(baseStdVert)
  assert(copa1.includes(MARCA_VENTO_COPA), 'injetarVentoNaCopa insere marca de idempotência')
  assert(copa1.includes('uniform float uTempoVento;') && copa1.includes('uniform float uVentoAtivo;'), 'uniforms declarados na copa')
  assert(copa1.includes('instanceMatrix'), 'vento na copa usa posição da instância')

  // Idempotente
  const copa2 = injetarVentoNaCopa(copa1)
  assert(copa2 === copa1, 'injetarVentoNaCopa é idempotente')

  // Falha ruidosa se âncora sumir
  let lancouCopa = false
  try {
    injetarVentoNaCopa('void main() {}')
  } catch {
    lancouCopa = true
  }
  assert(lancouCopa, 'injetarVentoNaCopa lança erro se #include <begin_vertex> faltar')

  // 2. Injeção na grama contra ShaderLib.lambert real do three@0.184.0
  const baseLamVert = ShaderLib.lambert.vertexShader
  const grama1 = injetarGramaInterativa(baseLamVert)
  assert(grama1.includes(MARCA_GRAMA_VIVA), 'injetarGramaInterativa insere marca de idempotência')
  assert(grama1.includes('uniform vec3 uHeroPos;') && grama1.includes('uniform float uVentoAtivo;'), 'uniforms uHeroPos e uVentoAtivo declarados')
  assert(grama1.includes('1.25'), 'amassamento radial de 1,25 m ao redor do herói')

  const grama2 = injetarGramaInterativa(grama1)
  assert(grama2 === grama1, 'injetarGramaInterativa é idempotente')

  let lancouGrama = false
  try {
    injetarGramaInterativa('void main() {}')
  } catch {
    lancouGrama = true
  }
  assert(lancouGrama, 'injetarGramaInterativa lança erro se #include <begin_vertex> faltar')
}
