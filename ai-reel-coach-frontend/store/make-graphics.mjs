import sharp from 'sharp'
import { readFileSync } from 'fs'

const logo = readFileSync(new URL('../assets/logo.svg', import.meta.url))
// Embed the real wordmark font (Dancing Script 700) so librsvg renders it exactly
const fontB64 = readFileSync(new URL('./DancingScript-Bold.ttf', import.meta.url)).toString('base64')
const out = (name) => new URL('./' + name, import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1')

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
await sharp(Buffer.from(iconBg)).composite([{ input: logoForIcon, gravity: 'center' }]).png().toFile(out('icon-512.png'))

// ── 2. Feature graphic 1024×500 — real Dancing Script wordmark + tagline ──
const banner = `
<svg width="1024" height="500" viewBox="0 0 1024 500" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <style>
      @font-face {
        font-family: 'Dancing Script';
        font-weight: 700;
        src: url(data:font/ttf;base64,${fontB64}) format('truetype');
      }
    </style>
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
    <!-- Wordmark gradient matching the user's web wordmark (dark theme):
         cyan -> pink -> orange, left to right. -->
    <linearGradient id="word" x1="0" y1="0" x2="1" y2="0">
      <stop offset="0%"   stop-color="#00D4FF"/>
      <stop offset="50%"  stop-color="#FF2D8B"/>
      <stop offset="100%" stop-color="#FF8C1A"/>
    </linearGradient>
  </defs>
  <rect width="1024" height="500" fill="url(#bg)"/>
  <rect width="1024" height="500" fill="url(#glowP)"/>
  <rect width="1024" height="500" fill="url(#glowC)"/>
  <text x="360" y="235" font-family="'Dancing Script', cursive" font-weight="700" font-size="150" fill="url(#word)">Nuove</text>
  <text x="364" y="300" font-family="Arial, Helvetica, sans-serif" font-size="30" font-weight="700" fill="#FFFFFF">Create viral Blogs, Reels &amp; Shorts with AI</text>
  <text x="364" y="344" font-family="Arial, Helvetica, sans-serif" font-size="24" font-weight="400" fill="rgba(255,255,255,0.72)">Scripts • Trends • Teleprompter • Captions</text>
</svg>`
const logoForBanner = await sharp(logo, { density: 400 }).resize(300, 300, { fit: 'contain', background: '#00000000' }).png().toBuffer()
await sharp(Buffer.from(banner)).composite([{ input: logoForBanner, top: 100, left: 40 }]).png().toFile(out('feature-graphic.png'))

console.log('DONE: icon-512.png + feature-graphic.png')
