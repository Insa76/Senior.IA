const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "profiles.json");

function loadProfiles() {
  try {
    if (!fs.existsSync(filePath)) return {};
    const raw = fs.readFileSync(filePath, "utf8");
    if (!raw.trim()) return {};
    const data = JSON.parse(raw);
    return data && typeof data === "object" && !Array.isArray(data) ? data : {};
  } catch (error) {
    console.error("No se pudo leer profiles.json:", error.message);
    return {};
  }
}

function saveProfiles(data) {
  const tempPath = `${filePath}.tmp`;
  fs.writeFileSync(tempPath, JSON.stringify(data, null, 2), "utf8");
  fs.renameSync(tempPath, filePath);
}

function getProfile(userId = "default") {
  const data = loadProfiles();
  return data[userId] || {};
}

function saveProfile(userId, profile) {
  const data = loadProfiles();
  data[userId] = { ...(data[userId] || {}), ...(profile || {}) };
  saveProfiles(data);
  return data[userId];
}

function extractUserInfo(text, profile = {}) {
  const normalized = String(text || "").trim();
  const lower = normalized.toLowerCase();

  profile.likes = Array.isArray(profile.likes) ? profile.likes : [];
  profile.notes = Array.isArray(profile.notes) ? profile.notes : [];

  const nameMatch = normalized.match(/\bmi nombre es\s+([^,.!?]+)/i);
  if (nameMatch) profile.name = nameMatch[1].trim();

  const likeMatch = normalized.match(/\bme gusta[n]?\s+([^,.!?]+)/i);
  if (likeMatch) {
    const like = likeMatch[1].trim();
    if (like && !profile.likes.some(item => item.toLowerCase() === like.toLowerCase())) {
      profile.likes.push(like);
    }
  }

  if (lower.includes("vivo solo") || lower.includes("vivo sola")) {
    profile.living = "solo";
  } else if (lower.includes("vivo con")) {
    profile.living = "acompañado";
  }

  if (/\btengo\b/i.test(lower) && profile.notes[profile.notes.length - 1] !== normalized) {
    profile.notes.push(normalized);
    profile.notes = profile.notes.slice(-30);
  }

  return profile;
}

function saveEmotion(userId, emotion) {
  const data = loadProfiles();
  if (!data[userId]) data[userId] = {};
  const timestamp = new Date().toISOString();

  data[userId].lastEmotion = emotion;
  data[userId].lastInteraction = timestamp;
  data[userId].history = Array.isArray(data[userId].history) ? data[userId].history : [];
  data[userId].history.push({ emotion, time: timestamp });
  data[userId].history = data[userId].history.slice(-50);

  saveProfiles(data);
}

function saveMessage(userId, role, text) {
  const data = loadProfiles();
  if (!data[userId]) data[userId] = {};
  data[userId].chat = Array.isArray(data[userId].chat) ? data[userId].chat : [];
  const timestamp = new Date().toISOString();
  data[userId].lastInteraction = timestamp;
  data[userId].chat.push({
    role,
    text: String(text),
    time: timestamp
  });
  data[userId].chat = data[userId].chat.slice(-100);
  saveProfiles(data);
}

function getChat(userId) {
  const chat = getProfile(userId).chat;
  return Array.isArray(chat) ? chat : [];
}

function saveReminder(userId, reminder) {
  const data = loadProfiles();
  if (!data[userId]) data[userId] = {};
  data[userId].reminders = Array.isArray(data[userId].reminders) ? data[userId].reminders : [];
  data[userId].reminders.push(reminder);
  saveProfiles(data);
}

function getReminders(userId) {
  const reminders = getProfile(userId).reminders;
  return Array.isArray(reminders) ? reminders : [];
}

function setReminders(userId, reminders) {
  const data = loadProfiles();
  if (!data[userId]) data[userId] = {};
  data[userId].reminders = reminders;
  saveProfiles(data);
}

function getAllUserIds() {
  return Object.keys(loadProfiles());
}

function savePushSubscription(userId, subscription) {
  const data = loadProfiles();
  if (!data[userId]) data[userId] = {};
  data[userId].pushSubscriptions = Array.isArray(data[userId].pushSubscriptions)
    ? data[userId].pushSubscriptions
    : [];
  const endpoint = subscription && subscription.endpoint;
  if (!endpoint) throw new Error("Suscripción push inválida");
  data[userId].pushSubscriptions = data[userId].pushSubscriptions.filter(item => item.endpoint !== endpoint);
  data[userId].pushSubscriptions.push(subscription);
  saveProfiles(data);
}

function getPushSubscriptions(userId) {
  const subscriptions = getProfile(userId).pushSubscriptions;
  return Array.isArray(subscriptions) ? subscriptions : [];
}

function removePushSubscription(userId, endpoint) {
  const data = loadProfiles();
  if (!data[userId]) return;
  data[userId].pushSubscriptions = (data[userId].pushSubscriptions || [])
    .filter(item => item.endpoint !== endpoint);
  saveProfiles(data);
}

module.exports = {
  getProfile,
  saveProfile,
  extractUserInfo,
  saveEmotion,
  saveReminder,
  getReminders,
  setReminders,
  saveMessage,
  getChat,
  getAllUserIds,
  savePushSubscription,
  getPushSubscriptions,
  removePushSubscription
};
