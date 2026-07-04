// Single source of truth for drawing a camera frame onto a canvas.
//
// Many mobile browsers ignore portrait getUserMedia constraints and deliver the
// camera as a SIDEWAYS-STORED landscape buffer (the upright scene rotated 90°).
// Rotating -90° when the target is portrait but the source is landscape restores
// the upright view. The on-screen preview and the recording canvas MUST both go
// through this exact routine so WYSIWYG — what you see is what gets recorded.
//
// iOS quirk: videoWidth/videoHeight can report portrait dims (e.g. 1080×1920)
// even though canvas.drawImage() always writes the raw landscape pixel buffer
// (1920×1080). We use track.getSettings().width/height — the true hardware dims —
// to detect whether rotation is needed, falling back to videoWidth/videoHeight.
export function drawCameraFrame(ctx, video, cw, ch, { mirror = false, filter = 'none' } = {}) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return

  // Get true hardware pixel dimensions — on iOS these differ from videoWidth/videoHeight
  const track = video.srcObject?.getVideoTracks?.()[0]
  const settings = track?.getSettings?.()
  const hw = settings?.width  || vw   // hardware capture width
  const hh = settings?.height || vh   // hardware capture height

  ctx.filter = (filter && filter !== 'none') ? filter : 'none'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, cw, ch)

  ctx.save()
  ctx.translate(cw / 2, ch / 2)

  const portraitTarget  = ch > cw   // canvas/output is portrait
  const landscapeSource = hw > hh   // hardware pixel buffer is landscape

  if (portraitTarget && landscapeSource) {
    // Sideways landscape buffer → portrait canvas: rotate -90°, then cover-fill.
    // Scale compares swapped axes because of the rotation.
    const scale = Math.max(cw / hh, ch / hw)
    ctx.rotate(-Math.PI / 2)
    if (mirror) ctx.scale(-1, 1)
    ctx.scale(scale, scale)
    ctx.drawImage(video, -hw / 2, -hh / 2, hw, hh)
  } else {
    // Orientations agree: plain center cover-fill, no rotation needed.
    const scale = Math.max(cw / hw, ch / hh)
    if (mirror) ctx.scale(-1, 1)
    ctx.scale(scale, scale)
    ctx.drawImage(video, -hw / 2, -hh / 2, hw, hh)
  }

  ctx.restore()
  ctx.filter = 'none'
}
