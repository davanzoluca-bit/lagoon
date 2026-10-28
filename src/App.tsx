import { useEffect, useMemo, useState } from 'react'
import { Activity, ArrowDownRight, ArrowRight, ArrowUpRight, Bell, CalendarDays, ChevronDown, ChevronLeft, ChevronRight, CloudRain, Droplets, Fish, Gauge, Globe2, LayoutDashboard, MapPin, Menu, MessageCircle, Moon, Paperclip, Plus, Search, Send, Settings, ShieldCheck, Sun, Thermometer, Trophy, UserRound, Users, Waves, Wind, X } from 'lucide-react'
import { demoWeatherSource, history, type WeatherStation } from './domain/weather'
import { t, type Language, type TranslationKey } from './i18n'
import { Avatar, Button, Card, CardHeader, CommunityPostCard, Dialog, Field, IconButton, MetricCard, PageHeading } from './design-system'

type Page = 'dashboard' | 'feed' | 'chat' | 'history' | 'forecast' | 'profile'
type UserEvent = { id: number; type: string; date: string; note: string; attachments: File[] }

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
  const [page, setPage] = useState<Page>('dashboard')
  const [lang, setLang] = useState<Language>('it')
  const [dark, setDark] = useState(false)
  const [mobileNav, setMobileNav] = useState(false)
  const [stations, setStations] = useState<WeatherStation[]>([])
  const [selected, setSelected] = useState('punta-salute')
  const [period, setPeriod] = useState('7 giorni')
  const [toast, setToast] = useState('')
  const [post, setPost] = useState('')
  const [messages, setMessages] = useState(['Che bella giornata per uscire in barca!'])
  const [draft, setDraft] = useState('')
  const [eventType, setEventType] = useState('Fishing trip')
  const [eventDate, setEventDate] = useState(localDateValue())
  const [eventNote, setEventNote] = useState('')
  const [eventFiles, setEventFiles] = useState<File[]>([])
  const [eventModalOpen, setEventModalOpen] = useState(false)
  const [events, setEvents] = useState<UserEvent[]>([
    { id: 1, type: 'Fishing trip', date: '2026-10-12', note: '', attachments: [] },
    { id: 2, type: 'Measurement', date: '2026-10-08', note: '', attachments: [] },
  ])
  const [year, setYear] = useState('2026')
  const [search, setSearch] = useState('')
  const tr = (key: TranslationKey) => t(lang, key)

  useEffect(() => { void demoWeatherSource.getStations().then(setStations) }, [])
  useEffect(() => { document.documentElement.dataset.theme = dark ? 'dark' : 'light' }, [dark])
  useEffect(() => { if (!toast) return; const timeout = window.setTimeout(() => setToast(''), 2600); return () => window.clearTimeout(timeout) }, [toast])

  const station = stations.find((item) => item.id === selected) ?? stations[0]
  const filteredHistory = useMemo(() => history.filter((row) => `${row.date} ${row.station}`.toLowerCase().includes(search.toLowerCase()) && year === '2026' && (row.date.includes('Oggi') || row.date.includes('Ieri'))), [search, year])
  const go = (id: Page) => { setPage(id); setMobileNav(false) }

  return <div className="app-shell">
    <aside className={`sidebar ${mobileNav ? 'sidebar-open' : ''}`}>
      <div className="brand"><div className="brand-mark"><Waves size={22} strokeWidth={2.5} /></div><span>lagoon<span className="brand-dot">.</span></span><IconButton className="close-nav" label="Chiudi menu" onClick={() => setMobileNav(false)}><X size={19}/></IconButton></div>
      <button className="area-switch"><span className="area-icon"><MapPin size={17}/></span><span className="area-copy"><small>ZONA ATTIVA</small><strong>{tr('area')}</strong></span><ChevronDown size={16}/></button>
      <div className="side-label">WORKSPACE</div>
      <nav aria-label="Navigazione principale">{nav.map(({ id, key, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => go(id)}><Icon size={18}/><span>{tr(key)}</span>{id === 'chat' && <i className="nav-badge">2</i>}</button>)}</nav>
      <div className="side-label menu-label">ESPLORA</div>
      <nav aria-label="Esplora">{menu.map(({ id, key, icon: Icon }) => <button key={id} className={`nav-item ${page === id ? 'active' : ''}`} onClick={() => go(id)}><Icon size={18}/><span>{tr(key)}</span></button>)}</nav>
      <div className="sidebar-spacer" />
      <div className="contribution"><div className="contribution-top"><span className="contribution-icon"><Trophy size={15}/></span><strong>{tr('contribution')}</strong></div><div className="progress-line"><span/></div><div className="contribution-caption"><span>Livello 3 · Esploratore</span><b>240 / 300 XP</b></div></div>
      <button className="nav-item settings-button" onClick={() => go('profile')}><Settings size={18}/><span>Impostazioni</span></button>
      <button className="user-switch" onClick={() => go('profile')}><Avatar initials="LM" tone="me"/><span><strong>Luca Marin</strong><small>Esploratore locale</small></span><ChevronDown size={16}/></button>
    </aside>
    {mobileNav && <button className="nav-scrim" aria-label="Chiudi navigazione" onClick={() => setMobileNav(false)} />}
    <main className="main-area">
      <header className="topbar"><div className="breadcrumbs"><IconButton className="mobile-menu" label="Apri menu" onClick={() => setMobileNav(true)}><Menu size={21}/></IconButton><span>{tr('area')}</span><ChevronRight size={14}/><strong>{tr(({ dashboard: 'dashboard', feed: 'feed', chat: 'chat', history: 'history', forecast: 'forecast', profile: 'profile' } as const)[page])}</strong></div><div className="top-actions"><label className="search-box"><Search size={16}/><input aria-label={tr('search')} placeholder={`${tr('search')}…`} value={search} onChange={(e) => setSearch(e.target.value)}/><kbd>⌘ K</kbd></label><IconButton className="theme-toggle" onClick={() => setDark(!dark)} label="Cambia tema">{dark ? <Sun size={18}/> : <Moon size={18}/>}</IconButton><IconButton className="language-toggle" onClick={() => setLang(lang === 'it' ? 'en' : 'it')} label="Cambia lingua">{lang.toUpperCase()}</IconButton><IconButton className="notification-button" label={tr('notifications')} onClick={() => setToast('Non hai nuove notifiche')}><Bell size={18}/><i/></IconButton><Avatar initials="LM" tone="me" className="top-avatar"/></div></header>
      <div className="page-content">{page === 'dashboard' && <Dashboard tr={tr} lang={lang} stations={stations} station={station} selected={selected} setSelected={setSelected} go={go} period={period} setPeriod={setPeriod}/ >}{page === 'feed' && <Feed tr={tr} post={post} setPost={setPost} onPost={() => { if (post.trim()) { setToast('Condivisione inviata alla moderazione'); setPost('') } }}/ >}{page === 'chat' && <Chat tr={tr} messages={messages} draft={draft} setDraft={setDraft} onSend={() => { if (draft.trim()) { setMessages([...messages, draft.trim()]); setDraft('') } }}/ >}{page === 'history' && <HistoryPage tr={tr} search={search} year={year} setYear={setYear} rows={filteredHistory}/ >}{page === 'forecast' && <Forecast tr={tr} period={period} setPeriod={setPeriod}/ >}{page === 'profile' && <Profile tr={tr} events={events} eventModalOpen={eventModalOpen} eventType={eventType} eventDate={eventDate} eventNote={eventNote} eventFiles={eventFiles} setEventType={setEventType} setEventDate={setEventDate} setEventNote={setEventNote} setEventFiles={setEventFiles} onOpenEvent={() => { setEventType('Fishing trip'); setEventDate(localDateValue()); setEventNote(''); setEventFiles([]); setEventModalOpen(true) }} onCloseEvent={() => setEventModalOpen(false)} onSaveEvent={(event) => { setEvents((current) => [{ ...event, id: Date.now() }, ...current]); setEventModalOpen(false); setToast('Event saved · +10 XP') }}/>}</div>
      <footer className="page-footer"><span><span className="footer-pulse"/> Dati dimostrativi · Fonte reale in attivazione</span><span>Lagoon v0.1 <span className="footer-sep">·</span> Fatto per la laguna <Waves size={13}/></span></footer>
    </main>
    {toast && <div className="toast" role="status"><ShieldCheck size={17}/>{toast}<IconButton label="Chiudi" onClick={() => setToast('')}><X size={15}/></IconButton></div>}
  </div>
}

type Tr = (key: TranslationKey) => string

function Dashboard({ tr, lang, stations, station, selected, setSelected, go, period, setPeriod }: { tr: Tr; lang: Language; stations: WeatherStation[]; station?: WeatherStation; selected: string; setSelected: (id: string) => void; go: (page: Page) => void; period: string; setPeriod: (period: string) => void }) {
  const reading = station?.reading
  return <>
    <PageHeading eyebrow={`${new Date().toLocaleDateString(lang === 'it' ? 'it-IT' : 'en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).toUpperCase()}  ·  ${tr('area').toUpperCase()}`} title={tr('goodMorning') + ', Luca'} subtitle={tr('greeting')} action={<Button variant="secondary" onClick={() => go('history')}><CalendarDays size={16}/>{tr('viewHistory')}<ArrowRight size={15}/></Button>}/>
    <div className="dashboard-toolbar"><div className="station-selector"><span className="selector-pin"><MapPin size={16}/></span><span><small>STAZIONE METEO</small><strong>{station?.name ?? 'Caricamento…'}</strong></span><select aria-label="Seleziona stazione meteo" value={selected} onChange={(e) => setSelected(e.target.value)}>{stations.map((item) => <option key={item.id} value={item.id}>{item.name}</option>)}</select><ChevronDown size={15}/></div><div className="live-stamp"><span className="live-dot"/>{tr('live')}<span className="stamp-divider"/>{tr('updated')} {reading?.time ?? '—'}</div></div>
    <section className="metrics-grid" aria-label={tr('weather')}>
      <MetricCard icon={<Thermometer/>} label={tr('air')} value={reading?.air.toFixed(1) ?? '—'} unit="°C" detail="Percepita 18°" color="coral" trend="+1.2°" positive/><MetricCard icon={<Waves/>} label={tr('water')} value={reading?.water.toFixed(1) ?? '—'} unit="°C" detail="Stabile nelle ultime 3h" color="blue" trend="+0.3°" positive/><MetricCard icon={<Gauge/>} label={tr('pressure')} value={reading?.pressure.toFixed(1) ?? '—'} unit="hPa" detail="In aumento" color="violet" trend="+2.4" positive/><MetricCard icon={<Droplets/>} label={tr('humidity')} value={reading?.humidity ?? '—'} unit="%" detail={`${tr('rainfall')}: ${reading?.rain ?? '—'} mm`} color="teal" trend="−4%" positive/><MetricCard icon={<Wind/>} label={tr('wind')} value={reading?.windSpeed ?? '—'} unit="km/h" detail={`Direzione ${reading?.windDirection ?? '—'}`} color="green" trend="Moderato"/>
    </section>
    <div className="content-grid">
      <Card className="chart-panel"><CardHeader eyebrow="ANDAMENTO METEO" title="Andamento della laguna" description={`Rilevazioni demo da ${station?.name ?? '—'}`} action={<select className="period-select" value={period} onChange={(e) => setPeriod(e.target.value)} aria-label="Intervallo grafico"><option>24 ore</option><option>7 giorni</option><option>30 giorni</option></select>}/><div className="chart-legend"><span><i className="legend-air"/>Temperatura aria</span><span><i className="legend-water"/>Temperatura acqua</span><span className="chart-unit">°C</span></div><WeatherChart/><div className="chart-labels"><span>00:00</span><span>04:00</span><span>08:00</span><span>12:00</span><span>16:00</span><span>20:00</span><span>23:59</span></div><div className="chart-note"><span><i/> {tr('live')} · Dati dimostrativi, senza aggiornamento live</span><button onClick={() => go('history')}>{tr('viewHistory')} <ArrowRight size={14}/></button></div></Card>
      <Card className="stations-panel"><CardHeader eyebrow="RETE LOCALE" title={tr('stations')} action={<IconButton className="small-icon" label="Aggiungi stazione" onClick={() => go('profile')}><Plus size={18}/></IconButton>}/><div className="station-list">{stations.map((item) => <button key={item.id} className={`station-row ${item.id === selected ? 'selected' : ''}`} onClick={() => setSelected(item.id)}><div className="station-symbol"><MapPin size={17}/></div><div className="station-info"><strong>{item.name}</strong><span>{item.area}</span></div><div className="station-values"><strong>{item.reading.air.toFixed(1)}°</strong><span className={item.status === 'online' ? 'online-text' : 'offline-text'}><i/> {item.status === 'online' ? 'Online' : 'Offline'}</span></div></button>)}</div><button className="text-action" onClick={() => go('profile')}>{tr('addZone')}<ArrowRight size={15}/></button></Card>
    </div>
    <div className="bottom-grid"><Card className="tide-card"><div className="tide-header"><div className="tide-icon"><Waves size={19}/></div><span>MAREA · PUNTA DELLA SALUTE</span><span className="tide-status">NORMALE</span></div><div className="tide-content"><div><div className="tide-value">+42 <small>cm</small></div><p>Livello attuale</p></div><div className="tide-chart"><svg viewBox="0 0 280 70" preserveAspectRatio="none" role="img" aria-label="Grafico della marea"><path d="M0 48 C22 42 27 21 48 22 S78 55 104 49 S135 17 158 24 S185 57 207 50 S238 20 260 26 S273 45 280 40" fill="none" stroke="currentColor" strokeWidth="2.5"/><path d="M0 48 C22 42 27 21 48 22 S78 55 104 49 S135 17 158 24 S185 57 207 50 S238 20 260 26 S273 45 280 40 V70 H0Z" fill="currentColor" opacity=".07"/></svg><span>06:00 <b>Prossima alta marea · 14:24</b> 22:00</span></div></div><div className="tide-foot"><span><ArrowUpRight size={15}/> Crescente</span><span>Fonte: Comune di Venezia</span></div></Card>
      <Card className="forecast-card"><CardHeader eyebrow="PREVISIONI" title={tr('week')} action={<IconButton className="small-icon" label="Apri previsioni" onClick={() => go('forecast')}><ArrowRight size={17}/></IconButton>}/><div className="forecast-days">{[['OGGI','☀','19°','13°'],['GIO','🌤','18°','12°'],['VEN','⛅','17°','11°'],['SAB','🌧','15°','10°'],['DOM','☀','18°','12°']].map(([day, icon, hi, low]) => <div key={day} className="forecast-day"><span>{day}</span><b>{icon}</b><strong>{hi}</strong><small>{low}</small></div>)}</div><button className="text-action forecast-link" onClick={() => go('forecast')}>{tr('seeForecast')}<ArrowRight size={15}/></button></Card></div>
    <div className="section-title"><div><div className="eyebrow">VITA IN LAGUNA</div><h2>{tr('community')}</h2></div><button className="link-button" onClick={() => go('feed')}>{tr('viewAll')}<ArrowRight size={14}/></button></div>
    <div className="community-grid"><CommunityPostCard name="Giulia Bianchi" initials="GB" color="pink" time="12 min fa" text="Alba spettacolare stamattina a Burano 🌅 L'acqua era una tavola." image="lagoon"/><CommunityPostCard name="Marco Zorzi" initials="MZ" color="orange" time="1 ora fa" text="Prima pescata della stagione! La laguna ci sta regalando grandi soddisfazioni 🎣" image="boat"/></div>
  </>
}

function WeatherChart() { return <div className="weather-chart"><div className="chart-y-labels"><span>24°</span><span>20°</span><span>16°</span><span>12°</span></div><div className="chart-plot"><div className="grid-line"/><div className="grid-line"/><div className="grid-line"/><div className="grid-line"/><svg viewBox="0 0 760 180" preserveAspectRatio="none" role="img" aria-label="Andamento della temperatura aria e acqua nelle ultime 24 ore"><defs><linearGradient id="air-fill" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#d98f65" stopOpacity=".18"/><stop offset="1" stopColor="#d98f65" stopOpacity="0"/></linearGradient></defs><path d="M0 124 C45 118 70 100 110 103 S165 127 210 111 S275 70 320 81 S370 105 420 71 S480 56 530 63 S585 80 630 44 S705 37 760 25 V180 H0Z" fill="url(#air-fill)"/><path d="M0 124 C45 118 70 100 110 103 S165 127 210 111 S275 70 320 81 S370 105 420 71 S480 56 530 63 S585 80 630 44 S705 37 760 25" className="line-air"/><path d="M0 150 C50 143 75 151 110 142 S175 129 210 137 S270 120 320 127 S380 136 420 119 S475 126 530 111 S590 119 630 105 S710 112 760 95" className="line-water"/><circle cx="630" cy="44" r="4" className="chart-dot"/></svg></div></div> }

function Feed({ tr, post, setPost, onPost }: { tr: Tr; post: string; setPost: (v: string) => void; onPost: () => void }) { return <><PageHeading eyebrow="LAGUNA, INSIEME" title={tr('feed')} subtitle="Storie, osservazioni e momenti condivisi dalla comunità." action={<Button variant="primary" onClick={onPost}><Plus size={17}/>{tr('newPost')}</Button>}/><Card className="composer"><Avatar initials="LM" tone="me"/><textarea value={post} onChange={(e) => setPost(e.target.value)} placeholder="Cosa succede in laguna?"/><div className="composer-bottom"><span><Globe2 size={14}/><select aria-label="Visibilità"><option>{tr('public')}</option><option>{tr('friends')}</option></select></span><Button variant="primary" disabled={!post.trim()} onClick={onPost}>Pubblica<ArrowRight size={15}/></Button></div></Card><div className="feed-list"><CommunityPostCard name="Giulia Bianchi" initials="GB" color="pink" time="12 min fa" text="Alba spettacolare stamattina a Burano 🌅 L'acqua era una tavola." image="lagoon"/><CommunityPostCard name="Marco Zorzi" initials="MZ" color="orange" time="1 ora fa" text="Prima pescata della stagione! La laguna ci sta regalando grandi soddisfazioni 🎣" image="boat"/></div></> }

function Chat({ tr, messages, draft, setDraft, onSend }: { tr: Tr; messages: string[]; draft: string; setDraft: (v: string) => void; onSend: () => void }) { return <><PageHeading eyebrow="LA TUA RETE" title={tr('chat')} subtitle="Conversazioni con amici e appassionati della laguna."/><Card as="div" className="chat-layout"><div className="chat-people"><label className="chat-search"><Search size={15}/><input placeholder="Cerca conversazioni"/></label>{[['GB','Giulia Bianchi','A che ora partiamo?','10:42','pink'],['MZ','Marco Zorzi','Ti mando le foto!','Ieri','orange'],['AS','Anna Sartori','Grazie per i dati 🙌','Lun','blue']].map(([initial, name, last, time, color], i) => <button key={name} className={`person-row ${i === 0 ? 'person-active' : ''}`}><Avatar initials={initial} tone={color}/><span><strong>{name}</strong><small>{last}</small></span><time>{time}</time>{i === 0 && <i className="person-unread"/>}</button>)}</div><div className="chat-window"><div className="chat-title"><Avatar initials="GB" tone="pink"/><span><strong>Giulia Bianchi</strong><small><i/> Online</small></span><IconButton label="Apri dettagli"><UserRound size={18}/></IconButton></div><div className="chat-history"><div className="chat-date">OGGI</div><div className="bubble received">Ciao Luca! Hai visto le previsioni per domani?<small>10:38</small></div><div className="bubble sent">Sì, sembra perfetto per uscire in barca. Partiamo presto?<small>10:40 <ShieldCheck size={11}/></small></div><div className="bubble received">A che ora partiamo?<small>10:42</small></div>{messages.slice(1).map((message, i) => <div key={`${message}-${i}`} className="bubble sent">{message}<small>Adesso <ShieldCheck size={11}/></small></div>)}</div><form className="chat-compose" onSubmit={(e) => { e.preventDefault(); onSend() }}><input value={draft} onChange={(e) => setDraft(e.target.value)} placeholder={tr('writeMessage')}/><button className="send-button" aria-label={tr('send')} disabled={!draft.trim()}><Send size={17}/></button></form></div></Card></> }

function HistoryPage({ tr, search, year, setYear, rows }: { tr: Tr; search: string; year: string; setYear: (v: string) => void; rows: typeof history }) { return <><PageHeading eyebrow="OSSERVA I CAMBIAMENTI" title={tr('history')} subtitle="Esplora le rilevazioni meteo e ritrova i tuoi eventi." action={<Button variant="secondary"><ArrowDownRight size={16}/>Esporta CSV</Button>}/><Card className="history-panel"><div className="history-tools"><label className="history-search"><Search size={16}/><input placeholder={`${tr('search')} stazione o data`} value={search}/></label><select value={year} onChange={(e) => setYear(e.target.value)} aria-label={tr('year')}><option>2026</option><option>2025</option><option>2024</option></select><select aria-label={tr('month')}><option>{tr('all')} i mesi</option><option>Ottobre</option><option>Settembre</option></select><Button variant="secondary"><CalendarDays size={16}/>{tr('all')} i giorni</Button></div><div className="table-wrap"><table><thead><tr><th>DATA E ORA</th><th>STAZIONE</th><th>TEMP. ARIA</th><th>TEMP. ACQUA</th><th>VENTO</th><th>PRESSIONE</th><th>EVENTO</th></tr></thead><tbody>{rows.length ? rows.map((row) => <tr key={`${row.date}-${row.station}`}><td><strong>{row.date}</strong></td><td><span className="table-station"><MapPin size={14}/>{row.station}</span></td><td>{row.air} °C</td><td>{row.water} °C</td><td>{row.wind}</td><td>{row.pressure} hPa</td><td><span className="event-tag">—</span></td></tr>) : <tr><td colSpan={7} className="empty-state">{tr('noData')}</td></tr>}</tbody></table></div><div className="table-footer"><span>Mostrati <strong>{rows.length}</strong> risultati</span><div><IconButton className="small-icon" label="Pagina precedente"><ChevronLeft size={16}/></IconButton><button className="page-number">1</button><IconButton className="small-icon" label="Pagina successiva"><ChevronRight size={16}/></IconButton></div></div></Card><div className="info-banner"><ShieldCheck size={18}/><span>Gli eventi personali sono visibili solo a te. <strong>Accedi per annotare le tue osservazioni</strong> associate ai dati meteo.</span><button>Scopri come funziona<ArrowRight size={14}/></button></div></> }

function Forecast({ tr, period, setPeriod }: { tr: Tr; period: string; setPeriod: (v: string) => void }) { return <><PageHeading eyebrow="UNO SGUARDO AVANTI" title={tr('forecast')} subtitle="Tendenze meteo per pianificare il tuo tempo in laguna." action={<div className="period-tabs"><button className={period === '7 giorni' ? 'tab-active' : ''} onClick={() => setPeriod('7 giorni')}>7 giorni</button><button className={period === '30 giorni' ? 'tab-active' : ''} onClick={() => setPeriod('30 giorni')}>30 giorni</button></div>}/><Card as="div" className="forecast-hero"><div><div className="eyebrow">LAGUNA DI VENEZIA · PROSSIMI 7 GIORNI</div><h2>Una settimana <span>serena.</span></h2><p>Temperature miti e venti deboli: condizioni favorevoli per vivere la laguna.</p><div className="forecast-summary"><span><Thermometer size={17}/>18°<small>Media</small></span><span><Wind size={17}/>11 km/h<small>Vento medio</small></span><span><CloudRain size={17}/>20%<small>Prob. pioggia</small></span></div></div><div className="forecast-sun">☀<span>18°</span></div></Card><Card className="extended-forecast"><CardHeader eyebrow="PREVISIONI GIORNALIERE" title={tr('upcoming')} action={<span className="forecast-source"><i/> Stime indicative</span>}/><div className="forecast-row">{[['MER','15','☀','Sereno','19°','13°','10%'],['GIO','16','🌤','Poco nuvoloso','18°','12°','15%'],['VEN','17','⛅','Nuvoloso','17°','11°','20%'],['SAB','18','🌧','Pioggia debole','15°','10°','65%'],['DOM','19','☀','Sereno','18°','12°','5%'],['LUN','20','🌤','Parzialmente nuvoloso','19°','13°','10%'],['MAR','21','☀','Sereno','20°','14°','5%']].map(([day,date,icon,desc,hi,low,rain]) => <div className="forecast-row-item" key={date}><span>{day}<b>{date}</b></span><strong>{icon}</strong><small>{desc}</small><b>{hi}<i>{low}</i></b><em><Droplets size={12}/>{rain}</em></div>)}</div></Card><p className="disclaimer"><ShieldCheck size={15}/>{tr('forecastNote')}. Non sostituiscono le previsioni ufficiali.</p></> }

function Profile({ tr, events, eventModalOpen, eventType, eventDate, eventNote, eventFiles, setEventType, setEventDate, setEventNote, setEventFiles, onOpenEvent, onCloseEvent, onSaveEvent }: {
  tr: Tr
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
  onSaveEvent: (event: Omit<UserEvent, 'id'>) => void
}) {
  return <>
    <PageHeading eyebrow="IL TUO SPAZIO" title={tr('profile')} subtitle="Racconta la tua esperienza e tieni traccia delle tue uscite." action={<Button variant="secondary"><Settings size={16}/>Impostazioni</Button>}/>
    <Card as="div" className="profile-overview"><div className="profile-cover"><div className="cover-pattern"><Waves/></div></div><div className="profile-main"><Avatar initials="LM" tone="me" className="profile-avatar"/><div className="profile-identity"><h2>Luca Marin <ShieldCheck size={17}/></h2><span><MapPin size={14}/> Venezia · Membro da ottobre 2024</span><p>Appassionato di pesca e della laguna. Qui per imparare e condividere.</p></div><Button variant="secondary">Modifica profilo</Button></div><div className="profile-stats"><div><strong>24</strong><span>Eventi registrati</span></div><div><strong>12</strong><span>Amici</span></div><div><strong>3</strong><span>Stazioni seguite</span></div><div><strong>240 <small>XP</small></strong><span>Punti esperienza</span></div></div></Card>
    <div className="profile-columns">
      <Card className="event-panel">
        <CardHeader eyebrow="IL TUO DIARIO" title={tr('events')} action={<Button variant="primary" onClick={onOpenEvent}><Plus size={15}/>{tr('addEvent')}</Button>}/>
        <div className="event-list">{events.map((event) => <div key={event.id}><span className="event-dot"><Fish size={15}/></span><span><strong>{event.type} · {new Intl.DateTimeFormat('en-GB', { day: 'numeric', month: 'long', year: 'numeric' }).format(new Date(`${event.date}T00:00:00`))}</strong>{event.note && <small>{event.note}</small>}<small>Venice Lagoon · Private</small>{event.attachments.length > 0 && <small className="event-attachments"><Paperclip size={12}/>{event.attachments.map((file) => file.name).join(', ')}</small>}</span><ChevronRight size={15}/></div>)}</div>
      </Card>
      <Card className="badges-panel"><CardHeader eyebrow="LA TUA COLLEZIONE" title={tr('achievements')} action={<span className="badge-count">3 / 12</span>}/><div className="badge-grid"><div className="badge-item"><span>🧭</span><strong>Primo passo</strong><small>Primo evento registrato</small></div><div className="badge-item"><span>🌊</span><strong>Voce della laguna</strong><small>10 osservazioni condivise</small></div><div className="badge-item locked"><span>⚓</span><strong>Custode del mare</strong><small>Aggiungi una stazione meteo</small></div></div><div className="badge-points"><Trophy size={16}/> Il tuo contributo rende la laguna più ricca di dati.</div></Card>
    </div>
    <Card className="assets-panel"><CardHeader eyebrow="LA TUA ATTREZZATURA" title="Barca e attrezzatura da pesca" action={<Button variant="secondary"><Plus size={15}/>Aggiungi</Button>}/><p>Aggiungi la tua imbarcazione e l'attrezzatura per collegarle ai tuoi eventi.</p></Card>
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
