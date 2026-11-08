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
- `DATABASE_URL`: cadena de conexión PostgreSQL. Si está definida, SeniorIA utiliza PostgreSQL; si está vacía, usa `profiles.json` local.
- `DATABASE_SSL`: mantener `true` para proveedores PostgreSQL administrados; por defecto se habilita SSL.
- `PG_POOL_MAX`: máximo de conexiones del pool; por defecto 5.
- `SENIORIA_DATA_DIR`: carpeta local de `profiles.json`; por defecto es la raíz del proyecto.

No subir `.env`, `profiles.json` ni credenciales al repositorio.

## Rutas principales

- `/health`: estado básico del servidor y configuración (sin revelar secretos).
- `/login.html`: ingreso y creación de identificador.
- `/?userId=...`: conversación de NORA.
- `/family.html?userId=...#token=...`: panel familiar con token independiente.
- `POST /accounts`: crea un identificador aleatorio y un token familiar.
- `/chat`, `/chat-history/:userId`, `/family/:userId` (este último requiere `Authorization: Bearer <token>`).
- `/reminders/:userId`, `/follow-up/:userId`.
- `/push/public-key`, `/subscribe/:userId`.

## Importante antes de usar con personas reales

- En modo local, los datos se guardan en `profiles.json` dentro de `SENIORIA_DATA_DIR`. En producción se recomienda PostgreSQL mediante `DATABASE_URL`. La aplicación crea la tabla `senioria_profiles` al iniciar e importa automáticamente `profiles.json` una sola vez cuando la tabla está vacía y el archivo está presente. La migración no borra ni modifica el archivo original.
- Para migrar los datos locales a PostgreSQL: conservar `profiles.json`, colocar la cadena PostgreSQL en `.env` como `DATABASE_URL`, ejecutar `npm install` y luego `npm run migrate:profiles`. El comando informa cuántos perfiles quedaron disponibles. Después se configura esa misma `DATABASE_URL` como variable de entorno en Render. No compartir la cadena de conexión ni subir `.env` a GitHub.
- Neon ofrece un plan gratuito de PostgreSQL con límites de cómputo, almacenamiento y transferencia; el cómputo se suspende tras inactividad, pero los datos permanecen almacenados. Revisar los límites vigentes antes de adoptarlo. El servicio puede tardar unos instantes en reactivarse al recibir una conexión.
- Los recordatorios vencidos quedan en una cola persistida hasta que el navegador confirma que pudo presentarlos. Esto evita perderlos al reiniciar el proceso, pero no garantiza puntualidad: el proceso debe estar activo para detectarlos. En planes que suspenden el servicio, la revisión se pausa. No es un servicio crítico de medicación ni reemplaza alarmas médicas.
- Los seguimientos emocionales automáticos usan temporizadores en memoria y se pierden si el servidor se reinicia antes de ejecutarlos.
- WhatsApp utiliza un único destinatario global (`WHATSAPP_TO`) para todos los usuarios. No hay todavía contactos familiares configurables por cuenta; no desplegar con múltiples familias hasta resolver esa separación.
- Las cuentas nuevas se crean en el servidor con un identificador aleatorio y un token familiar independiente. El token se almacena como hash y el panel lo valida en cada consulta. El enlace familiar es una credencial: compartilo solo con la persona autorizada. Las cuentas antiguas no tienen ese token y no pueden abrir el panel protegido; no se habilita un bypass automático.
- El acceso de la persona mayor a la conversación sigue dependiendo de mantener privado su identificador aleatorio. Todavía no hay cuentas con contraseña, recuperación de acceso, revocación/rotación de enlaces familiares ni roles múltiples. No considerar esto equivalente a un sistema de identidad empresarial.
- El historial emocional se normaliza a cinco categorías permitidas; el análisis de riesgo es heurístico y no clínico. No interpretar los estados como evaluación médica ni como garantía de que no existe riesgo.
- Web Push requiere HTTPS (localhost también está permitido por el navegador), permiso del usuario y claves VAPID.
- Las alertas por WhatsApp solo se consideran enviadas cuando Meta confirma la solicitud. Configurar y probar el destinatario antes de una demostración.
- La detección de emergencias por palabras clave no reemplaza una central de emergencias ni garantiza detectar todos los casos.

## Verificación

```powershell
npm run check
```

`npm run check` valida la sintaxis de los módulos JavaScript principales. `npm test` ejecuta pruebas automatizadas de persistencia de emociones y ciclo de entrega de recordatorios. Ninguna de estas pruebas valida credenciales externas ni el envío real de WhatsApp, Groq o Push.

## Carpetas heredadas

La carpeta `app/`, `actions/` y `requirements.txt` pertenecen a una versión anterior basada en Rasa/Ollama y no son utilizadas por el servidor actual `server.cjs`. La aplicación que se inicia con `npm start` utiliza `public/`, Groq y los módulos JavaScript de la raíz.
