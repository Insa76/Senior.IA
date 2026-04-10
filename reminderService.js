function extractReminder(text) {
  text = text.toLowerCase();

  if (!text.includes("pastilla") && !text.includes("medicación") && !text.includes("tomo")) {
    return null;
  }

  // 🔥 detectar horarios
  const matches = text.match(/\d{1,2}/g);
  if (!matches) return null;

  // 🔥 intentar detectar medicamento
  let medicine = "tu medicación";

  const words = text.split(" ");

  const tomoIndex = words.indexOf("tomo");

  if (tomoIndex !== -1 && words[tomoIndex + 1]) {
    medicine = words[tomoIndex + 1];
  }

  return {
    times: matches.map(t => parseInt(t)),
    medicine,
    text
  };
}

module.exports = extractReminder;