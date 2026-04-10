# SeniorIA – Asistente conversacional para personas mayores

## 🎯 Objetivo
Ayudar a personas mayores con recordatorios, emergencias y compañía.

## 🛠️ Tecnologías
- Rasa (NLU + Core)
- Twilio (WhatsApp)
- Coqui TTS (voz natural)
- Web Speech API (reconocimiento de voz)

## 🚀 Cómo ejecutar
1. `cd SeniorIA`
2. `venv\Scripts\activate`
3. `rasa train`
4. `rasa run --model models --port 5005 --credentials credentials.yml`

## 🔐 Variables de entorno
Crea un archivo `.env` con:
- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`

## 📄 Autores
- [Tu nombre]