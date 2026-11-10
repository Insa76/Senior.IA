'use strict';

const TIME_ZONE = 'America/Argentina/Cordoba';
const NUMBER_WORDS = new Map([
  ['un', 1], ['uno', 1], ['una', 1], ['dos', 2], ['tres', 3], ['cuatro', 4],
  ['cinco', 5], ['seis', 6], ['siete', 7], ['ocho', 8], ['nueve', 9],
  ['diez', 10], ['once', 11], ['doce', 12], ['quince', 15], ['veinte', 20],
  ['treinta', 30], ['cuarenta', 40], ['cincuenta', 50], ['sesenta', 60],
  ['setenta', 70], ['ochenta', 80], ['noventa', 90], ['cien', 100]
]);
const INTENT = /(?<![\p{L}\p{N}_])(?:recordame|recordarme|recuérdame|recordá|acordate|poneme\s+un\s+recordatorio|creá\s+un\s+recordatorio|agendame|agendá|avisame)(?![\p{L}\p{N}_])/iu;

function numberValue(value) {
  if (/^\d+$/.test(value)) return Number(value);
  return NUMBER_WORDS.get(value.toLowerCase());
}

function zonedParts(date, timeZone = TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23'
  }).formatToParts(date);
  return Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, Number(part.value)]));
}

function zonedDateTimeToUtc(year, month, day, hour, minute, timeZone = TIME_ZONE) {
  const desired = Date.UTC(year, month - 1, day, hour, minute, 0, 0);
  let guess = desired;
  for (let i = 0; i < 3; i += 1) {
    const parts = zonedParts(new Date(guess), timeZone);
    const represented = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
    const offset = represented - guess;
    guess = desired - offset;
  }
  return new Date(guess);
}

function cleanReminderText(text) {
  return String(text || '')
    .replace(/^\s*(?:por favor[, ]*)?(?:recordame|recordarme|recuérdame|recordá|acordate|agendame|agendá|avisame)\b/i, '')
    .replace(/^\s*(?:que|por favor)\s+/i, '')
    .replace(/\b(?:en|dentro de)\s+(?:\d+|un|uno|una|dos|tres|cuatro|cinco|diez|quince|veinte|treinta|cuarenta|cincuenta|sesenta)\s+(?:minutos?|horas?)\b/ig, '')
    .replace(/\b(?:de lunes a viernes|los días hábiles|los dias habiles)\b/ig, '')
    .replace(/\b(?:todos los días|todos los dias|diariamente)\b/ig, '')
    // Eliminar primero el complemento horario; si se borra "mañana" antes,
    // queda el residuo "de la" en la descripción del recordatorio.
    .replace(/\bde la (?:mañana|tarde|noche)\b/ig, '')
    .replace(/\b(?:pasado mañana|hoy|mañana)\b/ig, '')
    .replace(/\b(?:a las?|para las?)\s*\d{1,2}(?:[:.]\d{1,2})?\s*(?:a\.?\s*m\.?|p\.?\s*m\.?)?/ig, '')
    .replace(/^\s*(?:que|por favor)\s+/i, '')
    .replace(/[,.!?;:]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseReminder(message, pending = null, now = new Date()) {
  const raw = String(message || '').trim();
  const lower = raw.toLocaleLowerCase('es-AR');
  const hasIntent = INTENT.test(lower);
  const pendingValid = pending && Number(pending.expiresAt) > now.getTime();
  const hasTimeExpression = /\b(?:en|dentro de)\s+(?:\d+|[a-záéíóú]+)\s+(?:minutos?|horas?)\b|\b(?:a las?|para las?)\s*\d{1,2}(?:[:.]\d{1,2})?|\b(?:hoy|mañana|pasado mañana)\b|\b(?:todos los días|todos los dias|diariamente|de lunes a viernes|los días hábiles|los dias habiles)\b/i.test(lower);

  if (!hasIntent && !(pendingValid && hasTimeExpression)) return null;

  const taskText = hasIntent ? cleanReminderText(raw) : String(pending.text || '').trim();
  const repeat = /\b(?:de lunes a viernes|los días hábiles|los dias habiles)\b/i.test(lower)
    ? 'weekdays'
    : (/\b(?:todos los días|todos los dias|diariamente)\b/i.test(lower) ? 'daily' : (pending?.repeat || null));

  const relative = lower.match(/\b(?:en|dentro de)\s+(\d+|un|uno|una|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|quince|veinte|treinta|cuarenta|cincuenta|sesenta|setenta|ochenta|noventa|cien)\s+(minutos?|horas?)\b/i);
  if (relative) {
    const amount = numberValue(relative[1]);
    const unit = relative[2].toLowerCase();
    const max = unit.startsWith('min') ? 10080 : 168;
    if (!amount || amount < 1 || amount > max) return { matched: true, invalid: true, text: taskText, repeat };
    const multiplier = unit.startsWith('min') ? 60000 : 3600000;
    return { matched: true, time: new Date(now.getTime() + amount * multiplier), text: taskText, repeat };
  }

  const clock = lower.match(/\b(?:a las?|para las?)\s*(\d{1,2})(?:\s*[:.]\s*(\d{1,2}))?\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i)
    || lower.match(/\b(\d{1,2})\s*[:.]\s*(\d{1,2})\s*(a\.?\s*m\.?|p\.?\s*m\.?)?/i);

  if (clock) {
    let hour = Number(clock[1]);
    const minute = Number(clock[2] || 0);
    const meridiem = String(clock[3] || '').replace(/\s|\./g, '').toLowerCase();
    if (hour > 23 || minute > 59 || (meridiem && hour < 1) || (meridiem === 'am' && hour > 12)) {
      return { matched: true, invalid: true, text: taskText, repeat };
    }
    if (meridiem === 'pm' && hour < 12) hour += 12;
    if (meridiem === 'am' && hour === 12) hour = 0;
    if (!meridiem && hour === 12 && /\b(?:del mediodía|del mediodia)\b/i.test(lower)) hour = 12;
    if (!meridiem && hour <= 12 && /\b(?:de la tarde|de la noche)\b/i.test(lower) && hour < 12) hour += 12;
    if (!meridiem && hour <= 12 && /\bde la mañana\b/i.test(lower) && hour === 12) hour = 0;

    const current = zonedParts(now);
    const explicitTomorrow = /\bmañana\b/i.test(lower) && !/\bde la mañana\b/i.test(lower) && !/\bmañana\s+por\s+la\s+mañana\b/i.test(lower);
    const explicitToday = /\bhoy\b/i.test(lower);
    const base = new Date(Date.UTC(current.year, current.month - 1, current.day + (explicitTomorrow ? 1 : 0)));
    let due = zonedDateTimeToUtc(base.getUTCFullYear(), base.getUTCMonth() + 1, base.getUTCDate(), hour, minute);
    if (!explicitToday && !explicitTomorrow && due.getTime() <= now.getTime()) {
      const next = new Date(Date.UTC(base.getUTCFullYear(), base.getUTCMonth(), base.getUTCDate() + 1));
      due = zonedDateTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), hour, minute);
    }
    return { matched: true, time: due, text: taskText, repeat };
  }

  if (pendingValid && /\bmañana\b/i.test(lower) && pending.hour != null) {
    const current = zonedParts(now);
    const next = new Date(Date.UTC(current.year, current.month - 1, current.day + 1));
    return {
      matched: true,
      time: zonedDateTimeToUtc(next.getUTCFullYear(), next.getUTCMonth() + 1, next.getUTCDate(), pending.hour, pending.minute || 0),
      text: taskText,
      repeat
    };
  }

  return { matched: true, needsTime: true, text: taskText, repeat };
}


function normalizeWords(value) {
  return String(value || '').toLocaleLowerCase('es-AR').normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '').replace(/[^a-z0-9 ]/g, ' ')
    .replace(/\s+/g, ' ').trim();
}

function parseReminderManagement(message, reminders = [], now = new Date()) {
  const raw = String(message || '').trim();
  const normalized = normalizeWords(raw);
  if (
    /^(?:(?:que|cuales)\s+)?(?:recordatorios|cosas)\s+(?:tengo\s+)?(?:pendientes?)\??$/.test(normalized) ||
    /^que\s+recordatorios\s+tengo(?:\s+pendientes?)?\??$/.test(normalized) ||
    /^(?:mis\s+)?recordatorios(?:\s+pendientes?)?\??$/.test(normalized) ||
    /^(?:mostrame|muestrame|lista)\s+(?:mis\s+)?recordatorios\??$/.test(normalized) ||
    /^que\s+(?:cosas\s+)?tengo\s+pendientes?\??$/.test(normalized)
  ) {
    return { action: 'list' };
  }

  const cancelMatch = raw.match(/\b(?:cancel[aá]|elimin[aá]|borr[aá])\s+(?:el\s+)?recordatorio(?:\s+(?:de|del|para)\s+(.+?))?[.!?]*$/i);
  if (cancelMatch) {
    const target = normalizeWords(cancelMatch[1] || '');
    if (!target) return { action: 'need_target', operation: 'cancel' };
    return matchReminderTarget(target, reminders, 'cancel');
  }

  const modifyMatch = raw.match(/\b(?:cambi[aá]|modific[aá]|pas[aá]|mov[eé])\s+(?:el\s+)?recordatorio\s+(?:de|del|para)\s+(.+?)\s+(?:para|a\s+las?)\s+(.+)$/i);
  if (modifyMatch) {
    const target = normalizeWords(modifyMatch[1]);
    const timePhrase = modifyMatch[2].trim();
    const normalizedTimePhrase = /^las?\s+/i.test(timePhrase) ? `a ${timePhrase}` : timePhrase;
    const parsed = parseReminder(`Recordame ${normalizedTimePhrase}`, null, now);
    if (!parsed?.time || parsed.invalid) return { action: 'invalid_time' };
    return { ...matchReminderTarget(target, reminders, 'reschedule'), time: parsed.time };
  }
  return null;
}

function matchReminderTarget(target, reminders, action) {
  const active = reminders.filter(item => !item.done);
  const matches = active.filter(item => {
    const text = normalizeWords(item.text);
    return text.includes(target) || target.split(' ').filter(word => word.length > 2).every(word => text.includes(word));
  });
  if (!matches.length) return { action: 'not_found' };
  if (matches.length > 1) return { action: 'ambiguous', matches: matches.map(item => ({ id: item.id, text: item.text })) };
  return { action, reminder: matches[0] };
}

module.exports = { parseReminder, parseReminderManagement, TIME_ZONE, zonedDateTimeToUtc };
