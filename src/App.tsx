import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownRight, ArrowRight, Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, Droplets, Fish, Gauge, LayoutDashboard, MapPin, Menu, MessageCircle, Moon, Paperclip, Plus, Search, Send, Settings, ShieldCheck, Sun, Thermometer, UserRound, Users, Waves, Wind, X } from 'lucide-react'
import type { HistoryRow } from './domain/weather'
import { backendReady, createEvent, createMessage, createPost, exchangeOAuthCode, getEvents, getMessages, getPosts, readSession, signIn, signInWithProvider, signOut, signUp, type EventRow, type MessageRow, type PostRow, type Session } from './backend/supabase'
import { t, type Language, type TranslationKey } from './i18n'
import { AuthScreen, Avatar, Button, Card, CardHeader, Dialog, Field, IconButton, MetricCard, PageHeading } from './design-system'

type Page = 'dashboard' | 'feed' | 'chat' | 'history' | 'forecast' | 'profile'
type UserEvent = { id: string; type: string; date: string; note: string; attachments: string[] }

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
  }, [session])
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

  const filteredHistory = useMemo(() => [] as HistoryRow[], [search, year])
  const go = (id: Page) => { setPage(id); setMobileNav(false) }

  if (!backendReady) return <BackendSetup />
  if (!session) return <AuthScreen mode={authMode} setMode={setAuthMode} email={authEmail} setEmail={setAuthEmail} password={authPassword} setPassword={setAuthPassword} name={authName} setName={setAuthName} busy={busy} error={error} onOAuth={async (provider) => { setBusy(true); setError(''); try { await signInWithProvider(provider) } catch (cause) { setBusy(false); setError((cause as Error).message) } }} onSubmit={async (e) => { e.preventDefault(); setBusy(true); setError(''); try { const result = authMode === 'signin' ? await signIn(authEmail, authPassword) : await signUp(authEmail, authPassword, authName); if (result.access_token) setSession(result); else setError('Check your email to confirm your account, then sign in.') } catch (cause) { setError((cause as Error).message) } finally { setBusy(false) } }} />

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Waves size={22} strokeWidth={2.5} /></div><span>lagoon<span className="brand-dot">.</span></span><IconButton className="close-nav" label="Chiudi menu" onClick={() => setMobileNav(false)}><X size={19}/></IconButton></div>
      <button className="area-switch"><span className="area-icon"><MapPin size={17}/></span><span className="area-copy"><small>ZONA ATTIVA</small><strong>{tr('area')}</strong></span><ChevronDown size={16}/></button>
      <div className="side-label">WORKSPACE</div>
      <nav aria-label="Navigazione principale">{nav.map(({ id, key, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => go(id)}><Icon size={18}/><span>{tr(key)}</span></button>)}</nav>
      <div className="side-label menu-label">ESPLORA</div>
      <nav aria-label="Esplora">{menu.map(({ id, key, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => go(id)}><Icon size={18}/><span>{tr(key)}</span></button>)}</nav>
      <div className="sidebar-spacer" />
      <button className="nav-item settings-button" onClick={() => go('profile')}><Settings size={18}/><span>Impostazioni</span></button>
      <button className="user-switch" onClick={() => go('profile')}><Avatar initials={(session.user.email ?? 'U').slice(0, 2).toUpperCase()} tone="me"/><span><strong>{session.user.user_metadata?.display_name as string || session.user.email}</strong><small>{session.user.email}</small></span><ChevronDown size={16}/></button>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Chiudi navigazione" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><IconButton className="mobile-menu" label="Apri menu" onClick={() => setMobileNav(true)}><Menu size={21}/></IconButton><span>{tr('area')}</span><ChevronRight size={14}/><strong>{tr(({ dashboard: 'dashboard', feed: 'feed', chat: 'chat', history: 'history', forecast: 'forecast', profile: 'profile' } as const)[page])}</strong></div><div className="top-actions"><label className="search-box"><Search size={16}/><input aria-label={tr('search')} placeholder={`${tr('search')}…`} value={search} onChange={(e) => setSearch(e.target.value)}/><kbd>⌘ K</kbd></label><IconButton className="theme-toggle" onClick={() => setDark(!dark)} label="Cambia tema">{dark ? <Sun size={18}/> : <Moon size={18}/>}</IconButton><IconButton className="language-toggle" onClick={() => setLang(lang === 'it' ? 'en' : 'it')} label="Cambia lingua">{lang.toUpperCase()}</IconButton><IconButton className="notification-button" label={tr('notifications')} onClick={() => setToast('Non hai nuove notifiche')}><Bell size={18}/></IconButton><Avatar initials={(session.user.email ?? 'U').slice(0, 2).toUpperCase()} tone="me" className="top-avatar"/></div></header>
      <div className="page-content">{error && <div className="backend-error" role="alert">{error}<button onClick={() => setError('')}>×</button></div>}{page === 'dashboard' && <Dashboard posts={posts} sessionName={String(session.user.user_metadata?.display_name ?? session.user.email ?? 'Member')} tr={tr} lang={lang} go={go} period={period} setPeriod={setPeriod}/ >}{page === 'feed' && <Feed tr={tr} post={post} setPost={setPost} posts={posts} onPost={async () => { if (post.trim()) { try { await createPost(post.trim()); setPosts(await getPosts()); setPost(''); setToast('Post published') } catch (cause) { setError((cause as Error).message) } } }}/ >}{page === 'chat' && <Chat tr={tr} messages={messages} draft={draft} setDraft={setDraft} onSend={async () => { if (draft.trim()) { try { await createMessage(draft.trim()); setMessages(await getMessages()); setDraft('') } catch (cause) { setError((cause as Error).message) } } }}/ >}{page === 'history' && <HistoryPage tr={tr} search={search} year={year} setYear={setYear} rows={filteredHistory}/ >}{page === 'forecast' && <Forecast tr={tr} period={period} setPeriod={setPeriod}/ >}{page === 'profile' && <Profile tr={tr} name={String(session.user.user_metadata?.display_name ?? session.user.email ?? 'Member')} events={events} eventModalOpen={eventModalOpen} eventType={eventType} eventDate={eventDate} eventNote={eventNote} eventFiles={eventFiles} setEventType={setEventType} setEventDate={setEventDate} setEventNote={setEventNote} setEventFiles={setEventFiles} onOpenEvent={() => { setEventType('Fishing trip'); setEventDate(localDateValue()); setEventNote(''); setEventFiles([]); setEventModalOpen(true) }} onCloseEvent={() => setEventModalOpen(false)} onSaveEvent={async (event) => { try { const saved = await createEvent({ event_type: event.type, event_date: event.date, note: event.note }, event.attachments); setEvents((current) => [{ ...event, id: saved.id, attachments: event.attachments.map((file) => file.name) }, ...current]); setEventModalOpen(false); setToast('Event saved') } catch (cause) { setError((cause as Error).message) } }}/>}</div>
      <footer className="page-footer"><span>Connected to Lagoon cloud</span><span><button onClick={() => { signOut(); setSession(null) }}>Sign out</button> <span className="footer-sep">·</span> Lagoon <Waves size={13}/></span></footer>
    </main>
    {toast && <div className="toast" role="status"><ShieldCheck size={17}/>{toast}<IconButton label="Chiudi" onClick={() => setToast('')}><X size={15}/></IconButton></div>}
  </div>
}

type Tr = (key: TranslationKey) => string

function BackendSetup() { return <main className="auth-screen"><Card className="auth-card"><div className="brand"><div className="brand-mark"><Waves size={22}/></div><span>lagoon<span className="brand-dot">.</span></span></div><h1>Connect your Lagoon backend</h1><p>Copy <code>.env.example</code> to <code>.env.local</code>, then add the project URL and publishable key from Supabase.</p><p>Follow <code>BACKEND.md</code> to create the database and storage policies.</p></Card></main> }

function Dashboard({ posts, sessionName, tr, lang, go, period, setPeriod }: { posts: PostRow[]; sessionName: string; tr: Tr; lang: Language; go: (page: Page) => void; period: string; setPeriod: (period: string) => void }) {
  return <>
    <PageHeading eyebrow={`${new Date().toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}  ·  ${tr('area').toUpperCase()}`} title={`${tr('goodMorning')}, ${sessionName}`} subtitle={tr('greeting')} action={<Button variant="secondary" onClick={() => go('history')}><CalendarDays size={16}/>{tr('viewHistory')}<ArrowRight size={15}/></Button>}/>
    <div className="dashboard-toolbar"><div className="station-selector"><span className="selector-pin"><MapPin size={16}/></span><span><small>WEATHER STATION</small><strong>No weather source connected</strong></span></div><div className="live-stamp">Weather data unavailable</div></div>
    <section className="metrics-grid" aria-label={tr('weather')}>
      <MetricCard icon={<Thermometer/>} label={tr('air')} value="—" unit="°C" detail="Awaiting weather provider" color="coral" trend=""/><MetricCard icon={<Waves/>} label={tr('water')} value="—" unit="°C" detail="Awaiting weather provider" color="blue" trend=""/><MetricCard icon={<Gauge/>} label={tr('pressure')} value="—" unit="hPa" detail="Awaiting weather provider" color="violet" trend=""/><MetricCard icon={<Droplets/>} label={tr('humidity')} value="—" unit="%" detail="Awaiting weather provider" color="teal" trend=""/><MetricCard icon={<Wind/>} label={tr('wind')} value="—" unit="km/h" detail="Awaiting weather provider" color="green" trend=""/>
    </section>
    <div className="content-grid">
      <Card className="chart-panel"><CardHeader eyebrow="WEATHER HISTORY" title="Lagoon trends" description="Connect a weather data source to see measurements." action={<select className="period-select" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Intervallo grafico"><option>24 ore</option><option>7 giorni</option><option>30 giorni</option></select>}/><div className="empty-state">No weather readings are connected yet.</div></Card>
      <Card className="stations-panel"><CardHeader eyebrow="LOCAL NETWORK" title={tr('stations')}/><p className="empty-state">No weather stations are configured. Connect a real source to add stations.</p></Card>
    </div>
    <div className="bottom-grid"><Card className="tide-card"><CardHeader eyebrow="TIDES" title="Tide information"/><p className="empty-state">No tide data source is connected yet.</p></Card><Card className="forecast-card"><CardHeader eyebrow="FORECAST" title={tr('week')}/><p className="empty-state">No forecast provider is connected yet.</p><button className="text-action forecast-link" onClick={() => go('forecast')}>{tr('seeForecast')}<ArrowRight size={15}/></button></Card></div>
    <div className="section-title"><div><div className="eyebrow">VITA IN LAGUNA</div><h2>{tr('community')}</h2></div><button className="link-button" onClick={() => go('feed')}>{tr('viewAll')}<ArrowRight size={14}/></button></div>
    <div className="community-grid">{posts.slice(0, 2).map((item) => <Card key={item.id}><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></Card>)}{posts.length === 0 && <Card className="empty-state">No community posts yet.</Card>}</div>
  </>
}

function Feed({ tr, post, setPost, posts, onPost }: { tr: Tr; post: string; setPost: (v: string) => void; posts: PostRow[]; onPost: () => void }) { return <><PageHeading eyebrow="LAGUNA, INSIEME" title={tr('feed')} subtitle="Stories and observations shared by the community."/><Card className="composer"><textarea value={post} onChange={(e) => setPost(e.target.value)} placeholder="What is happening in the lagoon?"/><div className="composer-bottom"><Button variant="primary" disabled={!post.trim()} onClick={onPost}>Publish<ArrowRight size={15}/></Button></div></Card><div className="feed-list">{posts.length ? posts.map((item) => <Card key={item.id} className="community-entry"><p>{item.body}</p><small>{new Date(item.created_at).toLocaleString()}</small></Card>) : <Card className="empty-state">No posts yet. Share the first observation.</Card>}</div></> }

function Chat({ tr, messages, draft, setDraft, onSend }: { tr: Tr; messages: MessageRow[]; draft: string; setDraft: (v: string) => void; onSend: () => void }) { return <><PageHeading eyebrow="YOUR JOURNAL" title={tr('chat')} subtitle="Your saved notes. Direct conversations need contacts to be enabled."/><Card className="chat-layout"><div className="chat-window"><div className="chat-history">{messages.length ? messages.map((message) => <div key={message.id} className="bubble sent">{message.body}<small>{new Date(message.created_at).toLocaleString()}</small></div>) : <p className="empty-state">No notes yet.</p>}</div><form className="chat-compose" onSubmit={(e) => { e.preventDefault(); onSend() }}><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder="Write a private note…"/><button className="send-button" aria-label={tr('send')} disabled={!draft.trim()}><Send size={17}/></button></form></div></Card></> }

function HistoryPage({ tr, search, year, setYear, rows }: { tr: Tr; search: string; year: string; setYear: (v: string) => void; rows: HistoryRow[] }) { return <><PageHeading eyebrow="OSSERVA I CAMBIAMENTI" title={tr('history')} subtitle="Esplora le rilevazioni meteo e ritrova i tuoi eventi." action={<Button variant="secondary"><ArrowDownRight size={16}/>Esporta CSV</Button>}/><Card className="history-panel"><div className="history-tools"><label className="history-search"><Search size={16}/><input placeholder={`${tr('search')} stazione o data`} value={search}/></label><select value={year} onChange={(e) => setYear(e.target.value)} aria-label={tr('year')}><option>2026</option><option>2025</option><option>2024</option></select><select aria-label={tr('month')}><option>{tr('all')} i mesi</option><option>Ottobre</option><option>Settembre</option></select><Button variant="secondary"><CalendarDays size={16}/>{tr('all')} i giorni</Button></div><div className="table-wrap"><table><thead><tr><th>DATA E ORA</th><th>STAZIONE</th><th>TEMP. ARIA</th><th>TEMP. ACQUA</th><th>VENTO</th><th>PRESSIONE</th><th>EVENTO</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={`${row.date}-${row.station}`}><td><strong>{row.date}</strong></td><td><span className="table-station"><MapPin size={14}/>{row.station}</span></td><td>{row.air} °C</td><td>{row.water} °C</td><td>{row.wind}</td><td>{row.pressure} hPa</td><td><span className="event-tag">—</span></td></tr>) : <tr><td colSpan={7} className="empty-state">{tr('noData')}</td></tr>}</tbody></table></div><div className="table-footer"><span>Mostrati <strong>{rows.length}</strong> risultati</span><div><IconButton className="small-icon" label="Pagina precedente"><ChevronLeft size={16}/></IconButton><button className="page-number">1</button><IconButton className="small-icon" label="Pagina successiva"><ChevronRight size={16}/></IconButton></div></div></Card><div className="info-banner"><ShieldCheck size={18}/><span>Gli eventi personali sono visibili solo a te. <strong>Accedi per annotare le tue osservazioni</strong> associate ai dati meteo.</span><button>Scopri come funziona<ArrowRight size={14}/></button></div></> }

function Forecast({ tr }: { tr: Tr; period: string; setPeriod: (v: string) => void }) { return <><PageHeading eyebrow="FORECAST" title={tr('forecast')} subtitle="Connect a forecast provider to show live, attributed predictions."/><Card className="extended-forecast"><CardHeader eyebrow="DAILY FORECAST" title={tr('upcoming')}/><p className="empty-state">No forecast provider is connected yet. No forecast values are being shown.</p></Card></> }

function Profile({ tr, name, events, eventModalOpen, eventType, eventDate, eventNote, eventFiles, setEventType, setEventDate, setEventNote, setEventFiles, onOpenEvent, onCloseEvent, onSaveEvent }: {
  tr: Tr
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
    <PageHeading eyebrow="IL TUO SPAZIO" title={tr('profile')} subtitle="Racconta la tua esperienza e tieni traccia delle tue uscite." action={<Button variant="secondary"><Settings size={16}/>Impostazioni</Button>}/>
    <Card as="div" className="profile-overview"><div className="profile-cover"><div className="cover-pattern"><Waves/></div></div><div className="profile-main"><Avatar initials={name.slice(0, 2).toUpperCase()} tone="me" className="profile-avatar"/><div className="profile-identity"><h2>{name}</h2><span><MapPin size={14}/> {events.length} saved events</span><p>Your Lagoon profile.</p></div></div><div className="profile-stats"><div><strong>{events.length}</strong><span>Saved events</span></div><div><strong>—</strong><span>Friends</span></div><div><strong>—</strong><span>Stations</span></div><div><strong>—</strong><span>Experience points</span></div></div></Card>
    <div className="profile-columns">
      <Card className="event-panel">
        <CardHeader eyebrow="IL TUO DIARIO" title={tr('events')} action={<Button variant="primary" onClick={onOpenEvent}><Plus size={15}/>{tr('addEvent')}</Button>}/>
        <div className="event-list">{events.map((event) => <div key={event.id}><span className="event-dot"><Fish size={15}/></span><span><strong>{event.type} · {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${event.date}T00:00:00`))}</strong>{event.note && <small>{event.note}</small>}<small>Venice Lagoon · Private</small>{event.attachments.length > 0 && <small className="event-attachments"><Paperclip size={12}/>{event.attachments.join(', ')}</small>}</span><ChevronRight size={15}/></div>)}</div>
      </Card>
      <Card className="badges-panel"><CardHeader eyebrow="COMMUNITY" title="Your contributions"/><p className="empty-state">Achievements will appear as contribution features are connected.</p></Card>
    </div>

    {eventModalOpen && <Dialog eyebrow="Personal journal" title="Add an event" description="Record the details of your day in the lagoon." onClose={onCloseEvent}>
      <form onSubmit={(e) => { e.preventDefault(); onSaveEvent({ type: eventType, date: eventDate, note: eventNote.trim(), attachments: eventFiles }) }}>
        <div className="ds-field-grid">
          <Field label="Event type"><select className="ds-field__control" value={eventType} onChange={(e) => setEventType(e.target.value)}><option>Fishing trip</option><option>Measurement</option><option>Note</option></select></Field>
          <Field label="Date"><input className="ds-field__control" type="date" value={eventDate} onChange={(e) => setEventDate(e.target.value)} required/></Field>
        </div>
        <Field label="Notes" className="ds-field--spaced"><textarea className="ds-field__control ds-field__control--multiline" value={eventNote} onChange={(e) => setEventNote(e.target.value)} placeholder="Add a note about this event…" rows={4}/></Field>
        <label className="ds-upload"><Paperclip size={17}/><span className="ds-upload__copy"><strong className="ds-upload__title">Add photos or files</strong><small className="ds-upload__hint">Images, PDF, GPX, KML, TXT, or CSV</small></span><input type="file" accept="image/*,.pdf,.gpx,.kml,.txt,.csv" multiple onChange={(e) => setEventFiles(Array.from(e.target.files ?? []))}/></label>
        {eventFiles.length > 0 && <ul className="ds-attachment-list">{eventFiles.map((file, index) => <li key={`${file.name}-${index}`}><Paperclip size={13}/><span>{file.name}</span><small>{(file.size / 1024).toFixed(0)} KB</small></li>)}</ul>}
        <div className="ds-dialog__footer"><Button type="button" variant="secondary" onClick={onCloseEvent}>Cancel</Button><Button type="submit" variant="primary"><Plus size={15}/>Save event</Button></div>
      </form>
    </Dialog>}
  </>
}
