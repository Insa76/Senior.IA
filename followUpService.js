const askOllama = require("./ollamaService");

const activeFollowUps = {};
const followUpMessages = {};

async function scheduleFollowUp(userId, profile) {

  if (activeFollowUps[userId]) return;

  activeFollowUps[userId] = true;

  setTimeout(async () => {

    try {
      const prompt = `
Sos NORA.

El usuario estaba así:
${profile.lastEmotion}

Escribí un mensaje corto y humano preguntando cómo está ahora.
`;

      const message = await askOllama(prompt);

      console.log("📩 FOLLOW-UP:", message);

      if (!followUpMessages[userId]) {
        followUpMessages[userId] = [];
      }

      followUpMessages[userId].push(message);

    } catch (err) {
      console.error("Error follow-up:", err);
    }

    delete activeFollowUps[userId];

  }, 60000);
}

// 👇 ESTA ES LA CLAVE QUE TE FALTABA
function getFollowUps(userId) {
  const messages = followUpMessages[userId] || [];
  followUpMessages[userId] = [];
  return messages;
}

// ✅ EXPORT CORRECTO
module.exports = {
  scheduleFollowUp,
  getFollowUps
};