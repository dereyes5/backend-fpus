const pool = require('../config/database');

/**
 * Servicio para gestion de notificaciones
 */

// ==========================================
// 1. CRUD DE NOTIFICACIONES
// ==========================================

/**
 * Crear notificacion
 */
async function crearNotificacion(idUsuario, tipo, titulo, mensaje, link = null) {
  const query = `
    SELECT crear_notificacion($1, $2, $3, $4, $5) AS id_notificacion
  `;

  const result = await pool.query(query, [idUsuario, tipo, titulo, mensaje, link]);

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
    query += ' AND leida = FALSE';
  }

  query += ' ORDER BY fecha_creacion DESC LIMIT 50';

  const result = await pool.query(query, [idUsuario]);
  return result.rows;
}

/**
 * Contar notificaciones no leidas
 */
async function contarNoLeidas(idUsuario) {
  const query = `
    SELECT COUNT(*) AS total
    FROM notificaciones
    WHERE id_usuario = $1 AND leida = FALSE
  `;

  const result = await pool.query(query, [idUsuario]);
  return parseInt(result.rows[0].total, 10);
}

/**
 * Marcar notificacion como leida
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
    throw new Error('Notificacion no encontrada');
  }

  return result.rows[0];
}

/**
 * Marcar todas las notificaciones como leidas
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
    mensaje: 'Todas las notificaciones han sido marcadas como leidas',
    total_actualizadas: result.rowCount,
  };
}

/**
 * Eliminar notificacion
 */
async function eliminarNotificacion(idNotificacion, idUsuario) {
  const query = `
    DELETE FROM notificaciones
    WHERE id_notificacion = $1 AND id_usuario = $2
    RETURNING *
  `;

  const result = await pool.query(query, [idNotificacion, idUsuario]);

  if (result.rows.length === 0) {
    throw new Error('Notificacion no encontrada');
  }

  return result.rows[0];
}

// ==========================================
// 2. NOTIFICACIONES AUTOMATICAS
// ==========================================

/**
 * Generar notificaciones de cumpleaños
 * Debe ejecutarse diariamente via CRON
 */
async function generarNotificacionesCumpleanos() {
  const query = `
    SELECT * FROM generar_notificaciones_cumpleanos()
  `;

  const result = await pool.query(query);
  return result.rows[0];
}

/**
 * Crear notificacion de aprobacion de benefactor
 */
async function notificarAprobacionBenefactor(idBenefactor, aprobado, idAdmin) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

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
    const titulo = aprobado ? 'Benefactor aprobado' : 'Benefactor rechazado';
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
      link,
    ]);

    await client.query('COMMIT');

    return {
      mensaje: 'Notificacion de aprobacion creada',
      usuario_notificado: benefactor.nombre_usuario,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Crear notificacion personalizada para usuario
 */
async function notificarUsuario(idUsuario, titulo, mensaje, tipo = 'SISTEMA', link = null) {
  return crearNotificacion(idUsuario, tipo, titulo, mensaje, link);
}

/**
 * Notificacion broadcast a todos los usuarios con un permiso especifico
 */
async function notificarPorPermiso(recurso, permiso, titulo, mensaje, link = null) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const permisoMap = {
      benefactores: {
        aprobar: 'aprobaciones',
      },
      social: {
        aprobar: 'aprobaciones_social',
      },
    };

    const columnaPermiso = permisoMap[recurso]?.[permiso];

    if (!columnaPermiso) {
      throw new Error('Permiso no soportado por el sistema actual');
    }

    const queryUsuarios = `
      SELECT DISTINCT u.id_usuario, u.nombre_usuario
      FROM usuarios u
      JOIN permisos_usuario p ON p.id_usuario = u.id_usuario
      WHERE u.activo = TRUE
        AND COALESCE(p.${columnaPermiso}, FALSE) = TRUE
    `;

    const resultUsuarios = await client.query(queryUsuarios);

    const notificacionesCreadas = [];

    for (const usuario of resultUsuarios.rows) {
      const queryNotificacion = `
        SELECT crear_notificacion($1, 'SISTEMA', $2, $3, $4) AS id_notificacion
      `;

      const result = await client.query(queryNotificacion, [
        usuario.id_usuario,
        titulo,
        mensaje,
        link,
      ]);

      notificacionesCreadas.push({
        usuario: usuario.nombre_usuario,
        id_notificacion: result.rows[0].id_notificacion,
      });
    }

    await client.query('COMMIT');

    return {
      mensaje: 'Notificaciones broadcast enviadas',
      total: notificacionesCreadas.length,
      usuarios: notificacionesCreadas,
    };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ==========================================
// 3. ESTADISTICAS DE NOTIFICACIONES
// ==========================================

/**
 * Obtener estadisticas de notificaciones
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
 * Notificar a usuarios con permisos de aprobacion sobre casos pendientes
 */
async function notificarCasosPendientes(tipoCaso = 'benefactores') {
  const client = await pool.connect();

  try {
    console.log('[Notificaciones] Verificando casos pendientes:', tipoCaso);

    let tabla;
    let permisoRequerido;
    let nombreCaso;
    let linkBase;

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
      throw new Error('Tipo de caso no valido');
    }

    const queryCasos = `
      SELECT COUNT(*) AS total
      FROM ${tabla}
      WHERE estado_registro = 'PENDIENTE'
    `;

    const resultCasos = await client.query(queryCasos);
    const totalPendientes = parseInt(resultCasos.rows[0].total, 10);

    console.log('[Notificaciones] Casos pendientes encontrados:', totalPendientes);

    if (totalPendientes === 0) {
      return { mensaje: 'No hay casos pendientes', usuarios_notificados: 0 };
    }

    const queryUsuarios = `
      SELECT DISTINCT u.id_usuario
      FROM usuarios u
      JOIN permisos_usuario p ON p.id_usuario = u.id_usuario
      WHERE u.activo = TRUE
        AND COALESCE(p.${permisoRequerido}, FALSE) = TRUE
    `;

    const resultUsuarios = await client.query(queryUsuarios);

    console.log('[Notificaciones] Usuarios con permisos:', resultUsuarios.rows.length);

    const titulo = `Tienes ${totalPendientes} ${nombreCaso} pendientes de aprobacion`;
    const mensaje = `Hay ${totalPendientes} ${nombreCaso} esperando tu revision.`;

    let notificacionesCreadas = 0;

    for (const usuario of resultUsuarios.rows) {
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
      total_pendientes: totalPendientes,
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
  notificarCasosPendientes,
};
