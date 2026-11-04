const axios = require("axios");

async function sendAlert(message) {
  const token = process.env.WHATSAPP_TOKEN;
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID;
  const recipient = process.env.WHATSAPP_TO;
  const apiVersion = process.env.WHATSAPP_API_VERSION || "v26.0";

  if (!token || !phoneNumberId || !recipient) {
    throw new Error("WhatsApp no está configurado. Faltan WHATSAPP_TOKEN, WHATSAPP_PHONE_NUMBER_ID o WHATSAPP_TO.");
  }

  try {
    const response = await axios.post(
      `https://graph.facebook.com/${apiVersion}/${phoneNumberId}/messages`,
      {
        messaging_product: "whatsapp",
        to: recipient,
        type: "text",
        text: { body: `🚨 ALERTA NORA\n${String(message).slice(0, 3000)}` }
      },
      {
        timeout: 15000,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("Alerta de WhatsApp aceptada por Meta.");
    return response.data;
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error("Error enviando alerta WhatsApp:", detail);
    throw new Error("No se pudo enviar la alerta por WhatsApp.");
  }
}

module.exports = sendAlert;
