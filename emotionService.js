const askGroq = require("./groqService");

const ALLOWED_EMOTIONS = ["feliz", "triste", "ansioso", "aburrido", "neutral"];

async function detectEmotionAI(text) {
  try {
    const response = await askGroq(
      `Clasificá la emoción principal del mensaje en UNA sola palabra.
Las únicas respuestas permitidas son: ${ALLOWED_EMOTIONS.join(", ")}.
No agregues explicaciones.

Mensaje: ${String(text).slice(0, 1500)}`,
      {
        system: "Sos un clasificador emocional conservador. No diagnostiques ni infieras enfermedades.",
        temperature: 0,
        max_completion_tokens: 128,
        reasoning_effort: "low"
      }
    );

    const normalized = response.toLowerCase().trim().replace(/[^a-záéíóúñ]/g, "");
    return ALLOWED_EMOTIONS.includes(normalized) ? normalized : "neutral";
  } catch (error) {
    console.error("No se pudo clasificar la emoción; se usa neutral.");
    return "neutral";
  }
}

module.exports = detectEmotionAI;
