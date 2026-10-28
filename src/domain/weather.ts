export type WeatherReading = {
  time: string; pressure: number; air: number; water: number; humidity: number
  rain: number; windSpeed: number; windDirection: string
}

export type WeatherStation = { id: string; name: string; area: string; status: 'online' | 'offline'; reading: WeatherReading }

export interface WeatherSource { getStations(): Promise<WeatherStation[]> }

// Demo adapter: replace this boundary with the Comune/ISPRA ingestion service.
export const demoWeatherSource: WeatherSource = {
  async getStations() { return stations },
}

export const stations: WeatherStation[] = [
  { id: 'punta-salute', name: 'Punta della Salute', area: 'Canal Grande', status: 'online', reading: { time: '09:42', pressure: 1016.8, air: 18.4, water: 16.2, humidity: 72, rain: 0.4, windSpeed: 12, windDirection: 'NE' } },
  { id: 'burano', name: 'Burano', area: 'Laguna nord', status: 'online', reading: { time: '09:38', pressure: 1016.2, air: 17.8, water: 15.9, humidity: 76, rain: 0.2, windSpeed: 9, windDirection: 'N' } },
  { id: 'chioggia', name: 'Chioggia', area: 'Laguna sud', status: 'offline', reading: { time: '08:56', pressure: 1015.9, air: 18.8, water: 16.7, humidity: 68, rain: 0, windSpeed: 14, windDirection: 'ENE' } },
]

export const history = [
  { date: 'Oggi, 09:00', station: 'Punta della Salute', air: 18.4, water: 16.2, wind: '12 km/h NE', pressure: 1016.8 },
  { date: 'Oggi, 08:00', station: 'Punta della Salute', air: 17.9, water: 16.1, wind: '10 km/h NE', pressure: 1016.4 },
  { date: 'Ieri, 18:00', station: 'Punta della Salute', air: 19.1, water: 16.5, wind: '8 km/h E', pressure: 1015.8 },
]
