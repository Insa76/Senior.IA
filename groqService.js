const axios = require("axios");

const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions";
const DEFAULT_MODEL = "openai/gpt-oss-20b";

function extractTextContent(message) {
  const content = message?.content;

  if (typeof content === "string") {
    return content.trim();
  }

  // Compatibilidad con respuestas que devuelven bloques de contenido.
  if (Array.isArray(content)) {
    return content
      .filter((part) => part && (part.type === "text" || typeof part.text === "string"))
      .map((part) => part.text || "")
      .join("\n")
      .trim();
  }

  return "";
}

async function askGroq(prompt, options = {}) {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    throw new Error("Falta configurar GROQ_API_KEY en el archivo .env o en Render.");
  }

  const model = process.env.GROQ_MODEL || DEFAULT_MODEL;
  const messages = [];

  if (options.system) {
    messages.push({ role: "system", content: options.system });
  }
  messages.push({ role: "user", content: String(prompt || "") });

  const requestBody = {
    model,
    messages,
    temperature: options.temperature ?? 0.6,
    // Groq recomienda max_completion_tokens para los modelos actuales.
    max_completion_tokens: options.max_completion_tokens ?? options.max_tokens ?? 900,
    stream: false
  };

  // GPT-OSS puede devolver razonamiento separado. NORA necesita el texto final,
  // no el campo de razonamiento.
  if (model.startsWith("openai/gpt-oss-")) {
    requestBody.include_reasoning = false;
    requestBody.reasoning_effort = options.reasoning_effort || "low";
  }

  try {
    const response = await axios.post(GROQ_URL, requestBody, {
      timeout: 45000,
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json"
      }
    });

    const choice = response.data?.choices?.[0];
    const content = extractTextContent(choice?.message);

    if (content) {
      return content;
    }

    const finishReason = choice?.finish_reason || "desconocido";
    const refusal = choice?.message?.refusal;
    const detail = refusal
      ? `Groq no generó una respuesta: ${refusal}`
      : `Groq no devolvió texto. Motivo de finalización: ${finishReason}. Modelo: ${model}.`;

    console.error("Respuesta de Groq sin texto:", {
      model,
      finish_reason: finishReason,
      has_reasoning: Boolean(choice?.message?.reasoning),
      usage: response.data?.usage || null
    });
    throw new Error(detail);
  } catch (error) {
    const detail = error.response?.data?.error?.message || error.message;
    console.error("Error de Groq:", detail);
    const wrapped = new Error(detail);
    wrapped.status = error.response?.status || 502;
    throw wrapped;
  }
}

module.exports = askGroq;
