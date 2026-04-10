const axios = require("axios");

const TOKEN = "EAARKOw1dMGABRPM6VQS0WzcoQ6AJThrB2GH1deK8OVmGZCoAnBAGY7XgtyLAClqIYk8K5HEgvqkXZBX4TFtMn7nGT07UttqOXFcAZBOxhC6RtWDvJEDZBkB7J1vzQ1oI9XnYagGaHZBs1nex0tkfbc0WbkKSHIpJrou1dZBI1RYXFCvCQbvp2m66waxhhZBYND1ZAQiAeX0Dzm479DHnPCGt1BjXyZBmFJdpy5lEcaiL2x3clAVsekAoluwSGN7iYqAKaQP481cnWp9ADg9qkCQZDZD";
const PHONE_ID = "1020788491125292"; // el que te dio Meta
const TO = "543624745181"; // TU número (con código país)

async function sendAlert(message) {
  try {
    await axios.post(
      `https://graph.facebook.com/v18.0/${PHONE_ID}/messages`,
      {
        messaging_product: "whatsapp",
        to: TO,
        type: "text",
        text: {
          body: `🚨 ALERTA\n${message}`
        }
      },
      {
        headers: {
          Authorization: `Bearer ${TOKEN}`,
          "Content-Type": "application/json"
        }
      }
    );

    console.log("✅ WhatsApp enviado");

  } catch (err) {
    console.error("❌ Error:", err.response?.data || err.message);
  }
}

module.exports = sendAlert;