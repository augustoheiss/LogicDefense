/**
 * Injeção de vento nas copas das árvores e interação do herói na grama (F4, 27/11/2026).
 * Funções puras sobre GLSL (sem `three`), idempotentes por marca própria e com erro
 * explícito se `#include <begin_vertex>` faltar.
 */

export const MARCA_VENTO_COPA = '// vento-copa-f4'
export const MARCA_GRAMA_VIVA = '// grama-viva-f4'
const ANCORA_VERTICE = '#include <begin_vertex>'

export function injetarVentoNaCopa(vertice: string): string {
  if (vertice.includes(MARCA_VENTO_COPA)) return vertice
  if (!vertice.includes(ANCORA_VERTICE)) {
    throw new Error(`Shader de vértice da copa sem ${ANCORA_VERTICE}; o three mudou?`)
  }
  const injecao = `${ANCORA_VERTICE}
${MARCA_VENTO_COPA}
{
  vec3 cSeed = vec3(0.0);
  #ifdef USE_INSTANCING
    cSeed = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  #endif
  float pesoCopa = clamp((position.y + 1.0) * 0.5, 0.0, 1.0);
  float brisa = sin(uTempoVento * 1.45 + cSeed.x * 0.27 + cSeed.z * 0.31) * 0.08 * pesoCopa * uVentoAtivo;
  transformed.x += brisa;
  transformed.z += brisa * 0.5;
}`

  return `${MARCA_VENTO_COPA}\nuniform float uTempoVento;\nuniform float uVentoAtivo;\n${vertice.replace(ANCORA_VERTICE, injecao)}`
}

export function injetarGramaInterativa(vertice: string): string {
  if (vertice.includes(MARCA_GRAMA_VIVA)) return vertice
  if (!vertice.includes(ANCORA_VERTICE)) {
    throw new Error(`Shader de vértice da grama sem ${ANCORA_VERTICE}; o three mudou?`)
  }
  const injecao = `${ANCORA_VERTICE}
${MARCA_GRAMA_VIVA}
{
  float topoF4 = clamp(position.y / 0.34, 0.0, 1.0);
  vec3 seedF4 = vec3(0.0);
  #ifdef USE_INSTANCING
    seedF4 = vec3(instanceMatrix[3][0], instanceMatrix[3][1], instanceMatrix[3][2]);
  #endif
  float brisaF4 = sin(uTempoVento * 2.3 + seedF4.x * 0.45 + seedF4.z * 0.35) * 0.09 * topoF4 * topoF4 * uVentoAtivo;
  transformed.x += brisaF4;
  transformed.z += brisaF4 * 0.55;
  vec2 deltaHeroi = seedF4.xz - uHeroPos.xz;
  float distHeroi = length(deltaHeroi);
  float amassa = (1.0 - smoothstep(0.15, 1.25, distHeroi)) * step(0.001, distHeroi);
  vec2 dirAmassa = deltaHeroi / max(distHeroi, 0.001);
  transformed.xz += dirAmassa * amassa * 0.24 * topoF4;
  transformed.y *= 1.0 - amassa * 0.48 * topoF4;
}`

  return `${MARCA_GRAMA_VIVA}\nuniform float uTempoVento;\nuniform float uVentoAtivo;\nuniform vec3 uHeroPos;\n${vertice.replace(ANCORA_VERTICE, injecao)}`
}
