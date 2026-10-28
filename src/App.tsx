import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowRight, Bell, CalendarDays, ChevronDown, ChevronRight, Fish, LayoutDashboard, LocateFixed, MapPin, Menu, MessageCircle, Moon, Paperclip, Pencil, Plus, Search, Send, Settings, ShieldCheck, Sun, Sunrise, Sunset, Thermometer, Trash2, UserCheck, UserPlus, UserRound, UserX, Users, Waves, X } from 'lucide-react'
import type { HistoryRow } from './domain/weather'
import { acceptFriendRequest, backendReady, createEvent, createMessage, createPost, deleteEvent as removeEvent, exchangeOAuthCode, getAcceptedFriends, getEventAttachmentUrl, getEvents, getFishSpecies, getFriendConnections, getLunarPhases, getMessages, getPosts, getPostMediaUrl, getWeatherObservations, getWeatherStation, readSession, removeFriendConnection, searchUsers, sendFriendRequest, signIn, signInWithProvider, signOut, signUp, type EventAttachmentRow, type EventCatchInput, type EventRow, type FishSpeciesRow, type FriendConnection, type FriendProfileRow, type LunarPhaseRow, type MessageRow, type PostRow, type PostVisibility, type Session, type WeatherObservationRow, type WeatherStationRow, updateEvent } from './backend/supabase'
import { t, type Language, type TranslationKey } from './i18n'
import { AuthScreen, Avatar, Button, Card, CardHeader, Dialog, Field, IconButton, MetricCard, PageHeading, Switch } from './design-system'
import { getSolarTimes, searchPlaces, type PlaceResult, type SolarTimes } from './services/solar'

type Page = 'dashboard' | 'feed' | 'chat' | 'history' | 'forecast' | 'profile'
type UserEventCatch = { id: string; speciesId: number; speciesNameIt: string; speciesNameEn: string; quantity: number; caughtOn: string | null; caughtTime: string | null; latitude: number | null; longitude: number | null }
type UserEvent = { id: string; ownerId: string; isShared: boolean; type: string; date: string; startAt: string | null; endAt: string | null; note: string; tags: string[]; sharedUserIds: string[]; attachments: EventAttachmentRow[]; catches: UserEventCatch[] }
type CatchDraft = { key: string; speciesId: string; quantity: string; caughtOn: string; caughtTime: string; latitude: string; longitude: string }
type UserLocation = { name: string; country: string; latitude: number; longitude: number; source: 'gps' | 'manual' | 'fallback' }

const locationStorageKey = 'lagoon.user-location'
const veniceLocation: UserLocation = { name: 'Venezia', country: 'Italia', latitude: 45.4408, longitude: 12.3155, source: 'fallback' }

function mapEvent(item: EventRow, currentUserId: string): UserEvent {
  return {
    id: item.id, ownerId: item.owner_id, isShared: item.owner_id !== currentUserId, type: item.event_type, date: item.event_date, startAt: item.start_at, endAt: item.end_at, note: item.note, tags: item.tags ?? [], sharedUserIds: (item.event_participants ?? []).map((participant) => participant.user_id),
    attachments: item.event_attachments ?? [],
    catches: (item.event_catches ?? []).map((itemCatch) => ({
      id: itemCatch.id, speciesId: itemCatch.species_id,
      speciesNameIt: itemCatch.fish_species?.name_it ?? '', speciesNameEn: itemCatch.fish_species?.name_en ?? '',
      quantity: itemCatch.quantity, caughtOn: itemCatch.caught_on, caughtTime: itemCatch.caught_time, latitude: itemCatch.latitude, longitude: itemCatch.longitude,
    })),
  }
}

function readUserLocation(): UserLocation | null {
  try {
    const value = JSON.parse(localStorage.getItem(locationStorageKey) ?? 'null') as UserLocation | null
    if (!value || !Number.isFinite(value.latitude) || !Number.isFinite(value.longitude) || !['gps', 'manual', 'fallback'].includes(value.source)) return null
    return value
  } catch { return null }
}

function storeUserLocation(location: UserLocation) {
  try { localStorage.setItem(locationStorageKey, JSON.stringify(location)) } catch { /* The location remains usable for this session. */ }
}

function requestDeviceLocation(): Promise<UserLocation> {
  if (!navigator.geolocation) return Promise.reject(new Error('Geolocation is unavailable.'))
  return new Promise((resolve, reject) => navigator.geolocation.getCurrentPosition(
    ({ coords }) => resolve({ name: '', country: '', latitude: coords.latitude, longitude: coords.longitude, source: 'gps' }),
    reject,
    { enableHighAccuracy: false, maximumAge: 6 * 60 * 60 * 1000, timeout: 10000 },
  ))
}

function localDateValue() {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

function localDateTimeInput(value: string) {
  const date = new Date(value)
  return new Date(date.getTime() - date.getTimezoneOffset() * 60_000).toISOString().slice(0, 16)
}

const nav: { id: Page; key: TranslationKey; icon: typeof LayoutDashboard }[] = [
  { id: 'dashboard', key: 'dashboard', icon: LayoutDashboard }, { id: 'feed', key: 'feed', icon: Users }, { id: 'chat', key: 'chat', icon: MessageCircle },
]
const menu: { id: Page; key: TranslationKey; icon: typeof LayoutDashboard }[] = [
  { id: 'history', key: 'history', icon: Activity }, { id: 'forecast', key: 'forecast', icon: Sun }, { id: 'profile', key: 'profile', icon: UserRound },
]

export default function App() {
  const [session, setSession] = useState<Session | null>(() => readSession())
  const [page, setPage] = useState<Page>('dashboard')
  const [lang, setLang] = useState<Language>('it')
  const [dark, setDark] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [period, setPeriod] = useState('7 giorni')
  const [toast, setToast] = useState('')
  const [post, setPost] = useState('')
  const [postFiles, setPostFiles] = useState<File[]>([])
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [posts, setPosts] = useState<PostRow[]>([])
  const [lunarPhases, setLunarPhases] = useState<LunarPhaseRow[]>([])
  const [weatherStation, setWeatherStation] = useState<WeatherStationRow | null>(null)
  const [weatherObservations, setWeatherObservations] = useState<WeatherObservationRow[]>([])
  const [location, setLocation] = useState<UserLocation>(() => readUserLocation() ?? veniceLocation)
  const [locationReady, setLocationReady] = useState(() => { const saved = readUserLocation(); return Boolean(saved && saved.source !== 'gps') })
  const locationChosenByUser = useRef(['manual', 'fallback'].includes(readUserLocation()?.source ?? ''))
  const [locationDialogOpen, setLocationDialogOpen] = useState(false)
  const [locationQuery, setLocationQuery] = useState('')
  const [locationResults, setLocationResults] = useState<PlaceResult[]>([])
  const [locationSearching, setLocationSearching] = useState(false)
  const [locationMessage, setLocationMessage] = useState('')
  const [locating, setLocating] = useState(false)
  const [sunTimes, setSunTimes] = useState<SolarTimes | null>(null)
  const [solarLoading, setSolarLoading] = useState(false)
  const [solarError, setSolarError] = useState(false)
  const [draft, setDraft] = useState('')
  const [eventType, setEventType] = useState('Fishing trip')
  const [eventDate, setEventDate] = useState(localDateValue())
  const [eventNote, setEventNote] = useState('')
  const [eventFiles, setEventFiles] = useState<File[]>([])
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [events, setEvents] = useState<UserEvent[]>([])
  const [authEmail, setAuthEmail] = useState('')
  const [authPassword, setAuthPassword] = useState('')
  const [authName, setAuthName] = useState('')
  const [authMode, setAuthMode] = useState<'signin' | 'signup'>('signin')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [year, setYear] = useState('2026')
  const [search, setSearch] = useState('')
  const tr = (key: TranslationKey) => t(lang, key)

  useEffect(() => {
    if (!session) return
    Promise.all([getEvents(), getPosts(), getMessages()]).then(([eventRows, postRows, messageRows]) => {
      setEvents(eventRows.map((item) => mapEvent(item, session.user.id)))
      setPosts(postRows); setMessages(messageRows)
    }).catch((cause: Error) => setError(cause.message))
    getLunarPhases().then(setLunarPhases).catch((cause: Error) => setError(cause.message))
    getWeatherStation().then(async (stationRow) => {
      setWeatherStation(stationRow)
      setWeatherObservations(stationRow ? await getWeatherObservations(stationRow.id, 9000) : [])
    }).catch((cause: Error) => setError(cause.message))
  }, [session])
  useEffect(() => {
    if (!session || locationChosenByUser.current) return
    let cancelled = false
    const setInitialLocation = (value: UserLocation) => {
      storeUserLocation(value)
      setLocation(value)
      setLocationReady(true)
    }
    requestDeviceLocation().then((value) => {
      if (!cancelled && !locationChosenByUser.current) setInitialLocation(value)
    }).catch(() => {
      if (!cancelled && !locationChosenByUser.current) setInitialLocation(veniceLocation)
    })
    return () => { cancelled = true }
  }, [session])
  useEffect(() => {
    if (!session || !locationReady) return
    let cancelled = false
    setSolarLoading(true)
    setSolarError(false)
    getSolarTimes(location).then((result) => { if (!cancelled) setSunTimes(result) }).catch(() => { if (!cancelled) { setSunTimes(null); setSolarError(true) } }).finally(() => { if (!cancelled) setSolarLoading(false) })
    return () => { cancelled = true }
  }, [session, location.latitude, location.longitude, locationReady])
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const oauthError = params.get('error_description') ?? params.get('error')
    if (code) {
      setBusy(true)
      exchangeOAuthCode(code).then(setSession).catch((cause: Error) => setError(cause.message)).finally(() => {
        window.history.replaceState({}, document.title, window.location.pathname)
        setBusy(false)
      })
    } else if (oauthError) {
      setError(oauthError.replaceAll('+', ' '))
      window.history.replaceState({}, document.title, window.location.pathname)
    }
  }, [])
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(''), 2600); return () => window.clearTimeout(timeout) }, [toast])

  const filteredHistory = useMemo(() => weatherObservations.map((row): HistoryRow => ({ recordedAt: row.recorded_at, station: weatherStation?.name ?? 'Weather station', tideLevel: row.tide_level_m, waterTemp: row.water_temp_c })).filter((row) => `${row.recordedAt} ${row.station}`.toLowerCase().includes(search.toLowerCase()) && row.recordedAt.startsWith(year)), [search, year, weatherObservations, weatherStation])
  const go = (id: Page) => { setPage(id); setMobileNav(false) }
  const locationLabel = location.source === 'fallback' ? tr('fallbackVenice') : location.source === 'gps' ? tr('currentLocation') : `${location.name}${location.country ? `, ${location.country}` : ''}`
  const chooseLocation = (value: UserLocation) => {
    setToast(tr('locationSet'))
    locationChosenByUser.current = true
    storeUserLocation(value)
    setLocation(value)
    setLocationReady(true)
    setSunTimes(null)
    setLocationResults([])
    setLocationQuery('')
    setLocationMessage(tr('locationSet'))
    setLocationDialogOpen(false)
  }
  const useDeviceLocation = async () => {
    setLocating(true)
    setLocationMessage('')
    try { chooseLocation(await requestDeviceLocation()) }
    catch (cause) { setLocationMessage((cause as GeolocationPositionError)?.code === 1 ? tr('locationPermissionDenied') : tr('locationUnavailable')) }
    finally { setLocating(false) }
  }
  const searchForLocation = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (!locationQuery.trim()) return
    setLocationSearching(true)
    setLocationMessage('')
    try { setLocationResults(await searchPlaces(locationQuery.trim(), lang)) }
    catch { setLocationResults([]); setLocationMessage(tr('locationSearchFailed')) }
    finally { setLocationSearching(false) }
  }

  if (!backendReady) return <BackendSetup tr={tr}/>
  if (!session) return <AuthScreen lang={lang} mode={authMode} setMode={setAuthMode} email={authEmail} setEmail={setAuthEmail} password={authPassword} setPassword={setAuthPassword} name={authName} setName={setAuthName} busy={busy} error={error} onOAuth={async (provider) => { setBusy(true); setError(''); try { await signInWithProvider(provider) } catch (cause) { setBusy(false); setError((cause as Error).message) } }} onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try { const result = authMode === 'signin' ? await signIn(authEmail, authPassword) : await signUp(authEmail, authPassword, authName); if (result.access_token) setSession(result); else setError(tr('confirmEmail')) } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) } }} />

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Waves size={22} strokeWidth={2.5} /></div><span>lagoon<span className="brand-dot">.</span></span><IconButton className="close-nav" label={tr('closeMenu')} onClick={() => setMobileNav(false)}><X size={19}/></IconButton></div>
      <button className="area-switch" onClick={() => { setLocationMessage(''); setLocationDialogOpen(true) }}><span className="area-icon"><MapPin size={17}/></span><span className="area-copy"><small>{tr('activeZone')}</small><strong>{locationLabel}</strong></span><ChevronDown size={16}/></button>
      <div className="side-label">{tr('workspace')}</div>
      <nav aria-label={tr('mainNavigation')}>{nav.map(({ id, key, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => go(id)}><Icon size={18}/><span>{tr(key)}</span></button>)}</nav>
      <div className="side-label menu-label">{tr('explore')}</div>
      <nav aria-label={tr('exploreNavigation')}>{menu.map(({ id, key, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => go(id)}><Icon size={18}/><span>{tr(key)}</span></button>)}</nav>
      <div className="sidebar-spacer" />
      <button className="nav-item settings-button" onClick={() => go('profile')}><Settings size={18}/><span>{tr('settings')}</span></button>
      <button className="user-switch" onClick={() => go('profile')}><Avatar initials={(session.user.email ?? 'U').slice(0, 2).toUpperCase()} tone="me"/><span><strong>{session.user.user_metadata?.display_name as string || session.user.email}</strong><small>{session.user.email}</small></span><ChevronDown size={16}/></button>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label={tr('closeNavigation')} onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><IconButton className="mobile-menu" label={tr('openMenu')} onClick={() => setMobileNav(true)}><Menu size={21}/></IconButton><span>{tr('area')}</span><ChevronRight size={14}/><strong>{tr(({ dashboard: 'dashboard', feed: 'feed', chat: 'chat', history: 'history', forecast: 'forecast', profile: 'profile' } as const)[page])}</strong></div><div className="top-actions"><label className="search-box"><Search size={16}/><input aria-label={tr('search')} placeholder={`${tr('search')}…`} value={search} onChange={(e) => setSearch(e.target.value)}/><kbd>⌘ K</kbd></label><IconButton className="theme-toggle" onClick={() => setDark(!dark)} label={tr('changeTheme')}>{dark ? <Sun size={18}/> : <Moon size={18}/>}</IconButton><IconButton className="language-toggle" onClick={() => setLang(lang === 'it' ? 'en' : 'it')} label={tr('changeLanguage')}>{lang.toUpperCase()}</IconButton><IconButton className="notification-button" label={tr('notifications')} onClick={() => setToast(tr('noNotifications'))}><Bell size={18}/></IconButton><Avatar initials={(session.user.email ?? 'U').slice(0, 2).toUpperCase()} tone="me" className="top-avatar"/></div></header>
      <div className="page-content">{error && <div className="backend-error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}{page === 'dashboard' && <Dashboard posts={posts} lunarPhases={lunarPhases} sessionName={String(session.user.user_metadata?.display_name ?? session.user.email ?? 'Member')} station={weatherStation} observations={weatherObservations} events={events} locationLabel={locationLabel} locationReady={locationReady} sunTimes={sunTimes} solarLoading={solarLoading} solarError={solarError} tr={tr} lang={lang} go={go}/ >}{page === 'feed' && <Feed tr={tr} lang={lang} userId={session.user.id} post={post} setPost={setPost} postFiles={postFiles} setPostFiles={setPostFiles} posts={posts} onPost={async (visibility, audienceIds) => { if (post.trim() || postFiles.length) { try { await createPost(post.trim(), postFiles, visibility, audienceIds); setPosts(await getPosts()); setPost(''); setPostFiles([]); setToast(tr('postPublished')) } catch (cause) { setError((cause as Error).message) } } }}/ >}{page === 'chat' && <Chat tr={tr} messages={messages} draft={draft} setDraft={setDraft} onSend={async () => { if (draft.trim()) { try { await createMessage(draft.trim()); setMessages(await getMessages()); setDraft('') } catch (cause) { setError((cause as Error).message) } } }}/ >}{page === 'history' && <HistoryPage tr={tr} search={search} setSearch={setSearch} year={year} setYear={setYear} rows={filteredHistory}/ >}{page === 'forecast' && <Forecast tr={tr} period={period} setPeriod={setPeriod}/ >}{page === 'profile' && <Profile tr={tr} lang={lang} userId={session.user.id} name={String(session.user.user_metadata?.display_name ?? session.user.email ?? 'Member')} events={events} eventModalOpen={eventModalOpen} eventType={eventType} eventDate={eventDate} eventNote={eventNote} eventFiles={eventFiles} setEventType={setEventType} setEventDate={setEventDate} setEventNote={setEventNote} setEventFiles={setEventFiles} setEventModalOpen={setEventModalOpen} onOpenEvent={() => { setEventType('Fishing trip'); setEventDate(localDateValue()); setEventNote(''); setEventFiles([]); setEventModalOpen(true) }} onCloseEvent={() => setEventModalOpen(false)} onSaveEvent={async (event) => { try { const fields = { event_type: event.type, event_date: event.date, start_at: event.startAt ? new Date(event.startAt).toISOString() : null, end_at: event.endAt ? new Date(event.endAt).toISOString() : null, note: event.note, tags: event.tags }; if (event.id) await updateEvent(event.id, fields, event.catches, event.sharedUserIds, event.attachments); else await createEvent(fields, event.catches, event.sharedUserIds, event.attachments); setEvents((await getEvents()).map((item) => mapEvent(item, session.user.id))); setEventModalOpen(false); setToast(tr(event.id ? 'eventUpdated' : 'eventSaved')) } catch (cause) { setError((cause as Error).message) } }} onDeleteEvent={async (eventId) => { try { await removeEvent(eventId); setEvents((current) => current.filter((event) => event.id !== eventId)); setToast(tr('eventDeleted')) } catch (cause) { setError((cause as Error).message) } }}/>}</div>
      <footer className="page-footer"><span>{tr('connectedCloud')}</span><span><button onClick={() => { signOut(); setSession(null) }}>{tr('signOut')}</button> <span className="footer-sep">·</span> Lagoon <Waves size={13}/></span></footer>
    </main>
    {toast && <div className="toast" role="status"><ShieldCheck size={17}/>{toast}<IconButton label={tr('close')} onClick={() => setToast('')}><X size={15}/></IconButton></div>}
    {locationDialogOpen && <Dialog eyebrow={tr('locationSettings')} title={tr('setLocation')} description={tr('locationDescription')} closeLabel={tr('close')} onClose={() => setLocationDialogOpen(false)}>
      <div className="location-settings">
        <div className="location-current"><MapPin size={16}/><span><small>{tr('activeZone')}</small><strong>{locationLabel}</strong></span></div>
        <Button type="button" variant="secondary" disabled={locating} onClick={useDeviceLocation}><MapPin size={15}/>{locating ? tr('searchingLocation') : tr('useMyLocation')}</Button>
        {locationMessage && <p className="location-message" role="status">{locationMessage}</p>}
        <form className="location-search-form" onSubmit={searchForLocation}>
          <Field label={tr('searchLocation')}><input className="ds-field__control" value={locationQuery} onChange={(event) => setLocationQuery(event.target.value)} placeholder={tr('locationSearchPlaceholder')}/></Field>
          <Button type="submit" variant="primary" disabled={!locationQuery.trim() || locationSearching}><Search size={15}/>{locationSearching ? tr('searchingLocation') : tr('search')}</Button>
        </form>
        {locationResults.length > 0 && <div className="location-results" aria-label={tr('searchLocation')}>{locationResults.map((place) => <button type="button" key={place.id} onClick={() => chooseLocation({ name: place.admin1 ? `${place.name}, ${place.admin1}` : place.name, country: place.country, latitude: place.latitude, longitude: place.longitude, source: 'manual' })}><MapPin size={15}/><span>{place.name}{place.admin1 ? `, ${place.admin1}` : ''}<small>{place.country}</small></span><ChevronRight size={15}/></button>)}</div>}
        {locationQuery && !locationSearching && locationResults.length === 0 && !locationMessage && <p className="location-message">{tr('noLocationResults')}</p>}
        <Button type="button" variant="secondary" onClick={() => chooseLocation(veniceLocation)}>{tr('useVenice')}</Button>
      </div>
    </Dialog>}
  </div>
}

type Tr = (key: TranslationKey) => string
const lunarPhaseTranslation: Record<LunarPhaseRow['phase_code'], TranslationKey> = { LN: 'newMoon', LP: 'fullMoon', PQ: 'firstQuarter', UQ: 'lastQuarter' }
const lunarPhaseGlyph: Record<LunarPhaseRow['phase_code'], string> = { LN: '🌑', LP: '🌕', PQ: '🌓', UQ: '🌗' }

function PostAuthor({ post, lang, tr }: { post: PostRow; lang: Language; tr: Tr }) {
  const name = post.author?.display_name?.trim() || tr('unknownMember')
  return <div className="post-author-line"><Avatar initials={name.slice(0, 2).toUpperCase()} tone="sea"/><span><strong>{name}</strong><small>{new Date(post.created_at).toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB')}</small></span></div>
}

function eventTypeLabel(type: string, tr: Tr) {
  if (type === 'Fishing trip' || type === 'Uscita di pesca') return tr('catch')
  if (type === 'Measurement' || type === 'Misurazione') return tr('measurement')
  if (type === 'Note' || type === 'Nota') return tr('note')
  return type
}

function BackendSetup({ tr }: { tr: Tr }) { return <main className="auth-screen"><Card className="auth-card"><div className="brand"><div className="brand-mark"><Waves size={22}/></div><span>lagoon<span className="brand-dot">.</span></span></div><h1>{tr('connectBackend')}</h1><p>{tr('backendSetupText')}</p><p>{tr('backendSetupHelp')}</p></Card></main> }

function Dashboard({ posts, lunarPhases, sessionName, station, observations, events, locationLabel, locationReady, sunTimes, solarLoading, solarError, tr, lang, go }: { posts: PostRow[]; lunarPhases: LunarPhaseRow[]; sessionName: string; station: WeatherStationRow | null; observations: WeatherObservationRow[]; events: UserEvent[]; locationLabel: string; locationReady: boolean; sunTimes: SolarTimes | null; solarLoading: boolean; solarError: boolean; tr: Tr; lang: Language; go: (page: Page) => void }) {
  const [chartRange, setChartRange] = useState<'6h' | '12h' | '24h' | '3d' | '7d' | '30d'>('24h')
  const [showEvents, setShowEvents] = useState(false)
  const latest = observations[0]
  const latestWater = observations.find((row) => row.water_temp_c !== null)
  const latestTide = observations.find((row) => row.tide_level_m !== null)
  const formatReadingTime = (value?: string) => value ? new Date(`${value.replace(' ', 'T')}Z`).toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : tr('noReading')
  const formatSolarTime = (value?: string) => value?.match(/T(\d{2}:\d{2})/)?.[1] ?? '—'
  const solarDetail = !locationReady ? tr('locatingLocation') : solarLoading ? tr('solarLoading') : solarError ? tr('sunTimesUnavailable') : `${locationLabel} · ${tr('locationToday')}`
  const today = localDateValue()
  const previousLunarPhase = lunarPhases.filter((phase) => phase.phase_date < today).at(-1)
  const nextLunarPhase = lunarPhases.find((phase) => phase.phase_date >= today)
  const formatLunarDate = (phase: LunarPhaseRow) => `${new Date(`${phase.phase_date}T12:00:00`).toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'short' })} · ${phase.solar_time_source}`
  const rangeHours = { '6h': 6, '12h': 12, '24h': 24, '3d': 72, '7d': 168, '30d': 720 }[chartRange]
  const latestTimestamp = latest ? new Date(`${latest.recorded_at.replace(' ', 'T')}Z`).getTime() : 0
  const graphRows = observations.filter((row) => new Date(`${row.recorded_at.replace(' ', 'T')}Z`).getTime() >= latestTimestamp - rangeHours * 60 * 60 * 1000).slice().reverse()
  return <>
    <PageHeading eyebrow={`${new Date().toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}  ·  ${tr('area').toUpperCase()}`} title={`${tr('goodMorning')}, ${sessionName}`} subtitle={tr('greeting')} action={<Button variant="secondary" onClick={() => go('history')}><CalendarDays size={16}/>{tr('viewHistory')}<ArrowRight size={15}/></Button>}/>
    <div className="dashboard-toolbar"><div className="station-selector"><span className="selector-pin"><MapPin size={16}/></span><span><small>{tr('stations')}</small><strong>{station?.name ?? tr('noStationImported')}</strong></span></div><div className="live-stamp">{latest ? `${tr('sourceSnapshot')} ${formatReadingTime(latest.recorded_at)}` : tr('noImportedObservations')}</div></div>
    <section className="metrics-grid metrics-grid--source" aria-label={tr('weather')}>
      <MetricCard icon={<Thermometer/>} label={tr('waterTemperature')} value={latestWater?.water_temp_c?.toFixed(1) ?? '—'} unit="°C" detail={`${station?.name ?? 'Punta Salute Canal Grande'} · ${formatReadingTime(latestWater?.recorded_at)}`} color="blue" trend=""/>
      <MetricCard icon={<Waves/>} label={tr('tideLevel')} value={latestTide?.tide_level_m?.toFixed(2) ?? '—'} unit="m" detail={`${station?.vertical_datum ?? 'ZMPS 1897'} · ${formatReadingTime(latestTide?.recorded_at)}`} color="green" trend=""/>
      <MetricCard icon={<Sunrise/>} label={tr('sunrise')} value={!locationReady || solarLoading ? '…' : formatSolarTime(sunTimes?.sunrise)} unit="" detail={solarDetail} color="coral" trend=""/>
      <MetricCard icon={<Sunset/>} label={tr('sunset')} value={!locationReady || solarLoading ? '…' : formatSolarTime(sunTimes?.sunset)} unit="" detail={solarDetail} color="violet" trend=""/>
    </section>
    <a className="solar-attribution" href="https://open-meteo.com/" target="_blank" rel="noreferrer">{tr('solarAttribution')}</a>
    <Card className="lunar-card"><div className="lunar-card__icon"><Moon size={21}/></div><div className="lunar-card__main"><div className="eyebrow">{tr('lunarPhases')}</div><strong>{previousLunarPhase ? `${lunarPhaseGlyph[previousLunarPhase.phase_code]} ${tr(lunarPhaseTranslation[previousLunarPhase.phase_code])}` : tr('lunarDataUnavailable')}</strong><small>{previousLunarPhase ? `${tr('lastLunarPhase')} · ${formatLunarDate(previousLunarPhase)}` : tr('lunarDataUnavailable')}</small></div><div className="lunar-card__next"><small>{tr('nextLunarPhase')}</small><strong>{nextLunarPhase ? `${lunarPhaseGlyph[nextLunarPhase.phase_code]} ${tr(lunarPhaseTranslation[nextLunarPhase.phase_code])}` : '—'}</strong><span>{nextLunarPhase ? formatLunarDate(nextLunarPhase) : ''}</span></div><small className="lunar-card__basis">{tr('lunarTimeBasis')}</small></Card>
    <div className="content-grid">
      <Card className="chart-panel"><CardHeader eyebrow={tr('sourceObservations')} title={tr('chartTitle')} description={station ? `${station.name} · ${tr('chartDescription')}` : tr('importCsvHint')} action={<div className="chart-controls"><Switch checked={showEvents} onChange={setShowEvents} label={tr('showEvents')}/><label className="chart-range"><span>{tr('chartInterval')}</span><select aria-label={tr('chartInterval')} value={chartRange} onChange={(event) => setChartRange(event.target.value as typeof chartRange)}><option value="6h">{tr('range6h')}</option><option value="12h">{tr('range12h')}</option><option value="24h">{tr('range24h')}</option><option value="3d">{tr('range3d')}</option><option value="7d">{tr('range7d')}</option><option value="30d">{tr('range30d')}</option></select></label></div>}/>{graphRows.length ? <ObservationChart rows={graphRows} events={events} showEvents={showEvents} lang={lang} tr={tr}/> : <div className="empty-state">{tr('noObservationsLoaded')}</div>}<div className="chart-note"><span>{tr('fromComune')}</span><button onClick={() => go('history')}>{tr('browseData')} <ArrowRight size={14}/></button></div></Card>
      <Card className="stations-panel"><CardHeader eyebrow={tr('localNetwork')} title={tr('stations')}/>{station ? <div className="station-row selected"><div className="station-symbol"><MapPin size={17}/></div><div className="station-info"><strong>{station.name}</strong><span>{station.area}</span></div><div className="station-values"><strong>{observations.length.toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB')}</strong><span>{tr('recentRows')}</span></div></div> : <p className="empty-state">{tr('noStationsConfigured')}</p>}<a className="text-action" href={station?.source_url} target="_blank" rel="noreferrer">{tr('sourceAndLicense')} <ArrowRight size={15}/></a></Card>
    </div>
    <div className="bottom-grid"><Card className="forecast-card"><CardHeader eyebrow={tr('forecastEyebrow')} title={tr('week')}/><p className="empty-state">{tr('noForecastProvider')}</p><button className="text-action forecast-link" onClick={() => go('forecast')}>{tr('seeForecast')}<ArrowRight size={15}/></button></Card></div>
    <div className="section-title"><div><div className="eyebrow">{tr('lagoonLife')}</div><h2>{tr('community')}</h2></div><button className="link-button" onClick={() => go('feed')}>{tr('viewAll')}<ArrowRight size={14}/></button></div>
    <div className="community-grid">{posts.slice(0, 2).map((item) => <Card key={item.id} className="dashboard-post"><PostAuthor post={item} lang={lang} tr={tr}/>{item.body && <p>{item.body}</p>}{(item.post_attachments ?? []).length > 0 && <span className="dashboard-post__media">{item.post_attachments!.length} {tr('mediaAttachments')}</span>}</Card>)}{posts.length === 0 && <Card className="empty-state">{tr('noPosts')}</Card>}</div>
  </>
}

function ObservationChart({ rows, events, showEvents, lang, tr }: { rows: WeatherObservationRow[]; events: UserEvent[]; showEvents: boolean; lang: Language; tr: Tr }) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
  const [selectedEvent, setSelectedEvent] = useState<UserEvent | null>(null)
  const [attachmentUrls, setAttachmentUrls] = useState<Record<string, string>>({})
  const [attachmentError, setAttachmentError] = useState(false)
  const [pinned, setPinned] = useState(false)
  const [width, setWidth] = useState(860)
  const height = 270, left = 66, right = width - 66, top = 22, bottom = 218
  useEffect(() => {
    const target = chartRef.current
    if (!target || typeof ResizeObserver === 'undefined') return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.max(320, entry.contentRect.width)))
    observer.observe(target)
    return () => observer.disconnect()
  }, [])
  useEffect(() => {
    if (!selectedEvent) { setAttachmentUrls({}); setAttachmentError(false); return }
    let cancelled = false
    setAttachmentUrls({}); setAttachmentError(false)
    Promise.all(selectedEvent.attachments.map(async (file) => {
      const isPhoto = file.content_type?.startsWith('image/') || /\.(avif|bmp|gif|jpe?g|png|webp)$/i.test(file.file_name)
      const signedUrl = await getEventAttachmentUrl(file.object_path, isPhoto ? undefined : file.file_name)
      return [file.object_path, signedUrl] as const
    })).then((entries) => { if (!cancelled) setAttachmentUrls(Object.fromEntries(entries)) }).catch(() => { if (!cancelled) setAttachmentError(true) })
    return () => { cancelled = true }
  }, [selectedEvent])
  const series = (field: 'tide_level_m' | 'water_temp_c') => {
    const values = rows.map((row) => row[field]).filter((value): value is number => value !== null && Number.isFinite(value))
    const actualMin = values.length ? Math.min(...values) : 0
    const actualMax = values.length ? Math.max(...values) : 1
    const padding = (actualMax - actualMin || Math.abs(actualMax) * 0.1 || 1) * 0.08
    const min = actualMin - padding, max = actualMax + padding
    const y = (value: number) => bottom - (value - min) / (max - min || 1) * (bottom - top)
    const ticks = Array.from({ length: 5 }, (_, index) => min + (max - min) * index / 4)
    let drawing = false
    const path = rows.map((row, index) => {
      const value = row[field]
      if (value === null || !Number.isFinite(value)) { drawing = false; return '' }
      const x = left + index / Math.max(rows.length - 1, 1) * (right - left)
      const command = `${drawing ? 'L' : 'M'} ${x.toFixed(1)} ${y(value).toFixed(1)}`
      drawing = true
      return command
    }).filter(Boolean).join(' ')
    return { min, max, ticks, y, path }
  }
  const tide = series('tide_level_m')
  const water = series('water_temp_c')
  const xAt = (index: number) => left + index / Math.max(rows.length - 1, 1) * (right - left)
  const nearestIndex = (clientX: number) => {
    const rect = chartRef.current?.getBoundingClientRect()
    if (!rect || !rect.width || rows.length < 1) return 0
    const chartX = (clientX - rect.left) / rect.width * width
    return Math.max(0, Math.min(rows.length - 1, Math.round((chartX - left) / (right - left) * (rows.length - 1))))
  }
  const dateFormat = (value: string, options: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', { ...options, timeZone: 'UTC' }).format(new Date(`${value.replace(' ', 'T')}Z`))
  const axisNumber = (value: number) => value.toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB', { maximumFractionDigits: 2 })
  const selected = selectedIndex === null ? null : rows[selectedIndex]
  const selectedX = selectedIndex === null ? null : xAt(selectedIndex)
  const selectedWaterY = selected?.water_temp_c == null ? null : water.y(selected.water_temp_c)
  const selectedTideY = selected?.tide_level_m == null ? null : tide.y(selected.tide_level_m)
  const selectedEventTimes = selectedEvent ? [selectedEvent.startAt, selectedEvent.endAt].map((value) => value ? new Date(value).toLocaleTimeString(lang === 'it' ? 'it-IT' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '—').join('–') : ''
  const selectedEventDescription = selectedEvent ? `${dateFormat(selectedEvent.date, { day: 'numeric', month: 'long', year: 'numeric' })} · ${selectedEvent.startAt || selectedEvent.endAt ? selectedEventTimes : tr('eventDateOnly')}` : ''
  const visibleEvents = showEvents && rows.length ? events.filter((event) => {
    const eventDate = event.date.slice(0, 10)
    return eventDate >= rows[0].recorded_at.slice(0, 10) && eventDate <= rows[rows.length - 1].recorded_at.slice(0, 10)
  }) : []
  const eventPositions = visibleEvents.map((event, index) => {
    const date = event.date.slice(0, 10)
    const matchingRows = rows.map((row, rowIndex) => row.recorded_at.slice(0, 10) === date ? rowIndex : -1).filter((rowIndex) => rowIndex >= 0)
    const nearest = matchingRows.length ? (matchingRows[0] + matchingRows[matchingRows.length - 1]) / 2 : rows.findIndex((row) => row.recorded_at.slice(0, 10) >= date)
    const sameDateIndex = visibleEvents.slice(0, index).filter((item) => item.date.slice(0, 10) === date).length
    return { event, x: xAt(Math.max(0, nearest)) + (sameDateIndex % 2 ? 10 : -10) * Math.floor(sameDateIndex / 2), y: bottom - 11 }
  })
  const xTickCount = Math.min(5, rows.length, Math.max(2, Math.floor(width / 150)))
  const xTicks = Array.from(new Set(Array.from({ length: xTickCount }, (_, index) => Math.round(index * (rows.length - 1) / Math.max(xTickCount - 1, 1)))))
  const selectFromPointer = (event: React.PointerEvent<HTMLDivElement>) => setSelectedIndex(nearestIndex(event.clientX))
  const valueLabel = (value: number | null) => value === null ? '—' : axisNumber(value)

  return <>
    <div className="observation-legend"><span><i className="observation-legend__water"/>{tr('axisWater')}</span><span><i className="observation-legend__tide"/>{tr('axisTide')}</span>{visibleEvents.some((event) => event.isShared) && <span><i className="observation-legend__shared"/>{tr('sharedEventLegend')}</span>}</div>
    <div ref={chartRef} className="observation-chart-wrap" role="group" aria-label={tr('chartHint')} tabIndex={0}
      onPointerMove={(event) => { if (!pinned) selectFromPointer(event) }}
      onPointerDown={(event) => { selectFromPointer(event); setPinned(true) }}
      onPointerLeave={() => { if (!pinned) setSelectedIndex(null) }}
      onKeyDown={(event) => { if (event.key === 'ArrowRight' || event.key === 'ArrowLeft') { event.preventDefault(); setSelectedIndex((current) => Math.max(0, Math.min(rows.length - 1, (current ?? rows.length - 1) + (event.key === 'ArrowRight' ? 1 : -1)))) } if (event.key === 'Escape') { setSelectedIndex(null); setPinned(false) } }}>
      <svg className="observation-chart" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none" role="img" aria-label={`${tr('chartTitle')}. ${tr('axisTide')} e ${tr('axisWater')}`}>
        {tide.ticks.map((_, index) => { const y = bottom - index / 4 * (bottom - top); return <g key={index}><line x1={left} x2={right} y1={y} y2={y} className="observation-gridline"/><text x={left - 10} y={y + 3} textAnchor="end" className="observation-axis-label">{axisNumber(tide.ticks[4 - index])}</text><text x={right + 10} y={y + 3} textAnchor="start" className="observation-axis-label">{axisNumber(water.ticks[4 - index])}</text></g> })}
        <text x="15" y={(top + bottom) / 2} textAnchor="middle" className="observation-axis-title" transform={`rotate(-90 15 ${(top + bottom) / 2})`}>{tr('axisTide')}</text>
        <text x={width - 12} y={(top + bottom) / 2} textAnchor="middle" className="observation-axis-title" transform={`rotate(90 ${width - 12} ${(top + bottom) / 2})`}>{tr('axisWater')}</text>
        <path d={water.path} className="observation-line observation-line--water"/><path d={tide.path} className="observation-line observation-line--tide"/>
        {eventPositions.map(({ event, x, y }) => { const EventIcon = /fish|pesca/i.test(event.type) ? Fish : /measure|misuraz/i.test(event.type) ? Thermometer : /note|nota/i.test(event.type) ? MessageCircle : CalendarDays; return <g key={event.id} className={`observation-event-marker ${event.isShared ? 'observation-event-marker--shared' : ''}`} role="button" tabIndex={0} aria-label={`${event.isShared ? `${tr('sharedEvent')} · ` : ''}${tr('event')}: ${eventTypeLabel(event.type, tr)} · ${dateFormat(event.date, { day: 'numeric', month: 'long', year: 'numeric' })}`} onPointerDown={(pointerEvent) => pointerEvent.stopPropagation()} onClick={(clickEvent) => { clickEvent.stopPropagation(); setSelectedEvent(event) }} onKeyDown={(keyEvent) => { if (keyEvent.key === 'Enter' || keyEvent.key === ' ') { keyEvent.preventDefault(); keyEvent.stopPropagation(); setSelectedEvent(event) } }}><title>{eventTypeLabel(event.type, tr)} · {dateFormat(event.date, { day: 'numeric', month: 'long', year: 'numeric' })}</title><line x1={x} x2={x} y1={y + 9} y2={bottom + 1} className="observation-event-marker__stem"/><circle cx={x} cy={y} r="9" className="observation-event-marker__dot"/><EventIcon x={x - 5} y={y - 5} size={10} className="observation-event-marker__icon"/></g> })}
        {selectedX !== null && <><line x1={selectedX} x2={selectedX} y1={top} y2={bottom} className="observation-crosshair"/>{selectedWaterY !== null && <circle cx={selectedX} cy={selectedWaterY} r="4.5" className="observation-point observation-point--water"/>}{selectedTideY !== null && <circle cx={selectedX} cy={selectedTideY} r="4.5" className="observation-point observation-point--tide"/>}</>}
        {xTicks.map((index) => { const row = rows[index]; return <g key={index}><line x1={xAt(index)} x2={xAt(index)} y1={bottom} y2={bottom + 4} className="observation-axis-tick"/><text x={xAt(index)} y={bottom + 20} textAnchor={index === 0 ? 'start' : index === rows.length - 1 ? 'end' : 'middle'} className="observation-axis-label">{dateFormat(row.recorded_at, { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })}</text></g> })}
      </svg>
      {selected && selectedIndex !== null && <div className="chart-tooltip" role="status" style={{ left: `${Math.max(15, Math.min(85, xAt(selectedIndex) / width * 100))}%` }}>
        <div className="chart-tooltip__header"><strong>{dateFormat(selected.recorded_at, { day: 'numeric', month: 'long', year: 'numeric' })}</strong><span>{dateFormat(selected.recorded_at, { hour: '2-digit', minute: '2-digit' })}</span>{pinned && <button type="button" aria-label={tr('close')} onClick={() => { setPinned(false); setSelectedIndex(null) }}>×</button>}</div>
        <div><i className="observation-legend__water"/>{tr('axisWater')}: <b>{valueLabel(selected.water_temp_c)} °C</b></div>
        <div><i className="observation-legend__tide"/>{tr('axisTide')}: <b>{valueLabel(selected.tide_level_m)} m</b></div>
      </div>}
    </div>
    <div className="observation-axis-caption">{tr('sourceTime')}</div>
    {selectedEvent && <Dialog eyebrow={tr('eventDetails')} title={eventTypeLabel(selectedEvent.type, tr)} description={selectedEventDescription} closeLabel={tr('close')} onClose={() => setSelectedEvent(null)}><div className="chart-event-detail">{selectedEvent.catches.length > 0 && <><strong>{tr('catchSummary')}</strong><ul>{selectedEvent.catches.map((itemCatch) => <li key={itemCatch.id}><Fish size={14}/>{itemCatch.quantity} × {lang === 'it' ? itemCatch.speciesNameIt : itemCatch.speciesNameEn}{itemCatch.caughtOn ? ` · ${dateFormat(itemCatch.caughtOn, { day: 'numeric', month: 'long', year: 'numeric' })}` : ''}{itemCatch.caughtTime ? ` ${itemCatch.caughtTime.slice(0, 5)}` : ''}{itemCatch.latitude != null && itemCatch.longitude != null ? ` · ${itemCatch.latitude.toFixed(4)}, ${itemCatch.longitude.toFixed(4)}` : ''}</li>)}</ul></>}{selectedEvent.note ? <p>{selectedEvent.note}</p> : null}{selectedEvent.attachments.length > 0 && <><strong>{tr('eventFilesLabel')}</strong>{attachmentError && <p role="alert">{tr('attachmentUnavailable')}</p>}<ul className="event-attachment-list">{selectedEvent.attachments.map((file) => { const isPhoto = file.content_type?.startsWith('image/') || /\.(avif|bmp|gif|jpe?g|png|webp)$/i.test(file.file_name); const href = attachmentUrls[file.object_path]; return <li key={file.object_path}>{href ? isPhoto ? <a className="event-photo-link" href={href} target="_blank" rel="noreferrer"><img src={href} alt={file.file_name}/><span>{file.file_name}</span></a> : <a className="event-file-download" href={href} download={file.file_name}><Paperclip size={14}/>{file.file_name}<span>{tr('download')}</span></a> : <span className="event-file-loading">{tr('attachmentLoading')} · {file.file_name}</span>}</li> })}</ul></>}{!selectedEvent.note && selectedEvent.attachments.length === 0 && selectedEvent.catches.length === 0 && <p>{tr('noEventDetails')}</p>}</div></Dialog>}
  </>
}

function Feed({ tr, lang, userId, post, setPost, postFiles, setPostFiles, posts, onPost }: { tr: Tr; lang: Language; userId: string; post: string; setPost: (v: string) => void; postFiles: File[]; setPostFiles: (files: File[]) => void; posts: PostRow[]; onPost: (visibility: PostVisibility, audienceIds: string[]) => Promise<void> }) {
  const [connections, setConnections] = useState<FriendConnection[]>([])
  const [friendQuery, setFriendQuery] = useState('')
  const [friendResults, setFriendResults] = useState<FriendProfileRow[]>([])
  const [directoryError, setDirectoryError] = useState('')
  const [posting, setPosting] = useState(false)
  const [visibility, setVisibility] = useState<PostVisibility>('public')
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [postMediaUrls, setPostMediaUrls] = useState<Record<string, string>>({})
  const refreshConnections = async () => setConnections(await getFriendConnections(userId))
  useEffect(() => { refreshConnections().catch((cause: Error) => setDirectoryError(cause.message)) }, [userId])
  useEffect(() => {
    if (!friendQuery.trim()) { setFriendResults([]); return }
    let active = true
    const timeout = window.setTimeout(() => searchUsers(userId, friendQuery).then((results) => { if (active) setFriendResults(results) }).catch((cause: Error) => { if (active) setDirectoryError(cause.message) }), 220)
    return () => { active = false; window.clearTimeout(timeout) }
  }, [friendQuery, userId])
  useEffect(() => {
    let active = true
    const media = posts.flatMap((item) => item.post_attachments ?? [])
    Promise.all(media.map(async (item) => [item.object_path, await getPostMediaUrl(item.object_path)] as const))
      .then((entries) => { if (active) setPostMediaUrls(Object.fromEntries(entries)) })
      .catch(() => { if (active) setPostMediaUrls({}) })
    return () => { active = false }
  }, [posts])
  const runFriendAction = async (action: () => Promise<unknown>) => {
    try { setDirectoryError(''); await action(); await refreshConnections() }
    catch (cause) { setDirectoryError((cause as Error).message) }
  }
  const incoming = connections.filter((item) => item.status === 'pending' && item.incoming)
  const outgoing = connections.filter((item) => item.status === 'pending' && !item.incoming)
  const friends = connections.filter((item) => item.status === 'accepted')
  return <>
    <PageHeading eyebrow={tr('feedEyebrow')} title={tr('feed')} subtitle={tr('feedSubtitle')}/>
    <div className="feed-page-grid">
      <section className="feed-main-column">
        <Card className="composer">
          <textarea value={post} onChange={(e) => setPost(e.target.value)} placeholder={tr('newPost')}/>
          <Field label={tr('postVisibility')}><select className="ds-field__control" aria-label={tr('postVisibility')} value={visibility} onChange={(e) => setVisibility(e.target.value as PostVisibility)}><option value="public">{tr('postVisibleAll')}</option><option value="friends">{tr('postVisibleFriends')}</option><option value="selected">{tr('postVisibleSelected')}</option></select></Field>
          {visibility === 'selected' && <div className="post-audience-picker" role="group" aria-label={tr('postVisibleSelected')}>{friends.map((friend) => <label className="post-audience-option" key={friend.profile.id}><input type="checkbox" checked={selectedFriendIds.includes(friend.profile.id)} onChange={(e) => setSelectedFriendIds(e.target.checked ? [...selectedFriendIds, friend.profile.id] : selectedFriendIds.filter((id) => id !== friend.profile.id))}/><span>{friend.profile.display_name || friend.profile.id}</span></label>)}{friends.length === 0 && <small>{tr('noFriendsYet')}</small>}</div>}
          <div className="post-media-picker">
            <label className="ds-upload"><Paperclip size={17}/><span className="ds-upload__copy"><strong className="ds-upload__title">{tr('feedMedia')}</strong><small className="ds-upload__hint">{tr('feedMediaHint')}</small></span><input type="file" accept="image/*,video/*" multiple onChange={(e) => setPostFiles([...postFiles, ...Array.from(e.target.files ?? [])])}/></label>
            {postFiles.length > 0 && <ul className="ds-attachment-list">{postFiles.map((file, index) => <li key={`${file.name}-${index}`}><Paperclip size={13}/><span>{file.name}</span><small>{(file.size / 1024 / 1024).toFixed(1)} MB</small><IconButton label={`${tr('removeMedia')}: ${file.name}`} onClick={() => setPostFiles(postFiles.filter((_, fileIndex) => fileIndex !== index))}><X size={14}/></IconButton></li>)}</ul>}
          </div>
          <div className="composer-bottom"><Button variant="primary" disabled={posting || (!post.trim() && postFiles.length === 0) || (visibility === 'selected' && selectedFriendIds.length === 0)} onClick={async () => { setPosting(true); try { await onPost(visibility, selectedFriendIds); setVisibility('public'); setSelectedFriendIds([]) } finally { setPosting(false) } }}>{posting ? tr('pleaseWait') : tr('publish')}<ArrowRight size={15}/></Button></div>
        </Card>
        <div className="feed-list">{posts.length ? posts.map((item) => <Card key={item.id} className="community-entry"><PostAuthor post={item} lang={lang} tr={tr}/>{item.body && <p>{item.body}</p>}{(item.post_attachments ?? []).length > 0 && <div className="post-media-grid">{item.post_attachments!.map((media) => { const mediaUrl = postMediaUrls[media.object_path]; return <div className="post-media-item" key={media.object_path}>{mediaUrl ? media.content_type.startsWith('video/') ? <video src={mediaUrl} controls preload="metadata" aria-label={media.file_name}/> : <img src={mediaUrl} alt={media.file_name}/> : <span>{tr('attachmentLoading')}</span>}</div> })}</div>}</Card>) : <Card className="empty-state">{tr('shareFirst')}</Card>}</div>
      </section>
      <Card className="friends-directory">
        <CardHeader eyebrow={tr('friends')} title={tr('friends')}/>
        <Field label={tr('searchFriends')}><input className="ds-field__control" value={friendQuery} onChange={(e) => setFriendQuery(e.target.value)} placeholder={tr('searchFriends')}/></Field>
        {directoryError && <p className="backend-error" role="alert">{directoryError}</p>}
        {friendQuery.trim() && <div className="friend-results">{friendResults.map((profile) => { const connection = connections.find((item) => item.profile.id === profile.id); return <div className="friend-row" key={profile.id}><Avatar initials={(profile.display_name || '?').slice(0, 2).toUpperCase()} tone="sea"/><span>{profile.display_name || profile.id}</span>{!connection && <IconButton label={`${tr('addFriend')}: ${profile.display_name}`} onClick={() => runFriendAction(() => sendFriendRequest(userId, profile.id))}><UserPlus size={16}/></IconButton>}{connection?.status === 'accepted' && <IconButton label={`${tr('removeFriend')}: ${profile.display_name}`} onClick={() => runFriendAction(() => removeFriendConnection(connection.id))}><UserCheck size={16}/></IconButton>}{connection?.status === 'pending' && <small>{connection.incoming ? tr('incomingRequests') : tr('outgoingRequests')}</small>}</div> })}{friendResults.length === 0 && <p className="empty-state">{tr('noMatchingFriends')}</p>}</div>}
        <section className="friend-section"><h3>{tr('incomingRequests')}</h3>{incoming.map((item) => <div className="friend-row" key={item.id}><Avatar initials={(item.profile.display_name || '?').slice(0, 2).toUpperCase()} tone="sea"/><span>{item.profile.display_name || item.profile.id}</span><IconButton label={`${tr('acceptFriend')}: ${item.profile.display_name}`} onClick={() => runFriendAction(() => acceptFriendRequest(item.id))}><UserCheck size={16}/></IconButton><IconButton label={`${tr('declineFriend')}: ${item.profile.display_name}`} onClick={() => runFriendAction(() => removeFriendConnection(item.id))}><UserX size={16}/></IconButton></div>)}{incoming.length === 0 && <small>{tr('noFriendRequests')}</small>}</section>
        <section className="friend-section"><h3>{tr('outgoingRequests')}</h3>{outgoing.map((item) => <div className="friend-row" key={item.id}><Avatar initials={(item.profile.display_name || '?').slice(0, 2).toUpperCase()} tone="sea"/><span>{item.profile.display_name || item.profile.id}</span><small>{tr('friendRequestSent')}</small><IconButton label={`${tr('declineFriend')}: ${item.profile.display_name}`} onClick={() => runFriendAction(() => removeFriendConnection(item.id))}><X size={15}/></IconButton></div>)}{outgoing.length === 0 && <small>{tr('noFriendRequests')}</small>}</section>
        <section className="friend-section"><h3>{tr('friends')}</h3>{friends.map((item) => <div className="friend-row" key={item.id}><Avatar initials={(item.profile.display_name || '?').slice(0, 2).toUpperCase()} tone="sea"/><span>{item.profile.display_name || item.profile.id}</span><IconButton label={`${tr('removeFriend')}: ${item.profile.display_name}`} onClick={() => runFriendAction(() => removeFriendConnection(item.id))}><UserCheck size={16}/></IconButton></div>)}{friends.length === 0 && <small>{tr('noFriendsYet')}</small>}</section>
      </Card>
    </div>
  </>
}

function Chat({ tr, messages, draft, setDraft, onSend }: { tr: Tr; messages: MessageRow[]; draft: string; setDraft: (v: string) => void; onSend: () => void }) { return <><PageHeading eyebrow={tr('chatEyebrow')} title={tr('chat')} subtitle={tr('chatSubtitle')}/><Card className="chat-layout"><div className="chat-window"><div className="chat-history">{messages.length ? messages.map((message) => <div key={message.id} className="bubble sent">{message.body}<small>{new Date(message.created_at).toLocaleString()}</small></div>) : <p className="empty-state">{tr('noNotes')}</p>}</div><form className="chat-compose" onSubmit={(e) => { e.preventDefault(); onSend() }}><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={tr('privateNote')}/><button className="send-button" aria-label={tr('send')} disabled={!draft.trim()}><Send size={17}/></button></form></div></Card></> }

function HistoryPage({ tr, search, setSearch, year, setYear, rows }: { tr: Tr; search: string; setSearch: (value: string) => void; year: string; setYear: (v: string) => void; rows: HistoryRow[] }) {
  return <><PageHeading eyebrow={tr('historyEyebrow')} title={tr('history')} subtitle={tr('historySubtitle')}/><Card className="history-panel"><div className="history-tools"><label className="history-search"><Search size={16}/><input placeholder={tr('searchStationDate')} value={search} onChange={(e) => setSearch(e.target.value)}/></label><select value={year} onChange={(e) => setYear(e.target.value)} aria-label={tr('year')}><option>2026</option><option>2025</option><option>2024</option></select></div><div className="table-wrap"><table><thead><tr><th>{tr('sourceTimeUpper')}</th><th>{tr('station')}</th><th>{tr('tideUpper')}</th><th>{tr('waterUpper')}</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={`${row.station}-${row.recordedAt}`}><td><strong>{row.recordedAt.replace('T', ' ')}</strong></td><td><span className="table-station"><MapPin size={14}/>{row.station}</span></td><td>{row.tideLevel == null ? '—' : row.tideLevel.toFixed(2)}</td><td>{row.waterTemp == null ? '—' : row.waterTemp.toFixed(1)}</td></tr>) : <tr><td colSpan={4} className="empty-state">{tr('noMatchingObservations')}</td></tr>}</tbody></table></div><div className="table-footer"><span>{tr('showingLatest')} <strong>{rows.length}</strong> {tr('loadedRows')}</span><span>{tr('rawReadingsNote')}</span></div></Card><div className="info-banner"><ShieldCheck size={18}/><span>{tr('sourceComune')}</span><a href="https://www.comune.venezia.it/it/content/1-punta-salute-canal-grande" target="_blank" rel="noreferrer">{tr('sourcePage')} <ArrowRight size={14}/></a></div></>
}
function Forecast({ tr }: { tr: Tr; period: string; setPeriod: (v: string) => void }) { return <><PageHeading eyebrow={tr('forecastEyebrow')} title={tr('forecast')} subtitle={tr('forecastSubtitle')}/><Card className="extended-forecast"><CardHeader eyebrow={tr('dailyForecast')} title={tr('upcomingForecast')}/><p className="empty-state">{tr('noForecastValues')}</p></Card></> }

function Profile({ tr, lang, name, userId, events, eventModalOpen, eventType, eventDate, eventNote, eventFiles, setEventType, setEventDate, setEventNote, setEventFiles, setEventModalOpen, onOpenEvent, onCloseEvent, onSaveEvent, onDeleteEvent }: {
  tr: Tr
  lang: Language
  name: string
  userId: string
  events: UserEvent[]
  eventModalOpen: boolean
  eventType: string
  eventDate: string
  eventNote: string
  eventFiles: File[]
  setEventType: (value: string) => void
  setEventDate: (value: string) => void
  setEventNote: (value: string) => void
  setEventFiles: (value: File[]) => void
  setEventModalOpen: (value: boolean) => void
  onOpenEvent: () => void
  onCloseEvent: () => void
  onSaveEvent: (event: { id?: string; type: string; date: string; startAt: string; endAt: string; note: string; tags: string[]; sharedUserIds: string[]; attachments: File[]; catches: EventCatchInput[] }) => void
  onDeleteEvent: (eventId: string) => void
}) {
  const [fishSpecies, setFishSpecies] = useState<FishSpeciesRow[]>([])
  const [friends, setFriends] = useState<FriendProfileRow[]>([])
  const [eventStartAt, setEventStartAt] = useState('')
  const [eventEndAt, setEventEndAt] = useState('')
  const [eventCatches, setEventCatches] = useState<CatchDraft[]>([])
  const [eventTags, setEventTags] = useState<string[]>([])
  const [tagDraft, setTagDraft] = useState('')
  const [selectedFriendIds, setSelectedFriendIds] = useState<string[]>([])
  const [eventSearch, setEventSearch] = useState('')
  const [editingEventId, setEditingEventId] = useState<string | null>(null)
  const [deleteCandidate, setDeleteCandidate] = useState<UserEvent | null>(null)
  const [catchLocationError, setCatchLocationError] = useState('')
  const [speciesLoadError, setSpeciesLoadError] = useState('')
  useEffect(() => {
    getFishSpecies().then(setFishSpecies).catch((cause: Error) => setSpeciesLoadError(cause.message))
    getAcceptedFriends(userId).then(setFriends).catch(() => setFriends([]))
  }, [userId])
  const isFishingTrip = eventType === 'Fishing trip' || eventType === 'Uscita di pesca'
  const updateCatch = (key: string, values: Partial<CatchDraft>) => setEventCatches((current) => current.map((item) => item.key === key ? { ...item, ...values } : item))
  useEffect(() => {
    if (!eventModalOpen || editingEventId) return
    setEventStartAt(''); setEventEndAt('')
    setEventCatches(isFishingTrip ? [newCatch()] : [])
    setEventTags([]); setTagDraft(''); setSelectedFriendIds([])
  }, [eventModalOpen, editingEventId])
  const openEditEvent = (event: UserEvent) => {
    setEditingEventId(event.id); setEventType(event.type); setEventDate(event.date); setEventNote(event.note); setEventFiles([])
    setEventStartAt(event.startAt ? localDateTimeInput(event.startAt) : ''); setEventEndAt(event.endAt ? localDateTimeInput(event.endAt) : '')
    setEventCatches(event.catches.map((itemCatch) => ({ key: itemCatch.id, speciesId: String(itemCatch.speciesId), quantity: String(itemCatch.quantity), caughtOn: itemCatch.caughtOn ?? '', caughtTime: itemCatch.caughtTime?.slice(0, 5) ?? '', latitude: itemCatch.latitude == null ? '' : String(itemCatch.latitude), longitude: itemCatch.longitude == null ? '' : String(itemCatch.longitude) })))
    setEventTags(event.tags); setTagDraft(''); setSelectedFriendIds(event.sharedUserIds.filter((friendId) => friendId !== userId && friends.some((friend) => friend.id === friendId)))
    setEventModalOpen(true)
  }
  const newCatch = (): CatchDraft => ({ key: `${Date.now()}-${Math.random()}`, speciesId: '', quantity: '1', caughtOn: '', caughtTime: '', latitude: '', longitude: '' })
  const useCatchLocation = (key: string) => {
    if (!navigator.geolocation) { setCatchLocationError(tr('locationUnavailable')); return }
    navigator.geolocation.getCurrentPosition(({ coords }) => {
      updateCatch(key, { latitude: coords.latitude.toFixed(6), longitude: coords.longitude.toFixed(6) })
      setCatchLocationError('')
    }, () => setCatchLocationError(tr('locationUnavailable')), { enableHighAccuracy: true, maximumAge: 60000, timeout: 10000 })
  }
  const addTag = () => {
    const value = tagDraft.trim().replace(/^#/, '').slice(0, 32)
    if (value && !eventTags.some((tag) => tag.toLocaleLowerCase() === value.toLocaleLowerCase()) && eventTags.length < 20) setEventTags((current) => [...current, value])
    setTagDraft('')
  }
  const visibleEvents = events.filter((event) => `${event.type} ${event.date} ${event.note} ${event.tags.join(' ')} ${event.catches.map((itemCatch) => `${itemCatch.speciesNameIt} ${itemCatch.speciesNameEn}`).join(' ')}`.toLocaleLowerCase().includes(eventSearch.trim().toLocaleLowerCase()))
  return <>
    <PageHeading eyebrow={tr('profileEyebrow')} title={tr('profile')} subtitle={tr('profileSubtitle')} action={<Button variant="secondary"><Settings size={16}/>{tr('settings')}</Button>}/>
    <Card as="div" className="profile-overview"><div className="profile-cover"><div className="cover-pattern"><Waves/></div></div><div className="profile-main"><Avatar initials={name.slice(0, 2).toUpperCase()} tone="me" className="profile-avatar"/><div className="profile-identity"><h2>{name}</h2><span><MapPin size={14}/> {events.length} {tr('savedEventsCount')}</span><p>{tr('yourLagoonProfile')}</p></div></div><div className="profile-stats"><div><strong>{events.length}</strong><span>{tr('savedEvents')}</span></div><div><strong>—</strong><span>{tr('profileFriends')}</span></div><div><strong>—</strong><span>{tr('profileStations')}</span></div><div><strong>—</strong><span>{tr('experiencePoints')}</span></div></div></Card>
    <div className="profile-columns">
      <Card className="event-panel">
        <CardHeader eyebrow={tr('personalJournal')} title={tr('events')} action={<Button variant="primary" onClick={() => { setEditingEventId(null); onOpenEvent() }}><Plus size={15}/>{tr('addEvent')}</Button>}/>
        <Field label={tr('searchEvents')} className="event-search"><input className="ds-field__control" value={eventSearch} onChange={(event) => setEventSearch(event.target.value)} placeholder={tr('searchEvents')}/></Field>
        <div className="event-list">{visibleEvents.map((event) => <div key={event.id}><span className={`event-dot ${event.isShared ? 'event-dot--shared' : ''}`}><Fish size={15}/></span><span><strong>{eventTypeLabel(event.type, tr)} · {new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${event.date}T00:00:00`))}</strong>{(event.startAt || event.endAt) && <small>{event.startAt ? new Date(event.startAt).toLocaleTimeString(lang === 'it' ? 'it-IT' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}–{event.endAt ? new Date(event.endAt).toLocaleTimeString(lang === 'it' ? 'it-IT' : 'en-GB', { hour: '2-digit', minute: '2-digit' }) : '—'}</small>}{event.catches.map((itemCatch) => <small key={itemCatch.id}>{itemCatch.quantity} × {lang === 'it' ? itemCatch.speciesNameIt : itemCatch.speciesNameEn}{itemCatch.caughtOn ? ` · ${new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB').format(new Date(`${itemCatch.caughtOn}T00:00:00`))}` : ''}{itemCatch.caughtTime ? ` ${itemCatch.caughtTime.slice(0, 5)}` : ''}{itemCatch.latitude != null && itemCatch.longitude != null ? ` · ${itemCatch.latitude.toFixed(4)}, ${itemCatch.longitude.toFixed(4)}` : ''}</small>)}{event.tags.length > 0 && <small className="event-tags">{event.tags.map((tag) => <span key={tag}>#{tag}</span>)}</small>}{event.note && <small>{event.note}</small>}<small>{event.isShared ? tr('sharedEvent') : event.sharedUserIds.length ? `${tr('shareEvent')}: ${event.sharedUserIds.length}` : tr('privateInLagoon')}</small>{event.attachments.length > 0 && <small className="event-attachments"><Paperclip size={12}/>{event.attachments.map((file) => file.file_name).join(', ')}</small>}</span>{!event.isShared && <div className="event-actions"><IconButton label={`${tr('editEvent')}: ${eventTypeLabel(event.type, tr)}`} onClick={() => openEditEvent(event)}><Pencil size={15}/></IconButton><IconButton label={`${tr('deleteEvent')}: ${eventTypeLabel(event.type, tr)}`} onClick={() => setDeleteCandidate(event)}><Trash2 size={15}/></IconButton></div>}</div>)}{visibleEvents.length === 0 && <p className="empty-state">{tr('noMatchingEvents')}</p>}</div>
      </Card>
      <Card className="badges-panel"><CardHeader eyebrow={tr('contributions')} title={tr('community')}/><p className="empty-state">{tr('noAchievements')}</p></Card>
    </div>

    {eventModalOpen && <Dialog eyebrow={tr('personalJournal')} title={tr(editingEventId ? 'editEvent' : 'addEventTitle')} description={tr('addEventDescription')} closeLabel={tr('close')} onClose={onCloseEvent}>
      <form onSubmit={(e) => { e.preventDefault(); const finalTags = tagDraft.trim() ? [...eventTags, tagDraft.trim().replace(/^#/, '').slice(0, 32)] : eventTags; onSaveEvent({ id: editingEventId ?? undefined, type: eventType, date: eventDate, startAt: eventStartAt, endAt: eventEndAt, note: eventNote.trim(), tags: [...new Map(finalTags.filter(Boolean).map((tag) => [tag.toLocaleLowerCase(), tag])).values()].slice(0, 20), sharedUserIds: selectedFriendIds, attachments: eventFiles, catches: isFishingTrip ? eventCatches.filter((item) => item.speciesId).map((item) => ({ species_id: Number(item.speciesId), quantity: Number(item.quantity), caught_on: item.caughtOn || null, caught_time: item.caughtTime || null, latitude: item.latitude === '' ? null : Number(item.latitude), longitude: item.longitude === '' ? null : Number(item.longitude) })) : [] }) }}>
        <div className="ds-field-grid">
          <Field label={tr('eventType')}><select className="ds-field__control" value={eventType} onChange={(e) => { setEventType(e.target.value); if (e.target.value !== 'Fishing trip') setEventCatches([]); else if (!eventCatches.length) setEventCatches([newCatch()]) }}><option value="Fishing trip">{tr('catch')}</option><option value="Measurement">{tr('measurement')}</option><option value="Note">{tr('note')}</option></select></Field>
          <Field label={tr('date')}><input className="ds-field__control" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required/></Field>
        </div>
        <Field label={tr('tags')} className="ds-field--spaced"><input className="ds-field__control" value={tagDraft} onChange={(e) => setTagDraft(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ',') { e.preventDefault(); addTag() } }} onBlur={() => { if (tagDraft.trim()) addTag() }} placeholder={tr('addTagPlaceholder')}/></Field>
        {eventTags.length > 0 && <div className="event-tag-editor">{eventTags.map((tag) => <span className="event-tag-chip" key={tag}>#{tag}<IconButton label={`${tr('removeTag')}: ${tag}`} onClick={() => setEventTags((current) => current.filter((item) => item !== tag))}><X size={12}/></IconButton></span>)}</div>}
        <fieldset className="event-friend-picker"><legend>{tr('shareEvent')}</legend><p>{tr('shareEventHint')}</p>{friends.length ? friends.map((friend) => <label key={friend.id}><input type="checkbox" checked={selectedFriendIds.includes(friend.id)} onChange={(e) => setSelectedFriendIds((current) => e.target.checked ? [...current, friend.id] : current.filter((id) => id !== friend.id))}/><span>{friend.display_name || friend.id}</span></label>) : <small>{tr('noFriendsAvailable')}</small>}</fieldset>
        {isFishingTrip && <section className="fishing-event-fields" aria-label={tr('fishCaught')}>
          <div className="ds-field-grid"><Field label={tr('startTime')}><input className="ds-field__control" type="datetime-local" value={eventStartAt} onChange={(e) => setEventStartAt(e.target.value)}/></Field><Field label={tr('endTime')}><input className="ds-field__control" type="datetime-local" min={eventStartAt || undefined} value={eventEndAt} onChange={(e) => setEventEndAt(e.target.value)}/></Field></div>
          <div className="catch-fields-heading"><strong>{tr('fishCaught')}</strong><Button type="button" variant="secondary" onClick={() => setEventCatches((current) => [...current, newCatch()])}><Plus size={14}/>{tr('addFish')}</Button></div>
          {speciesLoadError && <p className="backend-error" role="alert">{tr('fishSpeciesUnavailable')}</p>}
          {eventCatches.map((item) => { const hasPosition = item.latitude !== '' || item.longitude !== ''; return <div className="catch-entry" key={item.key}><div className="catch-entry__fields"><Field label={tr('fishSpecies')}><select className="ds-field__control" value={item.speciesId} onChange={(e) => updateCatch(item.key, { speciesId: e.target.value })} required><option value="">{tr('fishSpecies')}</option>{fishSpecies.map((species) => <option key={species.id} value={species.id}>{lang === 'it' ? species.name_it : species.name_en}</option>)}</select></Field><Field label={tr('quantity')}><input className="ds-field__control" type="number" min="1" step="1" value={item.quantity} onChange={(e) => updateCatch(item.key, { quantity: e.target.value })} required/></Field><Field label={tr('catchDate')}><input className="ds-field__control" type="date" value={item.caughtOn} onChange={(e) => updateCatch(item.key, { caughtOn: e.target.value })}/></Field><Field label={tr('catchTime')}><input className="ds-field__control" type="time" value={item.caughtTime} onChange={(e) => updateCatch(item.key, { caughtTime: e.target.value })}/></Field><IconButton label={tr('removeFish')} onClick={() => setEventCatches((current) => current.filter((entry) => entry.key !== item.key))}><X size={16}/></IconButton></div><div className="catch-entry__position"><Field label={tr('latitude')}><input className="ds-field__control" type="number" min="-90" max="90" step="any" value={item.latitude} required={hasPosition} onChange={(e) => updateCatch(item.key, { latitude: e.target.value })}/></Field><Field label={tr('longitude')}><input className="ds-field__control" type="number" min="-180" max="180" step="any" value={item.longitude} required={hasPosition} onChange={(e) => updateCatch(item.key, { longitude: e.target.value })}/></Field><Button type="button" variant="secondary" onClick={() => useCatchLocation(item.key)}><LocateFixed size={14}/>{tr('useCurrentPosition')}</Button></div></div> })}
          {catchLocationError && <p className="empty-state" role="status">{catchLocationError}</p>}
          {!fishSpecies.length && !speciesLoadError && <p className="empty-state">{tr('fishSpecies')}</p>}
        </section>}
        <Field label={tr('notes')} className="ds-field--spaced"><textarea className="ds-field__control ds-field__control--multiline" value={eventNote} onChange={(e) => setEventNote(e.target.value)} placeholder={tr('eventNotePlaceholder')} rows={4}/></Field>
        {editingEventId && events.find((event) => event.id === editingEventId)?.attachments.map((file) => <small className="existing-event-file" key={file.object_path}><Paperclip size={12}/>{file.file_name}</small>)}
        <label className="ds-upload"><Paperclip size={17}/><span className="ds-upload__copy"><strong className="ds-upload__title">{tr('addFiles')}</strong><small className="ds-upload__hint">{tr('acceptedFiles')}</small></span><input type="file" accept="image/*,.pdf,.gpx,.kml,.txt,.csv" multiple onChange={(e) => setEventFiles(Array.from(e.target.files ?? []))}/></label>
        {eventFiles.length > 0 && <ul className="ds-attachment-list">{eventFiles.map((file, index) => <li key={`${file.name}-${index}`}><Paperclip size={13}/><span>{file.name}</span><small>{(file.size / 1024).toFixed(0)} KB</small></li>)}</ul>}
        <div className="ds-dialog__footer"><Button type="button" variant="secondary" onClick={onCloseEvent}>{tr('cancel')}</Button><Button type="submit" variant="primary"><Plus size={15}/>{tr('saveEvent')}</Button></div>
      </form>
    </Dialog>}
    {deleteCandidate && <Dialog eyebrow={tr('personalJournal')} title={tr('deleteEvent')} description={tr('confirmDeleteEvent')} closeLabel={tr('cancel')} onClose={() => setDeleteCandidate(null)}><div className="ds-dialog__footer"><Button variant="secondary" onClick={() => setDeleteCandidate(null)}>{tr('cancel')}</Button><Button variant="primary" onClick={() => { onDeleteEvent(deleteCandidate.id); setDeleteCandidate(null) }}><Trash2 size={15}/>{tr('delete')}</Button></div></Dialog>}
  </>
}
