/**
 * Core rendering engine for the Nuove Camera Pipeline.
 * Enforces a strict WYSIWYG invariant across live preview and recording.
 */
export class CameraRenderer {
  /**
   * Renders the video frame to the canvas, handling object-fit: cover,
   * mirroring, and CSS filters.
   * 
   * @param {CanvasRenderingContext2D} ctx - The canvas 2D context
   * @param {HTMLVideoElement} video - The source video element
   * @param {number} canvasWidth - Target canvas width
   * @param {number} canvasHeight - Target canvas height
   * @param {Object} options - { mirror: boolean, filter: string }
   */
  static render(ctx, video, canvasWidth, canvasHeight, options = {}) {
    const { mirror = false, filter = 'none' } = options;
    const vw = video.videoWidth;
    const vh = video.videoHeight;

    if (!vw || !vh) return;

    // Apply basic canvas reset and background
    ctx.filter = filter && filter !== 'none' ? filter : 'none';
    ctx.fillStyle = '#000';
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    ctx.save();
    
    // Translate to center for cover-crop math
    ctx.translate(canvasWidth / 2, canvasHeight / 2);

    // Modern browsers (including modern Android/iOS Chrome and Safari 16+)
    // automatically correct the orientation of frames when drawn via drawImage
    // from a <video> element. 
    // We calculate the scale required to completely fill the canvas (object-fit: cover).
    const scale = Math.max(canvasWidth / vw, canvasHeight / vh);
    
    if (mirror) {
      ctx.scale(-1, 1);
    }
    
    ctx.scale(scale, scale);
    
    // Draw the video centered, bleeding off the edges if necessary
    ctx.drawImage(video, -vw / 2, -vh / 2, vw, vh);

    ctx.restore();
    ctx.filter = 'none';
  }
}
