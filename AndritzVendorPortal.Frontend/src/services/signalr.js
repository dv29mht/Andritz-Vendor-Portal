import { HubConnectionBuilder, HttpTransportType, LogLevel } from '@microsoft/signalr'

// Singleton connection — one per browser tab.
let connection = null
let connectPromise = null

function resolveHubUrl() {
  // In dev, VITE_API_URL points at the local API; strip /api and append the hub path.
  // In production, hubs live at {BASE_URL}hubs/notifications same-origin — BASE_URL
  // is "/" for Railway and "/SOT/" for the office IIS sub-app build.
  const apiOrigin = import.meta.env.VITE_API_URL
  if (apiOrigin) {
    return apiOrigin.replace(/\/api\/?$/, '') + '/hubs/notifications'
  }
  return `${import.meta.env.BASE_URL}hubs/notifications`
}

export function startNotifications(onWorkflowChanged) {
  if (connection) return connectPromise

  connection = new HubConnectionBuilder()
    .withUrl(resolveHubUrl(), {
      // SignalR cannot set Authorization headers on the WebSocket handshake,
      // so we hand it the JWT via accessTokenFactory — it surfaces as
      // ?access_token=... and the backend reads it in JwtBearerEvents.
      accessTokenFactory: () => localStorage.getItem('authToken') ?? '',
      transport: HttpTransportType.WebSockets | HttpTransportType.LongPolling,
    })
    .withAutomaticReconnect([0, 2000, 5000, 10000, 30000])
    // Critical suppresses the normal "WebSocket closed 1006" noise that
    // fires on every server redeploy — withAutomaticReconnect handles it.
    .configureLogging(LogLevel.Critical)
    .build()

  connection.on('workflowChanged', () => {
    try { onWorkflowChanged?.() } catch (err) { console.error('[signalr] handler error', err) }
  })

  // After auto-reconnect, refetch state so we don't silently miss any
  // workflowChanged events that fired while we were offline.
  connection.onreconnected(() => {
    try { onWorkflowChanged?.() } catch (err) { console.error('[signalr] reconnect handler error', err) }
  })

  connectPromise = connection.start().catch(err => {
    console.error('[signalr] connection failed:', err)
    connection = null
    connectPromise = null
  })
  return connectPromise
}

export async function stopNotifications() {
  if (!connection) return
  try { await connection.stop() } catch { /* ignore */ }
  connection = null
  connectPromise = null
}
