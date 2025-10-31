export type UserTourStateStatus = 'not_started' | 'in_progress' | 'completed'

export interface UserTourStateRow {
  id?: string
  user_id: string
  tour_slug: string
  status: UserTourStateStatus
  metadata: Record<string, unknown> | null
  created_at: string
  updated_at: string
}
