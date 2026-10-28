import { afterEach, describe, expect, it, vi } from 'vitest'
import { getSolarTimes, searchPlaces } from './solar'

afterEach(() => vi.unstubAllGlobals())

describe('Open-Meteo sun times and location search', () => {
  it('requests sunrise and sunset in the coordinate location timezone', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ timezone: 'Europe/Rome', daily: { time: ['2026-10-28'], sunrise: ['2026-10-28T07:24'], sunset: ['2026-10-28T17:58'] } }),
    })
    vi.stubGlobal('fetch', fetchMock)

    await expect(getSolarTimes({ latitude: 45.44, longitude: 12.31 })).resolves.toEqual({
      date: '2026-10-28', sunrise: '2026-10-28T07:24', sunset: '2026-10-28T17:58', timezone: 'Europe/Rome',
    })
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(requestUrl.searchParams.get('timezone')).toBe('auto')
    expect(requestUrl.searchParams.get('daily')).toBe('sunrise,sunset')
  })

  it('searches for locations in the selected language', async () => {
    const place = { id: 1, name: 'Venezia', country: 'Italia', latitude: 45.44, longitude: 12.31, timezone: 'Europe/Rome' }
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [place] }) })
    vi.stubGlobal('fetch', fetchMock)

    await expect(searchPlaces('Venezia', 'it')).resolves.toEqual([place])
    const requestUrl = new URL(fetchMock.mock.calls[0][0] as string)
    expect(requestUrl.searchParams.get('language')).toBe('it')
    expect(requestUrl.searchParams.get('name')).toBe('Venezia')
  })
})
