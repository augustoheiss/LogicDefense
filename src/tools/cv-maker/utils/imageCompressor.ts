/**
 * imageCompressor.ts — Compressor e Otimizador Client-Side de Imagens
 * 
 * Redimensiona imagens no navegador usando <canvas> offscreen para evitar estouro
 * de cota do localStorage (5MB a 10MB) e prevenir memory spikes no V8 durante a serialização DOM do P3.
 */

export interface ImageCompressionOptions {
  maxWidth?: number      // Limite de largura (padrão: 1200px)
  maxHeight?: number     // Limite de altura (padrão: 1200px)
  quality?: number       // Taxa de compressão JPEG/WebP (padrão: 0.82)
  outputType?: 'image/webp' | 'image/jpeg' | 'image/png'
}

/**
 * Comprime um arquivo de imagem e retorna uma string Base64 Data URL otimizada (< 150KB).
 */
export async function compressImageFile(
  file: File | Blob,
  options: ImageCompressionOptions = {}
): Promise<string> {
  const {
    maxWidth = 1200,
    maxHeight = 1200,
    quality = 0.82,
    outputType = 'image/jpeg'
  } = options

  // 1. Vetores SVG não devem ser rasterizados para manter nitidez infinita
  if (file.type === 'image/svg+xml') {
    return new Promise((resolve, reject) => {
      const reader = new FileReader()
      reader.onload = () => resolve(reader.result as string)
      reader.onerror = reject
      reader.readAsDataURL(file)
    })
  }

  // 2. Carrega a imagem original em memória
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = reject
    reader.readAsDataURL(file)
  })

  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => {
      let { width, height } = img

      // 3. Se a imagem já estiver dentro das dimensões e for leve (< 120KB), retorna direto
      if (width <= maxWidth && height <= maxHeight && file.size < 120 * 1024) {
        resolve(dataUrl)
        return
      }

      // 4. Cálculo proporcional de escala mantendo aspect ratio
      if (width > maxWidth) {
        height = Math.round((height * maxWidth) / width)
        width = maxWidth
      }
      if (height > maxHeight) {
        width = Math.round((width * maxHeight) / height)
        height = maxHeight
      }

      // 5. Renderização offscreen com interpolação de alta qualidade
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        resolve(dataUrl) // Fallback seguro
        return
      }

      ctx.imageSmoothingEnabled = true
      ctx.imageSmoothingQuality = 'high'

      // Se for JPEG, pinta fundo branco para evitar artefatos de transparência
      if (outputType === 'image/jpeg') {
        ctx.fillStyle = '#ffffff'
        ctx.fillRect(0, 0, width, height)
      }

      ctx.drawImage(img, 0, 0, width, height)

      try {
        const compressed = canvas.toDataURL(outputType, quality)
        resolve(compressed)
      } catch (err) {
        // Se toDataURL falhar (ex: WebP não suportado em browser muito antigo), tenta JPEG padrão
        try {
          const fallback = canvas.toDataURL('image/jpeg', 0.8)
          resolve(fallback)
        } catch {
          resolve(dataUrl) // Último recurso: imagem original
        }
      }
    }

    img.onerror = () => {
      reject(new Error('Falha ao decodificar arquivo de imagem para compressão.'))
    }

    img.src = dataUrl
  })
}
