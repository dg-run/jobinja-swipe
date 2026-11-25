export type JobSource = 'jobinja' | 'jobvision'

export type Job = {
  id: string
  title: string
  company: string
  location: string
  contract: string
  posted: string
  url: string
  logo: string
  category: string
  experience: string
  salary: string
  skills: string
  description: string
  source?: JobSource
}

export type JobsPayload = {
  source: string
  fetchedAt: string
  total: number
  counts?: Partial<Record<JobSource, number>>
  jobs: Job[]
}

export type DecisionAction = 'skip' | 'apply'

export type Decision = {
  id: string
  action: DecisionAction
  at: string
}

export type Toast = {
  id: number
  message: string
  href?: string
  linkLabel?: string
}
