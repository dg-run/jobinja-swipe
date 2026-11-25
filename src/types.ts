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
}

export type JobsPayload = {
  source: string
  fetchedAt: string
  total: number
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
