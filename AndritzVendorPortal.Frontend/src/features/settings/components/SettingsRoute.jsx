import { useOutletContext } from 'react-router-dom'
import { useAuth } from '../../auth/hooks/useAuth'
import SettingsPage from './SettingsPage'

export default function SettingsRoute() {
  const { currentUser } = useOutletContext()
  const { updateUser } = useAuth()
  return <SettingsPage currentUser={currentUser} onUpdate={updateUser} />
}
