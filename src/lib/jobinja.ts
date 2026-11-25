import type { Job, JobSource } from '../types'

export const JOBINJA = 'https://jobinja.ir'
export const JOBINJA_JOBS = `${JOBINJA}/jobs`
export const JOBVISION = 'https://jobvision.ir'
export const JOBVISION_JOBS = `${JOBVISION}/jobs`

export function jobSource(job: Job): JobSource {
  return job.source === 'jobvision' ? 'jobvision' : 'jobinja'
}

export function sourceLabel(source: JobSource): string {
  return source === 'jobvision' ? 'جاب‌ویژن' : 'جابینجا'
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
