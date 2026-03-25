import { useMemo, useState, useCallback } from 'react'

// Derives notification events from the current requests array.
// No backend needed — all data is already in the requests fetched by useVendorWorkflow.
function deriveEvents(requests, role, userId) {
  const events = []

  if (role === 'Admin') {
    // Activity log: every significant event across all requests
    for (const req of requests) {
      // Submission
      events.push({
        id: `submit-${req.id}-${req.revisionNo}`,
        title: req.revisionNo > 0 ? 'Request Resubmitted' : 'New Request Submitted',
        body: `${req.createdByName} submitted vendor request for ${req.vendorName}`,
        timestamp: new Date(req.createdAt).getTime(),
        type: 'info',
      })

      // Individual step decisions
      for (const step of req.approvalSteps ?? []) {
        if (step.decision !== 'Pending' && step.decidedAt) {
          events.push({
            id: `step-${step.id}-${req.revisionNo}`,
            title: step.decision === 'Approved' ? 'Step Approved' : 'Request Rejected',
            body: `${step.approverName} ${step.decision === 'Approved' ? 'approved' : 'rejected'} "${req.vendorName}"`,
            timestamp: new Date(step.decidedAt).getTime(),
            type: step.decision === 'Approved' ? 'success' : 'error',
          })
        }
      }

      // Fully completed with vendor code
      if (req.status === 'Completed' && req.vendorCode) {
        events.push({
          id: `complete-${req.id}`,
          title: 'Vendor Code Assigned',
          body: `${req.vendorName} approved — Vendor Code: ${req.vendorCode}`,
          timestamp: new Date(req.updatedAt).getTime(),
          type: 'success',
        })
      }

      // Buyer post-completion updates
      for (const rev of req.revisionHistory ?? []) {
        if (req.status === 'Completed' && rev.changedByUserId === req.createdByUserId) {
          events.push({
            id: `buyer-update-${req.id}-${rev.revisionNo}`,
            title: 'Buyer Updated Vendor Details',
            body: `${req.createdByName} updated details for ${req.vendorName}`,
            timestamp: new Date(rev.changedAt).getTime(),
            type: 'info',
          })
        }
      }
    }
  } else if (role === 'Buyer') {
    // Buyer sees events on their own requests
    for (const req of requests) {
      // Step approvals (intermediate steps)
      // ID uses step.decidedAt (not req.revisionNo) so buyer post-completion edits
      // that bump revisionNo don't re-surface already-read step notifications.
      for (const step of req.approvalSteps ?? []) {
        if (step.decision === 'Approved' && step.decidedAt && !step.isFinalApproval) {
          events.push({
            id: `step-approved-${step.id}-${step.decidedAt}`,
            title: 'Step Approved',
            body: `${step.approverName} approved your request for ${req.vendorName}`,
            timestamp: new Date(step.decidedAt).getTime(),
            type: 'success',
          })
        }
      }

      // Rejection
      if (req.status === 'Rejected') {
        events.push({
          id: `rejected-${req.id}-${req.revisionNo}`,
          title: 'Request Rejected',
          body: `Your request for ${req.vendorName} was rejected. Revise and resubmit.`,
          timestamp: new Date(req.updatedAt).getTime(),
          type: 'error',
        })
      }

      // Fully approved — use vendorCodeAssignedAt so timestamp stays stable
      // when buyer later edits the form (which updates req.updatedAt).
      if (req.status === 'Completed') {
        events.push({
          id: `completed-${req.id}`,
          title: 'Vendor Approved!',
          body: `${req.vendorName} fully approved — Vendor Code: ${req.vendorCode}`,
          timestamp: new Date(req.vendorCodeAssignedAt ?? req.updatedAt).getTime(),
          type: 'success',
        })
      }
    }
  } else if (role === 'Approver' || role === 'FinalApprover') {
    // Approvers see pending assignments + their own decisions
    for (const req of requests) {
      const myStep = (req.approvalSteps ?? []).find(s => s.approverUserId === userId)
      if (!myStep) continue

      if (myStep.decision === 'Pending') {
        // New pending assignment
        events.push({
          id: `assigned-${req.id}-${req.revisionNo}`,
          title: 'New Request for Review',
          body: `${req.createdByName} submitted "${req.vendorName}" — awaiting your review`,
          timestamp: new Date(req.updatedAt).getTime(),
          type: 'info',
        })
      } else if (myStep.decidedAt) {
        events.push({
          id: `decided-${req.id}-${myStep.id}-${req.revisionNo}`,
          title: myStep.decision === 'Approved' ? 'You Approved a Request' : 'You Rejected a Request',
          body: `${req.vendorName} — ${myStep.decision}`,
          timestamp: new Date(myStep.decidedAt).getTime(),
          type: myStep.decision === 'Approved' ? 'success' : 'error',
        })
      }

      // FinalApprover: notify when buyer updates a completed form they approved
      if (role === 'FinalApprover' && req.status === 'Completed') {
        for (const rev of req.revisionHistory ?? []) {
          if (rev.changedByUserId === req.createdByUserId) {
            events.push({
              id: `buyer-update-${req.id}-${rev.revisionNo}`,
              title: 'Buyer Updated Vendor Details',
              body: `${req.createdByName} updated details for ${req.vendorName}`,
              timestamp: new Date(rev.changedAt).getTime(),
              type: 'info',
            })
          }
        }
      }
    }
  }

  // Most recent first, cap at 60
  return events
    .sort((a, b) => b.timestamp - a.timestamp)
    .slice(0, 60)
}

export function useNotifications(requests, userId, role) {
  const storageKey = `readNotifIds_${userId}`

  const loadReadIds = () => {
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return new Set()
      return new Set(JSON.parse(raw))
    } catch { return new Set() }
  }

  const [readIds, setReadIds] = useState(loadReadIds)

  const events = useMemo(
    () => deriveEvents(requests, role, userId),
    [requests, role, userId]
  )

  const annotated = useMemo(
    () => events.map(e => ({ ...e, isUnread: !readIds.has(e.id) })),
    [events, readIds]
  )

  const unreadCount = annotated.filter(e => e.isUnread).length

  const markOneRead = useCallback((id) => {
    setReadIds(prev => {
      if (prev.has(id)) return prev
      const next = new Set(prev)
      next.add(id)
      localStorage.setItem(storageKey, JSON.stringify([...next]))
      return next
    })
  }, [storageKey])

  const markOneUnread = useCallback((id) => {
    setReadIds(prev => {
      if (!prev.has(id)) return prev
      const next = new Set(prev)
      next.delete(id)
      localStorage.setItem(storageKey, JSON.stringify([...next]))
      return next
    })
  }, [storageKey])

  const markAllRead = useCallback(() => {
    setReadIds(prev => {
      const allIds = events.map(e => e.id)
      const next = new Set([...prev, ...allIds])
      localStorage.setItem(storageKey, JSON.stringify([...next]))
      return next
    })
  }, [storageKey, events])

  return { notifications: annotated, unreadCount, markOneRead, markOneUnread, markAllRead }
}
