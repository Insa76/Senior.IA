const test = require('node:test');
const assert = require('node:assert/strict');
const { parseReminder } = require('../reminderParser');

const now = new Date('2026-11-09T15:12:00.000Z'); // 12:12 en Argentina

test('interpreta cantidades escritas con palabras en recordatorios relativos', () => {
  const result = parseReminder('Recordame dentro de dos minutos que tengo que tomar agua', null, now);
  assert.equal(result.matched, true);
  assert.equal(result.text, 'tengo que tomar agua');
  assert.equal(result.time.getTime(), now.getTime() + 120000);
});

test('conserva la solicitud cuando la persona responde solamente el horario', () => {
  const pending = { text: 'tomar agua', expiresAt: now.getTime() + 900000 };
  const result = parseReminder('dentro de 2 minutos', pending, now);
  assert.equal(result.text, 'tomar agua');
  assert.equal(result.time.getTime(), now.getTime() + 120000);
});

test('interpreta puntos como separador de hora y minutos en hora argentina', () => {
  const result = parseReminder('Recordame que tome agua a las 20.55', null, now);
  assert.equal(result.text, 'tome agua');
  assert.equal(result.time.toISOString(), '2026-11-09T23:55:00.000Z');
});

test('interpreta hora con p. m. y una corrección de fecha', () => {
  const pending = { text: 'tomar agua', expiresAt: now.getTime() + 900000 };
  const result = parseReminder('No, para hoy a las 20:55 p. m.', pending, now);
  assert.equal(result.time.toISOString(), '2026-11-09T23:55:00.000Z');
  assert.equal(result.text, 'tomar agua');
});

test('no intercepta una conversación normal sin intención ni aclaración pendiente', () => {
  assert.equal(parseReminder('Hoy tomé agua a las 20:55', null, now), null);
});

test('rechaza horas y minutos fuera de rango', () => {
  const result = parseReminder('Recordame hoy a las 25:75', null, now);
  assert.equal(result.invalid, true);
});


test('interpreta recurrencia de lunes a viernes y limpia la descripción', () => {
  const result = parseReminder('Recordame caminar de lunes a viernes a las 18', null, now);
  assert.equal(result.text, 'caminar');
  assert.equal(result.repeat, 'weekdays');
  assert.ok(result.time instanceof Date);
});

test('reconoce consultas de pendientes y cancelación por descripción', () => {
  const { parseReminderManagement } = require('../reminderParser');
  assert.equal(parseReminderManagement('¿Qué cosas tengo pendientes?', []).action, 'list');
  const reminders = [{ id: 'r1', text: 'tomar agua', done: false }];
  const result = parseReminderManagement('Cancelá el recordatorio del agua', reminders);
  assert.equal(result.action, 'cancel');
  assert.equal(result.reminder.id, 'r1');
});

test('interpreta modificación de recordatorio para una hora indicada', () => {
  const { parseReminderManagement } = require('../reminderParser');
  const reminders = [{ id: 'r1', text: 'tomar agua', done: false }];
  const result = parseReminderManagement('Pasá el recordatorio del agua para las 10', reminders, now);
  assert.equal(result.action, 'reschedule');
  assert.equal(result.time.toISOString(), '2026-11-10T13:00:00.000Z');
});


test('reconoce la consulta literal de recordatorios pendientes', () => {
  const { parseReminderManagement } = require('../reminderParser');
  assert.equal(parseReminderManagement('¿Qué recordatorios tengo pendientes?', []).action, 'list');
});

test('no deja restos de "de la mañana" en el texto ni lo interpreta como fecha de mañana', () => {
  const result = parseReminder('Recordame tomar agua todos los días a las 9 de la mañana', null, now);
  assert.equal(result.text, 'tomar agua');
  assert.equal(result.repeat, 'daily');
  assert.equal(result.time.toISOString(), '2026-11-10T12:00:00.000Z');
});

test('acepta variantes naturales de consulta de recordatorios', () => {
  const { parseReminderManagement } = require('../reminderParser');
  for (const phrase of ['¿Qué recordatorios tengo pendientes?', '¿Qué cosas tengo pendientes?', 'Mostrame mis recordatorios', 'Mis recordatorios']) {
    assert.equal(parseReminderManagement(phrase, []).action, 'list', phrase);
  }
});
