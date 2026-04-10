const askGroq = require("./groqService");

async function detectEmotionAI(text) {
  const prompt = `
Clasificá la emoción en una palabra:

feliz, triste, ansioso, aburrido, neutral

Mensaje: "${text}"
`;

  const response = await askGroq(prompt);

  return response.toLowerCase();
}

module.exports = detectEmotionAI;