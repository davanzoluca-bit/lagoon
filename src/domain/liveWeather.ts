export type LiveWaterObservation = { recorded_at: string; water_temp_c: number }

export function parseLiveWaterObservations(payload: unknown, stationId = '1025'): LiveWaterObservation[] {
  if (!Array.isArray(payload)) throw new Error('The Comune di Venezia response is not a JSON array.')
  const seen = new Set<string>()
  const rows: LiveWaterObservation[] = []
  for (const value of payload) {
    if (!value || typeof value !== 'object') continue
    const row = value as Record<string, unknown>
    if (String(row.ID_stazione ?? '') !== stationId || typeof row.data !== 'string' || typeof row.valore !== 'string') continue
    const timestamp = row.data.match(/^(\d{4}-\d{2}-\d{2}) (\d{2}:\d{2}:\d{2})$/)
    const temperature = row.valore.match(/[-+]?\d+(?:[.,]\d+)?/)
    if (!timestamp || !temperature) continue
    const recordedAt = `${timestamp[1]} ${timestamp[2]}`
    const instant = Date.parse(`${timestamp[1]}T${timestamp[2]}Z`)
    const waterTemp = Number(temperature[0].replace(',', '.'))
    if (!Number.isFinite(instant) || new Date(instant).toISOString().slice(0, 19) !== `${timestamp[1]}T${timestamp[2]}` || !Number.isFinite(waterTemp) || seen.has(recordedAt)) continue
    seen.add(recordedAt)
    rows.push({ recorded_at: recordedAt, water_temp_c: waterTemp })
  }
  return rows
}
