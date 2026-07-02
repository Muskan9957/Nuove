// Vercel Edge function — streams a short-form video script to the client.
// Uses Gemini (gemini-2.5-flash) via REST so it stays edge-compatible and in
// sync with the backend's LLM provider. NOTE: requires GEMINI_API_KEY in the
// Vercel project env. We intentionally do NOT use the Anthropic SDK here — the
// whole app runs on Gemini now.

export const config = { runtime: 'edge', maxDuration: 30 }

const GEMINI_MODEL = process.env.GEMINI_MODEL || 'gemini-2.5-flash'
const GEMINI_BASE  = 'https://generativelanguage.googleapis.com/v1beta/models'

const LANG = {
  hi      : 'IMPORTANT: Write ALL content entirely in Hindi (Devanagari script).',
  hinglish: 'IMPORTANT: Write ALL content in Hinglish — natural Hindi+English mix, Roman script.',
  es      : 'IMPORTANT: Write ALL content entirely in Spanish.',
  fr      : 'IMPORTANT: Write ALL content entirely in French.',
  pt      : 'IMPORTANT: Write ALL content entirely in Portuguese (Brazilian).',
  de      : 'IMPORTANT: Write ALL content entirely in German.',
  ar      : 'IMPORTANT: Write ALL content entirely in Arabic.',
  id      : 'IMPORTANT: Write ALL content entirely in Bahasa Indonesia.',
  ja      : 'IMPORTANT: Write ALL content entirely in Japanese.',
  ko      : 'IMPORTANT: Write ALL content entirely in Korean.',
}

// Map user duration (in minutes) to realistic speaking-rate word counts (approx 130 words per minute):
// - Default (no input): ~100 words (45-second reel)
// - 1 min: ~130 words
// - 2 min: ~260 words
// - 3 min: ~390 words (approx 20-25 lines of script)
// - 4 min: ~520 words
// - 5 min: ~650 words
function durationToWords(duration) {
  const mins = parseFloat(duration)
  if (!mins || isNaN(mins)) {
    return { min: 90, max: 110, label: '100 words (45-second video)' }
  }
  if (mins <= 1.0) {
    return { min: 120, max: 140, label: '130 words (1-minute video)' }
  }
  if (mins <= 2.0) {
    return { min: 240, max: 280, label: '260 words (2-minute video)' }
  }
  if (mins <= 3.0) {
    return { min: 360, max: 420, label: '390 words (3-minute video)' }
  }
  if (mins <= 4.0) {
    return { min: 480, max: 560, label: '520 words (4-minute video)' }
  }
  return { min: 600, max: 700, label: '650 words (5-minute video)' }
}

function parseScript(fullText) {
  // Strip markdown bold/italic that models sometimes add
  const text = fullText.replace(/\*\*/g, '').replace(/\*/g, '')

  const hookIdx = text.search(/\bHOOK\s*[:(]/i)
  const bodyIdx = text.search(/\bBODY\s*[:(]/i)
  const ctaIdx  = text.search(/\bCTA\s*[:(]/i)

  let hook = '', body = '', cta = ''

  if (hookIdx !== -1) {
    const end = bodyIdx !== -1 ? bodyIdx : (ctaIdx !== -1 ? ctaIdx : text.length)
    hook = text.slice(hookIdx, end).replace(/^HOOK[^:\n]*[:\n]\s*/i, '').trim()
  }
  if (bodyIdx !== -1) {
    const end = ctaIdx !== -1 ? ctaIdx : text.length
    body = text.slice(bodyIdx, end).replace(/^BODY[^:\n]*[:\n]\s*/i, '').trim()
  }
  if (ctaIdx !== -1) {
    cta = text.slice(ctaIdx).replace(/^CTA[^:\n]*[:\n]\s*/i, '').trim()
  }

  // Last-resort fallback: if none parsed, dump everything into body
  if (!hook && !body && !cta) body = fullText.trim()

  return { hook, body, cta }
}

function buildPrompt({ topic, niche, tone, language, voiceInstruction, duration }) {
  const lang   = LANG[language] || ''
  const voice  = voiceInstruction ? `\nVOICE STYLE (follow strictly):\n${voiceInstruction}` : ''
  const wc     = durationToWords(duration)

  return `You are an expert short-form content coach for viral Instagram Reels and YouTube Shorts.
${lang ? '\n' + lang + '\n' : ''}
Write a short-form video script with EXACTLY these three sections labelled HOOK:, BODY:, and CTA:

Topic   : ${topic}
Niche   : ${niche || 'general'}
Tone    : ${tone  || 'conversational'}
Target Length: ${wc.label} (${wc.min}–${wc.max} spoken words in total)
${voice}

HOOK:
[1-2 sentences. First 3 seconds. Scroll-stopping statement.]

BODY:
[The core content. This section MUST contain enough detail to meet the target length. Write several punchy points or a full story. Short sentences, no filler, but ensure you reach the target word limit.]

CTA:
[One clear action for the last 5 seconds.]

Important: keep the labels HOOK:, BODY:, and CTA: exactly as shown in English (do NOT translate them). The entire script (HOOK + BODY + CTA) MUST total about ${wc.min}–${wc.max} spoken words in total — this length is a hard requirement, especially for the BODY. No hashtags, no emojis.`
}

// ── Stream tokens from Gemini (SSE) — yields text deltas ─────────────
async function* streamGemini({ prompt, maxTokens, apiKey }) {
  const url = `${GEMINI_BASE}/${GEMINI_MODEL}:streamGenerateContent?alt=sse&key=${apiKey}`
  const res = await fetch(url, {
    method : 'POST',
    headers: { 'Content-Type': 'application/json' },
    body   : JSON.stringify({
      contents        : [{ role: 'user', parts: [{ text: prompt }] }],
      // thinkingBudget:0 disables 2.5's "thinking" tokens — cheaper, faster, and
      // keeps the short maxOutputTokens budget for the actual script.
      generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
    }),
  })

  if (!res.ok || !res.body) {
    const errText = await res.text().catch(() => '')
    throw new Error(`Gemini ${res.status}: ${errText.slice(0, 200)}`)
  }

  const reader  = res.body.getReader()
  const decoder = new TextDecoder()
  let buffer = ''

  while (true) {
    const { value, done } = await reader.read()
    if (done) break
    buffer += decoder.decode(value, { stream: true })

    // SSE frames are separated by blank lines
    const lines = buffer.split('\n')
    buffer = lines.pop() || ''
    for (const line of lines) {
      const trimmed = line.trim()
      if (!trimmed.startsWith('data:')) continue
      const payload = trimmed.slice(5).trim()
      if (!payload || payload === '[DONE]') continue
      try {
        const json = JSON.parse(payload)
        const text = json?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
        if (text) yield text
      } catch { /* partial JSON across chunks — ignore, next read completes it */ }
    }
  }
}

// Generate visual direction + music vibe suggestions (non-streaming Gemini call)
async function generateExtras(topic, hook, body, tone, apiKey) {
  try {
    const url = `${GEMINI_BASE}/${GEMINI_MODEL}:generateContent?key=${apiKey}`
    const prompt = `You are a video production consultant. Based on this short-form video script, suggest a visual direction and background music.

Topic: ${topic}
Tone: ${tone || 'conversational'}
Hook: ${hook}
Body: ${body.slice(0, 250)}

Return ONLY this JSON with no extra text:
{
  "visual": {
    "background": "ideal filming background in one sentence",
    "style": "shooting style in one phrase (e.g. handheld, talking-head, walking)",
    "broll": ["b-roll idea 1", "b-roll idea 2", "b-roll idea 3"],
    "colorMood": "color/lighting mood in a few words",
    "textOverlay": "text to display on screen during the hook"
  },
  "music": {
    "genre": "music genre e.g. Lo-fi Hip Hop",
    "mood": "music mood e.g. Uplifting & Motivational",
    "bpm": 95,
    "searchQuery": "exact royalty-free music search term",
    "tip": "one practical tip for using background music in this video"
  }
}`
    const res = await fetch(url, {
      method : 'POST',
      headers: { 'Content-Type': 'application/json' },
      body   : JSON.stringify({
        contents        : [{ role: 'user', parts: [{ text: prompt }] }],
        generationConfig: { maxOutputTokens: 600, thinkingConfig: { thinkingBudget: 0 } },
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text).join('') || ''
    const jsonMatch = text.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return null
    return JSON.parse(jsonMatch[0])
  } catch {
    return null
  }
}

export default async function handler(req) {
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin' : '*',
        'Access-Control-Allow-Methods': 'POST, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      },
    })
  }

  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 })

  const authHeader = req.headers.get('Authorization')
  if (!authHeader) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    })
  }

  const RAILWAY    = process.env.RAILWAY_API_URL
  const GEMINI_KEY = process.env.GEMINI_API_KEY

  if (!RAILWAY || !GEMINI_KEY) {
    return new Response(JSON.stringify({ error: 'misconfigured' }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    })
  }

  const body = await req.json()
  const { topic, niche, tone, language = 'en', voiceInstruction, duration } = body

  const encoder = new TextEncoder()
  const { readable, writable } = new TransformStream()
  const writer = writable.getWriter()
  const send = async (data) => writer.write(encoder.encode(`data: ${JSON.stringify(data)}\n\n`))

  ;(async () => {
    try {
      // ── 1. Stream script from Gemini immediately ─────────────────
      const wc     = durationToWords(duration)
      const maxTok = Math.min(4000, Math.max(800, Math.round(wc.max * 3)))
      const prompt = buildPrompt({ topic, niche, tone, language, voiceInstruction, duration })

      let fullText = ''
      for await (const text of streamGemini({ prompt, maxTokens: maxTok, apiKey: GEMINI_KEY })) {
        fullText += text
        await send({ type: 'chunk', text })
      }

      if (!fullText.trim()) {
        await send({ type: 'error', message: 'Script generation failed. Please try again.' })
        return
      }

      // ── 2. Parse sections ────────────────────────────────────────
      const { hook, body: bodyText, cta } = parseScript(fullText)

      // ── 3. Kick off save + extras generation in parallel ─────────
      const savePromise   = fetch(`${RAILWAY}/api/scripts/save`, {
        method : 'POST',
        headers: { Authorization: authHeader, 'Content-Type': 'application/json' },
        body   : JSON.stringify({ topic, niche, tone, language, hook, body: bodyText, cta, fullScript: fullText }),
      })
      const extrasPromise = generateExtras(topic, hook, bodyText, tone, GEMINI_KEY)

      // ── 4. Send script event as soon as save completes ───────────
      const saveRes  = await savePromise
      let scriptData = { topic, hook, body: bodyText, cta, fullScript: fullText }
      let usage      = null
      let newBadges  = null

      if (saveRes.ok) {
        const saved   = await saveRes.json()
        scriptData.id = saved.id
        usage         = { used: saved.used, limit: saved.limit }
        newBadges     = saved.newBadges
      } else {
        const err = await saveRes.json().catch(() => ({}))
        await send({ type: 'script', data: scriptData, error: err.error || null })
        // Still try to send extras even on quota error
        const extras = await extrasPromise
        if (extras) await send({ type: 'extras', data: extras })
        return
      }

      // Send script event — frontend will score hook async after receiving this
      await send({ type: 'script', data: scriptData, usage, newBadges })

      // ── 5. Send extras (visual direction + music) ────────────────
      // Hook scoring is handled by the frontend to keep edge function lean
      const extras = await extrasPromise
      if (extras) await send({ type: 'extras', data: extras })

    } catch (err) {
      await send({ type: 'error', message: err.message || 'Generation failed' })
    }

    await writer.close()
  })()

  return new Response(readable, {
    headers: {
      'Content-Type'               : 'text/event-stream',
      'Cache-Control'              : 'no-cache',
      'Access-Control-Allow-Origin': '*',
    },
  })
}
