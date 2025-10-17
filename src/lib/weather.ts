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

export async function getWeatherData(location?: LocationData): Promise<WeatherData> {
  try {
    const loc = location || await getCurrentLocation()

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/weather?lat=${loc.latitude}&lon=${loc.longitude}&appid=${process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY}&units=metric`,
    )

    const data = await response.json()

    return {
      temperature: Math.round(data.main.temp),
      condition: data.weather[0].main,
      humidity: data.main.humidity,
      windSpeed: data.wind.speed,
      location: `${loc.city}, ${loc.region}`,
      timestamp: new Date(),
    }
  } catch (error) {
    console.error('Failed to get weather data:', error)
    return {
      temperature: 22,
      condition: 'Clear',
      humidity: 50,
      windSpeed: 5,
      location: 'Unknown Location',
      timestamp: new Date(),
    }
  }
}

export function getWeatherIcon(condition: string): string {
  const iconMap: Record<string, string> = {
    Clear: '☀️',
    Clouds: '☁️',
    Rain: '🌧️',
    Drizzle: '🌦️',
    Thunderstorm: '⛈️',
    Snow: '❄️',
    Mist: '🌫️',
    Fog: '🌫️',
  }

  return iconMap[condition] || '🌤️'
}

const startOfDay = (date: Date) => {
  const copy = new Date(date)
  copy.setHours(0, 0, 0, 0)
  return copy
}

const dayDifference = (base: Date, target: Date) => {
  const msInDay = 24 * 60 * 60 * 1000
  return Math.round((startOfDay(target).getTime() - startOfDay(base).getTime()) / msInDay)
}

export async function getWeatherForecast(targetDate: Date, location?: LocationData): Promise<WeatherData> {
  try {
    const loc = location || await getCurrentLocation()
    const diff = dayDifference(new Date(), targetDate)

    if (diff <= 0) {
      return getWeatherData(loc)
    }

    const response = await fetch(
      `https://api.openweathermap.org/data/2.5/onecall?lat=${loc.latitude}&lon=${loc.longitude}&exclude=current,minutely,hourly,alerts&appid=${process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY}&units=metric`,
    )

    const data = await response.json()
    const daily = Array.isArray(data.daily) ? data.daily : []

    if (!daily.length) {
      return getWeatherData(loc)
    }

    const index = Math.min(diff, daily.length - 1)
    const forecast = daily[index]

    if (!forecast) {
      return getWeatherData(loc)
    }

    return {
      temperature: Math.round(forecast.temp.day),
      condition:
        Array.isArray(forecast.weather) && forecast.weather.length > 0 ? forecast.weather[0].main : 'Clear',
      humidity: forecast.humidity,
      windSpeed: forecast.wind_speed,
      location: `${loc.city}, ${loc.region}`,
      timestamp: new Date((forecast.dt ?? Date.now() / 1000) * 1000),
    }
  } catch (error) {
    console.error('Failed to get forecast weather data:', error)
    return getWeatherData(location)
  }
}
