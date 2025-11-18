import type { AuthUser, UserProfile, UserRole } from '@/types/user'

const SESSION_CACHE_STORAGE_KEY = 'echoshop_session_cache'
const SESSION_CACHE_BACKUP_KEY = 'echoshop_session_cache_backup'
const SESSION_CACHE_VERSION = 1
const SESSION_CACHE_TTL = 10 * 60 * 1000 // 10 minutes - increased from 5 for better UX
const SESSION_CACHE_BACKUP_TTL = 30 * 60 * 1000 // 30 minutes for backup copy

export interface SessionCacheData {
  version: number
  user: AuthUser
  profile: UserProfile
  role: UserRole
  timestamp: number
}

const ensureDate = (value: unknown): Date => {
  if (value instanceof Date) return value
  if (typeof value === 'string') {
    const parsed = new Date(value)
    if (!Number.isNaN(parsed.getTime())) {
      return parsed
    }
  }
  return new Date()
}

const reviveProfile = (profile: UserProfile): UserProfile => ({
  ...profile,
  createdAt: ensureDate(profile.createdAt),
  updatedAt: ensureDate(profile.updatedAt),
})

const getStorage = (type: 'session' | 'local'): Storage | null => {
  if (typeof window === 'undefined') return null
  try {
    return type === 'session' ? window.sessionStorage : window.localStorage
  } catch {
    return null
  }
}

const parseCache = (raw: string | null, ttl: number): SessionCacheData | null => {
  if (!raw) return null
  try {
    const data = JSON.parse(raw) as SessionCacheData
    if (data.version !== SESSION_CACHE_VERSION) return null
    if (!data.timestamp || Date.now() - data.timestamp > ttl) return null
    if (!data.user?.uid || !data.profile?.uid) return null
    return {
      ...data,
      profile: reviveProfile(data.profile),
    }
  } catch {
    return null
  }
}

export const readSessionCache = (): SessionCacheData | null => {
  const sessionStorage = getStorage('session')
  const localStorage = getStorage('local')

  const sessionValue = sessionStorage?.getItem(SESSION_CACHE_STORAGE_KEY) ?? null
  const inMemory = parseCache(sessionValue, SESSION_CACHE_TTL)
  if (inMemory) {
    return inMemory
  }

  const backupValue = localStorage?.getItem(SESSION_CACHE_BACKUP_KEY) ?? null
  const backup = parseCache(backupValue, SESSION_CACHE_BACKUP_TTL)
  if (backup && sessionStorage) {
    try {
      sessionStorage.setItem(SESSION_CACHE_STORAGE_KEY, JSON.stringify(backup))
    } catch {
      // Ignore quota errors
    }
  }
  return backup
}

export const persistSessionCache = (user: AuthUser, profile: UserProfile): void => {
  const sessionStorage = getStorage('session')
  const localStorage = getStorage('local')
  if (!sessionStorage && !localStorage) return

  const payload: SessionCacheData = {
    version: SESSION_CACHE_VERSION,
    user,
    profile,
    role: profile.role,
    timestamp: Date.now(),
  }

  const payloadString = JSON.stringify(payload)

  if (sessionStorage) {
    try {
      sessionStorage.setItem(SESSION_CACHE_STORAGE_KEY, payloadString)
    } catch {
      // Ignore quota errors
    }
  }

  if (localStorage) {
    try {
      localStorage.setItem(SESSION_CACHE_BACKUP_KEY, payloadString)
    } catch {
      // Ignore quota errors
    }
  }
}

export const clearSessionCache = (): void => {
  const sessionStorage = getStorage('session')
  const localStorage = getStorage('local')
  try {
    sessionStorage?.removeItem(SESSION_CACHE_STORAGE_KEY)
  } catch {
    // ignore
  }
  try {
    localStorage?.removeItem(SESSION_CACHE_BACKUP_KEY)
  } catch {
    // ignore
  }
}

export const recoverSessionCacheSnapshot = (): SessionCacheData | null => {
  const sessionStorage = getStorage('session')
  const localStorage = getStorage('local')
  if (!sessionStorage || sessionStorage.getItem(SESSION_CACHE_STORAGE_KEY)) {
    return null
  }
  const backupValue = localStorage?.getItem(SESSION_CACHE_BACKUP_KEY) ?? null
  const backup = parseCache(backupValue, SESSION_CACHE_BACKUP_TTL)
  if (!backup) return null
  try {
    sessionStorage.setItem(SESSION_CACHE_STORAGE_KEY, JSON.stringify(backup))
  } catch {
    // ignore
  }
  return backup
}

