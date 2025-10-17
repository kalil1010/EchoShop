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
      `https://api.openweathermap.org/data/2.5/weather?lat=${loc.latitude}&lon=${loc.longitude}&appid=${process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY}&units=metric`
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
    Clear: 'Sunny',
    Clouds: 'Cloudy',
    Rain: 'Rain',
    Drizzle: 'Drizzle',
    Thunderstorm: 'Storm',
    Snow: 'Snow',
    Mist: 'Mist',
    Fog: 'Fog',
  }

  return iconMap[condition] || 'Fair'
}

const formatInputDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
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

const mapWeatherCode = (code: number): string => {
  const codeMap: Record<number, string> = {
    0: 'Clear',
    1: 'Mainly Clear',
    2: 'Partly Cloudy',
    3: 'Overcast',
    45: 'Fog',
    48: 'Fog',
    51: 'Light Drizzle',
    53: 'Drizzle',
    55: 'Drizzle',
    56: 'Freezing Drizzle',
    57: 'Freezing Drizzle',
    61: 'Light Rain',
    63: 'Rain',
    65: 'Heavy Rain',
    66: 'Freezing Rain',
    67: 'Freezing Rain',
    71: 'Snow',
    73: 'Snow',
    75: 'Heavy Snow',
    77: 'Snow',
    80: 'Rain Showers',
    81: 'Rain Showers',
    82: 'Rain Showers',
    85: 'Snow Showers',
    86: 'Snow Showers',
    95: 'Thunderstorm',
    96: 'Thunderstorm',
    99: 'Thunderstorm',
  }

  return codeMap[code] || 'Clear'
}

const buildWeatherFromOpenMeteo = (daily: any, index: number, loc: LocationData): WeatherData => {
  const maxTemp = Array.isArray(daily.temperature_2m_max) ? daily.temperature_2m_max[index] : null
  const minTemp = Array.isArray(daily.temperature_2m_min) ? daily.temperature_2m_min[index] : null
  const averagedTemp =
    typeof maxTemp === 'number' && typeof minTemp === 'number'
      ? Math.round((maxTemp + minTemp) / 2)
      : Math.round(typeof maxTemp === 'number' ? maxTemp : minTemp ?? 20)

  const humidity = Array.isArray(daily.relative_humidity_2m_mean)
    ? Math.round(daily.relative_humidity_2m_mean[index])
    : 50

  const windKmh = Array.isArray(daily.windspeed_10m_max) ? daily.windspeed_10m_max[index] : 10
  const windSpeed = typeof windKmh === 'number' ? Math.round(windKmh / 3.6) : 5

  const weatherCode = Array.isArray(daily.weathercode) ? daily.weathercode[index] : null
  const condition = typeof weatherCode === 'number' ? mapWeatherCode(weatherCode) : 'Clear'

  const timeValue = Array.isArray(daily.time) ? daily.time[index] : null
  const timestamp = timeValue ? new Date(timeValue) : new Date()

  return {
    temperature: averagedTemp,
    condition,
    humidity,
    windSpeed,
    location: `${loc.city}, ${loc.region}`,
    timestamp,
  }
}

const fetchOpenWeatherForecast = async (
  loc: LocationData,
  diff: number,
): Promise<WeatherData | null> => {
  const response = await fetch(
    `https://api.openweathermap.org/data/2.5/onecall?lat=${loc.latitude}&lon=${loc.longitude}&exclude=current,minutely,hourly,alerts&appid=${process.env.NEXT_PUBLIC_OPENWEATHERMAP_API_KEY}&units=metric`,
  )

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(`OpenWeather forecast failed: ${response.status} ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  const daily = Array.isArray(data.daily) ? data.daily : []

  if (!daily.length) {
    return null
  }

  const index = Math.min(diff, daily.length - 1)
  const forecast = daily[index]

  if (!forecast) {
    return null
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
}

const fetchOpenMeteoForecast = async (
  targetDate: Date,
  loc: LocationData,
): Promise<WeatherData | null> => {
  const params = new URLSearchParams({
    latitude: String(loc.latitude),
    longitude: String(loc.longitude),
    daily: 'temperature_2m_max,temperature_2m_min,weathercode,relative_humidity_2m_mean,windspeed_10m_max',
    timezone: 'auto',
  })

  const response = await fetch(`https://api.open-meteo.com/v1/forecast?${params.toString()}`)

  if (!response.ok) {
    const error = await response.json().catch(() => null)
    throw new Error(`Open-Meteo forecast failed: ${response.status} ${JSON.stringify(error)}`)
  }

  const data = await response.json()
  const daily = data.daily || {}
  const time = Array.isArray(daily.time) ? daily.time : []
  const targetKey = formatInputDate(targetDate)
  const index = time.findIndex((value: string) => value === targetKey)

  if (index === -1) {
    return null
  }

  return buildWeatherFromOpenMeteo(daily, index, loc)
}

export async function getWeatherForecast(targetDate: Date, location?: LocationData): Promise<WeatherData> {
  try {
    const loc = location || await getCurrentLocation()
    const diff = dayDifference(new Date(), targetDate)

    if (diff <= 0) {
      return getWeatherData(loc)
    }

    try {
      const openWeather = await fetchOpenWeatherForecast(loc, diff)
      if (openWeather) {
        return openWeather
      }
    } catch (error) {
      console.warn('[weather] OpenWeather forecast fallback:', error)
    }

    try {
      const openMeteo = await fetchOpenMeteoForecast(targetDate, loc)
      if (openMeteo) {
        return openMeteo
      }
    } catch (error) {
      console.warn('[weather] Open-Meteo forecast fallback failed:', error)
    }

    return getWeatherData(loc)
  } catch (error) {
    console.error('Failed to get forecast weather data:', error)
    return getWeatherData(location)
  }
}
