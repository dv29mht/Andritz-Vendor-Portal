import { RouterProvider } from 'react-router-dom'
import { router } from './router'
import { useAuth } from '../features/auth/hooks/useAuth'
import { useUIStore } from '../store/uiStore'
import WelcomeScreen from '../features/auth/components/WelcomeScreen'
import SessionExpiredBanner from '../features/auth/components/SessionExpiredBanner'

export default function App() {
  const { currentUser, showWelcome, dismissWelcome, logout } = useAuth()
  const sessionExpired    = useUIStore((s) => s.sessionExpired)
  const setSessionExpired = useUIStore((s) => s.setSessionExpired)

  const handleSessionExpiredDone = async () => {
    setSessionExpired(false)
    await logout()
    // Hard-refresh-free redirect — RouterProvider will react to the auth state.
    router.navigate('/login', { replace: true })
  }

  return (
    <>
      {sessionExpired && <SessionExpiredBanner onDone={handleSessionExpiredDone} />}
      {showWelcome && currentUser && (
        <WelcomeScreen user={currentUser} onDone={dismissWelcome} />
      )}
      <RouterProvider router={router} />
    </>
  )
}
