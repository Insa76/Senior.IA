const memory = require("./memory");

async function scheduleFollowUp(userId, profile) {
  const emotion = String(profile?.lastEmotion || "neutral");
  const dueAt = new Date(Date.now() + 60000).toISOString();
  return memory.scheduleFollowUpJob(userId, emotion, dueAt);
}

async function processDueFollowUps(options = {}) {
  const generateMessage = options.generateMessage || (prompt => require("./groqService")(prompt));
  const now = options.now ?? Date.now();
  let processed = 0;
  for (const userId of await memory.getAllUserIds()) {
    let job;
    try {
      job = await memory.getDueFollowUpJob(userId, now);
      if (!job) continue;
      const prompt = `Sos NORA. La persona se sentía ${job.emotion}. Escribí un mensaje corto, cálido y humano para preguntarle cómo está ahora. No diagnostiques ni des consejos médicos.`;
      const message = await generateMessage(prompt);
      if (!String(message || "").trim()) throw new Error("El generador devolvió un mensaje vacío.");
      await memory.completeFollowUpJob(userId, job.id, String(message).trim());
      console.log(`Seguimiento emocional generado para ${userId}.`);
      processed++;
    } catch (error) {
      if (job?.id) await memory.retryFollowUpJob(userId, job.id).catch(retryError => console.error("No se pudo reprogramar el seguimiento:", retryError.message));
      console.error(`Error procesando seguimiento para ${userId}:`, error.message);
    }
  }
  return processed;
}

async function getFollowUps(userId) {
  return memory.getPendingFollowUps(userId);
}

async function acknowledgeFollowUp(userId, followUpId) {
  return memory.acknowledgeFollowUp(userId, followUpId);
}

module.exports = { scheduleFollowUp, processDueFollowUps, getFollowUps, acknowledgeFollowUp };
