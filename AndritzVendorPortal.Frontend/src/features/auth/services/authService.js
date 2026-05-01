import api from '../../../services/api'
import { ENDPOINTS } from '../../../services/endpoints'

export const authService = {
  login: (email, password) =>
    api.post(ENDPOINTS.auth.login, { email, password }).then(r => r.data),

  logout: () =>
    api.post(ENDPOINTS.auth.logout).then(r => r.data),

  me: () =>
    api.get(ENDPOINTS.auth.me).then(r => r.data),

  forgotPassword: (email) =>
    api.post(ENDPOINTS.auth.forgotPassword, { email }).then(r => r.data),

  resetPassword: (email, token, newPassword) =>
    api.post(ENDPOINTS.auth.resetPassword, { email, token, newPassword }).then(r => r.data),
}
