export type Session = { access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } }
export type EventRow = { id: string; event_type: string; event_date: string; note: string; created_at: string; event_attachments?: { file_name: string; object_path: string }[] }
export type PostRow = { id: string; body: string; created_at: string; author_id: string }
export type MessageRow = { id: string; body: string; created_at: string; sender_id: string }
export type WeatherStationRow = { id: string; slug: string; name: string; area: string; source_url: string; source_license: string; source_time_basis: string; vertical_datum: string }
export type WeatherObservationRow = { recorded_at: string; tide_level_m: number | null; water_temp_c: number | null }

const url = import.meta.env.VITE_SUPABASE_URL?.replace(/\/(?:rest\/v1|auth\/v1|graphql\/v1)\/?$/, '').replace(/\/$/, '')
const key = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY
const sessionKey = 'lagoon.supabase.session'

export const backendReady = Boolean(url && key)
export function readSession(): Session | null {
  try { return JSON.parse(localStorage.getItem(sessionKey) ?? 'null') as Session | null } catch { return null }
}
function saveSession(session: Session | null) { if (session) localStorage.setItem(sessionKey, JSON.stringify({ ...session, expires_at: session.expires_at ?? Math.floor(Date.now() / 1000) + Number((session as Session & { expires_in?: number }).expires_in ?? 3600) })); else localStorage.removeItem(sessionKey) }
async function authRequest(path: string, body?: unknown) {
  if (!url || !key) throw new Error('Backend is not configured. Add the Supabase URL and publishable key.')
  const response = await fetch(`${url}/auth/v1/${path}`, { method: 'POST', headers: { apikey: key, 'Content-Type': 'application/json' }, body: JSON.stringify(body ?? {}) })
  const payload = await response.json()
  if (!response.ok) throw new Error(payload.msg ?? payload.message ?? payload.error_description ?? 'Authentication failed.')
  return payload as Session
}
export async function signIn(email: string, password: string) { const session = await authRequest('token?grant_type=password', { email, password }); saveSession(session); return session }
export async function signUp(email: string, password: string, displayName: string) { const session = await authRequest('signup', { email, password, data: { display_name: displayName } }); if (session.access_token) saveSession(session); return session }
export function signOut() { saveSession(null) }
function base64Url(bytes: Uint8Array) { let binary = ''; bytes.forEach((value) => { binary += String.fromCharCode(value) }); return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '') }
export async function signInWithProvider(provider: 'google' | 'custom:instagram') {
  if (!url || !key) throw new Error('Backend is not configured.')
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)))
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  sessionStorage.setItem('lagoon.supabase.oauth-verifier', verifier)
  // A top-level browser navigation cannot set request headers, so Supabase's
  // authorize endpoint needs the publishable key as a query parameter.
  const params = new URLSearchParams({ apikey: key, provider, redirect_to: `${window.location.origin}${window.location.pathname}`, code_challenge: challenge, code_challenge_method: 's256' })
  window.location.assign(`${url}/auth/v1/authorize?${params.toString()}`)
}
export async function exchangeOAuthCode(code: string) {
  const verifier = sessionStorage.getItem('lagoon.supabase.oauth-verifier')
  if (!verifier) throw new Error('The sign-in session expired. Please try again.')
  const session = await authRequest('token?grant_type=pkce', { auth_code: code, code_verifier: verifier })
  sessionStorage.removeItem('lagoon.supabase.oauth-verifier')
  saveSession(session)
  return session
}

async function validSession() {
  const session = readSession()
  if (!session || !session.expires_at || session.expires_at > Math.floor(Date.now() / 1000) + 60) return session
  const refreshed = await authRequest('token?grant_type=refresh_token', { refresh_token: session.refresh_token })
  saveSession(refreshed)
  return readSession()
}
async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  if (!url || !key) throw new Error('Backend is not configured.')
  const session = await validSession()
  const response = await fetch(`${url}/rest/v1/${path}`, { ...init, headers: { apikey: key, Authorization: `Bearer ${session?.access_token ?? key}`, 'Content-Type': 'application/json', ...init.headers } })
  if (!response.ok) {
    const payload = await response.json().catch(() => null)
    throw new Error(payload?.message ?? `Backend request failed (${response.status}).`)
  }
  const body = await response.text()
  return body ? JSON.parse(body) as T : undefined as T
}
export const getEvents = () => request<EventRow[]>('events?select=*,event_attachments(file_name,object_path)&order=event_date.desc,created_at.desc')
export async function createEvent(event: { event_type: string; event_date: string; note: string }, files: File[]) {
  const [created] = await request<EventRow[]>('events?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(event) })
  for (const file of files) {
    const session = await validSession()
    const objectPath = `${session?.user.id}/${created.id}/${crypto.randomUUID()}-${file.name}`
    const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/')
    const upload = await fetch(`${url}/storage/v1/object/lagoon-attachments/${encodedPath}`, { method: 'POST', headers: { apikey: key!, Authorization: `Bearer ${session?.access_token}`, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }, body: file })
    if (!upload.ok) throw new Error(`Could not upload ${file.name}.`)
    await request('event_attachments', { method: 'POST', body: JSON.stringify({ event_id: created.id, file_name: file.name, object_path: objectPath, content_type: file.type, size_bytes: file.size }) })
  }
  return created
}
export const getPosts = () => request<PostRow[]>('posts?select=*&order=created_at.desc&limit=50')
export const createPost = (body: string) => request('posts', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ body }) })
export const getMessages = () => request<MessageRow[]>('messages?select=*&order=created_at.asc&limit=200')
export const createMessage = (body: string) => request('messages', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ body }) })
export async function getWeatherStation() {
  const rows = await request<WeatherStationRow[]>('weather_stations?select=id,slug,name,area,source_url,source_license,source_time_basis,vertical_datum&slug=eq.punta-salute-canal-grande&limit=1')
  return rows[0] ?? null
}
export const getWeatherObservations = (stationId: string, limit = 288) => request<WeatherObservationRow[]>(`weather_observations?select=recorded_at,tide_level_m,water_temp_c&station_id=eq.${stationId}&order=recorded_at.desc&limit=${limit}`)
