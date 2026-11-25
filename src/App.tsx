import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type {
  CSSProperties,
  MouseEvent as ReactMouseEvent,
  PointerEvent as ReactPointerEvent,
} from 'react'
import { JobCard } from './components/JobCard'
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  CheckIcon,
  DownloadIcon,
  InfoIcon,
  LoginIcon,
  RotateIcon,
  SparkIcon,
  UndoIcon,
  XIcon,
} from './components/Icons'
import {
  JOBINJA_JOBS,
  JOBINJA_LOGIN,
  applyUrl,
  formatCount,
  formatDate,
} from './lib/jobinja'
import { loadDecisions, saveDecisions } from './lib/storage'
import type { Decision, DecisionAction, Job, JobsPayload, Toast } from './types'

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const SWIPE_THRESHOLD = 86

export default function App() {
  const [payload, setPayload] = useState<JobsPayload | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [decisions, setDecisions] = useState<Decision[]>(() => loadDecisions())
  const [drag, setDrag] = useState({ x: 0, y: 0 })
  const [dragging, setDragging] = useState(false)
  const [exit, setExit] = useState<'left' | 'right' | null>(null)
  const [toast, setToast] = useState<Toast | null>(null)
  const [infoOpen, setInfoOpen] = useState(false)
  const [installEvent, setInstallEvent] = useState<BeforeInstallPromptEvent | null>(null)

  const pointer = useRef<{
    id: number
    startX: number
    startY: number
    horizontal: boolean
  } | null>(null)
  const dragX = useRef(0)
  const suppressClick = useRef(false)
  const advanceTimer = useRef<number | undefined>(undefined)
  const toastTimer = useRef<number | undefined>(undefined)
  const suppressTimer = useRef<number | undefined>(undefined)

  const loadJobs = useCallback(async () => {
    setLoading(true)
    setLoadError(null)
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}data/jobs.json`, {
        cache: 'no-cache',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status}`)
      const data = (await response.json()) as JobsPayload
      if (!Array.isArray(data.jobs) || data.jobs.length === 0) {
        throw new Error('لیست آگهی‌ها خالی است.')
      }
      setPayload(data)
    } catch (error) {
      setLoadError(error instanceof Error ? error.message : 'خطای نامشخص')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void loadJobs()
  }, [loadJobs])

  useEffect(() => {
    saveDecisions(decisions)
  }, [decisions])

  useEffect(() => {
    if (!payload) return
    const validIds = new Set(payload.jobs.map((job) => job.id))
    setDecisions((previous) => {
      const next = previous.filter((decision) => validIds.has(decision.id))
      return next.length === previous.length ? previous : next
    })
  }, [payload])

  const decidedIds = useMemo(() => new Set(decisions.map((decision) => decision.id)), [decisions])
  const activeJobs = useMemo(
    () => (payload ? payload.jobs.filter((job) => !decidedIds.has(job.id)) : []),
    [payload, decidedIds],
  )
  const current: Job | undefined = activeJobs[0]
  const next: Job | undefined = activeJobs[1]
  const total = payload?.jobs.length ?? 0
  const remaining = activeJobs.length
  const appliedCount = decisions.filter((decision) => decision.action === 'apply').length
  const skippedCount = decisions.length - appliedCount
  const progress = total === 0 ? 0 : Math.round((decisions.length / total) * 100)

  const showToast = useCallback((message: string, href?: string, linkLabel?: string) => {
    window.clearTimeout(toastTimer.current)
    const id = Date.now()
    setToast({ id, message, href, linkLabel })
    toastTimer.current = window.setTimeout(() => setToast(null), href ? 7000 : 3800)
  }, [])

  useEffect(() => {
    return () => {
      window.clearTimeout(advanceTimer.current)
      window.clearTimeout(toastTimer.current)
      window.clearTimeout(suppressTimer.current)
    }
  }, [])

  useEffect(() => {
    setDrag({ x: 0, y: 0 })
    dragX.current = 0
    setDragging(false)
    setExit(null)
  }, [current?.id])

  const openJobinja = useCallback(
    (job: Job) => {
      const opened = window.open(applyUrl(job), '_blank')
      if (opened) {
        opened.opener = null
        showToast('جابینجا در تب جدید باز شد. بعد از ورود، رزومه را ارسال کن.')
      } else {
        showToast(
          'مرورگر تب جدید را باز نکرد. از دکمه ارسال رزومه استفاده کن.',
          applyUrl(job),
          'باز کردن جابینجا',
        )
      }
    },
    [showToast],
  )

  const commit = useCallback(
    (action: DecisionAction) => {
      if (!current || exit) return
      const job = current

      if (action === 'apply') openJobinja(job)

      setExit(action === 'apply' ? 'right' : 'left')
      window.clearTimeout(advanceTimer.current)
      advanceTimer.current = window.setTimeout(() => {
        setDecisions((previous) => [
          ...previous,
          { id: job.id, action, at: new Date().toISOString() },
        ])
        setExit(null)
      }, 235)
    },
    [current, exit, openJobinja],
  )

  const undo = useCallback(() => {
    if (decisions.length === 0 || exit) return
    setDecisions((previous) => previous.slice(0, -1))
    setDrag({ x: 0, y: 0 })
    dragX.current = 0
    showToast('آخرین تصمیم برگشت.')
  }, [decisions.length, exit, showToast])

  const reset = useCallback(() => {
    setDecisions([])
    setExit(null)
    setDrag({ x: 0, y: 0 })
    dragX.current = 0
    showToast('همه آگهی‌ها دوباره نمایش داده می‌شوند.')
  }, [showToast])

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      if (target && (target.matches('input, textarea, select') || target.isContentEditable)) return

      if (infoOpen) {
        if (event.key === 'Escape') setInfoOpen(false)
        return
      }

      if (event.key === 'ArrowRight') {
        event.preventDefault()
        commit('apply')
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault()
        commit('skip')
      } else if (event.key.toLowerCase() === 'z') {
        event.preventDefault()
        undo()
      }
    }

    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [commit, infoOpen, undo])

  useEffect(() => {
    const handler = (event: Event) => {
      event.preventDefault()
      setInstallEvent(event as BeforeInstallPromptEvent)
    }
    const installed = () => setInstallEvent(null)
    window.addEventListener('beforeinstallprompt', handler)
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
    }
  }, [])

  const install = async () => {
    if (!installEvent) return
    await installEvent.prompt()
    const choice = await installEvent.userChoice
    if (choice.outcome === 'accepted') setInstallEvent(null)
  }

  const onPointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (!current || exit) return
    if (event.pointerType === 'mouse' && event.button !== 0) return
    pointer.current = {
      id: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      horizontal: false,
    }
    dragX.current = 0
    suppressClick.current = false
    event.currentTarget.setPointerCapture(event.pointerId)
    setDragging(true)
  }

  const onPointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    const state = pointer.current
    if (!state || state.id !== event.pointerId || exit) return

    const dx = event.clientX - state.startX
    const dy = event.clientY - state.startY

    if (!state.horizontal) {
      if (Math.abs(dx) < 6 && Math.abs(dy) < 6) return
      state.horizontal = Math.abs(dx) > Math.abs(dy)
      if (!state.horizontal) return
    }

    if (Math.abs(dx) > 8) suppressClick.current = true
    if (event.cancelable) event.preventDefault()
    dragX.current = dx
    setDrag({ x: dx, y: 0 })
  }

  const endPointer = (event: ReactPointerEvent<HTMLElement>, cancelled = false) => {
    const state = pointer.current
    if (!state || state.id !== event.pointerId) return
    pointer.current = null
    setDragging(false)
    try {
      if (event.currentTarget.hasPointerCapture(event.pointerId)) {
        event.currentTarget.releasePointerCapture(event.pointerId)
      }
    } catch {
      // Pointer capture can already be gone after a browser gesture.
    }

    window.clearTimeout(suppressTimer.current)
    suppressTimer.current = window.setTimeout(() => {
      suppressClick.current = false
    }, 320)

    if (cancelled) {
      dragX.current = 0
      setDrag({ x: 0, y: 0 })
      return
    }

    const dx = dragX.current
    if (dx > SWIPE_THRESHOLD) {
      commit('apply')
    } else if (dx < -SWIPE_THRESHOLD) {
      commit('skip')
    } else {
      dragX.current = 0
      setDrag({ x: 0, y: 0 })
    }
  }

  const onClickCapture = (event: ReactMouseEvent<HTMLElement>) => {
    if (!suppressClick.current) return
    event.preventDefault()
    event.stopPropagation()
  }

  const stackProgress = exit ? 1 : Math.min(1, Math.abs(drag.x) / 320)
  const currentStyle: CSSProperties = exit
    ? {
        transform: `translate3d(${exit === 'right' ? 118 : -118}%, 0, 0) rotate(${
          exit === 'right' ? 16 : -16
        }deg)`,
        opacity: 0,
        transition: 'transform 235ms cubic-bezier(.2,.8,.2,1), opacity 235ms ease',
      }
    : {
        transform: `translate3d(${drag.x}px, 0, 0) rotate(${drag.x / 24}deg)`,
        transition: dragging ? 'none' : 'transform 220ms cubic-bezier(.2,.8,.2,1)',
      }

  const nextStyle: CSSProperties = {
    transform: `translate3d(0, ${10 - stackProgress * 10}px, 0) scale(${
      0.958 + stackProgress * 0.042
    })`,
    opacity: 0.68 + stackProgress * 0.32,
    transition: 'transform 220ms ease, opacity 220ms ease',
  }

  return (
    <div className="app">
      <div className="ambient ambient--one" aria-hidden="true" />
      <div className="ambient ambient--two" aria-hidden="true" />

      <header className="app-header">
        <div className="brand">
          <span className="brand__mark" aria-hidden="true">
            <span />
            <span />
          </span>
          <div>
            <h1>جابینجا سوایپ</h1>
            <p>آگهی‌های تازه، یکی‌یکی</p>
          </div>
        </div>

        <div className="header-actions">
          {installEvent ? (
            <button className="icon-button" type="button" onClick={() => void install()} title="نصب اپ">
              <DownloadIcon />
            </button>
          ) : null}
          <button
            className="icon-button"
            type="button"
            onClick={() => setInfoOpen(true)}
            title="درباره این اپ"
          >
            <InfoIcon />
          </button>
        </div>
      </header>

      <div className="progress" aria-label="پیشرفت">
        <div className="progress__meta">
          <span>
            {formatCount(decisions.length)} از {formatCount(total)} آگهی
          </span>
          <span>{formatCount(remaining)} باقی‌مانده</span>
        </div>
        <div className="progress__track">
          <span style={{ width: `${progress}%` }} />
        </div>
      </div>

      <main className="stage-wrap">
        {loading ? (
          <div className="state-card">
            <div className="loader" aria-hidden="true" />
            <h2>در حال آوردن آگهی‌ها…</h2>
            <p>کمی صبر کن، آگهی‌های تازه در راه‌اند.</p>
          </div>
        ) : loadError ? (
          <div className="state-card">
            <div className="state-card__icon state-card__icon--warn">!</div>
            <h2>آگهی‌ها بارگذاری نشد</h2>
            <p>اتصال را بررسی کن یا مستقیم در جابینجا سر بزن.</p>
            <div className="state-card__actions">
              <button className="primary-button" type="button" onClick={() => void loadJobs()}>
                تلاش دوباره
              </button>
              <a className="secondary-button" href={JOBINJA_JOBS} target="_blank" rel="noreferrer">
                جابینجا
              </a>
            </div>
          </div>
        ) : current ? (
          <div className="stage" onClickCapture={onClickCapture}>
            {next ? (
              <JobCard
                job={next}
                hidden
                className="job-card--next"
                style={nextStyle}
              />
            ) : null}
            <JobCard
              job={current}
              className={`${dragging ? 'job-card--dragging' : ''} ${
                exit ? `job-card--exit-${exit}` : ''
              }`.trim()}
              style={currentStyle}
              dragX={drag.x}
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={(event) => endPointer(event)}
              onPointerCancel={(event) => endPointer(event, true)}
            />
          </div>
        ) : (
          <div className="state-card state-card--done">
            <div className="state-card__icon">
              <CheckIcon />
            </div>
            <h2>همه آگهی‌ها را دیدی</h2>
            <p>
              {formatCount(appliedCount)} ارسال و {formatCount(skippedCount)} رد. اگر آگهی‌های
              تازه می‌خواهی، جابینجا را باز کن.
            </p>
            <div className="state-card__stats">
              <span>
                <strong>{formatCount(appliedCount)}</strong>
                ارسال
              </span>
              <span>
                <strong>{formatCount(skippedCount)}</strong>
                رد
              </span>
            </div>
            <div className="state-card__actions">
              <button className="primary-button" type="button" onClick={reset}>
                <RotateIcon />
                شروع دوباره
              </button>
              <a className="secondary-button" href={JOBINJA_JOBS} target="_blank" rel="noreferrer">
                آگهی‌های جدید
              </a>
            </div>
          </div>
        )}
      </main>

      <footer className="app-footer">
        <div className="swipe-actions">
          <button
            className="swipe-action swipe-action--apply"
            type="button"
            onClick={() => commit('apply')}
            disabled={!current || Boolean(exit)}
          >
            <span className="swipe-action__icon">
              <CheckIcon />
            </span>
            <span className="swipe-action__text">
              <strong>ارسال رزومه</strong>
              <small>با ورود جابینجا</small>
            </span>
            <ArrowRightIcon className="swipe-action__arrow" />
          </button>

          <button
            className="swipe-action swipe-action--skip"
            type="button"
            onClick={() => commit('skip')}
            disabled={!current || Boolean(exit)}
          >
            <span className="swipe-action__icon">
              <XIcon />
            </span>
            <span className="swipe-action__text">
              <strong>رد کردن</strong>
              <small>برو بعدی</small>
            </span>
            <ArrowLeftIcon className="swipe-action__arrow" />
          </button>
        </div>

        <div className="utility-actions">
          <button
            className="text-button"
            type="button"
            onClick={undo}
            disabled={decisions.length === 0 || Boolean(exit)}
          >
            <UndoIcon />
            بازگرداندن
          </button>
          <a className="text-button" href={JOBINJA_LOGIN} target="_blank" rel="noreferrer">
            <LoginIcon />
            ورود به جابینجا
          </a>
        </div>
        <p className="keyboard-hint">
          <SparkIcon />
          با کلیدهای چپ و راست هم می‌توانی سوایپ کنی
        </p>
      </footer>

      {toast ? (
        <div className="toast" role="status" key={toast.id}>
          <span>{toast.message}</span>
          {toast.href ? (
            <a href={toast.href} target="_blank" rel="noreferrer">
              {toast.linkLabel || 'باز کردن'}
            </a>
          ) : null}
        </div>
      ) : null}

      {infoOpen ? (
        <div className="modal" role="presentation" onClick={() => setInfoOpen(false)}>
          <div
            className="modal__panel"
            role="dialog"
            aria-modal="true"
            aria-labelledby="about-title"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              className="modal__close"
              type="button"
              onClick={() => setInfoOpen(false)}
              aria-label="بستن"
            >
              <XIcon />
            </button>
            <span className="eyebrow">درباره</span>
            <h2 id="about-title">جابینجا سوایپ</h2>
            <p>
              یک رابط ساده برای مرور آگهی‌های عمومی جابینجا. هر آگهی را رد کن یا برای ارسال
              رزومه به جابینجا برو.
            </p>
            <ul className="about-list">
              <li>
                <strong>منبع آگهی‌ها</strong>
                <span>صفحه عمومی «فرصت‌های شغلی» جابینجا</span>
              </li>
              <li>
                <strong>آخرین به‌روزرسانی</strong>
                <span>{payload ? formatDate(payload.fetchedAt) : 'در حال بارگذاری'}</span>
              </li>
              <li>
                <strong>ارسال رزومه</strong>
                <span>
                  ورود و ارسال در سایت جابینجا انجام می‌شود؛ این اپ رمز یا حساب نمی‌گیرد.
                </span>
              </li>
              <li>
                <strong>حریم خصوصی</strong>
                <span>تصمیم‌های سوایپ فقط در همین مرورگر ذخیره می‌شوند.</span>
              </li>
            </ul>
            <div className="modal__actions">
              <a className="primary-button" href={JOBINJA_JOBS} target="_blank" rel="noreferrer">
                مشاهده جابینجا
              </a>
              <a
                className="secondary-button"
                href="https://github.com/dg-run/jobinja-swipe"
                target="_blank"
                rel="noreferrer"
              >
                کد پروژه
              </a>
            </div>
            <p className="modal__note">
              این پروژه مستقل است و وابستگی رسمی به جابینجا ندارد.
            </p>
          </div>
        </div>
      ) : null}
    </div>
  )
}
