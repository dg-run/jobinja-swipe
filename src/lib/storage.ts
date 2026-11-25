import type { Decision } from '../types'

const DECISIONS_KEY = 'jobinja-swipe:decisions:v1'

export function loadDecisions(): Decision[] {
  try {
    const raw = localStorage.getItem(DECISIONS_KEY)
    if (!raw) return []
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return []
    return parsed.filter((item): item is Decision => {
      if (!item || typeof item !== 'object') return false
      const record = item as Record<string, unknown>
      return (
        typeof record.id === 'string' &&
        (record.action === 'skip' || record.action === 'apply') &&
        typeof record.at === 'string'
      )
    })
  } catch {
    return []
  }
}

export function saveDecisions(decisions: Decision[]): void {
  try {
    localStorage.setItem(DECISIONS_KEY, JSON.stringify(decisions))
  } catch {
    // Storage can be unavailable in private mode; the app still works for this session.
  }
}
