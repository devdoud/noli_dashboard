import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { LanguagesInput } from '@/features/series/LanguagesInput'
import { renderWithProviders } from '@/test/render'

function renderInput(defaultValue: readonly string[] = ['fr']) {
  const onChange = vi.fn<(value: string[]) => void>()
  const onSubmit = vi.fn((event: { preventDefault: () => void }) => {
    event.preventDefault()
  })
  renderWithProviders(
    <form onSubmit={onSubmit}>
      <LanguagesInput
        id="langues"
        label="Langues"
        defaultValue={defaultValue}
        onChange={onChange}
      />
    </form>,
  )
  const input = screen.getByRole('textbox', { name: 'Langues' })
  return { input, onChange, onSubmit }
}

function pills(): string[] {
  return [...document.querySelectorAll('.mantine-Pill-label')].map((pill) => pill.textContent)
}

describe('LanguagesInput (AC-10)', { timeout: 30_000 }, () => {
  it('affiche « Nom (code) », et une valeur ancienne telle quelle', () => {
    renderInput(['fr', 'French'])

    expect(pills()).toEqual(['Français (fr)', 'French'])
    expect(
      [...document.querySelectorAll('.mantine-Pill-remove')].map((button) =>
        button.getAttribute('aria-label'),
      ),
    ).toEqual(['Retirer Français', 'Retirer French'])
  })

  it('cherche sans tenir compte des accents et ajoute la langue choisie', async () => {
    const { input, onChange } = renderInput()

    await userEvent.type(input, 'ewe{ArrowDown}{Enter}')

    expect(pills()).toEqual(['Français (fr)', 'Éwé (ee)'])
    expect(onChange).toHaveBeenLastCalledWith(['fr', 'ee'])
  })

  it('propose d’ajouter un code hors liste et l’affiche avec son nom', async () => {
    const { input, onChange } = renderInput([])

    await userEvent.type(input, 'DE')

    expect(await screen.findByText('Ajouter le code « de »')).toBeInTheDocument()
    await userEvent.keyboard('{Enter}')
    expect(pills()).toEqual(['Allemand (de)'])
    expect(onChange).toHaveBeenLastCalledWith(['de'])
  })

  it('n’envoie jamais le formulaire avec Entrée, même sans option choisie', async () => {
    const { input, onChange, onSubmit } = renderInput()

    await userEvent.type(input, 'zzzz{Enter}')

    expect(onSubmit).not.toHaveBeenCalled()
    expect(onChange).not.toHaveBeenCalled()
    expect(screen.getByText('Aucune langue trouvée')).toBeInTheDocument()
  })

  it('n’ajoute pas deux fois le même code', async () => {
    const { input, onChange } = renderInput(['fr'])

    await userEvent.type(input, 'fr{Enter}')

    expect(pills()).toEqual(['Français (fr)'])
    expect(onChange).not.toHaveBeenCalled()
  })

  it('retire la dernière langue avec Retour arrière sur un champ vide', async () => {
    const { input, onChange } = renderInput(['fr', 'fon'])

    await userEvent.click(input)
    await userEvent.keyboard('{Backspace}')

    expect(pills()).toEqual(['Français (fr)'])
    expect(onChange).toHaveBeenLastCalledWith(['fr'])
  })

  it('retire une langue avec le bouton de sa pastille', async () => {
    const { onChange } = renderInput(['fr', 'fon'])
    const remove = document.querySelector('[aria-label="Retirer Fon"]')
    if (remove === null) throw new Error('Bouton « Retirer Fon » introuvable')

    await userEvent.click(remove)

    expect(pills()).toEqual(['Français (fr)'])
    expect(onChange).toHaveBeenLastCalledWith(['fr'])
  })
})
