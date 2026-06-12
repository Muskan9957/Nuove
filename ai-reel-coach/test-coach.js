require('dotenv').config();
const aiService = require('./src/services/aiService');

(async () => {
  try {
    const res = await aiService.coachChat({ message: 'Hello', history: [], userContext: { streak: 1 } });
    console.log('SUCCESS:', res);
  } catch (err) {
    console.error('ERROR:', err.message);
  }
})();
