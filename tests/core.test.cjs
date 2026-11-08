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
