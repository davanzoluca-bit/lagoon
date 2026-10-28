import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

const backend = vi.hoisted(() => ({
  getEvents: vi.fn(),
  getFishSpecies: vi.fn(),
  getAcceptedFriends: vi.fn(),
  getFriendConnections: vi.fn(),
  searchUsers: vi.fn(),
  sendFriendRequest: vi.fn(),
  acceptFriendRequest: vi.fn(),
  removeFriendConnection: vi.fn(),
  createPost: vi.fn(),
  getPostMediaUrl: vi.fn(),
  getEventAttachmentUrl: vi.fn(),
  createEvent: vi.fn(),
  updateEvent: vi.fn(),
  deleteEvent: vi.fn(),
  getMessages: vi.fn(),
  getPosts: vi.fn(),
  getWeatherObservations: vi.fn(),
  getWeatherStation: vi.fn(),
  getSolarTimes: vi.fn(),
  searchPlaces: vi.fn(),
  session: { access_token: 'test-token', refresh_token: 'test-refresh', user: { id: 'test-user', email: 'test@example.com', user_metadata: { display_name: 'Test User' } } },
}))

vi.mock('./backend/supabase', () => ({
  backendReady: true,
  readSession: () => backend.session,
  getEvents: backend.getEvents,
  getFishSpecies: backend.getFishSpecies,
  getAcceptedFriends: backend.getAcceptedFriends,
  getFriendConnections: backend.getFriendConnections,
  searchUsers: backend.searchUsers,
  sendFriendRequest: backend.sendFriendRequest,
  acceptFriendRequest: backend.acceptFriendRequest,
  removeFriendConnection: backend.removeFriendConnection,
  getPostMediaUrl: backend.getPostMediaUrl,
  getEventAttachmentUrl: backend.getEventAttachmentUrl,
  getMessages: backend.getMessages,
  getPosts: backend.getPosts,
  getWeatherObservations: backend.getWeatherObservations,
  getWeatherStation: backend.getWeatherStation,
  createEvent: backend.createEvent,
  updateEvent: backend.updateEvent,
  deleteEvent: backend.deleteEvent,
  createMessage: vi.fn(),
  createPost: backend.createPost,
  exchangeOAuthCode: vi.fn(),
  signIn: vi.fn(),
  signInWithProvider: vi.fn(),
  signOut: vi.fn(),
  signUp: vi.fn(),
}))

vi.mock('./services/solar', () => ({ getSolarTimes: backend.getSolarTimes, searchPlaces: backend.searchPlaces }))

describe('dashboard weather readings', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.removeItem('lagoon.user-location')
    backend.getEvents.mockResolvedValue([])
    backend.getFishSpecies.mockResolvedValue([{ id: 1, slug: 'branzino', name_it: 'Branzino (spigola)', name_en: 'European seabass' }])
    backend.getAcceptedFriends.mockResolvedValue([])
    backend.getFriendConnections.mockResolvedValue([])
    backend.searchUsers.mockResolvedValue([])
    backend.sendFriendRequest.mockResolvedValue(undefined)
    backend.acceptFriendRequest.mockResolvedValue(undefined)
    backend.removeFriendConnection.mockResolvedValue(undefined)
    backend.createPost.mockResolvedValue({ id: 'post-1' })
    backend.getPostMediaUrl.mockImplementation((path: string) => Promise.resolve(`https://media.example/${path}`))
    backend.getEventAttachmentUrl.mockImplementation((path: string, downloadName?: string) => Promise.resolve(`https://storage.example/${encodeURIComponent(path)}${downloadName ? `?download=${encodeURIComponent(downloadName)}` : ''}`))
    backend.createEvent.mockResolvedValue({ id: 'new-event' })
    backend.updateEvent.mockResolvedValue(undefined)
    backend.deleteEvent.mockResolvedValue(undefined)
    backend.getMessages.mockResolvedValue([])
    backend.getPosts.mockResolvedValue([])
    backend.getWeatherStation.mockResolvedValue({
      id: '590ab8d1-c1f1-4e11-913d-a13fb45ef3d7',
      slug: 'punta-salute-canal-grande',
      name: 'Punta Salute Canal Grande',
      area: 'Canal Grande',
      source_url: 'https://example.com',
      source_license: 'CC-BY',
      source_time_basis: 'UTC+01:00 solar time, year-round',
      vertical_datum: 'ZMPS 1897',
    })
    backend.getSolarTimes.mockResolvedValue({ sunrise: '2026-10-28T07:24', sunset: '2026-10-28T17:58', date: '2026-10-28', timezone: 'Europe/Rome' })
    backend.searchPlaces.mockResolvedValue([])
  })

  it('shows the latest available value for each measurement, skipping null readings', async () => {
    backend.getWeatherObservations.mockResolvedValue([
      { recorded_at: '2026-10-28T12:05:00', tide_level_m: null, water_temp_c: 22.7 },
      { recorded_at: '2026-10-28T12:00:00', tide_level_m: 0.84, water_temp_c: 22.6 },
    ])

    const { container } = render(<App />)

    await waitFor(() => expect(backend.getWeatherObservations).toHaveBeenCalledWith('590ab8d1-c1f1-4e11-913d-a13fb45ef3d7', 9000))
    expect(await screen.findByText('07:24')).toBeInTheDocument()
    expect(screen.getByText('17:58')).toBeInTheDocument()
    expect(screen.getByText('Alba')).toBeInTheDocument()
    expect(screen.getByText('Tramonto')).toBeInTheDocument()
    expect(screen.getByText('Venezia, Italia')).toBeInTheDocument()
    await waitFor(() => {
      const values = [...container.querySelectorAll('.metrics-grid--source .metric-value')]
      expect(values).toHaveLength(4)
      expect(values[0]).toHaveTextContent('22.7°C')
      expect(values[1]).toHaveTextContent('0.84m')
    })
    expect(screen.getByText(/Punta Salute Canal Grande · 28 ott/)).toBeInTheDocument()
    expect(screen.getAllByText('Marea (m)').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Temperatura acqua (°C)').length).toBeGreaterThan(0)

    const chart = screen.getByRole('group', { name: 'Tocca o passa sul grafico per esplorare le rilevazioni.' })
    vi.spyOn(chart, 'getBoundingClientRect').mockReturnValue({ x: 0, y: 0, left: 0, top: 0, right: 860, bottom: 270, width: 860, height: 270, toJSON: () => ({}) } as DOMRect)
    fireEvent.pointerMove(chart, { clientX: 800 })
    expect(await screen.findByRole('status')).toHaveTextContent('22,7 °C')
    fireEvent.pointerLeave(chart)
    expect(screen.queryByRole('status')).not.toBeInTheDocument()
    fireEvent.pointerDown(chart, { clientX: 800 })
    expect(await screen.findByRole('status')).toHaveTextContent('22,7 °C')
    expect(screen.getByRole('status')).toHaveTextContent('— m')
  })

  it('keeps the dashboard usable and explains when the database has no observations', async () => {
    backend.getWeatherObservations.mockResolvedValue([])
    render(<App />)

    expect(await screen.findByText('Nessuna rilevazione importata')).toBeInTheDocument()
    expect(document.querySelectorAll('.metrics-grid--source .metric-detail')).toHaveLength(4)
    expect(document.querySelector('.metrics-grid--source')).toHaveTextContent('Nessuna lettura importata')
  })

  it('shows user events on the chart only when enabled and opens their details', async () => {
    backend.getWeatherObservations.mockResolvedValue([
      { recorded_at: '2026-10-28T12:00:00', tide_level_m: 0.84, water_temp_c: 22.6 },
      { recorded_at: '2026-10-28T11:00:00', tide_level_m: 0.75, water_temp_c: 22.4 },
    ])
    backend.getEvents.mockResolvedValue([{
      id: 'event-1', owner_id: 'test-user', event_type: 'Fishing trip', event_date: '2026-10-28', note: 'Caught a sea bass', tags: [], event_participants: [],
      event_attachments: [{ file_name: 'catch.jpg', object_path: 'test-user/event-1/catch.jpg', content_type: 'image/jpeg' }, { file_name: 'track.gpx', object_path: 'test-user/event-1/track.gpx', content_type: 'application/gpx+xml' }],
    }])
    render(<App />)

    const toggle = await screen.findByRole('switch', { name: 'Mostra eventi' })
    expect(document.querySelector('.observation-event-marker')).not.toBeInTheDocument()
    fireEvent.click(toggle)

    expect(await screen.findByRole('button', { name: /Evento: Uscita di pesca/ })).toBeInTheDocument()
    expect(document.querySelector('.observation-event-marker__icon')).toBeInTheDocument()
    expect(Number(document.querySelector('.observation-event-marker__dot')?.getAttribute('cy'))).toBeGreaterThan(200)
    fireEvent.click(await screen.findByRole('button', { name: /Evento: Uscita di pesca/ }))
    expect(await screen.findByRole('dialog')).toHaveTextContent('Caught a sea bass')
    expect(await screen.findByAltText('catch.jpg')).toHaveAttribute('src', 'https://storage.example/test-user%2Fevent-1%2Fcatch.jpg')
    expect(await screen.findByRole('link', { name: /track.gpx/ })).toHaveAttribute('download', 'track.gpx')
    expect(backend.getEventAttachmentUrl).toHaveBeenCalledWith('test-user/event-1/track.gpx', 'track.gpx')
  })

  it('loads older chart rows for the last month than for the last week', async () => {
    backend.getWeatherObservations.mockResolvedValue([
      { recorded_at: '2026-10-28T12:00:00', tide_level_m: 0.84, water_temp_c: 22.6 },
      { recorded_at: '2026-10-08T12:00:00', tide_level_m: 0.62, water_temp_c: 21.8 },
    ])
    render(<App />)

    const interval = await screen.findByRole('combobox', { name: 'Intervallo' })
    fireEvent.change(interval, { target: { value: '30d' } })
    expect(await screen.findByText('08/10, 12:00')).toBeInTheDocument()
    fireEvent.change(interval, { target: { value: '7d' } })
    await waitFor(() => expect(screen.queryByText('08/10, 12:00')).not.toBeInTheDocument())
  })

  it('saves optional trip times and multiple fish catch fields', async () => {
    backend.getWeatherObservations.mockResolvedValue([])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Il mio profilo' }))
    fireEvent.click(await screen.findByRole('button', { name: /Registra un evento/ }))
    await screen.findByRole('option', { name: 'Branzino (spigola)' })
    fireEvent.change(screen.getByLabelText('Inizio (opzionale)'), { target: { value: '2026-10-28T08:30' } })
    fireEvent.change(screen.getByLabelText('Fine (opzionale)'), { target: { value: '2026-10-28T11:45' } })
    fireEvent.change(screen.getByLabelText('Specie'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Quantità'), { target: { value: '2' } })
    fireEvent.change(screen.getByLabelText('Data di cattura (opzionale)'), { target: { value: '2026-10-28' } })
    fireEvent.change(screen.getByLabelText('Ora cattura (opzionale)'), { target: { value: '09:15' } })
    fireEvent.change(screen.getByLabelText('Latitudine'), { target: { value: '45.44' } })
    fireEvent.change(screen.getByLabelText('Longitudine'), { target: { value: '12.31' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva evento' }))

    await waitFor(() => expect(backend.createEvent).toHaveBeenCalledWith(expect.objectContaining({
      event_type: 'Fishing trip',
      start_at: new Date('2026-10-28T08:30').toISOString(),
      end_at: new Date('2026-10-28T11:45').toISOString(),
    }), [{ species_id: 1, quantity: 2, caught_on: '2026-10-28', caught_time: '09:15', latitude: 45.44, longitude: 12.31 }], [], []))
  })

  it('saves tags and selected Lagoon members with a fishing event', async () => {
    backend.getWeatherObservations.mockResolvedValue([])
    backend.getAcceptedFriends.mockResolvedValue([{ id: 'friend-1', display_name: 'Marta' }])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Il mio profilo' }))
    fireEvent.click(await screen.findByRole('button', { name: /Registra un evento/ }))
    await screen.findByRole('option', { name: 'Branzino (spigola)' })
    fireEvent.change(screen.getByLabelText('Specie'), { target: { value: '1' } })
    fireEvent.change(screen.getByLabelText('Tag'), { target: { value: 'alba' } })
    fireEvent.keyDown(screen.getByLabelText('Tag'), { key: 'Enter' })
    fireEvent.click(screen.getByLabelText('Marta'))
    fireEvent.click(screen.getByRole('button', { name: 'Salva evento' }))

    await waitFor(() => expect(backend.createEvent).toHaveBeenCalledWith(expect.objectContaining({ tags: ['alba'] }), expect.any(Array), ['friend-1'], []))
  })

  it('marks events shared by another Lagoon member with a different chart color', async () => {
    backend.getWeatherObservations.mockResolvedValue([{ recorded_at: '2026-10-28T12:00:00', tide_level_m: 0.84, water_temp_c: 22.6 }])
    backend.getEvents.mockResolvedValue([{
      id: 'shared-event', owner_id: 'friend-1', event_type: 'Fishing trip', event_date: '2026-10-28', start_at: null, end_at: null, note: '', tags: [], created_at: '2026-10-28T12:00:00Z',
      event_participants: [{ user_id: 'test-user' }], event_attachments: [], event_catches: [],
    }])
    render(<App />)
    fireEvent.click(await screen.findByRole('switch', { name: 'Mostra eventi' }))
    const marker = await screen.findByRole('button', { name: /Evento condiviso con te/ })
    expect(marker).toHaveClass('observation-event-marker--shared')
  })

  it('sends a friend request from the feed directory', async () => {
    backend.getWeatherObservations.mockResolvedValue([])
    backend.searchUsers.mockResolvedValue([{ id: 'friend-2', display_name: 'Marta' }])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Feed' }))
    fireEvent.change(screen.getByLabelText('Cerca persone per nome'), { target: { value: 'Mar' } })
    fireEvent.click(await screen.findByRole('button', { name: 'Aggiungi amico: Marta' }))
    await waitFor(() => expect(backend.sendFriendRequest).toHaveBeenCalledWith('test-user', 'friend-2'))
  })

  it('publishes a feed post with an attached photo', async () => {
    backend.getWeatherObservations.mockResolvedValue([])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Feed' }))
    fireEvent.change(screen.getByPlaceholderText('Condividi un aggiornamento'), { target: { value: 'La laguna al tramonto' } })
    const photo = new File(['photo'], 'tramonto.jpg', { type: 'image/jpeg' })
    fireEvent.change(document.querySelector('input[type="file"][accept="image/*,video/*"]')!, { target: { files: [photo] } })
    fireEvent.click(screen.getByRole('button', { name: 'Pubblica' }))

    await waitFor(() => expect(backend.createPost).toHaveBeenCalledWith('La laguna al tramonto', [photo], 'public', []))
  })

  it('publishes a post only to selected friends', async () => {
    backend.getWeatherObservations.mockResolvedValue([])
    backend.getFriendConnections.mockResolvedValue([{
      id: 'connection-1', user_id: 'test-user', friend_id: 'friend-1', status: 'accepted', created_at: '2026-10-28T12:00:00Z', incoming: false,
      profile: { id: 'friend-1', display_name: 'Marta' },
    }])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Feed' }))
    fireEvent.change(screen.getByLabelText('Chi può vedere il post?'), { target: { value: 'selected' } })
    fireEvent.click(await screen.findByLabelText('Marta'))
    fireEvent.change(screen.getByPlaceholderText('Condividi un aggiornamento'), { target: { value: 'Solo per Marta' } })
    fireEvent.click(screen.getByRole('button', { name: 'Pubblica' }))

    await waitFor(() => expect(backend.createPost).toHaveBeenCalledWith('Solo per Marta', [], 'selected', ['friend-1']))
  })

  it('renders photo and video attachments in feed posts', async () => {
    backend.getWeatherObservations.mockResolvedValue([])
    backend.getPosts.mockResolvedValue([{
      id: 'post-media', body: 'Un aggiornamento', author_id: 'test-user', visibility: 'public', created_at: '2026-10-28T12:00:00Z',
      post_attachments: [
        { file_name: 'laguna.jpg', object_path: 'test-user/post-media/laguna.jpg', content_type: 'image/jpeg' },
        { file_name: 'uscita.mp4', object_path: 'test-user/post-media/uscita.mp4', content_type: 'video/mp4' },
      ],
    }])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Feed' }))
    expect(await screen.findByAltText('laguna.jpg')).toHaveAttribute('src', 'https://media.example/test-user/post-media/laguna.jpg')
    expect(await screen.findByLabelText('uscita.mp4')).toHaveAttribute('controls')
  })

  it('edits a saved fishing event including each fish time and location', async () => {
    backend.getWeatherObservations.mockResolvedValue([])
    backend.getEvents.mockResolvedValue([{
      id: 'trip-1', owner_id: 'test-user', tags: [], event_participants: [], event_type: 'Fishing trip', event_date: '2026-10-23', start_at: '2026-10-23T08:00:00Z', end_at: '2026-10-23T11:00:00Z', note: 'Morning trip', created_at: '2026-10-23T08:00:00Z',
      event_attachments: [],
      event_catches: [{ id: 'catch-1', species_id: 1, quantity: 2, caught_on: '2026-10-23', caught_time: '09:15:00', latitude: 45.44, longitude: 12.31, fish_species: { id: 1, slug: 'branzino', name_it: 'Branzino (spigola)', name_en: 'European seabass' } }],
    }])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Il mio profilo' }))
    fireEvent.click(await screen.findByRole('button', { name: /Modifica evento: Uscita di pesca/ }))
    expect(await screen.findByRole('heading', { name: 'Modifica evento' })).toBeInTheDocument()
    expect(screen.getByLabelText('Ora cattura (opzionale)')).toHaveValue('09:15')
    expect(screen.getByLabelText('Latitudine')).toHaveValue(45.44)
    fireEvent.change(screen.getByLabelText('Note'), { target: { value: 'Updated trip' } })
    fireEvent.click(screen.getByRole('button', { name: 'Salva evento' }))

    await waitFor(() => expect(backend.updateEvent).toHaveBeenCalledWith('trip-1', expect.objectContaining({ note: 'Updated trip', tags: [] }), [{ species_id: 1, quantity: 2, caught_on: '2026-10-23', caught_time: '09:15', latitude: 45.44, longitude: 12.31 }], [], []))
  })

  it('asks before deleting an event and then deletes it', async () => {
    backend.getWeatherObservations.mockResolvedValue([])
    backend.getEvents.mockResolvedValue([{ id: 'trip-delete', owner_id: 'test-user', tags: [], event_participants: [], event_type: 'Fishing trip', event_date: '2026-10-23', start_at: null, end_at: null, note: '', created_at: '2026-10-23T08:00:00Z', event_attachments: [], event_catches: [] }])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: 'Il mio profilo' }))
    fireEvent.click(await screen.findByRole('button', { name: /Elimina evento: Uscita di pesca/ }))
    expect(await screen.findByText('Vuoi eliminare questo evento e le sue catture? L’azione non si può annullare.')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Elimina' }))
    await waitFor(() => expect(backend.deleteEvent).toHaveBeenCalledWith('trip-delete'))
  })

  it('switches translated dashboard content between Italian and English', async () => {
    backend.getWeatherObservations.mockResolvedValue([{ recorded_at: '2026-10-28T12:00:00', tide_level_m: 0.84, water_temp_c: 22.6 }])
    render(<App />)

    expect(await screen.findByText('Marea e temperatura dell’acqua')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: 'Cambia lingua' }))
    expect(await screen.findByText('Tide and water temperature')).toBeInTheDocument()
    expect(screen.getByText('Water temperature')).toBeInTheDocument()
  })

  it('lets the user choose a city for local sunrise and sunset times', async () => {
    backend.getWeatherObservations.mockResolvedValue([])
    backend.searchPlaces.mockResolvedValue([{ id: 1, name: 'Milano', admin1: 'Lombardia', country: 'Italia', latitude: 45.4642, longitude: 9.19, timezone: 'Europe/Rome' }])
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: /Venezia, Italia/ }))
    expect(await screen.findByRole('heading', { name: 'Scegli la località' })).toBeInTheDocument()
    fireEvent.change(screen.getByPlaceholderText('Inserisci il nome di una città'), { target: { value: 'Milano' } })
    fireEvent.click(screen.getByRole('button', { name: 'Cerca' }))
    fireEvent.click(await screen.findByRole('button', { name: /Milano/ }))

    await waitFor(() => expect(backend.getSolarTimes).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 45.4642, longitude: 9.19 })))
    await waitFor(() => expect(document.querySelector('.area-switch')).toHaveTextContent('Milano, Lombardia, Italia'))
  })

  it('uses browser geolocation when permission is granted', async () => {
    const originalGeolocation = Object.getOwnPropertyDescriptor(navigator, 'geolocation')
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { getCurrentPosition: (success: PositionCallback) => success({ coords: { latitude: 46.06, longitude: 11.12 } as GeolocationCoordinates } as GeolocationPosition) },
    })
    try {
      render(<App />)
      await waitFor(() => expect(backend.getSolarTimes).toHaveBeenLastCalledWith(expect.objectContaining({ latitude: 46.06, longitude: 11.12 })))
    } finally {
      if (originalGeolocation) Object.defineProperty(navigator, 'geolocation', originalGeolocation)
      else Reflect.deleteProperty(navigator, 'geolocation')
    }
  })

  it('changes the chart data window while defaulting to the latest 24 hours', async () => {
    backend.getWeatherObservations.mockResolvedValue([
      { recorded_at: '2026-10-28T12:00:00', tide_level_m: 0.62, water_temp_c: 19.4 },
      { recorded_at: '2026-10-27T12:00:00', tide_level_m: 0.51, water_temp_c: 19.1 },
      { recorded_at: '2026-10-26T12:00:00', tide_level_m: 0.44, water_temp_c: 18.9 },
      { recorded_at: '2026-10-25T12:00:00', tide_level_m: 0.39, water_temp_c: 18.6 },
    ])
    const { container } = render(<App />)

    const range = await screen.findByRole('combobox', { name: 'Intervallo' })
    expect(range).toHaveValue('24h')
    const waterPath = container.querySelector('.observation-line--water')!
    const pointsInDefaultRange = waterPath.getAttribute('d')!.match(/[ML]/g)!.length
    fireEvent.change(range, { target: { value: '3d' } })
    await waitFor(() => expect(waterPath.getAttribute('d')!.match(/[ML]/g)!.length).toBeGreaterThan(pointsInDefaultRange))
  })
})
