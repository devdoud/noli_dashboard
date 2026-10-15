// Envoi d'un fichier vers le lien à usage unique de Cloudflare (spec 0006, AC-7) : envoi simple
// (multipart, champ « file ») jusqu'à 200 Mo, protocole tus au delà. Aucun jeton n'est envoyé.
import { Upload } from 'tus-js-client'

export type TransportFailure = 'refused' | 'network' | 'aborted'

export class TransportError extends Error {
  readonly failure: TransportFailure
  readonly status: number | undefined

  constructor(failure: TransportFailure, status?: number) {
    super(`Envoi ${failure}${status === undefined ? '' : ` ${String(status)}`}`)
    this.name = 'TransportError'
    this.failure = failure
    this.status = status
  }
}

export interface RunningTransfer {
  readonly done: Promise<void>
  readonly abort: () => void
}

export type ProgressListener = (sentBytes: number, totalBytes: number) => void

const TUS_CHUNK_SIZE = 50 * 1024 * 1024

export function sendBasic(
  file: File,
  uploadUrl: string,
  onProgress: ProgressListener,
): RunningTransfer {
  const xhr = new XMLHttpRequest()
  const done = new Promise<void>((resolve, reject) => {
    xhr.upload.onprogress = (event) => {
      if (event.lengthComputable) onProgress(event.loaded, event.total)
    }
    xhr.onload = () => {
      // Cloudflare répond 200 sans corps utile : il n'est pas lu.
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else
        reject(
          new TransportError(
            xhr.status >= 400 && xhr.status < 500 ? 'refused' : 'network',
            xhr.status,
          ),
        )
    }
    xhr.onerror = () => {
      reject(new TransportError('network'))
    }
    xhr.onabort = () => {
      reject(new TransportError('aborted'))
    }
    const body = new FormData()
    body.append('file', file)
    xhr.open('POST', uploadUrl)
    xhr.send(body)
  })
  return {
    done,
    abort: () => {
      xhr.abort()
    },
  }
}

export function sendTus(
  file: File,
  uploadUrl: string,
  onProgress: ProgressListener,
): RunningTransfer {
  const state: { upload?: Upload; reject?: (error: TransportError) => void } = {}
  const done = new Promise<void>((resolve, reject) => {
    state.reject = reject
    const upload = new Upload(file, {
      // Le lien existe déjà (créé par le backend) : le client reprend où Cloudflare en est.
      uploadUrl,
      chunkSize: TUS_CHUNK_SIZE,
      retryDelays: [0, 3000, 10_000, 30_000],
      storeFingerprintForResuming: false,
      onProgress: (sent, total) => {
        onProgress(sent, total)
      },
      onSuccess: () => {
        resolve()
      },
      onError: (error) => {
        const status =
          'originalResponse' in error && error.originalResponse !== null
            ? error.originalResponse.getStatus()
            : undefined
        reject(
          new TransportError(
            status !== undefined && status >= 400 && status < 500 ? 'refused' : 'network',
            status,
          ),
        )
      },
    })
    state.upload = upload
    upload.start()
  })
  return {
    done,
    abort: () => {
      void state.upload?.abort(false)
      state.reject?.(new TransportError('aborted'))
    },
  }
}
