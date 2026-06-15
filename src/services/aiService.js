const Anthropic = require('@anthropic-ai/sdk');
const trendsService = require('./trendsService');

const MODEL       = 'claude-sonnet-4-6';           // Quality model for creative tasks
const MODEL_FAST  = 'claude-haiku-4-5-20251001';   // Fast model for scoring/rewriting

// ─── Language instruction helper ─────────────────────────────────
// NOTE: 'en' has an EXPLICIT instruction so the AI never drifts into
// Hinglish / code-switching when the audience context is India or
// another non-English region. Language and region are fully independent.
const LANG_INSTRUCTIONS = {
  en:       'IMPORTANT: Write ALL content entirely in English. Every single word must be in English only — no Hindi, no transliteration, no code-switching, no regional words. Cultural references (cricket, Bollywood, ₹) are fine, but the language of every sentence must be pure English.',
  hi:       'IMPORTANT: Write ALL content entirely in Hindi (Devanagari script). Every word must be in Hindi only — no English words or Hinglish mixing.',
  es:       'IMPORTANT: Write ALL content entirely in Spanish. Every word must be in Spanish only.',
  fr:       'IMPORTANT: Write ALL content entirely in French. Every word must be in French only.',
  pt:       'IMPORTANT: Write ALL content entirely in Portuguese (Brazilian). Every word must be in Portuguese only.',
  de:       'IMPORTANT: Write ALL content entirely in German. Every word must be in German only.',
  ar:       'IMPORTANT: Write ALL content entirely in Arabic. Every word must be in Arabic only. Use right-to-left text naturally.',
  id:       'IMPORTANT: Write ALL content entirely in Bahasa Indonesia. Every word must be in Bahasa Indonesia only.',
  ja:       'IMPORTANT: Write ALL content entirely in Japanese. Every word must be in Japanese only.',
  ko:       'IMPORTANT: Write ALL content entirely in Korean. Every word must be in Korean only.',
}

const getLangInstruction = (language) => LANG_INSTRUCTIONS[language] || LANG_INSTRUCTIONS['en']

// ─── Audience / geography context ────────────────────────────────
const AUDIENCE_CONTEXTS = {
  India: `TARGET AUDIENCE: India 🇮🇳
- Use Indian currency (₹, lakhs, crores) — NEVER use $ or USD
- Reference Indian cities and scenarios (Mumbai, Delhi, Bangalore, tier-2 cities)
- Use Indian cultural anchors: cricket, Bollywood, chai, festivals (Diwali, Holi), UPI, Zomato/Swiggy, Instagram Reels culture
- Relatable Indian pain points: job pressure, family expectations, real estate prices, competitive exams (CAT/UPSC/JEE)
- Indian aspirations: financial freedom, starting a business, going viral, cracking a dream job
- Indian social proof: "10 lakh views", "5 lakh followers", "₹50,000/month"
- Speak to both metro and tier-2 audiences — keep it grounded and real`,

  'US': `TARGET AUDIENCE: United States 🇺🇸
- Use US currency ($) and American cultural references
- Reference US scenarios: side hustle culture, 9-5 grind, student loans, credit scores, Amazon/Netflix
- American pain points: inflation, healthcare costs, work-life balance, hustle culture
- Social proof in US numbers: "$10K/month", "1M views", "100K followers"`,

  'UK': `TARGET AUDIENCE: United Kingdom 🇬🇧
- Use British currency (£) and UK cultural references
- Reference UK scenarios: cost of living crisis, NHS, commuting in London, British humour
- British tone: slightly understated, dry wit works well`,

  'Middle East': `TARGET AUDIENCE: Middle East 🇦🇪
- Use local currency references (AED, SAR, KWD) or keep amounts in USD
- Reference regional culture: Ramadan content, luxury lifestyle, family values, business culture in Dubai/Riyadh
- Arabic/English bilingual content performs well — keep it aspirational`,

  'Southeast Asia': `TARGET AUDIENCE: Southeast Asia 🌏
- Reference countries like Indonesia, Philippines, Malaysia, Thailand, Vietnam
- Use relatable local scenarios, hustle culture, growing middle class aspirations
- Keep currency references flexible (IDR, PHP, MYR) or use USD`,

  'Global': `TARGET AUDIENCE: Global 🌐
- Use universal examples that resonate across all cultures
- Avoid region-specific currency, celebrities, or cultural references
- Keep examples generic, aspirational, and universally understood`,
}

const getAudienceContext = (audience) => AUDIENCE_CONTEXTS[audience] || AUDIENCE_CONTEXTS['Global']

// ─── Helper — client created per-call so it always picks up the env var ─
const ask = async (prompt, maxTokens = 1024, model = MODEL) => {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  const response = await client.messages.create({
    model,
    max_tokens: maxTokens,
    messages  : [{ role: 'user', content: prompt }],
  });
  return response.content[0].text.trim();
};

// ─────────────────────────────────────────────────────────────────
// 0a. ANALYZE CREATOR STYLE  (premium voice fingerprinting)
// ─────────────────────────────────────────────────────────────────
const analyzeCreatorStyle = async (samples) => {
  const combinedSamples = samples
    .map((s, i) => `--- Sample ${i + 1} ---\n${s.trim()}`)
    .join('\n\n')

  const prompt = `
You are a professional voice and style analyst for short-form video creators.
Analyze the writing samples below and extract a detailed "voice fingerprint" for this creator.

SAMPLES:
${combinedSamples}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "summary": "One punchy sentence (max 25 words) capturing the essence of this creator's voice — their style, energy, and what makes them unique",
  "energy": "One of: High-energy & urgent | Calm & conversational | Motivational & inspiring | Educational & precise | Playful & humorous | Dramatic & storytelling",
  "sentenceStyle": "Describe their sentence length and rhythm in one sentence (e.g. 'Short punchy lines, usually 6-9 words, with frequent pauses for effect')",
  "vocabulary": "Describe their vocabulary level and style in one sentence",
  "humor": "Describe their humor style or write 'None — serious tone' if not present",
  "structure": "Their typical content structure in one sentence (e.g. 'Opens with personal failure → shares the lesson → gives actionable tip → soft CTA')",
  "signature": "Any signature phrases, patterns, or verbal habits they repeat (or 'None detected')",
  "promptInstruction": "A 3-4 sentence instruction paragraph written in second person ('You write like...') that would help an AI mimic this exact voice. Be very specific — mention vocabulary choices, sentence patterns, energy, structure, and any unique quirks. This is injected directly into the script generation prompt."
}
`

  const raw = await ask(prompt, 800, MODEL_FAST)
  try {
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON')
    return JSON.parse(match[0])
  } catch {
    return null
  }
}

// ─────────────────────────────────────────────────────────────────
// 0. REFINE SCRIPT (iteration on existing result)
// ─────────────────────────────────────────────────────────────────
const refineScript = async ({ hook, body, cta, instruction, language = 'en', audience = 'India', topic = '' }) => {
  const langInstruction    = getLangInstruction(language)
  const audienceInstruction = getAudienceContext(audience)

  const prompt = `
You are refining an existing viral short-form video script based on the creator's feedback.

LANGUAGE RULE (non-negotiable):
${langInstruction}

AUDIENCE CONTEXT (cultural references only — does NOT change the language):
${audienceInstruction}

ORIGINAL TOPIC: ${topic}

CURRENT SCRIPT:
HOOK: ${hook}
BODY: ${body}
CTA: ${cta}

CREATOR'S REFINEMENT INSTRUCTION:
"${instruction}"

Your job:
- Apply the instruction PRECISELY — change only what is asked
- Keep everything that is already strong and working
- If the hook needs to change, make it Grade A (85+ score worthy)
- Maintain the same language and tone unless explicitly told otherwise
- Keep total speaking time 60-90 seconds

Return ONLY the refined script in this exact format — no commentary:

HOOK:
[refined hook]

BODY:
[refined body]

CTA:
[refined cta]
`;

  const raw = await ask(prompt, 1200);
  const hookMatch = raw.match(/HOOK[^:]*:\s*([\s\S]*?)(?=BODY|$)/i);
  const bodyMatch = raw.match(/BODY[^:]*:\s*([\s\S]*?)(?=CTA|$)/i);
  const ctaMatch  = raw.match(/CTA[^:]*:\s*([\s\S]*?)$/i);

  return {
    hook      : hookMatch ? hookMatch[1].trim() : hook,
    body      : bodyMatch ? bodyMatch[1].trim() : body,
    cta       : ctaMatch  ? ctaMatch[1].trim()  : cta,
    fullScript: raw,
  };
};

// ─────────────────────────────────────────────────────────────────
// 1. GENERATE SCRIPT
// ─────────────────────────────────────────────────────────────────
const generateScript = async ({ topic, niche, tone, language = 'en', audience = 'India', voiceProfile = null, duration = '' }) => {
  const langInstruction    = getLangInstruction(language)
  const audienceInstruction = getAudienceContext(audience)

  // Build the voice-match instruction block (only for premium users with a saved profile)
  const voiceBlock = voiceProfile?.promptInstruction
    ? `\nCREATOR VOICE (match this style precisely — this is a premium personalisation):
${voiceProfile.promptInstruction}
Ignore generic "best practice" advice above if it conflicts with the creator's established voice. Their authenticity > textbook hooks.\n`
    : ''

  const durationInstruction = duration
    ? `- Target Duration: ${duration} minute${parseFloat(duration) === 1 ? '' : 's'} — calibrate the script length precisely for this. A 0.5 min script is ~75 words, 1 min ~150 words, 2 min ~300 words. Match the word count accordingly.`
    : ''

  const prompt = `
You are an expert viral content strategist who writes Grade A hooks that score 85+ on Instagram Reels and YouTube Shorts.

LANGUAGE RULE (non-negotiable):
${langInstruction}

AUDIENCE CONTEXT (cultural references only — does NOT change the language):
${audienceInstruction}
${voiceBlock}
Generate a high-performing short-form video script for the following:
- Topic : ${topic}
- Niche  : ${niche || 'general'}
- Tone   : ${tone  || 'engaging and conversational'}
${durationInstruction}

The script must follow this exact structure:

HOOK (first 3 seconds — must score Grade A, 85+/100 for scroll-stopping power):
Your hook will be graded on these 5 criteria — nail ALL of them:
1. EMOTIONAL TRIGGER: Spark a strong emotion — fear, FOMO, excitement, anger, or desire. Weak emotions = low scores.
2. CURIOSITY GAP: Create an open loop the viewer CANNOT fill without watching. They must feel "I NEED to see this."
3. CLARITY: Instantly understandable in under 2 seconds. No setup required.
4. SPECIFICITY: Use concrete numbers, names, or facts. Vague = forgettable. "3 clients ghosted me" beats "many people".
5. SCROLL-STOPPING POWER: Would a person mid-scroll freeze at this? If not, rewrite it.

STRICTLY AVOID these weak patterns:
- "What if I told you…" (too soft, predictable)
- "Have you ever…" (overused, no urgency)
- "Today I'm going to show you…" (boring, no hook)
- "In this video…" (nobody cares)
- Generic openers with no tension

USE these proven high-scoring patterns instead:
- Bold shocking claim: "I lost ₹2 lakh following this advice — here's what actually works"
- Fear/warning: "If you're doing [X], you're silently killing your [Y]"
- Surprising revelation: "Nobody tells you this about [topic] — and it cost me [X]"
- Specific failure/win: "I went from [bad state] to [good state] in [time] using one change"
- Open-ended tension: "The [topic] mistake every beginner makes — and how to fix it today"

Write 1-2 sentences ONLY. No setup. No preamble. Start with impact.

BODY (the main value — deliver on the hook's promise):
[3-5 punchy points or a mini story. Keep sentences short. No filler words.]

CTA (call to action — last 5 seconds):
[One clear action: follow, comment, save, or share. Make it feel natural, not forced.]

---
Rules:
- Write like you are talking to a friend, not presenting to a boardroom
- Do NOT use hashtags, emojis, or stage directions
- Return ONLY the script in the format above, no extra commentary

Script:
`;

  const raw = await ask(prompt, 1400);

  // Parse the three sections from the response
  const hookMatch = raw.match(/HOOK[^:]*:\s*([\s\S]*?)(?=BODY|$)/i);
  const bodyMatch = raw.match(/BODY[^:]*:\s*([\s\S]*?)(?=CTA|$)/i);
  const ctaMatch  = raw.match(/CTA[^:]*:\s*([\s\S]*?)$/i);

  return {
    hook      : hookMatch ? hookMatch[1].trim() : '',
    body      : bodyMatch ? bodyMatch[1].trim() : '',
    cta       : ctaMatch  ? ctaMatch[1].trim()  : '',
    fullScript: raw,
  };
};

// ─────────────────────────────────────────────────────────────────
// HOOK ALTERNATIVES — 3 improved rewrites for a weak hook
// Used by the Score page; no scriptId required
// ─────────────────────────────────────────────────────────────────
const generateHookAlternatives = async (hookText, score, language = 'en') => {
  const langInstruction = getLangInstruction(language)

  const prompt = `You are a viral hook specialist. A creator wrote this hook that scored ${score}/100 — it needs improvement.

LANGUAGE RULE (non-negotiable):
${langInstruction}

Original hook: "${hookText}"

Write 3 completely different, improved versions. Each must score 85+/100 by:
- Opening with maximum tension, specificity, or a bold claim
- Creating an irresistible curiosity gap
- Being instantly clear in under 2 seconds
- Using concrete numbers or facts where possible

Return ONLY valid JSON — no markdown, no code blocks:
[
  { "hook": "rewritten hook 1", "reason": "one sentence on why this is stronger" },
  { "hook": "rewritten hook 2", "reason": "one sentence on why this is stronger" },
  { "hook": "rewritten hook 3", "reason": "one sentence on why this is stronger" }
]`

  try {
    const raw = await ask(prompt, 600, MODEL_FAST)
    const cleaned = raw.replace(/```json|```/g, '').trim()
    const parsed = JSON.parse(cleaned)
    return Array.isArray(parsed) ? parsed.slice(0, 3) : []
  } catch {
    return []
  }
}

// ─────────────────────────────────────────────────────────────────
// 2. GENERATE VISUAL DIRECTION + MUSIC VIBE
// ─────────────────────────────────────────────────────────────────
const generateVisualMusic = async ({ topic, niche, hook, audience = 'India' }) => {
  const audienceInstruction = getAudienceContext(audience)

  const prompt = `
You are a professional short-form video director helping a creator produce a viral Instagram Reel or YouTube Short.

${'\n' + audienceInstruction + '\n'}

SCRIPT DETAILS:
- Topic  : ${topic}
- Niche  : ${niche || 'general'}
- Hook   : "${hook}"

Give the creator a practical production guide for shooting this reel.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "visual": {
    "background": "One specific background/setting description (e.g. 'Clean white wall with a ring light' or 'Busy café with blurred background')",
    "style": "Shooting style in 5-8 words (e.g. 'Talking head with bold text overlays')",
    "broll": [
      "Specific B-roll shot idea 1",
      "Specific B-roll shot idea 2",
      "Specific B-roll shot idea 3"
    ],
    "colorMood": "2-3 words describing the visual vibe (e.g. 'Dark, cinematic, bold' or 'Bright, clean, energetic')",
    "textOverlay": "Suggestion for on-screen text or caption style"
  },
  "music": {
    "genre": "Music genre (e.g. 'Lo-fi hip-hop' or 'Upbeat corporate')",
    "mood": "Mood in 3-4 words",
    "bpm": "Recommended BPM range (e.g. '110-125')",
    "searchQuery": "Exact search term to find this track on a free music site (e.g. 'motivational corporate upbeat no copyright')",
    "tip": "One practical tip about music timing or volume for this specific reel"
  }
}
`
  try {
    const raw = await ask(prompt, 600, MODEL_FAST)
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON')
    return JSON.parse(match[0])
  } catch {
    return {
      visual: {
        background : 'Clean, well-lit background — solid wall or minimal setup',
        style      : 'Talking head with text overlays',
        broll      : ['Close-up of hands demonstrating the concept', 'Screen recording or relevant product shot', 'Reaction shot or results reveal'],
        colorMood  : 'Clean, bright, professional',
        textOverlay: 'Bold key phrases on screen in sync with speech',
      },
      music: {
        genre      : 'Upbeat background',
        mood       : 'Energetic and motivating',
        bpm        : '110-130',
        searchQuery: 'upbeat motivational background music no copyright',
        tip        : 'Keep music at 10-15% volume — voice must be clearly audible',
      },
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// 3. SCORE A HOOK
// ─────────────────────────────────────────────────────────────────
const scoreHook = async (hookText, language = 'en') => {
  const langInstruction = getLangInstruction(language)
  const prompt = `
You are a viral content strategist who has analyzed thousands of short-form video hooks.
${langInstruction ? '\n' + langInstruction + ' Write the "reasons" array values in that language, but keep the JSON keys in English.\n' : ''}
Score this hook for its scroll-stopping potential on Instagram Reels / YouTube Shorts:

HOOK: "${hookText}"

Evaluate it on these 5 factors (20 points each):
1. Emotional trigger (does it spark curiosity, fear, excitement, or desire?)
2. Curiosity gap (does it make the viewer NEED to watch more?)
3. Clarity (is it instantly understandable in 2 seconds?)
4. Specificity (does it use concrete details rather than vague claims?)
5. Scroll-stopping power (would YOU stop scrolling for this?)

Return your response in this EXACT JSON format (no extra text):
{
  "score": <number 1-100>,
  "grade": "<A|B|C|D|F>",
  "status": "<Post Ready|Needs Improvement|Rewrite Recommended>",
  "reasons": [
    "<specific reason 1>",
    "<specific reason 2>",
    "<specific reason 3>"
  ]
}

Scoring guide:
- 75-100 → "Post Ready" (Grade A or B)
- 50-74  → "Needs Improvement" (Grade C)
- 0-49   → "Rewrite Recommended" (Grade D or F)
`;

  const raw = await ask(prompt, 400, MODEL_FAST); // Fast model — scoring is straightforward

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const parsed = JSON.parse(jsonMatch[0]);
    // Ensure reasons is always an array
    if (!Array.isArray(parsed.reasons)) parsed.reasons = [String(parsed.reasons)];
    return parsed;
  } catch {
    // Fallback if AI doesn't return clean JSON
    return {
      score  : 50,
      grade  : 'C',
      status : 'Needs Improvement',
      reasons: ['Could not parse detailed feedback. Try again.'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────
// 3. REWRITE A HOOK
// ─────────────────────────────────────────────────────────────────
const rewriteHook = async (originalHook, originalScore, language = 'en') => {
  const langInstruction = getLangInstruction(language)
  const prompt = `
You are a viral content strategist. This hook scored ${originalScore}/100 and needs improvement.
${langInstruction ? '\n' + langInstruction + ' Write the rewritten hook and changes explanation in that language, but keep the JSON keys in English.\n' : ''}
ORIGINAL HOOK: "${originalHook}"

Rewrite it to score at least ${Math.min(originalScore + 15, 95)}/100.
Keep the same topic and intent — only improve the wording.

Return your response in this EXACT JSON format (no extra text):
{
  "rewrittenHook": "<your improved hook>",
  "changes": "<1-2 sentences explaining exactly what you changed and why>"
}
`;

  const raw = await ask(prompt, 400, MODEL_FAST); // Fast model — rewriting is a simple task

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      rewrittenHook: originalHook,
      changes      : 'Could not generate rewrite. Please try again.',
    };
  }
};

// ─────────────────────────────────────────────────────────────────
// 4. ANALYZE PERFORMANCE
// ─────────────────────────────────────────────────────────────────
const analyzePerformance = async ({ topic, hookUsed, views, watchTimePercent, likes, shares, comments, pastLogs, language = 'en' }) => {
  const langInstruction = getLangInstruction(language)
  const pastContext = pastLogs && pastLogs.length > 0
    ? `\n\nThis creator's past content patterns:\n${pastLogs.map(l =>
        `- Topic: "${l.topic}" | Views: ${l.views} | Watch Time: ${l.watchTimePercent}%`
      ).join('\n')}`
    : '';

  const prompt = `
You are a data-driven content coach analyzing a creator's video performance.
${langInstruction ? '\n' + langInstruction + '\n' : ''}
VIDEO DETAILS:
- Topic        : ${topic}
- Hook used    : "${hookUsed}"
- Views        : ${views}
- Watch time   : ${watchTimePercent}%
- Likes        : ${likes}
- Shares       : ${shares}
- Comments     : ${comments}
${pastContext}

Write a plain-English performance analysis (3-4 paragraphs, no jargon):
1. What worked well and why
2. What likely hurt performance
3. One specific thing to do differently next time
4. A confidence-boosting closing line

Keep it conversational — like advice from a smart friend, not a corporate report.
`;

  return await ask(prompt, 600);
};

// ─────────────────────────────────────────────────────────────────
// 5. GET TRENDING TOPICS
// ─────────────────────────────────────────────────────────────────
const getTrendingTopics = async (niche = 'general', language = 'en') => {
  const langInstruction = getLangInstruction(language) ||
    'Respond in English.'

  const prompt = `
You are a viral content strategist tracking what's hot on Instagram Reels and YouTube Shorts RIGHT NOW.

${langInstruction}

Generate 10 trending topic ideas for a creator in the "${niche}" niche.
Each topic should be:
- Highly specific (not generic)
- Timely and relevant
- Optimized for short-form video (60-90 seconds)
- Likely to get high engagement

Return ONLY a JSON array of 10 objects. No extra text. Example:
[
  {"title": "Specific trend name", "description": "Why this matters for creators, in one actionable sentence.", "category": "Trending"}
]
`
  try {
    const raw = await ask(prompt, 600)
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array')
    return JSON.parse(match[0])
  } catch {
    const fallbackTopics = {
      hi: [
        {title: '30 दिनों में 1000 फॉलोअर्स कैसे पाए', description: 'यह रणनीति अभी बहुत काम कर रही है।', category: 'Growth'},
        {title: 'नए क्रिएटर्स की सबसे बड़ी गलती', description: 'लोग इन गलतियों से बचना चाहते हैं।', category: 'Tips'},
        {title: 'मेरी कंटेंट क्रिएशन रूटीन', description: 'पर्दे के पीछे का दृश्य हमेशा लोकप्रिय होता है।', category: 'Vlog'}
      ],
      es: [
        {title: 'Cómo gané 1000 seguidores en 30 días', description: 'Esta estrategia funciona muy bien ahora mismo.', category: 'Growth'},
        {title: 'El mayor error de los nuevos creadores', description: 'La gente quiere evitar estos errores comunes.', category: 'Tips'},
        {title: 'Mi rutina honesta de creación', description: 'El detrás de escena siempre es popular.', category: 'Vlog'}
      ],
      fr: [
        {title: 'Comment j\'ai gagné 1000 abonnés en 30 jours', description: 'Cette stratégie fonctionne très bien en ce moment.', category: 'Growth'},
        {title: 'La plus grande erreur des nouveaux créateurs', description: 'Les gens veulent éviter ces erreurs courantes.', category: 'Tips'},
        {title: 'Ma routine honnête de création', description: 'Les coulisses sont toujours populaires.', category: 'Vlog'}
      ],
      pt: [
        {title: 'Como conquistei 1000 seguidores em 30 dias', description: 'Esta estratégia funciona muito bem agora.', category: 'Growth'},
        {title: 'O maior erro dos novos criadores', description: 'As pessoas querem evitar esses erros.', category: 'Tips'},
        {title: 'Minha rotina honesta de criação', description: 'Os bastidores sempre são populares.', category: 'Vlog'}
      ],
      de: [
        {title: 'Wie ich in 30 Tagen 1000 Follower gewann', description: 'Diese Strategie funktioniert derzeit sehr gut.', category: 'Growth'},
        {title: 'Der größte Fehler neuer Creator', description: 'Die Leute wollen diese häufigen Fehler vermeiden.', category: 'Tips'},
        {title: 'Meine ehrliche Content-Routine', description: 'Hinter den Kulissen ist immer beliebt.', category: 'Vlog'}
      ],
      ar: [
        {title: 'كيف حصلت على 1000 متابع في 30 يوماً', description: 'هذه الاستراتيجية تعمل بشكل جيد الآن.', category: 'Growth'},
        {title: 'أكبر خطأ يرتكبه المبدعون الجدد', description: 'يريد الناس تجنب هذه الأخطاء.', category: 'Tips'},
        {title: 'روتيني الصادق في إنشاء المحتوى', description: 'كواليس العمل دائماً تحظى بشعبية.', category: 'Vlog'}
      ],
      id: [
        {title: 'Cara mendapat 1000 followers dalam 30 hari', description: 'Strategi ini bekerja dengan sangat baik sekarang.', category: 'Growth'},
        {title: 'Kesalahan terbesar kreator baru', description: 'Orang ingin menghindari kesalahan umum ini.', category: 'Tips'},
        {title: 'Rutina pembuatan konten saya yang jujur', description: 'Di balik layar selalu populer.', category: 'Vlog'}
      ],
      ja: [
        {title: '30日で1000フォロワーを獲得した方法', description: 'この戦略は今非常に効果的です。', category: 'Growth'},
        {title: '新人クリエイターの最大の失敗', description: '人々はこれらの失敗を避けたいと思っています。', category: 'Tips'},
        {title: '私の正直なコンテンツ制作ルーティン', description: '舞台裏は常に人気があります。', category: 'Vlog'}
      ],
      ko: [
        {title: '30일 만에 팔로워 1000명 얻는 방법', description: '이 전략은 현재 매우 효과적입니다.', category: 'Growth'},
        {title: '신규 크리에이터의 가장 큰 실수', description: '사람들은 이러한 실수를 피하고 싶어합니다.', category: 'Tips'},
        {title: '나의 솔직한 콘텐츠 제작 루틴', description: '비하인드 스토리는 항상 인기가 많습니다.', category: 'Vlog'}
      ],
    }
    return fallbackTopics[language] || [
      {title: 'How I gained 1000 followers in 30 days', description: 'This strategy is working incredibly well right now.', category: 'Growth'},
      {title: 'The biggest mistake new creators make', description: 'People want to avoid these common pitfalls.', category: 'Tips'},
      {title: 'My honest content creation routine', description: 'Behind-the-scenes content always performs well.', category: 'Vlog'}
    ]
  }
}

// ─────────────────────────────────────────────────────────────────
// 5b. GET TRENDING TOPICS — LIVE (real web data → niche-filtered by Claude)
// ─────────────────────────────────────────────────────────────────
const getTrendingTopicsLive = async (niche = 'general', language = 'en', region = 'India') => {
  const langInstruction = getLangInstruction(language) || 'Respond in English.'

  // ── 1. Fetch real-time data from all sources in parallel ─────────
  const [googleTrends, youtubeTrending] = await Promise.all([
    trendsService.fetchGoogleTrends(region),
    trendsService.fetchYouTubeTrending(region, niche),
  ])

  const hasLiveData = googleTrends.length > 0 || youtubeTrending.length > 0

  // ── 2. If no live data, fall back to AI-only ──────────────────────
  if (!hasLiveData) {
    console.warn('[aiService] No live trend data — falling back to AI-only generation')
    return getTrendingTopics(niche, language)
  }

  // ── 3. Build context strings for Claude ───────────────────────────
  const googleContext = googleTrends.length
    ? `GOOGLE TRENDS (what people in ${region} are searching RIGHT NOW):\n` +
      googleTrends.slice(0, 15).map((t, i) => `${i + 1}. "${t.title}"${t.traffic ? ` (~${t.traffic} searches)` : ''}`).join('\n')
    : ''

  const youtubeContext = youtubeTrending.length
    ? `\n\nYOUTUBE TRENDING (viral videos in ${region} right now):\n` +
      youtubeTrending.slice(0, 15).map((v, i) => `${i + 1}. "${v.title}" by ${v.channel}`).join('\n')
    : ''

  // ── 4. Ask Claude to filter + format for the niche ────────────────
  const prompt = `You are a viral content strategist for short-form video creators.

${langInstruction}

Here is REAL live trending data from ${region} as of right now:
${googleContext}${youtubeContext}

Your task: Pick the 6 topics from this real data that a "${niche}" content creator could make a viral Reel or Short about.

For each topic:
- If it's directly relevant to the niche, use it as-is
- If it's indirectly relevant (e.g. a celebrity fitness story), angle it for the niche
- If not enough niche-relevant topics, generate 1-2 niche-specific ideas inspired by the current cultural moment

Return ONLY valid JSON — no markdown, no code blocks:
[
  {
    "title": "Specific, compelling video topic (max 12 words)",
    "description": "Why this is trending and why a ${niche} creator should make this now — 1 actionable sentence",
    "category": "One of: Entertainment, Sports, Finance, Tech, Food, Lifestyle, Fashion, Education, Health, Business, Bollywood, Cricket, Motivation",
    "source": "google" or "youtube" or "ai",
    "hook": "A punchy 1-sentence hook for this video (starts strong, creates curiosity)"
  }
]

IMPORTANT: Return exactly 6 objects. Prioritize topics with the most search traffic / views.`

  try {
    const raw = await ask(prompt, 1000, MODEL_FAST)
    const match = raw.match(/\[[\s\S]*\]/)
    if (!match) throw new Error('No JSON array')
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed) || parsed.length === 0) throw new Error('Empty array')
    return parsed.slice(0, 6)
  } catch (err) {
    console.error('[aiService] getTrendingTopicsLive parse failed:', err.message)
    // Last resort: fall back to old method
    return getTrendingTopics(niche, language)
  }
}

// ─────────────────────────────────────────────────────────────────
// 6. GENERATE WEEKLY REPORT
// ─────────────────────────────────────────────────────────────────
const generateWeeklyReport = async (stats, language = 'en') => {
  const base = getLangInstruction(language)
  const langInstruction = base
    ? `${base} Be warm and encouraging.`
    : 'Write in English. Be warm and encouraging.'

  const prompt = `
You are a personal content coach writing a creator's weekly performance summary.

${langInstruction}

Creator's stats for this week:
- Scripts generated: ${stats.scripts}
- Average hook score: ${stats.avgHookScore}/100
- Videos analyzed: ${stats.analyses}
- Top performing topic: "${stats.topTopic || 'N/A'}"
- Current streak: ${stats.streak} days

Write a short, motivating weekly report (3-4 sentences max) that:
1. Celebrates what they did well
2. Gives ONE specific tip for next week
3. Ends with an encouraging line

Be like a friend, not a corporate report. Keep it short.
`
  return await ask(prompt, 400)
}

// ─────────────────────────────────────────────────────────────────
// 7. GET REGIONAL GREETING + TRENDING NEWS
// ─────────────────────────────────────────────────────────────────
const getRegionalGreeting = async (region = 'India', language = 'en') => {
  const langInstruction = getLangInstruction(language)
  const prompt = `You are a sharp, professional content strategist briefing an Indian creator on today's social media landscape.
${langInstruction ? '\n' + langInstruction + ' Write the greeting sentence and trend descriptions in that language, but keep JSON keys and category names in English.\n' : '\nWrite in clean, concise English. Be warm but not overly casual. Think smart friend, not cheerleader.\n'}
Focus on topics Indian audiences actually engage with: Bollywood, cricket, Indian startups, festivals, food, finance, pop culture, etc.
IMPORTANT: Do not use em dashes (the long dash) anywhere in your response. Use commas, colons, or full stops instead.

Return ONLY valid JSON (no markdown, no code blocks):
{
  "greeting": "One crisp sentence (max 20 words) about what's happening in India's creator space today. Make it insightful, not generic.",
  "trends": [
    {"title": "Specific trend name", "description": "Why this matters for creators, in one actionable sentence.", "category": "Entertainment"},
    {"title": "Specific trend name", "description": "Why this matters for creators, in one actionable sentence.", "category": "Business"},
    {"title": "Specific trend name", "description": "Why this matters for creators, in one actionable sentence.", "category": "Lifestyle"}
  ]
}

Categories: Entertainment, Cricket, Finance, Tech, Food, Education, Lifestyle, Fashion, Business, Health, Bollywood`

  try {
    const raw = await ask(prompt, 600, MODEL_FAST)
    const jsonMatch = raw.match(/\{[\s\S]*\}/)
    if (!jsonMatch) throw new Error('No JSON')
    return JSON.parse(jsonMatch[0])
  } catch {
    const fallbacks = {
      hi: {
        greeting: `${region} का सोशल मीडिया आज बज़ रहा है। चलो कुछ वायरल बनाते हैं!`,
        trends: [
          { title: 'शॉर्ट-फॉर्म वीडियो ट्रेंड', description: 'Reels और Shorts अभी फीड पर छाए हुए हैं।', category: 'Content' },
          { title: 'क्रिएटर इकोनॉमी की वृद्धि', description: 'ब्रांड्स अब माइक्रो-इन्फ्लुएंसर्स में ज़्यादा निवेश कर रहे हैं।', category: 'Business' },
          { title: 'असली कहानियां', description: 'रॉ, अनफिल्टर्ड कंटेंट पॉलिश्ड वीडियो से बेहतर प्रदर्शन कर रहा है।', category: 'Strategy' },
        ],
      },
      es: {
        greeting: `¡Las redes sociales de ${region} están en llamas hoy. ¡Creemos algo viral!`,
        trends: [
          { title: 'Tendencias de video corto', description: 'Los Reels y Shorts dominan los feeds ahora mismo.', category: 'Content' },
          { title: 'Economía de creadores', description: 'Las marcas invierten cada vez más en micro-influencers.', category: 'Business' },
          { title: 'Contenido auténtico', description: 'El contenido sin filtros supera a los videos pulidos.', category: 'Strategy' },
        ],
      },
      fr: {
        greeting: `Les réseaux sociaux de ${region} sont en effervescence aujourd'hui. Créons quelque chose de viral !`,
        trends: [
          { title: 'Tendances vidéo courte', description: 'Les Reels et Shorts dominent les fils d\'actualité en ce moment.', category: 'Content' },
          { title: 'Économie des créateurs', description: 'Les marques investissent de plus en plus dans les micro-influenceurs.', category: 'Business' },
          { title: 'Contenu authentique', description: 'Le contenu brut surpasse les vidéos soignées.', category: 'Strategy' },
        ],
      },
      pt: {
        greeting: `As redes sociais de ${region} estão agitadas hoje. Vamos criar algo viral!`,
        trends: [
          { title: 'Tendências de vídeo curto', description: 'Reels e Shorts estão dominando os feeds agora.', category: 'Content' },
          { title: 'Economia de criadores', description: 'As marcas estão investindo cada vez mais em micro-influenciadores.', category: 'Business' },
          { title: 'Conteúdo autêntico', description: 'Conteúdo bruto supera vídeos polidos em desempenho.', category: 'Strategy' },
        ],
      },
      de: {
        greeting: `Die sozialen Medien von ${region} sind heute im Trend. Lass uns etwas Virales erstellen!`,
        trends: [
          { title: 'Kurzvideotrends', description: 'Reels und Shorts dominieren gerade die Feeds.', category: 'Content' },
          { title: 'Creator-Wirtschaft', description: 'Marken investieren mehr denn je in Mikro-Influencer.', category: 'Business' },
          { title: 'Authentischer Content', description: 'Ungefilterte Inhalte übertreffen polierte Videos.', category: 'Strategy' },
        ],
      },
      ar: {
        greeting: `وسائل التواصل الاجتماعي في ${region} تشتعل اليوم. لنصنع شيئاً يتداوله الجميع!`,
        trends: [
          { title: 'اتجاهات الفيديو القصير', description: 'ريلز وشورتس يهيمنان على الخلاصات الآن.', category: 'Content' },
          { title: 'اقتصاد المبدعين', description: 'تستثمر العلامات التجارية أكثر في المؤثرين الصغار.', category: 'Business' },
          { title: 'المحتوى الأصيل', description: 'المحتوى الخام يتفوق على مقاطع الفيديو المصقولة.', category: 'Strategy' },
        ],
      },
      id: {
        greeting: `Media sosial ${region} sedang ramai hari ini. Mari buat konten yang viral!`,
        trends: [
          { title: 'Tren video pendek', description: 'Reels dan Shorts mendominasi feed saat ini.', category: 'Content' },
          { title: 'Ekonomi kreator', description: 'Brand semakin banyak berinvestasi ke micro-influencer.', category: 'Business' },
          { title: 'Konten autentik', description: 'Konten mentah mengungguli video yang dipoles.', category: 'Strategy' },
        ],
      },
      ja: {
        greeting: `${region}のソーシャルメディアが今日も盛り上がっています。バイラルなコンテンツを作りましょう！`,
        trends: [
          { title: 'ショート動画トレンド', description: 'リールとショーツが今フィードを席巻しています。', category: 'Content' },
          { title: 'クリエイターエコノミー', description: 'ブランドがマイクロインフルエンサーへの投資を増やしています。', category: 'Business' },
          { title: 'ありのままのコンテンツ', description: '加工なしのコンテンツが磨かれた動画を上回っています。', category: 'Strategy' },
        ],
      },
      ko: {
        greeting: `${region}의 소셜 미디어가 오늘도 뜨겁습니다. 바이럴 콘텐츠를 만들어봅시다!`,
        trends: [
          { title: '숏폼 비디오 트렌드', description: '릴스와 쇼츠가 지금 피드를 장악하고 있습니다.', category: 'Content' },
          { title: '크리에이터 이코노미', description: '브랜드들이 마이크로 인플루언서에 더 많이 투자하고 있습니다.', category: 'Business' },
          { title: '진정성 있는 콘텐츠', description: '날것의 콘텐츠가 정제된 영상보다 더 좋은 성과를 냅니다.', category: 'Strategy' },
        ],
      },
    }
    const fb = fallbacks[language] || {
      greeting: `Welcome back! ${region}'s social media is buzzing today. Let's create something viral!`,
      trends: [
        { title: 'Short-form video trends', description: 'Reels and Shorts are dominating feeds right now.', category: 'Content' },
        { title: 'Creator economy growth', description: 'More brands are investing in micro-influencers.', category: 'Business' },
        { title: 'Authentic storytelling', description: 'Raw, unfiltered content is outperforming polished videos.', category: 'Strategy' },
      ],
    }
    // Mark as fallback so the controller skips caching this response
    return { ...fb, _isFallback: true }
  }
}

// ─────────────────────────────────────────────────────────────────
// 8. TRANSLATE CONTENT
// ─────────────────────────────────────────────────────────────────
const translateContent = async (content, targetLanguage) => {
  if (targetLanguage === 'en') return content

  const langMap = { hi: 'Hindi', es: 'Spanish', fr: 'French', pt: 'Portuguese' }
  const langName = langMap[targetLanguage] || targetLanguage

  const prompt = `Translate the following content to ${langName}. Keep the same tone, energy, and structure. Only return the translated text, nothing else.

Content:
${content}`

  return await ask(prompt, 1200)
}

// ─────────────────────────────────────────────────────────────────
// 9. GENERATE CAPTIONS + HASHTAGS
// ─────────────────────────────────────────────────────────────────
const generateCaptions = async ({ topic, niche, tone, language = 'en' }) => {
  const langInstruction = getLangInstruction(language)
  const prompt = `You are an expert Instagram caption writer who specializes in viral short-form content.
${langInstruction ? '\n' + langInstruction + ' Write all caption text in that language, but keep the JSON keys and style names in English.\n' : ''}
Generate 4 caption styles and 25 relevant hashtags for this content:
- Topic : ${topic}
- Niche  : ${niche || 'general'}
- Tone   : ${tone  || 'engaging'}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "captions": [
    {"style": "Short", "text": "..."},
    {"style": "Story", "text": "..."},
    {"style": "Question", "text": "..."},
    {"style": "Bold", "text": "..."}
  ],
  "hashtags": ["tag1", "tag2", "tag3", "...", "tag25"]
}

Caption style guide:
- Short: 1-2 punchy lines, high energy, max 50 words
- Story: mini narrative that hooks and delivers value, 80-120 words
- Question: opens with a question that sparks curiosity or debate, 40-70 words
- Bold: controversial or confident statement that invites engagement, 40-70 words

Hashtag rules:
- Mix of niche-specific, broad, and trending tags
- No # symbol in the JSON values — just the tag text
- 25 tags exactly`;

  const raw = await ask(prompt, 900, MODEL_FAST);

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed.captions)) throw new Error('captions not array');
    if (!Array.isArray(parsed.hashtags)) throw new Error('hashtags not array');
    return parsed;
  } catch {
    return {
      captions: [
        { style: 'Short', text: `${topic} — the truth no one talks about. Save this before it disappears.` },
        { style: 'Story', text: `I almost gave up on ${topic}. Then one thing changed everything. Here's the story and what I learned that completely flipped my results.` },
        { style: 'Question', text: `What if everything you knew about ${topic} was wrong? Drop your thoughts below.` },
        { style: 'Bold', text: `${topic} is the #1 skill you need right now. No debate.` },
      ],
      hashtags: ['reels', 'viral', 'trending', 'explore', 'fyp', 'motivation', 'growth', 'content', 'creator', 'tips', 'advice', 'lifestyle', 'instagood', 'instagram', 'reelsinstagram', 'video', 'shortsvideo', 'trending2024', 'creatoreconomy', 'contentcreator', 'smallcreator', 'reelsviral', 'instareels', 'learnontiktok', 'educate'],
    };
  }
};

// ─────────────────────────────────────────────────────────────────
// 10. REMIX CONTENT
// ─────────────────────────────────────────────────────────────────
const remixContent = async ({ hook, body, cta, topic, language = 'en' }) => {
  const langInstruction = getLangInstruction(language)
  const scriptText = `HOOK: ${hook}\n\nBODY: ${body}\n\nCTA: ${cta}`;

  const prompt = `You are a multi-platform content strategist. Take this short-form video script and reformat it for 4 different platforms.
${langInstruction ? '\n' + langInstruction + ' Write all platform content in that language, but keep the JSON keys in English.\n' : ''}

Original Reel script about "${topic}":
${scriptText}

Return ONLY valid JSON (no markdown, no code blocks):
{
  "twitter": "...",
  "linkedin": "...",
  "youtube": "...",
  "caption": "..."
}

Platform rules:
- twitter: A tweet thread (3-5 tweets). Use numbering like "1/" "2/" etc. Each tweet max 280 chars. Make it conversational and punchy.
- linkedin: A professional LinkedIn post (150-250 words). Start with a bold hook line. Use line breaks for readability. End with a question to drive comments.
- youtube: A YouTube Shorts script (same energy as the Reel but slightly longer intro). Format as: HOOK / CONTENT / CTA. Max 150 words.
- caption: An Instagram caption (60-100 words). Engaging, conversational, ends with a CTA line. No hashtags.`;

  const raw = await ask(prompt, 1000, MODEL_FAST);

  try {
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) throw new Error('No JSON in response');
    return JSON.parse(jsonMatch[0]);
  } catch {
    return {
      twitter   : `1/ ${hook}\n\n2/ ${body.substring(0, 200)}\n\n3/ ${cta}`,
      linkedin  : `${hook}\n\n${body}\n\n${cta}\n\nWhat do you think? Drop a comment below.`,
      youtube   : `HOOK: ${hook}\n\nCONTENT: ${body}\n\nCTA: ${cta}`,
      caption   : `${hook} ${body.substring(0, 100)}... ${cta}`,
    };
  }
};

// ─────────────────────────────────────────────────────────────────
// 11. COACH CHAT
// ─────────────────────────────────────────────────────────────────
const coachChat = async ({ message, history = [], userContext, language = 'en' }) => {
  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

  const statsStr = userContext
    ? `Creator stats: ${userContext.scriptsCount || 0} scripts created, avg hook score ${userContext.avgHookScore || 'N/A'}/100, current streak ${userContext.streak || 0} days, plan: ${userContext.plan || 'FREE'}${userContext.recentTopics && userContext.recentTopics.length > 0 ? `, recent topics: ${userContext.recentTopics.slice(0, 5).join(', ')}` : ''}.`
    : '';

  const onboardingStr = userContext?.onboardingContext
    ? ` ${userContext.onboardingContext}`
    : '';

  const contextStr = [statsStr, onboardingStr].filter(Boolean).join(' ') || 'No creator context available yet.';

  const langInstruction = getLangInstruction(language)
  const langSuffix = langInstruction ? ` ${langInstruction} Always respond in that language.` : ''

  const systemPrompt = `You are a sharp, expert content coach for Indian short-form video creators on Instagram Reels and YouTube Shorts. ${contextStr} Always tailor advice specifically to the creator's niche and goals when provided. Be direct, practical, and specific. No fluff, no generic advice. Give actionable tips they can use today. Keep replies under 200 words unless a longer explanation is genuinely needed.${langSuffix}`;

  // Keep last 10 messages of history
  const trimmedHistory = (history || []).slice(-10);

  const messages = [
    ...trimmedHistory.map(m => ({ role: m.role, content: m.content })),
    { role: 'user', content: message },
  ];

  const response = await client.messages.create({
    model     : MODEL,
    max_tokens: 600,
    system    : systemPrompt,
    messages,
  });

  return { reply: response.content[0].text.trim() };
};

// ─────────────────────────────────────────────────────────────────
// VIRAL EDITOR — second-pass punch-up on the first draft
// Runs in parallel with hook scoring; costs ~$0.001 extra per script
// ─────────────────────────────────────────────────────────────────
const viralEdit = async (script, { language = 'en' } = {}) => {
  const langInstruction = getLangInstruction(language)

  const prompt = `You are a ruthless viral content editor for short-form video. A writer just drafted this script. Your ONLY job: make it land harder without changing the core message or making it longer.

LANGUAGE RULE (non-negotiable):
${langInstruction}

Original:
HOOK: ${script.hook}
BODY: ${script.body}
CTA: ${script.cta}

Attack each section:
- HOOK: If a person mid-scroll would keep scrolling past this, rewrite it completely. Maximum specificity. Maximum emotional punch. No soft openers.
- BODY: Cut every word that doesn't pull its weight. Shorter sentences. Replace vague claims with concrete details.
- CTA: Must feel like the natural next move, not a sales pitch.

Return ONLY this — no commentary, no preamble:
HOOK: [punched-up hook]
BODY: [tightened body]
CTA: [sharpened CTA]
CHANGES: [one sentence — the single biggest improvement you made and why]`

  try {
    const raw = await ask(prompt, 900, MODEL_FAST)

    const hookMatch    = raw.match(/HOOK[^:]*:\s*([\s\S]*?)(?=BODY|$)/i)
    const bodyMatch    = raw.match(/BODY[^:]*:\s*([\s\S]*?)(?=CTA|$)/i)
    const ctaMatch     = raw.match(/CTA[^:]*:\s*([\s\S]*?)(?=CHANGES|$)/i)
    const changesMatch = raw.match(/CHANGES[^:]*:\s*([\s\S]*?)$/i)

    return {
      hook   : hookMatch    ? hookMatch[1].trim()    : script.hook,
      body   : bodyMatch    ? bodyMatch[1].trim()    : script.body,
      cta    : ctaMatch     ? ctaMatch[1].trim()     : script.cta,
      changes: changesMatch ? changesMatch[1].trim() : null,
    }
  } catch {
    // If the edit fails for any reason, silently fall back to original
    return { ...script, changes: null }
  }
}

// ─────────────────────────────────────────────────────────────────
// SONG RECOMMENDATIONS — curated picks based on the actual script
// ─────────────────────────────────────────────────────────────────
// Map region → primary music market language/genre
const REGIONAL_MUSIC_CONTEXT = {
  India: `CRITICAL — REGIONAL MUSIC RULE:
The audience is INDIA. You MUST recommend Indian music:
- Popular picks: Bollywood songs, Punjabi pop (AP Dhillon, Diljit, Arijit Singh, Pritam, Shankar-Ehsaan-Loy, A.R. Rahman), indie Hindi (Prateek Kuhad, Ritviz, When Chai Met Toast), or regional language hits that are currently trending
- If the topic itself involves Bollywood, movies, celebrity, or Hindi film culture → pick only Bollywood songs, specifically from relevant films/artists
- If the topic is fitness/gym → Punjabi high-energy beats (Diljit, Badshah, AP Dhillon)
- If the topic is finance/business/motivational → AR Rahman, background scores, or trending Hindi motivational tracks
- Royalty-free picks: Look for Indian/Hindi music on Pixabay, YouTube Audio Library, or Hoopr.ai (India's leading royalty-free platform for creators)
- searchUrl for popular songs: use https://www.youtube.com/results?search_query= (YouTube is the primary platform in India)
- DO NOT suggest Western English songs unless the topic specifically demands it (e.g. an English podcast or Western pop commentary)`,

  US: `REGIONAL MUSIC RULE:
The audience is the US. Pick music that resonates with American culture:
- Popular: current Billboard/trending artists relevant to the niche
- Royalty-free: Epidemic Sound, Artlist, Musicbed, YouTube Audio Library`,

  UK: `REGIONAL MUSIC RULE:
The audience is the UK. Pick music that resonates with British culture:
- Popular: UK chart artists, grime, British indie, or genre-appropriate artists
- Royalty-free: Epidemic Sound, Artlist, YouTube Audio Library`,

  'Middle East': `REGIONAL MUSIC RULE:
The audience is the Middle East. Pick music that resonates with the region:
- Popular: Arabic pop (Amr Diab, Mohamed Ramadan, Nancy Ajram), khaleeji music, or genre-appropriate international tracks that work well in the region
- Royalty-free: YouTube Audio Library, Pixabay`,

  'Southeast Asia': `REGIONAL MUSIC RULE:
The audience is Southeast Asia. Pick music relevant to the region:
- Popular: local language pop from Indonesia/Philippines/Thailand/Vietnam/Malaysia relevant to the topic niche, or K-pop if that fits
- Royalty-free: YouTube Audio Library, Pixabay`,

  Global: `REGIONAL MUSIC RULE:
Global audience — pick universally recognisable tracks that work across cultures. Lean toward international English-language hits unless the topic is clearly region-specific.`,
}

const getRegionalMusicContext = (audience) => REGIONAL_MUSIC_CONTEXT[audience] || REGIONAL_MUSIC_CONTEXT['Global']

const recommendSongs = async ({ hook, body, cta, topic, niche, tone, genre, mood, bpm, audience = 'India', language = 'en' }) => {
  const regionalMusicRule = getRegionalMusicContext(audience)

  const prompt = `
You are a music supervisor who picks background tracks for viral Instagram Reels and YouTube Shorts. You have deep knowledge of regional music markets worldwide — Bollywood, K-pop, Latin pop, Afrobeats, Western pop — and know exactly which songs creators in each market actually use.

${regionalMusicRule}

THE SCRIPT:
Topic    : ${topic}
Niche    : ${niche || 'general'}
Tone     : ${tone || 'motivational'}
Language : ${language}
Audience : ${audience}
Hook     : "${hook}"
Body     : "${body}"
CTA      : "${cta}"
Music vibe already identified: ${genre || 'upbeat'}, ${mood || 'energetic'}, ~${bpm || '120'} BPM

YOUR TASK: Pick exactly 6 songs — 3 popular/well-known + 3 royalty-free/creator-safe.

STRICT RULES:
1. FOLLOW THE REGIONAL MUSIC RULE ABOVE — it is the most important instruction
2. Read the topic carefully — if the topic mentions a specific music genre, artist, language, or culture, pick songs from that exact world
3. Match the emotional energy of the script (hook tension → body momentum → CTA punch)
4. BPM must align with the script's speech and edit pace
5. Only recommend songs that actually exist and are genuinely available
6. For royalty-free: specify the library (Pixabay, Uppbeat, Epidemic Sound, Artlist, YouTube Audio Library, Hoopr.ai)
7. searchUrl: for popular songs use YouTube search; for royalty-free use the library's search page

Return ONLY valid JSON, no markdown, no code blocks:
{
  "songs": [
    {
      "title": "Song Title",
      "artist": "Artist Name",
      "bpm": 120,
      "energy": "high",
      "mood": "2-3 word mood",
      "royaltyFree": false,
      "library": null,
      "searchUrl": "https://www.youtube.com/results?search_query=Song+Title+Artist+Name"
    }
  ]
}
`

  try {
    const raw = await ask(prompt, 900, MODEL)
    const match = raw.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('No JSON')
    const parsed = JSON.parse(match[0])
    if (!Array.isArray(parsed.songs) || parsed.songs.length === 0) throw new Error('Empty songs')
    return parsed
  } catch {
    // Fallback is region-aware
    const isIndia = audience === 'India' || language === 'hi'
    if (isIndia) {
      return {
        songs: [
          { title: 'Tum Hi Ho', artist: 'Arijit Singh', bpm: 68, energy: 'medium', mood: 'emotional, soulful', royaltyFree: false, library: null, searchUrl: 'https://www.youtube.com/results?search_query=Tum+Hi+Ho+Arijit+Singh' },
          { title: 'Kesariya', artist: 'Arijit Singh', bpm: 112, energy: 'high', mood: 'romantic, uplifting', royaltyFree: false, library: null, searchUrl: 'https://www.youtube.com/results?search_query=Kesariya+Arijit+Singh' },
          { title: 'Pasoori', artist: 'Ali Sethi & Shae Gill', bpm: 95, energy: 'medium', mood: 'dreamy, vibrant', royaltyFree: false, library: null, searchUrl: 'https://www.youtube.com/results?search_query=Pasoori+Ali+Sethi' },
          { title: 'Hindi Motivational Background', artist: 'Various', bpm: 120, energy: 'high', mood: 'powerful, uplifting', royaltyFree: true, library: 'Hoopr.ai', searchUrl: 'https://hoopr.ai/playlists/motivational' },
          { title: 'Desi Beats Instrumental', artist: 'Various', bpm: 110, energy: 'high', mood: 'energetic, desi', royaltyFree: true, library: 'Pixabay', searchUrl: 'https://pixabay.com/music/search/indian/' },
          { title: 'Bollywood Background Score', artist: 'Various', bpm: 100, energy: 'medium', mood: 'cinematic, warm', royaltyFree: true, library: 'YouTube Audio Library', searchUrl: 'https://studio.youtube.com/channel/audio' },
        ]
      }
    }
    return {
      songs: [
        { title: 'Blinding Lights', artist: 'The Weeknd', bpm: 171, energy: 'high', mood: 'urgent, driving', royaltyFree: false, library: null, searchUrl: 'https://www.youtube.com/results?search_query=Blinding+Lights+The+Weeknd' },
        { title: 'Levitating', artist: 'Dua Lipa', bpm: 103, energy: 'high', mood: 'euphoric, fun', royaltyFree: false, library: null, searchUrl: 'https://www.youtube.com/results?search_query=Levitating+Dua+Lipa' },
        { title: 'STAY', artist: 'The Kid LAROI & Justin Bieber', bpm: 170, energy: 'high', mood: 'emotional, intense', royaltyFree: false, library: null, searchUrl: 'https://www.youtube.com/results?search_query=STAY+The+Kid+LAROI+Justin+Bieber' },
        { title: 'Inspiring Uplifting', artist: 'Various', bpm: 120, energy: 'medium', mood: 'motivational', royaltyFree: true, library: 'Pixabay', searchUrl: 'https://pixabay.com/music/search/motivational/' },
        { title: 'Energetic Sport', artist: 'Various', bpm: 130, energy: 'high', mood: 'powerful, athletic', royaltyFree: true, library: 'Uppbeat', searchUrl: 'https://uppbeat.io/browse/music/sport' },
        { title: 'Positive Upbeat', artist: 'Various', bpm: 108, energy: 'medium', mood: 'happy, warm', royaltyFree: true, library: 'YouTube Audio Library', searchUrl: 'https://studio.youtube.com/channel/audio' },
      ]
    }
  }
}

// ─────────────────────────────────────────────────────────────────
// REEL READY — Vision-based complete post package
// ─────────────────────────────────────────────────────────────────
const analyzeReelContent = async ({ imageBase64Array, mediaTypes, audience = 'India', language = 'en' }) => {
  const audienceCtx   = getAudienceContext(audience)
  const langLabel     = { en: 'English', hi: 'Hindi', es: 'Spanish', fr: 'French', pt: 'Portuguese', de: 'German', ar: 'Arabic', id: 'Bahasa Indonesia', ja: 'Japanese', ko: 'Korean' }[language] || 'English'

  const imageContent = imageBase64Array.map((data, i) => ({
    type  : 'image',
    source: { type: 'base64', media_type: mediaTypes[i] || 'image/jpeg', data },
  }))

  const prompt = `You are a senior social media strategist who builds complete Instagram Reel/Short post packages for creators.

${audienceCtx}

ALL text you generate (script, captions, hashtags) must be written in ${langLabel}.

Carefully analyse the image(s). Understand what is happening, the mood and energy, the likely content niche, and what a creator would want to say about it.

Then return ONLY valid JSON — no markdown, no code fences:
{
  "contentUnderstanding": "One sentence: what you see in the content",
  "niche": "single niche keyword (fitness|food|travel|finance|lifestyle|comedy|fashion|tech|bollywood|education|beauty|motivation)",
  "topic": "specific short topic phrase for this content",
  "tone": "one of: motivational|educational|funny|storytelling|controversial|conversational",
  "mood": "2-3 word mood (e.g. energetic and bold)",
  "script": "Complete voiceover script the creator would say — hook (first line grabs attention) + body (value/story) + CTA. 80–120 words. Sound natural, not AI-generated.",
  "captions": [
    { "style": "punchy",       "label": "One-liner",    "text": "A punchy single-line caption under 12 words with an emoji" },
    { "style": "storytelling", "label": "Story",        "text": "A 50–70 word story-style caption that hooks, delivers value, ends with a question or CTA" },
    { "style": "hook",         "label": "Hook + CTA",   "text": "Opens with a bold hook statement or question, body in 2-3 lines, ends with a clear CTA" },
    { "style": "question",     "label": "Question",     "text": "Start with a provocative question that makes the viewer stop and think, then answer it in 2 lines" },
    { "style": "bold",         "label": "Bold Take",    "text": "A controversial or surprising opinion/statement about the content — 2-3 lines, no fluff, ends with a call to debate" }
  ],
  "hashtags": {
    "niche":    ["exactly 10 niche-specific hashtags — without spaces"],
    "broad":    ["exactly 10 broad-reach hashtags"],
    "trending": ["exactly 10 trending/timely hashtags relevant to this niche and region"]
  },
  "bestTime": "e.g. 7–9 PM IST",
  "bestDay":  "e.g. Tuesday or Thursday"
}`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model     : MODEL,
    max_tokens: 1600,
    messages  : [{
      role   : 'user',
      content: [...imageContent, { type: 'text', text: prompt }],
    }],
  })

  const raw   = response.content[0].text
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse vision response')
  return JSON.parse(match[0])
}

// Generate 5 fresh captions for existing analysed content
const generateMoreCaptions = async ({ contentUnderstanding, topic, niche, tone, mood, audience = 'India', language = 'en' }) => {
  const langLabel = { en: 'English', hi: 'Hindi', es: 'Spanish', fr: 'French', pt: 'Portuguese', de: 'German', ar: 'Arabic', id: 'Bahasa Indonesia', ja: 'Japanese', ko: 'Korean' }[language] || 'English'
  const audienceCtx = getAudienceContext(audience)

  const prompt = `You are a viral social media copywriter specialising in Instagram Reels captions.

${audienceCtx}

ALL captions must be written in ${langLabel}.

Content: "${contentUnderstanding}"
Topic: "${topic}" | Niche: ${niche} | Tone: ${tone} | Mood: ${mood}

Generate 5 FRESH and DIFFERENT captions. Each must be distinctly different in style.

Return ONLY valid JSON — no markdown, no code fences:
{
  "captions": [
    { "style": "punchy",       "label": "One-liner",    "text": "..." },
    { "style": "storytelling", "label": "Story",        "text": "..." },
    { "style": "hook",         "label": "Hook + CTA",   "text": "..." },
    { "style": "question",     "label": "Question",     "text": "..." },
    { "style": "bold",         "label": "Bold Take",    "text": "..." }
  ]
}`

  const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })
  const response = await client.messages.create({
    model     : FAST_MODEL,
    max_tokens: 900,
    messages  : [{ role: 'user', content: prompt }],
  })

  const raw   = response.content[0].text
  const match = raw.match(/\{[\s\S]*\}/)
  if (!match) throw new Error('Could not parse captions response')
  const parsed = JSON.parse(match[0])
  if (!Array.isArray(parsed.captions)) throw new Error('captions not array')
  return parsed.captions
}

module.exports = {
  analyzeCreatorStyle,
  viralEdit,
  generateHookAlternatives,
  refineScript,
  generateScript,
  generateVisualMusic,
  scoreHook,
  rewriteHook,
  analyzePerformance,
  getTrendingTopics,
  generateWeeklyReport,
  translateContent,
  getRegionalGreeting,
  generateCaptions,
  remixContent,
  coachChat,
  recommendSongs,
  analyzeReelContent,
  generateMoreCaptions,
  getTrendingTopicsLive,
};

