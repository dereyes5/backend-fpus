const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const pool = require('../config/database');
const logger = require('../config/logger');
const path = require('path');
const fs = require('fs');
require('dotenv').config();

const normalizeCargo = (cargo) => {
  const raw = (cargo || '').toString().trim().toUpperCase();
  return raw || 'AGENTE';
};

const login = async (req, res) => {
  const client = await pool.connect();
  try {
    const { nombre_usuario, password, cargo } = req.body;
    const cargoNormalizado = normalizeCargo(cargo);

    logger.info('Login attempt', { username: nombre_usuario, ip: req.ip });

    // Buscar usuario
    const userResult = await client.query(
      `SELECT id_usuario, nombre_usuario, password_hash, cargo, activo
       FROM usuarios
       WHERE nombre_usuario = $1`,
      [nombre_usuario]
    );

    if (userResult.rows.length === 0) {
      logger.warn('Login failed - user not found', { username: nombre_usuario });
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
      });
    }

    const usuario = userResult.rows[0];

    if (usuario.activo === false) {
      logger.warn('Login blocked - inactive user', {
        username: nombre_usuario,
        userId: usuario.id_usuario,
      });
      return res.status(403).json({
        success: false,
        message: 'Usuario inactivo. Contacta al administrador.',
      });
    }

    // Verificar contraseña
    const passwordValida = await bcrypt.compare(password, usuario.password_hash);

    if (!passwordValida) {
      logger.warn('Login failed - invalid password', {
        username: nombre_usuario,
        userId: usuario.id_usuario,
      });
      return res.status(401).json({
        success: false,
        message: 'Credenciales inválidas',
      });
    }

    // Obtener permisos del usuario
    logger.debug('Fetching user permissions', { userId: usuario.id_usuario });
    const permisosResult = await client.query(
      `SELECT
        cartera_lectura,
        cartera_escritura,
        benefactores_ingresar,
        benefactores_administrar,
        social_ingresar,
        social_administrar,
        configuraciones,
        aprobaciones,
        aprobaciones_social
       FROM permisos_usuario
       WHERE id_usuario = $1`,
      [usuario.id_usuario]
    );

    // Si el usuario no tiene permisos asignados, crear permisos por defecto (todos en false)
    let permisos;
    if (permisosResult.rows.length === 0) {
      logger.info('Creating default permissions for user', { userId: usuario.id_usuario });
      await client.query(
        `INSERT INTO permisos_usuario (id_usuario) VALUES ($1)`,
        [usuario.id_usuario]
      );
      permisos = {
        cartera_lectura: false,
        cartera_escritura: false,
        benefactores_ingresar: false,
        benefactores_administrar: false,
        social_ingresar: false,
        social_administrar: false,
        configuraciones: false,
        aprobaciones: false,
        aprobaciones_social: false,
      };
    } else {
      permisos = permisosResult.rows[0];
    }

    // Generar token
    const token = jwt.sign(
      {
        id_usuario: usuario.id_usuario,
        nombre_usuario: usuario.nombre_usuario,
        cargo: usuario.cargo || 'AGENTE',
        activo: usuario.activo !== false,
        permisos,
      },
      process.env.JWT_SECRET,
      { expiresIn: process.env.JWT_EXPIRES_IN || '24h' }
    );

    logger.info('Login successful', {
      userId: usuario.id_usuario,
      username: usuario.nombre_usuario,
      ip: req.ip,
      hasPermissions: Object.keys(permisos).filter(p => permisos[p]).length > 0,
    });

    res.json({
      success: true,
      message: 'Login exitoso',
      data: {
        token,
        usuario: {
          id_usuario: usuario.id_usuario,
          nombre_usuario: usuario.nombre_usuario,
          cargo: usuario.cargo || 'AGENTE',
          activo: usuario.activo !== false,
          permisos,
        },
      },
    });
  } catch (error) {
    logger.logError(error, {
      action: 'login',
      username: req.body.nombre_usuario,
    });
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
    const { nombre_usuario, password, cargo } = req.body;
    const cargoNormalizado = normalizeCargo(cargo);

    logger.info('Creating new user', {
      username: nombre_usuario,
      createdBy: req.usuario?.id_usuario,
    });

    // Verificar si el usuario ya existe
    const usuarioExistente = await client.query(
      'SELECT id_usuario FROM usuarios WHERE nombre_usuario = $1',
      [nombre_usuario]
    );

    if (usuarioExistente.rows.length > 0) {
      logger.warn('User creation failed - user already exists', { username: nombre_usuario });
      return res.status(400).json({
        success: false,
        message: 'El nombre de usuario ya existe',
      });
    }

    // Hash de la contraseña
    const passwordHash = await bcrypt.hash(password, 10);

    // Crear usuario
    const result = await client.query(
      `INSERT INTO usuarios (nombre_usuario, password_hash, cargo, activo)
       VALUES ($1, $2, $3, TRUE)
       RETURNING id_usuario, nombre_usuario, cargo, activo`,
      [nombre_usuario, passwordHash, cargoNormalizado]
    );

    res.status(201).json({
      success: true,
      message: 'Usuario creado exitosamente',
      data: {
        id_usuario: result.rows[0].id_usuario,
        nombre_usuario: result.rows[0].nombre_usuario,
        cargo: result.rows[0].cargo || 'AGENTE',
        activo: result.rows[0].activo !== false,
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

const asignarPermisos = async (req, res) => {
  const client = await pool.connect();
  try {
    const { id_usuario } = req.params;
    const {
      cartera_lectura,
      cartera_escritura,
      benefactores_ingresar,
      benefactores_administrar,
      social_ingresar,
      social_administrar,
      configuraciones,
      aprobaciones,
      aprobaciones_social,
    } = req.body;

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

    // Insertar o actualizar permisos
    await client.query(
      `INSERT INTO permisos_usuario (
        id_usuario,
        cartera_lectura,
        cartera_escritura,
        benefactores_ingresar,
        benefactores_administrar,
        social_ingresar,
        social_administrar,
        configuraciones,
        aprobaciones,
        aprobaciones_social
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
      ON CONFLICT (id_usuario)
      DO UPDATE SET
        cartera_lectura = $2,
        cartera_escritura = $3,
        benefactores_ingresar = $4,
        benefactores_administrar = $5,
        social_ingresar = $6,
        social_administrar = $7,
        configuraciones = $8,
        aprobaciones = $9,
        aprobaciones_social = $10,
        fecha_actualizacion = NOW()`,
      [
        id_usuario,
        cartera_lectura || false,
        cartera_escritura || false,
        benefactores_ingresar || false,
        benefactores_administrar || false,
        social_ingresar || false,
        social_administrar || false,
        configuraciones || false,
        aprobaciones || false,
        aprobaciones_social || false,
      ]
    );

    res.status(200).json({
      success: true,
      message: 'Permisos asignados exitosamente',
    });
  } catch (error) {
    console.error('Error al asignar permisos:', error);
    res.status(500).json({
      success: false,
      message: 'Error al asignar permisos',
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
      'SELECT id_usuario, nombre_usuario, cargo, activo FROM usuarios WHERE id_usuario = $1',
      [id_usuario]
    );

    if (userResult.rows.length === 0) {
      return res.status(404).json({
        success: false,
        message: 'Usuario no encontrado',
      });
    }

    // Obtener permisos
    const permisosResult = await client.query(
      `SELECT
        cartera_lectura,
        cartera_escritura,
        benefactores_ingresar,
        benefactores_administrar,
        social_ingresar,
        social_administrar,
        configuraciones,
        aprobaciones,
        aprobaciones_social
       FROM permisos_usuario
       WHERE id_usuario = $1`,
      [id_usuario]
    );

    const permisos = permisosResult.rows.length > 0
      ? permisosResult.rows[0]
      : {
          cartera_lectura: false,
          cartera_escritura: false,
          benefactores_ingresar: false,
          benefactores_administrar: false,
          social_ingresar: false,
          social_administrar: false,
          configuraciones: false,
          aprobaciones: false,
          aprobaciones_social: false,
        };

    res.json({
      success: true,
      data: {
        id_usuario: userResult.rows[0].id_usuario,
        nombre_usuario: userResult.rows[0].nombre_usuario,
        cargo: userResult.rows[0].cargo || 'AGENTE',
        activo: userResult.rows[0].activo !== false,
        permisos,
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
    const incluirInactivos = req.query.incluir_inactivos === 'true';
    // Obtener usuarios con sus permisos
    const result = await client.query(
      `SELECT
        u.id_usuario,
        u.nombre_usuario,
        u.cargo,
        u.activo,
        u.fecha_inactivacion,
        u.id_usuario_inactiva,
        u.id_sucursal,
        s.iniciales as sucursal_iniciales,
        s.nombre as sucursal_nombre,
        CASE
          WHEN s.id_sucursal IS NOT NULL THEN
            json_build_object(
              'id_sucursal', s.id_sucursal,
              'iniciales', s.iniciales,
              'nombre', s.nombre
            )
          ELSE NULL
        END as sucursal,
        CASE
          WHEN p.id_permiso IS NOT NULL THEN
            json_build_object(
              'cartera_lectura', p.cartera_lectura,
              'cartera_escritura', p.cartera_escritura,
              'benefactores_ingresar', p.benefactores_ingresar,
              'benefactores_administrar', p.benefactores_administrar,
              'social_ingresar', p.social_ingresar,
              'social_administrar', p.social_administrar,
              'configuraciones', p.configuraciones,
              'aprobaciones', p.aprobaciones,
              'aprobaciones_social', p.aprobaciones_social
            )
          ELSE NULL
        END as permisos
      FROM usuarios u
      LEFT JOIN permisos_usuario p ON u.id_usuario = p.id_usuario
      LEFT JOIN sucursales s ON u.id_sucursal = s.id_sucursal
      WHERE ($1::boolean = true OR COALESCE(u.activo, true) = true)
      ORDER BY u.id_usuario`,
      [incluirInactivos]
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

const actualizarCargoPerfil = async (req, res) => {
  return res.status(403).json({
    success: false,
    message: 'El cargo solo puede ser actualizado por un administrador',
  });
};

const actualizarUsuarioAdmin = async (req, res) => {
  const client = await pool.connect();
  try {
    const idUsuarioObjetivo = Number(req.params.id_usuario);
    const nombreUsuario = (req.body?.nombre_usuario || '').toString().trim();
    const cargo = normalizeCargo(req.body?.cargo);

    if (!idUsuarioObjetivo || Number.isNaN(idUsuarioObjetivo)) {
      return res.status(400).json({ success: false, message: 'ID de usuario invalido' });
    }
    if (!nombreUsuario) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario es obligatorio' });
    }

    const conflict = await client.query(
      `SELECT id_usuario
       FROM usuarios
       WHERE nombre_usuario = $1 AND id_usuario <> $2`,
      [nombreUsuario, idUsuarioObjetivo]
    );
    if (conflict.rows.length > 0) {
      return res.status(400).json({ success: false, message: 'El nombre de usuario ya existe' });
    }

    const result = await client.query(
      `UPDATE usuarios
       SET nombre_usuario = $1,
           cargo = $2
       WHERE id_usuario = $3
       RETURNING id_usuario, nombre_usuario, cargo, activo, fecha_inactivacion`,
      [nombreUsuario, cargo, idUsuarioObjetivo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    return res.json({
      success: true,
      message: 'Usuario actualizado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al actualizar usuario (admin):', error);
    return res.status(500).json({
      success: false,
      message: 'Error al actualizar usuario',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const cambiarPasswordUsuarioAdmin = async (req, res) => {
  const client = await pool.connect();
  try {
    const idUsuarioObjetivo = Number(req.params.id_usuario);
    const passwordNueva = (req.body?.password_nueva || '').toString();

    if (!idUsuarioObjetivo || Number.isNaN(idUsuarioObjetivo)) {
      return res.status(400).json({ success: false, message: 'ID de usuario invalido' });
    }
    if (passwordNueva.length < 6) {
      return res.status(400).json({ success: false, message: 'La contrasena nueva debe tener al menos 6 caracteres' });
    }

    const passwordHash = await bcrypt.hash(passwordNueva, 10);
    const result = await client.query(
      `UPDATE usuarios
       SET password_hash = $1
       WHERE id_usuario = $2
       RETURNING id_usuario`,
      [passwordHash, idUsuarioObjetivo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    return res.json({
      success: true,
      message: 'Contrasena restablecida exitosamente',
    });
  } catch (error) {
    console.error('Error al restablecer contrasena (admin):', error);
    return res.status(500).json({
      success: false,
      message: 'Error al restablecer contrasena',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const cambiarEstadoUsuario = async (req, res) => {
  const client = await pool.connect();
  try {
    const idUsuarioObjetivo = Number(req.params.id_usuario);
    const idUsuarioAdmin = req.usuario?.id_usuario;
    const activo = req.body?.activo === true;

    if (!idUsuarioObjetivo || Number.isNaN(idUsuarioObjetivo)) {
      return res.status(400).json({ success: false, message: 'ID de usuario invalido' });
    }
    if (!activo && idUsuarioObjetivo === idUsuarioAdmin) {
      return res.status(400).json({
        success: false,
        message: 'No puedes inactivar tu propio usuario',
      });
    }

    const result = await client.query(
      `UPDATE usuarios
       SET activo = $1,
           fecha_inactivacion = CASE WHEN $1 = false THEN NOW() ELSE NULL END,
           id_usuario_inactiva = CASE WHEN $1 = false THEN $2 ELSE NULL END
       WHERE id_usuario = $3
       RETURNING id_usuario, nombre_usuario, cargo, activo, fecha_inactivacion, id_usuario_inactiva`,
      [activo, idUsuarioAdmin, idUsuarioObjetivo]
    );

    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Usuario no encontrado' });
    }

    return res.json({
      success: true,
      message: activo ? 'Usuario activado exitosamente' : 'Usuario inactivado exitosamente',
      data: result.rows[0],
    });
  } catch (error) {
    console.error('Error al cambiar estado de usuario:', error);
    return res.status(500).json({
      success: false,
      message: 'Error al cambiar estado del usuario',
      error: error.message,
    });
  } finally {
    client.release();
  }
};

const eliminarUsuarioSoft = async (req, res) => {
  req.body.activo = false;
  return cambiarEstadoUsuario(req, res);
};

/**
 * Subir o actualizar foto de perfil
 */
const subirFotoPerfil = async (req, res) => {
  try {
    const idUsuario = req.usuario.id_usuario;

    if (!req.file) {
      return res.status(400).json({
        success: false,
        message: 'No se proporcionó ninguna imagen',
      });
    }

    logger.info('Foto de perfil subida exitosamente', {
      userId: idUsuario,
      fileName: req.file.filename,
      size: req.file.size,
    });

    res.status(200).json({
      success: true,
      message: 'Foto de perfil actualizada exitosamente',
      data: {
        filename: req.file.filename,
      },
    });
  } catch (error) {
    logger.logError(error, {
      userId: req.usuario?.id_usuario,
      action: 'subirFotoPerfil',
    });
    res.status(500).json({
      success: false,
      message: 'Error al subir la foto de perfil',
      error: error.message,
    });
  }
};

/**
 * Obtener foto de perfil
 */
const obtenerFotoPerfil = async (req, res) => {
  try {
    const { id } = req.params;
    const uploadPath = path.join(__dirname, '../../uploads/fotos-perfil');

    // Buscar archivo que comience con usuario_${id} y tenga extensión de imagen
    const archivos = fs.readdirSync(uploadPath);
    const archivoUsuario = archivos.find(file =>
      file.startsWith(`usuario_${id}.`) &&
      /\.(jpg|jpeg|png|webp)$/i.test(file)
    );

    if (!archivoUsuario) {
      return res.status(404).json({
        success: false,
        message: 'Foto de perfil no encontrada',
      });
    }

    const filePath = path.join(uploadPath, archivoUsuario);

    // Verificar que el archivo existe
    if (!fs.existsSync(filePath)) {
      return res.status(404).json({
        success: false,
        message: 'Foto de perfil no encontrada',
      });
    }

    logger.debug('Foto de perfil solicitada', {
      userId: id,
      file: archivoUsuario,
    });

    res.sendFile(filePath);
  } catch (error) {
    logger.logError(error, {
      userId: req.params.id,
      action: 'obtenerFotoPerfil',
    });
    res.status(500).json({
      success: false,
      message: 'Error al obtener la foto de perfil',
      error: error.message,
    });
  }
};

/**
 * Eliminar foto de perfil
 */
const eliminarFotoPerfil = async (req, res) => {
  try {
    const idUsuario = req.usuario.id_usuario;
    const uploadPath = path.join(__dirname, '../../uploads/fotos-perfil');

    // Buscar archivo que comience con usuario_${idUsuario}
    const archivos = fs.readdirSync(uploadPath);
    const archivoUsuario = archivos.find(file =>
      file.startsWith(`usuario_${idUsuario}.`) &&
      /\.(jpg|jpeg|png|webp)$/i.test(file)
    );

    if (!archivoUsuario) {
      return res.status(404).json({
        success: false,
        message: 'No hay foto de perfil para eliminar',
      });
    }

    const filePath = path.join(uploadPath, archivoUsuario);
    fs.unlinkSync(filePath);

    logger.info('Foto de perfil eliminada', {
      userId: idUsuario,
      fileName: archivoUsuario,
    });

    res.status(200).json({
      success: true,
      message: 'Foto de perfil eliminada exitosamente',
    });
  } catch (error) {
    logger.logError(error, {
      userId: req.usuario?.id_usuario,
      action: 'eliminarFotoPerfil',
    });
    res.status(500).json({
      success: false,
      message: 'Error al eliminar la foto de perfil',
      error: error.message,
    });
  }
};

module.exports = {
  login,
  crearUsuario,
  asignarPermisos,
  obtenerPerfil,
  actualizarCargoPerfil,
  cambiarPassword,
  listarUsuarios,
  actualizarUsuarioAdmin,
  cambiarPasswordUsuarioAdmin,
  cambiarEstadoUsuario,
  eliminarUsuarioSoft,
  subirFotoPerfil,
  obtenerFotoPerfil,
  eliminarFotoPerfil,
};
