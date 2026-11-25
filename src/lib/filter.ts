import type { Job } from '../types'
import { jobSource, sourceLabel } from './jobinja'

export function normalizeSearch(value: string): string {
  return value
    .toLowerCase()
    .replace(/[يى]/g, 'ی')
    .replace(/ك/g, 'ک')
    .replace(/[أإآ]/g, 'ا')
    .replace(/[\u064b-\u0652\u0640]/g, '')
    .replace(/\u200c/g, ' ')
    .replace(/[^\p{L}\p{N}\s]/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function jobText(job: Job): string {
  return normalizeSearch(
    [
      job.title,
      job.company,
      job.location,
      job.contract,
      job.category,
      job.experience,
      job.salary,
      job.skills,
      job.description,
      sourceLabel(jobSource(job)),
    ].join(' '),
  )
}

export function matchesKeyword(job: Job, query: string): boolean {
  const terms = normalizeSearch(query).split(' ').filter(Boolean)
  if (terms.length === 0) return true
  const text = jobText(job)
  return terms.every((term) => text.includes(term))
}
