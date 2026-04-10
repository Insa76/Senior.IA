function detectEmergency(text) {
  text = text.toLowerCase();

  const keywords = [
    "no puedo respirar",
    "me duele el pecho",
    "me caí",
    "no me puedo levantar",
    "ayuda",
    "emergencia"
  ];

  return keywords.some(k => text.includes(k));
}

module.exports = detectEmergency;