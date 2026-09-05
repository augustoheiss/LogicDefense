import React, { useState, useEffect } from 'react'

interface AcademySectionProps {
  onOpenCertificate: () => void
}

interface Lesson {
  id: string
  number: number
  tag: string
  title: string
  body: React.ReactNode
}

const STORAGE_PROGRESS_KEY = 'ld_cvmaker_academy_progress'

export const AcademySection: React.FC<AcademySectionProps> = ({ onOpenCertificate }) => {
  const [completed, setCompleted] = useState<Record<string, boolean>>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_PROGRESS_KEY)
      return saved ? JSON.parse(saved) : {}
    } catch {
      return {}
    }
  })

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_PROGRESS_KEY, JSON.stringify(completed))
    } catch {
      // Falha silenciosa de quota
    }
  }, [completed])

  const toggleLesson = (id: string) => {
    setCompleted(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  const lessons: Lesson[] = [
    {
      id: 'modulo_1',
      number: 1,
      tag: 'Fundamentos de Layout',
      title: '🍺 O Chopp no Bar e a Tirania do Word: O Pesadelo das Quebras Fantasmas',
      body: (
        <div>
          <p>
            Pede um chopp gelado, senta aí e vamos falar a verdade: <em>quem nunca passou raiva com o Microsoft Word tentando ajeitar um currículo?</em>
          </p>
          <p>
            Você está lá, domingo à noite, quase pronto para mandar para a vaga dos sonhos. Você dá um mísero <strong>Enter</strong> para afastar uma seção... e <strong>BUM</strong>! Uma tabela inteira é arremessada para a página 2, o rodapé desaparece e uma página em branco fantasma surge no final que você não consegue apagar nem com reza braba.
          </p>
          <div className="cv-lesson-callout">
            <strong>Por que isso acontece?</strong> Porque softwares de texto foram inventados nos anos 80 para simular máquinas de escrever contínuas. Eles não têm noção de <em>Orçamento Espacial Fixo</em>. Se o texto cresce 2 pixels, o motor empurra o resto em cascata infinita.
          </div>
          <p>
            Uma folha A4 no padrão web possui proporções milimétricas rígidas:
            <br />
            <code>Largura = 210mm (~794px a 96 DPI) | Altura = 297mm (~1123px a 96 DPI)</code>.
          </p>
          <p>
            No <strong>CV Maker 2.0</strong>, a gente trata a folha A4 exatamente como os engenheiros da NASA tratam o compartimento de carga de um foguete: <strong>cada milímetro é orçado matematicamente</strong>. Se uma coluna precisa caber em 1123 pixels, nenhum elemento pode transbordar sem que o sistema recalcule as proporções.
          </p>
        </div>
      )
    },
    {
      id: 'modulo_2',
      number: 2,
      tag: 'Deep Research 2026-08',
      title: '⚔️ A Guerra dos Três Reinos do PDF: Qual Tecnologia Escolher?',
      body: (
        <div>
          <p>
            Em agosto de 2026, quando abrimos as pesquisas profundas (<em>Deep Research - PDF Architecture</em>), nos deparamos com uma batalha histórica na computação entre três grandes facções para gerar PDFs:
          </p>
          <table className="cv-tech-table">
            <thead>
              <tr>
                <th>Facção / Tecnologia</th>
                <th>Como Opera</th>
                <th>Vantagens</th>
                <th>Desvantagens Críticas</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td><strong>1. @react-pdf/renderer</strong></td>
                <td>Motor declarativo em C++ (Yoga) que desenha direto no PDF</td>
                <td>Super leve, rápido e gera PDF nativo sem precisar de navegador.</td>
                <td>CSS muito primitivo. Não suporta CSS Grid moderno, flexbox avançado quebra e você precisa reescrever toda a UI.</td>
              </tr>
              <tr>
                <td><strong>2. WeasyPrint / Paged.js</strong></td>
                <td>Padrão W3C CSS Paged Media com motor Python/cairo</td>
                <td>Excelente para livros e relatórios acadêmicos com índices formais.</td>
                <td>Lento, não suporta recursos modernos de CSS3/Grid e ícones SVG modernos costumam renderizar tortos.</td>
              </tr>
              <tr>
                <td><strong>3. Headless Chromium (Blink / Skia)</strong></td>
                <td>O próprio motor do Google Chrome em modo headless</td>
                <td><strong>Paridade visual 1:1 absoluta.</strong> O que você vê no monitor é exatamente o que sai no PDF. Suporta CSS Grid, Canvas e Web Fonts.</td>
                <td>Requer uma instância do Chromium rodando, que deve ser tratada com inteligência.</td>
              </tr>
            </tbody>
          </table>
          <div className="cv-lesson-callout">
            <strong>O Veredito da Mesa do Bar:</strong> Para currículos de alto padrão visual com colunas, cartões e gradientes, o <strong>Headless Chromium + CSS Paged Media</strong> é o campeão indiscutível. O candidato não pode correr o risco de ver um layout lindo no navegador e receber um PDF desconfigurado.
          </div>
        </div>
      )
    },
    {
      id: 'modulo_3',
      number: 3,
      tag: 'Deep Research 2026-09',
      title: '🎨 O Fantasma da Skia e a Morte dos 72 DPI: Como Salvar a Nitidez',
      body: (
        <div>
          <p>
            Agora o papo vai ficar fino, digno de mestre cervejeiro da computação gráfica. Você sabia que dentro do Google Chrome existe uma biblioteca em C++ chamada <strong>Skia</strong>? É ela quem desenha as janelas, textos e botões na sua tela.
          </p>
          <p>
            Quando o Chrome vai imprimir para PDF (<em>PrintToPDF</em>), ele tenta manter tudo como <strong>vetor puro</strong> (linhas matemáticas perfeitas que você pode dar zoom infinito sem perder qualidade). Mas existe uma armadilha fatal:
          </p>
          <div className="cv-lesson-callout">
            <strong>O Bicho-Papão dos 72 DPI:</strong> Se você colocar uma sombra CSS inocente com <code>filter: drop-shadow(...)</code> ou certos modos de transparência complexos, a Skia entra em pânico e diz: <em>"Não sei calcular essa matemática vetorial direto na impressora!"</em>. Sabe o que ela faz? Converte aquele pedaço de texto num <strong>bitmap tosco de 72 DPI</strong>! Na tela parece normal, mas no papel impresso fica tudo borrado como se tivesse saído de um fax dos anos 90.
          </div>
          <p>
            <strong>A Solução que Criamos:</strong> Implementamos regras estritas de <em>Anti-Rasterização Skia</em> no <code>cv-print.css</code>. Usamos pseudo-elementos e bordas limpas sem filtros opacos no momento da impressão, preservando a nitidez cristalina em 1200 DPI.
          </p>
          <p>
            E para garantir que o currículo caiba em <strong>exatamente 1 página A4</strong>, usamos um algoritmo de <strong>Bisseção Matemática</strong>: o motor mede a altura real dos blocos e, em 6 a 8 micro-ajustes binários, calibra os espaçamentos e fontes até atingir o equilíbrio geométrico perfeito, sem deformar as letras.
          </p>
        </div>
      )
    },
    {
      id: 'modulo_4',
      number: 4,
      tag: 'História dos Bastidores',
      title: '🕵️‍♂️ O Caso Curioso do standaloneHtmlService: O Fim do Clone Estático',
      body: (
        <div>
          <p>
            Aqui vai um segredo de bastidores hilário e verdadeiro. Se você olhou os commits do nosso projeto, já deve ter se perguntado: <em>"Por que raios os agentes de IA viviam editando aquele arquivo standaloneHtmlService.ts se a gente nem exportava mais HTML?"</em>
          </p>
          <p>
            A história é maravilhosa: lá no começo, criamos um botão para permitir que a pessoa pudesse baixar um <strong>"Pacote ZIP / HTML Offline"</strong> e abrir o currículo em qualquer computador sem internet.
          </p>
          <p>
            Para fazer isso sem precisar de um servidor, o <code>standaloneHtmlService.ts</code> foi escrito concatenando mais de <strong>880 linhas de código HTML dentro de strings</strong> (<code>const html = '&lt;html&gt;...'</code>). Ou seja: criamos um <em>dublê</em> do React em texto puro!
          </p>
          <div className="cv-lesson-callout">
            <strong>O Antipadrão da Divergência de Templates Duplos (Dual-Template Divergence):</strong>
            <br />
            Toda vez que a gente arrumava um bugzinho visual no editor React (por exemplo, tirava a margem branca indesejada ou colocava um fundo bonito na folha), o agente de IA pensava: <em>"Nossa, se o usuário clicar em Baixar ZIP, o HTML estático do ZIP vai sair com o bug antigo!"</em>. E lá ia o agente atualizar 880 linhas de template na mão para deixar os dois mundos iguais!
          </div>
          <p>
            <strong>A Libertação:</strong> Desenvolvemos o <strong>DOM Snapshot Serializer</strong>. Em vez de montar strings duplicadas, ele clona o DOM vivo do React que já está perfeito na tela do usuário, serializa o CSS real e salva o arquivo com paridade 100% garantida. O <code>standaloneHtmlService.ts</code> virou uma relíquia histórica que agora pode descansar em paz!
          </p>
        </div>
      )
    },
    {
      id: 'modulo_5',
      number: 5,
      tag: 'Orquestração de IA',
      title: '🧠 A Alquimia das Skills de IA & O Nível 2 Multi-Agent Ensemble',
      body: (
        <div>
          <p>
            Já tentou pedir para o ChatGPT ou Claude: <em>"Escreva um currículo para mim"</em>? O resultado é sempre o mesmo: um texto genérico, sem graça, cheio de frases clichês como <em>"profissional proativo orientado a resultados"</em> e, pior de tudo, com números inventados da cabeça da IA.
          </p>
          <p>
            No CV Maker 2.0, nós mudamos as regras do jogo usando uma <strong>Skill Especializada Agent-Native</strong> (<code>cv-maker-api</code>). Em vez de um prompt vago, a gente comanda uma equipe de <strong>5 personas simultâneas</strong> minerando o mesmo histórico profissional:
          </p>
          <ul>
            <li>👔 <strong>O Executivo:</strong> Só fala a língua do dinheiro, ROI, faturamento e métricas financeiras no padrão Google/IBM (X-Y-Z).</li>
            <li>💻 <strong>O Arquiteto Técnico:</strong> Focado em microsserviços, latência, throughput, esteiras CI/CD e sistemas distribuídos.</li>
            <li>📖 <strong>O Biógrafo de Carreira:</strong> Revela o contexto humano, superação de desafios, gestão de crises e liderança.</li>
            <li>🎓 <strong>O Mentor Didático:</strong> Destaca facilidade em aprender rápido, treinar times e documentar processos.</li>
            <li>👽 <strong>O Inovador Disruptivo:</strong> Enfatiza patentes, experimentação com IA generativa e tecnologias de fronteira.</li>
          </ul>
          <div className="cv-lesson-callout">
            <strong>O Golpe de Mestre: Nível 2 (Síntese Magna)</strong>
            <br />
            Uma 6ª IA lê as 5 versões mineradas em paralelo e compõe o <strong>6º Currículo Oficial Definitivo</strong>. Ela destila apenas os pontos mais impactantes de cada uma, elimina duplicidades e segue o guardrail inegociável de <strong>Zero Fabricação</strong>: nenhuma métrica é inventada.
          </div>
        </div>
      )
    },
    {
      id: 'modulo_6',
      number: 6,
      tag: 'Governança & LGPD',
      title: '⚖️ Engenharia com Dignidade: Governança por Design & LGPD',
      body: (
        <div>
          <p>
            Para fechar a nossa rodada no bar com chave de ouro: a tecnologia só tem valor real quando respeita a dignidade, a privacidade e a verdade de quem a utiliza.
          </p>
          <p>
            No desenvolvimento do CV Maker 2.0, seguimos três princípios sagrados de <strong>Governança por Design</strong>:
          </p>
          <ol>
            <li>
              <strong>100% Local-First (Privacidade Absoluta):</strong> Seu currículo, seus dados pessoais e até o nome digitado no certificado nunca são enviados para servidores ocultos. Tudo é processado e persistido no <code>localStorage</code> do seu próprio navegador.
            </li>
            <li>
              <strong>Zero Fabricação:</strong> Agentes de IA auxiliam na clareza e no impacto da redação, mas o compromisso ético com a verdade do histórico profissional pertence ao candidato.
            </li>
            <li>
              <strong>Soberania do Usuário:</strong> Você tem controle total. Pode editar cada caixa manualmente, mudar fontes, arrastar blocos, baixar o YAML limpo ou imprimir em PDF sem amarras de plataforma.
            </li>
          </ol>
          <div className="cv-lesson-callout">
            <strong>Missão Cumprida!</strong> Você agora conhece cada engrenagem que faz este sistema funcionar. Ao marcar todos os módulos como concluídos, você liberará o seu <strong>Certificado de Conclusão Simbólico</strong> para imprimir ou guardar como recordação deste aprendizado!
          </div>
        </div>
      )
    }
  ]

  const totalLessons = lessons.length
  const completedCount = lessons.filter(l => Boolean(completed[l.id])).length
  const progressPercent = Math.round((completedCount / totalLessons) * 100)
  const isAllCompleted = completedCount === totalLessons

  return (
    <div className="cv-academy-container">
      {/* Header com Progresso & Desbloqueio do Certificado */}
      <div className="cv-academy-header-card">
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: '1rem' }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.6rem' }}>
              <span style={{ fontSize: '1.5rem' }}>🎓</span>
              <h2 style={{ margin: 0, fontSize: '1.4rem', fontWeight: 900, color: '#f8fafc' }}>
                Academia de Arquitetura & Engenharia de Documentos
              </h2>
            </div>
            <p style={{ margin: '0.35rem 0 0 0', fontSize: '0.88rem', color: '#94a3b8' }}>
              Aprenda como construímos este motor de alta precisão em formato de conversa de bar descontraída, com bom humor e rigor de engenharia.
            </p>
          </div>

          {isAllCompleted ? (
            <button
              type="button"
              className="cv-academy-claim-cert-btn"
              onClick={onOpenCertificate}
            >
              🎉 Emitir Meu Certificado (100%)
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenCertificate}
              style={{
                background: 'rgba(51, 65, 85, 0.5)',
                color: '#cbd5e1',
                border: '1px solid #475569',
                padding: '0.55rem 1.15rem',
                borderRadius: '8px',
                fontSize: '0.84rem',
                fontWeight: 600,
                cursor: 'pointer'
              }}
            >
              📜 Ver Certificado ({progressPercent}%)
            </button>
          )}
        </div>

        {/* Barra de Progresso */}
        <div className="cv-academy-progress-row">
          <div style={{ fontSize: '0.84rem', color: '#cbd5e1', fontWeight: 600 }}>
            Progresso da Trilha: <strong style={{ color: '#38bdf8' }}>{completedCount} de {totalLessons} módulos</strong> ({progressPercent}%)
          </div>
          <div className="cv-academy-progress-bar-bg">
            <div
              className="cv-academy-progress-bar-fill"
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>
      </div>

      {/* Lista de Aulas */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
        {lessons.map(lesson => {
          const isDone = Boolean(completed[lesson.id])

          return (
            <div
              key={lesson.id}
              className={`cv-lesson-card ${isDone ? 'completed' : ''}`}
            >
              <div className="cv-lesson-top">
                <div>
                  <div className="cv-lesson-meta">
                    <span className="cv-lesson-tag">{lesson.tag}</span>
                    <span style={{ fontSize: '0.78rem', color: '#64748b', fontWeight: 700 }}>
                      MÓDULO 0{lesson.number}
                    </span>
                  </div>
                  <h3 className="cv-lesson-title">{lesson.title}</h3>
                </div>

                <label className="cv-lesson-checkbox-label">
                  <input
                    type="checkbox"
                    checked={isDone}
                    onChange={() => toggleLesson(lesson.id)}
                  />
                  <span>{isDone ? '✅ Concluído' : 'Marcar como Lido'}</span>
                </label>
              </div>

              <div className="cv-lesson-body">
                {lesson.body}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
