import {
  Alert,
  Box,
  Button,
  Center,
  Paper,
  PasswordInput,
  Stack,
  Text,
  TextInput,
  Title,
} from '@mantine/core'
import { schemaResolver, useForm } from '@mantine/form'
import { useDisclosure } from '@mantine/hooks'
import { useMutation } from '@tanstack/react-query'
import { useState } from 'react'
import { Navigate, useSearchParams } from 'react-router'
import { DEFAULT_AFTER_LOGIN, safeReturnPath } from '@/features/auth/returnPath'
import { loginSchema, type LoginValues } from '@/features/auth/schemas'
import { toUserMessage } from '@/shared/api/messages'
import { login } from '@/shared/session/session'
import { useSession } from '@/shared/session/useSession'
import { FullPageLoader } from '@/shared/ui/FullPageLoader'
import { usePageTitle } from '@/shared/ui/usePageTitle'

// Page de connexion des admins (spec 0004, AC-1 à AC-4, AC-6, AC-7), hors AppLayout.

const INITIAL_VALUES: LoginValues = { email: '', password: '' }

function LoginForm({ endMessage }: { readonly endMessage: string | undefined }) {
  const [dismissed, setDismissed] = useState(false)
  const [passwordVisible, { toggle: togglePassword }] = useDisclosure(false)
  const form = useForm<LoginValues>({
    mode: 'uncontrolled',
    initialValues: INITIAL_VALUES,
    validate: schemaResolver(loginSchema, { sync: true }),
  })
  // Pas de navigation ici : login() ouvre la session, et LoginPage redirige (une seule navigation).
  const mutation = useMutation({
    mutationFn: ({ email, password }: LoginValues) => login(email, password),
  })

  const handleSubmit = form.onSubmit(
    (values) => {
      setDismissed(true)
      if (mutation.isPending) return
      mutation.mutate(loginSchema.parse(values))
    },
    () => {
      setDismissed(true)
    },
  )

  const showEndMessage = endMessage !== undefined && !dismissed

  return (
    <form noValidate onSubmit={handleSubmit}>
      <Stack gap="md">
        {showEndMessage ? (
          <Alert color="noliIndigo" role="status">
            {endMessage}
          </Alert>
        ) : null}
        {mutation.isError ? (
          <Alert color="noliRed" role="alert">
            {toUserMessage(mutation.error).message}
          </Alert>
        ) : null}
        <TextInput
          label="Email"
          type="email"
          autoComplete="username"
          // Le seul champ utile en arrivant sur la page : le focus y va directement (AC-1).
          // eslint-disable-next-line jsx-a11y/no-autofocus
          autoFocus
          key={form.key('email')}
          {...form.getInputProps('email')}
        />
        <PasswordInput
          label="Mot de passe"
          autoComplete="current-password"
          visible={passwordVisible}
          onVisibilityChange={togglePassword}
          visibilityToggleFocusable
          visibilityToggleButtonProps={{
            'aria-label': passwordVisible ? 'Masquer le mot de passe' : 'Afficher le mot de passe',
          }}
          key={form.key('password')}
          {...form.getInputProps('password')}
        />
        <Button
          type="submit"
          fullWidth
          loading={mutation.isPending}
          aria-label={mutation.isPending ? 'Connexion en cours' : undefined}
        >
          Se connecter
        </Button>
      </Stack>
    </form>
  )
}

export function LoginPage() {
  usePageTitle('Connexion')
  const session = useSession()
  const [searchParams] = useSearchParams()

  if (session.status === 'restoring') return <FullPageLoader />
  if (session.status === 'authenticated') {
    return (
      <Navigate to={safeReturnPath(searchParams.get('retour')) ?? DEFAULT_AFTER_LOGIN} replace />
    )
  }

  return (
    <Box component="main">
      <Center mih="100dvh" p="md">
        <Paper withBorder p="xl" w="100%" maw={400}>
          <Stack gap="lg">
            <Stack gap={4} align="center">
              <Title order={1} ff="heading" fw={800}>
                Noli
              </Title>
              <Text c="dimmed">Espace d&apos;administration</Text>
            </Stack>
            <LoginForm endMessage={session.endMessage} />
          </Stack>
        </Paper>
      </Center>
    </Box>
  )
}
