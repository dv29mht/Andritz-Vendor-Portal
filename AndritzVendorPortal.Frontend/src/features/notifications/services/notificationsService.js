import api from '../../../services/api'
import { ENDPOINTS } from '../../../services/endpoints'

export const notificationsService = {
  list:        ()   => api.get(ENDPOINTS.notifications.list).then(r => r.data),
  markRead:    (id) => api.post(ENDPOINTS.notifications.read(id)).then(r => r.data),
  markUnread:  (id) => api.post(ENDPOINTS.notifications.unread(id)).then(r => r.data),
  markAllRead: ()   => api.post(ENDPOINTS.notifications.readAll).then(r => r.data),
}
