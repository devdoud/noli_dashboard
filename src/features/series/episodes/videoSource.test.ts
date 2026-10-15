import { EPISODE_MESSAGES } from '@/features/series/episodes/episodeForm'
import {
  EMPTY_VIDEO_DRAFT,
  hasDraftErrors,
  hasVideo,
  MAX_VIDEO_BYTES,
  MAX_VIDEO_SECONDS,
  VIDEO_FILE_MESSAGES,
  videoDraftErrors,
  videoFileError,
  type VideoDraft,
} from '@/features/series/episodes/videoSource'

function fileOf(type: string, size = 1024): File {
  const file = new File([new Uint8Array(4)], 'video.mp4', { type })
  Object.defineProperty(file, 'size', { value: size })
  return file
}

describe('videoFileError (AC-3)', () => {
  it('accepte une vidéo dans les limites', () => {
    expect(videoFileError(fileOf('video/mp4'), 3600)).toBeUndefined()
  })

  it('accepte exactement 30 Go et 3 heures', () => {
    expect(videoFileError(fileOf('video/mp4', MAX_VIDEO_BYTES), MAX_VIDEO_SECONDS)).toBeUndefined()
  })

  it('refuse un fichier de plus de 30 Go', () => {
    expect(videoFileError(fileOf('video/mp4', MAX_VIDEO_BYTES + 1), undefined)).toBe(
      VIDEO_FILE_MESSAGES.tooHeavy,
    )
    expect(VIDEO_FILE_MESSAGES.tooHeavy).toBe('Fichier trop lourd : 30 Go au plus.')
  })

  it('refuse une vidéo de plus de 3 heures quand sa durée est lisible', () => {
    expect(videoFileError(fileOf('video/mp4'), MAX_VIDEO_SECONDS + 1)).toBe(
      'Vidéo trop longue : 3 heures au plus.',
    )
  })

  it('ne contrôle pas la durée quand elle est illisible', () => {
    expect(videoFileError(fileOf('video/mp4'), undefined)).toBeUndefined()
  })

  it('refuse un fichier qui n’est pas une vidéo, accepte un type vide', () => {
    expect(videoFileError(fileOf('image/png'), undefined)).toBe(VIDEO_FILE_MESSAGES.notVideo)
    expect(videoFileError(fileOf(''), undefined)).toBeUndefined()
  })
})

describe('videoDraftErrors et hasVideo (AC-2, AC-3)', () => {
  const withFile: VideoDraft = { tab: 'file', link: '', file: fileOf('video/mp4') }

  it('ne demande rien quand la vidéo est facultative et absente', () => {
    expect(videoDraftErrors(EMPTY_VIDEO_DRAFT, false)).toEqual({})
    expect(videoDraftErrors({ tab: 'link', link: '  ' }, false)).toEqual({})
    expect(hasVideo(EMPTY_VIDEO_DRAFT)).toBe(false)
  })

  it('exige un fichier ou un lien pour un lancement direct', () => {
    expect(videoDraftErrors(EMPTY_VIDEO_DRAFT, true)).toEqual({
      file: VIDEO_FILE_MESSAGES.required,
    })
    expect(videoDraftErrors({ tab: 'link', link: '' }, true)).toEqual({
      link: EPISODE_MESSAGES.link,
    })
  })

  it('ne juge que l’onglet affiché', () => {
    const fileThenLink: VideoDraft = { ...withFile, tab: 'link', link: 'http://non.sur/v.mp4' }

    expect(videoDraftErrors(fileThenLink, false)).toEqual({ link: EPISODE_MESSAGES.link })
    expect(hasVideo(fileThenLink)).toBe(true)
    expect(hasVideo({ ...fileThenLink, link: '' })).toBe(false)
  })

  it('reprend la durée lue du fichier', () => {
    expect(videoDraftErrors({ ...withFile, fileSeconds: MAX_VIDEO_SECONDS + 60 }, false)).toEqual({
      file: VIDEO_FILE_MESSAGES.tooLong,
    })
  })

  it('accepte un lien https valide', () => {
    expect(videoDraftErrors({ tab: 'link', link: 'https://cdn.exemple.com/v.mp4' }, true)).toEqual(
      {},
    )
  })

  it('repère la présence d’une erreur', () => {
    expect(hasDraftErrors({})).toBe(false)
    expect(hasDraftErrors({ link: EPISODE_MESSAGES.link })).toBe(true)
  })
})
