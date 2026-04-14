const API_BASE =
  import.meta.env.VITE_API_BASE ||
  (typeof window !== 'undefined' ? window.location.origin : 'http://localhost:8000')

export async function fetchGraph() {
  const response = await fetch(`${API_BASE}/graph`)
  if (!response.ok) throw new Error('Failed to load stadium graph')
  return response.json()
}

export async function fetchRoute(start, end, accessible) {
  const params = new URLSearchParams({ start, end, accessible: String(accessible) })
  const response = await fetch(`${API_BASE}/route?${params}`)
  if (!response.ok) {
    const data = await response.json().catch(() => ({}))
    throw new Error(data.detail || 'Failed to calculate route')
  }
  return response.json()
}

export async function fetchRecommendations(type, from, accessible) {
  const params = new URLSearchParams({ type, from, accessible: String(accessible) })
  const response = await fetch(`${API_BASE}/recommendations?${params}`)
  if (!response.ok) throw new Error(`Failed to fetch ${type} recommendations`)
  return response.json()
}

export async function fetchAdvice(payload) {
  const response = await fetch(`${API_BASE}/ai_advice`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  })
  if (!response.ok) throw new Error('Failed to fetch AI advice')
  return response.json()
}

export function openSimulationSocket(onMessage) {
  const socketBase = API_BASE.replace(/^http/, 'ws')
  const socket = new WebSocket(`${socketBase}/ws/simulation`)
  socket.onmessage = (event) => {
    onMessage(JSON.parse(event.data))
  }
  return socket
}
