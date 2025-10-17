import { NextRequest, NextResponse } from "next/server"

const LOCATION_CACHE_TTL = 1000 * 60 * 60 * 24 // 24 hours

interface LocationCacheEntry {
  key: string
  city: string
  region: string
  country: string
  expires: number
}

type LocationCache = Map<string, LocationCacheEntry>

const getLocationCache = (): LocationCache => {
  const globalRef = globalThis as unknown as {
    __accuWeatherLocationCache?: LocationCache
  }

  if (!globalRef.__accuWeatherLocationCache) {
    globalRef.__accuWeatherLocationCache = new Map()
  }

  return globalRef.__accuWeatherLocationCache
}

const dayDifference = (base: Date, target: Date) => {
  const msInDay = 24 * 60 * 60 * 1000
  const startBase = new Date(base)
  startBase.setHours(0, 0, 0, 0)
  const startTarget = new Date(target)
  startTarget.setHours(0, 0, 0, 0)
  return Math.round((startTarget.getTime() - startBase.getTime()) / msInDay)
}

const buildUrl = (path: string, params: URLSearchParams, apiKey: string) => {
  params.set("apikey", apiKey)
  const url = new URL(`https://dataservice.accuweather.com/${path}`)
  url.search = params.toString()
  return url.toString()
}

const requestAccuWeather = async (path: string, params: URLSearchParams, apiKey: string) => {
  const response = await fetch(buildUrl(path, params, apiKey), {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    next: { revalidate: 0 },
  })

  if (!response.ok) {
    const errorBody = await response.json().catch(() => null)
    throw new Error(`AccuWeather request failed (${response.status}): ${JSON.stringify(errorBody)}`)
  }

  return response.json()
}

const resolveLocationKey = async (
  latitude: number,
  longitude: number,
  apiKey: string,
): Promise<LocationCacheEntry> => {
  const cache = getLocationCache()
  const cacheKey = `${latitude.toFixed(2)},${longitude.toFixed(2)}`
  const cached = cache.get(cacheKey)
  const now = Date.now()

  if (cached && cached.expires > now) {
    return cached
  }

  const params = new URLSearchParams({
    q: `${latitude},${longitude}`,
    language: "en-us",
  })

  const data = await requestAccuWeather("locations/v1/cities/geoposition/search", params, apiKey)

  if (!data?.Key) {
    throw new Error("Unable to resolve AccuWeather location key")
  }

  const entry: LocationCacheEntry = {
    key: data.Key,
    city: data.LocalizedName ?? "Unknown city",
    region: data?.AdministrativeArea?.LocalizedName ?? "",
    country: data?.Country?.LocalizedName ?? "",
    expires: now + LOCATION_CACHE_TTL,
  }

  cache.set(cacheKey, entry)
  return entry
}

const mapCurrentConditions = (payload: any, location: LocationCacheEntry) => {
  if (!Array.isArray(payload) || !payload.length) {
    throw new Error("AccuWeather current conditions payload invalid")
  }

  const item = payload[0]

  const windKmh = item?.Wind?.Speed?.Metric?.Value ?? 5

  return {
    temperature: Math.round(item?.Temperature?.Metric?.Value ?? 20),
    condition: item?.WeatherText ?? "Clear",
    humidity: item?.RelativeHumidity ?? 50,
    windSpeed: Math.round(windKmh / 3.6),
    location: location.region
      ? `${location.city}, ${location.region}`
      : `${location.city}${location.country ? `, ${location.country}` : ""}`,
    timestamp: new Date().toISOString(),
  }
}

const mapDailyForecast = (payload: any, index: number, location: LocationCacheEntry) => {
  const forecasts = Array.isArray(payload?.DailyForecasts) ? payload.DailyForecasts : []
  const forecast = forecasts[index]

  if (!forecast) {
    throw new Error("AccuWeather daily forecast payload invalid")
  }

  const max = forecast?.Temperature?.Maximum?.Value
  const min = forecast?.Temperature?.Minimum?.Value
  const averaged =
    typeof max === "number" && typeof min === "number"
      ? Math.round((max + min) / 2)
      : Math.round(typeof max === "number" ? max : min ?? 20)

  const humidity =
    typeof forecast?.Day?.RelativeHumidity === "number"
      ? forecast.Day.RelativeHumidity
      : typeof forecast?.Night?.RelativeHumidity === "number"
        ? forecast.Night.RelativeHumidity
        : 50

  const windKmh =
    typeof forecast?.Day?.Wind?.Speed?.Value === "number"
      ? forecast.Day.Wind.Speed.Value
      : typeof forecast?.Night?.Wind?.Speed?.Value === "number"
        ? forecast.Night.Wind.Speed.Value
        : 10

  const windSpeed = Math.round(windKmh / 3.6)
  const phrase = forecast?.Day?.IconPhrase || forecast?.Night?.IconPhrase || "Clear"
  const forecastDate = forecast?.Date ? new Date(forecast.Date) : new Date()

  return {
    temperature: averaged,
    condition: phrase,
    humidity,
    windSpeed,
    location: location.region
      ? `${location.city}, ${location.region}`
      : `${location.city}${location.country ? `, ${location.country}` : ""}`,
    timestamp: forecastDate.toISOString(),
  }
}

export async function GET(request: NextRequest) {
  try {
    const url = new URL(request.url)
    const searchParams = url.searchParams

    const latParam = searchParams.get("lat")
    const lonParam = searchParams.get("lon")
    const dateParam = searchParams.get("date")

    if (!latParam || !lonParam) {
      return NextResponse.json({ error: 'Missing "lat" or "lon" parameter' }, { status: 400 })
    }

    const latitude = Number(latParam)
    const longitude = Number(lonParam)

    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) {
      return NextResponse.json({ error: 'Invalid coordinates provided' }, { status: 400 })
    }

    const apiKey = process.env.ACCUWEATHER_API_KEY
    if (!apiKey) {
      return NextResponse.json({ error: 'AccuWeather API key not configured' }, { status: 500 })
    }

    const targetDate = dateParam ? new Date(dateParam) : new Date()
    if (Number.isNaN(targetDate.getTime())) {
      return NextResponse.json({ error: 'Invalid date parameter' }, { status: 400 })
    }

    const diff = dayDifference(new Date(), targetDate)
    if (diff < 0 || diff > 3) {
      return NextResponse.json({ error: 'Date must be today or within the next 3 days' }, { status: 400 })
    }

    const location = await resolveLocationKey(latitude, longitude, apiKey)

    if (diff === 0) {
      const params = new URLSearchParams({ language: 'en-us', details: 'true' })
      const payload = await requestAccuWeather(`currentconditions/v1/${location.key}`, params, apiKey)
      return NextResponse.json(mapCurrentConditions(payload, location))
    }

    const params = new URLSearchParams({ language: 'en-us', metric: 'true', details: 'true' })
    const payload = await requestAccuWeather(`forecasts/v1/daily/5day/${location.key}`, params, apiKey)
    return NextResponse.json(mapDailyForecast(payload, diff, location))
  } catch (error) {
    console.error('[api/weather] failed', error)
    return NextResponse.json({ error: 'Failed to fetch weather data' }, { status: 500 })
  }
}
