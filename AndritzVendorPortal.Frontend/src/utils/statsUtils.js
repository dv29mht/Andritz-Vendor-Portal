/**
 * Builds daily counts for a 7-day window, one bucket per day, labelled by
 * weekday + date (e.g. "Mon 13"). Used by the "Weekly" chart view.
 *
 * `weekOffset` shifts the window back in 7-day steps: 0 = the last 7 days
 * ending today, 1 = the 7 days before that, and so on. Negative values are
 * clamped to 0 (no future weeks).
 */
export function buildWeeklyData(requests, dateField = 'createdAt', dayCount = 7, weekOffset = 0) {
  const offset = Math.max(0, Math.floor(weekOffset))
  const startOfDay = (d) => {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    return x
  }
  const fmtKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const counts = {}
  requests.forEach(r => {
    const raw = r[dateField]
    if (!raw) return
    counts[fmtKey(startOfDay(new Date(raw)))] = (counts[fmtKey(startOfDay(new Date(raw)))] ?? 0) + 1
  })
  const days = []
  for (let i = dayCount - 1; i >= 0; i--) {
    const d = startOfDay(new Date())
    d.setDate(d.getDate() - i - offset * dayCount)
    const label = d.toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', timeZone: 'Asia/Kolkata' })
    days.push({ key: fmtKey(d), label, count: counts[fmtKey(d)] ?? 0 })
  }
  return days
}

/**
 * Builds daily counts within an inclusive [from, to] range. Capped at ~62 buckets.
 */
export function buildCustomRangeData(requests, dateField = 'createdAt', from, to) {
  if (!from || !to) return []
  const fromD = new Date(from); fromD.setHours(0, 0, 0, 0)
  const toD = new Date(to); toD.setHours(23, 59, 59, 999)
  if (fromD > toD) return []
  const fmtKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const counts = {}
  requests.forEach(r => {
    const raw = r[dateField]
    if (!raw) return
    const d = new Date(raw)
    if (d < fromD || d > toD) return
    counts[fmtKey(d)] = (counts[fmtKey(d)] ?? 0) + 1
  })
  const out = []
  const cursor = new Date(fromD)
  for (let i = 0; cursor <= toD && i < 62; i++) {
    out.push({
      key: fmtKey(cursor),
      label: cursor.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', timeZone: 'Asia/Kolkata' }),
      count: counts[fmtKey(cursor)] ?? 0,
    })
    cursor.setDate(cursor.getDate() + 1)
  }
  return out
}

/**
 * Builds monthly counts for the last N months from a list of requests.
 * Uses createdAt by default; pass a dateField to use a different date.
 * Pass monthCount to control the window (default 6).
 */
export function buildMonthlyData(requests, dateField = 'createdAt', monthCount = 6) {
  const counts = {}
  requests.forEach(r => {
    const raw = r[dateField]
    if (!raw) return
    const d = new Date(raw)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    counts[key] = (counts[key] ?? 0) + 1
  })
  const months = []
  for (let i = monthCount - 1; i >= 0; i--) {
    const d = new Date()
    d.setDate(1)
    d.setMonth(d.getMonth() - i)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit', timeZone: 'Asia/Kolkata' })
    months.push({ key, label, count: counts[key] ?? 0 })
  }
  return months
}

/**
 * Computes summary statistics from a list of vendor requests.
 * Returns keys used by both AdminConsole (final) and FinalApproverConsole (finalPending).
 */
export function buildStats(requests) {
  const total      = requests.length
  const completed  = requests.filter(r => r.status === 'Completed').length
  const rejected   = requests.filter(r => r.status === 'Rejected').length
  const reEdited   = requests.filter(r => r.revisionNo > 0).length
  const finalCount = requests.filter(r => r.status === 'PendingFinalApproval').length
  const pct = n => total === 0 ? '—' : `${Math.round((n / total) * 100)}%`

  return {
    total,
    pending:       requests.filter(r => r.status === 'PendingApproval').length,
    final:         finalCount,   // key used by AdminConsole STAT_CARDS
    finalPending:  finalCount,   // key used by FinalApproverConsole METRICS
    rejected,
    completed,
    approvalRate:  pct(completed),
    reEditRate:    pct(reEdited),
    rejectionRate: pct(rejected),
  }
}
