const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
require('dotenv').config();

const login = async (req, res) => {
  const client = await pool.connect();
  try {
    const { nombre_usuario, password } = req.body;

    // Buscar usuario
    const userResult = await client.query(
      'SELECT * FROM usuarios WHERE nombre_usuario = $1',
      [nombre_usuario]
    );

    if (userResult.rows.length === 0) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
      });
    }

    const usuario = userResult.rows[0];

    // Verificar contraseña
    const passwordValida = await bcrypt.compare(password, usuario.password_hash);
    
    if (!passwordValida) {
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
      });
    }

    // Obtener roles del usuario
    const rolesResult = await client.query(
      `SELECT r.id_rol, r.nombre 
       FROM roles r
       INNER JOIN usuario_roles ur ON r.id_rol = ur.id_rol
       WHERE ur.id_usuario = $1`,
      [usuario.id_usuario]
    );

    // Generar token
    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        nombre_usuario: usuario.nombre_usuario,
        roles: rolesResult.rows,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        token,
        usuario: {
          id_usuario: usuario.id_usuario,
          nombre_usuario: usuario.nombre_usuario,
          roles: rolesResult.rows,
        },
      },
    });
  } catch (error) {
    console.error('Error en login:', error);
    res.status(500).json({
      success: false,
      message: 'Error al iniciar sesión',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const crearUsuario = async (req, res) => {
  const client = await pool.connect();
  try {
    const { nombre_usuario, password } = req.body;

    // Verificar si el usuario ya existe
    const usuarioExistente = await client.query(
      'SELECT id_usuario FROM usuarios WHERE nombre_usuario = $1',
      [nombre_usuario]
    );

    if (usuarioExistente.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El nombre de usuario ya existe',
      });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
    const result = await client.query(
      'INSERT INTO usuarios (nombre_usuario, password_hash) VALUES ($1, $2) RETURNING id_usuario, nombre_usuario',
      [nombre_usuario, passwordHash]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: {
        id_usuario: result.rows[0].id_usuario,
        nombre_usuario: result.rows[0].nombre_usuario,
      },
    });
  } catch (error) {
    console.error('Error al crear usuario:', error);
    res.status(500).json({
      success: false,
      message: 'Error al crear usuario',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const asignarRol = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_usuario, id_rol } = req.body;

    // Verificar que el usuario existe
    const usuarioExiste = await client.query(
      'SELECT id_usuario FROM usuarios WHERE id_usuario = $1',
      [id_usuario]
    );

    if (usuarioExiste.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Verificar que el rol existe
    const rolExiste = await client.query(
      'SELECT id_rol FROM roles WHERE id_rol = $1',
      [id_rol]
    );

    if (rolExiste.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Rol no encontrado',
      });
    }

    // Verificar si ya tiene el rol asignado
    const rolAsignado = await client.query(
      'SELECT * FROM usuario_roles WHERE id_usuario = $1 AND id_rol = $2',
      [id_usuario, id_rol]
    );

    if (rolAsignado.rows.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'El usuario ya tiene este rol asignado',
      });
    }

    // Asignar rol
    await client.query(
      'INSERT INTO usuario_roles (id_usuario, id_rol) VALUES ($1, $2)',
      [id_usuario, id_rol]
    );

    res.status(201).json({
      success: true,
      message: 'Rol asignado exitosamente',
    });
  } catch (error) {
    console.error('Error al asignar rol:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar rol',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const obtenerPerfil = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_usuario } = req.usuario;

    // Obtener información del usuario
    const userResult = await client.query(
      'SELECT id_usuario, nombre_usuario FROM usuarios WHERE id_usuario = $1',
      [id_usuario]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Obtener roles
    const rolesResult = await client.query(
      `SELECT r.id_rol, r.nombre 
       FROM roles r
       INNER JOIN usuario_roles ur ON r.id_rol = ur.id_rol
       WHERE ur.id_usuario = $1`,
      [id_usuario]
    );

    res.json({
      success: true,
      data: {
        id_usuario: userResult.rows[0].id_usuario,
        nombre_usuario: userResult.rows[0].nombre_usuario,
        roles: rolesResult.rows,
      },
    });
  } catch (error) {
    console.error('Error al obtener perfil:', error);
    res.status(500).json({
      success: false,
      message: 'Error al obtener perfil',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const cambiarPassword = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_usuario } = req.usuario;
    const { password_actual, password_nueva } = req.body;

    // Obtener usuario actual
    const userResult = await client.query(
      'SELECT password_hash FROM usuarios WHERE id_usuario = $1',
      [id_usuario]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    const usuario = userResult.rows[0];

    // Verificar contraseña actual
    const passwordValida = await bcrypt.compare(password_actual, usuario.password_hash);
    
    if (!passwordValida) {
      return res.status(401).json({
        success: false,
        message: 'La contraseña actual es incorrecta',
      });
    }

    // Hash de la nueva contraseña
    const passwordHash = await bcrypt.hash(password_nueva, 10);

    // Actualizar contraseña
    await client.query(
      'UPDATE usuarios SET password_hash = $1 WHERE id_usuario = $2',
      [passwordHash, id_usuario]
    );

    res.json({
      success: true,
      message: 'Contraseña actualizada exitosamente',
    });
  } catch (error) {
    console.error('Error al cambiar contraseña:', error);
    res.status(500).json({
      success: false,
      message: 'Error al cambiar contraseña',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const listarUsuarios = async (req, res) => {
  const client = await pool.connect();
  try {
    // Obtener usuarios con sus roles y sucursal
    const result = await client.query(
      `SELECT 
        u.id_usuario,
        u.nombre_usuario,
        u.id_sucursal,
        s.iniciales as sucursal_iniciales,
        s.nombre as sucursal_nombre,
        COALESCE(
          json_agg(
            json_build_object(
              'id_rol', r.id_rol,
              'nombre', r.nombre
            )
          ) FILTER (WHERE r.id_rol IS NOT NULL),
          '[]'
        ) as roles,
        CASE 
          WHEN s.id_sucursal IS NOT NULL THEN
            json_build_object(
              'id_sucursal', s.id_sucursal,
              'iniciales', s.iniciales,
              'nombre', s.nombre
            )
          ELSE NULL
        END as sucursal
      FROM usuarios u
      LEFT JOIN usuario_roles ur ON u.id_usuario = ur.id_usuario
      LEFT JOIN roles r ON ur.id_rol = r.id_rol
      LEFT JOIN sucursales s ON u.id_sucursal = s.id_sucursal
      GROUP BY u.id_usuario, u.nombre_usuario, u.id_sucursal, s.id_sucursal, s.iniciales, s.nombre
      ORDER BY u.id_usuario`
    );

    res.json({
      success: true,
      data: result.rows,
    });
  } catch (error) {
    console.error('Error al listar usuarios:', error);
    res.status(500).json({
      success: false,
      message: 'Error al listar usuarios',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

module.exports = {
  login,
  crearUsuario,
  asignarRol,
  obtenerPerfil,
  cambiarPassword,
  listarUsuarios,
};
