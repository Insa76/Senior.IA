# SeniorIA — NORA

Aplicación web de acompañamiento conversacional. El servidor Node.js sirve la interfaz de `public/` y expone la API de chat, perfil familiar, recordatorios y notificaciones.

## Requisitos

- Node.js 18 o superior
- Una API key de Groq
- Opcional: WhatsApp Cloud API para alertas y claves VAPID para notificaciones push

## Ejecutar localmente en Windows

1. Abrir PowerShell en la carpeta del proyecto.
2. Instalar dependencias:

   ```powershell
   npm install
   ```

3. Crear el archivo `.env` a partir de `.env.example` y completar las credenciales necesarias.
4. Iniciar:

   ```powershell
   npm start
   ```

5. Abrir `http://localhost:3000/login.html`.

Para detener el servidor: `Ctrl + C`.

## Variables de entorno

- `GROQ_API_KEY`: clave privada de Groq.
- `GROQ_MODEL`: modelo de Groq. Por defecto `openai/gpt-oss-20b`.
- `WHATSAPP_TOKEN`, `WHATSAPP_PHONE_NUMBER_ID`, `WHATSAPP_TO`: credenciales y destinatario de WhatsApp Cloud API.
- `WHATSAPP_API_VERSION`: versión de Graph API; por defecto `v26.0`.
- `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`, `VAPID_SUBJECT`: configuración de Web Push.
- `PORT`: Render define esta variable automáticamente; localmente el servidor usa 3000.

No subir `.env`, `profiles.json` ni credenciales al repositorio.

## Rutas principales

- `/health`: estado básico del servidor y configuración (sin revelar secretos).
- `/login.html`: ingreso y creación de identificador.
- `/?userId=...`: conversación de NORA.
- `/family.html?userId=...`: panel familiar.
- `/chat`, `/chat-history/:userId`, `/family/:userId`.
- `/reminders/:userId`, `/follow-up/:userId`.
- `/push/public-key`, `/subscribe/:userId`.

## Importante antes de usar con personas reales

- El identificador `userId` no es autenticación. Cualquier persona que conozca el identificador puede consultar el panel familiar. No usar datos reales sensibles hasta implementar autenticación y autorización.
- `profiles.json` sirve para pruebas locales, pero el disco de un servicio Render gratuito puede ser efímero. Para producción, migrar perfiles, mensajes, recordatorios y suscripciones a una base de datos persistente.
- Los recordatorios se procesan mientras el proceso Node está activo. Si Render suspende el servicio, la ejecución se pausa; no es un servicio crítico de recordatorios.
- Web Push requiere HTTPS (localhost también está permitido por el navegador), permiso del usuario y claves VAPID.
- La clasificación emocional es orientativa, no clínica.
- Las alertas por WhatsApp solo se consideran enviadas cuando Meta confirma la solicitud. Configurar y probar el destinatario antes de una demostración.
- La detección de emergencias por palabras clave no reemplaza una central de emergencias ni garantiza detectar todos los casos.

## Verificación

```powershell
npm run check
```

Esto valida sintaxis de los archivos principales del servidor. No prueba credenciales externas ni el envío real de WhatsApp, Groq o Push.

## Carpetas heredadas

La carpeta `app/`, `actions/` y `requirements.txt` pertenecen a una versión anterior basada en Rasa/Ollama y no son utilizadas por el servidor actual `server.cjs`. La aplicación que se inicia con `npm start` utiliza `public/`, Groq y los módulos JavaScript de la raíz.
