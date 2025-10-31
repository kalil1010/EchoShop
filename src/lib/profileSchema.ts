const DEFAULT_OPTIONAL_COLUMNS = [
  'vendor_business_name',
  'vendor_business_address',
  'vendor_contact_email',
  'vendor_phone',
  'vendor_website',
] as const

const envOptionalColumns =
  (typeof process !== 'undefined' &&
    (process.env.NEXT_PUBLIC_PROFILE_OPTIONAL_COLUMNS ?? process.env.PROFILE_OPTIONAL_COLUMNS)) ||
  ''

const configuredOptionalColumns = envOptionalColumns
  .split(',')
  .map((value) => value.trim())
  .filter((value) => value.length > 0)

const OPTIONAL_PROFILE_COLUMNS = new Set<string>(
  configuredOptionalColumns.length > 0 ? configuredOptionalColumns : DEFAULT_OPTIONAL_COLUMNS,
)

const DISABLED_OPTIONAL_COLUMNS = new Set<string>()

const MISSING_COLUMN_REGEX = /column\s+["']?([a-z0-9_.]+)["']?\s+does not exist/i

export type ProfileMutationPayload = Record<string, unknown>

export function filterProfilePayload<T extends ProfileMutationPayload>(row: T): Partial<T> {
  const payload: Partial<T> = {}
  for (const [key, value] of Object.entries(row)) {
    if (value === undefined) continue
    if (OPTIONAL_PROFILE_COLUMNS.has(key) && DISABLED_OPTIONAL_COLUMNS.has(key)) continue
    payload[key as keyof T] = value as T[keyof T]
  }
  return payload
}

export function extractMissingProfileColumn(error: unknown): string | null {
  if (!error || typeof error !== 'object') return null
  const messages = new Set<string>()

  if ('message' in error && typeof (error as { message?: unknown }).message === 'string') {
    messages.add((error as { message: string }).message)
  }
  if ('details' in error && typeof (error as { details?: unknown }).details === 'string') {
    messages.add((error as { details: string }).details)
  }
  if ('hint' in error && typeof (error as { hint?: unknown }).hint === 'string') {
    messages.add((error as { hint: string }).hint)
  }

  for (const message of messages) {
    const match = message.match(MISSING_COLUMN_REGEX)
    if (match) {
      const column = match[1]
      if (column) {
        const parts = column.split('.')
        return parts[parts.length - 1] ?? column
      }
    }
  }

  return null
}

export function disableOptionalProfileColumn(column: string): boolean {
  if (!OPTIONAL_PROFILE_COLUMNS.has(column)) return false
  if (DISABLED_OPTIONAL_COLUMNS.has(column)) return false
  DISABLED_OPTIONAL_COLUMNS.add(column)
  return true
}

export function getActiveOptionalProfileColumns(): string[] {
  return [...OPTIONAL_PROFILE_COLUMNS].filter((column) => !DISABLED_OPTIONAL_COLUMNS.has(column))
}

export function isOptionalProfileColumn(column: string): boolean {
  return OPTIONAL_PROFILE_COLUMNS.has(column)
}
