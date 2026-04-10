const axios = require("axios");

const GROQ_API_KEY = process.env.GROQ_API_KEY;

async function askGroq(prompt) {
    console.log("KEY:", process.env.GROQ_API_KEY);
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model: "llama-3.1-8b-instant",
        messages: [
          {
            role: "user",
            content: prompt
          }
        ]
      },
      {
        headers: {
          Authorization: `Bearer ${GROQ_API_KEY}`,
          "Content-Type": "application/json"
        }
      }
    );

    return response.data.choices[0].message.content;

  } catch (err) {
    console.error("Groq error:", err.response?.data || err.message);
    return "Estoy teniendo un problema para responder ahora.";
  }
}

module.exports = askGroq;