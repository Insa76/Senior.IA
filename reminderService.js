const { getReminders, saveReminder, setReminders, enqueuePendingNotification } = require('./memory');
const crypto = require('crypto');

async function addReminder(userId, text, time, repeat = null) {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) throw new Error('La fecha del recordatorio no es válida.');
  const reminder = {
    id: `${Date.now()}-${crypto.randomBytes(5).toString('hex')}`,
    userId,
    text: String(text).trim().slice(0, 500),
    time: date.toISOString(),
    repeat: repeat === 'daily' ? 'daily' : null,
    done: false,
    notified: false
  };
  await saveReminder(userId, reminder);
  return reminder;
}

async function checkReminders(userId) {
  const reminders = await getReminders(userId);
  const now = Date.now();
  const triggered = [];
  let changed = false;
  for (const reminder of reminders) {
    if (reminder.done || reminder.notified) continue;
    const dueAt = new Date(reminder.time).getTime();
    if (!Number.isFinite(dueAt) || dueAt > now) continue;
    const notification = { id: reminder.id, text: reminder.text, time: reminder.time, createdAt: new Date().toISOString() };
    await enqueuePendingNotification(userId, notification);
    triggered.push(notification);
    reminder.notified = true;
    if (reminder.repeat === 'daily') {
      const next = new Date(dueAt);
      do { next.setDate(next.getDate() + 1); } while (next.getTime() <= now);
      reminder.time = next.toISOString(); reminder.notified = false;
    }
    changed = true;
  }
  if (changed) await setReminders(userId, reminders);
  return triggered;
}
module.exports = { addReminder, checkReminders };
