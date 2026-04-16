const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

console.log("MEMORY:", require("./memory"));

const askGroq = require("./groqService");
const detectEmotionAI = require("./emotionService");

const {
  getProfile,
  saveProfile,
  extractUserInfo,
  saveEmotion,
  getChat,
  saveMessage
} = require("./memory");

const detectEmergency = require("./emergencyService");
const sendAlert = require("./alertService");
const { scheduleFollowUp, getFollowUps } = require("./followUpService");
const analyzeRisk = require("./alertLogic");
const { addReminder, checkReminders } = require("./reminderService");



const webpush = require("web-push");

// =====================
// 🔔 CONFIG PUSH
// =====================
webpush.setVapidDetails(
  "mailto:test@test.com",
  "BMMdW8MdRQZRJDfHryu7-_Vq5UYZ6s61s88vOwTlp-Uqvm8aNdDn9B31C_lEOZUX1KD9SxV5_dzNGnaBvcLElsY",
  "2EnXMPI6vbarQPcio4wDeuPwUAcR0ouZRvYCTfcO93Y"
);

const subscriptions = [];


// =====================
// 🚀 APP
// =====================
const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

// =====================
// 🧠 PROMPT BASE
// =====================
const BASE_PROMPT = `
Te llamás NORA.
Sos un asistente para acompañar personas mayores.

- cálida
- paciente
- cercana
- clara

Nunca digas que sos una IA.
`;

const STYLE_RULES = `
- hablá simple
- tono humano
- frases cortas
`;

// =====================
// 🔁 FOLLOW UP
// =====================
app.get("/follow-up/:userId", (req, res) => {
  res.json({ messages: getFollowUps(req.params.userId) });
});

// =====================
// 👨‍👩‍👧 PANEL
// =====================
app.get("/family/:userId", (req, res) => {
  const profile = getProfile(req.params.userId);

  const risk = analyzeRisk(profile.history || []);

  let status = "normal";
  if (risk === "medio") status = "atencion";
  if (risk === "alto") status = "urgente";

  res.json({
    name: profile.name || "Usuario",
    emotion: profile.lastEmotion || "desconocido",
    lastInteraction: profile.lastInteraction || "sin datos",
    likes: profile.likes || [],
    history: profile.history || [],
    status
  });
});

// =====================
// 🔔 RECORDATORIOS
// =====================
app.get("/reminders/:userId", (req, res) => {
  const list = checkReminders().filter(r => r.userId === req.params.userId);

  // 🔔 enviar push también
  list.forEach(r => sendPush(r.text));

  res.json({ reminders: list });
});

// =====================
// 📩 SUSCRIPCIÓN PUSH
// =====================
app.post("/subscribe", (req, res) => {
  subscriptions.push(req.body);
  res.status(201).json({});
});

// =====================
// 🔔 ENVIAR PUSH
// =====================
function sendPush(message) {
  subscriptions.forEach(sub => {
    webpush.sendNotification(sub, JSON.stringify({
      title: "NORA",
      body: message
    })).catch(console.error);
  });
}

// =====================
// 💬 CHAT
// =====================
app.post("/chat", async (req, res) => {
  const { userId, message } = req.body;
  const msg = message.toLowerCase();
  const now = new Date();

  saveMessage(userId, "user", message);

  // 🚨 EMERGENCIA
  if (detectEmergency(message)) {
    await sendAlert(`Emergencia: ${message}`);

    return res.json({
      reply: "Estoy con vos. Ya avisé a alguien de confianza."
    });
  }

  try {
    let profile = getProfile(userId);
    if (!profile.name) {
      profile.name = userId;
     }
    profile = extractUserInfo(message, profile);
    saveProfile(userId, profile);

    // =====================
    // 🔔 RECORDATORIOS INTELIGENTES
    // =====================
    if (msg.includes("recordame")) {

      let time = new Date();
      let repeat = null;

      // minutos
      const min = msg.match(/en (\d+) minutos/);
      if (min) {
        time = new Date(now.getTime() + parseInt(min[1]) * 60000);
      }

      // hora
      const hour = msg.match(/a las (\d{1,2})/);
      if (hour) {
        time.setHours(parseInt(hour[1]));
        time.setMinutes(0);
        time.setSeconds(0);
      }

      // mañana
      if (msg.includes("mañana")) {
        time.setDate(time.getDate() + 1);
      }

      // diario
      if (msg.includes("todos los días") || msg.includes("todos los dias")) {
        repeat = "daily";
      }

      addReminder(userId, message, time, repeat);

      return res.json({
        reply: "Perfecto, ya lo agendé 👍"
      });
    }

    // =====================
    // 😊 EMOCIÓN
    // =====================
    const emotion = await detectEmotionAI(message);

    saveEmotion(userId, emotion);

    if (emotion.includes("triste") || emotion.includes("ansioso")) {
      scheduleFollowUp(userId, profile);
    }

    // =====================
    // 🧠 PROMPT
    // =====================
    const prompt = `
     ${BASE_PROMPT}
     ${STYLE_RULES}

     Nombre del usuario: ${profile.name}

      Regla importante:
      - si sabés el nombre, usalo de forma natural (no en todas las frases)

      Usuario: ${message}
      Asistente:
      `;

    const response = await askGroq(prompt);

    saveMessage(userId, "bot", response);

    res.json({ reply: response });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error IA" });
  }
});

app.get("/chat-history/:userId", (req, res) => {
  res.json({ chat: getChat(req.params.userId) });
});

// =====================
app.listen(3000, () => {
  console.log("http://localhost:3000");
});