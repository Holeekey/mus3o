import { describe, it, expect, beforeEach } from 'vitest'
import { saveUserImages, loadUserImages, clearUserImages } from './imageStorage'

describe('imageStorage', () => {
  beforeEach(async () => {
    await clearUserImages()
  })

  it('guarda y recupera imágenes de usuario correctamente', async () => {
    const mockImages = {
      'img-1': 'data:image/jpeg;base64,mock1',
      'img-2': 'data:image/jpeg;base64,mock2',
    }

    await saveUserImages(mockImages)
    const loaded = await loadUserImages(['img-1', 'img-2'])

    expect(loaded['img-1']).toBe('data:image/jpeg;base64,mock1')
    expect(loaded['img-2']).toBe('data:image/jpeg;base64,mock2')
  })

  it('carga todas las imágenes cuando no se especifican IDs', async () => {
    const mockImages = {
      'img-a': 'data:image/jpeg;base64,aaa',
      'img-b': 'data:image/jpeg;base64,bbb',
    }

    await saveUserImages(mockImages)
    const all = await loadUserImages()

    expect(all['img-a']).toBe('data:image/jpeg;base64,aaa')
    expect(all['img-b']).toBe('data:image/jpeg;base64,bbb')
  })

  it('devuelve objeto vacío cuando no existen las imágenes solicitadas', async () => {
    const loaded = await loadUserImages(['non-existent'])
    expect(loaded['non-existent']).toBeUndefined()
  })

  it('limpia todas las imágenes con clearUserImages', async () => {
    await saveUserImages({ 'img-to-clear': 'data:image/jpeg;base64,clear' })
    await clearUserImages()
    const loaded = await loadUserImages(['img-to-clear'])
    expect(loaded['img-to-clear']).toBeUndefined()
  })
})
