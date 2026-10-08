import { setupServer } from 'msw/node'

// Serveur MSW partagé par les tests. Chaque fonctionnalité ajoute ses réponses simulées
// avec server.use(...) dans ses propres tests.
export const server = setupServer()
