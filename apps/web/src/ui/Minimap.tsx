import { useEffect, useRef } from 'react'
import type { PalaceLayout } from '../palace/layout'
import { playerPose, useStore } from '../store'
import { DEFAULT_THEME, roomPalettes } from '../theme'

const SIZE = 180

export function Minimap({ layout }: { layout: PalaceLayout }) {
  const canvas = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.current!.width = SIZE * dpr
    canvas.current!.height = SIZE * dpr
    ctx.scale(dpr, dpr)

    const { minX, maxX, minZ, maxZ } = layout.bounds
    const span = Math.max(maxX - minX, maxZ - minZ)
    const pad = 14
    const k = (SIZE - pad * 2) / span
    const ox = pad + (SIZE - pad * 2 - (maxX - minX) * k) / 2
    const oz = pad + (SIZE - pad * 2 - (maxZ - minZ) * k) / 2
    const tx = (x: number) => ox + (x - minX) * k
    const tz = (z: number) => oz + (z - minZ) * k

    const { tokens } = DEFAULT_THEME.ui
    const palettes = roomPalettes(DEFAULT_THEME, layout.rooms.map((r) => r.title))
    let raf = 0
    const draw = () => {
      const { memorized, currentRoomId } = useStore.getState()
      ctx.clearRect(0, 0, SIZE, SIZE)
      ctx.fillStyle = tokens.surface
      ctx.fillRect(0, 0, SIZE, SIZE)
      ctx.lineJoin = 'miter'
      for (const c of layout.corridors) {
        ctx.fillStyle = DEFAULT_THEME.scene.corridor.floor
        ctx.fillRect(tx(c.floor.x - c.floor.w / 2), tz(c.floor.z - c.floor.d / 2), c.floor.w * k, c.floor.d * k)
      }
      for (const r of layout.rooms) {
        const active = r.id === currentRoomId
        const x = tx(r.x - r.w / 2)
        const z = tz(r.z - r.d / 2)
        ctx.fillStyle = palettes[r.index].wall
        ctx.fillRect(x, z, r.w * k, r.d * k)
        ctx.strokeStyle = tokens.ink
        ctx.lineWidth = active ? 3 : 1
        ctx.strokeRect(x, z, r.w * k, r.d * k)
        for (const p of r.pedestals) {
          const done = !!memorized[p.concept.id]
          ctx.fillStyle = done ? tokens.accent : tokens.surface
          ctx.strokeStyle = tokens.ink
          ctx.lineWidth = 1
          ctx.beginPath()
          ctx.arc(tx(p.x), tz(p.z), done ? 3.2 : 2.4, 0, Math.PI * 2)
          ctx.fill()
          ctx.stroke()
        }
      }
      // Jugador: flecha de tinta con borde de yeso, apuntando a donde mira.
      const px = tx(playerPose.x)
      const pz = tz(playerPose.z)
      const a = playerPose.yaw
      ctx.fillStyle = tokens.ink
      ctx.strokeStyle = tokens.surface
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(px + Math.sin(a) * 8, pz + Math.cos(a) * 8)
      ctx.lineTo(px + Math.sin(a + 2.5) * 6, pz + Math.cos(a + 2.5) * 6)
      ctx.lineTo(px + Math.sin(a - 2.5) * 6, pz + Math.cos(a - 2.5) * 6)
      ctx.closePath()
      ctx.stroke()
      ctx.fill()
      raf = requestAnimationFrame(draw)
    }
    draw()
    return () => cancelAnimationFrame(raf)
  }, [layout])

  return <canvas ref={canvas} className="minimap" style={{ width: SIZE, height: SIZE }} aria-label="Minimapa" />
}
