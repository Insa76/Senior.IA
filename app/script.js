function appendMessage(text, sender) {
  const msg = document.createElement("div");
  msg.classList.add("message", sender);
  msg.textContent = text;
  document.getElementById("chatBox").appendChild(msg);
  document.getElementById("chatBox").scrollTop = 999999;
}

async function sendMessage(message) {
  appendMessage(message, "user");
  try {
    const res = await fetch("http://localhost:5005/webhooks/rest/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ sender: "usuario123", message })
    });
    const replies = await res.json();
    replies.forEach(r => {
      if (r.text) {
        appendMessage(r.text, "bot");
        speakMessage(r.text);
      }
    });
  } catch (e) {
    appendMessage("No pude conectarme al bot.", "bot");
  }
  document.getElementById("messageInput").value = "";
}

async function speakMessage(text) {
  try {
    // Fallback: usa la voz del navegador
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.lang = 'es-ES';
      utterance.rate = 0.9;
      speechSynthesis.speak(utterance);
    }
  } catch (error) {
    console.error("Error con la voz:", error);
  }
}

document.getElementById("chatForm").addEventListener("submit", e => {
  e.preventDefault();
  const input = document.getElementById("messageInput");
  if (input.value.trim()) sendMessage(input.value);
});

// Botón de voz
document.getElementById("voiceBtn").onclick = () => {
  const recognition = new (window.SpeechRecognition || window.webkitSpeechRecognition)();
  recognition.lang = 'es-ES';
  recognition.start();

  recognition.onresult = (e) => {
    const transcript = e.results[0][0].transcript;
    sendMessage(transcript);
  };

  recognition.onerror = (e) => {
    console.error("Error de voz:", e);
    alert("No pude escucharte. Intenta de nuevo.");
  };
};