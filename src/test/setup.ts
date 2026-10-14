import '@testing-library/jest-dom/vitest'
import { cleanup, configure } from '@testing-library/react'
import { afterAll, afterEach, beforeAll } from 'vitest'
import { server } from '@/test/server'

// Attentes asynchrones (findBy, waitFor) de 5 s au lieu de 1 s : sous forte charge (suite complète,
// navigateur ouvert), le premier rendu de Mantine dans jsdom dépasse parfois 1 s.
configure({ asyncUtilTimeout: 5_000 })

// jsdom n'implémente pas ces API, dont Mantine a besoin.
const originalGetComputedStyle = window.getComputedStyle.bind(window)
window.getComputedStyle = (element) => originalGetComputedStyle(element)
window.HTMLElement.prototype.scrollIntoView = () => {}

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false,
  }),
})

class ResizeObserver {
  observe() {}
  unobserve() {}
  disconnect() {}
}
window.ResizeObserver = ResizeObserver

// Le Textarea autosize de Mantine écoute le chargement des polices (document.fonts).
Object.defineProperty(document, 'fonts', {
  configurable: true,
  value: {
    addEventListener: () => {},
    removeEventListener: () => {},
    ready: Promise.resolve(),
  },
})

// Toute requête réseau sans réponse simulée fait échouer le test.
beforeAll(() => {
  server.listen({ onUnhandledRequest: 'error' })
})
afterEach(() => {
  server.resetHandlers()
  cleanup()
})
afterAll(() => {
  server.close()
})
