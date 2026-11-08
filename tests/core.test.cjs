const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const os = require("node:os");
const path = require("node:path");

const dataDir = fs.mkdtempSync(path.join(os.tmpdir(), "senioria-test-"));
process.env.SENIORIA_DATA_DIR = dataDir;
const memory = require("../memory");
const { addReminder, checkReminders } = require("../reminderService");
test.before(async () => memory.init());
test.after(async () => { await memory.close(); fs.rmSync(dataDir, { recursive: true, force: true }); });

test("crea cuentas con identificador aleatorio y token familiar independiente", async () => {
  const account = await memory.createAccount();
  assert.match(account.userId, /^u-[a-f0-9]{64}$/);
  assert.equal(await memory.verifyFamilyToken(account.userId, account.familyToken), true);
  assert.equal(await memory.verifyFamilyToken(account.userId, "token-incorrecto"), false);
  assert.equal((await memory.getProfile(account.userId)).familyToken, undefined);
});

test("normaliza emociones y descarta registros históricos inválidos", async () => {
  await memory.saveProfile("test-user", {
    history: [
      { emotion: "una respuesta extensa de NORA", time: "2026-01-01T00:00:00.000Z" },
      { emotion: "triste", time: "2026-01-02T00:00:00.000Z" }
    ]
  });
  await memory.saveEmotion("test-user", "texto inesperado");
  const profile = await memory.getProfile("test-user");
  assert.equal(profile.lastEmotion, "neutral");
  assert.deepEqual(profile.history.map(item => item.emotion), ["triste", "neutral"]);
});

test("un recordatorio vencido queda persistido hasta su confirmación", async () => {
  const reminder = await addReminder("test-user", "Tomar agua", new Date(Date.now() - 1000));
  const triggered = await checkReminders("test-user");
  assert.equal(triggered.some(item => item.id === reminder.id), true);
  assert.equal((await memory.getPendingNotifications("test-user")).some(item => item.id === reminder.id), true);
  assert.equal((await memory.getReminders("test-user")).find(item => item.id === reminder.id).done, false);
  assert.equal(await memory.acknowledgeNotification("test-user", reminder.id), true);
  assert.equal((await memory.getPendingNotifications("test-user")).some(item => item.id === reminder.id), false);
  assert.equal((await memory.getReminders("test-user")).find(item => item.id === reminder.id).done, true);
});

test("no vuelve a encolar un recordatorio ya notificado", async () => {
  const reminder = await addReminder("test-user-2", "Llamar", new Date(Date.now() - 1000));
  assert.equal((await checkReminders("test-user-2")).length, 1);
  assert.equal((await checkReminders("test-user-2")).length, 0);
});

test("los seguimientos emocionales quedan persistidos y se recuperan como pendientes", async () => {
  const { scheduleFollowUp, processDueFollowUps, getFollowUps, acknowledgeFollowUp } = require("../followUpService");
  await scheduleFollowUp("follow-user", { lastEmotion: "triste" });
  const stored = await memory.getProfile("follow-user");
  assert.equal(stored.followUpJobs.length, 1);
  assert.equal(stored.followUpJobs[0].status, "pending");

  const processed = await processDueFollowUps({
    now: Date.now() + 61000,
    generateMessage: async () => "Hola, ¿cómo te estás sintiendo ahora?"
  });
  assert.equal(processed, 1);
  const messages = await getFollowUps("follow-user");
  assert.equal(messages.length, 1);
  assert.equal(messages[0].text, "Hola, ¿cómo te estás sintiendo ahora?");
  assert.equal(await acknowledgeFollowUp("follow-user", messages[0].id), true);
  assert.equal((await getFollowUps("follow-user")).length, 0);
});

test("evita programar seguimientos emocionales duplicados mientras hay uno activo", async () => {
  const { scheduleFollowUp } = require("../followUpService");
  await scheduleFollowUp("follow-user-duplicate", { lastEmotion: "ansioso" });
  await scheduleFollowUp("follow-user-duplicate", { lastEmotion: "triste" });
  const profile = await memory.getProfile("follow-user-duplicate");
  assert.equal(profile.followUpJobs.length, 1);
});
