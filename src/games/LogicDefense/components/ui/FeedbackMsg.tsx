import { useState, useImperativeHandle, forwardRef, useEffect, useRef } from 'react'

export interface FeedbackHandle {
  show: (msg: string, color: string) => void
}

export const FeedbackMsg = forwardRef<FeedbackHandle>((_, ref) => {
  const [msg, setMsg] = useState('')
  const [color, setColor] = useState('#fff')
  const [visible, setVisible] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useImperativeHandle(ref, () => ({
    show(message: string, msgColor: string) {
      if (timerRef.current) clearTimeout(timerRef.current)
      setMsg(message)
      setColor(msgColor)
      setVisible(true)
      timerRef.current = setTimeout(() => setVisible(false), 3000)
    },
  }))

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current) }, [])

  return (
    <div id="feedback-msg" style={{
      position: 'absolute', top: 150, width: '100%', textAlign: 'center',
      fontSize: 32, fontWeight: 'bold',
      opacity: visible ? 1 : 0,
      transition: 'opacity 0.5s',
      textShadow: '0 0 10px #000, 0 0 20px #000',
      zIndex: 6, pointerEvents: 'none',
      color,
    }}>
      {msg}
    </div>
  )
})

FeedbackMsg.displayName = 'FeedbackMsg'
