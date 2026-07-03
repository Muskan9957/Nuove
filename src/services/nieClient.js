const axios = require('axios');

// Defaults to localhost:8000 for local ML testing
const NIE_URL = process.env.NIE_URL || 'http://localhost:8000';

/**
 * Sends an interaction event to the Nuove Intelligence Engine (Python Backend).
 * This function is designed to be non-blocking. It will swallow and log any errors
 * to prevent the Node.js app from crashing if the ML engine is offline.
 *
 * @param {Object} payload
 * @param {string} payload.userId - The ID of the user performing the interaction.
 * @param {string} payload.interactionType - e.g., 'script_gen', 'script_edit', 'regenerate'
 * @param {string} [payload.prompt] - The input provided by the user/system.
 * @param {string} [payload.aiResponse] - The generated content (or original content before edit).
 * @param {string} [payload.editedResponse] - The new content after a user edit/refinement.
 * @param {number} [payload.feedback] - Explicit feedback (e.g., 1 for like, 0 for dislike).
 * @param {Object} [payload.metadata] - Additional contextual data.
 */
async function sendInteraction({ userId, interactionType, prompt, aiResponse, editedResponse, feedback, metadata }) {
  try {
    // Fire and forget request with a short timeout so it never hangs Node.js
    await axios.post(`${NIE_URL}/api/v1/interactions/`, {
      user_id: userId,
      interaction_type: interactionType,
      prompt: prompt,
      ai_response: aiResponse,
      edited_response: editedResponse,
      feedback: feedback,
      metadata: metadata || {}
    }, {
      timeout: 3000 // 3 seconds max timeout to ensure controllers are never blocked
    });
  } catch (error) {
    // Gracefully fail. Do NOT throw error up to the controllers to protect production stability.
    console.warn(`[NIE Client] Warning: Failed to log ${interactionType} interaction to ML Engine. (${error.message})`);
  }
}

module.exports = {
  sendInteraction
};
