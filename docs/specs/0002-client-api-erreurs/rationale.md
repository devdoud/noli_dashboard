# 0002. Client API, session et erreurs : raisonnement

## Context

Toutes les fonctionnalités du dashboard (séries, épisodes, images, catégories, vue d'ensemble, notification de test) appellent la même API NestJS. Sans une brique commune, chacune réécrirait l'ajout du token, le renouvellement, la lecture des erreurs et leur traduction, avec des comportements différents d'un écran à l'autre.

Les contraintes viennent du backend et de la spec 0001. Le token d'accès dure 15 minutes et le refresh token 30 jours, sans renouvellement du refresh token ni route pour le révoquer. Les tokens arrivent dans le corps de la réponse. Les réponses enveloppent leurs données sous une clé qui change selon la route (`series`, `data`, `category`…), et les erreurs suivent le format NestJS (`statusCode`, `message` parfois en tableau, parfois un `code`). Les messages du backend sont surtout en anglais. Le contrat `openapi.json` décrit les corps de requête mais seulement 8 réponses sur ses 71 opérations (méthode et chemin). L'API gratuite de Render peut mettre près d'une minute à se réveiller. La spec 0001 a placé le refresh token dans `sessionStorage`, propre à chaque onglet.

Les admins sont 1 à 3, sur ordinateur, et peuvent supprimer du contenu de production : une erreur doit être claire et une session ne doit pas se perdre en plein travail.

## Options considered

### Option 1 : client fait main autour de `fetch`, réponses vérifiées par Zod

Une fonction `apiRequest` d'une centaine de lignes, qui gère en têtes, délais, renouvellement et erreurs. Chaque fonctionnalité écrit le schéma Zod de ses réponses, qui donne à la fois le type TypeScript et la vérification à l'exécution.

**Pros**:
- Aucune dépendance nouvelle à part Zod, déjà prévu dans la pile.
- Les réponses sont réellement typées et vérifiées, ce que le contrat OpenAPI actuel ne permet pas.
- Le renouvellement et la traduction des erreurs sont à un seul endroit, faciles à tester avec MSW.

**Cons**:
- Les chemins et les corps de requête ne sont pas vérifiés contre le contrat : une faute dans un chemin se voit seulement au test.
- Chaque schéma de réponse est écrit et maintenu à la main.

### Option 2 : types générés depuis `openapi.json` + Zod pour les réponses

`openapi-typescript` génère les types des chemins et des corps de requête ; `openapi-fetch` (ou un équivalent) appelle l'API ; Zod vérifie les réponses.

**Pros**:
- Les chemins, paramètres et corps de requête sont vérifiés par TypeScript contre le contrat.
- Un changement de route côté backend se voit au typecheck après régénération.

**Cons**:
- Un outil de génération et une étape de plus (régénérer, commiter le fichier généré).
- Les réponses restent à écrire en Zod, comme dans l'option 1, puisque le contrat ne les décrit pas.
- Le renouvellement de token et la conversion des erreurs se font quand même autour du client généré.

### Option 3 : client entièrement généré (orval ou équivalent)

Un générateur produit fonctions et hooks TanStack Query pour toutes les routes.

**Pros**:
- Très peu de code écrit à la main pour les appels.
- Hooks prêts à l'emploi.

**Cons**:
- Les réponses restent `unknown` pour 63 opérations sur 71 : le gain principal disparaît.
- Personnaliser le renouvellement, les délais et les erreurs demande de configurer le générateur en profondeur.
- Beaucoup de code généré à relire pour un dashboard d'une douzaine d'écrans.

## Rationale

Le facteur décisif est le contrat : avec 8 réponses décrites sur 71, toute génération laisse les réponses non typées, alors que ce sont elles que les écrans affichent. Zod comble ce manque et vérifie aussi ce que le backend renvoie vraiment, ce qui protège un outil qui modifie la production. Une fois Zod écrit pour les réponses, la génération des requêtes (option 2) apporte un gain réel mais petit pour une douzaine de routes, au prix d'un outil et d'une étape de plus. L'option 1 garde la pile simple ; elle reste compatible avec l'option 2 si le backend complète son OpenAPI.

Pour la session, le renouvellement réactif (sur `401`) suit exactement la doc du backend et évite de lire la date d'expiration dans le token. Un seul renouvellement partagé évite une rafale d'appels quand plusieurs écrans se chargent en même temps. Le partage entre onglets répond à un défaut concret de `sessionStorage` (une connexion par onglet) sans revenir sur la décision de la spec 0001 : le token reste hors de `localStorage` et disparaît avec le dernier onglet.

Pour les erreurs, l'affichage selon le contexte (dans la page, en notification, sous le champ) suit l'endroit où l'admin regarde au moment de l'erreur. La table de traduction par statut et code donne du français précis là où c'est utile, et le détail repliable garde le texte du backend pour comprendre une erreur imprévue. Les réessais limités aux lectures et aux erreurs passagères évitent de créer un doublon par une mutation relancée seule, et ne font pas attendre l'admin sur une erreur qui ne changera pas (`4xx`). Les délais de 5 s puis 70 s couvrent le réveil d'environ 50 s de l'API gratuite ; un `timeout` n'est relancé qu'une fois, pour ne pas faire attendre plus de deux minutes et vingt secondes au pire.

La relecture croisée (un autre modèle) a fait préciser les règles de session et d'onglets : rejeu sans nouveau renouvellement quand le token a déjà changé, reprise silencieuse distincte d'une session expirée, vidage du cache et annulation des requêtes à la fin de session, protocole complet entre onglets, minuteurs testables, corps non JSON pendant le réveil de Render, et journalisation sans données sensibles.
