export class Particle {
  x: number
  y: number
  color: string
  vx: number
  vy: number
  life: number

  constructor(x: number, y: number, color: string) {
    this.x = x
    this.y = y
    this.color = color
    this.vx = (Math.random() - 0.5) * 6
    this.vy = (Math.random() - 0.5) * 6
    this.life = 25
  }

  update(): void {
    this.x += this.vx
    this.y += this.vy
    this.life--
  }

  draw(ctx: CanvasRenderingContext2D): void {
    ctx.globalAlpha = this.life / 25
    ctx.fillStyle = this.color
    ctx.beginPath()
    ctx.arc(this.x, this.y, 2, 0, Math.PI * 2)
    ctx.fill()
    ctx.globalAlpha = 1
  }
}
