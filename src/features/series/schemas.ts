// Réponse de GET /series (spec 0004, « Schéma de réponse »). Schéma tolérant : un champ
// d'affichage absent ou null ne fait pas échouer toute la page.
import { z } from 'zod'

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
  categories: z
    .array(z.object({ _id: z.string(), name: z.string() }))
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
