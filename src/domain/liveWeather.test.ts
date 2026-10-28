import { describe, expect, it } from 'vitest'
import { parseLiveWaterObservations } from './liveWeather'

describe('Comune di Venezia live water-temperature feed', () => {
  it('parses Punta Salute readings and leaves other stations out', () => {
    expect(parseLiveWaterObservations([
      { ID_stazione: '1025', data: '2026-10-26 23:10:00', valore: '17.3 °C' },
      { ID_stazione: '1046', stazione: 'Meda Abate' },
      { ID_stazione: '1021', stazione: 'Piattaforma' },
    ])).toEqual([{ recorded_at: '2026-10-26 23:10:00', water_temp_c: 17.3 }])
  })

  it('normalizes decimal commas and removes duplicate timestamps', () => {
    expect(parseLiveWaterObservations([
      { ID_stazione: 1025, data: '2026-10-27 00:00:00', valore: '16,8 °C' },
      { ID_stazione: '1025', data: '2026-10-27 00:00:00', valore: '16.8 °C' },
    ])).toEqual([{ recorded_at: '2026-10-27 00:00:00', water_temp_c: 16.8 }])
  })

  it('rejects malformed or impossible source readings', () => {
    expect(parseLiveWaterObservations([
      { ID_stazione: '1025', data: '2026-02-30 12:00:00', valore: '17.3 °C' },
      { ID_stazione: '1025', data: '2026-10-27 12:00:00', valore: 'n/a' },
    ])).toEqual([])
    expect(() => parseLiveWaterObservations({})).toThrow(/JSON array/)
  })
})
