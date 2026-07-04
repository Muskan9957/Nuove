// Single source of truth for drawing a camera frame onto a canvas.
//
// Many mobile browsers ignore portrait getUserMedia constraints and deliver the
// camera as a SIDEWAYS-STORED landscape buffer (the upright scene rotated 90°).
// Rotating -90° when the target is portrait but the source is landscape restores
// the upright view — verified on a real device (commit a3467e4). The on-screen
// preview and the recording canvas MUST both go through this exact routine;
// when they diverge, what the user sees and what gets recorded disagree
// (that bug shipped as "recordings come out horizontal").
export function drawCameraFrame(ctx, video, cw, ch, { mirror = false, filter = 'none' } = {}) {
  const vw = video.videoWidth
  const vh = video.videoHeight
  if (!vw || !vh) return

  ctx.filter = (filter && filter !== 'none') ? filter : 'none'
  ctx.fillStyle = '#000'
  ctx.fillRect(0, 0, cw, ch)

  ctx.save()
  ctx.translate(cw / 2, ch / 2)

  const portraitTarget = ch > cw
  if (portraitTarget && vw > vh) {
    // Sideways landscape buffer on a portrait target: rotate upright, then
    // cover-fill (scale compares swapped axes because of the rotation).
    const scale = Math.max(cw / vh, ch / vw)
    ctx.rotate(-Math.PI / 2)
    if (mirror) ctx.scale(-1, 1)
    ctx.scale(scale, scale)
    ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh)
  } else {
    // Orientations agree: plain center cover-fill, no distortion.
    const scale = Math.max(cw / vw, ch / vh)
    if (mirror) ctx.scale(-1, 1)
    ctx.scale(scale, scale)
    ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh)
  }

  ctx.restore()
  ctx.filter = 'none'
}
