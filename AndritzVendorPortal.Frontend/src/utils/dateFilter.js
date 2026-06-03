// Inclusive date-range filter for the request consoles.
//
// `createdAt` is a UTC ISO timestamp; `dateFrom`/`dateTo` are 'YYYY-MM-DD' strings
// from <input type="date">. The old per-console version parsed `dateFrom` as UTC
// midnight but `dateTo + 'T23:59:59'` as *local* time, so in IST (UTC+5:30) a row
// created near midnight landed on the wrong side of the boundary — an off-by-a-day.
//
// Fix: collapse everything to the IST calendar day actually shown in the UI and
// compare those YYYY-MM-DD strings lexically. No timezone arithmetic, no drift.
export function matchesIstDateRange(createdAt, dateFrom, dateTo) {
  if (!dateFrom && !dateTo) return true
  const day = new Date(createdAt).toLocaleDateString('en-CA', { timeZone: 'Asia/Kolkata' })
  if (dateFrom && day < dateFrom) return false
  if (dateTo   && day > dateTo)   return false
  return true
}
