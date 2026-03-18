interface ManifestoModalProps {
  onClose: () => void
}

export function ManifestoModal({ onClose }: ManifestoModalProps) {
  return (
    <div className="info-modal" style={{ display: 'flex' }}>
      <div className="info-box">
        <h2 className="info-title">A LÓGICA DO ONE PIECE</h2>
        <p>Palavras como Amor, Ódio, ou o meio termo (A Cadeira), podem ter infinitos significados dependendo de como as falamos, dos nossos motivos e de eventos externos imprevisíveis. Esses fatores podem fazer com que nossas palavras sumam no vácuo ou sejam potencializadas como por um microfone. Vivemos em um mundo de probabilidades.</p>
        <p>Está na hora de sair do dicionário, sair da biblioteca e experimentar a Lógica na prática. Use todos esses Dados, Informações, Conhecimentos e Sabedoria a seu favor estudando a função dos números (e das palavras).</p>
        <p>Desligue o seu "Juiz" interno — aquele que rejeita as pessoas só porque elas não te dão importância ou não te respeitam. A Lógica por trás de todos esses motivos é mais profunda e soberana, e ninguém escapa da lei das probabilidades. Aceite a Morte, e então, Viva. Não como uma máquina, que hoje está incrivelmente potente, mas como a alma que você é.</p>
        <hr style={{ borderColor: '#333', margin: '20px 0' }} />
        <p style={{ color: '#00ff00', fontWeight: 'bold', textAlign: 'center' }}>[ SOBRE O PROJETO ]</p>
        <p style={{ textAlign: 'center' }}>
          Este jogo é um Museu Vivo. Foi produzido <strong>100% em co-criação com Inteligência Artificial</strong>, provando que a IA é a melhor ferramenta para mentes que não têm medo de pensar e filosofar sobre o código.
        </p>
        <p style={{ textAlign: 'center' }}>
          Quer falar com o autor ou trocar ideias sobre tecnologia e educação?<br />
          📧 <strong>augustoheiss@gmail.com</strong>
        </p>
        <button onClick={onClose} style={{ marginTop: 15, width: '100%', fontSize: 16 }} className="action-btn btn-sell">
          FECHAR
        </button>
      </div>
    </div>
  )
}
