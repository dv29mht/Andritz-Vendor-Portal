import { useState, useEffect, useCallback, useMemo } from 'react'
import { notificationsService } from '../services/notificationsService'

// Maps a backend notification Type to the UI tone used by NotificationBell.
function typeToTone(type) {
  switch (type) {
    case 'Rejected':     return 'error'
    case 'StepApproved':
    case 'Completed':    return 'success'
    default:             return 'info'
  }
}

// Notifications are now persisted server-side (one row per recipient per workflow
// action), so the full per-action history of every form is retained. They are read
// from /api/notifications and refetched whenever `refreshKey` changes — we pass the
// workflow requests array, which is refetched on every SignalR `workflowChanged`
// event, making the bell update in real time.
export function useNotifications(refreshKey, userId /* role kept for call-site compat */) {
  const [items, setItems] = useState([])

  const fetchNotifications = useCallback(async () => {
    if (!userId) return
    try {
      const data = await notificationsService.list()
      setItems(Array.isArray(data) ? data : [])
    } catch (err) {
      console.error('[notifications] fetch failed:', err)
    }
  }, [userId])

  // Initial load + refetch on every workflow data change (SignalR-driven).
  useEffect(() => { fetchNotifications() }, [fetchNotifications, refreshKey])

  // Resilient fallback: the bell is primarily driven by the SignalR
  // `workflowChanged` event (via refreshKey), but if that WebSocket push is
  // dropped or blocked the badge would otherwise only update on a full page
  // reload. Polling on a short interval — plus a refetch whenever the tab
  // regains focus — keeps the count current without a refresh. Bell badge
  // only; intentionally no toast/sound.
  useEffect(() => {
    if (!userId) return
    const intervalId = setInterval(fetchNotifications, 15000)
    const onVisible = () => { if (document.visibilityState === 'visible') fetchNotifications() }
    window.addEventListener('focus', onVisible)
    document.addEventListener('visibilitychange', onVisible)
    return () => {
      clearInterval(intervalId)
      window.removeEventListener('focus', onVisible)
      document.removeEventListener('visibilitychange', onVisible)
    }
  }, [fetchNotifications, userId])

  const annotated = useMemo(
    () => items.map(n => ({
      id:        n.id,
      title:     n.title,
      body:      n.body,
      type:      typeToTone(n.type),
      timestamp: new Date(n.createdAt).getTime(),
      isUnread:  !n.isRead,
    })),
    [items]
  )

  const unreadCount = annotated.filter(n => n.isUnread).length

  const markOneRead = useCallback(async (id) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n))
    try { await notificationsService.markRead(id) } catch { fetchNotifications() }
  }, [fetchNotifications])

  const markOneUnread = useCallback(async (id) => {
    setItems(prev => prev.map(n => n.id === id ? { ...n, isRead: false } : n))
    try { await notificationsService.markUnread(id) } catch { fetchNotifications() }
  }, [fetchNotifications])

  const markAllRead = useCallback(async () => {
    setItems(prev => prev.map(n => ({ ...n, isRead: true })))
    try { await notificationsService.markAllRead() } catch { fetchNotifications() }
  }, [fetchNotifications])

  return { notifications: annotated, unreadCount, markOneRead, markOneUnread, markAllRead }
}
