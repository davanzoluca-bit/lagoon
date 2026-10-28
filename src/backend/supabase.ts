export type Session = { access_token: string; refresh_token: string; expires_at?: number; user: { id: string; email?: string; user_metadata?: Record<string, unknown> } }
export type FishSpeciesRow = { id: number; slug: string; name_it: string; name_en: string }
export type FriendProfileRow = { id: string; display_name: string }
export type FriendConnectionRow = { id: string; user_id: string; friend_id: string; status: 'pending' | 'accepted'; created_at: string }
export type FriendConnection = FriendConnectionRow & { incoming: boolean; profile: FriendProfileRow }
export type EventCatchInput = { species_id: number; quantity: number; caught_on: string | null; caught_time: string | null; latitude: number | null; longitude: number | null }
export type EventCatchRow = EventCatchInput & { id: string; fish_species?: FishSpeciesRow | null }
export type EventAttachmentRow = { file_name: string; object_path: string; content_type: string }
export type EventRow = { id: string; owner_id: string; event_type: string; event_date: string; start_at: string | null; end_at: string | null; note: string; tags: string[]; created_at: string; event_participants?: { user_id: string }[]; event_attachments?: EventAttachmentRow[]; event_catches?: EventCatchRow[] }
export type PostAttachmentRow = { file_name: string; object_path: string; content_type: string }
export type PostVisibility = 'public' | 'friends' | 'selected'
export type PostRow = { id: string; body: string; created_at: string; author_id: string; visibility: PostVisibility; post_attachments?: PostAttachmentRow[] }
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
export function getOAuthRedirectUrl(origin: string, siteUrl?: string, vercelUrl?: string) {
  let target = siteUrl?.trim() || vercelUrl?.trim() || origin
  if (!target.startsWith('http://') && !target.startsWith('https://')) {
    target = `${target === 'localhost' || target.startsWith('localhost:') ? 'http' : 'https'}://${target}`
  }
  return new URL('/', target).toString()
}
export async function signInWithProvider(provider: 'google' | 'custom:instagram') {
  if (!url || !key) throw new Error('Backend is not configured.')
  const verifier = base64Url(crypto.getRandomValues(new Uint8Array(64)))
  const challenge = base64Url(new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(verifier))))
  sessionStorage.setItem('lagoon.supabase.oauth-verifier', verifier)
  // A top-level browser navigation cannot set request headers, so Supabase's
  // authorize endpoint needs the publishable key as a query parameter.
  const params = new URLSearchParams({ apikey: key, provider, redirect_to: getOAuthRedirectUrl(window.location.origin, import.meta.env.VITE_SITE_URL, import.meta.env.VITE_VERCEL_URL), code_challenge: challenge, code_challenge_method: 's256' })
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
export const getEvents = () => request<EventRow[]>('events?select=*,event_participants(user_id),event_attachments(file_name,object_path,content_type),event_catches(id,species_id,quantity,caught_on,caught_time,latitude,longitude,fish_species(id,slug,name_it,name_en))&order=event_date.desc,created_at.desc')
export const getFishSpecies = () => request<FishSpeciesRow[]>('fish_species?select=id,slug,name_it,name_en&is_active=eq.true&order=name_it.asc')
export async function searchUsers(userId: string, query: string) {
  if (!query.trim()) return []
  const params = new URLSearchParams({ select: 'id,display_name', id: `neq.${userId}`, display_name: `ilike.*${query.trim().replace(/[%_,]/g, '')}*`, limit: '20', order: 'display_name.asc' })
  return request<FriendProfileRow[]>(`profiles?${params.toString()}`)
}
export async function getFriendConnections(userId: string) {
  const params = new URLSearchParams({ select: 'id,user_id,friend_id,status,created_at', or: `(user_id.eq.${userId},friend_id.eq.${userId})`, order: 'created_at.desc' })
  const connections = await request<FriendConnectionRow[]>(`friendships?${params.toString()}`)
  const profileIds = [...new Set(connections.map((row) => row.user_id === userId ? row.friend_id : row.user_id))]
  if (!profileIds.length) return []
  const profiles = await request<FriendProfileRow[]>(`profiles?select=id,display_name&id=in.(${profileIds.map(encodeURIComponent).join(',')})`)
  const profilesById = new Map(profiles.map((profile) => [profile.id, profile]))
  return connections.map((row) => {
    const friendId = row.user_id === userId ? row.friend_id : row.user_id
    return { ...row, incoming: row.friend_id === userId, profile: profilesById.get(friendId) ?? { id: friendId, display_name: '' } }
  })
}
export async function getAcceptedFriends(userId: string) {
  return (await getFriendConnections(userId)).filter((connection) => connection.status === 'accepted').map(({ profile }) => profile)
}
export const sendFriendRequest = (userId: string, friendId: string) => request('friendships', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ user_id: userId, friend_id: friendId }) })
export const acceptFriendRequest = (requestId: string) => request(`friendships?id=eq.${requestId}`, { method: 'PATCH', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ status: 'accepted', accepted_at: new Date().toISOString() }) })
export const removeFriendConnection = (connectionId: string) => request(`friendships?id=eq.${connectionId}`, { method: 'DELETE' })
async function getStorageObjectUrl(bucket: string, objectPath: string, downloadName?: string) {
  if (!url || !key) throw new Error('Backend is not configured.')
  const session = await validSession()
  const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/')
  const response = await fetch(`${url}/storage/v1/object/sign/${bucket}/${encodedPath}`, {
    method: 'POST', headers: { apikey: key, Authorization: `Bearer ${session?.access_token ?? key}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ expiresIn: 3600 }),
  })
  const payload = await response.json().catch(() => null)
  if (!response.ok || !payload?.signedURL) throw new Error(payload?.message ?? 'Could not open this attachment.')
  const signed = new URL(`${url}/storage/v1${payload.signedURL}`)
  if (downloadName) signed.searchParams.set('download', downloadName)
  return signed.toString()
}
export const getEventAttachmentUrl = (objectPath: string, downloadName?: string) => getStorageObjectUrl('lagoon-attachments', objectPath, downloadName)
export const getPostMediaUrl = (objectPath: string) => getStorageObjectUrl('lagoon-feed-media', objectPath)
export type EventWrite = { event_type: string; event_date: string; start_at: string | null; end_at: string | null; note: string; tags: string[] }
export async function createEvent(event: EventWrite, catches: EventCatchInput[], sharedUserIds: string[], files: File[]) {
  const [created] = await request<EventRow[]>('events?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify(event) })
  await saveEventCatches(created.id, catches)
  await saveEventParticipants(created.id, sharedUserIds)
  await uploadEventFiles(created.id, files)
  return created
}
async function saveEventCatches(eventId: string, catches: EventCatchInput[]) {
  await request(`event_catches?event_id=eq.${eventId}`, { method: 'DELETE' })
  if (catches.length) await request('event_catches', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(catches.map((item) => ({ ...item, event_id: eventId }))) })
}
async function uploadEventFiles(eventId: string, files: File[]) {
  for (const file of files) {
    const session = await validSession()
    const objectPath = `${session?.user.id}/${eventId}/${crypto.randomUUID()}-${file.name}`
    const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/')
    const upload = await fetch(`${url}/storage/v1/object/lagoon-attachments/${encodedPath}`, { method: 'POST', headers: { apikey: key!, Authorization: `Bearer ${session?.access_token}`, 'Content-Type': file.type || 'application/octet-stream', 'x-upsert': 'false' }, body: file })
    if (!upload.ok) throw new Error(`Could not upload ${file.name}.`)
    await request('event_attachments', { method: 'POST', body: JSON.stringify({ event_id: eventId, file_name: file.name, object_path: objectPath, content_type: file.type, size_bytes: file.size }) })
  }
}
async function saveEventParticipants(eventId: string, userIds: string[]) {
  const current = await request<{ user_id: string }[]>(`event_participants?select=user_id&event_id=eq.${eventId}`)
  const currentIds = current.map((participant) => participant.user_id)
  const removedIds = currentIds.filter((userId) => !userIds.includes(userId))
  const addedIds = userIds.filter((userId) => !currentIds.includes(userId))
  if (removedIds.length) await request(`event_participants?event_id=eq.${eventId}&user_id=in.(${removedIds.map(encodeURIComponent).join(',')})`, { method: 'DELETE' })
  if (addedIds.length) await request('event_participants', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify(addedIds.map((userId) => ({ event_id: eventId, user_id: userId }))) })
}
export async function updateEvent(eventId: string, event: EventWrite, catches: EventCatchInput[], sharedUserIds: string[], files: File[]) {
  await request(`events?id=eq.${eventId}`, { method: 'PATCH', body: JSON.stringify(event) })
  await saveEventCatches(eventId, catches)
  await saveEventParticipants(eventId, sharedUserIds)
  await uploadEventFiles(eventId, files)
}
export async function deleteEvent(eventId: string) {
  const session = await validSession()
  const attachments = await request<{ object_path: string }[]>(`event_attachments?select=object_path&event_id=eq.${eventId}`)
  for (const { object_path: objectPath } of attachments) {
    const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/')
    const response = await fetch(`${url}/storage/v1/object/lagoon-attachments/${encodedPath}`, { method: 'DELETE', headers: { apikey: key!, Authorization: `Bearer ${session?.access_token ?? key!}` } })
    if (!response.ok) throw new Error('Could not delete all event attachments.')
  }
  await request(`events?id=eq.${eventId}`, { method: 'DELETE' })
}
export const getPosts = () => request<PostRow[]>('posts?select=*,post_attachments(file_name,object_path,content_type)&order=created_at.desc&limit=50')
export async function createPost(body: string, files: File[] = [], visibility: PostVisibility = 'public', audienceIds: string[] = []) {
  if (visibility === 'selected' && audienceIds.length === 0) throw new Error('Select at least one friend for this post.')
  const [created] = await request<PostRow[]>('posts?select=*', { method: 'POST', headers: { Prefer: 'return=representation' }, body: JSON.stringify({ body, visibility }) })
  if (visibility === 'selected') {
    await request('post_audience', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify([...new Set(audienceIds)].map((user_id) => ({ post_id: created.id, user_id }))) })
  }
  for (const file of files) {
    if (!(file.type.startsWith('image/') || file.type.startsWith('video/'))) throw new Error('Only image and video files can be attached to a post.')
    if (file.size > 50 * 1024 * 1024) throw new Error(`${file.name} is larger than the 50 MB upload limit.`)
    const session = await validSession()
    const objectPath = `${session?.user.id}/${created.id}/${crypto.randomUUID()}-${file.name}`
    const encodedPath = objectPath.split('/').map(encodeURIComponent).join('/')
    const upload = await fetch(`${url}/storage/v1/object/lagoon-feed-media/${encodedPath}`, { method: 'POST', headers: { apikey: key!, Authorization: `Bearer ${session?.access_token}`, 'Content-Type': file.type, 'x-upsert': 'false' }, body: file })
    if (!upload.ok) throw new Error(`Could not upload ${file.name}.`)
    await request('post_attachments', { method: 'POST', body: JSON.stringify({ post_id: created.id, file_name: file.name, object_path: objectPath, content_type: file.type, size_bytes: file.size }) })
  }
  return created
}
export const getMessages = () => request<MessageRow[]>('messages?select=*&order=created_at.asc&limit=200')
export const createMessage = (body: string) => request('messages', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({ body }) })
export async function getWeatherStation() {
  const rows = await request<WeatherStationRow[]>('weather_stations?select=id,slug,name,area,source_url,source_license,source_time_basis,vertical_datum&slug=eq.punta-salute-canal-grande&limit=1')
  return rows[0] ?? null
}
export async function getWeatherObservations(stationId: string, limit = 288) {
  const pageSize = 1000
  const observations: WeatherObservationRow[] = []
  for (let offset = 0; offset < limit; offset += pageSize) {
    const pageLimit = Math.min(pageSize, limit - offset)
    const page = await request<WeatherObservationRow[]>(`weather_observations?select=recorded_at,tide_level_m,water_temp_c&station_id=eq.${stationId}&order=recorded_at.desc&limit=${pageLimit}&offset=${offset}`)
    observations.push(...page)
    if (page.length < pageLimit) break
  }
  return observations
}
