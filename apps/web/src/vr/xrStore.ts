import { createXRStore } from '@react-three/xr'
import { parseVrFlag } from './mode'

// Una sola tienda WebXR para toda la página. Sin mandos ni manos dibujados: el modo VR se maneja con la mirada
// (y cualquier pulsación `select`), así que no se descarga nada de la CDN de perfiles de controles.
// `emulate` solo se activa con ?vr=xr (pruebas en escritorio con el emulador de dispositivo).
export const xrStore = createXRStore({
  emulate: parseVrFlag(window.location.search) === 'xr' ? 'metaQuest3' : false,
  offerSession: false,
  enterGrantedSession: false,
  controller: false,
  hand: false,
  transientPointer: false,
  gaze: false,
  screenInput: false,
  // Solo lo imprescindible: cada función opcional puede disparar un permiso en el navegador del teléfono.
  anchors: false,
  handTracking: false,
  layers: false,
  meshDetection: false,
  planeDetection: false,
  hitTest: false,
  domOverlay: false,
  frameBufferScaling: 0.8, // el teléfono dibuja dos vistas: algo menos de resolución mantiene los fps
})
