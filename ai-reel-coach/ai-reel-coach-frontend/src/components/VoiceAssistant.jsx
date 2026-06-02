import { useState, useRef } from 'react'
import { useLang } from '../i18n.jsx'
import { api } from '../api'

// Language codes for Web Speech API
// en → en-IN so browsers serve an Indian-English voice by default
const LANG_CODES = {
  en:       'en-IN',
  es:       'es-ES',
  fr:       'fr-FR',
  pt:       'pt-BR',
  de:       'de-DE',
  ar:       'ar-SA',
  id:       'id-ID',
  ja:       'ja-JP',
  ko:       'ko-KR',
  hi:       'hi-IN',
}


// ─── Split text into sentence-sized chunks ────────────────────────
// Google TTS handles up to ~190 chars per request reliably.
function chunkText(text, maxLen = 190) {
  const sentences = text
    .replace(/([.!?।\n]+)\s*/g, '$1|||')
    .split('|||')
    .map(s => s.trim())
    .filter(s => s.length > 0)

  const chunks = []
  for (const sentence of sentences) {
    if (sentence.length <= maxLen) {
      chunks.push(sentence)
    } else {
      const parts = sentence.split(/[,;]\s*/)
      let current = ''
      for (const part of parts) {
        if (current && (current + ', ' + part).length > maxLen) {
          chunks.push(current.trim())
          current = part
        } else {
          current = current ? current + ', ' + part : part
        }
      }
      if (current.trim()) chunks.push(current.trim())
    }
  }
  return chunks.filter(c => c.length > 0)
}

// ─── Text-to-Speech ───────────────────────────────────────────────
// Primary:  backend /api/tts  →  Google Neural2 (real Indian voice, consistent
//           across Chrome / Edge / Safari / iPhone — sounds the same everywhere)
// Fallback: Web Speech API    →  OS voice (works offline / if key not set)
export function useTextToSpeech() {
  const { lang }                = useLang()
  const [speaking, setSpeaking] = useState(false)
  const cancelRef               = useRef(false)
  const audioRef                = useRef(null)
  const chunksRef               = useRef([])
  const idxRef                  = useRef(0)

  // ── Stop whatever is currently playing ──────────────────────────
  const stopAll = () => {
    cancelRef.current = true
    if (audioRef.current) {
      audioRef.current.onended = null
      audioRef.current.onerror = null
      audioRef.current.pause()
      if (audioRef.current._blobUrl) URL.revokeObjectURL(audioRef.current._blobUrl)
      audioRef.current = null
    }
    if ('speechSynthesis' in window) window.speechSynthesis.cancel()
  }

  // ── Web Speech API fallback (chunked queue) ──────────────────────
  const wsFallback = (langCode) => {
    if (!('speechSynthesis' in window)) { setSpeaking(false); return }
    if (cancelRef.current || idxRef.current >= chunksRef.current.length) {
      setSpeaking(false); return
    }
    const utt   = new SpeechSynthesisUtterance(chunksRef.current[idxRef.current])
    const voices = window.speechSynthesis.getVoices()
    const voice  = voices.find(v => v.lang === langCode)
               || voices.find(v => v.lang.startsWith(langCode.split('-')[0]))
    if (voice) { utt.voice = voice; utt.lang = voice.lang }
    else        { utt.lang = langCode.startsWith('hi') ? 'hi-IN' : 'en-US' }
    utt.rate = 1.05; utt.pitch = 1.0; utt.volume = 1.0
    utt.onend   = () => { if (!cancelRef.current) { idxRef.current++; wsFallback(langCode) } }
    utt.onerror = (e) => {
      if (e.error === 'interrupted' || e.error === 'canceled') return
      if (!cancelRef.current) { idxRef.current++; wsFallback(langCode) }
    }
    window.speechSynthesis.speak(utt)
  }

  // ── Google Neural TTS via backend (primary path) ─────────────────
  const playBackend = async (text, langCode) => {
    const resp = await api.tts(text, langCode)
    if (!resp.ok) throw new Error(await resp.text())
    const blob    = await resp.blob()
    const blobUrl = URL.createObjectURL(blob)
    const audio   = new Audio(blobUrl)
    audio._blobUrl     = blobUrl
    audioRef.current   = audio
    audio.onended = () => { URL.revokeObjectURL(blobUrl); setSpeaking(false) }
    audio.onerror = () => { URL.revokeObjectURL(blobUrl); setSpeaking(false) }
    await audio.play()
  }

  const speak = async (text) => {
    if (!text?.trim()) return
    stopAll()
    cancelRef.current = false

    const langCode = LANG_CODES[lang] || 'en-IN'
    setSpeaking(true)

    try {
      // Try ElevenLabs Neural TTS via backend — best quality, consistent on all devices
      await playBackend(text, langCode)
    } catch (err) {
      console.warn('[TTS] Backend failed, falling back to Web Speech:', err?.message)
      // Backend not configured or offline — fall back to Web Speech API
      const chunks = chunkText(text)
      if (!chunks.length) { setSpeaking(false); return }
      chunksRef.current = chunks
      idxRef.current    = 0
      if (!('speechSynthesis' in window)) { setSpeaking(false); return }
      window.speechSynthesis.cancel()
      // Speak synchronously to satisfy desktop Chrome's gesture requirement
      if (!window.speechSynthesis.getVoices().length) {
        window.speechSynthesis.addEventListener(
          'voiceschanged',
          () => { if (!cancelRef.current) wsFallback(langCode) },
          { once: true }
        )
      } else {
        wsFallback(langCode)
      }
    }
  }

  const stopSpeaking = () => { stopAll(); setSpeaking(false) }

  return { speaking, speak, stopSpeaking }
}

// ─── Speech to Text ───────────────────────────────────────────────
// Desktop: continuous:true so Chrome never hard-cuts mid-sentence.
// Mobile:  continuous:false — mobile browsers don't support continuous
//          reliably; each utterance auto-submits on silence.
const isMobile  = () => /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
const SILENCE_MS        = 2500   // desktop — wait longer before auto-submit
const SILENCE_MS_MOBILE = 1500   // mobile  — submit faster after speech ends

export function useSpeechToText(onResult, langOverride, onInterim) {
  const { lang: globalLang } = useLang()
  const [listening, setListening]     = useState(false)
  const [interimText, setInterimText] = useState('')
  const recognitionRef  = useRef(null)
  const finalRef        = useRef('')
  const lastLiveRef     = useRef('')   // fallback: last interim text seen (iOS never finalises)
  const stoppedRef      = useRef(false)
  const flushedRef      = useRef(false)
  const silenceTimer    = useRef(null)
  const SR_ref          = useRef(null)
  const langRef         = useRef('en-IN')
  const onResultRef     = useRef(onResult)
  const onInterimRef    = useRef(onInterim)
  // Track highest result index already committed — prevents Chrome from
  // re-delivering old final results (e.resultIndex can be 0 for old items)
  const lastFinalIdxRef = useRef(-1)
  onResultRef.current   = onResult
  onInterimRef.current  = onInterim

  const clearSilenceTimer = () => {
    if (silenceTimer.current) { clearTimeout(silenceTimer.current); silenceTimer.current = null }
  }

  const flush = () => {
    if (flushedRef.current) return
    flushedRef.current = true
    clearSilenceTimer()
    stoppedRef.current = true
    try { recognitionRef.current?.stop() } catch {}
    setListening(false)
    setInterimText('')
    // Use final result if available; fall back to last interim text.
    // iOS Safari often never fires isFinal:true — without this fallback the
    // transcript is silently discarded and form.topic stays empty.
    const text = (finalRef.current || lastLiveRef.current).trim()
    finalRef.current  = ''
    lastLiveRef.current = ''
    // Always clear the interim preview so the connected input is never left locked
    if (onInterimRef.current) onInterimRef.current('')
    if (text) onResultRef.current(text)
  }

  const armSilenceTimer = () => {
    clearSilenceTimer()
    const ms = isMobile() ? SILENCE_MS_MOBILE : SILENCE_MS
    silenceTimer.current = setTimeout(flush, ms)
  }

  const startSession = () => {
    if (stoppedRef.current || !SR_ref.current) return
    // Reset per-session index so each new recognition instance starts clean
    lastFinalIdxRef.current = -1

    const mobile = isMobile()
    const recognition           = new SR_ref.current()
    recognition.lang            = langRef.current
    recognition.interimResults  = true
    recognition.maxAlternatives = 1
    recognition.continuous      = !mobile  // mobile browsers don't support continuous reliably

    recognition.onresult = (e) => {
      let interim = '', newFinal = ''

      for (let i = e.resultIndex; i < e.results.length; i++) {
        if (e.results[i].isFinal) {
          // FIX 1: Only process a final result if its index is strictly newer
          // than the last one we committed. Chrome sometimes fires resultIndex=0
          // for events that include already-finalized earlier results.
          if (i > lastFinalIdxRef.current) {
            newFinal += e.results[i][0].transcript
            lastFinalIdxRef.current = i
          }
        } else {
          interim += e.results[i][0].transcript
        }
      }

      if (newFinal) {
        const trimmed  = newFinal.trim()
        const existing = finalRef.current
        // FIX 2: Cross-session guard — Chrome sometimes replays the last phrase
        // when a session restarts. Skip if it's identical to what we just appended.
        if (trimmed && !existing.endsWith(trimmed)) {
          finalRef.current = (existing + (existing ? ' ' : '') + trimmed).trim()
        }
      }

      // Reset timer on ANY speech activity
      if (newFinal || interim) armSilenceTimer()
      const live = (finalRef.current + (interim ? ' ' + interim : '')).trim()
      if (live) lastLiveRef.current = live   // keep latest for flush() fallback
      setInterimText(live)
      // Live-update the connected input field so user sees their speech in real-time
      if (onInterimRef.current) onInterimRef.current(live || interim)
    }

    recognition.onend = () => {
      if (stoppedRef.current) { flush(); return }
      if (mobile) {
        // On mobile, onend fires after each utterance — flush immediately
        flush()
      } else {
        // Desktop: Chrome timed out (~60s) — restart, silence timer still running
        setTimeout(startSession, 80)
      }
    }

    recognition.onerror = (e) => {
      // Permission denied — hard stop, show guidance
      if (e.error === 'not-allowed' || e.error === 'service-not-allowed') {
        alert('Microphone access denied. Please allow microphone permission in your browser settings and try again.')
        stoppedRef.current = true
        setListening(false); setInterimText('')
        clearSilenceTimer()
        return
      }
      // No microphone hardware
      if (e.error === 'audio-capture') {
        alert('No microphone found. Please connect a microphone and try again.')
        stoppedRef.current = true
        setListening(false); setInterimText('')
        clearSilenceTimer()
        return
      }
      // Silent errors — just ignore
      if (e.error === 'aborted' || e.error === 'interrupted') return
      // No speech detected on mobile — flush gracefully (don't restart)
      if (e.error === 'no-speech' && isMobile()) { flush(); return }
      // Desktop: restart on transient errors
      if (!stoppedRef.current) setTimeout(startSession, 200)
    }

    recognitionRef.current = recognition
    try {
      recognition.start()
    } catch (err) {
      // recognition.start() threw synchronously — reset listening state
      console.warn('[STT] recognition.start() threw:', err?.message)
      stoppedRef.current = true
      setListening(false)
      setInterimText('')
    }
  }

  const startListening = async () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      alert('Speech recognition is not supported in this browser. Try Chrome on Android or Safari on iOS 15+.')
      return
    }

    // Desktop only: ensure mic permission before starting SpeechRecognition.
    // Fast path: if permission already granted, skip getUserMedia entirely (no delay).
    // Slow path: only call getUserMedia when permission hasn't been granted yet.
    if (!isMobile()) {
      try {
        const perm = await navigator.permissions.query({ name: 'microphone' })
        if (perm.state !== 'granted') {
          // First time / permission revoked — request it now
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(t => t.stop())
        }
        // else: already granted — skip getUserMedia, start instantly
      } catch {
        // permissions API not supported — fall back to getUserMedia check
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
          stream.getTracks().forEach(t => t.stop())
        } catch {
          alert('Microphone access denied. Please allow mic in browser settings.')
          return
        }
      }
    }

    try { recognitionRef.current?.abort() } catch {}
    clearSilenceTimer()

    const activeLang   = langOverride || globalLang
    SR_ref.current     = SR
    langRef.current    = LANG_CODES[activeLang] || 'en-IN'
    finalRef.current    = ''
    lastLiveRef.current = ''
    stoppedRef.current  = false
    flushedRef.current  = false
    setListening(true)
    setInterimText('')
    startSession()
  }

  const stopListening = flush

  return { listening, interimText, startListening, stopListening }
}

// ─── Mic Button ───────────────────────────────────────────────────
// lang prop: optional BCP-47 short code ('hi', 'en', 'es' …)
//   If provided it overrides the global app UI language for speech recognition.
// onInterim: optional callback(text) fired on every interim transcript update
//   so the parent can show live text inside its own input (no floating text).
export function MicButton({ onResult, onInterim, lang: langProp, style = {} }) {
  const { t } = useLang()
  const { listening, interimText, startListening, stopListening } = useSpeechToText(onResult, langProp, onInterim)

  return (
    <button
      type="button"
      onClick={listening ? stopListening : startListening}
      title={listening
        ? (interimText || t('voice_listening'))
        : t('voice_speak')}
      style={{
        width: 44, height: 44, borderRadius: '50%',
        border: listening ? '2px solid var(--accent)' : '1px solid var(--border)',
        background: listening ? 'var(--accent-dim)' : 'var(--surface2)',
        color: listening ? 'var(--accent)' : 'var(--text-muted)',
        cursor: 'pointer',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontSize: 18,
        flexShrink: 0,
        touchAction: 'manipulation',   // removes 300ms tap-delay on iOS
        WebkitTapHighlightColor: 'transparent',
        animation: listening ? 'pulseGlow 1s ease infinite' : 'none',
        transition: 'all 0.2s',
        ...style,
      }}
    >
      {listening ? '⏹' : '🎙'}
    </button>
  )
}

// ─── Speaker Button ───────────────────────────────────────────────
export function SpeakButton({ text, style = {} }) {
  const { speaking, speak, stopSpeaking } = useTextToSpeech()
  if (!text) return null
  return (
    <button
      type="button"
      onClick={speaking ? stopSpeaking : () => speak(text)}
      title={speaking ? 'Stop' : 'Read aloud'}
      style={{
        padding: '6px 14px', borderRadius: 8,
        border: '1px solid var(--border)',
        background: speaking ? 'var(--accent-dim)' : 'var(--surface2)',
        color: speaking ? 'var(--accent)' : 'var(--text-muted)',
        cursor: 'pointer', fontSize: '0.8rem',
        display: 'flex', alignItems: 'center', gap: 6,
        transition: 'all 0.2s',
        ...style,
      }}
    >
      {speaking ? '⏹ Stop' : '🔊 Read Aloud'}
    </button>
  )
}
