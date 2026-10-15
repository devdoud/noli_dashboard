# Verify: Fiche série · spec 0005 · updated 2026-10-14
_Steps derived from spec 0005 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

En local : `npm run dev` avec l'API locale (`noli-backend` sur `main`, qui contient le prérequis des catégories masquées) et le compte de démonstration `demo.admin@noli.test`. Les essais de création, modification et suppression se font **seulement en local**. En ligne : lecture seule, avec votre compte admin de production.

## UI / manual
- [x] Sur `/series?page=2`, « Nouvelle série » mène à `/series/nouvelle` ; un titre de ligne mène à `/series/<id>` → AC-1
- [x] La fiche ouverte depuis `/series?page=2` a un lien « Retour aux séries » vers `/series?page=2` ; ouverte directement, vers `/series` → AC-6 (valeur : page de retour)
- [x] `/series/nouvelle` : Titre, Description, Catégories, Statut « En cours », Langues, Pays, Année, section Accès avec « Série premium » décochée ; cocher fait apparaître « Épisodes gratuits » (0) et « La série a actuellement 0 épisode. » → AC-2 (valeurs de départ)
- [x] « Créer la série » sur un formulaire vide, année 1700, langue `FRA` → messages en français sous les champs, focus sur Titre, aucune requête `POST` → AC-3
- [x] Création valide → `POST /series` sans les champs vides, arrivée sur la nouvelle fiche, « Série créée. », la nouvelle série apparaît dans la liste → AC-4 (valeur : identifiant de la nouvelle fiche)
- [x] Titre déjà pris, à la création puis à la modification → « Ce titre est déjà utilisé par une autre série. » sous Titre, même page, saisie gardée → AC-5
- [x] Fiche : titre en en tête et dans l'onglet, couverture (ou bloc gris), épisodes, note « 8,6 (268) » ou « — », dates de création et de modification, formulaire prérempli → AC-6 (valeurs : aperçu, valeurs de départ)
- [x] `/series/abc` → « Série introuvable » sans requête ; un identifiant inconnu bien formé → « Série introuvable » → AC-6
- [x] Sans changement, « Enregistrer » est inactif ; changer seulement le pays → `PATCH` avec `{ "country": "…" }` seul, « Modifications enregistrées. », le bouton redevient inactif ; vider la description → `{ "description": null }` → AC-7 (valeur : champs envoyés)
- [x] Changer le titre → l'en tête affiche le nouveau titre après l'enregistrement → AC-7 (valeur : titre de l'en tête)
- [x] Vider l'année d'une série qui en a une → « L'année ne peut pas être retirée, seulement modifiée. », aucune requête → AC-3, AC-7
- [x] Décocher puis recocher « Série premium » → le nombre d'épisodes gratuits revient intact ; 12 gratuits sur 8 épisodes est accepté → AC-8 (valeur : « N épisodes »)
- [x] Une série dans une catégorie masquée (à créer en local) → la pastille « Nom (masquée) » apparaît ; changer seulement le titre ne retire pas la catégorie → AC-9 (valeur : mention « (masquée) »)
- [x] Couper le réseau vers `/categories/all` → « Impossible de charger les catégories. » avec « Réessayer » → AC-9
- [x] Langues : « Français (fr) » affiché, `fr` envoyé ; taper `dyu` puis Entrée ajoute « Dioula (dyu) » sans envoyer le formulaire ; une valeur ancienne « French » s'affiche telle quelle → AC-10 (valeur : noms affichés)
- [x] Pays : liste avec l'Afrique en tête, « Côte d’Ivoire » envoyé avec l'apostrophe typographique ; une valeur hors liste reste affichée et conservée → AC-11 (valeur : liste et noms)
- [x] Modifier le titre puis cliquer « Vue d'ensemble » → « Quitter sans enregistrer ? » ; « Rester » garde la saisie, « Quitter » part ; recharger l'onglet → alerte du navigateur ; après un enregistrement, aucune question → AC-12
- [x] Zone « Supprimer la série » → fenêtre listant épisodes, images et historique ; « Supprimer définitivement » inactif tant que le titre exact n'est pas retapé (la casse compte, les espaces en trop non) ; succès → `/series` et « Série supprimée. » → AC-13 (valeur : titre à retaper)
- [x] Double clic rapide sur « Enregistrer » ou « Créer la série » → une seule requête ; bouton « Enregistrement en cours » / « Création en cours » → AC-14
- [x] Tout le formulaire au clavier (Tab, flèches du statut, pastilles de langue, fenêtres) ; chaque erreur est lue avec son champ ; mode sombre lisible → AC-15
- [x] Sur `https://admin.nollli.com`, ouvrir la fiche d'une série existante et vérifier ses valeurs, **sans rien enregistrer** → AC-16

## Commands
- [x] Avec un token admin local : `GET /series/<id>/admin` renvoie `categories[].isVisible`, y compris pour une catégorie masquée → AC-9
- [x] `curl -s "https://api.nollli.com/series?page=1&limit=1"` → `200` (l'API redéployée répond) → AC-16
- [x] `npx vitest run` → toute la suite passe → AC-1 à AC-15
- [x] `npm run build` → build sans erreur → AC-16

## Acceptance-criteria coverage
- AC-1 liste · AC-2 valeurs de départ · AC-3 validation et focus · AC-4 création · AC-5 titre pris · AC-6 fiche et états · AC-7 champs modifiés · AC-8 accès · AC-9 catégories masquées · AC-10 langues · AC-11 pays · AC-12 changements non enregistrés · AC-13 suppression · AC-14 envoi unique et erreurs · AC-15 accessibilité · AC-16 production en lecture seule

## Notes
- Contrôlé pendant `/develop` (2026-10-14), dans le navigateur sur l'API locale : liste vers fiche, modification du pays seul (`PATCH {"country":"Togo"}`), protection des changements, validation et focus à la création, `409`, création (`POST` avec `fon` et 3 gratuits), suppression avec le titre retapé, identifiant mal formé. En ligne : `/series/nouvelle` redirige vers la connexion avec `retour`, sans erreur de console.
- Écarts d'implémentation, sans effet sur les critères : l'état « modifié » suit les champs changés (et pas seulement le contenu envoyé), pour que l'erreur d'une année vidée s'affiche ; les champs numériques ne corrigent plus une valeur hors limites en silence (`clampBehavior="none"`), pour afficher le message ; Entrée dans le champ Langues n'envoie jamais le formulaire.
- `/check verify` du 2026-10-14 : **FAIL**, 2 écarts. Build de production servi en local, API locale, série et catégorie masquée d'essai créées puis supprimées. (1) Pendant le chargement de `GET /categories/all`, les pastilles de catégories affichent les identifiants (`6ac0e77b…`) au lieu des noms, puis les noms une fois la liste reçue → étape AC-9 laissée ouverte. (2) Les boutons de retrait des pastilles de catégories (`MultiSelect`) n'ont pas de nom accessible → étape AC-15 laissée ouverte. Le reste passe ; l'alerte de fermeture d'onglet est prouvée par l'événement `beforeunload` annulé (Chrome sans interface n'affiche pas la boîte). La saisie d'une langue invalide (« FRA ») n'est pas possible par l'interface (le code est mis en minuscules) ; la règle est couverte par les tests unitaires.
- `/check verify` du 2026-10-14, après le correctif `93680a4` : **PASS**. Les noms des catégories s'affichent dès l'ouverture de la fiche (y compris « Vérif masquée (masquée) »), avant la liste complète ; chaque bouton de retrait de pastille porte « Retirer <nom> » (Mantine le cache aux lecteurs d'écran, le retrait au clavier passe par Retour arrière). Ordre au clavier, une fois les catégories chargées : Titre, Description, Catégories, Statut (flèches), Langues, Pays, Année, Premium, Épisodes gratuits, Supprimer la série. Les 33 autres contrôles du script passent à nouveau ; données d'essai supprimées.
