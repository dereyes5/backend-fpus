const pool = require('../config/database');

/**
 * Servicio para gestión de notificaciones
 */

// ==========================================
// 1. CRUD DE NOTIFICACIONES
// ==========================================

/**
 * Crear notificación
 */
async function crearNotificacion(idUsuario, tipo, titulo, mensaje, link = null) {
  const query = `
    SELECT crear_notificacion($1, $2, $3, $4, $5) AS id_notificacion
  `;
  
  const result = await pool.query(query, [idUsuario, tipo, titulo, mensaje, link]);
  
  // Obtener la notificación completa
  const queryNotificacion = `
    SELECT * FROM notificaciones WHERE id_notificacion = $1
  `;
  
  const resultNotificacion = await pool.query(queryNotificacion, [result.rows[0].id_notificacion]);
  
  return resultNotificacion.rows[0];
}

/**
 * Obtener notificaciones de un usuario
 */
async function obtenerNotificaciones(idUsuario, soloNoLeidas = false) {
  let query = `
    SELECT 
      id_notificacion,
      tipo,
      titulo,
      mensaje,
      link,
      leida,
      fecha_creacion,
      fecha_lectura
    FROM notificaciones
    WHERE id_usuario = $1
  `;
  
  if (soloNoLeidas) {
    query += ` AND leida = FALSE`;
  }
  
  query += ` ORDER BY fecha_creacion DESC LIMIT 50`;
  
  const result = await pool.query(query, [idUsuario]);
  return result.rows;
}

/**
 * Contar notificaciones no leídas
 */
async function contarNoLeidas(idUsuario) {
  const query = `
    SELECT COUNT(*) AS total
    FROM notificaciones
    WHERE id_usuario = $1 AND leida = FALSE
  `;
  
  const result = await pool.query(query, [idUsuario]);
  return parseInt(result.rows[0].total);
}

/**
 * Marcar notificación como leída
 */
async function marcarComoLeida(idNotificacion, idUsuario) {
  const query = `
    UPDATE notificaciones
    SET leida = TRUE, fecha_lectura = NOW()
    WHERE id_notificacion = $1 AND id_usuario = $2
    RETURNING *
  `;
  
  const result = await pool.query(query, [idNotificacion, idUsuario]);
  
  if (result.rows.length === 0) {
    throw new Error('Notificación no encontrada');
  }
  
  return result.rows[0];
}

/**
 * Marcar todas las notificaciones como leídas
 */
async function marcarTodasComoLeidas(idUsuario) {
  const query = `
    UPDATE notificaciones
    SET leida = TRUE, fecha_lectura = NOW()
    WHERE id_usuario = $1 AND leida = FALSE
    RETURNING COUNT(*) AS total
  `;
  
  const result = await pool.query(query, [idUsuario]);
  
  return {
    mensaje: 'Todas las notificaciones han sido marcadas como leídas',
    total_actualizadas: result.rowCount
  };
}

/**
 * Eliminar notificación
 */
async function eliminarNotificacion(idNotificacion, idUsuario) {
  const query = `
    DELETE FROM notificaciones
    WHERE id_notificacion = $1 AND id_usuario = $2
    RETURNING *
  `;
  
  const result = await pool.query(query, [idNotificacion, idUsuario]);
  
  if (result.rows.length === 0) {
    throw new Error('Notificación no encontrada');
  }
  
  return result.rows[0];
}

// ==========================================
// 2. NOTIFICACIONES AUTOMÁTICAS
// ==========================================

/**
 * Generar notificaciones de cumpleaños
 * Debe ejecutarse diariamente vía CRON
 */
async function generarNotificacionesCumpleanos() {
  const query = `
    SELECT * FROM generar_notificaciones_cumpleanos()
  `;
  
  const result = await pool.query(query);
  return result.rows[0];
}

/**
 * Crear notificación de aprobación de benefactor
 */
async function notificarAprobacionBenefactor(idBenefactor, aprobado, idAdmin) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Obtener datos del benefactor y usuario que lo cargó
    const queryBenefactor = `
      SELECT 
        b.nombre_completo,
        b.id_usuario,
        u.nombre_usuario
      FROM benefactores b
      JOIN usuarios u ON u.id_usuario = b.id_usuario
      WHERE b.id_benefactor = $1
    `;
    
    const resultBenefactor = await client.query(queryBenefactor, [idBenefactor]);
    
    if (resultBenefactor.rows.length === 0) {
      throw new Error('Benefactor no encontrado');
    }
    
    const benefactor = resultBenefactor.rows[0];
    
    const tipo = 'APROBACION_BENEFACTOR';
    const titulo = aprobado 
      ? '✅ Benefactor aprobado' 
      : '❌ Benefactor rechazado';
    const mensaje = aprobado
      ? `El benefactor ${benefactor.nombre_completo} ha sido aprobado exitosamente.`
      : `El benefactor ${benefactor.nombre_completo} ha sido rechazado.`;
    const link = `/benefactores/${idBenefactor}`;
    
    const queryNotificacion = `
      SELECT crear_notificacion($1, $2, $3, $4, $5) AS id_notificacion
    `;
    
    await client.query(queryNotificacion, [
      benefactor.id_usuario,
      tipo,
      titulo,
      mensaje,
      link
    ]);
    
    await client.query('COMMIT');
    
    return {
      mensaje: 'Notificación de aprobación creada',
      usuario_notificado: benefactor.nombre_usuario
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Crear notificación personalizada para usuario
 */
async function notificarUsuario(idUsuario, titulo, mensaje, tipo = 'SISTEMA', link = null) {
  return await crearNotificacion(idUsuario, tipo, titulo, mensaje, link);
}

/**
 * Notificación broadcast a todos los usuarios con un permiso específico
 */
async function notificarPorPermiso(recurso, permiso, titulo, mensaje, link = null) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Obtener usuarios con el permiso especificado
    const queryUsuarios = `
      SELECT DISTINCT u.id_usuario, u.nombre_usuario
      FROM usuarios u
      JOIN permisos_usuarios pu ON pu.id_usuario = u.id_usuario
      WHERE pu.recurso = $1 
        AND pu.permiso = $2
        AND u.activo = TRUE
    `;
    
    const resultUsuarios = await pool.query(queryUsuarios, [recurso, permiso]);
    
    const notificacionesCreadas = [];
    
    for (const usuario of resultUsuarios.rows) {
      const queryNotificacion = `
        SELECT crear_notificacion($1, 'SISTEMA', $2, $3, $4) AS id_notificacion
      `;
      
      const result = await client.query(queryNotificacion, [
        usuario.id_usuario,
        titulo,
        mensaje,
        link
      ]);
      
      notificacionesCreadas.push({
        usuario: usuario.nombre_usuario,
        id_notificacion: result.rows[0].id_notificacion
      });
    }
    
    await client.query('COMMIT');
    
    return {
      mensaje: 'Notificaciones broadcast enviadas',
      total: notificacionesCreadas.length,
      usuarios: notificacionesCreadas
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ==========================================
// 3. ESTADÍSTICAS DE NOTIFICACIONES
// ==========================================

/**
 * Obtener estadísticas de notificaciones
 */
async function obtenerEstadisticas(idUsuario) {
  const query = `
    SELECT
      COUNT(*) AS total,
      COUNT(*) FILTER (WHERE leida = FALSE) AS no_leidas,
      COUNT(*) FILTER (WHERE leida = TRUE) AS leidas,
      COUNT(*) FILTER (WHERE tipo = 'APROBACION_BENEFACTOR') AS aprobaciones_benefactor,
      COUNT(*) FILTER (WHERE tipo = 'APROBACION_SOCIAL') AS aprobaciones_social,
      COUNT(*) FILTER (WHERE tipo = 'CUMPLEAÑOS') AS cumpleanos,
      COUNT(*) FILTER (WHERE tipo = 'SISTEMA') AS sistema
    FROM notificaciones
    WHERE id_usuario = $1
  `;
  
  const result = await pool.query(query, [idUsuario]);
  return result.rows[0];
}

/**
 * Notificar a usuarios con permisos de aprobación sobre casos pendientes
 */
async function notificarCasosPendientes(tipoCaso = 'benefactores') {
  const client = await pool.connect();
  
  try {
    console.log('[Notificaciones] Verificando casos pendientes:', tipoCaso);
    
    let tabla, permisoRequerido, nombreCaso, linkBase;
    
    if (tipoCaso === 'benefactores') {
      tabla = 'benefactores';
      permisoRequerido = 'aprobaciones';
      nombreCaso = 'benefactores';
      linkBase = '/aprobaciones/benefactores';
    } else if (tipoCaso === 'social') {
      tabla = 'beneficiarios_sociales';
      permisoRequerido = 'aprobaciones_social';
      nombreCaso = 'casos sociales';
      linkBase = '/aprobaciones/social';
    } else {
      throw new Error('Tipo de caso no válido');
    }
    
    // Contar casos pendientes
    const queryCasos = `
      SELECT COUNT(*) AS total
      FROM ${tabla}
      WHERE estado_registro = 'PENDIENTE'
    `;
    
    const resultCasos = await client.query(queryCasos);
    const totalPendientes = parseInt(resultCasos.rows[0].total);
    
    console.log('[Notificaciones] Casos pendientes encontrados:', totalPendientes);
    
    if (totalPendientes === 0) {
      return { mensaje: 'No hay casos pendientes', usuarios_notificados: 0 };
    }
    
    // Obtener usuarios con el permiso de aprobación
    const queryUsuarios = `
      SELECT DISTINCT u.id_usuario
      FROM usuarios u
      JOIN roles_usuarios ru ON ru.id_usuario = u.id_usuario
      JOIN roles r ON r.id_rol = ru.id_rol
    `;
    
    const resultUsuarios = await client.query(queryUsuarios);
    
    console.log('[Notificaciones] Usuarios con permisos:', resultUsuarios.rows.length);
    
    // Crear notificaciones para cada usuario con permisos
    const titulo = `📋 Tienes ${totalPendientes} ${nombreCaso} pendientes de aprobación`;
    const mensaje = `Hay ${totalPendientes} ${nombreCaso} esperando tu revisión.`;
    
    let notificacionesCreadas = 0;
    
    for (const usuario of resultUsuarios.rows) {
      // Verificar que el usuario tenga el permiso específico
      await client.query(
        `SELECT crear_notificacion($1, 'SISTEMA', $2, $3, $4)`,
        [usuario.id_usuario, titulo, mensaje, linkBase]
      );
      notificacionesCreadas++;
    }
    
    console.log('[Notificaciones] Notificaciones creadas:', notificacionesCreadas);
    
    return {
      mensaje: 'Notificaciones enviadas',
      usuarios_notificados: notificacionesCreadas,
      total_pendientes: totalPendientes
    };
  } catch (error) {
    console.error('[Notificaciones] Error al notificar casos pendientes:', error);
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  crearNotificacion,
  obtenerNotificaciones,
  contarNoLeidas,
  marcarComoLeida,
  marcarTodasComoLeidas,
  eliminarNotificacion,
  generarNotificacionesCumpleanos,
  notificarAprobacionBenefactor,
  notificarUsuario,
  notificarPorPermiso,
  obtenerEstadisticas,
  notificarCasosPendientes
};
