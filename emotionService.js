const axios = require("axios");

async function detectEmotionAI(text) {
  const prompt = `
Clasificá la emoción del siguiente mensaje en UNA palabra:

Opciones:
feliz
triste
ansioso
aburrido
neutral

Mensaje: "${text}"

Respuesta:
`;

  try {
    const response = await axios.post("http://localhost:11434/api/generate", {
      model: "llama3",
      prompt,
      stream: false
    });

    return response.data.response.trim().toLowerCase();
  } catch {
    return "neutral";
  }
}

module.exports = detectEmotionAI;