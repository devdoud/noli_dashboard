/**
 * Mise en page de l'application : en tête, menu latéral, contenu (spec 0003, AC-5 à AC-7).
 * Route de mise en page (Outlet) ; la protection des routes appartient à la fonctionnalité 5.
 */
import { ActionIcon, AppShell, Burger, Button, Group, NavLink, Text } from '@mantine/core'
import { useDisclosure, useMediaQuery } from '@mantine/hooks'
import { IconLogout } from '@tabler/icons-react'
import { useEffect, useRef } from 'react'
import { NavLink as RouterNavLink, Link, Outlet } from 'react-router'
import { logout } from '@/shared/session/session'
import { useSession } from '@/shared/session/useSession'
import classes from '@/shared/ui/AppLayout.module.css'
import { ColorSchemeToggle } from '@/shared/ui/ColorSchemeToggle'
import { visibleNavItems } from '@/shared/ui/navItems'

const NAVBAR_ID = 'menu-principal'
const MOBILE_QUERY = '(max-width: 47.99em)'

function SessionControls() {
  const session = useSession()
  if (session.status !== 'authenticated' || session.user === undefined) return null

  return (
    <>
      <Text size="sm" c="dimmed" visibleFrom="sm">
        {session.user.email}
      </Text>
      <Button
        variant="default"
        visibleFrom="sm"
        leftSection={<IconLogout size={16} aria-hidden="true" />}
        onClick={logout}
      >
        Se déconnecter
      </Button>
      <ActionIcon
        variant="default"
        size="lg"
        hiddenFrom="sm"
        aria-label="Se déconnecter"
        onClick={logout}
      >
        <IconLogout size={18} aria-hidden="true" />
      </ActionIcon>
    </>
  )
}

export function AppLayout() {
  const [opened, { toggle, close }] = useDisclosure(false)
  const isMobile = useMediaQuery(MOBILE_QUERY)
  const burgerRef = useRef<HTMLButtonElement>(null)
  const navHidden = isMobile && !opened

  useEffect(() => {
    if (!opened) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return
      close()
      burgerRef.current?.focus()
    }
    window.addEventListener('keydown', onKeyDown)
    return () => {
      window.removeEventListener('keydown', onKeyDown)
    }
  }, [opened, close])

  return (
    <AppShell
      header={{ height: 56 }}
      navbar={{ width: 240, breakpoint: 'sm', collapsed: { mobile: !opened } }}
      padding="md"
    >
      <a href="#contenu" className={classes.skipLink}>
        Aller au contenu
      </a>

      <AppShell.Header>
        <Group h="100%" px="md" justify="space-between" wrap="nowrap">
          <Group gap="sm" wrap="nowrap">
            <Burger
              ref={burgerRef}
              opened={opened}
              onClick={toggle}
              hiddenFrom="sm"
              size="sm"
              aria-label={opened ? 'Fermer le menu' : 'Ouvrir le menu'}
              aria-expanded={opened}
              aria-controls={NAVBAR_ID}
            />
            <Link to="/" className={classes.brand}>
              <img
                src="/noli-logo.png"
                width={28}
                height={28}
                alt=""
                className={classes.brandLogo}
              />
              <Text ff="heading" fw={800} fz="lg">
                Admin
              </Text>
            </Link>
          </Group>
          <Group gap="sm" wrap="nowrap">
            <ColorSchemeToggle />
            <SessionControls />
          </Group>
        </Group>
      </AppShell.Header>

      <AppShell.Navbar
        id={NAVBAR_ID}
        component="nav"
        aria-label="Menu principal"
        p="xs"
        inert={navHidden}
      >
        {visibleNavItems().map((item) => (
          <NavLink
            key={item.to}
            component={RouterNavLink}
            to={item.to}
            end={item.to === '/'}
            label={item.label}
            leftSection={<item.icon size={18} aria-hidden="true" />}
            onClick={close}
          />
        ))}
      </AppShell.Navbar>

      <AppShell.Main id="contenu" tabIndex={-1} className={classes.main}>
        <Outlet />
      </AppShell.Main>
    </AppShell>
  )
}
