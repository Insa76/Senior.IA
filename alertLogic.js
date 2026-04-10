function analyzeRisk(history = []) {

  if (history.length < 3) return "normal";

  const last = history.slice(-3).map(h => h.emotion);

  // 🔴 alto riesgo
  if (last.every(e => e === "triste")) {
    return "alto";
  }

  // 🟡 atención
  if (last.filter(e => e === "ansioso").length >= 2) {
    return "medio";
  }

  return "normal";
}

module.exports = analyzeRisk;