const https   = require('https');
const http    = require('http');
const { URL } = require('url');
const aiService = require('../services/aiService');

const ALLOWED_AUDIO_HOSTS = [
  'audio-ssl.itunes.apple.com',
  'audio.itunes.apple.com',
  'cdn.pixabay.com',
];

// POST /api/reel-ready/analyze
const analyze = async (req, res, next) => {
  try {
    const { frames, mediaTypes, audience = 'India', language = 'en' } = req.body;

    if (!frames || !Array.isArray(frames) || frames.length === 0) {
      return res.status(400).json({ error: 'No frames provided.' });
    }

    // 1. Analyse the visual content
    const analysis = await aiService.analyzeReelContent({
      imageBase64Array: frames,
      mediaTypes: mediaTypes || frames.map(() => 'image/jpeg'),
      audience,
      language,
    });

    // 2. Get song picks based on what the AI understood about the content
    const songResult = await aiService.recommendSongs({
      hook    : analysis.script?.slice(0, 120) || '',
      body    : analysis.script || '',
      cta     : '',
      topic   : analysis.topic   || '',
      niche   : analysis.niche   || 'general',
      tone    : analysis.tone    || 'motivational',
      mood    : analysis.mood    || '',
      audience,
      language,
    });

    return res.json({ analysis, songs: songResult.songs || [] });
  } catch (err) {
    next(err);
  }
};

// POST /api/reel-ready/more-captions
const moreCaptions = async (req, res, next) => {
  try {
    const { contentUnderstanding, topic, niche, tone, mood, audience = 'India', language = 'en' } = req.body;

    if (!contentUnderstanding) {
      return res.status(400).json({ error: 'contentUnderstanding is required.' });
    }

    const captions = await aiService.generateMoreCaptions({
      contentUnderstanding,
      topic,
      niche,
      tone,
      mood,
      audience,
      language,
    });

    return res.json({ captions });
  } catch (err) {
    next(err);
  }
};

// GET /api/reel-ready/audio?url=ENCODED_URL
// Proxy iTunes 30s previews to bypass browser CORS for AudioContext
const proxyAudio = async (req, res, next) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'url query param required' });

    let parsed;
    try { parsed = new URL(decodeURIComponent(url)); } catch {
      return res.status(400).json({ error: 'Invalid URL' });
    }

    if (!ALLOWED_AUDIO_HOSTS.includes(parsed.hostname)) {
      return res.status(403).json({ error: 'Audio host not allowed' });
    }

    const transport = parsed.protocol === 'https:' ? https : http;
    const proxyReq  = transport.get(parsed.href, (proxyRes) => {
      res.setHeader('Content-Type', proxyRes.headers['content-type'] || 'audio/mpeg');
      res.setHeader('Accept-Ranges', 'bytes');
      res.setHeader('Cache-Control', 'public, max-age=86400');
      res.setHeader('Access-Control-Allow-Origin', '*');
      res.status(proxyRes.statusCode || 200);
      proxyRes.pipe(res);
    });

    proxyReq.on('error', next);
  } catch (err) {
    next(err);
  }
};

module.exports = { analyze, moreCaptions, proxyAudio };
