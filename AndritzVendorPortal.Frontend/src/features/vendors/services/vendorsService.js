import api from '../../../services/api'
import { ENDPOINTS } from '../../../services/endpoints'

// Common payload shape for create / draft / resubmit / buyer-update / admin-update.
// Distinct fields are merged in by each call site.
function buildVendorPayload(form) {
  return {
    vendorName:      form.vendorName,
    contactPerson:   form.contactPerson,
    telephone:       form.telephone     || null,
    gstNumber:       form.gstNumber,
    panCard:         form.panCard,
    addressDetails:  form.addressDetails,
    city:            form.city,
    locality:        form.locality,
    materialGroup:   form.materialGroup || null,
    postalCode:      form.postalCode    || null,
    state:           form.state         || null,
    country:         form.country       || null,
    currency:        form.currency      || null,
    paymentTerms:    form.paymentTerms  || null,
    incoterms:       form.incoterms     || null,
    reason:          form.reason        || null,
    yearlyPvo:       form.yearlyPvo     || null,
    isOneTimeVendor: form.isOneTimeVendor ?? false,
    proposedBy:      form.proposedBy    || null,
  }
}

// Draft variant — all fields optional / nullable.
function buildDraftPayload(form) {
  return {
    vendorName:      form.vendorName      || null,
    contactPerson:   form.contactPerson   || null,
    telephone:       form.telephone       || null,
    gstNumber:       form.gstNumber       || null,
    panCard:         form.panCard         || null,
    addressDetails:  form.addressDetails  || null,
    city:            form.city            || null,
    locality:        form.locality        || null,
    materialGroup:   form.materialGroup   || null,
    postalCode:      form.postalCode      || null,
    state:           form.state           || null,
    country:         form.country         || null,
    currency:        form.currency        || null,
    paymentTerms:    form.paymentTerms    || null,
    incoterms:       form.incoterms       || null,
    reason:          form.reason          || null,
    yearlyPvo:       form.yearlyPvo       || null,
    isOneTimeVendor: form.isOneTimeVendor ?? false,
    proposedBy:      form.proposedBy      || null,
  }
}

export const vendorsService = {
  list:   ()   => api.get(ENDPOINTS.vendorRequests.list).then(r => r.data),
  one:    (id) => api.get(ENDPOINTS.vendorRequests.one(id)).then(r => r.data),

  create: (form, approvers) =>
    api.post(ENDPOINTS.vendorRequests.create, {
      ...buildVendorPayload(form),
      approverUserIds: approvers.map(a => a.id),
    }).then(r => r.data),

  createDraft: (form, approvers) =>
    api.post(ENDPOINTS.vendorRequests.createDraft, {
      ...buildDraftPayload(form),
      approverUserIds: approvers.length > 0 ? approvers.map(a => a.id) : null,
    }).then(r => r.data),

  saveDraft: (id, form, approvers) =>
    api.put(ENDPOINTS.vendorRequests.saveDraft(id), {
      ...buildDraftPayload(form),
      approverUserIds: approvers.length > 0 ? approvers.map(a => a.id) : null,
    }).then(r => r.data),

  submit: (id) =>
    api.post(ENDPOINTS.vendorRequests.submit(id)).then(r => r.data),

  resubmit: (id, form) =>
    api.post(ENDPOINTS.vendorRequests.resubmit(id), {
      ...buildVendorPayload(form),
      ...(form.approverUserIds ? { approverUserIds: form.approverUserIds } : {}),
    }).then(r => r.data),

  buyerUpdate: (id, form, approverUserIds = null) =>
    api.put(ENDPOINTS.vendorRequests.buyerUpdate(id), {
      ...buildVendorPayload(form),
      ...(approverUserIds ? { approverUserIds } : {}),
    }).then(r => r.data),

  adminUpdate: (id, body) =>
    api.put(ENDPOINTS.vendorRequests.adminUpdate(id), body).then(r => r.data),

  approve: (id, comment) =>
    api.post(ENDPOINTS.vendorRequests.approve(id), { comment: comment || null }).then(r => r.data),

  reject: (id, comment) =>
    api.post(ENDPOINTS.vendorRequests.reject(id), { comment }).then(r => r.data),

  complete: (id, vendorCode) =>
    api.post(ENDPOINTS.vendorRequests.complete(id), { vendorCode }).then(r => r.data),

  remove: (id) =>
    api.delete(ENDPOINTS.vendorRequests.one(id)).then(r => r.data),

  restore: (id) =>
    api.post(ENDPOINTS.vendorRequests.restore(id)).then(r => r.data),

  classify: (id, isOneTimeVendor) =>
    api.patch(ENDPOINTS.vendorRequests.classify(id), { isOneTimeVendor }).then(r => r.data),
}
