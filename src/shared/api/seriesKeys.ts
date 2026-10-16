/**
 * Clé de cache des pages de la liste des séries (spec 0004), partagée pour que d'autres
 * fonctionnalités (les catégories, spec 0008) la relisent sans importer la fonctionnalité Séries.
 */
export const seriesListsKey = ['series', 'list'] as const

/**
 * Chiffres de la vue d'ensemble (spec 0010), rangés sous le préfixe des listes : chaque
 * invalidation des listes (séries, épisodes, vidéos, catégories) les rend aussi périmés.
 * Pas de collision avec une page de liste, dont le troisième élément est toujours un nombre.
 */
export const seriesStatsKey = [...seriesListsKey, 'stats'] as const
