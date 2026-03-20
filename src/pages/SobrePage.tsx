export function SobrePage() {
  return (
    <div className="manifesto-page">

      {/* ── Hero ── */}
      <div className="manifesto-hero">
        <p className="hero__eyebrow">Heiss-Lab · 2026</p>
        <h1 className="manifesto-hero__title">Sobre</h1>
        <p className="manifesto-hero__sub">
          Um projeto humano, em co-criação com a Inteligência Artificial.
        </p>
      </div>

      {/* ── Body ── */}
      <div className="manifesto-body">

        <section className="manifesto-section">
          <h2 className="manifesto-section__title">A Origem e o Propósito</h2>
          <p className="manifesto-section__text">
            Todo o material disponível neste portal foi elaborado 100% em cocriação com a
            Inteligência Artificial. Este é um ambiente prático, validado no dia a dia por
            professores de Matemática em salas de aula reais. A elaboração deste domínio é, em
            sua essência, uma forma organizada de disponibilizar material didático de altíssima
            qualidade, focado inicialmente no Ensino Fundamental II, mas perfeitamente adaptável
            aos desafios do Ensino Médio.
          </p>
        </section>

        <section className="manifesto-section">
          <h2 className="manifesto-section__title">A Alavanca Tecnológica e o Fator Humano</h2>
          <p className="manifesto-section__text">
            Estamos avançando rapidamente para o ápice de uma nova era digital. Quando os
            primeiros computadores surgiram, a novidade era fascinante; aprendemos a usar a
            tecnologia como uma alavanca para todos os tipos de trabalho. No entanto, como
            "processadores de erros" que somos, corremos um risco iminente: o de nos tornarmos
            meras engrenagens que apenas alimentam outras máquinas. Aos poucos, permitimos que a
            nossa importância e o nosso valor fossem determinados por algoritmos.
          </p>
          <p className="manifesto-section__text">
            Agora, temos em mãos a mais recente e poderosa engrenagem dessa alavanca: a
            Inteligência Artificial. Uma força bruta que democratiza o acesso a trabalhos antes
            reservados apenas a uma elite intelectual. Mas, ao integrarmos essa força de forma
            irrefletida, corremos o risco de desvalorizar a real experiência de vida e o esforço
            monumental dos nossos antepassados. Em suma, corremos o risco de não valorizarmos
            mais o próprio ato de pensar.
          </p>
        </section>

        <section className="manifesto-section">
          <h2 className="manifesto-section__title">A Metáfora da Editora e a Perda da Jornada</h2>
          <p className="manifesto-section__text">
            Podemos comparar esse cenário ao clássico ecossistema de uma Editora. A publicação de
            um artigo envolvia uma teia de experiências humanas: a pesquisa profunda, a
            colaboração entre especialistas, o debate agonista de ideias, a revisão minuciosa e,
            finalmente, a diagramação. O resultado era um artigo didático ou científico brilhante,
            mas a verdadeira riqueza residia na experiência envolvida nesse processo.{' '}
            <strong>A jornada carregava o maior peso.</strong>
          </p>
          <p className="manifesto-section__text">
            Hoje, para alcançarmos essa mesma qualidade técnica final, não precisamos mais de toda
            essa engrenagem humana, colaborativa e gratificante. A IA potencializou a produção,
            removendo a necessidade do trabalho árduo para se redigir um texto com a qualidade de
            uma revista conceituada. A grande reflexão que fica é: se, no passado, mesmo com toda
            essa riqueza de experiências magníficas e vidas empolgantes, a humanidade ainda falhava
            miseravelmente em seus propósitos, o que nos aguarda no futuro, agora que nos tornamos
            pessoas que apenas "alimentam máquinas"?
          </p>
        </section>

        <section className="manifesto-section">
          <h2 className="manifesto-section__title">O Equilíbrio do Universo</h2>
          <p className="manifesto-section__text">
            Não defendo visões extremistas, pois acredito firmemente que existe proveito em todo
            tipo de trabalho árduo, como nos ensina a sabedoria de Provérbios — e não há nada
            mais exaustivo do que viver uma vida sem o propósito do trabalho. Essa alavanca
            tecnológica inevitavelmente nos traz um conforto temporário, mas a verdade inexorável
            é que chegamos ao tempo determinado.
          </p>
          <p className="manifesto-section__text">
            O ser humano finalmente lidará com as consequências em escala de suas próprias
            criações. Se não houvesse ação e reação, se a balança do Universo não fosse
            perfeitamente equilibrada, a vida, a Terra e os céus não existiriam. Nem mesmo o
            tecido espiritual, que não opera sob o domínio do tempo, foge à balança da ação e
            reação. Se o tempo determinado para esse acerto de contas não fosse o agora, então
            nada importaria e tudo, eventualmente, deixaria de existir.{' '}
            <strong>Nós escolhemos usar essa alavanca com consciência.</strong>
          </p>
        </section>

        {/* ── Contact CTA ── */}
        <div className="manifesto-contact">
          <span className="manifesto-contact__eyebrow">Contato</span>
          <p className="manifesto-contact__text">
            Quer contribuir como autor, educador, ou somar forças com o nosso projeto de qualquer
            outra forma? Entre em contato:
          </p>
          <a
            href="mailto:augustoheiss@gmail.com"
            className="manifesto-contact__email"
          >
            augustoheiss@gmail.com →
          </a>
        </div>

      </div>
    </div>
  )
}
