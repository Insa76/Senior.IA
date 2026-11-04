const { getReminders, saveReminder, setReminders } = require("./memory");

function addReminder(userId, text, time, repeat = null) {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) throw new Error("La fecha del recordatorio no es válida.");

  const reminder = {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    userId,
    text: String(text),
    time: date.toISOString(),
    repeat: repeat === "daily" ? "daily" : null,
    done: false,
    notified: false
  };

  saveReminder(userId, reminder);
  return reminder;
}

function checkReminders(userId) {
  const reminders = getReminders(userId);
  const now = Date.now();
  const triggered = [];
  let changed = false;

  for (const reminder of reminders) {
    if (reminder.done || reminder.notified) continue;
    const dueAt = new Date(reminder.time).getTime();
    if (!Number.isFinite(dueAt) || dueAt > now) continue;

    triggered.push({ ...reminder });
    reminder.notified = true;
    changed = true;

    if (reminder.repeat === "daily") {
      const next = new Date(dueAt);
      next.setDate(next.getDate() + 1);
      reminder.time = next.toISOString();
      reminder.notified = false;
    } else {
      reminder.done = true;
    }
  }

  if (changed) setReminders(userId, reminders);
  return triggered;
}

module.exports = { addReminder, checkReminders };
