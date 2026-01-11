const pool = require('../config/database');

const obtenerRoles = async (req, res) => {
  const client = await pool.connect();
  try {
    const result = await client.query('SELECT * FROM roles ORDER BY nombre');
    
    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error al obtener roles:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener roles',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const obtenerRolPorId = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const result = await client.query('SELECT * FROM roles WHERE id_rol = $1', [id]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }

    res.json({
      success: true,
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al obtener rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener rol',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const crearRol = async (req, res) => {
  const client = await pool.connect();
  try {
    const { nombre } = req.body;

    // Verificar si el rol ya existe
    const rolExistente = await client.query(
      'SELECT id_rol FROM roles WHERE nombre = $1',
      [nombre]
    );

    if (rolExistente.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El rol ya existe',
      });
    }

    const result = await client.query(
      'INSERT INTO roles (nombre) VALUES ($1) RETURNING *',
      [nombre]
    );

    res.status(201).json({
      success: true,
      message: 'Rol creado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al crear rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear rol',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const actualizarRol = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { nombre } = req.body;

    // Verificar si el rol existe
    const rolExiste = await client.query('SELECT id_rol FROM roles WHERE id_rol = $1', [id]);
    
    if (rolExiste.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }

    // Verificar si el nuevo nombre ya existe en otro rol
    const nombreExiste = await client.query(
      'SELECT id_rol FROM roles WHERE nombre = $1 AND id_rol != $2',
      [nombre, id]
    );

    if (nombreExiste.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Ya existe un rol con ese nombre',
      });
    }

    const result = await client.query(
      'UPDATE roles SET nombre = $1 WHERE id_rol = $2 RETURNING *',
      [nombre, id]
    );

    res.json({
      success: true,
      message: 'Rol actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al actualizar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar rol',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const eliminarRol = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;

    // Verificar si el rol existe
    const rolExiste = await client.query('SELECT id_rol FROM roles WHERE id_rol = $1', [id]);
    
    if (rolExiste.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }

    // Verificar si hay usuarios con este rol
    const usuariosConRol = await client.query(
      'SELECT COUNT(*) as count FROM usuario_roles WHERE id_rol = $1',
      [id]
    );

    if (parseInt(usuariosConRol.rows[0].count) > 0) {
      return res.status(400).json({
        success: false,
        message: 'No se puede eliminar el rol porque hay usuarios asignados a él',
      });
    }

    await client.query('DELETE FROM roles WHERE id_rol = $1', [id]);

    res.json({
      success: true,
      message: 'Rol eliminado exitosamente',
    });
  } catch (error) {
    console.error('Error al eliminar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al eliminar rol',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  obtenerRoles,
  obtenerRolPorId,
  crearRol,
  actualizarRol,
  eliminarRol,
};
