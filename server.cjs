const express = require("express");
const cors = require("cors");
const path = require("path");

const askOllama = require("./ollamaService");
const detectEmotionAI = require("./emotionService");

const {
  getProfile,
  saveProfile,
  extractUserInfo,
  saveEmotion
} = require("./memory");

const detectEmergency = require("./emergencyService");
const sendAlert = require("./alertService");
const { scheduleFollowUp, getFollowUps } = require("./followUpService");
const analyzeRisk = require("./alertLogic");
const extractReminder = require("./reminderService");
const { saveReminder } = require("./memory");
const { startReminderEngine, getRemindersForUser } = require("./reminderEngine");


const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, "public")));

const BASE_PROMPT = `
Te llamás NORA.

Sos un asistente diseñado para acompañar a personas mayores.

Tu personalidad es:
- cálida
- paciente
- cercana
- respetuosa

Tu forma de hablar:
- simple
- clara
- frases cortas
- tono humano

Reglas:
- nunca digas que sos una IA
- nunca uses lenguaje técnico
- no seas infantil
- respondé como una persona real
- podés hacer preguntas suaves
- generá confianza

Tu objetivo:
- acompañar
- escuchar
- conversar
- hacer sentir bien al usuario
`;

const STYLE_RULES = `
Reglas importantes:
- hablá siempre en el mismo tono
- no cambies de personalidad
- mantené coherencia emocional
`;

// =====================
// 🔥 ENDPOINT FOLLOW-UP
// =====================
app.get("/follow-up/:userId", (req, res) => {
  const messages = getFollowUps(req.params.userId);
  res.json({ messages });
});

// =====================
// 🔥 ENDPOINT PANEL FAMILIAR
// =====================
app.get("/family/:userId", (req, res) => {
  const userId = req.params.userId;
  const profile = getProfile(userId);

  const risk = analyzeRisk(profile.history || []);

let status = "normal";

if (risk === "medio") {
  status = "atencion";
}

if (risk === "alto") {
  status = "urgente";
}

  res.json({
  name: profile.name || "Usuario",
  emotion: profile.lastEmotion || "desconocido",
  lastInteraction: profile.lastInteraction || "sin datos",
  likes: profile.likes || [],
  status,
  history: profile.history || []
});
});

// =====================
// 💬 ENDPOINT CHAT
// =====================
app.post("/chat", async (req, res) => {
  const { userId, message } = req.body;

  const lower = message.toLowerCase();

  // =====================
  // 🚨 EMERGENCIA
  // =====================
  if (detectEmergency(message)) {
    await sendAlert(`Posible emergencia detectada: ${message}`);

    return res.json({
      reply:
        "Estoy con vos. Ya avisé a un contacto de confianza. Tratá de mantener la calma. ¿Querés que te guíe?",
    });
  }

  // =====================
  // ✅ CONFIRMACIÓN MEDICACIÓN
  // =====================
  if (lower.includes("sí") || lower.includes("ya")) {
    confirmMedication(userId, message);

    return res.json({
      reply: "Perfecto 👍 Me alegra que lo hayas tomado.",
    });
  }

  try {
    // =====================
    // PERFIL
    // =====================
    let profile = getProfile(userId);

    profile = extractUserInfo(message, profile);
    saveProfile(userId, profile);

    // =====================
    // RECORDATORIOS
    // =====================
    const reminder = extractReminder(message);

    if (reminder) {
      reminder.times.forEach((time) => {
        saveReminder(userId, {
          time,
          medicine: reminder.medicine,
        });
      });

      return res.json({
        reply: `Perfecto, voy a recordarte tomar ${reminder.medicine}.`,
      });
    }

    // =====================
    // EMOCIÓN
    // =====================
    const emotion = await detectEmotionAI(message);

    let emotionContext = "";

    if (emotion.includes("triste")) {
      emotionContext =
        "El usuario está triste. Respondé con mucha empatía.";
    }
    if (emotion.includes("aburrido")) {
      emotionContext =
        "El usuario está aburrido. Proponé algo.";
    }
    if (emotion.includes("ansioso")) {
      emotionContext =
        "El usuario está ansioso. Respondé con calma.";
    }

    saveEmotion(userId, emotion);

    if (
      emotion.includes("triste") ||
      emotion.includes("ansioso")
    ) {
      scheduleFollowUp(userId, profile);
    }

    const emotionalMemory = `
Estado emocional previo: ${profile.lastEmotion || "desconocido"}
`;

    // =====================
    // NORMALIZAR DATOS
    // =====================
    const safeLikes = Array.isArray(profile.likes)
      ? profile.likes
      : profile.likes
      ? [profile.likes]
      : [];

    const safeNotes = Array.isArray(profile.notes)
      ? profile.notes
      : profile.notes
      ? [profile.notes]
      : [];

    const profileSummary = `
Nombre: ${profile.name || "no especificado"}
Le gusta: ${safeLikes.join(", ")}
Situación: ${profile.living || ""}
Notas: ${safeNotes.join(", ")}
`;

    // =====================
    // PROMPT IA
    // =====================
    const prompt = `
${BASE_PROMPT}

${STYLE_RULES}

Información del usuario:
${profileSummary}

Contexto emocional:
${emotionContext}
${emotionalMemory}

Reglas importantes:
- usá la información del usuario si existe
- si está triste o solo, sugerí algo basado en sus gustos
- hablá como alguien cercano

Usuario: ${message}
Asistente:
`;

    const response = await askOllama(prompt);

    res.json({ reply: response });

  } catch (err) {
    console.error(err);
    res.status(500).json({ error: "Error IA" });
  }
});

app.get("/reminders/:userId", (req, res) => {
  const messages = getRemindersForUser(req.params.userId);
  res.json({ messages });
});

startReminderEngine();

// =====================
app.listen(3000, () => {
  console.log("http://localhost:3000");
});