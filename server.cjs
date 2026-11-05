const express = require("express");
const cors = require("cors");
const path = require("path");
require("dotenv").config();

const askGroq = require("./groqService");
const detectEmotionAI = require("./emotionService");
const memory = require("./memory");
const detectEmergency = require("./emergencyService");
const sendAlert = require("./alertService");
const { scheduleFollowUp, getFollowUps } = require("./followUpService");
const analyzeRisk = require("./alertLogic");
const { addReminder, checkReminders } = require("./reminderService");
const webpush = require("web-push");

const app = express();
const PORT = Number(process.env.PORT) || 3000;
const BASE_PROMPT = `
Te llamás NORA. Sos una acompañante conversacional para personas mayores.
Hablá en español rioplatense, con calidez, paciencia y respeto.
Usá palabras sencillas y frases cortas. No infantilices a la persona.
Escuchá antes de aconsejar. No inventes datos ni afirmes haber realizado acciones que no se confirmaron.
No diagnostiques enfermedades ni reemplaces a profesionales de salud.
Si la persona describe una emergencia médica, recomendá llamar al servicio local de emergencias y avisar a una persona de confianza.
`;
const STYLE_RULES = "Respondé de manera natural, breve y cercana. Usá el nombre solo cuando resulte natural.";

app.disable("x-powered-by");
app.use(cors());
app.use(express.json({ limit: "1mb" }));
app.use(express.static(path.join(__dirname, "public")));

let pushConfigured = false;
if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
  try {
    webpush.setVapidDetails(
      process.env.VAPID_SUBJECT || "mailto:admin@example.com",
      process.env.VAPID_PUBLIC_KEY,
      process.env.VAPID_PRIVATE_KEY
    );
    pushConfigured = true;
  } catch (error) {
    console.error("Configuración VAPID inválida:", error.message);
  }
}

const pendingNotifications = new Map();

function validUserId(value) {
  return typeof value === "string" &&
    value.trim().length > 0 &&
    value.trim().length <= 80 &&
    !/[\/\\\\?#]/.test(value);
}

function enqueueNotification(userId, item) {
  const current = pendingNotifications.get(userId) || [];
  current.push(item);
  pendingNotifications.set(userId, current.slice(-30));
}

async function sendPushToUser(userId, message) {
  if (!pushConfigured) return;
  const subscriptions = memory.getPushSubscriptions(userId);

  await Promise.all(subscriptions.map(async subscription => {
    try {
      await webpush.sendNotification(subscription, JSON.stringify({
        title: "NORA",
        body: message,
        url: `/?userId=${encodeURIComponent(userId)}`
      }));
    } catch (error) {
      if (error.statusCode === 404 || error.statusCode === 410) {
        memory.removePushSubscription(userId, subscription.endpoint);
      } else {
        console.error("Error enviando push:", error.message);
      }
    }
  }));
}

// Revisa recordatorios aunque la pantalla de NORA no esté abierta.
// En servicios gratuitos que suspenden el proceso, el chequeo se pausa mientras duermen.
async function processDueReminders() {
  for (const userId of memory.getAllUserIds()) {
    const due = checkReminders(userId);
    for (const reminder of due) {
      enqueueNotification(userId, reminder);
      await sendPushToUser(userId, reminder.text);
      console.log(`Recordatorio vencido para ${userId}.`);
    }
  }
}
const reminderTimer = setInterval(() => {
  processDueReminders().catch(error => console.error("Error revisando recordatorios:", error.message));
}, 15000);
if (typeof reminderTimer.unref === "function") reminderTimer.unref();

function parseReminder(message) {
  const lower = message.toLowerCase();
  // Detecta pedidos explícitos de recordatorio sin confundir "recordás" (recordar en presente).
  // La coincidencia por palabra completa evita interceptar preguntas como "¿qué recordás de mí?".
  const hasReminderIntent = /(?<![\p{L}\p{N}_])(?:recordame|recordarme|recuérdame|recordá|acordate|poneme un recordatorio|creá un recordatorio|agendame)(?![\p{L}\p{N}_])/iu.test(lower);
  if (!hasReminderIntent) return null;

  const now = new Date();
  let time = null;
  let repeat = null;

  const minutes = lower.match(/\ben (\d{1,3}) minutos?\b/);
  const hoursAhead = lower.match(/\ben (\d{1,2}) horas?\b/);
  const hour = lower.match(/\ba las (\d{1,2})(?::(\d{2}))?\b/);

  if (minutes) {
    const amount = Number(minutes[1]);
    if (amount < 1 || amount > 10080) return { invalid: true };
    time = new Date(now.getTime() + amount * 60000);
  } else if (hoursAhead) {
    const amount = Number(hoursAhead[1]);
    if (amount < 1 || amount > 168) return { invalid: true };
    time = new Date(now.getTime() + amount * 60 * 60000);
  } else if (hour) {
    const h = Number(hour[1]);
    const m = Number(hour[2] || 0);
    if (h > 23 || m > 59) return { invalid: true };
    time = new Date(now);
    if (lower.includes("mañana")) time.setDate(time.getDate() + 1);
    time.setHours(h, m, 0, 0);
    if (!lower.includes("mañana") && time <= now) time.setDate(time.getDate() + 1);
  }

  if (lower.includes("mañana") && !time) return { needsTime: true };

  if (lower.includes("todos los días") || lower.includes("todos los dias")) {
    repeat = "daily";
  }

  if (!time) return { needsTime: true };
  return { time, repeat };
}

app.get("/health", (req, res) => {
  res.json({
    status: "ok",
    service: "SeniorIA",
    groqConfigured: Boolean(process.env.GROQ_API_KEY),
    whatsappConfigured: Boolean(
      process.env.WHATSAPP_TOKEN &&
      process.env.WHATSAPP_PHONE_NUMBER_ID &&
      process.env.WHATSAPP_TO
    ),
    pushConfigured
  });
});

app.get("/push/public-key", (req, res) => {
  if (!pushConfigured) return res.status(503).json({ error: "Notificaciones push no configuradas." });
  res.json({ publicKey: process.env.VAPID_PUBLIC_KEY });
});

app.post("/subscribe/:userId", (req, res) => {
  const { userId } = req.params;
  if (!validUserId(userId)) return res.status(400).json({ error: "Usuario inválido." });
  try {
    memory.savePushSubscription(userId, req.body);
    res.status(201).json({ ok: true });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
});

app.get("/follow-up/:userId", (req, res) => {
  if (!validUserId(req.params.userId)) return res.status(400).json({ messages: [] });
  res.json({ messages: getFollowUps(req.params.userId) });
});

app.get("/family/:userId", (req, res) => {
  const { userId } = req.params;
  if (!validUserId(userId)) return res.status(400).json({ error: "Usuario inválido." });

  const profile = memory.getProfile(userId);
  const risk = analyzeRisk(profile.history || []);
  const status = risk === "alto" ? "urgente" : risk === "medio" ? "atencion" : "normal";

  res.json({
    name: profile.name || "Usuario",
    emotion: profile.lastEmotion || "desconocido",
    lastInteraction: profile.lastInteraction || "sin datos",
    likes: profile.likes || [],
    history: profile.history || [],
    status
  });
});

app.get("/reminders/:userId", (req, res) => {
  const { userId } = req.params;
  if (!validUserId(userId)) return res.status(400).json({ reminders: [] });
  const reminders = pendingNotifications.get(userId) || [];
  pendingNotifications.delete(userId);
  res.json({ reminders });
});

app.post("/chat", async (req, res) => {
  const userId = typeof req.body?.userId === "string" ? req.body.userId.trim() : "";
  const message = typeof req.body?.message === "string" ? req.body.message.trim() : "";

  if (!validUserId(userId)) return res.status(400).json({ error: "Falta un identificador de usuario válido." });
  if (!message) return res.status(400).json({ error: "Escribí un mensaje." });
  if (message.length > 4000) return res.status(413).json({ error: "El mensaje es demasiado largo." });

  memory.saveMessage(userId, "user", message);

  if (detectEmergency(message)) {
    let alertSent = false;
    try {
      await sendAlert(`Usuario: ${userId}\nMensaje: ${message}`);
      alertSent = true;
    } catch (error) {
      console.error("No se pudo confirmar el envío de la alerta:", error.message);
    }

    const reply = alertSent
      ? "Estoy con vos. Ya envié una alerta a tu contacto de confianza. Si estás en peligro o necesitás atención médica, llamá también al servicio local de emergencias."
      : "Estoy con vos. Detecté que necesitás ayuda, pero no pude confirmar el aviso a tu contacto. Si estás en peligro o necesitás atención médica, llamá ahora al servicio local de emergencias y contactá a alguien de confianza.";

    memory.saveMessage(userId, "assistant", reply);
    return res.json({ reply, emergency: true, alertSent });
  }

  try {
    let profile = memory.getProfile(userId);
    if (!profile.name) profile.name = userId;
    profile = memory.extractUserInfo(message, profile);
    memory.saveProfile(userId, profile);

    const reminderRequest = parseReminder(message);
    if (reminderRequest) {
      let reply;
      if (reminderRequest.invalid) {
        reply = "No pude interpretar ese horario. Decime, por ejemplo: «recordame en 10 minutos» o «recordame mañana a las 9».";
      } else if (reminderRequest.needsTime) {
        reply = "Claro. ¿A qué hora o dentro de cuánto tiempo querés que te lo recuerde?";
      } else {
        addReminder(userId, message, reminderRequest.time, reminderRequest.repeat);
        const formatted = reminderRequest.time.toLocaleString("es-AR", {
          dateStyle: "short",
          timeStyle: "short"
        });
        reply = `Perfecto, lo agendé para ${formatted}${reminderRequest.repeat ? " y se repetirá todos los días" : ""}.`;
      }
      memory.saveMessage(userId, "assistant", reply);
      return res.json({ reply, reminder: true });
    }

    const emotion = await detectEmotionAI(message);
    memory.saveEmotion(userId, emotion);

    if (emotion === "triste" || emotion === "ansioso") {
      scheduleFollowUp(userId, { ...profile, lastEmotion: emotion });
    }

    // Inyecta en cada turno los datos personales que la persona compartió y
    // que quedaron guardados en su perfil. Sin esto, el modelo no puede
    // recuperar gustos aunque memory.js los haya persistido correctamente.
    const knownLikes = Array.isArray(profile.likes) ? profile.likes : [];
    const knownNotes = Array.isArray(profile.notes) ? profile.notes : [];
    const personalContext = [
      `Nombre: ${profile.name || "no informado"}`,
      `Gustos e intereses conocidos: ${knownLikes.length ? knownLikes.join(", ") : "todavía no hay datos guardados"}`,
      `Otros datos compartidos: ${knownNotes.length ? knownNotes.join("; ") : "ninguno"}`
    ].join("\n");

    const response = await askGroq(message, {
      system: `${BASE_PROMPT}\n${STYLE_RULES}\n\nCONTEXTO PERSONAL GUARDADO (usá solamente estos datos; no inventes otros):\n${personalContext}\n\nSi la persona pregunta qué recordás de ella, respondé con los gustos e intereses conocidos. Si un dato no figura en el contexto, decí que todavía no lo tenés registrado. Usá su nombre con naturalidad, sin repetirlo en cada respuesta.`
    });

    memory.saveMessage(userId, "assistant", response);
    res.json({ reply: response });
  } catch (error) {
    console.error("Error procesando chat:", error.message);
    res.status(502).json({
      error: "NORA no pudo conectarse con el servicio de conversación. Revisá la conexión y la configuración de Groq."
    });
  }
});

app.get("/chat-history/:userId", (req, res) => {
  const { userId } = req.params;
  if (!validUserId(userId)) return res.status(400).json({ chat: [] });
  res.json({ chat: memory.getChat(userId) });
});

app.use((error, req, res, next) => {
  console.error("Error del servidor:", error.message);
  if (res.headersSent) return next(error);
  res.status(500).json({ error: "Error interno del servidor." });
});

const server = app.listen(PORT, () => {
  console.log(`SeniorIA escuchando en http://localhost:${PORT}`);
});

function shutdown() {
  clearInterval(reminderTimer);
  server.close(() => process.exit(0));
}
process.on("SIGTERM", shutdown);
process.on("SIGINT", shutdown);
