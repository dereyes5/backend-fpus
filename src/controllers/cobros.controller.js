const pool = require('../config/database');

/**
 * Obtener lista de benefactores titulares con su monto a pagar
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
        aporte AS monto_a_pagar,
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
 * Obtener estado de pagos del mes actual
 */
const obtenerEstadoPagosMesActual = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM estado_pagos_mes_actual ORDER BY nombre_completo');

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length,
      mes: result.rows[0]?.mes,
      anio: result.rows[0]?.anio
    });
  } catch (error) {
    console.error('Error al obtener estado de pagos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener estado de pagos del mes actual'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener estado de pagos por fecha específica
 */
const obtenerEstadoPagosPorFecha = async (req, res) => {
  const client = await pool.connect();
  try {
    const { fecha } = req.params;

    const result = await client.query(
      'SELECT * FROM obtener_estado_pagos_por_fecha($1)',
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
      error: 'Error al obtener estado de pagos por fecha'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener estado de pagos por mes y año
 */
const obtenerEstadoPagosPorMes = async (req, res) => {
  const client = await pool.connect();
  try {
    const { mes, anio } = req.params;

    const result = await client.query(
      'SELECT * FROM obtener_estado_pago_por_mes($1, $2)',
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
      error: 'Error al obtener estado de pagos por mes'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener benefactores que NO han pagado este mes
 */
const obtenerMorosos = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM estado_pagos_mes_actual 
      WHERE estado_pago = 'NO_PAGADO'
      ORDER BY nombre_completo
    `);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error al obtener morosos:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener lista de morosos'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener benefactores que SÍ han pagado este mes
 */
const obtenerPagados = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM estado_pagos_mes_actual 
      WHERE estado_pago = 'PAGADO'
      ORDER BY ultima_fecha_pago DESC
    `);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error al obtener pagados:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener lista de pagados'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener benefactores con pago parcial este mes
 */
const obtenerPagosParciales = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM estado_pagos_mes_actual 
      WHERE estado_pago = 'PAGO_PARCIAL'
      ORDER BY nombre_completo
    `);

    res.json({
      success: true,
      data: result.rows,
      total: result.rows.length
    });
  } catch (error) {
    console.error('Error al obtener pagos parciales:', error);
    res.status(500).json({
      success: false,
      error: 'Error al obtener lista de pagos parciales'
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
        COUNT(CASE WHEN estado_pago = 'PAGADO' THEN 1 END) AS pagados,
        COUNT(CASE WHEN estado_pago = 'PAGO_PARCIAL' THEN 1 END) AS parciales,
        COUNT(CASE WHEN estado_pago = 'NO_PAGADO' THEN 1 END) AS no_pagados,
        COALESCE(SUM(monto_a_pagar), 0) AS total_esperado,
        COALESCE(SUM(monto_pagado), 0) AS total_recaudado,
        COALESCE(SUM(saldo_pendiente), 0) AS total_pendiente,
        ROUND(
          (COALESCE(SUM(monto_pagado), 0) / NULLIF(COALESCE(SUM(monto_a_pagar), 0), 0) * 100), 
          2
        ) AS porcentaje_recaudacion
      FROM estado_pagos_mes_actual
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
 * Obtener historial completo de pagos mensuales
 */
const obtenerHistorialCompleto = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query(`
      SELECT * FROM historial_pagos_mensuales 
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
      error: 'Error al obtener historial de pagos'
    });
  } finally {
    client.release();
  }
};

/**
 * Obtener historial de pagos de un benefactor específico
 */
const obtenerHistorialBenefactor = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const result = await client.query(`
      SELECT * FROM historial_pagos_mensuales 
      WHERE id_benefactor = $1
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

module.exports = {
  obtenerListaBenefactores,
  obtenerEstadoPagosMesActual,
  obtenerEstadoPagosPorFecha,
  obtenerEstadoPagosPorMes,
  obtenerMorosos,
  obtenerPagados,
  obtenerPagosParciales,
  obtenerEstadisticas,
  obtenerHistorialCompleto,
  obtenerHistorialBenefactor,
  registrarCobros,
  obtenerSaldoBenefactor,
  obtenerCobros,
  obtenerTransaccionesSaldo
};
