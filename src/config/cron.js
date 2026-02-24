const cron = require('node-cron');
const notificacionesService = require('./services/notificaciones.service');

/**
 * Configuración de tareas programadas (CRON)
 */

/**
 * Tarea: Generar notificaciones de cumpleaños
 * Ejecuta todos los días a las 6:00 AM
 * Notifica cumpleaños con 3 días de anticipación
 */
const programarNotificacionesCumpleanos = () => {
  // Sintaxis: segundo minuto hora día mes día_semana
  // '0 6 * * *' = Todos los días a las 6:00 AM
  cron.schedule('0 6 * * *', async () => {
    try {
      console.log('[CRON] Ejecutando tarea: Generación de notificaciones de cumpleaños');
      
      const resultado = await notificacionesService.generarNotificacionesCumpleanos();
      
      console.log('[CRON] Notificaciones de cumpleaños generadas:', resultado);
    } catch (error) {
      console.error('[CRON] Error al generar notificaciones de cumpleaños:', error);
    }
  }, {
    scheduled: true,
    timezone: "America/Guayaquil" 
  });
  
  console.log('✅ Tarea programada: Notificaciones de cumpleaños (diaria a las 6:00 AM)');
};

/**
 * Inicializar todas las tareas programadas
 */
const inicializarTareasProgramadas = () => {
  console.log('📅 Inicializando tareas programadas...');
  
  programarNotificacionesCumpleanos();
  
  console.log('✅ Tareas programadas inicializadas exitosamente');
};

module.exports = {
  inicializarTareasProgramadas
};
