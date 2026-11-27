function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

function soCodigo(texto: string): string {
  return texto
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n')
}

/**
 * CONTRATO DE TEXTO da fita d'água do rio (F2, Task 4, 26/11/2026). O componente vive no React e o runner roda no Node, sem GPU: o que o Node pode travar é a FORMA, e cada linha abaixo é uma ligação cuja ausência é um
 * defeito CONHECIDO (a auditoria externa achou três, conferidos no código antes de editar o plano):
 *  - a névoa de guerra: com o relevo ligado a névoa mora no shader do chão e o plano da `NevoaPintada` faz `discard` dentro do quadrado, então uma fita desenhada por ordem (`renderOrder` alto) brilharia INTEIRA sobre a
 *    área preta. A fita aplica a névoa no PRÓPRIO fragmento (`corDaNevoa`) e a água SOME onde ela cobre (`ALFA_DA_AGUA * (1 - smoothstep(0.5, 0.9, nevoa.a))`); o `discard` de `nevoa.a >= 0.999` do plano era código
 *    MORTO (`uOpNunca` vale 0,94: a opacidade máxima que `corDaNevoa` devolve);
 *  - o `waterShader` das lagoas é RADIAL (`r = length(p)`): numa fita `vUv.y` varia ao longo do rio e `r` estoura até no centro (espuma no meio). A fita usa a margem `abs(vUv.x * 2.0 - 1.0)`;
 *  - a altura: o `<mesh>` fica em `Y_SOLO_VISUAL` (−0,45), como o terreno, e a geometria guarda o nível NA ESCALA DO CAMPO: somar `Y_AGUA_VISUAL` (−0,375) subiria a água 7,5 cm acima da valeta escavada.
 */
export function contratoDaFitaDoRio(fita: string, agua: string): void {
  const codigo = soCodigo(fita)
  const aguaCodigo = soCodigo(agua)

  // o componente e o material PRÓPRIO
  assert(/export const FitaDoRio: React\.FC<FitaDoRioProps>/.test(codigo), 'o componente `FitaDoRio` é exportado com o tipo das suas props')
  assert(/export function criarMaterialDoRio\(/.test(codigo), 'o material vem de `criarMaterialDoRio` (testável sem o React)')
  assert(/new ShaderMaterial\(/.test(codigo), 'o material é um `ShaderMaterial` PRÓPRIO da fita')
  assert(!/waterShader/.test(codigo), 'a fita NÃO reutiliza o `waterShader` das lagoas (ele é radial e não lê a névoa)')
  assert(/export const GLSL_DO_RIO/.test(codigo), 'o GLSL do rio é exportado (`GLSL_DO_RIO`): o teste o lê')

  // a NÉVOA no fragmento
  assert(/DECLARACOES_DA_NEVOA/.test(codigo) && /from '\.\/glslDaNevoa'/.test(codigo), 'o fragmento inclui as declarações da névoa (`DECLARACOES_DA_NEVOA` de `./glslDaNevoa`)')
  // a INTERPOLAÇÃO dentro do GLSL (não só o import): sem `${DECLARACOES_DA_NEVOA}` o fragmento chama `corDaNevoa` sem a ter declarado e o shader NÃO COMPILA (o mutante «sem as declarações» sobrevivia: o import continuava lá)
  assert(/fragmento: \/\* glsl \*\/ `\s*\$\{DECLARACOES_DA_NEVOA\}/.test(codigo), 'o fragmento COMEÇA com `${DECLARACOES_DA_NEVOA}` interpolada: sem ela `corDaNevoa` não existe e o shader não compila')
  // a opacidade da água: o MESMO 0,78 do `waterShader` das lagoas (o alfa 1,0 deixaria a água opaca), e a ordem de desenho NÃO depende de teste de profundidade desligado (`depthTest: false` a desenharia por cima do herói)
  assert(/export const ALFA_DA_AGUA = 0\.78\b/.test(codigo), 'a opacidade da água é 0,78 (a mesma do `waterShader` das lagoas)')
  assert(!/depthTest/.test(codigo), 'a fita NÃO desliga o teste de profundidade (`depthTest: false` a desenharia por cima do herói e das tropas)')
  assert(/corDaNevoa\(vUvNevoa\)/.test(codigo), 'o fragmento chama `corDaNevoa(vUvNevoa)`: a fita não brilha sobre a área inexplorada')
  assert(/vUvNevoa\s*=\s*vec2\(position\.x \/ 112\.0 \+ 0\.5, position\.z \/ 112\.0 \+ 0\.5\)/.test(codigo), 'a UV da névoa vem da POSIÇÃO LOCAL do vértice, como `nevoaNoTerreno.ts` (a do solo seria invertida)')
  assert(/ALFA_DA_AGUA\s*\*\s*\(1\.0 - smoothstep\(0\.5, 0\.9, nevoa\.a\)\)/.test(codigo), 'o alfa final é `ALFA_DA_AGUA * (1.0 - smoothstep(0.5, 0.9, nevoa.a))`: a água SOME onde a névoa cobre (o limiar de cima, 0,9, fica abaixo de `uOpNunca` = 0,94)')
  assert(!/discard/.test(codigo), 'o fragmento NÃO tem `discard` (o de `nevoa.a >= 0.999` era código MORTO: `uOpNunca` vale 0,94)')
  assert(!/0\.999/.test(codigo), 'e nenhum limiar 0,999 sobrou')
  assert(/mix\(cor, nevoa\.rgb, nevoa\.a\)/.test(codigo), 'a cor da água é misturada com a da névoa (`mix(cor, nevoa.rgb, nevoa.a)`), como o terreno')

  // as 6 uniforms da névoa vêm da MESMA ref que o terreno lê
  for (const nome of ['uMapa', 'uTempo', 'uCorNunca', 'uOpNunca', 'uCorJa', 'uOpJa']) assert(new RegExp(`'${nome}'`).test(codigo), `a fita copia a uniform da névoa \`${nome}\` (a MESMA do terreno)`)
  assert(/nevoaUniforms\?\.current/.test(codigo) && /useFrame\(/.test(codigo), 'a fita copia as uniforms da `nevoaUniforms` a cada quadro (`useFrame`), como o `TerrenoRelevoCena`')
  assert(/uOpNunca:\s*\{\s*value:\s*0\.94\s*\}/.test(codigo), 'o ESTADO SEGURO inicial é «tudo coberto» (`uOpNunca` = 0,94): por um quadro o erro é esconder demais, nunca revelar o que o jogador não viu')

  // a forma da água: a margem é a transversal, nunca radial
  assert(/abs\(vUv\.x \* 2\.0 - 1\.0\)/.test(codigo), 'a margem é `abs(vUv.x * 2.0 - 1.0)` (a coordenada TRANSVERSAL da fita)')
  assert(!/length\(/.test(codigo), 'o GLSL da fita NÃO usa `length(` (o `waterShader` radial: numa fita a espuma sairia no meio)')
  assert(/vUv\.y/.test(codigo) && /smoothstep\(0\.76, 0\.98/.test(codigo), 'a espuma é `smoothstep(0.76, 0.98, …)` na margem e as ondas andam em `vUv.y` (metros globais)')
  // O VISUAL (revisão independente, 26/11/2026, fotos 03/06/07). Três defeitos MEDIDOS, não opinião:
  // (1) «EFEITO BAMBU»: `ond = (sin(vUv.y * 1.7 …) + cos(vUv.y * 2.3 …)) / 2` é quase PERIÓDICO (a razão 2,3/1,7 ≈ 4/3 fecha o batimento em ~11 m): pico secundário da autocorrelação 0,96 a 11 m, contraste 0..1, e o REFLEXO
  // (`ond` > 0,78) acende em 15,6 % dos pontos, exatamente nas listras. Nas fotos o perfil ao longo do rio tem autocorrelação 0,65–0,67 e contraste 0,81–0,86. O ruído de valor 2D em METROS GLOBAIS (duas oitavas, escalas
  // 0,55 e 1,3) tem pico secundário 0,20 (a 61,8 m: um eco, não uma listra) e o reflexo acende em 2,1 %. `vUv.y` já é metro global (contínuo nas emendas); `vUv.x * LARGURA_DA_FITA` põe o ruído em metros também em x.
  // (2) BORDAS DURAS: o alfa não dependia da margem (0,78 até `margem` = 1,0): duas linhas retas de espuma, que no Leve evidenciam os dentes da malha de 4 m. O alfa ganha `1.0 - smoothstep(0.82, 1.0, margem)`: o GLSL
  // deixa `smoothstep(e0, e1, x)` com `e0 > e1` INDEFINIDO, então a forma é a bem definida (a revisão sugeriu `smoothstep(1.0, 0.82, margem)`, que funciona nos drivers de hoje mas não é garantida).
  // (3) A COR: o ciano do catálogo do bosque (`#2dd4bf`) é ~3× mais claro que a grama (luminância mediana 132 contra ~40). O catálogo é COMPARTILHADO com as lagoas de hoje (`AguaBiomaShader`): mexer nele muda o jogo
  // com a chave desligada (I1). O escurecimento fica SÓ na fita, num fator exportado (`ESCURECER_O_RIO`), proposta reversível: é decisão de ARTE do usuário e o valor vai para o LEDGER como proposta.
  assert(!/sin\(vUv\.y/.test(codigo) && !/cos\(vUv\.y/.test(codigo), 'as ondas NÃO são `sin`/`cos` em `vUv.y` (a soma é quase periódica a cada 11 m: o «efeito bambu», pico secundário 0,96)')
  assert(/ruido\(/.test(codigo.slice(codigo.indexOf('fragmento:'))), 'o fragmento usa o `ruido(` JÁ declarado em `DECLARACOES_DA_NEVOA` (nenhuma função de ruído duplicada)')
  assert(!/float ruido\(|float hash\(/.test(codigo), 'a fita NÃO redeclara `hash`/`ruido` (já vêm de `DECLARACOES_DA_NEVOA`: a segunda declaração não compilaria)')
  assert(/vUv\.y/.test(codigo) && /vUv\.x \* LARGURA_DA_FITA_M/.test(codigo), 'o ruído usa `vUv.y` (metros GLOBAIS: contínuo nas emendas) e `vUv.x * LARGURA_DA_FITA_M` (metros também em x: o ruído é isotrópico)')
  // AS DUAS OITAVAS acompanham o rio: cada `ruido(vec2(…))` leva `vUv.y` (metros GLOBAIS ao longo dele), e é isso que faz as ondas atravessarem a emenda entre quadrados sem quebrar a fase. Uma oitava só em x (o mutante O3)
  // deixa metade da onda PARADA em relação ao rio: o reflexo some (0,0 % dos pontos) e o contraste cai (0,81 → 0,67), embora a autocorrelação ao longo do rio fique BAIXA e engane um teste de periodicidade.
  const chamadasDoRuido = [...codigo.slice(codigo.indexOf('fragmento:')).matchAll(/float onda[12] = ruido\(([^;]*)\);/g)].map((m) => m[1])
  assert(chamadasDoRuido.length === 2, `há exatamente DUAS oitavas de ruído (\`onda1\` e \`onda2\`): vieram ${chamadasDoRuido.length}`)
  for (const [n, chamada] of chamadasDoRuido.entries()) assert(/vUv\.y/.test(chamada) && /xm/.test(chamada), `a oitava ${n + 1} do ruído usa \`vUv.y\` (metros globais ao longo do rio) E \`xm\` (metros transversais): ${chamada}`)
  assert(/const float LARGURA_DA_FITA_M = \$\{LARGURA_DA_FITA\.toFixed\(1\)\};/.test(codigo) && /import \{[^}]*\bLARGURA_DA_FITA\b[^}]*\} from '\.\.\/relevo\/geometriaDaAgua'/.test(codigo), 'a largura em metros vem de `LARGURA_DA_FITA` (de `geometriaDaAgua`), nunca digitada no GLSL')
  assert(/1\.0 - smoothstep\(0\.82, 1\.0, margem\)/.test(codigo), 'o alfa tem o fade da borda `1.0 - smoothstep(0.82, 1.0, margem)` (bem definido: `e0 < e1`)')
  assert(!/smoothstep\(1\.0, 0\.82/.test(codigo), 'e NÃO usa `smoothstep(1.0, 0.82, …)` (`e0 > e1` é indefinido no GLSL)')
  assert(/ALFA_DA_AGUA \* \(1\.0 - smoothstep\(0\.5, 0\.9, nevoa\.a\)\) \* \(1\.0 - smoothstep\(0\.82, 1\.0, margem\)\)/.test(codigo), 'o alfa FINAL multiplica a névoa e a borda: `ALFA_DA_AGUA * (1.0 - smoothstep(0.5, 0.9, nevoa.a)) * (1.0 - smoothstep(0.82, 1.0, margem))` (a água continua SUMINDO onde a névoa cobre)')
  assert(/export const ESCURECER_O_RIO = 0\.80/.test(codigo), 'o escurecimento é um fator EXPORTADO da fita (`ESCURECER_O_RIO`), proposta reversível: o catálogo de cores das lagoas NÃO é tocado')
  assert(/const float ESCURECER_O_RIO = \$\{ESCURECER_O_RIO\.toFixed\(2\)\};/.test(codigo) && /cor \*= ESCURECER_O_RIO/.test(codigo), 'o fator entra no GLSL (`cor *= ESCURECER_O_RIO`) ANTES da mistura com a névoa (a névoa escurece o resto: a água some igual)')
  assert(codigo.indexOf('cor *= ESCURECER_O_RIO') < codigo.indexOf('corDaNevoa(vUvNevoa)'), 'o escurecimento vem ANTES de `corDaNevoa`: a mistura com a névoa continua sendo a ÚLTIMA operação da cor (a água no «nunca visto» fica igual ao terreno)')
  assert(!/aguaCorRasa\s*[:=]|BIOMA_VISUAL_CATALOG\s*\[[^\]]*\]\s*=/.test(codigo), 'a fita só LÊ o catálogo de cores (nunca o escreve): as lagoas de hoje continuam com as cores de hoje (I1)')

  // a ordem de desenho: SEM `renderOrder` alto (a névoa é aplicada no fragmento, não por ordem)
  assert(!/renderOrder/.test(codigo), 'a fita NÃO usa `renderOrder` (a névoa é aplicada no fragmento: um `renderOrder` > 4 a faria brilhar sobre a área preta)')

  // a altura
  assert(/position=\{\[0, Y_SOLO_VISUAL, 0\]\}/.test(codigo) && /import \{[^}]*\bY_SOLO_VISUAL\b[^}]*\} from '\.\/suporteFundacao'/.test(codigo), 'o `<mesh>` fica em `Y_SOLO_VISUAL` (−0,45), exatamente como o terreno')
  assert(!/Y_AGUA_VISUAL/.test(codigo), 'a fita NÃO importa `Y_AGUA_VISUAL` (somá-lo subiria a água 7,5 cm acima da valeta que o gerador escavou)')

  // o material: transparente, sem escrever profundidade, sem raycast, e descartado
  assert(/transparent:\s*true/.test(codigo), 'o material é transparente')
  assert(/depthWrite:\s*false/.test(codigo), 'a água não escreve profundidade (não esconde o que está atrás)')
  assert(/raycast=\{semRaycast\}/.test(codigo) && /import \{ semRaycast \} from '\.\.\/raycastCena'/.test(codigo), 'a fita não recebe o clique (`raycast={semRaycast}`): o clique vai para o chão')
  assert(/geometria\.dispose\(\)/.test(codigo) && /material\.dispose\(\)/.test(codigo), 'a geometria e o material são DESCARTADOS no cleanup (o vazamento por quadrado seria a mesma forma do de ontem)')
  // O DESCARTE DA TEXTURA (revisão independente, 26/11/2026: BUG REAL de GPU). `uMapa` nasce como uma textura 1×1 PRÓPRIA da fita, mas o `useFrame` a TROCA, a cada quadro, pela textura VIVA da `NevoaPintada` (a mesma que o
  // `TerrenoRelevoCena` e a própria `NevoaPintada` leem). Descartar `material.uniforms.uMapa.value` no cleanup descarta, no unmount (o herói sai do quadrado do rio) ou na troca de bioma, o MAPA DE NÉVOA DO JOGO INTEIRO, e
  // a 1×1 original VAZA na GPU (ninguém mais a referencia). A forma certa é a do `TerrenoRelevoCena`: capturar o `vazio` no CORPO do efeito, antes do `return`, e descartar SÓ ele. O contrato anterior só exigia que
  // `material.dispose()` existisse, e os mutantes só removiam o descarte; nenhum descartava o objeto ERRADO.
  // O EXTRATOR: o efeito do MATERIAL é o `useEffect` cuja dependência é `[material]`. Uma regex preguiçosa que começa no PRIMEIRO `useEffect` do arquivo (o da geometria) englobava DOIS efeitos e as asserções passavam
  // (ou reprovavam) pelo motivo errado: por isso o corpo é buscado a partir do ÚLTIMO `useEffect(() => {` ANTES de `}, [material])`, sem nenhum `useEffect` no meio.
  const fimDoEfeito = codigo.indexOf('}, [material])')
  const inicioDoEfeito = fimDoEfeito < 0 ? -1 : codigo.lastIndexOf('useEffect(() => {', fimDoEfeito)
  const efeitoDoMaterial = inicioDoEfeito < 0 ? '' : codigo.slice(inicioDoEfeito + 'useEffect(() => {'.length, fimDoEfeito)
  assert(efeitoDoMaterial.length > 0, 'a fita tem um `useEffect(() => { … }, [material])` que descarta o material')
  assert(!/useEffect\(/.test(efeitoDoMaterial), 'o corpo extraído é UM efeito só (nenhum `useEffect(` dentro dele): o extrator não pode englobar o efeito da geometria')
  assert(/const vazio = material\.uniforms\.uMapa\.value as DataTexture\s*\n\s*return \(\) => \{/.test(efeitoDoMaterial), 'o efeito CAPTURA `const vazio = material.uniforms.uMapa.value as DataTexture` no CORPO, ANTES do `return () =>` (depois dele o `useFrame` já a trocou pela textura da névoa)')
  const cleanupDoMaterial = efeitoDoMaterial.slice(efeitoDoMaterial.indexOf('return () => {') + 'return () => {'.length)
  assert(/vazio\.dispose\(\)/.test(cleanupDoMaterial) && /material\.dispose\(\)/.test(cleanupDoMaterial), 'o cleanup descarta a textura CAPTURADA (`vazio.dispose()`) e o material (`material.dispose()`)')
  assert(!/uniforms\.uMapa/.test(cleanupDoMaterial), 'o cleanup NUNCA lê `uniforms.uMapa`: a essa altura ela é a textura da NÉVOA DE GUERRA do jogo (descartá-la apagaria o mapa de névoa do terreno e da `NevoaPintada`)')
  assert(!/geometria/.test(cleanupDoMaterial), 'o cleanup do material não toca na geometria (cada um tem o seu efeito, com a sua dependência)')
  assert((codigo.match(/\.uniforms\.uMapa\.value/g) ?? []).length === 1, '`material.uniforms.uMapa.value` é lido UMA vez só, para capturar o `vazio` (o `useFrame` escreve `uMapa` pelo laço `UNIFORMS_DA_NEVOA`, não por este nome)')
  assert(/useMemo\(/.test(codigo), 'a geometria e o material são criados em `useMemo` (estáveis entre renders)')
  assert(/geometriaDaFita\(rio, \{ i, j \}, PASSO_DA_FITA\)/.test(codigo) && /from '\.\.\/relevo\/geometriaDaAgua'/.test(codigo), 'a geometria vem de `geometriaDaFita(rio, { i, j }, PASSO_DA_FITA)` (as funções puras provadas)')

  // a animação: o Leve não anima (`spec.aguaAnimada`), como o `AguaBiomaShader`
  assert(/spec\.aguaAnimada/.test(codigo) && /uTempoDaAgua|uTime/.test(codigo), 'a água só anima com `spec.aguaAnimada` (o Leve não anima, como o `AguaBiomaShader`)')

  // a montagem em `AguaBiomaShader`: `rios` é OPCIONAL (sem ele o desenho é o de hoje: I1)
  assert(/readonly rios\?: readonly Rio\[\]/.test(aguaCodigo), '`AguaBiomaShader` recebe `rios` como prop OPCIONAL (sem ele o desenho é o de hoje: I1)')
  assert(/FitaDoRio/.test(aguaCodigo) && /rios\?\.map\(/.test(aguaCodigo), '`AguaBiomaShader` monta uma `FitaDoRio` por rio quando recebe `rios`')
  assert(/nevoaUniforms=\{nevoaUniforms\}/.test(aguaCodigo), '`AguaBiomaShader` passa a MESMA ref `nevoaUniforms` à fita (nenhuma cópia)')
  assert(/i=\{quadrado\.i\} j=\{quadrado\.j\}/.test(aguaCodigo), '`AguaBiomaShader` passa `i={quadrado.i} j={quadrado.j}` NESSA ordem (a fita é LOCAL ao quadrado: trocá-los a desenharia no quadrado errado)')
}

export function run(fita: string, agua: string): void {
  contratoDaFitaDoRio(fita, agua)
}
