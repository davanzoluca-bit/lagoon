import { parseLiveWaterObservations } from '../src/domain/liveWeather'

declare const process: { env: Record<string, string | undefined> }

const stationId = '590ab8d1-c1f1-4e11-913d-a13fb45ef3d7'
const sourceUrl = 'https://dati.venezia.it/sites/default/files/dataset/opendata/tempacqua.json'

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } })
}

export async function POST(request: Request) {
  const authorization = request.headers.get('authorization')
  const token = authorization?.match(/^Bearer\s+(.+)$/i)?.[1]
  if (!token) return json({ error: 'Authentication required.' }, 401)

  const supabaseUrl = (process.env.SUPABASE_URL ?? process.env.VITE_SUPABASE_URL)?.replace(/\/$/, '')
  const publishableKey = process.env.SUPABASE_PUBLISHABLE_KEY ?? process.env.VITE_SUPABASE_PUBLISHABLE_KEY
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!supabaseUrl || !publishableKey || !serviceRoleKey) return json({ error: 'Server environment is not configured.' }, 500)

  try {
    const identity = await fetch(`${supabaseUrl}/auth/v1/user`, {
      headers: { apikey: publishableKey, Authorization: `Bearer ${token}` },
      cache: 'no-store',
    })
    if (!identity.ok) return json({ error: 'Authentication required.' }, 401)

    const sourceResponse = await fetch(sourceUrl, { cache: 'no-store', signal: AbortSignal.timeout(15_000) })
    if (!sourceResponse.ok) return json({ error: 'The Comune di Venezia data source is unavailable.' }, 502)
    const observations = parseLiveWaterObservations(await sourceResponse.json())
    if (observations.length === 0) return json({ error: 'No Punta Salute water-temperature reading was found.' }, 502)

    const rows = observations.map((observation) => ({ station_id: stationId, ...observation, tide_level_m: null }))
    const stored = await fetch(`${supabaseUrl}/rest/v1/weather_observations?on_conflict=station_id,recorded_at`, {
      method: 'POST',
      headers: {
        apikey: serviceRoleKey,
        Authorization: `Bearer ${serviceRoleKey}`,
        'Content-Type': 'application/json',
        Prefer: 'resolution=ignore-duplicates,return=representation',
      },
      body: JSON.stringify(rows),
      cache: 'no-store',
    })
    if (!stored.ok) {
      const detail = await stored.text()
      console.error('Water observation upsert failed:', stored.status, detail)
      return json({ error: 'Could not save the latest water-temperature readings.' }, 502)
    }
    const inserted = await stored.json() as Array<{ recorded_at: string; water_temp_c: number | null; tide_level_m: number | null }>
    return json({ ok: true, received: rows.length, inserted })
  } catch (error) {
    console.error('Live water-temperature refresh failed:', error)
    return json({ error: 'Could not refresh water-temperature readings.' }, 502)
  }
}

export function GET() {
  return json({ error: 'Use POST to refresh readings.' }, 405)
}
