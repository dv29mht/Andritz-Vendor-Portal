import api from '../../../services/api'
import { ENDPOINTS } from '../../../services/endpoints'

export const usersService = {
  list:      ()      => api.get(ENDPOINTS.users.list).then(r => r.data),
  archived:  ()      => api.get(ENDPOINTS.users.archived).then(r => r.data),
  approvers: ()      => api.get(ENDPOINTS.users.approvers).then(r => r.data),

  create: (payload)  => api.post(ENDPOINTS.users.list, payload).then(r => r.data),
  update: (id, body) => api.put(ENDPOINTS.users.one(id), body).then(r => r.data),
  remove: (id)       => api.delete(ENDPOINTS.users.one(id)).then(r => r.data),
  restore:(id)       => api.put(ENDPOINTS.users.restore(id)).then(r => r.data),

  syncAd: ()         => api.post(ENDPOINTS.users.syncAd).then(r => r.data),
}
