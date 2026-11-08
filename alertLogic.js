const VALID = new Set(["feliz", "triste", "ansioso", "aburrido", "neutral"]);

function analyzeRisk(history = []) {
  const valid = (Array.isArray(history) ? history : [])
    .filter(item => item && VALID.has(String(item.emotion || "").toLowerCase()))
    .slice(-3)
    .map(item => String(item.emotion).toLowerCase());
  if (valid.length < 3) return "normal";
  if (valid.every(emotion => emotion === "triste")) return "alto";
  if (valid.filter(emotion => emotion === "ansioso").length >= 2) return "medio";
  return "normal";
}
module.exports = analyzeRisk;
