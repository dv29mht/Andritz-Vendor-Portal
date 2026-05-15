import api from '../../../services/api'
import { ENDPOINTS } from '../../../services/endpoints'

export const emailTemplatesService = {
  list:    ()                                   => api.get(ENDPOINTS.emailTemplates.list).then(r => r.data),
  get:     (code)                               => api.get(ENDPOINTS.emailTemplates.one(code)).then(r => r.data),
  update:  (code, { subject, bodyText })        => api.put(ENDPOINTS.emailTemplates.one(code), { subject, bodyText }).then(r => r.data),
  reset:   (code)                               => api.post(ENDPOINTS.emailTemplates.reset(code)).then(r => r.data),
  preview: (code, values)                       => api.post(ENDPOINTS.emailTemplates.preview(code), { values }).then(r => r.data),
}
