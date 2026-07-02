const { validationResult } = require('express-validator');
const prisma         = require('../config/prisma');
const aiService      = require('../services/aiService');
const planService    = require('../services/planService');
const { checkAndAwardBadges, updateStreak } = require('../services/badgeService');

// ─── GET /api/scripts/check-quota ────────────────────────────────
const checkQuota = async (req, res, next) => {
  try {
    const { allowed, used, limit } = await planService.checkGenerationLimit(req.user.id)
    if (!allowed) {
      return res.status(403).json({
        error: `You've used all ${limit} generations this month. Upgrade to continue.`,
        used, limit,
      })
    }
    return res.json({ allowed: true, used, limit })
  } catch (err) { next(err) }
}

// ─── POST /api/scripts/save (called by Vercel Edge after streaming) ─
const save = async (req, res, next) => {
  try {
    const { topic, niche, tone, language, hook, body, cta, fullScript } = req.body
    const { used, limit } = await planService.checkGenerationLimit(req.user.id)

    const script = await prisma.script.create({
      data: { userId: req.user.id, topic, niche: niche || null, tone: tone || null, hook, body, cta, fullScript, hookScore: 0 },
    })

    const [_, newStreak] = await Promise.all([planService.incrementGenerations(req.user.id), updateStreak(req.user.id)])
    const newBadges = await checkAndAwardBadges(req.user.id)

    // Score hook in background
    aiService.scoreHook(hook, language)
      .then(async (d) => {
        await Promise.all([
          prisma.script.update({ where: { id: script.id }, data: { hookScore: d.score } }),
          prisma.hookScore.create({
            data: { userId: req.user.id, scriptId: script.id, hookText: hook, score: d.score, grade: d.grade, status: d.status, reasons: JSON.stringify(d.reasons) },
          }),
        ])
      })
      .catch(() => {})

    return res.status(201).json({
      id      : script.id,
      used    : used + 1,
      limit,
      newStreak,
      newBadges: newBadges.length > 0 ? newBadges : undefined,
    })
  } catch (err) { next(err) }
}

// ─── POST /api/scripts/generate-stream (SSE) ─────────────────────
const generateStream = async (req, res, next) => {
  res.setHeader('Content-Type',  'text/event-stream')
  res.setHeader('Cache-Control', 'no-cache')
  res.setHeader('Connection',    'keep-alive')
  res.setHeader('X-Accel-Buffering', 'no') // disable nginx buffering
  res.flushHeaders()

  const send = (data) => res.write(`data: ${JSON.stringify(data)}\n\n`)

  try {
    // 1. Plan limit check
    const { allowed, used, limit } = await planService.checkGenerationLimit(req.user.id)
    if (!allowed) {
      send({ type: 'error', message: `You've used all ${limit} generations this month. Upgrade to continue.` })
      return res.end()
    }

    const { topic, niche, tone, language, voiceInstruction } = req.body

    const userRow = await prisma.user.findUnique({
      where : { id: req.user.id },
      select: { creatorStyle: true },
    })
    const voiceProfile = userRow?.creatorStyle ? JSON.parse(userRow.creatorStyle) : null

    // 2. Stream script tokens to client
    let parsedScript = null
    for await (const event of aiService.generateScriptStream({ topic, niche, tone, language, voiceInstruction, voiceProfile })) {
      if (event.type === 'chunk') {
        send(event)
      } else if (event.type === 'parsed') {
        parsedScript = event
      }
    }

    if (!parsedScript) {
      send({ type: 'error', message: 'Script generation failed. Please try again.' })
      return res.end()
    }

    const { hook, body, cta, fullScript } = parsedScript

    // 3. Save script (placeholder hookScore=0, updated async below)
    const script = await prisma.script.create({
      data: { userId: req.user.id, topic, niche: niche || null, tone: tone || null, hook, body, cta, fullScript, hookScore: 0 },
    })

    // 4. Usage + streak in parallel
    const [_, newStreak] = await Promise.all([
      planService.incrementGenerations(req.user.id),
      updateStreak(req.user.id),
    ])
    const newBadges = await checkAndAwardBadges(req.user.id)

    // 5. Send structured script — client can now render sections
    send({
      type     : 'script',
      data     : { id: script.id, topic, hook, body, cta, fullScript, voiceUsed: voiceProfile ? voiceProfile.summary : null },
      usage    : { used: used + 1, limit },
      newStreak,
      newBadges: newBadges.length > 0 ? newBadges : undefined,
    })

    // 6. Score hook in background — don't block, send when ready
    aiService.scoreHook(hook, language)
      .then(async (hookScoreData) => {
        send({ type: 'hookScore', data: hookScoreData })

        await Promise.all([
          prisma.script.update({ where: { id: script.id }, data: { hookScore: hookScoreData.score } }),
          prisma.hookScore.create({
            data: {
              userId  : req.user.id,
              scriptId: script.id,
              hookText: hook,
              score   : hookScoreData.score,
              grade   : hookScoreData.grade,
              status  : hookScoreData.status,
              reasons : JSON.stringify(hookScoreData.reasons),
            },
          }),
        ])
      })
      .catch(() => {})
      .finally(() => res.end())

  } catch (err) {
    send({ type: 'error', message: err.message || 'Something went wrong' })
    res.end()
  }
}

// ─── POST /api/scripts/generate ──────────────────────────────────
const generate = async (req, res, next) => {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) return res.status(400).json({ errors: errors.array() });

    // 1. Check plan limits
    const { allowed, used, limit } = await planService.checkGenerationLimit(req.user.id);
    if (!allowed) {
      return res.status(403).json({
        error  : `You have used all ${limit} script generations for this month.`,
        upgrade: 'Upgrade your plan to generate more scripts.',
        used, limit,
      });
    }

    // 2. Load voice profile
    const userRow = await prisma.user.findUnique({
      where : { id: req.user.id },
      select: { creatorStyle: true },
    });
    const voiceProfile = userRow?.creatorStyle ? JSON.parse(userRow.creatorStyle) : null;

    // 3. Generate script via AI
    const { topic, niche, tone, language } = req.body;
    const { hook, body, cta, fullScript } = await aiService.generateScript({ topic, niche, tone, language, voiceProfile });

    // 4. Save script immediately (hookScore placeholder — scored async below)
    const script = await prisma.script.create({
      data: { userId: req.user.id, topic, niche: niche || null, tone: tone || null, hook, body, cta, fullScript, hookScore: 0 },
    });

    // 4. Usage + streak in parallel
    const [_, newStreak] = await Promise.all([
      planService.incrementGenerations(req.user.id),
      updateStreak(req.user.id),
    ]);
    const newBadges = await checkAndAwardBadges(req.user.id);

    // 5. Return script to user immediately — don't wait for hook scoring
    const response = {
      message: 'Script generated successfully!',
      script : { id: script.id, topic, hook, body, cta, fullScript, hookScore: null, voiceUsed: voiceProfile ? voiceProfile.summary : null },
      usage  : { used: used + 1, limit },
      newStreak,
    };
    if (newBadges.length > 0) response.newBadges = newBadges;
    res.status(201).json(response);

    // 6. Score hook in background — saves to DB, doesn't block the user
    aiService.scoreHook(hook, language)
      .then(async (hookScoreData) => {
        await Promise.all([
          prisma.script.update({ where: { id: script.id }, data: { hookScore: hookScoreData.score } }),
          prisma.hookScore.create({
            data: {
              userId  : req.user.id,
              scriptId: script.id,
              hookText: hook,
              score   : hookScoreData.score,
              grade   : hookScoreData.grade,
              status  : hookScoreData.status,
              reasons : JSON.stringify(hookScoreData.reasons),
            },
          }),
        ]);
      })
      .catch(() => {});

    return;
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/scripts ─────────────────────────────────────────────
const getAll = async (req, res, next) => {
  try {
    const scripts = await prisma.script.findMany({
      where  : { userId: req.user.id },
      orderBy: { createdAt: 'desc' },
      select : {
        id        : true,
        topic     : true,
        hook      : true,
        hookScore : true,
        createdAt : true,
      },
    });
    return res.json({ scripts });
  } catch (err) {
    next(err);
  }
};

// ─── GET /api/scripts/:id ─────────────────────────────────────────
const getOne = async (req, res, next) => {
  try {
    const script = await prisma.script.findFirst({
      where: { id: req.params.id, userId: req.user.id },
    });
    if (!script) return res.status(404).json({ error: 'Script not found.' });
    return res.json({ script });
  } catch (err) {
    next(err);
  }
};

// ─── POST /api/scripts/retake ─────────────────────────────────────────────────
// Free re-roll on the same topic (e.g. user changed the tone). Capped on the
// client (MAX_RETAKES per topic), so it does NOT consume a plan generation.
const retake = async (req, res, next) => {
  try {
    const { topic, niche, tone, language, audience, duration } = req.body;
    if (!topic || !topic.trim()) return res.status(400).json({ error: 'Topic is required.' });

    const userRow = await prisma.user.findUnique({
      where : { id: req.user.id },
      select: { creatorStyle: true },
    });
    const voiceProfile = userRow?.creatorStyle ? JSON.parse(userRow.creatorStyle) : null;

    const [{ hook, body, cta, fullScript }, visualMusicData] = await Promise.all([
      aiService.generateScript({ topic, niche, tone, language, audience, voiceProfile, duration }),
      aiService.generateVisualMusic({ topic, niche, hook: '', audience: audience || 'India' })
        .catch(() => null),
    ]);

    const script = await prisma.script.create({
      data: { userId: req.user.id, topic, niche: niche || null, tone: tone || null, hook, body, cta, fullScript, hookScore: 0 },
    });

    return res.json({
      script: {
        id: script.id, topic, hook, body, cta, fullScript,
        visual: visualMusicData?.visual || null,
        music : visualMusicData?.music  || null,
      },
    });
  } catch (err) { next(err); }
};

// ─── POST /api/scripts/refine ───────────────────────────────────────────
// Targeted tweak of an existing script (chip instruction). Free — no quota cost.
const refine = async (req, res, next) => {
  try {
    const { hook, body, cta, instruction, language, audience, topic } = req.body;
    if (!instruction || !instruction.trim()) return res.status(400).json({ error: 'Refinement instruction is required.' });
    if (!hook && !body && !cta) return res.status(400).json({ error: 'Nothing to refine yet.' });

    const refined = await aiService.refineScript({ hook, body, cta, instruction, language, audience, topic });
    return res.json({ script: refined });
  } catch (err) { next(err); }
};

// ─── POST /api/scripts/songs ─────────────────────────────────────────────
// AI background-music / song picks for a generated script. Free — no quota cost.
const songs = async (req, res, next) => {
  try {
    const { hook, body, cta, topic, niche, tone, genre, mood, bpm, audience, language } = req.body;
    if (!hook && !body && !topic) {
      return res.status(400).json({ error: 'A script or topic is required.' });
    }
    const aiData = await aiService.recommendSongs({ hook, body, cta, topic, niche, tone, genre, mood, bpm, audience, language });
    const spotifyService = require('../services/spotifyService');
    const enriched = await spotifyService.enrichSongs(aiData.songs);
    return res.json({ songs: enriched });
// ─── GET /api/scripts/search-music ──────────────────────────────────────────
const searchMusic = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || !q.trim()) {
      return res.json({ songs: [] });
    }
    
    const spotifyService = require('../services/spotifyService');
    const results = await spotifyService.searchTracks(q.trim(), 8);
    
    // Cross-reference with our TrendingAudio database to check if search results match trending tracks
    const enrichedResults = await Promise.all(results.map(async (song) => {
      const match = await prisma.trendingAudio.findFirst({
        where: {
          title: { equals: song.title, mode: 'insensitive' },
          artist: { contains: song.artist.split(',')[0].trim(), mode: 'insensitive' }
        }
      });
      if (match) {
        return {
          ...song,
          trending: true,
          instagramAudioId: match.instagramAudioId,
          usedCount: match.usedCount
        };
      }
      return song;
    }));
    
    return res.json({ songs: enrichedResults });
  } catch (err) {
    next(err);
  }
};

module.exports = { checkQuota, save, generateStream, generate, getAll, getOne, retake, refine, songs, searchMusic };
