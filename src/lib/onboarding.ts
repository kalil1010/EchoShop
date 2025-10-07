interface TourStateResponse {
  status: 'not_started' | 'in_progress' | 'completed'
  slug: string
  updated_at?: string
  metadata?: Record<string, unknown> | null
}

export async function getTourState(slug: string): Promise<TourStateResponse> {
  const res = await fetch(`/api/user-tour?slug=${encodeURIComponent(slug)}`, {
    method: 'GET',
    credentials: 'include',
  })
  if (!res.ok) {
    throw new Error(`Failed to fetch tour state (${res.status})`)
  }
  return res.json()
}

export async function updateTourState(
  slug: string,
  status: 'not_started' | 'in_progress' | 'completed',
  metadata?: Record<string, unknown>
): Promise<void> {
  try {
    const res = await fetch('/api/user-tour', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ slug, status, metadata }),
    })
    if (!res.ok) {
      const body = await res.json().catch(() => ({}))
      throw new Error(body?.error || `Failed to update tour state (${res.status})`)
    }
  } catch (error) {
    throw error
  }
}
