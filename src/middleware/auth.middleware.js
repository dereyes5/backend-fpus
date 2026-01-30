const jwt = require('jsonwebtoken');
require('dotenv').config();

const verificarToken = (req, res, next) => {
  try {
    // Intentar obtener token del header Authorization o de query params
    let token = req.headers.authorization?.split(' ')[1];
    
    // Si no está en el header, buscar en query params (para peticiones GET directas)
    if (!token && req.query.token) {
      token = req.query.token;
    }
    
    if (!token) {
      return res.status(401).json({
        success: false,
        message: 'Token no proporcionado',
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.usuario = decoded;
    next();
  } catch (error) {
    if (error.name === 'JsonWebTokenError') {
      return res.status(401).json({
        success: false,
        message: 'Token inválido',
      });
    }
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({
        success: false,
        message: 'Token expirado',
      });
    }
    return res.status(500).json({
      success: false,
      message: 'Error al verificar el token',
      error: error.message,
    });
  }
};

/**
 * Middleware para verificar permisos específicos
 * @param {string} permiso - El permiso requerido (ej: 'cartera_lectura', 'benefactores_escritura')
 */
const verificarPermiso = (permiso) => {
  return (req, res, next) => {
    try {
      const { permisos } = req.usuario;
      
      if (!permisos) {
        return res.status(403).json({
          success: false,
          message: 'Usuario sin permisos asignados',
        });
      }

      if (!permisos[permiso]) {
        return res.status(403).json({
          success: false,
          message: `No tienes permiso para realizar esta acción. Permiso requerido: ${permiso}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error al verificar permisos',
        error: error.message,
      });
    }
  };
};

/**
 * Middleware para verificar cualquiera de múltiples permisos
 * @param {Array<string>} permisos - Array de permisos, si tiene al menos uno, pasa
 */
const verificarCualquierPermiso = (permisos) => {
  return (req, res, next) => {
    try {
      const { permisos: permisosUsuario } = req.usuario;
      
      if (!permisosUsuario) {
        return res.status(403).json({
          success: false,
          message: 'Usuario sin permisos asignados',
        });
      }

      const tieneAlgunPermiso = permisos.some(permiso => permisosUsuario[permiso]);
      
      if (!tieneAlgunPermiso) {
        return res.status(403).json({
          success: false,
          message: `No tienes permiso para realizar esta acción. Se requiere al menos uno de: ${permisos.join(', ')}`,
        });
      }

      next();
    } catch (error) {
      return res.status(500).json({
        success: false,
        message: 'Error al verificar permisos',
        error: error.message,
      });
    }
  };
};

module.exports = { 
  verificarToken,
  verificarPermiso,
  verificarCualquierPermiso,
};
