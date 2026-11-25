import type { Job } from '../types'

export const JOBINJA = 'https://jobinja.ir'
export const JOBINJA_JOBS = `${JOBINJA}/jobs`
export const JOBINJA_LOGIN = `${JOBINJA}/login/user`

export function applyUrl(job: Job): string {
  const redirect = encodeURIComponent(job.url)
  return `${JOBINJA_LOGIN}?redirect_url=${redirect}&return_url=${redirect}`
}

export function companyInitials(company: string): string {
  const parts = company
    .replace(/\|/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
  const latin = parts.find((part) => /[A-Za-z]/.test(part))
  if (latin) return latin.slice(0, 2).toUpperCase()
  return parts
    .slice(0, 2)
    .map((part) => part.slice(0, 1))
    .join('')
}

export function formatCount(value: number): string {
  return new Intl.NumberFormat('fa-IR').format(value)
}

export function formatDate(value: string): string {
  try {
    return new Intl.DateTimeFormat('fa-IR', {
      dateStyle: 'medium',
      timeStyle: 'short',
    }).format(new Date(value))
  } catch {
    return value
  }
}
