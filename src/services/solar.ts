export type GeoLocation = {
  latitude: number
  longitude: number
}

export type SolarTimes = {
  sunrise: string
  sunset: string
  timezone: string
  date: string
}

export type PlaceResult = GeoLocation & {
  id: number
  name: string
  country: string
  admin1?: string
  timezone: string
}

type ForecastResponse = {
  timezone?: string
  daily?: { time?: string[]; sunrise?: string[]; sunset?: string[] }
}

export async function getSolarTimes({ latitude, longitude }: GeoLocation): Promise<SolarTimes> {
  const params = new URLSearchParams({
    latitude: String(latitude),
    longitude: String(longitude),
    daily: 'sunrise,sunset',
    timezone: 'auto',
    forecast_days: '1',
  })
  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params}`)
  if (!response.ok) throw new Error(`Sunrise and sunset request failed (${response.status}).`)
  const data = await response.json() as ForecastResponse
  const sunrise = data.daily?.sunrise?.[0]
  const sunset = data.daily?.sunset?.[0]
  const date = data.daily?.time?.[0]
  if (!sunrise || !sunset || !date) throw new Error('Sunrise and sunset are not available for this location.')
  return { sunrise, sunset, date, timezone: data.timezone ?? 'auto' }
}

type GeocodingResponse = { results?: PlaceResult[] }

export async function searchPlaces(name: string, language: string): Promise<PlaceResult[]> {
  const params = new URLSearchParams({ name, count: '8', language })
  const response = await fetch(`https://geocoding-api.open-meteo.com/v1/search?${params}`)
  if (!response.ok) throw new Error(`Location search failed (${response.status}).`)
  const data = await response.json() as GeocodingResponse
  return data.results ?? []
}
