// Single source of truth for drawing a camera frame onto a canvas.
//
// Mobile browsers deliver the camera as a SIDEWAYS-STORED landscape pixel buffer
// even when the phone is held upright — the upright scene stored at 90°.
// Rotating -90° on a portrait canvas restores the correct upright view.
// Preview and recording MUST both go through this routine (WYSIWYG).
//
// Detection priority (three layers — handles iOS + Android + desktop):
//   1. track.getSettings().width/height  – true hardware dims (best)
//   2. videoWidth > videoHeight           – browser reports landscape (works on Android)
//   3. portrait device + vw < vh          – iOS fallback: Safari reports portrait
//      videoWidth/videoHeight but drawImage() ALWAYS writes the raw landscape
//      pixel buffer, so we swap dims and force rotation.
export function drawCameraFrame(ctx, video, cw, ch, { mirror = false, filter = 'none' } = {}) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return

  ctx.filter = (filter && filter !== 'none') ? filter : 'none'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, cw, ch)

  ctx.save()
  ctx.translate(cw / 2, ch / 2)

  const portraitTarget = ch > cw  // the output canvas is portrait

  // ── Layer 1: track.getSettings() hardware dimensions ──────────────────────
  const track    = video.srcObject?.getVideoTracks?.()[0]
  const settings = track?.getSettings?.()
  const settingsW = settings?.width
  const settingsH = settings?.height

  let needsRotation, srcW, srcH

  if (settingsW && settingsH) {
    // Hardware dims available → most reliable
    needsRotation = portraitTarget && (settingsW > settingsH)
    srcW = settingsW
    srcH = settingsH

  } else if (vw > vh) {
    // ── Layer 2: browser reports landscape (Android, some desktop) ────────
    needsRotation = portraitTarget
    srcW = vw
    srcH = vh

  } else if (vw < vh) {
    // ── Layer 3: browser reports portrait dims ─────────────────────────────
    // iOS Safari: videoWidth/videoHeight appear as portrait (e.g. 1080×1920)
    // but drawImage() always writes the raw landscape pixel buffer.
    // On a portrait device we must rotate; use max(vw,vh) as the landscape width.
    const isPortraitDevice =
      typeof window !== 'undefined' && window.innerHeight > window.innerWidth
    if (portraitTarget && isPortraitDevice) {
      needsRotation = true
      srcW = vh   // larger dim → landscape raw width
      srcH = vw   // smaller dim → landscape raw height
    } else {
      needsRotation = false
      srcW = vw
      srcH = vh
    }

  } else {
    // Square — no rotation
    needsRotation = false
    srcW = vw
    srcH = vh
  }

  if (needsRotation) {
    // Rotate -90°: landscape width fills canvas height, landscape height fills canvas width
    const scale = Math.max(cw / srcH, ch / srcW)
    ctx.rotate(-Math.PI / 2)
    if (mirror) ctx.scale(-1, 1)
    ctx.scale(scale, scale)
    ctx.drawImage(video, -srcW / 2, -srcH / 2, srcW, srcH)
  } else {
    // Orientations agree: center cover-fill
    const scale = Math.max(cw / srcW, ch / srcH)
    if (mirror) ctx.scale(-1, 1)
    ctx.scale(scale, scale)
    ctx.drawImage(video, -srcW / 2, -srcH / 2, srcW, srcH)
  }

  ctx.restore()
  ctx.filter = 'none'
}
