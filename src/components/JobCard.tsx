import { useState } from 'react'
import type { CSSProperties, PointerEventHandler } from 'react'
import type { Job } from '../types'
import { companyInitials } from '../lib/jobinja'
import {
  BanknoteIcon,
  BriefcaseIcon,
  ExternalIcon,
  PinIcon,
} from './Icons'

type Props = {
  job: Job
  style?: CSSProperties
  className?: string
  dragX?: number
  hidden?: boolean
  onPointerDown?: PointerEventHandler<HTMLElement>
  onPointerMove?: PointerEventHandler<HTMLElement>
  onPointerUp?: PointerEventHandler<HTMLElement>
  onPointerCancel?: PointerEventHandler<HTMLElement>
}

export function JobCard({
  job,
  style,
  className = '',
  dragX = 0,
  hidden = false,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPointerCancel,
}: Props) {
  const [logoFailed, setLogoFailed] = useState(false)
  const stampOpacity = Math.min(1, Math.abs(dragX) / 90)

  return (
    <article
      className={`job-card ${className}`.trim()}
      style={style}
      aria-hidden={hidden || undefined}
      inert={hidden || undefined}
      onPointerDown={onPointerDown}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
      onPointerCancel={onPointerCancel}
    >
      <div className="job-card__stamp job-card__stamp--apply" style={{ opacity: dragX > 0 ? stampOpacity : 0 }}>
        ارسال رزومه
      </div>
      <div className="job-card__stamp job-card__stamp--skip" style={{ opacity: dragX < 0 ? stampOpacity : 0 }}>
        رد کردن
      </div>

      <header className="job-card__header">
        <div className="company">
          <div className="company__logo">
            {job.logo && !logoFailed ? (
              <img
                src={job.logo}
                alt=""
                loading="lazy"
                referrerPolicy="no-referrer"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <span>{companyInitials(job.company)}</span>
            )}
          </div>
          <div className="company__text">
            <span className="eyebrow">شرکت</span>
            <strong>{job.company}</strong>
          </div>
        </div>
        {job.posted ? <span className="posted-badge">{job.posted}</span> : null}
      </header>

      <h2 className="job-card__title">{job.title}</h2>

      <div className="meta-chips" aria-label="جزئیات آگهی">
        {job.location ? (
          <span className="meta-chip">
            <PinIcon />
            {job.location}
          </span>
        ) : null}
        {job.contract ? (
          <span className="meta-chip">
            <BriefcaseIcon />
            {job.contract}
          </span>
        ) : null}
        {job.salary ? (
          <span className="meta-chip meta-chip--salary">
            <BanknoteIcon />
            {job.salary}
          </span>
        ) : null}
      </div>

      <section className="job-card__description">
        <div className="section-label">
          <span>شرح موقعیت شغلی</span>
          {job.category ? <span className="section-label__meta">{job.category}</span> : null}
        </div>
        <p>{job.description}</p>
      </section>

      <footer className="job-card__footer">
        <span className="job-card__skills">{job.skills || job.experience || 'اطلاعات بیشتر در جابینجا'}</span>
        <a
          className="source-link"
          href={job.url}
          target="_blank"
          rel="noreferrer noopener"
          onClick={(event) => event.stopPropagation()}
        >
          جابینجا
          <ExternalIcon />
        </a>
      </footer>
    </article>
  )
}
