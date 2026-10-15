# 0006. Épisodes d'une série et envoi de leurs vidéos : raisonnement

## Context

La fiche série est en ligne (spec 0005) : on crée, modifie et supprime une série, mais ses épisodes et leurs vidéos ne se gèrent encore que par Swagger. La fonctionnalité 7 du scope parlait d'un « lien vidéo collé », et l'hébergement vidéo était classé dans la liste « Deferred » avec la note « le backend répond `503` ». Avant la construction, l'engineer a rappelé que l'admin doit normalement **envoyer** les vidéos : le backend a d'ailleurs sa propre spec d'hébergement (spec backend 0006), et Cloudflare Stream est configuré en production.

Le backend fournit les routes d'épisodes (ajout, modification des champs texte et de la durée, suppression) et l'hébergement complet : un lien d'envoi à usage unique (`post` jusqu'à 200 Mo, `tus` reprenable au delà, jusqu'à 30 Go et 3 heures), l'import depuis un lien `https`, la vérification de l'encodage (webhook signé, ou `refresh`), le retrait, et des liens de lecture signés qui expirent. Il a fait des choix explicites : `PATCH` n'accepte plus `videoUrl` (changer de vidéo passe par l'import), et aucune réponse ne contient le lien collé. Chaque écriture d'épisode renvoie la série admin complète. Le passage d'une vidéo à « Prête » publie l'épisode et met en file une annonce aux abonnés, qui ne s'annule pas. Un épisode sans vidéo jouable n'est ni gratuit ni premium. Envoi, import et vérification partagent une limite de 10 appels par 10 minutes.

Les admins sont 1 à 3 ; une série compte quelques dizaines d'épisodes de 20 à 60 minutes, soit souvent plusieurs centaines de Mo par fichier, sur des connexions parfois faibles.

## Options considered

### Option 1 : fiche, fenêtre, envoi direct à Cloudflare en arrière plan

Une section « Épisodes » sur la fiche ; une fenêtre pour les informations et la vidéo ; le navigateur envoie le fichier directement à Cloudflare par le lien à usage unique du backend (`XMLHttpRequest` pour `post`, `tus-js-client` pour `tus`) ; les envois tournent en arrière plan dans un état propre à la fiche, un à la fois.

**Pros**:
- Utilise l'hébergement du backend tel qu'il a été conçu, sans contourner ses décisions.
- Les gros fichiers passent sur une connexion faible (reprise tus) et n'occupent jamais l'API.
- L'admin continue à travailler pendant l'envoi ; un seul envoi à la fois ménage la limite et la connexion.

**Cons**:
- Une dépendance (`tus-js-client`) et deux adresses Cloudflare dans la CSP.
- Un envoi s'arrête si l'admin quitte la fiche.

### Option 2 : lien collé, l'hébergement plus tard

Les épisodes reçoivent un lien vidéo collé ; l'envoi arrive dans une fonctionnalité suivante.

**Pros**:
- Plus rapide à construire, aucune dépendance.

**Cons**:
- Contredit le backend (lien collé non protégé, `PATCH` sans `videoUrl`) et laisse fuir les épisodes premium.
- Ne correspond pas à la façon dont les admins travaillent : ils ont des fichiers, pas des liens hébergés ailleurs.

### Option 3 : envoi bloquant dans la fenêtre

Le même envoi direct, mais la fenêtre reste ouverte avec sa barre de progression jusqu'à la fin.

**Pros**:
- Plus simple : pas d'état partagé sur la fiche.

**Cons**:
- Bloque l'admin plusieurs minutes par épisode, et rend fastidieux l'envoi d'une saison entière.

## Rationale

L'envoi direct à Cloudflare est ce que le backend a déjà décidé et construit, et c'est la seule voie qui protège les épisodes premium : le dashboard doit s'y brancher plutôt que de prolonger le lien collé. Le travail en arrière plan, un envoi à la fois, répond à la taille réelle des fichiers et à la limite de 10 appels, sans bloquer l'admin. `tus-js-client` est le client de référence du protocole imposé par le backend au delà de 200 Mo ; l'écrire à la main serait plus long et plus fragile.

La migration des liens collés passe par un petit ajout au backend (`fromPastedLink`) plutôt que par l'exposition du lien, pour garder vraie la règle du backend « aucun `videoUrl` dans les réponses ». La confirmation « Publier l'épisode ? » vient de l'annonce aux abonnés, qui ne s'annule pas ; la colonne « Non visible » vient de ce que le backend ne compte que les épisodes jouables. La saison et le numéro restent figés, comme le veut le backend, et la date est envoyée et affichée en UTC pour que le tableau et la fenêtre montrent toujours le même jour.
