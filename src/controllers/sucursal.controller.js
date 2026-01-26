const pool = require('../config/database');

class SucursalController {
  
  // Listar todas las sucursales
  async listarSucursales(req, res) {
    try {
      const result = await pool.query(`
        SELECT 
          s.id_sucursal,
          s.iniciales,
          s.nombre,
          s.activo,
          s.fecha_creacion,
          s.fecha_modificacion,
          COUNT(u.id_usuario) AS total_usuarios
        FROM sucursales s
        LEFT JOIN usuarios u ON s.id_sucursal = u.id_sucursal
        GROUP BY s.id_sucursal, s.iniciales, s.nombre, s.activo, s.fecha_creacion, s.fecha_modificacion
        ORDER BY s.nombre
      `);

      res.json({
        success: true,
        data: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Error al listar sucursales:', error);
      res.status(500).json({
        success: false,
        message: 'Error al listar sucursales',
        error: error.message
      });
    }
  }

  // Obtener sucursal por ID
  async obtenerSucursalPorId(req, res) {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT 
          s.id_sucursal,
          s.iniciales,
          s.nombre,
          s.activo,
          s.fecha_creacion,
          s.fecha_modificacion,
          COUNT(u.id_usuario) AS total_usuarios
        FROM sucursales s
        LEFT JOIN usuarios u ON s.id_sucursal = u.id_sucursal
        WHERE s.id_sucursal = $1
        GROUP BY s.id_sucursal, s.iniciales, s.nombre, s.activo, s.fecha_creacion, s.fecha_modificacion
      `, [id]);

      if (result.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Sucursal no encontrada'
        });
      }

      res.json({
        success: true,
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error al obtener sucursal:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener sucursal',
        error: error.message
      });
    }
  }

  // Crear nueva sucursal
  async crearSucursal(req, res) {
    try {
      const { iniciales, nombre, activo = true } = req.body;

      // Verificar que las iniciales no existan
      const existente = await pool.query(
        'SELECT id_sucursal FROM sucursales WHERE iniciales = $1',
        [iniciales]
      );

      if (existente.rows.length > 0) {
        return res.status(400).json({
          success: false,
          message: 'Ya existe una sucursal con estas iniciales'
        });
      }

      const result = await pool.query(`
        INSERT INTO sucursales (iniciales, nombre, activo)
        VALUES ($1, $2, $3)
        RETURNING id_sucursal, iniciales, nombre, activo, fecha_creacion
      `, [iniciales, nombre, activo]);

      res.status(201).json({
        success: true,
        message: 'Sucursal creada exitosamente',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error al crear sucursal:', error);
      res.status(500).json({
        success: false,
        message: 'Error al crear sucursal',
        error: error.message
      });
    }
  }

  // Actualizar sucursal
  async actualizarSucursal(req, res) {
    try {
      const { id } = req.params;
      const { iniciales, nombre, activo } = req.body;

      // Verificar que la sucursal existe
      const existente = await pool.query(
        'SELECT id_sucursal FROM sucursales WHERE id_sucursal = $1',
        [id]
      );

      if (existente.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Sucursal no encontrada'
        });
      }

      // Si se cambian las iniciales, verificar que no existan
      if (iniciales) {
        const conMismasIniciales = await pool.query(
          'SELECT id_sucursal FROM sucursales WHERE iniciales = $1 AND id_sucursal != $2',
          [iniciales, id]
        );

        if (conMismasIniciales.rows.length > 0) {
          return res.status(400).json({
            success: false,
            message: 'Ya existe otra sucursal con estas iniciales'
          });
        }
      }

      // Construir la query de actualización dinámicamente
      const campos = [];
      const valores = [];
      let paramCount = 1;

      if (iniciales !== undefined) {
        campos.push(`iniciales = $${paramCount++}`);
        valores.push(iniciales);
      }
      if (nombre !== undefined) {
        campos.push(`nombre = $${paramCount++}`);
        valores.push(nombre);
      }
      if (activo !== undefined) {
        campos.push(`activo = $${paramCount++}`);
        valores.push(activo);
      }

      campos.push(`fecha_modificacion = CURRENT_TIMESTAMP`);
      valores.push(id);

      const query = `
        UPDATE sucursales 
        SET ${campos.join(', ')}
        WHERE id_sucursal = $${paramCount}
        RETURNING id_sucursal, iniciales, nombre, activo, fecha_creacion, fecha_modificacion
      `;

      const result = await pool.query(query, valores);

      res.json({
        success: true,
        message: 'Sucursal actualizada exitosamente',
        data: result.rows[0]
      });
    } catch (error) {
      console.error('Error al actualizar sucursal:', error);
      res.status(500).json({
        success: false,
        message: 'Error al actualizar sucursal',
        error: error.message
      });
    }
  }

  // Eliminar sucursal (soft delete - marcar como inactiva)
  async eliminarSucursal(req, res) {
    try {
      const { id } = req.params;

      // Verificar que la sucursal existe
      const existente = await pool.query(
        'SELECT id_sucursal FROM sucursales WHERE id_sucursal = $1',
        [id]
      );

      if (existente.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Sucursal no encontrada'
        });
      }

      // Verificar si tiene usuarios asignados
      const usuariosAsignados = await pool.query(
        'SELECT COUNT(*) FROM usuarios WHERE id_sucursal = $1',
        [id]
      );

      if (parseInt(usuariosAsignados.rows[0].count) > 0) {
        return res.status(400).json({
          success: false,
          message: 'No se puede eliminar una sucursal con usuarios asignados. Reasigne los usuarios primero.'
        });
      }

      // Soft delete - marcar como inactiva
      await pool.query(
        'UPDATE sucursales SET activo = FALSE, fecha_modificacion = CURRENT_TIMESTAMP WHERE id_sucursal = $1',
        [id]
      );

      res.json({
        success: true,
        message: 'Sucursal desactivada exitosamente'
      });
    } catch (error) {
      console.error('Error al eliminar sucursal:', error);
      res.status(500).json({
        success: false,
        message: 'Error al eliminar sucursal',
        error: error.message
      });
    }
  }

  // Asignar sucursal a usuario
  async asignarSucursalUsuario(req, res) {
    try {
      const { id_usuario, id_sucursal } = req.body;

      // Verificar que el usuario existe
      const usuario = await pool.query(
        'SELECT id_usuario FROM usuarios WHERE id_usuario = $1',
        [id_usuario]
      );

      if (usuario.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Usuario no encontrado'
        });
      }

      // Verificar que la sucursal existe y está activa
      const sucursal = await pool.query(
        'SELECT id_sucursal, iniciales, nombre FROM sucursales WHERE id_sucursal = $1 AND activo = TRUE',
        [id_sucursal]
      );

      if (sucursal.rows.length === 0) {
        return res.status(404).json({
          success: false,
          message: 'Sucursal no encontrada o inactiva'
        });
      }

      // Actualizar el usuario con la nueva sucursal
      await pool.query(
        'UPDATE usuarios SET id_sucursal = $1 WHERE id_usuario = $2',
        [id_sucursal, id_usuario]
      );

      res.json({
        success: true,
        message: 'Sucursal asignada al usuario exitosamente',
        data: {
          id_usuario,
          sucursal: sucursal.rows[0]
        }
      });
    } catch (error) {
      console.error('Error al asignar sucursal a usuario:', error);
      res.status(500).json({
        success: false,
        message: 'Error al asignar sucursal a usuario',
        error: error.message
      });
    }
  }

  // Obtener usuarios de una sucursal
  async obtenerUsuariosSucursal(req, res) {
    try {
      const { id } = req.params;

      const result = await pool.query(`
        SELECT 
          u.id_usuario,
          u.nombre_usuario,
          u.fecha_creacion,
          COALESCE(
            json_agg(
              json_build_object(
                'id_rol', r.id_rol,
                'nombre', r.nombre
              )
            ) FILTER (WHERE r.id_rol IS NOT NULL),
            '[]'
          ) AS roles
        FROM usuarios u
        LEFT JOIN usuario_roles ur ON u.id_usuario = ur.id_usuario
        LEFT JOIN roles r ON ur.id_rol = r.id_rol
        WHERE u.id_sucursal = $1
        GROUP BY u.id_usuario, u.nombre_usuario, u.fecha_creacion
        ORDER BY u.nombre_usuario
      `, [id]);

      res.json({
        success: true,
        data: result.rows,
        total: result.rows.length
      });
    } catch (error) {
      console.error('Error al obtener usuarios de sucursal:', error);
      res.status(500).json({
        success: false,
        message: 'Error al obtener usuarios de sucursal',
        error: error.message
      });
    }
  }
}

module.exports = new SucursalController();
