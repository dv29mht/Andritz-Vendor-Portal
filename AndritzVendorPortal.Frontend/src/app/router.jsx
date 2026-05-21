import { createBrowserRouter, Navigate } from 'react-router-dom'
import ProtectedRoute from './ProtectedRoute'
import RoleRoute from './RoleRoute'
import AppLayout from './AppLayout'
import ConsoleRoute from './ConsoleRoute'
import Login from '../features/auth/components/Login'
import SettingsRoute from '../features/settings/components/SettingsRoute'
import OneTimeRoute from '../features/onetime/components/OneTimeRoute'
import EmailTemplatesRoute from '../features/emailTemplates/components/EmailTemplatesRoute'
import { ROLES } from '../shared/constants/roles'

// Each "page" of the app is a route. Pages backed by a role's console
// (dashboard, requests, pending, history, vendors, users, etc.) all render
// <ConsoleRoute>, which picks the role-appropriate console and reads the
// active sub-page from the URL pathname.
//
// basename comes from Vite's BASE_URL (set by `base` in vite.config.js):
// "/" for Railway/local, "/SOT/" for the office IIS sub-app build. React
// Router wants no trailing slash, so we strip it; pass undefined when there
// is no sub-path so router internals stay on the default fast path.
const basename = import.meta.env.BASE_URL === '/'
  ? undefined
  : import.meta.env.BASE_URL.replace(/\/$/, '')

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
      {
        path: 'email-templates',
        element: (
          <RoleRoute allow={[ROLES.Admin]}>
            <EmailTemplatesRoute />
          </RoleRoute>
        ),
      },

      { path: '*', element: <Navigate to="/dashboard" replace /> },
    ],
  },
], { basename })
