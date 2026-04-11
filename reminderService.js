const reminders = [];

function addReminder(userId, text, time, repeat = null) {
  reminders.push({
    userId,
    text,
    time: new Date(time),
    repeat, // "daily" o null
    done: false
  });
}

function checkReminders() {
  const now = new Date();
  const triggered = [];

  reminders.forEach(r => {
    if (!r.done && now >= r.time) {
      triggered.push(r);

      if (r.repeat === "daily") {
        // repetir al día siguiente
        r.time.setDate(r.time.getDate() + 1);
      } else {
        r.done = true;
      }
    }
  });

  return triggered;
}

module.exports = {
  addReminder,
  checkReminders
};