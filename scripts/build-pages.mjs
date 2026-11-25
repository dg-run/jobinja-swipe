import { cp, rm, writeFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const dist = resolve(root, 'dist')
const docs = resolve(root, 'docs')

await rm(docs, { recursive: true, force: true })
await cp(dist, docs, { recursive: true })
await writeFile(resolve(docs, '.nojekyll'), '')
console.log('Copied dist to docs for GitHub Pages')
