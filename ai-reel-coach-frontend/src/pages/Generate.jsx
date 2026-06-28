import { useState, useEffect, useRef } from 'react'
import { useLocation, Link, useNavigate } from 'react-router-dom'
import { api } from '../api'
import { useToast } from '../components/Toast'
import { useLang } from '../i18n.jsx'
import { MicButton, SpeakButton } from '../components/VoiceAssistant'
import { usePrefs } from '../hooks/usePrefs'
import { usePersistentState, setPersistentState } from '../hooks/usePersistentState'

import { detectAndSaveRegion, getSavedRegion, saveRegion, REGIONS } from '../utils/detectRegion'
import { buildCanonicalSections, copyCanonicalScript } from '../utils/scriptFormat'

const REFINE_CHIPS = [
  { label: '🔥 Stronger hook',       instruction: 'Make the hook much more scroll-stopping with higher emotional intensity and specificity.' },
  { label: '✂️ Make it shorter',     instruction: 'Make the entire script more concise ,  cut 30% of the words while keeping all the value.' },
  { label: '😂 Add humour',          instruction: 'Add clever humour and wit throughout ,  make it more entertaining and fun to watch.' },
  { label: '🎯 More specific',       instruction: 'Replace vague statements with concrete numbers, specific examples, and real details.' },
  { label: '😱 More FOMO',          instruction: 'Amplify fear of missing out ,  make the viewer feel they CANNOT afford to skip this.' },
  { label: '🇮🇳 More Indian feel',   instruction: 'Add more Indian cultural references, examples, and context relevant to Indian audiences.' },
  { label: '💡 Better CTA',         instruction: 'Rewrite the call-to-action to be more compelling, specific, and urgent.' },
  { label: '📖 More storytelling',  instruction: 'Reframe using personal story structure ,  make it feel more human and relatable.' },
]


const TONES  = ['motivational', 'educational', 'funny', 'storytelling', 'controversial', 'conversational']

const SCRIPT_LANGS = [
  { value: 'en', label: 'English' },
  { value: 'hi', label: 'Hindi' },
  { value: 'es', label: 'Spanish' },
  { value: 'fr', label: 'French' },
  { value: 'pt', label: 'Portuguese' },
  { value: 'de', label: 'German' },
  { value: 'ar', label: 'Arabic' },
  { value: 'id', label: 'Bahasa' },
  { value: 'ja', label: 'Japanese' },
  { value: 'ko', label: 'Korean' },
]

const SCRIPT_LANG_KEY = 'arc_script_lang'
const getSavedScriptLang = () => localStorage.getItem(SCRIPT_LANG_KEY) || 'en'


export default function Generate() {
  const toast      = useToast()
  const { t, lang } = useLang()
  const location   = useLocation()
  const navigate   = useNavigate()
  const resultRef  = useRef(null)

  const [form, setForm] = usePersistentState('arc_gen_form', {
    topic:      '',
    tone:       'motivational',
    duration:   '',
    audience:   getSavedRegion(),     // blank until detected or set by user
    scriptLang: getSavedScriptLang(), // script language ,  independent of app UI language
  })

  // Auto-detect region on first visit (runs once, only if nothing saved)
  useEffect(() => {
    if (!getSavedRegion()) {
      detectAndSaveRegion().then(region => {
        if (region) setForm(f => ({ ...f, audience: region }))
      })
    }
  }, [])
  const [loading, setLd]            = useState(false)
  const [streaming, setStreaming]   = useState(false)
  const [streamText, setStreamText] = useState('')
  const [result, setResult]         = usePersistentState('arc_gen_result', null)
  // Ref always points to latest result — prevents stale closures in async handlers
  const latestResultRef = useRef(null)
  const [copied, setCopied]         = useState(false)
  const [micInterim, setMicInterim] = useState('')
  const [voiceProfile, setVoiceProfile] = useState(null)

  // Inline hook improvement
  const [hookImproving, setHookImproving]   = useState(false)
  const [hookSuggestion, setHookSuggestion] = useState(null)
  const [hookAccepting, setHookAccepting]   = useState(false)

  // Load voice profile on mount ,  shows indicator when active
  useEffect(() => {
    api.getVoiceProfile()
      .then(data => { if (data.profile) setVoiceProfile(data.profile) })
      .catch(() => {})
  }, [])

  // Song recommendations state
  const [songs, setSongs]               = useState(null)
  const [songsLoading, setSongsLoading] = useState(false)
  const [playingKey, setPlayingKey]     = useState(null)
  const [audioProgress, setAudioProgress] = useState(0)
  const audioRef      = useRef(null)
  const progressRef   = useRef(null)

  const stopAudio = () => {
    if (audioRef.current) { audioRef.current.pause(); audioRef.current = null }
    if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null }
    setPlayingKey(null)
    setAudioProgress(0)
  }

  // Cleanup on unmount
  useEffect(() => () => stopAudio(), []) // eslint-disable-line react-hooks/exhaustive-deps

  const togglePlay = (song) => {
    const key = song.title + song.artist
    if (playingKey === key) { stopAudio(); return }
    stopAudio()
    if (!song.previewUrl) return
    const audio = new Audio(song.previewUrl)
    audio.play().catch(() => {})
    audioRef.current = audio
    setPlayingKey(key)
    setAudioProgress(0)
    audio.onended = () => {
      setPlayingKey(null)
      setAudioProgress(0)
      if (progressRef.current) { clearInterval(progressRef.current); progressRef.current = null }
    }
    progressRef.current = setInterval(() => {
      if (!audioRef.current) return
      const pct = (audioRef.current.currentTime / (audioRef.current.duration || 30)) * 100
      setAudioProgress(isNaN(pct) ? 0 : pct)
    }, 150)
  }

  // Refinement / re-roll state
  const [versions, setVersions]       = usePersistentState('arc_gen_versions', [])
  const [activeVer, setActiveVer]     = usePersistentState('arc_gen_activeVer', 0)
  const [refining, setRefining]       = useState(false)
  const [rerolling, setRerolling]     = useState(false)
  const [customRefinement, setCustomRefinement] = useState('')
  const [rerollCount, setRerollCount] = usePersistentState('arc_gen_rerolls', 0)   // free retakes used (max 5 per topic)
  const MAX_RETAKES = 5
  const refineRef    = useRef(null)
  const prevLangRef  = useRef(lang)
  // Ref always tracks latest versions array — avoids stale closures
  const latestVersionsRef = useRef([])

  // ── Regenerate script in a specific language ──────────────────────
  const regenerateInLang = async (newLang, currentForm) => {
    if (!currentForm.topic.trim()) return
    setLd(true)
    setStreaming(false)
    setStreamText('')
    setResult(null)
    setVersions([])
    setActiveVer(0)
    setRerollCount(0)
    try {
      const voiceInstruction = voiceProfile?.promptInstruction || undefined
      const data = await api.generate({ ...currentForm, language: newLang, voiceInstruction })
      setResult(data)
      setVersions([{ ...data.script, label: 'v1 · Original' }])
    } catch (err) {
      toast(err.message || 'Could not regenerate in new language', 'error')
    } finally {
      setLd(false)
    }
  }

  // ── Sync script language when app UI language changes ────────────
  useEffect(() => {
    if (prevLangRef.current === lang) return  // skip on mount
    const hadResult = !!result
    const currentTopic = form.topic
    prevLangRef.current = lang

    // Always keep script-language dropdown in sync with app language
    setForm(f => ({ ...f, scriptLang: lang }))
    localStorage.setItem(SCRIPT_LANG_KEY, lang)

    // If a script is already showing, immediately regenerate in new language
    if (hadResult && currentTopic.trim()) {
      regenerateInLang(lang, { ...form, scriptLang: lang })
    }
  }, [lang])  // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const stateTopic = location.state?.topic
    if (stateTopic) {
      setForm(f => ({
        ...f,
        topic:      stateTopic,
        tone:       location.state?.tone       || f.tone,
        scriptLang: location.state?.language   || f.scriptLang,
      }))
      setResult(null)
      setVersions([])
      setActiveVer(0)
      window.history.replaceState({}, document.title)
    } else {
      const stored = localStorage.getItem('arc_prefill_topic')
      if (stored) {
        setForm(f => ({ ...f, topic: stored }))
        setResult(null)
        setVersions([])
        setActiveVer(0)
        localStorage.removeItem('arc_prefill_topic')
      }
    }
  }, [location.state])

  // Keep latestResultRef and latestVersionsRef in sync on every render
  latestResultRef.current     = result
  latestVersionsRef.current   = versions

  // Auto-scroll to result when it arrives
  useEffect(() => {
    if (result && resultRef.current) {
      setTimeout(() => {
        resultRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    }
  }, [result])

  const set = k => e => setForm(f => ({ ...f, [k]: e.target.value }))

  const submit = async e => {
    e.preventDefault()
    if (!form.topic.trim()) { toast('Please enter a topic', 'error'); return }

    setLd(true)
    setStreaming(false)
    setStreamText('')
    setResult(null)
    setVersions([])
    setActiveVer(0)
    setRerollCount(0)
    stopAudio(); setSongs(null)

    saveRegion(form.audience)
    localStorage.setItem(SCRIPT_LANG_KEY, form.scriptLang)

    const voiceInstruction = voiceProfile?.promptInstruction || undefined

    // Try Vercel Edge streaming first, fall back to regular on any failure
    let useStream = true
    let res
    try {
      res = await api.generateStream({ ...form, language: form.scriptLang, voiceInstruction })
      if (!res.ok || !res.body) useStream = false
    } catch {
      useStream = false
    }

    if (!useStream) {
      try {
        const data = await api.generate({ ...form, language: form.scriptLang })
        setResult(data)
        setVersions([{ ...data.script, label: 'v1 · Original' }])
        setActiveVer(0)
      } catch (err) {
        toast(err.message, 'error')
      } finally {
        setLd(false)
      }
      return
    }

    // Streaming path
    setLd(false)
    setStreaming(true)

    try {
      const reader  = res.body.getReader()
      const decoder = new TextDecoder()
      let   buffer  = ''

      while (true) {
        const { done, value } = await reader.read()
        if (done) break

        buffer += decoder.decode(value, { stream: true })
        const parts = buffer.split('\n\n')
        buffer = parts.pop()

        for (const part of parts) {
          const line = part.trim()
          if (!line.startsWith('data:')) continue
          try {
            const event = JSON.parse(line.slice(5).trim())
            if (event.type === 'chunk') {
              setStreamText(prev => prev + event.text)
            } else if (event.type === 'script') {
              setStreaming(false)
              setResult({ script: event.data, usage: event.usage, newBadges: event.newBadges })
              if (event.newStreak !== undefined) {
                window.dispatchEvent(new CustomEvent('streak-updated', { detail: event.newStreak }))
              }
              setVersions([{ ...event.data, label: 'v1 · Original' }])
              setActiveVer(0)
            } else if (event.type === 'extras') {
              const visual = event.data?.visual || null
              const music  = event.data?.music  || null
              setResult(prev => prev ? {
                ...prev,
                script: { ...prev.script, visual, music },
              } : prev)
              // Also backfill visual/music onto versions[0] so retakes can inherit them
              setVersions(prev => {
                if (!prev || prev.length === 0) return prev
                const updated = [...prev]
                updated[updated.length - 1] = { ...updated[updated.length - 1], visual, music }
                return updated
              })
            } else if (event.type === 'error') {
              throw new Error(event.message)
            }
          } catch (parseErr) {
            if (parseErr.message && parseErr.message !== 'Unexpected end of JSON input') {
              throw parseErr
            }
          }
        }
      }
    } catch (err) {
      toast(err.message, 'error')
      setStreaming(false)
      setLd(false)
    }
  }

  // Re-roll — fresh script on same topic, FREE, capped at MAX_RETAKES per topic
  const reroll = async () => {
    if (!form.topic.trim()) return
    if (rerollCount >= MAX_RETAKES) {
      toast(`You've used all ${MAX_RETAKES} free retakes for this topic. Start a new topic to continue.`, 'error')
      return
    }
    setRerolling(true)
    try {
      const data = await api.retakeScript({ ...form, language: form.scriptLang })
      // Read visual/music from the ref (never stale) so they survive re-renders
      const currentResult   = latestResultRef.current
      const currentVersions = latestVersionsRef.current
      const inheritedVisual = currentResult?.script?.visual || currentVersions?.[currentVersions.length - 1]?.visual || null
      const inheritedMusic  = currentResult?.script?.music  || currentVersions?.[currentVersions.length - 1]?.music  || null
      const n = currentVersions.length + 1
      const newVer = {
        ...data.script,
        label : `Take ${n}`,
        visual: inheritedVisual,
        music : inheritedMusic,
      }
      setVersions(prev => [newVer, ...prev])
      setActiveVer(0)
      setResult(prev => ({ ...prev, script: newVer }))
      setRerollCount(c => c + 1)
      setTimeout(() => refineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setRerolling(false)
    }
  }

  // Refine — targeted chip tweak, no quota cost
  const refine = async (instruction) => {
    if (!instruction || !result?.script) return
    setRefining(true)
    try {
      const currentResult   = latestResultRef.current
      const currentVersions = latestVersionsRef.current
      const current = currentVersions[activeVer] || currentResult?.script
      const data = await api.refineScript({
        hook       : current.hook,
        body       : current.body,
        cta        : current.cta,
        instruction,
        language   : form.scriptLang,
        audience   : form.audience,
        topic      : form.topic,
      })
      const chipLabel = instruction.length > 30 ? instruction.slice(0, 30) + '…' : instruction
      // Inherit visual/music from the current version (never stale via ref)
      const inheritedVisual = current?.visual || currentResult?.script?.visual || null
      const inheritedMusic  = current?.music  || currentResult?.script?.music  || null
      const newVer = {
        ...data.script,
        label : `Take ${currentVersions.length + 1} · ${chipLabel}`,
        visual: inheritedVisual,
        music : inheritedMusic,
      }
      setVersions(prev => [newVer, ...prev])
      setActiveVer(0)
      setResult(prev => ({ ...prev, script: newVer }))
      setTimeout(() => refineRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setRefining(false)
    }
  }

  const switchVersion = (idx) => {
    setActiveVer(idx)
    setResult(prev => ({ ...prev, script: versions[idx] }))
  }

  const fetchSongs = async () => {
    if (!result?.script) return
    stopAudio()
    setSongsLoading(true)
    setSongs(null)
    try {
      const s = result.script
      const data = await api.recommendSongs({
        hook    : s.hook,
        body    : s.body,
        cta     : s.cta,
        topic   : form.topic,
        tone    : form.tone,
        genre   : s.music?.genre,
        mood    : s.music?.mood,
        bpm     : s.music?.bpm,
        audience: form.audience,
        language: form.scriptLang,
      })

      // Enrich each song with a 30-second iTunes preview URL + artwork
      const country = form.audience === 'India' ? 'in' : 'us'
      const enriched = await Promise.all(
        (data.songs || []).map(async song => {
          try {
            const r = await fetch(
              `https://itunes.apple.com/search?term=${encodeURIComponent(song.title + ' ' + song.artist)}&entity=song&limit=1&country=${country}`
            )
            const d = await r.json()
            const hit = d.results?.[0]
            return {
              ...song,
              // Prefer Spotify data from backend; fall back to iTunes
              previewUrl : song.previewUrl || hit?.previewUrl || null,
              artworkUrl : song.albumArt   || hit?.artworkUrl60?.replace('60x60', '100x100') || null,
            }
          } catch {
            return { ...song, previewUrl: song.previewUrl || null, artworkUrl: song.albumArt || null }
          }
        })
      )
      setSongs(enriched)
    } catch (err) {
      toast(err.message || 'Could not fetch song picks', 'error')
    } finally {
      setSongsLoading(false)
    }
  }

  const copyScript = () => {
    if (!result?.script) return
    copyCanonicalScript(result.script, t)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
    toast('Copied!', 'success')
  }

  const improveHook = async () => {
    if (!result?.script?.id || hookImproving) return
    setHookImproving(true)
    setHookSuggestion(null)
    try {
      const data = await api.rewriteHook({
        scriptId    : result.script.id,
        originalHook: result.script.hook,
        language    : form.scriptLang,
      })
      setHookSuggestion(data.rewrite)
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setHookImproving(false)
    }
  }

  const acceptHookImprovement = async () => {
    if (!hookSuggestion?.id || hookAccepting) return
    setHookAccepting(true)
    try {
      await api.acceptRewrite({ rewriteId: hookSuggestion.id })
      const newHook = hookSuggestion.rewrittenHook
      setResult(prev => prev ? { ...prev, script: { ...prev.script, hook: newHook } } : prev)
      setVersions(prev => prev.map((v, i) => i === 0 ? { ...v, hook: newHook } : v))
      setHookSuggestion(null)
      toast('Hook updated!', 'success')
    } catch (err) {
      toast(err.message, 'error')
    } finally {
      setHookAccepting(false)
    }
  }

  return (
    <div className="page-enter" style={{ maxWidth: 720, margin: '0 auto' }}>
      {/* Header */}
      <div style={{ marginBottom: 32 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 12 }}>
          <h1 className="page-title" style={{ marginBottom: 0 }}>{t('generate_title')}</h1>
          <Link to="/scripts" style={{ fontSize: '0.8rem', color: 'var(--text-faint)', textDecoration: 'none', whiteSpace: 'nowrap', flexShrink: 0 }}>
            {t('generate_view_history')}
          </Link>
        </div>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginTop: 6 }}>
          {t('generate_speak')}
        </p>
      </div>

      {/* Form Card */}
      <div className="card" style={{ marginBottom: 24 }}>
        <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>

          {/* Topic ,  most important field, big and prominent */}
          <div className="field">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 2 }}>
              <label style={{ fontSize: '0.8rem', fontWeight: 600, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                {t('generate_topic_label')}
              </label>
              <span style={{
                fontSize: '0.72rem',
                fontFamily: 'var(--font-mono)',
                color: form.topic.length > 900 ? '#FF6B6B' : form.topic.length > 700 ? 'var(--yellow)' : 'var(--text-faint)',
                transition: 'color 0.2s',
              }}>
                {form.topic.length}/1000
              </span>
            </div>
            {/* Language select */}
            <div style={{ marginBottom: 8 }}>
              <select
                value={form.scriptLang}
                onChange={set('scriptLang')}
                title="Script language"
                className="select"
                style={{ width: 140, fontSize: '0.82rem', height: 34 }}
              >
                {SCRIPT_LANGS.map(l => (
                  <option key={l.value} value={l.value}>{l.label}</option>
                ))}
              </select>
            </div>

            {/* Textarea + mic side by side ,  mic stays small, textarea gets full width */}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
              <textarea
                className="textarea"
                placeholder="e.g. How I grew from 0 to 10k followers in 90 days"
                value={micInterim || form.topic}
                onChange={e => {
                  // Typing always clears interim + updates form ,  never blocked
                  setMicInterim('')
                  setForm(f => ({ ...f, topic: e.target.value }))
                }}
                rows={3}
                required
                maxLength={1000}
                style={{
                  flex: 1, minWidth: 0, resize: 'vertical', fontSize: '1rem',
                  opacity: micInterim ? 0.75 : 1,
                  fontStyle: micInterim ? 'italic' : 'normal',
                  transition: 'opacity 0.15s, font-style 0s',
                }}
              />
              <MicButton
                onResult={text => setForm(f => ({ ...f, topic: text.slice(0, 1000) }))}
                onInterim={text => setMicInterim(text.slice(0, 1000))}
                lang={form.scriptLang}
                style={{ marginTop: 4 }}
              />
            </div>
          </div>

          {/* Row 1 ,  Tone + Duration */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="field">
              <label style={fieldLabelStyle}>Tone</label>
              <select className="select" value={form.tone} onChange={set('tone')}>
                {TONES.map(tone => <option key={tone} value={tone}>{tone.charAt(0).toUpperCase() + tone.slice(1)}</option>)}
              </select>
            </div>
            <div className="field">
              <label style={fieldLabelStyle}>Duration (min)</label>
              <input
                type="text"
                className="input"
                placeholder="e.g. 2.5"
                value={form.duration}
                onChange={e => {
                  const val = e.target.value.replace(/[^0-9.]/g, '').replace(/(\..*)\./g, '$1')
                  setForm(f => ({ ...f, duration: val }))
                }}
                maxLength={5}
                style={{ width: '100%' }}
              />
            </div>
          </div>

          {/* Row 2 ,  Target Region (full width) */}
          <div className="field">
            <label style={{ ...fieldLabelStyle, display: 'flex', alignItems: 'center', gap: 6 }}>
              Target Region
              {form.audience && (
                <span style={{ fontSize: '0.62rem', fontFamily: 'var(--font-mono)', color: 'var(--accent)', background: 'var(--accent-dim)', padding: '1px 6px', borderRadius: 99, textTransform: 'none', letterSpacing: 0, fontWeight: 500 }}>
                  📍 auto
                </span>
              )}
            </label>
            <select className="select" value={form.audience} onChange={set('audience')}>
              <option value="">,  Select region , </option>
              {REGIONS.map(r => <option key={r.value} value={r.value}>{r.label}</option>)}
            </select>
          </div>

          {/* Voice profile active indicator */}
          {voiceProfile && (
            <div style={{
              display: 'flex', alignItems: 'center', gap: 10,
              padding: '9px 14px', borderRadius: 10,
              background: 'linear-gradient(135deg, rgba(0,200,255,0.07), rgba(160,110,255,0.07))',
              border: '1px solid rgba(0,200,255,0.2)',
            }}>
              <span style={{ fontSize: '1rem', flexShrink: 0 }}>🎙</span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <span style={{ fontSize: '0.72rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00C8FF' }}>
                  ✦ Writing with your Creator DNA
                </span>
                <p style={{ fontSize: '0.78rem', color: 'var(--text-muted)', margin: '2px 0 0', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                  {voiceProfile.summary}
                </p>
              </div>
              <a href="/creator-dna" style={{ fontSize: '0.72rem', color: 'var(--text-faint)', textDecoration: 'none', flexShrink: 0, fontFamily: 'var(--font-mono)' }}>
                edit →
              </a>
            </div>
          )}

          {/* Button area ,  transforms once a result exists */}
          {!result ? (
            <button
              type="submit"
              className="btn btn-primary btn-full"
              disabled={loading}
              style={{ height: 52, fontSize: '1rem', fontWeight: 700, letterSpacing: '0.02em' }}
            >
              {loading
                ? <><span className="spinner" /> {t('generate_writing')}</>
                : `✦ ${t('generate_btn')}`}
            </button>
          ) : (
            <div style={{ display: 'flex', gap: 10 }}>
              {/* Primary: try another take on current settings */}
              <button
                type="button"
                onClick={reroll}
                disabled={rerolling || refining || rerollCount >= MAX_RETAKES}
                className="btn btn-primary"
                style={{ flex: 1, height: 52, fontSize: '0.95rem', fontWeight: 700 }}
              >
                {rerolling
                  ? <><span className="spinner" /> Generating…</>
                  : rerollCount >= MAX_RETAKES
                    ? '↺ No retakes left'
                    : <>↺ Try another take</>}
              </button>
              {/* Secondary: clear and start a new topic */}
              <button
                type="button"
                onClick={() => { setResult(null); setVersions([]); setActiveVer(0); setRerollCount(0); setForm({ topic: '', tone: 'motivational', audience: getSavedRegion(), scriptLang: getSavedScriptLang() }); window.scrollTo({ top: 0, behavior: 'smooth' }) }}
                className="btn btn-ghost"
                style={{ height: 52, paddingInline: 20, fontSize: '0.9rem', whiteSpace: 'nowrap' }}
              >
                New topic
              </button>
            </div>
          )}
        </form>
      </div>

      {/* Initial loading ,  waiting for first chunk */}
      {loading && (
        <div className="card" style={{
          textAlign: 'center', padding: '48px 24px',
          background: 'linear-gradient(135deg, rgba(255,95,31,0.05), rgba(255,60,172,0.05))',
          border: '1px solid rgba(255,95,31,0.2)',
        }}>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 8, marginBottom: 20 }}>
            {[0, 1, 2].map(i => (
              <div key={i} style={{
                width: 10, height: 10, borderRadius: '50%',
                background: 'var(--accent)',
                animation: `pulse 1.2s ease ${i * 0.2}s infinite`,
              }} />
            ))}
          </div>
          <p style={{ fontFamily: 'var(--font-head)', fontWeight: 700, fontSize: '1.1rem', marginBottom: 8 }}>
            {t('generate_ai_writing')}
          </p>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.875rem' }}>{t('generate_crafting')}</p>
        </div>
      )}

      {/* Live streaming card */}
      {streaming && (
        <div className="card" style={{
          background: 'linear-gradient(135deg, rgba(255,95,31,0.04), rgba(160,110,255,0.04))',
          border: '1px solid rgba(160,110,255,0.2)',
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
            <div style={{ display: 'flex', gap: 5 }}>
              {[0,1,2].map(i => (
                <div key={i} style={{ width: 7, height: 7, borderRadius: '50%', background: 'var(--accent)', animation: `pulse 1s ease ${i*0.18}s infinite` }} />
              ))}
            </div>
            <span style={{ fontSize: '0.75rem', fontFamily: 'var(--font-mono)', color: 'var(--text-faint)', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
              Writing your script…
            </span>
          </div>
          <pre style={{ fontFamily: 'inherit', fontSize: '0.93rem', lineHeight: 1.75, color: 'var(--text)', whiteSpace: 'pre-wrap', wordBreak: 'break-word', margin: 0 }}>
            {streamText}
            <span style={{ display: 'inline-block', width: 2, height: '1em', background: 'var(--accent)', marginLeft: 2, verticalAlign: 'text-bottom', animation: 'cursorBlink 0.9s step-end infinite' }} />
          </pre>
        </div>
      )}

      {/* Result ,  full width, auto-scrolled to */}
      {result && (
        <div ref={resultRef} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

          {/* ── Script Card ── compact ── */}
          <div className="card" style={{ padding: '20px 22px' }}>

            {/* Card header */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18, gap: 12, flexWrap: 'wrap' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0, flex: 1 }}>
                <h2 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '1.05rem', margin: 0, whiteSpace: 'nowrap' }}>
                  {t('generate_your_script')}
                </h2>
                <span style={{
                  fontSize: '0.62rem', fontFamily: 'var(--font-mono)', fontWeight: 700,
                  padding: '2px 7px', borderRadius: 99, letterSpacing: '0.06em', whiteSpace: 'nowrap', flexShrink: 0,
                  background: 'linear-gradient(135deg, rgba(255,180,0,0.15), rgba(255,95,31,0.15))',
                  border: '1px solid rgba(255,160,0,0.3)', color: '#FFB800',
                }}>⚡ Viral</span>
                <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0 }}>
                  {form.topic}
                </span>
              </div>
              <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>
                <SpeakButton text={result.script?.fullScript} />
                <button onClick={copyScript} className="btn btn-ghost btn-sm">
                  {copied ? `✓ ${t('generate_copied')}` : t('generate_copy_all')}
                </button>
                <button
                  className="btn btn-sm"
                  style={{ background: '#E1306C', color: '#fff', border: 'none', fontWeight: 700, whiteSpace: 'nowrap' }}
                  onClick={() => {
                    const full = buildCanonicalSections(result.script, t)
                      .filter(s => ['hook', 'body', 'cta'].includes(s.id))
                      .map(s => s.text)
                      .join('\n\n')
                    setPersistentState('rc_script', full)
                    navigate('/record')
                  }}
                >
                  ● Record
                </button>
              </div>
            </div>

            {/* Hook */}
            <div style={{ marginBottom: 10, padding: '13px 16px', borderRadius: 10, background: 'rgba(0,200,255,0.05)', borderLeft: '3px solid #00C8FF' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8, gap: 8 }}>
                <span style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00C8FF' }}>
                  🎣 {t('generate_hook')} ,  {form.scriptLang === 'hi' ? 'पहले 3 सेकंड' : 'First 3 sec'}
                </span>
                {result.script?.id && (
                  <button
                    type="button"
                    onClick={improveHook}
                    disabled={hookImproving}
                    style={{
                      padding: '3px 10px', borderRadius: 20,
                      fontSize: '0.7rem', fontWeight: 700,
                      fontFamily: 'var(--font-mono)',
                      border: '1px solid rgba(0,200,255,0.3)',
                      background: 'rgba(0,200,255,0.08)',
                      color: '#00C8FF',
                      cursor: hookImproving ? 'not-allowed' : 'pointer',
                      opacity: hookImproving ? 0.55 : 1,
                      display: 'flex', alignItems: 'center', gap: 5,
                      transition: 'all 0.15s', flexShrink: 0,
                    }}
                    onMouseEnter={e => { if (!hookImproving) e.currentTarget.style.background = 'rgba(0,200,255,0.18)' }}
                    onMouseLeave={e => { e.currentTarget.style.background = 'rgba(0,200,255,0.08)' }}
                  >
                    {hookImproving
                      ? <><span className="spinner" style={{ width: 9, height: 9, borderColor: 'rgba(0,200,255,0.2)', borderTopColor: '#00C8FF' }} /> Improving…</>
                      : '⚡ Improve Hook'}
                  </button>
                )}
              </div>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text)', margin: 0 }}>{result.script.hook}</p>

              {/* Inline suggestion */}
              {hookSuggestion && (
                <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid rgba(0,200,255,0.18)' }}>
                  <div style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: 'rgba(0,200,255,0.7)', marginBottom: 8 }}>
                    ✨ Suggested rewrite
                  </div>
                  <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text)', margin: '0 0 6px', fontStyle: 'italic' }}>
                    {hookSuggestion.rewrittenHook}
                  </p>
                  {hookSuggestion.changes && (
                    <p style={{ fontSize: '0.76rem', color: 'var(--text-faint)', margin: '0 0 12px', lineHeight: 1.5 }}>
                      {hookSuggestion.changes}
                    </p>
                  )}
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button type="button" onClick={acceptHookImprovement} disabled={hookAccepting}
                      className="btn btn-primary btn-sm" style={{ fontSize: '0.78rem', height: 32, paddingInline: 14 }}>
                      {hookAccepting ? <><span className="spinner" style={{ width: 9, height: 9 }} /> Applying…</> : '✓ Use this hook'}
                    </button>
                    <button type="button" onClick={() => setHookSuggestion(null)}
                      className="btn btn-ghost btn-sm" style={{ fontSize: '0.78rem', height: 32, paddingInline: 14 }}>
                      Dismiss
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* Body */}
            <div style={{ marginBottom: 10, padding: '13px 16px', borderRadius: 10, background: 'rgba(0,201,167,0.05)', borderLeft: '3px solid #00C9A7' }}>
              <div style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#00C9A7', marginBottom: 8 }}>
                📖 {t('generate_body')} ,  {form.scriptLang === 'hi' ? 'मुख्य मूल्य' : 'Main value'}
              </div>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text)', margin: 0, whiteSpace: 'pre-line' }}>{result.script.body}</p>
            </div>

            {/* CTA */}
            <div style={{ marginBottom: 14, padding: '13px 16px', borderRadius: 10, background: 'rgba(255,214,10,0.04)', borderLeft: '3px solid #FFD60A' }}>
              <div style={{ fontSize: '0.66rem', fontFamily: 'var(--font-mono)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.1em', color: '#FFD60A', marginBottom: 8 }}>
                📣 {t('generate_cta')}
              </div>
              <p style={{ fontSize: '0.95rem', lineHeight: 1.7, color: 'var(--text)', margin: 0 }}>{result.script.cta}</p>
            </div>

            {/* Footer */}
            <div style={{ paddingTop: 12, borderTop: '1px solid var(--border)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
              <span style={{ fontSize: '0.75rem', color: 'var(--text-faint)', fontFamily: 'var(--font-mono)' }}>
                {result.usage?.used}/{result.usage?.limit} {t('generate_usage')}
              </span>
              {result.newBadges?.length > 0 && (
                <span style={{ fontSize: '0.78rem', color: 'var(--yellow)', fontWeight: 600 }}>
                  {t('generate_new_badge')}
                </span>
              )}
            </div>
          </div>
          {/* ── Visual Direction ─────────────────────────────────── */}
          {result.script?.visual && (
            <div className="card" style={{ borderLeft: '3px solid #A78BFA' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: '1.1rem' }}>🎬</span>
                <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '1rem', margin: 0 }}>Visual Direction</h3>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
                {/* Background */}
                <div>
                  <div style={visualLabelStyle}>📍 Background</div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text)', margin: 0, lineHeight: 1.6 }}>{result.script.visual.background}</p>
                </div>
                {/* Style */}
                <div>
                  <div style={visualLabelStyle}>🎥 Shooting Style</div>
                  <p style={{ fontSize: '0.9rem', color: 'var(--text)', margin: 0 }}>{result.script.visual.style}</p>
                </div>
                {/* B-roll */}
                {result.script.visual.broll?.length > 0 && (
                  <div>
                    <div style={visualLabelStyle}>🎞 B-Roll Ideas</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                      {result.script.visual.broll.map((shot, i) => (
                        <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                          <span style={{ color: '#A78BFA', fontWeight: 700, flexShrink: 0, fontFamily: 'var(--font-mono)', fontSize: '0.75rem', marginTop: 2 }}>{i + 1}.</span>
                          <span style={{ fontSize: '0.875rem', color: 'var(--text-muted)', lineHeight: 1.5 }}>{shot}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                {/* Color + Text overlay in a row */}
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                  <div>
                    <div style={visualLabelStyle}>🎨 Colour Mood</div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>{result.script.visual.colorMood}</p>
                  </div>
                  <div>
                    <div style={visualLabelStyle}>✍️ Text Overlay</div>
                    <p style={{ fontSize: '0.875rem', color: 'var(--text-muted)', margin: 0 }}>{result.script.visual.textOverlay}</p>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ── Music Vibe + Song Picks ──────────────────────────── */}
          {result.script?.music && (
            <div className="card" style={{ borderLeft: '3px solid #34D399' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
                <span style={{ fontSize: '1.1rem' }}>🎵</span>
                <h3 style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '1rem', margin: 0 }}>Music Vibe</h3>
              </div>
              {/* Search tip */}
              <div style={{ marginBottom: 14 }}>
                <div style={visualLabelStyle}>🔍 Search for</div>
                <p style={{ fontSize: '0.875rem', color: 'var(--text)', margin: '4px 0 0', fontStyle: 'italic', background: 'var(--surface2)', padding: '8px 12px', borderRadius: 8 }}>
                  "{result.script.music.searchQuery}"
                </p>
              </div>
              {/* Tip */}
              <div style={{ fontSize: '0.82rem', color: 'var(--text-muted)', lineHeight: 1.5, marginBottom: 14 }}>
                💡 {result.script.music.tip}
              </div>
              {/* Free music source links */}
              <div style={{ marginBottom: 18 }}>
                <div style={visualLabelStyle}>🆓 Free Music Sources</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                  {[
                    { name: 'Pixabay Music', url: 'https://pixabay.com/music/' },
                    { name: 'Mixkit', url: 'https://mixkit.co/free-stock-music/' },
                    { name: 'Uppbeat', url: 'https://uppbeat.io/' },
                    { name: 'YouTube Audio Library', url: 'https://studio.youtube.com/channel/audio' },
                  ].map(src => (
                    <a
                      key={src.name}
                      href={src.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      style={{
                        padding: '5px 12px', borderRadius: 20,
                        fontSize: '0.78rem', fontWeight: 600,
                        background: 'rgba(52,211,153,0.1)',
                        border: '1px solid rgba(52,211,153,0.3)',
                        color: '#34D399',
                        textDecoration: 'none',
                        transition: 'background 0.15s',
                      }}
                    >
                      {src.name} ↗
                    </a>
                  ))}
                </div>
              </div>

              {/* ── AI Song Picks ──────────────────────────────────── */}
              <div style={{ borderTop: '1px solid var(--border)', paddingTop: 18, marginTop: 4 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, gap: 10, flexWrap: 'wrap' }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-head)', fontWeight: 800, fontSize: '0.95rem', color: 'var(--text)', marginBottom: 2 }}>
                      🎧 AI Song Picks
                    </div>
                    <div style={{ fontSize: '0.75rem', color: 'var(--text-faint)' }}>
                      Curated tracks that match your script's energy &amp; vibe
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={fetchSongs}
                    disabled={songsLoading}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 7,
                      padding: '9px 18px', borderRadius: 22,
                      fontSize: '0.82rem', fontWeight: 700,
                      background: songsLoading
                        ? 'var(--surface2)'
                        : 'linear-gradient(135deg, #1DB954 0%, #17A44A 100%)',
                      color: songsLoading ? 'var(--text-muted)' : '#fff',
                      border: 'none', cursor: songsLoading ? 'default' : 'pointer',
                      transition: 'opacity 0.15s, transform 0.1s',
                      boxShadow: songsLoading ? 'none' : '0 2px 12px rgba(29,185,84,0.35)',
                      flexShrink: 0,
                    }}
                  >
                    {songsLoading
                      ? <><span className="spinner" style={{ width: 11, height: 11, borderColor: 'rgba(255,255,255,0.2)', borderTopColor: 'var(--text-muted)' }} /> Finding songs…</>
                      : songs ? '🔄 Refresh Picks' : '🎵 Get Song Picks'
                    }
                  </button>
                </div>

                {/* Song list */}
                {songs && songs.length > 0 && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                    {[
                      { label: '🔥 Popular Picks', items: songs.filter(s => !s.royaltyFree) },
                      { label: '🆓 Royalty-Free', items: songs.filter(s => s.royaltyFree) },
                    ].map(section => section.items.length > 0 && (
                      <div key={section.label}>
                        <div style={{ fontSize: '0.72rem', fontWeight: 700, color: 'var(--text-faint)', letterSpacing: '0.06em', textTransform: 'uppercase', marginBottom: 8, marginTop: 4 }}>
                          {section.label}
                        </div>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                          {section.items.map((song, i) => {
                            const key     = song.title + song.artist
                            const isPlaying = playingKey === key
                            const canPlay   = !!song.previewUrl
                            return (
                              <div key={i} style={{
                                background: isPlaying
                                  ? (song.royaltyFree ? 'rgba(29,185,84,0.10)' : 'rgba(252,175,69,0.08)')
                                  : (song.royaltyFree ? 'rgba(29,185,84,0.04)' : 'rgba(255,255,255,0.02)'),
                                border: `1px solid ${isPlaying
                                  ? (song.royaltyFree ? 'rgba(29,185,84,0.45)' : 'rgba(252,175,69,0.45)')
                                  : (song.royaltyFree ? 'rgba(29,185,84,0.18)' : 'var(--border)')}`,
                                borderRadius: 12,
                                padding: '11px 13px',
                                transition: 'border-color 0.2s, background 0.2s',
                                overflow: 'hidden',
                              }}>
                                <div style={{ display: 'flex', gap: 11, alignItems: 'center' }}>
                                  {/* Artwork / Play button */}
                                  <div
                                    onClick={() => canPlay && togglePlay(song)}
                                    style={{
                                      width: 42, height: 42, borderRadius: 9, flexShrink: 0,
                                      position: 'relative', overflow: 'hidden',
                                      cursor: canPlay ? 'pointer' : 'default',
                                      background: song.artworkUrl ? 'transparent'
                                        : (song.royaltyFree
                                          ? 'linear-gradient(135deg,rgba(29,185,84,0.3),rgba(29,185,84,0.1))'
                                          : 'linear-gradient(135deg,rgba(252,175,69,0.25),rgba(225,48,108,0.15))'),
                                    }}
                                  >
                                    {song.artworkUrl && (
                                      <img src={song.artworkUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block', borderRadius: 9 }} />
                                    )}
                                    {/* Play/pause overlay */}
                                    {canPlay && (
                                      <div style={{
                                        position: 'absolute', inset: 0, borderRadius: 9,
                                        background: isPlaying ? 'rgba(0,0,0,0.5)' : (song.artworkUrl ? 'rgba(0,0,0,0.25)' : 'transparent'),
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        opacity: isPlaying ? 1 : (song.artworkUrl ? 0.85 : 1),
                                        transition: 'background 0.15s, opacity 0.15s',
                                      }}>
                                        <span style={{ fontSize: isPlaying ? '0.9rem' : '1rem', lineHeight: 1 }}>
                                          {isPlaying ? '⏸' : '▶'}
                                        </span>
                                      </div>
                                    )}
                                    {!canPlay && !song.artworkUrl && (
                                      <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.1rem' }}>🎵</div>
                                    )}
                                  </div>

                                  {/* Song info */}
                                  <div style={{ flex: 1, minWidth: 0 }}>
                                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 5, flexWrap: 'wrap' }}>
                                      <span style={{ fontWeight: 700, fontSize: '0.87rem', color: 'var(--text)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 180 }}>{song.title}</span>
                                      <span style={{ fontSize: '0.76rem', color: 'var(--text-muted)', flexShrink: 0 }}>· {song.artist}</span>
                                      {isPlaying && (
                                        <span style={{ fontSize: '0.65rem', fontWeight: 700, padding: '1px 7px', borderRadius: 99, background: song.royaltyFree ? '#1DB954' : '#FCAF45', color: '#000', marginLeft: 2, flexShrink: 0 }}>
                                          ♪ PLAYING
                                        </span>
                                      )}
                                    </div>
                                    
                                    {song.reason && (
                                      <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginBottom: 8, lineHeight: 1.35, fontStyle: 'italic', paddingRight: 8 }}>
                                        "{song.reason}"
                                      </div>
                                    )}

                                    {/* Progress bar ,  shown only while playing */}
                                    {isPlaying && (
                                      <div style={{ marginBottom: 6, height: 3, borderRadius: 99, background: 'var(--border)', overflow: 'hidden' }}>
                                        <div style={{
                                          height: '100%', borderRadius: 99,
                                          background: song.royaltyFree
                                            ? 'linear-gradient(90deg,#1DB954,#17A44A)'
                                            : 'linear-gradient(90deg,#FCAF45,#E1306C)',
                                          width: `${audioProgress}%`,
                                          transition: 'width 0.15s linear',
                                        }} />
                                      </div>
                                    )}

                                    {/* Bottom row: library badge + preview label + full link */}
                                    <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                      {song.royaltyFree && song.library && (
                                        <span style={{ fontSize: '0.68rem', fontWeight: 600, padding: '2px 7px', borderRadius: 99, background: 'rgba(29,185,84,0.12)', color: '#1DB954', border: '1px solid rgba(29,185,84,0.22)' }}>
                                          🆓 {song.library}
                                        </span>
                                      )}
                                      {canPlay && (
                                        <span style={{ fontSize: '0.66rem', color: 'var(--text-faint)' }}>30s preview</span>
                                      )}
                                      {(song.spotifyUrl || song.searchUrl) && (
                                        <a
                                          href={song.spotifyUrl || song.searchUrl}
                                          target="_blank"
                                          rel="noopener noreferrer"
                                          style={{
                                            marginLeft: 'auto', fontSize: '0.7rem', fontWeight: 700,
                                            padding: '2px 9px', borderRadius: 99,
                                            background: song.spotifyUrl ? 'rgba(29,185,84,0.14)' : (song.royaltyFree ? 'rgba(29,185,84,0.10)' : 'rgba(252,175,69,0.10)'),
                                            color: song.spotifyUrl ? '#1DB954' : (song.royaltyFree ? '#1DB954' : '#FCAF45'),
                                            border: `1px solid ${song.spotifyUrl ? 'rgba(29,185,84,0.35)' : (song.royaltyFree ? 'rgba(29,185,84,0.28)' : 'rgba(252,175,69,0.28)')}`,
                                            textDecoration: 'none',
                                          }}
                                        >
                                          {song.spotifyUrl ? 'Spotify ↗' : 'Full ↗'}
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </div>
                            )
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* ── Tweak This Take ──────────────────────────────────── */}
          <div ref={refineRef} className="card" style={{
            background: 'linear-gradient(145deg, rgba(123,92,240,0.08) 0%, rgba(0,200,255,0.03) 100%)',
            border: '1px solid rgba(123,92,240,0.25)',
            paddingBottom: 24,
          }}>

            {/* Header row */}
            <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 20, gap: 12, flexWrap: 'wrap' }}>
              <div>
                <h3 style={{
                  fontFamily: 'var(--font-head)',
                  fontWeight: 800,
                  fontSize: '1.05rem',
                  margin: '0 0 3px',
                  color: 'var(--text)',
                }}>
                  ✦ Tweak This Take
                </h3>
                <p style={{ margin: 0, fontSize: '0.78rem', color: 'var(--text-faint)', fontFamily: 'var(--font-body)' }}>
                  Refine without spending quota
                </p>
              </div>
              {refining && (
                <div style={{
                  display: 'flex', alignItems: 'center', gap: 7,
                  padding: '6px 13px', borderRadius: 20,
                  background: 'rgba(123,92,240,0.15)',
                  border: '1px solid rgba(155,114,255,0.3)',
                }}>
                  <span className="spinner" style={{ width: 11, height: 11, borderColor: 'rgba(155,114,255,0.25)', borderTopColor: '#9B72FF' }} />
                  <span style={{ fontSize: '0.74rem', color: '#B39DFF', fontFamily: 'var(--font-mono)', fontWeight: 700 }}>Rewriting…</span>
                </div>
              )}
            </div>

            {/* Chip grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(auto-fill, minmax(155px, 1fr))',
              gap: 8,
              marginBottom: 6,
            }}>
              {REFINE_CHIPS.map(chip => (
                <button
                  key={chip.label}
                  type="button"
                  onClick={() => refine(chip.instruction)}
                  disabled={refining || rerolling}
                  style={{
                    padding: '10px 14px',
                    borderRadius: 12,
                    fontSize: '0.83rem',
                    fontWeight: 600,
                    fontFamily: 'var(--font-body)',
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text-muted)',
                    cursor: (refining || rerolling) ? 'not-allowed' : 'pointer',
                    opacity: (refining || rerolling) ? 0.38 : 1,
                    transition: 'all 0.18s ease',
                    textAlign: 'left',
                    whiteSpace: 'nowrap',
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    lineHeight: 1.3,
                  }}
                  onMouseEnter={e => {
                    if (refining || rerolling) return
                    e.currentTarget.style.borderColor = 'rgba(123,92,240,0.5)'
                    e.currentTarget.style.background = 'rgba(123,92,240,0.15)'
                    e.currentTarget.style.color = 'var(--text)'
                    e.currentTarget.style.transform = 'translateY(-2px)'
                    e.currentTarget.style.boxShadow = '0 6px 20px rgba(123,92,240,0.15)'
                  }}
                  onMouseLeave={e => {
                    e.currentTarget.style.borderColor = 'var(--border)'
                    e.currentTarget.style.background = 'var(--surface2)'
                    e.currentTarget.style.color = 'var(--text-muted)'
                    e.currentTarget.style.transform = 'none'
                    e.currentTarget.style.boxShadow = 'none'
                  }}
                >
                  {chip.label}
                </button>
              ))}
            </div>

            {/* Custom Refinement */}
            <div style={{ marginTop: 12, marginBottom: 12 }}>
              <label style={{ display: 'block', fontSize: '0.95rem', fontWeight: 600, color: 'var(--text)', marginBottom: 8, fontFamily: 'var(--font-head)' }}>
                Tell us what you'd like to improve
              </label>
              <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
                <textarea
                  value={customRefinement}
                  onChange={e => setCustomRefinement(e.target.value)}
                  placeholder="Examples: Make the intro stronger, Add humor, Make it suitable for Instagram..."
                  disabled={refining || rerolling}
                  rows={2}
                  style={{
                    flex: 1,
                    padding: '10px 14px',
                    borderRadius: 12,
                    border: '1px solid var(--border)',
                    background: 'var(--surface2)',
                    color: 'var(--text)',
                    fontSize: '0.85rem',
                    fontFamily: 'var(--font-body)',
                    resize: 'vertical',
                    minHeight: '42px',
                  }}
                  onKeyDown={e => {
                    if (e.key === 'Enter' && !e.shiftKey) {
                      e.preventDefault()
                      if (!customRefinement.trim()) return
                      refine(customRefinement)
                      setCustomRefinement('')
                    }
                  }}
                />
                <button
                  type="button"
                  onClick={() => {
                    if (!customRefinement.trim()) return
                    refine(customRefinement)
                    setCustomRefinement('')
                  }}
                  disabled={!customRefinement.trim() || refining || rerolling}
                  className="btn btn-primary"
                  style={{ padding: '0 20px', height: '42px', borderRadius: 12, fontSize: '0.85rem', flexShrink: 0 }}
                >
                  Refine Script
                </button>
              </div>
            </div>

            {/* Version history */}
            {versions.length > 1 && (
              <div style={{
                marginTop: 22,
                paddingTop: 18,
                borderTop: '1px solid rgba(123,92,240,0.15)',
              }}>
                <div style={{
                  fontSize: '0.69rem',
                  fontFamily: 'var(--font-mono)',
                  fontWeight: 700,
                  textTransform: 'uppercase',
                  letterSpacing: '0.12em',
                  color: 'var(--text-faint)',
                  marginBottom: 10,
                }}>
                  Your takes
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {versions.map((v, i) => (
                    <button
                      key={i}
                      type="button"
                      onClick={() => switchVersion(i)}
                      style={{
                        padding: '6px 15px',
                        borderRadius: 20,
                        fontSize: '0.75rem',
                        fontFamily: 'var(--font-mono)',
                        fontWeight: 600,
                        border: i === activeVer ? '1px solid rgba(155,114,255,0.55)' : '1px solid var(--border)',
                        background: i === activeVer
                          ? 'linear-gradient(135deg, rgba(123,92,240,0.28), rgba(0,200,255,0.1))'
                          : 'transparent',
                        color: i === activeVer ? '#C4ABFF' : 'var(--text-faint)',
                        cursor: 'pointer',
                        transition: 'all 0.15s',
                        boxShadow: i === activeVer ? '0 2px 14px rgba(123,92,240,0.22)' : 'none',
                      }}
                    >
                      {i === activeVer && <span style={{ marginRight: 5, fontSize: '0.55rem', verticalAlign: 'middle' }}>▶</span>}
                      {v.label}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

const visualLabelStyle = {
  fontSize: '0.68rem',
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--text-faint)',
  marginBottom: 4,
}

const fieldLabelStyle = {
  fontSize: '0.8rem',
  fontWeight: 600,
  color: 'var(--text-muted)',
  textTransform: 'uppercase',
  letterSpacing: '0.08em',
}

const sectionStyle = (accentColor) => ({
  marginBottom: 20,
  padding: '16px 20px',
  borderRadius: 12,
  background: 'var(--surface2)',
  borderLeft: `3px solid ${accentColor}`,
})

const labelStyle = {
  fontSize: '0.7rem',
  fontFamily: 'var(--font-mono)',
  fontWeight: 700,
  textTransform: 'uppercase',
  letterSpacing: '0.1em',
  color: 'var(--text-faint)',
  marginBottom: 10,
}

const scriptTextStyle = {
  fontSize: '0.975rem',
  lineHeight: 1.75,
  color: 'var(--text)',
  margin: 0,
}
