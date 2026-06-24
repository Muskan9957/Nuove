// ─────────────────────────────────────────────────────────────────
// Unified LLM layer — swap providers from ONE place.
//   LLM_PROVIDER = 'gemini' (default when GEMINI_API_KEY is set) | 'anthropic'
// Everything in the app calls llm.complete() so we're never locked to one vendor.
// ─────────────────────────────────────────────────────────────────
const Anthropic = require('@anthropic-ai/sdk');
const { GoogleGenerativeAI } = require('@google/generative-ai');

const PROVIDER = (process.env.LLM_PROVIDER ||
  (process.env.GEMINI_API_KEY ? 'gemini' : 'anthropic')).toLowerCase();

// model per provider + tier ('default' = quality, 'fast' = cheap)
const MODELS = {
  gemini: {
    default: process.env.GEMINI_MODEL      || 'gemini-2.5-flash',
    fast:    process.env.GEMINI_MODEL_FAST || 'gemini-2.5-flash',
  },
  anthropic: {
    default: 'claude-sonnet-4-6',
    fast:    'claude-haiku-4-5-20251001',
  },
};

let _anthropic, _gemini;
const anthropic = () => (_anthropic ||= new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY }));
const gemini    = () => (_gemini    ||= new GoogleGenerativeAI(process.env.GEMINI_API_KEY));

/**
 * Provider-agnostic text completion.
 * @param {string} prompt                  the user message
 * @param {object} opts
 * @param {string} [opts.system]           system instruction
 * @param {Array}  [opts.history]          [{role:'user'|'assistant', content}] for multi-turn chat
 * @param {number} [opts.maxTokens=1024]
 * @param {'default'|'fast'} [opts.tier='default']
 * @returns {Promise<string>} trimmed text output
 */
async function complete(prompt, { system = '', history = [], maxTokens = 1024, tier = 'default' } = {}) {
  if (PROVIDER === 'gemini') {
    const model = gemini().getGenerativeModel({
      model: MODELS.gemini[tier] || MODELS.gemini.default,
      ...(system ? { systemInstruction: system } : {}),
      // thinkingBudget:0 disables 2.5's "thinking" tokens — cheaper, faster, and
      // prevents short maxOutputTokens limits from being eaten by reasoning.
      generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
    });
    // Flatten any history into the prompt — robust against Gemini's strict
    // role-alternation rules for multi-turn chats.
    let finalPrompt = prompt;
    if (history && history.length) {
      const transcript = history
        .map(m => `${m.role === 'assistant' ? 'Assistant' : 'User'}: ${m.content}`)
        .join('\n');
      finalPrompt = `${transcript}\nUser: ${prompt}`;
    }
    try {
      const res = await model.generateContent(finalPrompt);
      return (res.response.text() || '').trim();
    } catch (err) { throw normalizeLLMError(err); }
  }

  // ── Anthropic ──
  const messages = [
    ...(history || []).map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content })),
    { role: 'user', content: prompt },
  ];
  try {
    const res = await anthropic().messages.create({
      model     : MODELS.anthropic[tier] || MODELS.anthropic.default,
      max_tokens: maxTokens,
      ...(system ? { system } : {}),
      messages,
    });
    return (res.content[0].text || '').trim();
  } catch (err) { throw normalizeLLMError(err); }
}

// Turn raw provider errors into clean, user-friendly messages. Rate-limit /
// quota errors (e.g. Gemini free-tier daily cap) get a calm "try again" note
// instead of leaking a scary "[GoogleGenerativeAI Error] 429 ..." to the user.
function normalizeLLMError(err) {
  const msg = String((err && err.message) || '');
  if (/\b429\b|too many requests|quota|rate.?limit|RESOURCE_EXHAUSTED/i.test(msg)) {
    const e = new Error('Our AI is handling a lot of requests right now. Please try again in a minute.');
    e.status = 429;
    e.retryable = true;
    return e;
  }
  return err;
}

/**
 * Multimodal completion (text + images). Provider-agnostic.
 * @param {string} prompt
 * @param {Array<{data:string, mimeType:string}>} images  base64 image data
 * @param {object} opts { maxTokens, tier }
 * @returns {Promise<string>}
 */
async function completeVision(prompt, images = [], { maxTokens = 1600, tier = 'default' } = {}) {
  if (PROVIDER === 'gemini') {
    const model = gemini().getGenerativeModel({
      model: MODELS.gemini[tier] || MODELS.gemini.default,
      generationConfig: { maxOutputTokens: maxTokens, thinkingConfig: { thinkingBudget: 0 } },
    });
    const parts = [
      { text: prompt },
      ...images.map(img => ({ inlineData: { mimeType: img.mimeType || 'image/jpeg', data: img.data } })),
    ];
    try {
      const res = await model.generateContent(parts);
      return (res.response.text() || '').trim();
    } catch (err) { throw normalizeLLMError(err); }
  }

  // ── Anthropic ──
  const content = [
    ...images.map(img => ({ type: 'image', source: { type: 'base64', media_type: img.mimeType || 'image/jpeg', data: img.data } })),
    { type: 'text', text: prompt },
  ];
  try {
    const res = await anthropic().messages.create({
      model     : MODELS.anthropic[tier] || MODELS.anthropic.default,
      max_tokens: maxTokens,
      messages  : [{ role: 'user', content }],
    });
    return (res.content[0].text || '').trim();
  } catch (err) { throw normalizeLLMError(err); }
}

module.exports = { complete, completeVision, PROVIDER, MODELS };
