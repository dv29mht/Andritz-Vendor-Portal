import { useState, useCallback } from 'react'

/**
 * Tracks which requests an approver has already opened, keyed by revisionNo.
 * A request is "new" if never seen OR if the buyer resubmitted (higher revisionNo).
 */
export function useViewedRequests(userId) {
  const key = `viewed_reqs_${userId}`

  const load = () => {
    try {
      const parsed = JSON.parse(localStorage.getItem(key) ?? '{}')
      if (Array.isArray(parsed)) return {}   // migrate old Set-as-array format
      return parsed
    } catch { return {} }
  }

  const [viewed, setViewed] = useState(load)

  const markViewed = useCallback((req) => {
    setViewed(prev => {
      if (prev[req.id] === req.revisionNo) return prev
      const next = { ...prev, [req.id]: req.revisionNo }
      localStorage.setItem(key, JSON.stringify(next))
      return next
    })
  }, [key])

  const isNew = useCallback((req) => {
    return viewed[req.id] === undefined || viewed[req.id] < req.revisionNo
  }, [viewed])

  return { isNew, markViewed }
}
