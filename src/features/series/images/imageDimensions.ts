// Dimensions d'une image choisie (spec 0007, AC-3), lues par le navigateur sur son adresse blob:.
import type { ImageDimensions } from '@/features/series/images/imageRules'

/**
 * Décode l'image dans un élément `img` : `naturalWidth` et `naturalHeight` tiennent compte de la
 * rotation EXIF, comme le backend (`createImageBitmap` ne l'applique pas par défaut).
 * Renvoie undefined si l'image est illisible.
 */
export function readImageDimensions(url: string): Promise<ImageDimensions | undefined> {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => {
      resolve({ width: image.naturalWidth, height: image.naturalHeight })
    }
    image.onerror = () => {
      resolve(undefined)
    }
    image.src = url
  })
}
