from rasa_sdk import Action
from rasa_sdk.executor import CollectingDispatcher
from rasa_sdk.interfaces import Tracker
from rasa_sdk.events import SlotSet
import requests

OLLAMA_URL = "http://localhost:11434/api/generate"
MODEL_NAME = "llama3"

BASE_PROMPT = """
Sos un asistente diseñado para acompañar a personas mayores.

Tu forma de hablar es:
- simple
- clara
- cálida
- respetuosa
- paciente

Reglas:
- Nunca uses lenguaje técnico
- Nunca seas infantil o condescendiente
- Hablá como un adulto hablando con otro adulto
- Respondé de forma natural y cercana
- Podés hacer preguntas para continuar la conversación
- Si la persona expresa tristeza o soledad, respondé con empatía
- No des respuestas largas
- Nunca digas que sos una IA

Tu objetivo:
- acompañar
- ayudar
- conversar
- generar confianza
"""

# =========================
# DETECCIÓN DE EMOCIONES
# =========================

def detect_emotion(text):
    text = text.lower()

    if any(word in text for word in ["solo", "triste", "mal", "deprimido"]):
        return "triste"
    if any(word in text for word in ["aburrido", "nada que hacer"]):
        return "aburrido"
    if any(word in text for word in ["miedo", "asustado"]):
        return "ansiedad"
    
    return "neutral"


def emotion_instruction(emotion):
    if emotion == "triste":
        return "El usuario está triste. Respondé con mucha empatía y contención."
    if emotion == "aburrido":
        return "El usuario está aburrido. Intentá proponer conversación o algo para hacer."
    if emotion == "ansiedad":
        return "El usuario está ansioso. Respondé con calma y tranquilidad."
    
    return ""


class ActionChatWithAI(Action):

    def name(self):
        return "action_chat_with_ai"

    def run(self, dispatcher: CollectingDispatcher,
            tracker: Tracker,
            domain: dict):

        user_message = tracker.latest_message.get('text')

        # Detectar emoción
        emotion = detect_emotion(user_message)
        emotion_context = emotion_instruction(emotion)

        # Historial
        history = tracker.get_slot("conversation_history") or ""
        history = history[-1000:]

        prompt = f"""{BASE_PROMPT}

Contexto emocional:
{emotion_context}

Conversación previa:
{history}

Usuario: {user_message}
Asistente:
"""

        try:
            response = requests.post(
                OLLAMA_URL,
                json={
                    "model": MODEL_NAME,
                    "prompt": prompt,
                    "stream": False
                }
            )

            if response.status_code == 200:
                ai_response = response.json().get("response", "No pude responder ahora mismo.")
            else:
                ai_response = "Perdón… algo no salió bien. ¿Querés intentar de nuevo?"

        except Exception as e:
            print("Error llamando a Ollama:", e)
            ai_response = "Perdón… no estoy pudiendo responder ahora. Intentemos de nuevo en un momento."

        new_history = f"{history}\nUsuario: {user_message}\nAsistente: {ai_response}"

        dispatcher.utter_message(text=ai_response)

        return [SlotSet("conversation_history", new_history)]