import { useState, useRef, useEffect, useCallback } from 'react'
import { Muxer, ArrayBufferTarget } from 'mp4-muxer'

/* ─────────────────── constants ─────────────────── */
const SPEEDS = [
  { label: '1',  value: 12 },
  { label: '2',  value: 22 },
  { label: '3',  value: 35 },
  { label: '4',  value: 50 },
  { label: '5',  value: 70 },
  { label: '6',  value: 100 },
  { label: '7',  value: 140 },
]
const FONT_SIZES = [
  { label: 'S',  value: 22 },
  { label: 'M',  value: 30 },
  { label: 'L',  value: 40 },
  { label: 'XL', value: 52 },
]

/* ─────────────────── cinematic filters ─────────────────── */
// Researched from CapCut, TikTok, Instagram Reels, and Prequel
const FILTERS = [
  {
    name: 'None',
    emoji: '⬜',
    css: 'none',
    swatch: 'linear-gradient(135deg, #888, #ccc)',
    desc: 'Raw camera, no filter',
  },
  {
    name: 'Cinematic',
    emoji: '🎬',
    css: 'contrast(112%) brightness(88%) saturate(78%)',
    swatch: 'linear-gradient(135deg, #1a1a2e, #4a4a6a)',
    desc: 'Hollywood film look, crushed blacks',
  },
  {
    name: 'Golden Hour',
    emoji: '🌅',
    css: 'brightness(108%) saturate(135%) sepia(22%) hue-rotate(-12deg)',
    swatch: 'linear-gradient(135deg, #f7971e, #ffd200)',
    desc: 'Warm sunset glow, lifestyle content',
  },
  {
    name: 'Studio',
    emoji: '💡',
    css: 'brightness(118%) contrast(105%) saturate(110%)',
    swatch: 'linear-gradient(135deg, #f8f8ff, #e0e8ff)',
    desc: 'Clean professional studio lighting',
  },
  {
    name: 'Aura',
    emoji: '🧘',
    css: 'brightness(115%) saturate(125%) contrast(95%) hue-rotate(-8deg)',
    swatch: 'linear-gradient(135deg, #fbc2eb, #a6c1ee)',
    desc: 'Dreamy elegant glow, skin-enhancing warmth',
  },
  {
    name: 'Vintage',
    emoji: '📽️',
    css: 'sepia(35%) contrast(92%) brightness(106%) saturate(88%)',
    swatch: 'linear-gradient(135deg, #b8860b, #d4a960)',
    desc: 'Retro film grain feel, nostalgic',
  },
  {
    name: 'Soft Glow',
    emoji: '✨',
    css: 'brightness(112%) contrast(92%) saturate(118%)',
    swatch: 'linear-gradient(135deg, #f8cdda, #1d2b64)',
    desc: 'Beauty/lifestyle, skin-flattering',
  },
  {
    name: 'B&W Drama',
    emoji: '🎭',
    css: 'grayscale(100%) contrast(120%) brightness(90%)',
    swatch: 'linear-gradient(135deg, #000, #fff)',
    desc: 'Bold black and white, high contrast',
  },
]

/* ─────────────────── component ─────────────────── */
export default function Record() {
  // script
  const [script,     setScript]     = useState(() => sessionStorage.getItem('rc_script') || '')
  const [editing,    setEditing]    = useState(false)

  // settings
  const [speedIdx,   setSpeedIdx]   = useState(2)   // default speed 3
  const [fontIdx,    setFontIdx]    = useState(1)    // M
  const [mirror,     setMirror]     = useState(true) // front cam default mirrored
  const [facingMode, setFacingMode] = useState('user')
  const [filterIdx,  setFilterIdx]  = useState(0)   // 0 = None
  const prevFilter = () => setFilterIdx(i => (i - 1 + FILTERS.length) % FILTERS.length)
  const nextFilter = () => setFilterIdx(i => (i + 1) % FILTERS.length)
  const [showGrid,   setShowGrid]   = useState(false)

  // steps: 'setup' | 'countdown' | 'recording' | 'done'
  const [phase,      setPhase]      = useState('setup')
  const [countdown,  setCountdown]  = useState(3)
  const [elapsed,    setElapsed]    = useState(0)
  const [scrolling,  setScrolling]  = useState(true)
  const [cameraErr,  setCameraErr]  = useState('')

  // recording
  const [outputBlob, setOutputBlob] = useState(null)
  const [outputExt,  setOutputExt]  = useState('mp4')
  const [trimStart,  setTrimStart]  = useState(0)    // seconds
  const [trimEnd,    setTrimEnd]    = useState(0)    // seconds (0 = full)
  const [trimming,   setTrimming]   = useState(false)
  const [processing, setProcessing] = useState(false) // true while WebCodecs flushes after stop

  // refs
  const videoRef      = useRef(null)   // camera preview (visible)
  const hiddenVideoRef = useRef(null)   // off-screen video used as canvas draw source
  const streamRef     = useRef(null)
  const recorderRef   = useRef(null)
  const chunksRef     = useRef([])
  const scrollRef     = useRef(null)   // teleprompter text container
  const scrollPosRef  = useRef(0)
  const rafRef        = useRef(null)
  const timerRef      = useRef(null)
  const countdownRef  = useRef(null)
  const canvasLoopRef = useRef(false)

  /* ── start camera ── */
  const startCamera = useCallback(async (facing = facingMode) => {
    setCameraErr('')
    try {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: facing, width: { ideal: 1280 }, height: { ideal: 720 } },
        audio: true,
      })
      streamRef.current = stream
      if (videoRef.current) { videoRef.current.srcObject = stream; videoRef.current.play().catch(() => {}) }
      // Keep the hidden video in sync too — this is our stable canvas draw source
      if (hiddenVideoRef.current) { hiddenVideoRef.current.srcObject = stream; hiddenVideoRef.current.play().catch(() => {}) }
    } catch (e) {
      setCameraErr(e.name === 'NotAllowedError'
        ? 'Camera access denied. Please allow camera in your browser settings.'
        : 'Could not access camera: ' + e.message)
    }
  }, [facingMode])

  useEffect(() => {
    startCamera()
    return () => {
      if (streamRef.current) streamRef.current.getTracks().forEach(t => t.stop())
      cancelAnimationFrame(rafRef.current)
      clearInterval(timerRef.current)
      clearInterval(countdownRef.current)
      canvasLoopRef.current = false
    }
  }, []) // eslint-disable-line

  /* ── flip camera ── */
  const flipCamera = async () => {
    const next = facingMode === 'user' ? 'environment' : 'user'
    setFacingMode(next)
    setMirror(next === 'user')
    await startCamera(next)
  }

  /* ── auto-scroll teleprompter ── */
  const startScroll = useCallback(() => {
    const speed = SPEEDS[speedIdx].value  // px per second
    let last = null
    const tick = (ts) => {
      if (!scrollRef.current) return
      if (last !== null && scrolling) {
        const delta = ((ts - last) / 1000) * speed
        scrollPosRef.current += delta
        scrollRef.current.scrollTop = scrollPosRef.current
      }
      last = ts
      rafRef.current = requestAnimationFrame(tick)
    }
    rafRef.current = requestAnimationFrame(tick)
  }, [speedIdx, scrolling])

  const stopScroll = () => {
    cancelAnimationFrame(rafRef.current)
    rafRef.current = null
  }

  /* ── begin: countdown → record ── */
  const beginRecording = () => {
    if (!streamRef.current) return
    setPhase('countdown')
    setCountdown(3)
    scrollPosRef.current = 0
    if (scrollRef.current) scrollRef.current.scrollTop = 0

    let n = 3
    countdownRef.current = setInterval(() => {
      n -= 1
      if (n <= 0) {
        clearInterval(countdownRef.current)
        launchRecording()
      } else {
        setCountdown(n)
      }
    }, 1000)
  }

  const launchRecording = () => {
    const stream = streamRef.current
    if (!stream) return

    // Create canvas to process frames & apply CSS filters + mirror state directly to the output video
    const canvas = document.createElement('canvas')
    canvas.width = 1280
    canvas.height = 720
    const ctx = canvas.getContext('2d')

    const hasWebCodecs = typeof VideoEncoder !== 'undefined' && 
                         typeof AudioEncoder !== 'undefined' && 
                         typeof MediaStreamTrackProcessor !== 'undefined';

    const recordingStartTime = performance.now();

    if (hasWebCodecs) {
      try {
        const audioTrack = stream.getAudioTracks()[0];
        
        // 1. Initialize Muxer
        const muxerOptions = {
          target: new ArrayBufferTarget(),
          video: {
            codec: 'avc',
            width: 1280,
            height: 720
          },
          fastStart: 'in-memory'
        };
        if (audioTrack) {
          muxerOptions.audio = {
            codec: 'aac',
            numberOfChannels: 1,
            sampleRate: 44100
          };
        }
        const muxer = new Muxer(muxerOptions);

        // 2. Configure Encoders
        const videoEncoder = new VideoEncoder({
          output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
          error: (e) => console.error("VideoEncoder error:", e)
        });
        videoEncoder.configure({
          codec: 'avc1.42E01E', // Baseline profile
          width: 1280,
          height: 720,
          bitrate: 2_500_000,
          framerate: 30
        });

        let audioEncoder = null;
        let audioReader = null;
        let firstAudioTimestamp = null;

        if (audioTrack) {
          audioEncoder = new AudioEncoder({
            output: (chunk, meta) => {
              if (firstAudioTimestamp === null) return;
              const relativeTimestamp = chunk.timestamp - firstAudioTimestamp;
              const buffer = new ArrayBuffer(chunk.byteLength);
              chunk.copyTo(buffer);
              const newChunk = new EncodedAudioChunk({
                type: chunk.type,
                data: buffer,
                timestamp: Math.max(0, relativeTimestamp),
                duration: chunk.duration
              });
              muxer.addAudioChunk(newChunk, meta);
            },
            error: (e) => console.error("AudioEncoder error:", e)
          });
          audioEncoder.configure({
            codec: 'mp4a.40.2', // AAC-LC
            numberOfChannels: 1,
            sampleRate: 44100,
            bitrate: 128000
          });

          // Process microphone audio track
          const audioProcessor = new MediaStreamTrackProcessor({ track: audioTrack });
          audioReader = audioProcessor.readable.getReader();
          const processAudio = async () => {
            try {
              while (canvasLoopRef.current) {
                const { done, value: audioData } = await audioReader.read();
                if (done) break;
                if (!canvasLoopRef.current) {
                  audioData.close();
                  break;
                }
                if (firstAudioTimestamp === null) {
                  firstAudioTimestamp = audioData.timestamp;
                }
                if (audioEncoder && audioEncoder.state === 'configured') {
                  audioEncoder.encode(audioData);
                }
                audioData.close();
              }
            } catch (err) {
              console.error("Audio reader error:", err);
            }
          };
          processAudio();
        }

        // 3. Canvas capture loop
        let lastFrameTime = 0;
        let framesSent = 0;

        canvasLoopRef.current = true;
        const drawFrame = () => {
          if (!canvasLoopRef.current) return;

          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.filter = activeFilter;

          ctx.save();
          if (mirror) {
            ctx.translate(canvas.width, 0);
            ctx.scale(-1, 1);
          }

          const src = hiddenVideoRef.current;
          if (src && src.readyState >= 2 && !src.paused) {
            ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
          }
          ctx.restore();

          const now = performance.now();
          if (now - lastFrameTime >= 32.5) {
            lastFrameTime = now;
            const timestamp = (now - recordingStartTime) * 1000;
            const frame = new VideoFrame(canvas, { timestamp });
            if (videoEncoder.state === 'configured') {
              videoEncoder.encode(frame, { keyFrame: framesSent % 60 === 0 });
            }
            frame.close();
            framesSent++;
          }

          requestAnimationFrame(drawFrame);
        };
        requestAnimationFrame(drawFrame);

        // Helper: flush with a timeout so encoder can't hang UI forever
        const flushWithTimeout = (encoder, ms = 8000) =>
          Promise.race([
            encoder.flush(),
            new Promise((_, rej) => setTimeout(() => rej(new Error('flush timeout')), ms))
          ]);

        // Save reference to stop recording
        recorderRef.current = {
          stop: async () => {
            canvasLoopRef.current = false;
            const actualElapsed = (performance.now() - recordingStartTime) / 1000;

            try {
              if (audioReader) {
                await audioReader.cancel().catch(() => {});
              }

              await flushWithTimeout(videoEncoder);
              if (audioEncoder) {
                await flushWithTimeout(audioEncoder);
              }

              muxer.finalize();

              const buffer = muxer.target.buffer;
              const mp4Blob = new Blob([buffer], { type: 'video/mp4' });

              setOutputBlob(mp4Blob);
              setOutputExt('mp4');
            } catch (err) {
              console.error('WebCodecs finalize error, falling back to partial blob:', err);
              // Still try to finalize whatever we have
              try {
                muxer.finalize();
                const buffer = muxer.target.buffer;
                if (buffer && buffer.byteLength > 0) {
                  const mp4Blob = new Blob([buffer], { type: 'video/mp4' });
                  setOutputBlob(mp4Blob);
                  setOutputExt('mp4');
                }
              } catch (e2) {
                console.error('Muxer finalize also failed:', e2);
              }
            } finally {
              setTrimStart(0);
              setTrimEnd(Math.round(actualElapsed));
              setPhase('done');
              stopScroll();
              clearInterval(timerRef.current);
            }
          }
        };

        setPhase('recording');
        setElapsed(0);
        setScrolling(true);
        timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
        startScroll();
        return; // Success! WebCodecs path configured.

      } catch (err) {
        console.warn("WebCodecs config failed, falling back to MediaRecorder:", err);
      }
    }

    // Fallback using MediaRecorder
    const canvasStream = canvas.captureStream(30);
    const videoTrack = canvasStream.getVideoTracks()[0];
    const audioTrack = stream.getAudioTracks()[0];

    const combinedTracks = [videoTrack];
    if (audioTrack) combinedTracks.push(audioTrack);
    const combinedStream = new MediaStream(combinedTracks);

    canvasLoopRef.current = true;
    const drawFrameFallback = () => {
      if (!canvasLoopRef.current) return;

      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.filter = activeFilter;

      ctx.save();
      if (mirror) {
        ctx.translate(canvas.width, 0);
        ctx.scale(-1, 1);
      }

      const src = hiddenVideoRef.current;
      if (src && src.readyState >= 2 && !src.paused) {
        ctx.drawImage(src, 0, 0, canvas.width, canvas.height);
      }
      ctx.restore();

      requestAnimationFrame(drawFrameFallback);
    };
    requestAnimationFrame(drawFrameFallback);

    chunksRef.current = [];
    const MIMES = ['video/mp4;codecs=h264,aac', 'video/webm;codecs=vp9,opus', 'video/webm'];
    const mime = MIMES.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';
    const rec = new MediaRecorder(combinedStream, { mimeType: mime });
    
    recorderRef.current = rec;
    rec.ondataavailable = e => { if (e.data.size > 0) chunksRef.current.push(e.data) };
    rec.onstop = () => {
      canvasLoopRef.current = false;
      const blob = new Blob(chunksRef.current, { type: mime });
      // Fix seekability
      const tempVid = document.createElement('video');
      tempVid.muted = true;
      const url = URL.createObjectURL(blob);
      tempVid.src = url;
      tempVid.addEventListener('loadedmetadata', function onMeta() {
        tempVid.removeEventListener('loadedmetadata', onMeta);
        const fix = () => {
          URL.revokeObjectURL(url);
          const actualElapsed = (performance.now() - recordingStartTime) / 1000;
          setOutputBlob(blob);
          setOutputExt(mime.includes('mp4') ? 'mp4' : 'webm');
          setTrimStart(0);
          setTrimEnd(Math.round(actualElapsed));
          setPhase('done');
          stopScroll();
          clearInterval(timerRef.current);
        };
        if (tempVid.duration === Infinity || isNaN(tempVid.duration)) {
          tempVid.currentTime = 1e10;
          tempVid.addEventListener('timeupdate', function onTime() {
            tempVid.removeEventListener('timeupdate', onTime);
            tempVid.currentTime = 0;
            fix();
          }, { once: true });
        } else {
          fix();
        }
      });
    };

    rec.start(100);
    setPhase('recording');
    setElapsed(0);
    setScrolling(true);
    timerRef.current = setInterval(() => setElapsed(e => e + 1), 1000);
    startScroll();
  }

  const stopRecording = () => {
    canvasLoopRef.current = false
    clearInterval(timerRef.current)
    stopScroll()
    setProcessing(true) // show spinner immediately
    // stop() may be async (WebCodecs path) or sync (MediaRecorder fallback)
    // We fire-and-forget but errors are caught inside stop() itself
    Promise.resolve(recorderRef.current?.stop()).catch(err => {
      console.error('stopRecording error:', err)
      // Force done state if stop() itself throws unexpectedly
      setPhase('done')
    }).finally(() => {
      setProcessing(false)
    })
  }

  const toggleScrollPause = () => {
    setScrolling(s => !s)
  }

  /* ── speed change restarts scroll at new rate ── */
  useEffect(() => {
    if (phase === 'recording') { stopScroll(); startScroll() }
  }, [speedIdx]) // eslint-disable-line

  /* ── re-attach stream whenever a new <video> element mounts (phase change) ── */
  useEffect(() => {
    if ((phase === 'countdown' || phase === 'recording') && videoRef.current && streamRef.current) {
      videoRef.current.srcObject = streamRef.current
      videoRef.current.play().catch(() => {})
    }
  }, [phase])

  /* ── keep scrolling state in sync with ref ── */
  useEffect(() => {
    // scrolling ref used inside rAF ,  handled by re-reading state flag
  }, [scrolling])

  const download = () => {
    if (!outputBlob) return
    const a = document.createElement('a')
    a.href = URL.createObjectURL(outputBlob)
    a.download = `nuove-recording.${outputExt}`
    a.click()
  }

  /* ── make blob seekable so slider + duration work in browser & media players ── */
  const makeSeekable = (blob, videoEl) => new Promise(resolve => {
    const url = URL.createObjectURL(blob)
    videoEl.src = url
    videoEl.addEventListener('loadedmetadata', function onMeta() {
      videoEl.removeEventListener('loadedmetadata', onMeta)
      if (videoEl.duration === Infinity || isNaN(videoEl.duration)) {
        // Seek to a very large number to force the browser to scan to end
        videoEl.currentTime = 1e10
        videoEl.addEventListener('timeupdate', function onTime() {
          videoEl.removeEventListener('timeupdate', onTime)
          videoEl.currentTime = 0
          resolve(blob)
        }, { once: true })
      } else {
        resolve(blob)
      }
    })
  })

  /* ── trim video using canvas frame extraction ── */
  const handleTrim = async () => {
    if (!outputBlob || trimming) return
    setTrimming(true)

    const tempVideo = document.createElement('video')
    // Set volume to 0 (mute output, but MediaElementAudioSourceNode still captures it)
    tempVideo.volume = 0
    tempVideo.src = URL.createObjectURL(outputBlob)

    await new Promise(r => tempVideo.addEventListener('loadedmetadata', r, { once: true }))

    const duration = tempVideo.duration
    const start = trimStart
    const end   = trimEnd > 0 && trimEnd < duration ? trimEnd : duration

    const canvas = document.createElement('canvas')
    canvas.width  = 1280
    canvas.height = 720
    const ctx = canvas.getContext('2d')

    const hasWebCodecs = typeof VideoEncoder !== 'undefined' && 
                         typeof AudioEncoder !== 'undefined' && 
                         typeof MediaStreamTrackProcessor !== 'undefined';

    if (hasWebCodecs) {
      let audioCtx = null;
      let audioTrack = null;
      let audioSource = null;
      let audioDest = null;
      
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioSource = audioCtx.createMediaElementSource(tempVideo);
        audioDest = audioCtx.createMediaStreamDestination();
        audioSource.connect(audioDest);
        audioTrack = audioDest.stream.getAudioTracks()[0];
      } catch (err) {
        console.warn("Could not capture audio for trim, writing video only:", err);
      }

      // 1. Setup Muxer
      const muxerOptions = {
        target: new ArrayBufferTarget(),
        video: {
          codec: 'avc',
          width: 1280,
          height: 720
        },
        fastStart: 'in-memory'
      };
      if (audioTrack) {
        muxerOptions.audio = {
          codec: 'aac',
          numberOfChannels: 1,
          sampleRate: 44100
        };
      }
      const muxer = new Muxer(muxerOptions);

      // 2. Setup Encoders
      const videoEncoder = new VideoEncoder({
        output: (chunk, meta) => muxer.addVideoChunk(chunk, meta),
        error: (e) => console.error("Trim VideoEncoder error:", e)
      });
      videoEncoder.configure({
        codec: 'avc1.42E01E',
        width: 1280,
        height: 720,
        bitrate: 2_500_000,
        framerate: 30
      });

      let audioEncoder = null;
      let audioReader = null;
      let firstAudioTimestamp = null;

      if (audioTrack) {
        audioEncoder = new AudioEncoder({
          output: (chunk, meta) => {
            if (firstAudioTimestamp === null) return;
            const relativeTimestamp = chunk.timestamp - firstAudioTimestamp;
            const buffer = new ArrayBuffer(chunk.byteLength);
            chunk.copyTo(buffer);
            const newChunk = new EncodedAudioChunk({
              type: chunk.type,
              data: buffer,
              timestamp: Math.max(0, relativeTimestamp),
              duration: chunk.duration
            });
            muxer.addAudioChunk(newChunk, meta);
          },
          error: (e) => console.error("Trim AudioEncoder error:", e)
        });
        audioEncoder.configure({
          codec: 'mp4a.40.2',
          numberOfChannels: 1,
          sampleRate: 44100,
          bitrate: 128000
        });

        const audioProcessor = new MediaStreamTrackProcessor({ track: audioTrack });
        audioReader = audioProcessor.readable.getReader();
      }

      // 3. Run loop
      let lastFrameTime = 0;
      let framesSent = 0;
      let trimLoopRunning = true;
      let recordStartTime = null;

      tempVideo.currentTime = start;
      await new Promise(r => tempVideo.addEventListener('seeked', r, { once: true }));
      tempVideo.play();

      if (audioReader) {
        const processAudioTrim = async () => {
          try {
            while (trimLoopRunning) {
              const { done, value: audioData } = await audioReader.read();
              if (done) break;
              if (!trimLoopRunning) {
                audioData.close();
                break;
              }
              if (firstAudioTimestamp === null) {
                firstAudioTimestamp = audioData.timestamp;
              }
              if (audioEncoder && audioEncoder.state === 'configured') {
                audioEncoder.encode(audioData);
              }
              audioData.close();
            }
          } catch (err) {
            console.error("Audio trim reader error:", err);
          }
        };
        processAudioTrim();
      }

      const drawLoop = async () => {
        if (tempVideo.currentTime >= end || tempVideo.paused || tempVideo.ended) {
          trimLoopRunning = false;
          
          if (audioReader) {
            await audioReader.cancel().catch(() => {});
          }

          await videoEncoder.flush();
          if (audioEncoder) {
            await audioEncoder.flush();
          }

          muxer.finalize();
          
          const buffer = muxer.target.buffer;
          const trimmedBlob = new Blob([buffer], { type: 'video/mp4' });
          
          setOutputBlob(trimmedBlob);
          setOutputExt('mp4');
          setTrimming(false);
          
          if (audioCtx) {
            audioCtx.close().catch(() => {});
          }
          return;
        }

        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);

        const now = performance.now();
        if (recordStartTime === null) {
          recordStartTime = now;
        }

        if (now - lastFrameTime >= 32.5) {
          lastFrameTime = now;
          const timestamp = (now - recordStartTime) * 1000;
          const frame = new VideoFrame(canvas, { timestamp });
          if (videoEncoder.state === 'configured') {
            videoEncoder.encode(frame, { keyFrame: framesSent % 60 === 0 });
          }
          frame.close();
          framesSent++;
        }

        requestAnimationFrame(drawLoop);
      };
      requestAnimationFrame(drawLoop);

    } else {
      // Fallback MediaRecorder trim
      let audioCtx = null;
      let audioTrack = null;
      let audioSource = null;
      let audioDest = null;
      
      try {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        audioSource = audioCtx.createMediaElementSource(tempVideo);
        audioDest = audioCtx.createMediaStreamDestination();
        audioSource.connect(audioDest);
        audioTrack = audioDest.stream.getAudioTracks()[0];
      } catch (err) {
        console.warn("Could not capture audio for fallback trim:", err);
      }

      const canvasStream = canvas.captureStream(30);
      const videoTrackNode = canvasStream.getVideoTracks()[0];
      const tracks = [videoTrackNode];
      if (audioTrack) {
        tracks.push(audioTrack);
      }
      
      const combinedStream = new MediaStream(tracks);

      const MIMES = ['video/webm;codecs=vp9,opus', 'video/webm'];
      const mime = MIMES.find(m => MediaRecorder.isTypeSupported(m)) || 'video/webm';
      const rec = new MediaRecorder(combinedStream, { mimeType: mime });
      const chunks = [];
      rec.ondataavailable = e => { if (e.data.size > 0) chunks.push(e.data) };

      rec.onstop = () => {
        const trimmed = new Blob(chunks, { type: mime });
        setOutputBlob(trimmed);
        setOutputExt(mime.includes('mp4') ? 'mp4' : 'webm');
        setTrimming(false);
        if (audioCtx) audioCtx.close().catch(() => {});
      };

      rec.start();
      tempVideo.currentTime = start;

      await new Promise(r => tempVideo.addEventListener('seeked', r, { once: true }));
      tempVideo.play();

      const drawLoop = () => {
        if (tempVideo.currentTime >= end) {
          rec.stop();
          tempVideo.pause();
          return;
        }
        ctx.drawImage(tempVideo, 0, 0, canvas.width, canvas.height);
        requestAnimationFrame(drawLoop);
      };
      requestAnimationFrame(drawLoop);
    }
  }

  const fmt = (s) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  const fontSize    = FONT_SIZES[fontIdx].value
  const isLive      = phase === 'recording' || phase === 'countdown'
  const activeFilter = FILTERS[filterIdx].css

  /* ─────────────── UI ─────────────── */
  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', background: 'var(--bg)' }}>

      {/* Hidden off-screen video — always mounted, never unmounted, used as stable canvas draw source */}
      <video
        ref={hiddenVideoRef}
        muted
        playsInline
        style={{ position: 'fixed', width: 1, height: 1, opacity: 0, pointerEvents: 'none', top: -9999, left: -9999 }}
      />

      {/* ─── SETUP PHASE ─── */}
      {phase === 'setup' && (
        <div style={S.setupWrap}>
          {/* Page header ,  matches all other feature pages */}
          <div style={{ width: '100%', marginBottom: 8 }}>
            <h1 className="page-title" style={{ marginBottom: 4 }}>Teleprompter &amp; Recorder</h1>
            <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', margin: 0 }}>
              Script scrolls while you record ,  no second device needed.
            </p>
          </div>

          {/* Left: Script editor */}
          <div style={S.setupLeft}>
            <div style={S.sectionLabel}>Script</div>
            {editing ? (
              <textarea
                style={S.scriptEditor}
                value={script}
                onChange={e => setScript(e.target.value)}
                placeholder="Paste or type your script here…"
                autoFocus
              />
            ) : (
              <div
                style={{ ...S.scriptPreview, ...(script ? {} : S.scriptEmpty) }}
                onClick={() => setEditing(true)}
              >
                {script || 'Tap to paste or type your script…'}
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <button style={S.ghostBtn} onClick={() => setEditing(e => !e)}>
                {editing ? 'Done' : '✏️ Edit Script'}
              </button>
              {script && (
                <button style={S.ghostBtn} onClick={() => { setScript(''); setEditing(true) }}>
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Right: Camera preview + settings */}
          <div style={S.setupRight}>

            {/* Camera preview */}
            <div style={S.cameraBox}>
              {cameraErr ? (
                <div style={S.cameraErr}>
                  <div style={{ fontSize: '2rem', marginBottom: 8 }}>📷</div>
                  <p style={{ margin: 0, fontSize: '0.85rem', textAlign: 'center' }}>{cameraErr}</p>
                  <button style={{ ...S.ghostBtn, marginTop: 12 }} onClick={() => startCamera()}>Retry</button>
                </div>
              ) : (
                <video
                  ref={videoRef}
                  muted
                  playsInline
                  style={{ ...S.cameraVideo, transform: mirror ? 'scaleX(-1)' : 'none', filter: activeFilter }}
                />
              )}
              {/* Rule-of-thirds grid overlay */}
              {showGrid && (
                <div style={S.gridOverlay}>
                  <div style={S.gridLine('33.33%', 'h')} />
                  <div style={S.gridLine('66.66%', 'h')} />
                  <div style={S.gridLine('33.33%', 'v')} />
                  <div style={S.gridLine('66.66%', 'v')} />
                </div>
              )}
              <button style={S.flipBtn} onClick={flipCamera} title="Flip camera">⟳</button>
            </div>

            {/* Settings */}
            <div style={S.settingsGrid}>
              <div style={S.settingGroup}>
                <div style={S.settingLabel}>Scroll speed</div>
                <div style={S.chips}>
                  {SPEEDS.map((s, i) => (
                    <button key={i} style={{ ...S.chip, ...(speedIdx === i ? S.chipOn : {}) }} onClick={() => setSpeedIdx(i)}>
                      {s.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={S.settingGroup}>
                <div style={S.settingLabel}>Font size</div>
                <div style={S.chips}>
                  {FONT_SIZES.map((f, i) => (
                    <button key={i} style={{ ...S.chip, ...(fontIdx === i ? S.chipOn : {}) }} onClick={() => setFontIdx(i)}>
                      {f.label}
                    </button>
                  ))}
                </div>
              </div>
              <div style={S.settingGroup}>
                <div style={S.settingLabel}>Camera</div>
                <div style={S.chips}>
                  <button style={{ ...S.chip, ...(facingMode === 'user' ? S.chipOn : {}) }} onClick={() => { setFacingMode('user'); setMirror(true); startCamera('user') }}>Front</button>
                  <button style={{ ...S.chip, ...(facingMode === 'environment' ? S.chipOn : {}) }} onClick={() => { setFacingMode('environment'); setMirror(false); startCamera('environment') }}>Back</button>
                </div>
              </div>
              <div style={S.settingGroup}>
                <div style={S.settingLabel}>Grid</div>
                <div style={S.chips}>
                  <button style={{ ...S.chip, ...(showGrid ? S.chipOn : {}) }} onClick={() => setShowGrid(g => !g)}>
                    {showGrid ? '▦ On' : '▦ Off'}
                  </button>
                </div>
              </div>
            </div>

            {/* ── Filter Picker with arrows ── */}
            <div>
              <div style={S.sectionLabel}>🎨 Cinematic Filters</div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <button onClick={prevFilter} style={S.filterArrow}>‹</button>
                <div style={S.filterCard}>
                  <div style={{ ...S.filterSwatch, width: '100%', height: 44, marginBottom: 6, background: FILTERS[filterIdx].swatch }} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: '1.1rem' }}>{FILTERS[filterIdx].emoji}</span>
                    <div>
                      <div style={{ fontWeight: 700, fontSize: '0.85rem', color: 'var(--text)' }}>{FILTERS[filterIdx].name}</div>
                      <div style={{ fontSize: '0.68rem', color: 'var(--text-faint)' }}>{FILTERS[filterIdx].desc}</div>
                    </div>
                  </div>
                  <div style={{ display: 'flex', gap: 4, marginTop: 8, justifyContent: 'center' }}>
                    {FILTERS.map((_, i) => (
                      <div key={i} onClick={() => setFilterIdx(i)} style={{
                        width: i === filterIdx ? 18 : 6, height: 6, borderRadius: 99,
                        background: i === filterIdx ? 'var(--accent)' : 'var(--border)',
                        cursor: 'pointer', transition: 'all 0.2s',
                      }} />
                    ))}
                  </div>
                </div>
                <button onClick={nextFilter} style={S.filterArrow}>›</button>
              </div>
            </div>

            <button
              style={{ ...S.recordBtn, ...((!script.trim() || cameraErr) ? S.recordBtnOff : {}) }}
              disabled={!script.trim() || !!cameraErr}
              onClick={beginRecording}
            >
              ● Start Recording
            </button>
          </div>
        </div>
      )}

      {/* ─── COUNTDOWN PHASE ─── */}
      {phase === 'countdown' && (
        <div style={S.fullscreen}>
          <video ref={videoRef} muted playsInline style={{ ...S.fullVideo, transform: mirror ? 'scaleX(-1)' : 'none', filter: activeFilter }} />
          <div style={S.countdownOverlay}>
            <div style={S.countdownNum}>{countdown}</div>
          </div>
        </div>
      )}

      {/* ─── RECORDING PHASE ─── */}
      {phase === 'recording' && (
        <div style={S.fullscreen} onClick={toggleScrollPause}>
          {/* Camera in background */}
          <video ref={videoRef} muted playsInline style={{ ...S.fullVideo, transform: mirror ? 'scaleX(-1)' : 'none', filter: activeFilter }} />

          {/* Dark gradient top + bottom so text is readable */}
          <div style={S.gradTop} />
          <div style={S.gradBottom} />

          {/* Scrolling script */}
          <div
            ref={scrollRef}
            style={{ ...S.scriptScroll, fontSize }}
            onScroll={e => { scrollPosRef.current = e.target.scrollTop }}
          >
            {/* padding top so first word starts at centre of screen */}
            <div style={{ height: '45vh' }} />
            <p style={S.scriptText}>{script}</p>
            {/* padding bottom so last word can scroll fully up */}
            <div style={{ height: '55vh' }} />
          </div>

          {/* HUD */}
          <div style={S.hud}>
            {/* Timer */}
            <div style={S.timer}>{fmt(elapsed)}</div>

            {/* Pause / speed controls */}
            <div style={S.hudControls} onClick={e => e.stopPropagation()}>
              <button style={S.hudBtn} onClick={toggleScrollPause}>
                {scrolling ? '⏸ Pause scroll' : '▶ Resume scroll'}
              </button>
              <div style={{ display: 'flex', gap: 6 }}>
                {SPEEDS.map((s, i) => (
                  <button key={i} style={{ ...S.hudChip, ...(speedIdx === i ? S.hudChipOn : {}) }} onClick={() => setSpeedIdx(i)}>
                    {s.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Stop */}
            <button style={S.stopBtn} onClick={e => { e.stopPropagation(); stopRecording() }}>
              ■ Stop
            </button>
          </div>

          {/* Tap anywhere hint */}
          {scrolling && (
            <div style={S.tapHint}>Tap anywhere to pause scroll</div>
          )}

          {/* REC indicator */}
          <div style={S.recDot} />

          {/* Processing overlay — shown while encoders flush after pressing stop */}
          {processing && (
            <div style={{
              position: 'absolute', inset: 0, zIndex: 20,
              background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16
            }}>
              <div style={{
                width: 48, height: 48, border: '4px solid rgba(255,255,255,0.2)',
                borderTopColor: '#E1306C', borderRadius: '50%',
                animation: 'spin 0.9s linear infinite'
              }} />
              <div style={{ color: '#fff', fontWeight: 700, fontSize: '1rem' }}>Saving your video...</div>
              <div style={{ color: 'rgba(255,255,255,0.55)', fontSize: '0.8rem' }}>Encoding to MP4, just a moment</div>
            </div>
          )}
        </div>
      )}

      {/* ─── DONE PHASE ─── */}
      {phase === 'done' && outputBlob && (
        <div style={S.doneWrap}>
          <div style={S.doneCard}>
            <div style={{ fontSize: '2.5rem' }}>🎬</div>
            <h2 style={{ margin: 0, fontWeight: 800, fontSize: '1.3rem', color: 'var(--text)' }}>Recording saved!</h2>
            <p style={{ margin: 0, color: 'var(--text-muted)', fontSize: '0.87rem' }}>
              {fmt(elapsed)} recorded · Ready to download
            </p>

            <video
              src={URL.createObjectURL(outputBlob)}
              controls
              style={{ width: '100%', maxWidth: 440, borderRadius: 12, background: '#000' }}
            />

            {/* ── Trim controls ── */}
            <div style={{ width: '100%', background: 'var(--surface2)', border: '1px solid var(--border)', borderRadius: 12, padding: '14px 16px' }}>
              <div style={{ fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 10 }}>✂️ Trim Video</div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', width: 50 }}>Start</span>
                  <input
                    type="range" min={0} max={elapsed} step={0.5}
                    value={trimStart}
                    onChange={e => setTrimStart(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', width: 32, textAlign: 'right' }}>{fmt(trimStart)}</span>
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', width: 50 }}>End</span>
                  <input
                    type="range" min={0} max={elapsed} step={0.5}
                    value={trimEnd || elapsed}
                    onChange={e => setTrimEnd(Number(e.target.value))}
                    style={{ flex: 1, accentColor: 'var(--accent)' }}
                  />
                  <span style={{ fontSize: '0.78rem', color: 'var(--text-muted)', width: 32, textAlign: 'right' }}>{fmt(trimEnd || elapsed)}</span>
                </div>
              </div>
              <button
                style={{ ...S.ghostBtn, marginTop: 10, width: '100%', opacity: trimming ? 0.55 : 1 }}
                onClick={handleTrim}
                disabled={trimming}
              >
                {trimming ? '⏳ Trimming...' : '✂️ Apply Trim'}
              </button>
            </div>

            <button style={S.recordBtn} onClick={download}>
              ⬇ Download (.MP4)
            </button>

            <div style={{ display: 'flex', gap: 10, width: '100%' }}>
              <button
                style={{ ...S.ghostBtn, flex: 1 }}
                onClick={() => { setPhase('setup'); setOutputBlob(null); scrollPosRef.current = 0 }}
              >
                ↺ Record Again
              </button>
              <button
                style={{ ...S.ghostBtn, flex: 1 }}
                onClick={() => { setPhase('setup'); setScript(''); setOutputBlob(null); scrollPosRef.current = 0 }}
              >
                + New Recording
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

/* ─────────────── styles ─────────────── */
const S = {

  setupWrap: {
    display: 'flex', gap: 24, padding: '24px 20px', maxWidth: 960, margin: '0 auto', width: '100%', flexWrap: 'wrap',
  },
  setupLeft: { flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column' },
  setupRight: { flex: 1, minWidth: 280, display: 'flex', flexDirection: 'column', gap: 14 },

  sectionLabel: { fontSize: '0.7rem', fontWeight: 700, letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--text-faint)', marginBottom: 8 },

  scriptEditor: {
    flex: 1, minHeight: 320, padding: '14px 16px', borderRadius: 12,
    border: '1px solid var(--accent)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: '0.92rem', lineHeight: 1.7,
    resize: 'vertical', fontFamily: 'inherit',
    outline: 'none',
  },
  scriptPreview: {
    flex: 1, minHeight: 320, padding: '14px 16px', borderRadius: 12,
    border: '1px solid var(--border)', background: 'var(--surface)',
    color: 'var(--text)', fontSize: '0.92rem', lineHeight: 1.7,
    cursor: 'text', overflowY: 'auto', whiteSpace: 'pre-wrap',
  },
  scriptEmpty: { color: 'var(--text-faint)', fontStyle: 'italic' },

  ghostBtn: {
    background: 'transparent', border: '1px solid var(--border)', borderRadius: 8,
    color: 'var(--text-faint)', padding: '8px 14px', fontSize: '0.83rem', cursor: 'pointer',
  },

  cameraBox: {
    position: 'relative', width: '100%', aspectRatio: '16/9',
    background: '#000', borderRadius: 14, overflow: 'hidden',
  },
  cameraVideo: { width: '100%', height: '100%', objectFit: 'cover', display: 'block' },
  cameraErr: {
    position: 'absolute', inset: 0, display: 'flex', flexDirection: 'column',
    alignItems: 'center', justifyContent: 'center', padding: 20, color: 'var(--text-faint)',
  },
  flipBtn: {
    position: 'absolute', top: 10, right: 10,
    background: 'rgba(0,0,0,0.55)', color: '#fff', border: 'none',
    borderRadius: '50%', width: 34, height: 34, fontSize: '1.1rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  },

  settingsGrid: { display: 'flex', flexDirection: 'column', gap: 10 },
  settingGroup: { display: 'flex', alignItems: 'center', gap: 10 },
  settingLabel: { fontSize: '0.74rem', fontWeight: 600, color: 'var(--text-faint)', width: 84, flexShrink: 0 },
  chips: { display: 'flex', gap: 6, flexWrap: 'wrap' },
  chip: { padding: '5px 12px', borderRadius: 7, fontSize: '0.78rem', fontWeight: 600, border: '1px solid var(--border)', background: 'var(--surface2)', color: 'var(--text)', cursor: 'pointer', transition: 'all 0.15s' },
  chipOn: { background: 'var(--accent)', borderColor: 'var(--accent)', color: '#fff' },

  // filter picker
  filterStrip: {
    display: 'flex', gap: 10, overflowX: 'auto', paddingBottom: 6,
    scrollbarWidth: 'none',
  },
  filterChip: {
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 5,
    background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 10, padding: '8px 10px', cursor: 'pointer',
    minWidth: 64, flexShrink: 0, transition: 'all 0.18s',
  },
  filterSwatch: {
    width: 40, height: 28, borderRadius: 6, flexShrink: 0,
  },
  filterLabel: { fontSize: '1rem', lineHeight: 1 },
  filterName: {
    fontSize: '0.6rem', fontWeight: 700, color: 'var(--text-faint)',
    textTransform: 'uppercase', letterSpacing: '0.05em', textAlign: 'center',
    whiteSpace: 'nowrap',
  },

  // grid overlay
  gridOverlay: { position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 },
  gridLine: (pos, dir) => dir === 'h'
    ? { position: 'absolute', top: pos, left: 0, right: 0, height: 1, background: 'rgba(255,255,255,0.35)' }
    : { position: 'absolute', left: pos, top: 0, bottom: 0, width: 1, background: 'rgba(255,255,255,0.35)' },

  // filter arrow navigation
  filterArrow: {
    width: 36, height: 36, borderRadius: '50%', border: '1px solid var(--border)',
    background: 'var(--surface2)', color: 'var(--text)', fontSize: '1.3rem',
    cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, transition: 'all 0.15s',
  },
  filterCard: {
    flex: 1, background: 'var(--surface2)', border: '1px solid var(--border)',
    borderRadius: 12, padding: '10px 12px',
  },


  recordBtn: {
    padding: '13px', borderRadius: 12, border: 'none',
    background: '#E1306C', color: '#fff', fontWeight: 800, fontSize: '0.95rem',
    cursor: 'pointer', width: '100%', letterSpacing: '0.02em',
    boxShadow: '0 4px 16px rgba(225,48,108,0.35)',
  },
  recordBtnOff: { opacity: 0.45, cursor: 'not-allowed', boxShadow: 'none' },

  // fullscreen recording
  fullscreen: {
    position: 'fixed', inset: 0, background: '#000', zIndex: 100,
    display: 'flex', alignItems: 'center', justifyContent: 'center',
  },
  fullVideo: { position: 'absolute', inset: 0, width: '100%', height: '100%', objectFit: 'cover' },

  gradTop: {
    position: 'absolute', top: 0, left: 0, right: 0, height: '30%',
    background: 'linear-gradient(to bottom, rgba(0,0,0,0.75), transparent)',
    pointerEvents: 'none', zIndex: 2,
  },
  gradBottom: {
    position: 'absolute', bottom: 0, left: 0, right: 0, height: '25%',
    background: 'linear-gradient(to top, rgba(0,0,0,0.8), transparent)',
    pointerEvents: 'none', zIndex: 2,
  },

  scriptScroll: {
    position: 'absolute', inset: 0, zIndex: 3,
    overflowY: 'scroll', overflowX: 'hidden',
    scrollbarWidth: 'none',
    padding: '0 40px',
    cursor: 'pointer',
  },
  scriptText: {
    margin: 0, color: '#fff', fontWeight: 700, lineHeight: 1.65,
    textAlign: 'center', textShadow: '0 2px 12px rgba(0,0,0,0.9)',
    whiteSpace: 'pre-wrap',
  },

  hud: {
    position: 'absolute', bottom: 0, left: 0, right: 0, zIndex: 5,
    padding: '14px 20px 32px',
    display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12,
  },
  timer: { color: '#fff', fontWeight: 800, fontSize: '1.1rem', fontVariantNumeric: 'tabular-nums', letterSpacing: '0.05em', textShadow: '0 1px 6px rgba(0,0,0,0.8)' },
  hudControls: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 8 },
  hudBtn: { background: 'rgba(255,255,255,0.15)', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 20, color: '#fff', padding: '6px 16px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', backdropFilter: 'blur(4px)' },
  hudChip: { background: 'rgba(255,255,255,0.12)', border: '1px solid rgba(255,255,255,0.25)', borderRadius: 6, color: 'rgba(255,255,255,0.75)', padding: '4px 10px', fontSize: '0.74rem', fontWeight: 600, cursor: 'pointer' },
  hudChipOn: { background: 'rgba(255,255,255,0.3)', color: '#fff', borderColor: 'rgba(255,255,255,0.5)' },
  stopBtn: { background: 'rgba(225,48,108,0.85)', border: 'none', borderRadius: 10, color: '#fff', padding: '10px 20px', fontSize: '0.9rem', fontWeight: 700, cursor: 'pointer', backdropFilter: 'blur(4px)' },

  tapHint: { position: 'absolute', top: 20, left: 0, right: 0, textAlign: 'center', color: 'rgba(255,255,255,0.45)', fontSize: '0.75rem', zIndex: 5, pointerEvents: 'none' },
  recDot: { position: 'absolute', top: 18, right: 20, width: 10, height: 10, borderRadius: '50%', background: '#ff3b30', zIndex: 5, boxShadow: '0 0 8px rgba(255,59,48,0.8)', animation: 'pulse 1.2s ease-in-out infinite' },

  countdownOverlay: { position: 'absolute', inset: 0, zIndex: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)' },
  countdownNum: { fontSize: '10rem', fontWeight: 900, color: '#fff', textShadow: '0 0 40px rgba(255,255,255,0.4)', lineHeight: 1 },

  doneWrap: { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '40px 20px' },
  doneCard: { background: 'var(--surface)', border: '1px solid var(--border)', borderRadius: 18, padding: '32px 28px', maxWidth: 480, width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, textAlign: 'center' },
}
