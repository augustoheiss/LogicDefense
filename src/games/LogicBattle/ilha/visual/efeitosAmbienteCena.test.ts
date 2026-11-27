function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

function soCodigo(texto: string): string {
  return texto
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n')
}

export function run(
  politicas?: string,
  cenaBioma?: string,
  nuvens?: string,
  particulas?: string,
  passaros?: string,
  tochas?: string,
  propsBioma?: string,
  efeitosJogo?: string,
): void {
  if (politicas !== undefined) {
    const p = soCodigo(politicas)
    assert(
      /\befeitos:\s*\{\s*ativo:\s*true as boolean,/.test(p) && /\brespostas:\s*true as boolean,/.test(p),
      'PARTIDA.efeitos.ativo e PARTIDA.efeitos.respostas ligados após aprovação do usuário em 27/11/2026',
    )
    assert((p.match(/\befeitos:\s*\{/g) ?? []).length === 1, 'PARTIDA.efeitos declarado exatamente uma vez')
  }

  if (cenaBioma !== undefined) {
    const c = soCodigo(cenaBioma)
    assert(/configEfeitosAmbiente\(/.test(c), 'CenaBiomaVisual consulta configEfeitosAmbiente')
    assert(/prefers-reduced-motion: reduce/.test(c), 'CenaBiomaVisual observa prefers-reduced-motion')
    assert(
      /\{efeitosConfig\.nuvens && \(\s*<NuvensBioma/.test(c) &&
        /\{efeitosConfig\.maxParticulas > 0 && \(\s*<ParticulasBioma/.test(c) &&
        /\{efeitosConfig\.maxPassaros > 0 && \(\s*<PassarosBioma/.test(c) &&
        /\{efeitosConfig\.tochasObras && \(\s*<TochasEFumacaObras/.test(c) &&
        /\{efeitosConfig\.respostas && \(\s*<EfeitosDeJogo/.test(c),
      'Todos os componentes F4 e F5 só montam atrás das guardas de efeitosConfig',
    )
    assert(/ventoAtivo=\{efeitosConfig\.ventoArvores\}/.test(c), 'PropsBiomaInstanced recebe ventoAtivo={efeitosConfig.ventoArvores}')
  }

  if (nuvens !== undefined) {
    const n = soCodigo(nuvens)
    assert(/geometria\.dispose\(\)/.test(n) && /material\.dispose\(\)/.test(n), 'NuvensBioma descarta geometria e material')
    assert(/raycast=\{semRaycast\}/.test(n), 'NuvensBioma não intercepta cliques')
  }

  if (particulas !== undefined) {
    const pt = soCodigo(particulas)
    assert(/geometria\.dispose\(\)/.test(pt) && /material\.dispose\(\)/.test(pt), 'ParticulasBioma descarta geometria e material')
    assert(
      /const vazio = material\.uniforms\.uMapa\.value as DataTexture/.test(pt) &&
        /vazio\.dispose\(\)/.test(pt) &&
        !/material\.uniforms\.uMapa\.value\.dispose\(\)/.test(pt),
      'ParticulasBioma captura vazio antes do useFrame e não descarta uMapa compartilhado da NevoaPintada',
    )
    assert(/corDaNevoa/.test(pt), 'ParticulasBioma aplica névoa de guerra para não brilhar em área preta')
  }

  if (passaros !== undefined) {
    const ps = soCodigo(passaros)
    assert(/geometria\.dispose\(\)/.test(ps) && /material\.dispose\(\)/.test(ps), 'PassarosBioma descarta geometria e material')
    assert(/raycast=\{semRaycast\}/.test(ps), 'PassarosBioma não intercepta cliques')
  }

  if (tochas !== undefined) {
    const t = soCodigo(tochas)
    assert(
      /chamaGeo\.dispose\(\)/.test(t) &&
        /fumacaGeo\.dispose\(\)/.test(t) &&
        /chamaMat\.dispose\(\)/.test(t) &&
        /fumacaMat\.dispose\(\)/.test(t),
      'TochasEFumacaObras descarta todas as geometrias e materiais',
    )
    assert(/paisagemNaturalVisivel/.test(t), 'TochasEFumacaObras oculta chamas em território nunca visto')
  }

  if (efeitosJogo !== undefined) {
    const ej = soCodigo(efeitosJogo)
    assert(
      /const vazio = corrupcaoMat\.uniforms\.uMapa\.value as DataTexture/.test(ej) &&
        /vazio\.dispose\(\)/.test(ej) &&
        !/corrupcaoMat\.uniforms\.uMapa\.value\.dispose\(\)/.test(ej),
      'EfeitosDeJogo captura vazio antes do useFrame e não descarta uMapa compartilhado da NevoaPintada',
    )
    assert(/corDaNevoa/.test(ej), 'EfeitosDeJogo aplica névoa de guerra na corrupção da base inimiga')
  }

  if (propsBioma !== undefined) {
    const pb = soCodigo(propsBioma)
    assert(/ventoAtivo = false/.test(pb), 'PropsBiomaInstanced mantém ventoAtivo = false como padrão (I1)')
    assert(/injetarVentoNaCopa/.test(pb) && /injetarGramaInterativa/.test(pb), 'PropsBiomaInstanced aplica os injetores de F4')
  }
}
