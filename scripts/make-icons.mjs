import { readFile } from 'node:fs/promises'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import sharp from 'sharp'

const __dirname = dirname(fileURLToPath(import.meta.url))
const root = resolve(__dirname, '..')
const source = await readFile(resolve(root, 'public/icons/icon.svg'))
const icons = resolve(root, 'public/icons')

await sharp(source).resize(192, 192).png().toFile(resolve(icons, 'pwa-192.png'))
await sharp(source).resize(512, 512).png().toFile(resolve(icons, 'pwa-512.png'))
await sharp(source).resize(180, 180).png().toFile(resolve(icons, 'apple-touch-icon.png'))

const maskable = await sharp(source).resize(410, 410).png().toBuffer()
await sharp({
  create: {
    width: 512,
    height: 512,
    channels: 4,
    background: '#087568',
  },
})
  .composite([{ input: maskable, top: 51, left: 51 }])
  .png()
  .toFile(resolve(icons, 'pwa-maskable-512.png'))

console.log('Wrote PWA icons to public/icons')
