const fs = require("fs");
const path = require("path");

const filePath = path.join(__dirname, "profiles.json");

function loadProfiles() {
  if (!fs.existsSync(filePath)) {
    fs.writeFileSync(filePath, JSON.stringify({}));
  }
  return JSON.parse(fs.readFileSync(filePath));
}

function saveProfiles(data) {
  fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
}

function getProfile(userId = "default") {
  const data = loadProfiles();
  return data[userId] || {};
}

function saveProfile(userId, profile) {
  const data = loadProfiles();
  data[userId] = profile;
  saveProfiles(data);
}

// =====================
// EXTRAER INFO INTELIGENTE
// =====================
function extractUserInfo(text, profile) {
  text = text.toLowerCase();

  if (!profile.likes) profile.likes = [];
  if (!profile.notes) profile.notes = [];

  if (text.includes("me gusta")) {
    const like = text.replace("me gusta", "").trim();
    if (like && !profile.likes.includes(like)) {
      profile.likes.push(like);
    }
  }

  if (text.includes("mi nombre es")) {
    profile.name = text.replace("mi nombre es", "").trim();
  }

  if (text.includes("vivo solo")) {
    profile.living = "solo";
  }

  if (text.includes("tengo")) {
    profile.notes.push(text);
  }

  return profile;
}

function saveEmotion(userId, emotion) {
  const data = loadProfiles();

  if (!data[userId]) data[userId] = {};

  // guardar estado actual
  data[userId].lastEmotion = emotion;
  data[userId].lastInteraction = new Date().toISOString();

  // 🔥 HISTORIAL
  if (!data[userId].history) {
    data[userId].history = [];
  }

  data[userId].history.push({
    emotion,
    time: new Date().toISOString()
  });

  // limitar historial
  data[userId].history = data[userId].history.slice(-20);

  saveProfiles(data);
}

function saveReminder(userId, reminder) {
  const data = loadProfiles();

  if (!data[userId]) data[userId] = {};
  if (!data[userId].reminders) data[userId].reminders = [];

  data[userId].reminders.push(reminder);

  saveProfiles(data);
}

function getReminders(userId) {
  const data = loadProfiles();
  return data[userId]?.reminders || [];
}

const chats = {};

function saveMessage(userId, role, text) {
  const data = loadProfiles();

  if (!data[userId]) data[userId] = {};
  if (!data[userId].chat) data[userId].chat = [];

  data[userId].chat.push({
    role,
    text,
    time: new Date().toISOString()
  });

  // limitar historial
  data[userId].chat = data[userId].chat.slice(-50);

  saveProfiles(data);
}

function getChat(userId) {
  const data = loadProfiles();
  return data[userId]?.chat || [];
}



module.exports = {
  getProfile,
  saveProfile,
  extractUserInfo,
  saveEmotion,
  saveReminder,
  getReminders,
  saveMessage,
  getChat
};