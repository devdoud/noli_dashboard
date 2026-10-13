// Applique le mode de couleurs avant le premier rendu (spec 0003, AC-2).
// Fichier sur la même origine : la CSP (script-src 'self') interdit le script en ligne de Mantine.
// La clé doit rester celle de src/shared/ui/theme.ts (COLOR_SCHEME_STORAGE_KEY).
;(function () {
  var scheme = 'auto'
  try {
    scheme = window.localStorage.getItem('noli-admin-color-scheme') || 'auto'
  } catch (error) {
    scheme = 'auto'
  }
  if (scheme !== 'light' && scheme !== 'dark') {
    scheme = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  }
  document.documentElement.setAttribute('data-mantine-color-scheme', scheme)
})()
