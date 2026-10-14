// Champ Langues : pastilles « Nom (code) », suggestions, ajout d'un code ISO 639 (spec 0005, AC-10).
import { CheckIcon, Combobox, Group, Pill, PillsInput, useCombobox } from '@mantine/core'
import { useState, type ReactNode, type Ref } from 'react'
import {
  foldForSearch,
  LANGUAGE_SUGGESTIONS,
  languageLabel,
  languageName,
} from '@/features/series/languages'
import { LANGUAGE_CODE } from '@/features/series/seriesFormSchema'

const CREATE_PREFIX = '__ajouter__'

interface LanguagesInputProps {
  readonly id: string
  readonly label: ReactNode
  readonly description?: ReactNode
  readonly defaultValue?: readonly string[]
  readonly onChange?: (value: string[]) => void
  readonly error?: ReactNode
  readonly ref?: Ref<HTMLInputElement>
}

export function LanguagesInput({
  id,
  label,
  description,
  defaultValue = [],
  onChange,
  error,
  ref,
}: LanguagesInputProps) {
  const combobox = useCombobox({
    onDropdownClose: () => {
      combobox.resetSelectedOption()
    },
  })
  const [value, setValue] = useState<readonly string[]>(defaultValue)
  const [search, setSearch] = useState('')

  const update = (next: readonly string[]) => {
    setValue(next)
    onChange?.([...next])
  }
  const add = (code: string) => {
    if (!value.includes(code)) update([...value, code])
    setSearch('')
  }
  const remove = (code: string) => {
    update(value.filter((item) => item !== code))
  }

  const query = foldForSearch(search.trim())
  const matches = LANGUAGE_SUGGESTIONS.filter(
    (language) =>
      query === '' || foldForSearch(language.name).includes(query) || language.code.includes(query),
  )
  const typedCode = search.trim().toLowerCase()
  const canCreate =
    LANGUAGE_CODE.test(typedCode) &&
    !value.includes(typedCode) &&
    !LANGUAGE_SUGGESTIONS.some((language) => language.code === typedCode)

  const handleSubmit = (optionValue: string) => {
    if (optionValue.startsWith(CREATE_PREFIX)) {
      add(optionValue.slice(CREATE_PREFIX.length))
    } else if (value.includes(optionValue)) {
      remove(optionValue)
    } else {
      add(optionValue)
    }
    combobox.updateSelectedOptionIndex('active')
  }

  return (
    <Combobox store={combobox} onOptionSubmit={handleSubmit}>
      <Combobox.DropdownTarget>
        <PillsInput
          id={id}
          label={label}
          description={description}
          error={error}
          onClick={() => {
            combobox.openDropdown()
          }}
        >
          <Pill.Group>
            {value.map((code) => (
              <Pill
                key={code}
                withRemoveButton
                onRemove={() => {
                  remove(code)
                }}
                removeButtonProps={{ 'aria-label': `Retirer ${languageName(code) ?? code}` }}
              >
                {languageLabel(code)}
              </Pill>
            ))}
            <Combobox.EventsTarget>
              <PillsInput.Field
                ref={ref}
                value={search}
                placeholder={value.length === 0 ? 'Choisir ou taper un code' : undefined}
                aria-invalid={error === undefined || error === null ? undefined : true}
                onFocus={() => {
                  combobox.openDropdown()
                }}
                onBlur={() => {
                  combobox.closeDropdown()
                }}
                onChange={(event) => {
                  combobox.updateSelectedOptionIndex()
                  setSearch(event.currentTarget.value)
                }}
                onKeyDown={(event) => {
                  if (event.key === 'Enter') {
                    // Entrée ne doit jamais envoyer tout le formulaire depuis ce champ. Avec une
                    // option surlignée, le Combobox la choisit ; sinon on ajoute le code tapé.
                    event.preventDefault()
                    if (
                      combobox.getSelectedOptionIndex() === -1 &&
                      LANGUAGE_CODE.test(typedCode) &&
                      !value.includes(typedCode)
                    ) {
                      add(typedCode)
                    }
                    return
                  }
                  if (event.key === 'Backspace' && search.length === 0) {
                    const last = value.at(-1)
                    if (last !== undefined) {
                      event.preventDefault()
                      remove(last)
                    }
                  }
                }}
              />
            </Combobox.EventsTarget>
          </Pill.Group>
        </PillsInput>
      </Combobox.DropdownTarget>

      <Combobox.Dropdown>
        <Combobox.Options>
          {matches.map((language) => (
            <Combobox.Option
              value={language.code}
              key={language.code}
              active={value.includes(language.code)}
            >
              <Group gap="sm" wrap="nowrap">
                {value.includes(language.code) ? <CheckIcon size={12} /> : null}
                <span>{`${language.name} (${language.code})`}</span>
              </Group>
            </Combobox.Option>
          ))}
          {canCreate ? (
            <Combobox.Option value={`${CREATE_PREFIX}${typedCode}`}>
              {`Ajouter le code « ${typedCode} »`}
            </Combobox.Option>
          ) : null}
          {matches.length === 0 && !canCreate ? (
            <Combobox.Empty>Aucune langue trouvée</Combobox.Empty>
          ) : null}
        </Combobox.Options>
      </Combobox.Dropdown>
    </Combobox>
  )
}
