const fs = require('fs');
const path = require('path');
const crypto = require('crypto');

const dataDir = process.env.SENIORIA_DATA_DIR || __dirname;
const filePath = path.resolve(dataDir, 'profiles.json');
const usePostgres = Boolean(process.env.DATABASE_URL);
let pool = null;
let initialized = false;
let writeQueue = Promise.resolve();

function loadProfiles() {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, 'utf8');
    if (!raw.trim()) return {};
    const data = JSON.parse(raw);
    return data && typeof data === 'object' && !Array.isArray(data) ? data : {};
  } catch (error) {
    console.error('No se pudo leer profiles.json:', error.message);
    throw new Error('No se pudieron recuperar los datos locales.');
  }
}

function saveProfiles(data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tempPath = `${filePath}.${process.pid}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), { encoding: 'utf8', mode: 0o600 });
  fs.renameSync(tempPath, filePath);
}

async function init() {
  if (initialized) return;
  if (usePostgres) {
    const { Pool } = require('pg');
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      ssl: process.env.DATABASE_SSL === 'false' ? false : { rejectUnauthorized: true },
      max: Number(process.env.PG_POOL_MAX) || 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000
    });
    await pool.query(`CREATE TABLE IF NOT EXISTS senioria_profiles (
      user_id TEXT PRIMARY KEY,
      profile JSONB NOT NULL DEFAULT '{}'::jsonb,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    )`);
    // Migración inicial, idempotente: importa perfiles locales solamente si la tabla está vacía.
    const count = await pool.query('SELECT COUNT(*)::int AS total FROM senioria_profiles');
    if (count.rows[0].total === 0 && fs.existsSync(filePath)) {
      const legacy = loadProfiles();
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        for (const [userId, profile] of Object.entries(legacy)) {
          await client.query(
            'INSERT INTO senioria_profiles (user_id, profile) VALUES ($1, $2::jsonb) ON CONFLICT (user_id) DO NOTHING',
            [userId, JSON.stringify(profile || {})]
          );
        }
        await client.query('COMMIT');
        console.log(`Migración local completada: ${Object.keys(legacy).length} perfiles importados.`);
      } catch (error) {
        await client.query('ROLLBACK');
        throw error;
      } finally { client.release(); }
    }
    await pool.query('CREATE INDEX IF NOT EXISTS senioria_profiles_updated_at_idx ON senioria_profiles(updated_at)');
    console.log('Persistencia PostgreSQL habilitada.');
  } else {
    fs.mkdirSync(dataDir, { recursive: true });
    console.log(`Persistencia local JSON habilitada: ${filePath}`);
  }
  initialized = true;
}

async function ensureInit() { if (!initialized) await init(); }
async function readAllProfiles() {
  await ensureInit();
  if (usePostgres) {
    const result = await pool.query('SELECT user_id, profile FROM senioria_profiles');
    return Object.fromEntries(result.rows.map(row => [row.user_id, row.profile || {}]));
  }
  return loadProfiles();
}
async function readProfile(userId = 'default') {
  await ensureInit();
  if (usePostgres) {
    const result = await pool.query('SELECT profile FROM senioria_profiles WHERE user_id = $1', [userId]);
    return result.rows[0]?.profile || {};
  }
  return loadProfiles()[userId] || {};
}
async function writeProfile(userId, profile) {
  await ensureInit();
  if (usePostgres) {
    await pool.query(`INSERT INTO senioria_profiles (user_id, profile, updated_at)
      VALUES ($1, $2::jsonb, NOW())
      ON CONFLICT (user_id) DO UPDATE SET profile = EXCLUDED.profile, updated_at = NOW()`,
      [userId, JSON.stringify(profile || {})]);
    return profile;
  }
  // Serializa escrituras para evitar que dos peticiones simultáneas se pisen.
  const operation = writeQueue.then(() => {
    const data = loadProfiles();
    data[userId] = profile;
    saveProfiles(data);
    return profile;
  });
  writeQueue = operation.catch(() => {});
  return operation;
}
async function updateProfile(userId, updater) {
  await ensureInit();
  if (usePostgres) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      const result = await client.query('SELECT profile FROM senioria_profiles WHERE user_id = $1 FOR UPDATE', [userId]);
      const current = result.rows[0]?.profile || {};
      const next = await updater({ ...current });
      await client.query(`INSERT INTO senioria_profiles (user_id, profile, updated_at)
        VALUES ($1, $2::jsonb, NOW())
        ON CONFLICT (user_id) DO UPDATE SET profile = EXCLUDED.profile, updated_at = NOW()`,
        [userId, JSON.stringify(next || {})]);
      await client.query('COMMIT');
      return next;
    } catch (error) { await client.query('ROLLBACK'); throw error; }
    finally { client.release(); }
  }
  const operation = writeQueue.then(async () => {
    const data = loadProfiles();
    const next = await updater({ ...(data[userId] || {}) });
    data[userId] = next || {};
    saveProfiles(data);
    return data[userId];
  });
  writeQueue = operation.catch(() => {});
  return operation;
}

async function getProfile(userId = 'default') { return readProfile(userId); }
async function saveProfile(userId, profile) {
  return updateProfile(userId, current => ({ ...current, ...(profile || {}) }));
}
function extractUserInfo(text, profile = {}) {
  const normalized = String(text || '').trim();
  const lower = normalized.toLowerCase();
  profile.likes = Array.isArray(profile.likes) ? profile.likes : [];
  profile.notes = Array.isArray(profile.notes) ? profile.notes : [];
  const nameMatch = normalized.match(/\b(?:mi nombre es|me llamo)\s+([^,.!?;]+)/i);
  if (nameMatch) {
    const name = nameMatch[1].trim().replace(/\s+(?:y|pero)\s+.*$/i, '').trim();
    if (name) profile.name = name;
  }
  const likeMatch = normalized.match(/\bme gusta(?:n)?\s+([^,.!?;]+)/i);
  if (likeMatch) {
    const like = likeMatch[1].trim().replace(/\s+(?:y|pero)\s+.*$/i, '').trim();
    if (like && !profile.likes.some(item => String(item).toLowerCase() === like.toLowerCase())) {
      profile.likes.push(like); profile.likes = profile.likes.slice(-50);
    }
  }
  if (lower.includes('vivo solo') || lower.includes('vivo sola')) profile.living = 'solo';
  else if (lower.includes('vivo con')) profile.living = 'acompañado';
  if (/\btengo\b/i.test(lower) && profile.notes[profile.notes.length - 1] !== normalized) {
    profile.notes.push(normalized); profile.notes = profile.notes.slice(-30);
  }
  return profile;
}
const ALLOWED_EMOTIONS = new Set(['feliz', 'triste', 'ansioso', 'aburrido', 'neutral']);
function normalizeEmotion(value) {
  return ALLOWED_EMOTIONS.has(String(value || '').toLowerCase()) ? String(value).toLowerCase() : 'neutral';
}
function getValidHistory(history) {
  if (!Array.isArray(history)) return [];
  return history.filter(item => item && ALLOWED_EMOTIONS.has(String(item.emotion || '').toLowerCase()))
    .map(item => ({ emotion: normalizeEmotion(item.emotion), time: item.time || null })).slice(-50);
}
async function saveEmotion(userId, emotion) {
  const timestamp = new Date().toISOString();
  emotion = normalizeEmotion(emotion);
  await updateProfile(userId, profile => {
    profile.lastEmotion = emotion; profile.lastInteraction = timestamp;
    profile.history = getValidHistory(profile.history);
    profile.history.push({ emotion, time: timestamp }); profile.history = profile.history.slice(-50);
    return profile;
  });
}
async function saveMessage(userId, role, text) {
  const timestamp = new Date().toISOString();
  await updateProfile(userId, profile => {
    profile.chat = Array.isArray(profile.chat) ? profile.chat : [];
    profile.lastInteraction = timestamp;
    profile.chat.push({ role, text: String(text), time: timestamp });
    profile.chat = profile.chat.slice(-100);
    return profile;
  });
}
async function getChat(userId) { const chat = (await getProfile(userId)).chat; return Array.isArray(chat) ? chat : []; }
async function saveReminder(userId, reminder) {
  return updateProfile(userId, profile => {
    profile.reminders = Array.isArray(profile.reminders) ? profile.reminders : [];
    profile.reminders.push(reminder); return profile;
  });
}
async function getReminders(userId) { const reminders = (await getProfile(userId)).reminders; return Array.isArray(reminders) ? reminders : []; }
async function setReminders(userId, reminders) { return updateProfile(userId, profile => { profile.reminders = reminders; return profile; }); }
async function getAllUserIds() {
  await ensureInit();
  if (usePostgres) {
    const result = await pool.query('SELECT user_id FROM senioria_profiles ORDER BY user_id');
    return result.rows.map(row => row.user_id);
  }
  return Object.keys(loadProfiles());
}
async function enqueuePendingNotification(userId, item) {
  return updateProfile(userId, profile => {
    const queue = Array.isArray(profile.pendingNotifications) ? profile.pendingNotifications : [];
    if (!queue.some(entry => entry.id === item.id)) queue.push(item);
    profile.pendingNotifications = queue.slice(-50); return profile;
  });
}
async function getPendingNotifications(userId) {
  const queue = (await getProfile(userId)).pendingNotifications;
  return Array.isArray(queue) ? queue : [];
}
async function acknowledgeNotification(userId, notificationId) {
  let acknowledged = false;
  await updateProfile(userId, profile => {
    const queue = Array.isArray(profile.pendingNotifications) ? profile.pendingNotifications : [];
    acknowledged = queue.some(item => item.id === notificationId);
    profile.pendingNotifications = queue.filter(item => item.id !== notificationId);
    if (acknowledged) {
      const reminders = Array.isArray(profile.reminders) ? profile.reminders : [];
      const reminder = reminders.find(item => item.id === notificationId);
      if (reminder && reminder.repeat !== 'daily') reminder.done = true;
    }
    return profile;
  });
  return acknowledged;
}
async function createAccount() {
  const userId = `u-${crypto.randomBytes(32).toString('hex')}`;
  const familyToken = crypto.randomBytes(32).toString('hex');
  const familyTokenHash = crypto.createHash('sha256').update(familyToken).digest('hex');
  await writeProfile(userId, { createdAt: new Date().toISOString(), familyTokenHash, name: '' });
  return { userId, familyToken };
}
async function verifyFamilyToken(userId, token) {
  if (typeof token !== 'string' || token.length < 32 || token.length > 256) return false;
  const expected = (await getProfile(userId)).familyTokenHash;
  if (typeof expected !== 'string' || !/^[a-f0-9]{64}$/i.test(expected)) return false;
  const actual = crypto.createHash('sha256').update(token).digest();
  const expectedBuffer = Buffer.from(expected, 'hex');
  return actual.length === expectedBuffer.length && crypto.timingSafeEqual(actual, expectedBuffer);
}
async function savePushSubscription(userId, subscription) {
  if (!subscription?.endpoint) throw new Error('Suscripción push inválida');
  await updateProfile(userId, profile => {
    profile.pushSubscriptions = Array.isArray(profile.pushSubscriptions) ? profile.pushSubscriptions : [];
    profile.pushSubscriptions = profile.pushSubscriptions.filter(item => item.endpoint !== subscription.endpoint);
    profile.pushSubscriptions.push(subscription); return profile;
  });
}
async function getPushSubscriptions(userId) {
  const subscriptions = (await getProfile(userId)).pushSubscriptions;
  return Array.isArray(subscriptions) ? subscriptions : [];
}
async function removePushSubscription(userId, endpoint) {
  return updateProfile(userId, profile => {
    profile.pushSubscriptions = (profile.pushSubscriptions || []).filter(item => item.endpoint !== endpoint);
    return profile;
  });
}
async function close() { if (pool) await pool.end(); }

module.exports = {
  init, close, getProfile, saveProfile, extractUserInfo, saveEmotion,
  saveReminder, getReminders, setReminders, saveMessage, getChat, getAllUserIds,
  savePushSubscription, getPushSubscriptions, removePushSubscription,
  normalizeEmotion, getValidHistory, enqueuePendingNotification, getPendingNotifications,
  acknowledgeNotification, createAccount, verifyFamilyToken, storageMode: () => usePostgres ? 'postgres' : 'json'
};
