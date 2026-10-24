import { XR } from '@react-three/xr'
import { useEffect, type ReactNode } from 'react'
import { xrSessionEnded, xrSessionStarted } from './enter'
import { useVr, vrRuntime } from './runtime'
import { xrStore } from './xrStore'

/** Conecta la tienda WebXR con la escena de R3F y avisa al resto cuando la sesión empieza o termina. */
export default function XrBridge({ children }: { children: ReactNode }) {
  useEffect(() => {
    useVr.setState({ xrReady: true })
    // Solo en desarrollo: las pruebas con navegador (puppeteer) necesitan la misma tienda que usa la app.
    if (import.meta.env.DEV) Object.assign((globalThis as unknown as { __vr?: object }).__vr ?? {}, { xrStore })
    const onSelect = () => {
      vrRuntime.press = true
    }
    const unsub = xrStore.subscribe((state, prev) => {
      if (state.session && !prev.session) {
        state.session.addEventListener('select', onSelect)
        xrSessionStarted()
      } else if (!state.session && prev.session) {
        prev.session.removeEventListener('select', onSelect)
        xrSessionEnded()
      }
    })
    return () => {
      unsub()
      useVr.setState({ xrReady: false })
    }
  }, [])
  return <XR store={xrStore}>{children}</XR>
}
