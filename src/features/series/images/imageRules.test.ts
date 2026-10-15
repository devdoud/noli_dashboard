import {
  checkDimensions,
  checkFileBasics,
  checkImageFile,
  IMAGE_MESSAGES,
  IMAGE_SLOTS,
  imageErrorMessage,
  isHostedImage,
  MAX_IMAGE_BYTES,
} from '@/features/series/images/imageRules'
import { ApiError } from '@/shared/api/errors'

function fileOf(name: string, type: string, size = 1024): File {
  const file = new File([new Uint8Array(4)], name, { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

const cover = IMAGE_SLOTS.cover

describe('checkFileBasics : format et poids (AC-3)', () => {
  it.each([
    ['photo.jpg', 'image/jpeg'],
    ['photo.png', 'image/png'],
    ['photo.webp', 'image/webp'],
    ['photo.webp', ''],
    ['PHOTO.JPEG', ''],
  ])('accepte %s (%s)', (name, type) => {
    expect(checkFileBasics(fileOf(name, type))).toBeUndefined()
  })

  it.each([
    ['anim.gif', 'image/gif'],
    ['photo.heic', 'image/heic'],
    ['doc.pdf', 'application/pdf'],
  ])('refuse %s', (name, type) => {
    expect(checkFileBasics(fileOf(name, type))).toBe(IMAGE_MESSAGES.format)
  })

  it('accepte exactement 5 Mo et refuse au delà', () => {
    expect(checkFileBasics(fileOf('a.png', 'image/png', MAX_IMAGE_BYTES))).toBeUndefined()
    expect(checkFileBasics(fileOf('a.png', 'image/png', MAX_IMAGE_BYTES + 1))).toBe(
      'Image trop lourde : 5 Mo au plus.',
    )
  })

  it('juge le format avant le poids', () => {
    expect(checkFileBasics(fileOf('a.gif', 'image/gif', MAX_IMAGE_BYTES * 2))).toBe(
      IMAGE_MESSAGES.format,
    )
  })
})

describe('checkDimensions : lisibilité, proportion, mégapixels, minimum (AC-3)', () => {
  it('accepte une couverture au minimum exact', () => {
    expect(checkDimensions({ width: 400, height: 600 }, cover)).toBeUndefined()
  })

  it('refuse une image illisible', () => {
    expect(checkDimensions(undefined, cover)).toBe(IMAGE_MESSAGES.unreadable)
    expect(checkDimensions({ width: 0, height: 600 }, cover)).toBe(IMAGE_MESSAGES.unreadable)
  })

  it('refuse une image plus étirée que 5 pour 1, accepte 5 pour 1', () => {
    expect(checkDimensions({ width: 3001, height: 600 }, cover)).toBe(IMAGE_MESSAGES.stretched)
    expect(checkDimensions({ width: 3000, height: 600 }, cover)).toBeUndefined()
  })

  it('refuse plus de 25 mégapixels', () => {
    expect(checkDimensions({ width: 7000, height: 4000 }, cover)).toBe(IMAGE_MESSAGES.tooBig)
  })

  it('refuse une image trop petite avec les valeurs de l’emplacement et du fichier', () => {
    expect(checkDimensions({ width: 300, height: 450 }, cover)).toBe(
      'Image trop petite : 400 × 600 px au moins (reçue : 300 × 450).',
    )
    expect(checkDimensions({ width: 1280, height: 700 }, IMAGE_SLOTS.banner)).toBe(
      'Image trop petite : 1280 × 720 px au moins (reçue : 1280 × 700).',
    )
  })

  it('juge la proportion avant le minimum', () => {
    expect(checkDimensions({ width: 100, height: 600 }, cover)).toBe(IMAGE_MESSAGES.stretched)
  })

  it('a les minimums de chaque emplacement', () => {
    expect(IMAGE_SLOTS.thumbnail).toMatchObject({ minWidth: 640, minHeight: 360 })
    expect(checkDimensions({ width: 640, height: 360 }, IMAGE_SLOTS.thumbnail)).toBeUndefined()
  })
})

describe('checkImageFile (AC-3)', () => {
  it('enchaîne les contrôles du fichier puis des dimensions', () => {
    expect(checkImageFile(fileOf('a.gif', 'image/gif'), undefined, cover)).toBe(
      IMAGE_MESSAGES.format,
    )
    expect(checkImageFile(fileOf('a.png', 'image/png'), undefined, cover)).toBe(
      IMAGE_MESSAGES.unreadable,
    )
    expect(
      checkImageFile(fileOf('a.png', 'image/png'), { width: 800, height: 1200 }, cover),
    ).toBeUndefined()
  })
})

describe('isHostedImage (AC-7)', () => {
  it.each([
    ['https://res.cloudinary.com/noli/image/upload/v1/x.jpg', true],
    ['https://picsum.photos/400/600', false],
    ['https://res.cloudinary.com.evil.test/x.jpg', false],
    ['pas une adresse', false],
  ])('%s → %s', (url, expected) => {
    expect(isHostedImage(url)).toBe(expected)
  })
})

describe('imageErrorMessage (AC-8)', () => {
  const http = (status: number, backendMessage?: string | readonly string[]) =>
    new ApiError({
      kind: 'http',
      status,
      ...(backendMessage === undefined ? {} : { backendMessage }),
    })

  it.each([
    [http(413, 'File too large'), IMAGE_MESSAGES.heavy],
    [http(429), IMAGE_MESSAGES.limit],
    [http(503), IMAGE_MESSAGES.unavailable],
    [http(409), IMAGE_MESSAGES.conflict],
    [http(404), IMAGE_MESSAGES.seriesGone],
    [new ApiError({ kind: 'network' }), IMAGE_MESSAGES.network],
    [new ApiError({ kind: 'timeout' }), IMAGE_MESSAGES.network],
  ])('%s', (error, expected) => {
    expect(imageErrorMessage(error, cover)).toBe(expected)
  })

  it('vise l’épisode sur un 404 de la vignette', () => {
    expect(imageErrorMessage(http(404), IMAGE_SLOTS.thumbnail)).toBe(IMAGE_MESSAGES.episodeGone)
  })

  it('montre un message connu du backend, chaîne ou tableau', () => {
    expect(imageErrorMessage(http(415, 'Images animées non acceptées'), cover)).toBe(
      'Images animées non acceptées',
    )
    expect(imageErrorMessage(http(400, ['Image trop petite : 400 × 600 px au moins']), cover)).toBe(
      'Image trop petite : 400 × 600 px au moins',
    )
  })

  it('remplace un message inconnu ou anglais', () => {
    expect(imageErrorMessage(http(400, 'Unexpected field'), cover)).toBe(IMAGE_MESSAGES.refused)
    expect(imageErrorMessage(http(400), cover)).toBe(IMAGE_MESSAGES.refused)
  })

  it('reste silencieux en fin de session', () => {
    expect(imageErrorMessage(new ApiError({ kind: 'session-ended' }), cover)).toBeUndefined()
  })
})
