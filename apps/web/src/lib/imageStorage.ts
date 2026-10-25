/**
 * Almacenamiento local persistente para imágenes subidas por el usuario usando IndexedDB.
 * Permite persistir Data URLs grandes (decenas de MB) sin topar con el límite de 5 MB de localStorage.
 * Si IndexedDB no está disponible (modo privado restrictivo o SSR), degrada elegantemente a un Map en memoria.
 */

const DB_NAME = 'mus3o-db'
const DB_VERSION = 1
const STORE_NAME = 'user-images'

let dbPromise: Promise<IDBDatabase | null> | null = null
const memoryFallback = new Map<string, string>()

function isIndexedDBAvailable(): boolean {
  return typeof window !== 'undefined' && 'indexedDB' in window && window.indexedDB !== null
}

function openDatabase(): Promise<IDBDatabase | null> {
  if (!isIndexedDBAvailable()) return Promise.resolve(null)
  if (dbPromise) return dbPromise

  dbPromise = new Promise<IDBDatabase | null>((resolve) => {
    try {
      const request = window.indexedDB.open(DB_NAME, DB_VERSION)

      request.onupgradeneeded = (event) => {
        const db = (event.target as IDBOpenDBRequest).result
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME)
        }
      }

      request.onsuccess = () => resolve(request.result)
      request.onerror = () => {
        console.warn('No se pudo abrir IndexedDB para imágenes de usuario. Usando memoria.')
        resolve(null)
      }
      request.onblocked = () => {
        console.warn('Apertura de IndexedDB bloqueada.')
        resolve(null)
      }
    } catch {
      resolve(null)
    }
  })

  return dbPromise
}

/**
 * Guarda una colección de imágenes del usuario { [imageId]: dataUrl } en IndexedDB.
 */
export async function saveUserImages(images: Record<string, string>): Promise<void> {
  const entries = Object.entries(images)
  if (entries.length === 0) return

  for (const [id, url] of entries) {
    memoryFallback.set(id, url)
  }

  const db = await openDatabase()
  if (!db) return

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)

      for (const [id, url] of entries) {
        store.put(url, id)
      }

      tx.oncomplete = () => resolve()
      tx.onerror = () => resolve()
      tx.onabort = () => resolve()
    } catch {
      resolve()
    }
  })
}

/**
 * Carga imágenes de usuario por ID (o todas si no se especifica lista de IDs).
 */
export async function loadUserImages(ids?: string[]): Promise<Record<string, string>> {
  const result: Record<string, string> = {}

  // Si hay datos en el fallback de memoria, tomarlos de base
  if (ids) {
    for (const id of ids) {
      const val = memoryFallback.get(id)
      if (val) result[id] = val
    }
  } else {
    for (const [id, val] of memoryFallback.entries()) {
      result[id] = val
    }
  }

  const db = await openDatabase()
  if (!db) return result

  return new Promise<Record<string, string>>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const store = tx.objectStore(STORE_NAME)

      if (ids && ids.length > 0) {
        let remaining = ids.length
        for (const id of ids) {
          const req = store.get(id)
          req.onsuccess = () => {
            if (typeof req.result === 'string') {
              result[id] = req.result
              memoryFallback.set(id, req.result)
            }
            remaining--
            if (remaining <= 0) resolve(result)
          }
          req.onerror = () => {
            remaining--
            if (remaining <= 0) resolve(result)
          }
        }
      } else {
        const req = store.openCursor()
        req.onsuccess = (e) => {
          const cursor = (e.target as IDBRequest<IDBCursorWithValue | null>).result
          if (cursor) {
            const key = String(cursor.key)
            if (typeof cursor.value === 'string') {
              result[key] = cursor.value
              memoryFallback.set(key, cursor.value)
            }
            cursor.continue()
          } else {
            resolve(result)
          }
        }
        req.onerror = () => resolve(result)
      }
    } catch {
      resolve(result)
    }
  })
}

/**
 * Limpia todas las imágenes guardadas en IndexedDB.
 */
export async function clearUserImages(): Promise<void> {
  memoryFallback.clear()
  const db = await openDatabase()
  if (!db) return

  return new Promise<void>((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readwrite')
      const store = tx.objectStore(STORE_NAME)
      const req = store.clear()
      req.onsuccess = () => resolve()
      req.onerror = () => resolve()
    } catch {
      resolve()
    }
  })
}
