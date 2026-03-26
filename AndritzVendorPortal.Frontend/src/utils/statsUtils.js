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
