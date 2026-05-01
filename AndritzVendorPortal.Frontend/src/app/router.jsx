import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'
import AppLayout from './AppLayout'
import ConsoleRoute from './ConsoleRoute'
import Login from '../features/auth/components/Login'
import SettingsRoute from '../features/settings/components/SettingsRoute'
import OneTimeRoute from '../features/onetime/components/OneTimeRoute'
import { ROLES } from '../shared/constants/roles'

// Each "page" of the app is a route. Pages backed by a role's console
// (dashboard, requests, pending, history, vendors, users, etc.) all render
// <ConsoleRoute>, which picks the role-appropriate console and reads the
// active sub-page from the URL pathname.
export const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <ProtectedRoute>
        <AppLayout />
      </ProtectedRoute>
    ),
    children: [
      { index: true, element: <Navigate to="/dashboard" replace /> },

      // Role-routed console pages
      { path: 'dashboard', element: <ConsoleRoute /> },
      { path: 'requests',  element: <ConsoleRoute /> },
      { path: 'pending',   element: <ConsoleRoute /> },
      { path: 'history',   element: <ConsoleRoute /> },
      { path: 'revision',  element: <ConsoleRoute /> },
      { path: 'waiting',   element: <ConsoleRoute /> },
      { path: 'vendors',   element: <ConsoleRoute /> },
      { path: 'users',     element: <ConsoleRoute /> },

      // Standalone pages
      { path: 'settings', element: <SettingsRoute /> },
      {
        path: 'onetime',
        element: (
          <RoleRoute allow={[ROLES.Admin, ROLES.FinalApprover]}>
            <OneTimeRoute />
          </RoleRoute>
        ),
      },

      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
])
