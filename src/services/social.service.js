const pool = require('../config/database');

/**
 * Servicio para gestión de casos sociales
 */

// ==========================================
// 1. BENEFICIARIOS SOCIALES - CRUD
// ==========================================

/**
 * Crear nuevo caso social
 */
async function crearBeneficiarioSocial(data, idUsuarioCarga) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const query = `
      INSERT INTO beneficiarios_sociales (
        nombre_completo, cedula, telefono, email,
        direccion, ciudad, provincia, tipo_caso, prioridad, estado,
        descripcion_caso, id_usuario_carga, fecha_inicio, observaciones
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
      RETURNING *
    `;
    
    const values = [
      data.nombre_completo,
      data.cedula || null,
      data.telefono || null,
      data.email || null,
      data.direccion || null,
      data.ciudad || null,
      data.provincia || null,
      data.tipo_caso,
      data.prioridad,
      data.estado || 'Activo',
      data.descripcion_caso,
      idUsuarioCarga,
      data.fecha_inicio || new Date(),
      data.observaciones || null
    ];
    
    const result = await client.query(query, values);
    
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Obtener beneficiarios sociales con filtros
 */
async function obtenerBeneficiariosSociales(filtros = {}) {
  let query = `
    SELECT * FROM vista_casos_sociales_completa
    WHERE 1=1
  `;
  
  const values = [];
  let paramCount = 1;
  
  // Filtro por estado
  if (filtros.estado) {
    query += ` AND estado = $${paramCount}`;
    values.push(filtros.estado);
    paramCount++;
  }
  
  // Filtro por estado de registro
  if (filtros.estado_registro) {
    query += ` AND estado_registro = $${paramCount}`;
    values.push(filtros.estado_registro);
    paramCount++;
  }
  
  // Filtro por prioridad
  if (filtros.prioridad) {
    query += ` AND prioridad = $${paramCount}`;
    values.push(filtros.prioridad);
    paramCount++;
  }
  
  // Filtro por ciudad
  if (filtros.ciudad) {
    query += ` AND ciudad ILIKE $${paramCount}`;
    values.push(`%${filtros.ciudad}%`);
    paramCount++;
  }
  
  // Filtro por tipo de caso
  if (filtros.tipo_caso) {
    query += ` AND tipo_caso = $${paramCount}`;
    values.push(filtros.tipo_caso);
    paramCount++;
  }
  
  // Filtro por trabajadora social
  if (filtros.id_usuario_carga) {
    query += ` AND id_usuario_carga = $${paramCount}`;
    values.push(filtros.id_usuario_carga);
    paramCount++;
  }
  
  // Búsqueda por nombre o cédula
  if (filtros.busqueda) {
    query += ` AND (nombre_completo ILIKE $${paramCount} OR cedula ILIKE $${paramCount})`;
    values.push(`%${filtros.busqueda}%`);
    paramCount++;
  }
  
  query += ` ORDER BY fecha_registro DESC`;
  
  const result = await pool.query(query, values);
  return result.rows;
}

/**
 * Obtener beneficiario social por ID
 */
async function obtenerBeneficiarioSocialPorId(id) {
  const query = `
    SELECT * FROM vista_casos_sociales_completa
    WHERE id_beneficiario_social = $1
  `;
  
  const result = await pool.query(query, [id]);
  
  if (result.rows.length === 0) {
    throw new Error('Beneficiario social no encontrado');
  }
  
  return result.rows[0];
}

/**
 * Verificar que un caso social pertenezca al usuario indicado
 */
async function verificarPropietarioCasoSocial(idBeneficiarioSocial, idUsuario) {
  const query = `
    SELECT id_beneficiario_social, id_usuario_carga
    FROM beneficiarios_sociales
    WHERE id_beneficiario_social = $1
  `;

  const result = await pool.query(query, [idBeneficiarioSocial]);

  if (result.rows.length === 0) {
    throw new Error('Beneficiario social no encontrado');
  }

  if (Number(result.rows[0].id_usuario_carga) !== Number(idUsuario)) {
    throw new Error('No autorizado para acceder a este caso social');
  }

  return true;
}

/**
 * Verificar que un seguimiento pertenezca a un caso del usuario indicado
 */
async function verificarPropietarioSeguimientoSocial(idSeguimiento, idUsuario) {
  const query = `
    SELECT s.id_seguimiento, bs.id_usuario_carga
    FROM seguimiento_social s
    JOIN beneficiarios_sociales bs
      ON bs.id_beneficiario_social = s.id_beneficiario_social
    WHERE s.id_seguimiento = $1
  `;

  const result = await pool.query(query, [idSeguimiento]);

  if (result.rows.length === 0) {
    throw new Error('Seguimiento no encontrado');
  }

  if (Number(result.rows[0].id_usuario_carga) !== Number(idUsuario)) {
    throw new Error('No autorizado para acceder a este seguimiento');
  }

  return true;
}

/**
 * Actualizar beneficiario social
 */
async function actualizarBeneficiarioSocial(id, data) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    const setClauses = [];
    const values = [];
    let paramCount = 1;
    
    const camposActualizables = [
      'nombre_completo', 'cedula', 'telefono', 'email', 'direccion',
      'ciudad', 'provincia', 'tipo_caso', 'prioridad', 'estado',
      'descripcion_caso', 'fecha_inicio', 'fecha_cierre', 'observaciones'
    ];
    
    camposActualizables.forEach(campo => {
      if (data[campo] !== undefined) {
        setClauses.push(`${campo} = $${paramCount}`);
        values.push(data[campo]);
        paramCount++;
      }
    });
    
    if (setClauses.length === 0) {
      throw new Error('No hay campos para actualizar');
    }
    
    values.push(id);
    
    const query = `
      UPDATE beneficiarios_sociales
      SET ${setClauses.join(', ')}
      WHERE id_beneficiario_social = $${paramCount}
      RETURNING *
    `;
    
    const result = await client.query(query, values);
    
    if (result.rows.length === 0) {
      throw new Error('Beneficiario social no encontrado');
    }
    
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Cambiar estado del caso
 */
async function cambiarEstadoCaso(id, nuevoEstado, observaciones = null) {
  const estadosValidos = ['Activo', 'En seguimiento', 'Cerrado'];
  
  if (!estadosValidos.includes(nuevoEstado)) {
    throw new Error('Estado no válido');
  }
  
  const values = [nuevoEstado, id];
  let query = `
    UPDATE beneficiarios_sociales
    SET estado = $1
  `;
  
  if (nuevoEstado === 'Cerrado') {
    query += `, fecha_cierre = CURRENT_DATE`;
  }
  
  if (observaciones) {
    query += `, observaciones = $3`;
    values.push(observaciones);
  }
  
  query += ` WHERE id_beneficiario_social = $2 RETURNING *`;
  
  const result = await pool.query(query, values);
  
  if (result.rows.length === 0) {
    throw new Error('Beneficiario social no encontrado');
  }
  
  return result.rows[0];
}

// ==========================================
// 2. SEGUIMIENTO - BITÁCORA
// ==========================================

/**
 * Agregar seguimiento a un caso
 */
async function agregarSeguimiento(idBeneficiarioSocial, data, fotos, idUsuario) {
  const client = await pool.connect();
  
  try {
    console.log('[SocialService][Seguimiento] agregarSeguimiento - inicio', {
      idBeneficiarioSocial,
      idUsuario,
      tipo_evento: data?.tipo_evento,
      fecha_evento: data?.fecha_evento || null,
      descripcionLength: typeof data?.descripcion === 'string' ? data.descripcion.length : 0,
      fotosCount: Array.isArray(fotos) ? fotos.length : 0
    });

    await client.query('BEGIN');
    
    // Insertar seguimiento
    const querySeguimiento = `
      INSERT INTO seguimiento_social (
        id_beneficiario_social, tipo_evento, descripcion,
        id_usuario, fecha_evento
      ) VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    
    const valuesSeguimiento = [
      idBeneficiarioSocial,
      data.tipo_evento,
      data.descripcion,
      idUsuario,
      data.fecha_evento || new Date()
    ];
    
    const resultSeguimiento = await client.query(querySeguimiento, valuesSeguimiento);
    const seguimiento = resultSeguimiento.rows[0];
    
    // Si hay fotos, insertarlas
    if (fotos && fotos.length > 0) {
      const queryFotos = `
        INSERT INTO fotos_seguimiento (
          id_seguimiento, nombre_archivo, ruta_archivo, descripcion
        ) VALUES ($1, $2, $3, $4)
        RETURNING *
      `;
      
      const fotosInsertadas = [];
      for (const foto of fotos) {
        const valuesFoto = [
          seguimiento.id_seguimiento,
          foto.nombre_archivo,
          foto.ruta_archivo,
          foto.descripcion || null
        ];
        
        const resultFoto = await client.query(queryFotos, valuesFoto);
        fotosInsertadas.push(resultFoto.rows[0]);
      }
      
      seguimiento.fotos = fotosInsertadas;
    }
    
    await client.query('COMMIT');

    console.log('[SocialService][Seguimiento] agregarSeguimiento - commit', {
      id_seguimiento: seguimiento?.id_seguimiento,
      idBeneficiarioSocial,
      fotosCount: Array.isArray(seguimiento?.fotos) ? seguimiento.fotos.length : 0
    });
    
    return seguimiento;
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[SocialService][Seguimiento] agregarSeguimiento - rollback', {
      idBeneficiarioSocial,
      idUsuario,
      message: error.message,
      stack: error.stack
    });
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Obtener seguimiento de un caso (bitácora completa)
 */
async function obtenerSeguimiento(idBeneficiarioSocial) {
  console.log('[SocialService][Seguimiento] obtenerSeguimiento - query', {
    idBeneficiarioSocial
  });

  const query = `
    SELECT 
      s.id_seguimiento,
      s.tipo_evento,
      s.descripcion,
      s.fecha_evento,
      s.tiene_fotos,
      s.fecha_registro,
      u.nombre_usuario AS responsable,
      COALESCE(
        json_agg(
          json_build_object(
            'id_foto', f.id_foto,
            'nombre_archivo', f.nombre_archivo,
            'ruta_archivo', f.ruta_archivo,
            'descripcion', f.descripcion,
            'fecha_carga', f.fecha_carga
          ) ORDER BY f.fecha_carga
        ) FILTER (WHERE f.id_foto IS NOT NULL),
        '[]'
      ) AS fotos
    FROM seguimiento_social s
    JOIN usuarios u ON u.id_usuario = s.id_usuario
    LEFT JOIN fotos_seguimiento f ON f.id_seguimiento = s.id_seguimiento
    WHERE s.id_beneficiario_social = $1
    GROUP BY s.id_seguimiento, u.nombre_usuario
    ORDER BY s.fecha_evento DESC, s.fecha_registro DESC
  `;
  
  const result = await pool.query(query, [idBeneficiarioSocial]);
  console.log('[SocialService][Seguimiento] obtenerSeguimiento - resultado', {
    idBeneficiarioSocial,
    total: result.rows.length,
    ids: result.rows.slice(0, 5).map((row) => row.id_seguimiento)
  });
  return result.rows;
}

/**
 * Eliminar un seguimiento
 */
async function eliminarSeguimiento(idSeguimiento) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Las fotos se eliminan en cascada automáticamente
    const query = `
      DELETE FROM seguimiento_social
      WHERE id_seguimiento = $1
      RETURNING *
    `;
    
    const result = await client.query(query, [idSeguimiento]);
    
    if (result.rows.length === 0) {
      throw new Error('Seguimiento no encontrado');
    }
    
    await client.query('COMMIT');
    
    return result.rows[0];
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

// ==========================================
// 3. ESTADÍSTICAS
// ==========================================

/**
 * Obtener estadísticas del módulo social
 */
async function obtenerEstadisticas(filtros = {}) {
  let whereClause = 'WHERE 1=1';
  const values = [];
  let paramCount = 1;
  
  if (filtros.id_usuario_carga) {
    whereClause += ` AND id_usuario_carga = $${paramCount}`;
    values.push(filtros.id_usuario_carga);
    paramCount++;
  }
  
  const query = `
    SELECT
      COUNT(*) FILTER (WHERE estado = 'Activo') AS casos_activos,
      COUNT(*) FILTER (WHERE estado = 'En seguimiento') AS casos_en_seguimiento,
      COUNT(*) FILTER (WHERE estado = 'Cerrado') AS casos_cerrados,
      COUNT(*) FILTER (WHERE prioridad = 'Alta') AS prioridad_alta,
      COUNT(*) FILTER (WHERE prioridad = 'Media') AS prioridad_media,
      COUNT(*) FILTER (WHERE prioridad = 'Baja') AS prioridad_baja,
      COUNT(*) FILTER (WHERE estado_registro = 'PENDIENTE') AS pendientes_aprobacion,
      COUNT(*) FILTER (WHERE estado_registro = 'APROBADO') AS aprobados,
      COUNT(*) FILTER (WHERE estado_registro = 'RECHAZADO') AS rechazados,
      COUNT(DISTINCT tipo_caso) AS tipos_caso_unicos,
      COUNT(DISTINCT ciudad) AS ciudades_atendidas
    FROM beneficiarios_sociales
    ${whereClause}
  `;
  
  const result = await pool.query(query, values);
  
  // Estadísticas por tipo de caso
  const queryTiposCaso = `
    SELECT 
      tipo_caso,
      COUNT(*) AS total
    FROM beneficiarios_sociales
    ${whereClause}
    GROUP BY tipo_caso
    ORDER BY total DESC
  `;
  
  const resultTipos = await pool.query(queryTiposCaso, values);
  
  return {
    general: result.rows[0],
    por_tipo_caso: resultTipos.rows
  };
}

// ==========================================
// 4. APROBACIONES
// ==========================================

/**
 * Obtener casos sociales pendientes de aprobación
 */
async function obtenerCasosPendientes() {
  const query = `
    SELECT * FROM vista_casos_sociales_completa
    WHERE estado_registro = 'PENDIENTE'
    ORDER BY fecha_registro ASC
  `;
  
  const result = await pool.query(query);
  return result.rows;
}

/**
 * Aprobar caso social
 */
async function aprobarCasoSocial(idBeneficiarioSocial, idAdmin, comentario = null) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    // Actualizar estado del caso
    const queryUpdate = `
      UPDATE beneficiarios_sociales
      SET estado_registro = 'APROBADO'
      WHERE id_beneficiario_social = $1
      RETURNING *
    `;
    
    const resultUpdate = await client.query(queryUpdate, [idBeneficiarioSocial]);
    
    if (resultUpdate.rows.length === 0) {
      throw new Error('Beneficiario social no encontrado');
    }
    
    const beneficiario = resultUpdate.rows[0];
    
    // Registrar aprobación
    const queryAprobacion = `
      INSERT INTO aprobaciones_beneficiarios_sociales (
        id_beneficiario_social, id_admin, estado_aprobacion, comentario
      ) VALUES ($1, $2, 'APROBADO', $3)
      RETURNING *
    `;
    
    await client.query(queryAprobacion, [idBeneficiarioSocial, idAdmin, comentario]);
    
    // Crear notificación para la trabajadora social
    const queryNotificacion = `
      SELECT crear_notificacion(
        $1,
        'APROBACION_SOCIAL',
        '✅ Caso social aprobado',
        $2,
        $3
      )
    `;
    
    const mensaje = `El caso de ${beneficiario.nombre_completo} ha sido aprobado. Ya puedes continuar con el seguimiento y gestión de apoyos.`;
    const link = `/social/${idBeneficiarioSocial}`;
    
    await client.query(queryNotificacion, [beneficiario.id_usuario_carga, mensaje, link]);
    
    await client.query('COMMIT');
    
    return beneficiario;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

/**
 * Rechazar caso social
 */
async function rechazarCasoSocial(idBeneficiarioSocial, idAdmin, comentario) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');
    
    if (!comentario) {
      throw new Error('El comentario es obligatorio al rechazar un caso');
    }
    
    // Actualizar estado del caso
    const queryUpdate = `
      UPDATE beneficiarios_sociales
      SET estado_registro = 'RECHAZADO'
      WHERE id_beneficiario_social = $1
      RETURNING *
    `;
    
    const resultUpdate = await client.query(queryUpdate, [idBeneficiarioSocial]);
    
    if (resultUpdate.rows.length === 0) {
      throw new Error('Beneficiario social no encontrado');
    }
    
    const beneficiario = resultUpdate.rows[0];
    
    // Registrar rechazo
    const queryAprobacion = `
      INSERT INTO aprobaciones_beneficiarios_sociales (
        id_beneficiario_social, id_admin, estado_aprobacion, comentario
      ) VALUES ($1, $2, 'RECHAZADO', $3)
      RETURNING *
    `;
    
    await client.query(queryAprobacion, [idBeneficiarioSocial, idAdmin, comentario]);
    
    // Crear notificación para la trabajadora social
    const queryNotificacion = `
      SELECT crear_notificacion(
        $1,
        'APROBACION_SOCIAL',
        '❌ Caso social rechazado',
        $2,
        $3
      )
    `;
    
    const mensaje = `El caso de ${beneficiario.nombre_completo} ha sido rechazado. Motivo: ${comentario}`;
    const link = `/social/${idBeneficiarioSocial}`;
    
    await client.query(queryNotificacion, [beneficiario.id_usuario_carga, mensaje, link]);
    
    await client.query('COMMIT');
    
    return beneficiario;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  crearBeneficiarioSocial,
  obtenerBeneficiariosSociales,
  obtenerBeneficiarioSocialPorId,
  verificarPropietarioCasoSocial,
  verificarPropietarioSeguimientoSocial,
  actualizarBeneficiarioSocial,
  cambiarEstadoCaso,
  agregarSeguimiento,
  obtenerSeguimiento,
  eliminarSeguimiento,
  obtenerEstadisticas,
  obtenerCasosPendientes,
  aprobarCasoSocial,
  rechazarCasoSocial
};
