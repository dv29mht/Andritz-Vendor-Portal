import api from '../../../services/api'
import { ENDPOINTS } from '../../../services/endpoints'

export const masterDataService = {
  materialGroups: () => api.get(ENDPOINTS.masterData.materialGroups).then(r => r.data),
  proposedBy:     () => api.get(ENDPOINTS.masterData.proposedBy).then(r => r.data),
}
