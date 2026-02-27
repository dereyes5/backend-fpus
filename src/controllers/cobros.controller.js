const pool = require('../config/database');

const logCartera = (evento, payload = {}) => {
  console.log(`[Cartera] ${evento}`, payload);
};

/**
 * Obtener lista de benefactores titulares con su monto esperado
 */
const obtenerListaBenefactores = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        id_benefactor,
        nombre_completo,
        cedula,
        email,
        telefono,
        aporte AS monto_esperado,
        banco_emisor,
        tipo_cuenta,
        num_cuenta_tc
      FROM benefactores
      WHERE tipo_benefactor = 'TITULAR' 
        AND estado_registro = 'APROBADO'
      ORDER BY nombre_completo
    `);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error al obtener lista de benefactores:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener lista de benefactores'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener estado de aportes del mes actual
 */
const obtenerEstadoAportesMesActual = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        e.*,
        b.n_convenio,
        b.tipo_benefactor,
        LOWER(COALESCE(b.tipo_afiliacion, '')) AS tipo_afiliacion,
        COALESCE(cobros_estado.debitados, 0) as cobros_debitados,
        COALESCE(cobros_estado.pendientes, 0) as cobros_pendientes,
        COALESCE(cobros_estado.errores, 0) as cobros_errores,
        CASE 
          WHEN b.tipo_benefactor = 'DEPENDIENTE'
               AND LOWER(COALESCE(b.tipo_afiliacion, '')) = 'corporativo'
               AND COALESCE(cobros_titular.debitados, 0) > 0
               AND e.estado_aporte = 'APORTADO'
            THEN 'APORTADO'
          WHEN COALESCE(cobros_estado.debitados, 0) > 0 AND e.estado_aporte = 'APORTADO' THEN 'APORTADO'
          ELSE 'NO_APORTADO'
        END as estado_cobro
      FROM estado_aportes_mes_actual e
      JOIN benefactores b ON e.id_benefactor = b.id_benefactor
      LEFT JOIN relaciones_dependientes rd ON rd.id_dependiente = e.id_benefactor
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(CASE WHEN c.estado = 'Proceso O.K.' THEN 1 END) as debitados,
          COUNT(CASE WHEN c.estado = 'PENDIENTE' THEN 1 END) as pendientes,
          COUNT(CASE WHEN c.estado LIKE 'ERROR%' THEN 1 END) as errores
        FROM cobros c
        WHERE c.id_benefactor = e.id_benefactor
          AND EXTRACT(MONTH FROM c.fecha_transmision) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM c.fecha_transmision) = EXTRACT(YEAR FROM CURRENT_DATE)
      ) cobros_estado ON TRUE
      LEFT JOIN LATERAL (
        SELECT
          COUNT(CASE WHEN c.estado = 'Proceso O.K.' THEN 1 END) as debitados
        FROM cobros c
        WHERE c.id_benefactor = rd.id_titular
          AND EXTRACT(MONTH FROM c.fecha_transmision) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM c.fecha_transmision) = EXTRACT(YEAR FROM CURRENT_DATE)
      ) cobros_titular ON TRUE
      ORDER BY nombre_completo
    `);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      mes: result.rows[0]?.mes,
      anio: result.rows[0]?.anio
    });
  } catch (error) {
    console.error('Error al obtener estado de aportes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de aportes del mes actual'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener estado de aportes por fecha específica
 */
const obtenerEstadoAportesPorFecha = async (req, res) => {
  const client = await pool.connect();
  try {
    const { fecha } = req.params;

    const result = await client.query(
      'SELECT * FROM obtener_estado_aportes_por_fecha($1)',
      [fecha]
    );

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      fecha
    });
  } catch (error) {
    console.error('Error al obtener estado por fecha:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de aportes por fecha'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener estado de aportes por mes y año
 */
const obtenerEstadoAportesPorMes = async (req, res) => {
  const client = await pool.connect();
  try {
    const { mes, anio } = req.params;

    const result = await client.query(
      'SELECT * FROM obtener_estado_aporte_por_mes($1, $2)',
      [parseInt(mes), parseInt(anio)]
    );

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      mes: parseInt(mes),
      anio: parseInt(anio)
    });
  } catch (error) {
    console.error('Error al obtener estado por mes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de aportes por mes'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener benefactores que NO han aportado este mes
 */
const obtenerNoAportados = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        e.*,
        b.n_convenio,
        COALESCE(cobros_estado.debitados, 0) as cobros_debitados,
        COALESCE(cobros_estado.pendientes, 0) as cobros_pendientes,
        COALESCE(cobros_estado.errores, 0) as cobros_errores,
        'NO_APORTADO' as estado_cobro
      FROM estado_aportes_mes_actual e
      JOIN benefactores b ON e.id_benefactor = b.id_benefactor
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(CASE WHEN c.estado = 'Proceso O.K.' THEN 1 END) as debitados,
          COUNT(CASE WHEN c.estado = 'PENDIENTE' THEN 1 END) as pendientes,
          COUNT(CASE WHEN c.estado LIKE 'ERROR%' THEN 1 END) as errores
        FROM cobros c
        WHERE c.id_benefactor = e.id_benefactor
          AND EXTRACT(MONTH FROM c.fecha_transmision) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM c.fecha_transmision) = EXTRACT(YEAR FROM CURRENT_DATE)
      ) cobros_estado ON TRUE
      WHERE e.estado_aporte = 'NO_APORTADO'
      ORDER BY nombre_completo
    `);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error al obtener no aportados:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener lista de no aportados'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener benefactores que SÍ han aportado este mes
 */
const obtenerAportados = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        e.*,
        b.n_convenio,
        COALESCE(cobros_estado.debitados, 0) as cobros_debitados,
        COALESCE(cobros_estado.pendientes, 0) as cobros_pendientes,
        COALESCE(cobros_estado.errores, 0) as cobros_errores,
        'APORTADO' as estado_cobro
      FROM estado_aportes_mes_actual e
      JOIN benefactores b ON e.id_benefactor = b.id_benefactor
      LEFT JOIN LATERAL (
        SELECT 
          COUNT(CASE WHEN c.estado = 'Proceso O.K.' THEN 1 END) as debitados,
          COUNT(CASE WHEN c.estado = 'PENDIENTE' THEN 1 END) as pendientes,
          COUNT(CASE WHEN c.estado LIKE 'ERROR%' THEN 1 END) as errores
        FROM cobros c
        WHERE c.id_benefactor = e.id_benefactor
          AND EXTRACT(MONTH FROM c.fecha_transmision) = EXTRACT(MONTH FROM CURRENT_DATE)
          AND EXTRACT(YEAR FROM c.fecha_transmision) = EXTRACT(YEAR FROM CURRENT_DATE)
      ) cobros_estado ON TRUE
      WHERE e.estado_aporte = 'APORTADO'
      ORDER BY e.ultima_fecha_aporte DESC
    `);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error al obtener aportados:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener lista de aportados'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener estadísticas del mes actual
 */
const obtenerEstadisticas = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT 
        COUNT(*) AS total_titulares,
        COUNT(CASE WHEN estado_aporte = 'APORTADO' THEN 1 END) AS aportados,
        COUNT(CASE WHEN estado_aporte = 'NO_APORTADO' THEN 1 END) AS no_aportados,
        COALESCE(SUM(monto_esperado), 0) AS total_esperado,
        COALESCE(SUM(monto_aportado), 0) AS total_recaudado,
        ROUND(
          (COALESCE(SUM(monto_aportado), 0) / NULLIF(COALESCE(SUM(monto_esperado), 0), 0) * 100), 
          2
        ) AS porcentaje_recaudacion
      FROM estado_aportes_mes_actual
    `);

    res.json({
      success: true,
      data: result.rows[0]
    });
  } catch (error) {
    console.error('Error al obtener estadísticas:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estadísticas'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener historial completo de aportes mensuales
 */
const obtenerHistorialCompleto = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM historial_aportes_mensuales 
      ORDER BY anio DESC, mes DESC, nombre_completo
    `);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial de aportes'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener historial de aportes de un benefactor específico
 */
const obtenerHistorialBenefactor = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const result = await client.query(`
      SELECT * FROM historial_aportes_mensuales 
      WHERE id_benefactor = $1
        AND anio IS NOT NULL 
        AND mes IS NOT NULL
      ORDER BY anio DESC, mes DESC
    `, [id]);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      id_benefactor: parseInt(id)
    });
  } catch (error) {
    console.error('Error al obtener historial del benefactor:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial del benefactor'
    });
  } finally {
    client.release();
  }
};

/**
 * Registrar cobros manualmente (para carga de archivo del banco)
 */
const registrarCobros = async (req, res) => {
  const client = await pool.connect();
  try {
    const { cobros } = req.body;

    if (!Array.isArray(cobros) || cobros.length === 0) {
      return res.status(400).json({
        success: false,
        error: 'Se requiere un array de cobros'
      });
    }

    await client.query('BEGIN');

    const cobrosInsertados = [];
    for (const cobro of cobros) {
      const result = await client.query(`
        INSERT INTO cobros (
          id_benefactor, fecha_transmision, fecha_pago, cod_tercero,
          estado, moneda, forma_pago, valor_cobrado, empresa,
          tipo_movimiento, pais, banco, tipo_cuenta, num_cuenta, observaciones
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15)
        RETURNING *
      `, [
        cobro.id_benefactor,
        cobro.fecha_transmision,
        cobro.fecha_pago,
        cobro.cod_tercero,
        cobro.estado,
        cobro.moneda || 'DOLAR',
        cobro.forma_pago,
        cobro.valor_cobrado,
        cobro.empresa,
        cobro.tipo_movimiento || 'Cobro',
        cobro.pais || 'Ecuador',
        cobro.banco,
        cobro.tipo_cuenta,
        cobro.num_cuenta,
        cobro.observaciones
      ]);

      cobrosInsertados.push(result.rows[0]);
    }

    // Procesar cobros pendientes
    await client.query('SELECT * FROM procesar_todos_cobros_pendientes()');

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Cobros registrados y procesados correctamente',
      data: {
        cobros_insertados: cobrosInsertados.length,
        cobros: cobrosInsertados
      }
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al registrar cobros:', error);
    res.status(500).json({
      success: false,
      error: 'Error al registrar cobros: ' + error.message
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener saldo actual de un benefactor
 */
const obtenerSaldoBenefactor = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const result = await client.query(
      'SELECT obtener_saldo_actual($1) AS saldo_actual',
      [id]
    );

    res.json({
      success: true,
      data: {
        id_benefactor: parseInt(id),
        saldo_actual: result.rows[0].saldo_actual
      }
    });
  } catch (error) {
    console.error('Error al obtener saldo:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener saldo del benefactor'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener todos los cobros registrados con filtros
 */
const obtenerCobros = async (req, res) => {
  const client = await pool.connect();
  try {
    const {
      id_benefactor,
      estado,
      fecha_desde,
      fecha_hasta,
      procesado,
      page = 1,
      limit = 50
    } = req.query;

    let query = 'SELECT c.*, b.nombre_completo, b.cedula FROM cobros c LEFT JOIN benefactores b ON c.id_benefactor = b.id_benefactor WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (id_benefactor) {
      query += ` AND c.id_benefactor = $${paramCount}`;
      params.push(id_benefactor);
      paramCount++;
    }

    if (estado) {
      query += ` AND c.estado = $${paramCount}`;
      params.push(estado);
      paramCount++;
    }

    if (procesado !== undefined) {
      query += ` AND c.procesado = $${paramCount}`;
      params.push(procesado === 'true');
      paramCount++;
    }

    if (fecha_desde) {
      query += ` AND c.fecha_transmision >= $${paramCount}`;
      params.push(fecha_desde);
      paramCount++;
    }

    if (fecha_hasta) {
      query += ` AND c.fecha_transmision <= $${paramCount}`;
      params.push(fecha_hasta);
      paramCount++;
    }

    query += ' ORDER BY c.fecha_transmision DESC, c.id_cobro DESC';

    // Paginación
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await client.query(query, params);

    // Contar total
    let countQuery = 'SELECT COUNT(*) as total FROM cobros c WHERE 1=1';
    const countParams = [];
    let countParamCount = 1;

    if (id_benefactor) {
      countQuery += ` AND c.id_benefactor = $${countParamCount}`;
      countParams.push(id_benefactor);
      countParamCount++;
    }

    if (estado) {
      countQuery += ` AND c.estado = $${countParamCount}`;
      countParams.push(estado);
      countParamCount++;
    }

    if (procesado !== undefined) {
      countQuery += ` AND c.procesado = $${countParamCount}`;
      countParams.push(procesado === 'true');
      countParamCount++;
    }

    if (fecha_desde) {
      countQuery += ` AND c.fecha_transmision >= $${countParamCount}`;
      countParams.push(fecha_desde);
      countParamCount++;
    }

    if (fecha_hasta) {
      countQuery += ` AND c.fecha_transmision <= $${countParamCount}`;
      countParams.push(fecha_hasta);
    }

    const countResult = await client.query(countQuery, countParams);
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error al obtener cobros:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener cobros'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener transacciones de saldo de un benefactor (auditoría)
 */
const obtenerTransaccionesSaldo = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;

    const result = await client.query(`
      SELECT * FROM transacciones_saldo
      WHERE id_benefactor = $1
      ORDER BY fecha_transaccion DESC
      LIMIT $2 OFFSET $3
    `, [id, limit, offset]);

    const countResult = await client.query(
      'SELECT COUNT(*) as total FROM transacciones_saldo WHERE id_benefactor = $1',
      [id]
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    });
  } catch (error) {
    console.error('Error al obtener transacciones:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener transacciones de saldo'
    });
  } finally {
    client.release();
  }
};

// ========================================
// MÓDULO DE DÉBITOS MENSUALES
// ========================================

const debitosService = require('../services/debitos.service');
const multer = require('multer');
const path = require('path');

// Configuración de multer para archivos Excel
const storage = multer.memoryStorage(); // Guardar en memoria para procesamiento inmediato
const upload = multer({
  storage: storage,
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext === '.xlsx' || ext === '.xls') {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten archivos Excel (.xlsx, .xls)'));
    }
  },
  limits: {
    fileSize: 5 * 1024 * 1024 // 5MB máximo
  }
});

/**
 * Middleware de multer para importación de Excel
 */
const uploadExcel = upload.single('archivo');

/**
 * Importar archivo Excel de débitos mensuales
 */
const importarExcelDebitos = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({
        success: false,
        error: 'No se proporcionó ningún archivo'
      });
    }

    const resultado = await debitosService.importarExcelDebitos(
      req.file.buffer,
      req.file.originalname,
      req.usuario?.id_usuario // Viene del middleware de autenticación
    );

    res.json(resultado);
  } catch (error) {
    console.error('Error al importar Excel de débitos:', error);
    res.status(500).json({
      success: false,
      error: error.message || 'Error al importar archivo Excel'
    });
  }
};

/**
 * Obtener lista de lotes importados
 */
const obtenerLotesImportados = async (req, res) => {
  try {
    const { mes, anio, limit, offset } = req.query;

    const filtros = {
      mes: mes ? parseInt(mes) : null,
      anio: anio ? parseInt(anio) : null,
      limit: limit ? parseInt(limit) : 50,
      offset: offset ? parseInt(offset) : 0
    };

    const lotes = await debitosService.obtenerLotesImportados(filtros);

    res.json({
      success: true,
      data: lotes,
      total: lotes.length
    });
  } catch (error) {
    console.error('Error al obtener lotes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener lista de lotes importados'
    });
  }
};

/**
 * Obtener detalle de un lote específico
 */
const obtenerDetalleLote = async (req, res) => {
  try {
    const { idLote } = req.params;

    const detalle = await debitosService.obtenerDetalleLote(parseInt(idLote));

    res.json({
      success: true,
      data: detalle
    });
  } catch (error) {
    console.error('Error al obtener detalle del lote:', error);
    res.status(404).json({
      success: false,
      error: error.message || 'Error al obtener detalle del lote'
    });
  }
};

/**
 * Obtener estado de aportes mensuales (vista actual)
 */
const obtenerEstadoAportesMensualesActual = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT
        b.id_benefactor,
        b.nombre_completo,
        b.cedula,
        b.n_convenio,
        COALESCE(b.aporte, v.share_inscripcion, 0) AS monto_esperado,
        CASE
          WHEN COALESCE(v.estado_aporte, 'NO_APORTADO') = 'APORTADO' THEN COALESCE(b.aporte, v.share_inscripcion, 0)
          ELSE 0
        END AS monto_aportado,
        COALESCE(v.estado_aporte, 'NO_APORTADO') AS estado_aporte,
        CASE
          WHEN COALESCE(v.estado_aporte, 'NO_APORTADO') = 'APORTADO' THEN 'APORTADO'
          ELSE 'NO_APORTADO'
        END AS estado_cobro,
        NULL::integer AS cobros_debitados,
        NULL::integer AS cobros_pendientes,
        NULL::integer AS cobros_errores,
        NULL::date AS ultima_fecha_aporte,
        COALESCE(v.es_titular, b.tipo_benefactor = 'TITULAR') AS es_titular,
        v.id_titular_relacionado,
        v.nombre_titular,
        COALESCE(v.mes, EXTRACT(MONTH FROM CURRENT_DATE)::integer) AS mes,
        COALESCE(v.anio, EXTRACT(YEAR FROM CURRENT_DATE)::integer) AS anio
      FROM benefactores b
      LEFT JOIN vista_estado_aportes_actual v
        ON v.id_benefactor = b.id_benefactor
      WHERE b.estado_registro = 'APROBADO'
        AND COALESCE(LOWER(b.estado), 'active') IN ('active', 'activo')
      ORDER BY (b.tipo_benefactor = 'TITULAR') DESC, b.nombre_completo
    `);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      mes: result.rows[0]?.mes,
      anio: result.rows[0]?.anio
    });
  } catch (error) {
    console.error('Error al obtener estado de aportes mensuales:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de aportes mensuales'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener historial completo de aportes mensuales
 */
const obtenerHistorialAportesMensuales = async (req, res) => {
  const client = await pool.connect();
  try {
    const { mes, anio, idBenefactor } = req.query;

    let query = 'SELECT * FROM vista_historial_aportes_completo WHERE 1=1';
    const params = [];
    let paramIndex = 1;

    if (mes) {
      params.push(parseInt(mes));
      query += ` AND mes = $${paramIndex++}`;
    }

    if (anio) {
      params.push(parseInt(anio));
      query += ` AND anio = $${paramIndex++}`;
    }

    if (idBenefactor) {
      params.push(parseInt(idBenefactor));
      query += ` AND id_benefactor = $${paramIndex++}`;
    }

    query += ' ORDER BY anio DESC, mes DESC, nombre_completo';

    const result = await client.query(query, params);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error al obtener historial de aportes:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener historial de aportes mensuales'
    });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerListaBenefactores,
  obtenerEstadoAportesMesActual,
  obtenerEstadoAportesPorFecha,
  obtenerEstadoAportesPorMes,
  obtenerNoAportados,
  obtenerAportados,
  obtenerEstadisticas,
  obtenerHistorialCompleto,
  obtenerHistorialBenefactor,
  registrarCobros,
  obtenerSaldoBenefactor,
  obtenerCobros,
  obtenerTransaccionesSaldo,
  // Nuevos endpoints de débitos mensuales
  uploadExcel,
  importarExcelDebitos,
  obtenerLotesImportados,
  obtenerDetalleLote,
  obtenerEstadoAportesMensualesActual,
  obtenerHistorialAportesMensuales
};

const wrapCarteraHandler = (nombre, handler) => {
  return async (req, res, next) => {
    const inicio = Date.now();
    const contexto = {
      userId: req.usuario?.id_usuario || null,
      method: req.method,
      url: req.originalUrl || req.url,
      params: req.params || {},
      query: req.query || {}
    };

    logCartera(`${nombre}:inicio`, contexto);

    res.on('finish', () => {
      logCartera(`${nombre}:fin`, {
        ...contexto,
        statusCode: res.statusCode,
        durationMs: Date.now() - inicio
      });
    });

    try {
      return await handler(req, res, next);
    } catch (error) {
      logCartera(`${nombre}:error_no_controlado`, {
        ...contexto,
        message: error.message,
        stack: error.stack
      });
      if (typeof next === 'function') {
        return next(error);
      }
      throw error;
    }
  };
};

const carteraHandlersConLog = [
  'obtenerListaBenefactores',
  'obtenerEstadoAportesMesActual',
  'obtenerEstadoAportesPorFecha',
  'obtenerEstadoAportesPorMes',
  'obtenerNoAportados',
  'obtenerAportados',
  'obtenerEstadisticas',
  'obtenerHistorialCompleto',
  'obtenerHistorialBenefactor',
  'registrarCobros',
  'obtenerSaldoBenefactor',
  'obtenerCobros',
  'obtenerTransaccionesSaldo',
  'importarExcelDebitos',
  'obtenerLotesImportados',
  'obtenerDetalleLote',
  'obtenerEstadoAportesMensualesActual',
  'obtenerHistorialAportesMensuales'
];

carteraHandlersConLog.forEach((handlerName) => {
  if (typeof module.exports[handlerName] === 'function') {
    module.exports[handlerName] = wrapCarteraHandler(handlerName, module.exports[handlerName]);
  }
});
