import { useState, useEffect, useCallback } from 'react'
import api from '../services/api'
import { useAuth } from '../contexts/AuthContext'

export function useVendorWorkflow() {
  const { isAuthenticated } = useAuth()
  const [requests, setRequests] = useState([])
  const [loading,  setLoading]  = useState(false)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    try {
      const { data } = await api.get('/vendor-requests')
      setRequests(data)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) fetchAll()
    else setRequests([])
  }, [isAuthenticated, fetchAll])

  /** Fetch full detail for a single request (includes revisionHistory). */
  const fetchDetail = async (id) => {
    const { data } = await api.get(`/vendor-requests/${id}`)
    return data
  }

  /**
   * Returns requests where the given approver has an active pending step.
   * Uses the server-computed pendingApproverUserIds list (parallel approval model).
   */
  const getPendingFor = (approverId) =>
    requests.filter(r =>
      (r.status === 'PendingApproval' || r.status === 'PendingFinalApproval') &&
      Array.isArray(r.pendingApproverUserIds) &&
      r.pendingApproverUserIds.includes(approverId)
    )

  /**
   * Returns requests the given approver has already acted upon
   * (they have a step with a non-Pending decision — Approved or Rejected).
   */
  const getHistoryFor = (approverId) =>
    requests.filter(r =>
      r.approvalSteps.some(s =>
        s.approverUserId === approverId && s.decision !== 'Pending'
      )
    )

  // ── Buyer actions ────────────────────────────────────────────────────────

  const createRequest = async (form, approvers) => {
    const { data } = await api.post('/vendor-requests', {
      vendorName:     form.vendorName,
      contactPerson:  form.contactPerson,
      telephone:      form.telephone     || null,
      gstNumber:      form.gstNumber,
      panCard:        form.panCard,
      addressDetails: form.addressDetails,
      city:           form.city,
      locality:       form.locality,
      materialGroup:  form.materialGroup || null,
      postalCode:     form.postalCode    || null,
      state:          form.state         || null,
      country:        form.country       || null,
      currency:       form.currency      || null,
      paymentTerms:   form.paymentTerms  || null,
      incoterms:      form.incoterms     || null,
      reason:         form.reason        || null,
      yearlyPvo:       form.yearlyPvo      || null,
      isOneTimeVendor: form.isOneTimeVendor ?? false,
      proposedBy:      form.proposedBy     || null,
      approverUserIds: approvers.map(a => a.id),
    })
    // Auto-submit immediately so the request enters the approval queue
    await api.post(`/vendor-requests/${data.id}/submit`)
    await fetchAll()
  }

  const submit = async (requestId) => {
    await api.post(`/vendor-requests/${requestId}/submit`)
    await fetchAll()
  }

  const resubmit = async (requestId, form) => {
    await api.post(`/vendor-requests/${requestId}/resubmit`, {
      vendorName:     form.vendorName,
      contactPerson:  form.contactPerson,
      telephone:      form.telephone     || null,
      gstNumber:      form.gstNumber,
      panCard:        form.panCard,
      addressDetails: form.addressDetails,
      city:           form.city,
      locality:       form.locality,
      materialGroup:  form.materialGroup || null,
      postalCode:     form.postalCode    || null,
      state:          form.state         || null,
      country:        form.country       || null,
      currency:       form.currency      || null,
      paymentTerms:   form.paymentTerms  || null,
      incoterms:      form.incoterms     || null,
      reason:         form.reason        || null,
      yearlyPvo:       form.yearlyPvo      || null,
      isOneTimeVendor: form.isOneTimeVendor ?? false,
      proposedBy:      form.proposedBy     || null,
    })
    await fetchAll()
  }

  // ── Approver actions ─────────────────────────────────────────────────────

  const approveStep = async (requestId, comment) => {
    await api.post(`/vendor-requests/${requestId}/approve`, { comment: comment || null })
    await fetchAll()
  }

  const reject = async (requestId, comment) => {
    await api.post(`/vendor-requests/${requestId}/reject`, { comment })
    await fetchAll()
  }

  // ── Final Approver action ────────────────────────────────────────────────

  const complete = async (requestId, vendorCode) => {
    await api.post(`/vendor-requests/${requestId}/complete`, { vendorCode })
    await fetchAll()
  }

  return {
    requests,
    loading,
    fetchDetail,
    getPendingFor,
    getHistoryFor,
    createRequest,
    submit,
    resubmit,
    approveStep,
    reject,
    complete,
  }
}
