const notificacionesService = require('../services/notificaciones.service');
const { validationResult } = require('express-validator');

// ==========================================
// 1. NOTIFICACIONES DEL USUARIO
// ==========================================

/**
 * Obtener notificaciones del usuario autenticado
 * GET /api/notificaciones
 */
async function obtenerNotificaciones(req, res) {
  try {
    const idUsuario = req.usuario.id_usuario;
    const soloNoLeidas = req.query.no_leidas === 'true';
    
    console.log('[Notificaciones] Obteniendo notificaciones:', { 
      idUsuario, 
      soloNoLeidas 
    });
    
    const notificaciones = await notificacionesService.obtenerNotificaciones(
      idUsuario,
      soloNoLeidas
    );
    
    console.log('[Notificaciones] Notificaciones encontradas:', notificaciones.length);
    
    res.json({
      total: notificaciones.length,
      notificaciones
    });
  } catch (error) {
    console.error('[Notificaciones] Error al obtener notificaciones:', error);
    res.status(500).json({ 
      error: 'Error al obtener notificaciones',
      detalle: error.message 
    });
  }
}

/**
 * Contar notificaciones no leídas
 * GET /api/notificaciones/no-leidas
 */
async function contarNoLeidas(req, res) {
  try {
    const idUsuario = req.usuario.id_usuario;
    const total = await notificacionesService.contarNoLeidas(idUsuario);
    
    res.json({ total });
  } catch (error) {
    console.error('Error al contar notificaciones:', error);
    res.status(500).json({ 
      error: 'Error al contar notificaciones',
      detalle: error.message 
    });
  }
}

/**
 * Marcar notificación como leída
 * PUT /api/notificaciones/:id/leer
 */
async function marcarComoLeida(req, res) {
  try {
    const { id } = req.params;
    const idUsuario = req.usuario.id_usuario;
    
    const notificacion = await notificacionesService.marcarComoLeida(id, idUsuario);
    
    res.json({
      mensaje: 'Notificación marcada como leída',
      notificacion
    });
  } catch (error) {
    console.error('Error al marcar notificación:', error);
    
    if (error.message === 'Notificación no encontrada') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Error al marcar notificación',
      detalle: error.message 
    });
  }
}

/**
 * Marcar todas las notificaciones como leídas
 * PUT /api/notificaciones/leer-todas
 */
async function marcarTodasComoLeidas(req, res) {
  try {
    const idUsuario = req.usuario.id_usuario;
    const resultado = await notificacionesService.marcarTodasComoLeidas(idUsuario);
    
    res.json(resultado);
  } catch (error) {
    console.error('Error al marcar todas las notificaciones:', error);
    res.status(500).json({ 
      error: 'Error al marcar todas las notificaciones',
      detalle: error.message 
    });
  }
}

/**
 * Eliminar notificación
 * DELETE /api/notificaciones/:id
 */
async function eliminarNotificacion(req, res) {
  try {
    const { id } = req.params;
    const idUsuario = req.usuario.id_usuario;
    
    await notificacionesService.eliminarNotificacion(id, idUsuario);
    
    res.json({
      mensaje: 'Notificación eliminada exitosamente'
    });
  } catch (error) {
    console.error('Error al eliminar notificación:', error);
    
    if (error.message === 'Notificación no encontrada') {
      return res.status(404).json({ error: error.message });
    }
    
    res.status(500).json({ 
      error: 'Error al eliminar notificación',
      detalle: error.message 
    });
  }
}

// ==========================================
// 2. NOTIFICACIONES AUTOMÁTICAS (ADMIN)
// ==========================================

/**
 * Generar notificaciones de cumpleaños (manualmente)
 * POST /api/notificaciones/cumpleanos/generar
 * Solo para admins - normalmente se ejecuta vía CRON
 */
async function generarCumpleanos(req, res) {
  try {
    const resultado = await notificacionesService.generarNotificacionesCumpleanos();
    
    res.json({
      mensaje: 'Notificaciones de cumpleaños generadas',
      resultado
    });
  } catch (error) {
    console.error('Error al generar notificaciones de cumpleaños:', error);
    res.status(500).json({ 
      error: 'Error al generar notificaciones de cumpleaños',
      detalle: error.message 
    });
  }
}

/**
 * Enviar notificación personalizada a un usuario
 * POST /api/notificaciones/enviar
 * Solo para admins
 */
async function enviarNotificacion(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errores: errors.array() });
    }
    
    const { id_usuario, titulo, mensaje, tipo, link } = req.body;
    
    const notificacion = await notificacionesService.notificarUsuario(
      id_usuario,
      titulo,
      mensaje,
      tipo || 'SISTEMA',
      link
    );
    
    res.status(201).json({
      mensaje: 'Notificación enviada',
      notificacion
    });
  } catch (error) {
    console.error('Error al enviar notificación:', error);
    res.status(500).json({ 
      error: 'Error al enviar notificación',
      detalle: error.message 
    });
  }
}

/**
 * Enviar notificación broadcast por permiso
 * POST /api/notificaciones/broadcast
 * Solo para admins
 */
async function enviarBroadcast(req, res) {
  try {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ errores: errors.array() });
    }
    
    const { recurso, permiso, titulo, mensaje, link } = req.body;
    
    const resultado = await notificacionesService.notificarPorPermiso(
      recurso,
      permiso,
      titulo,
      mensaje,
      link
    );
    
    res.json(resultado);
  } catch (error) {
    console.error('Error al enviar broadcast:', error);
    res.status(500).json({ 
      error: 'Error al enviar broadcast',
      detalle: error.message 
    });
  }
}

// ==========================================
// 3. ESTADÍSTICAS
// ==========================================

/**
 * Obtener estadísticas de notificaciones del usuario
 * GET /api/notificaciones/estadisticas
 */
async function obtenerEstadisticas(req, res) {
  try {
    const idUsuario = req.usuario.id_usuario;
    const estadisticas = await notificacionesService.obtenerEstadisticas(idUsuario);
    
    res.json(estadisticas);
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({ 
      error: 'Error al obtener estadísticas',
      detalle: error.message 
    });
  }
}

module.exports = {
  obtenerNotificaciones,
  contarNoLeidas,
  marcarComoLeida,
  marcarTodasComoLeidas,
  eliminarNotificacion,
  generarCumpleanos,
  enviarNotificacion,
  enviarBroadcast,
  obtenerEstadisticas
};
