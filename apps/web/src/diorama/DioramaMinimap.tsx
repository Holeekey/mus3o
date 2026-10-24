import { DIORAMA_HALF } from '@mus3o/shared'
import { useEffect, useRef, useState } from 'react'
import { playerPose, useStore } from '../store'
import { DEFAULT_THEME } from '../theme'
import { useDioramaStore } from './dioramaStore'
import { getDioramaModel } from './model'

const COMPACT_SIZE = 180
const EXPANDED_SIZE = 340
const GATE_Z = 13.2 // marco de regreso (ver DioramaRuntime)

/**
 * Minimapa mientras se está dentro de un cuadro: el campo del diorama (± DIORAMA_HALF m), el agua,
 * los obstáculos, los props enlazados a conceptos y la flecha del jugador. DioramaRuntime escribe
 * la pose local en `playerPose`, la misma que lee el minimapa del palacio.
 */
export function DioramaMinimap() {
  const [expanded, setExpanded] = useState(false)
  const canvas = useRef<HTMLCanvasElement>(null)
  const size = expanded ? EXPANDED_SIZE : COMPACT_SIZE
  const diorama = useDioramaStore((s) => (s.activeId ? s.portals[s.activeId]?.diorama : undefined))

  useEffect(() => {
    const ctx = canvas.current?.getContext('2d')
    if (!ctx || !diorama) return
    const model = getDioramaModel(diorama)
    const dpr = window.devicePixelRatio || 1
    canvas.current!.width = size * dpr
    canvas.current!.height = size * dpr
    ctx.scale(dpr, dpr)

    const { tokens } = DEFAULT_THEME.ui
    const pad = expanded ? 22 : 14
    const span = DIORAMA_HALF * 2 + 2
    const k = (size - pad * 2) / span
    const tx = (x: number) => pad + (x + span / 2) * k
    const tz = (z: number) => pad + (z + span / 2) * k

    // Terreno y agua se pintan una sola vez en un lienzo aparte.
    const base = document.createElement('canvas')
    base.width = size
    base.height = size
    const b = base.getContext('2d')!
    b.fillStyle = diorama.palette.ground
    b.fillRect(tx(-span / 2), tz(-span / 2), span * k, span * k)
    const step = 0.7
    b.fillStyle = diorama.palette.sky
    for (let x = -DIORAMA_HALF; x < DIORAMA_HALF; x += step) {
      for (let z = -DIORAMA_HALF; z < DIORAMA_HALF; z += step) {
        if (model.field.isWater(x + step / 2, z + step / 2)) b.fillRect(tx(x), tz(z), step * k + 0.6, step * k + 0.6)
      }
    }
    b.fillStyle = 'rgba(31,20,17,0.35)'
    for (const c of model.layout.colliders) {
      b.beginPath()
      b.arc(tx(c.x), tz(c.z), Math.max(1, c.r * k * 0.7), 0, Math.PI * 2)
      b.fill()
    }
    b.strokeStyle = tokens.ink
    b.lineWidth = 2
    b.strokeRect(tx(-DIORAMA_HALF), tz(-DIORAMA_HALF), DIORAMA_HALF * 2 * k, DIORAMA_HALF * 2 * k)
    // marco de regreso
    b.fillStyle = tokens.accent
    b.fillRect(tx(-1.5), tz(GATE_Z - 0.35), 3 * k, 0.7 * k)

    let raf = 0
    const draw = () => {
      const { memorized } = useStore.getState()
      ctx.clearRect(0, 0, size, size)
      ctx.fillStyle = tokens.surface
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(base, 0, 0)

      // Props enlazados a conceptos: mismo código que las salas (relleno de acento = memorizado)
      for (const l of model.layout.linked) {
        const done = !!memorized[l.pieceId]
        ctx.fillStyle = done ? tokens.accent : tokens.surface
        ctx.strokeStyle = tokens.ink
        ctx.lineWidth = 1.2
        ctx.beginPath()
        ctx.arc(tx(l.x), tz(l.z), expanded ? 5 : 3.6, 0, Math.PI * 2)
        ctx.fill()
        ctx.stroke()
        if (expanded) {
          ctx.fillStyle = tokens.ink
          ctx.font = '10px sans-serif'
          ctx.textAlign = 'center'
          ctx.fillText(l.label, tx(l.x), tz(l.z) - 8)
        }
      }

      // Jugador: flecha de tinta con borde de yeso, igual que el minimapa del palacio
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
  }, [diorama, size, expanded])

  return (
    <div className="minimap-wrapper minimap-inline">
      <div className="minimap-header">
        <button type="button" className="minimap-toggle" onClick={() => setExpanded(!expanded)} title={expanded ? 'Contraer minimapa' : 'Desplegar minimapa'}>
          {expanded ? '⤡ Contraer' : '⤢ Desplegar'}
        </button>
      </div>
      <canvas
        ref={canvas}
        className="minimap"
        style={{ width: size, height: size }}
        onClick={() => setExpanded(!expanded)}
        title={expanded ? 'Haz clic para contraer' : 'Haz clic para desplegar minimapa'}
        aria-label="Minimapa del cuadro"
      />
    </div>
  )
}
