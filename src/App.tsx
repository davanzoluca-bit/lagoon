import { useEffect, useMemo, useRef, useState } from 'react'
import { Activity, ArrowRight, Bell, CalendarDays, ChevronDown, ChevronRight, Fish, LayoutDashboard, MapPin, Menu, MessageCircle, Moon, Paperclip, Plus, Search, Send, Settings, ShieldCheck, Sun, Sunrise, Sunset, Thermometer, UserRound, Users, Waves, X } from 'lucide-react'
import type { HistoryRow } from './domain/weather'
import { backendReady, createEvent, createMessage, createPost, exchangeOAuthCode, getEvents, getMessages, getPosts, getWeatherObservations, getWeatherStation, readSession, signIn, signInWithProvider, signOut, signUp, type EventRow, type MessageRow, type PostRow, type Session, type WeatherObservationRow, type WeatherStationRow } from './backend/supabase'
import { t, type Language, type TranslationKey } from './i18n'
import { AuthScreen, Avatar, Button, Card, CardHeader, Dialog, Field, IconButton, MetricCard, PageHeading } from './design-system'
import { getSolarTimes, searchPlaces, type PlaceResult, type SolarTimes } from './services/solar'

type Page = 'dashboard' | 'feed' | 'chat' | 'history' | 'forecast' | 'profile'
type UserEvent = { id: string; type: string; date: string; note: string; attachments: string[] }
type UserLocation = { name: string; country: string; latitude: number; longitude: number; source: 'gps' | 'manual' | 'fallback' }

const locationStorageKey = 'lagoon.user-location'
const veniceLocation: UserLocation = { name: 'Venezia', country: 'Italia', latitude: 45.4408, longitude: 12.3155, source: 'fallback' }

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
  const [messages, setMessages] = useState<MessageRow[]>([])
  const [posts, setPosts] = useState<PostRow[]>([])
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
      setEvents(eventRows.map((item: EventRow) => ({ id: item.id, type: item.event_type, date: item.event_date, note: item.note, attachments: (item.event_attachments ?? []).map((file) => file.file_name) })))
      setPosts(postRows); setMessages(messageRows)
    }).catch((cause: Error) => setError(cause.message))
    getWeatherStation().then(async (stationRow) => {
      setWeatherStation(stationRow)
      setWeatherObservations(stationRow ? await getWeatherObservations(stationRow.id, 1000) : [])
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
      <div className="page-content">{error && <div className="backend-error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}{page === 'dashboard' && <Dashboard posts={posts} sessionName={String(session.user.user_metadata?.display_name ?? session.user.email ?? 'Member')} station={weatherStation} observations={weatherObservations.slice(0,288)} locationLabel={locationLabel} locationReady={locationReady} sunTimes={sunTimes} solarLoading={solarLoading} solarError={solarError} tr={tr} lang={lang} go={go}/ >}{page === 'feed' && <Feed tr={tr} post={post} setPost={setPost} posts={posts} onPost={async () => { if (post.trim()) { try { await createPost(post.trim()); setPosts(await getPosts()); setPost(''); setToast(tr('postPublished')) } catch (cause) { setError((cause as Error).message) } } }}/ >}{page === 'chat' && <Chat tr={tr} messages={messages} draft={draft} setDraft={setDraft} onSend={async () => { if (draft.trim()) { try { await createMessage(draft.trim()); setMessages(await getMessages()); setDraft('') } catch (cause) { setError((cause as Error).message) } } }}/ >}{page === 'history' && <HistoryPage tr={tr} search={search} setSearch={setSearch} year={year} setYear={setYear} rows={filteredHistory}/ >}{page === 'forecast' && <Forecast tr={tr} period={period} setPeriod={setPeriod}/ >}{page === 'profile' && <Profile tr={tr} lang={lang} name={String(session.user.user_metadata?.display_name ?? session.user.email ?? 'Member')} events={events} eventModalOpen={eventModalOpen} eventType={eventType} eventDate={eventDate} eventNote={eventNote} eventFiles={eventFiles} setEventType={setEventType} setEventDate={setEventDate} setEventNote={setEventNote} setEventFiles={setEventFiles} onOpenEvent={() => { setEventType('Fishing trip'); setEventDate(localDateValue()); setEventNote(''); setEventFiles([]); setEventModalOpen(true) }} onCloseEvent={() => setEventModalOpen(false)} onSaveEvent={async (event) => { try { const saved = await createEvent({ event_type: event.type, event_date: event.date, note: event.note }, event.attachments); setEvents((current) => [{ ...event, id: saved.id, attachments: event.attachments.map((file) => file.name) }, ...current]); setEventModalOpen(false); setToast(tr('eventSaved')) } catch (cause) { setError((cause as Error).message) } }}/>}</div>
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

function BackendSetup({ tr }: { tr: Tr }) { return <main className="auth-screen"><Card className="auth-card"><div className="brand"><div className="brand-mark"><Waves size={22}/></div><span>lagoon<span className="brand-dot">.</span></span></div><h1>{tr('connectBackend')}</h1><p>{tr('backendSetupText')}</p><p>{tr('backendSetupHelp')}</p></Card></main> }

function Dashboard({ posts, sessionName, station, observations, locationLabel, locationReady, sunTimes, solarLoading, solarError, tr, lang, go }: { posts: PostRow[]; sessionName: string; station: WeatherStationRow | null; observations: WeatherObservationRow[]; locationLabel: string; locationReady: boolean; sunTimes: SolarTimes | null; solarLoading: boolean; solarError: boolean; tr: Tr; lang: Language; go: (page: Page) => void }) {
  const latest = observations[0]
  const latestWater = observations.find((row) => row.water_temp_c !== null)
  const latestTide = observations.find((row) => row.tide_level_m !== null)
  const formatReadingTime = (value?: string) => value ? new Date(`${value.replace(' ', 'T')}Z`).toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit', timeZone: 'UTC' }) : tr('noReading')
  const formatSolarTime = (value?: string) => value?.match(/T(\d{2}:\d{2})/)?.[1] ?? '—'
  const solarDetail = !locationReady ? tr('locatingLocation') : solarLoading ? tr('solarLoading') : solarError ? tr('sunTimesUnavailable') : `${locationLabel} · ${tr('locationToday')}`
  const graphRows = observations.slice().reverse()
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
    <div className="content-grid">
      <Card className="chart-panel"><CardHeader eyebrow={tr('sourceObservations')} title={tr('chartTitle')} description={station ? `${station.name} · ${tr('chartDescription')}` : tr('importCsvHint')}/>{graphRows.length ? <ObservationChart rows={graphRows} lang={lang} tr={tr}/> : <div className="empty-state">{tr('noObservationsLoaded')}</div>}<div className="chart-note"><span>{tr('fromComune')}</span><button onClick={() => go('history')}>{tr('browseData')} <ArrowRight size={14}/></button></div></Card>
      <Card className="stations-panel"><CardHeader eyebrow={tr('localNetwork')} title={tr('stations')}/>{station ? <div className="station-row selected"><div className="station-symbol"><MapPin size={17}/></div><div className="station-info"><strong>{station.name}</strong><span>{station.area}</span></div><div className="station-values"><strong>{observations.length.toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB')}</strong><span>{tr('recentRows')}</span></div></div> : <p className="empty-state">{tr('noStationsConfigured')}</p>}<a className="text-action" href={station?.source_url} target="_blank" rel="noreferrer">{tr('sourceAndLicense')} <ArrowRight size={15}/></a></Card>
    </div>
    <div className="bottom-grid"><Card className="forecast-card"><CardHeader eyebrow={tr('forecastEyebrow')} title={tr('week')}/><p className="empty-state">{tr('noForecastProvider')}</p><button className="text-action forecast-link" onClick={() => go('forecast')}>{tr('seeForecast')}<ArrowRight size={15}/></button></Card></div>
    <div className="section-title"><div><div className="eyebrow">{tr('lagoonLife')}</div><h2>{tr('community')}</h2></div><button className="link-button" onClick={() => go('feed')}>{tr('viewAll')}<ArrowRight size={14}/></button></div>
    <div className="community-grid">{posts.slice(0, 2).map((item) => <Card key={item.id}><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString(lang === 'it' ? 'it-IT' : 'en-GB')}</small></Card>)}{posts.length === 0 && <Card className="empty-state">{tr('noPosts')}</Card>}</div>
  </>
}

function ObservationChart({ rows, lang, tr }: { rows: WeatherObservationRow[]; lang: Language; tr: Tr }) {
  const chartRef = useRef<HTMLDivElement>(null)
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null)
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
  const xTickCount = Math.min(5, rows.length, Math.max(2, Math.floor(width / 150)))
  const xTicks = Array.from(new Set(Array.from({ length: xTickCount }, (_, index) => Math.round(index * (rows.length - 1) / Math.max(xTickCount - 1, 1)))))
  const selectFromPointer = (event: React.PointerEvent<HTMLDivElement>) => setSelectedIndex(nearestIndex(event.clientX))
  const valueLabel = (value: number | null) => value === null ? '—' : axisNumber(value)

  return <>
    <div className="observation-legend"><span><i className="observation-legend__water"/>{tr('axisWater')}</span><span><i className="observation-legend__tide"/>{tr('axisTide')}</span></div>
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
  </>
}

function Feed({ tr, post, setPost, posts, onPost }: { tr: Tr; post: string; setPost: (v: string) => void; posts: PostRow[]; onPost: () => void }) { return <><PageHeading eyebrow={tr('feedEyebrow')} title={tr('feed')} subtitle={tr('feedSubtitle')}/><Card className="composer"><textarea value={post} onChange={(e) => setPost(e.target.value)} placeholder={tr('newPost')}/><div className="composer-bottom"><Button variant="primary" disabled={!post.trim()} onClick={onPost}>{tr('publish')}<ArrowRight size={15}/></Button></div></Card><div className="feed-list">{posts.length ? posts.map((item) => <Card key={item.id} className="community-entry"><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></Card>) : <Card className="empty-state">{tr('shareFirst')}</Card>}</div></> }

function Chat({ tr, messages, draft, setDraft, onSend }: { tr: Tr; messages: MessageRow[]; draft: string; setDraft: (v: string) => void; onSend: () => void }) { return <><PageHeading eyebrow={tr('chatEyebrow')} title={tr('chat')} subtitle={tr('chatSubtitle')}/><Card className="chat-layout"><div className="chat-window"><div className="chat-history">{messages.length ? messages.map((message) => <div key={message.id} className="bubble sent">{message.body}<small>{new Date(message.created_at).toLocaleString()}</small></div>) : <p className="empty-state">{tr('noNotes')}</p>}</div><form className="chat-compose" onSubmit={(e) => { e.preventDefault(); onSend() }}><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={tr('privateNote')}/><button className="send-button" aria-label={tr('send')} disabled={!draft.trim()}><Send size={17}/></button></form></div></Card></> }

function HistoryPage({ tr, search, setSearch, year, setYear, rows }: { tr: Tr; search: string; setSearch: (value: string) => void; year: string; setYear: (v: string) => void; rows: HistoryRow[] }) {
  return <><PageHeading eyebrow={tr('historyEyebrow')} title={tr('history')} subtitle={tr('historySubtitle')}/><Card className="history-panel"><div className="history-tools"><label className="history-search"><Search size={16}/><input placeholder={tr('searchStationDate')} value={search} onChange={(e) => setSearch(e.target.value)}/></label><select value={year} onChange={(e) => setYear(e.target.value)} aria-label={tr('year')}><option>2026</option><option>2025</option><option>2024</option></select></div><div className="table-wrap"><table><thead><tr><th>{tr('sourceTimeUpper')}</th><th>{tr('station')}</th><th>{tr('tideUpper')}</th><th>{tr('waterUpper')}</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={`${row.station}-${row.recordedAt}`}><td><strong>{row.recordedAt.replace('T', ' ')}</strong></td><td><span className="table-station"><MapPin size={14}/>{row.station}</span></td><td>{row.tideLevel == null ? '—' : row.tideLevel.toFixed(2)}</td><td>{row.waterTemp == null ? '—' : row.waterTemp.toFixed(1)}</td></tr>) : <tr><td colSpan={4} className="empty-state">{tr('noMatchingObservations')}</td></tr>}</tbody></table></div><div className="table-footer"><span>{tr('showingLatest')} <strong>{rows.length}</strong> {tr('loadedRows')}</span><span>{tr('rawReadingsNote')}</span></div></Card><div className="info-banner"><ShieldCheck size={18}/><span>{tr('sourceComune')}</span><a href="https://www.comune.venezia.it/it/content/1-punta-salute-canal-grande" target="_blank" rel="noreferrer">{tr('sourcePage')} <ArrowRight size={14}/></a></div></>
}
function Forecast({ tr }: { tr: Tr; period: string; setPeriod: (v: string) => void }) { return <><PageHeading eyebrow={tr('forecastEyebrow')} title={tr('forecast')} subtitle={tr('forecastSubtitle')}/><Card className="extended-forecast"><CardHeader eyebrow={tr('dailyForecast')} title={tr('upcomingForecast')}/><p className="empty-state">{tr('noForecastValues')}</p></Card></> }

function Profile({ tr, lang, name, events, eventModalOpen, eventType, eventDate, eventNote, eventFiles, setEventType, setEventDate, setEventNote, setEventFiles, onOpenEvent, onCloseEvent, onSaveEvent }: {
  tr: Tr
  lang: Language
  name: string
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
  onOpenEvent: () => void
  onCloseEvent: () => void
  onSaveEvent: (event: { type: string; date: string; note: string; attachments: File[] }) => void
}) {
  return <>
    <PageHeading eyebrow={tr('profileEyebrow')} title={tr('profile')} subtitle={tr('profileSubtitle')} action={<Button variant="secondary"><Settings size={16}/>{tr('settings')}</Button>}/>
    <Card as="div" className="profile-overview"><div className="profile-cover"><div className="cover-pattern"><Waves/></div></div><div className="profile-main"><Avatar initials={name.slice(0, 2).toUpperCase()} tone="me" className="profile-avatar"/><div className="profile-identity"><h2>{name}</h2><span><MapPin size={14}/> {events.length} {tr('savedEventsCount')}</span><p>{tr('yourLagoonProfile')}</p></div></div><div className="profile-stats"><div><strong>{events.length}</strong><span>{tr('savedEvents')}</span></div><div><strong>—</strong><span>{tr('profileFriends')}</span></div><div><strong>—</strong><span>{tr('profileStations')}</span></div><div><strong>—</strong><span>{tr('experiencePoints')}</span></div></div></Card>
    <div className="profile-columns">
      <Card className="event-panel">
        <CardHeader eyebrow={tr('personalJournal')} title={tr('events')} action={<Button variant="primary" onClick={onOpenEvent}><Plus size={15}/>{tr('addEvent')}</Button>}/>
        <div className="event-list">{events.map((event) => <div key={event.id}><span className="event-dot"><Fish size={15}/></span><span><strong>{tr(event.type === 'Fishing trip' ? 'catch' : event.type === 'Measurement' ? 'measurement' : event.type === 'Note' ? 'note' : 'events')} · {new Intl.DateTimeFormat(lang === 'it' ? 'it-IT' : 'en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${event.date}T00:00:00`))}</strong>{event.note && <small>{event.note}</small>}<small>{tr('privateInLagoon')}</small>{event.attachments.length > 0 && <small className="event-attachments"><Paperclip size={12}/>{event.attachments.join(', ')}</small>}</span><ChevronRight size={15}/></div>)}</div>
      </Card>
      <Card className="badges-panel"><CardHeader eyebrow={tr('contributions')} title={tr('community')}/><p className="empty-state">{tr('noAchievements')}</p></Card>
    </div>

    {eventModalOpen && <Dialog eyebrow={tr('personalJournal')} title={tr('addEventTitle')} description={tr('addEventDescription')} closeLabel={tr('close')} onClose={onCloseEvent}>
      <form onSubmit={(e) => { e.preventDefault(); onSaveEvent({ type: eventType, date: eventDate, note: eventNote.trim(), attachments: eventFiles }) }}>
        <div className="ds-field-grid">
          <Field label={tr('eventType')}><select className="ds-field__control" value={eventType} onChange={(e) => setEventType(e.target.value)}><option value="Fishing trip">{tr('catch')}</option><option value="Measurement">{tr('measurement')}</option><option value="Note">{tr('note')}</option></select></Field>
          <Field label={tr('date')}><input className="ds-field__control" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required/></Field>
        </div>
        <Field label={tr('notes')} className="ds-field--spaced"><textarea className="ds-field__control ds-field__control--multiline" value={eventNote} onChange={(e) => setEventNote(e.target.value)} placeholder={tr('eventNotePlaceholder')} rows={4}/></Field>
        <label className="ds-upload"><Paperclip size={17}/><span className="ds-upload__copy"><strong className="ds-upload__title">{tr('addFiles')}</strong><small className="ds-upload__hint">{tr('acceptedFiles')}</small></span><input type="file" accept="image/*,.pdf,.gpx,.kml,.txt,.csv" multiple onChange={(e) => setEventFiles(Array.from(e.target.files ?? []))}/></label>
        {eventFiles.length > 0 && <ul className="ds-attachment-list">{eventFiles.map((file, index) => <li key={`${file.name}-${index}`}><Paperclip size={13}/><span>{file.name}</span><small>{(file.size / 1024).toFixed(0)} KB</small></li>)}</ul>}
        <div className="ds-dialog__footer"><Button type="button" variant="secondary" onClick={onCloseEvent}>{tr('cancel')}</Button><Button type="submit" variant="primary"><Plus size={15}/>{tr('saveEvent')}</Button></div>
      </form>
    </Dialog>}
  </>
}
