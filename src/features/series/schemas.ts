// Réponse de GET /series/admin (specs 0004 et 0009, « Schéma de réponse »). Schéma tolérant : un champ
// d'affichage absent ou null ne fait pas échouer toute la page.
import { z } from 'zod'
import type { Category } from '@/shared/api/categories'

const count = z
  .number()
  .int()
  .min(0)
  .nullish()
  .transform((value) => value ?? 0)

export const seriesSummarySchema = z.object({
  _id: z.string(),
  title: z.string(),
  coverImage: z.string().nullish(),
  // La route admin (spec 0009) donne aussi les catégories masquées, avec isVisible ; absent = visible.
  categories: z
    .array(z.object({ _id: z.string(), name: z.string(), isVisible: z.boolean().optional() }))
    .nullish()
    .transform((value) => value ?? []),
  // 'ongoing' | 'completed' attendus ; toute autre valeur s'affiche « — ».
  status: z.string().nullish(),
  isPremium: z
    .boolean()
    .nullish()
    .transform((value) => value ?? false),
  freeEpisodeCount: count,
  totalEpisodes: count,
  rating: z
    .number()
    .nullish()
    .transform((value) => value ?? 0),
  votes: count,
  updatedAt: z.string().nullish(),
})

export const seriesPageSchema = z.object({
  data: z.object({
    total: z.number().int().min(0),
    page: z.number().int(),
    limit: z.number().int(),
    series: z.array(seriesSummarySchema),
  }),
})

export type SeriesSummary = z.infer<typeof seriesSummarySchema>
export type SeriesPage = z.infer<typeof seriesPageSchema>

// Épisode dans la réponse admin (spec 0006, « Données ») : tolérant, la vidéo décrite par son état.
export const adminEpisodeVideoSchema = z.object({
  status: z.string(),
  pendingStreamUid: z.string().nullish(),
  pendingStatus: z.string().nullish(),
  pendingError: z.string().nullish(),
  pendingExpiresAt: z.string().nullish(),
  hasPastedUrl: z
    .boolean()
    .nullish()
    .transform((value) => value ?? false),
})

export const adminEpisodeSchema = z.object({
  seasonNumber: z.number().int(),
  episodeNumber: z.number().int(),
  title: z.string(),
  description: z.string().nullish(),
  duration: z.number().nullish(),
  releaseDate: z.string().nullish(),
  isFree: z
    .boolean()
    .nullish()
    .transform((value) => value ?? false),
  video: adminEpisodeVideoSchema.nullish(),
  /** Vignette 16:9 (spec 0007) : URL, ou null sans vignette. */
  thumbnail: z.string().nullish(),
})

// Réponses admin d'une série (spec 0005, « Data model sketch ») : mêmes champs tolérants, plus ceux
// de la fiche. Les catégories masquées y figurent avec isVisible (prérequis backend) ; les épisodes,
// non déclarés, sont retirés par Zod et ne restent pas dans le cache.
export const adminSeriesSchema = seriesSummarySchema.extend({
  categories: z
    .array(
      z.object({
        _id: z.string(),
        name: z.string(),
        isVisible: z
          .boolean()
          .nullish()
          .transform((value) => value ?? true),
      }),
    )
    .nullish()
    .transform((value) => value ?? []),
  description: z.string().nullish(),
  country: z.string().nullish(),
  bannerImage: z.string().nullish(),
  languages: z
    .array(z.string())
    .nullish()
    .transform((value) => value ?? []),
  releaseYear: z.number().nullish(),
  createdAt: z.string().nullish(),
  episodes: z
    .array(adminEpisodeSchema)
    .nullish()
    .transform((value) => value ?? []),
})

export const adminSeriesResponseSchema = z.object({ series: adminSeriesSchema })

export const deleteSeriesResponseSchema = z.object({ message: z.string().optional() })

export type AdminSeries = z.infer<typeof adminSeriesSchema>
/** Une catégorie telle que le formulaire de série la propose (sous ensemble de la liste partagée). */
export type CategoryOption = Pick<Category, '_id' | 'name' | 'isVisible'>

// Routes vidéo d'un épisode (spec 0006) : le champ message est retiré par Zod.
export const videoUploadLinkSchema = z.object({
  method: z.enum(['post', 'tus']),
  uploadUrl: z.string(),
  uid: z.string(),
  expiresAt: z.string(),
})

export const videoImportSchema = z.object({
  uid: z.string(),
  pendingStatus: z.string(),
})

export type AdminEpisode = z.infer<typeof adminEpisodeSchema>
export type VideoUploadLink = z.infer<typeof videoUploadLinkSchema>
