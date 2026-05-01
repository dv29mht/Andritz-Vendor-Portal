// Single source of truth for every backend route the frontend calls.
// Per-feature service modules (features/<x>/services/*.js) consume these — UI
// components must NOT hard-code paths.
export const ENDPOINTS = {
  auth: {
    login:          '/auth/login',
    logout:         '/auth/logout',
    me:             '/auth/me',
    forgotPassword: '/auth/forgot-password',
    resetPassword:  '/auth/reset-password',
  },
  users: {
    list:      '/users',
    archived:  '/users/archived',
    approvers: '/users/approvers',
    one:       (id) => `/users/${id}`,
    restore:   (id) => `/users/${id}/restore`,
    syncAd:    '/users/sync-ad',
    profile:   '/users/profile',
  },
  vendorRequests: {
    list:         '/vendor-requests',
    one:          (id) => `/vendor-requests/${id}`,
    create:       '/vendor-requests',
    createDraft:  '/vendor-requests/draft',
    saveDraft:    (id) => `/vendor-requests/${id}/save-draft`,
    submit:       (id) => `/vendor-requests/${id}/submit`,
    resubmit:     (id) => `/vendor-requests/${id}/resubmit`,
    buyerUpdate:  (id) => `/vendor-requests/${id}/buyer-update`,
    adminUpdate:  (id) => `/vendor-requests/${id}`,
    approve:      (id) => `/vendor-requests/${id}/approve`,
    reject:       (id) => `/vendor-requests/${id}/reject`,
    complete:     (id) => `/vendor-requests/${id}/complete`,
    classify:     (id) => `/vendor-requests/${id}/classify`,
    restore:      (id) => `/vendor-requests/${id}/restore`,
  },
  masterData: {
    materialGroups: '/master-data/material-groups',
    proposedBy:     '/master-data/proposed-by',
  },
  // Settings live under /users/profile on the backend; kept as a separate
  // namespace here to mirror the frontend feature folder.
  settings: {
    profile: '/users/profile',
  },
}
