export const buildCanonicalSections = (script, t = (k) => k) => {
  if (!script) return []

  const sections = []

  // HOOK
  if (script.hook) {
    sections.push({
      id: 'hook',
      label: t('generate_hook') || 'HOOK',
      text: script.hook,
      accent: '#00C8FF',
      emoji: '🎣',
      data: script.hook
    })
  }

  // BODY
  if (script.body) {
    sections.push({
      id: 'body',
      label: t('generate_body') || 'BODY',
      text: script.body,
      accent: '#00C9A7',
      emoji: '📝',
      data: script.body
    })
  }

  // CTA
  if (script.cta) {
    sections.push({
      id: 'cta',
      label: t('generate_cta') || 'CALL TO ACTION',
      text: script.cta,
      accent: '#FFD60A',
      emoji: '🎯',
      data: script.cta
    })
  }

  // VISUAL DIRECTION
  if (script.visual) {
    const parts = []
    if (script.visual.background) parts.push(`Background: ${script.visual.background}`)
    if (script.visual.style) parts.push(`Shooting Style: ${script.visual.style}`)
    if (script.visual.broll && script.visual.broll.length > 0) {
      parts.push(`B-Roll Ideas:\n${script.visual.broll.map((b, i) => `${i + 1}. ${b}`).join('\n')}`)
    }
    if (script.visual.colorMood) parts.push(`Colour Mood: ${script.visual.colorMood}`)
    if (script.visual.textOverlay) parts.push(`Text Overlay: ${script.visual.textOverlay}`)

    sections.push({
      id: 'visual',
      label: 'Visual Direction',
      text: parts.join('\n\n'),
      accent: '#A78BFA',
      emoji: '🎥',
      data: script.visual
    })
  }

  // MUSIC VIBE
  if (script.music) {
    const parts = []
    if (script.music.searchQuery) parts.push(`Search for: "${script.music.searchQuery}"`)
    if (script.music.tip) parts.push(`Tip: ${script.music.tip}`)

    sections.push({
      id: 'music',
      label: 'Music Vibe',
      text: parts.join('\n\n'),
      accent: '#34D399',
      emoji: '🎵',
      data: script.music
    })
  }

  return sections
}

export const copyCanonicalScript = (script, t = (k) => k) => {
  const sections = buildCanonicalSections(script, t).filter(s => ['hook', 'body', 'cta'].includes(s.id))
  const plainText = sections.map(s => `${s.emoji} ${s.label.toUpperCase()}\n\n${s.text}`).join('\n\n-------------------\n\n')
  navigator.clipboard.writeText(plainText)
}
