import { useStore } from 'zustand'
import { arisConversation } from '../palace/arisConversationRuntime'

/** Señal de que el micrófono está abierto (y lo que se va oyendo), más los avisos breves de la conversación. */
export function ArisVoicePill() {
  const listening = useStore(arisConversation.store, (s) => s.listening)
  const interim = useStore(arisConversation.store, (s) => s.interim)
  const notice = useStore(arisConversation.store, (s) => s.notice)
  if (!listening && !notice) return null
  return (
    <div className="aris-voice-pill" role="status" aria-live="polite">
      {listening ? (
        <>
          <span className="aris-voice-dot" aria-hidden="true" />
          <span className="aris-voice-text">{interim || 'Te escucho…'}</span>
          <span className="aris-voice-hint">
            <kbd>T</kbd> apagar · <kbd>Shift+T</kbd> escribir
          </span>
        </>
      ) : (
        <span className="aris-voice-text">{notice}</span>
      )}
    </div>
  )
}
