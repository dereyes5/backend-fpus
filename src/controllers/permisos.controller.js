const fs = require('fs').promises;
const path = require('path');
const pool = require('../config/database');

const PERMISOS_FILE = path.join(__dirname, '../config/permisos.json');

// Leer archivo de permisos
const leerPermisos = async () => {
  try {
    const data = await fs.readFile(PERMISOS_FILE, 'utf8');
    return JSON.parse(data);
  } catch (error) {
    console.error('Error al leer permisos:', error);
    throw error;
  }
};

// Escribir archivo de permisos
const escribirPermisos = async (permisos) => {
  try {
    await fs.writeFile(PERMISOS_FILE, JSON.stringify(permisos, null, 2), 'utf8');
  } catch (error) {
    console.error('Error al escribir permisos:', error);
    throw error;
  }
};

// Obtener lista de recursos disponibles
const obtenerRecursos = async (req, res) => {
  try {
    const permisos = await leerPermisos();
    
    res.json({
      success: true,
      data: permisos.recursos,
    });
  } catch (error) {
    console.error('Error al obtener recursos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener recursos',
      error: error.message,
    });
  }
};

// Obtener permisos de un rol específico
const obtenerPermisosRol = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    
    // Verificar que el rol existe en la base de datos
    const rolExiste = await client.query('SELECT * FROM roles WHERE id_rol = $1', [id]);
    
    if (rolExiste.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }

    const permisos = await leerPermisos();
    const permisosRol = permisos.permisos_por_rol[id];

    if (!permisosRol) {
      // Si el rol no tiene permisos configurados, crear permisos por defecto
      const permisosDefault = {
        id_rol: parseInt(id),
        nombre: rolExiste.rows[0].nombre,
        permisos: {}
      };

      // Inicializar todos los recursos con permisos en false
      permisos.recursos.forEach(recurso => {
        permisosDefault.permisos[recurso.id] = { ver: false, editar: false };
      });

      permisos.permisos_por_rol[id] = permisosDefault;
      await escribirPermisos(permisos);

      return res.json({
        success: true,
        data: permisosDefault,
      });
    }

    res.json({
      success: true,
      data: permisosRol,
    });
  } catch (error) {
    console.error('Error al obtener permisos del rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener permisos del rol',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// Obtener todos los permisos (todos los roles)
const obtenerTodosPermisos = async (req, res) => {
  try {
    const permisos = await leerPermisos();
    
    res.json({
      success: true,
      data: {
        recursos: permisos.recursos,
        permisos_por_rol: permisos.permisos_por_rol,
      },
    });
  } catch (error) {
    console.error('Error al obtener permisos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener permisos',
      error: error.message,
    });
  }
};

// Actualizar permisos de un rol
const actualizarPermisosRol = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id } = req.params;
    const { permisos: nuevosPermisos } = req.body;

    // Verificar que el rol existe
    const rolExiste = await client.query('SELECT * FROM roles WHERE id_rol = $1', [id]);
    
    if (rolExiste.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }

    // Validar formato de permisos
    if (!nuevosPermisos || typeof nuevosPermisos !== 'object') {
      return res.status(400).json({
        success: false,
        message: 'Formato de permisos inválido',
      });
    }

    const permisos = await leerPermisos();
    
    // Actualizar permisos del rol
    permisos.permisos_por_rol[id] = {
      id_rol: parseInt(id),
      nombre: rolExiste.rows[0].nombre,
      permisos: nuevosPermisos,
    };

    await escribirPermisos(permisos);

    res.json({
      success: true,
      message: 'Permisos actualizados exitosamente',
      data: permisos.permisos_por_rol[id],
    });
  } catch (error) {
    console.error('Error al actualizar permisos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al actualizar permisos',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

// Obtener permisos del usuario actual (basado en su rol)
const obtenerMisPermisos = async (req, res) => {
  try {
    const { roles } = req.usuario;
    
    if (!roles || roles.length === 0) {
      return res.json({
        success: true,
        data: {
          permisos: {},
        },
      });
    }

    const permisos = await leerPermisos();
    
    // Obtener permisos del primer rol del usuario
    const idRol = roles[0].id_rol;
    const permisosRol = permisos.permisos_por_rol[idRol];

    res.json({
      success: true,
      data: {
        rol: roles[0],
        permisos: permisosRol?.permisos || {},
        recursos: permisos.recursos,
      },
    });
  } catch (error) {
    console.error('Error al obtener mis permisos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener permisos',
      error: error.message,
    });
  }
};

module.exports = {
  obtenerRecursos,
  obtenerPermisosRol,
  obtenerTodosPermisos,
  actualizarPermisosRol,
  obtenerMisPermisos,
};
