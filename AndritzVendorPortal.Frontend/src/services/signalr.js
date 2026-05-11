import { HubConnectionBuilder, HttpTransportType, LogLevel } from '@microsoft/signalr'

// Singleton connection — one per browser tab.
let connection = null
let connectPromise = null

function resolveHubUrl() {
  // api.js uses '/api' in production (Vercel proxy) and an absolute URL in dev.
  // Vercel's HTTP rewrite does not reliably forward WebSocket upgrades, so for
  // production we point SignalR at the API origin directly when VITE_API_URL is set.
  // In dev, VITE_API_URL should point at the local API.
  const apiOrigin = import.meta.env.VITE_API_URL
  if (apiOrigin) {
    // Strip trailing /api so we can append /hubs/notifications cleanly.
    return apiOrigin.replace(/\/api\/?$/, '') + '/hubs/notifications'
  }
  return '/hubs/notifications'
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
    .withAutomaticReconnect()
    .configureLogging(LogLevel.Warning)
    .build()

  connection.on('workflowChanged', () => {
    try { onWorkflowChanged?.() } catch (err) { console.error('[signalr] handler error', err) }
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
