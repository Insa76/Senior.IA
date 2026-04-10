const { getReminders } = require("./memory");
const sendAlert = require("./alertService");

const reminderMessages = {};
let lastRun = {}; // evitar repetición
let pendingConfirmations = {}; // 🔥 control de confirmaciones

function startReminderEngine() {

  setInterval(() => {

    const now = new Date();
    const hour = now.getHours();
    const minute = now.getMinutes();

    const userId = "web-user"; // luego lo hacemos dinámico

    const reminders = getReminders(userId);

    reminders.forEach(r => {

      if (parseInt(r.time) === hour && minute === 0) {

        const msg = `Es hora de tomar ${r.medicine}`;

        // 🔥 EVITAR REPETICIÓN
        const key = `${userId}-${r.medicine}-${r.time}`;

        if (lastRun[key] === hour) return;
        lastRun[key] = hour;

        console.log("⏰ RECORDATORIO:", msg);

        // guardar mensaje para frontend
        if (!reminderMessages[userId]) {
          reminderMessages[userId] = [];
        }

        reminderMessages[userId].push(msg);

        // 🔥 GUARDAR PENDIENTE DE CONFIRMACIÓN
        if (!pendingConfirmations[userId]) {
          pendingConfirmations[userId] = [];
        }

        const reminderData = {
          medicine: r.medicine,
          time: new Date().toISOString(),
          confirmed: false
        };

        pendingConfirmations[userId].push(reminderData);

        // =====================
        // ⏱️ CONFIRMACIÓN (1 min después)
        // =====================
        setTimeout(() => {

          const confirmMsg = `¿Ya tomaste ${r.medicine}?`;

          if (!reminderMessages[userId]) {
            reminderMessages[userId] = [];
          }

          reminderMessages[userId].push(confirmMsg);

        }, 60000);

        // =====================
        // 🚨 ALERTA SI NO CONFIRMA (3 min después)
        // =====================
        setTimeout(async () => {

          const pending = pendingConfirmations[userId]?.find(p =>
            p.medicine === r.medicine && !p.confirmed
          );

          if (pending) {
            await sendAlert(`⚠️ No se confirmó la toma de ${r.medicine}`);
          }

        }, 180000);

      }

    });

  }, 60000);
}

// =====================
// 📤 FRONTEND FETCH
// =====================
function getRemindersForUser(userId) {
  const msgs = reminderMessages[userId] || [];
  reminderMessages[userId] = [];
  return msgs;
}

// =====================
// ✅ CONFIRMAR TOMA
// =====================
function confirmMedication(userId, message) {

  if (!pendingConfirmations[userId]) return;

  pendingConfirmations[userId].forEach(p => {
    if (!p.confirmed) {
      p.confirmed = true;
    }
  });
}

module.exports = {
  startReminderEngine,
  getRemindersForUser,
  confirmMedication
};