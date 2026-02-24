const pool = require('../config/database');
const notificacionesService = require('../services/notificaciones.service');

const obtenerAprobaciones = async (req, res) => {
  const client = await pool.connect();
  try {
    const { estado_aprobacion, page = 1, limit = 50 } = req.query;
    
    let query = `
      SELECT 
        a.*,
        b.nombre_completo as benefactor_nombre,
        b.cedula as benefactor_cedula,
        b.tipo_benefactor
      FROM aprobaciones_benefactores a
      INNER JOIN benefactores b ON a.id_benefactor = b.id_benefactor
      WHERE 1=1
    `;
    const params = [];
    let paramCount = 1;

    if (estado_aprobacion) {
      query += ` AND a.estado_aprobacion = $${paramCount}`;
      params.push(estado_aprobacion);
      paramCount++;
    }

    query += ' ORDER BY a.fecha_accion DESC';

    // Paginación
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await client.query(query, params);

    // Contar total
    let countQuery = 'SELECT COUNT(*) as total FROM aprobaciones_benefactores WHERE 1=1';
    const countParams = [];
    let countParamCount = 1;

    if (estado_aprobacion) {
      countQuery += ` AND estado_aprobacion = $${countParamCount}`;
      countParams.push(estado_aprobacion);
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
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error al obtener aprobaciones:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener aprobaciones',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const obtenerRegistrosPendientes = async (req, res) => {
  const client = await pool.connect();
  try {
    const { page = 1, limit = 50 } = req.query;

    const offset = (page - 1) * limit;

    const result = await client.query(
      `SELECT b.*, u.nombre_usuario as ejecutivo 
       FROM benefactores b
       LEFT JOIN usuarios u ON b.id_usuario = u.id_usuario
       WHERE b.estado_registro = 'PENDIENTE'
       ORDER BY b.id_benefactor DESC
       LIMIT $1 OFFSET $2`,
      [limit, offset]
    );

    const countResult = await client.query(
      "SELECT COUNT(*) as total FROM benefactores WHERE estado_registro = 'PENDIENTE'"
    );
    const total = parseInt(countResult.rows[0].total);

    res.json({
      success: true,
      data: result.rows,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit),
      },
    });
  } catch (error) {
    console.error('Error al obtener registros pendientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener registros pendientes',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const aprobarRechazarRegistro = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id_benefactor, estado_aprobacion, comentario } = req.body;
    const id_admin = req.usuario.id_usuario;

    // Verificar que el benefactor existe y está pendiente
    const benefactor = await client.query(
      `SELECT 
        b.estado_registro,
        b.nombre_completo,
        b.id_usuario,
        u.nombre_usuario
      FROM benefactores b
      JOIN usuarios u ON u.id_usuario = b.id_usuario
      WHERE b.id_benefactor = $1`,
      [id_benefactor]
    );

    if (benefactor.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Benefactor no encontrado',
      });
    }

    const benefactorData = benefactor.rows[0];

    if (benefactorData.estado_registro !== 'PENDIENTE') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'El registro ya fue procesado',
      });
    }

    // Actualizar estado del benefactor
    await client.query(
      'UPDATE benefactores SET estado_registro = $1 WHERE id_benefactor = $2',
      [estado_aprobacion, id_benefactor]
    );

    // Crear registro de aprobación
    const result = await client.query(
      `INSERT INTO aprobaciones_benefactores (
        id_benefactor, id_admin, estado_aprobacion, comentario
      ) VALUES ($1, $2, $3, $4) RETURNING *`,
      [id_benefactor, id_admin, estado_aprobacion, comentario]
    );

    // Crear notificación para el usuario que cargó el benefactor
    const aprobado = estado_aprobacion === 'APROBADO';
    const titulo = aprobado 
      ? '✅ Benefactor aprobado' 
      : '❌ Benefactor rechazado';
    const mensaje = aprobado
      ? `El benefactor ${benefactorData.nombre_completo} ha sido aprobado exitosamente.`
      : `El benefactor ${benefactorData.nombre_completo} ha sido rechazado${comentario ? `. Motivo: ${comentario}` : '.'}`;
    const link = `/benefactores/${id_benefactor}`;

    await client.query(
      `SELECT crear_notificacion($1, 'APROBACION_BENEFACTOR', $2, $3, $4)`,
      [benefactorData.id_usuario, titulo, mensaje, link]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: `Registro ${estado_aprobacion.toLowerCase()} exitosamente`,
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al procesar aprobación:', error);
    res.status(500).json({
      success: false,
      message: 'Error al procesar aprobación',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const obtenerHistorialAprobaciones = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const result = await client.query(
      `SELECT 
        a.*,
        u.id_usuario as admin_id
      FROM aprobaciones_benefactores a
      INNER JOIN usuarios u ON a.id_admin = u.id_usuario
      WHERE a.id_benefactor = $1
      ORDER BY a.fecha_accion DESC`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error al obtener historial:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener historial de aprobaciones',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerAprobaciones,
  obtenerRegistrosPendientes,
  aprobarRechazarRegistro,
  obtenerHistorialAprobaciones,
};
