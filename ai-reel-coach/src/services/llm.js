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
    default: process.env.GEMINI_MODEL      || 'gemini-2.0-flash',
    fast:    process.env.GEMINI_MODEL_FAST || 'gemini-2.0-flash',
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
      generationConfig: { maxOutputTokens: maxTokens },
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
    const res = await model.generateContent(finalPrompt);
    return (res.response.text() || '').trim();
  }

  // ── Anthropic ──
  const messages = [
    ...(history || []).map(m => ({ role: m.role === 'model' ? 'assistant' : m.role, content: m.content })),
    { role: 'user', content: prompt },
  ];
  const res = await anthropic().messages.create({
    model     : MODELS.anthropic[tier] || MODELS.anthropic.default,
    max_tokens: maxTokens,
    ...(system ? { system } : {}),
    messages,
  });
  return (res.content[0].text || '').trim();
}

module.exports = { complete, PROVIDER, MODELS };
