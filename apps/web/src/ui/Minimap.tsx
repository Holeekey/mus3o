import { useEffect, useRef, useState } from 'react'
import type { PalaceLayout } from '../palace/layout'
import { playerPose, useStore } from '../store'
import { DEFAULT_THEME, roomPalettes } from '../theme'

const COMPACT_SIZE = 180
const EXPANDED_SIZE = 340

type EntityKind = 'key' | 'chest' | 'trap' | 'door' | 'standard'

function getEntityKind(id: string, title: string): EntityKind {
  const s = `${id} ${title}`.toLowerCase()
  if (s.includes('key') || s.includes('llave')) return 'key'
  if (s.includes('chest') || s.includes('cofre')) return 'chest'
  if (s.includes('trap') || s.includes('trampa')) return 'trap'
  if (s.includes('door') || s.includes('compuerta')) return 'door'
  return 'standard'
}

export function Minimap({ layout }: { layout: PalaceLayout }) {
  const [expanded, setExpanded] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const size = expanded ? EXPANDED_SIZE : COMPACT_SIZE

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx) return
    const dpr = window.devicePixelRatio || 1
    canvas.current!.width = size * dpr
    canvas.current!.height = size * dpr
    ctx.scale(dpr, dpr)

    const { minX, maxX, minZ, maxZ } = layout.bounds
    const span = Math.max(maxX - minX, maxZ - minZ)
    const pad = expanded ? 22 : 14
    const k = (size - pad * 2) / span
    const ox = pad + (size - pad * 2 - (maxX - minX) * k) / 2
    const oz = pad + (size - pad * 2 - (maxZ - minZ) * k) / 2
    const tx = (x: number) => ox + (x - minX) * k
    const tz = (z: number) => oz + (z - minZ) * k

    const { tokens } = DEFAULT_THEME.ui
    const palettes = roomPalettes(DEFAULT_THEME, layout.rooms.map((r) => r.title))
    let raf = 0

    const draw = () => {
      const { memorized, currentRoomId } = useStore.getState()
      ctx.clearRect(0, 0, size, size)
      ctx.fillStyle = tokens.surface
      ctx.fillRect(0, 0, size, size)
      ctx.lineJoin = 'miter'

      // Corredores
      for (const c of layout.corridors) {
        ctx.fillStyle = DEFAULT_THEME.scene.corridor.floor
        ctx.fillRect(tx(c.floor.x - c.floor.w / 2), tz(c.floor.z - c.floor.d / 2), c.floor.w * k, c.floor.d * k)
      }

      // Salas
      for (const r of layout.rooms) {
        const active = r.id === currentRoomId
        const x = tx(r.x - r.w / 2)
        const z = tz(r.z - r.d / 2)
        ctx.fillStyle = palettes[r.index].wall
        ctx.fillRect(x, z, r.w * k, r.d * k)
        ctx.strokeStyle = tokens.ink
        ctx.lineWidth = active ? 3 : 1
        ctx.strokeRect(x, z, r.w * k, r.d * k)

        // Elementos / Pedestales
        for (const p of r.pedestals) {
          const done = !!memorized[p.concept.id]
          const kind = getEntityKind(p.concept.id, p.concept.title)
          const px = tx(p.x)
          const pz = tz(p.z)

          ctx.save()
          ctx.translate(px, pz)

          if (kind === 'key') {
            // Llave: rombo dorado
            ctx.fillStyle = '#ECC94B'
            ctx.strokeStyle = tokens.ink
            ctx.lineWidth = 1.2
            const rKey = expanded ? 6 : 4
            ctx.beginPath()
            ctx.moveTo(0, -rKey)
            ctx.lineTo(rKey, 0)
            ctx.lineTo(0, rKey)
            ctx.lineTo(-rKey, 0)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
          } else if (kind === 'chest') {
            // Cofre: caja dorada
            ctx.fillStyle = '#D69E2E'
            ctx.strokeStyle = tokens.ink
            ctx.lineWidth = 1.2
            const sChest = expanded ? 10 : 7
            ctx.fillRect(-sChest / 2, -sChest / 2, sChest, sChest)
            ctx.strokeRect(-sChest / 2, -sChest / 2, sChest, sChest)
          } else if (kind === 'trap') {
            // Trampa de púas: triángulo de peligro rojo
            ctx.fillStyle = '#E53E3E'
            ctx.strokeStyle = tokens.ink
            ctx.lineWidth = 1.2
            const rTrap = expanded ? 7 : 4.5
            ctx.beginPath()
            ctx.moveTo(0, -rTrap)
            ctx.lineTo(rTrap, rTrap)
            ctx.lineTo(-rTrap, rTrap)
            ctx.closePath()
            ctx.fill()
            ctx.stroke()
          } else if (kind === 'door') {
            // Compuerta: portal circular cian
            ctx.fillStyle = '#319795'
            ctx.strokeStyle = tokens.ink
            ctx.lineWidth = 1.2
            const rDoor = expanded ? 6 : 4
            ctx.beginPath()
            ctx.arc(0, 0, rDoor, 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
          } else {
            // Estándar
            ctx.fillStyle = done ? tokens.accent : tokens.surface
            ctx.strokeStyle = tokens.ink
            ctx.lineWidth = 1
            ctx.beginPath()
            ctx.arc(0, 0, done ? (expanded ? 4.5 : 3.2) : (expanded ? 3.5 : 2.4), 0, Math.PI * 2)
            ctx.fill()
            ctx.stroke()
          }

          ctx.restore()
        }
      }

      // Jugador: flecha de tinta con borde de yeso, apuntando a donde mira
      const px = tx(playerPose.x)
      const pz = tz(playerPose.z)
      const a = playerPose.yaw
      ctx.fillStyle = tokens.ink
      ctx.strokeStyle = tokens.surface
      ctx.lineWidth = 2
      ctx.beginPath()
      const arrowLen = expanded ? 12 : 8
      const wingLen = expanded ? 9 : 6
      ctx.moveTo(px + Math.sin(a) * arrowLen, pz + Math.cos(a) * arrowLen)
      ctx.lineTo(px + Math.sin(a + 2.5) * wingLen, pz + Math.cos(a + 2.5) * wingLen)
      ctx.lineTo(px + Math.sin(a - 2.5) * wingLen, pz + Math.cos(a - 2.5) * wingLen)
      ctx.closePath()
      ctx.stroke()
      ctx.fill()

      raf = requestAnimationFrame(draw)
    }

    draw()
    return () => cancelAnimationFrame(raf)
  }, [layout, size, expanded])

  return (
    <div className="minimap-wrapper">
      <div className="minimap-header">
        <button
          type="button"
          className="minimap-toggle"
          onClick={() => setExpanded(!expanded)}
          title={expanded ? 'Contraer minimapa' : 'Desplegar minimapa'}
        >
          {expanded ? '⤡ Contraer' : '⤢ Desplegar'}
        </button>
      </div>
      <canvas
        ref={canvas}
        className="minimap"
        style={{ width: size, height: size }}
        onClick={() => setExpanded(!expanded)}
        title={expanded ? 'Haz clic para contraer' : 'Haz clic para desplegar minimapa'}
        aria-label="Minimapa"
      />
      {expanded && (
        <div className="minimap-legend">
          <span><i className="legend-chip" style={{ background: '#ECC94B' }} /> Llave</span>
          <span><i className="legend-chip" style={{ background: '#D69E2E' }} /> Cofre</span>
          <span><i className="legend-chip" style={{ background: '#E53E3E' }} /> Trampa</span>
          <span><i className="legend-chip" style={{ background: '#319795' }} /> Puerta</span>
        </div>
      )}
    </div>
  )
}
