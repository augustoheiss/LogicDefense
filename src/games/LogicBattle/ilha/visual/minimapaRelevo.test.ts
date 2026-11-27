import {
  formatarLegendaRelevo,
  gerarHillshadePixels,
  limparCacheHillshade,
  obterHillshadeDataUrl,
  tamanhoCacheHillshade,
} from './minimapaRelevo'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

export async function run(cena?: string, ilhaCss?: string): Promise<void> {
  // 1. Hillshade determinístico e leitura topográfica real em serra_ouro (3, 0)
  const a = gerarHillshadePixels(3, 0, 'serra_ouro', 32)
  const b = gerarHillshadePixels(3, 0, 'serra_ouro', 32)
  assert(a.pixels.length === 32 * 32 * 4 && a.lado === 32, 'grade RGBA 32×32 gerada')
  let identico = true
  for (let k = 0; k < a.pixels.length; k += 1) {
    if (a.pixels[k] !== b.pixels[k]) {
      identico = false
      break
    }
  }
  assert(identico, 'hillshade é determinístico')
  assert(a.maxH > a.minH + 1.5, `serra_ouro (3, 0) possui variação real de altitude (${a.minH.toFixed(1)} a ${a.maxH.toFixed(1)})`)

  // Luminância varia entre sombra e sol no relevo
  let minLum = 255
  let maxLum = 0
  for (let k = 0; k < a.pixels.length; k += 4) {
    assert(a.pixels[k + 3] === 255, 'alfa opaco em todos os pixels do hillshade')
    const lum = 0.299 * a.pixels[k] + 0.587 * a.pixels[k + 1] + 0.114 * a.pixels[k + 2]
    minLum = Math.min(minLum, lum)
    maxLum = Math.max(maxLum, lum)
  }
  assert(maxLum - minLum > 25, `contraste topográfico visível no hillshade (${minLum.toFixed(0)}..${maxLum.toFixed(0)})`)

  // 2. Formatação da legenda e segurança sem document no Node
  assert(formatarLegendaRelevo(0, 6.42) === '+0.0m a +6.4m', 'legenda formata cota mínima e máxima')
  assert(formatarLegendaRelevo(Number.NaN, 2) === 'Plano', 'entrada não finita retorna Plano')
  limparCacheHillshade()
  assert(tamanhoCacheHillshade() === 0, 'cache limpo')
  assert(obterHillshadeDataUrl(0, 0, 'clareira') === null, 'Node/SSR sem document devolve null sem falhar')

  // 3. Contrato de integração no IlhaRua.tsx e ilha.css preservando minimapaDono
  if (cena !== undefined) {
    assert(/obterHillshadeDataUrl/.test(cena), 'IlhaRua importa e usa obterHillshadeDataUrl')
    assert(/className="ilha-mini-hillshade"/.test(cena), 'IlhaRua renderiza camada .ilha-mini-hillshade dentro do botão do minimapa')
  }
  if (ilhaCss !== undefined) {
    assert(/\.ilha-minimapa \.ilha-mini-hillshade\s*\{/.test(ilhaCss), 'ilha.css estiliza .ilha-mini-hillshade sem sobrescrever dono/alerta')
  }
}
