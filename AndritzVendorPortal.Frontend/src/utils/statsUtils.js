/**
 * Builds monthly counts for the last 6 months from a list of requests.
 * Uses createdAt by default; pass a dateField to use a different date.
 */
export function buildMonthlyData(requests, dateField = 'createdAt') {
  const counts = {}
  requests.forEach(r => {
    const raw = r[dateField]
    if (!raw) return
    const d = new Date(raw)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    counts[key] = (counts[key] ?? 0) + 1
  })
  const months = []
  for (let i = 5; i >= 0; i--) {
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
