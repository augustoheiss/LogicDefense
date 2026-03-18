import { useState, useEffect } from 'react'

export function OfflineScreen() {
  const [offline, setOffline] = useState(!navigator.onLine)

  useEffect(() => {
    const onOffline = () => setOffline(true)
    const onOnline = () => setOffline(false)
    window.addEventListener('offline', onOffline)
    window.addEventListener('online', onOnline)
    return () => {
      window.removeEventListener('offline', onOffline)
      window.removeEventListener('online', onOnline)
    }
  }, [])

  if (!offline) return null

  return (
    <div style={{
      display: 'flex', position: 'absolute', top: 0, left: 0, width: '100%', height: '100%',
      background: 'rgba(0,0,0,0.95)', zIndex: 9999,
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', color: 'white',
    }}>
      <h1 style={{ color: '#ff4444', fontSize: 44, textShadow: '0 0 30px #ff0000', textAlign: 'center' }}>
        ⚠️ SINAL PERDIDO ⚠️
      </h1>
      <p style={{ fontSize: 18, color: '#aaa', textAlign: 'center', maxWidth: 600, padding: 20 }}>
        O Universo lá fora está sem conexão.<br />
        A Lógica entrou em suspensão temporal para proteger seus dados.<br /><br />
        <span style={{ color: '#00d4ff' }}>Aguardando retorno da rede...</span>
      </p>
    </div>
  )
}
