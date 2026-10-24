import { useEffect, useState } from 'react'

/** Hash de la página del equipo, aparte de la landing. */
export const TEAM_HASH = '#equipo'

/** El hash actual de la URL (p. ej. "#equipo"); se actualiza con los links y con atrás/adelante. */
export function useHash(): string {
  const [hash, setHash] = useState(() => window.location.hash)
  useEffect(() => {
    const onChange = () => setHash(window.location.hash)
    window.addEventListener('hashchange', onChange)
    return () => window.removeEventListener('hashchange', onChange)
  }, [])
  return hash
}
