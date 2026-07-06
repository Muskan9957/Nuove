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
    // We request standard landscape HD instead of strict portrait dimensions.
    // Requesting exact portrait (1080x1920) often causes Android HALs to fallback or software-crop.
    // By requesting 1920x1080, we allow the OS to negotiate the best native stream,
    // which our CameraRenderer will seamlessly center-crop.
    const constraints = {
      video: {
        facingMode: { ideal: facingMode },
        width: { ideal: 1920 },
        height: { ideal: 1080 },
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
