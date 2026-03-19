const cron = require('node-cron');
const notificacionesService = require('../services/notificaciones.service');

/**
 * Configuracion de tareas programadas (CRON)
 */

/**
 * Tarea: Generar notificaciones de cumpleaños
 * Ejecuta todos los dias a las 6:00 AM
 * Notifica cumpleaños con 3 dias de anticipacion
 */
const programarNotificacionesCumpleanos = () => {
  cron.schedule('0 6 * * *', async () => {
    try {
      console.log('[CRON] Ejecutando tarea: Generacion de notificaciones de cumpleaños');

      const resultado = await notificacionesService.generarNotificacionesCumpleanos();

      console.log('[CRON] Notificaciones de cumpleaños generadas:', resultado);
    } catch (error) {
      console.error('[CRON] Error al generar notificaciones de cumpleaños:', error);
    }
  }, {
    scheduled: true,
    timezone: 'America/Guayaquil',
  });

  console.log('[CRON] Tarea programada: Notificaciones de cumpleaños (diaria a las 6:00 AM)');
};

/**
 * Inicializar todas las tareas programadas
 */
const inicializarTareasProgramadas = () => {
  console.log('[CRON] Inicializando tareas programadas...');

  programarNotificacionesCumpleanos();

  console.log('[CRON] Tareas programadas inicializadas exitosamente');
};

module.exports = {
  inicializarTareasProgramadas,
};
