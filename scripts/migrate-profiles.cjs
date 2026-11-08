require('dotenv').config();
const memory = require('../memory');

(async () => {
  try {
    if (!process.env.DATABASE_URL) {
      throw new Error('Falta DATABASE_URL en .env. No se modificó profiles.json.');
    }
    await memory.init();
    const count = (await memory.getAllUserIds()).length;
    console.log(`PostgreSQL está listo. Perfiles disponibles: ${count}.`);
    console.log('Si la tabla estaba vacía y profiles.json estaba presente, los perfiles fueron importados.');
  } catch (error) {
    console.error('No se pudo completar la migración:', error.message);
    process.exitCode = 1;
  } finally {
    await memory.close();
  }
})();
