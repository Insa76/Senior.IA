function detectEmergency(text) {
  const normalized = String(text || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[¿¡.,!?]/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  const urgentPhrases = [
    "no puedo respirar",
    "me cuesta respirar",
    "me falta el aire",
    "me duele el pecho",
    "dolor fuerte en el pecho",
    "me cai",
    "me he caido",
    "no me puedo levantar",
    "no puedo levantarme",
    "me desmaye",
    "estoy sangrando mucho",
    "necesito ayuda",
    "auxilio",
    "emergencia",
    "es una emergencia"
  ];

  return normalized === "ayuda" ||
    urgentPhrases.some(phrase => normalized.includes(phrase));
}

module.exports = detectEmergency;
