import api from '../../../services/api'
import { ENDPOINTS } from '../../../services/endpoints'

export const settingsService = {
  updateProfile: ({ fullName, currentPassword, newPassword }) =>
    api.put(ENDPOINTS.settings.profile, {
      fullName,
      currentPassword: currentPassword ?? null,
      newPassword:     newPassword     ?? null,
    }).then(r => r.data),
}
