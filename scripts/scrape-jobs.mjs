import { mkdir, writeFile } from 'node:fs/promises'
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

async function detail(job) {
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
    description: summary.length > 1800 ? `${summary.slice(0, 1800).trim()}…` : summary,
  }
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

async function main() {
  const all = []
  const seen = new Set()

  for (let page = 1; page <= PAGES; page += 1) {
    const query = page === 1 ? '' : `?page=${page}`
    const url = `${PROXY}/jobs${query}${query ? '&' : '?'}${TR_PARAMS}`
    process.stdout.write(`list page ${page}/${PAGES} … `)
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

  if (all.length === 0) throw new Error('No jobs found. The upstream layout may have changed.')

  let jobs = all
  if (WITH_DETAILS) {
    process.stdout.write(`fetching details for ${all.length} jobs …\n`)
    jobs = await mapLimit(all, CONCURRENCY, async (job, index) => {
      try {
        const enriched = await detail(job)
        process.stdout.write(`  ${index + 1}/${all.length} ${job.title.slice(0, 46)}\n`)
        return enriched
      } catch (error) {
        process.stdout.write(`  ${index + 1}/${all.length} detail failed: ${error.message}\n`)
        return {
          ...job,
          category: '',
          experience: '',
          salary: '',
          skills: '',
          description: `فرصت شغلی «${job.title}» در ${job.company}. محل: ${
            job.location || 'نامشخص'
          }. نوع همکاری: ${job.contract || 'نامشخص'}.`,
        }
      }
    })
  }

  const payload = {
    source: 'https://jobinja.ir/jobs',
    fetchedAt: new Date().toISOString(),
    total: jobs.length,
    jobs,
  }

  await mkdir(dirname(output), { recursive: true })
  await writeFile(output, `${JSON.stringify(payload, null, 2)}\n`, 'utf8')
  console.log(`\nWrote ${jobs.length} jobs to ${output}`)
}

main().catch((error) => {
  console.error(error)
  process.exitCode = 1
})
