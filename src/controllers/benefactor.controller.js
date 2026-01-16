const pool = require('../config/database');
const path = require('path');
const fs = require('fs');

const obtenerBenefactores = async (req, res) => {
  const client = await pool.connect();
  try {
    const { tipo_benefactor, estado_registro, page = 1, limit = 50 } = req.query;
    
    let query = 'SELECT * FROM benefactores WHERE 1=1';
    const params = [];
    let paramCount = 1;

    if (tipo_benefactor) {
      query += ` AND tipo_benefactor = $${paramCount}`;
      params.push(tipo_benefactor);
      paramCount++;
    }

    if (estado_registro) {
      query += ` AND estado_registro = $${paramCount}`;
      params.push(estado_registro);
      paramCount++;
    }

    query += ' ORDER BY id_benefactor DESC';

    // Paginación
    const offset = (page - 1) * limit;
    query += ` LIMIT $${paramCount} OFFSET $${paramCount + 1}`;
    params.push(limit, offset);

    const result = await client.query(query, params);

    // Contar total
    let countQuery = 'SELECT COUNT(*) as total FROM benefactores WHERE 1=1';
    const countParams = [];
    let countParamCount = 1;

    if (tipo_benefactor) {
      countQuery += ` AND tipo_benefactor = $${countParamCount}`;
      countParams.push(tipo_benefactor);
      countParamCount++;
    }

    if (estado_registro) {
      countQuery += ` AND estado_registro = $${countParamCount}`;
      countParams.push(estado_registro);
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
    console.error('Error al obtener benefactores:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener benefactores',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const obtenerBenefactorPorId = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    const result = await client.query(
      'SELECT * FROM benefactores WHERE id_benefactor = $1',
      [id]
    );
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Benefactor no encontrado',
      });
    }

    // Si es titular, obtener sus dependientes
    const benefactor = result.rows[0];
    if (benefactor.tipo_benefactor === 'TITULAR') {
      const dependientesResult = await client.query(
        `SELECT b.* FROM benefactores b
         INNER JOIN relaciones_dependientes rd ON b.id_benefactor = rd.id_dependiente
         WHERE rd.id_titular = $1`,
        [id]
      );
      benefactor.dependientes = dependientesResult.rows;
    }

    // Si es dependiente, obtener su titular
    if (benefactor.tipo_benefactor === 'DEPENDIENTE') {
      const titularResult = await client.query(
        `SELECT b.* FROM benefactores b
         INNER JOIN relaciones_dependientes rd ON b.id_benefactor = rd.id_titular
         WHERE rd.id_dependiente = $1`,
        [id]
      );
      if (titularResult.rows.length > 0) {
        benefactor.titular = titularResult.rows[0];
      }
    }

    res.json({
      success: true,
      data: benefactor,
    });
  } catch (error) {
    console.error('Error al obtener benefactor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener benefactor',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const crearBenefactor = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const {
      tipo_benefactor,
      tipo_afiliacion,
      cuenta,
      n_convenio,
      mes_prod,
      fecha_suscripcion,
      nombre_completo,
      cedula,
      nacionalidad,
      estado_civil,
      fecha_nacimiento,
      direccion,
      ciudad,
      provincia,
      telefono,
      email,
      num_cuenta_tc,
      tipo_cuenta,
      banco_emisor,
      inscripcion,
      aporte,
      observacion,
      estado,
    } = req.body;

    const id_usuario = req.usuario.id_usuario;

    // Verificar si la cédula ya existe
    if (cedula) {
      const cedulaExiste = await client.query(
        'SELECT id_benefactor FROM benefactores WHERE cedula = $1',
        [cedula]
      );

      if (cedulaExiste.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Ya existe un benefactor con esa cédula',
        });
      }
    }

    const result = await client.query(
      `INSERT INTO benefactores (
        tipo_benefactor, tipo_afiliacion, cuenta, n_convenio, mes_prod,
        fecha_suscripcion, nombre_completo, cedula, nacionalidad, estado_civil,
        fecha_nacimiento, direccion, ciudad, provincia, telefono, email,
        num_cuenta_tc, tipo_cuenta, banco_emisor, inscripcion, aporte,
        observacion, estado, id_usuario, estado_registro
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15,
        $16, $17, $18, $19, $20, $21, $22, $23, $24, 'PENDIENTE'
      ) RETURNING *`,
      [
        tipo_benefactor, tipo_afiliacion, cuenta, n_convenio, mes_prod,
        fecha_suscripcion, nombre_completo, cedula, nacionalidad, estado_civil,
        fecha_nacimiento, direccion, ciudad, provincia, telefono, email,
        num_cuenta_tc, tipo_cuenta, banco_emisor, inscripcion, aporte,
        observacion, estado, id_usuario,
      ]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Benefactor creado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al crear benefactor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear benefactor',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const actualizarBenefactor = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id } = req.params;

    // Verificar si el benefactor existe
    const benefactorExiste = await client.query(
      'SELECT id_benefactor FROM benefactores WHERE id_benefactor = $1',
      [id]
    );

    if (benefactorExiste.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Benefactor no encontrado',
      });
    }

    // Construir query dinámicamente
    const campos = [];
    const valores = [];
    let paramCount = 1;

    const camposPermitidos = [
      'tipo_benefactor', 'tipo_afiliacion', 'cuenta', 'n_convenio', 'mes_prod',
      'fecha_suscripcion', 'nombre_completo', 'cedula', 'nacionalidad', 'estado_civil',
      'fecha_nacimiento', 'direccion', 'ciudad', 'provincia', 'telefono', 'email',
      'num_cuenta_tc', 'tipo_cuenta', 'banco_emisor', 'inscripcion', 'aporte',
      'observacion', 'estado',
    ];

    for (const campo of camposPermitidos) {
      if (req.body[campo] !== undefined) {
        campos.push(`${campo} = $${paramCount}`);
        valores.push(req.body[campo]);
        paramCount++;
      }
    }

    if (campos.length === 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'No hay campos para actualizar',
      });
    }

    // Verificar cédula única si se está actualizando
    if (req.body.cedula) {
      const cedulaExiste = await client.query(
        'SELECT id_benefactor FROM benefactores WHERE cedula = $1 AND id_benefactor != $2',
        [req.body.cedula, id]
      );

      if (cedulaExiste.rows.length > 0) {
        await client.query('ROLLBACK');
        return res.status(400).json({
          success: false,
          message: 'Ya existe otro benefactor con esa cédula',
        });
      }
    }

    valores.push(id);
    const query = `UPDATE benefactores SET ${campos.join(', ')} WHERE id_benefactor = $${paramCount} RETURNING *`;

    const result = await client.query(query, valores);

    await client.query('COMMIT');

    res.json({
      success: true,
      message: 'Benefactor actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al actualizar benefactor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar benefactor',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const eliminarBenefactor = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    const benefactorExiste = await client.query(
      'SELECT id_benefactor FROM benefactores WHERE id_benefactor = $1',
      [id]
    );

    if (benefactorExiste.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Benefactor no encontrado',
      });
    }

    await client.query('DELETE FROM benefactores WHERE id_benefactor = $1', [id]);

    res.json({
      success: true,
      message: 'Benefactor eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar benefactor:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar benefactor',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const asignarDependiente = async (req, res) => {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const { id_titular, id_dependiente } = req.body;

    // Verificar que el titular existe y es TITULAR
    const titular = await client.query(
      'SELECT tipo_benefactor FROM benefactores WHERE id_benefactor = $1',
      [id_titular]
    );

    if (titular.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Titular no encontrado',
      });
    }

    if (titular.rows[0].tipo_benefactor !== 'TITULAR') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'El benefactor no es un titular',
      });
    }

    // Verificar que el dependiente existe y es DEPENDIENTE
    const dependiente = await client.query(
      'SELECT tipo_benefactor FROM benefactores WHERE id_benefactor = $1',
      [id_dependiente]
    );

    if (dependiente.rows.length === 0) {
      await client.query('ROLLBACK');
      return res.status(404).json({
        success: false,
        message: 'Dependiente no encontrado',
      });
    }

    if (dependiente.rows[0].tipo_benefactor !== 'DEPENDIENTE') {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'El benefactor no es un dependiente',
      });
    }

    // Verificar si ya existe la relación
    const relacionExiste = await client.query(
      'SELECT id_relacion FROM relaciones_dependientes WHERE id_titular = $1 AND id_dependiente = $2',
      [id_titular, id_dependiente]
    );

    if (relacionExiste.rows.length > 0) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        success: false,
        message: 'La relación ya existe',
      });
    }

    const result = await client.query(
      'INSERT INTO relaciones_dependientes (id_titular, id_dependiente) VALUES ($1, $2) RETURNING *',
      [id_titular, id_dependiente]
    );

    await client.query('COMMIT');

    res.status(201).json({
      success: true,
      message: 'Dependiente asignado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Error al asignar dependiente:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar dependiente',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const obtenerDependientes = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Verificar que el titular existe
    const titular = await client.query(
      'SELECT tipo_benefactor FROM benefactores WHERE id_benefactor = $1',
      [id]
    );

    if (titular.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Titular no encontrado',
      });
    }

    if (titular.rows[0].tipo_benefactor !== 'TITULAR') {
      return res.status(400).json({
        success: false,
        message: 'El benefactor no es un titular',
      });
    }

    const result = await client.query(
      `SELECT b.* FROM benefactores b
       INNER JOIN relaciones_dependientes rd ON b.id_benefactor = rd.id_dependiente
       WHERE rd.id_titular = $1
       ORDER BY b.nombre_completo`,
      [id]
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error al obtener dependientes:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener dependientes',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// Controlador para subir contrato PDF
const subirContrato = async (req, res) => {
  try {
    const { id } = req.params;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó ningún archivo',
      });
    }

    // Verificar que el benefactor existe
    const benefactorResult = await pool.query(
      'SELECT id_benefactor FROM benefactores WHERE id_benefactor = $1',
      [id]
    );

    if (benefactorResult.rows.length === 0) {
      // Eliminar el archivo subido si el benefactor no existe
      fs.unlinkSync(req.file.path);
      return res.status(404).json({
        success: false,
        message: 'Benefactor no encontrado',
      });
    }

    res.json({
      success: true,
      message: 'Contrato subido exitosamente',
      data: {
        filename: req.file.filename,
        path: `/api/benefactores/${id}/contrato`,
      },
    });
  } catch (error) {
    console.error('Error al subir contrato:', error);
    // Eliminar archivo si hubo error
    if (req.file) {
      fs.unlinkSync(req.file.path);
    }
    res.status(500).json({
      success: false,
      message: 'Error al subir contrato',
      error: error.message,
    });
  }
};

// Controlador para obtener/descargar contrato PDF
const obtenerContrato = async (req, res) => {
  try {
    const { id } = req.params;

    // Buscar archivo con cualquier extensión (aunque solo permitimos PDF)
    const uploadPath = path.join(__dirname, '../../uploads/contratos');
    const files = fs.readdirSync(uploadPath);
    const contratoFile = files.find(file => file.startsWith(`contrato-${id}`));

    if (!contratoFile) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el contrato para este benefactor',
      });
    }

    const filePath = path.join(uploadPath, contratoFile);
    
    // Enviar el archivo
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="${contratoFile}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Error al obtener contrato:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener contrato',
      error: error.message,
    });
  }
};

// Controlador para eliminar contrato PDF
const eliminarContrato = async (req, res) => {
  try {
    const { id } = req.params;

    const uploadPath = path.join(__dirname, '../../uploads/contratos');
    const files = fs.readdirSync(uploadPath);
    const contratoFile = files.find(file => file.startsWith(`contrato-${id}`));

    if (!contratoFile) {
      return res.status(404).json({
        success: false,
        message: 'No se encontró el contrato para este benefactor',
      });
    }

    const filePath = path.join(uploadPath, contratoFile);
    fs.unlinkSync(filePath);

    res.json({
      success: true,
      message: 'Contrato eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar contrato:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar contrato',
      error: error.message,
    });
  }
};

module.exports = {
  obtenerBenefactores,
  obtenerBenefactorPorId,
  crearBenefactor,
  actualizarBenefactor,
  eliminarBenefactor,
  asignarDependiente,
  obtenerDependientes,
  subirContrato,
  obtenerContrato,
  eliminarContrato,
};
