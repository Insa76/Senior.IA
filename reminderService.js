const { claimDueReminders } = require('./memory');

async function addReminder(userId, text, time, repeat = null) {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) throw new Error('La fecha del recordatorio no es válida.');
  const crypto = require('crypto');
  const reminder = {
    id: `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`,
    userId,
    text: String(text).trim().slice(0, 500),
    time: date.toISOString(),
    repeat: repeat === 'daily' ? 'daily' : null,
    done: false,
    notified: false
  };
  const memory = require('./memory');
  await memory.saveReminder(userId, reminder);
  return reminder;
}

// La reclamación y la persistencia de cada notificación se realizan en una sola operación atómica.
async function checkReminders(userId, now = Date.now()) {
  return claimDueReminders(userId, now);
}

module.exports = { addReminder, checkReminders };
