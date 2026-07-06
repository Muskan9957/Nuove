/**
 * Manages stream constraints and camera lifecycle.
 */
export class CameraPipeline {
  /**
   * Initializes the camera with safe, cross-platform constraints.
   * @param {string} facingMode - 'user' or 'environment'
   * @returns {Promise<MediaStream>}
   */
  static async initializeCamera(facingMode = 'user') {
    const isPortraitDevice = typeof window !== 'undefined' && window.innerHeight > window.innerWidth;
    
    // Request dimensions that match the physical screen orientation to avoid
    // extreme center-cropping (zoom) by the CameraRenderer.
    const idealWidth = isPortraitDevice ? 1080 : 1920;
    const idealHeight = isPortraitDevice ? 1920 : 1080;

    const constraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: idealWidth },
        height: { ideal: idealHeight },
        frameRate: { ideal: 30 }
      },
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true
      }
    };

    let stream;
    try {
      // First attempt with exact facing mode if possible (often stricter)
      stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { exact: facingMode }, ...constraints.video },
        audio: constraints.audio
      });
    } catch (err) {
      try {
        // Fallback to ideal facing mode
        stream = await navigator.mediaDevices.getUserMedia(constraints);
      } catch (fallbackErr) {
        // Ultimate fallback: Just ask for any video
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode },
          audio: constraints.audio
        });
      }
    }
    
    return stream;
  }
}
