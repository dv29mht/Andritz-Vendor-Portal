import { useState, useEffect, useCallback } from 'react'
import { vendorsService } from '../services/vendorsService'
import { useAuth } from '../../auth/hooks/useAuth'

export function useVendorWorkflow() {
  const { isAuthenticated } = useAuth()
  const [requests,       setRequests]       = useState([])
  const [loading,        setLoading]        = useState(false)
  const [actionLoading,  setActionLoading]  = useState(false)
  const [fetchError,     setFetchError]     = useState(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const data = await vendorsService.list()
      setRequests(data)
    } catch (err) {
      setFetchError(err?.response?.data?.message ?? 'Failed to load requests. Please refresh.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (isAuthenticated) fetchAll()
    else setRequests([])
  }, [isAuthenticated, fetchAll])

  /** Fetch full detail for a single request (includes revisionHistory). */
  const fetchDetail = (id) => vendorsService.one(id)

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

  // Helper: run a service call with the actionLoading flag and refresh on success.
  const withAction = async (fn) => {
    setActionLoading(true)
    try {
      const result = await fn()
      await fetchAll()
      return result
    } finally {
      setActionLoading(false)
    }
  }

  // ── Buyer actions ────────────────────────────────────────────────────────

  const createRequest = (form, approvers) =>
    withAction(async () => {
      const created = await vendorsService.create(form, approvers)
      // Auto-submit immediately so the request enters the approval queue
      await vendorsService.submit(created.id)
      return created
    })

  const saveDraft = (form, approvers, existingId = null) =>
    withAction(() => existingId
      ? vendorsService.saveDraft(existingId, form, approvers)
      : vendorsService.createDraft(form, approvers))

  const submit = (requestId) =>
    withAction(() => vendorsService.submit(requestId))

  const resubmit = (requestId, form) =>
    withAction(() => vendorsService.resubmit(requestId, form))

  const updateCompleted = (requestId, form, approverUserIds = null) =>
    withAction(() => vendorsService.buyerUpdate(requestId, form, approverUserIds))

  // ── Admin archive / restore ──────────────────────────────────────────────

  const deleteRequest = (requestId) =>
    withAction(() => vendorsService.remove(requestId))

  const restoreRequest = (requestId) =>
    withAction(() => vendorsService.restore(requestId))

  // ── Approver actions ─────────────────────────────────────────────────────

  const approveStep = (requestId, comment) =>
    withAction(() => vendorsService.approve(requestId, comment))

  const reject = (requestId, comment) =>
    withAction(() => vendorsService.reject(requestId, comment))

  // ── Final Approver action ────────────────────────────────────────────────

  const complete = (requestId, vendorCode) =>
    withAction(() => vendorsService.complete(requestId, vendorCode))

  return {
    requests,
    loading,
    fetchError,
    actionLoading,
    fetchAll,
    fetchDetail,
    getPendingFor,
    getHistoryFor,
    createRequest,
    saveDraft,
    submit,
    resubmit,
    updateCompleted,
    approveStep,
    reject,
    complete,
    deleteRequest,
    restoreRequest,
  }
}
