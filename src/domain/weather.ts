export type HistoryRow = {
  date: string
  station: string
  air: number
  water: number
  wind: string
  pressure: number
}

export type WeatherReading = { time: string; pressure: number; air: number; water: number; humidity: number; rain: number; windSpeed: number; windDirection: string }
export type WeatherStation = { id: string; name: string; area: string; status: 'online' | 'offline'; reading: WeatherReading }
export const stations: WeatherStation[] = []
export const demoWeatherSource = { async getStations(): Promise<WeatherStation[]> { return stations } }
