import { useOutletContext } from 'react-router-dom'
import OneTimeVendorPage from './OneTimeVendorPage'

export default function OneTimeRoute() {
  const { workflow, currentUser } = useOutletContext()
  return <OneTimeVendorPage workflow={workflow} currentUser={currentUser} />
}
