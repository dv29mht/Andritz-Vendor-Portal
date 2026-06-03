import { HubConnectionBuilder, HttpTransportType, LogLevel, HubConnectionState } from '@microsoft/signalr'

// Singleton connection — one per browser tab.
let connection = null
let connectPromise = null
// The live workflowChanged handler. Kept in a module variable (rather than captured
// in the closure at build time) so a re-login rebinds the new session's callback even
// if the underlying connection is reused.
let currentHandler = null

function resolveHubUrl() {
  // In dev, VITE_API_URL points at the local API; strip /api and append the hub path.
  // In production, hubs live at {BASE_URL}hubs/notifications same-origin — BASE_URL
  // is "/" for Railway and "/SOT/" for the office IIS sub-app build.
  //
  // VITE_API_URL is only honoured in dev (mirrors api.js). Vite bakes .env into
  // every build, so without the DEV guard the production /SOT bundle would point
  // SignalR at the dev server (localhost:5000) while all REST calls correctly go
  // same-origin — exactly the negotiate/ERR_CONNECTION_REFUSED failure.
  const apiOrigin = import.meta.env.DEV ? import.meta.env.VITE_API_URL : null
  if (apiOrigin) {
    return apiOrigin.replace(/\/api\/?$/, '') + '/hubs/notifications'
  }
  return `${import.meta.env.BASE_URL}hubs/notifications`
}

export function startNotifications(onWorkflowChanged) {
  // Always adopt the latest session's callback.
  currentHandler = onWorkflowChanged

  // Reuse only a genuinely live connection. After a fast logout→login the previous
  // connection may be mid-stop (Disconnecting/Disconnected) and wired to the old
  // session; returning its promise would leave the new session with no live events
  // and silently fall back to the 15s poll. Tear any non-live socket down and rebuild.
  if (connection && connection.state === HubConnectionState.Connected) {
    return connectPromise
  }
  if (connection && (connection.state === HubConnectionState.Connecting
                  || connection.state === HubConnectionState.Reconnecting)) {
    return connectPromise
  }
  if (connection) {
    try { connection.stop() } catch { /* ignore */ }
    connection = null
    connectPromise = null
  }

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
    try { currentHandler?.() } catch (err) { console.error('[signalr] handler error', err) }
  })

  // After auto-reconnect, refetch state so we don't silently miss any
  // workflowChanged events that fired while we were offline.
  connection.onreconnected(() => {
    try { currentHandler?.() } catch (err) { console.error('[signalr] reconnect handler error', err) }
  })

  connectPromise = connection.start().catch(err => {
    console.error('[signalr] connection failed:', err)
    connection = null
    connectPromise = null
  })
  return connectPromise
}

export async function stopNotifications() {
  currentHandler = null
  if (!connection) return
  try { await connection.stop() } catch { /* ignore */ }
  connection = null
  connectPromise = null
}
