# Verify: vue d'ensemble · spec 0010 · updated 2026-10-16
_Steps derived from spec 0010 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Essais réels sur l'API locale lancée depuis la copie `../noli-backend-overview` (branche `feat/overview-stats`, base `noli_dev`, compte `demo.admin@noli.test`), puis contrôle en production en lecture seule. Sur `noli_dev` au 2026-10-16 : 12 séries, 72 épisodes, tous en ancien lien collé.

## UI / manual
- [ ] Ouvrir `/` → titre « Vue d'ensemble », trois tuiles dans l'ordre « Séries », « Épisodes », « Vidéos à traiter », avec les nombres de `GET /series/admin/stats` (12, 72, 72 sur `noli_dev`) → AC-1
- [ ] Tuile « Vidéos à traiter » → ligne de détail des seuls états non nuls (sur `noli_dev` : « 72 anciens liens ») → AC-2
- [ ] Cliquer « Séries » puis revenir, cliquer « Épisodes » → les deux mènent à `/series` → AC-3
- [ ] Cliquer « Vidéos à traiter » → `/series?videos=a-traiter`, « À traiter » coché dans « Vidéos », « 12 séries trouvées », chaque ligne montre « N vidéos à traiter » sous son titre → AC-3, AC-4, AC-5
- [ ] Sur `/series`, combiner « Vidéos : À traiter » avec une recherche et « Accès » → adresse `q`, `acces`, `videos` dans cet ordre, page 1, une entrée d'historique par choix, compte juste ; « Effacer les filtres » retire aussi `videos` et le compte des lignes → AC-4, AC-5
- [ ] Ouvrir `/series?videos=nimporte` → adresse `/series` sans nouvelle entrée, liste complète → AC-4
- [ ] Sans le filtre « À traiter », aucune ligne ne montre de compte de vidéos → AC-5
- [ ] Faire passer une vidéo à « Prête » dans une fiche (sur `noli_dev`, ou en simulant la réponse), revenir à l'accueil → chiffres à jour sans recharger la page ; revenir sur l'onglet après l'avoir quitté → les chiffres sont redemandés → AC-6
- [ ] Ralentir le réseau (outils du navigateur) → trois squelettes pendant le chargement ; couper l'API → message d'erreur et « Réessayer », qui réaffiche les tuiles une fois l'API revenue → AC-7
- [ ] Au clavier seul : Tab atteint chaque tuile lien avec un focus visible sur toute la tuile ; un lecteur d'écran lit « 72 vidéos à traiter, voir les séries concernées » ; « Vidéos » se règle aux flèches → AC-8
- [ ] Largeur 375 px → tuiles sur une colonne, filtres empilés, pas de défilement horizontal → AC-1, AC-8
- [ ] Les cartes « Séries et épisodes », « Images », « Catégories » n'existent plus sur l'accueil → AC-9
- [ ] Cas « Tout est prêt » : réponse simulée `videosToProcess.total = 0` (outils du navigateur, ou test `OverviewPage.test.tsx`) → « 0 » et « Tout est prêt », tuile non cliquable → AC-3, AC-8
- [ ] Production (lecture seule, après mise en ligne de l'API puis du dashboard) : les trois chiffres, le lien vers la liste filtrée et le compte dans les lignes sur https://admin.nollli.com → AC-11

## Commands
- [x] `npx jest src/series/video-status-query` (backend) → 17 tests de parité verts sur un vrai MongoDB en mémoire → AC-10
- [x] `npx jest` (backend) → toute la suite verte, `GET /series` et `GET /series/search` inchangés → AC-10
- [x] Script de contrôle en lecture seule sur `noli_dev` : comptes du pipeline = `adminVideoStatus` épisode par épisode, filtre `video=todo` = séries attendues, somme des comptes par ligne = total des stats → AC-10
- [ ] Non admin : `GET /series/admin/stats` avec le jeton d'un compte `user` → `403` ; sans jeton → `401` → AC-10
- [x] `npx vitest run` (dashboard) → toute la suite verte → AC-1 à AC-9

## Value sourcing
- [ ] Séries : `stats.series` égale le nombre de documents de la collection `series` (`countDocuments`) → AC-1
- [ ] Épisodes : `stats.episodes` égale la somme des épisodes de toutes les séries ; une série sans épisode ne compte pas → AC-1
- [ ] Vidéos à traiter : un épisode avec `streamUid` vide (`""`) compte comme à traiter, comme dans la fiche ; un épisode prêt avec un remplacement en erreur ne compte pas → AC-2
- [ ] Liens : les adresses viennent de la page (`/series`, `/series?videos=a-traiter`) → AC-3
- [ ] Compte par ligne : `videosToProcess` présent seulement avec `video=todo`, et égal au nombre d'épisodes « non prêts » de la fiche de la série → AC-5
- [ ] Fraîcheur : arriver sur `/` envoie toujours une requête `GET /series/admin/stats`, même juste après une visite → AC-6
- [ ] Format : un total au delà de 999 s'écrit avec une espace des milliers (`1 234`) → AC-1

## Acceptance-criteria coverage
- AC-1 : tuiles, nombres, format, écran étroit · AC-2 : détail par état · AC-3 : liens et « Tout est prêt » · AC-4 : filtre « Vidéos » · AC-5 : compte par ligne · AC-6 : fraîcheur · AC-7 : chargement et erreur · AC-8 : clavier, noms accessibles · AC-9 : cartes retirées · AC-10 : commandes backend, parité, `401`/`403` · AC-11 : production
