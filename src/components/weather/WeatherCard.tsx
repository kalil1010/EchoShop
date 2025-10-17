'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import {
  getCurrentLocation,
  getWeatherData,
  getWeatherForecast,
  getWeatherIcon,
  type WeatherData,
  type LocationData,
} from "@/lib/weather"
import { RefreshCw } from "lucide-react"

interface WeatherCardProps {
  onWeatherUpdate?: (weather: WeatherData) => void
}

const formatInputDate = (date: Date) => {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, "0")
  const day = String(date.getDate()).padStart(2, "0")
  return `${year}-${month}-${day}`
}

const parseInputDate = (value: string): Date | null => {
  if (!value) return null
  const [year, month, day] = value.split("-").map(Number)
  if (!year || !month || !day) return null
  const date = new Date(year, month - 1, day)
  date.setHours(0, 0, 0, 0)
  return date
}

const dayDifference = (target: Date) => {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const candidate = new Date(target)
  candidate.setHours(0, 0, 0, 0)
  const msInDay = 24 * 60 * 60 * 1000
  return Math.round((candidate.getTime() - today.getTime()) / msInDay)
}

const formatDateLabel = (date: Date) => {
  const diff = dayDifference(date)
  if (diff === 0) return "Today"
  if (diff === 1) return "Tomorrow"
  return date.toLocaleDateString(undefined, { weekday: "long", month: "short", day: "numeric" })
}

export function WeatherCard({ onWeatherUpdate }: WeatherCardProps) {
  const [weather, setWeather] = useState<WeatherData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [selectedDate, setSelectedDate] = useState<Date>(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return today
  })

  const locationRef = useRef<LocationData | null>(null)

  const minDateValue = useMemo(() => {
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    return formatInputDate(today)
  }, [])

  const maxDateValue = useMemo(() => {
    const max = new Date()
    max.setHours(0, 0, 0, 0)
    max.setDate(max.getDate() + 6)
    return formatInputDate(max)
  }, [])

  const fetchWeatherForDate = useCallback(
    async (targetDate: Date) => {
      setLoading(true)
      setError(null)

      try {
        if (!locationRef.current) {
          locationRef.current = await getCurrentLocation()
        }
        const location = locationRef.current
        const diff = dayDifference(targetDate)

        const weatherData =
          diff <= 0
            ? await getWeatherData(location)
            : await getWeatherForecast(targetDate, location)

        setWeather(weatherData)
        onWeatherUpdate?.(weatherData)
      } catch (err) {
        console.error("Failed to fetch weather:", err)
        setError("Unable to load weather data for the selected date.")
      } finally {
        setLoading(false)
      }
    },
    [onWeatherUpdate]
  )

  useEffect(() => {
    void fetchWeatherForDate(selectedDate)
  }, [selectedDate, fetchWeatherForDate])

  const handleRefresh = () => {
    void fetchWeatherForDate(selectedDate)
  }

  const handleDateChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const next = parseInputDate(event.target.value)
    if (next) {
      setSelectedDate(next)
    }
  }

  const selectedDateValue = formatInputDate(selectedDate)
  const selectedDateLabel = formatDateLabel(selectedDate)
  const isInitialLoading = loading && !weather

  if (isInitialLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="animate-pulse space-y-3">
            <div className="h-4 w-3/4 rounded bg-gray-200" />
            <div className="h-8 w-1/2 rounded bg-gray-200" />
            <div className="h-4 w-full rounded bg-gray-200" />
          </div>
        </CardContent>
      </Card>
    )
  }

  if (!weather) {
    return (
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="text-base font-semibold">Weather Forecast</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-col gap-2">
            <label htmlFor="forecast-date" className="text-xs font-medium text-slate-600">
              Date
            </label>
            <input
              id="forecast-date"
              type="date"
              value={selectedDateValue}
              min={minDateValue}
              max={maxDateValue}
              onChange={handleDateChange}
              className="h-9 w-full rounded border border-slate-200 px-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
          </div>
          <p className="text-sm text-slate-500">Unable to load weather data.</p>
          <Button variant="outline" size="sm" onClick={handleRefresh}>
            Try again
          </Button>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base font-semibold">Weather Forecast</CardTitle>
          <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={loading}>
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
          </Button>
        </div>
        <div className="mt-3 flex flex-col gap-1">
          <label htmlFor="forecast-date" className="text-xs font-medium text-slate-600">
            Select date (next 7 days)
          </label>
          <div className="flex items-center gap-2">
            <input
              id="forecast-date"
              type="date"
              value={selectedDateValue}
              min={minDateValue}
              max={maxDateValue}
              onChange={handleDateChange}
              className="h-9 rounded border border-slate-200 px-3 text-sm focus:border-purple-500 focus:outline-none focus:ring-2 focus:ring-purple-100"
            />
            <span className="text-xs text-slate-500">{selectedDateLabel}</span>
          </div>
        </div>
        {error && <p className="mt-2 text-xs text-amber-600">{error}</p>}
      </CardHeader>
      <CardContent>
        <div className="flex items-center gap-4">
          <div className="text-4xl" aria-hidden>
            {getWeatherIcon(weather.condition)}
          </div>
          <div>
            <div className="text-2xl font-semibold">
              {weather.temperature}\u00B0C
            </div>
            <div className="text-sm text-slate-600">{weather.condition}</div>
            <div className="text-xs text-slate-500">{weather.location}</div>
          </div>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-4 text-sm">
          <div>
            <span className="text-slate-500">Humidity:</span>
            <span className="ml-1 font-medium">{weather.humidity}%</span>
          </div>
          <div>
            <span className="text-slate-500">Wind:</span>
            <span className="ml-1 font-medium">{Math.round(weather.windSpeed)} m/s</span>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}