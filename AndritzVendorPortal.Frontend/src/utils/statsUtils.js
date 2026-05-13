/**
 * Builds counts grouped by the last N ISO weeks (Monday start) from a list of requests.
 */
export function buildWeeklyData(requests, dateField = 'createdAt', weekCount = 8) {
  const startOfWeek = (d) => {
    const x = new Date(d)
    x.setHours(0, 0, 0, 0)
    const day = (x.getDay() + 6) % 7 // Monday-based
    x.setDate(x.getDate() - day)
    return x
  }
  const fmtKey = (d) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  const counts = {}
  requests.forEach(r => {
    const raw = r[dateField]
    if (!raw) return
    counts[fmtKey(startOfWeek(new Date(raw)))] = (counts[fmtKey(startOfWeek(new Date(raw)))] ?? 0) + 1
  })
  const weeks = []
  for (let i = weekCount - 1; i >= 0; i--) {
    const d = startOfWeek(new Date())
    d.setDate(d.getDate() - i * 7)
    const label = d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })
    weeks.push({ key: fmtKey(d), label, count: counts[fmtKey(d)] ?? 0 })
  }
  return weeks
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
      label: cursor.toLocaleDateString('en-IN', { day: '2-digit', month: 'short' }),
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
    const label = d.toLocaleDateString('en-IN', { month: 'short', year: '2-digit' })
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
