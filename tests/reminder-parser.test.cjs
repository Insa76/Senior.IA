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
