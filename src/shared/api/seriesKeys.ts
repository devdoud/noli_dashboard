/**
 * Clé de cache des pages de la liste des séries (spec 0004), partagée pour que d'autres
 * fonctionnalités (les catégories, spec 0008) la relisent sans importer la fonctionnalité Séries.
 */
export const seriesListsKey = ['series', 'list'] as const
