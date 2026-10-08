/**
 * Configuration lue au démarrage (spec 0002, AC-2).
 * Les variables VITE_ sont intégrées au code envoyé au navigateur : jamais de secret ici.
 */
import { z } from 'zod'

const envSchema = z.object({
  VITE_API_BASE_URL: z.url({ protocol: /^https?$/ }),
})

export interface AppEnv {
  readonly apiBaseUrl: string
}

export type EnvResult =
  | { readonly ok: true; readonly env: AppEnv }
  | { readonly ok: false; readonly variable: string; readonly reason: string }

export function parseEnv(raw: Readonly<Record<string, unknown>>): EnvResult {
  const result = envSchema.safeParse(raw)
  if (!result.success) {
    const value = raw.VITE_API_BASE_URL
    return {
      ok: false,
      variable: 'VITE_API_BASE_URL',
      reason:
        value === undefined || value === ''
          ? 'La variable est absente.'
          : 'La valeur doit être une adresse http:// ou https:// valide.',
    }
  }
  return {
    ok: true,
    env: { apiBaseUrl: result.data.VITE_API_BASE_URL.replace(/\/+$/, '') },
  }
}

export const envResult: EnvResult = parseEnv(import.meta.env)
