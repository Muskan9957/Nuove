import sharp from 'sharp'
import { readFileSync } from 'fs'

const logo = readFileSync(new URL('../assets/logo.svg', import.meta.url))

// ── 1. App icon 512×512 — logo on a brand-dark rounded background ──
const iconBg = `
<svg width="512" height="512" viewBox="0 0 512 512" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <radialGradient id="g" cx="50%" cy="38%" r="75%">
      <stop offset="0%"  stop-color="#241019"/>
      <stop offset="60%" stop-color="#120810"/>
      <stop offset="100%" stop-color="#080507"/>
    </radialGradient>
  </defs>
  <rect width="512" height="512" fill="url(#g)"/>
</svg>`

const logoForIcon = await sharp(logo, { density: 400 }).resize(352, 352, { fit: 'contain', background: '#00000000' }).png().toBuffer()
await sharp(Buffer.from(iconBg))
  .composite([{ input: logoForIcon, gravity: 'center' }])
  .png()
  .toFile(new URL('./icon-512.png', import.meta.url).pathname.replace(/^\//, ''))

// ── 2. Feature graphic 1024×500 — logo + wordmark + tagline ──
const banner = `
<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%"  stop-color="#0B0710"/>
      <stop offset="100%" stop-color="#080507"/>
    </linearGradient>
    <radialGradient id="glowP" cx="18%" cy="30%" r="55%">
      <stop offset="0%"  stop-color="rgba(225,48,108,0.28)"/>
      <stop offset="100%" stop-color="rgba(225,48,108,0)"/>
    </radialGradient>
    <radialGradient id="glowC" cx="88%" cy="85%" r="55%">
      <stop offset="0%"  stop-color="rgba(0,200,255,0.20)"/>
      <stop offset="100%" stop-color="rgba(0,200,255,0)"/>
    </radialGradient>
    <linearGradient id="word" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"  stop-color="#FCAF45"/>
      <stop offset="45%" stop-color="#E1306C"/>
      <stop offset="100%" stop-color="#833AB4"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <rect width="1024" height="500" fill="url(#glowP)"/>
  <rect width="1024" height="500" fill="url(#glowC)"/>
  <text x="360" y="238" font-family="Arial, Helvetica, sans-serif" font-size="118" font-weight="800" fill="url(#word)" letter-spacing="-3">Nuove</text>
  <text x="364" y="300" font-family="Arial, Helvetica, sans-serif" font-size="33" font-weight="700" fill="#FFFFFF">Create viral Reels &amp; Shorts with AI</text>
  <text x="364" y="346" font-family="Arial, Helvetica, sans-serif" font-size="25" font-weight="400" fill="rgba(255,255,255,0.72)">Scripts • Trends • Teleprompter • Captions</text>
</svg>`

const logoForBanner = await sharp(logo, { density: 400 }).resize(300, 300, { fit: 'contain', background: '#00000000' }).png().toBuffer()
await sharp(Buffer.from(banner))
  .composite([{ input: logoForBanner, top: 100, left: 40 }])
  .png()
  .toFile(new URL('./feature-graphic.png', import.meta.url).pathname.replace(/^\//, ''))

console.log('DONE: icon-512.png + feature-graphic.png')
