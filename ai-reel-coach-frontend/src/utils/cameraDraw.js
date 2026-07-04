// Single source of truth for drawing a camera frame onto a canvas.
//
// Mobile browsers deliver the camera as a SIDEWAYS-STORED landscape pixel buffer
// even when the phone is held upright. Rotating -90° on a portrait canvas restores
// the correct upright view. Preview and recording MUST both go through this routine.
//
// Detection: compare canvas target orientation vs source video orientation.
//   - If canvas is portrait (ch > cw) AND video is landscape (vw > vh) → rotate -90°
//   - All other combos: plain cover-fill (orientations already agree)
//
// NOTE: On iOS Safari the front-camera stream is reported with landscape dims
// (videoWidth > videoHeight) so the vw > vh check fires correctly. The browser
// also applies an orientation correction when rendering via <video>, but that
// correction is NOT applied by drawImage — drawImage always gives the raw
// landscape pixels, which is exactly what we expect here.
export function drawCameraFrame(ctx, video, cw, ch, { mirror = false, filter = 'none' } = {}) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return

  ctx.filter = (filter && filter !== 'none') ? filter : 'none'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, cw, ch)

  ctx.save()
  ctx.translate(cw / 2, ch / 2)

  const portraitTarget  = ch > cw   // canvas / output is portrait
  const landscapeSource = vw > vh   // video stream is landscape

  if (portraitTarget && landscapeSource) {
    // Sideways landscape buffer → portrait canvas: rotate -90°, then cover-fill.
    // Scale compares swapped axes because of the rotation.
    const scale = Math.max(cw / vh, ch / vw)
    ctx.rotate(-Math.PI / 2)
    if (mirror) ctx.scale(-1, 1)
    ctx.scale(scale, scale)
    ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh)
  } else {
    // Orientations agree (or source already portrait): plain center cover-fill.
    const scale = Math.max(cw / vw, ch / vh)
    if (mirror) ctx.scale(-1, 1)
    ctx.scale(scale, scale)
    ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh)
  }

  ctx.restore()
  ctx.filter = 'none'
}
