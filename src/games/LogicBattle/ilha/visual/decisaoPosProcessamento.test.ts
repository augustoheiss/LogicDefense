import { NeutralToneMapping } from 'three'
import { SPEC_QUALIDADE } from './qualidadeGrafica'
import { anisotropiaEfetiva, configDoComposer, resolucaoDoBloom, TOM_DO_JOGO } from './decisaoPosProcessamento'

function assert(condicao: unknown, mensagem: string): asserts condicao {
  if (!condicao) throw new Error(mensagem)
}

/** O texto SEM as linhas de comentário: uma regex sobre o arquivo inteiro também casa o comentário que explica o assunto (foi o que deixou um teste vermelho no código REAL em 24/11, com o fog). */
function soCodigo(texto: string): string {
  return texto
    .split(/\r?\n/)
    .filter((linha) => !/^\s*(\/\/|\*|\/\*)/.test(linha))
    .join('\n')
}

/**
 * CONTRATO do TOM em `IlhaRua.tsx` (24/11/2026). O usuário escolheu o Neutral depois de ver as fotos dos três candidatos. O tom aparece em DOIS lugares da cena: no `gl` do Canvas (sem composer, é o
 * material de cada objeto que aplica o tom) e na prop `tom` do `<PosProcessamento/>` (com composer, só o `OutputPass` o aplica, uma vez, no fim). Se os dois divergirem, LIGAR o pós-processamento
 * muda as cores do jogo inteiro, sem aviso. Por isso os dois leem a MESMA constante (`TOM_DO_JOGO`) e nenhum outro tom fica fixo na cena. Lê o TEXTO da cena (o desenho vive no React; o runner roda no Node).
 */
export function contratoDoTom(cena: string): void {
  const codigo = soCodigo(cena)
  assert(/import \{[^}]*\bTOM_DO_JOGO\b[^}]*\} from '\.\/visual\/decisaoPosProcessamento'/.test(codigo), 'a cena importa TOM_DO_JOGO de ./visual/decisaoPosProcessamento')
  assert(/toneMapping: TOM_DO_JOGO,/.test(codigo), 'o Canvas usa o tom do jogo (`toneMapping: TOM_DO_JOGO`)')
  assert(/<PosProcessamento [^>]*\btom=\{TOM_DO_JOGO\}/.test(codigo), 'o <PosProcessamento/> usa o MESMO tom do Canvas (`tom={TOM_DO_JOGO}`): ligar o composer não pode mudar as cores')
  assert(!/ACESFilmicToneMapping|AgXToneMapping|NeutralToneMapping/.test(codigo), 'nenhum tom fixo sobrou na cena (um segundo valor divergiria do composer): só `TOM_DO_JOGO`')
  assert((codigo.match(/TOM_DO_JOGO/g) ?? []).length === 3, 'TOM_DO_JOGO aparece exatamente 3 vezes no código da cena: o import, o Canvas e o composer')
}

/**
 * A DECISÃO de quando o pós-processamento roda e com que parâmetros (24/11/2026), separada do desenho: é lógica PURA e roda no Node. O desenho (`PosProcessamento.tsx`) só obedece ao que daqui sai.
 * O modo de falha mais perigoso do pós-processamento é a TELA PRETA: um `useFrame` com prioridade positiva desliga o render automático do R3F para o Canvas inteiro, e se o composer falhar
 * (contexto perdido, qualidade Leve, chave desligada) sem devolver o controle, ninguém desenha nada. Por isso a regra «quando ligar» vive aqui, testada, e o componente a consulta a cada quadro.
 */
/**
 * CONTRATO das DUAS CHAVES do visual (24/11/2026): a decisão do usuário, escrita como teste para ninguém virar uma delas sem perceber (cada uma muda o jogo inteiro). A NÉVOA PINTADA está
 * LIGADA (ele a viu nas fotos e mandou seguir; as colunas de hoje continuam no código como janela de rollback). O PÓS-PROCESSAMENTO está DESLIGADO até a F4: hoje só o tom e o MSAA apareceriam
 * (o bloom é invisível porque nada passa de 1,15 de HDR) e ele custa +1,47 ms no Bonito. Quando a F4 trouxer as fontes de luz HDR, esta linha muda DE PROPÓSITO, junto com o ledger.
 */
export function contratoDasChaves(politicas: string): void {
  const codigo = soCodigo(politicas)
  assert(/\bnevoaPintada: true as boolean,/.test(codigo), 'PARTIDA.nevoaPintada está LIGADA (decisão do usuário, 24/11/2026)')
  assert(/\bposProcessamento: false as boolean,/.test(codigo), 'PARTIDA.posProcessamento está DESLIGADA até a F4 (decisão do usuário, 24/11/2026: o bloom ainda não tem o que mostrar)')
  assert((codigo.match(/\bnevoaPintada:/g) ?? []).length === 1 && (codigo.match(/\bposProcessamento:/g) ?? []).length === 1, 'cada chave é declarada uma única vez')
  // O AMBIENTE (IBL) é a terceira chave. Existe para o usuário poder voltar atrás: ele muda a aparência de 60 materiais PBR de uma vez (ouro, água, pedra úmida, obras metálicas).
  // DESLIGADO de propósito (24/11): medido na clareira, o ambiente GLOBAL a 0,55 soma +44% de luz à estrada e +40% à grama e esfria a cena (a estrada: azul/vermelho 1,47 → 2,04). Ele só deve
  // ligar com o fator por material (`fatorDeReflexo`) APLICADO à cena e depois que o usuário vir as fotos. Quando isso acontecer, esta linha muda DE PROPÓSITO, junto com o ledger.
  assert(/\bambienteIbl: false as boolean,/.test(codigo), 'PARTIDA.ambienteIbl está DESLIGADA: o ambiente global azulava o chão (+44% de luz, estrada azul/vermelho 1,47 → 2,04); só liga com o reflexo por material aplicado')
  assert((codigo.match(/\bambienteIbl:/g) ?? []).length === 1, 'a chave do ambiente é declarada uma única vez')
  // O RELEVO VISUAL é a quarta chave (F2, 25/11/2026): `PARTIDA.relevo.visual` liga o terreno de morros e vales SÓ no que se vê (a simulação continua plana: as regras do relevo são a F3, com «ok»
  // separado do usuário). DESLIGADA até as fotos da F2 serem aprovadas; desligada, o jogo é o de hoje (o chão é um plano em −0,45, I1). Quando o usuário a ligar, esta linha muda DE PROPÓSITO, junto
  // com o ledger. É um OBJETO (`relevo: { visual: … }`) porque a F3 acrescenta `regras` ao lado, com chave própria: uma flag só não distinguiria «vejo o relevo» de «o relevo vale».
  // A ÁGUA é a SEGUNDA chave do relevo (F2, 26/11/2026, decisão do usuário: «rio sem lentidão na F2, chave própria»): `PARTIDA.relevo.agua` liga os RIOS (valetas com água, só desenho); os lagos nas bordas e a lentidão de vadear são a F3.
  // PRÓPRIA e DESLIGADA, separada de `visual`: ligar uma NÃO liga a outra. A água só é DESENHADA com as duas ligadas E o campo pronto (`PARTIDA.relevo.agua && relevoVisivel`): isso é uma condição de desenho, não uma terceira chave.
  assert(/\brelevo: \{\s*visual: false as boolean,\s*agua: false as boolean,?\s*\},/.test(codigo), 'PARTIDA.relevo.visual E PARTIDA.relevo.agua estão DESLIGADAS, nessa ordem (o relevo só desenha; os rios são desenho; as regras e os lagos nas bordas são a F3)')
  assert((codigo.match(/\bagua: /g) ?? []).length === 1, 'a propriedade `agua` do relevo é declarada uma única vez (nenhum outro `agua:` solto na política)')
  assert((codigo.match(/\brelevo:/g) ?? []).length === 1, 'a chave do relevo é declarada uma única vez')
  assert((codigo.match(/\bvisual: /g) ?? []).length === 1, 'a propriedade `visual` do relevo é declarada uma única vez (nenhum outro `visual:` solto na política)')
}

export function run(cena?: string, politicas?: string): void {
  if (cena !== undefined) contratoDoTom(cena)
  if (politicas !== undefined) contratoDasChaves(politicas)

  // ── LEVE nunca liga nada (o desenho aprovado: o Leve é a rede de segurança de máquina fraca) ─────────────────────────────────────────────────────────────────────────────────────────
  const leve = configDoComposer(SPEC_QUALIDADE.leve, { chaveLigada: true, contextoPerdido: false })
  assert(leve.ativo === false, 'o Leve NUNCA liga o pós-processamento, mesmo com a chave ligada')
  assert(leve.bloom === false && leve.ao === false && leve.msaa === 0, 'o Leve não liga bloom, AO nem MSAA')

  // ── BONITO: bloom e MSAA, sem AO ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const bonito = configDoComposer(SPEC_QUALIDADE.bonito, { chaveLigada: true, contextoPerdido: false })
  assert(bonito.ativo === true && bonito.bloom === true && bonito.ao === false && bonito.msaa === 4, 'o Bonito liga bloom e MSAA 4×, sem AO')

  // ── ULTRA: tudo ──────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────────
  const ultra = configDoComposer(SPEC_QUALIDADE.ultra, { chaveLigada: true, contextoPerdido: false })
  assert(ultra.ativo === true && ultra.bloom === true && ultra.ao === true && ultra.msaa === 4, 'o Ultra liga bloom, AO e MSAA 4×')

  // ── A CHAVE desliga tudo (I1: chave desligada = o jogo de hoje) ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
  for (const q of [SPEC_QUALIDADE.bonito, SPEC_QUALIDADE.ultra]) {
    const off = configDoComposer(q, { chaveLigada: false, contextoPerdido: false })
    assert(off.ativo === false && off.bloom === false && off.ao === false, `com a chave desligada o ${q.efetiva} NÃO liga nada`)
  }

  // ── CONTEXTO PERDIDO desliga tudo, em qualquer nível (a tela preta é o pior caso) ───────────────────────────────────────────────────────────────────────────────────────────
  for (const q of [SPEC_QUALIDADE.leve, SPEC_QUALIDADE.bonito, SPEC_QUALIDADE.ultra]) {
    const perdido = configDoComposer(q, { chaveLigada: true, contextoPerdido: true })
    assert(perdido.ativo === false, `com o contexto WebGL perdido o ${q.efetiva} devolve o render ao R3F (nunca tela preta)`)
  }

  // ── BLOOM seletivo: o limiar fica ≥ 1,1 para só o que é HDR de verdade brilhar (neve, tropas e texto nunca lavam) ──────────────────────────────────────────────────────────
  assert(bonito.bloomLimiar >= 1.1 && ultra.bloomLimiar >= 1.1, `o limiar do bloom deve ser ≥ 1,1 (veio ${bonito.bloomLimiar} e ${ultra.bloomLimiar})`)
  assert(bonito.bloomForca > 0 && bonito.bloomForca <= 0.8 && ultra.bloomForca > 0 && ultra.bloomForca <= 0.8, 'a força do bloom é sutil: entre 0 e 0,8')
  assert(bonito.bloomRaio >= 0 && bonito.bloomRaio <= 1, 'o raio do bloom fica em [0, 1]')

  // ── a resolução do bloom é METADE (o custo do bloom é o preenchimento de pixels) e nunca zero ─────────────────────────────────────────────────────────────────────────────────
  assert(resolucaoDoBloom(1600, 900).largura === 800 && resolucaoDoBloom(1600, 900).altura === 450, 'o bloom roda a meia resolução')
  assert(resolucaoDoBloom(1, 1).largura === 1 && resolucaoDoBloom(1, 1).altura === 1, 'a resolução do bloom nunca é zero')
  assert(resolucaoDoBloom(0, 0).largura >= 1 && resolucaoDoBloom(Number.NaN, 5).largura >= 1, 'a resolução do bloom é válida mesmo com entrada ruim (NaN, 0)')
  assert(resolucaoDoBloom(3201, 1801).largura === 1601, 'o arredondamento é para cima (nunca perde um pixel de borda)')

  // ── ANISOTROPIA: o valor do spec, limitado pelo que a GPU suporta (`getMaxAnisotropy()`), e nunca menor que 1 nem inválido ─────────────────────────────────────────────────────────────
  // O jogo rodava com anisotropia 1 (o padrão do three) e o chão rasante da estrada borrava. O spec pede 2×/8×/16×, mas uma GPU pode suportar menos (4×, por exemplo): pedir mais que o máximo
  // é inválido no WebGL. A regra: min(spec, máximo da GPU), com piso 1, e um máximo desconhecido (0, NaN) cai em 1 em vez de quebrar.
  assert(anisotropiaEfetiva(SPEC_QUALIDADE.leve, 16) === 2, 'Leve pede 2× e a GPU suporta 16×: vale 2×')
  assert(anisotropiaEfetiva(SPEC_QUALIDADE.bonito, 16) === 8 && anisotropiaEfetiva(SPEC_QUALIDADE.ultra, 16) === 16, 'Bonito 8× e Ultra 16× numa GPU que suporta 16×')
  assert(anisotropiaEfetiva(SPEC_QUALIDADE.ultra, 4) === 4, 'o Ultra pede 16×, mas uma GPU que só suporta 4× limita a 4× (pedir mais é inválido no WebGL)')
  assert(anisotropiaEfetiva(SPEC_QUALIDADE.bonito, 2) === 2, 'o Bonito pede 8×, a GPU suporta 2×: vale 2×')
  assert(anisotropiaEfetiva(SPEC_QUALIDADE.ultra, 1) === 1, 'uma GPU sem anisotropia (máximo 1) fica em 1')
  assert(anisotropiaEfetiva(SPEC_QUALIDADE.ultra, 0) === 1 && anisotropiaEfetiva(SPEC_QUALIDADE.ultra, Number.NaN) === 1, 'um máximo inválido (0, NaN) cai em 1, nunca quebra')
  assert(anisotropiaEfetiva(SPEC_QUALIDADE.ultra, -8) === 1, 'um máximo negativo cai em 1')

  // ── o tom do jogo: a escolha do USUÁRIO em 24/11/2026 (viu as fotos de ACES, AgX e Neutral). Compara com a constante do three, e não com um número: o valor de `NeutralToneMapping` é do three. ──
  assert(TOM_DO_JOGO === NeutralToneMapping, 'o tom do jogo é o NeutralToneMapping do three (a escolha do usuário, 24/11/2026)')

  // ── o bloom segue o SPEC, e não «sempre ligado». Hoje todo nível ativo tem bloom=true (o mutante `bloom: true` é equivalente com os specs reais, provado por enumeração em 24/11), mas o spec
  //    PERMITE um nível com pós-processamento e sem bloom (só MSAA, por exemplo). Um spec fabricado exercita esse ramo, que o jogo real ainda não alcança. ─────────────────────────────────────
  const semBloom = { ...SPEC_QUALIDADE.bonito, bloom: false }
  assert(configDoComposer(semBloom, { chaveLigada: true, contextoPerdido: false }).bloom === false, 'um nível ativo sem bloom no spec NÃO liga bloom (a config segue o spec)')
  assert(configDoComposer(semBloom, { chaveLigada: true, contextoPerdido: false }).ativo === true, 'e o composer continua ativo (só MSAA)')
  const comAoNoBonito = { ...SPEC_QUALIDADE.bonito, ao: true }
  assert(configDoComposer(comAoNoBonito, { chaveLigada: true, contextoPerdido: false }).ao === true, 'a config também segue o spec do AO (um nível ativo com AO liga AO)')
}
