export interface WeatherData {
  temperature: number
  condition: string
  humidity: number
  windSpeed: number
  location: string
  timestamp: Date
}

export interface LocationData {
  city: string
  region: string
  country: string
  latitude: number
  longitude: number
}

export async function getCurrentLocation(): Promise<LocationData> {
  try {
    const response = await fetch(`https://ipinfo.io/json?token=${process.env.NEXT_PUBLIC_IPINFO_API_KEY}`)
    const data = await response.json()

    const [lat, lon] = data.loc.split(',').map(Number)

    return {
      city: data.city,
      region: data.region,
      country: data.country,
      latitude: lat,
      longitude: lon,
    }
  } catch (error) {
    console.error('Failed to get location:', error)
    return {
      city: 'New York',
      region: 'NY',
      country: 'US',
      latitude: 40.7128,
      longitude: -74.006,
    }
  }
}

const callWeatherEndpoint = async (targetDate: Date, location: LocationData): Promise<WeatherData> => {
  const params = new URLSearchParams({
    date: targetDate.toISOString(),
    lat: String(location.latitude),
    lon: String(location.longitude),
  })

  const response = await fetch(`/api/weather?${params.toString()}`)
  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(
      `Weather endpoint failed (${response.status}): ${error && typeof error === 'object' ? JSON.stringify(error) : response.statusText}`,
    )
  }

  const data = (await response.json()) as WeatherData
  return {
    ...data,
    timestamp: data.timestamp ? new Date(data.timestamp) : new Date(targetDate),
  }
}

export async function getWeatherData(location?: LocationData): Promise<WeatherData> {
  const loc = location || (await getCurrentLocation())
  return callWeatherEndpoint(new Date(), loc)
}

export async function getWeatherForecast(targetDate: Date, location?: LocationData): Promise<WeatherData> {
  const loc = location || (await getCurrentLocation())
  return callWeatherEndpoint(targetDate, loc)
}

export function getWeatherIcon(condition: string): string {
  const normalized = condition.toLowerCase()

  if (normalized.includes('sun') || normalized.includes('clear')) return '☀️'
  if (normalized.includes('cloud')) return '☁️'
  if (normalized.includes('rain') || normalized.includes('drizzle') || normalized.includes('shower')) return '🌧️'
  if (normalized.includes('snow') || normalized.includes('sleet') || normalized.includes('ice')) return '❄️'
  if (normalized.includes('storm') || normalized.includes('thunder')) return '⛈️'
  if (normalized.includes('fog') || normalized.includes('mist') || normalized.includes('haze')) return '🌫️'
  if (normalized.includes('wind')) return '🌬️'
  return '🌤️'
}
