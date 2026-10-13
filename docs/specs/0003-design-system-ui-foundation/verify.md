# Verify: design system & UI foundation · spec 0003 · updated 2026-10-13
_Steps derived from spec 0003 acceptance criteria. `/check verify` runs these; `/test` locks the durable ones._

Lancer `npm run dev`, ouvrir `http://localhost:5173`. Vérifier en mode clair et en mode sombre (réglage du système ou bouton de thème), sur ordinateur (1280 px) et sur téléphone (375 px).

## UI / manual
- [x] Mode sombre : fond de page `#0B0C10`, cartes et menu en `#13141B`, bouton principal ambre `#F5A623` avec un texte sombre → AC-1
- [x] Recharger avec le système en sombre puis en clair : le bon mode s'affiche dès le premier rendu, sans clignotement ; aucune erreur CSP dans la console → AC-2
- [x] Cliquer le bouton de thème : le mode change, `localStorage['noli-admin-color-scheme']` vaut `dark` ou `light`, et le choix survit au rechargement → AC-2
- [x] Onglet Réseau : les polices viennent de `/fonts/*.woff2` (même origine), aucune requête vers un autre domaine ; les titres sont en Bricolage Grotesque et le texte en Plus Jakarta Sans → AC-3
- [x] Sur `/dev/composants`, en clair et en sombre : textes, liens, badges, boutons et alertes lisibles ; la bordure des champs reste visible → AC-4
- [x] En tête : logo, « Admin » et bouton de thème ; sans session, ni email ni « Se déconnecter » → AC-5
- [x] À 375 px : ☰ ouvre le menu, choisir une entrée le ferme, Échap le ferme et rend le focus à ☰ ; menu fermé, Tab ne passe pas par ses liens → AC-5
- [x] Menu : seule « Vue d'ensemble » apparaît, marquée comme page courante → AC-6
- [x] Premier Tab : « Aller au contenu » apparaît ; Entrée envoie le focus sur le contenu ; le focus reste visible partout ; l'onglet affiche « Vue d'ensemble · Noli Admin » → AC-7
- [x] Vitrine, tableau : basculer données, chargement (squelettes), rechargement (lignes grisées), vide (`EmptyState` sans pagination), erreur (« Réessayer ») ; changer de page ; « 1 à 10 sur 34 » ; à 375 px le tableau défile sans casser la page → AC-8
- [x] Vitrine : « Supprimer une série » ouvre la confirmation ; Annuler a le focus ; Échap, clic extérieur et Annuler donnent « Annuler », Supprimer donne « Supprimer » ; le focus revient au bouton → AC-9
- [x] Vitrine : « Notification de succès » affiche une notification verte avec une coche, en bas à droite, qui se ferme après 4 s → AC-10
- [x] Vitrine, Formatage : « 13 oct. 2026 », « 13 oct. 2026, 15:05 » (heure locale à Paris), « moins d'1 min · 25 min · 1 h 05 · — » → AC-11
- [x] Une page a un seul `h1` ; à 375 px l'action de `PageHeader` passe sous le titre → AC-12
- [x] `/inconnu` affiche « Page introuvable » et un bouton vers la Vue d'ensemble → AC-15

## Commands
- [x] `npm run build` puis `grep -rl "DevComponentsPage\|Vitrine du design system" dist/` → aucun fichier → AC-13
- [x] `ls dist/fonts dist/color-scheme.js dist/favicon.png dist/noli-logo.png` → présents → AC-2, AC-3
- [x] `npx vitest run src/shared/ui src/app` → tous les tests passent → AC-2, AC-5 à AC-12, AC-15
- [x] `design.md` à la racine : palettes en hexadécimal, contrastes mesurés, typographie, espacements, mise en page, composants → AC-14

## Value sourcing
- [x] Couleurs de marque identiques à `NColors` de `../noli_app/lib/core/theme/app_theme.dart` (`#0B0C10`, `#13141B`, `#1C1D26`, `#F5A623`, `#6C5CE7`, `#FF4D6D`) → AC-1
- [x] Mode au premier chargement : supprimer la clé `noli-admin-color-scheme`, recharger en système sombre puis clair → le mode suit le système → AC-2
- [ ] Email de l'en tête lu dans la session : après une connexion (fonctionnalité 5), l'email de l'admin s'affiche, « Se déconnecter » ramène la session à `anonymous` → AC-5
- [x] `formatDuration` lit des secondes : `1500` → « 25 min » (pas « 1500 min ») → AC-11

## Acceptance-criteria coverage
- AC-1 : couleurs en sombre, sources `NColors` · AC-2 : premier rendu, bouton, `localStorage`, script, système · AC-3 : polices même origine · AC-4 : lisibilité dans la vitrine (contrastes mesurés dans `design.md`) · AC-5 : en tête, session, ☰ · AC-6 : menu · AC-7 : clavier, lien d'évitement, titre de l'onglet · AC-8 : états du tableau · AC-9 : confirmation · AC-10 : notification · AC-11 : formatage · AC-12 : `PageHeader` · AC-13 : build sans vitrine · AC-14 : `design.md` · AC-15 : 404
