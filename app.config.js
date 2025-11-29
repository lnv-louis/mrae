// Load .env and inject Expo extra variables
const fs = require('fs');
const path = require('path');

function loadEnv() {
  const envPath = path.join(__dirname, '.env');
  try {
    const content = fs.readFileSync(envPath, 'utf8');
    content.split(/\r?\n/).forEach((line) => {
      const trimmed = line.trim();
      if (!trimmed || trimmed.startsWith('#')) return;
      const idx = trimmed.indexOf('=');
      if (idx > -1) {
        const key = trimmed.slice(0, idx).trim();
        const value = trimmed.slice(idx + 1).trim();
        if (key && !(key in process.env)) {
          process.env[key] = value;
        }
      }
    });
  } catch (e) {
    // .env may not exist or be empty; ignore
  }
}

module.exports = () => {
  loadEnv();
  const app = require('./app.json');

  const extra = {
    ...(app.expo.extra || {}),
    geminiApiKey: process.env.GEMINI_API_KEY || null,
    nanoBananaApiKey: process.env.NANO_BANANA_API_KEY || null,
  };

  return {
    expo: {
      ...app.expo,
      extra,
    },
  };
};
