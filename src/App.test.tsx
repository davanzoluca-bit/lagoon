import { beforeEach, describe, expect, it, vi } from 'vitest'
import { fireEvent, render, screen, waitFor } from '@testing-library/react'
import App from './App'

const backend = vi.hoisted(() => ({
  getEvents: vi.fn(),
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
  getMessages: backend.getMessages,
  getPosts: backend.getPosts,
  getWeatherObservations: backend.getWeatherObservations,
  getWeatherStation: backend.getWeatherStation,
  createEvent: vi.fn(),
  createMessage: vi.fn(),
  createPost: vi.fn(),
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

    await waitFor(() => expect(backend.getWeatherObservations).toHaveBeenCalledWith('590ab8d1-c1f1-4e11-913d-a13fb45ef3d7', 1000))
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
})
