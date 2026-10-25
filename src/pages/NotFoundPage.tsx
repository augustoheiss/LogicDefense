import { useEffect } from 'react'
import { Link } from 'react-router-dom'

export function NotFoundPage() {
  useEffect(() => {
    document.title = 'Página Não Encontrada (404) · Heiss-Lab'
    let robotsMeta = document.head.querySelector<HTMLMetaElement>('meta[name="robots"]')
    if (!robotsMeta) {
      robotsMeta = document.createElement('meta')
      robotsMeta.setAttribute('name', 'robots')
      document.head.appendChild(robotsMeta)
    }
    robotsMeta.setAttribute('content', 'noindex, follow')

    return () => {
      if (robotsMeta) {
        robotsMeta.setAttribute('content', 'index, follow')
      }
    }
  }, [])

  return (
    <div className="hero" style={{ minHeight: '65vh', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
      <p className="hero__eyebrow">Erro 404 · Rota Não Encontrada</p>
      <h1 className="hero__title">Coordenada Fora da Matriz</h1>
      <p className="hero__sub" style={{ maxWidth: 580, margin: '12px auto 28px' }}>
        O endereço acessado não existe ou foi movido. Escolha abaixo para onde deseja ir dentro do portal Heiss-Lab:
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 12, justifyContent: 'center' }}>
        <Link to="/" className="btn-primary">
          🏛️ Página Inicial
        </Link>
        <Link to="/jogos" className="btn-outline">
          🎮 Menu de 5 Jogos
        </Link>
        <Link to="/laboratorio" className="btn-outline">
          🔬 Laboratório (CV Maker, Sekundo, Moeda)
        </Link>
        <Link to="/repositorio" className="btn-outline">
          📚 Repositório Didático
        </Link>
      </div>
    </div>
  )
}
