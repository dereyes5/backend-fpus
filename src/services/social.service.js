const pool = require('../config/database');

const CAMPOS_CASO_SOCIAL_SELECT = `
  bs.id_beneficiario_social,
  bs.id_usuario_carga,
  bs.nombre_completo,
  bs.cedula,
  bs.telefono,
  bs.email,
  bs.ciudad,
  bs.provincia,
  bs.tipo_caso,
  bs.estado,
  bs.descripcion_caso,
  bs.fecha_inicio,
  bs.fecha_cierre,
  bs.estado_registro,
  bs.observaciones,
  bs.nombres,
  bs.apellidos,
  bs.sexo,
  bs.edad,
  bs.nacionalidad,
  bs.estado_civil,
  bs.tipo_sangre,
  bs.direccion,
  bs.fecha_nacimiento,
  bs.pais,
  bs.referencia,
  bs.discapacidad,
  bs.discapacidad_detalle,
  bs.con_quien_vive,
  bs.con_quien_vive_detalle,
  bs.situacion_vivienda,
  bs.salud_estado_general,
  bs.enfermedad_catastrofica,
  bs.toma_medicacion_constante,
  bs.alergia_medicamentos,
  bs.alergia_medicamentos_detalle,
  bs.nutricion_num_comidas,
  bs.nutricion_desayuno,
  bs.nutricion_almuerzo,
  bs.nutricion_merienda,
  bs.nutricion_consume_frutas,
  bs.recursos_economicos,
  bs.red_social_apoyo,
  bs.latitud,
  bs.longitud,
  bs.se_siente_acompanado,
  bs.perdida_familiar_reciente,
  bs.perdida_familiar_detalle,
  bs.observaciones_conclusiones,
  bs.fecha_generacion_ficha,
  bs.fecha_registro,
  bs.fecha_actualizacion,
  u.nombre_usuario AS nombre_usuario_carga,
  COUNT(DISTINCT s.id_seguimiento) AS total_seguimientos,
  COUNT(DISTINCT f.id_foto) AS total_fotos,
  MAX(s.fecha_evento) AS ultima_actividad,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id_relacion_familiar', rf.id_relacion_familiar,
          'orden', rf.orden,
          'nombre_familiar', rf.nombre_familiar,
          'forma_convivencia', rf.forma_convivencia,
          'edad', rf.edad,
          'cedula', rf.cedula,
          'telefono', rf.telefono
        ) ORDER BY rf.orden
      )
      FROM social_relaciones_familiares rf
      WHERE rf.id_beneficiario_social = bs.id_beneficiario_social
    ),
    '[]'::json
  ) AS relaciones_familiares,
  COALESCE(
    (
      SELECT json_agg(
        json_build_object(
          'id_documento', d.id_documento,
          'nombre_archivo', d.nombre_archivo,
          'ruta_archivo', d.ruta_archivo,
          'mime_type', d.mime_type,
          'tipo_documento', d.tipo_documento,
          'fecha_subida', d.fecha_subida
        ) ORDER BY d.fecha_subida DESC
      )
      FROM documentos_beneficiario_social d
      WHERE d.id_beneficiario_social = bs.id_beneficiario_social
    ),
    '[]'::json
  ) AS documentos
`;

/**
 * Servicio para gestión de casos sociales
 */

// ==========================================
// 1. BENEFICIARIOS SOCIALES - CRUD
// ==========================================

/**
 * Crear nuevo caso social (ficha ampliada)
 */
async function crearBeneficiarioSocial(data, idUsuarioCarga, archivos = {}) {
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    const query = `
      INSERT INTO beneficiarios_sociales (
        nombre_completo, cedula, telefono, email,
        direccion, ciudad, provincia, tipo_caso, estado,
        descripcion_caso, id_usuario_carga, fecha_inicio, observaciones,
        nombres, apellidos, sexo, edad, nacionalidad, estado_civil, tipo_sangre,
        fecha_nacimiento, pais, referencia, discapacidad, discapacidad_detalle,
        con_quien_vive, con_quien_vive_detalle, situacion_vivienda,
        salud_estado_general, enfermedad_catastrofica, toma_medicacion_constante,
        alergia_medicamentos, alergia_medicamentos_detalle,
        nutricion_num_comidas, nutricion_desayuno, nutricion_almuerzo,
        nutricion_merienda, nutricion_consume_frutas,
        recursos_economicos, red_social_apoyo, latitud, longitud,
        se_siente_acompanado, perdida_familiar_reciente, perdida_familiar_detalle,
        observaciones_conclusiones, fecha_generacion_ficha
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9,
        $10, $11, $12, $13, $14, $15, $16, $17,
        $18, $19, $20, $21, $22, $23, $24, $25,
        $26, $27, $28, $29, $30, $31, $32, $33,
        $34, $35, $36, $37, $38, $39, $40, $41,
        $42, $43, $44, $45, $46, $47, $48
      )
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
      data.estado || 'Activo',
      data.descripcion_caso,
      idUsuarioCarga,
      data.fecha_inicio || new Date(),
      data.observaciones || null,

      data.nombres,
      data.apellidos,
      data.sexo,
      data.edad || null,
      data.nacionalidad || null,
      data.estado_civil || null,
      data.tipo_sangre || null,
      data.fecha_nacimiento || null,
      data.pais || null,
      data.referencia || null,
      data.discapacidad === true,
      data.discapacidad_detalle || null,

      data.con_quien_vive || null,
      data.con_quien_vive_detalle || null,
      JSON.stringify(data.situacion_vivienda || {}),

      data.salud_estado_general || null,
      data.enfermedad_catastrofica === true,
      data.toma_medicacion_constante === true,
      data.alergia_medicamentos === true,
      data.alergia_medicamentos_detalle || null,

      data.nutricion_num_comidas || null,
      data.nutricion_desayuno === true,
      data.nutricion_almuerzo === true,
      data.nutricion_merienda === true,
      data.nutricion_consume_frutas === true,

      JSON.stringify(data.recursos_economicos || {}),
      JSON.stringify(data.red_social_apoyo || {}),
      data.latitud || null,
      data.longitud || null,

      data.se_siente_acompanado,
      data.perdida_familiar_reciente,
      data.perdida_familiar_detalle || null,
      data.observaciones_conclusiones || null,
      data.fecha_generacion_ficha || null
    ];

    const result = await client.query(query, values);

    const beneficiario = result.rows[0];

    if (Array.isArray(data.relaciones_familiares)) {
      const relaciones = data.relaciones_familiares.slice(0, 3);
      for (let i = 0; i < relaciones.length; i++) {
        const item = relaciones[i] || {};
        await client.query(
          `INSERT INTO social_relaciones_familiares (
            id_beneficiario_social, orden, nombre_familiar, forma_convivencia, edad, cedula, telefono
          ) VALUES ($1, $2, $3, $4, $5, $6, $7)`,
          [
            beneficiario.id_beneficiario_social,
            i + 1,
            item.nombre_familiar || 'NO REGISTRADO',
            item.forma_convivencia || 'OCASIONAL',
            item.edad || null,
            item.cedula || null,
            item.telefono || null
          ]
        );
      }
    }

    if (Array.isArray(archivos.documentos) && archivos.documentos.length > 0) {
      for (const documento of archivos.documentos) {
        await client.query(
          `INSERT INTO documentos_beneficiario_social (
            id_beneficiario_social,
            nombre_archivo,
            ruta_archivo,
            mime_type,
            tipo_documento,
            id_usuario
          ) VALUES ($1, $2, $3, $4, 'LEVANTAMIENTO', $5)`,
          [
            beneficiario.id_beneficiario_social,
            documento.nombre_archivo,
            documento.ruta_archivo,
            documento.mime_type || null,
            idUsuarioCarga,
          ]
        );
      }
    }

    await client.query('COMMIT');
    return obtenerBeneficiarioSocialPorId(beneficiario.id_beneficiario_social);
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
    SELECT
      ${CAMPOS_CASO_SOCIAL_SELECT}
    FROM beneficiarios_sociales bs
    JOIN usuarios u ON u.id_usuario = bs.id_usuario_carga
    LEFT JOIN seguimiento_social s ON s.id_beneficiario_social = bs.id_beneficiario_social
    LEFT JOIN fotos_seguimiento f ON f.id_seguimiento = s.id_seguimiento
    WHERE 1=1
  `;

  const values = [];
  let paramCount = 1;

  // Filtro por estado
  if (filtros.estado) {
    query += ` AND bs.estado = $${paramCount}`;
    values.push(filtros.estado);
    paramCount++;
  }

  // Filtro por estado de registro
  if (filtros.estado_registro) {
    query += ` AND bs.estado_registro = $${paramCount}`;
    values.push(filtros.estado_registro);
    paramCount++;
  }

  // Filtro por ciudad
  if (filtros.ciudad) {
    query += ` AND bs.ciudad ILIKE $${paramCount}`;
    values.push(`%${filtros.ciudad}%`);
    paramCount++;
  }

  // Filtro por tipo de caso
  if (filtros.tipo_caso) {
    query += ` AND bs.tipo_caso = $${paramCount}`;
    values.push(filtros.tipo_caso);
    paramCount++;
  }

  // Filtro por trabajadora social
  if (filtros.id_usuario_carga) {
    query += ` AND bs.id_usuario_carga = $${paramCount}`;
    values.push(filtros.id_usuario_carga);
    paramCount++;
  }

  // Búsqueda por nombre o cédula
  if (filtros.busqueda) {
    query += ` AND (bs.nombre_completo ILIKE $${paramCount} OR bs.cedula ILIKE $${paramCount})`;
    values.push(`%${filtros.busqueda}%`);
    paramCount++;
  }

  query += ` GROUP BY bs.id_beneficiario_social, u.nombre_usuario ORDER BY bs.fecha_registro DESC`;

  const result = await pool.query(query, values);
  return result.rows;
}

/**
 * Obtener beneficiario social por ID
 */
async function obtenerBeneficiarioSocialPorId(id) {
  const query = `
    SELECT
      ${CAMPOS_CASO_SOCIAL_SELECT}
    FROM beneficiarios_sociales bs
    JOIN usuarios u ON u.id_usuario = bs.id_usuario_carga
    LEFT JOIN seguimiento_social s ON s.id_beneficiario_social = bs.id_beneficiario_social
    LEFT JOIN fotos_seguimiento f ON f.id_seguimiento = s.id_seguimiento
    WHERE bs.id_beneficiario_social = $1
    GROUP BY bs.id_beneficiario_social, u.nombre_usuario
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
      'ciudad', 'provincia', 'tipo_caso', 'estado',
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

    return obtenerBeneficiarioSocialPorId(id);
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
  const estadosValidos = ['Activo', 'Cerrado'];

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
      s.id_usuario,
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
      0 AS casos_en_seguimiento,
      COUNT(*) FILTER (WHERE estado = 'Cerrado') AS casos_cerrados,
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
    SELECT
      ${CAMPOS_CASO_SOCIAL_SELECT}
    FROM beneficiarios_sociales bs
    JOIN usuarios u ON u.id_usuario = bs.id_usuario_carga
    LEFT JOIN seguimiento_social s ON s.id_beneficiario_social = bs.id_beneficiario_social
    LEFT JOIN fotos_seguimiento f ON f.id_seguimiento = s.id_seguimiento
    WHERE bs.estado_registro = 'PENDIENTE'
    GROUP BY bs.id_beneficiario_social, u.nombre_usuario
    ORDER BY bs.fecha_registro ASC
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
