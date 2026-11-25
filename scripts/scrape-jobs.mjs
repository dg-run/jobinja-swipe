import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import * as cheerio from 'cheerio'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const output = resolve(root, 'public/data/jobs.json')

const PROXY_HOST = 'jobinja-ir.translate.goog'
const SITE = 'https://jobinja.ir'
const PROXY = `https://${PROXY_HOST}`
const TR_PARAMS = '_x_tr_sl=fa&_x_tr_tl=en&_x_tr_hl=en'
const PAGES = clamp(Number(process.env.PAGES || 4), 1, 10)
const LIMIT = clamp(Number(process.env.LIMIT || 72), 1, 200)
const WITH_DETAILS = process.env.DETAILS !== '0'
const CONCURRENCY = clamp(Number(process.env.CONCURRENCY || 2), 1, 4)

const JOBVISION_SITE = 'https://jobvision.ir'
const JOBVISION_API = 'https://candidateapi.jobvision.ir/api/v1'
const JV_PAGES = clamp(Number(process.env.JV_PAGES || 3), 1, 10)
const JV_PAGE_SIZE = clamp(Number(process.env.JV_PAGE_SIZE || 30), 10, 50)
const JV_DETAILS = process.env.JV_DETAILS !== '0'
const JV_LIMIT = clamp(Number(process.env.JV_LIMIT || 90), 1, 300)

function clamp(n, min, max) {
  return Number.isFinite(n) ? Math.min(max, Math.max(min, Math.floor(n))) : min
}

const UA =
  'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36'

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

async function fetchText(url, tries = 3) {
  let lastError
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch(url, {
        headers: {
          'user-agent': UA,
          'accept-language': 'fa-IR,fa;q=0.9,en;q=0.8',
          accept: 'text/html,application/xhtml+xml',
        },
        redirect: 'follow',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      return await response.text()
    } catch (error) {
      lastError = error
      await sleep(700 * (i + 1))
    }
  }
  throw lastError
}

async function fetchJson(url, options = {}, tries = 3) {
  let lastError
  for (let i = 0; i < tries; i += 1) {
    try {
      const response = await fetch(url, {
        ...options,
        headers: {
          'user-agent': UA,
          'accept-language': 'fa-IR,fa;q=0.9,en;q=0.8',
          accept: 'application/json',
          ...(options.headers || {}),
        },
        redirect: 'follow',
      })
      if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`)
      return await response.json()
    } catch (error) {
      lastError = error
      await sleep(700 * (i + 1))
    }
  }
  throw lastError
}

function proxyUrl(url) {
  const parsed = new URL(url)
  const query = new URLSearchParams(parsed.search)
  query.delete('_x_tr_sl')
  query.delete('_x_tr_tl')
  query.delete('_x_tr_hl')
  query.delete('_x_tr_hist')
  const suffix = query.toString()
  return `${PROXY}${parsed.pathname}${suffix ? `?${suffix}&${TR_PARAMS}` : `?${TR_PARAMS}`}`
}

function cleanUrl(href) {
  if (!href) return ''
  const parsed = new URL(href, PROXY)
  parsed.hostname = 'jobinja.ir'
  parsed.protocol = 'https:'
  for (const key of ['_x_tr_sl', '_x_tr_tl', '_x_tr_hl', '_x_tr_hist']) {
    parsed.searchParams.delete(key)
  }
  parsed.hash = ''
  return `${SITE}${parsed.pathname}`
}

function cleanText(value) {
  return String(value || '')
    .replace(/[ \t\u00a0]+/g, ' ')
    .replace(/\n[ \t]+/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim()
}

function truncate(value, max = 1800) {
  return value.length > max ? `${value.slice(0, max).trim()}…` : value
}

function faNumber(value) {
  return new Intl.NumberFormat('fa-IR').format(Number(value))
}

function pickFa(value) {
  if (!value) return ''
  if (typeof value === 'string') return cleanText(value)
  return cleanText(
    value.titleFa ||
      value.title ||
      value.nameFa ||
      value.nameEn ||
      value.name?.titleFa ||
      value.name?.title ||
      '',
  )
}

function htmlToText(html) {
  if (!html) return ''
  const withBreaks = String(html)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|li|ul|ol|div|h[1-6]|tr|td)>/gi, '\n')
  const $ = cheerio.load(withBreaks)
  $('script, style').remove()
  return cleanText($.root().text())
}

function listItems(html) {
  const $ = cheerio.load(html)
  const jobs = []
  $('li.c-jobListView__item').each((_, element) => {
    const card = $(element)
    const link = card.find('a.c-jobListView__titleLink').first()
    const href = link.attr('href')
    if (!href) return

    const url = cleanUrl(href)
    const match = new URL(url).pathname.match(/\/companies\/([^/]+)\/jobs\/([^/]+)/)
    if (!match) return

    const meta = card
      .find('.c-jobListView__metaItem')
      .map((__, item) => cleanText($(item).text()))
      .get()
      .filter(Boolean)

    const title = cleanText(link.text())
    const company = (meta[0] || '').replace(/\(برای مشاهده حقوق وارد شوید\)/g, '').trim()
    const location = meta[1] || ''
    const contract = (meta[2] || '').replace(/\(برای مشاهده حقوق وارد شوید\)/g, '').trim()
    const posted = cleanText(card.find('.c-jobListView__passedDays').text()).replace(/[()]/g, '')
    const logo = card.find('img.o-listView__itemIndicatorImage').attr('src') || ''

    jobs.push({
      id: `${match[1]}/${match[2]}`,
      title,
      company,
      location,
      contract,
      posted,
      url,
      logo: logo.startsWith('//') ? `https:${logo}` : logo,
      source: 'jobinja',
    })
  })
  return jobs
}

function infoValue($, label) {
  let value = ''
  $('.c-infoBox__item').each((_, item) => {
    const title = cleanText($(item).find('.c-infoBox__itemTitle').first().text())
    if (title === label) {
      value = cleanText($(item).find('.tags').first().text())
    }
  })
  return value
}

function descriptionText($) {
  const node = $('.s-jobDesc').first()
  if (!node.length) return ''
  node.find('a.no-desc-display').remove()
  node.find('script, style').remove()
  let text = cleanText(node.text())
  text = text
    .replace(/^شرح موقعیت شغلی\s*/u, '')
    .replace(/\s*ثبت آگهی استخدام در جابینجا\s*$/u, '')
    .replace(/\s*استخدام در جابینجا\s*$/u, '')
    .trim()
  return text
}

async function jobinjaDetail(job) {
  const html = await fetchText(proxyUrl(job.url))
  const $ = cheerio.load(html)
  const description = descriptionText($)
  const category = infoValue($, 'دسته‌بندی شغلی')
  const location = infoValue($, 'موقعیت مکانی') || job.location
  const contract = infoValue($, 'نوع همکاری') || job.contract
  const experience = infoValue($, 'حداقل سابقه کار')
  const salary = infoValue($, 'حقوق')
  const skills = infoValue($, 'مهارت‌های مورد نیاز')
  const title = cleanText($('.c-jobView__titleText h1').first().text()) || job.title

  const fallback = `فرصت شغلی «${title}» در ${job.company}. محل: ${location || 'نامشخص'}. نوع همکاری: ${
    contract || 'نامشخص'
  }.`
  const summary = description.length > 0 ? description : fallback

  return {
    ...job,
    title,
    location,
    contract,
    category,
    experience,
    salary,
    skills,
    description: truncate(summary),
    source: 'jobinja',
  }
}

async function scrapeJobinja() {
  const all = []
  const seen = new Set()

  for (let page = 1; page <= PAGES; page += 1) {
    const query = page === 1 ? '' : `?page=${page}`
    const url = `${PROXY}/jobs${query}${query ? '&' : '?'}${TR_PARAMS}`
    process.stdout.write(`jobinja list page ${page}/${PAGES} … `)
    try {
      const html = await fetchText(url)
      const jobs = listItems(html)
      let added = 0
      for (const job of jobs) {
        if (seen.has(job.id) || all.length >= LIMIT) continue
        seen.add(job.id)
        all.push(job)
        added += 1
      }
      console.log(`${jobs.length} found, ${added} new`)
    } catch (error) {
      console.log(`failed: ${error.message}`)
    }
    await sleep(300)
  }

  if (all.length === 0) return []

  if (!WITH_DETAILS) return all

  process.stdout.write(`jobinja details for ${all.length} jobs …\n`)
  return mapLimit(all, CONCURRENCY, async (job, index) => {
    try {
      const enriched = await jobinjaDetail(job)
      process.stdout.write(`  jobinja ${index + 1}/${all.length} ${job.title.slice(0, 46)}\n`)
      return enriched
    } catch (error) {
      process.stdout.write(
        `  jobinja ${index + 1}/${all.length} detail failed: ${error.message}\n`,
      )
      return {
        ...job,
        category: '',
        experience: '',
        salary: '',
        skills: '',
        description: `فرصت شغلی «${job.title}» در ${job.company}. محل: ${
          job.location || 'نامشخص'
        }. نوع همکاری: ${job.contract || 'نامشخص'}.`,
        source: 'jobinja',
      }
    }
  })
}

async function jobvisionListPage(page) {
  const body = {
    pageSize: JV_PAGE_SIZE,
    requestedPage: page,
    sortBy: 1,
    searchId: null,
  }
  const json = await fetchJson(`${JOBVISION_API}/JobPost/List`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
  })
  return Array.isArray(json?.data?.jobPosts) ? json.data.jobPosts : []
}

async function jobvisionDetail(id) {
  const json = await fetchJson(`${JOBVISION_API}/JobPost/Detail?jobPostId=${id}`)
  return json?.data ?? null
}

function jobvisionUrl(id, title) {
  const slug = `استخدام-${title}`
    .replace(/\s+/g, '-')
    .replace(/[/?#]+/g, '')
    .replace(/-+/g, '-')
  return `${JOBVISION_SITE}/jobs/${id}/${slug}`
}

function jobvisionLocation(item, detail) {
  const location = detail?.location || item.location || {}
  const province = pickFa(location.province)
  const city = pickFa(location.city)
  const region = pickFa(location.region)
  return [province, city, region]
    .filter(Boolean)
    .filter((value, index, list) => list.indexOf(value) === index)
    .join(' ، ')
}

function jobvisionExperience(item, detail) {
  const years =
    detail?.requiredRelatedExperienceYears ?? item.properties?.requiredRelatedExperienceYears
  const seniority = pickFa(detail?.seniorityLevel) || pickFa(item.seniorityLevel)
  const number = Number(years)
  if (Number.isFinite(number) && number > 0) {
    return [seniority, `${faNumber(number)} سال سابقه`].filter(Boolean).join(' · ')
  }
  return seniority || 'بدون نیاز به سابقه'
}

function jobvisionSkills(detail) {
  if (!detail) return ''
  const parts = []
  for (const item of detail.skills || []) parts.push(pickFa(item.skill) || pickFa(item))
  for (const item of detail.softwareRequirements || []) parts.push(pickFa(item.software))
  for (const item of detail.languageRequirements || []) {
    parts.push([pickFa(item.language), pickFa(item.skill)].filter(Boolean).join(' '))
  }
  return [...new Set(parts.map(cleanText).filter(Boolean))].join('، ')
}

function jobvisionToJob(item, detail = null) {
  const title = cleanText(detail?.title || item.title)
  const company =
    pickFa(detail?.company?.name) ||
    pickFa(item.company) ||
    cleanText(detail?.company?.nameFa || item.company?.nameFa)
  const location = jobvisionLocation(item, detail)
  const contract = pickFa(detail?.workType) || pickFa(item.workType)
  const category = pickFa(detail?.jobCategories?.[0]) || pickFa(item.jobCategories?.[0])
  const salary = pickFa(detail?.salary) || pickFa(item.salary)
  const experience = jobvisionExperience(item, detail)
  const skills = jobvisionSkills(detail)
  const logo = detail?.company?.logoUrl || item.company?.logoUrl || ''
  const posted =
    detail?.activationTime?.beautifyFa ||
    item.activationTime?.beautifyFa ||
    item.firstActivationTime?.beautifyFa ||
    ''
  const fallback = `فرصت شغلی «${title}» در ${company || 'شرکت نامشخص'}. محل: ${
    location || 'نامشخص'
  }. نوع همکاری: ${contract || 'نامشخص'}.`
  const description = truncate(htmlToText(detail?.description) || fallback)

  return {
    id: `jobvision:${item.id}`,
    title,
    company,
    location,
    contract,
    posted,
    url: jobvisionUrl(item.id, title),
    logo: /default-companyLogo/i.test(logo) ? '' : logo,
    category,
    experience,
    salary,
    skills,
    description,
    source: 'jobvision',
  }
}

async function scrapeJobvision() {
  const all = []
  const seen = new Set()

  for (let page = 1; page <= JV_PAGES; page += 1) {
    process.stdout.write(`jobvision list page ${page}/${JV_PAGES} … `)
    try {
      const items = await jobvisionListPage(page)
      let added = 0
      for (const item of items) {
        if (seen.has(item.id) || all.length >= JV_LIMIT) continue
        seen.add(item.id)
        all.push(item)
        added += 1
      }
      console.log(`${items.length} found, ${added} new`)
      if (items.length === 0) break
    } catch (error) {
      console.log(`failed: ${error.message}`)
    }
    await sleep(300)
  }

  if (all.length === 0) return []

  if (!JV_DETAILS) return all.map((item) => jobvisionToJob(item))

  process.stdout.write(`jobvision details for ${all.length} jobs …\n`)
  return mapLimit(all, CONCURRENCY, async (item, index) => {
    try {
      const detail = await jobvisionDetail(item.id)
      process.stdout.write(`  jobvision ${index + 1}/${all.length} ${item.title.slice(0, 46)}\n`)
      return jobvisionToJob(item, detail)
    } catch (error) {
      process.stdout.write(
        `  jobvision ${index + 1}/${all.length} detail failed: ${error.message}\n`,
      )
      return jobvisionToJob(item)
    }
  })
}

async function mapLimit(items, limit, fn) {
  const results = new Array(items.length)
  let cursor = 0
  async function worker() {
    while (cursor < items.length) {
      const index = cursor
      cursor += 1
      results[index] = await fn(items[index], index)
      await sleep(250)
    }
  }
  await Promise.all(Array.from({ length: limit }, worker))
  return results
}

async function loadExistingJobs() {
  try {
    const data = JSON.parse(await readFile(output, 'utf8'))
    return Array.isArray(data.jobs) ? data.jobs : []
  } catch {
    return []
  }
}

function interleave(primary, secondary) {
  const merged = []
  const length = Math.max(primary.length, secondary.length)
  for (let index = 0; index < length; index += 1) {
    if (primary[index]) merged.push(primary[index])
    if (secondary[index]) merged.push(secondary[index])
  }
  return merged
}

async function main() {
  const previous = await loadExistingJobs()

  process.stdout.write('Fetching Jobinja …\n')
  const jobinja = await scrapeJobinja().catch((error) => {
    console.log(`Jobinja failed: ${error.message}`)
    return []
  })
  const finalJobinja = jobinja.length
    ? jobinja
    : previous
        .filter((job) => (job.source || 'jobinja') === 'jobinja')
        .map((job) => ({ ...job, source: 'jobinja' }))
  if (!jobinja.length && finalJobinja.length) {
    console.log(`Using ${finalJobinja.length} cached Jobinja jobs`)
  }

  process.stdout.write('\nFetching Jobvision …\n')
  const jobvision = await scrapeJobvision().catch((error) => {
    console.log(`Jobvision failed: ${error.message}`)
    return []
  })
  const finalJobvision = jobvision.length
    ? jobvision
    : previous.filter((job) => job.source === 'jobvision')
  if (!jobvision.length && finalJobvision.length) {
    console.log(`Using ${finalJobvision.length} cached Jobvision jobs`)
  }

  if (finalJobinja.length === 0 && finalJobvision.length === 0) {
    throw new Error('No jobs found. The upstream layout may have changed.')
  }

  const jobs = interleave(finalJobinja, finalJobvision)
  const payload = {
    source: 'https://jobinja.ir/jobs + https://jobvision.ir/jobs',
    fetchedAt: new Date().toISOString(),
    total: jobs.length,
    counts: {
      jobinja: finalJobinja.length,
      jobvision: finalJobvision.length,
    },
    jobs,
  }

  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(
    `\nWrote ${jobs.length} jobs to ${output} (${finalJobinja.length} Jobinja, ${finalJobvision.length} Jobvision)`,
  )
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
