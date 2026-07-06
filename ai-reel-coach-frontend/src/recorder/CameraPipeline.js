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
    // To perfectly match Instagram's extremely wide Field of View (FOV), we must bypass 
    // the Android hardware encoder's "video" mode, which applies an aggressive digital double-crop.
    // By requesting an absurdly high symmetric resolution (4096), we force the camera driver 
    // to return the absolute maximum native uncropped sensor feed (usually 4:3 or 3:4).
    // Our CameraRenderer will then flawlessly center-crop it to the screen without any zoom.
    const idealWidth = 4096;
    const idealHeight = 4096;

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
